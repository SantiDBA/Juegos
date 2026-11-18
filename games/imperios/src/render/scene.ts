import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { BUILDING_DEFS, GRID, MAP_SIZE, TEAM_COLORS, UNIT_DEFS } from '../core/config'
import type { AnyEntity, BuildingEntity, ResourceEntity, ResourceKey, Team, UnitEntity } from '../core/types'

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
  /** Per-entity "just got hit" pip timers (seconds remaining). One pip per unit. */
  hitPips: Map<number, number>
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
  /** Live VFX particles (tracers, impacts, death smoke, craters, wrecks). */
  fxItems: FxItem[]
  /** Recycled meshes per VFX kind: no per-shot allocation. */
  fxPool: Record<FxKind, THREE.Mesh[]>
  fxGeo: Record<FxKind, THREE.BufferGeometry>
  /** Live (in-scene) item count per kind, so per-kind caps stay O(1). */
  fxLive: Record<FxKind, number>
  /** Shared "remembered but not seen" material for explored enemy buildings. */
  ghostMaterial: THREE.MeshBasicMaterial
  /** Terrain-hugging fog plane, textured from the team vision grid. */
  fogOverlay: THREE.Mesh
  fogTexture: THREE.CanvasTexture
  fogImage: ImageData
  fogCtx: CanvasRenderingContext2D
}

type FxKind = 'beam' | 'flash' | 'ring' | 'puff' | 'muzzle' | 'spark' | 'decal' | 'wreck' | 'rubble'

interface FxItem {
  kind: FxKind
  mesh: THREE.Mesh
  t: number
  life: number
  /** Anchor position; `puff`/`spark` items drift from it along `vel`. */
  pos: THREE.Vector3
  vel: THREE.Vector3
  s0: number
  s1: number
  o0: number
  /**
   * Seconds of full strength before the fade starts. Used by the persistent
   * combat footprint (craters, wrecks, rubble): they must sit still for a
   * while and only then dissolve, instead of pulsing like a particle.
   */
  hold?: number
}

/** Canvas resolution of the fog texture. The vision grid is 90x90; the fog
 * is painted at this resolution with bilinear sampling so the union of edges
 * reads as a soft penumbra instead of a staircase. */
const FOG_TEX = 360

/** Hard cap on simultaneous VFX so a big battle cannot tank the frame. */
const FX_MAX = 420

/**
 * Per-kind live caps. Everything shares FX_MAX as a global ceiling; the small
 * numbers are the ones that matter, because craters/wrecks/rubble are persistent
 * props and would otherwise pile up forever in a long match.
 */
const FX_LIVE_CAP: Record<FxKind, number> = {
  beam: FX_MAX,
  flash: FX_MAX,
  ring: FX_MAX,
  puff: FX_MAX,
  muzzle: 80, // judge-visible muzzle flashes: pooled generously for volleys
  spark: 260,
  decal: 520, // craters + unit stains + deposit halos (keep more persistent traces)
  wreck: 320,
  rubble: 320,
}

const WRECK_LIFE = 320
const WRECK_HOLD = 300
const RUBBLE_LIFE = 320
const RUBBLE_HOLD = 300
/** Wounded buildings cough smoke at this interval (presentation only). */
const DAMAGE_SMOKE_INTERVAL = 0.45

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

