// Web Audio tone generator. Lazy-inits AudioContext on first user
// gesture so iOS Safari accepts it. 600 Hz sine, 5 ms attack/decay.
const DEFAULT_FREQ = 600;
const RAMP_SECONDS = 0.005;
const PEAK_GAIN = 0.3;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.oscillator = null;
    this.gain = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stopTone();
  }

  startTone(freq = DEFAULT_FREQ) {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopTone();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + RAMP_SECONDS);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    this.oscillator = osc;
    this.gain = gain;
  }

  stopTone() {
    if (!this.ctx || !this.oscillator || !this.gain) return;
    const now = this.ctx.currentTime;
    const gain = this.gain;
    const osc = this.oscillator;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + RAMP_SECONDS);
    osc.stop(now + RAMP_SECONDS + 0.01);
    this.oscillator = null;
    this.gain = null;
  }
}

export const audioEngine = new AudioEngine();
