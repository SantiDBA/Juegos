/**
 * Lógica pura del tablero. Sin canvas, sin DOM, sin dependencias.
 *
 * Aislarla así permite ejercitar la mecánica con `node` de forma headless, que
 * es la única forma barata de estar seguro de que completar líneas y la
 * gravedad no dejan estados imposibles.
 */

/** 0 = vacía. 1..MAX_TIER = un bloque de ese color. */
export type Cell = number

export interface CellPos {
  x: number
  y: number
}

/** Una línea completa: 4+ celdas del mismo color en horizontal o vertical. */
export interface Line {
  /** `true` si la línea es horizontal. */
  horizontal: boolean
  /** Celdas que la forman, en orden. */
  cells: CellPos[]
  tier: number
}

export interface PlaceResult {
  /** El movimiento era válido: las piezas entraron al tablero. */
  valid: boolean
  /** Líneas completadas en este turno. */
  lines: Line[]
  /** Celdas totales borradas, contando una sola vez las de cruce. */
  cleared: number
  /** Puntos del turno. */
  score: number
  /** Mayor largo de línea completada. */
  bestLength: number
}

export const EMPTY = 0

export class Board {
  readonly width: number
  readonly height: number
  /** `cells[y * width + x]`. */
  readonly cells: Uint8Array

  /**
   * `new Board(size)` hace un tablero cuadrado; con `width` y `height` se
   * pueden hacer rectangulares, que es lo que usan los tests para que los
   * casos queden legibles.
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

  get occupied(): number {
    let n = 0
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] !== EMPTY) n++
    return n
  }

  /** ¿Caben las celdas de `shape` con su origen en (x, y)? */
  fits(shape: readonly CellPos[], x: number, y: number): boolean {
    for (const c of shape) {
      const px = x + c.x
      const py = y + c.y
      if (px < 0 || py < 0 || px >= this.width || py >= this.height) return false
      if (this.at(px, py) !== EMPTY) return false
    }
    return true
  }

  /** Todas las posiciones del tablero donde `shape` cabe. */
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
   * Suelta las piezas y resuelve el turno.
   *
   * A diferencia del merge, acá **toda colocación válida cuenta**, aunque no
   * complete ninguna línea: eso es lo que hace que el juego sea de planear y
   * no de soltar piezas a ver qué pasa. Lo que puntúa es completar líneas.
   */
  place(
    shapes: ReadonlyArray<{ tier: number; cells: readonly CellPos[] }>,
    origin: CellPos,
    minLine: number,
  ): PlaceResult {
    // Si alguna pieza no cabe, el turno entero se rechaza: se sueltan como un
    // grupo, no de a una.
    for (const s of shapes) {
      if (!this.fits(s.cells, origin.x, origin.y)) {
        return { valid: false, lines: [], cleared: 0, score: 0, bestLength: 0 }
      }
    }

    const work = this.clone()
    for (const s of shapes) {
      for (const c of s.cells) work.set(origin.x + c.x, origin.y + c.y, s.tier)
    }

    // Líneas que se completan con lo recién soltado. No hay cascadas: las
    // líneas que se formen al caer se limpian en el turno siguiente, si acaso.
    const lines = work.findLines(minLine)
    // Una celda que cruza dos líneas se borra una sola vez, así que el puntaje
    // no paga dos veces por el mismo bloque.
    const clearedSet = new Set<string>()
    for (const line of lines) {
      for (const c of line.cells) clearedSet.add(`${c.x},${c.y}`)
    }
    const cleared = clearedSet.size
    for (const key of clearedSet) {
      const [xs, ys] = key.split(',')
      work.set(Number.parseInt(xs ?? '0', 10), Number.parseInt(ys ?? '0', 10), EMPTY)
    }

    if (cleared > 0) work.applyGravity()

    this.cells.set(work.cells)

    const bestLength = lines.reduce((m, l) => Math.max(m, l.cells.length), 0)
    return { valid: true, lines, cleared, score: cleared * 10, bestLength }
  }

  /**
   * Deja caer cada bloque hasta apoyarse, columna por columna.
   *
   * Se usa sólo tras completar una línea. Al soltar las fichas NO hay gravity:
   * en `1010!` las piezas se colocan exactamente donde las ponés, y planear la
   * línea depende de poder dejar huecos.
   */
  applyGravity(): void {
    const { width, height, cells } = this
    for (let x = 0; x < width; x++) {
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
   * Todas las líneas de `minLength` o más del mismo color, horizontales y
   * verticales.
   *
   * Se recorre por tramos de color consecutivos: una fila con `AAA.BAAAA` da
   * dos líneas, de 3 y de 4, y la de 3 se descarta por corta. El resultado
   * viene ordenado por largo descendente y luego por posición, para que sea
   * reproducible.
   */
  findLines(minLength: number): Line[] {
    const lines: Line[] = []
    const { width, height } = this

    // Horizontales. Se itera hasta `width` inclusive para cerrar el último
    // tramo de cada fila.
    for (let y = 0; y < height; y++) {
      let run: CellPos[] = []
      let tier = EMPTY
      for (let x = 0; x <= width; x++) {
        const v = x < width ? this.at(x, y) : EMPTY
        if (v !== EMPTY && v === tier) {
          run.push({ x, y })
          continue
        }
        if (run.length >= minLength) lines.push({ horizontal: true, cells: run, tier })
        run = v === EMPTY ? [] : [{ x, y }]
        tier = v
      }
    }

    // Verticales.
    for (let x = 0; x < width; x++) {
      let run: CellPos[] = []
      let tier = EMPTY
      for (let y = 0; y <= height; y++) {
        const v = y < height ? this.at(x, y) : EMPTY
        if (v !== EMPTY && v === tier) {
          run.push({ x, y })
          continue
        }
        if (run.length >= minLength) lines.push({ horizontal: false, cells: run, tier })
        run = v === EMPTY ? [] : [{ x, y }]
        tier = v
      }
    }

    lines.sort((a, b) => {
      if (b.cells.length !== a.cells.length) return b.cells.length - a.cells.length
      const ay = a.cells[0]!.y
      const by = b.cells[0]!.y
      if (ay !== by) return ay - by
      return a.cells[0]!.x - b.cells[0]!.x
    })

    return lines
  }

  /** ¿Hay alguna posición donde `shape` completaría al menos una línea? */
  hasLinePlacement(shape: readonly CellPos[], tier: number, minLine: number): boolean {
    for (const origin of this.placements(shape)) {
      const probe = this.clone()
      for (const c of shape) probe.set(origin.x + c.x, origin.y + c.y, tier)
      if (probe.findLines(minLine).length > 0) return true
    }
    return false
  }

  /** Serialización para comparar tableros en tests. */
  toKey(): string {
    return Array.from(this.cells).join('')
  }
}