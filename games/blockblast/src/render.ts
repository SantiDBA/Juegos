import { Board, EMPTY, type CellPos } from './board'
import { COLORS, TUNING } from './config'
import type { Piece } from './pieces'

/**
 * Dibujo en Canvas 2D.
 *
 * Todo el render pasa por acá y no guarda estado: recibe el tablero y las
 * piezas y dibuja. Lo decide el llamador.
 */

export interface Layout {
  /** Lado de una celda en px. */
  cell: number
  /** Origen del tablero en px. */
  originX: number
  originY: number
  /** Alto de la zona de bandeja. */
  trayY: number
  trayHeight: number
}

export interface RenderState {
  /** Piezas que se están arrastrando, con su posición en px. */
  dragging: Array<{ piece: Piece; dx: number; dy: number }>
  /** Casilla destino donde caerían las piezas arrastradas. */
  ghost: CellPos | null
  /**
   * Celdas que se van a borrar si se suelta ahora, con su color.
   *
   * Es lo que convierte el juego de "colocar piezas" en "planear": sin esto
   * no hay forma de saber si la posiciónArma una línea antes de soltar.
   */
  preview: Array<{ cell: CellPos; tier: number }>
  /** Pop de línea completada. */
  pops: Array<{ cell: CellPos; tier: number; t: number }>
  /** Puntos flotantes. */
  floaters: Array<{ cell: CellPos; text: string; t: number; color: string }>
  /** Ids de piezas ya soltadas en este turno. */
  usedPieceIds: Set<number>
}

export function computeLayout(
  canvasW: number,
  canvasH: number,
  boardSize: number,
): Layout {
  const margin = 16
  const trayHeight = Math.min(130, Math.max(88, canvasH * 0.16))
  const availH = canvasH - trayHeight - margin * 3
  const availW = canvasW - margin * 2
  const cell = Math.floor(Math.min(availW, availH) / boardSize)

  const boardPx = cell * boardSize
  const originX = Math.round((canvasW - boardPx) / 2)
  const originY = Math.round((canvasH - trayHeight - boardPx) / 2)

  return { cell, originX, originY, trayY: originY + boardPx + margin, trayHeight }
}

/** Convierte coordenadas de pantalla a celda del tablero. */
export function screenToCell(
  layout: Layout,
  px: number,
  py: number,
  boardSize: number,
): CellPos | null {
  const x = Math.floor((px - layout.originX) / layout.cell)
  const y = Math.floor((py - layout.originY) / layout.cell)
  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return null
  return { x, y }
}

/** Centro de una celda en px. */
export function cellCenter(layout: Layout, cell: CellPos): { x: number; y: number } {
  return {
    x: layout.originX + (cell.x + 0.5) * layout.cell,
    y: layout.originY + (cell.y + 0.5) * layout.cell,
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Dibuja un bloque.
 *
 * El degradado diagonal y el brillo interior le dan volumen sin necesidad de
 * sombras por celda, que serían 81 por frame.
 */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  tier: number,
  alpha = 1,
  scale = 1,
): void {
  const color = COLORS[tier] ?? COLORS[1]!
  const half = (size * scale) / 2
  const radius = size * 0.18

  ctx.save()
  ctx.globalAlpha = alpha

  const grad = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half)
  grad.addColorStop(0, color.fill)
  grad.addColorStop(1, color.edge)
  ctx.fillStyle = grad
  roundRect(ctx, cx - half, cy - half, half * 2, half * 2, radius)
  ctx.fill()

  ctx.globalAlpha = alpha * 0.3
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, cx - half + size * 0.11, cy - half + size * 0.09, half * 1.15, half * 0.46, radius * 0.6)
  ctx.fill()

  ctx.restore()
}

/**
 * Geometría de un slot de la bandeja.
 *
 * La calcula `render` para dibujar y `input` para hit-testear. Si cada uno usa
 * su propia fórmula, el click termina fuera del slot que se dibujó y la pieza
 * no se puede agarrar: por eso vive acá y ambos la comparten.
 */
export function slotMetrics(layout: Layout, trayCount: number) {
  const slotW = Math.min(92, layout.cell * 1.25)
  const slotSize = slotW * 0.8
  const totalW = trayCount * slotW
  return { slotW, slotSize, totalW, top: layout.trayY + 4 }
}

/** Centro del slot `i`, en px de layout (sin el offset del canvas). */
export function slotCenter(
  layout: Layout,
  trayCount: number,
  canvasW: number,
  i: number,
): { x: number; y: number } {
  const { slotW, slotSize, top } = slotMetrics(layout, trayCount)
  const startX = (canvasW - trayCount * slotW) / 2
  return { x: startX + i * slotW + slotW / 2, y: top + slotSize / 2 }
}

export function render(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  layout: Layout,
  board: Board,
  tray: Piece[],
  state: RenderState,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH)
  drawGrid(ctx, layout, board)
  drawBoardBlocks(ctx, layout, board)
  drawPreview(ctx, layout, state)
  drawGhost(ctx, layout, state)
  drawPops(ctx, layout, state)
  drawFloaters(ctx, layout, state)
  drawTray(ctx, canvasW, layout, tray, state)
  drawDragging(ctx, layout, state)
}

