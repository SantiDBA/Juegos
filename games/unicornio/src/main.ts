import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { TUNING } from './config'
import { buildWorld, type World } from './world'
import { PlayerController } from './player'
import { buildUnicorn } from './unicorn'

// --- Main

const canvas = document.getElementById('scene') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1

const scene = new THREE.Scene()

// Sky dome procedural con gradiente + sol (ShaderMaterial, sin iluminación)
const SUN_DIR = new THREE.Vector3(0.3, 0.7, 0.4).normalize()
const skyGeo = new THREE.SphereGeometry(400, 32, 16)

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uSunDirection: { value: SUN_DIR },
    uTopColor: { value: new THREE.Color(0x2b6cb0) },
    uHorizonColor: { value: new THREE.Color(0xbfd9f0) },
    uBottomColor: { value: new THREE.Color(0x8fb8d8) },
  },
  vertexShader: /* glsl */`
    varying vec3 vWorldPosition;
    void main() {
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uSunDirection;
    uniform vec3 uTopColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uBottomColor;
    varying vec3 vWorldPosition;
    void main() {
      vec3 dir = normalize(vWorldPosition);
      float h = dir.y;
      vec3 sky = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.55, h));
      sky = mix(uBottomColor, sky, smoothstep(-0.25, 0.05, h));
      float sunDot = max(dot(dir, uSunDirection), 0.0);
      float sun = pow(sunDot, 512.0);
      sky += vec3(1.0, 0.92, 0.75) * sun * 1.6;
      float glow = pow(sunDot, 8.0) * 0.25;
      sky += vec3(1.0, 0.85, 0.6) * glow;
      gl_FragColor = vec4(sky, 1.0);
    }
  `,
  side: THREE.BackSide,
  depthWrite: false,
  toneMapped: false,
})
const sky = new THREE.Mesh(skyGeo, skyMat)
sky.renderOrder = -1
scene.add(sky)

const fogColor = new THREE.Color(0xbfd9f0)
scene.fog = new THREE.Fog(fogColor, TUNING.fogNear, TUNING.fogFar)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)

// Lights
scene.add(new THREE.HemisphereLight(0xbfd9f0, 0x3a4a2a, 1.2))
const sun = new THREE.DirectionalLight(0xfff5e0, 3.0)
const sunDistance = 120
sun.position.copy(SUN_DIR.clone().multiplyScalar(sunDistance))
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 300
const se = 80
sun.shadow.camera.left = -se; sun.shadow.camera.right = se
sun.shadow.camera.top = se; sun.shadow.camera.bottom = -se
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 2.0
scene.add(sun)

// Build world
let world: World = buildWorld(scene, 1337)
let player = new PlayerController(world.spawn, world.colliders, world.heightAt)

const unicorn = buildUnicorn()
scene.add(unicorn)

const camOffset = new THREE.Vector3(0, 3.5, 8)
const camTarget = new THREE.Vector3()

// --- Post-processing composer (solo RenderPass para estabilidad)
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

// --- Input
const keys = { w: false, a: false, s: false, d: false, shift: false }
let pointerLocked = false
let firstPerson = false

const overlay = document.getElementById('overlay') as HTMLElement
const playBtn = document.getElementById('play') as HTMLButtonElement
const distEl = document.getElementById('dist') as HTMLElement
const hintEl = document.getElementById('hint') as HTMLElement
const timeEl = document.getElementById('time') as HTMLElement
const bestEl = document.getElementById('best') as HTMLElement
const winEl = document.getElementById('win') as HTMLElement
const winTimeEl = document.getElementById('win-time') as HTMLElement

playBtn.addEventListener('click', () => { canvas.requestPointerLock() })

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas
  if (pointerLocked) {
    overlay.classList.add('hidden')
    state = 'playing'
    if (startTime === 0) startTime = performance.now()
  } else {
    if (state === 'playing') overlay.classList.remove('hidden')
  }
})

canvas.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return
  player.look(e.movementX, e.movementY)
})

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'w') keys.w = true
  if (k === 'a') keys.a = true
  if (k === 's') keys.s = true
  if (k === 'd') keys.d = true
  if (k === 'shift') keys.shift = true
  if (k === 'escape') { if (pointerLocked) document.exitPointerLock() }
  if (k === 'c') firstPerson = !firstPerson
})
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'w') keys.w = false
  if (k === 'a') keys.a = false
  if (k === 's') keys.s = false
  if (k === 'd') keys.d = false
  if (k === 'shift') keys.shift = false
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})

// --- Estado
type State = 'menu' | 'playing' | 'won'
let state: State = 'menu'
let startTime = 0
let elapsed = 0
let best = readBest()
let won = false

function readBest(): number | null {
  const raw = localStorage.getItem(TUNING.storageKeyBest)
  if (raw === null) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
function saveBest(t: number): void {
  localStorage.setItem(TUNING.storageKeyBest, String(t))
}

// Guide light beam
const guide = new THREE.Mesh(
  new THREE.CylinderGeometry(0.4, 0.4, 60, 12),
  new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.25, depthWrite: false })
)
guide.position.copy(world.castlePos)
guide.position.y = world.heightAt(world.castlePos.x, world.castlePos.z) + 2
scene.add(guide)

