import { TUNING } from './config'

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover'

export interface Hud {
  onPlay(handler: () => void): void
  setScore(score: number, best: number | null): void
  setLives(lives: number): void
  setLevel(level: number): void
  /** Fracción 0..1 de puntos comidos, para la barra de progreso. */
  setProgress(ratio: number): void
  setFrightened(active: boolean): void
  showReady(show: boolean): void
  showOverlay(show: boolean): void
  setOverlayTitle(title: string, tagline: string, buttonLabel: string): void
  setHudVisible(visible: boolean): void
  flashBest(): void
  showToast(text: string, durationMs?: number): void
}

export function createHud(): Hud {
  const overlay = document.getElementById('overlay') as HTMLElement
  const title = document.getElementById('overlay-title') as HTMLElement
  const tagline = document.getElementById('overlay-tagline') as HTMLElement
  const playBtn = document.getElementById('play') as HTMLButtonElement
  const hud = document.getElementById('hud') as HTMLElement
  const scoreEl = document.getElementById('score') as HTMLElement
  const bestEl = document.getElementById('best') as HTMLElement
  const livesEl = document.getElementById('lives') as HTMLElement
  const levelEl = document.getElementById('level') as HTMLElement
  const ready = document.getElementById('ready') as HTMLElement
  const progressFill = document.getElementById('progress-fill') as HTMLElement
  const frightBar = document.getElementById('fright-bar') as HTMLElement
  const toast = document.getElementById('toast') as HTMLElement

  let toastTimer = 0

  return {
    onPlay(handler) {
      playBtn.addEventListener('click', handler)
    },
    setScore(score, best) {
      scoreEl.textContent = String(score)
      bestEl.textContent = best === null ? '—' : String(best)
    },
    setLives(lives) {
      livesEl.textContent = '●'.repeat(Math.max(0, lives))
    },
    setLevel(level) {
      levelEl.textContent = String(level)
    },
    setProgress(ratio) {
      progressFill.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`
    },
    setFrightened(active) {
      frightBar.classList.toggle('visible', active)
    },
    showReady(show) {
      ready.classList.toggle('visible', show)
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
    flashBest() {
      bestEl.classList.remove('beat')
      void bestEl.offsetWidth
      bestEl.classList.add('beat')
      window.setTimeout(() => bestEl.classList.remove('beat'), 600)
    },
    showToast(text, durationMs = 1800) {
      toast.textContent = text
      toast.classList.add('visible')
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toast.classList.remove('visible'), durationMs)
    },
  }
}

export function readBest(): number | null {
  const raw = localStorage.getItem(TUNING.storageKeyScore)
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function saveBest(score: number): boolean {
  const previous = Number.parseInt(localStorage.getItem(TUNING.storageKeyScore) ?? 'NaN', 10)
  if (Number.isFinite(previous) && previous >= score) return false
  localStorage.setItem(TUNING.storageKeyScore, String(score))
  return true
}

/** Nivel más alto alcanzado, para arrancar donde se quedó. */
export function readLevel(): number {
  const raw = localStorage.getItem(TUNING.storageKeyLevel)
  if (raw === null) return 1
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function saveLevel(level: number): void {
  const current = readLevel()
  if (level > current) localStorage.setItem(TUNING.storageKeyLevel, String(level))
}