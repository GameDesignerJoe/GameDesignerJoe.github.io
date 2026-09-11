#!/usr/bin/env node
// The Maze — the shape of a maze, as a graph.
//
// Built to test a hunch of Joe's: that the mazes have no real choke points, so
// every part of them feels like every other part and nothing reads as leaving
// one place and entering another.
//
// A threshold, said properly, is a run of articulation tiles whose removal
// splits the floor into two substantial pieces. A dead end is an articulation
// tile too, but it peels off one tile; that is not a threshold. So:
//
//   threshold   a run of adjacent cut tiles where the second-largest piece is
//               at least --share of the floor. Its length is how far you walk
//               with no way off it — Joe's "long hallway between sections".
//   junctions   tiles with three or more ways out: how often the maze asks you
//               a question. The gap between them is how long you get to walk
//               before it asks again.
//
//   node maze/tools/shape.mjs                      # every size, the Child
//   node maze/tools/shape.mjs --phase 3 --seeds 30
//   node maze/tools/shape.mjs --share 0.1

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : (argv[i + 1] ?? true); };
const SEEDS = Number(arg('seeds', 20));
const PHASE = Number(arg('phase', 0));
const SHARE = Number(arg('share', 0.15));
const PORT = Number(arg('port', 8765));
const PROTO = arg('proto', null);                       // measure a prototype instead of a maze
const SIZES = PROTO ? [PROTO] : arg('size', null) ? [arg('size', null)] : ['sm', 'md', 'lg', 'xl'];
const URL = `http://127.0.0.1:${PORT}/maze/maze-topdown.html`;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const K = (x, y) => x + ',' + y;

// Articulation tiles, and the sizes of the pieces each one separates. Iterative
// Tarjan — the recursive one blows the stack on an xl maze.
function chokes(open, W, H, sx, sy, share) {
  const idx = new Map(); const list = [];
  for (const k of open) { idx.set(k, list.length); list.push(k.split(',').map(Number)); }
  const N = list.length;
  const adj = list.map(([x, y]) => DIRS.map(([dx, dy]) => idx.get(K(x + dx, y + dy))).filter((v) => v != null));
  const disc = new Int32Array(N).fill(-1), low = new Int32Array(N), size = new Int32Array(N).fill(1);
  const parent = new Int32Array(N).fill(-1), pieces = list.map(() => []);
  const root = idx.get(K(sx, sy));
  if (root == null) return { major: [], N };
  let timer = 0;
  const stack = [[root, 0]];
  disc[root] = low[root] = timer++;
  let rootKids = 0;
  while (stack.length) {
    const top = stack[stack.length - 1];
    const [v, i] = top;
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
        if (low[v] >= disc[p]) pieces[p].push(size[v]);   // this child hangs off p alone
      }
    }
  }
  const major = [];
  for (let v = 0; v < N; v++) {
    const hung = v === root ? (rootKids > 1 ? pieces[v] : []) : pieces[v];
    if (!hung.length) continue;
    const rest = N - 1 - hung.reduce((a, b) => a + b, 0);
    const parts = [...hung, rest].sort((a, b) => b - a);
    if (parts[1] >= share * N) major.push({ v, k: list[v].join(','), parts });
  }
  return { major, N, list, idx, adj };
}

