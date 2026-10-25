// Terrain: what the painted map *means* underfoot, and how high it stands.
//
// DATA (all half resolution, 1232 x 928: 1 mask px = 2x2 world px)
//   assets/terrain.png        auto class map from tools/gen_terrain.py. RGB:
//                               R = class * 32, G = 255 where inked / textured (only
//                               textured rock + cliff draws over actors; edited rock does
//                               too), B = blurred map luminance (steps of 8)
//   assets/terrain-edits.png  optional hand edits, same size, RGBA: where A >= 128 the
//                               pixel's class is round(R / 32); elsewhere the auto class
//   localStorage[EDITS_KEY]   with ?edits in the URL: a PNG data URL in the same format
//                               as terrain-edits.png, applied on top of both
//   Class ids: 0 snow, 1 deep, 2 ice, 3 thin, 4 rock, 5 path, 6 cliff, 7 shadow.
//   rock + cliff are occluders (impassable, drawn over actors behind them); only cliff
//   is climbable; shadow is walkable shaded ground (behaves as snow).
//
// DERIVED here at load (and by rebuild() after edits), all from the final class map:
//   foot regions (4-connected walkable areas), climb links (vertical runs of mostly-
//   cliff pixels, <= 110 world px, walkable above and below), region heights (spawn
//   region = 0; climbing up a face adds its length in world px, the apparent vertical
//   lift in this oblique view), plateau flags, elevation, exposure, shelter grid.
//
// API
//   TERRAIN, CLASS_NAMES, terrainAt, classAt, isWalkable, speedFactor, lumAt
//   heightAt(x, y)          apparent lift (world px) of the ground; 0 = spawn level
//   sortKey(x, y)           y-sort key for anything standing at (x, y): y + heightAt for
//                           ground; on a face (climbing) the face's foot + 0.5
//   shelterAt, exposureAt, elevatedAt, regionAt, isPlateau, reachableOnFoot
//   findWalkable(x, y[, region])
//   climbRoute(x, y, dx, dy) -> { start, end, length, height, kind:'cliff', up, shade } | null
//   bestClimb(px, py, tapX, tapY) -> route + { walkTo } | null (walk to walkTo, then climb)
//   climbable(x, y)
//   isWater(x, y)           open water: thin-ice class darker than WATER_LUM (the painted
//                           sea and leads; frozen lakes are class ice and never water), and
//                           any hole broken through thin ice or a frozen lake (state.holes,
//                           thinice.js; only over the class it broke in)
//   waterDepth(x, y)        world px from the nearest shore (0 on land): near the edge is
//                           wading, further out is deep (explorer.js / body.js decide); a
//                           hole is deep right to its edge
//   mask(), rebuild(), EDITS_KEY   (for the editor / debug overlays)
//   ?terrain=<type> forces terrainAt() everywhere (animation testing)
import { state, MAP_W, MAP_H } from '../state.js';

export const TERRAIN = { SNOW: 'snow', DEEP: 'deep', ICE: 'ice', THIN: 'thin', ROCK: 'rock', PATH: 'path' };
export const CLASS_NAMES = ['snow', 'deep', 'ice', 'thin', 'rock', 'path', 'cliff', 'shadow'];
// What terrainAt() reports for each class (cliff counts as rock, shadow as snow).
const TERRAIN_OF = ['snow', 'deep', 'ice', 'thin', 'rock', 'path', 'rock', 'snow'];
export const C = { SNOW: 0, DEEP: 1, ICE: 2, THIN: 3, ROCK: 4, PATH: 5, CLIFF: 6, SHADOW: 7 };
const ROCK = 4, CLIFF = 6, ICE = 2;
export const CLASS_STEP = 32;
export const EDITS_KEY = 'naso.terrainEdits';

const SPEED = { snow: 1, deep: 0.45, ice: 1.15, thin: 0.9, path: 1.3, rock: 0 };
export const WATER_LUM = 176;         // thin-ice pixels darker than this are open water
export const WADE_DEPTH = 9;          // world px from land: the wading shelf; beyond is deep (explorer, lakes)
const THIN = 3;

