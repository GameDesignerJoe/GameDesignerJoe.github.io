// The sim's hands and feet (js/sim/sim.js): everything it does goes in through the player's own
// input. Walking writes state.demoInput (a direction, as the keys would); a press on the screen goes
// through state.uiPress / uiRelease at a screen point (the pack, the sled, a body, the rows over them,
// the tent menu), or, when nothing on screen takes it, becomes a tap on the world (state.input.tap:
// the tent, a wall), exactly as input.js reports a click.
//
// The tasks are generators, stepped once a frame: `yield` waits a frame; wait(s) / until(cond, tmax)
// wait longer. goTo() plans a path (nav.js), decides whether a wall on the way is worth climbing,
// follows the path and climbs, and notices when it's stuck.
import { state } from '../state.js';
import * as T from '../world/terrain.js';
import { worldToScreenUI, screenToWorld } from '../camera.js';
import { SLED, TENT, campInteract } from '../actors/camp.js';
import { pupInteract } from '../actors/puptent.js';
import { count, find } from '../items.js';
import * as N from './nav.js';
import { SIM, S } from './config.js';

const P = state.player;
export const now = () => state.time;
const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// --- the log ----------------------------------------------------------------------------------------
// A decision, with its reason: shown in the thoughts panel (the last few), kept in state.sim.log,
// and printed to the console.
export function note(kind, text) {
  const L = state.lighting || {};
  const e = { t: +now().toFixed(1), day: S.day || 1, clock: Math.round(L.clock || 0), member: state.member || 0, kind, text };
  S.log.push(e);
  S.recent.push(e);
  if (S.recent.length > 7) S.recent.shift();
  if (S.stats) S.stats.decisions++;
  console.log(`[sim ${fmtTime(e.t)}] ${kind}: ${text}`);
  return e;
}
export function goal(text) { S.goal = text; }
export function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

// --- waiting ---------------------------------------------------------------------------------------
export function* wait(s) { const t0 = now(); while (now() - t0 < s) yield; }
export function* until(cond, tmax = 20) {
  const t0 = now();
  while (!cond()) { if (now() - t0 > tmax) return false; yield; }
  return true;
}

// --- the feet: the direction pushed (world space; explorer.js treats it as the keys) ----------------
export function steer(x, y) { const d = Math.hypot(x, y) || 1, m = Math.min(1, d); state.demoInput = { x: x / d * m, y: y / d * m }; }
export function stop() { state.demoInput = { x: 0, y: 0 }; }
export function* still(tmax = 3) { stop(); return yield* until(() => P.speed < 0.8, tmax); }
export const canSteer = () => (P.mode === 'walk' || P.mode === 'cower') && !P.spent && state.body?.phase === 'alive';

// --- the hands: presses on the screen ----------------------------------------------------------------
const C = () => state.compass;
const zoom = () => state.cam.zoom || 1;
export function playerPt() { const s = worldToScreenUI(P.x, P.y); return { x: s.x, y: s.y - 8 * zoom() }; }
export function onPlayer(sx, sy) {
  const f = worldToScreenUI(P.x, P.y), z = zoom(), pad = 10;
  return Math.abs(sx - f.x) < 4 * z + pad && sy < f.y + 2 * z + pad && sy > f.y - 19 * z - pad;
}
// A press at screen (sx, sy): the UI takes it, or (world = true) it's a tap on the world there.
// Real presses arrive between frames (DOM events), so the events they push are seen by every system
// in the next update; these are queued and played just after the frame the same way (a microtask runs
// once the frame's callback returns, after main.js has cleared the frame's events).
const queue = [];
export function later(fn) {
  if (!queue.length) queueMicrotask(() => { const q = queue.splice(0); for (const f of q) f(); });
  queue.push(fn);
}
export function press(sx, sy, world = false) {
  later(() => {
    const ok = !!state.uiPress?.(sx, sy);
    if (!ok && world) { const w = screenToWorld(sx, sy); state.input.tap = { x: w.x, y: w.y, t: state.time }; }
  });
}
export function release() { later(() => state.uiRelease?.()); }
export function worldTap(x, y) { later(() => { state.input.tap = { x, y, t: state.time }; }); }
export function* tap(sx, sy) { press(sx, sy); yield; release(); yield; }
// off everything: closes whatever is open (a row, the pack, the tent menu)
export function* tapOff() { yield* tap(14, state.view.h - 14); }

