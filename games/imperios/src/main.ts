import * as THREE from 'three'
import './style.css'
import { BUILDING_DEFS, MAP_SIZE, TECHS, UNIT_DEFS } from './core/config'
import type { BuildingType, UnitType } from './core/types'
import { createState, commandAttack, commandGather, commandMove, getEntity, queueResearch, queueTrain, setSelection, spawnBuilding, spawnResource, spawnUnit, tryAdvanceEra, tryPlaceBuilding } from './sim/state'
import { stepSim } from './sim/sim'
import { createRender, removeEntityMesh, renderFrame, resize, syncEntityMesh, updateCamera } from './render/scene'
import { createUI, renderActions, showEnd, showToast, updateMinimap, updateSelectionInfo, updateTopBar } from './ui/ui'

const canvas = document.getElementById('scene') as HTMLCanvasElement
const uiRoot = document.getElementById('ui') as HTMLElement

const rc = createRender(canvas)
const ui = createUI(uiRoot)
let gs = createState()

const keys = new Set<string>()
let pointer = { x: 0, y: 0 }
let dragging = false
let dragStart: { x: number; y: number } | null = null
let lastToastMsg = ''

function setupWorld(): void {
  gs = createState()
  // player base
  spawnBuilding(gs, 'player', 'ayuntamiento', -55, 0, true)
  spawnBuilding(gs, 'player', 'vivienda', -44, -10, true)
  spawnUnit(gs, 'player', 'ingeniero', -48, 8)
  spawnUnit(gs, 'player', 'ingeniero', -46, 10)
  spawnUnit(gs, 'player', 'ingeniero', -50, 10)

  // enemy base
  spawnBuilding(gs, 'enemy', 'ayuntamiento', 55, 0, true)
  spawnBuilding(gs, 'enemy', 'vivienda', 45, 12, true)
  spawnUnit(gs, 'enemy', 'ingeniero', 48, -8)
  spawnUnit(gs, 'enemy', 'ingeniero', 46, -10)
  spawnUnit(gs, 'enemy', 'ingeniero', 50, -10)

  // resources clusters near both sides and center
  const nodes: Array<[any, any, number, number, number]> = [
    ['granja','suministros', -40, -18, 500], ['granja','suministros', -38, -22, 500],
    ['bosque','materiales', -30, 18, 450], ['bosque','materiales', -26, 22, 450],
    ['petroleo','combustible', -15, -30, 500], ['mina','minerales', -10, 28, 500],
    ['granja','suministros', 40, 18, 500], ['granja','suministros', 38, 22, 500],
    ['bosque','materiales', 30, -18, 450], ['bosque','materiales', 26, -22, 450],
    ['petroleo','combustible', 15, 30, 500], ['mina','minerales', 10, -28, 500],
    ['bosque','materiales', 0, 0, 400], ['granja','suministros', 4, -6, 400],
  ]
  for (const [rt, rk, x, z, amt] of nodes) spawnResource(gs, rt, rk, x, z, amt)
}

function startGame(): void {
  for (const id of [...rc.entityMeshes.keys()]) removeEntityMesh(rc, id)
  setupWorld()
  gs.status = 'playing'
  ui.overlay.classList.add('hidden')
  ui.overlay.innerHTML = ''
  // Camera intro: start high and far, ease to player base
  rc.target.set(0, 0, 0)
  rc.camDist = 120
  const startT = performance.now()
  const introDuration = 1800
  function introCam() {
    const elapsed = performance.now() - startT
    const t = Math.min(1, elapsed / introDuration)
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    rc.target.x = -48 * ease
    rc.target.z = 4 * ease
    rc.camDist = 120 - 55 * ease
    updateCamera(rc)
    if (t < 1) requestAnimationFrame(introCam)
  }
  introCam()
}

function bindUI(): void {
  const start = document.getElementById('start')
  start?.addEventListener('click', startGame)
}

