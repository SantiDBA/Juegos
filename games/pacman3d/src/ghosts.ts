import * as THREE from 'three'
import { TUNING } from './config'
import { cellToWorld, isGhostWalkable, type Grid } from './maze'

export type Dir = 'up' | 'down' | 'left' | 'right'

const DIR_VECTORS: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

/** Color normal de cada fantasma, como en el original. */
const GHOST_COLORS = [0xff4136, 0xff851b, 0x2ecc71, 0xff42a8] as const

export type GhostMode = 'normal' | 'frightened' | 'eaten'

/**
 * Un fantasma.
 *
 * La IA es la del clásico: en cada cruce elige la dirección que más acorta la
 * distancia a su objetivo y nunca da media vuelta si hay alternativa. El
 * objetivo depende del modo —perseguir al jugador o desarmarse en su esquina—
 * y eso es lo que los hace impredecibles sin dejar de ser justos.
 */
export class Ghost {
  readonly mesh = new THREE.Group()
  readonly position = new THREE.Vector3()
  mode: GhostMode = 'normal'
  /** Celdas de dispersión: la esquina a la que va cuando no persigue. */
  readonly scatter: { x: number; y: number }

  private fromCell: { x: number; y: number }
  private toCell: { x: number; y: number }
  private progress = 0
  private dir: Dir = 'left'
  /** Segundos que faltan para salir de la casa. */
  private wait: number
  private insideHouse = true

  private readonly normalColor: number
  private readonly bodyGeo: THREE.SphereGeometry
  private readonly mat: THREE.MeshStandardMaterial
  private readonly body: THREE.Mesh
  private readonly eyeGeo: THREE.SphereGeometry
  private readonly pupilGeo: THREE.SphereGeometry
  private readonly eyeMat: THREE.MeshStandardMaterial
  private readonly pupilMat: THREE.MeshStandardMaterial

