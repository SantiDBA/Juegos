import * as THREE from 'three'
import { TUNING } from './config'

/**
 * Pool de partículas de un solo tipo, sin asignaciones por frame: se escriben
 * en buffers preasignados con un cursor circular. Se usa para el estallido del
 * gol y los impactos fuertes.
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
  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.PointsMaterial

  constructor(capacity = 600) {
    this.capacity = capacity
    this.positions = new Float32Array(capacity * 3)
    this.colors = new Float32Array(capacity * 3)
    this.velocities = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)

    for (let i = 0; i < capacity; i++) this.positions[i * 3 + 1] = -9999

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.3,
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

  burst(origin: THREE.Vector3, color: THREE.Color, count = 18, speed = 6): void {
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.capacity

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const s = speed * (0.35 + Math.random() * 0.65)
      this.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * s
      this.velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * s * 0.8 + 2
      this.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s

      this.positions[i * 3] = origin.x
      this.positions[i * 3 + 1] = origin.y
      this.positions[i * 3 + 2] = origin.z

      this.colors[i * 3] = color.r
      this.colors[i * 3 + 1] = color.g
      this.colors[i * 3 + 2] = color.b

      const life = 0.6 + Math.random() * 0.6
      this.life[i] = life
      this.maxLife[i] = life
    }
    this.geometry.attributes.position!.needsUpdate = true
    this.geometry.attributes.color!.needsUpdate = true
  }

  update(dt: number): void {
    const drag = Math.max(0, 1 - dt * 1.6)
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
      this.velocities[i * 3 + 1] = this.velocities[i * 3 + 1] * drag - 9 * dt
      this.velocities[i * 3 + 2] *= drag

      this.positions[i * 3] += this.velocities[i * 3] * dt
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt

      const t = this.life[i] / this.maxLife[i]
      const dim = 0.9 + t * t * 0.1
      this.colors[i * 3] *= dim
      this.colors[i * 3 + 1] *= dim
      this.colors[i * 3 + 2] *= dim
    }

    if (alive) {
      this.geometry.attributes.position!.needsUpdate = true
      this.geometry.attributes.color!.needsUpdate = true
    }
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.life[i] = 0
      this.positions[i * 3 + 1] = -9999
    }
    this.geometry.attributes.position!.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/**
 * Anillo de estampido: se dispara al cruzar el umbral de supersónico y se
 * expande aplastado contra el piso. Es lo que avisa que quedaste supersónico
 * sin mirar el HUD.
 */
export class ShockRing {
  readonly mesh: THREE.Mesh

  private life = 0
  private readonly maxLife = 0.45
  private readonly geometry: THREE.RingGeometry
  private readonly material: THREE.MeshBasicMaterial

  constructor() {
    this.geometry = new THREE.RingGeometry(0.86, 1, 40)
    this.geometry.rotateX(-Math.PI / 2)
    this.material = new THREE.MeshBasicMaterial({
      color: 0xbfe0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.visible = false
  }

  burst(pos: THREE.Vector3): void {
    this.life = this.maxLife
    this.mesh.position.set(pos.x, 0.06, pos.z)
    this.mesh.visible = true
  }

  update(dt: number): void {
    if (this.life <= 0) return
    this.life -= dt
    if (this.life <= 0) {
      this.mesh.visible = false
      return
    }
    const t = 1 - this.life / this.maxLife
    this.mesh.scale.setScalar(0.6 + t * 3.2)
    this.material.opacity = 0.55 * (1 - t)
  }

  reset(): void {
    this.life = 0
    this.mesh.visible = false
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/**
 * Sacudida de cámara y empujón de FOV. Se aplica *después* de posicionar la
 * cámara, así no pelea con el seguimiento.
 */
export class CameraFeel {
  private shake = 0
  private shakeTimer = 0
  private fovTarget = 0
  private readonly offset = new THREE.Vector3()

  constructor(private readonly baseFov: number) {}

  addShake(amount: number, duration = 0.45): void {
    this.shake = Math.max(this.shake, amount)
    this.shakeTimer = duration
  }

  addFovKick(kick: number): void {
    this.fovTarget = Math.max(this.fovTarget, kick)
  }

  update(dt: number, camera: THREE.PerspectiveCamera, elapsed: number): void {
    if (this.shake > 0) {
      this.shakeTimer -= dt
      this.shake = Math.max(0, this.shake - (this.shake * dt) / Math.max(dt, this.shakeTimer))
      const a = elapsed * 47
      this.offset.set(
        Math.sin(a) * this.shake,
        Math.cos(a * 1.3) * this.shake,
        Math.sin(a * 0.7) * this.shake * 0.5,
      )
      camera.position.add(this.offset)
    }

    if (this.fovTarget > 0) {
      this.fovTarget = Math.max(0, this.fovTarget - dt * (TUNING.fovKick + 8))
    }
    const targetFov = this.baseFov + this.fovTarget
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10)
      camera.updateProjectionMatrix()
    }
  }

  reset(): void {
    this.shake = 0
    this.shakeTimer = 0
    this.fovTarget = 0
  }
}

/**
 * Estela del supersónico: una polilínea con las últimas posiciones del auto,
 * brillante en la cabeza y apagada en la cola. Invisible mientras el auto no
 * pase el umbral de velocidad.
 */
export class SpeedTrail {
  readonly line: THREE.Line

  private readonly points: THREE.Vector3[] = []
  private readonly positions: Float32Array
  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.LineBasicMaterial

  constructor(length = 26) {
    this.positions = new Float32Array(length * 3)
    const colors = new Float32Array(length * 3)
    for (let i = 0; i < length; i++) {
      const f = 1 - i / (length - 1)
      colors[i * 3] = 0.45 * f
      colors[i * 3 + 1] = 0.72 * f
      colors[i * 3 + 2] = 1 * f
      this.points.push(new THREE.Vector3())
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.line = new THREE.Line(this.geometry, this.material)
    this.line.frustumCulled = false
    this.line.visible = false
  }

  update(pos: THREE.Vector3, active: boolean): void {
    if (!active) {
      if (!this.line.visible) return
      this.line.visible = false
      for (const p of this.points) p.copy(pos)
      return
    }

    this.line.visible = true
    // La cola recicla el último punto: no se crea nada por frame.
    const tail = this.points.pop()!
    tail.copy(pos)
    this.points.unshift(tail)

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i]!
      this.positions[i * 3] = p.x
      this.positions[i * 3 + 1] = p.y
      this.positions[i * 3 + 2] = p.z
    }
    this.geometry.attributes.position!.needsUpdate = true
  }

  reset(): void {
    this.line.visible = false
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
