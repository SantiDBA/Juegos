import * as THREE from 'three'

const canvas = document.getElementById('scene') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a1a)
scene.fog = new THREE.Fog(0x1a1a1a, 20, 80)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

const hemiLight = new THREE.HemisphereLight(0x8a8a8a, 0x1a1a1a, 0.6)
scene.add(hemiLight)

const dirLight = new THREE.DirectionalLight(0xfff0d8, 1.2)
dirLight.position.set(30, 40, 20)
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 2048
dirLight.shadow.mapSize.height = 2048
dirLight.shadow.camera.near = 0.5
dirLight.shadow.camera.far = 100
dirLight.shadow.camera.left = -30
dirLight.shadow.camera.right = 30
dirLight.shadow.camera.top = 30
dirLight.shadow.camera.bottom = -30
scene.add(dirLight)

function createBuilding(x: number, z: number, w: number, h: number, d: number, color: number) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshLambertMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, h/2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

const groundGeo = new THREE.PlaneGeometry(200, 200)
const groundMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

for (let i = 0; i < 15; i++) {
  const x = (Math.random() - 0.5) * 150
  const z = (Math.random() - 0.5) * 150
  if (Math.abs(x) < 10 && Math.abs(z) < 10) continue
  const w = 4 + Math.random() * 8
  const h = 6 + Math.random() * 12
  const d = 4 + Math.random() * 8
  createBuilding(x, z, w, h, d, 0x333333 + Math.floor(Math.random() * 0x222222))
}

const crates: THREE.Mesh[] = []
for (let i = 0; i < 20; i++) {
  const geo = new THREE.BoxGeometry(2, 2, 2)
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a4a2a })
  const crate = new THREE.Mesh(geo, mat)
  const x = (Math.random() - 0.5) * 80
  const z = (Math.random() - 0.5) * 80
  if (Math.abs(x) < 15 && Math.abs(z) < 15) continue
  crate.position.set(x, 1, z)
  crate.castShadow = true
  crate.receiveShadow = true
  crates.push(crate)
  scene.add(crate)
}

const player = {
  position: new THREE.Vector3(0, 1.6, 0),
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  onGround: true,
  health: 100,
  maxHealth: 100
}

const enemies: Array<{
  mesh: THREE.Mesh,
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  health: number,
  lastShot: number,
  alive: boolean
}> = []

for (let i = 0; i < 8; i++) {
  const geo = new THREE.CapsuleGeometry(0.5, 1, 4, 8)
  const mat = new THREE.MeshLambertMaterial({ color: 0xff3333 })
  const mesh = new THREE.Mesh(geo, mat)
  const angle = (i / 8) * Math.PI * 2
  const dist = 30 + Math.random() * 20
  mesh.position.set(Math.cos(angle) * dist, 1, Math.sin(angle) * dist)
  mesh.castShadow = true
  scene.add(mesh)
  enemies.push({
    mesh,
    position: mesh.position.clone(),
    velocity: new THREE.Vector3(),
    health: 100,
    lastShot: 0,
    alive: true
  })
}

const bullets: Array<{ mesh: THREE.Mesh, velocity: THREE.Vector3, life: number }> = []

const keys = new Set<string>()
const mouse = { x: 0, y: 0 }
let isPointerLocked = false
let gameState: 'menu' | 'playing' | 'victory' = 'menu'
let score = 0
let kills = 0
let startTime = 0
let ammo = 30
let reserve = 90
const maxAmmo = 30
let lastShot = 0
let reloading = false

const hudScore = document.getElementById('score')!
const hudKills = document.getElementById('kills')!
const hudTime = document.getElementById('time')!
const hudHealth = document.getElementById('health')!
const hudHealthFill = document.getElementById('health-fill')!
const hudAmmo = document.getElementById('ammo')!
const hudReserve = document.getElementById('reserve')!
const crosshair = document.getElementById('crosshair')!
const hitmarker = document.getElementById('hitmarker')!
const damageOverlay = document.getElementById('damage-overlay')!
const overlay = document.getElementById('overlay')!
const playBtn = document.getElementById('play')!
const victoryOverlay = document.getElementById('victory-overlay')!
const restartBtn = document.getElementById('restart')!
const victoryKills = document.getElementById('victory-kills')!
const victoryScore = document.getElementById('victory-score')!
const victoryTime = document.getElementById('victory-time')!
const killfeed = document.getElementById('killfeed')!

