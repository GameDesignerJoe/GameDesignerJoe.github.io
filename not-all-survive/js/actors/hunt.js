// The bear slice's tools in the hand (Joe, slice 7): the flare, the rifle, and what's shot: carcasses and
// butchering them for meat. (The bear's own attack is wildlife-bear.js; the items are items.js; the pack
// routes the taps: ui/pack.js.)
//
// The flare (two on the sled): tapped in the pack, the explorer strikes it at the chest (STRIKE_S) and holds
// it up high: a fizzing signal-yellow fire throwing sparks, a trail of smoke downwind, for FLARE_S. A bear
// within FLARE_R of it flees (wildlife-bear.js scareBear). By night it lights the snow round them
// (state.lights). Anything that needs both hands (the rifle, the pack, butchering, a knockdown, a tent)
// and it's stuck upright in the snow where they stand, burning on there.
//
// The rifle (one on the sled, with ten cartridges, five to a slot): tapped in the pack, the explorer raises
// it (aim mode, RAISE_S) and turns onto the nearest animal in front of them within RANGE (the facing arc,
// else the nearest anywhere in range): a small inked bracket round it (drawOverlay: no crosshair, no
// numbers), swaying with how unsteady the shot is. A tap anywhere fires (a tap on another animal switches
// to it; a tap on the explorer, the movement keys or the stick lower it; touch: a tap on the stick half of
// the screen fires, a drag there lowers it). Keys: R raises / lowers, Space fires, F strikes a flare.
// Each shot takes a cartridge: a crack and its echo off the ice, a muzzle flash, smoke, the bolt worked
// (CYCLE_S between shots); none left: a dry click. Hit chance (hitChance): falls with distance (0.97 at 15
// down to ~0.3 at 140), the wind on them (to -35%), cold hands (to -40% as warmth goes 0.65 -> 0.15), being
// blown and hurt, a snap shot (to -25% under ~1 s on aim), the target (a bear is big, a penguin small; a
// charging bear fast). A miss kicks up snow by the target. Hits: the bear ~3 (wounded it flees or charges
// harder), a penguin or a dog 1. Every shot scatters the penguins round about; the dogs whine and cower at
// the raised rifle (and long after a shot).
//
// Carcasses stay where they fell (state.hunt.carcasses, drawn by their owners: the bear by wildlife.js, the
// dogs by camp.js, the penguins here), the snow under them a shade darker. A press on one (Space / E by it)
// brings up a round-slot row over it (ui/pack.js): Butcher. The explorer kneels at it BUTCHER_S (the dig bar
// fills; walking off stops it, nothing lost) and it gives meat (MEAT: penguin 1, dog 3, bear 6) into the
// pack as far as it goes; the rest is left in a pile on the snow by it (items.js dropAt: a container).
// Raw meat (items.js): eaten from the pack, or cooked in a tent (the tent menu's Cook).
//
// state.hunt = { aim: { t, tgt: { kind, ref }, dir, swayX, swayZ, chance, kick } | null, strikeT, held,
//   flares: [{ x, y, t, held, out }], job: { kind: 'butcher', t, dur, x, y, c } | null, carcasses: [{ kind,
//   ref, x, y, meat, done, t }], stats: { shots, hits } } (explorer.js reads aim, strikeT, held and job)
// Events: rifle { stage: 'raise'|'lower'|'shot'|'bolt'|'dry', hit?, kind?, d? }, flare { stage: 'strike'|
//   'lit'|'burn'|'out' }, butcher { stage: 'start'|'cut'|'done'|'stop' }.
// Hooks: NAS.gun = { state, aim(), fire(), lower(), flare(), chance(), chanceAt(d, opts), target(kind), butcher() (the nearest
//   carcass in reach, at once), carcasses }, NAS.giveRifle() (the rifle and five cartridges into the pack),
//   NAS.giveFlare().
import { state } from '../state.js';
import { worldToScreen, screenToWorld, visibleRect } from '../camera.js';
import { SIGNAL } from '../palette.js';
import { find, take, add, room, dropAt } from '../items.js';
import { theBear, herd, killPenguin, hearShot, drawPenguin } from './wildlife.js';
import { hitBear, scareBear, BEAR } from './wildlife-bear.js';
import { campDogs, killDog } from './camp.js';

const RANGE = 140, ARC = 1.15, RAISE_S = 0.45, CYCLE_S = 1.25, BOLT_AT = 0.5;
const FLARE_S = 20, STRIKE_S = 0.9, FLARE_R = BEAR.FLARE_R;
const BUTCHER_S = 6, REACH = 14;
export const MEAT = { penguin: 1, dog: 3, bear: 6 };
const KY = 0.8, TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