/** Deterministic ambient decoration (bushes/pebbles/tracks), render-only. */
function addDensityProps(scene: THREE.Scene): void {
  // Low-poly bushes / shrubs (scattered + deterministic forest clusters), render-only.
  const bushGeo = new THREE.IcosahedronGeometry(0.55, 0)
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f6a35, roughness: 0.95, metalness: 0.0, flatShading: true })
  const bushCount = 3200
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushCount)
  bushes.frustumCulled = false
  const d = new THREE.Object3D()
  const c = new THREE.Color()
  let bi = 0
  const baseClear = (x: number, z: number) => Math.hypot(x + 55, z) < 16 || Math.hypot(x - 55, z) < 16
  for (let i = 0; i < 9600 && bi < bushCount; i++) {
    const h = hash2(i * 0.73 + 10.1, i * 1.91 + 3.7)
    const h2 = hash2(i * 1.37 + 2.3, i * 0.61 + 8.4)
    const x = (h - 0.5) * MAP_SIZE * 0.96
    const z = (h2 - 0.5) * MAP_SIZE * 0.96
    // keep base centers and immediate fronts readable
    if (baseClear(x, z)) continue
    if (hash2(x * 0.21 + 5.3, z * 0.19 - 2.7) < 0.24) continue
    const y = terrainHeight(x, z)
    d.position.set(x, y + 0.04, z)
    d.rotation.set(0, hash2(i + 7.1, i * 3.1) * Math.PI * 2, 0)
    const s = 0.45 + hash2(i * 2.2, i + 0.4) * 0.9
    d.scale.set(s * 1.1, s * 0.82, s)
    d.updateMatrix()
    bushes.setMatrixAt(bi, d.matrix)
    c.setHSL(0.24 + hash2(i, i * 0.7) * 0.1, 0.44 + hash2(i * 0.3, i) * 0.22, 0.2 + hash2(i * 0.9, i) * 0.14)
    bushes.setColorAt(bi, c)
    bi++
  }
  // Thematic forest/bush clusters (deterministic), away from base centers and near resource zones/routes.
  const clusters: Array<[number, number, number]> = [
    [-22, -20, 22], [-32, 24, 20], [24, -22, 22], [30, 22, 20], [-8, 12, 18], [10, -10, 18], [-40, -6, 16], [38, 8, 16],
    [-36, 14, 22], [-30, 18, 20], [-28, 20, 18], [-40, 20, 18], [36, -14, 22], [30, -18, 20], [28, -20, 18], [40, -20, 18],
    [-2, 2, 18], [2, -2, 18], [-12, -30, 16], [12, 30, 16],
    [-34, -16, 20], [-38, 16, 18], [34, 16, 20], [38, -16, 18], [-24, 18, 18], [24, -18, 18], [-18, -6, 16], [18, 6, 16],
    [-14, 28, 16], [14, -28, 16], [-6, -12, 16], [6, 12, 16], [-26, -10, 16], [26, 10, 16],
    // extra center/node-adjacent scrub for denser readable map
    [-16, 6, 18], [16, -6, 18], [-10, 18, 16], [10, -18, 16], [-20, 30, 16], [20, -30, 16], [-8, -18, 16], [8, 18, 16],
    // arranque (player base outskirts) and near player resource nodes
    [-42, -12, 18], [-34, -24, 18], [-30, 12, 20], [-26, 24, 18], [-44, 18, 16], [-18, -34, 18], [-46, -14, 16], [-40, 10, 16],
    [-28, -14, 16], [-22, 14, 16], [-14, -22, 16], [-32, -28, 14], [-24, -8, 16], [-10, 26, 14],
    // enemy base outskirts / late-game visible surroundings
    [42, 12, 18], [34, 24, 18], [30, -12, 20], [26, -24, 18], [44, -18, 16], [18, 34, 18], [46, 14, 16], [40, -10, 16],
    [28, 14, 16], [22, -14, 16], [14, 22, 16], [32, 28, 14], [24, 8, 16], [10, -26, 14],
    // center skirmish lanes and mid map fillers
    [-4, -8, 14], [4, 8, 14], [-12, 2, 14], [12, -2, 14], [-20, 12, 14], [20, -12, 14], [0, 18, 14], [0, -18, 14],
    // ciclo 33: rellenar los corredores vacíos con matorral y roca
    [-30, -4, 10], [30, 4, 10], [-18, -14, 10], [18, 14, 10], [-6, 26, 10], [6, -26, 10],
    [-36, 6, 10], [36, -6, 10], [-22, 6, 10], [22, -6, 10], [-14, 22, 10], [14, -22, 10],
  ]
  for (let ci = 0; ci < clusters.length && bi < bushCount; ci++) {
    const [cx, cz, n] = clusters[ci]
    if (baseClear(cx, cz)) continue
    for (let j = 0; j < n && bi < bushCount; j++) {
      const a = hash2(ci * 9.7 + j * 1.3, j * 4.1 + 2.2) * Math.PI * 2
      const r = 0.7 + hash2(j * 2.6 + ci, ci * 3.4 + j) * 5.2
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (baseClear(x, z) || Math.abs(x) > MAP_SIZE * 0.47 || Math.abs(z) > MAP_SIZE * 0.47) continue
      const y = terrainHeight(x, z)
      const k = 5000 + ci * 100 + j
      d.position.set(x, y + 0.04, z)
      d.rotation.set(0, hash2(k + 1.1, k * 2.7) * Math.PI * 2, 0)
      const s = 0.55 + hash2(k * 2.2, k + 0.4) * 1.05
      d.scale.set(s * 1.18, s * 0.86, s)
      d.updateMatrix()
      bushes.setMatrixAt(bi, d.matrix)
      c.setHSL(0.27 + hash2(k, k * 0.7) * 0.06, 0.5 + hash2(k * 0.3, k) * 0.2, 0.19 + hash2(k * 0.9, k) * 0.11)
      bushes.setColorAt(bi, c)
      bi++
    }
  }
  bushes.count = bi
  bushes.instanceMatrix.needsUpdate = true
  if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true
  bushes.receiveShadow = true
  scene.add(bushes)

  // Extra small stones / pebbles
  const pebGeo = new THREE.DodecahedronGeometry(0.22, 0)
  const pebMat = new THREE.MeshStandardMaterial({ color: 0x7a7a72, roughness: 0.98, metalness: 0.02, flatShading: true })
  const pebCount = 1100
  const pebs = new THREE.InstancedMesh(pebGeo, pebMat, pebCount)
  pebs.frustumCulled = false
  let pi = 0
  for (let i = 0; i < 3600 && pi < pebCount; i++) {
    const h = hash2(i * 0.91 + 40.1, i * 1.23 + 13.7)
    const h2 = hash2(i * 1.71 + 22.3, i * 0.47 + 18.4)
    const x = (h - 0.5) * MAP_SIZE * 0.94
    const z = (h2 - 0.5) * MAP_SIZE * 0.94
    if (Math.hypot(x + 55, z) < 14 || Math.hypot(x - 55, z) < 14) continue
    if (hash2(x * 0.33 + 1.2, z * 0.27 - 4.1) < 0.34) continue
    const y = terrainHeight(x, z)
    d.position.set(x, y, z)
    d.rotation.set(hash2(i + 1.3, i) * Math.PI, hash2(i, i * 2.0) * Math.PI * 2, 0)
    const s = 0.35 + hash2(i * 3.2, i + 0.8) * 1.1
    d.scale.setScalar(s)
    d.updateMatrix()
    pebs.setMatrixAt(pi, d.matrix)
    c.setHSL(0.08, 0.05 + hash2(i, i * 0.2) * 0.08, 0.33 + hash2(i * 0.4, i) * 0.22)
    pebs.setColorAt(pi, c)
    pi++
  }
  pebs.count = pi
  pebs.instanceMatrix.needsUpdate = true
  if (pebs.instanceColor) pebs.instanceColor.needsUpdate = true
  pebs.castShadow = true
  pebs.receiveShadow = true
  scene.add(pebs)

  // Flower/field patches (small color accents to break empty ground)
  const flowerGeo = new THREE.PlaneGeometry(0.35, 0.35)
  const flowerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  const flowerCount = 700
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount)
  flowers.frustumCulled = false
  let fi = 0
  for (let i = 0; i < 2200 && fi < flowerCount; i++) {
    const h = hash2(i * 1.11 + 7.7, i * 0.93 + 2.1)
    const h2 = hash2(i * 0.67 + 19.3, i * 1.41 + 5.4)
    const x = (h - 0.5) * MAP_SIZE * 0.92
    const z = (h2 - 0.5) * MAP_SIZE * 0.92
    if (baseClear(x, z)) continue
    if (hash2(x * 0.5 + 1.2, z * 0.4 - 3.1) < 0.55) continue
    const y = terrainHeight(x, z)
    d.position.set(x, y + 0.045, z)
    d.rotation.set(-Math.PI / 2, 0, hash2(i * 2.1, i) * Math.PI)
    const s = 0.5 + hash2(i * 1.7, i + 0.3) * 0.9
    d.scale.setScalar(s)
    d.updateMatrix()
    flowers.setMatrixAt(fi, d.matrix)
    c.setHSL(0.12 + hash2(i, i * 0.2) * 0.75, 0.55 + hash2(i * 0.4, i) * 0.25, 0.55 + hash2(i * 0.6, i) * 0.2)
    flowers.setColorAt(fi, c)
    fi++
  }
  flowers.count = fi
  flowers.instanceMatrix.needsUpdate = true
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true
  scene.add(flowers)

  // Thematic props (render-only) that make zones read as inhabited: crates/barrels
  // clustered near bases and on the routes, plus rock outcrops for identity.
  const crateGeo = new THREE.BoxGeometry(0.72, 0.72, 0.72)
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9, metalness: 0.02 })
  const crateCount = 180
  const crates = new THREE.InstancedMesh(crateGeo, crateMat, crateCount)
  crates.frustumCulled = false
  const crateCenters: Array<[number, number]> = [
    [-46, -12], [-46, 14], [-58, 6], [-40, -4], [46, 12], [46, -14], [58, -6], [40, 4],
    [-30, 18], [30, -18], [-20, -24], [20, 24], [-8, 22], [8, -22],
  ]
  let cri = 0
  for (let ci = 0; ci < crateCenters.length && cri < crateCount; ci++) {
    const [cx, cz] = crateCenters[ci]
    for (let j = 0; j < 12 && cri < crateCount; j++) {
      const a = hash2(ci * 3.1 + j, j * 2.7 + ci) * Math.PI * 2
      const r = 0.8 + hash2(j + ci, ci + j * 1.3) * 2.8
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      const y = terrainHeight(x, z)
      d.position.set(x, y + 0.35, z)
      d.rotation.set(0, hash2(j, ci) * Math.PI, 0)
      const s = 0.7 + hash2(j * 1.7, ci) * 0.5
      d.scale.setScalar(s)
      d.updateMatrix()
      crates.setMatrixAt(cri, d.matrix)
      c.setHSL(0.09, 0.3 + hash2(j, ci * 2) * 0.14, 0.33 + hash2(ci, j) * 0.13)
      crates.setColorAt(cri, c)
      cri++
    }
  }
  crates.count = cri
  crates.instanceMatrix.needsUpdate = true
  if (crates.instanceColor) crates.instanceColor.needsUpdate = true
  crates.castShadow = true
  crates.receiveShadow = true
  scene.add(crates)

  // Rock outcrops: a few larger, darker clusters that give empty areas an identity.
  const rockGeo2 = new THREE.DodecahedronGeometry(0.85, 0)
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x7f7d75, roughness: 0.98, metalness: 0.02, flatShading: true })
  const rockCount2 = 180
  const rocks2 = new THREE.InstancedMesh(rockGeo2, rockMat2, rockCount2)
  rocks2.frustumCulled = false
  const rockCenters: Array<[number, number]> = [
    [-24, -30], [24, 30], [-34, 24], [34, -24], [-8, -40], [8, 40], [40, 18], [-40, -18], [-16, -8], [16, 8],
  ]
  let rki = 0
  for (let ci = 0; ci < rockCenters.length && rki < rockCount2; ci++) {
    const [cx, cz] = rockCenters[ci]
    for (let j = 0; j < 14 && rki < rockCount2; j++) {
      const a = hash2(ci * 5.3 + j, j * 3.1 + ci) * Math.PI * 2
      const r = 0.8 + hash2(j * 2.1 + ci, ci * 1.9 + j) * 3.6
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      const y = terrainHeight(x, z)
      d.position.set(x, y + 0.32, z)
      d.rotation.set(hash2(j, ci) * 0.7, hash2(ci, j) * Math.PI * 2, 0)
      const s = 0.6 + hash2(j * 1.3, ci * 2.2) * 0.95
      d.scale.set(s, s * 0.8, s)
      d.updateMatrix()
      rocks2.setMatrixAt(rki, d.matrix)
      c.setHSL(0.08, 0.04 + hash2(j, ci) * 0.06, 0.35 + hash2(ci, j) * 0.2)
      rocks2.setColorAt(rki, c)
      rki++
    }
  }
  rocks2.count = rki
  rocks2.instanceMatrix.needsUpdate = true
  if (rocks2.instanceColor) rocks2.instanceColor.needsUpdate = true
  rocks2.castShadow = true
  rocks2.receiveShadow = true
  scene.add(rocks2)

  // Track/worn-path decals near base -> node routes (render-only), denser for readability.
  const trackMat = new THREE.MeshBasicMaterial({
    color: 0x6b5a3a, transparent: true, opacity: 0.24, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5,
  })
  const paths: Array<[number, number, number, number]> = [
    [-50, 2, -38, -16], [-50, 4, -34, 16], [-52, -2, -24, -22], [-52, 0, -24, 18],
    [-46, 0, -30, 0], [-48, -6, -36, -10], [-48, 8, -36, 12], [-44, -12, -30, -22], [-44, 14, -30, 20], [-40, -18, -20, -36],
    [50, -2, 38, 16], [50, -4, 34, -16], [52, 2, 24, 22], [52, 0, 24, -18],
    [46, 0, 30, 0], [48, 6, 36, 10], [48, -8, 36, -12], [44, 12, 30, 22], [44, -14, 30, -20], [40, 18, 20, 36],
    [-18, 0, 18, 0], [-10, -10, 10, 10], [-8, -30, 8, 30],
    // extra connectors from main clusters/nodes toward center
    [-30, 18, -8, 4], [-34, 16, -12, 2], [-24, -22, -8, -8], [-32, 24, -10, 8], [-22, -20, -6, -4],
    [30, -18, 8, -4], [34, -16, 12, -2], [24, 22, 8, 8], [32, -24, 10, -8], [22, 20, 6, 4],
    [-12, 12, 0, 0], [12, -12, 0, 0], [-26, 10, -10, 0], [26, -10, 10, 0],
    // additional center/route connectors
    [-16, 24, -4, 6], [16, -24, 4, -6],
  ]
  for (const [x1, z1, x2, z2] of paths) {
    const dx = x2 - x1, dz = z2 - z1
    const len = Math.hypot(dx, dz)
    if (len < 1) continue
    const geo = new THREE.PlaneGeometry(2.1, len)
    const mesh = new THREE.Mesh(geo, trackMat)
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2
    mesh.position.set(mx, terrainHeight(mx, mz) + 0.06, mz)
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = -Math.atan2(dx, dz)
    mesh.renderOrder = 1
    scene.add(mesh)
  }

  // Simple deterministic fence segments near base outskirts (render-only), clear of base centers.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x7a6246, roughness: 0.9, metalness: 0.02 })
  const fenceSegs: Array<[number, number, number, number]> = [
    [-42, -10, -42, 10], [-44, -12, -38, -12], [-44, 12, -38, 12],
    [42, -10, 42, 10], [44, -12, 38, -12], [44, 12, 38, 12],
    [-30, -18, -24, -18], [-30, 14, -24, 14], [30, -18, 24, -18], [30, 14, 24, 14],
  ]
  for (const [x1, z1, x2, z2] of fenceSegs) {
    const dx = x2 - x1, dz = z2 - z1
    const len = Math.hypot(dx, dz)
    if (len < 0.5) continue
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, len), fenceMat)
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2
    rail.position.set(mx, terrainHeight(mx, mz) + 0.38, mz)
    rail.rotation.y = Math.atan2(dx, dz)
    rail.castShadow = true
    rail.receiveShadow = true
    scene.add(rail)
    const posts = Math.max(2, Math.floor(len / 3))
    for (let p = 0; p <= posts; p++) {
      const t = p / posts
      const px = x1 + dx * t, pz = z1 + dz * t
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), fenceMat)
      post.position.set(px, terrainHeight(px, pz) + 0.28, pz)
      post.castShadow = true
      post.receiveShadow = true
      scene.add(post)
    }
  }

  // Thematic grove props near forest-resource areas (visual only, deterministic).
  const groveGeo = new THREE.ConeGeometry(0.6, 1.55, 6)
  const groveMat = new THREE.MeshStandardMaterial({ color: 0x2f6a35, roughness: 0.92, metalness: 0.0, flatShading: true })
  const groveCenters: Array<[number, number, number]> = [
    [-38, -16, 22], [-34, 16, 24], [-30, 20, 22], [-24, -22, 18], [-24, 18, 18], [-6, 0, 16],
    [38, 16, 22], [34, -16, 24], [30, -20, 22], [24, 22, 18], [24, -18, 18], [6, 0, 16],
    [-2, 2, 18], [2, -2, 18], [-14, 28, 16], [14, -28, 16], [-42, 22, 16], [42, -22, 16],
    [-20, -8, 14], [20, 8, 14], [-10, 18, 14], [10, -18, 14], [-26, 12, 14], [26, -12, 14],
    // extra center/node-adjacent groves for denser readable map
    [-12, -20, 16], [12, 20, 16], [-30, 4, 14], [30, -4, 14], [-16, 10, 14], [16, -10, 14],
    // arranque/player-side bosque surroundings
    [-34, 12, 16], [-28, 16, 16], [-40, 22, 14], [-24, 22, 14], [-38, -18, 14], [-26, -24, 14], [-18, 24, 12], [-10, -14, 12],
  ]
  const groves = new THREE.InstancedMesh(groveGeo, groveMat, 700)
  groves.frustumCulled = false
  let gi = 0
  for (let ci = 0; ci < groveCenters.length && gi < 700; ci++) {
    const [cx, cz, n] = groveCenters[ci]
    for (let j = 0; j < n && gi < 700; j++) {
      const a = hash2(ci * 11.3 + j * 2.1, j * 5.7 + 1.9) * Math.PI * 2
      const r = 1.0 + hash2(j * 3.1 + ci, ci * 2.4 + j) * 5.4
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (baseClear(x, z)) continue
      const y = terrainHeight(x, z)
      d.position.set(x, y + 0.7, z)
      d.rotation.set(0, hash2(gi + 1.7, gi) * Math.PI * 2, 0)
      const s = 0.7 + hash2(gi * 1.9, gi + 0.6) * 0.85
      d.scale.set(s, 0.9 + hash2(gi * 2.3, gi) * 0.85, s)
      d.updateMatrix()
      groves.setMatrixAt(gi, d.matrix)
      c.setHSL(0.28 + hash2(gi, gi * 0.4) * 0.06, 0.42 + hash2(gi * 0.5, gi) * 0.18, 0.2 + hash2(gi * 0.8, gi) * 0.1)
      groves.setColorAt(gi, c)
      gi++
    }
  }
  groves.count = gi
  groves.instanceMatrix.needsUpdate = true
  if (groves.instanceColor) groves.instanceColor.needsUpdate = true
  groves.castShadow = true
  groves.receiveShadow = true
  scene.add(groves)

  // Subtle field/farm strips near supply areas and routes (visual only, deterministic).
  const fieldMats = [
    new THREE.MeshBasicMaterial({ color: 0x7a8a3a, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.4, polygonOffsetUnits: -1.4 }),
    new THREE.MeshBasicMaterial({ color: 0xb7a44a, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.4, polygonOffsetUnits: -1.4 }),
  ]
  const fields: Array<[number, number, number, number, number]> = [
    [-40, -20, 4.8, 3.2, 0], [-36, -22, 4.2, 3.0, 1], [-42, -16, 4.4, 3.0, 0], [-34, -24, 4.0, 2.8, 1], [-20, -38, 5.4, 3.4, 0], [-38, -18, 3.6, 2.6, 1],
    [40, 20, 4.8, 3.2, 0], [36, 22, 4.2, 3.0, 1], [42, 16, 4.4, 3.0, 0], [34, 24, 4.0, 2.8, 1], [20, 37, 5.4, 3.4, 0], [38, 18, 3.6, 2.6, 1],
    [-12, -28, 3.8, 2.6, 0], [12, 28, 3.8, 2.6, 0], [-4, 6, 3.6, 2.6, 1], [4, -6, 3.6, 2.6, 1], [-2, -8, 3.2, 2.4, 0], [2, 8, 3.2, 2.4, 0],
    [-28, -14, 4.6, 3.0, 1], [-24, -12, 4.0, 2.8, 0], [28, 14, 4.6, 3.0, 1], [24, 12, 4.0, 2.8, 0],
    [-16, 18, 4.2, 2.8, 0], [-10, 22, 3.8, 2.6, 1], [16, -18, 4.2, 2.8, 0], [10, -22, 3.8, 2.6, 1],
    [-30, 10, 3.6, 2.5, 1], [30, -10, 3.6, 2.5, 1], [-18, -2, 3.4, 2.4, 0], [18, 2, 3.4, 2.4, 0],
    // extra visible center/node-adjacent crop strips
    [-14, 8, 3.8, 2.6, 1], [14, -8, 3.8, 2.6, 1], [-8, -22, 3.6, 2.5, 0], [8, 22, 3.6, 2.5, 0], [-22, 4, 3.4, 2.4, 0], [22, -4, 3.4, 2.4, 0],
    // near player farm nodes (arranque/economía legible)
    [-44, -22, 3.6, 2.5, 0], [-38, -24, 3.4, 2.4, 1], [-32, -18, 3.5, 2.5, 0], [-36, -12, 3.2, 2.3, 1], [-28, -26, 3.4, 2.4, 0], [-24, -34, 3.6, 2.5, 1],
  ]
  for (let i = 0; i < fields.length; i++) {
    const [fx, fz, fw, fl, mi] = fields[i]
    if (baseClear(fx, fz)) continue
    const geo = new THREE.PlaneGeometry(fw, fl)
    const mesh = new THREE.Mesh(geo, fieldMats[mi] ?? fieldMats[0])
    mesh.position.set(fx, terrainHeight(fx, fz) + 0.055, fz)
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = hash2(fx * 1.1 + i, fz * 0.9 - i) * 0.7
    mesh.renderOrder = 1
    scene.add(mesh)
  }

  // Fallen logs and small rock clusters (deterministic variation), away from bases/clearings.
  const logGeo = new THREE.CylinderGeometry(0.11, 0.16, 2.3, 6)
  const logMat = new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 0.96, metalness: 0.0 })
  const logs: Array<[number, number, number, number]> = [ // x,z,rotY,scale
    [-28, 18, 0.6, 1.0], [-38, -20, 1.4, 0.9], [-16, 12, 2.2, 1.05], [18, -14, 0.2, 0.95],
    [-8, -24, 1.8, 0.9], [12, 26, 0.9, 1.0], [-42, 6, 2.6, 0.85], [-24, -30, 0.4, 1.0],
    [26, 14, 1.1, 0.9], [34, -10, 2.0, 0.95], [-34, 26, 0.7, 0.9], [10, -6, 1.5, 0.85],
    [-46, -10, 0.3, 0.9], [-20, 8, 1.2, 1.0],
  ]
  for (const [lx, lz, ry, sc] of logs) {
    if (baseClear(lx, lz)) continue
    const y = terrainHeight(lx, lz)
    const log = new THREE.Mesh(logGeo, logMat)
    log.position.set(lx, y + 0.14 * sc, lz)
    log.rotation.set(Math.PI / 2, ry, 0) // lie on ground
    log.scale.setScalar(sc)
    log.castShadow = true
    log.receiveShadow = true
    scene.add(log)
  }

  const rockClusterGeo = new THREE.DodecahedronGeometry(0.42, 0)
  const rockClusterMat = new THREE.MeshStandardMaterial({ color: 0x7e7d76, roughness: 0.98, metalness: 0.02, flatShading: true })
  const rockClusters: Array<[number, number, number]> = [ // cx,cz,count
    [-40, -10, 4], [-30, -20, 5], [-26, 14, 4], [-18, 20, 4], [-12, -12, 3], [-44, 12, 4],
    [-6, 20, 3], [-22, -8, 4], [8, -20, 4], [24, 16, 4], [34, 12, 4], [40, -12, 4],
    [-34, 30, 3], [14, 10, 3], [-10, 4, 3], [20, -6, 3], [-46, -16, 3], [-32, -12, 4],
  ]
  for (let ci = 0; ci < rockClusters.length; ci++) {
    const [cx, cz, n] = rockClusters[ci]
    if (baseClear(cx, cz)) continue
    for (let j = 0; j < n; j++) {
      const a = hash2(ci * 5.7 + j * 2.9, j * 3.3 + 1.1) * Math.PI * 2
      const r = 0.2 + hash2(j * 1.8 + ci, ci * 2.2 + j) * 1.4
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (baseClear(x, z)) continue
      const m = new THREE.Mesh(rockClusterGeo, rockClusterMat)
      m.position.set(x, terrainHeight(x, z) + 0.08, z)
      m.rotation.set(hash2(ci + j, j) * Math.PI, hash2(j, ci + j) * Math.PI * 2, 0)
      const s = 0.55 + hash2(ci * 3.1 + j, j * 2.4) * 0.9
      m.scale.setScalar(s)
      m.castShadow = true
      m.receiveShadow = true
      scene.add(m)
    }
  }
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
  renderer.toneMappingExposure = 0.93

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfd6eb)
  scene.fog = new THREE.FogExp2(0xd7c6a8, 0.0018)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 700)

  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), skyMaterial())
  scene.add(sky)

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a3f2d, 0.45)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffe7c2, 1.9)
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
    const patch3 = fbm(x * 0.035 - 12, y * 0.035 + 18)
    c.offsetHSL((patch - 0.5) * 0.05 + (patch3 - 0.5) * 0.025, (patch - 0.5) * 0.08 + (patch3 - 0.5) * 0.04, (patch2 - 0.5) * 0.08 + (patch3 - 0.5) * 0.05)
    const ao = THREE.MathUtils.clamp(0.72 + (h + 2.0) * 0.06 - slope * 0.3 + (patch3 - 0.5) * 0.05, 0.5, 1.0)
    c.multiplyScalar(ao)
    colors.push(c.r, c.g, c.b)
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 })

  // Procedural, tileable ground-detail texture multiplied over the vertex colours:
  // adds grass/dirt high-frequency speckle so the terrain reads as ground instead of
  // flat paint (the biggest "low-poly prototype" tell vs AoE2).
  const groundDetail = (() => {
    const N = 256
    const c = document.createElement('canvas')
    c.width = c.height = N
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(N, N)
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        // tileable-ish fbm using sin-based hash (wrap by sampling both edges is
        // overkill; RepeatWrapping tolerates the seam at this fine scale)
        const n = valueNoise(x * 0.08, y * 0.08) * 0.55 + valueNoise(x * 0.31 + 40, y * 0.31 - 12) * 0.45
        const s = hash2(x * 1.7, y * 2.3)
        let v = 0.9 + (n - 0.5) * 0.22
        if (s > 0.88) v -= 0.18       // dirt/gravel speck
        else if (s < 0.09) v += 0.09  // light blade highlight
        v = Math.max(0.6, Math.min(1.0, v))
        const o = (y * N + x) * 4
        const g = Math.round(v * 255)
        img.data[o] = g
        img.data[o + 1] = g
        img.data[o + 2] = Math.round(g * 0.97)
        img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(30, 30)
    tex.needsUpdate = true
    return tex
  })()
  groundMat.map = groundDetail
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
  grassMesh.frustumCulled = false
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
  rocksMesh.frustumCulled = false
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
  // DIAGNOSTIC: ?nofx hides all VFX to isolate render artifacts
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofx')) fx.visible = false

  // --- Fog of war overlay ------------------------------------------------
  // A second mesh sharing the ground geometry, lifted 1 unit so it hugs every
  // hill instead of clipping through it. The canvas holds one texel per nav
  // tile: UNKNOWN = opaque black, EXPLORED = 58% black, VISIBLE = clear.
  // Soft edges: the grid has one texel per nav tile, but the canvas is
  // upsampled 4x with LINEAR filtering so the 90->360 remap below blends.
  const fogCanvas = document.createElement('canvas')
  fogCanvas.width = FOG_TEX
  fogCanvas.height = FOG_TEX
  const fogCtx = fogCanvas.getContext('2d')!
  const fogImage = fogCtx.createImageData(FOG_TEX, FOG_TEX)
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

  addDensityProps(scene)

  // --- VFX assets (shared geometries, per-mesh materials for fading) ------
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true)
  beamGeo.rotateX(Math.PI / 2) // axis along +Z, length 1
  const ringGeo = new THREE.RingGeometry(0.62, 1, 28)
  ringGeo.rotateX(-Math.PI / 2)
  const craterGeo = new THREE.CircleGeometry(1, 18)
  craterGeo.rotateX(-Math.PI / 2) // flat on the ground, no per-frame rotation
  const fxGeo: Record<FxKind, THREE.BufferGeometry> = {
    beam: beamGeo,
    flash: new THREE.SphereGeometry(1, 10, 8),
    ring: ringGeo,
    puff: new THREE.SphereGeometry(1, 8, 6),
    muzzle: new THREE.PlaneGeometry(1, 1),
    spark: new THREE.OctahedronGeometry(1, 0),
    decal: craterGeo,
    wreck: new THREE.BoxGeometry(1, 1, 1),
    rubble: new THREE.BoxGeometry(1, 1, 1),
  }
  const fxPool: Record<FxKind, THREE.Mesh[]> = {
    beam: [], flash: [], ring: [], puff: [],
    muzzle: [], spark: [], decal: [], wreck: [], rubble: [],
  }
  const fxLive: Record<FxKind, number> = {
    beam: 0, flash: 0, ring: 0, puff: 0,
    muzzle: 0, spark: 0, decal: 0, wreck: 0, rubble: 0,
  }

  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0xc8d8ea, transparent: true, opacity: 0.72, depthWrite: false, depthTest: false,
  })

  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  try {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.08, 0.45, 1.05)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  } catch {
    composer = null; bloom = null
  }

  const rc: RenderContext = {
    renderer, scene, camera, canvas, ground, grid, selectionRing, placementGhost,
    entityMeshes: new Map(), hpBars: new Map(), prevPos: new Map(), hitPips: new Map(),
    sun, fill, hemi, clock: new THREE.Clock(), raycaster: new THREE.Raycaster(),
    target: new THREE.Vector3(-48, 0, 4),
    camYaw: Math.PI * 0.25, camPitch: Math.PI / 3.25, camDist: 72,
    markers, fx, composer, bloom,
    fxItems: [], fxPool, fxGeo, fxLive, ghostMaterial,
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
  const W = image.width // FOG_TEX
  const scale = GRID / W
  for (let py = 0; py < W; py++) {
    for (let px = 0; px < W; px++) {
      const gx = px * scale + scale * 0.5
      const gy = py * scale + scale * 0.5
      // bilinear sample of RGBA fog states over the 90x90 vision grid
      const x0 = Math.floor(gx - 0.5), y0 = Math.floor(gy - 0.5)
      const fx = Math.min(1, Math.max(0, gx - 0.5 - x0)), fy = Math.min(1, Math.max(0, gy - 0.5 - y0))
      const c00 = visFog(grid, x0, y0), c10 = visFog(grid, x0 + 1, y0)
      const c01 = visFog(grid, x0, y0 + 1), c11 = visFog(grid, x0 + 1, y0 + 1)
      const topR = c00[0] + (c10[0] - c00[0]) * fx
      const topG = c00[1] + (c10[1] - c00[1]) * fx
      const topB = c00[2] + (c10[2] - c00[2]) * fx
      const topA = c00[3] + (c10[3] - c00[3]) * fx
      const botR = c01[0] + (c11[0] - c01[0]) * fx
      const botG = c01[1] + (c11[1] - c01[1]) * fx
      const botB = c01[2] + (c11[2] - c01[2]) * fx
      const botA = c01[3] + (c11[3] - c01[3]) * fx
      const o = (py * W + px) * 4
      data[o] = Math.round(topR + (botR - topR) * fy)
      data[o + 1] = Math.round(topG + (botG - topG) * fy)
      data[o + 2] = Math.round(topB + (botB - topB) * fy)
      data[o + 3] = Math.round(topA + (botA - topA) * fy)
    }
  }
}

