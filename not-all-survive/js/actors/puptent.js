// The pup tent (slice 6): the one small ridge tent the expedition carries, barely longer than
// the explorer lying down. It's a pack item (items.js 'puptent', one on the sled, stack 1); used
// from the pack it's pitched on the snow in front of the explorer, and from then on it's a
// shelter like the base camp tent (explorer.js crawls in and out of it; body.js reads its
// quality, PUP_SHELTER), only worse: slower to warm and dry, colder in a storm, and with no
// food in you, no use at all.
//
// state.pup = { pitched, job, nope }
//   pitched  { x, y, yaw, t, snow } | null    where it stands (the door faces +ly: its back to the
//            wind, turned ~35deg toward the camera so the door shows). Nobody carries it off: pitched and left, it stays for the run;
//            a member who dies with it in the pack keeps it (fallen.js), like anything else.
//   job      { kind: 'pitch'|'strike', x, y, yaw, t, prog, ... } | null    the work in hand.
//            prog runs 0..3 through the three stages of pitching (spread the canvas, raise the
//            poles, drive the stakes; ~2.7 s each, slower in deep snow) and back down for a
//            strike (~4 s, the press held). Walking off, being knocked about or the body giving
//            out stops it; a stopped pitch leaves the tent in the pack, a stopped strike leaves
//            it standing.
//   nope     state.time of a refusal (the canvas jerks: a strike with no room in the pack).
//   force    test hook: true makes the wind catch it at the next test (NAS.pup.force = true).
//
// The work costs: energy and food go at about the rate of walking on snow while they kneel at it
// (body.js), the cold gets in as it does standing still, each stage is slower hurt (x(1 + 0.6 x
// injury)), numb with cold (x1.5 below warmth 0.4) and in a gale (up to x1.6: the wind fights for
// the canvas); not when spent, nor with the bear close.
// The wind: once in each stage of pitching, at a random moment, a gust can catch the canvas.
// The chance grows with the wind and the gust at that moment (never in calm air, now and then
// in a breeze, most tries in a blizzard, less in the lee of rock); getting it gathered up again
// takes longer the harder it blows. While it's down a knockdown can still take them off their feet
// (and that ends the try: the tent goes back in the pack). Caught, it balloons and flaps,
// the poles fold, it goes down flat (COLL_S), and the work is lost: the canvas only re-spread
// from the first stage; from the second or third the poles must go up again (and now and then the
// canvas half blows back into a bundle too). The explorer throws their arms up and grabs at it
// (explorer.js reads job.coll). Then they go at it again by themselves.
//
// Drawn in the base camp tent's style (camp.js): inked edges, signal yellow canvas shaded from
// the upper left, guy lines to stakes, a soft cast shadow to the lower right. It flutters and
// strains in the wind (more in a storm), glows a little when someone's in it (the stove: smaller
// and dimmer than base camp's, and dark when it's empty), and a thin breath of steam leaves the
// door's peak.
//
// Pushes events: pitch { x, y, stage: 'start'|'spread'|'poles'|'stake'|'collapse'|'done'|'stop',
//   strength }, strike { x, y, stage: 'start'|'pull'|'done'|'stop' }, full (no room to strike).
// Hooks: NAS.pitch(now?) (start pitching here, or with now = true, put it up at once: the gear
// menu's "Pitch tent here"), NAS.strike(now?), NAS.pup.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import * as terrain from '../world/terrain.js';
import { SIGNAL } from '../palette.js';
import { campBlocked, tentDoor, SLED } from './camp.js';
import { add, take, find, room } from '../items.js';

const TAU = Math.PI * 2;
const SQ = 0.72;                       // ground-plane depth foreshortening (as camp.js)
const INK = '#444446';
const LX = -0.55, LY = -0.45, LZ = 0.70;
// half-length (along the ridge), skirt and eave half-widths, eave and ridge heights: ~18 long
// (about 1.1 x the explorer lying down), ~12 across, ridge ~6.6 high (base camp's is ~12)
const T = { L2: 9.0, Ws: 5.9, Wr: 5.2, He: 1.0, Hr: 6.6 };
const WF = T.Ws + 0.9;                 // the canvas lying flat, half-width
const NU = 10, NV = 3;
const STAGE_S = 2.7, DEEP_K = 1.45, STRIKE_S = 4, COLL_S = 1.5, REGATHER_S = 0.55;
const DOOR_TURN = 0.6;                 // the door turned up to this far off downwind, toward the camera (rad)
const CLEAR = 25;                      // kept this far from base camp's door and the sled
export const PUP_REACH = 5;            // strike from within this of its edge (ui/pack.js; the glint from twice that)

// What it's worth as a shelter, against the base camp tent (camp.js CAMP_SHELTER, all 1 / 0):
// warmth, drying, energy, healing and sleep come back at these fractions of base camp's; in a
// storm (storm x how stormy) the warmth gain drops further; leak is the share of the outside
// cold that still gets through the canvas; food drains at the open-air rate (base camp's stove
// and rest save 40%); hunger: how much an empty stomach undoes it (body.js). muffle: how much of
// the storm's noise it keeps out (audio.js). water: its little stove melts snow at this fraction of
// base camp's (thirst, the flasks: body.js).
export const PUP_SHELTER = { kind: 'pup', warm: 0.33, dry: 0.33, rest: 0.7, heal: 0.5, sleep: 0.75, storm: 0.6, leak: 0.16, food: 1, hunger: 1, muffle: 0.72, water: 0.4 };

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function zoom() { return state.cam.zoom || 3; }
function inkW(base) { return Math.max(base, 0.85 / zoom()); }
const lwMain = () => inkW(0.3);
const lwFine = () => Math.max(0.15, 0.5 / zoom());
function lam(nx, ny, nz) { const l = Math.hypot(nx, ny, nz) || 1; return (nx * LX + ny * LY + nz * LZ) / l; }
let rs = 77;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

const P = state.player;
const pup = state.pup = { pitched: null, job: null, nope: -9 };

