type Ctx = AudioContext

/**
 * Sonido sintetizado con WebAudio: sin archivos que cargar y sin dependencias.
 * El contexto se crea de forma perezosa en la primera interacción del usuario,
 * porque los navegadores bloquean el audio antes de eso.
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
    this.master.gain.value = 0.28
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
    if (this.master) this.master.gain.value = muted ? 0 : 0.28
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

  private noise(duration: number, gain: number, filterHz: number): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t0 = this.ctx.currentTime
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

  /** Orbe recogido. El pitch sube con el combo. */
  collect(comboStep: number): void {
    const base = 520 * Math.pow(1.12, Math.min(comboStep, 8))
    this.tone('triangle', base, base * 1.6, 0.16, 0.32)
    this.tone('sine', base * 2, base * 2.4, 0.1, 0.12, 0.02)
  }

  gold(): void {
    this.tone('triangle', 780, 1560, 0.22, 0.3)
    this.tone('sine', 1170, 2340, 0.18, 0.14, 0.05)
  }

  hazard(): void {
    this.tone('sawtooth', 300, 90, 0.3, 0.28)
  }

  powerUp(): void {
    this.tone('square', 300, 900, 0.18, 0.18)
    this.tone('square', 450, 1350, 0.22, 0.14, 0.08)
  }

  /** Combo perdido: el pitch cae. */
  comboLost(): void {
    this.tone('triangle', 700, 260, 0.22, 0.16)
  }

  jump(): void {
    this.tone('sine', 320, 480, 0.1, 0.12)
  }

  /** Enemy que persigue: rumor grave. */
  alert(): void {
    this.tone('sawtooth', 150, 90, 0.34, 0.2)
    this.noise(0.3, 0.1, 320)
  }

  death(): void {
    this.tone('sawtooth', 220, 55, 0.7, 0.3)
    this.noise(0.5, 0.22, 180)
  }

  /** Se acabó el tiempo: dos notas descendentes, sin ruido de impacto. */
  timeout(): void {
    this.tone('sawtooth', 420, 190, 0.28, 0.24)
    this.tone('sawtooth', 320, 120, 0.42, 0.24, 0.24)
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.28, 0.24, i * 0.09))
  }

  /** Whoosh suave al correr, throttleado por el llamador. */
  step(): void {
    this.noise(0.07, 0.05, 1400)
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
  }
}