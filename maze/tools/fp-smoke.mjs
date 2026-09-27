#!/usr/bin/env node
// The first person's own behaviour checks: maze-fp.html, which smoke.mjs never loads. About a minute.
//
//   node maze/tools/fp-smoke.mjs [--port 8765]
//
// smoke.mjs is the top-down's suite; since the move to first person almost every change lands in fp/, where it
// caught nothing. These are the probes that verified each first-person batch, kept: each one is something that
// shipped broken once, or is the chapter's spine (pages in their places, the lies, the heart, the watch, the way
// out). It drives the page through its debug handle (window.FP) rather than the stick, so it runs at machine speed,
// and every check is written so it can fail — each names what it measured.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { ensureServer } from './serve.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8765));
const URL = (seed) => `http://127.0.0.1:${PORT}/maze/maze-fp.html?seed=${seed}`;
const t0 = Date.now();
const stopServer = await ensureServer(PORT);

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
const errors = [];
const open = async (seed) => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.goto(URL(seed), { waitUntil: 'load' }); await p.waitForTimeout(700);
  return p;
};
// past the quote on black (a key skips it) and the getting up
const awake = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(900 + 3700); };
const pageShown = (p) => p.evaluate(() => document.getElementById('page').classList.contains('show'));
const closePage = async (p) => { if (await pageShown(p)) { await p.mouse.click(215, 40); await p.waitForTimeout(250); } };
console.log('The Maze — first person checks');

// ── every look builds, and so do many mazes ──────────────────────
{
  const p = await open(4242);
  const r = await p.evaluate(async () => {
    const looks = Object.keys(TEX.themes), el = document.getElementById('optTheme'), out = [];
    for (const k of looks) { el.value = k; el.dispatchEvent(new Event('change')); FP.newMaze(101); out.push(k); }
    el.value = 'office'; el.dispatchEvent(new Event('change'));
    let built = 0; for (let s = 1; s <= 20; s++) { FP.newMaze(s * 7717 + 3); built++; }
    return { looks: out, built };
  });
  await p.waitForTimeout(300);
  check('every look loads and twenty mazes build without an error', errors.length === 0 && r.built === 20,
    `${r.looks.join(', ')}; ${r.built} mazes; ${errors.length} page errors${errors.length ? ': ' + errors[0] : ''}`);
  await p.close();
}

// ── waking: no control until you're up ───────────────────────────
{
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(URL(4242), { waitUntil: 'load' }); await p.waitForTimeout(600);
  const quote = await p.evaluate(() => [document.getElementById('opening').classList.contains('show'), document.getElementById('openingText').textContent]);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1300);
  const quoteGone = await p.evaluate(() => !document.getElementById('opening').classList.contains('show'));
  check('the game opens on the quote, on black, and a key goes on to the waking', quote[0] && quote[1].length > 20 && quoteGone,
    `shown at load: ${quote[0]} ("${quote[1].slice(0, 40)}…"); gone after a key: ${quoteGone}`);
  const lying = await p.evaluate(() => [document.body.classList.contains('waking'), FP.P.x, FP.P.y]);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(500); await p.keyboard.up('KeyW');
  const during = await p.evaluate(() => [FP.P.x, FP.P.y]);
  await p.waitForTimeout(3600);
  const up = await p.evaluate(() => [document.body.classList.contains('waking'), FP.P.x, FP.P.y]);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(500); await p.keyboard.up('KeyW');
  const after = await p.evaluate(() => [FP.P.x, FP.P.y]);
  const movedDuring = Math.hypot(during[0] - lying[1], during[1] - lying[2]), movedAfter = Math.hypot(after[0] - up[1], after[1] - up[2]);
  check('you wake on the mat and can\'t move until you\'re up, then can', lying[0] && movedDuring < 0.01 && !up[0] && movedAfter > 0.2,
    `waking at load: ${lying[0]}; moved ${movedDuring.toFixed(2)} while getting up, ${movedAfter.toFixed(2)} after`);
  await p.close();
}

