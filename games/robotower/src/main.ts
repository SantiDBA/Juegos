import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const GRID_W = 12
const GRID_H = 9
const CELL = 2.4
const MAX_WAVES = 12
const BEST_KEY = 'robotower.bestWave'
const bestKey = (mapId: string): string => mapId === 'ferric' ? BEST_KEY : `${BEST_KEY}.${mapId}`

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(0x52544254)

type EnemyKind = 'grunt' | 'swarm' | 'armored' | 'shielded' | 'splitter' | 'boss'

interface WaveDef {
  segments: Array<[EnemyKind, number]>
  queue: EnemyKind[]
  count: number
  normalHp: number
  bossHp: number
  normalSpeed: number
  bossSpeed: number
  normalReward: number
  bossReward: number
}

const WAVE_PATTERNS: Array<Array<[EnemyKind, number]>> = [
  [['grunt', 7]],
  [['grunt', 6], ['swarm', 3]],
  [['grunt', 4], ['swarm', 4], ['armored', 3]],
  [['swarm', 5], ['armored', 4], ['shielded', 4]],
  [['grunt', 4], ['armored', 4], ['shielded', 4], ['splitter', 2]],
  [['swarm', 6], ['armored', 5], ['splitter', 3], ['shielded', 3]],
  [['grunt', 5], ['swarm', 6], ['armored', 5], ['shielded', 3]],
  [['swarm', 7], ['armored', 5], ['splitter', 4], ['shielded', 5]],
  [['grunt', 6], ['armored', 6], ['shielded', 5], ['splitter', 6]],
  [['swarm', 8], ['armored', 6], ['shielded', 5], ['splitter', 5]],
  [['grunt', 6], ['swarm', 7], ['armored', 7], ['shielded', 3], ['splitter', 4]],
  [['swarm', 9], ['armored', 8], ['shielded', 6], ['splitter', 6]],
]

const WAVES: WaveDef[] = Array.from({ length: MAX_WAVES }, (_, i) => {
  const wave = i + 1
  const segments = WAVE_PATTERNS[i]
  const queue = segments.flatMap(([kind, n]) => Array<EnemyKind>(n).fill(kind))
  if (wave % 5 === 0) queue.push('boss')
  return {
    segments,
    queue,
    count: queue.length,
    normalHp: 16 + wave * 7,
    bossHp: 130 + wave * 18,
    normalSpeed: 1.65 + wave * 0.045,
    bossSpeed: 0.95 + wave * 0.02,
    normalReward: 4 + Math.floor(wave / 2),
    bossReward: 45,
  }
})

const ENEMY_NAMES: Record<EnemyKind, string> = {
  grunt: 'bot', swarm: 'enjambre', armored: 'blindado',
  shielded: 'escudo', splitter: 'divisor', boss: 'jefe',
}
const ENEMY_COLORS: Record<EnemyKind, number> = {
  grunt: 0xf87171, swarm: 0xfde047, armored: 0x94a3b8,
  shielded: 0x67e8f9, splitter: 0x86efac, boss: 0xc084fc,
}

const LOW_POWER =
  window.matchMedia('(max-width: 820px), (pointer: coarse)').matches ||
  (navigator.hardwareConcurrency ?? 8) <= 4

interface MapDef {
  id: string
  name: string
  path: Array<[number, number]>
}

const FERRIC_PATH: Array<[number, number]> = [
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6],
  [11, 5], [11, 4], [11, 3], [11, 2],
  [10, 2], [9, 2], [8, 2], [7, 2], [6, 2], [5, 2], [4, 2], [3, 2], [2, 2], [1, 2], [0, 2],
  [0, 3], [0, 4],
]

const FOUNDRY_PATH: Array<[number, number]> = [
  [11, 0], [10, 0], [9, 0], [8, 0], [7, 0], [6, 0], [5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [0, 0],
  [0, 1], [0, 2],
  [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2],
  [11, 3], [11, 4],
  [10, 4], [9, 4], [8, 4], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4],
  [0, 5], [0, 6], [0, 7],
  [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7],
]

const MAPS: MapDef[] = [
  { id: 'ferric', name: 'Ferric Lands', path: FERRIC_PATH },
  { id: 'foundry', name: 'Fundición', path: FOUNDRY_PATH },
]

let activeMapId = MAPS[0].id
let PATH = MAPS[0].path

type TowerType = 'blaster' | 'coil' | 'mortar' | 'brake' | 'lance'

interface TowerDef {
  name: string
  cost: number
  range: number
  cooldown: number
  damage: number
  color: number
  splash: number
  role: string
}

const TOWER_DEFS: Record<TowerType, TowerDef> = {
  blaster: { name: 'Bláster', cost: 20, range: 3.4, cooldown: 0.55, damage: 7, color: 0xfb923c, splash: 0, role: 'perfora blindaje' },
  coil: { name: 'Bobina', cost: 35, range: 4.2, cooldown: 1.25, damage: 20, color: 0x67e8f9, splash: 0, role: 'cadena y ralentiza' },
  mortar: { name: 'Mortero', cost: 50, range: 5.2, cooldown: 2.0, damage: 26, color: 0xf0abfc, splash: 1.5, role: 'área y rompe armadura' },
  brake: { name: 'Freno', cost: 30, range: 3.2, cooldown: 0.4, damage: 3, color: 0x38bdf8, splash: 0, role: 'campo de ralentización' },
  lance: { name: 'Lanza', cost: 60, range: 5.6, cooldown: 1.6, damage: 34, color: 0xfacc15, splash: 0, role: 'anti-jefe' },
}

const key = (c: number, r: number): string => `${c},${r}`
let PATH_KEYS = new Set(PATH.map(([c, r]) => key(c, r)))
let spawnCell = PATH[0]
let coreCell = PATH[PATH.length - 1]

function cellWorld(c: number, r: number): THREE.Vector3 {
  return new THREE.Vector3((c - (GRID_W - 1) / 2) * CELL, 0, (r - (GRID_H - 1) / 2) * CELL)
}
let PATH_WORLD = PATH.map(([c, r]) => cellWorld(c, r))

const MAX_PATH = 48

// Geometrías compartidas: cero assets externos y ninguna dependencia nueva.
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
const SPH = new THREE.SphereGeometry(0.5, 16, 12)
const SPARK_GEO = new THREE.SphereGeometry(0.5, 6, 4)
const RING = new THREE.TorusGeometry(0.9, 0.1, 8, 32)
const RANGE_RING = new THREE.RingGeometry(0.97, 1, 48)
const ROCK = new THREE.DodecahedronGeometry(1, 0)

function makeSurfaceTexture(): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#8d857a'
  ctx.fillRect(0, 0, size, size)
  // Óxido, picaduras y vetas de metal desgastado: el motif férrico de Intruders.
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random()
    if (r < 0.55) ctx.fillStyle = `rgba(180,96,44,${0.18 + Math.random() * 0.35})`
    else if (r < 0.8) ctx.fillStyle = `rgba(46,36,30,${0.2 + Math.random() * 0.4})`
    else ctx.fillStyle = `rgba(232,220,198,${0.1 + Math.random() * 0.2})`
    ctx.fillRect(x, y, 1 + Math.random() * 4, 1 + Math.random() * 3)
  }
  for (let i = 0; i < 52; i++) {
    const y = Math.random() * size
    ctx.strokeStyle = `rgba(235,225,205,${0.05 + Math.random() * 0.1})`
    ctx.lineWidth = Math.random() < 0.8 ? 1 : 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y + (Math.random() * 8 - 4))
    ctx.stroke()
  }
  for (let i = 0; i < 24; i++) {
    const x = 12 + Math.random() * (size - 24)
    const y = 12 + Math.random() * (size - 24)
    ctx.fillStyle = 'rgba(40,34,28,0.55)'
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(224,210,186,0.35)'
    ctx.beginPath(); ctx.arc(x - 0.6, y - 0.6, 1.1, 0, Math.PI * 2); ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5, 5)
  tex.anisotropy = 4
  return tex
}

const SURFACE = makeSurfaceTexture()

const matCache = new Map<string, THREE.MeshStandardMaterial>()
function mat(color: number, metalness = 0.72, roughness = 0.42): THREE.MeshStandardMaterial {
  const k = `${color}:${metalness}:${roughness}`
  let m = matCache.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      roughnessMap: SURFACE,
      bumpMap: SURFACE,
      bumpScale: 0.012,
      envMapIntensity: 0.95,
    })
    matCache.set(k, m)
  }
  return m
}

const emissiveCache = new Map<string, THREE.MeshStandardMaterial>()
function emissive(color: number, glow: number, intensity = 1.5): THREE.MeshStandardMaterial {
  const k = `${color}:${glow}:${intensity}`
  let m = emissiveCache.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      emissive: glow,
      emissiveIntensity: intensity,
      metalness: 0.45,
      roughness: 0.28,
      roughnessMap: SURFACE,
    })
    emissiveCache.set(k, m)
  }
  return m
}

