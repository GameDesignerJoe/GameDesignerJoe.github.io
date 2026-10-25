// Night: grades the finished frame into the polar night and adds warm lights.
// Runs last (after weather), in screen space. Everything scales with state.lighting.night.
//
// Two full-screen passes, both from small soft buffers built from low-res copies of the
// frame (b = blurred frame value):
//   1. 'multiply' by TONE = b^3 x LIGHT MAP. The steep curve sinks water, rock and cliff
//      shadow to navy-black while snow holds. The light map (1/4 res) is deep blue, darker
//      toward the edges (vignette), and warm where state.lights shine, so light pools on
//      snow and barely touches water. The ink lines survive because they come from the
//      full-res frame being multiplied.
//   2. 'lighter' with LIFT = b^6 x pale periwinkle. Only the brightest areas (snow) get
//      it, which lifts snow to a luminous near-white blue that multiply alone can't
//      reach, while the sea stays a dark void beside it. The aurora is painted into this
//      buffer too, so it costs no extra full-screen pass.
// (Drawing a buffer onto itself, or 'color-burn' / 'color-dodge' levels, would be simpler
// but force a mid-frame GPU sync of over 1 ms at 1440p. Re-reading the main canvas into a
// small buffer does not.)
//
// Lights: { x, y, r, intensity, core? } in world px. No additive core unless core === true.
import { state } from '../state.js';
import { SIGNAL } from '../palette.js';
import { worldToScreen } from '../camera.js';
import { mask } from '../world/terrain.js';

const EASE_S = 3.5;                // time to (nearly) reach the night target
const BLUE = [0.26, 0.44, 0.95];   // multiply colour at full night
const LIFT = [0.42, 0.44, 0.46];   // added to the brightest snow (x b^6): pale periwinkle with the blue
const HALO = 1.5;                  // the pool on the snow spreads past a light's nominal r
const MAX_LIGHTS = 8;              // nearest to the screen centre win
const WARM = [1, 3, 5].map(i => parseInt(SIGNAL.glow.slice(i, i + 2), 16)); // SIGNAL.glow as rgb

// Day/night cycle: DAY_S of daylight, then NIGHT_S of night, repeating. The ease below
// (EASE_S) gives dusk and dawn. ?night / ?day pin it; the gear menu can pin it too.
const DAY_S = 180, NIGHT_S = 120;
const pinned = state.params.has('night') ? 'night' : state.params.has('day') ? 'day' : null;
if (pinned) state.lighting.mode = pinned;
else if (!state.lighting.mode) state.lighting.mode = 'cycle';
state.lighting.clock = 0;   // seconds into the current cycle

export function update(dt) {
  const L = state.lighting;
  if (L.mode === 'cycle') {
    // The clock only runs once the player is in the world, so the title stays daylight.
    if (state.begun || state.params.has('autostart')) L.clock = (L.clock + dt) % (DAY_S + NIGHT_S);
    L.nightTarget = L.clock >= DAY_S ? 1 : 0;
  } else {
    L.nightTarget = L.mode === 'night' ? 1 : 0;
  }
  const d = L.nightTarget - L.night;
  // exponential ease that gets ~95% of the way in EASE_S
  // Dusk and dawn in the cycle are slow (~20 s); a manual switch from the menu is quick.
  const ease = L.mode === 'cycle' ? 20 : EASE_S;
  L.night += Math.abs(d) < 0.002 ? d : d * Math.min(1, dt * 3 / ease);
}

// --- buffers and sprites ------------------------------------------------------------
let glow = null, glowSize = 0;     // warm radial falloff
let core = null;                   // optional additive core (lights with core: true)
let lightMap = null, lmCtx = null, lmKey = '', lmTime = -1;
let toneCanvas = null, tCtx = null;
let liftCanvas = null, lCtx = null;
let aurora = null;
let auroraAmt = -1;

