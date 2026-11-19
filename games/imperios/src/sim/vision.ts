import { BUILDING_DEFS, TILE, UNIT_DEFS } from '../core/config'
import { buildingsOfTeam, unitsOfTeam, type GameState } from './state'
import type { AnyEntity, BuildingEntity, BuildingType, Team } from '../core/types'

/**
 * Fog of war, AoE2 style, on the same tile grid as the nav grid.
 *
 * One byte per tile and team:
 *
 *   VIS_UNKNOWN    never seen: the renderer paints it black
 *   VIS_EXPLORED   seen once, remembered: terrain stays known, enemies do not
 *   VIS_VISIBLE    inside a sight radius of a live unit/building right now
 *
 * VIS_VISIBLE is transient: every vision pass starts by degrading 2 -> 1, so a
 * tile that leaves every sight radius keeps its "explored" memory for free and
 * only VIS_UNKNOWN tiles ever need to be painted as terra incognita.
 */

export const VIS_UNKNOWN = 0
export const VIS_EXPLORED = 1
export const VIS_VISIBLE = 2

/** Vision is re-sealed 5 times per second; the sim tick is finer than the fog needs. */
export const VISION_HZ = 5
const VISION_STEP = 1 / VISION_HZ
/** Small epsilon so a 4-tick accumulation (4 * 1/20) reliably crosses 1/5. */
const EPS = 1e-9

export const TEAMS: Team[] = ['player', 'enemy']

/** Sight radius of a building: from the def, or the generic fallback. */
export function buildingSight(btype: BuildingType): number {
  return BUILDING_DEFS[btype]?.sight ?? 6
}

/** Tiles per side of the vision grid (matches navgrid / worldToCell). */
export function visionWidth(gs: GameState): number {
  return Math.max(1, Math.round(gs.mapSize / TILE))
}

export function createVisionGrid(gs: GameState): Uint8Array {
  const w = visionWidth(gs)
  return new Uint8Array(w * w)
}

/**
 * Accumulator driver: runs the vision pass at VISION_HZ regardless of the sim
 * tick rate. Pure function of (grid contents, entity list) so it stays
 * deterministic — no RNG is involved anywhere in this module.
 */
export function stepVision(gs: GameState, dt: number): void {
  gs.visionAcc += dt
  if (gs.visionAcc + EPS < VISION_STEP) return
  gs.visionAcc = Math.max(0, gs.visionAcc - VISION_STEP)
  updateVision(gs)
}

/** Recomputes the whole fog right now (dev hooks, scenario setup). */
export function forceVisionUpdate(gs: GameState): void {
  gs.visionAcc = 0
  updateVision(gs)
}

export function updateVision(gs: GameState): void {
  for (const team of TEAMS) {
    const grid = gs.vision[team]
    const w = visionWidth(gs)
    if (grid.length !== w * w) { gs.vision[team] = new Uint8Array(w * w) }
    const active = gs.vision[team]

    // QA / spectator reveal: the whole map stays visible, only memory updates
    if (gs.visionRevealed[team]) {
      active.fill(VIS_VISIBLE)
      rememberEnemyBuildings(gs, team)
      continue
    }

    // 1. degrade: what was visible last pass is only remembered now (2 -> 1).
    for (let i = 0; i < active.length; i++) if (active[i] === VIS_VISIBLE) active[i] = VIS_EXPLORED

    // 2. re-seal every sight circle this team owns.
    for (const u of unitsOfTeam(gs, team)) stampCircle(gs, team, u.x, u.z, UNIT_DEFS[u.utype].sight)
    for (const b of buildingsOfTeam(gs, team)) {
      if (!b.built) continue // a construction site does not scout
      stampCircle(gs, team, b.x, b.z, buildingSight(b.btype))
    }

    // 3. keep the memory of enemy buildings this team has actually looked at.
    rememberEnemyBuildings(gs, team)
  }
}

/** Marks every tile whose centre is inside the circle as VIS_VISIBLE. */
function stampCircle(gs: GameState, team: Team, x: number, z: number, radius: number): void {
  if (!(radius > 0)) return
  const grid = gs.vision[team]
  const w = visionWidth(gs)
  const half = gs.mapSize / 2
  const r2 = radius * radius
  const cx0 = Math.max(0, Math.floor((x - radius + half) / TILE))
  const cx1 = Math.min(w - 1, Math.floor((x + radius + half) / TILE))
  const cz0 = Math.max(0, Math.floor((z - radius + half) / TILE))
  const cz1 = Math.min(w - 1, Math.floor((z + radius + half) / TILE))
  for (let cz = cz0; cz <= cz1; cz++) {
    const dz = (-half + (cz + 0.5) * TILE) - z
    const row = cz * w
    for (let cx = cx0; cx <= cx1; cx++) {
      const dx = (-half + (cx + 0.5) * TILE) - x
      if (dx * dx + dz * dz <= r2) grid[row + cx] = VIS_VISIBLE
    }
  }
}

/** Enemy buildings currently inside a sight circle are remembered by id. */
function rememberEnemyBuildings(gs: GameState, team: Team): void {
  const known = gs.knownBuildings[team]
  for (const e of gs.entities.values()) {
    if (e.dead || e.kind !== 'building' || e.team === team) continue
    if (isVisible(gs, team, e.x, e.z)) known.add(e.id)
  }
  for (const id of [...known]) {
    const e = gs.entities.get(id)
    if (!e || e.dead) known.delete(id)
  }
}

