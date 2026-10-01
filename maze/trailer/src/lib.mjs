import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const S = process.env.WORK || new URL('../work', import.meta.url).pathname;
export async function openGame(seed, { w = 1920, h = 1080, res = 540, wake = false } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
  await p.addInitScript(() => { try { localStorage.setItem('maze.fp.training', JSON.stringify({ move:1, chalk:1, door:1, closet:1, switch:1, squeeze:1, throw:1, page:1 })); } catch (e) {} });
  await p.clock.install();
  await p.goto(`http://127.0.0.1:8765/maze/maze-fp.html?seed=${seed}`, { waitUntil: 'load' });
  await p.addStyleTag({ content: '#gear,#stick,#hud,#mini,#mapBtn,#dbgArrow,#hint,#fps,#bigmap,#getUp,#stepOut,#bookLine{display:none!important} body{cursor:none}' });
  await p.evaluate((res) => { FP.S.showPath = false; FP.S.showArrow = false; FP.S.res = res; dispatchEvent(new Event('resize')); }, res);
  if (!wake) { await p.clock.runFor(800); await p.keyboard.press('Escape'); await p.clock.runFor(6000); }
  return { browser, p };
}