function mkProj(ox, oy, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const F = (lx, ly, h) => [ox + lx * c - ly * s, oy + (lx * s + ly * c) * SQ - h];
  F.rot = (nx, ny) => [nx * c - ny * s, nx * s + ny * c];
  F.depth = (lx, ly) => lx * s + ly * c;
  F.local = (x, y, h = 0) => { const dx = x - ox, dy = (y + h - oy) / SQ; return [dx * c + dy * s, -dx * s + dy * c]; };
  return F;
}
let proj = null, projKey = '';
function projFor(o) {
  const k = o.x + ',' + o.y + ',' + o.yaw;
  if (k !== projKey) { proj = mkProj(o.x, o.y, o.yaw); projKey = k; doorClip = null; }
  return proj;
}

// --- where it can go ---------------------------------------------------------------------------
// Not on ice, thin ice, water or rock, not at the lip of a slope or a cliff (the ground all round
// it has to be the same walkable snow, at one level), and not in the camp. Sampled over the
// footprint and a margin round it.
const PITCH_OK = new Set([terrain.C.SNOW, terrain.C.DEEP, terrain.C.PATH, terrain.C.SHADOW]);
function siteOk(x, y, yaw) {
  // clear of base camp's door and the sled (so a press or Space there is never the pup tent's), and
  // never over a fallen member or a pile on the snow
  const d = safe(() => tentDoor(), null);
  if (d && Math.hypot(x - d.fx, y - d.fy) < CLEAR + T.L2) return false;
  if (Math.hypot(x - SLED.x, y - SLED.y) < CLEAR + 14) return false;
  for (const f of state.fallen || []) if (!f.lost && Math.hypot(x - f.x, y - f.y) < T.L2 + 8) return false;
  for (const g of state.ground || []) if (Math.hypot(x - g.x, y - g.y) < T.L2 + 5) return false;
  const F = mkProj(x, y, yaw), reg = safe(() => terrain.regionAt(x, y), null);
  for (let i = -1; i <= 1; i += 0.5) for (let j = -1; j <= 1; j += 0.25) {
    const [px, py] = F(i * (T.Ws + 2.2), j * (T.L2 + 2.2), 0);
    if (!safe(() => terrain.isWalkable(px, py), true) || safe(() => terrain.isWater(px, py), false)) return false;
    if (!PITCH_OK.has(safe(() => terrain.classAt(px, py), terrain.C.SNOW))) return false;
    if (reg !== null && safe(() => terrain.regionAt(px, py), reg) !== reg) return false;
    if (campBlocked(px, py) || campBlocked(px, py + 3)) return false;
  }
  return true;
}
function safe(fn, d) { try { const v = fn(); return v === undefined ? d : v; } catch { return d; } }
// The way the door faces: its back to the wind, turned up to DOOR_TURN toward the camera (+y) so the
// doorway (and its lamp) can be seen.
export function doorAngle() {
  const a = state.wind.angle || 0, off = Math.atan2(Math.sin(Math.PI / 2 - a), Math.cos(Math.PI / 2 - a));
  return a + Math.sign(off) * Math.min(DOOR_TURN, Math.abs(off));
}
// A site beside the explorer: the tent's back to the wind, and the explorer kneeling at a flank or
// at a corner by a gable (beside it, not on it, so the work at the pole and the stakes shows). Seen
// from above at a slant, a kneeling figure in front of a tent this low hides it, and behind it is
// hidden: so the placings off to the side on screen come first, the side they face first. Null:
// nowhere here.
export function findSite() {
  const a = doorAngle(), yaw = a - Math.PI / 2;
  const wx = Math.cos(a), wy = Math.sin(a), nx = -wy, ny = wx;
  const fx = Math.cos(P.facing || 0), fy = Math.sin(P.facing || 0);
  const dS = T.Ws + 3.8, dE = T.L2 + 2.6, dC = T.Ws + 2.4;
  const tries = [];
  for (const sg of [1, -1]) {
    tries.push([sg * nx * dS, sg * ny * dS]);
    for (const sc of [1, -1]) tries.push([sg * wx * dE + sc * nx * dC, sg * wy * dE + sc * ny * dC]);
  }
  // off to the side on screen beats in front / behind; then the way they face
  const score = ([ox, oy]) => Math.abs(ox) - 1.4 * Math.abs(oy * SQ) + 4 * Math.sign(ox * fx + oy * fy);
  tries.sort((p, q) => score(q) - score(p));
  for (const [ox, oy] of tries) {
    const x = P.x + ox, y = P.y + oy * SQ;
    if (siteOk(x, y, yaw)) return { x, y, yaw };
  }
  return null;
}

// --- the work: pitching and striking ------------------------------------------------------------
const inPack = () => find(state.pack, 'puptent') >= 0;
const busyMode = () => P.mode !== 'walk' && P.mode !== 'cower';
const bodyOk = () => !state.body || state.body.phase === 'alive';
function ev(type, stage, extra) { const o = pup.job || pup.pitched || P; state.events.push({ type, stage, x: o.x, y: o.y, ...extra }); }

// Start pitching from the pack. Returns false (refused: the slot shakes) if there's no ground for
// it here, or it can't be done now.
const bearNear = () => { const b = state.bear; return !!b && b.threat && Math.hypot(b.x - P.x, b.y - P.y) < 60; };
export function startPitch() {
  if (pup.job || pup.pitched || !inPack() || busyMode() || !bodyOk() || P.water?.level || P.spent || bearNear()) return false;
  const s = findSite();
  if (!s) return false;
  const deep = P.terrain === 'deep' || safe(() => terrain.terrainAt(s.x, s.y), 'snow') === 'deep';
  pup.job = { kind: 'pitch', ...s, t: 0, prog: 0, dur: STAGE_S * (deep ? DEEP_K : 1), checks: [rr(0.3, 0.9), rr(0.3, 0.9), rr(0.25, 0.85)], tested: [false, false, false], coll: null, tries: 1, collapses: 0, nextStake: 2.08 };
  ev('pitch', 'start');
  return true;
}
const rr = (a, b) => a + rnd() * (b - a);
// Start striking (the press on the pitched tent has been held long enough: ui/pack.js). Needs a
// free slot (or the canvas jerks and a full pack knocks).
export function startStrike() {
  const p = pup.pitched;
  if (!p || pup.job || busyMode() || !bodyOk() || P.spent || bearNear()) return false;
  if (room(state.pack, 'puptent') < 1) { pup.nope = state.time; state.events.push({ type: 'full', x: P.x, y: P.y }); return false; }
  pup.job = { kind: 'strike', x: p.x, y: p.y, yaw: p.yaw, t: 0, prog: 3, coll: null };
  ev('strike', 'start');
  return true;
}
export function stopJob() {
  const j = pup.job;
  if (!j) return;
  ev(j.kind, 'stop');
  pup.job = null;
}
// the strength of the wind on the canvas at the site: the gust counts more than the breeze
function windOnSite(x, y) {
  const sh = safe(() => terrain.shelterAt(x, y) || 0, 0);
  return (state.wind.speed + 0.6 * (state.wind.gust || 0)) * (1 - 0.5 * sh);
}
// chance a gust catches the canvas when it's tested: 0 in calm air, rare in a breeze, most
// tries in a blizzard (see the measured numbers in docs/BRIEF.md)
export const catchChance = w => 0.56 * smooth(0.5, 1.2, w);
// gathering it up again after it's gone down: longer the harder it blows
const regather = w => REGATHER_S * (1 + 3.5 * smooth(0.3, 1.2, w));

