import * as THREE from 'three'
import { TUNING } from './config'
import { buildLevel, disposeLevel, type Level, type PowerUpKind } from './level'
import { createHud, readBest, readMode, saveBest, saveMode, type GameState, type ScreenHint } from './hud'
import { Pickups, PowerUps, ComboMeter, type OrbKind } from './pickups'
import { Enemies } from './enemies'
import { PlayerController } from './player'
import { BurstParticles, CameraFeel } from './effects'
import { PostFX } from './postfx'
import { Sfx } from './sfx'
import { randomSeed } from './rng'

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
renderer.toneMappingExposure = 1.05

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b0d12)
scene.fog = new THREE.Fog(0x0b0d12, 40, 110)

const BASE_FOV = 75
const camera = new THREE.PerspectiveCamera(
  BASE_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  400,
)

scene.add(new THREE.HemisphereLight(0x9fc7ff, 0x14161f, 0.75))

const sun = new THREE.DirectionalLight(0xfff0d8, 2.1)
sun.position.set(28, 44, 18)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 140
const shadowExtent = 42
sun.shadow.camera.left = -shadowExtent
sun.shadow.camera.right = shadowExtent
sun.shadow.camera.top = shadowExtent
sun.shadow.camera.bottom = -shadowExtent
sun.shadow.bias = -0.0005
scene.add(sun)
scene.add(sun.target)

const rim = new THREE.DirectionalLight(0x6a8bff, 0.5)
rim.position.set(-24, 16, -22)
scene.add(rim)

// ---------------------------------------------------------------- sistemas

const sfx = new Sfx()
const particles = new BurstParticles()
const cameraFeel = new CameraFeel(BASE_FOV)
const combo = new ComboMeter()
scene.add(particles.points)

let postfx: PostFX | null = null
try {
  postfx = new PostFX(renderer, scene, camera)
} catch {
  // WebGL2 sin soporte de float targets: se juega sin bloom.
  postfx = null
}

let level: Level
let pickups: Pickups
let powerUps: PowerUps
let enemies: Enemies
let player: PlayerController

/** Si los enemigos participan en la partida. Cambia el récord aplicable. */
let enemiesOn = readMode()

function spawnLevel(seed: number): void {
  if (level) {
    disposeLevel(scene, level)
    pickups.dispose()
    powerUps.dispose()
    enemies.dispose()
  }

  level = buildLevel(scene, seed)

  // Un solo array de coleccionables: normales + dorados + rojos.
  const spots = [...level.orbSpots, ...level.goldSpots, ...level.hazardSpots]
  const kinds: OrbKind[] = [
    ...level.orbSpots.map(() => 'normal' as const),
    ...level.goldSpots.map(() => 'gold' as const),
    ...level.hazardSpots.map(() => 'hazard' as const),
  ]
  pickups = new Pickups(spots, kinds)
  scene.add(pickups.group)

  powerUps = new PowerUps(level.powerSpots)
  scene.add(powerUps.group)

  // Sin enemigos no hay patrullas: el bucle los ignora y la partida es limpia.
  enemies = new Enemies(enemiesOn ? level.enemyPatrols : [], level.colliders, level.stairs)
  scene.add(enemies.group)
  player = new PlayerController(level.spawn, level.colliders)
}

spawnLevel(randomSeed())

// ---------------------------------------------------------------- input

const keys = new Set<string>()
const input = { forward: 0, strafe: 0, run: false }

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

window.addEventListener('keydown', (e) => {
  if (isTypingTarget(e.target)) return
  keys.add(e.code)
  if (state !== 'playing') return

  if (e.code === 'Space') {
    e.preventDefault()
    if (player.jump()) sfx.jump()
  }
  if (e.code === 'Escape') pause()
  if (e.code === 'KeyM') {
    sfx.setMuted(!sfx.muted)
    hud.showToast(sfx.muted ? 'sonido apagado' : 'sonido encendido', 1000)
  }
})

window.addEventListener('keyup', (e) => {
  keys.delete(e.code)
})

window.addEventListener('blur', () => {
  keys.clear()
  if (state === 'playing') pause()
})

