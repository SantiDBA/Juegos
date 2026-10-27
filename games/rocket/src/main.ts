import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { COLORS, TUNING } from './config'
import { buildArena, type Arena } from './arena'
import { Ball } from './ball'
import { TeamBrain } from './ai'
import { Car, neutralInput, type InputState } from './car'
import { CAR_ORDER, CAR_STYLES, type CarStyleId } from './carStyles'
import { loadCarModels, type CarModels } from './carModels'
import { BurstParticles, CameraFeel, ShockRing, SpeedTrail } from './effects'
import { PostFX } from './postfx'
import { Sfx } from './sfx'
import { insideGoal, sphereVsSphere } from './physics'
import { Rng, randomSeed } from './rng'
import { kickoffSpawns, type KickoffOptions } from './kickoff'
import { MODES, type GameMode } from './mode'
import {
  createHud,
  readBest,
  readCar,
  readMode,
  readMuted,
  saveBest,
  saveCar,
  saveMode,
  saveMuted,
  type GameState,
} from './hud'

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('scene') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.25

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1322)
scene.fog = new THREE.Fog(0x0d1322, 110, 300)

const camera = new THREE.PerspectiveCamera(
  TUNING.cameraFov,
  window.innerWidth / window.innerHeight,
  0.1,
  420,
)

// Luces: ambiente frío, un sol fijo que cubre toda la cancha y un contraluz
// azul. El sol estático (en vez de seguir al jugador) porque el frustro de
// sombra tiene que alcanzar los bordes: si queda corto, las zonas fuera de él
// se ven raras y la cancha pierde legibilidad.
const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x3b4468, 1.5)
scene.add(hemi)

const ambient = new THREE.AmbientLight(0x46578a, 0.75)
scene.add(ambient)

const sun = new THREE.DirectionalLight(0xfff2dc, 2)
sun.position.set(62, 96, 46)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 320
sun.shadow.camera.left = -66
sun.shadow.camera.right = 66
sun.shadow.camera.top = 66
sun.shadow.camera.bottom = -66
sun.shadow.bias = -0.0008
scene.add(sun, sun.target)

const rim = new THREE.DirectionalLight(0x5a7bff, 0.5)
rim.position.set(-20, 18, -30)
scene.add(rim)

// ---------------------------------------------------------------- sistemas

const sfx = new Sfx()
const particles = new BurstParticles()
const cameraFeel = new CameraFeel(TUNING.cameraFov)
const hud = createHud()
scene.add(particles.points)

let postfx: PostFX | null = null
try {
  postfx = new PostFX(renderer, scene, camera)
} catch {
  // Sin targets de float (WebGL1 o drivers viejos) se juega sin bloom.
  postfx = null
}

// Entorno para los reflejos de la pintura y los cristales. Va por material y no
// en `scene.environment` para no cambiar cómo se ve la cancha.
let envMap: THREE.Texture | null = null
try {
  const pmrem = new THREE.PMREMGenerator(renderer)
  envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
} catch {
  envMap = null
}

const arena: Arena = buildArena()
scene.add(arena.group)

const ball = new Ball()
scene.add(ball.mesh)

const trail = new SpeedTrail()
scene.add(trail.line)

const shockRing = new ShockRing()
scene.add(shockRing.mesh)

// Marca luminosa sobre el auto del jugador: en 3v3 hay tres autos azules y hay
// que poder reconocerse de un vistazo. Se crea una sola vez y se reengancha al
// grupo del jugador cada vez que se rearma el partido.
const playerMarker = new THREE.Mesh(
  new THREE.ConeGeometry(0.16, 0.34, 4),
  new THREE.MeshBasicMaterial({ color: 0xdcecff, transparent: true, opacity: 0.85 }),
)
playerMarker.position.set(0, 1.15, 0)
playerMarker.rotation.x = Math.PI

const BLUE = new THREE.Color(COLORS.blue)
const ORANGE = new THREE.Color(COLORS.orange)

/** Los números del kickoff, resueltos una vez desde `TUNING`. */
const KICKOFF: KickoffOptions = {
  radius: TUNING.kickoffRadius,
  spread: TUNING.kickoffSpread,
}

// ---------------------------------------------------------------- estado

