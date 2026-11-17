import { BUILDING_DEFS, ERAS, RESOURCE_LABEL, TECHS, TILE, UNIT_DEFS } from '../core/config'
import { formatCost } from '../core/utils'
import { canResearch, canTrain, getEntity, type GameState } from '../sim/state'
import { VIS_EXPLORED, VIS_UNKNOWN, VIS_VISIBLE, visionAtCell } from '../sim/vision'
import type { BuildingType, Cost, ResourceKey, Stance, Team, UnitType } from '../core/types'

const STANCE_LABEL: Record<Stance, string> = {
  aggressive: 'Agresiva',
  defensive: 'Defensiva',
  standground: 'Mantener',
  noattack: 'No atacar',
}

const STANCES: Stance[] = ['aggressive', 'defensive', 'standground', 'noattack']

const UNIT_ICON: Record<string, string> = {
  ingeniero: '👷',
  milicia: '⚔️',
  granadero: '🧨',
  fusilero: '🔫',
  francotirador: '🎯',
  inf_mecanizada: '🪖',
  blindado: '🚙',
  canon: '💣',
  tanque: '🚜',
  cazacarros: '🛡️',
  dron: '🚁',
  tanque_autonomo: '🤖',
  mlrs: '🚀',
}

const BUILDING_ICON: Record<string, string> = {
  ayuntamiento: '🏛️',
  vivienda: '🏠',
  cuartel: '🏰',
  almacen: '📦',
  fabrica: '🏭',
  torre: '🗼',
}

const RESOURCE_ICON: Record<ResourceKey, string> = {
  suministros: '🌾',
  materiales: '🪵',
  combustible: '🛢️',
  minerales: '💎',
}

const STANCE_ICON: Record<Stance, string> = {
  aggressive: '⚔️',
  defensive: '🛡️',
  standground: '✋',
  noattack: '🚫',
}

export interface UIRefs {
  root: HTMLElement
  resEls: Record<string, HTMLElement>
  eraEl: HTMLElement
  popEl: HTMLElement
  clockEl: HTMLElement
  selInfo: HTMLElement
  actions: HTMLElement
  overlay: HTMLElement
  toast: HTMLElement
  minimap: HTMLCanvasElement
  /** Reusable ImageData buffer for the fog-masked minimap background. */
  mmImage: ImageData | null
  /** Research / era-advance progress strip under the top bar. */
  progWrap: HTMLElement
  progFill: HTMLElement
  progLabel: HTMLElement
  idleList: HTMLElement
  idleCount: HTMLElement
}

