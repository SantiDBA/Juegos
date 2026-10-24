import { Board, EMPTY, type CellPos, type FullLine } from './board'
import { COLORS, TUNING } from './config'
import { rollTray, type Piece } from './pieces'
import { targetForLevel } from './levels'
import { DragController } from './input'
import { Sfx } from './sfx'
import {
  computeLayout,
  render,
  type Layout,
  type RenderState,
} from './render'
import {
  createHud,
  readBest,
  readLevel,
  saveBest,
  saveLevel,
  type GameState,
} from './hud'

// ---------------------------------------------------------------- setup

const canvas = document.getElementById('board') as HTMLCanvasElement
const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D

const hud = createHud()
const sfx = new Sfx()

const boardSize = TUNING.boardSize
let layout: Layout = computeLayout(window.innerWidth, window.innerHeight, boardSize)

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  layout = computeLayout(w, h, boardSize)
  if (dragReady) {
    drag.setLayout(layout)
    drag.setWidth(w)
  }
}

/** Se pone en true cuando `drag` ya está construido. */
let dragReady = false

// ---------------------------------------------------------------- estado

let state: GameState = 'menu'
let board = new Board(boardSize)
let tray: Piece[] = []
/** Piezas ya soltadas en el turno en curso. */
let usedPieces = new Set<number>()

let score = 0
let level = readLevel()
let levelScore = 0
let moves = 0
let comboStreak = 0
let best = readBest()

let pops: RenderState['pops'] = []
let floaters: RenderState['floaters'] = []

let dragIndex: number | null = null
let dragPiece: Piece | null = null
let dragPx = 0
let dragPy = 0
let ghostCell: CellPos | null = null
/** ¿La pieza que se arrastra entra en `ghostCell`? */
let ghostValid = false
/** Líneas que se completarían al soltar ahora mismo. */
let preview: RenderState['preview'] = []

// ---------------------------------------------------------------- turnos

function newLevel(next: number): void {
  level = next
  // El tablero arranca vacío: es lo que hace que la primera decisión sea
  // dónde poner, no completar una línea que ya estaba a medio hacer.
  board = new Board(boardSize)
  tray = rollTray(Math.random)
  usedPieces = new Set()
  levelScore = 0
  moves = 0
  comboStreak = 0
  pops = []
  floaters = []
  preview = []
  dragIndex = null
  dragPiece = null
  ghostCell = null
  ghostValid = false
  hud.setLevel(level, targetForLevel(level))
  hud.setProgress(0)
  hud.setMoves(0)
  hud.setCombo(1)
  hud.setBestLine(0)
  hud.setScore(score, best)
}

/**
 * Suelta las piezas arrastradas en `cell`.
 *
 * A diferencia del merge, acá toda colocación válida consume turno: lo que
 * puntúa es completar la línea, no el colocar. El turno se Arma con todas las
 * piezas usadas y se pasa al board, que es la única fuente de verdad.
 */
function commitMove(cell: CellPos): void {
  const pieces = tray.filter((p) => usedPieces.has(p.id))
  if (!pieces.length) {
    cancelDrag()
    return
  }

  const shapes = pieces.map((p) => ({ tier: p.tier, cells: p.cells }))
  const result = board.place(shapes, cell)

  if (!result.valid) {
    usedPieces = new Set()
    sfx.invalid()
    hud.showToast('no entra ahí')
    cancelDrag()
    return
  }

  // Puntaje: celdas borradas y bonus por completar varias líneas a la vez.
  let gained = result.cleared * TUNING.pointsPerCell
  if (result.lines.length > 1) {
    gained += TUNING.multiLineBonus * (result.lines.length - 1)
    hud.showToast(`¡${result.lines.length} líneas!`)
  } else if (result.lines.length === 1) {
    hud.showToast('¡línea!')
  }

  // Combo: sólo sube completando línea. Colocar sin completar corta la racha.
  if (result.lines.length > 0) comboStreak++
  else comboStreak = 0
  const multiplier = comboMultiplier()
  gained = Math.round(gained * multiplier)

  // El sonido sigue el resultado del turno: soltar, limpiar o arrasar.
  if (result.lines.length > 1) sfx.multiLine(result.lines.length)
  else if (result.lines.length === 1) sfx.line(multiplier, result.bestLength)
  else sfx.place()

  score += gained
  levelScore += gained
  moves++

  // Animación: pop en el centro de la línea más larga, que es donde el ojo ya
  // está. El color es el de una pieza cualquiera: no significa nada.
  const anchor = anchorOfLines(result.lines)
  if (anchor) {
    pops.push({ cell: anchor, tier: pieces[0]?.tier ?? 1, t: 1 })
    floaters.push({
      cell: anchor,
      text: `+${gained}`,
      t: 1,
      color: COLORS[pieces[0]?.tier ?? 1]?.fill ?? '#ffffff',
    })
  }
  hud.setBestLine(result.bestLength)

  // Se repone sólo lo que se usó.
  const fresh = rollTray(Math.random)
  const pool = [...fresh]
  tray = tray.map((p) => (usedPieces.has(p.id) ? (pool.shift() ?? p) : p))
  usedPieces = new Set()

  hud.setScore(score, best)
  hud.setMoves(moves)
  hud.setCombo(multiplier)
  hud.setProgress(levelScore / targetForLevel(level))

  preview = []
  if (levelScore >= targetForLevel(level)) {
    completeLevel()
  } else if (!hasAnyPlacement()) {
    endGame()
  }
}