playBtn.addEventListener('click', () => {
  overlay.classList.add('hidden')
  crosshair.classList.add('visible')
  canvas.requestPointerLock()
  gameState = 'playing'
  startTime = Date.now()
  score = 0
  kills = 0
  player.health = 100
  ammo = 30
  reserve = 90
  for (const enemy of enemies) {
    enemy.alive = true
    enemy.health = 100
    enemy.mesh.visible = true
  }
  updateHUD()
})

restartBtn.addEventListener('click', () => {
  victoryOverlay.classList.add('hidden')
  overlay.classList.remove('hidden')
  gameState = 'menu'
})

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas
  if (!isPointerLocked && gameState === 'playing') {
    // keep playing but cursor free
  }
})

document.addEventListener('mousemove', (e) => {
  if (!isPointerLocked) return
  mouse.x += e.movementX
  mouse.y += e.movementY
  player.yaw -= e.movementX * 0.002
  player.pitch -= e.movementY * 0.002
  player.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, player.pitch))
})

document.addEventListener('keydown', (e) => {
  keys.add(e.code)
  if (e.code === 'KeyR' && gameState === 'playing' && !reloading) {
    reload()
  }
})

document.addEventListener('keyup', (e) => {
  keys.delete(e.code)
})

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0 && gameState === 'playing' && isPointerLocked) {
    shoot()
  }
})

function reload() {
  if (ammo === maxAmmo || reserve === 0) return
  reloading = true
  const needed = maxAmmo - ammo
  const take = Math.min(needed, reserve)
  setTimeout(() => {
    ammo += take
    reserve -= take
    reloading = false
    updateHUD()
  }, 1000)
}

function shoot() {
  const now = Date.now()
  if (now - lastShot < 100) return
  if (ammo <= 0) {
    if (!reloading) reload()
    return
  }
  lastShot = now
  ammo--
  updateHUD()

  const bulletGeo = new THREE.SphereGeometry(0.05, 4, 4)
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 })
  const bullet = new THREE.Mesh(bulletGeo, bulletMat)
  bullet.position.copy(camera.position)
  
  const dir = new THREE.Vector3(0, 0, -1)
  dir.applyQuaternion(camera.quaternion)
  bullet.position.add(dir.clone().multiplyScalar(0.5))
  
  bullets.push({
    mesh: bullet,
    velocity: dir.multiplyScalar(100),
    life: 2
  })
  scene.add(bullet)

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
  const enemyMeshes = enemies.filter(e => e.alive).map(e => e.mesh)
  const hits = raycaster.intersectObjects(enemyMeshes)
  if (hits.length > 0) {
    const hitMesh = hits[0].object
    const enemy = enemies.find(e => e.mesh === hitMesh)
    if (enemy && enemy.alive) {
      enemy.health -= 25
      showHitmarker()
      if (enemy.health <= 0) {
        enemy.alive = false
        enemy.mesh.visible = false
        kills++
        score += 100
        addKillfeed('Eliminado')
        checkVictory()
      } else {
        score += 10
      }
      updateHUD()
    }
  }
}

function showHitmarker() {
  hitmarker.classList.remove('show')
  void hitmarker.offsetWidth
  hitmarker.classList.add('show')
}

function showDamage() {
  damageOverlay.classList.remove('show')
  void damageOverlay.offsetWidth
  damageOverlay.classList.add('show')
}

function addKillfeed(text: string) {
  const entry = document.createElement('div')
  entry.className = 'killfeed-entry'
  entry.textContent = text
  killfeed.appendChild(entry)
  setTimeout(() => entry.remove(), 3000)
}