export function createUI(root: HTMLElement): UIRefs {
  root.innerHTML = `
    <div class="topbar">
      <div class="era-badge" id="era">Era del Vapor</div>
      <div class="res res-chip" title="Suministros"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="#d7e07a" d="M8 1.5c-2.6 2-4 4.4-4 7 0 2.8 1.7 5 4 5s4-2.2 4-5c0-2.6-1.4-5-4-7z"/></svg><b id="r-suministros">0</b></div>
      <div class="res res-chip" title="Materiales"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="#c08a4a" d="M2 14V7l6-4 6 4v7h-4V9H6v5z"/></svg><b id="r-materiales">0</b></div>
      <div class="res res-chip" title="Combustible"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="#e0734a" d="M9.5 1.5s-4 4.8-4 8a4 4 0 0 0 8 0c0-1.4-.6-2.7-1.5-4-.9 1-1.7 1.2-2.5 1.2.7-1.8.7-3.7 0-5.2z"/></svg><b id="r-combustible">0</b></div>
      <div class="res res-chip" title="Minerales"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="#c8d2dc" d="M8 1.5 13 6.5 8 14.5 3 6.5z"/></svg><b id="r-minerales">0</b></div>
      <div class="res res-chip res-chip-pop" title="Población"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="#9fd0ff" d="M8 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM3 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5z"/></svg><b id="pop">0/0</b></div>
      <div class="res res-chip res-chip-clock" title="Tiempo de partida"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="#98a6bd" d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 2v5l3 2" stroke="#98a6bd" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg><b id="clock">0:00</b></div>
    </div>
    <div class="prog-wrap" id="prog"><div class="prod-bar"><div class="prod-bar-fill" id="prog-fill"></div></div><div class="prog-label" id="prog-label"></div></div>
    <div class="leftpanel">
      <h3>Acciones</h3>
      <div id="actions" class="actions command-card"></div>
      <div class="left-hint">Seleccioná un Ayuntamiento o Cuartel para producir. Seleccioná un Ingeniero y usá los botones de construcción.</div>
    </div>
    <div class="bottombar"><div id="selection-info" class="selection-info">Sin selección. Clic izq: seleccionar · Clic der: mover/recolectar/atacar.</div></div>
    <div class="idle-wrap" id="idle-wrap">
      <div class="idle-head"><span>Unidades ociosas</span><b id="idle-count">0</b></div>
      <div id="idle-list" class="idle-list"></div>
    </div>
    <div class="minimap-wrap"><canvas id="minimap" width="220" height="220"></canvas></div>
    <button class="help-toggle" id="help-toggle" title="Controles" aria-label="Controles">?</button>
    <div class="help-panel hidden" id="help-panel">
      <h4>Controles</h4>
      <ul>
        <li><b>WASD</b> mover cámara · <b>Q/E</b> rotar · rueda zoom</li>
        <li><b>Clic izq</b> seleccionar · arrastre: caja</li>
        <li><b>Clic der</b> mover / recolectar / atacar</li>
        <li><b>Shift</b> agregar · <b>Shift+clic der</b> encolar orden</li>
        <li><b>Esc</b> cancelar colocación / deseleccionar</li>
        <li>Minimapa: clic para centrar la cámara</li>
      </ul>
    </div>
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
              <li>Cuartel entrena infantería; Fábrica Militar vehículos y artillería.</li>
              <li>Investigá tecnologías en el Ayuntamiento para mejorar tu ejército.</li>
              <li>Contra: cada unidad tiene fortalezas y debilidades (counters).</li>
              <li><b>Victoria:</b> destruir el Ayuntamiento enemigo.</li>
            </ul>
          </div>
        </div>
        <div class="grid2">
          <div class="cardopt">
            <h4>Niebla de guerra</h4>
            <ul>
              <li>Lo nunca visto es negro: explorá con ingenieros o avanzá con el ejército.</li>
              <li>Lo explorado queda en velo gris (memoria): recordás el terreno y edificios vistos, no las unidades.</li>
              <li>Los edificios enemigos vistos quedan en gris hasta volver a verlos.</li>
              <li>El minimapa usa la misma niebla que la vista principal.</li>
            </ul>
          </div>
          <div class="cardopt">
            <h4>Formaciones y combate</h4>
            <ul>
              <li>Clic derecho con un grupo: se mueve en formación (caja, línea, cuña).</li>
              <li>Posturas: agresiva, defensiva, mantener posición, no atacar.</li>
              <li>Trazadoras e impactos marcan cada disparo; las bajas dejan humo.</li>
              <li>Las torres disparan solas a todo lo que entre en su radio de visión.</li>
            </ul>
          </div>
        </div>
        <p class="small">Prototipo jugable (slice vertical) en Three.js: bucle económico-militar, 4 eras, 13 unidades con counters, tecnologías, torres defensivas, formaciones, pathfinding A* sobre rejilla de navegación y niebla de guerra por equipo.</p>
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
    clockEl: q('clock'),
    selInfo: q('selection-info'),
    actions: q('actions'),
    overlay: q('overlay'),
    toast: q('toast'),
    minimap: root.querySelector('#minimap') as HTMLCanvasElement,
    mmImage: null,
    progWrap: q('prog'),
    progFill: q('prog-fill'),
    progLabel: q('prog-label'),
    idleList: q('idle-list'),
    idleCount: q('idle-count'),
  }
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v))
}

function shortEntityLabel(name: string): string {
  const clean = name.replace(/^Investigación:\s*/i, '').replace(/^Avance:\s*/i, '').trim()
  if (clean.length <= 11) return clean
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) {
    const compact = `${parts[0]} ${parts[1][0]}.`
    if (compact.length <= 12) return compact
  }
  return clean.slice(0, 10) + '…'
}

function teamLabel(team: Team): string {
  return team === 'player' ? 'Aliado' : 'Enemigo'
}

function formatCostRich(cost: Cost): string {
  const parts: string[] = []
  if (cost.suministros) parts.push(`${RESOURCE_ICON.suministros}${cost.suministros}`)
  if (cost.materiales) parts.push(`${RESOURCE_ICON.materiales}${cost.materiales}`)
  if (cost.combustible) parts.push(`${RESOURCE_ICON.combustible}${cost.combustible}`)
  if (cost.minerales) parts.push(`${RESOURCE_ICON.minerales}${cost.minerales}`)
  return parts.length ? parts.join(' ') : 'Sin costo'
}

function hpFillClass(pct: number): string {
  if (pct <= 25) return 'is-low'
  if (pct <= 55) return 'is-mid'
  return 'is-high'
}

function hpBarHtml(hp: number, maxHp: number, cls = ''): string {
  const pct = maxHp > 0 ? clampPct((hp / maxHp) * 100) : 0
  return `<div class="hp-bar ${cls}"><div class="hp-bar-fill ${hpFillClass(pct)}" style="width:${pct.toFixed(1)}%"></div></div>`
}

function miniHpBarHtml(hp: number, maxHp: number): string {
  const pct = maxHp > 0 ? clampPct((hp / maxHp) * 100) : 0
  return `<div class="mini-hp"><div class="mini-hp-fill ${hpFillClass(pct)}" style="width:${pct.toFixed(1)}%"></div></div>`
}

function chipLetter(label: string): string {
  const m = label.match(/[A-Za-zÁÉÍÓÚÜÑ0-9]/)
  return (m ? m[0] : '?').toUpperCase()
}

/**
 * Research / era progress strip. AoE2 tells you what is being researched and
 * how long is left in the top bar; the bar under it answers "how far along".
 */
export function updateTopBar(ui: UIRefs, gs: GameState): void {
  const p = gs.players.player
  ui.resEls.suministros.textContent = String(Math.floor(p.resources.suministros))
  ui.resEls.materiales.textContent = String(Math.floor(p.resources.materiales))
  ui.resEls.combustible.textContent = String(Math.floor(p.resources.combustible))
  ui.resEls.minerales.textContent = String(Math.floor(p.resources.minerales))
  ui.popEl.textContent = `${p.pop}/${p.popCap}`
  ui.popEl.classList.toggle('warn', p.pop >= p.popCap)
  const mm = Math.floor(gs.time / 60), ss = Math.floor(gs.time % 60)
  ui.clockEl.textContent = `${mm}:${String(ss).padStart(2, '0')}`
  const era = ERAS[p.era - 1]
  const research = p.research ? TECHS.find(t => t.id === p.research!.id) : null
  ui.eraEl.textContent = era.name
  ui.eraEl.title = p.advancing ? `Avanzando a ${ERAS[p.advancing.to - 1].name}` : `${era.name} (${era.years})`

  // progress strip: era advance wins over research (it is the bigger decision)
  let label = ''
  let pct = 0
  let secsLeft = 0
  let kind: 'era' | 'research' = 'research'
  if (p.advancing) {
    const { remaining, total, to } = p.advancing
    pct = total > 0 ? ((total - remaining) / total) * 100 : 0
    secsLeft = Math.ceil(Math.max(0, remaining))
    label = `Avance de era: ${ERAS[to - 1].name}`
    kind = 'era'
  } else if (p.research && research) {
    const { remaining, total } = p.research
    pct = total > 0 ? ((total - remaining) / total) * 100 : 0
    secsLeft = Math.ceil(Math.max(0, remaining))
    label = `Investigación: ${research.name}`
  }
  if (!label) {
    ui.progWrap.classList.remove('show')
    return
  }
  const clamped = Math.max(0, Math.min(100, pct))
  ui.progWrap.classList.add('show')
  ui.progWrap.classList.toggle('is-era', kind === 'era')
  ui.progWrap.classList.toggle('is-research', kind === 'research')
  ui.progFill.style.width = `${clamped.toFixed(1)}%`
  ui.progFill.className = `prod-bar-fill ${kind === 'era' ? 'era' : 'research'}`
  const icon = kind === 'era' ? '⏫' : '🔬'
  const progText = `${icon} ${label} · ${Math.floor(clamped)}% completado · ${secsLeft}s restantes`
  if (ui.progLabel.textContent !== progText) {
    ui.progLabel.textContent = progText
  }
}

export function renderActions(ui: UIRefs, gs: GameState, onTrain: (bId: number, t: UnitType) => void, onBuild: (t: BuildingType) => void, onAdvance: () => void, onResearch: (id: string) => void, onStance?: (s: Stance) => void): void {
  const acts = ui.actions
  const sigParts = [
    gs.selectedIds.join(','),
    gs.players.player.era,
    gs.players.player.pop,
    gs.players.player.popCap,
    gs.players.player.advancing ? `a${gs.players.player.advancing.to}:${Math.ceil(gs.players.player.advancing.remaining)}` : 'a0',
    gs.players.player.research ? `res${gs.players.player.research.id}:${Math.ceil(gs.players.player.research.remaining)}` : 'res0',
    gs.players.player.researched.join(','),
    Math.floor(gs.players.player.resources.suministros),
    Math.floor(gs.players.player.resources.materiales),
    Math.floor(gs.players.player.resources.combustible),
    Math.floor(gs.players.player.resources.minerales),
    ...gs.selectedIds.map(id => {
      const e = getEntity(gs, id)
      if (!e) return 'x'
      if (e.kind === 'building') return `b${e.id}:${e.btype}:${e.built ? 1 : 0}:${e.queue.length}`
      if (e.kind === 'unit') return `u${e.id}:${e.utype}:${e.team}:${e.stance}`
      return `r${e.id}`
    }),
  ].join('|')
  if ((acts as any).dataset.sig === sigParts) return
  ;(acts as any).dataset.sig = sigParts
  acts.innerHTML = ''
  const sel = gs.selectedIds.map(id => getEntity(gs, id)).filter(Boolean) as any[]
  const p = gs.players.player

  const addBtn = (
    label: string,
    sub: string,
    fn: () => void,
    disabled = false,
    opts?: { title?: string, active?: boolean, kind?: string, icon?: string, cost?: Cost, subExtra?: string }
  ) => {
    const b = document.createElement('button')
    b.className = 'btn cmd-slot'
    if (opts?.active) b.classList.add('is-active')
    if (opts?.kind) b.classList.add(`cmd-${opts.kind}`)
    if (opts?.icon) b.classList.add('has-icon')
    b.disabled = disabled
    if (opts?.title) b.title = opts.title
    const iconHtml = opts?.icon ? `<span class="cmd-icon" aria-hidden="true">${opts.icon}</span>` : ''
    const subParts: string[] = []
    if (opts?.subExtra) subParts.push(`<span class="cmd-sub-extra">${opts.subExtra}</span>`)
    if (opts?.cost) subParts.push(`<span class="cost-tag">Costo</span><span class="cost-values">${formatCostRich(opts.cost)}</span>`)
    const subContent = subParts.length ? subParts.join(' ') : sub
    const costClass = opts?.cost ? ' has-cost' : ''
    b.innerHTML = `${iconHtml}<span class="cmd-name">${label}</span><small class="cmd-cost${costClass}">${subContent}</small>`
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
        addBtn(shortEntityLabel(defU.name), '', () => onTrain(b.id, ut), !chk.ok, {
          title: `Entrenar ${defU.name}. Costo: ${formatCost(defU.cost)}. Clic para entrenar.`,
          kind: 'train',
          icon: UNIT_ICON[ut] ?? '❔',
          cost: defU.cost,
        })
      }
    }
    if (b.btype === 'ayuntamiento') {
      const next = ERAS[p.era]
      if (next) {
        addBtn('Avanzar era', '', onAdvance, !!p.advancing, {
          title: `Avanzar a ${next.name}. Costo: ${formatCost(next.advanceCost)}. Clic para iniciar el avance de era.`,
          kind: 'advance',
          icon: '⏫',
          subExtra: shortEntityLabel(next.name),
          cost: next.advanceCost,
        })
      } else {
        addBtn('Era máx.', 'IV alcanzada', () => {}, true, {
          title: 'Era máxima alcanzada.',
          kind: 'advance',
          icon: '🏁',
        })
      }
      for (const t of TECHS) {
        if (p.researched.includes(t.id)) continue
        const chk = canResearch(gs, 'player', t.id)
        addBtn(shortEntityLabel(t.name), '', () => onResearch(t.id), !chk.ok, {
          title: `Investigar ${t.name}: ${t.desc}. Costo: ${formatCost(t.cost)}. Clic para investigar.`,
          kind: 'research',
          icon: '🔬',
          cost: t.cost,
        })
      }
    }
  }

  const hasEngineer = sel.some((e: any) => e.kind === 'unit' && e.team === 'player' && e.utype === 'ingeniero')
  if (hasEngineer) {
    const defs: BuildingType[] = ['vivienda', 'cuartel', 'almacen', 'torre', 'fabrica']
    for (const bt of defs) {
      const d = BUILDING_DEFS[bt]
      addBtn(shortEntityLabel(d.name), '', () => onBuild(bt), false, {
        title: `Construir ${d.name}. Costo: ${formatCost(d.cost)}. Clic para colocar el edificio.`,
        kind: 'build',
        icon: BUILDING_ICON[bt] ?? '🏗️',
        cost: d.cost,
      })
    }
  }

  const ownUnits = sel.filter((e: any) => e.kind === 'unit' && e.team === 'player')
  if (ownUnits.length > 0 && onStance) {
    const current: Stance = ownUnits.every((e: any) => e.stance === ownUnits[0].stance) ? ownUnits[0].stance : 'aggressive'
    for (const s of STANCES) {
      const active = s === current
      addBtn(shortEntityLabel(STANCE_LABEL[s]), active ? 'Postura actual' : 'Cambiar postura', () => onStance(s), false, {
        title: `Postura: ${STANCE_LABEL[s]}. ${active ? 'Postura activa.' : 'Clic para aplicar postura.'}`,
        active,
        kind: 'stance',
        icon: STANCE_ICON[s] ?? '•',
      })
    }
  }

  if (acts.children.length === 0) {
    const span = document.createElement('div')
    span.className = 'actions-empty'
    span.textContent = 'Seleccioná unidades o edificios para ver acciones y costos.'
    acts.appendChild(span)
  }
}

export function updateSelectionInfo(ui: UIRefs, gs: GameState): void {
  const sel = gs.selectedIds.map(id => getEntity(gs, id)).filter(Boolean) as any[]
  if (sel.length === 0) {
    ui.selInfo.innerHTML = '<span class="sel-empty">Sin selección. Clic izq: seleccionar · Clic der: mover/recolectar/atacar.</span>'
    return
  }

  if (sel.length === 1) {
    const e = sel[0]
    if (e.kind === 'unit') {
      const d = UNIT_DEFS[e.utype]
      let econ = ''
      if (e.utype === 'ingeniero') {
        // what the engineer is actually doing right now: rate, load, node
        const rate = (d.gatherRate ?? 8) * (1 + gs.players[e.team as Team].bonuses.gatherPct)
        const load = `${Math.floor(e.carryAmount)}/${d.carry ?? 10}`
        if (e.gatherTargetId != null) {
          const node = getEntity(gs, e.gatherTargetId)
          const resName = node && node.kind === 'resource' ? RESOURCE_LABEL[node.resource] : 'recurso'
          econ = `Recolectando ${resName} a ${rate.toFixed(1)}/s · Carga ${load}`
        } else if (e.carryAmount > 0) {
          econ = `Volviendo a depositar · Carga ${load}`
        } else if (e.state === 'build') {
          econ = 'Construyendo'
        } else {
          econ = 'Disponible para recolectar y construir'
        }
      } else {
        econ = d.role === 'economy' ? 'Recolecta y construye' : 'Unidad militar'
      }
      const stance = e.team === 'player' ? `<span class="sel-pill">Postura: ${STANCE_LABEL[e.stance as Stance]}</span>` : ''
      const econPill = econ ? `<span class="sel-pill subtle">${econ}</span>` : ''
      const counters = (d as any).counters ? `<span class="sel-pill subtle">${(d as any).counters}</span>` : ''
      const icon = UNIT_ICON[e.utype] ?? '❔'
      ui.selInfo.innerHTML = `
        <div class="sel-card sel-unit team-${e.team}">
          <div class="sel-head">
            <div class="sel-head-main">
              <span class="sel-portrait" aria-hidden="true">${icon}</span>
              <div>
                <div class="sel-title">${d.name}</div>
                <div class="sel-sub">${teamLabel(e.team as Team)} · ${d.role === 'economy' ? 'Economía' : 'Militar'} · ${e.utype} · Daño ${d.damage ?? 0} · Alcance ${d.range ?? 0}</div>
              </div>
            </div>
            <div class="sel-hpnum">${Math.ceil(e.hp)}/${e.maxHp} HP</div>
          </div>
          ${hpBarHtml(e.hp, e.maxHp, 'hp-prominent')}
          <div class="sel-meta">${econPill}${stance}${counters}</div>
        </div>`
    } else if (e.kind === 'building') {
      const d = BUILDING_DEFS[e.btype]
      let status = e.built ? 'Operativo' : `Construyendo ${Math.max(0, Math.min(100, Math.floor(e.buildProgress * 100)))}%`
      let extra = ''
      let bars = hpBarHtml(e.hp, e.maxHp, 'hp-prominent')
      if (!e.built) {
        const pct = Math.max(0, Math.min(100, Math.floor(e.buildProgress * 100)))
        status = `Construyendo ${pct}%`
        bars += `<div class="prod-bar sel-prod"><div class="prod-bar-fill build" style="width:${pct}%"></div></div>`
        extra = `<span class="sel-pill">Progreso de obra: ${pct}%</span>`
      } else if (e.queue.length > 0) {
        const job = e.queue[0]
        const pct = Math.max(0, Math.min(100, ((job.total - job.remaining) / job.total) * 100))
        const secs = Math.max(0, Math.ceil(job.remaining))
        const unitName = UNIT_DEFS[job.type]?.name ?? job.type
        status = `Produciendo ${unitName} · ${Math.floor(pct)}% · ${secs}s restantes`
        bars += `<div class="prod-bar sel-prod"><div class="prod-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>`
        const nextItems = e.queue.slice(1, 4).map((j: { type: UnitType }) => UNIT_DEFS[j.type]?.name ?? j.type)
        const moreQueued = e.queue.length - 1 - nextItems.length
        extra = `<span class="sel-pill">Producción en cola: ${e.queue.length}</span><span class="sel-pill subtle">Actual: ${unitName} · ${Math.floor(pct)}% · ${secs}s restantes</span>`
        if (nextItems.length > 0) {
          extra += `<span class="sel-pill subtle">Siguientes: ${nextItems.join(', ')}${moreQueued > 0 ? `, +${moreQueued} más` : ''}</span>`
        }
      } else {
        extra = `<span class="sel-pill subtle">${d.produces && d.produces.length ? 'Sin producción en cola · Listo para producir' : 'Sin cola de producción'}</span>`
      }

      let progInfo = ''
      if (e.built && e.btype === 'ayuntamiento' && e.team === 'player') {
        const pstate = gs.players.player
        if (pstate.advancing) {
          const { remaining, total, to } = pstate.advancing
          const pct = total > 0 ? clampPct(((total - remaining) / total) * 100) : 0
          const secs = Math.ceil(Math.max(0, remaining))
          bars += `<div class="prod-bar sel-prod"><div class="prod-bar-fill era" style="width:${pct.toFixed(1)}%"></div></div>`
          progInfo += `<span class="sel-pill">Avance de era: ${ERAS[to - 1].name}</span><span class="sel-pill subtle">Progreso ${Math.floor(pct)}% · ${secs}s restantes</span>`
          if (e.queue.length === 0) status = `Avanzando a ${ERAS[to - 1].name} · ${Math.floor(pct)}%`
        } else if (pstate.research) {
          const tech = TECHS.find(t => t.id === pstate.research!.id)
          if (tech) {
            const { remaining, total } = pstate.research
            const pct = total > 0 ? clampPct(((total - remaining) / total) * 100) : 0
            const secs = Math.ceil(Math.max(0, remaining))
            bars += `<div class="prod-bar sel-prod"><div class="prod-bar-fill research" style="width:${pct.toFixed(1)}%"></div></div>`
            progInfo += `<span class="sel-pill">Investigación: ${tech.name}</span><span class="sel-pill subtle">Progreso ${Math.floor(pct)}% · ${secs}s restantes</span>`
            if (e.queue.length === 0) status = `Investigando ${tech.name} · ${Math.floor(pct)}%`
          }
        } else if (e.queue.length === 0) {
          progInfo += `<span class="sel-pill subtle">Sin avance de era ni investigación en curso</span>`
        }
      }

      const icon = BUILDING_ICON[e.btype] ?? '🏗️'
      ui.selInfo.innerHTML = `
        <div class="sel-card sel-building team-${e.team}">
          <div class="sel-head">
            <div class="sel-head-main">
              <span class="sel-portrait" aria-hidden="true">${icon}</span>
              <div>
                <div class="sel-title">${d.name}</div>
                <div class="sel-sub">${teamLabel(e.team as Team)} · Edificio · ${status} · ${d.produces && d.produces.length ? `Produce: ${d.produces.slice(0, 4).map((u: UnitType) => UNIT_DEFS[u]?.name ?? u).join(', ')}${d.produces.length > 4 ? ', …' : ''}` : 'Estructura'}</div>
              </div>
            </div>
            <div class="sel-hpnum">${Math.ceil(e.hp)}/${e.maxHp} HP</div>
          </div>
          ${bars}
          <div class="sel-meta">${extra}${progInfo}</div>
        </div>`
    } else {
      const rk = e.resource as ResourceKey
      const remaining = Math.max(0, Math.ceil(e.amount))
      const max = typeof e.maxAmount === 'number' && e.maxAmount > 0 ? e.maxAmount : e.amount
      const pct = max > 0 ? clampPct((e.amount / max) * 100) : 0
      const icon = RESOURCE_ICON[rk] ?? '⛏️'
      ui.selInfo.innerHTML = `
        <div class="sel-card sel-resource">
          <div class="sel-head">
            <div class="sel-head-main">
              <span class="sel-portrait" aria-hidden="true">${icon}</span>
              <div>
                <div class="sel-title">Nodo de ${RESOURCE_LABEL[rk]}</div>
                <div class="sel-sub">Recurso natural · ${RESOURCE_LABEL[rk]}</div>
              </div>
            </div>
            <div class="sel-hpnum">${remaining} rest.</div>
          </div>
          ${hpBarHtml(e.amount, max, 'hp-prominent resource')}
          <div class="sel-meta"><span class="sel-pill subtle">Restante ${remaining} · ${Math.floor(pct)}%</span></div>
        </div>`
    }
    return
  }

  const maxChips = 24
  const chips = sel.slice(0, maxChips).map((e: any) => {
    if (e.kind === 'unit') {
      const d = UNIT_DEFS[e.utype]
      const icon = UNIT_ICON[e.utype] ?? chipLetter(d.name)
      return `<div class="sel-chip team-${e.team}" title="${d.name} (${teamLabel(e.team as Team)}) ${Math.ceil(e.hp)}/${e.maxHp} HP">
        <div class="sel-chip-top"><span class="sel-chip-icon" aria-hidden="true">${icon}</span><span class="sel-chip-name">${shortEntityLabel(d.name)}</span></div>
        ${miniHpBarHtml(e.hp, e.maxHp)}
        <div class="sel-chip-team">${teamLabel(e.team as Team)}</div>
      </div>`
    }
    if (e.kind === 'building') {
      const d = BUILDING_DEFS[e.btype]
      const icon = BUILDING_ICON[e.btype] ?? chipLetter(d.name)
      return `<div class="sel-chip team-${e.team}" title="${d.name} (${teamLabel(e.team as Team)}) ${Math.ceil(e.hp)}/${e.maxHp} HP">
        <div class="sel-chip-top"><span class="sel-chip-icon" aria-hidden="true">${icon}</span><span class="sel-chip-name">${shortEntityLabel(d.name)}</span></div>
        ${miniHpBarHtml(e.hp, e.maxHp)}
        <div class="sel-chip-team">${teamLabel(e.team as Team)}</div>
      </div>`
    }
    const rk = e.resource as ResourceKey
    const max = typeof e.maxAmount === 'number' && e.maxAmount > 0 ? e.maxAmount : e.amount
    const icon = RESOURCE_ICON[rk] ?? chipLetter(RESOURCE_LABEL[rk])
    return `<div class="sel-chip team-neutral" title="Nodo de ${RESOURCE_LABEL[rk]} · ${Math.ceil(e.amount)} restante">
      <div class="sel-chip-top"><span class="sel-chip-icon" aria-hidden="true">${icon}</span><span class="sel-chip-name">${shortEntityLabel(RESOURCE_LABEL[rk])}</span></div>
      ${miniHpBarHtml(e.amount, max)}
      <div class="sel-chip-team">Recurso</div>
    </div>`
  }).join('')
  const more = sel.length - maxChips
  ui.selInfo.innerHTML = `
    <div class="sel-card sel-multi">
      <div class="sel-head"><div><div class="sel-title">${sel.length} entidades seleccionadas</div><div class="sel-sub">Resumen rápido de la selección</div></div>${more > 0 ? `<div class="sel-hpnum">+${more} más</div>` : ''}</div>
      <div class="sel-chip-grid">${chips}</div>
      ${more > 0 ? `<div class="sel-more">+${more} más</div>` : ''}
    </div>`
}

