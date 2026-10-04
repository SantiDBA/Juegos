import * as THREE from 'three'
import { TUNING } from './config'
import type { PowerUpKind } from './level'

export type OrbKind = 'normal' | 'gold' | 'hazard'

/**
 * Distancia mínima a la que el imán frena un orbe.
 *
 * Tiene que ser menor que `collectRadius`: si el orbe se congela más lejos de
 * lo que alcanza el radio de recolección, el imán rompería la recolección.
 */
const MIN_ORB_DISTANCE = 0.55

const PALETTE: Record<OrbKind, { color: number; emissive: number; glow: number }> = {
  normal: { color: 0x57e0c8, emissive: 0x1c8f7c, glow: 1.4 },
  gold: { color: 0xffc94d, emissive: 0xb3791a, glow: 1.8 },
  hazard: { color: 0xff6b6b, emissive: 0xa02424, glow: 1.6 },
}

/**
 * Coleccionables del juego: orbes normales (objetivo), dorados (restan tiempo),
 * rojos (agregan tiempo) y power-ups (efectos temporales).
 *
 * Todos comparten la misma lógica de rotación, bob y recolección por radio.
 */
export class Pickups {
  readonly group = new THREE.Group()
  readonly total: number

  private readonly basePositions: THREE.Vector3[] = []
  private readonly kinds: OrbKind[] = []
  private readonly collected: boolean[] = []
  /** Cuánto se ha desplazado cada orbe respecto de su base (imán). */
  private readonly pull: THREE.Vector3[] = []
  private readonly tmp = new THREE.Vector3()
  /** Geometrías compartidas por todos los orbes: se liberan una vez. */
  private readonly coreGeometry = new THREE.IcosahedronGeometry(0.42, 0)
  private readonly shellGeometry = new THREE.IcosahedronGeometry(0.62, 1)

  constructor(spots: THREE.Vector3[], kinds: OrbKind[]) {
    this.total = Math.min(spots.length, kinds.length)

    for (let i = 0; i < this.total; i++) {
      const kind = kinds[i]
      const palette = PALETTE[kind]
      this.basePositions.push(spots[i].clone())
      this.kinds.push(kind)
      this.collected.push(false)
      this.pull.push(new THREE.Vector3())

      const root = new THREE.Group()
      root.position.copy(spots[i])

      const core = new THREE.Mesh(
        this.coreGeometry,
        new THREE.MeshStandardMaterial({
          color: palette.color,
          emissive: palette.emissive,
          emissiveIntensity: palette.glow,
          roughness: 0.25,
          metalness: 0.1,
        }),
      )
      root.add(core)

      const shell = new THREE.Mesh(
        this.shellGeometry,
        new THREE.MeshBasicMaterial({
          color: palette.color,
          transparent: true,
          opacity: 0.16,
          wireframe: true,
        }),
      )
      root.add(shell)

      this.group.add(root)
    }
  }

  kindOf(index: number): OrbKind {
    return this.kinds[index]
  }

  /**
   * Anima los orbes y aplica el imán.
   *
   * `playerPos` es opcional: en el menú no hay jugador y los orbes sólo
   * flotan. El imán se guarda como desplazamiento respecto de la base, no
   * como posición absoluta, así el bob y la atracción se suman sin pelearse.
   */
  update(elapsed: number, dt = 0, playerPos?: THREE.Vector3): void {
    const magnet = TUNING.magnetRadius
    const magnetSq = magnet * magnet

    for (let i = 0; i < this.total; i++) {
      if (this.collected[i]) continue
      const root = this.group.children[i]
      root.rotation.y = elapsed * TUNING.orbSpin
      root.rotation.x = elapsed * TUNING.orbSpin * 0.4

      const base = this.basePositions[i]
      const offset = this.pull[i]

      if (playerPos && dt > 0) {
        // La dirección de atracción va del jugador a la posición ACTUAL del
        // orbe (base + offset), no a la base: si no, el bob se filtra dentro
        // del vector de pull y el orbe deriva en vertical.
        this.tmp.copy(root.position).sub(playerPos)
        const distSq = this.tmp.lengthSq()
        if (distSq < magnetSq && distSq > MIN_ORB_DISTANCE ** 2) {
          // Cuanto más cerca, más rápido: la atracción crece al acercarse.
          const closeness = 1 - Math.sqrt(distSq) / magnet
          const speed = TUNING.magnetSpeed * closeness * closeness * dt
          offset.addScaledVector(this.tmp, -speed / Math.sqrt(distSq))
        } else if (distSq <= MIN_ORB_DISTANCE ** 2) {
          // Ya está encima: se frena en seco. Sin este tope el orbe pasa de
          // largo, atraviesa al jugador y sale disparado por detrás.
          offset.copy(root.position).sub(playerPos).multiplyScalar(-1)
        }
      } else {
        offset.multiplyScalar(Math.max(0, 1 - dt * 8))
      }

      root.position.set(
        base.x + offset.x,
        base.y + offset.y + Math.sin(elapsed * 2 + i) * TUNING.orbBob,
        base.z + offset.z,
      )
    }
  }

