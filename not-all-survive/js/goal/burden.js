// The goal, part 2 (Joe): bring the lost explorer home. Once their pack has been opened
// (goal/distress.js D.found), a press on them shows a small row of round slots above them (ui/pack.js
// draws and routes it, this module says what's in it):
//   Open their pack            the container, as before
//   Wrap them                  needs a canvas sheet AND a rope in the pack (both used up; greyed with a
//                              tip saying what's missing). The explorer kneels at them and works ~5 s
//                              (walking off stops it, nothing used); the body becomes a wrapped bundle:
//                              an inked canvas shroud tied with rope bands. Anything left in their pack
//                              is left beside them in a pile.
// A press on the bundle (or Space / E by it):
//   Carry on your back         hoisted across the shoulders (CARRY: x0.5 pace, x1.9 energy, but deep snow
//                              is no worse than plain snow; doubled load on thin ice and lake ice; no
//                              climbing: refuse 'burden'; the pack opens only to eat, drink, play a
//                              recorder or the radio)
//   Drag behind you            on a rope, trailing like a light sled (DRAG: x0.75 pace on snow, a path or
//                              ice, x0.55 of deep snow's pace; x1.4 energy; no climbing). It ploughs a trench in
//                              the snow, snags on rock (and holds the explorer back until they come back
//                              round it) and bears on thin ice and lake ice where it lies.
// While carrying or dragging, a press on the explorer (or C) shows the same kind of row above their
// head instead of the pack: Set them down, Switch to dragging / carrying, Open the pack.
// The burden comes off by itself: at death (left where it is), going into the water deep, knocked
// down (carried), sat down spent, crawling into a tent (set down at the door).
// Home: the bundle carried or dragged within HOME_R of base camp's tent ends the loop (once it has been
// further out than AWAY_R, which the real one always has): it's set down, and a quiet card
// comes up (drawOverlay: "They brought them home", the party lost on the way, tap to go on). Easy to
// replace: it's all in drawCard().
//
// state.burden = { bundle, mode: null | 'carry' | 'drag', job, home, card, snag }
//   bundle = { hx, hy, fx, fy (head and feet ends, world), snow, held (on someone's back) } | null
//   job = { kind: 'wrap' | 'hoist' | 'rope' | 'down', t, dur, x, y } (explorer.js kneels to it, body.js
//   counts it as work)
// Explorer.js reads mode (pace, pose, the bundle on the back, ice load, refusing a climb) and writes
// player.ropeAt (where the rope meets the shoulder, world) while dragging; body.js reads mode (drain).
// Pushes events: goal { stage: 'wrapped' | 'carry' | 'drag' | 'down' | 'home' }, wrap { stage: 'start' |
// 'tie' | 'done' | 'stop' }, snag { x, y } (the bundle caught on rock, the rope pulled taut).
// Hooks: NAS.goal = { state, wrapped() (a wrapped bundle beside the explorer, as ?goal=wrapped),
// wrap(), carry(), drag(), down(), switchMode(), home() (carry the bundle to the tent door) }.
import { state } from '../state.js';
import * as T from '../world/terrain.js';
import * as ICE from '../world/thinice.js';
import { visibleRect } from '../camera.js';
import { TENT, campBlocked } from '../actors/camp.js';
import { pupBlocked } from '../actors/puptent.js';
import { find, take, dropAt, isEmpty } from '../items.js';

export const CARRY = { pace: 0.5, drain: 1.9, ice: 2 };
export const DRAG = { pace: 0.75, deep: 0.55, drain: 1.4, ice: 0.7 };   // (deep: of deep snow's own pace, ~3 px/s)
const KY = 0.8;
const LEN = 13;                 // the bundle, head to foot (world units; the explorer is ~16 tall)
const ROPE = 9, SLACK = 1.2;    // the drag rope, from the shoulder to the head of the bundle
const REACH = 16, HOME_R = 40, AWAY_R = 120;
const JOB_S = { wrap: 5, hoist: 1.4, rope: 0.9, down: 0.8 };
const BEAR_NEAR = 60;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

const P = state.player;
const B = state.burden = { bundle: null, mode: null, job: null, home: false, card: null, snag: 0, px: 0, py: 0, land: null };
let booted = false, tieT = 0, lastC = null;
const trench = [];              // the dragged trench: { x, y, a, t (terrain), fill, gap (no join to the one before) }
const TRENCH_MAX = 420;
const RATE = { deep: 1 / 170, snow: 1 / 130, path: 1 / 60, ice: 1 / 18, thin: 1 / 16 };

