import * as THREE from 'three'
import { COLORS, TUNING } from './config'
import { box, plane, type Box, type Plane } from './physics'

/** Un arco: dónde está su línea y cuánto mide la boca. */
export interface GoalSpec {
  /** z de la línea de gol. */
  lineZ: number
  /** +1 si el arco está en z positivo, -1 si no. Contra qué lado se ataca. */
  sign: 1 | -1
  halfWidth: number
  height: number
  depth: number
}

export interface BoostPad {
  pos: THREE.Vector3
  big: boolean
  /** Segundos que faltan para que reaparezca (0 = disponible). */
  cooldown: number
  active: boolean
  mesh: THREE.Mesh
}

export interface Arena {
  group: THREE.Group
  /** Todo lo que rebota la pelota: piso, paredes, techo y redes. */
  colliders: Box[]
  /** Sólo las paredes y redes: contra esto choca el auto (el piso lo maneja él). */
  walls: Box[]
  /** Rampas al pie de las paredes laterales: devuelven la pelota al campo. */
  planes: Plane[]
  /** [arco azul (z-), arco naranja (z+)]. */
  goals: GoalSpec[]
  pads: BoostPad[]
  update(dt: number): void
  /** Suma el boost recogido en `pos` y apaga los pads tocados. */
  tryPickup(pos: THREE.Vector3): number
  dispose(): void
}

const HALF_W = TUNING.fieldWidth / 2
const HALF_L = TUNING.fieldLength / 2
const WALL = TUNING.wallThickness
const GOAL_W = TUNING.goalHalfWidth
const GOAL_H = TUNING.goalHeight
const GOAL_D = TUNING.goalDepth
/** Las paredes sobresalen un poco del campo para que las esquinas no tengan hueco. */
const OVERHANG = 2

function buildFloorAndCeiling(): Box[] {
  const sx = TUNING.fieldWidth + 2 * WALL + 2 * OVERHANG
  const sz = TUNING.fieldLength + 2 * WALL + 2 * OVERHANG
  return [
    // Piso: de -1 a 0, así la pelota rueda sobre y=0.
    box(0, -WALL / 2, 0, sx, WALL, sz),
    box(0, TUNING.ceiling + WALL / 2, 0, sx, WALL, sz),
  ]
}

/**
 * Paredes de un extremo, partidas en tres para dejar la boca del arco.
 *
 * Es el truco que evita geometría con agujeros: no hace falta recortar nada,
 * simplemente se deja sin caja el rectángulo del arco y el hueco aparece solo.
 */
function buildEndWall(sign: 1 | -1): Box[] {
  const cz = sign * (HALF_L + WALL / 2)
  const fullHalf = HALF_W + WALL
  const sideSize = fullHalf - GOAL_W
  const sideCenter = (fullHalf + GOAL_W) / 2
  const topCenter = (GOAL_H + TUNING.ceiling) / 2
  const topSize = TUNING.ceiling - GOAL_H

  return [
    box(-sideCenter, TUNING.ceiling / 2, cz, sideSize, TUNING.ceiling, WALL),
    box(sideCenter, TUNING.ceiling / 2, cz, sideSize, TUNING.ceiling, WALL),
    box(0, topCenter, cz, GOAL_W * 2, topSize, WALL),
  ]
}

/** Red detrás de un arco: fondo, laterales y techo, para que el balón no escape. */
function buildNet(sign: 1 | -1): Box[] {
  const cz = sign * (HALF_L + WALL + GOAL_D / 2)
  const backZ = sign * (HALF_L + WALL + GOAL_D + 0.3)
  const sideX = GOAL_W + 0.25

  return [
    box(0, GOAL_H / 2 + 0.3, backZ, (GOAL_W + 0.5) * 2, GOAL_H + 0.6, 0.6),
    box(-sideX, GOAL_H / 2, cz, 0.5, GOAL_H, GOAL_D),
    box(sideX, GOAL_H / 2, cz, 0.5, GOAL_H, GOAL_D),
    box(0, GOAL_H + 0.3, cz, (GOAL_W + 0.5) * 2, 0.6, GOAL_D),
  ]
}

