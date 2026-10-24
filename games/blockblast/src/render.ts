import { EMPTY, type Board, type CellPos } from './board'
import { BOARD, COLORS } from './config'
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
  /**
   * Piezas que se están arrastrando, con el centro donde se dibujan.
   *
   * `dx`/`dy` ya viene encajado a la grilla cuando hay destino: la ficha que se
   * ve es exactamente la que va a caer, así que no puede discrepar de su sombra
   * ni del lugar donde termina.
   */
  dragging: Array<{ piece: Piece; dx: number; dy: number }>
  /** Casilla destino donde caería la pieza arrastrada. */
  ghost: CellPos | null
  /**
   * ¿Entra ahí?
   *
   * Se distingue de `preview`: entrar y completar línea son cosas distintas.
   */
  ghostValid: boolean
  /**
   * Celdas que se van a borrar si se suelta ahora, con su color.
   *
   * Es lo que convierte el juego de "colocar piezas" en "planear": sin esto
   * no hay forma de saber si la posición arma una línea antes de soltar.
   */
  preview: Array<{ cell: CellPos; tier: number }>
  /** Pop de línea completada. */
  pops: Array<{ cell: CellPos; tier: number; t: number }>
  /** Puntos flotantes. */
  floaters: Array<{ cell: CellPos; text: string; t: number; color: string }>
  /** Ids de piezas ya soltadas en este turno. */
  usedPieceIds: Set<number>
}

/**
 * Ancho que el HUD ocupa a la izquierda.
 *
 * El HUD vive en una columna fija sobre el canvas, así que el tablero no puede
 * seguir centrado en la ventana: si lo hiciera, las primeras columnas quedarían
 * debajo del cartel. Se descuenta esta franja del ancho disponible y el tablero
 * se centra en lo que queda.
 */
const HUD_GUTTER = 156

/** Por debajo de este ancho el HUD no entra al costado y pasa arriba. */
const SIDE_HUD_MIN_WIDTH = 720

/**
 * Alto que el HUD ocupa arriba cuando la pantalla es angosta.
 *
 * En ese modo el HUD vuelve arriba (ver la media query en style.css) y ocupa
 * una franja horizontal completa, así que el tablero tiene que arrancar más
 * abajo. Sin esto el cartel tapa las primeras filas.
 */
const HUD_TOP_GUTTER = 78

export function computeLayout(
  canvasW: number,
  canvasH: number,
  boardSize: number,
): Layout {
  const margin = 16
  const trayHeight = Math.min(130, Math.max(88, canvasH * 0.16))

  // En pantallas angostas no hay lugar para el HUD al costado: pasa arriba y el
  // tablero recupera el ancho, pero tiene que ceder el alto.
  const sideHud = canvasW >= SIDE_HUD_MIN_WIDTH
  const gutterX = sideHud ? HUD_GUTTER : 0
  const gutterY = sideHud ? 0 : HUD_TOP_GUTTER

  const availW = canvasW - gutterX - margin * 2
  const availH = canvasH - gutterY - trayHeight - margin * 3
  const cell = Math.floor(Math.min(availW, availH) / boardSize)

  const boardPx = cell * boardSize
  const originX = Math.round(gutterX + (availW - boardPx) / 2)
  const originY = Math.round(gutterY + (canvasH - gutterY - trayHeight - boardPx) / 2)

  return { cell, originX, originY, trayY: originY + boardPx + margin, trayHeight }
}

/** Centro de una celda en px. */
export function cellCenter(layout: Layout, cell: CellPos): { x: number; y: number } {
  return {
    x: layout.originX + (cell.x + 0.5) * layout.cell,
    y: layout.originY + (cell.y + 0.5) * layout.cell,
  }
}

/**
 * Lado del bloque dentro de su celda.
 *
 * Lo comparten el tablero y la ficha arrastrada: si cada uno usara el suyo, la
 * ficha cambiaría de tamaño al soltarla, justo en el momento en que se está
 * juzgando si cayó donde decía.
 */