export function showToast(ui: UIRefs, msg: string): void {
  ui.toast.textContent = msg
  ui.toast.classList.add('show')
  setTimeout(() => ui.toast.classList.remove('show'), 1800)
}

export function updateIdleList(ui: UIRefs, gs: GameState): void {
  const idle: Array<{ id: number; x: number; z: number; utype: UnitType; name: string; icon: string }> = []
  for (const e of gs.entities.values() as any) {
    if (!e || e.dead) continue
    if (e.kind !== 'unit' || e.team !== 'player') continue
    if (e.state !== 'idle') continue
    const d = UNIT_DEFS[e.utype as UnitType]
    idle.push({
      id: e.id,
      x: e.x,
      z: e.z,
      utype: e.utype,
      name: d?.name ?? e.utype,
      icon: UNIT_ICON[e.utype] ?? '•',
    })
  }
  idle.sort((a, b) => a.id - b.id)
  ui.idleCount.textContent = String(idle.length)
  const sig = idle.map(u => u.id).join(',')
  if ((ui.idleList as any).dataset.sig === sig) return
  ;(ui.idleList as any).dataset.sig = sig
  if (idle.length === 0) {
    ui.idleList.innerHTML = '<div class="idle-empty">Sin unidades ociosas</div>'
    return
  }
  ui.idleList.innerHTML = idle.map(u => `
    <button class="idle-item" data-id="${u.id}" data-x="${u.x}" data-z="${u.z}" title="${u.name} · Ir y seleccionar">
      <span class="idle-icon" aria-hidden="true">${u.icon}</span>
      <span class="idle-name">${shortEntityLabel(u.name)}</span>
    </button>`).join('')
}

