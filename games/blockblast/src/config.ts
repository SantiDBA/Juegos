/**
 * Ajustes de blockblast.
 *
 * Todo lo numérico vive acá para leer de un vistazo cómo se siente el juego
 * sin bucear el loop.
 */
export const TUNING = {
  /**
   * Lado del tablero en celdas.
   *
   * 8x8: con 9 el tablero se vacía demasiado rápido, porque una línea son 9
   * celdas y una sola jugada borra una porción grande de todo. Con 8 la línea
   * es un poco más chica y la partida dura lo justo.
   */
  boardSize: 8,
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
  /** Borde opuesto al degradado: el bloque se apoya sobre este tono. */
  edge: string
  /** Franja de brillo del canto superior, para dar relieve. */
  hi: string
  glow: string
}

/**
 * Paleta. El color no influye en la mecánica, sólo en la lectura: hay que
 * poder distinguir dos piezas contiguas de un vistazo.
 */
export const COLORS: Record<number, ColorStyle> = {
  1: { fill: '#ff6b6b', edge: '#c8354a', hi: '#ffb8b8', glow: 'rgba(255, 107, 107, 0.5)' },
  2: { fill: '#7fd4ff', edge: '#2b8fc4', hi: '#c8eeff', glow: 'rgba(127, 212, 255, 0.5)' },
  3: { fill: '#5ee6b5', edge: '#1f9d72', hi: '#b6f6de', glow: 'rgba(94, 230, 181, 0.5)' },
  4: { fill: '#ffd166', edge: '#cc9218', hi: '#ffedbe', glow: 'rgba(255, 209, 102, 0.5)' },
}

/**
 * Paleta del tablero.
 *
 * El tablero es un objeto sobre el fondo, no una mancha: marco con borde y
 * halo, y una casilla dibujada por celda. Con sólo un punto en el centro de
 * cada celda la grilla y los límites se perdían, y sin límites no se puede
 * planear dónde entra una pieza — que es todo el juego.
 */
export const BOARD = {
  /** Halo radial detrás del tablero: lo despega del fondo plano. */
  wash: 'rgba(127, 212, 255, 0.10)',
  /** Panel del marco. */
  frame: 'rgba(26, 33, 52, 0.96)',
  frameEdge: 'rgba(154, 206, 250, 0.42)',
  frameGlow: 'rgba(127, 212, 255, 0.40)',
  /**
   * Casilla vacía: relleno y borde.
   *
   * El borde es el que dibuja la grilla, así que tiene que verse sobre el
   * panel. Con blanco puro quedaba en 1.5:1 y sobre fondo oscuro no se lee:
   * va con tinte del acento y más opacidad.
   */
  well: 'rgba(255, 255, 255, 0.045)',
  wellEdge: 'rgba(168, 205, 245, 0.30)',
  /** Bandeja: placa de fondo y casilla de cada pieza. */
  trayPlate: 'rgba(255, 255, 255, 0.03)',
  trayEdge: 'rgba(255, 255, 255, 0.08)',
  slot: 'rgba(255, 255, 255, 0.05)',
  slotEdge: 'rgba(168, 205, 245, 0.22)',
  /** Costura entre bloques contiguos: sin esto dos bloques se leen como uno. */
  blockSeam: 'rgba(0, 0, 0, 0.45)',
  /** Destino inválido mientras se arrastra. */
  invalid: 'rgba(255, 122, 122, 0.85)',
} as const