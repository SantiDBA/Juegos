import * as THREE from 'three'
import { COLORS, TUNING } from './config'
import { box, type Box } from './physics'
import { NEEDS, type NeedId } from './needs'
import { iconTexture } from './effects'

/** Un mueble con el que el gato puede hacer algo. */
export interface Station {
  readonly need: NeedId
  /** Centro de la zona de interacción. */
  readonly pos: THREE.Vector3
  readonly radius: number
  readonly icon: THREE.Sprite
  /** Dónde salen las partículas de la actividad: el agua, las migas, etc. */
  readonly effect: THREE.Vector3
  readonly effectColor: THREE.Color
}

export interface House {
  readonly group: THREE.Group
  /** Contra esto choca el gato: paredes, tabiques y muebles grandes. */
  readonly walls: Box[]
  /**
   * Paredes que pueden quedar entre la cámara y el gato. `main.ts` las
   * desvanece cuando tapan: con la cámara atrás, cualquier pared a menos de ~3,4
   * unidades del gato lo esconde entero.
   */
  readonly occluders: THREE.Mesh[]
  readonly stations: Station[]
  /** Apunta la flecha del piso hacia `target`, o la esconde si es null. */
  setGuide(from: THREE.Vector3, target: THREE.Vector3 | null): void
  update(dt: number, elapsed: number): void
  dispose(): void
}

// Medidas de la casa. El interior va de -HALF_X a HALF_X y de -HALF_Z a HALF_Z.
const HALF_X = 12
const HALF_Z = 9
/** Bajo a propósito: la cámara mira por encima y no se pierden los ambientes. */
const WALL_H = 2.6
const WALL_T = 0.4
/** Media apertura de los vanos del tabique en cruz. */
const DOOR_HALF = 2

const ICON_Y = TUNING.stationIconHeight

/**
 * Construye la casa: piso, paredes, una cruz de tabiques con vanos al centro y
 * los muebles de cada ambiente.
 *
 * El tabique en cruz deja cuatro cuartos en las esquinas y un hall abierto en
 * forma de cruz en el medio; cada cuarto se conecta al hall por su esquina
 * interior. Es un plano simple de leer y de recorrer, y evita laberintos.
 */
