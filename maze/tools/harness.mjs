#!/usr/bin/env node
// The Maze — generation harness.
//
// Rebuilds the verification pass described in docs/HANDOFF.md §9: run generate()
// across many seeds, phases and stone counts, and assert the invariants that
// make a maze playable — the exit is reachable in the right order, everything
// placed can actually be got to, the start room is sealed, darkness stays away
// from the door, doors chain and sever.
//
// It drives the real game in a real browser and never edits maze-topdown.html.
// The game's top-level `let`/`const` live in the page's global lexical scope, so
// page.evaluate() can call generate() and read tiles/doors/pockets by name.
// Checks run here in Node, deliberately not sharing the game's own helpers, so a
// bug in isOpen() or walkable() cannot hide itself.
//
//   node maze/tools/harness.mjs                     # default sweep
//   node maze/tools/harness.mjs --seeds 60           # more seeds per case
//   node maze/tools/harness.mjs --phase 0 --seed 4242   # reproduce one case
//   node maze/tools/harness.mjs --pool               # pool levels only
//
// Needs a static server on --port (default 8765), e.g.
//   python3 -m http.server 8765     (from the repo root)

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// ── args ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : (argv[i + 1] ?? true);
};
const flag = (name) => argv.includes('--' + name);

const SEEDS = Number(arg('seeds', 12));
const ONE_PHASE = arg('phase', null);
const ONE_SEED = arg('seed', null);
const POOL_ONLY = flag('pool');
const PORT = Number(arg('port', 8765));
const VERBOSE = flag('verbose');
const TURNS = arg('turns', null);   // 'fewer' | 'least' — the Turns debug preset
const URL = `http://127.0.0.1:${PORT}/maze/maze-topdown.html`;

import { K, flood, openTiles, CHECKS } from './checks.mjs';

// ── run ──────────────────────────────────────────────────────────
const snapshotInPage = (phaseIdx, stones, pool, seed, turns) => {
  // Runs inside the page. Sets up SAVE the way a fresh run would, generates,
  // then hands back a plain-JSON picture of the maze.
  SAVE.phase = phaseIdx;
  SAVE.stones = stones;
  SAVE.poolPending = pool;
  SAVE.collected = {};
  SAVE.ui = turns ? { turns } : {};
  generate(seed);
  return {
    seed, phaseIdx, stones,
    who: phase().who,
    W, H,
    tiles: tiles.map((row) => Array.from(row, (v) => (v ? '1' : '0')).join('')),
    start: { x: Math.floor(start.x), y: Math.floor(start.y) },
    exit: { x: Math.floor(exit.x), y: Math.floor(exit.y) },
    exitAlley: exitAlley.map(([x, y]) => [x, y]),
    solutionPath: solutionPath.map((p) => [p[0], p[1]]),
    startRoom, startGap,
    journals: [...journals.entries()],
    pickups: [...pickups.entries()].map(([k, v]) => [k, typeof v === 'object' ? v.type ?? 'obj' : String(v)]),
    chalkSpots: [...chalkSpots], charcoalSpots: [...charcoalSpots], scrapSpots: [...scrapSpots],
    keySpot, lampSpot, gated,
    doors: doors.map((d) => ({ x: d.x, y: d.y, shape: d.shape, onRoute: !!d.onRoute })),
    innerKeys: [...innerKeys.entries()],
    pockets: pockets.map(([x, y]) => [x, y]),
    sliders: sliders.map((sl) => ({ x: sl.x, y: sl.y, dx: sl.dx, dy: sl.dy, atStart: !!sl.atStart, onPath: !!sl.onPath })),
    crawlGaps: [...crawlGaps], crawlCells: [...crawlCells],
    // figures hold tile centres (x.5, y.5), like `start` does
    figures: figures.map((f) => ({ x: Math.floor(f.x), y: Math.floor(f.y) })),
    darkTiles: [...darkTiles],
    poolMode, poolDoor,
    flags: { ...phase().f, sliderAtStart: CONFIG.sliderAtStart },
    config: { darkBufferTiles: CONFIG.darkBufferTiles, pickupExitBuffer: CONFIG.pickupExitBuffer },
  };
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, hasTouch: true });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(URL + '?seed=1', { waitUntil: 'load' });
await page.waitForTimeout(900);
const version = await page.evaluate(() => VERSION);
const phaseNames = await page.evaluate(() => PHASES.map((p) => p.who));