const P = state.player;
const H = state.hunt = { aim: null, strikeT: 0, held: false, flares: [], job: null, carcasses: [], stats: { shots: 0, hits: 0 }, next: 0, boltAt: 0, wantFire: 0 };
const fx = [];                  // smoke, sparks, snow kicked up by a miss: { kind, x, y, z, vx, vy, vz, r, age, life }
let flash = null;               // the muzzle flash: { x, y, ux, uy, t }
let lastStick = 0;

const ev = (type, stage, extra) => state.events.push({ type, stage, x: P.x, y: P.y, ...extra });
const alive = () => !state.body || state.body.phase === 'alive';
const bearNear = () => { const b = theBear(); return !!b && b.threat && Math.hypot(b.x - P.x, b.y - P.y) < 60; };

// --- what can be shot ------------------------------------------------------------------------------------
// { kind, ref, x, y (feet), h (height, for the bracket), w (width) }
function animals() {
  const out = [];
  const b = theBear();
  if (b && !b.dead && !b.gone) out.push({ kind: 'bear', ref: b, x: b.x, y: b.y, h: b.swim ? 6 : 12, w: 20 });
  for (const g of herd()) for (const m of g.members) out.push({ kind: 'penguin', ref: m, x: m.x, y: m.y, h: 6.4 * m.s, w: 4.6 });
  for (const d of campDogs) if (!d.dead) out.push({ kind: 'dog', ref: d, x: d.x, y: d.y, h: 6, w: 9.5 });
  return out;
}
// the live view of a target held by reference (null once it's dead or gone)
function live(t) {
  if (!t) return null;
  const r = t.ref;
  if (t.kind === 'bear') return r.dead || r.gone ? null : { kind: 'bear', ref: r, x: r.x, y: r.y, h: r.swim ? 6 : 12, w: 20 };
  if (t.kind === 'penguin') return r.dead ? null : { kind: 'penguin', ref: r, x: r.x, y: r.y, h: 6.4 * r.s, w: 4.6 };
  return r.dead ? null : { kind: 'dog', ref: r, x: r.x, y: r.y, h: 6, w: 9.5 };
}
// the nearest in front of them (the facing arc) within range, else the nearest anywhere in range
function pickTarget() {
  let best = null, bs = 1e9;
  for (const a of animals()) {
    const d = Math.hypot(a.x - P.x, a.y - P.y);
    if (d > RANGE) continue;
    const off = Math.abs(wrapPi(Math.atan2((a.y - P.y) / KY, a.x - P.x) - P.facing));
    const s = d + (off > ARC ? 1000 : 0);
    if (s < bs) { bs = s; best = a; }
  }
  return best ? { kind: best.kind, ref: best.ref } : null;
}

// How likely a shot at a hits now (0..1). Distance, the wind on them, cold hands, blown, hurt, a snap shot,
// the size and speed of the target. (opts override the explorer's state: for measuring.)
export function hitChance(a, o = {}) {
  const B = state.body;
  const d = o.d ?? Math.hypot(a.x - P.x, a.y - P.y);
  const warmth = o.warmth ?? (B ? B.warmth : 1), wind = o.wind ?? clamp(P.exposure || 0);
  const held = o.held ?? (H.aim ? H.aim.t : 2);
  let p = clamp(1.0 - (d - 15) / 180, 0.18, 0.97);
  p *= 1 - 0.35 * wind;
  p *= 1 - 0.4 * smooth(0.65, 0.15, warmth);
  p *= 1 - 0.15 * clamp(o.pant ?? (P.pant || 0));
  p *= 1 - 0.1 * clamp(o.injury ?? (B?.injury || 0));
  p *= lerp(0.75, 1, smooth(0.35, 1.3, held));
  const kind = o.kind ?? a.kind;
  p *= kind === 'bear' ? 1.1 : kind === 'penguin' ? 0.85 : 1;
  if (kind === 'bear') p *= 1 - 0.2 * clamp((o.speed ?? a.ref?.speed ?? 0) / 30);
  return clamp(p, 0.05, 0.97);
}

