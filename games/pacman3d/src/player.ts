import * as THREE from 'three'
import { TUNING } from './config'
import { cellToWorld, isWalkable, type Grid } from './maze'

export type Dir = 'up' | 'down' | 'left' | 'right'

const DIR_VECTORS: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

const DIR_ANGLE: Record<Dir, number> = {
  // La boca mira hacia +Z, que es el frente de la geometría.
  up: Math.PI,
  down: 0,
  left: -Math.PI / 2,
  right: Math.PI / 2,
}

/**
 * Pac-Man controlado por rejilla.
 *
 * El movimiento es discreto por ejes, como el original: no hay diagonal ni
 * frenado en mitad de pasillo. Eso hace el laberinto legible de un vistazo y
 * permite predecir el movimiento, que es la mitad de la habilidad.
 *
 * La dirección deseada se guarda aparte de la efectiva: se acepta el giro en
 * cuanto el centro llega a una casilla, así el jugador puede "encolar" un
 * cambio y ejecutarlo en el cruce en vez de que se lo ignoren.
 */
export class Player {
  readonly mesh = new THREE.Group()
  readonly position: THREE.Vector3

  /** Dirección de movimiento efectiva. */
  direction: Dir = 'left'
  private desired: Dir = 'left'

  private fromCell: { x: number; y: number }
  private toCell: { x: number; y: number }
  /** Progreso 0..1 dentro del tramo actual. */
  private progress = 0
  private moving = false

  private chompPhase = 0
  private mouth = 0
  private invulnerable = 0

  private readonly bodyGeo: THREE.SphereGeometry
  private readonly bodyMat: THREE.MeshStandardMaterial
  private readonly body: THREE.Mesh

