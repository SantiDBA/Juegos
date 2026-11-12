import { BUILDING_DEFS, ERAS, MAP_SIZE, TECHS, UNIT_DEFS } from '../core/config'
import { computeDamage, UNIT_COMBAT, type AttackProfile, type DefenseProfile } from '../core/combat'
import { canAfford, dist, moveToward, spend } from '../core/utils'
import { applyTech, buildingsOfTeam, canResearch, canTrain, findNearestDropoff, getEntity, nearestEnemy, queueResearch, queueTrain, recomputePop, spawnBuilding, spawnUnit, unitsOfTeam, type GameState } from './state'
import type { AnyEntity, BuildingEntity, ResourceEntity, UnitEntity, UnitType } from '../core/types'

export function stepSim(gs: GameState, dt: number): void {
  if (gs.status !== 'playing') return
  gs.time += dt
  if (gs.toast) { gs.toast.t -= dt; if (gs.toast.t <= 0) gs.toast = null }

  stepEra(gs, dt)
  stepResearch(gs, dt)
  stepBuildings(gs, dt)
  stepUnits(gs, dt)
  cleanupDead(gs)
  stepAI(gs, dt)
  checkVictory(gs)
  recomputePop(gs)
}

function stepEra(gs: GameState, dt: number): void {
  for (const team of ['player', 'enemy'] as const) {
    const p = gs.players[team]
    if (!p.advancing) continue
    p.advancing.remaining -= dt
    if (p.advancing.remaining <= 0) {
      p.era = p.advancing.to
      p.advancing = null
      if (team === 'player') gs.toast = { msg: `¡Avanzaste a ${ERAS[p.era - 1].name}!`, t: 3 }
    }
  }
}

function stepResearch(gs: GameState, dt: number): void {
  for (const team of ['player', 'enemy'] as const) {
    const p = gs.players[team]
    if (!p.research) continue
    p.research.remaining -= dt
    if (p.research.remaining <= 0) {
      const tech = TECHS.find(t => t.id === p.research!.id)
      applyTech(p, p.research.id)
      p.research = null
      if (team === 'player' && tech) gs.toast = { msg: `¡${tech.name} investigada!`, t: 3 }
    }
  }
}

function defenseOf(tgt: AnyEntity): DefenseProfile {
  if (tgt.kind === 'unit') return UNIT_COMBAT[tgt.utype]?.defense ?? { combatClass: ['infanteria'], armor: {} }
  if (tgt.kind === 'building') return { combatClass: ['edificio'], armor: {} }
  return { combatClass: ['civil'], armor: {} }
}

function damageTo(gs: GameState, attackerTeam: AnyEntity['team'], atk: AttackProfile, tgt: AnyEntity): number {
  const raw = computeDamage(atk, defenseOf(tgt))
  const mult = 1 + gs.players[attackerTeam].bonuses.attackPct
  const armorFlat = gs.players[tgt.team].bonuses.armorFlat
  return Math.max(1, raw * mult - armorFlat)
}

function unitSpeed(gs: GameState, e: UnitEntity): number {
  return UNIT_DEFS[e.utype].speed * (1 + gs.players[e.team].bonuses.speedPct)
}

function stepBuildings(gs: GameState, dt: number): void {
  for (const e of gs.entities.values()) {
    if (e.dead || e.kind !== 'building') continue
    const b = e as BuildingEntity
    if (!b.built) {
      // Buildings need at least one engineer nearby to progress
      const builders = unitsOfTeam(gs, b.team).filter(u =>
        u.utype === 'ingeniero' && !u.dead &&
        (u.state === 'build' || dist(u.x, u.z, b.x, b.z) < 5.5)
      ).length
      const buildSpeed = builders > 0 ? (1 + 0.35 * (Math.min(builders, 4) - 1)) : 0
      if (buildSpeed > 0) {
        b.buildProgress += dt * buildSpeed / BUILDING_DEFS[b.btype].buildTime
        b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * buildSpeed / BUILDING_DEFS[b.btype].buildTime) * dt)
      }
      if (b.buildProgress >= 1) { b.built = true; b.buildProgress = 1; b.hp = b.maxHp }
      continue
    }
    if (b.queue.length > 0) {
      const job = b.queue[0]
      job.remaining -= dt
      if (job.remaining <= 0) {
        b.queue.shift()
        const dir = (b.rally ? Math.atan2(b.rally.z - b.z, b.rally.x - b.x) : Math.random() * Math.PI * 2)
        const rx = b.x + Math.cos(dir) * (BUILDING_DEFS[b.btype].size.x / 2 + 2.2)
        const rz = b.z + Math.sin(dir) * (BUILDING_DEFS[b.btype].size.z / 2 + 2.2)
        const u = spawnUnit(gs, b.team, job.type, rx, rz)
        if (b.rally) { u.path = [{ ...b.rally }]; u.state = 'move' }
      }
    }
    const atkDef = BUILDING_DEFS[b.btype].attack
    if (atkDef) {
      b.attackCd = Math.max(0, b.attackCd - dt)
      const tgt = nearestEnemy(gs, b.team, b.x, b.z, atkDef.range)
      if (tgt && b.attackCd <= 0) {
        tgt.hp -= damageTo(gs, b.team, { base: atkDef.damage, bonusVs: { infanteria: 6, caballeria: 6 } }, tgt)
        b.attackCd = atkDef.cooldown
        if (tgt.hp <= 0) tgt.dead = true
      }
    }
  }
}

