import { BUILDING_DEFS, ERAS, GRID, MAP_SIZE, START_RESOURCES, TECHS, UNIT_DEFS } from '../core/config'
import { createRng } from '../core/rng'
import { canAfford, dist, spend } from '../core/utils'
import { markNavDirty } from './navgrid'
import { findPath } from './path'
import type { Rng } from '../core/rng'
import type { AnyEntity, BuildingEntity, BuildingType, PlayerBonuses, ResourceEntity, Resources, Stance, Team, UnitEntity, UnitType, Vec2 } from '../core/types'
import type { SimEvent } from './events'

export type Formation = 'line' | 'box' | 'wedge'

/** World-space gap between two units in a formation slot. */
export const FORMATION_SPACING = 2.05

export interface PlayerState {
  team: Team
  resources: Resources
  era: number
  pop: number
  popCap: number
  advancing: { to: number; remaining: number; total: number } | null
  bonuses: PlayerBonuses
  research: { id: string; remaining: number; total: number } | null
  researched: string[]
  aiTimer: number
}

const NO_BONUSES: PlayerBonuses = { attackPct: 0, hpPct: 0, speedPct: 0, gatherPct: 0, armorFlat: 0 }

export interface GameState {
  entities: Map<number, AnyEntity>
  players: Record<Team, PlayerState>
  time: number
  status: 'menu' | 'playing' | 'victory' | 'defeat'
  selectedIds: number[]
  placing: BuildingType | null
  toast: { msg: string; t: number } | null
  mapSize: number
  seed: number
  rng: Rng
  uidCounter: number
  events: SimEvent[]
  viewAs: 'player' | 'enemy' | 'all'
  acc: number
  /** Static walkability grid, rebuilt lazily when navDirty is set. */
  nav: Uint8Array
  navDirty: boolean
  /**
   * Fog of war, one byte per tile and team (VIS_UNKNOWN / VIS_EXPLORED /
   * VIS_VISIBLE, see sim/vision.ts). The grid is indexed `cz * GRID + cx`.
   */
  vision: Record<Team, Uint8Array>
  /** Accumulator for the 5 Hz vision pass. */
  visionAcc: number
  /** Ids of enemy buildings each team has seen at least once. */
  knownBuildings: Record<Team, Set<number>>
  /** QA/spectator switch: the team sees the whole map, fog never closes again. */
  visionRevealed: Record<Team, boolean>
}

export function createState(seed = 1): GameState {
  return {
    entities: new Map(),
    players: {
      player: { team: 'player', resources: { ...START_RESOURCES }, era: 1, pop: 0, popCap: 0, advancing: null, bonuses: { ...NO_BONUSES }, research: null, researched: [], aiTimer: 0 },
      enemy: { team: 'enemy', resources: { suministros: 300, materiales: 300, combustible: 120, minerales: 120 }, era: 1, pop: 0, popCap: 0, advancing: null, bonuses: { ...NO_BONUSES }, research: null, researched: [], aiTimer: 0 },
    },
    time: 0,
    status: 'menu',
    selectedIds: [],
    placing: null,
    toast: null,
    mapSize: MAP_SIZE,
    seed,
    rng: createRng(seed),
    uidCounter: 1,
    events: [],
    viewAs: 'player',
    acc: 0,
    nav: new Uint8Array(0),
    navDirty: true,
    vision: {
      player: new Uint8Array(GRID * GRID),
      enemy: new Uint8Array(GRID * GRID),
    },
    visionAcc: 0,
    knownBuildings: { player: new Set<number>(), enemy: new Set<number>() },
    visionRevealed: { player: false, enemy: false },
  }
}

export function uid(gs: GameState): number {
  return gs.uidCounter++
}

export function addEntity<T extends AnyEntity>(gs: GameState, e: T): T {
  gs.entities.set(e.id, e)
  return e
}

export function getEntity(gs: GameState, id: number): AnyEntity | undefined {
  return gs.entities.get(id)
}

