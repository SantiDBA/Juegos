import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { wheelOffsetX, type CarStyle } from './carStyles'

export type { CarStyle, CarStyleId } from './carStyles'
export { CAR_ORDER, CAR_STYLES, isCarStyleId } from './carStyles'

export interface CarVisual {
  group: THREE.Group
  frontWheels: THREE.Object3D[]
  rearWheels: THREE.Object3D[]
  flames: THREE.Object3D
  geometries: THREE.BufferGeometry[]
  materials: THREE.Material[]
  /**
   * Signo del giro de las ruedas. El auto procedural tiene el eje de la rueda
   * sobre +x; los GLTF de Kenney vienen girados 180°, así que su x local apunta
   * al otro lado y el sentido de giro se invierte.
   */
  spinSign: number
}

/** Caja con las aristas redondeadas; es lo que hace que no parezca un bloque. */
function rounded(
  geometries: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  radius = 0.05,
): THREE.BufferGeometry {
  const r = Math.max(0.012, Math.min(radius, w / 2 - 0.02, h / 2 - 0.02, d / 2 - 0.02))
  const geometry = new RoundedBoxGeometry(w, h, d, 2, r)
  geometries.push(geometry)
  return geometry
}

let sharedShadowTexture: THREE.Texture | null = null

/** Mancha de contacto: una gradiente radial generada por código. */
export function contactShadowTexture(): THREE.Texture {
  if (sharedShadowTexture) return sharedShadowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)')
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.26)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  sharedShadowTexture = new THREE.CanvasTexture(canvas)
  return sharedShadowTexture
}

/** Cono de llama del escape, apuntando hacia atrás. */
function flameMesh(
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  color: number,
  radius: number,
  length: number,
): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(radius, length, 8, 1, true)
  // El cono apunta a +Y; rotado 90° sobre X sale hacia +z, que es la cola.
  geometry.rotateX(Math.PI / 2)
  geometries.push(geometry)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  materials.push(material)
  return new THREE.Mesh(geometry, material)
}

/**
 * Arma el auto: si hay un modelo GLTF cargado lo usa, si no cae al procedural.
 * Las piezas que `Car` necesita mover (ruedas y llamas) y todo lo que hay que
 * liberar al desecharlo salen en el mismo contrato en ambos casos.
 */
export function buildCarVisual(
  style: CarStyle,
  bodyColor: number,
  accentColor: number,
  envMap: THREE.Texture | null,
  model: THREE.Object3D | null = null,
): CarVisual {
  return model
    ? buildFromModel(style, bodyColor, envMap, model)
    : buildProcedural(style, bodyColor, accentColor, envMap)
}

/**
 * Auto construido con geometría propia. Es el respaldo cuando no hay GLTF y el
 * que define el vocabulario visual (cabina, ventanillas, pasarruedas, alerón).
 */