function updateJob(dt) {
  const j = pup.job;
  if (!j) return;
  // walked off, shoved about, knocked down, the body giving out, the tent gone from the pack
  const moved = P.moving && P.speed > 2;
  if (moved || busyMode() || !bodyOk() || P.water?.level || (j.kind === 'pitch' && !inPack()) || (j.kind === 'strike' && !pup.pitched)) { stopJob(); return; }
  j.t += dt;
  if (j.kind === 'strike') {
    const before = Math.ceil(j.prog - 1e-6);
    j.prog = Math.max(0, j.prog - dt * 3 / STRIKE_S);
    if (Math.ceil(j.prog - 1e-6) < before && j.prog > 0) ev('strike', 'pull');
    if (j.prog <= 0) {
      add(state.pack, 'puptent', 1);
      pup.pitched = null; pup.job = null;
      state.events.push({ type: 'strike', stage: 'done', x: j.x, y: j.y });
    }
    return;
  }
  if (j.coll) {
    j.coll.t += dt;
    if (j.coll.t >= COLL_S + j.coll.re) { j.coll = null; j.tries++; }
    return;
  }
  const k = Math.min(2, Math.floor(j.prog)), before = j.prog;
  // slower hurt, with numb hands, and with the wind fighting for the canvas
  const B = state.body, slow = (1 + 0.6 * clamp(B?.injury || 0)) * ((B?.warmth ?? 1) < 0.4 ? 1.5 : 1) * (1 + 0.6 * smooth(0.4, 1.1, windOnSite(j.x, j.y)));
  j.prog = Math.min(3, j.prog + dt / (j.dur * slow));
  // the wind tests it once a stage, at that stage's moment
  if (!j.tested[k] && j.prog >= k + j.checks[k]) {
    j.tested[k] = true;
    const w = windOnSite(j.x, j.y);
    if (pup.force || rnd() < catchChance(w)) {
      pup.force = false;
      // caught: down it goes; the canvas only re-spread from the first stage; from the later
      // ones the poles go up again (now and then the canvas half blows back into a bundle)
      const to = k === 0 ? 0 : rnd() < 0.3 ? 0.5 : 1;
      j.coll = { t: 0, from: j.prog, to, k, w, re: regather(w) };
      j.prog = to; j.collapses++;
      for (let i = 0; i < 3; i++) if (i >= Math.floor(to)) { j.tested[i] = false; j.checks[i] = i === 0 ? rr(0.3, 0.9) : rr(0.25, 0.85); }
      if (to > 0 && to < 1) j.checks[0] = rr(0.6, 0.95);
      j.nextStake = 2.08;
      ev('pitch', 'collapse', { strength: clamp(w) });
      return;
    }
  }
  if (before < 1 && j.prog >= 1) ev('pitch', 'poles');
  if (before < 0.02 && j.prog >= 0.02) ev('pitch', 'spread');
  // the stakes go in one at a time through the last stage (6 of them), a few taps each
  if (j.prog >= j.nextStake && j.prog < 3) { j.nextStake += 0.155; ev('pitch', 'stake'); }
  if (j.prog >= 3) {
    const i = find(state.pack, 'puptent');
    if (i < 0) { stopJob(); return; }
    take(state.pack, i, 1);
    pup.pitched = { x: j.x, y: j.y, yaw: j.yaw, t: state.time, snow: 0 };
    pup.job = null; doorClip = null;
    state.events.push({ type: 'pitch', stage: 'done', x: j.x, y: j.y, tries: j.tries, collapses: j.collapses, t: j.t });
  }
}

