import { TUNING } from './config'
import type { PowerUpKind } from './level'

export type GameState = 'menu' | 'playing' | 'paused' | 'won' | 'dead'

/** Una pista en coordenadas de pantalla, ya proyectada por el llamador. */
export interface ScreenHint {
  x: number
  y: number
  /** 0..1, para atenuar según la distancia. */
  distance: number
}

export interface Hud {
  onPlay(handler: () => void): void
  onEnemiesChange(handler: (on: boolean) => void): void
  /** Estado actual del toggle de enemigos. */
  enemiesEnabled(): boolean
  /** Refleja el modo en el toggle, su nota y la leyenda del panel. */
  setEnemiesMode(on: boolean): void
  setOrbs(current: number, total: number): void
  setTime(seconds: number): void
  setBest(seconds: number | null): void
  setCombo(multiplier: number, ratio: number): void
  setPowerUps(active: Record<PowerUpKind, boolean>, timers: Record<PowerUpKind, number>): void
  setThreatened(on: boolean): void
  /**
   * Actualiza la brújula y los marcadores de amenaza.
   *
   * Se pasan ya proyectados a coordenadas de pantalla (px, dentro del viewport)
   * para que el HUD no dependa de three.js. `compass` y `markers` comparten
   * el mismo objeto `ScreenHint` para no alocar por frame.
   */
  setHints(compass: ScreenHint | null, markers: ScreenHint[]): void
  flashBest(): void
  showToast(html: string, durationMs?: number): void
  showOverlay(show: boolean): void
  setOverlayTitle(title: string, tagline: string, buttonLabel: string): void
  setHudVisible(visible: boolean): void
  setCrosshairVisible(visible: boolean): void
  flashDamage(): void
}

const POWER_META: Record<PowerUpKind, { label: string; color: string }> = {
  turbo: { label: 'turbo', color: '#7cc4ff' },
  doubleJump: { label: 'doble salto', color: '#c39bff' },
  slowmo: { label: 'tiempo lento', color: '#9dff9d' },
}

const POWER_ORDER: PowerUpKind[] = ['turbo', 'doubleJump', 'slowmo']

