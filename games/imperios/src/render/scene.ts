import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GRID, MAP_SIZE, TEAM_COLORS } from '../core/config'
import type { AnyEntity, BuildingEntity, ResourceEntity, Team, UnitEntity } from '../core/types'

/** How the observer perceives an entity under the fog of war. */
export type EntityVisibility = 'full' | 'ghost' | 'hidden'

export interface RenderContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  ground: THREE.Mesh
  grid: THREE.GridHelper
  selectionRing: THREE.Mesh
  placementGhost: THREE.Mesh
  entityMeshes: Map<number, THREE.Object3D>
  hpBars: Map<number, THREE.Sprite>
  prevPos: Map<number, { x: number; z: number }>
  sun: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  clock: THREE.Clock
  raycaster: THREE.Raycaster
  target: THREE.Vector3
  camYaw: number
  camPitch: number
  camDist: number
  markers: THREE.Group
  fx: THREE.Group
  composer: EffectComposer | null
  bloom: UnrealBloomPass | null
  /** Live VFX particles (tracers, impacts, death smoke). */
  fxItems: FxItem[]
  /** Recycled meshes per VFX kind: no per-shot allocation. */
  fxPool: Record<FxKind, THREE.Mesh[]>
  fxGeo: Record<FxKind, THREE.BufferGeometry>
  /** Shared "remembered but not seen" material for explored enemy buildings. */
  ghostMaterial: THREE.MeshBasicMaterial
  /** Terrain-hugging fog plane, textured from the team vision grid. */
  fogOverlay: THREE.Mesh
  fogTexture: THREE.CanvasTexture
  fogImage: ImageData
  fogCtx: CanvasRenderingContext2D
}

type FxKind = 'beam' | 'flash' | 'ring' | 'puff'

interface FxItem {
  kind: FxKind
  mesh: THREE.Mesh
  t: number
  life: number
  /** Anchor position; `puff` items drift from it along `vel`. */
  pos: THREE.Vector3
  vel: THREE.Vector3
  s0: number
  s1: number
  o0: number
}

/** Hard cap on simultaneous VFX so a big battle cannot tank the frame. */
const FX_MAX = 200

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return s - Math.floor(s)
}
function smoothstep(t: number): number { return t * t * (3 - 2 * t) }
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = smoothstep(xf), v = smoothstep(yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}
function fbm(x: number, y: number): number {
  let v = 0, amp = 0.5, freq = 1
  for (let i = 0; i < 4; i++) {
    v += amp * valueNoise(x * freq, y * freq)
    freq *= 2; amp *= 0.5
  }
  return v
}

export function terrainHeight(x: number, z: number): number {
  const base = fbm(x * 0.025, z * 0.025) * 6.5 - 2.0
  const macro = Math.sin(x * 0.035) * 1.8 + Math.cos(z * 0.03) * 1.2
  const plateau = Math.max(0, 1 - Math.abs(fbm(x * 0.012 + 10, z * 0.012 + 4) - 0.45) * 2.5) * 1.8
  const micro = fbm(x * 0.12, z * 0.12) * 0.6 - 0.3
  return base * 0.6 + macro * 0.3 + plateau + micro
}

