import { BUILDING_DEFS, ERAS, MAP_SIZE, UNIT_DEFS } from '../core/config'
import { dist, moveToward } from '../core/utils'
import { buildingsOfTeam, canTrain, findNearestDropoff, getEntity, nearestEnemy, queueTrain, recomputePop, spawnUnit, unitsOfTeam, type GameState } from './state'
import type { BuildingEntity, ResourceEntity, UnitEntity } from '../core/types'

export function stepSim(gs: GameState, dt: number): void {
  if (gs.status !== 'playing') return
  gs.time += dt
  if (gs.toast) { gs.toast.t -= dt; if (gs.toast.t <= 0) gs.toast = null }

  stepEra(gs, dt)
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

function stepBuildings(gs: GameState, dt: number): void {
  for (const e of gs.entities.values()) {
    if (e.dead || e.kind !== 'building') continue
    const b = e as BuildingEntity
    if (!b.built) {
      b.buildProgress += dt / BUILDING_DEFS[b.btype].buildTime
      b.hp = Math.min(b.maxHp, b.hp + (b.maxHp / BUILDING_DEFS[b.btype].buildTime) * dt)
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
      if (d > 3.6) { const p = moveToward(e.x, e.z, drop.x, drop.z, def.speed, dt); e.x = p.x; e.z = p.z; e.state = 'return' }
      else {
        for (const [k, v] of Object.entries(e.carrying)) (gs.players[e.team].resources as any)[k] += v as number
        e.carrying = {}; e.carryAmount = 0; e.state = 'gather'
      }
      return
    }
    const d = dist(e.x, e.z, node.x, node.z)
    if (d > 2.6) { const p = moveToward(e.x, e.z, node.x, node.z, def.speed, dt); e.x = p.x; e.z = p.z; e.state = 'gather' }
    else {
      e.state = 'gather'
      e.workCd -= 0 // handled by dt accumulation below
      const gatherPerSec = (def.gatherRate ?? 8)
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
    else { const p = moveToward(e.x, e.z, wp.x, wp.z, def.speed, dt); e.x = p.x; e.z = p.z; e.state = 'move' }
  } else {
    e.state = 'idle'
  }
}

function stepEnemyEngineer(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  // simple: always gather nearest available of needed resource cycle
  if (e.carryAmount >= (def.carry ?? 10)) {
    const drop = findNearestDropoff(gs, 'enemy', e.x, e.z)
    if (drop) {
      const d = dist(e.x, e.z, drop.x, drop.z)
      if (d > 3.6) { const p = moveToward(e.x, e.z, drop.x, drop.z, def.speed, dt); e.x = p.x; e.z = p.z }
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
      if (d > 2.6) { const p = moveToward(e.x, e.z, node.x, node.z, def.speed, dt); e.x = p.x; e.z = p.z }
      else {
        const take = Math.min((def.gatherRate ?? 8) * dt, node.amount, (def.carry ?? 10) - e.carryAmount)
        if (take > 0) { node.amount -= take; e.carrying[node.resource] = (e.carrying[node.resource] ?? 0) + take; e.carryAmount += take }
        if (node.amount <= 0) node.dead = true
      }
      return
    }
  }
}

function stepCombatUnit(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  const tgt = e.targetId ? getEntity(gs, e.targetId) : nearestEnemy(gs, e.team, e.x, e.z, def.sight)
  if (!tgt || tgt.dead || tgt.team === e.team || tgt.kind === 'resource') {
    e.targetId = undefined
    // follow path if any
    if (e.path.length > 0) {
      const wp = e.path[0]
      const d = dist(e.x, e.z, wp.x, wp.z)
      if (d < 0.4) e.path.shift()
      else { const p = moveToward(e.x, e.z, wp.x, wp.z, def.speed, dt); e.x = p.x; e.z = p.z; e.state = 'move' }
    } else e.state = 'idle'
    return
  }
  e.targetId = tgt.id
  const d = dist(e.x, e.z, tgt.x, tgt.z)
  if (d > def.range) {
    const p = moveToward(e.x, e.z, tgt.x, tgt.z, def.speed, dt); e.x = p.x; e.z = p.z; e.state = 'attack'
  } else {
    e.state = 'attack'
    if (e.attackCd <= 0) {
      tgt.hp -= def.damage
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
  const tcs = buildingsOfTeam(gs, 'enemy').filter(b => b.btype === 'ayuntamiento' && b.built)
  const barracks = buildingsOfTeam(gs, 'enemy').filter(b => b.btype === 'cuartel' && b.built)
  const houses = buildingsOfTeam(gs, 'enemy').filter(b => b.btype === 'vivienda')
  const engs = unitsOfTeam(gs, 'enemy').filter(u => u.utype === 'ingeniero')
  const army = unitsOfTeam(gs, 'enemy').filter(u => u.utype !== 'ingeniero')

  // train engineers
  if (engs.length < 8 && tcs[0]) {
    if (canTrain(gs, 'enemy', 'ingeniero').ok) queueTrain(gs, 'enemy', tcs[0].id, 'ingeniero')
  }
  // build barracks if enough mats
  if (barracks.length < 1 && p.resources.materiales >= 170) {
    // cheat-spawn as built for simplicity of AI
    p.resources.materiales -= 150
    const bx = 55 + Math.random() * 8, bz = -10 + Math.random() * 8
    const b = { id: (Math.random()*1e9)|0, kind: 'building' as const, team: 'enemy' as const, x: bx, z: bz, hp: 1200, maxHp: 1200, selected: false, dead: false, btype: 'cuartel' as const, built: true, buildProgress: 1, queue: [] }
    // use spawn via state helper not imported; easier to mutate directly:
    gs.entities.set(b.id, b as any)
  }
  if (houses.length < 1 && p.resources.materiales >= 80) {
    p.resources.materiales -= 60
    const b = { id: (Math.random()*1e9)|0, kind: 'building' as const, team: 'enemy' as const, x: 58, z: 10, hp: 500, maxHp: 500, selected: false, dead: false, btype: 'vivienda' as const, built: true, buildProgress: 1, queue: [] }
    gs.entities.set(b.id, b as any)
  }
  // train army
  const br = buildingsOfTeam(gs, 'enemy').find(b => b.btype === 'cuartel' && b.built)
  if (br && army.length < 12) {
    if (canTrain(gs, 'enemy', 'milicia').ok) queueTrain(gs, 'enemy', br.id, 'milicia')
  }
  // attack waves
  if (army.length >= 6) {
    const target = buildingsOfTeam(gs, 'player').find(b => b.btype === 'ayuntamiento') || buildingsOfTeam(gs, 'player')[0]
    if (target) {
      for (const u of army) {
        if (u.state === 'idle' || !u.targetId) { u.targetId = target.id; u.state = 'attack' }
      }
    }
  }
  // passive income trickle so AI doesn't stall too hard
  p.resources.suministros += 4
  p.resources.materiales += 3
  recomputePop(gs)
}

function checkVictory(gs: GameState): void {
  const playerTC = buildingsOfTeam(gs, 'player').some(b => b.btype === 'ayuntamiento')
  const enemyTC = buildingsOfTeam(gs, 'enemy').some(b => b.btype === 'ayuntamiento')
  if (!enemyTC) gs.status = 'victory'
  else if (!playerTC) gs.status = 'defeat'
}
