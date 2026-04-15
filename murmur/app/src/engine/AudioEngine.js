function ramp(audioEl, fromVol, toVol, durationMs) {
  return new Promise(resolve => {
    audioEl.volume = fromVol
    const steps = durationMs / 16
    const delta = (toVol - fromVol) / steps
    let n = 0
    const tick = () => {
      n++
      audioEl.volume = Math.min(1, Math.max(0, fromVol + delta * n))
      if (n < steps) requestAnimationFrame(tick)
      else { audioEl.volume = toVol; resolve() }
    }
    requestAnimationFrame(tick)
  })
}

class AudioEngine {
  constructor() {
    this.narrator = new Audio()
    this.narrator.preload = 'auto'
    this.ambientIntro = new Audio()
    this.ambientLoop = new Audio()
    this.ambientLoop.loop = true
    this.ambientVolume = 0.3
    this.choicesRevealed = false
    this._onReveal = null
    this._onEnd = null
    this._timeHandler = null
  }

  async playScene(scene, clipSrc, { onRevealChoices, onNarrationEnd, onPlayStarted }) {
    this.choicesRevealed = false
    this._tailFading = false
    this._onReveal = onRevealChoices
    this._onEnd = onNarrationEnd

    // Clean up previous timeupdate listener
    if (this._timeHandler) {
      this.narrator.removeEventListener('timeupdate', this._timeHandler)
    }

    // Fade out current narration
    if (!this.narrator.paused) {
      await ramp(this.narrator, this.narrator.volume, 0, 300)
      this.narrator.pause()
    }

    // Duck ambient
    this._duckAmbient()

    // Load and play new clip
    this.narrator.src = clipSrc
    this.narrator.volume = 0

    const endHandler = () => {
      this.narrator.removeEventListener('ended', endHandler)
      if (this._onEnd) this._onEnd()
      this._unduckAmbient()
    }
    this.narrator.addEventListener('ended', endHandler)

    // Timeupdate for choice reveal + tail fade
    const TAIL_FADE_SECS = 1.5
    this._timeHandler = () => {
      const remaining = this.narrator.duration - this.narrator.currentTime
      if (!isFinite(remaining)) return

      // Choice reveal
      if (!this.choicesRevealed && remaining <= (scene.secondsBeforeEnd || 0) && scene.secondsBeforeEnd > 0) {
        this.choicesRevealed = true
        if (this._onReveal) this._onReveal()
      }

      // Gentle fade-out near the end so the clip doesn't cut off abruptly
      if (!this._tailFading && remaining <= TAIL_FADE_SECS && remaining > 0) {
        this._tailFading = true
        ramp(this.narrator, this.narrator.volume, 0, remaining * 1000)
      }
    }
    this.narrator.addEventListener('timeupdate', this._timeHandler)

    try {
      await this.narrator.play()
      if (onPlayStarted) onPlayStarted()
      await ramp(this.narrator, 0, 1, 400)
    } catch {
      // Autoplay blocked — trigger end immediately
      if (this._onEnd) this._onEnd()
    }
  }

  async stop() {
    if (this._timeHandler) {
      this.narrator.removeEventListener('timeupdate', this._timeHandler)
      this._timeHandler = null
    }
    if (!this.narrator.paused) {
      await ramp(this.narrator, this.narrator.volume, 0, 300)
      this.narrator.pause()
    }
    this.narrator.onended = null
    this.stopAmbient()
  }

  // Ambient layer
  async startAmbient(ambient) {
    if (!ambient) return

    if (ambient.intro) {
      this.ambientIntro.src = ambient.intro
      this.ambientIntro.volume = this.ambientVolume
      this.ambientIntro.onended = () => {
        if (ambient.loop) {
          this.ambientLoop.src = ambient.loop
          this.ambientLoop.volume = 0
          this.ambientLoop.play().then(() => {
            ramp(this.ambientLoop, 0, this.ambientVolume, 800)
          }).catch(() => {})
        }
      }
      try { await this.ambientIntro.play() } catch {}
    } else if (ambient.loop) {
      this.ambientLoop.src = ambient.loop
      this.ambientLoop.volume = this.ambientVolume
      try { await this.ambientLoop.play() } catch {}
    }
  }

  async switchAmbient(ambient) {
    // Fade out current ambient
    if (!this.ambientLoop.paused) {
      await ramp(this.ambientLoop, this.ambientLoop.volume, 0, 600)
      this.ambientLoop.pause()
    }
    if (!this.ambientIntro.paused) {
      await ramp(this.ambientIntro, this.ambientIntro.volume, 0, 600)
      this.ambientIntro.pause()
    }
    if (ambient) {
      await this.startAmbient(ambient)
    }
  }

  stopAmbient() {
    this.ambientIntro.pause()
    this.ambientIntro.src = ''
    this.ambientLoop.pause()
    this.ambientLoop.src = ''
  }

  _duckAmbient() {
    if (!this.ambientLoop.paused) {
      ramp(this.ambientLoop, this.ambientLoop.volume, this.ambientVolume * 0.5, 400)
    }
  }

  _unduckAmbient() {
    if (!this.ambientLoop.paused) {
      ramp(this.ambientLoop, this.ambientLoop.volume, this.ambientVolume, 600)
    }
  }

  pause() {
    if (!this.narrator.paused) {
      this.narrator.pause()
    }
  }

  resume() {
    if (this.narrator.paused && this.narrator.src) {
      this.narrator.play().catch(() => {})
    }
  }

  seek(seconds) {
    if (!isFinite(seconds)) return
    const d = this.narrator.duration
    if (!isFinite(d) || d === 0) return
    this.narrator.currentTime = Math.max(0, Math.min(d, seconds))
    // Reset the tail-fade flag and restore narrator volume, since seeking
    // may move us out of (or back into) the tail-fade region
    this._tailFading = false
    this.narrator.volume = 1
    // If the user seeks past the choice-reveal threshold, don't miss it
    // (timeupdate will pick it up on the next fire)
  }

  get isPlaying() {
    return !this.narrator.paused
  }

  get currentTime() {
    return this.narrator.currentTime
  }

  get duration() {
    return this.narrator.duration
  }
}

export const audioEngine = new AudioEngine()
export default audioEngine
