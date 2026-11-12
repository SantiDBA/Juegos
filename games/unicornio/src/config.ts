export const TUNING = {
  worldSize: 220,
  terrainSegments: 96,
  /** Altura máxima del terreno. */
  terrainHeight: 26,
  playerRadius: 0.6,
  playerHeight: 1.6,
  walkSpeed: 7,
  runSpeed: 13,
  accel: 50,
  friction: 14,
  mouseSensitivity: 0.0022,
  gravity: -22,
  jumpVelocity: 8,
  /** Radio en el que se considera "encontrado" el castillo. */
  castleReach: 6,
  /** Distancia a la que se empieza a mostrar la pista del castillo. */
  hintDistance: 90,
  treeCount: 260,
  fogNear: 60,
  fogFar: 180,
  storageKeyBest: 'unicornio.bestTime',
} as const