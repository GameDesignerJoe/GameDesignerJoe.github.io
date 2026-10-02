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

// ── the first journal in its own hand ────────────────────────────
// Joe: "I'm still getting a hitch when it pulls up the first journal on a run … a frame or two later it realizes it needs
// to have a different journal text display so it swaps them." The hand wasn't fetched until the first page opened, and
// that page was drawn in a stand-in font, then swapped. It's fetched at the start now, before any page
{
  const p = await ctx.newPage();
  await p.goto(URL(4242), { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ loaded: [...document.fonts].filter((f) => f.family.replace(/['"]/g, '') === 'Caveat').map((f) => f.status), page: document.getElementById('page').classList.contains('show') }));
  check('the journal\'s handwriting is loaded before the first page opens, so the first page never comes up in another hand',
    !r.page && r.loaded.length > 0 && r.loaded.every((x) => x === 'loaded'), `before any page: Caveat ${r.loaded.join(', ') || 'not declared'}`);
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

// ── the picture book: read on the bed, put back on its shelf ────────
// Joe: "Maybe the children's book needs to be read. You sit in the bed and flip through the book. Then it has to be put
// away on a shelf in the room"
{
  const p = await open(4242); await awake(p);
  const text = () => p.evaluate(() => document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '');
  const esc = async () => { for (let i = 0; i < 3 && await text(); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(350); } };
  await esc();
  await p.evaluate(() => { const g = FP.lightGroups.find((q) => q.pitch); if (g && !g.on) FP.flipSwitch(g); });
  const gapFirst = await p.evaluate(() => { FP.shelveBook(); return document.getElementById('pageText').textContent; });   // the gap, tapped with nothing in hand
  await esc();
  await p.evaluate(() => { const o = FP.kidBook.o; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) { const x = o.x + dx * 0.9, y = o.y + dy * 0.9;
    if (tiles[Math.floor(y)] && tiles[Math.floor(y)][Math.floor(x)] && !FP.fboxes.some((b) => !b.flat && b.x0 < x && b.x1 > x && b.y0 < y && b.y1 > y)) { FP.P.x = x; FP.P.y = y; FP.P.a = Math.atan2(o.y - y, o.x - x); return; } } });
  await p.waitForTimeout(600); await esc();
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  const onBed = await p.evaluate(() => [FP.seated && FP.seated.mode, document.getElementById('bookLine').textContent, getComputedStyle(document.getElementById('bookLine')).display]);
  const lines = [onBed[1]];
  for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(350); lines.push(await p.evaluate(() => document.getElementById('bookLine').textContent)); }
  await p.waitForTimeout(800);
  const after = await text(), holding = await p.evaluate(() => [FP.carried.has('book'), !!FP.seated, getComputedStyle(document.getElementById('hudBookBox')).display !== 'none']);
  await esc();
  const put = await p.evaluate(() => { FP.shelveBook(); return [FP.kidBook.shelved, FP.carried.has('book'), FP.kidBook.gap.tex === TEX.sprites.bookSpine, document.getElementById('pageText').textContent]; });
  const pages = new Set(lines.slice(0, 5)).size;
  check('the picture book: sit on the bed, turn its five pages, get up holding it, and put it back in the gap on the shelf',
    /gap on the shelf/.test(gapFirst) && onBed[0] === 'book' && onBed[2] !== 'none' && pages === 5 && /did all the voices/.test(after) && holding[0] && !holding[1] && holding[2]
      && put[0] && !put[1] && put[2] && /back where it goes/.test(put[3]),
    `gap first: "${gapFirst.slice(0, 22)}…"; on the bed ${onBed[0]}, ${pages} pages read; then "${after.slice(0, 24)}…", holding ${holding[0]}, still sat ${holding[1]}, HUD ${holding[2]}; shelved ${put[0]}, spine in the gap ${put[2]}`);
  await p.close();
}

// ── the heart: heard from further, and one more wrong turn on the way in ─────
// Joe: "The heartbeat is great. However, we need to double the range it can be heard by. Also, we need one more
// branching dead end in the squeeze maze leading to it"
{
  const p = await open(4242); await awake(p);
  const dead = await p.evaluate(() => { const out = []; const W = FP.W;
    for (let s = 1; s <= 20; s++) { FP.newMaze(s * 7717 + 3); const h = FP.heart; if (!h) continue;
      // the squeeze maze's cells: its squeeze tiles; a dead end has one way out of it, and isn't the way in
      let n = 0; for (const k of h.maze) { const x = k % W, y = (k / W) | 0; if (!FP.low[k] || k === h.ring) continue;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => tiles[y + dy] && tiles[y + dy][x + dx]).length; if (open === 1) n++; }
      out.push(n); }
    FP.newMaze(4242); return out; });
  await p.waitForTimeout(4700);
  if (await p.evaluate(() => document.getElementById('page').classList.contains('show'))) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); }
  const heard = await p.evaluate(async () => { document.getElementById('undoLies').click();
    const h = FP.heart, W = FP.W; let at = -1; for (let k = 0; k < h.dist.length; k++) if (h.dist[k] === 40) { at = k; break; }
    if (at < 0) return { at: -1 };
    FP.P.x = at % W + 0.5; FP.P.y = ((at / W) | 0) + 0.5;
    let beats = 0; const was = FP_SOUND.heartbeat; FP_SOUND.heartbeat = (near, lub) => { beats++; was(near, lub); };
    await new Promise((r) => setTimeout(r, 2500)); FP_SOUND.heartbeat = was; return { at, beats }; });
  const two = dead.filter((n) => n >= 3).length;   // counted tile by tile it was 2 in every maze; now one more
  check('the heart: its beat carries 40 steps once it\'s open, and its squeeze maze has one more dead end (three, not two)',
    heard.beats > 0 && dead.length >= 15 && two >= dead.length * 0.8,
    `beats heard 40 steps off, in 2.5s: ${heard.beats}; dead ends in the squeeze maze over ${dead.length} mazes: ${dead.join(' ')}`);
  await p.close();
}

// ── the opening walls are chalk ─────────────────────────────────────
// Joe: "The opening text on the walls needs to be white, not black. Too hard to read and doesn't match the 'chalk' feel"
{
  const p = await open(4242);
  const r = await p.evaluate(() => { const INK = TEX.hex('#2a2622') >>> 0, CH = ((TEX.hex('#fbf9f2') & 0xffffff) | 0xfd000000) >>> 0, out = [];
    for (let s = 1; s <= 6; s++) { FP.newMaze(s * 7717 + 3);
      for (const w of FP.startWords) { const d = FP.decals.get(w.k * 4 + w.face); let ink = 0, ch = 0; if (d) for (const c of d) { if ((c >>> 0) === INK) ink++; if ((c >>> 0) === CH) ch++; } out.push([ink, ch]); } }
    return out; });
  check('the two opening walls are written in chalk, not ink', r.length >= 10 && r.every(([ink, ch]) => ink === 0 && ch > 60),
    `${r.length} opening walls over 6 mazes, [ink, chalk] pixels: ${r.map((x) => x.join('/')).join(' ')}`);
  await p.close();
}

// ── chalk shows on the pale walls, and the words stay on theirs ──────
// Joe: "make the white walls a bit more dingy so that the white chalk mark shows up better", and "a tighter font on the
// wall writing. It almost always bleeds off of the wall"
{
  const p = await open(4242);
  const r = await p.evaluate(() => {
    const lum = (c) => ((c & 0xff) + ((c >>> 8) & 0xff) + ((c >>> 16) & 0xff)) / 3, chalk = lum(TEX.hex('#ece7da'));
    const gap = {};
    for (const th of ['school', 'bleached']) { const walls = TEX.themes[th].walls.slice(0, 3); let sum = 0, n = 0;
      for (const w of walls) for (let y = 0; y < 18; y++) for (let x = 0; x < w.w; x++) { sum += lum(w.px[y * w.w + x]); n++; }   // the upper wall, where chalk goes
      gap[th] = Math.round(chalk - sum / n); }
    let edge = 0, words = 0; const INK = TEX.hex('#2a2622') >>> 0, CH = ((TEX.hex('#fbf9f2') & 0xffffff) | 0xfd000000) >>> 0;   // ink at dead ends, chalk on the opening walls
    for (let s = 1; s <= 8; s++) { FP.newMaze(s * 7717 + 3);
      for (const w of FP.wordSpots) { const d = FP.decals.get(w.k * 4 + w.face); if (!d) continue; words++;
        for (let y = 0; y < 64; y++) for (const x of [0, 1, 62, 63]) if ((d[y * 64 + x] >>> 0) === INK || (d[y * 64 + x] >>> 0) === CH) { edge++; y = 64; break; } } }
    return { gap, edge, words };
  });
  check('chalk shows on the pale walls (school, bleached), and no word at a dead end runs to the wall\'s edge',
    r.gap.school >= 55 && r.gap.bleached >= 30 && r.edge === 0 && r.words > 40,
    `chalk brighter than the upper wall by ${r.gap.school} (school), ${r.gap.bleached} (bleached); ${r.edge} of ${r.words} words touching an edge`);
  await p.close();
}

// ── a real quote each time, and the numpad ─────────────────────────
// Joe: "Pull the quotes from here and have them play randomly at the start of the game", and "a control scheme on the
// keyboard that uses the numberpad for movement (4,8,6,2) with 0 as the enter/interact key"
{
  const seen = new Set(); let bad = 0;
  for (let i = 0; i < 6; i++) {
    const p = await ctx.newPage(); await p.goto(URL(4242), { waitUntil: 'load' }); await p.waitForTimeout(500);
    const q = await p.evaluate(() => [document.getElementById('openingText').textContent, document.getElementById('openingBy').textContent,
      FP_OPENING.quotes.some(([t, by]) => t === document.getElementById('openingText').textContent && document.getElementById('openingBy').textContent.includes(by))]);
    seen.add(q[0]); if (!q[2] || !q[1]) bad++;
    await p.close();
  }
  const p = await open(4242); await awake(p);
  const a0 = await p.evaluate(() => [FP.P.x, FP.P.y, FP.P.a]);
  await p.keyboard.down('Numpad8'); await p.waitForTimeout(500); await p.keyboard.up('Numpad8');
  const a1 = await p.evaluate(() => [FP.P.x, FP.P.y, FP.P.a, document.getElementById('page').classList.contains('show')]);
  if (a1[3]) { await p.keyboard.press('Numpad0'); await p.waitForTimeout(300); }   // the start page, put down with 0
  const closed = await p.evaluate(() => !document.getElementById('page').classList.contains('show'));
  await p.waitForTimeout(600);
  if (await p.evaluate(() => document.getElementById('page').classList.contains('show'))) { await p.keyboard.press('Numpad0'); await p.waitForTimeout(400); }   // one queued behind it
  const a1b = await p.evaluate(() => FP.P.a);
  await p.keyboard.down('Numpad4'); await p.waitForTimeout(400); await p.keyboard.up('Numpad4');
  const a2 = await p.evaluate(() => FP.P.a);
  check('a real quote at the start, a different one from time to time, with who said it; the numpad walks, turns, and 0 is the hand',
    bad === 0 && seen.size >= 2 && Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) > 0.2 && closed && Math.abs(a2 - a1b) > 0.1,
    `${seen.size} different quotes in 6 loads, ${bad} not from the list or without a credit; 8 walked ${Math.hypot(a1[0] - a0[0], a1[1] - a0[1]).toFixed(2)}; 0 put the page down ${closed}; 4 turned ${(a2 - a1b).toFixed(2)}`);
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
  await p.evaluate(() => { FP.S.floors = 2; FP.goFloor(2); }); await p.waitForTimeout(2300);
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
  await p.evaluate(() => { FP.S.floors = 2; FP.goFloor(2); }); await p.waitForTimeout(2300);
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
  const behind = await p.evaluate(() => { let bad = 0, all = 0;
    for (let s = 1; s <= 10; s++) { FP.newMaze(s * 313 + 5); const W = FP.W;
      for (const c of FP.closets) { all++;   // the squeeze-free piece of floor it stands in
        const seen = new Set([c.y * W + c.x]), q = [c.y * W + c.x];
        for (let i = 0; i < q.length && seen.size < 40; i++) { const k = q[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = k + dy * W + dx, x = n % W, y = (n / W) | 0; if (!seen.has(n) && tiles[y][x] && !FP.low[n]) { seen.add(n); q.push(n); } } }
        if (seen.size < 40) bad++; } } return [bad, all]; });
  check('no closet in a pocket that squeezes shut off from the rest', behind[0] === 0 && behind[1] > 150,
    `${behind[0]} of ${behind[1]} closets over 10 mazes in a piece of floor under 40 tiles between squeezes`);
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
    const wt = FP.story.find((s) => s.kind === 'waiting'); let bare = 0, faces = 0;
    for (const k of wt.tiles) { const x = k % W, y = (k / W) | 0; for (const [dx, dy, f] of [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]]) if (!tiles[y + dy][x + dx]) { faces++; if (!FP.decals.has(((y + dy) * W + x + dx) * 4 + f)) bare++; } }
    return [FP.heartOpened, seen.has(h.mid), FP.story.filter((s) => s.lieFaces).map((s) => s.kind).join(','), bare, faces,
      document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '']; });
  await closePage(p);
  // Joe: only the wall's lies ("the one room that has all the writing on the walls"); the chair's room "doesn't need the words
  // on the walls"; and when the heart opens, "a journal popup that says something like 'something is opening up inside of me'"
  check('crossing out the wall\'s lies (the only room of them; the chair\'s room is bare) opens the heart, with a journal, and you can walk into it',
    opened[0] && opened[1] && opened[2] === 'wall' && opened[3] === opened[4] && /opening up inside of me/.test(opened[5]),
    `rooms of lies: ${opened[2]}; heart opened ${opened[0]}, reachable ${opened[1]}; the chair's room ${opened[3]} of ${opened[4]} walls bare; "${opened[5].slice(0, 36)}…"`);
  // at the shut exit
  await p.evaluate(() => { const [dx, dy] = FP.exitDir; FP.P.x = exit.x + 0.5 + dx * 0.25; FP.P.y = exit.y + 0.5 + dy * 0.25; FP.P.a = Math.atan2(dy, dx); });
  await p.waitForTimeout(500);
  const shutWon = await p.evaluate(() => FP.won);
  // the watch is the heart's now, centre stage: walked to, it's taken, and that's a journal; then onto the table by his chair.
  // Joe: "We should not make anything else required to complete the maze beyond crossing out the lies in the one room that has
  // all the writing on the walls, collecting the watch from the heart room, and put it in on this table next to the La-Z-Boy chair"
  const before = await p.evaluate(() => { const o = FP.objs.find((q) => q.kind === 'watch'); return { inHeart: !!o && Math.floor(o.y) * FP.W + Math.floor(o.x) === FP.heart.mid, pages: document.getElementById('hudPages').textContent }; });
  await p.evaluate(() => { const h = FP.heart; FP.P.x = h.mid % FP.W + 0.5; FP.P.y = ((h.mid / FP.W) | 0) + 0.5; }); await p.waitForTimeout(500);
  const watchNote = await p.evaluate(() => document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '');
  await closePage(p); await closePage(p);
  const carrying = await p.evaluate(() => FP.carried.has('watch'));
  // the slot by his chair: stand in front of it, looking at it
  await p.evaluate(() => { const st = FP.story.find((s) => s.chair), c = st.chair, t = st.slot || c; FP.P.x = t.x + c.fx * 1.2; FP.P.y = t.y + c.fy * 1.2; FP.P.a = Math.atan2(t.y - FP.P.y, t.x - FP.P.x); });
  await p.waitForTimeout(300); await closePage(p);
  for (const y of [480, 500, 460, 520]) { await p.mouse.click(215, y); await p.waitForTimeout(250); if (await p.evaluate(() => FP.watchLeft)) break; await closePage(p); }
  const left = await p.evaluate(() => [FP.watchLeft, FP.beingStateNow, FP.exitOpen, !!(FP.kidBook && FP.kidBook.shelved), document.getElementById('hudPages').textContent]);
  await closePage(p); await closePage(p);
  check('the watch waits in the middle of the heart; taken (a journal, his chair\'s note folded in) and left on his table, the exit opens — the book not needed; the being waits there',
    !shutWon && before.inHeart && /saved his seat/.test(watchNote) && carrying && left[0] && left[2] && !left[3] && left[1] === 'guide',
    `won at the shut exit: ${shutWon}; watch in the heart's middle ${before.inHeart}; its note "${watchNote.slice(0, 28)}…"; carried ${carrying}; left ${left[0]}, exit open ${left[2]} with the book shelved ${left[3]}; being ${left[1]}; pages ${before.pages} → ${left[4]}`);
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
  for (let i = 0; i < 44; i++) { await p.waitForTimeout(400); states.push(await p.evaluate(() => FP.beingState)); if (states[states.length - 1] === 'dormant' && states.includes('peer')) break; }   // it walks round to the mouth at your pace first
  check('in a squeeze, the being looks in at you and goes', states.includes('peer') && states[states.length - 1] === 'dormant' && !states.includes('closet'),
    `states: ${[...new Set(states)].join(' → ')}` + (states.includes('dormant') ? '' : ` (${await p.evaluate(() => JSON.stringify({ now: performance.now() | 0, won: FP.won, hidden: !!FP.hidden, heartAt: FP.heartAt[Math.floor(FP.P.y) * FP.W + Math.floor(FP.P.x)], reading: document.body.classList.contains('reading'), b: FP.being && [+FP.being.x.toFixed(2), +FP.being.y.toFixed(2), FP.being.mouth, FP.being.peerUntil], P: [FP.P.x, FP.P.y] }))})`));
  await p.close();
}

