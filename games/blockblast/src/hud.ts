import { TUNING } from './config'
import { targetForLevel } from './levels'

export type GameState = 'menu' | 'playing' | 'gameover' | 'levelclear'

export interface Hud {
  onPlay(handler: () => void): void
  setScore(score: number, best: number | null): void
  setLevel(level: number, target: number): void
  setMoves(moves: number): void
  setCombo(multiplier: number): void
  /** Largo de la última línea completada, como referencia visual. */
  setBestLine(length: number): void
  setProgress(ratio: number): void
  showOverlay(show: boolean): void
  setOverlayTitle(title: string, tagline: string, buttonLabel: string, result?: string | null): void
  setHudVisible(visible: boolean): void
  /** Posición horizontal del HUD en px, o null para dejarla al CSS (móvil). */
  setOffsetLeft(px: number | null): void
  /** Celebra el resultado del panel (récord): el HUD quedaba tapado por el velo. */
  flashResult(): void
  /** Borde inferior del HUD en px: `computeLayout` lo usa para no tapar el tablero. */
  bottomPx(): number
  setUndoEnabled(enabled: boolean): void
  onUndo(handler: () => void): void
  /** Aviso de tablero por trabarse. */
  setDanger(on: boolean): void
  showToast(text: string, durationMs?: number): void
  /** Botón de sonido: avisa el estado que pidió el jugador. */
  onSoundToggle(handler: (muted: boolean) => void): void
  setSoundMuted(muted: boolean): void
}

export function createHud(): Hud {
  const overlay = document.getElementById('overlay') as HTMLElement
  const title = document.getElementById('overlay-title') as HTMLElement
  const tagline = document.getElementById('overlay-tagline') as HTMLElement
  const playBtn = document.getElementById('play') as HTMLButtonElement
  const resultEl = document.getElementById('overlay-result') as HTMLElement
  const hud = document.getElementById('hud') as HTMLElement
  const scoreEl = document.getElementById('score') as HTMLElement
  const bestEl = document.getElementById('best') as HTMLElement
  const levelEl = document.getElementById('level') as HTMLElement
  const movesEl = document.getElementById('moves') as HTMLElement
  const targetEl = document.getElementById('target') as HTMLElement
  const lineEl = document.getElementById('line') as HTMLElement
  const combo = document.getElementById('combo') as HTMLElement
  const comboEl = document.getElementById('combo-value') as HTMLElement
  const progressFill = document.getElementById('progress-fill') as HTMLElement
  const toast = document.getElementById('toast') as HTMLElement
  const soundBtn = document.getElementById('sound') as HTMLButtonElement
  const undoBtn = document.getElementById('undo') as HTMLButtonElement

  let toastTimer = 0
  let soundMuted = false

  const applySound = (): void => {
    // El estado lo dice el propio texto ("encendido"/"apagado"): con `aria-pressed`
    // además, el botón anunciaba dos veces y las dos podían discrepar.
    soundBtn.textContent = soundMuted ? 'sonido apagado' : 'sonido encendido'
    soundBtn.classList.toggle('muted', soundMuted)
  }
  applySound()

  return {
    onPlay(handler) {
      playBtn.addEventListener('click', handler)
    },
    setScore(score, best) {
      scoreEl.textContent = String(score)
      bestEl.textContent = best === null ? '—' : String(best)
    },
    setLevel(level, target) {
      levelEl.textContent = String(level)
      targetEl.textContent = String(target)
    },
    setMoves(moves) {
      movesEl.textContent = String(moves)
    },
    setCombo(multiplier) {
      const on = multiplier > 1
      combo.classList.toggle('visible', on)
      comboEl.textContent = `x${multiplier}`
    },
    setBestLine(length) {
      lineEl.textContent = length > 0 ? String(length) : '—'
    },
    setProgress(ratio) {
      // `scaleX` en vez de `width`: animar el ancho dispara layout en cada frame
      // de la barra; transform lo resuelve en el compositor.
      const clamped = Math.min(1, Math.max(0, ratio))
      progressFill.style.transform = `scaleX(${clamped})`
    },
    showOverlay(show) {
      overlay.classList.toggle('hidden', !show)
      // Es un diálogo modal: el foco entra al panel al abrirse y vuelve al juego
      // al cerrarse, para que el teclado no siga operando el tablero de atrás.
      if (show) playBtn.focus()
      else if (document.activeElement === playBtn) playBtn.blur()
    },
    setOverlayTitle(newTitle, newTagline, buttonLabel, result = null) {
      title.textContent = newTitle
      tagline.textContent = newTagline
      playBtn.textContent = buttonLabel
      // El bloque de introducción (teclas, leyenda, hint) es del menú. En
      // resultado o fin de nivel sobraba: el último texto que leía el jugador
      // era el manual de principiante.
      const intro = result === null
      overlay.classList.toggle('intro', intro)
      resultEl.textContent = result ?? ''
      resultEl.classList.toggle('visible', !intro)
    },
    setHudVisible(visible) {
      hud.classList.toggle('visible', visible)
    },
    setOffsetLeft(px) {
      // '' devuelve el control al CSS, que en pantallas angostas lo centra arriba.
      hud.style.left = px === null ? '' : `${Math.round(px)}px`
    },
    bottomPx() {
      return hud.getBoundingClientRect().bottom
    },
    setUndoEnabled(enabled) {
      undoBtn.disabled = !enabled
    },
    onUndo(handler) {
      undoBtn.addEventListener('click', handler)
    },
    setDanger(on) {
      hud.classList.toggle('danger', on)
    },
    flashResult() {
      resultEl.classList.remove('beat')
      void resultEl.offsetWidth
      resultEl.classList.add('beat')
      window.setTimeout(() => resultEl.classList.remove('beat'), 700)
    },
    showToast(text, durationMs = 1400) {
      toast.textContent = text
      toast.classList.add('visible')
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toast.classList.remove('visible'), durationMs)
    },
    onSoundToggle(handler) {
      soundBtn.addEventListener('click', () => {
        soundMuted = !soundMuted
        applySound()
        handler(soundMuted)
      })
    },
    setSoundMuted(muted) {
      soundMuted = muted
      applySound()
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

export function readLevel(): number {
  const raw = localStorage.getItem(TUNING.storageKeyLevel)
  if (raw === null) return 1
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function saveLevel(level: number): void {
  if (level > readLevel()) localStorage.setItem(TUNING.storageKeyLevel, String(level))
}

export { targetForLevel }