function blockSize(layout: Layout): number {
  return layout.cell * 0.9
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
 * Degradado diagonal para el volumen, costura oscura para que dos bloques
 * contiguos no se lean como uno solo, y canto superior iluminado para el
 * relieve. Todo sin sombras por celda, que serían 64 por frame.
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

  ctx.strokeStyle = BOARD.blockSeam
  ctx.lineWidth = Math.max(1, size * 0.06)
  ctx.stroke()

  ctx.globalAlpha = alpha * 0.5
  ctx.fillStyle = color.hi
  roundRect(
    ctx,
    cx - half + size * 0.13,
    cy - half + size * 0.11,
    half * 1.08,
    half * 0.36,
    radius * 0.6,
  )
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

// ------------------------------------------------------------ capa estática

/**
 * Fondo, marco, grilla y placa de la bandeja cacheados en un canvas aparte.
 *
 * Es la parte que no cambia nunca mientras dure el layout, y el marco usa
 * `shadowBlur` más 64 casillas: redibujarlo en cada frame cuesta caro y no
 * aporta nada. Se regenera sólo cuando cambia el layout o el tamaño.
 */
let backdrop: HTMLCanvasElement | null = null
let backdropKey = ''

function getBackdrop(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  layout: Layout,
  board: Board,
  trayCount: number,
): HTMLCanvasElement {
  // El canvas está escalado por DPR; la capa se dibuja en las mismas unidades
  // para que el blit no la suavice.
  const dpr = ctx.getTransform().a || 1
  const key = [
    canvasW,
    canvasH,
    dpr,
    layout.originX,
    layout.originY,
    layout.cell,
    board.width,
    board.height,
    trayCount,
  ].join('|')
  if (backdrop && key === backdropKey) return backdrop

  const layer = backdrop ?? document.createElement('canvas')
  layer.width = Math.round(canvasW * dpr)
  layer.height = Math.round(canvasH * dpr)
  const bctx = layer.getContext('2d') as CanvasRenderingContext2D
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawBackdrop(bctx, canvasW, canvasH, layout, board, trayCount)

  backdrop = layer
  backdropKey = key
  return layer
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  layout: Layout,
  board: Board,
  trayCount: number,
): void {
  const px = layout.cell * board.width
  const py = layout.cell * board.height

  ctx.fillStyle = '#0e1018'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // Halo detrás del tablero: sin esto el marco flota sobre un fondo plano y el
  // límite del área de juego no se lee.
  const cx = layout.originX + px / 2
  const cy = layout.originY + py / 2
  const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(px, py) * 0.85)
  wash.addColorStop(0, BOARD.wash)
  wash.addColorStop(1, 'rgba(127, 212, 255, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, canvasW, canvasH)

  drawFrame(ctx, layout, px, py)
  drawWells(ctx, layout, board)
  drawTrayPlate(ctx, canvasW, layout, trayCount)
}

/** Marco del tablero: borde definido y halo, para que sea un objeto. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  px: number,
  py: number,
): void {
  const pad = Math.max(8, layout.cell * 0.16)
  const x = layout.originX - pad
  const y = layout.originY - pad
  const w = px + pad * 2
  const h = py + pad * 2
  const radius = Math.max(12, layout.cell * 0.32)

  ctx.save()
  ctx.shadowColor = BOARD.frameGlow
  ctx.shadowBlur = layout.cell * 0.8
  ctx.fillStyle = BOARD.frame
  roundRect(ctx, x, y, w, h, radius)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = BOARD.frameEdge
  ctx.lineWidth = 2
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, radius - 1)
  ctx.stroke()
  ctx.restore()
}

/**
 * Una casilla por celda.
 *
 * Es lo que reemplaza la retícula de puntos: con el borde de cada casilla se
 * cuentan filas y columnas de un vistazo y quedan claros los límites del
 * tablero, sobre todo en el borde, donde antes no había nada.
 */
function drawWells(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  board: Board,
): void {
  const inset = Math.max(1.5, layout.cell * 0.055)
  const size = layout.cell - inset * 2
  const radius = Math.max(3, layout.cell * 0.16)

  ctx.save()
  ctx.fillStyle = BOARD.well
  ctx.strokeStyle = BOARD.wellEdge
  // El borde es fino de verdad; engrosarlo en pantallas chicas se come la
  // casilla, así que acompaña el tamaño de celda.
  ctx.lineWidth = Math.max(1.5, layout.cell * 0.028)
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      roundRect(
        ctx,
        layout.originX + x * layout.cell + inset,
        layout.originY + y * layout.cell + inset,
        size,
        size,
        radius,
      )
      ctx.fill()
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Placa de la bandeja: agrupa las piezas del turno como una zona aparte. */
function drawTrayPlate(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  layout: Layout,
  trayCount: number,
): void {
  const { slotW, slotSize, top } = slotMetrics(layout, trayCount)
  const padX = slotW * 0.2
  const padY = slotSize * 0.14

  ctx.save()
  ctx.fillStyle = BOARD.trayPlate
  roundRect(ctx, (canvasW - trayCount * slotW) / 2 - padX, top - padY, trayCount * slotW + padX * 2, slotSize + padY * 2, 18)
  ctx.fill()
  ctx.strokeStyle = BOARD.trayEdge
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------- escena

export function render(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  layout: Layout,
  board: Board,
  tray: Piece[],
  state: RenderState,
): void {
  // La capa estática cubre todo el canvas, así que no hace falta limpiar.
  ctx.drawImage(getBackdrop(ctx, canvasW, canvasH, layout, board, tray.length), 0, 0, canvasW, canvasH)
  drawBoardBlocks(ctx, layout, board)
  drawPreview(ctx, layout, state)
  drawPops(ctx, layout, state)
  drawFloaters(ctx, layout, state)
  drawTray(ctx, canvasW, layout, tray, state)
  drawDragging(ctx, layout, state)
  // Último: el anillo de rechazo tiene que quedar por encima de la ficha, que
  // se dibuja justo en la celda que rechaza.
  drawInvalidTarget(ctx, layout, state)
}

function drawBoardBlocks(ctx: CanvasRenderingContext2D, layout: Layout, board: Board): void {
  const size = blockSize(layout)
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
 * Con un relleno del color de la pieza y un anillo blanco. Como el color no
 * define la completitud, el anillo es uniforme: lo que se marca es "esta celda
 * se borra", no "este color suma".
 */
function drawPreview(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  if (!state.preview.length) return
  const size = blockSize(layout)

  ctx.save()
  for (const p of state.preview) {
    const c = cellCenter(layout, p.cell)
    const color = COLORS[p.tier] ?? COLORS[1]!
    ctx.globalAlpha = 0.42
    ctx.fillStyle = color.fill
    ctx.shadowColor = color.glow
    ctx.shadowBlur = layout.cell * 0.5
    roundRect(ctx, c.x - size / 2, c.y - size / 2, size, size, size * 0.18)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, layout.cell * 0.09)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Marca el destino que no acepta la pieza.
 *
 * El destino válido no se dibuja aparte: la ficha levantada ya se dibuja
 * encajada justo ahí, así que una silueta debajo sería invisible y lo único
 * que podría hacer es discrepar. El rechazo sí necesita marca propia, porque
 * la ficha se ve igual que una ya colocada.
 */
function drawInvalidTarget(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  state: RenderState,
): void {
  const g = state.ghost
  if (!g || state.ghostValid || !state.dragging.length) return
  const size = blockSize(layout)
  const radius = size * 0.18

  ctx.save()
  ctx.setLineDash([Math.max(4, layout.cell * 0.22), Math.max(4, layout.cell * 0.16)])
  ctx.lineWidth = Math.max(2, layout.cell * 0.08)
  ctx.strokeStyle = BOARD.invalid
  for (const d of state.dragging) {
    for (const c of d.piece.cells) {
      const target = cellCenter(layout, { x: g.x + c.x, y: g.y + c.y })
      roundRect(ctx, target.x - size / 2, target.y - size / 2, size, size, radius)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawPops(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  const size = blockSize(layout)
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

    // La casilla se dibuja siempre con la misma intensidad: atenuarla junto con
    // la pieza dejaba el slot usado invisible, y no se distinguía "ya la puse"
    // de "no hay nada acá".
    ctx.save()
    ctx.fillStyle = BOARD.slot
    ctx.strokeStyle = BOARD.slotEdge
    ctx.lineWidth = 1
    roundRect(ctx, slotX - slotSize / 2, top, slotSize, slotSize, 12)
    ctx.fill()
    ctx.stroke()

    if (!used) {
      // En la bandeja el paso es más chico que una celda: la pieza tiene que
      // entrar en el slot, no medir como en el tablero.
      const pitch = Math.min((slotSize * 0.66) / piece.w, (slotSize * 0.66) / piece.h, 22)
      drawPieceShape(ctx, slotX, top + slotSize / 2, piece, pitch, pitch * 0.86)
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
  size: number,
  alpha = 1,
): void {
  const offsetX = -((piece.w - 1) * cellPx) / 2
  const offsetY = -((piece.h - 1) * cellPx) / 2
  for (const c of piece.cells) {
    drawBlock(
      ctx,
      originX + offsetX + c.x * cellPx,
      originY + offsetY + c.y * cellPx,
      size,
      piece.tier,
      alpha,
    )
  }
}

function drawDragging(ctx: CanvasRenderingContext2D, layout: Layout, state: RenderState): void {
  // Paso igual al de la celda y bloque igual al del tablero: con un paso menor
  // las celdas de la propia ficha se corrían de la grilla, y con un bloque más
  // chico la ficha parecía más chica que los bloques ya puestos.
  // Se apaga cuando el destino no la acepta, para que se vea el bloque de abajo.
  const alpha = state.ghost && !state.ghostValid ? 0.35 : 1
  for (const d of state.dragging) {
    drawPieceShape(ctx, d.dx, d.dy, d.piece, layout.cell, blockSize(layout), alpha)
  }
}