function visFog(grid: Uint8Array | null, cx: number, cy: number): [number, number, number, number] {
  // visible (v>=2): clear; explored (v==1): gray-blue memory veil; unseen/outside: near-opaque black
  if (!grid) return [0, 0, 0, 252]
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return [0, 0, 0, 252]
  const v = grid[cy * GRID + cx]
  if (v >= 2) return [0, 0, 0, 0]
  if (v === 1) return [34, 42, 56, 186]
  return [1, 2, 6, 252]
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
const HP_BAR_H = 24

const VEHICLE_UNITS = new Set(['blindado', 'tanque', 'cazacarros', 'mlrs', 'canon', 'tanque_autonomo'])

/** Height of the bar above a building's base, in world units (roof + a gap). */
const BUILDING_BAR_Y: Record<BuildingEntity['btype'], number> = {
  ayuntamiento: 7.6,
  cuartel: 5.4,
  vivienda: 3.2,
  almacen: 3.2,
  fabrica: 6.4,
  torre: 10.0,
}

/** Where damage smoke leaves a building, in world units above its base. */
const BUILDING_SMOKE_Y: Record<BuildingEntity['btype'], number> = {
  ayuntamiento: 5.0,
  cuartel: 2.8,
  vivienda: 2.7,
  almacen: 2.1,
  fabrica: 6.2,
  torre: 7.8,
}

interface HpBarSpec {
  /** World-space width/height: the caller counter-scales the entity group. */
  w: number
  h: number
  /** Vertical placement in the entity's local space (above the head / roof). */
  y: number
  /** Horizontal anti-overlap nudge, world units. */
  ox: number
}

/**
 * Per-entity bar size: ~55-60% of the silhouette width, thin enough to hug the
 * model instead of floating like a banner. Units use one small fixed size (the
 * group they live in is scaled 1.35, so the caller divides these out) and get a
 * deterministic horizontal nudge from their id, which stops two adjacent
 * soldiers' bars from merging into one long stripe.
 */
function hpBarSpec(e: AnyEntity): HpBarSpec {
  if (e.kind === 'building') {
    const size = BUILDING_DEFS[e.btype]?.size ?? { x: 4, z: 4 }
    return { w: Math.max(2.8, size.x * 0.5), h: 0.55, y: BUILDING_BAR_Y[e.btype] ?? 3.2, ox: 0 }
  }
  if (e.kind === 'unit') {
    return { w: VEHICLE_UNITS.has(e.utype) ? 1.85 : 1.7, h: 0.42, y: 1.55, ox: ((e.id % 3) - 1) * 0.35 }
  }
  return { w: 2.2, h: 0.5, y: 2, ox: 0 }
}

function makeHpSprite(): THREE.Sprite {
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
 * a 2px dark frame instead of a heavy border, so it stays readable over grass,
 * snow and buildings without becoming a black slab.
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
  // 2px frame + track: a thin dark edge reads as UI, a fat one eats the model
  ctx.fillStyle = 'rgba(6,8,10,0.72)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(34,41,49,0.96)'
  ctx.fillRect(2, 2, w - 4, h - 4)
  // fill
  ctx.fillStyle = rq < 0.35 ? '#e0c24a' : team === 'player' ? '#58d05e' : '#e05555'
  const fw = Math.round((w - 4) * r)
  if (fw > 0) {
    ctx.fillRect(2, 2, fw, h - 4)
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillRect(2, 2, fw, Math.max(1, Math.round((h - 4) * 0.33)))
  }
  // hairline outline
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
  tex.needsUpdate = true
}

// ---------------------------------------------------------------------------
// Floating text label (resource node amounts)
// ---------------------------------------------------------------------------

const NODE_LABEL_W = 192
const NODE_LABEL_H = 72
/** World size of a node label; the node itself shrinks as it depletes. */
const NODE_LABEL_SCALE_W = 2.5
const NODE_LABEL_SCALE_H = 0.9
/** World height of the label above the node's base. */
const NODE_LABEL_Y = 3.25

/** Builds the reusable canvas sprite used for on-world numbers. */
function makeLabelSprite(): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = NODE_LABEL_W
  c.height = NODE_LABEL_H
  const ctx = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })
  const sp = new THREE.Sprite(mat)
  sp.name = 'nodelabel'
  sp.renderOrder = 210 // above bars and the fog overlay
  sp.visible = false
  const anySp = sp as any
  anySp._canvas = c
  anySp._ctx = ctx
  anySp._tex = tex
  anySp._text = ''
  return sp
}

/**
 * Paints a resource node's remaining amount. Redraws only when the text
 * changes: a canvas upload per frame per selected node would be wasteful.
 */