export const inPack = id => find(state.pack, id) >= 0;
export const nIn = (c, id) => count(c, id);

export function* closeUI() {
  for (let k = 0; k < 3 && C().phase !== 'idle'; k++) {
    if (C().phase === 'out') { const p = playerPt(); yield* tap(p.x, p.y); }
    else yield* tapOff();
    yield;
  }
  return C().phase === 'idle';
}
// press and hold the explorer until the pack opens
export function* openPack(quick = false) {
  if (C().phase === 'slot') return true;
  if (C().phase !== 'idle') yield* closeUI();
  yield* still(quick ? 0.4 : 3);
  for (let k = 0; k < 3; k++) {
    const p = playerPt();
    press(p.x, p.y);
    const ok = yield* until(() => C().phase === 'slot' || C().phase === 'actmenu', 1.5);
    release(); yield;
    if (ok && C().phase === 'slot') return true;
    if (C().phase === 'actmenu') { yield* actTap('pack'); if (C().phase === 'slot') return true; }
    yield* wait(0.3);
  }
  return false;
}
export function* tapPackSlot(i) {
  const L = state.packUI?.();
  const p = L?.pack[i];
  if (!p) return false;
  yield* tap(p.x, p.y);
  return true;
}
// open the pack and tap the first slot holding id (pred: which of them)
export function* useItem(id, pred = null, quick = false) {
  const i0 = state.pack.slots.findIndex(q => q && q.id === id && (!pred || pred(q)));
  if (i0 < 0) return false;
  if (!(yield* openPack(quick))) return false;
  if (!quick) yield* wait(SIM.ui.beat);
  const i = state.pack.slots.findIndex(q => q && q.id === id && (!pred || pred(q)));
  if (i < 0) return false;
  return yield* tapPackSlot(i);
}
// the snow slot under the feet (thirst)
export function* eatSnow() {
  if (!(yield* openPack())) return false;
  yield* wait(SIM.ui.beat);
  const s = state.packUI?.().snow;
  if (!s) return false;
  yield* tap(s.x, s.y);
  return true;
}