// ── words on the walls ───────────────────────────────────────────
{
  const p = await open(4242);
  const r = await p.evaluate(() => { const out = []; for (let s = 1; s <= 8; s++) { FP.newMaze(s * 131 + 7); out.push(FP.wordSpots.length); } return out; });
  const teach = await p.evaluate(() => { FP.newMaze(4242); const sx = Math.floor(start.x), sy = Math.floor(start.y), W = FP.W;
    for (const [fk, d] of FP.decals) { const k = Math.floor(fk / 4), x = k % W, y = (k / W) | 0; if (Math.abs(x - sx) > 4 || Math.abs(y - sy) > 4) continue;
      const white = d.reduce((a, v) => a + (v === (TEX.hex('#ece7da') >>> 0) ? 1 : 0), 0); if (white > 60) return white; } return 0; });
  check('dead ends carry words (ten a maze), and the start room has an X to copy', r.every((n) => n >= 10) && teach > 60,
    `words per maze over 8 mazes: ${r.join(', ')} (start words included); the X and "draw an x": ${teach} chalk pixels on a start-room wall`);
  await p.close();
}

// ── pages in their places ────────────────────────────────────────
{
  const p = await open(4242);
  const r = await p.evaluate(() => {
    const bad = {}, seen = {};
    for (let s = 1; s <= 12; s++) { FP.newMaze(s * 7717 + 3); const W = FP.W;
      for (const o of FP.objs.filter((o) => o.kind === 'page')) { seen[o.place] = (seen[o.place] || 0) + 1;
        const k = Math.floor(o.y) * W + Math.floor(o.x); let ok = true;
        if (o.place === 'waiting' || o.place === 'wall') ok = FP.story.some((st) => st.kind === o.place && st.set.has(k));
        if (o.place === 'heart') ok = !!FP.heart && FP.heart.set.has(k);
        if (o.place === 'kid') ok = [...secretTiles].includes((k % W) + ',' + ((k / W) | 0));
        if (!ok) bad[o.place] = (bad[o.place] || 0) + 1; } }
    return { bad, seen };
  });
  await p.evaluate(() => FP.goFloor(2)); await p.waitForTimeout(2300);
  const up = await p.evaluate(() => [FP.objs.filter((o) => o.kind === 'page').length, document.getElementById('hudPages').textContent]);
  check('the Child\'s five pages lie in their places, and the floor above has none',
    Object.keys(r.bad).length === 0 && ['start', 'waiting', 'wall', 'kid', 'heart'].every((k) => r.seen[k] === 12) && up[0] === 0 && up[1].endsWith('/ 5'),
    `over 12 mazes: ${JSON.stringify(r.seen)}; out of place: ${JSON.stringify(r.bad)}; floor 2: ${up[0]} pages, HUD "${up[1]}"`);
  await p.close();
}

// ── closets stay put, and you can get in ─────────────────────────
{
  const p = await open(4242); await awake(p);
  const keys = () => p.evaluate(() => FP.closets.map((c) => c.k * 4 + c.face).sort((a, b) => a - b).join(','));
  const a = await keys();
  await p.evaluate(() => { for (let i = 0; i < 3; i++) FP.addFind(); });
  await p.evaluate(() => FP.goFloor(2)); await p.waitForTimeout(2300);
  await p.evaluate(() => FP.goFloor(1)); await p.waitForTimeout(2300);
  const b = await keys(), A = new Set(a.split(',')), moved = b.split(',').filter((k) => !A.has(k)).length;
  let inN = 0;
  for (let i = 0; i < 5; i++) {
    await p.evaluate((i) => { const c = FP.closets[i]; FP.P.x = c.x + 0.5 + c.dx * 0.3; FP.P.y = c.y + 0.5 + c.dy * 0.3; FP.P.a = Math.atan2(-c.dy, -c.dx); }, i);
    await p.waitForTimeout(120); await closePage(p); await p.mouse.click(215, 450); await p.waitForTimeout(150);
    if (await p.evaluate(() => { const h = !!FP.hidden; if (h) FP.leaveCloset(); return h; })) inN++;
  }
  check('closets stay behind their doors after the turn and the stairs, and a tap steps you in', moved === 0 && inN >= 4,
    `${moved} of ${A.size} closets moved after the turn and a floor round trip; stepped into ${inN} of 5 from in front`);
  await p.close();
}

