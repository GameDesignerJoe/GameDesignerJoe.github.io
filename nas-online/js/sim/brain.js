// The sim's mind (js/sim/sim.js): what it wants to do, and why. One long errand (the mission: pack at
// the sled, find the lost explorer by the radio's hot and cold, wrap them, bring them home) and the
// needs that break into it (the bear, a storm, the night, the cold, hunger, thirst, a hurt leg, being
// worn out, snowshoes). Each is a generator task (hands.js); sim.js picks which one runs.
//
// What it knows is what a player knows: the radio's blips (state.radio.near, heard as a blip rate),
// the ground it can see, its own body (warmth, energy, food, water, wet, injury), the time of day, the
// weather, and the bear when it's on screen. Never where the lost explorer lies, until it sees the
// beacon blinking (on screen, within SIM.spot.range).
import { state } from '../state.js';
import * as T from '../world/terrain.js';
import { TENT, SLED, tentDoor } from '../actors/camp.js';
import { pupDoor } from '../actors/puptent.js';
import { visibleRect, worldToScreenUI } from '../camera.js';
import { find, count, ITEMS, PACK_SLOTS, used } from '../items.js';
import { BORDER } from '../world/frontier.js';
import { MAP_W, MAP_H } from '../state.js';
import * as N from './nav.js';
import { SIM, S } from './config.js';
import * as H from './hands.js';

const { note, goal, wait, until, now } = H;
const P = state.player;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a, b) => a + Math.random() * (b - a);
const deg = a => Math.round(((a * 180 / Math.PI) % 360 + 360) % 360);
const name = id => ITEMS[id]?.name?.toLowerCase() || id;
const B = () => state.body;
const pack = () => state.pack;