// --- containers: the sled, a body, a pile ------------------------------------------------------------
// press and hold on it (at a screen point found by pt()) until its slots fan out
export function* openContainer(pt, tmax = 2) {
  yield* closeUI();
  yield* still();
  for (let k = 0; k < 3; k++) {
    const p = pt();
    if (!p) return false;
    press(p.x, p.y);
    const ok = yield* until(() => C().phase === 'transfer', tmax);
    release(); yield;
    if (ok) return true;
    yield* wait(0.4);
  }
  return false;
}
// tap id in the open container n times (one each): returns how many came across
export function* takeFrom(id, n = 1) {
  let got = 0;
  for (let k = 0; k < n; k++) {
    const ref = C().target?.ref, L = state.packUI?.();
    if (C().phase !== 'transfer' || !ref || !L) break;
    const p = L.cont.find(q => ref.slots[q.i]?.id === id);
    if (!p) break;
    const before = count(state.pack, id);
    yield* tap(p.x, p.y);
    yield* wait(SIM.ui.beat);
    if (count(state.pack, id) > before) got++; else break;
  }
  return got;
}
// tap id in the pack: across into the open container
export function* putBack(id) {
  const i = find(state.pack, id), L = state.packUI?.();
  if (i < 0 || !L || C().phase !== 'transfer') return false;
  yield* tap(L.pack[i].x, L.pack[i].y);
  yield* wait(SIM.ui.beat);
  return find(state.pack, id) < 0 || count(state.pack, id) < 99;
}
// where to press on the sled: a point on it, as far from the explorer on screen as can be (a press
// on the explorer opens their own pack instead)
export function sledPoint() {
  const c = Math.cos(SLED.yaw), s = Math.sin(SLED.yaw), pp = playerPt();
  let best = null, bd = -1;
  for (let lx = -11; lx <= 11; lx += 2.2) {
    for (const h of [2, 4]) {
      const sp = worldToScreenUI(SLED.x + lx * c, SLED.y + lx * s * 0.72 - h), w = screenToWorld(sp.x, sp.y);
      if (campInteract(w.x, w.y) !== 'sled' || onPlayer(sp.x, sp.y)) continue;
      const d = Math.hypot(sp.x - pp.x, sp.y - pp.y);
      if (d > bd) { bd = d; best = sp; }
    }
  }
  return best;
}
// on a body lying at (x, y) (its pack: ui/pack.js containerAt)
export function bodyPoint(x, y) {
  const pp = playerPt(), z = zoom();
  let best = null, bd = -1;
  for (let dx = -5; dx <= 5; dx += 1) for (const dy of [-1, -2, -3]) {
    const sp = worldToScreenUI(x + dx, y + dy), w = screenToWorld(sp.x, sp.y);
    if (Math.hypot(w.x - x, (w.y - (y - 2)) * 1.3) >= Math.max(7, 14 / z) || onPlayer(sp.x, sp.y)) continue;
    const d = Math.hypot(sp.x - pp.x, sp.y - pp.y);
    if (d > bd) { bd = d; best = sp; }
  }
  return best;
}
// on the wrapped bundle lying free
export function bundlePoint() {
  const b = state.burden?.bundle;
  if (!b) return null;
  const pp = playerPt();
  let best = null, bd = -1;
  for (let t = 0.15; t <= 0.85; t += 0.1) {
    const wx = b.fx + (b.hx - b.fx) * t, wy = b.fy + (b.hy - b.fy) * t - 1.2;
    if (state.ground.some(g => Math.hypot(wx - g.x, (wy - (g.y - 1)) * 1.4) < 6)) continue;   // (a press there opens the pile)
    const sp = worldToScreenUI(wx, wy);
    if (onPlayer(sp.x, sp.y)) continue;
    const d = Math.hypot(sp.x - pp.x, sp.y - pp.y);
    if (d > bd) { bd = d; best = sp; }
  }
  return best;
}
// on base camp's tent, off the explorer
export function tentPoint() {
  const pp = playerPt();
  let best = null, bd = -1;
  for (let dx = -10; dx <= 10; dx += 2) for (let dy = -12; dy <= 2; dy += 2) {
    const sp = worldToScreenUI(TENT.x + dx, TENT.y + dy), w = screenToWorld(sp.x, sp.y);
    if (campInteract(w.x, w.y) !== 'tent' || onPlayer(sp.x, sp.y)) continue;
    const d = Math.hypot(sp.x - pp.x, sp.y - pp.y);
    if (d > bd) { bd = d; best = sp; }
  }
  return best;
}
// on the pitched pup tent's canvas, off the explorer
export function pupPoint() {
  const p = state.pup?.pitched;
  if (!p) return null;
  const pp = playerPt();
  let best = null, bd = -1;
  for (let dx = -9; dx <= 9; dx += 1.5) for (let dy = -8; dy <= 3; dy += 1.5) {
    const x = p.x + dx, y = p.y + dy;
    if (!pupInteract(x, y)) continue;
    const sp = worldToScreenUI(x, y);
    if (onPlayer(sp.x, sp.y)) continue;
    const d = Math.hypot(sp.x - pp.x, sp.y - pp.y);
    if (d > bd) { bd = d; best = sp; }
  }
  return best;
}

