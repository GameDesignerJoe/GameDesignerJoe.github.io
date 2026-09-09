#!/usr/bin/env node
// The Maze — behaviour smoke test.
//
// The other half of docs/HANDOFF.md §9: boot the page, tap the sleeper, walk,
// mark, save and reload, and check the movement values. §9 exists because the
// recentering ease went missing for two versions while every frame still
// rendered — so these assert what the game *does*, driven through real touch
// input, not what it draws.
//
// Also checks that every id the script reaches for actually exists, after the
// CSS range-replacement that once left the game paused on an invisible card.
//
//   node maze/tools/smoke.mjs [--port 8765] [--seed 4242] [--headed]
//
// Needs a static server on --port, e.g. python3 -m http.server 8765 from the repo root.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8765));
const SEED = Number(arg('seed', 4242));
const PAGE_URL = `http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=${SEED}`;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
  headless: !argv.includes('--headed'),
});
const ctx = await browser.newContext({
  viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

console.log('The Maze — behaviour smoke test');
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForTimeout(1400);

const version = await page.evaluate(() => VERSION);
console.log(`  game v${version} at ${PAGE_URL}\n`);

// ── 1. boots to the title screen, asleep ─────────────────────────
const boot = await page.evaluate(() => ({
  started, hasTitle: !!document.getElementById('title'),
  titleHidden: document.getElementById('title').classList.contains('hide'),
  pre: document.body.classList.contains('pre'),
  who: phase().who, zoom: zoomS, titleZoom: CONFIG.titleTilePx,
}));
check('boots to the title screen, asleep', !boot.started && boot.hasTitle && !boot.titleHidden && boot.pre,
  `started=${boot.started} pre=${boot.pre} zoom=${boot.zoom} (title zoom ${boot.titleZoom}) as ${boot.who}`);

// ── 2. every id the script reaches for exists ───────────────────
// The engine lives in js/*.js since v0.33.0; the shell still holds the markup.
const engineDir = new URL('../js/', import.meta.url);
const src = [readFileSync(new URL('../maze-topdown.html', import.meta.url), 'utf8')]
  .concat(readdirSync(engineDir).filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(new URL(f, engineDir), 'utf8')))
  .join('\n');
const ids = [...new Set([...src.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)].map((m) => m[1]))];
const idReport = await page.evaluate((list) => {
  const rules = new Set();
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) if (r.selectorText) rules.add(r.selectorText); }
    catch (e) { /* cross-origin sheet */ }
  }
  const css = [...rules].join(' ');
  return list.map((id) => ({ id, exists: !!document.getElementById(id), styled: css.includes('#' + id) }));
}, ids);
const missing = idReport.filter((r) => !r.exists);
check(`every $('id') in the script exists in the DOM (${ids.length} ids)`, missing.length === 0,
  missing.length ? `missing: ${missing.map((m) => m.id).join(', ')}` : '');
const unstyled = idReport.filter((r) => r.exists && !r.styled);
console.log(`          (${idReport.length - unstyled.length} of ${idReport.length} also have a CSS rule; `
  + `no rule for: ${unstyled.map((u) => u.id).join(', ') || 'none'})`);

// ── 2b. the script tags load in the order the engine expects ────
// 17 plain scripts sharing one global scope: order is load-bearing. Reordering
// them, or dropping one, breaks the game in ways a glance at the page will not
// show. Assert the sequence.
const shell = readFileSync(new URL('../maze-topdown.html', import.meta.url), 'utf8');
const tagOrder = [...shell.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const EXPECTED = [
  'data/config.js', 'data/phases.js', 'data/text.js', 'data/music.js',
  'js/core.js', 'js/generate.js', 'js/audio.js', 'js/state.js', 'js/input.js',
  'js/stories.js', 'js/run-save.js', 'js/tutorials.js', 'js/pool.js', 'js/map.js',
  'js/movement.js', 'js/render.js', 'js/boot.js',
];
check('script tags load data first, then the engine in order',
  JSON.stringify(tagOrder) === JSON.stringify(EXPECTED),
  tagOrder.length === EXPECTED.length
    ? `${tagOrder.length} tags, in order`
    : `got ${tagOrder.length} tags: ${tagOrder.join(' ')}`);

// Every file the shell references must actually be there.
const onDisk = new Set([...readdirSync(new URL('../js/', import.meta.url)).map((f) => 'js/' + f),
  ...readdirSync(new URL('../data/', import.meta.url)).map((f) => 'data/' + f)]);
const absent = tagOrder.filter((t) => !onDisk.has(t));
const orphans = [...onDisk].filter((f) => f.endsWith('.js') && !tagOrder.includes(f));
check('every referenced script exists, and none is left unloaded', absent.length === 0 && orphans.length === 0,
  `${absent.length ? 'missing: ' + absent.join(', ') + '; ' : ''}`
  + `${orphans.length ? 'on disk but never loaded: ' + orphans.join(', ') : 'no orphans'}`);

// ── 3. movement knobs are present and sane ──────────────────────
// The recentering incident: a block silently failed to insert and the values
// vanished. Assert they exist and are in the range the settled design needs.
const knobs = await page.evaluate(() => ({
  speed: CONFIG.speed, turnBufferMs: CONFIG.turnBufferMs, turnForgiveness: CONFIG.turnForgiveness,
  stickDeadzone: CONFIG.stickDeadzone, cameraLag: CONFIG.cameraLag, pushHoldMs: CONFIG.pushHoldMs,
  hasRecenterVar: typeof recenter !== 'undefined',
}));
const knobsOk = knobs.speed > 0 && knobs.turnBufferMs >= 100 && knobs.turnForgiveness > 0
  && knobs.stickDeadzone > 0 && knobs.stickDeadzone < 1 && knobs.cameraLag > 0 && knobs.pushHoldMs > 0
  && knobs.hasRecenterVar;
check('movement knobs present and in range', knobsOk, JSON.stringify(knobs));

// ── 4. tapping the sleeper starts the run ───────────────────────
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
});
await touch('touchStart', 215, 450);
await touch('touchEnd', 215, 450);
await page.waitForTimeout(3600);   // introSeconds 2.8 plus slack
const afterTap = await page.evaluate(() => ({
  started, pre: document.body.classList.contains('pre'),
  titleHidden: document.getElementById('title').classList.contains('hide'),
  zoom: Math.round(zoomS), tilePx: CONFIG.tilePx,
}));
check('tapping the sleeper begins the run and zooms out', afterTap.started && !afterTap.pre,
  `started=${afterTap.started} zoom=${afterTap.zoom} (play zoom ${afterTap.tilePx})`);