// ── the lies, the heart, the watch, the way out ──────────────────
{
  const p = await open(4242); await awake(p);
  const sealed = await p.evaluate(() => { const h = FP.heart, W = FP.W; return [!!h, h && h.sealed, h && !!tiles[(h.ring / W) | 0][h.ring % W], FP.exitLocked]; });
  check('the heart is carved and walled up, and the exit shut, until the lies are crossed out',
    sealed[0] && sealed[1] && !sealed[2] && sealed[3], `heart ${sealed[0] ? 'placed' : 'missing'}, sealed ${sealed[1]}, its way in open ${sealed[2]}; exit locked ${sealed[3]}`);
  // a face crossed out: struck through and the truth written over
  const struck = await p.evaluate(() => {
    const st = FP.story.find((s) => s.kind === 'wall'), fk = [...st.lieFaces][0], d = FP.decals.get(fk);
    const n = (hex) => d.reduce((a, v) => a + (v === (TEX.hex(hex) >>> 0) ? 1 : 0), 0);
    FP.crossOut(fk); return [n('#6e1a16'), n('#b3302a'), st.struck.size];
  });
  check('chalking a face of lies strikes its lines through and writes the truth over them', struck[0] > 100 && struck[1] > 50 && struck[2] === 1,
    `${struck[0]} strike pixels, ${struck[1]} truth pixels, ${struck[2]} face struck`);
  await p.evaluate(() => document.getElementById('undoLies').click()); await p.waitForTimeout(200);
  const opened = await p.evaluate(() => { const W = FP.W, h = FP.heart, seen = new Set([h.out]), q = [h.out];
    while (q.length) { const c = q.shift(); if (c === h.mid) break; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = c + dy * W + dx; if (!seen.has(n) && tiles[(n / W) | 0][n % W]) { seen.add(n); q.push(n); } } }
    return [FP.heartOpened, seen.has(h.mid), FP.story.filter((s) => s.lieFaces).every((s) => s.undone)]; });
  check('undoing both rooms of lies opens the heart, and you can walk into it', opened[0] && opened[1] && opened[2],
    `both undone ${opened[2]}; heart opened ${opened[0]}; reachable from its way in ${opened[1]}`);
  // at the shut exit
  await p.evaluate(() => { const [dx, dy] = FP.exitDir; FP.P.x = exit.x + 0.5 + dx * 0.25; FP.P.y = exit.y + 0.5 + dy * 0.25; FP.P.a = Math.atan2(dy, dx); });
  await p.waitForTimeout(500);
  const shutWon = await p.evaluate(() => FP.won);
  // the heart walked into, the watch taken, the seat tapped
  await p.evaluate(() => { const h = FP.heart; FP.P.x = h.mid % FP.W + 0.5; FP.P.y = ((h.mid / FP.W) | 0) + 0.5; }); await p.waitForTimeout(400); await closePage(p);
  await p.evaluate(() => { const o = FP.objs.find((o) => o.kind === 'watch'); for (const r of [1.6, 1.3, 1.0]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = o.x + dx * r, y = o.y + dy * r; if (tiles[Math.floor(y)][Math.floor(x)] && !FP.objs.some((q) => q !== o && Math.hypot(q.x - x, q.y - y) < 1.5)) { FP.P.x = x; FP.P.y = y; FP.P.a = Math.atan2(-dy, -dx); return; } } });
  await p.waitForTimeout(300); await closePage(p); await p.mouse.click(215, 470); await p.waitForTimeout(300); await closePage(p);
  const carrying = await p.evaluate(() => FP.carried.has('watch'));
  await p.evaluate(() => { const c = FP.story.find((s) => s.chair).chair; FP.P.x = c.x + c.fx * 1.3; FP.P.y = c.y + c.fy * 1.3; FP.P.a = Math.atan2(-c.fy, -c.fx); });
  await p.waitForTimeout(300); await closePage(p);
  for (const y of [480, 500, 460, 520]) { await p.mouse.click(215, y); await p.waitForTimeout(250); if (await p.evaluate(() => FP.watchLeft)) break; await closePage(p); }
  const left = await p.evaluate(() => [FP.watchLeft, FP.beingStateNow]);
  await closePage(p);
  check('the exit won\'t open until the watch is left on his chair; then the being waits there',
    !shutWon && carrying && left[0] && left[1] === 'guide', `won at the shut exit: ${shutWon}; carried the watch: ${carrying}; left it: ${left[0]}; being: ${left[1]}`);
  await p.evaluate(() => { const [dx, dy] = FP.exitDir; FP.P.x = exit.x + 0.5 - dx * 2.2; FP.P.y = exit.y + 0.5 - dy * 2.2; FP.P.a = Math.atan2(dy, dx); });
  await p.waitForTimeout(3400);
  const kid = await p.evaluate(() => FP.beingStateNow);
  await p.evaluate(() => { const [dx, dy] = FP.exitDir; FP.P.x = exit.x + 0.5 + dx * 0.25; FP.P.y = exit.y + 0.5 + dy * 0.25; }); await p.waitForTimeout(500);
  const won = await p.evaluate(() => [FP.won, document.getElementById('winSteps').textContent]);
  check('close to it, the being is the kid, and goes; the way out says it\'s time to come home', kid === 'done' && won[0] && /come home/.test(won[1]),
    `being after the approach: ${kid}; out: ${won[0]}, "${won[1].split('\n')[0]}"`);
  await p.close();
}

