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
// Holes: state.holes = [{ x, y, r, ro, age, freeze, maxR, ... }]. terrain.isWater / waterDepth read
// them (deep right to the edge, and only over thin ice), so the explorer plunges and swims, the
// shore beat treats the hole as a wall, and the bear and the penguins keep off it. A hole only
// breaks on thin ice and never spreads past it (maxR: the distance to its edge caps r and the
// broken ring round it). It's dark water inside a jagged rim of broken ice, plates tipped along
// the edge and a few flat grey shards afloat; it stays open OPEN_S, then skins over from the rim
// inward over FREEZE_S (ro shrinks to 0) into darker new ice, drawn for the run. widen(h, a)
// breaks a piece off its edge (a heave that fails without axes).
// Hooks: NAS.breakIce() (a hole at the explorer's feet, if it's thin ice), NAS.holes.
import { state } from '../state.js';
import { classAt, lumAt, WATER_LUM, mask } from './terrain.js';
import { fracturePatch } from './icecracks.js';
import { visibleRect } from '../camera.js';

const THIN = 3, TAU = Math.PI * 2, KY = 0.8;
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
const cells = new Map();        // key -> { s, t (last loaded), lv (crack level reached), str }
const key = (cx, cy) => cy * 2048 + cx;

const onThin = (x, y) => classAt(x, y) === THIN && lumAt(x, y) >= WATER_LUM;
export const isThin = (x, y) => onThin(x, y) && !holeAt(x, y);
// how far into the thin ice a point is (sampled, up to 18 px): its thickness, roughly
function depthIn(x, y, max = 18) {
  for (let d = 3; d <= max; d += 3) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      if (classAt(x + Math.cos(a) * d, y + Math.sin(a) * d * KY) !== THIN) return d - 3;
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
    const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL;
    c = { s: 0, t: state.time, lv: 0, str: (STRONG + (WEAK - STRONG) * smooth(2, 16, depthIn(x, y))) * (frozenHoleAt(x, y) ? REFROZEN : 1) };
    cells.set(k, c);
  }
  return c;
}
export function stressAt(x, y) {
  const c = cells.get(key(Math.floor(x / CELL), Math.floor(y / CELL)));
  return c ? c.s : 0;
}
// add `amount` (at the weakest ice) round (x, y), spread by the kernel and divided by strength
function deposit(x, y, amount) {
  const r2 = LOAD_R * LOAD_R, inv = 1 / (2 * SIGMA * SIGMA);
  const cx0 = Math.floor((x - LOAD_R) / CELL), cx1 = Math.floor((x + LOAD_R) / CELL);
  const cy0 = Math.floor((y - LOAD_R * KY) / CELL), cy1 = Math.floor((y + LOAD_R * KY) / CELL);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const px = (cx + 0.5) * CELL, py = (cy + 0.5) * CELL, dx = px - x, dy = (py - y) / KY, d2 = dx * dx + dy * dy;
    if (d2 > r2 || classAt(px, py) !== THIN) continue;
    const c = cell(cx, cy, true);
    c.s += amount * Math.exp(-d2 * inv) / c.str;
    c.t = state.time;
  }
}

let creakT = 0, snapT = 0, spell = false;
// Bear on the thin ice at (x, y) for dt: w = how heavily (1 = the explorer with a light pack), k =
// how hard they move (0 standing, 1 walking pace); canBeat: they could stop for the beat at the
// first crack (else the spell stays open for when they can). -> { s: stress under the feet,
// creak: a creak this frame, first: the first real crack of this spell, broke: it gave way (the
// hole is already there) }.
const res = { s: 0, first: false, broke: false, creak: false };
export function load(x, y, dt, w, k, canBeat = true) {
  res.s = 0; res.first = false; res.broke = false; res.creak = false;
  if (!isThin(x, y) || dt <= 0) { if (stressAt(x, y) < 0.15) spell = false; res.s = stressAt(x, y); return res; }
  deposit(x, y, w * (STAND + MOVE * k) * dt);
  return judge(x, y, canBeat, dt);
}
// A sudden load (landing on it from a fall): amount of stress at the weakest ice.
export function slam(x, y, amount) {
  res.s = 0; res.first = false; res.broke = false; res.creak = false;
  if (!isThin(x, y)) return res;
  deposit(x, y, amount);
  return judge(x, y, false, 0);
}
function judge(x, y, canBeat, dt) {
  const c = cell(Math.floor(x / CELL), Math.floor(y / CELL), true), s = c.s;
  res.s = s;
  if (s < 0.15) spell = false;
  creakT -= dt; snapT -= dt;
  // creaks, with a hairline flickering under the boots
  if (s >= CREAK && s < CRACK && creakT <= 0) {
    const q = (s - CREAK) / (CRACK - CREAK);
    creakT = (2.2 - 1.5 * q) * (0.7 + Math.random() * 0.6);
    state.events.push({ type: 'creak', x, y, strength: 0.35 + 0.5 * q });
    res.creak = true;
    addPatch(fracturePatch(x, y + 0.6, { n: 2, L: [4, 7 + 4 * q], from: 0.8, ring: 0 }, (Math.random() * 1e9) | 0, onThin), 0.55, 0.65);
  }
  // each level crossed under the feet once (per cell)
  while (c.lv < LEVELS.length && s >= LEVELS[c.lv]) {
    addPatch(fracturePatch(x, y + 0.6, FRACTURE[c.lv], (Math.random() * 1e9) | 0, onThin), 34 + 8 * c.lv + Math.random() * 8);
    state.events.push({ type: 'crack', x, y, strength: 0.6 + 0.13 * c.lv, stress: s });
    c.lv++;
    snapT = 0.6 + Math.random() * 0.6;
  }
  if (canBeat && !spell && s >= CRACK) { spell = true; res.first = true; }
  // between the levels, a single sharp fracture now and then
  if (s >= CRACK && snapT <= 0 && s < 1) {
    snapT = (1.5 - 1.1 * smooth(CRACK, 1, s)) * (0.6 + Math.random() * 0.8);
    state.events.push({ type: 'crack', x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 6, strength: 0.35 + 0.5 * smooth(CRACK, 1, s), stress: s });
    if (Math.random() < 0.5) addPatch(fracturePatch(x, y + 0.6, { n: 1, L: [10, 18], from: 2, ring: 0 }, (Math.random() * 1e9) | 0, onThin), 30);
  }
  if (s >= 1) { res.broke = !!breakAt(x, y); }
  return res;
}