// major cut tiles that touch each other are one threshold, and its length is the
// walk you take with nothing branching off it
function runs(major, idx, adj) {
  const inMajor = new Set(major.map((m) => m.v));
  const seen = new Set(); const out = [];
  for (const m of major) {
    if (seen.has(m.v)) continue;
    const run = []; const q = [m.v]; seen.add(m.v);
    while (q.length) { const v = q.pop(); run.push(v);
      for (const w of adj[v]) if (inMajor.has(w) && !seen.has(w)) { seen.add(w); q.push(w); } }
    const best = major.filter((x) => run.includes(x.v)).sort((a, b) => b.parts[1] - a.parts[1])[0];
    out.push({ len: run.length, parts: best.parts });
  }
  return out.sort((a, b) => b.parts[1] - a.parts[1]);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.goto(URL + '?seed=1', { waitUntil: 'load' });
await page.waitForTimeout(900);

const snap = (size, ph, seed) => page.evaluate(([size, ph, seed, PROTO]) => {
  SAVE.phase = ph; SAVE.stones = ph; SAVE.poolPending = false;
  SAVE.ui = PROTO ? { proto: PROTO } : { size };
  delete SAVE.run;
  generate(seed);
  return { W, H, tiles: tiles.map((r) => Array.from(r, (v) => (v ? '1' : '0')).join('')),
    start: { x: Math.floor(start.x), y: Math.floor(start.y) },
    solutionPath: solutionPath.map((p) => [p[0], p[1]]) };
}, [size, ph, seed, PROTO]);

console.log('The Maze — the shape of it');
console.log(`  phase ${PHASE} · ${SEEDS} seeds a size · a threshold splits off at least ${(SHARE * 100).toFixed(0)}% of the floor\n`);
console.log('  size   floor   thresholds   longest run   biggest split        junctions   tiles between them   dead ends    room tiles');
console.log('  ' + '─'.repeat(104));

for (const size of SIZES) {
  const acc = { N: 0, th: 0, runLen: 0, split: 0, junc: 0, gap: 0, dead: 0 };
  for (let i = 0; i < SEEDS; i++) {
    const s = await snap(size, PHASE, 4242 + i * 137);
    const open = new Set();
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (s.tiles[y][x] === '1') open.add(K(x, y));
    const ch = chokes(open, s.W, s.H, s.start.x, s.start.y, SHARE);
    const rs = ch.major.length ? runs(ch.major, ch.idx, ch.adj) : [];
    // A junction is a fork in a corridor, not a tile in the middle of a room: an open room has
    // three ways out of every tile in it and asks you nothing, because you can see all of it. So
    // a tile in any 2x2 block of floor is room, and only the rest can be a fork.
    const inRoom = (x, y) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([ox, oy]) =>
      open.has(K(x + ox, y + oy)) && open.has(K(x + ox + 1, y + oy)) && open.has(K(x + ox, y + oy + 1)) && open.has(K(x + ox + 1, y + oy + 1)));
    let junc = 0, dead = 0, room = 0;
    for (const k of open) { const [x, y] = k.split(',').map(Number);
      const n = DIRS.filter(([dx, dy]) => open.has(K(x + dx, y + dy))).length;
      if (inRoom(x, y)) { room++; continue; }
      if (n >= 3) junc++; if (n === 1) dead++; }
    acc.room = (acc.room || 0) + room;
    acc.N += ch.N; acc.th += rs.length;
    acc.runLen += rs.length ? rs[0].len : 0;
    acc.split += rs.length ? rs[0].parts[1] / ch.N : 0;
    acc.junc += junc; acc.gap += junc ? (ch.N - room) / junc : 0; acc.dead += dead;
  }
  const a = (v) => v / SEEDS;
  console.log(`  ${size.padEnd(6)} ${String(Math.round(a(acc.N))).padEnd(7)} ${a(acc.th).toFixed(1).padEnd(12)} `
    + `${a(acc.runLen).toFixed(1).padEnd(13)} ${(a(acc.split) * 100).toFixed(0) + '% of the floor'} `.padEnd(21)
    + ` ${String(Math.round(a(acc.junc))).padEnd(11)} ${a(acc.gap).toFixed(1).padEnd(20)} ${String(Math.round(a(acc.dead))).padEnd(11)} ${Math.round(a(acc.room || 0))}`);
}

console.log('\n  thresholds  = places where the maze genuinely divides in two. A hallway between sections is one.');
console.log('  longest run = how far you walk along the biggest threshold with nothing branching off it.');
console.log('  tiles between them = floor tiles per junction: how long you walk before the maze asks again.');
await browser.close();