// which cases to run
const phases = ONE_PHASE !== null ? [Number(ONE_PHASE)] : phaseNames.map((_, i) => i);
const stoneSets = ONE_PHASE !== null || ONE_SEED !== null ? [0] : [0, 4, 7];
const seedList = ONE_SEED !== null
  ? [Number(ONE_SEED)]
  : Array.from({ length: SEEDS }, (_, i) => 1000 + i * 7919);

const results = new Map(CHECKS.map(([name]) => [name, { pass: 0, fail: [], skip: 0 }]));
let cases = 0, withDoors = 0, doorTotal = 0;

console.log(`The Maze — generation harness`);
console.log(`  game v${version} at ${URL}`);
console.log(`  ${phases.length} phase(s) × ${stoneSets.length} stone set(s) × ${seedList.length} seed(s)`
  + (POOL_ONLY ? ', pool levels only' : '') + (TURNS ? `, Turns = ${TURNS}` : ''));
console.log('');

for (const phaseIdx of phases) {
  for (const stones of stoneSets) {
    for (const seed of seedList) {
      for (const pool of POOL_ONLY ? [true] : [false, true]) {
        let snap;
        try {
          snap = await page.evaluate(
            ([p, st, po, sd, tu, src]) => new Function('return ' + src)()(p, st, po, sd, tu),
            [phaseIdx, stones, pool, seed, TURNS, snapshotInPage.toString()],
          );
        } catch (e) {
          console.log(`  GENERATE THREW  phase ${phaseIdx} stones ${stones} pool ${pool} seed ${seed}`);
          console.log(`    ${String(e).split('\n')[0]}`);
          continue;
        }
        cases++;
        if (snap.doors.length) { withDoors++; doorTotal += snap.doors.length; }
        for (const [name, fn] of CHECKS) {
          const r = results.get(name);
          let verdict;
          try { verdict = fn(snap); } catch (e) { verdict = 'CHECK THREW: ' + e.message; }
          if (verdict === null) r.pass++;
          else r.fail.push({ seed, phaseIdx, stones, pool, who: snap.who, why: verdict });
        }
      }
    }
  }
  if (!VERBOSE) process.stdout.write(`  swept ${phaseNames[phaseIdx]}\n`);
}

// ── report ───────────────────────────────────────────────────────
console.log('');
console.log(`${cases} mazes generated, ${CHECKS.length} checks each`);
console.log(`${withDoors} of them carry locked doors (${doorTotal} doors in all)\n`);
let failed = 0;
for (const [name, r] of results) {
  const n = r.fail.length;
  if (n === 0) { console.log(`  ok    ${name}  (${r.pass})`); continue; }
  failed += n;
  console.log(`  FAIL  ${name}  (${r.pass} ok, ${n} bad)`);
  const show = r.fail.slice(0, 4);
  for (const f of show) {
    console.log(`          phase ${f.phaseIdx} ${f.who} · stones ${f.stones}`
      + `${f.pool ? ' · POOL' : ''} · seed ${f.seed}`);
    console.log(`          ${f.why}`);
    console.log(`          repro: node maze/tools/harness.mjs --phase ${f.phaseIdx} --seed ${f.seed}`);
  }
  if (n > show.length) console.log(`          … and ${n - show.length} more`);
}

if (pageErrors.length) {
  console.log(`\n  page errors during the sweep (${pageErrors.length}):`);
  for (const e of [...new Set(pageErrors)].slice(0, 5)) console.log(`    ${e.split('\n')[0]}`);
}

console.log('');
console.log(failed === 0
  ? `PASS — ${cases} mazes, no invariant broken`
  : `FAIL — ${failed} invariant violation(s) across ${cases} mazes`);

await browser.close();
process.exit(failed === 0 && pageErrors.length === 0 ? 0 : 1);
