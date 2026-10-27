import * as THREE from 'three'
import { COLORS, TUNING } from './config'
import { buildHouse, type Station } from './house'
import { Cat, type CatInput } from './cat'
import { BurstParticles, EmoteSprite } from './effects'
import { PostFX } from './postfx'
import { Sfx } from './sfx'
import { Rng, randomSeed } from './rng'
import {
  NEEDS,
  NEEDS_MAX,
  NEED_ORDER,
  canAttend,
  createNeeds,
  decayNeeds,
  fillNeed,
  isCritical,
  isFull,
  mostUrgent,
  satisfy,
  type NeedId,
  type Needs,
} from './needs'
import {
  createHud,
  readBest,
  readMuted,
  saveBest,
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
renderer.toneMappingExposure = 1

const scene = new THREE.Scene()
// Ámbar de atardecer: la casa se ve cálida y las sombras no son negras.
scene.background = new THREE.Color(0x1a1310)
scene.fog = new THREE.Fog(0x1a1310, 46, 112)

const camera = new THREE.PerspectiveCamera(
  TUNING.cameraFov,
  window.innerWidth / window.innerHeight,
  0.1,
  240,
)

// Luz de ambiente cálida, un sol que entra en diagonal y un contraluz frío que
// despega al gato del piso. Las intensidades son bajas a propósito: sumadas y
// con la sobreexposición del tone mapping, el piso se quemaba a un beige claro
// y el gato naranja dejaba de despegarse. El sol cubre toda la casa, porque un
// frustro de sombra corto deja zonas planas.
scene.add(new THREE.HemisphereLight(0xffe9cc, 0x3a2c22, 0.7))
scene.add(new THREE.AmbientLight(0xffdcb8, 0.25))

const sun = new THREE.DirectionalLight(0xfff1d6, 1.3)
sun.position.set(16, 26, 12)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 80
sun.shadow.camera.left = -26
sun.shadow.camera.right = 26
sun.shadow.camera.top = 26
sun.shadow.camera.bottom = -26
sun.shadow.bias = -0.0008
scene.add(sun, sun.target)

const rim = new THREE.DirectionalLight(0x8fb4ff, 0.25)
rim.position.set(-14, 12, -16)
scene.add(rim)

// ---------------------------------------------------------------- sistemas

const sfx = new Sfx()
const particles = new BurstParticles()
const emote = new EmoteSprite()
const hud = createHud()
const house = buildHouse()
const cat = new Cat()
const rng = new Rng(randomSeed())

scene.add(particles.points, emote.sprite, house.group, cat.group)

let postfx: PostFX | null = null
try {
  postfx = new PostFX(renderer, scene, camera)
} catch {
  // Sin targets de float (WebGL1 o drivers viejos) se juega sin bloom.
  postfx = null
}

// ---------------------------------------------------------------- estado

let state: GameState = 'menu'
let runTime = 0
let worldTime = 0
let needs: Needs = createNeeds()
/** Cuidados completados en la partida. Es el puntaje: la partida no termina. */
let cares = 0
let alarmTimer = TUNING.alarmInterval
let meowTimer = 20
let actionTimer = 0
let particleTimer = 0
let camYaw = 0
let camSnap = true

/** Necesidad que se está satisfaciendo ahora mismo, o null. */
let actingNeed: NeedId | null = null

/** Necesidades que ya avisaron que están críticas: el aviso suena una sola vez. */
const warned = new Set<NeedId>()
/** Necesidades en cero. Mientras haya alguna, el gato está mustio. */
const neglected = new Set<NeedId>()

const held = new Set<string>()
const catInput: CatInput = { moveX: 0, moveZ: 0, run: false, jump: false }
const idleInput: CatInput = { moveX: 0, moveZ: 0, run: false, jump: false }
const emoteAnchor = new THREE.Vector3()
const neglectColor = new THREE.Color(COLORS.crit)

// ---------------------------------------------------------------- cámara

const camPos = new THREE.Vector3()
const camTarget = new THREE.Vector3()
const desired = new THREE.Vector3()
const lookAt = new THREE.Vector3()

function updateCamera(dt: number): void {
  // Flechas para girar sin mouse. El arrastre hace lo mismo con puntero.
  if (held.has('ArrowLeft')) camYaw += dt * 1.9
  if (held.has('ArrowRight')) camYaw -= dt * 1.9

  const target = cat.group.position
  desired.set(
    target.x + Math.sin(camYaw) * TUNING.cameraDistance,
    target.y + TUNING.cameraHeight,
    target.z + Math.cos(camYaw) * TUNING.cameraDistance,
  )
  lookAt.set(target.x, target.y + TUNING.cameraLookHeight, target.z)

  if (camSnap) {
    // Primer frame (o arranque de partida): sin esto la cámara viene desde el
    // otro lado de la casa y se ve un barrido largo.
    camPos.copy(desired)
    camTarget.copy(lookAt)
    camSnap = false
  } else {
    camPos.lerp(desired, Math.min(1, dt * TUNING.cameraLag))
    camTarget.lerp(lookAt, Math.min(1, dt * 9))
  }

  if (camPos.y < TUNING.cameraMinY) camPos.y = TUNING.cameraMinY

  camera.position.copy(camPos)
  camera.lookAt(camTarget)
}

// ---------------------------------------------------------------- oclusión

const raycaster = new THREE.Raycaster()
const rayDirection = new THREE.Vector3()
const catPoint = new THREE.Vector3()

/**
 * Desvanece las paredes que se meten entre la cámara y el gato.
 *
 * Con la cámara detrás y a 6,2 de alto, cualquier pared a menos de ~3,4 unidades
 * del gato lo tapa entero: es lo que pasaba al nacer en el hall, con el tabique
 * justo en el medio de la línea de vista. Se traza un rayo cámara→gato y se baja
 * la opacidad de lo que cruce; cuando deja de estorbar, vuelve sola.
 */
function updateOccluders(dt: number): void {
  catPoint.set(cat.pos.x, cat.pos.y + 0.9, cat.pos.z)
  rayDirection.subVectors(catPoint, camPos)
  const distance = rayDirection.length()
  raycaster.far = distance
  if (distance > 1e-3) {
    raycaster.set(camPos, rayDirection.multiplyScalar(1 / distance))
  }

  const blocked = raycaster.intersectObjects(house.occluders, false)
  const k = 1 - Math.exp(-11 * dt)

  for (const mesh of house.occluders) {
    const material = mesh.material as THREE.MeshStandardMaterial
    const target = blocked.some((hit) => hit.object === mesh) ? 0.18 : 1
    material.opacity += (target - material.opacity) * k
  }
}

// ---------------------------------------------------------------- input

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function toggleMute(): void {
  sfx.setMuted(!sfx.muted)
  saveMuted(sfx.muted)
  hud.showToast(sfx.muted ? 'silencio' : 'sonido')
}

function togglePause(): void {
  if (state === 'paused') {
    state = 'playing'
    hud.showOverlay(false)
    hud.setHudVisible(true)
    last = performance.now()
    return
  }
  if (state !== 'playing') return
  state = 'paused'
  held.clear()
  actingNeed = null
  sfx.setWater(false)
  sfx.setPurr(false)
  hud.showPrompt(null, 0)
  hud.setOverlayTitle('pausa', 'El gato te espera. Volvé cuando quieras.', 'Seguir')
  hud.showOverlay(true)
  hud.setHudVisible(false)
}

function onKeyDown(e: KeyboardEvent): void {
  if (isTypingTarget(e.target)) return
  const code = e.code
  if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault()

  if (code === 'KeyM') {
    toggleMute()
    return
  }
  if (code === 'KeyP' || code === 'Escape') {
    togglePause()
    return
  }
  if (code === 'Space' || code === 'Enter') {
    if (state === 'menu') {
      startRun()
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
window.addEventListener('keyup', (e) => held.delete(e.code))
window.addEventListener('blur', () => {
  held.clear()
  if (state === 'playing') togglePause()
})

// Arrastrar con el mouse (o el dedo) gira la órbita de la cámara.
let dragging = false
let lastPointerX = 0
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock()
  dragging = true
  lastPointerX = e.clientX
  canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  camYaw -= (e.clientX - lastPointerX) * TUNING.cameraDragSpeed
  lastPointerX = e.clientX
})
const endDrag = (e: PointerEvent): void => {
  dragging = false
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)

hud.onPlay(() => {
  if (state === 'paused') togglePause()
  else startRun()
})

function readInput(locked: boolean): CatInput {
  if (locked) {
    catInput.moveX = 0
    catInput.moveZ = 0
    catInput.run = false
    catInput.jump = false
    return catInput
  }

  const forward = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0)
  const strafe = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0)

  // `f` es hacia dónde mira la cámara, aplanado al piso, y `right` su derecha.
  // Con eso W aleja al gato de la pantalla y D lo corre a la derecha, sin
  // importar cómo esté girada la órbita.
  const fx = -Math.sin(camYaw)
  const fz = -Math.cos(camYaw)
  let mx = fx * forward - fz * strafe
  let mz = fz * forward + fx * strafe
  const length = Math.hypot(mx, mz)
  if (length > 1e-4) {
    mx /= length
    mz /= length
  } else {
    mx = 0
    mz = 0
  }

  catInput.moveX = mx
  catInput.moveZ = mz
  catInput.run = held.has('ShiftLeft') || held.has('ShiftRight')
  catInput.jump = held.has('Space')
  return catInput
}

