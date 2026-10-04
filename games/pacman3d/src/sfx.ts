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
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.3
    this.master.connect(this.ctx.destination)

    const length = this.ctx.sampleRate * 2
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.3
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
    env.gain.linearRampToValueAtTime(gain, t0 + 0.008)
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

  /**
   * El "waka-waka".
   *
   * Es un pitido corto alternando dos tonos, y el pitch sube con el streak de
   * puntos: es el sonido que más se recuerda del original. Se limita con
   * `chompCooldown` porque al comer rápido se solaparían y saturaría el master.
   */
  private lastChomp = -1
  private chompFlip = false
  chompCooldown = 0

  chomp(streak: number): void {
    const now = this.ctx?.currentTime ?? 0
    if (now - this.lastChomp < this.chompCooldown) return
    this.lastChomp = now
    this.chompFlip = !this.chompFlip
    // El pitch sube por pasos de 50 puntos, como el original.
    const step = Math.min(8, Math.floor(streak / 50))
    const base = (this.chompFlip ? 480 : 380) * Math.pow(1.06, step)
    this.tone('square', base, base * 0.72, 0.055, 0.16)
  }

  /** Punto de poder: acorde ascendente más brillante. */
  powerPellet(): void {
    this.tone('square', 300, 600, 0.1, 0.2)
    this.tone('square', 450, 900, 0.12, 0.16, 0.08)
    this.tone('square', 600, 1200, 0.16, 0.12, 0.16)
  }

  /** Fantasma comido: arpegio ascendente, más agudo con más puntos. */
  eatGhost(value: number): void {
    const base = 320 + Math.min(700, value * 2)
    for (let i = 0; i < 4; i++) {
      this.tone('square', base * (1 + i * 0.28), base * (1 + i * 0.28), 0.06, 0.14, i * 0.05)
    }
  }

  /** Morir: el pitch cae y se apaga. */
  death(): void {
    this.tone('sawtooth', 620, 90, 0.85, 0.26)
    this.tone('square', 400, 60, 0.9, 0.14, 0.1)
    this.noise(0.5, 0.16, 220)
  }

  /** Nivel superado: fanfarria mayor. */
  levelClear(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]
    notes.forEach((n, i) => this.tone('square', n, n, 0.18, 0.2, i * 0.11))
  }

  /** Fin de la partida. */
  gameOver(): void {
    const notes = [392, 349.23, 293.66, 196]
    notes.forEach((n, i) => this.tone('sawtooth', n, n * 0.96, 0.4, 0.22, i * 0.22))
  }

  /** Vida extra. */
  extraLife(): void {
    const notes = [784, 1046.5, 1318.5]
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.16, 0.24, i * 0.08))
  }

  /** Aparece el listo. */
  ready(): void {
    this.tone('square', 520, 520, 0.1, 0.16)
    this.tone('square', 780, 780, 0.16, 0.16, 0.12)
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
  }
}