function rayGround(clientX: number, clientY: number): THREE.Vector3 | null {
  const rect = canvas.getBoundingClientRect()
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1))
  rc.raycaster.setFromCamera(ndc, rc.camera)
  const hits = rc.raycaster.intersectObject(rc.ground)
  if (hits.length > 0) return hits[0].point.clone()
  // fallback plane y=0
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const p = new THREE.Vector3()
  rc.raycaster.ray.intersectPlane(plane, p)
  return p
}

function pickEntity(clientX: number, clientY: number): number | null {
  const rect = canvas.getBoundingClientRect()
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1))
  rc.raycaster.setFromCamera(ndc, rc.camera)
  const objs = [...rc.entityMeshes.values()]
  const hits = rc.raycaster.intersectObjects(objs, true)
  for (const hit of hits) {
    let cur: THREE.Object3D | null = hit.object
    while (cur) {
      for (const [id, root] of rc.entityMeshes.entries()) {
        if (root === cur) return id
      }
      cur = cur.parent
    }
  }
  return null
}

function screenToSelectionRect(x1:number,y1:number,x2:number,y2:number): {minX:number,maxX:number,minY:number,maxY:number} {
  return { minX: Math.min(x1,x2), maxX: Math.max(x1,x2), minY: Math.min(y1,y2), maxY: Math.max(y1,y2) }
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault())

canvas.addEventListener('pointerdown', (e) => {
  if (gs.status !== 'playing') return
  pointer.x = e.clientX; pointer.y = e.clientY
  if (e.button === 0) { dragging = true; dragStart = { x: e.clientX, y: e.clientY } }
})

// Also handle placement click directly on canvas (more reliable than window pointerup)
canvas.addEventListener('pointerup', (e) => {
  if (gs.status !== 'playing') return
  if (e.button === 0 && gs.placing) {
    const p = rayGround(e.clientX, e.clientY)
    if (p) {
      const ok = tryPlaceBuilding(gs, gs.placing, p.x, p.z)
      if (ok) gs.placing = null
    }
    dragging = false; dragStart = null
    e.stopPropagation()
    return
  }
})

window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY
  if (gs.placing) {
    const p = rayGround(e.clientX, e.clientY)
    if (p) {
      rc.placementGhost.visible = true
      rc.placementGhost.position.set(p.x, 0.5, p.z)
      const sz = (BUILDING_DEFS[gs.placing] as any).size
      rc.placementGhost.scale.set(sz.x, 1, sz.z)
      // Validate placement: check collision
      let valid = true
      if (Math.abs(p.x) > MAP_SIZE / 2 - 6 || Math.abs(p.z) > MAP_SIZE / 2 - 6) valid = false
      for (const ent of gs.entities.values()) {
        if (ent.dead || ent.kind !== 'building') continue
        const d = BUILDING_DEFS[ent.btype]
        if (Math.abs(ent.x - p.x) < (d.size.x + sz.x) / 2 + 1 && Math.abs(ent.z - p.z) < (d.size.z + sz.z) / 2 + 1) {
          valid = false; break
        }
      }
      const ghostMat = rc.placementGhost.material as THREE.MeshStandardMaterial
      ghostMat.color.setHex(valid ? 0x44cc66 : 0xcc4444)
      ghostMat.emissive.setHex(valid ? 0x226633 : 0x662222)
    }
  } else {
    rc.placementGhost.visible = false
  }
})

