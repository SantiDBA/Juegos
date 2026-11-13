import type { GameState } from './state'

/**
 * Simulation events are a one-way channel from the sim to presentation layers
 * (VFX, audio, UI). They carry ids plus a position snapshot because the entity
 * may be removed by cleanup before the frame renders.
 * `attack` x/z is the attacker position, `damage` x/z is the impact point.
 */
export type SimEvent =
  | { kind: 'attack'; from: number; to: number; unitType?: string; x: number; z: number }
  | { kind: 'damage'; target: number; amount: number; x: number; z: number }
  | { kind: 'death'; entity: 'unit' | 'building'; team: 'player' | 'enemy'; unitType?: string; x: number; z: number }
  | { kind: 'train-complete'; team: 'player' | 'enemy'; unitType: string; x: number; z: number }
  | { kind: 'build-complete'; team: 'player' | 'enemy'; buildingType: string; x: number; z: number }
  | { kind: 'tech-complete'; team: 'player' | 'enemy'; techId: string }

export function emit(gs: GameState, ev: SimEvent): void {
  gs.events.push(ev)
}