function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x5d86b8) },
      mid: { value: new THREE.Color(0xbfd6eb) },
      hor: { value: new THREE.Color(0xe8c99a) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 hor;
      varying vec3 vPos;
      void main(){
        float h = normalize(vPos).y * 0.5 + 0.5;
        vec3 col = mix(hor, mid, smoothstep(0.35,0.65,h));
        col = mix(col, top, smoothstep(0.55,1.0,h));
        gl_FragColor = vec4(col,1.0);
      }
    `,
  })
}

export function createRender(canvas: HTMLCanvasElement): RenderContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfd6eb)
  scene.fog = new THREE.FogExp2(0xd7c6a8, 0.0018)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 700)

  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), skyMaterial())
  scene.add(sky)

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a3f2d, 0.45)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffe7c2, 2.25)
  sun.position.set(120, 55, 80)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const s = 110
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s; sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 320
  sun.shadow.bias = -0.00018
  sun.shadow.normalBias = 0.035
  scene.add(sun); scene.add(sun.target)
  const fill = new THREE.DirectionalLight(0x9fc0ff, 0.25)
  fill.position.set(-60, 50, -30)
  scene.add(fill)

  const seg = 128
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, seg, seg)
  const pos = groundGeo.attributes.position as THREE.BufferAttribute
  const colors: number[] = []
  const cLow = new THREE.Color(0x4a6b35)
  const cMid = new THREE.Color(0x6b7a42)
  const cHigh = new THREE.Color(0x8a7d5a)
  const cDirt = new THREE.Color(0x7a6240)
  const cRock = new THREE.Color(0x8a8a82)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i)
    const h = terrainHeight(x, y)
    pos.setZ(i, h)
  }
  groundGeo.computeVertexNormals()
  const norm = groundGeo.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), h = pos.getZ(i)
    const ny = norm.getY(i)
    const slope = 1 - Math.abs(ny)
    const n = THREE.MathUtils.clamp((h + 1.5) / 4.2, 0, 1)
    const c = cLow.clone().lerp(cMid, n).lerp(cHigh, Math.max(0, n - 0.55))
    c.lerp(cDirt, THREE.MathUtils.clamp(slope * 2.2, 0, 0.55))
    if (slope > 0.35) c.lerp(cRock, THREE.MathUtils.clamp((slope - 0.35) * 2, 0, 0.5))
    const patch = fbm(x * 0.06 + 20, y * 0.06 - 7)
    const patch2 = fbm(x * 0.15 + 50, y * 0.15 + 30)
    c.offsetHSL((patch - 0.5) * 0.05, (patch - 0.5) * 0.08, (patch2 - 0.5) * 0.08)
    const ao = THREE.MathUtils.clamp(0.72 + (h + 2.0) * 0.06 - slope * 0.3, 0.5, 1.0)
    c.multiplyScalar(ao)
    colors.push(c.r, c.g, c.b)
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 })
  groundMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       float gnoise = fract(sin(dot(vViewPosition.xz, vec2(12.9898,78.233))) * 43758.5453);
       diffuseColor.rgb += (gnoise - 0.5) * 0.03;`
    )
  }
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.name = 'ground'
  scene.add(ground)

  const grid = new THREE.GridHelper(MAP_SIZE, 45, 0x000000, 0x000000)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.0
  grid.position.y = 0.04
  grid.visible = false
  scene.add(grid)

  // Instanced grass patches for ambient density
  const grassGeo = new THREE.PlaneGeometry(0.4, 0.6)
  grassGeo.translate(0, 0.3, 0)
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x5a8a3a, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3,
    roughness: 0.9, metalness: 0
  })
  const grassCount = 8000
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount)
  const grassDummy = new THREE.Object3D()
  const grassColor = new THREE.Color()
  for (let i = 0; i < grassCount; i++) {
    const gx = (Math.random() - 0.5) * MAP_SIZE * 0.95
    const gz = (Math.random() - 0.5) * MAP_SIZE * 0.95
    const gy = terrainHeight(gx, gz)
    grassDummy.position.set(gx, gy, gz)
    grassDummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3)
    grassDummy.scale.setScalar(0.6 + Math.random() * 0.8)
    grassDummy.updateMatrix()
    grassMesh.setMatrixAt(i, grassDummy.matrix)
    grassColor.setHSL(0.25 + Math.random() * 0.08, 0.5 + Math.random() * 0.2, 0.3 + Math.random() * 0.15)
    grassMesh.setColorAt(i, grassColor)
  }
  grassMesh.receiveShadow = true
  scene.add(grassMesh)

  // Decorative rocks scattered on terrain
  const rockGeo = new THREE.IcosahedronGeometry(0.35, 1)
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a72, roughness: 0.95, metalness: 0.02, flatShading: true })
  const rockCount = 300
  const rocksMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount)
  const rockDummy = new THREE.Object3D()
  for (let i = 0; i < rockCount; i++) {
    const rx = (Math.random() - 0.5) * MAP_SIZE * 0.9
    const rz = (Math.random() - 0.5) * MAP_SIZE * 0.9
    const ry = terrainHeight(rx, rz)
    rockDummy.position.set(rx, ry, rz)
    rockDummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, 0)
    rockDummy.scale.setScalar(0.3 + Math.random() * 1.2)
    rockDummy.updateMatrix()
    rocksMesh.setMatrixAt(i, rockDummy.matrix)
  }
  rocksMesh.castShadow = true
  rocksMesh.receiveShadow = true
  scene.add(rocksMesh)

  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.5, 40),
    new THREE.MeshBasicMaterial({ color: 0x7dffb2, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  )
  selectionRing.rotation.x = -Math.PI / 2
  selectionRing.visible = false
  scene.add(selectionRing)

  const placementGhost = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x66ccff, transparent: true, opacity: 0.35, emissive: 0x224466, emissiveIntensity: 0.4 })
  )
  placementGhost.visible = false
  scene.add(placementGhost)

  const markers = new THREE.Group()
  scene.add(markers)
  const fx = new THREE.Group()
  scene.add(fx)

  // --- Fog of war overlay ------------------------------------------------
  // A second mesh sharing the ground geometry, lifted 1 unit so it hugs every
  // hill instead of clipping through it. The canvas holds one texel per nav
  // tile: UNKNOWN = opaque black, EXPLORED = 58% black, VISIBLE = clear.
  const fogCanvas = document.createElement('canvas')
  fogCanvas.width = GRID
  fogCanvas.height = GRID
  const fogCtx = fogCanvas.getContext('2d')!
  const fogImage = fogCtx.createImageData(GRID, GRID)
  const fogTexture = new THREE.CanvasTexture(fogCanvas)
  fogTexture.minFilter = THREE.LinearFilter
  fogTexture.magFilter = THREE.LinearFilter
  fogTexture.generateMipmaps = false
  const fogOverlay = new THREE.Mesh(
    groundGeo, // shared: same displacement, so the fog follows the terrain
    new THREE.MeshBasicMaterial({
      map: fogTexture,
      transparent: true,
      // depthTest off on purpose: the fog must paint over grass, rocks and
      // buildings, otherwise tall props poke through the black. It is drawn
      // at renderOrder 100, before sprites (200) and after all opaque meshes.
      depthWrite: false,
      depthTest: false,
      fog: false, // otherwise the scene fog tints "unknown" black into beige
      toneMapped: false,
    }),
  )
  fogOverlay.rotation.x = -Math.PI / 2
  fogOverlay.position.y = 0.9
  fogOverlay.renderOrder = 100
  fogOverlay.frustumCulled = false
  fogOverlay.name = 'fog'
  scene.add(fogOverlay)
  paintFogPixels(fogImage, null)

  // --- VFX assets (shared geometries, per-mesh materials for fading) ------
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true)
  beamGeo.rotateX(Math.PI / 2) // axis along +Z, length 1
  const ringGeo = new THREE.RingGeometry(0.62, 1, 28)
  ringGeo.rotateX(-Math.PI / 2)
  const fxGeo: Record<FxKind, THREE.BufferGeometry> = {
    beam: beamGeo,
    flash: new THREE.SphereGeometry(1, 10, 8),
    ring: ringGeo,
    puff: new THREE.SphereGeometry(1, 8, 6),
  }
  const fxPool: Record<FxKind, THREE.Mesh[]> = { beam: [], flash: [], ring: [], puff: [] }

  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0x93a4b4, transparent: true, opacity: 0.42, depthWrite: false,
  })

  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  try {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.35, 0.88)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  } catch {
    composer = null; bloom = null
  }

  const rc: RenderContext = {
    renderer, scene, camera, canvas, ground, grid, selectionRing, placementGhost,
    entityMeshes: new Map(), hpBars: new Map(), prevPos: new Map(),
    sun, fill, hemi, clock: new THREE.Clock(), raycaster: new THREE.Raycaster(),
    target: new THREE.Vector3(-48, 0, 4),
    camYaw: Math.PI * 0.25, camPitch: Math.PI / 3.25, camDist: 72,
    markers, fx, composer, bloom,
    fxItems: [], fxPool, fxGeo, ghostMaterial,
    fogOverlay, fogTexture, fogImage, fogCtx,
  }
  updateCamera(rc)
  return rc
}

// ---------------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------------

/**
 * Paints the fog canvas from a team vision grid (VIS_UNKNOWN / EXPLORED /
 * VISIBLE). Writes straight into the ImageData buffer, so a full 90x90 repaint
 * costs a few hundred microseconds — cheap enough for the 5 Hz refresh.
 */
export function paintFog(rc: RenderContext, grid: Uint8Array | null): void {
  paintFogPixels(rc.fogImage, grid)
  rc.fogCtx.putImageData(rc.fogImage, 0, 0)
  rc.fogTexture.needsUpdate = true
}

function paintFogPixels(image: ImageData, grid: Uint8Array | null): void {
  const data = image.data
  for (let i = 0; i < GRID * GRID; i++) {
    const v = grid ? grid[i] : 0
    const o = i * 4
    data[o] = 0
    data[o + 1] = 0
    data[o + 2] = 0
    // 0 = never seen (opaque), 1 = remembered (58% black), 2 = visible (clear)
    data[o + 3] = v >= 2 ? 0 : v === 1 ? 148 : 255
  }
}

export function updateCamera(rc: RenderContext): void {
  const { camera, target, camYaw, camPitch, camDist } = rc
  const y = Math.sin(camPitch) * camDist
  const flat = Math.cos(camPitch) * camDist
  camera.position.set(target.x + Math.cos(camYaw) * flat, y, target.z + Math.sin(camYaw) * flat)
  camera.lookAt(target)
  // keep sun direction stable-ish but near view
  rc.sun.position.set(target.x + 80, 120, target.z + 50)
  rc.sun.target.position.copy(target)
  rc.sun.target.updateMatrixWorld()
}

export function resize(rc: RenderContext): void {
  const w = window.innerWidth, h = window.innerHeight
  rc.camera.aspect = w / h
  rc.camera.updateProjectionMatrix()
  rc.renderer.setSize(w, h)
  rc.composer?.setSize(w, h)
}

export function groundHeightAt(x: number, z: number): number {
  return terrainHeight(x, z)
}

/** Canvas resolution of an HP bar; the on-screen size comes from the sprite scale. */
const HP_BAR_W = 128
const HP_BAR_H = 28

