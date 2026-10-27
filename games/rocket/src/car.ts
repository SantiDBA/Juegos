import * as THREE from 'three'
import { TUNING } from './config'
import { clamp, resolveSphereBoxes, type Box } from './physics'
import {
  buildCarVisual,
  contactShadowTexture,
  type CarStyle,
  type CarVisual,
} from './cars'

/** Órdenes de un frame. El jugador y el bot producen exactamente lo mismo. */
export interface InputState {
  /** -1 reversa, 1 adelante. En el aire es el cabeceo. */
  throttle: number
  /** -1 izquierda, 1 derecha. En el aire es guiñada (o rol con airRoll). */
  steer: number
  boost: boolean
  jump: boolean
  /** Freno de mano en el piso; modificador de air roll en el aire. */
  airRoll: boolean
}

export function neutralInput(): InputState {
  return { throttle: 0, steer: 0, boost: false, jump: false, airRoll: false }
}

export interface CarOptions {
  style: CarStyle
  body: number
  accent: number
  /** Entorno para los reflejos de la pintura; null si no hay. */
  envMap: THREE.Texture | null
  /** Modelo GLTF ya cargado. Si falta, se arma el auto procedural. */
  model?: THREE.Object3D | null
}

const UP = new THREE.Vector3(0, 1, 0)
/** Ángulo máximo de las ruedas delanteras, sólo visual. */
const MAX_STEER = 0.5

/**
 * El auto: un cuerpo rígido simplificado sobre el piso plano de la cancha.
 *
 * El origen está en el centro del cuerpo, a `halfHeight` del suelo. Contra
 * paredes y pelota se lo trata como una esfera de radio `radius`; el piso se
 * resuelve aparte con un clamp, porque la cancha no tiene desniveles.
 *
 * Las medidas salen del chasis (`CarStyle`): cambiar de chasis cambia la forma,
 * el radio de colisión y la altura del origen.
 */
export class Car {
  readonly pos = new THREE.Vector3()
  readonly vel = new THREE.Vector3()
  readonly quat = new THREE.Quaternion()
  readonly forward = new THREE.Vector3(0, 0, -1)
  readonly up = new THREE.Vector3(0, 1, 0)
  readonly right = new THREE.Vector3(1, 0, 0)
  readonly group = new THREE.Group()
  /** Mancha de contacto: va en la escena, no en el grupo, para que no se de vuelta. */
  readonly shadow: THREE.Mesh
  readonly style: CarStyle
  readonly radius: number
  readonly halfHeight: number

  /**
   * `TUNING` es `as const`, así que sin la anotación el campo quedaría con el
   * tipo literal 33 y no aceptaría el valor leído de un pad.
   */
  boost: number = TUNING.boostStart
  grounded = true
  supersonic = false
  flipping = false
  boosting = false
  justJumped = false
  justDodged = false

  private yaw = 0
  private sinceJump = Number.POSITIVE_INFINITY
  private jumpHoldTimer = 0
  private flipTimer = 0
  private prevJump = false
  private wheelSpin = 0
  private steerVisual = 0
  private readonly flipAxis = new THREE.Vector3(1, 0, 0)
  private readonly scratchAxis = new THREE.Vector3()
  private readonly scratchQuat = new THREE.Quaternion()
  private readonly visual: CarVisual

