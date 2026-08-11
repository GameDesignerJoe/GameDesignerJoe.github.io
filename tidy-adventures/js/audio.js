/* ============================================================
   AUDIO — Web Audio engine with synthesized placeholders.

   A large part of "it doesn't feel like a real game" is that it was
   completely silent. The commissioned assets in docs/tidy-audio-assets.md
   don't exist yet, so every sound here is generated in code: you can judge
   the feel now, and swapping in a real file later is one field in
   data/audio.json (set "src" and the synth block is ignored).

   Browsers won't start audio until a user gesture, so the context is
   unlocked on the first tap anywhere.

   Imports: nothing from the game. This module is a leaf on purpose — it
   must never be able to break a render.
============================================================ */

let ctx = null;
let masterGain = null;
let sfxGain = null;
let cfg = null;
let unlocked = false;
const buffers = new Map();     // name -> AudioBuffer for real files
let noiseBuf = null;

export const settings = { master: 0.7, sfx: 1, music: 0.6, muted: false };

export function initAudio(audioData) {
  cfg = audioData;
  settings.master = audioData.master ?? 0.7;
  settings.sfx = audioData.sfxVolume ?? 1;
  settings.music = audioData.musicVolume ?? 0.6;
  loadPrefs();
  /* One-shot unlock on the first real gesture. */
  const unlock = () => { ensureCtx(); if (ctx?.state === "suspended") ctx.resume(); };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(ev, unlock, { once: false, passive: true });
  }
}

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }
  masterGain = ctx.createGain();
  sfxGain = ctx.createGain();
  sfxGain.connect(masterGain);
  masterGain.connect(ctx.destination);
  applyVolumes();
  unlocked = true;
  preloadFiles();
  return ctx;
}

function applyVolumes() {
  if (!masterGain) return;
  masterGain.gain.value = settings.muted ? 0 : settings.master;
  sfxGain.gain.value = settings.sfx;
}

/* Any sound with a real "src" is fetched once; the rest stay synthesized. */
async function preloadFiles() {
  for (const [name, def] of Object.entries(cfg.sounds || {})) {
    if (!def.src || buffers.has(name)) continue;
    try {
      const res = await fetch(def.src);
      if (!res.ok) throw new Error("HTTP " + res.status);
      buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch (e) {
      console.warn(`[Tidy Adventures] audio: ${def.src} failed to load, using the synth fallback.`, e.message);
    }
  }
}

function makeNoise() {
  if (noiseBuf) return noiseBuf;
  const n = Math.floor(ctx.sampleRate * 0.5);
  noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/* ============================================================
   play
============================================================ */
export function play(name, opts = {}) {
  if (settings.muted) return;
  if (!ensureCtx()) return;
  if (ctx.state === "suspended") { ctx.resume(); }
  const def = cfg?.sounds?.[name];
  if (!def) return;

  if (buffers.has(name)) return playBuffer(name, def, opts);
  if (def.synth) return playSynth(def.synth, opts);
}

function playBuffer(name, def, opts) {
  const src = ctx.createBufferSource();
  src.buffer = buffers.get(name);
  const jitter = def.synth?.pitchJitter ?? 0;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
  const g = ctx.createGain();
  g.gain.value = (def.vol ?? 1) * (opts.vol ?? 1);
  src.connect(g); g.connect(sfxGain);
  src.start();
}

function playSynth(s, opts) {
  const t0 = ctx.currentTime;
  const jitter = s.pitchJitter ?? 0;
  const bend = 1 + (Math.random() * 2 - 1) * jitter;
  const vol = (s.vol ?? 0.3) * (opts.vol ?? 1);

  const notes = s.seq?.length
    ? s.seq.map(n => ({ ...n, type: n.type ?? s.type, at: n.at ?? 0 }))
    : [{ f: s.f, to: s.to, dur: s.dur, type: s.type, at: 0 }];

  for (const n of notes) voice(n, t0 + (n.at || 0), bend, vol, s.decay);
}

function voice(n, at, bend, vol, decay) {
  const dur = Math.max(0.02, n.dur ?? 0.12);
  const g = ctx.createGain();
  g.connect(sfxGain);

  let src;
  if (n.type === "noise") {
    src = ctx.createBufferSource();
    src.buffer = makeNoise();
    /* Band-pass it so noise reads as a texture rather than a hiss. */
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = (n.f ?? 800) * bend;
    bp.Q.value = 0.9;
    src.connect(bp); bp.connect(g);
  } else {
    src = ctx.createOscillator();
    src.type = n.type || "sine";
    const f0 = (n.f ?? 440) * bend;
    src.frequency.setValueAtTime(f0, at);
    if (n.to) src.frequency.exponentialRampToValueAtTime(Math.max(1, n.to * bend), at + dur);
    src.connect(g);
  }

  /* Short attack so nothing clicks, then decay. */
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.008);
  if (decay === "linear") g.gain.linearRampToValueAtTime(0.0001, at + dur);
  else g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  src.start(at);
  src.stop(at + dur + 0.02);
}

/* ============================================================
   settings + persistence
============================================================ */
const PREFS_KEY = "tidy-audio";

export function setVolume(kind, v) {
  settings[kind] = Math.max(0, Math.min(1, v));
  applyVolumes();
  savePrefs();
}
export function setMuted(on) {
  settings.muted = !!on;
  applyVolumes();
  savePrefs();
}
export const isMuted = () => settings.muted;

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(settings)); } catch {}
}
function loadPrefs() {
  try {
    const d = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (d) Object.assign(settings, d);
  } catch {}
  applyVolumes();
}
