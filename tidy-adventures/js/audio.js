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
let musicGain = null;
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
  /* One-shot unlock on the first real gesture. Music asked for before that
     gesture was refused by the browser, so retry it here — this is why the
     title track starts the moment you touch the screen rather than never. */
  const unlock = () => {
    ensureCtx();
    if (ctx?.state === "suspended") ctx.resume();
    if (blockedTrack) playMusic(blockedTrack);
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(ev, unlock, { once: false, passive: true });
  }

  /* PUT THE GAME DOWN AND IT GOES QUIET.

     Nothing stops a looping <audio> element when a phone is locked or the app
     is backgrounded — on an iPhone the music kept playing into a dark screen,
     and on iOS it takes over the lock-screen controls while it does. A browser
     tab gets away with this; something installed to the home screen reads as a
     broken app.

     visibilitychange covers lock, app switch and tab change on every platform
     that matters. pagehide is the iOS belt-and-braces: Safari can move a page
     into the back/forward cache without firing visibilitychange first. */
  const sleep = () => {
    resumeOnReturn = !!(musicEl && !musicEl.paused);
    musicEl?.pause();
    oldEl?.pause();
    ctx?.suspend?.().catch?.(() => {});
  };
  const wake = () => {
    if (document.hidden) return;
    ctx?.resume?.().catch?.(() => {});
    /* Only what was actually playing, and only where it left off — the track
       is not restarted, so coming back mid-level doesn't reset the loop. */
    if (resumeOnReturn && musicEl) musicEl.play().catch(() => {});
    resumeOnReturn = false;
  };
  document.addEventListener("visibilitychange", () => document.hidden ? sleep() : wake());
  window.addEventListener("pagehide", sleep);
  window.addEventListener("pageshow", wake);
}
let resumeOnReturn = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }
  masterGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain.connect(masterGain);
  musicGain.connect(masterGain);
  masterGain.connect(ctx.destination);
  applyVolumes();
  unlocked = true;
  preloadFiles();
  return ctx;
}

function applyVolumes() {
  applyMusicVolume();
  if (!masterGain) return;
  masterGain.gain.value = settings.muted ? 0 : settings.master;
  sfxGain.gain.value = settings.sfx;
}

/* ============================================================
   MUSIC

   An <audio> element for the SOURCE — one long file wants to stream and loop
   natively, and decoding three megabytes into an AudioBuffer to reach the same
   place costs memory and delays the first note — but its output is routed
   THROUGH the Web Audio graph, and every volume change is made on a GainNode.

   THIS IS AN iOS FIX, and it is the whole reason the routing exists.
   `HTMLMediaElement.volume` is read-only on iOS: the setter is silently
   ignored, because Apple reserves loudness for the hardware buttons. So a
   build that set `el.volume` had music that could not be turned down and could
   not be muted on an iPhone, while behaving perfectly on a desktop — which is
   exactly how it was reported. A GainNode has no such restriction.

   Chain: element -> MediaElementSource -> per-track gain -> musicGain ->
   masterGain -> out. Per-track gain carries the track's own trim and the
   cross-fade; musicGain is the Music slider; masterGain is Master and mute,
   shared with the effects, which is what makes one mute button cover both.

   Tracks live in data/audio.json under "music", so a per-client theme later is
   a data edit: add the track, name it in clients.json, done.
============================================================ */
const FADE_MS = 700;
let musicEl = null;        // what's playing
let oldEl = null;          // what's fading out under it
let musicId = null;
let blockedTrack = null;   // asked for before the browser allowed audio

function applyMusicVolume() {
  if (musicGain) musicGain.gain.value = settings.music;
  for (const el of [musicEl, oldEl]) {
    if (!el) continue;
    const v = Math.max(0, Math.min(1, el._gain * el._fade));
    if (el._node) el._node.gain.value = v;
    /* No graph yet (the context hasn't been unlocked): fall back to the
       element, which works everywhere except iOS — and on iOS nothing is
       audible before the unlocking gesture anyway. */
    else el.volume = Math.max(0, Math.min(1, musicLevelFallback() * v));
  }
}
const musicLevelFallback = () => settings.muted ? 0 : settings.master * settings.music;

/* Stop a track and take it out of the graph. Without the disconnect every
   track change leaves a dead source node hanging off musicGain for the rest of
   the session — silent, but it accumulates. */
function retire(el) {
  if (!el) return;
  el.pause();
  try { el._node?.disconnect(); } catch {}
  el._node = null;
}

/* Route an element into the graph. Once only per element — a second
   createMediaElementSource on the same element throws. */
function wire(el) {
  if (el._node || !ensureCtx()) return;
  try {
    const node = ctx.createGain();
    ctx.createMediaElementSource(el).connect(node);
    node.connect(musicGain);
    node.gain.value = 0;
    el._node = node;
    el.volume = 1;              /* the graph does the attenuating now */
  } catch (e) {
    console.warn("[Tidy Adventures] audio: music could not be routed through the graph; " +
      "volume and mute will not work on iOS.", e.message);
  }
}

