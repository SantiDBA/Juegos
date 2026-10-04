import * as THREE from 'three'
import { TUNING } from './config'
import { Rng } from './rng'

/**
 * Laberinto de Pac-Man en 3D.
 *
 * Se genera por código en vez de llevar un mapa dibujado a mano: un laberinto
 * de DFS es conexo por construcción, así que todas las celdas quedan
 * alcanzables desde el arranque en cualquier semilla. Un mapa dibujado hay que
 * revalidarlo a mano cada vez que se toca, y es donde más fácil se cuela una
 * región aislada con puntos imposibles de comer.
 *
 * `#` muro · `.` punto · `o` punto de poder · `-` pasillo sin punto ·
 * `g` interior de la casa de fantasmas (los fantasmas sí, el jugador no).
 */
export type MazeCell = '#' | '.' | 'o' | '-' | 'g'

export interface Grid {
  cells: MazeCell[][]
  /** Extensión del tablero en celdas. */
  size: number
  /** Centro de la casa de fantasmas. */
  home: { x: number; y: number }
  /** Celdas que el jugador alcanza sin pisar la casa, clave `"x,y"`. */
  reachable: Set<string>
}

export interface Level {
  /** Contenedor de toda la geometría estática. */
  group: THREE.Group
  grid: Grid
  /** Celda de aparición del jugador, ya resuelta contra la grilla. */
  spawn: { x: number; y: number }
  /** Centro de la casa, donde reaparecen los fantasmas. */
  ghostHome: { x: number; y: number }
  /** Puerta: los fantasmas la cruzan para salir al pasillo. */
  ghostDoor: { x: number; y: number }
  /** Puntos por celda, clave `"x,y"`. Se vacían al comerlos. */
  pellets: Map<string, 'pellet' | 'power'>
  /** Total de puntos del nivel, para la barra de progreso. */
  pelletTotal: number
  dispose(): void
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * Celdas que ocupan la casa de fantasmas y su corredor de salida, incluidas
 * las paredes. El DFS las salta por completo: así la casa queda aislada por
 * diseño y no hay que "arreglarla" después.
 */
function houseZone(home: { x: number; y: number }): Set<string> {
  const zone = new Set<string>()
  const add = (x: number, y: number): void => {
    zone.add(`${x},${y}`)
  }
  // Interior 3x3.
  for (let y = home.y - 1; y <= home.y + 1; y++) {
    for (let x = home.x - 1; x <= home.x + 1; x++) add(x, y)
  }
  // Paredes: laterales, la de abajo y la del corredor de arriba.
  for (let y = home.y - 1; y <= home.y + 2; y++) {
    add(home.x - 2, y)
    add(home.x + 2, y)
  }
  add(home.x - 2, home.y + 2)
  add(home.x + 2, home.y + 2)
  add(home.x, home.y - 2)
  add(home.x, home.y - 3)
  return zone
}

/**
 * DFS iterativo con backtracking. Parte de una celda y abre muros hacia celdas
 * vírgenes; cada celda queda con una única conexión hacia atrás, que es lo que
 * garantiza que el grafo sea conexo.
 */
function carve(cells: MazeCell[][], rng: Rng, reserved: Set<string>): void {
  const size = cells.length
  // La semilla arranca en un pasillo real lejos de la zona reservada.
  let start = { x: 1, y: 1 }
  outer: for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (!reserved.has(`${x},${y}`)) {
        start = { x, y }
        break outer
      }
    }
  }

  const visited = new Set<string>([`${start.x},${start.y}`])
  const stack: Array<{ x: number; y: number }> = [start]
  cells[start.y]![start.x] = '-'

  while (stack.length) {
    const cur = stack[stack.length - 1]!
    const options: Array<{ x: number; y: number }> = []
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx * 2
      const ny = cur.y + dy * 2
      // El borde exterior queda siempre como muro.
      if (nx <= 0 || ny <= 0 || nx >= size - 1 || ny >= size - 1) continue
      if (reserved.has(`${nx},${ny}`)) continue
      if (visited.has(`${nx},${ny}`)) continue
      options.push({ x: nx, y: ny })
    }

    if (!options.length) {
      stack.pop()
      continue
    }

    const next = rng.pick(options)
    cells[(cur.y + next.y) >> 1]![((cur.x + next.x) >> 1)] = '-'
    cells[next.y]![next.x] = '-'
    visited.add(`${next.x},${next.y}`)
    stack.push(next)
  }
}