/** Celda representativa del turno, para ubicar el pop y el puntaje. */
function anchorOfLines(lines: FullLine[]): CellPos | null {
  if (!lines.length) return null
  // Se usa el centro de la línea más larga: es donde el ojo ya está.
  let best = lines[0]!
  for (const l of lines) if (l.cells.length > best.cells.length) best = l
  const mid = best.cells[Math.floor(best.cells.length / 2)]!
  return mid ? { x: mid.x, y: mid.y } : null
}

function comboMultiplier(): number {
  if (comboStreak === 0) return 1
  return Math.min(TUNING.comboMax, 1 + Math.floor(comboStreak / TUNING.comboStep))
}

/**
 * ¿Queda alguna jugada?
 *
 * Puramente geométrico: si ninguna de las 5 piezas cabe en ningún hueco del
 * tablero, no hay nada que hacer. No importa si completaría línea o no, porque
 * toda colocación válida consume turno.
 */
function hasAnyPlacement(): boolean {
  const usable = tray.filter((p) => !usedPieces.has(p.id))
  if (!usable.length) return true
  return usable.some((p) => board.placements(p.cells).length > 0)
}

function completeLevel(): void {
  state = 'levelclear'
  saveLevel(level + 1)
  sfx.levelClear()
  hud.setOverlayTitle(
    `nivel ${level} listo`,
    `${levelScore} puntos. A por el ${level + 1}.`,
    'Seguir',
  )
  hud.showOverlay(true)
}

function endGame(): void {
  state = 'gameover'
  hud.setOverlayTitle('se acabó', `Puntaje ${score}.`, 'Otra vez')
  hud.showOverlay(true)
  sfx.gameOver()
  if (saveBest(score)) {
    best = readBest()
    hud.flashBest()
    sfx.best()
  }
}

function startGame(): void {
  score = 0
  newLevel(1)
  state = 'playing'
  hud.showOverlay(false)
  hud.setHudVisible(true)
  hud.setScore(score, best)
}

// ---------------------------------------------------------------- drag

function beginDrag(index: number): void {
  const piece = tray[index]
  if (!piece) return
  dragIndex = index
  dragPiece = piece
  usedPieces.add(piece.id)
  sfx.grab()
}

/**
 * Recalcula la vista previa mientras se arrastra.
 *
 * Se hace sobre una copia del tablero: `place` muta, y durante el arrastre no
 * se quiere tocar el tablero real hasta que el jugador suelte.
 */
function updateDrag(px: number, py: number): void {
  ghostCell = dragTargetCell(px, py)
  ghostValid = ghostCell !== null && draggedPiecesFit(ghostCell)
  preview = ghostCell && ghostValid ? computePreview(ghostCell) : []

  // La ficha se dibuja encajada al destino, no siguiendo al puntero. Siguiendo
  // al puntero quedaba hasta dos celdas corrida de su sombra y del lugar donde
  // termina; encajada, ficha, sombra y destino son el mismo cálculo.
  const center =
    ghostCell && dragPiece ? snappedCenter(ghostCell, dragPiece) : { x: px, y: py }
  dragPx = center.x
  dragPy = center.y
}

/**
 * Celda donde caería la pieza arrastrada, ya encajada a la grilla.
 *
 * Es el inverso exacto de `snappedCenter`: se redondea el centro de la pieza a
 * la celda más cercana y de ahí sale la celda del extremo. Se ancla por el
 * centro y no por el extremo para que el resultado no dependa de cuál celda de
 * la pieza agarró el jugador.
 *
 * Devuelve null si, encajada así, la pieza no entraría entera en el tablero.
 */
function dragTargetCell(px: number, py: number): CellPos | null {
  const piece = dragPiece
  if (!piece) return null
  const x = Math.round((px - layout.originX) / layout.cell - piece.w / 2)
  const y = Math.round((py - layout.originY) / layout.cell - piece.h / 2)
  if (x < 0 || y < 0 || x + piece.w > boardSize || y + piece.h > boardSize) return null
  return { x, y }
}

/** Centro en px donde se dibuja la pieza apoyada en `cell`. */
function snappedCenter(cell: CellPos, piece: Piece): { x: number; y: number } {
  return {
    x: layout.originX + (cell.x + piece.w / 2) * layout.cell,
    y: layout.originY + (cell.y + piece.h / 2) * layout.cell,
  }
}

/**
 * ¿El puntero está sobre el área de juego?
 *
 * Se usa sólo para decidir si vale avisar del rechazo: soltar en cualquier lado
 * fuera del tablero no es un error, es dejarlo estar.
 */
