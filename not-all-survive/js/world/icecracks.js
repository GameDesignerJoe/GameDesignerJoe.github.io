// White hairline crack networks on the frozen lakes (after Joe's ref/ice_cracks.png):
// straight segments with sharp kinks, Y- and T-junctions forming an irregular cell
// network (cells ~6-20 world px), not every cell closed, small offshoots, line ends
// stopping short. Near-white lines ~0.35 world px with a faint darker hairline on the
// shadow side.
//
// Two kinds, both cached as small bitmaps (4 px per world unit) and blitted:
//   static  - a patch on some 64 px tiles well inside a lake (toward lake centres);
//   dynamic - every 8-15 s while ice is on screen a new patch fades in over 1.5 s near
//             the explorer (if on ice) or a lake centre in view, and fades out 40-60 s on.
import { state } from '../state.js';
import { classAt } from './terrain.js';

const ICE = 2, TAU = Math.PI * 2;
const PX = 4;                      // bitmap px per world unit
const TILE = 64;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How far inside the ice a point is: smallest distance (sampled) to non-ice, up to max.
export function iceDepth(x, y, max = 40) {
  if (classAt(x, y) !== ICE) return 0;
  for (let d = 4; d <= max; d += 4) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      if (classAt(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8) !== ICE) return d;
    }
  }
  return max;
}

// Build a Voronoi crack network in a patch centred at (cx, cy), radius R (world px).
// Seeds: Poisson-disc in a squashed (y * 0.8) space; each cell is the bounding box
// clipped by the bisector half-planes of nearby seeds; shared edges are deduplicated by
// their (rounded) endpoints, so junctions stay connected and lines never cross.
const SQ = 0.8;
// opt.sp: cell spacing (default 10-16 px); opt.on(x, y): where a crack may run (default: lake ice)
function network(cx, cy, R, r, opt = {}) {
  const sp = opt.sp ?? 10 + r() * 6;
  const on = opt.on ?? ((x, y) => classAt(x, y) === ICE);
  // Poisson-disc by dart throwing (small patches: fine).
  const seeds = [];
  const box = R * 1.25;
  for (let tries = 0; tries < 900 && seeds.length < 160; tries++) {
    const x = (r() * 2 - 1) * box, y = (r() * 2 - 1) * box;
    let ok = true;
    for (const q of seeds) if ((q[0] - x) ** 2 + (q[1] - y) ** 2 < sp * sp) { ok = false; break; }
    if (ok) seeds.push([x, y]);
  }
  // Soft irregular patch mask: radius wobbles with angle.
  const wob = [r(), r(), r(), r(), r(), r()].map(v => v * TAU);
  const rim = (x, y) => {
    const a = Math.atan2(y, x);
    const rr = R * (0.8 + 0.12 * Math.sin(3 * a + wob[0]) + 0.08 * Math.sin(5 * a + wob[1]));
    return Math.hypot(x, y) / rr;          // < 1 inside
  };
  const edges = new Map();
  const K = v => Math.round(v * 4);
  for (let i = 0; i < seeds.length; i++) {
    const [sx, sy] = seeds[i];
    if (rim(sx, sy) > 1.15) continue;
    let poly = [[sx - box, sy - box], [sx + box, sy - box], [sx + box, sy + box], [sx - box, sy + box]];
    for (let j = 0; j < seeds.length && poly.length; j++) {
      if (j === i) continue;
      const [tx, ty] = seeds[j];
      const dx = tx - sx, dy = ty - sy, d2 = dx * dx + dy * dy;
      if (d2 > (sp * 4) ** 2) continue;
      const mx = (sx + tx) / 2, my = (sy + ty) / 2;
      const side = p => (p[0] - mx) * dx + (p[1] - my) * dy;   // <= 0 keeps (toward s)
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const P = poly[k], Q = poly[(k + 1) % poly.length], a = side(P), b = side(Q);
        if (a <= 0) out.push(P);
        if ((a < 0) !== (b < 0)) { const t = a / (a - b); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
      }
      poly = out;
    }
    for (let k = 0; k < poly.length; k++) {
      const P = poly[k], Q = poly[(k + 1) % poly.length];
      if (Math.hypot(Q[0] - P[0], Q[1] - P[1]) < 0.8) continue;
      const k1 = K(P[0]) + ',' + K(P[1]), k2 = K(Q[0]) + ',' + K(Q[1]);
      const key = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      if (!edges.has(key)) edges.set(key, [P, Q]);
    }
  }
  const segs = [];
  const W = (x, y) => [cx + x, cy + y * SQ];          // patch space -> world
  for (const [P, Q] of edges.values()) {
    const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
    const rd = rim(mx, my);
    if (rd > 1) continue;
    if (r() < 0.15 + Math.max(0, rd - 0.65) * 1.6) continue;     // open cells, soft rim
    const [ax, ay] = W(P[0], P[1]), [bx, by] = W(Q[0], Q[1]);
    if (!on(ax, ay) || !on(bx, by) || !on((ax + bx) / 2, (ay + by) / 2)) continue;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const n = 2 + ((r() * 3) | 0), line = [ax, ay];
    for (let k = 1; k < n; k++) {
      const u = k / n, off = (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6) * Math.min(1, L / 8);
      line.push(ax + dx * u + nx * off, ay + dy * u + ny * off);
    }
    line.push(bx, by);
    segs.push({ line, w: 0.85 + r() * 0.3 });
    if (r() < 0.2) {
      if (r() < 0.6) {            // parallel split for part of the length
        const o = (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.4), u0 = 0.15 + r() * 0.3, u1 = u0 + 0.25 + r() * 0.3;
        segs.push({ line: [ax + dx * u0 + nx * o, ay + dy * u0 + ny * o, ax + dx * u1 + nx * o, ay + dy * u1 + ny * o], w: 0.6 });
      } else {                    // short spur off a vertex
        const a2 = Math.atan2(dy, dx) + (r() < 0.5 ? 1 : -1) * (0.8 + r() * 0.8), l2 = 1.5 + r() * 3;
        segs.push({ line: [ax, ay, ax + Math.cos(a2) * l2, ay + Math.sin(a2) * l2 * SQ], w: 0.6 });
      }
    }
  }
  return segs;
}

