// The Maze — the maze itself: grid, rooms, pockets, doors, darkness, placement
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── maze generation ─────────────────────────────────────────────
// tiles[y][x]: 0 = wall, 1 = floor. Cells live at odd coordinates.
const P = 2;   // wall margin around the cell grid; the exit alley is carved into it
let W, H, tiles, tunnelTiles, start, exit, exitAlley = [], solutionPath = [], chalkSpots = new Set(), charcoalSpots = new Set(), pickups = new Map(), keySpot = null;
let journals = new Map(), character = null, journalIdx = 0;
let gated = false;   // this maze's exit is locked
let poolMode = false;   // this run is a pool level: small, lit, one stone, a door
let poolDoor = null;    // {x,y,openAt} the grey door in the room's doorway; slides away once you hold the stone
let startRoom = null;   // {x0,y0,x1,y1} tile bounds of the sealed start room
let scrapSpots = new Set();
let doors = [];              // locked doors inside the maze: {x,y,shape,open}
let innerKeys = new Map();   // 'x,y' → shape of the key lying there
let heldKeys = new Set();    // shapes you carry
const KEY_SHAPES = ['circle', 'triangle', 'square'];
let exitTree = new Set();    // cells of the squeeze tree guarding the way out
let exitTreeMouth = null;    // 'x,y' of its one entrance, the squeeze you go in by
let secretTiles = new Set(); // tiles of the secret place: a room walled up, or a dead-end passage, behind one squeeze
let secretMarks = new Map(); // 'x,y' → glyph: somebody else's chalk, in that room
let crawlGaps = new Set();   // 'x,y' wall gaps a child can crawl through (open only when the phase allows)
let crawlCells = new Set();  // open cells that sit between two gaps of one squeeze — drawn narrow too
let hopscotch = [];          // ordered tiles of a hopscotch court
let ticTacToe = null;        // {x,y,cells} a 3×3 chalk board on a room floor, mid-game
let figures = [];            // the father, placed like pickups: [{x,y,alpha,seen,gone}]
let startGap = null;
let darkTiles = new Set(), darkFringe = new Map(), lampSpot = null, sealedGaps = [];   // darkFringe: tile → 1 (dim) or 2 (dimmer), the drop-off around the dark
let clusters = [];  // districts with a heart of their own: {heart, x0,y0,x1,y1 (cells), tx0,ty0,tx1,ty1 (tiles)}
let sliders = [];   // {x,y,dx,dy,shifted}  x,y = home tile; slides one tile along d
let pockets = [];   // sealed dead-end tiles reachable only via a slider   // journals: 'x,y' → page index
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const isOpen = (x, y) => !!(tiles[y]?.[x]);
function generate(seed) {
  const R = rng(seed);
  poolMode = !!SAVE.poolPending;
  const F = poolMode ? { signs: phase().f.signs, charcoal: false, compass: false, thread: false, scraps: false, lamp: false, darkness: false, gate: true, tunnels: false, pockets: false, pathSlider: false, braid: 0 } : phase().f;
  const sizeKey = poolMode ? 'sm' : (SAVE.ui.size && SAVE.ui.size !== 'auto') ? SAVE.ui.size : (has(6) && phase().who !== 'You' ? 'lg' : phase().size);
  [CONFIG.cols, CONFIG.rows] = SIZES[sizeKey] || SIZES.md;
  const AREA = (CONFIG.cols * CONFIG.rows) / (14 * 20);   // 1 at medium; feature counts scale with it
  const N = base => Math.max(1, Math.round(base * AREA));
  const N0 = base => Math.round(base * AREA);   // may be zero
  W = CONFIG.cols * 2 + 1 + 2*P; H = CONFIG.rows * 2 + 1 + 2*P;
  const TX = c => c*2 + 1 + P;   // cell index → tile index
  tiles = Array.from({ length: H }, () => new Uint8Array(W));

  // Turns (debug menu): a preset for straighter, sparser halls. Off, everything below is exactly as before —
  // the preset path is the only one that touches the random stream, so Auto seeds are unchanged.
  const T = (SAVE.ui.turns && SAVE.ui.turns !== 'auto') ? CONFIG.turnsPresets[SAVE.ui.turns] : null;
  const straight = T ? T.straight : CONFIG.hallStraightness;
  const fill = T ? T.fill : CONFIG.hallFill;

  // growing tree: pick newest cell (backtracker) or a random one (Prim-ish) per branchiness
  const visited = Array.from({ length: CONFIG.rows }, () => new Uint8Array(CONFIG.cols));
  const cameFrom = Array.from({ length: CONFIG.rows }, () => new Array(CONFIG.cols).fill(null));   // direction each cell was carved in
  const active = [[0, 0]]; visited[0][0] = 1; tiles[TX(0)][TX(0)] = 1;
  while (active.length) {
    const branch = (SAVE.ui.branch && SAVE.ui.branch !== 'auto') ? +SAVE.ui.branch
      : (T && T.branch !== undefined) ? T.branch
      : (F.branch !== undefined ? F.branch : CONFIG.branchiness);
    const idx = R() < branch ? (R() * active.length | 0) : active.length - 1;
    const [cx, cy] = active[idx];
    const opts = DIRS.map(([dx,dy]) => [cx+dx, cy+dy, dx, dy]).filter(([nx,ny]) => nx>=0 && ny>=0 && nx<CONFIG.cols && ny<CONFIG.rows && !visited[ny][nx]);
    if (!opts.length) { active.splice(idx, 1); continue; }
    // carry straight on when we can and the dice say so; otherwise as before. No dice rolled when straightness is 0.
    const ahead = cameFrom[cy][cx];
    const onward = ahead && opts.find(([,, dx, dy]) => dx === ahead[0] && dy === ahead[1]);
    const [nx, ny, dx, dy] = (straight > 0 && onward && R() < straight) ? onward : opts[R() * opts.length | 0];
    visited[ny][nx] = 1; tiles[TX(ny)][TX(nx)] = 1; tiles[cy+ny+1+P][cx+nx+1+P] = 1; cameFrom[ny][nx] = [dx, dy];
    active.push([nx, ny]);
  }
  // dead space: prune dead-end branches back, leaf by leaf, until only `fill` of the grid is corridor.
  // Pruning a leaf can never disconnect anything, and the start room's block (with its ring of
  // neighbours, so a doorway always has somewhere to open onto) and all three candidate exit
  // corners are kept, so start and exit stay joined whichever corner the exit lands in.
  if (fill < 1) {
    const rc = CONFIG.startRoomCells;
    const keep = (cx, cy) => (cx <= rc && cy >= CONFIG.rows - 1 - rc)                       // start block + ring
      || (cx === 0 && cy === 0) || (cx === CONFIG.cols - 1 && cy === 0) || (cx === CONFIG.cols - 1 && cy === CONFIG.rows - 1);
    const linked = (ax, ay, bx, by) => !!tiles[ay+by+1+P][ax+bx+1+P];
    const degree = (cx, cy) => DIRS.filter(([dx,dy]) => { const nx=cx+dx, ny=cy+dy; return nx>=0 && ny>=0 && nx<CONFIG.cols && ny<CONFIG.rows && visited[ny][nx] && linked(cx,cy,nx,ny); }).length;
    let open = CONFIG.cols * CONFIG.rows; const target = Math.round(open * fill);
    for (let pass = 0; open > target && pass < 400; pass++) {
      const leaves = [];
      for (let cy = 0; cy < CONFIG.rows; cy++) for (let cx = 0; cx < CONFIG.cols; cx++) if (visited[cy][cx] && !keep(cx, cy) && degree(cx, cy) === 1) leaves.push([cx, cy]);
      if (!leaves.length) break;
      leaves.sort(() => R() - 0.5);
      for (const [cx, cy] of leaves.slice(0, Math.max(1, Math.min(leaves.length, open - target)))) {
        if (degree(cx, cy) !== 1) continue;   // a neighbour's removal this pass may have changed it
        const [dx, dy] = DIRS.find(([dx,dy]) => { const nx=cx+dx, ny=cy+dy; return nx>=0 && ny>=0 && nx<CONFIG.cols && ny<CONFIG.rows && visited[ny][nx] && linked(cx,cy,nx,ny); });
        visited[cy][cx] = 0; tiles[TX(cy)][TX(cx)] = 0; tiles[cy+(cy+dy)+1+P][cx+(cx+dx)+1+P] = 0; open--;
      }
    }
  }
  // braid
  const braid = (SAVE.ui.braid && SAVE.ui.braid !== 'auto') ? +SAVE.ui.braid : (F.braid || 0);
  // Both ends have to be real floor. On a full grid they always are, so this is exactly as
  // it was; with dead space it stops braid opening a gap from one pruned cell into another,
  // which leaves a floor tile walled in on both sides that nobody can ever stand on.
  if (braid > 0) for (let y=TX(0); y<H-P; y+=2) for (let x=TX(0); x<W-P; x+=2) {
    if (isOpen(x, y) && DIRS.filter(([dx,dy]) => isOpen(x+dx, y+dy)).length === 1 && R() < braid) {
      const c = DIRS.filter(([dx,dy]) => !isOpen(x+dx, y+dy) && x+dx*2 >= TX(0) && x+dx*2 < W-P && y+dy*2 >= TX(0) && y+dy*2 < H-P && isOpen(x+dx*2, y+dy*2));
      if (c.length) { const [dx,dy] = c[R()*c.length|0]; tiles[y+dy][x+dx] = 1; }
    }
  }
  // rooms: open a rectangle of tiles, away from the corners; remember centers for journals
  const roomCenters = [], roomRects = [];   // roomRects in cells, so districts below can keep clear of them
  for (let i = 0; i < N(CONFIG.rooms * (F.rooms || 1)); i++) {
    const cells = CONFIG.roomCells[0] + (R() * (CONFIG.roomCells[1] - CONFIG.roomCells[0] + 1) | 0);
    const tw = cells * 2 - 1;
    let cx0, cy0, tries = 0;
    do { cx0 = 1 + (R() * (CONFIG.cols - cells - 1) | 0); cy0 = 1 + (R() * (CONFIG.rows - cells - 1) | 0); }
    while (++tries < 20 && (roomCenters.some(([rx, ry]) => Math.abs(rx - (TX(cx0)+(tw>>1))) < tw + 2 && Math.abs(ry - (TX(cy0)+(tw>>1))) < tw + 2)   // keep rooms apart
      || (cx0 <= CONFIG.startRoomCells && cy0 + cells >= CONFIG.rows - CONFIG.startRoomCells)   // and out of the start-room corner
      || !(() => { for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) if (isOpen(TX(cx0+x), TX(cy0+y))) return true; return false; })()));   // and on corridor, never an island in dead space
    for (let y = 0; y < tw; y++) for (let x = 0; x < tw; x++) tiles[TX(cy0)+y][TX(cx0)+x] = 1;
    roomCenters.push([TX(cx0) + (tw>>1), TX(cy0) + (tw>>1)]);
    roomRects.push([cx0, cy0, cx0 + cells - 1, cy0 + cells - 1]);
  }

  // ── districts ────────────────────────────────────────────────────────────────
  // Patches of maze with a character of their own, so the whole map does not feel
  // the same. Stamped once the halls and the rooms are down, over the patches that
  // already twist the most, because those are the parts worth making strange.
  //
  // A district is filled in first — dead space inside it comes back as floor — so the
  // heart reads as a quarter of its own rather than a few surviving scraps. On a Sparse
  // or Least map that is the whole point: dense, strange ground with emptiness around it.
  //
  // The safety argument, which every heart below relies on: only links with BOTH ends
  // inside the patch are ever cut, so every way in and out survives untouched; and
  // afterwards the whole patch is spanned, so nothing inside can be stranded either.
  // A district can add floor and add connections. It can never take a connection away.
  clusters = [];
  const clusterAt = (heart, x, y) => clusters.some(c => c.heart === heart && x >= c.tx0 && x <= c.tx1 && y >= c.ty0 && y <= c.ty1);
  if (!poolMode && SAVE.ui.clusters !== 'off' && CONFIG.clusters > 0) {
    const forced = (SAVE.ui.clusters && SAVE.ui.clusters !== 'auto') ? SAVE.ui.clusters : null;
    // squeeze needs crawl gaps and shifting needs sliders, so a phase without them gets neither —
    // unless the debug menu asks for one by name, in which case you get the carve and no furniture.
    const hearts = forced ? [forced]
      : CONFIG.clusterHearts.filter(h => h === 'squeeze' ? !!F.crawl : h === 'shifting' ? !!F.pockets : true);
    // shifting needs pockets, not swings. On a swing-only phase (the Child) the extra sliders a
    // shifting district asks for come out as pushable blocks, and the Child has not learned those yet.
    const want = forced ? Math.max(2, N0(CONFIG.clusters)) : N0(CONFIG.clusters);
    const rc = CONFIG.startRoomCells;
    const live = (cx, cy) => cx >= 0 && cy >= 0 && cx < CONFIG.cols && cy < CONFIG.rows && !!tiles[TX(cy)][TX(cx)];
    const gap = (ax, ay, bx, by) => [ax + bx + 1 + P, ay + by + 1 + P];
    const joined = (ax, ay, bx, by) => { const [gx, gy] = gap(ax, ay, bx, by); return !!tiles[gy][gx]; };
    const setLink = (ax, ay, bx, by, v) => { const [gx, gy] = gap(ax, ay, bx, by); tiles[gy][gx] = v; };
    // keep off the start room and its ring, all three candidate exit corners, and the rooms
    const barred = (cx, cy) => (cx <= rc + 1 && cy >= CONFIG.rows - 2 - rc)
      || (cx <= 1 && cy <= 1) || (cx >= CONFIG.cols - 2 && cy <= 1) || (cx >= CONFIG.cols - 2 && cy >= CONFIG.rows - 2)
      || roomRects.some(([rx0, ry0, rx1, ry1]) => cx >= rx0 && cx <= rx1 && cy >= ry0 && cy <= ry1);   // rooms may be touched, never overlapped
    // score candidate patches by how much they already twist; the twistiest go first
    const cands = [];
    // a district is trimmed to the grid it lands on, or a small maze — the Child's, and
    // You — would have nowhere a 7-cell patch could sit clear of the room and the corners
    const span = (n) => { const hi = Math.max(3, Math.min(CONFIG.clusterCells[1], n - 5)), lo = Math.min(CONFIG.clusterCells[0], hi); return lo + (R() * (hi - lo + 1) | 0); };
    for (let i = 0; i < 160 && want > 0; i++) {
      const w = span(CONFIG.cols), h = span(CONFIG.rows);
      if (w >= CONFIG.cols || h >= CONFIG.rows) continue;
      const x0 = R() * (CONFIG.cols - w + 1) | 0, y0 = R() * (CONFIG.rows - h + 1) | 0;
      const x1 = x0 + w - 1, y1 = y0 + h - 1;
      let n = 0, twist = 0, ways = 0, bad = false;
      for (let cy = y0; cy <= y1 && !bad; cy++) for (let cx = x0; cx <= x1; cx++) {
        if (barred(cx, cy)) { bad = true; break; }
        if (!live(cx, cy)) continue;
        n++;
        const nb = DIRS.filter(([dx, dy]) => live(cx + dx, cy + dy) && joined(cx, cy, cx + dx, cy + dy));
        for (const [dx, dy] of nb) if (cx + dx < x0 || cx + dx > x1 || cy + dy < y0 || cy + dy > y1) ways++;
        if (nb.length >= 3) twist += 2;
        else if (nb.length === 2 && !(nb[0][0] === -nb[1][0] && nb[0][1] === -nb[1][1])) twist++;
      }
      // `ways` is the safety condition: a patch with no link out would be stamped into an island
      if (bad || !ways || n < w * h * CONFIG.clusterLiveShare) continue;
      cands.push({ x0, y0, x1, y1, score: twist * 2 + n + R() * 4 });
    }
    cands.sort((a, b) => b.score - a.score);
    const bag = hearts.slice(); bag.sort(() => R() - 0.5);   // deal the hearts out rather than roll, so a map gets variety
    for (const c of cands) {
      if (clusters.length >= want) break;
      if (clusters.some(o => c.x0 <= o.x1 + 1 && c.x1 >= o.x0 - 1 && c.y0 <= o.y1 + 1 && c.y1 >= o.y0 - 1)) continue;
      clusters.push({ heart: bag[clusters.length % bag.length], x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1,
        tx0: TX(c.x0) - 1, ty0: TX(c.y0) - 1, tx1: TX(c.x1) + 1, ty1: TX(c.y1) + 1 });
    }
    for (const c of clusters) {
      const cells = [];
      for (let cy = c.y0; cy <= c.y1; cy++) for (let cx = c.x0; cx <= c.x1; cx++) { tiles[TX(cy)][TX(cx)] = 1; cells.push([cx, cy]); }
      const at = new Map(cells.map(([x, y], i) => [x + ',' + y, i]));
      const uf = cells.map((_, i) => i);
      const find = (a) => { while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; } return a; };
      const cut = (ax, ay, bx, by) => {                        // open a link whatever it costs; may make a loop
        if (!at.has(ax + ',' + ay) || !at.has(bx + ',' + by)) return;
        const a = find(at.get(ax + ',' + ay)), b = find(at.get(bx + ',' + by));
        setLink(ax, ay, bx, by, 1); if (a !== b) uf[a] = b;
      };
      const spanTo = (ax, ay, bx, by) => {                     // open a link only if it joins two separate pieces
        const a = find(at.get(ax + ',' + ay)), b = find(at.get(bx + ',' + by));
        if (a === b) return; uf[a] = b; setLink(ax, ay, bx, by, 1);
      };
      // wipe the inside clean — links to the outside are never touched
      for (const [cx, cy] of cells) for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx <= c.x1 && ny <= c.y1) setLink(cx, cy, nx, ny, 0);
      }
      const W2 = c.x1 - c.x0 + 1, H2 = c.y1 - c.y0 + 1;
      if (c.heart === 'lattice') {                             // every link open: a field of pillars, no landmarks
        for (const [cx, cy] of cells) for (const [dx, dy] of [[1, 0], [0, 1]]) cut(cx, cy, cx + dx, cy + dy);
      } else if (c.heart === 'rings') {                        // nested loops, joined to each other in one place only
        for (let r = 0; r * 2 + 1 < Math.min(W2, H2); r += 2) {
          const a = c.x0 + r, b = c.y0 + r, e = c.x1 - r, f = c.y1 - r;
          for (let x = a; x < e; x++) { cut(x, b, x + 1, b); cut(x, f, x + 1, f); }
          for (let y = b; y < f; y++) { cut(a, y, a, y + 1); cut(e, y, e, y + 1); }
        }
      } else if (c.heart === 'comb' || c.heart === 'shifting') {
        const horiz = W2 >= H2;                                 // a spine down the long axis, teeth off it
        const near = horiz ? c.y0 : c.x0, far = horiz ? c.y1 : c.x1, mid = (near + far) >> 1;
        const lo = horiz ? c.x0 : c.y0, hi = horiz ? c.x1 : c.y1;
        const link = (a1, b1, a2, b2) => horiz ? cut(a1, b1, a2, b2) : cut(b1, a1, b2, a2);
        for (let a = lo; a < hi; a++) link(a, mid, a + 1, mid);
        for (let a = lo; a <= hi; a += 2) {
          // comb: one long tooth, alternating sides. shifting: short teeth both ways, so nearly every stub can move
          const up = c.heart === 'shifting' || ((a - lo) % 4 === 0), down = c.heart === 'shifting' || ((a - lo) % 4 !== 0);
          const reach = c.heart === 'shifting' ? Math.max(1, (far - near) >> 2) : far - near;
          if (up) for (let b = mid; b > Math.max(near, mid - reach); b--) link(a, b, a, b - 1);
          if (down) for (let b = mid; b < Math.min(far, mid + reach); b++) link(a, b, a, b + 1);
        }
      }
      // whatever the heart left apart, span it: a random tree, which is also all `thicket` and
      // `squeeze` ask for — a knot of short branching paths with no long sight lines
      const edges = [];
      for (const [cx, cy] of cells) for (const [dx, dy] of [[1, 0], [0, 1]]) if (at.has((cx + dx) + ',' + (cy + dy))) edges.push([cx, cy, cx + dx, cy + dy]);
      edges.sort(() => R() - 0.5);
      for (const [ax, ay, bx, by] of edges) spanTo(ax, ay, bx, by);
    }
  }

  // one past self per maze; spread their pages across the rooms (first page first, last page last)
  // the self of this phase; lay out their next unfound pages in order
  const uncollected = c => c.pages.map((_, i) => i).filter(i => !(SAVE.collected[c.name] || [])[i]);
  character = CAST.find(c => c.name === phase().who) || CAST[0];
  journalIdx = 0; journals = new Map();
  const chosen = poolMode ? [] : uncollected(character).slice(0, roomCenters.length);
  roomCenters.forEach(([x, y], i) => { if (chosen[i] !== undefined) journals.set(x+','+y, chosen[i]); });
  // (re-ordered below so the first page sits in the room nearest the solution route)
  const pendingPages = chosen;

  // shifting cells: seal a dead end E into a pocket; the cell D two tiles away (through the wall) becomes a slider aimed at E
  sliders = []; pockets = []; startRoom = null; sealedGaps = [];
  const sx = TX(0), sy = TX(CONFIG.rows-1);
  {
    const nOpen = (x, y) => DIRS.filter(([dx,dy]) => isOpen(x+dx, y+dy)).length;
    const cornerTiles = [[TX(0),TX(0)], [TX(CONFIG.cols-1),TX(0)], [TX(CONFIG.cols-1),TX(CONFIG.rows-1)], [sx,sy]];
    const isCorner = (x,y) => cornerTiles.some(([cx,cy]) => cx===x && cy===y) || (x <= sx + CONFIG.startRoomCells*2 && y >= sy - CONFIG.startRoomCells*2);   // also the start room and its neighbours
    let want = F.pockets ? N(CONFIG.sliders[0]) + (R() * (N(CONFIG.sliders[1]) - N(CONFIG.sliders[0]) + 1) | 0) : F.swing ? (typeof F.swing === 'number' ? F.swing : N(CONFIG.swings)) : 0;
    const used = new Set();
    const cands = [];
    for (let y=TX(0); y<H-P; y+=2) for (let x=TX(0); x<W-P; x+=2) if (isOpen(x,y) && nOpen(x,y) === 1 && !isCorner(x,y)) cands.push([x,y]);
    cands.sort(() => R() - 0.5);
    // a shifting district wants nearly every stub in it to move: serve its dead ends first, and allow extra
    if (F.pockets && clusters.some(c => c.heart === 'shifting')) {
      const inShift = ([x, y]) => clusterAt('shifting', x, y);
      const extra = Math.min(cands.filter(inShift).length, CONFIG.clusterSliders * clusters.filter(c => c.heart === 'shifting').length);
      if (extra > 0) { want += extra; cands.sort((a, b) => (inShift(b) ? 1 : 0) - (inShift(a) ? 1 : 0)); }
    }
    for (const [ex, ey] of cands) {
      if (sliders.length >= want) break;
      if (used.has(ex+','+ey)) continue;
      const [bx, by] = DIRS.find(([dx,dy]) => isOpen(ex+dx, ey+dy));   // toward parent
      const opts = DIRS.filter(([dx,dy]) => !(dx===bx && dy===by) && !(dx===-bx && dy===-by))   // perpendicular to the entry
        .map(([dx,dy]) => [dx,dy, ex+dx*2, ey+dy*2])
        .filter(([dx,dy,Dx,Dy]) => Dx>=TX(0) && Dx<W-P && Dy>=TX(0) && Dy<H-P && isOpen(Dx,Dy) && nOpen(Dx,Dy) <= 2 && !isCorner(Dx,Dy) && !used.has(Dx+','+Dy) && !isOpen(ex+dx, ey+dy));
      if (!opts.length) continue;
      opts.sort((a, b) => F.pockets ? nOpen(a[2], a[3]) - nOpen(b[2], b[3]) : nOpen(b[2], b[3]) - nOpen(a[2], a[3]));   // pushable sliders prefer dead ends; swings prefer corridors
      const [dx, dy, Dx, Dy] = opts[0];
      tiles[ey+by][ex+bx] = 0; sealedGaps.push([ex+bx, ey+by]);        // seal the pocket
      pockets.push([ex, ey]); used.add(ex+','+ey); used.add(Dx+','+Dy);
      sliders.push({ x: Dx, y: Dy, dx: -dx, dy: -dy, shifted: false });  // slider pushes toward the pocket
    }
  }
  start = { x: sx + 0.5, y: sy + 0.5 };
  startGap = null;
  // the start room: open a small room in the corner, seal every way out, and make one edge tile the slider
  if (CONFIG.sliderAtStart) {
    const openDoor = !F.pockets && !F.pathSlider;   // early phases: the room is simply open
    const rc = CONFIG.startRoomCells, tw = rc*2 - 1;
    const x0 = sx, y0 = sy - tw + 1, x1 = sx + tw - 1, y1 = sy;            // room tile bounds
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y][x] = 1;
    startRoom = { x0, y0, x1, y1 };
    start = { x: x0 + (tw>>1) + 0.5, y: y0 + (tw>>1) + 0.5 };   // wake up in the middle of the room
    // gaps leading out of the room: right side (x1+1) on cell rows, top side (y0-1) on cell columns
    const gaps = [];
    for (let y = y0; y <= y1; y += 2) if (isOpen(x1+1, y)) gaps.push([x1+1, y, 1, 0]);
    for (let x = x0; x <= x1; x += 2) if (isOpen(x, y0-1)) gaps.push([x, y0-1, 0, -1]);
    // make sure there is at least one way out to aim at
    if (!gaps.length) { const y = y1; tiles[y][x1+1] = 1; gaps.push([x1+1, y, 1, 0]); }
    const [gx, gy, ax, ay] = gaps[R() * gaps.length | 0];
    for (const [x, y] of gaps) tiles[y][x] = 0;
    const comp = (x0, y0) => { const seen = new Set([x0+','+y0]), q2 = [[x0,y0]]; while (q2.length) { const [x,y] = q2.shift(); for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !seen.has(k)) { seen.add(k); q2.push([nx,ny]); } } } return seen; };
    const inRoom = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    let main = comp(gx + ax, gy + ay);
    // bridge each orphaned region back into the main one; repeat, since an orphan may only touch another orphan
    for (let pass = 0; pass < gaps.length + 1; pass++) {
      let progressed = false;
      for (const [x, y, dx, dy] of gaps) {
        if (x === gx && y === gy) continue;
        const nx = x + dx, ny = y + dy; if (main.has(nx+','+ny)) continue;
        const orphan = comp(nx, ny), bridges = [];
        for (const k of orphan) { const [ox, oy] = k.split(',').map(Number); for (const [ex,ey] of DIRS) { const bx=ox+ex, by=oy+ey, fx=ox+ex*2, fy=oy+ey*2; if (!isOpen(bx,by) && main.has(fx+','+fy) && !inRoom(fx,fy) && fx>=TX(0) && fx<W-P && fy>=TX(0) && fy<H-P) bridges.push([bx,by]); } }
        if (bridges.length) { const [bx,by] = bridges[R() * bridges.length | 0]; tiles[by][bx] = 1; main = comp(gx + ax, gy + ay); progressed = true; }
      }
      if (!progressed) break;
    }
    if (openDoor) tiles[gy][gx] = 1; else sliders.push({ x: gx - ax, y: gy - ay, dx: ax, dy: ay, shifted: false, atStart: true });
    startGap = [gx, gy];
  }

  // crawl gaps: closed walls between two open cells; open for the Child, drawn sealed for everyone after
  crawlGaps = new Set(); crawlCells = new Set(); hopscotch = []; ticTacToe = null; secretTiles = new Set(); secretMarks = new Map(); exitTree = new Set(); exitTreeMouth = null;
  if (!poolMode) {
    const roomRing = (x, y) => startRoom && x >= startRoom.x0 - 1 && x <= startRoom.x1 + 1 && y >= startRoom.y0 - 1 && y <= startRoom.y1 + 1;
    const cands2 = [];
    for (let y = TX(0); y < H - P; y += 2) for (let x = TX(0); x < W - P; x += 2) {
      for (const [dx, dy] of [[1,0],[0,1]]) { const gx = x + dx, gy = y + dy, fx = x + dx*2, fy = y + dy*2;
        if (fx >= W - P || fy >= H - P || isOpen(gx, gy) || !isOpen(x, y) || !isOpen(fx, fy) || roomRing(gx, gy)) continue;
        if (pockets.some(([px,py]) => (px===x&&py===y) || (px===fx&&py===fy))) continue;
        if (sliders.some(sl => (sl.x===x&&sl.y===y) || (sl.x===fx&&sl.y===fy))) continue;
        cands2.push([gx, gy]); }
    }
    cands2.sort(() => R() - 0.5);
    let wantGaps = F.crawl ? (typeof F.crawl === 'number' ? F.crawl : Math.max(2, N0(CONFIG.crawlGaps))) : N0(CONFIG.crawlGaps);
    // a squeeze district is mostly crawl gaps: serve the ones inside it first, on top of the map's usual quota
    if (clusters.some(c => c.heart === 'squeeze')) {
      const inSq = ([x, y]) => clusterAt('squeeze', x, y);
      const extra = Math.min(cands2.filter(inSq).length, CONFIG.clusterCrawlGaps * clusters.filter(c => c.heart === 'squeeze').length);
      if (extra > 0) { wantGaps += extra; cands2.sort((a, b) => (inSq(b) ? 1 : 0) - (inSq(a) ? 1 : 0)); }
    }
    const usedCells = new Set();
    for (const g of cands2) {
      if (crawlGaps.size >= wantGaps) break;
      const [gx, gy] = g; if (crawlGaps.has(g.join(','))) continue;
      // the two cells either side
      const horiz = isOpen(gx-1, gy) && isOpen(gx+1, gy);
      const A = horiz ? [gx-1, gy] : [gx, gy-1], Bc = horiz ? [gx+1, gy] : [gx, gy+1];
      if (usedCells.has(A.join(',')) || usedCells.has(Bc.join(','))) continue;
      crawlGaps.add(g.join(',')); if (F.crawl) tiles[gy][gx] = 1; usedCells.add(A.join(',')); usedCells.add(Bc.join(','));
      // sometimes it keeps going: from the far cell, a second gap in another direction makes an L (or a straight run)
      if (F.crawl && R() < 0.45) {
        const opts = DIRS.map(([dx,dy]) => [Bc[0]+dx, Bc[1]+dy, Bc[0]+dx*2, Bc[1]+dy*2]).filter(([hx,hy,cx,cy]) => !(hx===gx&&hy===gy) && !isOpen(hx,hy) && isOpen(cx,cy) && cx>=TX(0) && cx<W-P && cy>=TX(0) && cy<H-P && !roomRing(hx,hy) && !usedCells.has(cx+','+cy) && !pockets.some(([px,py])=>px===cx&&py===cy) && !sliders.some(sl=>sl.x===cx&&sl.y===cy) && !sliders.some(sl=>sl.x===Bc[0]&&sl.y===Bc[1]));
        if (opts.length) { const [hx, hy, cx, cy] = opts[R() * opts.length | 0]; crawlGaps.add(hx+','+hy); tiles[hy][hx] = 1; crawlCells.add(Bc.join(',')); usedCells.add(cx+','+cy); }
      }
    }
    // swings: a pocket slider that moves on its own
    if (F.swing) for (const sl of sliders.filter(sl => !sl.atStart && !sl.onPath).slice(0, typeof F.swing === 'number' ? F.swing : N(CONFIG.swings))) { sl.auto = true; sl.nextAt = 0; }

    // A secret place: somewhere small, sealed off, that only a squeeze gets into, covered in
    // somebody else's chalk. Two ways to find one, in order of how much of a room it is:
    //
    //   a room, walled up until one doorway is left — but a room is usually a hub with five or
    //   six ways in, and most of those turn out to be the only route to something, so openings
    //   are sealed one at a time and only while the whole maze stays walkable;
    //
    //   failing that, a dead-end passage, whose mouth simply becomes the squeeze. Nothing is
    //   sealed at all there, so it cannot go wrong; it is a hiding place rather than a room.
    //
    // Child only. For every phase after, a crawl gap is drawn shut, and this would wall it away.
    if (F.crawl && CONFIG.secretRooms) {
      const sealedKeys = new Set(sealedGaps.map(([x, y]) => x + ',' + y));
      const busy = (x, y) => sealedKeys.has(x + ',' + y) || sliders.some(sl => (sl.x === x && sl.y === y) || (sl.x + sl.dx === x && sl.y + sl.dy === y)) || pockets.some(([px, py]) => px === x && py === y);
      const roomZone = (x, y) => startRoom && x >= startRoom.x0 - 2 && x <= startRoom.x1 + 2 && y >= startRoom.y0 - 2 && y <= startRoom.y1 + 2;
      // a pocket's tile is open with its gap sealed; count it walkable, the slider goes both ways
      const walkSeen = () => {
        const s0 = Math.floor(start.x), t0 = Math.floor(start.y);
        const seen = new Set([s0 + ',' + t0]), q2 = [[s0, t0]];
        while (q2.length) { const [x, y] = q2.shift(); for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (seen.has(k) || !(isOpen(nx, ny) || sealedKeys.has(k))) continue; seen.add(k); q2.push([nx, ny]); } }
        return seen;
      };
      const allWalkable = () => { const seen = walkSeen();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x] && !seen.has(x + ',' + y)) return false;
        return true; };
      // The squeeze has to be the ONLY way in, and geometry alone will not tell you that: a room
      // opens its corner tiles, and one of those can touch a corridor running alongside. So shut
      // the mouth, flood, and insist none of it can be reached.
      const onlyWayIn = (mouth, area) => {
        const [mx, my] = mouth; const was = tiles[my][mx];
        tiles[my][mx] = 0; const seen = walkSeen(); tiles[my][mx] = was;
        return !area.some((k) => seen.has(k));
      };
      const tilesOf = (x0, y0, x1, y1) => { const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(x + ',' + y); return out; };

      const order = roomRects.slice(); order.sort(() => R() - 0.5);
      for (const [rx0, ry0, rx1, ry1] of order) {
        const x0 = TX(rx0), y0 = TX(ry0), x1 = TX(rx1), y1 = TX(ry1);
        const ways = [];
        for (let y = y0; y <= y1; y += 2) { if (isOpen(x0 - 1, y)) ways.push([x0 - 1, y]); if (isOpen(x1 + 1, y)) ways.push([x1 + 1, y]); }
        for (let x = x0; x <= x1; x += 2) { if (isOpen(x, y0 - 1)) ways.push([x, y0 - 1]); if (isOpen(x, y1 + 1)) ways.push([x, y1 + 1]); }
        if (!ways.length || ways.some(([x, y]) => busy(x, y) || roomZone(x, y))) continue;
        ways.sort(() => R() - 0.5);
        const shut = [];
        for (const [x, y] of ways) {                       // one at a time, and only if nothing is stranded
          if (ways.length - shut.length <= 1) break;
          tiles[y][x] = 0;
          if (allWalkable()) shut.push([x, y]); else tiles[y][x] = 1;
        }
        const left = ways.filter(([x, y]) => isOpen(x, y));
        const area = tilesOf(x0, y0, x1, y1);
        if (left.length !== 1 || !onlyWayIn(left[0], area)) { for (const [x, y] of shut) tiles[y][x] = 1; continue; }
        crawlGaps.add(left[0].join(','));
        secretTiles = new Set(area);
        break;
      }

      if (!secretTiles.size) {   // no room would take it: find a dead-end passage instead
        const deg = (x, y) => DIRS.filter(([dx, dy]) => isOpen(x + dx, y + dy)).length;
        const corners = [[TX(0), TX(0)], [TX(CONFIG.cols - 1), TX(0)], [TX(CONFIG.cols - 1), TX(CONFIG.rows - 1)]];
        const found = [];
        for (let y = TX(0); y < H - P; y += 2) for (let x = TX(0); x < W - P; x += 2) {
          if (!isOpen(x, y) || deg(x, y) !== 1 || roomZone(x, y) || busy(x, y)) continue;
          if (corners.some(([cx, cy]) => cx === x && cy === y)) continue;
          const chain = [x + ',' + y]; let cx = x, cy = y, back = null, mouth = null;
          for (let step = 0; step < 40; step++) {
            const d = DIRS.find(([dx, dy]) => isOpen(cx + dx, cy + dy) && !(back && dx === -back[0] && dy === -back[1]));
            if (!d) break;
            const gx = cx + d[0], gy = cy + d[1], nx = cx + d[0] * 2, ny = cy + d[1] * 2;
            if (!isOpen(nx, ny)) break;
            if (deg(nx, ny) !== 2 || roomZone(nx, ny) || busy(nx, ny)) { mouth = [gx, gy]; break; }
            chain.push(gx + ',' + gy, nx + ',' + ny); back = d; cx = nx; cy = ny;
          }
          if (mouth && chain.length >= 3 && !crawlGaps.has(mouth.join(',')) && onlyWayIn(mouth, chain)) found.push({ chain, mouth });
        }
        if (found.length) {
          found.sort((a, b) => b.chain.length - a.chain.length || R() - 0.5);   // the deepest hiding place there is
          const pick = found[0];
          crawlGaps.add(pick.mouth.join(','));
          secretTiles = new Set(pick.chain);
        }
      }

      if (secretTiles.size) {
        const glyphs = ['x', '?', 'up', 'down', 'left', 'right'];
        for (const k of secretTiles) if (R() < CONFIG.secretRoomChalk) secretMarks.set(k, glyphs[R() * glyphs.length | 0]);
      }
    }
  }
  if (poolMode) {   // no maze: the start room, a straight hall north, and the water at its end
    for (let y = 0; y < H; y++) tiles[y].fill(0);
    const { x0, y0, x1, y1 } = startRoom;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y][x] = 1;
    const hx = x0 + 2, hallLen = Math.max(6, Math.min(14, y0 - P - 2));
    for (let y = y0 - 1; y >= y0 - hallLen; y--) tiles[y][hx] = 1;
    sliders = []; pockets = []; sealedGaps = []; startGap = [hx, y0 - 1];
    exit = { x: hx, y: y0 - hallLen }; exitAlley = [[hx, y0 - hallLen + 1]];
  }
  // exit gets its own alley: corner cell → one walkway tile → exit tile, carved outward into the margin
  let exX, exY;
  if (!poolMode) {
    const cornerCells = [[TX(0), TX(0), -1], [TX(CONFIG.cols-1), TX(0), 1], [TX(CONFIG.cols-1), TX(CONFIG.rows-1), 1]];
    const [ccx, ccy, side] = cornerCells[R() * 3 | 0];
    exitAlley = [[ccx + side, ccy]]; exX = ccx + side*2; exY = ccy;
    tiles[ccy][ccx + side] = 1; tiles[exY][exX] = 1;
    exit = { x: exX, y: exY };
  } else { exX = exit.x; exY = exit.y; }

  // BFS from start for the solution path (with the start room's door temporarily open)
  if (startGap) tiles[startGap[1]][startGap[0]] = 1;
  const prev = new Map(); const seen = new Set([sx+','+sy]); const q = [[sx, sy]];
  while (q.length) { const [x,y] = q.shift(); for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !seen.has(k)) { seen.add(k); prev.set(k,[x,y]); q.push([nx,ny]); } } }
  solutionPath = []; let cur = [exX, exY];
  while (cur) { solutionPath.push(cur); cur = prev.get(cur[0]+','+cur[1]); }
  solutionPath.reverse();

  // the first unfound page goes in the room closest to the route; the rest in the others
  if (pendingPages.length && roomCenters.length) {
    const onPath = new Set(solutionPath.map(([x,y]) => x+','+y));
    const distToPath = ([cx, cy]) => { const seen = new Set([cx+','+cy]), q3 = [[cx, cy, 0]]; while (q3.length) { const [x,y,d] = q3.shift(); if (onPath.has(x+','+y)) return d; for (const [dx,dy] of DIRS) { const k = (x+dx)+','+(y+dy); if (isOpen(x+dx,y+dy) && !seen.has(k)) { seen.add(k); q3.push([x+dx, y+dy, d+1]); } } } return 1e9; };
    const ordered = roomCenters.slice().sort((a, b) => distToPath(a) - distToPath(b));
    journals = new Map(); pendingPages.forEach((pg, i) => { const [x, y] = ordered[i]; journals.set(x+','+y, pg); });
  }

  // a slider on the main route: seal the gap ahead of a corridor cell and make that cell push into it
  if (CONFIG.sliderOnPath && F.pathSlider) {
    const isCell = ([x,y]) => (x - P) % 2 === 1 && (y - P) % 2 === 1;
    const nOpen = (x, y) => DIRS.filter(([dx,dy]) => isOpen(x+dx, y+dy)).length;
    const usedT = new Set([...sliders.map(sl => sl.x+','+sl.y), ...pockets.map(([x,y]) => x+','+y), ...sliders.map(sl => (sl.x+sl.dx*2)+','+(sl.y+sl.dy*2))]);
    const idxs = [];
    for (let i = 4; i < solutionPath.length - 6; i++) {
      const c = solutionPath[i], g = solutionPath[i+1], n = solutionPath[i+2];
      if (!isCell(c) || !n || !isCell(n) || nOpen(c[0], c[1]) !== 2 || nOpen(n[0], n[1]) > 3) continue;
      if (usedT.has(c.join(',')) || usedT.has(n.join(','))) continue;
      idxs.push(i);
    }
    const reachesExit = () => { const seen = new Set([sx+','+sy]), q2 = [[sx, sy]]; while (q2.length) { const [x,y] = q2.shift(); for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !seen.has(k)) { seen.add(k); q2.push([nx,ny]); } } } return seen.has(exX+','+exY); };
    idxs.sort(() => R() - 0.5);
    for (const i of idxs) {   // only a gap whose sealing truly severs start from exit (rooms add loops)
      const c = solutionPath[i], g = solutionPath[i+1], n = solutionPath[i+2];
      tiles[g[1]][g[0]] = 0;
      if (reachesExit()) { tiles[g[1]][g[0]] = 1; continue; }
      sealedGaps.push([g[0], g[1]]);
      sliders.push({ x: c[0], y: c[1], dx: n[0] - c[0] > 0 ? 1 : n[0] - c[0] < 0 ? -1 : 0, dy: n[1] - c[1] > 0 ? 1 : n[1] - c[1] < 0 ? -1 : 0, shifted: false, onPath: true });
      break;
    }
  }

  // The way out is the last thing between him and out, so it should be a decision, not a corridor.
  // The final stretch becomes a tree of squeezes: one mouth in, forks along the way, one branch
  // that goes on and the rest that end in nothing. Some of it is chambers you step into and choose
  // from; the rest is drawn as tunnel, so it is just crawling, elbows and all.
  //
  // The wrong branches are not invented. Take the last stretch of the way out and lift it out of
  // the maze, and what is left falls into pieces: one big piece, the maze you came from, and a
  // handful of small ones hanging off the stretch. Those small ones are already dead ends — that
  // is what makes them small — so absorbing one whole costs nothing and cuts nothing. Only the
  // trunk's own links back to the big piece are shut, one at a time and only while every floor
  // tile in the maze is still walkable.
  //
  // How long a trunk to take is not obvious, so every length is built and measured and the best
  // one kept: it has to be the only way to the exit, and among those, the one that makes you
  // choose most often wins. Building is deterministic given the length, so the winner is simply
  // built again. Child phases only: for everyone after, a crawl gap is drawn shut and this would
  // wall the exit away.
  if (F.crawl && CONFIG.exitGauntlet && !poolMode) {
    const isCell = (x, y) => (x - P) % 2 === 1 && (y - P) % 2 === 1;
    const inGrid = (x, y) => x >= TX(0) && x < W - P && y >= TX(0) && y < H - P;
    const roomZone = (x, y) => startRoom && x >= startRoom.x0 - 2 && x <= startRoom.x1 + 2 && y >= startRoom.y0 - 2 && y <= startRoom.y1 + 2;
    const sealedKeys2 = new Set(sealedGaps.map(([x, y]) => x + ',' + y));
    const busy = (x, y) => sealedKeys2.has(x + ',' + y) || secretTiles.has(x + ',' + y)
      || sliders.some(sl => (sl.x === x && sl.y === y) || (sl.x + sl.dx === x && sl.y + sl.dy === y))
      || pockets.some(([px, py]) => px === x && py === y);
    const nbrs = (x, y) => DIRS.map(([dx, dy]) => [x + dx * 2, y + dy * 2, x + dx, y + dy])
      .filter(([nx, ny, gx, gy]) => inGrid(nx, ny) && isOpen(gx, gy) && isOpen(nx, ny));
    const walkAll = () => {
      const s0 = Math.floor(start.x), t0 = Math.floor(start.y);
      const seen = new Set([s0 + ',' + t0]), q2 = [[s0, t0]];
      while (q2.length) { const [x, y] = q2.shift(); for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || !(isOpen(nx, ny) || sealedKeys2.has(k))) continue; seen.add(k); q2.push([nx, ny]); } }
      return seen;
    };
    const nothingStranded = () => { const seen = walkAll();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x] && !seen.has(x + ',' + y)) return false;
      return true; };

    const pathCells = solutionPath.filter(([x, y]) => isCell(x, y) && inGrid(x, y));

    // Build a tree of the given trunk length and leave it standing. Returns what it is worth.
    const build = (want) => {
      const trunk = pathCells.slice(-want);
      const before = pathCells[pathCells.length - want - 1];
      const mouth = trunk[0];
      const entrance = ((before[0] + mouth[0]) / 2) + ',' + ((before[1] + mouth[1]) / 2);
      const trunkSet = new Set(trunk.map(c => c.join(',')));

      // lift the trunk out and see what the maze falls into
      const seenCell = new Set(trunkSet), pieces = [];
      for (const c of trunk) for (const [nx, ny] of nbrs(c[0], c[1])) {
        const k0 = nx + ',' + ny;
        if (seenCell.has(k0)) continue;
        const piece = new Set([k0]), q2 = [[nx, ny]]; seenCell.add(k0);
        let touchesBefore = false;
        while (q2.length) {
          const [x, y] = q2.shift();
          if (x === before[0] && y === before[1]) touchesBefore = true;
          for (const [ax, ay] of nbrs(x, y)) { const k = ax + ',' + ay;
            if (trunkSet.has(k) || piece.has(k)) continue; piece.add(k); seenCell.add(k); q2.push([ax, ay]); }
        }
        pieces.push({ piece, touchesBefore });
      }
      // take every hanging piece that will fit, not a chosen few: one left out is a plain corridor
      // off the tree, which spoils the look of it and cannot be shut either, because whatever is
      // down there would be stranded
      const G = new Set(trunkSet);
      const fits = pieces
        .filter(p => !p.touchesBefore && p.piece.size <= CONFIG.exitGauntletBranch
          && ![...p.piece].some(k => { const [x, y] = k.split(',').map(Number); return roomZone(x, y); }))
        .sort((a, b) => b.piece.size - a.piece.size);
      let budget = CONFIG.exitGauntletMaxCells - trunk.length;
      for (const b of fits) { if (b.piece.size > budget) continue; for (const k of b.piece) G.add(k); budget -= b.piece.size; }

      // shut the ways back into the maze you came from, keeping the one you came in by
      const shut = [];
      for (const k of G) {
        const [cx, cy] = k.split(',').map(Number);
        for (const [dx, dy] of DIRS) {
          const gx = cx + dx, gy = cy + dy, nx = cx + dx * 2, ny = cy + dy * 2;
          if (!isOpen(gx, gy) || gx + ',' + gy === entrance) continue;
          if (!inGrid(nx, ny)) continue;                       // the exit alley: that is the way out
          if (G.has(nx + ',' + ny) || busy(gx, gy)) continue;
          tiles[gy][gx] = 0;
          if (nothingStranded()) shut.push([gx, gy]); else tiles[gy][gx] = 1;
        }
      }
      // with the mouth shut, is the exit gone?
      const [mgx, mgy] = entrance.split(',').map(Number);
      const wasMouth = tiles[mgy][mgx]; tiles[mgy][mgx] = 0;
      const only = !walkAll().has(exX + ',' + exY);
      tiles[mgy][mgx] = wasMouth;
      // and how often does it make you choose?
      let forks = 0;
      for (const k of G) { const [cx, cy] = k.split(',').map(Number);
        if (nbrs(cx, cy).filter(([nx, ny]) => G.has(nx + ',' + ny)).length >= 3) forks++; }
      return { G, shut, entrance, mouth, only, forks };
    };
    const unbuild = (r) => { for (const [gx, gy] of r.shut) tiles[gy][gx] = 1; };

    const lengths = [];
    for (let n = CONFIG.exitGauntlet; n >= 4; n -= 2) { const m = Math.min(n, pathCells.length - 3); if (m >= 4 && !lengths.includes(m)) lengths.push(m); }
    let best = null;
    for (const want of lengths) {
      const r = build(want);
      if (!best || (r.only && !best.only) || (r.only === best.only && r.forks > best.forks)) { unbuild(r); best = { want, only: r.only, forks: r.forks }; }
      else unbuild(r);
    }
    if (best) {
      const r = build(best.want);
      const G = r.G;
      // every passage in the tree is a squeeze, the mouth included
      for (const k of G) {
        const [cx, cy] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const gx = cx + dx, gy = cy + dy, nx = cx + dx * 2, ny = cy + dy * 2;
          if (G.has(nx + ',' + ny) && isOpen(gx, gy) && !busy(gx, gy)) crawlGaps.add(gx + ',' + gy);
        }
      }
      { const [ex2, ey2] = r.entrance.split(',').map(Number); if (isOpen(ex2, ey2) && !busy(ex2, ey2)) crawlGaps.add(r.entrance); }
      // and the pass-through cells are drawn narrow, so they read as tunnel rather than a room
      for (const k of G) {
        const [cx, cy] = k.split(',').map(Number);
        if (k === r.mouth.join(',') || busy(cx, cy)) continue;
        if (DIRS.filter(([dx, dy]) => isOpen(cx + dx, cy + dy)).length === 2 && R() < CONFIG.exitGauntletTunnel) crawlCells.add(k);
      }
      exitTree = G; exitTreeMouth = r.entrance;
    }
  }

  // a squeeze on the way out that you cannot go round: a gap on the route whose sealing would cut
  // start from exit, turned into a crawl gap. The tile is already open, so nothing about the maze
  // changes except that getting through it means getting down. Child only — for everyone after, a
  // crawl gap is drawn shut, and this one would wall the exit off.
  if (F.crawl && CONFIG.crawlOnPath && !poolMode) {
    const isCell = ([x, y]) => (x - P) % 2 === 1 && (y - P) % 2 === 1;
    const nearRoom = (x, y) => startRoom && x >= startRoom.x0 - 1 && x <= startRoom.x1 + 1 && y >= startRoom.y0 - 1 && y <= startRoom.y1 + 1;
    const sx4 = Math.floor(start.x), sy4 = Math.floor(start.y);
    const joined = () => { const seen = new Set([sx4+','+sy4]), q2 = [[sx4, sy4]];
      while (q2.length) { const [x, y] = q2.shift(); for (const [dx, dy] of DIRS) { const nx = x+dx, ny = y+dy, k = nx+','+ny;
        if (isOpen(nx, ny) && !seen.has(k)) { seen.add(k); q2.push([nx, ny]); } } } return seen.has(exX + ',' + exY); };
    const idxs = [];
    for (let i = 4; i < solutionPath.length - 4; i++) {
      const g = solutionPath[i];
      if (isCell(g) || crawlGaps.has(g.join(',')) || nearRoom(g[0], g[1])) continue;
      if (exitAlley.some(([ax, ay]) => ax === g[0] && ay === g[1])) continue;
      if (startGap && g[0] === startGap[0] && g[1] === startGap[1]) continue;
      if (sealedGaps.some(([gx, gy]) => gx === g[0] && gy === g[1])) continue;
      if (sliders.some(sl => (sl.x === g[0] && sl.y === g[1]) || (sl.x + sl.dx === g[0] && sl.y + sl.dy === g[1]))) continue;
      idxs.push(i);
    }
    idxs.sort(() => R() - 0.5);
    let made = 0;
    for (const i of idxs) {
      if (made >= CONFIG.crawlOnPath) break;
      const g = solutionPath[i];
      tiles[g[1]][g[0]] = 0; const roundAbout = joined(); tiles[g[1]][g[0]] = 1;
      if (roundAbout) continue;                       // you could walk round it, so squeezing would be optional
      crawlGaps.add(g.join(',')); made++;
    }
  }
  if (startGap && sliders.some(sl => sl.atStart)) tiles[startGap[1]][startGap[0]] = 0;   // seal the start room again (unless the door is simply open)

  // walking distance from the exit, in tiles
  const distExit = new Map([[exX+','+exY, 0]]); const q2 = [[exX, exY]];
  while (q2.length) { const [x,y] = q2.shift(); const d = distExit.get(x+','+y); for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !distExit.has(k)) { distExit.set(k, d+1); q2.push([nx,ny]); } } }
  // dead ends (excluding start/exit and anything too close to the exit)
  const deadEnds = [];
  for (let y=TX(0); y<H-P; y+=2) for (let x=TX(0); x<W-P; x+=2) {
    if (!isOpen(x,y)) continue;
    const n = DIRS.filter(([dx,dy]) => isOpen(x+dx, y+dy)).length;
    const nearExit = (distExit.get(x+','+y) ?? Infinity) <= CONFIG.pickupExitBuffer * 2;
    if (n === 1 && !(x===sx && y===sy) && !nearExit && !sliders.some(sl => sl.x===x && sl.y===y)) deadEnds.push(x+','+y);
  }
  const taken = new Set();
  const free = () => deadEnds.filter(k => !taken.has(k));
  const pickFree = () => { const f = free(); return f.length ? f[R()*f.length|0] : null; };

  // key first, so it always exists
  keySpot = null; gated = !poolMode && CONFIG.keyGate && F.gate && R() < B.keyChance();
  poolDoor = poolMode && startGap ? { x: startGap[0], y: startGap[1], openAt: 0 } : null;
  const pocketKeys = pockets.map(([x,y]) => x+','+y);
  if (poolMode) keySpot = (startRoom.x0 + 3) + ',' + (startRoom.y0 + 3);
  else if (gated) {
    if (pocketKeys.length && R() < CONFIG.sliderKeyChance) keySpot = pocketKeys.shift();
    else { keySpot = pickFree(); if (keySpot) taken.add(keySpot); }
  }

  // pickups: one roll per dead end, capped
  chalkSpots = new Set(); pickups = new Map(); charcoalSpots = new Set();
  const count = kind => [...pickups.values()].filter(v => v === kind).length; const MAXP = N(CONFIG.pickupMax);
  const capFor = kind => kind === 'pointer' ? CONFIG.pointerMax : MAXP;   // one pointer per maze; a second is a second answer
  for (const k of deadEnds) {
    if (taken.has(k)) continue;
    const r = R();
    if (r < CONFIG.chalkSpawnRate) { if (!poolMode) { chalkSpots.add(k); taken.add(k); } }
    else if (r < CONFIG.chalkSpawnRate + CONFIG.charcoalSpawnRate) { if (F.charcoal) { charcoalSpots.add(k); taken.add(k); } }
    else if (r < CONFIG.chalkSpawnRate + CONFIG.charcoalSpawnRate + CONFIG.pointerSpawnRate) { if (F.compass && count('pointer') < capFor('pointer')) { pickups.set(k, 'pointer'); taken.add(k); } }
    else if (r < CONFIG.chalkSpawnRate + CONFIG.charcoalSpawnRate + CONFIG.pointerSpawnRate + CONFIG.pathSpawnRate) { if (F.thread && count('path') < MAXP) { pickups.set(k, 'path'); taken.add(k); } }
  }
  for (const k of pocketKeys) { const r = R(); if (r < 0.3 || (!F.charcoal && r < 0.5)) chalkSpots.add(k); else if (r < 0.5) charcoalSpots.add(k); else if (r < 0.75 && F.compass && count('pointer') < capFor('pointer')) pickups.set(k, 'pointer'); else if (F.thread && count('path') < MAXP) pickups.set(k, 'path'); else chalkSpots.add(k); }
  for (const kind of ['pointer', 'path']) if (!count(kind) && (kind === 'pointer' ? F.compass : F.thread)) { const k = pickFree(); if (k) { pickups.set(k, kind); taken.add(k); } }
  if (!chalkSpots.size && !poolMode) { const k = pickFree(); if (k) { chalkSpots.add(k); taken.add(k); } }
  // chalk in the start room, on interior tiles clear of the mat, shelves and slider
  if (startRoom && !poolMode) { const { x0, y0 } = startRoom; [[x0+1, y0+1], [x0+3, y0+3], [x0+3, y0+1], [x0+1, y0+3]].slice(0, CONFIG.startRoomChalk).forEach(([x, y]) => chalkSpots.add(x+','+y)); }

  // locked doors as a chain along the route: door 1 splits the maze, its key lies in the part you start in;
  // door 2 is further along, its key lies between door 1 and door 2; and so on. The exit is behind the last door.
  doors = []; innerKeys = new Map();
  if (F.doors && !poolMode && solutionPath.length > 20) {
    const roomRing3 = (x, y) => startRoom && x >= startRoom.x0 - 1 && x <= startRoom.x1 + 1 && y >= startRoom.y0 - 1 && y <= startRoom.y1 + 1;
    const isGap = (x, y) => isOpen(x, y) && ((x - P) % 2 === 0) !== ((y - P) % 2 === 0);
    const okGap = (x, y) => isGap(x, y) && !roomRing3(x, y) && !crawlGaps.has(x+','+y) && !sliders.some(sl => (sl.x+sl.dx===x&&sl.y+sl.dy===y) || (sl.x===x&&sl.y===y)) && !exitAlley.some(([ax,ay])=>ax===x&&ay===y) && !(startGap && x===startGap[0] && y===startGap[1]) && !sealedGaps.some(([gx,gy]) => gx===x&&gy===y);
    // treat everything you can slide through as open while planning
    const reopened = [...sealedGaps, ...(startGap ? [startGap] : [])].filter(([x, y]) => !isOpen(x, y)); for (const [x, y] of reopened) tiles[y][x] = 1;
    const reach = (sx0, sy0, sealed) => { const seen = new Set([sx0+','+sy0]), q = [[sx0, sy0]]; while (q.length) { const [x,y] = q.shift(); for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !seen.has(k) && !sealed.has(k)) { seen.add(k); q.push([nx,ny]); } } } return seen; };
    const sx3 = Math.floor(start.x), sy3 = Math.floor(start.y);
    const n = F.doors, L = solutionPath.length;
    // door positions: spread along the route, snapped to the nearest usable passage tile
    const picks = [];
    const severs = (x, y) => !reach(sx3, sy3, new Set([...picks.map(([px,py]) => px+','+py), x+','+y])).has(exit.x+','+exit.y);   // loops mustn't route around it
    for (let i = 1; i <= n; i++) { const target = Math.floor(L * i / (n + 1)); let best = null;
      for (let off = 0; off < L / (2 * (n + 1)) && !best; off++) for (const idx of [target + off, target - off]) { const t = solutionPath[idx]; if (t && idx > 6 && idx < L - 4 && okGap(t[0], t[1]) && !picks.some(([px,py]) => px===t[0]&&py===t[1]) && severs(t[0], t[1])) { best = t; break; } }
      if (best) picks.push(best); }
    // keys: each in the section opened by the previous door and closed by this one
    let prevSide = new Set();
    for (let i = 0; i < picks.length; i++) {
      const sealed = new Set(picks.slice(i).map(([x, y]) => x+','+y));
      const side = reach(sx3, sy3, sealed);
      const section = [...side].filter(k => !prevSide.has(k));
      const routeSet = new Set(solutionPath.map(([x, y]) => x+','+y));
      const pocketSet = new Set(pockets.map(([x, y]) => x+','+y));
      const cellsIn = section.filter(k => { const [x, y] = k.split(',').map(Number); return (x-P)%2===1 && (y-P)%2===1 && !roomRing3(x, y) && !journals.has(k) && !innerKeys.has(k) && !sliders.some(sl => sl.x===x&&sl.y===y) && !(x===exit.x&&y===exit.y) && !routeSet.has(k) && (!taken.has(k) || pocketSet.has(k)); });
      if (!cellsIn.length) break;
      // hide it: deep in the section, far from the route, far from its door; a sealed pocket (behind a slider or swing) is best of all
      const dRoute = new Map(); { const q = solutionPath.filter(([x,y]) => side.has(x+','+y)).map(([x,y]) => [x,y]); q.forEach(([x,y]) => dRoute.set(x+','+y, 0)); while (q.length) { const [x,y] = q.shift(); const d = dRoute.get(x+','+y); for (const [dx,dy] of DIRS) { const k = (x+dx)+','+(y+dy); if (isOpen(x+dx,y+dy) && side.has(k) && !dRoute.has(k)) { dRoute.set(k, d+1); q.push([x+dx,y+dy]); } } } }
      const dDoor = new Map(); { const q = [picks[i]]; dDoor.set(picks[i].join(','), 0); while (q.length) { const [x,y] = q.shift(); const d = dDoor.get(x+','+y); for (const [dx,dy] of DIRS) { const k = (x+dx)+','+(y+dy); if (isOpen(x+dx,y+dy) && !dDoor.has(k) && (side.has(k) || k === picks[i].join(','))) { dDoor.set(k, d+1); q.push([x+dx,y+dy]); } } } }
      const scored = cellsIn.map(k => [k, (dRoute.get(k) ?? 30) * 2 + Math.min(30, dDoor.get(k) ?? 30) + (pocketSet.has(k) ? 40 : 0) + (deadEnds.includes(k) ? 8 : 0) + R() * 6]).sort((a, b) => b[1] - a[1]);
      const pool = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.2))).map(([k]) => k);   // the best fifth, then chance
      const kk = pool[R() * pool.length | 0], shape = KEY_SHAPES[i % KEY_SHAPES.length];
      innerKeys.set(kk, shape); taken.add(kk); chalkSpots.delete(kk); charcoalSpots.delete(kk); pickups.delete(kk); scrapSpots.delete(kk);   // the key replaces whatever loot lay there
      doors.push({ x: picks[i][0], y: picks[i][1], shape, open: false, onRoute: true });
      prevSide = side;
    }
    for (const [x, y] of reopened) tiles[y][x] = 0;
  }

  // map scraps in free dead ends
  scrapSpots = new Set();
  if (F.scraps) for (let i = 0; i < N(CONFIG.mapScraps); i++) { const k = pickFree(); if (k) { scrapSpots.add(k); taken.add(k); } }

  // darkness: one region grown from a far tile until it holds the configured share of the floor; never the start room or its ring
  darkTiles = new Set(); darkFringe = new Map(); lampSpot = null;
  const darkShare = (F.darkness && F.lamp && R() < B.darkChance()) ? F.darkness[R() * F.darkness.length | 0] : 0;
  if (darkShare > 0) {
    const roomZone = (x, y) => startRoom && x >= startRoom.x0 - 1 && x <= startRoom.x1 + 1 && y >= startRoom.y0 - 1 && y <= startRoom.y1 + 1;
    // distances from the room door, with the door open
    const door = startGap ? [startGap[0] + (startGap[0] > startRoom.x1 ? 1 : 0), startGap[1] - (startGap[1] < startRoom.y0 ? 1 : 0)] : [sx, sy];
    const reopen = sealedGaps.filter(([x, y]) => !(startGap && x === startGap[0] && y === startGap[1]));
    for (const [x, y] of reopen) tiles[y][x] = 1;   // let the darkness reach across sliders and into pockets
    const dist = new Map([[door.join(','), 0]]); const qd = [door];
    while (qd.length) { const [x,y] = qd.shift(); const d = dist.get(x+','+y); for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !dist.has(k) && !roomZone(nx,ny)) { dist.set(k, d+1); qd.push([nx,ny]); } } }
    const openAll = [...dist.keys()], maxD = Math.max(...dist.values());
    const target = Math.floor(openAll.length * darkShare);
    const seeds = openAll.filter(k => dist.get(k) >= maxD * 0.5);
    const seed = seeds[R() * seeds.length | 0];
    const qg = [seed]; darkTiles.add(seed);
    while (qg.length && darkTiles.size < target) {
      const idx = R() < 0.3 ? (R() * qg.length | 0) : 0;                    // mostly breadth-first, a little ragged at the edge
      const [x,y] = qg.splice(idx, 1)[0].split(',').map(Number);
      for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !darkTiles.has(k) && !roomZone(nx,ny) && (dist.get(k) ?? Infinity) >= CONFIG.darkBufferTiles && darkTiles.size < target) { darkTiles.add(k); qg.push(k); } }
    }
    // the lamp: a dead end you can reach without crossing darkness, else any lit reachable tile
    const litReach = new Set([door.join(',')]); const ql = [door];
    while (ql.length) { const [x,y] = ql.shift(); for (const [dx,dy] of DIRS) { const nx=x+dx, ny=y+dy, k=nx+','+ny; if (isOpen(nx,ny) && !litReach.has(k) && !darkTiles.has(k) && !roomZone(nx,ny)) { litReach.add(k); ql.push([nx,ny]); } } }
    const litDead = deadEnds.filter(k => !taken.has(k) && litReach.has(k));
    if (litDead.length) lampSpot = litDead[R() * litDead.length | 0];
    else { const any = [...litReach].filter(k => { const [x,y] = k.split(',').map(Number); return (x-P)%2===1 && (y-P)%2===1 && !taken.has(k) && !chalkSpots.has(k) && !pickups.has(k) && k !== keySpot && !journals.has(k) && !charcoalSpots.has(k); }); lampSpot = any.length ? any[R() * any.length | 0] : null; }
    if (lampSpot) taken.add(lampSpot);
    for (const [x, y] of reopen) tiles[y][x] = 0;   // reseal
    for (const [x, y] of reopen) darkTiles.delete(x+','+y);
    // the drop-off: two rings of open tiles around the darkness get progressively dimmer
    darkFringe = new Map();
    let ring = [...darkTiles];
    for (let level = 2; level >= 1; level--) {
      const next = [];
      for (const k of ring) { const [x,y] = k.split(',').map(Number); for (const [dx,dy] of DIRS) { const nk = (x+dx)+','+(y+dy); if (isOpen(x+dx, y+dy) && !darkTiles.has(nk) && !darkFringe.has(nk)) { darkFringe.set(nk, level); next.push(nk); } } }
      ring = next;
    }
  }

  // the father: fixed spots you walk into. First just outside the door; the rest spaced along the way and at junctions.
  figures = [];
  if (F.figure && !poolMode) {
    const spots = [];
    if (startRoom) {   // across the room's wall: visible from inside, a long way round on foot
      const { x0, y0, x1, y1 } = startRoom, cxr = x0 + 2, cyr = y0 + 2;
      const dist = new Map([[cxr+','+cyr, 0]]), q0 = [[cxr, cyr]];
      while (q0.length) { const [cx, cy] = q0.shift(); const d = dist.get(cx+','+cy); if (d >= 9) continue; for (const [dx,dy] of DIRS) { const nx=cx+dx, ny=cy+dy, k=nx+','+ny; if (isOpen(nx,ny) && !dist.has(k)) { dist.set(k, d+1); q0.push([nx,ny]); } } }
      const near = [];
      for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) {
        if (!isOpen(x, y) || (x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1) || dist.has(x+','+y)) continue;   // outside the ring, not walkable in 9
        if (startGap && Math.abs(x - startGap[0]) + Math.abs(y - startGap[1]) <= 2) continue;                              // not the doorway
        if (solutionPath.some(([rx, ry]) => rx === x && ry === y)) continue;                                                   // not on your way
        near.push([x, y]); }
      if (near.length) spots.push(near[R() * near.length | 0]);
    }
    const tooClose = (x, y) => spots.some(([sx2, sy2]) => Math.abs(sx2 - x) + Math.abs(sy2 - y) < 6);
    const roomZone2 = (x, y) => startRoom && x >= startRoom.x0 - 1 && x <= startRoom.x1 + 1 && y >= startRoom.y0 - 1 && y <= startRoom.y1 + 1;
    // vantage spots: a tile you can see across a wall (within ~2.5 tiles as the crow flies) but not walk to in under 10 steps.
    // Prefer spots whose vantage tiles lie on the solution route, so you actually pass them.
    const onRoute = new Set(solutionPath.map(([x, y]) => x+','+y));
    const scored = [];
    for (let y = TX(0); y < H - P; y += 2) for (let x = TX(0); x < W - P; x += 2) {
      if (!isOpen(x, y) || roomZone2(x, y) || onRoute.has(x+','+y) || journals.has(x+','+y) || taken.has(x+','+y) || sliders.some(sl => sl.x===x&&sl.y===y) || (x === exit.x && y === exit.y)) continue;
      const dist = new Map([[x+','+y, 0]]), q2 = [[x, y]];
      while (q2.length) { const [cx, cy] = q2.shift(); const d = dist.get(cx+','+cy); if (d >= 10) continue; for (const [dx,dy] of DIRS) { const nx=cx+dx, ny=cy+dy, k=nx+','+ny; if (isOpen(nx,ny) && !dist.has(k)) { dist.set(k, d+1); q2.push([nx,ny]); } } }
      let vantage = 0, routeVantage = 0;
      for (let vy = y - 3; vy <= y + 3; vy++) for (let vx = x - 3; vx <= x + 3; vx++) { if (!isOpen(vx, vy) || roomZone2(vx, vy)) continue; const e = Math.hypot(vx - x, vy - y); if (e < 1.5 || e > 2.6) continue; if (!dist.has(vx+','+vy)) { vantage++; if (onRoute.has(vx+','+vy)) routeVantage++; } }
      if (vantage >= 2) scored.push([x, y, routeVantage * 3 + vantage]);
    }
    scored.sort((a, b) => b[2] - a[2] + (R() - 0.5) * 2);
    for (const [x, y] of scored) { if (spots.length >= CONFIG.figureSpots) break; if (!tooClose(x, y)) spots.push([x, y]); }
    figures = spots.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5, alpha: 1, seen: false, gone: false }));
  }

  // tunnels: straight interior runs of corridor (exactly two opposite neighbors), roofed over
  tunnelTiles = new Set();
  const runs = [];
  for (const horiz of [true, false]) {
    for (let a = 1; a < (horiz ? H : W) - 1; a++) {
      let run = [];
      for (let b = 1; b < (horiz ? W : H); b++) {
        const x = horiz ? b : a, y = horiz ? a : b;
        const straight = isOpen(x,y) && !doors.some(d => d.x===x && d.y===y) && !crawlGaps.has(x+','+y) && !crawlCells.has(x+','+y) && !sliders.some(sl => sl.x===x && sl.y===y) && !(x===exit.x && y===exit.y) && !exitAlley.some(([ax,ay]) => ax===x && ay===y) && (horiz ? (isOpen(x-1,y) && isOpen(x+1,y) && !isOpen(x,y-1) && !isOpen(x,y+1)) : (isOpen(x,y-1) && isOpen(x,y+1) && !isOpen(x-1,y) && !isOpen(x+1,y)));
        if (straight) run.push(x+','+y); else { if (run.length >= CONFIG.tunnelMinTiles) runs.push(run); run = []; }
      }
      if (run.length >= CONFIG.tunnelMinTiles) runs.push(run);
    }
  }
  for (let i = 0; i < (F.tunnels ? N(CONFIG.tunnels) : 0) && runs.length; i++) {
    const run = runs.splice(R() * runs.length | 0, 1)[0];
    run.forEach(k => tunnelTiles.add(k));
  }
  // tic-tac-toe: a board chalked on a room floor, abandoned mid-game (X was winning)
  if (F.hopscotch && !poolMode && roomCenters.length) {
    const spots = roomCenters.filter(([x, y]) => !journals.has(x+','+y));
    const [cx, cy] = (spots.length ? spots : roomCenters)[R() * (spots.length ? spots.length : roomCenters.length) | 0];
    const games = [['x','o','x', '', 'x','', 'o','',''], ['o','','x', '','x','', '','','o'], ['x','x','', 'o','o','', '','','x']];
    ticTacToe = { x: journals.has(cx+','+cy) && isOpen(cx+1, cy) ? cx + 1 : cx, y: cy, cells: games[R() * games.length | 0] };
  }
  // hopscotch: chalked squares down a straight run, numbered; step them in order
  if (F.hopscotch && !poolMode) {
    const ok = runs.filter(r => r.length >= 5 && !r.some(k => crawlGaps.has(k) || crawlCells.has(k) || journals.has(k) || chalkSpots.has(k)));
    if (ok.length) { const run = ok[R() * ok.length | 0]; hopscotch = run.slice(0, Math.min(8, run.length)); if (R() < 0.5) hopscotch.reverse(); }
  }
}


