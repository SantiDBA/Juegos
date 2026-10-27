/**
 * Constantes del juego.
 *
 * El gato es un cuerpo rígido simplificado sobre un piso plano: nada de física
 * realista, sólo números que se sienten bien. Las necesidades viven en
 * `needs.ts`, que es la única fuente de verdad de qué baja, cuánto y en cuánto
 * tiempo; acá quedan los números globales de la partida.
 */
export const TUNING = {
  // --- Gato
  /** Radio de la esfera que lo representa contra paredes y muebles. */
  catRadius: 0.36,
  /** Semialtura del centro de esa esfera sobre las patas. */
  catHalfHeight: 0.4,
  gravity: 24,
  /** Velocidad caminando; con Shift se usa `runSpeed`. */
  walkSpeed: 6.2,
  runSpeed: 10.4,
  /** Aceleración hacia la velocidad pedida; la fricción es la misma al soltar. */
  groundAccel: 46,
  airAccel: 14,
  /** Cuánto tarda en girar hacia la dirección de movimiento. */
  turnRate: 12,
  /** Altura del salto: v²/2g = 7.6²/48 ≈ 1.2 unidades. */
  jumpImpulse: 7.6,

  // --- Cámara (tercera persona)
  // Alta y no muy lejos: más altura mira por encima de las paredes (y son menos
  // las que hay que desvanecer), y menos distancia hace al gato más grande.
  cameraDistance: 8,
  cameraHeight: 6.2,
  /** Qué tan rápido alcanza la posición deseada (más alto, más pegada). */
  cameraLag: 6.5,
  /** Adónde mira: un poco arriba del gato, a la altura del lomo. */
  cameraLookHeight: 1.0,
  /** Nunca por debajo de esto: el piso es y=0. */
  cameraMinY: 2.4,
  cameraFov: 58,
  /** Radianes de giro de órbita por píxel arrastrado. */
  cameraDragSpeed: 0.006,

  // --- Partida
  // No hay vidas ni final: la partida es infinita. Lo único que importa es no
  // dejar que una necesidad llegue a cero, porque el gato se pone mustio.
  /** Mientras hace una actividad, las demás necesidades caen más lento. */
  actingDrainScale: 0.45,
  /** Cada cuánto suena la alarma si hay alguna necesidad crítica. */
  alarmInterval: 2.6,
  /** Cada cuánto, como mucho, maúlla solo mientras no pasa nada. */
  idleMeowMin: 22,
  idleMeowMax: 46,

  // --- Estaciones
  stationRadius: 2.4,
  /**
   * Altura de los iconos flotantes. Por encima de las paredes (3), así se ven
   * desde cualquier ángulo de la cámara en tercera persona.
   */
  stationIconHeight: 3.5,

  // --- Feel
  bloomStrength: 0.4,
  bloomRadius: 0.55,
  bloomThreshold: 0.82,

  // --- Persistencia
  /** El récord de una partida infinita es cuántos cuidados completaste. */
  storageKeyBest: 'michi.bestCares',
  storageKeyMuted: 'michi.muted',
} as const

export const COLORS = {
  // --- Casa
  ground: 0x333a2e,
  // Piso frío y apagado a propósito: el gato es naranja, y con un entarimado
  // cálido se leía como una mancha más del piso. Frío contra cálido, y oscuro
  // contra claro, el michi se despega solo.
  floor: 0x776a5c,
  floorSeam: 0x5e5348,
  wall: 0xe7dcc6,
  partition: 0xd9cbb1,
  rug: 0x8a5350,

  // --- Gato (naranja atigrado, para que se lea sobre la madera)
  cat: 0xf0a24a,
  catDark: 0xd07f2e,
  catBelly: 0xffe3c4,
  catNose: 0xff9aa2,
  catEye: 0x8fd44a,
  catPupil: 0x141414,

  // --- Muebles
  bowl: 0x5aa9e6,
  food: 0xc98a4b,
  tub: 0xf2f6fa,
  water: 0x63c7f0,
  post: 0xc7a06a,
  postBase: 0xa9713f,
  bed: 0x8f5fb0,
  bedSheet: 0xd9c2ef,
  litterSand: 0xd8d2c4,
  litterBox: 0x6f7a86,

  wood: 0xa9713f,
  fridge: 0xdfe6ee,
  sofa: 0x5f7f9f,
  cushion: 0xe3a86a,
  plant: 0x4e8a4e,
  pot: 0xb4653f,

  // --- Feedback
  guide: 0xffd166,
  crit: 0xff6b6b,
} as const
