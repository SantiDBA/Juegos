import { BUILDING_DEFS, ERAS, RESOURCE_LABEL, UNIT_DEFS } from '../core/config'
import { formatCost } from '../core/utils'
import { canTrain, getEntity, type GameState } from '../sim/state'
import type { BuildingType, ResourceKey, UnitType } from '../core/types'

export interface UIRefs {
  root: HTMLElement
  resEls: Record<string, HTMLElement>
  eraEl: HTMLElement
  popEl: HTMLElement
  selInfo: HTMLElement
  actions: HTMLElement
  overlay: HTMLElement
  toast: HTMLElement
  minimap: HTMLCanvasElement
}

export function createUI(root: HTMLElement): UIRefs {
  root.innerHTML = `
    <div class="topbar">
      <div class="era-badge" id="era">Era del Vapor (1800-1870)</div>
      <div class="res"><span>Suministros</span><b id="r-suministros">0</b></div>
      <div class="res"><span>Materiales</span><b id="r-materiales">0</b></div>
      <div class="res"><span>Combustible</span><b id="r-combustible">0</b></div>
      <div class="res"><span>Minerales</span><b id="r-minerales">0</b></div>
      <div class="res"><span>Pob.</span><b id="pop">0/0</b></div>
    </div>
    <div class="leftpanel">
      <h3>Acciones</h3>
      <div id="actions" class="actions"></div>
      <div style="margin-top:8px;color:#98a6bd;font-size:11px;line-height:1.4">
        Seleccioná un Ayuntamiento o Cuartel para producir. Seleccioná un Ingeniero y usá los botones de construcción.
      </div>
    </div>
    <div class="bottombar"><div id="selection-info">Sin selección. Clic izq: seleccionar · Clic der: mover/recolectar/atacar.</div></div>
    <div class="minimap-wrap"><canvas id="minimap" width="220" height="220"></canvas></div>
    <div class="help">Cámara: WASD mover · Q/E rotar · rueda zoom · clic izq seleccionar · clic der ordenar · Shift agregar selección · Esc cancelar colocación</div>
    <div class="toast" id="toast"></div>
    <div class="overlay" id="overlay">
      <div class="panel">
        <h1>Imperios 1800-2100</h1>
        <p>RTS inspirado en Age of Empires II: recolectá <b>Suministros, Materiales, Combustible y Minerales</b>, construí tu base, entrená unidades y destruí el Ayuntamiento enemigo para ganar.</p>
        <div class="grid2">
          <div class="cardopt">
            <h4>Eras y equivalentes</h4>
            <ul>
              <li><b>I Vapor (1800-1870)</b> ≈ Edad Oscura: economía y milicia.</li>
              <li><b>II Acero (1870-1945)</b> ≈ Feudal: fusileros y blindados ligeros.</li>
              <li><b>III Motor (1945-2000)</b> ≈ Castillos: poder combinado.</li>
              <li><b>IV Autónoma (2000-2100)</b> ≈ Imperial: élite y maravilla.</li>
            </ul>
          </div>
          <div class="cardopt">
            <h4>Controles y objetivo</h4>
            <ul>
              <li>Ingenieros recolectan y construyen (seleccionalos).</li>
              <li>Cuartel entrena Milicia/Fusileros (según era).</li>
              <li>Contra: infantería &lt; distancia &lt; movilidad (simplificado).</li>
              <li><b>Victoria:</b> destruir el Ayuntamiento enemigo.</li>
            </ul>
          </div>
        </div>
        <p class="small">Prototipo jugable (slice vertical) en Three.js: foco en bucle económico-militar, era progresiva y presentación atmosférica. Algunas unidades/edificios avanzados quedan como expansión futura.</p>
        <button class="primary" id="start">Comenzar partida</button>
      </div>
    </div>
  `
  const q = (id: string) => root.querySelector('#' + id) as HTMLElement
  return {
    root,
    resEls: {
      suministros: q('r-suministros'),
      materiales: q('r-materiales'),
      combustible: q('r-combustible'),
      minerales: q('r-minerales'),
    },
    eraEl: q('era'),
    popEl: q('pop'),
    selInfo: q('selection-info'),
    actions: q('actions'),
    overlay: q('overlay'),
    toast: q('toast'),
    minimap: root.querySelector('#minimap') as HTMLCanvasElement,
  }
}