export function entitiesOfTeam(gs: GameState, team: Team): AnyEntity[] {
  const out: AnyEntity[] = []
  for (const e of gs.entities.values()) if (!e.dead && e.team === team) out.push(e)
  return out
}

export function unitsOfTeam(gs: GameState, team: Team): UnitEntity[] {
  return entitiesOfTeam(gs, team).filter((e): e is UnitEntity => e.kind === 'unit')
}
export function buildingsOfTeam(gs: GameState, team: Team): BuildingEntity[] {
  return entitiesOfTeam(gs, team).filter((e): e is BuildingEntity => e.kind === 'building')
}

export function findNearestDropoff(gs: GameState, team: Team, x: number, z: number): BuildingEntity | null {
  let best: BuildingEntity | null = null
  let bestD = Infinity
  for (const b of buildingsOfTeam(gs, team)) {
    const def = BUILDING_DEFS[b.btype]
    if (!def.dropoff || !b.built) continue
    const d = dist(x, z, b.x, b.z)
    if (d < bestD) { bestD = d; best = b }
  }
  return best
}

export function findNearestResource(gs: GameState, resourceKey: string, x: number, z: number): ResourceEntity | null {
  let best: ResourceEntity | null = null
  let bestD = Infinity
  for (const e of gs.entities.values()) {
    if (e.dead || e.kind !== 'resource') continue
    if (e.resource !== resourceKey || e.amount <= 0) continue
    const d = dist(x, z, e.x, e.z)
    if (d < bestD) { bestD = d; best = e }
  }
  return best
}

export function recomputePop(gs: GameState): void {
  for (const team of ['player', 'enemy'] as Team[]) {
    let pop = 0, cap = 0, queued = 0
    for (const e of entitiesOfTeam(gs, team)) {
      if (e.kind === 'unit') pop += 1
      if (e.kind === 'building') {
        if (e.built) cap += BUILDING_DEFS[e.btype].popProvided ?? 0
        queued += e.queue.length
      }
    }
    gs.players[team].pop = pop + queued
    gs.players[team].popCap = cap
  }
}

export function spawnUnit(gs: GameState, team: Team, type: UnitType, x: number, z: number): UnitEntity {
  const def = UNIT_DEFS[type]
  const hp = Math.round(def.hp * (1 + gs.players[team].bonuses.hpPct))
  const u: UnitEntity = {
    id: uid(gs), kind: 'unit', team, x, z,
    hp, maxHp: hp, selected: false, dead: false,
    utype: type, path: [], carrying: {}, carryAmount: 0,
    attackCd: 0, workCd: 0, state: 'idle', stance: 'aggressive',
  }
  addEntity(gs, u)
  recomputePop(gs)
  return u
}

export function spawnBuilding(gs: GameState, team: Team, type: BuildingType, x: number, z: number, built = false): BuildingEntity {
  const def = BUILDING_DEFS[type]
  const b: BuildingEntity = {
    id: uid(gs), kind: 'building', team, x, z,
    hp: built ? def.hp : Math.max(1, def.hp * 0.1), maxHp: def.hp, selected: false, dead: false,
    btype: type, built, buildProgress: built ? 1 : 0, attackCd: 0, queue: [],
  }
  addEntity(gs, b)
  markNavDirty(gs)
  recomputePop(gs)
  return b
}

export function spawnResource(gs: GameState, rtype: ResourceEntity['rtype'], resource: ResourceEntity['resource'], x: number, z: number, amount: number): ResourceEntity {
  const r: ResourceEntity = {
    id: uid(gs), kind: 'resource', team: 'enemy', x, z, // neutral-ish
    hp: 1, maxHp: 1, selected: false, dead: false,
    rtype, resource, amount, maxAmount: amount,
  }
  addEntity(gs, r)
  markNavDirty(gs)
  return r
}

export function canTrain(gs: GameState, team: Team, type: UnitType): { ok: boolean; reason?: string } {
  const def = UNIT_DEFS[type]
  const p = gs.players[team]
  if (def.era > p.era) return { ok: false, reason: 'Requiere era superior' }
  if (p.pop >= p.popCap) return { ok: false, reason: 'Sin población' }
  if (!canAfford(p.resources, def.cost)) return { ok: false, reason: 'Recursos insuficientes' }
  return { ok: true }
}

