/**
 * AudioEngine — all game sounds generated with the Web Audio API.
 * AudioContext is created lazily on the first play*() call so that
 * it respects browser autoplay policies (must be triggered by user gesture).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  muted: boolean = false

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    // Resume if suspended (autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  /** Toggle mute. Returns new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  /** Short sine-wave beep for a hop. 80ms, 440Hz. */
  playHop(): void {
    if (this.muted) return
    const ctx = this.getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
  }

  /** Noise burst splash for water death. 200ms. */
  playSplashDeath(): void {
    if (this.muted) return
    const ctx = this.getCtx()
    const bufferSize = Math.floor(ctx.sampleRate * 0.2)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime)
  }

  /** Low thump for vehicle squish death. 100ms, 80Hz. */
  playSquishDeath(): void {
    if (this.muted) return
    const ctx = this.getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(80, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
  }

  /** Ascending C-E-G chime for home fill. */
  playHomeFill(): void {
    if (this.muted) return
    const ctx = this.getCtx()
    const notes = [261, 329, 392]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.1
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.0, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc.start(t)
      osc.stop(t + 0.15)
    })
  }

  /** Ascending 5-note fanfare for level clear. */
  playLevelClear(): void {
    if (this.muted) return
    const ctx = this.getCtx()
    const notes = [261, 329, 392, 523, 659]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'triangle'
      const t = ctx.currentTime + i * 0.09
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.start(t)
      osc.stop(t + 0.2)
    })
  }

  destroy(): void {
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
  }
}
