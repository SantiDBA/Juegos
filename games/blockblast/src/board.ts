/**
 * Lógica pura del tablero. Sin canvas, sin DOM, sin dependencias.
 *
 * Aislarla así permite ejercitar la mecánica con `node` de forma headless, que
 * es la única forma barata de estar seguro de que el merge en cascada y la
 * gravedad no dejan estados imposibles. Lo que se renderiza es consecuencia;
 * el juego se juega acá.
 */

/** 0 = vacía. 1..MAX_TIER = un bloque de ese color. */
export type Cell = number

export interface CellPos {
  x: number
  y: number
}

/** Un grupo de celdas del mismo color que fusiona en una sola pieza. */
interface Group {
  cells: CellPos[]
  tier: number
}

export interface PlaceResult {
  /** El movimiento era válido: hubo al menos una fusión. */
  valid: boolean
  /** Puntos ganados en este movimiento, ya con cascada y combo. */
  score: number
  /** Cuántos bloques se fusionaron en total, para el texto de la UI. */
  merges: number
  /** Rondas de cascada: 1 si no hubo cascada. */
  rounds: number
  /** Mayor tier alcanzado en este movimiento. */
  bestTier: number
}

export const EMPTY = 0

export class Board {
  readonly width: number
  readonly height: number
  /** `cells[y * width + x]`. */
  readonly cells: Uint8Array

  /**
   * `square` construye un tablero de `size`×`size`. Para tableros rectangulares
   * se pasan `width` y `height` explícitos, que es lo que usan los tests para
   * dejar los casos legibles.
   */
  constructor(size: number)
  constructor(width: number, height: number)
  constructor(width: number, height = width) {
    this.width = width
    this.height = height
    this.cells = new Uint8Array(width * height)
  }

  clone(): Board {
    const b = new Board(this.width, this.height)
    b.cells.set(this.cells)
    return b
  }

  at(x: number, y: number): Cell {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return EMPTY
    return this.cells[y * this.width + x] ?? EMPTY
  }

