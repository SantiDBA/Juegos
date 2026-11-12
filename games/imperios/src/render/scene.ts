import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { MAP_SIZE, TEAM_COLORS } from '../core/config'
import type { AnyEntity, BuildingEntity, ResourceEntity, UnitEntity } from '../core/types'

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
  projectiles: ProjectileVfx[]
}

interface ProjectileVfx {
  mesh: THREE.Mesh
  from: THREE.Vector3
  to: THREE.Vector3
  t: number
  life: number
}

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
  const base = fbm(x * 0.03, z * 0.03) * 3.2 - 1.2
  const macro = Math.sin(x * 0.045) * 0.7 + Math.cos(z * 0.04) * 0.5
  const plateau = Math.max(0, 1 - Math.abs(fbm(x * 0.015 + 10, z * 0.015 + 4) - 0.45) * 3) * 0.9
  return base * 0.7 + macro * 0.25 + plateau
}

function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x5d86b8) },
      mid: { value: new THREE.Color(0xbfd6eb) },
      hor: { value: new THREE.Color(0xd7c6a8) },
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
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfd6eb)
  scene.fog = new THREE.FogExp2(0xc9d7de, 0.0036)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 700)

  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), skyMaterial())
  scene.add(sky)

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a3f2d, 0.65)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffe7c2, 2.25)
  sun.position.set(80, 120, 50)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const s = 110
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s; sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 320
  sun.shadow.bias = -0.00018
  sun.shadow.normalBias = 0.035
  scene.add(sun); scene.add(sun.target)
  const fill = new THREE.DirectionalLight(0x9fc0ff, 0.45)
  fill.position.set(-60, 50, -30)
  scene.add(fill)

  const seg = 128
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, seg, seg)
  const pos = groundGeo.attributes.position as THREE.BufferAttribute
  const colors: number[] = []
  const cLow = new THREE.Color(0x5b6240)
  const cMid = new THREE.Color(0x6f7446)
  const cHigh = new THREE.Color(0x7a7158)
  const cDirt = new THREE.Color(0x6a5a43)
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
    c.lerp(cDirt, THREE.MathUtils.clamp(slope * 1.8, 0, 0.45))
    const patch = fbm(x * 0.08 + 20, y * 0.08 - 7)
    c.offsetHSL((patch - 0.5) * 0.03, (patch - 0.5) * 0.05, (patch - 0.5) * 0.04)
    // cheap vertex AO: lower in local concavity approximation by noise variance
    const ao = THREE.MathUtils.clamp(0.78 + (h + 1.0) * 0.08 - slope * 0.25, 0.55, 1.0)
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
  ;(grid.material as THREE.Material).opacity = 0.05
  grid.position.y = 0.04
  scene.add(grid)

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
    target: new THREE.Vector3(0, 0, 0),
    camYaw: Math.PI * 0.25, camPitch: Math.PI / 3.25, camDist: 72,
    markers, fx, composer, bloom, projectiles: [],
  }
  updateCamera(rc)
  return rc
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

function makeLabelSprite(): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 32
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 12, 128, 10)
  ctx.fillStyle = '#5fd46b'; ctx.fillRect(1, 13, 126, 8)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sp = new THREE.Sprite(mat)
  sp.scale.set(3.4, 0.8, 1)
  ;(sp as any)._canvas = c; (sp as any)._ctx = ctx; (sp as any)._tex = tex
  return sp
}

export function updateHpSprite(sp: THREE.Sprite, ratio: number): void {
  const ctx = (sp as any)._ctx as CanvasRenderingContext2D
  const tex = (sp as any)._tex as THREE.CanvasTexture
  ctx.clearRect(0, 0, 128, 32)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 12, 128, 10)
  const r = Math.max(0, Math.min(1, ratio))
  ctx.fillStyle = r > 0.5 ? '#62d96b' : r > 0.25 ? '#e0c24a' : '#e05555'
  ctx.fillRect(1, 13, 126 * r, 8)
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

export function createMeshForEntity(e: AnyEntity): THREE.Object3D {
  if (e.kind === 'unit') return createUnitMesh(e)
  if (e.kind === 'building') return createBuildingMesh(e)
  return createResourceMesh(e)
}

function createUnitMesh(u: UnitEntity): THREE.Object3D {
  const g = new THREE.Group()
  const teamC = TEAM_COLORS[u.team]
  if (u.utype === 'ingeniero') {
    addContactShadow(g, 0.55, 0.22)
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
    addContactShadow(g, 0.6, 0.24)
    addTeamBase(g, u.team, 0.62)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.62, 4, 8), mat(0x47566a, { roughness: 0.85 }))
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
    addContactShadow(g, 0.58, 0.24)
    addTeamBase(g, u.team, 0.6)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), mat(0x4b5b45, { roughness: 0.85 }))
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
  } else { // blindado
    addContactShadow(g, 1.25, 0.3)
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
  }
  const sel = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0x7dffb2, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }))
  sel.rotation.x = -Math.PI / 2; sel.position.y = 0.06; sel.name = 'sel'; sel.visible = false; g.add(sel)
  return g
}