// --- aiming and firing ------------------------------------------------------------------------------------
export const aiming = () => !!H.aim;
// Raise the rifle (from the pack). False if it can't be (busy, burdened, in the water, sat spent...).
export function startAim() {
  if (H.aim || P.mode !== 'walk' || P.spent || P.water?.level || state.burden?.mode || H.job || H.strikeT > 0 || !alive()) return false;
  if (H.held) plantFlare();
  H.aim = { t: 0, tgt: pickTarget(), dir: P.facing, swayX: 0, swayZ: 0, chance: 0, kick: 0, mx: 0, my: 0 };
  ev('rifle', 'raise');
  return true;
}
export function lowerAim() {
  if (!H.aim) return;
  H.aim = null; H.wantFire = 0;
  ev('rifle', 'lower');
}
// A press while aiming (ui/pack.js): on the explorer lowers it; on another animal switches to it; anywhere
// else fires.
export function aimPress(sx, sy, onPlayer) {
  if (!H.aim) return false;
  if (onPlayer) { lowerAim(); return true; }
  const w = screenToWorld(sx, sy), z = state.cam.zoom || 1;
  let hit = null, hd = 1e9;
  for (const a of animals()) {
    const d = Math.hypot(w.x - a.x, (w.y - (a.y - a.h * 0.45)) * 1.1);
    if (d < Math.max(a.w * 0.6, 12 / z) && d < hd && Math.hypot(a.x - P.x, a.y - P.y) < RANGE + 10) { hd = d; hit = a; }
  }
  if (hit && (!H.aim.tgt || H.aim.tgt.ref !== hit.ref)) { H.aim.tgt = { kind: hit.kind, ref: hit.ref }; H.aim.t = Math.min(H.aim.t, RAISE_S); return true; }
  H.wantFire = state.time;
  return true;
}
function fire() {
  const A = H.aim;
  const ci = find(state.pack, 'cartridges');
  if (ci < 0) { H.next = state.time + 0.45; ev('rifle', 'dry'); return; }
  take(state.pack, ci, 1);
  H.next = state.time + CYCLE_S; H.boltAt = state.time + BOLT_AT;
  const tg = live(A.tgt);
  const d = tg ? Math.hypot(tg.x - P.x, tg.y - P.y) : 0;
  const p = tg ? hitChance(tg) : 0, hit = !!tg && Math.random() < p;
  H.stats.shots++; if (hit) H.stats.hits++;
  // the flash at the muzzle, smoke off it
  const m = P.muzzleAt || { x: P.x + Math.cos(A.dir) * 7, y: P.y + Math.sin(A.dir) * 7 * KY - 10 };
  const ux = Math.cos(A.dir), uy = Math.sin(A.dir) * KY;
  flash = { x: m.x, y: m.y, ux, uy, t: 0 };
  for (let i = 0; i < 4; i++) fx.push({ kind: 'smoke', x: m.x + ux * (1 + i * 0.7), y: m.y + uy * (1 + i * 0.7), z: 0, vx: ux * (5 + 2 * i) + (Math.random() - 0.5), vy: uy * (5 + 2 * i) - 2.5, vz: 0, r: 0.45 + i * 0.12, age: 0, life: 0.8 + Math.random() * 0.4 });
  A.kick = 1; A.t = Math.min(A.t, 0.25);
  ev('rifle', 'shot', { hit, kind: tg?.kind, d: Math.round(d), p: +p.toFixed(2) });
  hearShot(P.x, P.y);
  for (const dg of campDogs) if (!dg.dead && Math.hypot(dg.x - P.x, dg.y - P.y) < 200) dg.cowerT = Math.max(dg.cowerT || 0, 14);
  const b = theBear();
  if (hit) applyHit(tg);
  else {
    // the bullet kicks up snow by the target (or out ahead, shooting at nothing)
    const tx = tg ? tg.x + (Math.random() - 0.5) * 10 : P.x + ux * 60, ty = tg ? tg.y + (Math.random() - 0.5) * 6 : P.y + uy * 60;
    for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 3; fx.push({ kind: 'snow', x: tx, y: ty, z: 0.2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * KY, vz: 3 + Math.random() * 5, r: 0.25 + Math.random() * 0.25, age: 0, life: 0.5 + Math.random() * 0.4 }); }
  }
  // a bear close enough to hear it and not hit: it runs, or it's riled
  if (b && !b.dead && !b.swim && !(hit && tg.kind === 'bear') && Math.hypot(b.x - P.x, b.y - P.y) < 160 && b.st !== 'charge') {
    if (Math.random() < 0.5) scareBear(b, P.x, P.y); else b.aggro = Math.min(1.2, b.aggro + 0.35);
  }
}
function applyHit(tg) {
  if (tg.kind === 'bear') { if (hitBear(tg.ref, P.x, P.y) === 'dead') addCarcass('bear', tg.ref); }
  else if (tg.kind === 'penguin') { const m = killPenguin(tg.ref); if (m) addCarcass('penguin', m); }
  else if (killDog(tg.ref)) addCarcass('dog', tg.ref);
}
function addCarcass(kind, ref) {
  H.carcasses.push({ kind, ref, x: ref.x, y: ref.y, meat: MEAT[kind], done: false, t: state.time });
}

