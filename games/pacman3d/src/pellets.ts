import * as THREE from 'three'
import { TUNING } from './config'
import { cellToWorld, type Grid } from './maze'

/**
 * Puntos del laberinto.
 *
 * Hay ~95 por nivel, así que cada punto es un mesh propio. No es un problema:
 * son todos del mismo material y el costo real está en el render, no en el
 * conteo de objetos a esta escala. Si el nivel creciera mucho habría que pasar
 * a `InstancedMesh`, pero con un `dispose` por punto el manejo es directo.
 */
export class Pellets {
  readonly group = new THREE.Group()
  private readonly meshes = new Map<string, THREE.Mesh>()
  /** Puntos que quedan: clave `"x,y"`. El `main` lo consulta al comer. */
  private readonly remaining = new Set<string>()
  readonly total: number
  private consumed = 0

  private readonly pelletGeo: THREE.SphereGeometry
  private readonly powerGeo: THREE.SphereGeometry
  private readonly pelletMat: THREE.MeshStandardMaterial
  private readonly powerMat: THREE.MeshStandardMaterial

  constructor(grid: Grid, pelletKeys: Map<string, 'pellet' | 'power'>) {
    this.total = pelletKeys.size

    this.pelletGeo = new THREE.SphereGeometry(0.13, 10, 8)
    this.powerGeo = new THREE.SphereGeometry(0.26, 14, 12)
    this.pelletMat = new THREE.MeshStandardMaterial({
      color: 0xffe9a8,
      emissive: 0xffc94d,
      emissiveIntensity: 1.6,
      roughness: 0.35,
    })
    this.powerMat = new THREE.MeshStandardMaterial({
      color: 0xfff4d6,
      emissive: 0xffb454,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    })

    for (const [key, kind] of pelletKeys) {
      const [xs, ys] = key.split(',')
      const cx = Number.parseInt(xs ?? '0', 10)
      const cy = Number.parseInt(ys ?? '0', 10)
      const p = cellToWorld(grid, cx, cy, TUNING.pelletHeight)
      const mesh = new THREE.Mesh(
        kind === 'power' ? this.powerGeo : this.pelletGeo,
        kind === 'power' ? this.powerMat : this.pelletMat,
      )
      mesh.position.copy(p)
      mesh.userData.key = key
      mesh.userData.kind = kind
      this.group.add(mesh)
      this.meshes.set(key, mesh)
      this.remaining.add(key)
    }
  }

  /**
   * Come el punto bajo una posición, si hay uno.
   *
   * Devuelve qué se comió para que el llamador sume puntos y aplique el efecto
   * del punto de poder, o `null` si en esa celda ya no queda nada.
   */
  eat(grid: Grid, worldX: number, worldZ: number): 'pellet' | 'power' | null {
    const cell = TUNING.cellSize
    const half = (grid.size * cell) / 2
    const cx = Math.floor((worldX + half) / cell)
    const cy = Math.floor((worldZ + half) / cell)
    const key = `${cx},${cy}`
    if (!this.remaining.has(key)) return null

    const mesh = this.meshes.get(key)
    const kind = (mesh?.userData.kind as 'pellet' | 'power' | undefined) ?? 'pellet'
    this.remaining.delete(key)
    this.consumed++
    if (mesh) this.group.remove(mesh)
    return kind
  }

  /** Puntos restantes, para la barra de progreso. */
  get eaten(): number {
    return this.consumed
  }

  get left(): number {
    return this.remaining.size
  }

  /** Los puntos de poder laten: parpadean para que se vean a distancia. */
  update(elapsed: number): void {
    const pulse = 1 + Math.sin(elapsed * 5) * 0.18
    this.powerMat.emissiveIntensity = 2.2 * pulse
  }

  dispose(): void {
    this.pelletGeo.dispose()
    this.powerGeo.dispose()
    this.pelletMat.dispose()
    this.powerMat.dispose()
    this.meshes.clear()
    this.group.clear()
  }
}