function buildingBase(x: number, z: number, h: number, color: number, teamC: number): THREE.Group {
  const g = new THREE.Group()
  addContactShadow(g, Math.max(x, z) * 0.65, 0.26)
  const base = new THREE.Mesh(new THREE.BoxGeometry(x, h, z), mat(color, { roughness: 0.88, metalness: 0.05 }))
  base.position.y = h / 2; base.castShadow = true; base.receiveShadow = true; g.add(base)
  const trim = new THREE.Mesh(new THREE.BoxGeometry(x + 0.12, 0.16, z + 0.12), paintMat(teamC, 0.5, 0.15))
  trim.position.y = Math.min(h - 0.15, h * 0.7); g.add(trim)
  return g
}

function createBuildingMesh(b: BuildingEntity): THREE.Object3D {
  const teamC = TEAM_COLORS[b.team]
  const sz = ({ ayuntamiento: {x:8,z:8}, vivienda:{x:4,z:4}, cuartel:{x:6,z:6}, almacen:{x:4,z:4} } as any)[b.btype]
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
  } else { // almacen
    g = buildingBase(sz.x, sz.z, 1.5, 0x8a7458, teamC)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(sz.x + 0.3, 0.3, sz.z + 0.3), mat(0x5e4a38))
    roof.position.y = 1.65; g.add(roof)
    for (let i = -1; i <= 1; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), mat(0x8f7350))
      crate.position.set(i * 0.9, 0.25, sz.z/2 + 0.7); crate.castShadow = true; g.add(crate)
    }
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
    const count = 6
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (i%2)*0.3
      const rad = 0.5 + (i%3)*0.35
      const h = 1.1 + (i%2)*0.25
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h, 6), mat(0x6b4a2e))
      trunk.position.set(Math.cos(ang)*rad, h/2, Math.sin(ang)*rad); trunk.castShadow = true; g.add(trunk)
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.65 + (i%2)*0.1, 1.5 + (i%2)*0.2, 7), mat(i%2?0x2f6a3a:0x365f34))
      leaves.position.set(trunk.position.x, h + 0.65, trunk.position.z); leaves.castShadow = true; g.add(leaves)
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

export function syncEntityMesh(rc: RenderContext, e: AnyEntity, dt: number, era = 1): void {
  let obj = rc.entityMeshes.get(e.id)
  if (!obj) {
    obj = createMeshForEntity(e)
    rc.scene.add(obj)
    rc.entityMeshes.set(e.id, obj)
    if (e.kind !== 'resource') {
      const hp = makeLabelSprite()
      hp.position.set(0, e.kind === 'building' ? 5.2 : 2.3, 0)
      obj.add(hp)
      rc.hpBars.set(e.id, hp)
    }
  }
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
    if (u.utype === 'blindado') {
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
      obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && 'transparent' in m) { m.transparent = true; m.opacity = 0.45 + 0.55 * p } } })
    } else {
      obj.scale.setScalar(1)
      obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && m.opacity !== undefined && m.transparent && (m as any).emissiveIntensity === undefined) { m.opacity = 1; m.transparent = false } } })
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
  const hp = rc.hpBars.get(e.id)
  if (hp && 'hp' in e) updateHpSprite(hp, e.hp / e.maxHp)
}

export function removeEntityMesh(rc: RenderContext, id: number): void {
  const obj = rc.entityMeshes.get(id)
  if (obj) {
    rc.scene.remove(obj)
    obj.traverse((c) => {
      const m = c as THREE.Mesh
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

export function spawnTracer(rc: RenderContext, from: THREE.Vector3, to: THREE.Vector3): void {
  const geom = new THREE.SphereGeometry(0.12, 6, 6)
  const matl = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffaa33, emissiveIntensity: 1.2, roughness: 0.3 })
  const mesh = new THREE.Mesh(geom, matl)
  mesh.position.copy(from)
  rc.fx.add(mesh)
  rc.projectiles.push({ mesh, from: from.clone(), to: to.clone(), t: 0, life: 0.18 })
}

export function updateFx(rc: RenderContext, dt: number): void {
  for (let i = rc.projectiles.length - 1; i >= 0; i--) {
    const p = rc.projectiles[i]
    p.t += dt
    const k = Math.min(1, p.t / p.life)
    p.mesh.position.lerpVectors(p.from, p.to, k)
    if (k >= 1) {
      rc.fx.remove(p.mesh)
      p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose()
      rc.projectiles.splice(i, 1)
    }
  }
}

export function renderFrame(rc: RenderContext, dt: number): void {
  updateFx(rc, dt)
  if (rc.composer) rc.composer.render()
  else rc.renderer.render(rc.scene, rc.camera)
}
