import * as THREE from 'three'

/**
 * Helpers de física, puros y sin estado.
 *
 * Todo lo que resuelve choques vive acá y no toca mallas ni escena: es la parte
 * que se puede testear con node (ver `test/physics.test.ts`). La cancha se
 * representa como una lista de cajas alineadas a los ejes, igual que en `coho`.
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

export interface Contact {
  normal: THREE.Vector3
  depth: number
}

/**
 * Choque esfera-caja. `normal` apunta desde la caja hacia la esfera (la
 * dirección en la que hay que empujarla para sacarla). Devuelve null si no hay
 * contacto.
 */
export function sphereVsBox(
  pos: THREE.Vector3,
  radius: number,
  b: Box,
): Contact | null {
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
  // una esfera que entra de golpe (balón rápido contra una pared) queda atrapada.
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
 * mayor velocidad de impacto normal del frame (0 si no hubo choque), que sirve
 * para dosificar el sonido.
 */
export function resolveSphereBoxes(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  radius: number,
  boxes: readonly Box[],
  restitution: number,
  grip = 0,
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

    // Fricción tangencial: frena el deslizamiento y hace rodar al balón.
    if (grip > 0) {
      const normalVel = contact.normal.clone().multiplyScalar(vel.dot(contact.normal))
      const tangentVel = vel.clone().sub(normalVel)
      vel.addScaledVector(tangentVel, -grip)
    }
  }

  return impact
}

/**
 * Choque elástico entre dos esferas con masa. Empuja `b` fuera de `a` y reparte
 * el impulso según las masas (el caso auto 180 vs pelota 30 sale de acá).
 */
export function sphereVsSphere(
  aPos: THREE.Vector3,
  aVel: THREE.Vector3,
  aRadius: number,
  aMass: number,
  bPos: THREE.Vector3,
  bVel: THREE.Vector3,
  bRadius: number,
  bMass: number,
  restitution: number,
): boolean {
  const dx = bPos.x - aPos.x
  const dy = bPos.y - aPos.y
  const dz = bPos.z - aPos.z
  const radiusSum = aRadius + bRadius
  const distSq = dx * dx + dy * dy + dz * dz

  if (distSq > radiusSum * radiusSum || distSq < 1e-9) return false

  const dist = Math.sqrt(distSq)
  const nx = dx / dist
  const ny = dy / dist
  const nz = dz / dist

  // Separación repartida al revés de la masa: el liviano se corre más.
  const invA = 1 / aMass
  const invB = 1 / bMass
  const invSum = invA + invB
  const push = radiusSum - dist

  aPos.x -= nx * push * (invA / invSum)
  aPos.y -= ny * push * (invA / invSum)
  aPos.z -= nz * push * (invA / invSum)
  bPos.x += nx * push * (invB / invSum)
  bPos.y += ny * push * (invB / invSum)
  bPos.z += nz * push * (invB / invSum)

  // Impulso a lo largo de la normal. `n` va de a hacia b.
  const vn = (aVel.x - bVel.x) * nx + (aVel.y - bVel.y) * ny + (aVel.z - bVel.z) * nz
  if (vn <= 0) return true

  const j = ((1 + restitution) * vn) / invSum
  aVel.x -= nx * j * invA
  aVel.y -= ny * j * invA
  aVel.z -= nz * j * invA
  bVel.x += nx * j * invB
  bVel.y += ny * j * invB
  bVel.z += nz * j * invB

  return true
}

/** Arrastre lineal: dv/dt = -k·v, resuelto en forma cerrada. */
export function applyDrag(vel: THREE.Vector3, k: number, dt: number): void {
  vel.multiplyScalar(Math.exp(-k * dt))
}

/** Limita el módulo de la velocidad, preservando la dirección. */
export function clampSpeed(vel: THREE.Vector3, max: number): void {
  const speed = vel.length()
  if (speed > max && speed > 1e-9) vel.setLength(max)
}

/**
 * Plano infinito, en la forma `normal·p = offset`.
 *
 * Se usa para la rampa del pie de las paredes laterales. Sin ella, una pelota
 * contra la pared queda clavada: desde el campo sólo se la puede empujar hacia
 * la pared, nunca sacarla. La rampa la devuelve al campo sola, igual que en RL.
 */
export interface Plane {
  normal: THREE.Vector3
  offset: number
}

/** Plano a partir de un punto y una normal (que se normaliza). */
export function plane(px: number, py: number, pz: number, nx: number, ny: number, nz: number): Plane {
  const normal = new THREE.Vector3(nx, ny, nz).normalize()
  return { normal, offset: normal.x * px + normal.y * py + normal.z * pz }
}

/**
 * Resuelve la esfera contra una lista de planos, mutando `pos` y `vel`. Misma
 * convención que `resolveSphereBoxes`: devuelve la mayor velocidad de impacto.
 */
export function resolveSpherePlanes(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  radius: number,
  planes: readonly Plane[],
  restitution: number,
  grip = 0,
): number {
  let impact = 0

  for (const p of planes) {
    const dist = p.normal.dot(pos) - p.offset
    if (dist >= radius) continue

    pos.addScaledVector(p.normal, radius - dist)

    const vn = vel.dot(p.normal)
    if (vn >= 0) continue

    impact = Math.max(impact, -vn)
    const e = -vn < 0.5 ? 0 : restitution
    vel.addScaledVector(p.normal, -(1 + e) * vn)

    if (grip > 0) {
      const normalVel = p.normal.clone().multiplyScalar(vel.dot(p.normal))
      vel.addScaledVector(vel.clone().sub(normalVel), -grip)
    }
  }

  return impact
}

/**
 * Gol: el centro del balón cruzó la línea del arco y está dentro del rectángulo
 * de la boca. `sign` es +1 si el arco está en z positivo.
 *
 * Ojo: hay que comparar en el espacio con signo. Comparar `sign * pos.z` contra
 * `lineZ` sin transformar invierte el arco de z negativo y lo detecta en todo el
 * campo (el balón en el centro contaba como gol).
 */
export function insideGoal(
  pos: THREE.Vector3,
  lineZ: number,
  sign: number,
  halfWidth: number,
  height: number,
  ballRadius: number,
): boolean {
  if (sign * pos.z < sign * lineZ + ballRadius) return false
  if (Math.abs(pos.x) > halfWidth) return false
  if (pos.y < 0 || pos.y > height) return false
  return true
}