const basicCache = new Map<string, THREE.MeshBasicMaterial>()
function basic(color: number, opacity = 1, additive = false): THREE.MeshBasicMaterial {
  const k = `${color}:${opacity}:${additive}`
  let m = basicCache.get(k)
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1 || additive,
      opacity,
      depthWrite: opacity >= 1 && !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: !additive,
    })
    basicCache.set(k, m)
  }
  return m
}

function shaded<T extends THREE.Object3D>(object: T, receive = true): T {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = receive
  })
  return object
}

// --- Render

const canvas = document.getElementById('scene') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_POWER ? 1.25 : 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0809)
scene.fog = new THREE.FogExp2(0x0a0809, 0.012)

const pmrem = new THREE.PMREMGenerator(renderer)
const room = new RoomEnvironment()
scene.environment = pmrem.fromScene(room, 0.04).texture
room.dispose()
pmrem.dispose()

const camera = new THREE.OrthographicCamera(-20, 20, 13, -13, 0.1, 200)
camera.position.set(0, 24, 20)
camera.lookAt(0, 0, 0)

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: LOW_POWER ? 0 : 4,
})
const composer = new EffectComposer(renderer, renderTarget)
composer.addPass(new RenderPass(scene, camera))

let ssao: SSAOPass | null = null
if (!LOW_POWER) {
  ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight, 16)
  ssao.kernelRadius = 0.14
  ssao.minDistance = 0.001
  ssao.maxDistance = 0.06
  composer.addPass(ssao)
}

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  LOW_POWER ? 0.35 : 0.62,
  0.55,
  0.74,
)
composer.addPass(bloom)
composer.addPass(new OutputPass())
const fxaa = new FXAAPass()
composer.addPass(fxaa)

function resize(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  const aspect = w / h
  const halfH = Math.max(13, 16 / aspect)
  camera.left = -halfH * aspect
  camera.right = halfH * aspect
  camera.top = halfH
  camera.bottom = -halfH
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  composer.setSize(w, h)
  ssao?.setSize(w, h)
}
window.addEventListener('resize', resize)
resize()

const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x2a1a12, 0.8)
scene.add(hemi)

const sun = new THREE.DirectionalLight(0xffc38a, 3.1)
sun.position.set(12, 22, 9)
sun.castShadow = true
sun.shadow.mapSize.set(LOW_POWER ? 1024 : 2048, LOW_POWER ? 1024 : 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 70
sun.shadow.camera.left = -19
sun.shadow.camera.right = 19
sun.shadow.camera.top = 19
sun.shadow.camera.bottom = -19
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.02
scene.add(sun)

const rim = new THREE.DirectionalLight(0x4fd8ff, 0.9)
rim.position.set(-14, 10, -12)
scene.add(rim)

const fill = new THREE.DirectionalLight(0xff7a3d, 0.45)
fill.position.set(-9, 6, 12)
scene.add(fill)

const board = new THREE.Group()
scene.add(board)

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID_W * CELL, GRID_H * CELL),
  mat(0x1a1512, 0.22, 0.92),
)
ground.rotation.x = -Math.PI / 2
ground.position.y = -0.08
ground.receiveShadow = true
board.add(ground)

const instDummy = new THREE.Object3D()
const frameMat = mat(0x3a2a22, 0.82, 0.42)
const frameBars: Array<[number, number, number, number]> = [
  [0, -GRID_H * CELL / 2 - 0.16, GRID_W * CELL + 0.9, 0.32],
  [0, GRID_H * CELL / 2 + 0.16, GRID_W * CELL + 0.9, 0.32],
  [-GRID_W * CELL / 2 - 0.16, 0, 0.32, GRID_H * CELL + 0.9],
  [GRID_W * CELL / 2 + 0.16, 0, 0.32, GRID_H * CELL + 0.9],
]
const frameInstances = new THREE.InstancedMesh(BOX, frameMat, frameBars.length)
frameBars.forEach(([x, z, sx, sz], i) => {
  instDummy.position.set(x, 0.09, z)
  instDummy.rotation.set(0, 0, 0)
  instDummy.scale.set(sx, 0.34, sz)
  instDummy.updateMatrix()
  frameInstances.setMatrixAt(i, instDummy.matrix)
})
frameInstances.castShadow = false
frameInstances.receiveShadow = true
frameInstances.instanceMatrix.needsUpdate = true
board.add(frameInstances)

const linePts: number[] = []
const halfW = (GRID_W * CELL) / 2
const halfH2 = (GRID_H * CELL) / 2
for (let c = 0; c <= GRID_W; c++) {
  const x = -halfW + c * CELL
  linePts.push(x, 0, -halfH2, x, 0, halfH2)
}
for (let r = 0; r <= GRID_H; r++) {
  const z = -halfH2 + r * CELL
  linePts.push(-halfW, 0, z, halfW, 0, z)
}
const lineGeo = new THREE.BufferGeometry()
lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3))
board.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
  color: 0x6b4a2f, transparent: true, opacity: 0.42,
})))

// Afloramientos rocosos alrededor del tablero: "Ferric lands".
const rockMat = mat(0x4a352a, 0.25, 0.95)
const rockCount = LOW_POWER ? 10 : 18
const rockInstances = new THREE.InstancedMesh(ROCK, rockMat, rockCount)
for (let i = 0; i < rockCount; i++) {
  const side = i % 4
  const t = rng()
  const spread = 1.2 + rng() * 4
  if (side === 0) instDummy.position.set(-halfW - spread, -0.2, -halfH2 + t * GRID_H * CELL)
  else if (side === 1) instDummy.position.set(halfW + spread, -0.2, -halfH2 + t * GRID_H * CELL)
  else if (side === 2) instDummy.position.set(-halfW + t * GRID_W * CELL, -0.2, -halfH2 - spread)
  else instDummy.position.set(-halfW + t * GRID_W * CELL, -0.2, halfH2 + spread)
  const s = 0.5 + rng() * 1.4
  instDummy.scale.set(s, s * (0.5 + rng() * 0.7), s)
  instDummy.rotation.set(rng(), rng() * Math.PI, rng() * 0.4)
  instDummy.updateMatrix()
  rockInstances.setMatrixAt(i, instDummy.matrix)
}
rockInstances.castShadow = false
rockInstances.receiveShadow = true
rockInstances.instanceMatrix.needsUpdate = true
board.add(rockInstances)

const pathMat = mat(0x2a1d16, 0.72, 0.58)
const pathGlow = emissive(0x8a3b12, 0xb45309, 0.65)
const pathTiles = new THREE.InstancedMesh(BOX, pathMat, MAX_PATH)
const pathStrips = new THREE.InstancedMesh(BOX, pathGlow, MAX_PATH)

function refreshPathInstances(): void {
  for (let i = 0; i < MAX_PATH; i++) {
    if (i < PATH.length) {
      const [c, r] = PATH[i]
      const center = cellWorld(c, r)
      instDummy.rotation.set(0, 0, 0)
      instDummy.position.set(center.x, 0.01, center.z)
      instDummy.scale.set(CELL * 0.94, 0.1, CELL * 0.94)
      instDummy.updateMatrix()
      pathTiles.setMatrixAt(i, instDummy.matrix)
      instDummy.position.set(center.x, 0.075, center.z)
      instDummy.scale.set(0.5, 0.025, 0.5)
      instDummy.updateMatrix()
      pathStrips.setMatrixAt(i, instDummy.matrix)
    } else {
      instDummy.rotation.set(0, 0, 0)
      instDummy.position.set(0, -100, 0)
      instDummy.scale.setScalar(0.001)
      instDummy.updateMatrix()
      pathTiles.setMatrixAt(i, instDummy.matrix)
      pathStrips.setMatrixAt(i, instDummy.matrix)
    }
  }
  pathTiles.instanceMatrix.needsUpdate = true
  pathStrips.instanceMatrix.needsUpdate = true
}
refreshPathInstances()
pathTiles.castShadow = false
pathTiles.receiveShadow = true
board.add(pathTiles, pathStrips)

const spawnGroup = new THREE.Group()
spawnGroup.position.copy(cellWorld(spawnCell[0], spawnCell[1]))
const spawnRingA = new THREE.Mesh(RING, emissive(0x22d3ee, 0x22d3ee, 2.2))
spawnRingA.rotation.x = Math.PI / 2
spawnRingA.scale.setScalar(1.15)
spawnRingA.position.y = 0.2
const spawnRingB = new THREE.Mesh(RING, basic(0x67e8f9, 0.55, true))
spawnRingB.rotation.x = Math.PI / 2
spawnRingB.scale.setScalar(0.72)
spawnRingB.position.y = 0.24
const spawnLight = new THREE.PointLight(0x22d3ee, 14, 9, 2)
spawnLight.position.y = 1.1
spawnGroup.add(spawnRingA, spawnRingB, spawnLight)
board.add(spawnGroup)