  constructor(options: CarOptions) {
    this.style = options.style
    this.radius = options.style.radius
    this.halfHeight = options.style.halfHeight

    this.visual = buildCarVisual(
      options.style,
      options.body,
      options.accent,
      options.envMap,
      options.model ?? null,
    )
    this.group.add(this.visual.group)

    const shadowGeometry = new THREE.PlaneGeometry(
      options.style.width * 2.1,
      options.style.length * 1.25,
    )
    shadowGeometry.rotateX(-Math.PI / 2)
    this.shadow = new THREE.Mesh(
      shadowGeometry,
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        transparent: true,
        depthWrite: false,
      }),
    )
    this.shadow.renderOrder = -1
  }

  /** Velocidad horizontal, que es la que importa para el manejo. */
  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.z)
  }

  reset(x: number, z: number, yaw: number): void {
    this.pos.set(x, this.halfHeight, z)
    this.vel.set(0, 0, 0)
    this.yaw = yaw
    this.quat.setFromAxisAngle(UP, yaw)
    this.refreshBasis()
    this.boost = TUNING.kickoffBoost
    this.grounded = true
    this.flipping = false
    this.supersonic = false
    this.boosting = false
    this.prevJump = false
    this.jumpHoldTimer = 0
    this.sinceJump = Number.POSITIVE_INFINITY
    this.steerVisual = 0
    this.syncMesh()
  }

  update(input: InputState, dt: number, walls: readonly Box[]): void {
    this.justJumped = false
    this.justDodged = false
    this.refreshBasis()

    const wasGrounded = this.grounded
    const jumpPressed = input.jump && !this.prevJump
    this.prevJump = input.jump

    if (!wasGrounded) this.vel.y -= TUNING.gravity * dt

    if (wasGrounded) this.driveGround(input, dt)
    else this.driveAir(input, dt, jumpPressed)

    this.applyBoost(input, dt)

    if (jumpPressed) {
      if (wasGrounded) this.jump()
      else if (this.sinceJump <= TUNING.flipWindow) this.dodge(input)
    }

    // --- Integración y colisiones
    this.pos.addScaledVector(this.vel, dt)
    resolveSphereBoxes(this.pos, this.vel, this.radius, walls, TUNING.carRestitution)

    if (this.pos.y <= this.halfHeight) {
      this.pos.y = this.halfHeight
      if (this.vel.y < 0) this.vel.y = 0
      this.grounded = true
      // Al tocar el piso se endereza: si venía de un flip, queda nivelado.
      if (!wasGrounded) {
        this.flipping = false
        this.jumpHoldTimer = 0
      }
    } else {
      this.grounded = false
    }

    const headroom = TUNING.ceiling - this.halfHeight
    if (this.pos.y > headroom) {
      this.pos.y = headroom
      if (this.vel.y > 0) this.vel.y = 0
    }

    // Los timers se actualizan recién acá, con el estado de suelo ya resuelto:
    // si se hiciera antes, el mismo frame del salto pisaría el `sinceJump` del
    // flip y el doble salto nunca entraría en la ventana.
    if (this.grounded) {
      this.sinceJump = Number.POSITIVE_INFINITY
      this.flipTimer = 0
      this.flipping = false
    } else {
      this.sinceJump += dt
      this.flipTimer -= dt
      if (this.flipTimer <= 0) this.flipping = false
    }

    // El tope es horizontal, como en RL: caer rápido no frena el avance.
    const horizontal = this.speed
    if (horizontal > TUNING.carMaxSpeed) {
      const k = TUNING.carMaxSpeed / horizontal
      this.vel.x *= k
      this.vel.z *= k
    }
    this.supersonic = this.speed > TUNING.supersonic

    this.animate(input, dt)
    this.syncMesh()
  }

  private refreshBasis(): void {
    this.forward.set(0, 0, -1).applyQuaternion(this.quat)
    this.up.set(0, 1, 0).applyQuaternion(this.quat)
    this.right.crossVectors(this.forward, this.up).normalize()
  }

  private driveGround(input: InputState, dt: number): void {
    // Nivelado: sólo yaw. Es lo que endereza el auto al aterrizar.
    this.yaw = Math.atan2(-this.forward.x, -this.forward.z)
    const speed01 = Math.min(1, this.speed / TUNING.throttleTopSpeed)

    // Gira más cerrado a baja velocidad, como RL.
    const yawRate = TUNING.turnRate * (1 - TUNING.turnFalloff * speed01)
    // Yendo en reversa el volante se invierte, si no se maneja al revés.
    const sense = this.vel.x * this.forward.x + this.vel.z * this.forward.z < -0.5 ? -1 : 1
    // Yaw positivo gira hacia -X, o sea a la izquierda: con `steer` +1 = derecha
    // el signo tiene que restar.
    this.yaw -= clamp(input.steer, -1, 1) * yawRate * dt * sense
    this.quat.setFromAxisAngle(UP, this.yaw)
    this.refreshBasis()

    const forwardSpeed = this.vel.x * this.forward.x + this.vel.z * this.forward.z
    let accel = 0
    if (input.throttle > 0) {
      // Se desvanece al acercarse al tope: por eso el boost es lo que estira.
      const t = clamp(forwardSpeed / TUNING.throttleTopSpeed, 0, 1)
      accel = TUNING.throttleAccel * (1 - t)
    } else if (input.throttle < 0) {
      accel = forwardSpeed > 0.2 ? -TUNING.brakeDecel : -TUNING.reverseAccel
      if (forwardSpeed <= -TUNING.throttleTopSpeed) accel = 0
    }
    if (accel !== 0) {
      this.vel.x += this.forward.x * accel * dt
      this.vel.z += this.forward.z * accel * dt
    }

    // Agarre: cancela la velocidad lateral. Con freno de mano el auto derrapa.
    const grip = input.airRoll ? TUNING.driftGrip : TUNING.groundGrip
    const along = this.vel.x * this.forward.x + this.vel.z * this.forward.z
    const k = Math.min(1, grip * dt)
    this.vel.x -= (this.vel.x - this.forward.x * along) * k
    this.vel.z -= (this.vel.z - this.forward.z * along) * k

    if (input.throttle === 0 && !input.boost) {
      const s = this.speed
      if (s > 0.001) {
        const next = Math.max(0, s - TUNING.coastDecel * dt)
        const factor = next / s
        this.vel.x *= factor
        this.vel.z *= factor
      }
    }
  }

  private driveAir(input: InputState, dt: number, jumpPressed: boolean): void {
    if (input.throttle > 0) {
      this.vel.addScaledVector(this.forward, TUNING.airThrottleAccel * dt)
    }

    // Bonus de altura por mantener el salto (RL: +292 uu/s repartidos en 0.2s).
    if (this.jumpHoldTimer > 0) {
      if (input.jump && !jumpPressed) {
        this.vel.addScaledVector(
          this.up,
          (TUNING.jumpHoldBonus / TUNING.jumpHoldTime) * dt,
        )
        this.jumpHoldTimer -= dt
      } else if (!input.jump) {
        this.jumpHoldTimer = 0
      }
    }

    if (this.flipping) {
      this.scratchQuat.setFromAxisAngle(this.flipAxis, TUNING.flipSpinRate * dt)
      this.quat.multiply(this.scratchQuat).normalize()
      this.refreshBasis()
      return
    }

    const pitch = clamp(input.throttle, -1, 1)
    // Yaw positivo gira el morro a la izquierda; `steer` +1 es a la derecha.
    const yaw = input.airRoll ? 0 : -clamp(input.steer, -1, 1)
    const roll = input.airRoll ? clamp(input.steer, -1, 1) : 0
    const mag = Math.hypot(pitch, yaw, roll)
    if (mag < 1e-4) return

    this.scratchAxis.set(pitch, yaw, roll).multiplyScalar(1 / mag)
    const angle = Math.min(mag, 1) * TUNING.maxAngularSpeed * dt
    this.scratchQuat.setFromAxisAngle(this.scratchAxis, angle)
    this.quat.multiply(this.scratchQuat).normalize()
    this.refreshBasis()
  }

  private applyBoost(input: InputState, dt: number): void {
    if (!input.boost || this.boost <= 0) {
      this.boosting = false
      return
    }
    this.boost = Math.max(0, this.boost - TUNING.boostDrain * dt)
    const accel = this.grounded ? TUNING.boostAccelGround : TUNING.boostAccelAir
    this.vel.addScaledVector(this.forward, accel * dt)
    this.boosting = true
  }

  private jump(): void {
    this.vel.addScaledVector(this.up, TUNING.jumpImpulse)
    this.grounded = false
    this.sinceJump = 0
    this.jumpHoldTimer = TUNING.jumpHoldTime
    this.justJumped = true
  }

  private dodge(input: InputState): void {
    this.justDodged = true
    this.sinceJump = Number.POSITIVE_INFINITY

    // Dirección del stick en ejes locales: -Z es el frente.
    const localX = clamp(input.steer, -1, 1)
    const localZ = -clamp(input.throttle, -1, 1)
    const len = Math.hypot(localX, localZ)

    if (len < 0.1) {
      // Sin dirección es un doble salto puro: más altura, sin voltereta.
      this.vel.addScaledVector(this.up, TUNING.doubleJumpImpulse)
      return
    }

    const lx = localX / len
    const lz = localZ / len
    // (lx, lz) local -> mundo: X local es `right`, Z local es `-forward`.
    this.vel.x += (this.right.x * lx - this.forward.x * lz) * TUNING.dodgeImpulse
    this.vel.y +=
      (this.right.y * lx - this.forward.y * lz) * TUNING.dodgeImpulse +
      TUNING.doubleJumpImpulse * 0.35
    this.vel.z += (this.right.z * lx - this.forward.z * lz) * TUNING.dodgeImpulse

    // Eje de la voltereta: perpendicular a la dirección del dodge, en el plano
    // del auto. Un flip hacia adelante gira sobre el eje lateral y así.
    this.flipAxis.set(lz, 0, -lx).normalize()
    this.flipping = true
    this.flipTimer = TUNING.flipTorqueTime
  }

  /** Ruedas que giran y doblan, y llamas del escape cuando boostea. */
  private animate(input: InputState, dt: number): void {
    const forwardSpeed = this.vel.x * this.forward.x + this.vel.z * this.forward.z
    this.wheelSpin += (forwardSpeed / this.style.wheelRadius) * dt

    const target = clamp(input.steer, -1, 1) * MAX_STEER
    this.steerVisual += (target - this.steerVisual) * Math.min(1, dt * 10)

    for (const wheel of this.visual.frontWheels) wheel.rotation.y = -this.steerVisual
    for (const wheel of this.visual.frontWheels) this.spinWheel(wheel)
    for (const wheel of this.visual.rearWheels) this.spinWheel(wheel)

    const flames = this.visual.flames
    flames.visible = this.boosting
    if (this.boosting) {
      // Parpadeo: la llama nunca mide lo mismo dos frames seguidos.
      flames.scale.set(0.85 + Math.random() * 0.3, 0.85 + Math.random() * 0.3, 0.7 + Math.random() * 0.7)
    }
  }

  /**
   * Hace girar una rueda. El auto procedural usa un pivote con dos hijos (goma y
   * llanta); el del GLTF es el mesh de la rueda, sin hijos.
   */
  private spinWheel(wheel: THREE.Object3D): void {
    const angle = this.visual.spinSign * this.wheelSpin
    if (wheel.children.length === 0) {
      wheel.rotation.x = angle
      return
    }
    for (const child of wheel.children) child.rotation.x = angle
  }

  private syncMesh(): void {
    this.group.position.copy(this.pos)
    this.group.quaternion.copy(this.quat)

    // La sombra queda pegada al piso y se agranda y aclara al despegar.
    const lift = Math.max(0, this.pos.y - this.halfHeight)
    const scale = 1 + lift * 0.07
    this.shadow.position.set(this.pos.x, 0.03, this.pos.z)
    this.shadow.scale.setScalar(scale)
    const material = this.shadow.material as THREE.MeshBasicMaterial
    material.opacity = clamp(1 - lift * 0.16, 0.2, 1)
  }

  dispose(): void {
    for (const geometry of this.visual.geometries) geometry.dispose()
    for (const material of this.visual.materials) material.dispose()
    this.shadow.geometry.dispose()
    ;(this.shadow.material as THREE.Material).dispose()
    this.group.clear()
  }
}