/**
 * Rompe paredes para crear bucles.
 *
 * Un laberinto perfecto (sin bucles) obliga a recorrer caminos sin atajo y se
 * siente laberíntico pero frustrante: no hay forma de esquivar a un fantasma ni
 * de volver atrás rápido. Abrir un porcentaje de muros convierte el grafo en
 * algo con rutas alternativas, que es lo jugable de un arcade de puntos.
 */
function addLoops(cells: MazeCell[][], rng: Rng, ratio: number, reserved: Set<string>): void {
  const size = cells.length
  const candidates: Array<[number, number]> = []
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (reserved.has(`${x},${y}`)) continue
      if (cells[y]![x] === '#') candidates.push([x, y])
    }
  }
  rng.shuffle(candidates)
  const toOpen = Math.floor(candidates.length * ratio)
  for (let i = 0; i < toOpen; i++) {
    const [x, y] = candidates[i]!
    cells[y]![x] = '-'
  }
}

/** Talla la casa: interior `g`, paredes `#` y corredor de salida `-`. */
function carveGhostHouse(cells: MazeCell[][], home: { x: number; y: number }): void {
  const set = (x: number, y: number, c: MazeCell): void => {
    cells[y]![x] = c
  }
  for (let y = home.y - 1; y <= home.y + 1; y++) {
    for (let x = home.x - 1; x <= home.x + 1; x++) set(x, y, 'g')
  }
  for (let y = home.y - 1; y <= home.y + 2; y++) {
    set(home.x - 2, y, '#')
    set(home.x + 2, y, '#')
  }
  set(home.x - 2, home.y + 2, '#')
  set(home.x + 2, home.y + 2, '#')
  set(home.x, home.y + 2, '#')
  // Corredor de salida: sale de la casa y llega al laberinto.
  set(home.x, home.y - 1, '-')
  set(home.x, home.y - 2, '-')
  set(home.x, home.y - 3, '-')
}

/** Celda transitable para el jugador más cercana a `target`. */
function nearestWalkable(
  cells: MazeCell[][],
  target: { x: number; y: number },
): { x: number; y: number } | null {
  const size = cells.length
  let best: { x: number; y: number } | null = null
  let bestDist = Infinity
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const cell = cells[y]![x]!
      if (cell !== '-' && cell !== '.') continue
      const d = Math.abs(x - target.x) + Math.abs(y - target.y)
      if (d < bestDist) {
        bestDist = d
        best = { x, y }
      }
    }
  }
  return best
}

/**
 * Celdas que el jugador puede alcanzar sin pisar la casa.
 *
 * Se parte de la boca del corredor de la casa, que el DFS garantiza conectada
 * al laberinto: la zona de la casa está reservada, así que todas las demás
 * celdas son del grafo principal y ésta abre a él.
 *
 * Hace falta porque puede quedar alguna bolsa aislada pegada a la casa (por
 * ejemplo la celda justo debajo de su borde lateral): el jugador no puede
 * entrar, pero un fantasma sí. Sin esta comprobación el spawn caería ahí y la
 * partida arrancaría encerrado, y además quedarían puntos imposibles de comer.
 */
function reachableFromPlayer(grid: Grid, from: { x: number; y: number }): Set<string> {
  const seen = new Set<string>()
  const stack: Array<{ x: number; y: number }> = [from]
  seen.add(`${from.x},${from.y}`)
  while (stack.length) {
    const cur = stack.pop()!
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      const key = `${nx},${ny}`
      if (seen.has(key)) continue
      if (!isWalkable(grid, nx, ny)) continue
      seen.add(key)
      stack.push({ x: nx, y: ny })
    }
  }
  return seen
}

