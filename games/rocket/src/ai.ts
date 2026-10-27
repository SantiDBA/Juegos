import * as THREE from 'three'
import { TUNING } from './config'
import { clamp } from './physics'
import type { Rng } from './rng'
import { neutralInput, type Car, type InputState } from './car'
import type { Ball } from './ball'
import type { Team } from './mode'

/**
 * Un bot: percibe la pelota con latencia y ruido, y conduce hacia un punto.
 *
 * El bot no decide a dónde ir. Eso lo hace `TeamBrain`, porque en 3v3 hace
 * falta que los tres se repartan (uno va, otro apoya, otro queda de último) en
 * lugar de perseguir la pelota en fila india.
 */
export class Bot {
  /** Dónde cree que está la pelota. Lo lee `TeamBrain` para repartir roles. */
  readonly aim = new THREE.Vector3()
  /** A qué velocidad cree que va. Se usa para adelantar la puntería. */
  readonly aimVel = new THREE.Vector3()

  private thinkTimer = 0
  private jumpCooldown = 0
  private phase: number
  private readonly phaseX: number
  private readonly phaseZ: number
  private readonly out: InputState = neutralInput()

  constructor(rng: Rng) {
    this.phase = rng.range(0, Math.PI * 2)
    this.phaseX = rng.range(1.6, 2.7)
    this.phaseZ = rng.range(1.2, 2.1)
  }

  /**
   * Actualiza la estimación de la pelota. Se retiene `aiReaction` segundos y se
   * le suma ruido: es lo que hace que el bot sea vencible.
   */
  sense(dt: number, ball: Ball): void {
    this.thinkTimer -= dt
    if (this.thinkTimer > 0) return
    this.thinkTimer = TUNING.aiReaction
    this.phase += 1
    this.aim.set(
      ball.pos.x + Math.sin(this.phase * this.phaseX) * TUNING.aiError,
      ball.pos.y,
      ball.pos.z + Math.cos(this.phase * this.phaseZ) * TUNING.aiError,
    )
    this.aimVel.copy(ball.vel)
  }

  /** Conduce hacia `target`. `chase` habilita el boost, el salto y el remate. */
  drive(dt: number, car: Car, target: THREE.Vector3, chase: boolean): InputState {
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt)

    const toX = target.x - car.pos.x
    const toZ = target.z - car.pos.z
    const dist = Math.hypot(toX, toZ)

    this.out.throttle = 1
    this.out.steer = 0
    this.out.boost = false
    this.out.jump = false
    this.out.airRoll = false

    if (dist < 0.05) return this.out

    const nx = toX / dist
    const nz = toZ / dist
    const dot = car.forward.x * nx + car.forward.z * nz
    const crossY = car.forward.z * nx - car.forward.x * nz
    // `angle` es cuánto hay que girar el yaw para apuntar al objetivo, pero el
    // auto aplica `yaw -= steer * tasa`, así que el volante va con el signo
    // cambiado. Con el signo "natural" el bot doblaba al revés: se alejaba del
    // objetivo, quedaba de espaldas y se la pasaba marcha atrás.
    const angle = Math.atan2(crossY, dot)

    this.out.steer = clamp(-angle * 2.4, -1, 1)

    // A alta velocidad el radio de giro es de varios metros (a 8 m/s no baja de
    // ~3.5), así que con el volante al tope y sin frenar el bot orbitaba la
    // pelota sin llegar a tocarla. Mal alineado y lanzado: frena primero para
    // cerrar el giro; encarado: a fondo, que es cuando la potencia sirve.
    const forwardSpeed = car.vel.x * car.forward.x + car.vel.z * car.forward.z
    const align = Math.max(0, dot)

    if (Math.abs(angle) > 2.3) {
      // Casi de espaldas: da marcha atrás doblando al revés. En reversa el
      // volante también se invierte, así que el signo vuelve a cambiar.
      this.out.throttle = -0.7
      this.out.steer = -this.out.steer
    } else if (Math.abs(angle) > 1.4 && forwardSpeed > 6) {
      this.out.throttle = -1
    } else {
      this.out.throttle = 0.3 + 0.7 * align
    }

    if (!chase) return this.out

    // Distancia y encare reales a la pelota: el objetivo está más allá del
    // balón, así que sirve para conducir pero no para decidir un remate.
    const bx = this.aim.x - car.pos.x
    const bz = this.aim.z - car.pos.z
    const ballDist = Math.hypot(bx, bz)
    const ballDot = ballDist > 0.01 ? (car.forward.x * bx + car.forward.z * bz) / ballDist : 1

    // Boost sólo alineado y lejos, y sin pasarse de su tope propio.
    this.out.boost =
      car.boost > 4 && Math.abs(angle) < 0.55 && dist > 9 && car.speed < TUNING.aiMaxSpeed

