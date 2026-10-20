// Screen treatment (screen space, CSS pixels):
//   dimming, the whiteout (layered moving fog in a quarter-res buffer, with a shrinking
//   pocket of visibility around the explorer; screen edges go first), cold vignette
//   to pale grey, frost crystals creeping in from the corners, paper grain, gust shake.
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { director } from './weather-director.js';
import { canvas, makeFrost, FROST_STAGES } from './weather-noise.js';

let T, fog, fctx, fogPat = null, greyPat = null, streakPat = null;
let frost = 0, wU = 0, wV = 0, lastT = 0, grainX = 0, grainY = 0, grainClock = 0;
const clamp01 = v => Math.max(0, Math.min(1, v));
const FOG = '236,238,240';

let frostSets = null, frostSize = 0;
let finish = null, finishKey = '';
const JIT = 8;
// One screen-sized canvas holding the vignette and the grain (CSS px, capped area).
function ensureFinish() {
  const { w, h } = state.view;
  const key = `${w}x${h}`;
  if (finish && finishKey === key) return;
  finishKey = key;
  const W = w + JIT, H = h + JIT;
  const k = Math.min(1, Math.sqrt(1300000 / (W * H)));
  finish = canvas(W * k, H * k);
  const g = finish.getContext('2d');
  g.drawImage(T.vignette, -W * k * 0.06, -H * k * 0.06, W * k * 1.12, H * k * 1.12);
  g.globalAlpha = 0.6;
  g.fillStyle = g.createPattern(T.grain, 'repeat');
  g.fillRect(0, 0, finish.width, finish.height);
}
export function init(textures) { T = textures; }

// Two frost variants (mirrored into the four corners), built at screen scale so the
// hairlines stay one pixel thin. Rebuilt only if the screen size changes a lot.
function ensureFrost() {
  const S = Math.min(560, Math.round(Math.min(state.view.w, state.view.h) * 0.62));
  if (frostSets && Math.abs(S - frostSize) < 60) return;
  frostSize = S;
  frostSets = [makeFrost(S, 1234), makeFrost(S, 98765)];
}

export function update(dt) {
  // Frost creeps in slowly with exposure and storm, retreats more slowly still.
  const expo = Math.max(state.player.exposure || 0, director.localExposure || 0);
  const target = clamp01(expo * 0.55 + state.weather.whiteout * 0.45 + director.storminess * 0.2 - 0.12);
  if (lastT === 0 && state.params.get('weather') && state.params.get('weather') !== 'cycle') frost = target;
  frost += (target - frost) * Math.min(1, dt * (target > frost ? 0.12 : 0.05));

  // Camera shake only on strong gusts; a couple of px at most.
  const g = state.wind.gust, W = state.wind.speed;
  // ...plus a 1-2 px jolt when a gust front slams into the explorer.
  const amp = Math.max(0, g * W - 0.35) * 2.6 + director.hitShake * director.hitShake * 1.8;
  const t = state.time;
  state.cam.shakeX = amp * (Math.sin(t * 23.1) * 0.6 + Math.sin(t * 37.7 + 1) * 0.4);
  state.cam.shakeY = amp * 0.6 * (Math.sin(t * 19.3 + 2) * 0.6 + Math.sin(t * 41.9) * 0.4);
}

function ensureFog() {
  const { w, h } = state.view;
  const sc = Math.min(0.25, 360 / Math.max(w, h));
  const fw = Math.max(2, Math.round(w * sc)), fh = Math.max(2, Math.round(h * sc));
  if (!fog || fog.width !== fw || fog.height !== fh) {
    fog = canvas(fw, fh);
    fctx = fog.getContext('2d');
    fogPat = fctx.createPattern(T.fog, 'repeat');
    greyPat = fctx.createPattern(T.fogGrey, 'repeat');
    streakPat = fctx.createPattern(T.streak, 'repeat');
  }
}

export function drawDim(ctx) {
  const { w, h } = state.view;
  const light = state.weather.light ?? 1;
  if (light < 0.995) {
    ctx.fillStyle = `rgba(52,56,60,${(1 - light) * 0.75})`;
    ctx.fillRect(0, 0, w, h);
  }
}

