// Thin ice (slice 5): it carries a weight for a while, warns, and then gives way.
//
// Thin ice is terrain class 3 painted pale (lum >= terrain.WATER_LUM); darker class 3 is the open
// sea. A faint darker mottling lies over it (drawMottle), so an observant eye can tell it from the
// safe lake ice. A coarse grid of stress cells (CELL world px) lies over it, filled only where
// someone has stood. explorer.js calls load() every frame they're on it with how heavily they bear
// on it (w: a full pack more, snowshoes and crawling far less) and how hard they move (k: 0 standing
// .. 1 walking pace, more at a march); the weight spreads over the cells round the feet (a soft
// kernel, LOAD_R), divided by the ice's strength there (thicker toward the shore: STRONG at the
// edge, WEAK in the middle; refrozen holes weakest of all, x REFROZEN). Cells nobody is on ease
// back after a moment, so backing off the way you came relieves it. slam() is a sudden load (a
// fall onto it). The stress under the feet decides everything:
//   >= CREAK      creaks (event 'creak'; load() reports creak: true, explorer.js glances down)
//                 and a hairline flickers under the boots for a moment
//   >= CRACK      the first real crack: a sharp 'crack' event and two or three long white
//                 fractures (20-30 px) shooting out past the figure (icecracks.fracturePatch: white
//                 with an ink underside); load() reports first: true once per spell on the ice,
//                 only when the explorer can take the beat (canBeat: walking), and explorer.js
//                 freezes a moment and looks down
//   0.55 / 0.7 / 0.85  more fractures, then cross-cracks joining them round the feet, louder
//                 cracks, and single sharp fractures between
//   >= 1          it gives way: a hole (breakAt), a burst of shards, 'breakthrough'
// Fractures stay drawn ~40 s and fade over ~12 s.
//
// Frozen lakes (terrain class 2, ICE) carry stress the same way, only far stronger (LAKE_STR, a
// touch more at the shore, and moving on them bears at LAKE_MOVE of thin ice's rate), so walking straight across never comes near breaking it; going back
// over the same ice, or standing about on it, builds it up just as on thin ice, only slower. Lake
// cells ease back later and slower (LAKE_EASE_AFTER, LAKE_EASE); a lake's fractures aren't timed:
// each is tied to the stress of the cell it broke from and fades away with it, so a crack still
// showing is ice still weak (and once faded it stays healed: a fresh crossing breaks a fresh one).
// Micro-cracks (on both kinds of ice): at MICRO levels under the feet, tiny white hairlines (a few
// px, finer than the first crack) appear where they tread, a few more and longer at each level, so
// a walk across a lake leaves a trail of them and going back over it thickens it. They fade with
// their cell's stress too. Drawn as vector strokes from a fixed pool (MICRO_CAP, oldest reused),
// batched by alpha into a few paths: cheap however many are on screen.
//
// Holes: state.holes = [{ x, y, r, ro, age, freeze, maxR, cls, ... }]. terrain.isWater / waterDepth
// read them (deep right to the edge, and only over the ice class it broke in: cls, 3 thin or 2
// lake), so the explorer plunges and swims, the shore beat treats the hole as a wall, and the bear
// and the penguins keep off it. A hole only breaks on ice and never spreads past it (maxR: the
// distance to its edge caps r and the broken ring round it). It's dark water inside a jagged rim of
// broken ice, plates tipped along the edge and a few flat grey shards afloat; it stays open OPEN_S,
// then skins over from the rim inward over FREEZE_S (ro shrinks to 0) into darker new ice, drawn
// for the run. widen(h, a) breaks a piece off its edge (a heave that fails without axes).
// Hooks: NAS.breakIce() (a hole at the explorer's feet, if it's ice), NAS.holes.
// For wildlife: weigh(x, y, dt, w, k) bears on the ice like load() but never takes the explorer's
// freeze beat (w: how heavy, 1 = the explorer with a light pack; a polar bear would be ~3). Not
// wired yet: the bear has no plunge or swim, so its chase (slice 7) should call it every frame it's
// on ice (wildlife.js) once it can fall in: if the result's broke is set, it's in the hole.
import { state } from '../state.js';
import { classAt, lumAt, WATER_LUM, mask } from './terrain.js';
import { fracturePatch } from './icecracks.js';
import { visibleRect } from '../camera.js';

