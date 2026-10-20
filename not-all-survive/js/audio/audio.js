// Audio: procedural wind bed, footsteps, ice, breath and distant creatures.
// The AudioContext is created in unlock(), inside the first user gesture (iOS rule).
// 'M' toggles mute. Audio suspends while the page is hidden.
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import * as S from './synth.js';

let terrain = null; // built in parallel; guard every use
import('../world/terrain.js').then(m => { terrain = m; }).catch(() => {});

let ctx = null, B = null, wind = null;
let muteGain = null, fadeGain = null;
const bus = {};
let muted = false, unlockedAt = -1e9;
let time = 0, windTick = 0, tidyTick = 4;
let echoProx = 0, rockNear = 0, echo = null;
let shelter = 0, exertion = 0, nextBreath = 0, breathIn = true;
let iceTimer = 20, iceCheck = 0, nearIce = false;
const voices = { step: 0, creature: 0, ice: 0, breath: 0 };
const LIMIT = { step: 4, creature: 8, ice: 4, breath: 2 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (a, b) => a + Math.random() * (b - a);

export function init() {
  addEventListener('keydown', e => {
    if (e.code !== 'KeyM' || e.repeat) return;
    if (performance.now() - unlockedAt < 100) return; // the gesture that unlocked audio
    setMuted(!muted);
  });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
  // iOS: pointerdown is not a user activation for touch, so (re)unlock on touchend and
  // click as well. This also resumes after interruptions (calls, other apps).
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, () => { if (!document.hidden) unlock(); }, { passive: true });
}

export function unlock() {
  if (ctx) {
    if (ctx.state !== 'running') { ctx.resume().catch(() => {}); playSilent(); }
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* iOS 17+: ignore silent switch */ }
  ctx = new AC({ latencyHint: 'interactive' });
  // Both of these must happen synchronously inside the gesture for iOS Safari.
  if (ctx.resume) ctx.resume().catch(() => {});
  playSilent();
  unlockedAt = performance.now();
  build();
}

function playSilent() {
  const s = ctx.createBufferSource();
  s.buffer = ctx.createBuffer(1, 1, 22050);
  s.connect(ctx.destination);
  s.start(0);
}

function build() {
  B = S.makeBuffers(ctx);
  const t = ctx.currentTime;

  // master: [sfx -> gentle compressor] + [wind, own bus] -> fade -> mute -> limiter -> out
  fadeGain = ctx.createGain();
  muteGain = ctx.createGain();
  const sfx = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3;
  comp.attack.value = 0.01; comp.release.value = 0.3;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20;
  lim.attack.value = 0.002; lim.release.value = 0.15;
  sfx.connect(comp); comp.connect(fadeGain);
  fadeGain.connect(muteGain); muteGain.connect(lim); lim.connect(ctx.destination);
  fadeGain.gain.setValueAtTime(0, t);
  fadeGain.gain.linearRampToValueAtTime(0.0001, t + 0.3);
  fadeGain.gain.linearRampToValueAtTime(1, t + 4.5);
  muteGain.gain.value = muted ? 0 : 1;

  // a short, dark room tone (snow is nearly anechoic)
  const reverb = ctx.createConvolver();
  reverb.buffer = B.ir;
  bus.reverbIn = ctx.createGain();
  const ret = ctx.createGain(); ret.gain.value = S.MIX.reverb;
  bus.reverbIn.connect(reverb); reverb.connect(ret); ret.connect(sfx);

  // slapback off nearby cliffs/rock: 150-400 ms, lowpassed, level by proximity
  bus.echoIn = ctx.createGain();
  const dl = ctx.createDelay(0.5); dl.delayTime.value = 0.35;
  const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 1800;
  const eg = ctx.createGain(); eg.gain.value = 0;
  bus.echoIn.connect(dl); dl.connect(elp); elp.connect(eg); eg.connect(sfx);
  echo = { dl, eg, last: 0 };

  bus.wind = ctx.createGain(); bus.wind.gain.value = S.MIX.wind;
  const wc = S.windComp(ctx); bus.wind.connect(wc.input); wc.output.connect(fadeGain);
  for (const k of ['steps', 'breath', 'creatures', 'ice', 'avalanche']) {
    bus[k] = ctx.createGain(); bus[k].gain.value = S.MIX[k]; bus[k].connect(sfx);
  }
  const send = (from, to, v) => { const g = ctx.createGain(); g.gain.value = v; from.connect(g); g.connect(to); };
  send(bus.steps, bus.reverbIn, 0.06);
  send(bus.ice, bus.reverbIn, S.MIX.iceSend);
  send(bus.steps, bus.echoIn, 0.6);
  send(bus.creatures, bus.echoIn, 0.4);
  send(bus.ice, bus.echoIn, 0.5);

  wind = S.createWind(ctx, B, bus.wind);
  updateWind(true);
}