window.addEventListener('pointerup', (e) => {
  if (gs.status !== 'playing') return
  // Ignore clicks that originated from UI elements (buttons, panels, etc.)
  const target = e.target as HTMLElement
  if (target && target.closest && target.closest('#ui button, #ui .btn, #ui .primary, .back, .overlay')) return
  if (e.button === 0) {
    if (gs.placing) {
      const p = rayGround(e.clientX, e.clientY)
      if (p) {
        const ok = tryPlaceBuilding(gs, gs.placing, p.x, p.z)
        if (ok) gs.placing = null
      }
      dragging = false; dragStart = null
      return
    }
    if (dragging && dragStart) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y
      if (Math.hypot(dx, dy) < 6) {
        const id = pickEntity(e.clientX, e.clientY)
        if (id != null) {
          const ent = getEntity(gs, id)
          if (e.shiftKey) {
            const set = new Set(gs.selectedIds)
            if (set.has(id)) set.delete(id); else set.add(id)
            setSelection(gs, [...set])
          } else {
            setSelection(gs, ent && ent.team === 'player' && (ent.kind === 'unit' || ent.kind === 'building') ? [id] : (ent ? [id] : []))
          }
        } else {
          if (!e.shiftKey) setSelection(gs, [])
        }
      } else {
        // box select
        const rect = screenToSelectionRect(dragStart.x, dragStart.y, e.clientX, e.clientY)
        const ids: number[] = []
        for (const [id, obj] of rc.entityMeshes.entries()) {
          const ent = getEntity(gs, id)
          if (!ent || ent.team !== 'player' || ent.kind !== 'unit') continue
          const v = obj.position.clone().project(rc.camera)
          const sx = (v.x * 0.5 + 0.5) * window.innerWidth
          const sy = (-v.y * 0.5 + 0.5) * window.innerHeight
          if (sx >= rect.minX && sx <= rect.maxX && sy >= rect.minY && sy <= rect.maxY) ids.push(id)
        }
        if (ids.length > 0) setSelection(gs, ids)
      }
    }
    dragging = false; dragStart = null
  }

  if (e.button === 2) {
    if (gs.placing) { gs.placing = null; rc.placementGhost.visible = false; return }
    const targetEntId = pickEntity(e.clientX, e.clientY)
    const selectedPlayerUnits = gs.selectedIds.map(id => getEntity(gs, id)).filter((e): e is any => !!e && e.kind === 'unit' && e.team === 'player').map(e => e.id)
    if (selectedPlayerUnits.length === 0) return
    if (targetEntId != null) {
      const te = getEntity(gs, targetEntId)
      if (te && te.kind === 'resource') {
        commandGather(gs, selectedPlayerUnits, te.id)
        gs.toast = { msg: 'Órden: recolectar', t: 1.5 }
      } else if (te && te.team === 'enemy') {
        commandAttack(gs, selectedPlayerUnits, te.id)
        gs.toast = { msg: 'Órden: atacar', t: 1.5 }
      } else if (te && te.kind === 'building' && te.team === 'player') {
        // rally-like move
        commandMove(gs, selectedPlayerUnits, { x: te.x + 3, z: te.z + 3 })
      } else {
        const p = rayGround(e.clientX, e.clientY)
        if (p) commandMove(gs, selectedPlayerUnits, { x: p.x, z: p.z })
      }
    } else {
      const p = rayGround(e.clientX, e.clientY)
      if (p) commandMove(gs, selectedPlayerUnits, { x: p.x, z: p.z })
    }
  }
})

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase())
  if (e.key === 'Escape') { gs.placing = null; rc.placementGhost.visible = false; setSelection(gs, []) }
})
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

window.addEventListener('resize', () => resize(rc))

function updateCameraControls(dt: number): void {
  const speed = 45 * dt
  const forward = new THREE.Vector3(Math.cos(rc.camYaw), 0, Math.sin(rc.camYaw))
  const right = new THREE.Vector3(-forward.z, 0, forward.x)
  if (keys.has('w')) rc.target.addScaledVector(forward, -speed)
  if (keys.has('s')) rc.target.addScaledVector(forward, speed)
  if (keys.has('a')) rc.target.addScaledVector(right, speed)
  if (keys.has('d')) rc.target.addScaledVector(right, -speed)
  if (keys.has('q')) rc.camYaw += 1.8 * dt
  if (keys.has('e')) rc.camYaw -= 1.8 * dt
  const lim = MAP_SIZE / 2 - 8
  rc.target.x = Math.max(-lim, Math.min(lim, rc.target.x))
  rc.target.z = Math.max(-lim, Math.min(lim, rc.target.z))
  updateCamera(rc)
}
canvas.addEventListener('wheel', (e) => {
  rc.camDist = Math.max(25, Math.min(120, rc.camDist + e.deltaY * 0.03))
  updateCamera(rc)
}, { passive: true })