    if (!car.grounded || this.jumpCooldown > 0) return this.out

    if (ballDist < TUNING.aiShotRange && ballDot > 0.85 && car.speed > 5) {
      // Remate: encarado y cerca, el flip es el golpe fuerte.
      this.out.jump = true
      this.jumpCooldown = 0.24
    } else if (ballDist > TUNING.aiFlipDistance && Math.abs(angle) < 0.2 && car.speed > 4) {
      // Flip de avance en una recta larga: llega antes que acelerando.
      this.out.jump = true
      this.jumpCooldown = 0.22
    } else if (this.aim.y > 1.4 && ballDist < 4) {
      // Salta a cabecear una pelota alta que le queda cerca.
      this.out.jump = true
      this.jumpCooldown = 0.3
    }

    return this.out
  }
}

/**
 * Los bots de un equipo.
 *
 * Cada tanto relee la pelota, ordena a sus autos por lo que les cuesta llegar y
 * reparte el rol por rango: el más barato ataca, el siguiente apoya y el resto
 * defiende. Los roles se recalculan solos, así que van rotando a medida que se
 * mueven.
 */
export class TeamBrain {
  readonly inputs: InputState[] = []

  private readonly bots: Bot[] = []
  /** Lado preferido de cada auto: mantiene la separación entre compañeros. */
  private readonly spread: number[] = []
  /**
   * Si el auto ya está bien parado detrás de la pelota. Se recuerda para que la
   * decisión tenga histéresis (ver `attackTarget`).
   */
  private readonly behind: boolean[] = []
  /** Costo de llegar a la pelota, para el reparto de roles. */
  private readonly cost: number[] = []
  private readonly target = new THREE.Vector3()
  private readonly point = new THREE.Vector3()
  private readonly order: number[] = []
  private roleTimer = 0
  private stallTimer = 0
  private readonly attackZ: number
  private readonly ownGoalZ: number

  constructor(
    readonly cars: Car[],
    team: Team,
    rng: Rng,
  ) {
    for (let i = 0; i < cars.length; i++) {
      this.bots.push(new Bot(rng))
      this.spread.push(i % 2 === 0 ? 1 : -1)
      this.behind.push(false)
      this.cost.push(0)
      this.inputs.push(neutralInput())
    }
    this.attackZ = team === 'blue' ? TUNING.fieldLength / 2 : -TUNING.fieldLength / 2
    this.ownGoalZ = -this.attackZ
  }

  update(dt: number, ball: Ball): void {
    const count = this.cars.length

    // Percibir es por frame; repartir los roles, cada tanto.
    for (let i = 0; i < count; i++) this.bots[i]!.sense(dt, ball)

    this.roleTimer -= dt
    if (this.roleTimer <= 0) {
      this.roleTimer = TUNING.aiRoleHold
      this.order.length = 0
      for (let i = 0; i < count; i++) this.order.push(i)

      for (let i = 0; i < count; i++) {
        const car = this.cars[i]!
        const aim = this.bots[i]!.aim
        const dist = Math.hypot(aim.x - car.pos.x, aim.z - car.pos.z)
        // Ventaja para el que ya está del lado bueno: puede empujar de una,
        // mientras que el otro primero tiene que rodear la pelota.
        const bonus = this.onGoodSide(car.pos.z, aim.z) ? TUNING.aiSideBonus : 0
        this.cost[i] = dist - bonus
      }
      this.order.sort((a, b) => this.cost[a]! - this.cost[b]!)
    }

    if (ball.vel.lengthSq() < TUNING.aiStallSpeed * TUNING.aiStallSpeed) this.stallTimer += dt
    else this.stallTimer = 0

    for (let rank = 0; rank < count; rank++) {
      const i = this.order[rank]!
      const car = this.cars[i]!
      const bot = this.bots[i]!
      const chase = rank === 0

      this.predict(car, bot)

      if (rank === 0) {
        this.attackTarget(i, car, this.point)
        // Pelota muerta: a la pelota derecho, que el choque la despierte.
        if (this.stallTimer > TUNING.aiStallSeconds) this.target.set(this.point.x, 0, this.point.z)
      } else if (rank === 1) {
        this.supportTarget(this.point, this.spread[i]!)
      } else {
        this.defendTarget(this.point, rank, this.spread[i]!)
      }

      this.clampTarget(car.radius)
      this.inputs[i] = bot.drive(dt, car, this.target, chase)
    }
  }

