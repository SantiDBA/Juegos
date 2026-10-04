import * as THREE from 'three'
import { TUNING } from './config'
import { buildGrid, buildLevel, type Grid, type Level } from './maze'
import { Pellets } from './pellets'
import { Player, type Dir } from './player'
import { Ghosts } from './ghosts'
import { BurstParticles, ChaseCamera } from './effects'
import { PostFX } from './postfx'
import { Sfx } from './sfx'
import { randomSeed } from './rng'
import {
  createHud,
  readBest,
  readLevel,
  saveBest,
  saveLevel,
  type GameState,
} from './hud'

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('scene') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05060d)
scene.fog = new THREE.Fog(0x05060d, 22, 46)

const BASE_FOV = 62
const camera = new THREE.PerspectiveCamera(
  BASE_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
)

scene.add(new THREE.HemisphereLight(0x8899ff, 0x0a0a18, 0.7))

const sun = new THREE.DirectionalLight(0xfff0d8, 1.6)
sun.position.set(18, 32, 12)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 90
const shadowExtent = 20
sun.shadow.camera.left = -shadowExtent
sun.shadow.camera.right = shadowExtent
sun.shadow.camera.top = shadowExtent
sun.shadow.camera.bottom = -shadowExtent
sun.shadow.bias = -0.0005
scene.add(sun, sun.target)

// Luz de relleno azulada desde atrás: separa a Pac-Man de los muros oscuros.
const rim = new THREE.DirectionalLight(0x5a7bff, 0.6)
rim.position.set(-14, 12, -16)
scene.add(rim)

// ---------------------------------------------------------------- sistemas

const sfx = new Sfx()
const particles = new BurstParticles()
const chase = new ChaseCamera(camera)
scene.add(particles.points)

let postfx: PostFX | null = null
try {
  postfx = new PostFX(renderer, scene, camera)
} catch {
  // WebGL2 sin soporte de float targets: se juega sin bloom.
  postfx = null
}

const hud = createHud()

// ---------------------------------------------------------------- estado

let state: GameState = 'menu'
let score = 0
let lives = TUNING.startLives
let level = readLevel()
let nextExtraLife = TUNING.extraLifeEvery
/** Fantasmas comidos seguidos: el puntaje se duplica en cadena. */
let eatStreak = 0
let elapsed = 0
let readyTimer = 0
let deathTimer = 0
let best = readBest()

let grid: Grid
let levelData: Level
let pellets: Pellets
let player: Player
let ghosts: Ghosts

/** Semilla del nivel actual, para poder reconstruirlo al perder una vida. */
let levelSeed = 0

function disposeLevel(): void {
  scene.remove(levelData.group)
  scene.remove(pellets.group)
  scene.remove(ghosts.group)
  scene.remove(player.mesh)
  levelData.dispose()
  pellets.dispose()
  ghosts.dispose()
  player.dispose()
}

/**
 * Crea (o recrea) el nivel.
 *
 * `keepScore` está para cuando el jugador pierde una vida: el laberinto se
 * reconstruye igual, pero los puntos y las vidas no se tocan.
 */
function spawnLevel(seed: number, keepScore: boolean): void {
  if (levelData) disposeLevel()

  levelSeed = seed
  grid = buildGrid(seed)
  levelData = buildLevel(grid)
  scene.add(levelData.group)

  pellets = new Pellets(grid, levelData.pellets)
  scene.add(pellets.group)

  ghosts = new Ghosts(grid, levelData.ghostHome)
  scene.add(ghosts.group)

  player = new Player(grid, levelData.spawn)
  scene.add(player.mesh)

  if (!keepScore) {
    score = 0
    nextExtraLife = TUNING.extraLifeEvery
  }
  eatStreak = 0

  hud.setScore(score, best)
  hud.setLives(lives)
  hud.setLevel(level)
  hud.setProgress(0)
  hud.setFrightened(false)
  if (postfx) postfx.setBloomStrength(TUNING.bloomStrength)
}

function startNewGame(): void {
  sfx.unlock()
  level = 1
  lives = TUNING.startLives
  spawnLevel(randomSeed(), false)
  enterReady()
}

