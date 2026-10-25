// Audio: procedural wind bed, footsteps, ice, breath and distant creatures.
// The AudioContext is created in unlock(), inside the first user gesture (iOS rule).
// 'M' toggles mute. Audio suspends while the page is hidden.
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import * as S from './synth.js';

let terrain = null; // built in parallel; guard every use
import('../world/terrain.js').then(m => { terrain = m; }).catch(() => {});

let ctx = null, B = null, wind = null;
let muteGain = null, fadeGain = null, dull = null, fire = null;
let insideK = 0, popT = 0, dullF = 20000, dullSet = 20000;
const bus = {};
let muted = (() => { try { return localStorage.getItem('naso_muted') === '1'; } catch { return false; } })(), unlockedAt = -1e9;   // (remembered on this device)
let time = 0, windTick = 0, tidyTick = 4;
let echoProx = 0, rockNear = 0, echo = null;
let shelter = 0, exertion = 0, nextBreath = 0, breathIn = true;
let iceTimer = 20, iceCheck = 0, nearIce = false, nightTimer = 25, still = 0, air = null;
const voices = { step: 0, creature: 0, ice: 0, breath: 0, body: 0 };
const LIMIT = { step: 4, creature: 8, ice: 4, breath: 2, body: 4 };

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
  // dull: the world going muffled and far away as the body gives out (body.js warmth)
  dull = ctx.createBiquadFilter(); dull.type = 'lowpass'; dull.frequency.value = 20000; dull.Q.value = 0.5;
  sfx.connect(comp); comp.connect(fadeGain);
  fadeGain.connect(dull); dull.connect(muteGain); muteGain.connect(lim); lim.connect(ctx.destination);
  // the body's own sounds (chattering teeth, the heartbeat) are inside your head: not muffled
  bus.head = ctx.createGain(); bus.head.gain.value = 0.7; bus.head.connect(muteGain);
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
  air = S.createAir(ctx, B, fadeGain);
  fire = S.createFire(ctx, B, fadeGain);
  updateWind(true);
}

