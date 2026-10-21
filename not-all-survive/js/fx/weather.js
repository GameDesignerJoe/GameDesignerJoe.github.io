// Weather: wind, spindrift, falling snow, cloud shadows, fog, whiteout, screen frost.
// Owns state.wind and state.weather (see weather-director.js for the spells).
//   ?weather=cycle (default) | calm | wind | storm      ?wind ?snow ?whiteout ?windAngle
// Helpers:
//   weather-director.js  wind model, spells, travelling gust fronts (gustAt / windAt)
//   weather-drift.js     ground spindrift sheets + snaking streamers (drawGround)
//   weather-sky.js       cloud shadows, low fog banks, feet puffs (drawSky)
//   weather-snow.js      falling/blowing snow, 3 parallax layers (drawScreen)
//   weather-screen.js    whiteout, cold vignette, frost, grain, dimming, shake (drawScreen)
//   weather-haze.js      white border haze, the frame of the experience (drawScreen)
//   weather-plumes.js    spindrift banners streaming off rock edges (drawSky)
//   weather-frontier.js  the storm wall over the world-edge border (drawScreen)
//   weather-noise.js     one-time texture generation
import { state } from '../state.js';
import { makeTextures, lowRes } from './weather-noise.js';
import * as director from './weather-director.js';
import * as drift from './weather-drift.js';
import * as sky from './weather-sky.js';
import * as snow from './weather-snow.js';
import * as screen from './weather-screen.js';
import * as haze from './weather-haze.js';
import * as plumes from './weather-plumes.js';
import * as frontier from './weather-frontier.js';

// ?wxoff=drift,sky,snow,fog,finish switches parts off (for profiling).
const off = new Set((state.params.get('wxoff') || '').split(','));

// Per-part CPU timing (EMA, ms) for profiling: NAS.weather.prof
const prof = {};
let atmos = null;
function tm(name, fn) {
  const t0 = performance.now(); fn();
  const d = performance.now() - t0; prof[name] = (prof[name] ?? d) * 0.95 + d * 0.05;
}

export async function init() {
  state.weather.prof = prof;
  state.weather.canvases = () => globalThis.__wxCanvases?.();
  const T = makeTextures();
  // Turn every static texture into an ImageBitmap: it uploads to the GPU once, whereas a
  // (small, CPU-backed) canvas source can be re-snapshotted on every draw. This alone
  // was most of the weather's frame cost.
  if (typeof createImageBitmap === 'function') {
    await Promise.all(Object.keys(T).map(async k => {
      if (T[k] instanceof HTMLCanvasElement) { try { T[k] = await createImageBitmap(T[k]); } catch {} }
    }));
  }
  director.init();
  drift.init(T);
  sky.init(T);
  snow.init(T);
  screen.init(T);
  haze.init(T);
  plumes.init(T);
  frontier.init(T);
}

// Adaptive quality: if real frames run long for a couple of seconds, thin the particle
// counts and drop the vignette/grain layer (down to half). Reacts within ~0.6 s. Never in headless capture runs.
const adaptive = !/Headless/.test(navigator.userAgent) && !state.params.has('wxq');
let lastNow = 0, slow = 0, fast = 0;
function adapt() {
  const now = performance.now(), ms = lastNow ? now - lastNow : 16;
  lastNow = now;
  if (!adaptive || ms > 250) return; // tab switch / hitch
  const D = director.director;
  if (ms > 22) { slow += ms; fast = 0; } else { fast += ms; slow = Math.max(0, slow - ms * 0.5); }
  if (slow > 600) { D.quality = Math.max(0.5, D.quality - 0.15); slow = 0; }
  if (fast > 8000) { D.quality = Math.min(1, D.quality + 0.1); fast = 0; }
}

export function update(dt) {
  adapt();
  tm('u.director', () => director.update(dt));
  tm('u.drift', () => drift.update(dt));
  tm('u.sky', () => sky.update(dt));
  tm('u.snow', () => snow.update(dt));
  tm('u.screen', () => screen.update(dt));
  tm('u.plumes', () => plumes.update(dt));
}

export function drawGround(ctx) { if (!off.has('drift')) tm('drift', () => drift.drawGround(ctx)); }

export function drawSky(ctx) {
  if (!off.has('sky')) tm('sky', () => sky.drawSky(ctx));
  if (!off.has('plumes')) { ctx.save(); tm('plumes', () => plumes.drawSky(ctx)); ctx.restore(); }
}

export function drawOverlay(ctx) { tm('frost', () => screen.drawFrostOverlay(ctx)); }

export function drawScreen(ctx) {
  if (!off.has('snow')) tm('snowFar', () => snow.drawFar(ctx));
  // Every soft full-screen layer (dimming, fog banks, whiteout, border haze, vignette)
  // goes into ONE quarter-res buffer, composited to the screen once.
  tm('atmos', () => {
    atmos = lowRes(atmos, 0.34, 440);
    const g = atmos.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, atmos.c.width, atmos.c.height);
    g.setTransform(atmos.sc, 0, 0, atmos.sc, 0, 0);
    g.imageSmoothingEnabled = true;
    screen.drawDim(g);
    if (!off.has('sky')) { g.save(); sky.drawFogInto(g); g.restore(); }
    if (!off.has('fog')) { g.save(); screen.drawWhiteout(g); g.restore(); }
    if (!off.has('haze')) { g.save(); haze.draw(g); g.restore(); }
    if (!off.has('finish')) screen.drawVignette(g);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(atmos.c, 0, 0, state.view.w, state.view.h);
  });
  if (!off.has('frontier')) tm('frontier', () => frontier.draw(ctx));
  if (!off.has('snow')) tm('snowMid', () => snow.drawMid(ctx));
  if (!off.has('snow')) tm('snowNear', () => snow.drawNear(ctx));
  if (!off.has('finish')) tm('finish', () => screen.drawFinish(ctx));
  if (state.debug) {
    ctx.fillStyle = '#000';
    ctx.font = '12px monospace';
    const W = state.wind, X = state.weather;
    ctx.fillText(`${X.phase} wind ${W.speed.toFixed(2)} gust ${W.gust.toFixed(2)} snow ${X.snowfall.toFixed(2)} white ${X.whiteout.toFixed(2)} light ${X.light.toFixed(2)}`, 10, 18);
  }
}
