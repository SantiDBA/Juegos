import { stepSim } from './sim'
import type { GameState } from './state'

/**
 * Fixed-timestep driver: real frame time feeds an accumulator, the simulation
 * only ever advances in whole ticks so results stay deterministic regardless
 * of the frame rate. Long stalls are clamped instead of fast-forwarding.
 */
export function advance(gs: GameState, realDt: number, tps = 20): void {
  gs.acc += Math.min(realDt, 0.25)
  while (gs.acc >= 1 / tps) {
    stepSim(gs, 1 / tps)
    gs.acc -= 1 / tps
  }
}