export const MASK_SCALE = 2;          // world px per mask px
const SPAWN_X = 1360, SPAWN_Y = 1560;
let MW = 0, MH = 0;
let cls = null;                       // Uint8Array class id per mask px
let lum = null;                       // Uint8Array map luminance
let tex = null;                       // Uint8Array 1 = inked / textured (may occlude)
let occ = null;                       // Uint8Array 1 = rock or cliff
let expo = null, elev = null;         // Uint8Array
let region = null;                    // Int32Array foot region id (0 = occluder)
let regionH = null;                   // Float32Array height per region id
let regionReach = null;               // Uint8Array 1 = reachable from spawn (walk + climb)
let wdist = null;                     // Uint8Array open water: distance to shore (mask px, capped), 0 on land
let spawnRegion = 0;
let version = 0;                      // bumps on every rebuild (layers.js re-cuts pieces)
const CELL = 8;                       // coarse occluder grid for shelter rays (world px)
let CW = 0, CH = 0, coarse = null;

const forced = state.params.get('terrain');
let ready = false;

// --- loading ---------------------------------------------------------------------------
function loadImage(src) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function pixels(img, w, h) {
  let c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  c.width = c.height = 0; c = null; // let the canvas go
  return d;
}

function applyEdits(img) {
  if (!img) return 0;
  const d = pixels(img, MW, MH);
  let n = 0;
  for (let i = 0, j = 0; i < cls.length; i++, j += 4) {
    if (d[j + 3] >= 128) {
      cls[i] = Math.min(7, Math.round(d[j] / CLASS_STEP));
      if (cls[i] === ROCK || cls[i] === CLIFF) tex[i] = 1;   // hand-painted rock occludes
      n++;
    }
  }
  return n;
}

export async function init() {
  const img = await loadImage('assets/terrain.png');
  if (!img) { console.error('[terrain] could not load assets/terrain.png'); return; }
  MW = img.width; MH = img.height;
  const d = pixels(img, MW, MH);
  const n = MW * MH;
  cls = new Uint8Array(n); lum = new Uint8Array(n); tex = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    cls[i] = Math.min(7, Math.round(d[j] / CLASS_STEP));
    tex[i] = d[j + 1] >= 128 ? 1 : 0;
    lum[i] = d[j + 2] & 0xf8;
  }
  applyEdits(await loadImage('assets/terrain-edits.png'));
  if (state.params.has('edits')) {
    try {
      const url = localStorage.getItem(EDITS_KEY);
      if (url) applyEdits(await loadImage(url));
    } catch (e) { console.warn('[terrain] edits not applied:', e); }
  }
  rebuild();
}

/** Re-derive everything from the class map (call after editing mask().cls). */
export function rebuild() {
  const n = MW * MH;
  occ = new Uint8Array(n);
  for (let i = 0; i < n; i++) occ[i] = cls[i] === ROCK || cls[i] === CLIFF ? 1 : 0;
  labelRegions();
  deriveHeights();
  deriveElevation();
  deriveExposure();
  deriveCoarse();
  deriveWater();
  version++;
  ready = true;
}

