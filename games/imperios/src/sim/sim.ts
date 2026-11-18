import { BUILDING_DEFS, ERAS, TECHS, TILE, UNIT_DEFS } from '../core/config'
import { computeDamage, UNIT_COMBAT, type AttackProfile, type DefenseProfile } from '../core/combat'
import { dist, moveToward } from '../core/utils'
import { applyTech, buildingsOfTeam, findNearestDropoff, FORMATION_SPACING, getEntity, recomputePop, spawnUnit, unitsOfTeam, type GameState } from './state'
import { emit } from './events'
import { stepAI } from './ai'
import { nearestVisibleEnemy, stepVision } from './vision'
import { isBlocked, isHardBlocked, markNavDirty, resolveBlocked } from './navgrid'
import { findPath } from './path'
import type { AnyEntity, BuildingEntity, ResourceEntity, UnitEntity } from '../core/types'

const MAX_EVENTS = 512

/** Waypoint arrival radius, in world units. */
const ARRIVE = 0.35
/** Distance considered "arrived and anchored" when converging to a formation/home slot. */
const HOME_SETTLE = 0.5
/** Gatherers stand this close to the node they are working. */
const GATHER_RANGE = 2.6
/** Delivered loads may be dropped off from this far from a building's edge. */
const DROPOFF_EDGE_RANGE = 1.5
/**
 * Tolerance for every range comparison. The approach helpers clamp the last
 * step exactly onto the stop distance, so without it a unit sits on the edge
 * forever ("d > range" true, but no step left to take).
 */
const RANGE_EPS = 0.05
/** Beyond this distance movement uses A* instead of a direct step. */
const DIRECT_RANGE = TILE * 3
/** Seconds between chase repaths (staggered per unit so they never burst together). */
const CHASE_REPATH = 0.5
/** Defensive units never chase further than this from their anchor. */
const DEFENSIVE_LEASH = 6
/** Give up on a shared intermediate waypoint after this long without progress. */
const STUCK_SKIP = 0.8
/** Same for the final waypoint, once the unit is close enough to call it done. */
const STUCK_ARRIVE = 2

export function stepSim(gs: GameState, dt: number): void {
  if (gs.status !== 'playing') return
  gs.time += dt
  if (gs.toast) { gs.toast.t -= dt; if (gs.toast.t <= 0) gs.toast = null }

  stepEra(gs, dt)
  stepResearch(gs, dt)
  stepBuildings(gs, dt)
  stepUnits(gs, dt)
  stepVision(gs, dt)
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
  emit(gs, {
    kind: 'attack',
    from: attacker.id, to: tgt.id,
    unitType: attacker.kind === 'unit' ? attacker.utype : undefined,
    x: attacker.x, z: attacker.z, tx: tgt.x, tz: tgt.z,
  })
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
      // a tower only shoots what its own sight circle covers (range <= sight)
      const tgt = nearestVisibleEnemy(gs, b.team, b.x, b.z, atkDef.range)
      if (tgt && b.attackCd <= 0) {
        applyHit(gs, b, { base: atkDef.damage, bonusVs: { infanteria: 6, caballeria: 6 } }, tgt)
        b.attackCd = atkDef.cooldown
      }
    }
  }
}

const VEHICLES = new Set<string>(['blindado', 'cazacarros', 'canon', 'mlrs', 'tanque', 'tanque_autonomo'])

function unitRadius(utype: string): number {
  if (utype === 'ingeniero') return 0.8
  if (utype === 'dron') return 0.9
  if (VEHICLES.has(utype)) return 1.45
  return 1.0
}

