// The Maze — prototypes
//
// Small purpose-built levels for trying one idea on its own, chosen from the
// Prototype dropdown in the debug menu. A prototype replaces the maze entirely:
// buildProto() sets every global generate() would have set and generate()
// returns, so nothing downstream has to know a prototype is running.
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── two-way blocks ──────────────────────────────────────────────
// A block is the floor you are standing on. Shove it and it slides one step into
// the wall beside you, bridging to the next island; you ride across and step off,
// and it stays there as a bridge. A plain slider has one way to go. These have two:
//
//   in line   ← ▣ →     the block's own square, and one either side of it
//   elbow     ↑ ▣ →     the same three squares, bent round a corner
//
// From home it will take either; once it has gone one way it can only come back,
// so a wrong choice costs the walk back rather than the level. Three squares in
// all, whichever shape it is.
//
// The level is a grid of islands with no bridges at all. A path of blocks runs
// from where you wake to the way out, and every block on it also offers a way
// that goes nowhere. Which is the question: of the two, which one goes on.

function protoDirs() { return [[1, 0], [-1, 0], [0, 1], [0, -1]]; }

// everything empty, the grid sized and cleared: a prototype carries none of the maze's furniture
function protoReset(cols, rows) {
  protoMode = true; protoWide = true; poolMode = false; keyVault = null;
  [CONFIG.cols, CONFIG.rows] = cols;
  void rows;
  W = CONFIG.cols * 2 + 1 + 2 * P; H = CONFIG.rows * 2 + 1 + 2 * P;
  tiles = Array.from({ length: H }, () => new Uint8Array(W));
  journals = new Map(); pickups = new Map(); chalkSpots = new Set(); charcoalSpots = new Set();
  scrapSpots = new Set(); doors = []; innerKeys = new Map(); heldKeys = new Set();
  crawlGaps = new Set(); crawlCells = new Set(); hopscotch = []; ticTacToe = null;
  figures = []; darkTiles = new Set(); darkFringe = new Map(); lampSpot = null; keySpot = null;
  sealedGaps = []; pockets = []; tunnelTiles = new Set(); clusters = []; sliders = [];
  secretTiles = new Set(); secretMarks = new Map(); secretSwitch = null; secretFather = null;
  startArrow = null; exitTree = new Set(); exitTreeMouth = null; secretReserve = null;
  startRoom = null; startGap = null; poolDoor = null; gated = false; exitAlley = [];
  landmarks = []; sections = [];
  character = CAST[0]; journalIdx = 0;
}

// ── the gallery ──────────────────────────────────────────────────────────────
// Joe: "I think you should make a prototype room with each of the major rooms we have connected to
// each other. This way, we can easily test and debug and look at them." One room per landmark kind,
// in a row of bays off a spine you walk down, so every one of them is a few seconds apart and none
// of them is behind a maze.
function buildGallery(seed) {
  const kinds = LANDMARK_KINDS;
  const bay = CONFIG.galleryBay;                       // cells square, per room
  const cols = kinds.length * (bay + 1) + 1, rows = bay + 5;
  protoReset([cols, rows]);
  protoWide = true;
  const TXc = (c) => c * 2 + 1 + P;
  const openCell = (cx, cy) => { tiles[TXc(cy)][TXc(cx)] = 1; };
  const openLink = (cx, cy, dx, dy) => { tiles[TXc(cy) + dy][TXc(cx) + dx] = 1; };
  const openBlock = (cx0, cy0, w, h) => {             // a solid rectangle of floor, links and all
    for (let y = TXc(cy0); y <= TXc(cy0 + h - 1); y++)
      for (let x = TXc(cx0); x <= TXc(cx0 + w - 1); x++) tiles[y][x] = 1;
  };
  // the spine, along the bottom
  const spineY = rows - 2;
  for (let cx = 0; cx < cols; cx++) { openCell(cx, spineY); if (cx) openLink(cx, spineY, -1, 0); }
  // a bay per kind, opening off it
  kinds.forEach((kind, i) => {
    const cx0 = 1 + i * (bay + 1), cy0 = spineY - bay - 1;
    openBlock(cx0, cy0, bay, bay);
    const doorX = cx0 + (bay >> 1);
    openCell(doorX, spineY - 1); openLink(doorX, spineY - 1, 0, 1); openLink(doorX, cy0 + bay - 1, 0, 1);
    landmarks.push({ x: TXc(cx0 + (bay >> 1)), y: TXc(cy0 + (bay >> 1)), kind, room: i,
      rx0: TXc(cx0), ry0: TXc(cy0), rx1: TXc(cx0 + bay - 1), ry1: TXc(cy0 + bay - 1) });
    // columns are the one that is really there, so shut them here too
    // columns and statues are the ones that are really there, so shut them here too
    if (kind === 'columns' || kind === 'statues') { const L = landmarks[landmarks.length - 1];
      L.cols = standOn(L.rx0, L.ry0, L.rx1, L.ry1, kind === 'statues' ? 6 : 4); }
  });
  start = { x: TXc(0) + 0.5, y: TXc(spineY) + 0.5 };
  exit = { x: TXc(cols - 1), y: TXc(spineY) };
  solutionPath = [];
  for (let cx = 0; cx < cols; cx++) { solutionPath.push([TXc(cx), TXc(spineY)]); if (cx < cols - 1) solutionPath.push([TXc(cx) + 1, TXc(spineY)]); }
  return true;
}