// Partículas mágicas flotantes
const PARTICLE_COUNT = 900
const particlePositions = new Float32Array(PARTICLE_COUNT * 3)
const particleSpeeds = new Float32Array(PARTICLE_COUNT)
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particlePositions[i * 3] = (Math.random() * 2 - 1) * (TUNING.worldSize / 2 - 10)
  particlePositions[i * 3 + 1] = Math.random() * 18 + 1
  particlePositions[i * 3 + 2] = (Math.random() * 2 - 1) * (TUNING.worldSize / 2 - 10)
  particleSpeeds[i] = 0.3 + Math.random() * 0.7
}
const particleGeo = new THREE.BufferGeometry()
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
const particleMat = new THREE.PointsMaterial({
  color: 0xffb3f0,
  size: 0.25,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})
const particles = new THREE.Points(particleGeo, particleMat)
scene.add(particles)

// --- Loop
const clock = new THREE.Clock()

function tick(): void {
  requestAnimationFrame(tick)
  const dt = Math.min(clock.getDelta(), 0.05)

  if (state === 'playing') {
    player.update(
      { forward: (keys.w ? 1 : 0) - (keys.s ? 1 : 0), strafe: (keys.d ? 1 : 0) - (keys.a ? 1 : 0), run: keys.shift },
      dt,
    )
    elapsed = (performance.now() - startTime) / 1000

    unicorn.position.copy(player.position)
    unicorn.rotation.y = player.yaw + Math.PI / 2
    const moving = keys.w || keys.a || keys.s || keys.d
    if (moving) {
      unicorn.rotation.x = Math.sin(performance.now() * 0.015) * 0.06
    } else {
      unicorn.rotation.x = 0
    }

    const castlePos = world.castlePos
    const dx = player.position.x - castlePos.x
    const dz = player.position.z - castlePos.z
    const dist = Math.hypot(dx, dz)
    distEl.textContent = `${Math.round(dist)} m`
    timeEl.textContent = elapsed.toFixed(2) + 's'
    bestEl.textContent = best !== null ? best.toFixed(2) + 's' : '—'

    if (dist < TUNING.hintDistance) {
      hintEl.textContent = '¡El castillo está cerca! Seguí la luz.'
      hintEl.classList.add('near')
    } else {
      hintEl.textContent = 'Buscá el castillo entre las montañas y los bosques.'
      hintEl.classList.remove('near')
    }

    guide.position.set(castlePos.x, world.heightAt(castlePos.x, castlePos.z) + 2, castlePos.z)

    if (dist < TUNING.castleReach && !won) {
      won = true
      state = 'won'
      document.exitPointerLock()
      winTimeEl.textContent = elapsed.toFixed(2) + 's'
      winEl.classList.remove('hidden')
      if (best === null || elapsed < best) { best = elapsed; saveBest(elapsed) }
    }
  }

  if (firstPerson) {
    const eye = player.position.clone(); eye.y += 1.5
    camera.position.copy(eye)
    const dir = new THREE.Vector3()
    dir.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch))
    camera.lookAt(eye.clone().add(dir))
  } else {
    const idealPos = new THREE.Vector3()
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, player.yaw, 0))
    idealPos.copy(camOffset).applyQuaternion(q).add(player.position)
    idealPos.y = Math.max(idealPos.y, world.heightAt(idealPos.x, idealPos.z) + 2.5)
    if (idealPos.y < player.position.y + 1.8) idealPos.y = player.position.y + 1.8
    camera.position.lerp(idealPos, 0.1)
    camTarget.copy(player.position); camTarget.y += 1.6
    camera.lookAt(camTarget)
  }

  // Animar partículas mágicas
  const posAttr = particleGeo.attributes.position as THREE.BufferAttribute
  const arr = posAttr.array as Float32Array
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    arr[i * 3 + 1] += particleSpeeds[i] * dt
    if (arr[i * 3 + 1] > 20) {
      arr[i * 3 + 1] = 1
      arr[i * 3] = (Math.random() * 2 - 1) * (TUNING.worldSize / 2 - 10)
      arr[i * 3 + 2] = (Math.random() * 2 - 1) * (TUNING.worldSize / 2 - 10)
    }
  }
  posAttr.needsUpdate = true

  composer.render()
}

const restartBtn = document.getElementById('restart') as HTMLButtonElement
restartBtn.addEventListener('click', () => {
  world.dispose()
  world = buildWorld(scene, 1337)
  player = new PlayerController(world.spawn, world.colliders, world.heightAt)
  unicorn.position.copy(player.position)
  guide.position.copy(world.castlePos)
  guide.position.y = world.heightAt(world.castlePos.x, world.castlePos.z) + 2
  won = false
  state = 'menu'
  startTime = 0
  elapsed = 0
  overlay.classList.remove('hidden')
  winEl.classList.add('hidden')
  best = readBest()
})

tick()