/**
 * Los chasis del juego, como datos puros.
 *
 * Este módulo no importa nada a propósito: así el test lo puede cargar con
 * `node --experimental-strip-types`, que no resuelve imports relativos sin
 * extensión. El armado de la geometría vive en `cars.ts`.
 *
 * El radio de colisión y la altura del origen van acá y no en `TUNING` porque
 * son parte de la forma: si cambia el chasis cambia el hitbox, igual que en
 * Rocket League (Octane, Dominus y Breakout pegan distinto).
 */
export type CarStyleId = 'octane' | 'dominus' | 'breakout' | 'truck'

export interface CarStyle {
  id: CarStyleId
  name: string
  /** Largo, ancho y alto del cuerpo. */
  length: number
  width: number
  height: number
  /** Altura del centro del cuerpo sobre el origen del auto. */
  bodyLift: number
  wheelRadius: number
  wheelWidth: number
  /** Distancia de cada eje al centro. */
  axle: number
  /** Cuánto sobresale la rueda respecto del costado del cuerpo. */
  wheelOutset: number
  cabinLength: number
  cabinHeight: number
  /** Corrimiento de la cabina hacia atrás (el frente es -z). */
  cabinOffset: number
  /** Cuánto baja el morro respecto del techo. */
  noseDrop: number
  spoiler: boolean
  /** Radio de la esfera de colisión. Tiene que cubrir el cuerpo. */
  radius: number
  /** Altura del origen sobre el piso con el auto apoyado. */
  halfHeight: number
}

export const CAR_STYLES: Record<CarStyleId, CarStyle> = {
  octane: {
    id: 'octane',
    name: 'Octane',
    length: 1.18,
    width: 0.84,
    height: 0.3,
    bodyLift: 0.03,
    wheelRadius: 0.18,
    wheelWidth: 0.16,
    axle: 0.38,
    wheelOutset: 0.02,
    cabinLength: 0.44,
    cabinHeight: 0.2,
    cabinOffset: 0.1,
    noseDrop: 0.1,
    spoiler: true,
    radius: 0.62,
    halfHeight: 0.32,
  },
  dominus: {
    id: 'dominus',
    name: 'Dominus',
    length: 1.3,
    width: 1,
    height: 0.26,
    bodyLift: 0.02,
    wheelRadius: 0.17,
    wheelWidth: 0.17,
    axle: 0.42,
    wheelOutset: 0.03,
    cabinLength: 0.46,
    cabinHeight: 0.17,
    cabinOffset: 0.12,
    noseDrop: 0.07,
    spoiler: false,
    radius: 0.68,
    halfHeight: 0.3,
  },
  breakout: {
    id: 'breakout',
    name: 'Breakout',
    length: 1.42,
    width: 0.82,
    height: 0.27,
    bodyLift: 0.02,
    wheelRadius: 0.17,
    wheelWidth: 0.15,
    axle: 0.48,
    wheelOutset: 0.02,
    cabinLength: 0.42,
    cabinHeight: 0.18,
    cabinOffset: 0.14,
    noseDrop: 0.13,
    spoiler: true,
    radius: 0.74,
    halfHeight: 0.3,
  },
  truck: {
    id: 'truck',
    name: 'Camioneta',
    length: 1.24,
    width: 0.94,
    height: 0.46,
    bodyLift: 0.1,
    wheelRadius: 0.26,
    wheelWidth: 0.2,
    axle: 0.4,
    wheelOutset: 0.04,
    cabinLength: 0.5,
    cabinHeight: 0.3,
    cabinOffset: 0.06,
    noseDrop: 0.05,
    spoiler: false,
    radius: 0.66,
    halfHeight: 0.44,
  },
}

export const CAR_ORDER: CarStyleId[] = ['octane', 'dominus', 'breakout', 'truck']

export function isCarStyleId(value: string | null): value is CarStyleId {
  return value === 'octane' || value === 'dominus' || value === 'breakout' || value === 'truck'
}

/** Lado x del centro de rueda, para que la rueda quede justo al costado. */
export function wheelOffsetX(style: CarStyle): number {
  return style.width / 2 + style.wheelOutset
}