// ink: a thin dark underside under every white line (offset to the lower right, light from the
// upper left), so the cracks still read white against pale thin ice (Joe: cracks are white)
function render(segs, x0, y0, w, h, ink = false, inkA = 0.8) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * PX); c.height = Math.ceil(h * PX);
  const g = c.getContext('2d');
  g.setTransform(PX, 0, 0, PX, -x0 * PX, -y0 * PX);
  g.lineJoin = 'miter'; g.lineCap = 'round';
  const stroke = (dx, dy, color, scale) => {
    g.strokeStyle = color;
    for (const s of segs) {
      g.lineWidth = 0.38 * s.w * scale;
      g.beginPath();
      g.moveTo(s.line[0] + dx, s.line[1] + dy);
      for (let i = 2; i < s.line.length; i += 2) g.lineTo(s.line[i] + dx, s.line[i + 1] + dy);
      g.stroke();
    }
  };
  if (ink) stroke(0.12, 0.26, `rgba(36,38,42,${inkA})`, 1.45);   // the inked underside
  else stroke(0, 0.35, 'rgba(150,156,162,0.35)', 0.8);        // faint shadow-side hairline
  stroke(0, 0, 'rgba(246,248,250,0.97)', 1);                   // the white crack
  return c;
}

// --- fractures in thin ice under a weight (thinice.js) ---------------------------------------
// Not a nest: a few long, decisive fractures shooting out from round the feet, straight runs with
// a sharp kink now and then and the odd split; with opt.ring, short cross-cracks joining the
// spokes at about that radius (the ice breaking round, the last warning). White with an ink
// underside. opt = { n spokes, L: [min, max] length, from: start radius, ring: radius or 0, inkA:
// the underside's alpha (default 0.8; lighter on a frozen lake's paler ice, so they read white) }.
// on(x, y): where a crack may run (it stops at the edge of the thin ice). -> { c, x, y, w, h }
export function fracturePatch(cx, cy, opt, seed, on) {
  const r = rng(seed >>> 0), segs = [], spokes = [];
  const n = opt.n, a0 = r() * TAU;
  let x0 = cx, y0 = cy, x1 = cx, y1 = cy;
  const grow = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * TAU + (r() - 0.5) * (TAU / n) * 0.7;
    const L = opt.L[0] + (opt.L[1] - opt.L[0]) * r();
    const pts = [], line = [];
    let d = opt.from ?? 1.5, dir = a;
    let x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * SQ;
    line.push(x, y); pts.push([x, y, d]);
    // a sharp kink or two along it (never dead straight), at random points
    const k1 = (opt.from ?? 1.5) + L * (0.25 + 0.3 * r()), k2 = r() < 0.5 ? L * (0.6 + 0.25 * r()) : Infinity;
    let kinked = 0;
    while (d < L) {
      const st = Math.min(2 + r() * 2, L / 3);
      d += st; dir += (r() - 0.5) * 0.14;
      if (kinked === 0 && d >= k1) { dir += (r() < 0.5 ? 1 : -1) * (0.35 + 0.4 * r()); kinked = 1; }
      else if (kinked === 1 && d >= k2) { dir += (r() < 0.5 ? 1 : -1) * (0.3 + 0.3 * r()); kinked = 2; }
      x += Math.cos(dir) * st; y += Math.sin(dir) * st * SQ;
      if (on && !on(x, y)) break;
      line.push(x, y); pts.push([x, y, d]); grow(x, y);
    }
    if (line.length < 4) continue;
    // tapered: the outer part of it drawn finer, the last stretch finer still
    const np = line.length / 2, c1 = Math.max(2, Math.round(np * 0.55)), c2 = Math.max(c1 + 1, Math.round(np * 0.82));
    segs.push({ line: line.slice(0, c1 * 2), w: 1.25 });
    if (c1 < np) segs.push({ line: line.slice((c1 - 1) * 2, Math.min(np, c2) * 2), w: 0.85 });
    if (c2 < np) segs.push({ line: line.slice((c2 - 1) * 2), w: 0.5 });
    spokes.push({ a, pts });
    if (pts.length > 4 && r() < 0.5) {       // a split part way out
      const q = pts[2 + ((r() * (pts.length - 3)) | 0)], b = dir + (r() < 0.5 ? 1 : -1) * (0.35 + r() * 0.4), l2 = L * (0.25 + r() * 0.2);
      const ln = [q[0], q[1]];
      let bx = q[0], by = q[1], bd = 0, bdir = b;
      while (bd < l2) { const st = 2 + r() * 2; bd += st; bdir += (r() - 0.5) * 0.15; bx += Math.cos(bdir) * st; by += Math.sin(bdir) * st * SQ; if (on && !on(bx, by)) break; ln.push(bx, by); grow(bx, by); }
      if (ln.length >= 4) segs.push({ line: ln, w: 0.85 });
    }
  }
  if (opt.ring && spokes.length > 1) {
    spokes.sort((p, q) => p.a - q.a);
    for (let k = 0; k < spokes.length; k++) {
      const A = spokes[k], B = spokes[(k + 1) % spokes.length];
      const pa = A.pts.find(p => p[2] >= opt.ring * (0.8 + 0.4 * r())) || A.pts[A.pts.length - 1];
      const pb = B.pts.find(p => p[2] >= opt.ring * (0.8 + 0.4 * r())) || B.pts[B.pts.length - 1];
      if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > opt.ring * 2.2) continue;
      const mx = (pa[0] + pb[0]) / 2 + (r() - 0.5) * 1.5, my = (pa[1] + pb[1]) / 2 + (r() - 0.5) * 1.2;
      segs.push({ line: [pa[0], pa[1], mx, my, pb[0], pb[1]], w: 0.8 });
    }
  }
  const x = x0 - 3, y = y0 - 3, w = x1 - x0 + 6, h = y1 - y0 + 6;
  return { c: render(segs, x, y, w, h, true, opt.inkA ?? 0.8), x, y, w, h };
}