let state: GameState = 'menu'
let pausedFrom: GameState = 'playing'
let mode: GameMode = readMode()
let carStyle: CarStyleId = readCar()
let blueScore = 0
let orangeScore = 0
let practiceGoals = 0
let clock: number = TUNING.matchSeconds
let overtime = false
let kickoffTimer = 0
let goalTimer = 0
let lastCount = TUNING.kickoffCountdown + 1
let ballCam = true
let elapsed = 0
let wasSupersonic = false

/** Todos los autos, con el jugador siempre primero. */
let cars: Car[] = []
let blueCars: Car[] = []
let orangeCars: Car[] = []
let brains: TeamBrain[] = []
let player!: Car
/** Plantillas GLTF ya cargadas; vacío mientras no estén o si faltan. */
let carModels: CarModels = new Map()

const training = (): boolean => mode === 'training'

const held = new Set<string>()
const currentInput: InputState = neutralInput()

// ---------------------------------------------------------------- cámara

const camPos = new THREE.Vector3(0, 14, 46)
const camTarget = new THREE.Vector3(0, 2, 0)
const flatForward = new THREE.Vector3(0, 0, 1)
const desired = new THREE.Vector3()
const lookAt = new THREE.Vector3()
let camSnap = true

function updateCamera(dt: number): void {
  if (state === 'menu') {
    // Órbita lenta para que el fondo del menú esté vivo.
    const t = elapsed * 0.16
    desired.set(Math.cos(t) * 46, 15, Math.sin(t) * 52)
    lookAt.set(0, 2, 0)
  } else {
    flatForward.set(player.forward.x, 0, player.forward.z)
    if (flatForward.lengthSq() < 1e-6) flatForward.set(0, 0, -1)
    flatForward.normalize()

    desired.copy(player.pos).addScaledVector(flatForward, -TUNING.cameraDistance)
    desired.y = player.pos.y + TUNING.cameraHeight

    lookAt.copy(player.pos).addScaledVector(player.forward, 6)
    if (ballCam) lookAt.lerp(ball.pos, TUNING.ballCamBlend)
  }

  if (camSnap) {
    camPos.copy(desired)
    camTarget.copy(lookAt)
    camSnap = false
  } else {
    const k = Math.min(1, dt * TUNING.cameraLag)
    camPos.lerp(desired, k)
    camTarget.lerp(lookAt, Math.min(1, dt * 10))
  }

  // Nunca meterse bajo el piso: el piso de la cancha es y=0.
  if (camPos.y < 0.7) camPos.y = 0.7

  camera.position.copy(camPos)
  camera.lookAt(camTarget)
  cameraFeel.update(dt, camera, elapsed)
}

// ---------------------------------------------------------------- actores

/** Un chasis al azar para los bots, para que la cancha no se vea uniforme. */
function randomStyle(rng: Rng): CarStyleId {
  return CAR_ORDER[rng.int(0, CAR_ORDER.length - 1)]!
}

/** Rearma los autos del modo actual. El jugador siempre es el primer azul. */
function buildAgents(): void {
  for (const car of cars) {
    car.dispose()
    scene.remove(car.group)
    scene.remove(car.shadow)
  }
  cars = []
  blueCars = []
  orangeCars = []
  brains = []

  const rng = new Rng(randomSeed())
  const roster = MODES[mode]

  const make = (styleId: CarStyleId, body: number, accent: number): Car => {
    const car = new Car({
      style: CAR_STYLES[styleId],
      body,
      accent,
      envMap,
      model: carModels.get(styleId) ?? null,
    })
    scene.add(car.group, car.shadow)
    cars.push(car)
    return car
  }

  for (let i = 0; i < roster.blue; i++) {
    const isPlayer = i === 0
    const car = make(
      isPlayer ? carStyle : randomStyle(rng),
      isPlayer ? COLORS.blue : COLORS.blueBot,
      0x9fd0ff,
    )
    blueCars.push(car)
    if (isPlayer) {
      player = car
      car.group.add(playerMarker)
    }
  }

  for (let i = 0; i < roster.orange; i++) {
    orangeCars.push(make(randomStyle(rng), COLORS.orange, 0xffd0a0))
  }

  const teammates = blueCars.slice(1)
  if (teammates.length > 0) brains.push(new TeamBrain(teammates, 'blue', rng))
  if (orangeCars.length > 0) brains.push(new TeamBrain(orangeCars, 'orange', rng))
}