// --- the pitched tent as a shelter (explorer.js) -------------------------------------------------
// pupDoor(): as camp.js tentDoor(): x, y just inside the door, fx, fy on the snow in front of it,
// out (unit world direction out of the door), around(px, py) waypoints round to the door. Null if
// it isn't pitched.
export function pupDoor() {
  const p = pup.pitched;
  if (!p) return null;
  const F = projFor(p);
  const [x, y] = F(0, T.L2 - 1.0, 0), [fx, fy] = F(0, T.L2 + 4.2, 0);
  const d = Math.hypot(fx - x, fy - y) || 1;
  return {
    x, y, fx, fy, out: { x: (fx - x) / d, y: (fy - y) / d },
    around(px, py) {
      const [lx, ly] = F.local(px, py);
      if (ly > T.L2 + 2) return [];
      const sd = lx >= 0 ? 1 : -1, wx = sd * (T.Ws + 5), pts = [];
      if (ly < -T.L2 + 3) pts.push(F(wx, -T.L2 - 3, 0));
      pts.push(F(wx, T.L2 + 4, 0));
      return pts.map(([qx, qy]) => ({ x: qx, y: qy }));
    },
  };
}
// The silhouette and the door opening (world), for the crawl in and out (explorer.js clips the
// figure to the door). With the door facing away from the camera there's no opening to see: the
// tent simply hides them.
let doorClip = null;
export function pupDoorClip() {
  const p = pup.pitched;
  if (!p) return null;
  if (doorClip) return doorClip;
  const F = projFor(p), { L2, Ws, Wr, He, Hr } = T, pts = [];
  for (const ly of [-L2, L2]) { for (const sd of [-1, 1]) pts.push(F(sd * (Ws + 0.3), ly, 0), F(sd * Wr, ly, He)); pts.push(F(0, ly, Hr + 0.3)); }
  const facing = F.depth(0, 1) > 0, dh = Hr * 0.7, dw = 1.9;
  const door = facing ? [F(0, L2, dh), F(dw, L2, 0), F(-dw, L2, 0)] : [F(0, L2, 0), F(0, L2, 0), F(0, L2, 0)];
  return (doorClip = { gable: hull(pts), door });
}
// solid: the explorer walks round it
export function pupBlocked(x, y) {
  const p = pup.pitched;
  if (!p || Math.abs(x - p.x) > 16 || Math.abs(y - p.y) > 16) return false;
  const [lx, ly] = projFor(p).local(x, y);
  return Math.abs(lx) < T.Ws + 0.4 && Math.abs(ly) < T.L2 + 0.4;
}
// a tap on its canvas (tried at a few heights: the picture of the roof is up off the ground)
export function pupInteract(x, y) {
  const p = pup.pitched;
  if (!p || Math.abs(x - p.x) > 18 || Math.abs(y - p.y) > 20) return false;
  const F = projFor(p);
  for (let h = 0; h <= T.Hr; h += 1.5) {
    const [lx, ly] = F.local(x, y, h);
    if (Math.abs(ly) < T.L2 + 1.5 && Math.abs(lx) < (T.Ws + 1.2) * (1 - h / (T.Hr + 1.5)) + 0.8) return true;
  }
  return false;
}
// how far the explorer is from its edge (on its ground plane)
export function pupDist() {
  const p = pup.pitched;
  if (!p) return 1e9;
  const [lx, ly] = projFor(p).local(P.x, P.y);
  return Math.hypot(Math.max(0, Math.abs(lx) - T.Ws), Math.max(0, Math.abs(ly) - T.L2));
}
// where the glint sits: the near end of the ridge, at a guy line
export function pupGlint() {
  const p = pup.pitched;
  if (!p) return null;
  const F = projFor(p), end = F.depth(0, 1) >= 0 ? 1 : -1;
  const [x, y] = F(0, end * (T.L2 + 0.2), T.Hr + 0.4);
  return { x, y };
}

// --- update ------------------------------------------------------------------------------------
let occ = 0, glow = 0, doorLit = 0, steamT = 0, wind = 0, gust = 0, windPh = 0, flapT = 3;
const steam = [];
const occupied = () => (P.mode === 'inside' || P.mode === 'tent-in' || P.mode === 'tent-out') && P.shelter?.kind === 'pup';

export function init() {
  state.pitch = (now = false) => {
    if (!now) { if (!inPack() && !pup.pitched) add(state.pack, 'puptent', 1); return startPitch(); }
    if (pup.pitched) return false;
    const s = findSite();
    if (!s) return false;
    for (const c of [state.pack, state.sled]) { const i = find(c, 'puptent'); if (i >= 0) { take(c, i, 1); break; } }
    pup.job = null;
    pup.pitched = { ...s, t: state.time, snow: 0 }; doorClip = null;
    state.events.push({ type: 'pitch', stage: 'done', x: s.x, y: s.y, tries: 1, collapses: 0, t: 0 });
    return true;
  };
  state.strike = (now = false) => {
    if (!now) return startStrike();
    if (!pup.pitched || occupied()) return false;
    add(state.pack, 'puptent', 1) || add(state.sled, 'puptent', 1);
    const p = pup.pitched; pup.pitched = null; pup.job = null;
    state.events.push({ type: 'strike', stage: 'done', x: p.x, y: p.y });
    return true;
  };
}

export function update(dt) {
  updateJob(dt);
  const p = pup.pitched, o = p || pup.job;
  gust = clamp(state.wind.gust || 0);
  wind = o ? clamp(state.wind.speed * (1 - 0.5 * safe(() => terrain.shelterAt(o.x, o.y) || 0, 0)) + gust * 0.3, 0, 1.3) : 0;
  windPh += dt * (0.6 + 4.2 * wind + 2.5 * gust);
  // someone in it: the stove lit; the canvas warms a little by day, glows at night (less than base
  // camp's, and only while it's lit); a press held to sleep turns it down
  const m = P.mode;
  const occT = occupied() ? (m === 'inside' ? 1 : 0.6) : 0;
  occ += (occT - occ) * Math.min(1, dt * (occT > occ ? 1.2 : 0.8));
  const lamp = 1 - 0.7 * (state.body?.sleepHold || 0) - (state.body?.phase === 'sleep' ? 0.6 : 0);
  const night = state.lighting?.night || 0;
  glow = occ * Math.max(0, lamp) * (0.38 + 0.34 * night) * (1 + 0.1 * Math.sin(state.time * 1.3));
  doorLit = occ * Math.max(0, lamp) * 0.9 * (1 + 0.12 * Math.sin(state.time * 1.4) * occ);   // the door slit, lamp-lit (by day too)
  if (p) {
    p.snow = Math.min(1, p.snow + dt / 400 * (0.3 + state.weather.snowfall + wind));
    if (night > 0 && occ > 0.05 && state.lights) state.lights.push({ x: p.x, y: p.y - 2, r: 16 + 6 * occ, intensity: 0.55 * occ * night * Math.max(0, lamp) });
    // a thin breath of steam from the door's peak, bent off downwind
    if (occ > 0.5 && onScreen(p)) {
      steamT -= dt;
      if (steamT <= 0) {
        steamT = rr(0.09, 0.17);
        const [vx, vy] = projFor(p)(0, T.L2 - 0.5, T.Hr + 0.6), a = state.wind.angle, ws = 1.5 + 9 * state.wind.speed;
        steam.push({ x: vx, y: vy, vx: Math.cos(a) * ws, vy: Math.sin(a) * ws * SQ - 2.0, age: 0, life: rr(1.9, 2.8) });
      }
    }
    // the canvas cracking in the wind, heard close by (audio.js)
    flapT -= dt * (0.4 + 2.5 * smooth(0.45, 1, wind + gust * 0.5));
    if (flapT <= 0) {
      flapT = rr(1.2, 3.5);
      if (wind > 0.4 && Math.hypot(P.x - p.x, P.y - p.y) < 70) state.events.push({ type: 'flap', x: p.x, y: p.y, strength: smooth(0.4, 1.2, wind + gust * 0.5), inside: occupied() });
    }
  }
  for (let i = steam.length - 1; i >= 0; i--) {
    const q = steam[i]; q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.985;
    if (q.age > q.life) steam.splice(i, 1);
  }
}