function setMuted(m) {
  muted = m;
  if (!muteGain) return;
  const t = ctx.currentTime;
  muteGain.gain.cancelScheduledValues(t);
  muteGain.gain.setValueAtTime(muteGain.gain.value, t);
  muteGain.gain.linearRampToValueAtTime(m ? 0 : 1, t + 0.4);
}

// Book-keeping for polyphony: a voice counts until its graph has finished.
function claim(kind, dur) {
  if (voices[kind] >= LIMIT[kind]) return false;
  voices[kind]++;
  setTimeout(() => { voices[kind]--; }, (dur + 0.1) * 1000);
  return true;
}

// Per-voice spatial chain from a world position: distance -> level, air absorption,
// more reverb; screen x -> pan.
function spatial(x, y, target, sendBase = 0.25) {
  const p = state.player, sc = worldToScreen(x, y), w = state.view.w || 1;
  const d = Math.hypot(x - p.x, y - p.y);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = clamp(9000 / (1 + d / 110), 450, 12000);
  const g = ctx.createGain(); g.gain.value = 1 / (1 + Math.pow(d / 70, 1.3));
  const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if (pn.pan) pn.pan.value = clamp(((sc.x - w / 2) / (w / 2)) * 0.85, -0.95, 0.95);
  const send = ctx.createGain(); send.gain.value = sendBase + Math.min(0.6, d / 350);
  lp.connect(g); g.connect(pn); pn.connect(target); pn.connect(send); send.connect(bus.reverbIn);
  return { input: lp, release(dur) { setTimeout(() => { lp.disconnect(); pn.disconnect(); send.disconnect(); }, (dur + 4) * 1000); } };
}

function oneShot(kind, x, y, target, fn, opts, sendBase) {
  const sp = spatial(x, y, target, sendBase);
  const dur = fn(ctx, B, sp.input, ctx.currentTime + 0.01, opts || {});
  sp.release(dur);
  return dur;
}

function handle(e) {
  const t = ctx.currentTime + 0.005;
  switch (e.type) {
    case 'step': {
      if (voices.step >= LIMIT.step) return;
      // per-step root, disconnected afterwards so WebKit can free the panner graph
      const root = ctx.createGain(); root.connect(bus.steps);
      const dur = S.footstep(ctx, B, root, t, { terrain: e.terrain, weight: e.weight, foot: e.foot, cold: coldness() });
      claim('step', dur);
      setTimeout(() => root.disconnect(), (dur + 0.3) * 1000);
      return;
    }
    case 'crack': {
      if (voices.ice >= LIMIT.ice) return;
      claim('ice', oneShot('ice', e.x ?? state.player.x, e.y ?? state.player.y, bus.ice, S.crack, { strength: e.strength }, 0.4));
      return;
    }
    case 'avalanche': {
      if (voices.creature >= LIMIT.creature) return;
      // far rock face: extra reverb, quieter than creatures so it never masks the wind
      claim('creature', oneShot('creature', e.x, e.y, bus.avalanche, S.avalanche, e, 0.45));
      return;
    }
    case 'bark': case 'howl': case 'whine': case 'penguin': case 'bear': {
      if (voices.creature >= LIMIT.creature) return;
      const fn = { bark: S.bark, howl: S.howl, whine: S.whine, penguin: S.penguin, bear: S.bear }[e.type];
      claim('creature', oneShot('creature', e.x, e.y, bus.creatures, fn, e, 0.3));
      return;
    }
  }
}

function coldness() {
  const w = state.weather;
  if (typeof w.cold === 'number') return clamp(w.cold, 0, 1);
  if (typeof w.temp === 'number') return clamp((-w.temp - 5) / 30, 0, 1); // degrees C
  return 0.8; // it's Antarctica
}

function shelterNow() {
  const p = state.player;
  try { return terrain?.shelterAt ? clamp(+terrain.shelterAt(p.x, p.y) || 0, 0, 1) : 0; } catch { return 0; }
}