  /**
   * Índice del orbe normal pendiente más cercano a `point`, o -1.
   *
   * Lo usa la brújula del HUD: sin esto, en una arena con 16 orbes y
   * plataformas el jugador no tiene forma de saber hacia dónde ir.
   */
  nearestPending(point: THREE.Vector3): number {
    let best = -1
    let bestSq = Infinity
    for (let i = 0; i < this.total; i++) {
      if (this.collected[i] || this.kinds[i] !== 'normal') continue
      const d = this.group.children[i].position.distanceToSquared(point)
      if (d < bestSq) {
        bestSq = d
        best = i
      }
    }
    return best
  }

  /** Posición del orbe `index`, o null si no existe. */
  positionOf(index: number): THREE.Vector3 | null {
    return index >= 0 && index < this.total ? this.group.children[index].position : null
  }

  /** Devuelve los índices de `kind` recolectados en este frame. */
  collect(point: THREE.Vector3, radius: number, kind: OrbKind): number[] {
    const hits: number[] = []
    const r2 = radius * radius
    for (let i = 0; i < this.total; i++) {
      if (this.collected[i] || this.kinds[i] !== kind) continue
      const root = this.group.children[i]
      if (root.position.distanceToSquared(point) <= r2) {
        this.collected[i] = true
        root.visible = false
        hits.push(i)
      }
    }
    return hits
  }

  reset(): void {
    for (let i = 0; i < this.total; i++) {
      this.collected[i] = false
      const root = this.group.children[i]
      root.visible = true
      // El desplazamiento del imán también se reinicia y la malla vuelve a su
      // base: si sólo se borrara el offset, el orbe se quedaría clavado donde
      // lo dejó el imán hasta el próximo `update`.
      this.pull[i].set(0, 0, 0)
      root.position.copy(this.basePositions[i])
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        // Sólo los materiales: las geometrías son compartidas y se liberan
        // una vez al final, no una por cada orbe.
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
    })
    this.coreGeometry.dispose()
    this.shellGeometry.dispose()
    this.group.clear()
  }
}

/**
 * Power-ups flotantes: turbo, salto doble y tiempo lento. Cada uno tiene un
 * color y una forma distinta para que se identifiquen de un vistazo.
 */
export class PowerUps {
  readonly group = new THREE.Group()
  readonly active: Record<PowerUpKind, boolean> = {
    turbo: false,
    doubleJump: false,
    slowmo: false,
  }
  /** Segundos restantes por power-up activo. */
  readonly timers: Record<PowerUpKind, number> = {
    turbo: 0,
    doubleJump: 0,
    slowmo: 0,
  }

  private readonly roots = new Map<PowerUpKind, THREE.Group>()
  private readonly taken: boolean[] = []
  /** Posición de reposo de cada power-up, para el bob sin deriva. */
  private readonly basePositions = new Map<PowerUpKind, THREE.Vector3>()