function enterReady(): void {
  state = 'playing'
  readyTimer = 1.8
  deathTimer = 0
  // Grace period de arranque: sin esto, si el spawn cae cerca de la casa de
  // fantasmas, el primero sale y lo agarra antes de que el jugador llegue a
  // tocar una tecla. La partida empezaría ya con una vida menos.
  player.grantInvulnerability(TUNING.respawnInvulnerable)
  hud.showReady(true)
  hud.setHudVisible(true)
  hud.setOverlayTitle('pacman3d', 'Juntá todos los puntos. Cuidado con los fantasmas.', 'Jugar')
  hud.showOverlay(false)
  sfx.ready()
}

function respawn(): void {
  // Se reconstruye el nivel con la misma semilla: el jugador no pierde
  // progreso de puntos, pero los fantasmas vuelven a la casa.
  spawnLevel(levelSeed, true)
  player.grantInvulnerability(TUNING.respawnInvulnerable)
  readyTimer = 1.2
  // Sin esto el estado queda en `dying` y, como el respawn no dispara otro
  // `die()`, la partida se congela para siempre en un bucle de muerte.
  state = 'playing'
  hud.showReady(true)
}

function die(): void {
  if (state !== 'playing' || player.isInvulnerable()) return
  lives--
  sfx.death()
  hud.setLives(lives)
  hud.showReady(true)
  deathTimer = 1.6
  // Estado propio para la animación de muerte. Reusar `paused` deadloqueaba el
  // juego: el loop sólo descontaba `deathTimer` con state === 'playing', así
  // que el contador nunca llegaba a cero y la partida quedaba congelada para
  // siempre, sin que se pueda seguir jugando.
  state = 'dying'
  particles.burst(player.position, new THREE.Color(0xff4136), 26)
  chase.shake(1)

  if (lives <= 0) {
    state = 'gameover'
    hud.setOverlayTitle('fin', `Puntaje ${score}.`, 'Otra vez')
    hud.showOverlay(true)
    hud.showReady(false)
    hud.setHudVisible(false)
    sfx.gameOver()
    if (saveBest(score)) {
      best = readBest()
      hud.flashBest()
    }
  }
}

function clearLevel(): void {
  state = 'playing'
  level++
  saveLevel(level)
  sfx.levelClear()
  spawnLevel(randomSeed(), true)
  readyTimer = 1.6
  hud.showReady(true)
}

function addScore(points: number): void {
  score += points
  hud.setScore(score, best)
  if (score >= nextExtraLife) {
    nextExtraLife += TUNING.extraLifeEvery
    lives++
    hud.setLives(lives)
    sfx.extraLife()
    hud.showToast('¡vida extra!')
  }
}

// ---------------------------------------------------------------- input

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    sfx.setMuted(!sfx.muted)
    hud.showToast(sfx.muted ? 'sonido apagado' : 'sonido encendido')
    return
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    if (state === 'menu' || state === 'gameover') {
      startNewGame()
      e.preventDefault()
    }
    return
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === 'playing') {
      state = 'paused'
      hud.setOverlayTitle('pausa', 'Tocá para seguir.', 'Seguir')
      hud.showOverlay(true)
    } else if (state === 'paused' && deathTimer <= 0) {
      resume()
    }
    e.preventDefault()
    return
  }
  const dir = KEY_DIR[e.code]
  if (dir) {
    player?.setDesired(dir)
    e.preventDefault()
  }
})

function resume(): void {
  state = 'playing'
  hud.showOverlay(false)
}

hud.onPlay(() => {
  sfx.unlock()
  if (state === 'paused' && deathTimer <= 0) {
    resume()
  } else {
    startNewGame()
  }
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx?.setSize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio, 2))
})

// ---------------------------------------------------------------- loop