const VEHICLE_UNITS = new Set(['blindado', 'tanque', 'cazacarros', 'mlrs', 'canon', 'tanque_autonomo'])

/**
 * Sprite size/offset per entity: the bar is 45-60% of the silhouette width, so
 * it reads at a glance instead of being a hairline. Units are drawn inside a
 * group scaled 1.35, so their numbers are pre-divided by that factor.
 */
function hpBarSpec(e: AnyEntity): { w: number; h: number; y: number } {
  if (e.kind === 'building') {
    const y = e.btype === 'torre' ? 6.5
      : e.btype === 'ayuntamiento' ? 6.3
      : e.btype === 'fabrica' ? 5.0
      : e.btype === 'cuartel' ? 3.9
      : e.btype === 'vivienda' ? 3.4
      : 2.9
    return { w: 5.6, h: 0.72, y }
  }
  if (e.kind === 'unit') {
    return VEHICLE_UNITS.has(e.utype)
      ? { w: 2.05, h: 0.6, y: 2.1 }
      : { w: 1.65, h: 0.5, y: 1.72 }
  }
  return { w: 2.2, h: 0.5, y: 2 }
}

function makeHpSprite(e: AnyEntity): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = HP_BAR_W
  c.height = HP_BAR_H
  const ctx = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })
  const sp = new THREE.Sprite(mat)
  const spec = hpBarSpec(e)
  sp.scale.set(spec.w, spec.h, 1)
  sp.position.set(0, spec.y, 0)
  sp.renderOrder = 200 // on top of the fog overlay
  sp.name = 'hpbar'
  const anySp = sp as any
  anySp._canvas = c
  anySp._ctx = ctx
  anySp._tex = tex
  return sp
}

/**
 * Redraws the bar: team colour (player green / enemy red), amber below 35% HP,
 * dark frame so it stays readable over grass, snow and buildings.
 */
export function updateHpSprite(sp: THREE.Sprite, ratio: number, team: Team = 'player'): void {
  const anySp = sp as any
  const r = Math.max(0, Math.min(1, ratio))
  const rq = Math.round(r * 100) / 100
  if (anySp._ratio === rq && anySp._team === team) return // texture upload is the cost
  anySp._ratio = rq
  anySp._team = team

  const ctx = anySp._ctx as CanvasRenderingContext2D
  const tex = anySp._tex as THREE.CanvasTexture
  const w = HP_BAR_W, h = HP_BAR_H
  ctx.clearRect(0, 0, w, h)
  // frame + track
  ctx.fillStyle = 'rgba(6,8,10,0.88)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(38,46,54,0.98)'
  ctx.fillRect(3, 3, w - 6, h - 6)
  // fill
  ctx.fillStyle = rq < 0.35 ? '#e8c341' : team === 'player' ? '#58d05e' : '#e05555'
  const fw = Math.round((w - 6) * r)
  if (fw > 0) {
    ctx.fillRect(3, 3, fw, h - 6)
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillRect(3, 3, fw, Math.max(2, Math.round((h - 6) * 0.33)))
  }
  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, w - 2, h - 2)
  tex.needsUpdate = true
}

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.12, ...opts })
}
function paintMat(color: number, rough = 0.55, metal = 0.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
}

function addContactShadow(g: THREE.Group, radius: number, opacity = 0.28): void {
  const s = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false })
  )
  s.rotation.x = -Math.PI / 2
  s.position.y = 0.03
  s.name = 'blob'
  g.add(s)
}

function addTeamBase(g: THREE.Group, team: 'player' | 'enemy', radius: number): void {
  const c = TEAM_COLORS[team]
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.78, radius, 28), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.045
  ring.name = 'teamring'
  g.add(ring)
}

function addTracks(g: THREE.Group, halfW: number, len: number): void {
  for (const sx of [-halfW, halfW]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, len), paintMat(0x2e3238, 0.85, 0.15))
    track.position.set(sx, 0.3, 0); track.castShadow = true; track.receiveShadow = true; g.add(track)
    for (let i = -2; i <= 2; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 10), mat(0x1e2124, { roughness: 0.9, metalness: 0.05 }))
      w.rotation.z = Math.PI / 2; w.position.set(sx, 0.3, i * (len / 5.2)); g.add(w)
    }
  }
}

function teamStripe(g: THREE.Group, teamC: number, w: number, y: number, z: number): void {
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.45), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.1 }))
  stripe.position.set(0, y, z)
  g.add(stripe)
}

export function createMeshForEntity(e: AnyEntity): THREE.Object3D {
  if (e.kind === 'unit') { const g = createUnitMesh(e); g.scale.setScalar(1.35); return g }
  if (e.kind === 'building') return createBuildingMesh(e)
  return createResourceMesh(e)
}