export function queueTrain(gs: GameState, team: Team, buildingId: number, type: UnitType): boolean {
  const b = getEntity(gs, buildingId)
  if (!b || b.kind !== 'building' || b.team !== team || !b.built) return false
  const defB = BUILDING_DEFS[b.btype]
  if (!defB.produces?.includes(type)) return false
  const check = canTrain(gs, team, type)
  if (!check.ok) return false
  const def = UNIT_DEFS[type]
  spend(gs.players[team].resources, def.cost)
  b.queue.push({ type, remaining: def.trainTime, total: def.trainTime })
  recomputePop(gs)
  return true
}

function placementBlocker(gs: GameState, type: BuildingType, x: number, z: number): 'bounds' | 'occupied' | null {
  const def = BUILDING_DEFS[type]
  const half = gs.mapSize / 2 - 6
  if (Math.abs(x) > half || Math.abs(z) > half) return 'bounds'
  for (const e of gs.entities.values()) {
    if (e.dead || e.kind !== 'building') continue
    const d = BUILDING_DEFS[e.btype]
    if (Math.abs(e.x - x) < (d.size.x + def.size.x) / 2 + 1 && Math.abs(e.z - z) < (d.size.z + def.size.z) / 2 + 1) return 'occupied'
  }
  return null
}

export function canPlaceBuilding(gs: GameState, type: BuildingType, x: number, z: number): boolean {
  return placementBlocker(gs, type, x, z) === null
}

export function tryPlaceBuilding(gs: GameState, type: BuildingType, x: number, z: number): boolean {
  const def = BUILDING_DEFS[type]
  const p = gs.players.player
  if (!canAfford(p.resources, def.cost)) { gs.toast = { msg: 'Recursos insuficientes', t: 2 }; return false }
  const blocker = placementBlocker(gs, type, x, z)
  if (blocker === 'bounds') { gs.toast = { msg: 'Fuera del mapa', t: 2 }; return false }
  if (blocker === 'occupied') { gs.toast = { msg: 'Espacio ocupado', t: 2 }; return false }
  spend(p.resources, def.cost)
  spawnBuilding(gs, 'player', type, x, z, false)
  gs.toast = { msg: `${def.name} en construcción`, t: 2 }
  return true
}

export function tryAdvanceEra(gs: GameState): boolean {
  const p = gs.players.player
  if (p.advancing) { gs.toast = { msg: 'Ya estás avanzando de era', t: 2 }; return false }
  const next = ERAS[p.era]
  if (!next) { gs.toast = { msg: 'Era máxima alcanzada', t: 2 }; return false }
  if (!canAfford(p.resources, next.advanceCost)) { gs.toast = { msg: 'Recursos insuficientes para avanzar', t: 2 }; return false }
  spend(p.resources, next.advanceCost)
  p.advancing = { to: next.id, remaining: next.advanceTime, total: next.advanceTime }
  gs.toast = { msg: `Avanzando a ${next.name}...`, t: 3 }
  return true
}

export function canResearch(gs: GameState, team: Team, techId: string): { ok: boolean; reason?: string } {
  const t = TECHS.find(tt => tt.id === techId)
  if (!t) return { ok: false, reason: 'Tecnología desconocida' }
  const p = gs.players[team]
  if (t.era > p.era) return { ok: false, reason: 'Requiere era superior' }
  if (p.researched.includes(t.id)) return { ok: false, reason: 'Ya investigada' }
  if (p.research) return { ok: false, reason: 'Investigación en curso' }
  if (!canAfford(p.resources, t.cost)) return { ok: false, reason: 'Recursos insuficientes' }
  return { ok: true }
}

export function queueResearch(gs: GameState, team: Team, techId: string): boolean {
  if (!canResearch(gs, team, techId).ok) return false
  const t = TECHS.find(tt => tt.id === techId)!
  spend(gs.players[team].resources, t.cost)
  gs.players[team].research = { id: t.id, remaining: t.time, total: t.time }
  return true
}

