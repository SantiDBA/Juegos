import type { Vec2 } from '../core/types'
import {
  cellToWorld,
  ensureNav,
  navWidth,
  nearestOpenCell,
  worldToCell,
  NAV_FREE,
} from './navgrid'
import type { GameState } from './state'

/**
 * 8-way A* over the static nav grid.
 *
 * - costs: 1 orthogonal, sqrt(2) diagonal (diagonals may not cut corners)
 * - heuristic: octile distance (admissible, never overestimates)
 * - expansion cap: MAX_EXPANSIONS, after which the search gives up and the
 *   caller falls back to a straight line so a unit is never frozen
 *
 * The binary heap, score arrays and visit stamps are reused across calls: a
 * match issues a few dozen searches per second and none of them allocate.
 */
const SQRT2 = Math.SQRT2
const MAX_EXPANSIONS = 6000
const DIAG_COST = SQRT2

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, DIAG_COST], [1, -1, DIAG_COST], [-1, 1, DIAG_COST], [-1, -1, DIAG_COST],
]

let bufSize = 0
let gScore = new Float64Array(0)
let visited = new Int32Array(0)
let closed = new Int32Array(0)
let cameFrom = new Int32Array(0)
let heapIdx = new Int32Array(0)
let heapKey = new Float64Array(0)
let heapLen = 0
let searchTag = 0

function reserve(n: number): void {
  if (bufSize >= n) return
  bufSize = n
  gScore = new Float64Array(n)
  visited = new Int32Array(n)
  closed = new Int32Array(n)
  cameFrom = new Int32Array(n)
  heapIdx = new Int32Array(n * 4)
  heapKey = new Float64Array(n * 4)
}

function heapPush(idx: number, key: number): void {
  if (heapLen >= heapIdx.length) return
  let i = heapLen++
  heapIdx[i] = idx
  heapKey[i] = key
  while (i > 0) {
    const p = (i - 1) >> 1
    if (heapKey[p] <= heapKey[i]) break
    const ti = heapIdx[p], tk = heapKey[p]
    heapIdx[p] = heapIdx[i]; heapKey[p] = heapKey[i]
    heapIdx[i] = ti; heapKey[i] = tk
    i = p
  }
}

function heapPop(): number {
  const top = heapIdx[0]
  heapLen--
  if (heapLen > 0) {
    heapIdx[0] = heapIdx[heapLen]
    heapKey[0] = heapKey[heapLen]
    let i = 0
    for (;;) {
      const l = i * 2 + 1
      if (l >= heapLen) break
      const r = l + 1
      const c = r < heapLen && heapKey[r] < heapKey[l] ? r : l
      if (heapKey[i] <= heapKey[c]) break
      const ti = heapIdx[c], tk = heapKey[c]
      heapIdx[c] = heapIdx[i]; heapKey[c] = heapKey[i]
      heapIdx[i] = ti; heapKey[i] = tk
      i = c
    }
  }
  return top
}

function octile(dx: number, dz: number): number {
  const ax = Math.abs(dx), az = Math.abs(dz)
  return ax + az + (DIAG_COST - 2) * Math.min(ax, az)
}

/**
 * Grid line of sight: samples the segment every 0.8 world units and fails on
 * the first blocked cell. Used both as an A* short-circuit and by smoothPath.
 */
export function lineOfSight(gs: GameState, ax: number, az: number, bx: number, bz: number): boolean {
  ensureNav(gs)
  const w = navWidth(gs)
  const nav = gs.nav
  const len = Math.hypot(bx - ax, bz - az)
  const steps = Math.max(1, Math.ceil(len / 0.8))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const c = worldToCell(gs, ax + (bx - ax) * t, az + (bz - az) * t)
    if (c.cx < 0 || c.cz < 0 || c.cx >= w || c.cz >= w) return false
    if (nav[c.cz * w + c.cx] !== NAV_FREE) return false
  }
  return true
}

/**
 * World-space route from `from` to `to`. A blocked destination resolves to the
 * closest walkable cell (so clicking on a forest walks to its edge) and a
 * blocked origin resolves to the closest cell the unit can path out of.
 * Returns a single straight waypoint when the search fails or the request has
 * line of sight.
 */