export function updateMinimap(ui: UIRefs, gs: GameState, camX?: number, camZ?: number): void {
  const c = ui.minimap
  const ctx = c.getContext('2d')!
  const w = c.width, h = c.height
  const s = gs.mapSize
  const tx = (x: number) => ((x + s/2) / s) * w
  const tz = (z: number) => ((z + s/2) / s) * h

  // ---- background: one block per vision cell (unknown black / explored dim)
  const observer: Team | null = gs.viewAs === 'all' ? null : gs.viewAs
  const gw = Math.max(1, Math.round(gs.mapSize / TILE))
  let img = ui.mmImage
  if (!img || img.width !== w || img.height !== h) {
    img = ctx.createImageData(w, h)
    ui.mmImage = img
  }
  const data = img.data
  for (let py = 0; py < h; py++) {
    const cz = Math.min(gw - 1, Math.floor((py / h) * gw))
    for (let px = 0; px < w; px++) {
      const cx = Math.min(gw - 1, Math.floor((px / w) * gw))
      const v = observer ? visionAtCell(gs, observer, cx, cz) : VIS_VISIBLE
      const o = (py * w + px) * 4
      // 0 = unexplored (near black), 1 = explored (gray-blue memory), 2 = visible (lit terrain)
      if (v === VIS_UNKNOWN) { data[o] = 4; data[o+1] = 6; data[o+2] = 12 }
      else if (v === VIS_EXPLORED) { data[o] = 96; data[o+1] = 106; data[o+2] = 122 }
      else { data[o] = 82; data[o+1] = 112; data[o+2] = 70 }
      data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // ---- entities, filtered by the same fog the main view uses
  const known = observer ? gs.knownBuildings[observer] : null
  for (const e of gs.entities.values()) {
    if (e.dead) continue
    const own = !observer || e.team === observer
    const cell = observer ? visionAtCell(gs, observer, Math.floor((e.x + s / 2) / TILE), Math.floor((e.z + s / 2) / TILE)) : VIS_VISIBLE
    const visible = own || cell >= VIS_VISIBLE
    if (e.kind === 'resource') {
      if (cell < VIS_EXPLORED) continue // never seen: not on the minimap
      ctx.fillStyle = e.resource === 'suministros' ? '#7bbf5e' : e.resource === 'materiales' ? '#2f7a3d' : e.resource === 'combustible' ? '#222' : '#9aa3ad'
      ctx.fillRect(tx(e.x)-2, tz(e.z)-2, 4, 4)
    } else if (e.kind === 'building') {
      const remembered = !visible && known != null && known.has(e.id)
      if (!visible && !remembered) continue
      if (!visible) ctx.fillStyle = 'rgba(150,164,178,0.75)'      // remembered: grey
      else ctx.fillStyle = e.team === 'player' ? '#4aa3ff' : '#ff5a5a'
      const sz = e.btype === 'ayuntamiento' ? 6 : 4
      ctx.fillRect(tx(e.x)-sz/2, tz(e.z)-sz/2, sz, sz)
    } else {
      if (!visible) continue // enemy units only when in sight
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
