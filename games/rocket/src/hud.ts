import { TUNING } from './config'
import { isGameMode, type GameMode } from './mode'
import { isCarStyleId, type CarStyleId } from './carStyles'

export type GameState = 'menu' | 'kickoff' | 'playing' | 'goal' | 'paused' | 'gameover'

export interface Hud {
  onPlay(handler: () => void): void
  onModeChange(handler: (mode: GameMode) => void): void
  onCarChange(handler: (car: CarStyleId) => void): void
  setScore(blue: number, orange: number): void
  setClock(seconds: number, overtime: boolean): void
  setBoost(value: number): void
  setSupersonic(on: boolean): void
  showCountdown(value: number | null): void
  showOverlay(show: boolean): void
  setOverlayTitle(title: string, tagline: string, buttonLabel: string): void
  setHudVisible(visible: boolean): void
  /** Ajusta nombres de equipo y qué bloques del marcador se ven, según el modo. */
  setModeLabels(mode: GameMode): void
  setModePickerVisible(visible: boolean): void
  setCarLabels(car: CarStyleId): void
  setCarPickerVisible(visible: boolean): void
  flashGoal(team: 'blue' | 'orange'): void
  showToast(html: string, durationMs?: number): void
}

/**
 * Nombres del marcador por modo. En entrenamiento no hay rival, así que el
 * bloque naranja y el reloj desaparecen y el azul pasa a contar goles.
 */
const MODE_LABELS: Record<GameMode, { blue: string; orange: string; clock: boolean }> = {
  training: { blue: 'goles', orange: '', clock: false },
  duel: { blue: 'vos', orange: 'bot', clock: true },
  threes: { blue: 'vos', orange: 'rivales', clock: true },
}