document.addEventListener('mousemove', (e) => {
  if (state !== 'playing' || document.pointerLockElement !== canvas) return
  player.look(e.movementX, e.movementY)
})

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state === 'playing') pause()
})

function readInput(): void {
  const f = (keys.has('KeyW') ? 1 : 0) + (keys.has('ArrowUp') ? 1 : 0)
  const b = (keys.has('KeyS') ? 1 : 0) + (keys.has('ArrowDown') ? 1 : 0)
  const l = (keys.has('KeyA') ? 1 : 0) + (keys.has('ArrowLeft') ? 1 : 0)
  const r = (keys.has('KeyD') ? 1 : 0) + (keys.has('ArrowRight') ? 1 : 0)
  input.forward = f - b
  input.strafe = r - l
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight')
}

// ---------------------------------------------------------------- estado

const hud = createHud()
let state: GameState = 'menu'
/**
 * Segundos que quedan. Antes el reloj subía y el combo multiplicaba su
 * velocidad; ahora es una cuenta regresiva y tanto los orbes dorados como el
 * combo suman tiempo, así que el skill se ve en el número.
 */
let timeLeft: number = TUNING.startSeconds
let collected = 0
let seed = 0
/** Reloj monotónico de animación: nunca retrocede aunque el tiempo se recupere. */
let clockTime = 0
/** Punto al que vuelve el jugador si cae al vacío. */
let checkpoint = new THREE.Vector3()

const eye = new THREE.Vector3()
const viewDir = new THREE.Vector3()
const prevPlayerPos = new THREE.Vector3()
const midpoint = new THREE.Vector3()
const samplePoint = new THREE.Vector3()

const COLOR_NORMAL = new THREE.Color(0x57e0c8)
const COLOR_GOLD = new THREE.Color(0xffc94d)
const COLOR_RED = new THREE.Color(0xff6b6b)
const COLOR_POWER: Record<PowerUpKind, THREE.Color> = {
  turbo: new THREE.Color(0x7cc4ff),
  doubleJump: new THREE.Color(0xc39bff),
  slowmo: new THREE.Color(0x9dff9d),
}

// El HUD refleja el modo guardado en el toggle, su nota y la leyenda.
hud.setEnemiesMode(enemiesOn)
hud.setBest(readBest(enemiesOn))

hud.onPlay(() => {
  sfx.unlock()
  void startPlaying()
})

hud.onEnemiesChange((on) => {
  enemiesOn = on
  saveMode(on)
  // El récord cambia de golpe al cambiar el modo.
  hud.setBest(readBest(on))
  hud.showToast(on ? 'con enemigos' : 'sin enemigos', 1000)
  // El toggle vive en el overlay: también se puede cambiar en pausa, así que
  // la amenaza tiene que entrar o salir en el acto, no en el próximo reinicio.
  if (state === 'playing' || state === 'paused') respawnEnemies()
})

/** Reemplaza el grupo de enemigos respetando el modo actual. */
function respawnEnemies(): void {
  scene.remove(enemies.group)
  enemies.dispose()
  enemies = new Enemies(enemiesOn ? level.enemyPatrols : [], level.colliders, level.stairs)
  scene.add(enemies.group)
  hud.setThreatened(false)
}

async function startPlaying(): Promise<void> {
  if (state === 'playing') return
  if (state === 'menu') resetRun(true)
  // Tras ganar se arranca una arena nueva; tras morir o pausar se repite la
  // misma, para que el récord compare tiempos sobre el mismo nivel.
  else if (state === 'won') resetRun(true)
  else if (state === 'dead') resetRun(false)
  state = 'playing'
  hud.showOverlay(false)
  hud.setHudVisible(true)
  hud.setCrosshairVisible(true)
  try {
    await canvas.requestPointerLock()
  } catch {
    // El navegador puede rechazar el lock; el juego sigue sin captura de mouse.
  }
}

