import { BUILDING_DEFS, ERAS, TECHS } from '../core/config'
import { canAfford, spend } from '../core/utils'
import { buildingsOfTeam, canResearch, canTrain, queueResearch, queueTrain, recomputePop, spawnBuilding, unitsOfTeam, type GameState } from './state'
import type { BuildingEntity, BuildingType, Team, UnitEntity, UnitType } from '../core/types'

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
  if (houses < 2 && p.resources.materiales >= 140) buildSite(gs, team, 'vivienda', 3, 10 + houses * 8)
  if (anyOf('cuartel') < 1 && p.resources.materiales >= 170) {
    buildSite(gs, team, 'cuartel', gs.rng.range(0, 8), -10 + gs.rng.range(0, 8))
  }
  if (p.era >= 2 && anyOf('fabrica') < 1 && p.resources.materiales >= 300 && p.resources.combustible >= 120) {
    buildSite(gs, team, 'fabrica', 7 + gs.rng.range(0, 6), 2 + gs.rng.range(0, 8))
  }
  if (p.era >= 2 && anyOf('torre') < 2 && p.resources.materiales >= 130) {
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
    const foeBuildings = buildingsOfTeam(gs, foe)
    const target = foeBuildings.find(b => b.btype === 'ayuntamiento') || foeBuildings[0]
    if (target) {
      for (const u of army) {
        if (u.state === 'idle' || !u.targetId) { u.targetId = target.id; u.state = 'attack' }
      }
    }
  }
  recomputePop(gs)
}
