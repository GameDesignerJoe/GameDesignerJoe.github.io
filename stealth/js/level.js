// Floors: generation, the distance field everything collides and sees against, and the nav grid
// guards path on. A floor is one building — a disc, a crescent wing or a nautilus — cut by thick
// walls into zones, with a route of doors from the stairs you came up to the stairs going on and
// a zone or two off it. Each zone is split again by closets, wedges, rings and colonnades.
// Same seed, same floor.
(function (root) {
  'use strict';
  const U = root.U || require('./util.js');
  const TAU = Math.PI * 2;

  // ── the distance field ─────────────────────────────────────
  // Signed distance to the nearest thing you can't walk through, sampled every G units and read
  // back bilinearly. Positive in the open. Collision pushes out along its gradient; sight lines
  // sphere-trace through it.
  const G = 3, CAP = 64;
  function Field(L) {
    const b = L.bounds;
    this.x0 = b.x0; this.y0 = b.y0;
    this.W = Math.ceil((b.x1 - b.x0) / G) + 2; this.H = Math.ceil((b.y1 - b.y0) / G) + 2;
    const n = this.W * this.H;
    const A = new Float32Array(n).fill(-CAP), B = new Float32Array(n).fill(CAP);
    for (const s of L.floor) this._stamp(A, s, (v, o) => (-v > o ? -v : o));
    for (const s of L.obs) this._stamp(B, s, (v, o) => (v < o ? v : o));
    this.base = new Float32Array(n);
    for (let i = 0; i < n; i++) this.base[i] = A[i] < B[i] ? A[i] : B[i];
    this.F = new Float32Array(this.base);
    this.doors = L.doors;
  }
  Field.prototype._stamp = function (arr, s, fn) {
    const bb = U.bbox(s), W = this.W, H = this.H;
    const i0 = Math.max(0, Math.floor((bb.x0 - CAP - this.x0) / G)), i1 = Math.min(W - 1, Math.ceil((bb.x1 + CAP - this.x0) / G));
    const j0 = Math.max(0, Math.floor((bb.y0 - CAP - this.y0) / G)), j1 = Math.min(H - 1, Math.ceil((bb.y1 + CAP - this.y0) / G));
    for (let j = j0; j <= j1; j++) {
      const y = this.y0 + j * G;
      for (let i = i0; i <= i1; i++) {
        const k = j * W + i;
        arr[k] = fn(U.sd(s, this.x0 + i * G, y), arr[k]);
      }
    }
  };
  // closed doors are walls; call again whenever one opens
  Field.prototype.applyDoors = function () {
    this.F.set(this.base);
    for (const d of this.doors) if (!d.open) this._stamp(this.F, d.shape, (v, o) => (v < o ? v : o));
  };
  Field.prototype.sample = function (x, y) {
    let fx = (x - this.x0) / G, fy = (y - this.y0) / G;
    if (fx < 0 || fy < 0 || fx >= this.W - 1 || fy >= this.H - 1) return -CAP;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * this.W + i, F = this.F;
    const a = F[k] + (F[k + 1] - F[k]) * tx, c = F[k + this.W] + (F[k + this.W + 1] - F[k + this.W]) * tx;
    return a + (c - a) * ty;
  };
  Field.prototype.grad = function (x, y) {
    const h = 1.2;
    const gx = this.sample(x + h, y) - this.sample(x - h, y), gy = this.sample(x, y + h) - this.sample(x, y - h);
    const l = Math.hypot(gx, gy) || 1;
    return { x: gx / l, y: gy / l };
  };
  // how far a ray gets before it meets a wall (capped at maxLen)
  Field.prototype.ray = function (x, y, dx, dy, maxLen) {
    let t = 0;
    for (let k = 0; k < 140; k++) {
      const s = this.sample(x + dx * t, y + dy * t);
      if (s < 0.35) return t;
      if (t >= maxLen) return maxLen;
      t += s > 0.7 ? s * 0.98 : 0.7;
    }
    return Math.min(t, maxLen);
  };
  // a circle of radius r slid from a to b without touching anything
  Field.prototype.clear = function (ax, ay, bx, by, r) {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 4));
    for (let i = 0; i <= n; i++) { const t = i / n; if (this.sample(ax + (bx - ax) * t, ay + (by - ay) * t) < r) return false; }
    return true;
  };
  // move a circle by (dx, dy), sliding along whatever it meets
  Field.prototype.move = function (p, dx, dy, r) {
    const len = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(len / 3));
    for (let s = 0; s < n; s++) {
      p.x += dx / n; p.y += dy / n;
      for (let it = 0; it < 4; it++) {
        const d = this.sample(p.x, p.y);
        if (d >= r) break;
        const g = this.grad(p.x, p.y);
        p.x += g.x * (r - d + 0.05); p.y += g.y * (r - d + 0.05);
      }
    }
  };
  Field.prototype.nearestFree = function (x, y, clear, maxR) {
    if (this.sample(x, y) >= clear) return { x, y };
    for (let rad = 5; rad <= (maxR || 120); rad += 5) {
      const n = Math.max(8, Math.round(rad / 3));
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (this.sample(px, py) >= clear) return { x: px, y: py };
      }
    }
    return null;
  };

  // ── the nav grid ───────────────────────────────────────────
  function Nav(field, clearance) {
    const C = this.C = 12;
    this.f = field; this.r = clearance;
    this.x0 = field.x0; this.y0 = field.y0;
    this.W = Math.ceil(field.W * G / C); this.H = Math.ceil(field.H * G / C);
    const n = this.W * this.H;
    this.walk = new Uint8Array(n);
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      this.walk[j * this.W + i] = field.sample(this.x0 + (i + 0.5) * C, this.y0 + (j + 0.5) * C) > clearance ? 1 : 0;
    }
    this.g = new Float32Array(n); this.from = new Int32Array(n); this.seen = new Uint32Array(n); this.stamp = 0;
    this.heap = new Int32Array(n); this.hf = new Float32Array(n);
  }
  Nav.prototype.cell = function (x, y) {
    const i = Math.floor((x - this.x0) / this.C), j = Math.floor((y - this.y0) / this.C);
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    return j * this.W + i;
  };
  Nav.prototype.near = function (x, y) {
    const k = this.cell(x, y);
    if (k >= 0 && this.walk[k]) return k;
    const ci = Math.floor((x - this.x0) / this.C), cj = Math.floor((y - this.y0) / this.C);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= 5 && best < 0; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= this.W || j >= this.H || !this.walk[j * this.W + i]) continue;
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = j * this.W + i; }
    }
    return best;
  };
  Nav.prototype.center = function (k) { return { x: this.x0 + (k % this.W + 0.5) * this.C, y: this.y0 + (Math.floor(k / this.W) + 0.5) * this.C }; };
  // A* on the grid, then pulled taut. Returns world points ending at (bx, by), or null.
  Nav.prototype.path = function (ax, ay, bx, by, maxNodes) {
    const s = this.near(ax, ay), e = this.near(bx, by);
    if (s < 0 || e < 0) return null;
    if (s === e || this.f.clear(ax, ay, bx, by, this.r - 1)) return [{ x: bx, y: by }];
    const W = this.W, walk = this.walk, g = this.g, from = this.from, seen = this.seen, heap = this.heap, hf = this.hf;
    const st = ++this.stamp, ex = e % W, ey = Math.floor(e / W);
    let hn = 0;
    const push = (k, f) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; heap[i] = heap[p]; hf[i] = hf[p]; i = p; } heap[i] = k; hf[i] = f; };
    const pop = () => {
      const top = heap[0], lk = heap[--hn], lf = hf[hn]; let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; heap[i] = heap[c]; hf[i] = hf[c]; i = c; }
      heap[i] = lk; hf[i] = lf; return top;
    };
    const h = (k) => { const dx = Math.abs(k % W - ex), dy = Math.abs(Math.floor(k / W) - ey); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
    seen[s] = st; g[s] = 0; from[s] = -1; push(s, h(s));
    const closed = new Set();
    let found = false, count = 0;
    const lim = maxNodes || 60000;
    while (hn > 0 && count++ < lim) {
      const k = pop();
      if (k === e) { found = true; break; }
      if (closed.has(k)) continue;
      closed.add(k);
      const ki = k % W, kj = Math.floor(k / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ki + di, j = kj + dj;
        if (i < 0 || j < 0 || i >= W || j >= this.H) continue;
        const nk = j * W + i;
        if (!walk[nk]) continue;
        if (di && dj && (!walk[kj * W + i] || !walk[j * W + ki])) continue;
        const ng = g[k] + (di && dj ? 1.4142 : 1);
        if (seen[nk] !== st || ng < g[nk]) { seen[nk] = st; g[nk] = ng; from[nk] = k; push(nk, ng + h(nk)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = e; k !== -1; k = from[k]) cells.push(this.center(k));
    cells.reverse();
    cells[0] = { x: ax, y: ay }; cells[cells.length - 1] = { x: bx, y: by };
    // string-pull: from each point, jump to the farthest one in clear sight
    const out = []; let i = 0;
    while (i < cells.length - 1) {
      let j = Math.min(cells.length - 1, i + 30);
      while (j > i + 1 && !this.f.clear(cells[i].x, cells[i].y, cells[j].x, cells[j].y, this.r - 2)) j--;
      out.push(cells[j]); i = j;
    }
    return out;
  };
  Nav.prototype.reach = function (ax, ay, bx, by) { return !!this.path(ax, ay, bx, by); };

  // ── difficulty by floor ────────────────────────────────────
  function difficulty(n) {
    return {
      rooms: n <= 1 ? 3 : n <= 3 ? 4 : n <= 5 ? 5 : n <= 8 ? 6 : 7,
      sides: n <= 1 ? 1 : n <= 4 ? 1 : 2,
      density: Math.min(0.9 + n * 0.2, 3.2),
      coneLen: Math.min(132 + n * 5, 190),
      fov: 0.6,
      patrol: Math.min(40 + n * 2, 60),
      chase: Math.min(100 + n * 2, 118),
      detect: Math.min(0.6 + n * 0.025, 0.9),
      cams: n >= 3,
      keys: n < 2 ? 0 : n < 5 ? 1 : n < 9 ? 2 : 3,
      hear: 100,
    };
  }

  const KEY_COLORS = [
    { name: 'red', c: '#e2483d' },
    { name: 'yellow', c: '#e9c53e' },
    { name: 'violet', c: '#8c5fe0' },
  ];

  // ── generation ─────────────────────────────────────────────
  function generate(seed, n) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const L = tryGen(U.hash(seed, attempt), n);
      if (L) { L.attempts = attempt + 1; L.seed = seed; return L; }
    }
    throw new Error('no floor for seed ' + seed);
  }

  // ── the building ───────────────────────────────────────────
  // A floor is one mass laid out on a polar grid round a centre: a disc (a hub and one or two
  // rings), a crescent wing (one or two bands round an empty court) or a nautilus (wedges that
  // grow as they wind round a hub). Each zone is a cell of that grid, { a0, a1, r0, r1 }; the hub
  // is the cell with r0 = 0. Zones that touch share a thick wall, and only the walls on the route
  // get a door gap, so the zones make a tree and a locked door can't be walked round.
  const WALL = 18, PART = 14, GAP = 52;
  const chord = (r) => Math.min(90, Math.sqrt(9 * r));   // arcs are laid in chords that sag about a unit

  function layout(R, n, Z) {
    const o = { x: 0, y: 0 }, rot = R() * TAU, AZ = 86000 + Math.min(n, 6) * 4000;
    const kind = R.weighted([['disc', 1], ['crescent', 1.1], ['nautilus', n >= 2 ? 1.1 : 0.5]]);
    const zones = [];
    const split = (k, span, j) => { const w = []; let s = 0; for (let i = 0; i < k; i++) { w.push(R.range(1 - j, 1 + j)); s += w[i]; } return w.map(v => v / s * span); };
    const band = (k, a0, span, r0, r1) => { let a = a0; for (const w of split(k, span, 0.2)) { zones.push({ a0: a, a1: a + w, r0, r1 }); a += w; } };
    let hub = 0, span = TAU;
    if (kind === 'disc') {
      hub = R.range(150, 185);
      const K = Z - 1;
      if (K <= 5) band(K, rot, TAU, hub, Math.sqrt(K * AZ / Math.PI + hub * hub));
      else {
        const k1 = Math.max(3, Math.round(K * 0.38)), k2 = K - k1;
        const rm = Math.sqrt(k1 * AZ * 0.85 / Math.PI + hub * hub), ro = Math.sqrt(k2 * AZ * 1.1 / Math.PI + rm * rm);
        band(k1, rot, TAU, hub, rm); band(k2, rot + R.range(0.2, 0.5), TAU, rm, ro);
      }
    } else if (kind === 'crescent') {
      span = R.range(3.9, 4.9);
      const ri = R.range(170, 230);
      if (Z <= 5) band(Z, rot, span, ri, Math.sqrt(2 * Z * AZ / span + ri * ri));
      else {
        const k1 = Math.max(2, Math.round(Z / 3)), k2 = Z - k1;
        const rm = Math.sqrt(2 * k1 * AZ * 0.8 / span + ri * ri), ro = Math.sqrt(2 * k2 * AZ * 1.1 / span + rm * rm);
        band(k1, rot, span, ri, rm); band(k2, rot, span, rm, ro);
      }
    } else {
      hub = R.range(140, 170);
      const nSplit = Z >= 8 ? 2 : Z >= 6 ? 1 : 0, K = Z - 1 - nSplit, ws = split(K, TAU, 0.06);
      let a = rot;
      for (let i = 0; i < K; i++) {
        const big = i >= K - nSplit, area = AZ * (0.55 + 0.9 * i / Math.max(1, K - 1)) * (big ? 2 : 1);
        const r1 = Math.sqrt(2 * area / ws[i] + hub * hub);
        if (big) { const rm = Math.sqrt((r1 * r1 + hub * hub) / 2); zones.push({ a0: a, a1: a + ws[i], r0: hub, r1: rm }, { a0: a, a1: a + ws[i], r0: rm, r1 }); }
        else zones.push({ a0: a, a1: a + ws[i], r0: hub, r1 });
        a += ws[i];
      }
    }
    if (hub) zones.unshift({ hub: true, a0: 0, a1: TAU, r0: 0, r1: hub });
    // a double row of columns that sweeps round the whole building along one radius
    let colR = null;
    if (R.chance(0.8)) {
      if (kind === 'crescent') { const b = zones[0]; colR = Z <= 5 ? b.r0 + 58 : (b.r0 + b.r1) / 2 - 34; }
      else if (kind === 'nautilus') colR = hub + 62;
      else { const outer = zones[zones.length - 1]; colR = outer.r0 + 56; }
    }
    return { kind, o, rot, hub, span, zones, colR, colGap: R.range(62, 74), colStep: R.range(54, 62) };
  }

  // Pairs of zones that touch: 'arc' where B's inner edge lies on A's outer edge, 'spoke' where B
  // starts, going round, where A ends.
  function seams(rooms) {
    const out = [], eq = (a, b) => Math.abs(a - b) < 1e-6;
    for (const A of rooms) for (const B of rooms) {
      if (A === B) continue;
      if (eq(A.r1, B.r0)) {
        if (A.hub) out.push({ A, B, type: 'arc', r: A.r1, s0: B.a0, s1: B.a1 });
        else for (const k of [-1, 0, 1]) {
          const s0 = Math.max(A.a0, B.a0 + k * TAU), s1 = Math.min(A.a1, B.a1 + k * TAU);
          if (s1 - s0 > 1e-6) out.push({ A, B, type: 'arc', r: A.r1, s0, s1 });
        }
      }
      if (!A.hub && !B.hub && Math.abs(U.angDiff(A.a1, B.a0)) < 1e-6) {
        const q0 = Math.max(A.r0, B.r0), q1 = Math.min(A.r1, B.r1);
        if (q1 - q0 > 1) out.push({ A, B, type: 'spoke', a: A.a1, q0, q1 });
      }
    }
    for (const s of out) s.len = s.type === 'arc' ? (s.s1 - s.s0) * s.r : s.q1 - s.q0;
    return out;
  }

  function cellPoly(o, a0, a1, r0, r1) {
    const pts = [], k = Math.max(2, Math.ceil((a1 - a0) / 0.09));
    for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; pts.push({ x: o.x + Math.cos(a) * r1, y: o.y + Math.sin(a) * r1 }); }
    if (r0 <= 0) pts.push({ x: o.x, y: o.y });
    else for (let i = k; i >= 0; i--) { const a = a0 + (a1 - a0) * i / k; pts.push({ x: o.x + Math.cos(a) * r0, y: o.y + Math.sin(a) * r0 }); }
    return U.poly(pts);
  }
  // a point's polar coordinates about a cell's centre, the angle unwrapped beside the cell's own
  function polarOf(room, x, y) {
    const dx = x - room.o.x, dy = y - room.o.y, mid = (room.a0 + room.a1) / 2;
    return { a: mid + U.angDiff(mid, Math.atan2(dy, dx)), r: Math.hypot(dx, dy) };
  }
  function inCell(room, x, y, m) {
    const p = polarOf(room, x, y);
    return p.r >= room.r0 + m && p.r <= room.r1 - m && (p.a - room.a0) * p.r >= m && (room.a1 - p.a) * p.r >= m;
  }

  // how far from a room's centre to its edge, heading a
  function extent(room, a) {
    if (room.kind === 'circle') return room.r;
    if (room.kind === 'cell') {
      const dx = Math.cos(a), dy = Math.sin(a);
      let t = 0;
      while (t < 2400 && inCell(room, room.c.x + dx * (t + 4), room.c.y + dy * (t + 4), 0)) t += 4;
      return Math.max(t, 4);
    }
    const lx = Math.cos(a - room.ang), ly = Math.sin(a - room.ang);
    return Math.min(Math.abs(lx) > 1e-6 ? room.w / 2 / Math.abs(lx) : Infinity, Math.abs(ly) > 1e-6 ? room.h / 2 / Math.abs(ly) : Infinity);
  }

  // a uniformly random point in a room, drawn toward its centre by frac
  function inRoom(R, room, frac) {
    frac = frac || 1;
    if (room.kind === 'circle') { const a = R() * TAU, d = Math.sqrt(R()) * room.r * frac; return { x: room.c.x + Math.cos(a) * d, y: room.c.y + Math.sin(a) * d }; }
    if (room.kind === 'cell') {
      const a = R.range(room.a0, room.a1), r = Math.sqrt(R.range(room.r0 * room.r0, room.r1 * room.r1));
      const x = room.o.x + Math.cos(a) * r, y = room.o.y + Math.sin(a) * r;
      return { x: room.c.x + (x - room.c.x) * frac, y: room.c.y + (y - room.c.y) * frac };
    }
    const u = (R() - 0.5) * room.w * frac, v = (R() - 0.5) * room.h * frac, c = Math.cos(room.ang), s = Math.sin(room.ang);
    return { x: room.c.x + u * c - v * s, y: room.c.y + u * s + v * c };
  }

  function tryGen(seed, n) {
    const R = U.rng(seed), D = difficulty(n);
    const L = { n, D, floor: [], obs: [], doors: [], shades: [], guards: [], cams: [], keys: [], stars: [], rooms: [], conns: [] };
    // the building, and its zones as rooms
    const P = layout(R, n, D.rooms + D.sides), o = P.o;
    L.plan = P;
    const pt = (a, r) => ({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r });
    const zones = P.zones.map((z) => {
      const room = { kind: z.hub ? 'circle' : 'cell', hub: !!z.hub, o, a0: z.a0, a1: z.a1, r0: z.r0, r1: z.r1, excl: [], spots: [] };
      if (z.hub) { room.r = room.R = z.r1; room.c = { x: o.x, y: o.y }; room.ang = 0; room.shape = U.circle(o.x, o.y, z.r1); }
      else {
        const rc = Math.sqrt((z.r0 * z.r0 + z.r1 * z.r1) / 2);
        room.ang = (z.a0 + z.a1) / 2; room.c = pt(room.ang, rc);
        room.w = (z.a1 - z.a0) * rc; room.h = z.r1 - z.r0; room.R = Math.hypot(room.w, room.h) / 2;
        room.shape = cellPoly(o, z.a0, z.a1, z.r0, z.r1);
      }
      return room;
    });
    const all = seams(zones);
    // each zone's floor reaches a little past its shared edges into the neighbour that covers
    // them, so the union is seamless; each edge also says how far furniture may reach past it
    for (const z of zones) {
      z.tol = { in: 20, out: 20, a0: 20, a1: 20 };
      if (z.hub) { L.floor.push(z.shape); continue; }
      let e0 = 0, e1 = 0, ein = 0;
      for (const s of all) {
        if (s.type === 'arc') { if (s.B === z) { z.tol.in = 8; ein = 30; } if (s.A === z) z.tol.out = 8; }
        else if (s.B === z) { z.tol.a0 = 8; if (s.A.r0 <= z.r0 && s.A.r1 >= z.r1) e0 = 32 / Math.max(z.r0, 90); }
        else if (s.A === z) { z.tol.a1 = 8; if (s.B.r0 <= z.r0 && s.B.r1 >= z.r1) e1 = 32 / Math.max(z.r0, 90); }
      }
      L.floor.push(cellPoly(o, z.a0 - e0, z.a1 + e1, z.r0 - ein, z.r1));
    }

    // the route: a walk through neighbouring zones from the stairs in to the stairs up
    const nb = new Map(zones.map(z => [z, []]));
    for (const s of all) if (s.len >= 150) { nb.get(s.A).push({ to: s.B, s }); nb.get(s.B).push({ to: s.A, s }); }
    let main = null, bestScore = -1;
    for (let t = 0; t < 60; t++) {
      const path = [R.pick(zones.filter(z => !z.hub))], used = new Set(path);
      while (path.length < D.rooms) {
        const opts = nb.get(path[path.length - 1]).filter(e => !used.has(e.to));
        if (!opts.length) break;
        const e = R.pick(opts); path.push(e.to); used.add(e.to);
      }
      if (path.length < D.rooms) continue;
      const a = path[0].c, b = path[path.length - 1].c, score = Math.hypot(a.x - b.x, a.y - b.y) + R() * 120;
      if (score > bestScore) { bestScore = score; main = path; }
    }
    if (!main) return null;
    main.forEach((z, i) => { z.main = true; z.idx = i; });
    const seamOf = (A, B) => { let best = null; for (const e of nb.get(A)) if (e.to === B && (!best || e.s.len > best.len)) best = e.s; return best; };
    // every other zone hangs off the route, or off a zone that does, by one door
    const tree = new Set(main), sides = [];
    let rest = zones.filter(z => !tree.has(z));
    for (let pass = 0; rest.length && pass < 12; pass++) {
      for (const z of rest.slice()) {
        const opts = nb.get(z).filter(e => tree.has(e.to));
        if (!opts.length) continue;
        const e = R.pick(opts);
        z.side = true; z.host = e.to; z.idx = e.to.idx; z.hostSeam = e.s;
        tree.add(z); sides.push(z); rest = rest.filter(x => x !== z);
      }
    }
    if (rest.length) return null;
    L.rooms = main.concat(sides);

    // doors: a gap in the shared wall
    const connect = (A, B, s) => {
      const conn = { a: A, b: B, width: GAP, kind: 'seam', seam: s };
      let g0, g1;
      if (s.type === 'spoke') {
        const rg = R.range(s.q0 + 48, s.q1 - 48), tn = { x: -Math.sin(s.a), y: Math.cos(s.a) };
        s.gap = rg; conn.mouth = pt(s.a, rg);
        conn.normal = A === s.A ? tn : { x: -tn.x, y: -tn.y };
        g0 = pt(s.a, rg - GAP / 2); g1 = pt(s.a, rg + GAP / 2);
      } else {
        const m = 48 / s.r, g = R.range(s.s0 + m, s.s1 - m), h = GAP / 2 / s.r, rn = { x: Math.cos(g), y: Math.sin(g) };
        s.gap = g; conn.mouth = pt(g, s.r);
        conn.normal = A === s.A ? rn : { x: -rn.x, y: -rn.y };
        g0 = pt(g - h, s.r); g1 = pt(g + h, s.r);
      }
      conn.doorShape = U.seg(g0.x, g0.y, g1.x, g1.y, 12, 4);
      const mo = conn.mouth, nx = conn.normal.x, ny = conn.normal.y;
      for (const p of [{ x: mo.x - nx * 30, y: mo.y - ny * 30 }, mo, { x: mo.x + nx * 30, y: mo.y + ny * 30 }]) { A.excl.push({ x: p.x, y: p.y, r: 58 }); B.excl.push({ x: p.x, y: p.y, r: 58 }); }
      conn.dirFrom = (room) => room === A ? { x: nx, y: ny } : { x: -nx, y: -ny };
      L.conns.push(conn);
      return conn;
    };
    for (let i = 1; i < main.length; i++) main[i].inConn = main[i - 1].outConn = connect(main[i - 1], main[i], seamOf(main[i - 1], main[i]));
    for (const z of sides) z.inConn = connect(z.host, z, z.hostSeam);

    // the shared walls: straight along a spoke, short chords along an arc
    for (const s of all) {
      const h = GAP / 2;
      if (s.type === 'spoke') {
        const top = s.q1 + (Math.abs(s.A.r1 - s.B.r1) < 1 ? 9 : 0);   // flush where one zone steps out past the other
        const spans = s.gap == null ? [[s.q0 - 9, top]] : [[s.q0 - 9, s.gap - h], [s.gap + h, top]];
        for (const [u0, u1] of spans) { const p = pt(s.a, u0), q = pt(s.a, u1); L.obs.push(U.seg(p.x, p.y, q.x, q.y, WALL, 0)); }
      } else {
        const e = 9 / s.r, gh = h / s.r;
        const spans = s.gap == null ? [[s.s0 - e, s.s1 + e]] : [[s.s0 - e, s.gap - gh], [s.gap + gh, s.s1 + e]];
        for (const [u0, u1] of spans) {
          const k = Math.max(1, Math.ceil((u1 - u0) * s.r / chord(s.r)));
          for (let i = 0; i < k; i++) { const p = pt(u0 + (u1 - u0) * i / k, s.r), q = pt(u0 + (u1 - u0) * (i + 1) / k, s.r); L.obs.push(U.seg(p.x, p.y, q.x, q.y, WALL, 1.5)); }
        }
      }
    }

    // entrance and exit, as far into the first and last zones as they go from the door
    const farFrom = (room, p) => {
      let best = null, bd = -1;
      for (let t = 0; t < 40; t++) { const q = inRoom(R, room, 0.8), d = Math.hypot(q.x - p.x, q.y - p.y); if (d > bd) { bd = d; best = q; } }
      return best;
    };
    L.entrance = farFrom(main[0], main[0].outConn.mouth);
    L.exit = farFrom(main[main.length - 1], main[main.length - 1].inConn.mouth);
    main[0].excl.push({ x: L.entrance.x, y: L.entrance.y, r: 70 });
    main[main.length - 1].excl.push({ x: L.exit.x, y: L.exit.y, r: 66 });

    // furniture
    for (const room of L.rooms) furnish(R, L, room, n);

    // bounds and the field
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of L.floor) { const b = U.bbox(s); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
    L.bounds = { x0: x0 - 90, y0: y0 - 90, x1: x1 + 90, y1: y1 + 90 };
    const field = new Field(L);
    const ent = field.nearestFree(L.entrance.x, L.entrance.y, 22, 100), ext = field.nearestFree(L.exit.x, L.exit.y, 22, 100);
    if (!ent || !ext) return null;
    L.entrance = ent; L.exit = ext;

    // locks and keys
    const lockable = [];
    for (let i = 1; i < main.length - 1; i++) lockable.push(main[i].outConn);   // never the first door
    const nKeys = Math.min(D.keys, lockable.length);
    const locks = [];
    if (nKeys) {
      const idx = lockable.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = R.int(0, i); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      const chosen = idx.slice(0, nKeys).sort((a, b) => a - b);
      chosen.forEach((ci, k) => locks.push({ conn: lockable[ci], color: KEY_COLORS[k] }));
    }
    for (const lk of locks) {
      const d = { shape: lk.conn.doorShape, open: false, color: lk.color, conn: lk.conn };
      L.doors.push(d); lk.door = d;
    }
    field.applyDoors();
    const navG = (f) => new Nav(f, 11);
    let lo = 0;
    for (let k = 0; k < locks.length; k++) {
      // the key lives somewhere between the previous lock and this one, a side room if there is one
      const hi = main.indexOf(locks[k].conn.a);
      const pool = L.rooms.filter(r => r.idx >= lo && r.idx <= hi && r !== main[0] || (r === main[0] && hi === 0));
      const sides = pool.filter(r => r.side);
      const nav = navG(field);
      let placed = null;
      for (let t = 0; t < 40 && !placed; t++) {
        const room = sides.length && t < 20 ? R.pick(sides) : R.pick(pool.length ? pool : main.slice(0, hi + 1));
        const spot = room.spots.length && R.chance(0.6) ? R.pick(room.spots) : inRoom(R, room, 0.7);
        const p = field.nearestFree(spot.x, spot.y, 16, 40);
        if (!p || Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) < 160) continue;
        if (!nav.reach(L.entrance.x, L.entrance.y, p.x, p.y)) continue;
        placed = p; placed.room = room;
      }
      if (!placed) return null;
      L.keys.push({ x: placed.x, y: placed.y, color: locks[k].color, door: locks[k].door, got: false });
      locks[k].door.open = true; field.applyDoors();
      lo = hi + 1;
    }
    // with every door open, the stairs must be reachable
    const navOpen = navG(field);
    if (!navOpen.reach(L.entrance.x, L.entrance.y, L.exit.x, L.exit.y)) return null;
    for (const d of L.doors) d.open = false;
    field.applyDoors();
    const navClosed = navG(field);   // guards are routed with the doors shut, so no patrol runs through one

    // stars: side rooms and hearts of rings first, then anywhere a little off the beaten track
    const starCands = [];
    for (const r of L.rooms) if (r.side) starCands.push(r.spots.length ? r.spots[0] : r.c);
    for (const r of L.rooms) for (const s of r.spots) if (!r.side) starCands.push(s);
    for (let t = 0; t < 60; t++) { const r = R.pick(L.rooms.filter(r => r.idx >= 1)); starCands.push(inRoom(R, r, 0.85)); }
    for (const c of starCands) {
      if (L.stars.length >= 3) break;
      const p = field.nearestFree(c.x, c.y, 14, 50);
      if (!p) continue;
      if (Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) < 220 || Math.hypot(p.x - L.exit.x, p.y - L.exit.y) < 70) continue;
      if (L.stars.some(s => Math.hypot(s.x - p.x, s.y - p.y) < 160) || L.keys.some(s => Math.hypot(s.x - p.x, s.y - p.y) < 60)) continue;
      if (!navOpen.reach(L.entrance.x, L.entrance.y, p.x, p.y)) continue;
      L.stars.push({ x: p.x, y: p.y, got: false });
    }

    // guards and cameras
    placeGuards(R, L, field, navClosed, n);
    if (n >= 2 && L.guards.length < 2) return null;

    // hiding spots: pools of deep shadow tucked against walls, laid after the guards so none sits
    // on a beat: a shade is only safe if no round walks within reach of it
    const beat = [];
    for (const gd of L.guards) {
      if (!gd.path) { beat.push({ x: gd.x, y: gd.y }); continue; }
      for (let i = 0; i < gd.path.length; i++) {
        const a = gd.path[i], b = gd.path[(i + 1) % gd.path.length], k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
        for (let j = 0; j < k; j++) beat.push({ x: a.x + (b.x - a.x) * j / k, y: a.y + (b.y - a.y) * j / k });
      }
    }
    for (const room of L.rooms) {
      const want = room.side ? 1 : (room.kind === 'circle' && room.r > 240) || room.w * room.h > 110000 ? 3 : 2;
      let got = 0;
      for (let t = 0; t < 80 && got < want; t++) {
        const p = inRoom(R, room, 0.95), s = field.sample(p.x, p.y);
        if (s < 13 || s > 24) continue;
        if (Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) < 90 || Math.hypot(p.x - L.exit.x, p.y - L.exit.y) < 70) continue;
        if (L.shades.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 110)) continue;
        if (L.stars.concat(L.keys).some(o => Math.hypot(o.x - p.x, o.y - p.y) < 40)) continue;
        if (L.conns.some(c => Math.hypot(c.mouth.x - p.x, c.mouth.y - p.y) < 50)) continue;
        const r = R.range(19, 24);
        if (beat.some(q => Math.hypot(q.x - p.x, q.y - p.y) < r + 30)) continue;
        if (!navOpen.reach(L.entrance.x, L.entrance.y, p.x, p.y)) continue;
        L.shades.push({ x: p.x, y: p.y, r, rot: R() * TAU });
        got++;
      }
    }

    L.field = field;
    L.nav = navClosed;
    return L;
  }

  // ── furniture ──────────────────────────────────────────────
  function furnish(R, L, room, n) {
    if (room.kind === 'cell') return furnishCell(R, L, room, n);
    // the hub's neighbours reach into it by design, so it keeps to its own circle instead
    const others = room.hub ? [] : L.floor.filter(s => s !== room.shape);
    const placed = [];
    // a piece is kept only if it stays out of every other room and corridor, clear of the ways
    // through, and (when asked) leaves a walkable gap to what's already there
    const put = (s, spacing) => {
      const samples = [];
      if (s.k === 'c') { for (let i = 0; i < 8; i++) samples.push({ x: s.x + Math.cos(i / 8 * TAU) * s.r, y: s.y + Math.sin(i / 8 * TAU) * s.r }); samples.push({ x: s.x, y: s.y }); }
      else for (let i = 0; i < s.pts.length; i++) { const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length]; samples.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }
      for (const p of samples) for (const o of others) if (U.sd(o, p.x, p.y) < 6) return false;
      const c = U.centroid(s);
      if (U.sd(room.shape, c.x, c.y) > -4) return false;
      for (const e of room.excl) if (U.sd(s, e.x, e.y) < e.r) return false;
      if (spacing) for (const o of placed) {
        let d = Infinity;
        const sp = s.k === 'c' ? [{ x: s.x, y: s.y }] : s.pts, op = o.k === 'c' ? [{ x: o.x, y: o.y }] : o.pts;
        for (const p of sp) d = Math.min(d, U.sd(o, p.x, p.y) - (s.k === 'c' ? s.r : 0));
        for (const p of op) d = Math.min(d, U.sd(s, p.x, p.y) - (o.k === 'c' ? o.r : 0));
        if (d < spacing) return false;
      }
      placed.push(s); L.obs.push(s);
      return true;
    };
    const c = room.c;

    if (room.kind === 'circle') {
      const r = room.r, th = R() * TAU, cs = Math.cos(th), sn = Math.sin(th);
      const W = (lx, ly) => ({ x: c.x + lx * cs - ly * sn, y: c.y + lx * sn + ly * cs });
      const polar = (a, d) => ({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d });
      const rim = room.hub ? r - 2 : r + 14;   // how far a wall from the edge reaches out
      const style = room.hub ? R.weighted([['ring', r > 150 ? 2 : 0], ['ringspokes', r > 165 ? 1.5 : 0], ['pillars4', 2], ['spokes', 1.5], ['table', 1]])
        : room.side ? R.weighted([['jut', 2], ['pillar', 2], ['ring', r > 115 ? 1 : 0], ['bare', 1]])
        : room.big ? R.weighted([['ring', 3], ['spokes', 2], ['ringspokes', 2]])
        : R.weighted([['pillars4', 3], ['ring', r > 190 ? 2 : 0], ['spokes', r > 180 ? 2 : 0], ['scatter', 3], ['columns', 2], ['table', 1.5], ['jut', 2]]);
      room.style = style;
      if (style === 'pillars4') {
        if (r < 175) put(U.rect(c.x, c.y, r * 0.42, r * 0.3, th));
        else {
          const s = r * R.range(0.16, 0.21), off = r * R.range(0.3, 0.36), a2 = th + (R.chance(0.5) ? 0 : R.range(-0.3, 0.3));
          for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = W(i * off, j * off); put(U.rect(p.x, p.y, s, s * R.range(0.85, 1.15), a2)); }
          if (R.chance(0.5)) room.spots.push({ x: c.x, y: c.y });
        }
      } else if (style === 'ring' || style === 'ringspokes') {
        const ri = r * R.range(0.42, 0.52), N = Math.max(24, Math.round(ri / 9));
        const gaps = []; const ng = R.int(2, 3), g0 = R() * TAU;
        for (let i = 0; i < ng; i++) gaps.push(g0 + i * TAU / ng + R.range(-0.4, 0.4));
        const gh = 30 / ri;
        for (let i = 0; i < N; i++) {
          const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, am = (a0 + a1) / 2;
          if (gaps.some(g => Math.abs(U.angDiff(g, am)) < gh)) continue;
          const p0 = polar(a0, ri), p1 = polar(a1, ri);
          put(U.seg(p0.x, p0.y, p1.x, p1.y, PART, 1.6));
        }
        room.spots.push({ x: c.x, y: c.y });
        if (style === 'ringspokes') {
          const k = R.int(4, 6), off = R() * TAU;
          for (let i = 0; i < k; i++) {
            const a = off + i * TAU / k;
            if (gaps.some(g => Math.abs(U.angDiff(g, a)) < 0.35)) continue;
            const p0 = polar(a, ri + 50), p1 = polar(a, rim);
            if (!put(U.seg(p0.x, p0.y, p1.x, p1.y, PART, 0))) { const p2 = polar(a, r * 0.86); put(U.seg(p0.x, p0.y, p2.x, p2.y, PART, 0)); }
          }
        }
      } else if (style === 'spokes') {
        const k = R.int(5, 8), ri = r * R.range(0.34, 0.42), off = R() * TAU;
        for (let i = 0; i < k; i++) {
          const a = off + i * TAU / k, p0 = polar(a, ri), p1 = polar(a, rim);
          if (!put(U.seg(p0.x, p0.y, p1.x, p1.y, PART, 0))) { const p2 = polar(a, r * 0.8); if (!put(U.seg(p0.x, p0.y, p2.x, p2.y, PART, 0))) continue; }
          if (R.chance(0.45)) { const t = a + Math.PI / 2 * (R.chance(0.5) ? 1 : -1), l = R.range(28, 48); put(U.seg(p0.x, p0.y, p0.x + Math.cos(t) * l, p0.y + Math.sin(t) * l, PART, 5)); }
          const mid = polar(a + Math.PI / k, r * 0.7); room.spots.push(mid);
        }
        const s = Math.min(ri * 0.9, (ri - 46) / 0.72);
        if (s > 24) put(U.rect(c.x, c.y, s, s, th));
      } else if (style === 'scatter') {
        const m = R.int(3, 6), aa = R.chance(0.5) ? th : null;
        for (let t = 0, k = 0; t < 50 && k < m; t++) {
          const p = inRoom(R, room, 0.78);
          if (put(U.rect(p.x, p.y, R.range(26, 86), R.range(18, 56), aa === null ? R() * TAU : aa), 40)) k++;
        }
      } else if (style === 'columns') {
        const pr = R.range(9, 12);
        if (R.chance(0.5)) {
          const rr = r * R.range(0.55, 0.7), span = R.range(1.6, 3.6), a0 = R() * TAU, k = Math.floor(span * rr / 50);
          for (let i = 0; i <= k; i++) { const p = polar(a0 + span * i / Math.max(1, k), rr); put(U.circle(p.x, p.y, pr)); }
        } else {
          for (const side of [-1, 1]) for (let u = -r; u <= r; u += 52) { const p = W(u, side * r * 0.3); if (U.sd(room.shape, p.x, p.y) < -30) put(U.circle(p.x, p.y, pr)); }
        }
      } else if (style === 'table') {
        const tw = R.range(70, 104), td = R.range(42, 56);
        const oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; oct.push(W(Math.cos(a) * tw / 2 / 0.92, Math.sin(a) * td / 2 / 0.92)); }
        put(U.poly(oct));
        const chairs = R.int(4, 6);
        for (let i = 0; i < chairs; i++) {
          const u = (i % 3 - 1) * tw * 0.33, v = (i < 3 ? -1 : 1) * (td / 2 + 13), p = W(u, v);
          put(U.rect(p.x, p.y, 13, 12, th + R.range(-0.4, 0.4)));
        }
        for (let t = 0, k = 0; t < 20 && k < 2; t++) { const p = inRoom(R, room, 0.72); if (put(U.rect(p.x, p.y, R.range(30, 60), R.range(22, 40), R() * TAU), 44)) k++; }
      } else if (style === 'jut') {
        const k = R.int(3, 5), off = R() * TAU;
        for (let i = 0; i < k; i++) {
          const a = off + i * TAU / k + R.range(-0.3, 0.3), p0 = polar(a, rim), p1 = polar(a, r * R.range(0.5, 0.7));
          if (!put(U.seg(p0.x, p0.y, p1.x, p1.y, PART, 0))) continue;
          if (R.chance(0.55)) { const t = a + Math.PI / 2 * (R.chance(0.5) ? 1 : -1), l = R.range(30, 56); put(U.seg(p1.x, p1.y, p1.x + Math.cos(t) * l, p1.y + Math.sin(t) * l, PART, 5)); }
          room.spots.push(polar(a + Math.PI / k, r * 0.68));
        }
      } else if (style === 'pillar') {
        put(U.rect(c.x, c.y, r * 0.3, r * 0.3, th));
        room.spots.push(W(r * 0.55, 0));
      }
    }
  }

  // A zone of the building, in its own polar frame: closets along a wall, wedges, a ring split,
  // big blocks, and the building's colonnade where it passes through. Walls go down in short
  // pieces, so a piece that would block a doorway is simply left out and leaves a gap.
  function furnishCell(R, L, room, n) {
    const o = room.o, a0 = room.a0, a1 = room.a1, r0 = room.r0, r1 = room.r1, T = r1 - r0, tol = room.tol, Pl = L.plan;
    const pt = (a, r) => ({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r });
    const placed = [];
    const fits = (q, m) => { const p = polarOf(room, q.x, q.y); return p.r >= r0 - tol.in + m && p.r <= r1 + tol.out - m && (p.a - a0) * p.r >= -tol.a0 + m && (a1 - p.a) * p.r >= -tol.a1 + m; };
    const fitsAll = (s, spacing, m) => {
      const samples = [];
      if (s.k === 'c') { for (let i = 0; i < 8; i++) samples.push({ x: s.x + Math.cos(i / 8 * TAU) * s.r, y: s.y + Math.sin(i / 8 * TAU) * s.r }); }
      else for (let i = 0; i < s.pts.length; i++) { const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length]; samples.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }
      for (const q of samples) if (!fits(q, m || 0)) return false;
      const c = U.centroid(s);
      if (!inCell(room, c.x, c.y, 2)) return false;
      for (const e of room.excl) if (U.sd(s, e.x, e.y) < e.r) return false;
      if (spacing) for (const ob of placed) {
        let d = Infinity;
        const sp = s.k === 'c' ? [{ x: s.x, y: s.y }] : s.pts, op = ob.k === 'c' ? [{ x: ob.x, y: ob.y }] : ob.pts;
        for (const p of sp) d = Math.min(d, U.sd(ob, p.x, p.y) - (s.k === 'c' ? s.r : 0));
        for (const p of op) d = Math.min(d, U.sd(s, p.x, p.y) - (ob.k === 'c' ? ob.r : 0));
        if (d < spacing) return false;
      }
      return true;
    };
    const commit = (s) => { placed.push(s); L.obs.push(s); };
    const put = (s, spacing, m) => { if (!fitsAll(s, spacing, m)) return false; commit(s); return true; };
    // a wall from p to q, tried in pieces of about 40 and laid as one wall per unbroken run
    const line = (p, q, t) => {
      const len = Math.hypot(q.x - p.x, q.y - p.y), k = Math.max(1, Math.round(len / 40));
      const at = (u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
      let got = 0, run = -1;
      for (let i = 0; i <= k; i++) {
        let ok = false;
        if (i < k) { const a = at(i / k), b = at((i + 1) / k); ok = fitsAll(U.seg(a.x, a.y, b.x, b.y, t || PART, 0.5)); }
        if (ok && run < 0) run = i;
        if (!ok && run >= 0) { const a = at(run / k), b = at(i / k); commit(U.seg(a.x, a.y, b.x, b.y, t || PART, 0.5)); got += i - run; run = -1; }
      }
      return got;
    };
    const radial = (a, u0, u1, t) => line(pt(a, u0), pt(a, u1), t);
    const arc = (r, b0, b1, t) => {
      const k = Math.max(1, Math.ceil(Math.abs(b1 - b0) * r / chord(r)));
      for (let i = 0; i < k; i++) { const p = pt(b0 + (b1 - b0) * i / k, r), q = pt(b0 + (b1 - b0) * (i + 1) / k, r); put(U.seg(p.x, p.y, q.x, q.y, t || PART, 1.5)); }
    };
    // a short wall square to the radius at (a, r), toward increasing angle when dir > 0
    const jog = (a, r, len, dir) => { const p = pt(a, r), tx = -Math.sin(a) * dir, ty = Math.cos(a) * dir; line(p, { x: p.x + tx * len, y: p.y + ty * len }); };
    const back = { out: r1 + tol.out - 3, in: r0 - tol.in + 3 };

    // closets along the outer (or inner) wall: radial partitions, some with a stepped jog at the
    // mouth and some with a front wall that leaves a narrow way in
    const closets = (side, d, from, to) => {
      from = from == null ? a0 : from; to = to == null ? a1 : to;
      const rf = side === 'out' ? r1 - d : r0 + d, rb = side === 'out' ? back.out : back.in;
      const k = Math.max(2, Math.round((to - from) * rf / R.range(100, 140)));
      const jogs = R.chance(0.6), dir = R.chance(0.5) ? 1 : -1, fronts = !jogs && R.chance(0.6);
      for (let i = 0; i <= k; i++) {
        const a = from + (to - from) * i / k;
        if (i > 0 && i < k) { radial(a, rb, rf); if (jogs) jog(a, rf, R.range(28, 44), dir); }
        if (i < k) {
          const b0 = a, b1 = from + (to - from) * (i + 1) / k;
          room.spots.push(pt((b0 + b1) / 2, (rf + (side === 'out' ? r1 : r0)) / 2));
          if (fronts && R.chance(0.55)) { const gw = 58 / rf; if (R.chance(0.5)) arc(rf, b0, b1 - gw); else arc(rf, b0 + gw, b1); }
        }
      }
    };
    // big pale blocks standing in the open, square to the radius, now and then an L
    const blocks = (k, rlo, rhi) => {
      for (let t = 0, got = 0; t < 40 && got < k; t++) {
        const a = R.range(a0, a1), r = R.range(rlo, rhi), c = pt(a, r), w = R.range(56, 104), h = R.range(48, 96);
        if (R.chance(0.35)) {
          // an L: a long bar and a short one off its end
          const th = R.range(26, 34), ux = -Math.sin(a), uy = Math.cos(a), vx = Math.cos(a), vy = Math.sin(a), sd = R.chance(0.5) ? 1 : -1;
          const bar = U.rect(c.x, c.y, w * 1.3, th, a + Math.PI / 2);
          const ex = c.x + ux * (w * 0.65 - th / 2) * sd + vx * (h / 2 - th / 2), ey = c.y + uy * (w * 0.65 - th / 2) * sd + vy * (h / 2 - th / 2);
          if (put(bar, 60, 30)) { if (!put(U.rect(ex, ey, h, th, a), 0, 30)) { /* the bar alone will do */ } got++; }
        } else if (put(U.rect(c.x, c.y, h, w, a), 60, 30)) got++;
      }
    };
    // the colonnade: two staggered rows of pillars at even steps along the building's curve
    const colonnade = () => {
      const pr = 10;
      [Pl.colR, Pl.colR + Pl.colGap].forEach((r, row) => {
        const st = Pl.colStep / r, ph = Pl.rot + (row ? st / 2 : 0);
        const k0 = Math.ceil((a0 - ph) / st), k1 = Math.floor((a1 - ph) / st);
        for (let k = k0; k <= k1; k++) { const p = pt(ph + k * st, r); put(U.circle(p.x, p.y, pr), 0, 22); }
      });
      room.spots.push(pt((a0 + a1) / 2, Pl.colR + Pl.colGap / 2));
    };

    const hasCol = Pl.colR != null && Pl.colR - 40 >= r0 && Pl.colR + Pl.colGap + 40 <= r1;
    if (hasCol) {
      room.style = 'hall';
      colonnade();
      const room2 = r1 - (Pl.colR + Pl.colGap);
      if (room2 >= 118) closets('out', Math.min(R.range(100, 135), room2 - 48));
      const inner = Pl.colR - r0;
      if (inner >= 150) closets('in', Math.min(R.range(90, 120), inner - 60));
      return;
    }
    const arcLen = (a1 - a0) * (r0 + r1) / 2;
    const style = R.weighted([['closets', 3], ['wedges', arcLen > 300 ? 2.5 : 0], ['ring', T >= 230 ? 2 : 0], ['blocks', 1.4]]);
    room.style = style;
    if (style === 'closets') {
      const side = tol.out > 8 ? 'out' : tol.in > 8 ? 'in' : R.chance(0.6) ? 'out' : 'in';
      const d = Math.min(R.range(100, 135), T - 90);
      if (d >= 70) closets(side, d);
      if (T - d > 200) blocks(R.int(1, 2), side === 'out' ? r0 + 70 : r0 + d + 70, side === 'out' ? r1 - d - 70 : r1 - 70);
    } else if (style === 'wedges') {
      const k = Math.max(2, Math.min(4, Math.round(arcLen / R.range(170, 230))));
      let inner = R.chance(0.5);
      for (let i = 1; i < k; i++) {
        const a = a0 + (a1 - a0) * (i + R.range(-0.15, 0.15)) / k;
        const u = T < 170 ? r0 + T / 2 : inner ? r0 + R.range(52, 70) : r1 - R.range(52, 70);
        radial(a, back.in, u - 30); radial(a, u + 30, back.out);
        if (R.chance(0.5)) jog(a, inner ? u + 30 : u - 30, R.range(30, 46), R.chance(0.5) ? 1 : -1);
        inner = !inner;
      }
      for (let i = 0; i < k; i++) room.spots.push(pt(a0 + (a1 - a0) * (i + 0.5) / k, (r0 + r1) / 2));
    } else if (style === 'ring') {
      const rs = r0 + T * R.range(0.42, 0.58), ga = a0 + (a1 - a0) * R.range(0.12, 0.32), gb = a0 + (a1 - a0) * R.range(0.68, 0.88), gh = 32 / rs;
      arc(rs, a0 - 8 / rs, ga - gh); arc(rs, ga + gh, gb - gh); arc(rs, gb + gh, a1 + 8 / rs);
      const am = (ga + gb) / 2;
      radial(am, rs, back.out);
      if (R.chance(0.6)) jog(am, (rs + r1) / 2, R.range(30, 44), R.chance(0.5) ? 1 : -1);
      if (rs - r0 > 130 && R.chance(0.6)) radial(R.chance(0.5) ? (a0 + ga) / 2 : (gb + a1) / 2, back.in, r0 + (rs - r0) * 0.55);
      room.spots.push(pt((a0 + am) / 2, (rs + r1) / 2), pt((am + a1) / 2, (rs + r1) / 2));
    } else {
      blocks(R.int(2, Math.max(2, Math.min(5, Math.round(arcLen * T / 40000)))), r0 + 60, r1 - 60);
      room.spots.push(room.c);
    }
  }

  // ── guards ─────────────────────────────────────────────────
  function placeGuards(R, L, field, nav, n) {
    const D = L.D, homes = [];
    const farFromStart = (p, d) => Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) > d;
    const okHome = (p) => p && farFromStart(p, 290) && Math.hypot(p.x - L.exit.x, p.y - L.exit.y) > 50 && homes.every(h => Math.hypot(h.x - p.x, h.y - p.y) > 80);
    const loopLen = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += Math.hypot(b.x - a.x, b.y - a.y); } return s; };
    const route = (way, closed) => {
      // join waypoints with real paths; each waypoint keeps its pause
      const out = [];
      const m = closed ? way.length : way.length - 1;
      for (let i = 0; i < m; i++) {
        const a = way[i], b = way[(i + 1) % way.length];
        const p = nav.path(a.x, a.y, b.x, b.y, 8000);
        if (!p) return null;
        p.forEach((q, j) => out.push({ x: q.x, y: q.y, pause: j === p.length - 1 ? b.pause : 0, look: b.look }));
      }
      return out;
    };

    for (const room of L.rooms) {
      if (room.idx === 0 && !room.side && n < 4) continue;
      if (room.side && R.chance(n >= 2 ? 0.45 : 0.85)) continue;
      const area = room.kind === 'circle' ? Math.PI * room.r * room.r : room.w * room.h;
      let count = Math.max(room.side ? 1 : 1, Math.round(area / 100000 * D.density * R.range(0.8, 1.15)));
      if (n === 1) count = 1;
      count = Math.min(count, room.big ? 5 : 4);
      let cams = 0;
      const camCap = (room.kind === 'circle' ? room.r : room.R) > 240 ? 2 : 1;
      // doorways out of this room that a guard may walk through (never a locked one)
      const ways = L.conns.filter(c => (c.a === room || c.b === room) && !L.doors.some(d => d.conn === c));
      for (let k = 0, t = 0; k < count && t < 14; t++) {
        const kind = R.weighted([['patrol', 4.5], ['pace', 2.5], ['sentry', room.side ? 3 : 2], ['cam', D.cams && cams < camCap ? 1.4 : 0]]);
        const th = R() * TAU;
        if (kind === 'cam') {
          // on the wall, looking in
          let p = null, face = 0;
          for (let s = 0; s < 12 && !p; s++) {
            const a = R() * TAU, e = extent(room, a), q = { x: room.c.x + Math.cos(a) * (e - 6), y: room.c.y + Math.sin(a) * (e - 6) };
            const inward = { x: room.c.x + Math.cos(a) * (e - 30), y: room.c.y + Math.sin(a) * (e - 30) };
            if (field.sample(inward.x, inward.y) < 16 || !okHome(q) || !farFromStart(q, 380)) continue;
            if (field.sample(q.x, q.y) < -2 || field.sample(q.x, q.y) > 8) continue;
            p = q; face = a + Math.PI;
          }
          if (!p) continue;
          L.cams.push({ x: p.x, y: p.y, base: face, amp: R.range(0.45, 0.85), period: R.range(5, 8), phase: R() * TAU });
          homes.push(p); cams++; k++;
          continue;
        }
        if (kind === 'sentry') {
          const a = R() * TAU, e = extent(room, a);
          const p = field.nearestFree(room.c.x + Math.cos(a) * e * 0.7, room.c.y + Math.sin(a) * e * 0.7, 16, 50);
          if (!okHome(p)) continue;
          const face = Math.atan2(room.c.y - p.y, room.c.x - p.x) + R.range(-0.4, 0.4);
          L.guards.push({ kind: 'sentry', x: p.x, y: p.y, ang: face, amp: R.range(0.55, 1.05) });
          homes.push(p); k++;
          continue;
        }
        let way = [];
        if (kind === 'patrol' && n >= 4 && ways.length && R.chance(0.25)) {
          // a beat through a doorway: one stop in this room, one in the next, so the door is watched
          const c = R.pick(ways), d = c.dirFrom(room);
          for (const sgn of [-1, 1]) {
            const e = R.range(70, 110), p = field.nearestFree(c.mouth.x + d.x * e * sgn, c.mouth.y + d.y * e * sgn, 16, 50);
            if (p) way.push({ x: p.x, y: p.y, pause: R.range(0.8, 1.8), look: R.range(0.7, 1.2) });
          }
          if (way.length < 2 || Math.hypot(way[0].x - way[1].x, way[0].y - way[1].y) < 100) continue;
        } else if (kind === 'patrol') {
          const K = R.int(3, 5);
          for (let i = 0; i < K; i++) {
            const a = th + i * TAU / K + R.range(-0.3, 0.3), e = extent(room, a) * R.range(0.45, 0.72);
            const p = field.nearestFree(room.c.x + Math.cos(a) * e, room.c.y + Math.sin(a) * e, 16, 60);
            if (p && way.every(w => Math.hypot(w.x - p.x, w.y - p.y) > 50)) way.push({ x: p.x, y: p.y, pause: R.chance(0.6) ? R.range(0.4, 1.4) : 0, look: R.range(0.5, 1.1) });
          }
          if (way.length < 3) continue;
        } else {
          const e = extent(room, th) * 0.62, e2 = extent(room, th + Math.PI) * 0.62;
          const a = field.nearestFree(room.c.x + Math.cos(th) * e, room.c.y + Math.sin(th) * e, 16, 50);
          const b = field.nearestFree(room.c.x - Math.cos(th) * e2, room.c.y - Math.sin(th) * e2, 16, 50);
          if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 90) continue;
          way = [{ x: a.x, y: a.y, pause: R.range(0.8, 1.8), look: R.range(0.6, 1.2) }, { x: b.x, y: b.y, pause: R.range(0.8, 1.8), look: R.range(0.6, 1.2) }];
        }
        const path = route(way, true);
        if (!path) continue;
        let len = 0; for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; len += Math.hypot(b.x - a.x, b.y - a.y); }
        if (len > loopLen(way) * 1.7 + 60) continue;   // a route that wanders off to get round something
        // start somewhere along it, away from the entrance
        const si = R.int(0, path.length - 1), sp = path[si];
        if (!okHome(sp) || path.some(q => !farFromStart(q, 200))) continue;
        const prev = path[(si - 1 + path.length) % path.length];
        L.guards.push({ kind, x: sp.x, y: sp.y, ang: Math.atan2(sp.y - prev.y, sp.x - prev.x), path, pi: si });
        homes.push(sp); k++;
      }
    }
  }

  root.LEVEL = { generate, difficulty, Field, Nav, KEY_COLORS };
  if (typeof module !== 'undefined') module.exports = root.LEVEL;
})(typeof window !== 'undefined' ? window : globalThis);
