/**
 * Ajustes de pacman3d.
 *
 * Todo lo numérico vive acá para poder leer de un vistazo cómo se siente el
 * juego sin bucear el loop. El laberinto se mide en celdas y las medidas del
 * mundo se derivan de `cellSize`, así cambiar la escala del mapa es un número.
 */
export const TUNING = {
  /** Lados del laberinto. El mapa es cuadrado y con borde cerrado. */
  gridSize: 15,
  /** Lado de una celda en unidades de mundo. */
  cellSize: 2,
  /**
   * Alto de los muros. Bajo a propósito: con muros más altos que anchos la
   * cámara en chase queda encerrada y no se lee el laberinto, que es la mitad
   * del juego. Un muro bajo deja ver la estructura y sigue marcando el límite.
   */
  wallHeight: 0.9,
  /** Grosor visual del muro; el laberinto lógico es de celdas completas. */
  wallThickness: 0.22,

  // --- Jugador
  /**
   * Radio de colisión y del mesh. Deliberadamente menor que la mitad de la
   * celda (1.0): con un radio mayor el cuerpo roza las paredes de las celdas
   * vecinas y en un pasillo de una sola celda el jugador se ve encajonado
   * dentro del muro.
   */
  playerRadius: 0.34,
  /** Vistas desde la cámara en tercera persona, detrás del jugador. */
  cameraHeight: 7.2,
  cameraDistance: 7.4,
  cameraLag: 7.5,
  turnSpeed: 13,
  /** Velocidad base. Pac-Man acelera un poco siempre, como el original. */
  baseSpeed: 5.6,
  /** Apertura inicial de la boca, en grados. */
  mouthAngle: 38,

  /** Altura a la que se dibujan los puntos y los personajes. */
  playerHeight: 0.5,

  // --- Puntos
  pelletValue: 10,
  powerPelletValue: 50,
  /** Radio dentro del cual un pellet se considera comido. */
  eatRadius: 0.52,
  pelletHeight: 0.2,
  /** Segundos que dura el modo asustado. */
  frightenedSeconds: 7,
  /** Segundos de pausa al comer un pellet de poder. */
  eatGhostSeconds: 2.2,
  /** Puntos de comer un fantasma asustado. */
  ghostValue: 200,

  // --- Fantasmas
  ghostCount: 4,
  ghostRadius: 0.36,
  /**
   * Velocidad de los fantasmas, por debajo de la del jugador (5.6). Con la
   * misma velocidad el contacto es inevitable en un pasillo de una celda y la
   * partida se pierde sin poder esquivar. ir más lento deja ver al fantasma
   * llegar y decidir si conviene o no seguir comiendo.
   */
  ghostSpeed: 4.2,
  /** Multiplicador de velocidad mientras están asustados (más lento). */
  frightenedSpeed: 0.62,
  /** Retardo entre la salida de cada fantasma, en segundos. */
  ghostReleaseDelay: 2.5,
  /**
   * Celdas de dispersión: cada fantasma tiene su esquina. Los que no están en
   * modo "dispersar" solo vuelven ahí cuando el contador de puntos los obliga,
   * que es lo que hace que los cuatro no se amontonen.
   */
  scatterCorners: [
    { x: 0, y: 0 },
    { x: 0, y: 14 },
    { x: 14, y: 0 },
    { x: 14, y: 14 },
  ],

  // --- Vidas y estados
  startLives: 3,
  /** Invulnerabilidad tras perder una vida, en segundos. */
  respawnInvulnerable: 2.5,
  /** Bonus de vida cada cuántos puntos. */
  extraLifeEvery: 10000,

  // --- Feel
  /** Sacudida de cámara al ser comido. */
  deathShake: 0.4,
  /** Velocidad del meneo de la boca al correr. */
  chompFrequency: 12,
  /** Bloom alto: el juego es casi todo emisivo (puntos, fantasmas). */
  bloomStrength: 0.7,
  bloomRadius: 0.45,
  bloomThreshold: 0.55,

  // --- Récord
  storageKeyScore: 'pacman3d.bestScore',
  storageKeyLevel: 'pacman3d.level',
} as const