function overBoard(px: number, py: number): boolean {
  const size = layout.cell * boardSize
  return (
    px >= layout.originX &&
    px <= layout.originX + size &&
    py >= layout.originY &&
    py <= layout.originY + size
  )
}

/** ¿Todo lo que se arrastra entra en `cell` sin pisar una celda ocupada? */
function draggedPiecesFit(cell: CellPos): boolean {
  return tray
    .filter((p) => usedPieces.has(p.id))
    .every((p) => board.fits(p.cells, cell.x, cell.y))
}

/** Celdas que se borrarían al soltar en `cell`. */
function computePreview(cell: CellPos): RenderState['preview'] {
  const pieces = tray.filter((p) => usedPieces.has(p.id))
  if (!pieces.length) return []

  const probe = board.clone()
  for (const p of pieces) {
    for (const c of p.cells) {
      const px = cell.x + c.x
      const py = cell.y + c.y
      if (px < 0 || py < 0 || px >= boardSize || py >= boardSize) return []
      if (probe.at(px, py) !== EMPTY) return []
      probe.set(px, py, p.tier)
    }
  }

  // Una celda que cruza una fila y una columna se marca una sola vez.
  const seen = new Set<string>()
  const out: RenderState['preview'] = []
  for (const line of probe.findFullLines()) {
    for (const c of line.cells) {
      const key = `${c.x},${c.y}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ cell: c, tier: pieces[0]?.tier ?? 1 })
    }
  }
  return out
}

function cancelDrag(): void {
  if (dragIndex !== null) {
    const piece = tray[dragIndex]
    if (piece) usedPieces.delete(piece.id)
  }
  dragIndex = null
  dragPiece = null
  ghostCell = null
  ghostValid = false
  preview = []
}

/**
 * Cierra el arrastre sin colocar.
 *
 * Reevalúa el bloqueo: una partida trabada con el jugador arrastrando
 * posiciones inválidas se quedaba congelada en silencio.
 */
function abortDrag(): void {
  cancelDrag()
  if (state === 'playing' && levelScore < targetForLevel(level) && !hasAnyPlacement()) {
    endGame()
  }
}

const drag = new DragController(canvas, layout, {
  onDragStart: beginDrag,
  onDragMove: updateDrag,
  onDragEnd: (px, py) => {
    const target = dragIndex === null ? null : dragTargetCell(px, py)
    if (target && draggedPiecesFit(target)) {
      dragIndex = null
      dragPiece = null
      ghostCell = null
      ghostValid = false
      commitMove(target)
      return
    }
    // Apuntó al tablero sin que la pieza entre: se avisa y vuelve a la bandeja.
    if (dragIndex !== null && (target || overBoard(px, py))) sfx.invalid()
    abortDrag()
  },
  onDragCancel: abortDrag,
})
resize()
drag.setWidth(window.innerWidth)
dragReady = true
drag.attach()

// ---------------------------------------------------------------- loop

let last = performance.now()

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now

  const popDecay = dt / TUNING.popDuration
  pops = pops.filter((p) => {
    p.t -= popDecay
    return p.t > 0
  })
  const floatDecay = dt / (TUNING.popDuration * 2)
  floaters = floaters.filter((f) => {
    f.t -= floatDecay
    return f.t > 0
  })

  drag.setTray(tray)

  const renderState: RenderState = {
    dragging:
      dragPiece && dragIndex !== null ? [{ piece: dragPiece, dx: dragPx, dy: dragPy }] : [],
    ghost: ghostCell,
    ghostValid,
    preview,
    pops,
    floaters,
    usedPieceIds: usedPieces,
  }

  render(ctx, window.innerWidth, window.innerHeight, layout, board, tray, renderState)
  requestAnimationFrame(frame)
}

window.addEventListener('resize', resize)

/*
 * El audio sólo puede arrancar dentro de un gesto del usuario. El botón de
 * jugar lo cubre, pero también se puede empezar arrastrando una pieza: por eso
 * el primer pointerdown en cualquier lado también desbloquea.
 */
window.addEventListener('pointerdown', () => sfx.unlock(), { once: true })

hud.onSoundToggle((muted) => {
  sfx.setMuted(muted)
  hud.showToast(muted ? 'sonido apagado' : 'sonido encendido', 1000)
})

window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyM') return
  sfx.setMuted(!sfx.muted)
  hud.setSoundMuted(sfx.muted)
  hud.showToast(sfx.muted ? 'sonido apagado' : 'sonido encendido', 1000)
})

hud.onPlay(() => {
  sfx.unlock()
  if (state === 'levelclear') {
    newLevel(level + 1)
    state = 'playing'
    hud.showOverlay(false)
    hud.setScore(score, best)
    return
  }
  startGame()
})

// ---------------------------------------------------------------- arranque

newLevel(level)
hud.setOverlayTitle(
  'blockblast',
  'Completá una fila o columna entera. El color no importa.',
  'Jugar',
)
hud.showOverlay(true)
hud.setHudVisible(false)
requestAnimationFrame(frame)