function stepUnits(gs: GameState, dt: number): void {
  // separation pass (simple)
  const units = unitsOfTeam(gs, 'player').concat(unitsOfTeam(gs, 'enemy'))
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j]
      const dx = b.x - a.x, dz = b.z - a.z
      const d2 = dx * dx + dz * dz
      if (d2 < 1.8 * 1.8 && d2 > 0.001) {
        const d = Math.sqrt(d2)
        const push = (1.8 - d) * 0.5
        a.x -= (dx / d) * push; a.z -= (dz / d) * push
        b.x += (dx / d) * push; b.z += (dz / d) * push
      }
    }
  }

  for (const e of units) {
    if (e.dead) continue
    const def = UNIT_DEFS[e.utype]
    e.attackCd = Math.max(0, e.attackCd - dt)
    e.workCd = Math.max(0, e.workCd - dt)

    // auto-acquire enemy if idle or already attacking, but don't override an explicit move order
    if (!e.targetId || !getEntity(gs, e.targetId) || getEntity(gs, e.targetId)!.dead) {
      const hasMoveOrder = e.state === 'move' && e.path.length > 0
      if (!hasMoveOrder && (e.state === 'idle' || e.state === 'move' || e.state === 'attack')) {
        const tgt = nearestEnemy(gs, e.team, e.x, e.z, def.sight)
        if (tgt) { e.targetId = tgt.id; e.state = 'attack' }
      }
    }

    if (e.utype === 'ingeniero' && e.team === 'player') {
      stepEngineer(gs, e, dt)
    } else if (e.utype === 'ingeniero' && e.team === 'enemy') {
      stepEnemyEngineer(gs, e, dt)
    } else {
      stepCombatUnit(gs, e, dt)
    }

    // bounds
    const lim = MAP_SIZE / 2 - 2
    e.x = Math.max(-lim, Math.min(lim, e.x))
    e.z = Math.max(-lim, Math.min(lim, e.z))
  }
}

function stepEngineer(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  const speed = unitSpeed(gs, e)
  if (e.gatherTargetId) {
    const node = getEntity(gs, e.gatherTargetId) as ResourceEntity | undefined
    if (!node || node.dead || node.kind !== 'resource' || node.amount <= 0) {
      e.gatherTargetId = undefined; e.state = 'idle'; return
    }
    if (e.carryAmount >= (def.carry ?? 10)) {
      // return
      const drop = e.dropoffTargetId ? getEntity(gs, e.dropoffTargetId) : findNearestDropoff(gs, e.team, e.x, e.z)
      if (!drop || drop.kind !== 'building') { e.state = 'idle'; return }
      e.dropoffTargetId = drop.id
      const d = dist(e.x, e.z, drop.x, drop.z)
      if (d > 3.6) { const p = moveToward(e.x, e.z, drop.x, drop.z, speed, dt); e.x = p.x; e.z = p.z; e.state = 'return' }
      else {
        for (const [k, v] of Object.entries(e.carrying)) (gs.players[e.team].resources as any)[k] += v as number
        e.carrying = {}; e.carryAmount = 0; e.state = 'gather'
      }
      return
    }
    const d = dist(e.x, e.z, node.x, node.z)
    if (d > 2.6) { const p = moveToward(e.x, e.z, node.x, node.z, speed, dt); e.x = p.x; e.z = p.z; e.state = 'gather' }
    else {
      e.state = 'gather'
      e.workCd -= 0 // handled by dt accumulation below
      const gatherPerSec = (def.gatherRate ?? 8) * (1 + gs.players[e.team].bonuses.gatherPct)
      const take = Math.min(gatherPerSec * dt, node.amount, (def.carry ?? 10) - e.carryAmount)
      if (take > 0) {
        node.amount -= take
        e.carrying[node.resource] = (e.carrying[node.resource] ?? 0) + take
        e.carryAmount += take
      }
      if (node.amount <= 0) { node.dead = true; e.gatherTargetId = undefined }
    }
    return
  }

  if (e.targetId) { // can attack if forced
    stepCombatUnit(gs, e, dt); return
  }
  if (e.path.length > 0) {
    const wp = e.path[0]
    const d = dist(e.x, e.z, wp.x, wp.z)
    if (d < 0.4) e.path.shift()
    else { const p = moveToward(e.x, e.z, wp.x, wp.z, speed, dt); e.x = p.x; e.z = p.z; e.state = 'move' }
  } else {
    e.state = 'idle'
  }
}

