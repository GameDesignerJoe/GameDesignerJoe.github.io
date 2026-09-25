// The Maze, first person — the renderer, the walk, the controls
//
// A raycaster in the Wolfenstein manner, drawn into a small pixel buffer and scaled up. It reads
// the maze straight out of the top-down's own generator — tiles[y][x], start, exit, crawlGaps —
// so a seed is the same maze in both views. Nothing here writes to the top-down's save.
//
// Why a raycaster and not Three.js again: the Labyrinth builds died on geometry, and a raycaster
// has none. A wall is wherever the grid says a wall is, by construction.
//
// Draw order, per frame: the sky over the top half and the floor over the bottom, then one wall
// column per screen column, then any crawl-gap lintels that column passed through, farthest first.
//
// Movement is one continuous position and heading. The stick drives it directly, the way the
// top-down's stick does; taps, swipes and keys glide it to the next tile centre or the next quarter
// turn. Either can take over from the other at any moment.

(() => {
  const cv = document.getElementById('view'), ctx = cv.getContext('2d', { alpha: false });
  const mini = document.getElementById('mini'), mctx = mini.getContext('2d');
  const $ = (id) => document.getElementById(id);

  // ── settings ──────────────────────────────────────────────
  const SKEY = 'maze.fp.v1';
  let S = Object.assign({}, FP_CONFIG);
  try { Object.assign(S, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
  if (!TEX.themes[S.theme]) S.theme = FP_CONFIG.theme;
  const saveS = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} };

  // ── the look ──────────────────────────────────────────────
  let T, FR, FG, FB;
  function applyTheme() {
    T = TEX.themes[S.theme];
    const f = TEX.hex(T.fog); FR = f & 0xff; FG = (f >>> 8) & 0xff; FB = (f >>> 16) & 0xff;
    document.body.dataset.theme = S.theme;
    if (typeof W !== 'undefined' && wallVar) index();
  }

  // ── the buffer ────────────────────────────────────────────
  let RW = 1, RH = 1, img, buf;
  function resize() {
    // `res` is the short side, so a phone held upright isn't drawn eighty pixels wide
    const a = innerWidth / Math.max(1, innerHeight), n = Math.round(S.res);
    if (a >= 1) { RH = n; RW = Math.max(1, Math.round(n * a)); } else { RW = n; RH = Math.max(1, Math.round(n / a)); }
    cv.width = RW; cv.height = RH;
    img = ctx.createImageData(RW, RH); buf = new Uint32Array(img.data.buffer);
  }
  addEventListener('resize', resize);

  // ── the maze, as the renderer wants it ────────────────────
  let wallVar = null, floorVar, low, exitFace, seen;
  const HD = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // heading 0 east, 1 south, 2 west, 3 north (y runs down)
  const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !tiles[y][x];
  const hash = (x, y) => { let h = (x * 73856093) ^ (y * 19349663) ^ SEED; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };

  function index() {
    wallVar = new Uint8Array(W * H); floorVar = new Uint8Array(W * H);
    low = new Uint8Array(W * H); exitFace = new Uint8Array(W * H);
    if (!seen || seen.length !== W * H) seen = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y);
      wallVar[y * W + x] = T.pick[h % T.pick.length];   // mostly plain, the odd variant — weighted, not uniform
      floorVar[y * W + x] = (h >>> 8) % T.floors.length;
    }
    // a crawl gap, or the open cell between two gaps of one squeeze: low overhead, you go through bent
    for (const set of [crawlGaps, crawlCells]) for (const k of set) {
      const [x, y] = k.split(',').map(Number);
      if (!solid(x, y)) low[y * W + x] = 1;
    }
    // the wall at the far end of the exit alley gets the doorway: the neighbour of the exit tile
    // that is wall, with open floor straight behind you as you face it
    for (const [dx, dy] of HD) {
      const fx = exit.x + dx, fy = exit.y + dy, bx = exit.x - dx, by = exit.y - dy;
      if (solid(fx, fy) && !solid(bx, by) && fx >= 0 && fy >= 0 && fx < W && fy < H) exitFace[fy * W + fx] = 1;
    }
  }

  // ── the player ────────────────────────────────────────────
  const P = { x: 0, y: 0, a: 0 };
  const QUARTER = Math.PI / 2;
  const headingOf = (a) => ((Math.round(a / QUARTER) % 4) + 4) % 4;
  let anim = null, queued = null, holdFwd = false, steps = 0, won = false, lastMoveEnd = -1e9;
  let vel = 0, walkPhase = 0, bump = null, lastTile = '';

  function reset() {
    seen = new Uint8Array(W * H);
    index();
    const tx = Math.floor(start.x), ty = Math.floor(start.y);
    // face the longest open run from where you wake, so the first thing you see is a way to go
    let best = 0, bestH = 0;
    HD.forEach(([dx, dy], h) => { let n = 0; while (!solid(tx + dx * (n + 1), ty + dy * (n + 1)) && n < 40) n++; if (n > best) { best = n; bestH = h; } });
    P.x = tx + 0.5; P.y = ty + 0.5; P.a = bestH * QUARTER;
    anim = null; queued = null; steps = 0; won = false; vel = 0; lastTile = '';
    $('win').classList.remove('show');
    arrive();
    $('seed').textContent = SEED;
    $('who').textContent = (typeof phase === 'function' ? phase().who : '') + (protoMode ? ' · prototype' : '');
    $('topdown').href = 'maze-topdown.html?seed=' + SEED;
  }
  function newMaze(seed) {
    SEED = seed || (Math.random() * 1e9 | 0);
    try { history.replaceState(null, '', location.pathname + '?seed=' + SEED); } catch (e) {}
    generate(SEED); reset();
  }

  // every time the tile underfoot changes: count it, chart it for the debug map, check the door
  function arrive() {
    const tx = Math.floor(P.x), ty = Math.floor(P.y), k = tx + ',' + ty;
    if (k === lastTile) return;
    if (lastTile) steps++;
    lastTile = k;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) seen[y * W + x] = 1;
    }
    if (tx === exit.x && ty === exit.y) win();
  }

  // ── easing ────────────────────────────────────────────────
  // Four shapes, chosen so a held walk is one continuous glide: 'in' starts from rest and leaves at
  // exactly walking speed, 'lin' is walking speed, 'out' arrives at walking speed and settles.
  const EASE = {
    io: (k) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    in: (k) => k * k * (2 - k),
    out: (k) => { const u = 1 - k; return 1 - u * u * (2 - u); },
    lin: (k) => k,
  };

  // ── stepping: taps, swipes, keys ──────────────────────────
  function act(a) {
    if (won) return;
    if (anim) { queued = a; return; }
    begin(a, performance.now());
  }
  function begin(a, now) {
    const base = Math.round(P.a / QUARTER) * QUARTER, h = headingOf(P.a);
    if (a === 'left' || a === 'right' || a === 'around') {
      const dh = a === 'left' ? -1 : a === 'right' ? 1 : 2;
      anim = { kind: 'turn', t0: now, dur: S.turnMs * (a === 'around' ? 1.5 : 1), fa: P.a, ta: base + dh * QUARTER };
      return;
    }
    const [dx, dy] = HD[(h + { fwd: 0, sright: 1, back: 2, sleft: 3 }[a]) % 4];
    const tx = Math.floor(P.x), ty = Math.floor(P.y), nx = tx + dx, ny = ty + dy;
    if (solid(nx, ny)) {
      // left facing a wall at a slant by the stick: square up first, so the next tap means something
      if (Math.abs(P.a - base) > 0.05) anim = { kind: 'turn', t0: now, dur: S.turnMs * 0.7, fa: P.a, ta: base };
      else bump = { t0: now, dur: 190, dx, dy };
      return;
    }
    const chained = now - lastMoveEnd < 60;
    const keepGoing = a === 'fwd' && holdFwd;
    const ease = chained ? (keepGoing ? 'lin' : 'out') : (keepGoing ? 'in' : 'io');
    // from wherever you actually are — the stick may have left you off-centre and off-square — to
    // the middle of the next tile, straightening up on the way
    anim = { kind: 'move', t0: now, dur: S.stepMs * Math.max(0.5, Math.hypot(nx + 0.5 - P.x, ny + 0.5 - P.y)), fx: P.x, fy: P.y, tx: nx + 0.5, ty: ny + 0.5, fa: P.a, ta: base, ease };
  }

  function stepAnim(now) {
    if (anim && anim.kind === 'move' && (anim.ease === 'lin' || anim.ease === 'in') && !holdFwd && queued !== 'fwd') {
      // let go of a held walk mid-glide: turn the rest of this tile into a settle rather than a stop
      const rest = Math.hypot(anim.tx - P.x, anim.ty - P.y);
      if (rest > 0.02) anim = Object.assign({}, anim, { fx: P.x, fy: P.y, fa: P.a, t0: now, dur: Math.max(60, rest * S.stepMs), ease: 'out' });
    }
    if (anim) {
      const k = Math.min(1, (now - anim.t0) / anim.dur);
      if (anim.kind === 'turn') P.a = anim.fa + (anim.ta - anim.fa) * EASE.io(k);
      else {
        const e = EASE[anim.ease](k);
        P.x = anim.fx + (anim.tx - anim.fx) * e; P.y = anim.fy + (anim.ty - anim.fy) * e;
        P.a = anim.fa + (anim.ta - anim.fa) * Math.min(1, e * 1.6);
      }
      if (k >= 1) { if (anim.kind === 'move') lastMoveEnd = now; anim = null; }
    }
    if (!anim && !won) {
      if (queued) { const q = queued; queued = null; begin(q, now); }
      else if (holdFwd) begin('fwd', now);
    }
  }

  // ── the stick ─────────────────────────────────────────────
  // Up walks forward, down backs off, sideways turns — diagonals do both, so you can take a corner
  // in one sweep of the thumb. Like the top-down's "rails in halls, free in rooms": in a corridor it
  // quietly pulls you to the middle and squares you up to the hall while you aren't turning, so a
  // one-tile hall never feels like scraping along a wall. In a room it leaves you alone.
  const stick = { on: false, x: 0, y: 0 };
  const RAD = 0.2;   // how wide you are, in tiles
  const blocked = (x, y) => solid(Math.floor(x - RAD), Math.floor(y - RAD)) || solid(Math.floor(x + RAD), Math.floor(y - RAD))
    || solid(Math.floor(x - RAD), Math.floor(y + RAD)) || solid(Math.floor(x + RAD), Math.floor(y + RAD));
  function stickMove(dt) {
    const mag = Math.hypot(stick.x, stick.y), dz = CONFIG.stickDeadzone;
    const live = stick.on && mag > dz;
    let want = 0, turn = 0;
    if (live) {
      anim = null; queued = null; holdFwd = false;
      const k = Math.min(1, (mag - dz) / (1 - dz)) / mag;   // deadzone taken out, so the edge of it is zero, not a jump
      const sx = stick.x * k, sy = stick.y * k;
      want = -sy * S.walk;
      turn = Math.sign(sx) * Math.abs(sx) ** 1.6;   // gentle near the middle, quick at the rim
    }
    vel += (want - vel) * Math.min(1, dt * 10);
    if (Math.abs(vel) < 0.001 && !live) { vel = 0; return; }
    P.a += turn * S.stickTurn * Math.PI / 180 * dt;

    const tx = Math.floor(P.x), ty = Math.floor(P.y);
    const ew = !solid(tx - 1, ty) || !solid(tx + 1, ty), ns = !solid(tx, ty - 1) || !solid(tx, ty + 1);
    const hall = S.assist && ew !== ns;   // open along one axis only: a corridor
    if (hall && Math.abs(turn) < 0.05 && Math.abs(vel) > 0.05) {
      // square up to the hall: whichever way along it you're more nearly facing
      const axis = ew ? (Math.cos(P.a) >= 0 ? 0 : Math.PI) : (Math.sin(P.a) >= 0 ? QUARTER : -QUARTER);
      let d = axis - P.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.7) P.a += d * Math.min(1, dt * 5);
    }
    const mx = Math.cos(P.a) * vel * dt, my = Math.sin(P.a) * vel * dt;
    if (!blocked(P.x + mx, P.y)) P.x += mx;
    if (!blocked(P.x, P.y + my)) P.y += my;
    if (hall) {   // and to the middle of it
      const pull = Math.min(1, dt * 6 * Math.abs(vel));
      if (ew) P.y += (ty + 0.5 - P.y) * pull; else P.x += (tx + 0.5 - P.x) * pull;
    }
  }

  // ── the frame's view ──────────────────────────────────────
  let lastX = 0, lastY = 0;
  function update(now, dt) {
    if (won) return;
    stickMove(dt);
    stepAnim(now);
    // one dip of the head per tile walked, however you walked it; standing still, it settles
    const moved = Math.hypot(P.x - lastX, P.y - lastY); lastX = P.x; lastY = P.y;
    if (moved > 0.0005) walkPhase += moved; else walkPhase += (Math.round(walkPhase) - walkPhase) * Math.min(1, dt * 8);
    arrive();
  }
  function camera(now) {
    let x = P.x, y = P.y, bob = Math.sin(Math.PI * walkPhase) * S.bob;
    if (bump) {
      const k = (now - bump.t0) / bump.dur;
      if (k >= 1) bump = null;
      else { const b = Math.sin(Math.PI * k) * 0.14; x += bump.dx * b; y += bump.dy * b; bob -= Math.sin(Math.PI * k) * S.bob * 0.6; }
    }
    return [x, y, P.a, Math.abs(bob)];
  }

  // ── drawing ───────────────────────────────────────────────
  // a colour, dimmed by `lit` (the side walls a little darker, the undersides more), then faded
  // toward the fog by `f` (1 near, 0 lost)
  function shade(c, f, lit) {
    const k = f * lit;
    const r = FR + ((c & 0xff) * k - FR * f) | 0;
    const g = FG + (((c >>> 8) & 0xff) * k - FG * f) | 0;
    const b = FB + (((c >>> 16) & 0xff) * k - FB * f) | 0;
    return 0xff000000 | (b << 16) | (g << 8) | r;
  }

  // reused per column, so a frame allocates nothing
  const MAXP = 32, pE = new Float32Array(MAXP), pX = new Float32Array(MAXP), pU = new Float32Array(MAXP), pS = new Uint8Array(MAXP), pT = new Int32Array(MAXP);

  function render(now) {
    const [px, py, ang, bob] = camera(now);
    const tanH = Math.tan(S.fov * Math.PI / 360), D = (RW / 2) / tanH;
    const hor = RH / 2 + bob, eye = S.eye, gapH = S.gapH, fog = S.fog;
    const dX = Math.cos(ang), dY = Math.sin(ang), plX = -dY * tanH, plY = dX * tanH;
    const sky = T.sky, SW = sky.w, SH = sky.h, SP = sky.px;
    const walls = T.walls, floors = T.floors, beam = T.lintel.px, under = T.under.px, exitT = T.exit;
    const side = T.side, underLit = T.underLit;

    // sky: a wrapped panorama, turning with you
    const horI = Math.max(0, Math.min(RH, Math.ceil(hor)));
    const baseU = ang / (2 * Math.PI) * SW;
    for (let x = 0; x < RW; x++) {
      const cam = 2 * (x + 0.5) / RW - 1;
      let u = Math.floor(baseU + Math.atan(cam * tanH) / (2 * Math.PI) * SW) % SW; if (u < 0) u += SW;
      for (let y = 0; y < horI; y++) buf[y * RW + x] = SP[Math.min(SH - 1, (y / hor * SH) | 0) * SW + u];
    }

    // floor: one row at a time, stepping across the ground in a straight line
    const r0x = dX - plX, r0y = dY - plY, r1x = dX + plX, r1y = dY + plY;
    for (let y = horI; y < RH; y++) {
      const rowD = eye * D / (y + 0.5 - hor);
      const f = Math.exp(-fog * rowD);
      const sx = rowD * (r1x - r0x) / RW, sy = rowD * (r1y - r0y) / RW;
      let wx = px + rowD * r0x + sx * 0.5, wy = py + rowD * r0y + sy * 0.5;
      let o = y * RW;
      for (let x = 0; x < RW; x++, wx += sx, wy += sy, o++) {
        const cx = Math.floor(wx), cy = Math.floor(wy);
        const t = (cx >= 0 && cy >= 0 && cx < W && cy < H) ? floors[floorVar[cy * W + cx]] : floors[0];
        buf[o] = shade(t.px[(((wy - cy) * 32) | 0) * 32 + (((wx - cx) * 32) | 0)], f, 1);
      }
    }

    // walls
    for (let x = 0; x < RW; x++) {
      const cam = 2 * (x + 0.5) / RW - 1;
      const rx = dX + plX * cam, ry = dY + plY * cam;
      let mx = Math.floor(px), my = Math.floor(py);
      const ddx = rx === 0 ? 1e30 : Math.abs(1 / rx), ddy = ry === 0 ? 1e30 : Math.abs(1 / ry);
      const stX = rx < 0 ? -1 : 1, stY = ry < 0 ? -1 : 1;
      let sdx = rx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx;
      let sdy = ry < 0 ? (py - my) * ddy : (my + 1 - py) * ddy;
      let n = 0, sd = 0, perp = 64;
      if (!solid(mx, my) && low[my * W + mx]) { pE[0] = 0; pX[0] = Math.min(sdx, sdy); pT[0] = my * W + mx; pS[0] = 0; pU[0] = 0; n = 1; }
      for (let i = 0; i < 128; i++) {
        if (sdx < sdy) { sdx += ddx; mx += stX; sd = 0; } else { sdy += ddy; my += stY; sd = 1; }
        const entry = sd === 0 ? sdx - ddx : sdy - ddy;
        if (solid(mx, my)) { perp = entry; break; }
        const k = my * W + mx;
        if (low[k] && n < MAXP) {
          let u = sd === 0 ? py + entry * ry : px + entry * rx; u -= Math.floor(u);
          if ((sd === 0 && rx > 0) || (sd === 1 && ry < 0)) u = 1 - u;
          pE[n] = entry; pX[n] = Math.min(sdx, sdy); pT[n] = k; pS[n] = sd; pU[n] = u; n++;
        }
      }
      // the far wall
      {
        let u = sd === 0 ? py + perp * ry : px + perp * rx; u -= Math.floor(u);
        if ((sd === 0 && rx > 0) || (sd === 1 && ry < 0)) u = 1 - u;
        const inB = mx >= 0 && my >= 0 && mx < W && my < H;
        const t = inB && exitFace[my * W + mx] ? exitT : walls[inB ? wallVar[my * W + mx] : 0];
        const tu = Math.min(31, (u * 32) | 0);
        const lh = D / perp, top = hor - (1 - eye) * lh, bot = hor + eye * lh;
        const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(RH, Math.ceil(bot - 0.5));
        const f = Math.exp(-fog * perp), lit = sd ? side : 1;
        for (let y = y0; y < y1; y++) {
          const tv = Math.min(31, ((y + 0.5 - top) / (bot - top) * 32) | 0), ti = tv * 32 + tu;
          buf[y * RW + x] = t.glow && t.glow[ti] ? t.px[ti] : shade(t.px[ti], f, lit);
        }
      }
      // the lintels over any crawl gaps on the way, farthest first so the near ones cover
      for (let j = n - 1; j >= 0; j--) {
        const e = pE[j], xd = pX[j];
        const wt = walls[wallVar[pT[j]]].px;
        let underTop = 0;
        if (e > 0.02) {
          const lh = D / e, top = hor - (1 - eye) * lh, bot = hor + eye * lh, gy = hor - (gapH - eye) * lh;
          const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(RH, Math.ceil(gy - 0.5));
          const f = Math.exp(-fog * e), lit = pS[j] ? side : 1, tu = Math.min(31, (pU[j] * 32) | 0);
          for (let y = y0; y < y1; y++) {
            const v = (y + 0.5 - top) / (bot - top), hgt = 1 - v;   // how high up the wall this pixel is
            const c = hgt < gapH + 0.07
              ? beam[(Math.max(0, Math.min(7, ((hgt - gapH) / 0.07 * 8) | 0)) + 12) * 32 + tu]   // the beam along the bottom
              : wt[Math.min(31, (v * 32) | 0) * 32 + tu];
            buf[y * RW + x] = shade(c, f, lit);
          }
          underTop = y1;
        }
        // the underside of the lintel, seen from below, until the gap's far edge
        if (gapH > eye) {
          const yEnd = Math.min(horI, Math.ceil(hor - (gapH - eye) * D / xd - 0.5));
          for (let y = underTop; y < yEnd; y++) {
            const d = (gapH - eye) * D / (hor - (y + 0.5));
            if (d <= 0) continue;
            const wx = px + d * rx, wy = py + d * ry;
            const c = under[(((wy - Math.floor(wy)) * 32) | 0) * 32 + (((wx - Math.floor(wx)) * 32) | 0)];
            buf[y * RW + x] = shade(c, Math.exp(-fog * d), underLit);
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ── the debug map ─────────────────────────────────────────
  function drawMini(now) {
    if (S.map === 'off') { mini.style.display = 'none'; return; }
    mini.style.display = 'block';
    const s = Math.max(2, Math.floor(Math.min(innerWidth * 0.34 / W, innerHeight * 0.34 / H)));
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (mini.width !== W * s * dpr) { mini.width = W * s * dpr; mini.height = H * s * dpr; mini.style.width = W * s + 'px'; mini.style.height = H * s + 'px'; }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, W * s, H * s);
    const full = S.map === 'full';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!full && !seen[y * W + x]) continue;
      mctx.fillStyle = solid(x, y) ? '#5c5850' : low[y * W + x] ? '#53402a' : '#1e1c1a';
      mctx.fillRect(x * s, y * s, s, s);
    }
    if (full || seen[exit.y * W + exit.x]) { mctx.fillStyle = '#e0c98a'; mctx.fillRect(exit.x * s, exit.y * s, s, s); }
    const [x, y, a] = camera(now);
    mctx.save(); mctx.translate(x * s, y * s); mctx.rotate(a);
    mctx.fillStyle = '#ece7da'; mctx.beginPath(); mctx.moveTo(s * 1.1, 0); mctx.lineTo(-s * 0.6, -s * 0.7); mctx.lineTo(-s * 0.6, s * 0.7); mctx.fill();
    mctx.restore();
  }

  // ── winning ───────────────────────────────────────────────
  function win() {
    won = true; holdFwd = false; queued = null; anim = null; vel = 0;
    $('winSteps').textContent = steps + ' steps';
    $('win').classList.add('show');
  }
  $('again').onclick = () => newMaze();

  // ── keys ──────────────────────────────────────────────────
  const KEYS = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'sleft', KeyE: 'sright' };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const a = KEYS[e.code]; if (!a) return;
    e.preventDefault(); hideHint();
    if (a === 'fwd') { if (!holdFwd) { holdFwd = true; act('fwd'); } return; }
    if (!e.repeat) act(a);
  });
  addEventListener('keyup', (e) => { if (KEYS[e.code] === 'fwd') holdFwd = false; });
  addEventListener('blur', () => { holdFwd = false; clearStick(); });

  // ── the stick, on screen ──────────────────────────────────
  // Same size, place and feel as the top-down's: bottom centre upright, bottom right on its side.
  const stickEl = $('stick'), knob = $('knob');
  const KNOB_MAX = 54; let stickId = null;
  function setStick(cx, cy) {
    const b = stickEl.getBoundingClientRect();
    const dx = cx - (b.left + b.width / 2), dy = cy - (b.top + b.height / 2);
    const len = Math.hypot(dx, dy) || 1, k = Math.min(len, KNOB_MAX);
    knob.style.transform = `translate(${dx / len * k}px, ${dy / len * k}px)`;
    stick.x = dx / len * k / KNOB_MAX; stick.y = dy / len * k / KNOB_MAX; stick.on = true;
  }
  function clearStick() { stick.on = false; stick.x = stick.y = 0; stickId = null; stickEl.classList.remove('on'); knob.style.transform = ''; }
  stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); hideHint(); stickId = e.pointerId; stickEl.classList.add('on'); try { stickEl.setPointerCapture(e.pointerId); } catch (err) {} setStick(e.clientX, e.clientY); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e.clientX, e.clientY); });
  stickEl.addEventListener('pointerup', clearStick); stickEl.addEventListener('pointercancel', clearStick);
  const showStick = () => { stickEl.style.display = S.stick === 'on' ? '' : 'none'; if (S.stick !== 'on') clearStick(); };

  // ── touch on the view ─────────────────────────────────────
  // Tap: left third turns left, right third turns right, the middle steps forward.
  // Hold: keep walking. Swipe up: step (and keep walking if you hold). Swipe down: turn round.
  // Swipe sideways: turn — by default the way a finger drags the view, like every map app.
  let touch = null;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); hideHint();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
    touch.timer = setTimeout(() => { if (touch && !touch.done) { touch.done = true; holdFwd = true; act('fwd'); } }, 200);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!touch || touch.id !== e.pointerId || touch.done) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.hypot(dx, dy) < 28) return;
    touch.done = true; clearTimeout(touch.timer);
    if (Math.abs(dx) > Math.abs(dy)) act((S.swipe === 'drag') === (dx < 0) ? 'right' : 'left');
    else if (dy < 0) { holdFwd = true; act('fwd'); }
    else act('around');
  });
  const lift = (e) => {
    if (!touch || touch.id !== e.pointerId) return;
    clearTimeout(touch.timer);
    if (!touch.done && e.type === 'pointerup') {
      const third = e.clientX / innerWidth;
      act(third < 1 / 3 ? 'left' : third > 2 / 3 ? 'right' : 'fwd');
    }
    touch = null; holdFwd = false;
  };
  cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
  let hintHidden = false;
  function hideHint() { if (hintHidden) return; hintHidden = true; $('hint').classList.add('gone'); }

  // ── the gear panel ────────────────────────────────────────
  const rows = $('knobs');
  const fmt = (k, v) => k === 'fog' || k === 'eye' || k === 'gapH' || k === 'walk' ? (+v).toFixed(2) : String(v);
  for (const k of Object.keys(FP_RANGES)) {
    const [lo, hi, st, label] = FP_RANGES[k];
    const row = document.createElement('label');
    row.innerHTML = `<span>${label}</span><input type="range" min="${lo}" max="${hi}" step="${st}"><b></b>`;
    const inp = row.querySelector('input'), out = row.querySelector('b');
    inp.value = S[k]; out.textContent = fmt(k, S[k]);
    inp.addEventListener('input', () => { S[k] = +inp.value; out.textContent = fmt(k, S[k]); saveS(); if (k === 'res') resize(); });
    rows.appendChild(row);
  }
  const themeSel = $('optTheme');
  for (const [k, th] of Object.entries(TEX.themes)) { const o = document.createElement('option'); o.value = k; o.textContent = th.label; themeSel.appendChild(o); }
  const bindSel = (id, key, after) => { const el = $(id); el.value = String(S[key]); el.onchange = () => { S[key] = el.value === 'true' ? true : el.value === 'false' ? false : el.value; saveS(); if (after) after(); }; };
  bindSel('optTheme', 'theme', applyTheme);
  bindSel('optStick', 'stick', showStick);
  bindSel('optAssist', 'assist');
  bindSel('optMap', 'map');
  bindSel('optSwipe', 'swipe');
  $('gear').onclick = () => $('panel').classList.toggle('open');
  $('close').onclick = () => $('panel').classList.remove('open');
  $('newMaze').onclick = () => { newMaze(); $('panel').classList.remove('open'); };
  $('resetKnobs').onclick = () => { try { localStorage.removeItem(SKEY); } catch (e) {} location.reload(); };
  $('ver').textContent = 'v' + VERSION + ' · first person';

  // ── go ────────────────────────────────────────────────────
  let frames = 0, fpsAt = performance.now(), prev = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now;
    update(now, dt);
    render(now);
    drawMini(now);
    if (++frames >= 30) { $('fps').textContent = Math.round(frames * 1000 / (now - fpsAt)) + ' fps · ' + RW + '×' + RH; frames = 0; fpsAt = now; }
    requestAnimationFrame(frame);
  }
  applyTheme();
  showStick();
  resize();
  generate(SEED); reset(); lastX = P.x; lastY = P.y;
  requestAnimationFrame(frame);

  // for the checks in tools/, and for poking at from the console
  window.FP = { P, S, act, newMaze, stick, get anim() { return anim; }, get won() { return won; }, get steps() { return steps; } };
})();
