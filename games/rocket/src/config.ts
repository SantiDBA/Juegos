/**
 * Constantes del juego.
 *
 * Rocket League mide todo en Unreal Units (1 uu = 1 cm): cancha 8192x10240,
 * pelota de radio 91.25, masas 180:30. Acá se trabaja a escala 1/100 (1 unidad
 * = 1 m), así que cada número es el valor de RL dividido por 100. Los valores
 * salen de RLGym/RLBot (ver el plan del juego); se mantienen las proporciones
 * para que el manejo se sienta como el original.
 */
export const TUNING = {
  // --- Cancha
  fieldWidth: 81.92,
  fieldLength: 102.4,
  ceiling: 20.44,
  wallThickness: 1,
  /** Semiancho del arco (RL: 892.755 uu de centro al parante). */
  goalHalfWidth: 8.92755,
  /** Altura del arco, hasta la travesaña. */
  goalHeight: 6.42775,
  /** Profundidad de la red detrás de la línea de gol. */
  goalDepth: 8.8,
  /**
   * Radio de la rampa al pie de las paredes laterales. Es lo que devuelve la
   * pelota al campo en vez de dejarla clavada contra la pared.
   */
  wallRamp: 2,

  // --- Pelota
  ballRadius: 0.9125,
  ballMass: 30,
  /** Rebote 60%: pierde el 40% de la velocidad normal en cada choque. */
  ballRestitution: 0.6,
  /** Arrastre lineal del balón (dv/dt = -k·v). Los autos no tienen arrastre. */
  ballDrag: 0.0306,
  ballMaxSpeed: 60,
  /** Fricción tangencial en cada rebote: hace rodar al balón en vez de patinar. */
  ballGrip: 0.18,

  // --- Auto
  carMass: 180,
  // El largo, ancho, alto, radio de colisión y altura del origen NO van acá:
  // son parte de la forma de cada chasis (ver `cars.ts`).
  gravity: 6.5,
  /** Tope de aceleración pura; se desvanece a 0 al llegar a la velocidad tope. */
  throttleTopSpeed: 14.1,
  throttleAccel: 16,
  reverseAccel: 9,
  brakeDecel: 35,
  /** Desaceleración al soltar el acelerador, sobre el módulo de la velocidad. */
  coastDecel: 5.25,
  boostAccelGround: 9.9167,
  boostAccelAir: 10.5833,
  carMaxSpeed: 23,
  /** Por encima de esto el auto entra en supersónico (estela + sonido). */
  supersonic: 22,
  boostDrain: 33.3,
  boostStart: 33,
  boostMax: 100,
  /** Tasa de giro del volante parado; decrece con la velocidad. */
  turnRate: 3.6,
  /** Cuánto pierde de giro a la velocidad tope (RL: ~2 rad/s a fondo). */
  turnFalloff: 0.4,
  /** Agarre lateral: cuánto se cancela la velocidad lateral por segundo. */
  groundGrip: 8,
  driftGrip: 2.2,
  /** Aceleración en el aire con el acelerador (66.667 uu/s²: casi nada). */
  airThrottleAccel: 0.6667,
  maxAngularSpeed: 5.5,
  jumpImpulse: 2.92,
  /** Bonus por mantener el salto, repartido en `jumpHoldTime`. */
  jumpHoldBonus: 2.92,
  jumpHoldTime: 0.2,
  doubleJumpImpulse: 2.9167,
  /** Ventana para convertir el segundo salto en dodge/flip. */
  flipWindow: 1.25,
  flipTorqueTime: 0.65,
  /** Vueltas por segundo durante el flip: se completa uno entero. */
  flipSpinRate: 9.7,
  /** Impulso del dodge (valor de comunidad: RL no lo publica). */
  dodgeImpulse: 7,
  /** Empujón extra a la pelota cuando la golpea un flip en curso. */
  hitFlipBonus: 9,
  /** Empujón extra cuando el auto va supersónico. */
  hitSuperBonus: 5,
  /** Rebote auto-pelota: bajo, porque el flip es el que da la potencia. */
  carBallRestitution: 0.45,
  carRestitution: 0,

  // --- Pads de boost
  padSmallBoost: 12,
  padBigBoost: 100,
  padSmallRespawn: 4,
  padBigRespawn: 10,
  padPickRadius: 1.44,
  padBigPickRadius: 2.08,

  // --- Partido
  matchSeconds: 300,
  kickoffCountdown: 3,
  /** Cuánto dura la congelación tras un gol antes del próximo kickoff. */
  goalFreeze: 2.2,
  /** Boost con el que arranca cada kickoff. */
  kickoffBoost: 33,
  /**
   * Radio del círculo de kickoff: todos los autos salen exactamente a esta
   * distancia de la pelota. El ángulo se sortea (ver `kickoff.ts`).
   */
  kickoffRadius: 25,
  /** Media apertura del abanico de kickoff, en radianes (≈34°). */
  kickoffSpread: 0.6,
  /** En entrenamiento el gol despeja más rápido y la pelota vuelve al centro. */
  trainingResetDelay: 1,

  // --- Cámara
  cameraDistance: 3,
  cameraHeight: 1.15,
  cameraLag: 9,
  cameraFov: 88,
  /** Cuánto se mezcla la mirada hacia la pelota (ball cam). */
  ballCamBlend: 0.55,

  // --- IA
  /** Cada cuánto recalcula su objetivo: la latencia es su principal freno. */
  aiReaction: 0.12,
  /** Ruido del punto de impacto: lo hace vencible. */
  aiError: 1.1,
  /**
   * Cuánto apunta más allá de la pelota para empujarla hacia el arco. Lejos a
   * propósito: con un punto pegado a la pelota el bot llegaba frenando y la
   * rozaba, en vez de embestirla con velocidad.
   */
  aiAimOvershoot: 10,
  /**
   * A qué distancia del balón se pone el punto de rodeo cuando el bot está del
   * lado equivocado. Pegado al balón era inalcanzable sin orbitarlo: el auto no
   * gira lo bastante cerrado.
   */
  aiApproachDistance: 9,
  /**
   * Corrimiento lateral del punto de rodeo. Sin esto el camino directo hasta
   * el punto de atrás pasaba por encima de la pelota y la empujaba al revés.
   */
  aiSwing: 9,
  /**
   * Cuánto adelanta la puntería sobre la posición actual de la pelota, en
   * segundos. Sin esto el bot persigue el lugar donde la pelota estaba y llega
   * siempre tarde.
   */
  aiLeadMax: 0.6,
  /** Distancia al balón en la que intenta el remate con flip. */
  aiShotRange: 9,
  /** Ventaja en el reparto de roles por estar ya del lado bueno de la pelota. */
  aiSideBonus: 7,
  /**
   * Cuánto se mantiene repartido el rol (atacante / apoyo / defensa). Con seis
   * autos cerca de la pelota, el más cercano cambia por frame y los roles
   * bailaban de un auto a otro: ninguno se comprometía con su jugada.
   */
  aiRoleHold: 0.5,
  /**
   * Desempate anti-atasco: si la pelota lleva `aiStallSeconds` casi quieta, el
   * atacante va derecho a ella en vez de a su punto de empuje. Sin esto, dos
   * autos podían quedarse orbitando una pelota muerta sin llegar a tocarla.
   */
  aiStallSeconds: 1.5,
  /** Velocidad por debajo de la cual se considera que la pelota está quieta. */
  aiStallSpeed: 1.5,
  /** Cuánto adentro de la red apunta, para empujar la pelota sobre la línea. */
  aiGoalMouthDepth: 3,
  /** Profundidad a la que se para el apoyo, delante de la pelota. */
  aiSupportDepth: 11,
  /** Separación lateral entre compañeros, para que no vayan en fila. */
  aiSupportSpread: 11,
  /** Cuánto se adelanta el defensor desde su arco hacia la pelota. */
  aiDefendDepth: 19,
  /** Tope de velocidad propio, por debajo del jugador. */
  aiMaxSpeed: 21,
  /** Distancia a la que arranca un flip para ganar velocidad en recta. */
  aiFlipDistance: 26,

  // --- Feel
  fovKick: 10,
  goalShake: 0.55,
  bloomStrength: 0.55,
  bloomRadius: 0.5,
  /**
   * Umbral del bloom. Alto: sólo florecen los emisivos (pads, arcos, pelota,
   * estela). Con 0.62 la pintura clara de los autos florecía y se comía la
   * silueta.
   */
  bloomThreshold: 0.78,

  // --- Persistencia
  storageKeyGoals: 'rocket.bestGoals',
  storageKeyMuted: 'rocket.muted',
  storageKeyMode: 'rocket.mode',
  storageKeyCar: 'rocket.car',
} as const

export const COLORS = {
  blue: 0x2f6bff,
  /** Compañeros de equipo: mismo bando, tono más apagado para distinguirlos. */
  blueBot: 0x1e46b4,
  blueDark: 0x16357f,
  orange: 0xff8a3d,
  orangeDark: 0x8a4310,
  // La cancha va en grises azulados, casi neutros: si el piso también fuera
  // azul saturado, el auto azul del jugador desaparece contra él.
  floor: 0x4a5568,
  floorLine: 0xdfe9ff,
  wall: 0x3d4a63,
  wallEdge: 0x5d6f92,
  ceiling: 0x28303f,
  /** Zócalos y luces: colores por encima del umbral de bloom, para que brillen. */
  trim: 0x9fd0ff,
  lamp: 0xdcecff,
  ball: 0xf4f7ff,
  ballGlow: 0x9fb4ff,
  pad: 0xffc24a,
  padBig: 0xff9a2e,
} as const