/* Volume ramp on a timer. AudioParam has scheduling, but the ramp has to drive
   the element fallback too, so one timer covers both paths. */
function ramp(el, to, ms, done) {
  clearInterval(el._timer);
  const from = el._fade, t0 = performance.now();
  el._timer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el._fade = from + (to - from) * k;
    applyMusicVolume();
    if (k >= 1) { clearInterval(el._timer); el._timer = null; done && done(); }
  }, 40);
}

/* Start (or cross-fade to) a track. Calling it with the track already playing
   is a no-op, so it is safe to call from every screen transition. */
export function playMusic(id) {
  const def = cfg?.music?.[id];
  if (!def?.src) return;
  if (musicId === id && musicEl && !musicEl.paused) return;

  if (musicEl) {                       /* fade the outgoing one out and drop it */
    if (oldEl) { clearInterval(oldEl._timer); retire(oldEl); }
    oldEl = musicEl;
    ramp(oldEl, 0, FADE_MS, () => { retire(oldEl); oldEl = null; });
  }

  const el = new Audio(def.src);
  el.loop = def.loop !== false;
  el.preload = "auto";
  /* Deliberately NOT crossOrigin: the tracks are same-origin, so the graph
     can't be tainted by them, and setting it would turn a plain media request
     into a CORS one for no benefit — on the one platform this routing exists
     to fix, and which I can't test directly. If music ever moves to another
     origin it will need `crossOrigin = "anonymous"` AND CORS headers, or the
     graph will output silence. */
  el._gain = def.vol ?? 1;
  el._fade = 0;
  el._node = null;
  musicEl = el;
  musicId = id;
  wire(el);
  applyMusicVolume();
  el.play().then(() => {
    blockedTrack = null;
    wire(el);                          /* in case the context only opened now */
    applyMusicVolume();
    ramp(el, 1, FADE_MS);
  }).catch(() => {
    /* Autoplay policy: no gesture yet. initAudio's unlock listener retries. */
    blockedTrack = id;
    musicId = null;
  });
}

export function stopMusic() {
  blockedTrack = null;
  musicId = null;
  for (const el of [musicEl, oldEl]) {
    if (!el) continue;
    clearInterval(el._timer);
    el.pause();
  }
  musicEl = null; oldEl = null;
}

export const nowPlayingMusic = () => musicId;

/* The music element is never in the document, so nothing can inspect it from
   outside. This is how a test — or the console — sees what is actually coming
   out of the speakers rather than what was last asked for. */
export const musicDebug = () => ({
  id: musicId,
  blocked: blockedTrack,
  src: musicEl?.src.split("/").pop() ?? null,
  paused: musicEl?.paused ?? null,
  at: musicEl ? +musicEl.currentTime.toFixed(2) : null,
  /* What the graph is actually doing, which is the only number that means
     anything on iOS — el.volume is ignored there. */
  routed: !!musicEl?._node,
  trackGain: musicEl?._node ? +musicEl._node.gain.value.toFixed(3) : null,
  musicGain: musicGain ? +musicGain.gain.value.toFixed(3) : null,
  masterGain: masterGain ? +masterGain.gain.value.toFixed(3) : null,
  out: musicEl?._node && musicGain && masterGain
    ? +(musicEl._node.gain.value * musicGain.gain.value * masterGain.gain.value).toFixed(4)
    : null,
  ctx: ctx?.state ?? null,
  elVolume: musicEl ? +musicEl.volume.toFixed(3) : null,
  fadingOut: oldEl ? oldEl.src.split("/").pop() : null,
});

/* Any sound with a real "src" is fetched once; the rest stay synthesized. */
async function preloadFiles() {
  for (const [name, def] of Object.entries(cfg.sounds || {})) {
    if (!def.src || buffers.has(name)) continue;
    try {
      const res = await fetch(def.src);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      buffers.set(name, buf);
      starts.set(name, def.trim === false ? 0 : onsetOf(buf));
    } catch (e) {
      console.warn(`[Tidy Adventures] audio: ${def.src} failed to load, using the synth fallback.`, e.message);
    }
  }
}

/* WHERE THE SOUND ACTUALLY STARTS.

   An exported file often carries a few frames of silence at the head. Played
   from sample zero that silence is latency: the toss recording that shipped
   opens with 116ms of nothing, and a toss you hear 116ms after the item lands
   doesn't read as "late audio", it reads as a laggy game. The door was 271ms.

   So the head is measured once at load and skipped at play time. Doing it here
   rather than asking for re-trimmed exports means it is handled for every file
   that ever lands in sound/, including ones nobody thought to check. A file
   that wants its silence kept can say "trim": false. */
const starts = new Map();            // name -> seconds to skip
const SILENCE = 0.004;               // below this is silence, not a soft attack
const PREROLL = 0.006;               // keep a hair of it so the attack isn't clipped

function onsetOf(buf) {
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    if (Math.abs(d[i]) > SILENCE) return Math.max(0, i / buf.sampleRate - PREROLL);
  }
  return 0;                          /* silent all the way through: play as-is */
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
  src.start(0, starts.get(name) || 0);
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
