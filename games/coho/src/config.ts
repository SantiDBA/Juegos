export const TUNING = {
  arenaSize: 60,
  wallHeight: 6,
  playerRadius: 0.4,
  playerHeight: 1.8,
  eyeOffset: -0.2,
  walkSpeed: 6,
  runSpeed: 10,
  accel: 60,
  friction: 12,
  airControl: 0.35,
  gravity: -26,
  jumpVelocity: 9.2,
  maxStepHeight: 0.45,
  stepHeight: 0.35,
  mouseSensitivity: 0.0022,

  // --- Generación del nivel
  platformCount: 5,
  pillarCount: 7,

  // --- Coleccionables
  orbCount: 16,
  orbSpin: 2.2,
  orbBob: 0.18,
  minOrbSeparation: 3.5,
  goldCount: 3,
  hazardCount: 3,
  /**
   * El reloj cuenta hacia atrás: los dorados suman tiempo y los rojos lo
   * restan. Antes el reloj subía y el combo multiplicaba su velocidad; con
   * cuenta regresiva la presión tiene que venir de quedarse sin tiempo, y la
   * habilidad se paga en segundos recuperados.
   */
  startSeconds: 60,
  goldTimeBonus: 3,
  hazardTimePenalty: 3,

  /**
   * Atracción de orbes: dentro de `magnetRadius` el orbe se mueve hacia el
   * jugador con una curva suave, así una aproximación casi pasa sin exigir
   * puntería al_FRAME.
   */
  magnetRadius: 3.4,
  magnetSpeed: 9,

  // --- Enemigos
  enemyCount: 4,
  enemyPatrolSpeed: 3.2,
  enemyChaseSpeed: 5.4,
  enemyDetectRange: 13,
  enemyLoseRange: 20,
  enemyContactRadius: 1.1,
  enemyRadius: 0.55,
  /** Distancia máxima a la que un enemigo busca una escalera para cambiar de altura. */
  enemyStairSeekRange: 22,

  // --- Power-ups
  powerUpDuration: 8,
  turboMultiplier: 1.45,
  slowmoScale: 0.55,

  // --- Combo
  comboWindow: 4,
  comboMax: 5,
  /**
   * Segundos que se ganan por orbe normal según el multiplicador activo.
   * Antes el combo multiplicaba la velocidad del reloj; ahora la cuenta
   * regresiva es plana y el combo se traduce directamente en tiempo recuperado,
   * así el skill se ve en el número y no en un efecto invisible.
   */
  comboTimeBonus: 0.45,

  // --- Feel
  collectRadius: 1.6,
  fovKick: 8,
  /** Sacudida y cabeceo de cámara al caminar. */
  bobFrequency: 9.5,
  bobAmplitude: 0.055,
  runBobMultiplier: 1.6,
  /** Hundimiento de cámara al aterrizar, en unidades de mundo. */
  landDip: 0.16,
  landDipSpeed: 0.35,
  // Bloom: umbral alto para que solo florezcan los elementos emisivos (orbes,
  // bordes, power-ups) y no las superficies iluminadas.
  bloomStrength: 0.55,
  bloomRadius: 0.4,
  bloomThreshold: 0.85,

  // Un récord por modo: sin enemigos el tiempo no es comparable al otro.
  storageKeyEnemies: 'coho.bestTime.enemies',
  storageKeyCalm: 'coho.bestTime.calm',
  storageKeyMode: 'coho.mode',
} as const