const THIN = 3, LAKE = 2, TAU = Math.PI * 2, KY = 0.8;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// --- stress ---------------------------------------------------------------------------------------
const CELL = 4;                 // world px per stress cell
const LOAD_R = 12, SIGMA = 6;   // the load spreads this far round the feet (ground plane)
const STAND = 0.06, MOVE = 0.1; // stress / s on the weakest ice: standing, plus moving at walking pace
const STRONG = 1.5, WEAK = 0.85;// strength by how far into the thin ice (shore .. middle)
const REFROZEN = 0.6;           // a refrozen hole's new ice: the weakest there is
const EASE_AFTER = 1.5, EASE = 0.035;   // unloaded cells ease back after this long, this fast (/ s)
export const CREAK = 0.18, CRACK = 0.4;
const LEVELS = [CRACK, 0.55, 0.7, 0.85];
// the fractures at each level: the first shoots out well past the figure; later ones join up round
const FRACTURE = [
  { n: 3, L: [20, 30], from: 1.5, ring: 0 },
  { n: 3, L: [14, 24], from: 2, ring: 0 },
  { n: 4, L: [10, 18], from: 1.5, ring: 7 },
  { n: 5, L: [8, 14], from: 1, ring: 4.5 },
];
// frozen lakes: this much stronger than the weakest thin ice (up to LAKE_SHORE x more at the shore);
// they ease back later and slower (in stress, which is 1 at the break: relative to their strength
// it's about thin ice's pace)
const LAKE_STR = 3, LAKE_SHORE = 1.25;
const LAKE_EASE_AFTER = 2, LAKE_EASE = 0.01;
// and moving on a lake bears on it less again than on thin ice (the sheet takes a walker's weight
// in its stride: going about on it, it's ~3.5x thin ice's strength; standing ~2.5-3x)
const LAKE_MOVE = 0.35;
// micro-cracks: the levels under the feet at which a few more tiny hairlines appear
const MICRO = [0.04, 0.13, 0.22];
// on a lake the same, with a lighter ink underside (its ice is paler: they still read white)
const LAKE_FRACTURE = FRACTURE.map(f => ({ ...f, inkA: 0.5 }));
const cells = new Map();        // key -> { s, t (last loaded), lv (crack level reached), ml (micro level), lake, str }
const key = (cx, cy) => cy * 2048 + cx;

const onThin = (x, y) => classAt(x, y) === THIN && lumAt(x, y) >= WATER_LUM;
const onLake = (x, y) => classAt(x, y) === LAKE;
// the ice class at (x, y): THIN (pale thin ice), LAKE (a frozen lake) or 0 (not ice that bears)
const iceClass = (x, y) => { const c = classAt(x, y); return c === LAKE || (c === THIN && lumAt(x, y) >= WATER_LUM) ? c : 0; };
const ON = { [THIN]: onThin, [LAKE]: onLake };   // where a crack may run, by class
export const isThin = (x, y) => onThin(x, y) && !holeAt(x, y);
export const isIce = (x, y) => iceClass(x, y) > 0 && !holeAt(x, y);
// how far into the ice of class cls a point is (sampled, up to max px): thin ice's thickness, roughly
function depthIn(x, y, max = 18, cls = THIN) {
  for (let d = 3; d <= max; d += 3) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      if (classAt(x + Math.cos(a) * d, y + Math.sin(a) * d * KY) !== cls) return d - 3;
    }
  }
  return max;
}
function frozenHoleAt(x, y) {
  for (const h of holes) {
    if (h.freeze < 1) continue;
    const dx = x - h.x, dy = (y - h.y) / KY;
    if (dx * dx + dy * dy < h.r * h.r) return true;
  }
  return false;
}
function cell(cx, cy, make) {
  const k = key(cx, cy);
  let c = cells.get(k);
  if (!c && make) {
    const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL, lake = classAt(x, y) === LAKE;
    const str = lake ? LAKE_STR * (LAKE_SHORE + (1 - LAKE_SHORE) * smooth(2, 12, depthIn(x, y, 12, LAKE)))
      : STRONG + (WEAK - STRONG) * smooth(2, 16, depthIn(x, y));
    c = { s: 0, t: state.time, lv: 0, ml: 0, lake, str: str * (frozenHoleAt(x, y) ? REFROZEN : 1) };
    cells.set(k, c);
  }
  return c;
}
export function stressAt(x, y) {
  const c = cells.get(key(Math.floor(x / CELL), Math.floor(y / CELL)));
  return c ? c.s : 0;
}
// add `amount` (at the weakest ice) round (x, y), spread by the kernel and divided by strength
// (only over the same class of ice as under the feet)
function deposit(x, y, amount) {
  const r2 = LOAD_R * LOAD_R, inv = 1 / (2 * SIGMA * SIGMA), k = classAt(x, y);
  const cx0 = Math.floor((x - LOAD_R) / CELL), cx1 = Math.floor((x + LOAD_R) / CELL);
  const cy0 = Math.floor((y - LOAD_R * KY) / CELL), cy1 = Math.floor((y + LOAD_R * KY) / CELL);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const px = (cx + 0.5) * CELL, py = (cy + 0.5) * CELL, dx = px - x, dy = (py - y) / KY, d2 = dx * dx + dy * dy;
    if (d2 > r2 || classAt(px, py) !== k) continue;
    const c = cell(cx, cy, true);
    c.s += amount * Math.exp(-d2 * inv) / c.str;
    c.t = state.time;
  }
}

