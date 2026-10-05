/**
 * Definición de niveles.
 *
 * El original es un tablero infinito sin niveles: se juega hasta quedarse sin
 * jugadas. Los niveles son el agregado pedido, y funcionan como una curva de
 * dificultad explícita en vez de dejar que el azar decida cuándo se pone difícil.
 */

export interface LevelDef {
  /** Puntos necesarios para completar el nivel. */
  target: number
  /** Semillas del tablero inicial, para que el nivel sea reproducible. */
  seed: number
}

/**
 * Objetivos por nivel.
 *
 * Suben de a saltos irregulares en vez de una progresión lineal: los niveles
 * cuadrados se sienten como una lista de tareas, y el original no tiene esa
 * estructura. La curva es suave hasta el nivel 8 y después se pone más dura.
 */
export function targetForLevel(level: number): number {
  // Crecimiento exponencial moderado: ~1.28 por nivel.
  const base = 400
  return Math.round(base * Math.pow(1.28, level - 1))
}

/** Semilla estable por nivel, para que un nivel sea siempre el mismo. */
export function seedForLevel(level: number): number {
  // Mezcla determinista: el nivel N siempre empieza con el mismo tablero.
  return (level * 2654435761) >>> 0
}

/**
 * Coloca bloques iniciales en el tablero.
 *
 * Se siembra con pocos bloques ya fusionables para que el jugador tenga una
 * jugada evidente al principio. Un tablero vacío al inicio hace que la primera
 * jugada sea a ciegas y el juego se entienda peor.
 */
export function seedBoard(board: {
  set(x: number, y: number, v: number): void
  width: number
  height: number
  applyGravity(): void
}, level: number): void {
  const rnd = mulberry32(seedForLevel(level))
  const groups = Math.min(2 + Math.floor(level / 2), 5)

  for (let g = 0; g < groups; g++) {
    const tier = 1 + Math.floor(rnd() * Math.min(3, level))
    // Grupo de 3 en L o en línea, siempre en la mitad inferior para que la
    // gravity los deje apoyados.
    const cx = Math.floor(rnd() * (board.width - 3))
    const cy = board.height - 1 - Math.floor(rnd() * 2)
    const horizontal = rnd() < 0.5
    if (horizontal) {
      board.set(cx, cy, tier)
      board.set(cx + 1, cy, tier)
      board.set(cx + 2, cy, tier)
    } else {
      // Vertical: sólo cabe si hay 3 filas libres abajo.
      if (cy < 2) continue
      board.set(cx, cy, tier)
      board.set(cx, cy - 1, tier)
      board.set(cx, cy - 2, tier)
    }
  }
  board.applyGravity()
}

/** mulberry32: PRNG determinista, el mismo que usa `Rng` en los otros juegos. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}