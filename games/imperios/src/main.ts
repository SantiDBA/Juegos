import * as THREE from 'three'
import './style.css'
import { BUILDING_DEFS, MAP_SIZE, TECHS, UNIT_DEFS } from './core/config'
import type { AnyEntity, BuildingEntity, BuildingType, ResourceEntity, Team, UnitType } from './core/types'
import { createState, commandAttack, commandGather, commandMove, commandMoveFormation, commandStance, getEntity, queueResearch, queueTrain, setSelection, spawnBuilding, spawnResource, spawnUnit, tryAdvanceEra, tryPlaceBuilding, unitsOfTeam, type Formation } from './sim/state'
import { stepSim } from './sim/sim'
import { advance } from './sim/loop'
import { forceVisionUpdate, isExplored, isVisible, revealAll } from './sim/vision'
import {
  createRender, groundHeightAt, paintFog, removeEntityMesh, renderFrame, resize,
  spawnDeathFx, spawnDepositFx, spawnImpact, spawnMuzzleFlash, spawnTracer, syncEntityMesh, updateCamera,
} from './render/scene'
import type { EntityVisibility } from './render/scene'
import { createUI, renderActions, showEnd, showToast, updateIdleList, updateMinimap, updateSelectionInfo, updateTopBar } from './ui/ui'

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

  // resources clusters near both sides and center: split into denser patches
  // around each base (arranque/economia más legibles) sin aumentar totales.
  const nodes: Array<[any, any, number, number, number]> = [
    // Base jugador (cluster cercano, visible en arranque/economía)
    ['granja', 'suministros', -43, -17, 250], ['granja', 'suministros', -40, -14, 250],
    ['granja', 'suministros', -37, -19, 250], ['granja', 'suministros', -34, -22, 250],
    ['bosque', 'materiales', -36, 13, 225], ['bosque', 'materiales', -31, 16, 225],
    ['bosque', 'materiales', -28, 20, 225], ['bosque', 'materiales', -41, 20, 225],
    ['bosque', 'materiales', -37, 24, 225], ['bosque', 'materiales', -33, 22, 225],
    ['mina', 'minerales', -23, 18, 150], ['petroleo', 'combustible', -23, -22, 150],
    // Jugador medio/lejos (cantidades reducidas para balancear el split cercano)
    ['granja', 'suministros', -20, -38, 500],
    ['petroleo', 'combustible', -16, -30, 350], ['mina', 'minerales', -12, 28, 350],

    // Base enemiga (espejo)
    ['granja', 'suministros', 43, 17, 250], ['granja', 'suministros', 40, 14, 250],
    ['granja', 'suministros', 37, 19, 250], ['granja', 'suministros', 34, 22, 250],
    ['bosque', 'materiales', 36, -13, 225], ['bosque', 'materiales', 31, -16, 225],
    ['bosque', 'materiales', 28, -20, 225], ['bosque', 'materiales', 41, -20, 225],
    ['bosque', 'materiales', 37, -24, 225], ['bosque', 'materiales', 33, -22, 225],
    ['mina', 'minerales', 23, -18, 150], ['petroleo', 'combustible', 23, 22, 150],
    // Enemigo medio/lejos
    ['granja', 'suministros', 20, 37, 500],
    ['petroleo', 'combustible', 16, 30, 350], ['mina', 'minerales', 12, -28, 350],

    // Centro / disputado
    ['bosque', 'materiales', -2, 2, 200], ['bosque', 'materiales', 2, -2, 200],
    ['granja', 'suministros', 4, -6, 200], ['granja', 'suministros', -4, 6, 200],
    ['mina', 'minerales', -8, -44, 500], ['petroleo', 'combustible', 8, 44, 500],
  ]
  for (const [rt, rk, x, z, amt] of nodes) spawnResource(gs, rt, rk, x, z, amt)

  // First fog pass: the starting area is visible before the first sim tick.
  forceVisionUpdate(gs)
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
  const helpToggle = document.getElementById('help-toggle')
  const helpPanel = document.getElementById('help-panel')
  helpToggle?.addEventListener('click', () => helpPanel?.classList.toggle('hidden'))
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
  // hidden-by-fog entities are not pickable
  const objs = [...rc.entityMeshes.values()].filter(o => o.visible)
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
        commandMove(gs, selectedPlayerUnits, { x: te.x + 3, z: te.z + 3 }, false, e.shiftKey)
      } else {
        const p = rayGround(e.clientX, e.clientY)
        if (p) commandMove(gs, selectedPlayerUnits, { x: p.x, z: p.z }, false, e.shiftKey)
      }
    } else {
      const p = rayGround(e.clientX, e.clientY)
      if (p) commandMove(gs, selectedPlayerUnits, { x: p.x, z: p.z }, false, e.shiftKey)
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
    (stance) => {
      commandStance(gs, gs.selectedIds, stance)
      gs.toast = { msg: `Postura: ${stance}`, t: 1.5 }
    },
  )
}

