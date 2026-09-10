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

function buildProto(seed, kind) {
  const R = rng(seed);
  protoMode = true; poolMode = false;
  [CONFIG.cols, CONFIG.rows] = CONFIG.protoSize;
  W = CONFIG.cols * 2 + 1 + 2 * P; H = CONFIG.rows * 2 + 1 + 2 * P;
  const TXc = (c) => c * 2 + 1 + P;
  tiles = Array.from({ length: H }, () => new Uint8Array(W));

  // everything empty; a prototype carries none of the maze's furniture
  journals = new Map(); pickups = new Map(); chalkSpots = new Set(); charcoalSpots = new Set();
  scrapSpots = new Set(); doors = []; innerKeys = new Map(); heldKeys = new Set();
  crawlGaps = new Set(); crawlCells = new Set(); hopscotch = []; ticTacToe = null;
  figures = []; darkTiles = new Set(); darkFringe = new Map(); lampSpot = null; keySpot = null;
  sealedGaps = []; pockets = []; tunnelTiles = new Set(); clusters = [];
  secretTiles = new Set(); secretMarks = new Map(); secretSwitch = null; secretFather = null;
  startArrow = null; exitTree = new Set(); exitTreeMouth = null; secretReserve = null;
  startRoom = null; startGap = null; poolDoor = null; gated = false; exitAlley = [];
  character = CAST[0]; journalIdx = 0;

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
      const d = decoys[R() * decoys.length | 0];
      ways.push(d); taken.add(key(cx + d[0], cy + d[1]));
    }
    ways.sort(() => R() - 0.5);
    sliders.push({ x: TXc(cx), y: TXc(cy), dx: ways[0][0], dy: ways[0][1], ways, at: 0, shifted: false, onPath: i === 0 });
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