function resetRun(newSeed = true): void {
  // Reintentar tras morir conserva la arena: el récord es sobre tiempo, no
  // sobre memorizar el laberinto, así que cambiar de semilla invalidaría la
  // comparación. Sólo "otra vez" tras ganar pide un nivel nuevo.
  if (newSeed || !level) {
    seed = randomSeed()
    spawnLevel(seed)
  }

  timeLeft = TUNING.startSeconds
  collected = 0
  clockTime = 0
  combo.reset()
  particles.clear()
  cameraFeel.reset()
  pickups.reset()
  powerUps.reset()
  player.reset(level.spawn)
  checkpoint.copy(level.spawn)

  hud.setOrbs(0, level.orbSpots.length)
  hud.setTime(timeLeft)
  hud.setCombo(1, 0)
  hud.setPowerUps(powerUps.active, powerUps.timers)
  hud.setThreatened(false)
}

function pause(): void {
  if (state !== 'playing') return
  state = 'paused'
  keys.clear()
  hud.setCrosshairVisible(false)
  hud.setHudVisible(false)
  hud.setOverlayTitle('pausa', 'Tocá Jugar para seguir.', 'Seguir')
  hud.showOverlay(true)
  if (document.pointerLockElement === canvas) document.exitPointerLock()
}

function win(): void {
  state = 'won'
  hud.setCrosshairVisible(false)
  hud.setHudVisible(false)
  hud.setThreatened(false)
  sfx.win()
  // El récord guarda el tiempo USADO, no el que quedó: empezar con la misma
  // cifra para todos haría que recuperar tiempo no se viera reflejado.
  const used = TUNING.startSeconds - timeLeft
  const isNewBest = saveBest(used, enemiesOn)
  hud.setBest(readBest(enemiesOn))
  if (isNewBest) hud.flashBest()
  hud.setOverlayTitle(
    isNewBest ? '¡nuevo récord!' : 'completado',
    `${used.toFixed(2)} s · ${collected} orbes · semilla ${seed}`,
    'Otra vez',
  )
  hud.showOverlay(true)
  if (document.pointerLockElement === canvas) document.exitPointerLock()
}

function die(reason: 'caught' | 'timeout'): void {
  state = 'dead'
  hud.setCrosshairVisible(false)
  hud.setHudVisible(false)
  hud.setThreatened(false)

  if (reason === 'caught') {
    sfx.death()
    cameraFeel.addShake(0.6, 0.5)
    hud.flashDamage()
  } else {
    sfx.timeout()
  }

  hud.setOverlayTitle(
    reason === 'caught' ? 'te atraparon' : 'se acabó el tiempo',
    `${collected} / ${level.orbSpots.length} orbes · ${(TUNING.startSeconds - timeLeft).toFixed(2)} s`,
    'Reintentar',
  )
  hud.showOverlay(true)
  if (document.pointerLockElement === canvas) document.exitPointerLock()
}

// ---------------------------------------------------------------- juego

function collectAt(feet: THREE.Vector3): void {
  samplePoint.set(feet.x, feet.y + TUNING.playerHeight * 0.5, feet.z)

  // Orbes normales: suman combo y, con combo alto, tiempo
  const normalHits = pickups.collect(samplePoint, TUNING.collectRadius, 'normal')
  if (normalHits.length > 0) {
    collected += normalHits.length
    for (let i = 0; i < normalHits.length; i++) {
      const mult = combo.register()
      // El combo ya no acelera el reloj (ahora es cuenta regresiva): se
      // traduce en segundos recuperados, escalados por el multiplicador.
      timeLeft += TUNING.comboTimeBonus * mult
      sfx.collect(combo.count)
      particles.burst(
        pickups.group.children[normalHits[i]].position,
        COLOR_NORMAL,
        14 + mult * 3,
        3.5 + mult,
      )
    }
    cameraFeel.addShake(0.12 + combo.count * 0.01)
    hud.setOrbs(collected, level.orbSpots.length)
  }

  // Dorados: suman tiempo
  const goldHits = pickups.collect(samplePoint, TUNING.collectRadius, 'gold')
  for (const idx of goldHits) {
    timeLeft += TUNING.goldTimeBonus
    sfx.gold()
    particles.burst(pickups.group.children[idx].position, COLOR_GOLD, 26, 5)
    cameraFeel.addFovKick(6)
    hud.showToast(
      `orbe dorado<span class="sub">+${TUNING.goldTimeBonus} s</span>`,
      1100,
    )
  }

  // Rojos: restan tiempo
  const hazardHits = pickups.collect(samplePoint, TUNING.collectRadius, 'hazard')
  for (const idx of hazardHits) {
    timeLeft -= TUNING.hazardTimePenalty
    sfx.hazard()
    particles.burst(pickups.group.children[idx].position, COLOR_RED, 26, 5)
    cameraFeel.addShake(0.25)
    hud.showToast(
      `orbe rojo<span class="sub">−${TUNING.hazardTimePenalty} s</span>`,
      1100,
    )
  }

  // Power-ups
  const power = powerUps.collect(samplePoint, TUNING.collectRadius)
  if (power) applyPowerUp(power, samplePoint)
}