  set(x: number, y: number, value: Cell): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    this.cells[y * this.width + x] = value
  }

  /** occupied: celdas con algún bloque. */
  get occupied(): number {
    let n = 0
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] !== EMPTY) n++
    return n
  }

  /**
   * ¿Caben las celdas de `shape` con su origen en (x, y)?
   *
   * Sólo geometría: no mira si fusionan. La validez es otro paso.
   */
  fits(shape: readonly CellPos[], x: number, y: number): boolean {
    for (const c of shape) {
      const px = x + c.x
      const py = y + c.y
      if (px < 0 || py < 0 || px >= this.width || py >= this.height) return false
      if (this.at(px, py) !== EMPTY) return false
    }
    return true
  }

  /**
   * Todas las posiciones válidas para `shape`.
   *
   * `canMergeFrom` es un filtro opcional para cuando sólo interesan las
   * colocaciones que fusionan (usado por el game over, que necesita saber si
   * *alguna* de las piezas tiene dónde ir).
   */
  placements(shape: readonly CellPos[]): CellPos[] {
    const out: CellPos[] = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.fits(shape, x, y)) out.push({ x, y })
      }
    }
    return out
  }

  /**
   * Suelta las piezas y resuelve el turno completo.
   *
   * Todo en una pasada sobre una copia: si el movimiento no fusiona nada se
   * descarta el estado y se devuelve `valid: false`. Así el tablero nunca queda
   * a medio camino ni el llamador tiene que deshacer.
   */
  place(
    shapes: ReadonlyArray<{ tier: number; cells: readonly CellPos[] }>,
    origin: CellPos,
    maxTier: number,
  ): PlaceResult {
    // 1. Comprobar que todas las caben en el origen. Si alguna no, el turno
    //    entero es inválido: en el original se sueltan como un grupo.
    for (const s of shapes) {
      if (!this.fits(s.cells, origin.x, origin.y)) {
        return { valid: false, score: 0, merges: 0, rounds: 0, bestTier: 0 }
      }
    }

    // 2. Estado de trabajo: copia para poder tirar todo si no fusiona.
    const work = this.clone()
    for (const s of shapes) {
      for (const c of s.cells) {
        work.set(origin.x + c.x, origin.y + c.y, s.tier)
      }
    }
    work.applyGravity()

    // 3. Cascada de fusiones.
    let total = 0
    let merges = 0
    let round = 0
    let bestTier = 0
    let guard = 0
    for (;;) {
      const groups = work.findGroups()
      if (!groups.length) break
      if (++guard > 64) break // cinturón de seguridad: no puede pasar, pero evita un loop infinito

      round++
      for (const g of groups) {
        const next = Math.min(g.tier + 1, maxTier)
        bestTier = Math.max(bestTier, next)
        total += 10 * (g.cells.length - 2)
        merges += g.cells.length
        // El bloque fusionado nace en la esquina superior-izquierda del
        // grupo (fila menor, luego columna menor). El original no lo
        // especifica; anclarlo arriba deja la piezaSupported donde el jugador
        // la leyó, en vez de que la gravedad la corra.
        const anchor = g.cells.reduce((a, b) => (b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a))
        for (const c of g.cells) work.set(c.x, c.y, EMPTY)
        work.set(anchor.x, anchor.y, next)
      }
      // Un merge puede habilitar otro en el mismo turno.
      work.applyGravity()
    }

    if (total === 0) {
      // Cayó pero no fusionó: no cuenta. El tablero queda como estaba.
      return { valid: false, score: 0, merges: 0, rounds: 0, bestTier: 0 }
    }

    this.cells.set(work.cells)
    return { valid: true, score: total, merges, rounds: round, bestTier }
  }

  /**
   * Deja caer cada bloque hasta apoyarse.
   *
   * Sólo vertical: el column-wise compaction de abajo hacia arriba garantiza que
   * nunca queda una celda con bloque debajo vacía, que es el invariante que
   * hace que el puzzle sea razonable de razonar.
   */
  applyGravity(): void {
    const { width, height, cells } = this
    for (let x = 0; x < width; x++) {
      // write: la siguiente posición libre desde abajo.
      let write = height - 1
      for (let y = height - 1; y >= 0; y--) {
        const v = cells[y * width + x] ?? EMPTY
        if (v === EMPTY) continue
        if (write !== y) {
          cells[write * width + x] = v
          cells[y * width + x] = EMPTY
        }
        write--
      }
    }
  }

  /**
   * Grupos de 3+ celdas adyacentes del mismo color, con flood fill ortogonal.
   *
   * El resultado viene ordenado por (tier, ancla) para que dos corridas con
   * la misma entrada produzcan siempre el mismo tablero: el merge es
   * simultáneo, así que el orden no cambia el resultado final, pero sí el
   * texto que muestra la UI y cualquier depuración.
   */
  findGroups(minSize = 3): Group[] {
    const { width, height, cells } = this
    const seen = new Uint8Array(width * height)
    const groups: Group[] = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const tier = cells[idx] ?? EMPTY
        if (tier === EMPTY || seen[idx] === 1) continue

        // Flood fill del mismo tier.
        const groupCells: CellPos[] = []
        const stack: CellPos[] = [{ x, y }]
        seen[idx] = 1
        while (stack.length) {
          const cur = stack.pop()!
          groupCells.push(cur)
          const neighbours: CellPos[] = [
            { x: cur.x + 1, y: cur.y },
            { x: cur.x - 1, y: cur.y },
            { x: cur.x, y: cur.y + 1 },
            { x: cur.x, y: cur.y - 1 },
          ]
          for (const n of neighbours) {
            if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue
            const nIdx = n.y * width + n.x
            if (seen[nIdx] === 1) continue
            if ((cells[nIdx] ?? EMPTY) !== tier) continue
            seen[nIdx] = 1
            stack.push(n)
          }
        }

        if (groupCells.length >= minSize) {
          groups.push({ cells: groupCells, tier })
        }
      }
    }

    groups.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      const ax = Math.min(...a.cells.map((c) => c.x))
      const ay = Math.min(...a.cells.map((c) => c.y))
      const bx = Math.min(...b.cells.map((c) => c.x))
      const by = Math.min(...b.cells.map((c) => c.y))
      if (ay !== by) return ay - by
      return ax - bx
    })

    return groups
  }

  /**
   * ¿Hay alguna posición donde `shape` fusionaría algo?
   *
   * Se necesita para el game over: la condición real no es "no cabe en ningún
   * lado" sino "no hay ninguna colocación que además fusione", porque una
   * colocación que no fusiona no cuenta como turno.
   */
  hasMergingPlacement(shape: readonly CellPos[], tier: number): boolean {
    for (const origin of this.placements(shape)) {
      const probe = this.clone()
      for (const c of shape) probe.set(origin.x + c.x, origin.y + c.y, tier)
      probe.applyGravity()
      if (probe.findGroups().length > 0) return true
    }
    return false
  }

  /** Serialización para comparar tableros en tests y para el récord. */
  toKey(): string {
    return Array.from(this.cells).join('')
  }
}