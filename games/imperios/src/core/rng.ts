/**
 * Deterministic PRNG (mulberry32). Simulation must never use Math.random, so a
 * match can be replayed from its seed.
 */
export interface Rng {
  next(): number
  int(max: number): number
  range(a: number, b: number): number
  pick<T>(arr: T[]): T
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (max: number): number => (max <= 0 ? 0 : Math.floor(next() * max)),
    range: (a: number, b: number): number => a + next() * (b - a),
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
  }
}
