#!/usr/bin/env node
// Count what the game actually plays, at the AUDIO API level, so two builds can
// be compared on the same scripted run.
//
//   node maze/tools/audio-ab.mjs --port 8765 [--phase 0]
//
// No --autoplay-policy override: the AudioContext starts suspended and is
// unlocked by the tap on the sleeper, the way it happens on a phone.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8765));
const PHASE = Number(arg('phase', 0));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],   // deliberately NOT disabling the autoplay policy
});
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true });

// Count oscillators as a proxy for musical notes, before any page script runs.
await ctx.addInitScript(() => {
  window.__osc = 0; window.__ctxState = [];
  const N = window.AudioContext || window.webkitAudioContext;
  if (!N) return;
  class P extends N {
    constructor(...a) {
      super(...a);
      window.__ctxState.push('created:' + this.state);
      const o = this.createOscillator.bind(this);
      this.createOscillator = (...b) => { window.__osc++; return o(...b); };
      const g = this.createBufferSource.bind(this);
      this.createBufferSource = (...b) => { window.__osc += 0; return g(...b); };
    }
  }
  window.AudioContext = P; window.webkitAudioContext = P;
});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));

await page.goto(`http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=4242`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

// Force the phase we want and restart the run, then wrap AUDIO to count calls.
await page.evaluate((ph) => {
  SAVE.phase = ph; SAVE.stones = 0; SAVE.poolPending = false; SAVE.collected = {}; SAVE.ui = {};
  delete SAVE.run;
  reset(4242);
  window.__calls = {};
  for (const k of Object.keys(AUDIO)) {
    if (typeof AUDIO[k] !== 'function') continue;
    const orig = AUDIO[k].bind(AUDIO);
    AUDIO[k] = (...a) => { window.__calls[k] = (window.__calls[k] || 0) + 1; return orig(...a); };
  }
}, PHASE);

const version = await page.evaluate(() => VERSION);
const who = await page.evaluate(() => phase().who);

const cdp = await ctx.newCDPSession(page);
const touch = (t, x, y) => cdp.send('Input.dispatchTouchEvent',
  { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y }] });

// tap the sleeper — this is the user gesture that unlocks audio
await touch('touchStart', 215, 430);
await touch('touchEnd', 215, 430);
await page.waitForTimeout(4200);

const afterStart = await page.evaluate(() => ({
  osc: window.__osc, calls: { ...window.__calls },
  state: window.__ctxState,
}));

// stand still and let the composer run
await page.waitForTimeout(14000);
const standing = await page.evaluate(() => ({ osc: window.__osc, calls: { ...window.__calls } }));

// now walk
const st = await page.evaluate(() => {
  const r = document.getElementById('stick').getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});
await touch('touchStart', st.cx, st.cy);
for (let i = 0; i < 20; i++) { await touch('touchMove', st.cx, st.cy - 70); await page.waitForTimeout(150); }
await touch('touchEnd', st.cx, st.cy);
await page.waitForTimeout(800);
const walked = await page.evaluate(() => ({
  osc: window.__osc, calls: { ...window.__calls },
  steps, tiles: Math.round(steps),
}));

console.log(`── v${version}  (${who})`);
console.log(`   AudioContext: ${afterStart.state.join(', ') || 'none created'}`);
console.log(`   after the tap + 4s : ${afterStart.osc} oscillators`);
console.log(`   standing 14s more  : ${standing.osc} oscillators  (+${standing.osc - afterStart.osc} while idle = music)`);
console.log(`   after walking      : ${walked.osc} oscillators, ${walked.steps} steps taken`);
const only = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));
console.log(`   AUDIO calls total  : ${JSON.stringify(only(walked.calls))}`);
if (errs.length) console.log('   page errors:', [...new Set(errs)].slice(0, 4));
await browser.close();
