// Procedural sound synthesis for Not All Will Survive. Pure Web Audio, no samples.
// Every function works on any BaseAudioContext (live or Offline), so the offline test
// page (tools/audio-test.html) renders exactly what the game plays.
//
// One-shots: fn(ctx, B, out, t, opts) -> duration in seconds. They build a short-lived
// node graph whose sources stop themselves; `out` is the node to feed.
// B is the shared buffer bank from makeBuffers().

// Bus levels (pre-master). Tuned with tools/audio-test.html: wind bed moderate,
// steps quiet, creatures distant, space nearly anechoic.
export const MIX = {
  wind: 0.8,
  steps: 0.6,
  breath: 0.22,
  creatures: 0.5,
  ice: 0.5,
  avalanche: 1.4,
  reverb: 0.2,
  iceSend: 0.4,
};

const R = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dbToGain = d => Math.pow(10, d / 20);

// Smooth, non-repeating wander in [-1, 1] (incommensurate sines).
export function wander(x) {
  return (Math.sin(x) + 0.6 * Math.sin(x * 2.137 + 1.3) + 0.8 * Math.sin(x * 0.463 + 4.1)
    + 0.4 * Math.sin(x * 3.71 + 2.2)) / 2.8;
}

// ---------------------------------------------------------------- buffers
function prng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; };
}

function fillNoise(data, kind, rnd) {
  const n = data.length;
  if (kind === 'white') for (let i = 0; i < n; i++) data[i] = rnd();
  else if (kind === 'pink') { // Paul Kellet's refined filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd();
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    }
  } else { // brown: leaky integrator with its corner around 35 Hz (little subsonic energy)
    let v = 0;
    for (let i = 0; i < n; i++) { v = (v + 0.05 * rnd()) * 0.995; data[i] = v; }
  }
  // remove DC, normalise to RMS 0.2, crossfade the loop seam
  let m = 0; for (let i = 0; i < n; i++) m += data[i]; m /= n;
  let e = 0; for (let i = 0; i < n; i++) { data[i] -= m; e += data[i] * data[i]; }
  const k = 0.2 / Math.sqrt(e / n);
  for (let i = 0; i < n; i++) data[i] *= k;
  const fade = Math.min(4096, n >> 3);
  for (let i = 0; i < fade; i++) { const a = i / fade; data[i] = data[i] * a + data[n - fade + i] * (1 - a); }
  return n - fade; // the tail now lives at the start: loop on [0, n - fade)
}

function noiseBuffer(ctx, kind, seconds, channels, seed) {
  const len = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(channels, len, ctx.sampleRate);
  let loopLen = len;
  for (let c = 0; c < channels; c++) loopLen = fillNoise(buf.getChannelData(c), kind, prng(seed + c * 7919));
  buf._loopEnd = loopLen / ctx.sampleRate;
  return buf;
}

// Spindrift grit: a positive train of tiny random grains at 20-60 per second, used to
// amplitude-modulate the hiss so it sounds like blown ice crystals, not a fan.
function gritBuffer(ctx, seconds, seed) {
  const sr = ctx.sampleRate, len = Math.round(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), rnd = prng(seed);
  let pos = 0;
  while (pos < len) {
    const a = 0.3 + 0.35 * (rnd() + 1), L = sr * (0.003 + 0.0045 * (rnd() + 1));
    for (let i = 0; i < L * 4 && pos + i < len; i++) d[pos + i] += a * Math.exp(-i / L);
    pos += Math.round(sr / (40 + 20 * rnd()));
  }
  return finishPulses(buf);
}

// normalise a positive pulse train and crossfade its loop seam
function finishPulses(buf) {
  const d = buf.getChannelData(0), len = d.length;
  let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, d[i]);
  for (let i = 0; i < len; i++) d[i] /= mx;
  const fade = Math.min(4096, len >> 3);
  for (let i = 0; i < fade; i++) { const a = i / fade; d[i] = d[i] * a + d[len - fade + i] * (1 - a); }
  buf._loopEnd = (len - fade) / buf.sampleRate;
  return buf;
}

// Hood flap control: rectified, snapping pulses ~7 per second at playbackRate 1
// (fast 4 ms rise, 10-25 ms decay, random spacing and strength).
function flapBuffer(ctx, seconds, seed) {
  const sr = ctx.sampleRate, len = Math.round(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), rnd = prng(seed);
  let pos = 0;
  while (pos < len) {
    const a = 0.35 + 0.325 * (rnd() + 1), up = sr * 0.004, L = sr * (0.01 + 0.0075 * (rnd() + 1));
    for (let i = 0; i < up + L * 4 && pos + i < len; i++) d[pos + i] = Math.max(d[pos + i], a * (i < up ? i / up : Math.exp(-(i - up) / L)));
    pos += Math.round(sr / (7 * (1 + 0.45 * rnd())));
  }
  return finishPulses(buf);
}

// Short, dark impulse response: snowfields are nearly anechoic; this is only air.
function impulse(ctx, seconds) {
  const len = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c), rnd = prng(99 + c * 31);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const env = Math.min(1, i / (ctx.sampleRate * 0.02)) * Math.pow(1 - x, 2) * Math.exp(-x * 4);
      lp += (0.15 + 0.5 * (1 - x)) * (rnd() - lp);
      d[i] = lp * env * 0.4;
    }
  }
  return buf;
}

export function makeBuffers(ctx) {
  return {
    white: noiseBuffer(ctx, 'white', 5.3, 2, 11),
    pink: noiseBuffer(ctx, 'pink', 7.1, 2, 23),
    brown: noiseBuffer(ctx, 'brown', 9.7, 2, 37),
    whiteM: noiseBuffer(ctx, 'white', 2.3, 1, 41),
    pinkM: noiseBuffer(ctx, 'pink', 6.7, 1, 53),
    whistle: [4.1, 4.7, 5.3].map((s, i) => noiseBuffer(ctx, 'pink', s, 1, 101 + i * 13)),
    grit: gritBuffer(ctx, 3.7, 77),
    flap: flapBuffer(ctx, 4.3, 91),
    ir: impulse(ctx, 1.6),
  };
}

// ---------------------------------------------------------------- node helpers
function src(ctx, buf, t, dur, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = buf; s.loop = true;
  if (buf._loopEnd) s.loopEnd = buf._loopEnd;
  s.playbackRate.value = rate;
  s.start(t, Math.random() * (buf._loopEnd || buf.duration) * 0.9);
  if (dur !== Infinity) s.stop(t + dur + 0.05);
  return s;
}
function filt(ctx, type, f, q = 0.707, g = 0) {
  const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g; return b;
}
function gain(ctx, v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[0]; }
function osc(ctx, type, f, t, dur) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
  o.start(t); if (dur !== Infinity) o.stop(t + dur + 0.05); return o;
}
function pan(ctx, p) {
  if (ctx.createStereoPanner) { const s = ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); return s; }
  return gain(ctx, 1);
}
// percussive envelope: linear attack then exponential decay to ~silence by t+dur
function perc(param, t, peak, att, dur) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + att);
  param.setTargetAtTime(0, t + att, Math.max(0.002, (dur - att) / 4.5));
}
// a burst of filtered noise (replaces every tonal "kick")
function noiseBurst(ctx, B, out, t, type, f, q, peak, att, dur) {
  const s = src(ctx, B.whiteM, t, dur + att), fl = filt(ctx, type, f, q), g = gain(ctx);
  chain(s, fl, g, out); perc(g.gain, t, peak, att, dur);
}
let softClip = null;
function shaper(ctx) {
  const w = ctx.createWaveShaper();
  if (!softClip) { softClip = new Float32Array(1024); for (let i = 0; i < 1024; i++) softClip[i] = Math.tanh((i / 511.5 - 1) * 2.5); }
  w.curve = softClip; return w;
}

// Grain envelope as an AudioParam curve: n tiny decaying clicks inside a compressive
// bulk envelope — snow crystals breaking under a boot.
function grainCurve(dur, n, maxLen, peak, bias = 1.4) {
  const N = Math.max(16, Math.round(dur * 1000));
  const c = new Float32Array(N);
  for (let g = 0; g < n; g++) {
    const pos = Math.floor(Math.pow(Math.random(), bias) * N * 0.9);
    const a = R(0.25, 1), len = R(0.8, maxLen);
    for (let i = 0; i < len * 4 && pos + i < N; i++) c[pos + i] += a * Math.exp(-i / len);
  }
  let mx = 1e-6;
  for (let i = 0; i < N; i++) { const x = i / N; c[i] *= Math.min(1, x * 25) * Math.pow(1 - x, 1.3); mx = Math.max(mx, c[i]); }
  for (let i = 0; i < N; i++) c[i] *= peak / mx;
  c[N - 1] = 0;
  return c;
}