/**
 * Construye el laberinto y sus datos lógicos a partir de una semilla.
 *
 * `loopRatio` es la fracción de muros que se abre para crear bucles: más alto
 * es un laberinto más abierto y menos "laberíntico".
 */
export function buildGrid(seed: number, loopRatio = 0.14): Grid {
  const size = TUNING.gridSize
  const cells: MazeCell[][] = []
  for (let y = 0; y < size; y++) cells.push(new Array<MazeCell>(size).fill('#'))

  const home = { x: size >> 1, y: size >> 1 }
  const reserved = houseZone(home)

  const rng = new Rng(seed)
  carve(cells, rng, reserved)
  addLoops(cells, rng, loopRatio, reserved)
  carveGhostHouse(cells, home)

  // Puntos de poder en las cuatro esquinas. El pasillo exacto puede haber
  // quedado como muro según la semilla, así que se usa la celda transitable
  // más cercana a cada esquina: la posición importa menos que el balance.
  for (const corner of [
    { x: 1, y: 1 },
    { x: size - 2, y: 1 },
    { x: 1, y: size - 2 },
    { x: size - 2, y: size - 2 },
  ]) {
    const spot = nearestWalkable(cells, corner)
    if (spot) cells[spot.y]![spot.x] = 'o'
  }

  // Todos los pasillos llevan punto, como el clásico. La casa queda fuera:
  // `g` no es `-`, así que no le pone punto encima.
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (cells[y]![x] === '-') cells[y]![x] = '.'
    }
  }

  const grid: Grid = { cells, size, home, reachable: new Set() }

  // Purga las bolsas que el jugador no puede alcanzar: son pasillos que sólo
  // conectan con el interior de la casa. Un punto ahí sería imposible de comer
  // y el nivel nunca se completaría.
  const reachable = reachableFromPlayer(grid, { x: home.x, y: home.y - 3 })
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const cell = cells[y]![x]!
      if (cell !== '.' && cell !== 'o') continue
      if (!reachable.has(`${x},${y}`)) cells[y]![x] = '-'
    }
  }

  grid.reachable = reachable
  return grid
}

export function cellAt(grid: Grid, x: number, y: number): MazeCell | null {
  const row = grid.cells[y]
  if (!row || x < 0 || x >= grid.size) return null
  return row[x] ?? null
}

export function isWall(grid: Grid, x: number, y: number): boolean {
  const cell = cellAt(grid, x, y)
  return cell === null || cell === '#'
}

/** Transitable por el jugador: todo menos muro y casa. */
export function isWalkable(grid: Grid, x: number, y: number): boolean {
  const cell = cellAt(grid, x, y)
  return cell !== null && cell !== '#' && cell !== 'g'
}

/** Transitable por un fantasma: incluye el interior de la casa. */
export function isGhostWalkable(grid: Grid, x: number, y: number): boolean {
  return !isWall(grid, x, y)
}

export function pelletKind(cell: MazeCell): 'pellet' | 'power' | null {
  if (cell === '.') return 'pellet'
  if (cell === 'o') return 'power'
  return null
}

/** Centro de una celda en coordenadas de mundo. */
export function cellToWorld(grid: Grid, cx: number, cy: number, y = 0): THREE.Vector3 {
  const cell = TUNING.cellSize
  const half = (grid.size * cell) / 2
  return new THREE.Vector3(cx * cell - half + cell / 2, y, cy * cell - half + cell / 2)
}

/** Inversa de `cellToWorld`: la celda que contiene un punto del mundo. */
export function worldToCell(grid: Grid, x: number, z: number): { x: number; y: number } {
  const cell = TUNING.cellSize
  const half = (grid.size * cell) / 2
  return { x: Math.floor((x + half) / cell), y: Math.floor((z + half) / cell) }
}

/**
 * Construye la geometría del nivel a partir de la grilla.
 *
 * Los muros van en un `InstancedMesh`: son ~100 celdas y una caja por celda
 * multiplicaría las llamadas de dibujo sin necesidad.
 */