function buildProcedural(
  style: CarStyle,
  bodyColor: number,
  accentColor: number,
  envMap: THREE.Texture | null,
): CarVisual {
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const group = new THREE.Group()

  // Pintura: `MeshPhysicalMaterial` con clearcoat es lo que la hace leer como
  // auto y no como plástico. El entorno hace el resto del trabajo.
  //
  // Ojo con la intensidad: con el sol y el ambiente que tiene la cancha, pasarse
  // de metalness o de entorno lava la pintura a blanco y el auto se ve como un
  // bulto. Mejor poco y bien.
  const paint = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    metalness: 0.12,
    roughness: 0.34,
    clearcoat: 0.7,
    clearcoatRoughness: 0.14,
    envMap,
    envMapIntensity: 0.55,
  })
  const accent = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.25,
    metalness: 0.35,
    roughness: 0.4,
  })
  // Cristales: oscuros y poco reflectivos. Con mucho entorno se ponían claros y
  // el parabrisas dejaba de leerse.
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x090c16,
    metalness: 0.05,
    roughness: 0.12,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMap,
    envMapIntensity: 0.3,
  })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.96 })
  // Sin entorno un metal se ve negro: por eso la llanta también lo recibe.
  const rim = new THREE.MeshStandardMaterial({
    color: 0xdfe7f5,
    metalness: 0.65,
    roughness: 0.3,
    envMap,
    envMapIntensity: 0.7,
  })
  const trim = new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.6, metalness: 0.3 })
  const headlight = new THREE.MeshStandardMaterial({
    color: 0xdff0ff,
    emissive: 0xdff0ff,
    emissiveIntensity: 1.3,
  })
  const taillight = new THREE.MeshStandardMaterial({
    color: 0xff3a2a,
    emissive: 0xff3a2a,
    emissiveIntensity: 1.1,
  })
  materials.push(paint, accent, glass, rubber, rim, trim, headlight, taillight)

  const { length, width, height, bodyLift } = style

  // --- Chasis y morro
  const base = new THREE.Mesh(rounded(geometries, width, height, length, 0.06), paint)
  base.position.y = bodyLift
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  const nose = new THREE.Mesh(
    rounded(geometries, width * 0.9, height * 0.62, length * 0.3, 0.05),
    accent,
  )
  nose.position.set(0, bodyLift - style.noseDrop, -length * 0.34)
  group.add(nose)

  // --- Cabina, parabrisas y luneta
  //
  // La cabina se apoya SOBRE el cuerpo, no dentro: en un chasis alto quedaba
  // enterrada y las ventanillas desaparecían.
  const cabinY = bodyLift + height / 2 + style.cabinHeight / 2 - 0.03
  const glassY = cabinY + style.cabinHeight * 0.06

  const cabin = new THREE.Mesh(
    rounded(geometries, width * 0.84, style.cabinHeight, style.cabinLength, 0.06),
    paint,
  )
  cabin.position.set(0, cabinY, style.cabinOffset)
  cabin.castShadow = true
  group.add(cabin)

  const windshield = new THREE.Mesh(
    rounded(geometries, width * 0.7, style.cabinHeight * 0.8, 0.1, 0.03),
    glass,
  )
  windshield.position.set(0, glassY, style.cabinOffset - style.cabinLength * 0.52)
  windshield.rotation.x = -0.5
  group.add(windshield)

  const rearGlass = new THREE.Mesh(
    rounded(geometries, width * 0.66, style.cabinHeight * 0.6, 0.08, 0.03),
    glass,
  )
  rearGlass.position.set(0, glassY, style.cabinOffset + style.cabinLength * 0.52)
  rearGlass.rotation.x = 0.5
  group.add(rearGlass)

  // Ventanillas laterales: sin ellas la cabina se lee como un bloque macizo.
  const sideGlassGeometry = rounded(
    geometries,
    style.cabinLength * 0.62,
    style.cabinHeight * 0.5,
    0.04,
    0.015,
  )
  for (const x of [-1, 1]) {
    const sideGlass = new THREE.Mesh(sideGlassGeometry, glass)
    sideGlass.position.set(x * (width * 0.84) * 0.5, glassY, style.cabinOffset)
    sideGlass.rotation.y = Math.PI / 2
    group.add(sideGlass)
  }

  // --- Franja del equipo sobre el lomo
  const stripe = new THREE.Mesh(rounded(geometries, width * 0.2, 0.03, length * 0.86, 0.012), accent)
  stripe.position.set(0, bodyLift + height * 0.5, 0)
  group.add(stripe)

  // --- Faldones y labio: cortan la silueta de "ladrillo" del cuerpo.
  const skirtGeometry = rounded(geometries, 0.05, height * 0.5, length * 0.72, 0.02)
  for (const x of [-width / 2, width / 2]) {
    const skirt = new THREE.Mesh(skirtGeometry, trim)
    skirt.position.set(x, bodyLift - height * 0.3, 0)
    group.add(skirt)
  }
  const lip = new THREE.Mesh(rounded(geometries, width * 0.88, 0.05, 0.1, 0.02), trim)
  lip.position.set(0, bodyLift - height * 0.42, -length * 0.5)
  group.add(lip)

  // --- Luces: le dan cara al auto y, al ser emisivas, florecen con el bloom.
  const headGeometry = rounded(geometries, width * 0.2, 0.07, 0.05, 0.015)
  const tailGeometry = rounded(geometries, width * 0.22, 0.06, 0.05, 0.015)
  for (const x of [-width * 0.3, width * 0.3]) {
    const head = new THREE.Mesh(headGeometry, headlight)
    head.position.set(x, bodyLift - style.noseDrop * 0.5, -length * 0.48)
    group.add(head)

    const tail = new THREE.Mesh(tailGeometry, taillight)
    tail.position.set(x, bodyLift + height * 0.18, length * 0.49)
    group.add(tail)
  }

  // --- Alerón. Los soportes tienen que nacer en el cuerpo: si no, el alerón
  // queda flotando y se lee como una pieza suelta.
  if (style.spoiler) {
    const bodyTop = bodyLift + height / 2
    const wingY = bodyTop + 0.26
    const wing = new THREE.Mesh(rounded(geometries, width * 0.96, 0.06, 0.22, 0.025), accent)
    wing.position.set(0, wingY, length * 0.46)
    wing.castShadow = true
    group.add(wing)

    const strutHeight = wingY - 0.03 - bodyTop
    const strutGeometry = rounded(geometries, 0.055, strutHeight, 0.055, 0.02)
    for (const x of [-0.3, 0.3]) {
      const strut = new THREE.Mesh(strutGeometry, trim)
      strut.position.set(x * (width / 0.84), bodyTop + strutHeight / 2, length * 0.46)
      group.add(strut)
    }
  }

  // --- Ruedas: goma + llanta. El eje se rota a X para que rueden girando en x.
  const wheelX = wheelOffsetX(style)
  const wheelY = -style.halfHeight + style.wheelRadius
  const tyreGeometry = new THREE.CylinderGeometry(
    style.wheelRadius,
    style.wheelRadius,
    style.wheelWidth,
    16,
  )
  tyreGeometry.rotateZ(Math.PI / 2)
  // La llanta sobresale de la goma: si no, la rueda se ve como un disco negro.
  const rimGeometry = new THREE.CylinderGeometry(
    style.wheelRadius * 0.64,
    style.wheelRadius * 0.64,
    style.wheelWidth * 1.3,
    12,
  )
  rimGeometry.rotateZ(Math.PI / 2)
  geometries.push(tyreGeometry, rimGeometry)

  const frontWheels: THREE.Object3D[] = []
  const rearWheels: THREE.Object3D[] = []
  for (const z of [-style.axle, style.axle]) {
    for (const x of [-wheelX, wheelX]) {
      // El pivote gira con el volante; los hijos giran al rodar.
      const pivot = new THREE.Object3D()
      pivot.position.set(x, wheelY, z)
      const tyre = new THREE.Mesh(tyreGeometry, rubber)
      const hub = new THREE.Mesh(rimGeometry, rim)
      tyre.castShadow = true
      pivot.add(tyre, hub)
      group.add(pivot)
      if (z < 0) frontWheels.push(pivot)
      else rearWheels.push(pivot)
    }
  }

  // --- Pasarruedas: una ceja fina sobre cada rueda. Si son anchos la tapan y
  // el auto parece tener bloques en vez de ruedas.
  const archGeometry = rounded(
    geometries,
    style.wheelWidth + 0.03,
    style.wheelRadius * 0.34,
    style.wheelRadius * 2.2,
    0.025,
  )
  for (const z of [-style.axle, style.axle]) {
    for (const x of [-wheelX, wheelX]) {
      const arch = new THREE.Mesh(archGeometry, paint)
      arch.position.set(x, wheelY + style.wheelRadius * 0.86, z)
      arch.castShadow = true
      group.add(arch)
    }
  }

  // --- Llamas del escape
  const flames = new THREE.Object3D()
  flames.visible = false
  const flameZ = length * 0.5
  for (const x of [-width * 0.22, width * 0.22]) {
    const outer = flameMesh(geometries, materials, 0xff8a3d, 0.11, 0.3)
    outer.position.set(x, bodyLift - style.noseDrop * 0.4, flameZ)
    const core = flameMesh(geometries, materials, 0x9fd0ff, 0.06, 0.46)
    core.position.copy(outer.position)
    flames.add(outer, core)
  }
  group.add(flames)

  return { group, frontWheels, rearWheels, flames, geometries, materials, spinSign: -1 }
}