let creakT = 0, snapT = 0, spell = false;
// Bear on the ice (thin or a frozen lake) at (x, y) for dt: w = how heavily (1 = the explorer with a
// light pack), k = how hard they move (0 standing, 1 walking pace); canBeat: they could stop for
// the beat at the first crack (else the spell stays open for when they can). -> { s: stress under
// the feet, creak: a creak this frame, first: the first real crack of this spell, broke: it gave
// way (the hole is already there) }.
const res = { s: 0, first: false, broke: false, creak: false };
export function load(x, y, dt, w, k, canBeat = true) {
  res.s = 0; res.first = false; res.broke = false; res.creak = false;
  if (!isIce(x, y) || dt <= 0) { if (stressAt(x, y) < 0.15) spell = false; res.s = stressAt(x, y); return res; }
  deposit(x, y, w * (STAND + MOVE * k * (classAt(x, y) === LAKE ? LAKE_MOVE : 1)) * dt);
  return judge(x, y, canBeat, dt);
}
// Anyone else bearing on the ice (wildlife: see the header): the same load, the same cracks and
// break, but never the explorer's freeze beat or spell.
export function weigh(x, y, dt, w, k = 1) {
  res.s = 0; res.first = false; res.broke = false; res.creak = false;
  if (!isIce(x, y) || dt <= 0) { res.s = stressAt(x, y); return res; }
  deposit(x, y, w * (STAND + MOVE * k * (classAt(x, y) === LAKE ? LAKE_MOVE : 1)) * dt);
  return judge(x, y, false, dt, true);
}
// A sudden load (landing on it from a fall): amount of stress at the weakest ice.
export function slam(x, y, amount) {
  res.s = 0; res.first = false; res.broke = false; res.creak = false;
  if (!isIce(x, y)) return res;
  deposit(x, y, amount);
  return judge(x, y, false, 0);
}
function judge(x, y, canBeat, dt, other = false) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), ck = key(cx, cy);
  const c = cell(cx, cy, true), s = c.s, on = c.lake ? onLake : onThin;
  res.s = s;
  if (s < 0.15 && !other) spell = false;
  creakT -= dt; snapT -= dt;
  // micro-cracks where they tread: a few tiny hairlines each level crossed (the cells round share
  // the level, so they come about a stride apart)
  if (c.ml < MICRO.length && s >= MICRO[c.ml]) {
    while (c.ml < MICRO.length && s >= MICRO[c.ml]) { addMicro(x, y, c.ml, ck, MICRO[c.ml], on); c.ml++; }
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const n = (i || j) && cells.get(key(cx + i, cy + j));
      if (n && n.ml < c.ml) n.ml = c.ml;
    }
  }
  // creaks, with a hairline flickering under the boots
  if (s >= CREAK && s < CRACK && creakT <= 0) {
    const q = (s - CREAK) / (CRACK - CREAK);
    creakT = (2.2 - 1.5 * q) * (0.7 + Math.random() * 0.6);
    state.events.push({ type: 'creak', x, y, strength: 0.35 + 0.5 * q });
    res.creak = true;
    addPatch(fracturePatch(x, y + 0.6, { n: 2, L: [4, 7 + 4 * q], from: 0.8, ring: 0 }, (Math.random() * 1e9) | 0, on), 0.55, 0.65);
  }
  // each level crossed under the feet once (per cell; on a lake the fracture lasts as long as
  // the cell's stress holds up)
  // (not drawn again where that level's fracture already shows close by: going back and forth over
  // the same few px would pile them into a nest)
  while (c.lv < LEVELS.length && s >= LEVELS[c.lv]) {
    if (!levelNear(x, y, c.lv)) {
      const p = fracturePatch(x, y + 0.6, (c.lake ? LAKE_FRACTURE : FRACTURE)[c.lv], (Math.random() * 1e9) | 0, on);
      p.ox = x; p.oy = y; p.lvl = c.lv;
      addPatch(p, 34 + 8 * c.lv + Math.random() * 8, 1, c.lake ? ck : -1, LEVELS[c.lv]);
    }
    state.events.push({ type: 'crack', x, y, strength: 0.6 + 0.13 * c.lv, stress: s });
    c.lv++;
    snapT = 0.6 + Math.random() * 0.6;
  }
  if (canBeat && !spell && s >= CRACK) { spell = true; res.first = true; }
  // between the levels, a single sharp fracture now and then
  if (s >= CRACK && snapT <= 0 && s < 1) {
    snapT = (1.5 - 1.1 * smooth(CRACK, 1, s)) * (0.6 + Math.random() * 0.8);
    state.events.push({ type: 'crack', x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 6, strength: 0.35 + 0.5 * smooth(CRACK, 1, s), stress: s });
    // (drawn only while few show round the feet: a slow back and forth would bury them in a nest)
    if (Math.random() < 0.5 && crowd(x, y) < 5) {
      const p = fracturePatch(x, y + 0.6, { n: 1, L: [10, 18], from: 2, ring: 0, inkA: c.lake ? 0.5 : 0.8 }, (Math.random() * 1e9) | 0, on);
      p.ox = x; p.oy = y; p.lvl = -1;
      addPatch(p, 30, 1, c.lake ? ck : -1, CRACK);
    }
  }
  if (s >= 1) { res.broke = !!breakAt(x, y); }
  return res;
}