export function updateTopBar(ui: UIRefs, gs: GameState): void {
  const p = gs.players.player
  ui.resEls.suministros.textContent = String(Math.floor(p.resources.suministros))
  ui.resEls.materiales.textContent = String(Math.floor(p.resources.materiales))
  ui.resEls.combustible.textContent = String(Math.floor(p.resources.combustible))
  ui.resEls.minerales.textContent = String(Math.floor(p.resources.minerales))
  ui.popEl.textContent = `${p.pop}/${p.popCap}`
  const era = ERAS[p.era - 1]
  ui.eraEl.textContent = p.advancing
    ? `Avanzando a ${ERAS[p.advancing.to - 1].name} (${Math.ceil(p.advancing.remaining)}s)`
    : `${era.name} (${era.years})`
}

export function renderActions(ui: UIRefs, gs: GameState, onTrain: (bId: number, t: UnitType) => void, onBuild: (t: BuildingType) => void, onAdvance: () => void): void {
  const acts = ui.actions
  const sigParts = [
    gs.selectedIds.join(','),
    gs.players.player.era,
    gs.players.player.pop,
    gs.players.player.popCap,
    gs.players.player.advancing ? `a${gs.players.player.advancing.to}:${Math.ceil(gs.players.player.advancing.remaining)}` : 'a0',
    Math.floor(gs.players.player.resources.suministros),
    Math.floor(gs.players.player.resources.materiales),
    Math.floor(gs.players.player.resources.combustible),
    Math.floor(gs.players.player.resources.minerales),
    ...gs.selectedIds.map(id => {
      const e = getEntity(gs, id)
      if (!e) return 'x'
      if (e.kind === 'building') return `b${e.id}:${e.btype}:${e.built ? 1 : 0}:${e.queue.length}`
      if (e.kind === 'unit') return `u${e.id}:${e.utype}:${e.team}`
      return `r${e.id}`
    }),
  ].join('|')
  if ((acts as any).dataset.sig === sigParts) return
  ;(acts as any).dataset.sig = sigParts
  acts.innerHTML = ''
  const sel = gs.selectedIds.map(id => getEntity(gs, id)).filter(Boolean) as any[]
  const p = gs.players.player

  const addBtn = (label: string, sub: string, fn: () => void, disabled = false) => {
    const b = document.createElement('button')
    b.className = 'btn'
    b.disabled = disabled
    b.innerHTML = `${label}<small>${sub}</small>`
    b.onclick = fn
    acts.appendChild(b)
  }

  if (sel.length === 1 && sel[0].kind === 'building' && sel[0].team === 'player' && sel[0].built) {
    const b = sel[0]
    const defB = BUILDING_DEFS[b.btype]
    if (defB.produces) {
      for (const ut of defB.produces) {
        const defU = UNIT_DEFS[ut]
        if (defU.era > p.era) continue
        const chk = canTrain(gs, 'player', ut)
        addBtn(defU.name, formatCost(defU.cost), () => onTrain(b.id, ut), !chk.ok)
      }
    }
    if (b.btype === 'ayuntamiento') {
      const next = ERAS[p.era]
      if (next) addBtn(`Avanzar era`, `${next.name} · ${formatCost(next.advanceCost)}`, onAdvance, !!p.advancing)
      else addBtn('Era máxima', 'IV alcanzada', () => {}, true)
    }
  }

  const hasEngineer = sel.some((e: any) => e.kind === 'unit' && e.team === 'player' && e.utype === 'ingeniero')
  if (hasEngineer) {
    const defs: BuildingType[] = ['vivienda', 'cuartel', 'almacen']
    for (const bt of defs) {
      const d = BUILDING_DEFS[bt]
      addBtn(`Construir ${d.name}`, formatCost(d.cost), () => onBuild(bt))
    }
  }

  if (acts.children.length === 0) {
    const span = document.createElement('div')
    span.style.color = '#98a6bd'; span.style.fontSize = '12px'
    span.textContent = 'Seleccioná unidades o edificios para ver acciones.'
    acts.appendChild(span)
  }
}