export function buildArena(): Arena {
  const group = new THREE.Group()
  const colliders: Box[] = []
  const walls: Box[] = []
  const planes: Plane[] = []

  const wallMat = new THREE.MeshStandardMaterial({
    color: COLORS.wall,
    roughness: 0.8,
    metalness: 0.08,
  })
  const floorMat = new THREE.MeshStandardMaterial({
    color: COLORS.floor,
    roughness: 0.68,
    metalness: 0.05,
  })
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: COLORS.ceiling,
    roughness: 0.92,
    metalness: 0.02,
  })
  const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.floorLine })

  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()

  /**
   * Agrega una caja: malla para verla y colisionador para chocarla.
   *
   * Las paredes y el techo no proyectan sombra (`cast: false`) porque el sol
   * está bajo: si proyectaran, taparían media cancha y no se vería nada.
   */
  function addBox(
    b: Box,
    material: THREE.Material,
    opts: { collider?: boolean; wall?: boolean; cast?: boolean } = {},
  ): THREE.Mesh {
    const size = new THREE.Vector3().subVectors(b.max, b.min)
    const center = new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5)
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
    geometries.add(geometry)
    materials.add(material)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(center)
    mesh.castShadow = opts.cast !== false
    mesh.receiveShadow = true
    group.add(mesh)

    if (opts.collider !== false) colliders.push(b)
    if (opts.wall) walls.push(b)
    return mesh
  }

  // --- Piso y techo
  const [floor, ceiling] = buildFloorAndCeiling()
  addBox(floor!, floorMat, { cast: false })
  addBox(ceiling!, ceilingMat, { cast: false })

  // --- Paredes laterales
  const sideSx = WALL
  const sideSy = TUNING.ceiling
  const sideSz = TUNING.fieldLength + 2 * WALL + 2 * OVERHANG
  addBox(box(-(HALF_W + WALL / 2), sideSy / 2, 0, sideSx, sideSy, sideSz), wallMat, {
    wall: true,
    cast: false,
  })
  addBox(box(HALF_W + WALL / 2, sideSy / 2, 0, sideSx, sideSy, sideSz), wallMat, {
    wall: true,
    cast: false,
  })

  // --- Rampas al pie de las paredes laterales
  //
  // Sólo de las laterales: en las de fondo está la boca del arco y una rampa ahí
  // levantaría los remates al ras. El plano es infinito, pero como está inclinado
  // a 45° sólo alcanza a la franja pegada al piso.
  const ramp = TUNING.wallRamp
  planes.push(plane(-HALF_W + ramp, 0, 0, 1, 1, 0))
  planes.push(plane(HALF_W - ramp, 0, 0, -1, 1, 0))

  // --- Paredes de fondo y redes
  for (const sign of [-1, 1] as const) {
    for (const b of buildEndWall(sign)) addBox(b, wallMat, { wall: true, cast: false })
    for (const b of buildNet(sign)) addBox(b, wallMat, { wall: true, cast: false })
  }

  // --- Arcos: parantes y travesaña con el color del equipo
  for (const sign of [-1, 1] as const) {
    const color = sign < 0 ? COLORS.blue : COLORS.orange
    const goalMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.5,
    })
    const cz = sign * (HALF_L + WALL / 2)
    const postT = 0.42
    addBox(box(-GOAL_W, GOAL_H / 2, cz, postT, GOAL_H, WALL * 1.1), goalMat)
    addBox(box(GOAL_W, GOAL_H / 2, cz, postT, GOAL_H, WALL * 1.1), goalMat)
    addBox(box(0, GOAL_H, cz, GOAL_W * 2 + postT, postT, WALL * 1.1), goalMat)
  }

  // --- Zócalos luminosos
  //
  // Sin esto la cancha es un agujero negro: las paredes del mismo tono que el
  // fondo y el techo tapan el cielo. Un rectángulo que sigue el borde del piso
  // y otro pegado al techo alcanzan para entender dónde termina todo.
  const trimMat = new THREE.MeshBasicMaterial({ color: COLORS.trim })
  materials.add(trimMat)
  const trimBox = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz)
    geometries.add(geometry)
    const mesh = new THREE.Mesh(geometry, trimMat)
    mesh.position.set(cx, cy, cz)
    group.add(mesh)
  }
  const trimBase = 0.09
  const trimTop = TUNING.ceiling - 0.5
  const trimInset = 0.35
  const trimSide = 0.18
  for (const y of [trimBase, trimTop]) {
    // A lo largo de las paredes laterales y de las de fondo.
    trimBox(-HALF_W + trimInset, y, 0, trimSide, trimSide, TUNING.fieldLength)
    trimBox(HALF_W - trimInset, y, 0, trimSide, trimSide, TUNING.fieldLength)
    trimBox(0, y, -HALF_L + trimInset, TUNING.fieldWidth, trimSide, trimSide)
    trimBox(0, y, HALF_L - trimInset, TUNING.fieldWidth, trimSide, trimSide)
  }

  // --- Luces del techo
  //
  // La cara de abajo del techo mira al piso, así que la luz hemisférica le da su
  // color de suelo y queda negra. Estas tiras la convierten en un techo legible
  // (y con el bloom encendido parecen las luces de la cancha).
  const lampMat = new THREE.MeshBasicMaterial({ color: COLORS.lamp })
  materials.add(lampMat)
  for (const x of [-22, 0, 22]) {
    const geometry = new THREE.BoxGeometry(1.1, 0.16, TUNING.fieldLength * 0.8)
    geometries.add(geometry)
    const lamp = new THREE.Mesh(geometry, lampMat)
    lamp.position.set(x, TUNING.ceiling - 0.2, 0)
    group.add(lamp)
  }

  // --- Marcas del piso (sólo visuales)
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 4.85, 56), lineMat)
  geometries.add(ring.geometry)
  materials.add(lineMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.02
  group.add(ring)

  const halfLine = new THREE.Mesh(
    new THREE.BoxGeometry(TUNING.fieldWidth + 2 * WALL, 0.02, 0.16),
    lineMat,
  )
  geometries.add(halfLine.geometry)
  halfLine.position.y = 0.02
  group.add(halfLine)

  // Líneas transversales y longitudinales: sin referencias el piso es una sábana
  // y no se percibe la velocidad.
  for (const z of [-HALF_L / 2, HALF_L / 2]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(TUNING.fieldWidth, 0.02, 0.12), lineMat)
    geometries.add(line.geometry)
    line.position.set(0, 0.02, z)
    group.add(line)
  }
  for (const x of [-HALF_W / 2, HALF_W / 2]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, TUNING.fieldLength), lineMat)
    geometries.add(line.geometry)
    line.position.set(x, 0.02, 0)
    group.add(line)
  }

  // Área chica frente a cada arco.
  const boxDepth = 12
  for (const sign of [-1, 1] as const) {
    const z = sign * (HALF_L - boxDepth / 2)
    const area = new THREE.Mesh(
      new THREE.BoxGeometry(GOAL_W * 2 + 8, 0.02, 0.14),
      lineMat,
    )
    geometries.add(area.geometry)
    area.position.set(0, 0.02, z)
    group.add(area)
  }

  // --- Pads de boost
  const smallGeometry = new THREE.CylinderGeometry(
    TUNING.padPickRadius,
    TUNING.padPickRadius,
    0.09,
    20,
  )
  const bigGeometry = new THREE.CylinderGeometry(
    TUNING.padBigPickRadius,
    TUNING.padBigPickRadius,
    0.11,
    24,
  )
  geometries.add(smallGeometry)
  geometries.add(bigGeometry)
  const smallMat = new THREE.MeshBasicMaterial({ color: COLORS.pad })
  const bigMat = new THREE.MeshBasicMaterial({ color: COLORS.padBig })
  materials.add(smallMat)
  materials.add(bigMat)

  const padSpots: { x: number; z: number; big: boolean }[] = [
    // Grandes: centro de cada mitad y las cuatro esquinas del medio campo.
    { x: 35.84, z: 0, big: true },
    { x: -35.84, z: 0, big: true },
    { x: 30.72, z: 40.96, big: true },
    { x: -30.72, z: 40.96, big: true },
    { x: 30.72, z: -40.96, big: true },
    { x: -30.72, z: -40.96, big: true },
    // Chicos: repartidos en el campo (RL tiene 28; con estos alcanza y sobra).
    { x: 12.5, z: -25, big: false },
    { x: -12.5, z: -25, big: false },
    { x: 12.5, z: 25, big: false },
    { x: -12.5, z: 25, big: false },
    { x: 7, z: -12, big: false },
    { x: -7, z: -12, big: false },
    { x: 7, z: 12, big: false },
    { x: -7, z: 12, big: false },
    { x: 0, z: -18, big: false },
    { x: 0, z: 18, big: false },
    { x: 25, z: 0, big: false },
    { x: -25, z: 0, big: false },
    { x: 20, z: -34, big: false },
    { x: -20, z: -34, big: false },
    { x: 20, z: 34, big: false },
    { x: -20, z: 34, big: false },
  ]

  const pads: BoostPad[] = []
  for (const spot of padSpots) {
    const mesh = new THREE.Mesh(spot.big ? bigGeometry : smallGeometry, spot.big ? bigMat : smallMat)
    mesh.position.set(spot.x, spot.big ? 0.06 : 0.05, spot.z)
    group.add(mesh)
    pads.push({
      pos: new THREE.Vector3(spot.x, 0, spot.z),
      big: spot.big,
      cooldown: 0,
      active: true,
      mesh,
    })
  }

  const goals: GoalSpec[] = [
    { lineZ: -HALF_L, sign: -1, halfWidth: GOAL_W, height: GOAL_H, depth: GOAL_D },
    { lineZ: HALF_L, sign: 1, halfWidth: GOAL_W, height: GOAL_H, depth: GOAL_D },
  ]

  return {
    group,
    colliders,
    walls,
    planes,
    goals,
    pads,

    update(dt: number): void {
      for (const pad of pads) {
        if (pad.active) continue
        pad.cooldown -= dt
        if (pad.cooldown <= 0) {
          pad.cooldown = 0
          pad.active = true
          pad.mesh.visible = true
        }
      }
    },

    tryPickup(pos: THREE.Vector3): number {
      let gained = 0
      for (const pad of pads) {
        if (!pad.active) continue
        const radius = pad.big ? TUNING.padBigPickRadius : TUNING.padPickRadius
        const dx = pos.x - pad.pos.x
        const dz = pos.z - pad.pos.z
        // Sólo distancia horizontal: el auto está bajo, pero nunca al ras.
        if (dx * dx + dz * dz > radius * radius) continue
        gained += pad.big ? TUNING.padBigBoost : TUNING.padSmallBoost
        pad.active = false
        pad.cooldown = pad.big ? TUNING.padBigRespawn : TUNING.padSmallRespawn
        pad.mesh.visible = false
      }
      return gained
    },

    dispose(): void {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      group.clear()
    },
  }
}