  constructor(spots: { spot: THREE.Vector3; kind: PowerUpKind }[]) {
    const geoByShape: Record<PowerUpKind, THREE.BufferGeometry> = {
      turbo: new THREE.ConeGeometry(0.42, 0.7, 6),
      doubleJump: new THREE.OctahedronGeometry(0.46, 0),
      slowmo: new THREE.TetrahedronGeometry(0.5, 0),
    }
    const colorByKind: Record<PowerUpKind, number> = {
      turbo: 0x7cc4ff,
      doubleJump: 0xc39bff,
      slowmo: 0x9dff9d,
    }

    for (const { spot, kind } of spots) {
      this.taken.push(false)
      const root = new THREE.Group()
      root.position.copy(spot)
      const mesh = new THREE.Mesh(
        geoByShape[kind],
        new THREE.MeshStandardMaterial({
          color: colorByKind[kind],
          emissive: colorByKind[kind],
          emissiveIntensity: 1.3,
          roughness: 0.3,
        }),
      )
      root.add(mesh)
      this.group.add(root)
      this.roots.set(kind, root)
      this.basePositions.set(kind, spot.clone())
    }
  }

  /** Devuelve el power-up recolectado en este frame, o null. */
  collect(point: THREE.Vector3, radius: number): PowerUpKind | null {
    let found: PowerUpKind | null = null
    let i = 0
    for (const [kind, root] of this.roots) {
      if (this.taken[i]) {
        i++
        continue
      }
      if (root.position.distanceToSquared(point) <= radius * radius) {
        this.taken[i] = true
        root.visible = false
        found = kind
      }
      i++
    }
    return found
  }

  /** Activa un efecto y reinicia su temporizador. */
  activate(kind: PowerUpKind, seconds = TUNING.powerUpDuration): void {
    this.active[kind] = true
    this.timers[kind] = seconds
  }

  /** Avanza los temporizadores. Devuelve los que expiraron en este frame. */
  tickTimers(dt: number): PowerUpKind[] {
    const expired: PowerUpKind[] = []
    for (const kind of Object.keys(this.active) as PowerUpKind[]) {
      if (!this.active[kind]) continue
      this.timers[kind] -= dt
      if (this.timers[kind] <= 0) {
        this.active[kind] = false
        this.timers[kind] = 0
        expired.push(kind)
      }
    }
    return expired
  }

  updateVisual(elapsed: number): void {
    // La posición se recalcula desde la base: antes hacía
    // `position.y += sin(...)` cada frame, y eso integra la oscilación y
    // empuja el power-up cada vez más lejos.
    let i = 0
    for (const [kind, root] of this.roots) {
      if (!this.taken[i]) {
        root.rotation.y = elapsed * 2.4
        root.rotation.x = elapsed * 1.6
        const base = this.basePositions.get(kind)
        if (base) root.position.set(base.x, base.y + Math.sin(elapsed * 2.5 + i) * 0.12, base.z)
      }
      i++
    }
  }

  reset(): void {
    let i = 0
    for (const root of this.roots.values()) {
      this.taken[i] = false
      root.visible = true
      i++
    }
    this.active.turbo = false
    this.active.doubleJump = false
    this.active.slowmo = false
    this.timers.turbo = 0
    this.timers.doubleJump = 0
    this.timers.slowmo = 0
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
    })
    this.group.clear()
    this.roots.clear()
  }
}

/**
 * Combo: cuenta orbes recolectados dentro de una ventana temporal y expone el
 * multiplicador resultante (1x..comboMax). Si la ventana expira, se reinicia.
 */
export class ComboMeter {
  private timer = 0
  private chain = 0

  constructor(private readonly window = TUNING.comboWindow) {}

  /** Registra un orbe. Devuelve el multiplicador actual tras el registro. */
  register(): number {
    this.chain += 1
    this.timer = this.window
    return this.multiplier
  }

  /** Avanza la ventana; si expira, pierde el combo. Devuelve si expiró. */
  tick(dt: number): boolean {
    if (this.chain === 0) return false
    this.timer -= dt
    if (this.timer > 0) return false
    this.chain = 0
    this.timer = 0
    return true
  }

  get multiplier(): number {
    if (this.chain === 0) return 1
    return Math.min(TUNING.comboMax, 1 + Math.floor((this.chain - 1) / 2))
  }

  get count(): number {
    return this.chain
  }

  /** Fracción restante de la ventana, para la barra del HUD. */
  get ratio(): number {
    if (this.chain === 0) return 0
    return Math.max(0, Math.min(1, this.timer / this.window))
  }

  get active(): boolean {
    return this.chain > 0
  }

  reset(): void {
    this.chain = 0
    this.timer = 0
  }
}