function buildProto(seed, kind) {
  if (kind === 'laby') return buildLabyrinth(seed);
  if (kind === 'gallery') return buildGallery(seed);
  const R = rng(seed);
  protoReset(CONFIG.protoSize);
  const TXc = (c) => c * 2 + 1 + P;

  // every cell is an island of floor. Nothing joins them: the blocks are the bridges.
  for (let cy = 0; cy < CONFIG.rows; cy++) for (let cx = 0; cx < CONFIG.cols; cx++) tiles[TXc(cy)][TXc(cx)] = 1;

  const key = (cx, cy) => cx + ',' + cy;
  const inGrid = (cx, cy) => cx >= 0 && cy >= 0 && cx < CONFIG.cols && cy < CONFIG.rows;

  let path = null;
  for (let tries = 0; tries < 200 && !path; tries++) {
    // a wandering line of islands from one corner, as long as it will go
    const from = [0, CONFIG.rows - 1];
    const seen = new Set([key(...from)]), line = [from];
    while (line.length < CONFIG.protoPath) {
      const [cx, cy] = line[line.length - 1];
      const opts = protoDirs().map(([dx, dy]) => [cx + dx, cy + dy])
        .filter(([nx, ny]) => inGrid(nx, ny) && !seen.has(key(nx, ny)));
      if (!opts.length) break;
      const p = opts[R() * opts.length | 0];
      seen.add(key(...p)); line.push(p);
    }
    if (line.length >= CONFIG.protoPath) path = line;
  }
  if (!path) path = [[0, CONFIG.rows - 1], [1, CONFIG.rows - 1], [2, CONFIG.rows - 1]];

  const onPath = new Set(path.map(c => key(...c)));
  sliders = [];
  const taken = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    const [cx, cy] = path[i], [nx, ny] = path[i + 1];
    const onward = [nx - cx, ny - cy];
    // and one that goes nowhere: any other side with an island behind it that is not on the way
    const decoys = protoDirs().filter(([dx, dy]) => (dx !== onward[0] || dy !== onward[1])
      && inGrid(cx + dx, cy + dy) && !onPath.has(key(cx + dx, cy + dy)) && !taken.has(key(cx + dx, cy + dy)));
    const ways = [onward];
    if (decoys.length && R() < CONFIG.protoDecoyChance) {
      // straight through or round an elbow. Two of the three other sides are perpendicular, so
      // left to chance the elbows win two to one; this evens them up.
      const back = decoys.filter(([dx, dy]) => dx === -onward[0] && dy === -onward[1]);
      const bent = decoys.filter(([dx, dy]) => !(dx === -onward[0] && dy === -onward[1]));
      const pool = (back.length && (!bent.length || R() < CONFIG.protoStraightBias)) ? back : bent;
      const d = pool[R() * pool.length | 0];
      ways.push(d); taken.add(key(cx + d[0], cy + d[1]));
    }
    ways.sort(() => R() - 0.5);
    // the first one glints if you stand still, the way the start-room block does, so the one
    // thing you have to learn here teaches itself. It does not spend the real game's first push.
    sliders.push({ x: TXc(cx), y: TXc(cy), dx: ways[0][0], dy: ways[0][1], ways, at: 0, shifted: false, atStart: i === 0 });
  }

  const last = path[path.length - 1];
  start = { x: TXc(path[0][0]) + 0.5, y: TXc(path[0][1]) + 0.5 };
  exit = { x: TXc(last[0]), y: TXc(last[1]) };

  // the way you are meant to go, for Show path and for the count at the end
  solutionPath = [];
  for (let i = 0; i < path.length; i++) {
    const [cx, cy] = path[i];
    solutionPath.push([TXc(cx), TXc(cy)]);
    if (i < path.length - 1) { const [nx, ny] = path[i + 1]; solutionPath.push([TXc(cx) + (nx - cx), TXc(cy) + (ny - cy)]); }
  }
  return protoSolvable();
}

