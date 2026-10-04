import * as THREE from 'three'
import { TUNING } from './config'
import { Rng } from './rng'

export interface Box {
  readonly min: THREE.Vector3
  readonly max: THREE.Vector3
}

export const box = (
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): Box => ({
  min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
  max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
})

/** Altura de la superficie de apoyo más alta bajo (x, z), o -Infinity. */
export function supportHeight(colliders: Box[], x: number, z: number): number {
  let best = -Infinity
  for (const c of colliders) {
    if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue
    if (c.max.y > best) best = c.max.y
  }
  return best
}

/**
 * Altura de la superficie bajo (x, z) cuya cima no supere `maxStep`.
 *
 * `maxStep = Infinity` devuelve el top más alto (útil para saber sobre qué
 * plataforma está un punto). Para mover un cuerpo hay que pasar
 * `TUNING.maxStepHeight`: así los muros y pilares cuentan como obstáculo y no
 * como suelo transitable.
 */
export function walkableHeight(
  colliders: Box[],
  x: number,
  z: number,
  maxStep: number,
): number {
  let best = -Infinity
  for (const c of colliders) {
    if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue
    if (c.max.y > maxStep) continue
    if (c.max.y > best) best = c.max.y
  }
  return best
}

/** Una escalera de acceso: desde el piso hasta el borde de una plataforma. */
export interface Stair {
  /** Eje sobre el que corre la escalera. */
  axis: 'x' | 'z'
  /** Coordenada del centro de la escalera en el eje perpendicular. */
  cross: number
  /** Sentido de ascenso: +1 hacia el borde, -1 alejándose. */
  away: 1 | -1
  /** Altura del último peldaño. */
  top: number
  /** Centro del primer peldaño (a nivel de piso). */
  foot: THREE.Vector3
  /** Punto de la plataforma al que se llega subiendo. */
  topPoint: THREE.Vector3
}

export interface Level {
  group: THREE.Group
  colliders: Box[]
  spawn: THREE.Vector3
  orbSpots: THREE.Vector3[]
  goldSpots: THREE.Vector3[]
  hazardSpots: THREE.Vector3[]
  powerSpots: { spot: THREE.Vector3; kind: PowerUpKind }[]
  enemyPatrols: { from: THREE.Vector3; to: THREE.Vector3 }[]
  /** Escaleras de acceso: las usan los enemigos para subir a las plataformas. */
  stairs: Stair[]
  seed: number
}

export type PowerUpKind = 'turbo' | 'doubleJump' | 'slowmo'

/** Profundidad de cada peldaño. Con rise 0.35 da una rampa de ~38°. */
const RUN_DEPTH = 0.45
/** Ancho de la escalera: suficiente para el cuerpo del jugador con holgura. */
const STAIR_WIDTH = 3
/** El pie de la escalera no puede pasar de aquí sin chocar con el muro. */
const STAIR_EDGE_MARGIN = 1
/** Lado de la retícula de alcanzabilidad, en unidades de mundo. */
const REACH_STEP = 0.3

interface Platform {
  cx: number
  top: number
  cz: number
  sx: number
  sz: number
}

/** Dónde va la escalera de una plataforma, ya validada contra los muros. */
interface StairPlan {
  axis: 'x' | 'z'
  /** Coordenada del borde de la plataforma sobre `axis`. */
  edge: number
  /** Coordenada del centro en el eje perpendicular. */
  cross: number
  /** Sentido de crecimiento, alejándose del centro de la arena. */
  dir: 1 | -1
}

/** Largo horizontal que necesita una escalera para subir `height`. */
export function stairRun(height: number): number {
  const steps = Math.max(1, Math.ceil(height / TUNING.stepHeight))
  return RUN_DEPTH * steps
}

/**
 * Elige el eje, borde y sentido de la escalera de una plataforma, o devuelve
 * `null` si no cabe dentro de la arena.
 *
 * Prefiere el lado corto de la plataforma (ahí entra la escalera de 3 de ancho
 * con el margen del jugador) y, si en ese eje el pie invade el muro perimetral,
 * prueba el otro antes de renunciar.
 */