// ── the being ────────────────────────────────────────────────────
{
  const p = await open(4242); await awake(p);
  await p.evaluate(() => { const W = FP.W, d = FP.pathDist; let best = null, bl = 0;
    for (let k = 0; k < d.length; k++) if (d[k] >= 10) { const x = k % W, y = (k / W) | 0; for (const [dx, dy, h] of [[1, 0, 0], [0, 1, 1], [-1, 0, 2], [0, -1, 3]]) { let n = 0; while (tiles[y + dy * (n + 1)] && tiles[y + dy * (n + 1)][x + dx * (n + 1)] && !FP.low[(y + dy * (n + 1)) * W + x + dx * (n + 1)] && n < 30) n++; if (n > bl) { bl = n; best = [x, y, h]; } } }
    FP.P.x = best[0] + 0.5; FP.P.y = best[1] + 0.5; FP.P.a = best[2] * Math.PI / 2; for (let i = 0; i < 3; i++) FP.addFind(); FP.forceBeing(); });
  await p.waitForTimeout(3300);
  const w = await p.evaluate(() => [FP.beingState, FP.being && Math.hypot(FP.being.x - FP.P.x, FP.being.y - FP.P.y)]);
  await p.waitForTimeout(1500);
  const still = await p.evaluate(() => [FP.beingState, FP.being && Math.hypot(FP.being.x - FP.P.x, FP.being.y - FP.P.y)]);
  await p.evaluate(() => { const b = FP.being; FP.P.x = b.x - Math.cos(FP.P.a) * 2.5; FP.P.y = b.y - Math.sin(FP.P.a) * 2.5; }); await p.waitForTimeout(500);
  const near = await p.evaluate(() => FP.beingState);
  check('the being stands where you can see it and waits, and chases only once you\'re close',
    w[0] === 'watch' && w[1] > 3 && w[1] <= 9.5 && still[0] === 'watch' && Math.abs(still[1] - w[1]) < 0.01 && near === 'chase',
    `appeared ${w[1] ? w[1].toFixed(1) : '-'} tiles off (${w[0]}), ${still[0]} a moment later, ${near} within 2.5`);
  // in a squeeze it only looks in
  await p.evaluate(() => { const W = FP.W, L = FP.low; for (let k = 0; k < L.length; k++) if (L[k] && !FP.heartAt[k] && FP.pathDist[k] > 3) { const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tiles[y + dy][x + dx] && !L[(y + dy) * W + x + dx]) { FP.P.x = x + 0.5; FP.P.y = y + 0.5; FP.P.a = Math.atan2(dy, dx); return; } } });
  const states = [];
  for (let i = 0; i < 24; i++) { await p.waitForTimeout(400); states.push(await p.evaluate(() => FP.beingState)); if (states[states.length - 1] === 'dormant' && states.includes('peer')) break; }
  check('in a squeeze, the being looks in at you and goes', states.includes('peer') && states[states.length - 1] === 'dormant' && !states.includes('closet'),
    `states: ${[...new Set(states)].join(' → ')}`);
  await p.close();
}