export function applyTech(p: PlayerState, techId: string): void {
  const t = TECHS.find(tt => tt.id === techId)
  if (!t) return
  p.bonuses.attackPct += t.effects.attackPct ?? 0
  p.bonuses.hpPct += t.effects.hpPct ?? 0
  p.bonuses.speedPct += t.effects.speedPct ?? 0
  p.bonuses.gatherPct += t.effects.gatherPct ?? 0
  p.bonuses.armorFlat += t.effects.armorFlat ?? 0
  p.researched.push(techId)
}

export function setSelection(gs: GameState, ids: number[]): void {
  for (const id of gs.selectedIds) { const e = getEntity(gs, id); if (e) e.selected = false }
  gs.selectedIds = ids
  for (const id of ids) { const e = getEntity(gs, id); if (e) e.selected = true }
}

/** Player units among `ids`, in selection order. */
function playerUnits(gs: GameState, ids: number[]): UnitEntity[] {
  const out: UnitEntity[] = []
  for (const id of ids) {
    const e = getEntity(gs, id)
    if (e && e.kind === 'unit' && e.team === 'player') out.push(e)
  }
  return out
}

/**
 * Slot layout around `target`, facing the direction the group is coming from.
 * `from` is the group centroid so the frontage axis is perpendicular to travel.
 */
export function formationSlots(count: number, formation: Formation, from: Vec2, target: Vec2): Vec2[] {
  let dx = target.x - from.x
  let dz = target.z - from.z
  const len = Math.hypot(dx, dz)
  if (len < 0.001) { dx = 1; dz = 0 } else { dx /= len; dz /= len }
  const px = -dz, pz = dx // frontage axis
  const slots: Vec2[] = []

  if (formation === 'line') {
    const span = (count - 1) * FORMATION_SPACING
    for (let i = 0; i < count; i++) {
      const off = i * FORMATION_SPACING - span / 2
      slots.push({ x: target.x + px * off, z: target.z + pz * off })
    }
  } else if (formation === 'box') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
    const rows = Math.ceil(count / cols)
    for (let i = 0; i < count; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const along = (col - (cols - 1) / 2) * FORMATION_SPACING
      const depth = (row - (rows - 1) / 2) * FORMATION_SPACING
      slots.push({ x: target.x + px * along + dx * depth, z: target.z + pz * along + dz * depth })
    }
  } else {
    // wedge: the first unit holds the tip, the rest fan out in pairs behind it
    slots.push({ x: target.x, z: target.z })
    for (let i = 1; i < count; i++) {
      const side = i % 2 === 1 ? 1 : -1
      const rank = Math.ceil(i / 2)
      const along = side * rank * FORMATION_SPACING * 0.85
      const depth = -rank * FORMATION_SPACING
      slots.push({ x: target.x + px * along + dx * depth, z: target.z + pz * along + dz * depth })
    }
  }
  return slots
}

/**
 * Groups move as a formation: every unit gets its own slot and its own A* route
 * so the whole squad does not stack on a single waypoint. Units are paired with
 * slots by their frontage projection, which keeps them from crossing over.
 */
export function commandMoveFormation(
  gs: GameState,
  ids: number[],
  target: Vec2,
  formation: Formation = 'box',
  attackMove = false,
): void {
  const units = playerUnits(gs, ids)
  if (units.length === 0) return
  if (units.length === 1) { commandMove(gs, [units[0].id], target, attackMove); return }

  let cx = 0, cz = 0
  for (const u of units) { cx += u.x; cz += u.z }
  cx /= units.length; cz /= units.length

  let dx = target.x - cx, dz = target.z - cz
  const len = Math.hypot(dx, dz) || 1
  dx /= len; dz /= len
  const frontage = (x: number, z: number): number => x * -dz + z * dx
  const order = units.map((u, i) => ({ i, p: frontage(u.x, u.z) })).sort((a, b) => a.p - b.p)
  const slots = formationSlots(units.length, formation, { x: cx, z: cz }, target)

  for (let s = 0; s < order.length && s < slots.length; s++) {
    const u = units[order[s].i]
    const slot = slots[s]
    u.path = findPath(gs, u.x, u.z, slot.x, slot.z)
    u.state = attackMove ? 'attack' : 'move'
    u.targetId = undefined
    u.gatherTargetId = undefined
    u.dropoffTargetId = undefined
    u.patrol = undefined
    u.home = { x: slot.x, z: slot.z }
    u.repathT = 0
  }
}