function planStair(
  cx: number,
  cz: number,
  sx: number,
  sz: number,
  top: number,
  usable: number,
): StairPlan | null {
  const run = stairRun(top)

  const attempt = (useX: boolean): StairPlan | null => {
    const cross = useX ? cz : cx
    const size = useX ? sx : sz
    const center = useX ? cx : cz

    // El borde accesible es el más cercano al centro: si el centro está en el
    // lado negativo de la arena, el borde es el de mayor coordenada.
    const dir: 1 | -1 = center < 0 ? 1 : -1
    const edge = center + (dir * size) / 2
    const foot = edge + dir * run

    // El pie tiene que quedar dentro del área usable con el ancho de la
    // escalera y el margen del cuerpo del jugador.
    const limit = usable - STAIR_EDGE_MARGIN
    if (Math.abs(foot) + STAIR_WIDTH / 2 > limit) return null

    return { axis: useX ? 'x' : 'z', edge, cross, dir }
  }

  // Primero el lado corto; si no entra, el otro eje.
  return attempt(sx >= sz) ?? attempt(sx < sz)
}

interface Materials {
  floor: THREE.Material
  platform: THREE.Material
  pillar: THREE.Material
  wall: THREE.Material
  edge: THREE.Material
}

function createMaterials(): Materials {
  return {
    floor: new THREE.MeshStandardMaterial({
      color: 0x1b2130,
      roughness: 0.92,
      metalness: 0.05,
    }),
    platform: new THREE.MeshStandardMaterial({
      color: 0x2f3a55,
      roughness: 0.7,
      metalness: 0.12,
    }),
    pillar: new THREE.MeshStandardMaterial({
      color: 0x39435e,
      roughness: 0.6,
      metalness: 0.2,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0x141926,
      roughness: 1,
      metalness: 0,
    }),
    edge: new THREE.MeshBasicMaterial({ color: 0x57e0c8 }),
  }
}

function addBoxMesh(
  group: THREE.Group,
  material: THREE.Material,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material)
  mesh.position.set(cx, cy, cz)
  group.add(mesh)
}

/**
 * Flood-fill de las superficies que el jugador puede recorrer desde el spawn.
 *
 * Replica el criterio de `PlayerController`: un peldaño es escalable si su
 * cima no supera `maxStepHeight` por encima de los pies, y el cuerpo tiene que
 * caber. Devuelve el conjunto de casillas alcanzables indexadas por
 * `surfaceKey`, en el mismo paso que usa el consumidor.
 */
function computeReachable(colliders: Box[], spawn: THREE.Vector3): Set<string> {
  const seen = new Set<string>()
  const step = REACH_STEP
  const limit = TUNING.arenaSize / 2 - TUNING.playerRadius

  // El recorrido arranca en la celda de la retícula que contiene al spawn.
  const sx = snap(spawn.x, step)
  const sz = snap(spawn.z, step)
  const startY = steppableFrom(colliders, sx, sz, spawn.y + 5)
  seen.add(cellKey(sx, sz, startY))
  const stack: Array<[number, number, number]> = [[sx, startY, sz]]

  while (stack.length > 0) {
    const [cx, cy, cz] = stack.pop() as [number, number, number]
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx * step
      const nz = cz + dz * step
      if (Math.abs(nx) > limit || Math.abs(nz) > limit) continue
      const ny = steppableFrom(colliders, nx, nz, cy)
      if (ny === -Infinity) continue
      if (Math.abs(ny - cy) > TUNING.maxStepHeight + 1e-6) continue
      if (!bodyFits(colliders, nx, nz, ny)) continue
      const k = cellKey(nx, nz, ny)
      if (seen.has(k)) continue
      seen.add(k)
      stack.push([nx, ny, nz])
    }
  }
  return seen
}

/** Alinea un valor a la retícula global. */
function snap(v: number, step: number): number {
  return Math.round(v / step) * step
}

/**
 * Clave de una casilla sobre una retícula global de `step`.
 *
 * Cuantizar a la retícula (y no redondear la coordenada cruda) es lo que hace
 * que el flood fill y las consultas de alcanzabilidad coincidan: el recorrido
 * parte del spawn, pero los coleccionables se sortean en cualquier punto, y
 * sin una retícula compartida cada sonda caería en una celda distinta.
 */
function cellKey(x: number, z: number, y: number): string {
  return `${Math.round(x / REACH_STEP)}|${Math.round(z / REACH_STEP)}|${Math.round(y / REACH_STEP)}`
}

