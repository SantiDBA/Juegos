import type { CellPos } from './board'
import { TUNING } from './config'

/**
 * Definición de una pieza de la bandeja: su forma y su tier.
 *
 * `cells` está normalizada a (0,0) como esquina superior izquierda, para que
 * el jugador pueda arrastrarla sin importar desde dónde la tomó.
 */
export interface Piece {
  /** Identificador estable dentro de la bandeja. */
  id: number
  tier: number
  cells: readonly CellPos[]
  /** Ancho y alto, para poder centrarla en la celda bajo el puntero. */
  w: number
  h: number
}

/** Convierte `1x3` / `2x2` en una lista de celdas con origen en (0,0). */
export function parseShape(spec: string): CellPos[] {
  const [wRaw, hRaw] = spec.split('x')
  const w = Number.parseInt(wRaw ?? '1', 10)
  const h = Number.parseInt(hRaw ?? '1', 10)
  const cells: CellPos[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells.push({ x, y })
  }
  return cells
}

function shapeSize(cells: readonly CellPos[]): { w: number; h: number } {
  let w = 0
  let h = 0
  for (const c of cells) {
    w = Math.max(w, c.x + 1)
    h = Math.max(h, c.y + 1)
  }
  return { w, h }
}

/**
 * Formas disponibles para un nivel dado.
 *
 * La lista crece con el nivel: al principio sólo hay piezas pequeñas, que son
 * las que se pueden acomodar para fusionar. Meter formas grandes desde el
 * arranque deja al jugador sin jugadas válidas apenas cae una de 3x3.
 */
export function shapesForLevel(level: number): readonly string[] {
  const tiers = TUNING.shapesByLevel
  const idx = Math.min(tiers.length - 1, Math.max(0, level - 1))
  return [...TUNING.alwaysShapes, ...(tiers[idx] ?? [])]
}

/** Tope de tier de la bandeja en este nivel. */
export function trayMaxTier(level: number): number {
  return Math.min(TUNING.trayMaxTier, TUNING.baseMaxTier + (level - 1) * TUNING.tierPerLevel)
}

/**
 * Genera la bandeja de un turno: exactamente `TUNING.traySize` piezas.
 *
 * Los ids son únicos y monotónicos, no índices de ranura. `usedPieces` es un
 * `Set` por id, así que dos piezas con el mismo id se confunden: al arrastrar
 * una se marcaban las dos y el turno terminaba usando la misma pieza dos veces.
 * Un contador global garantiza que ninguna se repita mientras viva la partida.
 */
let nextPieceId = 1

export function rollTray(level: number, rand: () => number): Piece[] {
  const shapes = shapesForLevel(level)
  const maxTier = trayMaxTier(level)
  const out: Piece[] = []
  for (let i = 0; i < TUNING.traySize; i++) {
    const spec = shapes[Math.floor(rand() * shapes.length)] ?? '1x1'
    const cells = parseShape(spec)
    const { w, h } = shapeSize(cells)
    const tier = 1 + Math.floor(rand() * maxTier)
    out.push({ id: nextPieceId++, tier, cells, w, h })
  }
  return out
}