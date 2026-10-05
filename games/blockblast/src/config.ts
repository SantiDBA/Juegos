/**
 * Ajustes de blockblast.
 *
 * Todo lo numérico vive acá para leer de un vistazo cómo se siente el juego
 * sin bucear el loop.
 */
export const TUNING = {
  /** Lado del tablero en celdas. 9x9 es el estándar del género. */
  boardSize: 9,
  /** Piezas por turno. */
  traySize: 5,

  /**
   * Colores de las piezas.
   *
   * El color NO es estratégico: una fila se completa sin importar qué colores
   * tenga. Sólo sirve para distinguir visualmente las piezas, así que son pocos
   * y todos visibles sobre el fondo.
   */
  colors: 4,

  /**
   * Formas que pueden salir. Se incluyen líneas de 4 y 5 porque son las que
   * completan solas, en un solo turno.
   */
  shapes: [
    '1x1',
    '1x1',
    '1x2',
    '2x1',
    '1x3',
    '3x1',
    '1x4',
    '4x1',
    '2x2',
    '1x5',
    '5x1',
    '2x3',
    '3x2',
  ] as const,

  /** Puntos por celda borrada. */
  pointsPerCell: 10,
  /** Bonus por completar más de una línea en el mismo turno. */
  multiLineBonus: 150,

  /** Turnos seguidos completando línea antes de que el combo suba. */
  comboStep: 3,
  comboMax: 5,

  /** Pop al completar línea, en segundos. */
  popDuration: 0.24,

  storageKeyScore: 'blockblast.bestScore',
  storageKeyLevel: 'blockblast.level',
} as const

export const MAX_TIER = TUNING.colors

export interface ColorStyle {
  fill: string
  edge: string
  glow: string
}

/**
 * Paleta. El color no influye en la mecánica, sólo en la lectura: hay que
 * poder distinguir dos piezas contiguas de un vistazo.
 */
export const COLORS: Record<number, ColorStyle> = {
  1: { fill: '#ff6b6b', edge: '#d63f4f', glow: 'rgba(255, 107, 107, 0.5)' },
  2: { fill: '#7fd4ff', edge: '#3aa7dd', glow: 'rgba(127, 212, 255, 0.5)' },
  3: { fill: '#5ee6b5', edge: '#2bb886', glow: 'rgba(94, 230, 181, 0.5)' },
  4: { fill: '#ffd166', edge: '#e0a92c', glow: 'rgba(255, 209, 102, 0.5)' },
}