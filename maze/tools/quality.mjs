#!/usr/bin/env node
// The Maze — is it worth walking?
//
// `harness.mjs` proves a maze is *playable*: the exit is reachable, every door
// severs the route, each key is winnable before its door, nothing is stranded.
// Twenty-odd invariants and not one of them asks whether the maze is any good.
//
// That gap is why the same five complaints keep coming back from Joe. Each one
// is a number nobody was keeping:
//
//   "I still find keys not in vaults"      → vaulted, and all-vaulted
//   "the exit is easy to stumble into"     → gauntlet, gated, depth, beyond
//   "I finish in a couple of minutes"      → bots.mjs, which already measures it
//   "I'm not seeing districts"             → shape.mjs thresholds, and districts
//   "rooms are pushed into the same space" → landmarks, and the gap between them
//
// So this is the quality half of the sweep. It reports; it never fails. A
// target is a design decision and belongs to Joe, not to a tool — the point
// here is that the numbers exist at all, and that a change which quietly
// undoes one of them has somewhere to show up.
//
//   node maze/tools/quality.mjs                  # every self, at its own size
//   node maze/tools/quality.mjs --seeds 120      # a firmer read
//   node maze/tools/quality.mjs --phase 2        # one self
//   node maze/tools/quality.mjs --size lg        # override the phase's own size
//   node maze/tools/quality.mjs --json           # the rows, unformatted
//
// Needs a static server on --port (default 8765), from the repo root:
//   python3 -m http.server 8765
//
// Read-only, and it shares nothing with the other suites, so it can run
// alongside them. See tools/README.md and docs/QUALITY.md for the baseline.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : (argv[i + 1] ?? true); };
const flag = (n) => argv.includes('--' + n);
const SEEDS = Number(arg('seeds', 30));
const PORT = Number(arg('port', 8765));
const ONE_PHASE = arg('phase', null);
const ONE_SIZE = arg('size', null);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
await page.goto(`http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=1`, { waitUntil: 'load' });
await page.waitForTimeout(900);

const rows = await page.evaluate(([SEEDS, ONE_PHASE, ONE_SIZE]) => {
  const K = (x, y) => x + ',' + y;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const phases = ONE_PHASE == null ? PHASES.map((_, i) => i) : [Number(ONE_PHASE)];
  const out = [];

  for (const ph of phases) {
    // the phase's own size unless one was named, so this table cannot drift
    // away from PHASES when Joe moves a self up a size
    const size = ONE_SIZE || PHASES[ph].size;
    const recs = [];

    for (let i = 0; i < SEEDS; i++) {
      // every SAVE field generate() reads, set explicitly: a maze measured
      // against a save another script left behind is a maze nobody played
      SAVE.phase = ph; SAVE.stones = ph; SAVE.poolPending = false;
      SAVE.collected = []; SAVE.pushLearned = true;
      SAVE.ui = { size };
      delete SAVE.run;
      generate(4242 + i * 137);

      // Open floor the way checks.mjs counts it for reachability: a slider's
      // home tile and the tile it shoves into are both passable, because the
      // player can shift it and shift it back. Without this the flood never
      // leaves the sealed start room, which is 25 tiles and looks like a maze
      // with no exit in it.
      const openSet = new Set();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x]) openSet.add(K(x, y));
      for (const sl of sliders) { openSet.add(K(sl.x, sl.y)); openSet.add(K(sl.x + sl.dx, sl.y + sl.dy)); }
      if (startGap) openSet.add(K(startGap[0], startGap[1]));

      // walking distance over that floor. Doors are ignored on purpose: this
      // measures the shape of the place, and bots.mjs prices the locks.
      const dist = (sx, sy) => {
        const d = new Map([[K(sx, sy), 0]]);
        const q = [[sx, sy]];
        for (let h = 0; h < q.length; h++) {
          const [x, y] = q[h], dv = d.get(K(x, y));
          for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (!openSet.has(K(nx, ny)) || d.has(K(nx, ny))) continue;
            d.set(K(nx, ny), dv + 1); q.push([nx, ny]);
          }
        }
        return d;
      };

      const dS = dist(Math.floor(start.x), Math.floor(start.y));
      const floorN = dS.size;
      const toExit = dS.get(K(Math.floor(exit.x), Math.floor(exit.y))) ?? -1;
      const far = Math.max(...dS.values());
      // how much of the maze lies further from the start than the exit does. A
      // maze you can only finish by passing everything reads 0%; one where the
      // exit is the first far thing you meet reads high.
      const beyond = floorN ? [...dS.values()].filter((v) => v > toExit).length / floorN : 0;

      const vaultAt = new Set(keyVaults.map((v) => K(v.cx, v.cy)));
      const keys = [...innerKeys.keys()];

      // how far a landmark is from the nearest other landmark, walking
      const gaps = [];
      for (let a = 0; a < landmarks.length; a++) {
        const dA = dist(landmarks[a].x, landmarks[a].y);
        let near = Infinity;
        for (let b = 0; b < landmarks.length; b++) {
          if (a === b) continue;
          const v = dA.get(K(landmarks[b].x, landmarks[b].y));
          if (v != null && v < near) near = v;
        }
        if (isFinite(near)) gaps.push(near);
      }
      gaps.sort((p, q2) => p - q2);

      recs.push({
        floorN, toExit, far, beyond,
        keys: keys.length,
        vaulted: keys.filter((k) => vaultAt.has(k)).length,
        allVaulted: keys.length > 0 && keys.every((k) => vaultAt.has(k)) ? 1 : 0,
        doors: doors.length,
        onRoute: doors.filter((d) => solutionPath.some(([x, y]) => x === d.x && y === d.y)).length,
        gated: gated ? 1 : 0,
        gauntlet: exitTree.size,
        landmarks: landmarks.length,
        districts: clusters.length,
        gapMin: gaps.length ? gaps[0] : 0,
        gapMed: gaps.length ? gaps[gaps.length >> 1] : 0,
      });
    }

    const avg = (f) => recs.reduce((a, r) => a + f(r), 0) / recs.length;
    const sum = (f) => recs.reduce((a, r) => a + f(r), 0);
    const keysTot = sum((r) => r.keys);
    // mazes that have keys at all — a phase with no doors is not failing to vault them
    const withKeys = recs.filter((r) => r.keys > 0).length;
    out.push({
      phase: ph, who: PHASES[ph].who, size,
      floor: Math.round(avg((r) => r.floorN)),
      doors: +avg((r) => r.doors).toFixed(1),
      onRoute: +avg((r) => r.onRoute).toFixed(1),
      vaultPct: keysTot ? Math.round(100 * sum((r) => r.vaulted) / keysTot) : null,
      allVaultPct: withKeys ? Math.round(100 * sum((r) => r.allVaulted) / withKeys) : null,
      toExit: Math.round(avg((r) => r.toExit)),
      depth: +(avg((r) => r.toExit) / avg((r) => r.far)).toFixed(2),
      beyondPct: Math.round(100 * avg((r) => r.beyond)),
      gatedPct: Math.round(100 * avg((r) => r.gated)),
      gauntlet: Math.round(avg((r) => r.gauntlet)),
      landmarks: +avg((r) => r.landmarks).toFixed(1),
      districts: +avg((r) => r.districts).toFixed(1),
      gapMin: Math.round(avg((r) => r.gapMin)),
      gapMed: Math.round(avg((r) => r.gapMed)),
    });
  }
  return out;
}, [SEEDS, ONE_PHASE, ONE_SIZE]);