// --- geometry ---------------------------------------------------------------------------------------------
const center = b => ({ x: (b.hx + b.fx) / 2, y: (b.hy + b.fy) / 2 });
const gdist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, (y1 - y0) / KY);   // on the ground plane
function place(b, cx, cy, a) {
  const ux = Math.cos(a) * LEN / 2, uy = Math.sin(a) * LEN / 2 * KY;
  b.hx = cx + ux; b.hy = cy + uy; b.fx = cx - ux; b.fy = cy - uy;
}
// may the bundle lie (or be dragged) here? Walkable ground, not rock (it catches), not the camp. (Open water
// is let through: it floats; the explorer can't take it out of their depth anyway.)
function okAt(x, y) {
  try { return T.isWalkable(x, y) !== false && T.terrainAt(x, y) !== 'rock' && !campBlocked(x, y) && !pupBlocked(x, y); } catch { return true; }
}
function fits(cx, cy, a) {
  for (const k of [-0.5, -0.25, 0, 0.25, 0.5]) if (!okAt(cx + Math.cos(a) * LEN * k, cy + Math.sin(a) * LEN * k * KY)) return false;
  return true;
}
// distance (ground plane) from (x, y) to the bundle's axis
function axisDist(b, x, y) {
  const ax = b.fx, ay = b.fy / KY, bx = b.hx, by = b.hy / KY, px = x, py = y / KY;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
// the nearest point on the axis to (x, y): where the explorer kneels to it
function axisPoint(b, x, y) {
  const dx = b.hx - b.fx, dy = (b.hy - b.fy) / KY, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - b.fx) * dx + ((y - b.fy) / KY) * dy) / l2, 0.2, 0.8);
  return { x: b.fx + (b.hx - b.fx) * t, y: b.fy + (b.hy - b.fy) * t };
}
// where to set it down beside the explorer: along their facing, at one side, else behind, else in front,
// else at their feet
function downSpot(px = P.x, py = P.y, f = P.facing) {
  const c = Math.cos(f), s = Math.sin(f), n = [-s, c];
  const cands = [[n[0] * 5, n[1] * 5], [-n[0] * 5, -n[1] * 5], [-c * 9, -s * 9], [c * 9, s * 9], [n[0] * 8, n[1] * 8], [-n[0] * 8, -n[1] * 8]];
  for (const [dx, dy] of cands) { const x = px + dx, y = py + dy * KY; if (fits(x, y, f)) return { x, y, a: f }; }
  for (let k = 0; k < 8; k++) { const a = f + k * Math.PI / 4; if (fits(px, py, a)) return { x: px, y: py, a }; }
  return { x: px, y: py, a: f };
}

// --- what's offered (ui/pack.js shows it as a row of round slots) -------------------------------------
const D = () => state.distress;
const lostOne = () => (state.fallen || []).find(f => f.distress);
export const bodyReady = () => !!D()?.found && !D().wrapped && !!lostOne();
export const ACTS = { body: ['theirpack', 'wrap'], bundle: ['carry', 'drag'], self: ['down', 'switch', 'pack'] };
const NAMES = { theirpack: 'Open their pack', wrap: 'Wrap them', carry: 'Carry on your back', drag: 'Drag behind you', down: 'Set them down', pack: 'Open the pack' };
export function actName(id) {
  if (id === 'switch') return B.mode === 'carry' ? 'Switch to dragging' : 'Switch to carrying';
  return NAMES[id] || id;
}
// why it can't be done now ('' = it can)
export function actWhy(id) {
  const pk = state.pack;
  if (id === 'wrap') {
    const sh = pk && find(pk, 'sheet') >= 0, ro = pk && find(pk, 'rope') >= 0;
    if (!sh && !ro) return 'needs a canvas sheet and a rope';
    if (!sh) return 'needs a canvas sheet';
    if (!ro) return 'needs a rope';
    return '';
  }
  if (id === 'theirpack') { const f = lostOne(); return !f || !f.pack || isEmpty(f.pack) ? 'nothing left in it' : ''; }
  if ((id === 'carry' || id === 'drag') && B.mode) return 'already burdened';
  return '';
}
// Do it. Returns what ui/pack.js has to open itself: 'pack' | 'theirpack' | null.
export function doAct(id) {
  if (actWhy(id)) return null;
  if (id === 'pack' || id === 'theirpack') return id;
  const b = B.bundle;
  if (id === 'wrap') { const d = D(); startJob('wrap', d.x, d.y); state.events.push({ type: 'wrap', stage: 'start', x: d.x, y: d.y }); }
  else if (id === 'carry' && b) { const p = axisPoint(b, P.x, P.y); startJob('hoist', p.x, p.y); }
  else if (id === 'drag' && b) { const near = gdist(P.x, P.y, b.hx, b.hy) < gdist(P.x, P.y, b.fx, b.fy); startJob('rope', near ? b.hx : b.fx, near ? b.hy : b.fy); }
  else if (id === 'down') { if (B.mode === 'carry') { const s = downSpot(); startJob('down', s.x, s.y); } else setDown(); }
  else if (id === 'switch') {
    if (B.mode === 'carry') {
      // set them down behind, the head toward the explorer, and take up the rope
      const c = Math.cos(P.facing), s = Math.sin(P.facing);
      let spot = { x: P.x - c * (LEN / 2 + 3), y: P.y - s * (LEN / 2 + 3) * KY, a: P.facing };
      if (!fits(spot.x, spot.y, spot.a)) spot = downSpot();
      setDown(spot);
      startJob('rope', B.bundle.hx, B.bundle.hy);
    } else if (B.mode === 'drag' && b) {
      B.mode = null;
      const p = axisPoint(b, P.x, P.y); startJob('hoist', p.x, p.y);
    }
  }
  return null;
}
// a press at world (x, y), screen zoom z: on the lying bundle?
export function bundleAt(x, y, z = 1) {
  const b = B.bundle;
  if (!b || b.held || B.mode === 'drag') return false;
  return axisDist(b, x, y + 1.2) < Math.max(3.4, 11 / z);
}
// how far the explorer is from it (Infinity when there's none lying free), and its glint / UI anchor
export const bundleDist = () => { const b = B.bundle; return !b || b.held || B.mode === 'drag' ? Infinity : axisDist(b, P.x, P.y); };
export const bundleAnchor = () => { const b = B.bundle; if (!b) return null; const c = center(b); return { x: c.x, y: c.y - 2 }; };
export const BUNDLE_REACH = REACH;
export function bundleWalkPoint() {
  const b = B.bundle, p = axisPoint(b, P.x, P.y), d = gdist(P.x, P.y, p.x, p.y) || 1, k = 5 / d;
  return { x: p.x + (P.x - p.x) * k, y: p.y + (P.y - p.y) * k };
}
export const busy = () => !!B.job;
export const cardUp = () => !!B.card;
export function dismissCard() { if (B.card && B.card.t > 1.6) B.card = null; return true; }