function createUnitMesh(u: UnitEntity): THREE.Object3D {
  const g = new THREE.Group()
  const teamC = TEAM_COLORS[u.team]
  if (u.utype === 'ingeniero') {
    addContactShadow(g, 0.55, 0.38)
    addTeamBase(g, u.team, 0.55)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 8), mat(0x7b6a52, { roughness: 0.9 }))
    body.position.y = 0.52; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), mat(0xe0c8a8, { roughness: 0.85 }))
    head.position.y = 1.0; head.castShadow = true; g.add(head)
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 10), paintMat(teamC, 0.6, 0.1))
    hat.position.y = 1.18; hat.castShadow = true; g.add(hat)
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), mat(0x5a4634))
    tool.position.set(0.28, 0.65, 0.18); tool.rotation.z = -0.5; tool.castShadow = true; g.add(tool)
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.18), mat(0x5a4a3a))
    bag.position.set(-0.18, 0.5, -0.05); g.add(bag)
  } else if (u.utype === 'milicia') {
    addContactShadow(g, 0.6, 0.40)
    addTeamBase(g, u.team, 0.62)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.62, 4, 8), paintMat(teamC, 0.7, 0.1))
    body.position.y = 0.62; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0xdfc7a0, { roughness: 0.85 }))
    head.position.y = 1.18; head.castShadow = true; g.add(head)
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), paintMat(0x5b6675, 0.5, 0.25))
    helm.position.y = 1.22; helm.castShadow = true; g.add(helm)
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.95), mat(0x3a2f22, { roughness: 0.7 }))
    rifle.position.set(0.28, 0.85, 0.28); rifle.castShadow = true; g.add(rifle)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.34), paintMat(teamC, 0.55, 0.1))
    band.position.y = 0.95; g.add(band)
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.16), mat(0x4a5545))
    pack.position.set(0, 0.75, -0.22); g.add(pack)
  } else if (u.utype === 'fusilero') {
    addContactShadow(g, 0.58, 0.40)
    addTeamBase(g, u.team, 0.6)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), paintMat(teamC, 0.7, 0.1))
    body.position.y = 0.58; body.rotation.x = 0.12; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), mat(0xdfc7a0))
    head.position.set(0, 1.08, 0.08); head.castShadow = true; g.add(head)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 10), paintMat(0x3f4a3b, 0.7, 0.05))
    cap.position.set(0, 1.24, 0.08); g.add(cap)
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 1.25), paintMat(0x2b2b2b, 0.45, 0.35))
    gun.position.set(0.22, 0.88, 0.45); gun.castShadow = true; g.add(gun)
    const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), paintMat(0x222, 0.3, 0.5))
    optic.rotation.z = Math.PI / 2; optic.position.set(0.22, 0.98, 0.25); g.add(optic)
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.3), paintMat(teamC, 0.55, 0.1))
    mark.position.set(0, 0.88, 0.04); g.add(mark)
  } else if (u.utype === 'granadero') {
    addContactShadow(g, 0.58, 0.40)
    addTeamBase(g, u.team, 0.6)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.58, 4, 8), paintMat(teamC, 0.7, 0.1))
    body.position.y = 0.6; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0xdfc7a0, { roughness: 0.85 }))
    head.position.y = 1.16; head.castShadow = true; g.add(head)
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), paintMat(0x4a5240, 0.6, 0.2))
    helm.position.y = 1.2; helm.castShadow = true; g.add(helm)
    for (let i = 0; i < 3; i++) {
      const nade = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), paintMat(0x39422f, 0.6, 0.3))
      nade.position.set(-0.3, 0.92 - i * 0.17, 0.18); g.add(nade)
    }
    const shotgun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.7), mat(0x3a2f22, { roughness: 0.7 }))
    shotgun.position.set(0.3, 0.82, 0.32); shotgun.castShadow = true; g.add(shotgun)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.34), paintMat(teamC, 0.55, 0.1))
    band.position.y = 0.82; g.add(band)
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.18), mat(0x4a5545))
    pack.position.set(0, 0.72, -0.24); g.add(pack)
  } else if (u.utype === 'francotirador') {
    addContactShadow(g, 0.55, 0.38)
    addTeamBase(g, u.team, 0.58)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.52, 4, 8), paintMat(0x4a5240, 0.75, 0.08))
    body.position.y = 0.56; body.rotation.x = 0.15; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(0xd8c09c))
    head.position.set(0, 1.04, 0.08); head.castShadow = true; g.add(head)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.13, 10), paintMat(0x39422f, 0.7, 0.05))
    cap.position.set(0, 1.2, 0.08); g.add(cap)
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.75), paintMat(0x242424, 0.45, 0.35))
    rifle.position.set(0.2, 0.88, 0.55); rifle.castShadow = true; g.add(rifle)
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 8), paintMat(0x1a1a1a, 0.3, 0.55))
    scope.rotation.x = Math.PI / 2; scope.position.set(0.2, 0.99, 0.32); g.add(scope)
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.28), paintMat(teamC, 0.55, 0.1))
    mark.position.set(0, 0.82, 0.02); g.add(mark)
  } else if (u.utype === 'inf_mecanizada') {
    addContactShadow(g, 0.62, 0.42)
    addTeamBase(g, u.team, 0.64)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.6, 4, 8), paintMat(teamC, 0.7, 0.1))
    body.position.y = 0.62; body.castShadow = true; g.add(body)
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.42), paintMat(0x3c443c, 0.6, 0.25))
    vest.position.y = 0.88; vest.castShadow = true; g.add(vest)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0xdfc7a0, { roughness: 0.85 }))
    head.position.y = 1.2; head.castShadow = true; g.add(head)
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), paintMat(0x39422f, 0.5, 0.3))
    helm.position.y = 1.24; helm.castShadow = true; g.add(helm)
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 1.1), paintMat(0x2b2b2b, 0.45, 0.35))
    rifle.position.set(0.28, 0.92, 0.38); rifle.castShadow = true; g.add(rifle)
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.3), paintMat(teamC, 0.55, 0.1))
    mark.position.set(0, 1.12, 0.02); g.add(mark)
  } else if (u.utype === 'blindado') {
    addContactShadow(g, 1.25, 0.45)
    addTeamBase(g, u.team, 1.25)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.5), paintMat(0x596452, 0.55, 0.25))
    hull.position.y = 0.55; hull.castShadow = true; hull.receiveShadow = true; g.add(hull)
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 0.5), paintMat(0x525c4b, 0.55, 0.25))
    front.position.set(0, 0.52, 1.25); front.rotation.x = -0.35; g.add(front)
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.38, 12), paintMat(0x4d5747, 0.5, 0.28))
    turret.position.y = 1.0; turret.castShadow = true; turret.name = 'turret'; g.add(turret)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.5, 8), paintMat(0x2a2a2a, 0.35, 0.45))
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.0, 1.15); barrel.name = 'barrel'; g.add(barrel)
    for (let i = -2; i <= 2; i++) {
      const wheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), mat(0x222, { roughness: 0.9, metalness: 0.05 }))
      wheelL.rotation.z = Math.PI / 2; wheelL.position.set(-0.86, 0.28, i * 0.5); g.add(wheelL)
      const wheelR = wheelL.clone(); wheelR.position.x = 0.86; g.add(wheelR)
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.06, 0.45), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.1 }))
    stripe.position.set(0, 0.78, 0); g.add(stripe)
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), mat(0x333))
    antenna.position.set(-0.45, 1.45, -0.4); g.add(antenna)
  } else if (u.utype === 'tanque') {
    addContactShadow(g, 1.5, 0.45)
    addTeamBase(g, u.team, 1.45)
    addTracks(g, 1.05, 3.1)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 3.0), paintMat(0x4d5a3e, 0.55, 0.25))
    hull.position.y = 0.78; hull.castShadow = true; hull.receiveShadow = true; g.add(hull)
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 0.6), paintMat(0x46523a, 0.55, 0.25))
    glacis.position.set(0, 0.78, 1.55); glacis.rotation.x = -0.5; g.add(glacis)
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.5, 12), paintMat(0x44503a, 0.5, 0.28))
    turret.position.y = 1.32; turret.castShadow = true; turret.name = 'turret'; g.add(turret)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 8), paintMat(0x2a2a2a, 0.35, 0.45))
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.32, 1.65); barrel.name = 'barrel'; g.add(barrel)
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), paintMat(0x39422f, 0.55, 0.3))
    hatch.position.set(-0.25, 1.62, -0.15); g.add(hatch)
    teamStripe(g, teamC, 1.95, 1.02, -0.6)
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), mat(0x333))
    antenna.position.set(-0.6, 1.9, -1.1); g.add(antenna)
  } else if (u.utype === 'cazacarros') {
    addContactShadow(g, 1.35, 0.45)
    addTeamBase(g, u.team, 1.35)
    addTracks(g, 1.0, 2.9)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.8), paintMat(0x5a5f4a, 0.55, 0.25))
    hull.position.y = 0.72; hull.castShadow = true; hull.receiveShadow = true; g.add(hull)
    const superstructure = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.8), paintMat(0x525742, 0.55, 0.25))
    superstructure.position.set(0, 1.18, -0.25); superstructure.rotation.x = -0.12; superstructure.castShadow = true; g.add(superstructure)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), paintMat(0x2a2a2a, 0.35, 0.45))
    barrel.rotation.x = Math.PI / 2 - 0.06; barrel.position.set(0, 1.28, 1.5); g.add(barrel)
    const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 8), paintMat(0x222, 0.4, 0.5))
    brake.rotation.x = Math.PI / 2; brake.position.set(0, 1.32, 2.6); g.add(brake)
    teamStripe(g, teamC, 1.85, 0.95, -0.9)
  } else if (u.utype === 'mlrs') {
    addContactShadow(g, 1.35, 0.45)
    addTeamBase(g, u.team, 1.35)
    addTracks(g, 1.0, 2.7)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.6, 2.6), paintMat(0x4a5340, 0.55, 0.25))
    hull.position.y = 0.75; hull.castShadow = true; hull.receiveShadow = true; g.add(hull)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), paintMat(0x424b38, 0.55, 0.25))
    cab.position.set(0, 1.3, 0.95); cab.castShadow = true; g.add(cab)
    for (const sx of [-0.5, 0.5]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 1.7), paintMat(0x39422f, 0.5, 0.3))
      pod.position.set(sx, 1.42, -0.65); pod.rotation.x = 0.12; pod.castShadow = true; g.add(pod)
      for (let r = 0; r < 2; r++) for (let c2 = 0; c2 < 3; c2++) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 8), paintMat(0x1c1f22, 0.4, 0.5))
        tube.rotation.x = Math.PI / 2 + 0.12
        tube.position.set(sx - 0.22 + r * 0.44, 1.28 + c2 * 0.2, -1.52)
        g.add(tube)
      }
    }
    teamStripe(g, teamC, 1.9, 1.0, 0.2)
  } else if (u.utype === 'canon') {
    addContactShadow(g, 1.2, 0.42)
    addTeamBase(g, u.team, 1.15)
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 2.3), paintMat(0x5a4a36, 0.7, 0.15))
    carriage.position.y = 0.55; carriage.castShadow = true; g.add(carriage)
    for (const sx of [-0.95, 0.95]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.16, 14), mat(0x2c2c2c, { roughness: 0.9, metalness: 0.05 }))
      wheel.rotation.z = Math.PI / 2; wheel.position.set(sx, 0.72, 0.1); wheel.castShadow = true; g.add(wheel)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 10), paintMat(0x8a6f4a, 0.6, 0.2))
      hub.rotation.z = Math.PI / 2; hub.position.set(sx, 0.72, 0.1); g.add(hub)
    }
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.08), paintMat(0x555e4c, 0.55, 0.3))
    shield.position.set(0, 1.15, 0.55); shield.rotation.x = -0.18; shield.castShadow = true; g.add(shield)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.6, 10), paintMat(0x2f3438, 0.4, 0.5))
    barrel.rotation.x = Math.PI / 2 - 0.18; barrel.position.set(0, 1.42, 1.35); barrel.castShadow = true; g.add(barrel)
    teamStripe(g, teamC, 1.2, 0.78, -0.7)
  } else if (u.utype === 'tanque_autonomo') {
    addContactShadow(g, 1.45, 0.45)
    addTeamBase(g, u.team, 1.4)
    addTracks(g, 1.02, 3.0)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 2.9), paintMat(0x2f3a44, 0.35, 0.5))
    hull.position.y = 0.75; hull.castShadow = true; hull.receiveShadow = true; g.add(hull)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), paintMat(0x35424e, 0.3, 0.55))
    nose.scale.set(1.05, 0.42, 1.1); nose.position.set(0, 0.82, 1.1); nose.castShadow = true; g.add(nose)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), paintMat(0x2b353e, 0.3, 0.6))
    dome.position.y = 1.02; dome.castShadow = true; dome.name = 'turret'; g.add(dome)
    for (const sx of [-0.22, 0.22]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 8), paintMat(0x1f262c, 0.3, 0.6))
      barrel.rotation.x = Math.PI / 2; barrel.position.set(sx, 1.18, 1.15); g.add(barrel)
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.2 }))
    core.position.set(0, 1.35, 0); g.add(core)
    for (const sx of [-0.75, 0.75]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 0.9 }))
      light.position.set(sx, 0.95, 1.75); g.add(light)
    }
    teamStripe(g, teamC, 1.9, 0.98, -0.9)
  } else { // dron
    addContactShadow(g, 0.75, 0.22)
    addTeamBase(g, u.team, 0.85)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.85), paintMat(0x333c44, 0.4, 0.5))
    body.castShadow = true; g.add(body)
    for (const [ax, az] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.12), paintMat(0x2a3238, 0.4, 0.5))
      arm.position.set(ax * 0.42, 0.05, az * 0.32)
      arm.rotation.y = Math.atan2(ax, az) + Math.PI / 2
      arm.castShadow = true
      g.add(arm)
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x22282c, transparent: true, opacity: 0.55, roughness: 0.4, metalness: 0.3 }))
      rotor.position.set(ax * 0.72, 0.16, az * 0.52)
      rotor.name = 'rotor'
      g.add(rotor)
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff8866, emissive: 0xff5533, emissiveIntensity: 1.3 }))
    eye.position.set(0, -0.02, 0.48); g.add(eye)
    teamStripe(g, teamC, 0.5, 0.16, -0.3)
  }
  const sel = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0x7dffb2, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }))
  sel.rotation.x = -Math.PI / 2; sel.position.y = 0.06; sel.name = 'sel'; sel.visible = false; g.add(sel)
  return g
}