/** True when a unit is converging/holding a formation/home slot; keeps formation while fighting near its slot. */
function isFormationSettling(gs: GameState, e: UnitEntity): boolean {
  if (!e.home) return false
  if (e.state !== 'move' && e.state !== 'attack') return false
  const hd = dist(e.x, e.z, e.home.x, e.home.z)
  if (e.targetId) {
    const t = getEntity(gs, e.targetId)
    if (t && !t.dead && t.team !== e.team && t.kind !== 'resource') {
      // allow dress-ranks/spacing discipline while engaging close to the assigned slot
      return hd < FORMATION_SPACING * 3.0
    }
  }
  // also keep discipline when in combat contact near slot even if target ref is transient
  if (e.state === 'attack') return hd < FORMATION_SPACING * 2.6
  return hd < FORMATION_SPACING * 1.5
}

/**
 * Removes most of the displacement component that would move a settling unit away
 * from its home slot, so separation can nudge overlap without dissolving rows/columns.
 */
function attenuateAwayFromHome(e: UnitEntity, dx: number, dz: number): { dx: number; dz: number } {
  if (!e.home) return { dx, dz }
  const ax = e.x - e.home.x
  const az = e.z - e.home.z
  const a2 = ax * ax + az * az
  if (a2 < 1e-6) return { dx, dz }
  const dot = (dx * ax + dz * az) / a2
  if (dot <= 0) return { dx, dz }
  const keepAway = 0.2
  return { dx: dx - ax * dot * (1 - keepAway), dz: dz - az * dot * (1 - keepAway) }
}

/**
 * Units advancing toward a combat target must not be shoved backwards by their
 * own allies: A* only knows the static nav grid, so a crowded melee has no
 * unit-vs-unit avoidance and the separation push can cancel a unit's forward
 * step exactly (the unit freezes in `attack`, bobbing, never reaching range).
 * Keep most of the component that points away from the goal (lateral spread),
 * drop most of the one that pushes back.
 */
function attenuateAwayFromGoal(gs: GameState, e: UnitEntity, dx: number, dz: number): { dx: number; dz: number } {
  if (!e.targetId) return { dx, dz }
  const t = getEntity(gs, e.targetId)
  if (!t || t.dead) return { dx, dz }
  const gx = t.x - e.x, gz = t.z - e.z
  const l2 = gx * gx + gz * gz
  if (l2 < 1e-6) return { dx, dz }
  const dot = (dx * gx + dz * gz) / l2
  if (dot >= 0) return { dx, dz } // push already moves the unit toward the goal
  const keep = 0.06
  return { dx: dx - gx * dot * (1 - keep), dz: dz - gz * dot * (1 - keep) }
}

