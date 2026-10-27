/**
 * Modos de juego y equipos.
 *
 * Un modo es cuántos autos hay por lado. El jugador siempre es el azul y
 * siempre el primero de su equipo; el resto son bots.
 */
export type Team = 'blue' | 'orange'
export type GameMode = 'training' | 'duel' | 'threes'

export interface Roster {
  blue: number
  orange: number
  /** Nombre del modo, para el panel. */
  label: string
  tagline: string
}

export const MODES: Record<GameMode, Roster> = {
  training: {
    blue: 1,
    orange: 0,
    label: 'Entrenamiento',
    tagline: 'Solo vos, la pelota y los arcos. Sin reloj: R trae la pelota al centro.',
  },
  duel: {
    blue: 1,
    orange: 1,
    label: '1 vs 1',
    tagline: 'Vos contra un bot. Cinco minutos; si hay empate, gol de oro.',
  },
  threes: {
    blue: 3,
    orange: 3,
    label: '3 vs 3',
    tagline: 'Vos y dos compañeros contra tres bots. Cinco minutos; si hay empate, gol de oro.',
  },
}

export const MODE_ORDER: GameMode[] = ['training', 'duel', 'threes']

/** Valida el valor que viene de `localStorage`, que puede ser cualquier cosa. */
export function isGameMode(value: string | null): value is GameMode {
  return value === 'training' || value === 'duel' || value === 'threes'
}