/** Filas de una tabla de nombre de nodo a partir de la convención de Kenney. */
function isRollingWheel(name: string): boolean {
  // El SUV trae una rueda de repuesto llamada `wheel-back` (sin lado): no rueda.
  return /wheel/i.test(name) && /(front|back)/i.test(name) && /(left|right)/i.test(name)
}

/**
 * Auto a partir de un modelo GLTF.
 *
 * El modelo es sólo visual: se escala solo para entrar en las medidas del chasis
 * y se apoya en el piso del auto, así que sirve cualquier auto del kit sin
 * tocar números. El hitbox sigue saliendo de `CarStyle`.
 */
function buildFromModel(
  style: CarStyle,
  bodyColor: number,
  envMap: THREE.Texture | null,
  template: THREE.Object3D,
): CarVisual {
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const group = new THREE.Group()

  const model = template.clone(true)

  // --- Auto-ajuste al chasis
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const scale = Math.min(
    style.length / Math.max(size.z, 1e-3),
    style.width / Math.max(size.x, 1e-3),
  )
  model.scale.multiplyScalar(scale)

  box.setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  model.position.x -= center.x
  model.position.z -= center.z
  // Apoyado: la base del modelo queda en el piso del auto (-halfHeight).
  model.position.y -= box.min.y + style.halfHeight

  // --- Materiales: el kit usa un único `colormap` con la paleta, así que teñir
  // el material tiñe el auto entero; los negros (cubiertas, vidrios) siguen
  // negros porque negro por color sigue siendo negro.
  const tint = new THREE.Color(bodyColor)
  const shared = new Map<THREE.Material, THREE.MeshStandardMaterial>()

  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    obj.castShadow = true
    obj.receiveShadow = true

    const source = Array.isArray(obj.material) ? obj.material[0] : obj.material
    if (!source) return

    let cloned = shared.get(source)
    if (!cloned) {
      cloned = (source as THREE.MeshStandardMaterial).clone()
      cloned.color.copy(tint)
      cloned.envMap = envMap
      cloned.envMapIntensity = 0.45
      cloned.metalness = 0.15
      cloned.roughness = 0.5
      shared.set(source, cloned)
      materials.push(cloned)
    }
    obj.material = cloned
  })

  // --- Ruedas: nodos separados en el kit, con el pivote en el centro de rueda.
  const frontWheels: THREE.Object3D[] = []
  const rearWheels: THREE.Object3D[] = []
  model.traverse((obj) => {
    if (!isRollingWheel(obj.name)) return
    // Con orden YXZ el giro de volante (y) se aplica antes que el rodado (x).
    obj.rotation.order = 'YXZ'
    if (/front/i.test(obj.name)) frontWheels.push(obj)
    else rearWheels.push(obj)
  })

  // --- Llamas del escape (el modelo no las trae)
  const flames = new THREE.Object3D()
  flames.visible = false
  const flameY = -style.halfHeight + style.wheelRadius
  for (const x of [-style.width * 0.24, style.width * 0.24]) {
    const outer = flameMesh(geometries, materials, 0xff8a3d, 0.1, 0.3)
    outer.position.set(x, flameY, style.length * 0.5)
    const core = flameMesh(geometries, materials, 0x9fd0ff, 0.06, 0.44)
    core.position.copy(outer.position)
    flames.add(outer, core)
  }
  group.add(model, flames)

  return { group, frontWheels, rearWheels, flames, geometries, materials, spinSign: 1 }
}
