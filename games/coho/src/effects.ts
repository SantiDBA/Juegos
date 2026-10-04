import * as THREE from 'three'
import { TUNING } from './config'

/**
 * Pool de partículas de un solo tipo. Al colectar un orbe se emiten N puntos
 * que se expanden y desvanecen; sin asignaciones por frame.
 */
export class BurstParticles {
  readonly points: THREE.Points

  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly velocities: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly capacity: number
  private cursor = 0
  private geometry: THREE.BufferGeometry
  private material: THREE.PointsMaterial

  constructor(capacity = 600) {
    this.capacity = capacity
    this.positions = new Float32Array(capacity * 3)
    this.colors = new Float32Array(capacity * 3)
    this.velocities = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)

    // Empezan invisibles (posición muy lejos y vida 0).
    for (let i = 0; i < capacity; i++) {
      this.positions[i * 3 + 1] = -9999
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3),
    )
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  /** Emite `count` partículas desde `origin` con el color dado. */
  burst(origin: THREE.Vector3, color: THREE.Color, count = 18, speed = 4): void {
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.capacity

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const s = speed * (0.35 + Math.random() * 0.65)
      this.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * s
      this.velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * s * 0.8 + 1.5
      this.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s

      this.positions[i * 3] = origin.x
      this.positions[i * 3 + 1] = origin.y
      this.positions[i * 3 + 2] = origin.z

      this.colors[i * 3] = color.r
      this.colors[i * 3 + 1] = color.g
      this.colors[i * 3 + 2] = color.b

      const life = 0.5 + Math.random() * 0.5
      this.life[i] = life
      this.maxLife[i] = life
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.color.needsUpdate = true
  }

  update(dt: number): void {
    const drag = Math.max(0, 1 - dt * 2.2)
    let alive = false

    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue
      alive = true
      this.life[i] -= dt

      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -9999
        continue
      }

      this.velocities[i * 3] *= drag
      this.velocities[i * 3 + 1] = this.velocities[i * 3 + 1] * drag - 6 * dt
      this.velocities[i * 3 + 2] *= drag

      this.positions[i * 3] += this.velocities[i * 3] * dt
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt

      // Desvanecido: se acerca al color de fondo
      const t = this.life[i] / this.maxLife[i]
      const dim = t * t
      this.colors[i * 3] *= 0.96 + dim * 0.04
      this.colors[i * 3 + 1] *= 0.96 + dim * 0.04
      this.colors[i * 3 + 2] *= 0.96 + dim * 0.04
    }

    if (alive) {
      this.geometry.attributes.position.needsUpdate = true
      this.geometry.attributes.color.needsUpdate = true
    }
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.life[i] = 0
      this.positions[i * 3 + 1] = -9999
    }
    this.geometry.attributes.position.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/**
 * Screen shake y FOV kick. Devuelve un offset de cámara y un FOV tweaked que
 * `main.ts` aplica después de posicionar la cámara del jugador.
 */
export class CameraFeel {
  private shake = 0
  private shakeDecay = 0
  private fovTarget = 0
  private readonly offset = new THREE.Vector3()
  /** Fase del cabeceo: avanza con la velocidad real, no con la del slowmo. */
  private bobPhase = 0
  /** Desplazamiento vertical del cabeceo, con inercia. */
  private bobOffset = 0
  /** Hundimiento por aterrizaje, en curso de recuperación. */
  private dip = 0
  /** Desplazamiento lateral del cabeceo, con inercia. */
  private roll = 0

  constructor(private readonly baseFov = 75) {}

  /** Sacudida con decaimiento: `amount` es el desplazamiento inicial. */
  addShake(amount: number, duration = 0.28): void {
    this.shake = Math.max(this.shake, amount)
    this.shakeDecay = duration
  }

  /** Empuja el FOV hacia `base + kick` y vuelve solo. */
  addFovKick(kick: number): void {
    this.fovTarget = Math.max(this.fovTarget, kick)
  }

  /** Hundimiento de cámara al aterrizar. */
  addLandDip(amount: number = TUNING.landDip): void {
    this.dip = Math.min(TUNING.landDip * 2, this.dip + amount)
  }

  /**
   * Avanza el cabeceo.
   *
   * `speed01` es la velocidad horizontal normalizada (0 quieto, 1 esprintar)
   * y `grounded` evita que el cabeceo siga en el aire. Se interpola hacia el
   * objetivo para que empezar y detener la carrera no dé un tirón.
   */
  updateBob(dt: number, speed01: number, grounded: boolean): void {
    const target = grounded ? speed01 : 0
    const smoothing = Math.min(1, dt * 9)

    if (target > 0.05) {
      const rate = target > 1 ? TUNING.runBobMultiplier : 1
      this.bobPhase += dt * TUNING.bobFrequency * rate
    }

    // Seno para el vertical, su complemento para el lateral: un paso completo
    // por ciclo, como caminar de verdad.
    const amp = TUNING.bobAmplitude * target
    const bobY = Math.sin(this.bobPhase * 2) * amp
    const bobX = Math.sin(this.bobPhase) * amp * 0.7

    this.bobOffset += (bobY - this.bobOffset) * smoothing
    this.roll += (bobX - this.roll) * smoothing
  }

  update(dt: number, camera: THREE.PerspectiveCamera, elapsed: number): void {
    // El hundimiento se recupera solo, con velocidad constante.
    if (this.dip > 0) {
      this.dip = Math.max(0, this.dip - TUNING.landDipSpeed * dt)
    }

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - (this.shake * dt) / Math.max(dt, this.shakeDecay))
      const a = elapsed * 47
      this.offset.set(
        Math.sin(a) * this.shake,
        Math.cos(a * 1.3) * this.shake,
        Math.sin(a * 0.7) * this.shake * 0.5,
      )
      camera.position.add(this.offset)
    }

    // Cabeceo y hundimiento van en la altura; el lateral, en el balanceo.
    camera.position.y += this.bobOffset - this.dip
    camera.rotateZ(this.roll * 0.6)

    if (this.fovTarget > 0) {
      this.fovTarget = Math.max(0, this.fovTarget - dt * (TUNING.fovKick + 8))
    }
    const targetFov = this.baseFov + this.fovTarget
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10)
      camera.updateProjectionMatrix()
    }
  }

  /** FOV extra actual, para el HUD si hiciera falta. */
  get fovOffset(): number {
    return this.fovTarget
  }

  reset(): void {
    this.shake = 0
    this.fovTarget = 0
    this.bobPhase = 0
    this.bobOffset = 0
    this.roll = 0
    this.dip = 0
  }
}