// ---------------------------------------------------------------- footsteps
export function footstep(ctx, B, out, t, o = {}) {
  const terrain = o.terrain || 'snow', w = clamp(o.weight ?? 0.5, 0, 1), cold = o.cold ?? 0.8;
  const p = pan(ctx, (o.foot === 'L' ? -1 : 1) * R(0.06, 0.16));
  p.connect(out);
  const lvl = 0.75 + w * 0.5;
  switch (terrain) {
    case 'deep': return deepStep(ctx, B, p, t, lvl * 2.6);
    case 'ice': return iceStep(ctx, B, p, t, lvl * 1.78, false);
    case 'thin': return iceStep(ctx, B, p, t, lvl * 1.78, true);
    case 'rock': return rockStep(ctx, B, p, t, lvl * 2.5);
    case 'path': return heelToe(ctx, B, p, t, lvl, cold, 0.75, R(2600, 4200), R(900, 1300), 0.4, 0.15);
    default: return heelToe(ctx, B, p, t, lvl * 1.4, cold, 1, R(1700, 3300), R(450, 850), 0.55, 0.4);
  }
}

// Heel, then toe 40-70 ms later; 40+ grains in all, an occasional cold squeak.
function heelToe(ctx, B, out, t, lvl, cold, len, gf, lf, body, squeakP) {
  const gap = R(0.04, 0.07);
  const d1 = crunch(ctx, B, out, t, lvl, R(0.09, 0.14) * len, gf, lf, body, (R(26, 36)) | 0);
  const d2 = crunch(ctx, B, out, t + gap, lvl * R(0.55, 0.8), R(0.07, 0.11) * len, gf * 1.15, lf * 1.2, body * 0.6, (R(16, 26)) | 0);
  let dur = Math.max(d1, gap + d2);
  if (Math.random() < squeakP * cold) dur = Math.max(dur, squeak(ctx, B, out, t + R(0.02, gap + 0.03), lvl));
  return dur + 0.05;
}

function crunch(ctx, B, out, t, lvl, dur, gf, lf, bodyAmt, grains) {
  const s = src(ctx, B.whiteM, t, dur, R(0.85, 1.15));
  const body = filt(ctx, 'lowpass', lf, 0.9), bg = gain(ctx);
  const grain = filt(ctx, 'bandpass', gf, R(0.7, 1.3)), gg = gain(ctx);
  s.connect(body); chain(body, bg, out);
  s.connect(grain); chain(grain, gg, out);
  perc(bg.gain, t, bodyAmt * lvl, 0.01, dur);
  gg.gain.setValueCurveAtTime(grainCurve(dur, grains, 5, lvl), t, dur);
  return dur;
}

// Very cold snow squeak: a 180-320 Hz pulse train through a 1.2-2.5 kHz band, plus noise.
function squeak(ctx, B, out, t, lvl) {
  const d = R(0.06, 0.11), f = R(180, 320), bf = R(1200, 2500);
  const o = osc(ctx, 'sawtooth', f, t, d), bp = filt(ctx, 'bandpass', bf, R(3, 6)), g = gain(ctx);
  o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * R(1.1, 1.45), t + d);
  const n = src(ctx, B.whiteM, t, d), ng = gain(ctx, 0.5);
  o.connect(bp); chain(n, ng, bp); chain(bp, g, out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * lvl, t + d * 0.3);
  g.gain.linearRampToValueAtTime(0.12 * lvl, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
  return d;
}

function deepStep(ctx, B, out, t, lvl) {
  const dur = R(0.28, 0.42);
  const s = src(ctx, B.whiteM, t, dur, R(0.8, 1.1));
  const body = filt(ctx, 'lowpass', R(320, 520), 0.8), bg = gain(ctx);
  const grain = filt(ctx, 'bandpass', R(900, 1500), 0.9), gg = gain(ctx);
  s.connect(body); chain(body, bg, out);
  s.connect(grain); chain(grain, gg, out);
  perc(bg.gain, t, 1.1 * lvl, 0.035, dur);
  gg.gain.setValueCurveAtTime(grainCurve(dur, (R(14, 24)) | 0, 9, 0.45 * lvl, 2), t, dur);
  // the plunge: a soft, low, compressive whump (noise, not a tone)
  noiseBurst(ctx, B, out, t, 'lowpass', R(150, 250), 1, 2.2 * lvl, 0.015, 0.16);
  // the drag: boot pulled through snow
  const dt = t + R(0.16, 0.26), dd = R(0.25, 0.4);
  const d = src(ctx, B.whiteM, dt, dd), df = filt(ctx, 'bandpass', 800, 1.1), dg = gain(ctx);
  df.frequency.setValueAtTime(R(800, 1100), dt); df.frequency.exponentialRampToValueAtTime(R(350, 500), dt + dd);
  chain(d, df, dg, out);
  dg.gain.setValueAtTime(0, dt); dg.gain.linearRampToValueAtTime(0.22 * lvl, dt + dd * 0.4);
  dg.gain.linearRampToValueAtTime(0, dt + dd);
  return dt - t + dd + 0.1;
}

function iceStep(ctx, B, out, t, lvl, thin) {
  noiseBurst(ctx, B, out, t, 'highpass', R(1300, 2200), 0.8, 0.4 * lvl, 0.002, 0.03); // hard tap
  noiseBurst(ctx, B, out, t, 'lowpass', R(500, 750), 1.2, 0.9 * lvl, 0.002, 0.04);    // heel knock
  let dur = 0.12;
  if (thin && Math.random() < 0.15) { // rare faint ring on thin ice only
    const base = R(1700, 2700), rd = R(0.15, 0.3);
    [[1, 0.04], [1.47, 0.025]].forEach(([m, a]) => {
      const o = osc(ctx, 'sine', base * m, t, rd), g = gain(ctx);
      chain(o, g, out); perc(g.gain, t, a * lvl, 0.001, rd);
    });
    dur = rd;
  }
  if (Math.random() < 0.35) { // boot scrape
    const st = t + R(0.01, 0.04), sd = R(0.06, 0.12);
    const n = src(ctx, B.whiteM, st, sd), bp = filt(ctx, 'bandpass', R(2000, 3200), 2), sg = gain(ctx);
    chain(n, bp, sg, out);
    sg.gain.setValueAtTime(0, st); sg.gain.linearRampToValueAtTime(0.14 * lvl, st + sd * 0.3); sg.gain.linearRampToValueAtTime(0, st + sd);
    dur = Math.max(dur, sd + 0.04);
  }
  if (thin && Math.random() < 0.3) dur = Math.max(dur, 0.05 + creak(ctx, out, t + R(0.05, 0.15), 0.8 * lvl));
  return dur + 0.1;
}

// Thin ice creak: a slow, irregular pulse train ringing through a resonant band.
export function creak(ctx, out, t, lvl = 1) {
  const d = R(0.3, 0.7), f = R(16, 34);
  const o = osc(ctx, 'square', f, t, d), bp = filt(ctx, 'bandpass', R(380, 900), R(4, 7)), g = gain(ctx);
  o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * R(0.5, 1.7), t + d);
  chain(o, bp, g, out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3 * lvl, t + d * 0.25);
  g.gain.linearRampToValueAtTime(0.2 * lvl, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
  return d;
}

// Rock: gravel scuff + a leather sole scrape, no tonal kick.
function rockStep(ctx, B, out, t, lvl) {
  noiseBurst(ctx, B, out, t, 'lowpass', R(350, 500), 1, 0.5 * lvl, 0.002, 0.03);
  const gd = R(0.08, 0.14), gr = src(ctx, B.whiteM, t, gd), bp = filt(ctx, 'bandpass', R(2000, 4000), 0.8), gg = gain(ctx);
  chain(gr, bp, gg, out);
  gg.gain.setValueCurveAtTime(grainCurve(gd, (R(12, 20)) | 0, 2.5, 0.55 * lvl, 1.2), t + 0.003, gd);
  const st = t + R(0.01, 0.03), sd = R(0.08, 0.15);
  const sc = src(ctx, B.whiteM, st, sd), sb = filt(ctx, 'bandpass', R(600, 1000), 2), sg = gain(ctx);
  sb.frequency.linearRampToValueAtTime(R(500, 800), st + sd);
  chain(sc, sb, sg, out);
  sg.gain.setValueAtTime(0, st); sg.gain.linearRampToValueAtTime(0.28 * lvl, st + sd * 0.4); sg.gain.linearRampToValueAtTime(0, st + sd);
  return Math.max(gd, sd + 0.03) + 0.05;
}