/**
 * Movement order. Multi-unit groups default to a box formation; `append` pushes
 * the new leg onto the existing queue (shift-click) instead of replacing it.
 */
export function commandMove(gs: GameState, ids: number[], target: Vec2, attackMove = false, append = false): void {
  const units = playerUnits(gs, ids)
  if (units.length === 0) return
  if (!append && units.length > 1) {
    commandMoveFormation(gs, units.map(u => u.id), target, 'box', attackMove)
    return
  }
  for (const e of units) {
    const leg = findPath(gs, e.x, e.z, target.x, target.z)
    if (append && e.path.length > 0) {
      e.path = e.path.concat(leg)
    } else {
      e.path = leg
      e.home = { x: target.x, z: target.z }
      e.patrol = undefined
    }
    e.state = attackMove ? 'attack' : 'move'
    e.targetId = undefined
    e.gatherTargetId = undefined
    e.dropoffTargetId = undefined
    e.repathT = 0
  }
}

export function commandGather(gs: GameState, ids: number[], nodeId: number): void {
  const node = getEntity(gs, nodeId)
  if (!node || node.kind !== 'resource') return
  for (const e of playerUnits(gs, ids)) {
    if (e.utype !== 'ingeniero') continue
    e.gatherTargetId = nodeId
    e.targetId = undefined
    e.dropoffTargetId = undefined
    e.patrol = undefined
    e.state = 'gather'
    e.path = findPath(gs, e.x, e.z, node.x, node.z)
    e.home = { x: node.x, z: node.z }
    e.repathT = 0
  }
}

export function commandAttack(gs: GameState, ids: number[], targetId: number): void {
  const tgt = getEntity(gs, targetId)
  for (const e of playerUnits(gs, ids)) {
    e.targetId = targetId
    e.state = 'attack'
    e.patrol = undefined
    // the defensive leash measures from wherever the order was issued
    e.home = { x: e.x, z: e.z }
    if (tgt) e.path = findPath(gs, e.x, e.z, tgt.x, tgt.z)
    e.repathT = 0
  }
}

/** Patrol between two points: the unit walks A->B, then B->A, forever. */
export function commandPatrol(gs: GameState, ids: number[], a: Vec2, b: Vec2): void {
  for (const e of playerUnits(gs, ids)) {
    e.patrol = { a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, toB: true }
    e.path = findPath(gs, e.x, e.z, b.x, b.z)
    e.state = 'move'
    e.targetId = undefined
    e.gatherTargetId = undefined
    e.dropoffTargetId = undefined
    e.home = { x: a.x, z: a.z }
    e.repathT = 0
  }
}

export function commandStance(gs: GameState, ids: number[], stance: Stance): void {
  for (const e of playerUnits(gs, ids)) {
    e.stance = stance
    if (stance === 'defensive') e.home = { x: e.x, z: e.z }
  }
}

/**
 * Omnipotent proximity query. Gameplay code must use nearestVisibleEnemy()
 * (sim/vision.ts) instead: this one ignores the fog and is kept only for
 * diagnostics and headless assertions.
 */
export function nearestEnemy(gs: GameState, team: Team, x: number, z: number, range: number): AnyEntity | null {
  let best: AnyEntity | null = null
  let bestD = range * range
  for (const e of gs.entities.values()) {
    if (e.dead || e.team === team || e.kind === 'resource') continue
    const d = (e.x - x) ** 2 + (e.z - z) ** 2
    if (d < bestD) { bestD = d; best = e }
  }
  return best
}
