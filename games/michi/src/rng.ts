/**
 * Generador pseudoaleatorio determinístico (mulberry32). Una misma semilla
 * produce siempre la misma secuencia, así una partida se puede reproducir a
 * partir de su semilla.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Flotante en [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Flotante en [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}