// ---------------------------------------------------------------- ice
// The frozen-lake sound: a sharp crack, dispersive "pew" chirps falling in pitch as they
// race away under the ice, and a deep resonant boom.
export function crack(ctx, B, out, t, o = {}) {
  const s = clamp(o.strength ?? 0.6, 0, 1), p0 = o.pan ?? 0;
  noiseBurst(ctx, B, out, t, 'highpass', 900, 0.7, 0.9 * (0.5 + s * 0.5), 0.001, 0.025);
  noiseBurst(ctx, B, out, t + R(0.01, 0.03), 'highpass', 1200, 0.7, 0.45 * s, 0.001, 0.02);
  noiseBurst(ctx, B, out, t, 'lowpass', 160, 1.5, 1.6 * s, 0.004, 0.2);
  const n = 2 + Math.round(s * 3 + Math.random());
  let end = 0.4;
  for (let i = 0; i < n; i++) end = Math.max(end, pew(ctx, B, out, t + 0.01 + i * R(0.04, 0.17), 0.24 * Math.pow(0.72, i) * (0.6 + 0.4 * s), p0, R(-0.7, 0.7)) + i * 0.1);
  if (s > 0.45 || Math.random() < 0.4) end = Math.max(end, 0.2 + groan(ctx, B, out, t + R(0.1, 0.3), 0.6 * s + 0.3));
  return end + 0.2;
}

// One dispersive chirp: a sine and a band of noise sweeping 2-4 kHz down to 400-900 Hz.
export function pew(ctx, B, out, t, a, p0 = 0, p1 = 0) {
  const d = R(0.35, 0.9), f0 = R(2200, 4200), f1 = R(400, 900);
  const o = osc(ctx, 'sine', f0, t, d);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  const n = src(ctx, B.whiteM, t, d), bp = filt(ctx, 'bandpass', f0, R(6, 10)), ng = gain(ctx, 5);
  bp.frequency.setValueAtTime(f0 * 1.05, t); bp.frequency.exponentialRampToValueAtTime(f1 * 1.05, t + d);
  const g = gain(ctx), pn = pan(ctx, p0);
  if (pn.pan) { pn.pan.setValueAtTime(p0, t); pn.pan.linearRampToValueAtTime(clamp(p1, -1, 1), t + d); }
  o.connect(g); chain(n, bp, ng, g); chain(g, pn, out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.004);
  g.gain.setTargetAtTime(a * 0.5, t + 0.004, d * 0.15);
  g.gain.linearRampToValueAtTime(0, t + d);
  return d;
}

// Lake ice boom: a 30-80 Hz noise burst through resonant lowpasses, long decay.
export function groan(ctx, B, out, t, a = 0.5) {
  const d = R(2, 4), f = R(30, 80);
  const s = src(ctx, B.pinkM, t, d);
  const l1 = filt(ctx, 'lowpass', f * 1.3, R(8, 14)), l2 = filt(ctx, 'lowpass', f * 1.4, 4);
  for (const l of [l1, l2]) { l.frequency.setValueAtTime(l.frequency.value, t); l.frequency.exponentialRampToValueAtTime(f * 0.85, t + d); }
  const hb = filt(ctx, 'bandpass', f * 3, 5), hg = gain(ctx, 0.5); // a little upper body for small speakers
  const g = gain(ctx), hp = filt(ctx, 'highpass', 22, 0.7);
  chain(s, l1, l2, g); chain(l1, hb, hg, g); chain(g, hp, out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6 * a, t + 0.04);
  g.gain.setTargetAtTime(0, t + 0.04, d / 4);
  return d;
}

// Distant, spontaneous lake ice: a boom with one or two faint pews.
export function distantIce(ctx, B, out, t, o = {}) {
  let d = groan(ctx, B, out, t, R(0.6, 1));
  const n = (Math.random() * 3) | 0;
  for (let i = 0; i < n; i++) d = Math.max(d, R(0.2, 0.8) + pew(ctx, B, out, t + R(0.2, 0.8), R(0.08, 0.16), o.pan ?? 0, R(-0.9, 0.9)));
  return d + 0.2;
}

// ---------------------------------------------------------------- breath
export function breath(ctx, B, out, t, o = {}) {
  const inh = !!o.inhale, len = o.len ?? 1, lvl = o.level ?? 0.5;
  const s = src(ctx, B.pinkM, t, len);
  const f = inh ? R(1400, 2000) : R(900, 1300);
  const bp = filt(ctx, 'bandpass', f, inh ? 1.4 : 0.9);
  bp.frequency.setValueAtTime(f, t);
  bp.frequency.linearRampToValueAtTime(f * (inh ? R(1.15, 1.35) : R(0.65, 0.8)), t + len);
  const hp = filt(ctx, 'highpass', 280), g = gain(ctx);
  if (o.shaky) { // cold, frightened tremble
    const tr = gain(ctx, 1 - 0.4 * o.shaky), lfo = osc(ctx, 'sine', R(6, 10), t, len), lg = gain(ctx, 0.4 * o.shaky);
    chain(lfo, lg); lg.connect(tr.gain);
    chain(s, hp, bp, tr, g, out);
  } else chain(s, hp, bp, g, out);
  if (o.rasp) {
    // blown: a rough, lower layer in the throat under the air (rasp 0..1)
    const r = src(ctx, B.pinkM, t, len), rb = filt(ctx, 'bandpass', inh ? R(520, 700) : R(380, 520), 2.2), rg = gain(ctx);
    const am = osc(ctx, 'square', R(28, 42), t, len), ag = gain(ctx, 0.5);
    const rt = gain(ctx, 0.5); chain(am, ag); ag.connect(rt.gain);
    chain(r, rb, rt, rg, out);
    rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(lvl * 0.55 * o.rasp, t + len * 0.3);
    rg.gain.linearRampToValueAtTime(0, t + len);
  }
  const att = len * (inh ? 0.5 : 0.25);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl * (inh ? 0.7 : 1), t + att);
  g.gain.linearRampToValueAtTime(0, t + len);
  return len + 0.05;
}

// ---------------------------------------------------------------- creatures
function formants(ctx, input, out, list) {
  for (const [f, q, a] of list) { const b = filt(ctx, 'bandpass', f, q), g = gain(ctx, a); chain(input, b, g, out); }
}

export function bark(ctx, B, out, t, o = {}) {
  const n = o.n ?? (1 + ((Math.random() * 3) | 0));
  let at = t;
  for (let i = 0; i < n; i++) {
    const d = R(0.11, 0.18), f0 = R(360, 520);
    const v = osc(ctx, 'sawtooth', f0, at, d), env = gain(ctx);
    v.frequency.setValueAtTime(f0 * 0.85, at); v.frequency.linearRampToValueAtTime(f0 * 1.15, at + 0.03);
    v.frequency.exponentialRampToValueAtTime(f0 * 0.65, at + d);
    formants(ctx, v, env, [[R(600, 850), 3, 1], [R(1300, 1800), 4, 0.6], [R(2600, 3200), 6, 0.25]]);
    const ns = src(ctx, B.whiteM, at, d), nb = filt(ctx, 'bandpass', 1100, 1), ng = gain(ctx, 0.25);
    chain(ns, nb, ng, env);
    env.connect(out); perc(env.gain, at, 0.7, 0.006, d);
    at += d + R(0.12, 0.3);
  }
  return at - t + 0.1;
}