// Can it be done? Walk every state the level can be in — where you are standing, and where each
// block has got to — and see whether the way out turns up in any of them. This is the test the
// idea needs: the blocks have to be shovable into a pattern that carries you from one island to
// the next, and by the time there are elbows in it that is not obvious by looking.
function protoSolvable() {
  const homes = sliders.map(s => [s.x, s.y]);
  const posOf = (i, at) => at ? [homes[i][0] + sliders[i].ways[at - 1][0], homes[i][1] + sliders[i].ways[at - 1][1]] : homes[i];
  const blockCells = new Set(homes.map(h => h.join(',')));
  const cellAt = (x, y) => (x - P) % 2 === 1 && (y - P) % 2 === 1 && x > P && y > P && x < W - P && y < H - P;
  const openIn = (ats, x, y) => {
    if (cellAt(x, y) && !blockCells.has(x + ',' + y)) return true;             // a plain island, always there
    for (let i = 0; i < ats.length; i++) { const [bx, by] = posOf(i, ats[i]); if (bx === x && by === y) return true; }
    return false;
  };
  const startKey = Math.floor(start.x) + ',' + Math.floor(start.y) + '|' + sliders.map(() => 0).join('');
  const seen = new Set([startKey]), q = [[Math.floor(start.x), Math.floor(start.y), sliders.map(() => 0)]];
  const want = exit.x + ',' + exit.y;
  for (let head = 0; head < q.length && head < 400000; head++) {
    const [px, py, ats] = q[head];
    if (px + ',' + py === want) return true;
    // walk to any open square beside you
    for (const [dx, dy] of protoDirs()) {
      const nx = px + dx, ny = py + dy;
      if (!openIn(ats, nx, ny)) continue;
      const k = nx + ',' + ny + '|' + ats.join('');
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny, ats]); }
    }
    // or shove the block you are standing on, and ride it
    for (let i = 0; i < sliders.length; i++) {
      const [bx, by] = posOf(i, ats[i]);
      if (bx !== px || by !== py) continue;
      const ways = ats[i] ? [[-sliders[i].ways[ats[i] - 1][0], -sliders[i].ways[ats[i] - 1][1]]] : sliders[i].ways;
      for (const [dx, dy] of ways) {
        const at2 = ats[i] ? 0 : 1 + sliders[i].ways.findIndex(([wx, wy]) => wx === dx && wy === dy);
        const nats = ats.slice(); nats[i] = at2;
        const [nx, ny] = posOf(i, at2);
        const k = nx + ',' + ny + '|' + nats.join('');
        if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nats]); }
      }
    }
  }
  return false;
}

// ── the labyrinth ───────────────────────────────────────────────
// The prototype for docs/LABYRINTH.md. The maze today is one continuous mesh
// that asks you a question every three tiles and divides in two about twice, so
// nothing reads as leaving one place and entering another. This builds the other
// thing:
//
//   sections    the ground is cut into rooms-worth of maze that own their edges.
//               Each is carved its own way — a warren that loops back on itself,
//               a hall of long straight runs, a court built round an open room —
//               so being in one does not feel like being in another.
//   thresholds  between them, a corridor through dead ground with nothing
//               branching off it for its whole length. That is the moment of
//               leaving one place and arriving in the next.
//   landmarks   one thing at the heart of each section, and no two the same in
//               a maze: the room with the pool, the room with the statues. What
//               you actually navigate by.
//
// The section graph is a tree, so there is exactly one way between any two of
// them: that is what makes a map of it possible to hold in your head, and what
// makes chalk worth carrying. The loops go inside sections, where being lost is
// the point. Lost locally, clear globally.

const LANDMARK_KINDS = ['pool', 'statues', 'spiral', 'columns', 'dais', 'well', 'balls'];