function setMuted(m) {
  muted = m;
  try { localStorage.setItem('naso_muted', m ? '1' : '0'); } catch { /* private mode */ }
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
      // rime: the frozen coat creaks and crackles as the body moves inside it
      const fz = state.body?.frozen || 0;
      if (fz > 0.25 && Math.random() < 0.35 * fz) S.creak(ctx, root, t + R(0.03, 0.12), 0.35 * fz);
      // limping: the hurt leg's boot drags in after the step (uneven: light step, scuff; heavy step)
      if (e.bad && e.limp > 0.1 && e.terrain !== 'rock') S.scuff(ctx, B, root, t + R(0.06, 0.12), { strength: 0.3 + 0.6 * e.limp });
      setTimeout(() => root.disconnect(), (dur + 0.3) * 1000);
      return;
    }
    case 'crack': {
      // (thin ice under stress: close and sharp; thinice.js sends strength by the stress)
      if (voices.ice >= LIMIT.ice) return;
      claim('ice', oneShot('ice', e.x ?? state.player.x, e.y ?? state.player.y, bus.ice, S.crack, { strength: e.strength }, e.stress ? 0.2 : 0.4));
      return;
    }
    // Thin ice (thinice.js): creaks as it starts to bear, a breaking slab as it goes.
    case 'creak': {
      if (voices.ice >= LIMIT.ice) return;
      claim('ice', oneShot('ice', e.x, e.y, bus.ice, (c, b, out, at, o) => S.creak(c, out, at, o.strength), { strength: 0.6 + 0.8 * (e.strength ?? 0.5) }, 0.2));
      return;
    }
    case 'breakthrough': {
      const root = ctx.createGain(); root.connect(bus.ice);
      const dur = S.breakthrough(ctx, B, root, t);
      setTimeout(() => root.disconnect(), (dur + 0.5) * 1000);
      return;
    }
    // Hurt: the landing from a height (thump, crack, grunt), a smaller knock (just the grunt).
    case 'impact': {
      const root = ctx.createGain(); root.connect(bus.steps);
      const dur = S.impact(ctx, B, root, t, { strength: e.severity, fatal: e.fatal });
      setTimeout(() => root.disconnect(), (dur + 0.3) * 1000);
      return;
    }
    case 'injury': {
      if (e.quiet || voices.body >= LIMIT.body) return;
      claim('body', S.grunt(ctx, B, bus.head, t + 0.05, { strength: 0.5 + 2 * e.amount }));
      return;
    }
    // Out of a hole in the ice: an effort grunt on each pull (and the axes biting), the edge breaking
    // off under them, sliding back in, and the scrape of the body out across the ice.
    case 'heave': {
      if (voices.body >= LIMIT.body + 1) return;
      const root = ctx.createGain(); root.connect(bus.steps);
      let dur = 0.5;
      if (e.stage === 'pull') {
        dur = S.grunt(ctx, B, bus.head, t + 0.12, { strength: 0.9 });
        if (e.axes) S.axe(ctx, B, root, t, {}); else S.splash(ctx, B, root, t, { strength: 0.6 });
      } else if (e.stage === 'break') { S.crack(ctx, B, root, t, { strength: 0.8 }); S.splash(ctx, B, root, t + 0.08, { strength: 1.1 }); dur = 1.2; }
      else if (e.stage === 'slip') dur = S.splash(ctx, B, root, t, { strength: 0.8 });
      else if (e.stage === 'out') { dur = S.scuff(ctx, B, root, t, { strength: 1 }) + S.scuff(ctx, B, root, t + 0.35, { strength: 0.8 }) + 0.4; S.breath(ctx, B, bus.head, t + 0.3, { inhale: false, len: 0.8, level: 0.9, shaky: 1 }); }
      claim('body', dur);
      setTimeout(() => root.disconnect(), (dur + 0.5) * 1000);
      return;
    }
    // On a wall: looking down past the height that kills (the wind rising, a sharp breath in); a gust
    // peeling them off (a scrape of the axes, cloth hammering, a strained breath); the axes driven
    // back in (a grunt; the two bites are 'axe' events).
    case 'vertigo': {
      S.gustSwell(ctx, B, bus.wind, t, { strength: 0.9 });
      S.breath(ctx, B, bus.head, t + 0.15, { inhale: true, len: 0.32, level: 1.2, shaky: 0.9 });
      return;
    }
    case 'peel': {
      const root = ctx.createGain(); root.connect(bus.steps);
      S.gustSwell(ctx, B, bus.wind, t, { strength: 1 });
      S.shove(ctx, B, root, t, { strength: 0.8 });
      setTimeout(() => root.disconnect(), 2000);
      return;
    }
    case 'replant': {
      // (the two axe bites come as 'axe' events)
      S.grunt(ctx, B, bus.head, t + 0.05, { strength: 0.9 });
      return;
    }
    case 'splint': {
      if (voices.body >= LIMIT.body) return;
      if (e.stage === 'wrap') claim('body', S.wrap(ctx, B, bus.steps, t, { strength: 0.55 }));
      else if (e.stage === 'start') claim('body', S.rustle(ctx, B, bus.steps, t, { strength: 0.5 }));
      else if (e.stage === 'done') claim('body', S.wrap(ctx, B, bus.steps, t, { strength: 0.7, tight: true }));
      return;
    }
    case 'axe': case 'kick': case 'shove': case 'fall': {
      if (voices.body >= LIMIT.body) return;
      const root = ctx.createGain(); root.connect(bus.steps);
      const dur = { axe: S.axe, kick: S.kick, shove: S.shove, fall: S.fall }[e.type](ctx, B, root, t, e);
      claim('body', dur);
      setTimeout(() => root.disconnect(), (dur + 0.3) * 1000);
      if (e.type === 'fall' && !e.fatal) { exertion = 1; nextBreath = time + dur; }       // winded
      if (e.type === 'shove') { exertion = Math.min(1, exertion + 0.3); nextBreath = time + 0.8; }
      return;
    }
    case 'chatter': {
      if (voices.body >= LIMIT.body) return;
      claim('body', S.chatter(ctx, B, bus.head, t, e));
      return;
    }
    case 'splash': {
      if (voices.step >= LIMIT.step) return;
      claim('step', oneShot('step', e.x, e.y, bus.steps, S.splash, e, 0.15));
      return;
    }
    case 'plunge': {
      const root = ctx.createGain(); root.connect(bus.steps);
      const dur = S.plunge(ctx, B, root, t, e);
      setTimeout(() => root.disconnect(), (dur + 0.3) * 1000);
      exertion = 1; nextBreath = time + dur;
      return;
    }
    // Exhaustion (explorer.js times the panting): ragged breaths whose rate follows energy,
    // close up (not spatial); a heavy breath out on stopping, bent double; a
    // long groaning one dropping into the snow, spent.
    case 'pant': {
      const k = clamp(e.strength ?? 0.5, 0, 1);
      if (voices.breath >= LIMIT.breath + 1) return;
      const len = clamp((e.len || 0.6) * (e.inhale ? 0.8 : 0.95), 0.25, 1.6) * R(0.9, 1.1);
      const level = (0.35 + 0.75 * k) * (e.inhale ? 0.85 : 1) * (1 + 0.5 * shelter);
      claim('breath', len);
      S.breath(ctx, B, bus.breath, t, { inhale: !!e.inhale, len, level, shaky: 0.25 + 0.6 * k, rasp: k, dry: state.body?.thirst || 0 });
      return;
    }
    case 'rest': case 'tired': {
      const big = e.type === 'tired';
      const root = ctx.createGain(); root.connect(bus.breath);
      S.breath(ctx, B, root, t, { inhale: false, len: big ? 1.3 : 0.95, level: big ? 1.5 : 1.25, shaky: 0.5, rasp: 1 });
      if (big) S.slump(ctx, B, bus.steps, t + 0.2, { strength: 0.6 });   // down into the snow
      setTimeout(() => root.disconnect(), 2500);
      return;
    }
    case 'drip': {
      if (voices.ice >= LIMIT.ice) return;
      claim('ice', S.drip(ctx, B, bus.steps, t));
      return;
    }
    case 'gust': {
      // a gust across the camp as the next member's world opens up
      S.gustSwell(ctx, B, bus.wind, t, e);
      return;
    }
    case 'heartbeat': {
      S.heartbeat(ctx, B, bus.head, t, e);
      return;
    }
    case 'avalanche': {
      if (voices.creature >= LIMIT.creature) return;
      // far rock face: extra reverb, quieter than creatures so it never masks the wind
      claim('creature', oneShot('creature', e.x, e.y, bus.avalanche, S.avalanche, e, 0.45));
      return;
    }
    // The pack (ui/pack.js): things moved between the pack and the sled / a body / the snow,
    // dropped, picked up; a refusal when there's no room; eating; an empty stomach (explorer.js).
    case 'transfer': case 'pickup': case 'drop': {
      if (voices.body >= LIMIT.body) return;
      claim('body', S.rustle(ctx, B, bus.steps, t, { strength: 0.6, thud: e.type !== 'pickup' }));
      return;
    }
    // The pup tent (puptent.js): canvas rustled out and spread, a pole stood up, the stakes driven in
    // (a thud each), the wind taking it (the canvas cracking and flapping, the poles going over);
    // a strike pulls the stakes; close by, a pitched one cracks in the wind (from inside: close and loud).
    case 'pitch': case 'strike': {
      if (voices.body >= LIMIT.body) return;
      const st = e.stage;
      let fn = null, o = {};
      if (st === 'start' || st === 'stop') { fn = S.rustle; o = { strength: st === 'start' ? 0.55 : 0.35 }; }
      else if (st === 'spread') { fn = S.rustle; o = { strength: 0.9, thud: true }; }
      else if (st === 'poles') { fn = S.pole; o = { strength: 0.7 }; }
      else if (st === 'stake') { fn = S.stake; o = { strength: R(0.5, 0.8) }; }
      else if (st === 'collapse') { fn = S.canvas; o = { strength: 0.75 + 0.4 * (e.strength ?? 0.6), poles: true }; }
      else if (st === 'pull') { fn = S.pull; o = { strength: 0.7 }; }
      else if (st === 'done') { fn = e.type === 'pitch' ? S.stake : S.rustle; o = e.type === 'pitch' ? { strength: 0.9 } : { strength: 0.8, thud: true }; }
      if (fn) claim('body', oneShot('body', e.x, e.y, bus.steps, fn, o, 0.12));
      return;
    }
    case 'flap': {
      if (voices.body >= LIMIT.body) return;
      if (e.inside) claim('body', S.canvas(ctx, B, bus.steps, t, { strength: 0.55 * (e.strength ?? 0.5) }));
      else claim('body', oneShot('body', e.x, e.y, bus.steps, S.canvas, { strength: 0.6 * (e.strength ?? 0.5) }, 0.2));
      return;
    }
    case 'full': {
      if (voices.body >= LIMIT.body) return;
      claim('body', S.refuse(ctx, B, bus.steps, t));
      return;
    }
    case 'eat': {
      if (voices.body >= LIMIT.body) return;
      if (e.stage === 'chew') claim('body', S.chew(ctx, B, bus.head, t, { strength: 0.55 }));
      else if (e.stage === 'start') claim('body', S.rustle(ctx, B, bus.steps, t, { strength: 0.45 }));
      return;
    }
    // Thirst: the flask's cap turned, the gulps of water; a mittful of snow scooped and crunched;
    // in the head (not muffled), the dry swallow, the faint high ring, a slow pained breath out with
    // the headache (explorer.js); and the Third Man's footstep a beat behind your own, faint, from
    // where he walks (fx/thirst.js).
    case 'drink': {
      if (voices.body >= LIMIT.body) return;
      if (e.stage === 'start') claim('body', S.unscrew(ctx, B, bus.steps, t, { strength: 0.6 }));
      else if (e.stage === 'gulp') claim('body', S.swallow(ctx, B, bus.head, t, { strength: 0.8, wet: true }));
      else if (e.stage === 'done') claim('body', S.unscrew(ctx, B, bus.steps, t + 0.1, { strength: 0.4 }));
      return;
    }
    case 'snowEat': {
      if (voices.body >= LIMIT.body) return;
      if (e.stage === 'start') claim('body', S.rustle(ctx, B, bus.steps, t, { strength: 0.35 }));
      else if (e.stage === 'scoop') claim('body', S.scoop(ctx, B, bus.steps, t, { strength: 0.7 }));
      else if (e.stage === 'chew') claim('body', S.chew(ctx, B, bus.head, t, { strength: 0.4 }));
      return;
    }
    case 'thirst': {
      if (voices.body >= LIMIT.body + 1) return;
      if (e.stage === 'ring') claim('body', Math.min(2, S.tinnitus(ctx, B, bus.head, t, e)));
      else if (e.stage === 'swallow') claim('body', S.swallow(ctx, B, bus.head, t, e));
      else if (e.stage === 'head' && claim('breath', 1.4)) S.breath(ctx, B, bus.breath, t + 0.3, { inhale: false, len: 1.3, level: 0.7 + 0.4 * (e.strength ?? 0.5), shaky: 0.6, dry: state.body?.thirst || 0 });
      return;
    }
    case 'thirdman': {
      // he comes apart as he's looked at: a faint hush, like a breath let go, from where he was
      if (e.stage === 'out' && e.dissolved && claim('breath', 1.3)) { oneShot('breath', e.x, e.y, bus.breath, S.breath, { inhale: false, len: 1.2, level: 0.45 }, 0.6); return; }
      if (e.stage !== 'step' || voices.step >= LIMIT.step) return;
      const g = ctx.createGain(); g.gain.value = clamp(e.strength ?? 0.35, 0, 0.6);
      g.connect(bus.steps);
      claim('step', oneShot('step', e.x, e.y, g, S.footstep, { terrain: e.terrain || 'snow', weight: 0.35, cold: coldness() }, 0.5));
      setTimeout(() => g.disconnect(), 3000);
      return;
    }
    case 'growl': {
      if (voices.body >= LIMIT.body) return;
      const dur = S.growl(ctx, B, bus.head, t, e);
      claim('body', dur);
      // the wind ducks under it, so it's heard even in a storm
      const g = bus.wind.gain, base = S.MIX.wind;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(base * 0.4, t + 0.2); g.setTargetAtTime(base, t + dur * 0.8, 0.35);
      return;
    }
    case 'bark': case 'howl': case 'whine': case 'penguin': case 'bear': {
      // (the bear's attack voices go through even with the creature voices full: they matter)
      const big = e.type === 'bear' && e.kind !== 'huff' && e.kind !== 'growl';
      if (voices.creature >= LIMIT.creature + (big ? 3 : 0)) return;
      const fn = { bark: S.bark, howl: S.howl, whine: S.whine, penguin: S.penguin, bear: big ? S.bearAct : S.bear }[e.type];
      const dur = oneShot('creature', e.x, e.y, bus.creatures, fn, e, 0.3);
      claim('creature', dur);
      // the warning and the charge: the wind ducks under them, so they're heard in a storm
      if (big && (e.kind === 'warn' || e.kind === 'roar' || e.kind === 'maul')) {
        const g = bus.wind.gain, base = S.MIX.wind;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(base * 0.35, t + 0.15); g.setTargetAtTime(base, t + dur * 0.8, 0.4);
      }
      return;
    }
    // the rifle (hunt.js): the shot is loud and right here; its echo comes back off the ice (in the voice)
    case 'rifle': {
      const root = ctx.createGain(); root.gain.value = e.stage === 'shot' ? 1.1 : 0.7; root.connect(bus.steps);
      if (e.stage === 'shot') { const s2 = ctx.createGain(); s2.gain.value = 0.35; root.connect(s2); s2.connect(bus.reverbIn); setTimeout(() => s2.disconnect(), 3000); }
      const dur = S.rifle(ctx, B, root, t, e);
      setTimeout(() => root.disconnect(), (dur + 0.5) * 1000);
      if (e.stage === 'shot') {
        const g = bus.wind.gain, base = S.MIX.wind;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(base * 0.3, t + 0.02); g.setTargetAtTime(base, t + 0.6, 0.5);
      }
      return;
    }
    case 'flare': case 'butcher': {
      const root = ctx.createGain(); root.gain.value = 0.9; root.connect(bus.steps);
      const dur = (e.type === 'flare' ? S.flare : S.butcher)(ctx, B, root, t, e);
      setTimeout(() => root.disconnect(), (dur + 0.4) * 1000);
      return;
    }
  }
}