/** Cima pisable desde unos pies a `feetY`: la más alta dentro de un peldaño. */
function steppableFrom(
  colliders: Box[],
  x: number,
  z: number,
  feetY: number,
): number {
  const r = TUNING.playerRadius
  let best = -Infinity
  for (const b of colliders) {
    const qx = clamp(x, b.min.x, b.max.x)
    const qz = clamp(z, b.min.z, b.max.z)
    const dx = x - qx
    const dz = z - qz
    if (dx * dx + dz * dz >= r * r) continue
    if (b.max.y <= feetY + TUNING.maxStepHeight + 1e-6 && b.max.y > best) best = b.max.y
  }
  return best
}

/** ¿El cuerpo del jugador cabe apoyado en (x, z) a la altura `feetY`? */
function bodyFits(colliders: Box[], x: number, z: number, feetY: number): boolean {
  const r = TUNING.playerRadius
  const h = TUNING.playerHeight
  for (const b of colliders) {
    const qx = clamp(x, b.min.x, b.max.x)
    const qz = clamp(z, b.min.z, b.max.z)
    const dx = x - qx
    const dz = z - qz
    if (dx * dx + dz * dz >= r * r) continue
    if (feetY >= b.max.y - TUNING.maxStepHeight) continue
    if (feetY + h <= b.min.y) continue
    return false
  }
  return true
}

/**
 * ¿El jugador, de pie en una superficie alcanzable, puede recolectar este
 * punto?
 *
 * El radio horizontal se deriva del radio real de recolección: el punto de
 * muestreo está a `playerHeight * 0.5` sobre los pies y el objeto a `clearance`,
 * así que la separación vertical es fija y el alcance horizontal es la parte
 * de la hipotenusa que sobra. Usar `collectRadius` plano aceptaba objetos a
 * 2.1 unidades de una casilla alcanzable que el jugador, con su radio de 1.6,
 * nunca podía tocar.
 */
function isCollectible(reachable: Set<string>, spot: THREE.Vector3, clearance: number): boolean {
  const surfaceY = spot.y - clearance
  const vertical = Math.abs(clearance - TUNING.playerHeight * 0.5)
  const horizontal = Math.sqrt(Math.max(0, TUNING.collectRadius ** 2 - vertical ** 2))
  if (horizontal <= 0) return false

  const cells = Math.ceil(horizontal / REACH_STEP)
  const bx = snap(spot.x, REACH_STEP)
  const bz = snap(spot.z, REACH_STEP)
  for (let ix = -cells; ix <= cells; ix++) {
    for (let iz = -cells; iz <= cells; iz++) {
      const dist = Math.hypot(ix, iz) * REACH_STEP
      if (dist > horizontal) continue
      // El jugador tiene que estar de pie en ESA misma superficie: la
      // tolerancia es un peldaño, no medio metro.
      for (let dy = -1; dy <= 1; dy += TUNING.maxStepHeight) {
        const y = surfaceY + dy
        if (Math.abs(y - surfaceY) > TUNING.maxStepHeight + 1e-6) continue
        if (reachable.has(cellKey(bx + ix * REACH_STEP, bz + iz * REACH_STEP, y))) return true
      }
    }
  }
  return false
}

/**
 * ¿El tramo de escalera de `plan` se superpone al cuerpo de la plataforma `q`?
 *
 * Un peldaño que atraviesa el costado de otra plataforma queda partido por
 * debajo: al subir, el jugador queda incrustado contra el muro lateral y no
 * puede completar el ascenso. Mejor descartar la plataforma nueva que dejar
 * una altura inalcanzable.
 */
function stairRectHitsPlatform(plan: StairPlan, top: number, q: Platform): boolean {
  const run = stairRun(top)
  const half = STAIR_WIDTH / 2

  // Rectángulo en planta que ocupa el tramo, con el ancho de la escalera.
  const aLo = Math.min(plan.edge, plan.edge + plan.dir * run)
  const aHi = Math.max(plan.edge, plan.edge + plan.dir * run)
  const bLo = plan.cross - half
  const bHi = plan.cross + half

  // `a` es el eje del tramo, `b` el transversal; se mapean a x/z según el eje.
  const platA =
    plan.axis === 'x'
      ? { lo: q.cx - q.sx / 2, hi: q.cx + q.sx / 2, blo: q.cz - q.sz / 2, bhi: q.cz + q.sz / 2 }
      : { lo: q.cz - q.sz / 2, hi: q.cz + q.sz / 2, blo: q.cx - q.sx / 2, bhi: q.cx + q.sx / 2 }

  return aLo < platA.hi - 0.1 && aHi > platA.lo + 0.1 && bLo < platA.bhi - 0.1 && bHi > platA.blo + 0.1
}