export function updateSelectionInfo(ui: UIRefs, gs: GameState): void {
  const sel = gs.selectedIds.map(id => getEntity(gs, id)).filter(Boolean) as any[]
  if (sel.length === 0) { ui.selInfo.textContent = 'Sin selección. Clic izq: seleccionar · Clic der: mover/recolectar/atacar.'; return }
  if (sel.length === 1) {
    const e = sel[0]
    if (e.kind === 'unit') {
      const d = UNIT_DEFS[e.utype]
      ui.selInfo.innerHTML = `<b>${d.name}</b> (${e.team === 'player' ? 'Aliado' : 'Enemigo'}) — Vida ${Math.ceil(e.hp)}/${e.maxHp} · ${d.role === 'economy' ? 'Recolecta y construye' : 'Unidad militar'}`
    } else if (e.kind === 'building') {
      const d = BUILDING_DEFS[e.btype]
      let info = `<b>${d.name}</b> (${e.team === 'player' ? 'Aliado' : 'Enemigo'}) — Vida ${Math.ceil(e.hp)}/${e.maxHp}`
      let bar = ''
      if (!e.built) {
        const pct = Math.max(0, Math.min(100, Math.floor(e.buildProgress * 100)))
        info += ` · Construyendo ${pct}%`
        bar = `<div class="prod-bar"><div class="prod-bar-fill build" style="width:${pct}%"></div></div>`
      } else if (e.queue.length > 0) {
        const job = e.queue[0]
        const pct = Math.max(0, Math.min(100, ((job.total - job.remaining) / job.total) * 100))
        const secs = Math.max(0, Math.ceil(job.remaining))
        const unitName = UNIT_DEFS[job.type]?.name ?? job.type
        const extra = e.queue.length > 1 ? ` · +${e.queue.length - 1} en cola` : ''
        info += ` · Entrenando <b>${unitName}</b>: ${Math.floor(pct)}% (${secs}s)${extra}`
        bar = `<div class="prod-bar"><div class="prod-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>`
      }
      ui.selInfo.innerHTML = `<div>${info}</div>${bar}`
    } else {
      const rk = e.resource as ResourceKey
      ui.selInfo.innerHTML = `<b>Nodo de ${RESOURCE_LABEL[rk]}</b> — Restante ${Math.ceil(e.amount)}`
    }
  } else {
    ui.selInfo.innerHTML = `<b>${sel.length} unidades/entidades seleccionadas</b>`
  }
}

export function showToast(ui: UIRefs, msg: string): void {
  ui.toast.textContent = msg
  ui.toast.classList.add('show')
  setTimeout(() => ui.toast.classList.remove('show'), 1800)
}

export function updateMinimap(ui: UIRefs, gs: GameState, camX?: number, camZ?: number): void {
  const c = ui.minimap
  const ctx = c.getContext('2d')!
  const w = c.width, h = c.height
  ctx.clearRect(0,0,w,h)
  ctx.fillStyle = '#24331f'
  ctx.fillRect(0,0,w,h)
  const s = gs.mapSize
  const tx = (x: number) => ((x + s/2) / s) * w
  const tz = (z: number) => ((z + s/2) / s) * h
  for (const e of gs.entities.values()) {
    if (e.dead) continue
    if (e.kind === 'resource') {
      ctx.fillStyle = e.resource === 'suministros' ? '#7bbf5e' : e.resource === 'materiales' ? '#2f7a3d' : e.resource === 'combustible' ? '#222' : '#9aa3ad'
      ctx.fillRect(tx(e.x)-2, tz(e.z)-2, 4, 4)
    } else if (e.kind === 'building') {
      ctx.fillStyle = e.team === 'player' ? '#4aa3ff' : '#ff5a5a'
      const sz = e.btype === 'ayuntamiento' ? 6 : 4
      ctx.fillRect(tx(e.x)-sz/2, tz(e.z)-sz/2, sz, sz)
    } else {
      ctx.fillStyle = e.team === 'player' ? '#9fd0ff' : '#ff9a9a'
      ctx.fillRect(tx(e.x)-1.5, tz(e.z)-1.5, 3, 3)
    }
  }
  if (camX != null && camZ != null) {
    const cx = tx(camX)
    const cz = tz(camZ)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(cx - 9, cz - 7, 18, 14)
  }
}

export function showEnd(ui: UIRefs, status: 'victory' | 'defeat'): void {
  ui.overlay.classList.remove('hidden')
  ui.overlay.innerHTML = `
    <div class="panel">
      <h1>${status === 'victory' ? 'Victoria' : 'Derrota'}</h1>
      <p>${status === 'victory'
        ? 'Destruiste el Ayuntamiento enemigo. Tu asentamiento industrial se impuso en esta era.'
        : 'El enemigo destruyó tu Ayuntamiento. Reorganizá tu economía y volvé a intentarlo.'}</p>
      <button class="primary" id="restart">Jugar de nuevo</button>
    </div>
  `
}