function coldness() {
  const w = state.weather;
  if (typeof w.cold === 'number') return clamp((w.cold - 0.3) / 0.4, 0, 1); // squeak: none below 0.3, full at 0.7
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
  const cower = state.player.mode === 'cower' ? 1 : 0;
  wind.set({ still, cower, intensity, speed: w.speed ?? 0.4, gust: clamp(w.gust || 0, 0, 1), pan, shelter, whiteout: clamp(wx.whiteout || 0, 0, 1), time }, ctx.currentTime + (now ? 0 : 0.02));
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
  // hidden in the tent, dead, or gone: no breathing to hear
  if (p.mode === 'inside' || p.mode === 'tent-in' || p.mode === 'collapse' || p.mode === 'dead' || p.mode === 'gone') { exertion = 0; return; }
  let target = 0;
  if (p.mode === 'climb') target = 0.8;
  else if (p.mode === 'down') target = 0.85;
  else if (p.mode === 'cower') target = 0.45;
  else if (p.moving) {
    const v = Math.hypot(p.vx, p.vy) || 1;
    const into = Math.max(0, -(p.vx * Math.cos(w.angle) + p.vy * Math.sin(w.angle)) / v) * (w.speed ?? 0.4) * (1 - shelter);
    target = 0.25 + 0.35 * (p.lean || 0) + 0.3 * into + (p.terrain === 'deep' ? 0.35 : 0);
  }
  target = clamp(Math.max(target, 0.7 * (state.body?.shock || 0), p.mode === 'swim' ? 0.95 : 0), 0, 1);
  exertion += (target - exertion) * Math.min(1, dt * (target > exertion ? 0.25 : 0.06));
  if (time < nextBreath) return;
  // panting: explorer.js sends every breath as a 'pant' event, in time with the clouds
  if ((p.pant || 0) >= 0.22 && p.mode !== 'swim') { nextBreath = time + 0.25; return; }
  const period = (4.2 - 2.7 * exertion) * R(0.8, 1.2);
  const len = period * (breathIn ? 0.36 : 0.46) * R(0.8, 1.2);
  // in the lee, with the wind gone, your own breathing comes forward
  const level = (0.08 + 0.92 * exertion) * (1 + 0.8 * shelter);
  const shock = state.body?.shock || 0;               // the cold-water gasp: ragged for a while
  const shaky = Math.max(p.mode === 'cower' ? 0.8 : 0, shock);
  // thirsty: a dry, rasping breath, and nearer (heard over the wind once it's bad)
  const dry = state.body?.thirst || 0;
  if (claim('breath', len)) S.breath(ctx, B, bus.breath, ctx.currentTime + 0.01, { inhale: breathIn, len, level: level * (1 + 0.6 * dry), shaky, dry });
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
  // calm, cold nights: the ice contracts; distant booms and creaks come from far lakes
  if (still > 0.3) {
    nightTimer -= dt * still;
    if (nightTimer <= 0) {
      nightTimer = R(18, 45);
      const a = Math.random() * Math.PI * 2, d = R(250, 450);
      if (Math.random() < 0.6) { if (voices.ice < LIMIT.ice) claim('ice', oneShot('ice', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, bus.ice, S.distantIce, { pan: R(-0.8, 0.8) }, 0.6)); }
      else oneShot('ice', p.x + Math.cos(a) * d * 0.5, p.y + Math.sin(a) * d * 0.5, bus.ice, (c, b, o, t) => S.creak(c, o, t, 0.8), {}, 0.5);
    }
  }
  if (!nearIce) return;
  iceTimer -= dt * (p.terrain === 'thin' ? 1.8 : 1) * (1 + 1.5 * still);
  if (iceTimer > 0) return;
  iceTimer = R(14, 40);
  if (voices.ice >= LIMIT.ice) return;
  const a = Math.random() * Math.PI * 2, d = R(120, 320);
  claim('ice', oneShot('ice', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, bus.ice, S.distantIce, { pan: R(-0.8, 0.8) }, 0.6));
}