/**
 * ¿Un obstáculo de laje `size` en (cx, cz) bloquearía el paso por `stair`?
 *
 * Se mide contra el rectángulo que ocupa la escalera en planta, con el ancho
 * del cuerpo del jugador como margen, para que ningún pilar tape el tramo.
 */
function stairBlocks(stair: Stair, cx: number, cz: number, size: number): boolean {
  const pad = TUNING.playerRadius + size / 2
  const along = (lo: number, hi: number, c: number): boolean => c + pad >= lo && c - pad <= hi
  const cross = (lo: number, hi: number, c: number): boolean => c + pad >= lo && c - pad <= hi

  const ax = Math.min(stair.foot.x, stair.topPoint.x)
  const bx = Math.max(stair.foot.x, stair.topPoint.x)
  const az = Math.min(stair.foot.z, stair.topPoint.z)
  const bz = Math.max(stair.foot.z, stair.topPoint.z)

  // El rectángulo de la escalera tiene un ancho fijo en el eje transversal.
  if (stair.axis === 'x') {
    return along(ax, bx, cx) && cross(stair.cross - STAIR_WIDTH / 2, stair.cross + STAIR_WIDTH / 2, cz)
  }
  return cross(az, bz, cz) && along(stair.cross - STAIR_WIDTH / 2, stair.cross + STAIR_WIDTH / 2, cx)
}

/**
 * Genera una escalera que asciende hacia el borde de una plataforma.
 *
 * `edge` es la coordenada del borde de la plataforma sobre `axis`, `cross` la
 * coordenada del centro de la plataforma en el eje perpendicular, y `away` el
 * sentido (signo) hacia el exterior por donde se acerca el jugador. El último
 * peldaño queda pegado al borde y su altura coincide con el top de la
 * plataforma, así se puede caminar de una superficie a la otra sin chocar con
 * la pared lateral de la plataforma.
 */
function addStairs(
  colliders: Box[],
  group: THREE.Group,
  material: THREE.Material,
  axis: 'x' | 'z',
  edge: number,
  cross: number,
  away: 1 | -1,
  topHeight: number,
  width: number,
): Stair {
  const steps = Math.max(1, Math.ceil(topHeight / TUNING.stepHeight))
  const rise = topHeight / steps
  const footCenter = edge + away * RUN_DEPTH * (steps - 0.5)

  for (let i = 0; i < steps; i++) {
    const height = rise * (i + 1)
    const center = edge + away * RUN_DEPTH * (steps - i - 0.5)
    const cx = axis === 'x' ? center : cross
    const cz = axis === 'z' ? center : cross
    const sx = axis === 'x' ? RUN_DEPTH : width
    const sz = axis === 'z' ? RUN_DEPTH : width
    addBoxMesh(group, material, cx, height / 2, cz, sx, height, sz)
    colliders.push(box(cx, height / 2, cz, sx, height, sz))
  }

  return {
    axis,
    cross,
    away,
    top: topHeight,
    foot: new THREE.Vector3(
      axis === 'x' ? footCenter : cross,
      0,
      axis === 'z' ? footCenter : cross,
    ),
    topPoint: new THREE.Vector3(axis === 'x' ? edge : cross, topHeight, axis === 'z' ? edge : cross),
  }
}

/** Margen respecto del muro perimetral para no interpenetrarlo. */
const WALL_MARGIN = 4

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/**
 * Construye una arena completa a partir de una semilla. La geometría es
 * distinta en cada semilla, pero siempre respeta las invariantes que el
 * jugador necesita: toda plataforma con orbes es alcanzable por escaleras, no
 * hay orbes embebidos en la geometría y el spawn está despejado.
 */