// --- jobs: kneeling at the work ------------------------------------------------------------------------
function startJob(kind, x, y) {
  B.job = { kind, t: 0, dur: JOB_S[kind], x, y };
  tieT = kind === 'wrap' ? 1.2 : 99;
}
function stopJob() {
  if (B.job?.kind === 'wrap') state.events.push({ type: 'wrap', stage: 'stop', x: B.job.x, y: B.job.y });
  B.job = null;
  if (D()) D().wrapK = 0;
}
function finishJob() {
  const J = B.job, d = D();
  B.job = null;
  if (J.kind === 'wrap') {
    const pk = state.pack, i = find(pk, 'sheet'), j = find(pk, 'rope');
    if (i < 0 || j < 0) { d.wrapK = 0; return; }
    take(pk, i, 1); take(pk, find(pk, 'rope'), 1);
    wrapNow();
    state.events.push({ type: 'wrap', stage: 'done', x: d.x, y: d.y });
  } else if (J.kind === 'hoist') {
    B.mode = 'carry'; B.bundle.held = true;
    state.events.push({ type: 'goal', stage: 'carry', x: P.x, y: P.y });
  } else if (J.kind === 'rope') {
    const b = B.bundle;
    // the end nearer the explorer is the one the rope goes to
    if (gdist(P.x, P.y, b.fx, b.fy) < gdist(P.x, P.y, b.hx, b.hy)) { [b.hx, b.fx] = [b.fx, b.hx]; [b.hy, b.fy] = [b.fy, b.hy]; }
    b.held = false; b.crumbs = [{ x: b.fx, y: b.fy }, { x: b.hx, y: b.hy }];
    B.mode = 'drag'; B.snag = 0; lastC = null;
    state.events.push({ type: 'goal', stage: 'drag', x: P.x, y: P.y });
  } else if (J.kind === 'down') setDown({ x: J.x, y: J.y, a: P.facing });
}
// the body becomes the bundle where it lay (head to the west, as it lay); what's left in their pack is
// left in a pile beside it
function wrapNow() {
  const d = D(), f = lostOne();
  if (f) {
    if (f.pack) for (const s of f.pack.slots) if (s) dropAt(d.x + 2, d.y + 6, s.id, s.n, s);
    state.fallen.splice(state.fallen.indexOf(f), 1);
  }
  d.wrapped = true; d.found = true; d.wrapK = 1;
  B.bundle = { hx: 0, hy: 0, fx: 0, fy: 0, snow: 0, held: false, away: false };
  place(B.bundle, d.x, d.y - 0.5, Math.PI);
  state.events.push({ type: 'goal', stage: 'wrapped', x: d.x, y: d.y });
}
// Off the back (or the rope let go): carried, it goes down at spot (or beside them); dragged, it stays
// where it lies.
function setDown(spot = null) {
  const b = B.bundle;
  if (!b) { B.mode = null; return; }
  if (B.mode === 'carry' || b.held) {
    const s = spot || (P.water?.level && B.land ? downSpot(B.land.x, B.land.y, B.land.f) : downSpot());
    place(b, s.x, s.y, s.a);
    b.held = false;
  }
  B.mode = null; B.snag = 0; b.crumbs = null; lastC = null;
  state.events.push({ type: 'goal', stage: 'down', x: P.x, y: P.y });
}