const coreGroup = new THREE.Group()
coreGroup.position.copy(cellWorld(coreCell[0], coreCell[1]))
const coreBase = new THREE.Mesh(CYL, mat(0x2b3648, 0.9, 0.3))
coreBase.scale.set(1.8, 0.36, 1.8)
coreBase.position.y = 0.18
const coreCollar = new THREE.Mesh(RING, mat(0x64748b, 0.95, 0.24))
coreCollar.rotation.x = Math.PI / 2
coreCollar.scale.setScalar(1.05)
coreCollar.position.y = 0.42
const coreBody = new THREE.Mesh(BOX, mat(0x475569, 0.82, 0.38))
coreBody.scale.set(1.12, 0.92, 1.12)
coreBody.position.y = 0.86
for (const side of [-1, 1]) {
  const vent = new THREE.Mesh(BOX, mat(0x0b1220, 0.6, 0.6))
  vent.scale.set(0.08, 0.5, 0.7)
  vent.position.set(side * 0.58, 0.86, 0)
  coreGroup.add(vent)
}
const coreOrb = new THREE.Mesh(SPH, emissive(0xbae6fd, 0x38bdf8, 2.8))
coreOrb.scale.setScalar(0.82)
coreOrb.position.y = 1.62
const coreRing = new THREE.Mesh(RING, basic(0x7dd3fc, 0.85, true))
coreRing.rotation.x = Math.PI / 2
coreRing.scale.setScalar(0.95)
coreRing.position.y = 1.62
const coreLight = new THREE.PointLight(0x7dd3fc, 18, 12, 2)
coreLight.position.y = 1.7
coreGroup.add(coreBase, coreCollar, coreBody, coreOrb, coreRing, coreLight)
shaded(coreGroup)
board.add(coreGroup)

// Drone aliado: acompaña al núcleo como reference "Intruders".
const drone = new THREE.Group()
drone.position.copy(cellWorld(coreCell[0], coreCell[1])).add(new THREE.Vector3(1.6, 2.6, 0.8))
const droneBody = new THREE.Mesh(BOX, mat(0x3a2a22, 0.9, 0.32))
droneBody.scale.set(0.44, 0.18, 0.44)
const droneEye = new THREE.Mesh(SPH, emissive(0x67e8f9, 0x22d3ee, 2.4))
droneEye.scale.setScalar(0.12)
droneEye.position.set(0, 0, 0.24)
const droneRotors: THREE.Mesh[] = []
for (const side of [-1, 1]) {
  for (const front of [-1, 1]) {
    const rotor = new THREE.Mesh(CYL, basic(0x7dd3fc, 0.55, true))
    rotor.scale.set(0.18, 0.03, 0.18)
    rotor.position.set(side * 0.34, 0.1, front * 0.34)
    droneRotors.push(rotor)
  }
}
const droneArms = new THREE.Mesh(BOX, mat(0x0b0e14, 0.8, 0.5))
droneArms.scale.set(0.78, 0.06, 0.78)
drone.add(droneBody, droneEye, droneArms, ...droneRotors)
shaded(drone)
board.add(drone)

function applyMap(id: string): void {
  const def = MAPS.find(m => m.id === id)
  if (!def) return
  activeMapId = def.id
  PATH = def.path
  PATH_KEYS = new Set(PATH.map(([c, r]) => key(c, r)))
  spawnCell = PATH[0]
  coreCell = PATH[PATH.length - 1]
  PATH_WORLD = PATH.map(([c, r]) => cellWorld(c, r))
  refreshPathInstances()
  spawnGroup.position.copy(cellWorld(spawnCell[0], spawnCell[1]))
  coreGroup.position.copy(cellWorld(coreCell[0], coreCell[1]))
  drone.position.copy(cellWorld(coreCell[0], coreCell[1])).add(new THREE.Vector3(1.6, 2.6, 0.8))
  best = readBest()
  refreshMapButtons()
  refreshHud()
}

const ghost = new THREE.Group()
const ghostBase = new THREE.Mesh(CYL, basic(0x4ade80, 0.38, true))
ghostBase.scale.set(1.05, 0.3, 1.05)
ghostBase.position.y = 0.15
const ghostRange = new THREE.Mesh(RANGE_RING, basic(0x7dd3fc, 0.22, true))
ghostRange.rotation.x = -Math.PI / 2
ghostRange.position.y = 0.07
ghost.add(ghostBase, ghostRange)
ghost.visible = false
scene.add(ghost)

// --- Modelos

interface Tower {
  type: TowerType
  col: number
  row: number
  level: number
  cooldown: number
  pos: THREE.Vector3
  turn: number
  slot: number
  ringSlot: number
}

interface Enemy {
  kind: EnemyKind
  hp: number
  maxHp: number
  shield: number
  scale: number
  speed: number
  reward: number
  boss: boolean
  dead: boolean
  pathIndex: number
  pos: THREE.Vector3
  mesh: THREE.Object3D
  turn: number
  hpRatio: number
  slot: number
  bodySlot: number
  slowUntil: number
  armorShred: number
}

interface Projectile {
  target: Enemy | null
  aim: THREE.Vector3
  pos: THREE.Vector3
  slot: number
  size: number
  color: number
  speed: number
  damage: number
  splash: number
  source: TowerType
}

interface Effect {
  object: THREE.Mesh
  material: THREE.MeshBasicMaterial
  life: number
  maxLife: number
  fromScale: number
  toScale: number
}

// --- Instancing: una sola llamada por familia en vez de una por malla.

const MAX_NORMAL = 64
const MAX_BOSS = 8
const MAX_PROJECTILES = 64
const MAX_SPARKS = 180
const MAX_RINGS = 32
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const instScratch = new THREE.Object3D()
const instVec = new THREE.Vector3()
const instDir = new THREE.Vector3()
const instColor = new THREE.Color()

function coloredPart(
  geo: THREE.BufferGeometry,
  scale: [number, number, number],
  pos: [number, number, number],
  color: number,
  rot: [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  const g = geo.clone()
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  ))
  const c = new THREE.Color(color)
  const count = g.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

function buildEnemyGeometry(boss: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    coloredPart(BOX, [0.86, 0.44, 0.76], [0, 0.46, 0], 0xffffff, [0, 0, 0.03]),
    coloredPart(BOX, [0.92, 0.14, 0.82], [0, 0.7, 0], 0x2f2622),
    coloredPart(BOX, [0.5, 0.36, 0.44], [0, 0.92, 0], 0xffffff),
    coloredPart(CYL, [0.03, 0.28, 0.03], [0.16, 1.22, 0], 0x93a2b0),
  ]
  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      parts.push(coloredPart(BOX, [0.12, 0.34, 0.4], [side * 0.34, 0.17, front * 0.26], 0x2b2622))
    }
  }
  if (boss) {
    for (const side of [-1, 1]) {
      parts.push(coloredPart(BOX, [0.28, 0.26, 0.6], [side * 0.52, 0.7, 0], 0xffffff))
    }
  }
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!merged) throw new Error('No se pudo fusionar la geometría del enemigo')
  return merged
}

const enemyBodyMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, vertexColors: true, metalness: 0.78, roughness: 0.42,
  roughnessMap: SURFACE, bumpMap: SURFACE, bumpScale: 0.012, envMapIntensity: 0.95,
})
const normalBodies = new THREE.InstancedMesh(buildEnemyGeometry(false), enemyBodyMat, MAX_NORMAL)
const bossBodies = new THREE.InstancedMesh(buildEnemyGeometry(true), enemyBodyMat, MAX_BOSS)
const visorInstances = new THREE.InstancedMesh(BOX, emissive(0xff6b6b, 0xff2d2d, 3), MAX_NORMAL + MAX_BOSS)
const hpBgInstances = new THREE.InstancedMesh(BOX, basic(0x111827, 0.85), MAX_NORMAL + MAX_BOSS)
const hpFillInstances = new THREE.InstancedMesh(BOX, emissive(0x86efac, 0x22c55e, 1.4), MAX_NORMAL + MAX_BOSS)
for (const mesh of [normalBodies, bossBodies]) {
  mesh.castShadow = true
  mesh.receiveShadow = true
}
scene.add(normalBodies, bossBodies, visorInstances, hpBgInstances, hpFillInstances)
const freeNormalSlots = Array.from({ length: MAX_NORMAL }, (_, i) => MAX_NORMAL - 1 - i)
const freeBossSlots = Array.from({ length: MAX_BOSS }, (_, i) => MAX_BOSS - 1 - i)
const freeHpSlots = Array.from({ length: MAX_NORMAL + MAX_BOSS }, (_, i) => MAX_NORMAL + MAX_BOSS - 1 - i)
for (let i = 0; i < MAX_NORMAL; i++) {
  normalBodies.setMatrixAt(i, zeroMatrix)
  normalBodies.setColorAt(i, instColor.setHex(0xf87171))
}
for (let i = 0; i < MAX_BOSS; i++) {
  bossBodies.setMatrixAt(i, zeroMatrix)
  bossBodies.setColorAt(i, instColor.setHex(0xc084fc))
}
for (let i = 0; i < MAX_NORMAL + MAX_BOSS; i++) {
  visorInstances.setMatrixAt(i, zeroMatrix)
  hpBgInstances.setMatrixAt(i, zeroMatrix)
  hpFillInstances.setMatrixAt(i, zeroMatrix)
}
normalBodies.instanceMatrix.needsUpdate = true
bossBodies.instanceMatrix.needsUpdate = true
if (normalBodies.instanceColor) normalBodies.instanceColor.needsUpdate = true
if (bossBodies.instanceColor) bossBodies.instanceColor.needsUpdate = true