// --- the rows: over the lost explorer, the bundle, the explorer's own head; the tent menu --------------
export function* openRow(pt) {
  yield* closeUI();
  yield* still();
  for (let k = 0; k < 3; k++) {
    const p = pt();
    if (!p) return false;
    yield* tap(p.x, p.y);
    if (yield* until(() => C().phase === 'actmenu', 0.6)) return true;
    yield* wait(0.3);
  }
  return false;
}
export function* actTap(id) {
  const L = state.actUI?.(), p = L?.pos.find(q => q.id === id);
  if (!p) return false;
  yield* wait(SIM.ui.beat);
  yield* tap(p.x, p.y);
  return true;
}
export function* tentMenu(id) {
  if (P.mode !== 'inside') return false;
  if (C().phase !== 'tentmenu') { yield* closeUI(); yield* tap(state.view.w / 2, state.view.h * 0.8); }
  if (!(yield* until(() => C().phase === 'tentmenu', 1))) return false;
  yield* wait(SIM.ui.beat);
  const p = state.tentUI?.().pos.find(q => q.id === id);
  if (!p) return false;
  yield* tap(p.x, p.y);
  return true;
}

// --- walking ---------------------------------------------------------------------------------------
const wornShoes = () => !!P.gear?.snowshoes;
export function moveMode() {
  const b = state.burden?.mode;
  if (b) return b;
  return wornShoes() || inPack('snowshoes') ? 'shoes' : 'walk';
}
function avoidList() {
  const a = [];
  if (S.bearSeen && now() - S.bearSeen.t < 400) a.push({ x: S.bearSeen.x, y: S.bearSeen.y, r: SIM.cost.bear.r, k: SIM.cost.bear.k });
  return a;
}
export function path(x0, y0, x1, y1, mode = moveMode(), goalR = 10, penalty = null) {
  return N.findPath(x0, y0, x1, y1, SIM.cost[mode], { avoid: avoidList(), now: now(), pup: state.pup?.pitched || null, goalR, penalty });
}

// A path's cost to walk, in time (s) and energy, at the measured paces (shoes on where there's snow).
const PACE = { snow: 13, deep: 5.85, ice: 9, thin: 8, path: 16.9 }, PACE_SHOE = { snow: 15, deep: 10.4 };
const DRAINS = { snow: 1 / 360, deep: 1 / 90, ice: 1 / 600, thin: 1 / 540, path: 0 }, DRAIN_SHOE = { snow: 1 / 520, deep: 1 / 240 };
export function walkCost(pts, shoes = inPack('snowshoes') || wornShoes()) {
  const sh = N.pathShares(pts), L = sh.len;
  let t = 0, e = 0;
  for (const k of N.TNAME) {
    const d = L * sh[k];
    const v = shoes && PACE_SHOE[k] ? PACE_SHOE[k] : PACE[k], dr = shoes && DRAIN_SHOE[k] ? DRAIN_SHOE[k] : DRAINS[k];
    t += d / v; e += d / v * dr;
  }
  return { t, e, len: L };
}