function onScreen(o, m = 30) {
  const r = visibleRect(m);
  return o.x > r.x0 - 20 && o.x < r.x1 + 20 && o.y > r.y0 - 20 && o.y < r.y1 + 25;
}

// --- drawing ------------------------------------------------------------------------------------
// The shape now, from where the work has got to: spread (the canvas unrolled across the snow),
// rise (the poles up), taut (the stakes in: guy lines shown, the sag gone), billow (a gust in it),
// and in a collapse the poles folding and the canvas flapping flat.
function shapeNow() {
  const p = pup.pitched, j = pup.job;
  if (p && !j) return { o: p, spread: 1, rise: 1, taut: 1, billow: 0, flap: 0, guys: 6 };
  if (!j) return null;
  if (j.kind === 'strike') {
    const q = j.prog;
    return { o: j, spread: clamp(q), rise: smooth(0, 1, clamp(q - 1)), taut: clamp(q - 2), billow: 0, flap: 0.3, guys: Math.ceil(clamp(q - 2) * 6 - 1e-6) };
  }
  const q = j.prog;
  let s = { o: j, spread: clamp(q), rise: smooth(0, 1, clamp(q - 1)), taut: clamp(q - 2), billow: 0, flap: 0.35 * (1 - clamp(q - 2)), guys: Math.floor(clamp(q - 2) * 6.6) };
  if (j.coll) {
    // balloons, the poles fold, it goes down flat and flaps; then the bundle settles to where the
    // work now stands
    const c = j.coll.t, from = j.coll.from;
    const rise0 = smooth(0, 1, clamp(from - 1));
    const sp0 = clamp(from), sp1 = clamp(j.coll.to);
    s = {
      o: j, spread: lerp(sp0, sp1, smooth(0.9, COLL_S, c)),
      rise: rise0 * (1 - smooth(0.35, 0.85, c)) + 0.12 * rise0 * Math.max(0, Math.sin(c * 17)) * (1 - smooth(0.6, 1, c)),
      taut: 0, billow: smooth(0, 0.22, c) * (1 - 0.6 * smooth(0.6, COLL_S, c)) * (0.5 + 0.5 * j.coll.w), flap: 1 - 0.6 * smooth(0.9, COLL_S + j.coll.re, c), guys: 0,
      lean: smooth(0.2, 0.85, c),
    };
  }
  return s;
}

const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const Y_SH = hexRGB(SIGNAL.shadow), Y_BA = hexRGB(SIGNAL.base), Y_LI = hexRGB(SIGNAL.lit), Y_DP = hexRGB(SIGNAL.deep), Y_GL = hexRGB(SIGNAL.glow);
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
function yel(tone) {
  const f = clamp((tone - 182) / 56);
  let c = f < 0.5 ? mix(Y_SH, Y_BA, f * 2) : mix(Y_BA, Y_LI, (f - 0.5) * 2);
  if (glow > 0) c = mix(c, mix(Y_GL, [255, 236, 190], 0.15 + 0.25 * f), glow * 0.85);
  return rgb(c);
}
const deepA = a => `rgba(${Y_DP[0]},${Y_DP[1]},${Y_DP[2]},${a})`;

const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function inkLine(ctx, pts, w, col = INK, seed = 1, gaps = 0.025) {
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  let pen = false, k = seed * 17.3;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-3, n = Math.max(1, Math.ceil(L / 1.3));
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    for (let jj = i ? 1 : 0; jj <= n; jj++) {
      const t = jj / n; k += 1;
      const jit = (hash(k) - 0.5) * 0.16;
      const x = a[0] + (b[0] - a[0]) * t + nx * jit, y = a[1] + (b[1] - a[1]) * t + ny * jit;
      if ((k * 0.6180339 + seed * 0.371) % 1 < gaps) { pen = false; continue; }
      if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}
function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of pts.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// one point of the canvas: side sd, u along the ridge (0 at the door end), v from the ridge (0)
// to the eave (1), for the shape s
function canvas3(s, sd, u, v, wl, out = [0, 0, 0]) {
  const { L2, Wr, He, Hr } = T;
  const su = Math.sin(Math.PI * u), r = s.rise;
  const ly = L2 - 2 * L2 * u;
  const H = Hr * r - (0.35 + 1.5 * (1 - s.taut)) * r * su;            // the ridge sags between the poles
  const wE = lerp(WF, Wr, r) - 0.35 * su * r, hE = He * r;
  let x = sd * wE * v, z = lerp(H, hE, v);
  // the roof's outward normal (a flat sheet: straight up)
  const nl = Math.hypot(H - hE, wE) || 1, nx = sd * (H - hE) / nl, nz = wE / nl;
  // wind: the windward side pressed in, the lee side bellied out, ripples running downwind;
  // slack canvas (no stakes yet) moves far more; a gust in it balloons the whole sheet
  const face = sd * wl.x, dir = wl.y < 0 ? 1 : -1, slack = 0.4 + 0.6 * (1 - s.taut);
  const env = Math.pow(su, 0.7) * Math.sin(Math.PI * Math.min(1, v * 1.05));
  const pres = wind * wind * Math.abs(face) * (face < 0 ? 1.5 : -0.7) * (0.6 + 0.4 * s.taut) * r;
  const rip = (0.08 + 0.55 * wind + 0.55 * gust) * slack * (0.6 * Math.sin(TAU * (1.2 * u + 0.3 * v) - dir * windPh * 2.3) + 0.35 * Math.sin(TAU * (2.6 * u - 0.6 * v) - dir * windPh * 3.9 + sd * 1.7));
  // (a balloon: the lee side bellies furthest, the whole sheet heaving as one)
  const bil = s.billow * (1.8 + 0.7 * Math.sin(windPh * 5 + u * 1.3)) * (face < 0 ? 0.6 : 1.3) * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.4));
  const d = env * (rip * Math.max(0.25, r) - pres) + bil;
  x += d * nx; z += d * nz + bil * 0.6 * (1 - r);
  // the flat sheet's edges and corners lift and slap in the wind
  if (r < 0.6 && s.spread > 0.05) {
    const edge = Math.max(Math.pow(v, 3), Math.pow(Math.abs(u - 0.5) * 2, 4));
    z += edge * (1 - r / 0.6) * s.flap * (0.2 + 1.1 * wind + 1.2 * gust) * Math.max(0, Math.sin(windPh * 7.3 + u * 5 + sd * 2 + v * 3));
  }
  // lean: the poles going over downwind in a collapse
  if (s.lean) { x += wl.x * 2.2 * s.lean * (1 - v) * r; }
  out[0] = x; out[1] = ly; out[2] = Math.max(0, z);
  return out;
}