function buildingBase(x: number, z: number, h: number, color: number, teamC: number): THREE.Group {
  const g = new THREE.Group()
  addContactShadow(g, Math.max(x, z) * 0.65, 0.26)
  const platform = new THREE.Mesh(new THREE.BoxGeometry(x + 0.6, 0.22, z + 0.6), mat(0x8a7e6e, { roughness: 0.95 }))
  platform.position.y = 0.11; platform.receiveShadow = true; platform.castShadow = true; g.add(platform)
  const base = new THREE.Mesh(new THREE.BoxGeometry(x, h, z), mat(color, { roughness: 0.88, metalness: 0.05 }))
  base.position.y = h / 2; base.castShadow = true; base.receiveShadow = true; g.add(base)
  const trim = new THREE.Mesh(new THREE.BoxGeometry(x + 0.12, 0.16, z + 0.12), paintMat(teamC, 0.5, 0.15))
  trim.position.y = Math.min(h - 0.15, h * 0.7); g.add(trim)
  return g
}

function createBuildingMesh(b: BuildingEntity): THREE.Object3D {
  const teamC = TEAM_COLORS[b.team]
  const sz = ({ ayuntamiento: {x:8,z:8}, vivienda:{x:4,z:4}, cuartel:{x:6,z:6}, almacen:{x:4,z:4}, fabrica:{x:8,z:6}, torre:{x:3,z:3} } as any)[b.btype]
  let g: THREE.Group
  if (b.btype === 'ayuntamiento') {
    g = buildingBase(sz.x, sz.z, 2.4, 0x78695a, teamC)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.9, 2.6, 4), mat(0x5b4636, { roughness: 0.9 }))
    roof.position.y = 3.7; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 4.8, 8), mat(0x8a7a66))
    tower.position.set(2.5, 2.4, -2.5); tower.castShadow = true; g.add(tower)
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.1, 8), mat(0x4a3c32))
    towerRoof.position.set(2.5, 5.3, -2.5); g.add(towerRoof)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), mat(0x444))
    pole.position.set(2.5, 6.2, -2.5); g.add(pole)
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.12, side: THREE.DoubleSide }))
    banner.position.set(3.05, 6.4, -2.5); g.add(banner)
    for (const [dx] of [[-2, 2], [0, 2], [2, 2]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0xbfd8f2, emissive: 0x6aa0c8, emissiveIntensity: 0.2, roughness: 0.2, metalness: 0.1 }))
      w.position.set(dx, 1.4, sz.z/2 + 0.02); g.add(w)
    }
  } else if (b.btype === 'vivienda') {
    g = buildingBase(sz.x, sz.z, 1.7, 0xb39a78, teamC)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.7, 4), mat(0x7a5a3e))
    roof.position.y = 2.55; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.1), mat(0x4a3828))
    door.position.set(0, 0.5, sz.z/2 + 0.06); g.add(door)
  } else if (b.btype === 'cuartel') {
    g = buildingBase(sz.x, sz.z, 2.0, 0x5b6674, teamC)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(sz.x + 0.5, 0.35, sz.z + 0.5), mat(0x404854))
    roof.position.y = 2.15; roof.castShadow = true; g.add(roof)
    const gate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.15), mat(0x2a2f36))
    gate.position.set(0, 0.6, sz.z/2 + 0.08); g.add(gate)
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.12), paintMat(teamC, 0.5, 0.2))
    emblem.position.set(0, 1.55, sz.z/2 + 0.08); g.add(emblem)
  } else if (b.btype === 'fabrica') {
    g = buildingBase(sz.x, sz.z, 2.2, 0x6b7280, teamC)
    for (let i = -1; i <= 1; i++) {
      const saw = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, sz.z + 0.3), mat(0x4a5561))
      saw.position.set(i * 2.6, 2.75, 0); saw.rotation.x = 0.32; saw.castShadow = true; g.add(saw)
    }
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.68, 3.8, 10), mat(0x7a6a58))
    chimney.position.set(-sz.x / 2 + 1.1, 3.9, -sz.z / 2 + 1.1); chimney.castShadow = true; g.add(chimney)
    const gate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.9, 0.15), mat(0x2f3640))
    gate.position.set(0, 0.95, sz.z / 2 + 0.08); g.add(gate)
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.12), paintMat(teamC, 0.5, 0.2))
    emblem.position.set(0, 2.05, sz.z / 2 + 0.08); g.add(emblem)
    for (let i = -1; i <= 1; i += 2) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat(0x8f7350))
      crate.position.set(i * 2.6, 0.3, sz.z / 2 + 1.0); crate.castShadow = true; g.add(crate)
    }
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, sz.x * 0.7, 8), paintMat(0x535c66, 0.5, 0.35))
    pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 2.35, -sz.z / 2 - 0.2); g.add(pipe)
  } else if (b.btype === 'almacen') {
    g = buildingBase(sz.x, sz.z, 1.5, 0x8a7458, teamC)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(sz.x + 0.3, 0.3, sz.z + 0.3), mat(0x5e4a38))
    roof.position.y = 1.65; g.add(roof)
    for (let i = -1; i <= 1; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), mat(0x8f7350))
      crate.position.set(i * 0.9, 0.25, sz.z/2 + 0.7); crate.castShadow = true; g.add(crate)
    }
  } else { // torre
    g = new THREE.Group()
    addContactShadow(g, 1.7, 0.3)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.75, 4.2, 12), mat(0x8a7e6e, { roughness: 0.95 }))
    base.position.y = 2.1; base.castShadow = true; base.receiveShadow = true; g.add(base)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 12), paintMat(teamC, 0.5, 0.15))
    rim.position.y = 4.4; rim.castShadow = true; g.add(rim)
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const crenel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), mat(0x9a8e7c))
      crenel.position.set(Math.cos(ang) * 1.38, 4.9, Math.sin(ang) * 1.38); crenel.rotation.y = -ang; crenel.castShadow = true; g.add(crenel)
    }
    const mount = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), paintMat(0x444c55, 0.5, 0.3))
    mount.position.y = 4.85; g.add(mount)
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.0, 8), paintMat(0x2a2a2a, 0.35, 0.5))
    gun.rotation.x = Math.PI / 2 - 0.55; gun.position.set(0, 5.15, 0.85); gun.castShadow = true; g.add(gun)
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), mat(0x444))
    flagPole.position.set(-0.6, 5.5, -0.5); g.add(flagPole)
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.12, side: THREE.DoubleSide }))
    flag.position.set(-0.22, 5.85, -0.5); g.add(flag)
  }
  const sel = new THREE.Mesh(new THREE.RingGeometry(Math.max(sz.x,sz.z)*0.58, Math.max(sz.x,sz.z)*0.66, 32), new THREE.MeshBasicMaterial({ color: teamC, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }))
  sel.rotation.x = -Math.PI / 2; sel.position.y = 0.05; sel.name = 'sel'; sel.visible = false; g.add(sel)
  g.userData.kind = 'building'
  return g
}