// --- crack lines -----------------------------------------------------------------------------------
// life: seconds drawn at full strength (then a 12 s fade, or a quick one for a flicker); peak alpha;
// ck >= 0: a lake's fracture, tied instead to that cell's stress (it fades as that eases from th
// toward half of it, and never comes back: vis only falls)
const patches = [];
function addPatch(p, life, peak = 1, ck = -1, th = 0) {
  p.age = 0; p.life = life; p.peak = peak; p.fade = life < 2 ? 0.4 : 12; p.ck = ck; p.th = th; p.vis = 1;
  patches.push(p);
  if (patches.length > 18) patches.shift().c.width = 0;
}
// a fracture of crack level lv (or later) already showing within 7 px of (x, y)
function levelNear(x, y, lv) {
  for (const p of patches) if (p.lvl >= lv && p.vis > 0.5 && Math.abs(p.ox - x) < 7 && Math.abs(p.oy - y) < 6 && p.age < p.life) return true;
  return false;
}
// how many fractures from under a weight (not flickers) show from within 9 px of (x, y)
function crowd(x, y) {
  let n = 0;
  for (const p of patches) if (p.lvl !== undefined && p.vis > 0.3 && Math.abs(p.ox - x) < 9 && Math.abs(p.oy - y) < 7) n++;
  return n;
}
const heldBy = (ck, th) => { const c = cells.get(ck); return c ? smooth(th * 0.5, th * 0.92, c.s) : 0; };

// --- micro-cracks ----------------------------------------------------------------------------------
// A fixed pool of tiny hairline sprays (objects and their point arrays reused, the oldest first):
// up to MS strands of up to MP points each, in world space. Each fades with its cell's stress.
const MICRO_CAP = 160, MS = 4, MP = 4;
const micro = [];
let microHead = 0;
// strands per level, and their length range (world px): all far finer than the first real crack
const MICRO_N = [3, 4, 5], MICRO_L = [[1.8, 3.2], [2.6, 4.6], [3.4, 6.2]];
function addMicro(x, y, lvl, ck, th, on) {
  let m;
  if (micro.length < MICRO_CAP) { m = { pts: new Float32Array(MS * MP * 2), np: new Uint8Array(MS) }; micro.push(m); }
  else { m = micro[microHead]; microHead = (microHead + 1) % MICRO_CAP; }
  const ox = x + (Math.random() - 0.5) * 5, oy = y + 0.6 + (Math.random() - 0.5) * 3.5;
  m.x = ox; m.y = oy; m.ck = ck; m.th = th; m.vis = 1; m.age = 0;
  // not a star: one main hairline through the tread (both ways from it, unevenly), the rest branching
  // off it (or off each other) at a slant, shorter; strand count varies a little
  const L = MICRO_L[lvl], main = Math.random() * TAU;
  m.ns = Math.max(2, MICRO_N[lvl] - (Math.random() < 0.4 ? 1 : 0));
  for (let s = 0; s < m.ns; s++) {
    let px, py, dir, len;
    if (s < 2) {
      // the main line: out from near the middle, the second half the other way and shorter
      dir = main + (s ? Math.PI : 0) + (Math.random() - 0.5) * 0.5;
      len = (L[0] + (L[1] - L[0]) * Math.random()) * (s ? 0.35 + Math.random() * 0.4 : 1);
      px = ox; py = oy;
    } else {
      // a branch off a point along an earlier strand
      const q = (Math.random() * s) | 0, qn = m.np[q], o2 = q * MP * 2, j = Math.min(qn - 1, 1 + ((Math.random() * (qn - 1)) | 0));
      px = m.pts[o2 + j * 2]; py = m.pts[o2 + j * 2 + 1];
      dir = (q < 2 ? main + (q ? Math.PI : 0) : Math.random() * TAU) + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.8);
      len = (L[0] + (L[1] - L[0]) * Math.random()) * (0.5 + Math.random() * 0.4);
    }
    const o = (s * MP) * 2;
    let n = 1, d = 0;
    m.pts[o] = px; m.pts[o + 1] = py;
    while (n < MP && d < len) {
      const st = len / (MP - 1) * (0.6 + Math.random() * 0.8);
      d += st; dir += (Math.random() < 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.45);   // a sharp kink at each joint
      px += Math.cos(dir) * st; py += Math.sin(dir) * st * KY;
      if (!on(px, py)) break;
      m.pts[o + n * 2] = px; m.pts[o + n * 2 + 1] = py; n++;
    }
    m.np[s] = n;
  }
  m.r = L[1] + 1.5;
}