if (flag('json')) {
  console.log(JSON.stringify({ seeds: SEEDS, rows, errs }, null, 1));
} else {
  const pct = (v) => (v == null ? '—' : v + '%');
  console.log('\nThe Maze — is it worth walking?');
  console.log(`  ${SEEDS} seeds a self · each at its own size unless --size said otherwise\n`);
  console.log('  self                 size  floor   keys vaulted  every key  doors  on route  exit at  beyond  locked  gauntlet  rooms  districts  gap (min/med)');
  console.log('  ' + '─'.repeat(134));
  for (const r of rows) {
    console.log(
      '  ' + `${r.phase} ${r.who}`.padEnd(21)
      + `${r.size.padEnd(6)}`
      + `${String(r.floor).padEnd(8)}`
      + `${pct(r.vaultPct).padEnd(14)}`
      + `${pct(r.allVaultPct).padEnd(11)}`
      + `${String(r.doors).padEnd(7)}`
      + `${String(r.onRoute).padEnd(10)}`
      + `${(r.depth.toFixed(2)).padEnd(9)}`
      + `${(r.beyondPct + '%').padEnd(8)}`
      + `${(r.gatedPct + '%').padEnd(8)}`
      + `${String(r.gauntlet).padEnd(10)}`
      + `${String(r.landmarks).padEnd(7)}`
      + `${String(r.districts).padEnd(11)}`
      + `${r.gapMin} / ${r.gapMed}`);
  }
  console.log(`
  keys vaulted  share of all keys lying in a nest rather than a hall.
  every key     share of mazes where *no* key is loose. This is the one to read:
                the average hides a maze that vaulted one key of two.
  on route      doors that actually stand on the solution path.
  exit at       walking distance to the exit as a share of the maze's far point.
  beyond        how much of the floor lies further out than the exit does.
  gauntlet      tiles of the squeeze tree guarding the way out. 0 = nothing guards it.
  gap           walking distance from a room to its nearest neighbour, min and median.

  Time to finish is bots.mjs; thresholds and districts you can feel are shape.mjs.`);
}

if (errs.length) console.log('\n  page errors: ' + errs.slice(0, 4).join(' · '));
await browser.close();