  /**
   * Adelanta la puntería sobre la pelota según el tiempo que el auto tarda en
   * llegar. Sin esto el bot apunta al lugar donde la pelota estaba y llega
   * siempre medio segundo tarde, que es la diferencia entre pegarle y rozarla.
   */
  private predict(car: Car, bot: Bot): void {
    const dist = Math.hypot(bot.aim.x - car.pos.x, bot.aim.z - car.pos.z)
    const lead = Math.min(TUNING.aiLeadMax, dist / Math.max(6, car.speed))
    this.point.set(
      bot.aim.x + bot.aimVel.x * lead,
      bot.aim.y,
      bot.aim.z + bot.aimVel.z * lead,
    )
  }

  /** ¿Está entre la pelota y su propio arco? Ahí no conviene tocar la pelota. */
  private onGoodSide(carZ: number, ballZ: number): boolean {
    return (carZ - ballZ) * Math.sign(this.attackZ) < 0
  }

  /**
   * Atacante: apunta al punto de la boca del arco más cercano a la pelota, un
   * poco dentro de la red. Apuntar al centro desde un costado empujaba la pelota
   * de lado; apuntar al centro del arco dejaba la pelota muerta sobre la línea.
   */
  private attackTarget(index: number, car: Car, aim: THREE.Vector3): void {
    const aimZ = this.attackZ + Math.sign(this.attackZ) * TUNING.aiGoalMouthDepth
    const mouthLimit = TUNING.goalHalfWidth - 1
    const pullX = clamp(aim.x, -mouthLimit, mouthLimit) - aim.x
    const pullZ = aimZ - aim.z
    const len = Math.hypot(pullX, pullZ) || 1
    const dirX = pullX / len
    const dirZ = pullZ / len

    // Bien parado = del lado opuesto al arco, con la pelota entre el auto y la
    // meta: recién ahí empujar la manda para adelante.
    //
    // Con histéresis, porque parado justo al costado de la pelota el coseno da
    // casi cero y el objetivo saltaba de un lado al otro de la pelota en frames
    // consecutivos: el auto se quedaba oscilando sin decidirse a empujar.
    const awayX = car.pos.x - aim.x
    const awayZ = car.pos.z - aim.z
    const awayLen = Math.hypot(awayX, awayZ) || 1
    const cos = (awayX * dirX + awayZ * dirZ) / awayLen
    const behind = this.behind[index] ? cos < 0.25 : cos < -0.25
    this.behind[index] = behind

    if (behind) {
      // Embiste apuntando más allá de la pelota, en la recta al arco.
      this.target.set(
        aim.x + dirX * TUNING.aiAimOvershoot,
        0,
        aim.z + dirZ * TUNING.aiAimOvershoot,
      )
      return
    }

    // Del lado equivocado: rodea, pero por el costado. Ir derecho al punto de
    // atrás metía la pelota en el camino y el bot la empujaba para el otro lado.
    const side = this.spread[index]!
    this.target.set(
      aim.x - dirX * TUNING.aiApproachDistance - dirZ * side * TUNING.aiSwing,
      0,
      aim.z - dirZ * TUNING.aiApproachDistance + dirX * side * TUNING.aiSwing,
    )
  }

  /** Apoyo: delante de la pelota y corrido al costado, para recibir el rebote. */
  private supportTarget(aim: THREE.Vector3, side: number): void {
    const forwardZ = Math.sign(this.attackZ)
    this.target.set(
      aim.x + side * TUNING.aiSupportSpread,
      0,
      aim.z + forwardZ * TUNING.aiSupportDepth,
    )
  }

  /**
   * Defensor: sobre la recta de su arco a la pelota, más adelante cuanto más
   * lejos está la pelota. Se lo deja cerca del arco y no persiguiendo al córner:
   * ahí no defiende nada.
   */
  private defendTarget(aim: THREE.Vector3, rank: number, side: number): void {
    const dz = aim.z - this.ownGoalZ
    const len = Math.hypot(aim.x, dz) || 1
    const depth = clamp(len * 0.35, 6, TUNING.aiDefendDepth) * (1 + (rank - 2) * 0.2)
    this.target.set(
      (aim.x / len) * depth + side * TUNING.aiSupportSpread * 0.35,
      0,
      this.ownGoalZ + (dz / len) * depth,
    )
  }

  /**
   * El objetivo no puede caer dentro de las paredes laterales. En z sí se deja
   * entrar a la boca del arco: si no, el que ataca frena justo sobre la línea y
   * la pelota se queda ahí para siempre.
   */
  private clampTarget(carRadius: number): void {
    const limitX = TUNING.fieldWidth / 2 - carRadius - 0.25
    this.target.x = clamp(this.target.x, -limitX, limitX)
    const inMouth = Math.abs(this.target.x) < TUNING.goalHalfWidth - carRadius
    const limitZ = inMouth
      ? TUNING.fieldLength / 2 + TUNING.goalDepth
      : TUNING.fieldLength / 2 - carRadius - 0.25
    this.target.z = clamp(this.target.z, -limitZ, limitZ)
  }
}
