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
  // El HUD se mide antes de calcular: en móvil su alto real (dos filas) define
  // dónde empieza el tablero. Con la constante fija el cartel se montaba sobre la
  // primera fila del tablero en pantallas bajas.
  layout = computeLayout(w, h, boardSize, hud.bottomPx())
  // El HUD se pega al tablero en escritorio; en móvil `hudX` es null y vuelve al CSS.
  hud.setOffsetLeft(layout.hudX)
  if (dragReady) drag.setLayout(layout)
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
/** Líneas completadas en la partida, para el resumen del panel final. */
let linesTotal = 0
let comboStreak = 0
let best = readBest()

/**
 * Estado previo a la última colocación, para deshacer un paso.
 *
 * El juego no tenía ninguna forma de revertir: una pieza mal puesta (o un
 * tablero que se traba) era definitivo. Guardar un solo paso alcanza para cubrir
 * el error humano sin volver el juego trivial.
 */
interface UndoSnapshot {
  cells: Uint8Array
  score: number
  levelScore: number
  linesTotal: number
  moves: number
  comboStreak: number
  tray: Piece[]
  used: Set<number>
  state: GameState
}

let undoSnapshot: UndoSnapshot | null = null
/** ¿El tablero ya estaba avisado como trabado? Evita repetir el toast. */
let wasTight = false

let pops: RenderState['pops'] = []
let settles: RenderState['settles'] = []
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

/**
 * Juego por teclado: índice de la pieza elegida y cursor sobre la grilla.
 *
 * Es la ruta alternativa al arrastre, para quien no puede usar puntero. Se
 * elige la pieza con los números y el cursor se mueve con las flechas.
 */
let kbIndex: number | null = null
let cursor: CellPos = { x: 0, y: 0 }

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
  settles = []
  floaters = []
  preview = []
  dragIndex = null
  dragPiece = null
  ghostCell = null
  ghostValid = false
  kbIndex = null
  cursor = { x: 0, y: 0 }
  undoSnapshot = null
  hud.setUndoEnabled(false)
  wasTight = false
  hud.setDanger(false)
  hud.setLevel(level, targetForLevel(level))
  hud.setProgress(0)
  hud.setMoves(0)
  hud.setCombo(1)
  hud.setBestLine(0)
  hud.setScore(score, best)
}

/**
 * Suelta una pieza en `cell` y resuelve el turno.
 *
 * Cada colocación válida consume una pieza de la mano. La mano se repone entera
 * recién cuando no queda ninguna sin usar: mientras haya piezas se sigue jugando
 * con las que quedan, y eso es lo que hace que la bandeja se vacíe y la decisión
 * de en qué orden soltarlas importe.
 */
