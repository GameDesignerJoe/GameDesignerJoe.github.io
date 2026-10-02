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
// column per screen column. A squeeze is a narrow slot cut through its tile: the ray tests its jambs
// as boxes, so it is drawn and walked exactly as wide as it is.
//
// Movement is one continuous position and heading. The stick drives it directly, the way the
// top-down's stick does; taps, swipes and keys glide it to the next tile centre or the next quarter
// turn. Either can take over from the other at any moment.

(() => {
  const cv = document.getElementById('view'), ctx = cv.getContext('2d', { alpha: false });
  const mini = document.getElementById('mini'), mctx = mini.getContext('2d');
  const $ = (id) => document.getElementById(id);

  // the journal's hand, fetched now rather than the first time a page opens (see the @font-face in maze-fp.html)
  try { if (document.fonts && document.fonts.load) document.fonts.load("500 24px 'Caveat'"); } catch (e) {}

  // ── settings ──────────────────────────────────────────────
  const SKEY = 'maze.fp.v1';
  let S = Object.assign({}, FP_CONFIG);
  try {
    const saved = JSON.parse(localStorage.getItem(SKEY) || '{}');
    // saved before the office look and the rails existed: the look was only ever the default then,
    // never a choice, so let the new default through. The old free-with-assist setting has no heir.
    if (!('move' in saved)) { delete saved.theme; delete saved.assist; }
    // rails was the default for one version and Joe found it twitchy; glide replaced it as the
    // default, so a rails that was never chosen (no `help` saved alongside it) moves on too
    if (saved.move === 'rails' && !('help' in saved)) delete saved.move;
    // one Glide help knob became three: carry the one over to each
    if ('help' in saved && !('settle' in saved)) saved.settle = saved.centre = saved.slip = saved.help;
    delete saved.help;
    // the squeeze was halved as a default; a width saved before that was only ever the old default
    if ((saved.cfg || 0) < 2) delete saved.gapW;
    // the squeeze's veil went from near-black to see-through-with-effort; a saved one was only the old default
    if ((saved.cfg || 0) < 3) delete saved.squeezeVeil;
    // closets were tripled when the being came in (from 10 to 30); a count saved before that goes to the new default
    if ((saved.cfg || 0) < 5) delete saved.closets;
    // the being was reworked (v0.131.0): it notices you further off the way out, and only sometimes
    if ((saved.cfg || 0) < 6) { delete saved.beingOff; delete saved.beingWait; }
    // the way out, infinite chalk and the arrow went on by default (v0.135.0)
    if ((saved.cfg || 0) < 7) { delete saved.chalkInf; delete saved.showPath; delete saved.showArrow; }
    // more words at dead ends, and the arrow off again (v0.144.0)
    if ((saved.cfg || 0) < 8) { delete saved.words; delete saved.showArrow; }
    if ((saved.cfg || 0) < 9) delete saved.floors;   // one floor for now (v0.146.0)
    if ((saved.cfg || 0) < 11) delete saved.memoryRooms;   // the cards and the fire joined the phone (v0.154.0), then hiding (v0.155.0)
    if ((saved.cfg || 0) < 12) delete saved.liesToUndo;   // every one of the wall's lies, now (v0.170.0)
    saved.cfg = 12;
    Object.assign(S, saved);
  } catch (e) {}
  if (!TEX.themes[S.theme]) S.theme = FP_CONFIG.theme;
  const saveS = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} };

  // ── the look ──────────────────────────────────────────────
  let T, FR, FG, FB;
  function applyTheme() {
    T = TEX.themes[S.theme];
    const f = TEX.hex(T.fog); FR = f & 0xff; FG = (f >>> 8) & 0xff; FB = (f >>> 16) & 0xff;
    document.body.dataset.theme = S.theme;
    FP_SOUND.setLook(S.theme);
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
    ovDep = new Float32Array(RW * RH); colOv = new Uint8Array(RW); zbuf = new Float32Array(RW); colFace = new Int32Array(RW).fill(-1); colDoor = new Int32Array(RW).fill(-1); colDoorTop = new Float32Array(RW); colDoorBot = new Float32Array(RW); colDoorT = new Float32Array(RW); colVeil = new Float32Array(RW); colWallT = new Float32Array(RW); colU = new Float32Array(RW); colTop = new Float32Array(RW); colBot = new Float32Array(RW);
  }
  addEventListener('resize', resize);

  // ── the maze, as the renderer wants it ────────────────────
  let exitDir = null;   // which way the exit's doorway faces out of the exit tile
  let wallVar = null, floorVar, ceilVar, low, exitFace, seen, nbm, room, flickers = [], lampLvl;
  const HD = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // heading 0 east, 1 south, 2 west, 3 north (y runs down)
  const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !tiles[y][x];
  const hash = (x, y) => { let h = (x * 73856093) ^ (y * 19349663) ^ SEED; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };

  function index() {
    wallVar = new Uint8Array(W * H); floorVar = new Uint8Array(W * H);
    low = new Uint8Array(W * H); exitFace = new Uint8Array(W * H); exitDir = null;
    ceilVar = new Uint8Array(W * H); nbm = new Uint8Array(W * H); room = new Uint8Array(W * H);
    lampLvl = new Float32Array(W * H).fill(1); flickers = [];
    if (!seen || seen.length !== W * H) seen = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y);
      wallVar[y * W + x] = T.pick[h % T.pick.length];   // mostly plain, the odd variant — weighted, not uniform
      floorVar[y * W + x] = (h >>> 8) % T.floors.length;
      if (T.ceils) {
        const c = ceilVar[y * W + x] = T.ceilPick[(h >>> 16) % T.ceilPick.length];
        if (T.ceils[c].glow && (h >>> 5) % 6 === 0) flickers.push(y * W + x);   // one lamp in six is on its way out
      }
      if (solid(x, y)) continue;
      // which of the eight neighbours are wall: what the corner shadows are laid from
      nbm[y * W + x] = (solid(x - 1, y) ? 1 : 0) | (solid(x + 1, y) ? 2 : 0) | (solid(x, y - 1) ? 4 : 0) | (solid(x, y + 1) ? 8 : 0)
        | (solid(x - 1, y - 1) ? 16 : 0) | (solid(x + 1, y - 1) ? 32 : 0) | (solid(x - 1, y + 1) ? 64 : 0) | (solid(x + 1, y + 1) ? 128 : 0);
      // a room tile: part of some 2x2 of open floor. A corridor is one tile wide, so it never is —
      // the same test the top-down's openFloor() makes
      for (const [ax, ay] of [[0, 0], [-1, 0], [0, -1], [-1, -1]])
        if (!solid(x + ax, y + ay) && !solid(x + ax + 1, y + ay) && !solid(x + ax, y + ay + 1) && !solid(x + ax + 1, y + ay + 1)) { room[y * W + x] = 1; break; }
    }
    // a look can pick one set of walls for those facing a room and another for those facing a hall (the school:
    // lockers and doors along the halls, boards in the rooms)
    if (T.pickHall) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(x, y)) continue;
      let toRoom = false, toHall = false;
      for (const [dx, dy] of HD) { const nx = x + dx, ny = y + dy; if (solid(nx, ny)) continue; if (room[ny * W + nx]) toRoom = true; else toHall = true; }
      if (!toRoom && !toHall) continue;
      const list = toRoom ? T.pickRoom : T.pickHall, h = hash(x, y);
      wallVar[y * W + x] = list[(h >>> 4) % list.length];
    }
    // a crawl gap, or the open cell between two gaps of one squeeze: low overhead, you go through bent
    for (const set of [crawlGaps, crawlCells]) for (const k of set) {
      const [x, y] = k.split(',').map(Number);
      if (!solid(x, y)) low[y * W + x] = 1;
    }
    buildSlots();
    buildLight();
    // the wall at the far end of the exit alley gets the doorway: the neighbour of the exit tile
    // that is wall, with open floor straight behind you as you face it
    for (const [dx, dy] of HD) {
      const fx = exit.x + dx, fy = exit.y + dy, bx = exit.x - dx, by = exit.y - dy;
      if (solid(fx, fy) && !solid(bx, by) && fx >= 0 && fy >= 0 && fx < W && fy < H) { exitFace[fy * W + fx] = 1; exitDir = [dx, dy]; }
    }
  }

  // ── squeezes ──────────────────────────────────────────────
  // Joe: "these squeeze throughs are meant to be vertical not horizontal. Think of it like a small
  // space you have to walk through, not crouch." So a squeeze tile is wall with a slot cut through
  // it, full height, `gapW` wide: a square in the middle, and an arm of the same width out to each
  // open neighbour — straight through for a gap in a wall line, an L where a squeeze bends. What is
  // left is up to eight solid boxes, which the renderer and the collision both read.
  let slots = new Map();   // tile index → Float32Array of boxes, [x0, y0, x1, y1] each, in world units
  function buildSlots() {
    slots = new Map();
    const a = 0.5 - S.gapW / 2, b = 0.5 + S.gapW / 2;
    for (let k = 0; k < W * H; k++) {
      if (!low[k]) continue;
      const x = k % W, y = (k / W) | 0, bx = [];
      const add = (x0, y0, x1, y1) => bx.push(x + x0, y + y0, x + x1, y + y1);
      add(0, 0, a, a); add(b, 0, 1, a); add(0, b, a, 1); add(b, b, 1, 1);   // the four corners are always wall
      if (solid(x, y - 1)) add(a, 0, b, a);   // and each side with nothing open beyond it
      if (solid(x, y + 1)) add(a, b, b, 1);
      if (solid(x - 1, y)) add(0, a, a, b);
      if (solid(x + 1, y)) add(b, a, 1, b);
      slots.set(k, new Float32Array(bx));
    }
  }
  // ── light ─────────────────────────────────────────────────
  // Joe: "Need short passages that are completely dark and you can only see the light from the other
  // side of it. Should we look at a more serious lighting plan?" — and then, of how dark: "very dim."
  //
  // Every tile has a brightness. A look with a ceiling lights it from its lamps: each fluorescent
  // panel floods out through open floor (never through a wall) to `reach` tiles, fading as it goes,
  // on top of the look's own `ambient`. A look with a sky is lit by the sky, evenly. On top of that:
  //   dark     — the generator's own darkness, plus short straight halls this view darkens itself
  //              (`darkHalls` of them, on their own random stream so the maze is untouched). Their
  //              lamps are out, and they sit at `darkLevel`: very dim, the far end's light showing
  //   squeeze  — a squeeze is dimmed by `squeezeDim`, and slows you by `squeezeSlow`
  // The brightness is kept at tile corners and blended across each tile, so light pools and fades
  // rather than stepping in squares. `shadow` is how much any of it shows: 0 is the old flat look.
  let dark = null, tileL = null, cornerL = null, lightBase = null, flickLamps = [], lampTiles = [], groupLamps = [];
  function buildLight() {
    const N = W * H;
    dark = new Uint8Array(N); tileL = new Float32Array(N); cornerL = new Float32Array((W + 1) * (H + 1));
    for (const key of darkTiles) { const [x, y] = key.split(',').map(Number); if (!solid(x, y)) dark[y * W + x] = 1; }
    // this view's own dark halls: maximal straight one-wide runs, three tiles or more, clear of the
    // start room and the way out, each taken with chance `darkHalls`
    const R = rng(SEED + 104729), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y);
    const inHall = (x, y, horiz) => !solid(x, y) && !room[y * W + x] && !low[y * W + x]
      && (horiz ? solid(x, y - 1) && solid(x, y + 1) : solid(x - 1, y) && solid(x + 1, y));
    const takeRun = (run) => {
      if (run.length < 3 || R() >= (S.calm && !builtTurned ? 0 : S.darkHalls)) return;   // calm until the turn
      if (run.some(([x, y]) => (Math.abs(x - sx0) < 3 && Math.abs(y - sy0) < 3) || (x === exit.x && y === exit.y))) return;
      for (const [x, y] of run) dark[y * W + x] = 1;
    };
    for (let y = 0; y < H; y++) { let run = []; for (let x = 0; x <= W; x++) { if (x < W && inHall(x, y, true)) run.push([x, y]); else { takeRun(run); run = []; } } }
    for (let x = 0; x < W; x++) { let run = []; for (let y = 0; y <= H; y++) { if (y < H && inHall(x, y, false)) run.push([x, y]); else { takeRun(run); run = []; } } }

    lightBase = new Float32Array(N).fill(T.ceils ? T.ambient : 1);
    flickLamps = []; lampTiles = []; groupLamps = [];
    const grouped = groupAt && groupAt.length === N;
    if (!T.ceils) return;
    const flick = new Set(flickers), reach = S.reach;
    for (let k = 0; k < N; k++) {
      if (solid(k % W, (k / W) | 0) || dark[k] || !T.ceils[ceilVar[k]].glow) continue;
      lampTiles.push(k);
      // flood from the lamp through open floor, so light turns corners but never comes through a wall
      const seen = new Map([[k, 0]]), q = [k], list = [];
      while (q.length) {
        const c = q.shift(), d = seen.get(c);
        const w = T.lampPower * Math.pow(Math.max(0, 1 - d / reach), 1.6);
        if (w <= 0.005) continue;
        list.push(c, w);
        const x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && !seen.has(n)) { seen.set(n, d + 1); q.push(n); } }
      }
      if (grouped && groupAt[k] >= 0) groupLamps.push({ k, list, g: groupAt[k], flick: flick.has(k) });
      else flickLamps.push({ k, list });   // every lamp is live: it can flicker, and after the turn it can go out
    }
    if (furn.length) furnLight(lightBase);
  }
  // this frame's brightness, at tiles and at their corners
  function lightFrame() {
    const N = W * H;
    tileL.set(lightBase);
    for (const lm of flickLamps) { const lv = lampLvl[lm.k]; for (let i = 0; i < lm.list.length; i += 2) tileL[lm.list[i]] += lm.list[i + 1] * lv; }
    for (const lm of groupLamps) { const lv = lampLvl[lm.k]; for (let i = 0; i < lm.list.length; i += 2) tileL[lm.list[i]] += lm.list[i + 1] * lv; }
    const grouped = groupAt && groupAt.length === N;
    for (let k = 0; k < N; k++) {
      let L = 1 - S.shadow * (1 - Math.min(1, tileL[k]));
      if (dark[k]) L = Math.min(L, S.darkLevel);
      if (chairDim && chairDim[k]) L = Math.min(L, CHAIR_DIM);
      if (darkMul < 1 && !inHeart(k)) L *= darkMul;
      // a room with its lights off is as dim as a dark hall, whatever spills in at the door
      if (grouped && groupAt[k] >= 0) { const g = lightGroups[groupAt[k]], lo = g.pitch ? PITCH : S.darkLevel; if (g.lvl < 1 && L > lo) L = lo + (L - lo) * g.lvl; }
      tileL[k] = L;
    }
    // a corner is the average of the open tiles around it
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
      let sum = 0, n = 0;
      for (let j = y - 1; j <= y; j++) for (let i = x - 1; i <= x; i++) if (!solid(i, j)) { sum += tileL[j * W + i]; n++; }
      cornerL[y * (W + 1) + x] = n ? sum / n : 1;
    }
  }

  const boxesAt = (k) => slots.get(k) || (frameAt && frameAt[k] ? frameBoxes.get(k) : null);
  // is this point inside wall — a whole wall tile, or a squeeze's jamb
  function solidAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (solid(tx, ty)) return true;
    const bx = boxesAt(ty * W + tx); if (!bx) return false;
    for (let i = 0; i < bx.length; i += 4) if (x > bx[i] && x < bx[i + 2] && y > bx[i + 1] && y < bx[i + 3]) return true;
    return false;
  }
  // the nearest jamb a ray meets inside one squeeze tile: [t, side, u] or null. Slab test per box
  const slotHit = [0, 0, 0];
  function raySlot(k, px, py, rx, ry) {
    const bx = boxesAt(k); if (!bx) return null;
    let best = 1e9, bs = 0, bu = 0;
    const ix = rx === 0 ? 1e30 : 1 / rx, iy = ry === 0 ? 1e30 : 1 / ry;
    for (let i = 0; i < bx.length; i += 4) {
      const ax = (bx[i] - px) * ix, cx = (bx[i + 2] - px) * ix, ay = (bx[i + 1] - py) * iy, cy = (bx[i + 3] - py) * iy;
      const nx = Math.min(ax, cx), fx = Math.max(ax, cx), ny = Math.min(ay, cy), fy = Math.max(ay, cy);
      const tn = Math.max(nx, ny), tf = Math.min(fx, fy);
      if (tn > 1e-4 && tn <= tf && tn < best) {
        best = tn; bs = nx > ny ? 0 : 1;
        bu = bs === 0 ? py + tn * ry : px + tn * rx;
      }
    }
    if (best === 1e9) return null;
    slotHit[0] = best; slotHit[1] = bs; slotHit[2] = bu - Math.floor(bu);
    return slotHit;
  }

  // ── the player ────────────────────────────────────────────
  const P = { x: 0, y: 0, a: 0 };
  const QUARTER = Math.PI / 2;
  const headingOf = (a) => ((Math.round(a / QUARTER) % 4) + 4) % 4;
  let anim = null, queued = null, holdFwd = false, steps = 0, won = false, lastMoveEnd = -1e9;
  let vel = 0, walkPhase = 0, bump = null, lastTile = '';

  function reset() {
    seen = new Uint8Array(W * H);
    index(); heartIndex();
    if (floor > 1) { exitFace.fill(0); exitDir = null; }   // the way out is only on floor 1
    turnIndex(); beingIndex();
    if (exitOpen() && !kidMet && floor === 1) setTimeout(spawnKid, 0);
    placeThings();
    const tx = Math.floor(start.x), ty = Math.floor(start.y);
    // face the longest open run from where you wake, so the first thing you see is a way to go
    let best = 0, bestH = 0;
    HD.forEach(([dx, dy], h) => { let n = 0; while (!solid(tx + dx * (n + 1), ty + dy * (n + 1)) && n < 40) n++; if (n > best) { best = n; bestH = h; } });
    P.x = tx + 0.5; P.y = ty + 0.5; P.a = bestH * QUARTER;
    // a chapter that opens with words on the wall wakes you facing them
    const wake = startWords.find((w) => w.h !== undefined); if (wake) P.a = wake.h * QUARTER;
    anim = null; queued = null; steps = 0; won = false; vel = 0; lastTile = '';
    // the first page, just past the end of the mat: the first thing you find
    { const sp = objs.find((o) => o.place === 'start');
      if (sp) { const fx = Math.cos(P.a), fy = Math.sin(P.a), x = Math.floor(P.x + fx * 1.1), y = Math.floor(P.y + fy * 1.1);
        if (!solid(x, y) && !low[y * W + x]) { sp.x = P.x + fx * 1.0; sp.y = P.y + fy * 1.0; } else { sp.x = P.x + fx * 0.75; sp.y = P.y + fy * 0.75; } } }
    // the mat you wake on, and its pillow behind your head: flat, so you walk over the mat; it stays there after
    if (floor === 1) {
      const fx = Math.cos(P.a), fy = Math.sin(P.a), ux = -fy, uy = fx;
      const flat = (a0, a1, d0, d1, z0, z1, m) => { const xs = [], ys = [];
        for (const a of [a0, a1]) for (const d of [d0, d1]) { xs.push(P.x + ux * a + fx * d); ys.push(P.y + uy * a + fy * d); }
        fboxes.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0, z1, m: TEX.furn.mats[m], top: TEX.furn.mats[m], topFit: false, front: null, fcode: 'n', glow: false, flat: true }); };
      flat(-0.2, 0.2, -0.16, 0.62, 0, 0.025, 'fabricDk');   // the mat, reaching out ahead of you
      flat(-0.14, 0.14, -0.3, -0.12, 0.025, 0.07, 'white'); // the pillow
    }
    fatherReset();
    $('win').classList.remove('show');
    arrive();
    $('seed').textContent = BASE + (floor > 1 ? ' · floor ' + floor : '');
    $('who').textContent = (typeof phase === 'function' ? phase().who : '') + (protoMode ? ' · prototype' : '');
    $('topdown').href = 'maze-topdown.html?seed=' + SEED;
  }
  // ── things in the world ───────────────────────────────────
  // Joe: "Need to be able to tap on things on the screen", "need to be able to mark the walls", and
  // "want to be able to put words on the walls. This might be how I tell the story of the world."
  //
  // objs    — what lies about: the maze's own pages (journals), chalk and charcoal. Walk over one or
  //           tap it to take it; a page shows what it says. Nothing is written to the top-down's save
  //           yet: what you find is kept for this run.
  // decals  — what is written on a wall face: your chalk, and the words someone left at the far end
  //           of a dead end. One 64×64 sheet per face, drawn over the wall's own texture.
  const DEC = 64;
  let pathMask = null;   // debug: the way out, marked on the floor
  let objs = [], decals = new Map(), wordSpots = [], chalk = 0, charcoalN = 0, pagesFound = 0, pagesTotal = 0, pagesAll = 0;
  const faceKey = (k, face) => k * 4 + face;   // face: 0 west, 1 east, 2 north, 3 south — the side of the wall tile you see
  function decalFor(k, face) {
    let d = decals.get(faceKey(k, face));
    if (!d) { d = new Uint32Array(DEC * DEC); decals.set(faceKey(k, face), d); }
    return d;
  }
  // ── stairs ────────────────────────────────────────────────
  // Joe: "Can we make a ramp or a staircase that goes up to another level?" — and the way we settled:
  // "fake the stairs: a door at the top or bottom loads a new sub-maze, tracking collected and mapped
  // state." A maze has `floors` of them. Floor 1 is the chapter's own maze; the ones above are mazes
  // of their own, each from its own seed off the first, so a floor is always the same floor. Going up: a
  // door marked up at the end of a far dead end — walk into it, or tap it. (It was a flight of steps for
  // a version; Joe: "Let's cut the visual stairs. It doesn't look right.") You arrive on the next floor
  // at a door marked down, in the dead end nearest where that floor's maze begins; it takes you back
  // out of the door marked up you went through. Every floor
  // remembers itself while you're away: what you took, what you chalked, which doors stand open,
  // which lights are on, what you've seen. The way out is only on floor 1. Chalk and charcoal go with
  // you; pages are counted per floor.
  // a floor is always built as it was the first time: calm, or turned. Everything placed on it (the closets
  // keep out of dark halls, and the turn brings dark halls) hangs off that, and a floor you come back to gets
  // its walls back as you left them — so building it the other way moved the closets out from under their
  // doors. Joe: "I can't get into the closet anymore. It just puts exes on them."
  let builtTurned = false;
  let floor = 1, BASE = 0, floorStates = new Map(), taken = new Set(), stairs = { up: null, down: null }, stairBusy = false;
  const floorSeed = (n) => n === 1 ? BASE : ((Math.imul(BASE, 2654435761) ^ Math.imul(n, 40503)) >>> 0) || n;
  const objKey = (o) => o.kind + ':' + o.x.toFixed(2) + ',' + o.y.toFixed(2);
  function placeStairs() {
    stairs = { up: null, down: null };
    const N = Math.max(1, Math.round(S.floors));
    if (N <= 1 && floor === 1) return [];
    const sx = Math.floor(start.x), sy = Math.floor(start.y), dist = new Int32Array(W * H).fill(-1), q = [sy * W + sx];
    dist[q[0]] = 0;
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && dist[n] < 0) { dist[n] = dist[c] + 1; q.push(n); } } }
    const ends = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      if (solid(x, y) || low[k] || room[k] || inHeart(k) || dist[k] < 0 || (x === exit.x && y === exit.y) || (Math.abs(x - sx) < 3 && Math.abs(y - sy) < 3)) continue;
      const open = HD.filter(([dx, dy]) => !solid(x + dx, y + dy)); if (open.length !== 1) continue;
      const [ox, oy] = open[0], dx = -ox, dy = -oy, wx = x + dx, wy = y + dy;
      if (low[(y + oy) * W + x + ox] || wx <= 0 || wy <= 0 || wx >= W - 1 || wy >= H - 1 || exitFace[wy * W + wx]) continue;
      ends.push({ x, y, ox: x + ox, oy: y + oy, dir: [dx, dy], k: wy * W + wx, face: faceTo(dx, dy), d: dist[k] });
    }
    if (!ends.length) return [];
    const R = rng(SEED + 200003), far = Math.max(...ends.map((e) => e.d));
    if (floor < N) { const pool = ends.filter((e) => e.d >= far * 0.6); stairs.up = pool[Math.floor(R() * pool.length)]; }
    if (floor > 1) { const pool = ends.filter((e) => e !== stairs.up && e.d >= 3).sort((a, b) => a.d - b.d); stairs.down = pool[0] || null; }
    for (const [s, up] of [[stairs.up, true], [stairs.down, false]]) if (s) drawStairDoor(decalFor(s.k, s.face), up);
    return [stairs.up, stairs.down].filter(Boolean);
  }
  // a stairwell door on the end wall, at floor level, and a plaque over it saying which way.
  // Joe: "Let's cut the visual stairs. It doesn't look right. Just have a door that says 'Up'."
  function drawStairDoor(d, up) {
    const dp = TEX.door.px, r0 = 14, r1 = 64, c0 = 15, c1 = 49;
    for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) {
      const tu = Math.min(31, ((x - c0) / (c1 - c0) * 32) | 0), tv = Math.min(31, ((y - r0) / (r1 - r0) * 32) | 0);
      d[y * DEC + x] = dp[tv * 32 + tu];
    }
    const word = up ? 'up' : 'down', pw = word.length * 4 + 3, px0 = Math.round(32 - pw / 2), py0 = 5;
    for (let y = py0; y < py0 + 8; y++) for (let x = px0; x < px0 + pw; x++) d[y * DEC + x] = TEX.hex('#2c3a2e');
    for (let c = 0; c < word.length; c++) { const g = FONT[word[c]]; for (let r = 0; r < 5; r++) for (let q2 = 0; q2 < 3; q2++) if (g[r * 3 + q2] === '#') d[(py0 + 2 + r) * DEC + px0 + 2 + c * 4 + q2] = TEX.hex('#d9e6cf'); }
  }
  const facing = (dx, dy) => Math.cos(P.a) * dx + Math.sin(P.a) * dy;
  // every frame: pushing into a stairwell door, up or down
  function stairFrame() {
    if (stairBusy || hidden || vel < 0.05) return;
    const tx = Math.floor(P.x), ty = Math.floor(P.y);
    for (const [s, to] of [[stairs.up, floor + 1], [stairs.down, floor - 1]]) {
      if (!s || tx !== s.x || ty !== s.y || facing(s.dir[0], s.dir[1]) <= 0.6) continue;
      const gap = s.dir[0] ? (s.dir[0] > 0 ? s.x + 1 - P.x : P.x - s.x) : (s.dir[1] > 0 ? s.y + 1 - P.y : P.y - s.y);
      if (gap < RAD + 0.06) goFloor(to);
    }
  }
  // a tap on either door, from near enough
  function stairTap(fk) {
    for (const [s, to] of [[stairs.up, floor + 1], [stairs.down, floor - 1]]) {
      if (s && (fk === faceKey(s.k, s.face) || facing(s.dir[0], s.dir[1]) > 0.6) && Math.hypot(s.x + 0.5 - P.x, s.y + 0.5 - P.y) < 1.4) { goFloor(to); return true; }
    }
    return false;
  }
  function saveFloor() {
    floorStates.set(floor, { taken: new Set(taken), decals: new Map([...decals].map(([k, v]) => [k, v.slice()])), doors: doors.map((d) => [d.open, d.swing]),
      lights: lightGroups.map((g) => g.on), seen: seen.slice(), builtTurned });
  }
  function goFloor(n, now) {
    if (stairBusy || n < 1 || n > Math.max(1, Math.round(S.floors))) return;
    const up = n > floor;
    stairBusy = true; clearStick();
    $('fadeText').textContent = 'floor ' + n; $('fade').classList.add('show');
    FP_SOUND.stairs(up);
    setTimeout(() => {
      saveFloor();
      const keepChalk = chalk, keepCharcoal = charcoalN, keepPages = pagesFound;
      floor = n; SEED = floorSeed(n);
      builtTurned = floorStates.has(n) ? floorStates.get(n).builtTurned : turned;
      applyMazeDebug(); generate(SEED); thinSqueezes(); carveHeart(); spreadPages(); reset();
      chalk = keepChalk; charcoalN = keepCharcoal; pagesFound = keepPages;
      const st = floorStates.get(floor);
      taken = st ? new Set(st.taken) : new Set();
      if (st) {
        objs = objs.filter((o) => !taken.has(objKey(o)));
        decals = st.decals; seen = st.seen;
        doors.forEach((d, i) => { if (st.doors[i]) { d.open = d.t = st.doors[i][0]; d.swing = st.doors[i][1]; d.seg = doorSeg(d); } });
        lightGroups.forEach((g, i) => { g.on = !!st.lights[i]; g.lvl = g.on ? 1 : 0; g.at = -1e9; });
      }
      // arrive just out from the door you came through: marked down going up, up going down
      const s = up ? stairs.down : stairs.up;
      if (s) {
        const [dx, dy] = s.dir;
        P.x = s.x + 0.5 - dx * 0.1; P.y = s.y + 0.5 - dy * 0.1;
        P.a = Math.atan2(-dy, -dx); lastTile = ''; lastX = P.x; lastY = P.y; arrive();
      }
      hud();
      setTimeout(() => { $('fade').classList.remove('show'); stairBusy = false; }, 450);
    }, 1200);
  }
  // an X already on a wall of the start room, with WALL_TEACH over it: the side wall nearest where you wake
  function placeTeachX(usedFaces) {
    if (floor !== 1 || typeof WALL_TEACH === 'undefined' || !character || !WALL_TEACH[character.name]) return -1;
    const sx = Math.floor(start.x), sy = Math.floor(start.y); let best = null, bd = 1e9;
    for (let y = sy - 3; y <= sy + 3; y++) for (let x = sx - 3; x <= sx + 3; x++) {
      if (solid(x, y) || !room[y * W + x] || low[y * W + x]) continue;
      for (const [dx, dy] of HD) { const wx = x + dx, wy = y + dy; if (!solid(wx, wy) || exitFace[wy * W + wx]) continue;
        const fk = faceKey(wy * W + wx, faceTo(dx, dy)); if (usedFaces.has(fk)) continue;
        const d = Math.hypot(x - sx, y - sy) + (x === sx && y === sy ? 0.5 : 0); if (d < bd) { bd = d; best = { k: wy * W + wx, face: faceTo(dx, dy), fk }; } } }
    if (!best) return -1;
    const d = decalFor(best.k, best.face);
    hand(d, WALL_TEACH[character.name], 12, 5, 44, 2, TEX.hex('#ece7da'), rng(SEED + 250001));   // two lines, "draw / an x"
    chalkSign(d, 'x', 0.5, 0.74);
    return best.fk;
  }
  // the chapter's two opening walls (WALL_START): one across from where you wake, which you are then
  // turned to face; one straight ahead as you step out of the start room through its gap. [] if the
  // self has none, or the walls aren't there to write on
  let startWords = [];
  const faceTo = (dx, dy) => dx === 1 ? 0 : dx === -1 ? 1 : dy === 1 ? 2 : 3;
  function startSpots() {
    const lines = floor === 1 && typeof WALL_START !== 'undefined' && character ? WALL_START[character.name] : null;
    if (!lines) return [];
    const out = [], sx = Math.floor(start.x), sy = Math.floor(start.y);
    const usable = (k) => !exitFace[k] && (k % W) > 0 && (k % W) < W - 1 && ((k / W) | 0) > 0 && ((k / W) | 0) < H - 1;
    const inRoom = (x, y) => !startRoom || (x >= startRoom.x0 && x <= startRoom.x1 && y >= startRoom.y0 && y <= startRoom.y1);
    // waking: a wall of the start room 2–5 tiles off in a straight line from the bed, the farthest
    // such, so it reads across the room rather than pressed to your face — and never out through the
    // gap, which would put it on the wall the second line wants
    if (lines[0]) {
      let best = null;
      HD.forEach(([dx, dy], h) => {
        let n = 1; while (!solid(sx + dx * n, sy + dy * n) && inRoom(sx + dx * n, sy + dy * n) && n < 8) n++;
        const x = sx + dx * n, y = sy + dy * n, k = y * W + x;
        if (n >= 2 && n <= 5 && solid(x, y) && usable(k) && (!best || n > best.n)) best = { k, face: faceTo(dx, dy), h, n, text: lines[0] };
      });
      if (best) out.push(best);
    }
    // leaving: out through the start room's gap, the wall straight ahead if the hall ends within six
    // tiles; if it runs on, the first side wall just outside, which you see as you step out
    if (lines[1] && startGap && startRoom) {
      const [gx, gy] = startGap;
      const dir = HD.find(([dx, dy]) => inRoom(gx - dx, gy - dy) && !solid(gx + dx, gy + dy));
      if (dir) {
        const [dx, dy] = dir, taken = (k, f) => out.some((o) => o.k === k && o.face === f);
        let n = 1; while (!solid(gx + dx * n, gy + dy * n) && n < 7) n++;
        let spot = null, k = (gy + dy * n) * W + gx + dx * n;
        if (solid(gx + dx * n, gy + dy * n) && usable(k) && !taken(k, faceTo(dx, dy))) spot = { k, face: faceTo(dx, dy) };
        for (let m = 1; m <= 3 && !spot; m++) for (const [qx, qy] of [[-dy, dx], [dy, -dx]]) {
          const x = gx + dx * m + qx, y = gy + dy * m + qy; k = y * W + x;
          if (!spot && solid(x, y) && !solid(gx + dx * m, gy + dy * m) && usable(k) && !taken(k, faceTo(qx, qy))) spot = { k, face: faceTo(qx, qy) };
        }
        if (spot) out.push({ ...spot, text: lines[1] });
      }
    }
    return out;
  }
  function placeThings() {
    objs = []; decals = new Map(); chalk = CONFIG.chalkStart; charcoalN = 0; pagesFound = 0;
    const at = (key) => key.split(',').map(Number);
    for (const [key, pg] of journals) { const [x, y] = at(key); objs.push({ x: x + 0.5, y: y + 0.5, kind: 'page', pg, tex: TEX.sprites.book, h: 0.3, glow: 0.35 }); }
    for (const key of chalkSpots) { const [x, y] = at(key); objs.push({ x: x + 0.5, y: y + 0.5, kind: 'chalk', tex: TEX.sprites.chalk, h: 0.1, glow: 0.2 }); }
    for (const key of charcoalSpots) { const [x, y] = at(key); objs.push({ x: x + 0.5, y: y + 0.5, kind: 'charcoal', tex: TEX.sprites.charcoal, h: 0.1, glow: 0 }); }
    pagesTotal = pagesAll || journals.size;
    pathMask = new Uint8Array(W * H);
    if (floor === 1) for (const [x, y] of solutionPath) if (x >= 0 && y >= 0 && x < W && y < H) pathMask[y * W + x] = 1;
    // words at the far end of dead ends: the wall you face as you walk in. Their own random stream,
    // so where they fall never moves anything else
    const R = rng(SEED + 130003), words = WALL_WORDS[character ? character.name : ''] || WALL_WORDS._;
    const sx0 = Math.floor(start.x), sy0 = Math.floor(start.y), ends = [];
    startWords = startSpots(); const startFaces = new Set(startWords.map((w) => faceKey(w.k, w.face)));
    const stairSpots = placeStairs(); for (const s of stairSpots) startFaces.add(faceKey(s.k, s.face));
    const stairTiles = new Set(stairSpots.map((s) => s.y * W + s.x));
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (solid(x, y) || low[y * W + x] || inHeart(y * W + x) || (Math.abs(x - sx0) < 3 && Math.abs(y - sy0) < 3)) continue;
      const open = HD.filter(([dx, dy]) => !solid(x + dx, y + dy));
      if (open.length !== 1) continue;
      const [ox, oy] = open[0], dx = -ox, dy = -oy;   // walking in, you face away from the one way out
      const face = dx === 1 ? 0 : dx === -1 ? 1 : dy === 1 ? 2 : 3;
      // never the exit's own wall. Joe: "There is drawn text over the exit from the kid. It looks like a bug."
      // The exit's alley is a dead end, so its doorway was a place for words like any other
      if (exitFace[(y + dy) * W + x + dx]) continue;
      if (!startFaces.has(faceKey((y + dy) * W + x + dx, face)) && !stairTiles.has(y * W + x)) ends.push({ k: (y + dy) * W + x + dx, face });
    }
    // choose every spot and line first, then draw: the hand's wobble draws from the stream too, and
    // must not move where the next line goes
    const pool = words.slice(), picks = [];
    for (let n = 0; n < S.words && ends.length && pool.length; n++)
      picks.push([ends.splice(Math.floor(R() * ends.length), 1)[0], pool.splice(Math.floor(R() * pool.length), 1)[0]]);
    for (const w of startWords) picks.push([w, w.text]);
    placeChalkPile();
    const teachFace = placeTeachX(startFaces);
    if (teachFace >= 0) startFaces.add(teachFace);
    wordSpots = picks.map(([e, text]) => ({ k: e.k, face: e.face, text }));
    // the chapter's two opening walls in chalk, the kid's own hand. Joe: "The opening text on the walls needs to be white, not
    // black. Too hard to read and doesn't match the 'chalk' feel"
    for (const [e, text] of picks) { const open = startWords.includes(e); writeWords(decalFor(e.k, e.face), text, R, open, open && !(T.walls[wallVar[e.k]] || {}).board); }   // a chalkboard (school) is shorter than the wall: there, the smaller hand
    placeDoors();
    const reservedSet = new Set(picks.map(([e]) => faceKey(e.k, e.face)).concat(stairSpots.map((s) => faceKey(s.k, s.face))));
    for (const fk of writeBoards()) reservedSet.add(fk);
    placeStory(reservedSet);
    placeMemories(reservedSet);
    const reserved = [...reservedSet];
    placeClosets(new Set(reserved));
    placeSwitches(new Set(reserved.concat(closets.map((c) => faceKey(c.k, c.face)))));
    placeFurniture();
    storyProps();
    furnishKidRoom();
    memoryProps();
    placePages();
    lockExit();
    placeGuard();
    buildLight();
    // no wall to cross out (a maze without the room for it): the heart is open from the start, or nothing could open it
    if (heart && heart.sealed && floor === 1 && !story.some((q) => q.lieFaces)) openHeart(true);
    hud();
  }

  // ── doors ─────────────────────────────────────────────────
  // Joe: "think about doors as a variation of the squeeze through, but instead of a squeeze there's a
  // door you can click on and it'll open." They go where the maze is already open — a one-wide
  // passage between two cells, most often the mouth of a room — so the maze underneath never
  // changes and every door is a real way through. Tap one within reach: it swings open, out into the
  // room, and stays open; tap it again to shut it. `doorsOpen` of them start the level open.
  //
  // A door is a leaf one tile wide, hinged at one jamb: a line segment the renderer tests every
  // column against, and the collision pushes you off. Open, it lies back against the wall of the
  // tile it swung into.
  // Joe: "we need to bring the walls in on either side of a door … doors should be on the edges of a
  // tile, not in the middle. The part of the wall that comes in should only be a couple inches deep.
  // This way we can have a normal shaped door with a wall around it." So a door tile carries a thin
  // plate (PLATE deep) on its edge toward the room: two jambs either side of a DOOR_W opening, full
  // height, and a header over it from DOOR_H up. The leaf fills the opening and swings into the room.
  let doors = [], frameBoxes = new Map(), frameAt = null;
  const DOOR_MS = 380, DOOR_W = 0.56, DOOR_H = 0.8, PLATE = 0.06;
  function placeDoors() {
    doors = [];
    const R = rng(SEED + 150001), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y);
    const near = (x, y, n) => Math.abs(x - sx0) <= n && Math.abs(y - sy0) <= n;
    const taken = new Set(objs.map((o) => Math.floor(o.y) * W + Math.floor(o.x)));
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      if (solid(x, y) || low[k] || room[k] || inHeart(k) || taken.has(k) || near(x, y, 3) || (x === exit.x && y === exit.y)) continue;
      // a wall-line tile: between two cells, which sit on odd coordinates
      if ((x & 1) === (y & 1)) continue;
      const ew = !solid(x - 1, y) && !solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1);
      const ns = !solid(x, y - 1) && !solid(x, y + 1) && solid(x - 1, y) && solid(x + 1, y);
      if (!ew && !ns) continue;
      const a = ew ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
      const roomSide = a.findIndex(([dx, dy]) => room[(y + dy) * W + x + dx]);
      if (R() >= (roomSide >= 0 ? S.doorRoom : S.doorHall)) continue;
      // it swings out into the room if there is one, otherwise whichever way
      const sw = roomSide >= 0 ? (roomSide === 0 ? -1 : 1) : (R() < 0.5 ? -1 : 1);
      const hinge = R() < 0.5 ? 0 : 1;
      const open = R() < S.doorsOpen ? 1 : 0;
      const d = { x, y, k, axis: ew ? 'x' : 'y', sw, swing: sw, hinge, open, t: open };
      // the plate: on the edge toward the side it swings to, PLATE deep, the opening centred in it
      const oa = 0.5 - DOOR_W / 2, ob = 0.5 + DOOR_W / 2, p0 = sw > 0 ? 1 - PLATE : 0, p1 = p0 + PLATE;
      d.plane = (ew ? x : y) + (p0 + p1) / 2;
      d.open0 = (ew ? y : x) + oa; d.open1 = (ew ? y : x) + ob;
      d.boxes = ew ? [x + p0, y, x + p1, y + oa, x + p0, y + ob, x + p1, y + 1]
                   : [x, y + p0, x + oa, y + p1, x + ob, y + p0, x + 1, y + p1];
      d.seg = doorSeg(d); doors.push(d);
    }
    frameBoxes = new Map(); frameAt = new Uint8Array(W * H);
    for (const d of doors) { frameBoxes.set(d.k, new Float32Array(d.boxes)); frameAt[d.k] = 1; }
  }
  // the leaf as a segment [ax, ay, bx, by], at how far open it is (0 shut … 1 open): hinged at one
  // jamb in the plate, shut across the opening, open standing out at a right angle to the `swing` side.
  // Joe: "I can see light through the edges of the door." So shut, the leaf runs a little way into
  // both jambs (LAP), and there is no seam at either end for the room behind to show through; the
  // jambs hide the overlap, since the leaf is only drawn where it is nearer than the wall.
  const LAP = 0.012;
  function doorSeg(d) {
    const th = EASE.io(d.t) * QUARTER, L = DOOR_W + 2 * LAP;
    const h = d.hinge ? d.open1 + LAP : d.open0 - LAP, dir = d.hinge ? -1 : 1;
    if (d.axis === 'x') return [d.plane, h, d.plane + d.swing * L * Math.sin(th), h + dir * L * Math.cos(th)];
    return [h, d.plane, h + dir * L * Math.cos(th), d.plane + d.swing * L * Math.sin(th)];
  }
  // Joe: "Door should always open away from me. This will later help me tell which direction I went
  // through a door by which way it was opened." So opening, it swings to whichever side of the plate
  // you aren't on, and stays that way until someone opens it again. Doors that start open swing out
  // into the room, as they always have: somebody else opened those.
  function toggleDoor(d) {
    if (d.locked && !d.open) { FP_SOUND.locked(); return; }   // held shut (the fire room's, while it burns)
    if (!d.open) d.swing = (d.axis === 'x' ? P.x : P.y) < d.plane ? 1 : -1;
    d.open = d.open ? 0 : 1; FP_SOUND.door(!!d.open);
  }
  function doorsFrame(dt) {
    for (const d of doors) if (d.t !== d.open) d.t = d.open ? Math.min(1, d.t + dt * 1000 / DOOR_MS) : Math.max(0, d.t - dt * 1000 / DOOR_MS);
    for (const d of doors) d.seg = doorSeg(d);
  }

  // ── closets ───────────────────────────────────────────────
  // Joe: "some of the doors you can step into and then we change the camera view to just be looking
  // through a slotted vent in the door into the main hall you were just in. We have a button that you
  // could press to exit the door, which is the same you would press to get into it." A closet is a
  // narrow, lighter door on a solid wall — never a way anywhere. Tap it to step in; Step out, out.
  let closets = [], hidden = null;
  function placeClosets(usedFaces) {
    closets = [];
    for (const st of story) if (st.closet) {   // the hiding room's own, before any other
      closets.push(st.closet); const d = decalFor(st.closet.k, st.closet.face), art = TEX.closet.px;
      for (let i = 0; i < DEC * DEC; i++) if (art[i]) d[i] = art[i];
    }
    const R = rng(SEED + 160001), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y), cand = [];
    const doorTiles = new Set(doors.map((d) => d.k));
    // not in a pocket that squeezes shut off from the rest: "Closets in one room squeeze spaces doesn't make sense" (Joe).
    // The floor split at every squeeze; a closet only in a piece of it at least POCKET tiles big — the maze proper,
    // not the room behind a squeeze (the start room can open by one, so it isn't reachability from the start)
    const POCKET = 40, piece = new Int32Array(W * H).fill(-1), size = [];
    for (let k0 = 0; k0 < W * H; k0++) { if (piece[k0] >= 0 || solid(k0 % W, (k0 / W) | 0) || low[k0]) continue;
      const q = [k0]; piece[k0] = size.length;
      for (let i = 0; i < q.length; i++) { const c = q[i], cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (piece[n] < 0 && !solid(cx + dx, cy + dy) && !low[n]) { piece[n] = size.length; q.push(n); } } }
      size.push(q.length); }
    const inMaze = (k) => piece[k] >= 0 && size[piece[k]] >= POCKET;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      // not in a dark hall: the point of a closet is what you can see from it
      if (solid(x, y) || !inMaze(y * W + x) || low[y * W + x] || dark[y * W + x] || inHeart(y * W + x) || doorTiles.has(y * W + x) || (Math.abs(x - sx0) < 3 && Math.abs(y - sy0) < 3)) continue;
      HD.forEach(([dx, dy]) => {
        const wx = x + dx, wy = y + dy;
        if (!solid(wx, wy) || wx <= 0 || wy <= 0 || wx >= W - 1 || wy >= H - 1 || exitFace[wy * W + wx]) return;
        const face = dx === 1 ? 0 : dx === -1 ? 1 : dy === 1 ? 2 : 3, k = wy * W + wx;
        if (usedFaces.has(faceKey(k, face))) return;
        cand.push({ k, face, x, y, dx: -dx, dy: -dy });   // dx, dy: out of the closet, into the room
      });
    }
    for (let n = 0; n < S.closets && cand.length; n++) {
      const c = cand.splice(Math.floor(R() * cand.length), 1)[0];
      if (closets.some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < 4)) { n--; continue; }
      closets.push(c);
      const d = decalFor(c.k, c.face), art = TEX.closet.px;
      for (let i = 0; i < DEC * DEC; i++) if (art[i]) d[i] = art[i];
    }
  }
  // ── light switches ────────────────────────────────────────
  // Joe: "Getting lights to turn on and off in a space with the switch can become an interesting tool
  // to see hidden things." And: "light switches or any other thing you interact with on a wall [should]
  // not allow you to put an X on the wall."
  //
  // `switches` rooms a maze get one: a plate on the wall beside the way in, on the inside, at hand
  // height. Tap it and every lamp in that room goes out, or comes back with a fluorescent stutter.
  // `switchOff` of them are dark when you arrive, as dim as a dark hall. What lies in a dark room
  // doesn't catch the light the way it does elsewhere: a page there is found by switching it on.
  // A room is one run of the renderer's room tiles; only rooms with a lamp in them are candidates,
  // so a look with a sky has none.
  let lightGroups = [], groupAt = null, switchFace = new Map();
  function placeSwitches(usedFaces) {
    lightGroups = []; switchFace = new Map(); groupAt = new Int16Array(W * H).fill(-1);
    placeSecret(usedFaces);
    if (!T.ceils) return;
    const secret = secretSet();
    const R = rng(SEED + 170003), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y), comp = new Int32Array(W * H).fill(-1), rooms = [];
    for (let k0 = 0; k0 < W * H; k0++) {
      if (!room[k0] || comp[k0] >= 0) continue;
      const tiles = [k0]; comp[k0] = rooms.length;
      for (let i = 0; i < tiles.length; i++) { const c = tiles[i], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (room[n] && comp[n] < 0 && !solid(x + dx, y + dy)) { comp[n] = rooms.length; tiles.push(n); } } }
      rooms.push(tiles);
    }
    const cands = [];
    rooms.forEach((tiles, ri) => {
      if (!tiles.some((k) => T.ceils[ceilVar[k]].glow && !dark[k])) return;           // nothing to switch
      if (secret && tiles.some((k) => secret.has(k))) return;                            // the kid's room has its own
      if (storyAt && tiles.some((k) => storyAt[k] >= 0)) return;                         // and a story room is set as it is
      if (tiles.some((k) => Math.abs(k % W - sx0) < 2 && Math.abs(((k / W) | 0) - sy0) < 2)) return;   // not the room you wake in
      // the plate: a mouth tile m next to room tile r; the wall w beside m, seen from the room tile beside r
      const spots = [];
      for (const r of tiles) { const rx = r % W, ry = (r / W) | 0;
        for (const [dx, dy] of HD) { const mx = rx + dx, my = ry + dy, mk = my * W + mx;
          if (solid(mx, my) || comp[mk] === ri) continue;
          for (const [px, py] of [[-dy, dx], [dy, -dx]]) {
            const wx = mx + px, wy = my + py, vx = rx + px, vy = ry + py, wk = wy * W + wx;
            if (!solid(wx, wy) || comp[vy * W + vx] !== ri || exitFace[wk] || wx <= 0 || wy <= 0 || wx >= W - 1 || wy >= H - 1) continue;
            const face = dx === 1 ? 0 : dx === -1 ? 1 : dy === 1 ? 2 : 3;
            if (!usedFaces.has(faceKey(wk, face))) spots.push({ k: wk, face });
          } } }
      if (spots.length) cands.push({ tiles, spot: spots[Math.floor(R() * spots.length)] });
    });
    for (let n = 0; n < S.switches && cands.length; n++) {
      const c = cands.splice(Math.floor(R() * cands.length), 1)[0];
      const g = { tiles: c.tiles, k: c.spot.k, face: c.spot.face, on: R() >= (S.calm && !builtTurned ? 0 : S.switchOff), at: -1e9, lvl: 1 };
      g.lvl = g.on ? 1 : 0;
      const gi = lightGroups.push(g) - 1;
      for (const k of c.tiles) groupAt[k] = gi;
      switchFace.set(faceKey(g.k, g.face), g);
      drawSwitch(g);
    }
  }
  // ── furniture ─────────────────────────────────────────────
  // Joe: "Need furniture in the space as well. Desks, couches, office lamps, water cooler, different
  // for each theme, but let's start with back rooms theme." Rooms only — a hall is one wide and
  // anything in it would be a wall — and only against their walls: a piece with a long side (desk,
  // couch, cabinet) backs onto one wall, the rest go in corners. Never next to a way in or out, never
  // on a page or a chalk, never in front of a switch, a closet or words, and every piece is checked:
  // with it in, every way into the room still reaches every other, or it doesn't go in. A floor lamp
  // gives a pool of light, and only goes in rooms whose lights are always on. `furniture` scales how
  // much; a look without `furnish` has none. Its own random stream.
  //
  // Each piece is boxes (Joe: "actual meshes, cubes … that we can then put the pixels over"): in the
  // piece's own frame, `a` along the wall (0 its middle), `d` out from the wall, `z` up (a wall is 1
  // tall, so 0.3 is desk height). m: material for its faces (TEX.furn.mats), top: another for its top,
  // front: a picture stretched over the face that looks into the room, topFit: the top stretched too.
  // `half`: how far it reaches along the wall either side, for tucking into a corner.
  let furn = [], furnAt = null, fboxes = [];
  const FURN = {
    desk: { wall: true, half: 0.37, boxes: [
      { a: [-0.37, 0.37], d: [0.02, 0.36], z: [0.29, 0.31], m: 'laminate' },          // the top
      { a: [-0.36, -0.33], d: [0.04, 0.34], z: [0, 0.29], m: 'steel' },               // a leg panel
      { a: [0.12, 0.36], d: [0.04, 0.34], z: [0, 0.29], m: 'laminate', front: 'pedestal' },
      { a: [-0.33, 0.12], d: [0.03, 0.06], z: [0.1, 0.29], m: 'laminate' },           // the modesty panel
      { a: [-0.1, 0.1], d: [0.06, 0.25], z: [0.31, 0.45], m: 'beige', front: 'crt' },  // a dead CRT
      { a: [-0.1, 0.1], d: [0.44, 0.62], z: [0.16, 0.19], m: 'fabricDk' },            // the chair, pulled out
      { a: [-0.09, 0.09], d: [0.6, 0.63], z: [0.19, 0.37], m: 'fabricDk' },
      { a: [-0.015, 0.015], d: [0.52, 0.54], z: [0.03, 0.16], m: 'steel' },
      { a: [-0.1, 0.1], d: [0.43, 0.63], z: [0, 0.025], m: 'dark' } ] },
    couch: { wall: true, half: 0.39, boxes: [
      { a: [-0.39, 0.39], d: [0.02, 0.36], z: [0.03, 0.15], m: 'fabricDk' },
      { a: [-0.33, 0.33], d: [0.09, 0.36], z: [0.15, 0.2], m: 'fabric' },             // the seat cushions
      { a: [-0.33, 0.33], d: [0.02, 0.1], z: [0.15, 0.36], m: 'fabric' },             // the back
      { a: [-0.39, -0.33], d: [0.02, 0.36], z: [0.15, 0.26], m: 'fabricDk' },         // the arms
      { a: [0.33, 0.39], d: [0.02, 0.36], z: [0.15, 0.26], m: 'fabricDk' },
      { a: [-0.38, -0.35], d: [0.3, 0.34], z: [0, 0.03], m: 'dark' }, { a: [0.35, 0.38], d: [0.3, 0.34], z: [0, 0.03], m: 'dark' } ] },
    cabinet: { wall: true, half: 0.15, boxes: [ { a: [-0.15, 0.15], d: [0.02, 0.3], z: [0, 0.55], m: 'steel', front: 'cabinet' } ] },
    cooler: { half: 0.1, boxes: [
      { a: [-0.1, 0.1], d: [0.03, 0.23], z: [0, 0.4], m: 'white', front: 'cooler' },
      { a: [-0.07, 0.07], d: [0.06, 0.2], z: [0.4, 0.56], m: 'bottle' } ] },
    boxes: { half: 0.2, boxes: [
      { a: [-0.2, 0.15], d: [0.02, 0.32], z: [0, 0.18], m: 'card', top: 'boxTop', topFit: true },
      { a: [-0.1, 0.14], d: [0.06, 0.26], z: [0.18, 0.3], m: 'card', top: 'boxTop', topFit: true } ] },
    bin: { half: 0.07, boxes: [ { a: [-0.07, 0.07], d: [0.04, 0.18], z: [0, 0.16], m: 'bin', top: 'dark' } ] },
    lamp: { half: 0.08, light: true, boxes: [
      { a: [-0.07, 0.07], d: [0.08, 0.22], z: [0, 0.02], m: 'dark' },
      { a: [-0.012, 0.012], d: [0.138, 0.162], z: [0.02, 0.56], m: 'dark' },
      { a: [-0.085, 0.085], d: [0.065, 0.235], z: [0.56, 0.69], m: 'shade' } ] },
    // the school look's: a kid's desk with its chair fixed to it, the teacher's desk (an apple on it), a low bookcase
    kidDesk: { wall: true, half: 0.2, boxes: [
      { a: [-0.2, 0.2], d: [0.04, 0.3], z: [0.22, 0.24], m: 'wood' },
      { a: [-0.19, 0.19], d: [0.05, 0.29], z: [0.16, 0.18], m: 'steel' },            // the book box under the lid
      { a: [-0.19, -0.17], d: [0.06, 0.08], z: [0, 0.22], m: 'steel' }, { a: [0.17, 0.19], d: [0.06, 0.08], z: [0, 0.22], m: 'steel' },
      { a: [-0.19, -0.17], d: [0.26, 0.28], z: [0, 0.22], m: 'steel' }, { a: [0.17, 0.19], d: [0.26, 0.28], z: [0, 0.22], m: 'steel' },
      { a: [-0.13, 0.13], d: [0.36, 0.54], z: [0.13, 0.15], m: 'plastic' },           // the seat
      { a: [-0.13, 0.13], d: [0.54, 0.56], z: [0.15, 0.32], m: 'plastic' },           // its back
      { a: [-0.012, 0.012], d: [0.3, 0.46], z: [0.1, 0.12], m: 'steel' } ] },         // the bar that holds it to the desk
    teacherDesk: { wall: true, half: 0.4, boxes: [
      { a: [-0.4, 0.4], d: [0.02, 0.38], z: [0.3, 0.33], m: 'wood' },
      { a: [-0.39, -0.1], d: [0.04, 0.36], z: [0, 0.3], m: 'wood', front: 'pedestal' },
      { a: [0.25, 0.39], d: [0.04, 0.36], z: [0, 0.3], m: 'wood' },
      { a: [0.18, 0.24], d: [0.2, 0.26], z: [0.33, 0.39], m: 'apple' },
      { a: [-0.3, -0.12], d: [0.1, 0.24], z: [0.33, 0.36], m: 'white' } ] },          // a stack of papers
    // the kid's room: a small bed along a wall, a kid's chair; and the side table by the saved chair in the waiting room
    kidBed: { wall: true, half: 0.26, boxes: [
      { a: [-0.26, 0.26], d: [0.02, 0.9], z: [0, 0.1], m: 'wood' },                   // the frame
      { a: [-0.24, 0.24], d: [0.04, 0.88], z: [0.1, 0.17], m: 'white' },              // the mattress
      { a: [-0.2, 0.2], d: [0.05, 0.2], z: [0.17, 0.22], m: 'white' },                // the pillow, at the wall end
      { a: [-0.25, 0.25], d: [0.3, 0.88], z: [0.17, 0.19], m: 'plastic' },            // the blanket, pulled up
      { a: [-0.26, 0.26], d: [0.02, 0.05], z: [0.1, 0.34], m: 'wood' } ] },           // the headboard
    kidChair: { half: 0.1, boxes: [
      { a: [-0.1, 0.1], d: [0.05, 0.23], z: [0.12, 0.14], m: 'wood' }, { a: [-0.1, 0.1], d: [0.05, 0.07], z: [0.14, 0.3], m: 'wood' },
      { a: [-0.09, -0.07], d: [0.06, 0.08], z: [0, 0.12], m: 'wood' }, { a: [0.07, 0.09], d: [0.06, 0.08], z: [0, 0.12], m: 'wood' },
      { a: [-0.09, -0.07], d: [0.2, 0.22], z: [0, 0.12], m: 'wood' }, { a: [0.07, 0.09], d: [0.2, 0.22], z: [0, 0.12], m: 'wood' } ] },
    sideTable: { half: 0.1, boxes: [
      { a: [-0.1, 0.1], d: [-0.09, 0.09], z: [0.22, 0.24], m: 'wood' }, { a: [-0.015, 0.015], d: [-0.015, 0.015], z: [0, 0.22], m: 'steel' },
      { a: [-0.07, 0.07], d: [-0.07, 0.07], z: [0, 0.015], m: 'dark' } ] },
    // the memory rooms' card table, square in the middle of the floor, and his chair across it
    cardTable: { half: 0.2, boxes: [
      { a: [-0.2, 0.2], d: [-0.18, 0.18], z: [0.22, 0.245], m: 'wood' },
      { a: [-0.18, -0.16], d: [-0.16, -0.14], z: [0, 0.22], m: 'wood' }, { a: [0.16, 0.18], d: [-0.16, -0.14], z: [0, 0.22], m: 'wood' },
      { a: [-0.18, -0.16], d: [0.14, 0.16], z: [0, 0.22], m: 'wood' }, { a: [0.16, 0.18], d: [0.14, 0.16], z: [0, 0.22], m: 'wood' } ] },
    dadChair: { half: 0.12, boxes: [
      { a: [-0.12, 0.12], d: [0.02, 0.24], z: [0.17, 0.2], m: 'fabricDk' }, { a: [-0.12, 0.12], d: [0.0, 0.03], z: [0.2, 0.42], m: 'fabricDk' },
      { a: [-0.11, -0.09], d: [0.02, 0.04], z: [0, 0.17], m: 'steel' }, { a: [0.09, 0.11], d: [0.02, 0.04], z: [0, 0.17], m: 'steel' },
      { a: [-0.11, -0.09], d: [0.21, 0.23], z: [0, 0.17], m: 'steel' }, { a: [0.09, 0.11], d: [0.21, 0.23], z: [0, 0.17], m: 'steel' } ] },
    shelf: { wall: true, half: 0.3, boxes: [ { a: [-0.3, 0.3], d: [0.02, 0.2], z: [0, 0.34], m: 'wood', front: 'books' } ] },
    plant: { half: 0.14, boxes: [
      { a: [-0.1, 0.1], d: [0.05, 0.25], z: [0, 0.16], m: 'pot', top: 'dark' },
      { a: [-0.15, 0.15], d: [0.0, 0.3], z: [0.16, 0.44], m: 'leaves' },
      { a: [-0.09, 0.09], d: [0.06, 0.24], z: [0.44, 0.52], m: 'leaves' } ] },
    // his chair in the waiting room: a recliner, up on two carpeted steps (DAIS_H in all), its footrest out
    dais: { half: 0.48, boxes: [
      { a: [-0.48, 0.48], d: [-0.48, 0.48], z: [0, 0.065], m: 'wood', top: 'carpet' },   // wood risers, the treads carpeted
      { a: [-0.38, 0.38], d: [-0.38, 0.38], z: [0.065, 0.13], m: 'wood', top: 'carpet' } ] },
    recliner: { half: 0.2, boxes: [
      { a: [-0.13, 0.13], d: [-0.13, 0.13], z: [0, 0.1], m: 'leather' },              // the body
      { a: [-0.2, -0.13], d: [-0.15, 0.14], z: [0, 0.25], m: 'leather' },             // the big padded arms
      { a: [0.13, 0.2], d: [-0.15, 0.14], z: [0, 0.25], m: 'leather' },
      { a: [-0.13, 0.13], d: [-0.1, 0.14], z: [0.1, 0.18], m: 'leather' },            // the seat cushion
      { a: [-0.14, 0.14], d: [-0.17, -0.07], z: [0.1, 0.34], m: 'leather' },          // the back, leaning back
      { a: [-0.14, 0.14], d: [-0.21, -0.11], z: [0.34, 0.46], m: 'leather' },
      { a: [-0.012, 0.012], d: [0.14, 0.18], z: [0.07, 0.11], m: 'dark' },              // the footrest, out on its arm
      { a: [-0.12, 0.12], d: [0.17, 0.33], z: [0.1, 0.15], m: 'leather' } ] },
  };
  const DAIS_H = 0.13, SPOT_R = 0.75, SPOT_W = 0.95, CHAIR_DIM = 0.14;
  // the spotlights (his chair's): a pool of light, round and soft-edged, added to the tile light wherever it's looked up
  let spotLamps = [], chairDim = null;   // and the room it's in, held down to CHAIR_DIM around it
  function spotAt(x, y) {
    let w = 0;
    for (const s of spotLamps) { const d2 = ((x - s.x) * (x - s.x) + (y - s.y) * (y - s.y)) / (s.r * s.r); if (d2 < 1) w += s.w * (1 - d2) * (1 - d2); }
    return w;
  }
  const SETS = [['desk', 5], ['couch', 3], ['cabinet', 3], ['cooler', 2], ['plant', 3], ['boxes', 1], ['bin', 1], ['lamp', 2]];
  // a piece's boxes into the world: B is the point on the wall line behind it, (ux, uy) along the
  // wall, (fx, fy) out into the room; `shift` slides it along the wall into a corner
  function buildFurn(def, bx, by, ux, uy, fx, fy, shift) {
    const out = [], fcode = fx === 1 ? 'e' : fx === -1 ? 'w' : fy === 1 ? 's' : 'n';
    for (const b of def.boxes) {
      const pts = [];
      for (const a of b.a) for (const d of b.d) pts.push([bx + ux * (a + shift) + fx * d, by + uy * (a + shift) + fy * d]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      out.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: b.z[0], z1: b.z[1],
        m: TEX.furn.mats[b.m], top: b.top ? (TEX.furn.fronts[b.top] || TEX.furn.mats[b.top]) : TEX.furn.mats[b.m], topFit: !!b.topFit,
        front: b.front ? TEX.furn.fronts[b.front] : null, fcode, glow: b.m === 'shade' });
    }
    return out;
  }
  function placeFurniture() {
    furn = []; fboxes = []; furnAt = new Uint8Array(W * H);
    if (!T.furnish || S.furniture <= 0) return;
    const R = rng(SEED + 180001), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y);
    const busy = new Set(objs.map((o) => Math.floor(o.y) * W + Math.floor(o.x)));
    const faceUsed = (k, face) => decals.has(faceKey(k, face)) || switchFace.has(faceKey(k, face));
    const faceOf = (dx, dy) => dx === 1 ? 0 : dx === -1 ? 1 : dy === 1 ? 2 : 3;   // the wall at (x+dx, y+dy), seen from (x, y)
    const comp = new Int32Array(W * H).fill(-1), rooms = [];
    for (let k0 = 0; k0 < W * H; k0++) {
      if (!room[k0] || comp[k0] >= 0) continue;
      const tiles = [k0]; comp[k0] = rooms.length;
      for (let i = 0; i < tiles.length; i++) { const c = tiles[i], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (room[n] && comp[n] < 0 && !solid(x + dx, y + dy)) { comp[n] = rooms.length; tiles.push(n); } } }
      rooms.push(tiles);
    }
    // with these tiles taken, does every way into the room still reach every other?
    const connected = (tiles, blocked) => {
      const inR = new Set(tiles), mouths = [];
      for (const t of tiles) { const x = t % W, y = (t / W) | 0; for (const [dx, dy] of HD) { const n = t + dy * W + dx; if (!solid(x + dx, y + dy) && !inR.has(n)) mouths.push(t); } }
      const free = tiles.filter((t) => !blocked.has(t));
      if (!mouths.length || mouths.some((m) => blocked.has(m))) return !mouths.length;
      const seenT = new Set([mouths[0]]), q = [mouths[0]];
      while (q.length) { const c = q.pop(), x = c % W, y = (c / W) | 0; for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (inR.has(n) && !blocked.has(n) && !seenT.has(n)) { seenT.add(n); q.push(n); } } }
      return mouths.every((m) => seenT.has(m)) && free.every((t) => seenT.has(t));
    };
    const secret = secretSet();
    for (const tiles of rooms) {
      if (tiles.length < 6 || (secret && tiles.some((k) => secret.has(k))) || (storyAt && tiles.some((k) => storyAt[k] >= 0 && story[storyAt[k]].kind !== 'memory'))) continue;   // a memory room is furnished like any other
      const inR = new Set(tiles), gi = groupAt ? groupAt[tiles[0]] : -1;
      const nearMouth = (t) => { const x = t % W, y = (t / W) | 0;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { const n = yy * W + xx; if (!solid(xx, yy) && !inR.has(n)) return true; } return false; };
      const spots = [];   // { t, walls: [[dx, dy], …] } — tiles on the room's edge, and which sides are wall
      for (const t of tiles) {
        const x = t % W, y = (t / W) | 0;
        if (busy.has(t) || memClear.has(t) || nearMouth(t) || (Math.abs(x - sx0) < 2 && Math.abs(y - sy0) < 2) || (x === exit.x && y === exit.y)) continue;
        const walls = HD.filter(([dx, dy]) => solid(x + dx, y + dy) && !faceUsed((y + dy) * W + x + dx, faceOf(dx, dy)));
        if (walls.length) spots.push({ t, x, y, walls });
      }
      let n = Math.min(4, Math.round(tiles.length * S.furniture / 8)), blocked = new Set(), tries = 0;
      while (n > 0 && spots.length && tries++ < 30) {
        const sp = spots.splice(Math.floor(R() * spots.length), 1)[0];
        if (blocked.has(sp.t)) continue;
        const pool = (T.sets || SETS).filter(([name]) => (name !== 'lamp' || gi < 0) && (FURN[name].wall || sp.walls.length >= 2 || name === 'bin' || name === 'boxes'));
        let tot = 0; for (const [, w] of pool) tot += w;
        let r = R() * tot, name = pool[0][0]; for (const [nm, w] of pool) { if ((r -= w) < 0) { name = nm; break; } }
        const def = FURN[name], nb = new Set(blocked); nb.add(sp.t);
        if (!connected(tiles, nb)) continue;
        blocked = nb; n--;
        // backed onto a wall: one of its wall sides; in a corner, slid along into it
        const [wx, wy] = sp.walls[Math.floor(R() * sp.walls.length)], fx = -wx, fy = -wy;   // it faces out, into the room
        const ux = -fy, uy = fx, bx = sp.x + 0.5 + wx * 0.5, by = sp.y + 0.5 + wy * 0.5;
        const other = sp.walls.find(([ax, ay]) => ax !== wx || ay !== wy);
        const shift = other && !def.wall ? Math.sign(other[0] * ux + other[1] * uy) * (0.5 - def.half - 0.04) : 0;
        const boxes = buildFurn(def, bx, by, ux, uy, fx, fy, shift);
        const cx = bx + ux * shift + fx * 0.15, cy = by + uy * shift + fy * 0.15;
        furn.push({ x: cx, y: cy, fx, fy, name, def, boxes });
        for (const b of boxes) fboxes.push(b);
        furnAt[sp.t] = 1;
      }
    }
  }
  // a floor lamp's pool: small and warm, through open floor like the ceiling's
  function furnLight(base) {
    for (const f of furn) {
      if (!f.def.light) continue;
      const k = Math.floor(f.y) * W + Math.floor(f.x), seenL = new Map([[k, 0]]), q = [k];
      while (q.length) { const c = q.shift(), d = seenL.get(c), w = 0.55 * Math.pow(Math.max(0, 1 - d / 2.2), 1.4); if (w <= 0.005) continue; base[c] += w;
        const x = c % W, y = (c / W) | 0; for (const [dx, dy] of HD) { const nn = c + dy * W + dx; if (!solid(x + dx, y + dy) && !seenL.has(nn)) { seenL.set(nn, d + 1); q.push(nn); } } }
    }
  }
  function drawSwitch(g) {
    const d = decalFor(g.k, g.face), art = TEX.lightSwitch[g.on ? 1 : 0].px;
    for (let i = 0; i < DEC * DEC; i++) if (art[i]) d[i] = art[i];
  }
  // ── the being ─────────────────────────────────────────────
  // Joe: "We have a 'being' that comes at you and if it hits you it teleports [you] to a place in the
  // maze. It looks scary, but it actually teleports you onto the path out. It's helping you to get out.
  // So this being only shows up when you are off the path by a significant amount. This is where we can
  // use the closets. If you hide in a closet the being will run by a couple times then disappear." It is
  // the Caretaker of the old notes (docs/labyrinth): "Not a monster. A psychopomp … he redirects."
  //
  // Joe, after meeting it: "I think it spawned behind me and took me out. I never saw it. … Going off path
  // shouldn't be this negative. … It should not chase you at first, just spawn in front of you as far away as
  // it can so you can still see it. If you get within like three tiles it'll chase you. … There's a 10% chance
  // it'll spawn when you are more than 10 tiles away from the main path. … Doors should block it."
  //
  // So: dormant until the turn, and while you're within `beingOff` steps of the way out. Each time you go past
  // that (an excursion; it's rolled once, and again only after you've come back within it), `beingChance` that
  // it comes — not in the first BEING_GRACE of a maze, nor within BEING_GAP of the last time. First the signs:
  // the tubes round you stutter, a low swell, BEING_SIGNS long; get back to the way out and it never comes.
  // Then it's there at the far end of what you can see — the farthest tile down your line of sight, BEING_VIEW at most, or it'd be too small to make out — standing,
  // looking at you. It doesn't move. Come within BEING_NEAR of it and it comes for you, at 1.25× your walk,
  // round by the halls, never through a squeeze or a shut door. Out of your sight for BEING_LOST, it's gone.
  // It takes you only once you've seen it. If it reaches you: static, and you're standing on the way out, a
  // few steps further along it than where you left it, facing on. Get back to the way out yourself and it gives
  // up. Get in a closet and it runs up to the door and past it, and back, BEING_PASSES times where you can see
  // it through the slats, stops once to look in, and is gone.
  // Joe: "make move speed 1.25 the player's. Gives them time to run and find a closet." And "the being
  // shouldn't use squeeze throughs": it goes round by the halls, and where it can't get to you, it gives up
  // Joe: "let's get his speed to be the same as the players and see what that does" (it was 1.25×); then "The Being needs to
  // move about 20% slower"
  const BEING_PACE = 0.8, beingSpeed = () => S.walk * BEING_PACE;
  // Joe: "The being should only appear after the turn. The player should have to see the being at least once
  // before it resets you." So it stays dormant until `turned`, and each time it comes it can't take you until
  // enough of it has been on your screen (BEING_SEEN_PX drawn pixels, walls and doors hiding it); unseen, it
  // holds a little behind you, feet close, until you turn round, or gives up after BEING_HOLD.
  const BEING_GRACE = 40000, BEING_GAP = 90000, BEING_SIGNS = 2600, BEING_PASSES = 3, BEING_SEEN_PX = 60, BEING_HOLD = 12000, BEING_NEAR = 3, BEING_LOST = 15000, BEING_VIEW = 9, BEING_PEER = 1800, BEING_PEER_REACH = 12;
  let pathDist = null, pathNear = null, pathIdx = null, being = null, beingState = 'dormant', beingT = 0, offSince = 0, rolled = false, deadAt = -1, beingAim = null, beingNext = 0, beingForce = false, fieldAt = 0, field = null, stepT = 0;
  function beingIndex() {   // how far every tile is from the way out, and which tile of it is nearest
    pathDist = new Int32Array(W * H).fill(-1); pathNear = new Int32Array(W * H).fill(-1); pathIdx = new Map();
    being = null; beingState = 'dormant'; offSince = 0; beingNext = performance.now() + BEING_GRACE;
    if (floor > 1 || !solutionPath || !solutionPath.length) return;
    const q = [];
    solutionPath.forEach(([x, y], i) => { const k = y * W + x; if (pathDist[k] < 0) { pathDist[k] = 0; pathNear[k] = k; pathIdx.set(k, i); q.push(k); } });
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && pathDist[n] < 0) { pathDist[n] = pathDist[c] + 1; pathNear[n] = pathNear[c]; q.push(n); } } }
  }
  function distField(from) {   // steps from `from` to everywhere it can go: through an open door, never a shut one or a squeeze
    const d = new Int32Array(W * H).fill(-1), q = [from], shut = new Set(); d[from] = 0;
    for (const dr of doors) if (!dr.open || dr.t < 0.5) shut.add(dr.k);
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && !low[n] && !shut.has(n) && d[n] < 0) { d[n] = d[c] + 1; q.push(n); } } }
    return d;
  }
  const beingObj = (x, y) => ({ x, y, vx: 0, vy: 0, h: 0.97, glow: 0, ghost: true, back: true, alpha: 1, tex: TEX.sprites.being[0], walked: 0 });
  // the squeeze's mouths: open tiles it can stand on, next to the run of squeeze you're in. Arriving from (fx, fy),
  // or placed there outright (null) — at the mouth you're facing, if one's in view
  function startPeer(pk, fx, fy) {
    const seenQ = new Set([pk]), q = [pk], mouths = [];
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (solid(x + dx, y + dy) || seenQ.has(n)) continue; seenQ.add(n);
        if (low[n]) q.push(n); else mouths.push(n); } }
    if (!mouths.length) return false;
    const look = (k) => Math.cos(P.a) * (k % W + 0.5 - P.x) + Math.sin(P.a) * (((k / W) | 0) + 0.5 - P.y);
    let mouth = mouths[0];
    if (fx === null) { for (const m of mouths) if (look(m) > look(mouth)) mouth = m; }
    else { const f = distField(Math.floor(fy) * W + Math.floor(fx)); const ok = mouths.filter((m) => f[m] >= 0); if (!ok.length) return false;
      const score = (m) => (look(m) > 0 ? 0 : 1000) + f[m];   // one in front of you first, then the nearest to it
      mouth = ok.reduce((b, m) => score(m) < score(b) ? m : b, ok[0]);
      if (Math.min(...ok.map((m) => f[m])) > BEING_PEER_REACH) { beingGone(); return true; } }   // a long way round to look in: it just goes
    if (fx === null) being = beingObj(mouth % W + 0.5, ((mouth / W) | 0) + 0.5);
    being.mouth = mouth; being.peerUntil = fx === null ? performance.now() + BEING_PEER : 0; being.lastSeen = performance.now();
    beingState = 'peer'; fieldAt = 0; if (fx === null) FP_SOUND.beingSees();
    return true;
  }
  function beingGone() { being = null; beingState = 'dormant'; offSince = 0; beingAim = null; beingNext = performance.now() + BEING_GAP; }
  function moveToward(tx, ty, dt, speed) {
    const ex = tx - being.x, ey = ty - being.y, d = Math.hypot(ex, ey), st = speed * dt;
    if (d < 1e-4) return true;
    being.vx = ex / d; being.vy = ey / d;
    if (d <= st) { being.x = tx; being.y = ty; } else { being.x += being.vx * st; being.y += being.vy * st; }
    being.walked += Math.min(d, st); being.tex = TEX.sprites.being[Math.floor(being.walked / 0.45) & 1];
    stepT -= Math.min(d, st);
    if (stepT <= 0) { stepT = 0.55; FP_SOUND.beingStep(Math.max(0.1, 1 - Math.hypot(being.x - P.x, being.y - P.y) / 9)); }
    return d <= st;
  }
  function beingFrame(now, dt) {
    if (beingState === 'guide') { guideFrame(now); return; }
    if (beingState === 'done' || watchLeft) return;
    if (!S.being || !pathDist || floor > 1 || won || stairBusy || reading) return;
    const pk = Math.floor(P.y) * W + Math.floor(P.x), off = hidden ? 99 : pathDist[pk];
    if (beingState === 'dormant') {
      if (off <= S.beingOff) rolled = false;   // back near the way out: the next time you go off is a new roll
      else if (!rolled && !hidden) { rolled = true; if (turned && now > beingNext && Math.random() < S.beingChance) beingForce = true; }
      // Joe: "Let's have a 25% chance that the being will spawn at dead ends after you've hit the turn." Walk into
      // the end of a dead end and, `beingDead` of the time, it's back up the way you came when you turn round
      const x0 = Math.floor(P.x), y0 = Math.floor(P.y), open = HD.filter(([dx, dy]) => !solid(x0 + dx, y0 + dy));
      const isDead = open.length === 1 && !low[pk] && !inHeart(pk) && !(x0 === exit.x && y0 === exit.y) && pathDist[pk] > 0;
      if (!isDead) deadAt = -1;
      else if (deadAt !== pk && !hidden) {
        deadAt = pk;
        if (turned && now > beingNext && Math.random() < S.beingDead) { beingForce = true; beingAim = Math.atan2(open[0][1], open[0][0]); }
      }
      if (beingForce && !hidden) { beingForce = false; beingState = 'signs'; beingT = now; FP_SOUND.beingSigns(); }
      return;
    }
    if (beingState === 'signs') {
      if (!hidden && beingAim === null && pathDist[pk] <= 2) { beingGone(); return; }   // you turned back in time
      if (now - beingT < BEING_SIGNS) return;
      if (low[pk] && startPeer(pk, null, null)) return;   // it came while you were in a squeeze
      // there: the farthest tile down your line of sight that it could walk to you from — or, at a dead end, down
      // the only way out of it, behind you
      const d = distField(pk), fov = S.fov * Math.PI / 360 * 0.8, aim = beingAim === null ? P.a : beingAim; beingAim = null;
      let best = -1, bd = 0;
      for (let i = -10; i <= 10; i++) {
        const a = aim + fov * i / 10, cx = Math.cos(a), cy = Math.sin(a);
        let last = -1, ld = 0;
        for (let t = 0.3; t < BEING_VIEW; t += 0.12) {   // no further than it can be made out
          const x = P.x + cx * t, y = P.y + cy * t, k = Math.floor(y) * W + Math.floor(x);
          if (solid(Math.floor(x), Math.floor(y)) || low[k] || doors.some((dr) => dr.k === k && (!dr.open || dr.t < 0.5))) break;
          if (d[k] >= 0) { last = k; ld = t; }
        }
        if (last >= 0 && ld > bd + (Math.abs(i) < 3 ? -0.3 : 0.3)) { bd = ld; best = last; }   // straight ahead wins a near tie
      }
      if (best < 0 || bd < 1.5) { beingGone(); return; }
      being = beingObj(best % W + 0.5, ((best / W) | 0) + 0.5); being.lastSeen = now; beingState = 'watch'; fieldAt = 0; FP_SOUND.beingSees();
      return;
    }
    // you're in a squeeze: it comes to the mouth of it, the side you're facing if it can, looks in at you for
    // BEING_PEER, and goes. Joe: "If you're in a squeeze and the being spawns, it should look in the squeeze space
    // at you for a second or two and then go away."
    if (beingState === 'peer') {
      if (being.peerUntil) { if (now > being.peerUntil) beingGone(); return; }
      const mk = being.mouth, mx = mk % W + 0.5, my = ((mk / W) | 0) + 0.5;
      if (Math.hypot(being.x - mx, being.y - my) < 0.08) { being.peerUntil = now + BEING_PEER; FP_SOUND.beingSees(); return; }
      if (now > fieldAt) { field = distField(mk); fieldAt = now + 400; }
      const bk = Math.floor(being.y) * W + Math.floor(being.x);
      if (field[bk] < 0) { beingGone(); return; }
      const bx = bk % W, by = (bk / W) | 0; let nb = bk;
      for (const [dx, dy] of HD) { const n = bk + dy * W + dx; if (!solid(bx + dx, by + dy) && field[n] >= 0 && field[n] < field[nb]) nb = n; }
      moveToward(nb === bk ? mx : nb % W + 0.5, nb === bk ? my : ((nb / W) | 0) + 0.5, dt, beingSpeed());
      return;
    }
    if ((beingState === 'watch' || beingState === 'chase') && low[pk] && !hidden && startPeer(pk, being.x, being.y)) return;
    if (beingState === 'watch') {   // standing where you'll see it, looking at you
      if (hidden) { beingState = 'closet'; being.passes = 0; being.leg = 0; return; }
      if (pathDist[pk] <= 1) { beingGone(); return; }
      if (now - being.lastSeen > BEING_LOST) { beingGone(); return; }
      const bk = Math.floor(being.y) * W + Math.floor(being.x);
      if (now > fieldAt) { field = distField(pk); fieldAt = now + 250; }
      if (Math.hypot(P.x - being.x, P.y - being.y) < BEING_NEAR && field[bk] >= 0) { beingState = 'chase'; FP_SOUND.beingSees(); }
      return;
    }
    if (beingState === 'chase') {
      if (hidden) { beingState = 'closet'; being.passes = 0; being.leg = 0; return; }
      if (pathDist[pk] <= 1) { beingGone(); return; }   // back on the way out by yourself: it lets you be
      if (now - being.lastSeen > BEING_LOST) { beingGone(); return; }   // and if you got away from it, out of sight long enough
      if (now > fieldAt) { field = distField(pk); fieldAt = now + 250; }
      const bk = Math.floor(being.y) * W + Math.floor(being.x);
      if (field[bk] < 0) { if (!being.stuck) being.stuck = now; if (now - being.stuck > 6000) { beingGone(); return; } return; }   // you're past a squeeze: it waits, then goes
      being.stuck = 0;
      const gap = Math.hypot(P.x - being.x, P.y - being.y);
      if (!being.seen && gap < 1.6) { if (!being.hold) being.hold = now; if (now - being.hold > BEING_HOLD) beingGone(); return; }   // not until you've seen it
      being.hold = 0;
      if (bk === pk || Math.hypot(P.x - being.x, P.y - being.y) < 1.1) moveToward(P.x, P.y, dt, beingSpeed());
      else {
        const bx = bk % W, by = (bk / W) | 0; let nb = bk;
        for (const [dx, dy] of HD) { const n = bk + dy * W + dx; if (!solid(bx + dx, by + dy) && field[n] >= 0 && field[n] < field[nb]) nb = n; }
        moveToward(nb % W + 0.5, ((nb / W) | 0) + 0.5, dt, beingSpeed());
      }
      if (Math.hypot(P.x - being.x, P.y - being.y) < 0.45) beingTakes(pk);
      return;
    }
    if (beingState === 'closet') {
      if (!hidden) { beingState = 'chase'; return; }
      // up to the door of the closet you're in, and past it, and back
      // its run is across the hall a little out from the door, far enough that the slats show all of it
      const c = hidden.c, qx = -c.dy, qy = c.dx, ox = c.x + 0.5 + c.dx * 0.3, oy = c.y + 0.5 + c.dy * 0.3;
      let pts = [[ox + qx * 1.2, oy + qy * 1.2], [ox - qx * 1.2, oy - qy * 1.2]].filter(([x, y]) => !solid(Math.floor(x), Math.floor(y)));
      if (pts.length < 2) pts = [[c.x + 0.5 + c.dx * 1.4, c.y + 0.5 + c.dy * 1.4], [ox, oy]];
      if (being.leg === 0) {   // getting there: by the halls, to the nearer end of its run
        const ck = c.y * W + c.x;
        if (now > fieldAt) { field = distField(ck); fieldAt = now + 250; }
        const bk = Math.floor(being.y) * W + Math.floor(being.x);
        if (Math.hypot(being.x - (c.x + 0.5), being.y - (c.y + 0.5)) < 1.6) { being.leg = 1; return; }
        const bx = bk % W, by = (bk / W) | 0; let nb = bk;
        for (const [dx, dy] of HD) { const n = bk + dy * W + dx; if (!solid(bx + dx, by + dy) && field[n] >= 0 && field[n] < field[nb]) nb = n; }
        moveToward(nb % W + 0.5, ((nb / W) | 0) + 0.5, dt, beingSpeed());
        return;
      }
      // on its second pass it stops, square in front of the slats, and looks in; then goes on
      if (being.stare) { if (now < being.stare) return; being.stare = 0; being.stared = true; }
      if (being.passes === 2 && !being.stared && Math.hypot(being.x - ox, being.y - oy) < 0.12) { being.stare = now + 1400; FP_SOUND.beingSees(); return; }
      const [tx, ty] = pts[being.leg & 1];
      if (moveToward(tx, ty, dt, beingSpeed() * 1.2)) { being.leg++; being.passes++; if (being.passes > BEING_PASSES) beingGone(); }
    }
  }
  // it has you: static, and you're on the way out, a little further along than you left it, facing on
  function beingTakes(pk) {
    FP_SOUND.beingTakes(); stairBusy = true; clearStick();
    const fade = $('fade'); $('fadeText').textContent = ''; fade.classList.add('white', 'show');
    setTimeout(() => {
      const near = pathNear[pk], i0 = near >= 0 ? pathIdx.get(near) : 0, i = Math.min(solutionPath.length - 2, (i0 || 0) + 3);
      const [x, y] = solutionPath[Math.max(0, i)], [nx, ny] = solutionPath[Math.min(solutionPath.length - 1, i + 1)];
      P.x = x + 0.5; P.y = y + 0.5; P.a = Math.atan2(ny - y, nx - x); lastX = P.x; lastY = P.y; vel = 0; lastTile = ''; arrive();
      beingGone();
      setTimeout(() => { fade.classList.remove('show'); setTimeout(() => fade.classList.remove('white'), 300); stairBusy = false; }, 350);
    }, 420);
  }

  // ── the turn ──────────────────────────────────────────────
  // Joe: "We would need to establish a base first of what it feels like to go through. Maybe the lights
  // more on, not really any dark places. But then you find a few of the special rooms or collect some of
  // the journals. Then we switch the experience. You walk into rooms and the lights go out. In the dark
  // you can now see the text of 'You shouldn't be here!' … You go into a hallway and see all the lights
  // go out in front of you."
  //
  // So a maze starts calm (`calm`: none of this view's dark halls, switched rooms lit). Every page read
  // and every story room walked into is a find; at `turnAfter` finds the building turns — every tube
  // stutters at once, something big goes off far away, and the music drops to 'The Turn'. From then on
  // a room you walk into goes out around you, a stutter and then dark, and on its walls, in paint that
  // shows only in the dark, TURN_LINES. And now and then (`turnHalls`) the lamps of a hall you step into
  // go out one after another from the far end toward you, with a word glowing on the wall at its end.
  // The kid's room is left alone; everything else is fair. It lasts the run, stairs included.
  let turned = false, finds = 0, turnAt = -1e9, roomsOut = null, killQ = [], lampsOut = new Set(), hallNext = 0, lastRoomComp = -1, roomOf = null, roomList = [], roomsSpared = new Set();
  const GLOW = [(TEX.hex('#bfe8b4') & 0xffffff) | 0xfe000000, (TEX.hex('#9fd49a') & 0xffffff) | 0xfe000000];
  function turnIndex() {   // the rooms of this maze, for the lights to go out in
    roomOf = new Int32Array(W * H).fill(-1); roomList = []; roomsOut = new Set(); roomsSpared = new Set(); killQ = []; lampsOut = new Set(); lastRoomComp = -1;
    turnFaces = new Set(); heartDark = 0; darkMul = 1; lifted = false;
    for (let k0 = 0; k0 < W * H; k0++) {
      if (!room[k0] || roomOf[k0] >= 0) continue;
      const tiles = [k0]; roomOf[k0] = roomList.length;
      for (let i = 0; i < tiles.length; i++) { const c = tiles[i], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (room[n] && roomOf[n] < 0 && !solid(x + dx, y + dy)) { roomOf[n] = roomList.length; tiles.push(n); } } }
      roomList.push(tiles);
    }
  }
  function addFind() {
    finds++;
    if (!turned && S.turnAfter > 0 && finds >= S.turnAfter) turnNow();
  }
  function turnNow() { turned = true; turnAt = performance.now(); FP_SOUND.turn(); FP_SOUND.setMusic(track()); }
  // ── the heart's dark, and the lights coming back ──────────
  // Joe: "When the heartbeat shows up we need to drop the lights down low and get them to slowly pulse with the heart beat …
  // Or maybe this is when we force the 'turn' as well. So you are following the red pulse while the walls are screaming at you
  // to leave." From the moment you open the heart (`heartDark`), every light outside it comes down over HEART_DARK_IN to
  // HEART_DARK_LO of itself and swells toward HEART_DARK_HI on each beat, slowly (heartSwell); the turn comes now if it hadn't, and
  // until you've left the watch every room you walk into goes out and writes at you.
  // Then: "Once we put the watch where it goes we should bring all the lights back up and replace out all the text in the wall
  // with things that talk about moving on and putting things down and not having to carry what isn't yours and maybe some thank
  // yous", and "We should totally not have the dark walls with green text as you are approaching the ending." Leave the watch
  // (`lightsUp`) and the dark lifts, every lamp and room comes back on, the turn stops, and every face the game wrote words
  // on — the dead ends, the opening walls, the wall's lies, the turn's green — is washed and written again in chalk with a
  // line from FP_ENDING `after`.
  const HEART_DARK_IN = 2500, HEART_DARK_LO = 0.3, HEART_DARK_HI = 0.6;
  let heartDark = 0, darkMul = 1, lifted = false, turnFaces = new Set();
  function lightsUp() {
    heartDark = 0; darkMul = 1; lifted = true; killQ = []; lampsOut = new Set(); chairDim = null;
    FP_SOUND.setMusic(track());
    if (dark) dark.fill(0);
    for (const g of lightGroups) if (!g.on) { g.on = true; g.at = performance.now(); drawSwitch(g); }
    const E = endingText(), lines = (E && E.after) || [];
    if (!lines.length) return;
    const R = rng(SEED + 250007), faces = new Map();
    for (const w of wordSpots) faces.set(faceKey(w.k, w.face), w);
    for (const fk of turnFaces) faces.set(fk, null);
    for (const q of story) if (q.lieFaces) for (const fk of q.lieFaces) faces.set(fk, null);
    let i = Math.floor(R() * lines.length);
    for (const fk of faces.keys()) {
      const d = decalFor(Math.floor(fk / 4), fk % 4); d.fill(0);
      writeWords(d, lines[i++ % lines.length], R, true, false);
    }
  }
  // glowing words on a wall face, big and scrawled, where it can find room
  function glowWrite(k, face, text, R) {
    turnFaces.add(faceKey(k, face));
    const d = decalFor(k, face), col = GLOW[Math.floor(R() * GLOW.length)];
    // short words big, longer lines a size down and wrapped, the whole thing centred-ish on the wall
    const sc = text.length <= 6 ? 3 : 2, w = Math.min(64, text.length * 4 * sc);
    const lines = Math.ceil(text.length * 4 * sc / 62), y0 = Math.max(4, Math.round(28 - lines * (6 * sc + 1) / 2) + (R() * 8 | 0) - 4);
    const tmp = new Uint32Array(DEC * DEC); hand(tmp, text, Math.max(1, Math.round((64 - w) / 2)), y0, 62, sc, col, R);
    for (let i = 0; i < DEC * DEC; i++) if (tmp[i]) { d[i] = tmp[i]; if (sc === 2 && i + 1 < DEC * DEC && (i + 1) % DEC && !tmp[i + 1]) d[i + 1] = col; }   // a thick hand
  }
  function killLamp(k, at) { killQ.push({ at, k }); }
  function roomOut(ri, now) {
    roomsOut.add(ri);
    const tiles = roomList[ri], set = new Set(tiles), R = rng(SEED + 220001 + ri * 31);
    for (const k of tiles) { if (lampTiles.includes(k)) killLamp(k, now + 220 + R() * 260); }
    killQ.push({ at: now + 520, tiles });
    // the words: on a few of its walls
    const faces = [];
    for (const k of tiles) { const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of HD) { const nx = x + dx, ny = y + dy, n = ny * W + nx; if (solid(nx, ny) && !exitFace[n] && !switchFace.has(faceKey(n, faceTo(dx, dy)))) faces.push([n, faceTo(dx, dy)]); } }
    const lines = TURN_LINES[character.name].rooms, n = Math.min(faces.length, 3 + Math.floor(tiles.length / 3));
    for (let i = 0; i < n; i++) { const [fk, f] = faces.splice(Math.floor(R() * faces.length), 1)[0]; glowWrite(fk, f, lines[Math.floor(R() * lines.length)], R); }
    FP_SOUND.flicker(1);
  }
  function hallOut(now) {
    // straight ahead from here, the lamps of this hall, farthest first
    const h = headingOf(P.a), [dx, dy] = HD[h], tx = Math.floor(P.x), ty = Math.floor(P.y), run = [];
    let n = 1; while (n < 8 && !solid(tx + dx * n, ty + dy * n) && !room[(ty + dy * n) * W + tx + dx * n]) { run.push((ty + dy * n) * W + tx + dx * n); n++; }
    const lamps = run.filter((k) => lampTiles.includes(k) && !lampsOut.has(k));
    if (lamps.length < 2) return false;
    lamps.reverse().forEach((k, i) => { killLamp(k, now + i * 380); killQ.push({ at: now + i * 380 + 60, tiles: run.filter((t) => Math.abs(t % W - k % W) + Math.abs(((t / W) | 0) - ((k / W) | 0)) <= 1) }); });
    const ex = tx + dx * n, ey = ty + dy * n;
    if (solid(ex, ey) && character && TURN_LINES[character.name]) { const R = rng(SEED + now | 0), L = TURN_LINES[character.name].hall; glowWrite(ey * W + ex, faceTo(dx, dy), L[Math.floor(R() * L.length)], R); }
    return true;
  }
  function turnFrame(now, px, py) {
    // a steady lamp starts each frame at full; only what follows takes it down, for this frame
    const flickSet = new Set(flickers);
    for (const k of lampTiles) if (!flickSet.has(k)) lampLvl[k] = (groupAt && groupAt.length === W * H && groupAt[k] >= 0) ? lampLvl[k] : 1;
    // the being's signs: the tubes round you stutter
    if (beingState === 'signs') for (const k of lampTiles) { const d = Math.hypot(k % W + 0.5 - px, ((k / W) | 0) + 0.5 - py); if (d < 5 && Math.random() < 0.3) lampLvl[k] *= 0.15; }
    // the moment of the turn: every tube in the place stutters for a second and a bit
    if (now - turnAt < 1300) for (const k of lampTiles) lampLvl[k] *= Math.random() < 0.35 ? 0.1 : 1;
    for (let i = killQ.length - 1; i >= 0; i--) {
      const q = killQ[i]; if (now < q.at) { if (q.k !== undefined && now > q.at - 200) lampLvl[q.k] *= Math.random() < 0.5 ? 0.2 : 1; continue; }
      if (q.k !== undefined) { lampsOut.add(q.k); const d = Math.hypot(q.k % W + 0.5 - px, ((q.k / W) | 0) + 0.5 - py); FP_SOUND.lightOut(Math.max(0.15, 1 - d / 8)); }
      if (q.tiles) for (const t of q.tiles) dark[t] = 1;
      killQ.splice(i, 1);
    }
    for (const k of lampsOut) lampLvl[k] = 0;
    if (heart && heart.lamp >= 0) lampLvl[heart.lamp] = 0.35 + 0.65 * heartPulse(now);   // its one lamp beats, whatever the building is doing
    darkMul = heartDark ? 1 - Math.min(1, (now - heartDark) / HEART_DARK_IN) * (1 - (HEART_DARK_LO + (HEART_DARK_HI - HEART_DARK_LO) * heartSwell(now))) : 1;
  }
  // every frame, after the turn: a room you've just walked into, a hall you've just stepped into
  function turnWatch(now) {
    if (!turned || lifted || !roomOf || hidden || !character || !TURN_LINES[character.name]) return;
    const k = Math.floor(P.y) * W + Math.floor(P.x), ri = roomOf[k], secret = secretSet();
    if (ri !== lastRoomComp) {
      lastRoomComp = ri;
      // each room is decided once, the first time you walk in after the turn: `turnRooms` of them go dark.
      // Joe: "there should be 50% chance that rooms go dark. Right now it's 100% and that feels a little much."
      if (ri >= 0 && !roomsOut.has(ri) && !roomsSpared.has(ri) && !(secret && secret.has(k)) && !inHeart(k) && !(storyAt && storyAt[k] >= 0) && now - turnAt > 1500) {
        if (heartDark || Math.random() < S.turnRooms) roomOut(ri, now); else roomsSpared.add(ri);   // while the heart's dark, every one
      }
    }
    if (ri < 0 && now > hallNext && vel > 0.05 && Math.random() < 0.02) {   // checked now and then while walking a hall
      hallNext = now + 4000;
      if (Math.random() < S.turnHalls && hallOut(now)) hallNext = now + 25000;
    }
  }

  // ── story rooms ───────────────────────────────────────────
  // Joe: "I think we need to start bringing in story rooms … these rooms should have an excessive
  // amount of writing on the walls. Written by the child, he is not processing the trauma. He is
  // ignoring it. He's building a wall around his heart in order to deal with the pain. You need to
  // imagine what that would look like … what these rooms would have in them, the lighting, the
  // texturing, the music when you enter them." The words are STORY_ROOMS in data/text.js. Two rooms
  // of a Child maze's floor 1, `storyRooms` of them, on their own random stream:
  //   the waiting room — the young one, sure he's coming. Every wall written over, low, in pencil and
  //     crayon, sizes all over, lines crossed out and written again underneath, tallies from counting
  //     to a hundred again, a clock drawn stopped at five past, WAIT HERE up high. The ceiling lights
  //     are dead; one floor lamp by a single chair in the middle of the room, turned to face the way
  //     in, a packed bag beside it and a note on the seat. The music is his own tune, winding down.
  //   the wall — older, and it's working. The walls painted over a cold white and written floor to
  //     ceiling in one tight even hand, "im fine | it doesnt matter | i dont care", in staggered rows
  //     that lay like brickwork. One place the paint has come away and the old wallpaper shows, and
  //     under it, the kid's pencil: come back. Every light on, steady, the hum loud; almost no music.
  //     In the middle, a ring of stacked boxes built around a shoebox, and on it the watch he left —
  //     you can't get in, but you can see it over the top and reach it.
  // Nothing else goes in them: no furniture, no random switch.
  let story = [], storyAt = null, storyMusic = null, storyHere = -1;
  const PENCIL = TEX.hex('#3b3a36'), INK_BLUE = TEX.hex('#262a36'), CRAYON = ['#b5473b', '#3f6aa6', '#3f8a4e', '#c28a2a', '#7a4a93'].map((c) => TEX.hex(c));
  // a hand: `text` flowed into a box from (x0, y0), `sc` pixels to a stroke, wobbling as a child's
  // does unless `neat`. Returns where it stopped: { y: the next line, x1: the far end of the last }
  function hand(d, text, x0, y0, maxW, sc, col, R, neat) {
    const lh = 6 * sc + 1, adv = 4 * sc, slope = neat ? 0 : (R() - 0.5) * 0.12;
    let x = x0, y = y0, x1 = x0;
    for (const w of text.toLowerCase().split(' ')) {
      if (x + w.length * adv > x0 + maxW && x > x0) { x = x0; y += lh; }
      for (let c = 0; c < w.length; c++) {
        const g = FONT[w[c]]; if (!g) continue;
        const jy = neat ? 0 : Math.round((R() - 0.5) * 1.2 + slope * (x - x0));
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '#')
          for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
            const X = x + c * adv + q * sc + xx, Y = y + jy + r * sc + yy;
            if (X >= 0 && X < DEC && Y >= 0 && Y < DEC && R() > (neat ? 0.02 : 0.07)) d[Y * DEC + X] = col;
          }
      }
      x += (w.length + 1) * adv; x1 = Math.max(x1, x - adv);
    }
    return { y: y + lh, x1 };
  }
  const strike = (d, x0, x1, y, col, R) => { for (let x = x0; x < x1; x++) { const Y = Math.round(y + (R() - 0.5) * 1.4); if (Y >= 0 && Y < DEC && x >= 0 && x < DEC) d[Y * DEC + x] = col; } };
  function fillWaiting(d, R, W8, big, clock) {
    let y = 3;
    if (big) { for (const b of W8.big) { const r = hand(d, b, 3, y, 58, 2, PENCIL, R); y = r.y + 1; } }
    if (clock) {   // stopped at five past
      const cx = 32, cy = 11, rr = 7; for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, X = Math.round(cx + Math.cos(a) * rr), Y = Math.round(cy + Math.sin(a) * rr); d[Y * DEC + X] = PENCIL; }
      for (let t = 0; t < 5; t++) d[(cy - t) * DEC + cx] = PENCIL;                 // the long hand, on the twelve
      for (let t = 0; t < 4; t++) d[(cy - Math.round(t * 0.85)) * DEC + cx + Math.round(t * 0.5)] = PENCIL;   // the short, just past it
      y = Math.max(y, 21);
    }
    while (y < 58) {
      if (y < 20 && R() < 0.45) { y += 4; continue; }   // up high is sparser: a small child can't reach
      if (R() < 0.09) {   // tallies: counting, and counting again
        let x = 2 + (R() * 8 | 0); const n = 2 + (R() * 4 | 0);
        for (let gI = 0; gI < n && x < 56; gI++, x += 7) { for (let i = 0; i < 4; i++) for (let t = 0; t < 5; t++) if (y + t < DEC) d[(y + t) * DEC + x + i] = PENCIL; for (let t = 0; t < 5; t++) { const X = x - 1 + Math.round(t * 1.3); if (y + 4 - t >= 0 && X < DEC) d[(y + 4 - t) * DEC + X] = PENCIL; } }
        y += 7; continue;
      }
      const text = W8.walls[Math.floor(R() * W8.walls.length)], sc = R() < 0.14 ? 2 : 1;
      const col = R() < 0.72 ? PENCIL : CRAYON[Math.floor(R() * CRAYON.length)], x0 = 1 + (R() * 9 | 0);
      const r = hand(d, text, x0, y, 62 - x0, sc, col, R);
      if (R() < 0.13 && r.y - y <= 6 * sc + 1) {   // crossed out, and written again underneath: the same thing, told again
        strike(d, x0 - 1, r.x1 + 1, y + 2.5 * sc, col, R);
        const r2 = hand(d, text, x0 + 2, r.y, 60 - x0, sc, col, R); y = r2.y + (R() * 2 | 0);
      } else y = r.y + (R() * 2 | 0);
    }
  }
  function fillWall(d, R, B, crack) {
    const paint = [TEX.hex('#cfcbc0'), TEX.hex('#c7c3b8'), TEX.hex('#d6d2c7')];
    for (let y = 0; y < DEC; y++) for (let x = 0; x < DEC; x++) d[y * DEC + x] = paint[((x * 7 + (y >> 3) * 3) % 11 === 0) ? 1 : (R() < 0.04 ? 2 : 0)];
    const mortar = TEX.hex('#b9b5aa');
    for (let r = 0; r < 10; r++) {
      const y = 1 + r * 6; let row = '';
      while (row.length < 24) row += (row ? ' | ' : '') + B.bricks[Math.floor(R() * B.bricks.length)];
      hand(d, row, (r & 1 ? -8 : -1) - (R() * 3 | 0), y, 200, 1, INK_BLUE, R, true);
      if (y + 5 < DEC) for (let x = 0; x < DEC; x++) if (d[(y + 5) * DEC + x] === paint[0]) d[(y + 5) * DEC + x] = mortar;
    }
    if (!crack) return;
    // where the paint has come away: the wallpaper under it, and the old pencil
    const cx = 30 + (R() * 6 | 0), cy = 38, rad = 11;
    for (let y = cy - rad - 2; y <= cy + rad + 2; y++) for (let x = cx - rad - 2; x <= cx + rad + 2; x++) {
      const a = Math.atan2(y - cy, x - cx), rr = rad * (0.75 + 0.25 * Math.sin(a * 5 + 1.3) + 0.1 * Math.sin(a * 11));
      if (Math.hypot(x - cx, (y - cy) * 1.1) < rr && x >= 0 && x < DEC && y >= 0 && y < DEC) d[y * DEC + x] = 0;
    }
    let x = cx, cr = TEX.hex('#5a564c'); for (let y = cy - rad; y > 0; y--) { x += R() < 0.3 ? (R() < 0.5 ? -1 : 1) : 0; d[y * DEC + x] = cr; }
    x = cx + 2; for (let y = cy + rad; y < DEC; y++) { x += R() < 0.3 ? (R() < 0.5 ? -1 : 1) : 0; d[y * DEC + x] = cr; }
    const [w1, w2] = B.crack.split(' ');
    hand(d, w1, cx - w1.length * 2, cy - 6, 30, 1, PENCIL, R);
    if (w2) hand(d, w2, cx - w2.length * 2, cy + 1, 30, 1, PENCIL, R);
  }
  function placeStory(reserved) {
    story = []; storyAt = new Int8Array(W * H).fill(-1); storyMusic = null; storyHere = -1;
    dressHeart(reserved);
    const S8 = floor === 1 && typeof STORY_ROOMS !== 'undefined' && character ? STORY_ROOMS[character.name] : null;
    if (!S8 || S.storyRooms <= 0) return;
    const R = rng(SEED + 210011), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y), secret = secretSet();
    const comp = new Int32Array(W * H).fill(-1), rooms = [];
    for (let k0 = 0; k0 < W * H; k0++) {
      if (!room[k0] || comp[k0] >= 0) continue;
      const tiles = [k0]; comp[k0] = rooms.length;
      for (let i = 0; i < tiles.length; i++) { const c = tiles[i], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (room[n] && comp[n] < 0 && !solid(x + dx, y + dy)) { comp[n] = rooms.length; tiles.push(n); } } }
      rooms.push(tiles);
    }
    const cands = rooms.filter((t) => t.length >= 9 && !t.some((k) => (Math.abs(k % W - sx0) < 3 && Math.abs(((k / W) | 0) - sy0) < 3) || (secret && secret.has(k)) || inHeart(k) || (k % W === exit.x && ((k / W) | 0) === exit.y)));
    const kinds = ['waiting', 'wall'].filter((k) => S8[k]).slice(0, Math.round(S.storyRooms));
    for (const kind of kinds) {
      if (!cands.length) break;
      const tiles = cands.splice(Math.floor(R() * cands.length), 1)[0], set = new Set(tiles), si = story.length;
      const mouths = [], faces = [];
      for (const r of tiles) { const x = r % W, y = (r / W) | 0;
        for (const [dx, dy] of HD) { const nx = x + dx, ny = y + dy, n = ny * W + nx;
          if (!solid(nx, ny) && !set.has(n)) mouths.push({ mx: nx, my: ny, rx: x, ry: y, dx, dy });
          else if (solid(nx, ny) && !exitFace[n] && !reserved.has(faceKey(n, faceTo(dx, dy)))) faces.push({ k: n, face: faceTo(dx, dy), vx: x, vy: y, dx, dy }); } }
      if (!mouths.length) continue;
      for (const k of tiles) storyAt[k] = si;
      const m = mouths[0];
      // the wall you face coming in, and the ones beside the way in
      let n = 0; while (set.has((m.ry - m.dy * n) * W + m.rx - m.dx * n)) n++;
      const facingK = (m.ry - m.dy * n) * W + m.rx - m.dx * n, facingF = faceTo(-m.dx, -m.dy);
      const beside = faces.filter((f) => f.face === faceTo(m.dx, m.dy) && Math.abs(f.vx - m.rx) + Math.abs(f.vy - m.ry) === 1);   // the wall the way in is in, either side of it
      const W8 = S8[kind];
      // Joe: "the room with the chair doesn't need the words on the walls. It needs to be its own thing that just sits there
      // in the center." Its walls are left bare (and kept from closets and switches); only the wall is written on
      faces.forEach((f, i) => {
        if (kind === 'wall') { const d = decalFor(f.k, f.face); d.fill(0); fillWall(d, R, W8, f.k === facingK && f.face === facingF); }
        reserved.add(faceKey(f.k, f.face));
      });
      void beside; void fillWaiting;
      // the light: dead ceiling for the waiting room, every panel on for the wall
      if (T.ceils) {
        const glowVar = T.ceils.findIndex((c) => c.glow), plain = T.ceils.findIndex((c) => !c.glow);
        for (const k of tiles) ceilVar[k] = kind === 'wall' ? glowVar : plain;
        if (kind === 'wall') flickers = flickers.filter((k) => !set.has(k));
      }
      // the one room of lies is the wall now. Joe: "We should not make anything else required to complete the maze beyond crossing
      // out the lies in the one room that has all the writing on the walls, collecting the watch from the heart room, and put it
      // in on this table next to the La-Z-Boy chair. Everything else is incidental."
      const lieFaces = kind === 'wall' ? new Set(faces.map((f) => faceKey(f.k, f.face))) : null, struck = new Set([...liesStruck].filter((fk) => lieFaces && lieFaces.has(fk)));
      const st = { kind, tiles, set, m, music: kind === 'waiting' ? 'The Waiting Room' : 'The Wall', text: W8, lieFaces, struck, need: lieFaces ? (S.liesToUndo > 0 ? Math.min(lieFaces.size, Math.round(S.liesToUndo)) : lieFaces.size) : 0 };
      st.undone = !!lieFaces && st.struck.size >= st.need; if (st.undone) st.music = null;
      story.push(st);
    }
  }
  // what's in them: made after the furniture, which clears its boxes each maze
  function storyProps() {
    spotLamps = []; chairDim = null;
    for (const st of story) {
      if (st.kind === 'memory') continue;   // dressed by memoryProps (it'd fall through to the wall's boxes and watch here)
      const m = st.m, ix = m.rx - m.mx, iy = m.ry - m.my;   // into the room
      if (st.kind === 'heart') {
        // the watch, centre stage, on a little plush step under the lamp; the letter (a page, placed with the others) off to one side
        const mx = heart.mid % W + 0.5, my = ((heart.mid / W) | 0) + 0.5, plush = TEX.heart.ceil;   // the heart's own buttoned red
        fboxes.push({ x0: mx - 0.12, x1: mx + 0.12, y0: my - 0.12, y1: my + 0.12, z0: 0, z1: 0.14, m: plush, top: TEX.heart.floors[0], topFit: false, front: null, fcode: 'n', glow: false });
        objs.push({ x: mx, y: my, z: 0.14, kind: 'watch', text: st.text.watch || st.text.letter, tex: TEX.sprites.watch, h: 0.1, glow: 0.7 });
        if (!placedPages()) objs.push({ x: (heart.far % W) + 0.5, y: ((heart.far / W) | 0) + 0.5, kind: 'note', text: st.text.letter, tex: TEX.sprites.book, h: 0.3, glow: 0.35 });   // Joe: "It should look like a regular journal"
        continue;
      }
      if (st.kind === 'waiting') {
        // Joe: "make the chair the Dad sat on every night more grandiose. Make it more of a La-Z-Boy recliner. Having it up on a
        // couple steps like a dias. Have a spotlight shining down on it. And have the table next to it for the watch." In the
        // middle of the room — the tile nearest it with floor all round, diagonals too, so the dais never cuts the room in two —
        // facing the way in; where there's no such tile, a tile and a half in from the door as before
        const ring = (k) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => st.set.has(k + dy * W + dx)));
        const tl = st.tiles.filter(ring), mx = st.tiles.reduce((a, k) => a + k % W, 0) / st.tiles.length, my = st.tiles.reduce((a, k) => a + ((k / W) | 0), 0) / st.tiles.length;
        let cx, cy, fx, fy;
        if (tl.length) {
          const c = tl.reduce((q, k) => Math.hypot(k % W - mx, ((k / W) | 0) - my) < Math.hypot(q % W - mx, ((q / W) | 0) - my) ? k : q, tl[0]);
          cx = c % W + 0.5; cy = ((c / W) | 0) + 0.5;
          const tx = m.rx + 0.5 - cx, ty = m.ry + 0.5 - cy;
          fx = Math.abs(tx) >= Math.abs(ty) ? Math.sign(tx) || 1 : 0; fy = fx ? 0 : Math.sign(ty) || 1;
        } else {
          cx = m.rx + 0.5 + ix * 1.5; cy = m.ry + 0.5 + iy * 1.5; fx = -ix; fy = -iy;
          if (!st.set.has(Math.floor(cy) * W + Math.floor(cx))) { const c = st.tiles[st.tiles.length >> 1]; cx = c % W + 0.5; cy = ((c / W) | 0) + 0.5; }
        }
        const ux = -fy, uy = fx, up = tl.length ? DAIS_H : 0;
        const lift = (bs) => bs.map((q) => ({ ...q, z0: q.z0 + up, z1: q.z1 + up }));
        if (up) for (const b of buildFurn(FURN.dais, cx, cy, ux, uy, fx, fy, 0)) fboxes.push({ ...b, step: true });   // Joe: "I should be able to walk up the few steps in the chair room"
        for (const b of lift(buildFurn(FURN.recliner, cx, cy, ux, uy, fx, fy, -0.06))) fboxes.push(b);
        // the bag, packed, at the foot of the steps
        for (const b of buildFurn({ boxes: [{ a: [-0.07, 0.07], d: [0.53, 0.66], z: [0, 0.14], m: 'bag', top: 'bag' }] }, cx, cy, ux, uy, fx, fy, -0.3)) fboxes.push(b);
        st.chair = { x: cx, y: cy, fx, fy };   // its note is folded into the watch's now
        // the spotlight: a can in the ceiling straight over it, and a pool of light on the chair and the steps (spotAt), the rest
        // of the room left as dim as its dead ceiling makes it
        fboxes.push(...buildFurn({ boxes: [{ a: [-0.07, 0.07], d: [-0.07, 0.07], z: [0.965, 1], m: 'spot' }] }, cx, cy, ux, uy, fx, fy, 0));
        spotLamps.push({ x: cx, y: cy, r: SPOT_R, w: SPOT_W });
        chairDim = new Uint8Array(W * H); for (const k of st.tiles) chairDim[k] = 1;
        // the little table on the dais beside it, and on it the ring in the dust where his watch sat — the slot. Joe: "a 'slot'
        // where the watch is supposed to go that you can interact with before you have the watch." It's where the watch goes back
        const tx = cx + ux * 0.28, ty = cy + uy * 0.28;
        for (const b of lift(buildFurn(FURN.sideTable, tx, ty, ux, uy, fx, fy, 0))) fboxes.push(b);
        objs.push({ x: tx, y: ty, z: 0.24 + up, kind: 'slot', tex: TEX.sprites.watchRing, h: 0.05, glow: 0.3 });
        st.slot = { x: tx, y: ty, z: 0.24 + up };
      }   // the wall has nothing in it but its writing: the watch is the heart's now
    }
  }
  function storyFrame() {
    const si = storyAt ? storyAt[Math.floor(P.y) * W + Math.floor(P.x)] : -1;
    if (si === storyHere) return;
    // walking into a story room is noted, but it isn't a find: the turn is pages only. Joe: "We should really make
    // sure the turn happens at 3 journals, not 2" — a room walked into used to count as one
    if (si >= 0 && !story[si].found) story[si].found = true;
    storyHere = si; storyMusic = si >= 0 ? story[si].music : null;
    FP_SOUND.setMusic(track());
  }
  function showNote(text) {
    if (reading) { pageQueue.push(text); return; }
    $('pageText').textContent = text; $('pageWho').textContent = '';
    openPage();
    FP_SOUND.page();
  }

  // ── memory rooms ──────────────────────────────────────────
  // Joe: "Maybe there needs to be more of a narrative and less just 'you left and I'm sad' … 'show don't tell' and even
  // better 'play don't show' since it's a game. Maybe there are little activities you can do as the kid that trigger a
  // core memory … These would all be new rooms. I'd make them the normal rooms we have with general stuff in them but in
  // the center there is this interactive space, kind of like what you do with the watch … new journals for these … One of
  // these can be in the chalk room." A memory room is one of the maze's own rooms (the story rooms' leftovers), furnished as
  // any other, with its middle kept clear (`memClear`) for the thing you do there and its journal (FP_MEMORIES: a page like the
  // others, picked up and counted with them; nothing waits on the memories yet). Floor 1, `memoryRooms` of them, its own
  // stream; where a maze hasn't rooms enough, the later ones go without. Catch has no room of its own: it is the kid's
  // room's, with the ball and the one glove already there. In `story` as kind 'memory', so the turn leaves it alone.
  //   phone — on the wall you face coming in, "call dad to go visit" over it in crayon. Tap it and it rings, RINGS times,
  //           and nobody picks up; walk away and you've hung up. Let it ring out and the memory comes (`after`).
  //   catch — dad on the kid room's wall, glove up. Pick up the ball, then tap (or Space) to throw: it never goes where
  //           you threw it. CATCH_THROWS at him and the memory comes.
  const MEMORY_ROOMS = ['phone', 'cards', 'fire', 'hide'];   // the ones with a room of their own; each maze deals them in its own order, so a short one has a different few
  const RINGS = 5, RING_EVERY = 2800, CATCH_THROWS = 3, CARD_LOSSES = 3, HE_COMES = 9000, HE_STANDS = 3200;
  let memFace = new Map(), memClear = new Set(), catchT = null, catchN = 0, catchDone = false, ballHeld = null;
  const memText = () => floor === 1 && typeof FP_MEMORIES !== 'undefined' && character ? FP_MEMORIES[character.name] : null;
  function placeMemories(reserved) {
    memFace = new Map(); memClear = new Set(); catchT = null; catchN = 0; catchDone = false; ballHeld = null; smokeLevel(0);
    const M8 = memText(); if (!M8 || S.memoryRooms <= 0) return;
    const R = rng(SEED + 290011), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y), secret = secretSet();
    const comp = new Int32Array(W * H).fill(-1), rooms = [];
    for (let k0 = 0; k0 < W * H; k0++) {
      if (!room[k0] || comp[k0] >= 0) continue;
      const tiles = [k0]; comp[k0] = rooms.length;
      for (let i = 0; i < tiles.length; i++) { const c = tiles[i], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (room[n] && comp[n] < 0 && !solid(x + dx, y + dy)) { comp[n] = rooms.length; tiles.push(n); } } }
      rooms.push(tiles);
    }
    const cands = rooms.filter((t) => t.length >= 9 && !t.some((k) => storyAt[k] >= 0 || (Math.abs(k % W - sx0) < 3 && Math.abs(((k / W) | 0) - sy0) < 3) || (secret && secret.has(k)) || inHeart(k) || (k % W === exit.x && ((k / W) | 0) === exit.y)));
    const deal = MEMORY_ROOMS.filter((k) => M8[k]);
    for (let i = deal.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deal[i], deal[j]] = [deal[j], deal[i]]; }
    for (const mem of deal.slice(0, Math.round(S.memoryRooms))) {
      if (!cands.length) break;
      const tiles = cands.splice(Math.floor(R() * cands.length), 1)[0], set = new Set(tiles);
      const mouths = [], faces = [];
      for (const r of tiles) { const x = r % W, y = (r / W) | 0;
        for (const [dx, dy] of HD) { const nx = x + dx, ny = y + dy, n = ny * W + nx;
          if (!solid(nx, ny) && !set.has(n)) mouths.push({ mx: nx, my: ny, rx: x, ry: y, dx, dy });
          else if (solid(nx, ny) && !exitFace[n] && !reserved.has(faceKey(n, faceTo(dx, dy)))) faces.push({ k: n, face: faceTo(dx, dy), vx: x, vy: y, dx, dy }); } }
      if (!mouths.length || !faces.length) continue;
      const m = mouths[0];
      if (mem === 'hide') {   // a closet of its own, on the wall farthest from the way in; the journal just inside the way in
        const far = faces.filter((q) => !(q.vx === m.rx && q.vy === m.ry)).sort((a, b) => Math.hypot(b.vx - m.rx, b.vy - m.ry) - Math.hypot(a.vx - m.rx, a.vy - m.ry) || R() - 0.5)[0];
        if (!far) continue;
        const st = { kind: 'memory', mem, tiles, set, m, text: M8[mem], done: false,
          closet: { k: far.k, face: far.face, x: far.vx, y: far.vy, dx: -far.dx, dy: -far.dy } };
        const si = story.length; story.push(st); for (const k of tiles) storyAt[k] = si;
        reserved.add(faceKey(far.k, far.face));
        for (let yy = far.vy - 1; yy <= far.vy + 1; yy++) for (let xx = far.vx - 1; xx <= far.vx + 1; xx++) if (set.has(yy * W + xx)) memClear.add(yy * W + xx);
        memClear.add(m.ry * W + m.rx);
        continue;
      }
      if (mem !== 'phone') {   // a thing in the middle of the floor: the tile nearest the middle with floor all round it
        const tl = tiles.filter((k) => HD.every(([dx, dy]) => set.has(k + dy * W + dx)));
        if (!tl.length) continue;
        const mx = tiles.reduce((a, k) => a + k % W, 0) / tiles.length, my = tiles.reduce((a, k) => a + ((k / W) | 0), 0) / tiles.length;
        const c = tl.reduce((b, k) => Math.hypot(k % W - mx, ((k / W) | 0) - my) < Math.hypot(b % W - mx, ((b / W) | 0) - my) ? k : b, tl[0]);
        const cx = c % W, cy = (c / W) | 0, tx = m.rx - cx, ty = m.ry - cy;
        const ix = Math.abs(tx) >= Math.abs(ty) ? Math.sign(tx) || 1 : 0, iy = ix ? 0 : Math.sign(ty) || 1;   // toward the way in: your side
        const st = { kind: 'memory', mem, tiles, set, m, text: M8[mem], at: { x: cx, y: cy, ix, iy }, done: false,
          walls: faces.filter((q) => !reserved.has(faceKey(q.k, q.face))).sort(() => R() - 0.5).slice(0, 4) };
        const si = story.length; story.push(st); for (const k of tiles) storyAt[k] = si;
        for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) if (set.has(yy * W + xx)) memClear.add(yy * W + xx);
        continue;
      }
      // the wall you face coming in, if it's free; any free wall of the room if not
      let n = 0; while (set.has((m.ry - m.dy * n) * W + m.rx - m.dx * n)) n++;
      const fk0 = (m.ry - m.dy * n) * W + m.rx - m.dx * n, ff0 = faceTo(-m.dx, -m.dy);
      const f = faces.find((q) => q.k === fk0 && q.face === ff0) || faces[Math.floor(R() * faces.length)];
      const st = { kind: 'memory', mem, tiles, set, m, text: M8[mem], wall: f, done: false };
      const si = story.length; story.push(st); for (const k of tiles) storyAt[k] = si;
      const fk = faceKey(f.k, f.face); reserved.add(fk); memFace.set(fk, st);
      if (mem === 'phone') drawPhone(decalFor(f.k, f.face), st.text.sign, R);
      // the floor in front of it, and beside that, stays clear of furniture
      for (let yy = f.vy - 1; yy <= f.vy + 1; yy++) for (let xx = f.vx - 1; xx <= f.vx + 1; xx++) if (set.has(yy * W + xx)) memClear.add(yy * W + xx);
    }
  }
  // a wall phone, beige, at a kid's height, and what it's for in crayon over it
  function drawPhone(d, sign, R) {
    d.fill(0);
    const px = (x, y, c) => { if (x >= 0 && x < DEC && y >= 0 && y < DEC) d[y * DEC + x] = c; };
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, c); };
    const BODY = TEX.hex('#d6cdb0'), EDGE = TEX.hex('#6b6453'), HAND = TEX.hex('#c9bf9f'), DARK = TEX.hex('#3d3a33');
    rect(27, 29, 39, 46, EDGE); rect(28, 30, 38, 45, BODY);                    // the body
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; px(Math.round(33 + Math.cos(a) * 3.6), Math.round(38 + Math.sin(a) * 3.6), EDGE); }   // the dial
    px(33, 38, DARK);
    rect(22, 27, 26, 47, EDGE); rect(23, 28, 25, 46, HAND); rect(21, 27, 26, 30, EDGE); rect(21, 44, 26, 47, EDGE);   // the handset in its cradle
    for (let y = 48, x = 24; y < 58; y++) { px(x + ((y & 1) ? 1 : -1), y, DARK); if (y > 54) x += 2; }   // the cord, curling down and back
    const r = hand(d, sign, 7, 6, 52, 1, CRAYON[0], R); void r;
  }
  // what's in a memory room, once the furniture is down: its journal on the floor in front of the thing
  function memoryProps() {
    for (const st of story) {
      if (st.kind !== 'memory') continue;
      if (st.at) { middleProps(st); continue; }
      if (st.closet) {   // the journal on the floor just inside the way in: reading it is what brings him
        const m = st.m; objs.push({ x: m.rx + 0.5 + (m.rx - m.mx) * 0.25, y: m.ry + 0.5 + (m.ry - m.my) * 0.25, kind: 'page', memPage: true, mem: st, text: st.text.page, tex: TEX.sprites.book, h: 0.3, glow: 0.35 });
        continue;
      }
      // beside it, not in front of it: in front, it'd be what Space reaches for every time instead of the phone
      const f = st.wall, side = [[-f.dy, f.dx], [f.dy, -f.dx]].find(([sx, sy]) => st.set.has((f.vy + sy) * W + f.vx + sx)) || [0, 0];
      objs.push({ x: f.vx + side[0] + 0.5 + f.dx * 0.25, y: f.vy + side[1] + 0.5 + f.dy * 0.25, kind: 'page', memPage: true, text: st.text.page, tex: TEX.sprites.book, h: 0.3, glow: 0.35 });
    }
  }
  // the cards' table and chairs, or the paper and the matches, in the middle; the journal on the floor at a corner of it
  function middleProps(st) {
    const { x, y, ix, iy } = st.at, cx = x + 0.5, cy = y + 0.5, ux = -iy, uy = ix;
    if (st.mem === 'cards') {
      for (const b of buildFurn(FURN.cardTable, cx, cy, ux, uy, ix, iy, 0)) fboxes.push(b);
      for (const b of buildFurn(FURN.kidChair, cx + ix * 0.5, cy + iy * 0.5, ux, uy, -ix, -iy, 0)) fboxes.push(b);   // yours, on the side you come in
      for (const b of buildFurn(FURN.dadChair, cx - ix * 0.46, cy - iy * 0.46, ux, uy, ix, iy, 0)) fboxes.push(b);   // his, across, empty
      objs.push({ x: cx + ux * 0.13, y: cy + uy * 0.13, z: 0.245, kind: 'cards', mem: st, tex: TEX.sprites.deck, h: 0.035, glow: 0.3 });
    } else if (st.mem === 'fire') {
      // Joe: "The pile to light needs to be twice as big." Tapped with the matches in hand, it's lit (`pile`)
      st.paper = { x: cx, y: cy, z: 0, kind: 'pile', mem: st, tex: TEX.sprites.paper, h: 0.14, glow: 0.2 }; objs.push(st.paper);
      // and the matches in his red toolbox on a little table to one side, shut until you've read the page
      const tx = cx + ux * 0.62, ty = cy + uy * 0.62;
      for (const b of buildFurn(FURN.sideTable, tx, ty, ux, uy, ix, iy, 0)) fboxes.push(b);
      st.box = { x: tx, y: ty, z: 0.24, kind: 'toolbox', mem: st, tex: TEX.sprites.toolbox, h: 0.075, glow: 0.3 }; objs.push(st.box);
    }
    // at the far corner, past the thing: near your side it'd be what Space reaches for instead
    const jx = x - ix + ux, jy = y - iy + uy, ok = st.set.has(jy * W + jx), kx = ok ? jx : x - ix - ux, ky = ok ? jy : y - iy - uy;
    objs.push({ x: kx + 0.5 - (kx - x) * 0.2, y: ky + 0.5 - (ky - y) * 0.2, kind: 'page', memPage: true, mem: st, text: st.text.page, tex: TEX.sprites.book, h: 0.3, glow: 0.35 });
  }
  // a playing card, stood on the table: white, its rank in red or black
  const RANKS = '23456789jqka', cardTexes = new Map();
  function cardTex(r, red) {
    const key = r * 2 + (red ? 1 : 0); if (cardTexes.has(key)) return cardTexes.get(key);
    const w = 7, h = 9, T = { w, h, px: new Uint32Array(w * h) }, edge = TEX.hex('#b9b2a0'), face = TEX.hex('#f3efe4'), ink = TEX.hex(red ? '#b8322a' : '#1e1c1a');
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) T.px[yy * w + xx] = xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1 ? edge : face;
    const g = FONT[RANKS[r]]; for (let rr = 0; rr < 5; rr++) for (let q = 0; q < 3; q++) if (g[rr * 3 + q] === '#') T.px[(rr + 2) * w + q + 2] = ink;
    cardTexes.set(key, T); return T;
  }
  // the same card lying on the table, bigger, and turned so it reads the right way up from your chair: (fx, fy) is the
  // way you face across the table. World-aligned, for a box's top (topFit): x along the box's x, y along its y
  function flatCard(r, red, fx, fy) {
    const key = 'f' + r + (red ? 1 : 0) + fx + ',' + fy; if (cardTexes.has(key)) return cardTexes.get(key);
    const cw = 15, ch = 21, C = new Uint32Array(cw * ch), edge = TEX.hex('#b9b2a0'), face = TEX.hex('#f3efe4'), ink = TEX.hex(red ? '#b8322a' : '#1e1c1a');
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) C[yy * cw + xx] = xx === 0 || yy === 0 || xx === cw - 1 || yy === ch - 1 ? edge : face;
    const g = FONT[RANKS[r]]; for (let rr = 0; rr < 5; rr++) for (let q = 0; q < 3; q++) if (g[rr * 3 + q] === '#')
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[(rr * 3 + 3 + a) * cw + q * 3 + 3 + b] = ink;
    for (const [px2, py2] of [[1, 1], [2, 1], [1, 2], [cw - 2, ch - 2], [cw - 3, ch - 2], [cw - 2, ch - 3]]) C[py2 * cw + px2] = ink;   // a pip in two corners
    const along = fx !== 0, w = along ? ch : cw, h = along ? cw : ch, T = { w, h, px: new Uint32Array(w * h) };
    const rx = -fy, ry = fx;   // your right, looking the way you face
    for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) {
      const px = (ox + 0.5) / w - 0.5, py = (oy + 0.5) / h - 0.5, u = px * rx + py * ry, v = -(px * fx + py * fy);
      T.px[oy * w + ox] = C[Math.min(ch - 1, ((v + 0.5) * ch) | 0) * cw + Math.min(cw - 1, ((u + 0.5) * cw) | 0)];
    }
    cardTexes.set(key, T); return T;
  }
  // ── sitting down to play ──
  // Joe: "When we play war, can we have a scene where before you play you sit down in the chair and have the camera kind
  // of tilt down to frame the table? This way we can play it with the cards on the table so it's easier to read. This
  // would be almost like the closet on leaving. There'd be a button to press to get up." Tap the deck (or Space) and you
  // sit: into your chair over SEAT_MS, down to SEAT_EYE, looking down at the cards. Sat there, a tap or Space turns a card;
  // Get up (or Esc, or a step of the stick or the keys) and you're back where you stood
  const SEAT_EYE = 0.46, SEAT_MS = 700, CARD_OFF = 0.085, CARD_HALF = 0.075, TABLE_Z = 0.249;
  // how far back from the table you sit, and how far down to look. Joe, on a PC: "We need to pull the camera out more for
  // the game of War because I can't read the bottom card" — a wide screen is short, and the view set on a phone put your
  // own card off the bottom of it. So a wide screen sits you further back (SEAT_WIDE) than a tall one (SEAT_TALL), and the
  // tilt is worked out from where you sit: the middle of the two cards, from the near edge of yours to the far edge of
  // his, in the middle of the view
  const SEAT_TALL = 0.3, SEAT_WIDE = 0.42, SEAT_WIDEST = 0.5;   // a phone held up; a PC; a phone on its side (Get up sits over the table)
  const seatAt = () => (RW > RH * 1.8 ? SEAT_WIDEST : RW > RH ? SEAT_WIDE : SEAT_TALL);
  const seatShift = (at) => ((SEAT_EYE - TABLE_Z) / (at - CARD_OFF - CARD_HALF) + (SEAT_EYE - TABLE_Z) / (at + CARD_OFF + CARD_HALF)) / 2;
  let seated = null;
  function sitDown(st) {
    const { x, y, ix, iy } = st.at, now = performance.now();
    seated = { st, back: { x: P.x, y: P.y, a: P.a }, to: { x: x + 0.5 + ix * seatAt(), y: y + 0.5 + iy * seatAt(), a: Math.atan2(-iy, -ix) }, t0: now, up: 0, k: 0, shift: seatShift(seatAt()), eye: SEAT_EYE };
    vel = 0; clearStick(); for (const k of Object.keys(keys)) keys[k] = false;
    document.body.classList.add('seated'); FP_SOUND.sit();
  }
  function getUp() { if (seated && !seated.up) { seated.up = performance.now(); FP_SOUND.sit(); if (seated.mode === 'book') bookUp(); } }
  function seatFrame(now) {
    const s = seated; if (!s) return;
    const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const k = s.up ? 1 - Math.min(1, (now - s.up) / SEAT_MS) : Math.min(1, (now - s.t0) / SEAT_MS), e = ease(k);
    let da = s.to.a - s.back.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    P.x = s.back.x + (s.to.x - s.back.x) * e; P.y = s.back.y + (s.to.y - s.back.y) * e; P.a = s.back.a + da * e; s.k = e;
    if (s.up && k <= 0) { P.x = s.back.x; P.y = s.back.y; P.a = s.back.a; lastX = P.x; lastY = P.y; seated = null; document.body.classList.remove('seated'); }
  }
  const seatedPlay = () => { if (seated && !seated.up && seated.k > 0.95) { if (seated.mode === 'book') bookTurn(); else useMemory(seated.st); } };
  // ── the picture book ──
  // Joe: "Maybe the children's book needs to be read. You sit in the bed and flip through the book. Then it has to be put
  // away on a shelf in the room. It's another collectible that needs to be dealt with in order to move on." Tap it: you sit
  // at the head of the bed, BED_EYE up, and it lies open on the blanket in front of you; each tap (or Space) turns a page,
  // its words under the view. Past the last, you get up holding it (the HUD shows it), and the way out won't open until
  // it's back in the gap on the shelf — as well as his watch left (`exitOpen`). Get up before the end and it's put down
  // where it was, to start again
  const BED_EYE = 0.36, BED_AT = 0.24, BOOK_AT = 0.56, BOOK_Z = 0.195;
  let kidBook = null;
  const exitOpen = () => !!watchLeft;   // the book is incidental now (Joe: "everything else is incidental"); it was required for v0.163.0–v0.165.0
  // a picture turned so it reads the right way up to someone looking (fx, fy), laid on a box's top (world-aligned)
  function laidFlat(C, cw, ch, fx, fy) {
    const along = fx !== 0, w = along ? ch : cw, h = along ? cw : ch, T = { w, h, px: new Uint32Array(w * h) }, rx = -fy, ry = fx;
    for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) {
      const px = (ox + 0.5) / w - 0.5, py = (oy + 0.5) / h - 0.5, u = px * rx + py * ry, v = -(px * fx + py * fy);
      T.px[oy * w + ox] = C[Math.min(ch - 1, ((v + 0.5) * ch) | 0) * cw + Math.min(cw - 1, ((u + 0.5) * cw) | 0)];
    }
    return T;
  }
  // the book open at page n: a red cover round two cream pages, a picture on the left, lines of words on the right
  function bookSpread(n, fx, fy) {
    const cw = 26, ch = 16, C = new Uint32Array(cw * ch), px = (x, y, c) => { if (x >= 0 && y >= 0 && x < cw && y < ch) C[y * cw + x] = c; };
    const cover = TEX.hex('#b8412f'), page = TEX.hex('#f1ead6'), ink = TEX.hex('#8a8272'), bear = TEX.hex('#7a4f2e'), moon = TEX.hex('#e8d27a'), night = TEX.hex('#2d3a5e'), sun = TEX.hex('#e6a94a');
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) px(x, y, x === 0 || y === 0 || x === cw - 1 || y === ch - 1 ? cover : x === 13 ? TEX.hex('#d6ceb8') : page);
    const last = n >= 4;
    if (!last) {   // the picture: the little bear, and what the page is about
      const sky = n === 1 || n === 2 ? night : page;
      for (let y = 2; y < 14; y++) for (let x = 2; x < 12; x++) px(x, y, sky);
      if (n === 0) { for (let y = 3; y < 9; y++) { px(3, y, ink); px(10, y, ink); } for (let x = 3; x < 11; x++) { px(x, 3, ink); px(x, 8, ink); } }   // the window
      if (n === 1) for (let y = 3; y < 7; y++) for (let x = 7; x < 11; x++) if (Math.hypot(x - 8.5, y - 4.5) < 1.9) px(x, y, moon);
      if (n === 2) { px(5, 6, moon); px(8, 6, moon); }   // eyes open in the dark
      if (n === 3) { for (let y = 3; y < 6; y++) for (let x = 8; x < 11; x++) px(x, y, sun); for (let y = 7; y < 13; y++) for (let x = 6; x < 11; x++) px(x, y, bear); }   // the big bear
      for (let y = 9; y < 13; y++) for (let x = 3; x < 6; x++) px(x, y, bear); px(3, 8, bear); px(5, 8, bear);   // the little one
    }
    for (let l = 0; l < (last ? 1 : 4); l++) for (let x = 15; x < (last ? 22 : 24 - (l === 3 ? 4 : 0)); x++) px(x, last ? 7 : 3 + l * 3, ink);   // the words
    return laidFlat(C, cw, ch, fx, fy);
  }
  function openBook() {
    const b = kidBook; if (!b || b.read || seated) return;
    const { x: wx, y: wy, fx, fy, ux, uy } = b.bed, now = performance.now();
    const i = objs.indexOf(b.o); if (i >= 0) objs.splice(i, 1);
    const mx = wx + fx * BOOK_AT, my = wy + fy * BOOK_AT, hx = fx ? 0.1 : 0.15, hy = fx ? 0.15 : 0.1;
    b.page = 0; const t = bookSpread(0, fx, fy);
    b.flat = { x0: mx - hx, x1: mx + hx, y0: my - hy, y1: my + hy, z0: 0.19, z1: BOOK_Z, m: TEX.furn.mats.white, top: t, topFit: true, front: null, fcode: 'n', glow: false, flat: true };
    fboxes.push(b.flat); void ux; void uy;
    seated = { st: null, mode: 'book', back: { x: P.x, y: P.y, a: P.a }, to: { x: wx + fx * BED_AT, y: wy + fy * BED_AT, a: Math.atan2(fy, fx) }, t0: now, up: 0, k: 0,
      eye: BED_EYE, shift: (BED_EYE - BOOK_Z) / (BOOK_AT - BED_AT) };
    vel = 0; clearStick(); for (const k of Object.keys(keys)) keys[k] = false;
    document.body.classList.add('seated', 'book'); $('bookLine').textContent = b.text.pages[0]; FP_SOUND.sit();
  }
  function bookTurn() {
    const b = kidBook; if (!b || !b.flat) return;
    b.page++; FP_SOUND.cardFlip();
    if (b.page < b.text.pages.length) { b.flat.top = b.flat.m = bookSpread(b.page, b.bed.fx, b.bed.fy); b.flat.m = TEX.furn.mats.white; $('bookLine').textContent = b.text.pages[b.page]; return; }
    // shut, and you're holding it: up, and it's to go back on the shelf
    const i = fboxes.indexOf(b.flat); if (i >= 0) fboxes.splice(i, 1); b.flat = null;
    b.read = true; carried.add('book'); hud(); flash('hudBookBox'); getUp(); showNote(b.text.after);
  }
  function bookUp() {   // getting up before the end: it's put down where it was
    const b = kidBook; document.body.classList.remove('book');
    if (!b || b.read || !b.flat) return;
    const i = fboxes.indexOf(b.flat); if (i >= 0) fboxes.splice(i, 1); b.flat = null; b.page = -1;
    if (!objs.includes(b.o)) objs.push(b.o);
  }
  function shelveBook() {
    const b = kidBook; if (!b || b.shelved) return;
    if (!carried.has('book')) { showNote(b.text.gap); return; }
    carried.delete('book'); b.shelved = true; hud();
    if (b.gap) { b.gap.kind = 'deco'; b.gap.tex = TEX.sprites.bookSpine; }
    FP_SOUND.chalkUp(); showNote(b.text.shelved);
  }
  function useMemory(st) {
    const now = performance.now();
    if (st.mem === 'phone') {
      if (st.ringing) return;
      st.ringing = { t0: now, n: 0, at: st.wall }; FP_SOUND.phoneUp();
    } else if (st.mem === 'cards') {
      if (!seated) { sitDown(st); return; }   // you sit down to play
      if (st.round) return;
      // his is always the higher card
      const kr = Math.floor(Math.random() * (RANKS.length - 1)), dr = kr + 1 + Math.floor(Math.random() * (RANKS.length - 1 - kr));
      for (const o of st.shown || []) { const i = fboxes.indexOf(o); if (i >= 0) fboxes.splice(i, 1); }
      st.shown = []; st.round = { t0: now, kr, dr, step: 0 }; (st.hands = st.hands || []).push([kr, dr]);
    } else if (st.mem === 'fire') {
      if (st.fire || st.done) return;
      carried.delete('matches'); hud();
      st.fire = { t0: now, frame: 0, crackle: 0, cough: now + 3000, obj: { x: st.paper.x, y: st.paper.y + 0.001, z: 0.02, kind: 'deco', tex: TEX.sprites.fire[0], h: 0.04, glow: 1 } };
      objs.push(st.fire.obj); FP_SOUND.strike();
      sealRoom(st);
    }
  }
  function cardsFrame(st, now) {
    const r = st.round, t = now - r.t0, { x, y, ix, iy } = st.at, cx = x + 0.5, cy = y + 0.5, ux = -iy, uy = ix;
    // face up, flat on the table, yours on your side and his on his, both reading the right way up from your chair
    const card = (rank, side) => { const mx = cx + ix * CARD_OFF * side - ux * 0.03 * side, my = cy + iy * CARD_OFF * side - uy * 0.03 * side;
      const hx = ix ? CARD_HALF : 0.054, hy = ix ? 0.054 : CARD_HALF, t = flatCard(rank, Math.random() < 0.5, -ix, -iy);
      const o = { x0: mx - hx, x1: mx + hx, y0: my - hy, y1: my + hy, z0: 0.245, z1: 0.249, m: TEX.furn.mats.white, top: t, topFit: true, front: null, fcode: 'n', glow: false, flat: true };
      fboxes.push(o); st.shown.push(o); FP_SOUND.cardFlip(); };
    if (r.step === 0 && t > 100) { r.step = 1; card(r.kr, 1); }            // yours
    else if (r.step === 1 && t > 900) { r.step = 2; card(r.dr, -1); }      // his, turned by nobody
    else if (r.step === 2 && t > 1500) { r.step = 3; FP_SOUND.cardLose(); st.losses = (st.losses || 0) + 1; }
    else if (r.step === 3 && t > 2100) { st.round = null; if (st.losses >= CARD_LOSSES && !st.done) { st.done = true; showNote(st.text.after); } }
  }
  // him, coming: from when the journal is put down, HE_COMES of his steps (and the bottle) getting nearer; then he's in
  // the doorway. In a closet, and he walks to it and stands (HE_STANDS), and goes; not, and he walks straight past you
  function hideFrame(st, now) {
    const c = st.coming, m = st.m;
    if (!c.t0) { if (reading) return; c.t0 = now; c.next = now + 900; }   // the page put down first
    const t = now - c.t0;
    if (!c.him) {
      if (now > c.next) {
        const near = Math.min(1, 0.15 + t / HE_COMES);
        FP_SOUND.drunkStep(near); if (Math.random() < 0.25) FP_SOUND.bottle(near);
        c.next = now + (Math.random() < 0.3 ? 250 : 650 + Math.random() * 500);   // uneven: a stumble, then a long one
      }
      if (t < HE_COMES) return;
      c.hid = !!hidden;
      const sx = m.mx + 0.5, sy = m.my + 0.5, cl = st.closet;
      let tx, ty;
      if (c.hid) { tx = cl.x + 0.5 + cl.dx * 0.9; ty = cl.y + 0.5 + cl.dy * 0.9; if (!st.set.has(Math.floor(ty) * W + Math.floor(tx))) { tx = cl.x + 0.5; ty = cl.y + 0.5; } }
      else { const vx = P.x - sx, vy = P.y - sy, l = Math.hypot(vx, vy) || 1; tx = P.x + vx / l * 1.3 - vy / l * 0.45; ty = P.y + vy / l * 1.3 + vx / l * 0.45;   // by you, and on
        if (!st.set.has(Math.floor(ty) * W + Math.floor(tx))) { tx = P.x - vy / l * 0.5; ty = P.y + vx / l * 0.5; } }
      c.him = { x: sx, y: sy, z: 0, kind: 'deco', ghost: true, alpha: 1, h: FATHER_H, glow: 0, vx: 0, vy: 0, back: false, walked: 0, tex: TEX.sprites.father[0] };
      c.path = [[tx, ty], [sx, sy]]; c.leg = 0; c.wait = 0; objs.push(c.him); FP_SOUND.drunkStep(1);
      return;
    }
    const h = c.him, dt = Math.min(0.05, (now - (c.last || now)) / 1000); c.last = now;
    if (c.leg === 0 || c.leg === 2) {
      const [wx, wy] = c.path[c.leg === 0 ? 0 : 1], ex = wx - h.x, ey = wy - h.y, d = Math.hypot(ex, ey), step = S.walk * 0.7 * dt;
      if (d <= step) { h.x = wx; h.y = wy; c.leg++; c.wait = now; }
      else { h.vx = ex / d; h.vy = ey / d; h.x += h.vx * step; h.y += h.vy * step; h.walked += step; }
      h.back = h.vx * Math.cos(P.a) + h.vy * Math.sin(P.a) > 0.7;
      h.tex = TEX.sprites[h.back ? 'fatherBack' : 'father'][Math.floor(h.walked / 0.33) & 1];
      if (c.leg === 2 && Math.hypot(h.x - c.path[1][0], h.y - c.path[1][1]) < 0.6) h.alpha -= dt * 2.5;
      if (now > (c.next || 0)) { c.next = now + 700 + Math.random() * 300; FP_SOUND.drunkStep(0.9); }
    } else if (c.leg === 1) { if (now - c.wait > (c.hid ? HE_STANDS : 300)) c.leg = 2; }   // at the closet door, standing there
    if (c.leg >= 3 || h.alpha <= 0) {
      const i = objs.indexOf(h); if (i >= 0) objs.splice(i, 1);
      st.coming = null; st.done = true; showNote(c.hid ? st.text.after : (st.text.seen || st.text.after));
    }
  }
  const SHOUT = TEX.hex('#1a1614');
  // Joe: "We need to do more with the fire room. Can we fill the room with smoke? Close the doors and don't let them open … Click
  // on the toolbox, it opens and the matches are inside. Click on matches and collect them in your inventory. Then click on
  // the fire to use them. Smoke fills the room. You can't get out. Fade to black from smoke damage. Wake up a few seconds
  // later on the ground, same wake up we have at the start, if we are still in the same room. Then we see all the writing on
  // the walls. There's a burned spot on the ground."
  // The page read, the toolbox opens (`openToolbox`); the matches taken, the pile is lit (useMemory) and the room is shut
  // (`sealRoom`: its doors swung to and held, and you held inside it). The fire grows; the smoke comes down from the ceiling
  // over SMOKE_FILL, and you cough; SMOKE_HOLD at its thickest, and it's black (SMOKE_BLACK): the fire out, ash and a burn
  // where it was, what he shouted on the walls, and you lying on the floor of the same room. Then the waking, as at the start,
  // and the memory (`after`); the doors let go.
  const SMOKE_FILL = 8000, SMOKE_HOLD = 1500, SMOKE_BLACK = 2600, SMOKE_MAX = 0.94;
  function openToolbox(st) {
    if (st.boxOpen) { if (st.matches && objs.includes(st.matches)) take(st.matches); return; }   // open: a tap on it is a tap on what's in it
    if (!st.read) { FP_SOUND.locked(); if (st.text.toolbox) showNote(st.text.toolbox); return; }   // not until you've read why
    st.boxOpen = true; st.box.tex = TEX.sprites.toolboxOpen; FP_SOUND.latch();
    st.matches = { x: st.box.x, y: st.box.y + 0.001, z: 0.24 + 0.05, kind: 'matches', tex: TEX.sprites.matches, h: 0.03, glow: 0.4 }; objs.push(st.matches);
  }
  function sealRoom(st) {
    st.sealed = { x: P.x, y: P.y };
    st.held = [];
    for (const d of doors) { const near = HD.some(([dx, dy]) => st.set.has((d.y + dy) * W + d.x + dx)) || st.set.has(d.k);
      if (!near) continue; if (d.open) toggleDoor(d); d.locked = true; st.held.push(d); }
  }
  function smokeLevel(v) { const el = $('smoke'); if (el) el.style.opacity = v.toFixed(3); }
  function fireFrame(st, now) {
    const f = st.fire, t = now - f.t0;
    // held in: a step out of the room puts you back where you last stood in it
    if (st.sealed) { const k = Math.floor(P.y) * W + Math.floor(P.x); if (st.set.has(k)) { st.sealed.x = P.x; st.sealed.y = P.y; } else { P.x = st.sealed.x; P.y = st.sealed.y; vel = 0; } }
    if (!f.out) {
      f.obj.h = 0.04 + Math.min(1, t / 2500) * 0.48;
      if (now - f.frame > 130) { f.frame = now; f.obj.tex = TEX.sprites.fire[(Math.random() * 2) | 0]; }
      if (now > f.crackle) { f.crackle = now + 250 + Math.random() * 400; FP_SOUND.crackle(Math.min(1, t / 2500)); }
      const k = Math.min(1, t / SMOKE_FILL); smokeLevel(SMOKE_MAX * k * k * (3 - 2 * k));
      if (k > 0.35 && now > f.cough) { f.cough = now + 1400 + Math.random() * 1200; FP_SOUND.cough(k); }
      if (t > SMOKE_FILL + SMOKE_HOLD) {   // it's black
        f.out = true; stairBusy = true; clearStick();
        const fade = $('fade'); $('fadeText').textContent = ''; fade.classList.remove('white'); fade.classList.add('show');
        setTimeout(() => {   // and while it is: out, burned, his words, and you on the floor
          objs.splice(objs.indexOf(f.obj), 1); st.paper.tex = TEX.sprites.ash; st.paper.h = 0.05; st.paper.kind = 'deco';
          const sx = st.paper.x, sy = st.paper.y;
          fboxes.push({ x0: sx - 0.34, x1: sx + 0.34, y0: sy - 0.34, y1: sy + 0.34, z0: 0, z1: 0.003, m: TEX.sprites.scorch, top: TEX.sprites.scorch, topFit: true, front: null, fcode: 'n', glow: false, flat: true });
          FP_SOUND.fireOut(); smokeLevel(0);
          const lines = st.text.shout || [];
          st.walls.forEach((q, i) => { const fk = faceKey(q.k, q.face); if (!lines.length || switchFace.has(fk) || closets.some((c) => faceKey(c.k, c.face) === fk)) return;
            const d = decalFor(q.k, q.face); hand(d, lines[i % lines.length], 4, 8, 56, 2, SHOUT, Math.random); });
          // on the floor where you went down, facing the burn
          P.a = Math.atan2(sy - P.y, sx - P.x); lastX = P.x; lastY = P.y; vel = 0;
          rising = { t0: performance.now() + 400 }; document.body.classList.add('waking');
          fade.classList.remove('show'); stairBusy = false; f.woke = performance.now();
        }, SMOKE_BLACK);
      }
    } else if (f.woke && performance.now() - f.woke > 400 + WAKE_LIE + WAKE_RISE + 300) {
      for (const d of st.held || []) d.locked = false;
      st.sealed = null; st.fire = null; st.done = true; showNote(st.text.after);
    }
  }
  function memoryFrame(now) {
    for (const st of story) {
      if (st.kind !== 'memory') continue;
      if (st.round) cardsFrame(st, now);
      if (st.fire) fireFrame(st, now);
      if (st.coming) hideFrame(st, now);
      if (!st.ringing) continue;
      const r = st.ringing, f = st.wall;
      // walked off: you've put it down
      if (Math.hypot(P.x - (f.vx + 0.5), P.y - (f.vy + 0.5)) > 2.2) { st.ringing = null; FP_SOUND.phoneDown(); continue; }
      if (r.n < RINGS && now - r.t0 > 600 + r.n * RING_EVERY) { r.n++; FP_SOUND.ring(); }
      else if (r.n >= RINGS && now - r.t0 > 600 + RINGS * RING_EVERY + 800) {
        st.ringing = null; FP_SOUND.phoneDown();
        if (!st.done) { st.done = true; showNote(st.text.after); }
      }
    }
    ballFrame(now);
  }
  // ── catch ──
  // dad drawn on the wall of the kid's room farthest from the corner the ball is in (not the bed's, not the way in)
  function catchSetup(set, roomT, cor, bed, way, R, text) {
    let best = null, bd = -1;
    for (const k of roomT) { const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of HD) { const wx = x + dx, wy = y + dy, fk = faceKey(wy * W + wx, faceTo(dx, dy));
        if (!solid(wx, wy) || (wx === way.x && wy === way.y) || switchFace.has(fk) || (x === bed.x && y === bed.y && dx === bed.dx && dy === bed.dy)) continue;
        const d = Math.hypot(x - cor.x, y - cor.y) + R() * 0.3; if (d > bd) { bd = d; best = { k: wy * W + wx, face: faceTo(dx, dy), x, y, dx, dy }; } } }
    if (!best) return;
    const d = decalFor(best.k, best.face);
    for (let y = 8; y < 60; y++) for (let x = 12; x < 52; x++) d[y * DEC + x] = 0;   // his wall is left for him
    kidChalk(d, 'catcher', 30, 38, R);
    catchT = { x: best.x + 0.5 + best.dx * 0.5, y: best.y + 0.5 + best.dy * 0.5, z: 0.5, face: faceKey(best.k, best.face) };
    // the journal, on the floor next to the glove's corner (not on it: the ball is what you reach for there)
    const nb = HD.map(([dx, dy]) => [cor.x + dx, cor.y + dy]).find(([x, y]) => set.has(y * W + x) && !objs.some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y));
    if (nb) objs.push({ x: nb[0] + 0.5, y: nb[1] + 0.5, kind: 'page', memPage: true, text: text.page, tex: TEX.sprites.book, h: 0.3, glow: 0.35 });
  }
  function pickBall(o) {
    objs.splice(objs.indexOf(o), 1); ballHeld = o; carried.add('ball'); FP_SOUND.chalkUp();
    if (!learnt.throw) trainOn('throw', performance.now());   // what to do with it, the first time ever
  }
  function throwBall() {
    const o = ballHeld; if (!o) { carried.delete('ball'); return; }
    carried.delete('ball'); ballHeld = null;
    // at dad if he's anywhere near where you're looking — and then never quite at him
    let a = P.a, atDad = false;
    if (catchT) { const to = Math.atan2(catchT.y - P.y, catchT.x - P.x), off = Math.atan2(Math.sin(to - P.a), Math.cos(to - P.a));
      if (Math.abs(off) < 0.6) { atDad = true; a = to + (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.3); } }
    if (!atDad) a += (Math.random() - 0.5) * 0.3;
    const cx = Math.cos(a), cy = Math.sin(a);
    let t = 0.3; while (t < 7 && !solidAt(P.x + cx * t, P.y + cy * t)) t += 0.05;
    const hx = P.x + cx * (t - 0.12), hy = P.y + cy * (t - 0.12);
    // off the wall: a drop back toward you, then a roll, stopping short of anything
    let rx = hx - cx * 0.5, ry = hy - cy * 0.5, roll = 0.5 + Math.random() * 0.7;
    const side = (Math.random() - 0.5) * 0.8, bx = -cx + -cy * side, by = -cy + cx * side, bl = Math.hypot(bx, by);
    let ex = rx, ey = ry;
    for (let s2 = 0; s2 < roll; s2 += 0.05) { const nx = rx + bx / bl * s2, ny = ry + by / bl * s2; if (solidAt(nx, ny) || solidAt(nx + bx / bl * 0.1, ny + by / bl * 0.1)) break; ex = nx; ey = ny; }
    if (solidAt(rx, ry)) { rx = ex = hx; ry = ey = hy; }
    o.x = P.x + cx * 0.2; o.y = P.y + cy * 0.2; o.z = 0.4;
    o.fly = { t0: performance.now(), sx: o.x, sy: o.y, hx, hy, rx, ry, ex, ey, tf: Math.max(0.15, t / 6), atDad, hit: false, bounced: false };
    objs.push(o); FP_SOUND.throwBall();
  }
  function ballFrame(now) {
    // carried out of the kid's room: put down where you are
    if (ballHeld && typeof secretTiles !== 'undefined' && secretTiles.size && !secretTiles.has(Math.floor(P.x) + ',' + Math.floor(P.y))) { const o = ballHeld; ballHeld = null; carried.delete('ball'); o.x = P.x; o.y = P.y; o.z = 0; objs.push(o); }
    for (const o of objs) {
      const f = o.fly; if (!f) continue;
      const t = (now - f.t0) / 1000, t1 = f.tf, t2 = t1 + 0.3, t3 = t2 + 0.8;
      if (t < t1) { const k = t / t1; o.x = f.sx + (f.hx - f.sx) * k; o.y = f.sy + (f.hy - f.sy) * k; o.z = 0.4 + Math.sin(Math.PI * k) * 0.18 - k * 0.05; }
      else if (t < t2) { if (!f.hit) { f.hit = true; FP_SOUND.ballWall(); } const k = (t - t1) / 0.3; o.x = f.hx + (f.rx - f.hx) * k; o.y = f.hy + (f.ry - f.hy) * k; o.z = 0.35 * (1 - k * k); }
      else if (t < t3) { if (!f.bounced) { f.bounced = true; FP_SOUND.ballBounce(); } const k = 1 - Math.pow(1 - (t - t2) / 0.8, 2); o.x = f.rx + (f.ex - f.rx) * k; o.y = f.ry + (f.ey - f.ry) * k; o.z = 0; }
      else {
        o.x = f.ex; o.y = f.ey; o.z = 0; o.fly = null;
        if (f.atDad && !catchDone && ++catchN >= CATCH_THROWS) { catchDone = true; const M8 = memText(); if (M8 && M8.catch) showNote(M8.catch.after); }
      }
    }
  }

  // ── fewer squeezes ────────────────────────────────────────
  // Joe: "We need less chains of squeezes on the map. There are just too many of them." Measured: about 17 a maze, 3 of
  // them chains of three to seven tiles. So, before anything else is placed: `squeezeChains` chains are kept (the
  // longest — the one "thick batch"), `squeezeSingles` of the single ones, and the rest are opened to plain floor — which
  // only ever adds a way through, so nothing is cut off. The kid's room keeps its squeeze. Its own stream
  function thinSqueezes() {
    const R = rng(SEED + 270001), gaps = [...crawlGaps, ...crawlCells], isLow = new Set(gaps);
    if (!isLow.size) return;
    const secret = typeof secretTiles !== 'undefined' ? secretTiles : new Set();
    const nearSecret = (x, y) => HD.some(([dx, dy]) => secret.has((x + dx) + ',' + (y + dy)));
    const seen = new Set(), runs = [];
    for (const g of gaps) { if (seen.has(g)) continue; const run = [g]; seen.add(g);
      for (let i = 0; i < run.length; i++) { const [x, y] = run[i].split(',').map(Number);
        for (const [dx, dy] of HD) { const n = (x + dx) + ',' + (y + dy); if (isLow.has(n) && !seen.has(n)) { seen.add(n); run.push(n); } } }
      runs.push(run); }
    const keep = (run) => run.some((g) => { const [x, y] = g.split(',').map(Number); return nearSecret(x, y); });
    const chains = runs.filter((r) => r.length >= 2 && !keep(r)).sort((a, b) => b.length - a.length);
    const singles = runs.filter((r) => r.length < 2 && !keep(r));
    const open = [...chains.slice(Math.max(0, Math.round(S.squeezeChains)))];
    for (const r of singles) if (R() >= S.squeezeSingles) open.push(r);
    for (const r of open) for (const g of r) { crawlGaps.delete(g); crawlCells.delete(g); }
  }
  // ── the heart ─────────────────────────────────────────────
  // Joe: "I want a hidden story room that is a representation of inside the heart of the kid. He misses
  // his dad and feels abandoned. This room should be hidden somehow. Put it furthest away from the exit
  // and the start and make a squeeze through maze to get to it. I'm fine with this affecting the
  // generation of the maze."
  //
  // The waiting room is what he tells himself, the wall is what he tells everyone else; this is what is
  // under both, and the one place in the building that isn't lying. So it is carved here, after the
  // generator, on its own stream, and only in this view: a frame of HEART_W × HEART_H tiles (turned to
  // any of four ways) is walled up and cut again as a room the shape of a heart, with its point toward a
  // little maze of squeezes — every passage of it a squeeze, a dead end or two — that opens onto the
  // maze by one more. Of every place the frame fits, the one whose way in is furthest from both the
  // start and the exit (the nearer of the two, in steps). A place fits if it's clear of the start, the
  // exit, the kid's room and the maze's big rooms (the story rooms are made from those: keeping them costs
  // the heart about a tenth of its distance), and walling it up leaves the exit reachable. Whatever it
  // cuts off (the end of some dead end) is filled in, so there's no floor you can't reach; a page, chalk
  // or charcoal under it is moved to the nearest floor left, a squeeze under it goes, and if it went over
  // the way out, the way out is worked out again (the being and the debug path read it). Nothing in it is on any other feature's list: no door, closet, switch, furniture, words,
  // stairs, father or darter, and the turn leaves it alone, as it does the kid's room. The being can't
  // follow you in: it never takes a squeeze.
  //
  // Inside: one lamp, beating (HEART_BPM); the walls painted a deep red and written over in crayon
  // (STORY_ROOMS.heart in data/text.js); a letter on the floor; its own music (`The Heart`). And the
  // heartbeat carries: from HEART_HEAR steps off you can hear it through the walls, the only sign that
  // it's there at all.
  // Joe: "The heartbeat is great. However, we need to double the range it can be heard by" — 14 and 28 steps, now 28 and 56
  const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'], HEART_W = 7, HEART_BPM = 54, HEART_HEAR = 28, HEART_HEAR_OPEN = 56;
  const HEART_TRIES = 40, HEART_DEAD = { 3: 2, 2: 1 };   // the squeeze maze: trees tried, and the dead ends wanted (three rows of cells, or two)
  let heart = null, heartAt = null;
  const inHeart = (k) => !!(heartAt && heartAt.length === W * H && heartAt[k]);
  function carveHeart() {
    heart = null; heartAt = new Uint8Array(W * H);
    if (!S.heart || floor !== 1 || !character || typeof STORY_ROOMS === 'undefined' || !STORY_ROOMS[character.name] || !STORY_ROOMS[character.name].heart) return;
    // three rows of squeeze cells under the heart if they fit anywhere; two where they don't
    const R = rng(SEED + 220009);
    for (const rows of [3, 2]) if (fitHeart(rows, R)) return;
  }
  function fitHeart(rows, R) {
    // the frame, in its own terms: u across, v from the heart's top (0) down to the maze's foot (HEART_H-1)
    const HEART_H = 7 + 2 * rows, foot = 5 + 2 * rows, open0 = [], cellsL = [];
    for (let j = 0; j < rows; j++) for (const u of [1, 3, 5]) cellsL.push([u, 7 + 2 * j]);
    HEART.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') open0.push([1 + i, 1 + j, 1]); });
    // the little maze: a spanning tree over its nine cells, grown from the one under the heart's point. Joe: "we need one
    // more branching dead end in the squeeze maze leading to it". Grown by always carrying on from the newest cell it was
    // one long crawl with a single dead end off it (every time, at three rows); so it's grown from any cell reached so
    // far, HEART_TRIES times, and the tree kept is the one with HEART_DEAD dead ends (one more than it had) whose way in is
    // deepest — a crawl of six cells, not seven, for the extra wrong turn
    const cid = (u, v) => cellsL.findIndex(([a, b]) => a === u && b === v), onEdge = ([u, v]) => u === 1 || u === 5 || v === foot;
    let tree = null, depth = null, bestD = -1;
    for (let t = 0; t < HEART_TRIES; t++) {
      const tr = [[3, 6, 2], [3, 7, 2]], dp = new Map([[cid(3, 7), 0]]), deg = new Map([[cid(3, 7), 1]]), live = [[3, 7]];
      while (live.length) {
        const i = Math.floor(R() * live.length), [u, v] = live[i], nb = HD.map(([dx, dy]) => [u + dx * 2, v + dy * 2, u + dx, v + dy]).filter(([a, b]) => cid(a, b) >= 0 && !dp.has(cid(a, b)));
        if (!nb.length) { live.splice(i, 1); continue; }
        const [a, b, wu, wv] = nb[Math.floor(R() * nb.length)];
        dp.set(cid(a, b), dp.get(cid(u, v)) + 1); deg.set(cid(u, v), (deg.get(cid(u, v)) || 0) + 1); deg.set(cid(a, b), 1);
        tr.push([wu, wv, 2], [a, b, 2]); live.push([a, b]);
      }
      const way = cellsL.map((c, i) => i).filter((i) => onEdge(cellsL[i])).sort((a, b) => dp.get(b) - dp.get(a))[0];
      const dead = cellsL.filter((c, i) => i !== way && deg.get(i) === 1).length;
      if (dead === HEART_DEAD[rows] && dp.get(way) > bestD) { bestD = dp.get(way); tree = tr; depth = dp; }
    }
    if (!tree) {   // none came out that way (it hardly happens): the long crawl, as it was
      tree = [[3, 6, 2], [3, 7, 2]]; depth = new Map([[cid(3, 7), 0]]); const stack = [[3, 7]];
      while (stack.length) {
        const [u, v] = stack[stack.length - 1], nb = HD.map(([dx, dy]) => [u + dx * 2, v + dy * 2, u + dx, v + dy]).filter(([a, b]) => cid(a, b) >= 0 && !depth.has(cid(a, b)));
        if (!nb.length) { stack.pop(); continue; }
        const [a, b, wu, wv] = nb[Math.floor(R() * nb.length)];
        depth.set(cid(a, b), depth.get(cid(u, v)) + 1); tree.push([wu, wv, 2], [a, b, 2]); stack.push([a, b]);
      }
    }
    // ways out of it, through the frame's own wall: from a cell on its edge, deepest first
    const ways = [];
    for (const [u, v] of cellsL) {
      const d = depth.get(cid(u, v));
      if (u === 1) ways.push({ d, ring: [0, v], out: [-1, v] });
      if (u === 5) ways.push({ d, ring: [6, v], out: [7, v] });
      if (v === foot) ways.push({ d, ring: [u, foot + 1], out: [u, foot + 2] });
    }
    ways.sort((a, b) => b.d - a.d);
    const deepest = ways[0].d, wayPool = ways.filter((w) => w.d >= deepest - 1);
    // the maze as it stands: what matters in it, and how far everything is from the start and the exit
    const key = (x, y) => y * W + x, keep = new Uint8Array(W * H), sx = Math.floor(start.x), sy = Math.floor(start.y);
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) keep[key(x, y)] = 1; };
    // (pages, chalk and charcoal aren't kept: one under the frame is moved out to the nearest floor that's left;
    // and a squeeze under it, other than the kid's room's, is walled up with it)
    if (typeof secretTiles !== 'undefined') for (const s2 of secretTiles) { const [x, y] = s2.split(',').map(Number); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(x + dx, y + dy); }
    for (const [x, y] of exitAlley || []) mark(x, y);
    mark(exit.x, exit.y);
    // and the maze's big rooms, which the story rooms are made from
    { const isRoom = (x, y) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([ax, ay]) => !solid(x + ax, y + ay) && !solid(x + ax + 1, y + ay) && !solid(x + ax, y + ay + 1) && !solid(x + ax + 1, y + ay + 1));
      const comp = new Int32Array(W * H).fill(-1);
      for (let k0 = 0; k0 < W * H; k0++) { const x0 = k0 % W, y0 = (k0 / W) | 0; if (comp[k0] >= 0 || solid(x0, y0) || !isRoom(x0, y0)) continue;
        const t = [k0]; comp[k0] = k0;
        for (let i = 0; i < t.length; i++) { const c = t[i], x = c % W, y = (c / W) | 0;
          for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (comp[n] < 0 && !solid(x + dx, y + dy) && isRoom(x + dx, y + dy)) { comp[n] = k0; t.push(n); } } }
        if (t.length >= 9) for (const c of t) keep[c] = 1; } }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(sx + dx, sy + dy);
    const bfs = (from, block) => { const d = new Int32Array(W * H).fill(-1), q = [from]; d[from] = 0;
      for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && d[n] < 0 && !(block && block[n])) { d[n] = d[c] + 1; q.push(n); } } }
      return d; };
    const dS = bfs(key(sx, sy)), dE = bfs(key(exit.x, exit.y));
    const place = (r, ox, oy, u, v) => { const [a, b] = r === 0 ? [u, v] : r === 1 ? [HEART_H - 1 - v, u] : r === 2 ? [HEART_W - 1 - u, HEART_H - 1 - v] : [v, HEART_W - 1 - u]; return [ox + a, oy + b]; };
    let best = null;
    const frame = new Uint8Array(W * H);
    // the deepest ways in first, for the longest crawl; any way at all if none of those fits
    for (const pool of [wayPool, ways]) for (let r = 0; r < 4 && !(best && pool === ways && best.pass === 0); r++) {
      const fw = r & 1 ? HEART_H : HEART_W, fh = r & 1 ? HEART_W : HEART_H;
      for (let oy = 1; oy + fh <= H - 1; oy++) for (let ox = 1; ox + fw <= W - 1; ox++) {
        let bad = false;
        for (let y = oy; y < oy + fh && !bad; y++) for (let x = ox; x < ox + fw; x++) if (keep[key(x, y)]) { bad = true; break; }
        if (bad) continue;
        // the best way in this frame could have: an open tile of the maze, just outside it
        let way = null, score = -1;
        if (pool === ways && best && best.pass === 0) break;
        for (const w of pool) { const [x, y] = place(r, ox, oy, ...w.out), k = key(x, y);
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || solid(x, y) || dS[k] < 0 || dE[k] < 0) continue;
          const sc = Math.min(dS[k], dE[k]) + R() * 0.5; if (sc > score) { score = sc; way = w; } }
        if (!way || (best && score <= best.score)) continue;
        // and what walling it up would cut off
        frame.fill(0); for (let y = oy; y < oy + fh; y++) for (let x = ox; x < ox + fw; x++) frame[key(x, y)] = 1;
        const reach = bfs(key(sx, sy), frame), [wx, wy] = place(r, ox, oy, ...way.out);
        if (reach[key(wx, wy)] < 0 || reach[key(exit.x, exit.y)] < 0) continue;
        const lost = [];
        for (let k = 0; k < W * H && !bad; k++) if (!frame[k] && reach[k] < 0 && dS[k] >= 0) {   // only what walling it up cuts off, not what was never reachable
           if (keep[k]) bad = true; else lost.push(k); }
        if (bad) continue;
        best = { score, r, ox, oy, fw, fh, way, lost, pass: pool === wayPool ? 0 : 1 };
      }
    }
    if (!best) return false;
    const { r, ox, oy, fw, fh, way, lost } = best;
    const setT = (x, y, v) => { tiles[y][x] = v; };
    for (let y = oy; y < oy + fh; y++) for (let x = ox; x < ox + fw; x++) setT(x, y, 0);
    for (const k of lost) setT(k % W, (k / W) | 0, 0);
    // the way out, if the frame went over it: the shortest way now, which the being and the debug path both read
    if (solutionPath.some(([x, y]) => solid(x, y))) {
      const from = key(sx, sy), to = key(exit.x, exit.y), prev = new Int32Array(W * H).fill(-1), q = [from]; prev[from] = from;
      for (let i = 0; i < q.length && prev[to] < 0; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && prev[n] < 0) { prev[n] = c; q.push(n); } } }
      const path = []; for (let c = to; ; c = prev[c]) { path.unshift([c % W, (c / W) | 0]); if (c === from) break; }
      solutionPath = path;
    }
    // squeezes that went under it are gone; what lay there is moved out to the nearest floor left
    for (const set of [crawlGaps, crawlCells]) for (const s2 of [...set]) { const [x, y] = s2.split(',').map(Number); if (solid(x, y)) set.delete(s2); }
    const reach = bfs(key(sx, sy)), held = new Set([...journals.keys(), ...chalkSpots, ...charcoalSpots]);
    const moveOut = (s2) => { const [x0, y0] = s2.split(',').map(Number); let bk = -1, bd = 1e9;
      for (let k = 0; k < W * H; k++) { const x = k % W, y = (k / W) | 0; if (reach[k] < 0 || crawlCells.has(x + ',' + y) || crawlGaps.has(x + ',' + y) || held.has(x + ',' + y)) continue;
        const dd = Math.hypot(x - x0, y - y0); if (dd < bd) { bd = dd; bk = k; } }
      const n2 = (bk % W) + ',' + ((bk / W) | 0); held.add(n2); return n2; };
    for (const [s2, pg] of [...journals]) if (solid(...s2.split(',').map(Number))) { journals.delete(s2); journals.set(moveOut(s2), pg); }
    for (const set of [chalkSpots, charcoalSpots]) for (const s2 of [...set]) if (solid(...s2.split(',').map(Number))) { set.delete(s2); set.add(moveOut(s2)); }
    const roomK = [], mazeK = [];
    for (const [u, v, kind] of open0.concat(tree, [[...way.ring, 2]])) {
      const [x, y] = place(r, ox, oy, u, v), k = key(x, y);
      setT(x, y, 1); heartAt[k] = kind;
      if (kind === 1) roomK.push(k); else { mazeK.push(k); crawlCells.add(x + ',' + y); }
    }
    const P0 = (u, v) => { const [x, y] = place(r, ox, oy, u, v); return key(x, y); };
    const [ex, ey] = place(r, ox, oy, ...way.out);
    const [ax, ay] = place(r, ox, oy, 3, 5), [bx, by] = place(r, ox, oy, 3, 4);
    heart = { ux: bx - ax, uy: by - ay, room: roomK, maze: mazeK, set: new Set(roomK), tip: P0(3, 5), throat: P0(3, 6), lamp: P0(3, 3), far: P0(3, 2), mid: P0(3, 3),
      lobes: [P0(2, 1), P0(4, 1)], out: key(ex, ey), ring: P0(...way.ring), score: Math.floor(best.score), filled: lost.length, rows, dist: null, beat: -1, sealed: false };
    // walled up until the lies are crossed out (Joe: "the heart should stay hidden, perhaps it's hidden until you
    // cross out the lies"): its way in is wall, and it's silent, until openHeart()
    if (!heartOpened) { const [rx, ry] = place(r, ox, oy, ...way.ring); setT(rx, ry, 0); crawlCells.delete(rx + ',' + ry); heart.sealed = true; }
    return true;
  }
  // how far every tile is from the heart, for how loud it beats; made once the maze is final
  function heartIndex() {
    if (!heart) return;
    const d = new Int32Array(W * H).fill(-1), q = [heart.mid]; d[heart.mid] = 0;
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && d[n] < 0) { d[n] = d[c] + 1; q.push(n); } } }
    heart.dist = d;
  }
  const heartPulse = (now) => {   // lub-dub: 0..1, a quick rise and fall twice a beat
    const t = (now / 60000 * HEART_BPM) % 1;
    return Math.max(Math.exp(-Math.pow((t - 0.04) / 0.05, 2)), 0.7 * Math.exp(-Math.pow((t - 0.3) / 0.05, 2)));
  };
  // ── the vein ──────────────────────────────────────────────
  // Joe: "once the heart room opens, we should draw a line from the player to the entrance to the heart room … faint vein
  // that pulses at the same rate of the heart." Once you've opened it (not when a maze starts with it open), until you've
  // been in: along the floor, the walking way from the tile you're on down heart.dist to the gap in its wall (heart.ring), a
  // thin wavering line of dark red, faint between beats and coming up on each lub and dub (heartPulse). `vein` is per tile,
  // the sides of it the line leaves by (1 east, 2 west, 4 south, 8 north); worked out again each time you step onto a new tile.
  const VEIN_W = 0.024, VEIN_WOBBLE = 0.035, VEIN_RGB = [178, 30, 38];
  let vein = null, veinFrom = -1, veinLvl = 0;
  function veinFrame(now) {
    const pk = Math.floor(P.y) * W + Math.floor(P.x);
    if (!heart || !heart.vein || !heart.dist || heart.sealed || floor !== 1 || heartSeen() || inHeart(pk)) { vein = null; veinFrom = -1; return; }
    veinLvl = 0.22 + 0.6 * heartPulse(now);
    if (pk === veinFrom && vein) return;
    veinFrom = pk; vein = new Uint8Array(W * H);
    const bit = (dx, dy) => dx === 1 ? 1 : dx === -1 ? 2 : dy === 1 ? 4 : 8;
    for (let c = pk, n = 0; c !== heart.ring && n < W * H; n++) {
      const x = c % W, y = (c / W) | 0; let nb = -1, bd = heart.dist[c] < 0 ? 1e9 : heart.dist[c], dir = null;
      for (const [dx, dy] of HD) { const k = c + dy * W + dx; if (!solid(x + dx, y + dy) && heart.dist[k] >= 0 && heart.dist[k] < bd) { bd = heart.dist[k]; nb = k; dir = [dx, dy]; } }
      if (nb < 0) break;
      vein[c] |= bit(dir[0], dir[1]); vein[nb] |= bit(-dir[0], -dir[1]); c = nb;
    }
  }
  // how much of the vein is at (fx, fy) in a tile with sides `m`: 0..1
  function veinAt(m, fx, fy, wx, wy) {
    const w = VEIN_WOBBLE * Math.sin(wx * 9.1 + wy * 7.3) * Math.sin(wx * 3.7 - wy * 5.9), lo = 0.5 - VEIN_W, hi = 0.5 + VEIN_W;
    let d = 1;
    if ((m & 1 && fx >= lo) || (m & 2 && fx <= hi)) d = Math.min(d, Math.abs(fy - 0.5 - w));
    if ((m & 4 && fy >= lo) || (m & 8 && fy <= hi)) d = Math.min(d, Math.abs(fx - 0.5 - w));
    return d < VEIN_W ? 1 - d / VEIN_W * 0.6 : 0;
  }
  const heartSwell = (now) => {   // the same lub-dub, slow: the building's lights come up and go down with it, not flash
    const t = (now / 60000 * HEART_BPM) % 1;
    return Math.max(Math.exp(-Math.pow((t - 0.1) / 0.16, 2)), 0.75 * Math.exp(-Math.pow((t - 0.38) / 0.16, 2)), Math.exp(-Math.pow((t - 1.1) / 0.16, 2)));
  };
  function heartFrame(now) {
    if (!heart || !heart.dist || won) return;
    const t = (now / 60000 * HEART_BPM) % 1, b = Math.floor(now / 60000 * HEART_BPM) * 2 + (t >= 0.26 ? 1 : 0);
    if (b === heart.beat) return;
    heart.beat = b;
    const d = heart.dist[Math.floor(P.y) * W + Math.floor(P.x)], near = d < 0 ? 0 : Math.pow(Math.max(0, 1 - d / HEART_HEAR_OPEN), 1.5);   // open, it carries: it's what you follow to find it
    if (near > 0.02 && (t < 0.1 || (t >= 0.26 && t < 0.36))) FP_SOUND.heartbeat(near, !(b & 1));
  }
  // its walls: deep red, written over in crayon — "i miss you" most of all — and on the far wall, big,
  // the one thing he never says anywhere else, and the two of them holding hands
  const HEART_INK = [TEX.hex('#efd7cf'), TEX.hex('#e6a9ad'), TEX.hex('#f3e6c8')];
  function fillHeart(d, R, H8, which) {
    const red = [TEX.hex('#4a1216'), TEX.hex('#55161b'), TEX.hex('#3f0f13'), TEX.hex('#5e1d21')];
    for (let y = 0; y < DEC; y++) for (let x = 0; x < DEC; x++) {
      const v = Math.sin(x * 0.45 + Math.sin(y * 0.11) * 2) + Math.sin(y * 0.07 + x * 0.05) * 0.6;   // soft folds, like cloth or something alive
      d[y * DEC + x] = red[v > 1 ? 3 : v > 0.2 ? 1 : v < -0.9 ? 2 : 0];
    }
    let y = 3;
    if (which === 'far') {
      for (const b of H8.big) { const r2 = hand(d, b, 4, y, 56, 2, HEART_INK[0], R); y = r2.y + 2; }
      kidChalk(d, 'pair', DEC * 0.5, DEC * 0.72, R);
      return;
    }
    if (which === 'lobe') { const b = H8.lobes[Math.floor(R() * H8.lobes.length)]; const r2 = hand(d, b, 3, 8, 58, 2, HEART_INK[1], R); y = r2.y + 3; }
    while (y < DEC - 6) {
      const line = H8.walls[Math.floor(R() * H8.walls.length)], x0 = 1 + (R() * 6 | 0);
      const r2 = hand(d, line, x0, y, 60 - x0, 1, HEART_INK[Math.floor(R() * HEART_INK.length)], R);
      y = r2.y + (R() < 0.3 ? 2 : 0);
    }
  }
  function dressHeart(reserved) {
    if (!heart) return;
    const H8 = STORY_ROOMS[character.name].heart, R = rng(SEED + 220013), set = heart.set;
    for (const k of heart.room) { const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of HD) { const wx = x + dx, wy = y + dy; if (!solid(wx, wy)) continue;
        const n = wy * W + wx, face = faceTo(dx, dy), fk = faceKey(n, face), dd = decalFor(n, face); dd.fill(0);
        const up = dx === heart.ux && dy === heart.uy;   // the wall ahead as you come in at the point
        fillHeart(dd, R, H8, up && k === heart.far ? 'far' : up && heart.lobes.includes(k) ? 'lobe' : 'wall');
        reserved.add(fk); } }
    // one lamp, in the middle of the upper room; the rest of its ceiling plain
    if (T.ceils) {
      const glowVar = T.ceils.findIndex((c) => c.glow), plain = T.ceils.findIndex((c) => !c.glow);
      // its own ceiling and lamp, added past the look's own (tiles pick theirs by index, so nothing else moves)
      let hc = T.ceils.indexOf(TEX.heart.ceil); if (hc < 0) hc = T.ceils.push(TEX.heart.ceil) - 1;
      let hl = T.ceils.indexOf(TEX.heart.lamp); if (hl < 0) hl = T.ceils.push(TEX.heart.lamp) - 1;
      if (glowVar >= 0 && plain >= 0) { for (const k of heart.maze) ceilVar[k] = plain; for (const k of heart.room) ceilVar[k] = hc; ceilVar[heart.lamp] = hl; }
      for (const k of heart.room) floorVar[k] = 250;   // no look has that many floors: the heart's own
      flickers = flickers.filter((k) => !inHeart(k));
    }
    const si = story.length;
    for (const k of heart.room) storyAt[k] = si;
    const tx = heart.tip % W, ty = (heart.tip / W) | 0, mx = heart.throat % W, my = (heart.throat / W) | 0;
    story.push({ kind: 'heart', tiles: heart.room, set, m: { mx, my, rx: tx, ry: ty, dx: tx - mx, dy: ty - my }, music: 'The Heart', text: H8 });
  }

  // ── the kid's room ────────────────────────────────────────
  // Joe: "I want us to bring over the hidden room and the child's level, the one that is pitch black
  // until you turn on the light. The one that has all the drawings all over it. Put a pile of chalk
  // in one corner." The generator already makes it in a Child maze (secretTiles: a room carved out of
  // dead wall behind one squeeze, the way in a crawl gap), so here it only has to be dressed: it is a
  // light group of its own, starting off and pitch black rather than dim (PITCH), with its switch
  // beside the squeeze on the inside — the amber pilot is the only thing you can see in there — and
  // every wall inside is drawn on in a kid's chalk: noughts and crosses, "dad?", balls, suns, a house,
  // tallies, stick figures, and on the far wall a man walking away. The top-down draws those on the
  // floor; up close, they belong on the walls. A look with a sky has no lamps to switch, so there it's
  // only drawn on.
  const PITCH = 0.015;
  const secretSet = () => typeof secretTiles !== 'undefined' && secretTiles.size ? new Set([...secretTiles].map((s) => { const [x, y] = s.split(',').map(Number); return y * W + x; })) : null;
  function secretWay(set) {   // the squeeze in: a crawl gap beside the room
    for (const g of crawlGaps) { const [x, y] = g.split(',').map(Number);
      for (const [dx, dy] of HD) if (set.has((y + dy) * W + x + dx)) return { x, y, rx: x + dx, ry: y + dy }; }
    return null;
  }
  // Joe: "We need to do more with the chalk drawing room. Maybe it's got furniture that looks like a bed and a chair and a
  // childrens book next to the bed … There's a glove and a baseball, but only one glove in another corner. The kid is
  // trying to LARP having a father in this space." A bed along the wall across from the way in, a kid's chair beside
  // it, a picture book on the floor by the bed; in the corner nearest the way in, a ball and one glove. Only when the
  // room was carved whole (a real room, not a winding pinch); its own stream
  function furnishKidRoom() {
    kidBook = null;
    const set = secretSet(); if (!set || floor !== 1) return;
    const way = secretWay(set); if (!way) return;
    const roomT = [...set].filter((k) => room[k]); if (roomT.length < 9) return;
    const R = rng(SEED + 260003), wd = (k) => Math.abs(k % W - way.rx) + Math.abs(((k / W) | 0) - way.ry);
    // the bed: on the wall farthest from the way in, reaching into the room
    let bed = null, bd = -1;
    const held = new Set(objs.map((o) => Math.floor(o.y) * W + Math.floor(o.x)));   // not over the chalk pile
    for (const k of roomT) { const x = k % W, y = (k / W) | 0; if (held.has(k)) continue;
      for (const [dx, dy] of HD) { if (!solid(x + dx, y + dy)) continue; const bx = x - dx, by = y - dy;   // needs a tile in front for its length
        if (!set.has(by * W + bx)) continue; const d = wd(k) + R() * 0.5; if (d > bd) { bd = d; bed = { x, y, dx, dy }; } } }
    if (!bed) return;
    const fx = -bed.dx, fy = -bed.dy, ux = -fy, uy = fx, wx = bed.x + 0.5 + bed.dx * 0.5, wy = bed.y + 0.5 + bed.dy * 0.5;   // the wall line behind it
    for (const b of buildFurn(FURN.kidBed, wx, wy, ux, uy, fx, fy, 0)) fboxes.push(b);
    // the chair, beside the bed's head, and the book on the floor between
    const side = set.has((bed.y + uy) * W + bed.x + ux) ? 1 : -1;
    const chx = wx + ux * side * 0.62, chy = wy + uy * side * 0.62;
    for (const b of buildFurn(FURN.kidChair, chx, chy, ux, uy, fx, fy, 0)) fboxes.push(b);
    const M8b = memText(), bookO = { x: wx + ux * side * 0.38 + fx * 0.45, y: wy + uy * side * 0.38 + fy * 0.45, kind: M8b && M8b.book ? 'kidBook' : 'deco', tex: TEX.sprites.kidBook, h: 0.05, glow: 0.2 };
    objs.push(bookO);
    if (M8b && M8b.book) kidBook = { o: bookO, text: M8b.book, bed: { x: wx, y: wy, fx, fy, ux, uy, tx: bed.x, ty: bed.y }, page: -1, read: false, shelved: false, flat: null, gap: null };
    // the ball and the one glove, in the corner of the room nearest the way in (the chalk pile has the far one)
    let cor = null, cd = 1e9;
    for (const k of roomT) { const x = k % W, y = (k / W) | 0, walls = HD.filter(([dx, dy]) => solid(x + dx, y + dy));
      if (walls.length < 2 || Math.hypot(x - bed.x, y - bed.y) < 2) continue; const d = wd(k); if (d > 0 && d < cd) { cd = d; cor = { x, y, walls }; } }
    if (cor) { const ox = cor.walls.reduce((a, [dx]) => a + dx, 0) * 0.26, oy = cor.walls.reduce((a, [, dy]) => a + dy, 0) * 0.26;
      objs.push({ x: cor.x + 0.5 + ox, y: cor.y + 0.5 + oy, kind: 'deco', tex: TEX.sprites.glove, h: 0.08, glow: 0.2 });
      const M8 = memText();
      objs.push({ x: cor.x + 0.5 + ox * 0.3, y: cor.y + 0.5 + oy * 0.3, kind: M8 && M8.catch ? 'ball' : 'deco', tex: TEX.sprites.baseball, h: 0.04, glow: 0.2 });
      if (M8 && M8.catch) catchSetup(set, roomT, cor, bed, way, R, M8.catch); }
    if (kidBook) placeShelf(set, roomT, bed, way, cor, R);
  }
  // the book's shelf: against a straight run of the kid's room's wall, clear of the bed, the ball's corner, the way in,
  // dad's catch wall and the switch; a gap in its row of books where the picture book goes back
  function placeShelf(set, roomT, bed, way, cor, R) {
    const spots = [];
    for (const k of roomT) { const x = k % W, y = (k / W) | 0, walls = HD.filter(([dx, dy]) => solid(x + dx, y + dy));
      if (walls.length !== 1) continue;
      const [dx, dy] = walls[0], fk = faceKey((y + dy) * W + x + dx, faceTo(dx, dy));
      if (!set.has((y - dy) * W + x - dx) || Math.hypot(x - bed.x, y - bed.y) < 2 || (cor && x === cor.x && y === cor.y) || Math.abs(x - way.rx) + Math.abs(y - way.ry) < 2) continue;
      if (switchFace.has(fk) || (catchT && catchT.face === fk) || objs.some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y)) continue;
      spots.push({ x, y, dx, dy, d: Math.hypot(x - bed.x, y - bed.y) + R() });
    }
    if (!spots.length) { kidBook.noShelf = true; return; }
    const sp = spots.sort((a, b) => a.d - b.d)[0], fx = -sp.dx, fy = -sp.dy, ux = -fy, uy = fx;   // the nearest to the bed that's clear
    const bx = sp.x + 0.5 + sp.dx * 0.5, by = sp.y + 0.5 + sp.dy * 0.5;
    for (const b of buildFurn(FURN.shelf, bx, by, ux, uy, fx, fy, 0)) fboxes.push(b);
    kidBook.gap = { x: bx + fx * 0.215 + ux * 0.12, y: by + fy * 0.215 + uy * 0.12, z: 0.1, kind: 'shelfGap', tex: TEX.sprites.bookGap, h: 0.12, glow: 0.3 };
    objs.push(kidBook.gap);
  }
  function placeChalkPile() {
    const set = secretSet(); if (!set || floor !== 1) return;   // the kid's room is floor 1's: Joe, "each room [should] be unique"
    const way = secretWay(set); if (!way) return;
    let best = null, bd = -1;
    for (const k of set) { const x = k % W, y = (k / W) | 0, walls = HD.filter(([dx, dy]) => solid(x + dx, y + dy)).length, d = Math.abs(x - way.x) + Math.abs(y - way.y);
      if (walls >= 2 && d > bd && !objs.some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y)) { best = [x, y, HD.filter(([dx, dy]) => solid(x + dx, y + dy))]; bd = d; } }
    if (!best) return;
    const [x, y, ws] = best, ox = ws.reduce((a, [dx]) => a + dx, 0) * 0.28, oy = ws.reduce((a, [, dy]) => a + dy, 0) * 0.28;
    objs.push({ x: x + 0.5 + ox, y: y + 0.5 + oy, kind: 'chalkPile', tex: TEX.sprites.chalkPile, h: 0.1, glow: 0.2 });
  }
  function placeSecret(usedFaces) {
    const set = secretSet(); if (!set || floor !== 1) return;
    const way = secretWay(set), R = rng(SEED + 190001);
    if (T.ceils && way) {
      // lamps of its own — one in the middle and one toward each corner — so switching on shows every wall
      const glowVar = T.ceils.findIndex((c) => c.glow), plain = T.ceils.findIndex((c) => !c.glow);
      const xs = [...set].map((k) => k % W), ys = [...set].map((k) => (k / W) | 0);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
      const lampAt = new Set([[mx, my], [x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y1 - 1]].map(([x, y]) => y * W + x));
      for (const k of set) if (glowVar >= 0 && plain >= 0) ceilVar[k] = lampAt.has(k) ? glowVar : plain;
      // the plate: on a wall beside the squeeze, seen from inside
      const dx = way.x - way.rx, dy = way.y - way.ry;   // from the room tile out to the gap
      let spot = null;
      for (const [px, py] of [[-dy, dx], [dy, -dx]]) {
        const wx = way.x + px, wy = way.y + py, vk = (way.ry + py) * W + way.rx + px;
        if (solid(wx, wy) && set.has(vk) && !usedFaces.has(faceKey(wy * W + wx, faceTo(dx, dy)))) { spot = { k: wy * W + wx, face: faceTo(dx, dy) }; break; }
      }
      if (!spot) {   // no wall beside the gap from inside: the wall you face as you come in
        let n = 1; while (set.has((way.ry - dy * n) * W + way.rx - dx * n)) n++;
        const wx = way.rx - dx * n, wy = way.ry - dy * n; if (solid(wx, wy)) spot = { k: wy * W + wx, face: faceTo(-dx, -dy) };
      }
      if (spot) {
        const g = { tiles: [...set], k: spot.k, face: spot.face, on: false, at: -1e9, lvl: 0, pitch: true };
        const gi = lightGroups.push(g) - 1;
        for (const k of set) groupAt[k] = gi;
        switchFace.set(faceKey(g.k, g.face), g); drawSwitch(g);
      }
    }
    // the walls, drawn on
    const faces = [];
    for (const k of set) { const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of HD) { const wx = x + dx, wy = y + dy, fk = faceKey(wy * W + wx, faceTo(dx, dy));
        if (solid(wx, wy) && !(way && wx === way.x && wy === way.y) && !switchFace.has(fk) && !usedFaces.has(fk)) faces.push({ k: wy * W + wx, face: faceTo(dx, dy), d: way ? Math.abs(x - way.x) + Math.abs(y - way.y) : 0 }); } }
    if (!faces.length) return;
    faces.sort((a, b) => b.d - a.d);
    const must = ['away', 'ttt', 'dad', 'dad', 'pair'], any = ['x', 'x', 'x', 'figure', 'figure', 'ball', 'ball', 'sun', 'house', 'tally'];
    faces.forEach((f, i) => {
      const n = 1 + (R() < 0.55 ? 1 : 0);
      for (let j = 0; j < n; j++) {
        const kind = i === 0 && j === 0 ? 'away' : (i < must.length && j === 0 ? must[i] : any[Math.floor(R() * any.length)]);
        const cu = (j + 0.5) / n + (R() - 0.5) * 0.08, cv = 0.5 + R() * 0.18;   // at a kid's height
        kidChalk(decalFor(f.k, f.face), kind, cu * DEC, cv * DEC, R);
      }
    });
  }
  // a child's chalk on a wall: wobbly lines in white and the coloured sticks
  const KID_CHALK = ['#ece7da', '#ece7da', '#e8a4b6', '#9cc2e4', '#eedf8c'].map((c) => TEX.hex(c));
  // drawn about the origin and scaled up by KZ onto the wall, in strokes two pixels wide, so a drawing
  // is big enough to read from across the room
  const KZ = 1.9;
  function kidChalk(d, kind, CX, CY, R) {
    const col = KID_CHALK[Math.floor(R() * KID_CHALK.length)], cx = 0, cy = 0;
    const dot = (x, y) => { const X = Math.round(CX + x * KZ), Y = Math.round(CY + y * KZ);
      for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) if (X + xx >= 0 && X + xx < DEC && Y + yy >= 0 && Y + yy < DEC && R() < 0.85) d[(Y + yy) * DEC + X + xx] = col; };
    const line = (x0, y0, x1, y1) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.2)); for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n + (R() - 0.5) * 0.5, y0 + (y1 - y0) * i / n + (R() - 0.5) * 0.5); };
    const ring = (x, y, r) => { const n = Math.ceil(r * 6); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; dot(x + Math.cos(a) * r, y + Math.sin(a) * r); } };
    const stick = (x, y, s, stride) => {   // a stick figure standing at (x, y) = its feet
      ring(x, y - s * 1.75, s * 0.28); line(x, y - s * 1.45, x, y - s * 0.6);
      line(x, y - s * 1.2, x - s * 0.45, y - s * 0.85); line(x, y - s * 1.2, x + s * 0.45, y - s * 0.85);
      line(x, y - s * 0.6, x - s * (stride || 0.35), y); line(x, y - s * 0.6, x + s * (stride || 0.35), y);
    };
    if (kind === 'x') { const r = 3 + R() * 2; line(cx - r, cy - r, cx + r, cy + r); line(cx + r, cy - r, cx - r, cy + r); }
    else if (kind === 'ball') { ring(cx, cy, 3.5 + R() * 2); line(cx - 3, cy + 1, cx + 3, cy - 1); }
    else if (kind === 'sun') { ring(cx, cy - 4, 3.5); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(cx + Math.cos(a) * 5, cy - 4 + Math.sin(a) * 5, cx + Math.cos(a) * 8, cy - 4 + Math.sin(a) * 8); } }
    else if (kind === 'house') { line(cx - 6, cy + 5, cx + 6, cy + 5); line(cx - 6, cy + 5, cx - 6, cy - 2); line(cx + 6, cy + 5, cx + 6, cy - 2); line(cx - 7, cy - 2, cx, cy - 8); line(cx, cy - 8, cx + 7, cy - 2); line(cx - 1, cy + 5, cx - 1, cy + 1); line(cx + 2, cy + 5, cx + 2, cy + 1); line(cx - 1, cy + 1, cx + 2, cy + 1); }
    else if (kind === 'tally') { for (let t = 0; t < 2; t++) { const bx = cx - 7 + t * 9; for (let i = 0; i < 4; i++) line(bx + i * 2, cy - 4, bx + i * 2, cy + 4); line(bx - 1, cy + 3, bx + 7, cy - 3); } }
    else if (kind === 'figure') stick(cx, cy + 6, 6);
    else if (kind === 'pair') { stick(cx - 5, cy + 7, 7); stick(cx + 5, cy + 7, 4); line(cx - 1, cy + 1, cx + 3, cy + 3); }   // a big one and a small one, holding hands
    else if (kind === 'away') {   // the man walking away, mid-stride, and the little one left behind
      stick(cx + 6, cy + 7, 7, 0.7); stick(cx - 9, cy + 7, 3.5);
      for (let i = 0; i < 3; i++) dot(cx - 3 + i * 3, cy + 8);
    }
    else if (kind === 'ttt') {
      line(cx - 2, cy - 7, cx - 2, cy + 7); line(cx + 3, cy - 7, cx + 3, cy + 7); line(cx - 7, cy - 2, cx + 8, cy - 2); line(cx - 7, cy + 3, cx + 8, cy + 3);
      const cells = [[-5, -5], [0, -5], [5, -5], [-5, 0], [0, 0], [5, 0], [-5, 5], [0, 5], [5, 5]];
      for (let i = 0; i < 6; i++) { const [ex, ey] = cells.splice(Math.floor(R() * cells.length), 1)[0]; if (i & 1) ring(cx + ex + 0.5, cy + ey + 0.5, 1.6); else { line(cx + ex - 1.5, cy + ey - 1.5, cx + ex + 1.5, cy + ey + 1.5); line(cx + ex + 1.5, cy + ey - 1.5, cx + ex - 1.5, cy + ey + 1.5); } }
    }
    else if (kind === 'catcher') {   // dad with his glove up: the one to throw to
      const q = 8; ring(cx, cy - q * 1.75, q * 0.28); line(cx, cy - q * 1.45, cx, cy - q * 0.6);
      line(cx, cy - q * 1.2, cx - q * 0.45, cy - q * 0.85); line(cx, cy - q * 1.2, cx + q * 0.55, cy - q * 1.6);
      ring(cx + q * 0.7, cy - q * 1.8, q * 0.32); ring(cx + q * 0.7, cy - q * 1.8, q * 0.16);
      line(cx, cy - q * 0.6, cx - q * 0.35, cy); line(cx, cy - q * 0.6, cx + q * 0.35, cy);
    }
    else if (kind === 'dad') {
      const word = 'dad?', x0 = Math.round(cx - word.length * 4 / 2 * 1.5);
      for (let c = 0; c < word.length; c++) { const g = FONT[word[c]]; if (!g) continue;
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '#') { dot(x0 + (c * 4 + q) * 1.5, cy - 4 + r * 1.5); dot(x0 + (c * 4 + q) * 1.5 + 0.8, cy - 4 + r * 1.5 + 0.8); } }
    }
  }
  // on: a tube taking a moment to catch, as they do. Off: at once
  function groupLevel(g, now) {
    if (!g.on) return 0;
    const t = now - g.at;
    return t > 520 ? 1 : t < 60 ? 0.7 : t < 190 ? 0 : t < 250 ? 0.9 : t < 420 ? 0.12 : 1;
  }
  function flipSwitch(g) {
    g.on = !g.on; g.at = performance.now(); drawSwitch(g);
    FP_SOUND.flip(g.on);
  }

  function enterCloset(c) {
    // stand in the doorway, in the wall's own face, looking out through the vent
    const fx = c.dx === 1 ? c.x : c.dx === -1 ? c.x + 1 : c.x + 0.5, fy = c.dy === 1 ? c.y : c.dy === -1 ? c.y + 1 : c.y + 0.5;
    hidden = { c, back: { x: P.x, y: P.y, a: P.a }, a0: Math.atan2(c.dy, c.dx) };
    P.x = fx + c.dx * 0.04; P.y = fy + c.dy * 0.04; P.a = hidden.a0; vel = 0; clearStick();
    document.body.classList.add('hiding'); FP_SOUND.hide(true); learn('closet');
  }
  function leaveCloset() {
    if (!hidden) return;
    const c = hidden.c;
    P.x = c.x + 0.5; P.y = c.y + 0.5; P.a = hidden.a0; hidden = null;
    document.body.classList.remove('hiding'); FP_SOUND.hide(false);
  }
  $('stepOut').addEventListener('pointerdown', (e) => { e.stopPropagation(); leaveCloset(); });
  $('getUp').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); getUp(); });

  // a 3×5 hand for the walls: enough letters for a sentence, drawn doubled so a wall holds four
  // lines of eight
  const FONT = (() => {
    const G = {
      a: ['.#.', '#.#', '###', '#.#', '#.#'], b: ['##.', '#.#', '##.', '#.#', '##.'], c: ['.##', '#..', '#..', '#..', '.##'],
      d: ['##.', '#.#', '#.#', '#.#', '##.'], e: ['###', '#..', '##.', '#..', '###'], f: ['###', '#..', '##.', '#..', '#..'],
      g: ['.##', '#..', '#.#', '#.#', '.##'], h: ['#.#', '#.#', '###', '#.#', '#.#'], i: ['###', '.#.', '.#.', '.#.', '###'],
      j: ['..#', '..#', '..#', '#.#', '.#.'], k: ['#.#', '#.#', '##.', '#.#', '#.#'], l: ['#..', '#..', '#..', '#..', '###'],
      m: ['#.#', '###', '###', '#.#', '#.#'], n: ['##.', '#.#', '#.#', '#.#', '#.#'], o: ['.#.', '#.#', '#.#', '#.#', '.#.'],
      p: ['##.', '#.#', '##.', '#..', '#..'], q: ['.#.', '#.#', '#.#', '.#.', '..#'], r: ['##.', '#.#', '##.', '#.#', '#.#'],
      s: ['.##', '#..', '.#.', '..#', '##.'], t: ['###', '.#.', '.#.', '.#.', '.#.'], u: ['#.#', '#.#', '#.#', '#.#', '.#.'],
      v: ['#.#', '#.#', '#.#', '.#.', '.#.'], w: ['#.#', '#.#', '###', '###', '#.#'], x: ['#.#', '#.#', '.#.', '#.#', '#.#'],
      y: ['#.#', '#.#', '.#.', '.#.', '.#.'], z: ['###', '..#', '.#.', '#..', '###'], "'": ['.#.', '.#.', '...', '...', '...'],
      '.': ['...', '...', '...', '...', '.#.'], ',': ['...', '...', '...', '.#.', '#..'], '?': ['##.', '..#', '.#.', '...', '.#.'],
      '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
      '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
      '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
      '9': ['###', '#.#', '###', '..#', '##.'], '|': ['.#.', '.#.', '.#.', '.#.', '.#.'],
      '-': ['...', '...', '###', '...', '...'], '—': ['...', '...', '###', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
    };
    const out = {}; for (const k in G) out[k] = G[k].join(''); return out;
  })();
  const INK = TEX.hex('#2a2622'), CHALK = TEX.hex('#ece7da'), CHALK_BRIGHT = (TEX.hex('#fbf9f2') & 0xffffff) | 0xfd000000;   // the opening walls: pressed hard, the whitest of the stick, and catching the light (0xfd)
  function writeWords(d, text, R, chalked, big) {
    const lines = [];
    for (const w of text.toLowerCase().split(' ')) {
      if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= 8) lines[lines.length - 1] += ' ' + w; else lines.push(w);
    }
    // three-quarter size: 1.5 pixels to a stroke, not 2. Joe: "we need a tighter font on the wall writing. It almost always
    // bleeds off of the wall … reduce by [about] 25%". A full line of eight was the whole wall wide, edge to edge
    // the opening walls' two short lines are chalked at full size, bold enough to read in the dim of the start room; their
    // longest line is seven letters, which fits
    const sc = big && Math.max(...lines.map((l) => l.length)) <= 7 ? 2 : 1.5, lh = Math.round(6 * sc + 2), y0 = Math.round(DEC * 0.42 - lines.length * lh / 2);
    const px = (i) => Math.round(i * sc);   // stroke i's first pixel: 1 or 2 wide by turns
    lines.forEach((ln, li) => {
      const x0 = Math.round((DEC - ln.length * 4 * sc) / 2) + Math.round((R() - 0.5) * 4);
      for (let c = 0; c < ln.length; c++) {
        const g = FONT[ln[c]]; if (!g) continue;
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '#')
          for (let yy = px(r); yy < px(r + 1); yy++) for (let xx = px(c * 4 + q); xx < px(c * 4 + q + 1); xx++) {
            const X = x0 + xx, Y = y0 + li * lh + yy + (c % 3 === 1 ? 1 : 0);   // a hand, not a printer
            if (X >= 0 && X < DEC && Y >= 0 && Y < DEC && R() < (chalked ? 0.93 : 0.97)) d[Y * DEC + X] = chalked ? CHALK_BRIGHT : INK;   // chalk catches the wall unevenly
          }
      }
    });
  }
  // a chalk sign on a wall, centred where it was tapped: an X, a ?, or an arrow
  function chalkSign(d, glyph, cu, cv) {
    const cx = cu * DEC, cy = cv * DEC, r = 7;
    const dot = (x, y) => { for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) { const X = Math.round(x) + xx, Y = Math.round(y) + yy; if (X >= 0 && X < DEC && Y >= 0 && Y < DEC && Math.random() < 0.85) d[Y * DEC + X] = CHALK; } };
    const line = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n + (Math.random() - 0.5) * 0.8, y0 + (y1 - y0) * i / n + (Math.random() - 0.5) * 0.8); };
    if (glyph === 'x') { line(cx - r, cy - r, cx + r, cy + r); line(cx + r, cy - r, cx - r, cy + r); }
    else if (glyph === '?') { line(cx - 4, cy - 5, cx, cy - 8); line(cx, cy - 8, cx + 4, cy - 5); line(cx + 4, cy - 5, cx, cy); line(cx, cy, cx, cy + 3); dot(cx, cy + 7); }
    else {
      const [ax, ay] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[glyph];
      const tx = cx + ax * r, ty = cy + ay * r;
      line(cx - ax * r, cy - ay * r, tx, ty);
      line(tx, ty, tx - ax * 5 + ay * 5, ty - ay * 5 + ax * 5); line(tx, ty, tx - ax * 5 - ay * 5, ty - ay * 5 - ax * 5);
    }
  }
  function hud() {
    $('hudChalk').textContent = S.chalkInf ? '∞' : chalk;
    $('hudCharcoal').textContent = charcoalN;
    $('hudPages').textContent = pagesFound + ' / ' + pagesTotal;
    $('hudCharcoalBox').style.display = charcoalN ? '' : 'none';
    $('hudWatchBox').style.display = carried.has('watch') ? '' : 'none';
    $('hudBookBox').style.display = carried.has('book') ? '' : 'none';
    $('hudMatchesBox').style.display = carried.has('matches') ? '' : 'none';
  }
  // what you carry: things you pick up that aren't used up — the watch, for now. Joe: "We should make the watch
  // collectible that you pick up and then hold in your inventory. You can see on your hud. When we bring back in the
  // statues and the offerings, perhaps we offer the watch." It goes with you up and down the stairs; a new maze empties it
  let carried = new Set();
  // the watch in hand at his chair before the heart: why it won't go down yet
  const notYetHere = (E) => [E.slotHolding, E.slotNotYet].filter(Boolean).join(' ');
  function take(o, walked) {
    if (o.kind === 'deco') return;
    if (o.kind === 'slot') {
      if (walked) return;
      const E = endingText();
      if (carried.has('watch') && heartSeen()) leaveWatch(o);
      else if (E) showNote(carried.has('watch') ? notYetHere(E) : E.slotEmpty);
      return;
    }
    // his chair with no slot beside it takes the watch itself, and says the same
    if (o.kind === 'note' && o.seat && !walked && carried.has('watch') && !heartSeen() && !story.some((q) => q.slot) && endingText()) { showNote(notYetHere(endingText())); return; }
    if (o.kind === 'note' && o.seat && !walked && carried.has('watch') && heartSeen() && !story.some((q) => q.slot)) { leaveWatch(o); return; }
    if (o.kind === 'note') { if (!walked || !o.shown) { o.shown = true; showNote(o.text); } return; }   // read where it lies, never taken
    if (o.kind === 'ball') { if (!walked && !o.fly) pickBall(o); return; }   // picked up to throw, never kept
    if (o.kind === 'cards') { if (!walked) useMemory(o.mem); return; }
    if (o.kind === 'toolbox') { if (!walked) openToolbox(o.mem); return; }
    if (o.kind === 'pile') { if (!walked && carried.has('matches')) useMemory(o.mem); return; }   // lit with the matches you took
    if (o.kind === 'kidBook') { if (!walked) openBook(); return; }   // read on the bed
    if (o.kind === 'shelfGap') { if (!walked) shelveBook(); return; }   // a memory room's thing: played, never taken
    objs.splice(objs.indexOf(o), 1); foundAt = performance.now(); taken.add(objKey(o));
    if (o.kind === 'chalk') { chalk += CONFIG.chalkPerPickup; flash('hudChalkBox'); FP_SOUND.chalkUp(); }
    else if (o.kind === 'chalkPile') { chalk += CONFIG.chalkPerPickup * 4; flash('hudChalkBox'); FP_SOUND.chalkUp(); }
    else if (o.kind === 'charcoal') { charcoalN++; flash('hudCharcoalBox'); FP_SOUND.charcoalUp(); }
    else if (o.kind === 'watch') { carried.add('watch'); flash('hudWatchBox'); giveJournal(o.text); }
    else if (o.kind === 'matches') { carried.add('matches'); flash('hudMatchesBox'); FP_SOUND.chalkUp(); }   // into your pocket
    else if (o.kind === 'page') { addFind(); pagesFound++; flash('hudPagesBox'); showPage(o.pg, o.text); FP_SOUND.page();
      if (o.mem && o.mem.closet && !o.mem.done && !o.mem.coming) o.mem.coming = { t0: 0 };
      if (o.mem && o.mem.mem === 'fire') o.mem.read = true; }   // the fire room's: and now the toolbox opens   // the hiding room's: and now he's coming
    hud();
  }
  // Joe: "any instance where you have to do a thing to get the game to progress, we should give you a journal for once you do
  // it." The heart opening, the watch taken, the watch left: each a journal, counted with the rest (PROGRESS_PAGES of them)
  const PROGRESS_PAGES = 3;
  function giveJournal(text) {
    if (!text) return;
    addFind(); pagesFound++; flash('hudPagesBox'); showPage(-1, text); FP_SOUND.page(); hud();
  }
  function flash(id) { const el = $(id); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  // a page, or a note, stays up until you tap off it, and while it's up you're reading: you don't move,
  // the HUD steps away, and nothing in the building comes for you. Joe: "For all the popup journal text
  // don't have it go away until the user taps off of the journal page. Disable movement and other hud
  // features while it's active." A tap on the paper itself does nothing.
  let reading = false;
  // something picked up while a page is already up waits its turn, rather than replacing it: Joe saw "the text of one
  // journal for a second then switches to another journal text" — two things read in the same moment
  let pageQueue = [];
  function openPage() {
    reading = true; clearStick(); vel = 0; anim = null; queued = null;
    for (const k of Object.keys(keys)) keys[k] = false;
    $('page').classList.add('show'); document.body.classList.add('reading');
  }
  function showPage(pg, own) {
    const text = own || (character && character.pages ? character.pages[pg] : '');
    if (reading) { pageQueue.push(text || '…'); return; }
    $('pageText').textContent = text || '…';
    $('pageWho').textContent = '';   // Joe: "The note from the kid wouldn't be signed … at all"
    openPage();
  }
  // A chapter with FP_PAGES (data/text.js) has its pages in places: the start room, each story room, the kid's
  // room. They replace the generator's own, which lie wherever; the floors above have none. A place the maze didn't
  // make keeps one of the generator's spots instead, so the count is always the chapter's.
  const placedPages = () => typeof FP_PAGES !== 'undefined' && character && FP_PAGES[character.name] ? FP_PAGES[character.name] : null;
  function placePages() {
    const PG = placedPages(); if (!PG) return;
    const spare = objs.filter((o) => o.kind === 'page' && !o.memPage);
    objs = objs.filter((o) => o.kind !== 'page' || o.memPage);   // a memory room's journal stays where it was put
    if (floor !== 1) { pagesTotal = Object.keys(PG).length; return; }
    const blocked = (x, y) => fboxes.some((b) => b.x0 < x + 0.2 && b.x1 > x - 0.2 && b.y0 < y + 0.2 && b.y1 > y - 0.2);
    const free = (k) => { const x = k % W + 0.5, y = ((k / W) | 0) + 0.5; return !solid(k % W, (k / W) | 0) && !low[k] && !blocked(x, y) && !objs.some((o) => Math.floor(o.x) === k % W && Math.floor(o.y) === ((k / W) | 0)); };
    const farthest = (tiles, fromK) => { let best = -1, bd = -1; for (const k of tiles) if (free(k)) { const d = Math.hypot(k % W - fromK % W, ((k / W) | 0) - ((fromK / W) | 0)); if (d > bd) { bd = d; best = k; } } return best; };
    const at = {};
    const sk = Math.floor(start.y) * W + Math.floor(start.x);
    at.start = sk;   // moved in front of you once you're lying on the mat (reset)
    for (const st of story) {
      const mk = st.m.my * W + st.m.mx;
      if (st.kind === 'waiting' || st.kind === 'wall') at[st.kind] = farthest(st.tiles, mk);
      // Joe: "The journal that says 'cross them out for me' needs to go in the room you cross the words out. Right now it's in the
      // chair room." The waiting room's page is in the wall's room, then, just inside the way in; the wall's own at the far end
      if (st.kind === 'wall') { const near = st.tiles.filter((k) => free(k) && k !== at.wall).sort((a, b) => Math.hypot(a % W - mk % W, ((a / W) | 0) - ((mk / W) | 0)) - Math.hypot(b % W - mk % W, ((b / W) | 0) - ((mk / W) | 0)));
        if (near.length) at.waitingIn = near[0]; }
      if (st.kind === 'heart') at.heart = farthest(heart.room.filter((k) => k !== heart.mid), heart.tip);   // off to the side: the watch has the middle
    }
    if (at.waitingIn !== undefined) at.waiting = at.waitingIn;
    const sec = secretSet();
    if (sec) { const [fx, fy] = typeof secretFather === 'string' && secretFather ? secretFather.split(',').map(Number) : [-1, -1]; at.kid = fy >= 0 && free(fy * W + fx) ? fy * W + fx : farthest([...sec], sk); }
    let n = 0; const used = new Set();
    for (const [place, text] of Object.entries(PG)) {
      let k = at[place], x, y;
      if (k !== undefined && k >= 0 && used.has(k)) k = -1;   // two places never share a tile
      if (k >= 0) used.add(k);
      if (k === undefined || k < 0) { const o = spare[n % Math.max(1, spare.length)]; if (!o) continue; x = o.x; y = o.y; }
      else { x = k % W + 0.5; y = ((k / W) | 0) + 0.5; }
      objs.push({ x, y, kind: 'page', pg: n++, place, text, tex: TEX.sprites.book, h: 0.3, glow: 0.35 });
    }
    // the memory rooms' journals are pages like the rest: picked up, counted, and in the total. Joe: "The journal for the
    // phone doesn't get collected … I think you need to update your count for the new journals you made"
    pagesTotal = Object.keys(PG).length + objs.filter((o) => o.memPage).length + (heart ? (story.some((q) => q.lieFaces) ? 1 : 0) + 1 + (story.some((q) => q.chair) ? 1 : 0) : 0);   // the heart opening, the watch, the watch left (PROGRESS_PAGES)
  }
  // the chapter's pages are spread across its floors, not a set on each. Joe: "Spread journals across all floors."
  // Every floor's generator lays out the whole set; each keeps only its share, dealt round like cards — page 1 on
  // floor 1, page 2 on floor 2, and so on — so the count, which goes with you up and down, is out of the chapter's
  // pages, and going up is part of finding them
  function spreadPages() {
    pagesAll = journals.size;
    const F = Math.max(1, Math.round(S.floors));
    if (F <= 1) return;
    const order = [...new Set(journals.values())].sort((a, b) => a - b);
    for (const [key, pg] of [...journals]) if (order.indexOf(pg) % F !== floor - 1) journals.delete(key);
  }
  function hidePage() {
    reading = false; $('page').classList.remove('show'); document.body.classList.remove('reading');
    if (pageQueue.length) { const t = pageQueue.shift(); setTimeout(() => { $('pageText').textContent = t; $('pageWho').textContent = ''; openPage(); FP_SOUND.page(); }, 350); }
  }
  $('page').addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (e.target.closest('#page > div')) return;   // on the paper: keep reading
    hidePage();
  });

  // ── the top-down's debug, for this view ───────────────────
  // Joe: "can we bring over some of the debug functions now that we have on the top down version that
  // would be useful here?" Level, stones, the prototypes and the maze's own shape knobs, as the
  // top-down has them. They are written into SAVE in memory just before each build and never
  // persisted: testing a chapter in here must not move the top-down's progress. Level "save" means
  // whatever the top-down save says.
  const LEVELS = [];
  PHASES.forEach((ph, i) => {
    LEVELS.push({ label: i + ' · ' + ph.who, phase: i, stones: i, pool: false });
    if (i < STONES.length) LEVELS.push({ label: '↳ pool · ' + STONES[i], phase: i, stones: i, pool: true });
  });
  const MAZE_KEYS = ['proto', 'size', 'branch', 'turns', 'clusters', 'braid'];
  // what the top-down save itself says, kept so "From my save" can put it back
  const SAVE0 = { phase: SAVE.phase, stones: SAVE.stones, poolPending: SAVE.poolPending, ui: Object.fromEntries(MAZE_KEYS.map((k) => [k, SAVE.ui[k]])) };
  function applyMazeDebug() {
    const L = S.dbgLevel === 'save' ? null : LEVELS[+S.dbgLevel];
    SAVE.phase = L ? L.phase : SAVE0.phase; SAVE.poolPending = L ? L.pool : SAVE0.poolPending; SAVE.stones = L ? L.stones : SAVE0.stones;
    if (S.dbgStones !== 'level') SAVE.stones = +S.dbgStones;
    for (const k of MAZE_KEYS) SAVE.ui[k] = S['dbg_' + k] === 'auto' && k !== 'proto' ? SAVE0.ui[k] || 'auto' : S['dbg_' + k];
  }
  function newMaze(seed) {
    SEED = seed || (Math.random() * 1e9 | 0);
    BASE = SEED; floor = 1; floorStates = new Map(); taken = new Set(); carried = new Set(); liesStruck = new Set(); heartOpened = false; watchLeft = false; kidMet = false; pageQueue = []; seated = null; document.body.classList.remove('seated', 'book'); turned = false; builtTurned = false; finds = 0; turnAt = -1e9;
    try { history.replaceState(null, '', location.pathname + '?seed=' + SEED); } catch (e) {}
    applyMazeDebug();
    generate(SEED); thinSqueezes(); carveHeart(); spreadPages(); reset(); startWake();
    FP_SOUND.setMusic(track());
  }

  // every time the tile underfoot changes: count it, chart it for the debug map, check the door
  function arrive() {
    if (hidden) return;
    const tx = Math.floor(P.x), ty = Math.floor(P.y), k = tx + ',' + ty;
    if (k === lastTile) return;
    if (lastTile) steps++;
    lastTile = k;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) seen[y * W + x] = 1;
    }
    for (const o of objs.slice()) if (Math.floor(o.x) === tx && Math.floor(o.y) === ty) take(o, true);
    // debug: up a floor, the way out drawn on the floor is from here to the door marked down
    if (floor > 1 && S.showPath && stairs.down && pathMask) {
      const from = ty * W + tx, to = stairs.down.y * W + stairs.down.x, prev = new Int32Array(W * H).fill(-1), q = [from]; prev[from] = from;
      for (let i = 0; i < q.length && prev[to] < 0; i++) { const c = q[i], x = c % W, y = (c / W) | 0; for (const [dx, dy] of HD) { const n = c + dy * W + dx; if (!solid(x + dx, y + dy) && prev[n] < 0) { prev[n] = c; q.push(n); } } }
      pathMask.fill(0); if (prev[to] >= 0) for (let c = to; ; c = prev[c]) { pathMask[c] = 1; if (c === from) break; }
    }
  }
  // Joe: "I want to get closer to the exit before it stops me. Right now it feels like I'm over a tile
  // away from it. I wanna get right up to the door." It used to end the moment you set foot on the
  // exit tile, a tile short of the doorway at its far side. Now it's when you're up against the door:
  // within EXIT_REACH of its face, which is as near as your body lets you stand, give or take.
  const EXIT_REACH = 0.3;
  function checkExit() {
    if (floor > 1 || hidden || Math.floor(P.x) !== exit.x || Math.floor(P.y) !== exit.y) return;
    if (exitLocked && !exitOpen()) { const t = performance.now(); if (t - rattleAt > 1800) { rattleAt = t; FP_SOUND.locked(); } return; }   // not yet
    if (!exitDir) { win(); return; }
    const [dx, dy] = exitDir;
    const gap = dx ? (dx > 0 ? exit.x + 1 - P.x : P.x - exit.x) : (dy > 0 ? exit.y + 1 - P.y : P.y - exit.y);
    if (gap < EXIT_REACH) win();
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
    if (won || reading || rising) return;
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
  // Joe: "whether it's assist in the hallway or not, I always feel like I'm walking around drunk,
  // bumping into corners." Both were free movement with a pull added — so the fix is not a stronger
  // pull, it's the top-down's own model: rails in halls, free in rooms.
  //
  // In a hall you face one of the four ways and slide along it, centred. Up walks, down backs off.
  // Lean the stick sideways and the turn is *buffered*, the way the top-down's are: nothing happens
  // until you reach the middle of a tile with an opening that way, then you swing into it without
  // stopping. Standing still, a lean turns you on the spot. A wall ahead stops you in the middle of
  // the tile, not with your nose on the brick. In a room, you walk free — with a round body that
  // slides off corners instead of catching on them.
  const stick = { on: false, x: 0, y: 0 };
  const RAD = 0.2;   // how wide you are, in tiles
  let railTurn = null, pendTurn = 0, pendUntil = 0, pendArmed = true, turnEnd = 0, wasRail = false;

  // push a round body out of any wall it has sunk into; it slides round corners by construction
  // what you're standing on: the floor, or the top of the highest step under you, and your eye goes up with it (lift)
  const STEP_UP = 0.08;
  let lift = 0, liftT = 0;
  // (with `r`, the highest your feet are on: a step is shallower than you are wide, so it's the one you've got a foot on)
  function standOn(x, y, r = 0) {
    let z = 0;
    for (const b of fboxes) if (b.step && x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r && b.z1 > z) z = b.z1;
    return z;
  }
  function collide() {
    const tx = Math.floor(P.x), ty = Math.floor(P.y);
    // at a squeeze — in one, or beside one — you turn sideways and fit it, just. Everywhere else you
    // are your full width, so an ordinary hall never lets you press your face to the wallpaper
    let nearSlot = false;
    for (let yy = ty - 1; yy <= ty + 1 && !nearSlot; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) if (slots.has(yy * W + xx)) { nearSlot = true; break; }   // squeezes only, not door frames
    const r = nearSlot ? Math.max(0.03, Math.min(RAD, S.gapW / 2 - 0.02)) : RAD;
    const push = (x0, y0, x1, y1) => {
      const cx = Math.max(x0, Math.min(P.x, x1)), cy = Math.max(y0, Math.min(P.y, y1));
      const dx = P.x - cx, dy = P.y - cy, d = Math.hypot(dx, dy);
      if (d < r && d > 1e-6) { P.x = cx + dx / d * r; P.y = cy + dy / d * r; }
    };
    // a door's leaf is a wall too, open or shut
    for (const d of doors) {
      if (!d.seg || Math.abs(d.x + 0.5 - P.x) > 2 || Math.abs(d.y + 0.5 - P.y) > 2) continue;
      const [ax, ay, bx, by] = d.seg, vx = bx - ax, vy = by - ay;
      const s2 = Math.max(0, Math.min(1, ((P.x - ax) * vx + (P.y - ay) * vy) / (vx * vx + vy * vy)));
      const cx = ax + vx * s2, cy = ay + vy * s2, ex = P.x - cx, ey = P.y - cy, dd = Math.hypot(ex, ey);
      if (dd < RAD && dd > 1e-6) { P.x = cx + ex / dd * RAD; P.y = cy + ey / dd * RAD; }
    }
    // furniture: a box on the floor, with the same round-body push as a wall
    // a step (the dais's) is only in the way if it's more than STEP_UP over what you're standing on: you go up it
    const under = standOn(P.x, P.y, r * 0.7);
    for (const b of fboxes) if (!b.flat && b.z0 < S.eye && !(b.step && b.z1 <= under + STEP_UP) && b.x1 > P.x - 1 && b.x0 < P.x + 1 && b.y1 > P.y - 1 && b.y0 < P.y + 1) push(b.x0, b.y0, b.x1, b.y1);
    for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) {
      if (solid(xx, yy)) { push(xx, yy, xx + 1, yy + 1); continue; }
      const bx = boxesAt(yy * W + xx);
      if (bx) for (let i = 0; i < bx.length; i += 4) push(bx[i], bx[i + 1], bx[i + 2], bx[i + 3]);
    }
  }

  function stickMove(now, dt) {
    if (reading || rising || seated) { vel = 0; return; }
    if (hidden) {   // in a closet you don't move; the stick looks about, a little, through the slats
      const want = hidden.a0 + stick.x * 0.45 + ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 0.45;
      P.a += (want - P.a) * Math.min(1, dt * 6);
      return;
    }
    const mag = Math.hypot(stick.x, stick.y), dz = Math.min(0.9, S.deadzone);
    // held keys are a stick too: W/S or ↑/↓ walk while held, A/D or ←/→ turn, and with Shift held
    // (or Q/E) A/D sidestep instead. Joe: "holding the back arrow key on the PC should keep me moving
    // backwards", and "on PC we should allow Shift and WASD to allow strafe"
    const kFwd = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
    const kSide = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const kStrafe = (keys.sright ? 1 : 0) - (keys.sleft ? 1 : 0) + (keys.shift ? kSide : 0);
    const kTurn = keys.shift ? 0 : kSide;
    const keyed = kFwd || kTurn || kStrafe;
    const live = (stick.on && mag > dz) || !!keyed;
    let fwd = 0, sx = 0, st = 0;
    if (live) {
      anim = null; queued = null; holdFwd = false;
      if (stick.on && mag > dz) {
        const k = Math.min(1, (mag - dz) / (1 - dz)) / mag;   // deadzone taken out, so the edge of it is zero, not a jump
        sx = stick.x * k; fwd = -stick.y * k;
      }
      fwd = Math.max(-1, Math.min(1, fwd + kFwd)); sx = Math.max(-1, Math.min(1, sx + kTurn)); st = Math.max(-1, Math.min(1, kStrafe));
    } else if (anim) { vel = 0; railTurn = null; return; }   // a tap or a swipe is driving
    const tx = Math.floor(P.x), ty = Math.floor(P.y);
    const rail = S.move === 'rails' && !room[ty * W + tx];
    if (rail) railMove(now, dt, live, fwd, sx, tx, ty); else freeMove(dt, live, fwd, sx, st);
    wasRail = rail;
  }

  let turnVel = 0;   // how fast the view is actually turning, eased, so a flick of the thumb is never a jerk
  let sideVel = 0;   // sidestepping, eased the same way as walking
  function freeMove(dt, live, fwd, sx, st = 0) {
    railTurn = null;
    const slow = low[Math.floor(P.y) * W + Math.floor(P.x)] ? S.squeezeSlow : 1;   // a squeeze is a squeeze: slower through it
    vel += (fwd * S.walk * slow - vel) * Math.min(1, dt * S.accel);
    sideVel += (st * S.walk * 0.85 - sideVel) * Math.min(1, dt * S.accel);
    if (Math.abs(sideVel) > 0.001) {
      const d = sideVel * dt, n = Math.max(1, Math.ceil(Math.abs(d) / 0.08));
      for (let i = 0; i < n; i++) { P.x += -Math.sin(P.a) * d / n; P.y += Math.cos(P.a) * d / n; collide(); }
    }
    const want = Math.sign(sx) * Math.abs(sx) ** 1.6 * S.stickTurn * Math.PI / 180;   // gentle near the middle, quick at the rim
    turnVel += (want - turnVel) * Math.min(1, dt * S.turnEase);
    if (!live && Math.abs(vel) < 0.001 && Math.abs(turnVel) < 0.001) { vel = 0; turnVel = 0; return; }
    P.a += turnVel * dt;
    if (S.move === 'glide') glideHelp(dt, Math.abs(sx));
    // in small pieces, so a fast walk can never step clean through a corner
    const dist = vel * dt, n = Math.max(1, Math.ceil(Math.abs(dist) / 0.08));
    for (let i = 0; i < n; i++) { P.x += Math.cos(P.a) * dist / n; P.y += Math.sin(P.a) * dist / n; collide(); }
    if (S.move === 'glide' && S.slip > 0) whiskers(dt);
  }

  // ── glide: free, with help that never takes the wheel ─────
  // Joe, on rails: "now I have to be very specific when I turn into a hallway and it's kind of
  // jittery on how it jumps me to another angle." And on free: "walking around drunk, bumping into
  // corners." Glide is the difference split. You steer, always, smoothly. Three quiet things help,
  // each with its own knob in the Glide section of the panel, and none of them ever a snap:
  //   settle   — ease off the turn while roughly facing an open way (a side hall counts), and the
  //              view drifts the last few degrees square to it
  //   centre   — in a one-wide hall, walking drifts you toward the middle of it
  //   whiskers — two feelers ahead; one on a wall corner and the other clear slides you sideways
  //              past it, so you pass into a doorway instead of clipping its edge
  function glideHelp(dt, steer) {
    const tx = Math.floor(P.x), ty = Math.floor(P.y), WINDOW = S.settleDeg * Math.PI / 180;
    if (room[ty * W + tx] || Math.abs(vel) < 0.05) return;   // a room is yours to wander; standing still needs no help
    // steering hard switches it off; it fades back in as the thumb comes to the middle
    const hands = Math.max(0, 1 - steer * 2.2);
    if (hands > 0 && S.settle > 0) {
      let best = 9, target = 0;
      HD.forEach(([dx, dy], h) => {
        if (solid(tx + dx, ty + dy)) return;
        let d = h * QUARTER - P.a; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < Math.abs(best)) { best = d; target = d; }
      });
      if (Math.abs(best) < WINDOW) {
        // strongest in the middle of the window, fading to nothing at its edge, so there is no
        // line you cross where it suddenly starts pulling
        const edge = 1 - Math.abs(target) / WINDOW;
        P.a += target * Math.min(1, dt * 4.2 * S.settle * hands * (0.35 + edge));
      }
    }
    // a hall: open along one axis only. Drift to its middle, as fast as you're walking
    const ew = !solid(tx - 1, ty) || !solid(tx + 1, ty), ns = !solid(tx, ty - 1) || !solid(tx, ty + 1);
    if (ew !== ns && S.centre > 0) {
      const along = ew ? Math.abs(Math.cos(P.a)) : Math.abs(Math.sin(P.a));
      if (along > 0.8) {
        const k = Math.min(1, dt * 3.2 * S.centre * Math.abs(vel) * (along - 0.8) * 5);
        if (ew) P.y += (ty + 0.5 - P.y) * k; else P.x += (tx + 0.5 - P.x) * k;
      }
    }
  }
  function whiskers(dt) {
    if (vel < 0.05) return;
    const L = 0.55, spread = 0.5;
    const feel = (o) => solidAt(P.x + Math.cos(P.a + o) * L, P.y + Math.sin(P.a + o) * L);   // jambs count: it steers you into a squeeze
    const hitL = feel(-spread), hitR = feel(spread);
    if (hitL === hitR) return;   // both clear, or a wall square ahead: nothing to slip past
    const side = hitL ? 1 : -1;  // touch on the left: slide right
    const k = vel * dt * 0.9 * S.slip;
    P.x += -Math.sin(P.a) * side * k; P.y += Math.cos(P.a) * side * k;
    collide();
  }

  function railMove(now, dt, live, fwd, sx, tx, ty) {
    const cx = tx + 0.5, cy = ty + 0.5;
    // coming into a hall from a room: face down it, whichever way along it is nearest where you look
    if (!wasRail && !railTurn) {
      let best = -9, ta = P.a;
      HD.forEach(([dx, dy], h) => {
        const t = h * QUARTER + Math.round((P.a - h * QUARTER) / (2 * Math.PI)) * 2 * Math.PI;
        const sc = Math.cos(t - P.a) + (solid(tx + dx, ty + dy) ? 0 : 0.35);
        if (sc > best) { best = sc; ta = t; }
      });
      if (Math.abs(ta - P.a) > 0.01) { railTurn = { t0: now, dur: 160, fa: P.a, ta }; pendTurn = 0; }
    }
    // the stick's lean, held as a wish: -1 left, 1 right. It outlives the lean by the top-down's own
    // turnBufferMs, so letting go a moment before the opening still takes it. Come back to the
    // middle to re-arm, so one lean is one turn — except standing still, where holding keeps turning
    const leaning = live && Math.abs(sx) > 0.45;
    if (!live || Math.abs(sx) < 0.25) { pendArmed = true; if (pendTurn && now > pendUntil) pendTurn = 0; }
    else if (leaning && (pendArmed || (Math.abs(vel) < 0.05 && now - turnEnd > 280))) { pendTurn = sx > 0 ? 1 : -1; pendArmed = false; }
    if (leaning && pendTurn) pendUntil = now + CONFIG.turnBufferMs;

    const centre = () => { const k = Math.min(1, dt * 12); if (Math.abs(Math.cos(P.a)) > 0.5) P.y += (cy - P.y) * k; else P.x += (cx - P.x) * k; };
    if (railTurn) {
      const k = Math.min(1, (now - railTurn.t0) / railTurn.dur);
      P.a = railTurn.fa + (railTurn.ta - railTurn.fa) * EASE.io(k);
      if (k >= 1) { P.a = railTurn.ta; railTurn = null; turnEnd = now; }
      // keep a little way on through the turn, so taking a corner doesn't feel like a stop
      vel *= 1 - Math.min(1, dt * 6);
      return;
    }
    const base = Math.round(P.a / QUARTER) * QUARTER, h = headingOf(P.a);
    P.a = base;
    const [dx, dy] = HD[h];
    centre();
    const horiz = dx !== 0, sgn = dx || dy, mid = horiz ? cx : cy;
    let before = (horiz ? P.x : P.y) - mid;
    // stopped at a wall and still pushing into it: you are standing still, not about to move. Snap
    // the last hair to the exact middle, or "reached the middle" never quite comes true
    const wallAhead = Math.abs(before) < 0.02 && solid(tx + dx, ty + dy);
    if (wallAhead) { before = 0; if (horiz) P.x = mid; else P.y = mid; }
    vel = wallAhead && fwd > 0 && vel >= 0 ? 0 : vel + (fwd * S.walk * (low[ty * W + tx] ? S.squeezeSlow : 1) - vel) * Math.min(1, dt * S.accel);
    let after = before + vel * dt * sgn;
    // standing still — or stopped at a wall — and leaning: turn on the spot
    if (pendTurn && leaning && Math.abs(vel) < 0.05 && (fwd < 0.2 || wallAhead)) {
      railTurn = { t0: now, dur: S.turnMs, fa: P.a, ta: base + pendTurn * QUARTER }; pendTurn = 0; return;
    }
    const reached = Math.abs(before) < 1e-4 || Math.sign(before) !== Math.sign(after) || Math.abs(after) < 1e-4;
    if (reached && pendTurn) {
      const [ox, oy] = HD[(h + pendTurn + 4) % 4];
      if (!solid(tx + ox, ty + oy)) {   // the buffered turn takes the first opening it's offered
        if (horiz) P.x = cx; else P.y = cy;
        railTurn = { t0: now, dur: S.turnMs * 0.85, fa: P.a, ta: base + pendTurn * QUARTER }; pendTurn = 0; return;
      }
    }
    // a bend with only one way on: the hall carries you round it. A junction still waits for you
    if (reached && S.bends && vel > 0.05 && solid(tx + dx, ty + dy)) {
      const r = HD[(h + 1) % 4], l = HD[(h + 3) % 4];
      const ro = !solid(tx + r[0], ty + r[1]), lo = !solid(tx + l[0], ty + l[1]);
      if (ro !== lo) {
        if (horiz) P.x = cx; else P.y = cy;
        // and it spends any lean you had buffered: the hall already took you the only way there is
        railTurn = { t0: now, dur: S.turnMs * 0.85, fa: P.a, ta: base + (ro ? 1 : -1) * QUARTER }; pendTurn = 0; return;
      }
    }
    // a wall the way you're going: stop in the middle of the tile
    const going = Math.sign(vel * sgn);
    if (going && Math.sign(after) === going && solid(tx + (horiz ? going : 0), ty + (horiz ? 0 : going))) { after = 0; vel = 0; }
    if (horiz) P.x = mid + after; else P.y = mid + after;
  }

  // ── the father ────────────────────────────────────────────
  // From Joe's notes: "A figure appears at the far edge of your light, in a corridor ahead, already
  // walking away from you at about your speed; he turns a corner and is gone. If you chase, he's gone
  // before you get there, every time. Never nearer, never reachable, never acknowledges you. Once or
  // twice a maze. He should show up disproportionately when you've just found something." And the
  // first-person version we settled on: glimpsed crossing a T-intersection ahead of you.
  //
  // So he is not placed in the maze; he happens. Now and then, looking straight down a hall, the game
  // looks for a lit opening 3–7 tiles ahead with nothing shut or squeezed between you, and walks him
  // through it at your walking pace, on one of two paths:
  //   across — a crossing with a way off both sides: out of one side hall, over, into the other;
  //   away   — out of a side opening into your hall, turning away from you, down it, and off at the
  //            next junction on. "Already walking away from you … he turns a corner and is gone."
  // He always walks in from somewhere you can't see, so he never appears out of nothing, and the walls
  // hide him again once he has turned. Come within FATHER_NEAR of him and he thins out and is gone.
  // `father` a maze, at least FATHER_GAP apart. A good view is rare, so once he's due he takes most
  // of them; and for a while after you take something, he is almost sure to be there when you look up.
  const FATHER_H = 0.92, FATHER_NEAR = 2.2, FATHER_GAP = 60000;
  const FS = { near: 3, far: 7, lit: 0.22, off: 0.35 };
  let father = null, fatherLeft = 0, fatherNext = 0, fatherCheck = 0, foundAt = -1e9, fatherForce = false;
  function fatherReset() { darter = null; dartSeen = new Set(); dartNext = performance.now() + 15000; father = null; fatherLeft = S.father; fatherNext = performance.now() + 20000; foundAt = -1e9; }
  const shutDoorAt = (k) => frameAt && frameAt[k] && doors.some((d) => d.k === k && d.t < 0.95);
  const clearAt = (x, y) => !solid(x, y) && !low[y * W + x] && !shutDoorAt(y * W + x);
  // the paths he could take from here, as tile-centre waypoints; [] if none
  function fatherSpot() {
    const h = headingOf(P.a); let off = P.a - h * QUARTER; off = Math.atan2(Math.sin(off), Math.cos(off));
    if (Math.abs(off) > FS.off) return null;   // looking down the hall, not at a wall of it
    const [dx, dy] = HD[h], qx = -dy, qy = dx, tx = Math.floor(P.x), ty = Math.floor(P.y), out = [];
    const c = (x, y) => [x + 0.5, y + 0.5];
    for (let n = 1; n <= FS.far; n++) {
      const x = tx + dx * n, y = ty + dy * n, k = y * W + x;
      if (!clearAt(x, y)) break;
      if (n < FS.near || room[k] || inHeart(k) || tileL[k] < FS.lit) continue;   // not on top of you, not in a room, not in the dark
      const sides = [1, -1].filter((sd) => clearAt(x + sd * qx, y + sd * qy));
      if (sides.length === 2) {   // across
        const sd = Math.random() < 0.5 ? 1 : -1;
        out.push([[x + 0.5 + sd * qx * 1.4, y + 0.5 + sd * qy * 1.4], c(x, y), [x + 0.5 - sd * qx * 1.5, y + 0.5 - sd * qy * 1.5]]);
      }
      for (const sd of sides) {   // away: out of this opening, down the hall, off at the next junction
        for (let m = 1; m <= 8; m++) {
          const ax = x + dx * m, ay = y + dy * m;
          if (!clearAt(ax, ay)) break;
          const turn = [1, -1].filter((t) => clearAt(ax + t * qx, ay + t * qy));
          if (!turn.length) continue;
          const t = turn[Math.floor(Math.random() * turn.length)];
          out.push([[x + 0.5 + sd * qx * 1.4, y + 0.5 + sd * qy * 1.4], c(x, y), c(ax, ay), [ax + 0.5 + t * qx * 1.5, ay + 0.5 + t * qy * 1.5]]);
          break;
        }
      }
    }
    return out.length ? out[Math.floor(Math.random() * out.length)] : null;
  }
  // ── the squeeze scare ─────────────────────────────────────
  // Joe: "When you're in a squeeze and slow down, we could easily have something move across the exit
  // point very quickly and then disappear. This of course would scare the player good." Pushing
  // through a squeeze toward its far end, now and then (`squeezeScare` a squeeze, at most once each,
  // DART_GAP apart) a shape whips across the opening you're heading for and is gone. It is the
  // father's own figure at DART_SPEED — a blink, through a slit. Joe: "the one that moves right in front
  // of the squeeze [should be] tinted all black." It was pale for a version, because the veil made a
  // black shape hard to see; it is drawn over the veil so the black reads against what light is there.
  const DART_SPEED = 4.5, DART_GAP = 90000;
  let darter = null, dartNext = 0, dartSeen = new Set(), dartForce = false;
  function dartFrame(now, dt) {
    if (darter) {
      const d = darter; d.x += d.vx * dt; d.y += d.vy * dt; d.walked += DART_SPEED * dt;
      d.tex = TEX.sprites.father[Math.floor(d.walked / 0.25) & 1];
      if (d.walked >= d.len) darter = null;
      return;
    }
    const tx = Math.floor(P.x), ty = Math.floor(P.y), k = ty * W + tx;
    if (!low[k] || inHeart(k) || hidden || (!dartForce && (now < dartNext || dartSeen.has(k)))) return;
    const h = headingOf(P.a); let off = P.a - h * QUARTER; off = Math.atan2(Math.sin(off), Math.cos(off));
    if (Math.abs(off) > 0.4 || vel < 0.05) return;
    // the far end: the first open tile ahead past the squeeze
    const [dx, dy] = HD[h]; let n = 1;
    while (n < 4 && low[(ty + dy * n) * W + tx + dx * n]) n++;
    const fx = tx + dx * n, fy = ty + dy * n;
    if (solid(fx, fy) || low[fy * W + fx]) return;
    dartSeen.add(k);
    if (!dartForce && Math.random() >= S.squeezeScare) return;
    const qx = -dy, qy = dx, sd = Math.random() < 0.5 ? 1 : -1, span = 0.75;
    darter = { x: fx + 0.5 + qx * sd * span, y: fy + 0.5 + qy * sd * span, vx: -qx * sd * DART_SPEED, vy: -qy * sd * DART_SPEED,
               walked: 0, len: span * 2, h: FATHER_H, glow: 0, ghost: true, pale: true, alpha: 1, tex: TEX.sprites.father[0] };
    dartNext = now + DART_GAP; dartForce = false;
    FP_SOUND.dart();
  }
  function fatherFrame(now, dt) {
    if (father) {
      const f = father;
      let step = S.walk * dt;
      while (step > 0 && f.i < f.path.length) {
        const [wx, wy] = f.path[f.i], ex = wx - f.x, ey = wy - f.y, d = Math.hypot(ex, ey);
        if (d <= step) { f.x = wx; f.y = wy; step -= d; f.walked += d; f.i++; continue; }
        f.vx = ex / d; f.vy = ey / d; f.x += f.vx * step; f.y += f.vy * step; f.walked += step; step = 0;
      }
      // side-on crossing your view; from behind once he's heading away from you
      f.back = f.vx * Math.cos(P.a) + f.vy * Math.sin(P.a) > 0.7;
      f.tex = TEX.sprites[f.back ? 'fatherBack' : 'father'][Math.floor(f.walked / 0.33) & 1];
      if (Math.hypot(f.x - P.x, f.y - P.y) < FATHER_NEAR) f.going = true;   // you came for him
      if (f.going) f.alpha -= dt * 3;
      if (f.alpha <= 0 || f.i >= f.path.length) father = null;
      return;
    }
    if ((!fatherLeft && !fatherForce) || now < fatherCheck) return;
    fatherCheck = now + 400;
    const recent = now - foundAt < 9000;
    if (!fatherForce && (now < fatherNext || Math.random() > (recent ? 0.6 : 0.1))) return;
    const path = fatherSpot(); if (!path) return;
    const [x, y] = path[0];
    father = { x, y, path, i: 1, vx: 0, vy: 0, walked: 0, alpha: 1, going: false, h: FATHER_H, glow: 0, ghost: true, tex: TEX.sprites.father[0] };
    fatherForce = false; fatherLeft = Math.max(0, fatherLeft - 1); fatherNext = now + FATHER_GAP;
    FP_SOUND.far();
  }

  // ── the frame's view ──────────────────────────────────────
  let lastX = 0, lastY = 0;
  function update(now, dt) {
    if (won || stairBusy) return;
    doorsFrame(dt);
    fatherFrame(now, dt);
    dartFrame(now, dt);
    beingFrame(now, dt); guardFrame(); veinFrame(now);
    heartFrame(now);
    memoryFrame(now);
    seatFrame(now);
    stickMove(now, dt);
    stepAnim(now);
    // one dip of the head per tile walked, however you walked it; standing still, it settles
    const moved = Math.hypot(P.x - lastX, P.y - lastY); lastX = P.x; lastY = P.y;
    sounds(moved, dt);
    if (moved > 0.0005) walkPhase += moved; else walkPhase += (Math.round(walkPhase) - walkPhase) * Math.min(1, dt * 8);
    arrive();
    checkExit();
    stairFrame();
    storyFrame();
    turnWatch(now);
  }
  // what walking sounds like: a foot down every STRIDE of ground covered, the hum of whichever lamp
  // is nearest (as bright as it is right now), and the rub of a squeeze while you're moving in one
  // The rub is the first few seconds of a squeeze, not all of it. Joe: "The sound for the squeeze should only
  // happen for about 2 to 3 seconds." Full for RUB_MS after you go in, gone RUB_FADE after that; out of a squeeze
  // for more than a moment and the next one starts it again.
  const STRIDE = 0.62, RUB_MS = 2200, RUB_FADE = 800;
  let strideLeft = STRIDE * 0.5, rubAt = -1e9, outAt = 0, wasIn = false;
  function sounds(moved, dt) {
    const tnow = performance.now();
    FP_SOUND.distant(tnow, S.ambience);
    const tx = Math.floor(P.x), ty = Math.floor(P.y), inSqueeze = !!low[ty * W + tx];
    if (inSqueeze && !wasIn && tnow - outAt > 600) rubAt = tnow;
    if (!inSqueeze) outAt = tnow;
    wasIn = inSqueeze;
    const rubEnv = Math.max(0, Math.min(1, 1 - (tnow - rubAt - RUB_MS) / RUB_FADE));
    if (moved > 0.0005 && !hidden) {
      strideLeft -= moved;
      if (moved > 0.5) strideLeft = STRIDE;   // a jump (a restart, a closet) is not a stride
      else if (strideLeft <= 0) { strideLeft = Math.max(strideLeft + STRIDE, STRIDE * 0.5); FP_SOUND.step(moved / Math.max(dt, 1e-3) / S.walk, inSqueeze); }
    }
    let humL = 0;
    for (const k of lampTiles) { const d = Math.hypot(k % W + 0.5 - P.x, ((k / W) | 0) + 0.5 - P.y); if (d < 3) humL = Math.max(humL, (1 - d / 3) * lampLvl[k]); }
    const speed = moved / Math.max(dt, 1e-3);
    FP_SOUND.frame(humL, inSqueeze ? rubEnv * Math.min(1, speed / Math.max(0.05, S.walk * S.squeezeSlow)) : 0);
  }
  // ── waking ────────────────────────────────────────────────
  // Joe: "I want us to start the game with a little scene … start in the room, but I wanna be on a mat, that's
  // lying on the ground with a little pillow. I want the camera to be lower close to the floor. Then I want to
  // move up swaying side to side as if the character is standing up … During this little scene, the player can't
  // do anything." WAKE_LIE lying there, eye at WAKE_EYE; then WAKE_RISE getting up, easing to standing height,
  // swaying less as you find your feet. The start of every maze (not the stairs). `wakeScene` turns it off.
  const WAKE_LIE = 1100, WAKE_RISE = 2500, WAKE_EYE = 0.1;
  let rising = null;
  // the quote on black before the first waking of a session (FP_OPENING); a tap or a key skips it
  let openingQuote = null;
  function opening() {
    const el = $('opening');
    // Joe: "there is a couple frames of the camera already in the upright position. Then it cuts to the scene where they
    // are waking up … we go from the black screen with the quote to fade into the waking scene." The card is black from the
    // page's first paint (it starts with `show` in the page, not faded in over a running game), and the moment it starts to
    // fade you are already lying on the mat: the wake begins now, its lying still counted from when the fade is done
    if (!S.wakeScene || typeof FP_OPENING === 'undefined' || !el) { if (el) el.classList.remove('show'); startWake(); return; }
    const Q = FP_OPENING.quotes && FP_OPENING.quotes.length ? FP_OPENING.quotes[Math.floor(Math.random() * FP_OPENING.quotes.length)] : [FP_OPENING.quote || '', FP_OPENING.by || ''];
    $('openingText').textContent = Q[0]; $('openingBy').textContent = Q[1] ? '— ' + Q[1] + (Q[2] ? ', ' + Q[2] : '') : '';
    openingQuote = Q;
    el.classList.add('show'); document.body.classList.add('waking');
    let done = false;
    const go = () => { if (done) return; done = true; startWake(OPENING_FADE); el.classList.remove('show'); removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); };
    setTimeout(() => { addEventListener('pointerdown', go, true); addEventListener('keydown', go, true); }, 400);
    setTimeout(go, Math.max(5200, 2600 + Q[0].length * 55));   // the long ones stay up long enough to read
  }
  const OPENING_FADE = 900;   // the card's fade, in the page's CSS
  function startWake(after = 0) {
    if (!S.wakeScene || floor !== 1) { rising = null; document.body.classList.remove('waking'); return; }
    rising = { t0: performance.now() + after }; clearStick(); document.body.classList.add('waking');
  }
  const wakeK = (now) => rising ? Math.max(0, Math.min(1, (now - rising.t0 - WAKE_LIE) / WAKE_RISE)) : 1;
  function liftNow(now) {   // eased, so a step up is a step and not a jump
    const dt = Math.min(0.1, Math.max(0, (now - liftT) / 1000)); liftT = now;
    const want = seated ? 0 : standOn(P.x, P.y); lift += (want - lift) * Math.min(1, dt * 10);
    return lift;
  }
  function eyeNow(now) {
    if (!rising) return S.eye;
    const k = wakeK(now), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    if (now - rising.t0 > WAKE_LIE + WAKE_RISE + 250) { rising = null; document.body.classList.remove('waking'); }
    return WAKE_EYE + (S.eye - WAKE_EYE) * e;
  }
  function camera(now) {
    let x = P.x, y = P.y, bob = Math.sin(Math.PI * walkPhase) * S.bob;
    let a = P.a;
    if (rising) {   // swaying as you get up: side to side, less and less, and a little turn of the head with it
      const t = (now - rising.t0) / 1000, k = wakeK(now), amp = k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0;
      const sway = Math.sin(t * 4.2) * 0.07 * amp;
      x += -Math.sin(P.a) * sway; y += Math.cos(P.a) * sway; a += Math.sin(t * 4.2 + 0.6) * 0.05 * amp;
    }
    if (bump) {
      const k = (now - bump.t0) / bump.dur;
      if (k >= 1) bump = null;
      else { const b = Math.sin(Math.PI * k) * 0.14; x += bump.dx * b; y += bump.dy * b; bob -= Math.sin(Math.PI * k) * S.bob * 0.6; }
    }
    return [x, y, a, Math.abs(bob)];
  }

  // ── drawing ───────────────────────────────────────────────
  // a colour, dimmed by `lit` (the side walls a little darker, the undersides more), then faded
  // toward the fog by `f` (1 near, 0 lost)
  // Brightness (Joe: "give me a light slider to control how bright it is") scales all of it, fog
  // included, so turning it down darkens the world rather than only the near walls.
  let BRv = 1, FRb = 0, FGb = 0, FBb = 0;
  // L is the light where the pixel is. It scales the haze as well as the colour, so a dark hall reads
  // dark at any distance and the lit room past it still shines through
  function shade(c, f, lit, L = 1) {
    const k = f * lit * BRv * L, fr = FRb * L, fg = FGb * L, fb = FBb * L;
    const r = Math.min(255, fr + ((c & 0xff) * k - fr * f)) | 0;
    const g = Math.min(255, fg + (((c >>> 8) & 0xff) * k - fg * f)) | 0;
    const b = Math.min(255, fb + (((c >>> 16) & 0xff) * k - fb * f)) | 0;
    return 0xff000000 | (b << 16) | (g << 8) | r;
  }
  // for what is drawn straight from a texture, unshaded: the sky, and what glows
  const bright = (c) => BRv === 1 ? c : shade(c, 1, 1);

  // Ambient occlusion: the dark that collects where two surfaces meet. Laid on from the maze, not
  // painted into textures, so every inside corner gets it whatever tile is there. Two walls meeting
  // multiply, which is what makes the corners themselves the deepest.
  const AOR = 0.45;   // how far out from a wall it reaches, in tiles
  let aoS = 0;
  const aoEdge = (a, d) => { if (d >= AOR) return a; const k = 1 - d / AOR; return a * (1 - aoS * k * k); };
  function aoAt(m, fx, fy) {
    if (!m) return 1;
    let a = 1;
    if (m & 1) a = aoEdge(a, fx); if (m & 2) a = aoEdge(a, 1 - fx);
    if (m & 4) a = aoEdge(a, fy); if (m & 8) a = aoEdge(a, 1 - fy);
    // a lone wall corner poking in diagonally, with open floor on both sides of it
    if ((m & 16) && !(m & 5)) a = aoEdge(a, Math.hypot(fx, fy));
    if ((m & 32) && !(m & 6)) a = aoEdge(a, Math.hypot(1 - fx, fy));
    if ((m & 64) && !(m & 9)) a = aoEdge(a, Math.hypot(fx, 1 - fy));
    if ((m & 128) && !(m & 10)) a = aoEdge(a, Math.hypot(1 - fx, 1 - fy));
    return a;
  }

  // the debug path: the floor pushed toward gold, so it reads under any light
  const PATH_TINT = (c) => 0xff000000 | (Math.min(255, ((c >>> 16) & 0xff) * 0.4 + 40) << 16) | (Math.min(255, ((c >>> 8) & 0xff) * 0.5 + 150) << 8) | Math.min(255, (c & 0xff) * 0.5 + 200);

  // reused per column, so a frame allocates nothing

  function render(now) {
    const [px, py, ang, bob] = camera(now);
    const tanH = Math.tan(S.fov * Math.PI / 360), D = (RW / 2) / tanH;
    const sk = seated ? seated.k : 0;   // sat at the card table: lower, and looking down at it
    const hor = RH / 2 + bob - sk * D * (seated ? seated.shift : 0), eye = eyeNow(now) + ((seated ? seated.eye : S.eye) - S.eye) * sk + liftNow(now), fog = S.fog;
    const dX = Math.cos(ang), dY = Math.sin(ang), plX = -dY * tanH, plY = dX * tanH;
    BRv = S.bright; FRb = FR * BRv; FGb = FG * BRv; FBb = FB * BRv;
    const sky = T.sky, SW = sky ? sky.w : 0, SH = sky ? sky.h : 0, SP = sky ? sky.px : null;
    const walls = T.walls, floors = T.floors, exitT = T.exit, side = T.side, showPath = S.showPath;

    const horI = Math.max(0, Math.min(RH, Math.ceil(hor)));
    const r0x = dX - plX, r0y = dY - plY, r1x = dX + plX, r1y = dY + plY;
    const ceils = T.ceils, hasCeil = !!ceils;
    aoS = T.ao || 0;
    // a lamp on its way out: mostly on, now and then a stutter, now and then out for a moment — and
    // now the room around it goes with it, not only the panel
    for (const k of flickers) {
      const n = Math.sin(now * 0.0023 + k) + Math.sin(now * 0.0171 + k * 3.1) * 0.6 + Math.sin(now * 0.061 + k * 7.7) * 0.25;
      const lv = n > 1.3 ? 0.15 : n > 1.15 ? 0.55 : 1;
      if (lv < lampLvl[k] && !dark[k]) { const dd = Math.hypot(k % W + 0.5 - px, ((k / W) | 0) + 0.5 - py); if (dd < 4.5) FP_SOUND.flicker(1 - dd / 4.5); }
      lampLvl[k] = lv;
    }
    for (const g of lightGroups) g.lvl = groupLevel(g, now);
    for (const lm of groupLamps) lampLvl[lm.k] = (lm.flick ? lampLvl[lm.k] : 1) * lightGroups[lm.g].lvl;
    turnFrame(now, px, py);
    lightFrame();
    const cw = W + 1;   // corner rows, for blending the light across each tile inline
    const nSpot = spotLamps.length;
    if (hasCeil) {
      // ceiling: the floor pass mirrored, at the top of the wall
      for (let y = 0; y < horI; y++) {
        const rowD = (1 - eye) * D / (hor - (y + 0.5));
        const f = Math.exp(-fog * rowD), fl = Math.sqrt(f);   // lamps carry further through the haze than paint does
        const sx = rowD * (r1x - r0x) / RW, sy = rowD * (r1y - r0y) / RW;
        let wx = px + rowD * r0x + sx * 0.5, wy = py + rowD * r0y + sy * 0.5, o = y * RW;
        for (let x = 0; x < RW; x++, wx += sx, wy += sy, o++) {
          const cx = Math.floor(wx), cy = Math.floor(wy), inB = cx >= 0 && cy >= 0 && cx < W && cy < H, k = cy * W + cx;
          const t = ceils[inB ? ceilVar[k] : 0], fx = wx - cx, fy = wy - cy, ti = ((fy * 32) | 0) * 32 + ((fx * 32) | 0);
          if (t.glow && t.glow[ti] && !(inB && (dark[k] || lampLvl[k] < 0.1))) { buf[o] = shade(t.px[ti], fl, inB ? lampLvl[k] : 1); continue; }   // a lamp is its own light
          let L = 1;
          if (inB) { const i = cy * cw + cx, a = cornerL[i] + (cornerL[i + 1] - cornerL[i]) * fx, b2 = cornerL[i + cw] + (cornerL[i + cw + 1] - cornerL[i + cw]) * fx; L = a + (b2 - a) * fy; if (low[k]) L *= S.squeezeDim; }
          buf[o] = shade(t.px[ti], f, inB ? aoAt(nbm[k], fx, fy) : 1, L);
        }
      }
    } else {
      // sky: a wrapped panorama, turning with you
      const baseU = ang / (2 * Math.PI) * SW;
      for (let x = 0; x < RW; x++) {
        const cam = 2 * (x + 0.5) / RW - 1;
        let u = Math.floor(baseU + Math.atan(cam * tanH) / (2 * Math.PI) * SW) % SW; if (u < 0) u += SW;
        for (let y = 0; y < horI; y++) buf[y * RW + x] = bright(SP[Math.min(SH - 1, (y / hor * SH) | 0) * SW + u]);
      }
    }

    // floor: one row at a time, stepping across the ground in a straight line
    for (let y = horI; y < RH; y++) {
      const rowD = eye * D / (y + 0.5 - hor);
      const f = Math.exp(-fog * rowD);
      const sx = rowD * (r1x - r0x) / RW, sy = rowD * (r1y - r0y) / RW;
      let wx = px + rowD * r0x + sx * 0.5, wy = py + rowD * r0y + sy * 0.5;
      let o = y * RW;
      for (let x = 0; x < RW; x++, wx += sx, wy += sy, o++) {
        const cx = Math.floor(wx), cy = Math.floor(wy), inB = cx >= 0 && cy >= 0 && cx < W && cy < H;
        const t = inB ? floors[floorVar[cy * W + cx]] || TEX.heart.floors[(cx + cy) & 1] : floors[0], fx = wx - cx, fy = wy - cy;   // past the look's own floors: the heart's
        let L = 1;
        if (inB) { const i = cy * cw + cx, a = cornerL[i] + (cornerL[i + 1] - cornerL[i]) * fx, b2 = cornerL[i + cw] + (cornerL[i + cw + 1] - cornerL[i + cw]) * fx; L = a + (b2 - a) * fy; if (low[cy * W + cx]) L *= S.squeezeDim; if (nSpot) L += spotAt(wx, wy); }
        const fc = t.px[((fy * 32) | 0) * 32 + ((fx * 32) | 0)];
        buf[o] = shade(showPath && inB && pathMask[cy * W + cx] ? PATH_TINT(fc) : fc, f, inB ? aoAt(nbm[cy * W + cx], fx, fy) : 1, L);
        if (vein && inB && vein[cy * W + cx]) { const va = veinAt(vein[cy * W + cx], fx, fy, wx, wy) * veinLvl * Math.sqrt(f); if (va > 0) { const cc = buf[o];
          buf[o] = 0xff000000 | ((((cc >>> 16) & 0xff) * (1 - va) + VEIN_RGB[2] * va) << 16) | ((((cc >>> 8) & 0xff) * (1 - va) + VEIN_RGB[1] * va) << 8) | (((cc & 0xff) * (1 - va) + VEIN_RGB[0] * va) | 0); } }   // the vein, over the floor however dark it is
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
      let sd = 0, perp = 64, slot = false, su = 0;
      colFace[x] = -1;
      // standing in a squeeze: its jambs first
      let veil = 1e9;   // how far along this column the other side of a squeeze begins
      const k0 = my * W + mx;
      if (low[k0]) veil = Math.min(sdx, sdy);
      if ((low[k0] || frameAt[k0]) && raySlot(k0, px, py, rx, ry)) { perp = slotHit[0]; sd = slotHit[1]; su = slotHit[2]; slot = true; }
      else for (let i = 0; i < 128; i++) {
        if (sdx < sdy) { sdx += ddx; mx += stX; sd = 0; } else { sdy += ddy; my += stY; sd = 1; }
        const entry = sd === 0 ? sdx - ddx : sdy - ddy;
        if (solid(mx, my)) { perp = entry; break; }
        const k = my * W + mx;
        if ((low[k] || frameAt[k]) && raySlot(k, px, py, rx, ry)) { perp = slotHit[0]; sd = slotHit[1]; su = slotHit[2]; slot = true; break; }
        // through a squeeze's gap: whatever is past its far side is hidden
        if (low[k] && veil === 1e9) veil = Math.min(sdx, sdy);
      }
      colVeil[x] = veil;
      colDoor[x] = -1;
      // the far wall
      {
        let u = slot ? su : sd === 0 ? py + perp * ry : px + perp * rx; u -= Math.floor(u);
        // the light along this face: blended between the two tile corners at its ends
        let L0 = 1, L1 = 1;
        // a squeeze's jamb: lit like the wall beside it on the outside, and dimmed only inside the gap.
        // Joe: "the wall of the squeeze through is much darker than the walls next to it; we don't
        // want that." The point a hair before the hit says which side of the jamb the eye is on
        if (slot) {
          const qx = px + rx * (perp - 0.02), qy = py + ry * (perp - 0.02);
          L0 = L1 = lightAtPoint(qx, qy) * (low[Math.floor(qy) * W + Math.floor(qx)] ? S.squeezeDim : 1);
        }
        else if (mx >= 0 && my >= 0 && mx < W && my < H) {
          const w = W + 1;
          if (sd === 0) { const xf = stX > 0 ? mx : mx + 1; L0 = cornerL[my * w + xf]; L1 = cornerL[(my + 1) * w + xf]; }
          else { const yf = stY > 0 ? my : my + 1; L0 = cornerL[yf * w + mx]; L1 = cornerL[yf * w + mx + 1]; }
        }
        const Lw = L0 + (L1 - L0) * u;
        // an inside corner at either edge of this face: the open tile in front of it has wall beside it
        let colAO = 1;
        if (aoS && !slot) {
          const fx = sd === 0 ? mx - stX : mx, fy = sd === 0 ? my : my - stY;
          if (sd === 0 ? solid(fx, fy - 1) : solid(fx - 1, fy)) colAO = aoEdge(colAO, u);
          if (sd === 0 ? solid(fx, fy + 1) : solid(fx + 1, fy)) colAO = aoEdge(colAO, 1 - u);
        }
        if ((sd === 0 && rx < 0) || (sd === 1 && ry > 0)) u = 1 - u;   // y runs down, so this way round reads left to right
        const inB = mx >= 0 && my >= 0 && mx < W && my < H;
        const t = inB && exitFace[my * W + mx] ? exitT : walls[inB ? wallVar[my * W + mx] : 0];
        const tu = Math.min(31, (u * 32) | 0);
        const lh = D / perp, top = hor - (1 - eye) * lh, bot = hor + eye * lh;
        // what this column sees, for the objects' depth test and for a tap to find
        zbuf[x] = perp;
        // a squeeze's jamb, or a door's, is a face too, keyed by its own (open) tile so it never meets a wall's.
        // Joe: "I can't put chalk on the wall right next to the door … This is also true with squeeze through."
        const dk = inB ? faceKey(my * W + mx, sd === 0 ? (stX > 0 ? 0 : 1) : (stY > 0 ? 2 : 3)) : -1;
        const dec = dk >= 0 ? decals.get(dk) : null, du = Math.min(DEC - 1, (u * DEC) | 0);
        colFace[x] = dk; colU[x] = u; colTop[x] = top; colBot[x] = bot;
        const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(RH, Math.ceil(bot - 0.5));
        const f = Math.exp(-fog * perp), lit = sd ? side : 1;
        colWallT[x] = perp;
        for (let y = y0; y < y1; y++) {
          const v = (y + 0.5 - top) / (bot - top), ti = Math.min(31, (v * 32) | 0) * 32 + tu;
          if (t.glow && t.glow[ti]) { buf[y * RW + x] = bright(t.px[ti]); continue; }
          let a = aoS ? aoEdge(colAO, 1 - v) : 1;   // down where it meets the floor
          if (hasCeil && aoS) a = aoEdge(a, v);      // and up where it meets the ceiling
          let c = t.px[ti];
          if (dec) { const dc = dec[Math.min(DEC - 1, (v * DEC) | 0) * DEC + du]; if (dc) { if (dc >>> 24 === 0xfe) { buf[y * RW + x] = shade(dc | 0xff000000, Math.sqrt(f), 1, 1); continue; }
            if (dc >>> 24 === 0xfd) { buf[y * RW + x] = shade(dc | 0xff000000, f, Math.max(lit * a, 0.9), Math.max(Lw, 0.7)); continue; } c = dc; } }   // 0xfe: a pixel that is its own light; 0xfd: one that catches what light there is (the opening walls' chalk)
          buf[y * RW + x] = shade(c, f, lit * a, Lw);
        }
      }
    }
    drawDoors(px, py, dX, dY, plX, plY, D, hor, eye, fog);
    drawFurniture(px, py, dX, dY, plX, plY, D, hor, eye, fog);
    if (spotLamps.length) drawBeams(px, py, dX, dY, plX, plY, D, hor, eye, fog);
    drawObjects(px, py, dX, dY, plX, plY, D, hor, eye, fog);
    veilSqueezes(D, hor, eye);
    if (darter) drawObjects(px, py, dX, dY, plX, plY, D, hor, eye, fog, [darter]);
    ctx.putImageData(img, 0, 0);
  }

  // ── a spotlight's beam ────────────────────────────────────
  // The light coming down from the can over his chair, seen in the air: a cone, narrow at the ceiling and as wide as the pool
  // on the floor, that each pixel looking through it is brightened by as much of it as that pixel's ray passes through (up to
  // whatever is nearest along it — the wall, the floor, the furniture). Joe: "Have a spotlight shining down on it."
  const BEAM_TOP = 0.07, BEAM_A = 0.3, BEAM_RGB = [255, 238, 205];
  function drawBeams(px, py, dX, dY, plX, plY, D, hor, eye, fog) {
    for (const s of spotLamps) {
      const r1 = s.r * 0.62;
      for (let x = 0; x < RW; x++) {
        const cam = 2 * (x + 0.5) / RW - 1, rx = dX + plX * cam, ry = dY + plY * cam, rr = rx * rx + ry * ry, rl = Math.sqrt(rr);
        const t0 = ((s.x - px) * rx + (s.y - py) * ry) / rr, hx = px + rx * t0 - s.x, hy = py + ry * t0 - s.y, h2 = hx * hx + hy * hy;
        if (h2 >= r1 * r1 || t0 + r1 / rl < 0.03) continue;
        const wallT = colWallT[x], ov = colOv[x];
        for (let y = 0; y < RH; y++) {
          const dy = y + 0.5 - hor, z0 = eye - dy * t0 / D;
          if (z0 <= 0 || z0 >= 0.965) continue;
          const R = BEAM_TOP + (r1 - BEAM_TOP) * (1 - z0 / 0.965); if (h2 >= R * R) continue;
          const c = Math.sqrt(R * R - h2) / rl, o = y * RW + x;
          let far = Math.min(wallT, dy > 0 ? eye * D / dy : dy < 0 ? (1 - eye) * D / -dy : 1e9); if (ov && ovDep[o] < far) far = ovDep[o];
          const len = Math.min(t0 + c, far) - Math.max(0.03, t0 - c); if (len <= 0) continue;
          const a = BEAM_A * Math.min(1, len / (2 * c)) * (1 - h2 / (R * R)) * Math.exp(-fog * t0) * (0.55 + 0.45 * z0), cc = buf[o];
          const r = Math.min(255, (cc & 0xff) + BEAM_RGB[0] * a) | 0, g = Math.min(255, ((cc >>> 8) & 0xff) + BEAM_RGB[1] * a) | 0, b = Math.min(255, ((cc >>> 16) & 0xff) + BEAM_RGB[2] * a) | 0;
          buf[o] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
      }
    }
  }

  // ── doors: the header over each opening, and the leaves ──
  // Drawn after the walls, each column's pieces farthest first, only where nearer than the wall.
  const ov = [];
  function drawDoors(px, py, dX, dY, plX, plY, D, hor, eye, fog) {
    colOv.fill(0);
    if (!doors.length) return;
    const dp = TEX.door.px, walls = T.walls, side = T.side;
    for (let x = 0; x < RW; x++) {
      const cam = 2 * (x + 0.5) / RW - 1, rx = dX + plX * cam, ry = dY + plY * cam, wallT = colWallT[x];
      ov.length = 0;
      for (let i = 0; i < doors.length; i++) {
        const d = doors[i];
        // the header: where the ray crosses the plate's plane inside the opening
        const t = d.axis === 'x' ? (rx ? (d.plane - px) / rx : -1) : (ry ? (d.plane - py) / ry : -1);
        if (t > 0.02 && t < wallT) { const c = d.axis === 'x' ? py + t * ry : px + t * rx; if (c > d.open0 && c < d.open1) ov.push({ t, i, head: true, u: (c - d.open0) / (d.open1 - d.open0) }); }
        // the leaf
        const [ax, ay, bx, by] = d.seg, ex = bx - ax, ey = by - ay, den = rx * ey - ry * ex;
        if (Math.abs(den) < 1e-9) continue;
        const tl = ((ax - px) * ey - (ay - py) * ex) / den, sg = ((ax - px) * ry - (ay - py) * rx) / den;
        if (tl > 0.02 && tl < wallT && sg >= 0 && sg <= 1) ov.push({ t: tl, i, head: false, u: sg });
      }
      if (!ov.length) continue;
      ov.sort((p, q) => q.t - p.t);
      colOv[x] = 1; for (let y = 0; y < RH; y++) ovDep[y * RW + x] = 1e9;
      for (const o of ov) {
        const d = doors[o.i], lh = D / o.t, top = hor - (1 - eye) * lh, bot = hor + eye * lh, doorTop = hor - (DOOR_H - eye) * lh;
        // lit by the light where it actually is: an open leaf stands in the room it swung into
        const f = Math.exp(-fog * o.t), L = lightAtPoint(px + rx * o.t, py + ry * o.t), tu = Math.min(31, (o.u * 32) | 0);
        if (o.head) {   // the wall over the door, in the wall's own paper, lined up with the wall beside it
          const wt = walls[wallVar[d.k]].px, y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(RH, Math.ceil(doorTop - 0.5));
          for (let y = y0; y < y1; y++) { buf[y * RW + x] = shade(wt[Math.min(31, (((y + 0.5 - top) / (bot - top)) * 32) | 0) * 32 + tu], f, side, L); ovDep[y * RW + x] = o.t; }
        } else {        // the leaf, floor to the top of the opening
          const [ax, ay, bx, by] = d.seg, nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
          const lit = 0.72 + 0.28 * Math.abs((nx * rx + ny * ry) / nl / Math.hypot(rx, ry));   // darker edge-on, so a leaf standing open reads
          const y0 = Math.max(0, Math.ceil(doorTop - 0.5)), y1 = Math.min(RH, Math.ceil(bot - 0.5));
          for (let y = y0; y < y1; y++) { buf[y * RW + x] = shade(dp[Math.min(31, (((y + 0.5 - doorTop) / (bot - doorTop)) * 32) | 0) * 32 + tu], f, lit, L); ovDep[y * RW + x] = o.t; }
          if (o.t < zbuf[x]) zbuf[x] = o.t;
          colDoor[x] = o.i; colDoorTop[x] = doorTop; colDoorBot[x] = bot; colDoorT[x] = o.t;
        }
      }
    }
  }

  // ── furniture, drawn ──────────────────────────────────────
  // Every box a column's ray passes through nearer than the wall, farthest first: the face it enters
  // by, and the top (or underneath) between where it goes in and where it comes out. Lit like a wall —
  // the light where that face is, the same fog, a little shadow where it meets the floor — and each
  // pixel's depth kept (ovDep) so a page behind a couch is hidden by the couch and not by thin air.
  const fhit = [];
  function drawFurniture(px, py, dX, dY, plX, plY, D, hor, eye, fog) {
    if (!fboxes.length) return;
    const near = fboxes.filter((b) => Math.abs((b.x0 + b.x1) / 2 - px) < 14 && Math.abs((b.y0 + b.y1) / 2 - py) < 14);
    if (!near.length) return;
    const side = T.side;
    for (let x = 0; x < RW; x++) {
      const cam = 2 * (x + 0.5) / RW - 1, rx = dX + plX * cam, ry = dY + plY * cam, wallT = colWallT[x];
      const ix = rx === 0 ? 1e30 : 1 / rx, iy = ry === 0 ? 1e30 : 1 / ry;
      fhit.length = 0;
      for (const b of near) {
        const ax = (b.x0 - px) * ix, cx = (b.x1 - px) * ix, ay = (b.y0 - py) * iy, cy = (b.y1 - py) * iy;
        const nx = Math.min(ax, cx), fx = Math.max(ax, cx), ny = Math.min(ay, cy), fy = Math.max(ay, cy);
        const tn = Math.max(nx, ny), tf = Math.min(fx, fy);
        if (tn < tf && tf > 0.03 && tn < wallT) fhit.push({ b, tn: Math.max(0.03, tn), tf, axis: nx > ny ? 0 : 1 });
      }
      if (!fhit.length) continue;
      fhit.sort((p, q) => q.tn - p.tn);
      if (!colOv[x]) { colOv[x] = 1; for (let y = 0; y < RH; y++) ovDep[y * RW + x] = 1e9; }
      for (const h of fhit) {
        const b = h.b, tn = h.tn, tf = h.tf;
        const put = (y, c, t, f, lit, L) => {
          const o = y * RW + x; if (!c || ovDep[o] < t) return;
          buf[o] = c >>> 24 === 0xfe ? shade(c | 0xff000000, Math.sqrt(f), 1, 1) : shade(c, f, lit, L); ovDep[o] = t;
        };
        // the top, seen from above (or the underneath, from below)
        const zc = b.z1 < eye ? b.z1 : b.z0 > eye ? b.z0 : null;
        if (zc !== null) {
          const k = (eye - zc) * D, yN = hor + k / tn, yF = hor + k / tf;
          const ya = Math.max(0, Math.ceil(Math.min(yN, yF) - 0.5)), yb = Math.min(RH, Math.ceil(Math.max(yN, yF) - 0.5));
          const tt = zc === b.z1 ? b.top : b.m;
          for (let y = ya; y < yb; y++) {
            const t = k / (y + 0.5 - hor); if (!(t > 0)) continue;
            const wx = px + rx * t, wy = py + ry * t;
            let c;
            if (zc === b.z1 && b.topFit) c = tt.px[Math.min(tt.h - 1, Math.max(0, ((wy - b.y0) / (b.y1 - b.y0) * tt.h) | 0)) * tt.w + Math.min(tt.w - 1, Math.max(0, ((wx - b.x0) / (b.x1 - b.x0) * tt.w) | 0))];
            else c = tt.px[((((wy * 32) | 0) & 15) * 16) + (((wx * 32) | 0) & 15)];
            put(y, c, t, Math.exp(-fog * t), zc === b.z1 ? 1 : 0.55, lightAtPoint(wx, wy));
          }
        }
        // the face it goes in by
        const nxv = h.axis === 0 ? (rx > 0 ? -1 : 1) : 0, nyv = h.axis === 1 ? (ry > 0 ? -1 : 1) : 0;
        const fcode = nxv === 1 ? 'e' : nxv === -1 ? 'w' : nyv === 1 ? 's' : 'n';
        const hx = px + rx * tn, hy = py + ry * tn, f = Math.exp(-fog * tn), L = lightAtPoint(hx + nxv * 0.03, hy + nyv * 0.03);
        const yT = hor + (eye - b.z1) * D / tn, yB = hor + (eye - b.z0) * D / tn;
        const y0 = Math.max(0, Math.ceil(yT - 0.5)), y1 = Math.min(RH, Math.ceil(yB - 0.5));
        const lit = h.axis === 0 ? 1 : side;
        const fr = b.front && fcode === b.fcode ? b.front : null;
        // across the face, left to right as you look at it
        let u;
        if (h.axis === 0) u = nxv === 1 ? (b.y1 - hy) : (hy - b.y0); else u = nyv === 1 ? (hx - b.x0) : (b.x1 - hx);
        const ext = h.axis === 0 ? b.y1 - b.y0 : b.x1 - b.x0;
        for (let y = y0; y < y1; y++) {
          const v = (y + 0.5 - yT) / (yB - yT), z = b.z1 - v * (b.z1 - b.z0);
          const c = fr ? fr.px[Math.min(fr.h - 1, (v * fr.h) | 0) * fr.w + Math.min(fr.w - 1, Math.max(0, ((u / ext) * fr.w) | 0))]
                       : b.m.px[((((1 - z) * 32) | 0) & 15) * 16 + (((u * 32) | 0) & 15)];
          const ao = b.z0 < 0.01 ? 0.62 + 0.38 * Math.min(1, z / 0.07) : 1;   // where it meets the floor
          put(y, c, tn, f, lit * ao, L);
        }
      }
    }
  }

  function lightAtPoint(x, y) {   // the light blended across the tile corners, at any point
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return 1;
    const fx = x - cx, fy = y - cy, w = W + 1, i = cy * w + cx;
    const a = cornerL[i] + (cornerL[i + 1] - cornerL[i]) * fx, b = cornerL[i + w] + (cornerL[i + w + 1] - cornerL[i + w]) * fx;
    return a + (b - a) * fy + (spotLamps.length ? spotAt(x, y) : 0);
  }

  // ── the far side of a squeeze, hidden ─────────────────────
  // Joe: "it just makes the wall a darker color, it doesn't make the gap darker. Ideally, I would like
  // to not be able to see what's on the other side of the squeeze." Every pixel a column sees past
  // the far side of a squeeze's gap is taken down by `squeezeVeil`. Joe, after the first go: "it's
  // completely black until you come out the other side, which doesn't make a lot of sense. I just
  // want it to be much more difficult to see into it, but not completely black." So it deepens over
  // VEIL_DEPTH tiles past the gap: just beyond it you can make things out, further on less.
  const VEIL_DEPTH = 2.5;
  function veilSqueezes(D, hor, eye) {
    const sv = S.squeezeVeil;
    if (sv <= 0) return;
    for (let x = 0; x < RW; x++) {
      const vt = colVeil[x]; if (vt >= 1e9) continue;
      const wt = colWallT[x], top = colTop[x], bot = colBot[x];
      for (let y = 0; y < RH; y++) {
        // a door drawn over the wall stands where it stands: Joe, "the shadow from the squeeze is
        // visible through doors that are closed" — the veil was reading the wall behind it
        const dov = colOv[x] ? ovDep[y * RW + x] : 1e9;
        const dep = dov < 1e9 ? dov : (y >= top && y < bot) ? wt : y < hor ? (1 - eye) * D / Math.max(1e-3, hor - y - 0.5) : eye * D / Math.max(1e-3, y + 0.5 - hor);
        if (dep <= vt) continue;
        const k = 1 - sv * Math.min(1, 0.35 + (dep - vt) / VEIL_DEPTH), o = y * RW + x, c = buf[o];
        buf[o] = 0xff000000 | ((((c >>> 16) & 0xff) * k) << 16) | ((((c >>> 8) & 0xff) * k) << 8) | ((c & 0xff) * k);
      }
    }
  }

  // ── the objects, as flat pictures facing you ──────────────
  let ovDep = new Float32Array(1), colOv = new Uint8Array(1), zbuf = new Float32Array(1), colFace = new Int32Array(1), colDoor = new Int32Array(1), colDoorTop = new Float32Array(1), colDoorBot = new Float32Array(1), colDoorT = new Float32Array(1), colVeil = new Float32Array(1), colWallT = new Float32Array(1), colU = new Float32Array(1), colTop = new Float32Array(1), colBot = new Float32Array(1);
  const DITH = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const PLAYED = new Set(['cards', 'matches', 'ball', 'kidBook', 'shelfGap', 'toolbox', 'pile']);
  const drawn = [];   // this frame's objects on screen: {o, x0, x1, y0, y1, depth}, for a tap to find
  // a pixel of the darter: its own shading kept as a grey, lifted toward white, lit by nothing
  const paleOf = (c, f) => { const l = Math.min(200, 38 + (((c & 0xff) + ((c >>> 8) & 0xff) + ((c >>> 16) & 0xff)) / 3) * 1.5) | 0; return shade(0xff000000 | (l << 16) | (l << 8) | l, Math.sqrt(f), 1, 1); };
  function drawObjects(px, py, dX, dY, plX, plY, D, hor, eye, fog, only) {
    if (!only) drawn.length = 0;
    const det = dX * plY - dY * plX, list = [];
    const all = only || (father || being || guard ? objs.concat(father ? [father] : [], being ? [being] : [], guard ? [guard] : []) : objs);
    for (const o of all) {
      const rx = o.x - px, ry = o.y - py;
      const depth = (rx * plY - ry * plX) / det, cam = (dX * ry - dY * rx) / det / depth;   // along the view, and across it
      if (depth < 0.15 || Math.abs(cam) > 1.6) continue;
      list.push({ o, depth, cam });
    }
    list.sort((a, b) => b.depth - a.depth);   // far first, so near ones cover
    let seenPx = 0;
    for (const { o, depth, cam } of list) {
      // a piece with a side view shows it when you're more beside it than in front
      const t = o.tex, sc = D / depth, hPx = o.h * sc, wPx = hPx * t.w / t.h;
      const floorY = hor + (eye - (o.z || 0)) * sc, y0 = floorY - hPx, xc = (cam + 1) / 2 * RW;
      const x0 = Math.round(xc - wPx / 2), x1 = Math.round(xc + wPx / 2);
      const f = Math.exp(-fog * depth), tx0 = Math.floor(o.x), ty0 = Math.floor(o.y);
      const gi = !o.ghost && groupAt && groupAt.length === W * H ? groupAt[ty0 * W + tx0] : -1;
      const glow = gi >= 0 ? o.glow * lightGroups[gi].lvl : o.glow;   // but not in a room with its lights off
      const L = Math.max(glow, tileL[ty0 * W + tx0]);   // a page catches what light there is; it is meant to be found
      // the father walks: drawn facing the way he's going across the screen, and he goes by thinning out
      const ghost = !!o.ghost, flip = ghost && !o.back && o.vx * plX + o.vy * plY < 0;
      let any = false;
      for (let x = Math.max(0, x0); x < Math.min(RW, x1); x++) {
        if (zbuf[x] < depth) continue;
        any = true;
        let tu = Math.min(t.w - 1, ((x - x0) / (x1 - x0) * t.w) | 0);
        if (flip) tu = t.w - 1 - tu;
        for (let y = Math.max(0, Math.ceil(y0)); y < Math.min(RH, Math.ceil(floorY)); y++) {
          const c = t.px[Math.min(t.h - 1, ((y - y0) / hPx * t.h) | 0) * t.w + tu];
          if (c && colOv[x] && ovDep[y * RW + x] < depth) continue;   // behind a door or a piece of furniture
          if (c && o === being) seenPx++;
          if (c && (!ghost || DITH[(y & 3) * 4 + (x & 3)] < o.alpha)) buf[y * RW + x] = o.pale ? shade(0xff060506, f, 1, 1) : c >>> 24 === 0xfe ? shade(c | 0xff000000, Math.sqrt(f), 1, 1) : shade(c, f, 1, L);
        }
      }
      if (ghost) continue;   // the father is seen, never touched
      // a generous target, well past the picture on every side: fingers are wide and things are small
      const pad = PLAYED.has(o.kind) ? Math.max(wPx * 0.6, RW * (o.kind === 'cards' ? 0.12 : 0.06)) : wPx * 0.6;   // a small thing to play with: a wider mark
      if (any) drawn.push({ o, x0: x0 - pad, x1: x1 + pad, y0: y0 - hPx - 10, y1: floorY + hPx + 14, depth });
    }
    // enough of it on screen, not behind a wall or a door, to have been seen: then (and only then) it may take you
    if (being && !only && seenPx > BEING_SEEN_PX) { being.seen = true; being.lastSeen = performance.now(); }
  }

  // ── the debug map ─────────────────────────────────────────
  // The corner map, and the full-screen one. Joe: "We need the view full map in the debug options
  // that brings up the full screen map. Then carry over the ability to tap on a location and be
  // teleported there." And: "I don't think our debug map handles multiple floors well" — so both mark
  // the doors up (blue) and down (red), show the exit only on the floor that has it, and say which floor.
  function mapPaint(c, s, ox, oy, full, now) {
    const doorAt = new Set(doors.map((d) => d.k));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!full && !seen[y * W + x]) continue;
      // floor light, walls dark (Joe: "make the lighter shade and the walls, the darker shade")
      c.fillStyle = solid(x, y) ? '#1a1917' : low[y * W + x] ? '#9c7747' : doorAt.has(y * W + x) ? '#c9a46c' : dark[y * W + x] ? '#55524a' : '#8d887c';
      c.fillRect(ox + x * s, oy + y * s, s, s);
    }
    if (floor === 1 && (full || seen[exit.y * W + exit.x])) { c.fillStyle = '#e0c98a'; c.fillRect(ox + exit.x * s, oy + exit.y * s, s, s); }
    for (const [st, col] of [[stairs.up, '#8fb8e0'], [stairs.down, '#e09a8f']]) if (st && (full || seen[st.y * W + st.x])) { c.fillStyle = col; c.fillRect(ox + st.x * s, oy + st.y * s, s, s); }
    const [x, y, a] = camera(now);
    c.save(); c.translate(ox + x * s, oy + y * s); c.rotate(a);
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(s * 1.1, 0); c.lineTo(-s * 0.6, -s * 0.7); c.lineTo(-s * 0.6, s * 0.7); c.fill();
    c.restore();
  }
  let bigOpen = false, bigGeom = null;
  const big = document.getElementById('bigmap'), bctx = big.getContext('2d');
  function drawMini(now) {
    const screen = S.map === 'screen';
    $('mapBtn').style.display = screen ? 'block' : 'none';
    if (!screen) bigOpen = false;
    big.style.display = bigOpen ? 'block' : 'none';
    if (bigOpen) {
      const dpr = Math.min(2, devicePixelRatio || 1), top = 96;
      const s = Math.max(2, Math.floor(Math.min((innerWidth - 16) / W, (innerHeight - top - 16) / H))), ox = Math.round((innerWidth - W * s) / 2), oy = top;
      if (big.width !== Math.round(innerWidth * dpr) || big.height !== Math.round(innerHeight * dpr)) { big.width = Math.round(innerWidth * dpr); big.height = Math.round(innerHeight * dpr); }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.fillStyle = '#0d0f10'; bctx.fillRect(0, 0, innerWidth, innerHeight);
      mapPaint(bctx, s, ox, oy, true, now);
      bctx.fillStyle = '#cfc6b0'; bctx.font = '15px Georgia, serif'; bctx.textAlign = 'center';
      bctx.fillText('floor ' + floor + ' · tap somewhere to go there', innerWidth / 2, 82);
      bigGeom = { s, ox, oy };
    }
    if (S.map === 'off' || screen) { mini.style.display = 'none'; return; }
    mini.style.display = 'block';
    const s = Math.max(2, Math.floor(Math.min(innerWidth * 0.34 / W, innerHeight * 0.34 / H)));
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (mini.width !== W * s * dpr) { mini.width = W * s * dpr; mini.height = H * s * dpr; mini.style.width = W * s + 'px'; mini.style.height = H * s + 'px'; }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, W * s, H * s);
    mapPaint(mctx, s, 0, 0, S.map === 'full', now);
    if (floor > 1) { mctx.fillStyle = '#cfc6b0'; mctx.font = '10px Georgia, serif'; mctx.textAlign = 'left'; mctx.fillText('floor ' + floor, 3, 11); }
  }
  $('mapBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); bigOpen = !bigOpen; });
  big.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault(); if (!bigGeom) return;
    const tx = Math.floor((e.clientX - bigGeom.ox) / bigGeom.s), ty = Math.floor((e.clientY - bigGeom.oy) / bigGeom.s);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H || solid(tx, ty)) { bigOpen = false; return; }   // off the maze: just close
    if (hidden) leaveCloset();
    P.x = tx + 0.5; P.y = ty + 0.5; lastX = P.x; lastY = P.y; vel = 0; lastTile = ''; arrive();
    bigOpen = false;
  });

  // ── winning ───────────────────────────────────────────────
  function win() {
    won = true; holdFwd = false; queued = null; anim = null; vel = 0;
    FP_SOUND.out();
    const E = endingText();
    $('winSteps').textContent = (exitOpen() && E ? E.out + '\n' : '') + steps + ' steps';
    $('win').classList.add('show');
  }
  $('again').onclick = () => newMaze();

  // ── keys ──────────────────────────────────────────────────
  // Joe: "a control scheme on the keyboard that uses the numberpad for movement (4,8,6,2) with 0 as the enter/interact key"
  const KEYS = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'sleft', KeyE: 'sright', ShiftLeft: 'shift', ShiftRight: 'shift',
    Numpad8: 'fwd', Numpad2: 'back', Numpad4: 'left', Numpad6: 'right' };
  const HAND = new Set(['Space', 'KeyX', 'Numpad0']);   // the hand: whatever is straight ahead
  const keys = {};
  addEventListener('keydown', (e) => {
    // a slider or a list in the panel keeps the keys only while the panel is open. Joe: "You broke WASD on PC" — touch a
    // slider, shut the panel, and it still had the keyboard (a tap on the view doesn't take focus), so W did nothing
    const panelOpen = $('panel').classList.contains('open');
    if (panelOpen && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (!panelOpen && document.activeElement && $('panel').contains(document.activeElement)) document.activeElement.blur();
    if (reading) { if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter' || HAND.has(e.code)) { e.preventDefault(); if (!e.repeat) hidePage(); } return; }   // on a PC, a key puts the page down
    // Space (or X) is the hand on a PC: whatever is straight ahead. Joe: "On PC, let's get spacebar to leave and X as
    // well as be the interact button on things."
    if (seated && (e.code === 'Escape' || (KEYS[e.code] && KEYS[e.code] !== 'shift'))) { e.preventDefault(); getUp(); return; }   // at the card table: a step is getting up
    if (HAND.has(e.code)) { e.preventDefault(); if (!e.repeat) interact(); return; }
    const a = KEYS[e.code]; if (!a) return;
    e.preventDefault();
    keys[a] = true; if (a !== 'shift') learn('move');
  });
  addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) keys[a] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; holdFwd = false; clearStick(); });

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
  stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (seated) { getUp(); return; } learn('move'); stickId = e.pointerId; stickEl.classList.add('on'); try { stickEl.setPointerCapture(e.pointerId); } catch (err) {} setStick(e.clientX, e.clientY); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e.clientX, e.clientY); });
  stickEl.addEventListener('pointerup', clearStick); stickEl.addEventListener('pointercancel', clearStick);

  // ── tapping the view ──────────────────────────────────────
  // Joe: "we are good to get rid of the tap to move and just use the joystick, or WASD on PC" — a tap
  // on the view is for touching what is in it. Near a thing: take it. Near a wall: chalk it. Only
  // what is within arm's reach answers; the rest of the view does nothing.
  const REACH_THING = 2.2, REACH_WALL = 1.6;
  let touch = null, pendingMark = null;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if ($('page').classList.contains('show')) { hidePage(); return; }
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  });
  cv.addEventListener('pointerup', (e) => {
    if (!touch || touch.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - touch.x, e.clientY - touch.y), held = performance.now() - touch.t;
    touch = null;
    if (moved < 14 && held < 450) tapAt(e.clientX / innerWidth * RW, e.clientY / innerHeight * RH);
  });
  cv.addEventListener('pointercancel', () => { touch = null; });
  function interact() {
    if (hidden) { leaveCloset(); return; }
    if (rising || won) return;
    // a thing in the middle of the view within reach, however low it lies (a page on the floor ahead); then whatever
    // the middle of the view is — a door, a switch, a closet, the wall to chalk
    const cx = RW / 2; let hit = null;
    for (const d of drawn) if (d.o.kind !== 'deco' && d.x0 <= cx && cx <= d.x1 && d.depth < REACH_THING && (!hit || d.depth < hit.depth)) hit = d;   // a thing only looked at is never what you reach for
    if (seated) { seatedPlay(); return; }
    if (carried.has('ball')) { throwBall(); return; }
    if (hit) { glyphsOff(); take(hit.o); return; }
    tapAt(cx, RH * 0.55);
  }
  function tapAt(bx, by) {
    if (rising) return;   // still getting up
    glyphsOff();
    // a thing first: the nearest one under the finger
    let hit = null;
    for (const d of drawn) if (d.o.kind !== 'deco' && bx >= d.x0 - 6 && bx <= d.x1 + 6 && by >= d.y0 && by <= d.y1 && d.depth < REACH_THING && (!hit || d.depth < hit.depth)) hit = d;
    if (seated) { seatedPlay(); return; }   // at the card table, a tap anywhere turns a card
    if (carried.has('ball')) { throwBall(); return; }   // holding the ball, a tap anywhere throws it
    if (hit) { take(hit.o); return; }
    const x = Math.max(0, Math.min(RW - 1, bx | 0));
    if (hidden) return;   // from inside a closet you can only step out
    // a door under the finger: open it, or shut it
    if (colDoor[x] >= 0 && colDoorT[x] < REACH_WALL + 0.4 && by >= colDoorTop[x] - 8 && by <= colDoorBot[x]) { toggleDoor(doors[colDoor[x]]); learn('door'); return; }
    // a closet: step in. Joe: "light switches or any other thing you interact with on a wall [should]
    // not allow you to put an X on the wall as well" — a face that does something is never chalked,
    // anywhere on it, whether or not the tap landed on the thing itself
    if (stairTap(colFace[x])) return;
    // a piece of furniture under the finger: nothing, and not the wall behind it either
    const byI = Math.max(0, Math.min(RH - 1, by | 0));
    if (colOv[x] && ovDep[byI * RW + x] < zbuf[x] - 0.01) return;
    const sw = switchFace.get(colFace[x]);
    if (sw) { if (zbuf[x] < REACH_WALL + 0.3) { flipSwitch(sw); learn('light'); } return; }
    const mem = memFace.get(colFace[x]);
    if (mem) { if (zbuf[x] < REACH_WALL + 0.3) useMemory(mem); return; }
    const cl = closets.find((c) => faceKey(c.k, c.face) === colFace[x]);
    if (cl) { if (zbuf[x] < REACH_WALL && colU[x] > 0.32 && colU[x] < 0.68) enterCloset(cl); return; }
    // a classroom door that isn't a way anywhere: it's tried, and it rattles
    { const wk = colFace[x] >= 0 ? Math.floor(colFace[x] / 4) : -1;
      if (wk >= 0 && solid(wk % W, (wk / W) | 0) && T.walls[wallVar[wk]].locked && !exitFace[wk]) { if (zbuf[x] < REACH_WALL + 0.3) FP_SOUND.locked(); return; } }
    if (colFace[x] >= 0 && usedFace(colFace[x])) return;
    // then the wall under the finger, if it is close enough to touch
    if (colFace[x] < 0 || zbuf[x] > REACH_WALL || by < colTop[x] || by > colBot[x]) return;
    const cu = colU[x], cv2 = (by - colTop[x]) / (colBot[x] - colTop[x]);
    if (!S.chalkInf && chalk <= 0) { flash('hudChalkBox'); FP_SOUND.empty(); return; }
    const jamb = !solid(Math.floor(colFace[x] / 4) % W, (Math.floor(colFace[x] / 4) / W) | 0), ue = jamb ? 0.06 : 0.15;   // a jamb is narrow: let the mark go nearer its edge
    pendingMark = { fk: colFace[x], u: Math.max(ue, Math.min(1 - ue, cu)), v: Math.max(0.15, Math.min(0.85, cv2)) };
    // early on chalk only makes an X, as in the top-down; once signs are open, you choose
    if (typeof phase === 'function' && phase().f.signs) { $('glyphs').classList.add('show'); } else placeMark('x');
  }
  function placeMark(glyph) {
    if (!pendingMark) return;
    const k = Math.floor(pendingMark.fk / 4), face = pendingMark.fk % 4;
    chalkSign(decalFor(k, face), glyph, pendingMark.u, pendingMark.v);
    if (!S.chalkInf) chalk--;
    FP_SOUND.chalkMark();
    crossOut(pendingMark.fk); learn('x');
    pendingMark = null; glyphsOff(); hud();
  }
  // ── the way out ───────────────────────────────────────────
  // A chapter with placed pages is one you have to face to leave. The exit is shut, chalked "not yet", until you've
  // been to the heart and then left the watch on the chair he saved in the waiting room (tap the seat with it) —
  // he stops keeping it, stops saving the seat. Then the exit opens, and the being is standing in front of it; come
  // close and it's the kid, and he goes. Joe: "It should be required and the heart should stay hidden." Lines are
  // FP_ENDING in data/text.js. `exitLocked` only when the maze has all of it (the waiting room, the wall, the heart).
  let exitLocked = false, watchLeft = false, rattleAt = 0, kidMet = false;
  const endingText = () => typeof FP_ENDING !== 'undefined' && character ? FP_ENDING[character.name] : null;
  const heartSeen = () => !heart || story.some((q) => q.kind === 'heart' && q.found);
  function exitFaceKey() {
    if (!exitDir) return -1;
    const [dx, dy] = exitDir; return faceKey((exit.y + dy) * W + exit.x + dx, faceTo(dx, dy));
  }
  function lockExit() {
    exitLocked = floor === 1 && !!placedPages() && story.some((q) => q.kind === 'waiting' && q.chair) && story.some((q) => q.kind === 'wall') && !!endingText();
    const fk = exitFaceKey();
    if (!exitLocked || exitOpen() || fk < 0) return;
    const d = decalFor(Math.floor(fk / 4), fk % 4), R = rng(SEED + 240007);
    hand(d, endingText().notYet, 14, 38, 38, 2, TEX.hex('#1d1c19'), R);   // across the door, under its window, in the kid's pencil
  }
  function leaveWatch(where) {
    carried.delete('watch'); watchLeft = true; hud();
    if (where.kind === 'slot') objs.splice(objs.indexOf(where), 1);
    objs.push({ x: where.x, y: where.y, z: where.kind === 'slot' ? where.z : 0.19, kind: 'deco', tex: TEX.sprites.watch, h: 0.1, glow: 0.6 });   // back where he kept it
    giveJournal(endingText().leave);
    lightsUp();
    openExit();
  }
  function openExit() {
    const fk = exitFaceKey(); if (fk >= 0) decals.delete(fk);
    FP_SOUND.exitOpens();
    spawnKid();
  }
  // ── the one at the exit ───────────────────────────────────
  // Joe: "He should always be at the exit stopping you from leaving as well. The one that waits at the exit never chases you.
  // He just stands there and if you collide with him he moves you someplace back on the golden path." The being's shape,
  // standing just inside the locked way out for as long as it's locked; walk into him and it's the being's static, and you're
  // GUARD_BACK steps back along the way out, facing back into the maze. Leave the watch and the exit opens, and where he
  // stood the being is waiting to become the kid (spawnKid): he was always that.
  // Joe: "We need to add some menace to the Being at the exit to scare people away. Waves arms, eyes pulse, maybe a yell (fake
  // that for now)." Come within GUARD_WARN and he warns you off: his arms up over his head waving (TEX.sprites.beingWave), his
  // eyes burning and dimming, and once each time you come at him, a yell (FP_SOUND.beingYell); back past GUARD_CALM and he
  // stands still again, arms down, and the next approach yells again.
  const GUARD_BACK = 14, GUARD_TOUCH = 0.5, GUARD_WARN = 5, GUARD_CALM = 7, GUARD_WAVE = 260, GUARD_EYES = 420;
  let guard = null;
  function placeGuard() {
    guard = null;
    if (!exitLocked || exitOpen() || !exitDir || floor !== 1) return;
    const [dx, dy] = exitDir;
    guard = beingObj(exit.x + 0.5 - dx * 0.35, exit.y + 0.5 - dy * 0.35); guard.guard = true;
  }
  function guardFrame() {
    if (!guard) return;
    if (exitOpen() || floor !== 1) { guard = null; return; }
    if (won || stairBusy || reading || seated) return;
    const d = Math.hypot(P.x - guard.x, P.y - guard.y), now = performance.now();
    if (d < GUARD_WARN && !guard.warning) { guard.warning = now; FP_SOUND.beingYell(Math.max(0.35, 1 - d / GUARD_WARN)); }
    else if (d > GUARD_CALM) guard.warning = 0;
    guard.tex = guard.warning ? TEX.sprites.beingWave[(Math.floor((now - guard.warning) / GUARD_WAVE) & 1) + (Math.floor((now - guard.warning) / GUARD_EYES) & 1 ? 2 : 0)] : TEX.sprites.being[0];
    if (d < GUARD_TOUCH) guardTakes();
  }
  function guardTakes() {
    FP_SOUND.beingTakes(); stairBusy = true; clearStick();
    const fade = $('fade'); $('fadeText').textContent = ''; fade.classList.add('white', 'show');
    setTimeout(() => {
      const i = Math.max(1, solutionPath.length - 1 - GUARD_BACK), [x, y] = solutionPath[i], [bx, by] = solutionPath[i - 1];
      P.x = x + 0.5; P.y = y + 0.5; P.a = Math.atan2(by - y, bx - x); lastX = P.x; lastY = P.y; vel = 0; lastTile = ''; arrive();
      setTimeout(() => { fade.classList.remove('show'); setTimeout(() => fade.classList.remove('white'), 300); stairBusy = false; }, 350);
    }, 420);
  }
  const KID_SHRINK = 900, KID_PALE = 900, KID_ARMS = 500, KID_PACE = 1.6, KID_INTO = 0.3;
  function spawnKid() {
    guard = null;
    if (kidMet || floor !== 1 || !exitDir) return;
    const [dx, dy] = exitDir;
    being = beingObj(exit.x + 0.5 - dx * 0.35, exit.y + 0.5 - dy * 0.35); being.lastSeen = performance.now(); beingState = 'guide';
  }
  function guideFrame(now) {
    if (beingState !== 'guide' || !being) return;
    const d = Math.hypot(P.x - being.x, P.y - being.y);
    if (!being.turnAt && d < 2.6) { being.turnAt = now; FP_SOUND.kidGoes(); }
    if (!being.turnAt) return;
    // down to the kid's size (KID_SHRINK); going white (KID_PALE, in three steps); his arms out (KID_ARMS); then he comes to
    // you at KID_PACE and, there, is gone into you: a white flash, and the warm sound (KID_INTO)
    const t = now - being.turnAt, k = Math.min(1, t / KID_SHRINK);
    being.h = 0.97 - 0.42 * k;
    if (t < KID_SHRINK) { being.tex = TEX.sprites.kid; return; }
    if (t < KID_SHRINK + KID_PALE) { being.tex = TEX.sprites.kidPale[Math.min(2, Math.floor((t - KID_SHRINK) / KID_PALE * 3))]; return; }
    being.tex = TEX.sprites.kidPale[3];
    if (t < KID_SHRINK + KID_PALE + KID_ARMS) return;
    const dx = P.x - being.x, dy = P.y - being.y, dd = Math.hypot(dx, dy), dt = Math.min(0.05, (now - (being.lastT || now)) / 1000); being.lastT = now;
    if (dd > KID_INTO + 0.02) { const st = Math.min(dd - KID_INTO, KID_PACE * dt); being.x += dx / dd * st; being.y += dy / dd * st; being.vx = dx / dd; being.vy = dy / dd; return; }
    FP_SOUND.kidHug(); clearStick();
    const fade = $('fade'); $('fadeText').textContent = ''; fade.classList.add('white', 'show');
    setTimeout(() => { fade.classList.remove('show'); setTimeout(() => fade.classList.remove('white'), 600); }, 700);
    being = null; beingState = 'done'; kidMet = true;
  }
  // the next thing to do, for the debug arrow: a room still lying, then the heart, the watch, the chair, the door
  function nextGoal() {
    if (floor > 1) return stairs.down || exit;
    if (!exitLocked || exitOpen()) return exit;
    const lie = story.find((q) => q.lieFaces && !q.undone); if (lie) return { x: lie.m.rx, y: lie.m.ry };
    if (heart && !heartSeen()) return { x: heart.mid % W, y: (heart.mid / W) | 0 };
    if (!carried.has('watch')) { const w = objs.find((o) => o.kind === 'watch'); if (w) return { x: Math.floor(w.x), y: Math.floor(w.y) }; }
    const ch = story.find((q) => q.chair); if (ch) { const t = ch.slot || ch.chair; return { x: Math.floor(t.x), y: Math.floor(t.y) }; }
    return exit;
  }
  // ── crossing out the lies ─────────────────────────────────
  // Joe: "I love the X out the lies on the walls reveals the truth … It should be required and the heart should stay
  // hidden, perhaps it's hidden until you cross out the lies." The waiting room and the wall are written over with
  // what he told himself. Chalk a face of one and every line on it is struck through, and what's true is written over
  // them in red (`truths`, STORY_ROOMS in data/text.js). `liesToUndo` faces of a room (0: every one) and it's undone: its music stops.
  // Both undone and somewhere a wall gives — the heart's way in opens, and its heartbeat carries (HEART_HEAR_OPEN).
  // What's struck is kept for the run (`liesStruck`), stairs and all.
  let liesStruck = new Set(), heartOpened = false;
  const STRIKE = TEX.hex('#6e1a16'), TRUTH = TEX.hex('#b3302a');
  function crossOut(fk) {
    const st = story.find((q) => q.lieFaces && q.lieFaces.has(fk));
    if (!st || st.struck.has(fk)) return;
    st.struck.add(fk); liesStruck.add(fk);
    const d = decalFor(Math.floor(fk / 4), fk % 4), R = rng(SEED + fk);
    strikeLines(d, R);
    const truths = st.text.truths || [];
    if (truths.length) {
      // a band cleared for it, in whatever the face is under the writing (the wall's paint, or nothing: the paper)
      const line = truths[(st.struck.size - 1) % truths.length], words = line.split(' ');
      let n = 1, x = 0; for (const w of words) { if (x + w.length * 8 > 56 && x > 0) { n++; x = 0; } x += (w.length + 1) * 8; }
      const y0 = Math.max(2, Math.min(DEC - n * 11 - 2, 20 + (R() * 10 | 0))), ink = new Set([PENCIL, INK_BLUE, ...CRAYON, STRIKE].map((c) => c >>> 0)), tally = new Map();
      for (let i = 0; i < d.length; i++) if (!ink.has(d[i])) tally.set(d[i], (tally.get(d[i]) || 0) + 1);
      const under = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
      for (let y = y0 - 2; y < y0 + n * 11; y++) for (let x2 = 1; x2 < DEC - 1; x2++) d[y * DEC + x2] = under;
      hand(d, line, 4, y0, 56, 2, TRUTH, R);
    }
    FP_SOUND.crossOut(st.struck.size >= st.need);
    if (!st.undone && st.struck.size >= st.need) { st.undone = true; st.music = null; storyHere = -1; }
    if (story.filter((q) => q.lieFaces).every((q) => q.undone)) openHeart();
  }
  // a line through every line of writing on a face: the ink is found by its colours, grouped into rows, and each row
  // gets a chalk stroke through its middle from its first letter to its last
  function strikeLines(d, R) {
    const ink = new Set([PENCIL, INK_BLUE, ...CRAYON].map((c) => c >>> 0));   // the decal holds them unsigned
    const rows = [];
    for (let y = 0; y < DEC; y++) { let x0 = DEC, x1 = -1; for (let x = 0; x < DEC; x++) if (ink.has(d[y * DEC + x])) { if (x < x0) x0 = x; x1 = x; } rows.push(x1 >= 0 ? [x0, x1] : null); }
    for (let y = 0; y < DEC; ) {
      if (!rows[y]) { y++; continue; }
      let y1 = y, a = DEC, b = -1; while (y1 < DEC && rows[y1]) { a = Math.min(a, rows[y1][0]); b = Math.max(b, rows[y1][1]); y1++; }
      if (y1 - y >= 3) { let yy = (y + y1) >> 1; for (let x = Math.max(0, a - 1); x <= Math.min(DEC - 1, b + 1); x++) { if (R() < 0.12) yy += R() < 0.5 ? -1 : 1; yy = Math.max(y, Math.min(y1 - 1, yy)); d[yy * DEC + x] = STRIKE; if (R() < 0.6) d[Math.min(DEC - 1, yy + 1) * DEC + x] = STRIKE; } }
      y = y1;
    }
  }
  function openHeart(quiet) {
    if (heartOpened) return;
    heartOpened = true;
    if (!heart || !heart.sealed || floor !== 1) return;
    const rk = heart.ring, rx = rk % W, ry = (rk / W) | 0;
    tiles[ry][rx] = 1; crawlCells.add(rx + ',' + ry); low[rk] = 1; heart.sealed = false;
    for (let y = ry - 1; y <= ry + 1; y++) for (let x = rx - 1; x <= rx + 1; x++) {   // the corner shadows round the new gap
      if (solid(x, y)) { nbm[y * W + x] = 0; continue; }
      nbm[y * W + x] = (solid(x - 1, y) ? 1 : 0) | (solid(x + 1, y) ? 2 : 0) | (solid(x, y - 1) ? 4 : 0) | (solid(x, y + 1) ? 8 : 0)
        | (solid(x - 1, y - 1) ? 16 : 0) | (solid(x + 1, y - 1) ? 32 : 0) | (solid(x - 1, y + 1) ? 64 : 0) | (solid(x + 1, y + 1) ? 128 : 0);
    }
    buildSlots(); buildLight(); heartIndex();
    if (quiet) return;
    heart.vein = true; heartDark = performance.now(); if (!turned) turnNow();
    FP_SOUND.wallGives();
    // Joe: "If the door to the heart only opens after you X out the walls we need to give you a journal popup that says something
    // like 'something is opening up inside of me. I don't want anyone to find it though.'"
    const H8 = character && typeof STORY_ROOMS !== 'undefined' && STORY_ROOMS[character.name] && STORY_ROOMS[character.name].heart;
    if (H8 && H8.opens) giveJournal(H8.opens);
  }
  // the school look's boards, written on (CHALKBOARD in data/text.js), and its locked doors: faces nothing else goes
  // on. Each board gets lines written out over and over, or a lesson at the top. Its own stream
  function writeBoards() {
    const out = [];
    if (!T.walls.some((t) => t.board || t.locked)) return out;
    const R = rng(SEED + 230003), B = (typeof CHALKBOARD !== 'undefined' && (CHALKBOARD[character ? character.name : ''] || CHALKBOARD._)) || null;
    const CH = TEX.hex('#e9e6dc');
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!solid(x, y)) continue;
      const t = T.walls[wallVar[y * W + x]]; if (!t.board && !t.locked) continue;
      for (const [dx, dy] of HD) {
        if (solid(x - dx, y - dy)) continue;   // the face seen from the open tile at (x-dx, y-dy)
        const fk = faceKey(y * W + x, faceTo(dx, dy)); out.push(fk);
        if (t.board && decals.has(fk)) { const d = decals.get(fk); for (let i = 0; i < d.length; i++) if (d[i]) d[i] = CH; }   // words already here: in chalk, on a board
        if (!t.board || !B || decals.has(fk)) continue;
        const d = decalFor(y * W + x, faceTo(dx, dy));
        if (R() < 0.55) { const line = B.lines[Math.floor(R() * B.lines.length)]; let yy = 8; while (yy < 38) yy = hand(d, line, 3 + (R() * 2 | 0), yy, 58, 1, CH, R).y; }
        else hand(d, B.prompts[Math.floor(R() * B.prompts.length)], 7, 9, 52, 2, CH, R);
      }
    }
    return out;
  }
  // a wall face that is for something: the way out, a light switch, a closet (above)
  function usedFace(fk) { return !!exitFace[Math.floor(fk / 4)] || switchFace.has(fk) || memFace.has(fk); }
  function glyphsOff() { $('glyphs').classList.remove('show'); }
  for (const b of document.querySelectorAll('#glyphs [data-g]')) b.addEventListener('pointerdown', (e) => { e.stopPropagation(); placeMark(b.dataset.g); });

  // ── training ──────────────────────────────────────────────
  // Joe: "basic diegetic training. This happens only after a player has been given time to figure it out
  // themselves." Nothing is said up front. Stand five seconds without touching the stick (or WASD) and the stick
  // glows; stand a few seconds at a wall, a shut door, a closet, a switch or a squeeze's mouth and a quiet line
  // under the view says what to press (FP_TRAINING). Each is taught once ever — shown, or done before it had to be
  // shown — and remembered in its own store, apart from the knobs. Debug › Reset training forgets them all.
  const TKEY = 'maze.fp.training';
  const TRAIN_WAIT = { move: 5000, x: 3000, door: 2500, closet: 2500, light: 2500, squeeze: 2500 };
  const TRAIN_SHOW = 7000;   // how long a line stays up if you just stand there
  let learnt = {};
  try { learnt = JSON.parse(localStorage.getItem(TKEY) || '{}') || {}; } catch (e) {}
  // which words to use: a touch screen's or a keyboard's, by whichever was used last (a mouse counts as a keyboard)
  let touchy = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  addEventListener('pointerdown', (e) => { touchy = e.pointerType !== 'mouse'; }, { capture: true });
  addEventListener('keydown', () => { touchy = false; }, { capture: true });
  let trainShown = null, trainAt = 0, atHand = null, atHandSince = 0, stillSince = performance.now();
  function remember(what) { if (learnt[what]) return; learnt[what] = 1; try { localStorage.setItem(TKEY, JSON.stringify(learnt)); } catch (e) {} }
  function learn(what) {   // you did it: its line goes, and never comes
    if (what === 'move') stillSince = performance.now();
    if (trainShown === what) trainOff();
    remember(what);
  }
  function trainOff() { trainShown = null; $('hint').classList.add('gone'); stickEl.classList.remove('glow'); }
  function trainOn(what, now) {
    const line = (typeof FP_TRAINING !== 'undefined' && FP_TRAINING[what]) || null; if (!line) return;
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    $('hint').innerHTML = esc(line[touchy ? 0 : 1]).replace(/\*([^*]+)\*/g, '<b>$1</b>');
    $('hint').classList.remove('gone');
    if (what === 'move') stickEl.classList.add('glow');
    remember(what); trainShown = what; trainAt = now;   // shown is taught: it won't come again
  }
  // what is in front of you that there's a line for: the middle of the view, within reach
  function handAt() {
    const cx = RW >> 1, fk = colFace[cx];
    if (colDoor[cx] >= 0 && colDoorT[cx] < REACH_WALL + 0.4 && !doors[colDoor[cx]].open) return 'door';
    if (fk >= 0 && zbuf[cx] < REACH_WALL && closets.some((c) => faceKey(c.k, c.face) === fk)) return 'closet';
    if (fk >= 0 && zbuf[cx] < REACH_WALL + 0.3 && switchFace.has(fk)) return 'light';
    const tx = Math.floor(P.x), ty = Math.floor(P.y);
    if (!low[ty * W + tx]) for (const r of [0.7, 1.2]) {
      const ax = Math.floor(P.x + Math.cos(P.a) * r), ay = Math.floor(P.y + Math.sin(P.a) * r);
      if ((ax !== tx || ay !== ty) && slots.has(ay * W + ax)) return 'squeeze';
    }
    if (low[ty * W + tx] && slots.has(ty * W + tx)) learn('squeeze');   // in one: that's it learnt
    if (fk < 0 || zbuf[cx] > REACH_WALL || usedFace(fk) || colOv[cx]) return null;
    const wk = Math.floor(fk / 4);
    if (solid(wk % W, (wk / W) | 0) && T.walls[wallVar[wk]].locked) return null;   // a classroom door only rattles
    if (!S.chalkInf && chalk <= 0) return null;
    return 'x';
  }
  function trainFrame(now) {
    const busy = reading || rising || hidden || seated || won || stairBusy || $('opening').classList.contains('show') || $('panel').classList.contains('open');
    if (busy) { stillSince = now; atHandSince = now; if (trainShown) trainOff(); return; }
    if (stick.on || keys.fwd || keys.back || keys.left || keys.right || keys.sleft || keys.sright) stillSince = now;
    const h = handAt();
    if (h !== atHand) { atHand = h; atHandSince = now; }
    if (trainShown) {
      const gone = trainShown === 'move' ? now - stillSince < 50 : trainShown === 'throw' ? !carried.has('ball') : atHand !== trainShown;
      if (gone || (trainShown !== 'move' && trainShown !== 'throw' && now - trainAt > TRAIN_SHOW)) trainOff();   // walking's stays till you walk
      return;
    }
    if (!learnt.move) { if (now - stillSince > TRAIN_WAIT.move) trainOn('move', now); return; }   // walking first
    if (atHand && !learnt[atHand] && now - atHandSince > TRAIN_WAIT[atHand]) trainOn(atHand, now);
  }
  function resetTraining() { learnt = {}; try { localStorage.removeItem(TKEY); } catch (e) {} trainOff(); stillSince = atHandSince = performance.now(); }

  // ── the gear panel ────────────────────────────────────────
  const fmt = (k, v) => { const st = FP_RANGES[k][2]; return st < 1 ? (+v).toFixed(st < 0.05 ? 2 : st < 0.5 ? 2 : 1) : String(v); };
  const sliders = {};
  for (const k of Object.keys(FP_RANGES)) {
    const [lo, hi, st, label, sec] = FP_RANGES[k];
    const row = document.createElement('label');
    row.innerHTML = `<span>${label}</span><input type="range" min="${lo}" max="${hi}" step="${st}"><b></b>`;
    const inp = row.querySelector('input'), out = row.querySelector('b');
    inp.value = S[k]; out.textContent = fmt(k, S[k]);
    inp.addEventListener('input', () => { S[k] = +inp.value; out.textContent = fmt(k, S[k]); saveS(); if (k === 'sfxVol') FP_SOUND.setVolume(S.sfxVol); if (k === 'res') resize(); if (k === 'gapW') buildSlots(); if (k === 'reach' || k === 'darkHalls') buildLight(); });
    document.querySelector(`[data-knobs="${sec}"]`).appendChild(row);
    // while a slider is held, the panel steps out of the way: only this row stays, so the change
    // is what you are looking at
    inp.addEventListener('pointerdown', () => { $('panel').classList.add('drag'); row.classList.add('live'); });
    sliders[k] = { inp, out };
  }
  const endDrag = () => { $('panel').classList.remove('drag'); for (const r of document.querySelectorAll('#panel label.live')) r.classList.remove('live'); };
  addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
  // one section open at a time, so the card stays small; which one is remembered
  const secs = [...document.querySelectorAll('#panel details')];
  for (const d of secs) d.open = S.sec === d.dataset.sec;
  for (const d of secs) d.addEventListener('toggle', () => {
    if (d.open) { S.sec = d.dataset.sec; for (const o of secs) if (o !== d) o.open = false; }
    else if (S.sec === d.dataset.sec) S.sec = '';
    saveS();
  });
  const themeSel = $('optTheme');
  for (const [k, th] of Object.entries(TEX.themes)) { const o = document.createElement('option'); o.value = k; o.textContent = th.label; themeSel.appendChild(o); }
  const bindSel = (id, key, after) => { const el = $(id); el.value = String(S[key]); el.onchange = () => { S[key] = el.value === 'true' ? true : el.value === 'false' ? false : el.value; saveS(); if (after) after(); }; };
  bindSel('optTheme', 'theme', applyTheme);
  bindSel('optMove', 'move');
  bindSel('optBends', 'bends');
  bindSel('optMap', 'map');
  const applyStick = () => { document.body.dataset.stick = S.stickSide; };
  bindSel('optStick', 'stickSide', applyStick); applyStick();
  bindSel('optChalkInf', 'chalkInf', hud);
  bindSel('optShowPath', 'showPath');
  bindSel('optShowArrow', 'showArrow');
  {
    const lv = $('optLevel');
    for (const [i, L] of LEVELS.entries()) { const o = document.createElement('option'); o.value = String(i); o.textContent = L.label; lv.appendChild(o); }
    const st = $('optStones');
    for (let i = 0; i <= STONES.length; i++) { const o = document.createElement('option'); o.value = String(i); o.textContent = i + ' put down'; st.appendChild(o); }
    const rebuild = () => { newMaze(); $('panel').classList.remove('open'); };
    bindSel('optLevel', 'dbgLevel', rebuild);
    bindSel('optStones', 'dbgStones', rebuild);
    for (const k of MAZE_KEYS) bindSel('optM_' + k, 'dbg_' + k, rebuild);
  }
  $('gear').onclick = () => { $('panel').classList.toggle('open'); };
  // Joe: "When I have a debug window open and I tap outside of it, I want the debug window to close."
  // That tap only closes it: it doesn't also walk, chalk a wall or open a door behind the panel
  addEventListener('pointerdown', (e) => {
    const panel = $('panel');
    if (!panel.classList.contains('open') || panel.contains(e.target) || $('gear').contains(e.target)) return;
    panel.classList.remove('open'); e.stopPropagation(); e.preventDefault();
  }, { capture: true });
  $('close').onclick = () => $('panel').classList.remove('open');
  $('newMaze').onclick = () => { newMaze(); $('panel').classList.remove('open'); };
  // Restart: the same maze, back where you woke. Hard refresh: the latest build from the server and a
  // new maze — the top-down's hardRefresh(), and like it bounded so a dead connection still reloads.
  // Every script is fetched fresh as well as the page, since the scripts are what change.
  $('fatherNow').onclick = () => { fatherForce = true; fatherCheck = 0; $('panel').classList.remove('open'); };
  $('restart').onclick = () => { newMaze(BASE); $('panel').classList.remove('open'); };   // the same maze from the start: every floor, every page, the turn
  $('beingNow').onclick = () => { beingForce = true; beingNext = 0; $('panel').classList.remove('open'); };
  // full screen, for a PC (a phone's browser mostly has its own)
  $('fullscreen').onclick = () => {
    const d = document; try { if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen(); } catch (e) {}
    $('panel').classList.remove('open');
  };
  document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; });
  $('toHeart').onclick = () => {   // outside its way in, facing it
    $('panel').classList.remove('open'); if (!heart) return;
    const ox = heart.out % W, oy = (heart.out / W) | 0, rx = heart.ring % W, ry = (heart.ring / W) | 0;
    P.x = ox + 0.5; P.y = oy + 0.5; P.a = Math.atan2(ry - oy, rx - ox); lastX = P.x; lastY = P.y;
  };
  $('undoLies').onclick = () => {   // debug: cross out every room's lies, enough to undo it
    $('panel').classList.remove('open');
    for (const st of story) if (st.lieFaces) for (const fk of [...st.lieFaces].slice(0, st.need)) crossOut(fk);
  };
  $('leaveWatch').onclick = () => {   // debug: as if you'd been to the heart and brought the watch to the chair
    $('panel').classList.remove('open');
    const hs = story.find((q) => q.kind === 'heart'); if (hs) hs.found = true;
    const w = objs.find((o) => o.kind === 'watch'); if (w) objs.splice(objs.indexOf(w), 1);
    const seat = objs.find((o) => o.kind === 'slot') || objs.find((o) => o.seat); if (seat && !watchLeft) leaveWatch(seat);
  };
  $('shelveBook').onclick = () => {   // debug: as if you'd read the picture book and put it back on its shelf
    $('panel').classList.remove('open'); if (!kidBook || kidBook.shelved) return;
    const i = objs.indexOf(kidBook.o); if (i >= 0) objs.splice(i, 1); kidBook.read = true; carried.add('book'); shelveBook();
  };
  let storyVisit = 0;
  $('toStory').onclick = () => {
    $('panel').classList.remove('open'); if (!story.length) return;
    const st = story[storyVisit++ % story.length], m = st.m;
    P.x = m.mx + 0.5 - (m.rx - m.mx) * 0.3; P.y = m.my + 0.5 - (m.ry - m.my) * 0.3; P.a = Math.atan2(m.ry - m.my, m.rx - m.mx); lastX = P.x; lastY = P.y;
  };
  $('toStairs').onclick = () => {
    const s = stairs.up || stairs.down; $('panel').classList.remove('open'); if (!s) return;
    const [dx, dy] = s.dir; P.x = s.ox + 0.5; P.y = s.oy + 0.5; P.a = Math.atan2(dy, dx); lastX = P.x; lastY = P.y;
  };
  $('hardRefresh').onclick = () => {
    $('hardRefresh').textContent = 'Updating…';
    const urls = [location.pathname, ...[...document.scripts].map((sc) => sc.src).filter(Boolean)];
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).catch(() => {}))), timeout])
      .then(() => location.replace(location.pathname + '?u=' + Date.now()));   // core.js strips the stamp again on load
  };
  $('resetTraining').onclick = () => { $('panel').classList.remove('open'); resetTraining(); };
  $('resetKnobs').onclick = () => { try { localStorage.removeItem(SKEY); } catch (e) {} location.reload(); };
  $('ver').textContent = 'v' + VERSION + ' · first person';

  // ── sound ─────────────────────────────────────────────────
  // Joe: "pick what music is playing in the debug menu based off of the tracks we've created for the
  // different chapters". Follow the chapter is the top-down's own rule (a pool level plays 'pool');
  // anything else holds that track across new mazes until it's set back
  function track() {
    if (S.music !== 'auto' && MUSIC[S.music]) return S.music;
    if (storyMusic && MUSIC[storyMusic]) return storyMusic;   // a story room has its own
    if (turned && !lifted && MUSIC['The Turn']) return 'The Turn';   // and once the lights come back up, the chapter's own again
    return poolMode ? 'pool' : character && character.name;
  }
  {
    const ms = $('optMusic'), chapter = Object.fromEntries(PHASES.map((ph, i) => [ph.who, i]));
    for (const k of Object.keys(MUSIC)) {
      const o = document.createElement('option'); o.value = k;
      o.textContent = k in chapter ? chapter[k] + ' · ' + k : k === 'pool' ? 'The pool' : k;
      ms.appendChild(o);
    }
  }
  bindSel('optMusic', 'music', () => FP_SOUND.setMusic(track()));
  // Joe: "I lose audio a lot when I switch back and forth from apps. Can I make it so tapping the move
  // stick triggers the audio?" A phone suspends a page's sound when it goes to the background, and only
  // a touch may start it again. So every touch (the stick's included) and every key checks, and wakes
  // both — the room's and the music's — if either has stopped
  //
  // Joe, later: "I've lost sound now … I can get it to come in for a second, then it quits." A phone can stop a
  // context at any time — a call, another app taking the sound, the screen dimming — and on an iPhone a touch that
  // starts (pointerdown, touchstart) isn't always allowed to start it again; the end of one (touchend, click) is.
  // So every part of a touch wakes both, not only the start of it, and so does coming back to the page. Holding the
  // stick is one touch however long you walk, so the sound is checked every couple of seconds too, and a context
  // that has stopped is flagged for the next touch (`wake` is cheap when both are running). And on an iPhone the
  // page asks to be treated as something playing (`audioSession`), so the ringer switch doesn't silence it.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const wake = () => {
    if (!S.sound) return;
    if (!FP_SOUND.running()) { FP_SOUND.start(S.theme, track()); FP_SOUND.setEnabled(S.sound); FP_SOUND.unlock(); }
    if (typeof AUDIO !== 'undefined' && !AUDIO.running()) AUDIO.unlock();
  };
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'])
    addEventListener(ev, wake, { capture: true, passive: true });
  const soundBack = () => { if (document.visibilityState === 'visible') wake(); };
  addEventListener('visibilitychange', soundBack); addEventListener('pageshow', soundBack); addEventListener('focus', soundBack);
  setInterval(() => {   // a nudge only, never the full start (that fades the music in again)
    if (!S.sound || document.visibilityState !== 'visible' || !FP_SOUND.ran()) return;
    FP_SOUND.unlock(); if (typeof AUDIO !== 'undefined' && !AUDIO.running()) AUDIO.unlock();
  }, 2000);
  bindSel('optSound', 'sound', () => FP_SOUND.setEnabled(S.sound));

  // ── go ────────────────────────────────────────────────────
  let frames = 0, fpsAt = performance.now(), prev = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now;
    // debug: the arrow, pointing at the way out as the crow flies
    const arrowEl = $('dbgArrow');
    // up a floor, the way out is the door marked down
    const tg = nextGoal();
    if (S.showArrow) { arrowEl.style.display = ''; arrowEl.style.transform = `rotate(${(Math.atan2(tg.y + 0.5 - P.y, tg.x + 0.5 - P.x) - P.a) * 180 / Math.PI}deg)`; }
    else arrowEl.style.display = 'none';
    update(now, dt);
    render(now);
    trainFrame(now);
    drawMini(now);
    if (++frames >= 30) { $('fps').textContent = Math.round(frames * 1000 / (now - fpsAt)) + ' fps · ' + RW + '×' + RH + ' · sound ' + FP_SOUND.state() + (typeof AUDIO !== 'undefined' ? ', music ' + (AUDIO.running() ? 'running' : 'stopped') : ''); frames = 0; fpsAt = now; }
    requestAnimationFrame(frame);
  }
  applyTheme();
  resize();
  applyMazeDebug();
  BASE = SEED; generate(SEED); thinSqueezes(); carveHeart(); spreadPages(); reset(); opening(); lastX = P.x; lastY = P.y;
  requestAnimationFrame(frame);

  // for the checks in tools/, and for poking at from the console
  window.FP = { P, S, act, lightAt: lightAtPoint, get spotLamps() { return spotLamps; }, get kidBook() { return kidBook; }, openBook, shelveBook, get exitOpen() { return exitOpen(); }, get openingQuote() { return openingQuote; }, get seated() { return seated; }, getUp, get memFace() { return memFace; }, get catchT() { return catchT; }, get catchN() { return catchN; }, throwBall, useMemory, eyeAt: () => eyeNow(performance.now()), get lift() { return lift; }, get learnt() { return learnt; }, resetTraining, get trainShown() { return trainShown; }, newMaze, stick, toggleDoor, doorSeg, get low() { return low; }, get W() { return W; }, get decals() { return decals; }, get doors() { return doors; }, get closets() { return closets; }, get hidden() { return hidden; }, enterCloset, leaveCloset, get wordSpots() { return wordSpots; }, get objs() { return objs; }, get dark() { return dark; }, get light() { return tileL; }, get anim() { return anim; }, get won() { return won; }, get exitDir() { return exitDir; }, get father() { return father; }, get darter() { return darter; }, forceDart: () => { dartForce = true; dartSeen = new Set(); }, get lightGroups() { return lightGroups; }, get furn() { return furn; }, get fboxes() { return fboxes; }, get startWords() { return startWords; }, get floor() { return floor; }, get turned() { return turned; }, get being() { return being; }, get guard() { return guard; }, get vein() { return vein; }, get veinLvl() { return veinLvl; }, get darkMul() { return darkMul; }, get lifted() { return lifted; }, get turnFaces() { return turnFaces; }, get wordFaces() { return wordSpots; }, get beingSpeed() { return beingSpeed(); }, get beingState() { return beingState; }, get pathDist() { return pathDist; }, forceBeing: () => { beingForce = true; beingNext = 0; }, distField, get finds() { return finds; }, addFind, get lampsOut() { return lampsOut; }, get roomsOut() { return roomsOut; }, get roomsSpared() { return roomsSpared; }, get roomOf() { return roomOf; }, get wallVar() { return wallVar; }, hallOut, get story() { return story; }, get heart() { return heart; }, get heartAt() { return heartAt; }, get stairs() { return stairs; }, goFloor, get chalk() { return chalk; }, get exitLocked() { return exitLocked; }, get watchLeft() { return watchLeft; }, get beingStateNow() { return beingState; }, nextGoal, get heartOpened() { return heartOpened; }, crossOut, get carried() { return carried; }, startSpots, flipSwitch, fatherSpot, FS, forceFather: () => { fatherForce = true; fatherCheck = 0; }, get steps() { return steps; } };
})();