// --- the drag --------------------------------------------------------------------------------------------
// The rope runs from the explorer's shoulder (ground point just behind them) to the head of the bundle.
// Slack, nothing moves; taut, the head is drawn after them (never onto rock: it snags, and the explorer
// is held at the rope's length until they come back round); the feet follow the head's own track, so the
// body only ever goes where the head went (like a sled on its runners).
function updateDrag(dt) {
  const b = B.bundle;
  if (!b) { B.mode = null; return; }
  const ax = P.x - Math.cos(P.facing) * 1.4, ay = P.y - Math.sin(P.facing) * 1.4 * KY;
  let d = gdist(ax, ay, b.hx, b.hy);
  const ox = b.hx, oy = b.hy;
  if (d > ROPE) {
    const ux = (b.hx - ax) / d, uy = (b.hy - ay) / KY / d;
    const tx = ax + ux * ROPE, ty = ay + uy * ROPE * KY;
    if (okAt(tx, ty)) { b.hx = tx; b.hy = ty; }
    else if (okAt(tx, b.hy)) b.hx = tx;
    else if (okAt(b.hx, ty)) b.hy = ty;
  }
  d = gdist(ax, ay, b.hx, b.hy);
  if (d > ROPE + SLACK) {
    // snagged: held at the rope's length (only ever back toward it: walking back to it is free)
    const bx = B.px - Math.cos(P.facing) * 1.4, by = B.py - Math.sin(P.facing) * 1.4 * KY;
    if (d > gdist(bx, by, b.hx, b.hy) - 0.01) { P.x = B.px; P.y = B.py; P.vx *= 0.3; P.vy *= 0.3; }
    if (B.snag <= 0) state.events.push({ type: 'snag', x: b.hx, y: b.hy });
    B.snag += dt;
  } else B.snag = 0;
  // the feet along the head's track
  const cr = b.crumbs || (b.crumbs = [{ x: b.fx, y: b.fy }, { x: b.hx, y: b.hy }]);
  const last = cr[cr.length - 1];
  if (gdist(last.x, last.y, b.hx, b.hy) > 0.8) cr.push({ x: b.hx, y: b.hy });
  else { last.x = b.hx; last.y = b.hy; }
  let need = LEN, i = cr.length - 1, fx = cr[0].x, fy = cr[0].y;
  for (; i > 0; i--) {
    const a = cr[i], q = cr[i - 1], l = gdist(a.x, a.y, q.x, q.y);
    if (l >= need) { const k = need / l; fx = a.x + (q.x - a.x) * k; fy = a.y + (q.y - a.y) * k; break; }
    need -= l;
  }
  if (i > 1) cr.splice(0, i - 1);
  b.fx = fx; b.fy = fy;
  // the trench it ploughs, and its weight on the ice
  const c = center(b), moved = Math.hypot(b.hx - ox, (b.hy - oy) / KY);
  const ter = T.terrainAt(c.x, c.y);
  if (!lastC || gdist(lastC.x, lastC.y, c.x, c.y) > 1.3) {
    if (RATE[ter] && !T.isWater(c.x, c.y)) {
      trench.push({ x: c.x, y: c.y, a: Math.atan2((b.hy - b.fy) / KY, b.hx - b.fx), t: ter, fill: 0, gap: !lastC || gdist(lastC.x, lastC.y, c.x, c.y) > 4 });
      if (trench.length > TRENCH_MAX) trench.splice(0, trench.length - TRENCH_MAX);
    }
    lastC = { x: c.x, y: c.y };
  }
  if (ter === 'thin' || ter === 'ice') ICE.weigh(c.x, c.y, dt, DRAG.ice, clamp(moved / dt / 4.2, 0, 2));
}

