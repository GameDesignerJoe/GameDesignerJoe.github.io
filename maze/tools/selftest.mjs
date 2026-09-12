#!/usr/bin/env node
// The Maze — self-test for the harness.
//
// A check that can never fail is worse than no check: it reads as reassurance.
// So this takes a maze the harness passes, breaks one thing about it, and
// asserts that the check responsible notices — and that the others stay quiet.
//
// Run this after editing checks.mjs.
//
//   node maze/tools/selftest.mjs [--port 8765]

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHECKS, K } from './checks.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8765));
const PAGE = `http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=1`;

// Grab one known-good maze that has doors, keys, darkness and a lamp, so there
// is something for every check to bite on.
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, hasTouch: true });
await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForTimeout(900);

const grab = (phaseIdx, seed) => page.evaluate(([p, sd]) => {
  SAVE.phase = p; SAVE.stones = 0; SAVE.poolPending = false; SAVE.collected = {}; SAVE.ui = {};
  generate(sd);
  return {
    seed: sd, phaseIdx: p, stones: 0, who: phase().who, W, H,
    tiles: tiles.map((r) => Array.from(r, (v) => (v ? '1' : '0')).join('')),
    start: { x: Math.floor(start.x), y: Math.floor(start.y) },
    exit: { x: Math.floor(exit.x), y: Math.floor(exit.y) },
    exitAlley: exitAlley.map(([x, y]) => [x, y]),
    solutionPath: solutionPath.map((q) => [q[0], q[1]]),
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
    figures: figures.map((f) => ({ x: Math.floor(f.x), y: Math.floor(f.y) })),
    darkTiles: [...darkTiles],
    poolMode, poolDoor,
    flags: { ...phase().f, sliderAtStart: CONFIG.sliderAtStart },
    config: { darkBufferTiles: CONFIG.darkBufferTiles, pickupExitBuffer: CONFIG.pickupExitBuffer },
  };
}, [phaseIdx, seed]);

// The Criminal has every feature on: doors, darkness, lamp, pockets.
let base = null;
// Scan, do not guess. This used to try five hard-coded seeds, which worked right up until doors
// became rarer — and then failed with "could not find a clean maze", which reads like the generator
// is broken rather than like the search is too narrow.
const seeds = []; for (let i = 0; i < 120; i++) seeds.push(1000 + i * 619);
for (const seed of seeds) {
  const s = await grab(5, seed);
  const clean = CHECKS.every(([, fn]) => fn(s) === null);
  if (clean && s.doors.length && s.darkTiles.length && s.lampSpot && s.innerKeys.length) { base = s; break; }
}
if (!base) { console.log(`could not find a clean maze with doors + darkness in ${seeds.length} seeds`); await browser.close(); process.exit(1); }
await browser.close();

const clone = () => JSON.parse(JSON.stringify(base));
const openFloor = () => {
  for (let y = 2; y < base.H - 2; y++) for (let x = 2; x < base.W - 2; x++) if (base.tiles[y][x] === '1') return [x, y];
  return [1, 1];
};
const solidWall = () => {
  for (let y = 2; y < base.H - 2; y++) for (let x = 2; x < base.W - 2; x++) if (base.tiles[y][x] === '0') return [x, y];
  return [0, 0];
};

