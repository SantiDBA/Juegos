import * as THREE from 'three'
import { TUNING } from './config'

/**
 * Partículas de Points con un buffer recycled.
 *
 * Los efectos puntuales (morder un punto, comerse un fantasma) lanzan
 * partículas. Se preasigna un buffer de tamaño fijo y se recicla con un
 * índice circular: alocar un buffer nuevo por explosión genera basura en cada
 * Points comidos, que son decenas por partida.
 */
export class BurstParticles {
  readonly points: THREE.Points
  private readonly geometry: THREE.BufferGeometry
  private readonly positions: Float32Array
  private readonly velocities: Float32Array
  private readonly lives: Float32Array
  private readonly max: number
  private cursor = 0

  constructor(max = 240) {
    this.max = max
    this.positions = new Float32Array(max * 3)
    this.velocities = new Float32Array(max * 3)
    this.lives = new Float32Array(max)

    // Se arrancan todos "muertos": vida 0 las descarta en el primer update.
    this.lives.fill(-1)

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3))

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(this.geometry, mat)
    this.points.frustumCulled = false
  }

  /** Estalla un puñado de partículas desde `origin`. */
  burst(origin: THREE.Vector3, color: THREE.Color, count = 10): void {
    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.max

      this.positions[i * 3] = origin.x
      this.positions[i * 3 + 1] = origin.y
      this.positions[i * 3 + 2] = origin.z

      // Dirección aleatoria en hemisferio, con un poco de altura.
      const theta = Math.random() * Math.PI * 2
      const speed = 1.4 + Math.random() * 2.6
      this.velocities[i * 3] = Math.cos(theta) * speed
      this.velocities[i * 3 + 1] = 1.2 + Math.random() * 2.4
      this.velocities[i * 3 + 2] = Math.sin(theta) * speed

      this.lives[i] = 0.55 + Math.random() * 0.25

      colors.setXYZ(i, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
  }

  update(dt: number): void {
    const positions = this.positions
    const velocities = this.velocities
    let alive = false

    for (let i = 0; i < this.max; i++) {
      if (this.lives[i] <= 0) continue
      this.lives[i] -= dt
      if (this.lives[i] <= 0) {
        // Se esconde lejos de cámara en vez de borrar: el draw range queda.
        positions[i * 3 + 1] = -9999
        continue
      }
      alive = true
      velocities[i * 3 + 1] -= 9 * dt
      positions[i * 3] += velocities[i * 3] * dt
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt
    }

    if (alive) {
      ;(this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    }
  }

  dispose(): void {
    this.geometry.dispose()
    const mat = this.points.material as THREE.Material
    mat.dispose()
  }
}

/**
 * Cámara en tercera persona que sigue al jugador.
 *
 * Va detrás y arriba, mirando un punto por delante de él: mirar el centro
 * exacto del jugador deja la boca de Pac-Man en el centro de la pantalla y
 * tapa el laberinto. El lookahead es lo que hace legible el camino.
 */
export class ChaseCamera {
  private readonly lookTarget = new THREE.Vector3()

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /**
   * Coloca la cámara detrás del jugador.
   *
   * `dt` amortigua el seguimiento: sin este suavizado la cámara da tirones en
   * cada giro de 90° del jugador.
   */
  update(playerPos: THREE.Vector3, facing: THREE.Vector3, dt: number): void {
    const target = this.lookTarget
    target.copy(playerPos).addScaledVector(facing, TUNING.cellSize * 1.6)
    target.y = TUNING.playerHeight

    const desired = playerPos.clone().addScaledVector(facing, -TUNING.cameraDistance)
    desired.y = TUNING.cameraHeight

    const k = Math.min(1, dt * TUNING.cameraLag)
    this.camera.position.lerp(desired, k)
    this.camera.lookAt(target)
  }

  /** Sacudida al morir. */
  shake(amount: number): void {
    const a = amount * TUNING.deathShake
    this.camera.position.x += (Math.random() - 0.5) * a
    this.camera.position.y += (Math.random() - 0.5) * a
    this.camera.position.z += (Math.random() - 0.5) * a
  }
}