function createResourceMesh(r: ResourceEntity): THREE.Object3D {
  const g = new THREE.Group()
  addContactShadow(g, r.rtype === 'granja' ? 2.2 : 1.6, 0.18)
  if (r.rtype === 'bosque') {
    const count = 14
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (i%3)*0.4
      const rad = 0.3 + (i%4)*0.45
      const h = 1.2 + (i%3)*0.35
      const tx = Math.cos(ang)*rad, tz = Math.sin(ang)*rad
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, h, 5), mat(0x5a3e24))
      trunk.position.set(tx, h/2, tz); trunk.castShadow = true; g.add(trunk)
      const canopy1 = new THREE.Mesh(new THREE.ConeGeometry(0.55 + (i%2)*0.15, 1.2 + (i%2)*0.3, 6), mat(i%3===0?0x2a5c2e:0x347a3a))
      canopy1.position.set(tx, h + 0.5, tz); canopy1.castShadow = true; g.add(canopy1)
      const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + (i%3)*0.1, 1), mat(0x3a6e38))
      canopy2.position.set(tx + 0.15, h + 1.0, tz - 0.1); canopy2.castShadow = true; g.add(canopy2)
    }
  } else if (r.rtype === 'granja') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 4.2), mat(0x73563a))
    base.position.y = 0.11; base.receiveShadow = true; g.add(base)
    for (let i = 0; i < 5; i++) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 0.32), mat(i%2?0xa7c756:0x7ea83f, { roughness: 0.95 }))
      row.position.set(0, 0.27, -1.4 + i*0.7); g.add(row)
    }
    const fenceMat = mat(0x8b7355)
    for (const sx of [-2.1, 2.1]) for (let k=0;k<3;k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,6), fenceMat)
      post.position.set(sx, 0.35, -1.4 + k*1.4); g.add(post)
    }
  } else if (r.rtype === 'petroleo') {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.35, 12), paintMat(0x4a4e52, 0.7, 0.2))
    pad.position.y = 0.18; pad.receiveShadow = true; g.add(pad)
    const derrick = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.4, 4), paintMat(0x2f3640, 0.55, 0.35))
    derrick.position.y = 1.85; derrick.castShadow = true; g.add(derrick)
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.28), paintMat(0x222, 0.5, 0.3))
    beam.position.set(0.2, 2.7, 0); beam.name = 'pump'; g.add(beam)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 10), paintMat(0x3a4048, 0.5, 0.25))
    tank.position.set(-1.0, 0.5, 0.8); g.add(tank)
  } else { // mina
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 0), mat(0x757980, { roughness: 0.98 }))
    rock.position.y = 1.15; rock.castShadow = true; rock.receiveShadow = true; g.add(rock)
    const rock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), mat(0x676b72, { roughness: 0.98 }))
    rock2.position.set(1.1, 0.75, 0.6); rock2.castShadow = true; g.add(rock2)
    const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), paintMat(0xb8c6d8, 0.35, 0.4))
    ore.position.set(0.5, 1.7, 0.5); g.add(ore)
    const ore2 = ore.clone(); ore2.position.set(-0.4, 1.55, 0.9); ore2.scale.setScalar(0.7); g.add(ore2)
  }
  g.userData.kind = 'resource'
  return g
}