// --- holes ----------------------------------------------------------------------------------------
const holes = state.holes = [];
export const OPEN_S = 150, FREEZE_S = 100;
const shardsFly = [];
// the open hole at (x, y), or null
export function holeAt(x, y) {
  for (const h of holes) {
    if (h.ro <= 0) continue;
    const dx = x - h.x, dy = (y - h.y) / KY;
    if (dx * dx + dy * dy < h.ro * h.ro) return h;
  }
  return null;
}
// distance (ground plane) from (x, y) to the edge of the ice of class cls, sampled in 16 directions
function edgeDist(x, y, max = 14, cls = THIN) {
  let best = max;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU, c = Math.cos(a), sn = Math.sin(a) * KY;
    for (let d = 1; d < best; d += 1) if (classAt(x + c * d, y + sn * d) !== cls) { best = d; break; }
  }
  return best;
}
// Unit plate outline: a five-sided flake (x along its length, y across).
const FLAKE = [1, 0.1, 0.3, 0.8, -0.9, 0.4, -0.6, -0.7, 0.5, -0.6];
function rimOf(h) {
  // a jagged rim: per-vertex radius factors, re-cut each time the hole is widened
  const n = 15, out = [];
  let rs = h.seed;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  for (let i = 0; i < n; i++) out.push({ a: (i + (rnd() - 0.5) * 0.5) / n * TAU, k: 0.84 + rnd() * 0.3 });
  h.rim = out;
  // plates of broken ice tipped up along the edge (clustered and uneven: a few big slabs, more small
  // chips, some pushed out onto the ice), their outlines in world space once here
  const np = 6 + ((rnd() * 5) | 0), ringK = Math.min(1.32, h.maxR / h.r);
  h.plates = [];
  for (let i = 0; i < np; i++) {
    const big = rnd() < 0.35, a = rnd() * TAU, d = h.r * Math.min(big ? 0.9 + rnd() * 0.15 : 0.95 + rnd() * 0.4, ringK);
    h.plates.push(flake(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * KY, big ? 1.3 + rnd() * 0.7 : 0.4 + rnd() * 0.6, rnd() * TAU, rnd()));
  }
  h.ringK = ringK; h.grad = null;
  // a few flat grey shards afloat, spread round the hole
  if (!h.shards) h.shards = [];
  while (h.shards.length < 3 + (h.r > 7 ? 1 : 0)) h.shards.push({ a: (h.shards.length / 4 + rnd() * 0.15) * TAU, d: 0.3 + rnd() * 0.6, s: 0.4 + rnd() * 0.45, rot: rnd() * TAU, sp: (rnd() - 0.5) * 0.25, ph: rnd() * TAU });
}
function flake(x, y, s, rot, tilt) {
  const c = Math.cos(rot), sn = Math.sin(rot), pts = new Float32Array(10);
  for (let i = 0; i < 10; i += 2) { const u = FLAKE[i], v = FLAKE[i + 1]; pts[i] = x + (u * c - v * sn) * s; pts[i + 1] = y + (u * sn + v * c) * s * KY; }
  return { pts, tilt };
}
function burst(x, y, n, up = 7) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = 2 + Math.random() * 5;
    shardsFly.push({ x, y, z: 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * KY, vz: up * (0.4 + Math.random() * 0.8), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14, s: 0.35 + Math.random() * 0.6, age: 0, life: 1.4 });
  }
  if (shardsFly.length > 80) shardsFly.splice(0, shardsFly.length - 80);
}
// A hole through the ice at (x, y) (null if it isn't thin ice or a frozen lake there). Never wider
// than the ice round it.
export function breakAt(x, y) {
  const cls = iceClass(x, y);
  if (!cls || holeAt(x, y)) return null;
  const maxR = edgeDist(x, y, 14, cls);
  const h = { x, y, r: Math.max(3.2, Math.min(5.2 + Math.random() * 0.8, maxR - 0.5)), ro: 0, age: 0, freeze: 0, t0: state.time, maxR, cls, seed: 1 + ((Math.random() * 2e9) | 0) };
  h.ro = h.r;
  rimOf(h);
  holes.push(h);
  if (holes.length > 8) holes.shift();
  burst(x, y, 26, 8);
  addPatch(fracturePatch(x, y, { n: 6, L: [12, 22], from: h.r * 0.9, ring: h.r + 4 }, (Math.random() * 1e9) | 0, ON[cls]), 50);
  // the ice round it lets go of the stress it held (still cracked: get off it)
  for (const [k, c] of cells) {
    const cx = (k % 2048 + 0.5) * CELL, cy = (Math.floor(k / 2048) + 0.5) * CELL;
    if (Math.hypot(cx - x, (cy - y) / KY) < 20) { c.s = Math.min(c.s, 0.32); c.lv = Math.min(c.lv, 1); }
  }
  // (a lake's fractures round it no longer follow that stress: they stay a while as thin ice's do)
  for (const p of patches) if (p.ck >= 0 && Math.hypot(p.x + p.w / 2 - x, (p.y + p.h / 2 - y) / KY) < 30) { p.ck = -1; p.life = p.age + 30; p.fade = 12; }
  state.events.push({ type: 'breakthrough', x, y, r: h.r });
  return h;
}
// A piece of the edge breaks off toward angle a (ground plane): the hole widens (never past the
// edge of the ice).
export function widen(h, a) {
  const cls = h.cls || THIN, R0 = h.r, cap = Math.min(10, edgeDist(h.x, h.y, 16, cls) - 0.5);
  if (cap <= R0 + 0.3) { state.events.push({ type: 'crack', x: h.x, y: h.y, strength: 0.6, stress: 1 }); return; }
  h.r = Math.min(cap, h.r + 1.2 + Math.random() * 0.5);
  h.ro = h.r * (1 - h.freeze);
  h.x += Math.cos(a) * (h.r - R0) * 0.5; h.y += Math.sin(a) * (h.r - R0) * 0.5 * KY;
  h.maxR = edgeDist(h.x, h.y, 16, cls);
  h.seed = (h.seed * 48271) % 2147483647;
  rimOf(h);
  const ex = h.x + Math.cos(a) * h.r, ey = h.y + Math.sin(a) * h.r * KY;
  burst(ex, ey, 10, 5);
  addPatch(fracturePatch(ex, ey, { n: 2, L: [8, 14], from: 0.5, ring: 0 }, (Math.random() * 1e9) | 0, ON[cls]), 40);
  state.events.push({ type: 'crack', x: ex, y: ey, strength: 0.8, stress: 1 });
}

