// Floors: generation, the distance field everything collides and sees against, and the nav grid
// guards path on. A floor is a chain of rooms from the stairs you came up to the stairs going on,
// with a side room or two off it, built from circles, rectangles and halls, and furnished in one of
// a dozen styles. Same seed, same floor.
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
      detect: Math.min(0.85 + n * 0.06, 1.55),
      cams: n >= 3,
      keys: n < 2 ? 0 : n < 5 ? 1 : 2,
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

  function extent(room, a) {
    if (room.kind === 'circle') return room.r;
    const lx = Math.cos(a - room.ang), ly = Math.sin(a - room.ang);
    return Math.min(Math.abs(lx) > 1e-6 ? room.w / 2 / Math.abs(lx) : Infinity, Math.abs(ly) > 1e-6 ? room.h / 2 / Math.abs(ly) : Infinity);
  }

  function makeRoom(R, kind, heading, n) {
    const room = { kind, ang: heading, excl: [], spots: [] };
    if (kind === 'circle') room.r = R.range(150, 230 + Math.min(n, 6) * 8);
    else if (kind === 'big') { room.kind = 'circle'; room.r = R.range(300, 350); room.big = true; }
    else if (kind === 'rect') { room.w = R.range(250, 400); room.h = R.range(240, 380); }
    else if (kind === 'hall') { room.kind = 'rect'; room.hall = true; room.w = R.range(320, 470); room.h = R.range(118, 150); }
    else if (kind === 'side') {
      if (R.chance(0.55)) { room.kind = 'circle'; room.r = R.range(95, 135); }
      else { room.kind = 'rect'; room.w = R.range(160, 220); room.h = R.range(150, 210); }
    }
    room.R = room.kind === 'circle' ? room.r : Math.hypot(room.w, room.h) / 2;
    return room;
  }
  function placeRoom(room, x, y) {
    room.c = { x, y };
    room.shape = room.kind === 'circle' ? U.circle(x, y, room.r) : U.rect(x, y, room.w, room.h, room.ang);
  }
  // a uniformly random point in a room
  function inRoom(R, room, frac) {
    frac = frac || 1;
    if (room.kind === 'circle') { const a = R() * TAU, d = Math.sqrt(R()) * room.r * frac; return { x: room.c.x + Math.cos(a) * d, y: room.c.y + Math.sin(a) * d }; }
    const u = (R() - 0.5) * room.w * frac, v = (R() - 0.5) * room.h * frac, c = Math.cos(room.ang), s = Math.sin(room.ang);
    return { x: room.c.x + u * c - v * s, y: room.c.y + u * s + v * c };
  }

  function tryGen(seed, n) {
    const R = U.rng(seed), D = difficulty(n);
    const L = { n, D, floor: [], obs: [], doors: [], shades: [], guards: [], cams: [], keys: [], stars: [], rooms: [], conns: [] };
    const tilt = R.range(-0.45, 0.45), base = -Math.PI / 2 + tilt;

    // the chain
    const kinds = () => R.weighted([['circle', 5], ['rect', 3], ['hall', 1.6], ['big', n >= 3 ? 1.1 : 0.4]]);
    let heading = base;
    const r0 = makeRoom(R, R.chance(0.6) ? 'circle' : 'rect', heading, n);
    placeRoom(r0, 0, 0); r0.main = true; r0.idx = 0; L.rooms.push(r0);
    let bigs = 0;
    for (let i = 1; i < D.rooms; i++) {
      const prev = L.rooms[L.rooms.length - 1];
      let ok = false;
      for (let t = 0; t < 30 && !ok; t++) {
        let kind = kinds();
        if (kind === 'big' && bigs >= 1) kind = 'circle';
        if (prev.hall && kind === 'hall') kind = 'rect';
        const a = base + U.clamp(U.angDiff(base, heading) + R.range(-0.95, 0.95), -1.15, 1.15);
        const room = makeRoom(R, kind, a, n);
        let lens = prev.kind === 'circle' && room.kind === 'circle' && R.chance(0.6);
        let d;
        if (lens) d = (prev.r + room.r) * R.range(0.76, 0.86);
        else d = extent(prev, a) + extent(room, a + Math.PI) + R.range(36, 100);
        const x = prev.c.x + Math.cos(a) * d, y = prev.c.y + Math.sin(a) * d;
        if (lens && d < Math.abs(prev.r - room.r) + 60) continue;
        let clash = false;
        for (const o of L.rooms) {
          if (o === prev) continue;
          if (Math.hypot(o.c.x - x, o.c.y - y) < o.R + room.R + 34) { clash = true; break; }
        }
        if (clash) continue;
        placeRoom(room, x, y);
        room.main = true; room.idx = i; room.lens = lens;
        if (room.big) bigs++;
        L.rooms.push(room); heading = a; ok = true;
      }
      if (!ok) return null;
    }
    const main = L.rooms.slice();

    // side rooms, off to one side of the chain
    for (let k = 0; k < D.sides; k++) {
      for (let t = 0; t < 30; t++) {
        const host = main[R.int(0, main.length - 2)];
        const nxt = main[host.idx + 1];
        const fwd = Math.atan2(nxt.c.y - host.c.y, nxt.c.x - host.c.x);
        const a = fwd + (R.chance(0.5) ? 1 : -1) * Math.PI / 2 + R.range(-0.5, 0.5);
        const room = makeRoom(R, 'side', a, n);
        const d = extent(host, a) + extent(room, a + Math.PI) + R.range(30, 80);
        const x = host.c.x + Math.cos(a) * d, y = host.c.y + Math.sin(a) * d;
        let clash = false;
        for (const o of L.rooms) {
          const gap = o === host ? -Infinity : 40;
          if (Math.hypot(o.c.x - x, o.c.y - y) < o.R + room.R + gap) { clash = true; break; }
          // the corridor's middle shouldn't run through another room
          const mx = host.c.x + Math.cos(a) * (extent(host, a) + d * 0.1), my = host.c.y + Math.sin(a) * (extent(host, a) + d * 0.1);
          if (o !== host && Math.hypot(o.c.x - mx, o.c.y - my) < o.R + 40) { clash = true; break; }
        }
        if (clash) continue;
        placeRoom(room, x, y);
        room.side = true; room.host = host; room.idx = host.idx;
        L.rooms.push(room);
        break;
      }
    }

    for (const r of L.rooms) L.floor.push(r.shape);

    // connections
    const connect = (A, B) => {
      const conn = { a: A, b: B };
      if (A.kind === 'circle' && B.kind === 'circle' && B.lens && !B.side) {
        const dx = B.c.x - A.c.x, dy = B.c.y - A.c.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
        const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A.r * A.r - a * a));
        const mx = A.c.x + ux * a, my = A.c.y + uy * a, px = -uy, py = ux;
        const p1 = { x: mx + px * h, y: my + py * h }, p2 = { x: mx - px * h, y: my - py * h };
        const len = 2 * h, gw = 48, gc = R.range(0.3, 0.7) * len;
        const at = (s) => ({ x: p1.x + (p2.x - p1.x) * s / len, y: p1.y + (p2.y - p1.y) * s / len });
        const g0 = at(gc - gw / 2), g1 = at(gc + gw / 2);
        const e1 = at(-26), e2 = at(len + 26);
        conn.walls = [U.seg(e1.x, e1.y, g0.x, g0.y, 10, 0), U.seg(g1.x, g1.y, e2.x, e2.y, 10, 0)];
        conn.mouth = at(gc); conn.normal = { x: ux, y: uy }; conn.width = gw;
        conn.doorShape = U.seg(g0.x, g0.y, g1.x, g1.y, 8, 5);
        conn.kind = 'lens';
      } else {
        const ang = Math.atan2(B.c.y - A.c.y, B.c.x - A.c.x), ux = Math.cos(ang), uy = Math.sin(ang);
        const ea = extent(A, ang), eb = extent(B, ang + Math.PI);
        const pa = { x: A.c.x + ux * ea, y: A.c.y + uy * ea }, pb = { x: B.c.x - ux * eb, y: B.c.y - uy * eb };
        const cw = R.range(54, 70);
        conn.corr = U.seg(pa.x, pa.y, pb.x, pb.y, cw, 26);
        L.floor.push(conn.corr);
        conn.mouth = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
        conn.ends = [pa, pb]; conn.normal = { x: ux, y: uy }; conn.width = cw;
        conn.doorShape = U.seg(conn.mouth.x - uy * (cw / 2 + 8), conn.mouth.y + ux * (cw / 2 + 8), conn.mouth.x + uy * (cw / 2 + 8), conn.mouth.y - ux * (cw / 2 + 8), 9, 0);
        conn.kind = 'corr';
      }
      // keep the way through clear of furniture, on both sides
      const m = conn.mouth, nx = conn.normal.x, ny = conn.normal.y;
      const pts = conn.kind === 'lens' ? [{ x: m.x - nx * 30, y: m.y - ny * 30 }, m, { x: m.x + nx * 30, y: m.y + ny * 30 }] : [conn.ends[0], conn.ends[1]];
      for (const p of pts) { A.excl.push({ x: p.x, y: p.y, r: 58 }); B.excl.push({ x: p.x, y: p.y, r: 58 }); }
      conn.dirFrom = (room) => room === A ? { x: nx, y: ny } : { x: -nx, y: -ny };
      L.conns.push(conn);
      return conn;
    };
    for (let i = 1; i < main.length; i++) main[i].inConn = main[i - 1].outConn = connect(main[i - 1], main[i]);
    for (const r of L.rooms) if (r.side) r.inConn = connect(r.host, r);
    for (const c of L.conns) if (c.walls) for (const w of c.walls) L.obs.push(w);

    // entrance and exit, at the far ends of the first and last rooms
    const farEnd = (room, conn, k) => {
      const m = conn.mouth;
      let dx = room.c.x - m.x, dy = room.c.y - m.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const e = extent(room, Math.atan2(dy, dx));
      return { x: room.c.x + dx * e * k, y: room.c.y + dy * e * k };
    };
    L.entrance = farEnd(main[0], main[0].outConn, 0.6);
    L.exit = farEnd(main[main.length - 1], main[main.length - 1].inConn, 0.58);
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

    // hiding spots: pools of deep shadow tucked against walls
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
        if (!navOpen.reach(L.entrance.x, L.entrance.y, p.x, p.y)) continue;
        L.shades.push({ x: p.x, y: p.y, r: R.range(19, 24), rot: R() * TAU });
        got++;
      }
    }

    // guards and cameras
    placeGuards(R, L, field, navClosed, n);
    if (n >= 2 && L.guards.length < 2) return null;

    L.field = field;
    L.nav = navClosed;
    return L;
  }

  // ── furniture ──────────────────────────────────────────────
  function furnish(R, L, room, n) {
    const others = L.floor.filter(s => s !== room.shape);
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
      const style = room.side ? R.weighted([['jut', 2], ['pillar', 2], ['ring', r > 115 ? 1 : 0], ['bare', 1]])
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
          put(U.seg(p0.x, p0.y, p1.x, p1.y, 10, 1.6));
        }
        room.spots.push({ x: c.x, y: c.y });
        if (style === 'ringspokes') {
          const k = R.int(4, 6), off = R() * TAU;
          for (let i = 0; i < k; i++) {
            const a = off + i * TAU / k;
            if (gaps.some(g => Math.abs(U.angDiff(g, a)) < 0.35)) continue;
            const p0 = polar(a, ri + 50), p1 = polar(a, r + 14);
            if (!put(U.seg(p0.x, p0.y, p1.x, p1.y, 10, 0))) { const p2 = polar(a, r * 0.86); put(U.seg(p0.x, p0.y, p2.x, p2.y, 10, 0)); }
          }
        }
      } else if (style === 'spokes') {
        const k = R.int(5, 8), ri = r * R.range(0.34, 0.42), off = R() * TAU;
        for (let i = 0; i < k; i++) {
          const a = off + i * TAU / k, p0 = polar(a, ri), p1 = polar(a, r + 14);
          if (!put(U.seg(p0.x, p0.y, p1.x, p1.y, 10, 0))) { const p2 = polar(a, r * 0.8); if (!put(U.seg(p0.x, p0.y, p2.x, p2.y, 10, 0))) continue; }
          if (R.chance(0.45)) { const t = a + Math.PI / 2 * (R.chance(0.5) ? 1 : -1), l = R.range(28, 48); put(U.seg(p0.x, p0.y, p0.x + Math.cos(t) * l, p0.y + Math.sin(t) * l, 10, 5)); }
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
          const a = off + i * TAU / k + R.range(-0.3, 0.3), p0 = polar(a, r + 14), p1 = polar(a, r * R.range(0.5, 0.7));
          if (!put(U.seg(p0.x, p0.y, p1.x, p1.y, 10, 0))) continue;
          if (R.chance(0.55)) { const t = a + Math.PI / 2 * (R.chance(0.5) ? 1 : -1), l = R.range(30, 56); put(U.seg(p1.x, p1.y, p1.x + Math.cos(t) * l, p1.y + Math.sin(t) * l, 10, 5)); }
          room.spots.push(polar(a + Math.PI / k, r * 0.68));
        }
      } else if (style === 'pillar') {
        put(U.rect(c.x, c.y, r * 0.3, r * 0.3, th));
        room.spots.push(W(r * 0.55, 0));
      }
    } else {
      // rectangles and halls, in their own frame: u along, v across
      const hw = room.w / 2, hh = room.h / 2, cs = Math.cos(room.ang), sn = Math.sin(room.ang);
      const W = (u, v) => ({ x: c.x + u * cs - v * sn, y: c.y + u * sn + v * cs });
      const segUV = (u0, v0, u1, v1, t, e) => { const a = W(u0, v0), b = W(u1, v1); return U.seg(a.x, a.y, b.x, b.y, t || 10, e || 0); };
      const style = room.hall ? R.weighted([['hcolumns', 2], ['chicane', 2], ['stubs', 1.5]])
        : room.side ? R.weighted([['grid', 1], ['cubicles', 1.5], ['bare', 1]])
        : R.weighted([['grid', 2.5], ['cubicles', 2.5], ['columns', 2], ['partition', 2], ['scatter', 2]]);
      room.style = style;
      if (style === 'grid') {
        const nx = room.w > 330 ? R.int(2, 3) : 2, ny = 2, s = R.range(32, 50), a2 = room.ang + (R.chance(0.25) ? Math.PI / 4 : 0);
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const p = W((-hw + (i + 0.5) * room.w / nx) * 0.8, (-hh + (j + 0.5) * room.h / ny) * 0.75);
          put(U.rect(p.x, p.y, s, s * R.range(0.8, 1.2), a2));
        }
        room.spots.push({ x: c.x, y: c.y });
      } else if (style === 'cubicles') {
        const depth = Math.min(R.range(56, 84), room.h * 0.32), step = R.range(68, 92);
        const sides = R.chance(0.5) ? [-1, 1] : [R.chance(0.5) ? -1 : 1];
        for (const sd of sides) {
          for (let u = -hw + step * 0.75; u < hw - 30; u += step) {
            put(segUV(u, sd * (hh + 14), u, sd * (hh - depth)));
            room.spots.push(W(u + step / 2, sd * (hh - depth * 0.5)));
          }
        }
        if (sides.length === 1 && room.h > 260) for (let t = 0, k = 0; t < 12 && k < 2; t++) { const p = W(R.range(-hw, hw) * 0.6, -sides[0] * hh * 0.35); if (put(U.rect(p.x, p.y, R.range(30, 50), R.range(30, 50), room.ang), 44)) k++; }
      } else if (style === 'columns' || style === 'hcolumns') {
        const pr = R.range(9, 12), rows = style === 'hcolumns' ? [0] : [-0.42, 0.42], step = R.range(46, 60);
        for (const rv of rows) for (let u = -hw + 40; u <= hw - 40; u += step) { const p = W(u, rv * hh + (style === 'hcolumns' ? R.range(-12, 12) : 0)); put(U.circle(p.x, p.y, pr)); }
      } else if (style === 'partition') {
        const v = R.range(-0.18, 0.18) * hh, gaps = [R.range(-0.6, -0.15) * hw, R.range(0.15, 0.6) * hw], gw = 26;
        let u0 = -hw - 14;
        for (const g of gaps) { if (g - gw - u0 > 12) put(segUV(u0, v, g - gw, v)); u0 = g + gw; }
        put(segUV(u0, v, hw + 14, v));
        for (const sd of [-1, 1]) if (R.chance(0.6)) { const p = W(R.range(-0.5, 0.5) * hw, v + sd * (hh * 0.55)); put(U.rect(p.x, p.y, R.range(30, 46), R.range(26, 40), room.ang), 40); }
      } else if (style === 'scatter') {
        const m = R.int(3, 6), aa = R.chance(0.6) ? room.ang : null;
        for (let t = 0, k = 0; t < 50 && k < m; t++) { const p = inRoom(R, room, 0.8); if (put(U.rect(p.x, p.y, R.range(26, 86), R.range(18, 56), aa === null ? R() * TAU : aa), 40)) k++; }
      } else if (style === 'chicane') {
        const step = R.range(90, 120); let sd = R.chance(0.5) ? 1 : -1;
        for (let u = -hw + step * 0.8; u < hw - step * 0.5; u += step) { put(segUV(u, sd * (hh + 14), u, sd * (hh - room.h * 0.58))); sd = -sd; }
      } else if (style === 'stubs') {
        for (let u = -hw + 70; u < hw - 50; u += R.range(70, 100)) { const p = W(u, R.range(-0.2, 0.2) * hh); put(U.rect(p.x, p.y, R.range(20, 34), R.range(20, 34), room.ang + R.range(-0.3, 0.3))); }
      }
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
      for (let k = 0, t = 0; k < count && t < 14; t++) {
        const kind = R.weighted([['patrol', 4.5], ['pace', 2.5], ['sentry', room.side ? 3 : 2], ['cam', D.cams && cams < 1 ? 1.4 : 0]]);
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
        if (kind === 'patrol') {
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
