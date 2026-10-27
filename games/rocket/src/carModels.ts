import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CAR_ORDER, type CarStyleId } from './carStyles'

/**
 * Carga de los modelos GLTF de los autos.
 *
 * Los archivos son de Kenney Car Kit (CC0), ver
 * `public/models/cars/LICENSES.md`. Se cargan una sola vez y se clonan por auto:
 * las geometrías se comparten, los materiales se clonan para poder teñirlos.
 *
 * Si un archivo falta o falla, ese chasis se queda con el auto procedural: el
 * juego nunca depende de que el asset esté.
 */
const MODEL_FILES: Record<CarStyleId, string> = {
  octane: 'sedan-sports',
  dominus: 'hatchback-sports',
  breakout: 'race',
  truck: 'suv',
}

const MODEL_PATH = '/models/cars/'

/** Plantilla por chasis. Cada auto clona la que le toca. */
export type CarModels = Map<CarStyleId, THREE.Object3D>

export async function loadCarModels(): Promise<CarModels> {
  const loader = new GLTFLoader()
  const models: CarModels = new Map()

  await Promise.all(
    CAR_ORDER.map(async (id) => {
      try {
        const gltf = await loader.loadAsync(`${MODEL_PATH}${MODEL_FILES[id]}.glb`)
        // Kenney exporta con el frente hacia +z y el piso en y=0. Nuestro frente
        // es -z, así que se orienta acá una vez y los clones lo heredan.
        gltf.scene.rotation.y = Math.PI
        models.set(id, gltf.scene)
      } catch {
        // Sin archivo se usa el auto procedural de `cars.ts`.
      }
    }),
  )

  return models
}