export function init() {
  state.breakIce = () => { const P = state.player; return breakAt(P.x, P.y); };
}

export function update(dt) {
  // unloaded cells ease back (backing off the way you came relieves it)
  const now = state.time;
  for (const [k, c] of cells) {
    if (now - c.t < (c.lake ? LAKE_EASE_AFTER : EASE_AFTER)) continue;
    c.s -= (c.lake ? LAKE_EASE : EASE) * dt;
    // a level eased well back under is open to be crossed again (a lake's, one at a time: its
    // fracture there has faded by then)
    if (c.lake) { while (c.lv > 0 && c.s < LEVELS[c.lv - 1] * 0.5) c.lv--; }
    else if (c.s < 0.25 && c.lv > 0) c.lv = 0;
    while (c.ml > 0 && c.s < MICRO[c.ml - 1] * 0.5) c.ml--;
    if (c.s <= 0) cells.delete(k);
  }
  for (let i = patches.length - 1; i >= 0; i--) {
    const p = patches[i];
    p.age += dt;
    if (p.ck >= 0) {
      if (p.age > 0.25) p.vis = Math.min(p.vis, heldBy(p.ck, p.th));
      if (p.vis < 0.01) { p.c.width = 0; patches.splice(i, 1); }
    } else if (p.age > p.life + p.fade) { p.c.width = 0; patches.splice(i, 1); }
  }
  for (const m of micro) {
    if (m.vis <= 0) continue;
    m.age += dt;
    if (m.age > 0.2) m.vis = Math.min(m.vis, heldBy(m.ck, m.th));
    if (m.vis < 0.02) m.vis = 0;
  }
  for (const h of holes) {
    h.age += dt;
    h.freeze = smooth(OPEN_S, OPEN_S + FREEZE_S, h.age);
    h.ro = h.freeze >= 1 ? 0 : h.r * (1 - h.freeze);
    if (h.freeze >= 1 && !h.healed) {
      // healed over: the cells there are rebuilt from scratch, as the weakest ice there is
      h.healed = true;
      for (const [k] of cells) {
        const cx = (k % 2048 + 0.5) * CELL, cy = (Math.floor(k / 2048) + 0.5) * CELL;
        if (Math.hypot(cx - h.x, (cy - h.y) / KY) < h.r + 3) cells.delete(k);
      }
    }
  }
  for (let i = shardsFly.length - 1; i >= 0; i--) {
    const p = shardsFly[i];
    p.age += dt; p.vz -= 26 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.z <= 0 && p.vz < 0) { if (holeAt(p.x, p.y) || p.age > 0.6) { shardsFly.splice(i, 1); continue; } p.z = 0; p.vz *= -0.25; p.vx *= 0.4; p.vy *= 0.4; }
    if (p.age > p.life) shardsFly.splice(i, 1);
  }
}

