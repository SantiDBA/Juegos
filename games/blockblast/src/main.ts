import { Board, EMPTY, type CellPos } from './board'
import { MAX_TIER, TUNING, TIER_COLORS } from './config'
import { rollTray, type Piece } from './pieces'
import { targetForLevel, seedBoard } from './levels'
import { DragController } from './input'
import {
  computeLayout,
  render,
  screenToCell,
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

let boardSize = TUNING.boardSize
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
  // `drag` se declara más abajo y todavía no existe en el primer resize; el
  // guard evita el temporal dead zone sin tener que diferir la llamada.
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
/** Piezas ya soltadas en el turno en curso, a la espera del merge. */
let usedPieces = new Set<number>()

let score = 0
let level = readLevel()
let levelScore = 0
let moves = 0
let comboStreak = 0
let best = readBest()

/** Animaciones en curso. */
let pops: RenderState['pops'] = []
let floaters: RenderState['floaters'] = []

/** Pieza que se está arrastrando y desde qué ranura. */
let dragIndex: number | null = null
let dragPiece: Piece | null = null
let dragPx = 0
let dragPy = 0
let ghostCell: CellPos | null = null
let ghostValid = false

// ---------------------------------------------------------------- turnos

function newLevel(next: number): void {
  level = next
  board = new Board(boardSize)
  seedBoard(board, level)
  tray = rollTray(level, Math.random)
  usedPieces = new Set()
  levelScore = 0
  moves = 0
  comboStreak = 0
  pops = []
  floaters = []
  hud.setLevel(level, targetForLevel(level))
  hud.setProgress(0)
  hud.setMoves(0)
  hud.setCombo(1)
  hud.setScore(score, best)
}

/**
 * Intenta soltar las piezas arrastradas en `cell`.
 *
 * Se Arma un turno con todas las piezas usadas, se lo pasa al board y sólo se
 * acepta si fue válido. La bandeja no se descuenta hasta saber el resultado,
 * para que un movimiento inválido devuelva las piezas exactamente como estaban.
 */
function commitMove(cell: CellPos | null): void {
  if (!cell) {
    cancelDrag()
    return
  }

  const pieces = tray.filter((p) => usedPieces.has(p.id))
  if (!pieces.length) {
    cancelDrag()
    return
  }

  const shapes = pieces.map((p) => ({ tier: p.tier, cells: p.cells }))
  const result = board.place(shapes, cell, MAX_TIER)

  if (!result.valid) {
    // No fusionó: no cuenta. Se devuelve todo a la bandeja y se avisa.
    usedPieces = new Set()
    hud.showToast('sin fusión: no cuenta')
    cancelDrag()
    return
  }

  // Puntaje: cascada y combo.
  let gained = result.score
  comboStreak++
  const multiplier = comboMultiplier()
  gained = Math.round(gained * multiplier)

  // Bonus por varios grupos en el mismo turno.
  if (result.rounds >= 1 && result.merges > 3) {
    gained += TUNING.multiGroupBonus
  }

  score += gained
  levelScore += gained
  moves++

  // Animaciones: pop sobre la celda destino y puntaje flotante.
  const centerAnchor = anchorOf(cell, shapes)
  if (centerAnchor) {
    pops.push({ cell: centerAnchor, tier: result.bestTier, t: 1 })
    floaters.push({
      cell: centerAnchor,
      text: `+${gained}`,
      t: 1,
      color: TIER_COLORS[result.bestTier]?.fill ?? '#ffffff',
    })
  }

  // Bandeja: se renueva sólo si se gastó alguna pieza.
  if (pieces.length > 0) {
    const fresh = rollTray(level, Math.random)
    tray = tray.map((p) => (usedPieces.has(p.id) ? (fresh.shift() ?? p) : p))
  }
  usedPieces = new Set()

  hud.setScore(score, best)
  hud.setMoves(moves)
  hud.setCombo(multiplier)
  hud.setProgress(levelScore / targetForLevel(level))

  // ¿Se completó el nivel? Si no, ¿quedó alguna jugada?
  if (levelScore >= targetForLevel(level)) {
    completeLevel()
  } else if (isStuck() || !hasAnyMergeLeft()) {
    endGame()
  }
}

/** Celda representativa del turno, para ubicar el pop y el puntaje. */
function anchorOf(cell: CellPos, shapes: ReadonlyArray<{ cells: readonly CellPos[] }>): CellPos | null {
  if (!shapes.length) return null
  let minX = Infinity
  let minY = Infinity
  for (const s of shapes) {
    for (const c of s.cells) {
      minX = Math.min(minX, c.x)
      minY = Math.min(minY, c.y)
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: cell.x + minX, y: cell.y + minY }
}

function comboMultiplier(): number {
  return Math.min(TUNING.comboMax, 1 + Math.floor(comboStreak / TUNING.comboStep))
}

/**
 * ¿Quedó alguna jugada?
 *
 * La condición real es geométrica: que no haya ninguna pieza que quepa en
 * ninguna parte del tablero. No se exige que además fusione, porque colocar
 * sin fusionar no consume turno pero sí ocupa espacio, y una partida con
 * espacio de sobra no puede estar terminada.
 *
 * Exigir fusión daba game over con el tablero casi vacío, que es absurdo: con
 * un solo bloque en el tablero nunca se puede formar un grupo de 3.
 */
function isStuck(): boolean {
  const usable = tray.filter((p) => !usedPieces.has(p.id))
  if (!usable.length) return true
  return !usable.some((p) => board.placements(p.cells).length > 0)
}

/**
 * ¿Qeda alguna jugada que además fusione?
 *
 * Es distinto de `isStuck`: acá el tablero puede tener espacio de sobra pero
 * ningún color llega a 3, así que la partida está muerta aunque se pueda
 * colocar. Sin esto el juego se congela en silencio: el jugador arrastra, el
 * ghost nunca se pone verde y no entiende por qué nada pasa.
 */
function hasAnyMergeLeft(): boolean {
  const usable = tray.filter((p) => !usedPieces.has(p.id))
  return usable.some((p) => board.hasMergingPlacement(p.cells, p.tier))
}

function completeLevel(): void {
  state = 'levelclear'
  saveLevel(level + 1)
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
  if (saveBest(score)) {
    best = readBest()
    hud.flashBest()
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
  // Se marca como usada de inmediato: si suelta fuera, se revierte.
  usedPieces.add(piece.id)
}

function updateDrag(px: number, py: number): void {
  dragPx = px
  dragPy = py
  ghostCell = screenToCell(layout, px, py, boardSize)
  ghostValid = ghostCell ? isPlacementValid(ghostCell) : false
}

function cancelDrag(): void {
  if (dragIndex !== null) usedPieces.delete(tray[dragIndex]!.id)
  dragIndex = null
  dragPiece = null
  ghostCell = null
  ghostValid = false
}

/**
 * ¿Las piezas usadas podrían colocarse en `cell`?
 *
 * Sólo geometría y merge: `place` vuelve a validar y es la única fuente de
 * verdad, así que este chequeo existe para el feedback visual mientras se
 * arrastra.
 *
 * El merge es la condición porque una colocación que no fusiona no consume
 * turno: aceptarla como jugada válida dejaría al jugador llenando el tablero
 * sin poder fusionar nunca.
 */
function isPlacementValid(cell: CellPos): boolean {
  const pieces = tray.filter((p) => usedPieces.has(p.id))
  if (!pieces.length) return false

  // Todas las celdas de todas las piezas deben caber y estar vacías.
  const probe = board.clone()
  for (const p of pieces) {
    for (const c of p.cells) {
      const px = cell.x + c.x
      const py = cell.y + c.y
      if (px < 0 || py < 0 || px >= boardSize || py >= boardSize) return false
      if (probe.at(px, py) !== EMPTY) return false
    }
  }
  for (const p of pieces) {
    for (const c of p.cells) probe.set(cell.x + c.x, cell.y + c.y, p.tier)
  }
  probe.applyGravity()
  return probe.findGroups().length > 0
}

const drag = new DragController(canvas, layout, boardSize, {
  onDragStart: beginDrag,
  onDragMove: updateDrag,
  onDragEnd: (cell) => {
    const index = dragIndex
    if (index === null) {
      cancelDrag()
      return
    }
    if (cell && isPlacementValid(cell)) {
      dragIndex = null
      dragPiece = null
      ghostCell = null
      commitMove(cell)
    } else {
      // No hubo movimiento válido, pero el turno puede seguir teniendo juego:
      // se reevalúa igual. Antes esto sólo se chequeaba dentro de `commitMove`,
      // así que una partida bloqueada con el jugador arrastrando piezas
      // inválidas se quedaba congelada en silencio, sin mensaje ni fin.
      cancelDrag()
      if (state === 'playing' && levelScore < targetForLevel(level) && !hasAnyMergeLeft()) {
        endGame()
      }
    }
  },
})
// Se setean las dimensiones del canvas una vez que `drag` ya existe, y recién
// después se marca `dragReady` para que los próximos resize lo actualicen.
resize()
drag.setWidth(window.innerWidth)
dragReady = true
drag.attach()

// ---------------------------------------------------------------- loop

let last = performance.now()

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now

  // Animaciones: los pops y los puntajes flotantes se apagan y se limpian.
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
      dragPiece && dragIndex !== null
        ? [{ piece: dragPiece, dx: dragPx, dy: dragPy }]
        : [],
    ghost: ghostCell,
    ghostValid,
    pops,
    floaters,
    usedPieceIds: usedPieces,
  }

  render(ctx, window.innerWidth, window.innerHeight, layout, board, tray, renderState)
  requestAnimationFrame(frame)
}

window.addEventListener('resize', resize)
hud.onPlay(() => {
  if (state === 'levelclear') {
    // El nivel se conserva el puntaje acumulado y se pasa al siguiente.
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
  'Fusioná tres del mismo color. Sin fusión no cuenta el movimiento.',
  'Jugar',
)
hud.showOverlay(true)
hud.setHudVisible(false)
requestAnimationFrame(frame)