// --- the radio, as heard ----------------------------------------------------------------------------
export const gapOf = n => 0.25 + 2.95 * Math.pow(1 - n, 1.4);
export function listen() {
  const R = state.radio;
  if (!R?.on || state.distress?.found) return null;
  const g = (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;
  return clamp(R.near + g * SIM.radio.noise);
}
export function hearing(n) {
  if (n === null || n === undefined) return 'nothing';
  if (n >= SIM.search.zone) return 'the SOS, clear and loud';
  if (n > 0.78) return `the SOS in morse (blips ${gapOf(n).toFixed(2)} s)`;
  return `a blip every ~${gapOf(n).toFixed(1)} s`;
}
// the average of what was heard over the last w s (the sampler in sim.js keeps S.samples)
export function heard(w = 1.5) {
  const t = now(), xs = S.samples.filter(s => t - s.t <= w);
  if (!xs.length) return listen();
  return xs.reduce((a, s) => a + s.n, 0) / xs.length;
}

// --- seeing ----------------------------------------------------------------------------------------
// The beacon blinking signal yellow, on screen and near enough to make out.
export function spotBody() {
  const D = state.distress;
  if (!D?.ready || D.wrapped) return null;
  const night = state.lighting?.night || 0;
  const range = SIM.spot.range * (1 - SIM.spot.whiteoutK * (state.weather?.whiteout || 0)) * lerp(1, SIM.spot.nightK, night);
  const r = visibleRect(-8);
  if (D.x < r.x0 || D.x > r.x1 || D.y < r.y0 || D.y > r.y1) return null;
  if (Math.hypot(D.x - P.x, D.y - P.y) > range) return null;
  return { x: D.x, y: D.y };
}
export function bearVisible() {
  const b = state.bear;
  if (!b || b.dead || b.gone) return null;
  const r = visibleRect(0);
  if (b.x < r.x0 || b.x > r.x1 || b.y < r.y0 || b.y > r.y1) return null;
  return b;
}
// (seen a moment ago and just out of view, it's still there: a player wouldn't forget it that fast)
export function bearThreat(r = SIM.bear.wary) {
  const b = bearVisible();
  if (b) S.bearMem = { x: b.x, y: b.y, st: b.st, hunting: b.threat || ['stalk', 'warn', 'charge', 'maul'].includes(b.st), t: now(), ref: b };
  const m = S.bearMem;
  if (!m || now() - m.t > SIM.bear.memory || m.ref.dead || m.ref.gone) return null;
  const at = b || m, d = hyp(at, P);
  return m.hunting && d < r ? (b || { x: m.x, y: m.y, st: m.st, remembered: true }) : null;
}

// --- the weather and the clock, as felt --------------------------------------------------------------
export const isNight = () => (state.lighting?.clock ?? 0) >= 180;
export const canSleep = () => { const L = state.lighting; return L.mode === 'cycle' && L.night > 0.5 && L.clock >= 180; };
export function stormy() {
  const ph = state.weather?.phase, w = state.wind;
  return ph === 'stormIn' || ph === 'storm' || ph === 'blizzard' || w.speed > SIM.camp.stormWind;   // (the sustained wind, not a gust)
}
const calm = () => !stormy() && state.wind.speed < SIM.camp.calmWind && !(state.weather?.phase === 'build' && (state.lighting?.clock ?? 0) >= SIM.camp.buildFrom);

// --- where things are (all of it what any member of the party knows) ----------------------------------
function sledStand() {
  const c = Math.cos(SLED.yaw), s = Math.sin(SLED.yaw);
  const pts = [-1, 1].map(sd => ({ x: SLED.x - sd * 11 * s, y: SLED.y + sd * 11 * c * 0.72 }));
  pts.sort((a, b) => hyp(a, P) - hyp(b, P));
  return pts.find(p => N.freeAt(p.x, p.y)) || pts[0];
}
function standBeside(x, y, d = 11) {
  const c = [[d, 0], [-d, 0], [d, 4], [-d, 4], [d, -4], [-d, -4], [d * 0.8, 6], [-d * 0.8, 6]].map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter(p => T.isWalkable(p.x, p.y) && !T.isWater(p.x, p.y));
  c.sort((a, b) => hyp(a, P) - hyp(b, P));
  return c[0] || { x, y: y + 10 };
}
const doorFront = () => { const d = tentDoor(); return { x: d.fx, y: d.fy }; };
const inside = () => P.mode === 'inside';

// --- the mission ------------------------------------------------------------------------------------
export function* mission() {
  const M = S.mem;
  while (true) {
    const D = state.distress, Bu = state.burden;
    if (Bu?.home) { goal('home: they brought them home'); H.stop(); yield; continue; }
    if (inside()) { yield* leaveTent(); yield; continue; }
    if (!M.intro && !D.found && state.member === 0) { yield* intro(); yield; continue; }
    if (M.packedFor !== state.member || M.needKit || M.resupply || M.wantClimb) { yield* restock(); M.resupply = false; yield; continue; }
    if (M.needFallen) { yield* fromFallen(M.needFallen); M.needFallen = null; yield; continue; }
    if (!D.found) {
      if (!M.body && !state.radio?.on) { const ok = yield* radioOn(); if (!ok) { yield* searchBlind(); yield; continue; } }
      if (!M.body) { yield* search(); yield; continue; }
      yield* openBody(); yield; continue;
    }
    if (!D.wrapped) { yield* wrap(); yield; continue; }
    if (!Bu.mode) { yield* takeUp(); yield; continue; }
    yield* goHome();
    yield;
  }
}

// Out of the tent: the radio comes out of the pack, and the first faint blip.
function* intro() {
  const M = S.mem;
  goal('setting out: the radio');
  M.intro = true;
  yield* until(() => P.mode === 'walk', 8);
  yield* wait(0.8);
  if (yield* H.openPack()) {
    yield* wait(1.2);
    if (!state.radio?.on && H.inPack('radio')) { yield* H.tapPackSlot(find(pack(), 'radio')); yield* wait(0.5); }
    yield* wait(1.2);
    const n = listen();
    note('Radio', n === null ? 'silent' : `on: ${hearing(n)}: faint, far off`);
    yield* H.closeUI();
  }
}
function* radioOn() {
  if (!H.inPack('radio')) return false;
  goal('switching the radio on');
  yield* H.useItem('radio');
  yield* wait(0.6);
  yield* H.closeUI();
  if (state.radio?.on) { note('Radio', `on: ${hearing(listen())}`); return true; }
  return false;
}

// Packing at the sled: SIM.pack in order, while there's room; a pair only if both fit.
function* restock() {
  const M = S.mem;
  goal(M.needKit ? 'back to the sled for the sheet and rope' : M.wantClimb ? 'back to the sled for the axes and crampons' : M.resupply ? 'back to the sled for food' : 'to the sled: packing');
  const st = sledStand();
  const ok = yield* H.goTo(st.x, st.y, 4, { climb: false });
  if (ok !== true) { note('Sled', 'could not reach the sled: try again'); yield* H.jiggle(1.5); return; }
  if (!(yield* H.openContainer(H.sledPoint))) { note('Sled', 'could not get into the sled: try again'); yield* wait(1); return; }
  goal('at the sled: packing');
  const sled = state.sled, free = () => PACK_SLOTS - used(pack());
  for (const l of SIM.leave) if (H.inPack(l.id)) { yield* H.putBack(l.id); note('Pack', `leave the ${name(l.id)}: ${l.why}`); }
  // fetching the wrapping: make room for it first if need be (the climbing gear and the rifle go back)
  const wantWrap = SIM.knowsWrap || M.learned.has('wrap');
  if (wantWrap) {
    const need = (H.inPack('sheet') ? 0 : 1) + (H.inPack('rope') ? 0 : 1);
    for (const id of ['cartridges', 'rifle', 'crampons', 'axes', 'flare']) {
      if (free() >= need) break;
      if (H.inPack(id)) { yield* H.putBack(id); note('Pack', `leave the ${name(id)}: room for the sheet and rope`); }
    }
  }
  // the climbing gear, wanted for the way to the estimate: room for it first (the rifle, then the flares go back;
  // never the tent, the food or the wrapping: a storm far out with no tent kills)
  if (M.wantClimb) {
    const need = (H.inPack('axes') ? 0 : 1) + (H.inPack('crampons') ? 0 : 1);
    for (const id of ['cartridges', 'rifle', 'flare']) {
      if (free() >= need) break;
      if (H.inPack(id)) { yield* H.putBack(id); note('Pack', `leave the ${name(id)}: room for the axes and crampons`); }
    }
    if (free() >= need) { for (const id of ['axes', 'crampons']) if (!H.inPack(id) && (yield* H.takeFrom(id, 1))) note('Pack', `take the ${name(id)}: the way to the estimate goes over a wall`); }
    else note('Pack', 'no room for the axes and crampons without leaving the tent or food: go the long way round');
    M.wantClimb = false;
  }
  for (const it of SIM.pack) {
    if (it.learned && !(SIM.knowsWrap || M.learned.has(it.learned))) continue;
    const want = it.n || 1, have = count(pack(), it.id), need = want - have;
    if (need <= 0) continue;
    if (it.needs && !H.inPack(it.needs)) continue;
    if (count(sled, it.id) <= 0) { if (have === 0) note('Pack', `no ${name(it.id)} left on the sled`); continue; }
    const pairNeed = it.pair && !H.inPack(it.pair) ? 1 : 0;
    const stack = ITEMS[it.id]?.stack ?? 1;
    const part = stack > 1 ? pack().slots.reduce((a, q) => a + (q && q.id === it.id ? stack - q.n : 0), 0) : 0;
    const slotsFor = Math.max(0, Math.ceil((need - part) / stack));
    if (free() < (slotsFor > 0 ? 1 : 0) + pairNeed) { note('Pack', `no room for the ${name(it.id)}${it.pair ? ' and ' + name(it.pair) : ''}`); continue; }
    const got = yield* H.takeFrom(it.id, need);
    if (got > 0) note('Pack', `take ${got > 1 ? got + ' ' : 'the '}${name(it.id)}: ${it.why}`);
  }
  yield* wait(0.5);
  yield* H.closeUI();
  M.packedFor = state.member;
  M.needKit = false;
  const missing = [];
  if (wantWrap && !state.distress.wrapped) for (const id of ['sheet', 'rope']) if (!H.inPack(id)) missing.push(id);
  if (!state.distress.found && !H.inPack('radio')) missing.push('radio');
  for (const id of ['puptent', 'snowshoes']) if (!H.inPack(id) && !count(state.sled, id) && !state.pup?.pitched) { const k = knownFallen([id]); if (k && hyp(k.f, P) < SIM.camp.fallenFetch) missing.push(id); }
  if (missing.length && knownFallen(missing)) { M.needFallen = missing; note('Learned', `no ${missing.map(name).join(' or ')} on the sled: ${state.party?.[knownFallen(missing).member]?.name ?? 'a fallen member'} had ${missing.length > 1 ? 'them' : 'one'}`); }
  const list = pack().slots.filter(Boolean).map(q => q.id + (q.n > 1 ? q.n : '')).join(' ');
  note('Packed', `${list} (${free()} free)`);
}

// The party's own dead, where they fell (every member knows where the last one went down): their packs.
function knownFallen(ids) {
  const deaths = S.stats?.deaths || [];
  let best = null, bd = 1e9;
  for (const f of state.fallen || []) {
    if (f.distress || !f.pack || f.lost) continue;
    const d = deaths.find(q => Math.hypot(q.x - f.x, q.y - f.y) < 30);
    if (!d || !ids.some(id => count(f.pack, id) > 0)) continue;
    const dist = hyp(f, P);
    if (dist < bd) { bd = dist; best = { f, member: d.member }; }
  }
  return best;
}
function* fromFallen(ids) {
  const k = knownFallen(ids);
  if (!k) return;
  const f = k.f, who = state.party?.[k.member]?.name ?? 'them';
  goal(`to ${who}'s body for the ${ids.map(name).join(', ')}`);
  const st = standBeside(f.x, f.y);
  const r = yield* H.goTo(st.x, st.y, 3, { timeout: 600 });
  if (r !== true && hyp(P, f) > 14) { note('Fallen', `could not reach ${who}`); return; }
  if (!(yield* H.openContainer(() => H.bodyPoint(f.x, f.y)))) { note('Fallen', `could not get at ${who}'s pack`); return; }
  for (const id of [...new Set([...ids, ...SIM.fallenLoot])]) {
    const n = count(f.pack, id);
    if (!n) continue;
    const got = yield* H.takeFrom(id, n);
    if (got) note('Fallen', `${who}'s ${name(id)}${got > 1 ? ' x' + got : ''}`);
  }
  yield* H.closeUI();
  if (H.inPack('radio') && !state.radio?.on && !state.distress.found) yield* radioOn();
}

// --- hot and cold; and when that goes in circles, triangulating ---------------------------------------
// Map memory: sim.js counts visits to coarse cells as they walk (S.visit). Legs prefer fresh ground, and the
// paths for them are weighted off ground already walked (SIM.memory.revisit).
export function visitsAt(x, y) {
  const V = S.visit;
  if (!V) return 0;
  const i = Math.floor(x / V.c), j = Math.floor(y / V.c);
  return i < 0 || j < 0 || i >= V.w || j >= V.h ? 9 : V.a[j * V.w + i];
}
function lineVisits(a, b) {
  const k = Math.max(1, Math.ceil(hyp(a, b) / (S.visit?.c || 24)));
  let s = 0;
  for (let q = 1; q <= k; q++) s += Math.min(6, visitsAt(a.x + (b.x - a.x) * q / k, a.y + (b.y - a.y) * q / k));
  return s / k;
}
function memPenalty() {
  const V = S.visit;
  if (!V) return null;
  const k = SIM.memory.revisit, r = N.G / V.c;
  return (i, j) => 1 + k * Math.min(4, V.a[Math.floor(j * r) * V.w + Math.floor(i * r)] || 0);
}
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
// The radio's blip rate read as a distance (the radio's own calibration: radio.js FAR / AREA): what a player
// learns with the set in their hands. Within AREA it's all the same loud SOS: no distance to read.
export const distOf = n => SIM.radio.area + (1 - n) * (SIM.radio.far - SIM.radio.area);

function legTarget(h, len) {
  let x = P.x + Math.cos(h) * len, y = P.y + Math.sin(h) * len;
  // not into the frontier storm
  x = clamp(x, BORDER.left + 30, MAP_W - BORDER.right - 30); y = clamp(y, BORDER.top + 30, MAP_H - BORDER.bottom - 30);
  const p = N.nearestFree(x, y, 14, P.x, P.y, now());
  if (!p || hyp(p, P) < len * 0.35) return null;
  // not into where the bear was just seen
  if (S.bearSeen && now() - S.bearSeen.t < 240 && hyp(p, S.bearSeen) < SIM.cost.bear.r && hyp(P, S.bearSeen) > hyp(p, S.bearSeen)) return null;
  return p;
}
// The best of a few headings round h (within spread): a short way there, over ground not walked yet.
function pickLeg(h, spread, len) {
  const Z = SIM.search;
  let best = null;
  for (let k = 0; k < 10; k++) {
    const a = h + (k === 0 ? 0 : rand(-spread, spread) * (k > 6 ? 2 : 1));
    const c = legTarget(a, len);
    if (!c) continue;
    const p = H.path(P.x, P.y, c.x, c.y);
    if (!p || p.len > Z.maxRatio * hyp(c, P) + 40) continue;   // not a long way round for a short look
    const fresh = lineVisits(P, c);
    const score = fresh * SIM.memory.freshK + Math.abs(wrapA(a - h)) + Math.random() * 0.2;
    if (!best || score < best.score) best = { a, c, score, fresh };
  }
  return best;
}
const spottedOr = extra => () => { const s = spotBody(); if (s) { S.mem.body = s; return true; } return !!extra?.(); };
const spotNote = () => note('Spotted', `the beacon blinking, ${Math.round(hyp(S.mem.body, P))} px off`);

// Going in circles? The last legs ended close together, or over ground walked again and again, or the best
// signal hasn't got better for a long while: then hot and cold is beaten; triangulate.
function circling() {
  const M = S.mem, T2 = SIM.tri, ends = M.legEnds;
  if (M.best && now() - (M.bestT ?? now()) > SIM.search.plateau) return `no better than ${gapOf(M.best.n).toFixed(1)} s for ${Math.round((now() - M.bestT) / 60)} min`;
  if (ends.length >= T2.loopLegs) {
    const last = ends.slice(-T2.loopLegs);
    const xs = last.map(e => e.x), ys = last.map(e => e.y);
    const box = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (box < T2.loopBox) return `the last ${T2.loopLegs} legs all ended within ${Math.round(box)} px`;
    const rev = last.reduce((a, e) => a + e.fresh, 0) / last.length;
    if (rev >= T2.loopVisits) return `going over the same ground (walked ~${rev.toFixed(1)} times already)`;
  }
  if (M.legs >= T2.afterLegs) return `${M.legs} legs of hot and cold`;
  return '';
}

// Where the readings put the source: the point whose distance to each reading best matches what the blips said
// there (trilateration, least squares over a grid round the strongest reading). Needs three or more readings
// spread out (not all on one line: a line leaves a mirror image either side of it).
function triangulate() {
  const M = S.mem, T2 = SIM.tri, Z = SIM.search;
  const R = M.readings.filter(r => r.n < Z.zone - 0.002).slice(-T2.maxReadings);
  if (R.length < 3) return { need: 'readings', n: R.length };
  let area = 0, tri = null;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) for (let k = j + 1; k < R.length; k++) {
    const a = Math.abs((R[j].x - R[i].x) * (R[k].y - R[i].y) - (R[k].x - R[i].x) * (R[j].y - R[i].y)) / 2;
    if (a > area) { area = a; tri = [R[i], R[j], R[k]]; }
  }
  if (area < T2.minArea) {
    // all on a line: which way it runs, to walk off it square
    const a = R[0], b = R.reduce((m, r) => (hyp(r, a) > hyp(m, a) ? r : m), R[0]);
    return { need: 'side', n: R.length, line: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  const D = R.map(r => distOf(r.n));
  const cost = (x, y) => { let s = 0; for (let i = 0; i < R.length; i++) { const e = Math.hypot(x - R[i].x, y - R[i].y) - D[i]; s += e * e; } return s; };
  const r0 = R.reduce((m, r) => (r.n > m.n ? r : m), R[0]), rad = distOf(r0.n) + 80;
  let bx = r0.x, by = r0.y, bc = Infinity;
  for (let y = r0.y - rad; y <= r0.y + rad; y += 12) for (let x = r0.x - rad; x <= r0.x + rad; x += 12) {
    if (x < 0 || y < 0 || x > MAP_W || y > MAP_H) continue;
    const c = cost(x, y);
    if (c < bc) { bc = c; bx = x; by = y; }
  }
  for (let step = 4; step >= 1; step /= 2) {
    const cx = bx, cy = by;
    for (let dy = -12; dy <= 12; dy += step) for (let dx = -12; dx <= 12; dx += step) { const c = cost(cx + dx, cy + dy); if (c < bc) { bc = c; bx = cx + dx; by = cy + dy; } }
  }
  return { x: bx, y: by, rms: Math.sqrt(bc / R.length), n: R.length, area };
}

function* search() {
  const M = S.mem, Z = SIM.search;
  if (M.heading === null) {
    goal('listening');
    yield* H.still();
    yield* wait(Z.listen);
    M.heading = Math.random() * Math.PI * 2;
    note('Search', `${hearing(heard(Z.listen))}: pick a way at random, ${deg(M.heading)}°`);
  }
  const n0 = heard(1.5);
  if (n0 === null) { yield* wait(0.5); return; }
  if (M.mode !== 'tri') {
    const why = circling();
    if (why) { M.mode = 'tri'; M.leg = null; note('Strategy', `${why}: going in circles, triangulate from the readings (${M.readings.length} so far)`); if (S.stats) S.stats.triangulated = now() - S.stats.t0; }
  }
  if (M.mode === 'tri') { yield* triSearch(n0); return; }
  if (n0 >= Z.zone || M.zone) { M.leg = null; yield* zoneSearch(); return; }
  // a leg broken into (a meal, the snowshoes, the bear) carries on where it was, judged from its own start
  let L = M.leg && now() - M.leg.t < 150 ? M.leg : null;
  if (!L) {
    const len = lerp(Z.legFar, Z.legNear, clamp(n0));
    const pick = pickLeg(M.heading, Z.jitter * Math.PI / 180 * 2, len) || pickLeg(M.heading + Math.PI / 2, 1.2, len) || pickLeg(M.heading - Math.PI / 2, 1.2, len);
    if (!pick) { note('Search', 'hemmed in: no short way on from here'); M.heading += Math.PI; yield* H.jiggle(2); return; }
    M.heading = pick.a;
    M.legs++;
    L = M.leg = { start: { x: P.x, y: P.y }, n0, tgt: pick.c, len, t: now(), fresh: pick.fresh };
  }
  const { start, tgt, len } = L;
  goal(`searching: leg ${M.legs}, ${deg(M.heading)}°, ${hearing(L.n0)}`);
  const r = yield* H.goTo(tgt.x, tgt.y, 8, { until: spottedOr(() => heard(1) >= Z.zone), timeout: len / 3 + 40, maxRatio: Z.maxRatio * 3.5, penalty: memPenalty() });
  M.leg = null;
  M.legEnds.push({ x: P.x, y: P.y, fresh: L.fresh });
  if (M.legEnds.length > 20) M.legEnds.shift();
  if (M.body) { spotNote(); return; }
  yield* wait(0.6);
  const n1 = heard(1.2), moved = hyp(P, start);
  if (n1 === null) return;
  if (n1 >= Z.zone) { note('Search', `${hearing(n1)}: they're close (within ~120 px)`); return; }
  if (moved < 25) { const t = rand(70, 140) * (Math.random() < 0.5 ? -1 : 1); M.heading += t * Math.PI / 180; note('Search', `${r === true ? 'short leg' : 'blocked'}: turn ${Math.round(t)}°`); return; }
  // judge by the change per distance walked, scaled to a full leg
  const n0l = L.n0, dn = (n1 - n0l) * Math.min(1.6, len / moved);
  const g0 = gapOf(n0l).toFixed(1), g1 = gapOf(n1).toFixed(1);
  if (dn > Z.eps) {
    note('Warmer', `blips quicker (${g0} -> ${g1} s): keep on, ${deg(M.heading)}°`);
  } else if (dn < -Z.eps) {
    const t = rand(Z.turnMin, Z.turnMax) * (Math.random() < 0.5 ? -1 : 1);
    M.heading += t * Math.PI / 180;
    note('Colder', `blips slower (${g0} -> ${g1} s): turn ${Math.round(t)}° (toward fresh ground)`);
  } else {
    const t = Z.sameTurn * (Math.random() < 0.5 ? -1 : 1);
    M.heading += t * Math.PI / 180;
    note('Same', `no change (${g0} s): try across, turn ${t}°`);
  }
}

// Triangulating: read off a fix from the readings, walk to it, read again on the way, and close in.
function* triSearch(n0) {
  const M = S.mem, Z = SIM.search, T2 = SIM.tri;
  const fix = triangulate();
  if (fix.need) {
    // too few readings, or all along one line: walk a leg square to the line, over fresh ground
    const h = fix.need === 'side' ? fix.line + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 : M.heading + Math.PI / 2;
    const pick = pickLeg(h, 0.5, T2.sideLeg) || pickLeg(h + Math.PI, 0.5, T2.sideLeg) || pickLeg(Math.random() * 6.28, 3, T2.sideLeg);
    if (!M.sideSaid || now() - M.sideSaid > 60) { note('Strategy', fix.need === 'side' ? `the ${fix.n} readings lie on one line: walk off it square for one to the side` : `only ${fix.n} readings: walk on for more`); M.sideSaid = now(); }
    goal('triangulating: a reading off to the side');
    if (!pick) { yield* H.jiggle(2); return; }
    M.heading = pick.a;
    yield* H.goTo(pick.c.x, pick.c.y, 8, { until: spottedOr(), timeout: 80, penalty: memPenalty() });
    if (M.body) spotNote();
    return;
  }
  const tgt = N.nearestFree(fix.x, fix.y, 14, P.x, P.y, now()) || { x: fix.x, y: fix.y };
  const moved = !M.est || hyp(M.est, fix) > T2.renote;
  M.est = { x: fix.x, y: fix.y, rms: fix.rms };
  S.est = M.est;
  const p = H.path(P.x, P.y, tgt.x, tgt.y), straight = hyp(tgt, P);
  if (moved) note('Estimate', `~(${Math.round(fix.x)}, ${Math.round(fix.y)}) ±${Math.round(fix.rms)} px from ${fix.n} readings: heading there (${Math.round(straight)} px straight, ${p ? Math.round(p.len) + ' px to walk' : 'no way on foot'})`);
  // the way is a long way round a cliff: the axes and crampons would take it straight
  if (!M.climbAsked && !(H.inPack('axes') && H.inPack('crampons')) && count(state.sled, 'axes') && count(state.sled, 'crampons')
      && (!p || p.len > T2.climbRatio * straight + 200) && H.wallTowards(tgt.x, tgt.y)) {
    M.climbAsked = true; M.wantClimb = true;
    note('Pack', `the way to the estimate is ${p ? Math.round(p.len) + ' px round' : 'not on foot'}, a wall lies straight: back to the sled for the axes and crampons`);
    return;
  }
  goal(`to the estimate ~(${Math.round(fix.x)}, ${Math.round(fix.y)}), ${Math.round(straight)} px`);
  // walk a while, then read the fix again with what was heard on the way
  const r = yield* H.goTo(tgt.x, tgt.y, 10, { until: spottedOr(), timeout: T2.refix });
  if (M.body) { spotNote(); return; }
  if (r === true) {
    // at the fix and nothing to see: circle out round it a little
    M.estMiss = (M.estMiss || 0) + 1;
    note('Strategy', `at the estimate and no beacon in sight (${M.estMiss}): look round it`);
    for (const rr of [40, 80]) for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, c = N.nearestFree(fix.x + Math.cos(a) * rr, fix.y + Math.sin(a) * rr, 5, P.x, P.y, now());
      if (!c) continue;
      yield* H.goTo(c.x, c.y, 10, { until: spottedOr(), timeout: 30 });
      if (M.body) { spotNote(); return; }
    }
    if (M.estMiss >= 2) { M.readings = M.readings.slice(-6); note('Strategy', 'the fix is off: start the readings afresh'); M.estMiss = 0; }
  } else if (r === false) {
    M.estFail = (M.estFail || 0) + 1;
    if (M.estFail >= 2 && !M.climbAsked && count(state.sled, 'axes') && count(state.sled, 'crampons') && !(H.inPack('axes') && H.inPack('crampons'))) {
      M.climbAsked = true; M.wantClimb = true;
      note('Pack', 'can\'t find a way to the estimate on foot: back to the sled for the axes and crampons');
    }
  }
}
// Within ~120 px the SOS is loud everywhere: with a fix, straight to it; without one, walk across the loud patch
// to find its edges (the body lies on the line through the middle of that crossing, square to it).
function* zoneSearch() {
  const M = S.mem, Z = SIM.search, sp = spottedOr();
  const loud = () => (heard(0.8) ?? 0) >= Z.zone;
  if (!M.zone) {
    const fix = triangulate();
    M.zone = { entry: { x: P.x, y: P.y }, h: M.heading, stage: 1, last: { x: P.x, y: P.y }, tries: 0 };
    if (!fix.need && fix.rms < SIM.tri.maxRms) {
      M.zone.stage = 0; M.zone.mid = { x: fix.x, y: fix.y }; M.est = S.est = fix;
      note('Search', `the SOS loud and clear: the readings put them at ~(${Math.round(fix.x)}, ${Math.round(fix.y)})`);
    } else note('Search', 'the SOS loud and clear: cross the loud patch to find its far edge');
  }
  const z = M.zone;
  goal(`searching the loud patch (${z.stage === 0 ? 'to the fix' : z.stage === 1 ? 'crossing it' : z.stage === 2 ? 'across the middle' : 'circling'})`);
  if (z.stage === 0) {
    const t = N.nearestFree(z.mid.x, z.mid.y, 10, P.x, P.y, now()) || z.mid;
    yield* H.goTo(t.x, t.y, 10, { until: sp, timeout: 120 });
    if (M.body) { spotNote(); return; }
    z.stage = 3; z.ring = 1; z.k = 0;
    return;
  }
  if (z.stage === 1) {
    // straight on until it fades again
    let walked = 0;
    while (walked < Z.zoneCross) {
      const tgt = legTarget(z.h, 40);
      if (!tgt) break;
      const a = { x: P.x, y: P.y };
      yield* H.goTo(tgt.x, tgt.y, 6, { until: sp, timeout: 30 });
      if (M.body) { spotNote(); return; }
      walked += hyp(P, a);
      if (hyp(P, a) < 10) break;
      if (loud()) z.last = { x: P.x, y: P.y }; else break;
    }
    z.mid = { x: (z.entry.x + z.last.x) / 2, y: (z.entry.y + z.last.y) / 2 };
    z.stage = 2;
    note('Search', `the loud patch runs ${Math.round(hyp(z.entry, z.last))} px this way: try square across its middle`);
    return;
  }
  if (z.stage === 2) {
    yield* H.goTo(z.mid.x, z.mid.y, 10, { until: sp, timeout: 90 });
    if (M.body) { spotNote(); return; }
    for (const sd of [1, -1]) {
      const h = z.h + sd * Math.PI / 2;
      let tgt = null;
      for (let len = Z.zoneCross / 2; len >= 40 && !tgt; len -= 30) tgt = legTarget(h, len);
      if (!tgt) continue;
      yield* H.goTo(tgt.x, tgt.y, 10, { until: sp, timeout: 90 });
      if (M.body) { spotNote(); return; }
      yield* H.goTo(z.mid.x, z.mid.y, 10, { until: sp, timeout: 90 });
      if (M.body) { spotNote(); return; }
    }
    z.stage = 3; z.ring = 1; z.k = 0;
    note('Search', 'not on that line: circle out round the middle');
    return;
  }
  // circling out round the middle
  const r = 45 * z.ring, n = Math.max(6, Math.round(r / 18));
  const a = (z.k / n) * Math.PI * 2;
  const tgt = N.nearestFree(z.mid.x + Math.cos(a) * r, z.mid.y + Math.sin(a) * r, 6, P.x, P.y, now());
  z.k++;
  if (z.k >= n) { z.k = 0; z.ring++; }
  if (z.ring > 5) { note('Strategy', 'lost the loud patch: triangulate again'); M.zone = null; M.mode = 'tri'; return; }
  if (tgt) yield* H.goTo(tgt.x, tgt.y, 10, { until: sp, timeout: 45 });
  if (M.body) spotNote();
}
// no radio at all (lost with a member, none on the sled): wander, looking
function* searchBlind() {
  goal('searching blind: no radio');
  const M = S.mem;
  if (M.heading === null) M.heading = Math.random() * Math.PI * 2;
  M.heading += rand(-0.8, 0.8);
  const tgt = legTarget(M.heading, 150);
  if (!tgt) { M.heading += Math.PI / 2; return; }
  yield* H.goTo(tgt.x, tgt.y, 10, { until: spottedOr(), timeout: 60 });
  if (M.body) note('Spotted', `the beacon blinking, ${Math.round(hyp(M.body, P))} px off`);
}

// --- the lost explorer ------------------------------------------------------------------------------
function* openBody() {
  const M = S.mem, b = M.body;
  goal('to the body');
  const st = standBeside(b.x, b.y);
  const r = yield* H.goTo(st.x, st.y, 3, { timeout: 200 });
  if (r !== true && hyp(P, b) > 14) { yield* H.jiggle(1); return; }
  goal('at the body: their pack');
  if (!(yield* H.openContainer(() => H.bodyPoint(b.x, b.y)))) { note('Body', 'could not get at their pack'); yield* H.jiggle(1); return; }
  yield* until(() => state.distress.found, 1);
  yield* wait(0.5);
  for (const id of SIM.loot) {
    const ref = state.compass.target?.ref;
    const n = ref ? count(ref, id) : 0;
    if (!n) continue;
    const got = yield* H.takeFrom(id, n);
    if (got) note('Loot', `their ${name(id)}${got > 1 ? ' x' + got : ''}${id === 'rec_sos' ? ': their last words (hope: the cold bites a little less)' : ''}`);
    else note('Loot', `no room for their ${name(id)}`);
  }
  yield* wait(0.4);
  yield* H.closeUI();
}
function* wrap() {
  const M = S.mem, b = M.body || { x: state.distress.x, y: state.distress.y };
  if (!H.inPack('sheet') || !H.inPack('rope')) {
    const miss = [!H.inPack('sheet') && 'a canvas sheet', !H.inPack('rope') && 'a rope'].filter(Boolean).join(' and ');
    if (!M.learned.has('wrap')) note('Learned', `wrapping them needs ${miss}: back to the sled for them`);
    else note('Body', `still no ${miss}: back to the sled`);
    M.learned.add('wrap'); S.saveLearned?.();
    const need = ['sheet', 'rope'].filter(id => !H.inPack(id));
    if (need.every(id => count(state.sled, id) > 0)) M.needKit = true;
    else if (knownFallen(need)) M.needFallen = need;
    else { note('Body', `no ${miss} anywhere: nothing to wrap them in`); S.cool.wrapGiveUp = now() + 60; yield* wait(5); return; }
    if (S.stats) S.stats.kitTrips++;
    return;
  }
  goal('wrapping the body');
  const st = standBeside(b.x, b.y);
  const r = yield* H.goTo(st.x, st.y, 3, { timeout: 400 });
  if (r !== true && hyp(P, b) > 14) { yield* H.jiggle(1); return; }
  if (!(yield* H.openRow(() => H.bodyPoint(b.x, b.y)))) { yield* H.jiggle(0.8); return; }
  yield* H.actTap('wrap');
  if (!(yield* until(() => !!state.burden.job || state.distress.wrapped, 1.5))) return;
  note('Wrap', 'the sheet over them, four rope bands');
  yield* until(() => state.distress.wrapped || !state.burden.job, 8);
  if (state.distress.wrapped && S.stats) S.stats.wrapped = now() - S.stats.t0;
}
// carry or drag: what's between here and camp (the straight line's ground)
function burdenCost(mode, sh, len) {
  const tb = SIM.burden[mode];
  let t = 0, e = 0;
  for (const k of ['snow', 'deep', 'ice', 'path', 'thin', 'wall']) {
    const [v, epm] = tb[k === 'wall' || k === 'thin' ? 'snow' : k] || tb.snow;
    const d = len * (sh[k] || 0);
    t += d / v; e += d / v * epm / 60;
  }
  return { t, e, u: t + SIM.burden.energyK * e };
}
export function chooseMode(from, to, sh = null) {
  sh = sh || N.lineShares(from.x, from.y, to.x, to.y);
  const len = sh.len ?? Math.hypot(to.x - from.x, to.y - from.y);
  const c = burdenCost('carry', sh, len), d = burdenCost('drag', sh, len);
  return { mode: c.u <= d.u ? 'carry' : 'drag', c, d, sh };
}
function* takeUp() {
  const bu = state.burden.bundle;
  if (!bu) { yield* wait(0.5); return; }
  const mid = { x: (bu.hx + bu.fx) / 2, y: (bu.hy + bu.fy) / 2 };
  const ch = chooseMode(mid, doorFront());
  const want = ch.mode;
  if (!S.mem.modeSaid || S.mem.modeSaid !== want) {
    note(want === 'carry' ? 'Carry' : 'Drag', `deep snow ${Math.round(ch.sh.deep * 100)}% of the way home (carry ~${Math.round(ch.c.t)} s/${ch.c.e.toFixed(2)} energy, drag ~${Math.round(ch.d.t)} s/${ch.d.e.toFixed(2)})`);
    S.mem.modeSaid = want;
  }
  goal(`taking up the body (${want})`);
  const st = standBeside(mid.x, mid.y, 10);
  const r = yield* H.goTo(st.x, st.y, 3, { climb: false, timeout: 300 });
  if (r !== true && hyp(P, mid) > 14) { yield* H.jiggle(1); return; }
  if (!(yield* H.openRow(H.bundlePoint))) { yield* H.jiggle(0.8); return; }
  yield* H.actTap(want);
  yield* until(() => state.burden.mode === want, 3);
  S.mem.modeSince = now();
}
function* goHome() {
  const M = S.mem, Bu = state.burden;
  const df = doorFront();
  goal(`taking them home (${Bu.mode}), ${Math.round(hyp(P, TENT))} px to camp`);
  M.nextModeCheck = now() + 4;
  const needSwitch = () => {
    if (now() < M.nextModeCheck || !S.path || now() - (M.modeSince || 0) < SIM.burden.dwell) return false;
    M.nextModeCheck = now() + SIM.burden.recheck;
    let i0 = 0, bd = 1e9;
    S.path.forEach((p, i) => { const d = hyp(p, P); if (d < bd) { bd = d; i0 = i; } });
    const sh = N.pathShares(S.path, i0, SIM.burden.ahead, P);
    if (sh.len < 40) return false;
    const ch = chooseMode(P, P, { ...sh, wall: 0, len: sh.len });
    const cur = Bu.mode, other = cur === 'carry' ? 'drag' : 'carry';
    const cu = cur === 'carry' ? ch.c.u : ch.d.u, ou = other === 'carry' ? ch.c.u : ch.d.u;
    if (ou < cu * (1 - SIM.burden.switchGain)) { M.switchTo = { other, sh, cu, ou }; return true; }
    return false;
  };
  const r = yield* H.goTo(df.x, df.y, 6, { climb: false, timeout: 1500, until: () => !Bu.mode || Bu.home || needSwitch() });
  if (M.switchTo && Bu.mode && !Bu.home) {
    const s = M.switchTo; M.switchTo = null;
    note(s.other === 'carry' ? 'Carry' : 'Drag', `switch: the next ${Math.round(s.sh.len)} px is ${Math.round(s.sh.deep * 100)}% deep snow (~${Math.round(s.ou)} vs ${Math.round(s.cu)})`);
    if (yield* H.openRow(H.playerPt)) { yield* H.actTap('switch'); yield* until(() => state.burden.mode === s.other || !state.burden.job && !state.burden.mode, 4); }
    M.modeSince = now();
    return;
  }
  if (r === false && Bu.mode) { note('Home', 'no headway toward camp: try again'); yield* H.jiggle(1.5); }
}

// --- the needs --------------------------------------------------------------------------------------
// off deep snow (hands are full wading it) or ice (no standing about on it) to somewhere to stop
function* toFirmGround(allowDeep = false) {
  const bad = c => c === 3 || c === 2 || (!allowDeep && c === 1);
  const t0 = P.terrain;
  if (t0 !== 'ice' && t0 !== 'thin' && t0 !== 'water' && (allowDeep || t0 !== 'deep')) return true;
  let best = null, bd = 1e9;
  for (let r = 6; r <= 72 && !best; r += 6) for (let a = 0; a < 16; a++) {
    const x = P.x + Math.cos(a / 16 * Math.PI * 2) * r, y = P.y + Math.sin(a / 16 * Math.PI * 2) * r;
    if (!N.freeAt(x, y) || bad(N.terrainCode(x, y))) continue;
    const t = T.terrainAt(x, y);
    if (t === 'ice' || t === 'thin' || (!allowDeep && t === 'deep')) continue;
    if (r < bd) { bd = r; best = { x, y }; }
  }
  if (!best) return false;
  yield* H.goTo(best.x, best.y, 2, { climb: false, timeout: 30 });
  return true;
}
export function* eat(th = SIM.eat.food) {
  const f = B().food;
  if (inside()) { note('Eat', `food ${f.toFixed(2)} < ${th}: a ration by the stove`); yield* H.tentMenu('eat'); yield* until(() => state.compass.phase !== 'eat', 5); yield* H.closeUI(); return; }
  yield* toFirmGround();
  const id = H.inPack('food') ? 'food' : 'meat';
  note('Eat', `food ${f.toFixed(2)} < ${SIM.eat.food}${id === 'meat' ? ' (raw meat)' : ''}`);
  goal('eating');
  if (!(yield* H.useItem(id))) return;
  yield* until(() => state.compass.phase === 'eat', 1);
  yield* until(() => state.compass.phase !== 'eat', 5);
  yield* H.closeUI();
}
export function* drink() {
  const w = B().water;
  if (inside()) { note('Drink', `water ${w.toFixed(2)} < ${SIM.eat.water}: meltwater off the stove`); yield* H.tentMenu('drink'); yield* until(() => state.compass.phase !== 'drink', 4); yield* H.closeUI(); return; }
  const flask = pack().slots.some(q => q && q.id === 'flask' && q.drinks > 0);
  if (flask) {
    yield* toFirmGround();
    note('Drink', `water ${w.toFixed(2)} < ${SIM.eat.water}: the flask`);
    goal('drinking');
    if (!(yield* H.useItem('flask', q => q.drinks > 0))) return;
    yield* until(() => state.compass.phase === 'drink', 1);
    yield* until(() => state.compass.phase !== 'drink', 4);
  } else {
    if (B().warmth < SIM.eat.snowWarmth) { note('Thirst', `water ${w.toFixed(2)}, flask dry, warmth ${B().warmth.toFixed(2)}: too cold to eat snow`); S.cool.drink = now() + 40; return; }
    yield* toFirmGround(true);
    note('Snow', `water ${w.toFixed(2)} < ${SIM.eat.water}, flask dry: a mittful of snow (warmth ${B().warmth.toFixed(2)})`);
    goal('eating snow');
    if (!(yield* H.eatSnow())) return;
    yield* until(() => state.compass.phase === 'snow', 1);
    yield* until(() => state.compass.phase !== 'snow', 4);
  }
  yield* H.closeUI();
}
export function* splint() {
  note('Splint', `injury ${B().injury.toFixed(2)} > ${SIM.eat.splint}: bind the leg`);
  goal('binding the leg');
  yield* toFirmGround(true);
  if (!(yield* H.useItem('splint'))) return;
  yield* until(() => state.compass.phase === 'splint', 1);
  yield* until(() => state.compass.phase !== 'splint', 6);
  yield* H.closeUI();
}
export function* rest(why) {
  const b = B(), target = Math.min(SIM.rest.until, (b.max ?? 1) * 0.95);
  if (target - b.energy < 0.05) { S.cool.rest = now() + 45; return; }   // (worn down: standing won't bring more back)
  note('Rest', `${why}: stand and get the wind back (to ${target.toFixed(2)})`);
  yield* toFirmGround(true);
  goal(`resting: energy ${b.energy.toFixed(2)} -> ${target.toFixed(2)}`);
  H.stop();
  const ok = yield* until(() => b.energy >= target || stormy() || !!bearThreat(), SIM.rest.maxWait);
  if (!ok) S.cool.rest = now() + 30;
}
export function* shoes(on, why) {
  note('Snowshoes', `${on ? 'on' : 'off'}: ${why}`);
  goal(on ? 'strapping on snowshoes' : 'taking off snowshoes');
  if (!(yield* H.useItem('snowshoes'))) { S.cool.shoes = now() + 10; return; }
  yield* wait(1.4);
  yield* H.closeUI();
  S.cool.shoes = now() + 6;
}

// --- the bear ---------------------------------------------------------------------------------------
export function* bear() {
  let said = '';
  // one note for each turn the encounter takes (and not the same again within half a minute)
  const say = (k, t) => { if (said !== k && !(S.bearSaid?.k === k && now() - S.bearSaid.t < 30)) note('Bear', t); if (said !== k) S.bearSaid = { k, t: now() }; said = k; };
  goal('the bear');
  while (true) {
    const b = bearThreat(SIM.bear.clear);
    if (!b) break;
    const d = hyp(b, P), st = b.st, H2 = state.hunt;
    S.bearSeen = { x: b.x, y: b.y, t: now() };
    // (burdened there's no backing off facing it, and carrying no flare: hands free first)
    if (state.burden.mode && (st === 'warn' || st === 'charge' || d < 70) && !state.burden.job) {
      say('down', `${st} ${Math.round(d)} away: set the body down, hands free`);
      if (yield* H.openRow(H.playerPt)) yield* H.actTap('down');
      yield* until(() => !state.burden.mode, 2);
      continue;
    }
    const gun = H.inPack('rifle') && H.inPack('cartridges');
    const lit = H2?.held || H2?.strikeT > 0 || (H2?.flares || []).some(f => !f.out && Math.hypot(f.x - P.x, f.y - P.y) < 40);
    const flare = !lit && H.inPack('flare') && state.burden.mode !== 'carry';
    if (H2?.aim) {
      if (b.dead || b.remembered || st === 'flee' || d > 170) { const p = H.playerPt(); yield* H.tap(p.x, p.y); continue; }
      // up and on it: fire when it warns or comes, or once it's close
      if (st === 'charge' || st === 'warn' || d < SIM.bear.shoot) {
        say('fire', `${st} ${Math.round(d)} away: fire (hit chance ~${(H2.aim.chance || 0).toFixed(2)})`);
        const s = worldToScreenUI(b.x, b.y - 6);
        yield* H.tap(s.x, s.y);
        yield* wait(0.3);
      } else { H.stop(); yield; }
      continue;
    }
    // a flare first (it always works within reach); the rifle for a charge, or when there's no flare to strike
    if (flare && (st === 'warn' || st === 'charge' || d < SIM.bear.flare)) {
      say('flare', `${st} ${Math.round(d)} away: strike a flare`);
      yield* H.useItem('flare', null, true);
      yield* wait(0.8);
      continue;
    }
    if (gun && !state.burden.mode && !b.remembered && (st === 'charge' || st === 'warn' || (st === 'stalk' && d < SIM.bear.raise && !lit))) {
      say('rifle', `${st === 'charge' ? 'charging' : st === 'warn' ? 'warning' : 'stalking'}, ${Math.round(d)} away: raise the rifle`);
      yield* H.useItem('rifle', null, true);
      continue;
    }
    // back away, facing it (explorer.js backs off by itself walking away from it)
    say('back', `${st} ${Math.round(d)} away: back off slowly, facing it`);
    goal(`backing away from the bear (${Math.round(d)} px)`);
    let ax = P.x - b.x, ay = P.y - b.y;
    const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    // a clear line to back along (no rock, open water or thin ice behind), as near straight away from it as there is
    { const a0 = Math.atan2(ay, ax);
      for (const da of [0, 0.26, -0.26, 0.52, -0.52, 0.79, -0.79, 1.05, -1.05, 1.31, -1.31, 1.57, -1.57]) {
        const a = a0 + da, ok = [8, 16, 26].every(r => { const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r; return N.freeAt(x, y) && N.terrainCode(x, y) !== 3; });
        if (ok) { ax = Math.cos(a); ay = Math.sin(a); break; }
      } }
    if (H.canSteer()) H.steer(ax, ay); else H.stop();
    yield;
  }
  H.stop();
  if (state.hunt?.aim) { const p = H.playerPt(); yield* H.tap(p.x, p.y); }
  if (said && said !== 'back') note('Bear', 'clear of it');
  else if (said) S.bearSaid = { k: 'back', t: now() };
}

// --- shelter: the night, a storm, the cold -----------------------------------------------------------
export function* shelter(why) {
  const dBase = hyp(P, TENT), havePup = H.inPack('puptent');
  // the pup tent left standing somewhere: only worth walking back to if it's nearer than base camp and not far
  let pitched = state.pup?.pitched;
  if (pitched && !havePup && (hyp(pitched, P) > SIM.camp.pupWalk || hyp(pitched, P) > dBase)) pitched = null;
  const useBase = dBase < SIM.camp.baseNear || (!havePup && !pitched);
  if (!inside()) {
    if (useBase) {
      note('Camp', `${why}: back to base camp (${Math.round(dBase)} px)`);
      goal(`to base camp: ${why}`);
      const df = doorFront();
      const r = yield* H.goTo(df.x, df.y, 26, { climb: false, timeout: 900 });
      if (r !== true) { yield* H.jiggle(1); return; }
      yield* enterTent('camp');
    } else {
      if (pitched && hyp(pitched, P) > 30) {
        note('Camp', `${why}: back to the pup tent left standing ${Math.round(hyp(pitched, P))} px off`);
        const pd = pupDoor();
        if (pd) yield* H.goTo(pd.fx, pd.fy, 12, { climb: false, timeout: 300 });
      } else if (!pitched) {
        note('Camp', `${why}: pitch the pup tent here (base camp ${Math.round(dBase)} px)`);
        goal(`pitching the pup tent: ${why}`);
        if (!(yield* pitch())) { S.cool.shelter = now() + 15; return; }
      }
      yield* enterTent('pup');
    }
  }
  if (!inside()) return;
  yield* stayIn(why);
}
function* pitch() {
  for (let k = 0; k < SIM.camp.pitchTries; k++) {
    yield* toFirmGround(true);
    if (!H.inPack('puptent')) return !!state.pup?.pitched;
    yield* H.useItem('puptent');
    if (!(yield* until(() => !!state.pup.job || !!state.pup.pitched, 1))) {
      note('Camp', 'the ground won\'t take the tent here: a few steps on');
      yield* H.closeUI();
      // somewhere flatter: open snow a little way off
      const a = Math.random() * Math.PI * 2;
      const spot = N.nearestFree(P.x + Math.cos(a) * 24, P.y + Math.sin(a) * 24, 4, P.x, P.y);
      if (spot) yield* H.goTo(spot.x, spot.y, 3, { climb: false, timeout: 15 }); else yield* H.jiggle(2);
      continue;
    }
    const tries0 = state.pup.job?.tries || 1;
    yield* until(() => !state.pup.job, 120);
    if (state.pup.pitched) { if (S.stats) S.stats.pitches++; const tr = (S.lastPitch?.tries) || tries0; note('Camp', `the pup tent is up${tr > 1 ? ` (${tr} tries in the wind)` : ''}`); return true; }
  }
  return false;
}
function* enterTent(kind) {
  const t0 = now();
  for (let k = 0; k < 6 && !inside(); k++) {
    // right up to the door first: in a gale the knockdowns break a long walk to it
    const d = kind === 'camp' ? tentDoor() : pupDoor();
    if (d && Math.hypot(P.x - d.fx, P.y - d.fy) > 8) yield* H.goTo(d.fx, d.fy, 4, { climb: false, timeout: 40 });
    yield* until(() => P.mode === 'walk' || P.mode === 'cower', 6);
    const pt = kind === 'camp' ? H.tentPoint() : H.pupPoint();
    if (!pt) return;
    H.stop();
    H.press(pt.x, pt.y, true); yield; H.release(); yield;
    yield* until(() => P.mode === 'approach' || P.mode === 'tent-in' || inside(), 1.5);
    yield* until(() => inside() || P.mode === 'walk', 25);
  }
  if (inside()) goal(`in the ${kind === 'camp' ? 'base camp tent' : 'pup tent'}`);
  else { note('Camp', `couldn't get into the ${kind === 'camp' ? 'tent' : 'pup tent'} (${Math.round(now() - t0)} s): keep moving (walking keeps them warm)`); S.cool.shelter = now() + 25; }
}
function* stayIn(why) {
  const b = B();
  let slept = false;
  while (inside()) {
    if (b.phase === 'sleep') { yield; continue; }
    if (b.food < SIM.eat.tentFood && (H.inPack('food') || H.inPack('meat')) && !canSleep()) { yield* eat(SIM.eat.tentFood); continue; }
    if (b.water < SIM.eat.tentWater) { note('Drink', `water ${b.water.toFixed(2)}: meltwater off the stove`); yield* H.tentMenu('drink'); yield* wait(2.5); yield* H.closeUI(); continue; }
    // the flask topped up from the stove before going out again (the tent menu's Fill the flask)
    if (pack().slots.some(q => q && q.id === 'flask' && q.drinks < 3) && (!S.mem.filledAt || now() - S.mem.filledAt > 30)) {
      note('Drink', 'fill the flask from the stove');
      S.mem.filledAt = now();
      yield* H.tentMenu('fill'); yield* wait(0.8); yield* H.closeUI(); continue;
    }
    if (canSleep() && !slept) {
      note('Sleep', `night: sleep till dawn (warmth ${b.warmth.toFixed(2)}, energy cap ${(b.max ?? 1).toFixed(2)})`);
      goal('asleep');
      yield* H.tentMenu('sleep');
      if (yield* until(() => b.phase === 'sleep', 2)) { slept = true; if (S.stats) S.stats.sleeps++; yield* until(() => b.phase !== 'sleep', 30); note('Sleep', `morning: warmth ${b.warmth.toFixed(2)}, energy ${b.energy.toFixed(2)}, food ${b.food.toFixed(2)}`); }
      else { yield* H.closeUI(); yield* wait(2); }
      continue;
    }
    const night = isNight(), warm = b.warmth >= SIM.camp.leaveWarmth && (b.wet || 0) < 0.1;
    const wantNight = night && !(b.warmth >= SIM.camp.goOnWarmth && (b.max ?? 1) >= SIM.camp.goOnMax && calm());
    const restUp = (b.max ?? 1) < SIM.rest.sleepMax && night;
    if (warm && calm() && !wantNight && !restUp && !bearThreat()) break;
    goal(`sheltering: ${stormy() ? 'the storm' : night ? 'the night' : 'warming up'} (warmth ${b.warmth.toFixed(2)})`);
    yield* wait(1);
  }
  if (!inside()) return;
  note('Camp', `out again: warmth ${b.warmth.toFixed(2)}, energy ${b.energy.toFixed(2)}${stormy() ? '' : ', calm'}`);
  yield* leaveTent();
}
export function* leaveTent() {
  const wasPup = P.shelter?.kind === 'pup';
  yield* H.tentMenu('leave');
  yield* until(() => P.mode === 'walk', 8);
  if (wasPup && state.pup?.pitched) yield* strike();
}
function* strike() {
  goal('striking the pup tent');
  const pd = pupDoor();
  if (pd) yield* H.goTo(pd.fx, pd.fy, 1.5, { climb: false, timeout: 10 });
  for (let k = 0; k < 3 && state.pup.pitched; k++) {
    const pt = H.pupPoint();
    if (!pt) break;
    yield* H.still();
    H.press(pt.x, pt.y);
    yield* until(() => !state.pup.pitched && !state.pup.job, 8);
    H.release(); yield;
  }
  if (!state.pup.pitched) note('Camp', 'struck the pup tent, back in the pack');
  else note('Camp', 'couldn\'t strike the pup tent: leave it standing');
}
