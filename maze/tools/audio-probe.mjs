#!/usr/bin/env node
// Record what the game actually does to Web Audio, so two builds can be
// compared. Wraps AudioContext before any page script runs and logs every node
// created, every gain set, and every start/stop.
//
//   node maze/tools/audio-probe.mjs --port 8765 --out cur.json
//
// Headless Chromium has no output device but Web Audio still runs, so the graph
// it builds is real even though nothing is audible.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8765));
const OUT = arg('out', '/tmp/audio.json');
const WALK = argv.includes('--walk');

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true,
});

await ctx.addInitScript(() => {
  window.__audio = { nodes: [], gains: [], starts: [], contexts: 0, errors: [] };
  const L = window.__audio;
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;

  // Tag every AudioParam assignment with the node that owns it.
  function watchParam(param, owner, name) {
    try {
      const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(param), 'value');
      Object.defineProperty(param, 'value', {
        get() { return d.get.call(param); },
        set(v) { L.gains.push({ owner, param: name, set: v }); d.set.call(param, v); },
      });
      for (const m of ['setValueAtTime', 'linearRampToValueAtTime',
        'exponentialRampToValueAtTime', 'setTargetAtTime']) {
        const orig = param[m].bind(param);
        param[m] = (v, ...rest) => { L.gains.push({ owner, param: name, [m]: v }); return orig(v, ...rest); };
      }
    } catch (e) { L.errors.push('param ' + owner + ': ' + e.message); }
  }

  class Probed extends Native {
    constructor(...a) {
      super(...a);
      L.contexts++;
      const self = this;
      const wrap = (method, kind, params) => {
        const orig = self[method].bind(self);
        self[method] = (...args) => {
          let n;
          try { n = orig(...args); } catch (e) { L.errors.push(method + ': ' + e.message); throw e; }
          const id = kind + '#' + L.nodes.length;
          L.nodes.push({ id, kind, type: n.type ?? null, args: args.length ? args : undefined });
          for (const p of params) if (n[p]) watchParam(n[p], id, p);
          if (n.start) {
            const s = n.start.bind(n);
            n.start = (...b) => { L.starts.push({ id, at: b[0] ?? 'now' }); return s(...b); };
          }
          return n;
        };
      };
      wrap('createGain', 'gain', ['gain']);
      wrap('createOscillator', 'osc', ['frequency', 'detune']);
      wrap('createBiquadFilter', 'filter', ['frequency', 'Q', 'gain']);
      wrap('createDelay', 'delay', ['delayTime']);
      wrap('createBufferSource', 'buffer', ['playbackRate']);
      wrap('createStereoPanner', 'panner', ['pan']);
      wrap('createWaveShaper', 'shaper', []);
      wrap('createConvolver', 'convolver', []);
    }
  }
  window.AudioContext = Probed;
  window.webkitAudioContext = Probed;
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });

await page.goto(`http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=4242`, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const cdp = await ctx.newCDPSession(page);
const touch = (t, x, y) => cdp.send('Input.dispatchTouchEvent',
  { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y }] });

// tap the sleeper to begin
await touch('touchStart', 215, 430);
await touch('touchEnd', 215, 430);
await page.waitForTimeout(5000);            // intro, then let the drone come up

if (WALK) {
  const st = await page.evaluate(() => {
    const r = document.getElementById('stick').getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  await touch('touchStart', st.cx, st.cy);
  for (let i = 0; i < 12; i++) { await touch('touchMove', st.cx, st.cy - 70); await page.waitForTimeout(180); }
  await touch('touchEnd', st.cx, st.cy);
  await page.waitForTimeout(1200);
}

const log = await page.evaluate(() => {
  const L = window.__audio;
  const byKind = {};
  for (const n of L.nodes) byKind[n.kind] = (byKind[n.kind] || 0) + 1;
  return {
    version: typeof VERSION !== 'undefined' ? VERSION : null,
    contexts: L.contexts,
    nodeCount: L.nodes.length,
    byKind,
    starts: L.starts.length,
    gainSets: L.gains.length,
    errors: L.errors,
    // the first 40 gain/param moves, in order — the shape of the graph as built
    firstGains: L.gains.slice(0, 40),
    nodes: L.nodes.slice(0, 40),
    droneAlive: (() => { try { return !!AUDIO && true; } catch (e) { return 'no AUDIO'; } })(),
    soundCfg: typeof CONFIG !== 'undefined'
      ? { sound: CONFIG.sound, musicVolume: CONFIG.musicVolume, sfxVolume: CONFIG.sfxVolume } : null,
  };
});

writeFileSync(OUT, JSON.stringify(log, null, 1));
console.log(`v${log.version}  ${log.contexts} AudioContext, ${log.nodeCount} nodes, `
  + `${log.starts} starts, ${log.gainSets} param moves`);
console.log('  by kind:', JSON.stringify(log.byKind));
console.log('  CONFIG:', JSON.stringify(log.soundCfg));
if (log.errors.length) console.log('  audio errors:', log.errors.slice(0, 5));
if (errors.length) console.log('  page errors:', [...new Set(errors)].slice(0, 5));
await browser.close();
