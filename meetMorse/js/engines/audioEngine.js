import { LETTER_TO_CODE } from '../data/morseTree.js';

const DEFAULT_FREQ = 600;
const RAMP_SECONDS = 0.005;
const PEAK_GAIN = 0.3;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.oscillator = null;
    this.gain = null;
    this.scheduledNotes = [];   // sequenced playback (listening mode)
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

  // -- live press tone (used by the telegraph key) ---------------------

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
    // Cancel any in-flight live tone
    if (this.ctx && this.oscillator && this.gain) {
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
    // Cancel any sequenced playback notes that haven't started yet
    if (this.ctx && this.scheduledNotes.length) {
      const now = this.ctx.currentTime;
      for (const { osc, gain } of this.scheduledNotes) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          osc.stop(now + 0.02);
        } catch (_) {
          // already stopped
        }
      }
      this.scheduledNotes.length = 0;
    }
  }

  // -- sequenced playback (listening mode) -----------------------------

  // ditMs = 100 → 12 WPM. dah = 3 dits, inter-element gap = 1 dit,
  // inter-letter gap = 3 dits, inter-word gap = 7 dits (PARIS).
  // Returns a Promise that resolves when the audio is done.
  async playCode(code, ditMs = 100) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) { /* noop */ }
    }
    this.stopTone();
    const ditSec = ditMs / 1000;
    let cursor = this.ctx.currentTime + 0.05;
    for (let i = 0; i < code.length; i++) {
      const dur = code[i] === '.' ? ditSec : 3 * ditSec;
      this._scheduleNote(cursor, dur);
      cursor += dur;
      if (i < code.length - 1) cursor += ditSec; // inter-element gap
    }
    await this._waitUntil(cursor);
  }

  async playWord(word, ditMs = 100) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) { /* noop */ }
    }
    this.stopTone();
    const ditSec = ditMs / 1000;
    let cursor = this.ctx.currentTime + 0.05;
    for (let li = 0; li < word.length; li++) {
      const code = LETTER_TO_CODE[word[li]];
      if (!code) continue;
      for (let si = 0; si < code.length; si++) {
        const dur = code[si] === '.' ? ditSec : 3 * ditSec;
        this._scheduleNote(cursor, dur);
        cursor += dur;
        if (si < code.length - 1) cursor += ditSec;
      }
      if (li < word.length - 1) cursor += 3 * ditSec; // inter-letter gap
    }
    await this._waitUntil(cursor);
  }

  _scheduleNote(when, durationSec) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = DEFAULT_FREQ;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, when + RAMP_SECONDS);
    gain.gain.setValueAtTime(PEAK_GAIN, when + durationSec - RAMP_SECONDS);
    gain.gain.linearRampToValueAtTime(0, when + durationSec);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + durationSec + 0.02);
    const entry = { osc, gain };
    this.scheduledNotes.push(entry);
    osc.onended = () => {
      const idx = this.scheduledNotes.indexOf(entry);
      if (idx !== -1) this.scheduledNotes.splice(idx, 1);
    };
  }

  _waitUntil(audioCtxTime) {
    if (!this.ctx) return Promise.resolve();
    const ms = Math.max(0, (audioCtxTime - this.ctx.currentTime) * 1000);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const audioEngine = new AudioEngine();
