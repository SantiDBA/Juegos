type Ctx = AudioContext

/** Volumen general, en el único lugar donde se define. */
const MASTER_LEVEL = 0.3

/**
 * Sonido sintetizado con WebAudio: sin archivos que cargar y sin dependencias.
 * El contexto se crea de forma perezosa en la primera interacción del usuario,
 * porque los navegadores bloquean el audio antes de eso.
 *
 * El mapa de sonidos sigue la mecánica del juego, no el adorno: agarrar, soltar,
 * completar línea (el pitch sube con el combo), nivel y fin. Un turno sin línea
 * suena distinto de uno que limpia el tablero, que es la información que el
 * jugador necesita de oído.
 */
export class Sfx {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  muted = false

  /** Debe llamarse dentro de un gesto del usuario. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    // Respeta el mute pedido antes de que existiera el contexto: sin esto no
    // se puede silenciar desde el menú, porque el primer sonido sale igual.
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL
    this.master.connect(this.ctx.destination)

    // Buffer de ruido blanco reutilizable (2s)
    const length = this.ctx.sampleRate * 2
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_LEVEL
  }

  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return
    const t0 = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration)
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  private noise(duration: number, gain: number, filterHz: number, delay = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t0 = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterHz
    filter.Q.value = 1.2
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(gain, t0)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    src.start(t0)
    src.stop(t0 + duration)
  }

  /** Pieza levantada de la bandeja: click corto y agudo. */
  grab(): void {
    this.tone('sine', 380, 560, 0.055, 0.1)
    this.noise(0.03, 0.04, 2200)
  }

  /** Pieza apoyada sin completar línea: golpe seco. */
  place(): void {
    this.tone('triangle', 240, 132, 0.1, 0.22)
    this.noise(0.055, 0.07, 1100)
  }

  /** El destino no acepta la pieza. */
  invalid(): void {
    this.tone('sawtooth', 190, 96, 0.14, 0.16)
    this.tone('sawtooth', 150, 74, 0.16, 0.13, 0.085)
  }

  /**
   * Línea completada.
   *
   * Arpegio que sube con el multiplicador de combo, así una racha se escucha
   * como una racha sin mirar el HUD. Las líneas de tablero completo agregan una
   * nota más arriba.
   */
  line(combo: number, length: number): void {
    const base = 392 * Math.pow(1.12, Math.min(combo - 1, 6))
    const steps = length >= 8 ? [0, 4, 7, 12] : [0, 4, 7]
    steps.forEach((s, i) => {
      const f = base * Math.pow(2, s / 12)
      this.tone('triangle', f, f * 1.02, 0.18, 0.22, i * 0.05)
    })
    this.noise(0.12, 0.05, 3200)
  }

  /** Varias líneas en el mismo turno: sube un escalón por línea. */
  multiLine(count: number): void {
    const n = Math.min(count, 4)
    for (let i = 0; i < n; i++) {
      const base = 523.25 * Math.pow(1.12, i)
      this.tone('triangle', base, base * 1.5, 0.2, 0.2, i * 0.06)
    }
    this.tone('sine', 1568, 2093, 0.3, 0.12, 0.12)
    this.noise(0.18, 0.06, 4200)
  }

  /** Nivel superado: arpegio mayor ascendente. */
  levelClear(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.24, 0.22, i * 0.075))
  }

  /** Se acabó: cuatro notas descendentes, sin ruido de impacto. */
  gameOver(): void {
    const notes = [392, 329.63, 261.63, 196]
    notes.forEach((n, i) => this.tone('sawtooth', n, n * 0.98, 0.34, 0.18, i * 0.13))
    this.noise(0.5, 0.08, 240)
  }

  /** Nuevo récord: entra después de `gameOver`, cuando ya bajó todo. */
  best(): void {
    const notes = [659.25, 830.61, 987.77, 1318.5]
    notes.forEach((n, i) => this.tone('triangle', n, n * 1.01, 0.3, 0.2, 0.5 + i * 0.09))
    this.tone('sine', 2093, 2637, 0.4, 0.1, 0.86)
  }
}