function stepUnits(gs: GameState, dt: number): void {
  // separation pass (simple)
  const units = unitsOfTeam(gs, 'player').concat(unitsOfTeam(gs, 'enemy'))
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j]
      const dx = b.x - a.x, dz = b.z - a.z
      const minDist = unitRadius(a.utype) + unitRadius(b.utype)
      const d2 = dx * dx + dz * dz
      if (d2 < minDist * minDist && d2 > 0.001) {
        const d = Math.sqrt(d2)
        const push = (minDist - d) * 0.58
        // standground units hold their tile: the neighbour absorbs the whole push
        const aHolds = a.stance === 'standground'
        const bHolds = b.stance === 'standground'
        if (aHolds && bHolds) continue
        let aPush = bHolds ? push * 2 : aHolds ? 0 : push
        let bPush = aHolds ? push * 2 : bHolds ? 0 : push

        const aForm = aPush > 0 && isFormationSettling(gs, a)
        const bForm = bPush > 0 && isFormationSettling(gs, b)
        // pairs settling/fighting in formation slots need weaker mutual separation to hold rows/columns
        if (aForm && bForm) { aPush *= 0.28; bPush *= 0.28 }
        else if (aForm) { aPush *= 0.45 }
        else if (bForm) { bPush *= 0.45 }

        let adx = -(dx / d) * aPush, adz = -(dz / d) * aPush
        let bdx = (dx / d) * bPush, bdz = (dz / d) * bPush
        if (aForm) ({ dx: adx, dz: adz } = attenuateAwayFromHome(a, adx, adz))
        if (bForm) ({ dx: bdx, dz: bdz } = attenuateAwayFromHome(b, bdx, bdz))
        const aGoal = attenuateAwayFromGoal(gs, a, adx, adz)
        adx = aGoal.dx; adz = aGoal.dz
        const bGoal = attenuateAwayFromGoal(gs, b, bdx, bdz)
        bdx = bGoal.dx; bdz = bGoal.dz

        a.x += adx; a.z += adz
        b.x += bdx; b.z += bdz
      }
    }
  }

  // the separation push may drop a unit inside a building footprint
  for (const e of units) resolveBlocked(gs, e)

  for (const e of units) {
    if (e.dead) continue
    e.attackCd = Math.max(0, e.attackCd - dt)
    e.workCd = Math.max(0, e.workCd - dt)

    if (e.targetId) {
      const t = getEntity(gs, e.targetId)
      if (!t || t.dead || t.team === e.team || t.kind === 'resource') e.targetId = undefined
    }

    // auto-acquire by stance; an explicit move order keeps the unit on its route
    if (!e.targetId) {
      const radius = acquireRadius(e)
      const holdMove = e.state === 'move' && e.path.length > 0
      if (radius > 0 && !holdMove && (e.state === 'idle' || e.state === 'move' || e.state === 'attack')) {
        const tgt = nearestVisibleEnemy(gs, e.team, e.x, e.z, radius)
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

/** Threat radius used by auto-acquisition, per stance. */
function acquireRadius(e: UnitEntity): number {
  const def = UNIT_DEFS[e.utype]
  switch (e.stance) {
    case 'aggressive': return def.sight
    case 'defensive': return def.range
    case 'standground': return def.range
    default: return 0 // noattack never acquires on its own
  }
}

/**
 * Consumes e.path waypoints with axis sliding: if the next step lands on a
 * blocked tile the unit tries X and then Z instead of stopping dead.
 * Returns true while waypoints remain; a unit left without a path goes idle
 * (or flips to the other end of its patrol). Move/attack orders with a home
 * slot converge to home after the route ends instead of idling off-slot.
 */
export function followPath(gs: GameState, e: UnitEntity, speed: number, dt: number): boolean {
  for (let guard = 0; guard < 8; guard++) {
    if (e.path.length === 0) {
      if (e.patrol && advancePatrol(gs, e) && e.path.length > 0) {
        // follow the new patrol leg
      } else if (e.home && !e.patrol && (e.state === 'move' || e.state === 'attack') &&
                 dist(e.x, e.z, e.home.x, e.home.z) > HOME_SETTLE) {
        const hd = dist(e.x, e.z, e.home.x, e.home.z)
        const stepLen = Math.min(speed * dt, hd)
        const nx = e.x + ((e.home.x - e.x) / hd) * stepLen
        const nz = e.z + ((e.home.z - e.z) / hd) * stepLen
        if (!isHardBlocked(gs, nx, nz)) { e.x = nx; e.z = nz }
        else if (!isHardBlocked(gs, nx, e.z)) e.x = nx
        else if (!isHardBlocked(gs, e.x, nz)) e.z = nz
        return true
      } else {
        e.state = 'idle'
        return false
      }
    }
    if (e.path.length === 0) continue
    const wp = e.path[0]
    const d = dist(e.x, e.z, wp.x, wp.z)
    if (d <= ARRIVE) { e.path.shift(); e.wpRef = undefined; continue }
    // a waypoint shared by a crowded group can be physically unreachable: the
    // separation push cancels every step. Give up on it after a while instead
    // of freezing the unit forever.
    if (e.wpRef !== wp) { e.wpRef = wp; e.wpBest = undefined; e.stuckT = 0 }
    if (d < (e.wpBest ?? Infinity) - 0.1) { e.wpBest = d; e.stuckT = 0 }
    else if ((e.stuckT = (e.stuckT ?? 0) + dt) > (e.path.length > 1 ? STUCK_SKIP : STUCK_ARRIVE)) {
      const isHomeSlot = e.path.length <= 1 && e.home != null && dist(wp.x, wp.z, e.home.x, e.home.z) < 1.5
      if (isHomeSlot && d < 3) {
        e.stuckT = 0
      } else {
        e.stuckT = 0; e.wpRef = undefined
        if (e.path.length > 1 || d < 3) {
          e.path.shift()
          if (e.path.length === 0) { e.state = 'idle'; return false }
          continue
        }
      }
    }
    const stepLen = Math.min(speed * dt, d)
    const nx = e.x + ((wp.x - e.x) / d) * stepLen
    const nz = e.z + ((wp.z - e.z) / d) * stepLen
    // a unit standing on a blocked tile (gatherers overlap the node they work)
    // must always be able to walk out, otherwise every candidate step is
    // rejected and it freezes there
    if (isBlocked(gs, e.x, e.z)) { e.x = nx; e.z = nz }
    else if (!isBlocked(gs, nx, nz)) { e.x = nx; e.z = nz }
    else if (!isBlocked(gs, nx, e.z)) e.x = nx
    else if (!isBlocked(gs, e.x, nz)) e.z = nz
    else return e.path.length > 0
    return e.path.length > 0
  }
  return e.path.length > 0
}

/** Flips a patrol order to its other endpoint and routes there. */
function advancePatrol(gs: GameState, e: UnitEntity): boolean {
  const p = e.patrol
  if (!p) return false
  const dest = p.toB ? p.a : p.b
  p.toB = !p.toB
  e.path = findPath(gs, e.x, e.z, dest.x, dest.z)
  return e.path.length > 0
}

/** Stop distance for approaching a target: outside building footprints. */
function approachRange(t: AnyEntity): number {
  if (t.kind === 'building') {
    const s = BUILDING_DEFS[t.btype].size
    return Math.max(s.x, s.z) / 2 + 1.0
  }
  return GATHER_RANGE
}

/**
 * Distance to a target's edge. Buildings block movement now, so an attacker
 * stands outside the footprint and melee range has to be measured from it,
 * not from the footprint centre.
 */
function rangeTo(x: number, z: number, t: AnyEntity): number {
  if (t.kind !== 'building') return dist(x, z, t.x, t.z)
  const s = BUILDING_DEFS[t.btype].size
  const dx = Math.max(0, Math.abs(x - t.x) - s.x / 2)
  const dz = Math.max(0, Math.abs(z - t.z) - s.z / 2)
  return Math.hypot(dx, dz)
}

/**
 * Walks toward a point: A* + followPath when it is far, a direct step
 * when it is close (so gathering/building approach stays frame-tight).
 * For building targets the stop distance is measured from the footprint
 * edge; a full step that overshoots the boundary used to get rejected
 * outright, leaving units pinned on the blocked cell strip forever.
 */
function moveTo(gs: GameState, e: UnitEntity, tx: number, tz: number, speed: number, dt: number, stopDist = 0, edgeOf?: AnyEntity): void {
  const homeTarget = e.home != null && Math.abs(tx - e.home.x) < 0.05 && Math.abs(tz - e.home.z) < 0.05
  const goalX = homeTarget ? e.home!.x : tx
  const goalZ = homeTarget ? e.home!.z : tz
  const d = edgeOf && edgeOf.kind === 'building' ? rangeTo(e.x, e.z, edgeOf) : dist(e.x, e.z, goalX, goalZ)
  if (d <= stopDist + RANGE_EPS) { e.path = []; return }
  if (d > stopDist + DIRECT_RANGE) {
    const last = e.path.length > 0 ? e.path[e.path.length - 1] : null
    if (!last || dist(last.x, last.z, goalX, goalZ) > TILE * 1.5) {
      e.path = findPath(gs, e.x, e.z, goalX, goalZ)
      e.repathT = 0
    }
    followPath(gs, e, speed, dt)
    return
  }
  e.path = []
  const sp = Math.min(speed, (d - stopDist) / Math.max(dt, 1e-6))
  const p = moveToward(e.x, e.z, goalX, goalZ, sp, dt)
  // A direct step into a building footprint must slide along it (and then route
  // around it) instead of being dropped: otherwise a unit approaching a corner
  // stays pinned outside the building forever, e.g. when delivering a load.
  if (!isHardBlocked(gs, p.x, p.z)) { e.x = p.x; e.z = p.z; return }
  if (!isHardBlocked(gs, p.x, e.z)) { e.x = p.x; return }
  if (!isHardBlocked(gs, e.x, p.z)) { e.z = p.z; return }
  const around = findPath(gs, e.x, e.z, goalX, goalZ)
  if (around.length > 0) { e.path = around; followPath(gs, e, speed, dt) }
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

function dominantResource(carrying: Partial<Record<string, number>>): 'suministros' | 'materiales' | 'combustible' | 'minerales' | undefined {
  let best: 'suministros' | 'materiales' | 'combustible' | 'minerales' | undefined
  let bestV = -Infinity
  for (const [k, v] of Object.entries(carrying)) {
    const n = v as number
    if (n > bestV) {
      bestV = n
      best = k as 'suministros' | 'materiales' | 'combustible' | 'minerales'
    }
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
  moveTo(gs, e, site.x, site.z, unitSpeed(gs, e), dt, approachRange(site))
  return true
}

/**
 * Walks the carried load to a dropoff and unloads on arrival. Returns true while
 * the trip is still going, false once the load has been handed over (or when no
 * dropoff exists, so the caller can retry next tick rather than keep the load).
 */
function deliverLoad(gs: GameState, e: UnitEntity, dt: number): boolean {
  const cached = e.dropoffTargetId ? getEntity(gs, e.dropoffTargetId) : undefined
  const drop = cached && !cached.dead && cached.kind === 'building'
    ? cached as BuildingEntity
    : findNearestDropoff(gs, e.team, e.x, e.z)
  if (!drop) { e.dropoffTargetId = undefined; e.state = 'idle'; return false }
  e.dropoffTargetId = drop.id
  e.state = 'return'
  // Buildings block whole nav cells past their footprint edge, so the
  // deposit range is measured from that edge, not from the centre.
  const d = rangeTo(e.x, e.z, drop)
  if (d > DROPOFF_EDGE_RANGE + RANGE_EPS) {
    moveTo(gs, e, drop.x, drop.z, unitSpeed(gs, e), dt, DROPOFF_EDGE_RANGE, drop)
    return true
  }
  e.path = []
  const amount = e.carryAmount
  const resource = dominantResource(e.carrying)
  for (const [k, v] of Object.entries(e.carrying)) (gs.players[e.team].resources as any)[k] += v as number
  emit(gs, { kind: 'deposit', team: e.team, dropoffId: drop.id, x: drop.x, z: drop.z, amount, resource })
  e.carrying = {}; e.carryAmount = 0; e.dropoffTargetId = undefined; e.state = 'gather'
  return false
}

function stepEngineer(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  const speed = unitSpeed(gs, e)
  const carryMax = def.carry ?? 10
  const node = e.gatherTargetId ? getEntity(gs, e.gatherTargetId) as ResourceEntity | undefined : undefined
  const nodeUsable = !!node && !node.dead && node.kind === 'resource' && node.amount > 0

  // A load is delivered when it is full or when the node ran out mid-load:
  // carrying a partial load must never leave the engineer idle for good, but an
  // explicit move order still gets to finish its route first.
  const moving = e.state === 'move' && e.path.length > 0
  if (!moving && e.carryAmount > 1e-6 && (e.carryAmount >= carryMax - 1e-6 || !nodeUsable)) {
    if (!nodeUsable) e.gatherTargetId = undefined
    const inTransit = deliverLoad(gs, e, dt)
    if (!inTransit) e.state = e.gatherTargetId != null || nodeUsable ? 'gather' : 'idle'
    return
  }

  if (nodeUsable) {
    e.state = 'gather'
    const d = dist(e.x, e.z, node!.x, node!.z)
    if (d > GATHER_RANGE + RANGE_EPS) {
      moveTo(gs, e, node!.x, node!.z, speed, dt, GATHER_RANGE)
    } else {
      e.path = []
      const gatherPerSec = (def.gatherRate ?? 8) * (1 + gs.players[e.team].bonuses.gatherPct)
      const take = Math.min(gatherPerSec * dt, node!.amount, carryMax - e.carryAmount)
      if (take > 0) {
        node!.amount -= take
        e.carrying[node!.resource] = (e.carrying[node!.resource] ?? 0) + take
        e.carryAmount += take
      }
      if (node!.amount <= 0) { node!.dead = true; e.gatherTargetId = undefined }
    }
    return
  }

  e.gatherTargetId = undefined
  if (e.targetId) { // can attack if forced
    stepCombatUnit(gs, e, dt); return
  }
  if (!followPath(gs, e, speed, dt)) e.state = 'idle'
}

function stepEnemyEngineer(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  const speed = unitSpeed(gs, e)
  const carryMax = def.carry ?? 10
  // simple: always gather nearest available of needed resource cycle
  if (e.carryAmount > 1e-6 && e.carryAmount >= carryMax - 1e-6) {
    deliverLoad(gs, e, dt)
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
      const target: ResourceEntity = node
      const d = dist(e.x, e.z, target.x, target.z)
      if (d > GATHER_RANGE + RANGE_EPS) {
        moveTo(gs, e, target.x, target.z, speed, dt, GATHER_RANGE)
      } else {
        e.path = []
        const take = Math.min((def.gatherRate ?? 8) * (1 + gs.players[e.team].bonuses.gatherPct) * dt, target.amount, carryMax - e.carryAmount)
        if (take > 0) { target.amount -= take; e.carrying[target.resource] = (e.carrying[target.resource] ?? 0) + take; e.carryAmount += take }
        if (target.amount <= 0) target.dead = true
      }
      return
    }
  }
  // nothing left to mine: hand over whatever is already loaded
  if (e.carryAmount > 1e-6) deliverLoad(gs, e, dt)
}

function stepCombatUnit(gs: GameState, e: UnitEntity, dt: number): void {
  const def = UNIT_DEFS[e.utype]
  const speed = unitSpeed(gs, e)
  const tgt = e.targetId ? getEntity(gs, e.targetId) : undefined

  if (tgt && !tgt.dead && tgt.team !== e.team && tgt.kind !== 'resource') {
    const d = rangeTo(e.x, e.z, tgt)
    e.state = 'attack'
    const hdHome = e.home ? dist(e.x, e.z, e.home.x, e.home.z) : 0
    const homeToTgt = e.home ? dist(e.home.x, e.home.z, tgt.x, tgt.z) : Infinity
    if (d <= def.range) {
      e.chaseT = 0; e.chaseD = undefined
      if (e.attackCd <= 0) {
        const atkProfile = UNIT_COMBAT[e.utype]?.attack ?? { base: def.damage, bonusVs: {} }
        applyHit(gs, e, atkProfile, tgt)
        e.attackCd = def.attackCooldown
        if (tgt.dead && e.targetId === tgt.id) e.targetId = undefined
      }
      // dress ranks while holding fire: stronger nudge toward formation slot without chasing away
      if (e.home && hdHome > 0.35 && hdHome < FORMATION_SPACING * 3.0) {
        const step = Math.min(speed * dt * 0.6, hdHome - 0.2)
        if (step > 0.001) {
          const nx = e.x + ((e.home.x - e.x) / hdHome) * step
          const nz = e.z + ((e.home.z - e.z) / hdHome) * step
          if (!isHardBlocked(gs, nx, nz)) { e.x = nx; e.z = nz }
          else if (!isHardBlocked(gs, nx, e.z)) e.x = nx
          else if (!isHardBlocked(gs, e.x, nz)) e.z = nz
        }
      }
      return
    }
    // out of range: only stances that allow movement give chase, but keep formation anchor
    if (e.stance === 'standground') return
    // Watchdog: if we are not closing the distance (blocked by our own crowd), give
    // up the target instead of bobbing in `attack` forever. The unit can then idle
    // or re-acquire something it can actually reach.
    const prevD = e.chaseD
    if (prevD != null && d < prevD - 0.02) e.chaseT = 0
    else e.chaseT = (e.chaseT ?? 0) + dt
    e.chaseD = d
    if ((e.chaseT ?? 0) > 3.5 && d < def.range + 2.5) {
      e.targetId = undefined; e.chaseT = 0; e.chaseD = undefined; e.path = []
      return
    }
    if (e.home) {
      const leash = e.stance === 'defensive' ? DEFENSIVE_LEASH : FORMATION_SPACING * 3.2
      if (hdHome > leash) {
        e.path = findPath(gs, e.x, e.z, e.home.x, e.home.z)
        followPath(gs, e, speed, dt)
        return
      }
      // formation/contact hold: keep slot/front when fighting near home unless target pulls far away
      if (hdHome < FORMATION_SPACING * 2.5 && d <= def.range + FORMATION_SPACING * 2.2 && homeToTgt <= def.range + FORMATION_SPACING * 3.0) {
        if (hdHome > 0.3) {
          const step = Math.min(speed * dt * 0.55, hdHome)
          if (step > 0.001) {
            const nx = e.x + ((e.home.x - e.x) / hdHome) * step
            const nz = e.z + ((e.home.z - e.z) / hdHome) * step
            if (!isHardBlocked(gs, nx, nz)) { e.x = nx; e.z = nz }
            else if (!isHardBlocked(gs, nx, e.z)) e.x = nx
            else if (!isHardBlocked(gs, e.x, nz)) e.z = nz
          }
        }
        return
      }
    }
    e.repathT = (e.repathT ?? 0) - dt
    const last = e.path.length > 0 ? e.path[e.path.length - 1] : null
    const stale = !last || e.repathT <= 0 ||
      Math.abs(last.x - tgt.x) > TILE || Math.abs(last.z - tgt.z) > TILE
    if (stale) {
      e.path = findPath(gs, e.x, e.z, tgt.x, tgt.z)
      e.repathT = CHASE_REPATH * (1 + (e.id % 3) * 0.15)
    }
    followPath(gs, e, speed, dt)
    return
  }

  e.targetId = undefined
  // no target: walk the queued route (move order, attack-move or patrol)
  if (!followPath(gs, e, speed, dt)) e.state = 'idle'
}

function cleanupDead(gs: GameState): void {
  for (const [id, e] of gs.entities) {
    if (!e.dead) continue
    if (e.kind !== 'resource') {
      emit(gs, { kind: 'death', entity: e.kind, team: e.team, unitType: e.kind === 'unit' ? e.utype : undefined, x: e.x, z: e.z })
    }
    // buildings and depleted nodes change the walkable grid
    if (e.kind !== 'unit') markNavDirty(gs)
    gs.entities.delete(id)
  }
}

function checkVictory(gs: GameState): void {
  const playerTC = buildingsOfTeam(gs, 'player').some(b => b.btype === 'ayuntamiento')
  const enemyTC = buildingsOfTeam(gs, 'enemy').some(b => b.btype === 'ayuntamiento')
  if (!enemyTC) gs.status = 'victory'
  else if (!playerTC) gs.status = 'defeat'
}
