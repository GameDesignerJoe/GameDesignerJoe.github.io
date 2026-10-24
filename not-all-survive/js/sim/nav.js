// The sim's legs (js/sim/sim.js): a coarse grid over the map of where a body can walk, and a path
// planner over it that weighs the ground the way the explorer feels it (deep snow is slow and
// costly on foot, cheap carried; thin ice is to be kept off; open water and rock are walls). The
// planner only knows what anyone can see on the painted map: the ground's kinds, not where the
// lost explorer lies.
//
// build() fills the grid once the terrain is ready; findPath(x0, y0, x1, y1, cost, opts) returns
// { pts: [{ x, y }], len, cost } or null; lineShares() and pathShares() say how much of a line or a
// path is deep snow, ice, and so on (the carry-or-drag and snowshoe decisions read them).
import { MAP_W, MAP_H } from '../state.js';
import * as T from '../world/terrain.js';
import { campBlocked } from '../actors/camp.js';
import { pupBlocked } from '../actors/puptent.js';
import { BORDER } from '../world/frontier.js';

export const G = 6;                         // world px per cell
export const GW = Math.ceil(MAP_W / G), GH = Math.ceil(MAP_H / G);
export const TNAME = ['snow', 'deep', 'ice', 'thin', 'path'];
const TCODE = { snow: 0, deep: 1, ice: 2, thin: 3, path: 4 };
const N = GW * GH;
let block = null, ter = null, edge = null, ready = false;
const extra = new Map();                    // cell -> time it was marked blocked (open water met on the way)

const walk = (x, y) => { try { return T.isWalkable(x, y) !== false && !T.isWater(x, y); } catch { return true; } };
// the camp (tent, sled, skis) and a pitched pup tent: solid, though the ground under them is snow
const solid = (x, y) => { try { return campBlocked(x, y) || pupBlocked(x, y); } catch { return false; } };
const cellOf = (x, y) => [Math.floor(x / G), Math.floor(y / G)];
const centre = (i, j) => ({ x: (i + 0.5) * G, y: (j + 0.5) * G });
export const isReady = () => ready;

export function build() {
  if (!T.mask()) return false;
  block = new Uint8Array(N); ter = new Uint8Array(N); edge = new Uint8Array(N);
  const R = 3.2;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const k = j * GW + i, { x, y } = centre(i, j);
    let ok = walk(x, y) && !campBlocked(x, y);
    // clearance: the walk collision needs a body's width (the explorer's own planner keeps 4 clear)
    for (let a = 0; ok && a < 6; a++) {
      const qx = x + Math.cos(a * 1.047) * R, qy = y + Math.sin(a * 1.047) * R;
      if (!walk(qx, qy) || campBlocked(qx, qy)) ok = false;
    }
    block[k] = ok ? 0 : 1;
    ter[k] = TCODE[T.terrainAt(x, y)] ?? 0;
    edge[k] = x < BORDER.left || x > MAP_W - BORDER.right || y < BORDER.top || y > MAP_H - BORDER.bottom ? 1 : 0;
  }
  ready = true;
  return true;
}

// open water met on the way (a hole broken in the ice, a shore the grid missed): blocked for a while
export function markBlocked(x, y, r = 6, now = 0) {
  if (!ready) return;
  const [ci, cj] = cellOf(x, y), n = Math.ceil(r / G);
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
    const i = ci + di, j = cj + dj;
    if (i >= 0 && j >= 0 && i < GW && j < GH) extra.set(j * GW + i, now);
  }
}
function blocked(k, now) {
  if (block[k]) return true;
  if (!extra.size) return false;
  const t = extra.get(k);
  if (t === undefined) return false;
  if (now - t > 240) { extra.delete(k); return false; }
  return true;
}
function pupHere(k) { const { x, y } = centre(k % GW, (k / GW) | 0); try { return pupBlocked(x, y); } catch { return false; } }

export function terrainCode(x, y) { const [i, j] = cellOf(x, y); return i < 0 || j < 0 || i >= GW || j >= GH ? 0 : ter[j * GW + i]; }
export function freeAt(x, y, now = 0) { const [i, j] = cellOf(x, y); return i >= 0 && j >= 0 && i < GW && j < GH && !blocked(j * GW + i, now); }
export function inEdge(x, y) { const [i, j] = cellOf(x, y); return i < 0 || j < 0 || i >= GW || j >= GH || !!edge[j * GW + i]; }