// The game's own estimate of a wall's cost (explorer.js beginClimb), to size it up as the explorer does.
export function climbEstimate(r) {
  const b = r.up === false ? r.end : r.start, t = r.up === false ? r.start : r.end;
  const L = Math.max(6, Math.hypot(t.x - b.x, t.y - b.y));
  const D = (2.5 * 1.3) / clamp(-(t.y - b.y) / L, 0.35, 1);
  const moves = Math.max(1, (L - 17) / D), half = state.body?.climbHalf ?? 0.032, strikes = moves * half;
  const E = state.body?.energy ?? 1;
  const tk = Math.pow(smooth(0.5, 0, E - 0.65 * strikes), 1.15);
  const e = strikes + (state.body?.hang ?? 0) * moves * 1.5 * Math.pow(tk, 1.2);
  return { e, t: moves * 1.6, L, moves };
}
const wallKey = r => `${Math.round(r.start.x / 12)},${Math.round(r.start.y / 12)}`;
const climbKit = () => inPack('axes') && inPack('crampons');
// A wall across the straight line to (x, y), if there's a climbable face there whose top is ground
// that can be walked to (never up onto a plateau with no way down).
function findClimb(x, y) {
  const d = Math.hypot(x - P.x, y - P.y);
  if (d < 20) return null;
  const ux = (x - P.x) / d, uy = (y - P.y) / d, look = Math.min(d, SIM.climb.look);
  let base = null;
  for (let s = 2; s <= look; s += 2) {
    const px = P.x + ux * s, py = P.y + uy * s;
    if (!T.isWalkable(px, py)) { base = { x: P.x + ux * (s - 2), y: P.y + uy * (s - 2) }; break; }
  }
  if (!base || Math.abs(uy) < 0.25) return null;
  const sg = uy < 0 ? -1 : 1, side = ux >= 0 ? 1 : -1;
  for (const off of [0, -8, 8, -16, 16]) {
    const bx = base.x + off, by = base.y;
    if (!T.isWalkable(bx, by)) continue;
    for (const a of [0, 10, 20, 30, 40]) {
      const ar = a * Math.PI / 180;
      let r = null;
      try { r = T.climbRoute(bx, by, Math.sin(ar) * side, sg * Math.cos(ar)); } catch { r = null; }
      if (!r) continue;
      if (S.badWalls?.has(wallKey(r))) continue;
      if (!T.reachableOnFoot(r.end.x, r.end.y) || !N.freeAt(r.end.x, r.end.y, now()) && !N.nearestFree(r.end.x, r.end.y, 1)) continue;
      return r;
    }
  }
  return null;
}
// a climbable wall across the straight way to (x, y), whose top can be walked from? (brain.js: worth fetching the axes?)
export const wallTowards = (x, y) => !!findClimb(x, y);
// Plan the way to (x, y): legs of walking, and a climb if a wall is worth it.
export function planRoute(x, y, o = {}) {
  const mode = moveMode(), p = path(P.x, P.y, x, y, mode, o.goalR ?? 10, o.penalty || null);
  const straight = Math.hypot(x - P.x, y - P.y);
  const walkOnly = p ? { legs: [{ kind: 'walk', path: p }], len: p.len } : null;
  if (o.climb === false || state.burden?.mode || !climbKit()) return walkOnly;
  if (p && p.len < straight * SIM.climb.detourRatio + SIM.climb.detourMin) return walkOnly;
  const r = findClimb(x, y);
  if (!r) return walkOnly;
  const a = path(P.x, P.y, r.start.x, r.start.y, mode, 3), b = path(r.end.x, r.end.y, x, y, mode, o.goalR ?? 10);
  if (!a || !b) return walkOnly;
  const est = climbEstimate(r), E = state.body?.energy ?? 1, K = SIM.climb.energyK;
  const ca = walkCost(a.pts), cb = walkCost(b.pts), cd = p ? walkCost(p.pts) : null;
  const viaClimb = ca.t + cb.t + est.t + K * (ca.e + cb.e + est.e);
  const viaRound = cd ? cd.t + K * cd.e : Infinity;
  const need = Math.max(0.2, Math.min(est.e * 1.15, 0.98)) + SIM.climb.margin;
  const key = wallKey(r), seen = S.wallSeen || (S.wallSeen = new Map()), last = seen.get(key);
  const h = Math.round(r.height || r.length);
  let pick, why;
  const vc = `~${Math.round(viaClimb)}`, vr = cd ? `~${Math.round(viaRound)}` : 'no way';
  if (E < need) { pick = 'round'; why = `climb ~${est.e.toFixed(2)} energy (${h} px wall), have ${E.toFixed(2)}: round, ${cd ? Math.round(cd.len) + ' px' : '?'}`; }
  else if (viaClimb < viaRound) { pick = 'climb'; why = `${h} px wall ~${est.e.toFixed(2)} energy (have ${E.toFixed(2)}); cost ${vc} vs round ${vr} (${cd ? Math.round(cd.len) + ' px' : 'no way'})`; }
  else { pick = 'round'; why = `round ${Math.round(cd.len)} px costs ${vr}, the ${h} px wall way ${vc} (~${est.e.toFixed(2)} energy)`; }
  if (!last || last.pick !== pick || now() - last.t > 90) { note(pick === 'climb' ? 'Climb' : 'Detour', why); seen.set(key, { pick, t: now() }); if (S.stats) S.stats[pick === 'climb' ? 'climbsChosen' : 'detours']++; }
  if (pick === 'round') return walkOnly;
  return { legs: [{ kind: 'walk', path: a, r: 2.5 }, { kind: 'climb', route: r }, { kind: 'walk', path: b }], len: a.len + b.len + r.length };
}