function applyPowerUp(kind: PowerUpKind, at: THREE.Vector3): void {
  powerUps.activate(kind)
  sfx.powerUp()
  particles.burst(at, COLOR_POWER[kind], 30, 6)

  if (kind === 'turbo') {
    player.speedMultiplier = TUNING.turboMultiplier
    hud.showToast('turbo<span class="sub">+45% de velocidad</span>', 1200)
  } else if (kind === 'doubleJump') {
    player.enableDoubleJump()
    hud.showToast('salto doble<span class="sub">Espacio otra vez en el aire</span>', 1200)
  } else {
    hud.showToast('tiempo lento<span class="sub">todo va más despacio</span>', 1200)
  }
  cameraFeel.addFovKick(5)
}

function applyPowerExpirations(expired: PowerUpKind[]): void {
  for (const kind of expired) {
    if (kind === 'turbo') player.speedMultiplier = 1
    if (kind === 'doubleJump') player.disableDoubleJump()
  }
}

let stepTimer = 0

function updatePlaying(realDt: number): void {
  readInput()

  // El slowmo frena la simulación (jugador incluido), no el render: el reloj
  // sigue corriendo en tiempo real, así que el power-up no regala segundos.
  const slowmo = powerUps.active.slowmo
  const dt = slowmo ? realDt * TUNING.slowmoScale : realDt
  clockTime += realDt

  applySpeedEffects()

  prevPlayerPos.copy(player.position)
  player.update(input, dt)

  // Aterrizaje: hundimiento de cámara proporcional a la velocidad de caída.
  if (player.justLanded) {
    const impact = Math.min(1, Math.abs(player.lastFallSpeed) / 12)
    cameraFeel.addLandDip(TUNING.landDip * (0.4 + impact))
  }

  // Caída al vacío: se vuelve al checkpoint, no a la partida completa.
  if (player.position.y < -20) {
    player.reset(checkpoint)
    cameraFeel.addShake(0.4)
    // Caer cuesta tiempo: el checkpoint perdona la caída, no la descuenta.
    timeLeft -= 3
    hud.showToast('caíste del mundo · −3 s', 1400)
    return
  }

  // Sonido de pasos mientras se camina en el piso
  if (player.grounded && (input.forward !== 0 || input.strafe !== 0)) {
    stepTimer -= realDt
    if (stepTimer <= 0) {
      sfx.step()
      stepTimer = input.run ? 0.28 : 0.4
    }
  } else {
    stepTimer = 0
  }

  // Colección en el punto medio y final del paso
  midpoint.set(
    (prevPlayerPos.x + player.position.x) * 0.5,
    (prevPlayerPos.y + player.position.y) * 0.5,
    (prevPlayerPos.z + player.position.z) * 0.5,
  )
  collectAt(midpoint)
  collectAt(player.position)

  // Power-ups: temporizadores
  applyPowerExpirations(powerUps.tickTimers(dt))

  // Enemigos. Con slowmo la IA es lo único que se frena de verdad: el
  // jugador conserva su velocidad, que es justo lo que hace útil al power-up.
  const hits = enemies.update(
    dt,
    clockTime,
    player.position,
    player.position.y + TUNING.playerHeight * 0.5,
    slowmo ? TUNING.slowmoScale : 1,
  )
  // "Te persiguen" es el aviso; el contacto es la derrota.
  const threatened = enemies.anyAlert()
  hud.setThreatened(threatened)
  if (enemies.consumeAlert()) sfx.alert()
  if (hits.length > 0) {
    die('caught')
    return
  }

  // Combo
  if (combo.tick(dt)) sfx.comboLost()
  hud.setCombo(combo.multiplier, combo.ratio)

  // La cuenta regresiva corre en tiempo real: recuperarlo con combo y orbes
  // dorados es la única forma de ganarle al reloj.
  timeLeft -= realDt

  hud.setTime(timeLeft)
  pickups.update(clockTime, realDt, player.position)
  powerUps.updateVisual(clockTime)
  particles.update(realDt)
  hud.setPowerUps(powerUps.active, powerUps.timers)
  updateHints(threatened)

  if (collected >= level.orbSpots.length) {
    win()
    return
  }
  if (timeLeft <= 0) {
    timeLeft = 0
    hud.setTime(0)
    die('timeout')
  }
}