// --- the flare --------------------------------------------------------------------------------------------
// Strike one (from pack slot i). False if one's already in hand (or being struck), or in a tent.
export function strikeFlare(i) {
  const s = state.pack.slots[i];
  if (!s || s.id !== 'flare' || H.strikeT > 0 || H.held || !alive() || P.water?.level) return false;
  if (!['walk', 'cower', 'refuse'].includes(P.mode)) return false;
  if (H.aim) lowerAim();
  take(state.pack, i, 1);
  H.strikeT = STRIKE_S;
  ev('flare', 'strike');
  return true;
}
// Stuck upright in the snow beside them (both hands needed, or they're down): it burns on there.
function plantFlare() {
  const f = H.flares.find(q => q.held);
  H.held = false;
  if (!f) return;
  f.held = false;
  const c = Math.cos(P.facing), s = Math.sin(P.facing);
  f.x = P.x - s * 3; f.y = P.y + c * 3 * KY + 0.5;
}
function flareHead(f) {
  if (f.held) return P.flareAt || { x: P.x, y: P.y - 19 };
  return { x: f.x + 0.4, y: f.y - 2.4 };
}

// --- carcasses and butchering -----------------------------------------------------------------------------
export const HUNT_ACTS = ['butcher'];
export const huntActName = () => 'Butcher';
export function huntActWhy(id, c) {
  if (!c || c.done) return 'nothing left on it';
  if (bearNear()) return 'not with the bear here';
  return '';
}
export function huntDoAct(id, c) {
  if (huntActWhy(id, c)) return;
  if (H.aim) lowerAim();
  if (H.held) plantFlare();
  const p = carcassPos(c);
  H.job = { kind: 'butcher', t: 0, dur: BUTCHER_S, x: p.x, y: p.y, c, cutT: 0.6 };
  ev('butcher', 'start');
}
export const huntBusy = () => !!H.job;
export function carcassPos(c) { return c.kind === 'penguin' || c.done ? { x: c.x, y: c.y } : { x: c.ref.x, y: c.ref.y }; }
// a press at world (x, y), screen zoom z: on a carcass with something left on it?
export function carcassAt(x, y, z = 1) {
  let best = null, bd = 1e9;
  for (const c of H.carcasses) {
    if (c.done) continue;
    const p = carcassPos(c), r = c.kind === 'bear' ? 9 : c.kind === 'dog' ? 5 : 3;
    const d = Math.hypot(x - p.x, (y - (p.y - r * 0.4)) * 1.2);
    if (d < Math.max(r, 11 / z) && d < bd) { bd = d; best = c; }
  }
  return best;
}
export const carcassDist = c => { const p = carcassPos(c); return Math.hypot(P.x - p.x, P.y - p.y); };
export const CARCASS_REACH = REACH;
function stopJob() {
  if (H.job) ev('butcher', 'stop');
  H.job = null;
}
function finishButcher() {
  const c = H.job.c, p = carcassPos(c);
  H.job = null;
  const n = c.meat, fit = Math.min(n, room(state.pack, 'meat'));
  if (fit > 0) add(state.pack, 'meat', fit);
  if (n - fit > 0) dropAt(p.x + 3, p.y + 2.5, 'meat', n - fit);
  c.meat = 0; c.done = true; c.x = p.x; c.y = p.y;
  if (c.kind !== 'penguin') c.ref.gone = true;
  ev('butcher', 'done', { n, fit });
  if (fit > 0) state.events.push({ type: 'pickup', id: 'meat', n: fit, x: P.x, y: P.y });
}