function checkVictory() {
  if (kills >= enemies.length) {
    setTimeout(() => {
      gameState = 'victory'
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const mins = Math.floor(elapsed / 60)
      const secs = elapsed % 60
      victoryKills.textContent = kills.toString()
      victoryScore.textContent = score.toString()
      victoryTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`
      victoryOverlay.classList.remove('hidden')
      document.exitPointerLock()
      crosshair.classList.remove('visible')
    }, 1000)
  }
}

function updateHUD() {
  hudScore.textContent = score.toString()
  hudKills.textContent = `${kills} / ${enemies.length}`
  hudHealth.textContent = Math.max(0, player.health).toString()
  hudHealthFill.style.width = (player.health / player.maxHealth) * 100 + '%'
  if (player.health < 30) {
    hudHealthFill.classList.add('low')
  } else {
    hudHealthFill.classList.remove('low')
  }
  hudAmmo.textContent = ammo.toString()
  hudReserve.textContent = reserve.toString()
  
  if (gameState === 'playing') {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    hudTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`
  }
}

function updateMovement(delta: number) {
  const speed = keys.has('ShiftLeft') ? 12 : 8
  const moveSpeed = speed * delta
  
  player.direction.set(0, 0, 0)
  if (keys.has('KeyW')) player.direction.z -= 1
  if (keys.has('KeyS')) player.direction.z += 1
  if (keys.has('KeyA')) player.direction.x -= 1
  if (keys.has('KeyD')) player.direction.x += 1
  
  player.direction.normalize()
  
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw)
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw)
  
  const moveVec = new THREE.Vector3()
  moveVec.add(forward.multiplyScalar(player.direction.z))
  moveVec.add(right.multiplyScalar(player.direction.x))
  moveVec.y = 0
  moveVec.normalize()
  
  player.velocity.x = moveVec.x * moveSpeed
  player.velocity.z = moveVec.z * moveSpeed
  
  if (keys.has('Space') && player.onGround) {
    player.velocity.y = 8
    player.onGround = false
  }
  
  player.velocity.y -= 25 * delta
  
  player.position.add(player.velocity)
  
  if (player.position.y < 1.6) {
    player.position.y = 1.6
    player.velocity.y = 0
    player.onGround = true
  }
  
  // Simple collision with crates
  for (const crate of crates) {
    const dist = player.position.distanceTo(crate.position)
    if (dist < 2) {
      const push = player.position.clone().sub(crate.position).normalize()
      player.position.add(push.multiplyScalar(2 - dist))
    }
  }
  
  camera.position.copy(player.position)
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ')
}

function updateEnemies(delta: number) {
  const now = Date.now()
  for (const enemy of enemies) {
    if (!enemy.alive) continue
    
    const dist = enemy.position.distanceTo(player.position)
    
    if (dist < 40) {
      // Move towards player
      const dir = player.position.clone().sub(enemy.position).normalize()
      dir.y = 0
      enemy.position.add(dir.multiplyScalar(3 * delta))
      enemy.mesh.lookAt(player.position.x, enemy.mesh.position.y, player.position.z)
      
      // Shoot at player
      if (dist < 25 && now - enemy.lastShot > 1500) {
        enemy.lastShot = now
        if (Math.random() < 0.7) {
          player.health -= 10
          showDamage()
          updateHUD()
          if (player.health <= 0) {
            // Respawn or game over
            player.health = 100
            player.position.set(0, 1.6, 0)
            score = Math.max(0, score - 50)
            updateHUD()
          }
        }
      }
    }
  }
}

function updateBullets(delta: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    bullet.life -= delta
    bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(delta))
    
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh)
      bullets.splice(i, 1)
      continue
    }
  }
}

const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(clock.getDelta(), 0.1)
  
  if (gameState === 'playing') {
    updateMovement(delta)
    updateEnemies(delta)
    updateBullets(delta)
    updateHUD()
  }
  
  renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate()
updateHUD()