export function updateNodeLabel(sp: THREE.Sprite, amount: number): void {
  const anySp = sp as any
  const text = String(Math.max(0, Math.ceil(amount)))
  if (anySp._text === text) return
  anySp._text = text

  const ctx = anySp._ctx as CanvasRenderingContext2D
  const tex = anySp._tex as THREE.CanvasTexture
  const w = NODE_LABEL_W, h = NODE_LABEL_H
  ctx.clearRect(0, 0, w, h)
  ctx.font = 'bold 46px ui-sans-serif, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const textW = Math.min(w - 8, Math.max(64, ctx.measureText(text).width + 40))
  const x0 = (w - textW) / 2
  // pill
  ctx.fillStyle = 'rgba(8,11,16,0.70)'
  ctx.fillRect(x0, 8, textW, h - 16)
  ctx.strokeStyle = 'rgba(198,216,236,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(x0 + 1, 9, textW - 2, h - 18)
  // digits
  ctx.fillStyle = '#dde6f3'
  ctx.fillText(text, w / 2, h / 2 + 1)
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
  if (e.kind === 'unit') { const g = createUnitMesh(e); g.scale.setScalar(1.5); return g }
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
    // Visible load: oversized crate + icon so gathering/returning is instant at game zoom.
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 1.15, 1.15),
      new THREE.MeshBasicMaterial({ color: 0xbef05a, transparent: true, opacity: 0.98, toneMapped: false }),
    )
    cargo.name = 'cargo'
    cargo.position.set(0, 2.35, 0.02)
    cargo.castShadow = false
    cargo.visible = false
    cargo.userData.baseY = cargo.position.y
    g.add(cargo)
    // Bright top marker makes the carried load unmistakable from camera distance.
    const cargoMark = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.22, 1.05),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, toneMapped: false }),
    )
    cargoMark.name = 'cargoMark'
    cargoMark.position.set(0, 0.58, 0)
    cargo.add(cargoMark)
    // Billboard icon (always camera-readable) above the carried resource.
    const cargoIcon = new THREE.Sprite(new THREE.SpriteMaterial({ map: cargoTexture('suministros'), color: 0xffffff, transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false }))
    cargoIcon.name = 'cargoIcon'
    cargoIcon.position.set(0, 0.98, 0)
    cargoIcon.scale.set(3.1, 3.1, 1)
    cargoIcon.renderOrder = 500
    cargo.add(cargoIcon)
    // Ground ring at the carrier's feet, tinted by the resource: the clearest
    // "this one is loaded" cue at game zoom, independent of the crate.
    const carryRing = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.78, 24),
      new THREE.MeshBasicMaterial({ color: 0xbef05a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    )
    carryRing.name = 'carryRing'
    carryRing.rotation.x = -Math.PI / 2
    carryRing.position.set(0, -2.27, 0)
    cargo.add(carryRing)
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
  // Team-coloured crest for foot units: a small plume/standard that makes the
  // side readable at game zoom without resorting to emissive glow.
  const crestRole = UNIT_DEFS[u.utype]?.role
  if (crestRole === 'infantry' || crestRole === 'ranged') {
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 6), paintMat(teamC, 0.4, 0.2))
    crest.name = 'crest'
    crest.position.set(0, 1.62, -0.02)
    crest.castShadow = true
    g.add(crest)
    const crestTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), paintMat(teamC, 0.35, 0.25))
    crestTip.position.set(0, 1.86, -0.02)
    g.add(crestTip)
  }
  const sel = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0x7dffb2, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }))
  sel.rotation.x = -Math.PI / 2; sel.position.y = 0.06; sel.name = 'sel'; sel.visible = false; g.add(sel)
  return g
}

function buildingBase(x: number, z: number, h: number, color: number, teamC: number): THREE.Group {
  const g = new THREE.Group()
  addContactShadow(g, Math.max(x, z) * 0.65, 0.26)
  const platform = new THREE.Mesh(new THREE.BoxGeometry(x + 0.6, 0.22, z + 0.6), mat(0x8a7e6e, { roughness: 0.95 }))
  platform.name = 'plinth'
  platform.position.y = 0.11; platform.receiveShadow = true; platform.castShadow = true; g.add(platform)
  const base = new THREE.Mesh(new THREE.BoxGeometry(x, h, z), mat(color, { roughness: 0.88, metalness: 0.05 }))
  base.name = 'body'
  base.position.y = h / 2; base.castShadow = true; base.receiveShadow = true; g.add(base)
  // Bold team-coloured band: ownership has to read at a glance (whose base is this).
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(x + 0.16, 0.42, z + 0.16),
    new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.22, roughness: 0.5, metalness: 0.2 }),
  )
  trim.name = 'teamTrim'
  trim.position.y = Math.min(h - 0.25, h * 0.62); trim.castShadow = true; g.add(trim)
  return g
}

function createBuildingMesh(b: BuildingEntity): THREE.Object3D {
  const teamC = TEAM_COLORS[b.team]
  const sz = ({ ayuntamiento: {x:8,z:8}, vivienda:{x:4,z:4}, cuartel:{x:6,z:6}, almacen:{x:4,z:4}, fabrica:{x:8,z:6}, torre:{x:3,z:3} } as any)[b.btype]
  let g: THREE.Group
  if (b.btype === 'ayuntamiento') {
    g = buildingBase(sz.x, sz.z, 2.4, 0x78695a, teamC)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.9, 2.6, 4), mat(0x5b4636, { roughness: 0.9 }))
    roof.name = 'roof' // applyEraDetails recolours it per era
    roof.position.y = 3.7; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 4.8, 8), mat(0x8a7a66))
    tower.position.set(2.5, 2.4, -2.5); tower.castShadow = true; g.add(tower)
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.1, 8), mat(0x4a3c32))
    towerRoof.position.set(2.5, 5.3, -2.5); g.add(towerRoof)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), mat(0x444))
    pole.position.set(2.5, 6.2, -2.5); g.add(pole)
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.12, side: THREE.DoubleSide }))
    banner.position.set(3.05, 6.4, -2.5); g.add(banner)
    // central dome: gives the town hall a unique skyline vs the other buildings
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8f8172).lerp(new THREE.Color(teamC), 0.5), emissive: teamC, emissiveIntensity: 0.16, roughness: 0.65, metalness: 0.18 }),
    )
    dome.position.y = 4.9; dome.castShadow = true; g.add(dome)
    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), mat(0xd7c07a))
    finial.position.y = 6.6; g.add(finial)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), paintMat(0xe8c964, 0.3, 0.6))
    orb.position.y = 7.2; g.add(orb)
    for (const [dx] of [[-2, 2], [0, 2], [2, 2]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0xbfd8f2, emissive: 0x6aa0c8, emissiveIntensity: 0.2, roughness: 0.2, metalness: 0.1 }))
      w.position.set(dx, 1.4, sz.z/2 + 0.02); g.add(w)
    }
  } else if (b.btype === 'vivienda') {
    g = buildingBase(sz.x, sz.z, 1.7, 0xb39a78, teamC)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.7, 4), mat(0x7a5a3e))
    roof.name = 'roof'
    roof.position.y = 2.55; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.1), mat(0x4a3828))
    door.position.set(0, 0.5, sz.z/2 + 0.06); g.add(door)
  } else if (b.btype === 'cuartel') {
    g = buildingBase(sz.x, sz.z, 2.0, 0x5b6674, teamC)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(sz.x * 0.62, 1.5, 4), mat(0x404854))
    roof.name = 'roof'
    roof.position.y = 2.95; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof)
    // low front courtyard wall so the barracks reads as an enclosed compound
    for (const wx of [-sz.x / 2 - 1.0, sz.x / 2 + 1.0]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 3.0), mat(0x6a6f78))
      wall.position.set(wx, 0.35, sz.z / 2 + 0.4); wall.castShadow = true; wall.receiveShadow = true; g.add(wall)
    }
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(sz.x + 0.4, 0.6, 0.35), mat(0x6a6f78))
    frontWall.position.set(0, 0.3, sz.z / 2 + 1.9); frontWall.receiveShadow = true; g.add(frontWall)
    const gate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.15), mat(0x2a2f36))
    gate.position.set(0, 0.6, sz.z/2 + 0.08); g.add(gate)
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.12), paintMat(teamC, 0.5, 0.2))
    emblem.position.set(0, 1.55, sz.z/2 + 0.08); g.add(emblem)
    // corner turrets + tall banner: barracks must read as a fortified compound
    for (const [cx, cz] of [[-sz.x/2 + 0.5, -sz.z/2 + 0.5], [sz.x/2 - 0.5, -sz.z/2 + 0.5], [-sz.x/2 + 0.5, sz.z/2 - 0.5], [sz.x/2 - 0.5, sz.z/2 - 0.5]]) {
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.4, 8), mat(0x5b6674))
      turret.position.set(cx, 1.7, cz); turret.castShadow = true; g.add(turret)
      const tcap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.9, 8), paintMat(teamC, 0.5, 0.2))
      tcap.position.set(cx, 3.85, cz); tcap.castShadow = true; g.add(tcap)
    }
    const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), mat(0x3a3a3a))
    fpole.position.set(0, 3.4, 0); g.add(fpole)
    const bflag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.14, side: THREE.DoubleSide }))
    bflag.position.set(0.58, 4.35, 0); g.add(bflag)
  } else if (b.btype === 'fabrica') {
    g = buildingBase(sz.x, sz.z, 2.2, 0x6b7280, teamC)
    for (let i = -1; i <= 1; i++) {
      const saw = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, sz.z + 0.3), mat(0x4a5561))
      if (i === 0) saw.name = 'roof'
      saw.position.set(i * 2.6, 2.75, 0); saw.rotation.x = 0.32; saw.castShadow = true; g.add(saw)
    }
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.82, 6.4, 12), mat(0x7a6a58))
    chimney.position.set(-sz.x / 2 + 1.1, 5.2, -sz.z / 2 + 1.1); chimney.castShadow = true; g.add(chimney)
    const chimney2 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.62, 5.4, 10), mat(0x6d5f50))
    chimney2.position.set(sz.x / 2 - 1.2, 4.9, -sz.z / 2 + 0.9); chimney2.castShadow = true; g.add(chimney2)
    // pale caps make the stacks pop against the roof at game zoom
    for (const [cxx, cyy, czz, rr] of [[-sz.x / 2 + 1.1, 8.45, -sz.z / 2 + 1.1, 0.68], [sz.x / 2 - 1.2, 7.65, -sz.z / 2 + 0.9, 0.5]]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.08, rr + 0.08, 0.22, 10), mat(0xcfc7ba))
      cap.position.set(cxx, cyy, czz); g.add(cap)
    }
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.3, 12), paintMat(teamC, 0.5, 0.2))
    band.position.set(-sz.x / 2 + 1.1, 7.6, -sz.z / 2 + 1.1); g.add(band)
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 3.0, 8), paintMat(0x8a8f96, 0.6, 0.3))
    vent.position.set(0.6, 3.6, -sz.z / 2 + 0.5); vent.castShadow = true; g.add(vent)
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
    roof.name = 'roof'
    roof.position.y = 1.65; g.add(roof)
    for (let i = -1; i <= 1; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), mat(0x8f7350))
      crate.position.set(i * 0.9, 0.25, sz.z/2 + 0.7); crate.castShadow = true; g.add(crate)
    }
    // slanted loading awning: warehouse reads as a low wide shed
    const awning = new THREE.Mesh(new THREE.BoxGeometry(sz.x + 0.6, 0.12, 1.8), mat(0x6b5a44))
    awning.position.set(0, 1.25, sz.z / 2 + 1.15); awning.rotation.x = 0.28; awning.castShadow = true; g.add(awning)
    for (const px of [-sz.x / 2 + 0.3, sz.x / 2 - 0.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.16), mat(0x5a4634))
      post.position.set(px, 0.65, sz.z / 2 + 1.95); g.add(post)
    }
  } else { // torre
    g = new THREE.Group()
    addContactShadow(g, 1.7, 0.3)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 6.2, 12), mat(0x8a7e6e, { roughness: 0.95 }))
    base.name = 'body'
    base.position.y = 3.1; base.castShadow = true; base.receiveShadow = true; g.add(base)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.45, 12), paintMat(teamC, 0.5, 0.15))
    rim.name = 'roof'
    rim.position.y = 6.4; rim.castShadow = true; g.add(rim)
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const crenel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), mat(0x9a8e7c))
      crenel.position.set(Math.cos(ang) * 1.15, 6.9, Math.sin(ang) * 1.15); crenel.rotation.y = -ang; crenel.castShadow = true; g.add(crenel)
    }
    // pointed spire makes the tower read instantly as a tower
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.8, 8), paintMat(teamC, 0.5, 0.2))
    spire.position.y = 8.0; spire.castShadow = true; g.add(spire)
    const mount = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), paintMat(0x444c55, 0.5, 0.3))
    mount.position.y = 6.8; g.add(mount)
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.8, 8), paintMat(0x2a2a2a, 0.35, 0.5))
    gun.rotation.x = Math.PI / 2 - 0.55; gun.position.set(0, 7.1, 0.8); gun.castShadow = true; g.add(gun)
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), mat(0x444))
    flagPole.position.set(-0.5, 9.1, -0.4); g.add(flagPole)
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.12, side: THREE.DoubleSide }))
    flag.position.set(-0.12, 9.45, -0.4); g.add(flag)
  }
  // Ownership flag on the buildings that define a base (kept off torres: they
  // already carry one), so an enemy compound is unmistakably the other side's.
  if (b.btype === 'ayuntamiento' || b.btype === 'cuartel' || b.btype === 'fabrica') {
    const flagTop = b.btype === 'ayuntamiento' ? 7.0 : b.btype === 'cuartel' ? 4.6 : 4.4
    const off = Math.max(sz.x, sz.z) * 0.34
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), mat(0x2b2b2b))
    pole.position.set(off, flagTop, -off); pole.castShadow = true; g.add(pole)
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.9),
      new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.28, side: THREE.DoubleSide, roughness: 0.55 }),
    )
    flag.position.set(off + 0.78, flagTop + 0.8, -off); g.add(flag)
  }
  if (BUILDING_DEFS[b.btype]?.dropoff) {
    const r = Math.max(sz.x, sz.z) * 0.4
    const drop = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.95, r * 1.75, 48),
      new THREE.MeshBasicMaterial({ color: 0xffef8a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    )
    drop.rotation.x = -Math.PI / 2
    drop.position.y = 0.09
    drop.name = 'dropoff'
    drop.renderOrder = 220
    drop.visible = false
    g.add(drop)
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.32, r * 0.46, 6.0, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    beacon.position.y = 3.2
    beacon.name = 'dropoffBeacon'
    beacon.renderOrder = 221
    beacon.visible = false
    g.add(beacon)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.34, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xfffde0, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    cap.position.y = 6.4
    cap.name = 'dropoffCap'
    cap.renderOrder = 222
    cap.visible = false
    g.add(cap)
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

/** Town-hall roof/steel colour per era: wood -> gunmetal -> slate -> deep teal. */
const TOWNHALL_ROOF: Record<number, number> = {
  1: 0x5b4636,
  2: 0x4a4f57,
  3: 0x3d434b,
  4: 0x2f3a44,
}

/**
 * Era upgrades for the town hall, the way AoE2 rebuilds the Town Centre: the
 * same silhouette gains steel (era 2), a radio mast and amber beacons (era 3),
 * then solar panels, a dish and cyan light strips (era 4). Everything is added
 * exactly once per entity — the flags below are the guard, and the roof colour
 * is only touched when it actually changes (never on a ghosted material).
 */
function applyTownHallEra(o: THREE.Object3D, era: number): void {
  const anyO = o as any

  const roof = o.getObjectByName('roof') as THREE.Mesh | undefined
  if (roof) {
    // while ghosted the mesh borrows the shared ghost material: recolour only
    // the entity's own material, never the shared one
    const own = (roof.userData.origMaterial ?? roof.material) as THREE.MeshStandardMaterial
    const target = TOWNHALL_ROOF[Math.min(4, Math.max(1, era))] ?? TOWNHALL_ROOF[1]
    if (own && (own as any).isMeshStandardMaterial && anyO._roofEra !== target) {
      anyO._roofEra = target
      own.color.setHex(target)
    }
  }

  if (era >= 2 && !anyO._th2) {
    anyO._th2 = true
    // steel cupola over the apex + a working chimney on the front slope
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 1.5), paintMat(0x6b737d, 0.42, 0.6))
    cap.position.y = 4.44; cap.rotation.y = Math.PI / 4; cap.castShadow = true
    o.add(cap)
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.2, 10), paintMat(0x8d8577, 0.7, 0.2))
    chimney.position.set(-2.1, 3.9, 2.1); chimney.castShadow = true
    o.add(chimney)
    const chimneyTop = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.52), paintMat(0x55606b, 0.5, 0.4))
    chimneyTop.position.set(-2.1, 5.06, 2.1)
    o.add(chimneyTop)
    // steel window frames over the timber facade
    for (const dx of [-2.4, 0, 2.4]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.94, 0.08), paintMat(0x8f99a3, 0.35, 0.55))
      frame.position.set(dx, 1.4, 3.99)
      o.add(frame)
    }
  }

  if (era >= 3 && !anyO._th3) {
    anyO._th3 = true
    // radio mast over the corner tower + amber beacons along the eave
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), paintMat(0x4a525a, 0.4, 0.6))
    mast.position.set(2.5, 8.0, -2.5); mast.castShadow = true
    o.add(mast)
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffc06a, emissive: 0xffa53c, emissiveIntensity: 1.3, roughness: 0.3 }),
    )
    beacon.position.set(2.5, 9.25, -2.5)
    o.add(beacon)
    for (const dx of [-2.4, 0, 2.4]) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.14, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa53c, emissiveIntensity: 1.1, roughness: 0.3 }),
      )
      lamp.position.set(dx, 2.66, 3.9)
      o.add(lamp)
    }
  }

  if (era >= 4 && !anyO._th4) {
    anyO._th4 = true
    // solar panels on both roof slopes
    for (const sz2 of [1, -1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.08, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x1d3a5c, emissive: 0x2d6fb0, emissiveIntensity: 0.22, roughness: 0.25, metalness: 0.5 }),
      )
      panel.position.set(0, 3.78, sz2 * 1.72)
      panel.rotation.x = sz2 * -0.64
      panel.castShadow = true
      o.add(panel)
    }
    // taller mast with a dish, plus cyan strips on the facade
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.6, 6), paintMat(0x39424a, 0.35, 0.65))
    mast.position.set(2.5, 8.6, -2.5); mast.castShadow = true
    o.add(mast)
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 14), paintMat(0x9fb4c4, 0.3, 0.7))
    dish.position.set(2.5, 10.3, -2.5); dish.rotation.z = 0.35
    o.add(dish)
    for (const dx of [-2.0, 2.0]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.07, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.2 }),
      )
      strip.position.set(dx, 2.44, 4.02)
      o.add(strip)
    }
  }
}