// ── the turn: three pages, and nothing else counts ───────────────
{
  const p = await open(4242); await awake(p);
  const walkOnto = (place) => p.evaluate((place) => { const o = FP.objs.find((o) => o.kind === 'page' && o.place === place); FP.P.x = o.x; FP.P.y = o.y; }, place);
  // into every story room first: that's no find
  for (const kind of ['waiting', 'wall']) { await p.evaluate((kind) => { const st = FP.story.find((s) => s.kind === kind); const k = st.tiles[st.tiles.length >> 1]; FP.P.x = k % FP.W + 0.5; FP.P.y = ((k / FP.W) | 0) + 0.5; }, kind); await p.waitForTimeout(250); await closePage(p); }
  const afterRooms = await p.evaluate(() => [FP.finds, FP.turned]);
  await walkOnto('start'); await p.waitForTimeout(250); await closePage(p);
  await walkOnto('waiting'); await p.waitForTimeout(250); await closePage(p);
  const afterTwo = await p.evaluate(() => FP.turned);
  await walkOnto('wall'); await p.waitForTimeout(250); await closePage(p);
  const afterThree = await p.evaluate(() => [FP.turned, document.getElementById('hudPages').textContent]);
  check('the building turns at the third page, and walking into rooms doesn\'t count', afterRooms[0] === 0 && !afterRooms[1] && !afterTwo && afterThree[0],
    `finds after both story rooms: ${afterRooms[0]}; turned after two pages: ${afterTwo}; after three: ${afterThree[0]} (HUD ${afterThree[1]})`);
  // two things picked up together: the second waits for the first to be put down
  await p.evaluate(() => { const a = FP.objs.find((o) => o.kind === 'page' && o.place === 'kid'), b = FP.objs.find((o) => o.kind === 'page' && o.place === 'heart'); b.x = a.x; b.y = a.y; FP.P.x = a.x; FP.P.y = a.y; });
  await p.waitForTimeout(300);
  const first = await p.evaluate(() => document.getElementById('pageText').textContent.slice(0, 20));
  await p.waitForTimeout(600);
  const still = await p.evaluate(() => document.getElementById('pageText').textContent.slice(0, 20));
  await closePage(p); await p.waitForTimeout(500);
  const second = await p.evaluate(() => [document.getElementById('page').classList.contains('show'), document.getElementById('pageText').textContent.slice(0, 20)]);
  check('two pages picked up at once are read one after the other, never one over the other', first === still && second[0] && second[1] !== first,
    `first "${first}…" held while up (${first === still}); after closing it: ${second[0] ? `"${second[1]}…"` : 'nothing'}`);
  await p.close();
}