// Follow a path: steer at the farthest point ahead that can be seen clear (pure pursuit); 'ok' within
// r of its end, else 'stuck' | 'shore' | 'until' | 'timeout'.
export function* follow(pth, r, o = {}) {
  const pts = pth.pts;
  let i = 1, best = 1e9, bestT = now();
  S.path = pts;
  const end = pts[pts.length - 1];
  while (true) {
    if (o.until?.()) { stop(); return 'until'; }
    if (o.deadline && now() > o.deadline) { stop(); return 'timeout'; }
    if (S.shore > 0) { stop(); return 'shore'; }
    if (!canSteer() || P.resting) { stop(); yield; bestT = now(); continue; }
    const dE = hyp(P, end);
    if (dE <= r) { stop(); return 'ok'; }
    // where on the path we are: the end of the nearest segment (never back behind it)
    { let bk = i, bd = Infinity;
      for (let k = Math.max(1, i); k < Math.min(pts.length, i + 30); k++) { const d = segDist(P, pts[k - 1], pts[k]); if (d < bd - 0.01) { bd = d; bk = k; } }
      i = bk; if (i < pts.length - 1 && hyp(P, pts[i]) < 4) i++; }
    let tgt = pts[i], ti = i;
    for (let q = i + 1; q < pts.length && hyp(P, pts[q]) < 32; q++) if (N.clearLine(P.x, P.y, pts[q].x, pts[q].y, now())) { tgt = pts[q]; ti = q; }
    // how much is left: the progress clock (stuck if it doesn't shrink)
    let left = hyp(P, tgt);
    for (let q = ti; q < pts.length - 1; q++) left += hyp(pts[q], pts[q + 1]);
    if (left < best - SIM.stuck.minGain) { best = left; bestT = now(); }
    if (now() - bestT > SIM.stuck.window) { stop(); return 'stuck'; }
    const dx = tgt.x - P.x, dy = tgt.y - P.y, d = Math.hypot(dx, dy) || 1;
    const m = ti === pts.length - 1 ? Math.min(1, d / 6 + 0.35) : 1;
    steer(dx / d * m, dy / d * m);
    yield;
  }
}
// a few random steps, to come unstuck
export function* jiggle(s = 1.6) {
  const a = Math.random() * Math.PI * 2;
  const t0 = now();
  while (now() - t0 < s) { if (canSteer()) steer(Math.cos(a), Math.sin(a)); else stop(); yield; }
  stop();
}
// Walk (and climb) to (x, y). True there (within r), 'until' if o.until() said stop, false if it can't.
export function* goTo(x, y, r = 6, o = {}) {
  o.deadline = o.deadline ?? now() + (o.timeout ?? 900);
  let fails = 0;
  while (fails < SIM.stuck.giveUp) {
    if (Math.hypot(P.x - x, P.y - y) <= r) { stop(); return true; }
    if (o.until?.()) { stop(); return 'until'; }
    if (now() > o.deadline) { stop(); return false; }
    if (!canSteer()) { stop(); yield; continue; }
    const plan = planRoute(x, y, o);
    if (!plan) { fails++; if (S.stats) S.stats.noPath++; yield* jiggle(1); continue; }
    if (o.maxRatio && plan.len > o.maxRatio * Math.hypot(x - P.x, y - P.y) + 40) { stop(); return 'far'; }
    let res = 'ok';
    for (let k = 0; k < plan.legs.length; k++) {
      const leg = plan.legs[k], last = k === plan.legs.length - 1;
      if (leg.kind === 'walk') res = yield* follow(leg.path, last ? r : (leg.r ?? 3), o);
      else res = (yield* climbLeg(leg.route)) ? 'ok' : 'replan';
      if (res !== 'ok') break;
    }
    if (res === 'ok') { if (Math.hypot(P.x - x, P.y - y) <= r + 4) return true; fails++; continue; }
    if (res === 'until') return 'until';
    if (res === 'timeout') return false;
    if (res === 'shore') {
      // open water met: mark it, step back the way we came, plan again
      const a = P.facing, wx = P.x + Math.cos(a) * 6, wy = P.y + Math.sin(a) * 6 * 0.8;
      N.markBlocked(wx, wy, 8, now());
      S.shore = 0;
      note('Shore', 'open water ahead: back off, find a way round');
      const t0 = now();
      while (now() - t0 < 0.8) { if (canSteer()) steer(-Math.cos(a), -Math.sin(a)); yield; }
      stop();
      continue;
    }
    fails++;
    if (res === 'stuck') {
      if (S.stats) S.stats.stuck++;
      if (fails >= 2) note('Stuck', `no headway (${fails}) at ${Math.round(P.x)},${Math.round(P.y)} (${P.terrain}, ${P.mode}${P.spent ? ' spent' : ''}, speed ${P.speed.toFixed(1)}): a few steps aside`);
      S.stuckAt = { x: P.x, y: P.y, t: now(), to: { x, y }, path: S.path, dbg: S.dbg };
      yield* jiggle(1 + fails * 0.5);
    }
  }
  stop();
  return false;
}