function updateWind(now) {
  const w = state.wind, wx = state.weather;
  // wind.angle is the direction the wind blows toward; it is heard from upwind
  const pan = -Math.cos(w.angle || 0) * 0.7;
  const intensity = clamp((w.speed ?? 0.4) + (w.gust || 0) * 0.35, 0, 1.3);
  wind.set({ intensity, speed: w.speed ?? 0.4, gust: clamp(w.gust || 0, 0, 1), pan, shelter, whiteout: clamp(wx.whiteout || 0, 0, 1), time }, ctx.currentTime + (now ? 0 : 0.02));
  // slapback: sheltered spots and nearby rock both mean a reflecting face is close
  const prox = Math.max(shelter, rockNear);
  echoProx += (prox - echoProx) * 0.1;
  if (Math.abs(echoProx - echo.last) > 0.02) {
    echo.last = echoProx;
    echo.eg.gain.setTargetAtTime(0.32 * echoProx, ctx.currentTime, 0.5);
    // set directly (a glide would warble the echo's pitch); only on real changes
    const dt = 0.4 - 0.25 * echoProx;
    if (Math.abs(dt - echo.dl.delayTime.value) > 0.03) echo.dl.delayTime.setValueAtTime(dt, ctx.currentTime);
  }
}

function updateBreath(dt) {
  const p = state.player, w = state.wind;
  let target = 0;
  if (p.moving) {
    const v = Math.hypot(p.vx, p.vy) || 1;
    const into = Math.max(0, -(p.vx * Math.cos(w.angle) + p.vy * Math.sin(w.angle)) / v) * (w.speed ?? 0.4) * (1 - shelter);
    target = 0.25 + 0.35 * (p.lean || 0) + 0.3 * into + (p.terrain === 'deep' ? 0.35 : 0);
  }
  target = clamp(target, 0, 1);
  exertion += (target - exertion) * Math.min(1, dt * (target > exertion ? 0.25 : 0.06));
  if (time < nextBreath) return;
  const period = (4.2 - 2.7 * exertion) * R(0.8, 1.2);
  const len = period * (breathIn ? 0.36 : 0.46) * R(0.8, 1.2);
  const level = 0.08 + 0.92 * exertion;
  if (claim('breath', len)) S.breath(ctx, B, bus.breath, ctx.currentTime + 0.01, { inhale: breathIn, len, level });
  nextBreath = time + (breathIn ? period * 0.42 : period * 0.58);
  breathIn = !breathIn;
}

function updateIceAmbience(dt) {
  const p = state.player;
  iceCheck -= dt;
  if (iceCheck <= 0) {
    iceCheck = 1;
    nearIce = p.terrain === 'ice' || p.terrain === 'thin';
    if (!nearIce && terrain?.terrainAt) {
      try {
        for (let i = 0; i < 8 && !nearIce; i++) {
          const a = (i / 8) * Math.PI * 2, tt = terrain.terrainAt(p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 70);
          nearIce = tt === 'ice' || tt === 'thin';
        }
      } catch { /* terrain not ready */ }
    }
    if (terrain?.terrainAt) {
      try {
        let rocks = 0;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (terrain.terrainAt(p.x + Math.cos(a) * 45, p.y + Math.sin(a) * 45) === 'rock') rocks++; }
        rockNear = Math.min(1, rocks / 4);
      } catch { rockNear = 0; }
    }
  }
  if (!nearIce) return;
  iceTimer -= dt * (p.terrain === 'thin' ? 1.8 : 1);
  if (iceTimer > 0) return;
  iceTimer = R(14, 40);
  if (voices.ice >= LIMIT.ice) return;
  const a = Math.random() * Math.PI * 2, d = R(120, 320);
  claim('ice', oneShot('ice', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, bus.ice, S.distantIce, { pan: R(-0.8, 0.8) }, 0.6));
}

export function update(dt) {
  if (!ctx || !wind || ctx.state !== 'running') return;
  time += dt;
  shelter += (shelterNow() - shelter) * Math.min(1, dt * 1.2);
  windTick -= dt;
  if (windTick <= 0) { windTick = 0.125; updateWind(false); } // 8 Hz
  tidyTick -= dt;
  if (tidyTick <= 0) { tidyTick = 4; wind.tidy(ctx.currentTime); }
  for (const e of state.events) {
    try { handle(e); } catch (err) { console.warn('[audio] event', e.type, err); }
  }
  updateBreath(dt);
  updateIceAmbience(dt);
}

// Console/test hook: NAS.audio.ctx etc.
state.audio = { get ctx() { return ctx; }, get muted() { return muted; }, setMuted, voices };
