import { BUILDING_DEFS, ERAS, GRID, TECHS } from '../core/config'
import { canAfford, dist, spend } from '../core/utils'
import { buildingsOfTeam, canResearch, canTrain, queueResearch, queueTrain, recomputePop, spawnBuilding, unitsOfTeam, type GameState } from './state'
import { cellToWorld } from './navgrid'
import { findPath } from './path'
import { VIS_UNKNOWN, knownBuildingTargets } from './vision'
import type { BuildingEntity, BuildingType, Team, UnitEntity, UnitType, Vec2 } from '../core/types'

const BASE_X: Record<Team, number> = { player: -55, enemy: 55 }

/** Base-relative offset, mirrored for the player side (AI-vs-AI harness). */
function mirrorX(team: Team, dx: number): number {
  return BASE_X[team] + (team === 'enemy' ? dx : -dx)
}

/** Sites only progress with an engineer on them, so one is sent to build. */
function assignBuilder(gs: GameState, team: Team, site: BuildingEntity): void {
  let best: UnitEntity | null = null
  let bestD = Infinity
  for (const u of unitsOfTeam(gs, team)) {
    if (u.utype !== 'ingeniero' || u.state === 'build') continue
    const d = (u.x - site.x) ** 2 + (u.z - site.z) ** 2
    if (d < bestD) { bestD = d; best = u }
  }
  if (!best) return
  best.state = 'build'
  best.gatherTargetId = undefined
  best.targetId = undefined
  best.path = []
}

function buildSite(gs: GameState, team: Team, type: BuildingType, dx: number, dz: number): boolean {
  const def = BUILDING_DEFS[type]
  const p = gs.players[team]
  if (!canAfford(p.resources, def.cost)) return false
  spend(p.resources, def.cost)
  const site = spawnBuilding(gs, team, type, mirrorX(team, dx), dz, false)
  assignBuilder(gs, team, site)
  return true
}

/**
 * Where to march when no enemy building has been scouted yet. Picks the nearest
 * unexplored tile, biased toward the far base so the army sweeps outward
 * instead of orbiting its own base. Pure function of the fog grid: no RNG.
 */
function scoutPoint(gs: GameState, team: Team, fromX: number, fromZ: number): Vec2 | null {
  const foeX = BASE_X[team === 'enemy' ? 'player' : 'enemy']
  const grid = gs.vision[team]
  let best: Vec2 | null = null
  let bestScore = Infinity
  for (let cz = 0; cz < GRID; cz++) {
    const row = cz * GRID
    for (let cx = 0; cx < GRID; cx++) {
      if (grid[row + cx] !== VIS_UNKNOWN) continue
      const p = cellToWorld(gs, cx, cz)
      const score = dist(p.x, p.z, fromX, fromZ) + 0.6 * dist(p.x, p.z, foeX, 0)
      if (score < bestScore) { bestScore = score; best = p }
    }
  }
  return best
}

export function stepAI(gs: GameState, team: Team, dt: number): void {
  const p = gs.players[team]
  p.aiTimer += dt
  if (p.aiTimer < 1.0) return
  p.aiTimer = 0

  const foe: Team = team === 'enemy' ? 'player' : 'enemy'
  const buildings = buildingsOfTeam(gs, team)
  const anyOf = (t: BuildingType): number => buildings.filter(b => b.btype === t).length
  const builtOf = (t: BuildingType): BuildingEntity[] => buildings.filter(b => b.btype === t && b.built)
  const tcs = builtOf('ayuntamiento')
  const barracks = builtOf('cuartel')
  const factories = builtOf('fabrica')
  const houses = anyOf('vivienda')
  const engs = unitsOfTeam(gs, team).filter(u => u.utype === 'ingeniero')
  const army = unitsOfTeam(gs, team).filter(u => u.utype !== 'ingeniero')

  // economy and base building (real construction: engineers must finish the site)
  if (engs.length < 8 && tcs[0] && canTrain(gs, team, 'ingeniero').ok) queueTrain(gs, team, tcs[0].id, 'ingeniero')
  if (houses < 6 && p.resources.materiales >= 140) buildSite(gs, team, 'vivienda', 3, 10 + houses * 8)
  if (anyOf('cuartel') < 1 && p.resources.materiales >= 170) {
    buildSite(gs, team, 'cuartel', gs.rng.range(0, 8), -10 + gs.rng.range(0, 8))
  }
  if (p.era >= 2 && anyOf('cuartel') < 2 && p.resources.materiales >= 170) {
    buildSite(gs, team, 'cuartel', -14, 6 + gs.rng.range(0, 6))
  }
  if (p.era >= 2 && anyOf('fabrica') < 1 && p.resources.materiales >= 300 && p.resources.combustible >= 120) {
    buildSite(gs, team, 'fabrica', 7 + gs.rng.range(0, 6), 2 + gs.rng.range(0, 8))
  }
  if (p.era >= 2 && anyOf('torre') < 4 && p.resources.materiales >= 130) {
    buildSite(gs, team, 'torre', -11, -18 + anyOf('torre') * 36)
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
    if (br && gs.rng.next() < 0.75) {
      const type = gs.rng.pick(infRoster)
      if (canTrain(gs, team, type).ok) queueTrain(gs, team, br.id, type)
    }
    const fac = factories[0]
    if (fac && vehRoster.length > 0 && gs.rng.next() < 0.6) {
      const type = gs.rng.pick(vehRoster)
      if (canTrain(gs, team, type).ok) queueTrain(gs, team, fac.id, type)
    }
  }

  // research affordable techs
  if (!p.research && tcs[0]) {
    for (const t of TECHS) {
      if (canResearch(gs, team, t.id).ok) { queueResearch(gs, team, t.id); break }
    }
  }

  // attack waves grow with era
  const waveSize = 6 + p.era * 3
  if (army.length >= waveSize) {
    // Only buildings the AI has actually scouted can be attacked: the fog
    // applies to the AI too, so no omniscient target picking.
    const known = knownBuildingTargets(gs, team, foe)
    const target = known.find(b => b.btype === 'ayuntamiento') || known[0]
    if (target) {
      for (const u of army) {
        if (u.state === 'idle' || !u.targetId) { u.targetId = target.id; u.state = 'attack' }
      }
    } else {
      // nothing known yet: sweep toward unexplored ground instead of the void
      let cx = 0, cz = 0
      for (const u of army) { cx += u.x; cz += u.z }
      cx /= army.length; cz /= army.length
      const scout = scoutPoint(gs, team, cx, cz)
      if (scout) {
        for (const u of army) {
          if (u.state !== 'idle' || u.targetId) continue
          u.path = findPath(gs, u.x, u.z, scout.x, scout.z)
          u.state = 'move'
          u.home = { x: scout.x, z: scout.z }
          u.repathT = 0
        }
      }
    }
  }
  recomputePop(gs)
}
