// NODE_PATH=$(npm root -g) node stealth/tools/ai-check.mjs
// Drives the real game headless: a guard sees you, chases, loses you, searches with its "?",
// gives up and goes back to its round; a guard that reaches you catches you; the stairs climb.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${srv.address().port}/stealth/index.html`);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(800);
let fails = 0; const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails++; };

for (const fl of [2, 5, 9]) {
  // pick a patrolling guard with open floor in front of it; a few runs' floors have none, so try another run
  let gi = -1;
  for (let tries = 0; tries < 6 && gi < 0; tries++) {
    await page.evaluate(([n, t]) => { localStorage.clear(); if (t) GAME.save.runSeed = (Math.random() * 1e9) >>> 0; GAME.startFloor(n); }, [fl, tries]); await wait(300);
    await page.evaluate(() => GAME.skipIntro()); await wait(200);
    gi = await page.evaluate(() => {
      const f = GAME.L.field;
      return GAME.guards.findIndex(g => g.kind !== 'sentry' && f.ray(g.x, g.y, Math.cos(g.ang), Math.sin(g.ang), 120) > 110);
    });
  }
  if (gi < 0) { console.log('floor', fl, 'no open guard, skipped'); continue; }
  const seen = new Set();
  await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + Math.cos(g.ang) * 105, g.y + Math.sin(g.ang) * 105); window.__watch = i; window.__states = []; }, gi);
  // the meter fills over seconds on low floors (about 2.4s at 105 units on floor 2), so allow up to ~6s
  for (let t = 0; t < 110; t++) {
    const s = await page.evaluate(() => { const g = GAME.guards[__watch]; return g.state; });
    seen.add(s);
    if (s === 'chase') break;
    // stand still in front of them
    await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + Math.cos(g.ang) * 105, g.y + Math.sin(g.ang) * 105); }, gi);
    await wait(50);
  }
  check(seen.has('sus') && seen.has('chase'), `floor ${fl}: seen -> suspicious -> chase (${[...seen].join(',')}, aw ${await page.evaluate(() => GAME.guards[__watch].aw.toFixed(2))})`);
  // vanish: far away, at the entrance
  await page.evaluate(() => { const e = GAME.L.entrance; GAME.teleport(e.x, e.y); GAME.P.alive = true; });
  const after = new Set(); let qa = [];
  for (let t = 0; t < 140; t++) {
    const r = await page.evaluate(() => { const g = GAME.guards[__watch]; return [g.state, g.bubble ? g.bubble.k + g.bubble.a.toFixed(2) : '-']; });
    after.add(r[0]); if (r[0] === 'search') qa.push(r[1]);
    if (r[0] === 'patrol' && after.has('return')) break;
    await wait(100);
  }
  check(after.has('search'), `floor ${fl}: lost you -> search`);
  check(qa.some(b => b.startsWith('?1')) && qa.some(b => /^\?0\.[0-6]/.test(b)), `floor ${fl}: "?" shown then fades (${qa[0]} .. ${qa[qa.length - 1]})`);
  check(after.has('return') && after.has('patrol'), `floor ${fl}: returns to patrol (${[...after].join(',')})`);
  // caught
  await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + 4, g.y + 4); }, gi); await wait(300);
  check(await page.evaluate(() => GAME.mode) === 'caught', `floor ${fl}: touching a guard catches you`);
  await wait(2600);
  check(await page.evaluate(() => GAME.mode === 'intro' || GAME.mode === 'play'), `floor ${fl}: the floor restarts`);
  await page.evaluate(() => GAME.skipIntro());
  await page.evaluate(() => { const e = GAME.L.exit; GAME.teleport(e.x, e.y); }); await wait(4000);
  check(await page.evaluate(() => GAME.floor) === fl + 1, `floor ${fl}: the stairs lead to floor ${fl + 1}`);
}
// hide mid-chase: get chased, slip into a shade and hold still; the guard searches the rim and gives up
for (const [seed, fl] of [[22, 5], [44, 9]]) {
  await page.evaluate(([s, n]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); }, [seed, fl]); await wait(300);
  await page.evaluate(() => GAME.skipIntro()); await wait(200);
  const ok = await page.evaluate(() => {
    const f = GAME.L.field;
    for (const sh of GAME.L.shades) for (const g of GAME.guards) {
      const d = Math.hypot(g.x - sh.x, g.y - sh.y);
      if (d > 130 && d < 220 && f.ray(sh.x, sh.y, (g.x - sh.x) / d, (g.y - sh.y) / d, d) >= d - 4) { window.__sh = sh; window.__g = g; return true; }
    }
    return false;
  });
  if (!ok) { console.log('floor', fl, 'no shade in sight of a guard, skipped'); continue; }
  let st = '';
  for (let t = 0; t < 60 && st !== 'chase'; t++) {
    st = await page.evaluate(() => { const sh = __sh, g = __g, d = Math.hypot(g.x - sh.x, g.y - sh.y);
      GAME.teleport(sh.x + (g.x - sh.x) / d * 55, sh.y + (g.y - sh.y) / d * 55); g.ang = Math.atan2(GAME.P.y - g.y, GAME.P.x - g.x); return g.state; });
    if (st !== 'chase') await wait(50);
  }
  const seen = new Set([st]); let hid = false, mode = 'play';
  for (let t = 0; t < 160; t++) {
    const r = await page.evaluate(() => { const sh = __sh, P = GAME.P, dx = sh.x - P.x, dy = sh.y - P.y, d = Math.hypot(dx, dy);
      if (d > 3) { GAME.stick.on = true; GAME.stick.x = dx / d * 0.7; GAME.stick.y = dy / d * 0.7; } else { GAME.stick.on = false; GAME.stick.x = GAME.stick.y = 0; }
      return [__g.state, P.hidden, GAME.mode]; });
    seen.add(r[0]); hid = hid || r[1]; mode = r[2];
    if (mode === 'caught' || (hid && r[0] === 'patrol' && seen.has('return'))) break;
    await wait(100);
  }
  await page.evaluate(() => { GAME.stick.on = false; GAME.stick.x = GAME.stick.y = 0; });
  check(seen.has('chase') && hid && seen.has('search') && seen.has('return') && mode !== 'caught', `floor ${fl}: chased, hid in a shade -> search, return, not caught (${[...seen].join(',')}, ${mode})`);
}
check(errors.length === 0, 'no page errors ' + errors.join(' | '));
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