function cellIndex(gs: GameState, x: number, z: number): number {
  const w = visionWidth(gs)
  const half = gs.mapSize / 2
  const cx = Math.floor((x + half) / TILE)
  const cz = Math.floor((z + half) / TILE)
  if (cx < 0 || cz < 0 || cx >= w || cz >= w) return -1
  return cz * w + cx
}

/** Tile state at a world position (VIS_UNKNOWN outside the map). */
export function visionAt(gs: GameState, team: Team, x: number, z: number): number {
  const i = cellIndex(gs, x, z)
  return i < 0 ? VIS_UNKNOWN : gs.vision[team][i]
}

/** Tile state by cell (used by the minimap, which walks cells, not world units). */
export function visionAtCell(gs: GameState, team: Team, cx: number, cz: number): number {
  const w = visionWidth(gs)
  if (cx < 0 || cz < 0 || cx >= w || cz >= w) return VIS_UNKNOWN
  return gs.vision[team][cz * w + cx]
}

export function isVisible(gs: GameState, team: Team, x: number, z: number): boolean {
  return visionAt(gs, team, x, z) === VIS_VISIBLE
}

export function isExplored(gs: GameState, team: Team, x: number, z: number): boolean {
  return visionAt(gs, team, x, z) >= VIS_EXPLORED
}

/**
 * Drop-in replacement for nearestEnemy() that respects the fog: only entities
 * standing on a currently visible tile of `team` can be acquired. Falls back to
 * null (units hold fire instead of shooting at ghosts).
 */
export function nearestVisibleEnemy(gs: GameState, team: Team, x: number, z: number, range: number): AnyEntity | null {
  let best: AnyEntity | null = null
  let bestD = range
  for (const e of gs.entities.values()) {
    if (e.dead || e.team === team || e.kind === 'resource') continue
    // Measured to the FOOTPRINT EDGE, like the attack range: a big building's centre
    // is several units away from an adjacent attacker, so centre-based acquisition
    // made a defensive unit standing against a building never acquire it at all.
    const d = rangeToEntity(x, z, e)
    if (d >= bestD) continue
    if (!isVisible(gs, team, e.x, e.z)) continue
    bestD = d
    best = e
  }
  return best
}

/**
 * Distance from a point to an entity's reachable footprint: buildings are big, so
 * everything that compares against an attack range has to measure to the edge.
 */
export function rangeToEntity(x: number, z: number, e: AnyEntity): number {
  if (e.kind !== 'building') return Math.hypot(e.x - x, e.z - z)
  const s = BUILDING_DEFS[e.btype].size
  const dx = Math.max(0, Math.abs(x - e.x) - s.x / 2)
  const dz = Math.max(0, Math.abs(z - e.z) - s.z / 2)
  return Math.hypot(dx, dz)
}

/** Enemy buildings of `ofTeam` this team can see right now. */
export function visibleBuildingsOfTeam(gs: GameState, team: Team, ofTeam: Team): BuildingEntity[] {
  const out: BuildingEntity[] = []
  for (const b of buildingsOfTeam(gs, ofTeam)) {
    if (isVisible(gs, team, b.x, b.z)) out.push(b)
  }
  return out
}

/**
 * Enemy buildings this team knows about: visible now, or remembered from an
 * earlier sighting (knownBuildings). A destroyed building drops out of the set,
 * so a razed base stops being a target.
 */
export function knownBuildingTargets(gs: GameState, team: Team, ofTeam: Team): BuildingEntity[] {
  const known = gs.knownBuildings[team]
  const out: BuildingEntity[] = []
  for (const b of buildingsOfTeam(gs, ofTeam)) {
    if (known.has(b.id) || isVisible(gs, team, b.x, b.z)) out.push(b)
  }
  return out
}

/** True if the building is a remembered-but-not-currently-seen target. */
export function isGhost(gs: GameState, team: Team, b: BuildingEntity): boolean {
  return gs.knownBuildings[team].has(b.id) && !isVisible(gs, team, b.x, b.z)
}

/** Dev/QA helper: the whole map stays revealed for that team from now on. */
export function revealAll(gs: GameState, team: Team): void {
  gs.visionRevealed[team] = true
  gs.vision[team].fill(VIS_VISIBLE)
  rememberEnemyBuildings(gs, team)
  for (const e of gs.entities.values()) {
    if (e.dead || e.kind !== 'building' || e.team === team) continue
    gs.knownBuildings[team].add(e.id)
  }
}

/** Undoes revealAll(): the fog closes again on the next vision pass. */
export function hideAll(gs: GameState, team: Team): void {
  gs.visionRevealed[team] = false
  forceVisionUpdate(gs)
}

/** Dev/QA helper: wipes a team's vision back to unexplored, re-stamped on the next pass. */
export function clearVision(gs: GameState, team: Team): void {
  gs.visionRevealed[team] = false
  gs.vision[team].fill(VIS_UNKNOWN)
  gs.knownBuildings[team].clear()
  forceVisionUpdate(gs)
}