function applyEraDetails(obj: THREE.Object3D, e: AnyEntity, era: number): void {
  const o = obj as any
  const isTownHall = e.kind === 'building' && e.btype === 'ayuntamiento'
  if (isTownHall) applyTownHallEra(obj, era)

  if (e.kind === 'building' && !isTownHall) {
    const b = e.btype
    // Palette progression by era so the jump is readable without HUD (within 3D ceiling)
    if (o._eraPalette !== era) {
      o._eraPalette = era
      const teamHue = new THREE.Color(TEAM_COLORS[e.team])
      const recolor = (name: string, color: number, emissive = 0x000000, ei = 0) => {
        const mesh = obj.getObjectByName(name) as THREE.Mesh | undefined
        if (!mesh) return
        const own = (mesh.userData.origMaterial ?? mesh.material) as THREE.MeshStandardMaterial
        if (own && (own as any).isMeshStandardMaterial) {
          // Lerp the era palette toward the team hue so a late-era base still reads
          // as "whose" it is (otherwise both sides go blue-grey at era 4).
          // Strong team tint (roofs especially): a late-era base must read as a side's
          // at a glance, so lean much harder toward the team hue than before.
          const teamMix = name === 'roof' ? 0.7 : 0.38
          own.color.setHex(color).lerp(teamHue, teamMix)
          if ('emissive' in own) { own.emissive.setHex(emissive); own.emissiveIntensity = ei }
          if ('metalness' in own) own.metalness = Math.max(own.metalness ?? 0, era >= 3 ? 0.18 : era >= 2 ? 0.1 : 0.05)
          if ('roughness' in own) own.roughness = era >= 4 ? Math.min(own.roughness ?? 0.8, 0.48) : era >= 3 ? Math.min(own.roughness ?? 0.8, 0.62) : (own.roughness ?? 0.8)
        }
      }
      // Stronger, more readable era shifts (esp. late-game silhouettes/material cues)
      if (b === 'vivienda') {
        if (era >= 4) { recolor('body', 0x7f97b4); recolor('roof', 0x22384d, 0x1b5ea0, 0.34); recolor('plinth', 0x73879b) }
        else if (era >= 3) { recolor('body', 0xa3a092); recolor('roof', 0x445362, 0x2a3f52, 0.08); recolor('plinth', 0x8b877d) }
        else if (era >= 2) { recolor('body', 0xb4a889); recolor('roof', 0x545d68); recolor('plinth', 0x948974) }
        else { recolor('body', 0xc7a86f); recolor('roof', 0x84562f); recolor('plinth', 0x8a7e6e) }
      } else if (b === 'cuartel') {
        if (era >= 4) { recolor('body', 0x44607d); recolor('roof', 0x1f3348, 0x123a63, 0.38); recolor('plinth', 0x5b7288) }
        else if (era >= 3) { recolor('body', 0x526779); recolor('roof', 0x334353, 0x1e3345, 0.1); recolor('plinth', 0x6a7b88) }
        else if (era >= 2) { recolor('body', 0x5b6d7d); recolor('roof', 0x3f4b59); recolor('plinth', 0x75818f) }
        else { recolor('body', 0x746a58); recolor('roof', 0x4a4338); recolor('plinth', 0x8a7e6e) }
      } else if (b === 'almacen') {
        if (era >= 4) { recolor('body', 0x6d86a3); recolor('roof', 0x2a3f55, 0x12324d, 0.3); recolor('plinth', 0x7489a0) }
        else if (era >= 3) { recolor('body', 0x828478); recolor('roof', 0x46525d, 0x243240, 0.08); recolor('plinth', 0x858477) }
        else if (era >= 2) { recolor('body', 0x8b8470); recolor('roof', 0x52514b); recolor('plinth', 0x8a8272) }
        else { recolor('body', 0x9a7a54); recolor('roof', 0x6b4a32); recolor('plinth', 0x8a7e6e) }
      } else if (b === 'fabrica') {
        if (era >= 4) { recolor('body', 0x486180); recolor('roof', 0x1d3248, 0x12395a, 0.34); recolor('plinth', 0x5d7288) }
        else if (era >= 3) { recolor('body', 0x5b6a7c); recolor('roof', 0x344454, 0x1b3245, 0.1); recolor('plinth', 0x6a7888) }
        else if (era >= 2) { recolor('body', 0x667586); recolor('roof', 0x404d5a); recolor('plinth', 0x778493) }
        else { recolor('body', 0x7b6a58); recolor('roof', 0x5a4a3a); recolor('plinth', 0x8a7e6e) }
      } else if (b === 'torre') {
        if (era >= 4) { recolor('body', 0x597493); recolor('roof', 0x294157, 0x12395a, 0.36); recolor('plinth', 0x6a8196) }
        else if (era >= 3) { recolor('body', 0x718091); recolor('roof', 0x455463, 0x1f3548, 0.12); recolor('plinth', 0x7d8996) }
        else if (era >= 2) { recolor('body', 0x808b97); recolor('roof', 0x55616d); recolor('plinth', 0x88929a) }
        else { recolor('body', 0x9a8a72); recolor('roof', 0x6a6254); recolor('plinth', 0x8a7e6e) }
      }
    }

    // Era 2: industrial steel reinforcements and utility details
    if (era >= 2 && !o._era2b) {
      o._era2b = true
      if (b === 'vivienda') {
        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), paintMat(0x7a6a58, 0.7, 0.15))
        chimney.position.set(1.1, 2.55, -0.6); chimney.castShadow = true; obj.add(chimney)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.12), paintMat(0x6b5a48, 0.6, 0.2))
        frame.position.set(0, 0.6, 2.05); obj.add(frame)
      } else if (b === 'cuartel') {
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.45, 0.6), paintMat(0x5b6674, 0.5, 0.25))
        parapet.position.set(0, 2.42, 3.1); parapet.castShadow = true; obj.add(parapet)
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.8), mat(0x6b5a45))
        crate.position.set(2.2, 0.35, 3.5); crate.castShadow = true; obj.add(crate)
        const butt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.6), paintMat(0x6a7482, 0.55, 0.3))
        butt.position.set(-2.7, 0.9, 2.6); butt.castShadow = true; obj.add(butt)
      } else if (b === 'almacen') {
        const awning = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 1.3), paintMat(0x5a4a38, 0.6, 0.1))
        awning.position.set(0, 1.88, 1.95); awning.rotation.x = 0.18; awning.castShadow = true; obj.add(awning)
      } else if (b === 'fabrica') {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 10), paintMat(0x6d7782, 0.5, 0.35))
        tank.position.set(3.2, 0.9, -2.2); tank.castShadow = true; obj.add(tank)
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), paintMat(0x555e68, 0.45, 0.4))
        pipe.rotation.x = Math.PI / 2; pipe.position.set(2.2, 1.3, -2.2); obj.add(pipe)
        const chimney2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 2.4, 8), mat(0x7a6a58))
        chimney2.position.set(-2.4, 1.2, -1.8); chimney2.castShadow = true; obj.add(chimney2)
      } else if (b === 'torre') {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.4, 12), paintMat(0x6a7280, 0.45, 0.45))
        plate.position.y = 3.35; plate.castShadow = true; obj.add(plate)
      } else {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.5), paintMat(0x4b5563, 0.45, 0.3))
        vent.position.set(0.9, 0.28, 0.9); vent.castShadow = true; obj.add(vent)
      }
    }
    // Era 3: electrification, sensors and stronger silhouettes
    if (era >= 3 && !o._era3b) {
      o._era3b = true
      if (b === 'vivienda') {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), mat(0x444))
        mast.position.set(-1.1, 3.35, 0.8); obj.add(mast)
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa53c, emissiveIntensity: 1.1 }))
        lamp.position.set(-1.1, 4.15, 0.8); obj.add(lamp)
        const dormer = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.9), paintMat(0x9aa3ad, 0.55, 0.2))
        dormer.position.set(0.8, 2.65, 0.2); dormer.castShadow = true; obj.add(dormer)
      } else if (b === 'cuartel') {
        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.45), new THREE.MeshStandardMaterial({ color: 0xffc06a, emissive: 0xff9a3c, emissiveIntensity: 1.2 }))
        beacon.position.set(0, 2.55, 0); obj.add(beacon)
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), paintMat(0x4a525a, 0.4, 0.6))
        antenna.position.set(-2.2, 3.3, -2.2); obj.add(antenna)
        const comm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.8), paintMat(0x5d6774, 0.45, 0.35))
        comm.position.set(-1.9, 2.45, 1.8); comm.castShadow = true; obj.add(comm)
      } else if (b === 'almacen') {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc060, emissiveIntensity: 1.1 }))
        lamp.position.set(0, 2.0, 2.1); obj.add(lamp)
        const ventBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.6), paintMat(0x6b7682, 0.5, 0.3))
        ventBox.position.set(-1.0, 1.75, -1.1); obj.add(ventBox)
      } else if (b === 'fabrica') {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.8), paintMat(0x59626d, 0.5, 0.35))
        vent.position.set(-2.6, 2.85, 1.4); vent.castShadow = true; obj.add(vent)
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12), mat(0x2b3138, { roughness: 0.4, metalness: 0.4 }))
        fan.rotation.z = Math.PI / 2; fan.position.set(-1.8, 2.85, 1.4); obj.add(fan)
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.0, 8), paintMat(0x626d78, 0.5, 0.3))
        stack.position.set(1.8, 3.2, 1.6); obj.add(stack)
      } else if (b === 'torre') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.1, 8, 20), paintMat(0x707a86, 0.4, 0.5))
        ring.rotation.x = Math.PI / 2; ring.position.y = 4.7; obj.add(ring)
        const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 0.9 }))
        sensor.position.set(0.9, 5.0, 0.4); obj.add(sensor)
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), paintMat(0x5a6674, 0.45, 0.4))
        pod.position.set(-0.8, 5.0, 0.2); obj.add(pod)
      }
    }
    // Era 4: high-tech panels, plating and emissive identity
    if (era >= 4 && !o._era4b) {
      o._era4b = true
      if (b === 'vivienda') {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.1), new THREE.MeshStandardMaterial({ color: 0x1d3a5c, emissive: 0x2d6fb0, emissiveIntensity: 0.28, roughness: 0.25, metalness: 0.5 }))
        panel.position.set(0, 3.0, -0.4); panel.rotation.x = -0.5; panel.castShadow = true; obj.add(panel)
        const strip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.15 }))
        strip.position.set(0, 1.45, 2.06); obj.add(strip)
        const aw2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.9), paintMat(0x2f4254, 0.4, 0.35))
        aw2.position.set(-0.9, 2.1, 1.4); aw2.rotation.x = 0.25; obj.add(aw2)
      } else if (b === 'cuartel') {
        const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.8, 5.4), paintMat(0x55606c, 0.45, 0.45))
        plateL.position.set(-3.25, 1.05, 0); plateL.castShadow = true; obj.add(plateL)
        const plateR = plateL.clone(); plateR.position.x = 3.25; obj.add(plateR)
        const strip = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.15 }))
        strip.position.set(0, 1.55, 3.1); obj.add(strip)
        const crest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.25), new THREE.MeshStandardMaterial({ color: 0x1d3a5c, emissive: 0x2d6fb0, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.5 }))
        crest.position.set(0, 2.75, 3.05); obj.add(crest)
      } else if (b === 'almacen') {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.3), new THREE.MeshStandardMaterial({ color: 0x1d3a5c, emissive: 0x2d6fb0, emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.5 }))
        panel.position.set(0, 2.0, -0.2); panel.rotation.x = -0.45; obj.add(panel)
        const strip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.0 }))
        strip.position.set(0, 1.05, 2.06); obj.add(strip)
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 1.0), paintMat(0x334455, 0.4, 0.35))
        canopy.position.set(0, 1.95, 1.7); canopy.rotation.x = 0.2; obj.add(canopy)
      } else if (b === 'fabrica') {
        const panelA = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.5), new THREE.MeshStandardMaterial({ color: 0x1d3a5c, emissive: 0x2d6fb0, emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.5 }))
        panelA.position.set(1.8, 3.05, -0.8); panelA.rotation.x = -0.45; obj.add(panelA)
        const panelB = panelA.clone(); panelB.position.set(-1.8, 3.05, -0.8); obj.add(panelB)
        const strip = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.15 }))
        strip.position.set(0, 1.4, 3.1); obj.add(strip)
        const catwalk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.9), paintMat(0x445566, 0.45, 0.4))
        catwalk.position.set(0, 2.6, 2.2); obj.add(catwalk)
      } else if (b === 'torre') {
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 14), paintMat(0x9fb4c4, 0.3, 0.7))
        dish.position.set(-0.6, 5.85, -0.4); dish.rotation.z = 0.3; obj.add(dish)
        const strip = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.06, 8, 24), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.0 }))
        strip.rotation.x = Math.PI / 2; strip.position.y = 4.15; obj.add(strip)
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.45, 10), new THREE.MeshStandardMaterial({ color: 0x23384a, emissive: 0x2d6fb0, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.45 }))
        cap.position.y = 5.35; obj.add(cap)
      } else {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.07, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.2 }),
        )
        strip.position.set(0, 1.2, 1.3); obj.add(strip)
      }
    }
  }

  if (e.kind === 'unit') {
    if (o._unitEraPalette !== era) {
      o._unitEraPalette = era
      const tintByEra = [0, 0x9b7a50, 0xa3acb8, 0x5f6d66, 0xb8d7ee]
      const strengthByEra = [0, 0.16, 0.2, 0.18, 0.22]
      const metalDelta = [0, -0.04, 0.06, 0.08, 0.14]
      const roughDelta = [0, 0.06, -0.04, 0.02, -0.12]
      const idx = Math.min(4, Math.max(1, era))
      const tint = new THREE.Color(tintByEra[idx])
      const strength = strengthByEra[idx]
      const teamHex = TEAM_COLORS[e.team]
      obj.traverse((c) => {
        const mesh = c as THREE.Mesh
        if (!mesh.isMesh) return
        const n = mesh.name
        if (n === 'blob' || n === 'teamring' || n === 'sel' || n.startsWith('dropoff') || n === 'cargo' || n === 'cargoMark') return
        const ud = mesh.userData
        const own = (ud.origMaterial ?? mesh.material) as any
        if (!own || !own.isMeshStandardMaterial) return
        if ((own.emissiveIntensity ?? 0) >= 0.45) return
        if (own.color && own.color.getHex() === teamHex) return
        if (ud._baseEraColor == null) ud._baseEraColor = own.color.getHex()
        if (ud._baseEraMetalness == null) ud._baseEraMetalness = own.metalness ?? 0.1
        if (ud._baseEraRoughness == null) ud._baseEraRoughness = own.roughness ?? 0.7
        own.color.setHex(ud._baseEraColor).lerp(tint, strength)
        own.metalness = THREE.MathUtils.clamp(ud._baseEraMetalness + metalDelta[idx], 0, 0.85)
        own.roughness = THREE.MathUtils.clamp(ud._baseEraRoughness + roughDelta[idx], 0.15, 1)
      })
    }
    const era3u = era >= 3 && !o._era3u
    const era4u = era >= 4 && !o._era4u
    if (era3u) {
      o._era3u = true
      const teamC = TEAM_COLORS[e.team]
      if (e.utype === 'blindado' || e.utype === 'tanque' || e.utype === 'cazacarros' || e.utype === 'mlrs' || e.utype === 'canon' || e.utype === 'tanque_autonomo') {
        const sensor = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.22, 0.22),
          new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 }),
        )
        sensor.position.set(0.35, 1.25, -0.2)
        obj.add(sensor)
      } else {
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.18), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 0.7 }))
        visor.position.set(0, 1.08, 0.16)
        obj.add(visor)
      }
    }
    if (era4u) {
      o._era4u = true
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 1.25 }),
      )
      core.position.set(0, 1.08, 0.18)
      obj.add(core)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 18), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x46d9ff, emissiveIntensity: 0.9 }))
      ring.rotation.x = Math.PI / 2
      ring.position.set(0, 0.12, 0)
      obj.add(ring)
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
    if (mesh.name.startsWith('dropoff')) return
    const ud = mesh.userData
    if (ghost) {
      if (!ud.origMaterial) {
        ud.origMaterial = mesh.material
        ud.origRenderOrder = mesh.renderOrder
        mesh.material = rc.ghostMaterial
      }
      // draw above the fog memory veil (overlay renderOrder 100, depthTest off)
      mesh.renderOrder = 110
    } else if (ud.origMaterial) {
      mesh.material = ud.origMaterial
      mesh.renderOrder = ud.origRenderOrder ?? 0
      ud.origMaterial = undefined
      ud.origRenderOrder = undefined
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
    // Economy legibility: the load on an engineer's back is the only thing that
    // tells a glance "this one is working". Colour = the resource it holds.
    if (u.utype === 'ingeniero') syncCargo(u, obj, moving, t)
    // Per-unit hit pip: one small star above the unit for ~1s after damage.
    const pipT = rc.hitPips.get(e.id)
    if (pipT != null) {
      let pip = obj.userData.hitPip as THREE.Sprite | undefined
      if (!pip) { pip = makeHitPip(); obj.add(pip); obj.userData.hitPip = pip }
      const rem = pipT - dt
      if (rem <= 0) { rc.hitPips.delete(e.id); pip.visible = false }
      else {
        rc.hitPips.set(e.id, rem)
        const k = rem / HIT_PIP_TIME
        pip.visible = true
        const s = 1.5 + 1.1 * (1 - k)
        pip.scale.set(s, s, 1)
        ;(pip.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 2.2)
      }
    } else {
      const pip = obj.userData.hitPip as THREE.Sprite | undefined
      if (pip) pip.visible = false
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
    // Subtle world beacon for active production/advancement context (readable in stills)
    if (b.built && !ghosted) {
      let active = false
      let prog = 0
      let color = 0x5fd4c6
      if (b.queue.length > 0) {
        const job = b.queue[0]
        active = true
        prog = Math.max(0, Math.min(1, 1 - job.remaining / Math.max(0.001, job.total)))
        color = 0x5fd4c6
      }
      if (b.btype === 'ayuntamiento' && e.team === 'player') {
        // game state context not passed here; keep production cue generic
      }
      let beacon = obj.getObjectByName('prodBeacon') as THREE.Mesh | undefined
      if (!beacon) {
        beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 0.7, 0.18, 18),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false }),
        )
        beacon.name = 'prodBeacon'
        beacon.position.set(0, 0.12, 0)
        beacon.rotation.x = 0
        obj.add(beacon)
      }
      const mat = beacon.material as THREE.MeshBasicMaterial
      if (active) {
        beacon.visible = true
        mat.color.setHex(color)
        const pulse = 0.5 + 0.5 * Math.sin(rc.clock.elapsedTime * 4.0 + e.id)
        mat.opacity = 0.35 + 0.35 * pulse
        const s = 1.1 + 0.5 * prog + 0.2 * pulse
        beacon.scale.set(s, 1, s)
      } else {
        beacon.visible = false
        mat.opacity = 0
      }
    }
    const dropoff = obj.getObjectByName('dropoff') as THREE.Mesh | undefined
    if (dropoff) {
      const showDrop = b.built && !ghosted
      dropoff.visible = showDrop
      if (showDrop) {
        const m = dropoff.material as THREE.MeshBasicMaterial
        m.opacity = 0.45 + 0.12 * (0.5 + 0.5 * Math.sin(rc.clock.elapsedTime * 2.8))
      }
    }
    const dropBeacon = obj.getObjectByName('dropoffBeacon') as THREE.Mesh | undefined
    if (dropBeacon) {
      // The floating additive column bloomed into a washed-out white blob over the
      // base; the ground ring alone marks the drop-off cleanly.
      dropBeacon.visible = false
    }
    const dropCap = obj.getObjectByName('dropoffCap') as THREE.Mesh | undefined
    if (dropCap) {
      dropCap.visible = false
    }
    // Wounded buildings smoke from the roof: the fog of war only reveals what
    // the observer can see, so a ghost (remembered) building never smokes.
    if (b.built && !ghosted && b.hp < b.maxHp * 0.5) {
      let smokeT = (obj.userData.smokeT as number | undefined) ?? 0
      smokeT += dt
      if (smokeT >= DAMAGE_SMOKE_INTERVAL) {
        smokeT = 0
        spawnBuildingSmoke(rc, e.x, gy + (BUILDING_SMOKE_Y[b.btype] ?? 3), e.z)
      }
      obj.userData.smokeT = smokeT
    } else {
      obj.userData.smokeT = 0
    }
  } else if (e.kind === 'resource') {
    const r = e as ResourceEntity
    const ratio = r.maxAmount > 0 ? r.amount / r.maxAmount : 0
    obj.scale.setScalar(0.6 + 0.4 * ratio)
    const pump = obj.getObjectByName('pump')
    if (pump) pump.rotation.z = Math.sin(rc.clock.elapsedTime * 2.2) * 0.18
    // Remaining amount, shown while the node still has resource (not only when
    // selected). The label counter-scales the node's shrink-to-depletion factor
    // so the digits keep the same size on screen until the node is gone.
    let label = obj.userData.nodeLabel as THREE.Sprite | undefined
    if (!label) {
      label = makeLabelSprite()
      obj.add(label)
      obj.userData.nodeLabel = label
      obj.userData.labelAmount = -1
    }
    label.visible = r.amount > 0
    if (label.visible) {
      const s = Math.abs(obj.scale.x) || 1
      label.scale.set(NODE_LABEL_SCALE_W / s, NODE_LABEL_SCALE_H / s, 1)
      label.position.set(0, NODE_LABEL_Y / s, 0)
      const shown = Math.ceil(r.amount)
      if (obj.userData.labelAmount !== shown) {
        obj.userData.labelAmount = shown
        updateNodeLabel(label, r.amount)
      }
    }
  }

  rc.prevPos.set(e.id, { x: e.x, z: e.z })

  obj.traverse((c) => { if (c.name === 'sel') c.visible = e.selected })

  // HP bar: created on demand, only for things that need it right now —
  // selected or wounded entities, never resources, never remembered ghosts.
  const needsBar = !ghosted && e.kind !== 'resource' && (e.selected || e.hp < e.maxHp)
  let hp = rc.hpBars.get(e.id)
  if (needsBar) {
    if (!hp) {
      hp = makeHpSprite()
      obj.add(hp)
      rc.hpBars.set(e.id, hp)
    }
    // The bar hangs off the (possibly scaled) entity group, so its size is
    // divided back out to keep a constant on-screen footprint. Its height stays
    // in local space: that is what keeps it glued just above the head/roof.
    const spec = hpBarSpec(e)
    const s = Math.abs(obj.scale.x) || 1
    hp.scale.set(spec.w / s, spec.h / s, 1)
    hp.position.set(spec.ox / s, spec.y, 0)
    hp.visible = true
    updateHpSprite(hp, e.hp / Math.max(1, e.maxHp), e.team)
  } else if (hp) {
    hp.visible = false
  }
}

