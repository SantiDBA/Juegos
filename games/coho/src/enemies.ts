import * as THREE from 'three'
import { TUNING } from './config'
import { walkableHeight, type Box, type Stair } from './level'

export type EnemyState = 'patrol' | 'chase' | 'return'

interface Enemy {
  root: THREE.Group
  /** Material propio: el brillo de alerta es por enemigo, no compartido. */
  readonly material: THREE.MeshStandardMaterial
  /** Objetivo actual: extremo de patrulla o posición del jugador. */
  readonly target: THREE.Vector3
  /** Extremo de la patrulla; al que vuelve si pierde al jugador. */
  readonly anchor: THREE.Vector3
  readonly velocity: THREE.Vector3
  state: EnemyState
  /** 0 = patrolando, 1 = alertado. Alimenta el brillo del material. */
  alert: number
  /** Altura de la superficie bajo el enemigo, sin el bob de animación. */
  groundY: number
  /** Escalera que está recorriendo, si alguna. */
  stair: Stair | null
  /** Progreso 0..1 dentro de la escalera. */
  stairT: number
  /** true = sube hacia la plataforma, false = baja hacia el piso. */
  stairUp: boolean
}

/**
 * Orbes enemigos: patrullan una superficie (el piso o el top de una plataforma)
 * y persiguen al jugador cuando entra en su rango de detección. Si lo pierde,
 * regresan a su extremo de patrulla.
 *
 * Para cambiar de altura usan las escaleras del nivel como waypoints: cuando el
 * destino está a otra altura, buscan la escalera más cercana y la recorren
 * interpolando la altura.
 */
export class Enemies {
  readonly group = new THREE.Group()
  readonly total: number

  private readonly enemies: Enemy[] = []
  private readonly colliders: Box[]
  private readonly stairs: Stair[]
  private readonly dir = new THREE.Vector3()
  private readonly desired = new THREE.Vector3()
  private readonly eyeGeometry: THREE.SphereGeometry
  private readonly eyeMaterial: THREE.MeshBasicMaterial
  private readonly coreGeometry: THREE.IcosahedronGeometry
  /** true si algún enemigo empezó a perseguir en el último update. */
  private alertedThisFrame = false