let uiFastTimer = 0
let uiSlowTimer = 0
let fogTimer = 0
let prevStatus = gs.status

/** Whose eyes the render uses; null = omniscient (viewAs 'all'). */
function observerTeam(): Team | null {
  return gs.viewAs === 'all' ? null : gs.viewAs
}

/**
 * Render classification of an entity under the fog.
 * - own team and anything standing on a visible tile: full
 * - own... resources stay visible once explored (remembered terrain)
 * - enemy buildings seen before but not right now: ghost (grey translucent)
 * - everything else: hidden
 */
function visibilityOf(observer: Team | null, e: AnyEntity): EntityVisibility {
  if (!observer) return 'full'
  if (e.team === observer) return 'full'
  if (e.kind === 'resource') return isExplored(gs, observer, e.x, e.z) ? 'full' : 'hidden'
  if (isVisible(gs, observer, e.x, e.z)) return 'full'
  if (e.kind === 'building' && gs.knownBuildings[observer].has(e.id)) return 'ghost'
  return 'hidden'
}

const TRACER_GUN = 0xffd27a
const TRACER_SHELL = 0xff9a3c
const TRACER_TOWER = 0xffe9b0

/** Colour by attacker: shells/artillery burn orange, tower fire is pale. */
function tracerColor(attacker: AnyEntity | undefined, unitType: string | undefined): number {
  if (attacker && attacker.kind === 'building') return TRACER_TOWER
  if (!unitType) return TRACER_SHELL
  if (unitType === 'canon' || unitType === 'mlrs' || unitType === 'tanque' || unitType === 'tanque_autonomo' || unitType === 'cazacarros') return TRACER_SHELL
  return TRACER_GUN
}

/**
 * Drains the sim event queue into the VFX layer. Damage stays instantaneous in
 * the sim: the tracer/impact are pure presentation. Anything happening outside
 * the observer's sight is dropped, so fog hides battles in the dark.
 */
function drainSimEvents(): void {
  if (gs.events.length === 0) return
  const events = gs.events.splice(0, gs.events.length)
  const observer = observerTeam()
  const seen = (x: number, z: number): boolean => observer == null || isVisible(gs, observer, x, z)

  for (const ev of events) {
    const k = (ev as any).kind
    if (k === 'attack') {
      const atk = ev as any
      if (!seen(atk.x, atk.z)) continue
      const attacker = getEntity(gs, atk.from)
      const target = getEntity(gs, atk.to)
      const tx = atk.tx ?? (target ? target.x : atk.x)
      const tz = atk.tz ?? (target ? target.z : atk.z)
      if (!seen(tx, tz)) continue
      const from = new THREE.Vector3(atk.x, groundHeightAt(atk.x, atk.z) + 1.2, atk.z)
      const to = new THREE.Vector3(tx, groundHeightAt(tx, tz) + 1.0, tz)
      // muzzle flash at the shooter, then the streak it just fired
      spawnMuzzleFlash(rc, from.x, from.y, from.z)
      spawnTracer(rc, from, to, tracerColor(attacker, atk.unitType))
    } else if (k === 'damage') {
      const dmg = ev as any
      if (!seen(dmg.x, dmg.z)) continue
      spawnImpact(rc, dmg.x, groundHeightAt(dmg.x, dmg.z) + 1.0, dmg.z)
    } else if (k === 'death') {
      const death = ev as any
      if (!seen(death.x, death.z)) continue
      spawnDeathFx(rc, death.x, death.z, death.entity, death.team)
    } else if (k === 'deposit') {
      const dep = ev as any
      if (!seen(dep.x, dep.z)) continue
      spawnDepositFx(rc, dep.x, dep.z, dep.team, dep.resource)
    }
  }
}