function hideSlot(mesh: THREE.InstancedMesh, slot: number): void {
  mesh.setMatrixAt(slot, zeroMatrix)
  mesh.instanceMatrix.needsUpdate = true
}

function writeEnemy(e: Enemy): void {
  const scale = e.scale
  const bodyMesh = e.boss ? bossBodies : normalBodies
  instScratch.position.copy(e.pos)
  instScratch.rotation.set(0, e.turn, 0)
  instScratch.scale.setScalar(scale)
  instScratch.updateMatrix()
  bodyMesh.setMatrixAt(e.bodySlot, instScratch.matrix)

  instVec.set(0, 0.94 * scale, 0.24 * scale).applyAxisAngle(Y_AXIS, e.turn)
  instScratch.position.copy(e.pos).add(instVec)
  instScratch.scale.set(0.4 * scale, 0.1 * scale, 0.05 * scale)
  instScratch.updateMatrix()
  visorInstances.setMatrixAt(e.slot, instScratch.matrix)

  instScratch.position.copy(e.pos)
  instScratch.position.y += 1.42 * scale
  instScratch.rotation.set(0, 0, 0)
  instScratch.scale.set(0.74 * scale, 0.08 * scale, 0.02 * scale)
  instScratch.updateMatrix()
  hpBgInstances.setMatrixAt(e.slot, instScratch.matrix)

  instScratch.position.copy(e.pos)
  instScratch.position.x -= 0.7 * (1 - e.hpRatio) * scale / 2
  instScratch.position.y += 1.42 * scale
  instScratch.position.z += 0.02 * scale
  instScratch.scale.set(0.7 * e.hpRatio * scale, 0.1 * scale, 0.03 * scale)
  instScratch.updateMatrix()
  hpFillInstances.setMatrixAt(e.slot, instScratch.matrix)

  bodyMesh.instanceMatrix.needsUpdate = true
  visorInstances.instanceMatrix.needsUpdate = true
  hpBgInstances.instanceMatrix.needsUpdate = true
  hpFillInstances.instanceMatrix.needsUpdate = true
}

// --- Proyectiles instanciados.

const projectileCores = new THREE.InstancedMesh(SPH, basic(0xffffff, 1, true), MAX_PROJECTILES)
const projectileHalos = new THREE.InstancedMesh(
  SPH,
  new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }),
  MAX_PROJECTILES,
)
scene.add(projectileCores, projectileHalos)
const freeProjectileSlots = Array.from({ length: MAX_PROJECTILES }, (_, i) => MAX_PROJECTILES - 1 - i)
for (let i = 0; i < MAX_PROJECTILES; i++) {
  projectileCores.setMatrixAt(i, zeroMatrix)
  projectileHalos.setMatrixAt(i, zeroMatrix)
  projectileCores.setColorAt(i, instColor.setHex(0xffffff))
  projectileHalos.setColorAt(i, instColor.setHex(0xffffff))
}
projectileCores.instanceMatrix.needsUpdate = true
projectileHalos.instanceMatrix.needsUpdate = true

function writeProjectile(p: Projectile): void {
  instScratch.position.copy(p.pos)
  instScratch.rotation.set(0, 0, 0)
  instScratch.scale.setScalar(p.size * 0.18)
  instScratch.updateMatrix()
  projectileCores.setMatrixAt(p.slot, instScratch.matrix)
  instScratch.scale.setScalar(p.size * 0.36)
  instScratch.updateMatrix()
  projectileHalos.setMatrixAt(p.slot, instScratch.matrix)
  instColor.setHex(p.color)
  projectileCores.setColorAt(p.slot, instColor)
  projectileHalos.setColorAt(p.slot, instColor)
  projectileCores.instanceMatrix.needsUpdate = true
  projectileHalos.instanceMatrix.needsUpdate = true
  if (projectileCores.instanceColor) projectileCores.instanceColor.needsUpdate = true
  if (projectileHalos.instanceColor) projectileHalos.instanceColor.needsUpdate = true
}

// --- Efectos: anillos en pool y chispas instanciadas, sin materiales por disparo.

const effects: Effect[] = []
const ringPool: Effect[] = []
for (let i = 0; i < MAX_RINGS; i++) {
  const material = basic(0xffffff, 0, true).clone()
  const object = new THREE.Mesh(RING, material)
  object.rotation.x = Math.PI / 2
  object.visible = false
  scene.add(object)
  ringPool.push({ object, material, life: 0, maxLife: 1, fromScale: 1, toScale: 1 })
}

const sparkInstances = new THREE.InstancedMesh(SPARK_GEO, basic(0xffffff, 0.95, true), MAX_SPARKS)
scene.add(sparkInstances)
const freeSparkSlots = Array.from({ length: MAX_SPARKS }, (_, i) => MAX_SPARKS - 1 - i)
const activeSparks: number[] = []
const sparkVel: THREE.Vector3[] = Array.from({ length: MAX_SPARKS }, () => new THREE.Vector3())
const sparkPos: THREE.Vector3[] = Array.from({ length: MAX_SPARKS }, () => new THREE.Vector3())
const sparkLife = new Float32Array(MAX_SPARKS)
const sparkPower = new Float32Array(MAX_SPARKS)
for (let i = 0; i < MAX_SPARKS; i++) {
  sparkInstances.setMatrixAt(i, zeroMatrix)
  sparkInstances.setColorAt(i, instColor.setHex(0xffffff))
}
sparkInstances.instanceMatrix.needsUpdate = true

// --- Torres instanciadas: cuerpo, cabeza y acentos por tipo, en 10 draws fijos.

const MAX_TOWERS = 96
const TOWER_TYPES: TowerType[] = ['blaster', 'coil', 'mortar', 'brake', 'lance']

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!merged) throw new Error('No se pudo fusionar la geometría de la torre')
  return merged
}

function buildTowerBodyGeometry(color: number): THREE.BufferGeometry {
  return mergeParts([
    coloredPart(CYL, [1.3, 0.14, 1.3], [0, 0.07, 0], 0x0b0e14),
    coloredPart(CYL, [1.04, 0.3, 1.04], [0, 0.23, 0], 0x2a211c),
    coloredPart(CYL, [0.82, 0.09, 0.82], [0, 0.41, 0], color),
  ])
}

function buildTowerHeadGeometry(type: TowerType, color: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  if (type === 'blaster') {
    parts.push(coloredPart(BOX, [0.8, 0.46, 0.72], [0, 0, 0], 0x2a211c))
    parts.push(coloredPart(BOX, [0.9, 0.14, 0.8], [0, 0.26, 0], 0x0b0e14))
    for (const side of [-1, 1]) {
      parts.push(coloredPart(CYL, [0.16, 0.92, 0.16], [side * 0.2, 0.02, 0.58], 0x0b0e14, [Math.PI / 2, 0, 0]))
    }
  } else if (type === 'coil') {
    parts.push(coloredPart(CYL, [0.32, 0.72, 0.32], [0, 0.12, 0], 0x2a211c))
    for (const side of [-1, 1]) {
      parts.push(coloredPart(BOX, [0.1, 0.5, 0.22], [side * 0.36, 0.16, 0.3], 0x0b0e14))
    }
  } else if (type === 'brake') {
    parts.push(coloredPart(CYL, [0.52, 0.42, 0.52], [0, 0.14, 0], 0x2a211c))
    parts.push(coloredPart(RING, [0.62, 0.62, 0.62], [0, 0.2, 0], 0x0b0e14, [Math.PI / 2, 0, 0]))
  } else if (type === 'lance') {
    parts.push(coloredPart(BOX, [0.7, 0.44, 0.8], [0, 0, 0], 0x2a211c))
    parts.push(coloredPart(CYL, [0.11, 1.3, 0.11], [0, 0.14, 0.7], 0x0b0e14, [Math.PI / 2, 0, 0]))
  } else {
    parts.push(coloredPart(BOX, [0.86, 0.5, 0.78], [0, 0, 0], 0x2a211c))
    parts.push(coloredPart(BOX, [0.72, 0.32, 0.6], [0, 0.22, 0], 0x0b0e14))
    for (const side of [-1, 1]) {
      parts.push(coloredPart(CYL, [0.17, 0.72, 0.17], [side * 0.22, 0.08, 0.42], 0x0b0e14, [Math.PI / 2, 0, 0]))
    }
    parts.push(coloredPart(BOX, [0.1, 0.42, 0.4], [0, 0.5, -0.2], color))
  }
  return mergeParts(parts)
}