// ---------------------------------------------------------------- partida

function stationFor(need: NeedId): Station | null {
  return house.stations.find((station) => station.need === need) ?? null
}

function nearestStation(): Station | null {
  let best: Station | null = null
  let bestDistance = Infinity
  for (const station of house.stations) {
    const dx = cat.pos.x - station.pos.x
    const dz = cat.pos.z - station.pos.z
    const distance = Math.hypot(dx, dz)
    if (distance <= station.radius && distance < bestDistance) {
      best = station
      bestDistance = distance
    }
  }
  return best
}

/** Dónde aparece el gato: en el living, con el rascador a mano. */
const SPAWN = { x: -8, z: 4 }

function startRun(): void {
  sfx.unlock()

  needs = createNeeds()
  cares = 0
  runTime = 0
  alarmTimer = TUNING.alarmInterval
  meowTimer = rng.range(TUNING.idleMeowMin, TUNING.idleMeowMax)
  actionTimer = 0
  particleTimer = 0
  actingNeed = null
  warned.clear()
  neglected.clear()
  held.clear()
  particles.clear()
  cat.reset(SPAWN.x, SPAWN.z, 0)
  cat.distressed = false
  emote.show('🐾', 1)
  camYaw = 0
  camSnap = true

  state = 'playing'
  hud.setCares(cares)
  hud.setNeeds(needs)
  hud.setClock(0)
  hud.setBest(readBest())
  hud.showPrompt(null, 0)
  hud.setHudVisible(true)
  hud.showOverlay(false)
}

