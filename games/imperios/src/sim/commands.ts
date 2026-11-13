import { queueResearch, queueTrain, tryAdvanceEra, tryPlaceBuilding, commandAttack, commandGather, commandMove, getEntity, type GameState } from './state'
import type { BuildingType, UnitType } from '../core/types'

export type Command =
  | { t: 'move'; ids: number[]; x: number; z: number; attackMove?: boolean }
  | { t: 'gather'; ids: number[]; node: number }
  | { t: 'attack'; ids: number[]; target: number }
  | { t: 'train'; building: number; unit: UnitType }
  | { t: 'research'; tech: string }
  | { t: 'advance-era' }
  | { t: 'place'; building: BuildingType; x: number; z: number }

function ownUnits(gs: GameState, ids: number[]): number[] {
  const out: number[] = []
  for (const id of ids) {
    const e = getEntity(gs, id)
    if (e && e.kind === 'unit' && !e.dead && e.team === 'player') out.push(id)
  }
  return out
}

export function applyCommand(gs: GameState, cmd: Command): boolean {
  switch (cmd.t) {
    case 'move': {
      const ids = ownUnits(gs, cmd.ids)
      if (ids.length === 0) return false
      commandMove(gs, ids, { x: cmd.x, z: cmd.z }, cmd.attackMove ?? false)
      return true
    }
    case 'gather': {
      const ids = ownUnits(gs, cmd.ids).filter(id => {
        const e = getEntity(gs, id)
        return e?.kind === 'unit' && e.utype === 'ingeniero'
      })
      if (ids.length === 0) return false
      commandGather(gs, ids, cmd.node)
      return true
    }
    case 'attack': {
      const ids = ownUnits(gs, cmd.ids)
      if (ids.length === 0) return false
      commandAttack(gs, ids, cmd.target)
      return true
    }
    case 'train':
      return queueTrain(gs, 'player', cmd.building, cmd.unit)
    case 'research':
      return queueResearch(gs, 'player', cmd.tech)
    case 'advance-era':
      return tryAdvanceEra(gs)
    case 'place':
      return tryPlaceBuilding(gs, cmd.building, cmd.x, cmd.z)
  }
}