function howlVoice(ctx, B, out, t, f, d, a, p) {
  const s = osc(ctx, 'sine', f, t, d), z = osc(ctx, 'sawtooth', f, t, d);
  const vib = osc(ctx, 'sine', R(4.5, 6), t, d), vg = gain(ctx, f * 0.016);
  const wav = osc(ctx, 'sine', R(0.4, 0.9), t, d), wg = gain(ctx, f * 0.025);
  vib.connect(vg); wav.connect(wg);
  for (const v of [s, z]) {
    vg.connect(v.frequency); wg.connect(v.frequency);
    const q = v.frequency;
    q.setValueAtTime(f * 0.72, t);
    q.exponentialRampToValueAtTime(f, t + R(0.5, 0.9));
    q.exponentialRampToValueAtTime(f * R(1.06, 1.15), t + d * 0.6);
    q.exponentialRampToValueAtTime(f * R(0.72, 0.85), t + d);
  }
  const env = gain(ctx), zg = gain(ctx, 0.6), lp = filt(ctx, 'lowpass', 1100, 2.5), pn = pan(ctx, p);
  s.connect(env); chain(z, lp, zg, env);
  formants(ctx, z, env, [[R(700, 850), 6, 0.35]]);
  // breathy onset
  const n = src(ctx, B.pinkM, t, 0.6), nb = filt(ctx, 'bandpass', R(1000, 2000), 1), ng = gain(ctx);
  chain(n, nb, ng, pn);
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.5 * a, t + 0.12); ng.gain.linearRampToValueAtTime(0, t + 0.55);
  chain(env, pn, out);
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(a, t + R(0.3, 0.5));
  env.gain.setValueAtTime(a, t + d * 0.7); env.gain.linearRampToValueAtTime(0, t + d);
}

export function howl(ctx, B, out, t, o = {}) {
  const voices = o.voices ?? (Math.random() < 0.55 ? 1 : 2 + ((Math.random() * 3) | 0));
  let end = 0;
  for (let i = 0; i < voices; i++) {
    const st = i === 0 ? 0 : R(0.4, 1.8) * i, d = R(2.6, 4.5);
    const p = i === 0 ? 0 : (i % 2 ? -1 : 1) * R(0.25, 0.55);
    howlVoice(ctx, B, out, t + st, R(320, 500), d, 0.3 / Math.sqrt(voices) * (i ? R(0.6, 1) : 1), p);
    end = Math.max(end, st + d);
  }
  return end + 0.1;
}

export function whine(ctx, B, out, t) {
  const d = R(0.5, 1.1), f = R(850, 1300), N = 64, c = new Float32Array(N), ph = R(0, 6), k = R(5, 7);
  for (let i = 0; i < N; i++) { const x = i / (N - 1); c[i] = f * (1 + 0.12 * Math.sin(x * k + ph) + 0.08 * x - 0.15 * x * x); }
  const o = osc(ctx, 'triangle', f, t, d), g = gain(ctx), bp = filt(ctx, 'bandpass', 1400, 1.5), bg = gain(ctx, 0.6);
  o.frequency.setValueCurveAtTime(c, t, d);
  o.connect(g); chain(o, bp, bg, g); g.connect(out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.08);
  g.gain.setValueAtTime(0.16, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
  return d + 0.05;
}

// Adélie "ka-ka-ka-gaaaa": short hard syllables then a long buzzy call, two slightly
// detuned voices beating (as emperors do), soft-clipped, gentle sine AM.
export function penguin(ctx, B, out, t) {
  const n = 2 + ((Math.random() * 3) | 0), base = R(240, 340);
  const sylls = []; let at = 0;
  for (let i = 0; i < n; i++) { const d = R(0.05, 0.08); sylls.push({ at, d, a: 0.8, f: base * R(1.15, 1.3) }); at += d + R(0.06, 0.1); }
  const gd = R(0.5, 0.9); sylls.push({ at, d: gd, a: 1, f: base, last: true }); at += gd;
  const dur = at, N = Math.max(32, Math.round(dur * 400)), env = new Float32Array(N), fc = new Float32Array(N);
  let f = sylls[0].f;
  for (let i = 0; i < N; i++) {
    const x = i / 400; let e = 0;
    for (const s of sylls) {
      if (x >= s.at - 0.03) f = s.f;
      if (x >= s.at && x < s.at + s.d) {
        const u = (x - s.at) / s.d;
        e = s.a * Math.min(1, u * (s.last ? 10 : 6)) * Math.min(1, (1 - u) * (s.last ? 4 : 5));
        if (s.last) f = s.f * (1 + 0.12 * Math.sin(u * Math.PI) - 0.1 * u);
      }
    }
    env[i] = e; fc[i] = f;
  }
  env[N - 1] = 0;
  const o1 = osc(ctx, 'sawtooth', base, t, dur), o2 = osc(ctx, 'sawtooth', base, t, dur);
  o1.frequency.setValueCurveAtTime(fc, t, dur);
  const fc2 = fc.map(v => v * 1.045); o2.frequency.setValueCurveAtTime(fc2, t, dur);
  const mix = gain(ctx, 0.5), m2 = gain(ctx, 0.6);
  o1.connect(mix); chain(o2, m2, mix);
  const am = gain(ctx, 0.7), lfo = osc(ctx, 'sine', R(28, 40), t, dur), lg = gain(ctx, 0.3);
  lfo.connect(lg); lg.connect(am.gain);
  const e = gain(ctx), g = gain(ctx, 0.5);
  chain(mix, shaper(ctx), am);
  formants(ctx, am, e, [[R(850, 1150), 3, 1], [R(2000, 2600), 5, 0.45]]);
  e.gain.setValueCurveAtTime(env, t, dur);
  chain(e, g, out);
  return dur + 0.05;
}

export function bear(ctx, B, out, t, o = {}) {
  if (o.kind === 'growl') {
    const d = R(1.2, 2), f = R(52, 75), N = 48, c = new Float32Array(N);
    let v = 1; for (let i = 0; i < N; i++) { v = clamp(v + R(-0.06, 0.06), 0.85, 1.15); c[i] = f * v * (1 - 0.15 * i / N); }
    const z = osc(ctx, 'sawtooth', f, t, d); z.frequency.setValueCurveAtTime(c, t, d);
    const lp = filt(ctx, 'lowpass', 380, 3), am = gain(ctx, 0.6), rough = src(ctx, B.brown, t, d, 4), rg = gain(ctx, 1.6);
    chain(rough, rg); rg.connect(am.gain);
    const br = src(ctx, B.pinkM, t, d), bl = filt(ctx, 'lowpass', 260), bg = gain(ctx, 0.4);
    const env = gain(ctx);
    chain(z, lp, am, env); chain(br, bl, bg, env); env.connect(out);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.75, t + 0.25);
    env.gain.setValueAtTime(0.6, t + d * 0.7); env.gain.linearRampToValueAtTime(0, t + d);
    return d + 0.05;
  }
  const n = 2 + ((Math.random() * 2) | 0); let at = t;
  for (let i = 0; i < n; i++) {
    const d = R(0.18, 0.3);
    const s = src(ctx, B.pinkM, at, d), lp = filt(ctx, 'lowpass', R(380, 700), 1.5), g = gain(ctx);
    chain(s, lp, g, out); perc(g.gain, at, 1.1, 0.015, d);
    noiseBurst(ctx, B, out, at, 'lowpass', R(120, 200), 1, 1.6, 0.01, 0.15); // chest, not a kick
    at += d + R(0.15, 0.3);
  }
  return at - t + 0.05;
}