// ── the slot by his chair, and the kid's room ───────────────────
{
  const p = await open(4242); await awake(p);
  await p.evaluate(() => { const st = FP.story.find((s) => s.chair), c = st.chair, t = st.slot; FP.P.x = t.x + c.fx * 1.2; FP.P.y = t.y + c.fy * 1.2; FP.P.a = Math.atan2(t.y - FP.P.y, t.x - FP.P.x); });
  await p.waitForTimeout(250); await closePage(p); await p.mouse.click(215, 480); await p.waitForTimeout(300);
  const said = await p.evaluate(() => document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '');
  await closePage(p);
  // with the watch in hand, before the heart: it says why it won't go down yet, and keeps the watch
  await p.evaluate(() => { const w = FP.objs.find((o) => o.kind === 'watch'); FP.carried.add('watch'); if (w) FP.objs.splice(FP.objs.indexOf(w), 1); });
  await p.mouse.click(215, 480); await p.waitForTimeout(300);
  const holding = await p.evaluate(() => ({ text: document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '', kept: FP.carried.has('watch'), left: FP.watchLeft }));
  await closePage(p);
  const furnished = await p.evaluate(() => { let rooms = 0, withBed = 0, withGlove = 0;
    for (let s = 1; s <= 10; s++) { FP.newMaze(s * 577 + 9); const set = new Set([...secretTiles]); if (set.size < 9) continue; rooms++;
      if (FP.fboxes.some((b) => set.has(Math.floor((b.x0 + b.x1) / 2) + ',' + Math.floor((b.y0 + b.y1) / 2)) && b.z1 > 0.3)) withBed++;
      if (FP.objs.some((o) => o.tex === TEX.sprites.glove)) withGlove++; } return [rooms, withBed, withGlove]; });
  check('the slot by his chair says something goes there, and with the watch before the heart, not yet; the kid\'s room has its bed and its one glove',
    /something goes here/.test(said) && /truth i have yet to learn/.test(holding.text) && holding.kept && !holding.left && furnished[0] > 5 && furnished[1] === furnished[0] && furnished[2] === furnished[0],
    `tapped with nothing in hand: "${said}"; with the watch: "${holding.text}", kept ${holding.kept}; of ${furnished[0]} kid's rooms, ${furnished[1]} with the bed, ${furnished[2]} with the glove`);
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

// ── the keys still walk after the panel ──────────────────────────
// Joe: "You broke WASD on PC." Touch a slider on the panel, shut it, and the slider kept the keyboard: W did nothing
{
  const p = await open(4242); await awake(p);
  // somewhere with floor ahead and nothing on it to stop and read
  await p.evaluate(() => { const W = FP.W, held = new Set(FP.objs.map((o) => Math.floor(o.y) * W + Math.floor(o.x)));
    for (let y = 2; y < tiles.length - 2; y++) for (let x = 2; x < W - 5; x++) { let ok = true;
      for (let i = -1; i <= 3; i++) if (!tiles[y][x + i] || FP.low[y * W + x + i] || held.has(y * W + x + i)) ok = false;
      if (ok) { FP.P.x = x + 0.5; FP.P.y = y + 0.5; FP.P.a = 0; return; } } });
  await p.waitForTimeout(200);
  const walk = async () => { await p.evaluate(() => { FP.P.a = 0; }); const a = await p.evaluate(() => [FP.P.x, FP.P.y]); await p.keyboard.down('KeyW'); await p.waitForTimeout(1000); await p.keyboard.up('KeyW');
    const c = await p.evaluate(() => [FP.P.x, FP.P.y]); await p.keyboard.down('KeyS'); await p.waitForTimeout(1000); await p.keyboard.up('KeyS'); return Math.hypot(c[0] - a[0], c[1] - a[1]); };
  const before = await walk();
  await p.evaluate(() => { document.getElementById('gear').click(); for (const d of document.querySelectorAll('#panel details')) d.open = true; document.querySelector('#panel input[type=range]').focus(); });
  await p.waitForTimeout(200);
  const at = await p.evaluate(() => { const r = document.getElementById('panel').getBoundingClientRect(); return [Math.min(420, r.right + 10), Math.min(880, r.bottom + 10)]; });
  await p.mouse.click(at[0] < 420 ? at[0] : 215, at[0] < 420 ? 450 : at[1]); await p.waitForTimeout(300);   // the view, not the panel
  const shut = await p.evaluate(() => !document.getElementById('panel').classList.contains('open'));
  const after = await walk();
  // the bug this guards walked 0.00; a slow frame walks less, never nothing
  check('the keys still walk once the panel is shut, whatever was touched on it', before > 0.2 && shut && after > 0.2,
    `walked ${before.toFixed(2)} before; panel shut ${shut}; walked ${after.toFixed(2)} after touching a slider`);
  await p.close();
}

// ── a memory room's journal is a page like the others ──────────────
// Joe: "The journal for the phone doesn't get collected. I get the popup, [but] the count doesn't go up and it doesn't go away"
{
  const p = await open(4242); await awake(p);
  const r0 = await p.evaluate(() => ({ hud: document.getElementById('hudPages').textContent, mem: FP.objs.filter((o) => o.memPage).length }));
  await p.evaluate(() => { const st = FP.story.find((q) => q.mem === 'phone'), o = FP.objs.find((q) => q.memPage && st.set.has(Math.floor(q.y) * FP.W + Math.floor(q.x))); FP.P.x = o.x; FP.P.y = o.y; });
  await p.waitForTimeout(500);
  const shown = await p.evaluate(() => document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.keyboard.press('Space'); await p.waitForTimeout(300);   // and it doesn't come up again
  const r1 = await p.evaluate(() => ({ hud: document.getElementById('hudPages').textContent, mem: FP.objs.filter((o) => o.memPage).length, again: document.getElementById('page').classList.contains('show') }));
  check('a memory room\'s journal is picked up like any page: counted, in the total, gone from the floor',
  // (+ 3: the journals for the heart opening, the watch, the table)
    r0.mem >= 3 && r0.hud === '0 / ' + (5 + r0.mem + 3) && /fone/.test(shown) && r1.hud === '1 / ' + (5 + r0.mem + 3) && r1.mem === r0.mem - 1 && !r1.again,
    `HUD "${r0.hud}" with ${r0.mem} memory journals; read "${shown.slice(0, 30)}…"; then HUD "${r1.hud}", ${r1.mem} left, up again ${r1.again}`);
  await p.close();
}

// ── memory rooms: the phone that only rings, and catch you never throw straight ──
// Joe: "little activities you can do as the kid that trigger a core memory … A phone you can call that says 'call dad to
// go visit' above it and it just rings … Trying to throw a ball to play catch but never throwing it straight at the target"
{
  const p = await open(4242); await awake(p);
  const text = () => p.evaluate(() => document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '');
  const esc = async () => { if (await text()) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); } };
  // where they go, over twenty mazes: a room of its own, clear in front, never a closet on the phone
  const placed = await p.evaluate(() => { let rooms = 0, bad = 0, n = 0;
    for (let s = 1; s <= 20; s++) { FP.newMaze(s * 7717 + 3); n++;
      if (!FP.story.some((q) => q.kind === 'memory')) continue; rooms++;
      const st = FP.story.find((q) => q.mem === 'phone'); if (!st) continue;   // a maze deals its own few: not always the phone
      const fk = st.wall.k * 4 + st.wall.face, front = st.wall.vy * FP.W + st.wall.vx;
      if (FP.closets.some((c) => c.k * 4 + c.face === fk) || FP.fboxes.some((b) => Math.floor((b.x0 + b.x1) / 2) + Math.floor((b.y0 + b.y1) / 2) * FP.W === front) || !FP.memFace.has(fk)) bad++; }
    FP.newMaze(4242); return { rooms, bad, n }; });
  await p.waitForTimeout(4700); await esc();   // a new maze is woken into again
  // the phone: stand at it, and let it ring
  await p.evaluate(() => { const f = FP.story.find((q) => q.mem === 'phone').wall; FP.P.x = f.vx + 0.5 - f.dx * 0.6; FP.P.y = f.vy + 0.5 - f.dy * 0.6; FP.P.a = Math.atan2(f.dy, f.dx); });
  await p.waitForTimeout(300); await esc();
  await p.keyboard.press('Space'); await p.waitForTimeout(500);
  const ringing = await p.evaluate(() => !!FP.story.find((q) => q.mem === 'phone').ringing);
  await p.waitForTimeout(3000); const midway = await text();
  await p.waitForTimeout(12500); const after = await text(); await esc();
  // catch: the light on, pick up the ball, throw it at dad three times
  await p.evaluate(() => { const g = FP.lightGroups.find((q) => q.pitch); if (g && !g.on) FP.flipSwitch(g); });
  const throws = [];
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => { const ball = FP.objs.find((o) => o.kind === 'ball');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) { const x = ball.x + dx * 0.9, y = ball.y + dy * 0.9; if (tiles[Math.floor(y)] && tiles[Math.floor(y)][Math.floor(x)]) { FP.P.x = x; FP.P.y = y; break; } }
      FP.P.a = Math.atan2(ball.y - FP.P.y, ball.x - FP.P.x); });
    await p.waitForTimeout(200); await esc();
    await p.keyboard.press('Space'); await p.waitForTimeout(200);
    const held = await p.evaluate(() => FP.carried.has('ball'));
    await p.evaluate(() => { FP.P.a = Math.atan2(FP.catchT.y - FP.P.y, FP.catchT.x - FP.P.x); });
    await p.keyboard.press('Space'); await p.waitForTimeout(100);
    const miss = await p.evaluate(() => { const b = FP.objs.find((o) => o.kind === 'ball'), f = b.fly, t = FP.catchT;
      const aim = Math.atan2(f.hy - FP.P.y, f.hx - FP.P.x), to = Math.atan2(t.y - FP.P.y, t.x - FP.P.x); return Math.abs(Math.atan2(Math.sin(aim - to), Math.cos(aim - to))); });
    await p.waitForTimeout(2300);
    throws.push({ held, miss });
  }
  const caught = await text(); await esc();
  check('memory rooms: the phone rings and nobody answers, then the memory; catch never goes where you throw it, then the memory',
    placed.rooms === placed.n && placed.bad === 0 && ringing && !midway && /let it ring/.test(after) && throws.every((t) => t.held && t.miss > 0.25) && /never went where i threw it/.test(caught),
    `a memory room in ${placed.rooms} of ${placed.n} mazes, ${placed.bad} phones with a closet, furniture in front, or not a phone; rang ${ringing}, up 3.5s in: "${midway}", rung out: "${after.slice(0, 40)}…"; throws ${throws.map((t) => (t.held ? '' : 'not held ') + t.miss.toFixed(2) + ' rad off').join(', ')}; after three: "${caught.slice(0, 40)}…"`);
  await p.close();
}

