// Synthesised sound effects (WebAudio, no files to load). Each is a tiny
// recipe; to swap one for a recorded sample later, replace its function body
// with a buffer player — callers only use `sfx.name()`.

let ctx = null;
let master = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSoundEnabled(on) { enabled = on; }
// Browsers only allow audio after a gesture; call this from the first tap.
export function unlockAudio() { if (enabled) ac(); }

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function noiseBuffer(c) {
  const b = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let noise = null;

export const sfx = {
  // A bleat: buzzy saw with fast vibrato through two vowel formants.
  baa(pitch = 1) {
    const c = enabled && ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const f0 = (260 + Math.random() * 60) * pitch;
    o.frequency.setValueAtTime(f0 * 1.08, t);
    o.frequency.linearRampToValueAtTime(f0, t + 0.12);
    o.frequency.linearRampToValueAtTime(f0 * 0.9, t + 0.55);
    const lfo = c.createOscillator(); lfo.frequency.value = 22 + Math.random() * 6;
    const lg = c.createGain(); lg.gain.value = f0 * 0.05;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = c.createGain(); env(g, t, 0.05, 0.35, 0.55);
    const out = c.createGain(); out.gain.value = 0.9;
    for (const [f, q, v] of [[750, 6, 1], [1250, 8, 0.6], [2600, 10, 0.25]]) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * pitch; bp.Q.value = q;
      const bg = c.createGain(); bg.gain.value = v;
      o.connect(bp); bp.connect(bg); bg.connect(g);
    }
    g.connect(out); out.connect(master);
    o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
  },
  // Wool bursting off: a filtered noise puff.
  poof() {
    const c = enabled && ac(); if (!c) return;
    noise = noise || noiseBuffer(c);
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    const g = c.createGain(); env(g, t, 0.01, 0.6, 0.32);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + 0.4);
  },
  // Caught! A short rising "a-woo".
  howl() {
    const c = enabled && ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.25);
    o.frequency.linearRampToValueAtTime(560, t + 0.7);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.95);
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
    const lg = c.createGain(); lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
    const g = c.createGain(); env(g, t, 0.12, 0.28, 0.85);
    o.connect(g); g.connect(master);
    o.start(t); lfo.start(t); o.stop(t + 1.05); lfo.stop(t + 1.05);
  },
  // Pelt collected: two bright blips.
  coin() {
    const c = enabled && ac(); if (!c) return;
    const t = c.currentTime;
    [[880, 0], [1320, 0.08]].forEach(([f, d]) => {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = c.createGain(); env(g, t + d, 0.005, 0.12, 0.16);
      o.connect(g); g.connect(master); o.start(t + d); o.stop(t + d + 0.2);
    });
  },
  // Wrong sheep: a deflating "bwomp".
  wrong() {
    const c = enabled && ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.4);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); env(g, t, 0.01, 0.25, 0.42);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45);
  },
  tap() {
    const c = enabled && ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    const g = c.createGain(); env(g, t, 0.004, 0.18, 0.08);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
  },
  pop() {
    const c = enabled && ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(300 + Math.random() * 200, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
    const g = c.createGain(); env(g, t, 0.004, 0.12, 0.07);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.09);
  },
};