function placeActors(): void {
  const rng = new Rng(randomSeed())
  const blue = kickoffSpawns('blue', blueCars.length, rng, KICKOFF)
  const orange = kickoffSpawns('orange', orangeCars.length, rng, KICKOFF)

  blueCars.forEach((car, i) => {
    const spawn = blue[i]!
    car.reset(spawn.x, spawn.z, spawn.yaw)
  })
  orangeCars.forEach((car, i) => {
    const spawn = orange[i]!
    car.reset(spawn.x, spawn.z, spawn.yaw)
  })

  ball.reset(0)
  trail.reset()
  shockRing.reset()
  wasSupersonic = false
  camSnap = true
}

function beginKickoff(): void {
  placeActors()
  state = 'kickoff'
  kickoffTimer = TUNING.kickoffCountdown
  lastCount = TUNING.kickoffCountdown + 1
  hud.showCountdown(null)
}

function startMatch(): void {
  sfx.unlock()
  blueScore = 0
  orangeScore = 0
  practiceGoals = 0
  clock = TUNING.matchSeconds
  overtime = false

  buildAgents()

  hud.setModeLabels(mode)
  hud.setCarLabels(carStyle)
  hud.setScore(0, 0)
  hud.setClock(clock, false)
  hud.setBoost(player.boost)
  hud.setSupersonic(false)
  hud.showOverlay(false)
  hud.setModePickerVisible(false)
  hud.setCarPickerVisible(false)
  hud.setHudVisible(true)

  if (training()) {
    placeActors()
    state = 'playing'
    hud.showCountdown(null)
    hud.showToast('<b>entrenamiento</b><span class="sub">R trae la pelota al centro</span>')
  } else {
    beginKickoff()
  }
}

function scoreGoal(sign: number): void {
  const playerScored = sign > 0
  const color = playerScored ? BLUE : ORANGE

  hud.flashGoal(playerScored ? 'blue' : 'orange')
  particles.burst(ball.pos, color, 110, 14)
  cameraFeel.addShake(TUNING.goalShake)
  cameraFeel.addFovKick(9)
  sfx.goal()
  trail.reset()

  if (training()) {
    practiceGoals++
    hud.setScore(practiceGoals, 0)
    state = 'goal'
    goalTimer = TUNING.trainingResetDelay
    return
  }

  if (playerScored) blueScore++
  else orangeScore++
  hud.setScore(blueScore, orangeScore)

  if (overtime) {
    finishMatch()
    return
  }

  state = 'goal'
  goalTimer = TUNING.goalFreeze
  hud.showToast(
    playerScored
      ? '<b>¡gol tuyo!</b>'
      : '<b>gol rival</b><span class="sub">salí rápido al próximo kickoff</span>',
  )
}

function finishMatch(): void {
  state = 'gameover'
  hud.showCountdown(null)
  hud.setSupersonic(false)
  sfx.setBoost(false)
  held.clear()

  const won = blueScore > orangeScore
  if (won) sfx.win()
  else sfx.lose()

  const previousBest = readBest()
  const isRecord = saveBest(blueScore)
  const best = isRecord ? blueScore : previousBest
  const recordLine = best !== null ? ` · récord: ${best}` : ''
  const rival = mode === 'duel' ? 'bot' : 'rivales'

  hud.setOverlayTitle(
    won ? 'ganaste' : 'perdiste',
    `${MODES[mode].label} · vos ${blueScore} — ${orangeScore} ${rival}${recordLine}`,
    'Revancha',
  )
  hud.showOverlay(true)
  hud.setModePickerVisible(true)
  hud.setCarPickerVisible(true)
  hud.setHudVisible(false)
}