// ── Space is the hand ────────────────────────────────────────────
{
  const p = await open(4242); await awake(p);
  await p.evaluate(() => { const c = FP.closets[0]; FP.P.x = c.x + 0.5 + c.dx * 0.3; FP.P.y = c.y + 0.5 + c.dy * 0.3; FP.P.a = Math.atan2(-c.dy, -c.dx); });
  await p.waitForTimeout(150); await closePage(p);
  await p.keyboard.press('Space'); await p.waitForTimeout(150); const inCloset = await p.evaluate(() => !!FP.hidden);
  await p.keyboard.press('Space'); await p.waitForTimeout(150); const outAgain = await p.evaluate(() => !FP.hidden);
  // a plain wall a step ahead: Space chalks it
  const marks = () => p.evaluate(() => [...FP.decals.values()].reduce((a, d) => a + d.reduce((s, v) => s + (v ? 1 : 0), 0), 0));
  await p.evaluate(() => { const W = FP.W; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { if (!tiles[y][x] || FP.low[y * W + x] || FP.heartAt[y * W + x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const wx = x + dx, wy = y + dy; if (tiles[wy][wx] || FP.decals.has((wy * W + wx) * 4 + [0, 1, 2, 3][[[1, 0], [-1, 0], [0, 1], [0, -1]].findIndex(([a, b]) => a === dx && b === dy)])) continue;
      if (FP.objs.some((o) => Math.hypot(o.x - x - 0.5, o.y - y - 0.5) < 2.5) || FP.doors.some((d) => Math.abs(d.k % W - x) + Math.abs(((d.k / W) | 0) - y) < 2)) continue;
      FP.P.x = x + 0.5; FP.P.y = y + 0.5; FP.P.a = Math.atan2(dy, dx); return; } } });
  await p.waitForTimeout(200); await closePage(p);
  const m0 = await marks(); await p.keyboard.press('Space'); await p.waitForTimeout(200); const m1 = await marks();
  // a page on the floor ahead: Space takes it
  await p.evaluate(() => { const o = FP.objs.find((o) => o.kind === 'page' && o.place === 'waiting'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = o.x + dx * 1.3, y = o.y + dy * 1.3; if (tiles[Math.floor(y)][Math.floor(x)]) { FP.P.x = x; FP.P.y = y; FP.P.a = Math.atan2(-dy, -dx); return; } } });
  await p.waitForTimeout(250); await closePage(p);
  const before = await p.evaluate(() => FP.objs.some((o) => o.place === 'waiting'));
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  const took = await p.evaluate(() => !FP.objs.some((o) => o.place === 'waiting'));
  check('on a PC, Space is the hand: into a closet and out, chalk on the wall ahead, the page on the floor ahead',
    inCloset && outAgain && m1 > m0 && before && took, `closet in ${inCloset}, out ${outAgain}; wall marks ${m0} → ${m1}; page ahead taken ${took}`);
  await p.close();
}

// ── reading ──────────────────────────────────────────────────────
{
  const p = await open(4242); await awake(p);
  await p.evaluate(() => { const o = FP.objs.find((o) => o.kind === 'page' && o.place !== 'start'); FP.P.x = o.x; FP.P.y = o.y; });
  await p.waitForTimeout(400);
  const x0 = await p.evaluate(() => [FP.P.x, FP.P.y]);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(600); await p.keyboard.up('KeyW');
  const x1 = await p.evaluate(() => [FP.P.x, FP.P.y]), shown = await pageShown(p);
  await p.mouse.click(215, 450); await p.waitForTimeout(200); const onPaper = await pageShown(p);
  await p.mouse.click(215, 40); await p.waitForTimeout(300); const offPaper = await pageShown(p);
  check('a page stays up until you tap off it, and you don\'t move while you read', shown && Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) < 0.01 && onPaper && !offPaper,
    `up after walking onto it: ${shown}; moved ${Math.hypot(x1[0] - x0[0], x1[1] - x0[1]).toFixed(2)}; tap on the paper keeps it: ${onPaper}; tap off closes it: ${!offPaper}`);
  await p.close();
}

await browser.close();
stopServer();
const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length ? `FAIL — ${failed.length} of ${results.length}` : `PASS — ${results.length}`} first person checks · ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(failed.length ? 1 : 0);