/** Tint of an engineer's load, per resource (high-contrast for instant readability). */
const CARRY_COLORS: Record<ResourceKey, number> = {
  suministros: 0xbef05a,
  materiales: 0xd07a2a,
  combustible: 0x49d8ff,
  minerales: 0xe8f4ff,
}

/**
 * Load silhouette per resource, so the *shape* says which resource is carried
 * (logs are long, fuel drums are tall, ore is small) and not only the colour.
 */
const CARRY_SHAPE: Record<ResourceKey, [number, number, number]> = {
  materiales: [1.55, 0.7, 0.8],
  suministros: [1.0, 1.0, 1.0],
  combustible: [0.85, 1.35, 0.85],
  minerales: [0.75, 0.8, 0.75],
}

const CARRY_GLYPH: Record<ResourceKey, string> = {
  suministros: '🌾',
  materiales: '🪵',
  combustible: '⛽',
  minerales: '⛏',
}
const _cargoTex: Partial<Record<ResourceKey, THREE.CanvasTexture>> = {}
function cargoTexture(key: ResourceKey): THREE.CanvasTexture {
  if (_cargoTex[key]) return _cargoTex[key]!
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')!
  const col = '#' + CARRY_COLORS[key].toString(16).padStart(6, '0')
  ctx.fillStyle = 'rgba(8,10,14,0.55)'
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill()
  ctx.lineWidth = 10; ctx.strokeStyle = col; ctx.stroke()
  ctx.fillStyle = col
  ctx.beginPath(); ctx.arc(64, 64, 44, 0, Math.PI * 2); ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1
  ctx.font = '72px sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = col
  ctx.fillText(CARRY_GLYPH[key] || '■', 64, 70)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  _cargoTex[key] = tex
  return tex
}