// --- derivation ------------------------------------------------------------------------
// Open water and its distance from the shore: a two-pass chamfer distance (3 straight /
// 4 diagonal, /3 = mask px), capped at 255. The shore is land (anything not thin-ice class):
// floes and thin ice out in the sea don't make the water beside them shallow, so stepping
// off a floe can put you straight into deep water.
function deriveWater() {
  const n = MW * MH, D = new Uint16Array(n), BIG = 65535;
  for (let i = 0; i < n; i++) D[i] = cls[i] === THIN ? BIG : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? 0 : D[y * MW + x]);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x; if (!D[i]) continue;
    D[i] = Math.min(D[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = MH - 1; y >= 0; y--) for (let x = MW - 1; x >= 0; x--) {
    const i = y * MW + x; if (!D[i]) continue;
    D[i] = Math.min(D[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  wdist = new Uint8Array(n);
  for (let i = 0; i < n; i++) wdist[i] = cls[i] === THIN && lum[i] < WATER_LUM ? Math.max(1, Math.min(255, Math.round(D[i] / 3))) : 0;
}

function labelRegions() {
  const n = MW * MH;
  region = new Int32Array(n);
  const stack = new Int32Array(n);
  let id = 0;
  for (let s0 = 0; s0 < n; s0++) {
    if (region[s0] || occ[s0]) continue;
    id++;
    let sp = 0;
    stack[sp++] = s0; region[s0] = id;
    while (sp) {
      const p = stack[--sp], x = p % MW;
      if (x > 0 && !region[p - 1] && !occ[p - 1]) { region[p - 1] = id; stack[sp++] = p - 1; }
      if (x < MW - 1 && !region[p + 1] && !occ[p + 1]) { region[p + 1] = id; stack[sp++] = p + 1; }
      if (p >= MW && !region[p - MW] && !occ[p - MW]) { region[p - MW] = id; stack[sp++] = p - MW; }
      if (p < n - MW && !region[p + MW] && !occ[p + MW]) { region[p + MW] = id; stack[sp++] = p + MW; }
    }
  }
  regionH = new Float32Array(id + 1);
  regionReach = new Uint8Array(id + 1);
  const si = idx(SPAWN_X, SPAWN_Y);
  spawnRegion = si >= 0 ? region[si] : 0;
}

// Climb rules in mask px (keep in step with tools/gen_terrain.py).
const RUN_MAX = 55, RUN_LAND = 2;

/** Calls fn(x, y0, y1) for every vertical run of occluder in column x ([y0, y1)). */
function forRuns(fn) {
  for (let x = 0; x < MW; x++) {
    let y = 0;
    while (y < MH) {
      if (!occ[y * MW + x]) { y++; continue; }
      const y0 = y;
      while (y < MH && occ[y * MW + x]) y++;
      fn(x, y0, y);
    }
  }
}

function deriveHeights() {
  // Climb links between regions: { upper, lower, lengths[] }.
  const links = new Map();
  forRuns((x, y0, y1) => {
    if (y0 === 0 || y1 + RUN_LAND >= MH || y1 - y0 > RUN_MAX) return;
    let cl = 0;
    for (let y = y0; y < y1; y++) if (cls[y * MW + x] === CLIFF) cl++;
    if (cl * 2 < y1 - y0) return;
    for (let k = 0; k <= RUN_LAND; k++) if (occ[(y1 + k) * MW + x]) return;
    const up = region[(y0 - 1) * MW + x], lo = region[y1 * MW + x];
    if (!up || !lo || up === lo) return;
    const key = up * 1048576 + lo;
    let l = links.get(key);
    if (!l) links.set(key, l = { up, lo, lens: [] });
    l.lens.push((y1 - y0) * MASK_SCALE);
  });
  const adj = new Map();
  for (const l of links.values()) {
    l.lens.sort((a, b) => a - b);
    const h = l.lens[l.lens.length >> 1];       // median face length
    (adj.get(l.up) || adj.set(l.up, []).get(l.up)).push([l.lo, -h]);
    (adj.get(l.lo) || adj.set(l.lo, []).get(l.lo)).push([l.up, h]);
  }
  if (!spawnRegion) return;
  regionReach[spawnRegion] = 1;
  const q = [spawnRegion];
  while (q.length) {
    const r = q.shift();
    for (const [o, dh] of adj.get(r) || []) {
      if (regionReach[o]) continue;
      regionReach[o] = 1;
      regionH[o] = regionH[r] + dh;
      q.push(o);
    }
  }
}

function deriveElevation() {
  // Walkable with an occluder 2..15 mask px below: a plateau top or ledge.
  elev = new Uint8Array(MW * MH);
  for (let x = 0; x < MW; x++) {
    let next = 1e9; // y of the nearest occluder at or below
    for (let y = MH - 1; y >= 0; y--) {
      const i = y * MW + x;
      if (occ[i]) { next = y; continue; }
      const d = next - y;
      elev[i] = d >= 2 && d <= 15 ? 1 : 0;
    }
  }
}

function deriveExposure() {
  // Integral image of occluders; open = little rock within ~100 world px.
  const W1 = MW + 1, S = new Uint32Array(W1 * (MH + 1));
  for (let y = 0; y < MH; y++) {
    let row = 0;
    for (let x = 0; x < MW; x++) {
      row += occ[y * MW + x];
      S[(y + 1) * W1 + x + 1] = S[y * W1 + x + 1] + row;
    }
  }
  const R = 25;
  expo = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) {
    const ya = Math.max(0, y - R), yb = Math.min(MH, y + R + 1);
    for (let x = 0; x < MW; x++) {
      const xa = Math.max(0, x - R), xb = Math.min(MW, x + R + 1);
      const sum = S[yb * W1 + xb] - S[ya * W1 + xb] - S[yb * W1 + xa] + S[ya * W1 + xa];
      const near = sum / ((yb - ya) * (xb - xa));
      const i = y * MW + x;
      let e = 0.15 + 0.7 * Math.max(0, Math.min(1, 1 - near * 1.6));
      if (elev[i] || (region[i] && regionH[region[i]] > 4)) e += 0.35;
      if (cls[i] === ICE) e += 0.1;
      expo[i] = Math.round(Math.min(1, e) * 255);
    }
  }
}

function deriveCoarse() {
  const k = CELL / MASK_SCALE;
  CW = Math.ceil(MW / k); CH = Math.ceil(MH / k);
  coarse = new Uint8Array(CW * CH);
  const cnt = new Uint16Array(CW * CH);
  for (let y = 0; y < MH; y++) {
    const cy = (y / k) | 0;
    for (let x = 0; x < MW; x++) if (occ[y * MW + x]) cnt[cy * CW + ((x / k) | 0)]++;
  }
  for (let i = 0; i < cnt.length; i++) coarse[i] = Math.min(255, Math.round((cnt[i] / (k * k)) * 255));
}

// --- queries ---------------------------------------------------------------------------
function idx(x, y) {
  const mx = Math.floor(x / MASK_SCALE), my = Math.floor(y / MASK_SCALE);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return -1;
  return my * MW + mx;
}

/** Class id (0..7) at a world point; off-map is rock. Ignores ?terrain. */
export function classAt(x, y) {
  if (!ready) return 0;
  const i = idx(x, y);
  return i < 0 ? ROCK : cls[i];
}

export function terrainAt(x, y) {
  if (forced) return forced;
  return TERRAIN_OF[classAt(x, y)];
}

export function isWalkable(x, y) {
  if (!ready) return true;
  const i = idx(x, y);
  return i >= 0 && !occ[i];
}

export function speedFactor(type) {
  return SPEED[type] ?? 1;
}

export function isWater(x, y) {
  if (!ready) return false;
  const i = idx(x, y);
  return i >= 0 && (wdist[i] > 0 || ((cls[i] === THIN || cls[i] === ICE) && inHole(x, y, cls[i])));
}
export function waterDepth(x, y) {
  if (!ready) return 0;
  const i = idx(x, y);
  if (i < 0) return 0;
  return wdist[i] ? wdist[i] * MASK_SCALE : (cls[i] === THIN || cls[i] === ICE) && inHole(x, y, cls[i]) ? HOLE_DEPTH : 0;
}
// Holes broken through the ice (thinice.js keeps state.holes = [{ x, y, ro, cls, ... }], ro = the
// open radius on the ground plane, shrinking as it refreezes; cls the class it broke in, thin ice 3
// or a frozen lake 2). Open water, and deep at once: there's no shelf under the ice. Only ever over
// the class it broke in: a hole never spreads onto land (or from a lake onto thin ice).
// The list stays tiny (a handful a run), so a straight loop is cheap.
const HOLE_DEPTH = 24;
function inHole(x, y, c) {
  const hs = state.holes;
  if (!hs || !hs.length) return false;
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k];
    if (h.ro <= 0 || (h.cls || THIN) !== c) continue;     // refrozen: solid again
    const dx = x - h.x, dy = (y - h.y) / 0.8;
    if (dx * dx + dy * dy < h.ro * h.ro) return true;
  }
  return false;
}

