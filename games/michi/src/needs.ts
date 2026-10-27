/**
 * Las necesidades del gato: lógica pura, sin Three.js ni DOM.
 *
 * Es la única fuente de verdad de qué necesidades hay, cuánto bajan y cuánto
 * tarda satisfacerlas. Se testea sola con node (ver `test/needs.test.ts`), por
 * eso no importa nada del juego.
 */
export type NeedId = 'comer' | 'higiene' | 'diversion' | 'energia' | 'banio'

export interface NeedDef {
  readonly id: NeedId
  /** Etiqueta corta del HUD. */
  readonly label: string
  /** Emoji del HUD y del icono flotante sobre el mueble. */
  readonly emoji: string
  /** Acción en infinitivo, para el cartel de interacción. */
  readonly action: string
  /** Puntos que baja por segundo. Bajas a propósito: la partida no termina. */
  readonly decay: number
  /** Segundos que tarda en llenarse de 0 a 100. */
  readonly duration: number
}

export const NEEDS_MAX = 100
/**
 * Con lo que arranca cada necesidad. Alto a propósito: la partida es infinita y
 * la idea es cuidar al gato, no sufrir. Con 85 hay casi dos minutos de aire
 * antes de que la primera se vacíe.
 */
export const NEEDS_START = 85
/** Por debajo de esto el HUD avisa y la flecha guía apunta ahí. */
export const CRITICAL = 24
/**
 * Por debajo de esto se puede empezar una actividad. El umbral es necesario:
 * sin él, quedarse apoyado en E sobre una necesidad casi llena la vuelve a
 * completar apenas baja medio punto, y el contador de cuidados se farmea solo.
 */
export const READY_BELOW = 90

/** El orden manda: es el de las barras del HUD y el de las vueltas internas. */
export const NEED_ORDER: readonly NeedId[] = [
  'comer',
  'higiene',
  'diversion',
  'energia',
  'banio',
]

export const NEEDS: Record<NeedId, NeedDef> = {
  comer: {
    id: 'comer',
    label: 'comida',
    emoji: '🍽️',
    action: 'comer',
    decay: 0.75,
    duration: 2.6,
  },
  higiene: {
    id: 'higiene',
    label: 'higiene',
    emoji: '🛁',
    action: 'bañarse',
    decay: 0.55,
    duration: 3.2,
  },
  diversion: {
    id: 'diversion',
    label: 'jugar',
    emoji: '🧶',
    action: 'jugar',
    decay: 0.7,
    duration: 2.4,
  },
  energia: {
    id: 'energia',
    label: 'energía',
    emoji: '😴',
    action: 'dormir',
    decay: 0.62,
    duration: 4.2,
  },
  banio: {
    id: 'banio',
    label: 'arenero',
    emoji: '🚽',
    action: 'usar el arenero',
    decay: 0.45,
    duration: 2.2,
  },
}

export type Needs = Record<NeedId, number>

export function createNeeds(start = NEEDS_START): Needs {
  const needs = {} as Needs
  for (const id of NEED_ORDER) needs[id] = start
  return needs
}

/**
 * Baja todas las necesidades un frame y devuelve las que quedaron en cero.
 *
 * No hay penalidad por vaciarse: la partida es infinita y el gato nunca se
 * muere. Lo que devuelve es la señal para ponerlo mustio y avisar, nada más. Se
 * clampean a 0 para que el HUD nunca muestre un negativo.
 */
export function decayNeeds(needs: Needs, dt: number, multiplier: number): NeedId[] {
  const atZero: NeedId[] = []
  for (const id of NEED_ORDER) {
    const next = needs[id] - NEEDS[id].decay * multiplier * dt
    if (next <= 0) {
      needs[id] = 0
      atZero.push(id)
    } else {
      needs[id] = Math.min(NEEDS_MAX, next)
    }
  }
  return atZero
}

/**
 * Llena una necesidad mientras el gato hace la actividad. Devuelve el valor
 * nuevo: el progreso de la actividad *es* la barra de la necesidad, así no hay
 * que llevar dos contadores en paralelo.
 */
export function fillNeed(needs: Needs, id: NeedId, dt: number): number {
  const rate = NEEDS_MAX / NEEDS[id].duration
  needs[id] = Math.min(NEEDS_MAX, needs[id] + rate * dt)
  return needs[id]
}

export function satisfy(needs: Needs, id: NeedId): void {
  needs[id] = NEEDS_MAX
}

export function isFull(value: number): boolean {
  return value >= NEEDS_MAX - 0.5
}

/** ¿Hay algo que hacer acá, o la necesidad todavía está bien? */
export function canAttend(value: number): boolean {
  return value < READY_BELOW
}

export function isCritical(value: number): boolean {
  return value <= CRITICAL
}

/** La necesidad más urgente (la de menor valor). Nunca devuelve null: siempre hay 5. */
export function mostUrgent(needs: Needs): NeedId {
  let worst = NEED_ORDER[0]!
  for (const id of NEED_ORDER) {
    if (needs[id] < needs[worst]) worst = id
  }
  return worst
}
