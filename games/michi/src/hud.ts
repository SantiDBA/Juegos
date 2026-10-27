import { CRITICAL, NEEDS, NEED_ORDER, NEEDS_MAX, type NeedId, type Needs } from './needs'
import { TUNING } from './config'

/** No hay `gameover`: la partida no termina nunca. */
export type GameState = 'menu' | 'playing' | 'paused'

export interface Hud {
  onPlay(handler: () => void): void
  /** Refresca las cinco barras. */
  setNeeds(needs: Needs): void
  /** Cuántos cuidados se completaron en la partida. */
  setCares(cares: number): void
  setClock(seconds: number): void
  /** Récord de cuidados, o null si todavía no hay ninguno. */
  setBest(cares: number | null): void
  /** `label` null esconde el cartel. `value01` es lo lleno que está la barra. */
  showPrompt(label: string | null, value01: number): void
  setHudVisible(visible: boolean): void
  showOverlay(show: boolean): void
  setOverlayTitle(title: string, tagline: string, button: string): void
  showToast(html: string, ms?: number): void
}

interface NeedRow {
  root: HTMLElement
  value: HTMLElement
  fill: HTMLElement
  lastValue: number
  lastKind: string
}

/** Semáforo de una necesidad: verde, ámbar o rojo. */
function classify(value: number): string {
  if (value <= CRITICAL) return 'crit'
  if (value <= NEEDS_MAX * 0.5) return 'warn'
  return 'ok'
}

/** Reloj en m:ss. El tiempo es lo que se sobrevive, así que sólo sube. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function createHud(): Hud {
  const needsRoot = document.getElementById('needs') as HTMLElement
  const caresEl = document.getElementById('cares') as HTMLElement
  const clockEl = document.getElementById('clock') as HTMLElement
  const bestEl = document.getElementById('best') as HTMLElement
  const hudEl = document.getElementById('hud') as HTMLElement
  const statusEl = document.getElementById('status') as HTMLElement
  const overlay = document.getElementById('overlay') as HTMLElement
  const title = document.getElementById('overlay-title') as HTMLElement
  const tagline = document.getElementById('overlay-tagline') as HTMLElement
  const playBtn = document.getElementById('play') as HTMLButtonElement
  const legend = document.getElementById('legend') as HTMLElement
  const prompt = document.getElementById('prompt') as HTMLElement
  const promptKey = document.getElementById('prompt-key') as HTMLElement
  const promptText = document.getElementById('prompt-text') as HTMLElement
  const promptFill = document.getElementById('prompt-fill') as HTMLElement
  const toast = document.getElementById('toast') as HTMLElement

  // Las cinco filas se arman desde `NEED_ORDER`: el HUD no tiene una lista
  // propia que se pueda desincronizar del modelo.
  const rows = new Map<NeedId, NeedRow>()
  for (const id of NEED_ORDER) {
    const def = NEEDS[id]
    const root = document.createElement('div')
    root.className = 'need'

    const emoji = document.createElement('span')
    emoji.className = 'need-emoji'
    emoji.textContent = def.emoji

    const body = document.createElement('div')
    body.className = 'need-body'

    const head = document.createElement('div')
    head.className = 'need-head'
    const label = document.createElement('span')
    label.className = 'need-label'
    label.textContent = def.label
    const value = document.createElement('span')
    value.className = 'need-value'
    value.textContent = String(NEEDS_MAX)
    head.append(label, value)

    const track = document.createElement('div')
    track.className = 'need-track'
    const fill = document.createElement('div')
    fill.className = 'need-fill'
    track.appendChild(fill)

    body.append(head, track)
    root.append(emoji, body)
    needsRoot.appendChild(root)

    rows.set(id, { root, value, fill, lastValue: -1, lastKind: '' })

    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = `${def.emoji} ${def.label}`
    legend.appendChild(chip)
  }

  let toastTimer = 0

  return {
    onPlay(handler) {
      playBtn.addEventListener('click', handler)
    },

    setNeeds(needs) {
      for (const id of NEED_ORDER) {
        const row = rows.get(id)!
        const value = Math.max(0, Math.min(NEEDS_MAX, needs[id]))
        const rounded = Math.round(value)
        const kind = classify(value)
        // Sólo se toca el DOM cuando algo cambió: cinco barras por frame es poco,
        // pero escribir de más hace recálculos de estilo innecesarios.
        if (rounded === row.lastValue && kind === row.lastKind) continue
        row.lastValue = rounded
        row.lastKind = kind
        row.value.textContent = String(rounded)
        row.fill.style.width = `${(value / NEEDS_MAX) * 100}%`
        row.root.classList.remove('ok', 'warn', 'crit')
        row.root.classList.add(kind)
      }
    },

    setCares(cares) {
      caresEl.textContent = String(cares)
    },

    setClock(seconds) {
      clockEl.textContent = formatTime(seconds)
    },

    setBest(cares) {
      bestEl.textContent = cares === null ? '—' : String(cares)
    },

    showPrompt(label, value01) {
      if (label === null) {
        prompt.classList.remove('visible')
        return
      }
      prompt.classList.add('visible')
      promptKey.textContent = 'E'
      promptText.textContent = label
      promptFill.style.width = `${Math.max(0, Math.min(1, value01)) * 100}%`
    },

    setHudVisible(visible) {
      // Las barras y la barra de estado son bloques distintos del layout; se
      // prenden y apagan juntos para que el HUD entre y salga como uno solo.
      hudEl.classList.toggle('visible', visible)
      statusEl.classList.toggle('visible', visible)
    },

    showOverlay(show) {
      overlay.classList.toggle('hidden', !show)
    },

    setOverlayTitle(newTitle, newTagline, button) {
      title.textContent = newTitle
      tagline.textContent = newTagline
      playBtn.textContent = button
    },

    showToast(html, ms = 2200) {
      toast.innerHTML = html
      toast.classList.add('visible')
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toast.classList.remove('visible'), ms)
    },
  }
}

export function readBest(): number | null {
  const raw = localStorage.getItem(TUNING.storageKeyBest)
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Guarda el récord de cuidados. Devuelve si batió el anterior. */
export function saveBest(cares: number): boolean {
  const previous = Number.parseInt(localStorage.getItem(TUNING.storageKeyBest) ?? 'NaN', 10)
  if (Number.isFinite(previous) && previous >= cares) return false
  localStorage.setItem(TUNING.storageKeyBest, String(cares))
  return true
}

export function readMuted(): boolean {
  return localStorage.getItem(TUNING.storageKeyMuted) === 'on'
}

export function saveMuted(muted: boolean): void {
  localStorage.setItem(TUNING.storageKeyMuted, muted ? 'on' : 'off')
}