/** Which resource dominates the engineer's load (deterministic tie-break). */
function dominantCarry(carrying: UnitEntity['carrying']): ResourceKey {
  let best: ResourceKey = 'suministros'
  let bestV = -1
  for (const k of Object.keys(CARRY_COLORS) as ResourceKey[]) {
    const v = (carrying as any)[k] ?? 0
    if (v > bestV) { bestV = v; best = k }
  }
  return best
}

/**
 * Show/hide and colour the engineer's cargo box, plus a small side-to-side
 * sway while walking so the load reads as weight instead of a floating cube.
 */
function syncCargo(u: UnitEntity, obj: THREE.Object3D, moving: boolean, t: number): void {
  const cargo = obj.getObjectByName('cargo')
  if (!cargo) return
  const carrying = u.carryAmount > 0.001
  cargo.visible = carrying
  if (!carrying) return
  const fill = Math.min(1, u.carryAmount / (UNIT_DEFS[u.utype]?.carry ?? 20))
  const returning = carrying && !u.gatherTargetId
  const key = dominantCarry(u.carrying)
  const shape = CARRY_SHAPE[key]
  const base = 1.0 + 0.45 * fill + (returning ? 0.12 : 0)
  cargo.scale.set(base * shape[0], base * shape[1], base * shape[2])
  const resColor = CARRY_COLORS[key]
  if (cargo.userData.resKey !== key) cargo.userData.resKey = key

  const pulse = 0.5 + 0.5 * Math.sin(t * (returning ? 10 : 6.5) + u.id)
  const m = (cargo as THREE.Mesh).material as THREE.Material
  if (m && (m as any).isMeshBasicMaterial) {
    const mb = m as THREE.MeshBasicMaterial
    mb.color.setHex(resColor)
    mb.opacity = 0.96 + pulse * 0.04
  } else if (m && (m as any).isMeshStandardMaterial) {
    const ms = m as THREE.MeshStandardMaterial
    ms.color.setHex(resColor)
    ms.emissive.setHex(resColor)
    ms.emissiveIntensity = 1.0 + 0.7 * fill + pulse * 0.3 + (returning ? 0.35 : 0)
  }
  const mark = cargo.getObjectByName('cargoMark') as THREE.Mesh | undefined
  if (mark) {
    const mm = mark.material as THREE.Material
    if (mm && (mm as any).isMeshBasicMaterial) {
      const mmb = mm as THREE.MeshBasicMaterial
      mmb.color.setHex(0xffffff)
      mmb.opacity = 1
    } else if (mm && (mm as any).isMeshStandardMaterial) {
      const mms = mm as THREE.MeshStandardMaterial
      mms.color.setHex(0xffffff)
      mms.emissive.setHex(0xffffff)
      mms.emissiveIntensity = 1.2 + 0.55 * fill + pulse * 0.35
    }
    mark.position.y = 0.58 + pulse * 0.05
  }
  const icon = cargo.getObjectByName('cargoIcon') as THREE.Sprite | undefined
  if (icon) {
    const im = icon.material as THREE.SpriteMaterial
    im.map = cargoTexture(key)
    im.color.setHex(0xffffff)
    im.opacity = 1
    im.needsUpdate = true
    const s = 2.2 + 0.5 * fill + pulse * 0.18 + (returning ? 0.3 : 0)
    icon.scale.set(s, s, 1)
    icon.position.y = 0.98 + pulse * 0.08 + (returning ? 0.1 : 0)
  }
  const ring = cargo.getObjectByName('carryRing') as THREE.Mesh | undefined
  if (ring) {
    const rm = ring.material as THREE.MeshBasicMaterial
    rm.color.setHex(0xffffff)
    rm.opacity = returning ? 1.0 : 0.85
    const rs = returning ? 1.15 : 1.0
    ring.scale.setScalar(rs)
  }
  const baseY = (cargo.userData.baseY as number | undefined) ?? 2.35
  const sway = moving ? Math.sin(t * 9 + u.id) : 0
  cargo.rotation.z = sway * 0.12
  cargo.position.x = sway * 0.04
  cargo.position.y = baseY + (moving ? Math.abs(sway) * 0.06 : pulse * 0.06) + (returning ? 0.14 : 0)
}

/** How long a unit keeps its "got hit" pip (long enough to survive capture settle). */
const HIT_PIP_TIME = 1.4

let _hitPipTex: THREE.CanvasTexture | null = null
function hitPipTexture(): THREE.CanvasTexture {
  if (_hitPipTex) return _hitPipTex
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, S, S)
  ctx.translate(S / 2, S / 2)
  ctx.fillStyle = 'rgba(255,238,180,0.95)'
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate((i / 4) * Math.PI * 2)
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(0, -27); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  _hitPipTex = tex
  return tex
}

function makeHitPip(): THREE.Sprite {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: hitPipTexture(), color: 0xffffff, transparent: true, opacity: 1,
    depthTest: false, depthWrite: false, toneMapped: false,
  }))
  sp.name = 'hitPip'
  sp.scale.set(1.6, 1.6, 1)
  sp.position.set(0, 2.35, 0)
  sp.renderOrder = 520
  sp.visible = false
  return sp
}

/**
 * Flags the unit that just took damage. A single crisp star per entity (not a
 * particle) reads the hit in stills without hundreds of quads accumulating.
 */
export function flashHitPip(rc: RenderContext, id: number): void {
  rc.hitPips.set(id, HIT_PIP_TIME)
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
      // sprites (hp bars, labels) share one internal geometry: never dispose it
      if (m.isMesh && m.geometry) m.geometry.dispose()
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
  // Prominent, persistent muzzle burst at shooter (reads in stills)
  const muzzle = acquireFx(rc, 'flash')
  if (muzzle) {
    muzzle.position.copy(from)
    muzzle.scale.setScalar(1.3)
    const mm = muzzle.material as THREE.MeshBasicMaterial
    mm.color.setHex(color)
    mm.opacity = 1.0
    rc.fxItems.push({
      kind: 'flash', mesh: muzzle, t: 0, life: 0.34,
      pos: muzzle.position.clone(), vel: new THREE.Vector3(),
      s0: 1.3, s1: 2.0, o0: 1.0, hold: 0.12,
    })
  }
  // Core beam (thick, bright, long hold for still captures)
  const mesh = acquireFx(rc, 'beam')
  if (mesh) {
    mesh.position.lerpVectors(from, to, 0.5)
    mesh.lookAt(to) // geometry runs along +Z, so this aims the streak
    const thick = 0.34
    mesh.scale.set(thick, thick, dist)
    const m = mesh.material as THREE.MeshBasicMaterial
    m.color.setHex(color)
    m.opacity = 1.0
    rc.fxItems.push({
      kind: 'beam', mesh, t: 0, life: 2.0,
      pos: mesh.position.clone(), vel: new THREE.Vector3(),
      s0: thick, s1: thick, o0: 0.9, hold: 1.1,
    })
  }
  // Glow sheath for extra readability at game zoom
  const glow = acquireFx(rc, 'beam')
  if (glow) {
    glow.position.lerpVectors(from, to, 0.5)
    glow.lookAt(to)
    const thick = 0.5
    glow.scale.set(thick, thick, dist)
    const gm = glow.material as THREE.MeshBasicMaterial
    gm.color.setHex(0xfff4c8)
    gm.opacity = 0.55
    rc.fxItems.push({
      kind: 'beam', mesh: glow, t: 0, life: 2.0,
      pos: glow.position.clone(), vel: new THREE.Vector3(),
      s0: thick, s1: thick, o0: 0.22, hold: 1.1,
    })
  }
}

/**
 * Muzzle flash: a camera-facing additive quad that blooms briefly. Pooled
 * apart from the tracers (cap 40) so a 30-unit volley cannot starve them.
 */
export function spawnMuzzleFlash(rc: RenderContext, x: number, y: number, z: number): void {
  const mesh = acquireFx(rc, 'muzzle')
  if (!mesh) return
  mesh.position.set(x, y, z)
  mesh.quaternion.copy(rc.camera.quaternion) // billboard, no per-frame lookAt
  mesh.scale.setScalar(1.5)
  const m = mesh.material as THREE.MeshBasicMaterial
  m.color.setHex(0xfff3cf)
  m.opacity = 1.0
  rc.fxItems.push({
    kind: 'muzzle', mesh, t: 0, life: 0.4,
    pos: mesh.position.clone(), vel: new THREE.Vector3(),
    s0: 1.5, s1: 2.6, o0: 1.0, hold: 0.14,
  })
}

/**
 * Impact: hot flash + shockwave ring + sparks, and a crater decal that stays on
 * the ground long enough for stills. Craters are capped so a long siege cannot
 * grow the scene without bound.
 */
export function spawnImpact(rc: RenderContext, x: number, y: number, z: number): void {
  const seed = hash2(x * 0.7, z * 1.3)

  // Sparks/debris: 10-12 per hit, deterministic count/spread from the impact point.
  const sparks = 7 + Math.floor(seed * 2)
  for (let i = 0; i < sparks; i++) {
    const mesh = acquireFx(rc, 'spark')
    if (!mesh) break
    const ang = (i / sparks) * Math.PI * 2 + (x + z) * 0.9
    const spread = 4.8 + (i % 3) * 1.7
    const size = 0.14 + ((i % 3) * 0.035)
    mesh.position.set(x, y, z)
    mesh.rotation.set(0, ang, 0)
    mesh.scale.setScalar(size)
    const m = mesh.material as THREE.MeshBasicMaterial
    m.color.setHex(i % 3 === 0 ? 0xffd06a : i % 3 === 1 ? 0xfff6d0 : 0xff8b3d)
    m.opacity = 1.0
    rc.fxItems.push({
      kind: 'spark', mesh, t: 0, life: 2.4,
      pos: mesh.position.clone(),
      vel: new THREE.Vector3(Math.cos(ang) * spread, 5.4 + (i % 3) * 1.8, Math.sin(ang) * spread),
      s0: size, s1: size, o0: 1.0,
    })
  }

}

/** Grey smoke rising from a wounded building's roof (presentation only). */
export function spawnBuildingSmoke(rc: RenderContext, x: number, y: number, z: number): void {
  const mesh = acquireFx(rc, 'puff')
  if (!mesh) return
  const seed = hash2(x * 0.31, z * 0.57)
  mesh.position.set(x + (seed - 0.5) * 1.2, y, z + (seed - 0.5) * 1.2)
  mesh.scale.setScalar(0.4)
  const m = mesh.material as THREE.MeshBasicMaterial
  m.color.setHex(seed > 0.55 ? 0x4b4b4b : 0x37373a)
  m.opacity = 0.5
  rc.fxItems.push({
    kind: 'puff', mesh, t: 0, life: 2.2,
    pos: mesh.position.clone(),
    vel: new THREE.Vector3((seed - 0.5) * 0.5, 1.15, (seed - 0.5) * 0.5),
    s0: 0.4, s1: 1.7, o0: 0.5,
  })
}

/**
 * Death footprint. A unit leaves wreckage, a body marker and a ground stain in
 * its team's colours (persistent for stills); a building leaves smoke plus
 * rubble and scorch. Both kinds are capped so a big battle does not turn into
 * a junkyard.
 */