function stepEnemyEngineer(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  const speed = unitSpeed(gs, e)
  // simple: always gather nearest available of needed resource cycle
  if (e.carryAmount >= (def.carry ?? 10)) {
    const drop = findNearestDropoff(gs, 'enemy', e.x, e.z)
    if (drop) {
      const d = dist(e.x, e.z, drop.x, drop.z)
      if (d > 3.6) { const p = moveToward(e.x, e.z, drop.x, drop.z, speed, dt); e.x = p.x; e.z = p.z }
      else { for (const [k, v] of Object.entries(e.carrying)) (gs.players.enemy.resources as any)[k] += v as number; e.carrying = {}; e.carryAmount = 0 }
    }
    return
  }
  const prefs: any[] = ['materiales', 'suministros', 'combustible', 'minerales']
  for (const rk of prefs) {
    let node: ResourceEntity | null = null
    let bestD = Infinity
    for (const ent of gs.entities.values()) {
      if (ent.dead || ent.kind !== 'resource' || ent.resource !== rk || ent.amount <= 0) continue
      const d = dist(e.x, e.z, ent.x, ent.z)
      if (d < bestD) { bestD = d; node = ent }
    }
    if (node) {
      const d = dist(e.x, e.z, node.x, node.z)
      if (d > 2.6) { const p = moveToward(e.x, e.z, node.x, node.z, speed, dt); e.x = p.x; e.z = p.z }
      else {
        const take = Math.min((def.gatherRate ?? 8) * (1 + gs.players[e.team].bonuses.gatherPct) * dt, node.amount, (def.carry ?? 10) - e.carryAmount)
        if (take > 0) { node.amount -= take; e.carrying[node.resource] = (e.carrying[node.resource] ?? 0) + take; e.carryAmount += take }
        if (node.amount <= 0) node.dead = true
      }
      return
    }
  }
}

function stepCombatUnit(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  const speed = unitSpeed(gs, e)
  const tgt = e.targetId ? getEntity(gs, e.targetId) : nearestEnemy(gs, e.team, e.x, e.z, def.sight)
  if (!tgt || tgt.dead || tgt.team === e.team || tgt.kind === 'resource') {
    e.targetId = undefined
    // follow path if any
    if (e.path.length > 0) {
      const wp = e.path[0]
      const d = dist(e.x, e.z, wp.x, wp.z)
      if (d < 0.4) e.path.shift()
      else { const p = moveToward(e.x, e.z, wp.x, wp.z, speed, dt); e.x = p.x; e.z = p.z; e.state = 'move' }
    } else e.state = 'idle'
    return
  }
  e.targetId = tgt.id
  const d = dist(e.x, e.z, tgt.x, tgt.z)
  if (d > def.range) {
    const p = moveToward(e.x, e.z, tgt.x, tgt.z, speed, dt); e.x = p.x; e.z = p.z; e.state = 'attack'
  } else {
    e.state = 'attack'
    if (e.attackCd <= 0) {
      const atkProfile = UNIT_COMBAT[e.utype]?.attack ?? { base: def.damage, bonusVs: {} }
      tgt.hp -= damageTo(gs, e.team, atkProfile, tgt)
      e.attackCd = def.attackCooldown
      if (tgt.hp <= 0) { tgt.dead = true; if (e.targetId === tgt.id) e.targetId = undefined }
    }
  }
}

function cleanupDead(gs: GameState): void {
  for (const [id, e] of gs.entities) {
    if (e.dead && e.kind === 'resource') gs.entities.delete(id)
    else if (e.dead && e.kind !== 'resource') {
      // keep briefly? remove now
      gs.entities.delete(id)
    }
  }
}