export function lumAt(x, y) {
  if (!ready) return 240;
  const i = idx(x, y);
  return i < 0 ? 240 : lum[i];
}

export function regionAt(x, y) {
  if (!ready) return 0;
  const i = idx(x, y);
  return i < 0 ? 0 : region[i];
}

/** Climb-only ground: walkable, reachable by climbing, not on foot from the spawn. */
export function isPlateau(x, y) {
  const r = regionAt(x, y);
  return !!r && r !== spawnRegion && regionReach[r] === 1;
}

export function reachableOnFoot(x, y) {
  return ready ? regionAt(x, y) === spawnRegion && spawnRegion !== 0 : true;
}

/** Foot of the occluder run containing mask px (mx, my): first walkable row below. */
function footRow(mx, my) {
  let y = my;
  while (y < MH && occ[y * MW + mx]) y++;
  return y;
}

/** Apparent lift of the ground at (x, y) in world px; spawn level = 0. On a face it is
 *  the height of the ground at the face's foot. */
export function heightAt(x, y) {
  if (!ready) return 0;
  const i = idx(x, y);
  if (i < 0) return 0;
  if (!occ[i]) return regionH[region[i]];
  const mx = i % MW, fy = footRow(mx, (i / MW) | 0);
  return fy < MH ? regionH[region[fy * MW + mx]] : 0;
}

