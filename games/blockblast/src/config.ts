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
  /**
   * Piezas por mano.
   *
   * 3 es el estándar del género. Con 5 fijas el tablero casi nunca se traba y no
   * hay tensión: siempre queda una pieza que entra. Con 3 la mano se vacía y hay
   * que decidir el orden.
   */
  traySize: 3,

  /**
   * Colores de las piezas.
   *
   * El color NO es estratégico: una fila se completa sin importar qué colores
   * tenga. Sólo sirve para distinguir visualmente las piezas, así que son pocos
   * y todos visibles sobre el fondo.
   */
  colors: 4,

  /**
   * Formas que pueden salir.
   *
   * Rectángulos (`1x3`, `2x2`) y policominós (`.##/##.`). Antes eran sólo
   * rectángulos hasta 5 de largo: casi todo entraba en algún lado, el tablero no
   * se trababa nunca y la decisión de dónde poner perdía filo. Las formas con
   * codo (L, J, S, Z, T) son las que obligan a elegir. Se sacaron las de 5 en
   * línea: con una mano de 3, una pieza de 5 que no entra es una derrota injusta.
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
    '2x2',
    '2x3',
    '3x2',
    '.##/##.',
    '##./.##',
    '#../###',
    '##./#..',
    '###/.#.',
    '.#./##',
  ] as const,

  /** Puntos por celda borrada. */
  pointsPerCell: 10,
  /**
   * Puntos por bloque colocado.
   *
   * Chico a propósito: completar la línea es lo que paga, pero colocar deja de
   * ser mudo. Sin esto, la enorme mayoría de los turnos no devolvía nada y el
   * juego enseñaba a esperar la línea en vez de a planear.
   */
  pointsPerBlock: 2,
  /** Bonus por completar más de una línea en el mismo turno. */
  multiLineBonus: 150,
  /** Bonus por vaciar la mano: se repone entera y premia el ritmo, no la espera. */
  trayClearBonus: 60,

  /** Turnos seguidos completando línea antes de que el combo suba. */
  comboStep: 3,
  comboMax: 5,

  /** Pop al completar línea, en segundos. */
  popDuration: 0.24,
  /** Asentado del bloque al aterrizar, en segundos. Corto: es un acuse, no un show. */
  settleDuration: 0.12,

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
  wash: 'rgba(255, 176, 96, 0.10)',
  /** Panel del marco. */
  frame: 'rgba(38, 30, 25, 0.96)',
  frameEdge: 'rgba(255, 205, 155, 0.40)',
  frameGlow: 'rgba(255, 170, 90, 0.34)',
  /**
   * Casilla vacía: relleno y borde.
   *
   * El borde es el que dibuja la grilla, así que tiene que verse sobre el
   * panel. Con blanco puro quedaba en 1.5:1 y sobre fondo oscuro no se lee:
   * va con tinte del acento y más opacidad.
   */
  well: 'rgba(255, 250, 240, 0.045)',
  wellEdge: 'rgba(255, 214, 178, 0.30)',
  /** Bandeja: placa de fondo y casilla de cada pieza. */
  trayPlate: 'rgba(255, 240, 225, 0.05)',
  trayEdge: 'rgba(255, 240, 225, 0.14)',
  /*
   * La casilla de cada pieza es un hueco oscuro, no un blanco translúcido más:
   * sobre la placa, un blanco al 5% quedaba en 1.16:1 y el slot era invisible,
   * así que las cinco piezas se leían como manchas sueltas en vez de una mano.
   */
  slot: 'rgba(0, 0, 0, 0.22)',
  slotEdge: 'rgba(255, 214, 178, 0.34)',
  /** Costura entre bloques contiguos: sin esto dos bloques se leen como uno. */
  blockSeam: 'rgba(0, 0, 0, 0.45)',
  /** Destino inválido mientras se arrastra. */
  invalid: 'rgba(255, 128, 108, 0.88)',
  /** Cursor de teclado: la caja donde caería la pieza elegida. */
  cursor: 'rgba(255, 180, 84, 0.95)',
} as const