function completeActivity(station: Station): void {
  const def = NEEDS[station.need]
  satisfy(needs, station.need)
  sfx.chime()
  particles.burst(station.effect, station.effectColor, 26, 3.2, 0.85)
  emote.show('♪', 1.5)

  // El récord se guarda al vuelo: como la partida no termina, no hay un momento
  // de "fin" donde hacerlo.
  cares += 1
  hud.setCares(cares)
  if (saveBest(cares)) hud.setBest(cares)

  hud.showToast(`<b>${def.action} · listo</b><span class="sub">${cares} cuidados</span>`, 1600)
}

/**
 * Una necesidad llegó a cero. No se pierde nada: el gato se pone mustio —orejas
 * gachas, cola caída, lomo bajo— hasta que lo atiendan, y ése es todo el aviso.
 */
function onNeglected(need: NeedId): void {
  const def = NEEDS[need]
  const station = stationFor(need)
  sfx.meow(false)
  emote.show('😿', 2)
  if (station) particles.burst(station.effect, neglectColor, 16, 2.4, 0.6)
  hud.showToast(
    `<b>se quedó sin ${def.label}</b><span class="sub">no pasa nada: llevalo y se le pasa</span>`,
  )
}

/** Bocados, agua y rasguños: one-shots repetidos y el chorro de partículas. */
function updateActivityFx(station: Station, dt: number): void {
  const need = station.need
  actionTimer -= dt
  if (actionTimer <= 0) {
    actionTimer = need === 'comer' ? 0.3 : need === 'banio' ? 0.45 : 0.8
    if (need === 'comer') sfx.crunch()
    else if (need === 'banio') sfx.scratch()
    else if (need === 'higiene') sfx.splash()
  }

  particleTimer -= dt
  if (particleTimer <= 0) {
    particleTimer = 0.16
    particles.burst(station.effect, station.effectColor, 4, 1.9, 0.9)
  }
}

// ---------------------------------------------------------------- simulación