function buildLabyrinth(seed) {
  const R = rng(seed);
  protoReset(CONFIG.labySize);
  protoWide = false;   // you are meant to be lost in this one, so the light is the maze's own
  const TXc = (c) => c * 2 + 1 + P;
  const cols = CONFIG.cols, rows = CONFIG.rows;
  const openCell = (cx, cy) => { tiles[TXc(cy)][TXc(cx)] = 1; };
  const openLink = (ax, ay, bx, by) => { tiles[TXc(ay) + (by - ay)][TXc(ax) + (bx - ax)] = 1; };
  // the tile between four cells. Without it a "room" is a grid of pillars, not a room
  const openCorner = (cx, cy) => { tiles[TXc(cy) + 1][TXc(cx) + 1] = 1; };
  const pick = (a) => a[R() * a.length | 0];

  // ── 1. cut the ground up, leaving a seam of dead cells between every pair ──
  const leaves = [];
  const [minS, maxS] = CONFIG.labySection;
  const split = (r) => {
    const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
    const canX = w >= minS * 2 + 1, canY = h >= minS * 2 + 1;   // +1 for the seam the split eats
    const must = w > maxS || h > maxS;
    if ((!canX && !canY) || (!must && R() < CONFIG.labyStopSplit)) { leaves.push(r); return; }
    const vert = canX && (!canY || w > h || (w === h && R() < 0.5));
    if (vert) {
      const at = r.x0 + minS + (R() * (w - minS * 2 - 1) | 0);
      split({ x0: r.x0, y0: r.y0, x1: at - 1, y1: r.y1 });
      split({ x0: at + 1, y0: r.y0, x1: r.x1, y1: r.y1 });
    } else {
      const at = r.y0 + minS + (R() * (h - minS * 2 - 1) | 0);
      split({ x0: r.x0, y0: r.y0, x1: r.x1, y1: at - 1 });
      split({ x0: r.x0, y0: at + 1, x1: r.x1, y1: r.y1 });
    }
  };
  split({ x0: 0, y0: 0, x1: cols - 1, y1: rows - 1 });
  if (leaves.length < 3) return false;

  // which cell belongs to which section, so a hall can be told to keep out of them
  const owner = new Map();
  leaves.forEach((r, i) => { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) owner.set(x + ',' + y, i); });

  // ── 2. carve each one its own way ──
  const kinds = ['warren', 'hall', 'court'];
  leaves.forEach((r, i) => { r.kind = kinds[i % kinds.length]; });
  for (let i = leaves.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; const k = leaves[i].kind; leaves[i].kind = leaves[j].kind; leaves[j].kind = k; }

  // The start room sits in the corner of the section you wake in: the same sealed five-by-five
  // with the mat, the basin and the shelves as every other level has, and the same one way out
  // to lean on. Its cells are kept back before that section is carved, so the maze grows round it
  // and sealing it afterwards cannot strand anything.
  let home = 0;
  for (let i = 1; i < leaves.length; i++) if (leaves[i].y1 > leaves[home].y1 || (leaves[i].y1 === leaves[home].y1 && leaves[i].x0 < leaves[home].x0)) home = i;
  const rc = CONFIG.startRoomCells;
  const roomCells = new Set();
  const bx0 = leaves[home].x0, by0 = leaves[home].y1 - rc + 1;
  for (let y = by0; y < by0 + rc; y++) for (let x = bx0; x < bx0 + rc; x++) roomCells.add(x + ',' + y);
  for (const r of leaves) carveSection(r, r.kind, R, openCell, openLink, openCorner, r === leaves[home] ? roomCells : null);

  // ── 3. a tree over the sections, and a hall for every branch of it ──
  const edges = [];
  for (let a = 0; a < leaves.length; a++) for (let b = a + 1; b < leaves.length; b++) {
    const A = leaves[a], B = leaves[b];
    // separated by exactly the one seam cell, and facing each other along it
    if (B.x0 === A.x1 + 2 && A.y0 <= B.y1 && B.y0 <= A.y1) edges.push({ a, b, dir: 'x', seam: A.x1 + 1, lo: Math.max(A.y0, B.y0), hi: Math.min(A.y1, B.y1) });
    if (A.x0 === B.x1 + 2 && A.y0 <= B.y1 && B.y0 <= A.y1) edges.push({ a: b, b: a, dir: 'x', seam: B.x1 + 1, lo: Math.max(A.y0, B.y0), hi: Math.min(A.y1, B.y1) });
    if (B.y0 === A.y1 + 2 && A.x0 <= B.x1 && B.x0 <= A.x1) edges.push({ a, b, dir: 'y', seam: A.y1 + 1, lo: Math.max(A.x0, B.x0), hi: Math.min(A.x1, B.x1) });
    if (A.y0 === B.y1 + 2 && A.x0 <= B.x1 && B.x0 <= A.x1) edges.push({ a: b, b: a, dir: 'y', seam: B.y1 + 1, lo: Math.max(A.x0, B.x0), hi: Math.min(A.x1, B.x1) });
  }
  edges.sort(() => R() - 0.5);
  const parent = leaves.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const tree = [], spare = [];
  for (const e of edges) { const ra = find(e.a), rb = find(e.b);
    if (ra === rb) { spare.push(e); continue; } parent[ra] = rb; tree.push(e); }
  if (tree.length !== leaves.length - 1) return false;           // the cuts left a section walled off
  for (let i = 0; i < CONFIG.labyLoops && spare.length; i++) tree.push(spare.splice(R() * spare.length | 0, 1)[0]);

  const halls = [];
  for (const e of tree) if (!carveHall(e, leaves, owner, R, openCell, openLink, halls)) return false;

  // ── 4. the room you wake in ──
  {
    for (const k of roomCells) { const [x, y] = k.split(',').map(Number);
      openCell(x, y);
      for (const [dx, dy] of [[1, 0], [0, 1]]) if (roomCells.has((x + dx) + ',' + (y + dy))) openLink(x, y, x + dx, y + dy);
      if (roomCells.has((x + 1) + ',' + y) && roomCells.has(x + ',' + (y + 1)) && roomCells.has((x + 1) + ',' + (y + 1))) openCorner(x, y); }
    const rx0 = TXc(bx0), ry0 = TXc(by0), rx1 = TXc(bx0 + rc - 1), ry1 = TXc(by0 + rc - 1);
    startRoom = { x0: rx0, y0: ry0, x1: rx1, y1: ry1 };
    start = { x: rx0 + 2 + 0.5, y: ry0 + 2 + 0.5 };
    // The room's cells were kept out of the carve, so it is sealed already — nothing links into
    // it. One of its walls becomes the way out: a border gap with open section floor on the far
    // side, still shut, with the block on the inside for you to lean on.
    const ways = [];
    const spot = (gx, gy, ax, ay) => { const fx = gx + ax, fy = gy + ay;
      if (fx <= 0 || fy <= 0 || fx >= W - 1 || fy >= H - 1 || !tiles[fy][fx]) return;
      ways.push([gx, gy, ax, ay]); };
    for (let y = ry0; y <= ry1; y += 2) { spot(rx1 + 1, y, 1, 0); spot(rx0 - 1, y, -1, 0); }
    for (let x = rx0; x <= rx1; x += 2) { spot(x, ry1 + 1, 0, 1); spot(x, ry0 - 1, 0, -1); }
    if (!ways.length) return false;
    const [gx, gy, ax, ay] = ways[R() * ways.length | 0];
    for (const [x, y] of ways) tiles[y][x] = 0;
    startGap = [gx, gy];
    sliders.push({ x: gx - ax, y: gy - ay, dx: ax, dy: ay, shifted: false, atStart: true });
    if (!SAVE.pushLearned) startArrow = { x: gx - ax, y: gy - ay, dir: ax > 0 ? 'right' : ax < 0 ? 'left' : ay > 0 ? 'down' : 'up' };
  }

  // ── 5. one thing at the heart of each, and no two the same ──
  // There are more sections than there are things to put in them, and that is fine — Joe: "this
  // statue looks the same as another place I've been, but the floor texture is different." So no
  // two that touch ever wear the same one, and every section carries a tone of its own besides.
  const near = leaves.map(() => []);
  for (let a = 0; a < leaves.length; a++) for (let b = a + 1; b < leaves.length; b++) {
    const A2 = leaves[a], B2 = leaves[b];
    if (Math.abs(A2.x0 - B2.x0) < 12 && Math.abs(A2.y0 - B2.y0) < 12) { near[a].push(b); near[b].push(a); }
  }
  const chosen = [];
  leaves.forEach((r, i) => {
    const taken2 = new Set(near[i].map((n) => chosen[n]).filter(Boolean));
    const free = LANDMARK_KINDS.filter((k) => !taken2.has(k));
    chosen[i] = pick(free.length ? free : LANDMARK_KINDS);
  });
  sections = leaves.map((r, i) => ({ i, kind: r.kind, tone: (R() * 5 | 0) - 2, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1,
    tx0: TXc(r.x0) - 1, ty0: TXc(r.y0) - 1, tx1: TXc(r.x1) + 1, ty1: TXc(r.y1) + 1 }));
  // the room's own tile bounds go with it: a landmark is the whole floor of the room it is in,
  // not an ornament on one tile of it
  leaves.forEach((r, i) => { const h = r.heartCells;
    landmarks.push({ x: TXc(r.heart[0]), y: TXc(r.heart[1]), kind: chosen[i], section: i,
      rx0: TXc(h.x0), ry0: TXc(h.y0), rx1: TXc(h.x1), ry1: TXc(h.y1) }); });

  // ── 6. the way out: the section furthest from home through the tree ──
  const adj = leaves.map(() => []);
  for (const e of tree) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
  let far = home;
  { const d = leaves.map(() => -1); d[home] = 0; const q = [home];
    for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (d[n] < 0) { d[n] = d[q[h]] + 1; q.push(n); }
    for (let i = 0; i < d.length; i++) if (d[i] > d[far]) far = i; }
  const farCells = sectionCells(leaves[far]).filter(([x, y]) => tiles[TXc(y)][TXc(x)]);
  const [ex, ey] = farCells[0] ? farCells[R() * farCells.length | 0] : [leaves[far].x0, leaves[far].y0];
  exit = { x: TXc(ex), y: TXc(ey) };

  // chalk on the floor, because the whole point is whether you reach for it
  const floor = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x]) floor.push(x + ',' + y);
  for (let i = 0; i < CONFIG.labyChalk && floor.length; i++) chalkSpots.add(floor[R() * floor.length | 0]);

  // the way you are meant to go, for Show path and the count at the end
  // the start room's one way out is a block you shove, so the gap counts as floor for the route
  solutionPath = protoRoute(Math.floor(start.x), Math.floor(start.y), exit.x, exit.y, new Set([startGap.join(',')]));
  return solutionPath.length > 1;
}