export function buildLevel(grid: Grid): Level {
  const group = new THREE.Group()
  const { home, reachable } = grid

  // El spawn se elige entre las celdas alcanzables, prefiriendo una que tenga
  // salidas en dos ejes distintos: si el jugador aparece mirando a un muro,
  // no se puede mover hasta que llega el primer input, que se siente como un
  // juego trabado.
  let spawn: { x: number; y: number } | null = null
  let bestScore = -Infinity
  let bestDist = Infinity
  for (let y = 1; y < grid.size - 1; y++) {
    for (let x = 1; x < grid.size - 1; x++) {
      if (!reachable.has(`${x},${y}`)) continue
      const cell = cellAt(grid, x, y)
      if (cell !== '.' && cell !== 'o') continue

      let open = 0
      let horizontal = false
      let vertical = false
      if (isWalkable(grid, x + 1, y)) {
        open++
        horizontal = true
      }
      if (isWalkable(grid, x - 1, y)) {
        open++
        horizontal = true
      }
      if (isWalkable(grid, x, y + 1)) {
        open++
        vertical = true
      }
      if (isWalkable(grid, x, y - 1)) {
        open++
        vertical = true
      }

      // Prioriza salidas en ambos ejes y la mayor cantidad de salidas; el
      // desempate es la cercanía a la casa.
      const score = (horizontal && vertical ? 100 : 0) + open * 10
      const dist = Math.abs(x - home.x) + Math.abs(y - home.y)
      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        bestScore = score
        bestDist = dist
        spawn = { x, y }
      }
    }
  }
  spawn ??= { x: 1, y: 1 }

  const pellets = new Map<string, 'pellet' | 'power'>()
  let pelletTotal = 0
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      const cell = cellAt(grid, x, y)
      if (!cell) continue
      const kind = pelletKind(cell)
      if (kind) {
        pellets.set(`${x},${y}`, kind)
        pelletTotal++
      }
    }
  }

  const box = new THREE.BoxGeometry(TUNING.cellSize, TUNING.wallHeight, TUNING.cellSize)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1c2f7a,
    emissive: 0x0d1a4a,
    emissiveIntensity: 0.8,
    roughness: 0.55,
    metalness: 0.2,
  })

  const wallCells: Array<[number, number]> = []
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (isWall(grid, x, y)) wallCells.push([x, y])
    }
  }

  const walls = new THREE.InstancedMesh(box, wallMat, wallCells.length)
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < wallCells.length; i++) {
    const [x, y] = wallCells[i]!
    const p = cellToWorld(grid, x, y)
    matrix.makeTranslation(p.x, TUNING.wallHeight / 2, p.z)
    walls.setMatrixAt(i, matrix)
  }
  walls.instanceMatrix.needsUpdate = true
  walls.castShadow = true
  walls.receiveShadow = true
  group.add(walls)

  // Suelo del tablero.
  const size = grid.size * TUNING.cellSize
  const floorGeo = new THREE.PlaneGeometry(size, size)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x04050c,
    roughness: 0.95,
    metalness: 0,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.02
  floor.receiveShadow = true
  group.add(floor)

  // Puerta de la casa: una barra luminosa que marca dónde salen los fantasmas.
  const doorGeo = new THREE.BoxGeometry(TUNING.cellSize, 0.18, 0.3)
  const doorMat = new THREE.MeshBasicMaterial({ color: 0xffd166 })
  const door = new THREE.Mesh(doorGeo, doorMat)
  const doorPos = cellToWorld(grid, home.x, home.y - 1, TUNING.playerHeight)
  door.position.copy(doorPos)
  group.add(door)

  return {
    group,
    grid,
    spawn,
    ghostHome: { ...home },
    ghostDoor: { x: home.x, y: home.y - 1 },
    pellets,
    pelletTotal,
    dispose() {
      box.dispose()
      wallMat.dispose()
      walls.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      doorGeo.dispose()
      doorMat.dispose()
    },
  }
}