export function drawWhiteout(ctx) {
  const { w, h } = state.view, z = state.cam.zoom || 1;
  const dt = Math.max(0, state.time - lastT); lastT = state.time;
  const Wd = state.wind.speed;
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a);
  wU += (40 + 160 * Wd) * dt; wV += 6 * dt;
  const f = state.weather.whiteout;
  if (f < 0.01) return;

  ensureFog();
  const g = fctx, fw = fog.width, fh = fog.height, sc = fw / w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, fw, fh);

  // Base veil + moving fog structure, world-anchored with parallax so the fog streams
  // past instead of sliding with the camera: big white billows, darker grey billows
  // moving faster, and fine wind-driven streaks of snow over it all.
  g.fillStyle = `rgba(${FOG},${Math.pow(f, 1.5) * 0.72})`;
  g.fillRect(0, 0, fw, fh);
  const cam = state.cam;
  const layers = [
    [fogPat, 256, 256, 1.0, 1.0, 3.2, 0.8],
    [greyPat, 256, 256, 1.3, 1.8, 2.2, 0.9],
    [fogPat, 256, 256, 1.7, 2.6, 1.2, 0.5],
    [streakPat, 256, 128, 2.0, 8.0, 2.6, 0.5],
    [streakPat, 256, 128, 2.6, 11.0, 1.5, 0.35],
  ];
  for (const [pat, tw, th, par, spd, size, al] of layers) {
    g.save();
    g.globalAlpha = clamp01(f * 1.2) * al;
    g.scale(sc, sc);
    g.translate(w / 2, h / 2);
    g.rotate(a);
    // Camera position in the wind frame (screen px, with parallax), plus downwind drift.
    const cu = (cam.x * c + cam.y * s) * z * par, cv = (-cam.x * s + cam.y * c) * z * par;
    const TW = tw * size, TH = th * size;
    const ou = ((wU * spd * z - cu) % TW + TW) % TW, ov = ((wV * spd * z - cv) % TH + TH) % TH;
    g.translate(ou, ov);
    g.scale(size, size);
    g.fillStyle = pat;
    const R = Math.hypot(w, h) / size;
    g.fillRect(-R - tw - ou / size, -R - th - ov / size, R * 2 + tw * 2, R * 2 + th * 2);
    g.restore();
  }

  // Storm rolling in: a hard-edged wall sweeps across the screen from upwind in ~4 s,
  // with a dark band of billows riding just behind its leading edge.
  const sweep = director.sweep;
  if (sweep < 1) {
    const half = Math.hypot(fw, fh) / 2;
    const cx = fw / 2, cy = fh / 2;
    const e = -1.15 + sweep * 2.4; // wall position along the wind, in half-diagonals
    const at = k => [cx + c * half * k, cy + s * half * k];
    g.globalCompositeOperation = 'destination-out';
    let [x0, y0] = at(e - 0.03), [x1, y1] = at(e + 0.05);
    let gd = g.createLinearGradient(x0, y0, x1, y1);
    gd.addColorStop(0, 'rgba(0,0,0,0)');
    gd.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gd;
    g.fillRect(0, 0, fw, fh);
    g.globalCompositeOperation = 'source-atop';
    [x0, y0] = at(e - 0.35); [x1, y1] = at(e + 0.02);
    gd = g.createLinearGradient(x0, y0, x1, y1);
    gd.addColorStop(0, 'rgba(168,172,176,0)');
    gd.addColorStop(0.8, 'rgba(168,172,176,0.6)');
    gd.addColorStop(1, 'rgba(236,238,240,0.9)');
    g.fillStyle = gd;
    g.fillRect(0, 0, fw, fh);
  }

  // Pocket of visibility around the explorer. Big at first (only the edges fog),
  // collapsing to a few body-lengths at the peak.
  const p = worldToScreen(state.player.x, state.player.y - 8);
  const diag = Math.hypot(w, h);
  const ff = Math.pow(f, 0.8);
  const R1 = (diag * 0.75 * (1 - ff) + 34 * z * ff) * sc;
  const R0 = R1 * 0.12;
  g.globalCompositeOperation = 'destination-out';
  const rg = g.createRadialGradient(p.x * sc, p.y * sc, R0, p.x * sc, p.y * sc, R1);
  const clear = 1 - f * 0.45;
  rg.addColorStop(0, `rgba(0,0,0,${clear})`);
  rg.addColorStop(0.5, `rgba(0,0,0,${clear * 0.55})`);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, fw, fh);
  g.globalCompositeOperation = 'source-over';

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fog, 0, 0, w, h);
}

export function drawFinish(ctx) {
  const { w, h } = state.view;
  const st = director.storminess, wo = state.weather.whiteout;

  // Cold vignette (to pale grey, not black) and paper grain, baked into one layer and
  // jittered a few px at ~12 fps like film. Dropped entirely on slow devices.
  if (director.quality >= 0.85) {
    ensureFinish();
    grainClock += state.dt;
    if (grainClock > 0.08) { grainClock = 0; grainX = Math.random() * JIT; grainY = Math.random() * JIT; }
    ctx.globalAlpha = clamp01(0.5 + st * 0.3 + wo * 0.2);
    ctx.drawImage(finish, -grainX, -grainY, w + JIT, h + JIT);
    ctx.globalAlpha = 1;
  }

  // Frost creeping in along the screen edges from the corners: cross-fade through the
  // growth stages; each corner a little ahead or behind the others.
  if (frost > 0.03) {
    ensureFrost();
    for (let k = 0; k < 4; k++) {
      const fx = k & 1, fy = k >> 1;
      const amt = clamp01(frost * [1.05, 0.85, 0.95, 1.15][k]) * FROST_STAGES;
      const i0 = Math.floor(amt), t = amt - i0;
      const set = frostSets[(k === 1 || k === 2) ? 1 : 0];
      ctx.save();
      ctx.translate(fx ? w : 0, fy ? h : 0);
      ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
      if (i0 >= 1) { ctx.globalAlpha = 1; ctx.drawImage(set[Math.min(FROST_STAGES, i0) - 1], 0, 0, frostSize, frostSize); }
      if (i0 < FROST_STAGES && t > 0.01) { ctx.globalAlpha = t; ctx.drawImage(set[i0], 0, 0, frostSize, frostSize); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

}