function buildTowerAccentGeometry(type: TowerType, color: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  if (type === 'blaster') {
    for (const side of [-1, 1]) {
      parts.push(coloredPart(CYL, [0.19, 0.08, 0.19], [side * 0.2, 0.02, 1.04], color, [Math.PI / 2, 0, 0]))
    }
    parts.push(coloredPart(SPH, [0.12, 0.12, 0.12], [0, 0.18, 0.4], 0xffffff))
  } else if (type === 'coil') {
    parts.push(coloredPart(SPH, [0.3, 0.3, 0.3], [0, 0.34, 0.38], color))
    for (let i = 0; i < 3; i++) {
      const s = 0.34 + i * 0.16
      parts.push(coloredPart(RING, [s, s, s], [0, 0.34, 0.38 - i * 0.12], color, [Math.PI / 2, 0, 0]))
    }
  } else if (type === 'brake') {
    for (let i = 0; i < 3; i++) {
      const s = 0.5 + i * 0.2
      parts.push(coloredPart(RING, [s, s, s], [0, 0.24, 0], color, [Math.PI / 2, 0, 0]))
    }
  } else if (type === 'lance') {
    parts.push(coloredPart(CYL, [0.14, 0.5, 0.14], [0, 0.2, 1.32], color, [Math.PI / 2, 0, 0]))
    parts.push(coloredPart(SPH, [0.18, 0.18, 0.18], [0, 0.2, 1.5], color))
  } else {
    for (const side of [-1, 1]) {
      parts.push(coloredPart(SPH, [0.16, 0.16, 0.16], [side * 0.22, 0.08, 0.78], color))
    }
  }
  return mergeParts(parts)
}

const towerBodyMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, vertexColors: true, metalness: 0.9, roughness: 0.34,
  roughnessMap: SURFACE, bumpMap: SURFACE, bumpScale: 0.01, envMapIntensity: 0.95,
})
const towerAccentMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.95,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
})

interface TowerFamily { body: THREE.InstancedMesh; head: THREE.InstancedMesh; accent: THREE.InstancedMesh }
const towerFamilies = {} as Record<TowerType, TowerFamily>
for (const type of TOWER_TYPES) {
  const color = TOWER_DEFS[type].color
  const family: TowerFamily = {
    body: new THREE.InstancedMesh(buildTowerBodyGeometry(color), towerBodyMat, MAX_TOWERS),
    head: new THREE.InstancedMesh(buildTowerHeadGeometry(type, color), towerBodyMat, MAX_TOWERS),
    accent: new THREE.InstancedMesh(buildTowerAccentGeometry(type, color), towerAccentMat, MAX_TOWERS),
  }
  for (const mesh of [family.body, family.head, family.accent]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    scene.add(mesh)
    for (let i = 0; i < MAX_TOWERS; i++) mesh.setMatrixAt(i, zeroMatrix)
    mesh.instanceMatrix.needsUpdate = true
  }
  towerFamilies[type] = family
}

const towerLevelRings = new THREE.InstancedMesh(RING, emissive(0xfacc15, 0xf59e0b, 1.4), MAX_TOWERS)
towerLevelRings.frustumCulled = false
scene.add(towerLevelRings)
for (let i = 0; i < MAX_TOWERS; i++) towerLevelRings.setMatrixAt(i, zeroMatrix)
towerLevelRings.instanceMatrix.needsUpdate = true

const freeTowerSlots: Record<TowerType, number[]> = {
  blaster: Array.from({ length: MAX_TOWERS }, (_, i) => MAX_TOWERS - 1 - i),
  coil: Array.from({ length: MAX_TOWERS }, (_, i) => MAX_TOWERS - 1 - i),
  mortar: Array.from({ length: MAX_TOWERS }, (_, i) => MAX_TOWERS - 1 - i),
  brake: Array.from({ length: MAX_TOWERS }, (_, i) => MAX_TOWERS - 1 - i),
  lance: Array.from({ length: MAX_TOWERS }, (_, i) => MAX_TOWERS - 1 - i),
}
const freeRingSlots = Array.from({ length: MAX_TOWERS }, (_, i) => MAX_TOWERS - 1 - i)

function writeTower(t: Tower): void {
  const family = towerFamilies[t.type]
  instScratch.position.copy(t.pos)
  instScratch.rotation.set(0, 0, 0)
  instScratch.scale.setScalar(1)
  instScratch.updateMatrix()
  family.body.setMatrixAt(t.slot, instScratch.matrix)

  instScratch.position.copy(t.pos)
  instScratch.position.y += 0.74
  instScratch.rotation.set(0, t.turn, 0)
  instScratch.updateMatrix()
  family.head.setMatrixAt(t.slot, instScratch.matrix)
  family.accent.setMatrixAt(t.slot, instScratch.matrix)

  if (t.level > 1) {
    instScratch.rotation.set(Math.PI / 2, 0, 0)
    instScratch.scale.setScalar(0.62 + (t.level - 2) * 0.16)
    instScratch.updateMatrix()
    towerLevelRings.setMatrixAt(t.ringSlot, instScratch.matrix)
  } else {
    hideSlot(towerLevelRings, t.ringSlot)
  }

  family.body.instanceMatrix.needsUpdate = true
  family.head.instanceMatrix.needsUpdate = true
  family.accent.instanceMatrix.needsUpdate = true
  towerLevelRings.instanceMatrix.needsUpdate = true
}

function spawnRing(
  pos: THREE.Vector3, color: number,
  life: number, from: number, to: number, y = 0.14,
): void {
  const fx = ringPool.pop()
  if (!fx) return
  fx.object.visible = true
  fx.object.position.copy(pos)
  fx.object.position.y = y
  fx.material.color.setHex(color)
  fx.material.opacity = 0.9
  fx.object.scale.setScalar(from)
  fx.life = life
  fx.maxLife = life
  fx.fromScale = from
  fx.toScale = to
  effects.push(fx)
}

function spawnSparks(pos: THREE.Vector3, color: number, power: number): void {
  const count = LOW_POWER ? 4 : 8
  for (let i = 0; i < count; i++) {
    const slot = freeSparkSlots.pop()
    if (slot === undefined) break
    activeSparks.push(slot)
    sparkLife[slot] = 0.38 + Math.random() * 0.25
    sparkPower[slot] = 0.08 * power
    const a = Math.random() * Math.PI * 2
    const s = (1.6 + Math.random() * 2.4) * power
    sparkVel[slot].set(Math.cos(a) * s, 2.2 * power, Math.sin(a) * s)
    sparkPos[slot].copy(pos)
    sparkPos[slot].y = 0.45
    instScratch.position.copy(sparkPos[slot])
    instScratch.rotation.set(0, 0, 0)
    instScratch.scale.setScalar(sparkPower[slot])
    instScratch.updateMatrix()
    sparkInstances.setMatrixAt(slot, instScratch.matrix)
    sparkInstances.setColorAt(slot, instColor.setHex(i % 3 === 0 ? 0xffffff : color))
  }
  sparkInstances.instanceMatrix.needsUpdate = true
  if (sparkInstances.instanceColor) sparkInstances.instanceColor.needsUpdate = true
}

function spawnImpact(pos: THREE.Vector3, color: number, power = 1): void {
  spawnRing(pos, color, 0.45, 0.25 * power, 1.1 * power)
  spawnSparks(pos, color, power)
}

function spawnMuzzle(pos: THREE.Vector3, color: number): void {
  spawnRing(pos, color, 0.12, 0.18, 0.5, pos.y)
}

function updateSparks(dt: number): void {
  for (let i = activeSparks.length - 1; i >= 0; i--) {
    const slot = activeSparks[i]
    sparkLife[slot] -= dt
    if (sparkLife[slot] <= 0) {
      hideSlot(sparkInstances, slot)
      freeSparkSlots.push(slot)
      activeSparks.splice(i, 1)
      continue
    }
    sparkVel[slot].y -= 7 * dt
    instScratch.position.copy(sparkPos[slot]).addScaledVector(sparkVel[slot], dt)
    sparkPos[slot].copy(instScratch.position)
    instScratch.rotation.set(0, 0, 0)
    instScratch.scale.setScalar(sparkPower[slot] * (1 - 0.8 * (1 - sparkLife[slot] / 0.63)))
    instScratch.updateMatrix()
    sparkInstances.setMatrixAt(slot, instScratch.matrix)
  }
  sparkInstances.instanceMatrix.needsUpdate = true
}

function updateEffects(dt: number): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i]
    fx.life -= dt
    if (fx.life <= 0) {
      fx.object.visible = false
      effects.splice(i, 1)
      ringPool.push(fx)
      continue
    }
    const t = 1 - fx.life / fx.maxLife
    fx.object.scale.setScalar(fx.fromScale + (fx.toScale - fx.fromScale) * t)
    fx.material.opacity = 0.9 * (1 - t)
  }
  updateSparks(dt)
}