function applyEraDetails(obj: THREE.Object3D, e: AnyEntity, era: number): void {
  const o = obj as any
  if (era >= 2 && !o._era2 && e.kind === 'building') {
    o._era2 = true
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.45), paintMat(0x4b5563, 0.45, 0.3))
    vent.position.set(0.9, 0.28, 0.9)
    vent.castShadow = true
    obj.add(vent)
  }
  if (era >= 3 && !o._era3 && e.kind === 'unit' && e.utype === 'blindado') {
    o._era3 = true
    const teamC = TEAM_COLORS[e.team]
    const sensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.4 }),
    )
    sensor.position.set(0.35, 1.22, -0.2)
    obj.add(sensor)
  }
  if (era >= 4 && !o._era4) {
    o._era4 = true
    if (e.kind === 'building') {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.06, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.2 }),
      )
      strip.position.set(0, 1.2, 1.3)
      obj.add(strip)
    } else if (e.kind === 'unit') {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.1 }),
      )
      core.position.set(0, 1.0, 0.15)
      obj.add(core)
    }
  }
}

/**
 * Swaps a whole entity to the shared "ghost" material (remembered enemy
 * building seen through the fog) and restores the originals afterwards. Only
 * runs on transitions, never per frame.
 */
function applyGhost(rc: RenderContext, obj: THREE.Object3D, ghost: boolean): void {
  obj.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (!mesh.isMesh) return
    const ud = mesh.userData
    if (ghost) {
      if (!ud.origMaterial) {
        ud.origMaterial = mesh.material
        mesh.material = rc.ghostMaterial
      }
    } else if (ud.origMaterial) {
      mesh.material = ud.origMaterial
      ud.origMaterial = undefined
    }
  })
}

export function syncEntityMesh(
  rc: RenderContext,
  e: AnyEntity,
  dt: number,
  era = 1,
  vis: EntityVisibility = 'full',
): void {
  // hidden by the fog: keep (or start) invisible without paying for a mesh
  if (vis === 'hidden') {
    const hidden = rc.entityMeshes.get(e.id)
    if (hidden) hidden.visible = false
    return
  }

  let obj = rc.entityMeshes.get(e.id)
  if (!obj) {
    obj = createMeshForEntity(e)
    rc.scene.add(obj)
    rc.entityMeshes.set(e.id, obj)
  }
  obj.visible = true
  const ghosted = vis === 'ghost'
  applyGhost(rc, obj, ghosted)
  applyEraDetails(obj, e, era)
  const gy = groundHeightAt(e.x, e.z)
  obj.position.set(e.x, gy, e.z)

  // facing and simple animation
  const prev = rc.prevPos.get(e.id)
  if (e.kind === 'unit') {
    const u = e as UnitEntity
    if (prev) {
      const dx = e.x - prev.x, dz = e.z - prev.z
      if (dx*dx + dz*dz > 0.0004) {
        const targetYaw = Math.atan2(dx, dz)
        obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, targetYaw, 0.18)
      }
    }
    const moving = (e as any).path?.length > 0 || (u.state === 'move' || u.state === 'gather' || u.state === 'return' || u.state === 'attack')
    const t = rc.clock.elapsedTime
    const isVehicle = u.utype === 'blindado' || u.utype === 'tanque' || u.utype === 'cazacarros' || u.utype === 'mlrs' || u.utype === 'canon' || u.utype === 'tanque_autonomo'
    if (u.utype === 'dron') {
      obj.position.y = gy + 2.1 + Math.sin(t * 2 + e.id) * 0.22
      obj.rotation.z = moving ? Math.sin(t * 6 + e.id) * 0.12 : 0
      const blob = obj.getObjectByName('blob')
      if (blob) blob.position.y = -2.07
      obj.children.forEach(ch => { if (ch.name === 'rotor') ch.rotation.y += dt * 28 })
    } else if (isVehicle) {
      obj.children.forEach(ch => { if ((ch as THREE.Mesh).geometry?.type === 'CylinderGeometry' && ch.position.y < 0.4) ch.rotation.x += moving ? dt * 6 : 0 })
      obj.position.y = gy + (moving ? Math.sin(t * 18) * 0.015 : 0)
      const turret = obj.getObjectByName('turret')
      if (turret) turret.rotation.y = Math.sin(t * 0.7) * 0.08
    } else {
      obj.position.y = gy + (moving ? Math.abs(Math.sin(t * 10 + e.id)) * 0.04 : Math.sin(t * 2 + e.id) * 0.01)
      obj.rotation.z = moving ? Math.sin(t * 10 + e.id) * 0.03 : 0
    }
  } else if (e.kind === 'building') {
    const b = e as BuildingEntity
    if (!b.built) {
      const p = Math.max(0.08, b.buildProgress)
      obj.scale.setScalar(0.6 + 0.4 * p)
      // the ghost material is shared: never mutate its opacity here
      if (!ghosted) {
        obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && 'transparent' in m) { m.transparent = true; m.opacity = 0.45 + 0.55 * p } } })
      }
    } else {
      obj.scale.setScalar(1)
      if (!ghosted) {
        obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && m.opacity !== undefined && m.transparent && (m as any).emissiveIntensity === undefined) { m.opacity = 1; m.transparent = false } } })
      }
    }
  } else if (e.kind === 'resource') {
    const r = e as ResourceEntity
    const ratio = r.maxAmount > 0 ? r.amount / r.maxAmount : 0
    obj.scale.setScalar(0.6 + 0.4 * ratio)
    const pump = obj.getObjectByName('pump')
    if (pump) pump.rotation.z = Math.sin(rc.clock.elapsedTime * 2.2) * 0.18
  }

  rc.prevPos.set(e.id, { x: e.x, z: e.z })

  obj.traverse((c) => { if (c.name === 'sel') c.visible = e.selected })

  // HP bar: created on demand, only for things that need it right now —
  // selected or wounded entities. Resources never carry one. Remembered enemy
  // buildings (ghosts) stay bare so they read as memory, not as live units.
  const needsBar = !ghosted && e.kind !== 'resource' && (e.selected || e.hp < e.maxHp)
  let hp = rc.hpBars.get(e.id)
  if (needsBar) {
    if (!hp) {
      hp = makeHpSprite(e)
      obj.add(hp)
      rc.hpBars.set(e.id, hp)
    }
    hp.visible = true
    updateHpSprite(hp, e.hp / Math.max(1, e.maxHp), e.team)
  } else if (hp) {
    hp.visible = false
  }
}