// --- the frame -------------------------------------------------------------------------------------------
const DROP_ANY = new Set(['swim', 'sink', 'collapse', 'dead', 'crawlout', 'tent-in', 'inside', 'gone']);
const bearClose = () => { const b = state.bear; return !!b && (b.st === 'alert' || b.st === 'stalk') && Math.hypot(b.x - P.x, b.y - P.y) < BEAR_NEAR; };
export function update(dt) {
  const d = D();
  if (!d?.ready) return;
  if (!booted) {
    booted = true;
    if (state.params.get('goal') === 'wrapped') debugWrapped();
  }
  const alive = !state.body || state.body.phase === 'alive';
  if (!P.water?.level && P.mode === 'walk') B.land = { x: P.x, y: P.y, f: P.facing };
  // the work in hand: walking off (or anything else happening to them) stops it
  if (B.job) {
    const J = B.job;
    if (!alive || (P.moving && P.speed > 2) || P.mode !== 'walk' || P.spent || bearClose()) stopJob();
    else {
      J.t += dt;
      if (J.kind === 'wrap') {
        d.wrapK = J.t / J.dur;
        tieT -= dt;
        if (tieT <= 0 && J.t > J.dur * 0.5) { tieT = 0.7 + Math.random() * 0.3; state.events.push({ type: 'wrap', stage: 'tie', x: J.x, y: J.y }); }
      }
      if (J.t >= J.dur) finishJob();
    }
  }
  // the burden comes off by itself
  if (B.mode) {
    const m = P.mode;
    if (!alive || DROP_ANY.has(m) || P.spent || (B.mode === 'carry' && m === 'down')) setDown();
  }
  if (B.mode === 'drag') updateDrag(dt);
  // home: the bundle by base camp's tent
  const b = B.bundle;
  // (only once it has been out there: a bundle set down at camp by the debug hook doesn't count until it's
  // been taken AWAY_R out and back)
  if (b && !B.home && alive) {
    const c = b.held ? P : center(b), dc = Math.hypot(c.x - TENT.x, c.y - TENT.y);
    if (dc > AWAY_R) b.away = true;
    if (b.away && B.mode && dc < HOME_R) {
      B.home = true;
      if (B.mode) setDown();
      const lost = (state.party || []).filter(q => !q.alive).map(q => q.name);
      B.card = { t: 0, lost };
      state.events.push({ type: 'goal', stage: 'home', x: c.x, y: c.y, lost });
    }
  }
  if (B.card) B.card.t += dt;
  // snow settles on it lying out
  if (b && !b.held && B.mode !== 'drag') b.snow = Math.min(0.7, b.snow + dt * (0.0012 + 0.006 * (state.weather.snowfall ?? 0.3)));
  else if (b) b.snow = Math.max(0, b.snow - dt * 0.05);
  // the trench fills in (as footprints do)
  if (trench.length) {
    const w = 1 + 2.5 * (state.weather.snowfall ?? 0) + 1.5 * (state.wind.speed ?? 0) + (state.weather.whiteout ?? 0) * 2;
    for (let i = trench.length - 1; i >= 0; i--) { const p = trench[i]; p.fill += dt * RATE[p.t] * w; if (p.fill >= 1) trench.splice(i, 1); }
  }
  B.px = P.x; B.py = P.y;
}