export function buildHouse(): House {
  const group = new THREE.Group()
  const walls: Box[] = []
  const occluders: THREE.Mesh[] = []
  const stations: Station[] = []
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()

  const mat = (options: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial(options)
    materials.add(material)
    return material
  }

  const floorMat = mat({ color: COLORS.floor, roughness: 0.82 })
  const seamMat = mat({ color: COLORS.floorSeam, roughness: 0.9 })
  const wallMat = mat({ color: COLORS.wall, roughness: 0.94 })
  const partitionMat = mat({ color: COLORS.partition, roughness: 0.94 })
  const woodMat = mat({ color: COLORS.wood, roughness: 0.6 })
  const metalMat = mat({ color: COLORS.fridge, roughness: 0.35, metalness: 0.5 })
  const porcelainMat = mat({ color: COLORS.tub, roughness: 0.25 })
  const waterMat = mat({
    color: COLORS.water,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
    emissive: COLORS.water,
    emissiveIntensity: 0.22,
  })
  const fabricMat = mat({ color: COLORS.sofa, roughness: 0.9 })
  const cushionMat = mat({ color: COLORS.cushion, roughness: 0.9 })
  const postMat = mat({ color: COLORS.post, roughness: 0.95 })
  const postBaseMat = mat({ color: COLORS.postBase, roughness: 0.95 })
  const bedMat = mat({ color: COLORS.bed, roughness: 0.9 })
  const sheetMat = mat({ color: COLORS.bedSheet, roughness: 0.95 })
  const sandMat = mat({ color: COLORS.litterSand, roughness: 1 })
  const litterBoxMat = mat({ color: COLORS.litterBox, roughness: 0.7 })
  const bowlMat = mat({ color: COLORS.bowl, roughness: 0.45 })
  const foodMat = mat({ color: COLORS.food, roughness: 0.85 })
  const plantMat = mat({ color: COLORS.plant, roughness: 0.9 })
  const potMat = mat({ color: COLORS.pot, roughness: 0.75 })

  /** Caja: malla para verla, y colisionador salvo que se pida lo contrario. */
  const addBox = (
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    material: THREE.Material,
    collide = true,
  ): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz)
    geometries.add(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(cx, cy, cz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    if (collide) walls.push(box(cx, cy, cz, sx, sy, sz))
    return mesh
  }

  /**
   * Pared: igual que una caja, pero con material propio y `transparent` para
   * poder desvanecerla sola. Si compartiera material con las demás, atenuar una
   * haría desaparecer media casa.
   */
  const addWall = (
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    base: THREE.MeshStandardMaterial,
  ): THREE.Mesh => {
    const material = base.clone()
    material.transparent = true
    materials.add(material)
    const mesh = addBox(cx, cy, cz, sx, sy, sz, material)
    occluders.push(mesh)
    return mesh
  }

  const addCylinder = (
    radiusTop: number,
    radiusBottom: number,
    height: number,
    cx: number,
    cy: number,
    cz: number,
    material: THREE.Material,
  ): THREE.Mesh => {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20)
    geometries.add(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(cx, cy, cz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  const addSphere = (
    radius: number,
    cx: number,
    cy: number,
    cz: number,
    material: THREE.Material,
  ): THREE.Mesh => {
    const geometry = new THREE.SphereGeometry(radius, 16, 12)
    geometries.add(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(cx, cy, cz)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }

  // ---------------------------------------------------------------- piso y suelo
  // El suelo de afuera queda apenas por debajo del piso de la casa: así el borde
  // no se ve como un escalón.
  addBox(0, -0.52, 0, 96, 1, 76, mat({ color: COLORS.ground, roughness: 1 }), false)
  addBox(0, -0.1, 0, 2 * HALF_X + 2 * WALL_T, 0.2, 2 * HALF_Z + 2 * WALL_T, floorMat, false)

  // Juntas del entarimado: sin referencias el piso es una sábana y no se percibe
  // lo rápido que se mueve el gato.
  for (let z = -HALF_Z + 1; z < HALF_Z; z += 1.2) {
    addBox(0, 0.006, z, 2 * HALF_X, 0.012, 0.06, seamMat, false)
  }

  // ---------------------------------------------------------------- paredes
  const outerLong = 2 * HALF_X + 2 * WALL_T
  const outerShort = 2 * HALF_Z
  addWall(0, WALL_H / 2, -HALF_Z - WALL_T / 2, outerLong, WALL_H, WALL_T, wallMat)
  addWall(0, WALL_H / 2, HALF_Z + WALL_T / 2, outerLong, WALL_H, WALL_T, wallMat)
  addWall(-HALF_X - WALL_T / 2, WALL_H / 2, 0, WALL_T, WALL_H, outerShort, wallMat)
  addWall(HALF_X + WALL_T / 2, WALL_H / 2, 0, WALL_T, WALL_H, outerShort, wallMat)

  // Tabique en cruz: cada rama se corta antes del centro y deja el vano.
  const branch = HALF_Z - DOOR_HALF
  const branchCenterZ = (HALF_Z + DOOR_HALF) / 2
  addWall(0, WALL_H / 2, -branchCenterZ, WALL_T, WALL_H, branch, partitionMat)
  addWall(0, WALL_H / 2, branchCenterZ, WALL_T, WALL_H, branch, partitionMat)

  const span = HALF_X - DOOR_HALF
  const spanCenterX = (HALF_X + DOOR_HALF) / 2
  addWall(-spanCenterX, WALL_H / 2, 0, span, WALL_H, WALL_T, partitionMat)
  addWall(spanCenterX, WALL_H / 2, 0, span, WALL_H, WALL_T, partitionMat)

  // ---------------------------------------------------------------- baño (NO)
  addBox(-9.9, 0.4, -7, 3, 0.8, 1.8, porcelainMat)
  addBox(-9.9, 0.74, -7, 2.7, 0.06, 1.5, waterMat, false)
  addBox(-11, 0.5, -3, 1.1, 1, 1.1, porcelainMat)
  addCylinder(0.06, 0.06, 0.5, -11, 1.25, -3, metalMat)

  // ---------------------------------------------------------------- cocina (NE)
  addBox(10.3, 1.05, -7.4, 1.5, 2.1, 1.4, metalMat)
  addBox(10.3, 0.45, -4.4, 1.5, 0.9, 3.2, woodMat)
  addBox(10.3, 0.93, -4.4, 1.6, 0.08, 3.3, porcelainMat, false)

  // El plato del gato, contra la mesada.
  addCylinder(0.42, 0.32, 0.22, 8.2, 0.11, -5, bowlMat)
  addSphere(0.3, 8.2, 0.22, -5, foodMat).scale.set(1, 0.5, 1)

  // ---------------------------------------------------------------- living (SO)
  addBox(-9.9, 0.35, 6.3, 2.8, 0.7, 1.3, fabricMat)
  addBox(-9.9, 0.88, 6.85, 2.8, 1.1, 0.35, fabricMat)
  addBox(-9.9, 0.74, 6.1, 2.4, 0.14, 0.9, cushionMat, false)

  // Rascador: base, poste y plataforma.
  addBox(-6.3, 0.09, 6.3, 1.1, 0.18, 1.1, postBaseMat)
  addBox(-6.3, 1, 6.3, 0.34, 1.8, 0.34, postMat)
  addBox(-6.3, 1.94, 6.3, 1.2, 0.14, 1.2, postBaseMat)
  addSphere(0.13, -6.3, 1.55, 5.5, cushionMat)

  // Alfombra: no colisiona, pero le da calidez al ambiente.
  const rug = addCylinder(1.9, 1.9, 0.04, -9.9, 0.03, 4.6, mat({ color: COLORS.rug, roughness: 1 }))
  rug.receiveShadow = true

  // ---------------------------------------------------------------- dormitorio (SE)
  addBox(9.4, 0.22, 6.7, 3.2, 0.44, 2.4, bedMat)
  addBox(9.4, 0.54, 6.7, 3, 0.2, 2.2, sheetMat, false)
  addBox(8.3, 0.7, 6.7, 0.9, 0.16, 1.6, sheetMat, false)
  addBox(11.3, 0.35, 4, 0.9, 0.7, 0.9, woodMat)

  // Planta en la esquina.
  addCylinder(0.35, 0.28, 0.5, 11.2, 0.25, 8.2, potMat)
  addSphere(0.5, 11.2, 0.85, 8.2, plantMat)
  addSphere(0.34, 10.85, 1.1, 8.2, plantMat)

  // ---------------------------------------------------------------- arenero
  // En el hall, contra el tabique: obliga a cruzarlo y queda a mano desde todos
  // los cuartos.
  addBox(-1, 0.11, 1.3, 1.2, 0.22, 1.5, litterBoxMat)
  addBox(-1, 0.2, 1.3, 1, 0.06, 1.3, sandMat, false)

  // ---------------------------------------------------------------- estaciones
  // `fx` es dónde brotan las partículas de la actividad: en el agua de la
  // bañera, en el plato, en la punta del rascador, etc. No coincide con `pos`
  // (el punto donde hay que pararse) porque el gato se apoya al lado del mueble.
  const spots: { need: NeedId; x: number; z: number; fx: [number, number, number]; color: number }[] =
    [
      { need: 'comer', x: 8.2, z: -5, fx: [8.2, 0.35, -5], color: COLORS.food },
      { need: 'higiene', x: -9.9, z: -4.9, fx: [-9.9, 0.95, -7], color: COLORS.water },
      { need: 'diversion', x: -6.3, z: 5, fx: [-6.3, 1.5, 5.6], color: COLORS.cushion },
      { need: 'energia', x: 9.4, z: 4.7, fx: [9.4, 0.85, 6.7], color: COLORS.bedSheet },
      { need: 'banio', x: -1, z: 1.3, fx: [-1, 0.3, 1.3], color: COLORS.litterSand },
    ]

  for (const spot of spots) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: iconTexture(NEEDS[spot.need].emoji), transparent: true }),
    )
    sprite.scale.set(0.9, 0.9, 0.9)
    sprite.position.set(spot.x, ICON_Y, spot.z)
    group.add(sprite)

    stations.push({
      need: spot.need,
      pos: new THREE.Vector3(spot.x, 0, spot.z),
      radius: TUNING.stationRadius,
      icon: sprite,
      effect: new THREE.Vector3(spot.fx[0], spot.fx[1], spot.fx[2]),
      effectColor: new THREE.Color(spot.color),
    })
  }

  // ---------------------------------------------------------------- flecha guía
  // Un cono achatado apoyado en el piso, apuntando hacia donde hay que ir. Sin
  // esto, con la cámara pegada al gato, encontrar el mueble urgente es a ciegas.
  const guideGeometry = new THREE.ConeGeometry(0.36, 0.9, 4)
  guideGeometry.rotateX(-Math.PI / 2)
  guideGeometry.translate(0, 0, -0.45)
  geometries.add(guideGeometry)
  const guideMat = new THREE.MeshBasicMaterial({
    color: COLORS.guide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  materials.add(guideMat)
  const guide = new THREE.Mesh(guideGeometry, guideMat)
  guide.visible = false
  guide.renderOrder = 2
  group.add(guide)

  const direction = new THREE.Vector3()

  return {
    group,
    walls,
    occluders,
    stations,

    setGuide(from, target) {
      if (!target) {
        guide.visible = false
        return
      }
      guide.visible = true
      // Se apoya delante del gato, no debajo: así se ve incluso si él lo tapa.
      direction.set(target.x - from.x, 0, target.z - from.z)
      const length = direction.length()
      if (length < 1e-4) {
        guide.visible = false
        return
      }
      direction.multiplyScalar(1 / length)
      guide.position.set(from.x + direction.x * 1.5, 0.05, from.z + direction.z * 1.5)
      // Misma convención que el gato: el frente local es -Z.
      guide.rotation.y = Math.atan2(-direction.x, -direction.z)
    },

    update(_dt, elapsed) {
      // Los iconos flotan apenas, para que se lean como marcadores y no como
      // parte de la casa; la flecha late para llamar la atención.
      for (let i = 0; i < stations.length; i++) {
        stations[i]!.icon.position.y = ICON_Y + Math.sin(elapsed * 1.8 + i * 1.3) * 0.12
      }
      guideMat.opacity = 0.55 + Math.sin(elapsed * 6) * 0.3
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      group.clear()
    },
  }
}
