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
    saved.cfg = 3;
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
  let wallVar = null, floorVar, ceilVar, low, exitFace, seen, nbm, room, flickers = [], lampLvl;
  const HD = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // heading 0 east, 1 south, 2 west, 3 north (y runs down)
  const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !tiles[y][x];
  const hash = (x, y) => { let h = (x * 73856093) ^ (y * 19349663) ^ SEED; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };

  function index() {
    wallVar = new Uint8Array(W * H); floorVar = new Uint8Array(W * H);
    low = new Uint8Array(W * H); exitFace = new Uint8Array(W * H);
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
      if (solid(fx, fy) && !solid(bx, by) && fx >= 0 && fy >= 0 && fx < W && fy < H) exitFace[fy * W + fx] = 1;
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
  let dark = null, tileL = null, cornerL = null, lightBase = null, flickLamps = [], lampTiles = [];
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
      if (run.length < 3 || R() >= S.darkHalls) return;
      if (run.some(([x, y]) => (Math.abs(x - sx0) < 3 && Math.abs(y - sy0) < 3) || (x === exit.x && y === exit.y))) return;
      for (const [x, y] of run) dark[y * W + x] = 1;
    };
    for (let y = 0; y < H; y++) { let run = []; for (let x = 0; x <= W; x++) { if (x < W && inHall(x, y, true)) run.push([x, y]); else { takeRun(run); run = []; } } }
    for (let x = 0; x < W; x++) { let run = []; for (let y = 0; y <= H; y++) { if (y < H && inHall(x, y, false)) run.push([x, y]); else { takeRun(run); run = []; } } }

    lightBase = new Float32Array(N).fill(T.ceils ? T.ambient : 1);
    flickLamps = []; lampTiles = [];
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
      if (flick.has(k)) flickLamps.push({ k, list });
      else for (let i = 0; i < list.length; i += 2) lightBase[list[i]] += list[i + 1];
    }
  }
  // this frame's brightness, at tiles and at their corners
  function lightFrame() {
    const N = W * H;
    tileL.set(lightBase);
    for (const lm of flickLamps) { const lv = lampLvl[lm.k]; for (let i = 0; i < lm.list.length; i += 2) tileL[lm.list[i]] += lm.list[i + 1] * lv; }
    for (let k = 0; k < N; k++) {
      let L = 1 - S.shadow * (1 - Math.min(1, tileL[k]));
      if (dark[k]) L = Math.min(L, S.darkLevel);
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
    index();
    placeThings();
    const tx = Math.floor(start.x), ty = Math.floor(start.y);
    // face the longest open run from where you wake, so the first thing you see is a way to go
    let best = 0, bestH = 0;
    HD.forEach(([dx, dy], h) => { let n = 0; while (!solid(tx + dx * (n + 1), ty + dy * (n + 1)) && n < 40) n++; if (n > best) { best = n; bestH = h; } });
    P.x = tx + 0.5; P.y = ty + 0.5; P.a = bestH * QUARTER;
    anim = null; queued = null; steps = 0; won = false; vel = 0; lastTile = '';
    fatherReset();
    $('win').classList.remove('show');
    arrive();
    $('seed').textContent = SEED;
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
  let objs = [], decals = new Map(), wordSpots = [], chalk = 0, charcoalN = 0, pagesFound = 0, pagesTotal = 0;
  const faceKey = (k, face) => k * 4 + face;   // face: 0 west, 1 east, 2 north, 3 south — the side of the wall tile you see
  function decalFor(k, face) {
    let d = decals.get(faceKey(k, face));
    if (!d) { d = new Uint32Array(DEC * DEC); decals.set(faceKey(k, face), d); }
    return d;
  }
  function placeThings() {
    objs = []; decals = new Map(); chalk = CONFIG.chalkStart; charcoalN = 0; pagesFound = 0;
    const at = (key) => key.split(',').map(Number);
    for (const [key, pg] of journals) { const [x, y] = at(key); objs.push({ x: x + 0.5, y: y + 0.5, kind: 'page', pg, tex: TEX.sprites.book, h: 0.3, glow: 0.35 }); }
    for (const key of chalkSpots) { const [x, y] = at(key); objs.push({ x: x + 0.5, y: y + 0.5, kind: 'chalk', tex: TEX.sprites.chalk, h: 0.1, glow: 0.2 }); }
    for (const key of charcoalSpots) { const [x, y] = at(key); objs.push({ x: x + 0.5, y: y + 0.5, kind: 'charcoal', tex: TEX.sprites.charcoal, h: 0.1, glow: 0 }); }
    pagesTotal = journals.size;
    pathMask = new Uint8Array(W * H);
    for (const [x, y] of solutionPath) if (x >= 0 && y >= 0 && x < W && y < H) pathMask[y * W + x] = 1;
    // words at the far end of dead ends: the wall you face as you walk in. Their own random stream,
    // so where they fall never moves anything else
    const R = rng(SEED + 130003), words = WALL_WORDS[character ? character.name : ''] || WALL_WORDS._;
    const sx0 = Math.floor(start.x), sy0 = Math.floor(start.y), ends = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (solid(x, y) || low[y * W + x] || (Math.abs(x - sx0) < 3 && Math.abs(y - sy0) < 3)) continue;
      const open = HD.filter(([dx, dy]) => !solid(x + dx, y + dy));
      if (open.length !== 1) continue;
      const [ox, oy] = open[0], dx = -ox, dy = -oy;   // walking in, you face away from the one way out
      const face = dx === 1 ? 0 : dx === -1 ? 1 : dy === 1 ? 2 : 3;
      ends.push({ k: (y + dy) * W + x + dx, face });
    }
    // choose every spot and line first, then draw: the hand's wobble draws from the stream too, and
    // must not move where the next line goes
    const pool = words.slice(), picks = [];
    for (let n = 0; n < S.words && ends.length && pool.length; n++)
      picks.push([ends.splice(Math.floor(R() * ends.length), 1)[0], pool.splice(Math.floor(R() * pool.length), 1)[0]]);
    wordSpots = picks.map(([e, text]) => ({ k: e.k, face: e.face, text }));
    for (const [e, text] of picks) writeWords(decalFor(e.k, e.face), text, R);
    placeDoors();
    placeClosets(new Set(picks.map(([e]) => faceKey(e.k, e.face))));
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
      if (solid(x, y) || low[k] || room[k] || taken.has(k) || near(x, y, 3) || (x === exit.x && y === exit.y)) continue;
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
    const R = rng(SEED + 160001), sx0 = Math.floor(start.x), sy0 = Math.floor(start.y), cand = [];
    const doorTiles = new Set(doors.map((d) => d.k));
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      // not in a dark hall: the point of a closet is what you can see from it
      if (solid(x, y) || low[y * W + x] || dark[y * W + x] || doorTiles.has(y * W + x) || (Math.abs(x - sx0) < 3 && Math.abs(y - sy0) < 3)) continue;
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
  function enterCloset(c) {
    // stand in the doorway, in the wall's own face, looking out through the vent
    const fx = c.dx === 1 ? c.x : c.dx === -1 ? c.x + 1 : c.x + 0.5, fy = c.dy === 1 ? c.y : c.dy === -1 ? c.y + 1 : c.y + 0.5;
    hidden = { c, back: { x: P.x, y: P.y, a: P.a }, a0: Math.atan2(c.dy, c.dx) };
    P.x = fx + c.dx * 0.04; P.y = fy + c.dy * 0.04; P.a = hidden.a0; vel = 0; clearStick();
    document.body.classList.add('hiding'); FP_SOUND.hide(true);
  }
  function leaveCloset() {
    if (!hidden) return;
    const c = hidden.c;
    P.x = c.x + 0.5; P.y = c.y + 0.5; P.a = hidden.a0; hidden = null;
    document.body.classList.remove('hiding'); FP_SOUND.hide(false);
  }
  $('stepOut').addEventListener('pointerdown', (e) => { e.stopPropagation(); leaveCloset(); });

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
      '-': ['...', '...', '###', '...', '...'], '—': ['...', '...', '###', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
    };
    const out = {}; for (const k in G) out[k] = G[k].join(''); return out;
  })();
  const INK = TEX.hex('#2a2622'), CHALK = TEX.hex('#ece7da');
  function writeWords(d, text, R) {
    const lines = [];
    for (const w of text.toLowerCase().split(' ')) {
      if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= 8) lines[lines.length - 1] += ' ' + w; else lines.push(w);
    }
    const sc = 2, lh = 6 * sc + 2, y0 = Math.round(DEC * 0.42 - lines.length * lh / 2);
    lines.forEach((ln, li) => {
      const x0 = Math.round((DEC - ln.length * 4 * sc) / 2) + Math.round((R() - 0.5) * 4);
      for (let c = 0; c < ln.length; c++) {
        const g = FONT[ln[c]]; if (!g) continue;
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '#')
          for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
            const X = x0 + (c * 4 + q) * sc + xx, Y = y0 + li * lh + r * sc + yy + (c % 3 === 1 ? 1 : 0);   // a hand, not a printer
            if (X >= 0 && X < DEC && Y >= 0 && Y < DEC && R() < 0.97) d[Y * DEC + X] = INK;
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
  }
  function take(o) {
    objs.splice(objs.indexOf(o), 1); foundAt = performance.now();
    if (o.kind === 'chalk') { chalk += CONFIG.chalkPerPickup; flash('hudChalkBox'); FP_SOUND.chalkUp(); }
    else if (o.kind === 'charcoal') { charcoalN++; flash('hudCharcoalBox'); FP_SOUND.chalkUp(); }
    else if (o.kind === 'page') { pagesFound++; flash('hudPagesBox'); showPage(o.pg); FP_SOUND.page(); }
    hud();
  }
  function flash(id) { const el = $(id); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  let pageHideAt = 0;
  function showPage(pg) {
    const text = character && character.pages ? character.pages[pg] : '';
    $('pageText').textContent = text || '…';
    $('pageWho').textContent = character ? character.name : '';
    $('page').classList.add('show');
    pageHideAt = performance.now() + (CONFIG.journalHoldSec + (text || '').length / 30) * 1000;
  }
  function hidePage() { $('page').classList.remove('show'); pageHideAt = 0; }
  $('page').addEventListener('pointerdown', (e) => { e.stopPropagation(); hidePage(); });

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
    try { history.replaceState(null, '', location.pathname + '?seed=' + SEED); } catch (e) {}
    applyMazeDebug();
    generate(SEED); reset();
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
    for (const o of objs.slice()) if (Math.floor(o.x) === tx && Math.floor(o.y) === ty) take(o);
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
    for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) {
      if (solid(xx, yy)) { push(xx, yy, xx + 1, yy + 1); continue; }
      const bx = boxesAt(yy * W + xx);
      if (bx) for (let i = 0; i < bx.length; i += 4) push(bx[i], bx[i + 1], bx[i + 2], bx[i + 3]);
    }
  }

  function stickMove(now, dt) {
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
  function fatherReset() { father = null; fatherLeft = S.father; fatherNext = performance.now() + 20000; foundAt = -1e9; }
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
      if (n < FS.near || room[k] || tileL[k] < FS.lit) continue;   // not on top of you, not in a room, not in the dark
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
    if (won) return;
    doorsFrame(dt);
    fatherFrame(now, dt);
    stickMove(now, dt);
    stepAnim(now);
    // one dip of the head per tile walked, however you walked it; standing still, it settles
    const moved = Math.hypot(P.x - lastX, P.y - lastY); lastX = P.x; lastY = P.y;
    sounds(moved, dt);
    if (moved > 0.0005) walkPhase += moved; else walkPhase += (Math.round(walkPhase) - walkPhase) * Math.min(1, dt * 8);
    arrive();
  }
  // what walking sounds like: a foot down every STRIDE of ground covered, the hum of whichever lamp
  // is nearest (as bright as it is right now), and the rub of a squeeze while you're moving in one
  const STRIDE = 0.62;
  let strideLeft = STRIDE * 0.5;
  function sounds(moved, dt) {
    const tx = Math.floor(P.x), ty = Math.floor(P.y), inSqueeze = !!low[ty * W + tx];
    if (moved > 0.0005 && !hidden) {
      strideLeft -= moved;
      if (moved > 0.5) strideLeft = STRIDE;   // a jump (a restart, a closet) is not a stride
      else if (strideLeft <= 0) { strideLeft = Math.max(strideLeft + STRIDE, STRIDE * 0.5); FP_SOUND.step(moved / Math.max(dt, 1e-3) / S.walk, inSqueeze); }
    }
    let humL = 0;
    for (const k of lampTiles) { const d = Math.hypot(k % W + 0.5 - P.x, ((k / W) | 0) + 0.5 - P.y); if (d < 3) humL = Math.max(humL, (1 - d / 3) * lampLvl[k]); }
    const speed = moved / Math.max(dt, 1e-3);
    FP_SOUND.frame(humL, inSqueeze ? Math.min(1, speed / Math.max(0.05, S.walk * S.squeezeSlow)) : 0);
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
    const hor = RH / 2 + bob, eye = S.eye, fog = S.fog;
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
    lightFrame();
    const cw = W + 1;   // corner rows, for blending the light across each tile inline
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
          if (t.glow && t.glow[ti] && !(inB && dark[k])) { buf[o] = shade(t.px[ti], fl, inB ? lampLvl[k] : 1); continue; }   // a lamp is its own light
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
        const t = inB ? floors[floorVar[cy * W + cx]] : floors[0], fx = wx - cx, fy = wy - cy;
        let L = 1;
        if (inB) { const i = cy * cw + cx, a = cornerL[i] + (cornerL[i + 1] - cornerL[i]) * fx, b2 = cornerL[i + cw] + (cornerL[i + cw + 1] - cornerL[i + cw]) * fx; L = a + (b2 - a) * fy; if (low[cy * W + cx]) L *= S.squeezeDim; }
        const fc = t.px[((fy * 32) | 0) * 32 + ((fx * 32) | 0)];
        buf[o] = shade(showPath && inB && pathMask[cy * W + cx] ? PATH_TINT(fc) : fc, f, inB ? aoAt(nbm[cy * W + cx], fx, fy) : 1, L);
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
        const dk = inB && !slot ? faceKey(my * W + mx, sd === 0 ? (stX > 0 ? 0 : 1) : (stY > 0 ? 2 : 3)) : -1;
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
          if (dec) { const dc = dec[Math.min(DEC - 1, (v * DEC) | 0) * DEC + du]; if (dc) c = dc; }
          buf[y * RW + x] = shade(c, f, lit * a, Lw);
        }
      }
    }
    drawDoors(px, py, dX, dY, plX, plY, D, hor, eye, fog);
    drawObjects(px, py, dX, dY, plX, plY, D, hor, eye, fog);
    veilSqueezes(D, hor, eye);
    ctx.putImageData(img, 0, 0);
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

  function lightAtPoint(x, y) {   // the light blended across the tile corners, at any point
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return 1;
    const fx = x - cx, fy = y - cy, w = W + 1, i = cy * w + cx;
    const a = cornerL[i] + (cornerL[i + 1] - cornerL[i]) * fx, b = cornerL[i + w] + (cornerL[i + w + 1] - cornerL[i + w]) * fx;
    return a + (b - a) * fy;
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
  const drawn = [];   // this frame's objects on screen: {o, x0, x1, y0, y1, depth}, for a tap to find
  function drawObjects(px, py, dX, dY, plX, plY, D, hor, eye, fog) {
    drawn.length = 0;
    const det = dX * plY - dY * plX, list = [];
    for (const o of father ? objs.concat(father) : objs) {
      const rx = o.x - px, ry = o.y - py;
      const depth = (rx * plY - ry * plX) / det, cam = (dX * ry - dY * rx) / det / depth;   // along the view, and across it
      if (depth < 0.15 || Math.abs(cam) > 1.6) continue;
      list.push({ o, depth, cam });
    }
    list.sort((a, b) => b.depth - a.depth);   // far first, so near ones cover
    for (const { o, depth, cam } of list) {
      const t = o.tex, sc = D / depth, hPx = o.h * sc, wPx = hPx * t.w / t.h;
      const floorY = hor + eye * sc, y0 = floorY - hPx, xc = (cam + 1) / 2 * RW;
      const x0 = Math.round(xc - wPx / 2), x1 = Math.round(xc + wPx / 2);
      const f = Math.exp(-fog * depth), tx0 = Math.floor(o.x), ty0 = Math.floor(o.y);
      const L = Math.max(o.glow, tileL[ty0 * W + tx0]);   // a page catches what light there is; it is meant to be found
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
          if (c && (!ghost || DITH[(y & 3) * 4 + (x & 3)] < o.alpha)) buf[y * RW + x] = shade(c, f, 1, L);
        }
      }
      if (ghost) continue;   // the father is seen, never touched
      // a generous target, well past the picture on every side: fingers are wide and things are small
      if (any) drawn.push({ o, x0: x0 - wPx * 0.6, x1: x1 + wPx * 0.6, y0: y0 - hPx - 10, y1: floorY + hPx + 14, depth });
    }
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
    const full = S.map === 'full', doorAt = new Set(doors.map((d) => d.k));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!full && !seen[y * W + x]) continue;
      mctx.fillStyle = solid(x, y) ? '#5c5850' : low[y * W + x] ? '#53402a' : doorAt.has(y * W + x) ? '#826846' : dark[y * W + x] ? '#050506' : '#1e1c1a';
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
    FP_SOUND.out();
    $('winSteps').textContent = steps + ' steps';
    $('win').classList.add('show');
  }
  $('again').onclick = () => newMaze();

  // ── keys ──────────────────────────────────────────────────
  const KEYS = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'sleft', KeyE: 'sright', ShiftLeft: 'shift', ShiftRight: 'shift' };
  const keys = {};
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const a = KEYS[e.code]; if (!a) return;
    e.preventDefault(); hideHint();
    keys[a] = true;
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
  stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); hideHint(); stickId = e.pointerId; stickEl.classList.add('on'); try { stickEl.setPointerCapture(e.pointerId); } catch (err) {} setStick(e.clientX, e.clientY); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e.clientX, e.clientY); });
  stickEl.addEventListener('pointerup', clearStick); stickEl.addEventListener('pointercancel', clearStick);

  // ── tapping the view ──────────────────────────────────────
  // Joe: "we are good to get rid of the tap to move and just use the joystick, or WASD on PC" — a tap
  // on the view is for touching what is in it. Near a thing: take it. Near a wall: chalk it. Only
  // what is within arm's reach answers; the rest of the view does nothing.
  const REACH_THING = 2.2, REACH_WALL = 1.6;
  let touch = null, pendingMark = null;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); hideHint();
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
  function tapAt(bx, by) {
    glyphsOff();
    // a thing first: the nearest one under the finger
    let hit = null;
    for (const d of drawn) if (bx >= d.x0 - 6 && bx <= d.x1 + 6 && by >= d.y0 && by <= d.y1 && d.depth < REACH_THING && (!hit || d.depth < hit.depth)) hit = d;
    if (hit) { take(hit.o); return; }
    const x = Math.max(0, Math.min(RW - 1, bx | 0));
    if (hidden) return;   // from inside a closet you can only step out
    // a door under the finger: open it, or shut it
    if (colDoor[x] >= 0 && colDoorT[x] < REACH_WALL + 0.4 && by >= colDoorTop[x] - 8 && by <= colDoorBot[x]) { toggleDoor(doors[colDoor[x]]); return; }
    // a closet: step in. Joe: "light switches or any other thing you interact with on a wall [should]
    // not allow you to put an X on the wall as well" — a face that does something is never chalked,
    // anywhere on it, whether or not the tap landed on the thing itself
    const cl = closets.find((c) => faceKey(c.k, c.face) === colFace[x]);
    if (cl) { if (zbuf[x] < REACH_WALL && colU[x] > 0.32 && colU[x] < 0.68) enterCloset(cl); return; }
    if (colFace[x] >= 0 && usedFace(colFace[x])) return;
    // then the wall under the finger, if it is close enough to touch
    if (colFace[x] < 0 || zbuf[x] > REACH_WALL || by < colTop[x] || by > colBot[x]) return;
    const cu = colU[x], cv2 = (by - colTop[x]) / (colBot[x] - colTop[x]);
    if (!S.chalkInf && chalk <= 0) { flash('hudChalkBox'); FP_SOUND.empty(); return; }
    pendingMark = { fk: colFace[x], u: Math.max(0.15, Math.min(0.85, cu)), v: Math.max(0.15, Math.min(0.85, cv2)) };
    // early on chalk only makes an X, as in the top-down; once signs are open, you choose
    if (typeof phase === 'function' && phase().f.signs) { $('glyphs').classList.add('show'); } else placeMark('x');
  }
  function placeMark(glyph) {
    if (!pendingMark) return;
    const k = Math.floor(pendingMark.fk / 4), face = pendingMark.fk % 4;
    chalkSign(decalFor(k, face), glyph, pendingMark.u, pendingMark.v);
    if (!S.chalkInf) chalk--;
    FP_SOUND.chalkMark();
    pendingMark = null; glyphsOff(); hud();
  }
  // a wall face that is for something: the way out, a closet (above). Light switches join this list
  function usedFace(fk) { return !!exitFace[Math.floor(fk / 4)]; }
  function glyphsOff() { $('glyphs').classList.remove('show'); }
  for (const b of document.querySelectorAll('#glyphs [data-g]')) b.addEventListener('pointerdown', (e) => { e.stopPropagation(); placeMark(b.dataset.g); });

  let hintHidden = false;
  function hideHint() { if (hintHidden) return; hintHidden = true; $('hint').classList.add('gone'); }

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
  $('gear').onclick = () => { hideHint(); $('panel').classList.toggle('open'); };
  $('close').onclick = () => $('panel').classList.remove('open');
  $('newMaze').onclick = () => { newMaze(); $('panel').classList.remove('open'); };
  // Restart: the same maze, back where you woke. Hard refresh: the latest build from the server and a
  // new maze — the top-down's hardRefresh(), and like it bounded so a dead connection still reloads.
  // Every script is fetched fresh as well as the page, since the scripts are what change.
  $('fatherNow').onclick = () => { fatherForce = true; fatherCheck = 0; $('panel').classList.remove('open'); };
  $('restart').onclick = () => { reset(); $('panel').classList.remove('open'); };
  $('hardRefresh').onclick = () => {
    $('hardRefresh').textContent = 'Updating…';
    const urls = [location.pathname, ...[...document.scripts].map((sc) => sc.src).filter(Boolean)];
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).catch(() => {}))), timeout])
      .then(() => location.replace(location.pathname + '?u=' + Date.now()));   // core.js strips the stamp again on load
  };
  $('resetKnobs').onclick = () => { try { localStorage.removeItem(SKEY); } catch (e) {} location.reload(); };
  $('ver').textContent = 'v' + VERSION + ' · first person';

  // ── sound ─────────────────────────────────────────────────
  // Joe: "pick what music is playing in the debug menu based off of the tracks we've created for the
  // different chapters". Follow the chapter is the top-down's own rule (a pool level plays 'pool');
  // anything else holds that track across new mazes until it's set back
  function track() {
    if (S.music !== 'auto' && MUSIC[S.music]) return S.music;
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
  const wake = () => { FP_SOUND.start(S.theme, track()); FP_SOUND.setEnabled(S.sound); };
  addEventListener('pointerdown', wake, { capture: true, once: true });
  addEventListener('keydown', wake, { capture: true, once: true });
  bindSel('optSound', 'sound', () => FP_SOUND.setEnabled(S.sound));

  // ── go ────────────────────────────────────────────────────
  let frames = 0, fpsAt = performance.now(), prev = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now;
    if (pageHideAt && now > pageHideAt) hidePage();
    // debug: the arrow, pointing at the way out as the crow flies
    const arrowEl = $('dbgArrow');
    if (S.showArrow) { arrowEl.style.display = ''; arrowEl.style.transform = `rotate(${(Math.atan2(exit.y + 0.5 - P.y, exit.x + 0.5 - P.x) - P.a) * 180 / Math.PI}deg)`; }
    else arrowEl.style.display = 'none';
    update(now, dt);
    render(now);
    drawMini(now);
    if (++frames >= 30) { $('fps').textContent = Math.round(frames * 1000 / (now - fpsAt)) + ' fps · ' + RW + '×' + RH; frames = 0; fpsAt = now; }
    requestAnimationFrame(frame);
  }
  applyTheme();
  resize();
  applyMazeDebug();
  generate(SEED); reset(); lastX = P.x; lastY = P.y;
  requestAnimationFrame(frame);

  // for the checks in tools/, and for poking at from the console
  window.FP = { P, S, act, newMaze, stick, toggleDoor, doorSeg, get low() { return low; }, get W() { return W; }, get decals() { return decals; }, get doors() { return doors; }, get closets() { return closets; }, get hidden() { return hidden; }, enterCloset, leaveCloset, get wordSpots() { return wordSpots; }, get objs() { return objs; }, get dark() { return dark; }, get light() { return tileL; }, get anim() { return anim; }, get won() { return won; }, get father() { return father; }, fatherSpot, FS, forceFather: () => { fatherForce = true; fatherCheck = 0; }, get steps() { return steps; } };
})();