// ── memory rooms: cards you always lose, and the fire ──────────────
// Joe: "Playing cards and always losing … Lighting a fire in the house and getting in trouble"
{
  const p = await open(4242); await awake(p);
  const text = () => p.evaluate(() => document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '');
  const esc = async () => { if (await text()) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); } };
  // none of them gets the wall's boxes and watch (they did, for a version: storyProps took them for the wall)
  const watches = await p.evaluate(() => { let extra = 0, rooms = 0;
    for (let s = 1; s <= 12; s++) { FP.newMaze(s * 7717 + 3);
      for (const st of FP.story.filter((q) => q.kind === 'memory')) { rooms++; if (FP.objs.some((o) => o.kind === 'watch' && st.set.has(Math.floor(o.y) * FP.W + Math.floor(o.x)))) extra++; } }
    FP.newMaze(4242); return { extra, rooms }; });
  await p.waitForTimeout(4700); await esc();
  const stand = (mem) => p.evaluate((mem) => { const st = FP.story.find((q) => q.mem === mem); const { x, y, ix, iy } = st.at; FP.P.x = x + 0.5 + ix * 1.1; FP.P.y = y + 0.5 + iy * 1.1; FP.P.a = Math.atan2(-iy, -ix); }, mem);
  await stand('cards'); await p.waitForTimeout(300); await esc();
  // Joe: "before you play you sit down in the chair and have the camera kind of tilt down to frame the table … There'd be a
  // button to press to get up." Space sits you down; then each Space is a hand, the cards flat on the table
  const stood = await p.evaluate(() => [FP.P.x, FP.P.y]);
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  const sat = await p.evaluate(() => !!FP.seated && FP.seated.k > 0.95 && getComputedStyle(document.getElementById('getUp')).display !== 'none');
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(2400); }
  const cards = await p.evaluate(() => FP.story.find((q) => q.mem === 'cards').hands || []);
  const flat = await p.evaluate(() => { const st = FP.story.find((q) => q.mem === 'cards'); return st.shown.length === 2 && st.shown.every((b) => FP.fboxes.includes(b) && b.topFit && b.z1 - b.z0 < 0.01); });
  const lost = await text(); await esc();
  await p.evaluate(() => document.getElementById('getUp').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await p.waitForTimeout(900);
  const up = await p.evaluate((s0) => !FP.seated && Math.hypot(FP.P.x - s0[0], FP.P.y - s0[1]) < 0.01, stood);
  await stand('fire'); await p.waitForTimeout(300); await esc();
  const ink = () => p.evaluate(() => { const st = FP.story.find((q) => q.mem === 'fire'); let n = 0; for (const q of st.walls) { const d = FP.decals.get(q.k * 4 + q.face); if (d) for (const c of d) if ((c >>> 0) === (TEX.hex('#1a1614') >>> 0)) n++; } return n; });
  const before = await ink();
  await p.keyboard.press('Space'); await p.waitForTimeout(2000);
  const burning = await p.evaluate(() => { const st = FP.story.find((q) => q.mem === 'fire'); return !!(st.fire && !st.fire.out && FP.objs.includes(st.fire.obj)); });
  await p.waitForTimeout(4000);
  const after = await ink(), trouble = await text(), ash = await p.evaluate(() => FP.story.find((q) => q.mem === 'fire').paper.tex === TEX.sprites.ash);
  await esc();
  check('memory rooms: sit down at the cards, his is always higher, three and the memory, then get up; the fire takes, then him on the walls, it\'s out, and the memory',
    watches.rooms > 20 && watches.extra === 0 && sat && flat && up && cards.length === 3 && cards.every(([k, d]) => d > k) && /never won/.test(lost)
      && before === 0 && burning && after > 200 && ash && /see i could do it/.test(trouble),
    `${watches.extra} of ${watches.rooms} memory rooms with a watch; sat down ${sat}, cards flat on the table ${flat}, got up where you stood ${up}; hands ${cards.map(([k, d]) => k + '<' + d).join(', ')}, then "${lost.slice(0, 30)}…"; fire burning ${burning}, his words ${before} → ${after} px, ash ${ash}, then "${trouble.slice(0, 30)}…"`);
  await p.close();
}