// ── 5. the stick walks, smoothly, on the centreline ─────────────
// Push north from the stick's centre and sample the player each frame.
const stick = await page.evaluate(() => {
  const r = document.getElementById('stick').getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});
const before = await page.evaluate(() => ({ x: player.x, y: player.y }));
await touch('touchStart', stick.cx, stick.cy);
const samples = [];
for (const dy of [-20, -45, -70, -70, -70, -70, -70, -70, -70, -70]) {
  await touch('touchMove', stick.cx, stick.cy + dy);
  await page.waitForTimeout(90);
  samples.push(await page.evaluate(() => ({ x: player.x, y: player.y, dir, held })));
}
await touch('touchEnd', stick.cx, stick.cy);
await page.waitForTimeout(260);
const after = await page.evaluate(() => ({ x: player.x, y: player.y }));

const moved = Math.hypot(after.x - before.x, after.y - before.y);
check('the stick moves the player', moved > 0.3,
  `from (${before.x.toFixed(2)}, ${before.y.toFixed(2)}) to (${after.x.toFixed(2)}, ${after.y.toFixed(2)}) — ${moved.toFixed(2)} tiles`);

// Continuity: no frame-to-frame jump big enough to be a snap.
let worst = 0;
for (let i = 1; i < samples.length; i++) {
  worst = Math.max(worst, Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
}
check('movement is continuous, not snapped', worst < 1.5,
  `largest step between samples: ${worst.toFixed(3)} tiles (a snap would land on a whole number)`);

// Centreline: walking north, x should sit near a tile centre (.5).
const offAxis = samples.map((s) => Math.abs((s.x % 1) - 0.5)).sort((a, b) => b - a)[0];
check('walking holds the corridor centreline', offAxis < 0.2,
  `worst off-centre while moving: ${offAxis.toFixed(3)} tiles from the .5 centreline`);

// ── 6. chalk leaves a permanent mark ────────────────────────────
const marked = await page.evaluate(() => {
  chalk = Math.max(chalk, 3);            // give ourselves a piece to spend
  const tx = Math.floor(player.x), ty = Math.floor(player.y);
  const key = tx + ',' + ty;
  const had = marks.size;
  marks.set(key, 'x');                   // the glyph picker's own effect
  saveRun(true);
  return { key, had, now: marks.size };
});
check('a chalk mark lands and is recorded', marked.now === marked.had + 1,
  `mark at ${marked.key}; marks ${marked.had} → ${marked.now}`);

// ── 7. save and reload resumes in place ─────────────────────────
const pre = await page.evaluate(() => {
  saveRun(true);
  return { x: player.x, y: player.y, marks: [...marks.keys()], steps, seed: SEED, phase: SAVE.phase };
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
const post = await page.evaluate(() => ({
  x: player.x, y: player.y, marks: [...marks.keys()], started, seed: SEED, phase: SAVE.phase,
}));
const samePos = Math.hypot(post.x - pre.x, post.y - pre.y) < 0.75;
const sameMarks = pre.marks.every((k) => post.marks.includes(k));
check('reload resumes the run in place', samePos && sameMarks && post.seed === pre.seed,
  `pos (${pre.x.toFixed(2)}, ${pre.y.toFixed(2)}) → (${post.x.toFixed(2)}, ${post.y.toFixed(2)}); `
  + `marks ${pre.marks.length} → ${post.marks.length} kept=${sameMarks}; seed ${pre.seed} → ${post.seed}`);

// ── 8. a pool level lays out and its stone opens the door ───────
const pool = await page.evaluate(() => {
  SAVE.poolPending = true;
  generate(99);
  const r = {
    poolMode, hasDoor: !!poolDoor, stone: keySpot,
    room: startRoom, pages: journals.size, dark: darkTiles.size,
    pools: POOLS.length, whoAtThisStone: POOLS[Math.min(SAVE.stones || 0, POOLS.length - 1)]?.who,
  };
  SAVE.poolPending = false;
  return r;
});
check('a pool level lays out with its stone and door', pool.poolMode && pool.hasDoor && !!pool.stone && pool.pages === 0,
  `door=${pool.hasDoor} stone=${pool.stone} pages=${pool.pages} dark=${pool.dark}; `
  + `${pool.pools} pools, this one hosts ${pool.whoAtThisStone}`);

// ── 9. no page errors throughout ─────────────────────────────────
check('no page errors', pageErrors.length === 0,
  pageErrors.length ? [...new Set(pageErrors)].slice(0, 3).map((e) => e.split('\n')[0]).join(' | ') : '');

// ── report ───────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
console.log('');
console.log(failed.length === 0
  ? `PASS — ${results.length} behaviour checks`
  : `FAIL — ${failed.length} of ${results.length} behaviour checks: ${failed.map((f) => f.name).join('; ')}`);

await browser.close();
process.exit(failed.length ? 1 : 0);