// --- static patches per tile ------------------------------------------------------------
const tiles = new Map();   // key -> { c, x, y, w, h } (LRU, capped)
const empty = new Set();   // tiles known to have no patch (cheap, never evicted)
const TILE_CAP = 96;       // bitmaps kept; a 2560 px view needs ~70 tiles
function tilePatch(tx, ty) {
  const k = ty * 4096 + tx;
  if (empty.has(k)) return null;
  if (tiles.has(k)) { const v = tiles.get(k); tiles.delete(k); tiles.set(k, v); return v; }
  const r = rng((tx * 92837111) ^ (ty * 689287499) ^ 0x1ce);
  let out = null;
  // The deepest-in-the-ice of a few sample points in the tile.
  let cx = 0, cy = 0, best = -1;
  for (let k = 0; k < 9; k++) {
    const x = tx * TILE + 8 + (k % 3) * 24 + (r() - 0.5) * 10, y = ty * TILE + 8 + ((k / 3) | 0) * 24 + (r() - 0.5) * 10;
    const d = iceDepth(x, y, 28);
    if (d > best) { best = d; cx = x; cy = y; }
  }
  // Only well inside a lake, and only some tiles: patches, not a carpet.
  if (r() < 0.6 && best >= 12) {
    const R = 24 + best * 0.8 + r() * 12;
    const segs = network(cx, cy, R, r);
    if (segs.length > 6) {
      const x = cx - R - 4, y = cy - R * 0.75 - 4, w = 2 * R + 8, h = 1.5 * R + 8;
      out = { c: render(segs, x, y, w, h), x, y, w, h };
    }
  }
  if (!out) { empty.add(k); return null; }
  tiles.set(k, out);
  if (tiles.size > TILE_CAP) {
    const [k0, v0] = tiles.entries().next().value;
    v0.c.width = 0;
    tiles.delete(k0);
  }
  return out;
}