export function removeEntityMesh(rc: RenderContext, id: number): void {
  const obj = rc.entityMeshes.get(id)
  if (obj) {
    rc.scene.remove(obj)
    obj.traverse((c) => {
      const m = c as THREE.Mesh
      // restore originals so the shared ghost material is never disposed
      if (m.userData?.origMaterial) {
        m.material = m.userData.origMaterial
        m.userData.origMaterial = undefined
      }
      if (m.geometry) m.geometry.dispose()
      const matAny = m.material as any
      if (Array.isArray(matAny)) matAny.forEach((mm) => mm.dispose?.())
      else matAny?.dispose?.()
      const tex = (matAny?.map); if (tex) tex.dispose?.()
    })
    rc.entityMeshes.delete(id)
  }
  rc.hpBars.delete(id)
  rc.prevPos.delete(id)
}

/**
 * Fires a tracer: a bright streak from muzzle to impact plus a muzzle flash at
 * the shooter. Purely cosmetic — the sim already applied the damage.
 */
export function spawnTracer(rc: RenderContext, from: THREE.Vector3, to: THREE.Vector3, color = 0xffd27a): void {
  const dist = from.distanceTo(to)
  if (dist < 0.4) return
  const muzzle = acquireFx(rc, 'flash')
  if (muzzle) {
    muzzle.position.copy(from)
    muzzle.scale.setScalar(0.28)
    const mm = muzzle.material as THREE.MeshBasicMaterial
    mm.color.setHex(color)
    mm.opacity = 0.9
    rc.fxItems.push({
      kind: 'flash', mesh: muzzle, t: 0, life: 0.11,
      pos: muzzle.position.clone(), vel: new THREE.Vector3(),
      s0: 0.28, s1: 0.7, o0: 0.9,
    })
  }
  const mesh = acquireFx(rc, 'beam')
  if (!mesh) return
  mesh.position.lerpVectors(from, to, 0.5)
  mesh.lookAt(to) // geometry runs along +Z, so this aims the streak
  mesh.scale.set(0.115, 0.115, dist)
  const m = mesh.material as THREE.MeshBasicMaterial
  m.color.setHex(color)
  m.opacity = 0.95
  rc.fxItems.push({
    kind: 'beam', mesh, t: 0, life: 0.24,
    pos: mesh.position.clone(), vel: new THREE.Vector3(),
    s0: 1, s1: 1, o0: 0.95,
  })
}

/** Impact: a hot flash plus a shockwave ring on the ground. */
export function spawnImpact(rc: RenderContext, x: number, y: number, z: number): void {
  const flash = acquireFx(rc, 'flash')
  if (flash) {
    flash.position.set(x, y, z)
    flash.scale.setScalar(0.45)
    const m = flash.material as THREE.MeshBasicMaterial
    m.color.setHex(0xffb347)
    m.opacity = 0.95
    rc.fxItems.push({
      kind: 'flash', mesh: flash, t: 0, life: 0.3,
      pos: flash.position.clone(), vel: new THREE.Vector3(),
      s0: 0.45, s1: 2.0, o0: 0.95,
    })
  }
  const ring = acquireFx(rc, 'ring')
  if (ring) {
    ring.position.set(x, y - 0.75, z)
    ring.scale.setScalar(0.5)
    const m = ring.material as THREE.MeshBasicMaterial
    m.color.setHex(0xffd9a0)
    m.opacity = 0.8
    rc.fxItems.push({
      kind: 'ring', mesh: ring, t: 0, life: 0.46,
      pos: ring.position.clone(), vel: new THREE.Vector3(),
      s0: 0.5, s1: 3.4, o0: 0.85,
    })
  }
}

/** Death: a puff of smoke where a unit/building fell. `scale` sizes buildings up. */
export function spawnDeathFx(rc: RenderContext, x: number, z: number, y: number, scale = 1): void {
  const puffs = scale > 1.5 ? 7 : 4
  for (let i = 0; i < puffs; i++) {
    const mesh = acquireFx(rc, 'puff')
    if (!mesh) return
    // deterministic spread from the index: no RNG in the render path
    const ang = (i / puffs) * Math.PI * 2 + (x + z) * 0.37
    const rad = 0.25 + (i % 3) * 0.28
    mesh.position.set(x + Math.cos(ang) * rad, y + 0.45 + (i % 2) * 0.35, z + Math.sin(ang) * rad)
    mesh.scale.setScalar(0.35 * scale)
    const m = mesh.material as THREE.MeshBasicMaterial
    m.color.setHex(i % 2 === 0 ? 0x2b2b2b : 0x4a4640)
    m.opacity = 0.72
    rc.fxItems.push({
      kind: 'puff', mesh, t: 0, life: 0.6,
      pos: mesh.position.clone(),
      vel: new THREE.Vector3(Math.cos(ang) * 0.9, 1.7 + (i % 3) * 0.4, Math.sin(ang) * 0.9),
      s0: 0.35 * scale, s1: 1.15 * scale, o0: 0.72,
    })
  }
}

function fxMaterial(kind: FxKind): THREE.MeshBasicMaterial {
  switch (kind) {
    case 'beam':
      return new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    case 'flash':
      return new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    case 'ring':
      return new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })
    default:
      return new THREE.MeshBasicMaterial({ color: 0x2b2b2b, transparent: true, depthWrite: false })
  }
}

/** Pooled mesh for a VFX kind, or null when the live cap is reached. */
function acquireFx(rc: RenderContext, kind: FxKind): THREE.Mesh | null {
  const pool = rc.fxPool[kind]
  const pooled = pool.pop()
  if (pooled) {
    rc.fx.add(pooled)
    pooled.visible = true
    return pooled
  }
  if (rc.fxItems.length >= FX_MAX) return null
  const mesh = new THREE.Mesh(rc.fxGeo[kind], fxMaterial(kind))
  mesh.frustumCulled = false
  rc.fx.add(mesh)
  return mesh
}

function releaseFx(rc: RenderContext, it: FxItem): void {
  rc.fx.remove(it.mesh)
  const m = it.mesh.material as THREE.MeshBasicMaterial
  m.opacity = 1
  it.mesh.rotation.set(0, 0, 0)
  it.mesh.scale.setScalar(1)
  rc.fxPool[it.kind].push(it.mesh)
}

export function updateFx(rc: RenderContext, dt: number): void {
  for (let i = rc.fxItems.length - 1; i >= 0; i--) {
    const it = rc.fxItems[i]
    it.t += dt
    const k = Math.min(1, it.t / it.life)
    const m = it.mesh.material as THREE.MeshBasicMaterial
    if (it.kind === 'puff') {
      it.mesh.position.copy(it.pos).addScaledVector(it.vel, it.t)
      m.opacity = (1 - k) * it.o0
      it.mesh.scale.setScalar(it.s0 + (it.s1 - it.s0) * k)
    } else if (it.kind === 'beam') {
      m.opacity = (1 - k) * it.o0
      // the streak thins out as it fades, reading like a tracer round
      it.mesh.scale.x = it.mesh.scale.y = 0.115 * (1 - 0.6 * k)
    } else {
      m.opacity = (1 - k) * it.o0
      it.mesh.scale.setScalar(it.s0 + (it.s1 - it.s0) * k)
    }
    if (k >= 1) {
      releaseFx(rc, it)
      rc.fxItems.splice(i, 1)
    }
  }
}

export function renderFrame(rc: RenderContext, dt: number): void {
  updateFx(rc, dt)
  if (rc.composer) rc.composer.render()
  else rc.renderer.render(rc.scene, rc.camera)
}