export function spawnDeathFx(
  rc: RenderContext,
  x: number,
  z: number,
  entity: 'unit' | 'building',
  team: Team = 'player',
): void {
  const y = groundHeightAt(x, z)
  // smoke first: this is the part that reads instantly as "something died"
  const puffs = entity === 'building' ? 14 : 0
  for (let i = 0; i < puffs; i++) {
    const mesh = acquireFx(rc, 'puff')
    if (!mesh) break
    // deterministic spread from the index: no RNG in the render path
    const ang = (i / puffs) * Math.PI * 2 + (x + z) * 0.37
    const rad = 0.25 + (i % 3) * 0.38
    const scale = entity === 'building' ? 3.6 : 1.55
    mesh.position.set(x + Math.cos(ang) * rad, y + 0.5 + (i % 2) * 0.5, z + Math.sin(ang) * rad)
    mesh.scale.setScalar(0.46 * scale)
    const m = mesh.material as THREE.MeshBasicMaterial
    m.color.setHex(i % 2 === 0 ? 0x1e1e1e : 0x3a3530)
    m.opacity = 0.86
    rc.fxItems.push({
      kind: 'puff', mesh, t: 0, life: entity === 'building' ? 6.0 : 1.4,
      pos: mesh.position.clone(),
      vel: new THREE.Vector3(Math.cos(ang) * 1.2, 2.2 + (i % 3) * 0.55, Math.sin(ang) * 1.2),
      s0: 0.46 * scale, s1: 1.55 * scale, o0: 0.86,
    })
  }

  const seed = hash2(x * 0.83, z * 0.41)
  if (entity === 'building') {
    // Burned ground patch makes a destroyed building read clearly in stills.
    if (rc.fxLive.decal >= FX_LIVE_CAP.decal) evictOldest(rc, 'decal')
    const scorch = acquireFx(rc, 'decal')
    if (scorch) {
      const rad = 7.8 + seed * 2.0
      scorch.position.set(x, groundHeightAt(x, z) + 0.065, z)
      scorch.scale.set(rad, 1, rad)
      const m = scorch.material as THREE.MeshBasicMaterial
      m.color.setHex(0x100b07)
      m.opacity = 1.0
      rc.fxItems.push({
        kind: 'decal', mesh: scorch, t: 0, life: RUBBLE_LIFE,
        pos: scorch.position.clone(), vel: new THREE.Vector3(),
        s0: 1, s1: 1, o0: 1.0, hold: RUBBLE_HOLD,
      })
    }
    // secondary ember/crater mark
    if (rc.fxLive.decal >= FX_LIVE_CAP.decal) evictOldest(rc, 'decal')
    const ember = acquireFx(rc, 'decal')
    if (ember) {
      const rad = 4.2 + seed * 1.2
      ember.position.set(x + (seed - 0.5) * 1.2, groundHeightAt(x, z) + 0.068, z + (hash2(x, z) - 0.5) * 1.2)
      ember.scale.set(rad, 1, rad)
      const m = ember.material as THREE.MeshBasicMaterial
      m.color.setHex(0x1c1008)
      m.opacity = 0.95
      rc.fxItems.push({
        kind: 'decal', mesh: ember, t: 0, life: RUBBLE_LIFE,
        pos: ember.position.clone(), vel: new THREE.Vector3(),
        s0: 1, s1: 1, o0: 0.95, hold: RUBBLE_HOLD,
      })
    }
    if (rc.fxLive.rubble >= FX_LIVE_CAP.rubble) evictOldest(rc, 'rubble')
    const chunks = 18 + Math.floor(seed * 6) // 18-23, very notable rubble
    for (let i = 0; i < chunks; i++) {
      const mesh = acquireFx(rc, 'rubble')
      if (!mesh) break
      const ang = (i / chunks) * Math.PI * 2 + seed * 3.1
      const rad = 0.9 + (i % 6) * 1.0
      mesh.position.set(x + Math.cos(ang) * rad, y + 0.36, z + Math.sin(ang) * rad)
      mesh.rotation.set(0.34 * (i % 2), ang, 0.26 * ((i + 1) % 2))
      mesh.scale.set(3.0 + (i % 3) * 0.9, 0.9 + (i % 2) * 0.5, 2.7 + (i % 2) * 0.9)
      const m = mesh.material as THREE.MeshBasicMaterial
      m.color.setHex(i % 3 === 0 ? 0x363028 : i % 3 === 1 ? 0x5a5145 : 0x454038)
      m.opacity = 1
      rc.fxItems.push({
        kind: 'rubble', mesh, t: 0, life: RUBBLE_LIFE,
        pos: mesh.position.clone(), vel: new THREE.Vector3(),
        s0: 1, s1: 1, o0: 1, hold: RUBBLE_HOLD,
      })
    }
  } else {
    // larger, more contrasted wreck silhouette (persistent)
    if (rc.fxLive.wreck >= FX_LIVE_CAP.wreck) evictOldest(rc, 'wreck')
    const mesh = acquireFx(rc, 'wreck')
    if (mesh) {
      mesh.position.set(x, y + 0.34, z)
      mesh.rotation.set(0.26, seed * Math.PI * 2, 0.18)
      mesh.scale.set(4.8, 1.1, 6.4)
      const m = mesh.material as THREE.MeshBasicMaterial
      const base = new THREE.Color(team === 'enemy' ? 0x9a2020 : 0x2f55c0).multiplyScalar(0.9)
      m.color.setHex(base.lerp(new THREE.Color(0x0b0907), 0.38).getHex())
      m.opacity = 1
      rc.fxItems.push({
        kind: 'wreck', mesh, t: 0, life: WRECK_LIFE,
        pos: mesh.position.clone(), vel: new THREE.Vector3(),
        s0: 1, s1: 1, o0: 1, hold: WRECK_HOLD,
      })
    }
    // second piece for a clearer "body/rests" silhouette
    if (rc.fxLive.wreck >= FX_LIVE_CAP.wreck) evictOldest(rc, 'wreck')
    const mesh2 = acquireFx(rc, 'wreck')
    if (mesh2) {
      mesh2.position.set(x + (seed - 0.5) * 0.9, y + 0.26, z + (seed - 0.5) * 0.8)
      mesh2.rotation.set(0.1, seed * Math.PI * 2 + Math.PI / 2, 0.3)
      mesh2.scale.set(3.8, 0.9, 4.9)
      const m2 = mesh2.material as THREE.MeshBasicMaterial
      const base2 = new THREE.Color(team === 'enemy' ? 0x741515 : 0x2344a0).multiplyScalar(0.82)
      m2.color.setHex(base2.lerp(new THREE.Color(0x090807), 0.44).getHex())
      m2.opacity = 1
      rc.fxItems.push({
        kind: 'wreck', mesh: mesh2, t: 0, life: WRECK_LIFE,
        pos: mesh2.position.clone(), vel: new THREE.Vector3(),
        s0: 1, s1: 1, o0: 1, hold: WRECK_HOLD,
      })
    }
  }
}

/** Readable VFX for a resource delivery at a drop-off (unmistakable in stills). */
export function spawnDepositFx(
  rc: RenderContext,
  x: number,
  z: number,
  team: Team,
  resource?: ResourceKey,
): void {
  const y = groundHeightAt(x, z) + 0.2
  const ox = (hash2(x * 1.7, z * 0.9) - 0.5) * 1.2
  const oz = (hash2(x * 0.6, z * 1.4) - 0.5) * 1.2
  const px = x + ox
  const pz = z + oz
  const color = (resource && CARRY_COLORS[resource] != null) ? CARRY_COLORS[resource] : TEAM_COLORS[team]

  // Small persistent ground halo marking the drop-off (tinted by resource).
  if (rc.fxLive.decal >= FX_LIVE_CAP.decal) evictOldest(rc, 'decal')
  const halo = acquireFx(rc, 'decal')
  if (halo) {
    const rad = 2.2
    halo.position.set(px, groundHeightAt(px, pz) + 0.075, pz)
    halo.scale.set(rad, 1, rad)
    const m = halo.material as THREE.MeshBasicMaterial
    m.color.setHex(color)
    m.opacity = 0.5
    rc.fxItems.push({
      kind: 'decal', mesh: halo, t: 0, life: 3.6,
      pos: halo.position.clone(), vel: new THREE.Vector3(),
      s0: 1, s1: 1, o0: 0.5, hold: 2.2,
    })
  }

  // One compact expanding ring: reads as a delivery without blooming the scene.
  const ring = acquireFx(rc, 'ring')
  if (ring) {
    ring.position.set(px, y + 0.05, pz)
    ring.scale.setScalar(0.9)
    const m = ring.material as THREE.MeshBasicMaterial
    m.color.setHex(color)
    m.opacity = 0.85
    rc.fxItems.push({
      kind: 'ring', mesh: ring, t: 0, life: 1.6,
      pos: ring.position.clone(), vel: new THREE.Vector3(),
      s0: 0.8, s1: 3.4, o0: 0.6, hold: 0.5,
    })
  }

  // A few sparks for pop (kept low so many deliveries don't wash the base out).
  const seed = hash2(x * 0.4, z * 0.8)
  for (let i = 0; i < 8; i++) {
    const mesh = acquireFx(rc, 'spark')
    if (!mesh) break
    const ang = (i / 8) * Math.PI * 2 + seed * Math.PI * 2
    const size = 0.09 + (i % 3) * 0.03
    mesh.position.set(px, y + 0.3, pz)
    mesh.rotation.set(0, ang, 0)
    mesh.scale.setScalar(size)
    const m = mesh.material as THREE.MeshBasicMaterial
    m.color.setHex(i % 2 === 0 ? color : 0xfff8d0)
    m.opacity = 1.0
    rc.fxItems.push({
      kind: 'spark', mesh, t: 0, life: 1.2,
      pos: mesh.position.clone(),
      vel: new THREE.Vector3(Math.cos(ang) * 3.0, 4.6 + (i % 3) * 1.0, Math.sin(ang) * 3.0),
      s0: size, s1: size, o0: 1.0,
    })
  }

  // Tiny persistent impact scar: a small speck that marks where hits landed and
  // survives to the still. Deliberately MUCH smaller than the old crater decals
  // (rad 2.6) that merged into one big dark disc over a melee.
  if (rc.fxLive.decal >= FX_LIVE_CAP.decal) evictOldest(rc, 'decal')
  const scar = acquireFx(rc, 'decal')
  if (scar) {
    const rad = 0.42 + seed * 0.22
    scar.position.set(x, groundHeightAt(x, z) + 0.071, z)
    scar.scale.set(rad, 1, rad)
    const m = scar.material as THREE.MeshBasicMaterial
    m.color.setHex(0x1b130d)
    m.opacity = 0.55
    rc.fxItems.push({
      kind: 'decal', mesh: scar, t: 0, life: 40,
      pos: scar.position.clone(), vel: new THREE.Vector3(),
      s0: 1, s1: 1, o0: 0.55, hold: 30,
    })
  }
}

function fxMaterial(kind: FxKind): THREE.Material {
  switch (kind) {
    case 'beam':
      // normal blending: many simultaneous tracers must not stack into a white web
      return new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, depthWrite: false, toneMapped: false })
    case 'flash':
      // normal blending: overlapping hit flashes must not sum to white
      return new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, depthWrite: false, toneMapped: false })
    case 'ring':
      return new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    case 'muzzle':
      return new THREE.MeshBasicMaterial({ color: 0xfff0c6, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })
    case 'spark':
      // normal blending: hundreds of additive sparks were stacking into a bright cloud
      return new THREE.MeshBasicMaterial({ color: 0xffd06a, transparent: true, depthWrite: false, toneMapped: false })
    case 'decal':
      // a scorch/mark: slight polygon offset keeps it off the terrain
      return new THREE.MeshBasicMaterial({
        color: 0x100c08, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      })
    case 'wreck':
    case 'rubble':
      return new THREE.MeshBasicMaterial({ color: 0x3a3a38, transparent: true, opacity: 1, toneMapped: false })
    default:
      return new THREE.MeshBasicMaterial({ color: 0x2b2b2b, transparent: true, depthWrite: false })
  }
}

/**
 * Pooled mesh for a VFX kind, or null when the global or per-kind live cap is
 * reached. `fxLive` is the O(1) counter the caps and the eviction path rely on.
 */
function acquireFx(rc: RenderContext, kind: FxKind): THREE.Mesh | null {
  if (rc.fxLive[kind] >= FX_LIVE_CAP[kind]) return null
  if (rc.fxItems.length >= FX_MAX && rc.fxPool[kind].length === 0) return null
  const pool = rc.fxPool[kind]
  const pooled = pool.pop()
  rc.fxLive[kind]++
  if (pooled) {
    rc.fx.add(pooled)
    pooled.visible = true
    return pooled
  }
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
  it.mesh.quaternion.identity()
  it.mesh.scale.setScalar(1)
  rc.fxPool[it.kind].push(it.mesh)
  rc.fxLive[it.kind] = Math.max(0, rc.fxLive[it.kind] - 1)
}

/** Recycles a live item of a kind, preferring faded/finished props over ones still in hold. */
function evictOldest(rc: RenderContext, kind: FxKind): void {
  let candidate = -1
  let bestScore = -Infinity
  for (let i = 0; i < rc.fxItems.length; i++) {
    const it = rc.fxItems[i]
    if (it.kind !== kind) continue
    const fading = it.hold != null ? it.t > it.hold : it.t > it.life * 0.5
    // Prefer items already fading (higher progress/age) so held traces survive longer.
    const score = (fading ? 1000 : 0) + it.t
    if (score > bestScore) { bestScore = score; candidate = i }
  }
  if (candidate < 0) return
  releaseFx(rc, rc.fxItems[candidate])
  rc.fxItems.splice(candidate, 1)
}

export function updateFx(rc: RenderContext, dt: number): void {
  for (let i = rc.fxItems.length - 1; i >= 0; i--) {
    const it = rc.fxItems[i]
    it.t += dt
    const k = Math.min(1, it.t / it.life)
    // persistent props/FX with hold stay at full strength, then dissolve slowly
    const hold = it.hold
    const inHold = hold != null && it.t <= hold
    const fade = hold != null
      ? Math.max(0, Math.min(1, (it.t - hold) / Math.max(1e-4, it.life - hold)))
      : k
    const alpha = (hold != null ? (1 - fade) : (1 - k)) * it.o0
    const m = it.mesh.material as THREE.MeshBasicMaterial

    if (it.kind === 'puff') {
      it.mesh.position.copy(it.pos).addScaledVector(it.vel, it.t)
      m.opacity = (1 - k) * it.o0
      it.mesh.scale.setScalar(it.s0 + (it.s1 - it.s0) * k)
    } else if (it.kind === 'beam') {
      // tracer: keep full opacity/thickness during hold so it reads in stills
      m.opacity = alpha
      const w = it.s0 || 0.17
      const thin = inHold ? 0 : 0.22 * fade
      it.mesh.scale.x = it.mesh.scale.y = w * (1 - thin)
      // z (length) is fixed to distance
    } else if (it.kind === 'spark') {
      // ballistic arc, solved analytically so no per-particle state is needed
      it.mesh.position.copy(it.pos).addScaledVector(it.vel, it.t)
      it.mesh.position.y -= 4.5 * it.t * it.t
      it.mesh.rotation.x += dt * 12
      m.opacity = (1 - k) * it.o0
    } else if (it.kind === 'decal' || it.kind === 'wreck' || it.kind === 'rubble') {
      m.opacity = (1 - fade) * it.o0
    } else if (it.kind === 'ring' || it.kind === 'flash' || it.kind === 'muzzle') {
      // expand quickly, then stay prominent during hold and fade out
      m.opacity = alpha
      const grow = inHold ? Math.min(1, it.t / 0.15) : 1
      it.mesh.scale.setScalar(it.s0 + (it.s1 - it.s0) * grow)
      if (it.kind === 'muzzle') {
        // keep billboard facing camera while alive (cheap enough, pooled)
        it.mesh.quaternion.copy(rc.camera.quaternion)
      }
    } else {
      m.opacity = alpha
      it.mesh.scale.setScalar(it.s0 + (it.s1 - it.s0) * (hold != null ? (inHold ? 1 : 1) : k))
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