const MESH = { [-1]: [], [1]: [] };
for (const sd of [-1, 1]) for (let i = 0; i <= NU; i++) { const col = []; for (let k = 0; k <= NV; k++) col.push([0, 0, 0]); MESH[sd].push(col); }
function drawPup(ctx, s) {
  const F = projFor(s.o), { L2, Ws, Wr, He, Hr } = T;
  const wl = (() => { const a = state.wind.angle, c = Math.cos(s.o.yaw), sn = Math.sin(s.o.yaw), wx = Math.cos(a), wy = Math.sin(a); return { x: wx * c + wy * sn, y: -wx * sn + wy * c }; })();
  const nope = state.time - pup.nope < 0.4 ? Math.sin((state.time - pup.nope) * 50) * 0.5 * (1 - (state.time - pup.nope) / 0.4) : 0;
  if (nope) ctx.translate(nope, 0);
  const lwM = lwMain(), lwF = lwFine(), r = s.rise;
  // the flat sheet unrolls from the -x side across to +x: nothing past xMax yet
  const xMax = -WF + 2 * WF * s.spread;
  // (the mesh's arrays are kept and refilled: this is redrawn ~15 times a second)
  for (const sd of [-1, 1]) {
    for (let i = 0; i <= NU; i++) {
      const col = MESH[sd][i];
      for (let k = 0; k <= NV; k++) { const q = canvas3(s, sd, i / NU, k / NV, wl, col[k]); if (s.spread < 0.999 && q[0] > xMax) q[0] = xMax; }
    }
  }
  const mesh = MESH;
  const P3 = q => F(q[0], q[1], q[2]);

  // a soft grey shadow cast to the lower right
  {
    const sh = [];
    for (const ly of [-L2, L2]) sh.push(F(-Ws, ly, 0), F(Math.min(Ws, xMax), ly, 0));
    const ht = Hr * r + 0.4;
    for (const ly of [-L2, L2]) { const g = F(0, ly, 0); sh.push([g[0] + ht * 0.6, g[1] + ht * 0.36]); }
    // (laid down a few times, offset, so its edge is soft like base camp's blurred one)
    const H = hull(sh);
    ctx.fillStyle = `rgba(116,120,126,${0.05 + 0.04 * r})`;
    for (const [ox, oy] of [[0, 0], [0.5, 0.3], [-0.4, 0.2], [0.3, -0.35], [-0.2, -0.25]]) {
      ctx.beginPath(); H.forEach((q, i) => (i ? ctx.lineTo(q[0] + ox, q[1] + oy) : ctx.moveTo(q[0] + ox, q[1] + oy))); ctx.closePath(); ctx.fill();
    }
  }

  // guy lines and stakes behind the tent first, the near ones after
  const guys = [];
  if (s.guys > 0 && r > 0.5) {
    guys.push({ a: P3([0, L2 + 0.1, Hr * r + 0.25]), p: [0, L2 + 5.2] }, { a: P3([0, -L2 - 0.1, Hr * r + 0.25]), p: [0, -L2 - 5.2] });
    for (const sd of [-1, 1]) for (const i of [2, 8]) guys.push({ a: P3(mesh[sd][i][NV]), p: [sd * (Ws + 3.6), (L2 - 2 * L2 * i / NU) * 1.15], sd });
    guys.length = Math.min(guys.length, s.guys);
  }
  const drawGuy = (g, idx) => {
    const p = F(g.p[0], g.p[1], 0), a = g.a;
    const sway = Math.sin(windPh * 3.3 + idx * 1.7) * (0.1 + 0.5 * wind) * 0.35 + (wind > 0.55 ? Math.sin(state.time * 43 + idx * 2.1) * (wind - 0.55) * 0.35 : 0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + p[0]) / 2 + sway, (a[1] + p[1]) / 2 + 0.25, p[0], p[1]);
    ctx.lineWidth = lwF; ctx.strokeStyle = 'rgba(66,66,68,0.8)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p[0], p[1] + 0.15); ctx.lineTo(p[0] - 0.08, p[1] - 0.6);
    ctx.lineWidth = inkW(0.3); ctx.strokeStyle = '#4a4a4c'; ctx.stroke();
  };
  guys.forEach((g, i) => { if (F.depth(g.p[0], g.p[1]) < 0) drawGuy(g, i); });

  // the faces of the tent, drawn the far-facing ones first (it's convex)
  const faces = [];
  const rot = (nx, ny) => F.rot(nx, ny)[1];
  for (const sd of [-1, 1]) {
    const H = Hr * r, wE = lerp(WF, Wr, r), nl = Math.hypot(H - He * r, wE) || 1;
    faces.push({ key: rot(sd * (H - He * r) / nl, 0) * (r > 0.15 ? 1 : 0) + (r > 0.15 ? 0 : sd * 0.01), kind: 'roof', sd });
    if (r > 0.15) faces.push({ key: rot(sd, 0), kind: 'skirt', sd });
  }
  if (r > 0.12) { faces.push({ key: rot(0, 1), kind: 'gable', end: 1 }); faces.push({ key: rot(0, -1), kind: 'gable', end: -1 }); }
  faces.sort((a, b) => a.key - b.key);

  for (const f of faces) {
    if (f.kind === 'roof') {
      const m = mesh[f.sd];
      const H = Hr * r, wE = lerp(WF, Wr, r);
      const nB = F.rot(f.sd * (H - He * r), 0), lB = lam(nB[0], nB[1], wE);
      const base = 208 + 36 * lB;
      for (let i = 0; i < NU; i++) {
        const A = m[i][0], B = m[i + 1][0], Cc = m[i + 1][NV], D = m[i][NV];
        const e1 = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]], e2 = [D[0] - B[0], D[1] - B[1], D[2] - B[2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (n[2] < 0) n = n.map(q => -q);
        const nw = F.rot(n[0], n[1]);
        const tone = Math.min(246, base + 70 * (lam(nw[0], nw[1], n[2]) - lB));
        // (cell by cell: a sheet bellied far enough folds over itself on screen, and one polygon for
        // the whole strip would cancel out where it overlaps)
        ctx.fillStyle = yel(tone); ctx.lineWidth = 0.22; ctx.strokeStyle = ctx.fillStyle;
        ctx.beginPath();
        for (let k = 0; k < NV; k++) {
          const q = [m[i][k], m[i][k + 1], m[i + 1][k + 1], m[i + 1][k]].map(P3);
          if ((q[1][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[3][0] - q[0][0]) < 0) q.reverse();
          ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.closePath();
        }
        ctx.fill(); ctx.stroke();
      }
      if (r > 0.3) {
        // soft gradient: lighter at the ridge, greyer toward the eave
        const outline = [...m.map(c => P3(c[0])), ...m[NU].map(P3), ...m.slice().reverse().map(c => P3(c[NV])), ...m[0].slice().reverse().map(P3)];
        const r0 = P3(m[NU >> 1][0]), e0 = P3(m[NU >> 1][NV]);
        const gr = ctx.createLinearGradient(r0[0], r0[1], e0[0], e0[1]);
        gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(0.6, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(90,92,96,0.16)');
        poly(ctx, outline); ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
      }
      // folds from the pole tops and up from the guy points; the eave and end edges inked
      if (r > 0.3) {
        for (const [u0, u1] of [[0.01, 0.2], [0.99, 0.8], [0.2, 0.17], [0.8, 0.83]]) {
          const pts = [];
          for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push(P3(canvas3(s, f.sd, lerp(u0, u1, t), lerp(0.03, 0.95, t), wl, TMP))); }
          inkLine(ctx, pts, lwF, deepA(0.4 * r), u0 * 40 + f.sd, 0.12);
        }
      }
      if (s.billow > 0.12) inkLine(ctx, m.map(c => P3(c[2])), lwM, INK, 23 + f.sd, 0.05);   // the bellied sheet's swell
      inkLine(ctx, m.map(c => P3(c[NV])), lwM, INK, 21 + f.sd);
      inkLine(ctx, m[0].map(P3), lwM, INK, 31 + f.sd);
      inkLine(ctx, m[NU].map(P3), lwM, INK, 33 + f.sd);
      if (r <= 0.15) inkLine(ctx, m.map(c => P3(c[0])), lwF, deepA(0.5), 35 + f.sd, 0.1);   // the fold down the middle of the flat sheet
      else inkLine(ctx, m.map(c => P3(c[0])), inkW(0.36), INK, 41 + f.sd, 0.02);           // the ridge
    } else if (f.kind === 'skirt') {
      const top = mesh[f.sd].map(c => c[NV]);
      const bot = top.map(q => [f.sd * (Math.abs(q[0]) + (Ws - Wr) * r), q[1], 0]);
      const nW = F.rot(f.sd, 0);
      poly(ctx, [...top.map(P3), ...bot.slice().reverse().map(P3)]); ctx.closePath();
      ctx.fillStyle = yel(176 + 38 * lam(nW[0], nW[1], 0.3)); ctx.fill();
      inkLine(ctx, bot.map(P3), lwM, INK, 11 + f.sd);
    } else {
      // a gable: the end of the canvas down to the snow, with the door on the front one
      const e = f.end, i = e > 0 ? 0 : NU;
      const ap = mesh[-1][i][0], eL = mesh[-1][i][NV], eR = mesh[1][i][NV];
      const gL = [eL[0] - (Ws - Wr) * r, eL[1], 0], gR = [eR[0] + (Ws - Wr) * r, eR[1], 0];
      const nW = F.rot(0, e);
      const tone = 204 + 40 * lam(nW[0], nW[1], 0);
      const pts = [gL, eL, ap, eR, gR].map(P3);
      poly(ctx, pts); ctx.closePath();
      ctx.fillStyle = yel(tone); ctx.fill();
      inkLine(ctx, [pts[1], pts[2], pts[3]], lwM, INK, 65 + e, 0.03);
      inkLine(ctx, [pts[0], pts[4]], lwM, INK, 67 + e, 0.05);
      inkLine(ctx, [P3([0, ap[1], ap[2] - 0.3]), P3([0, ap[1], 0.3])], lwF, deepA(0.35 * r), 69 + e, 0.2);
      if (e > 0 && r > 0.5) {
        // the door: a dark slit (lamp-lit when someone's in), one flap pinned back, one loose
        const dh = ap[2] * 0.72, dw = 1.9 * r;
        const k = clamp(Math.max(doorLit, glow * 2.2));
        const dA = P3([0, L2 + 0.03, dh]), dL = P3([-dw, L2 + 0.03, 0]), dR = P3([dw, L2 + 0.03, 0]);
        poly(ctx, [dA, dR, dL]); ctx.closePath();
        ctx.fillStyle = k > 0.02 ? rgb(mix([61, 61, 63], [255, 226, 150], k)) : '#3d3d3f'; ctx.fill();
        const xf = dw - 1.0 + Math.sin(windPh * 4.6) * (0.25 + 0.5 * wind) + gust * 0.6 - 0.2 * wind;
        const rf = [dA, dR, P3([xf, L2 + 0.3 + 0.3 * wind, 0.1]), P3([xf * 0.5 + Math.sin(windPh * 6.3) * 0.25 * wind, L2 + 0.2, dh * 0.5])];
        poly(ctx, rf); ctx.closePath(); ctx.fillStyle = yel(tone + 6); ctx.fill();
        inkLine(ctx, [...rf, dA], lwF, SIGNAL.deep, 63, 0);
        const lf = [P3([-0.25, L2 + 0.05, dh - 0.3]), dL, P3([-dw - 1.2, L2 + 0.3, 0.15]), P3([-dw - 0.3, L2 + 0.2, 1.6])];
        poly(ctx, lf); ctx.closePath(); ctx.fillStyle = yel(tone - 16); ctx.fill();
        inkLine(ctx, [...lf, lf[0]], lwF, SIGNAL.deep, 61, 0);
      }
      // the pole: its tip through the canvas at the peak
      if (r > 0.3) inkLine(ctx, [P3(ap), P3([ap[0] + (s.lean ? wl.x * s.lean : 0), ap[1] + e * 0.05, ap[2] + 0.9 * r])], inkW(0.3), INK, 71 + e, 0);
    }
  }
  // in a collapse the two poles go over downwind, end to end, and lie on the snow until it's gathered
  if (s.lean > 0.02) {
    const th = s.lean * 1.45, sn = Math.sin(th), cs = Math.cos(th), wn = Math.hypot(wl.x, wl.y) || 1;
    for (const e of [-1, 1]) {
      const b0 = [0, e * (L2 - 0.3), 0], tip = [b0[0] + wl.x / wn * sn * Hr, b0[1] + wl.y / wn * sn * Hr * 0.3, cs * Hr + 0.3];
      const A = P3(b0), Bq = P3(tip);
      inkLine(ctx, [A, Bq], inkW(0.42), INK, 85 + e, 0);
      inkLine(ctx, [[A[0] - 0.08, A[1] - 0.08], [Bq[0] - 0.08, Bq[1] - 0.08]], inkW(0.14), 'rgba(170,170,172,0.9)', 87 + e, 0);
    }
  }
  // the roll of canvas still to spread
  if (s.spread < 0.999 && r < 0.05) {
    const rr0 = 0.35 + 0.55 * (1 - s.spread);
    const a = F(xMax, -L2, rr0), b = F(xMax, L2, rr0);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = rr0 * 2 + lwM; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = rr0 * 2; ctx.strokeStyle = yel(214); ctx.stroke();
    ctx.lineWidth = rr0 * 0.6; ctx.strokeStyle = yel(234);
    ctx.beginPath(); ctx.moveTo(a[0] - 0.2, a[1] - rr0 * 0.45); ctx.lineTo(b[0] - 0.2, b[1] - rr0 * 0.45); ctx.stroke();
    // the poles and stakes laid beside it
    const p0 = F(-WF - 1.2, -L2 * 0.8, 0.1), p1 = F(-WF - 1.2, L2 * 0.6, 0.1);
    inkLine(ctx, [p0, p1], inkW(0.28), '#3c3c3e', 81, 0);
    inkLine(ctx, [F(-WF - 1.8, -L2 * 0.7, 0.1), F(-WF - 1.8, L2 * 0.7, 0.1)], inkW(0.28), '#3c3c3e', 83, 0);
  }
  // snow drifting up on the windward skirt, over time
  const p = pup.pitched;
  if (p && !pup.job && p.snow > 0.05) {
    const sd = wl.x > 0 ? -1 : 1, inner = [], outer = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8, ly = L2 - 2 * L2 * u, b = Math.pow(Math.sin(Math.PI * u), 0.6) * p.snow;
      inner.push(F(sd * (Ws - 0.1), ly, 0.3 + 1.1 * b));
      outer.push(F(sd * (Ws + 0.6 + 2.6 * b), ly, 0));
    }
    poly(ctx, [...inner, ...outer.slice().reverse()]); ctx.closePath();
    ctx.fillStyle = '#f8f8f6'; ctx.fill();
    inkLine(ctx, inner, lwF, 'rgba(140,142,146,0.8)', 3, 0.15);
  }
  guys.forEach((g, i) => { if (F.depth(g.p[0], g.p[1]) >= 0) drawGuy(g, i); });
}