let aiTimer = 0
function stepAI(gs: GameState, dt: number): void {
  aiTimer += dt
  if (aiTimer < 1.0) return
  aiTimer = 0
  const p = gs.players.enemy
  const buildings = buildingsOfTeam(gs, 'enemy')
  const tcs = buildings.filter(b => b.btype === 'ayuntamiento' && b.built)
  const barracks = buildings.filter(b => b.btype === 'cuartel' && b.built)
  const factories = buildings.filter(b => b.btype === 'fabrica' && b.built)
  const houses = buildings.filter(b => b.btype === 'vivienda')
  const towers = buildings.filter(b => b.btype === 'torre')
  const engs = unitsOfTeam(gs, 'enemy').filter(u => u.utype === 'ingeniero')
  const army = unitsOfTeam(gs, 'enemy').filter(u => u.utype !== 'ingeniero')

  // economy and base building
  if (engs.length < 8 && tcs[0] && canTrain(gs, 'enemy', 'ingeniero').ok) queueTrain(gs, 'enemy', tcs[0].id, 'ingeniero')
  if (houses.length < 2 && p.resources.materiales >= 140) {
    p.resources.materiales -= 60
    spawnBuilding(gs, 'enemy', 'vivienda', 58, 10 + houses.length * 8, true)
  }
  if (barracks.length < 1 && p.resources.materiales >= 170) {
    p.resources.materiales -= 150
    spawnBuilding(gs, 'enemy', 'cuartel', 55 + Math.random() * 8, -10 + Math.random() * 8, true)
  }
  if (p.era >= 2 && factories.length < 1 && p.resources.materiales >= 300 && p.resources.combustible >= 120) {
    p.resources.materiales -= 250
    p.resources.combustible -= 100
    spawnBuilding(gs, 'enemy', 'fabrica', 62 + Math.random() * 6, 2 + Math.random() * 8, true)
  }
  if (p.era >= 2 && towers.length < 2 && p.resources.materiales >= 130) {
    p.resources.materiales -= 100
    spawnBuilding(gs, 'enemy', 'torre', 44, -18 + towers.length * 36, true)
  }

  // advance eras once the army can hold the line
  const nextEra = ERAS[p.era]
  if (!p.advancing && nextEra && army.length >= (p.era === 1 ? 4 : 8) && canAfford(p.resources, nextEra.advanceCost)) {
    spend(p.resources, nextEra.advanceCost)
    p.advancing = { to: nextEra.id, remaining: nextEra.advanceTime, total: nextEra.advanceTime }
  }

  // era-based army composition
  const infRoster: UnitType[] = ['milicia', 'granadero']
  if (p.era >= 2) infRoster.push('fusilero')
  if (p.era >= 3) infRoster.push('fusilero', 'francotirador', 'inf_mecanizada')
  if (p.era >= 4) infRoster.push('inf_mecanizada', 'francotirador')
  const vehRoster: UnitType[] = []
  if (p.era >= 2) vehRoster.push('blindado', 'canon')
  if (p.era >= 3) vehRoster.push('tanque', 'cazacarros')
  if (p.era >= 4) vehRoster.push('tanque_autonomo', 'mlrs', 'dron')

  const armyCap = Math.min(32, Math.max(12, p.popCap - 10))
  if (army.length < armyCap) {
    const br = barracks[0]
    if (br && Math.random() < 0.75) {
      const pick = infRoster[Math.floor(Math.random() * infRoster.length)]
      if (canTrain(gs, 'enemy', pick).ok) queueTrain(gs, 'enemy', br.id, pick)
    }
    const fac = factories[0]
    if (fac && Math.random() < 0.6) {
      const pick = vehRoster[Math.floor(Math.random() * vehRoster.length)]
      if (canTrain(gs, 'enemy', pick).ok) queueTrain(gs, 'enemy', fac.id, pick)
    }
  }

  // research affordable techs
  if (!p.research && tcs[0]) {
    for (const t of TECHS) {
      if (canResearch(gs, 'enemy', t.id).ok) { queueResearch(gs, 'enemy', t.id); break }
    }
  }

  // attack waves grow with era
  const waveSize = 6 + p.era * 3
  if (army.length >= waveSize) {
    const target = buildingsOfTeam(gs, 'player').find(b => b.btype === 'ayuntamiento') || buildingsOfTeam(gs, 'player')[0]
    if (target) {
      for (const u of army) {
        if (u.state === 'idle' || !u.targetId) { u.targetId = target.id; u.state = 'attack' }
      }
    }
  }
  recomputePop(gs)
}

function checkVictory(gs: GameState): void {
  const playerTC = buildingsOfTeam(gs, 'player').some(b => b.btype === 'ayuntamiento')
  const enemyTC = buildingsOfTeam(gs, 'enemy').some(b => b.btype === 'ayuntamiento')
  if (!enemyTC) gs.status = 'victory'
  else if (!playerTC) gs.status = 'defeat'
}
