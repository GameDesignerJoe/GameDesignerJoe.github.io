// The Maze — generation invariants.
//
// The checks the harness runs, kept separate so selftest.mjs can exercise them
// and so they can be read without wading through the browser plumbing.
//
// These deliberately do not use the game's own isOpen()/walkable() helpers: a
// bug in those should not be able to hide itself from the checks.

// ── geometry helpers (ours, not the game's) ──────────────────────
const K = (x, y) => x + ',' + y;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Flood fill over open tiles. `blocked` is a Set of 'x,y' to treat as wall. */
function flood(open, W, H, sx, sy, blocked = new Set()) {
  const seen = new Set();
  if (!open.has(K(sx, sy)) || blocked.has(K(sx, sy))) return seen;
  const q = [[sx, sy]];
  seen.add(K(sx, sy));
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = K(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (seen.has(k) || blocked.has(k) || !open.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

/** Walking distance in tiles from (sx,sy) to every reachable tile. */
function dists(open, W, H, sx, sy, blocked = new Set()) {
  const d = new Map();
  if (!open.has(K(sx, sy))) return d;
  const q = [[sx, sy, 0]];
  d.set(K(sx, sy), 0);
  for (let head = 0; head < q.length; head++) {
    const [x, y, n] = q[head];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = K(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (d.has(k) || blocked.has(k) || !open.has(k)) continue;
      d.set(k, n + 1);
      q.push([nx, ny, n + 1]);
    }
  }
  return d;
}

/**
 * The set of tiles a player can stand on.
 *
 * Sliders are the subtlety: a slider's home tile is open and the cell it pushes
 * into is closed, so a pocket behind one is unreachable by a naive flood. The
 * player can always shift it and shift it back, so for "can this be got to at
 * all" both tiles count as open. Crawl gaps need no special case — generate()
 * already carves them into `tiles` when the phase allows them.
 */
function openTiles(s, { slidersShifted = true } = {}) {
  const open = new Set();
  for (let y = 0; y < s.H; y++) {
    for (let x = 0; x < s.W; x++) if (s.tiles[y][x] === '1') open.add(K(x, y));
  }
  if (slidersShifted) {
    for (const sl of s.sliders) {
      open.add(K(sl.x, sl.y));
      open.add(K(sl.x + sl.dx, sl.y + sl.dy));
    }
  }
  return open;
}

// ── the invariants ───────────────────────────────────────────────
// Each returns null when happy, or a string saying what is wrong.
const CHECKS = [
  ['grid dimensions match tiles', (s) =>
    s.tiles.length === s.H && s.tiles.every((r) => r.length === s.W)
      ? null : `W/H say ${s.W}x${s.H}, tiles are ${s.tiles[0]?.length}x${s.tiles.length}`],

  ['start and exit stand on floor', (s) => {
    const bad = [];
    if (s.tiles[s.start.y]?.[s.start.x] !== '1') bad.push(`start ${K(s.start.x, s.start.y)}`);
    if (s.tiles[s.exit.y]?.[s.exit.x] !== '1') bad.push(`exit ${K(s.exit.x, s.exit.y)}`);
    return bad.length ? bad.join(' and ') + ' not on floor' : null;
  }],

  ['exit is reachable', (s) => {
    const seen = flood(openTiles(s), s.W, s.H, s.start.x, s.start.y);
    return seen.has(K(s.exit.x, s.exit.y)) ? null
      : `no route from start ${K(s.start.x, s.start.y)} to exit ${K(s.exit.x, s.exit.y)}`;
  }],

  ['everything placed sits on floor', (s) => {
    const bad = [];
    const onFloor = (k) => { const [x, y] = k.split(',').map(Number); return s.tiles[y]?.[x] === '1'; };
    for (const [k] of s.journals) if (!onFloor(k)) bad.push(`page ${k}`);
    for (const [k] of s.pickups) if (!onFloor(k)) bad.push(`pickup ${k}`);
    for (const [k] of s.innerKeys) if (!onFloor(k)) bad.push(`innerKey ${k}`);
    for (const k of s.scrapSpots) if (!onFloor(k)) bad.push(`scrap ${k}`);
    for (const k of s.chalkSpots) if (!onFloor(k)) bad.push(`chalk ${k}`);
    for (const k of s.charcoalSpots) if (!onFloor(k)) bad.push(`charcoal ${k}`);
    if (s.keySpot && !onFloor(s.keySpot)) bad.push(`key ${s.keySpot}`);
    if (s.lampSpot && !onFloor(s.lampSpot)) bad.push(`lamp ${s.lampSpot}`);
    return bad.length ? bad.slice(0, 4).join(', ') + (bad.length > 4 ? ` (+${bad.length - 4})` : '') : null;
  }],

  ['everything placed is reachable', (s) => {
    const seen = flood(openTiles(s), s.W, s.H, s.start.x, s.start.y);
    const bad = [];
    for (const [k] of s.journals) if (!seen.has(k)) bad.push(`page ${k}`);
    for (const [k, t] of s.pickups) if (!seen.has(k)) bad.push(`${t} ${k}`);
    for (const [k, shape] of s.innerKeys) if (!seen.has(k)) bad.push(`${shape} key ${k}`);
    for (const k of s.scrapSpots) if (!seen.has(k)) bad.push(`scrap ${k}`);
    if (s.keySpot && !seen.has(s.keySpot)) bad.push(`exit key ${s.keySpot}`);
    if (s.lampSpot && !seen.has(s.lampSpot)) bad.push(`lamp ${s.lampSpot}`);
    for (const [x, y] of s.pockets) if (!seen.has(K(x, y))) bad.push(`pocket ${K(x, y)}`);
    return bad.length ? bad.slice(0, 4).join(', ') + (bad.length > 4 ? ` (+${bad.length - 4})` : '') : null;
  }],

  ['a gauntlet swing opens no new ground', (s) => {
    // A swing on the gauntlet's trunk is meant to take the floor out from under the way on and
    // give it back, not to lead anywhere. So it must sit on the route it interrupts, and the
    // alcove it steps into must be dead wall two tiles deep — one tile deep and sliding into it
    // would join the trunk to whatever is on the other side, which is a way round the tree.
    const bad = [];
    for (const sl of s.sliders.filter((x) => x.gauntlet)) {
      const at = (x, y) => (y >= 0 && y < s.H && x >= 0 && x < s.W ? s.tiles[y][x] === '1' : false);
      const onRoute = s.solutionPath.some(([x, y]) => x === sl.x && y === sl.y);
      if (!onRoute) bad.push(`${K(sl.x, sl.y)} is not on the route`);
      else if (at(sl.x + sl.dx, sl.y + sl.dy)) bad.push(`${K(sl.x, sl.y)} steps into open floor`);
      else if (at(sl.x + sl.dx * 2, sl.y + sl.dy * 2)) bad.push(`${K(sl.x, sl.y)} would open onto ${K(sl.x + sl.dx * 2, sl.y + sl.dy * 2)}`);
    }
    return bad.length ? bad.slice(0, 4).join(', ') : null;
  }],

  ['a swing-only phase carries no pushable blocks', (s) => {
    // The Child has swings — blocks that move on their own — but has not been taught to push
    // anything yet. A phase with swings and no pockets must have every slider on a clock.
    if (!s.flags.swing || s.flags.pockets) return null;
    const pushable = s.sliders.filter((sl) => !sl.auto && !sl.atStart);
    return pushable.length
      ? `${pushable.length} pushable block(s) on a swing-only phase, e.g. ${K(pushable[0].x, pushable[0].y)}`
      : null;
  }],

  ['at most one compass arrow', (s) => {
    const n = s.pickups.filter(([, t]) => t === 'pointer').length;
    return n > s.config.pointerMax ? `${n} pointers in one maze, cap is ${s.config.pointerMax}` : null;
  }],

  ['the secret place is behind a squeeze, and behind nothing else', (s) => {
    // If a maze has one, it must be walkable — a hiding place you cannot get into is a bug, not
    // a secret — and it must stop being walkable the moment crawling is off the table, or it is
    // not hidden at all. Both halves matter; the first is the one that would ruin a run.
    if (!s.secretTiles || !s.secretTiles.length) return null;
    const reach = flood(openTiles(s), s.W, s.H, s.start.x, s.start.y);
    const lost = s.secretTiles.filter((k) => !reach.has(k));
    if (lost.length) return `${lost.length} secret tile(s) unreachable, e.g. ${lost[0]}`;
    // Hiddenness is asked of the grid as it stands, not with every slider union-opened: the way
    // in must be the squeeze, but a pocket you would have to be standing in already is not a way.
    const noCrawl = flood(openTiles(s, { slidersShifted: false }), s.W, s.H, s.start.x, s.start.y, new Set(s.crawlGaps));
    return s.secretTiles.some((k) => !noCrawl.has(k)) ? null : 'the secret place can be walked into without squeezing';
  }],

  ['the squeeze tree is the only way to the exit', (s) => {
    // The point of it is that you cannot walk round it. Shut the one mouth and the exit must be
    // gone. Sliders stay as generated here: a pocket you would have to be standing in already is
    // not a way round anything.
    if (!s.exitTree || !s.exitTree.length || !s.exitTreeMouth) return null;
    const open = openTiles(s, { slidersShifted: false });
    if (!open.has(s.exitTreeMouth)) return `the mouth ${s.exitTreeMouth} is not open floor`;
    const shut = flood(open, s.W, s.H, s.start.x, s.start.y, new Set([s.exitTreeMouth]));
    return shut.has(K(s.exit.x, s.exit.y)) ? 'the exit can be reached without going through the tree' : null;
  }],

  ['no corridor is cut off', (s) => {
    // Every floor tile must be walkable from the mat. Dead space is closed tiles, and a
    // pocket counts because its slider can be pushed and pulled back, so anything left
    // over is a piece of maze nobody can ever stand in. This is the invariant a district
    // would break if it cut a link it did not own.
    const open = openTiles(s);
    const seen = flood(open, s.W, s.H, s.start.x, s.start.y);
    const lost = [...open].filter((k) => !seen.has(k));
    return lost.length ? `${lost.length} floor tile(s) unreachable, e.g. ${lost.slice(0, 4).join(' ')}` : null;
  }],

  ['each door severs the route', (s) => {
    // With one door shut, the exit must be unreachable — otherwise the door
    // guards nothing and can be walked around.
    //
    // Sliders need care here. openTiles() opens a slider's home *and* its target
    // so that "can this be reached at all" is honest, but no single game state
    // has both open, and union-opening every slider at once invents corridors
    // that do not exist. So severing is tested against the grid as generated,
    // then again with each slider shifted on its own — which catches a real
    // "push one cell and walk around the door" bypass without phantom routes.
    const asGenerated = openTiles(s, { slidersShifted: false });
    const variants = [['as generated', asGenerated]];
    s.sliders.forEach((sl, i) => {
      const v = new Set(asGenerated);
      v.delete(K(sl.x, sl.y));            // the cell slides out of its home…
      v.add(K(sl.x + sl.dx, sl.y + sl.dy)); // …and into the space beyond
      variants.push([`slider ${i} at ${K(sl.x, sl.y)} shifted`, v]);
    });
    const bad = [];
    for (let i = 0; i < s.doors.length; i++) {
      const d = s.doors[i];
      for (const [label, open] of variants) {
        const seen = flood(open, s.W, s.H, s.start.x, s.start.y, new Set([K(d.x, d.y)]));
        if (seen.has(K(s.exit.x, s.exit.y))) {
          bad.push(`door ${i} at ${K(d.x, d.y)} is bypassable (${label})`);
          break;
        }
      }
    }
    return bad.length ? bad.join('; ') : null;
  }],

  ['doors chain: each key is winnable before its door', (s) => {
    // Door i's key must be reachable while doors i..n are still shut.
    const open = openTiles(s);
    const keyOf = new Map();
    for (const [k, shape] of s.innerKeys) keyOf.set(shape, k);
    const bad = [];
    for (let i = 0; i < s.doors.length; i++) {
      const shape = s.doors[i].shape;
      const keyK = keyOf.get(shape);
      if (!keyK) { bad.push(`door ${i} (${shape}) has no key placed`); continue; }
      const blocked = new Set(s.doors.slice(i).map((d) => K(d.x, d.y)));
      const seen = flood(open, s.W, s.H, s.start.x, s.start.y, blocked);
      if (!seen.has(keyK)) bad.push(`${shape} key at ${keyK} is behind door ${i} it opens`);
    }
    return bad.length ? bad.join('; ') : null;
  }],

  ['maze is finishable', (s) => {
    // The invariant that matters most: collect every key you can actually get
    // hold of, opening doors as their keys come in, and see whether the exit is
    // then reachable. A key sealed behind the very door it opens makes the maze
    // unwinnable, and no per-door check catches that on its own.
    const open = openTiles(s);
    const held = new Set();
    for (;;) {
      const blocked = new Set(s.doors.filter((d) => !held.has(d.shape)).map((d) => K(d.x, d.y)));
      const reach = flood(open, s.W, s.H, s.start.x, s.start.y, blocked);
      let gained = false;
      for (const [k, shape] of s.innerKeys) {
        if (!held.has(shape) && reach.has(k)) { held.add(shape); gained = true; }
      }
      if (!gained) {
        if (reach.has(K(s.exit.x, s.exit.y))) {
          // Also need the gate key, when the exit is locked.
          if (s.gated && s.keySpot && !reach.has(s.keySpot)) return `exit gate key at ${s.keySpot} is unreachable`;
          return null;
        }
        const stuck = s.doors.filter((d) => !held.has(d.shape));
        return `exit unreachable; stuck at ${stuck.map((d, i) => `${d.shape}@${K(d.x, d.y)}`).join(', ')}`
          + ` — keys held: ${[...held].join(', ') || 'none'}`
          + `; keys placed: ${s.innerKeys.map(([k, sh]) => `${sh}@${k}`).join(', ') || 'none'}`;
      }
    }
  }],

  ['start room is sealed when it should be', (s) => {
    if (!s.startRoom || !s.flags.sliderAtStart) return null;
    if (s.poolMode) return null;
    const { x0, y0, x1, y1 } = s.startRoom;
    const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    // Count openings on the room's boundary: floor tiles just outside it that
    // touch the inside. A sealed room has none you can walk out of.
    const leaks = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (inside(nx, ny)) continue;
          if (s.tiles[ny]?.[nx] === '1') leaks.push(K(nx, ny));
        }
      }
    }
    const gap = s.startGap ? K(s.startGap[0], s.startGap[1]) : null;
    const unexplained = leaks.filter((k) => k !== gap);
    return unexplained.length
      ? `room leaks at ${[...new Set(unexplained)].slice(0, 3).join(', ')} (startGap ${gap})`
      : null;
  }],

  ['darkness keeps clear of the start-room door', (s) => {
    if (!s.darkTiles.length) return null;
    const from = s.startGap ? { x: s.startGap[0], y: s.startGap[1] } : s.start;
    const d = dists(openTiles(s), s.W, s.H, from.x, from.y);
    const buffer = s.config.darkBufferTiles;
    const near = s.darkTiles
      .map((k) => [k, d.get(k)])
      .filter(([, n]) => n !== undefined && n < buffer);
    return near.length
      ? `${near.length} dark tile(s) within ${buffer} steps of the door, closest ${near.sort((a, b) => a[1] - b[1])[0][1]}`
      : null;
  }],

  ['lamp can be got to without crossing darkness', (s) => {
    if (!s.darkTiles.length || !s.lampSpot) return null;
    const seen = flood(openTiles(s), s.W, s.H, s.start.x, s.start.y, new Set(s.darkTiles));
    return seen.has(s.lampSpot) ? null : `lamp at ${s.lampSpot} only reachable through the dark`;
  }],

  ['solution path is contiguous and joins start to exit', (s) => {
    const p = s.solutionPath;
    if (!p.length) return 'solutionPath is empty';
    for (let i = 1; i < p.length; i++) {
      const step = Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]);
      if (step !== 1) return `jump of ${step} at index ${i}: ${p[i - 1]} → ${p[i]}`;
    }
    const open = openTiles(s);
    const offFloor = p.filter(([x, y]) => !open.has(K(x, y)));
    if (offFloor.length) return `${offFloor.length} path tile(s) not on floor, e.g. ${offFloor[0]}`;
    return null;
  }],

  ['pool level has its stone and its door', (s) => {
    if (!s.poolMode) return null;
    // Note `gated` is deliberately false in a pool level: generate() sets
    // `gated = !poolMode && …`, and the way through is poolDoor, not the exit
    // gate. HANDOFF §6 records why — "gate bars at the pool … replaced with a
    // thin door at the room; bars looked out of place early." The stone is the
    // key, and it is placed inside the start room.
    const bad = [];
    if (!s.poolDoor) bad.push('no poolDoor');
    else if (s.startGap && (s.poolDoor.x !== s.startGap[0] || s.poolDoor.y !== s.startGap[1]))
      bad.push(`poolDoor ${K(s.poolDoor.x, s.poolDoor.y)} is not in the doorway ${K(s.startGap[0], s.startGap[1])}`);
    if (!s.keySpot) bad.push('no stone (keySpot) placed');
    else if (s.startRoom) {
      const [kx, ky] = s.keySpot.split(',').map(Number);
      const { x0, y0, x1, y1 } = s.startRoom;
      if (kx < x0 || kx > x1 || ky < y0 || ky > y1) bad.push(`stone ${s.keySpot} is outside the start room`);
    }
    if (s.darkTiles.length) bad.push(`${s.darkTiles.length} dark tiles in a pool level`);
    if (s.journals.length) bad.push(`${s.journals.length} pages in a pool level`);
    if (s.doors.length) bad.push(`${s.doors.length} locked door(s) in a pool level`);
    return bad.length ? bad.join('; ') : null;
  }],

  ['father stands where he can be seen but not caught', (s) => {
    // HANDOFF §4: vantage spots — close as the crow flies, far on foot.
    if (!s.figures.length) return null;
    const open = openTiles(s);
    const bad = [];
    for (const f of s.figures) {
      if (!open.has(K(f.x, f.y))) { bad.push(`figure ${K(f.x, f.y)} not on floor`); continue; }
      const seen = flood(open, s.W, s.H, s.start.x, s.start.y);
      if (!seen.has(K(f.x, f.y))) bad.push(`figure ${K(f.x, f.y)} unreachable`);
    }
    return bad.length ? bad.slice(0, 3).join('; ') : null;
  }],

  ['no pickup sits on the exit or in the alley', (s) => {
    const forbidden = new Set([K(s.exit.x, s.exit.y), ...s.exitAlley.map(([x, y]) => K(x, y))]);
    const bad = [];
    for (const [k, t] of s.pickups) if (forbidden.has(k)) bad.push(`${t} ${k}`);
    for (const [k] of s.journals) if (forbidden.has(k)) bad.push(`page ${k}`);
    return bad.length ? bad.join(', ') : null;
  }],
];

export { K, DIRS, flood, dists, openTiles, CHECKS };
