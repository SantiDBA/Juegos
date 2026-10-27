import * as THREE from 'three'
import { COLORS, TUNING } from './config'
import { approach, approachAngle, resolveSphereBoxes, type Box } from './physics'
import type { NeedId } from './needs'

/** Órdenes de un frame. La dirección ya viene normalizada y en el mundo. */
export interface CatInput {
  moveX: number
  moveZ: number
  run: boolean
  jump: boolean
}

export type CatMotion = 'idle' | 'walk' | 'run'

/** Cómo se posa el cuerpo según lo que esté haciendo. */
interface Pose {
  /** Cuánto baja el torso: dormir y sentarse. */
  lower: number
  /** Cuánto baja la cabeza: comer. */
  headDip: number
  /** Ojos cerrados mientras dura la actividad. */
  eyesClosed: boolean
}

const IDLE_POSE: Pose = { lower: 0, headDip: 0, eyesClosed: false }

/** Con una necesidad en cero: lomo bajo y cabeza gacha. Sin final, es todo el castigo. */
const SAD_POSE: Pose = { lower: 0.18, headDip: 0.4, eyesClosed: false }

const POSES: Record<NeedId, Pose> = {
  comer: { lower: 0.04, headDip: 0.62, eyesClosed: false },
  higiene: { lower: 0.14, headDip: 0.05, eyesClosed: true },
  diversion: { lower: 0, headDip: -0.2, eyesClosed: false },
  energia: { lower: 0.22, headDip: -0.05, eyesClosed: true },
  banio: { lower: 0.16, headDip: 0.2, eyesClosed: false },
}

/** Largo de la pierna sin encoger: el pivote está a esta altura. */
const LEG_LENGTH = 0.36

/**
 * El gato: modelo armado con primitivas + controlador + animación procedural.
 *
 * No hay esqueleto ni clips: patas, cola, orejas y párpados se mueven por
 * fórmulas en `animate`. Es lo que hace que se lea como un gato y no como una
 * caja que se desliza, y sale mucho más barato que cargar animaciones.
 *
 * Convención: mira hacia -Z con `yaw = 0`, igual que los autos de `rocket`.
 */
export class Cat {
  /** Posición de las patas: `y = 0` es el piso. */
  readonly pos = new THREE.Vector3()
  readonly vel = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly radius = TUNING.catRadius

  yaw = 0
  grounded = true
  motion: CatMotion = 'idle'
  /** Actividad en curso, o null. La fija `main.ts` cada frame. */
  action: NeedId | null = null
  /** Alguna necesidad en cero: se le caen las orejas y baja el lomo. */
  distressed = false
  justJumped = false
  justLanded = false
  /** Se dispara cuando una pata toca el piso, para el sonido del paso. */
  justStepped = false

  private readonly torso = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly tailSegments: THREE.Mesh[] = []
  private readonly legs: THREE.Group[] = []
  private readonly eyes: THREE.Mesh[] = []
  private readonly pupils: THREE.Mesh[] = []
  private readonly ears: THREE.Mesh[] = []
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly scratch = new THREE.Vector3()

  private walkPhase = 0
  private tailPhase = 0
  private lower = 0
  private headDip = 0
  private eyesShut = 0
  private blinkTimer = 2.6
  private blink = 0
  private stepTimer = 1
  private bob = 0