// ---------------------------------------------------------------- wind bed
// Continuous layers, built once. set(p, t) is called ~8x per second with
//   p = { intensity 0..1.3, speed 0..1 (raw wind), gust 0..1, pan -1..1 (upwind side),
//         shelter 0..1, whiteout 0..1, time (s) }
// tidy(t) (live context only) clears accumulated automation every few seconds.
export function createWind(ctx, B, out) {
  const bus = gain(ctx, 1), shelterLP = filt(ctx, 'lowpass', 16000, 0.5);
  chain(bus, shelterLP, out);
  const now = ctx.currentTime, touched = new Set();
  // Estimated current value of a param driven only by P() (no stale .value reads).
  // After tidy() the param is held at _c0 with no target (_v undefined).
  const est = (prm, t) => prm._t0 === undefined ? prm.value : prm._v === undefined ? prm._c0 : prm._v +(prm._c0 - prm._v) * Math.exp(-Math.max(0, t - prm._t0) / prm._tc);
  const P = (prm, v, t, tc = 0.12) => {
    if (prm._v !== undefined && Math.abs(v - prm._v) <= Math.abs(prm._v) * 0.012 + 1e-5) return;
    prm._c0 = est(prm, t); prm._t0 = t; prm._tc = tc;
    prm._v = v; touched.add(prm); prm.setTargetAtTime(v, t, tc);
  };
  // stereo layer with independent L/R gains (separate turbulence per ear)
  const stereo = (buf, rate, filters) => {
    const s = src(ctx, buf, now, Infinity, rate);
    chain(s, ...filters);
    const sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2), gL = gain(ctx), gR = gain(ctx);
    filters[filters.length - 1].connect(sp);
    sp.connect(gL, 0); sp.connect(gR, 1); gL.connect(mg, 0, 0); gR.connect(mg, 0, 1);
    return { f: filters, gL, gR, out: mg };
  };
  const rumble = stereo(B.brown, 1, [filt(ctx, 'lowpass', 160, 0.6), filt(ctx, 'highpass', 35, 0.7)]);
  const body = stereo(B.pink, 1, [filt(ctx, 'bandpass', 500, 0.6)]);
  const hissAM = gain(ctx, 0.35);
  const hiss = stereo(B.white, 1, [filt(ctx, 'bandpass', 5000, 0.5), filt(ctx, 'highshelf', 7000, 0.7, -6), hissAM]);
  const grit = src(ctx, B.grit, now, Infinity), gritG = gain(ctx, 0.9);
  chain(grit, gritG); gritG.connect(hissAM.gain);
  for (const l of [rumble, body, hiss]) l.out.connect(bus);

  // gust body: mono, panned to the upwind side
  const gS = src(ctx, B.pinkM, now, Infinity, 0.93), gF = filt(ctx, 'bandpass', 700, 1.1), gG = gain(ctx), gP = pan(ctx, 0);
  chain(gS, gF, gG, gP, bus);

  // whistles / howls: narrow cascaded resonances on their own noise, gliding slowly
  const whistles = B.whistle.map((buf, i) => {
    const s = src(ctx, buf, now, Infinity), f1 = filt(ctx, 'bandpass', 800, 28), f2 = filt(ctx, 'bandpass', 800, 28), g = gain(ctx), p = pan(ctx, 0);
    chain(s, f1, f2, g, p, bus);
    return { f1, f2, g, p, base: [520, 860, 1350][i], seed: i * 17.3 };
  });

  // parka-hood flutter: close, centred, 4-12 Hz flapping above wind 0.7
  const hS = src(ctx, B.pinkM, now, Infinity, 0.71), hF = filt(ctx, 'bandpass', 420, 0.9), hAM = gain(ctx, 0.08), hG = gain(ctx);
  const flap = src(ctx, B.flap, now, Infinity), flapG = gain(ctx, 0.92);
  chain(flap, flapG); flapG.connect(hAM.gain);
  chain(hS, hF, hAM, hG); hG.connect(out); // bypasses the shelter filter: it's at your ears

  // in the lee: the gale roaring just overhead (dark, wide) ...
  const oS = src(ctx, B.pink, now, Infinity, 0.9), oB = filt(ctx, 'bandpass', 320, 0.7), oL = filt(ctx, 'lowpass', 900, 0.6), oG = gain(ctx);
  chain(oS, oB, oL, oG); oG.connect(out);
  // ... and, close by, the quiet: a few grains of snow sifting down off the rock
  const sS = src(ctx, B.whiteM, now, Infinity, 1.1), sF = filt(ctx, 'bandpass', 3800, 1.2), sAM = gain(ctx, 0), sG = gain(ctx);
  const sGrit = src(ctx, B.grit, now, Infinity, 0.3), sGG = gain(ctx, 1);
  chain(sGrit, sGG); sGG.connect(sAM.gain);
  chain(sS, sF, sAM, sG); sG.connect(out);

  return {
    whistles,
    set(p, t) {
      const x = p.time, w = p.whiteout || 0, sh = p.shelter || 0, g = p.gust || 0, cw = p.cower || 0;
      const I = Math.max(p.intensity, w * 1.1), open = 1 - sh;
      // fast turbulence: +-6 dB x intensity (rumble +-2 dB), separate seeds per ear and per layer
      const turb = (seed, depth = 6 * Math.min(1, I + 0.4)) => dbToGain(depth * clamp(1.8 * wander(x * (1.3 + (seed % 2.2)) + seed), -1, 1));
      const couple = k => 1 + 0.15 * clamp((k - 1) * 2, -1, 1); // brighter when louder
      // rumble: the weight of the air
      const rb = (0.12 + 0.35 * I + 0.15 * w) * (1 - 0.35 * sh) * (0.75 + 0.5 * g) * (1 + 0.35 * cw);
      P(rumble.gL.gain, rb * turb(0.3, 2), t, 0.25); P(rumble.gR.gain, rb * turb(5.9, 2), t, 0.25);
      P(rumble.f[0].frequency, 110 + 120 * I + 30 * wander(x * 0.11), t, 0.3);
      // body: the whoosh; gusts swing it ~15 dB
      const bb = (0.05 + 0.5 * Math.pow(I, 1.4) + 0.12 * w) * (0.85 + 0.15 * wander(x * 0.23 + 3)) * (1 - 0.6 * sh) * (0.35 + 1.65 * g) * (1 + 0.9 * cw);
      const kL = turb(1.7), kR = turb(8.2);
      P(body.gL.gain, bb * kL, t); P(body.gR.gain, bb * kR, t);
      P(body.f[0].frequency, (330 + 420 * I) * (1 + 0.3 * wander(x * 0.07 + 1)) * (1 - 0.35 * w) * (1 - 0.4 * sh) * couple((kL + kR) / 2) * (1 + 0.2 * g), t);
      P(body.f[0].Q, 0.5 + 0.4 * (1 - w), t, 0.5);
      // gust body: directional
      const kg = turb(3.1);
      P(gG.gain, (0.04 + 0.12 * I + 0.6 * g * (0.4 + I)) * (1 - 0.7 * sh) * kg, t);
      P(gF.frequency, (550 + 700 * g + 300 * I) * (1 + 0.25 * wander(x * 0.13 + 7)) * couple(kg), t);
      if (gP.pan) P(gP.pan, clamp((p.pan * 0.8 + 0.15 * wander(x * 0.09)) * (1 - 0.8 * cw), -1, 1), t, 0.3); // cowering: all around you
      // hiss: gritty spindrift, capped
      const hb = Math.min(0.15, (0.003 + 0.12 * I * I + 0.05 * w) * (0.3 + 1.5 * g)) * (1 - 0.95 * sh);
      const hL = turb(4.4), hR = turb(9.7);
      P(hiss.gL.gain, hb * hL, t); P(hiss.gR.gain, hb * hR, t);
      P(hiss.f[0].frequency, (4200 + 1600 * wander(x * 0.17 + 5) + 1200 * g) * couple((hL + hR) / 2), t);
      // whistles emerge only in strong wind or gusts
      const strong = clamp((I - 0.5) * 2.2 + g * 0.9, 0, 1.4) * open * open * (1 - 0.5 * w);
      for (const wh of whistles) {
        const swell = Math.max(0, wander(x * 0.16 + wh.seed) * 1.4 - 0.15);
        const f = wh.base * (1 + 0.22 * wander(x * 0.05 + wh.seed)) * (1 + 0.18 * g);
        P(wh.f1.frequency, f, t, 0.3); P(wh.f2.frequency, f * 1.003, t, 0.3);
        P(wh.g.gain, 14 * strong * swell, t, 0.3);
        if (wh.p.pan) P(wh.p.pan, clamp(p.pan * 0.6 + 0.4 * wander(x * 0.04 + wh.seed * 2), -1, 1), t, 0.5);
      }
      // hood flutter
      const sp = p.speed ?? p.intensity;
      const fl = Math.max(clamp((sp + 0.4 * g - 0.7) / 0.3, 0, 1), cw * clamp(0.5 + sp, 0, 1)) * open * (1 - 0.3 * w);
      P(hG.gain, (0.5 + 0.5 * cw) * fl * (0.7 + 0.5 * g) * turb(6.6), t, 0.08);
      P(flap.playbackRate, 0.6 + 1.1 * clamp(sp - 0.5 + g * 0.4, 0, 1) + 0.1 * wander(x * 1.9), t, 0.2); // ~4-12 flaps/s
      // shelter: occluded, lower, softer
      P(shelterLP.frequency, 16000 * Math.pow(open, 3) + 450, t, 0.4);
      // calm cold nights: the bed sinks back and the world goes still
      P(bus.gain, (1 - 0.75 * sh) * (1 - 0.55 * (p.still || 0)), t, 0.8);
      // the lee: overhead roar and close sifting snow
      P(oG.gain, sh * (0.05 + 0.3 * I + 0.1 * w) * (0.6 + 0.7 * g) * turb(11.3, 4), t, 0.3);
      P(oB.frequency, 260 + 140 * I + 60 * g, t, 0.4);
      P(sG.gain, sh * (0.02 + 0.03 * I), t, 0.5);
    },
    tidy(t) {
      for (const prm of touched) {
        const v = est(prm, t);
        if (prm.cancelAndHoldAtTime) prm.cancelAndHoldAtTime(t);
        else { prm.cancelScheduledValues(t); prm.setValueAtTime(v, t); }
        prm._c0 = v; prm._t0 = t;
        prm._v = undefined;
      }
      touched.clear();
    },
  };
}

