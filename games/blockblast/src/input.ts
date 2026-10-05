import type { CellPos } from './board'
import type { Piece } from './pieces'
import { screenToCell, type Layout } from './render'

/**
 * Arrastre de piezas con Pointer Events.
 *
 * Se usa Pointer Events y no eventos de mouse porque es lo que permite el
 * mismo código en mouse y en touch (y stylus). La captura del puntero evita
 * que al arrastrar rápido hacia el borde de la ventana el soltar se pierda.
 */

export interface DragState {
  /** Índice de la pieza que se está arrastrando. */
  index: number
  piece: Piece
  /** Posición del puntero en px. */
  px: number
  py: number
}

export interface DragCallbacks {
  /** Cambió el estado del arrastre (empezó, se movió o terminó). */
  onDragStart(index: number): void
  onDragMove(px: number, py: number): void
  /** Se soltó la pieza. `cell` es la celda destino o null si fue fuera. */
  onDragEnd(cell: CellPos | null): void
}

export class DragController {
  private drag: DragState | null = null
  private activePointer: number | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private layout: Layout,
    private readonly boardSize: number,
    private readonly callbacks: DragCallbacks,
  ) {}

  get current(): DragState | null {
    return this.drag
  }

  get isDragging(): boolean {
    return this.drag !== null
  }

  /** Conecta los listeners. Devuelve una función para desconectar. */
  attach(): () => void {
    const down = (e: PointerEvent) => this.onDown(e)
    const move = (e: PointerEvent) => this.onMove(e)
    const up = (e: PointerEvent) => this.onUp(e)
    const cancel = (e: PointerEvent) => this.onCancel(e)

    this.canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)

    return () => {
      this.canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }

  /** Se llama cuando el layout cambia (resize). */
  setLayout(layout: Layout): void {
    this.layout = layout
  }

  private onDown(e: PointerEvent): void {
    // Un dedo a la vez: con multitouch, dos punteros compitiendo por el mismo
    // estado de arrastre producen piezas pegadas al lugar equivocado.
    if (this.activePointer !== null) return
    const index = this.hitPiece(e)
    if (index === null) return

    this.activePointer = e.pointerId
    const piece = this.pieceAt(index)
    if (!piece) return

    this.drag = { index, piece, px: e.clientX, py: e.clientY }
    // Captura: sigue recibiendo eventos aunque el puntero salga del canvas.
    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      // Algunos navegadores lo rechazan en pointer sintético; no es crítico.
    }
    e.preventDefault()
    this.callbacks.onDragStart(index)
  }

  private onMove(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.activePointer) return
    this.drag.px = e.clientX
    this.drag.py = e.clientY
    e.preventDefault()
    this.callbacks.onDragMove(e.clientX, e.clientY)
  }

  private onUp(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.activePointer) return
    const cell = screenToCell(this.layout, e.clientX, e.clientY, this.boardSize)
    this.finish()
    this.callbacks.onDragEnd(cell)
  }

  private onCancel(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return
    // Cancelar (ej: el navegador tomó el gesto) no cuenta como soltar.
    this.finish()
    this.callbacks.onDragEnd(null)
  }

  private finish(): void {
    if (this.activePointer !== null) {
      try {
        this.canvas.releasePointerCapture(this.activePointer)
      } catch {
        // ver onDown
      }
    }
    this.activePointer = null
    this.drag = null
  }

  /** Las piezas se pasan por setter para no capturarlas al construir. */
  private tray: Piece[] = []
  setTray(tray: Piece[]): void {
    this.tray = tray
  }

  private pieceAt(index: number): Piece | null {
    return this.tray[index] ?? null
  }

  /**
   * Qué pieza está bajo el punto.
   *
   * La bandeja se recorre de izquierda a derecha y se prueba celda por celda:
   * es lo que hace que al arrastrar una pieza grande por encima de una chica
   * se seleccione la grande, que es lo que el jugador espera.
   */
  private hitPiece(e: PointerEvent): number | null {
    const rect = this.canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    const slotW = Math.min(110, this.layout.cell * 1.5)
    const totalW = this.tray.length * slotW
    const startX = (this.rect.width - totalW) / 2

    for (let i = 0; i < this.tray.length; i++) {
      const slotX = startX + i * slotW + slotW / 2
      const slotSize = slotW * 0.78
      const slotTop = this.layout.trayY + 6
      if (
        px >= slotX - slotSize / 2 &&
        px <= slotX + slotSize / 2 &&
        py >= slotTop &&
        py <= slotTop + slotSize
      ) {
        return i
      }
    }
    return null
  }

  /** Ancho del canvas en px de layout, para el cálculo de slots. */
  private rect = { width: 0 }
  setWidth(width: number): void {
    this.rect = { width }
  }
}