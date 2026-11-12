import { BUILDING_DEFS, ERAS, MAP_SIZE, START_RESOURCES, UNIT_DEFS } from '../core/config'
import { canAfford, dist, spend, uid } from '../core/utils'
import type { AnyEntity, BuildingEntity, BuildingType, ResourceEntity, Resources, Team, UnitEntity, UnitType, Vec2 } from '../core/types'

export interface PlayerState {
  team: Team
  resources: Resources
  era: number
  pop: number
  popCap: number
  advancing: { to: number; remaining: number; total: number } | null
}

export interface GameState {
  entities: Map<number, AnyEntity>
  players: Record<Team, PlayerState>
  time: number
  status: 'menu' | 'playing' | 'victory' | 'defeat'
  selectedIds: number[]
  placing: BuildingType | null
  toast: { msg: string; t: number } | null
  mapSize: number
}

export function createState(): GameState {
  return {
    entities: new Map(),
    players: {
      player: { team: 'player', resources: { ...START_RESOURCES }, era: 1, pop: 0, popCap: 0, advancing: null },
      enemy: { team: 'enemy', resources: { suministros: 300, materiales: 300, combustible: 120, minerales: 120 }, era: 1, pop: 0, popCap: 0, advancing: null },
    },
    time: 0,
    status: 'menu',
    selectedIds: [],
    placing: null,
    toast: null,
    mapSize: MAP_SIZE,
  }
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
  const u: UnitEntity = {
    id: uid(), kind: 'unit', team, x, z,
    hp: def.hp, maxHp: def.hp, selected: false, dead: false,
    utype: type, path: [], carrying: {}, carryAmount: 0,
    attackCd: 0, workCd: 0, state: 'idle',
  }
  addEntity(gs, u)
  recomputePop(gs)
  return u
}

export function spawnBuilding(gs: GameState, team: Team, type: BuildingType, x: number, z: number, built = false): BuildingEntity {
  const def = BUILDING_DEFS[type]
  const b: BuildingEntity = {
    id: uid(), kind: 'building', team, x, z,
    hp: built ? def.hp : Math.max(1, def.hp * 0.1), maxHp: def.hp, selected: false, dead: false,
    btype: type, built, buildProgress: built ? 1 : 0, queue: [],
  }
  addEntity(gs, b)
  recomputePop(gs)
  return b
}

export function spawnResource(gs: GameState, rtype: ResourceEntity['rtype'], resource: ResourceEntity['resource'], x: number, z: number, amount: number): ResourceEntity {
  const r: ResourceEntity = {
    id: uid(), kind: 'resource', team: 'enemy', x, z, // neutral-ish
    hp: 1, maxHp: 1, selected: false, dead: false,
    rtype, resource, amount, maxAmount: amount,
  }
  addEntity(gs, r)
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

export function tryPlaceBuilding(gs: GameState, type: BuildingType, x: number, z: number): boolean {
  const def = BUILDING_DEFS[type]
  const p = gs.players.player
  if (!canAfford(p.resources, def.cost)) { gs.toast = { msg: 'Recursos insuficientes', t: 2 }; return false }
  // simple bounds/collision
  if (Math.abs(x) > MAP_SIZE / 2 - 6 || Math.abs(z) > MAP_SIZE / 2 - 6) { gs.toast = { msg: 'Fuera del mapa', t: 2 }; return false }
  for (const e of gs.entities.values()) {
    if (e.dead) continue
    if (e.kind === 'building') {
      const d = BUILDING_DEFS[e.btype]
      if (Math.abs(e.x - x) < (d.size.x + def.size.x) / 2 + 1 && Math.abs(e.z - z) < (d.size.z + def.size.z) / 2 + 1) {
        gs.toast = { msg: 'Espacio ocupado', t: 2 }; return false
      }
    }
  }
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

export function setSelection(gs: GameState, ids: number[]): void {
  for (const id of gs.selectedIds) { const e = getEntity(gs, id); if (e) e.selected = false }
  gs.selectedIds = ids
  for (const id of ids) { const e = getEntity(gs, id); if (e) e.selected = true }
}

export function commandMove(gs: GameState, ids: number[], target: Vec2, attackMove = false): void {
  for (const id of ids) {
    const e = getEntity(gs, id)
    if (!e || e.kind !== 'unit' || e.team !== 'player') continue
    e.path = [{ x: target.x, z: target.z }]
    e.state = attackMove ? 'attack' : 'move'
    e.targetId = undefined
    e.gatherTargetId = undefined
  }
}

export function commandGather(gs: GameState, ids: number[], nodeId: number): void {
  for (const id of ids) {
    const e = getEntity(gs, id)
    if (!e || e.kind !== 'unit' || e.team !== 'player' || e.utype !== 'ingeniero') continue
    e.gatherTargetId = nodeId
    e.targetId = undefined
    e.state = 'gather'
  }
}

export function commandAttack(gs: GameState, ids: number[], targetId: number): void {
  for (const id of ids) {
    const e = getEntity(gs, id)
    if (!e || e.kind !== 'unit' || e.team !== 'player') continue
    e.targetId = targetId
    e.state = 'attack'
  }
}

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