// Gentle compressor for the wind bus (keeps storms off the limiter). Returns
// { input, output }: Web Audio's compressor adds automatic makeup gain (~+5.4 dB for
// these settings), so a fixed trim after it takes that back out.
export function windComp(ctx) {
  const c = ctx.createDynamicsCompressor(), trim = ctx.createGain();
  c.threshold.value = -12; c.knee.value = 6; c.ratio.value = 4; c.attack.value = 0.03; c.release.value = 0.3;
  trim.gain.value = 0.54;
  c.connect(trim);
  return { input: c, output: trim };
}

// Distant avalanche: a low rolling rumble that builds over ~1 s, sustains 3-6 s with a
// crumbling grain texture, then decays. Meant to be heard through spatial() at distance.
export function avalanche(ctx, B, out, t) {
  const build = R(0.8, 1.3), hold = R(3, 6), fall = R(2, 3), d = build + hold + fall;
  // rolling envelope: build, uneven surges while sustaining, long decay
  const N = Math.round(d * 50), env = new Float32Array(N), ph = R(0, 6);
  for (let i = 0; i < N; i++) {
    const x = i / 50;
    const shape = x < build ? Math.pow(x / build, 1.5) : x < build + hold ? 1 : Math.exp(-(x - build - hold) / (fall / 3.5));
    env[i] = shape * (0.8 + 0.2 * wander(x * 2.3 + ph));
  }
  env[N - 1] = 0;
  const g = gain(ctx); g.gain.setValueCurveAtTime(env, t, d); g.connect(out);
  // low rumble body
  const r = src(ctx, B.brown, t, d, R(0.8, 1)), rl = filt(ctx, 'lowpass', R(200, 320), 0.8), rh = filt(ctx, 'highpass', 30, 0.7), rg = gain(ctx, 1.1);
  rl.frequency.setValueAtTime(rl.frequency.value * 1.4, t);
  rl.frequency.exponentialRampToValueAtTime(rl.frequency.value * 0.7, t + d);
  chain(r, rl, rh, rg, g);
  // mid roar (snow mass in motion)
  const m = src(ctx, B.pinkM, t, d), mb = filt(ctx, 'bandpass', R(350, 550), 0.7), mg = gain(ctx, 0.3);
  chain(m, mb, mg, g);
  // crumbling grains: many small irregular impacts, darker than footsteps
  const c = src(ctx, B.whiteM, t, d), cb = filt(ctx, 'bandpass', R(600, 1100), 0.8), cg = gain(ctx);
  cg.gain.setValueCurveAtTime(grainCurve(d, (d * R(30, 45)) | 0, 25, 0.5, 1.1), t, d);
  chain(c, cb, cg, g);
  return d + 0.1;
}

// ---------------------------------------------------------------- explorer actions
// Ice axe strike: a sharp metallic bite, an ice crunch, sometimes chips skittering down.
export function axe(ctx, B, out, t, o = {}) {
  const p = pan(ctx, (o.hand === 'L' ? -1 : 1) * R(0.1, 0.25)); p.connect(out);
  noiseBurst(ctx, B, p, t, 'highpass', R(2500, 4000), 0.7, 0.9, 0.0008, 0.02);
  const f = R(2600, 4200), rd = R(0.06, 0.14);
  for (const [m, a] of [[1, 0.12], [1.53, 0.07], [2.37, 0.05], [3.11, 0.03]]) {
    const ob = osc(ctx, 'sine', f * m * R(0.98, 1.02), t, rd), g = gain(ctx);
    chain(ob, g, p); perc(g.gain, t, a, 0.0008, rd * R(0.6, 1));
  }
  noiseBurst(ctx, B, p, t, 'lowpass', R(500, 800), 1, 0.7, 0.002, 0.05); // the pick going in
  const cd = R(0.08, 0.14), cs = src(ctx, B.whiteM, t, cd), cb = filt(ctx, 'bandpass', R(1800, 3500), 0.9), cg = gain(ctx);
  chain(cs, cb, cg, p); cg.gain.setValueCurveAtTime(grainCurve(cd, (R(18, 30)) | 0, 3, 0.8, 1.6), t + 0.003, cd);
  let end = Math.max(rd, cd);
  if (Math.random() < 0.55) { // chips skittering and falling away
    let at = t + R(0.05, 0.12), a = R(0.25, 0.4);
    const n = 2 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      noiseBurst(ctx, B, p, at, 'bandpass', R(3500, 6500), 2, a, 0.0005, R(0.006, 0.015));
      at += R(0.05, 0.16); a *= R(0.55, 0.8);
    }
    end = Math.max(end, at - t);
  }
  return end + 0.1;
}

// Crampon kick: spiky crunch, a thud, and a short downward scrape. Heavier than a step.
export function kick(ctx, B, out, t, o = {}) {
  const p = pan(ctx, (o.foot === 'L' ? -1 : 1) * R(0.08, 0.2)); p.connect(out);
  noiseBurst(ctx, B, p, t, 'lowpass', R(250, 400), 1, 3.2, 0.003, 0.08);
  const cd = R(0.1, 0.16), cs = src(ctx, B.whiteM, t, cd), cb = filt(ctx, 'bandpass', R(2500, 4500), 0.8), cg = gain(ctx);
  chain(cs, cb, cg, p); cg.gain.setValueCurveAtTime(grainCurve(cd, (R(30, 45)) | 0, 2, 2, 1.8), t, cd);
  const st = t + R(0.03, 0.06), sd = R(0.1, 0.16), sc = src(ctx, B.whiteM, st, sd), sb = filt(ctx, 'bandpass', R(1800, 2600), 2.5), sg = gain(ctx);
  sb.frequency.setValueAtTime(sb.frequency.value, st); sb.frequency.exponentialRampToValueAtTime(R(900, 1300), st + sd);
  chain(sc, sb, sg, p);
  sg.gain.setValueAtTime(0, st); sg.gain.linearRampToValueAtTime(0.5, st + sd * 0.2); sg.gain.linearRampToValueAtTime(0, st + sd);
  return Math.max(cd, st - t + sd) + 0.1;
}

// Shoved by a gust: a burst of cloth flapping, two scuffing steps, an effort grunt-breath.
export function shove(ctx, B, out, t, o = {}) {
  const s = clamp(o.strength ?? 0.6, 0, 1), d = R(0.4, 0.7) + 0.3 * s;
  const cs = src(ctx, B.pinkM, t, d, 1.3), cb = filt(ctx, 'bandpass', R(450, 750), 0.9), am = gain(ctx, 0.1), cg = gain(ctx);
  const fl = src(ctx, B.flap, t, d, R(1.7, 2.2)), fg = gain(ctx, 0.9);
  chain(fl, fg); fg.connect(am.gain);
  chain(cs, cb, am, cg, out);
  cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.5 * (0.5 + s), t + 0.04); cg.gain.setTargetAtTime(0, t + 0.1, d / 3);
  footstep(ctx, B, out, t + R(0.12, 0.2), { terrain: 'snow', weight: 0.9, foot: 'L' });
  footstep(ctx, B, out, t + R(0.35, 0.5), { terrain: 'snow', weight: 0.7, foot: 'R' });
  breath(ctx, B, out, t + 0.05, { inhale: false, len: R(0.25, 0.38), level: 0.7 + 0.3 * s });
  return Math.max(d, 0.7) + 0.1;
}