  constructor(
    private readonly grid: Grid,
    /** Índice del fantasma: fija color, esquina de dispersión y orden de salida. */
    readonly index: number,
    private readonly home: { x: number; y: number },
    releaseDelay: number,
  ) {
    this.normalColor = GHOST_COLORS[index % GHOST_COLORS.length]!
    const corner = TUNING.scatterCorners[index % TUNING.scatterCorners.length]!
    this.scatter = { x: corner.x, y: corner.y }

    this.fromCell = { ...home }
    this.toCell = { ...home }
    this.position.copy(cellToWorld(grid, home.x, home.y, TUNING.playerHeight))
    this.wait = releaseDelay

    this.bodyGeo = new THREE.SphereGeometry(TUNING.ghostRadius, 18, 14)
    this.mat = new THREE.MeshStandardMaterial({
      color: this.normalColor,
      emissive: this.normalColor,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    })
    this.body = new THREE.Mesh(this.bodyGeo, this.mat)
    this.body.castShadow = true

    // Ojitos pegados al frente (+Z local): se animan como un par.
    this.eyeGeo = new THREE.SphereGeometry(TUNING.ghostRadius * 0.42, 12, 10)
    this.pupilGeo = new THREE.SphereGeometry(TUNING.ghostRadius * 0.2, 10, 8)
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x14142b, roughness: 0.3 })

    const r = TUNING.ghostRadius
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.eyeGeo, this.eyeMat)
      eye.position.set(side * r * 0.4, r * 0.5, r * 0.7)
      eye.scale.set(1, 1.3, 0.6)
      const pupil = new THREE.Mesh(this.pupilGeo, this.pupilMat)
      pupil.position.set(side * r * 0.4, r * 0.5, r * 0.92)
      this.mesh.add(eye, pupil)
    }
    this.mesh.add(this.body)
    this.mesh.position.copy(this.position)
    this.applyVisual()
  }

  /** Vuelve a la casa: se lo comieron, reaparece después del retardo. */
  respawn(releaseDelay: number): void {
    this.mode = 'eaten'
    this.insideHouse = true
    this.fromCell = { ...this.home }
    this.toCell = { ...this.home }
    this.progress = 0
    this.dir = 'up'
    this.wait = releaseDelay
    this.position.copy(cellToWorld(this.grid, this.home.x, this.home.y, TUNING.playerHeight))
    this.mesh.position.copy(this.position)
    this.applyVisual()
  }

  reset(releaseDelay: number): void {
    this.mode = 'normal'
    this.insideHouse = true
    this.fromCell = { ...this.home }
    this.toCell = { ...this.home }
    this.progress = 0
    this.dir = 'up'
    this.wait = releaseDelay
    this.position.copy(cellToWorld(this.grid, this.home.x, this.home.y, TUNING.playerHeight))
    this.mesh.position.copy(this.position)
    this.applyVisual()
  }

  /**
   * Avanza un paso.
   *
   * `playerCell` y `playerDir` alimentan la persecución "ahead": el fantasma no
   * apunta al jugador sino dos casillas más allá en su dirección de marcha, con
   * lo que intercepta en vez de seguir la estela.
   */
  update(
    dt: number,
    playerCell: { x: number; y: number },
    playerDir: readonly [number, number],
  ): void {
    if (this.insideHouse) {
      this.wait -= dt
      if (this.wait <= 0) {
        this.insideHouse = false
        this.fromCell = { ...this.toCell }
      } else {
        this.mesh.position.copy(this.position)
        return
      }
    }

    const speed = TUNING.ghostSpeed * (this.mode === 'frightened' ? TUNING.frightenedSpeed : 1)
    const cell = TUNING.cellSize
    const step = speed * dt
    // Distancia que faltaba para cerrar el tramo actual: se calcula ANTES de
    // tocar `progress`, porque al consumirla se reinicia.
    const remaining = (1 - this.progress) * cell

    if (step >= remaining) {
      this.position.copy(cellToWorld(this.grid, this.toCell.x, this.toCell.y, TUNING.playerHeight))
      this.fromCell = { ...this.toCell }
      this.progress = 0
      this.dir = this.chooseDir(this.fromCell, this.aimFor(playerCell, playerDir))
      this.toCell = this.neighbor(this.fromCell, this.dir)
      this.advance(step - remaining, cell)
    } else {
      this.advance(step, cell)
    }

    this.mesh.position.copy(this.position)
  }

  private advance(step: number, cell: number): void {
    if (step <= 0) return
    this.progress = Math.min(1, this.progress + step / cell)
    const a = cellToWorld(this.grid, this.fromCell.x, this.fromCell.y, TUNING.playerHeight)
    const b = cellToWorld(this.grid, this.toCell.x, this.toCell.y, TUNING.playerHeight)
    this.position.lerpVectors(a, b, this.progress)
  }

  private aimFor(
    playerCell: { x: number; y: number },
    playerDir: readonly [number, number],
  ): { x: number; y: number } {
    if (this.mode === 'frightened') return this.scatter
    return { x: playerCell.x + playerDir[0] * 2, y: playerCell.y + playerDir[1] * 2 }
  }

  /** Dirección que más acorta la distancia a `aim`, sin dar media vuelta. */
  private chooseDir(cell: { x: number; y: number }, aim: { x: number; y: number }): Dir {
    const back = OPPOSITE[this.dir]
    const options = (Object.keys(DIR_VECTORS) as Dir[]).filter(
      (d) => d !== back && isGhostWalkable(this.grid, ...this.neighborTuple(cell, d)),
    )
    // Encajonado: sólo queda volver.
    if (!options.length) return back

    let best = options[0]!
    let bestDist = Infinity
    for (const d of options) {
      const n = this.neighbor(cell, d)
      const dist = (n.x - aim.x) ** 2 + (n.y - aim.y) ** 2
      if (dist < bestDist) {
        bestDist = dist
        best = d
      }
    }
    return best
  }

  private neighbor(cell: { x: number; y: number }, dir: Dir): { x: number; y: number } {
    const [dx, dy] = DIR_VECTORS[dir]
    return { x: cell.x + dx, y: cell.y + dy }
  }

  private neighborTuple(cell: { x: number; y: number }, dir: Dir): [number, number] {
    const [dx, dy] = DIR_VECTORS[dir]
    return [cell.x + dx, cell.y + dy]
  }

  /** Refleja el modo en el material. */
  private applyVisual(): void {
    if (this.mode === 'eaten') {
      this.mat.color.setHex(0x1a1a2e)
      this.mat.emissive.setHex(0x222244)
      this.mat.emissiveIntensity = 0.15
    } else if (this.mode === 'frightened') {
      this.mat.color.setHex(0x3b6fe0)
      this.mat.emissive.setHex(0x2a4fd0)
      this.mat.emissiveIntensity = 0.75
    } else {
      this.mat.color.setHex(this.normalColor)
      this.mat.emissive.setHex(this.normalColor)
      this.mat.emissiveIntensity = 0.6
    }
  }

  dispose(): void {
    this.bodyGeo.dispose()
    this.mat.dispose()
    this.eyeGeo.dispose()
    this.pupilGeo.dispose()
    this.eyeMat.dispose()
    this.pupilMat.dispose()
  }
}