/** Reloj en m:ss, con el cero a la izquierda sólo si hace falta. */
function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function createHud(): Hud {
  const overlay = document.getElementById('overlay') as HTMLElement
  const title = document.getElementById('overlay-title') as HTMLElement
  const tagline = document.getElementById('overlay-tagline') as HTMLElement
  const playBtn = document.getElementById('play') as HTMLButtonElement
  const hud = document.getElementById('hud') as HTMLElement
  const scoreBlue = document.getElementById('score-blue') as HTMLElement
  const scoreOrange = document.getElementById('score-orange') as HTMLElement
  const labelBlue = document.getElementById('label-blue') as HTMLElement
  const labelOrange = document.getElementById('label-orange') as HTMLElement
  const teamOrange = document.getElementById('team-orange') as HTMLElement
  const clock = document.getElementById('clock') as HTMLElement
  const modes = document.getElementById('modes') as HTMLElement
  const modeButtons = Array.from(modes.querySelectorAll<HTMLButtonElement>('.mode'))
  const carsBox = document.getElementById('cars') as HTMLElement
  const carButtons = Array.from(carsBox.querySelectorAll<HTMLButtonElement>('.mode'))
  const boostFill = document.getElementById('boost-fill') as HTMLElement
  const boostWrap = document.getElementById('boostwrap') as HTMLElement
  const supersonic = document.getElementById('supersonic') as HTMLElement
  const countdown = document.getElementById('countdown') as HTMLElement
  const flash = document.getElementById('flash') as HTMLElement
  const toast = document.getElementById('toast') as HTMLElement

  let toastTimer = 0
  let flashTimer = 0

  function applyModeLabels(mode: GameMode): void {
    const labels = MODE_LABELS[mode]
    labelBlue.textContent = labels.blue
    labelOrange.textContent = labels.orange
    teamOrange.classList.toggle('hidden', mode === 'training')
    clock.classList.toggle('hidden', !labels.clock)
    for (const button of modeButtons) {
      const on = button.dataset.mode === mode
      button.classList.toggle('on', on)
      button.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
  }

  function applyCarLabels(car: CarStyleId): void {
    for (const button of carButtons) {
      const on = button.dataset.car === car
      button.classList.toggle('on', on)
      button.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
  }

  return {
    onPlay(handler) {
      playBtn.addEventListener('click', handler)
    },
    onModeChange(handler) {
      for (const button of modeButtons) {
        button.addEventListener('click', () => {
          const next = button.dataset.mode
          if (next === undefined || !isGameMode(next)) return
          applyModeLabels(next)
          handler(next)
        })
      }
    },
    setModeLabels(mode) {
      applyModeLabels(mode)
    },
    setModePickerVisible(visible) {
      modes.classList.toggle('hidden', !visible)
    },
    onCarChange(handler) {
      for (const button of carButtons) {
        button.addEventListener('click', () => {
          const next = button.dataset.car
          if (next === undefined || !isCarStyleId(next)) return
          applyCarLabels(next)
          handler(next)
        })
      }
    },
    setCarLabels(car) {
      applyCarLabels(car)
    },
    setCarPickerVisible(visible) {
      carsBox.classList.toggle('hidden', !visible)
    },
    setScore(blue, orange) {
      scoreBlue.textContent = String(blue)
      scoreOrange.textContent = String(orange)
    },
    setClock(seconds, overtime) {
      clock.textContent = overtime ? 'gol de oro' : formatClock(seconds)
      clock.classList.toggle('overtime', overtime)
      clock.classList.toggle('low', !overtime && seconds <= 30)
    },
    setBoost(value) {
      const ratio = Math.max(0, Math.min(1, value / TUNING.boostMax))
      boostFill.style.width = `${Math.round(ratio * 100)}%`
      boostWrap.classList.toggle('low', ratio < 0.02)
    },
    setSupersonic(on) {
      supersonic.classList.toggle('visible', on)
    },
    showCountdown(value) {
      if (value === null) {
        countdown.classList.remove('visible')
        return
      }
      countdown.textContent = value > 0 ? String(value) : '¡ya!'
      countdown.classList.add('visible')
      // Reinicia la animación de escala forzando un reflow.
      countdown.classList.remove('tick')
      void countdown.offsetWidth
      countdown.classList.add('tick')
    },
    showOverlay(show) {
      overlay.classList.toggle('hidden', !show)
    },
    setOverlayTitle(newTitle, newTagline, buttonLabel) {
      title.textContent = newTitle
      tagline.textContent = newTagline
      playBtn.textContent = buttonLabel
    },
    setHudVisible(visible) {
      hud.classList.toggle('visible', visible)
    },
    flashGoal(team) {
      flash.classList.remove('blue', 'orange')
      flash.classList.add(team)
      flash.classList.remove('visible')
      void flash.offsetWidth
      flash.classList.add('visible')
      window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => flash.classList.remove('visible'), 700)
    },
    showToast(html, durationMs = 2200) {
      toast.innerHTML = html
      toast.classList.add('visible')
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toast.classList.remove('visible'), durationMs)
    },
  }
}

export function readBest(): number | null {
  const raw = localStorage.getItem(TUNING.storageKeyGoals)
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Guarda el récord de goles de una partida. Devuelve si batió el anterior. */
export function saveBest(goals: number): boolean {
  const previous = Number.parseInt(localStorage.getItem(TUNING.storageKeyGoals) ?? 'NaN', 10)
  if (Number.isFinite(previous) && previous >= goals) return false
  localStorage.setItem(TUNING.storageKeyGoals, String(goals))
  return true
}

export function readMuted(): boolean {
  return localStorage.getItem(TUNING.storageKeyMuted) === 'on'
}

export function saveMuted(muted: boolean): void {
  localStorage.setItem(TUNING.storageKeyMuted, muted ? 'on' : 'off')
}

/** Modo elegido la vez pasada; por defecto, 1 vs 1. */
export function readMode(): GameMode {
  const raw = localStorage.getItem(TUNING.storageKeyMode)
  return isGameMode(raw) ? raw : 'duel'
}

export function saveMode(mode: GameMode): void {
  localStorage.setItem(TUNING.storageKeyMode, mode)
}

/** Chasis elegido la vez pasada; por defecto, el octane. */
export function readCar(): CarStyleId {
  const raw = localStorage.getItem(TUNING.storageKeyCar)
  return isCarStyleId(raw) ? raw : 'octane'
}

export function saveCar(car: CarStyleId): void {
  localStorage.setItem(TUNING.storageKeyCar, car)
}