// --- the frame --------------------------------------------------------------------------------------------
export function init() {
  addEventListener('keydown', e => {
    if (e.repeat || (!state.begun && !state.params.has('autostart'))) return;
    if (e.code === 'KeyR') {
      if (H.aim) lowerAim();
      else if (find(state.pack, 'rifle') >= 0 && (state.compass?.phase || 'idle') === 'idle') startAim();
    } else if (e.code === 'Space' && H.aim) H.wantFire = state.time;
    else if (e.code === 'KeyF' && !H.aim) { const i = find(state.pack, 'flare'); if (i >= 0) strikeFlare(i); }
  });
  window.NAS.gun = {   // (not NAS.hunt: NAS === state, and state.hunt is the state above)
    state: H,
    aim: () => startAim(),
    fire: () => { if (!H.aim) startAim(); if (H.aim) { H.aim.t = Math.max(H.aim.t, RAISE_S); H.next = 0; fire(); } },
    lower: () => lowerAim(),
    flare: () => { let i = find(state.pack, 'flare'); if (i < 0) { add(state.pack, 'flare', 1); i = find(state.pack, 'flare'); } return strikeFlare(i); },
    chance: () => { const t = H.aim && live(H.aim.tgt); return t ? +hitChance(t).toFixed(3) : null; },
    chanceAt: (d, o = {}) => +hitChance({ kind: o.kind || 'bear', ref: { speed: o.speed || 0 } }, { d, ...o }).toFixed(3),
    target: kind => { if (!H.aim) return null; const a = animals().filter(q => q.kind === kind && Math.hypot(q.x - P.x, q.y - P.y) < RANGE).sort((p, q) => Math.hypot(p.x - P.x, p.y - P.y) - Math.hypot(q.x - P.x, q.y - P.y))[0]; if (a) H.aim.tgt = { kind: a.kind, ref: a.ref }; return a ? a.kind : null; },
    butcher: () => { const c = H.carcasses.filter(q => !q.done).sort((a, b) => carcassDist(a) - carcassDist(b))[0]; if (c) huntDoAct('butcher', c); return !!c; },
    get carcasses() { return H.carcasses; },
  };
  window.NAS.giveRifle = () => { if (find(state.pack, 'rifle') < 0) add(state.pack, 'rifle', 1); return add(state.pack, 'cartridges', 5); };
  window.NAS.giveFlare = () => add(state.pack, 'flare', 1);
}