// --- crack lines -----------------------------------------------------------------------------------
// life: seconds drawn at full strength (then a 12 s fade, or a quick one for a flicker); peak alpha
const patches = [];
function addPatch(p, life, peak = 1) {
  p.age = 0; p.life = life; p.peak = peak; p.fade = life < 2 ? 0.4 : 12;
  patches.push(p);
  if (patches.length > 18) patches.shift().c.width = 0;
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
// distance (ground plane) from (x, y) to the edge of the thin ice, sampled in 16 directions
function edgeDist(x, y, max = 14) {
  let best = max;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU, c = Math.cos(a), sn = Math.sin(a) * KY;
    for (let d = 1; d < best; d += 1) if (classAt(x + c * d, y + sn * d) !== THIN) { best = d; break; }
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
// A hole through the thin ice at (x, y) (null if it isn't thin ice there). Never wider than the
// thin ice round it.
export function breakAt(x, y) {
  if (!onThin(x, y) || holeAt(x, y)) return null;
  const maxR = edgeDist(x, y);
  const h = { x, y, r: Math.max(3.2, Math.min(5.2 + Math.random() * 0.8, maxR - 0.5)), ro: 0, age: 0, freeze: 0, t0: state.time, maxR, seed: 1 + ((Math.random() * 2e9) | 0) };
  h.ro = h.r;
  rimOf(h);
  holes.push(h);
  if (holes.length > 8) holes.shift();
  burst(x, y, 26, 8);
  addPatch(fracturePatch(x, y, { n: 6, L: [12, 22], from: h.r * 0.9, ring: h.r + 4 }, (Math.random() * 1e9) | 0, onThin), 50);
  // the ice round it lets go of the stress it held (still cracked: get off it)
  for (const [k, c] of cells) {
    const cx = (k % 2048 + 0.5) * CELL, cy = (Math.floor(k / 2048) + 0.5) * CELL;
    if (Math.hypot(cx - x, (cy - y) / KY) < 20) { c.s = Math.min(c.s, 0.32); c.lv = Math.min(c.lv, 1); }
  }
  state.events.push({ type: 'breakthrough', x, y, r: h.r });
  return h;
}
// A piece of the edge breaks off toward angle a (ground plane): the hole widens (never past the
// edge of the thin ice).
export function widen(h, a) {
  const R0 = h.r, cap = Math.min(10, edgeDist(h.x, h.y, 16) - 0.5);
  if (cap <= R0 + 0.3) { state.events.push({ type: 'crack', x: h.x, y: h.y, strength: 0.6, stress: 1 }); return; }
  h.r = Math.min(cap, h.r + 1.2 + Math.random() * 0.5);
  h.ro = h.r * (1 - h.freeze);
  h.x += Math.cos(a) * (h.r - R0) * 0.5; h.y += Math.sin(a) * (h.r - R0) * 0.5 * KY;
  h.maxR = edgeDist(h.x, h.y, 16);
  h.seed = (h.seed * 48271) % 2147483647;
  rimOf(h);
  const ex = h.x + Math.cos(a) * h.r, ey = h.y + Math.sin(a) * h.r * KY;
  burst(ex, ey, 10, 5);
  addPatch(fracturePatch(ex, ey, { n: 2, L: [8, 14], from: 0.5, ring: 0 }, (Math.random() * 1e9) | 0, onThin), 40);
  state.events.push({ type: 'crack', x: ex, y: ey, strength: 0.8, stress: 1 });
}

export function init() {
  state.breakIce = () => { const P = state.player; return breakAt(P.x, P.y); };
}

export function update(dt) {
  // unloaded cells ease back (backing off the way you came relieves it)
  const now = state.time;
  for (const [k, c] of cells) {
    if (now - c.t < EASE_AFTER) continue;
    c.s -= EASE * dt;
    if (c.s < 0.25 && c.lv > 0) c.lv = 0;
    if (c.s <= 0) cells.delete(k);
  }
  for (let i = patches.length - 1; i >= 0; i--) {
    const p = patches[i];
    p.age += dt;
    if (p.age > p.life + p.fade) { p.c.width = 0; patches.splice(i, 1); }
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
      ctx.globalAlpha = p.peak * Math.min(1, p.age / (p.life < 2 ? 0.08 : 0.2)) * clamp((p.life + p.fade - p.age) / p.fade);
      ctx.drawImage(p.c, p.x, p.y, p.w, p.h);
    }
    ctx.restore();
  }
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

export const _debug = { cells, patches, holes, shardsFly };