// --- drawing ---------------------------------------------------------------------------------------
const INK = '#262626';
function rimPath(ctx, h, R) {
  ctx.beginPath();
  const rim = h.rim;
  for (let i = 0; i < rim.length; i++) {
    const v = rim[i], x = h.x + Math.cos(v.a) * R * v.k, y = h.y + Math.sin(v.a) * R * v.k * KY;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function poly(ctx, pts, dx, dy) {
  ctx.beginPath(); ctx.moveTo(pts[0] + dx, pts[1] + dy);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + dx, pts[i + 1] + dy);
  ctx.closePath();
}
// a plate of ice: pale, with its grey underside showing to the lower right and an ink edge
function drawFlake(ctx, f, a) {
  ctx.globalAlpha = a;
  poly(ctx, f.pts, 0.12, 0.28 * (0.5 + f.tilt)); ctx.fillStyle = 'rgb(118,126,136)'; ctx.fill();
  poly(ctx, f.pts, 0, 0); ctx.fillStyle = 'rgb(240,244,247)'; ctx.fill();
  ctx.lineWidth = 0.1; ctx.strokeStyle = 'rgba(38,38,38,0.7)'; ctx.stroke();
  ctx.globalAlpha = 1;
}
// a shard moving (afloat, or thrown): its outline built into a scratch array, no allocation
const SCR = new Float32Array(10);
function shardAt(ctx, x, y, s, rot, sy, fill, edge, a) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  for (let i = 0; i < 10; i += 2) { const u = FLAKE[i], v = FLAKE[i + 1]; SCR[i] = x + (u * c - v * sn) * s; SCR[i + 1] = y + (u * sn + v * c) * s * KY * sy; }
  ctx.globalAlpha = a;
  poly(ctx, SCR, 0, 0); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 0.08; ctx.strokeStyle = edge; ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawHole(ctx, h, t) {
  const R = h.r, ro = h.ro, fz = h.freeze;
  // the broken, slushy ring of fractured ice round it (pale; never past the thin ice's edge)
  rimPath(ctx, h, R * h.ringK);
  ctx.globalAlpha = 0.55 * (1 - 0.6 * fz); ctx.fillStyle = 'rgb(232,236,240)'; ctx.fill(); ctx.globalAlpha = 1;
  // new ice where it has skinned over: darker than the old sheet
  if (fz > 0) {
    rimPath(ctx, h, R);
    ctx.globalAlpha = 0.75 * smooth(0, 0.3, fz); ctx.fillStyle = 'rgb(152,158,166)'; ctx.fill(); ctx.globalAlpha = 1;
  }
  if (ro > 0.3) {
    // the water: near ink-black in the middle, a little lighter up in the far part where the sky
    // catches it (the gradient is in world space: cached until the hole changes)
    if (!h.grad || Math.abs(h.gradRo - ro) > 0.05) {
      const g = h.grad = ctx.createRadialGradient(h.x - ro * 0.25, h.y - ro * 0.45, ro * 0.1, h.x, h.y, ro * 1.1);
      g.addColorStop(0, 'rgb(62,70,80)'); g.addColorStop(0.55, 'rgb(30,34,40)'); g.addColorStop(1, 'rgb(20,22,26)');
      h.gradRo = ro;
    }
    rimPath(ctx, h, ro);
    ctx.fillStyle = h.grad; ctx.fill();
    // the cut edge of the sheet, seen on the far side: a thin pale-grey band inside the rim
    ctx.save(); ctx.clip();
    ctx.translate(0, 0.55);
    rimPath(ctx, h, ro);
    ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(176,186,196,0.8)'; ctx.stroke();
    ctx.restore();
    // the ink edge: hairline on the upper left, heavier on the lower right
    rimPath(ctx, h, ro);
    ctx.lineJoin = 'miter'; ctx.lineWidth = 0.22; ctx.strokeStyle = 'rgba(38,38,38,0.55)'; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(h.x - ro * 0.2, h.y - ro * 0.2, ro * 3, ro * 3); ctx.clip();
    rimPath(ctx, h, ro); ctx.lineWidth = 0.38; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  } else {
    // healed: only a faint inked seam where the old rim was
    rimPath(ctx, h, R);
    ctx.lineWidth = 0.12; ctx.strokeStyle = 'rgba(70,74,80,0.4)'; ctx.stroke();
  }
  // a few flat grey shards afloat on slow circles; as it skins over they're caught where they float
  const tt = Math.min(t, h.t0 + OPEN_S);
  for (const s of h.shards) {
    const d = s.d * R * 0.8, open = d < ro - 0.4, a = s.a + s.sp * tt * 0.2, bob = open ? Math.sin(t * 1.7 + s.ph) * 0.1 : 0;
    shardAt(ctx, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * KY + bob, s.s, s.rot + a * 0.3, 0.55, 'rgb(196,204,212)', 'rgba(38,38,38,0.45)', open ? 0.85 : 0.5);
  }
  // plates of broken ice tipped up along the edge (fainter once it's refrozen)
  const pa = 1 - 0.55 * fz;
  for (const f of h.plates) drawFlake(ctx, f, pa);
}

// The mottling: faint darker blotches over all the thin ice, baked once (1 world px a pixel) over
// its bounding box from the class map, edges soft (the mask read bilinearly), then drawn culled.
let mott = null, mottV = -1;
function buildMottle(m) {
  mottV = m.version;
  const { cls, lum, w, h, scale } = m;
  const thinAt = (mx, my) => (mx >= 0 && my >= 0 && mx < w && my < h && cls[my * w + mx] === THIN && lum[my * w + mx] >= WATER_LUM ? 1 : 0);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (thinAt(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { mott = null; return; }
  const bx = (x0 - 1) * scale, by = (y0 - 1) * scale, W = (x1 - x0 + 3) * scale, H = (y1 - y0 + 3) * scale;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), cc = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + e) * u * v;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = bx + x + 0.5, wy = by + y + 0.5, fx = wx / scale - 0.5, fy = wy / scale - 0.5;
    const mx = Math.floor(fx), my = Math.floor(fy), tx = fx - mx, ty = fy - my;
    const cov = (thinAt(mx, my) * (1 - tx) + thinAt(mx + 1, my) * tx) * (1 - ty) + (thinAt(mx, my + 1) * (1 - tx) + thinAt(mx + 1, my + 1) * tx) * ty;
    if (cov < 0.02) continue;
    const n = 0.6 * vn(wx / 10, wy / 8) + 0.4 * vn(wx / 3.2 + 9, wy / 2.6 + 3);
    const a = smooth(0.4, 0.78, n) * cov;
    if (a < 0.01) continue;
    const i = (y * W + x) * 4;
    d[i] = 96; d[i + 1] = 104; d[i + 2] = 114; d[i + 3] = Math.round(255 * 0.3 * a);
  }
  g.putImageData(img, 0, 0);
  mott = { c, x: bx, y: by, w: W, h: H };
}
function drawMottle(ctx, r) {
  const m = mask();
  if (!m) return;
  if (mottV !== m.version) buildMottle(m);
  if (!mott) return;
  const x0 = Math.max(r.x0, mott.x), y0 = Math.max(r.y0, mott.y), x1 = Math.min(r.x1, mott.x + mott.w), y1 = Math.min(r.y1, mott.y + mott.h);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mott.c, x0 - mott.x, y0 - mott.y, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
}

