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

  /** Entero en [min, max] inclusivo. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** -1 o 1. */
  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]
  }

  /** Copia barajada (Fisher-Yates). */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      const tmp = items[i]
      items[i] = items[j]
      items[j] = tmp
    }
    return items
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}
