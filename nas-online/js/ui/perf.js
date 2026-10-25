// Performance tracking: real frame rate, CPU time per frame and per system, plus a
// quality level that caps render resolution. main.js times each system through
// track(); the overlay (toggled from the gear menu, or ?perf) shows the results.
//
// state.perf    = { fps, frameMs, cpuMs, worstMs, longFrames, systems: { name: ms } }
// state.quality = { level: 'high'|'medium'|'low', mode: 'auto'|'fixed', dprCap }
// Systems may read state.quality.level to thin out their own work.
import { state } from '../state.js';

// dprCap is the render resolution in canvas pixels per CSS pixel. Below 1 the canvas is
// smaller than the screen and the browser upscales it; the painting is soft enough that
// it barely shows, and it is the single biggest saving on fill-bound phones.
// maxPixels caps the total canvas size regardless of screen: huge displays (4K
// monitors, iPads) otherwise push the screen-sized weather buffers past a GPU memory
// cliff where frame time explodes.
const LEVELS = {
  high: { dprCap: 2, maxPixels: 3.7e6 },
  medium: { dprCap: 1.25, maxPixels: 2.4e6 },
  low: { dprCap: 0.8, maxPixels: 1.4e6 },
};
const ORDER = ['high', 'medium', 'low'];
const STORE = 'naso.quality';

// Phones and small-core machines start one notch down; auto mode only ever steps down.
function initialLevel() {
  const forced = state.params.get('quality');
  if (forced && LEVELS[forced]) return { level: forced, mode: 'fixed' };
  const saved = localStorage.getItem(STORE);
  if (saved && LEVELS[saved]) return { level: saved, mode: 'fixed' };
  const phone = matchMedia('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4;
  return { level: phone || weak ? 'medium' : 'high', mode: 'auto' };
}

const q0 = initialLevel();
state.quality = { ...q0, dprCap: LEVELS[q0.level].dprCap };
export const maxPixels = () => LEVELS[state.quality.level].maxPixels;
state.perf = { fps: 0, frameMs: 0, cpuMs: 0, worstMs: 0, longFrames: 0, systems: {} };

export function setQuality(level) {
  if (level === 'auto') {
    localStorage.removeItem(STORE);
    const q = initialLevel();
    Object.assign(state.quality, q, { dprCap: LEVELS[q.level].dprCap });
  } else {
    localStorage.setItem(STORE, level);
    Object.assign(state.quality, { level, mode: 'fixed', dprCap: LEVELS[level].dprCap });
  }
  onQualityChange?.();
}
let onQualityChange = null;
export function onQuality(fn) { onQualityChange = fn; }

// --- timing ---------------------------------------------------------------------------
const sysAcc = {};          // name -> ms accumulated this frame
let frameStart = 0;
export function beginFrame() { frameStart = performance.now(); for (const k in sysAcc) sysAcc[k] = 0; }
export function track(name, fn) {
  const t = performance.now();
  try { return fn(); } finally { sysAcc[name] = (sysAcc[name] || 0) + performance.now() - t; }
}

// Smoothed over ~1 s so the numbers are readable; worst/long counts reset each second.
const ema = {};
let lastStamp = 0, windowStart = 0, frames = 0, worst = 0, longs = 0, slowFor = 0;
const headless = /Headless/.test(navigator.userAgent);

export function endFrame(now) {
  const cpu = performance.now() - frameStart;
  const interval = lastStamp ? now - lastStamp : 16.7;
  lastStamp = now;
  const P = state.perf;
  const k = 0.06;
  P.frameMs += (interval - P.frameMs) * k;
  P.cpuMs += (cpu - P.cpuMs) * k;
  for (const n in sysAcc) ema[n] = (ema[n] ?? sysAcc[n]) + (sysAcc[n] - (ema[n] ?? 0)) * k;
  P.systems = ema;
  frames++;
  worst = Math.max(worst, interval);
  if (interval > 34) longs++;
  if (now - windowStart >= 1000) {
    P.fps = Math.round(frames * 1000 / (now - windowStart));
    P.worstMs = Math.round(worst);
    P.longFrames = longs;
    frames = 0; worst = 0; longs = 0; windowStart = now;
    autoAdjust(P);
  }
}

// Auto quality: after ~3 s under 45 fps, drop a level (never climbs back by itself, to
// avoid oscillating; the player can raise it in the menu).
function autoAdjust(P) {
  if (state.quality.mode !== 'auto' || headless || !state.begun) return;
  slowFor = P.fps < 45 ? slowFor + 1 : 0;
  if (slowFor >= 3) {
    slowFor = 0;
    const i = ORDER.indexOf(state.quality.level);
    if (i < ORDER.length - 1) {
      state.quality.level = ORDER[i + 1];
      state.quality.dprCap = LEVELS[state.quality.level].dprCap;
      onQualityChange?.();
    }
  }
}

// --- overlay --------------------------------------------------------------------------
let box = null, shownAt = 0;
export function showOverlay(on) {
  if (on && !box) {
    box = document.createElement('pre');
    box.id = 'perf';
    document.body.appendChild(box);
  }
  if (box) box.style.display = on ? 'block' : 'none';
  state.perfVisible = on;
}

export function updateOverlay(now) {
  if (!state.perfVisible || !box || now - shownAt < 250) return;
  shownAt = now;
  const P = state.perf, Q = state.quality;
  const rows = Object.entries(P.systems).sort((a, b) => b[1] - a[1])
    .map(([n, ms]) => `${n.padEnd(10)}${ms.toFixed(2).padStart(6)} ms`);
  const c = document.getElementById('game');
  box.textContent =
    `${P.fps} fps   ${P.frameMs.toFixed(1)} ms/frame\n` +
    `cpu ${P.cpuMs.toFixed(1)} ms   worst ${P.worstMs} ms   long ${P.longFrames}/s\n` +
    `quality ${Q.level} (${Q.mode})  canvas ${c.width}x${c.height}\n` +
    `─────────────────────────\n` + rows.join('\n');
}