/**
 * Los cuatro fantasmas del nivel.
 *
 * Salen escalonados: si los cuatro arrancan juntos no hay a dónde escapar.
 * El escalonado da unos segundos para juntar puntos antes de que empiece la
 * persecución de verdad.
 */
export class Ghosts {
  readonly group = new THREE.Group()
  readonly list: Ghost[] = []
  /** Segundos restantes de modo asustado. */
  private frightenedTimer = 0

  constructor(
    private readonly grid: Grid,
    private readonly home: { x: number; y: number },
  ) {
    for (let i = 0; i < TUNING.ghostCount; i++) {
      const g = new Ghost(this.grid, i, this.home, TUNING.ghostReleaseDelay * (i + 1))
      this.list.push(g)
      this.group.add(g.mesh)
    }
  }

  /** Pone a todos en modo asustado. Devuelve false si ya lo estaban. */
  frighten(): boolean {
    const already = this.frightenedTimer > 0
    this.frightenedTimer = TUNING.frightenedSeconds
    for (const g of this.list) {
      if (g.mode === 'eaten') continue
      g.mode = 'frightened'
    }
    return !already
  }

  get isFrightened(): boolean {
    return this.frightenedTimer > 0
  }

  /**
   * Avanza los fantasmas y resuelve las colisiones con el jugador.
   *
   * Devuelve cuántos fantasmas fueron comidos en este frame y cuál era el
   * primero, para que el llamador sume los puntos una sola vez.
   */
  update(dt: number, playerPos: THREE.Vector3, playerCell: { x: number; y: number }, playerDir: readonly [number, number], onEaten: (g: Ghost, index: number) => void): void {
    if (this.frightenedTimer > 0) {
      this.frightenedTimer -= dt
      if (this.frightenedTimer <= 0) {
        for (const g of this.list) {
          if (g.mode === 'frightened') g.mode = 'normal'
        }
      }
    }

    const contactRadius = TUNING.playerRadius + TUNING.ghostRadius + 0.12
    for (let i = 0; i < this.list.length; i++) {
      const g = this.list[i]!
      g.update(dt, playerCell, playerDir)
      if (g.mode === 'eaten') continue
      if (g.position.distanceTo(playerPos) > contactRadius) continue
      if (g.mode === 'frightened') {
        g.respawn(TUNING.ghostReleaseDelay * (i + 1))
        onEaten(g, i)
      }
      // El contacto con un fantasma normal lo resuelve el llamador (game over).
    }
  }

  /** Teletransporta a todos a la casa: al morir o al cambiar de nivel. */
  resetAll(): void {
    this.frightenedTimer = 0
    for (let i = 0; i < this.list.length; i++) {
      this.list[i]!.reset(TUNING.ghostReleaseDelay * (i + 1))
    }
  }

  /**
   * ¿Algún fantasma normal (no asustado, no comido) está encima del jugador?
   *
   * Es la única condición de muerte, y se consulta aparte de `update` para no
   * tener que resolver el final de partida dentro del bucle de fantasmas.
   */
  touching(playerPos: THREE.Vector3): boolean {
    const contact = TUNING.playerRadius + TUNING.ghostRadius + 0.12
    for (const g of this.list) {
      if (g.mode === 'frightened' || g.mode === 'eaten') continue
      if (g.position.distanceTo(playerPos) <= contact) return true
    }
    return false
  }

  /** Puntos que suma cada fantasma según cuántas veces se lo comieron. */
  eatPoints(streak: number): number {
    return TUNING.ghostValue * Math.pow(2, Math.max(0, streak))
  }

  dispose(): void {
    for (const g of this.list) g.dispose()
    this.list.length = 0
    this.group.clear()
  }
}