// ---------------------------------------------------------------- input

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function togglePause(): void {
  if (state === 'paused') {
    state = pausedFrom
    hud.showOverlay(false)
    hud.setHudVisible(true)
    return
  }
  if (state !== 'playing' && state !== 'kickoff' && state !== 'goal') return
  pausedFrom = state
  state = 'paused'
  held.clear()
  sfx.setBoost(false)
  hud.setOverlayTitle('pausa', 'Tocá seguir para volver a la cancha.', 'Seguir')
  hud.showOverlay(true)
  hud.setModePickerVisible(false)
  hud.setCarPickerVisible(false)
  hud.setHudVisible(false)
}

function toggleMute(): void {
  sfx.setMuted(!sfx.muted)
  saveMuted(sfx.muted)
  hud.showToast(sfx.muted ? 'silencio' : 'sonido')
}

function onKeyDown(e: KeyboardEvent): void {
  if (isTypingTarget(e.target)) return
  const code = e.code
  if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault()

  if (code === 'KeyM') {
    toggleMute()
    return
  }
  if (code === 'KeyC') {
    ballCam = !ballCam
    hud.showToast(ballCam ? 'ball cam' : 'cámara fija')
    return
  }
  if (code === 'KeyR') {
    if (training() && state === 'playing') {
      ball.reset(0)
      hud.showToast('pelota al centro')
    }
    return
  }
  if (code === 'KeyP' || code === 'Escape') {
    togglePause()
    return
  }
  if (code === 'Space' || code === 'Enter') {
    if (state === 'menu' || state === 'gameover') {
      startMatch()
      return
    }
    if (state === 'paused') {
      togglePause()
      return
    }
  }
  held.add(code)
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', (e) => {
  held.delete(e.code)
})
window.addEventListener('blur', () => {
  held.clear()
  if (state === 'playing' || state === 'kickoff' || state === 'goal') togglePause()
})

hud.onPlay(() => {
  if (state === 'paused') togglePause()
  else startMatch()
})

hud.onModeChange((next) => {
  if (next === mode) return
  mode = next
  saveMode(mode)
  // Fuera de un partido se rearma el fondo con el equipo del modo nuevo; en el
  // menú y al final del partido es lo que se ve detrás del panel.
  if (state === 'menu' || state === 'gameover') {
    buildAgents()
    placeActors()
    hud.setModeLabels(mode)
    hud.setOverlayTitle('rocket', MODES[mode].tagline, 'Jugar')
  }
})

hud.onCarChange((next) => {
  if (next === carStyle) return
  carStyle = next
  saveCar(carStyle)
  if (state === 'menu' || state === 'gameover') {
    buildAgents()
    placeActors()
  }
})

function readInput(): InputState {
  currentInput.throttle = (held.has('KeyW') ? 1 : 0) + (held.has('KeyS') ? -1 : 0)
  currentInput.steer = (held.has('KeyD') ? 1 : 0) + (held.has('KeyA') ? -1 : 0)
  currentInput.boost = held.has('ShiftLeft') || held.has('ShiftRight')
  currentInput.jump = held.has('Space')
  currentInput.airRoll = held.has('ControlLeft') || held.has('ControlRight')
  return currentInput
}

// ---------------------------------------------------------------- simulación