export function buildLevel(scene: THREE.Scene, seed: number): Level {
  const rng = new Rng(seed)
  const group = new THREE.Group()
  scene.add(group)

  const colliders: Box[] = []
  const materials = createMaterials()
  const half = TUNING.arenaSize / 2
  const usable = half - WALL_MARGIN

  // Suelo
  addBoxMesh(group, materials.floor, 0, -0.5, 0, TUNING.arenaSize, 1, TUNING.arenaSize)
  colliders.push(box(0, -0.5, 0, TUNING.arenaSize, 1, TUNING.arenaSize))

  // Muros perimetrales
  const t = 1
  const h = TUNING.wallHeight
  const walls: Array<[number, number, number, number, number, number]> = [
    [0, h / 2, -half - t / 2, TUNING.arenaSize + t * 2, h, t],
    [0, h / 2, half + t / 2, TUNING.arenaSize + t * 2, h, t],
    [-half - t / 2, h / 2, 0, t, h, TUNING.arenaSize + t * 2],
    [half + t / 2, h / 2, 0, t, h, TUNING.arenaSize + t * 2],
  ]
  for (const [cx, cy, cz, sx, sy, sz] of walls) {
    addBoxMesh(group, materials.wall, cx, cy, cz, sx, sy, sz)
    colliders.push(box(cx, cy, cz, sx, sy, sz))
  }

  // --- Plataformas: se sortean en una grilla y se descartan las que se
  //     solapan, quedan cerca del spawn o no pueden tener escalera.
  //
  //     La escalera se dimensiona ANTES de aceptar la plataforma: si su pie
  //     cae contra el muro perimetral, la plataforma se descarta. Así toda
  //     plataforma en pie tiene garantizado un acceso, en vez de depender de
  //     un filtro posterior.
  const spawn = new THREE.Vector3(0, 1, usable * 0.6)
  const platformCount = TUNING.platformCount
  const platforms: Platform[] = []
  const platformPlans: Map<Platform, StairPlan> = new Map()

  for (let attempt = 0; attempt < 400 && platforms.length < platformCount; attempt++) {
    const cx = rng.range(-usable, usable)
    const cz = rng.range(-usable, usable)
    const sx = rng.range(6, 13)
    const sz = rng.range(6, 13)
    const top = rng.range(2, 6.5)

    // No bloquear la zona de spawn
    const nearSpawn =
      Math.abs(cx - spawn.x) < sx / 2 + 5 && Math.abs(cz - spawn.z) < sz / 2 + 5
    if (nearSpawn) continue

    // No solapar con plataformas ya placed
    const overlaps = platforms.some(
      (p) =>
        Math.abs(p.cx - cx) < (p.sx + sx) / 2 + 3 &&
        Math.abs(p.cz - cz) < (p.sz + sz) / 2 + 3,
    )
    if (overlaps) continue

    const plan = planStair(cx, cz, sx, sz, top, usable)
    if (!plan) continue

    // La escalera no puede atravesar otra plataforma ya aceptada: si el pie
    // cae sobre el cuerpo de una plataforma previa, el tramo queda partido y
    // la cima es inalcanzable.
    if (platforms.some((q) => stairRectHitsPlatform(plan, top, q))) continue

    const platform: Platform = { cx, top, cz, sx, sz }
    platforms.push(platform)
    platformPlans.set(platform, plan)
  }

  for (const p of platforms) {
    addBoxMesh(group, materials.platform, p.cx, p.top / 2, p.cz, p.sx, p.top, p.sz)
    colliders.push(box(p.cx, p.top / 2, p.cz, p.sx, p.top, p.sz))

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(p.sx + 0.06, 0.08, p.sz + 0.06),
      materials.edge,
    )
    edge.position.set(p.cx, p.top - 0.04, p.cz)
    group.add(edge)
  }

  // --- Escaleras: una por plataforma, asomando hacia el centro de la arena.
  //
  //     `dir` apunta desde el centro hacia el exterior: si la plataforma está
  //     en cx < 0, su borde accesible es el derecho y la escalera crece hacia
  //     -x. Invertir el signo empuja la escalera contra el muro perimetral y
  //     deja la altura inaccesible: era exactamente el bug.
  const stairs: Stair[] = []
  for (const p of platforms) {
    const plan = platformPlans.get(p)
    if (!plan) continue
    stairs.push(
      addStairs(
        colliders,
        group,
        materials.platform,
        plan.axis,
        plan.edge,
        plan.cross,
        plan.dir,
        p.top,
        STAIR_WIDTH,
      ),
    )
  }

  // --- Pilares: obstáculos bajos que rompen las líneas de visión.
  //     No pueden tapar una escalera: un pilar sobre el tramo deja la altura
  //     inaccesible, que es el peor fallo posible del generador.
  const pillarCount = TUNING.pillarCount
  for (let i = 0, attempt = 0; i < pillarCount && attempt < 300; attempt++) {
    const cx = rng.range(-usable, usable)
    const cz = rng.range(-usable, usable)
    const s = rng.range(1.6, 2.6)
    const ph = rng.range(2, 5)

    if (Math.abs(cx - spawn.x) < 5 && Math.abs(cz - spawn.z) < 5) continue
    const clash = platforms.some(
      (p) => Math.abs(p.cx - cx) < (p.sx + s) / 2 && Math.abs(p.cz - cz) < (p.sz + s) / 2,
    )
    if (clash) continue
    // Solape con el volumen de alguna escalera, con margen para el jugador.
    if (stairs.some((st) => stairBlocks(st, cx, cz, s))) continue

    addBoxMesh(group, materials.pillar, cx, ph / 2, cz, s, ph, s)
    colliders.push(box(cx, ph / 2, cz, s, ph, s))
    i++
  }

  // --- Alcanzabilidad: se calcula UNA vez con la geometría completa (suelo,
  //     plataformas, escaleras y pilares) y se usa para descartar cualquier
  //     coleccionable que el jugador no pueda recoger. Filtrar acá y no en el
  //     generador de orbes garantiza que la partida siempre sea completable,
  //     sin tener que predecir qué combinación de cajas corta una ruta.
  const reachable = computeReachable(colliders, spawn)

  // --- Orbes normales: repartidos entre plataformas, sobre su superficie.
  //     `placeOrb` garantiza una separación mínima respecto de todo lo ya
  //     colocado y descarta los puntos inalcanzables.
  const orbSpots: THREE.Vector3[] = []
  /** Coloca un orbe si es alcanzable y respeta la separación mínima. */
  const placeOrb = (x: number, z: number, y: number): boolean => {
    const candidate = new THREE.Vector3(x, y, z)
    if (!isCollectible(reachable, candidate, 1.6)) return false
    const ok = orbSpots.every((o) => o.distanceTo(candidate) >= TUNING.minOrbSeparation)
    if (ok) orbSpots.push(candidate)
    return ok
  }

  for (const p of platforms) {
    const perPlatform = Math.max(1, Math.floor(TUNING.orbCount / platforms.length))
    for (let i = 0; i < perPlatform && orbSpots.length < TUNING.orbCount; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const ox = clamp(p.cx + rng.range(-p.sx / 2 + 1.2, p.sx / 2 - 1.2), -usable, usable)
        const oz = clamp(p.cz + rng.range(-p.sz / 2 + 1.2, p.sz / 2 - 1.2), -usable, usable)
        if (placeOrb(ox, oz, p.top + 1.6)) break
      }
    }
  }
  // Completar sobre el suelo si faltaron
  for (let attempt = 0; attempt < 400 && orbSpots.length < TUNING.orbCount; attempt++) {
    const ox = rng.range(-usable, usable)
    const oz = rng.range(-usable, usable)
    const surface = supportHeight(colliders, ox, oz)
    if (surface === -Infinity) continue
    if (Math.abs(ox - spawn.x) < 4 && Math.abs(oz - spawn.z) < 4) continue
    placeOrb(ox, oz, surface + 1.6)
  }

  /** Elige un punto alcanzable sobre una superficie válida, libre de otros. */
  const pickGroundSpot = (
    occupied: readonly THREE.Vector3[],
    maxSurface: number,
    yOffset: number,
  ): THREE.Vector3 | null => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const ox = rng.range(-usable, usable)
      const oz = rng.range(-usable, usable)
      const surface = supportHeight(colliders, ox, oz)
      if (surface === -Infinity || surface > maxSurface) continue
      const candidate = new THREE.Vector3(ox, surface + yOffset, oz)
      if (!isCollectible(reachable, candidate, yOffset)) continue
      const free =
        orbSpots.every((o) => o.distanceTo(candidate) >= TUNING.minOrbSeparation) &&
        occupied.every((o) => o.distanceTo(candidate) >= TUNING.minOrbSeparation)
      if (free) return candidate
    }
    return null
  }

  // --- Orbes dorados (restan tiempo) y rojos (suman tiempo), ambos sobre el
  //     suelo, separados entre sí y de los orbes normales.
  const goldSpots: THREE.Vector3[] = []
  const hazardSpots: THREE.Vector3[] = []
  for (let i = 0; i < TUNING.goldCount; i++) {
    const spot = pickGroundSpot([...goldSpots, ...hazardSpots], 2.5, 1.6)
    if (spot) goldSpots.push(spot)
  }

  for (let i = 0; i < TUNING.hazardCount; i++) {
    const spot = pickGroundSpot([...goldSpots, ...hazardSpots], 2.5, 1.6)
    if (spot) hazardSpots.push(spot)
  }

  // --- Power-ups: sobre cualquier superficie alcanzable.
  const powerKinds: PowerUpKind[] = ['turbo', 'doubleJump', 'slowmo']
  const powerSpots: { spot: THREE.Vector3; kind: PowerUpKind }[] = []
  for (const kind of powerKinds) {
    const spot = pickGroundSpot(
      [...goldSpots, ...hazardSpots, ...powerSpots.map((x) => x.spot)],
      Infinity,
      1.2,
    )
    if (spot) powerSpots.push({ spot, kind })
  }

  // --- Enemigos: patrullas. La mitad patrulla el piso y la otra mitad sobre
  // plataformas, para que la amenaza exista también donde están los orbes.
  const enemyPatrols: { from: THREE.Vector3; to: THREE.Vector3 }[] = []
  const groundCount = Math.ceil(TUNING.enemyCount / 2)
  const elevatedCount = TUNING.enemyCount - groundCount

  for (let i = 0, attempt = 0; i < groundCount && attempt < 300; attempt++) {
    const cx = rng.range(-usable, usable)
    const cz = rng.range(-usable, usable)
    const surface = supportHeight(colliders, cx, cz)
    if (surface !== 0) continue
    if (Math.hypot(cx - spawn.x, cz - spawn.z) < 14) continue
    const angle = rng.range(0, Math.PI * 2)
    const span = rng.range(5, 10)
    const from = new THREE.Vector3(cx - Math.cos(angle) * span, 0, cz - Math.sin(angle) * span)
    const to = new THREE.Vector3(cx + Math.cos(angle) * span, 0, cz + Math.sin(angle) * span)
    if (
      Math.abs(from.x) > usable ||
      Math.abs(from.z) > usable ||
      Math.abs(to.x) > usable ||
      Math.abs(to.z) > usable
    ) {
      continue
    }
    enemyPatrols.push({ from, to })
    i++
  }

  // Patrullas elevadas: sobre el top de una plataforma, dentro de su borde.
  for (let i = 0, attempt = 0; i < elevatedCount && attempt < 300; attempt++) {
    const p = platforms[i % platforms.length]
    if (!p) continue
    const spanX = Math.max(1.5, p.sx / 2 - 1.5)
    const spanZ = Math.max(1.5, p.sz / 2 - 1.5)
    const horizontal = rng.next() < 0.5
    const span = horizontal ? spanX : spanZ
    const offsetA = rng.range(-span, span)
    const offsetB = rng.range(-span, span)
    const from = horizontal
      ? new THREE.Vector3(p.cx + offsetA, p.top, p.cz)
      : new THREE.Vector3(p.cx, p.top, p.cz + offsetA)
    const to = horizontal
      ? new THREE.Vector3(p.cx + offsetB, p.top, p.cz)
      : new THREE.Vector3(p.cx, p.top, p.cz + offsetB)
    if (from.distanceTo(to) < 2) continue
    enemyPatrols.push({ from, to })
    i++
  }

  return {
    group,
    colliders,
    spawn,
    orbSpots,
    goldSpots,
    hazardSpots,
    powerSpots,
    enemyPatrols,
    stairs,
    seed,
  }
}

/** Libera los recursos GPU del grupo y lo saca de la escena. */
export function disposeLevel(scene: THREE.Scene, level: Level): void {
  scene.remove(level.group)
  level.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}