// --- dynamic patches ----------------------------------------------------------------------
const live = [];
let timer = 3;
function spawn(r) {
  const P = state.player;
  const cands = [];
  if (classAt(P.x, P.y) === ICE) cands.push([P.x + (Math.random() - 0.5) * 50, P.y + (Math.random() - 0.5) * 36]);
  for (let k = 0; k < 14; k++) cands.push([r.x0 + Math.random() * (r.x1 - r.x0), r.y0 + Math.random() * (r.y1 - r.y0)]);
  let best = null, bd = 0;
  for (const [x, y] of cands) {
    const d = iceDepth(x, y, 32);
    if (d > bd) { bd = d; best = [x, y]; }
    if (d >= 24 && cands[0] && x === cands[0][0]) break;   // near the explorer is good enough
  }
  if (!best || bd < 12) return;
  const R = 14 + Math.random() * 14;
  const segs = network(best[0], best[1], R, rng((Math.random() * 1e9) | 0));
  if (segs.length < 4) return;
  const x = best[0] - R - 4, y = best[1] - R * 0.75 - 4, w = 2 * R + 8, h = 1.5 * R + 8;
  live.push({ c: render(segs, x, y, w, h), x, y, w, h, age: 0, life: 40 + Math.random() * 20 });
  if (live.length > 5) live.shift().c.width = 0;
}

export function drawIceCracks(ctx, r, dt, iceInView) {
  timer -= dt;
  if (timer <= 0) { timer = 8 + Math.random() * 7; if (iceInView) spawn(r); }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (iceInView) {
    const tx0 = Math.floor(r.x0 / TILE), ty0 = Math.floor(r.y0 / TILE), tx1 = Math.floor(r.x1 / TILE), ty1 = Math.floor(r.y1 / TILE);
    for (let ty = Math.max(0, ty0 - 1); ty <= ty1 + 1; ty++) for (let tx = Math.max(0, tx0 - 1); tx <= tx1 + 1; tx++) {
      const p = tilePatch(tx, ty);
      if (p && p.x < r.x1 && p.y < r.y1 && p.x + p.w > r.x0 && p.y + p.h > r.y0) ctx.drawImage(p.c, p.x, p.y, p.w, p.h);
    }
  }
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i];
    p.age += dt;
    if (p.age > p.life + 4) { p.c.width = 0; live.splice(i, 1); continue; }
    const a = Math.min(1, p.age / 1.5) * Math.max(0, Math.min(1, (p.life + 4 - p.age) / 4));
    if (p.x > r.x1 || p.y > r.y1 || p.x + p.w < r.x0 || p.y + p.h < r.y0) continue;
    ctx.globalAlpha = a;
    ctx.drawImage(p.c, p.x, p.y, p.w, p.h);
  }
  ctx.restore();
}
