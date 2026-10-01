// node shoot.mjs <shotname> [--preview]  — renders shots/<name>/0001.jpg…
import { openGame, S } from './lib.mjs';
import fs from 'fs';
import { SHOTS } from './shots.mjs';
const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
const preview = process.argv.includes('--preview');
const FPS = 30;
for (const name of names) {
  const sh = SHOTS[name]; const dir = `${S}/shots/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { browser, p } = await openGame(sh.seed || 4242, { wake: !!sh.wake, res: sh.res || 540 });
  await p.evaluate((keep) => { FP.S.move = 'free'; FP.S.sound = false; if (!keep) FP.doors.forEach((d) => { if (!d.open) { FP.toggleDoor(d); d.t = 1; } }); }, !!sh.keepDoors);
  if (sh.setup) await p.evaluate(sh.setup, sh.arg || null);
  if (sh.pre) await sh.pre(p);
  const N = Math.round(sh.dur * FPS); let done = 0;
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    if (sh.cam) { const c = sh.cam(t); await p.evaluate((c) => { FP.P.x = c.x; FP.P.y = c.y; FP.P.a = c.a; }, c); } else await p.evaluate(() => 0);
    for (const ev of sh.events || []) if (!ev.done && t >= ev.t) { ev.done = true; await (typeof ev.fn === 'function' && ev.node ? ev.fn(p) : p.evaluate(ev.fn, ev.arg || null)); }
    const target = Math.round((i + 1) * 1000 / FPS); await p.clock.runFor(target - done); done = target;
    if (!preview || i % 15 === 0) await p.screenshot({ path: `${dir}/${String(i + 1).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
  }
  await browser.close(); console.log(name, N, 'frames');
}