// --- drawing ---------------------------------------------------------------------------------------------
// The trench: a shallow ploughed groove the width of the bundle, shadowed on its upper-left wall with a
// lit lip on the lower right, deeper and darker in deep snow, filling in with time.
export function drawGround(ctx) {
  if (trench.length < 2) return;
  const r = visibleRect(10);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // three passes: the soft trough, its shadowed floor, the lit lip; batched into 4 alpha bands each
  const passes = [[3.0, 'rgba(150,154,160,', 0.42, 0, 0], [1.4, 'rgba(112,116,124,', 0.4, -0.25, -0.35], [0.55, 'rgba(252,252,252,', 0.85, 0.5, 1.35]];
  for (const [wd, col, al, ox, oy] of passes) {
    for (let band = 0; band < 4; band++) {
      ctx.beginPath();
      let any = false;
      for (let i = 1; i < trench.length; i++) {
        const p = trench[i], q = trench[i - 1];
        if (p.gap || Math.min(3, Math.floor(p.fill * 4)) !== band) continue;
        if (p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
        ctx.moveTo(q.x + ox, q.y + oy); ctx.lineTo(p.x + ox, p.y + oy); any = true;
      }
      if (!any) continue;
      const life = 1 - Math.pow((band + 0.5) / 4, 2);
      const deepK = 1;   // (deep-snow segments are drawn again below, darker)
      ctx.strokeStyle = `${col}${(al * life * deepK).toFixed(3)})`; ctx.lineWidth = wd; ctx.stroke();
    }
  }
  // deep snow: the trough is ploughed deep, a second darker floor
  ctx.beginPath();
  let any = false;
  for (let i = 1; i < trench.length; i++) {
    const p = trench[i], q = trench[i - 1];
    if (p.gap || p.t !== 'deep' || p.fill > 0.6 || p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
    ctx.moveTo(q.x - 0.2, q.y - 0.2); ctx.lineTo(p.x - 0.2, p.y - 0.2); any = true;
  }
  if (any) { ctx.strokeStyle = 'rgba(120,124,132,0.22)'; ctx.lineWidth = 2.2; ctx.stroke(); }
}

const items = [];
const bundleItem = { x: 0, y: 0, draw: ctx => drawLying(ctx) };
const wrapItem = { x: 0, y: 0, draw: ctx => drawWrapping(ctx) };
export function drawables() {
  items.length = 0;
  const r = visibleRect(30);
  const b = B.bundle;
  if (b && !b.held) {
    const c = center(b);
    if (c.x > r.x0 && c.x < r.x1 && c.y > r.y0 && c.y < r.y1) { bundleItem.x = c.x; bundleItem.y = c.y + 0.5; items.push(bundleItem); }
  }
  const d = D(), J = B.job;
  if (J && J.kind === 'wrap' && d) { wrapItem.x = d.x; wrapItem.y = d.y + 0.6; items.push(wrapItem); }
  return items;
}
function drawLying(ctx) {
  const b = B.bundle;
  if (B.mode === 'drag') drawRope(ctx, b);
  drawBundle(ctx, b.hx, b.hy, b.fx, b.fy, b.snow, 1);
  if (B.mode === 'drag' && P.ropeAt && Math.sin(P.facing) < 0) drawRope(ctx, b, true);   // (walking away up the screen: the rope over the bundle's head end too)
}
// The wrapping, over the body where it lies: the sheet drawn over them as it goes on, then the bands
// tied one by one.
function drawWrapping(ctx) {
  const d = D(), k = d.wrapK || 0;
  const ux = -LEN / 2, cy = d.y - 0.5;
  drawBundle(ctx, d.x + ux, cy, d.x - ux, cy, 0, k);
}
// The rope from the head of the bundle to the explorer's shoulder: a sagging ink cord (taut, straight).
function drawRope(ctx, b, top = false) {
  const to = P.ropeAt || { x: P.x, y: P.y - 11 };
  const hz = 1.3, x0 = b.hx, y0 = b.hy - hz;
  const d = gdist(P.x, P.y, b.hx, b.hy), sag = clamp((ROPE + 1 - d) / 4) * 2.2;
  const mx = (x0 + to.x) / 2, my = (y0 + to.y) / 2 + sag + 1;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, to.x, to.y);
  ctx.strokeStyle = 'rgba(30,28,24,0.85)'; ctx.lineWidth = top ? 0.42 : 0.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(176,160,124,0.95)'; ctx.lineWidth = top ? 0.2 : 0.26; ctx.stroke();
}

// The bundle on the ground: a canvas shroud, head end rounded with the neck pinched in by a band, wide
// at the shoulders, tapering to the bound feet; a pale top in the light, the side in grey shade, inked;
// rope bands tied round it (neck, chest, thighs, ankles) with the tail of the knot at the feet. Lit from
// the upper left, a soft cast shadow to the lower right. prog < 1: being wrapped (the sheet fading on,
// the bands tied one after another).
const PROF = [[-6.9, 0], [-6.5, 0.72], [-5.9, 0.95], [-5.0, 0.86], [-3.2, 1.15], [-0.6, 1.55], [2.3, 1.78], [3.8, 1.72], [4.55, 1.32], [5.25, 1.5], [6.1, 1.34], [6.6, 0.85], [6.85, 0]];
const BANDS = [4.55, 2.0, -1.4, -4.9];
export function drawBundle(ctx, hx, hy, fx, fy, snow = 0, prog = 1) {
  const cx = (hx + fx) / 2, cy = (hy + fy) / 2;
  const a = Math.atan2((hy - fy) / KY, hx - fx), ca = Math.cos(a), sa = Math.sin(a);
  const pt = (u, v, z) => [cx + ca * u - sa * v, cy + (sa * u + ca * v) * KY - z];
  const zt = w => 0.4 + 0.75 * w;
  const outline = (lift, dx = 0, dy = 0) => {
    ctx.beginPath();
    PROF.forEach(([u, w], i) => { const p = pt(u, w, lift ? zt(w) : 0); i ? ctx.lineTo(p[0] + dx, p[1] + dy) : ctx.moveTo(p[0] + dx, p[1] + dy); });
    for (let i = PROF.length - 2; i > 0; i--) { const [u, w] = PROF[i], p = pt(u, -w, lift ? zt(w) : 0); ctx.lineTo(p[0] + dx, p[1] + dy); }
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const sheet = smooth(0, 0.55, prog);
  ctx.globalAlpha = sheet;
  // cast shadow
  outline(false, 1.1, 0.75); ctx.fillStyle = 'rgba(86,90,98,0.2)'; ctx.fill();
  // the side, in shade
  outline(false); ctx.fillStyle = '#aeaba2'; ctx.fill();
  ctx.lineWidth = 0.18; ctx.strokeStyle = 'rgba(30,30,34,0.85)'; ctx.stroke();
  // the top
  outline(true); ctx.fillStyle = '#e8e5dc'; ctx.fill();
  // the shaded half of the top: the side turned to the lower right
  const sd = (-sa + ca * KY) > 0 ? 1 : -1;
  ctx.beginPath();
  PROF.forEach(([u, w], i) => { const p = pt(u, sd * w, zt(w)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
  for (let i = PROF.length - 1; i >= 0; i--) { const [u, w] = PROF[i], p = pt(u, sd * w * 0.2, zt(w) + 0.15); ctx.lineTo(p[0], p[1]); }
  ctx.closePath(); ctx.fillStyle = 'rgba(150,146,134,0.32)'; ctx.fill();
  outline(true); ctx.lineWidth = 0.22; ctx.strokeStyle = 'rgba(30,30,34,0.9)'; ctx.stroke();
  // creases along the canvas
  ctx.lineWidth = 0.08; ctx.strokeStyle = 'rgba(40,40,44,0.35)';
  ctx.beginPath();
  for (const [u0, u1, v] of [[-4.2, 1.6, 0.45], [-2.4, 3.2, -0.5], [0.5, 3.6, 0.1]]) {
    const p = pt(u0, v * 1.2, zt(1.2) + 0.1), q = pt(u1, v * 1.5, zt(1.5) + 0.1);
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  // the rope bands, tied in turn; the knot's tail at the feet
  ctx.globalAlpha = 1;
  BANDS.forEach((u, k) => {
    const on = prog >= 1 ? 1 : smooth(0.55 + k * 0.1, 0.62 + k * 0.1, prog);
    if (on <= 0) return;
    const w = PROF.reduce((m, q) => (Math.abs(q[0] - u) < Math.abs(m[0] - u) ? q : m))[1] * 1.04, z = zt(w);
    const p0 = pt(u, -w, z * 0.3), p1 = pt(u, 0, z + 0.3), p2 = pt(u, w, z * 0.3);
    ctx.globalAlpha = on;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(2 * p1[0] - (p0[0] + p2[0]) / 2, 2 * p1[1] - (p0[1] + p2[1]) / 2, p2[0], p2[1]);
    ctx.lineWidth = 0.62; ctx.strokeStyle = 'rgba(30,28,24,0.9)'; ctx.stroke();
    ctx.lineWidth = 0.36; ctx.strokeStyle = '#a08f6c'; ctx.stroke();
  });
  if (prog >= 0.95) {
    const p = pt(-6.85, 0, 0.5), q1 = pt(-7.9, 0.6, 0.25), q2 = pt(-7.7, -0.5, 0.2);
    ctx.globalAlpha = smooth(0.95, 1, prog);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q1[0], q1[1]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q2[0], q2[1]);
    ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(30,28,24,0.9)'; ctx.stroke();
    ctx.lineWidth = 0.28; ctx.strokeStyle = '#a08f6c'; ctx.stroke();
  }
  // snow settled along the top
  if (snow > 0.03) {
    ctx.globalAlpha = 1; ctx.fillStyle = `rgba(250,250,248,${0.4 + 0.5 * snow})`;
    const n = Math.round(4 + snow * 14);
    for (let k = 0; k < n; k++) {
      const u = -6 + 12 * ((k * 0.618) % 1), w = 1.3 * Math.sin(k * 2.3), p = pt(u, w * 0.6 - sd * 0.4, zt(1.4) + 0.1);
      ctx.beginPath(); ctx.ellipse(p[0], p[1], 0.35 + 0.8 * snow, 0.22 + 0.4 * snow, a * 0.0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// The ending card (Joe: minimal, easy to replace): the world dims under ink, the words come up in the
// style of "None came home", the party lost on the way beneath, then "tap to go on".
export function drawOverlay(ctx) {
  const K = B.card;
  if (!K) return;
  const { w, h, dpr } = state.view, s = Math.min(w, h);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const a = smooth(0, 1.6, K.t);
  // ink closing in from the edges, the camp left clear in the middle
  const g = ctx.createRadialGradient(w / 2, h / 2, s * 0.18, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  g.addColorStop(0, `rgba(30,30,30,${0.25 * a})`); g.addColorStop(1, `rgba(30,30,30,${0.8 * a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const y0 = Math.max(s * 0.1, h * 0.2);
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(233,233,231,${0.92 * smooth(0.5, 2, K.t)})`;
  ctx.font = `${Math.round(Math.max(22, s * 0.055))}px 'Playfair Display SC', Didot, Georgia, serif`;
  ctx.fillText('THEY BROUGHT THEM HOME', w / 2, y0);
  ctx.font = `italic ${Math.round(Math.max(12, s * 0.022))}px Georgia, serif`;
  ctx.fillStyle = `rgba(233,233,231,${0.6 * smooth(1.2, 2.6, K.t)})`;
  ctx.fillText(K.lost.length ? `Lost on the way: ${K.lost.join('  ·  ')}` : 'None of the party was lost.', w / 2, y0 + s * 0.05);
  ctx.fillStyle = `rgba(233,233,231,${0.5 * smooth(2.4, 3.6, K.t)})`;
  ctx.fillText('tap to go on', w / 2, h - Math.max(s * 0.08, h * 0.14));
  ctx.textAlign = 'start';
}

// --- the menu's icons (screen px, centred, slot radius r) ------------------------------------------------
const INK = 'rgba(40,36,30,0.9)';
function iconBundle(ctx, r, x = 0, y = 0, ang = -0.5, len = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const L = r * 0.62 * len, W = r * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0);
  ctx.lineWidth = W * 2 + Math.max(2, r * 0.1); ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = W * 2; ctx.strokeStyle = 'rgba(232,229,220,1)'; ctx.stroke();
  ctx.lineWidth = Math.max(1.2, r * 0.07); ctx.strokeStyle = 'rgba(120,104,74,1)';
  ctx.beginPath();
  for (const k of [0.62, 0.15, -0.35, -0.75]) { ctx.moveTo(L * k, -W * 1.05); ctx.lineTo(L * k, W * 1.05); }
  ctx.stroke();
  ctx.restore();
}
function iconFigure(ctx, r, x, y, lean = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(lean);
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.16, -r * 0.18); ctx.lineTo(r * 0.16, -r * 0.18); ctx.lineTo(r * 0.24, r * 0.38); ctx.lineTo(-r * 0.24, r * 0.38); ctx.closePath();
  ctx.fillStyle = 'rgba(96,92,86,1)'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -r * 0.32, r * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.38); ctx.lineTo(-r * 0.12, r * 0.56); ctx.moveTo(r * 0.1, r * 0.38); ctx.lineTo(r * 0.12, r * 0.56);
  ctx.lineWidth = Math.max(1.4, r * 0.09); ctx.stroke();
  ctx.restore();
}
const iconCarry = (ctx, r) => { iconFigure(ctx, r, 0, r * 0.06); iconBundle(ctx, r, 0, -r * 0.1, -0.08, 1.05); };
const iconDrag = (ctx, r) => {
  iconFigure(ctx, r, r * 0.34, -r * 0.02, 0.32);
  ctx.beginPath(); ctx.moveTo(r * 0.24, -r * 0.18); ctx.quadraticCurveTo(-r * 0.05, r * 0.2, -r * 0.28, r * 0.38);
  ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = INK; ctx.stroke();
  iconBundle(ctx, r, -r * 0.42, r * 0.46, 0.05, 0.5);
};
export const ACT_ICON = {
  wrap: (ctx, r) => iconBundle(ctx, r),
  carry: iconCarry,
  drag: iconDrag,
  down: (ctx, r) => {
    iconBundle(ctx, r, 0, r * 0.32, 0, 0.9);
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.3, r * 0.08);
    ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, -r * 0.02); ctx.moveTo(-r * 0.18, -r * 0.2); ctx.lineTo(0, -r * 0.02); ctx.lineTo(r * 0.18, -r * 0.2); ctx.stroke();
  },
  switch: (ctx, r) => (B.mode === 'carry' ? iconDrag : iconCarry)(ctx, r),
};

// --- test hooks --------------------------------------------------------------------------------------
function debugWrapped() {
  const d = D();
  if (!d?.ready) return false;
  if (!d.wrapped) wrapNow();
  d.found = true;
  const s = downSpot(P.x, P.y, P.facing);
  if (B.mode) { B.mode = null; }
  place(B.bundle, s.x, s.y, s.a);
  B.bundle.held = false; B.bundle.crumbs = null;
  return true;
}
state.goal = {
  state: B,
  wrapped: () => debugWrapped(),
  wrap: () => { const d = D(); if (!d.found) d.found = true; return doAct('wrap'); },
  carry: (now = true) => { if (!B.bundle) debugWrapped(); B.mode = null; if (now) { B.mode = 'carry'; B.bundle.held = true; } else doAct('carry'); },
  drag: (now = true) => { if (!B.bundle) debugWrapped(); if (now) { B.mode = null; startJob('rope', B.bundle.hx, B.bundle.hy); finishJob(); } else doAct('drag'); },
  down: () => setDown(),
  switchMode: () => doAct('switch'),
  home: () => { if (!B.bundle) debugWrapped(); B.mode = 'carry'; B.bundle.held = true; B.bundle.away = true; P.tent?.(); },
  trench: () => trench.length,
};
