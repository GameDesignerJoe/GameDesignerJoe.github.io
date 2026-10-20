// node stealth/tools/shots.mjs <outDir> [floor...]   (floors: '3 9 16' or '3,9,16'; default 1 4 8)
// Serves the repo, opens the game in headless Chromium at phone and desktop sizes, and saves
// screenshots of the title, a floor intro, play, the map view, a suspicious guard and a chase.
// Prints console errors and the frame rate.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // run with NODE_PATH=$(npm root -g)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const out = path.resolve(process.argv[2] || 'shots');
// floors as separate words or comma-separated ('3 9 16' or '3,9,16'); anything that isn't a floor is an error, not a silent default
const floorArgs = process.argv.slice(3).flatMap(a => a.split(/[,\s]+/)).filter(a => a !== '');
const floors = floorArgs.map(Number);
if (floors.some(n => !Number.isInteger(n) || n < 1)) { console.error(`bad floors argument: ${process.argv.slice(3).join(' ')} (want e.g. 3 9 16 or 3,9,16)`); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);
const url = `http://localhost:${srv.address().port}/stealth/index.html`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch());
const errors = [];
const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function run(name, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await page.goto(url); await wait(1500);
  await page.screenshot({ path: `${out}/${name}-title.png` });
  for (const fl of (floors.length ? floors : [1, 4, 8])) {
    await page.evaluate((n) => { localStorage.clear(); GAME.startFloor(n); }, fl);
    await wait(700);
    await page.screenshot({ path: `${out}/${name}-f${fl}-intro.png` });
    await page.evaluate(() => GAME.skipIntro()); await wait(1200);
    await page.screenshot({ path: `${out}/${name}-f${fl}-play.png` });
    await page.evaluate(() => GAME.setOverview(true)); await wait(1500);
    await page.screenshot({ path: `${out}/${name}-f${fl}-map.png` });
    await page.evaluate(() => GAME.setOverview(false));
    // put the player just inside a guard's cone to show suspicion, then a chase
    const ok = await page.evaluate(() => {
      const g = GAME.guards.find(g => g.kind !== 'sentry') || GAME.guards[0]; if (!g) return false;
      window.__shotG = g;
      const d = 95; GAME.teleport(g.x + Math.cos(g.ang) * d, g.y + Math.sin(g.ang) * d);
      const f = GAME.L.field; if (f.sample(GAME.P.x, GAME.P.y) < 8) { const p = f.nearestFree(GAME.P.x, GAME.P.y, 10, 60); if (p) GAME.teleport(p.x, p.y); }
      GAME.view.x = GAME.P.x; GAME.view.y = GAME.P.y; return true;
    });
    if (ok) {
      await wait(350); await page.screenshot({ path: `${out}/${name}-f${fl}-sus.png` });
      // the chase shot waits for the chase itself (the meter takes 1.4s or more to fill), up to 4s
      await page.waitForFunction(() => window.__shotG.state === 'chase', null, { timeout: 4000 }).catch(() => {});
      await wait(150); await page.screenshot({ path: `${out}/${name}-f${fl}-chase.png` });
    }
  }
  const fps = await page.evaluate(() => GAME.fps);
  console.log(name, 'fps', fps.toFixed(1));
  await ctx.close();
}
await run('phone', { width: 390, height: 844 }, true);
await run('land', { width: 844, height: 390 }, true);
await run('desk', { width: 1600, height: 900 }, false);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close(); srv.close();
