import { Board, EMPTY, type CellPos } from './board'
import { TIER_COLORS } from './config'
import type { Piece } from './pieces'

/**
 * Dibujo en Canvas 2D.
 *
 * Todo el render pasa por acá y no guarda estado: recibe el tablero y las
 * piezas y dibuja. Las animaciones viven en `main`, que es quien decide
 *Cuándo mover el tablero de verdad; el renderer sólo interpola.
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
  /** Piezas que se están arrastrando, con su desplazamiento en px. */
  dragging: Array<{ piece: Piece; dx: number; dy: number }>
  /** Casilla destino donde caerían las piezas arrastradas. */
  ghost: CellPos | null
  /** true si la posición actual del ghost es válida. */
  ghostValid: boolean
  /** Pop de fusión: celda, tier y progreso 0..1. */
  pops: Array<{ cell: CellPos; tier: number; t: number }>
  /** Puntos flotantes de puntaje. */
  floaters: Array<{ cell: CellPos; text: string; t: number; color: string }>
  /** Bloque ya usado en este turno (se muestra desvanecido). */
  usedPieceIds: Set<number>
}

/** Calcula el layout según el tamaño del canvas. */
export function computeLayout(
  canvasW: number,
  canvasH: number,
  boardSize: number,
): Layout {
  const margin = 18
  const trayHeight = Math.min(150, Math.max(96, canvasH * 0.18))
  // El tablero ocupa el alto disponible menos la bandeja y los márgenes.
  const availH = canvasH - trayHeight - margin * 3
  const availW = canvasW - margin * 2
  const cell = Math.floor(Math.min(availW, availH) / boardSize)

  const boardPx = cell * boardSize
  const originX = Math.round((canvasW - boardPx) / 2)
  // Se deja aire arriba para el HUD.
  const originY = Math.round((canvasH - trayHeight - boardPx) / 2)

  return {
    cell,
    originX,
    originY,
    trayY: originY + boardPx + margin,
    trayHeight,
  }
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

/**
 * Dibuja un bloque.
 *
 * `size` es el lado en px. El relleno va con un degradado radial suave y un
 * borde más oscuro: es lo que da la sensación de pieza física sin necesidad de
 * sombras por celda, que serían 64 sombras por frame.
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
  const color = TIER_COLORS[tier] ?? TIER_COLORS[1]!
  const half = (size * scale) / 2
  const radius = size * 0.16

  ctx.save()
  ctx.globalAlpha = alpha

  // Degradado: luz arriba-izquierda, sombra abajo-derecha.
  const grad = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half)
  grad.addColorStop(0, color.fill)
  grad.addColorStop(1, color.edge)
  ctx.fillStyle = grad

  roundRect(ctx, cx - half, cy - half, half * 2, half * 2, radius)
  ctx.fill()

  // Brillo interior: da volumen sin necesidad de un segundo shadow pass.
  ctx.globalAlpha = alpha * 0.35
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, cx - half + size * 0.1, cy - half + size * 0.08, half * 1.2, half * 0.5, radius * 0.6)
  ctx.fill()

  ctx.restore()
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
  drawGhost(ctx, layout, state)
  drawPops(ctx, layout, state)
  drawFloaters(ctx, layout, state)
  drawTray(ctx, canvasW, layout, tray, state)
  drawDragging(ctx, layout, tray, state)
}

function drawGrid(ctx: CanvasRenderingContext2D, layout: Layout, board: Board): void {
  const px = layout.cell * board.width

  // Fondo del tablero: un panel redondeado, para separar la zona de juego del
  // fondo de la página sin necesidad de un borde por celda.
  ctx.save()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
  roundRect(ctx, layout.originX - 6, layout.originY - 6, px + 12, px + 12, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Puntos de retícula muy tenues: ayudan a leer la distancia sin distraer.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)'
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.at(x, y) !== EMPTY) continue
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
  const size = layout.cell * 0.92
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const tier = board.at(x, y)
      if (tier === EMPTY) continue
      const c = cellCenter(layout, { x, y })
      drawBlock(ctx, c.x, c.y, size, tier)
    }
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  const g = state.ghost
  if (!g || !state.dragging.length) return
  const size = layout.cell * 0.92
  // Se dibuja la silueta de las piezas arrastradas en la celda destino, con
  // alpha baja: comunica si la posición es válida sin tapar el tablero.
  for (const d of state.dragging) {
    for (const c of d.piece.cells) {
      const target = cellCenter(layout, { x: g.x + c.x, y: g.y + c.y })
      drawBlock(ctx, target.x, target.y, size, d.piece.tier, state.ghostValid ? 0.42 : 0.16)
    }
  }
}

function drawPops(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  const size = layout.cell * 0.92
  for (const p of state.pops) {
    // El pop va de 1.35 a 1: crece y se apaga. Va por encima del tablero.
    const k = p.t
    const scale = 1 + 0.35 * (1 - k) * (1 - k)
    const alpha = k
    const c = cellCenter(layout, p.cell)
    drawBlock(ctx, c.x, c.y, size, p.tier, alpha, scale)
  }
}

function drawFloaters(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  state: RenderState,
): void {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(layout.cell * 0.42)}px ui-monospace, monospace`
  for (const f of state.floaters) {
    const c = cellCenter(layout, f.cell)
    // Sube mientras se desvanece.
    const y = c.y - layout.cell * 0.5 * (1 - f.t)
    ctx.globalAlpha = f.t
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillText(f.text, c.x + 1, y + 1)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, c.x, y)
  }
  ctx.restore()
}

/**
 * Dibuja la bandeja de piezas.
 *
 * Cada pieza se dibuja con su forma real (1x1, 2x3, etc.), no como un ícono:
 * el jugador tiene que ver la forma antes de arrastrar, que es información de
 * juego, no decoración.
 */
function drawTray(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  layout: Layout,
  tray: Piece[],
  state: RenderState,
): void {
  const slotW = Math.min(110, layout.cell * 1.5)
  const totalW = tray.length * slotW
  const startX = (canvasW - totalW) / 2

  for (let i = 0; i < tray.length; i++) {
    const piece = tray[i]!
    const used = state.usedPieceIds.has(piece.id)
    // Las piezas ya soltadas en este turno se atenúan: el jugador ve qué usó.
    const slotX = startX + i * slotW + slotW / 2

    ctx.save()
    ctx.globalAlpha = used ? 0.18 : 1

    // Recipiente de la ranura.
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    const slotSize = slotW * 0.78
    roundRect(ctx, slotX - slotSize / 2, layout.trayY + 6, slotSize, slotSize, 10)
    ctx.fill()

    if (!used) {
      const scale = Math.min((slotSize * 0.62) / piece.w, (slotSize * 0.62) / piece.h, 26)
      drawPieceShape(ctx, slotX, layout.trayY + 6 + slotSize / 2, piece, scale)
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
  // La forma se centra en el slot, no desde su esquina.
  const offsetX = -((piece.w - 1) * cellPx) / 2
  const offsetY = -((piece.h - 1) * cellPx) / 2
  const size = cellPx * 0.86
  for (const c of piece.cells) {
    drawBlock(ctx, originX + offsetX + c.x * cellPx, originY + offsetY + c.y * cellPx, size, piece.tier)
  }
}

/** Dibuja las piezas en movimiento, encima de todo. */
function drawDragging(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  tray: Piece[],
  state: RenderState,
): void {
  for (const d of state.dragging) {
    // La pieza arrastrada crece un poco: da la sensación de "levantada".
    const scale = Math.min(layout.cell * 0.9, 34)
    drawPieceShape(ctx, d.dx, d.dy, d.piece, scale)
  }
  void tray
}