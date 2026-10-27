/**
 * Sonido sintetizado con WebAudio: sin archivos que cargar ni dependencias.
 *
 * El contexto se crea perezosamente en el primer gesto del usuario, porque los
 * navegadores bloquean el audio antes de eso. El agua de la bañera y el
 * ronroneo son fuentes continuas cuyo volumen se modula por frame; el resto son
 * one-shots.
 */
export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private waterGain: GainNode | null = null
  private purrGain: GainNode | null = null
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
    this.master.gain.value = this.muted ? 0 : 0.34
    this.master.connect(ctx.destination)

    const length = ctx.sampleRate * 2
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1

    this.waterGain = this.loop('bandpass', 1500, 0.8)
    this.purrGain = this.loop('lowpass', 220, 0.9)
  }

  /**
   * Fuente continua de ruido filtrado que arranca en volumen 0. El filtro es lo
   * que la vuelve reconocible: pasa-banda agudo suena a agua, pasa-bajos grave
   * suena a ronroneo.
   */
  private loop(type: BiquadFilterType, frequency: number, q: number): GainNode | null {
    if (!this.ctx || !this.master || !this.noiseBuffer) return null
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.value = 0
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    return gain
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.34
  }

  private setLoop(gain: GainNode | null, value: number): void {
    if (!this.ctx || !gain) return
    gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.08)
  }

  /** Agua corriendo mientras el gato se baña. */
  setWater(on: boolean): void {
    this.setLoop(this.waterGain, on ? 0.05 : 0)
  }

  /** Ronroneo, para dormir y jugar. */
  setPurr(on: boolean): void {
    this.setLoop(this.purrGain, on ? 0.12 : 0)
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

  private noise(duration: number, gain: number, filterHz: number, q = 1.1, delay = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t0 = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterHz
    filter.Q.value = q
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(gain, t0)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    src.start(t0)
    src.stop(t0 + duration)
  }

  /** Maullido: sube y baja, con un armónico que le da el timbre nasal. */
  meow(happy = true): void {
    if (happy) {
      this.tone('sawtooth', 480, 780, 0.14, 0.1)
      this.tone('sawtooth', 780, 360, 0.3, 0.1, 0.1)
      this.tone('sine', 1560, 900, 0.18, 0.04, 0.08)
    } else {
      this.tone('sawtooth', 520, 300, 0.22, 0.09)
      this.tone('sawtooth', 300, 190, 0.36, 0.09, 0.18)
    }
  }

  /** Bocados: ruido corto y seco, se llama repetido mientras come. */
  crunch(): void {
    this.noise(0.07, 0.16, 2200, 0.7)
    this.tone('square', 120, 70, 0.05, 0.04)
  }

  splash(): void {
    this.noise(0.3, 0.14, 1100, 0.9)
  }

  /** Raspar del arenero. */
  scratch(): void {
    this.noise(0.24, 0.11, 3400, 1.4)
  }

  /** Aplauso chico de logro: arpegio corto. */
  chime(): void {
    const notes = [659.25, 830.61, 987.77]
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.22, 0.14, i * 0.06))
  }

  /** Pasos: un golpecito grave y seco. */
  step(): void {
    this.noise(0.05, 0.05, 700, 0.8)
  }

  land(): void {
    this.noise(0.09, 0.09, 420, 0.9)
  }

  /** Aviso de necesidad crítica: dos pitidos. */
  alarm(): void {
    this.tone('square', 700, 700, 0.09, 0.09)
    this.tone('square', 700, 700, 0.09, 0.09, 0.14)
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
    this.waterGain = null
    this.purrGain = null
  }
}