// Knocked down: a muffled body thump into snow, a slide hiss, then a winded exhale.
export function fall(ctx, B, out, t, o = {}) {
  const s = clamp(o.strength ?? 0.7, 0, 1);
  noiseBurst(ctx, B, out, t, 'lowpass', R(140, 200), 0.8, 2.6 * (0.6 + 0.4 * s), 0.01, 0.28);
  noiseBurst(ctx, B, out, t + 0.01, 'lowpass', R(700, 1000), 0.7, 0.5, 0.01, 0.2); // the snow giving way
  const sd = R(0.5, 0.9) * (0.6 + 0.6 * s), st = t + 0.05, ss = src(ctx, B.whiteM, st, sd), sb = filt(ctx, 'bandpass', 2000, 0.8), sg = gain(ctx);
  sb.frequency.setValueAtTime(R(1800, 2400), st); sb.frequency.exponentialRampToValueAtTime(R(900, 1300), st + sd);
  chain(ss, sb, sg, out);
  sg.gain.setValueAtTime(0, st); sg.gain.linearRampToValueAtTime(0.35 * s + 0.1, st + 0.05); sg.gain.linearRampToValueAtTime(0, st + sd);
  if (o.fatal) return 1;                               // (no breath after it)
  const bt = t + R(0.35, 0.5), bl = R(0.6, 0.9);
  breath(ctx, B, out, bt, { inhale: false, len: bl, level: 0.8 });
  breath(ctx, B, out, bt + bl + 0.1, { inhale: true, len: R(0.5, 0.7), level: 0.5, shaky: 0.8 });
  return bt - t + bl + 0.9;
}

// Sitting down hard in the snow, spent: a soft, heavy thump and the snow settling.
export function slump(ctx, B, out, t, o = {}) {
  const s = clamp(o.strength ?? 0.5, 0, 1);
  noiseBurst(ctx, B, out, t, 'lowpass', R(120, 170), 0.8, 1.6 * (0.5 + 0.5 * s), 0.02, 0.35);
  noiseBurst(ctx, B, out, t + 0.03, 'lowpass', R(600, 900), 0.7, 0.3, 0.02, 0.3);
  return 0.5;
}

// "Ringing silence": on still, cold nights a barely-there high air tone (two narrow
// noise bands near 8-11 kHz, slowly breathing). set(still 0..1, time, t).
export function createAir(ctx, B, out) {
  const g = gain(ctx, 0), now = ctx.currentTime;
  const bands = [8200, 10900].map((f, i) => {
    const s = src(ctx, B.whistle[i], now, Infinity, 1.7), b1 = filt(ctx, 'bandpass', f, 40), b2 = filt(ctx, 'bandpass', f, 40), bg = gain(ctx, i ? 0.6 : 1);
    chain(s, b1, b2, bg, g);
    return b1;
  });
  g.connect(out);
  let last = -1;
  return {
    set(still, time, t) {
      const v = still * 0.9 * (0.75 + 0.25 * wander(time * 0.05));
      if (Math.abs(v - last) < 0.02) return;
      last = v; g.gain.setTargetAtTime(v, t, 2);
    },
  };
}

// ---------------------------------------------------------------- the body (body.js events)
// Teeth chattering: a quick, slightly uneven run of tiny dry clicks (~13-19 a second) that
// swells and fades over `dur`. Close and centred: it's your own jaw.
export function chatter(ctx, B, out, t, o = {}) {
  const dur = o.dur ?? 0.8, lvl = clamp(o.strength ?? 0.6, 0, 1), rate = R(13, 19);
  for (let at = t; at < t + dur; at += R(0.75, 1.3) / rate) {
    const env = Math.sin(Math.PI * (at - t) / dur);
    noiseBurst(ctx, B, out, at, 'bandpass', R(2400, 4200), 2.4, lvl * 0.55 * (0.35 + 0.65 * env) * R(0.6, 1), 0.001, R(0.008, 0.018));
  }
  return dur + 0.1;
}

// Heartbeat: a soft, low lub-dub felt more than heard, plus a dull knock so it survives
// small speakers.
export function heartbeat(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.6, 0, 1);
  const thump = (at, a) => {
    const f = osc(ctx, 'sine', 64, at, 0.3), lp = filt(ctx, 'lowpass', 180), g = gain(ctx);
    f.frequency.setValueAtTime(74, at); f.frequency.exponentialRampToValueAtTime(40, at + 0.2);
    chain(f, lp, g, out); perc(g.gain, at, a * 0.9, 0.012, 0.24);
    noiseBurst(ctx, B, out, at, 'lowpass', 260, 0.8, a * 0.35, 0.006, 0.09);
  };
  thump(t, lvl); thump(t + 0.27, lvl * 0.62);
  return 0.8;
}

// The stove in the tent, heard from inside: a low soft roar with a breathy hiss on top.
// set(level, t). Pops (the crackle) are one-shots: pop().
export function createFire(ctx, B, out) {
  const g = gain(ctx, 0), now = ctx.currentTime;
  const rS = src(ctx, B.brown, now, Infinity, 0.8), rF = filt(ctx, 'lowpass', 420, 0.6), rG = gain(ctx, 0.55);
  chain(rS, rF, rG, g);
  const hS = src(ctx, B.pinkM, now, Infinity, 0.9), hF = filt(ctx, 'bandpass', 1700, 0.7), hG = gain(ctx, 0.07);
  chain(hS, hF, hG, g);
  g.connect(out);
  let last = -1;
  return {
    set(level, t) {
      if (Math.abs(level - last) < 0.01) return;
      last = level; g.gain.setTargetAtTime(level, t, 0.5);
    },
  };
}
export function pop(ctx, B, out, t, o = {}) {
  const lvl = o.level ?? 0.5;
  noiseBurst(ctx, B, out, t, 'bandpass', R(1100, 3600), 1.4, lvl * R(0.3, 1), 0.001, R(0.012, 0.05));
  if (Math.random() < 0.35) noiseBurst(ctx, B, out, t + R(0.02, 0.08), 'bandpass', R(2000, 4500), 1.8, lvl * R(0.2, 0.5), 0.001, R(0.008, 0.02));
  return 0.2;
}

// A single gust sweeping past: a band of noise that swells and falls over ~2.5 s, rising in
// pitch as it peaks and panning across.
export function gustSwell(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.7, 0, 1), dur = R(2.2, 2.8);
  const s = src(ctx, B.pink, t, dur), bp = filt(ctx, 'bandpass', 400, 0.8), g = gain(ctx), pn = pan(ctx, -0.6);
  chain(s, bp, g, pn, out);
  bp.frequency.setValueAtTime(320, t); bp.frequency.linearRampToValueAtTime(R(800, 1000), t + dur * 0.45); bp.frequency.linearRampToValueAtTime(380, t + dur);
  if (pn.pan) pn.pan.linearRampToValueAtTime(0.6, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * lvl, t + dur * 0.45); g.gain.linearRampToValueAtTime(0, t + dur);
  return dur + 0.1;
}

// ---------------------------------------------------------------- water (slice 2)
// A wading step / swimming stroke: a wet slap (a bright noise burst with a quick fall) over a
// low hollow plop, then a short trickle of drops falling back.
export function splash(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.6, 0, 1.4);
  noiseBurst(ctx, B, out, t, 'bandpass', R(900, 1600), 0.9, 0.9 * lvl, 0.004, R(0.12, 0.22));
  noiseBurst(ctx, B, out, t + 0.005, 'lowpass', R(250, 380), 1.2, 0.8 * lvl, 0.006, 0.16);
  const f = osc(ctx, 'sine', R(140, 210), t, 0.12), g = gain(ctx);
  f.frequency.exponentialRampToValueAtTime(R(60, 90), t + 0.1);
  chain(f, g, out); perc(g.gain, t, 0.25 * lvl, 0.004, 0.11);
  const n = 3 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) noiseBurst(ctx, B, out, t + R(0.12, 0.45), 'bandpass', R(2200, 4200), 3, R(0.08, 0.2) * lvl, 0.001, R(0.01, 0.03));
  return 0.6;
}
// Into the sea: a big splash, then the involuntary gasp of cold shock and a shaky breath out.
export function plunge(ctx, B, out, t, o = {}) {
  const deep = !!o.deep;
  splash(ctx, B, out, t, { strength: deep ? 1.4 : 1.0 });
  noiseBurst(ctx, B, out, t, 'lowpass', 160, 0.8, deep ? 1.6 : 0.9, 0.01, deep ? 0.5 : 0.3);
  breath(ctx, B, out, t + 0.18, { inhale: true, len: 0.42, level: 1.1, shaky: 1 });
  breath(ctx, B, out, t + 0.75, { inhale: false, len: 0.7, level: 0.8, shaky: 1 });
  return 1.6;
}
// A drip off wet clothes onto snow: a tiny dull tick.
export function drip(ctx, B, out, t) {
  noiseBurst(ctx, B, out, t, 'bandpass', R(1800, 3000), 4, R(0.05, 0.12), 0.001, 0.02);
  return 0.1;
}