// Climb a wall: walk to its foot (done before), tap the rock (explorer.js tapClimb plans the climb and
// sizes it up), then a tap on the wall for each move until they're up (or down).
function facePoint(r) {
  let best = null, bd = 1e9;
  for (let t = 0.1; t <= 0.9; t += 0.05) {
    const x = r.start.x + (r.end.x - r.start.x) * t, y = r.start.y + (r.end.y - r.start.y) * t;
    if (T.isWalkable(x, y)) continue;
    const d = Math.abs(t - 0.5);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best || { x: (r.start.x + r.end.x) / 2, y: (r.start.y + r.end.y) / 2 };
}
export function* climbLeg(r) {
  const t0 = now(), key = wallKey(r);
  yield* still(2);
  const fp = facePoint(r);
  worldTap(fp.x, fp.y);
  let begun = yield* until(() => P.mode === 'approach' || P.mode === 'climb' || P.mode === 'refuse', 1.2);
  if (!begun) { later(() => P.climb?.(r.end.x - r.start.x, (r.end.y - r.start.y))); yield; begun = yield* until(() => P.mode !== 'walk', 1); }
  yield* until(() => P.mode !== 'approach', 25);
  if (P.mode === 'refuse' || (S.lastRefuse && S.lastRefuse.t >= t0)) {
    const why = S.lastRefuse?.reason || 'refused';
    note('Climb', `refused at the foot (${why}): go round`);
    (S.badWalls || (S.badWalls = new Set())).add(key);
    if (S.stats) S.stats.climbRefused++;
    yield* until(() => P.mode === 'walk', 6);
    return false;
  }
  if (P.mode !== 'climb') { (S.badWalls || (S.badWalls = new Set())).add(key); return false; }
  goal(`climbing a ${Math.round(r.height || r.length)} px wall`);
  const dir = r.up === false ? -1 : 1, e0 = state.body?.energy ?? 1;
  let next = 0;
  while (P.mode === 'climb' && now() - t0 < 120) {
    if (now() >= next) { later(() => P.climbTap?.(dir)); next = now() + SIM.climb.tapEvery; }
    yield;
  }
  yield* until(() => P.mode === 'walk' || state.body?.phase !== 'alive', 8);
  const ok = P.mode === 'walk' && hyp(P, r.end) < 30;
  if (ok) { note('Climb', `${dir > 0 ? 'up' : 'down'}: cost ${(e0 - (state.body?.energy ?? 0)).toFixed(2)} energy, ${(state.body?.energy ?? 0).toFixed(2)} left`); if (S.stats) S.stats.climbs++; }
  else { note('Climb', `came off the wall (injury ${(state.body?.injury ?? 0).toFixed(2)})`); (S.badWalls || (S.badWalls = new Set())).add(key); if (S.stats) S.stats.falls++; }
  return ok;
}