function drawGrid(ctx: CanvasRenderingContext2D, layout: Layout, board: Board): void {
  const px = layout.cell * board.width
  const py = layout.cell * board.height

  ctx.save()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
  roundRect(ctx, layout.originX - 6, layout.originY - 6, px + 12, py + 12, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Retícula tenue: ayuda a contar celdas sin distraer.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cx = layout.originX + (x + 0.5) * layout.cell
      const cy = layout.originY + (y + 0.5) * layout.cell
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(1.5, layout.cell * 0.035), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawBoardBlocks(ctx: CanvasRenderingContext2D, layout: Layout, board: Board): void {
  const size = layout.cell * 0.9
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const tier = board.at(x, y)
      if (tier === EMPTY) continue
      const c = cellCenter(layout, { x, y })
      drawBlock(ctx, c.x, c.y, size, tier)
    }
  }
}

/**
 * Resalta las celdas que se van a borrar al soltar.
 *
 * Con un anillo blanco y un relleno del color de la pieza. Como el color no
 * define la completitud, el anillo es uniforme: lo que se marca es "esta celda
 * se borra", no "este color suma".
 */
function drawPreview(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  if (!state.preview.length) return
  const size = layout.cell * 0.9

  for (const p of state.preview) {
    const c = cellCenter(layout, p.cell)
    const color = COLORS[p.tier] ?? COLORS[1]!
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = color.fill
    roundRect(ctx, c.x - size / 2, c.y - size / 2, size, size, size * 0.18)
    ctx.fill()
    ctx.globalAlpha = 0.95
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, layout.cell * 0.08)
    ctx.stroke()
    ctx.restore()
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  const g = state.ghost
  if (!g || !state.dragging.length) return
  const size = layout.cell * 0.9
  for (const d of state.dragging) {
    for (const c of d.piece.cells) {
      const target = cellCenter(layout, { x: g.x + c.x, y: g.y + c.y })
      // Verde si completa línea, apagado si no: la señal va en el color.
      const ok = state.preview.length > 0
      drawBlock(ctx, target.x, target.y, size, d.piece.tier, ok ? 0.5 : 0.22)
    }
  }
}

function drawPops(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  const size = layout.cell * 0.9
  for (const p of state.pops) {
    const k = p.t
    const scale = 1 + 0.5 * (1 - k) * (1 - k)
    const c = cellCenter(layout, p.cell)
    drawBlock(ctx, c.x, c.y, size, p.tier, k, scale)
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  if (!state.floaters.length) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.round(layout.cell * 0.44)}px ui-monospace, monospace`
  for (const f of state.floaters) {
    const c = cellCenter(layout, f.cell)
    const y = c.y - layout.cell * 0.7 * (1 - f.t)
    ctx.globalAlpha = f.t
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillText(f.text, c.x + 1, y + 1)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, c.x, y)
  }
  ctx.restore()
}

/**
 * Dibuja la bandeja.
 *
 * Cada pieza se dibuja con su forma real, no como un ícono: el jugador tiene
 * que ver la forma antes de arrastrar, que es información de juego.
 */
function drawTray(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  layout: Layout,
  tray: Piece[],
  state: RenderState,
): void {
  const { slotW, slotSize, top } = slotMetrics(layout, tray.length)

  for (let i = 0; i < tray.length; i++) {
    const piece = tray[i]!
    const used = state.usedPieceIds.has(piece.id)
    const slotX = (canvasW - tray.length * slotW) / 2 + i * slotW + slotW / 2

    ctx.save()
    ctx.globalAlpha = used ? 0.16 : 1
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    roundRect(ctx, slotX - slotSize / 2, top, slotSize, slotSize, 10)
    ctx.fill()

    if (!used) {
      const scale = Math.min((slotSize * 0.66) / piece.w, (slotSize * 0.66) / piece.h, 22)
      drawPieceShape(ctx, slotX, top + slotSize / 2, piece, scale)
    }
    ctx.restore()
  }
}

function drawPieceShape(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  piece: Piece,
  cellPx: number,
): void {
  const offsetX = -((piece.w - 1) * cellPx) / 2
  const offsetY = -((piece.h - 1) * cellPx) / 2
  const size = cellPx * 0.86
  for (const c of piece.cells) {
    drawBlock(ctx, originX + offsetX + c.x * cellPx, originY + offsetY + c.y * cellPx, size, piece.tier)
  }
}

function drawDragging(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  for (const d of state.dragging) {
    const scale = Math.min(layout.cell * 0.9, 30)
    drawPieceShape(ctx, d.dx, d.dy, d.piece, scale)
  }
}

/** Para el HUD: cuántas celdas hay libres, un dato útil de lectura. */
export function freeCells(board: Board): number {
  return board.width * board.height - board.occupied
}

export { TUNING }