function clearEffects(): void {
  for (const fx of effects) {
    fx.object.visible = false
    ringPool.push(fx)
  }
  effects.length = 0
  while (activeSparks.length > 0) {
    const slot = activeSparks.pop()!
    hideSlot(sparkInstances, slot)
    freeSparkSlots.push(slot)
  }
}

// --- DOM

const scrapEl = document.getElementById('scrap') as HTMLElement
const waveEl = document.getElementById('wave') as HTMLElement
const coreEl = document.getElementById('core') as HTMLElement
const bestEl = document.getElementById('best') as HTMLElement
const nextWaveBtn = document.getElementById('next-wave') as HTMLButtonElement
const overlay = document.getElementById('overlay') as HTMLElement
const endEl = document.getElementById('end') as HTMLElement
const endTitle = document.getElementById('end-title') as HTMLElement
const endText = document.getElementById('end-text') as HTMLElement
const toastEl = document.getElementById('toast') as HTMLElement
const playBtn = document.getElementById('play') as HTMLButtonElement
const restartBtn = document.getElementById('restart') as HTMLButtonElement
const towerButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tower[data-type]'))
const interestEl = document.getElementById('interest') as HTMLElement
const empEl = document.getElementById('emp') as HTMLElement
const empBtn = document.getElementById('emp-btn') as HTMLButtonElement
const inspectEl = document.getElementById('inspect') as HTMLElement
const inspectNameEl = document.getElementById('inspect-name') as HTMLElement
const inspectLevelEl = document.getElementById('inspect-level') as HTMLElement
const inspectStatsEl = document.getElementById('inspect-stats') as HTMLElement
const upgradeBtn = document.getElementById('upgrade-btn') as HTMLButtonElement
const sellBtn = document.getElementById('sell-btn') as HTMLButtonElement
const telegraphEl = document.getElementById('telegraph') as HTMLElement
const telegraphWaveEl = document.getElementById('telegraph-wave') as HTMLElement
const telegraphUnitsEl = document.getElementById('telegraph-units') as HTMLElement
const mapButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.map-select button'))

function refreshMapButtons(): void {
  for (const btn of mapButtons) {
    btn.setAttribute('aria-pressed', String(btn.dataset.map === activeMapId))
  }
}

// --- Estado

type Phase = 'menu' | 'playing' | 'between' | 'won' | 'lost'

let phase: Phase = 'menu'
let scrap = 80
let wave = 0
let lives = 10
let best = readBest()
let selected: TowerType = 'blaster'
let spawnLeft = 0
let spawnTimer = 0
let intermission = 0
let toastTimer = 0
let empCharge = 0
let empPulse = 0

const towers: Tower[] = []
let inspected: Tower | null = null
let leaks = 0
const enemies: Enemy[] = []
const projectiles: Projectile[] = []

function readBest(): number | null {
  const raw = localStorage.getItem(bestKey(activeMapId))
  if (raw === null) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function saveBest(n: number): void {
  localStorage.setItem(bestKey(activeMapId), String(n))
}

function toast(msg: string): void {
  toastEl.textContent = msg
  toastEl.classList.add('show')
  toastTimer = 2
}

function refreshTowerButtons(): void {
  for (const btn of towerButtons) {
    btn.setAttribute('aria-pressed', String(btn.dataset.type === selected))
  }
}

function selectTower(t: TowerType): void {
  selected = t
  refreshTowerButtons()
}

const SELL_RATE = 0.65
const INTEREST_RATE = 0.1
const INTEREST_CAP = 40
const TOWER_NAMES: Record<TowerType, string> = { blaster: 'Bláster', coil: 'Bobina', mortar: 'Mortero', brake: 'Freno', lance: 'Lanza' }

interface TowerStats { damage: number; range: number; cooldown: number; splash: number; upgrade: number; sell: number }

function towerStats(type: TowerType, level: number): TowerStats {
  const def = TOWER_DEFS[type]
  const baseSell = Math.round(def.cost * SELL_RATE)
  return {
    damage: def.damage * (1 + (level - 1) * 0.5),
    range: def.range + (level - 1) * 0.35,
    cooldown: def.cooldown / (1 + (level - 1) * 0.18),
    splash: def.splash > 0 ? def.splash + (level - 1) * 0.25 : 0,
    upgrade: level >= 3 ? 0 : Math.round(def.cost * level * 0.8),
    sell: baseSell + (level - 1) * Math.round(baseSell * 0.5),
  }
}

function projectedInterest(): number {
  return Math.min(INTEREST_CAP, Math.round(scrap * INTEREST_RATE))
}

function releaseTower(t: Tower): void {
  const family = towerFamilies[t.type]
  hideSlot(family.body, t.slot)
  hideSlot(family.head, t.slot)
  hideSlot(family.accent, t.slot)
  hideSlot(towerLevelRings, t.ringSlot)
  freeTowerSlots[t.type].push(t.slot)
  freeRingSlots.push(t.ringSlot)
}

function updateInspect(): void {
  if (!inspected || !towers.includes(inspected)) {
    inspectEl.classList.add('hidden')
    inspected = null
    return
  }
  const t = inspected
  const s = towerStats(t.type, t.level)
  inspectEl.classList.remove('hidden')
  inspectNameEl.textContent = TOWER_NAMES[t.type]
  inspectLevelEl.textContent = `nivel ${t.level}/3`
  inspectStatsEl.innerHTML =
    `<span>daño</span><b>${s.damage.toFixed(1)}</b>` +
    `<span>alcance</span><b>${s.range.toFixed(1)}</b>` +
    `<span>cadencia</span><b>${(1 / s.cooldown).toFixed(2)}/s</b>` +
    (s.splash > 0 ? `<span>área</span><b>${s.splash.toFixed(1)}</b>` : '')
  upgradeBtn.textContent = s.upgrade > 0 ? `mejorar · ${s.upgrade}` : 'nivel máximo'
  upgradeBtn.disabled = s.upgrade === 0 || scrap < s.upgrade
  sellBtn.textContent = `vender · ${s.sell}`
}

function inspectTower(t: Tower | null): void {
  inspected = t
  updateInspect()
}

function sellTower(t: Tower): void {
  const s = towerStats(t.type, t.level)
  const idx = towers.indexOf(t)
  if (idx < 0) return
  releaseTower(t)
  towers.splice(idx, 1)
  scrap += s.sell
  inspectTower(null)
  spawnImpact(t.pos.clone().setY(0.3), 0x94a3b8, 0.8)
  toast(`+${s.sell} de chatarra`)
}

function clearEntities(): void {
  for (const t of towers) {
    const family = towerFamilies[t.type]
    hideSlot(family.body, t.slot)
    hideSlot(family.head, t.slot)
    hideSlot(family.accent, t.slot)
    hideSlot(towerLevelRings, t.ringSlot)
    freeTowerSlots[t.type].push(t.slot)
    freeRingSlots.push(t.ringSlot)
  }
  towers.length = 0
  while (enemies.length > 0) removeEnemy(enemies[enemies.length - 1])
  while (projectiles.length > 0) {
    const p = projectiles.pop()!
    hideSlot(projectileCores, p.slot)
    hideSlot(projectileHalos, p.slot)
    freeProjectileSlots.push(p.slot)
  }
  clearEffects()
}

function resetState(): void {
  clearEntities()
  scrap = 80
  wave = 0
  lives = 10
  phase = 'menu'
  spawnLeft = 0
  spawnTimer = 0
  intermission = 0
  leaks = 0
  empCharge = 0
  empPulse = 0
  inspectTower(null)
  selectTower('blaster')
  ghost.visible = false
}

function startGame(): void {
  resetState()
  overlay.classList.add('hidden')
  endEl.classList.add('hidden')
  nextWaveBtn.disabled = false
  phase = 'between'
  intermission = 1
  toast('Prepará tus robots')
}

function beginWave(): void {
  wave++
  if (best === null || wave > best) {
    best = wave
    saveBest(best)
  }
  spawnLeft = WAVES[wave - 1].count
  spawnTimer = 0
  phase = 'playing'
  toast(`Oleada ${wave} / ${MAX_WAVES}`)
}

function finish(win: boolean): void {
  phase = win ? 'won' : 'lost'
  nextWaveBtn.disabled = true
  endTitle.textContent = win ? '¡Núcleo a salvo!' : 'Núcleo destruido'
  endText.textContent = win
    ? `Defendiste las ${MAX_WAVES} oleadas con ${lives} puntos de núcleo. Récord: ${best ?? wave}.`
    : `Llegaste a la oleada ${wave}. Récord: ${best ?? wave}.`
  endEl.classList.remove('hidden')
}

// --- Simulación

function spawnEnemy(kind: EnemyKind, at?: THREE.Vector3, pathIndex = 0): void {
  const def = WAVES[Math.max(0, wave - 1)]
  const boss = kind === 'boss'
  const bodySlot = (boss ? freeBossSlots : freeNormalSlots).pop()
  const slot = freeHpSlots.pop()
  if (bodySlot === undefined || slot === undefined) return
  const hpMul = kind === 'swarm' ? 0.6 : kind === 'armored' ? 1.8 : kind === 'splitter' ? 1.2 : 1
  const speedMul = kind === 'swarm' ? 1.6 : kind === 'armored' ? 0.75 : kind === 'shielded' ? 0.9 : 0.95
  const rewardMul = kind === 'swarm' ? 0.8 : kind === 'armored' ? 1.5 : kind === 'shielded' ? 1.6 : kind === 'splitter' ? 1.4 : 1
  const hp = boss ? def.bossHp : Math.max(1, Math.round(def.normalHp * hpMul))
  const shield = kind === 'shielded' ? Math.round(hp * 0.8) : 0
  const speed = boss ? def.bossSpeed : def.normalSpeed * speedMul
  const reward = boss ? def.bossReward : Math.max(1, Math.round(def.normalReward * rewardMul))
  const scale = boss ? 1.5 : kind === 'swarm' ? 0.78 : kind === 'armored' ? 1.14 : 1
  const pos = at ? at.clone() : cellWorld(spawnCell[0], spawnCell[1])
  const mesh = new THREE.Object3D()
  mesh.position.copy(pos)
  const enemy: Enemy = {
    kind, hp, maxHp: hp, shield, scale, speed, reward, boss,
    dead: false, pathIndex, pos, mesh, turn: 0, hpRatio: 1, slot, bodySlot,
    slowUntil: 0, armorShred: 0,
  }
  enemies.push(enemy)
  const bodyMesh = boss ? bossBodies : normalBodies
  bodyMesh.setColorAt(bodySlot, instColor.setHex(ENEMY_COLORS[kind]))
  if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true
  writeEnemy(enemy)
}

function removeEnemy(e: Enemy): void {
  hideSlot(e.boss ? bossBodies : normalBodies, e.bodySlot)
  hideSlot(visorInstances, e.slot)
  hideSlot(hpBgInstances, e.slot)
  hideSlot(hpFillInstances, e.slot)
  ;(e.boss ? freeBossSlots : freeNormalSlots).push(e.bodySlot)
  freeHpSlots.push(e.slot)
  const i = enemies.indexOf(e)
  if (i >= 0) enemies.splice(i, 1)
}

function reachCore(e: Enemy): void {
  leaks++
  const penalty = (e.boss ? 3 : 1) + Math.min(2, Math.floor(leaks / 3))
  lives -= penalty
  toast(`${e.boss ? '¡Un jefe golpeó el núcleo!' : '¡Un bot llegó al núcleo!'} -${penalty}`)
  spawnImpact(e.pos, 0xf87171, 1.4)
  e.dead = true
  removeEnemy(e)
  if (lives <= 0) finish(false)
}

function damageEnemy(e: Enemy, dmg: number, source?: TowerType): void {
  if (e.dead) return
  const now = performance.now() / 1000
  if (e.armorShred > 0 && now > e.armorShred) e.armorShred = 0
  let applied = dmg
  if (e.kind === 'armored' && e.armorShred <= 0 && source !== 'blaster') applied *= 0.6
  if (source === 'lance' && e.boss) applied *= 1.8
  if (source === 'mortar') e.armorShred = now + 3
  if (source === 'coil') e.slowUntil = now + 2
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, applied)
    e.shield -= absorbed
    applied -= absorbed
  }
  e.hp -= applied
  e.hpRatio = Math.max(0, e.hp / e.maxHp)
  writeEnemy(e)
  if (e.hp <= 0) {
    e.dead = true
    scrap += e.reward
    empCharge = Math.min(100, empCharge + (e.boss ? 30 : 6))
    spawnImpact(e.pos, ENEMY_COLORS[e.kind], e.boss ? 1.8 : 1)
    if (e.kind === 'splitter') {
      spawnEnemy('swarm', e.pos, e.pathIndex)
      spawnEnemy('swarm', e.pos, e.pathIndex)
    }
    removeEnemy(e)
  }
}