/** FOV kick al esprintar y mientras dura el turbo. */
function applySpeedEffects(): void {
  if (input.run && player.grounded) cameraFeel.addFovKick(0.35)
  if (powerUps.active.turbo) cameraFeel.addFovKick(0.15)
}

// ------------------------------------------------- brújula y marcadores

/** Vector reusable del hint, y la lista de marcadores de perseguidores. */
const compassHint: ScreenHint = { x: 0, y: 0, distance: 0 }
const markerHints: ScreenHint[] = []
const visibleHints: ScreenHint[] = []
/** Si el frame anterior mostraba pistas, para limpiarlas una sola vez. */
let hintsShown = false
const alertPositions: THREE.Vector3[] = []
const projected = new THREE.Vector3()
const camForward = new THREE.Vector3()
const toTarget = new THREE.Vector3()

/** Margen en px para que el marcador no se pegue al borde de la pantalla. */
const EDGE_MARGIN = 46
/** Distancia a la que un hint se atenúa por completo. */
const HINT_FADE_DISTANCE = 60

/**
 * Proyecta un punto del mundo a coordenadas de pantalla.
 *
 * Devuelve `true` sólo si el punto cae DENTRO del viewport. Quedarse sin
 * comprobarlo no vale: un objetivo puede estar bien delante de la cámara y aun
 * así fuera de cuadro (a un lado, o debajo del borde), y en ese caso el hint se
 * dibujaría fuera de la pantalla sin que nadie lo viera.
 */
function projectToScreen(world: THREE.Vector3, out: ScreenHint): boolean {
  projected.copy(world).project(camera)
  out.x = (projected.x * 0.5 + 0.5) * window.innerWidth
  out.y = (-projected.y * 0.5 + 0.5) * window.innerHeight
  out.distance = Math.min(1, camera.position.distanceTo(world) / HINT_FADE_DISTANCE)
  // `z > 1` cae detrás del plano lejano, o sea a la espalda del jugador.
  if (projected.z > 1) return false
  return (
    out.x >= 0 && out.x <= window.innerWidth &&
    out.y >= 0 && out.y <= window.innerHeight
  )
}

/**
 * Coloca un hint en el borde de la pantalla, en la dirección del objetivo.
 *
 * Es lo que hace útil la brújula: en una arena con plataformas el orbe
 * pendiente casi siempre está fuera de cuadro, y sin esto el jugador tendría
 * que recorrer el mapa a ciegas.
 */
function clampToEdge(world: THREE.Vector3, out: ScreenHint): void {
  camera.getWorldDirection(camForward)
  toTarget.subVectors(world, camera.position).normalize()

  // Ángulo alrededor de la cámara, medido desde arriba. Se usa el producto
  // cruzado y el escalar con la dirección de vista para no depender de un
  // Euler que no existe.
  const angle = Math.atan2(
    toTarget.x * camForward.z - toTarget.z * camForward.x,
    toTarget.x * camForward.x + toTarget.z * camForward.z,
  )

  const halfW = Math.max(1, window.innerWidth / 2 - EDGE_MARGIN)
  const halfH = Math.max(1, window.innerHeight / 2 - EDGE_MARGIN)
  // Escala mínima para tocar el borde del rectángulo en esa dirección.
  const scale = Math.min(
    Math.abs(halfW / Math.cos(angle)),
    Math.abs(halfH / Math.sin(angle)),
  )

  out.x = window.innerWidth / 2 + Math.cos(angle) * scale
  out.y = window.innerHeight / 2 - Math.sin(angle) * scale
  out.distance = Math.min(1, camera.position.distanceTo(world) / HINT_FADE_DISTANCE)
}

