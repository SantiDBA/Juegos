import * as THREE from 'three'
import { TUNING } from './config'
import type { Box } from './level'

export class PlayerController {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  grounded = false
  /** Saltos disponibles en el aire: 1 sin power-up, 2 con salto doble. */
  private airJumps = 0
  /** Máximo de saltos aéreo permitidos (0 normal, 1 con doble salto). */
  private maxAirJumps = 0
  /** Multiplicador de velocidad aplicado por los power-ups. */
  speedMultiplier = 1

  private yaw = 0
  private pitch = 0
  private readonly colliders: Box[]
  private readonly wishDir = new THREE.Vector3()
  /** true sólo en el frame del aterrizaje; lo consume `updatePlaying`. */
  private landed = false
  /** Velocidad vertical antes de resolver el suelo del frame actual. */
  private lastFallSpeed_ = 0

  constructor(
    spawn: THREE.Vector3,
    colliders: Box[],
  ) {
    this.colliders = colliders
    this.position.copy(spawn)
  }

  reset(spawn: THREE.Vector3): void {
    this.position.copy(spawn)
    this.velocity.set(0, 0, 0)
    this.yaw = 0
    this.pitch = 0
    this.grounded = false
    this.airJumps = 0
    this.speedMultiplier = 1
    this.landed = false
    this.lastFallSpeed_ = 0
  }

  /** Habilita el salto en el aire para esta partida. */
  enableDoubleJump(): void {
    this.maxAirJumps = 1
    this.airJumps = this.maxAirJumps
  }