// The nearest free cell to (x, y) within r cells, optionally only ones in the same foot region as
// (rx, ry). null if none.
export function nearestFree(x, y, r = 12, rx = null, ry = null, now = 0) {
  const [ci, cj] = cellOf(x, y);
  const reg = rx === null ? 0 : T.regionAt(rx, ry);
  for (let d = 0; d <= r; d++) {
    let best = null, bd = 1e9;
    for (let dj = -d; dj <= d; dj++) for (let di = -d; di <= d; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== d) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
      const k = j * GW + i;
      if (blocked(k, now)) continue;
      const c = centre(i, j);
      if (reg && T.regionAt(c.x, c.y) !== reg) continue;
      const dd = di * di + dj * dj;
      if (dd < bd) { bd = dd; best = c; }
    }
    if (best) return best;
  }
  return null;
}

// --- A* over the grid -----------------------------------------------------------------------------
// cost: per-px multipliers by terrain name ({ snow, deep, ice, thin, path }), plus edge (the frontier
// storm's band) and avoid: [{ x, y, r, k }] (places to give a wide berth: where the bear was seen).
const g = new Float32Array(N), from = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N);
let gen = 0;
let heapN = 0, heapK = new Int32Array(4096), heapF = new Float32Array(4096);
function push(k, f) {
  if (heapN >= heapK.length) { const a = new Int32Array(heapK.length * 2); a.set(heapK); heapK = a; const b = new Float32Array(heapF.length * 2); b.set(heapF); heapF = b; }
  let i = heapN++;
  while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= f) break; heapK[i] = heapK[p]; heapF[i] = heapF[p]; i = p; }
  heapK[i] = k; heapF[i] = f;
}
function pop() {
  const top = heapK[0], k = heapK[--heapN], f = heapF[heapN];
  let i = 0;
  for (;;) {
    let c = 2 * i + 1;
    if (c >= heapN) break;
    if (c + 1 < heapN && heapF[c + 1] < heapF[c]) c++;
    if (heapF[c] >= f) break;
    heapK[i] = heapK[c]; heapF[i] = heapF[c]; i = c;
  }
  heapK[i] = k; heapF[i] = f;
  return top;
}
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export function findPath(x0, y0, x1, y1, cost, opts = {}) {
  if (!ready) return null;
  const now = opts.now || 0;
  const s = nearestFree(x0, y0, 4, null, null, now), t = nearestFree(x1, y1, opts.goalR ?? 10, x0, y0, now);
  if (!s || !t) return null;
  const [si, sj] = cellOf(s.x, s.y), [ti, tj] = cellOf(t.x, t.y);
  const sk = sj * GW + si, tk = tj * GW + ti;
  const mult = TNAME.map(n => cost[n] ?? 1), minM = Math.min(...mult), edgeK = cost.edge ?? 3;
  const avoid = opts.avoid || [];
  const pen = opts.penalty || null;   // (i, j) -> extra weight on a cell (the sim's map memory: ground already walked)
  const pupNear = opts.pup || null;
  gen++; heapN = 0;
  g[sk] = 0; stamp[sk] = gen; from[sk] = sk;
  const W = opts.greed ?? 1.25;   // a little greedy: much quicker, near enough the best
  const h = k => { const i = k % GW, j = (k / GW) | 0, dx = Math.abs(i - ti), dy = Math.abs(j - tj); return (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)) * G * minM * W; };
  push(sk, h(sk));
  let found = -1, n = 0;
  const maxN = opts.maxNodes ?? 160000;
  while (heapN) {
    const k = pop();
    if (closed[k] === gen) continue;
    closed[k] = gen;
    if (k === tk) { found = k; break; }
    if (++n > maxN) break;
    const i = k % GW, j = (k / GW) | 0, gk = g[k];
    for (const [di, dj, dl] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const nk = nj * GW + ni;
      if (closed[nk] === gen || blocked(nk, now)) continue;
      if (di && dj && (blocked(j * GW + ni, now) || blocked(nj * GW + i, now))) continue;   // no cutting corners
      if (pupNear && Math.abs(ni * G - pupNear.x) < 24 && Math.abs(nj * G - pupNear.y) < 24 && pupHere(nk)) continue;
      let m = mult[ter[nk]];
      if (edge[nk]) m *= edgeK;
      if (pen) m *= pen(ni, nj);
      if (avoid.length) {
        const cx = (ni + 0.5) * G, cy = (nj + 0.5) * G;
        for (const a of avoid) { const d = Math.hypot(cx - a.x, cy - a.y); if (d < a.r) m *= 1 + (a.k - 1) * (1 - d / a.r); }
      }
      const ng = gk + dl * G * m;
      if (stamp[nk] === gen && ng >= g[nk]) continue;
      stamp[nk] = gen; g[nk] = ng; from[nk] = k;
      push(nk, ng + h(nk));
    }
  }
  if (found < 0) return null;
  const cells = [];
  for (let k = found; ; k = from[k]) { cells.push(k); if (k === sk) break; }
  cells.reverse();
  const pts = cells.map(k => centre(k % GW, (k / GW) | 0));
  pts[0] = { x: x0, y: y0 };
  // the true goal if it's free ground and right by the last cell
  if (Math.hypot(x1 - t.x, y1 - t.y) < G * 1.5 && walk(x1, y1)) pts.push({ x: x1, y: y1 });
  let len = 0;
  for (let q = 1; q < pts.length; q++) len += Math.hypot(pts[q].x - pts[q - 1].x, pts[q].y - pts[q - 1].y);
  return { pts, len, cost: g[found], end: pts[pts.length - 1] };
}