// ── at the card table on a PC, your card is on the screen ─────────
// Joe: "We need to pull the camera out more for the game of War because I can't read the bottom card on PC"
{
  const wctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await wctx.newPage(); p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.goto(URL(4242), { waitUntil: 'load' }); await p.waitForTimeout(700); await awake(p);
  await p.evaluate(() => { const st = FP.story.find((q) => q.mem === 'cards'); const { x, y, ix, iy } = st.at; FP.P.x = x + 0.5 + ix * 1.1; FP.P.y = y + 0.5 + iy * 1.1; FP.P.a = Math.atan2(-iy, -ix); });
  await p.waitForTimeout(300);
  if (await p.evaluate(() => document.getElementById('page').classList.contains('show'))) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); }
  await p.keyboard.press('Space'); await p.waitForTimeout(900); await p.keyboard.press('Space'); await p.waitForTimeout(1300);
  // the rows of the view with a card's face in them (pale, and hardly any colour): the lowest must be above the bottom
  const rows = await p.evaluate(() => { const c = document.getElementById('view'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lo = -1, n = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 28) { n++; lo = y; } } return { lo, n, h: c.height }; });
  check('at the card table on a wide screen, your card is all there, above the bottom of the view',
    rows.n > 200 && rows.lo >= 0 && rows.lo < rows.h * 0.9, `card face down to row ${rows.lo} of ${rows.h} (${rows.n} px)`);
  await wctx.close();
}