export function createHud(): Hud {
  const overlay = document.getElementById('overlay') as HTMLElement
  const panel = overlay.querySelector('.panel') as HTMLElement
  const title = document.getElementById('overlay-title') as HTMLElement | null
  const tagline = document.getElementById('overlay-tagline') as HTMLElement | null
  const playBtn = document.getElementById('play') as HTMLButtonElement
  const hint = document.getElementById('hint') as HTMLElement
  const hud = document.getElementById('hud') as HTMLElement
  const crosshair = document.getElementById('crosshair') as HTMLElement
  const countEl = document.getElementById('count') as HTMLElement
  const timeEl = document.getElementById('time') as HTMLElement
  const bestEl = document.getElementById('best') as HTMLElement
  const toast = document.getElementById('toast') as HTMLElement
  const combo = document.getElementById('combo') as HTMLElement
  const comboMult = document.getElementById('combo-mult') as HTMLElement
  const comboFill = document.getElementById('combo-fill') as HTMLElement
  const powerups = document.getElementById('powerups') as HTMLElement
  const threat = document.getElementById('threat') as HTMLElement
  const compassEl = document.getElementById('compass') as HTMLElement
  const markersEl = document.getElementById('markers') as HTMLElement
  const enemiesInput = document.getElementById('enemies') as HTMLInputElement
  const enemiesNote = document.getElementById('enemies-note') as HTMLElement
  const legendEnemy = document.getElementById('legend-enemy') as HTMLElement | null

  let toastTimer = 0

  /**
   * Pool de marcadores de amenaza. Se crean hasta el pico de enemigos
   * simultáneos y se reutilizan: crear y tirar nodos por frame es lo que
   * hace que el HUD se trabe cuando aparecen varios perseguidores.
   */
  const markerPool: HTMLElement[] = []

  function markerAt(i: number): HTMLElement {
    let el = markerPool[i]
    if (!el) {
      el = document.createElement('div')
      el.className = 'marker'
      markersEl.appendChild(el)
      markerPool[i] = el
    }
    return el
  }

  const ENEMY_ON_NOTE = 'te persiguen si te acercás'
  const ENEMY_OFF_NOTE = 'recolectá sin que te intercepten'

  function formatTime(seconds: number): string {
    return seconds.toFixed(2)
  }

  /** Aplica el modo al toggle, su nota y la leyenda del panel. */
  function applyEnemyMode(on: boolean): void {
    enemiesInput.checked = on
    enemiesNote.textContent = on ? ENEMY_ON_NOTE : ENEMY_OFF_NOTE
    // Sin enemigos la leyenda del panel no debe prometer una amenaza.
    legendEnemy?.classList.toggle('hidden', !on)
  }

  // Crea los chips de power-up una sola vez y los muestra/oculta.
  const powerChips = new Map<PowerUpKind, HTMLElement>()
  for (const kind of POWER_ORDER) {
    const chip = document.createElement('div')
    chip.className = 'power-chip'
    chip.style.setProperty('--chip', POWER_META[kind].color)
    chip.textContent = POWER_META[kind].label
    powerups.appendChild(chip)
    powerChips.set(kind, chip)
  }

  return {
    onPlay(handler: () => void): void {
      playBtn.addEventListener('click', handler)
    },
    onEnemiesChange(handler: (on: boolean) => void): void {
      enemiesInput.addEventListener('change', () => {
        const on = enemiesInput.checked
        applyEnemyMode(on)
        handler(on)
      })
    },
    enemiesEnabled(): boolean {
      return enemiesInput.checked
    },
    setEnemiesMode(on: boolean): void {
      applyEnemyMode(on)
    },
    setOrbs(current, total) {
      countEl.textContent = `${current} / ${total}`
    },
    setTime(seconds) {
      // La cuenta regresiva nunca baja de cero: el Game Over lo dispara
      // `main` en el mismo frame, así que un negativo aquí sería solo ruido.
      timeEl.textContent = formatTime(Math.max(0, seconds))
      // Últimos 10 segundos: el reloj se tensa y late.
      timeEl.classList.toggle('critical', seconds <= 10)
    },
    setBest(seconds) {
      bestEl.textContent = seconds === null ? '—' : formatTime(seconds)
    },
    setCombo(multiplier, ratio) {
      const on = multiplier > 1
      combo.classList.toggle('visible', on)
      comboMult.textContent = `x${multiplier}`
      comboFill.style.width = `${Math.round(ratio * 100)}%`
      // `urgent` solo tiene sentido con el combo activo y por expirar.
      combo.classList.toggle('urgent', on && ratio < 0.3)
    },
    setPowerUps(active, timers) {
      for (const kind of POWER_ORDER) {
        const chip = powerChips.get(kind)
        if (!chip) continue
        chip.classList.toggle('visible', active[kind])
        if (active[kind]) {
          chip.textContent = `${POWER_META[kind].label} ${timers[kind].toFixed(1)}s`
        }
      }
    },
    setThreatened(on) {
      threat.classList.toggle('hidden', !on)
    },
    setHints(compass, markers) {
      // Brújula: una flecha que apunta al orbe pendiente más cercano.
      if (compass) {
        compassEl.style.transform = `translate(-50%, -50%) translate(${compass.x}px, ${compass.y}px)`
        compassEl.style.opacity = String(1 - compass.distance * 0.55)
        compassEl.classList.add('visible')
      } else {
        compassEl.classList.remove('visible')
      }

      // Marcadores: uno por enemigo que está persiguiendo de verdad.
      for (let i = 0; i < markerPool.length; i++) {
        const el = markerPool[i]
        const hint = markers[i]
        if (hint) {
          el.className = 'marker visible'
          el.style.transform = `translate(-50%, -50%) translate(${hint.x}px, ${hint.y}px)`
          el.style.opacity = String(1 - hint.distance * 0.4)
        } else if (el.classList.contains('visible')) {
          el.className = 'marker'
        }
      }
      // Sólo hay que crear nodos nuevos cuando aparecen más perseguidores de
      // los que el pool ya tiene.
      for (let i = markerPool.length; i < markers.length; i++) {
        const el = markerAt(i)
        const hint = markers[i]
        el.className = 'marker visible'
        el.style.transform = `translate(-50%, -50%) translate(${hint.x}px, ${hint.y}px)`
        el.style.opacity = String(1 - hint.distance * 0.4)
      }
    },
    flashBest() {
      bestEl.classList.remove('beat')
      void bestEl.offsetWidth
      bestEl.classList.add('beat')
      window.setTimeout(() => bestEl.classList.remove('beat'), 500)
    },
    showToast(html, durationMs = 2200) {
      toast.innerHTML = html
      toast.classList.add('visible')
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => {
        toast.classList.remove('visible')
      }, durationMs)
    },
    showOverlay(show) {
      overlay.classList.toggle('hidden', !show)
      hint.classList.toggle('hidden', !show)
    },
    setOverlayTitle(newTitle, newTagline, buttonLabel) {
      if (title) title.textContent = newTitle
      if (tagline) tagline.textContent = newTagline
      playBtn.textContent = buttonLabel
      panel.dataset.state = 'ready'
    },
    setHudVisible(visible) {
      hud.classList.toggle('visible', visible)
    },
    setCrosshairVisible(visible) {
      crosshair.classList.toggle('visible', visible)
    },
    flashDamage() {
      document.body.classList.remove('hit')
      void document.body.offsetWidth
      document.body.classList.add('hit')
      window.setTimeout(() => document.body.classList.remove('hit'), 320)
    },
  }
}

/** Clave de récord según el modo: cada uno tiene un tiempo no comparable. */
function bestKey(enemies: boolean): string {
  return enemies ? TUNING.storageKeyEnemies : TUNING.storageKeyCalm
}

export function readBest(enemies: boolean): number | null {
  const raw = localStorage.getItem(bestKey(enemies))
  if (raw === null) return null
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function saveBest(seconds: number, enemies: boolean): boolean {
  const key = bestKey(enemies)
  const previous = Number.parseFloat(localStorage.getItem(key) ?? 'NaN')
  if (Number.isFinite(previous) && previous <= seconds) return false
  localStorage.setItem(key, seconds.toFixed(2))
  return true
}

/** Lee el modo elegido la vez pasada; por defecto, con enemigos. */
export function readMode(): boolean {
  return localStorage.getItem(TUNING.storageKeyMode) !== 'off'
}

export function saveMode(enemies: boolean): void {
  localStorage.setItem(TUNING.storageKeyMode, enemies ? 'on' : 'off')
}