import * as THREE from 'three'

/**
 * Pool de partículas de un solo tipo, sin asignaciones por frame: se escriben
 * en buffers preasignados con un cursor circular. Se usa para el agua de la
 * bañera, las migas de la comida y las chispas del juego.
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

  constructor(capacity = 420) {
    this.capacity = capacity
    this.positions = new Float32Array(capacity * 3)
    this.colors = new Float32Array(capacity * 3)
    this.velocities = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)

    // Arrancan bien abajo: fuera del frustro, sin dibujarse.
    for (let i = 0; i < capacity; i++) this.positions[i * 3 + 1] = -9999

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  /** `up` sesga el chorro hacia arriba (agua, migas) en vez de esférico. */
  burst(
    origin: THREE.Vector3,
    color: THREE.Color,
    count = 14,
    speed = 3,
    up = 0.5,
  ): void {
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.capacity

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const s = speed * (0.4 + Math.random() * 0.6)
      this.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * s
      this.velocities[i * 3 + 1] = Math.cos(phi) * s * (1 - up) + s * up * Math.random()
      this.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s

      this.positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.4
      this.positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.4
      this.positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.4

      this.colors[i * 3] = color.r
      this.colors[i * 3 + 1] = color.g
      this.colors[i * 3 + 2] = color.b

      const life = 0.5 + Math.random() * 0.5
      this.life[i] = life
      this.maxLife[i] = life
    }
    this.geometry.attributes.position!.needsUpdate = true
    this.geometry.attributes.color!.needsUpdate = true
  }

  update(dt: number): void {
    const drag = Math.max(0, 1 - dt * 1.8)
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
    }

    if (alive) this.geometry.attributes.position!.needsUpdate = true
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
 * Texturas de emoji dibujadas en un canvas.
 *
 * Se cachean por emoji: el gato, los muebles y el HUD reusan los mismos cinco o
 * seis, así que no tiene sentido rasterizar de nuevo cada vez.
 */
const iconCache = new Map<string, THREE.CanvasTexture>()

export function iconTexture(emoji: string): THREE.CanvasTexture {
  const cached = iconCache.get(emoji)
  if (cached) return cached

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Disco oscuro de fondo: sin esto el emoji se pierde contra la pared clara.
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(12, 14, 22, 0.72)'
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.stroke()

  ctx.font = `${Math.round(size * 0.56)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.03)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  iconCache.set(emoji, texture)
  return texture
}

/**
 * Un cartel flotante sobre el gato: "!" cuando una necesidad es crítica, "♪"
 * cuando termina una actividad. Es un único sprite cuya textura se cambia, así
 * que no hay que crear objetos por evento.
 */
export class EmoteSprite {
  readonly sprite: THREE.Sprite

  private readonly material: THREE.SpriteMaterial
  private timer = 0
  private life = 0
  private drift = 0

  constructor() {
    this.material = new THREE.SpriteMaterial({
      map: iconTexture('❓'),
      transparent: true,
      depthTest: false,
      opacity: 0,
    })
    this.sprite = new THREE.Sprite(this.material)
    this.sprite.scale.set(0.9, 0.9, 0.9)
    this.sprite.visible = false
    this.sprite.renderOrder = 5
  }

  /** Muestra un emoji durante `seconds`. Uno nuevo reemplaza al anterior. */
  show(emoji: string, seconds = 1.6): void {
    this.material.map = iconTexture(emoji)
    this.material.needsUpdate = true
    this.life = seconds
    this.timer = seconds
    this.drift = 0
    this.sprite.visible = true
  }

  /** `anchor` es la cabeza del gato en coordenadas de mundo. */
  update(dt: number, anchor: THREE.Vector3): void {
    if (!this.sprite.visible) return

    this.timer -= dt
    if (this.timer <= 0) {
      this.sprite.visible = false
      return
    }

    this.drift += dt * 0.7
    const t = this.timer / this.life
    // Aparece con un rebote y se desvanece al final.
    const pop = Math.min(1, (1 - t) * 6)
    this.material.opacity = Math.min(1, t * 2.5)
    this.sprite.scale.setScalar(0.55 + pop * 0.4)
    this.sprite.position.set(anchor.x, anchor.y + 0.55 + this.drift, anchor.z)
  }

  dispose(): void {
    this.material.dispose()
  }
}