// ── memory rooms: hiding from him ──────────────────────────────────
// Joe: "Running and hiding from the drunk father." Walk in and the journal's read; then he's coming. In the closet when he
// gets there: he stands at it, and goes, and the memory. Not: he walks straight past you, and the other one
{
  const p = await open(4242); await awake(p);
  const text = () => p.evaluate(() => document.getElementById('page').classList.contains('show') ? document.getElementById('pageText').textContent : '');
  const esc = async () => { if (await text()) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); } };
  const runs = [];
  for (const hideIt of [true, false]) {
    if (!hideIt) { await p.evaluate(() => FP.newMaze(4242)); await p.waitForTimeout(4700); }
    await p.evaluate(() => { const m = FP.story.find((q) => q.mem === 'hide').m; FP.P.x = m.rx + 0.5; FP.P.y = m.ry + 0.5; });
    await p.waitForTimeout(500);
    const journal = await text(); await esc();
    const own = await p.evaluate(() => { const st = FP.story.find((q) => q.mem === 'hide'); return FP.closets.includes(st.closet) && st.set.has(st.closet.y * FP.W + st.closet.x); });
    if (hideIt) await p.evaluate(() => FP.enterCloset(FP.story.find((q) => q.mem === 'hide').closet));
    await p.waitForTimeout(4000);
    const early = await p.evaluate(() => { const c = FP.story.find((q) => q.mem === 'hide').coming; return !!(c && c.him); });
    let came = false, said = '', t = 0;
    for (; t < 60 && !said; t++) { await p.waitForTimeout(500); if (!came) came = await p.evaluate(() => { const c = FP.story.find((q) => q.mem === 'hide').coming; return !!(c && c.him); }); said = await text(); }
    runs.push({ hideIt, journal: /when dad drinks/.test(journal), own, early, came, said, secs: 4.5 + t / 2 });
    await esc(); if (hideIt) await p.evaluate(() => FP.leaveCloset());
  }
  const [a, b] = runs;
  check('memory rooms: walk in and the journal says he drinks; hide in time and he stands at the closet and goes; don\'t, and he walks past you',
    runs.every((r) => r.journal && r.own && !r.early && r.came) && /held my breath/.test(a.said) && /walked right past me/.test(b.said),
    runs.map((r) => `${r.hideIt ? 'hid' : 'stood there'}: journal ${r.journal}, its own closet ${r.own}, here before 4s ${r.early}, came ${r.came}, after ${r.secs}s "${r.said.slice(0, 26)}…"`).join('; '));
  await p.close();
}