// Standing, it's drawn into a small canvas at screen resolution and refreshed at a modest rate (the
// wind's motion is slow; as camp.js does for base camp's tent), then blitted every frame; a little
// oftener while it's being pitched or struck.
const sprite = { cv: null, t: -1e9, s: 0, key: '' };
const HZ = { high: 15, medium: 12, low: 8 };
function boxOf(o) {
  const F = projFor(o);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const lx of [-T.Ws - 5, T.Ws + 5]) for (const ly of [-T.L2 - 6.5, T.L2 + 6.5]) for (const h of [0, T.Hr + 2.5]) {
    const [x, y] = F(lx, ly, h); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0: x0 - 2, y0: y0 - 2, x1: x1 + 2, y1: y1 + 2 };
}
function drawCached(ctx, s) {
  const sc = zoom() * (state.view.dpr || 1), now = performance.now() / 1000, o = s.o;
  const key = o.x + ',' + o.y + ',' + o.yaw + ',' + (Math.round(glow * 40) + (state.time - pup.nope < 0.45 ? 1000 : 0) + Math.round((o.snow || 0) * 20) * 7);
  if (!sprite.cv) sprite.cv = document.createElement('canvas');
  if (Math.abs(sc - sprite.s) / sc > 0.02 || now - sprite.t >= 1 / ((HZ[state.quality?.level] || 15) * (pup.job ? 1.4 : 1)) || key !== sprite.key) {
    const b = boxOf(o), w = Math.ceil((b.x1 - b.x0) * sc) + 2, h = Math.ceil((b.y1 - b.y0) * sc) + 2;
    if (sprite.cv.width !== w || sprite.cv.height !== h) { sprite.cv.width = w; sprite.cv.height = h; }
    const c = sprite.cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.setTransform(sc, 0, 0, sc, -b.x0 * sc, -b.y0 * sc);
    drawPup(c, s);
    Object.assign(sprite, { s: sc, t: now, key, x0: b.x0, y0: b.y0, w: w / sc, h: h / sc });
  }
  ctx.drawImage(sprite.cv, sprite.x0, sprite.y0, sprite.w, sprite.h);
}
const TMP = [0, 0, 0];
const draws = [], item = { x: 0, y: 0, s: null, draw: ctx => drawCached(ctx, item.s) };
export function drawables() {
  draws.length = 0;
  const s = shapeNow();
  if (!s || !onScreen(s.o)) return draws;
  item.x = s.o.x; item.y = s.o.y; item.s = s;
  draws.push(item);
  return draws;
}

export function drawSky(ctx) {
  for (const q of steam) {
    // stove smoke, as base camp's (a touch smaller): a pale grey thread that swells and thins as it goes
    const t = q.age / q.life, r = 0.5 + t * 2.3, a = Math.min(1, q.age * 3) * (1 - t) * (1 - t * 0.5);
    ctx.beginPath(); ctx.arc(q.x + r * 0.2, q.y + r * 0.2, r, 0, TAU);
    ctx.fillStyle = `rgba(96,100,106,${a * 0.5})`; ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.85, 0, TAU);
    ctx.fillStyle = `rgba(178,181,185,${a * 0.8})`; ctx.fill();
  }
}