  constructor(
    patrols: { from: THREE.Vector3; to: THREE.Vector3 }[],
    colliders: Box[],
    stairs: Stair[] = [],
  ) {
    this.colliders = colliders
    this.stairs = stairs
    this.total = patrols.length

    this.coreGeometry = new THREE.IcosahedronGeometry(TUNING.enemyRadius, 0)
    this.eyeGeometry = new THREE.SphereGeometry(0.11, 8, 8)
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xfff0f0 })

    for (const patrol of patrols) {
      const root = new THREE.Group()
      // Un material por enemigo: antes todos compartían uno y `emissiveIntensity`
      // lo pisaba el último del bucle, así que el brillo de alerta mostraba el
      // estado de otro orbe.
      const material = new THREE.MeshStandardMaterial({
        color: 0xff5f6d,
        emissive: 0x8c1020,
        emissiveIntensity: 1.2,
        roughness: 0.35,
        metalness: 0.1,
      })
      root.add(new THREE.Mesh(this.coreGeometry, material))

      // Ojos para que la amenaza se lea de lejos
      for (const offset of [-0.2, 0.2]) {
        const eye = new THREE.Mesh(this.eyeGeometry, this.eyeMaterial)
        eye.position.set(offset, 0.12, -TUNING.enemyRadius - 0.04)
        root.add(eye)
      }

      const start = patrol.from.clone()
      root.position.set(
        this.clampToArena(start.x),
        start.y,
        this.clampToArena(start.z),
      )
      this.group.add(root)

      this.enemies.push({
        root,
        material,
        target: patrol.to.clone(),
        anchor: start.clone(),
        velocity: new THREE.Vector3(),
        state: 'patrol',
        alert: 0,
        groundY: start.y,
        stair: null,
        stairT: 0,
        stairUp: true,
      })
    }
  }

  /**
   * Avanza la IA. Devuelve los índices de enemigos que tocaron al jugador en
   * este frame (vacío si ninguno).
   *
   * `speedScale` Slow-motion: la IA es lo único que se frena. El jugador no
   * escala su velocidad por slowmo, así que bajarlo era lo que dejaba el
   * power-up sin efecto real sobre la amenaza.
   */
  update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    playerTorsoY: number,
    speedScale = 1,
  ): number[] {
    const hits: number[] = []

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      const dx = playerPos.x - e.root.position.x
      const dy = playerTorsoY - (e.root.position.y + TUNING.enemyRadius)
      const dz = playerPos.z - e.root.position.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // --- Cambio de estado
      if (e.state === 'patrol' && dist < TUNING.enemyDetectRange) {
        e.state = 'chase'
        // Marca de flanco: dispara el aviso sonoro una sola vez por enemigo.
        this.alertedThisFrame = true
      } else if (e.state === 'chase' && dist > TUNING.enemyLoseRange) {
        e.state = 'return'
      } else if (e.state === 'return') {
        if (e.anchor.distanceTo(e.root.position) < 1.2) e.state = 'patrol'
      }

      // --- Destino
      if (e.state === 'chase') {
        e.target.copy(playerPos)
        e.alert = Math.min(1, e.alert + dt * 4)
      } else {
        e.alert = Math.max(0, e.alert - dt * 2)
        if (e.state === 'return') {
          e.target.copy(e.anchor)
        } else if (e.root.position.distanceTo(e.target) < 0.6) {
          // Ida y vuelta: intercambiar destino y ancla.
          const swap = this.dir.copy(e.target)
          e.target.copy(e.anchor)
          e.anchor.copy(swap)
        }
      }

      const speed =
        (e.state === 'chase' ? TUNING.enemyChaseSpeed : TUNING.enemyPatrolSpeed) *
        speedScale

      if (e.stair) {
        this.advanceAlongStair(e, dt, speed)
      } else {
        this.moveFlat(e, dt, speed)
        // Si el destino está a otra altura, buscar escalera.
        const goalSurface = this.surfaceUnder(e.target.x, e.target.z)
        if (Math.abs(goalSurface - e.groundY) > TUNING.maxStepHeight) {
          const stair = this.findStair(e)
          if (stair) this.beginStair(e, stair, goalSurface > e.groundY)
        }
      }

      // --- Presentación
      e.root.rotation.y += dt * (2 + e.alert * 9)
      const bob = Math.sin(elapsed * (4 + e.alert * 6) + i) * 0.08 * (1 + e.alert)
      e.root.position.y = e.groundY + TUNING.enemyRadius + bob
      e.material.emissiveIntensity = 1.2 + e.alert * 1.8

      if (dist < TUNING.enemyContactRadius) hits.push(i)
    }

    return hits
  }

  /**
   * Consume el aviso de "alguien empezó a perseguirte" de este frame.
   *
   * Va aparte del retorno para no duplicar el SFX cuando el jugador pierde a
   * varios enemigos en el mismo frame: el aviso suena una vez.
   */
  consumeAlert(): boolean {
    const alerted = this.alertedThisFrame
    this.alertedThisFrame = false
    return alerted
  }

  /**
   * Movimiento horizontal sobre la superficie actual. Usa el mismo criterio de
   * step-up que el jugador: si el destino está sólo un peldaño más arriba, sube;
   * si es un obstáculo alto, frena.
   */
  private moveFlat(e: Enemy, dt: number, speed: number): void {
    this.dir.set(
      e.target.x - e.root.position.x,
      0,
      e.target.z - e.root.position.z,
    )
    if (this.dir.lengthSq() < 0.04) this.dir.set(0, 0, 0)
    else this.dir.normalize()

    this.desired.copy(this.dir).multiplyScalar(speed)
    e.velocity.lerp(this.desired, Math.min(1, dt * 5))

    // No salir de la arena: el muro perimetral frena en el borde.
    const nextX = this.clampToArena(e.root.position.x + e.velocity.x * dt)
    const nextZ = this.clampToArena(e.root.position.z + e.velocity.z * dt)

    // Altura pisable aquí y en el destino: sólo se acepta un peldaño de diferencia.
    const here = this.walkable(e.root.position.x, e.root.position.z)
    const next = this.walkable(nextX, nextZ)
    const climbable = next > -Infinity && Math.abs(next - here) <= TUNING.maxStepHeight

    if (climbable || !this.isSolid(nextX, nextZ)) {
      e.root.position.x = nextX
      e.root.position.z = nextZ
      if (climbable) e.groundY = next
    } else {
      e.velocity.multiplyScalar(0.4)
    }
  }

  /** Recorre la escalera interpolando la altura de pie a cima. */
  private advanceAlongStair(e: Enemy, dt: number, speed: number): void {
    const stair = e.stair
    if (!stair) return

    const from = e.stairUp ? stair.foot : stair.topPoint
    const to = e.stairUp ? stair.topPoint : stair.foot
    const len = from.distanceTo(to)
    if (len < 1e-3) {
      e.stair = null
      return
    }

    e.stairT += (speed * dt) / len
    if (e.stairT >= 1) {
      e.root.position.x = this.clampToArena(to.x)
      e.root.position.z = this.clampToArena(to.z)
      e.groundY = to.y
      e.stair = null
      e.stairT = 0
      return
    }

    e.root.position.x = this.clampToArena(from.x + (to.x - from.x) * e.stairT)
    e.root.position.z = this.clampToArena(from.z + (to.z - from.z) * e.stairT)
    e.groundY = from.y + (to.y - from.y) * e.stairT
    this.desired.set(to.x - from.x, 0, to.z - from.z).normalize().multiplyScalar(speed)
    e.velocity.copy(this.desired)
  }

  /** Mantiene una coordenada dentro de la arena. */
  private clampToArena(v: number): number {
    const limit = TUNING.arenaSize / 2 - TUNING.enemyRadius - 0.2
    return Math.max(-limit, Math.min(limit, v))
  }

  /** Altura de la superficie (piso o plataforma) bajo un punto. */
  private surfaceUnder(x: number, z: number): number {
    return walkableHeight(this.colliders, x, z, Infinity)
  }

  /**
   * Altura realmente pisable en un paso: sólo acepta superficies hasta un
   * peldaño de diferencia, así muros y pilares no cuentan como suelo.
   */
  private walkable(x: number, z: number): number {
    return walkableHeight(this.colliders, x, z, TUNING.maxStepHeight)
  }

  /** Escalera más cercana al enemigo, si está a distancia razonable. */
  private findStair(e: Enemy): Stair | null {
    let best: Stair | null = null
    let bestCost = Infinity
    for (const stair of this.stairs) {
      const cost = Math.min(
        stair.foot.distanceTo(e.root.position),
        stair.topPoint.distanceTo(e.root.position),
      )
      if (cost < bestCost) {
        bestCost = cost
        best = stair
      }
    }
    return bestCost < TUNING.enemyStairSeekRange ? best : null
  }

  private beginStair(e: Enemy, stair: Stair, up: boolean): void {
    e.stair = stair
    e.stairUp = up
    e.stairT = 0
    e.velocity.set(0, 0, 0)
  }

  /** ¿Hay un pilar o muro sólido (no escalable en un paso) en (x, z)? */
  private isSolid(x: number, z: number): boolean {
    return walkableHeight(this.colliders, x, z, TUNING.maxStepHeight) === -Infinity
  }

  /** ¿Hay al menos un enemigo persiguiendo? */
  anyAlert(): boolean {
    return this.enemies.some((e) => e.state === 'chase')
  }

  /**
   * Posiciones de los enemigos que están persiguiendo, para los marcadores del
   * HUD. Vuelve a la lista interna, no la aloca por frame.
   */
  alertPositions(out: THREE.Vector3[]): THREE.Vector3[] {
    out.length = 0
    for (const e of this.enemies) {
      if (e.state === 'chase') out.push(e.root.position)
    }
    return out
  }

  dispose(): void {
    // Las geometrías y el material de ojos se comparten entre todos los
    // enemigos, así que se liberan una sola vez. Antes `traverse` liberaba la
    // geometría una vez por enemigo.
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else if (mat !== this.eyeMaterial) mat.dispose()
      }
    })
    this.coreGeometry.dispose()
    this.eyeGeometry.dispose()
    this.eyeMaterial.dispose()
    this.group.clear()
  }
}