const sectionCells = (r) => { const out = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) out.push([x, y]); return out; };

// A section is a maze in its own right, carved its own way. The kind is what makes one place feel
// unlike another before you have even found what is in the middle of it.
function carveSection(r, kind, R, openCell, openLink, openCorner, reserved) {
  const cells = sectionCells(r);
  const inR = (x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && !(reserved && reserved.has(x + ',' + y));
  const seen = new Set();
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // the heart: an open room at the middle of every section, because a landmark standing in a
  // corridor is decoration and a landmark standing in a room is a place. A court keeps a bigger
  // one, and winds round it.
  const span = kind === 'court' ? CONFIG.labyHeart + 2 : CONFIG.labyHeart, half = span >> 1;
  const cx0 = Math.min(Math.max((r.x0 + r.x1) >> 1, r.x0 + half), r.x1 - half);
  const cy0 = Math.min(Math.max((r.y0 + r.y1) >> 1, r.y0 + half), r.y1 - half);
  r.heart = [cx0, cy0];
  const heart = new Set();
  for (let y = cy0 - half; y <= cy0 + half; y++) for (let x = cx0 - half; x <= cx0 + half; x++) if (inR(x, y)) heart.add(x + ',' + y);
  r.heartCells = { x0: cx0 - half, y0: cy0 - half, x1: cx0 + half, y1: cy0 + half };
  for (const k of heart) { const [x, y] = k.split(',').map(Number); openCell(x, y); seen.add(k);
    for (const [dx, dy] of D) if (heart.has((x + dx) + ',' + (y + dy))) openLink(x, y, x + dx, y + dy);
    if (heart.has((x + 1) + ',' + y) && heart.has(x + ',' + (y + 1)) && heart.has((x + 1) + ',' + (y + 1))) openCorner(x, y); }

  // backtracker, with a bias down the straight so a hall is a hall and a warren is a warren
  const straight = kind === 'hall' ? CONFIG.labyStraightHall : CONFIG.labyStraightWarren;
  const stack = [[cx0, cy0, null]];
  while (stack.length) {
    const [x, y, came] = stack[stack.length - 1];
    const ways = D.filter(([dx, dy]) => inR(x + dx, y + dy) && !seen.has((x + dx) + ',' + (y + dy)));
    if (!ways.length) {
      stack.pop();
      // the heart is one room, so keep growing from all of its edge, not just the middle
      if (!stack.length) { const left = cells.find(([bx, by]) => !seen.has(bx + ',' + by)
        && D.some(([dx, dy]) => seen.has((bx + dx) + ',' + (by + dy))));
        if (left) { const [bx, by] = left;
          const [dx, dy] = D.find(([ax, ay]) => seen.has((bx + ax) + ',' + (by + ay)));
          seen.add(bx + ',' + by); openCell(bx, by); openLink(bx, by, bx + dx, by + dy);
          stack.push([bx, by, null]); } }
      continue;
    }
    const on = came && ways.find(([dx, dy]) => dx === came[0] && dy === came[1]);
    const [dx, dy] = (on && R() < straight) ? on : pickOf(ways, R);
    const nx = x + dx, ny = y + dy;
    seen.add(nx + ',' + ny); openCell(nx, ny); openLink(x, y, nx, ny);
    stack.push([nx, ny, [dx, dy]]);
  }
  // and the loops, which belong inside a section and not between them
  const braid = kind === 'warren' ? CONFIG.labyBraidWarren : kind === 'court' ? CONFIG.labyBraidCourt : CONFIG.labyBraidHall;
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (!inR(nx, ny) || R() >= braid) continue;
    openLink(x, y, nx, ny);
  }
}
const pickOf = (a, R) => a[R() * a.length | 0];