  constructor() {
    const fur = this.mat(new THREE.MeshStandardMaterial({ color: COLORS.cat, roughness: 0.86 }))
    const furDark = this.mat(
      new THREE.MeshStandardMaterial({ color: COLORS.catDark, roughness: 0.86 }),
    )
    const belly = this.mat(
      new THREE.MeshStandardMaterial({ color: COLORS.catBelly, roughness: 0.92 }),
    )
    const noseMat = this.mat(new THREE.MeshStandardMaterial({ color: COLORS.catNose, roughness: 0.6 }))
    const eyeMat = this.mat(
      new THREE.MeshStandardMaterial({ color: COLORS.catEye, roughness: 0.22, metalness: 0.1 }),
    )
    const pupilMat = this.mat(
      new THREE.MeshStandardMaterial({ color: COLORS.catPupil, roughness: 0.4 }),
    )
    const whiskerMat = this.mat(
      new THREE.LineBasicMaterial({ color: 0xf6f0e4, transparent: true, opacity: 0.65 }),
    )

    this.group.add(this.torso)

    // --- Torso: cápsula acostada a lo largo de Z.
    const bodyGeo = this.geo(new THREE.CapsuleGeometry(0.32, 0.7, 6, 14))
    bodyGeo.rotateX(Math.PI / 2)
    const body = new THREE.Mesh(bodyGeo, fur)
    body.position.set(0, 0.66, 0.06)
    body.castShadow = true
    this.torso.add(body)

    // La panza clara asoma apenas por abajo: no se ve el corte, sólo el color.
    const bellyGeo = this.geo(new THREE.CapsuleGeometry(0.27, 0.62, 6, 12))
    bellyGeo.rotateX(Math.PI / 2)
    const bellyMesh = new THREE.Mesh(bellyGeo, belly)
    bellyMesh.position.set(0, 0.57, 0.06)
    this.torso.add(bellyMesh)

    // --- Cabeza
    this.head.position.set(0, 0.86, -0.64)
    this.torso.add(this.head)

    const headMesh = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.3, 20, 16)), fur)
    headMesh.castShadow = true
    this.head.add(headMesh)

    const muzzle = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.16, 16, 12)), belly)
    muzzle.position.set(0, -0.09, -0.21)
    muzzle.scale.set(1, 0.85, 0.9)
    this.head.add(muzzle)

    const nose = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.055, 12, 10)), noseMat)
    nose.position.set(0, -0.05, -0.35)
    this.head.add(nose)

    const eyeGeo = this.geo(new THREE.SphereGeometry(0.075, 14, 12))
    const pupilGeo = this.geo(new THREE.SphereGeometry(0.038, 10, 8))
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat)
      eye.position.set(x, 0.06, -0.24)
      this.head.add(eye)
      this.eyes.push(eye)

      const pupil = new THREE.Mesh(pupilGeo, pupilMat)
      pupil.position.set(x, 0.06, -0.3)
      this.head.add(pupil)
      this.pupils.push(pupil)
    }

    const earGeo = this.geo(new THREE.ConeGeometry(0.13, 0.3, 4))
    for (const x of [-0.17, 0.17]) {
      const ear = new THREE.Mesh(earGeo, furDark)
      ear.position.set(x, 0.24, -0.02)
      ear.rotation.x = -0.15
      ear.castShadow = true
      this.head.add(ear)
      this.ears.push(ear)
    }

    // Bigotes: dos líneas por lado.
    const whiskers: number[] = []
    for (const side of [-1, 1]) {
      for (const dy of [0.03, -0.01, -0.05]) {
        whiskers.push(
          side * 0.12,
          -0.06 + dy,
          -0.33,
          side * 0.36,
          -0.04 + dy * 2,
          -0.36 + dy,
        )
      }
    }
    const whiskerGeo = this.geo(new THREE.BufferGeometry())
    whiskerGeo.setAttribute('position', new THREE.Float32BufferAttribute(whiskers, 3))
    this.head.add(new THREE.LineSegments(whiskerGeo, whiskerMat))

    // --- Cola: esferas a lo largo de una curva que se recalcula cada frame. La
    // punta va en el color de la panza: vista desde atrás, una cola toda del
    // mismo naranja se confunde con el lomo y parece que el gato no tuviera.
    const tailGeo = this.geo(new THREE.SphereGeometry(1, 10, 8))
    for (let i = 0; i < 7; i++) {
      const segment = new THREE.Mesh(tailGeo, i >= 5 ? belly : fur)
      segment.scale.setScalar(0.09 - (i / 6) * 0.05)
      segment.castShadow = true
      this.torso.add(segment)
      this.tailSegments.push(segment)
    }

    // --- Patas. El pivote queda en el hombro y la geometría cuelga hacia abajo,
    // así girar el grupo las balancea como péndulos.
    const legGeo = this.geo(new THREE.CylinderGeometry(0.085, 0.075, 0.24, 10))
    legGeo.translate(0, -0.12, 0)
    const pawGeo = this.geo(new THREE.SphereGeometry(0.11, 12, 10))
    const spots: [number, number][] = [
      [-0.19, -0.4],
      [0.19, -0.4],
      [-0.19, 0.42],
      [0.19, 0.42],
    ]
    for (const [x, z] of spots) {
      const leg = new THREE.Group()
      leg.position.set(x, LEG_LENGTH, z)
      const limb = new THREE.Mesh(legGeo, fur)
      limb.castShadow = true
      const paw = new THREE.Mesh(pawGeo, belly)
      paw.position.set(0, -0.25, 0)
      leg.add(limb, paw)
      this.group.add(leg)
      this.legs.push(leg)
    }
  }

  private geo<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry)
    return geometry
  }

  private mat<T extends THREE.Material>(material: T): T {
    this.materials.push(material)
    return material
  }

  /** Punto sobre la cabeza, donde va el emote flotante. */
  emoteAnchor(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pos.x, this.pos.y + 1.55 - this.lower, this.pos.z)
  }

  reset(x: number, z: number, yaw: number): void {
    this.pos.set(x, 0, z)
    this.vel.set(0, 0, 0)
    this.yaw = yaw
    this.grounded = true
    this.action = null
    this.motion = 'idle'
    this.lower = 0
    this.headDip = 0
    this.walkPhase = 0
    this.tailPhase = 0
    this.syncMesh()
  }

  update(dt: number, input: CatInput, walls: readonly Box[]): void {
    const wasGrounded = this.grounded

    // Aceleración hacia la velocidad pedida. La misma constante al soltar hace
    // de fricción, así que el gato frena sólo.
    const speed = input.run ? TUNING.runSpeed : TUNING.walkSpeed
    const accel = wasGrounded ? TUNING.groundAccel : TUNING.airAccel
    this.vel.x = approach(this.vel.x, input.moveX * speed, accel * dt)
    this.vel.z = approach(this.vel.z, input.moveZ * speed, accel * dt)

    this.justJumped = false
    if (input.jump && wasGrounded) {
      this.vel.y = TUNING.jumpImpulse
      this.justJumped = true
    }
    if (!wasGrounded) this.vel.y -= TUNING.gravity * dt

    this.pos.x += this.vel.x * dt
    this.pos.y += this.vel.y * dt
    this.pos.z += this.vel.z * dt

    // Los choques se resuelven con una esfera a media altura del cuerpo. La Y no
    // se toma del resultado: las paredes son más altas que el salto, así que una
    // corrección vertical sólo podría venir de un borde mal puesto.
    this.scratch.set(this.pos.x, this.pos.y + TUNING.catHalfHeight, this.pos.z)
    resolveSphereBoxes(this.scratch, this.vel, this.radius, walls, 0)
    this.pos.x = this.scratch.x
    this.pos.z = this.scratch.z

    this.justLanded = false
    if (this.pos.y <= 0) {
      this.pos.y = 0
      if (this.vel.y < 0) this.vel.y = 0
      this.grounded = true
      if (!wasGrounded) this.justLanded = true
    } else {
      this.grounded = false
    }

    const planar = Math.hypot(this.vel.x, this.vel.z)
    if (input.moveX !== 0 || input.moveZ !== 0) {
      // `forward` es (-sin yaw, 0, -cos yaw): con este yaw apunta a la dirección.
      const targetYaw = Math.atan2(-input.moveX, -input.moveZ)
      this.yaw = approachAngle(this.yaw, targetYaw, TUNING.turnRate * dt)
    }

    this.animate(dt, planar)
    this.syncMesh()
  }

  private animate(dt: number, planar: number): void {
    // La actividad manda; si no hay ninguna y algo quedó en cero, se pone
    // mustio. Ahora que no se puede perder, es el único aviso que tiene encima.
    const sad = !this.action && this.distressed ? 1 : 0
    const pose = this.action ? POSES[this.action] : sad ? SAD_POSE : IDLE_POSE

    this.lower = approach(this.lower, pose.lower, dt * 1.6)
    this.headDip = approach(this.headDip, pose.headDip, dt * 2.4)

    const gait = Math.min(1, planar / TUNING.walkSpeed)
    this.motion = this.action
      ? 'idle'
      : planar < 0.4
        ? 'idle'
        : planar > TUNING.walkSpeed * 1.15
          ? 'run'
          : 'walk'

    // --- Ciclo de patas
    this.walkPhase += planar * dt * 3.4
    const swing = (1 - this.lower * 2.2) * gait * 0.75
    const legScale = Math.max(0.35, (LEG_LENGTH - this.lower) / LEG_LENGTH)
    const legPivot = LEG_LENGTH - this.lower
    // Patas en diagonal, como un gato: la delantera izquierda con la trasera
    // derecha, y las otras dos en oposición.
    const offsets = [0, Math.PI, Math.PI, 0]
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i]!
      leg.position.y = legPivot
      leg.scale.y = legScale
      leg.rotation.x = Math.sin(this.walkPhase + offsets[i]!) * swing
    }

    // Paso audible cada media vuelta del ciclo.
    this.justStepped = false
    if (this.grounded && gait > 0.25) {
      this.stepTimer -= dt * planar * 1.1
      if (this.stepTimer <= 0) {
        this.stepTimer = 1
        this.justStepped = true
      }
    } else {
      this.stepTimer = 1
    }

    // --- Balanceo del torso
    this.bob = Math.abs(Math.sin(this.walkPhase)) * 0.05 * gait
    this.torso.position.y = -this.lower + this.bob

    // --- Cola: se enrosca al dormir y se agita más cuanto más corre.
    this.tailPhase += dt * (1.8 + gait * 3.2)
    const curl = this.lower * 0.9
    for (let i = 0; i < this.tailSegments.length; i++) {
      const s = i / (this.tailSegments.length - 1)
      const segment = this.tailSegments[i]!
      const sway = Math.sin(this.tailPhase - s * 1.7) * 0.2 * (0.35 + s)
      // Erguida sube y se curva hacia atrás; mustia se desploma casi hasta el
      // piso. Se interpola entre las dos curvas en vez de escalar la erguida:
      // escalarla sólo la aplana y queda horizontal en vez de caída.
      const raised = 0.58 + Math.pow(s, 1.4) * (0.57 - curl * 0.5)
      const flopped = 0.42 - s * 0.22
      segment.position.set(
        sway + curl * 0.3 * s,
        raised * (1 - sad) + flopped * sad + this.bob,
        0.66 + s * (0.46 - curl * 0.5),
      )
    }

    // --- Cabeza: baja al comer, se levanta al jugar.
    this.head.rotation.x = this.headDip + Math.sin(this.walkPhase * 2) * 0.03 * gait
    this.head.position.y = 0.86 - this.headDip * 0.1

    // --- Orejas: un temblorcito con el mismo pulso que la cola; gachas si está mustio.
    for (let i = 0; i < this.ears.length; i++) {
      const side = i === 0 ? -1 : 1
      this.ears[i]!.rotation.z = side * (0.28 + Math.sin(this.tailPhase * 0.9) * 0.05 + sad * 0.8)
    }

    // --- Párpados: parpadeo cada tanto, y cerrados si la pose lo pide.
    this.blinkTimer -= dt
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.4 + Math.random() * 3.4
      this.blink = 1
    }
    this.blink = Math.max(0, this.blink - dt * 6)
    this.eyesShut = approach(this.eyesShut, pose.eyesClosed ? 1 : this.blink, dt * 12)

    const lid = 1 - this.eyesShut * 0.92
    for (const eye of this.eyes) eye.scale.y = lid
    for (const pupil of this.pupils) pupil.scale.y = lid
  }

  private syncMesh(): void {
    this.group.position.copy(this.pos)
    this.group.rotation.y = this.yaw
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.group.clear()
  }
}