/** Y-sort key for anything standing at (x, y). Ground: y + heightAt. On a face (a
 *  climber): the face's foot y + its ground height + 0.5, so the climber draws in front
 *  of the face it is on. Occluder pieces use the same convention (layers.js). */
export function sortKey(x, y) {
  if (!ready) return y;
  const i = idx(x, y);
  if (i < 0) return y;
  if (!occ[i]) return y + regionH[region[i]];
  const mx = i % MW, fy = footRow(mx, (i / MW) | 0);
  if (fy >= MH) return MAP_H + 1;
  return fy * MASK_SCALE + regionH[region[fy * MW + mx]] + 0.5;
}

export function elevatedAt(x, y) {
  if (!ready) return false;
  const i = idx(x, y);
  return i >= 0 && elev[i] === 1;
}

export function exposureAt(x, y) {
  if (!ready) return 0.5;
  const i = idx(x, y);
  return i < 0 ? 1 : expo[i] / 255;
}

function rockFrac(x, y) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return 1; // off-map is rock, as in classAt
  return coarse[cy * CW + cx] / 255;
}

// Shelter: three short rays upwind (the wind blows TOWARD state.wind.angle). Rock close
// upwind shelters strongly. On a plateau top / ledge, rock to the south is our own
// cliff dropping away below, so it gives no shelter.
const SHELTER_REACH = 90, SHELTER_STEP = 6;
export function shelterAt(x, y) {
  if (!ready) return 0;
  if (!isWalkable(x, y)) return 1;
  const a = state.wind.angle + Math.PI;
  const high = elevatedAt(x, y);
  let total = 0;
  for (const off of [-0.3, 0, 0.3]) {
    const dx = Math.cos(a + off), dy = Math.sin(a + off);
    let s = 0, mass = 0;
    for (let d = SHELTER_STEP; d <= SHELTER_REACH; d += SHELTER_STEP) {
      if (high && dy * d > 2) break;
      const f = rockFrac(x + dx * d, y + dy * d);
      if (f > 0) {
        mass += f * SHELTER_STEP;
        s = Math.max(s, (1 - d / (SHELTER_REACH + SHELTER_STEP)) * Math.min(1, mass / 18));
      }
    }
    total += s * (off === 0 ? 0.5 : 0.25);
  }
  return Math.min(1, total * 1.15);
}

/** Nearest walkable point in the player's current foot region (or the spawn's), up to
 *  ~300 world px away. Pass `inRegion` to search a specific region. */
export function findWalkable(x, y, inRegion) {
  if (!ready) return { x, y };
  let want = inRegion;
  if (want === undefined) want = regionAt(state.player.x, state.player.y) || spawnRegion;
  const i0 = idx(x, y);
  if (i0 >= 0 && region[i0] === want) return { x, y };
  const mx = Math.floor(x / MASK_SCALE), my = Math.floor(y / MASK_SCALE);
  for (let r = 1; r <= 150; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      const step = Math.abs(dy) === r ? 1 : 2 * r;
      for (let dx = -r; dx <= r; dx += step) {
        const px = mx + dx, py = my + dy;
        if (px < 0 || py < 0 || px >= MW || py >= MH) continue;
        if (region[py * MW + px] !== want) continue;
        const dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = [px, py]; }
      }
    }
    if (best) return { x: (best[0] + 0.5) * MASK_SCALE, y: (best[1] + 0.5) * MASK_SCALE };
  }
  return { x: SPAWN_X, y: SPAWN_Y };
}

// --- climbing --------------------------------------------------------------------------
// Only cliff faces are climbable: the run crossed must be at least half cliff pixels.
// Climbs are near-vertical in the oblique view (north = up a south-facing face).
const CLIMB_MAX = 110;          // world px of face at most
const CLIMB_BASE_REACH = 8;     // the face must start within this distance
const CLIMB_MIN_DY = Math.cos((50 * Math.PI) / 180);
const CLIMB_LAND = 4;           // landing must stay walkable this far