  constructor(
    private readonly grid: Grid,
    spawn: { x: number; y: number },
  ) {
    this.fromCell = { ...spawn }
    this.toCell = { ...spawn }
    this.position = cellToWorld(grid, spawn.x, spawn.y, TUNING.playerHeight)

    // Esfera con un hueco fijo: la boca siempre está abierta. El mordisco se
    // anima escalando sobre el eje de la boca, no reconstruyendo la geometría
    // cada frame (crear y tirar buffers a 60 Hz destroza el GC).
    const open = THREE.MathUtils.degToRad(TUNING.mouthAngle)
    this.bodyGeo = new THREE.SphereGeometry(
      TUNING.playerRadius,
      24,
      18,
      open,
      Math.PI * 2 - open * 2,
    )
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffd400,
      emissive: 0xffaa00,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.05,
    })
    this.body = new THREE.Mesh(this.bodyGeo, this.bodyMat)
    this.body.castShadow = true
    this.mesh.add(this.body)
    this.mesh.position.copy(this.position)
  }

  setDesired(dir: Dir): void {
    this.desired = dir
  }

  isInvulnerable(): boolean {
    return this.invulnerable > 0
  }

  grantInvulnerability(seconds: number): void {
    this.invulnerable = Math.max(this.invulnerable, seconds)
  }

  reset(spawn: { x: number; y: number }): void {
    this.fromCell = { ...spawn }
    this.toCell = { ...spawn }
    this.progress = 0
    this.moving = false
    this.direction = 'left'
    this.desired = 'left'
    this.position.copy(cellToWorld(this.grid, spawn.x, spawn.y, TUNING.playerHeight))
    this.mesh.position.copy(this.position)
  }

  /** Celda donde está el centro del jugador. */
  currentCell(): { x: number; y: number } {
    return this.moving ? this.toCell : this.fromCell
  }

  /**
   * Avanza el movimiento.
   *
   * El tiempo hasta el cruce es siempre `cellSize / speed`: la velocidad es
   * constante y no hay frenado, así que el jugador nunca se queda encajado a
   * mitad de tramo.
   */
  update(dt: number, speedMultiplier = 1): void {
    if (this.invulnerable > 0) this.invulnerable -= dt

    const speed = TUNING.baseSpeed * speedMultiplier
    const cell = TUNING.cellSize
    let step = speed * dt

    // Al arrancar no hay tramo en curso: `moving` es false y `toCell` es la
    // propia celda. Si se esperara a "llegar al centro" para decidir, el
    // jugador no arrancaría nunca: el primer `step` es menor que la celda
    // completa, así que el cruce no se dispara y se queda clavado para siempre.
    if (!this.moving) {
      this.beginStep()
      if (!this.moving) {
        this.mesh.position.copy(this.position)
        this.animate(dt)
        return
      }
    }

    // Un frame puede cubrir varios tramos si el dt es grande.
    let guard = 0
    while (this.moving && step > 0 && guard++ < 4) {
      const remaining = (1 - this.progress) * cell
      if (step < remaining) break

      // Llega al centro de la casilla destino.
      this.position.copy(cellToWorld(this.grid, this.toCell.x, this.toCell.y, TUNING.playerHeight))
      this.fromCell = { ...this.toCell }
      this.progress = 0
      step -= remaining

      // Elige dirección en el cruce: primero la deseada, si es posible.
      if (this.canStep(this.desired)) this.direction = this.desired
      this.beginStep()
    }

    if (this.moving && step > 0) {
      this.progress = Math.min(1, this.progress + step / cell)
      const a = cellToWorld(this.grid, this.fromCell.x, this.fromCell.y, TUNING.playerHeight)
      const b = cellToWorld(this.grid, this.toCell.x, this.toCell.y, TUNING.playerHeight)
      this.position.lerpVectors(a, b, this.progress)
      this.chompPhase += step
    }

    this.mesh.position.copy(this.position)
    this.animate(dt)
  }

  /**
   * Decide si puede arrancar un tramo en la dirección actual.
   *
   * Si no puede, queda frenado en el centro de la celda esperando que el
   * jugador pida otra dirección: es el comportamiento del original.
   */
  private beginStep(): void {
    if (this.canStep(this.direction)) {
      this.toCell = this.stepFrom(this.fromCell, this.direction)
      this.moving = true
    } else {
      this.moving = false
      this.toCell = { ...this.fromCell }
    }
  }

  /** ¿Se puede seguir en esa dirección desde `cell`? */
  private canStep(dir: Dir): boolean {
    const { x, y } = this.stepFrom(this.fromCell, dir)
    return isWalkable(this.grid, x, y)
  }

  /** Celda vecina en la dirección dada. */
  private stepFrom(cell: { x: number; y: number }, dir: Dir): { x: number; y: number } {
    const [dx, dy] = DIR_VECTORS[dir]
    return { x: cell.x + dx, y: cell.y + dy }
  }

  /**
   * Anima la boca y la orientación.
   *
   * El mordisco es un triángulo (abre-cierra-lineal), no un seno: es lo que
   * hace reconocible a Pac-Man incluso en silueta.
   */
  private animate(dt: number): void {
    const phase = this.moving ? this.chompPhase * TUNING.chompFrequency * 0.3 : 0
    // Triangular: 0 → 1 → 0.
    const tri = Math.abs(((phase % 2) + 2) % 2 - 1)
    this.mouth = THREE.MathUtils.lerp(this.mouth, tri, Math.min(1, dt * 22))

    // Cerrar la boca = acortar el eje del mordisco.
    const squash = 1 - this.mouth * 0.16
    this.body.scale.set(squash, 1 + this.mouth * 0.12, 1)

    const targetAngle = DIR_ANGLE[this.direction]
    // Se toma el camino más corto: sin esto, al pasar de 180° a -180° la
    // esfera gira una vuelta entera.
    let diff = targetAngle - this.mesh.rotation.y
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    this.mesh.rotation.y += diff * Math.min(1, dt * TUNING.turnSpeed)

    if (this.invulnerable > 0) {
      const blink = Math.sin(this.invulnerable * 22) > 0
      this.bodyMat.emissiveIntensity = blink ? 2.4 : 0.15
    } else {
      this.bodyMat.emissiveIntensity = 0.85
    }
  }

  dispose(): void {
    this.bodyGeo.dispose()
    this.bodyMat.dispose()
  }
}