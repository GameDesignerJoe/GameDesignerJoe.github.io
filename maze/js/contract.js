// The Maze — what a maze must hold
//
// `docs/QUALITY.md` measured the five things Joe keeps asking for and keeps not
// getting: keys buried rather than lying in a hall, an exit that is guarded, a
// key worth walking for, rooms that are not on top of each other, and a maze
// that divides into places. Every one of them was a design requirement that had
// entered the code as a preference inside a scoring function, then lost to
// geometry with nobody told.
//
// A contract is those requirements written down per chapter, in `data/phases.js`
// under `must`, in the same row as the features. This file is the half that
// checks them: `measure()` reads the maze that `generate()` just built, and
// `grade()` says which clauses it met.
//
// It is deliberately only measurement and judgement. It never generates and
// never repairs — `generate()` decides what to do about a maze that falls short,
// and `tuner.html` decides how to draw it.
//
// Part of the engine, loaded as a plain script; everything shares one global
// scope, exactly as the rest of the game does.

const CONTRACT = (() => {
  const K = (x, y) => x + ',' + y;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Open floor the way checks.mjs counts it for reachability: a slider's home
  // tile and the tile it shoves into are both passable, because the player can
  // shift it and shift it back. Without this the flood never leaves the sealed
  // start room, which is 25 tiles and looks like a maze with no exit in it.
  function openTiles() {
    const set = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x]) set.add(K(x, y));
    for (const sl of sliders) { set.add(K(sl.x, sl.y)); set.add(K(sl.x + sl.dx, sl.y + sl.dy)); }
    if (startGap) set.add(K(startGap[0], startGap[1]));
    return set;
  }

  // walking distance in tiles. Doors are ignored: this measures the shape of the
  // place, and bots.mjs is the tool that prices the locks in seconds.
  function dists(open, sx, sy) {
    const d = new Map([[K(sx, sy), 0]]);
    const q = [[sx, sy]];
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h], dv = d.get(K(x, y));
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!open.has(K(nx, ny)) || d.has(K(nx, ny))) continue;
        d.set(K(nx, ny), dv + 1); q.push([nx, ny]);
      }
    }
    return d;
  }

  // ── thresholds ─────────────────────────────────────────────────────────────
  // A threshold is a run of tiles whose removal splits the floor into two
  // substantial pieces — leaving one place and entering another, said as a
  // graph. A dead end is a cut tile too, but it peels off one tile, so the share
  // is what separates the two. This is the same definition tools/shape.mjs
  // measures with, ported here so the page and the generator can ask the
  // question live; keep the two in step if either changes.
  //
  // Iterative Tarjan, so it is O(tiles) and safe to run on every redraw — an xl
  // maze is 2,456 tiles and this is not what costs the frame.
  function thresholds(open, sx, sy, share) {
    const idx = new Map(), list = [];
    for (const k of open) { idx.set(k, list.length); list.push(k.split(',').map(Number)); }
    const N = list.length;
    const root = idx.get(K(sx, sy));
    if (root == null) return { count: 0, N, biggest: 0, longest: 0 };
    const adj = list.map(([x, y]) => DIRS.map(([dx, dy]) => idx.get(K(x + dx, y + dy))).filter((v) => v != null));
    const disc = new Int32Array(N).fill(-1), low = new Int32Array(N), size = new Int32Array(N).fill(1);
    const parent = new Int32Array(N).fill(-1), hung = list.map(() => []);
    let timer = 0, rootKids = 0;
    disc[root] = low[root] = timer++;
    const stack = [[root, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1], v = top[0], i = top[1];
      if (i < adj[v].length) {
        top[1]++;
        const w = adj[v][i];
        if (disc[w] === -1) {
          parent[w] = v; disc[w] = low[w] = timer++; stack.push([w, 0]);
          if (v === root) rootKids++;
        } else if (w !== parent[v]) low[v] = Math.min(low[v], disc[w]);
      } else {
        stack.pop();
        const p = parent[v];
        if (p !== -1) {
          low[p] = Math.min(low[p], low[v]);
          size[p] += size[v];
          if (low[v] >= disc[p]) hung[p].push(size[v]);   // this child hangs off p alone
        }
      }
    }
    const major = [];
    for (let v = 0; v < N; v++) {
      const h = v === root ? (rootKids > 1 ? hung[v] : []) : hung[v];
      if (!h.length) continue;
      const rest = N - 1 - h.reduce((a, b) => a + b, 0);
      const parts = [...h, rest].sort((a, b) => b - a);
      if (parts[1] >= share * N) major.push({ v, parts });
    }
    // cut tiles that touch each other are one threshold; its length is the walk
    // you take along it with nothing branching off
    const inMajor = new Set(major.map((m) => m.v)), seen = new Set(), runs = [];
    for (const m of major) {
      if (seen.has(m.v)) continue;
      const run = [m.v]; seen.add(m.v);
      for (let h = 0; h < run.length; h++) {
        for (const w of adj[run[h]]) if (inMajor.has(w) && !seen.has(w)) { seen.add(w); run.push(w); }
      }
      const best = major.filter((x) => run.includes(x.v)).sort((a, b) => b.parts[1] - a.parts[1])[0];
      runs.push({ len: run.length, second: best.parts[1] });
    }
    runs.sort((a, b) => b.second - a.second);
    const tiles_ = new Set(major.map((m) => list[m.v].join(',')));
    return {
      count: runs.length, N,
      biggest: runs.length ? runs[0].second / N : 0,
      longest: runs.length ? runs[0].len : 0,
      tiles: tiles_,
    };
  }

  // ── the measurement ────────────────────────────────────────────────────────
  // Reads the maze generate() has just built, out of the engine's globals.
  function measure(share = 0.15) {
    const open = openTiles();
    const sx = Math.floor(start.x), sy = Math.floor(start.y);
    const ex = Math.floor(exit.x), ey = Math.floor(exit.y);
    const dS = dists(open, sx, sy);
    const floor = dS.size;
    const direct = dS.get(K(ex, ey)) ?? -1;
    const far = Math.max(...dS.values());

    const vaultAt = new Set(keyVaults.map((v) => K(v.cx, v.cy)));
    const keyList = [...innerKeys.keys()];
    const vaulted = keyList.filter((k) => vaultAt.has(k)).length;

    // How far off the direct route the keys lie: the shortest walk that collects
    // every key and then leaves, less the walk straight out. Exact by brute
    // force for the two or three keys a maze actually carries; for more, the
    // keys are summed independently, which understates it — and no phase asks
    // for more than two. Doors are ignored, as everywhere here.
    let detour = 0;
    if (keyList.length && direct >= 0) {
      const pts = keyList.map((k) => k.split(',').map(Number));
      const from = [[sx, sy], ...pts].map(([x, y]) => dists(open, x, y));
      const hop = (a, b) => from[a].get(K(...(b === -1 ? [ex, ey] : pts[b]))) ?? Infinity;
      if (pts.length <= 3) {
        const perms = (xs) => xs.length <= 1 ? [xs]
          : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
        let best = Infinity;
        for (const order of perms(pts.map((_, i) => i))) {
          let t = 0, at = 0;               // 0 is the start; key i is index i+1
          for (const i of order) { t += hop(at, i); at = i + 1; }
          t += hop(at, -1);
          best = Math.min(best, t);
        }
        detour = isFinite(best) ? Math.max(0, best - direct) : 0;
      } else {
        detour = pts.reduce((a, _, i) => a + Math.max(0, hop(0, i) + (from[i + 1].get(K(ex, ey)) ?? 0) - direct), 0);
      }
    }

    // how far a room is from the nearest other room, walking
    let roomGap = 0;
    if (landmarks.length > 1) {
      let worst = Infinity;
      for (let a = 0; a < landmarks.length; a++) {
        const dA = dists(open, landmarks[a].x, landmarks[a].y);
        for (let b = a + 1; b < landmarks.length; b++) {
          const v = dA.get(K(landmarks[b].x, landmarks[b].y));
          if (v != null && v < worst) worst = v;
        }
      }
      roomGap = isFinite(worst) ? worst : 0;
    }

    const th = thresholds(open, sx, sy, share);

    return {
      floor,
      keys: keyList.length, vaulted,
      allVaulted: keyList.length > 0 && vaulted === keyList.length,
      exitGuard: exitTree.size, gated: !!gated,
      keyDetour: detour,
      toExit: direct, far, exitDepth: far ? direct / far : 0,
      rooms: landmarks.length, roomGap,
      thresholds: th.count, biggestSplit: th.biggest, longestRun: th.longest,
      thresholdTiles: th.tiles,
      districts: clusters.length,
    };
  }

  // ── the judgement ──────────────────────────────────────────────────────────
  // Each clause is a floor, not a target: `roomGap: 18` means no two rooms
  // closer than 18 tiles. `keysVaulted: 'all'` means no key left in a hall. A
  // clause a phase does not name is not checked — a chapter with no doors is
  // not failing to vault its keys.
  const CLAUSES = {
    keysVaulted: { label: 'keys buried', got: (m) => (m.keys ? m.vaulted : null),
      ok: (m, want) => !m.keys || (want === 'all' ? m.allVaulted : m.vaulted >= want),
      show: (m) => (m.keys ? `${m.vaulted}/${m.keys}` : '—') },
    exitGuard: { label: 'exit guarded', got: (m) => m.exitGuard, ok: (m, want) => m.exitGuard >= want,
      show: (m) => `${m.exitGuard} tiles` },
    keyDetour: { label: 'key is a walk', got: (m) => m.keyDetour, ok: (m, want) => !m.keys || m.keyDetour >= want,
      show: (m) => (m.keys ? `${Math.round(m.keyDetour)} tiles` : '—') },
    roomGap: { label: 'rooms apart', got: (m) => m.roomGap, ok: (m, want) => m.rooms < 2 || m.roomGap >= want,
      show: (m) => (m.rooms < 2 ? '—' : `${m.roomGap} tiles`) },
    thresholds: { label: 'maze divides', got: (m) => m.thresholds, ok: (m, want) => m.thresholds >= want,
      show: (m) => `${m.thresholds}` },
  };

  // → [{ key, label, want, show, ok }], in the order the clauses are declared
  function grade(m, must) {
    if (!must) return [];
    return Object.keys(CLAUSES).filter((k) => must[k] != null).map((k) => {
      const c = CLAUSES[k];
      return { key: k, label: c.label, want: must[k], show: c.show(m), ok: c.ok(m, must[k]) };
    });
  }

  const met = (m, must) => grade(m, must).every((g) => g.ok);

  return { measure, grade, met, CLAUSES, thresholds, openTiles, dists };
})();
