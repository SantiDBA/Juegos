import * as THREE from 'three'
import { COLORS, TUNING } from './config'
import {
  applyDrag,
  clampSpeed,
  resolveSphereBoxes,
  resolveSpherePlanes,
  sphereVsSphere,
  type Box,
  type Plane,
} from './physics'
import type { Car } from './car'

/**
 * La pelota: gravedad, arrastre, rebote con el 60% de restitución (como RL) y
 * choques por masa contra los autos. El momento se conserva: un auto de 180
 * contra un balón de 30 sale disparando, el auto casi no se frena.
 */
export class Ball {
  readonly pos = new THREE.Vector3()
  readonly vel = new THREE.Vector3()
  readonly radius = TUNING.ballRadius
  readonly mesh: THREE.Mesh

  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.MeshStandardMaterial
  private readonly spinAxis = new THREE.Vector3()
  /** Destello del último golpe fuerte, se apaga solo. */
  private flash = 0

  constructor() {
    // Icosaedro con caras planas: se lee facetado y gira de forma visible,
    // que es lo que hace legible la rotación del balón.
    this.geometry = new THREE.IcosahedronGeometry(TUNING.ballRadius, 2)
    this.material = new THREE.MeshStandardMaterial({
      color: COLORS.ball,
      emissive: COLORS.ballGlow,
      emissiveIntensity: 0.18,
      roughness: 0.42,
      metalness: 0.12,
      flatShading: true,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
  }

  reset(z = 0): void {
    this.pos.set(0, this.radius * 1.02, z)
    this.vel.set(0, 0, 0)
    this.mesh.position.copy(this.pos)
    this.mesh.quaternion.identity()
  }

  /** Avanza la simulación. Devuelve la mayor velocidad de impacto del frame. */
  update(dt: number, colliders: readonly Box[], planes: readonly Plane[]): number {
    applyDrag(this.vel, TUNING.ballDrag, dt)
    this.vel.y -= TUNING.gravity * dt
    this.pos.addScaledVector(this.vel, dt)

    const boxImpact = resolveSphereBoxes(
      this.pos,
      this.vel,
      this.radius,
      colliders,
      TUNING.ballRestitution,
      TUNING.ballGrip,
    )
    const planeImpact = resolveSpherePlanes(
      this.pos,
      this.vel,
      this.radius,
      planes,
      TUNING.ballRestitution,
      TUNING.ballGrip,
    )
    const impact = Math.max(boxImpact, planeImpact)

    clampSpeed(this.vel, TUNING.ballMaxSpeed)

    // El destello del golpe se apaga solo.
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.4)
      this.material.emissiveIntensity = 0.18 + this.flash * 1.5
    }

    this.mesh.position.copy(this.pos)

    // Giro visual: rueda sobre el eje perpendicular a su velocidad horizontal.
    const speed = Math.hypot(this.vel.x, this.vel.z)
    if (speed > 0.05) {
      this.spinAxis.set(this.vel.z, 0, -this.vel.x).normalize()
      this.mesh.rotateOnWorldAxis(this.spinAxis, (speed / this.radius) * dt * 0.6)
    }

    return impact
  }

  /**
   * Choque contra un auto. Devuelve la velocidad que ganó el balón (0 si no se
   * tocaron), para dosificar el sonido y el efecto.
   */
  collideCar(car: Car): number {
    const before = this.vel.length()

    const hit = sphereVsSphere(
      car.pos,
      car.vel,
      car.radius,
      TUNING.carMass,
      this.pos,
      this.vel,
      this.radius,
      TUNING.ballMass,
      TUNING.carBallRestitution,
    )
    if (!hit) return 0

    // El flip es lo que da potencia: en RL el dodge suma su impulso al choque.
    if (car.flipping) this.vel.addScaledVector(car.forward, TUNING.hitFlipBonus)
    else if (car.supersonic) this.vel.addScaledVector(car.forward, TUNING.hitSuperBonus)

    clampSpeed(this.vel, TUNING.ballMaxSpeed)
    return this.vel.length() - before
  }

  /** Destello al recibir un golpe fuerte; `strength` es la velocidad ganada. */
  flashHit(strength: number): void {
    this.flash = Math.max(this.flash, Math.min(1, strength / 14))
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