export function climbRoute(x, y, dx, dy) {
  if (!ready || !isWalkable(x, y)) return null;
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  dx /= len; dy /= len;
  if (Math.abs(dy) < CLIMB_MIN_DY) return null;
  let d = 0, sx = x, sy = y;
  while (d <= CLIMB_BASE_REACH && isWalkable(x + dx * d, y + dy * d)) { sx = x + dx * d; sy = y + dy * d; d += 1; }
  if (d > CLIMB_BASE_REACH) return null;
  const r0 = d;
  let n = 0, nCliff = 0, lumSum = 0;
  for (; d <= r0 + CLIMB_MAX; d += 1) {
    const px = x + dx * d, py = y + dy * d;
    const i = idx(px, py);
    if (i < 0) return null;
    if (!occ[i]) {
      let ok = true;
      for (let k = 1; k <= CLIMB_LAND && ok; k++) ok = isWalkable(px + dx * k, py + dy * k);
      if (!ok) { n++; continue; }
      if (nCliff * 2 < n) return null;            // mostly rock: not a climbable face
      const length = d - r0;
      const dh = Math.abs(heightAt(px, py) - heightAt(sx, sy));
      return {
        start: { x: sx, y: sy }, end: { x: px, y: py }, length,
        height: dh > 0 ? dh : Math.round(length * Math.abs(dy)),
        kind: 'cliff', up: dy < 0, shade: Math.round(n ? lumSum / n : 255),
      };
    }
    n++;
    if (cls[i] === CLIFF) nCliff++;
    lumSum += lum[i];
  }
  return null;
}

function lineClear(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
  for (let k = 1; k < n; k++) if (!isWalkable(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n)) return false;
  return true;
}

// Fan of directions, vertical first, then alternating out to 40 degrees.
const FAN = [0, 10, -10, 20, -20, 30, -30, 40, -40].map(a => (a * Math.PI) / 180);

/** The best climb for a tap near a cliff. Tap above the player = climb up, below =
 *  climb down. Picks the point on the cliff foot (or lip, for climbing down) nearest the tap that the player can walk to, then the most
 *  vertical route from there. Returns the route plus walkTo (= route.start): walk there
 *  along the foot, then climb. */
export function bestClimb(px, py, tapX, tapY) {
  if (!ready) return null;
  const want = regionAt(px, py);
  if (!want) return null;
  const R = 32, MAX_FROM_PLAYER = 130;       // mask px around the tap; world px from player
  const wantUp = tapY < py;                  // tap above the player: climb up
  const tmx = Math.floor(tapX / MASK_SCALE), tmy = Math.floor(tapY / MASK_SCALE);
  const cands = [];
  for (let my = tmy - R; my <= tmy + R; my++) {
    if (my < 1 || my >= MH - 1) continue;
    for (let mx = tmx - R; mx <= tmx + R; mx++) {
      if (mx < 0 || mx >= MW) continue;
      const i = my * MW + mx;
      if (region[i] !== want) continue;
      const upC = cls[i - MW] === CLIFF, dnC = cls[i + MW] === CLIFF;
      if (!(wantUp ? upC : dnC)) continue;
      const wx = (mx + 0.5) * MASK_SCALE, wy = (my + 0.5) * MASK_SCALE;
      const dp = Math.hypot(wx - px, wy - py);
      if (dp > MAX_FROM_PLAYER) continue;
      const dt = Math.hypot(wx - tapX, wy - tapY);
      // Strongly prefer feet / lips the player can walk to in a straight line.
      cands.push([dt + 0.3 * dp + (lineClear(px, py, wx, wy) ? 0 : 150), wx, wy, upC, dnC]);
    }
  }
  cands.sort((a, b) => a[0] - b[0]);
  let tried = 0;
  for (const [, wx, wy, upC, dnC] of cands) {
    if (++tried > 60) break;
    const dir = wantUp ? -1 : 1, side = Math.sign(tapX - wx) || 1;
    for (const a of FAN) {
      const r = climbRoute(wx, wy, Math.sin(a * side), dir * Math.cos(a));
      if (r) return { ...r, walkTo: r.start };
    }
  }
  return null;
}

export function climbable(x, y) {
  for (const a of [0, 0.25, -0.25]) {
    if (climbRoute(x, y, Math.sin(a), -Math.cos(a)) || climbRoute(x, y, Math.sin(a), Math.cos(a))) return true;
  }
  return false;
}

/** Raw data for ground.js / layers.js / the editor. */
export function mask() {
  return ready ? { cls, lum, tex, occ, expo, elev, region, regionH, regionReach, spawnRegion, version, w: MW, h: MH, scale: MASK_SCALE } : null;
}