function frame(): void {
  requestAnimationFrame(frame)
  const dt = Math.min(rc.clock.getDelta(), 0.1)
  if (gs.status === 'playing') {
    updateCameraControls(dt)
    advance(gs, dt)
  }

  drainSimEvents()

  // sync render entities (fog decides what the observer is allowed to see)
  const observer = observerTeam()
  const seen = new Set<number>()
  for (const e of gs.entities.values()) {
    if (e.dead) continue
    const era = e.kind === 'resource' ? 1 : (gs.players[e.team as 'player' | 'enemy']?.era ?? 1)
    syncEntityMesh(rc, e, dt, era, visibilityOf(observer, e))
    seen.add(e.id)
  }
  for (const id of [...rc.entityMeshes.keys()]) if (!seen.has(id)) removeEntityMesh(rc, id)

  // fog texture follows the 5 Hz vision pass, not the frame rate
  fogTimer += dt
  if (fogTimer >= 0.2) {
    fogTimer = 0
    paintFog(rc, observer ? gs.vision[observer] : null)
  }

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
    updateIdleList(ui, gs)
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
ui.idleList.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.idle-item') as HTMLElement | null
  if (!btn) return
  const id = Number(btn.dataset.id)
  if (!Number.isFinite(id)) return
  const ent = getEntity(gs, id) as any
  const x = ent && !ent.dead ? ent.x : Number(btn.dataset.x)
  const z = ent && !ent.dead ? ent.z : Number(btn.dataset.z)
  if (!Number.isFinite(x) || !Number.isFinite(z)) return
  const lim = MAP_SIZE / 2 - 8
  rc.target.x = Math.max(-lim, Math.min(lim, x))
  rc.target.z = Math.max(-lim, Math.min(lim, z))
  updateCamera(rc)
  setSelection(gs, [id])
  updateSelectionInfo(ui, gs)
  updateIdleList(ui, gs)
  refreshActions()
})
setupWorld()
refreshActions()
updateTopBar(ui, gs)
updateSelectionInfo(ui, gs)
updateIdleList(ui, gs)
frame()