export function update(dt) {
  const inp = state.input, ph = state.compass?.phase || 'idle';
  // --- the flare: struck, then held up burning (or stuck in the snow) --------------------------------------
  if (H.strikeT > 0) {
    H.strikeT -= dt;
    if (!alive() || !['walk', 'cower', 'refuse', 'approach'].includes(P.mode)) H.strikeT = 0;   // (knocked down mid-strike: it's lost)
    else if (H.strikeT <= 0) { H.strikeT = 0; H.held = true; H.flares.push({ x: P.x, y: P.y, t: 0, held: true, out: false, fizzT: 0 }); ev('flare', 'lit'); }
  }
  if (H.held) {
    const busy = H.aim || (ph !== 'idle' && ph !== 'out') || H.job || state.burden?.job || state.pup?.job;
    if (busy || !alive() || P.spent || !['walk', 'cower', 'refuse', 'approach'].includes(P.mode)) plantFlare();
  }
  const b = theBear(), night = state.lighting?.night || 0;
  for (let i = H.flares.length - 1; i >= 0; i--) {
    const f = H.flares[i];
    f.t += dt;
    const head = flareHead(f), base = f.held ? { x: P.x, y: P.y } : { x: f.x, y: f.y };
    if (!f.out && f.t >= FLARE_S) { f.out = true; if (f.held) { f.held = false; H.held = false; f.x = P.x; f.y = P.y; f.dropped = true; } state.events.push({ type: 'flare', stage: 'out', x: base.x, y: base.y }); }
    if (f.out) { if (f.t > FLARE_S + 4) H.flares.splice(i, 1); continue; }
    const k = smooth(0, 0.4, f.t) * (1 - smooth(FLARE_S - 1.5, FLARE_S, f.t));
    f.fizzT -= dt;
    if (f.fizzT <= 0) { f.fizzT = 0.45; state.events.push({ type: 'flare', stage: 'burn', x: head.x, y: head.y, strength: k }); }
    // a bear in its light runs from it
    if (b && !b.dead && !b.swim && Math.hypot(b.x - base.x, b.y - base.y) < FLARE_R && b.st !== 'flee') scareBear(b, base.x, base.y);
    if (night > 0.01) state.lights.push({ x: base.x, y: base.y - 3, r: 70 + 10 * k, intensity: night * k * (1.0 + 0.18 * Math.sin(state.time * 37) * Math.sin(state.time * 13)), core: true });
    // sparks off the fire, smoke away downwind
    if (Math.random() < dt * 30 * k) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 2 + Math.random() * 4; fx.push({ kind: 'spark', x: head.x, y: head.y, z: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0, r: 0.12, age: 0, life: 0.3 + Math.random() * 0.35 }); }
    // (the smoke rises off it and streams away downwind, a thin column: never a ball round the fire)
    if (Math.random() < dt * 7 * k) { const wa = state.wind.angle, ws = 1.5 + 9 * (state.wind.speed || 0); fx.push({ kind: 'smoke', x: head.x, y: head.y - 1.2, z: 0, vx: Math.cos(wa) * ws + (Math.random() - 0.5), vy: Math.sin(wa) * ws * KY - 5, vz: 0, r: 0.35, age: 0, life: 2.6 + Math.random() }); }
  }

  // --- the rifle -------------------------------------------------------------------------------------------
  const A = H.aim;
  if (A) {
    // put down: the keys or the stick, the pack, anything else happening to them
    const stickNow = inp.stickTap && inp.stickTap !== lastStick && state.time - inp.stickTap < 0.5;
    if (inp.active || (ph !== 'idle' && ph !== 'out') || P.mode !== 'walk' || P.spent || P.water?.level || state.burden?.mode || H.job || !alive()) lowerAim();
    else {
      A.t += dt;
      // (a target shot dead, or gone out of range, isn't replaced by another on its own: no stray second shot
      // into a dog behind it; a tap on an animal, or raising it again, picks one)
      let t = live(A.tgt);
      if (!t || Math.hypot(t.x - P.x, t.y - P.y) > RANGE + 25) { A.tgt = null; t = null; }
      if (t) A.dir = Math.atan2((t.y - P.y) / KY, t.x - P.x);
      A.chance = t ? hitChance(t) : 0;
      // the sway: how unsteady the shot is (the bracket wobbles by it, and the muzzle with it), and the kick
      const un = t ? 1 - A.chance : 0.3, tt = state.time;
      A.kick = Math.max(0, A.kick - dt * 3.5);
      A.swayX = un * 0.55 * (Math.sin(tt * 1.9) + 0.5 * Math.sin(tt * 4.7 + 1)) + (state.body ? 0.25 * smooth(0.6, 0.2, state.body.warmth) * Math.sin(tt * 23) : 0);
      A.swayZ = un * 0.45 * (Math.sin(tt * 1.4 + 2) + 0.5 * Math.sin(tt * 3.9)) + 0.5 * A.kick;
      A.mx = A.swayX * 8; A.my = -A.swayZ * 7;
      // the dogs cower at it
      for (const dg of campDogs) if (!dg.dead && Math.hypot(dg.x - P.x, dg.y - P.y) < 90) dg.cowerT = Math.max(dg.cowerT || 0, 2.5);
      if (stickNow) H.wantFire = state.time;
      if (H.wantFire && state.time - H.wantFire > 0.8) H.wantFire = 0;   // (a press made long before it could fire)
      if (H.wantFire && A.t >= RAISE_S && state.time >= H.next && Math.abs(wrapPi(A.dir - P.facing)) < 0.35) { H.wantFire = 0; fire(); }
    }
  }
  if (inp.stickTap) lastStick = inp.stickTap;
  if (H.boltAt && state.time >= H.boltAt) { H.boltAt = 0; ev('rifle', 'bolt'); }
  if (flash) { flash.t += dt; if (flash.t > 0.12) flash = null; }

  // --- butchering ------------------------------------------------------------------------------------------
  if (H.job) {
    const J = H.job;
    if (!alive() || (P.moving && P.speed > 2) || P.mode !== 'walk' || P.spent || bearNear() || J.c.done) stopJob();
    else {
      J.t += dt; J.cutT -= dt;
      if (J.cutT <= 0 && J.t < J.dur - 0.3) { J.cutT = 0.5 + Math.random() * 0.25; ev('butcher', 'cut'); }
      if (J.t >= J.dur) finishButcher();
    }
  }
  // --- particles -------------------------------------------------------------------------------------------
  for (let i = fx.length - 1; i >= 0; i--) {
    const q = fx[i];
    q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.kind === 'smoke') { const k = Math.exp(-0.5 * dt); q.vx *= k; q.vy *= k; q.r += dt * 0.9; }
    else if (q.kind === 'spark') q.vy += 9 * dt;
    else { q.z += q.vz * dt; q.vz -= 16 * dt; if (q.z < 0) q.age = q.life; }
    if (q.age >= q.life) fx.splice(i, 1);
  }
  if (fx.length > 160) fx.splice(0, fx.length - 160);
}