function step(dt: number): void {
  // Reloj: sólo en los modos con partido.
  if (!training()) {
    clock -= dt
    if (clock <= 0 && !overtime) {
      clock = 0
      if (blueScore === orangeScore) {
        overtime = true
        sfx.overtime()
        hud.showToast('<b>gol de oro</b><span class="sub">el que mete, gana</span>')
      } else {
        finishMatch()
        return
      }
    }
  }

  player.update(readInput(), dt, arena.walls)
  for (const brain of brains) {
    brain.update(dt, ball)
    for (let i = 0; i < brain.cars.length; i++) {
      brain.cars[i]!.update(brain.inputs[i]!, dt, arena.walls)
    }
  }

  // Los autos se chocan entre sí: se nota y es parte del juego.
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i]!
      const b = cars[j]!
      sphereVsSphere(
        a.pos,
        a.vel,
        a.radius,
        TUNING.carMass,
        b.pos,
        b.vel,
        b.radius,
        TUNING.carMass,
        0.35,
      )
    }
  }

  arena.update(dt)

  for (const car of cars) {
    const gained = arena.tryPickup(car.pos)
    if (gained <= 0) continue
    car.boost = Math.min(TUNING.boostMax, car.boost + gained)
    if (car === player) sfx.pad()
  }

  const wallImpact = ball.update(dt, arena.colliders, arena.planes)
  if (wallImpact > 3) sfx.wallHit()

  // Se resuelve el choque contra todos y se suena una sola vez, con el más
  // fuerte: con seis autos el sonido se apilaba y saturaba.
  let loudest = 0
  let playerTouched = false
  for (const car of cars) {
    const hit = ball.collideCar(car)
    if (hit > loudest) loudest = hit
    if (car === player && hit > 1.5) playerTouched = true
  }
  if (loudest > 1.5) sfx.ballHit(loudest)
  if (loudest > 5) {
    // Golpe fuerte: la pelota destella y, si fue tuyo, saltan chispas.
    ball.flashHit(loudest)
    if (playerTouched) particles.burst(ball.pos, BLUE, 12, 7)
  }

  if (player.justJumped) sfx.jump()
  if (player.justDodged) sfx.dodge()
  if (player.boosting) cameraFeel.addFovKick(5)

  // Estampido al cruzar el umbral de supersónico.
  if (player.supersonic && !wasSupersonic) shockRing.burst(player.pos)
  wasSupersonic = player.supersonic

  // Red de seguridad: si el balón se escapó de la cancha, vuelve al centro.
  if (
    Math.abs(ball.pos.x) > TUNING.fieldWidth ||
    Math.abs(ball.pos.z) > TUNING.fieldLength + TUNING.goalDepth + 6 ||
    ball.pos.y < -4 ||
    ball.pos.y > TUNING.ceiling + 4
  ) {
    ball.reset(0)
  }

  for (const goal of arena.goals) {
    if (
      insideGoal(ball.pos, goal.lineZ, goal.sign, goal.halfWidth, goal.height, ball.radius)
    ) {
      scoreGoal(goal.sign)
      return
    }
  }

  trail.update(player.pos, player.supersonic)
}

function updateHud(): void {
  if (!training()) hud.setClock(clock, overtime)
  hud.setBoost(player.boost)
  hud.setSupersonic(player.supersonic && (state === 'playing' || state === 'kickoff'))
}

// ---------------------------------------------------------------- loop

let last = performance.now()

function frame(now: number): void {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  elapsed += dt

  if (state === 'kickoff') {
    kickoffTimer -= dt
    const shown = Math.ceil(kickoffTimer)
    if (shown !== lastCount) {
      lastCount = shown
      if (shown > 0) {
        hud.showCountdown(shown)
        sfx.count(shown)
      }
    }
    if (kickoffTimer <= 0) {
      hud.showCountdown(null)
      state = 'playing'
    }
  } else if (state === 'playing') {
    step(dt)
  } else if (state === 'goal') {
    goalTimer -= dt
    if (goalTimer <= 0) {
      if (training()) {
        // Sin rivales no hay kickoff: sólo vuelve la pelota al centro.
        ball.reset(0)
        state = 'playing'
      } else {
        beginKickoff()
      }
    }
  }

  particles.update(dt)
  shockRing.update(dt)
  updateCamera(dt)
  updateHud()

  sfx.setEngine(
    Math.min(1, player.speed / TUNING.carMaxSpeed),
    state === 'playing' || state === 'kickoff',
  )
  sfx.setBoost(player.boosting && state === 'playing')

  if (postfx) postfx.render(dt)
  else renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx?.setSize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio, 2))
})

// ---------------------------------------------------------------- arranque

sfx.setMuted(readMuted())
buildAgents()
placeActors()
hud.setModeLabels(mode)
hud.setCarLabels(carStyle)
hud.setModePickerVisible(true)
hud.setCarPickerVisible(true)
hud.setOverlayTitle('rocket', MODES[mode].tagline, 'Jugar')
hud.showOverlay(true)
hud.setHudVisible(false)
requestAnimationFrame(frame)

// Los modelos llegan después del primer render: mientras tanto se juega con los
// autos procedurales y, cuando están, se rearma el fondo del menú.
void loadCarModels().then((models) => {
  if (models.size === 0) return
  carModels = models
  if (state === 'menu' || state === 'gameover') {
    buildAgents()
    placeActors()
  }
})