function placeTower(c: number, r: number): void {
  if (PATH_KEYS.has(key(c, r))) {
    toast('El camino está ocupado')
    return
  }
  if (towers.some(t => t.col === c && t.row === r)) {
    toast('Ya hay una torre acá')
    return
  }
  const def = TOWER_DEFS[selected]
  if (scrap < def.cost) {
    toast('No alcanza la chatarra')
    return
  }
  const slot = freeTowerSlots[selected].pop()
  const ringSlot = freeRingSlots.pop()
  if (slot === undefined || ringSlot === undefined) {
    toast('No hay espacio para más torres')
    return
  }
  scrap -= def.cost
  const pos = cellWorld(c, r)
  const tower: Tower = {
    type: selected, col: c, row: r, level: 1, cooldown: 0,
    pos, turn: 0, slot, ringSlot,
  }
  towers.push(tower)
  writeTower(tower)
  spawnImpact(pos.clone().setY(0.3), def.color, 0.8)
  inspectTower(tower)
}

function upgradeTower(t: Tower): void {
  if (t.level >= 3) {
    toast('Torre al máximo nivel')
    return
  }
  const cost = Math.round(TOWER_DEFS[t.type].cost * t.level * 0.8)
  if (scrap < cost) {
    toast(`Mejora cuesta ${cost} de chatarra`)
    return
  }
  scrap -= cost
  t.level++
  writeTower(t)
  spawnImpact(t.pos.clone().setY(0.4), 0xfacc15, 0.9)
  toast(`${TOWER_DEFS[t.type].name} nivel ${t.level}`)
  updateInspect()
}

function fire(t: Tower, target: Enemy): void {
  const def = TOWER_DEFS[t.type]
  const origin = t.pos.clone()
  origin.y = 0.95
  const slot = freeProjectileSlots.pop()
  if (slot === undefined) return
  const p: Projectile = {
    target,
    aim: target.pos.clone(),
    pos: origin,
    slot,
    size: t.type === 'mortar' ? 1 : 0.7,
    color: def.color,
    speed: t.type === 'mortar' ? 11 : 18,
    damage: def.damage * (1 + (t.level - 1) * 0.5),
    splash: def.splash > 0 ? def.splash + (t.level - 1) * 0.25 : 0,
    source: t.type,
  }
  writeProjectile(p)
  spawnMuzzle(origin, def.color)
  projectiles.push(p)
}

function updateWave(dt: number): void {
  if (phase === 'between') {
    intermission -= dt
    if (intermission <= 0) beginWave()
    return
  }
  if (phase !== 'playing') return

  if (spawnLeft > 0) {
    spawnTimer -= dt
    if (spawnTimer <= 0) {
      const queue = WAVES[wave - 1].queue
      spawnEnemy(queue[queue.length - spawnLeft])
      spawnLeft--
      spawnTimer = Math.max(0.35, 0.85 - wave * 0.02)
    }
  }

  if (spawnLeft === 0 && enemies.length === 0) {
    const interest = projectedInterest()
    const bonus = 10 + wave * 2 + interest
    scrap += bonus
    if (wave >= MAX_WAVES) {
      finish(true)
      return
    }
    phase = 'between'
    intermission = 3
    toast(`Oleada ${wave} completa · +${bonus} chatarra`)
  }
}

function updateEnemies(dt: number): void {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]
    if (e.dead) continue
    const nextIdx = e.pathIndex + 1
    if (nextIdx >= PATH.length) {
      reachCore(e)
      continue
    }
    instDir.copy(PATH_WORLD[nextIdx]).sub(e.pos)
    const d = instDir.length()
    const slowed = performance.now() / 1000 < e.slowUntil
    const step = e.speed * (slowed ? 0.5 : 1) * dt
    if (d <= step) {
      e.pos.copy(PATH_WORLD[nextIdx])
      e.pathIndex = nextIdx
      e.mesh.position.copy(e.pos)
      if (e.pathIndex >= PATH.length - 1) {
        reachCore(e)
        continue
      }
    } else {
      e.pos.addScaledVector(instDir, step / d)
      e.mesh.position.copy(e.pos)
      e.turn = Math.atan2(instDir.x, instDir.z)
    }
    writeEnemy(e)
  }
}