function commitMove(piece: Piece, cell: CellPos): void {
  // Se captura ANTES de tocar el tablero: es el punto al que vuelve `undo`.
  const before: UndoSnapshot = {
    cells: board.cells.slice(),
    score,
    levelScore,
    linesTotal,
    moves,
    comboStreak,
    tray: [...tray],
    used: new Set(usedPieces),
    state,
  }

  const result = board.place([{ tier: piece.tier, cells: piece.cells }], cell)

  if (!result.valid) {
    // Defensivo: ambos llamadores ya verifican `pieceFits`, así que no hay
    // feedback acá. El rechazo real (sonido + anillo) lo da el llamador.
    return
  }

  undoSnapshot = before
  hud.setUndoEnabled(true)

  usedPieces.add(piece.id)

  // Puntaje: lo que se borra paga, y además cada bloque colocado acusa recibo.
  let gained = result.cleared * TUNING.pointsPerCell + result.placed * TUNING.pointsPerBlock
  if (result.lines.length > 1) {
    gained += TUNING.multiLineBonus * (result.lines.length - 1)
    hud.showToast(`¡${result.lines.length} líneas!`)
  }
  // La línea simple no avisa por toast: el pop, el flotante y el sonido ya la
  // cuentan. Con un toast en cada línea, el aviso se volvía papel de pared.

  // Combo: sólo sube completando línea. Colocar sin completar corta la racha.
  if (result.lines.length > 0) comboStreak++
  else comboStreak = 0
  linesTotal += result.lines.length
  const multiplier = comboMultiplier()
  gained = Math.round(gained * multiplier)

  // Mano vaciada: se repone completa y paga un bonus. Es el ritmo del género.
  const handCleared = tray.every((p) => usedPieces.has(p.id))
  if (handCleared) gained += TUNING.trayClearBonus

  // El sonido sigue el resultado del turno: vaciar la mano, limpiar o soltar.
  if (handCleared) sfx.trayClear()
  else if (result.lines.length > 1) sfx.multiLine(result.lines.length)
  else if (result.lines.length === 1) sfx.line(multiplier, result.bestLength)
  else sfx.place()

  score += gained
  levelScore += gained
  moves++

  // Asentado: cada bloque que aterrizó y sobrevivió al turno entra creciendo. Es
  // el acuse de recibo de la colocación, haya limpiado línea o no. Las celdas que
  // la línea se llevó no se asientan: animarlas dejaría un bloque fantasma.
  // Es movimiento decorativo, así que se apaga con `prefers-reduced-motion`; el
  // puntaje (el flotante) sale igual, porque ese feedback sí importa.
  if (!reduceMotion) {
    for (const c of piece.cells) {
      const x = cell.x + c.x
      const y = cell.y + c.y
      if (board.at(x, y) === EMPTY) continue
      settles.push({ cell: { x, y }, tier: piece.tier, t: 1 })
    }
  }

  // Animación: el pop es de la línea, pero el flotante sale siempre — en la línea
  // si la hubo, y en el centro de la pieza si no. Antes, colocar sin completar no
  // dejaba ningún rastro y el turno se leía como si no hubiera pasado nada.
  const anchor = anchorOfLines(result.lines) ?? placeAnchor(piece, cell)
  if (!reduceMotion && result.lines.length > 0) {
    pops.push({ cell: anchor, tier: piece.tier, t: 1 })
  }
  floaters.push({
    cell: anchor,
    text: `+${gained}`,
    t: 1,
    color: COLORS[piece.tier]?.fill ?? '#ffffff',
  })
  hud.setBestLine(result.bestLength)

  if (handCleared) {
    hud.showToast(`¡mano completa! +${TUNING.trayClearBonus}`, 1200)
    tray = rollTray(Math.random)
    usedPieces = new Set()
  }

  hud.setScore(score, best)
  hud.setMoves(moves)
  hud.setCombo(multiplier)
  hud.setProgress(levelScore / targetForLevel(level))

  preview = []
  if (levelScore >= targetForLevel(level)) {
    completeLevel()
  } else if (!hasAnyPlacement()) {
    endGame()
  } else {
    updateDanger()
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

/**
 * Celda central del bloque colocado, para anclar el flotante cuando no hubo línea.
 *
 * Se toma el centro de la caja que ocupan las celdas puestas: el número flota
 * donde está la pieza que acaba de aterrizar, no en un borde cualquiera.
 */
function placeAnchor(piece: Piece, origin: CellPos): CellPos {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of piece.cells) {
    const x = origin.x + c.x
    const y = origin.y + c.y
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return { x: Math.round((minX + maxX) / 2), y: Math.round((minY + maxY) / 2) }
}

function comboMultiplier(): number {
  if (comboStreak === 0) return 1
  return Math.min(TUNING.comboMax, 1 + Math.floor(comboStreak / TUNING.comboStep))
}

/**
 * ¿Queda alguna jugada?
 *
 * Puramente geométrico: si ninguna pieza que queda en la mano cabe en ningún
 * hueco del tablero, no hay nada que hacer. No importa si completaría línea o
 * no, porque toda colocación válida consume una pieza.
 */
function hasAnyPlacement(): boolean {
  const usable = tray.filter((p) => !usedPieces.has(p.id))
  if (!usable.length) return true
  return usable.some((p) => board.placements(p.cells).length > 0)
}

/**
 * Avisa cuando el tablero está por trabarse.
 *
 * Si a alguna pieza que queda en la mano le quedan dos o menos posiciones, el
 * panel pulsa y sale un aviso una sola vez. Antes la partida terminaba sin
 * ninguna señal previa.
 */
function updateDanger(): void {
  let tight = false
  if (state === 'playing') {
    for (const p of tray) {
      if (usedPieces.has(p.id)) continue
      const n = board.placements(p.cells).length
      if (n > 0 && n <= 2) {
        tight = true
        break
      }
    }
  }
  hud.setDanger(tight)
  if (tight && !wasTight) hud.showToast('¡ojo, queda poco lugar!', 1200)
  wasTight = tight
}

/** Nombre de la primera pieza que quedó sin ningún lugar, o null. */
function blockingPieceLabel(): string | null {
  for (const p of tray) {
    if (usedPieces.has(p.id)) continue
    if (board.placements(p.cells).length === 0) return p.label
  }
  return null
}

/**
 * Deshace la última colocación.
 *
 * Restaura tablero, puntaje, racha, mano y el estado de la partida: si el último
 * movimiento la había terminado, se reanuda. No revierte el récord guardado —ese
 * número ya quedó escrito y deshacerlo no aporta.
 */
function undo(): void {
  const s = undoSnapshot
  if (!s) return

  board.cells.set(s.cells)
  score = s.score
  levelScore = s.levelScore
  linesTotal = s.linesTotal
  moves = s.moves
  comboStreak = s.comboStreak
  tray = [...s.tray]
  usedPieces = new Set(s.used)
  undoSnapshot = null
  hud.setUndoEnabled(false)

  pops = []
  settles = []
  floaters = []
  preview = []
  kbIndex = null
  ghostCell = null
  ghostValid = false
  cancelDrag()

  if (state !== s.state) {
    state = s.state
    if (state === 'playing') {
      hud.showOverlay(false)
      hud.setHudVisible(true)
    }
  }

  hud.setScore(score, best)
  hud.setMoves(moves)
  hud.setLevel(level, targetForLevel(level))
  hud.setProgress(levelScore / targetForLevel(level))
  hud.setCombo(comboMultiplier())
  wasTight = false
  updateDanger()
  sfx.grab()
  hud.showToast('deshecho', 900)
}

function completeLevel(): void {
  state = 'levelclear'
  hud.setDanger(false)
  saveLevel(level + 1)
  sfx.levelClear()
  hud.setOverlayTitle(
    `nivel ${level} listo`,
    // "total" explícito: el HUD también muestra un número de puntos y sin la
    // etiqueta parecían dos puntajes contradictorios.
    `total ${score} · meta ${targetForLevel(level)}`,
    'Seguir',
    `${levelScore} pts`,
  )
  hud.showOverlay(true)
}

function endGame(): void {
  state = 'gameover'
  hud.setDanger(false)
  // `saveBest` se llama una sola vez: devuelve si hubo récord y deja el número
  // guardado. Leerlo antes de actualizar `best` distingue "récord nuevo" de
  // "récord vigente".
  const isRecord = saveBest(score)
  if (isRecord) best = readBest()

  const blocking = blockingPieceLabel()
  const bits = [
    blocking ? `no entraba ${blocking}` : 'no entraba ninguna pieza',
    `${linesTotal} ${linesTotal === 1 ? 'línea' : 'líneas'}`,
    isRecord ? 'nuevo récord' : best !== null ? `récord ${best}` : '',
  ]
  hud.setOverlayTitle('se acabó', bits.filter(Boolean).join(' · '), 'Otra vez', `${score} pts`)
  hud.showOverlay(true)
  sfx.gameOver()
  if (isRecord) {
    // La celebración va en el panel: en el HUD quedaba debajo del velo.
    hud.flashResult()
    sfx.best()
  }
}

/** Arranca una partida desde el nivel indicado (1 = de cero). */
function startGame(fromLevel: number): void {
  score = 0
  linesTotal = 0
  newLevel(fromLevel)
  state = 'playing'
  hud.showOverlay(false)
  hud.setHudVisible(true)
  hud.setScore(score, best)
}

// ---------------------------------------------------------------- drag

function beginDrag(index: number, px: number, py: number): void {
  const piece = tray[index]
  if (!piece) return
  // El arrastre manda: si había una pieza elegida por teclado, se suelta.
  kbIndex = null
  dragIndex = index
  dragPiece = piece
  usedPieces.add(piece.id)
  sfx.grab()
  // Se posiciona la ficha ya en este frame: sin esto quedaba en (0,0) hasta el
  // primer movimiento y se veía un frame de la pieza saltando a la esquina.
  updateDrag(px, py)
}

/**
 * Recalcula la vista previa mientras se arrastra.
 *
 * Se hace sobre una copia del tablero: `place` muta, y durante el arrastre no
 * se quiere tocar el tablero real hasta que el jugador suelte.
 */
function updateDrag(px: number, py: number): void {
  const piece = dragPiece
  ghostCell = dragTargetCell(px, py)
  ghostValid = piece !== null && ghostCell !== null && pieceFits(piece, ghostCell)
  preview = piece && ghostCell && ghostValid ? computePreview(piece, ghostCell) : []

  // La ficha se dibuja encajada al destino, no siguiendo al puntero. Siguiendo
  // al puntero quedaba hasta dos celdas corrida de su sombra y del lugar donde
  // termina; encajada, ficha, sombra y destino son el mismo cálculo.
  const center =
    ghostCell && dragPiece ? snappedCenter(ghostCell, dragPiece) : { x: px, y: py }
  dragPx = center.x
  dragPy = center.y
}

/**
 * En pantallas táctiles la ficha se dibuja encajada al destino, así que el dedo
 * tapa justo la celda donde va a caer. Se corre el punto de referencia hacia
 * arriba para que el destino quede por encima del dedo. Con mouse no aplica.
 */
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches

/** Movimiento reducido: se lee una vez; el juego no cambia de preferencia en vivo. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function pointerLift(): number {
  return isCoarsePointer ? layout.cell * 1.2 : 0
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
  const y = Math.round((py - pointerLift() - layout.originY) / layout.cell - piece.h / 2)
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
  const ly = py - pointerLift()
  return (
    px >= layout.originX &&
    px <= layout.originX + size &&
    ly >= layout.originY &&
    ly <= layout.originY + size
  )
}

/** ¿La pieza entra en `cell` sin pisar una celda ocupada? */
function pieceFits(piece: Piece, cell: CellPos): boolean {
  return board.fits(piece.cells, cell.x, cell.y)
}

/** Celdas que se borrarían al soltar `piece` en `cell`. */
function computePreview(piece: Piece, cell: CellPos): RenderState['preview'] {
  const probe = board.clone()
  for (const c of piece.cells) {
    const px = cell.x + c.x
    const py = cell.y + c.y
    if (px < 0 || py < 0 || px >= boardSize || py >= boardSize) return []
    if (probe.at(px, py) !== EMPTY) return []
    probe.set(px, py, piece.tier)
  }

  // Una celda que cruza una fila y una columna se marca una sola vez.
  const seen = new Set<string>()
  const out: RenderState['preview'] = []
  for (const line of probe.findFullLines()) {
    for (const c of line.cells) {
      const key = `${c.x},${c.y}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ cell: c, tier: piece.tier })
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
    const piece = dragPiece
    const target = dragIndex === null ? null : dragTargetCell(px, py)
    if (piece && target && pieceFits(piece, target)) {
      dragIndex = null
      dragPiece = null
      ghostCell = null
      ghostValid = false
      commitMove(piece, target)
      return
    }
    // Apuntó al tablero sin que la pieza entre: se avisa y vuelve a la bandeja.
    if (dragIndex !== null && (target || overBoard(px, py))) sfx.invalid()
    abortDrag()
  },
  onDragCancel: abortDrag,
})
resize()
dragReady = true
drag.attach()

// ---------------------------------------------------------------- teclado

/** Pieza elegida por teclado, si la hay. */
function keyboardPiece(): Piece | null {
  return kbIndex === null ? null : tray[kbIndex] ?? null
}

/**
 * Recalcula el cursor y la vista previa de teclado.
 *
 * Reutiliza los mismos `ghost`/`preview` que el arrastre: así las celdas que se
 * van a borrar se resaltan igual con teclado que con el dedo.
 */
function syncKeyboard(): void {
  const piece = keyboardPiece()
  if (!piece) {
    ghostCell = null
    ghostValid = false
    preview = []
    return
  }
  ghostCell = cursor
  ghostValid = board.fits(piece.cells, cursor.x, cursor.y)
  preview = ghostValid ? computePreview(piece, cursor) : []
}

/** Elige la pieza de la ranura `index` y encaja el cursor a su tamaño. */
function selectPiece(index: number): void {
  const piece = tray[index]
  if (!piece || usedPieces.has(piece.id)) return
  kbIndex = index
  cursor = {
    x: Math.min(Math.max(0, cursor.x), boardSize - piece.w),
    y: Math.min(Math.max(0, cursor.y), boardSize - piece.h),
  }
  syncKeyboard()
}

/** Suelta la pieza elegida en el cursor, si entra. */
function placeKeyboard(): void {
  const piece = keyboardPiece()
  if (!piece) return
  if (!pieceFits(piece, cursor)) {
    sfx.invalid()
    return
  }
  kbIndex = null
  ghostCell = null
  ghostValid = false
  commitMove(piece, cursor)
}

/** Mueve el cursor una celda, sin salirse del tablero. */
function moveCursor(dx: number, dy: number): void {
  const piece = keyboardPiece()
  if (!piece) return
  cursor = {
    x: Math.min(Math.max(0, cursor.x + dx), boardSize - piece.w),
    y: Math.min(Math.max(0, cursor.y + dy), boardSize - piece.h),
  }
  syncKeyboard()
}

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
  const settleDecay = dt / TUNING.settleDuration
  settles = settles.filter((s) => {
    s.t -= settleDecay
    return s.t > 0
  })
  const floatDecay = dt / (TUNING.popDuration * 2)
  floaters = floaters.filter((f) => {
    f.t -= floatDecay
    return f.t > 0
  })

  drag.setTray(tray)

  const kbPiece = kbIndex !== null ? tray[kbIndex] ?? null : null
  const renderState: RenderState = {
    dragging:
      dragPiece && dragIndex !== null ? [{ piece: dragPiece, dx: dragPx, dy: dragPy }] : [],
    ghost: ghostCell,
    ghostValid,
    preview,
    pops,
    settles,
    floaters,
    usedPieceIds: usedPieces,
    cursor: kbPiece
      ? {
          cell: cursor,
          w: kbPiece.w,
          h: kbPiece.h,
          valid: board.fits(kbPiece.cells, cursor.x, cursor.y),
        }
      : null,
    reduceMotion,
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
// Sin puntero, el audio se desbloquea con la primera tecla: si no, el jugador de
// teclado juega en silencio para siempre.
window.addEventListener('keydown', () => sfx.unlock(), { once: true })

hud.onSoundToggle((muted) => {
  sfx.setMuted(muted)
  hud.showToast(muted ? 'sonido apagado' : 'sonido encendido', 1000)
})

hud.onUndo(() => {
  sfx.unlock()
  undo()
})

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    sfx.setMuted(!sfx.muted)
    hud.setSoundMuted(sfx.muted)
    hud.showToast(sfx.muted ? 'sonido apagado' : 'sonido encendido', 1000)
    return
  }
  // Deshacer también funciona en game over: se puede revertir la jugada fatal.
  if (e.code === 'KeyU') {
    undo()
    return
  }
  if (state !== 'playing') return

  // Números: elige la pieza de la bandeja (1 = la primera).
  const digit = /^Digit([1-9])$/.exec(e.code)
  if (digit) {
    selectPiece(Number(digit[1]) - 1)
    e.preventDefault()
    return
  }
  if (e.code === 'Escape') {
    kbIndex = null
    syncKeyboard()
    return
  }
  if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
    placeKeyboard()
    e.preventDefault()
    return
  }

  let dx = 0
  let dy = 0
  if (e.code === 'ArrowLeft') dx = -1
  else if (e.code === 'ArrowRight') dx = 1
  else if (e.code === 'ArrowUp') dy = -1
  else if (e.code === 'ArrowDown') dy = 1
  else return

  // Sólo se interceptan las flechas con una pieza elegida: sin selección, la
  // página conserva su comportamiento normal.
  if (kbIndex === null) return
  e.preventDefault()
  moveCursor(dx, dy)
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
  if (state === 'gameover') {
    // Partida nueva de verdad: vuelve al nivel 1 sin borrar el nivel guardado.
    startGame(1)
    return
  }
  // Menú: se retoma el nivel más alto alcanzado, no siempre el 1.
  startGame(Math.max(1, readLevel()))
})

// ---------------------------------------------------------------- arranque

// `level` ya viene de `readLevel()`: si hay progreso guardado, el menú lo ofrece
// en vez de empezar siempre de cero (que es lo que hacía antes: se guardaba y
// nunca se leía).
newLevel(level)
hud.setOverlayTitle(
  'blockblast',
  level > 1
    ? `Nivel ${level} guardado. Completá una fila o columna entera.`
    : 'Completá una fila o columna entera.',
  level > 1 ? `Continuar · nivel ${level}` : 'Jugar',
)
hud.showOverlay(true)
hud.setHudVisible(false)
requestAnimationFrame(frame)