export function findPath(gs: GameState, fromX: number, fromZ: number, toX: number, toZ: number): Vec2[] {
  const w = navWidth(gs)
  ensureNav(gs)
  const nav = gs.nav
  reserve(w * w)

  const blocked = (cx: number, cz: number): boolean => {
    if (cx < 0 || cz < 0 || cx >= w || cz >= w) return true
    return nav[cz * w + cx] !== NAV_FREE
  }

  const rawStart = worldToCell(gs, fromX, fromZ)
  const rawGoal = worldToCell(gs, toX, toZ)
  const goalOpen = !blocked(rawGoal.cx, rawGoal.cz)
  const startOpen = !blocked(rawStart.cx, rawStart.cz)

  const goalCell = goalOpen ? rawGoal : nearestOpenCell(gs, rawGoal.cx, rawGoal.cz, false, 10)
  if (!goalCell) return [{ x: toX, z: toZ }]
  const startCell = startOpen ? rawStart : nearestOpenCell(gs, rawStart.cx, rawStart.cz, true, 10)
  if (!startCell) return [{ x: toX, z: toZ }]

  // the exact click is only kept when it is walkable; otherwise we walk to the
  // nearest free cell next to it
  const goalWorld: Vec2 = goalOpen ? { x: toX, z: toZ } : cellToWorld(gs, goalCell.cx, goalCell.cz)
  if (goalCell.cx === startCell.cx && goalCell.cz === startCell.cz) return [goalWorld]
  if (startOpen && lineOfSight(gs, fromX, fromZ, goalWorld.x, goalWorld.z)) return [goalWorld]

  const startId = startCell.cz * w + startCell.cx
  const goalId = goalCell.cz * w + goalCell.cx

  searchTag++
  heapLen = 0
  gScore[startId] = 0
  visited[startId] = searchTag
  cameFrom[startId] = -1
  heapPush(startId, octile(startCell.cx - goalCell.cx, startCell.cz - goalCell.cz))

  let found = false
  let expansions = 0
  while (heapLen > 0 && expansions < MAX_EXPANSIONS) {
    const cur = heapPop()
    if (closed[cur] === searchTag) continue
    closed[cur] = searchTag
    if (cur === goalId) { found = true; break }
    expansions++
    const cx = cur % w
    const cz = (cur - cx) / w
    const g = gScore[cur]
    for (let k = 0; k < DIRS.length; k++) {
      const dx = DIRS[k][0], dz = DIRS[k][1], cost = DIRS[k][2]
      const nx = cx + dx, nz = cz + dz
      if (blocked(nx, nz)) continue
      if (dx !== 0 && dz !== 0 && (blocked(cx + dx, cz) || blocked(cx, cz + dz))) continue
      const ni = nz * w + nx
      if (closed[ni] === searchTag) continue
      const tentative = g + cost
      if (visited[ni] === searchTag && tentative >= gScore[ni]) continue
      visited[ni] = searchTag
      gScore[ni] = tentative
      cameFrom[ni] = cur
      heapPush(ni, tentative + octile(nx - goalCell.cx, nz - goalCell.cz))
    }
  }

  if (!found) return [{ x: toX, z: toZ }]

  const cells: Vec2[] = []
  let node = goalId
  while (node !== startId && node >= 0) {
    const cx = node % w
    cells.push(cellToWorld(gs, cx, (node - cx) / w))
    node = cameFrom[node]
  }
  cells.reverse()
  if (cells.length === 0) return [goalWorld]
  cells[cells.length - 1] = goalWorld
  return smoothPath(gs, cells, fromX, fromZ)
}

/** Collapses waypoints that are mutually visible, keeping corners only. */
export function smoothPath(gs: GameState, path: Vec2[], fromX: number, fromZ: number): Vec2[] {
  if (path.length <= 1) return path.slice()
  const out: Vec2[] = []
  let curX = fromX, curZ = fromZ
  let i = 0
  let guard = 0
  while (i < path.length && guard++ < 256) {
    let j = path.length - 1
    while (j > i && !lineOfSight(gs, curX, curZ, path[j].x, path[j].z)) j--
    out.push(path[j])
    curX = path[j].x
    curZ = path[j].z
    i = j + 1
  }
  return out
}
