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
      rooms: n <= 1 ? 3 : n <= 3 ? 4 : n <= 5 ? 5 : n <= 8 ? 6 : n <= 12 ? 7 : n <= 16 ? 8 : 9,   // the building keeps getting bigger as you climb
      sides: n <= 1 ? 1 : n <= 4 ? 1 : 2,
      density: Math.min(0.9 + n * 0.1, 2.6),   // keeps rising to the twenty-fourth floor: more guards a room, not just more rooms
      coneLen: Math.min(132 + n * 5, 190),
      fov: 0.6 + U.clamp((n - 12) / 3, 0, 1) * 0.1,   // wider eyes past the twelfth floor
      patrol: Math.min(38 + n * 1.2, 46),   // a silent sneak (about 60) stays at least 1.25x a walker on every floor, so you can slip past or trail one
      // a sprint (128) is about 1.25x a chaser on the first floors, so a corner loses them; from the eighth they close
      // in on it, to 0.875 of a sprint from the tenth, so a '!' upstairs is a real chase but one corner still breaks it
      chase: n >= 8 ? Math.min(90 + n * 2.2, 112) : Math.min(90 + n * 1.5, 104),
      detect: Math.min(0.6 + n * 0.025, 0.9),
      cams: n >= 3,
      keys: n < 2 ? 0 : n < 5 ? 1 : n < 9 ? 2 : n < 16 ? 3 : 4,
      hear: n >= 17 ? 165 : 140,
      // past the twelfth floor the rest stops growing, so a new pressure arrives every few floors:
      snap: n >= 13,        // sentries whose heads whip round
      camPairs: n >= 10,    // cameras in pairs across a room, sweeping in counterpoint
      budget: n >= 10 ? Math.min(15 + Math.floor((n - 10) / 2), 19) : 13,   // and more of them, one more every two floors from the tenth (with sharper ears from the seventeenth)
    };
  }

  // how many guards a floor has room for: it climbs with the floor and with the building's own size, so a
  // bigger floor upstairs is never a thinner one, and the share of it that must still watch once the checks
  // are done (70%, or 50% for a floor let through late)
  function watchBudget(L, n) {
    const area = L.rooms.reduce((t, r) => t + (r.kind === 'circle' ? Math.PI * r.r * r.r : r.w * r.h), 0);
    const fit = Math.max(2, Math.min(L.D.budget, Math.round((n <= 4 ? 3 : 4) + n * 0.8), Math.round(area / 100000 * (0.9 + 0.03 * n))));
    // and a height floor that doesn't hang on the plan's size, so no kind of building is a soft floor in the climb
    return Math.max(fit, Math.min(L.D.budget, Math.round(2 + 0.75 * n)));
  }
  // the least a floor may keep: 70% of its budget (50% let through late), and never under one watcher per
  // floor-and-a-third climbed, plus two (five on the fourth, eight on the eighth, eleven on the twelfth; one fewer late)
  const watchFloor = (budget, n, loose) => n >= 3 ? Math.max(U.clamp(Math.round((loose ? 0.5 : 0.7) * budget), 3, loose ? 8 : 12), Math.min(budget, Math.round(0.75 * n + (loose ? 1 : 2)))) : 0;
  // cameras: one from the third floor, and one more each three floors (five at most), so each band of floors adds a watched lane
  const camFloor = (n) => n >= 3 ? Math.min(5, 1 + Math.floor((n - 3) / 3)) : 0;
  // the mix: posts never outnumber their share of the walkers (four to five), and the walkers keep climbing, about
  // four on the fifth floor, six on the ninth, seven on the twelfth, nine at most
  const sentryCap = (walkers) => Math.max(2, Math.ceil(0.8 * walkers));
  const walkFloor = (n) => n >= 3 ? Math.min(9, Math.round(2 + 0.45 * n)) : 0;

  const KEY_COLORS = [
    { name: 'red', c: '#e2483d' },
    { name: 'yellow', c: '#e9c53e' },
    { name: 'violet', c: '#8c5fe0' },
    { name: 'green', c: '#3fbf6a' },
  ];

  // ── generation ─────────────────────────────────────────────
  // prev: the kinds of the floors below, nearest first (or just the one below), so the building
  // changes shape as you climb; LEVEL.history(runSeed, n) gives it for a run
  function generate(seed, n, prev) {
    const kind = pickKind(seed, n, prev);
    for (let attempt = 0; attempt < 40; attempt++) {
      // after eight goes a floor only has to meet a lower bar (half its budget, one camera), rather than a long wait
      const L = tryGen(U.hash(seed, attempt), n, kind, attempt >= 8);
      if (L) { L.attempts = attempt + 1; L.seed = seed; return L; }
    }
    throw new Error('no floor for seed ' + seed);
  }

  // ── the building ───────────────────────────────────────────
  // A floor is a building of one or more masses joined by narrow halls. A mass is laid out round
  // its own centre — a disc (a hub and one or two rings), a crescent wing (one or two bands round
  // an empty court, curved or built of straight-sided blocks), a nautilus, a lone round room — or
  // square-built in its own turned frame: a block of rooms on a grid, a wing of rooms off a long
  // hall, a small tower. Each zone is a cell of its mass's grid, { a0, a1, r0, r1 } or
  // { u0, u1, v0, v1 }. Zones of one mass that touch share a thick wall; masses meet only through
  // a hall (a 'neck', itself a zone) with a doorway at each end. Only the walls on the route get a
  // door gap, so the zones make a tree and a locked door can't be walked round. Outer edges step in
  // and out zone by zone and are bitten into, so no two floors share an outline.
  const WALL = 16, PART = 14, GAP = 52, HW = WALL / 2;
  const chord = (r) => Math.min(90, Math.sqrt(9 * r));   // arcs are laid in chords that sag about a unit
  const dir = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
  const turn = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; };

  // The building's kind is drawn on its own, before the plan, from the floors below: never the
  // same kind twice running, and never a tenth floor that leaves ten in a row with under four.
  const KINDS = ['disc', 'crescent', 'nautilus', 'block', 'wing', 'cluster', 'twin'], ROUND = new Set(['disc', 'crescent', 'nautilus']);
  function pickKind(seed, n, hist) {
    hist = hist == null ? [] : typeof hist === 'string' ? [hist] : hist;
    const R = U.rng(U.hash(seed, 0x6b1d)), last9 = new Set(hist.slice(0, 9));
    const crowded = hist.length >= 9 && last9.size <= 3;
    // the round kinds lead: a square-built floor is the odd one out, now and then, not every other floor
    const w = { disc: 1.2, crescent: 1.15, nautilus: n >= 2 ? 1.1 : 0.4, block: 0.6, wing: n >= 2 ? 0.6 : 0, cluster: 1.25, twin: n >= 3 ? 0.7 : 0 };
    // and the round family (disc, crescent, nautilus) is never more than two of any four floors running
    const roundFull = hist.slice(0, 3).filter(k => ROUND.has(k)).length >= 2;
    return R.weighted(KINDS.map(k => [k, k === hist[0] || (crowded && last9.has(k)) || (roundFull && ROUND.has(k)) ? 0 : w[k]]));
  }
  // the kinds of a run's floors below n, nearest first, for generate()
  const kindMemo = new Map();
  function history(runSeed, n) {
    let ks = kindMemo.get(runSeed);
    if (!ks) { ks = [null]; kindMemo.set(runSeed, ks); }
    for (let k = ks.length; k < n; k++) ks.push(pickKind(U.hash(runSeed, k), k, ks.slice(1, k).reverse()));
    return ks.slice(1, n).reverse();
  }

  // ── masses ──
  // A mass round a centre, of k zones. Its zones carry absolute angles, so turning it turns them.
  function polarPod(R, k, kind, AZ, opt) {
    opt = opt || {};
    const rot = R() * TAU, pod = { type: 'polar', kind, o: { x: 0, y: 0 }, rot, span: TAU, hub: 0, colR: null, zones: [] }, zones = pod.zones;
    const split = (m, span, j) => { const w = []; let s = 0; for (let i = 0; i < m; i++) { w.push(R.range(1 - j, 1 + j)); s += w[i]; } return w.map(v => v / s * span); };
    // cut a band unevenly: a narrow sliver beside a wide hall, never a run of even slices. No cut is
    // under about 130 of wall at the band's inner edge (so a doorway still fits) or over about 100 degrees
    const vary = (m, span, rIn) => {
      const lo = Math.min(Math.max(130 / Math.max(rIn, 1), 0.3), span / m * 0.8), hi = Math.max(1.75, span / m * 1.2);
      let w = []; for (let i = 0; i < m; i++) { const u = R(); w.push(u < 0.28 ? R.range(0.3, 0.55) : u < 0.78 ? R.range(0.8, 1.25) : R.range(1.6, 2.3)); }
      const s0 = w.reduce((a, b) => a + b, 0); w = w.map(v => v / s0 * span);
      for (let t = 0; t < 12; t++) {
        const fix = w.map(v => v < lo ? lo : v > hi ? hi : null), freeSum = w.reduce((a, v, i) => a + (fix[i] == null ? v : 0), 0), fixSum = fix.reduce((a, v) => a + (v == null ? 0 : v), 0);
        if (fix.every(v => v == null) || freeSum <= 0) break;
        w = w.map((v, i) => fix[i] != null ? fix[i] : v * (span - fixSum) / freeSum);
      }
      return w;
    };
    const band = (ws, a0, r0, r1, outer) => { let a = a0; for (const w of ws) { zones.push({ a0: a, a1: a + w, r0, r1, outer }); a += w; } };
    let hub = 0;
    if (kind === 'solo') hub = Math.sqrt(AZ * R.range(0.9, 1.7) / Math.PI);
    else if (kind === 'disc') {
      const K = Math.max(2, k - 1), small = K <= 3, az = small ? AZ * 1.25 : AZ;
      hub = small ? R.range(110, 135) : R.range(150, 185);
      if (K <= 5) band(vary(K, TAU, hub), rot, hub, Math.sqrt(K * az / Math.PI + hub * hub), true);
      else if (K >= 9) {
        // a rotunda: three rings round the hub, each cut finer than the one inside it, so the spokes of
        // one ring never line up with the next and the walls read as nested cells
        const k1 = 3, k2 = Math.max(4, Math.round((K - 3) * 0.42)), k3 = K - k1 - k2;
        const ra = Math.max(hub + 165, Math.sqrt(k1 * AZ * 0.75 / Math.PI + hub * hub)), rb = Math.max(ra + 170, Math.sqrt(k2 * AZ * 0.9 / Math.PI + ra * ra)), rc = Math.max(rb + 175, Math.sqrt(k3 * AZ * 1.05 / Math.PI + rb * rb));
        band(vary(k1, TAU, hub), rot, hub, ra, false); band(vary(k2, TAU, ra), rot + R.range(0.3, 0.6), ra, rb, false); band(vary(k3, TAU, rb), rot + R.range(0.1, 0.25), rb, rc, true);
      } else {
        const k1 = Math.max(3, Math.round(K * 0.38)), k2 = K - k1;
        const rm = Math.sqrt(k1 * AZ * 0.85 / Math.PI + hub * hub), ro = Math.sqrt(k2 * AZ * 1.1 / Math.PI + rm * rm);
        band(vary(k1, TAU, hub), rot, hub, rm, false); band(vary(k2, TAU, rm), rot + R.range(0.2, 0.5), rm, ro, true);
      }
    } else if (kind === 'crescent') {
      const span = pod.span = R.range(3.9, 4.9), ri = pod.ri = R.range(170, 230);
      pod.facet = !!opt.facet;
      if (pod.facet && k >= 6) {
        // two bands of straight-sided blocks, each outer block squarely on an inner one
        const m = Math.round(k / 2), ws = vary(m, span, ri);
        const rm = Math.sqrt(2 * m * AZ * 0.8 / span + ri * ri), ro = Math.sqrt(2 * m * AZ * 1.1 / span + rm * rm);
        band(ws, rot, ri, rm, false); band(ws, rot, rm, ro, true);
      } else if (k <= 5 || pod.facet) band(vary(k, span, ri), rot, ri, Math.sqrt(2 * k * AZ / span + ri * ri), true);
      else {
        const k1 = Math.max(2, Math.round(k / 3)), k2 = k - k1;
        const rm = Math.sqrt(2 * k1 * AZ * 0.8 / span + ri * ri), ro = Math.sqrt(2 * k2 * AZ * 1.1 / span + rm * rm);
        band(vary(k1, span, ri), rot, ri, rm, false); band(vary(k2, span, rm), rot, rm, ro, true);
      }
    } else {
      // a coil: the wedges grow round the turn from a shallow lip to a deep tail, so the outline winds out
      // like a shell; on the bigger floors a ring of three rooms wraps the hub inside the coil, as in a real one
      const ring = k >= 9, nSplit = ring ? (k >= 12 ? 1 : 0) : k >= 11 ? 3 : k >= 8 ? 2 : k >= 6 ? 1 : 0;
      const K = Math.max(3, k - 1 - nSplit - (ring ? 3 : 0)), ws = split(K, TAU, 0.35).sort((p, q) => q - p);   // wide and shallow at the lip, narrow and deep at the tail
      let r0 = hub = ring ? R.range(125, 145) : Math.max(R.range(140, 170), 172 * K / TAU);   // wide enough that every wedge meets it along a doorway's length
      if (ring) { r0 = Math.max(hub + R.range(165, 190), 172 * K / TAU / 0.85); band(vary(3, TAU, hub), rot + R.range(0.4, 1.2), hub, r0, false); }
      let a = rot;
      for (let i = 0; i < K; i++) {
        const t = i / Math.max(1, K - 1), big = i >= K - nSplit, area = AZ * (0.26 + 2.7 * Math.pow(t, 1.6)) * (big ? 2 : 1);
        const r1 = Math.max(r0 + 175, Math.sqrt(2 * area / ws[i] + r0 * r0));
        if (big) { const rm = Math.sqrt((r1 * r1 + r0 * r0) / 2); zones.push({ a0: a, a1: a + ws[i], r0, r1: rm }, { a0: a, a1: a + ws[i], r0: rm, r1, outer: true }); }
        else zones.push({ a0: a, a1: a + ws[i], r0, r1, outer: true });
        a += ws[i];
      }
      pod.coreR = r0;
    }
    // a coiled disc or a crescent bent into a J: the outer band deepens zone by zone round the turn, so
    // the figure winds out from a shallow lip to a deep head rather than closing as an even ring
    const coil = opt.coil && (kind === 'disc' || kind === 'crescent') && zones.filter(z => z.outer).length >= 3;
    if (coil) {
      const outer = zones.filter(z => z.outer).sort((p, q) => ((p.a0 - rot) % TAU + TAU) % TAU - ((q.a0 - rot) % TAU + TAU) % TAU);
      // the reach is set against the whole radius, so a three-ring rotunda coils as plainly as a small disc
      const rAvg = outer.reduce((t, z) => t + z.r1, 0) / outer.length, lo = R.range(0.8, 0.88), hi = R.range(1.3, 1.42), flip = R.chance(0.5);
      outer.forEach((z, i) => { const t = i / (outer.length - 1); z.r1 = Math.max(z.r0 + 175, rAvg * U.lerp(lo, hi, flip ? 1 - t : t)); });
      pod.coil = true;
    }
    // the outer edge steps in and out zone by zone; a crescent's court edge does too
    if (kind === 'disc' || kind === 'crescent') for (const z of zones) {
      if (z.outer && R.chance(coil ? 0.4 : 0.75)) z.r1 += coil ? R.range(-Math.max(0, Math.min(24, z.r1 - z.r0 - 175)), 24) : R.range(-Math.max(0, Math.min(64, z.r1 - z.r0 - 170)), 64);
      if (kind === 'crescent' && Math.abs(z.r0 - pod.ri) < 1e-6 && R.chance(0.6)) z.r0 += R.range(-40, Math.max(0, Math.min(40, z.r1 - z.r0 - 170)));
    }
    if (hub) { pod.hub = hub; zones.unshift({ hub: true, solo: kind === 'solo', a0: 0, a1: TAU, r0: 0, r1: hub }); }
    // a double row of columns through a short run of zones, so it marks out one grand hall
    if (opt.col && kind !== 'solo') {
      let colR;
      if (kind === 'crescent') { const b = zones[0]; colR = b.outer ? pod.ri + 64 : (pod.ri + b.r1) / 2 - 30; }
      else if (kind === 'nautilus') colR = pod.coreR + 62;
      else colR = zones[zones.length - 1].r0 + 56;
      pod.colR = colR; pod.colGap = R.range(54, 62); pod.colStep = R.range(62, 70);   // far enough apart to slip between
      const ok = zones.filter(z => !z.hub && colR - 40 >= z.r0 && colR + pod.colGap + 40 <= z.r1);
      if (ok.length) { const i0 = R.int(0, ok.length - 1), m = ok.length <= 3 ? 1 : ok.length <= 5 ? 2 : 3; for (let i = 0; i < m; i++) ok[(i0 + i) % ok.length].col = true; }
    }
    pod.rOut = Math.max(...zones.map(z => z.r1));
    for (const z of zones) z.pod = pod;
    return pod;
  }
  function turnPod(pod, d) { pod.rot += d; for (const z of pod.zones) if (!z.hub) { z.a0 += d; z.a1 += d; } }

  // A square-built mass, laid out in its own frame (u, v): a block of rectangular zones on a grid,
  // a cell or two left out to make an L or a T, and on the bigger floors a void court kept open in
  // the middle; its outer sides step in here and there.
  function blockPod(R, Z, AZ, opt) {
    const zones = [], pod = { type: 'rect', kind: 'block', o: { x: 0, y: 0 }, rot: 0, zones };
    let cols, rows, gone = new Set(), court = [];
    const key = (i, j) => i + ',' + j;
    if (Z >= 6 && R.chance(0.8)) {
      if (Z <= 8) { cols = rows = 3; court = [key(1, 1)]; }
      else { cols = 4; rows = 3; court = [key(1, 1), key(2, 1)]; }
    } else {
      const opts = [];
      for (let c = 2; c <= 5; c++) for (let r = 2; r <= 4; r++) { const d = c * r - Z; if (d >= (Z <= 3 ? 0 : 1) && d <= 2 && c >= r) opts.push([c, r]); }
      // (twelve zones has no grid one or two cells over in 5x4, so it fills one exactly)
      [cols, rows] = opts.length ? R.pick(opts) : Z <= 12 ? [4, 3] : [5, 4];
    }
    court.forEach(k => gone.add(k));
    const drop = cols * rows - court.length - Z;
    // drop edge cells, keeping the rest in one piece
    const ok = (set) => {
      const cells = []; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (!set.has(key(i, j))) cells.push([i, j]);
      const seen = new Set([key(...cells[0])]), st = [cells[0]];
      while (st.length) { const [i, j] = st.pop(); for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { const k = key(a, b); if (a >= 0 && b >= 0 && a < cols && b < rows && !set.has(k) && !seen.has(k)) { seen.add(k); st.push([a, b]); } } }
      return seen.size === cells.length;
    };
    for (let t = 0; t < 40; t++) {
      const s = new Set(gone);
      for (let d = 0; d < drop; d++) {
        const edge = []; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (!s.has(key(i, j)) && (i === 0 || j === 0 || i === cols - 1 || j === rows - 1)) edge.push(key(i, j));
        s.add(R.pick(edge));
      }
      if (ok(s)) { gone = s; break; }
    }
    const base = Math.sqrt(AZ);
    let cw = [], rh = [];
    for (let i = 0; i < cols; i++) cw.push(R.range(0.82, 1.2) * base);
    for (let j = 0; j < rows; j++) rh.push(R.range(0.82, 1.2) * base);
    let area = 0; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (!gone.has(key(i, j))) area += cw[i] * rh[j];
    const f = Math.sqrt(Z * AZ / area);
    cw = cw.map(w => U.clamp(w * f, 260, 380)); rh = rh.map(h => U.clamp(h * f, 260, 380));
    const W = cw.reduce((a, b) => a + b, 0), H = rh.reduce((a, b) => a + b, 0);
    for (let i = 0, u = -W / 2; i < cols; u += cw[i], i++) for (let j = 0, v = -H / 2; j < rows; v += rh[j], j++) {
      if (!gone.has(key(i, j))) zones.push({ rect: true, u0: u, u1: u + cw[i], v0: v, v1: v + rh[j] });
    }
    stagger(R, zones, 0.5);
    if (opt && opt.pill) { const big = zones.filter(z => z.u1 - z.u0 >= 250 && z.v1 - z.v0 >= 250); if (big.length) R.pick(big).pill = true; }
    for (const z of zones) z.pod = pod;
    return pod;
  }
  // stagger the outline: an outer side steps in by a bite of 30-70, so long as every wall the
  // zone shares stays long enough for a door
  function stagger(R, zones, p, skip) {
    const sides = zones.map(z => ['u0', 'u1', 'v0', 'v1'].filter(sd => !rectShared(zones, z, sd)));
    const shared = (z) => { const out = []; for (const o of zones) if (o !== z) rectSeams(z, o, out), rectSeams(o, z, out); return out; };
    zones.forEach((z, i) => {
      if (skip && skip(z)) return;
      for (const sd of sides[i]) {
        if (!R.chance(p)) continue;
        const d = R.range(30, 70), sgn = sd[1] === '0' ? 1 : -1, span = sd[0] === 'u' ? z.u1 - z.u0 : z.v1 - z.v0;
        if (span - d < 220) continue;
        const was = z[sd], n0 = shared(z).length;
        z[sd] += sgn * d;
        const now = shared(z);
        if (now.length < n0 || now.some(s => s.q1 - s.q0 < 175)) z[sd] = was;
      }
    });
  }
  // A cross: two broad halls cross at the heart of the block and run on past it as porticoes, so the
  // outline is a cross, with the rooms in the four corners between the arms (a big corner cut in two,
  // a corner left open as a court when there are few rooms). Turned a quarter, it reads as a diagonal spine.
  function crossPod(R, Z, AZ) {
    const zones = [], pod = { type: 'rect', kind: 'block', cross: true, o: { x: 0, y: 0 }, rot: 0, zones };
    const h = R.range(120, 140), base = Math.sqrt(AZ), q = () => U.clamp(R.range(0.85, 1.3) * base, 250, 420);
    const qa = [q(), q()], qb = [q(), q()];   // the corners' reach left and right of the crossing, and above and below
    const ext = [0, 1, 2, 3].map(() => R.chance(0.75) ? R.range(60, 170) : 0);
    const hc = h / 2, U0 = -hc - qa[0], U1 = hc + qa[1], V0 = -hc - qb[0], V1 = hc + qb[1];
    zones.push({ rect: true, corr: true, u0: -hc, u1: hc, v0: -hc, v1: hc });
    zones.push({ rect: true, corr: true, u0: U0 - ext[0], u1: -hc, v0: -hc, v1: hc }, { rect: true, corr: true, u0: hc, u1: U1 + ext[1], v0: -hc, v1: hc });
    zones.push({ rect: true, corr: true, u0: -hc, u1: hc, v0: V0 - ext[2], v1: -hc }, { rect: true, corr: true, u0: -hc, u1: hc, v0: hc, v1: V1 + ext[3] });
    const corners = [[U0, -hc, V0, -hc], [hc, U1, V0, -hc], [U0, -hc, hc, V1], [hc, U1, hc, V1]];
    let rooms = Math.max(3, Z - 5);
    const order = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = R.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
    const keep = order.slice(0, Math.min(4, rooms));
    let splits = Math.max(0, rooms - keep.length);
    for (const ci of keep) {
      const [u0, u1, v0, v1] = corners[ci], w = u1 - u0, d = v1 - v0;
      if (splits > 0 && Math.max(w, d) >= 380) {
        splits--;
        // cut square to the long side, never leaving a room thinner than a doorway's wall
        if (w >= d) { const m = U.lerp(u0 + 180, u1 - 180, R.range(0.3, 0.7)); zones.push({ rect: true, u0, u1: m, v0, v1 }, { rect: true, u0: m, u1, v0, v1 }); }
        else { const m = U.lerp(v0 + 180, v1 - 180, R.range(0.3, 0.7)); zones.push({ rect: true, u0, u1, v0, v1: m }, { rect: true, u0, u1, v0: m, v1 }); }
      } else zones.push({ rect: true, u0, u1, v0, v1 });
    }
    stagger(R, zones, 0.6, z => z.corr);
    const big = zones.filter(z => !z.corr && z.u1 - z.u0 >= 250 && z.v1 - z.v0 >= 250);
    if (big.length && R.chance(0.5)) R.pick(big).pill = true;
    for (const z of zones) z.pod = pod;
    return pod;
  }
  // a wing: a long hall in two or three stretches with square rooms hung off both sides of it,
  // each room as deep as it likes
  function wingPod(R, Z, AZ, opt) {
    const zones = [], pod = { type: 'rect', kind: 'wing', o: { x: 0, y: 0 }, rot: 0, zones };
    // the rooms are as big as a rotunda's cells, but each is only half one, so a wing hangs about twice the
    // zone count off its hall: it covers as much floor as the other kinds and is no thinner a floor
    const Wh = R.range(120, 150), rw = R.range(220, 250), rd = R.range(220, 236), per = rw * rd;
    const m0 = Math.max(1, Math.round((Z - 2) * AZ / per)), nC = m0 >= 7 ? 3 : 2, m = Math.max(1, Math.round((Z - nC) * AZ / per)), top = Math.ceil(m / 2), bot = m - top;
    const stag = R.range(0, rw * 0.5), slots = Math.max(top * rw, bot * rw + stag);
    const e0 = R.range(70, 170), e1 = R.range(70, 170), len = slots + e0 + e1;
    const cuts = [-e0]; for (let i = 1; i < nC; i++) cuts.push(-e0 + len * (i + R.range(-0.12, 0.12)) / nC); cuts.push(slots + e1);
    for (let i = 0; i < nC; i++) zones.push({ rect: true, corr: true, u0: cuts[i], u1: cuts[i + 1], v0: 0, v1: Wh });
    for (let i = 0; i < top; i++) zones.push({ rect: true, u0: i * rw, u1: (i + 1) * rw, v0: -rd - (R.chance(0.6) ? R.range(-30, 60) : 0), v1: 0 });
    for (let i = 0; i < bot; i++) zones.push({ rect: true, u0: stag + i * rw, u1: stag + (i + 1) * rw, v0: Wh, v1: Wh + rd + (R.chance(0.6) ? R.range(-30, 60) : 0) });
    // centre the plan on the origin
    let cu = 0, cv = 0; for (const z of zones) { cu += (z.u0 + z.u1) / 2; cv += (z.v0 + z.v1) / 2; }
    cu /= zones.length; cv /= zones.length;
    for (const z of zones) { z.u0 -= cu; z.u1 -= cu; z.v0 -= cv; z.v1 -= cv; }
    if (opt && opt.pill) { const big = zones.filter(z => !z.corr); if (big.length) R.pick(big).pill = true; }
    for (const z of zones) z.pod = pod;
    return pod;
  }
  // a small square room, to stand at the end of a thin spoke
  function towerPod(R) {
    const a = R.range(150, 190), b = R.range(150, 215), pod = { type: 'rect', kind: 'tower', o: { x: 0, y: 0 }, rot: 0, zones: [] };
    pod.zones.push({ rect: true, tower: true, u0: -a / 2, u1: a / 2, v0: -b / 2, v1: b / 2, pod });
    return pod;
  }
  // does another zone of the mass share any of this side of z?
  function rectShared(zones, z, sd) {
    const eq = (a, b) => Math.abs(a - b) < 1e-6;
    return zones.some(o => o !== z && (
      sd === 'u0' ? eq(o.u1, z.u0) && Math.min(o.v1, z.v1) - Math.max(o.v0, z.v0) > 1
      : sd === 'u1' ? eq(o.u0, z.u1) && Math.min(o.v1, z.v1) - Math.max(o.v0, z.v0) > 1
      : sd === 'v0' ? eq(o.v1, z.v0) && Math.min(o.u1, z.u1) - Math.max(o.u0, z.u0) > 1
      : eq(o.v0, z.v1) && Math.min(o.u1, z.u1) - Math.max(o.u0, z.u0) > 1));
  }
  const rectW = (pod, u, v) => { const p = turn({ x: u, y: v }, pod.rot); return { x: pod.o.x + p.x, y: pod.o.y + p.y }; };

  // the zones of a mass as shapes in the world, for keeping masses apart
  function podShapes(pod) {
    if (pod.type === 'rect') return pod.zones.map(z => { const c = rectW(pod, (z.u0 + z.u1) / 2, (z.v0 + z.v1) / 2); return U.rect(c.x, c.y, z.u1 - z.u0, z.v1 - z.v0, pod.rot); });
    return pod.zones.map(z => z.hub ? U.circle(pod.o.x, pod.o.y, z.r1) : cellPoly(cellOf(pod, z), z.a0, z.a1, z.r0, z.r1));
  }
  const cellOf = (pod, z) => ({ o: pod.o, ang: (z.a0 + z.a1) / 2, fc: pod.facet ? Math.cos((z.a1 - z.a0) / 2) : 0 });
  // the least gap between two sets of shapes (negative where they overlap); gives up below lim
  function sep(A, B, lim) {
    let d = Infinity;
    const pts = (s) => {
      const out = [];
      if (s.k === 'c') { for (let i = 0; i < 28; i++) out.push({ x: s.x + Math.cos(i / 28 * TAU) * s.r, y: s.y + Math.sin(i / 28 * TAU) * s.r }); return out; }
      for (let i = 0; i < s.pts.length; i++) {
        const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length], k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 30));
        for (let j = 0; j < k; j++) out.push({ x: a.x + (b.x - a.x) * j / k, y: a.y + (b.y - a.y) * j / k });
      }
      return out;
    };
    for (const [X, Y] of [[A, B], [B, A]]) for (const s of X) for (const p of pts(s)) for (const t of Y) { d = Math.min(d, U.sd(t, p.x, p.y)); if (d < lim) return d; }
    return d;
  }

  // ── where a hall can leave a mass ──
  // a point on an outer face, the face's outward normal, and whether the face is curved
  function polarCap(pod, z, a) {
    const c = cellOf(pod, z);
    if (c.fc && !z.hub) return { pod, zone: z, p: cellPt(c, a, z.r1), n: dir(c.ang), curved: false, R: 0, ang: a };
    return { pod, zone: z, p: { x: pod.o.x + Math.cos(a) * z.r1, y: pod.o.y + Math.sin(a) * z.r1 }, n: dir(a), curved: true, R: z.r1, ang: a };
  }
  function capsOf(pod, w) {
    const out = [], need = w / 2 + 46;
    if (pod.type === 'polar') {
      for (const z of pod.zones) {
        if (z.solo) { for (let i = 0; i < 18; i++) out.push(polarCap(pod, z, pod.rot + i / 18 * TAU)); continue; }
        if (z.hub || !z.outer) continue;
        const m = need / z.r1;
        if (z.a1 - z.a0 < 2 * m) continue;
        for (const f of [0.5, 0.2, 0.8]) out.push(polarCap(pod, z, U.lerp(z.a0 + m, z.a1 - m, f)));
      }
      if (pod.kind === 'crescent') {
        // the two ends of the wing are straight faces
        for (const z of pod.zones) for (const end of [0, 1]) {
          const a = end ? z.a1 : z.a0;
          if (Math.abs(a - (end ? pod.rot + pod.span : pod.rot)) > 1e-6 || z.r1 - z.r0 < 2 * need) continue;
          const r = (z.r0 + z.r1) / 2;
          out.push({ pod, zone: z, p: { x: pod.o.x + Math.cos(a) * r, y: pod.o.y + Math.sin(a) * r }, n: end ? { x: -Math.sin(a), y: Math.cos(a) } : { x: Math.sin(a), y: -Math.cos(a) }, curved: false, R: 0, end: true });
        }
      }
      return out;
    }
    for (const z of pod.zones) for (const sd of ['u0', 'u1', 'v0', 'v1']) {
      if (rectShared(pod.zones, z, sd)) continue;
      const need = w / 2 + (z.corr ? 22 : 46), lo = sd[0] === 'u' ? z.v0 : z.u0, hi = sd[0] === 'u' ? z.v1 : z.u1;
      if (hi - lo < 2 * need) continue;
      const nl = sd === 'u0' ? { x: -1, y: 0 } : sd === 'u1' ? { x: 1, y: 0 } : sd === 'v0' ? { x: 0, y: -1 } : { x: 0, y: 1 };
      for (const f of [0.5, 0.25, 0.75]) {
        const q = U.lerp(lo + need, hi - need, f), lp = sd[0] === 'u' ? { x: z[sd], y: q } : { x: q, y: z[sd] };
        out.push({ pod, zone: z, lp, nl, p: rectW(pod, lp.x, lp.y), n: turn(nl, pod.rot), curved: false, R: 0 });
      }
    }
    return out;
  }

  // Hang a mass off another by a hall of width w leaving one of host's faces; the new mass is
  // turned and moved so a face of it meets the hall's far end. Fails if it would touch anything.
  function attach(R, P, host, pod, o) {
    const w = o.w;
    for (let t = 0; t < 8; t++) {
      let caps = capsOf(host, w).filter(c => !P.capPts.some(q => Math.hypot(q.x - c.p.x, q.y - c.p.y) < w + 170));
      if (o.end) caps = caps.filter(c => c.end);
      if (o.corr) caps = caps.filter(c => c.zone.corr);
      else if (host.kind === 'wing') caps = caps.filter(c => !c.zone.corr);
      if (!caps.length) return false;
      // lean away from the masses already down, so the building spreads rather than folds
      let cx = 0, cy = 0; for (const p of P.pods) { cx += p.o.x; cy += p.o.y; } cx /= P.pods.length; cy /= P.pods.length;
      const away = P.pods.length > 1 ? Math.atan2(host.o.y - cy, host.o.x - cx) : R() * TAU;
      let c1 = null, best = -Infinity;
      for (const c of caps) { const s = Math.cos(Math.atan2(c.n.y, c.n.x) - away) + R.range(0, 1.3); if (s > best) { best = s; c1 = c; } }
      const a = c1.curved ? c1.n : turn(c1.n, R.range(-1, 1) * (o.skew || 0));
      const len = o.len * R.range(0.85, 1.15);
      const q = { x: c1.p.x + a.x * len, y: c1.p.y + a.y * len };
      const c2 = place(R, pod, q, a, w, o.delta || 0);
      if (!c2) continue;
      const ang = Math.atan2(a.y, a.x), mid = { x: (c1.p.x + q.x) / 2, y: (c1.p.y + q.y) / 2 };
      const hall = U.rect(mid.x, mid.y, Math.max(10, len - 24), w, ang);
      const mine = podShapes(pod);
      let ok = true;
      for (const e of P.pods) {
        if (sep(podShapes(e), mine, 36) < 36) { ok = false; break; }
        const others = podShapes(e).filter((s, i) => e.zones[i] !== c1.zone);
        if (sep(others, [hall], 30) < 30) { ok = false; break; }
      }
      if (ok && sep(mine.filter((s, i) => pod.zones[i] !== c2.zone), [hall], 30) < 30) ok = false;
      if (ok) for (const k of P.halls) if (sep([k], [hall], 40) < 40 || sep([k], mine, 40) < 40) { ok = false; break; }
      if (!ok) continue;
      // the hall: a corridor zone of its own, reaching well into each mass past its face, so the
      // doorway through the wall just inside the face is never pinched
      const ext = (c, ax) => c.curved ? c.R - Math.sqrt(c.R * c.R - w * w / 4) + 40 : w / 2 * Math.abs(Math.tan(Math.acos(U.clamp(ax.x * c.n.x + ax.y * c.n.y, -1, 1)))) + 40;
      const back = { x: -a.x, y: -a.y };
      const neck = { type: 'rect', kind: 'neck', o: mid, rot: ang, zones: [] };
      const nz = { rect: true, corr: true, neck: true, u0: -len / 2 - ext(c1, a), u1: len / 2 + ext(c2, back), v0: -w / 2, v1: w / 2, pod: neck };
      neck.zones.push(nz);
      P.pods.push(pod); P.necks.push(neck); P.halls.push(hall); P.capPts.push(c1.p, c2.p);
      P.links.push(linkOf(c1, nz, a, w), linkOf(c2, nz, back, w));
      return true;
    }
    return false;
  }
  // put a mass so one of its faces meets q, facing back along a (a face of a square-built mass is
  // turned by delta from square to the hall, so masses sit askew to each other)
  function place(R, pod, q, a, w, delta) {
    const back = Math.atan2(-a.y, -a.x);
    if (pod.type === 'polar') {
      const cands = pod.zones.filter(z => z.solo || (z.outer && !z.hub && (z.a1 - z.a0) * z.r1 > w + 100));
      if (!cands.length) return null;
      const z = R.pick(cands);
      if (!z.solo) { const slack = Math.max(0, (z.a1 - z.a0) / 2 - (w / 2 + 50) / z.r1); turnPod(pod, U.angDiff((z.a0 + z.a1) / 2, back) + R.range(-slack, slack)); }
      pod.o = { x: q.x + a.x * z.r1, y: q.y + a.y * z.r1 };
      return polarCap(pod, z, back);
    }
    pod.o = { x: 0, y: 0 }; pod.rot = 0;
    const cands = capsOf(pod, w);
    if (!cands.length) return null;
    const c = R.pick(cands), want = back + delta;
    pod.rot = want - Math.atan2(c.nl.y, c.nl.x);
    const lp = turn(c.lp, pod.rot);
    pod.o = { x: q.x - lp.x, y: q.y - lp.y };
    return { pod, zone: c.zone, p: { x: q.x, y: q.y }, n: dir(want), curved: false, R: 0 };
  }
  // the doorway where a hall meets a mass: a wall along the face, just inside it, spanning the
  // hall's width (c + t s for s in sLo..sHi), and where the hall's middle line crosses it
  function linkOf(cap, neck, ax, w) {
    const sag = cap.curved ? cap.R - Math.sqrt(cap.R * cap.R - w * w / 4) : 0, n = cap.n, t = { x: -n.y, y: n.x }, pp = { x: -ax.y, y: ax.x };
    const c = { x: cap.p.x - n.x * (HW + sag), y: cap.p.y - n.y * (HW + sag) };
    const np = n.x * pp.x + n.y * pp.y, tp = t.x * pp.x + t.y * pp.y;
    const sAt = (lat) => (lat + (HW + sag) * np) / tp, s0 = sAt(-w / 2), s1 = sAt(w / 2);
    if (cap.ang != null) (cap.zone.caps = cap.zone.caps || []).push({ a: cap.ang, h: (w / 2 + 30) / Math.max(cap.zone.r1 || 1, 1) });
    return { zone: cap.zone, neck, c, t, n, sLo: Math.min(s0, s1), sHi: Math.max(s0, s1), sMid: sAt(0), w };
  }

  // ── the plan ──
  // A floor is one big figure cut fine: well past the rooms the route walks, so the rest hang off it as
  // side rooms and the figure (a three-ring rotunda, a long two-band crescent, a full spiral) fills the frame
  const zoneCount = (n, D) => Math.max(D.rooms + D.sides, n <= 1 ? 5 : n <= 2 ? 6 : n <= 4 ? 9 : n <= 8 ? 10 : n <= 12 ? 11 : 12);
  function layout(R, n, Z, kind) {
    const AZ = (86000 + Math.min(n, 6) * 4000) * 0.9;
    kind = kind || R.pick(KINDS);
    for (let t = 0; t < 10; t++) { const P = compose(R, n, Z, kind, AZ); if (P) return P; }
    return null;
  }
  function compose(R, n, Z, kind, AZ) {
    const P = { kind, pods: [], necks: [], halls: [], links: [], capPts: [] };
    const thin = (x) => Object.assign({ w: R.range(66, 80), len: R.range(100, 190) }, x);
    const hall = (x) => Object.assign({ w: R.range(98, 128), len: R.range(70, 160) }, x);
    const skew = () => R.range(0.17, 0.52) * (R.chance(0.5) ? 1 : -1);
    const join = (host, pod, o) => attach(R, P, host, pod, o);
    if (kind === 'disc') {
      // the rotunda is the floor: at most a small round room close by its rim, never a box out on a stalk
      const sat = R.weighted([['tower', n >= 2 ? 0.15 : 0], ['solo', 0.9], ['none', 1]]);
      const main = polarPod(R, Z - (sat === 'none' ? 0 : 1), 'disc', AZ, { col: R.chance(0.75), coil: R.chance(0.7) });
      P.pods.push(main);
      if (sat === 'tower') join(main, towerPod(R), thin({ len: R.range(70, 110), delta: R.range(-0.5, 0.5) }));
      else if (sat === 'solo') join(main, polarPod(R, 1, 'solo', AZ * R.range(0.6, 0.9)), hall({ len: R.range(45, 90) }));
    } else if (kind === 'crescent') {
      // a long crescent, now and then capped at a horn by a small round room (a box on a stalk only rarely)
      const tw = R.chance(0.15), cap = !tw && Z >= 7 && R.chance(0.45);
      const main = polarPod(R, Z - (tw || cap ? 1 : 0), 'crescent', AZ, { facet: R.chance(0.45), col: R.chance(0.8), coil: R.chance(0.6) });
      P.pods.push(main);
      if (tw) join(main, towerPod(R), thin({ end: true, len: R.range(70, 120), skew: 0.3, delta: R.range(-0.4, 0.4) }));
      if (cap) join(main, polarPod(R, 1, 'solo', AZ * 0.7), hall({ end: true, len: R.range(45, 90), skew: 0.2 }));
    } else if (kind === 'nautilus') {
      // the spiral alone: its own growing wedges are the figure
      const tw = R.chance(0.12), main = polarPod(R, Z - (tw ? 1 : 0), 'nautilus', AZ, { col: R.chance(0.65) });
      P.pods.push(main);
      if (tw) join(main, towerPod(R), thin({ len: R.range(70, 120), delta: R.range(-0.5, 0.5) }));
    } else if (kind === 'block' && Z >= 8 && R.chance(0.55)) {
      // a cross of halls with rooms in its corners, square to the frame or turned to a diagonal
      const tw = R.chance(0.35) ? 1 : 0, main = crossPod(R, Z - tw, AZ);
      main.rot = R.int(0, 3) * Math.PI / 2 + (R.chance(0.45) ? Math.PI / 4 : R.range(-0.2, 0.2));
      P.pods.push(main);
      if (tw) join(main, towerPod(R), thin({ corr: true, delta: R.range(-0.45, 0.45) }));
    } else if (kind === 'block') {
      const ann = Z >= 5 && R.chance(0.8) ? (Z >= 8 ? 3 : 2) : 0, tw = R.chance(ann ? 0.4 : 0.8) ? 1 : 0;
      const main = blockPod(R, Math.max(2, Z - ann - tw), AZ, { pill: R.chance(0.5) });
      main.rot = R.int(0, 3) * Math.PI / 2 + (R.chance(0.4) ? R.range(-0.4, 0.4) : 0);
      P.pods.push(main);
      if (ann) join(main, blockPod(R, ann, AZ * 0.9, {}), hall({ delta: skew() }));
      if (tw) join(R.pick(P.pods), towerPod(R), thin({ delta: R.range(-0.45, 0.45) }));
    } else if (kind === 'wing') {
      const tw = R.chance(0.7), main = wingPod(R, Z - (tw ? 1 : 0), AZ, { pill: R.chance(0.45) });
      main.rot = R() * TAU;
      P.pods.push(main);
      if (tw) join(main, towerPod(R), thin({ corr: true, delta: R.range(-0.45, 0.45) }));
    } else if (kind === 'cluster') {
      // a chain of three to five round masses of very different sizes, nearly touching, that bends:
      // one big rotunda and smaller rings and lone round rooms strung off it by short necks
      let m = Z >= 11 ? R.int(4, 5) : Z >= 7 ? 4 : 3;
      let big = Math.max(4, Math.round(Z * R.range(0.5, 0.6)));
      m = Math.max(2, Math.min(m, Z - big + 1));
      const parts = [big]; for (let i = 1; i < m; i++) parts.push(1);
      // the rest share out what is left: a lone room grows into a small ring (a hub and two rooms) and on to four
      for (let rem = Z - big - (m - 1), t = 0; rem > 0; t++) {
        const i = R.int(1, m - 1);
        if (parts[i] === 1 && rem >= 2) { parts[i] = 3; rem -= 2; }
        else if (parts[i] >= 3 && parts[i] < 5) { parts[i]++; rem--; }
        else if (t > 30) { parts[0]++; rem--; }
      }
      // the big one somewhere along the chain, not always at its head
      big = parts[0];
      const order = parts.slice(1); order.splice(R.int(0, Math.min(2, order.length)), 0, big);
      const pods = order.map(k => k === 1 ? polarPod(R, 1, 'solo', AZ * R.range(0.45, 1.5)) : polarPod(R, k, 'disc', AZ, { col: k >= 5 && R.chance(0.6), coil: k >= 5 && R.chance(0.5) }));
      P.pods.push(pods[0]);
      for (let i = 1; i < pods.length; i++) {
        const prev = P.pods[P.pods.length - 1];
        if (!join(R.chance(0.8) ? prev : R.pick(P.pods), pods[i], hall({ len: R.range(42, 85) }))) join(R.pick(P.pods), pods[i], hall({ len: R.range(50, 110) }));
      }
      if (P.pods.length < Math.min(3, m)) return null;
    } else {
      // twin: two masses, each a building of its own, joined by one long hall
      const k1 = Math.max(Math.ceil(Z / 2), Math.min(Z - 3, Math.round(Z * R.range(0.55, 0.68)))), k2 = Z - k1;   // one mass clearly the bigger
      const types = R.weighted([[['disc', 'block'], 0.5], [['block', 'disc'], 0.4], [['disc', 'disc'], 1.4], [['disc', 'crescent'], k2 >= 4 ? 1 : 0], [[k1 >= 5 ? 'nautilus' : 'disc', 'disc'], 1.1]]);
      const mk = (t, k) => t === 'block' ? blockPod(R, Math.max(2, k), AZ, { pill: R.chance(0.4) }) : polarPod(R, Math.max(3, k), t, AZ, { col: R.chance(0.6), facet: t === 'crescent' && R.chance(0.3), coil: k >= 5 && R.chance(0.5) });
      const main = mk(types[0], k1);
      if (main.type === 'rect') main.rot = R.int(0, 3) * Math.PI / 2;
      P.pods.push(main);
      if (!join(main, mk(types[1], k2), { w: R.range(104, 136), len: R.range(110, 220), delta: types[1] === 'block' ? skew() : 0 })) return null;
    }
    // bites out of the outer arcs, kept clear of the halls: a single notch, or a row of two to four
    // teeth (a sawtooth, deepening or shallowing along the row) on a long enough stretch of rim
    for (const pod of P.pods) if (pod.type === 'polar' && pod.kind !== 'solo') for (const z of pod.zones) {
      if (!z.outer || z.hub || !R.chance(0.65)) continue;
      const m = 84 / z.r1, free = z.a1 - z.a0 - 2 * m;
      let teeth = free * z.r1 > 300 && R.chance(0.6) ? R.int(2, 4) : 1;
      const bw = (teeth > 1 ? R.range(46, 66) : R.range(70, 130)) / z.r1, gap = R.range(54, 86) / z.r1;
      while (teeth > 1 && teeth * bw + (teeth - 1) * gap > free) teeth--;
      const total = teeth * bw + (teeth - 1) * gap, d0 = R.range(44, 80), d1 = teeth > 1 && R.chance(0.6) ? R.range(36, 84) : d0;
      if (total > free) continue;
      const s0 = z.a0 + m + R() * (free - total), bites = [];
      for (let i = 0; i < teeth; i++) {
        const b0 = s0 + i * (bw + gap), b1 = b0 + bw, depth = U.lerp(d0, d1, teeth > 1 ? i / (teeth - 1) : 0);
        if (z.r1 - z.r0 - depth < 165) continue;
        if ((z.caps || []).some(c => c.a + c.h > b0 && c.a - c.h < b1)) continue;
        if (z.col && pod.colR + pod.colGap + 40 > z.r1 - depth) continue;
        bites.push({ b0, b1, rb: z.r1 - depth });
      }
      if (bites.length) z.bites = bites;
    }
    P.zones = [];
    for (const pod of P.pods.concat(P.necks)) for (const z of pod.zones) P.zones.push(z);
    return P;
  }

  // the square-built zones meet along straight lines: 'line' seams at u (axis 'u') or v ('v')
  function rectSeams(A, B, out) {
    const eq = (a, b) => Math.abs(a - b) < 1e-6;
    if (eq(A.u1, B.u0)) { const q0 = Math.max(A.v0, B.v0), q1 = Math.min(A.v1, B.v1); if (q1 - q0 > 1) out.push({ A, B, type: 'line', axis: 'u', at: A.u1, q0, q1 }); }
    if (eq(A.v1, B.v0)) { const q0 = Math.max(A.u0, B.u0), q1 = Math.min(A.u1, B.u1); if (q1 - q0 > 1) out.push({ A, B, type: 'line', axis: 'v', at: A.v1, q0, q1 }); }
  }

  // Pairs of zones of one mass that touch: 'arc' where B's inner edge lies on A's outer edge,
  // 'spoke' where B starts, going round, where A ends; and a 'link' where a hall meets a mass.
  function seams(rooms, links) {
    const out = [], eq = (a, b) => Math.abs(a - b) < 1e-6;
    for (const A of rooms) for (const B of rooms) {
      if (A === B || A.pod !== B.pod) continue;
      if (A.rect || B.rect) { if (A.rect && B.rect) rectSeams(A, B, out); continue; }
      if (eq(A.r1, B.r0)) {
        if (A.hub) out.push({ A, B, type: 'arc', r: A.r1, s0: B.a0, s1: B.a1 });
        else for (const k of [-1, 0, 1]) {
          const s0 = Math.max(A.a0, B.a0 + k * TAU), s1 = Math.min(A.a1, B.a1 + k * TAU);
          if (s1 - s0 > 1e-6) out.push({ A, B, type: 'arc', r: A.r1, s0, s1, fz: A.fc ? A : null });
        }
      }
      if (!A.hub && !B.hub && Math.abs(U.angDiff(A.a1, B.a0)) < 1e-6) {
        const q0 = Math.max(A.r0, B.r0), q1 = Math.min(A.r1, B.r1);
        if (q1 - q0 > 1) out.push({ A, B, type: 'spoke', a: A.a1, q0, q1 });
      }
    }
    for (const s of out) { s.o = s.A.o; s.len = s.type === 'arc' ? (s.s1 - s.s0) * s.r : s.q1 - s.q0; s.hall = s.type === 'line' && s.A.corr && s.B.corr; }
    for (const k of links) out.push(Object.assign({ type: 'link', len: k.w, link: true }, k));
    return out;
  }

  // the floor outline of a polar zone: arcs (straight sides when the mass is built of blocks),
  // with any bites taken out of the outer edge
  function cellPt(c, a, r) {
    if (c.fc) { const d = r * c.fc / Math.cos(a - c.ang); return { x: c.o.x + Math.cos(a) * d, y: c.o.y + Math.sin(a) * d }; }
    return { x: c.o.x + Math.cos(a) * r, y: c.o.y + Math.sin(a) * r };
  }
  function cellPoly(c, a0, a1, r0, r1, bites) {
    const pts = [];
    const run = (b0, b1, r) => { const k = c.fc ? 1 : Math.max(1, Math.ceil((b1 - b0) / 0.09)); for (let i = 0; i <= k; i++) pts.push(cellPt(c, b0 + (b1 - b0) * i / k, r)); };
    let a = a0;
    for (const b of bites || []) { run(a, b.b0, r1); run(b.b0, b.b1, b.rb); a = b.b1; }
    run(a, a1, r1);
    if (r0 <= 0) pts.push({ x: c.o.x, y: c.o.y });
    else { const k = c.fc ? 1 : Math.max(2, Math.ceil((a1 - a0) / 0.09)); for (let i = k; i >= 0; i--) pts.push(cellPt(c, a0 + (a1 - a0) * i / k, r0)); }
    return U.poly(pts);
  }
  // a point's polar coordinates about a cell's centre, the angle unwrapped beside the cell's own;
  // in a cell with straight sides, r is the depth along its middle, scaled so its faces sit at r0, r1
  function polarOf(room, x, y) {
    const dx = x - room.o.x, dy = y - room.o.y, mid = (room.a0 + room.a1) / 2, a = mid + U.angDiff(mid, Math.atan2(dy, dx));
    let r = Math.hypot(dx, dy);
    if (room.fc) r *= Math.cos(a - mid) / room.fc;
    return { a, r };
  }
  const inBite = (room, p, m) => room.bites && room.bites.some(b => p.a >= b.b0 - m / p.r && p.a <= b.b1 + m / p.r && p.r >= b.rb - m);
  function inCell(room, x, y, m) {
    const p = polarOf(room, x, y);
    return p.r >= room.r0 + m && p.r <= room.r1 - m && (p.a - room.a0) * p.r >= m && (room.a1 - p.a) * p.r >= m && !inBite(room, p, m);
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
      let q;
      for (let t = 0; t < 8; t++) {
        const a = R.range(room.a0, room.a1), r = Math.sqrt(R.range(room.r0 * room.r0, room.r1 * room.r1));
        q = cellPt(room, a, r);
        if (!room.bites || !inBite(room, { a, r }, 0)) break;
      }
      return { x: room.c.x + (q.x - room.c.x) * frac, y: room.c.y + (q.y - room.c.y) * frac };
    }
    const u = (R() - 0.5) * room.w * frac, v = (R() - 0.5) * room.h * frac, c = Math.cos(room.ang), s = Math.sin(room.ang);
    return { x: room.c.x + u * c - v * s, y: room.c.y + u * s + v * c };
  }

  function tryGen(seed, n, kind, loose) {
    const R = U.rng(seed), D = difficulty(n);
    const L = { n, D, floor: [], obs: [], doors: [], shades: [], guards: [], cams: [], keys: [], stars: [], rooms: [], conns: [] };
    // the building, and its zones as rooms
    const P = layout(R, n, zoneCount(n, D), kind);
    if (!P) return null;
    L.plan = P;
    const pt = (o, a, r) => ({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r });
    const lineAt = (s, q) => s.axis === 'u' ? s.A.toW(s.at, q) : s.A.toW(q, s.at);
    const zones = P.zones.map((z) => {
      const pod = z.pod, o = pod.o;
      if (z.rect) {
        const toW = (u, v) => rectW(pod, u, v);
        const w = z.u1 - z.u0, h = z.v1 - z.v0, c = toW((z.u0 + z.u1) / 2, (z.v0 + z.v1) / 2);
        return { kind: 'rect', rect: true, corr: !!z.corr, neck: !!z.neck, tower: !!z.tower, pill: !!z.pill, pod, o, toW, u0: z.u0, u1: z.u1, v0: z.v0, v1: z.v1, c, w, h, ang: pod.rot, R: Math.hypot(w, h) / 2,
          shape: U.rect(c.x, c.y, w, h, pod.rot), excl: [], spots: [], seamSide: {} };
      }
      const room = { kind: z.hub ? 'circle' : 'cell', hub: !!z.hub, solo: !!z.solo, pod, o, a0: z.a0, a1: z.a1, r0: z.r0, r1: z.r1, col: !!z.col, bites: z.bites || null, excl: [], spots: [] };
      if (z.hub) { room.r = room.R = z.r1; room.c = { x: o.x, y: o.y }; room.ang = 0; room.fc = 0; room.shape = U.circle(o.x, o.y, z.r1); }
      else {
        const rc = Math.sqrt((z.r0 * z.r0 + z.r1 * z.r1) / 2);
        room.ang = (z.a0 + z.a1) / 2; room.fc = pod.facet ? Math.cos((z.a1 - z.a0) / 2) : 0; room.c = cellPt(room, room.ang, rc);
        room.w = (z.a1 - z.a0) * rc; room.h = z.r1 - z.r0; room.R = Math.hypot(room.w, room.h) / 2;
        room.shape = cellPoly(room, z.a0, z.a1, z.r0, z.r1, room.bites);
      }
      return room;
    });
    const roomOf = new Map(P.zones.map((z, i) => [z, zones[i]]));
    const all = seams(zones, P.links.map(k => Object.assign({}, k, { A: roomOf.get(k.zone), B: roomOf.get(k.neck) })));
    // each zone's floor reaches a little past its shared edges into the neighbour that covers
    // them, so the union is seamless; each edge also says how far furniture may reach past it
    for (const z of zones) {
      z.tol = { in: 20, out: 20, a0: 20, a1: 20 };
      if (z.hub) { L.floor.push(z.shape); continue; }
      if (z.rect) {
        // a band of floor straddles each shared side, so the field runs on through a doorway
        const e = z.seamSide;
        for (const s of all) {
          if (s.type !== 'line') continue;
          if (s.A === z) e[s.axis === 'u' ? 'u1' : 'v1'] = 1;
          if (s.B === z) { e[s.axis === 'u' ? 'u0' : 'v0'] = 1; continue; }
          if (s.A !== z) continue;
          const m = s.q0 + s.q1, c = lineAt(s, m / 2);
          L.floor.push(s.axis === 'u' ? U.rect(c.x, c.y, 60, s.q1 - s.q0, z.ang) : U.rect(c.x, c.y, s.q1 - s.q0, 60, z.ang));
        }
        L.floor.push(z.shape);
        continue;
      }
      let e0 = 0, e1 = 0, ein = 0;
      for (const s of all) {
        if (s.type === 'link') continue;
        if (s.type === 'arc') { if (s.B === z) { z.tol.in = 8; ein = 30; } if (s.A === z) z.tol.out = 8; }
        else if (s.B === z) { z.tol.a0 = 8; if (s.A.r0 <= z.r0 && s.A.r1 >= z.r1) e0 = 32 / Math.max(z.r0, 90); }
        else if (s.A === z) { z.tol.a1 = 8; if (s.B.r0 <= z.r0 && s.B.r1 >= z.r1) e1 = 32 / Math.max(z.r0, 90); }
      }
      // straight-sided blocks don't reach round a corner: their spoke bands close the seam instead
      if (z.fc) e0 = e1 = 0;
      L.floor.push(cellPoly(z, z.a0 - e0, z.a1 + e1, z.r0 - ein, z.r1, z.bites));
    }

    // and a straight band of floor along every spoke, so a doorway in one is never pinched shut
    // where neither wedge reaches past it (short of a block's corner, where it would poke out)
    for (const s of all) if (s.type === 'spoke') {
      const cut = s.A.fc ? 30 * Math.tan(Math.max(s.A.a1 - s.A.a0, s.B.a1 - s.B.a0) / 2) : 0;
      const p = pt(s.o, s.a, s.q0), q = pt(s.o, s.a, s.q1 - 3 - cut); L.floor.push(U.seg(p.x, p.y, q.x, q.y, 60, 0));
    }

    // the route: a walk through neighbouring zones from the stairs in to the stairs up
    const nb = new Map(zones.map(z => [z, []]));
    for (const s of all) if (s.link || s.len >= 150 || (s.hall && s.len >= 110)) { nb.get(s.A).push({ to: s.B, s }); nb.get(s.B).push({ to: s.A, s }); }
    let main = null, bestScore = -1;
    const ends = zones.filter(z => (!z.hub || z.solo) && !z.neck);
    for (let t = 0; t < 60; t++) {
      const path = [R.pick(ends)], used = new Set(path);
      while (path.length < D.rooms) {
        const opts = nb.get(path[path.length - 1]).filter(e => !used.has(e.to));
        if (!opts.length) break;
        const e = R.pick(opts); path.push(e.to); used.add(e.to);
      }
      if (path.length < D.rooms || path[path.length - 1].neck) continue;
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
    const onArc = (s, g) => s.fz ? cellPt(s.fz, g, s.r) : pt(s.o, g, s.r);
    const connect = (A, B, s) => {
      const conn = { a: A, b: B, width: GAP, kind: 'seam', seam: s };
      let g0, g1;
      if (s.type === 'line') {
        const g = R.range(s.q0 + 48, s.q1 - 48), ln = s.axis === 'u' ? dir(s.A.ang) : dir(s.A.ang + Math.PI / 2);
        s.gap = g; conn.mouth = lineAt(s, g);
        conn.normal = A === s.A ? ln : { x: -ln.x, y: -ln.y };
        g0 = lineAt(s, g - GAP / 2); g1 = lineAt(s, g + GAP / 2);
      } else if (s.type === 'spoke') {
        const rg = R.range(s.q0 + 48, s.q1 - 48), tn = { x: -Math.sin(s.a), y: Math.cos(s.a) };
        s.gap = rg; conn.mouth = pt(s.o, s.a, rg);
        conn.normal = A === s.A ? tn : { x: -tn.x, y: -tn.y };
        g0 = pt(s.o, s.a, rg - GAP / 2); g1 = pt(s.o, s.a, rg + GAP / 2);
      } else if (s.type === 'link') {
        // a hall's doorway: a gap in the wall across its end, or the whole end of a thin one
        const at = (x) => ({ x: s.c.x + s.t.x * x, y: s.c.y + s.t.y * x });
        const g = s.w >= 100 ? R.range(s.sLo + 40, s.sHi - 40) : s.sMid;
        s.gap = g; conn.mouth = at(g);
        conn.normal = A === s.A ? s.n : { x: -s.n.x, y: -s.n.y };
        if (s.w >= 100) { g0 = at(g - GAP / 2); g1 = at(g + GAP / 2); } else { g0 = at(s.sLo); g1 = at(s.sHi); }
        for (const x of [s.sLo, s.sHi]) { const p = at(x); A.excl.push({ x: p.x, y: p.y, r: 34 }); B.excl.push({ x: p.x, y: p.y, r: 34 }); }
      } else {
        const m = 48 / s.r, g = R.range(s.s0 + m, s.s1 - m), h = GAP / 2 / s.r, rn = s.fz ? dir(s.fz.ang) : dir(g);
        s.gap = g; conn.mouth = onArc(s, g);
        conn.normal = A === s.A ? rn : { x: -rn.x, y: -rn.y };
        g0 = onArc(s, g - h); g1 = onArc(s, g + h);
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

    // the shared walls: straight along a spoke, short chords along an arc, one straight run
    // between blocks, and across each end of a hall
    for (const s of all) {
      const h = GAP / 2;
      if (s.type === 'line') {
        // reach on past an end only where both zones stop there, so a corner closes without a stub
        const lo = s.axis === 'u' ? 'v0' : 'u0', hi = s.axis === 'u' ? 'v1' : 'u1';
        const a = s.q0 - (Math.abs(s.A[lo] - s.B[lo]) < 1 ? HW : 0), b = s.q1 + (Math.abs(s.A[hi] - s.B[hi]) < 1 ? HW : 0);
        const spans = s.gap == null ? [[a, b]] : [[a, s.gap - h], [s.gap + h, b]];
        for (const [u0, u1] of spans) { const p = lineAt(s, u0), q = lineAt(s, u1); L.obs.push(U.seg(p.x, p.y, q.x, q.y, WALL, 0)); }
      } else if (s.type === 'spoke') {
        // flush where one zone steps out past the other
        const top = s.q1 + (Math.abs(s.A.r1 - s.B.r1) < 1 ? HW : 0), bot = s.q0 - (Math.abs(s.A.r0 - s.B.r0) < 1 ? HW : 0);
        const spans = s.gap == null ? [[bot, top]] : [[bot, s.gap - h], [s.gap + h, top]];
        for (const [u0, u1] of spans) { const p = pt(s.o, s.a, u0), q = pt(s.o, s.a, u1); L.obs.push(U.seg(p.x, p.y, q.x, q.y, WALL, 0)); }
      } else if (s.type === 'link') {
        if (s.w < 100) continue;
        const at = (x) => ({ x: s.c.x + s.t.x * x, y: s.c.y + s.t.y * x });
        for (const [u0, u1] of [[s.sLo, s.gap - h], [s.gap + h, s.sHi]]) { const p = at(u0), q = at(u1); L.obs.push(U.seg(p.x, p.y, q.x, q.y, WALL, 5)); }
      } else {
        const e = HW / s.r, gh = h / s.r;
        const spans = s.gap == null ? [[s.s0 - e, s.s1 + e]] : [[s.s0 - e, s.gap - gh], [s.gap + gh, s.s1 + e]];
        for (const [u0, u1] of spans) {
          const k = s.fz ? 1 : Math.max(1, Math.ceil((u1 - u0) * s.r / chord(s.r)));
          for (let i = 0; i < k; i++) { const p = onArc(s, u0 + (u1 - u0) * i / k), q = onArc(s, u0 + (u1 - u0) * (i + 1) / k); L.obs.push(U.seg(p.x, p.y, q.x, q.y, WALL, 1.5)); }
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
    let lo = 0, loPrev = 0, roomPrev = null;
    // its own dice, so the rest of the floor rolls the same: from the sixth floor a key may wait back
    // with the one before it, so you carry two keys to their doors rather than one at a time
    const KR = U.rng(U.hash(seed, 0x6b));
    for (let k = 0; k < locks.length; k++) {
      // the key lives somewhere between the previous lock and this one, a side room if there is one
      const back = k > 0 && n >= 6 && KR() < 0.35;
      if (back) lo = loPrev;
      loPrev = lo;
      const hi = main.indexOf(locks[k].conn.a);
      let pool = L.rooms.filter(r => r.idx >= lo && r.idx <= hi && r !== main[0] || (r === main[0] && hi === 0));
      // a key that waits back with the one before it waits in another room if there is one, so the two are two finds
      if (back && pool.some(r => r !== roomPrev)) pool = pool.filter(r => r !== roomPrev);
      const sides = pool.filter(r => r.side);
      const nav = navG(field);
      let placed = null;
      for (let t = 0; t < 40 && !placed; t++) {
        const room = sides.length && t < 20 ? R.pick(sides) : R.pick(pool.length ? pool : main.slice(0, hi + 1));
        const spot = room.spots.length && R.chance(0.6) ? R.pick(room.spots) : inRoom(R, room, 0.7);
        const p = field.nearestFree(spot.x, spot.y, 16, 40);
        if (!p || Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) < 160) continue;
        if (L.keys.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 50)) continue;   // never two keys on one spot
        if (!nav.reach(L.entrance.x, L.entrance.y, p.x, p.y)) continue;
        placed = p; placed.room = room;
      }
      if (!placed) return null;
      L.keys.push({ x: placed.x, y: placed.y, color: locks[k].color, door: locks[k].door, got: false });
      roomPrev = placed.room;
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
    const unplug = placeGuards(R, L, field, navClosed, n, loose);
    // from the third floor at least one star is a dare: on a walker's beat, or in a post's or a
    // camera's look, so three stars means taking a real risk. If none is, one moves beside a beat;
    // and from the sixth one always does, so every floor up there has a star you take on a guard's timing
    if (n >= 6 || (n >= 3 && !L.stars.some(st => starRisk(L, field, st)))) {
      const walkers = L.guards.filter(g => g.path);
      let moved = false;
      for (let t = 0; t < 60 && walkers.length && L.stars.length && !moved; t++) {
        const g = R.pick(walkers), q = R.pick(g.path), a = R() * TAU, e = R.range(28, 48);
        const p = field.nearestFree(q.x + Math.cos(a) * e, q.y + Math.sin(a) * e, 14, 20);
        if (!p || Math.hypot(p.x - q.x, p.y - q.y) < 24) continue;
        if (Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) < 220 || Math.hypot(p.x - L.exit.x, p.y - L.exit.y) < 70) continue;
        if (L.keys.some(k => Math.hypot(k.x - p.x, k.y - p.y) < 60) || L.conns.some(c => Math.hypot(c.mouth.x - p.x, c.mouth.y - p.y) < 40)) continue;
        // the star that goes is the one nearest this spot, and it keeps its distance from the other two
        let si = 0, bd = Infinity; L.stars.forEach((st, i) => { const d = Math.hypot(st.x - p.x, st.y - p.y); if (d < bd) { bd = d; si = i; } });
        if (L.stars.some((st, i) => i !== si && Math.hypot(st.x - p.x, st.y - p.y) < 160)) continue;
        if (!navOpen.reach(L.entrance.x, L.entrance.y, p.x, p.y) || !starRisk(L, field, p)) continue;
        L.stars[si] = { x: p.x, y: p.y, got: false, dare: true };
        moved = true;
      }
    }

    // no leg of the floor is plugged: every way on has a lane each post's and camera's sweep leaves dark
    // for part of its cycle. The watcher that does most of the plugging comes down (a post tries another room)
    // and every leg can be done on timing: a perfect sneak gets through the sweeps and the beats as they
    // really come round, under half a meter (timedRoute). Short of that, whoever watches most of the plain
    // way on comes down too, and after eighteen goes the floor is drawn again
    for (let t = 0; ; t++) {
      const fx = forcedExposure(L, field);
      if (fx.cost > 0.25) { if (t >= 18 || !fx.who) return null; unplug(fx.who, t >= 6); continue; }
      const tr = timedRoute(L, field);
      if (tr.ok) break;
      if (t >= 18 || !tr.who) return null;
      unplug(tr.who, t >= 6);
    }
    if (n >= 2 && L.guards.length < 2) return null;
    // and the timing checks never leave a floor thin: past the second, at least 70% of its budget still watches
    // (half for a floor let through late), with its cameras among them from the sixth. Short of that, draw again
    // (a floor whose posts are at their share of its walkers is let through at the lower bar: what it lacks is not made up in stares)
    const nPost = L.guards.filter(g => !g.path).length, atCap = nPost >= sentryCap(L.guards.length - nPost);
    if (n >= 3 && L.guards.length + L.cams.length < watchFloor(watchBudget(L, n), n, loose || atCap)) return null;
    // and the checks never leave a floor of fixed stares: past the second its walkers stay within three of their
    // floor (walkFloor), and its posts never outnumber them two to one. Short of that, draw again
    if (!loose && n >= 3 && (L.guards.length - nPost < walkFloor(n) - 3 || (nPost >= 2 && nPost >= 2 * (L.guards.length - nPost)))) return null;
    if (D.cams && L.cams.length < (loose ? Math.min(1, camFloor(n)) : camFloor(n))) return null;

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
    // and none is a trap beside a post: its rim stays 60 from every sentry's spot, out of its elbow and its stare
    const nearPost = (p, r) => L.guards.some(g => !g.path && Math.hypot(g.x - p.x, g.y - p.y) - r < 60);
    // one to a room and six to eight a floor: a shade is a place to break off a chase, not a path
    const shadeCap = R.int(6, 8);
    for (const room of L.rooms) {
      const want = L.shades.length < shadeCap ? 1 : 0;
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
        if (nearPost(p, r)) continue;
        if (!navOpen.reach(L.entrance.x, L.entrance.y, p.x, p.y)) continue;
        L.shades.push({ x: p.x, y: p.y, r, rot: R() * TAU });
        got++;
      }
    }
    // and from the third floor one or two lie just off a walker's beat, partway along a straight run where it
    // never stops or turns, so you can hold still in the dark and let it walk right past you
    const walkers = L.guards.filter(g => g.path);
    for (let t = 0, got = 0, want = n >= 3 ? R.int(1, 2) : 0; t < 120 && got < want && walkers.length; t++) {
      const gd = R.pick(walkers), path = gd.path, i = R.int(0, path.length - 1), a = path[i], b = path[(i + 1) % path.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 110) continue;
      const u = R.range(0.35, 0.65), q = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      if (path.some(w => (w.pause > 0 || w === a || w === b) && Math.hypot(w.x - q.x, w.y - q.y) < 50)) continue;
      const r = R.range(19, 23), off = r + R.range(14, 20), sg = R.chance(0.5) ? 1 : -1;
      const p = { x: q.x - (b.y - a.y) / len * off * sg, y: q.y + (b.x - a.x) / len * off * sg }, sd = field.sample(p.x, p.y);
      if (sd < r - 4 || sd > r + 14) continue;   // tucked in against a wall, out of the walker's way
      // in plain sight of the walk, not round a wall's end from it, and with room on the walk's side to look in from
      if (field.ray(q.x, q.y, (p.x - q.x) / off, (p.y - q.y) / off, off) < off - 2) continue;
      const toQ = Math.atan2(q.y - p.y, q.x - p.x);
      if ([-1.4, -0.7, 0, 0.7, 1.4].some(da => field.ray(p.x, p.y, Math.cos(toQ + da), Math.sin(toQ + da), r + 26) < r + 24)) continue;
      if (Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) < 90 || Math.hypot(p.x - L.exit.x, p.y - L.exit.y) < 70) continue;
      if (L.shades.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 90)) continue;
      if (L.stars.concat(L.keys).some(o => Math.hypot(o.x - p.x, o.y - p.y) < 40)) continue;
      if (L.conns.some(c => Math.hypot(c.mouth.x - p.x, c.mouth.y - p.y) < 50)) continue;
      // close to this beat, but no beat (nor post) comes within arm's reach of anyone inside it
      if (beat.some(o => Math.hypot(o.x - p.x, o.y - p.y) < r + 13) || nearPost(p, r)) continue;
      if (!navOpen.reach(L.entrance.x, L.entrance.y, p.x, p.y)) continue;
      L.shades.push({ x: p.x, y: p.y, r, rot: R() * TAU, pass: true });
      got++;
    }

    L.field = field;
    L.nav = navClosed;
    return L;
  }

  // ── furniture ──────────────────────────────────────────────
  // a partition's piece: a doorway's clear space keeps it back less far than a block, since a thin
  // wall beside the way through still leaves the way open
  const thinWall = (s) => s.k === 'p' && s.pts.length === 4 && Math.min(Math.hypot(s.pts[1].x - s.pts[0].x, s.pts[1].y - s.pts[0].y), Math.hypot(s.pts[2].x - s.pts[1].x, s.pts[2].y - s.pts[1].y)) <= PART + 0.5;
  function furnish(R, L, room, n) {
    if (room.kind === 'cell') return furnishCell(R, L, room, n);
    // the hub's neighbours reach into it by design, so it keeps to its own circle instead
    const others = room.hub ? [] : L.floor.filter(s => s !== room.shape && s !== room.floorShape);
    const placed = [];
    // a piece is kept only if it stays out of every other room and corridor, clear of the ways
    // through, and (when asked) leaves a walkable gap to what's already there
    const put = (s, spacing) => {
      const samples = [];
      if (s.k === 'c') { for (let i = 0; i < 8; i++) samples.push({ x: s.x + Math.cos(i / 8 * TAU) * s.r, y: s.y + Math.sin(i / 8 * TAU) * s.r }); samples.push({ x: s.x, y: s.y }); }
      else for (let i = 0; i < s.pts.length; i++) { const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length]; samples.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }
      // a square-built zone keeps to its own outline (its faces on a shared wall are already set in
      // to the wall's face), so a partition can run right up to a wall instead of stopping short
      if (room.kind === 'rect') { for (const p of samples) if (U.sd(room.shape, p.x, p.y) > 1) return false; }
      else for (const p of samples) for (const o of others) if (U.sd(o, p.x, p.y) < 6) return false;
      const c = U.centroid(s);
      if (U.sd(room.shape, c.x, c.y) > -4) return false;
      const ek = room.kind === 'rect' && thinWall(s) ? 0.72 : 1;
      for (const e of room.excl) if (U.sd(s, e.x, e.y) < e.r * ek) return false;
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
    if (room.kind === 'rect') return furnishRect(R, L, room, n, put);

    if (room.kind === 'circle') {
      // a round room is one clear figure: a ring round its heart, a ring cut into whole rooms by
      // spokes out to the rim (a doorway in each), a 2x2 of square blocks, a ring of round pillars
      // round a block, or one block or table in the middle
      const r = room.r, th = R() * TAU, cs = Math.cos(th), sn = Math.sin(th);
      const W = (lx, ly) => ({ x: c.x + lx * cs - ly * sn, y: c.y + lx * sn + ly * cs });
      const polar = (a, d) => ({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d });
      const rim = room.hub ? r - 2 : r + 14;   // how far a wall from the edge reaches out
      const style = R.weighted([['ring', r > 200 ? 1.5 : 0], ['ringspokes', r >= 290 ? (room.solo ? 8 : 3) : 0], ['pillars4', 1.6], ['colring', r >= 150 ? 1.6 : 0],
        ['pillar', r < 200 ? 1 : 0.4], ['table', r < 200 ? 0.8 : 0.2]]);
      room.style = style;
      const centre = (s) => { if (s > 24) put(U.rect(c.x, c.y, s, s * R.range(0.7, 1), th)); };
      if (style === 'pillars4') {
        if (r < 160) put(U.rect(c.x, c.y, r * 0.42, r * 0.3, th));
        else {
          const s = r * R.range(0.17, 0.22), off = r * R.range(0.3, 0.36);
          for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = W(i * off, j * off); put(U.rect(p.x, p.y, s, s, th)); }
          if (R.chance(0.5)) room.spots.push({ x: c.x, y: c.y });
        }
      } else if (style === 'ring' || style === 'ringspokes') {
        const ri = r * (style === 'ringspokes' ? R.range(0.38, 0.44) : R.range(0.42, 0.52)), N = Math.max(24, Math.round(ri / 9));
        const gaps = []; const ng = ri < 120 ? 2 : R.int(2, 3), g0 = R() * TAU;
        for (let i = 0; i < ng; i++) gaps.push(g0 + i * TAU / ng + R.range(-0.4, 0.4));
        const gh = 30 / ri;
        for (let i = 0; i < N; i++) {
          const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, am = (a0 + a1) / 2;
          if (gaps.some(g => Math.abs(U.angDiff(g, am)) < gh)) continue;
          const p0 = polar(a0, ri), p1 = polar(a1, ri);
          put(U.seg(p0.x, p0.y, p1.x, p1.y, PART, 1.6));
        }
        room.spots.push({ x: c.x, y: c.y });
        if (ri > 100 && R.chance(0.6)) centre(ri * R.range(0.5, 0.65));
        if (style === 'ringspokes') {
          // spokes from the ring to the rim cut the outer ring into whole rooms, a doorway in each,
          // by turns near the ring and near the rim
          const k = Math.max(4, Math.min(9, Math.round(TAU * (ri + r) / 2 / R.range(150, 200)))), off = R() * TAU;
          for (let i = 0; i < k; i++) {
            let a = off + i * TAU / k + R.range(-0.06, 0.06);
            const g0 = gaps.find(g => Math.abs(U.angDiff(g, a)) < 0.3);
            if (g0 != null) a = g0 + Math.sign(U.angDiff(g0, a) || 1) * 0.3;   // never in the mouth of a way through the ring
            const g = R.chance(0.4) ? (i % 2 ? ri + 36 : r - 36) : i % 2 ? R.range(ri + 90, (ri + r) / 2) : R.range((ri + r) / 2, r - 90);
            for (const [d0, d1] of [[ri, g - 28], [g + 28, rim]]) { if (d1 - d0 < 6) continue; const p0 = polar(a, d0), p1 = polar(a, d1); put(U.seg(p0.x, p0.y, p1.x, p1.y, PART, 0)); }
            room.spots.push(polar(a + Math.PI / k, (ri + r) / 2));
          }
        }
      } else if (style === 'colring') {
        // a ring of round pillars round a block
        const rr = r * R.range(0.56, 0.66), k = U.clamp(Math.round(TAU * rr / R.range(62, 72)), 8, 15), off = R() * TAU;
        for (let i = 0; i < k; i++) { const p = polar(off + i * TAU / k, rr); put(U.circle(p.x, p.y, 11)); }
        centre(Math.min(rr * 0.7, rr - 70) * R.range(0.8, 1));
        room.spots.push(polar(off + Math.PI / k, (rr + r) / 2));
      } else if (style === 'table') {
        const tw = R.range(70, 104), td = R.range(42, 56);
        const oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; oct.push(W(Math.cos(a) * tw / 2 / 0.92, Math.sin(a) * td / 2 / 0.92)); }
        put(U.poly(oct));
        const chairs = R.int(4, 6);
        for (let i = 0; i < chairs; i++) {
          const u = (i % 3 - 1) * tw * 0.33, v = (i < 3 ? -1 : 1) * (td / 2 + 13), p = W(u, v);
          put(U.rect(p.x, p.y, 13, 12, th + R.range(-0.4, 0.4)));
        }
      } else if (style === 'pillar') {
        centre(r * R.range(0.32, 0.4));
        room.spots.push(W(r * 0.6, 0));
      }
    }
  }

  // A square-built zone, in its own frame: x along w, y along h. Grids of square pillars (the
  // block and wing floors' colonnade), closets down a wall, slabs, a split wall with a way
  // through, walls jutting in; a hall gets alcoves or a line of posts. Every piece goes down
  // through put(), so one that would block a doorway or poke into a neighbour is left out.
  function furnishRect(R, L, room, n, put) {
    const c = room.c, ca = Math.cos(room.ang), sa = Math.sin(room.ang), hw = room.w / 2, hh = room.h / 2;
    const W = (x, y) => ({ x: c.x + x * ca - y * sa, y: c.y + x * sa + y * ca });
    const wall = (x0, y0, x1, y1, t) => { const p = W(x0, y0), q = W(x1, y1); return put(U.seg(p.x, p.y, q.x, q.y, t || PART, 0.5)); };
    // a wall in pieces of about 40, so the pieces a doorway rules out leave a gap
    const line = (x0, y0, x1, y1) => {
      const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40));
      for (let i = 0; i < k; i++) wall(x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k, x0 + (x1 - x0) * (i + 1) / k, y0 + (y1 - y0) * (i + 1) / k);
    };
    const block = (x, y, w, h) => { const p = W(x, y); return put(U.rect(p.x, p.y, w, h, room.ang), 44); };
    // the four sides as (where the wall face is, which way is in, how long it runs)
    const e = room.seamSide, inset = (k) => e[k] ? HW : 0;
    const sides = [
      { k: 'u0', at: -hw + inset('u0'), axis: 'x', dir: 1, len: room.h },
      { k: 'u1', at: hw - inset('u1'), axis: 'x', dir: -1, len: room.h },
      { k: 'v0', at: -hh + inset('v0'), axis: 'y', dir: 1, len: room.w },
      { k: 'v1', at: hh - inset('v1'), axis: 'y', dir: -1, len: room.w },
    ];
    // a wall square to a side, from its face going in d, at t along it
    const fromSide = (sd, t, d) => sd.axis === 'x' ? line(sd.at, t, sd.at + sd.dir * d, t) : line(t, sd.at, t, sd.at + sd.dir * d);
    const at = (sd, t, d) => sd.axis === 'x' ? { x: sd.at + sd.dir * d, y: t } : { x: t, y: sd.at + sd.dir * d };

    if (room.corr) {
      // the hall: a line of round posts down the middle, alcoves off one long side, or nothing
      const style = room.neck && room.w < 170 ? 'bare' : R.weighted([['alcoves', room.h >= 100 ? 0.6 : 0], ['posts', room.w > 380 && room.h >= 100 ? 2.5 : 0], ['bare', 1]]);
      room.style = 'hall-' + style;
      if (style === 'alcoves') {
        const sd = sides[R.chance(0.5) ? 2 : 3], d = room.h * R.range(0.32, 0.4), step = R.range(80, 110);
        for (let t = -hw + step; t < hw - 30; t += step) { fromSide(sd, t, d); const p = at(sd, t - step / 2, d / 2); room.spots.push(W(p.x, p.y)); }
      } else if (style === 'posts') {
        const step = R.range(90, 120);
        for (let t = -hw + step * 0.75; t < hw - step * 0.5; t += step) { const p = W(t, 0); put(U.circle(p.x, p.y, 11), 44); }
      }
      return;
    }
    const big = room.w >= 250 && room.h >= 250;
    const style = room.pill && big ? 'pillars' : room.tower ? R.weighted([['grid', 2], ['crates', 2], ['bare', 1]])
      : room.w * room.h >= 56000 && Math.max(room.w, room.h) >= 300 && R.chance(0.9) ? 'rooms'
      : R.weighted([['rooms', Math.max(room.w, room.h) >= 300 ? 3 : 0], ['slabs', 1.5], ['grid', big ? 2 : 0.8], ['table', big ? 1.4 : 0.5], ['crates', 0.6], ['bare', room.side ? 1 : 0.4]]);
    room.style = style;
    if (style === 'rooms') {
      // whole rooms in a row: walls right across the zone the short way, face to face, each with
      // one doorway, by turns near one side and the other; a deep zone has a room or two halved
      // again the long way. No wall lands in one of the zone's own doorways. In (t, s): t the long
      // way, s across.
      const long = room.w >= room.h, Lg = long ? room.w : room.h, Dp = long ? room.h : room.w;
      const L2 = (t0, s0, t1, s1) => long ? line(t0, s0, t1, s1) : line(s0, t0, s1, t1);
      const P2 = (t, s) => long ? W(t, s) : W(s, t);
      const toTS = (p) => { const dx = p.x - c.x, dy = p.y - c.y, x = dx * ca + dy * sa, y = -dx * sa + dy * ca; return long ? { t: x, s: y } : { t: y, s: x }; };
      const mouths = L.conns.filter(k => k.a === room || k.b === room).map(k => toTS(k.mouth));
      const sLo = -Dp / 2 + inset(long ? 'v0' : 'u0'), sHi = Dp / 2 - inset(long ? 'v1' : 'u1');
      const tLo = -Lg / 2 + inset(long ? 'u0' : 'v0'), tHi = Lg / 2 - inset(long ? 'u1' : 'v1');
      const k = Math.max(2, Math.min(4, Math.round(Lg / R.range(190, 250))));
      const deep = Dp >= 330, ms = deep ? Dp * R.range(-0.08, 0.08) : null;
      const clear = (t) => t - tLo >= 100 && tHi - t >= 100 && mouths.every(p => Math.abs(p.t - t) >= 82);
      const cuts = [];
      for (let i = 1; i < k; i++) {
        const base = -Lg / 2 + Lg * i / k;
        for (let tr = 0; tr < 12; tr++) { const t = base + Lg / k * R.range(-0.22, 0.22) * (tr ? 1.6 : 1); if (clear(t)) { cuts.push(t); break; } }
      }
      room.style = 'rooms' + (cuts.length + 1) + (deep ? 'd' : '');
      let near = R.chance(0.5);
      for (const t of cuts) {
        // (hard against the side, or far enough in that the wall beside it is no stub)
        const sm = (sLo + sHi) / 2, lim = ms == null ? [sm, sm] : [ms - 64, ms + 64];
        const fLo = inset(long ? 'v0' : 'u0') > 0 && (R.chance(0.45) || lim[0] < sLo + 96), fHi = inset(long ? 'v1' : 'u1') > 0 && (R.chance(0.45) || lim[1] > sHi - 96);
        const g = Dp < 170 ? sm : near ? (fLo ? sLo + 36 : R.range(sLo + 96, Math.max(sLo + 96, lim[0]))) : (fHi ? sHi - 36 : R.range(Math.min(sHi - 96, lim[1]), sHi - 96));
        if (g - 28 - sLo > 4) L2(t, sLo, t, g - 28);
        if (sHi - g - 28 > 4) L2(t, g + 28, t, sHi);
        const dm = P2(t, g); room.excl.push({ x: dm.x, y: dm.y, r: 46 });   // and nothing stands in it
        near = !near;
      }
      // one clear thing in a room, or nothing
      const feature = (t0, t1, s0, s1) => {
        const w = t1 - t0, d = s1 - s0, tc = (t0 + t1) / 2, sc = (s0 + s1) / 2;
        const f = R.weighted([['none', 1.4], ['block', w > 150 && d > 150 ? 2.2 : 0], ['grid', w >= 230 && d >= 230 ? 1.8 : 0], ['row', w >= 270 && d >= 150 ? 1.2 : 0], ['pillars', w >= 260 && d >= 150 ? 1 : 0]]);
        const sq = (t, s, a, b) => { const p = P2(t, s); return put(U.rect(p.x, p.y, long ? a : b, long ? b : a, room.ang), 44); };
        if (f === 'block') {
          const a = Math.min(R.range(70, 130), w - 130), b = Math.min(R.range(40, 80), d - 130);
          if (a > 30 && b > 24) { const x = tc + R.range(-0.1, 0.1) * w, y = sc + R.range(-0.1, 0.1) * d; if (sq(x, y, a, b) && R.chance(0.35)) sq(x + (R.chance(0.5) ? 1 : -1) * (a / 2 - 15), y + (b / 2 + 22) * (R.chance(0.5) ? 1 : -1), 30, 44); }
        } else if (f === 'grid' || f === 'row') {
          const sz = R.range(36, 46), st = sz + R.range(36, 50), [ki, kj] = f === 'grid' ? [2, 2] : [3, 1];
          for (let i = 0; i < ki; i++) for (let j = 0; j < kj; j++) sq(tc + (i - (ki - 1) / 2) * st, sc + (j - (kj - 1) / 2) * st, sz, sz);
        } else if (f === 'pillars') {
          const m = Math.max(3, Math.floor((w - 110) / 62));
          for (let i = 0; i < m; i++) { const p = P2(tc + (i - (m - 1) / 2) * 62, sc); put(U.circle(p.x, p.y, 11), 40); }
        }
        room.style += '+' + f;
      };
      const edges = [tLo].concat(cuts, [tHi]);
      for (let i = 0; i + 1 < edges.length; i++) {
        const b0 = edges[i], b1 = edges[i + 1];
        if (deep && b1 - b0 >= 190 && R.chance(0.7) && mouths.every(p => Math.abs(p.s - ms) >= 70)) {
          const g = R.chance(0.5) ? R.range(b0 + 100, b1 - 100) : R.chance(0.5) ? b0 + 38 : b1 - 38;
          if (g - 30 - b0 > 4) L2(b0, ms, g - 30, ms);
          if (b1 - g - 30 > 4) L2(g + 30, ms, b1, ms);
          const dm = P2(g, ms); room.excl.push({ x: dm.x, y: dm.y, r: 46 });
          room.spots.push(P2((b0 + b1) / 2, (sLo + ms) / 2), P2((b0 + b1) / 2, (ms + sHi) / 2));
          if (ms - sLo > sHi - ms) feature(b0, b1, sLo, ms); else feature(b0, b1, ms, sHi);
        } else {
          room.spots.push(P2((b0 + b1) / 2, (sLo + sHi) / 2));
          feature(b0, b1, sLo, sHi);
        }
      }
    } else if (style === 'pillars') {
      // the grand hall: two rows of square pillars, 34 wide, down the long way
      const long = room.w >= room.h, Lg = long ? room.w : room.h, k = Lg > 330 ? 4 : 3, A = Lg * R.range(0.2, 0.24), B = (long ? room.h : room.w) * R.range(0.2, 0.24);
      for (let i = 0; i < k; i++) for (const j of [-1, 1]) { const u = (i - (k - 1) / 2) * A, x = long ? u : j * B, y = long ? j * B : u, p = W(x, y); put(U.rect(p.x, p.y, 34, 34, room.ang)); }
      room.spots.push(W(long ? A / 2 : 0, long ? 0 : A / 2));
    } else if (style === 'grid' || style === 'crates') {
      // pale blocks in a 2x2 or a row of three, or a tight stack of crates in a corner
      const s = style === 'grid' ? R.range(32, 46) : R.range(22, 30), st = style === 'grid' ? s + R.range(34, 52) : s + R.range(3, 6);
      const [ki, kj] = style === 'grid' ? R.pick([[2, 2], [3, 1], [1, 3]]) : R.pick([[2, 2], [3, 2], [2, 3]]);
      const cx = style === 'grid' ? R.range(-0.12, 0.12) * room.w : (R.chance(0.5) ? 1 : -1) * (hw - 40 - ki * st / 2), cy = style === 'grid' ? R.range(-0.12, 0.12) * room.h : (R.chance(0.5) ? 1 : -1) * (hh - 40 - kj * st / 2);
      for (let i = 0; i < ki; i++) for (let j = 0; j < kj; j++) {
        if (style === 'crates' && i + j > 0 && R.chance(0.2)) continue;
        const p = W(cx + (i - (ki - 1) / 2) * st, cy + (j - (kj - 1) / 2) * st);
        put(U.rect(p.x, p.y, s, s, room.ang + (style === 'crates' ? R.range(-0.12, 0.12) : 0)));
      }
      room.spots.push(W(cx + (cx > 0 ? -1 : 1) * (ki * st / 2 + 40), cy));
    } else if (style === 'table') {
      // a long table with a few crates against a wall
      const along = room.w >= room.h, tl = Math.min(R.range(130, 190), (along ? room.w : room.h) - 130), tw = R.range(30, 38);
      block(0, 0, along ? tl : tw, along ? tw : tl);
      for (let t = 0, k = 0; t < 10 && k < 3; t++) { const sx = (R.chance(0.5) ? 1 : -1) * (hw - 36), sy = R.range(-hh + 40, hh - 40), p = along ? W(R.range(-hw + 40, hw - 40), (R.chance(0.5) ? 1 : -1) * (hh - 34)) : W(sx, sy); if (put(U.rect(p.x, p.y, 26, 26, room.ang))) k++; }
      room.spots.push(W(along ? 0 : hw / 2, along ? hh / 2 : 0));
    } else if (style === 'slabs') {
      // one big pale slab, now and then an L
      for (let t = 0; t < 30; t++) {
        const x = R.range(-hw * 0.3, hw * 0.3), y = R.range(-hh * 0.3, hh * 0.3), along = R.chance(0.5);
        const a = R.range(70, 130), b = R.range(30, 52), w = along ? a : b, h = along ? b : a;
        if (!block(x, y, w, h)) continue;
        if (R.chance(0.35)) { const sx = R.chance(0.5) ? 1 : -1, sy = R.chance(0.5) ? 1 : -1; if (along) block(x + sx * (a / 2 - b / 2), y + sy * (b / 2 + 22), b, 44); else block(x + sx * (b / 2 + 22), y + sy * (a / 2 - b / 2), 44, b); }
        room.spots.push(W(x + (along ? 0 : 50), y + (along ? 50 : 0)));
        break;
      }
    }
  }


  // A zone of a round mass, in its own polar frame: a row of whole wedge rooms, walled from the
  // inner wall to the outer one with a doorway in each wall, a deep one halved again by a curved
  // wall, and in each room one clear thing at most; or, where the mass's colonnade runs, its grand
  // hall. In a zone built with straight sides the walls run square to those sides. Walls go down
  // in short pieces, so a piece that would block a doorway is simply left out and leaves a gap.
  function furnishCell(R, L, room, n) {
    const o = room.o, a0 = room.a0, a1 = room.a1, r0 = room.r0, r1 = room.r1, T = r1 - r0, tol = room.tol, Pl = room.pod, fc = room.fc;
    const mid = (a0 + a1) / 2, md = dir(mid), tg = { x: -md.y, y: md.x }, rref = (r0 + r1) / 2;
    // a point at angle a and radius r; in a straight-sided zone, the point at depth r on the line
    // a 'radial' wall at angle a runs down, square to the zone's faces
    const sOf = (a) => rref * fc * Math.tan(a - mid);
    const pt = fc ? (a, r) => ({ x: o.x + md.x * r * fc + tg.x * sOf(a), y: o.y + md.y * r * fc + tg.y * sOf(a) }) : (a, r) => ({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r });
    const squareTo = (a) => fc ? mid : a;
    const placed = [];
    const fits = (q, m) => { const p = polarOf(room, q.x, q.y); return p.r >= r0 - tol.in + m && p.r <= r1 + tol.out - m && (p.a - a0) * p.r >= -tol.a0 + m && (a1 - p.a) * p.r >= -tol.a1 + m && !inBite(room, p, m); };
    const fitsAll = (s, spacing, m) => {
      const samples = [];
      if (s.k === 'c') { for (let i = 0; i < 8; i++) samples.push({ x: s.x + Math.cos(i / 8 * TAU) * s.r, y: s.y + Math.sin(i / 8 * TAU) * s.r }); }
      else for (let i = 0; i < s.pts.length; i++) { const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length]; samples.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }
      for (const q of samples) if (!fits(q, m || 0)) return false;
      const c = U.centroid(s);
      if (!inCell(room, c.x, c.y, 2)) return false;
      const ek = thinWall(s) ? 0.72 : 1;
      for (const e of room.excl) if (U.sd(s, e.x, e.y) < e.r * ek) return false;
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
      if (fc) { line(pt(b0, r), pt(b1, r), t); return; }
      const k = Math.max(1, Math.ceil(Math.abs(b1 - b0) * r / chord(r)));
      for (let i = 0; i < k; i++) { const p = pt(b0 + (b1 - b0) * i / k, r), q = pt(b0 + (b1 - b0) * (i + 1) / k, r); put(U.seg(p.x, p.y, q.x, q.y, t || PART, 1.5)); }
    };
    const back = { out: r1 + tol.out - 3, in: r0 - tol.in + 3 };   // how far a wall reaches into the shared wall behind it
    // the zone's own doorways, so a wall across it never lands in one
    const mouths = L.conns.filter(k => k.a === room || k.b === room).map(k => polarOf(room, k.mouth.x, k.mouth.y));
    // big pale blocks standing in the open, square to the radius, now and then an L
    const blocks = (k, b0, b1, rlo, rhi) => {
      for (let t = 0, got = 0; t < 40 && got < k; t++) {
        const a = R.range(b0, b1), r = R.range(rlo, rhi), c = pt(a, r), w = R.range(56, 104), h = R.range(48, 96), b = squareTo(a);
        if (R.chance(0.35)) {
          // an L: a long bar and a short one off its end
          const th = R.range(26, 34), ux = -Math.sin(b), uy = Math.cos(b), vx = Math.cos(b), vy = Math.sin(b), sd = R.chance(0.5) ? 1 : -1;
          const bar = U.rect(c.x, c.y, w * 1.3, th, b + Math.PI / 2);
          const ex = c.x + ux * (w * 0.65 - th / 2) * sd + vx * (h / 2 - th / 2), ey = c.y + uy * (w * 0.65 - th / 2) * sd + vy * (h / 2 - th / 2);
          if (put(bar, 60, 30)) { if (!put(U.rect(ex, ey, h, th, b), 60, 30)) { /* the bar alone will do */ } got++; }
        } else if (put(U.rect(c.x, c.y, h, w, b), 60, 30)) got++;
      }
    };
    // the colonnade: two staggered rows of pillars at even steps along the hall's curve, or down
    // a straight-sided block in two straight rows
    const colonnade = () => {
      const pr = 11;
      [Pl.colR, Pl.colR + Pl.colGap].forEach((r, row) => {
        if (fc) {
          const S = r * fc * Math.tan((a1 - a0) / 2), st = Pl.colStep;
          for (let s = -Math.floor(S / st) * st + (row ? st / 2 : 0); s <= S; s += st) put(U.circle(o.x + md.x * r * fc + tg.x * s, o.y + md.y * r * fc + tg.y * s, pr), 0, 22);
          return;
        }
        const st = Pl.colStep / r, ph = Pl.rot + (row ? st / 2 : 0);
        const k0 = Math.ceil((a0 - ph) / st), k1 = Math.floor((a1 - ph) / st);
        for (let k = k0; k <= k1; k++) { const p = pt(ph + k * st, r); put(U.circle(p.x, p.y, pr), 0, 22); }
      });
      room.spots.push(pt((a0 + a1) / 2, Pl.colR + Pl.colGap / 2));
    };
    // one clear thing in a room, or nothing: a block (or an L), a 2x2 of squares, a row of three,
    // a short run of round pillars along the curve, a long table with its crates
    const feature = (b0, b1, q0, q1) => {
      const qc = (q0 + q1) / 2, w = (b1 - b0) * qc, d = q1 - q0, cm = (b0 + b1) / 2, b = squareTo(cm);
      const f = R.weighted([['none', 1.4], ['block', w > 150 && d > 150 ? 2.2 : 0], ['grid', w >= 230 && d >= 230 ? 1.8 : 0], ['row', w >= 270 && d >= 150 ? 1.2 : 0],
        ['pillars', w >= 260 && d >= 150 ? 1.2 : 0], ['table', w >= 240 && d >= 190 ? 0.7 : 0]]);
      if (f === 'block') blocks(1, cm - (b1 - b0) * 0.12, cm + (b1 - b0) * 0.12, qc - d * 0.1, qc + d * 0.1);
      else if (f === 'grid' || f === 'row') {
        const sz = R.range(36, 46), st = sz + R.range(36, 50), [ki, kj] = f === 'grid' ? [2, 2] : [1, 3], c = pt(cm, qc), ur = dir(b), ut = { x: -ur.y, y: ur.x };
        for (let i = 0; i < ki; i++) for (let j = 0; j < kj; j++) {
          const x = c.x + ur.x * (i - (ki - 1) / 2) * st + ut.x * (j - (kj - 1) / 2) * st, y = c.y + ur.y * (i - (ki - 1) / 2) * st + ut.y * (j - (kj - 1) / 2) * st;
          put(U.rect(x, y, sz, sz, b), 44, 30);
        }
      } else if (f === 'pillars') {
        const k = Math.max(3, Math.floor((w - 110) / 62));
        for (let i = 0; i < k; i++) { const p = pt(cm + (i - (k - 1) / 2) * 62 / qc, qc); put(U.circle(p.x, p.y, 11), 40, 30); }
      } else if (f === 'table') {
        const c = pt(cm, qc), tl = Math.min(R.range(120, 170), w - 130);
        put(U.rect(c.x, c.y, R.range(30, 38), tl, b), 50, 40);
        const ca = R.chance(0.5) ? b0 + 54 / q1 : b1 - 54 / q1, cc = pt(ca, q1 - 40), ur = dir(squareTo(ca)), ut = { x: -ur.y, y: ur.x }, cs = R.range(22, 28);
        for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (i + j === 0 || R.chance(0.7)) put(U.rect(cc.x - (ur.x * i - ut.x * j) * (cs + 4), cc.y - (ur.y * i - ut.y * j) * (cs + 4), cs, cs, squareTo(ca) + R.range(-0.1, 0.1)), 0, 16);
      }
      room.style += '+' + f;
    };

    const hasCol = room.col && Pl.colR != null && Pl.colR - 40 >= r0 && Pl.colR + Pl.colGap + 40 <= r1;
    if (hasCol) {
      // the grand hall: the colonnade and nothing else, so it reads as one long room
      room.style = 'hall';
      colonnade();
      return;
    }
    // Rooms: walls right across the zone from its inner wall to its outer one, each with one
    // doorway, so the zone is a row of whole wedge rooms about 170-250 round; a deep zone is cut
    // again by a curved wall between two of them, also with a doorway. No wall lands in one of the
    // zone's own doorways, so each runs unbroken face to face.
    const span = a1 - a0, rm = (r0 + r1) / 2, arcLen = span * rm;
    const k = Math.max(1, Math.min(4, Math.round(arcLen / R.range(180, 250))));
    const deep = T >= 280, rs = deep ? r0 + T * R.range(0.44, 0.56) : null;
    const clear = (a) => (a - a0) * Math.max(r0, 90) >= 100 && (a1 - a) * Math.max(r0, 90) >= 100 && mouths.every(p => Math.abs(a - p.a) * p.r >= 82)
      && !(room.bites || []).some(b => a >= b.b0 - 70 / r1 && a <= b.b1 + 70 / r1);   // nor runs out into a bite
    const cuts = [];
    for (let i = 1; i < k; i++) {
      const base = a0 + span * i / k;
      for (let t = 0; t < 12; t++) { const a = base + span / k * R.range(-0.22, 0.22) * (t ? 1.6 : 1); if (clear(a)) { cuts.push(a); break; } }
    }
    room.style = 'rooms' + (cuts.length + 1) + (deep ? 'd' : '');
    let inner = R.chance(0.5);
    for (const a of cuts) {
      // the doorway in each wall by turns near the inner and the outer end, so the way through weaves
      // (hard against the wall, or far enough out that the wall beside it is no stub)
      const lim = rs ? [rs - 64, rs + 64] : [rm, rm];
      // (hard against a wall only where there is one: against the open edge it would read as a stub)
      const fIn = tol.in <= 8 && (R.chance(0.45) || lim[0] < r0 + 96), fOut = tol.out <= 8 && (R.chance(0.45) || lim[1] > r1 - 96);
      const g = T < 170 ? rm : inner ? (fIn ? r0 + 36 : R.range(r0 + 96, Math.max(r0 + 96, lim[0]))) : (fOut ? r1 - 36 : R.range(Math.min(r1 - 96, lim[1]), r1 - 96));
      if (g - 28 - r0 > 4) radial(a, back.in, g - 28);
      if (r1 - g - 28 > 4) radial(a, g + 28, back.out);
      const dm = pt(a, g); room.excl.push({ x: dm.x, y: dm.y, r: 46 });   // and nothing stands in it
      inner = !inner;
    }
    const edges = [a0].concat(cuts, [a1]);
    for (let i = 0; i + 1 < edges.length; i++) {
      const b0 = edges[i], b1 = edges[i + 1];
      // the curved wall across a deep room, kept out of the zone's doorways on its spoke sides
      const split = deep && (b1 - b0) * rs >= 190 && R.chance(0.7) && mouths.every(p => Math.abs(p.r - rs) >= 70);
      if (split) {
        const e0 = i === 0 ? 8 / rs : 0, e1 = i === edges.length - 2 ? 8 / rs : 0, gh = 30 / rs, g = R.chance(0.5) ? R.range(b0 + 100 / rs, b1 - 100 / rs) : R.chance(0.5) ? b0 + 38 / rs : b1 - 38 / rs;
        if ((g - gh - b0) * rs > 4) arc(rs, b0 - e0, g - gh);
        if ((b1 - g - gh) * rs > 4) arc(rs, g + gh, b1 + e1);
        const dm = pt(g, rs); room.excl.push({ x: dm.x, y: dm.y, r: 46 });
        room.spots.push(pt((b0 + b1) / 2, (r0 + rs) / 2), pt((b0 + b1) / 2, (rs + r1) / 2));
        // only the bigger of the two halves gets a feature
        if (rs - r0 > r1 - rs) feature(b0, b1, r0, rs); else feature(b0, b1, rs, r1);
      } else {
        room.spots.push(pt((b0 + b1) / 2, rm));
        feature(b0, b1, r0, r1);
      }
    }
  }

  // a star is at risk if a walker's beat passes within reach of it, or a post or a camera can look at it
  function starRisk(L, field, st) {
    const D = L.D;
    for (const g of L.guards) {
      if (g.path) {
        for (let i = 0; i < g.path.length; i++) {
          const a = g.path[i], b = g.path[(i + 1) % g.path.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
          const t = U.clamp(((st.x - a.x) * dx + (st.y - a.y) * dy) / l2, 0, 1);
          if (Math.hypot(a.x + dx * t - st.x, a.y + dy * t - st.y) < 55) return true;
        }
        continue;
      }
      if (looksAt(field, g.x, g.y, g.ang, g.amp + D.fov, D.coneLen * 0.9, st)) return true;
    }
    for (const c of L.cams) if (looksAt(field, c.x + Math.cos(c.base) * 6, c.y + Math.sin(c.base) * 6, c.base, c.amp + 0.42, D.coneLen, st)) return true;
    return false;
  }
  function looksAt(field, x, y, face, half, reach, p) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d > reach || d < 1) return d < 1;
    if (Math.abs(U.angDiff(face, Math.atan2(dy, dx))) > half) return false;
    return field.ray(x, y, dx / d, dy / d, d) >= d - 8;
  }

  // ── guards ─────────────────────────────────────────────────
  function placeGuards(R, L, field, nav, n, loose) {
    const D = L.D, homes = [];
    const farFromStart = (p, d) => Math.hypot(p.x - L.entrance.x, p.y - L.entrance.y) > d;
    const okHome = (p) => p && farFromStart(p, 290) && Math.hypot(p.x - L.exit.x, p.y - L.exit.y) > 50 && homes.every(h => Math.hypot(h.x - p.x, h.y - p.y) > 80);
    // nobody stands in a doorway: a post or a stop is kept back from every mouth
    const nearMouth = (p, d) => L.conns.some(c => Math.hypot(c.mouth.x - p.x, c.mouth.y - p.y) < d);
    // and the first door out of the stairs room is left clear of every beat, so the way on is a choice of timing
    const first = L.rooms.find(r => r.idx === 0 && !r.side).outConn.mouth;
    const offFirst = (p) => Math.hypot(first.x - p.x, first.y - p.y) > 90;
    // and so is each locked door, both sides of it: you come through one into the open, not into a beat
    const offLocks = (p) => L.doors.every(d => Math.hypot(d.conn.mouth.x - p.x, d.conn.mouth.y - p.y) > 90);
    // and nobody stands guard over a key: the pickup you must have is reached on timing, never through a
    // stare. A star is a dare instead: a post or a beat may come right up to one (but not stand on it)
    const offItems = (p, d) => L.keys.every(o => Math.hypot(o.x - p.x, o.y - p.y) > d) && L.stars.every(o => Math.hypot(o.x - p.x, o.y - p.y) > Math.min(d, 30));
    // a sentry's post: its own, looser check, so posts get placed at all (closer to the stairs and to one another than a walker's start)
    const okPost = (p) => p && farFromStart(p, 220) && Math.hypot(p.x - L.exit.x, p.y - L.exit.y) > 50 && homes.every(h => Math.hypot(h.x - p.x, h.y - p.y) > 60);
    const roomOf = new Map();   // which room each guard was placed for, so a top-up post can take a walker's place
    const sentryAt = (room, snap) => {
      const a = R() * TAU, e = extent(room, a);
      const p = field.nearestFree(room.c.x + Math.cos(a) * e * 0.7, room.c.y + Math.sin(a) * e * 0.7, 16, 50);
      // and a post stands in a room, never in a hall or a neck the way on has to use
      if (!okPost(p) || nearMouth(p, 60) || !offFirst(p) || !offItems(p, 75) || field.sample(p.x, p.y) < 26) return null;
      const face = Math.atan2(room.c.y - p.y, room.c.x - p.x) + R.range(-0.4, 0.4);
      // its sweep always swings wider than its eyes, so even the lane straight down its middle goes dark for part of the cycle
      const gd = { kind: 'sentry', x: p.x, y: p.y, ang: face, amp: Math.max(R.range(0.55, 1.05), D.fov + 0.25), snap: snap === undefined ? D.snap && R.chance(0.5) : snap };
      // where its sweep starts, fixed by where it stands, so the timed check and the game keep the same clock
      gd.sweep0 = Math.abs(p.x * 0.37 + p.y * 0.71) % 10;
      L.guards.push(gd); roomOf.set(gd, room);
      homes.push(p);
      return gd;
    };
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

    // a camera on a room's wall, looking in (and from the tenth floor perhaps its twin): how many went up
    const camIn = (room) => {
      // on the wall, looking in
      // and no camera's sweep covers a key or either side of a locked door: those you must reach, so
      // the arc you can see is always one you can time, never a stare you have to walk through
      const musts = L.keys.map(k => ({ x: k.x, y: k.y }));
      for (const d of L.doors) for (const sg of [-1, 1]) musts.push({ x: d.conn.mouth.x + d.conn.normal.x * 20 * sg, y: d.conn.mouth.y + d.conn.normal.y * 20 * sg });
      const sweepsMust = (q, face, amp) => {
        const ex = q.x + Math.cos(face) * 6, ey = q.y + Math.sin(face) * 6, reach = D.coneLen * 1.05 + 20;
        return musts.some(m => {
          const dx = m.x - ex, dy = m.y - ey, d = Math.hypot(dx, dy);
          if (d > reach) return false;
          if (d > 1 && field.ray(ex, ey, dx / d, dy / d, d) < d - 8) return false;
          return Math.abs(U.angDiff(face, Math.atan2(dy, dx))) < amp + 0.42 + 0.2;
        });
      };
      // its sweep swings well past its eyes, so the lane straight down its middle goes dark for a real while
      const amp = R.range(0.68, 0.9);
      const camAt = (a) => {
        const e = extent(room, a);
        const inward = { x: room.c.x + Math.cos(a) * (e - 36), y: room.c.y + Math.sin(a) * (e - 36) };
        if (field.sample(inward.x, inward.y) < 16) return null;
        // in from the edge until it's just off the wall face, so it sees from the room, not from inside the wall
        let q = null;
        for (let d = 6; d <= 26 && !q; d += 4) {
          const c = { x: room.c.x + Math.cos(a) * (e - d), y: room.c.y + Math.sin(a) * (e - d) }, v = field.sample(c.x, c.y);
          if (v >= 1.5 && v <= 8) q = c;
        }
        if (!q || !okHome(q) || !farFromStart(q, 380) || nearMouth(q, 60) || !offItems(q, 75)) return null;
        if (field.ray(q.x - Math.cos(a) * 6, q.y - Math.sin(a) * 6, -Math.cos(a), -Math.sin(a), 120) < 90) return null;   // a clear look into the room
        // and a long one: a camera staring at a wall a few steps off is a tripwire, not a sweep you can time
        if (field.ray(q.x - Math.cos(a) * 6, q.y - Math.sin(a) * 6, -Math.cos(a), -Math.sin(a), 400) < 150) return null;
        if (sweepsMust(q, a + Math.PI, amp)) return null;
        return q;
      };
      let p = null, face = 0, pa = 0;
      for (let s = 0; s < 12 && !p; s++) {
        const a = R() * TAU, q = camAt(a);
        if (q) { p = q; face = a + Math.PI; pa = a; }
      }
      if (!p) return 0;
      // from the ninth floor some cameras pan quick
      const quick = n >= 9 && R.chance(0.5);
      const cam = { x: p.x, y: p.y, base: face, amp, period: quick ? R.range(3, 4) : R.range(5, 8), phase: R() * TAU };
      L.cams.push(cam); roomOf.set(cam, room);
      homes.push(p); let placed = 1;   // a camera is on top of the room's guards, not one of them
      // from the tenth floor a camera may have a twin on the far wall, half a sweep behind, so
      // the gap in one's sweep is the other's stare
      if (D.camPairs && R.chance(0.6)) for (let s = 0; s < 6; s++) {
        const a = pa + Math.PI + R.range(-0.35, 0.35), q = camAt(a);
        if (!q || Math.hypot(q.x - p.x, q.y - p.y) < 160) continue;
        const twin = { x: q.x, y: q.y, base: a + Math.PI, amp: cam.amp, period: cam.period, phase: cam.phase + Math.PI, twin: true };
        L.cams.push(twin); roomOf.set(twin, room);
        homes.push(q); placed++;
        break;
      }
      return placed;
    };

    // a walker's beat in a room (a round, a pace, or a beat through one of its doorways), and from the
    // seventh floor perhaps its pair (pairOK: the room has a place for it): how many went on it, 0 if none fits
    const beatIn = (room, kind, pairOK) => {
      const th = R() * TAU;
      // doorways out of this room that a guard may walk through (never a locked one)
      const ways = L.conns.filter(c => (c.a === room || c.b === room) && !L.doors.some(d => d.conn === c));
      let way = [];
      if (kind === 'patrol' && n >= 4 && ways.length && R.chance(0.25)) {
        // a beat through a doorway: one stop in this room, one in the next, so the door is watched
        const open = ways.filter(w => offFirst(w.mouth));
        if (!open.length) return 0;
        const c = R.pick(open), d = c.dirFrom(room);
        for (const sgn of [-1, 1]) {
          const e = R.range(70, 110), p = field.nearestFree(c.mouth.x + d.x * e * sgn, c.mouth.y + d.y * e * sgn, 16, 50);
          if (p) way.push({ x: p.x, y: p.y, pause: R.range(0.8, 1.8), look: R.range(0.7, 1.2) });
        }
        if (way.length < 2 || Math.hypot(way[0].x - way[1].x, way[0].y - way[1].y) < 100) return 0;
      } else if (kind === 'patrol') {
        // a round wants a room to walk: in a hall or a neck it would only mill about in the one way through
        if (room.corr || room.neck) return 0;
        const K = R.int(3, 5);
        for (let i = 0; i < K; i++) {
          const a = th + i * TAU / K + R.range(-0.3, 0.3), e = extent(room, a) * R.range(0.45, 0.72);
          const p = field.nearestFree(room.c.x + Math.cos(a) * e, room.c.y + Math.sin(a) * e, 16, 60);
          if (p && way.every(w => Math.hypot(w.x - p.x, w.y - p.y) > 50)) way.push({ x: p.x, y: p.y, pause: R.chance(0.6) && !nearMouth(p, 60) ? R.range(0.4, 1.4) : 0, look: R.range(0.5, 1.1) });
        }
        if (way.length < 3) return 0;
        // and a round that never gets far from one spot is a post nobody can time: it spans the room
        let span = 0; for (const a of way) for (const b of way) span = Math.max(span, Math.hypot(a.x - b.x, a.y - b.y));
        if (span < 120) return 0;
      } else {
        // (the first floors keep their halls clear: the way between two rooms is learned before it is guarded)
        if (n <= 2 && (room.corr || room.neck)) return 0;
        const e = extent(room, th) * 0.62, e2 = extent(room, th + Math.PI) * 0.62;
        const a = field.nearestFree(room.c.x + Math.cos(th) * e, room.c.y + Math.sin(th) * e, 16, 50);
        const b = field.nearestFree(room.c.x - Math.cos(th) * e2, room.c.y - Math.sin(th) * e2, 16, 50);
        if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 90 || nearMouth(a, 60) || nearMouth(b, 60)) return 0;
        way = [{ x: a.x, y: a.y, pause: R.range(0.8, 1.8), look: R.range(0.6, 1.2) }, { x: b.x, y: b.y, pause: R.range(0.8, 1.8), look: R.range(0.6, 1.2) }];
      }
      const path = route(way, true);
      if (!path) return 0;
      let len = 0; for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; len += Math.hypot(b.x - a.x, b.y - a.y); }
      if (len > loopLen(way) * 1.7 + 60) return 0;   // a route that wanders off to get round something
      // start somewhere along it, away from the entrance
      const si = R.int(0, path.length - 1), sp = path[si];
      if (!okHome(sp) || !offItems(sp, 45) || path.some(q => !farFromStart(q, 200) || !offFirst(q) || !offLocks(q))) return 0;
      if (L.guards.length >= budget) return 0;
      const prev = path[(si - 1 + path.length) % path.length];
      // from the sixth floor some walkers finish a search by checking the nearest shade, more of them as you climb
      const peek = n >= 6 && R.chance(0.25 + 0.03 * (n - 6));
      const wk = { kind, x: sp.x, y: sp.y, ang: Math.atan2(sp.y - prev.y, sp.x - prev.x), path, pi: si, peek };
      L.guards.push(wk); roomOf.set(wk, room);
      homes.push(sp); let placed = 1;
      // from the seventh floor a long loop may carry a pair, the second half a lap behind the first
      if (n >= 7 && kind === 'patrol' && way.length >= 3 && L.guards.length < budget && pairOK && R.chance(0.35)) {
        const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
        const at = (cum[si] + len / 2) % len;
        let sj = 0; for (let i = 0; i < path.length; i++) if (cum[i] <= at) sj = i;
        const sq = path[sj], pq = path[(sj - 1 + path.length) % path.length];
        if (len > 420 && Math.hypot(sq.x - sp.x, sq.y - sp.y) > 120 && farFromStart(sq, 290) && offItems(sq, 45)) {
          const pr = { kind, x: sq.x, y: sq.y, ang: Math.atan2(sq.y - pq.y, sq.x - pq.x), path, pi: sj, peek, pair: true };
          L.guards.push(pr); roomOf.set(pr, room);
          homes.push(sq); placed++;
        }
      }
      return placed;
    };

    // how many in each room, then trimmed from the busiest rooms down to the floor's budget
    const counts = new Map(), small = (room) => (room.kind === 'circle' ? 2 * room.r : Math.max(room.w, room.h)) < 300;
    for (const room of L.rooms) {
      if (room.idx === 0 && !room.side && n < 4) continue;
      if (room.side && R.chance(n >= 2 ? 0.45 : 0.85)) continue;
      const area = room.kind === 'circle' ? Math.PI * room.r * room.r : room.w * room.h;
      let count = Math.max(1, Math.round(area / 100000 * D.density * R.range(0.8, 1.15)));
      if (n === 1) count = 1;
      // and a small room holds at most two watchers (cameras too), so it is never crossed by three looks at once
      counts.set(room, Math.min(count, small(room) ? 2 : 3));
    }
    const budget = watchBudget(L, n);
    for (let sum = [...counts.values()].reduce((a, b) => a + b, 0); sum > budget; sum--) {
      let top = null; for (const [r, c] of counts) if (c > 1 && (!top || c > counts.get(top) || (c === counts.get(top) && R.chance(0.5)))) top = r;
      if (!top) { const rs = [...counts.keys()].filter(r => r.side || r.idx > 0); if (!rs.length) break; counts.delete(R.pick(rs)); continue; }
      counts.set(top, counts.get(top) - 1);
    }
    for (const room of L.rooms) {
      if (!counts.has(room)) continue;
      const count = counts.get(room);
      let cams = 0;
      // no camera in a hall, a neck or a tower: there is no way round its look, only through it
      const camCap = room.corr || room.neck || room.tower ? 0 : small(room) ? Math.max(0, 2 - count) : (room.kind === 'circle' ? room.r : room.R) > 240 ? 2 : 1;
      // (and the floor as a whole stops at its budget, short of the cameras it is still owed (camFloor): a pair of
      // walkers on one loop, or the cameras put up after, never takes it past)
      const full = () => L.guards.length + L.cams.length + Math.max(0, (D.cams ? camFloor(n) : 0) - L.cams.length) >= budget;
      for (let k = 0, t = 0; k < count && !full() && t < (loose ? 24 : 48); t++) {
        // never a post in the room just past the stairs room: its only way in is that first door
        const second = room.idx === 1 && !room.side;
        const kind = R.weighted([['patrol', 4.5], ['pace', 2.5], ['sentry', second ? 0 : (room.side ? 3 : 2) + (n >= 3 && n < 9 ? 1 : 0)], ['cam', D.cams && cams < camCap ? 1.4 : 0]]);
        // a camera is one of the room's watchers, not one on top of them, so a floor's count stays near its budget
        if (kind === 'cam') { const c = camIn(room); cams += c; k += c; continue; }
        if (kind === 'sentry') {
          if (sentryAt(room)) k++;
          continue;
        }
        k += beatIn(room, kind, k < count + 1 && L.guards.length + Math.max(L.cams.length, D.cams ? camFloor(n) : 0) + 2 <= budget);
      }
    }
    // the mix: from the third floor at least one post stands still in a room, and from the thirteenth at
    // least two of them whip their heads round, so a floor is never all walkers. Short of that, rooms
    // are tried again for a post; at the budget, the post takes the place of one of that room's walkers
    const want = n >= 3 ? 1 : 0, wantSnap = D.snap ? 2 : 0;
    const posts = () => L.guards.filter(g => g.kind === 'sentry');
    for (const g of posts()) if (posts().filter(o => o.snap).length < wantSnap && !g.snap) g.snap = true;
    const pool = L.rooms.filter(r => counts.has(r) && !(r.idx === 1 && !r.side));
    for (let t = 0; t < 120 && pool.length && (posts().length < want || posts().filter(o => o.snap).length < wantSnap); t++) {
      const room = R.pick(pool);
      const swap = L.guards.length >= budget ? L.guards.find(g => roomOf.get(g) === room && g.kind !== 'sentry' && !g.pair) : null;
      if (L.guards.length >= budget && !swap) continue;
      if (swap) { const hi = homes.findIndex(h => h.x === swap.x && h.y === swap.y); L.guards.splice(L.guards.indexOf(swap), 1); if (hi >= 0) homes.splice(hi, 1); }
      const gd = sentryAt(room, posts().filter(o => o.snap).length < wantSnap);
      if (!gd && swap) { L.guards.push(swap); homes.push({ x: swap.x, y: swap.y }); }
    }
    const inRoomN = (room) => L.guards.concat(L.cams).filter(g => roomOf.get(g) === room).length;
    // from the sixth floor the cameras are never all missing: short of its share, cameras go up in rooms that can take one
    const wantCams = D.cams ? camFloor(n) : 0;
    const camRooms = L.rooms.filter(r => !(r.corr || r.neck || r.tower) && !(r.idx === 0 && !r.side));
    const camUp = (not) => {
      for (let t = 0; t < 40 && camRooms.length; t++) {
        const room = R.pick(camRooms);
        if (room === not || inRoomN(room) >= (small(room) ? 2 : 3)) continue;
        if (camIn(room)) return true;
      }
      return false;
    };
    while (L.cams.length < wantCams && camUp(null));
    // and a floor is never thin: walkers top it up to its budget in guards and cameras, in rooms with room for
    // another watcher (a small room still holds two at most), so that after the timing checks take their share
    // down it still has the 70% (half, late in the draws) it must keep. A room no beat will fit takes a post, but
    // only while the posts stay under their share of the walkers (sentryCap): what climbing adds is mostly beats
    // to time, not more fixed stares, and short of walkers (walkFloor) only beats go up
    const target = watchFloor(budget, n, loose), fill = loose || n < 3 ? target : budget, wantWalk = walkFloor(n);
    const walkers = () => L.guards.filter(g => g.path).length, postRoom = () => posts().length < sentryCap(walkers());
    const roomFor = (room) => (small(room) ? 2 : 3) - inRoomN(room);
    for (let t = 0; t < 120 && pool.length && (L.guards.length + L.cams.length < fill || walkers() < wantWalk) && L.guards.length + L.cams.length < budget + (walkers() < wantWalk ? 1 : 0); t++) {
      const room = R.pick(pool), left = roomFor(room);
      if (left <= 0) continue;
      let got = 0;
      for (let b = 0; b < 4 && !got; b++) got = beatIn(room, R.weighted([['patrol', 4.5], ['pace', 2.5]]), left >= 2);
      if (!got && walkers() >= wantWalk && postRoom() && !(room.idx === 1 && !room.side)) sentryAt(room);
    }
    // a post or a camera that plugs the way on (forcedExposure) is taken down; a post stands again in
    // another room if one will have it, so the floor keeps its mix
    return (o, late) => {
      const list = o.base === undefined ? L.guards : L.cams, hi = homes.findIndex(h => h.x === o.x && h.y === o.y);
      list.splice(list.indexOf(o), 1); if (hi >= 0) homes.splice(hi, 1);
      // a camera taken down below the floor's share goes up again in another room
      if (o.base !== undefined && L.cams.length < wantCams && camUp(roomOf.get(o))) return;
      // and a walker or a camera taken down is made up with a post too while the floor is short of its 85%
      // (late in the retries only while it is short of its 70%, so the retries can thin a floor out to that)
      // A walker is made up with a beat in another room if one fits, and always while the floor is short of its
      // walkers: a beat the checks took down is drawn again elsewhere, not left as a gap. A post only while the
      // posts are under their share
      const was = roomOf.get(o), rooms = pool.filter(r => r !== was), shortW = o.path && walkers() < wantWalk - (late ? 3 : 0);
      if (!shortW && (o.kind !== 'sentry' || late) && L.guards.length + L.cams.length >= (late ? target : fill)) return;
      if (o.path) for (let t = 0; t < 12 && rooms.length; t++) { const room = R.pick(rooms), left = roomFor(room); if (left > 0 && beatIn(room, R.weighted([['patrol', 4.5], ['pace', 2.5]]), left >= 2)) return; }
      if (!postRoom()) return;
      for (let t = 0; t < 30 && rooms.length; t++) { const room = R.pick(rooms); if (roomFor(room) > 0 && sentryAt(room, !!o.snap)) return; }
    };
  }

  // the checks below open the doors one at a time and shut them all again, many times a floor, so a door is
  // laid in or out of the field on its own patch rather than the whole field being laid again. They take
  // the field as generation leaves it, every door shut
  const stampBox = (field, shape) => {
    const bb = U.bbox(shape);
    return { i0: Math.max(0, Math.floor((bb.x0 - CAP - field.x0) / G)), i1: Math.min(field.W - 1, Math.ceil((bb.x1 + CAP - field.x0) / G)),
      j0: Math.max(0, Math.floor((bb.y0 - CAP - field.y0) / G)), j1: Math.min(field.H - 1, Math.ceil((bb.y1 + CAP - field.y0) / G)) };
  };
  const shut = (v, o) => (v < o ? v : o);
  function openDoor(field, d) {
    d.open = true;
    const b = stampBox(field, d.shape), F = field.F, W = field.W;
    for (let j = b.j0; j <= b.j1; j++) F.set(field.base.subarray(j * W + b.i0, j * W + b.i1 + 1), j * W + b.i0);
    // the doors still shut whose patch overlaps this one are laid back in
    for (const o of field.doors) {
      if (o.open) continue;
      const c = stampBox(field, o.shape);
      if (c.i0 <= b.i1 && c.i1 >= b.i0 && c.j0 <= b.j1 && c.j1 >= b.j0) field._stamp(F, o.shape, shut);
    }
  }
  function shutAll(field) {
    for (const d of field.doors) if (d.open) { d.open = false; field._stamp(field.F, d.shape, shut); }
  }

  // ── forced exposure ────────────────────────────────────────
  // The least of a guard's meter each leg of the floor makes you take (the stairs to the first key, on
  // to the next with its door open, ... to the stairs up), sneaking silently past whatever a post or a
  // camera sees at every point of its sweep: what can be timed costs nothing, a lane that is never dark
  // does. Within 22 of a post is a sure '!'. A key in such a lane is plugged outright. Returns the worst
  // leg's { cost, who }, who being the watcher that gave the most of it.
  function forcedExposure(L, field) {
    const D = L.D, P_R = 8.5, SNEAK = 57, W = [];
    for (const g of L.guards) if (!g.path) W.push({ o: g, x: g.x, y: g.y, a0: g.ang, amp: g.amp, fov: D.fov, len: D.coneLen, post: true });
    for (const c of L.cams) W.push({ o: c, x: c.x + Math.cos(c.base) * 6, y: c.y + Math.sin(c.base) * 6, a0: c.base, amp: c.amp, fov: 0.42, len: D.coneLen * 1.05 });
    // the meter a watcher adds per second at (x, y) if it sees there all through its sweep, else 0
    const rate = (w, x, y) => {
      const dx = x - w.x, dy = y - w.y, d = Math.hypot(dx, dy);
      if (w.post && d < 22) return Infinity;
      if (d > w.len + P_R || d < 1 || field.ray(w.x, w.y, dx / d, dy / d, d) < d - P_R) return 0;
      const a = Math.atan2(dy, dx), tol = w.fov + Math.atan2(P_R, d);
      for (let i = 0; i <= 16; i++) if (Math.abs(U.angDiff(w.a0 + (-1 + i / 8) * w.amp, a)) > tol) return 0;
      return w.post ? D.detect * (0.3 + 1.9 * Math.max(0, 1 - d / D.coneLen)) : D.detect * 0.9;
    };
    const worst = { cost: 0, who: null }, opened = [];
    shutAll(field);
    let at = L.entrance;
    for (const tgt of L.keys.concat([L.exit])) {
      for (const d of opened) if (!d.open) openDoor(field, d);
      const nav = new Nav(field, 11), n = nav.walk.length, NW = nav.W, step = nav.C / SNEAK;
      const cc = new Float32Array(n).fill(-1), who = new Int16Array(n).fill(-1);
      const cell = (k) => {
        if (cc[k] < 0) {
          const c = nav.center(k); let r = 0, b = -1;
          for (let i = 0; i < W.length; i++) { const v = rate(W[i], c.x, c.y); if (v > r) { r = v; b = i; } }
          cc[k] = r === Infinity ? 1 : r * step; who[k] = b;
        }
        return cc[k];
      };
      const s = nav.near(at.x, at.y), e = nav.near(tgt.x, tgt.y);
      let cost = Infinity, top = -1;
      // a key itself in a never-dark lane
      if (tgt !== L.exit) for (let i = 0; i < W.length; i++) if (rate(W[i], tgt.x, tgt.y) > 0) { cost = 1; top = i; }
      if (top < 0 && s >= 0 && e >= 0) {
        const g = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), hk = [], hv = [];
        const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hv[p] <= v) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = v; };
        const pop = () => {
          const k0 = hk[0], lk = hk.pop(), lv = hv.pop(), m = hk.length; if (!m) return k0;
          let i = 0; for (;;) { let c = 2 * i + 1; if (c >= m) break; if (c + 1 < m && hv[c + 1] < hv[c]) c++; if (hv[c] >= lv) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; }
          hk[i] = lk; hv[i] = lv; return k0;
        };
        g[s] = 0; push(s, 0);
        while (hk.length) {
          const v = hv[0], k = pop();
          if (v > g[k]) continue;
          if (k === e) break;
          const ki = k % NW, kj = (k / NW) | 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            if (!di && !dj) continue;
            const i = ki + di, j = kj + dj;
            if (i < 0 || j < 0 || i >= NW || j >= nav.H) continue;
            const nk = j * NW + i;
            if (!nav.walk[nk] || (di && dj && (!nav.walk[kj * NW + i] || !nav.walk[j * NW + ki]))) continue;
            const ng = g[k] + cell(nk) * (di && dj ? 1.4142 : 1) + 1e-5;
            if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(nk, ng); }
          }
        }
        cost = g[e];
        // who gave most of it, along the cheapest way
        const share = new Float32Array(W.length);
        if (cost < Infinity) for (let k = e; k >= 0; k = from[k]) if (who[k] >= 0) share[who[k]] += cc[k];
        for (let i = 0; i < W.length; i++) if (share[i] > 0 && (top < 0 || share[i] > share[top])) top = i;
      }
      if (cost > worst.cost) { worst.cost = cost; worst.who = top >= 0 ? W[top].o : null; }
      if (tgt.door) opened.push(tgt.door);
      at = tgt;
    }
    shutAll(field);
    return worst;
  }

  // ── timed route ────────────────────────────────────────────
  // forcedExposure only asks whether a lane is ever dark; this asks whether you can get across it before
  // the sweep or the beat comes back. A perfect sneak spreads out over a coarse grid in time, a cell a step
  // (42 a second straight, 60 slant: never past a silent sneak), against every post, walker and
  // camera where it really is at that moment (a cell counts as seen if any of it is). A camera's look
  // costs what it adds to its meter, in twentieths; any guard's look, or coming within reach of one, ends
  // the way. A leg (the stairs to a key, on through its door, ... to the stairs up) must be done in under
  // half a camera's meter within 72 seconds of waiting and walking, never hiding or knocking: those are
  // for getting out of trouble, so the floor is fair without them.
  // Returns { ok } or, for the first leg no timing gets through, { ok: false, leg, who }: who being the
  // watcher that sees most of the plain way on. With trace, plan is the way it found, { t, x, y } a step.
  const trCache = new WeakMap();
  function timedRoute(L, field, trace) {
    const D = L.D, C = 24, DT = C * Math.SQRT2 / 60, P_R = 8.5, SLACK = 8, ASLACK = 0.1, BUDGET = 10, STEPS = Math.ceil(72 / DT), CLR = 10;
    const GW = Math.ceil(field.W * G / C), GH = Math.ceil(field.H * G / C), n = GW * GH;
    const cx = (k) => field.x0 + (k % GW + 0.5) * C, cy = (k) => field.y0 + (((k / GW) | 0) + 0.5) * C;
    // where each watcher is, and where it looks, t seconds in: a guard's round is played through once by the
    // game's own rules (its turn rate, the slow-down taking a corner, the look round at a stop), frame by
    // frame, so the clock it keeps is the clock it keeps in play
    const W = [], FR = 1 / 60;
    const played = (o, frames, T) => ({ o, g: 1, len: D.coneLen, fov: D.fov, period: T, at: (t) => {
      const f = Math.min(frames.length / 3 - 1, Math.floor((t % T) / FR)) * 3;
      return { x: frames[f], y: frames[f + 1], a: frames[f + 2] };
    } });
    for (const g of L.guards) {
      const fr = [];
      if (!g.path) {
        const sp = g.snap ? 1.6 : 1, T = TAU / 0.55 / sp;
        let sw = g.sweep0 || 0, a = g.ang;
        for (let t = 0; t < T; t += FR) {
          sw += FR * sp;
          const w = Math.sin(sw * 0.55), sh = Math.sign(w) * Math.min(1, Math.abs(w) * (g.snap ? 2.6 : 1.5));
          a = U.turnTo(a, g.ang + sh * g.amp, FR * (g.snap ? 4 : 1.6));
          fr.push(g.x, g.y, a);
        }
        W.push(played(g, fr, T));
        continue;
      }
      // a lap of the beat, from its start back round to it
      const P = g.path, N = P.length, o = { x: g.x, y: g.y, a: g.ang };
      let pi = g.pi, wait = 0, waitMax = 0, waitAng = 0, laps = 0, t = 0;
      for (; t < 400; t += FR) {
        if (wait > 0) {
          wait -= FR;
          o.a = U.turnTo(o.a, waitAng + Math.sin((1 - wait / waitMax) * TAU) * (P[pi].look || 0.8), FR * 2.4);
          if (wait <= 0) { pi = (pi + 1) % N; laps++; }
        } else {
          const q = P[pi], dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy);
          let there = d < 1.5;
          if (!there) {
            o.a = U.turnTo(o.a, Math.atan2(dy, dx), 3.2 * FR);
            const m = Math.min(d, D.patrol * FR * Math.max(0.3, Math.cos(U.angDiff(o.a, Math.atan2(dy, dx)))));
            o.x += dx / d * m; o.y += dy / d * m;
            there = Math.hypot(q.x - o.x, q.y - o.y) < 3;
          }
          if (there && laps === N) break;   // round to where it set out: a lap
          if (there) {
            if (q.pause > 0) { wait = waitMax = q.pause; waitAng = o.a; }
            else { pi = (pi + 1) % N; laps++; }
          }
        }
        fr.push(o.x, o.y, o.a);
      }
      W.push(played(g, fr, fr.length / 3 * FR));
    }
    for (const c of L.cams) W.push({ o: c, g: 0, len: D.coneLen * 1.05, fov: 0.42, period: c.period, at: (t) => ({
      x: c.x + Math.cos(c.base) * 6, y: c.y + Math.sin(c.base) * 6, a: c.base + Math.sin(c.phase + t * TAU / c.period) * c.amp }) });
    // each watcher's look is worked out once per sample of its own cycle (and per set of open doors near
    // it): a flat list of cell, cost pairs
    for (const w of W) {
      w.m = Math.max(1, Math.round(w.period / (DT / 4))); w.dt = w.period / w.m; w.fixed = !w.o.path;
      let c = trCache.get(w.o);
      if (!c || c.field !== field) trCache.set(w.o, c = { field, cache: new Map(), base: new Map() });
      w.cache = c.cache; w.base = c.base;
      // (the doors whose being open could change what it sees, from anywhere on its beat)
      const pts = w.o.path || [w.at(0)];
      w.doors = L.doors.filter(d => pts.some(p => Math.hypot(d.conn.mouth.x - p.x, d.conn.mouth.y - p.y) < w.len + 60));
    }
    // a post and a camera never move, so what they could see is traced once and only the sweep's angle
    // picked out per sample; a walker's look is traced per sample, the angle first. Kept per watcher
    // between retries of one floor, since only the one taken down changes
    // a camera's look costs its meter; a guard's look costs the leg outright: one glimpse and it stops to
    // stare (and a camera doesn't lock on till half way), so a route a guard sees any of is no route
    const meter = (w) => w.g ? BUDGET + 1 : Math.ceil(D.detect * 0.9 * DT * 20);
    const box = (p, R, fn) => {
      const i0 = Math.max(0, Math.floor((p.x - R - field.x0) / C)), i1 = Math.min(GW - 1, Math.floor((p.x + R - field.x0) / C));
      const j0 = Math.max(0, Math.floor((p.y - R - field.y0) / C)), j1 = Math.min(GH - 1, Math.floor((p.y + R - field.y0) / C));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * GW + i, dx = cx(k) - p.x, dy = cy(k) - p.y, d = Math.hypot(dx, dy);
        if (d <= R && walk[k]) fn(k, dx, dy, d);
      }
    };
    // in clear sight of any of the cell: its middle, or a little way out from it every way, so a wall's
    // corner that hides the middle can't hide someone standing to one side of it
    const clearTo = (p, dx, dy, d) => {
      if (field.ray(p.x, p.y, dx / d, dy / d, d) >= d - P_R) return true;
      for (const [ox, oy] of [[SLACK, 0], [-SLACK, 0], [0, SLACK], [0, -SLACK]]) {
        const ex = dx + ox, ey = dy + oy, e = Math.hypot(ex, ey);
        if (field.sample(p.x + ex, p.y + ey) > P_R && field.ray(p.x, p.y, ex / e, ey / e, e) >= e - P_R) return true;
      }
      return false;
    };
    const look = (w, s) => {
      const sig = w.doors.map(d => d.open ? 1 : 0).join(''), key = s + ':' + sig;
      let out = w.cache.get(key);
      if (out) return out;
      const p = w.at(s * w.dt), R = w.len + P_R + SLACK, list = [];
      if (w.fixed) {
        let base = w.base.get(sig);
        if (!base) {
          const b = [];
          box(p, R, (k, dx, dy, d) => {
            if (w.g && d < 20 + SLACK) { b.push([k, 250, 0, 9]); return; }
            if (d < 1 || !clearTo(p, dx, dy, d)) return;
            b.push([k, meter(w), Math.atan2(dy, dx), w.fov + ASLACK + Math.atan2(P_R + SLACK, d)]);
          });
          w.base.set(sig, base = b);
        }
        for (const [k, c, a, tol] of base) if (Math.abs(U.angDiff(p.a, a)) <= tol) list.push(k, c);
      } else {
        box(p, R, (k, dx, dy, d) => {
          if (w.g && d < 20 + SLACK) { list.push(k, 250); return; }
          if (d < 1 || Math.abs(U.angDiff(p.a, Math.atan2(dy, dx))) > w.fov + ASLACK + Math.atan2(P_R + SLACK, d)) return;
          if (clearTo(p, dx, dy, d)) list.push(k, meter(w));
        });
      }
      out = Int32Array.from(list); w.cache.set(key, out);
      return out;
    };
    let E = new Uint8Array(n), E2 = new Uint8Array(n).fill(255);
    const vis = new Uint8Array(n), visE = new Uint8Array(n), walk = new Uint8Array(n), seen = new Uint8Array(n);
    const idx = new Int32Array(n);
    let cells = [], nbAt = null, nbs = null;
    const build = () => {
      cells = []; walk.fill(0);
      for (let k = 0; k < n; k++) if (field.sample(cx(k), cy(k)) > CLR) { walk[k] = 1; idx[k] = cells.length; cells.push(k); }
      const at = [0], out = [];
      for (const k of cells) {
        const i = k % GW, j = (k / GW) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj;
          if ((di || dj) && ii >= 0 && jj >= 0 && ii < GW && jj < GH && walk[jj * GW + ii]) out.push(jj * GW + ii);
        }
        at.push(out.length);
      }
      nbAt = Int32Array.from(at); nbs = Int32Array.from(out);
    };
    const near = (x, y) => {
      const ci = Math.floor((x - field.x0) / C), cj = Math.floor((y - field.y0) / C);
      let best = -1, bd = Infinity;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const i = ci + di, j = cj + dj, k = j * GW + i;
        if (i < 0 || j < 0 || i >= GW || j >= GH || !walk[k]) continue;
        const d = Math.hypot(cx(k) - x, cy(k) - y);
        if (d < bd && field.clear(x, y, cx(k), cy(k), 4)) { bd = d; best = k; }
      }
      return best;
    };
    shutAll(field);
    build();
    const got = new Set();
    let t = 0, here = near(L.entrance.x, L.entrance.y), res = { ok: true };
    if (trace) res.watchers = W.map(w => ({ o: w.o, at: w.at, period: w.period }));
    for (let leg = 1; leg <= L.keys.length + 1 && here >= 0; leg++) {
      const tgt = new Map();
      L.keys.forEach((k, i) => { if (!got.has(i)) { const c = near(k.x, k.y); if (c >= 0) tgt.set(c, i); } });
      const ek = near(L.exit.x, L.exit.y); if (ek >= 0) tgt.set(ek, -1);
      // a leg the coarse grid can't walk at all (a squeeze it rounds shut) is left to the nav checks
      seen.fill(0); seen[here] = 1;
      let open = false;
      for (let fr = [here]; fr.length && !open;) {
        const nx = [];
        for (const k of fr) {
          if (tgt.has(k)) { open = true; break; }
          for (let q = nbAt[idx[k]]; q < nbAt[idx[k] + 1]; q++) if (!seen[nbs[q]]) { seen[nbs[q]] = 1; nx.push(nbs[q]); }
        }
        fr = nx;
      }
      if (!open) break;
      E.fill(255); E[here] = 0;
      let hit = null;
      const t0 = t, from = here, pars = [];
      for (let s = 0; s < STEPS && hit === null; s++) {
        t += DT;
        const par = trace ? new Int32Array(n).fill(-1) : null;
        if (par) pars.push(par);
        // a step is looked at four times through, so a sweep can't slip past between samples: the first half
        // where the step sets out from (visE), the second where it ends (vis)
        const touched = [];
        for (const w of W) for (const [tt, into] of [[t, vis], [t - DT / 4, vis], [t - DT / 2, visE], [t - DT * 3 / 4, visE]]) {
          const list = look(w, Math.round(tt / w.dt) % w.m);
          for (let q = 0; q < list.length; q += 2) { const k = list[q]; if (list[q + 1] > into[k]) { if (!vis[k] && !visE[k]) touched.push(k); into[k] = list[q + 1]; } }
        }
        for (let ci = 0; ci < cells.length; ci++) {
          const k = cells[ci], vk = vis[k];
          let m = E[k] === 255 ? 255 : E[k] + Math.max(vk, visE[k]);
          E2[k] = 255;
          // (a cell already reached unseen, and unseen now, stays so)
          if (m === 0) { E2[k] = 0; if (par) par[k] = k; continue; }
          let pk = k;
          for (let q = nbAt[ci], q1 = nbAt[ci + 1]; q < q1; q++) {
            const o = nbs[q];
            if (E[o] === 255) continue;
            const v = E[o] + Math.max(vk, visE[o]);
            if (v < m) { m = v; pk = o; }
          }
          if (par) par[k] = pk;
          if (m <= BUDGET) E2[k] = m;
        }
        { const sw = E; E = E2; E2 = sw; }
        for (const k of touched) vis[k] = visE[k] = 0;
        for (const [c, what] of tgt) if (E[c] <= BUDGET) { hit = what; here = c; break; }
      }
      if (hit === null) {
        // to blame: whoever looks most at the plain way on to the next thing to reach
        const nav = new Nav(field, 11);
        const order = L.keys.map((k, i) => i).filter(i => !got.has(i)).map(i => L.keys[i]).concat([L.exit]);
        const from = { x: cx(here), y: cy(here) };
        let path = null;
        for (const o of order) { path = nav.path(from.x, from.y, o.x, o.y, 60000); if (path) break; }
        const on = new Uint8Array(n);
        if (path) { let a = from; for (const q of path) { const l = Math.hypot(q.x - a.x, q.y - a.y); for (let u = 0; u <= l; u += 8) { const i = Math.floor((a.x + (q.x - a.x) * u / (l || 1) - field.x0) / C), j = Math.floor((a.y + (q.y - a.y) * u / (l || 1) - field.y0) / C); if (i >= 0 && j >= 0 && i < GW && j < GH) on[j * GW + i] = 1; } a = q; } }
        let who = null, top = 0;
        for (const w of W) {
          let cov = 0;
          for (let s = 0; s < w.m; s++) { const list = look(w, s); for (let q = 0; q < list.length; q += 2) if (on[list[q]]) cov += list[q + 1]; }
          cov /= w.m;
          if (cov > top) { top = cov; who = w.o; }
        }
        res = { ok: false, leg, who };
        break;
      }
      if (trace) {
        // the way it found, back from where it got to: a point a step
        const way = [];
        for (let s = pars.length - 1, k = here; s >= 0; s--) { way.push({ t: t0 + (s + 1) * DT, x: cx(k), y: cy(k) }); k = pars[s][k]; }
        way.push({ t: t0, x: cx(from), y: cy(from) });
        (res.plan = res.plan || []).push(...way.reverse());
      }
      if (hit === -1) break;
      got.add(hit);
      const key = L.keys[hit];
      if (key.door) { openDoor(field, key.door); build(); here = near(key.x, key.y); }
    }
    shutAll(field);
    return res;
  }

  root.LEVEL = { generate, difficulty, history, pickKind, Field, Nav, KEY_COLORS, starRisk, forcedExposure, timedRoute };
  if (typeof module !== 'undefined') module.exports = root.LEVEL;
})(typeof window !== 'undefined' ? window : globalThis);