// ---------------------------------------------------------------- the pack and food (slice 4)
// Canvas and oilcloth handled: a soft rustle (a few overlapping bands of noise swelling and
// falling), and with `thud` the dull drop of something into the snow or onto the sled.
export function rustle(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.6, 0, 1.2), n = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const at = t + i * R(0.04, 0.09);
    noiseBurst(ctx, B, out, at, 'bandpass', R(1800, 3600), 1.1, lvl * R(0.18, 0.32), R(0.02, 0.05), R(0.08, 0.16));
  }
  if (o.thud) {
    noiseBurst(ctx, B, out, t + 0.06, 'lowpass', R(140, 200), 0.8, 0.9 * lvl, 0.01, 0.22);
    noiseBurst(ctx, B, out, t + 0.07, 'lowpass', R(700, 1000), 0.7, 0.2 * lvl, 0.01, 0.2);
  }
  return 0.45;
}
// No room: a stiff, muffled knock of a full pack and a short scrape.
export function refuse(ctx, B, out, t) {
  noiseBurst(ctx, B, out, t, 'lowpass', 260, 1.2, 0.8, 0.004, 0.12);
  noiseBurst(ctx, B, out, t + 0.1, 'lowpass', 220, 1.2, 0.6, 0.004, 0.1);
  noiseBurst(ctx, B, out, t + 0.02, 'bandpass', 1400, 1.5, 0.12, 0.01, 0.16);
  return 0.35;
}
// A bite of hard biscuit or frozen pemmican: a dry crunch (grainy high bursts over a dull jaw
// knock), close and centred.
export function chew(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.6, 0, 1);
  noiseBurst(ctx, B, out, t, 'lowpass', R(300, 420), 1, 0.8 * lvl, 0.003, 0.06);
  const n = 4 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) noiseBurst(ctx, B, out, t + R(0, 0.08), 'bandpass', R(1800, 4200), 2.2, lvl * R(0.2, 0.45), 0.001, R(0.008, 0.024));
  return 0.2;
}
// An empty stomach: a low, wet gurgle — a band of brown noise whose centre wanders and whose
// level bubbles (a few uneven swells), over a faint low moan that slides down.
export function growl(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.6, 0, 1), dur = R(1.1, 1.8);
  const s = src(ctx, B.brown, t, dur), bp = filt(ctx, 'bandpass', 160, 4), g = gain(ctx);
  chain(s, bp, g, out);
  bp.frequency.setValueAtTime(R(120, 160), t);
  bp.frequency.linearRampToValueAtTime(R(220, 300), t + dur * 0.35);
  bp.frequency.linearRampToValueAtTime(R(90, 130), t + dur);
  g.gain.setValueAtTime(0, t);
  const n = 4 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const at = t + (i / n) * dur * 0.9, a = lvl * R(0.6, 1.4) * Math.sin(Math.PI * (i + 0.5) / n);
    g.gain.linearRampToValueAtTime(a, at + 0.04);
    g.gain.linearRampToValueAtTime(a * 0.25, at + dur / n * 0.8);
  }
  g.gain.linearRampToValueAtTime(0, t + dur);
  const m = osc(ctx, 'sine', R(95, 120), t, dur), mg = gain(ctx), lp = filt(ctx, 'lowpass', 240);
  m.frequency.exponentialRampToValueAtTime(R(55, 70), t + dur);
  chain(m, lp, mg, out);
  mg.gain.setValueAtTime(0, t); mg.gain.linearRampToValueAtTime(0.12 * lvl, t + dur * 0.3); mg.gain.linearRampToValueAtTime(0, t + dur);
  return dur + 0.1;
}

// ---------------------------------------------------------------- falls, injury, thin ice (slice 5)
// A grunt: a short voiced push of breath from the chest (a low buzz through two vowel bands and a
// breathy band of noise), falling in pitch. Close: it's your own throat.
export function grunt(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.6, 0, 1.2), d = R(0.16, 0.26) * (0.8 + 0.4 * lvl), f0 = R(105, 135);
  const v = osc(ctx, 'sawtooth', f0, t, d), env = gain(ctx);
  v.frequency.setValueAtTime(f0 * 1.12, t); v.frequency.exponentialRampToValueAtTime(f0 * 0.78, t + d);
  formants(ctx, v, env, [[R(480, 620), 4, 0.9], [R(1000, 1300), 5, 0.45], [R(2300, 2700), 7, 0.15]]);
  const n = src(ctx, B.pinkM, t, d), nb = filt(ctx, 'bandpass', R(900, 1300), 0.9), ng = gain(ctx, 0.5);
  chain(n, nb, ng, env);
  env.connect(out);
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.32 * lvl, t + 0.025);
  env.gain.setTargetAtTime(0, t + d * 0.55, d * 0.25);
  return d + 0.15;
}
// Landing hard from a height: the body hitting the snow (a deep, dead thump and the snow giving),
// a sharp dry crack on top (high, short: the leg), and the grunt knocked out of them; a fatal one
// has no breath after it.
export function impact(ctx, B, out, t, o = {}) {
  const s = clamp(o.strength ?? 0.6, 0, 1);
  noiseBurst(ctx, B, out, t, 'lowpass', R(90, 130), 0.8, 3.4 * (0.6 + 0.4 * s), 0.006, 0.38);
  noiseBurst(ctx, B, out, t + 0.005, 'lowpass', R(500, 800), 0.7, 0.9, 0.006, 0.25);
  noiseBurst(ctx, B, out, t + 0.012, 'highpass', R(2200, 3200), 0.9, 1.1 * (0.4 + 0.6 * s), 0.0006, 0.018);
  noiseBurst(ctx, B, out, t + 0.016, 'bandpass', R(1500, 2200), 3, 0.8 * s, 0.0008, 0.035);
  if (!o.fatal) grunt(ctx, B, out, t + R(0.06, 0.1), { strength: 0.7 + 0.5 * s });
  else noiseBurst(ctx, B, out, t + 0.1, 'bandpass', R(500, 700), 1.5, 0.25, 0.01, 0.25);   // only the air going out of them
  return 1;
}
// A scuffing drag of a boot through snow (the hurt leg).
export function scuff(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.5, 0, 1), d = R(0.12, 0.2);
  const n = src(ctx, B.whiteM, t, d), bp = filt(ctx, 'bandpass', R(1200, 1700), 1.3), g = gain(ctx);
  bp.frequency.exponentialRampToValueAtTime(R(500, 700), t + d);
  chain(n, bp, g, out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28 * lvl, t + d * 0.3); g.gain.linearRampToValueAtTime(0, t + d);
  return d + 0.05;
}
// Thin ice giving way: a huge crack, the slab breaking up (a crash of grainy bursts), and the
// slosh of the water coming up through it.
export function breakthrough(ctx, B, out, t) {
  crack(ctx, B, out, t, { strength: 1 });
  noiseBurst(ctx, B, out, t, 'lowpass', 120, 1, 2.6, 0.004, 0.45);
  const n = 7 + ((Math.random() * 5) | 0);
  for (let i = 0; i < n; i++) noiseBurst(ctx, B, out, t + R(0.02, 0.35), 'bandpass', R(1500, 4500), 1.6, R(0.25, 0.6), 0.001, R(0.02, 0.06));
  splash(ctx, B, out, t + 0.12, { strength: 1.3 });
  return 1.6;
}
// Binding a leg: cloth pulled round and round (a rising rustle), and at the end the knot pulled
// tight with a hiss through the teeth.
export function wrap(ctx, B, out, t, o = {}) {
  const lvl = clamp(o.strength ?? 0.5, 0, 1), d = R(0.25, 0.4);
  const n = src(ctx, B.pinkM, t, d), bp = filt(ctx, 'bandpass', R(2000, 2800), 1.2), g = gain(ctx);
  bp.frequency.linearRampToValueAtTime(R(3000, 3800), t + d);
  chain(n, bp, g, out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3 * lvl, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
  if (o.tight) {
    const h = src(ctx, B.whiteM, t + d, 0.35), hb = filt(ctx, 'bandpass', R(4500, 6000), 2), hg = gain(ctx);
    chain(h, hb, hg, out);
    hg.gain.setValueAtTime(0, t + d); hg.gain.linearRampToValueAtTime(0.12 * lvl, t + d + 0.05); hg.gain.linearRampToValueAtTime(0, t + d + 0.35);
    return d + 0.45;
  }
  return d + 0.05;
}