function makeRadial(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  for (const [t, col] of stops) grad.addColorStop(t, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
const warmA = a => `rgba(${WARM[0]},${WARM[1]},${WARM[2]},${a})`;

// A hanging aurora curtain: fine vertical rays dropping from a sinuous lower hem, bright
// at the hem and fading upward, folds brightening and dimming along its length. Pale
// cold green (biased yellow-ward, since it is added over blue). Tiles horizontally.
function makeAurora() {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const TAU = Math.PI * 2;
  const hem = x => H * (0.62 + 0.14 * Math.sin(x / W * TAU * 2 + 0.6) + 0.06 * Math.sin(x / W * TAU * 5 + 2));
  const fold = x => Math.max(0, 0.55 + 0.45 * Math.sin(x / W * TAU * 3 + 1) * Math.sin(x / W * TAU * 7 + 0.3)
    + 0.25 * Math.sin(x / W * TAU * 19));
  for (let x = 0; x < W; x += 1) {
    const y = hem(x), len = H * (0.25 + 0.3 * fold(x)), a = 0.3 * fold(x);
    if (a < 0.01) continue;
    const grad = g.createLinearGradient(0, y - len, 0, y + 2);
    grad.addColorStop(0, 'rgba(100,255,120,0)');
    grad.addColorStop(0.75, `rgba(110,255,130,${a * 0.6})`);
    grad.addColorStop(0.95, `rgba(170,255,170,${a})`);
    grad.addColorStop(1, 'rgba(190,255,190,0)');
    g.fillStyle = grad;
    g.fillRect(x, y - len, 1, len + 2);
  }
  return c;
}

function buffer(cnv, w, h) {
  if (!cnv) cnv = document.createElement('canvas');
  if (cnv.width !== w || cnv.height !== h) { cnv.width = w; cnv.height = h; }
  return cnv;
}

function ensure() {
  const low = state.quality.level === 'low';
  const want = low ? 64 : 128;
  if (glowSize !== want) {
    glow = makeRadial(want, [[0, warmA(1)], [0.15, warmA(0.8)], [0.35, warmA(0.5)], [0.6, warmA(0.24)], [0.85, warmA(0.07)], [1, warmA(0)]]);
    core = makeRadial(want, [[0, 'rgba(255,236,190,0.9)'], [0.25, 'rgba(255,190,90,0.45)'], [0.6, 'rgba(230,140,40,0.12)'], [1, 'rgba(200,110,30,0)']]);
    glowSize = want;
  }
  const { w, h } = state.view;
  const div = low ? 6 : 4, tdiv = low ? 4 : 3;
  lightMap = buffer(lightMap, Math.max(8, Math.ceil(w / div)), Math.max(8, Math.ceil(h / div)));
  toneCanvas = buffer(toneCanvas, Math.max(8, Math.ceil(w / tdiv)), Math.max(8, Math.ceil(h / tdiv)));
  liftCanvas = buffer(liftCanvas, toneCanvas.width, toneCanvas.height);
  lmCtx = lightMap.getContext('2d'); tCtx = toneCanvas.getContext('2d'); lCtx = liftCanvas.getContext('2d');
}

const mix = (a, b, t) => a + (b - a) * t;
const rgb = (r, g, b) => `rgb(${Math.round(Math.max(0, Math.min(255, r)))},${Math.round(Math.max(0, Math.min(255, g)))},${Math.round(Math.max(0, Math.min(255, b)))})`;

// Visible lights in screen px, nearest the centre first, capped.
function visibleLights(w, h, zoom, white) {
  const out = [];
  for (const l of state.lights) {
    const s = worldToScreen(l.x, l.y);
    const r = l.r * zoom * HALO * (1 - 0.4 * white);
    if (s.x + r < 0 || s.y + r < 0 || s.x - r > w || s.y - r > h) continue;
    out.push({ x: s.x, y: s.y, r, r0: l.r * zoom, k: l.intensity ?? 1, core: l.core === true, d: Math.hypot(s.x - w / 2, s.y - h / 2) });
  }
  if (out.length > MAX_LIGHTS) { out.sort((a, b) => a.d - b.d); out.length = MAX_LIGHTS; }
  return out;
}

export function drawScreen(ctx) {
  const n = state.lighting.night;
  if (n <= 0.001) { state.lights.length = 0; return; }
  ensure();

  const { w, h, dpr } = state.view;
  const X = state.weather;
  const white = Math.min(1, X.whiteout || 0);
  const snow = Math.min(1, X.snowfall || 0);
  const zoom = state.cam.zoom || 1;
  // A night storm is darker: the veil should read dark blue-grey, not glowing fog.
  const storm = Math.min(1, white * 0.9 + snow * 0.15);
  const dark = 1 - 0.5 * storm;
  const lights = visibleLights(w, h, zoom, white);

  // No light on the explorer by design (Joe: it looked odd; a flashlight may come later).
  const ex = null, er = 0;

  // --- light map: blue base, vignette, warm pools (rebuilt at ~15 Hz or on change) ---
  const lw = lightMap.width, lh = lightMap.height, sx = lw / w, sy = lh / h;
  const key = [Math.round(n * 50), Math.round(storm * 30), Math.round(white * 30),
    ...lights.map(l => `${Math.round(l.x * sx)},${Math.round(l.y * sy)},${Math.round(l.r * sx)},${Math.round(l.k * 30)}`),
    ex ? `${Math.round(ex.x * sx)},${Math.round(ex.y * sy)},${Math.round(er * sx)}` : ''].join('|');
  if (key !== lmKey || state.time - lmTime > 1 / 15) {
    lmKey = key; lmTime = state.time;
    const g = lmCtx;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = rgb(mix(255, BLUE[0] * 255 * dark, n), mix(255, BLUE[1] * 255 * dark, n), mix(255, BLUE[2] * 255 * dark, n));
    g.fillRect(0, 0, lw, lh);
    const vr = Math.hypot(lw, lh) / 2;
    const vg = g.createRadialGradient(lw / 2, lh / 2, vr * 0.35, lw / 2, lh / 2, vr);
    vg.addColorStop(0, 'rgba(4,8,30,0)');
    vg.addColorStop(1, `rgba(4,8,30,${(0.5 + 0.3 * storm) * n})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, lw, lh);
    // warm pools: painted over the blue (not added to it), so the snow they fall on
    // turns cream-yellow rather than washing out to white
    for (const l of lights) {
      g.globalAlpha = Math.min(1, l.k * n * (1 - 0.6 * white));
      g.drawImage(glow, (l.x - l.r) * sx, (l.y - l.r) * sy, 2 * l.r * sx, 2 * l.r * sy);
    }
    if (ex) {
      g.globalAlpha = 0.7 * n;
      g.drawImage(glow, (ex.x - er) * sx, (ex.y - er) * sy, 2 * er * sx, 2 * er * sy);
    }
    g.globalAlpha = 1;
  }

  // --- tone: b^3 ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const tw = toneCanvas.width, th = toneCanvas.height, ts = tw / w;
  tCtx.globalAlpha = 1;
  tCtx.imageSmoothingEnabled = true;
  tCtx.globalCompositeOperation = 'copy';
  tCtx.drawImage(ctx.canvas, 0, 0, tw, th);
  tCtx.globalCompositeOperation = 'multiply';
  tCtx.drawImage(ctx.canvas, 0, 0, tw, th);
  tCtx.drawImage(ctx.canvas, 0, 0, tw, th);

  // --- lift: b^6 x periwinkle, plus the aurora ---
  const L = lCtx, llw = liftCanvas.width, llh = liftCanvas.height;
  L.globalAlpha = 1;
  L.globalCompositeOperation = 'copy';
  L.drawImage(toneCanvas, 0, 0, llw, llh);
  L.globalCompositeOperation = 'multiply';
  L.drawImage(toneCanvas, 0, 0, llw, llh);
  const lk = 255 * n * dark * (1 - 0.6 * white);
  L.fillStyle = rgb(LIFT[0] * lk, LIFT[1] * lk, LIFT[2] * lk);
  L.fillRect(0, 0, llw, llh);
  // the aurora: calm, fairly clear nights
  const wind = state.wind?.speed ?? 0;
  const calm = state.quality.level === 'low' ? 0
    : Math.max(0, Math.min(1, (0.62 - wind) / 0.15)) * Math.max(0, Math.min(1, (0.25 - white) / 0.1)) * Math.max(0.3, 1 - snow * 0.5);
  auroraAmt = auroraAmt < 0 ? calm : auroraAmt + (calm - auroraAmt) * Math.min(1, state.dt * 0.3);
  if (auroraAmt * n > 0.01) {
    L.globalCompositeOperation = 'lighter';
    L.setTransform(llw / w, 0, 0, llh / h, 0, 0);
    drawAurora(L, w, h, auroraAmt * n);
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalAlpha = 1;
  }

  // --- near warm lights the curve lets go (and warms), so lit yellow keeps its colour
  // instead of sinking into olive under the blue: the tent, the explorer's coat ---
  tCtx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const r = l.r0 * ts;
    tCtx.globalAlpha = Math.min(1, l.k * n * 1.5);
    tCtx.drawImage(glow, l.x * ts - r, l.y * ts - r, 2 * r, 2 * r);
  }
  if (ex) {
    const r = er * ts;
    tCtx.globalAlpha = n;
    tCtx.drawImage(glow, ex.x * ts - r, ex.y * ts - r, 2 * r, 2 * r);
  }
  // fade the curve in with the night, then fold in the light map
  tCtx.globalCompositeOperation = 'source-over';
  // (and relax it in a whiteout, where the steep curve would turn the fog's soft
  // clearing around the explorer into a dark ring)
  const relax = 1 - n * (1 - 0.7 * white);
  if (relax > 0.002) { tCtx.globalAlpha = relax; tCtx.fillStyle = '#fff'; tCtx.fillRect(0, 0, tw, th); }
  tCtx.globalAlpha = 1;
  tCtx.globalCompositeOperation = 'multiply';
  tCtx.drawImage(lightMap, 0, 0, tw, th);

  // --- the two full-screen passes ---
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(toneCanvas, 0, 0, cw, ch);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(liftCanvas, 0, 0, cw, ch);

  // --- optional cores (only lights that ask for one) ---
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCampSprites(ctx, n, white);
  drawFigure(ctx, n, white);
  for (const l of lights) {
    if (!l.core) continue;
    const r = l.r0 * 0.35;
    ctx.globalAlpha = Math.min(1, l.k * n * (1 - 0.3 * white));
    ctx.drawImage(core, l.x - r, l.y - r, 2 * r, 2 * r);
  }
  state.lights.length = 0;
}

// The explorer's coat would sink to rusty brown under the blue multiply, and a light on
// him spills onto the snow. Instead the figure itself is drawn again on top, into a small
// offscreen clipped to the body (not the shadow or ground), given its own gentler night
// grade (navy wash that keeps the hue), and laid over the graded frame. The snow around
// him is untouched: no halo. The explorer module is the same instance main.js loaded.
let explorerMod = null, fig = null, figCtx = null;
const onlyP = state.params.get('only');
if (!onlyP || onlyP.split(',').includes('explorer')) import('../actors/explorer.js').then(m => { explorerMod = m; });
let campMod = null;
if (!onlyP || onlyP.split(',').includes('camp')) import('../actors/camp.js').then(m => { campMod = m; });
let campCv = null;
const FIG = { x0: -6, x1: 6, y0: -19, y1: 1 };   // world px box around the feet

// Same test layers.js uses to decide an occluder covers the explorer: a real textured
// rock/cliff face (>= 4 mask px in a column) just below his feet, unless he stands on
// shadow ground. Kept in step with layers.js behindFace().
function behindFace(x, y) {
  const m = mask();
  if (!m) return false;
  const s = m.scale;
  const fi = Math.floor(y / s) * m.w + Math.floor(x / s);
  if (m.cls[fi] === 7) return false;
  const mx0 = Math.floor((x - 1) / s), mx1 = Math.floor((x + 1) / s);
  const my0 = Math.floor((y + 2) / s), my1 = Math.floor((y + 24) / s);
  for (let mx = Math.max(0, mx0); mx <= Math.min(m.w - 1, mx1); mx++) {
    let c = 0;
    for (let my = Math.max(0, my0); my <= Math.min(m.h - 1, my1); my++) {
      const i = my * m.w + mx;
      if (m.occ[i] && m.tex[i]) { if (++c >= 4) return true; } else if (c) c = 0;
    }
  }
  return false;
}

// The sled and the dogs: their own sprites laid back over the graded frame with a navy wash on their pixels
// only (camp.js nightSprites), so they read as dark grey shapes in the moonlight rather than black smudges.
function drawCampSprites(ctx, n, white) {
  const list = campMod?.nightSprites?.();
  if (!list || !list.length) return;
  const a = n * (1 - 0.85 * white) * 0.92;
  if (a < 0.02) return;
  if (!campCv) campCv = document.createElement('canvas');
  const g = campCv.getContext('2d');
  for (const sp of list) {
    const s = worldToScreen(sp.x, sp.y), e = worldToScreen(sp.x + sp.w, sp.y + sp.h);
    const sw = e.x - s.x, sh = e.y - s.y;
    if (sw < 1 || sh < 1 || e.x < 0 || e.y < 0 || s.x > state.view.w || s.y > state.view.h) continue;
    if (campCv.width < sp.cv.width || campCv.height < sp.cv.height) { campCv.width = Math.max(campCv.width, sp.cv.width); campCv.height = Math.max(campCv.height, sp.cv.height); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, sp.cv.width, sp.cv.height);
    g.drawImage(sp.cv, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(14,22,58,0.42)';
    g.fillRect(0, 0, sp.cv.width, sp.cv.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.drawImage(campCv, 0, 0, sp.cv.width, sp.cv.height, s.x, s.y, sw, sh);
  }
  ctx.globalAlpha = 1;
}

function drawFigure(ctx, n, white) {
  const p = state.player;
  if (!explorerMod?.drawables || !p || !state.started) return;
  const a = n * (1 - 0.85 * white);   // a whiteout veils him like everything else
  if (a < 0.02 || behindFace(p.x, p.y)) return;   // behind a cliff: layers.js covers him; don't redraw over it
  const zoom = state.cam.zoom || 1, dpr = state.view.dpr;
  const s = worldToScreen(p.x + FIG.x0, p.y + FIG.y0);
  const fw = Math.ceil((FIG.x1 - FIG.x0) * zoom * dpr), fh = Math.ceil((FIG.y1 - FIG.y0) * zoom * dpr);
  if (!fig) { fig = document.createElement('canvas'); figCtx = fig.getContext('2d'); }
  if (fig.width < fw || fig.height < fh) { fig.width = Math.max(fig.width, fw); fig.height = Math.max(fig.height, fh); }
  const g = figCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, fw, fh);
  // clip to the body: a rounded column from the boots to the hood, so the cast shadow
  // and footprints (lower right of the feet) stay out of it
  g.beginPath();
  g.ellipse(fw / 2, fh * 0.52, fw * 0.36, fh * 0.5, 0, 0, Math.PI * 2);
  g.clip();
  g.setTransform(zoom * dpr, 0, 0, zoom * dpr, -(p.x + FIG.x0) * zoom * dpr, -(p.y + FIG.y0) * zoom * dpr);
  try { for (const d of explorerMod.drawables()) { g.save(); d.draw(g); g.restore(); } } catch { return; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // the figure's own night: a navy wash over its pixels only
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(14,22,58,0.34)';
  g.fillRect(0, 0, fw, fh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = a;
  ctx.drawImage(fig, 0, 0, fw, fh, s.x, s.y, fw / dpr, fh / dpr);
  ctx.globalAlpha = 1;
}

function drawAurora(g, w, h, a) {
  if (!aurora) aurora = makeAurora();
  const t = state.time;
  const bandH = Math.min(h * 0.4, 300);
  const tileW = bandH * 4;
  // two curtains drifting at different speeds, each slowly breathing
  for (let i = 0; i < 2; i++) {
    const off = ((t * (5 + i * 3) + i * tileW * 0.37) % tileW + tileW) % tileW;
    g.globalAlpha = a * (i ? 0.3 : 0.55) * (0.75 + 0.25 * Math.sin(t * (0.23 + i * 0.11) + i * 2));
    const y = -bandH * (0.18 - i * 0.12) + Math.sin(t * 0.09 + i) * bandH * 0.04;
    const sw = tileW * (i ? 0.8 : 1);
    for (let x = -off; x < w; x += sw) g.drawImage(aurora, x, y, sw, bandH);
  }
}