// --- drawing ----------------------------------------------------------------------------------------------
// Under each carcass the snow a shade darker (packed and stained by it: never red); a penguin's own body.
export function drawGround(ctx) {
  if (!H.carcasses.length) return;
  const r = visibleRect(20);
  for (const c of H.carcasses) {
    const p = carcassPos(c);
    if (p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
    const rx = c.kind === 'bear' ? 13 : c.kind === 'dog' ? 7 : 3.6, a = c.done ? 0.1 : 0.13;
    ctx.beginPath(); ctx.ellipse(p.x + 0.8, p.y + 0.6, rx, rx * 0.42, 0, 0, TAU);
    ctx.fillStyle = `rgba(74,78,86,${a})`; ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x + 0.4, p.y + 0.3, rx * 0.65, rx * 0.26, 0, 0, TAU);
    ctx.fillStyle = `rgba(64,68,76,${a})`; ctx.fill();
  }
}
const items = [];
export function drawables() {
  items.length = 0;
  const r = visibleRect(20);
  for (const c of H.carcasses) {
    if (c.kind !== 'penguin' || c.done) continue;
    if (c.x < r.x0 || c.x > r.x1 || c.y < r.y0 || c.y > r.y1) continue;
    if (!c.draw) c.draw = { x: c.x, y: c.y, draw: ctx => drawPenguin(ctx, c.ref) };
    items.push(c.draw);
  }
  // a flare stuck in the snow (burning or burnt out)
  for (const f of H.flares) if (!f.held) {
    if (!f.drawItem) f.drawItem = { x: f.x, y: f.y, draw: ctx => drawPlanted(ctx, f) };
    f.drawItem.x = f.x; f.drawItem.y = f.y;
    items.push(f.drawItem);
  }
  return items;
}
function drawPlanted(ctx, f) {
  const x = f.x, y = f.y, tx = x + 0.4, ty = y - 2.4;
  if (f.dropped) {
    // burnt out in the hand and dropped: lying on the snow
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 0.9, y); ctx.lineTo(x + 0.9, y - 0.2); ctx.strokeStyle = '#262626'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 0.3; ctx.stroke();
    return;
  }
  ctx.beginPath(); ctx.ellipse(x + 0.6, y + 0.15, 0.9, 0.35, 0, 0, TAU); ctx.fillStyle = 'rgba(96,100,108,0.3)'; ctx.fill();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty);
  ctx.strokeStyle = '#262626'; ctx.lineWidth = 0.55; ctx.stroke();
  ctx.strokeStyle = f.out ? '#9a968e' : '#d8d2c4'; ctx.lineWidth = 0.33; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx - 0.12, ty + 0.4); ctx.lineTo(tx, ty); ctx.strokeStyle = '#2e2a26'; ctx.lineWidth = 0.4; ctx.stroke();
}
// The fire of a flare, the muzzle flash, smoke, sparks and snow: over everything in the world.
export function drawSky(ctx) {
  const t = state.time;
  for (const q of fx) {
    const a = 1 - q.age / q.life;
    if (q.kind === 'smoke') {
      ctx.globalAlpha = 0.42 * a * Math.min(1, q.age * 2.5);
      ctx.beginPath(); ctx.arc(q.x + 0.25, q.y + 0.25, q.r, 0, TAU); ctx.fillStyle = 'rgb(112,116,122)'; ctx.fill();
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 0.85, 0, TAU); ctx.fillStyle = 'rgb(196,198,202)'; ctx.fill();
    } else if (q.kind === 'spark') {
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04);
      ctx.strokeStyle = a > 0.5 ? '#fff6dc' : SIGNAL.glow; ctx.lineWidth = 0.22; ctx.lineCap = 'round'; ctx.stroke();
    } else {
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.beginPath(); ctx.arc(q.x, q.y - q.z, q.r, 0, TAU); ctx.fillStyle = '#fbfbfa'; ctx.fill();
      ctx.strokeStyle = 'rgba(110,112,116,0.5)'; ctx.lineWidth = 0.07; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const f of H.flares) {
    if (f.out) continue;
    const h = flareHead(f), k = smooth(0, 0.4, f.t) * (1 - smooth(FLARE_S - 1.5, FLARE_S, f.t));
    if (k < 0.01) continue;
    const fl = 0.85 + 0.15 * Math.sin(t * 41) * Math.sin(t * 17 + f.x);
    // the glow round it (signal yellow), the fire (yellow into white at its heart)
    const R = 7 * k * fl, g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, R);
    g.addColorStop(0, 'rgba(255,214,140,0.55)'); g.addColorStop(0.35, 'rgba(255,201,107,0.22)'); g.addColorStop(1, 'rgba(255,201,107,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, R, 0, TAU); ctx.fill();
    // tongues of it licking up (signal yellow, ink-free: it's light), then the yellow body and the white heart
    ctx.beginPath();
    for (let j = 0; j < 3; j++) { const ph = t * 9 + j * 2.1 + f.x, hx = h.x + (j - 1) * 0.45, hh = (1.4 + 0.6 * Math.sin(ph)) * k; ctx.moveTo(hx - 0.35, h.y); ctx.quadraticCurveTo(hx + 0.3 * Math.sin(ph * 1.3), h.y - hh * 0.6, hx + 0.15 * Math.sin(ph), h.y - hh); ctx.quadraticCurveTo(hx + 0.4, h.y - hh * 0.4, hx + 0.35, h.y); }
    ctx.fillStyle = SIGNAL.lit; ctx.fill();
    ctx.beginPath(); ctx.ellipse(h.x, h.y - 0.35 * k, 1.0 * k * fl, 1.3 * k * fl, 0, 0, TAU); ctx.fillStyle = SIGNAL.glow; ctx.fill();
    ctx.beginPath(); ctx.arc(h.x, h.y - 0.25, 0.6 * k * fl, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill();
  }
  if (flash) {
    // the muzzle flash: a short star of light out of the barrel (a frame or two), white at the heart
    const k = 1 - flash.t / 0.12, x = flash.x, y = flash.y, ux = flash.ux, uy = flash.uy, nx = -uy, ny = ux;
    ctx.globalAlpha = k;
    ctx.beginPath();
    ctx.moveTo(x + nx * 0.8, y + ny * 0.8); ctx.lineTo(x + ux * 4.6, y + uy * 4.6); ctx.lineTo(x - nx * 0.8, y - ny * 0.8);
    ctx.lineTo(x + ux * 1.2 + nx * 2.2, y + uy * 1.2 + ny * 2.2); ctx.lineTo(x + ux * 1.2 - nx * 2.2, y + uy * 1.2 - ny * 2.2); ctx.closePath();
    ctx.fillStyle = SIGNAL.glow; ctx.fill();
    ctx.beginPath(); ctx.arc(x + ux * 0.6, y + uy * 0.6, 0.7, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.globalAlpha = 1;
  }
}
// The target: a small inked bracket round it (four corners), swaying with how unsteady the shot is,
// tightening as the aim settles. Over everything (after the night grade), so it reads by night.
export function drawOverlay(ctx) {
  const A = H.aim;
  if (!A || !A.tgt) return;
  const a = live(A.tgt);
  if (!a) return;
  const { dpr } = state.view, z = state.cam.zoom || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = smooth(0.1, RAISE_S, A.t);
  const tight = lerp(1.4, 1, smooth(0.2, 1.3, A.t));
  // (a bear's head is well out in front of its middle: the bracket centred a little forward along it)
  const fwd = a.kind === 'bear' ? 2.2 : 0, hd = a.kind === 'bear' ? a.ref.heading : 0;
  const c = worldToScreen(a.x + Math.cos(hd) * fwd + A.mx, a.y + Math.sin(hd) * fwd * 0.75 - a.h * 0.45 + A.my);
  const hw = Math.max(9, a.w * 0.55 * tight * z), hh = Math.max(9, a.h * 0.6 * tight * z), L = Math.max(4, Math.min(hw, hh) * 0.42);
  ctx.globalAlpha = k;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = c.x + sx * hw, y = c.y + sy * hh;
    ctx.moveTo(x - sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * L);
  }
  ctx.lineWidth = Math.max(3, z * 0.55); ctx.strokeStyle = 'rgba(250,250,248,0.5)'; ctx.stroke();
  ctx.lineWidth = Math.max(1.4, z * 0.26); ctx.strokeStyle = 'rgba(30,30,32,0.88)'; ctx.stroke();
  ctx.globalAlpha = 1;
}
// The knife (the carcass row's Butcher): a short broad blade on the diagonal, its edge pale, a dark handle.
export const HUNT_ICON = {
  butcher: (ctx, r, z) => {
    ctx.save(); ctx.rotate(-0.7); ctx.lineJoin = 'round';
    const lw = Math.max(1, z * 0.26);
    ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.13); ctx.lineTo(r * 0.62, -r * 0.1); ctx.quadraticCurveTo(r * 0.7, r * 0.02, r * 0.5, r * 0.12); ctx.lineTo(-r * 0.05, r * 0.12); ctx.closePath();
    ctx.fillStyle = 'rgba(214,216,220,0.98)'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(40,36,30,0.9)'; ctx.stroke();
    ctx.beginPath(); ctx.rect(-r * 0.62, -r * 0.1, r * 0.55, r * 0.2); ctx.fillStyle = 'rgba(70,62,52,0.98)'; ctx.fill(); ctx.stroke();
    ctx.restore();
  },
};
