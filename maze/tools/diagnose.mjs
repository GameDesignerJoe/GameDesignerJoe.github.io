// Reproduce one generated maze and report its door/key chain in detail.
//   node maze/tools/diagnose.mjs --phase 1 --seed 301922 [--stones 7]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PHASE = Number(arg('phase', 1)), SEED = Number(arg('seed', 301922)), STONES = Number(arg('stones', 7));

const K = (x, y) => x + ',' + y;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function flood(open, W, H, sx, sy, blocked = new Set()) {
  const seen = new Set(); if (!open.has(K(sx, sy)) || blocked.has(K(sx, sy))) return seen;
  const q = [[sx, sy]]; seen.add(K(sx, sy));
  while (q.length) { const [x, y] = q.pop();
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = K(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || blocked.has(k) || !open.has(k)) continue;
      seen.add(k); q.push([nx, ny]); } }
  return seen;
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 420, height: 900 }, hasTouch: true });
await p.goto('http://127.0.0.1:8765/maze/maze-topdown.html?seed=1', { waitUntil: 'load' });
await p.waitForTimeout(900);
const s = await p.evaluate(([ph, st, sd]) => {
  SAVE.phase = ph; SAVE.stones = st; SAVE.poolPending = false; SAVE.collected = {}; SAVE.ui = {};
  generate(sd);
  return {
    who: phase().who, W, H,
    tiles: tiles.map((r) => Array.from(r, (v) => (v ? '1' : '0')).join('')),
    start: { x: Math.floor(start.x), y: Math.floor(start.y) },
    exit: { x: Math.floor(exit.x), y: Math.floor(exit.y) },
    doors: doors.map((d) => ({ x: d.x, y: d.y, shape: d.shape, onRoute: !!d.onRoute })),
    innerKeys: [...innerKeys.entries()],
    sliders: sliders.map((sl) => ({ x: sl.x, y: sl.y, dx: sl.dx, dy: sl.dy })),
    pockets: pockets.map(([x, y]) => [x, y]),
    keySpot, gated, doorsWanted: phase().f.doors,
  };
}, [PHASE, STONES, SEED]);
await b.close();

const base = new Set();
for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (s.tiles[y][x] === '1') base.add(K(x, y));
const unioned = new Set(base);
for (const sl of s.sliders) { unioned.add(K(sl.x, sl.y)); unioned.add(K(sl.x + sl.dx, sl.y + sl.dy)); }

console.log(`phase ${PHASE} (${s.who}) stones ${STONES} seed ${SEED}`);
console.log(`grid ${s.W}x${s.H}  start ${K(s.start.x, s.start.y)}  exit ${K(s.exit.x, s.exit.y)}  gated=${s.gated}`);
console.log(`doors wanted by phase: ${s.doorsWanted} · doors placed: ${s.doors.length}\n`);

const keyOf = new Map(s.innerKeys.map(([k, shape]) => [shape, k]));
console.log('door chain, in placement order:');
for (let i = 0; i < s.doors.length; i++) {
  const d = s.doors[i], keyK = keyOf.get(d.shape);
  const blocked = new Set(s.doors.slice(i).map((x) => K(x.x, x.y)));
  const reach = flood(unioned, s.W, s.H, s.start.x, s.start.y, blocked);
  const reachBase = flood(base, s.W, s.H, s.start.x, s.start.y, blocked);
  console.log(`  door ${i}  ${K(d.x, d.y)}  ${d.shape}  onRoute=${d.onRoute}`);
  console.log(`     its key: ${keyK ?? '(none placed!)'}`);
  if (keyK) {
    console.log(`     key reachable with doors ${i}..${s.doors.length - 1} shut:`);
    console.log(`        sliders union-open (lenient): ${reach.has(keyK) ? 'yes' : 'NO — soft-lock'}`);
    console.log(`        grid as generated (strict)  : ${reachBase.has(keyK) ? 'yes' : 'NO'}`);
    const inPocket = s.pockets.some(([x, y]) => K(x, y) === keyK);
    console.log(`        key is in a sealed pocket: ${inPocket}`);
  }
}
console.log('\nall keys placed:', s.innerKeys.map(([k, sh]) => `${sh}@${k}`).join('  ') || '(none)');
console.log('exit key (gate):', s.keySpot ?? '(none)');

// Is the maze finishable at all? Open every door whose key you can actually get.
let held = new Set(), changed = true;
while (changed) {
  changed = false;
  const openDoors = s.doors.filter((d) => held.has(d.shape));
  const blocked = new Set(s.doors.filter((d) => !held.has(d.shape)).map((d) => K(d.x, d.y)));
  const reach = flood(unioned, s.W, s.H, s.start.x, s.start.y, blocked);
  for (const [k, shape] of s.innerKeys) {
    if (!held.has(shape) && reach.has(k)) { held.add(shape); changed = true; }
  }
  void openDoors;
}
const finalBlocked = new Set(s.doors.filter((d) => !held.has(d.shape)).map((d) => K(d.x, d.y)));
const finalReach = flood(unioned, s.W, s.H, s.start.x, s.start.y, finalBlocked);
console.log(`\nkeys obtainable by fixpoint: ${[...held].join(', ') || '(none)'}`);
console.log(`exit reachable after collecting all obtainable keys: ${finalReach.has(K(s.exit.x, s.exit.y)) ? 'YES — maze is finishable' : 'NO — MAZE IS UNFINISHABLE'}`);