// ── from the quote straight into lying down ──────────────────────
// Joe: "there is a couple frames of the camera already in the upright position. Then it cuts to the scene where they are
// waking up." Every frame the game shows through the card, before the wake has lain you down, is one of those frames
{
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.addInitScript(() => {
    window.__log = [];
    const tick = () => { const o = document.getElementById('opening'); if (o && window.FP) window.__log.push([+getComputedStyle(o).opacity, FP.eyeAt(), FP.S.eye]); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await p.goto(URL(4242), { waitUntil: 'load' }); await p.waitForTimeout(900); await p.keyboard.press('Escape'); await p.waitForTimeout(1600);
  const log = await p.evaluate(() => window.__log);
  let lay = false; const upright = log.filter(([op, eye, stand]) => { if (eye < stand - 0.01) lay = true; return op < 0.97 && !lay; }).length;
  check('from the quote on black straight into lying on the mat: no frame of the game standing shows first',
    log.length > 30 && lay && upright === 0, `${upright} of ${log.length} frames showed the game standing before the wake lay you down; lay down: ${lay}`);
  await p.close();
}

// ── sound: a stopped context comes back ──────────────────────────
// Joe: "I've lost sound now … I can get it to come in for a second, then it quits." A phone stops a context behind
// the page's back; walking is one long touch, so nothing but the page's own check would wake it
{
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.addInitScript(() => {   // keep hold of every context the page makes, to stop them from outside
    const A = window.AudioContext; window.__acs = [];
    window.AudioContext = class extends A { constructor(...a) { super(...a); window.__acs.push(this); } };
  });
  await p.goto(URL(4242), { waitUntil: 'load' }); await p.waitForTimeout(700); await awake(p);
  await p.mouse.click(215, 450); await p.waitForTimeout(500);   // a touch: sound starts
  const before = await p.evaluate(() => window.__acs.map((a) => a.state));
  await p.evaluate(() => Promise.all(window.__acs.map((a) => a.suspend())));
  const stopped = await p.evaluate(() => window.__acs.map((a) => a.state));
  await p.waitForTimeout(2600);   // as if still on the stick from before: no new touch or key
  const after = await p.evaluate(() => window.__acs.map((a) => a.state));
  const readout = await p.evaluate(() => document.getElementById('fps').textContent);
  check('sound stopped behind the page comes back with no new touch or key, and the panel says so',
    before.length === 2 && before.every((x) => x === 'running') && stopped.every((x) => x === 'suspended') && after.every((x) => x === 'running') && /sound running, music running/.test(readout),
    `contexts ${before.join(',')} → stopped ${stopped.join(',')} → after 2.6s ${after.join(',')}; panel "${readout}"`);
  await p.close();
}

// ── training: nothing said until you've had time, then once ever ─────
{
  const tctx = await browser.newContext({ viewport: { width: 430, height: 900 } });   // its own store: nothing learnt yet
  const p = await tctx.newPage(); p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.goto(URL(4242), { waitUntil: 'load' }); await p.waitForTimeout(700); await awake(p);
  const hint = () => p.evaluate(() => ({ on: !document.getElementById('hint').classList.contains('gone'), text: document.getElementById('hint').textContent, glow: document.getElementById('stick').classList.contains('glow'), shown: FP.trainShown }));
  const early = await hint();
  await p.waitForTimeout(5600); const idle = await hint();
  await p.keyboard.down('KeyW'); await p.waitForTimeout(200); await p.keyboard.up('KeyW'); await p.waitForTimeout(100); const walked = await hint();
  await p.evaluate(() => { const c = FP.closets[0]; FP.P.x = c.x + 0.5 + c.dx * 0.3; FP.P.y = c.y + 0.5 + c.dy * 0.3; FP.P.a = Math.atan2(-c.dy, -c.dx); });
  await p.waitForTimeout(800); const soon = await hint();
  await p.waitForTimeout(2400); const closet = await hint();
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(700);
  const kept = await p.evaluate(() => ({ ...FP.learnt }));
  await p.evaluate(() => document.getElementById('resetTraining').click());
  const reset = await p.evaluate(() => Object.keys(FP.learnt).length);
  check('training: the stick glows and WASD shows after 5s still, a closet says hide after a few seconds, each once ever, and Reset training forgets',
    !early.on && idle.on && idle.glow && /W A S D/.test(idle.text) && !walked.on && !walked.glow && !soon.on && closet.on && closet.shown === 'closet' && /space to hide/.test(closet.text)
      && kept.move && kept.closet && reset === 0,
    `at once ${early.on}; after 5.6s still: "${idle.text}" glow ${idle.glow}; after walking ${walked.on}; at a closet 0.8s ${soon.on}, 3.2s "${closet.text}"; after a reload learnt ${Object.keys(kept).join(',')}; after reset ${reset}`);
  await tctx.close();
}

await browser.close();
stopServer();
const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length ? `FAIL — ${failed.length} of ${results.length}` : `PASS — ${results.length}`} first person checks · ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(failed.length ? 1 : 0);