  /** Deshabilita el salto doble (al expirar el power-up). */
  disableDoubleJump(): void {
    this.maxAirJumps = 0
    this.airJumps = 0
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * TUNING.mouseSensitivity
    this.pitch -= dy * TUNING.mouseSensitivity
    const limit = Math.PI / 2 - 0.02
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch))
  }

  private forwardVector(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    )
  }

  update(input: { forward: number; strafe: number; run: boolean }, dt: number): void {
    this.move(input, dt)
    this.velocity.y += TUNING.gravity * dt
    this.position.y += this.velocity.y * dt
    this.resolveVertical()
  }

  private move(input: { forward: number; strafe: number; run: boolean }, dt: number): void {
    const speed =
      (input.run ? TUNING.runSpeed : TUNING.walkSpeed) * this.speedMultiplier
    const control = this.grounded ? 1 : TUNING.airControl

    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    // adelante = (-sin, 0, -cos); derecha = (cos, 0, -sin)
    const targetX = -sin * input.forward + cos * input.strafe
    const targetZ = -cos * input.forward - sin * input.strafe
    const len = Math.hypot(targetX, targetZ)

    if (len > 0.0001) {
      this.wishDir.set((targetX / len) * speed, 0, (targetZ / len) * speed)
    } else {
      this.wishDir.set(0, 0, 0)
    }

    const a = TUNING.accel * control * dt
    this.velocity.x = approach(this.velocity.x, this.wishDir.x, a)
    this.velocity.z = approach(this.velocity.z, this.wishDir.z, a)

    if (this.grounded && len < 0.0001) {
      const f = Math.max(0, 1 - TUNING.friction * dt)
      this.velocity.x *= f
      this.velocity.z *= f
    }

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.resolveHorizontal()
  }

  private resolveHorizontal(): void {
    const r = TUNING.playerRadius
    const h = TUNING.playerHeight

    for (const b of this.colliders) {
      // Ignorar la caja si el jugador está parado sobre su superficie superior
      // (o dentro del rango de step-up): eso lo resuelve resolveVertical.
      if (this.position.y >= b.max.y - TUNING.maxStepHeight) continue
      if (this.position.y + h <= b.min.y) continue

      const cx = clamp(this.position.x, b.min.x, b.max.x)
      const cz = clamp(this.position.z, b.min.z, b.max.z)
      const dx = this.position.x - cx
      const dz = this.position.z - cz
      const distSq = dx * dx + dz * dz

      if (distSq >= r * r) continue

      if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq)
        const push = r - dist
        this.position.x += (dx / dist) * push
        this.position.z += (dz / dist) * push
        const n = new THREE.Vector3(dx / dist, 0, dz / dist)
        this.velocity.addScaledVector(n, -this.velocity.dot(n))
      } else {
        // Centro dentro de la caja: empujar por el eje de menor penetración
        const pushLeft = this.position.x - b.min.x
        const pushRight = b.max.x - this.position.x
        const pushBack = this.position.z - b.min.z
        const pushFront = b.max.z - this.position.z
        const min = Math.min(pushLeft, pushRight, pushBack, pushFront)
        if (min === pushLeft) {
          this.position.x = b.min.x - r
          this.velocity.x = Math.min(0, this.velocity.x)
        } else if (min === pushRight) {
          this.position.x = b.max.x + r
          this.velocity.x = Math.max(0, this.velocity.x)
        } else if (min === pushBack) {
          this.position.z = b.min.z - r
          this.velocity.z = Math.min(0, this.velocity.z)
        } else {
          this.position.z = b.max.z + r
          this.velocity.z = Math.max(0, this.velocity.z)
        }
      }
    }
  }

  private resolveVertical(): void {
    const r = TUNING.playerRadius
    const h = TUNING.playerHeight

    // Estado de apoyo ANTES de resolver. `this.grounded` se pisa a false más
    // abajo, así que hay que leerlo ahora para saber si veníamos del aire.
    const wasGrounded = this.grounded
    this.grounded = false

    // Se guarda la velocidad de caída ANTES de resolver: al aterrizar queda en
    // 0 y el impacto se perdería.
    this.lastFallSpeed_ = this.velocity.y

    let supportY = -Infinity
    let ceilingY = Infinity

    for (const b of this.colliders) {
      // Intersección horizontal
      const cx = clamp(this.position.x, b.min.x, b.max.x)
      const cz = clamp(this.position.z, b.min.z, b.max.z)
      const dx = this.position.x - cx
      const dz = this.position.z - cz
      if (dx * dx + dz * dz >= r * r) continue

      const feet = this.position.y
      const head = this.position.y + h

      // Candidato a suelo: superficie superior reachable por step-up.
      // Se elige la MÁS ALTA entre todas las cajas candidatas; si no, el
      // jugador cae de nuevo a la plataforma inferior (comportamiento
      // esperado al bajar escalones).
      if (feet >= b.max.y - TUNING.maxStepHeight && b.max.y > supportY) {
        supportY = b.max.y
      }

      // Candidato a techo: cara inferior de una caja que nos atraviesa.
      if (head > b.min.y && head <= b.min.y + TUNING.maxStepHeight && b.min.y < ceilingY) {
        ceilingY = b.min.y
      }
    }

    if (supportY > -Infinity && this.velocity.y <= 0) {
      this.position.y = supportY
      this.velocity.y = 0
      this.grounded = true
      // Al aterrizar se recarga el salto aéreo.
      if (!wasGrounded) this.airJumps = this.maxAirJumps
    } else if (ceilingY < Infinity && this.velocity.y > 0) {
      this.position.y = ceilingY - h
      this.velocity.y = 0
    }

    // `landed` marca SOLO este frame: true si veníamos del aire y ahora hay
    // suelo. Se recalcula en cada update, sin estado acumulado.
    this.landed = !wasGrounded && this.grounded
  }

  /** true en el frame en que el jugador toca suelo tras estar en el aire. */
  get justLanded(): boolean {
    return this.landed
  }

  jump(): boolean {
    if (this.grounded) {
      this.velocity.y = TUNING.jumpVelocity
      this.grounded = false
      return true
    }
    if (this.airJumps > 0) {
      this.airJumps -= 1
      this.velocity.y = TUNING.jumpVelocity
      return true
    }
    return false
  }

  /**
 * Fija la orientación mirando a un punto del mundo. Más simple y seguro que
 * acumular deltas de mouse: la usa el helper de depuración.
 */
  setLookAt(target: THREE.Vector3): void {
    const dx = target.x - this.position.x
    const dy = target.y - (this.position.y + TUNING.playerHeight + TUNING.eyeOffset)
    const dz = target.z - this.position.z
    this.yaw = Math.atan2(-dx, -dz)
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz))
    const limit = Math.PI / 2 - 0.02
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch))
  }

  /** Velocidad horizontal actual, para el cabeceo y el FOV kick. */
  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  /**
   * Velocidad vertical del frame anterior al aterrizaje.
   *
   * El impacto se mide con esto porque al tocar suelo `velocity.y` ya vale 0:
   * leerlo después daría siempre el mismo hundimiento.
   */
  get lastFallSpeed(): number {
    return this.lastFallSpeed_
  }

  getEyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      this.position.x,
      this.position.y + TUNING.playerHeight + TUNING.eyeOffset,
      this.position.z,
    )
  }

  getViewDirection(out: THREE.Vector3): THREE.Vector3 {
    return this.forwardVector(out)
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current
  if (Math.abs(diff) <= maxDelta) return target
  return current + Math.sign(diff) * maxDelta
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
