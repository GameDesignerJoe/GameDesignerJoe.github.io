// NODE_PATH=$(npm root -g) node stealth/tools/toast-check.mjs
// The upright danger toast ('Out of the light!') never covers the mark of the guard who is noticing you.
// On a 390x844 touch phone, the player is put in a patrol guard's cone, once with the guard below him on screen and once
// with the guard above, and every poll while the toast shows checks its rect against a 40x40 box round each guard's mark.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await ctx.route(/api\.github\.com/, r => r.abort());
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${srv.address().port}/stealth/index.html`);
await page.waitForFunction(() => window.GAME && GAME.startFloor, null, { timeout: 8000 });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails++; };
const out = process.argv[2];

// below: the guard is down-screen of the player (he faces up, sin(ang) < 0); above: he faces down
for (const side of ['below', 'above']) {
  let gi = -1;
  for (let tries = 0; tries < 12 && gi < 0; tries++) {
    await page.evaluate(([t]) => { localStorage.clear(); GAME.save.hints = {}; if (t) GAME.save.runSeed = (Math.random() * 1e9) >>> 0; GAME.startFloor(2); }, [tries]); await wait(250);
    await page.evaluate(() => GAME.skipIntro()); await wait(150);
    gi = await page.evaluate((sd) => {
      const f = GAME.L.field;
      return GAME.guards.findIndex(g => g.kind !== 'sentry' && (sd === 'below' ? Math.sin(g.ang) < -0.6 : Math.sin(g.ang) > 0.6) && f.ray(g.x, g.y, Math.cos(g.ang), Math.sin(g.ang), 120) > 112);
    }, side);
  }
  if (gi < 0) { check(false, `${side}: no patrol guard facing the right way in 12 runs`); continue; }
  let polls = 0, bad = 0, near = 0, worst = '';
  for (let t = 0; t < 70; t++) {
    const r = await page.evaluate((i) => {
      const g = GAME.guards[i]; GAME.teleport(g.x + Math.cos(g.ang) * 110, g.y + Math.sin(g.ang) * 110);
      const v = GAME.view, W = innerWidth, H = innerHeight, k = Math.min(1.4, Math.max(0.7, v.z));
      const sc = (x, y) => ({ x: (x - v.x) * v.z + W / 2, y: (y - v.y) * v.z + H / 2 });
      const el = document.getElementById('toast'), tr = el.getBoundingClientRect();
      const shown = el.classList.contains('show'), nr = el.classList.contains('near');
      const boxes = [...GAME.guards.map(o => [o, 16]), ...GAME.cams.map(o => [o, 8])].filter(([o]) => o.aw > 0 || o.bubble || o.state === 'chase').map(([o, h]) => {
        const s = sc(o.x, o.y), x = s.x + (o.mx || 0), y = s.y - (h + 14) * k + (o.my || 0); return { l: x - 20, r: x + 20, t: y - 20, b: y + 20 };
      });
      const p = sc(GAME.P.x, GAME.P.y), gs = sc(g.x, g.y);
      const hit = shown && boxes.some(b => tr.left < b.r && tr.right > b.l && tr.top < b.b && tr.bottom > b.t);
      return { shown, nr, hit, st: g.state, dy: Math.round(gs.y - p.y), tt: Math.round(tr.top), py: Math.round(p.y), caught: GAME.mode !== 'play' };
    }, gi);
    if (r.caught) break;
    if (r.shown && r.nr) { polls++; near++; if (r.hit) { bad++; worst = `toast top ${r.tt}, player y ${r.py}, guard dy ${r.dy}`; } }
    if (polls === 1 && out) await page.screenshot({ path: `${out}/toast-${side}.png` });
    if (polls > 0 && r.st === 'chase') break;
    await wait(50);
  }
  if (out) await page.screenshot({ path: `${out}/toast-${side}-late.png` });
  check(near > 3, `${side}: the 'near' danger toast showed (${near} polls)`);
  check(bad === 0, `${side}: toast clear of every mark (${bad}/${polls} polls overlapped${worst ? '; ' + worst : ''})`);
}
check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `${fails} FAIL` : 'all PASS');
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