function step(dt: number): void {
  const station = nearestStation()
  const pressing = held.has('KeyE')

  // La actividad se engancha recién cuando la necesidad bajó lo suficiente
  // (`canAttend`): si no, quedarse apoyado en E sobre una barra casi llena la
  // recompletaría cada medio punto y sumaría cuidados sin hacer nada.
  //
  // Una vez enganchada sigue hasta llenar, aunque cruce el umbral en el camino;
  // se corta al soltar E o al alejarse del mueble.
  if (actingNeed !== null && (!pressing || station === null || station.need !== actingNeed)) {
    actingNeed = null
  }
  if (actingNeed === null && station && pressing && canAttend(needs[station.need])) {
    actingNeed = station.need
  }
  const busy = actingNeed !== null

  // Las necesidades bajan antes de animar: el estado mustio del gato depende de
  // qué quedó en cero este frame.
  const zeroed = decayNeeds(needs, dt, busy ? TUNING.actingDrainScale : 1)
  for (const need of zeroed) {
    if (neglected.has(need)) continue
    neglected.add(need)
    onNeglected(need)
  }
  // Las que se recuperaron vuelven a contar como atendidas.
  for (const need of neglected) {
    if (needs[need] > 0) neglected.delete(need)
  }
  cat.distressed = neglected.size > 0

  // Mientras hace la actividad el gato se queda quieto: se lee como que está
  // en eso, y para cortar alcanza con soltar E y caminar.
  cat.action = actingNeed
  cat.update(dt, readInput(busy), house.walls)

  if (busy && station) {
    const filled = fillNeed(needs, station.need, dt)
    if (isFull(filled)) {
      completeActivity(station)
      // Se suelta al terminar: si no, seguiría "en curso" sobre una barra llena
      // y se volvería a completar el frame siguiente.
      actingNeed = null
      actionTimer = 0
    } else {
      updateActivityFx(station, dt)
    }
  } else {
    actionTimer = 0
  }

  // Aviso la primera vez que cada necesidad cruza el umbral crítico.
  let anyCritical = false
  for (const need of NEED_ORDER) {
    if (isCritical(needs[need])) {
      anyCritical = true
      if (!warned.has(need)) {
        warned.add(need)
        emote.show('❗', 1.5)
        sfx.meow(false)
      }
    } else {
      warned.delete(need)
    }
  }

  if (anyCritical) {
    alarmTimer -= dt
    if (alarmTimer <= 0) {
      alarmTimer = TUNING.alarmInterval
      sfx.alarm()
    }
  } else {
    alarmTimer = TUNING.alarmInterval * 0.5
  }

  // Maullido suelto cada tanto, pero sólo si no hay nada urgente que hacer.
  meowTimer -= dt
  if (meowTimer <= 0) {
    meowTimer = rng.range(TUNING.idleMeowMin, TUNING.idleMeowMax)
    if (!anyCritical) {
      sfx.meow(true)
      emote.show('🐾', 1.2)
    }
  }

  if (cat.justStepped) sfx.step()
  if (cat.justLanded) sfx.land()

  // --- HUD
  hud.setNeeds(needs)
  hud.setClock(runTime)
  if (station && (actingNeed === station.need || canAttend(needs[station.need]))) {
    hud.showPrompt(NEEDS[station.need].action, needs[station.need] / NEEDS_MAX)
  } else {
    // Sin nada que hacer acá, no hay cartel: que no aparezca ya dice que está bien.
    hud.showPrompt(null, 0)
  }

  // --- Flecha guía: apunta al mueble más urgente, pero sólo cuando hace falta.
  const urgent = mostUrgent(needs)
  const urgentStation = stationFor(urgent)
  house.setGuide(cat.pos, urgentStation && needs[urgent] < 60 ? urgentStation.pos : null)
}

// ---------------------------------------------------------------- loop

let last = performance.now()

function frame(now: number): void {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  worldTime += dt

  if (state === 'playing') {
    runTime += dt
    step(dt)
  } else {
    // Menú, pausa y final: el gato respira en el lugar y la cámara pasea.
    cat.action = null
    cat.update(dt, idleInput, house.walls)
    if (state === 'menu') camYaw += dt * 0.12
    actingNeed = null
  }

  sfx.setWater(actingNeed === 'higiene')
  sfx.setPurr(actingNeed === 'energia' || actingNeed === 'diversion')

  particles.update(dt)
  cat.emoteAnchor(emoteAnchor)
  emote.update(dt, emoteAnchor)
  house.update(dt, worldTime)
  updateCamera(dt)
  updateOccluders(dt)

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
cat.reset(SPAWN.x, SPAWN.z, 0)
hud.setCares(cares)
hud.setNeeds(needs)
hud.setClock(0)
hud.setBest(readBest())
hud.setOverlayTitle(
  'michi',
  'Cuidá a tu gato, sin final: comé, bañate, jugá, dormí y pasá por el arenero.',
  'Jugar',
)
hud.showOverlay(true)
hud.setHudVisible(false)
requestAnimationFrame(frame)
