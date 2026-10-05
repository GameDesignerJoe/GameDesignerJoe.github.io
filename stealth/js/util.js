// Small shared helpers: a seeded random, geometry, signed distances.
// Loaded as a plain script in the page and with require() in node (tools/).
(function (root) {
  'use strict';
  const U = {};

  // mulberry32: a fast seeded generator, so a floor's seed always builds the same floor
  U.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    const r = function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.weighted = (pairs) => {   // [[value, weight], ...]
      let tot = 0; for (const p of pairs) tot += p[1];
      let x = r() * tot;
      for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    };
    return r;
  };
  U.hash = function (a, b) {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16;
    return h >>> 0;
  };

  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  U.easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  U.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  U.turnTo = (a, b, max) => { const d = U.angDiff(a, b); return Math.abs(d) <= max ? b : a + Math.sign(d) * max; };
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  // ── shapes ───────────────────────────────────────────────
  // A shape is { k: 'c', x, y, r } or { k: 'p', pts: [{x, y}, ...] }.
  U.rect = function (cx, cy, w, h, ang) {
    const c = Math.cos(ang || 0), s = Math.sin(ang || 0), hw = w / 2, hh = h / 2;
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }));
    return U.poly(pts);
  };
  // a wall: a thick segment from a to b, square-ended, overhanging each end by ext
  U.seg = function (ax, ay, bx, by, thick, ext) {
    const len = Math.hypot(bx - ax, by - ay) || 1, ang = Math.atan2(by - ay, bx - ax);
    return U.rect((ax + bx) / 2, (ay + by) / 2, len + 2 * (ext || 0), thick, ang);
  };
  U.circle = (x, y, r) => ({ k: 'c', x, y, r });
  U.poly = function (pts) {
    // wind every polygon the way canvas winds arc(), so a nonzero fill of many shapes is their union
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    if (a < 0) pts = pts.slice().reverse();
    return { k: 'p', pts };
  };
  U.bbox = function (s) {
    if (s.k === 'c') return { x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of s.pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
    return { x0, y0, x1, y1 };
  };
  U.translate = function (s, dx, dy) {
    if (s.k === 'c') return { k: 'c', x: s.x + dx, y: s.y + dy, r: s.r };
    return { k: 'p', pts: s.pts.map(p => ({ x: p.x + dx, y: p.y + dy })) };
  };
  U.centroid = function (s) {
    if (s.k === 'c') return { x: s.x, y: s.y };
    let x = 0, y = 0; for (const p of s.pts) { x += p.x; y += p.y; }
    return { x: x / s.pts.length, y: y / s.pts.length };
  };

  // signed distance, negative inside
  U.sdPoly = function (px, py, v) {
    let d = (px - v[0].x) ** 2 + (py - v[0].y) ** 2, s = 1;
    for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
      const ex = v[j].x - v[i].x, ey = v[j].y - v[i].y, wx = px - v[i].x, wy = py - v[i].y;
      const h = U.clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
      const bx = wx - ex * h, by = wy - ey * h, dd = bx * bx + by * by;
      if (dd < d) d = dd;
      const c1 = py >= v[i].y, c2 = py < v[j].y, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  };
  U.sd = (s, x, y) => s.k === 'c' ? Math.hypot(x - s.x, y - s.y) - s.r : U.sdPoly(x, y, s.pts);
  U.inside = (s, x, y) => U.sd(s, x, y) < 0;

  // Andrew's monotone chain, for the sweep of a shape along the light
  U.hull = function (pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  };
  // the region a convex shape sweeps when slid by (dx, dy): its shadow
  U.sweep = function (s, dx, dy) {
    if (s.k === 'c') {
      const n = 20, pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push({ x: s.x + Math.cos(a) * s.r, y: s.y + Math.sin(a) * s.r }); }
      return U.hull(pts.concat(pts.map(p => ({ x: p.x + dx, y: p.y + dy }))));
    }
    return U.hull(s.pts.concat(s.pts.map(p => ({ x: p.x + dx, y: p.y + dy }))));
  };

  root.U = U;
  if (typeof module !== 'undefined') module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