/**
 * Actualiza la brújula (orbe pendiente más cercano) y los marcadores de los
 * perseguidores. Reutiliza los objetos `ScreenHint` para no alocar por frame.
 */
function updateHints(threatened: boolean): void {
  // Brújula: al orbe normal pendiente más cercano. Si ya no queda ninguno, se
  // oculta en vez de seguir apuntando al último. Sólo se lleva al borde cuando
  // el objetivo no está a la vista: si está en pantalla, el orbe ya se ve y
  // la flecha sólo estorbaría.
  const target = pickups.positionOf(pickups.nearestPending(player.position))
  if (target) {
    const onScreen = projectToScreen(target, compassHint)
    if (!onScreen) clampToEdge(target, compassHint)
  }

  // Marcadores: sólo para los que están persiguiendo. Los que quedan a la
  // espalda no se dibujan: el aviso "¡te persiguen!" ya cubre ese caso, y un
  // punto pegado al borde sin sentido sería ruido.
  const positions = threatened ? enemies.alertPositions(alertPositions) : []
  let visibleCount = 0
  for (let i = 0; i < positions.length; i++) {
    if (visibleCount >= markerHints.length) markerHints.push({ x: 0, y: 0, distance: 0 })
    if (projectToScreen(positions[i], markerHints[visibleCount])) visibleCount++
  }
  // `visibleHints` es el mismo array en todos los frames: sólo cambia su
  // longitud, así el HUD itera los que hay y no sobre los del frame anterior.
  visibleHints.length = visibleCount
  for (let i = 0; i < visibleCount; i++) visibleHints[i] = markerHints[i]

  hud.setHints(target ? compassHint : null, visibleHints)
  hintsShown = target !== null
}

function updateCamera(dt: number, t: number): void {
  player.getEyePosition(eye)
  player.getViewDirection(viewDir)
  camera.position.copy(eye)
  camera.lookAt(eye.x + viewDir.x, eye.y + viewDir.y, eye.z + viewDir.z)

  // El cabeceo se alimenta de la velocidad horizontal real: correr tambalea
  // más que caminar, y en el aire se amortigua a cero.
  const maxSpeed = TUNING.runSpeed * player.speedMultiplier
  const speed01 = Math.min(1, player.horizontalSpeed / maxSpeed)
  cameraFeel.updateBob(dt, speed01, player.grounded)

  cameraFeel.update(dt, camera, t)
}

// ---------------------------------------------------------------- loop

const clock = new THREE.Clock()
let menuTime = 0

function frame(): void {
  requestAnimationFrame(frame)

  const dt = Math.min(clock.getDelta(), 1 / 30)
  menuTime += dt

  if (state === 'playing') {
    updatePlaying(dt)
    updateCamera(dt, clockTime)
  } else {
    // Cámara orbital lenta en menú / pausa / derrota
    const t = menuTime * 0.12
    camera.position.set(Math.cos(t) * 26, 16, Math.sin(t) * 26)
    camera.lookAt(0, 3, 0)
    // Sin jugador no hay imán: los orbes sólo flotan en su sitio.
    pickups.update(t, dt)
    powerUps.updateVisual(t)
    particles.update(dt)
    // La brújula y los marcadores son información de partida: fuera de ella no
    // tienen sentido y quedarían congelados en el último frame.
    if (hintsShown) {
      hud.setHints(null, [])
      hintsShown = false
    }
  }

  if (postfx) {
    // Bloom más intenso durante el tiempo lento.
    postfx.setBloomStrength(
      powerUps.active.slowmo ? TUNING.bloomStrength * 1.5 : TUNING.bloomStrength,
    )
    postfx.render(dt)
  } else {
    renderer.render(scene, camera)
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx?.setSize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio, 2))
})

frame()

