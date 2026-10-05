/**
 * Ajustes de blockblast.
 *
 * Los tiers llegan hasta 8 y ahí se quedan: el original tampoco tiene un
 * final, y tener un techo haría falsa la promesa de "+1 por fusión" y
 * obligaría a inventar una regla de puntaje aparte para el tope.
 */
export const MAX_TIER = 8

export const TUNING = {
  /** Lado del tablero en celdas. */
  boardSize: 8,
  /** Piezas por turno. */
  traySize: 3,

  /**
   * Tiers que pueden salir en la bandeja. Se mantienen bajos al principio y
   * suben con el nivel: si salieran 8s desde el arranque no habría merge
   * posible y el juego sería injugable.
   */
  baseMaxTier: 3,
  /** Cuántos tiers más puede aparecer la bandeja por nivel superado. */
  tierPerLevel: 1,
  /** Tope de la bandeja, para que siempre haya color de 1 a 3 sobre el tablero. */
  trayMaxTier: 5,

  /**
   * Formas que pueden salir, por tier máximo de la pieza. Se indexan por
   * cantidad de celdas para que un 1x1 sea lo más común al principio.
   */
  shapesByLevel: [
    ['1x1', '1x1', '1x1', '1x2', '2x1', '1x3', '3x1', '2x2'],
    ['1x1', '1x2', '2x1', '1x3', '3x1', '2x2', '1x4', '4x1'],
    ['1x1', '1x2', '1x3', '2x1', '2x2', '3x1', '1x4', '4x1', '2x3'],
    ['1x1', '1x2', '1x3', '2x2', '2x3', '3x2', '1x5', '5x1', '3x3'],
  ] as const,

  /** Formas siempre disponibles, para que haya algo simple de jugar. */
  alwaysShapes: ['1x1', '1x1', '1x2', '2x1'],

  /** Puntos por bloque fusionado, menos 2 por el grupo. */
  pointsPerBlock: 10,
  /** Multiplicador por cada ronda extra de cascada. */
  cascadeMultiplier: 2,
  /** Bonus cuando un turno fusiona más de un grupo. */
  multiGroupBonus: 50,

  /** Turns seguidos válidos antes de que el combo llegue a su tope. */
  comboStep: 4,
  comboMax: 5,

  /** Animación de caída, en segundos. */
  dropDuration: 0.16,
  /** Pop al fusionar, en segundos. */
  popDuration: 0.22,

  storageKeyScore: 'blockblast.bestScore',
  storageKeyLevel: 'blockblast.level',
} as const

/**
 * Paleta de los 8 tiers.
 *
 * Cada color tiene un relleno, un borde y un brillo: el brillo es lo que hace
 * que en el original los bloques de distintos valores se distingan de un
 * vistazo, y es lo que permite jugar sin leer números.
 */
export interface TierColor {
  fill: string
  edge: string
  glow: string
}

export const TIER_COLORS: Record<number, TierColor> = {
  1: { fill: '#7fd4ff', edge: '#3aa7dd', glow: 'rgba(127, 212, 255, 0.55)' },
  2: { fill: '#5ee6b5', edge: '#2bb886', glow: 'rgba(94, 230, 181, 0.55)' },
  3: { fill: '#ffd85e', edge: '#e0a92c', glow: 'rgba(255, 216, 94, 0.55)' },
  4: { fill: '#ff9a3d', edge: '#e07a1f', glow: 'rgba(255, 154, 61, 0.55)' },
  5: { fill: '#ff7a8a', edge: '#d94a5c', glow: 'rgba(255, 122, 138, 0.55)' },
  6: { fill: '#c98cff', edge: '#8f52d6', glow: 'rgba(201, 140, 255, 0.55)' },
  7: { fill: '#8f9bff', edge: '#5a67d9', glow: 'rgba(143, 155, 255, 0.55)' },
  8: { fill: '#ff6bd6', edge: '#d63ba8', glow: 'rgba(255, 107, 214, 0.55)' },
}