let last = performance.now()

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  elapsed += dt

  // El estado `dying` se maneja fuera del `playing`: la animación de muerte
  // tiene que seguir corriendo aunque el estado ya no sea `playing`, y antes
  // esto quedaba en un deadlock que congelaba la partida.
  if (state === 'dying' || (state === 'playing' && deathTimer > 0)) {
    deathTimer -= dt
    if (deathTimer <= 0) {
      deathTimer = 0
      if (lives > 0) respawn()
      else {
        state = 'gameover'
        hud.showReady(false)
      }
    }
  } else if (state === 'playing') {
    // El "READY!" no congela la partida: se muestra mientras los fantasmas
    // aún están en la casa y el jugador ya puede moverse. Bloquear el input
    // durante el arranque se siente como que el juego no responde.
    if (readyTimer > 0) {
      readyTimer -= dt
      if (readyTimer <= 0) hud.showReady(false)
    }
    step(dt)
  }

  particles.update(dt)
  pellets.update(elapsed)

  // La cámara sigue al jugador siempre, incluso en menú o pausa: así el
  // fondo se ve vivo detrás del overlay.
  if (player) {
    const facing = new THREE.Vector3()
    switch (player.direction) {
      case 'up':
        facing.set(0, 0, -1)
        break
      case 'down':
        facing.set(0, 0, 1)
        break
      case 'left':
        facing.set(-1, 0, 0)
        break
      case 'right':
        facing.set(1, 0, 0)
        break
    }
    chase.update(player.position, facing, dt)
    // La luz sigue al jugador para que la sombra siempre caiga en el tablero.
    sun.position.set(player.position.x + 18, 32, player.position.z + 12)
    sun.target.position.copy(player.position)
    sun.target.updateMatrixWorld()
  }

  if (postfx) postfx.render(dt)
  else renderer.render(scene, camera)

  requestAnimationFrame(frame)
}

/** Un tick de juego: movimiento, colisiones y reglas. */
function step(dt: number): void {
  player.update(dt)

  // Comer puntos.
  const eaten = pellets.eat(grid, player.position.x, player.position.z)
  if (eaten) {
    const value = eaten === 'power' ? TUNING.powerPelletValue : TUNING.pelletValue
    addScore(value)
    sfx.chomp(score)
    particles.burst(
      player.position,
      new THREE.Color(eaten === 'power' ? 0xffb454 : 0xffe9a8),
      eaten === 'power' ? 14 : 5,
    )
    if (eaten === 'power') {
      sfx.powerPellet()
      eatStreak = 0
      if (ghosts.frighten()) {
        hud.setFrightened(true)
        if (postfx) postfx.setBloomStrength(TUNING.bloomStrength * 1.5)
      }
    }
    hud.setProgress(pellets.eaten / pellets.total)
    if (pellets.left === 0) {
      clearLevel()
      return
    }
  }

  // Fantasmas.
  const playerCell = player.currentCell()
  const [pdx, pdy] = dirVector(player.direction)
  let ghostCaught: number | null = null
  ghosts.update(dt, player.position, playerCell, [pdx, pdy], (_g, index) => {
    ghostCaught = index
  })
  if (ghostCaught !== null) {
    const value = ghosts.eatPoints(eatStreak)
    addScore(value)
    sfx.eatGhost(value)
    particles.burst(player.position, new THREE.Color(0x57e0c8), 22)
    eatStreak++
  }

  // Contacto con fantasma normal mata al jugador.
  if (ghosts.isFrightened) {
    hud.setFrightened(true)
  } else if (eatStreak > 0) {
    // El modo asustado terminó: se corta la cadena de puntos.
    eatStreak = 0
    hud.setFrightened(false)
    if (postfx) postfx.setBloomStrength(TUNING.bloomStrength)
  }
  if (ghosts.touching(player.position)) die()
}

function dirVector(dir: Dir): [number, number] {
  switch (dir) {
    case 'up':
      return [0, -1]
    case 'down':
      return [0, 1]
    case 'left':
      return [-1, 0]
    case 'right':
      return [1, 0]
  }
}

// ---------------------------------------------------------------- arranque

// Un nivel inicial para que el menú tenga algo de fondo detrás del overlay.
spawnLevel(randomSeed(), false)
hud.setOverlayTitle(
  'pacman3d',
  'Juntá todos los puntos. Los fantasmas cuidan las esquinas.',
  'Jugar',
)
hud.showOverlay(true)
hud.setHudVisible(false)
requestAnimationFrame(frame)
