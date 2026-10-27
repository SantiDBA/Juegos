/**
 * Sonido sintetizado con WebAudio: sin archivos que cargar ni dependencias.
 *
 * El contexto se crea perezosamente en el primer gesto del usuario, porque los
 * navegadores bloquean el audio antes de eso. El motor y el boost son fuentes
 * continuas cuyo volumen se modula por frame; el resto son one-shots.
 */
export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private engineOsc: OscillatorNode | null = null
  private engineSub: OscillatorNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private engineGain: GainNode | null = null
  private boostGain: GainNode | null = null
  muted = false

  /** Debe llamarse dentro de un gesto del usuario. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.3
    this.master.connect(ctx.destination)

    const length = ctx.sampleRate * 2
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1

    // Motor: dos dientes de sierra desafinados por un pasabajos. Suena a motor
    // y no a zumbido de oscilador suelto.
    this.engineFilter = ctx.createBiquadFilter()
    this.engineFilter.type = 'lowpass'
    this.engineFilter.frequency.value = 320
    this.engineGain = ctx.createGain()
    this.engineGain.gain.value = 0
    this.engineFilter.connect(this.engineGain).connect(this.master)

    this.engineOsc = ctx.createOscillator()
    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 48
    this.engineOsc.connect(this.engineFilter)
    this.engineOsc.start()

    this.engineSub = ctx.createOscillator()
    this.engineSub.type = 'square'
    this.engineSub.frequency.value = 24
    this.engineSub.connect(this.engineFilter)
    this.engineSub.start()

    // Boost: ruido filtrado, continuo pero en volumen 0.
    const boostSrc = ctx.createBufferSource()
    boostSrc.buffer = this.noiseBuffer
    boostSrc.loop = true
    const boostFilter = ctx.createBiquadFilter()
    boostFilter.type = 'bandpass'
    boostFilter.frequency.value = 900
    boostFilter.Q.value = 0.7
    this.boostGain = ctx.createGain()
    this.boostGain.gain.value = 0
    boostSrc.connect(boostFilter).connect(this.boostGain).connect(this.master)
    boostSrc.start()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.3
  }

  /** `speed01` normaliza la velocidad; `active` apaga el motor fuera de juego. */
  setEngine(speed01: number, active: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineSub || !this.engineGain) return
    if (!this.engineFilter) return
    const now = this.ctx.currentTime
    this.engineOsc.frequency.setTargetAtTime(46 + speed01 * 170, now, 0.06)
    this.engineSub.frequency.setTargetAtTime(23 + speed01 * 60, now, 0.06)
    this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 1100, now, 0.06)
    this.engineGain.gain.setTargetAtTime(active ? 0.035 + speed01 * 0.055 : 0.008, now, 0.08)
  }

  setBoost(active: boolean): void {
    if (!this.ctx || !this.boostGain) return
    this.boostGain.gain.setTargetAtTime(active ? 0.055 : 0, this.ctx.currentTime, 0.05)
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
    filter.Q.value = 1.1
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(gain, t0)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    src.start(t0)
    src.stop(t0 + duration)
  }

  /** Choque de pelota: el golpe más fuerte suena más grave y más fuerte. */
  ballHit(intensity: number): void {
    const t = Math.min(1, intensity / 12)
    this.noise(0.09 + t * 0.08, 0.1 + t * 0.28, 900 - t * 500)
    this.tone('sine', 260 - t * 140, 90, 0.1 + t * 0.1, 0.08 + t * 0.16)
  }

  wallHit(): void {
    this.noise(0.07, 0.08, 600)
  }

  pad(): void {
    this.tone('triangle', 620, 1240, 0.12, 0.16)
  }

  jump(): void {
    this.tone('sine', 300, 520, 0.11, 0.13)
  }

  dodge(): void {
    this.noise(0.12, 0.12, 500)
    this.tone('triangle', 420, 180, 0.14, 0.12)
  }

  land(): void {
    this.noise(0.09, 0.09, 320)
  }

  goal(): void {
    const notes = [392, 523.25, 659.25, 783.99]
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.3, 0.26, i * 0.075))
    // Rumor de tribuna: ruido largo y suave por debajo.
    this.noise(1.2, 0.12, 420)
  }

  /** Pitido de cuenta regresiva; en 0 suena el saque, más largo y agudo. */
  count(n: number): void {
    if (n > 0) {
      this.tone('square', 620, 620, 0.14, 0.16)
    } else {
      this.tone('square', 880, 1100, 0.34, 0.2)
      this.tone('sine', 1320, 1320, 0.3, 0.1)
    }
  }

  overtime(): void {
    this.tone('square', 520, 780, 0.2, 0.18)
    this.tone('square', 780, 1040, 0.3, 0.18, 0.18)
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.34, 0.26, i * 0.11))
  }

  lose(): void {
    const notes = [392, 329.63, 261.63]
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.4, 0.22, i * 0.15))
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
    this.engineOsc = null
    this.engineSub = null
    this.engineFilter = null
    this.engineGain = null
    this.boostGain = null
  }
}
