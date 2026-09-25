// The Maze — the district prototype
//
// Joe: "I've always thought we should decide what we want to have in the maze
// before we build the maze. They pick a certain number of rooms, vaults, keys,
// statues... then we place those districts... At this point we haven't built any
// halls for mazes at all. We just have a number of different points of interest
// placed inside of various districts. And then we come in and we draw the maze."
//
// The ordinary generator does the opposite, and `docs/QUALITY.md` is the argument
// for why that matters. Its order is: carve the whole maze, prune, braid, then
// drop rooms into what is left, stamp districts over the finished halls, and
// place the key near the very end. Every one of the five complaints that doc
// measures falls out of that order:
//
//   the key is placed last, so it lands in a vault only by luck ...... 3% do
//   districts are stamped over a finished mesh and "can never take a
//     connection away", so nothing divides ......................... 0.1 thresholds
//   rooms go into leftover space, so they clump ................... 0 tiles apart
//   nothing draws the route through anything, so it is short ...... 45-90 seconds
//
// This builds the other way round:
//
//   1. the manifest — what the maze must hold, before any ground exists
//   2. the districts — laid out as ground, in the order you walk them
//   3. the points of interest — placed INSIDE districts, still no halls
//   4. the halls — carved around what is already there, per district, each to
//      its own character
//   5. the gates — a counted number of ways between neighbours. ONE gate is a
//      chokepoint, and a chokepoint is the thing the real generator cannot make
//      at any setting of any knob
//   6. the route — start to exit, through every district in order
//
// Solvability is by construction rather than by check: the districts form a
// chain, and a locked gate's key always lives in a district earlier in that
// chain, so there is no order in which you can strand yourself.
//
// Every number lives in CONFIG.districtProto. Nothing here is tuned in code.
//
// Part of the engine, loaded as a plain script. Reached from the debug
// Prototype menu; buildProto() dispatches to it.

