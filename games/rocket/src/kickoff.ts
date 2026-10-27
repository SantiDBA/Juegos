import type { Rng } from './rng'
import type { Team } from './mode'

export interface Spawn {
  x: number
  z: number
  yaw: number
}

export interface KickoffOptions {
  /** Distancia de todos los autos a la pelota, que es la misma para todos. */
  radius: number
  /** Media apertura del abanico de posiciones, en radianes. */
  spread: number
}

/**
 * Posiciones de kickoff.
 *
 * Todos los autos salen sobre un círculo de radio `radius` alrededor de la
 * pelota, dentro de su propio campo y mirando al centro. El ángulo se sortea
 * dentro del abanico del equipo, repartido en tantas franjas como autos haya
 * para que no se pisen: así cada kickoff es distinto pero nadie arranca más
 * cerca de la pelota que otro, y no siempre se sale en línea recta al arco.
 *
 * No importa `TUNING` a propósito: recibe los números por parámetro. Sin eso el
 * módulo arrastraría un import relativo, y el test no podría correrlo con
 * `node --experimental-strip-types`, que exige la extensión en cada import.
 */
export function kickoffSpawns(
  team: Team,
  count: number,
  rng: Rng,
  options: KickoffOptions,
): Spawn[] {
  if (count <= 0) return []

  // El azul defiende z negativo, así que su abanico apunta hacia -z (y al revés).
  const base = team === 'blue' ? -Math.PI / 2 : Math.PI / 2
  const slot = (options.spread * 2) / count
  const spawns: Spawn[] = []

  for (let i = 0; i < count; i++) {
    const center = base - options.spread + slot * (i + 0.5)
    const angle = center + rng.range(-slot * 0.3, slot * 0.3)
    const x = Math.cos(angle) * options.radius
    const z = Math.sin(angle) * options.radius
    // `forward` es (-sin yaw, 0, -cos yaw): con yaw = atan2(x, z) el auto queda
    // mirando al origen, que es donde está la pelota.
    spawns.push({ x, z, yaw: Math.atan2(x, z) })
  }

  return spawns
}