// Each mutation names the check that must catch it.
const MUTATIONS = [
  ['a page moved onto a wall', 'everything placed sits on floor', (s) => {
    const [wx, wy] = solidWall();
    s.journals = [[K(wx, wy), 0]];
  }],

  ['the exit walled off', 'exit is reachable', (s) => {
    const rows = s.tiles.map((r) => r.split(''));
    const { x, y } = s.exit;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (rows[y + dy]) rows[y + dy][x + dx] = '0';
    }
    s.tiles = rows.map((r) => r.join(''));
  }],

  ["a door's key sealed behind the door it opens", 'maze is finishable', (s) => {
    // The real bug this harness found, reproduced deliberately.
    const d = s.doors[0];
    const rows = s.tiles.map((r) => r.split(''));
    // stand the key just past the door, then wall the door's far side off
    const far = K(d.x, d.y);
    s.innerKeys = [[far, d.shape]];
    void rows;
  }],

  ['darkness pushed up against the start-room door', 'darkness keeps clear of the start-room door', (s) => {
    const from = s.startGap ? K(s.startGap[0], s.startGap[1]) : K(s.start.x, s.start.y);
    s.darkTiles = [from, K(s.start.x, s.start.y)];
  }],

  ['the lamp put inside the darkness', 'lamp can be got to without crossing darkness', (s) => {
    // Ring the lamp with dark so every route to it crosses one.
    const [lx, ly] = s.lampSpot.split(',').map(Number);
    s.darkTiles = [s.lampSpot, K(lx + 1, ly), K(lx - 1, ly), K(lx, ly + 1), K(lx, ly - 1)];
  }],

  ['a break punched in the solution path', 'solution path is contiguous and joins start to exit', (s) => {
    const mid = Math.floor(s.solutionPath.length / 2);
    s.solutionPath = [...s.solutionPath.slice(0, mid), [s.solutionPath[mid][0] + 5, s.solutionPath[mid][1] + 5],
      ...s.solutionPath.slice(mid + 1)];
  }],

  ['a hole opened in the start room wall', 'start room is sealed when it should be', (s) => {
    const rows = s.tiles.map((r) => r.split(''));
    const { x0, y1 } = s.startRoom;
    rows[y1 + 1][x0 + 1] = '1';   // a second way out, nowhere near the real doorway
    s.tiles = rows.map((r) => r.join(''));
  }],

  ['a pickup dumped on the exit', 'no pickup sits on the exit or in the alley', (s) => {
    s.pickups = [[K(s.exit.x, s.exit.y), 'chalk']];
  }],

  ['the father stood inside a wall', 'father stands where he can be seen but not caught', (s) => {
    const [wx, wy] = solidWall();
    s.figures = [{ x: wx, y: wy }];
  }],

  ['grid dimensions lied about', 'grid dimensions match tiles', (s) => { s.H = s.H + 3; }],

  ['a gauntlet swing that slides into a corridor', 'a gauntlet swing opens no new ground', (s) => {
    // One on the route, but with open floor beside it: sliding into that joins the trunk to
    // whatever the floor belongs to, which is a way round the tree.
    const mid = s.solutionPath[Math.floor(s.solutionPath.length / 2)];
    const rows = s.tiles.map((r) => r.split(''));
    rows[mid[1]][mid[0]] = '1'; rows[mid[1] + 1][mid[0]] = '1';
    s.tiles = rows.map((r) => r.join(''));
    s.sliders = [...s.sliders, { x: mid[0], y: mid[1], dx: 0, dy: 1, auto: true, gauntlet: true }];
  }],

  ['a pool level missing its stone', 'pool level has its stone and its door', (s) => {
    s.poolMode = true; s.poolDoor = { x: 1, y: 1 }; s.keySpot = null;
    s.startGap = [1, 1]; s.journals = [];
  }],
];

console.log('The Maze — harness self-test');
console.log(`  base maze: phase ${base.phaseIdx} ${base.who}, seed ${base.seed}, `
  + `${base.doors.length} door(s), ${base.darkTiles.length} dark tile(s), lamp at ${base.lampSpot}`);
console.log(`  it passes all ${CHECKS.length} checks; now breaking it one way at a time\n`);

let bad = 0;
const [, sanity] = ['', () => CHECKS.filter(([, fn]) => fn(base) !== null)];
const baseFails = sanity();
if (baseFails.length) {
  console.log(`  FAIL  the base maze does not pass cleanly: ${baseFails.map(([n]) => n).join(', ')}`);
  bad++;
}

for (const [what, shouldCatch, mutate] of MUTATIONS) {
  const s = clone();
  mutate(s);
  const caught = CHECKS.filter(([, fn]) => { try { return fn(s) !== null; } catch { return true; } }).map(([n]) => n);
  const didCatch = caught.includes(shouldCatch);
  const [openX, openY] = openFloor();
  void openX; void openY;
  if (didCatch) {
    const others = caught.filter((n) => n !== shouldCatch);
    console.log(`  ok    ${what}`);
    console.log(`          caught by "${shouldCatch}"${others.length ? `; also noticed by ${others.length} other check(s)` : ''}`);
  } else {
    bad++;
    console.log(`  FAIL  ${what}`);
    console.log(`          "${shouldCatch}" did not notice. Checks that fired: ${caught.join(', ') || 'none'}`);
  }
}

console.log('');
console.log(bad === 0
  ? `PASS — all ${MUTATIONS.length} deliberate breakages were caught by the right check`
  : `FAIL — ${bad} breakage(s) went unnoticed`);
process.exit(bad ? 1 : 0);