// How far on foot (world px along the grid) every cell is from (x0, y0), never through the frontier storm's
// band: Float32Array, Infinity where it can't be walked to. goal/distress.js checks a site with it, so the game
// never hides the lost explorer where the sim (or a player) can't walk.
export function walkDistances(x0, y0) {
  if (!ready && !build()) return null;
  const s = nearestFree(x0, y0, 6);
  if (!s) return null;
  const dist = new Float32Array(N).fill(Infinity);
  const [si, sj] = cellOf(s.x, s.y), sk = sj * GW + si;
  gen++; heapN = 0; dist[sk] = 0; push(sk, 0);
  while (heapN) {
    const k = pop();
    if (closed[k] === gen) continue;
    closed[k] = gen;
    const i = k % GW, j = (k / GW) | 0, dk = dist[k];
    for (const [di, dj, dl] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const nk = nj * GW + ni;
      if (block[nk] || edge[nk] || closed[nk] === gen) continue;
      if (di && dj && (block[j * GW + ni] || block[nj * GW + i])) continue;
      const nd = dk + dl * G;
      if (nd < dist[nk]) { dist[nk] = nd; push(nk, nd); }
    }
  }
  return dist;
}
export function distAt(dist, x, y) { const [i, j] = cellOf(x, y); return !dist || i < 0 || j < 0 || i >= GW || j >= GH ? Infinity : dist[j * GW + i]; }

// Is the straight line from a to b clear to walk (sampled finely against the real terrain, a body's
// width either side)?
export function clearLine(x0, y0, x1, y1, now = 0) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 2);
  if (!n) return true;
  const px = -(y1 - y0) / d * 2, py = (x1 - x0) / d * 2;
  for (let k = 1; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    if (!walk(x, y) || !walk(x + px, y + py) || !walk(x - px, y - py)) return false;
    if (solid(x, y) || solid(x + px, y + py) || solid(x - px, y - py)) return false;
    if (extra.size && !freeAt(x, y, now)) return false;
  }
  return true;
}

// Shares of each terrain along a straight line (sampled on the real terrain), and blocked (rock,
// water) as 'wall'.
export function lineShares(x0, y0, x1, y1) {
  const out = { snow: 0, deep: 0, ice: 0, thin: 0, path: 0, wall: 0, len: Math.hypot(x1 - x0, y1 - y0) };
  const n = Math.max(1, Math.ceil(out.len / 4));
  for (let k = 0; k < n; k++) {
    const x = x0 + (x1 - x0) * (k + 0.5) / n, y = y0 + (y1 - y0) * (k + 0.5) / n;
    if (!walk(x, y)) { out.wall++; continue; }
    out[T.terrainAt(x, y)] = (out[T.terrainAt(x, y)] || 0) + 1;
  }
  for (const k of ['snow', 'deep', 'ice', 'thin', 'path', 'wall']) out[k] /= n;
  return out;
}
// The same along a path's points, from index i0 for up to `ahead` px (or the whole of it).
export function pathShares(pts, i0 = 0, ahead = Infinity, from = null) {
  const out = { snow: 0, deep: 0, ice: 0, thin: 0, path: 0, len: 0 };
  let a = from || pts[i0], left = ahead;
  for (let q = i0; q < pts.length && left > 0; q++) {
    const b = pts[q], d = Math.min(left, Math.hypot(b.x - a.x, b.y - a.y));
    if (d > 0.01) {
      const n = Math.max(1, Math.ceil(d / 4)), L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n * d / L, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
        const t = TNAME[terrainCode(x, y)];
        out[t] += d / n;
      }
      out.len += d; left -= d;
    }
    a = b;
  }
  if (out.len > 0) for (const k of TNAME) out[k] /= out.len;
  return out;
}