function updateTowers(dt: number): void {
  for (const t of towers) {
    t.cooldown -= dt
    const def = TOWER_DEFS[t.type]
    const range = def.range + (t.level - 1) * 0.35
    let target: Enemy | null = null
    let bestProgress = -1
    for (const e of enemies) {
      if (e.dead) continue
      const dx = e.pos.x - t.pos.x
      const dz = e.pos.z - t.pos.z
      if (dx * dx + dz * dz <= range * range && e.pathIndex > bestProgress) {
        target = e
        bestProgress = e.pathIndex
      }
    }
    if (target) {
      const turn = Math.atan2(target.pos.x - t.pos.x, target.pos.z - t.pos.z)
      if (Math.abs(turn - t.turn) > 0.001) {
        t.turn = turn
        writeTower(t)
      }
    }
    if (target && t.cooldown <= 0) {
      if (t.type === 'brake') {
        const now = performance.now() / 1000
        const dmg = def.damage * (1 + (t.level - 1) * 0.5)
        spawnImpact(t.pos.clone().setY(0.5), def.color, 1.5)
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j]
          if (e.dead) continue
          const dx = e.pos.x - t.pos.x
          const dz = e.pos.z - t.pos.z
          if (dx * dx + dz * dz <= range * range) {
            e.slowUntil = now + 1.3
            damageEnemy(e, dmg, 'brake')
          }
        }
      } else {
        fire(t, target)
      }
      t.cooldown = def.cooldown / (1 + (t.level - 1) * 0.18)
    }
  }
}

function updateProjectiles(dt: number): void {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    if (p.target && !p.target.dead) p.aim.copy(p.target.pos)
    p.aim.y = 0.5
    instDir.copy(p.aim).sub(p.pos)
    const dist = instDir.length()
    const step = p.speed * dt
    if (dist <= step) {
      if (p.splash > 0) {
        spawnImpact(p.aim, p.color, 1.7)
        for (let j = enemies.length - 1; j >= 0; j--) {
          const dx = enemies[j].pos.x - p.aim.x
          const dz = enemies[j].pos.z - p.aim.z
          if (dx * dx + dz * dz <= p.splash * p.splash) damageEnemy(enemies[j], p.damage, p.source)
        }
      } else if (p.target && !p.target.dead) {
        spawnImpact(p.aim, p.color, 0.8)
        damageEnemy(p.target, p.damage, p.source)
        if (p.source === 'coil') {
          let chained = 0
          for (let j = enemies.length - 1; j >= 0 && chained < 2; j--) {
            const other = enemies[j]
            if (other.dead || other === p.target) continue
            const dx = other.pos.x - p.aim.x
            const dz = other.pos.z - p.aim.z
            if (dx * dx + dz * dz <= 2.2 * 2.2) {
              damageEnemy(other, p.damage * 0.5, 'coil')
              spawnImpact(other.pos, p.color, 0.5)
              chained++
            }
          }
        }
      }
      hideSlot(projectileCores, p.slot)
      hideSlot(projectileHalos, p.slot)
      freeProjectileSlots.push(p.slot)
      projectiles.splice(i, 1)
    } else {
      p.pos.addScaledVector(instDir, step / dist)
      writeProjectile(p)
    }
  }
}

function fireEmp(): void {
  if (phase !== 'playing' || empCharge < 100) return
  empCharge = 0
  empPulse = 0.9
  spawnImpact(drone.position.clone(), 0x67e8f9, 3.4)
  const now = performance.now() / 1000
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]
    if (e.dead) continue
    e.slowUntil = now + 2.5
    spawnImpact(e.pos, 0x22d3ee, 1)
    damageEnemy(e, 45, 'blaster')
  }
  toast('¡EMP detonado!')
}

function updateTelegraph(): void {
  if (phase !== 'between' || wave >= MAX_WAVES) {
    telegraphEl.classList.add('hidden')
    return
  }
  const def = WAVES[wave]
  telegraphEl.classList.remove('hidden')
  telegraphEl.classList.toggle('alert', wave % 5 === 0)
  telegraphWaveEl.textContent = String(wave + 1)
  telegraphUnitsEl.textContent = def.segments
    .map(([kind, n]) => `${n}× ${ENEMY_NAMES[kind]}`)
    .join(' · ')
}

function refreshHud(): void {
  scrapEl.textContent = String(Math.floor(scrap))
  waveEl.textContent = `${Math.min(wave, MAX_WAVES)}/${MAX_WAVES}`
  coreEl.textContent = String(Math.max(0, lives))
  bestEl.textContent = best !== null ? String(best) : '—'
  interestEl.textContent = `${Math.round(INTEREST_RATE * 100)}% · +${projectedInterest()}`
  empEl.textContent = `${Math.floor(empCharge)}%`
  empBtn.disabled = phase !== 'playing' || empCharge < 100
  empBtn.classList.toggle('ready', empCharge >= 100)
  nextWaveBtn.disabled = phase !== 'between'
  updateTelegraph()
}

// --- Input

const raycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const pointerNdc = new THREE.Vector2()
const hitPoint = new THREE.Vector3()

function cellFromEvent(e: PointerEvent): { col: number; row: number } | null {
  pointerNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
  raycaster.setFromCamera(pointerNdc, camera)
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null
  const col = Math.round(hitPoint.x / CELL + (GRID_W - 1) / 2)
  const row = Math.round(hitPoint.z / CELL + (GRID_H - 1) / 2)
  if (col < 0 || col >= GRID_W || row < 0 || row >= GRID_H) return null
  return { col, row }
}

canvas.addEventListener('pointermove', (e) => {
  if (phase !== 'playing' && phase !== 'between') {
    ghost.visible = false
    return
  }
  const cell = cellFromEvent(e)
  if (!cell || PATH_KEYS.has(key(cell.col, cell.row)) || towers.some(t => t.col === cell.col && t.row === cell.row)) {
    ghost.visible = false
    return
  }
  const def = TOWER_DEFS[selected]
  const ok = scrap >= def.cost
  ghost.visible = true
  ghost.position.copy(cellWorld(cell.col, cell.row))
  ghostBase.material = basic(ok ? 0x4ade80 : 0xf87171, 0.38, true)
  ghostRange.material = basic(ok ? 0x7dd3fc : 0xf87171, 0.22, true)
  ghostRange.scale.setScalar(def.range)
})

canvas.addEventListener('pointerleave', () => { ghost.visible = false })

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  if (phase !== 'playing' && phase !== 'between') return
  const cell = cellFromEvent(e)
  if (!cell) return
  const existing = towers.find(t => t.col === cell.col && t.row === cell.row)
  if (existing) {
    inspectTower(existing)
    return
  }
  placeTower(cell.col, cell.row)
})

for (const btn of towerButtons) {
  btn.addEventListener('click', () => selectTower(btn.dataset.type as TowerType))
}

window.addEventListener('keydown', (e) => {
  if (e.key === '1') selectTower('blaster')
  else if (e.key === '2') selectTower('coil')
  else if (e.key === '3') selectTower('mortar')
  else if (e.key === '4') selectTower('brake')
  else if (e.key === '5') selectTower('lance')
  else if (e.key.toLowerCase() === 'e') fireEmp()
  else if (e.key.toLowerCase() === 'x' && inspected) sellTower(inspected)
})

nextWaveBtn.addEventListener('click', () => {
  if (phase !== 'between') return
  scrap += 5
  intermission = 0
  toast('+5 chatarra · ola adelantada')
})

empBtn.addEventListener('click', fireEmp)

upgradeBtn.addEventListener('click', () => {
  if (inspected) upgradeTower(inspected)
})
sellBtn.addEventListener('click', () => {
  if (inspected) sellTower(inspected)
})

for (const btn of mapButtons) {
  btn.addEventListener('click', () => applyMap(btn.dataset.map!))
}
refreshMapButtons()

playBtn.addEventListener('click', startGame)
restartBtn.addEventListener('click', startGame)

// --- Loop

const clock = new THREE.Clock()

function tick(): void {
  requestAnimationFrame(tick)
  const dt = Math.min(clock.getDelta(), 0.05)

  if (phase === 'playing' || phase === 'between') {
    updateWave(dt)
    updateEnemies(dt)
    updateTowers(dt)
    updateProjectiles(dt)
  }
  updateEffects(dt)

  const now = performance.now()
  coreOrb.rotation.y += dt * 0.8
  coreOrb.position.y = 1.62 + Math.sin(now * 0.003) * 0.08
  coreRing.rotation.z += dt * 0.55
  spawnRingA.rotation.z += dt * 0.9
  spawnRingB.rotation.z -= dt * 1.4
  spawnLight.intensity = 12 + Math.sin(now * 0.005) * 3
  coreLight.intensity = 16 + Math.sin(now * 0.004) * 4
  drone.position.y = 2.6 + Math.sin(now * 0.0025) * 0.16
  drone.rotation.y += dt * 0.35
  for (const rotor of droneRotors) rotor.rotation.y += dt * 8
  if (empPulse > 0) {
    empPulse = Math.max(0, empPulse - dt)
    drone.scale.setScalar(1 + empPulse * 0.9)
  } else if (drone.scale.x !== 1) {
    drone.scale.setScalar(1)
  }

  if (toastTimer > 0) {
    toastTimer -= dt
    if (toastTimer <= 0) toastEl.classList.remove('show')
  }

  refreshHud()
  composer.render()
}

refreshTowerButtons()
tick()
