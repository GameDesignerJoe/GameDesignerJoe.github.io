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
  await page.evaluate((n) => { localStorage.clear(); GAME.startFloor(n); }, fl); await wait(300);
  await page.evaluate(() => GAME.skipIntro()); await wait(200);
  // pick a patrolling guard with open floor in front of it
  const gi = await page.evaluate(() => {
    const f = GAME.L.field;
    return GAME.guards.findIndex(g => g.kind !== 'sentry' && f.ray(g.x, g.y, Math.cos(g.ang), Math.sin(g.ang), 120) > 110);
  });
  if (gi < 0) { console.log('floor', fl, 'no open guard, skipped'); continue; }
  const seen = new Set();
  await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + Math.cos(g.ang) * 105, g.y + Math.sin(g.ang) * 105); window.__watch = i; window.__states = []; }, gi);
  for (let t = 0; t < 40; t++) {
    const s = await page.evaluate(() => { const g = GAME.guards[__watch]; return g.state; });
    seen.add(s);
    if (s === 'chase') break;
    // stand still in front of them
    await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + Math.cos(g.ang) * 105, g.y + Math.sin(g.ang) * 105); }, gi);
    await wait(50);
  }
  check(seen.has('sus') && seen.has('chase'), `floor ${fl}: seen -> suspicious -> chase`);
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
check(errors.length === 0, 'no page errors ' + errors.join(' | '));
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