export function update(dt) {
  if (!ctx || !wind || ctx.state !== 'running') return;
  time += dt;
  // in the tent: the wind drops to a muffled roar on the canvas and the stove crackles
  const m = state.player.mode;
  // (the pup tent keeps less of the storm out: player.shelter.muffle; its stove is smaller too)
  insideK += ((m === 'inside' ? (state.player.shelter?.muffle ?? 1) : 0) - insideK) * Math.min(1, dt * 1.2);
  fire?.set(0.32 * insideK * (state.body?.phase === 'sleep' ? 0.3 : 1), ctx.currentTime);
  popT -= dt;
  if (insideK > 0.2 && popT <= 0) {
    popT = R(0.08, 0.7);
    S.pop(ctx, B, fadeGain, ctx.currentTime + 0.01, { level: 0.22 * insideK });
  }
  // near death everything but the body's own sounds goes dull and far away
  const bd = state.body, w = bd ? bd.warmth : 1, ph = bd?.phase;
  const dTarget = ph === 'dying' || ph === 'iris' ? 380 : ph === 'black' || ph === 'over' ? 900
    : m === 'inside' ? 20000 : 20000 * Math.pow(clamp(w / 0.3, 0.04, 1), 2.2);
  dullF += (dTarget - dullF) * Math.min(1, dt * 1.5);
  if (Math.abs(dullF - dullSet) > dullSet * 0.03) { dullSet = dullF; dull.frequency.setTargetAtTime(Math.max(300, dullF), ctx.currentTime, 0.1); }
  const sh = Math.max(shelterNow(), clamp(+state.player.sheltered || 0, 0, 1), insideK);
  shelter += (sh - shelter) * Math.min(1, dt * 1.5);
  // stillness: night x calm wind x cold
  const night = clamp(+(state.lighting?.night) || 0, 0, 1), wsp = state.wind.speed ?? 0.4;
  const cold = typeof state.weather.cold === 'number' ? clamp(state.weather.cold, 0, 1) : 0.7;
  const stillT = night * clamp(1 - (wsp - 0.1) / 0.3, 0, 1) * (1 - (state.weather.whiteout || 0)) * (0.5 + 0.5 * cold);
  still += (stillT - still) * Math.min(1, dt * 0.3);
  air?.set(still, time, ctx.currentTime);
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
// out: the mute stage, for other modules' own graphs (the radio, the recorder hiss) so Sound: off silences them too
state.audio = { get ctx() { return ctx; }, get muted() { return muted; }, get out() { return muteGain || null; }, setMuted, voices };