function buildDistricts(seed) {
  const D = CONFIG.districtProto;
  const plan = D.districts;
  const [gw, gh] = D.grid, [sw, sh] = D.slot;

  // ── separate RNG streams ──────────────────────────────────────────────────
  // One stream per stage, each off its own prime. Drawing everything from one
  // stream means adding a squeeze changes the halls and re-deals every seed —
  // the trap the maze-task notes call out. These can be tuned independently.
  const Rlay = rng(seed + 10007);   // where things go
  const Rcarve = rng(seed + 10009); // the halls
  const Rmech = rng(seed + 10037);  // the mechanics

  protoReset([gw * sw, gh * sh]);
  protoWide = false;                // this one is meant to be walked, not surveyed
  protoCellGrid = true;             // built on the cell lattice, so contract.js can count loops
  const cols = CONFIG.cols, rows = CONFIG.rows;
  const TXc = (c) => c * 2 + 1 + P;
  const K = (x, y) => x + ',' + y;
  const openCell = (cx, cy) => { tiles[TXc(cy)][TXc(cx)] = 1; };
  const openLink = (ax, ay, bx, by) => { tiles[TXc(ay) + (by - ay)][TXc(ax) + (bx - ax)] = 1; };
  const inGrid = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows;

  // ── 1–2. the districts, as ground, in the order you walk them ─────────────
  // A snake through the slot grid, so district i always touches district i+1 and
  // the chain is a chain. 3x2 walks 0,0 → 1,0 → 2,0 → 2,1 → 1,1 → 0,1.
  const slots = [];
  for (let sy = 0; sy < gh; sy++) {
    const row = [];
    for (let sx = 0; sx < gw; sx++) row.push([sx, sy]);
    slots.push(sy % 2 ? row.reverse() : row);
  }
  const order = [].concat(...slots);

  const districts = plan.map((spec, i) => {
    const [sx, sy] = order[i];
    return Object.assign({}, spec, {
      i, sx, sy,
      x0: sx * sw, y0: sy * sh, x1: sx * sw + sw - 1, y1: sy * sh + sh - 1,
      reserved: [],          // rects no hall may carve through
    });
  });
  const inD = (d, cx, cy) => cx >= d.x0 && cx <= d.x1 && cy >= d.y0 && cy <= d.y1;
  const districtAt = (cx, cy) => districts.find((d) => inD(d, cx, cy)) || null;

  // ── 3. the points of interest, placed before any hall exists ──────────────
  const m = D.reserveMargin;
  // a free rect inside a district, clear of what is already reserved there
  function claim(d, w, h, tries = 120) {
    for (let t = 0; t < tries; t++) {
      const x0 = d.x0 + m + (Rlay() * Math.max(1, (d.x1 - d.x0 + 1) - w - 2 * m) | 0);
      const y0 = d.y0 + m + (Rlay() * Math.max(1, (d.y1 - d.y0 + 1) - h - 2 * m) | 0);
      const x1 = x0 + w - 1, y1 = y0 + h - 1;
      if (x1 > d.x1 - m || y1 > d.y1 - m) continue;
      const clash = d.reserved.some((r) => x0 <= r.x1 + 1 && x1 >= r.x0 - 1 && y0 <= r.y1 + 1 && y1 >= r.y0 - 1);
      if (clash) continue;
      const rect = { x0, y0, x1, y1 };
      d.reserved.push(rect);
      return rect;
    }
    return null;
  }

  const ROOM_KINDS = typeof LANDMARK_KINDS !== 'undefined' ? LANDMARK_KINDS : ['pool'];
  for (const d of districts) {
    const wantRooms = plan[d.i].rooms || 1;   // `rooms` on the spec is a count; d.rooms becomes the rects
    d.rooms = [];
    for (let r = 0; r < wantRooms; r++) {
      const rect = claim(d, D.roomCells, D.roomCells);
      if (rect) { rect.kind = ROOM_KINDS[(Rlay() * ROOM_KINDS.length) | 0]; d.rooms.push(rect); }
    }
    // a vault goes in the district BEFORE the locked one, because that is where
    // you are standing when you meet the door it opens
    if (plan[d.i + 1] && plan[d.i + 1].mech === 'lock') d.vault = claim(d, D.vaultCells, D.vaultCells);
  }

  // ── 4. the halls, carved around what is already there ─────────────────────
  // Growing tree inside one district, never crossing a reserved rect and never
  // leaving the district. Each district gets its own straightness, braid and
  // fill, which is what makes them feel like different places.
  const reservedAt = new Set();
  for (const d of districts) for (const r of d.reserved)
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) reservedAt.add(K(x, y));

  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const d of districts) {
    const seen = new Set();
    const free = (cx, cy) => inD(d, cx, cy) && !reservedAt.has(K(cx, cy));
    // start the tree at a free cell
    let seedCell = null;
    for (let t = 0; t < 400 && !seedCell; t++) {
      const cx = d.x0 + (Rcarve() * sw | 0), cy = d.y0 + (Rcarve() * sh | 0);
      if (free(cx, cy)) seedCell = [cx, cy];
    }
    if (!seedCell) continue;
    openCell(...seedCell); seen.add(K(...seedCell));
    const stack = [seedCell];
    let last = null;
    while (stack.length) {
      // newest cell biased by `straight`: carry on the way we were going when we can
      const idx = stack.length - 1;
      const [cx, cy] = stack[idx];
      let opts = DIRS4.filter(([dx, dy]) => free(cx + dx, cy + dy) && !seen.has(K(cx + dx, cy + dy)));
      if (!opts.length) { stack.splice(idx, 1); continue; }
      let pick = opts[(Rcarve() * opts.length) | 0];
      if (last && Rcarve() < d.straight) {
        const on = opts.find(([dx, dy]) => dx === last[0] && dy === last[1]);
        if (on) pick = on;
      }
      const nx = cx + pick[0], ny = cy + pick[1];
      openCell(nx, ny); openLink(cx, cy, nx, ny);
      seen.add(K(nx, ny)); stack.push([nx, ny]); last = pick;
    }
    d.cells = [...seen];

    // dead space: prune leaves back until only `fill` of the district is corridor
    if (d.fill < 1) {
      const want = Math.floor(d.cells.length * d.fill);
      const degree = (cx, cy) => DIRS4.filter(([dx, dy]) =>
        seen.has(K(cx + dx, cy + dy)) && tiles[TXc(cy) + dy][TXc(cx) + dx]).length;
      let live = new Set(seen);
      for (let pass = 0; pass < 200 && live.size > want; pass++) {
        const leaves = [...live].filter((k) => { const [x, y] = k.split(',').map(Number); return degree(x, y) === 1; });
        if (!leaves.length) break;
        for (const k of leaves) {
          if (live.size <= want) break;
          const [x, y] = k.split(',').map(Number);
          for (const [dx, dy] of DIRS4) tiles[TXc(y) + dy][TXc(x) + dx] = 0;
          tiles[TXc(y)][TXc(x)] = 0;
          live.delete(k);
        }
      }
      d.cells = [...live];
    }

    // braid: open some dead ends back into loops, so you get lost INSIDE a district
    if (d.braid > 0) {
      const liveSet = new Set(d.cells);
      for (const k of d.cells) {
        const [x, y] = k.split(',').map(Number);
        const open = DIRS4.filter(([dx, dy]) => tiles[TXc(y) + dy][TXc(x) + dx]);
        if (open.length !== 1 || Rcarve() >= d.braid) continue;
        const shut = DIRS4.filter(([dx, dy]) => !tiles[TXc(y) + dy][TXc(x) + dx]
          && liveSet.has(K(x + dx, y + dy)));
        if (shut.length) { const [dx, dy] = shut[(Rcarve() * shut.length) | 0]; tiles[TXc(y) + dy][TXc(x) + dx] = 1; }
      }
    }
  }

  // open the reserved rects now, and join each to its district's halls
  for (const d of districts) {
    for (const r of d.reserved) {
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        openCell(x, y);
        if (x < r.x1) openLink(x, y, x + 1, y);
        if (y < r.y1) openLink(x, y, x, y + 1);
      }
      // two doorways, so a room is a place you pass through rather than a pocket
      const edges = [];
      for (let x = r.x0; x <= r.x1; x++) { edges.push([x, r.y0, 0, -1]); edges.push([x, r.y1, 0, 1]); }
      for (let y = r.y0; y <= r.y1; y++) { edges.push([r.x0, y, -1, 0]); edges.push([r.x1, y, 1, 0]); }
      let made = 0;
      for (let t = 0; t < 300 && made < (r === d.vault ? 1 : 2); t++) {
        const [x, y, dx, dy] = edges[(Rlay() * edges.length) | 0];
        const nx = x + dx, ny = y + dy;
        if (!inD(d, nx, ny) || reservedAt.has(K(nx, ny)) || !tiles[TXc(ny)][TXc(nx)]) continue;
        openLink(x, y, nx, ny); made++;
      }
      if (!made) {   // nothing adjacent was carved: force one so it is never sealed
        for (const [x, y, dx, dy] of edges) {
          const nx = x + dx, ny = y + dy;
          if (!inD(d, nx, ny) || reservedAt.has(K(nx, ny))) continue;
          openCell(nx, ny); openLink(x, y, nx, ny); made++; break;
        }
      }
    }
  }

  // ── 5. the gates: a counted number of ways between neighbours ─────────────
  // This is the whole point. One gate between two districts makes that link an
  // articulation point, which is a threshold, which is the thing the real
  // generator has none of.
  const gatesOf = [];
  for (let i = 1; i < districts.length; i++) {
    const a = districts[i - 1], b = districts[i];
    // every pair of adjacent cells straddling their shared boundary
    const pairs = [];
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      if (!inD(a, cx, cy)) continue;
      for (const [dx, dy] of DIRS4) {
        const nx = cx + dx, ny = cy + dy;
        if (!inGrid(nx, ny) || !inD(b, nx, ny)) continue;
        if (!tiles[TXc(cy)][TXc(cx)] || !tiles[TXc(ny)][TXc(nx)]) continue;
        if (reservedAt.has(K(cx, cy)) || reservedAt.has(K(nx, ny))) continue;
        pairs.push([cx, cy, nx, ny]);
      }
    }
    const made = [];
    for (let g = 0; g < (b.gates || 1) && pairs.length; g++) {
      const p = pairs.splice((Rlay() * pairs.length) | 0, 1)[0];
      openLink(p[0], p[1], p[2], p[3]);
      made.push(p);
    }
    if (!made.length) {   // both sides pruned away from the seam: carve a way through
      const cy = Math.max(a.y0, b.y0), cx = Math.max(a.x0, b.x0);
      const horiz = a.sy === b.sy;
      const ax = horiz ? a.x1 : cx + 1, ay = horiz ? cy + 1 : a.y1;
      const bx = horiz ? b.x0 : cx + 1, by = horiz ? cy + 1 : b.y0;
      openCell(ax, ay); openCell(bx, by); openLink(ax, ay, bx, by);
      made.push([ax, ay, bx, by]);
    }
    gatesOf.push({ from: a, to: b, pairs: made });
  }

  // ── 6. the mechanics, one district each ───────────────────────────────────
  const floorCells = () => {
    const out = [];
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if (tiles[TXc(cy)][TXc(cx)]) out.push([cx, cy]);
    return out;
  };
  const cellsOf = (d) => floorCells().filter(([cx, cy]) => inD(d, cx, cy));
  const pickFrom = (list, R) => list.length ? list[(R() * list.length) | 0] : null;

  for (const d of districts) {
    const mine = cellsOf(d);

    if (d.mech === 'crawl') {
      // squeezes: a shut link reopened as a low gap. Narrow to walk, and the one
      // way through a wall that is otherwise solid.
      let made = 0;
      for (let t = 0; t < 900 && made < D.crawlPerDistrict; t++) {
        const [cx, cy] = pickFrom(mine, Rmech) || [];
        if (cx == null) break;
        const [dx, dy] = DIRS4[(Rmech() * 4) | 0];
        const nx = cx + dx, ny = cy + dy;
        if (!inD(d, nx, ny) || !tiles[TXc(ny)][TXc(nx)]) continue;
        const gx = TXc(cx) + dx, gy = TXc(cy) + dy;
        if (tiles[gy][gx]) continue;                       // already a way through
        tiles[gy][gx] = 1; crawlGaps.add(K(gx, gy));
        made++;
      }
    }

    if (d.mech === 'push') {
      // A push block is a TILE, not a cell. Its home tile is floor; the sealed gap
      // is the single tile beyond it — the wall between two cells — and shoving it
      // slides the block one tile into that gap so you can ride across. Modelling
      // dx,dy in CELL steps put the pocket two cells out with a shut cell between,
      // which left every pocket stranded: six unreachable tiles a maze.
      let made = 0;
      for (let t = 0; t < 900 && made < D.pushPerDistrict; t++) {
        const spot = pickFrom(mine, Rmech);
        if (!spot) break;
        const [cx, cy] = spot;
        const [dx, dy] = DIRS4[(Rmech() * 4) | 0];
        const nx = cx + dx, ny = cy + dy;                  // the pocket's cell
        if (!inD(d, nx, ny) || reservedAt.has(K(nx, ny))) continue;
        if (tiles[TXc(ny)][TXc(nx)]) continue;             // must be unused ground
        const gx = TXc(cx) + dx, gy = TXc(cy) + dy;        // the sealed gap tile
        if (tiles[gy][gx]) continue;
        if (sliders.some((sl) => sl.x === TXc(cx) && sl.y === TXc(cy))) continue;
        openCell(nx, ny);                                  // reachable only by shoving
        sliders.push({ x: TXc(cx), y: TXc(cy), dx, dy, shifted: false });
        pockets.push([TXc(nx), TXc(ny)]);
        made++;
      }
    }

    if (d.mech === 'dark') {
      // the unlit quarter. The lamp is left at the END of the district before it,
      // so you always have it in hand before you need it.
      const shuffled = mine.slice().sort(() => Rmech() - 0.5);
      const take = Math.floor(shuffled.length * D.darkShare);
      for (const [cx, cy] of shuffled.slice(0, take)) darkTiles.add(K(TXc(cx), TXc(cy)));
      for (const k of darkTiles) {                       // the dimmer ring around the dark
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of DIRS4) {
          const nk = K(x + dx * 2, y + dy * 2);
          if (!darkTiles.has(nk)) darkFringe.set(nk, 1);
        }
      }
      const prev = districts[d.i - 1];
      if (prev) { const c = pickFrom(cellsOf(prev), Rmech); if (c) lampSpot = K(TXc(c[0]), TXc(c[1])); }
    }

    if (d.mech === 'lock') {
      // the key lives in this district's vault; the LOCKED GATE is the one into
      // it, so the key is found before the door it opens is ever met. The chain
      // is what guarantees that — see the note at the top.
    }
  }

  // the locked gate: the last district's way in, and the key in the district before
  const lockD = districts.find((d) => d.mech === 'lock');
  if (lockD && lockD.i > 0) {
    const gate = gatesOf[lockD.i - 1];
    if (gate && gate.pairs.length) {
      const [ax, ay, bx, by] = gate.pairs[0];
      const shape = (typeof KEY_SHAPES !== 'undefined' ? KEY_SHAPES : ['circle'])[0];
      doors.push({ x: TXc(ax) + (bx - ax), y: TXc(ay) + (by - ay), shape, open: false });   // the link tile itself
      // the key, in the vault of the district you are in when you meet the door
      const holder = districts[lockD.i - 1];
      if (holder && holder.vault) {
        innerKeys.set(K(TXc((holder.vault.x0 + holder.vault.x1) >> 1), TXc((holder.vault.y0 + holder.vault.y1) >> 1)), shape);
      } else {
        const c = pickFrom(cellsOf(districts[lockD.i - 1]), Rmech);
        if (c) innerKeys.set(K(TXc(c[0]), TXc(c[1])), shape);
      }
    }
  }
  // every vault that exists is a nest worth finding: register it so the contract
  // and the tuner can see a key as buried rather than loose
  for (const d of districts) if (d.vault) {
    const v = d.vault;
    keyVaults.push({ x0: TXc(v.x0), y0: TXc(v.y0), x1: TXc(v.x1), y1: TXc(v.y1),
      cx: TXc((v.x0 + v.x1) >> 1), cy: TXc((v.y0 + v.y1) >> 1) });
  }
  keyVault = keyVaults[0] || null;

  // rooms become landmarks, and every district gets a journal so it is worth entering
  let roomIdx = 0;
  for (const d of districts) {
    for (const r of d.rooms) {
      landmarks.push({ x: TXc((r.x0 + r.x1) >> 1), y: TXc((r.y0 + r.y1) >> 1), kind: r.kind, room: roomIdx++,
        rx0: TXc(r.x0), ry0: TXc(r.y0), rx1: TXc(r.x1), ry1: TXc(r.y1) });
    }
    for (let j = 0; j < D.journalsPer; j++) {
      const c = pickFrom(cellsOf(d), Rmech);
      if (c) journals.set(K(TXc(c[0]), TXc(c[1])), journals.size);
    }
    // a district you can name: the tuner and the map read these
    clusters.push({ heart: d.key, x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1,
      tx0: TXc(d.x0), ty0: TXc(d.y0), tx1: TXc(d.x1), ty1: TXc(d.y1) });
  }

  // statues in the last district, each wanting a stone carried from somewhere else
  const lastD = districts[districts.length - 1];
  const people = typeof PEOPLE !== 'undefined' ? Object.keys(PEOPLE) : ['father', 'spouse'];
  for (let i = 0; i < D.statues; i++) {
    const c = pickFrom(cellsOf(lastD), Rmech);
    if (!c) break;
    const who = people[i % people.length];
    shrines.push({ x: TXc(c[0]), y: TXc(c[1]) - 1, sx: TXc(c[0]), sy: TXc(c[1]), who, mark: 'cross', done: false });
    const src = pickFrom(cellsOf(districts[Math.max(0, districts.length - 2 - i)]), Rmech);
    if (src) offerings.set(K(TXc(src[0]), TXc(src[1])), who);
  }

  // ── 7. where you wake, and the way out ────────────────────────────────────
  const firstCells = cellsOf(districts[0]);
  const s = firstCells[0] || [districts[0].x0, districts[0].y0];
  start = { x: TXc(s[0]) + 0.5, y: TXc(s[1]) + 0.5 };

  const lastCells = cellsOf(lastD);
  // the exit as far from the last gate as the district allows
  const gateTile = gatesOf.length ? gatesOf[gatesOf.length - 1].pairs[0] : null;
  let best = lastCells[0], bestD = -1;
  for (const [cx, cy] of lastCells) {
    const d2 = gateTile ? (cx - gateTile[2]) ** 2 + (cy - gateTile[3]) ** 2 : 0;
    if (d2 > bestD) { bestD = d2; best = [cx, cy]; }
  }
  exit = { x: TXc(best[0]), y: TXc(best[1]) };

  // the gauntlet: the last squeezes before the way out
  const near = lastCells
    .map(([cx, cy]) => [cx, cy, (cx - best[0]) ** 2 + (cy - best[1]) ** 2])
    .sort((a, b2) => a[2] - b2[2]).slice(1, 1 + D.gauntletTiles);
  for (const [cx, cy] of near) exitTree.add(K(TXc(cx), TXc(cy)));
  exitTreeMouth = near.length ? K(TXc(near[near.length - 1][0]), TXc(near[near.length - 1][1])) : null;

  // ── 8. the route: start to exit, through every district in order ──────────
  solutionPath = routeThrough(Math.floor(start.x), Math.floor(start.y), exit.x, exit.y);
  syncSolution();
  return true;

  // shortest walk over open floor, doors ignored — the districts are a chain, so
  // the walk necessarily passes through every one of them in order
  function routeThrough(sx, sy, ex, ey) {
    const prev = new Map([[K(sx, sy), null]]);
    const q = [[sx, sy]];
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h];
      if (x === ex && y === ey) break;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (!tiles[ny] || !tiles[ny][nx] || prev.has(K(nx, ny))) continue;
        prev.set(K(nx, ny), K(x, y)); q.push([nx, ny]);
      }
    }
    if (!prev.has(K(ex, ey))) return [];
    const out = [];
    for (let k = K(ex, ey); k; k = prev.get(k)) { const [x, y] = k.split(',').map(Number); out.push([x, y]); }
    return out.reverse();
  }
}
