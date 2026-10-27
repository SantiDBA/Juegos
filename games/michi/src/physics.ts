import * as THREE from 'three'

/**
 * Física mínima del juego: una esfera contra cajas alineadas a los ejes.
 *
 * Todo lo que resuelve choques vive acá y no toca mallas ni escena: es la parte
 * pura. La casa se representa como una lista de cajas (paredes y muebles) y el
 * gato como una esfera de radio fijo. El piso no es una caja: es un clamp a
 * y=0, porque la casa no tiene desniveles.
 */
export interface Box {
  readonly min: THREE.Vector3
  readonly max: THREE.Vector3
}

/** Caja a partir de su centro y sus tres lados. */
export function box(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): Box {
  return {
    min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Mueve `current` hacia `target` como máximo `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target)
  return Math.max(current - maxDelta, target)
}

/** Gira `current` hacia `target` (en radianes) por el camino más corto. */
export function approachAngle(current: number, target: number, maxDelta: number): number {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return current + clamp(delta, -maxDelta, maxDelta)
}

export interface Contact {
  normal: THREE.Vector3
  depth: number
}

/**
 * Choque esfera-caja. `normal` apunta desde la caja hacia la esfera (la
 * dirección en la que hay que empujarla para sacarla). Devuelve null si no hay
 * contacto.
 */
export function sphereVsBox(pos: THREE.Vector3, radius: number, b: Box): Contact | null {
  const cx = clamp(pos.x, b.min.x, b.max.x)
  const cy = clamp(pos.y, b.min.y, b.max.y)
  const cz = clamp(pos.z, b.min.z, b.max.z)
  const dx = pos.x - cx
  const dy = pos.y - cy
  const dz = pos.z - cz
  const distSq = dx * dx + dy * dy + dz * dz

  if (distSq > radius * radius) return null

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq)
    return {
      normal: new THREE.Vector3(dx / dist, dy / dist, dz / dist),
      depth: radius - dist,
    }
  }

  // Centro dentro de la caja: se sale por la cara más cercana. Sin este caso,
  // una esfera que entra de golpe queda atrapada adentro.
  const toMinX = pos.x - b.min.x
  const toMaxX = b.max.x - pos.x
  const toMinY = pos.y - b.min.y
  const toMaxY = b.max.y - pos.y
  const toMinZ = pos.z - b.min.z
  const toMaxZ = b.max.z - pos.z
  const m = Math.min(toMinX, toMaxX, toMinY, toMaxY, toMinZ, toMaxZ)

  const normal = new THREE.Vector3()
  if (m === toMinX) normal.set(-1, 0, 0)
  else if (m === toMaxX) normal.set(1, 0, 0)
  else if (m === toMinY) normal.set(0, -1, 0)
  else if (m === toMaxY) normal.set(0, 1, 0)
  else if (m === toMinZ) normal.set(0, 0, -1)
  else normal.set(0, 0, 1)

  return { normal, depth: m + radius }
}

/**
 * Resuelve la esfera contra todas las cajas, mutando `pos` y `vel`. Devuelve la
 * mayor velocidad de impacto normal del frame (0 si no hubo choque).
 */
export function resolveSphereBoxes(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  radius: number,
  boxes: readonly Box[],
  restitution: number,
): number {
  let impact = 0

  for (const b of boxes) {
    const contact = sphereVsBox(pos, radius, b)
    if (!contact) continue

    pos.addScaledVector(contact.normal, contact.depth)

    const vn = vel.dot(contact.normal)
    if (vn >= 0) continue

    impact = Math.max(impact, -vn)

    // Apoyado (velocidad normal ínfima): sin rebote, para que no vibre.
    const e = -vn < 0.5 ? 0 : restitution
    vel.addScaledVector(contact.normal, -(1 + e) * vn)
  }

  return impact
}
