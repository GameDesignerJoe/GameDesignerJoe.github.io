#!/usr/bin/env node
// Measure the shape of the corridors — how much of the grid is used, how many
// turns and junctions there are, how long the straight runs get — so a change
// to the carver can be judged by numbers, not by squinting at the map.
//
//   node maze/tools/hall-metrics.mjs                    # Auto vs Fewer vs Least
//   node maze/tools/hall-metrics.mjs --size xl --seeds 12
//   node maze/tools/hall-metrics.mjs --shot least out.png   # also screenshot the full map
//
// Everything is measured at cell level (every other tile), where the maze is a
// graph: a cell with two neighbours in a line is corridor, two at right angles
// is a turn, three or four is a junction, one is a dead end.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8765));
const SIZE = arg('size', 'xl');
const SEEDS = Number(arg('seeds', 8));
const SHOT = arg('shot', null);
const SHOT_OUT = SHOT ? argv[argv.indexOf('--shot') + 2] : null;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 430, height: 930 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=1`, { waitUntil: 'load' });
await page.waitForTimeout(900);

const measure = (turns, size, seed) => {
  SAVE.phase = 0; SAVE.stones = 0; SAVE.poolPending = false; SAVE.collected = {};
  SAVE.ui = { size, turns: turns === 'auto' ? undefined : turns };
  generate(seed);
  const cells = CONFIG.cols * CONFIG.rows;
  const TX = (c) => c * 2 + 1 + P;
  const cellOpen = (cx, cy) => cx >= 0 && cy >= 0 && cx < CONFIG.cols && cy < CONFIG.rows && !!tiles[TX(cy)][TX(cx)];
  const linked = (ax, ay, bx, by) => !!tiles[ay + by + 1 + P][ax + bx + 1 + P];
  let open = 0, straight = 0, turn = 0, junction = 0, dead = 0;
  for (let cy = 0; cy < CONFIG.rows; cy++) for (let cx = 0; cx < CONFIG.cols; cx++) {
    if (!cellOpen(cx, cy)) continue; open++;
    const nb = DIRS.filter(([dx, dy]) => cellOpen(cx + dx, cy + dy) && linked(cx, cy, cx + dx, cy + dy));
    if (nb.length === 1) dead++;
    else if (nb.length >= 3) junction++;
    else if (nb.length === 2) { (nb[0][0] === -nb[1][0] && nb[0][1] === -nb[1][1]) ? straight++ : turn++; }
  }
  // straight runs: walk every maximal straight corridor and record its length in cells
  const runs = [];
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    for (let cy = 0; cy < CONFIG.rows; cy++) for (let cx = 0; cx < CONFIG.cols; cx++) {
      if (!cellOpen(cx, cy)) continue;
      const before = cellOpen(cx - dx, cy - dy) && linked(cx, cy, cx - dx, cy - dy);
      if (before) continue;                                      // not the start of a run
      let n = 1, x = cx, y = cy;
      while (cellOpen(x + dx, y + dy) && linked(x, y, x + dx, y + dy)) { n++; x += dx; y += dy; }
      if (n >= 2) runs.push(n);
    }
  }
  runs.sort((a, b) => b - a);
  const mean = runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0;
  return {
    cells, open, fill: open / cells, straight, turn, junction, dead,
    turnsPer100: 100 * (turn + junction) / Math.max(1, open),
    meanRun: mean, longest: runs[0] || 0, top5: runs.slice(0, 5),
    route: solutionPath.length, rooms: journals.size, doors: doors.length, pockets: pockets.length,
  };
};

const modes = ['auto', 'fewer', 'least'];
const seeds = Array.from({ length: SEEDS }, (_, i) => 5000 + i * 104729);
const table = {};
for (const m of modes) {
  const rows = [];
  for (const sd of seeds) rows.push(await page.evaluate(([f, t, s, d]) => new Function('return ' + f)()(t, s, d), [measure.toString(), m, SIZE, sd]));
  const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  table[m] = { fill: avg('fill'), open: avg('open'), cells: rows[0].cells, turnsPer100: avg('turnsPer100'),
    turn: avg('turn'), junction: avg('junction'), dead: avg('dead'), meanRun: avg('meanRun'), longest: avg('longest'),
    route: avg('route'), rooms: avg('rooms'), doors: avg('doors'), pockets: avg('pockets') };
}

const pct = (v) => (100 * v).toFixed(0) + '%';
const f1 = (v) => v.toFixed(1);
console.log(`corridor shape — size ${SIZE}, Child phase, mean of ${SEEDS} seeds  (${table.auto.cells} cells)\n`);
console.log('                        Auto      Fewer     Least');
console.log(`  grid used             ${pct(table.auto.fill).padEnd(9)} ${pct(table.fewer.fill).padEnd(9)} ${pct(table.least.fill)}`);
console.log(`  turns + junctions     ${f1(table.auto.turn + table.auto.junction).padEnd(9)} ${f1(table.fewer.turn + table.fewer.junction).padEnd(9)} ${f1(table.least.turn + table.least.junction)}`);
console.log(`    per 100 corridor    ${f1(table.auto.turnsPer100).padEnd(9)} ${f1(table.fewer.turnsPer100).padEnd(9)} ${f1(table.least.turnsPer100)}`);
console.log(`  junctions (forks)     ${f1(table.auto.junction).padEnd(9)} ${f1(table.fewer.junction).padEnd(9)} ${f1(table.least.junction)}`);
console.log(`  dead ends             ${f1(table.auto.dead).padEnd(9)} ${f1(table.fewer.dead).padEnd(9)} ${f1(table.least.dead)}`);
console.log(`  mean straight run     ${f1(table.auto.meanRun).padEnd(9)} ${f1(table.fewer.meanRun).padEnd(9)} ${f1(table.least.meanRun)}   cells`);
console.log(`  longest straight run  ${f1(table.auto.longest).padEnd(9)} ${f1(table.fewer.longest).padEnd(9)} ${f1(table.least.longest)}   cells`);
console.log(`  route start→exit      ${f1(table.auto.route).padEnd(9)} ${f1(table.fewer.route).padEnd(9)} ${f1(table.least.route)}   tiles`);
console.log(`  rooms / doors / pockets  ${f1(table.auto.rooms)}/${f1(table.auto.doors)}/${f1(table.auto.pockets)}   `
  + `${f1(table.fewer.rooms)}/${f1(table.fewer.doors)}/${f1(table.fewer.pockets)}   ${f1(table.least.rooms)}/${f1(table.least.doors)}/${f1(table.least.pockets)}`);

if (SHOT && SHOT_OUT) {
  // the game's own Full map debug view, so the picture is exactly what Joe sees
  await page.evaluate(([t, s]) => {
    SAVE.phase = 0; SAVE.stones = 0; SAVE.poolPending = false; SAVE.collected = {};
    SAVE.ui = { size: s, turns: t === 'auto' ? undefined : t };
    delete SAVE.run; reset(5000); debugMap = true; $('optMap').checked = true;
    document.body.classList.remove('pre'); $('title').classList.add('hide'); zoomS = CONFIG.tilePx; started = true;
  }, [SHOT, SIZE]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT_OUT });
  console.log(`\nfull-map screenshot (${SHOT}, seed 5000) → ${SHOT_OUT}`);
}
await browser.close();