function bindMinimap(): void {
  const mm = ui.minimap
  let mmDown = false

  const jumpTo = (clientX: number, clientY: number) => {
    const rect = mm.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * MAP_SIZE - MAP_SIZE / 2
    const z = ((clientY - rect.top) / rect.height) * MAP_SIZE - MAP_SIZE / 2
    const lim = MAP_SIZE / 2 - 8
    rc.target.x = Math.max(-lim, Math.min(lim, x))
    rc.target.z = Math.max(-lim, Math.min(lim, z))
    updateCamera(rc)
  }

  mm.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    mmDown = true
    try { mm.setPointerCapture(e.pointerId) } catch {}
    jumpTo(e.clientX, e.clientY)
  })

  mm.addEventListener('pointermove', (e) => {
    if (!mmDown) return
    e.preventDefault()
    jumpTo(e.clientX, e.clientY)
  })

  const up = (e: PointerEvent) => {
    mmDown = false
    try { mm.releasePointerCapture(e.pointerId) } catch {}
  }
  mm.addEventListener('pointerup', up)
  mm.addEventListener('pointercancel', up)
  mm.addEventListener('pointerleave', () => { mmDown = false })
}

function refreshActions(): void {
  renderActions(
    ui,
    gs,
    (bId, t) => {
      const ok = queueTrain(gs, 'player', bId, t as UnitType)
      if (ok) {
        gs.toast = { msg: `Entrenando ${UNIT_DEFS[t].name}`, t: 1.5 }
      } else {
        gs.toast = { msg: 'No se pudo entrenar (recursos/población/era)', t: 1.8 }
      }
    },
    (bt) => {
      gs.placing = bt as BuildingType
      gs.toast = { msg: `Colocá: ${BUILDING_DEFS[bt].name} (clic izq)`, t: 2.2 }
    },
    () => {
      tryAdvanceEra(gs)
    },
    (id) => {
      const ok = queueResearch(gs, 'player', id)
      if (ok) gs.toast = { msg: `Investigando ${TECHS.find(t => t.id === id)?.name}...`, t: 1.8 }
      else gs.toast = { msg: 'No se pudo investigar (era/recursos)', t: 1.8 }
    },
  )
}

let uiFastTimer = 0
let uiSlowTimer = 0
let prevStatus = gs.status
function frame(): void {
  requestAnimationFrame(frame)
  const dt = Math.min(rc.clock.getDelta(), 0.1)
  if (gs.status === 'playing') {
    updateCameraControls(dt)
    stepSim(gs, dt)
  }

  // sync render entities
  const seen = new Set<number>()
  for (const e of gs.entities.values()) {
    if (e.dead) continue
    const era = e.kind === 'resource' ? 1 : (gs.players[e.team as 'player' | 'enemy']?.era ?? 1)
    syncEntityMesh(rc, e, dt, era)
    seen.add(e.id)
  }
  for (const id of [...rc.entityMeshes.keys()]) if (!seen.has(id)) removeEntityMesh(rc, id)

  uiFastTimer += dt
  uiSlowTimer += dt
  if (uiFastTimer > 0.1) {
    uiFastTimer = 0
    updateSelectionInfo(ui, gs)
  }
  if (uiSlowTimer > 0.25) {
    uiSlowTimer = 0
    updateTopBar(ui, gs)
    updateMinimap(ui, gs, rc.target.x, rc.target.z)
    refreshActions()
  }

  if (gs.toast && gs.toast.msg !== lastToastMsg) { showToast(ui, gs.toast.msg); lastToastMsg = gs.toast.msg }
  if (gs.toast == null) lastToastMsg = ''

  if (gs.status !== prevStatus) {
    if (gs.status === 'victory' || gs.status === 'defeat') showEnd(ui, gs.status)
    prevStatus = gs.status
  }
  // rebind restart if end screen shown
  const restart = document.getElementById('restart')
  if (restart && !(restart as any)._bound) {
    ;(restart as any)._bound = true
    restart.addEventListener('click', () => { startGame(); prevStatus = 'playing' })
  }

  renderFrame(rc, dt)
}

bindUI()
bindMinimap()
setupWorld()
refreshActions()
updateTopBar(ui, gs)
updateSelectionInfo(ui, gs)
frame()
