import { BUILDING_DEFS, ERAS, TECHS, UNIT_DEFS } from '../core/config'
import { computeDamage, UNIT_COMBAT, type AttackProfile, type DefenseProfile } from '../core/combat'
import { dist, moveToward } from '../core/utils'
import { applyTech, buildingsOfTeam, findNearestDropoff, getEntity, nearestEnemy, recomputePop, spawnUnit, unitsOfTeam, type GameState } from './state'
import { emit } from './events'
import { stepAI } from './ai'
import type { AnyEntity, BuildingEntity, ResourceEntity, UnitEntity } from '../core/types'

const MAX_EVENTS = 512

export function stepSim(gs: GameState, dt: number): void {
  if (gs.status !== 'playing') return
  gs.time += dt
  if (gs.toast) { gs.toast.t -= dt; if (gs.toast.t <= 0) gs.toast = null }

  stepEra(gs, dt)
  stepResearch(gs, dt)
  stepBuildings(gs, dt)
  stepUnits(gs, dt)
  cleanupDead(gs)
  stepAI(gs, 'enemy', dt)
  checkVictory(gs)
  recomputePop(gs)
  if (gs.events.length > MAX_EVENTS) gs.events.splice(0, gs.events.length - MAX_EVENTS)
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
      const techId = p.research.id
      const tech = TECHS.find(t => t.id === techId)
      applyTech(p, techId)
      p.research = null
      emit(gs, { kind: 'tech-complete', team, techId })
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

/** Applies one attack: emits attack + damage events and marks the target dead. */
function applyHit(gs: GameState, attacker: AnyEntity, atk: AttackProfile, tgt: AnyEntity): void {
  const dmg = damageTo(gs, attacker.team, atk, tgt)
  emit(gs, { kind: 'attack', from: attacker.id, to: tgt.id, unitType: attacker.kind === 'unit' ? attacker.utype : undefined, x: attacker.x, z: attacker.z })
  tgt.hp -= dmg
  emit(gs, { kind: 'damage', target: tgt.id, amount: dmg, x: tgt.x, z: tgt.z })
  if (tgt.hp <= 0) tgt.dead = true
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
      if (b.buildProgress >= 1) {
        b.built = true; b.buildProgress = 1; b.hp = b.maxHp
        emit(gs, { kind: 'build-complete', team: b.team, buildingType: b.btype, x: b.x, z: b.z })
      }
      continue
    }
    if (b.queue.length > 0) {
      const job = b.queue[0]
      job.remaining -= dt
      if (job.remaining <= 0) {
        b.queue.shift()
        const dir = (b.rally ? Math.atan2(b.rally.z - b.z, b.rally.x - b.x) : gs.rng.range(0, Math.PI * 2))
        const rx = b.x + Math.cos(dir) * (BUILDING_DEFS[b.btype].size.x / 2 + 2.2)
        const rz = b.z + Math.sin(dir) * (BUILDING_DEFS[b.btype].size.z / 2 + 2.2)
        const u = spawnUnit(gs, b.team, job.type, rx, rz)
        if (b.rally) { u.path = [{ ...b.rally }]; u.state = 'move' }
        emit(gs, { kind: 'train-complete', team: b.team, unitType: u.utype, x: u.x, z: u.z })
      }
    }
    const atkDef = BUILDING_DEFS[b.btype].attack
    if (atkDef) {
      b.attackCd = Math.max(0, b.attackCd - dt)
      const tgt = nearestEnemy(gs, b.team, b.x, b.z, atkDef.range)
      if (tgt && b.attackCd <= 0) {
        applyHit(gs, b, { base: atkDef.damage, bonusVs: { infanteria: 6, caballeria: 6 } }, tgt)
        b.attackCd = atkDef.cooldown
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

    if (e.utype === 'ingeniero' && e.state === 'build' && stepBuilder(gs, e, dt)) {
      // on build duty: progress is credited by stepBuildings
    } else if (e.utype === 'ingeniero' && e.team === 'player') {
      stepEngineer(gs, e, dt)
    } else if (e.utype === 'ingeniero' && e.team === 'enemy') {
      stepEnemyEngineer(gs, e, dt)
    } else {
      stepCombatUnit(gs, e, dt)
    }

    // bounds
    const lim = gs.mapSize / 2 - 2
    e.x = Math.max(-lim, Math.min(lim, e.x))
    e.z = Math.max(-lim, Math.min(lim, e.z))
  }
}

/** Nearest friendly site still under construction, at any distance. */
function nearestBuildSite(gs: GameState, team: AnyEntity['team'], x: number, z: number): BuildingEntity | null {
  let best: BuildingEntity | null = null
  let bestD = Infinity
  for (const b of buildingsOfTeam(gs, team)) {
    if (b.built) continue
    const d = dist(x, z, b.x, b.z)
    if (d < bestD) { bestD = d; best = b }
  }
  return best
}

/**
 * Engineer on build duty (state 'build'): walks to the closest unfinished site
 * and holds there, where stepBuildings credits it as a builder. Returns false
 * once nothing is left to build so the engineer resumes its normal job.
 */
function stepBuilder(gs: GameState, e: UnitEntity, dt: number): boolean {
  const site = nearestBuildSite(gs, e.team, e.x, e.z)
  if (!site) { e.state = 'idle'; e.path = []; return false }
  const d = dist(e.x, e.z, site.x, site.z)
  if (d > 3) {
    const p = moveToward(e.x, e.z, site.x, site.z, unitSpeed(gs, e), dt)
    e.x = p.x; e.z = p.z
  }
  return true
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
      applyHit(gs, e, atkProfile, tgt)
      e.attackCd = def.attackCooldown
      if (tgt.dead && e.targetId === tgt.id) e.targetId = undefined
    }
  }
}

function cleanupDead(gs: GameState): void {
  for (const [id, e] of gs.entities) {
    if (!e.dead) continue
    if (e.kind !== 'resource') {
      emit(gs, { kind: 'death', entity: e.kind, team: e.team, unitType: e.kind === 'unit' ? e.utype : undefined, x: e.x, z: e.z })
    }
    gs.entities.delete(id)
  }
}

function checkVictory(gs: GameState): void {
  const playerTC = buildingsOfTeam(gs, 'player').some(b => b.btype === 'ayuntamiento')
  const enemyTC = buildingsOfTeam(gs, 'enemy').some(b => b.btype === 'ayuntamiento')
  if (!enemyTC) gs.status = 'victory'
  else if (!playerTC) gs.status = 'defeat'
}