// A hall runs through the dead seam between two sections: out of one, along the seam a way, and
// into the other. Nothing branches off it, because nothing else is ever carved out there.
function carveHall(e, leaves, owner, R, openCell, openLink, halls) {
  const A = leaves[e.a], B = leaves[e.b];
  const span = e.hi - e.lo;
  if (span < 0) return false;
  const cellsOf = (v) => (e.dir === 'x' ? [e.seam, v] : [v, e.seam]);
  const aCell = (v) => (e.dir === 'x' ? [e.seam - 1, v] : [v, e.seam - 1]);
  const bCell = (v) => (e.dir === 'x' ? [e.seam + 1, v] : [v, e.seam + 1]);
  // the seam has to be free the whole way — two halls never share one — so try a few places to
  // put this one before giving up on the level
  let from = -1, to = -1;
  for (let tries = 0; tries < 12 && from < 0; tries++) {
    const run = Math.min(span, CONFIG.labyHallRun[0] + (R() * (CONFIG.labyHallRun[1] - CONFIG.labyHallRun[0] + 1) | 0));
    const f = e.lo + (R() * (span - run + 1) | 0), t = f + run;
    let free = true;
    for (let v = f; v <= t; v++) { const [sx, sy] = cellsOf(v); if (owner.has(sx + ',' + sy)) { free = false; break; } }
    if (free) { from = f; to = t; }
  }
  if (from < 0) return false;
  const path = [];
  for (let v = from; v <= to; v++) { const [sx, sy] = cellsOf(v); openCell(sx, sy); path.push([sx, sy]); owner.set(sx + ',' + sy, -1); }
  for (let i = 1; i < path.length; i++) openLink(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
  const [ax, ay] = aCell(from), [bx, by] = bCell(to);
  openCell(ax, ay); openCell(bx, by);
  openLink(ax, ay, path[0][0], path[0][1]);
  openLink(path[path.length - 1][0], path[path.length - 1][1], bx, by);
  halls.push({ from: [ax, ay], to: [bx, by], cells: path, a: e.a, b: e.b });
  return true;
}

// the shortest way through, in tiles
function protoRoute(sx, sy, ex, ey, extra) {
  const prev = new Map([[sx + ',' + sy, null]]), q = [[sx, sy]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    if (x === ex && y === ey) break;
    for (const [dx, dy] of protoDirs()) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k)) continue;
      if (!tiles[ny][nx] && !(extra && extra.has(k))) continue;
      prev.set(k, [x, y]); q.push([nx, ny]); }
  }
  const out = [];
  for (let k = ex + ',' + ey; prev.has(k); ) { const [x, y] = k.split(',').map(Number); out.push([x, y]);
    const p = prev.get(k); if (!p) break; k = p[0] + ',' + p[1]; }
  return out.reverse();
}
