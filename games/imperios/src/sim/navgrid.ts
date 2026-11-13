import { BUILDING_DEFS, GRID, TILE } from '../core/config'
import type { UnitEntity, Vec2 } from '../core/types'
import type { GameState } from './state'

/**
 * Static navigation grid derived from the entity list.
 *
 * Cells are world tiles of TILE units. A cell stores one of three flags so the
 * pathfinder blocks everything while units are only pushed out of *hard*
 * blockers: gatherers legitimately stand on the resource tile they are working.
 *
 *   NAV_FREE      walkable
 *   NAV_RESOURCE  resource node footprint (routed around, not a wall)
 *   NAV_BUILDING  building footprint (hard blocker)
 */
export const NAV_W = GRID

export const NAV_FREE = 0
export const NAV_RESOURCE = 1
export const NAV_BUILDING = 2

/** A forest blocks a 3x3 tile square, mines and oil wells a single tile. */
const BOSQUE_TILES = 3

export function navWidth(gs: GameState): number {
  return Math.max(1, Math.round(gs.mapSize / TILE))
}

/** Marks the grid dirty; the next ensureNav() rebuilds it from the entities. */
export function markNavDirty(gs: GameState): void {
  gs.navDirty = true
}

export function rebuildNav(gs: GameState): void {
  const w = navWidth(gs)
  const size = w * w
  if (gs.nav.length !== size) gs.nav = new Uint8Array(size)
  else gs.nav.fill(NAV_FREE)

  for (const e of gs.entities.values()) {
    if (e.dead) continue
    if (e.kind === 'building') {
      const size2 = BUILDING_DEFS[e.btype].size
      fillFootprint(gs, e.x, e.z, size2.x, size2.z, NAV_BUILDING)
    } else if (e.kind === 'resource') {
      if (e.amount <= 0) continue // depleted nodes stop blocking
      const c = worldToCell(gs, e.x, e.z)
      if (e.rtype === 'bosque') {
        const r = (BOSQUE_TILES - 1) / 2
        fillCells(gs, c.cx - r, c.cx + r, c.cz - r, c.cz + r, NAV_RESOURCE)
      } else if (e.rtype === 'mina' || e.rtype === 'petroleo') {
        fillCells(gs, c.cx, c.cx, c.cz, c.cz, NAV_RESOURCE)
      }
      // 'granja' is farmland: it never blocks
    }
  }
  gs.navDirty = false
}

export function ensureNav(gs: GameState): void {
  const w = navWidth(gs)
  if (gs.navDirty || gs.nav.length !== w * w) rebuildNav(gs)
}

/** World -> cell. Not clamped: callers use blockedAtCell() for bounds. */
export function worldToCell(gs: GameState, x: number, z: number): { cx: number; cz: number } {
  const half = gs.mapSize / 2
  return { cx: Math.floor((x + half) / TILE), cz: Math.floor((z + half) / TILE) }
}

/** Center of a cell in world space. */
export function cellToWorld(gs: GameState, cx: number, cz: number): Vec2 {
  const half = gs.mapSize / 2
  return { x: -half + (cx + 0.5) * TILE, z: -half + (cz + 0.5) * TILE }
}

export function blockedAtCell(gs: GameState, cx: number, cz: number): boolean {
  const w = navWidth(gs)
  if (cx < 0 || cz < 0 || cx >= w || cz >= w) return true
  ensureNav(gs)
  return gs.nav[cz * w + cx] !== NAV_FREE
}

/** True only for building footprints: what a unit may never overlap. */
export function hardBlockedAtCell(gs: GameState, cx: number, cz: number): boolean {
  const w = navWidth(gs)
  if (cx < 0 || cz < 0 || cx >= w || cz >= w) return true
  ensureNav(gs)
  return gs.nav[cz * w + cx] === NAV_BUILDING
}

export function isBlocked(gs: GameState, x: number, z: number): boolean {
  const c = worldToCell(gs, x, z)
  return blockedAtCell(gs, c.cx, c.cz)
}

export function isHardBlocked(gs: GameState, x: number, z: number): boolean {
  const c = worldToCell(gs, x, z)
  return hardBlockedAtCell(gs, c.cx, c.cz)
}

/**
 * Closest open cell by Chebyshev rings. `allowSoft` treats resource tiles as
 * open, which is what a unit standing on a node needs to path out of it.
 */
export function nearestOpenCell(
  gs: GameState,
  cx: number,
  cz: number,
  allowSoft = false,
  maxR = 12,
): { cx: number; cz: number } | null {
  const w = navWidth(gs)
  ensureNav(gs)
  const open = (ax: number, az: number): boolean => {
    if (ax < 0 || az < 0 || ax >= w || az >= w) return false
    const v = gs.nav[az * w + ax]
    return v === NAV_FREE || (allowSoft && v === NAV_RESOURCE)
  }
  if (open(cx, cz)) return { cx, cz }
  for (let r = 1; r <= maxR; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
        if (open(cx + dx, cz + dz)) return { cx: cx + dx, cz: cz + dz }
      }
    }
  }
  return null
}

/**
 * Keeps a unit out of a building footprint after the separation pass pushed it
 * inside one. Resource tiles are ignored on purpose: a gatherer may stand on
 * the node it is working, and pushing it out would fight the gather range.
 */
export function resolveBlocked(gs: GameState, e: UnitEntity): void {
  const c = worldToCell(gs, e.x, e.z)
  if (!hardBlockedAtCell(gs, c.cx, c.cz)) return
  const open = nearestOpenCell(gs, c.cx, c.cz, true, 10)
  if (!open) return
  const w = cellToWorld(gs, open.cx, open.cz)
  e.x = w.x
  e.z = w.z
}

function fillFootprint(gs: GameState, x: number, z: number, sx: number, sz: number, flag: number): void {
  const half = gs.mapSize / 2
  const eps = 1e-6
  const cx0 = Math.floor((x - sx / 2 + half) / TILE)
  const cx1 = Math.floor((x + sx / 2 + half - eps) / TILE)
  const cz0 = Math.floor((z - sz / 2 + half) / TILE)
  const cz1 = Math.floor((z + sz / 2 + half - eps) / TILE)
  fillCells(gs, cx0, cx1, cz0, cz1, flag)
}

function fillCells(gs: GameState, cx0: number, cx1: number, cz0: number, cz1: number, flag: number): void {
  const w = navWidth(gs)
  for (let cz = cz0; cz <= cz1; cz++) {
    if (cz < 0 || cz >= w) continue
    for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cx >= w) continue
      const i = cz * w + cx
      if (gs.nav[i] < flag) gs.nav[i] = flag
    }
  }
}