if (import.meta.hot) {
  /**
   * Sends every idle engineer of `team` to a resource node and returns how many
   * orders actually landed. Workers are spread out (each extra crew member on a
   * node costs 6 virtual units), so a real economy does not collapse onto one
   * farm. Player only: commandGather is the player-facing order path.
   */
  function devGatherAll(team: Team = 'player'): number {
    const nodes: ResourceEntity[] = []
    for (const e of gs.entities.values()) {
      if (!e.dead && e.kind === 'resource' && e.amount > 0) nodes.push(e as ResourceEntity)
    }
    if (nodes.length === 0) return 0
    const crew = unitsOfTeam(gs, team).filter(u => u.utype === 'ingeniero' && (u.state === 'idle' || u.gatherTargetId == null))
    const load = new Map<number, number>()
    let assigned = 0
    for (const u of crew) {
      let best: ResourceEntity | null = null
      let bestD = Infinity
      for (const n of nodes) {
        const d = Math.hypot(n.x - u.x, n.z - u.z) + (load.get(n.id) ?? 0) * 6
        if (d < bestD) { bestD = d; best = n }
      }
      if (!best) continue
      commandGather(gs, [u.id], best.id)
      if (u.gatherTargetId === best.id) {
        assigned++
        load.set(best.id, (load.get(best.id) ?? 0) + 1)
      }
    }
    return assigned
  }

  /** Re-centres (and optionally zooms) the camera, then applies it immediately. */
  function devFocus(x: number, z: number, dist?: number): void {
    rc.target.set(x, 0, z)
    if (dist != null) rc.camDist = Math.max(25, Math.min(120, dist))
    updateCamera(rc)
  }

  /**
   * Builds a real economy: spawns `n` engineers in a ring around the player's
   * town hall and orders all idle engineers to gather. No `give()` here — the
   * capture scenario must show resources actually being worked.
   */
  function devAssignEconomy(n = 6): number {
    let tc: BuildingEntity | null = null
    for (const e of gs.entities.values()) {
      if (e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') { tc = e; break }
    }
    if (!tc) return 0
    for (let i = 0; i < n; i++) {
      const ang = (i / Math.max(1, n)) * Math.PI * 2
      const rad = 6.5 + (i % 3) * 1.6
      spawnUnit(gs, 'player', 'ingeniero', tc.x + Math.cos(ang) * rad, tc.z + Math.sin(ang) * rad)
    }
    return devGatherAll('player')
  }

  ;(window as any).__imperios = {
    get state() { return gs },
    render: rc,
    /** Spawns `n` units in a block and returns their ids. */
    spawn: (team: 'player' | 'enemy', type: UnitType, n = 1, x = 0, z = 0) => {
      const p = gs.players[team]
      const room = Math.max(0, p.popCap - p.pop)
      const count = Math.min(n, room)
      const ids: number[] = []
      for (let i = 0; i < count; i++) ids.push(spawnUnit(gs, team, type, x + (i % 4) * 2, z + Math.floor(i / 4) * 2).id)
      return ids
    },
    /** Places a building (built by default) — used by the siege scenario. */
    build: (team: Team, type: BuildingType, x: number, z: number, built = true) => {
      const b = spawnBuilding(gs, team, type, x, z, built)
      return b.id
    },
    give: (amount = 1000) => {
      for (const k of ['suministros', 'materiales', 'combustible', 'minerales'] as const) gs.players.player.resources[k] += amount
    },
    /** Assigns up to `n` idle engineers to a specific resource node. */
    gatherNode: (nodeId: number, n = 8) => {
      const idle = unitsOfTeam(gs, 'player').filter(u => u.utype === 'ingeniero' && u.state !== 'gather').slice(0, n).map(u => u.id)
      if (idle.length === 0) return 0
      commandGather(gs, idle, nodeId)
      return idle.length
    },
    /** Starts a research and reports whether it landed. */
    research: (techId: string) => {
      const ok = queueResearch(gs, 'player', techId)
      return ok ? 'ok' : 'fail'
    },
    /** Starts the era advance and reports whether it landed. */
    advanceEra: () => tryAdvanceEra(gs) ? 'ok' : 'fail',
    /** Places a player building as if clicked (QA): returns 'ok' or the failure. */
    place: (type: BuildingType, x: number, z: number) => tryPlaceBuilding(gs, type, x, z) ? 'ok' : 'fail',
    setEra: (era: number) => {
      gs.players.player.era = Math.max(1, Math.min(4, era))
      gs.players.enemy.era = gs.players.player.era
      gs.players.player.advancing = null
      gs.players.enemy.advancing = null
    },
    select: (ids: number[]) => setSelection(gs, ids),
    /** Selects up to `n` existing units of that team/type. Returns their ids. */
    selectUnits: (team: Team, utype: UnitType, n = 6) => {
      const ids = unitsOfTeam(gs, team).filter(u => u.utype === utype).slice(0, n).map(u => u.id)
      setSelection(gs, ids)
      return ids
    },
    /** Formation move for an explicit id list (wedge/box/line). */
    moveFormation: (ids: number[], x: number, z: number, formation: Formation = 'wedge') => {
      commandMoveFormation(gs, ids, { x, z }, formation)
      return ids.length
    },
    /** Pans (and optionally zooms) the camera for a framed capture. */
    camera: (x: number, z: number, dist?: number) => {
      rc.target.set(x, 0, z)
      if (dist != null) rc.camDist = Math.max(25, Math.min(120, dist))
      updateCamera(rc)
    },
    /** Pans the camera to a world point (alias of `camera` without zoom). */
    focus: (x: number, z: number, dist?: number) => { devFocus(x, z, dist); return 'ok' },
    /** Orders every idle engineer to the nearest resource node. */
    gatherAll: (team: Team = 'player') => devGatherAll(team),
    /** Spawns `n` engineers around the town hall and puts them to work. */
    assignEconomy: (n = 6) => devAssignEconomy(n),
    /** Lift the fog for a team (QA only). */
    reveal: (team: Team = 'player') => {
      revealAll(gs, team)
      paintFog(rc, observerTeam() ? gs.vision[observerTeam()!] : null)
      return 'ok'
    },
    /** Force one vision pass right now (normally it runs at 5 Hz). */
    fog: () => {
      forceVisionUpdate(gs)
      paintFog(rc, observerTeam() ? gs.vision[observerTeam()!] : null)
      return 'ok'
    },
    entityIds: () => [...gs.entities.keys()],
    skip: (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 20); i++) stepSim(gs, 1 / 20) },
  }
}
