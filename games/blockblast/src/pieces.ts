import type { CellPos } from './board'
import { TUNING } from './config'

/**
 * Definición de una pieza de la bandeja: su forma y su color.
 *
 * `cells` está normalizada a (0,0) como esquina superior izquierda, para que
 * el jugador pueda arrastrarla sin importar desde dónde la tomó.
 */
export interface Piece {
  /** Identificador único y monotónico; `usedPieces` es un Set por id. */
  id: number
  /** Color, 1..TUNING.colors. */
  tier: number
  cells: readonly CellPos[]
  /** Ancho y alto, para centrar la pieza bajo el puntero. */
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
 * Ids monotónicos y únicos.
 *
 * No se usa el índice de ranura: `commitMove` repone las piezas usadas con
 * `fresh.shift()`, que reiniciaría la numeración y dejaría dos piezas con el
 * mismo id. Como `usedPieces` es un Set por id, arrastrar una marcaba las dos
 * y el turno usaba la misma pieza dos veces.
 */
let nextPieceId = 1

/** Genera la bandeja de un turno: exactamente `TUNING.traySize` piezas. */
export function rollTray(rand: () => number): Piece[] {
  const out: Piece[] = []
  for (let i = 0; i < TUNING.traySize; i++) {
    const spec = TUNING.shapes[Math.floor(rand() * TUNING.shapes.length)] ?? '1x1'
    const cells = parseShape(spec)
    const { w, h } = shapeSize(cells)
    // El color se sortea por separado de la forma: una pieza de 5 en línea con
    // color alto es casi imposible de usar, y ensuciaría el turno.
    const tier = 1 + Math.floor(rand() * TUNING.colors)
    out.push({ id: nextPieceId++, tier, cells, w, h })
  }
  return out
}