export function drawGround(ctx) {
  const r = visibleRect(20);
  drawMottle(ctx, r);
  if (patches.length) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (const p of patches) {
      if (p.x > r.x1 || p.y > r.y1 || p.x + p.w < r.x0 || p.y + p.h < r.y0) continue;
      ctx.globalAlpha = p.peak * p.vis * Math.min(1, p.age / (p.life < 2 ? 0.08 : 0.2)) * (p.ck >= 0 ? 1 : clamp((p.life + p.fade - p.age) / p.fade));
      ctx.drawImage(p.c, p.x, p.y, p.w, p.h);
    }
    ctx.restore();
  }
  drawMicro(ctx, r);
}
// The micro-cracks: binned by alpha (MBINS steps), each bin one ink path and one white path.
const MBINS = 4, binIdx = new Int16Array(MBINS * MICRO_CAP), binN = new Int16Array(MBINS);
function microPath(ctx, b, dx, dy) {
  ctx.beginPath();
  for (let q = 0; q < binN[b]; q++) {
    const m = micro[binIdx[b * MICRO_CAP + q]], P = m.pts;
    for (let s = 0; s < m.ns; s++) {
      const n = m.np[s], o = s * MP * 2;
      if (n < 2) continue;
      ctx.moveTo(P[o] + dx, P[o + 1] + dy);
      for (let i = 1; i < n; i++) ctx.lineTo(P[o + i * 2] + dx, P[o + i * 2 + 1] + dy);
    }
  }
}
function drawMicro(ctx, r) {
  binN.fill(0);
  let any = false;
  for (let i = 0; i < micro.length; i++) {
    const m = micro[i];
    if (m.vis <= 0 || m.x + m.r < r.x0 || m.x - m.r > r.x1 || m.y + m.r < r.y0 || m.y - m.r > r.y1) continue;
    const a = m.vis * Math.min(1, m.age / 0.12);
    const b = Math.min(MBINS - 1, Math.floor(a * MBINS));
    if (a < 0.04) continue;
    binIdx[b * MICRO_CAP + binN[b]++] = i; any = true;
  }
  if (!any) return;
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  // never under about a device pixel (zoomed out on a phone the hairline would melt into its ink
  // and read grey)
  const px = 1 / (Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1);
  const wW = Math.max(0.25, 1.05 * px), wI = Math.max(0.32, 1.2 * px), oy = Math.max(0.19, 0.8 * px), ox = oy * 0.47;
  for (let b = 0; b < MBINS; b++) {
    if (!binN[b]) continue;
    const a = (b + 1) / MBINS;
    // the inked underside (light from the upper left), then the white hairline
    microPath(ctx, b, ox, oy);
    ctx.globalAlpha = 0.42 * a; ctx.lineWidth = wI; ctx.strokeStyle = 'rgb(36,38,42)'; ctx.stroke();
    microPath(ctx, b, 0, 0);
    ctx.globalAlpha = 0.97 * a; ctx.lineWidth = wW; ctx.strokeStyle = 'rgb(248,250,251)'; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// Holes go over the footprints (footprints.js draws after this module's drawGround): drawn as a
// drawable just under everything standing (keyed at the very top of the hole, so the explorer in
// it and anyone near it draws over).
function drawHoles(ctx) {
  const r = visibleRect(20), t = state.time;
  for (const h of holes) {
    if (h.x + 14 < r.x0 || h.x - 14 > r.x1 || h.y + 12 < r.y0 || h.y - 12 > r.y1) continue;
    drawHole(ctx, h, t);
  }
}

// shards thrown up as it gives way (y-sorted with the explorer, just in front of the hole)
function drawShards(ctx) {
  for (const p of shardsFly) {
    const a = clamp((p.life - p.age) / 0.4);
    if (p.z > 0.05) { ctx.globalAlpha = 0.25 * a; ctx.beginPath(); ctx.ellipse(p.x + 0.2, p.y + 0.15, p.s * 0.6, p.s * 0.25, 0, 0, TAU); ctx.fillStyle = 'rgb(110,116,124)'; ctx.fill(); }
    shardAt(ctx, p.x, p.y - p.z, p.s, p.rot, 1, 'rgb(240,244,247)', 'rgba(38,38,38,0.7)', a);
  }
  ctx.globalAlpha = 1;
}
const out = [];
const holeDrawable = { y: 0, draw: drawHoles };   // (no x: keyed by plain y)
const shardDrawable = { x: 0, y: 0, draw: drawShards };
export function drawables() {
  out.length = 0;
  if (holes.length) {
    // (keyed by plain y at the top of the topmost hole: no x, so main.js doesn't add plateau height)
    let top = Infinity;
    for (const h of holes) top = Math.min(top, h.y - h.r * KY * 1.4);
    holeDrawable.y = top - 1;
    out.push(holeDrawable);
  }
  if (shardsFly.length) {
    const p = shardsFly[shardsFly.length - 1];
    shardDrawable.x = p.x; shardDrawable.y = p.y + 3;
    out.push(shardDrawable);
  }
  return out;
}

export const _debug = { cells, patches, holes, shardsFly, micro };
