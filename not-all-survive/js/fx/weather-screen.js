// Screen treatment (screen space, CSS pixels):
//   dimming, the whiteout (layered moving fog in a quarter-res buffer, with a shrinking
//   pocket of visibility around the explorer; screen edges go first), cold vignette
//   to pale grey, frost crystals creeping in from the corners, paper grain, gust shake.
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { director } from './weather-director.js';
import { canvas, qRes } from './weather-noise.js';
import { drawFrost } from './weather-frost.js';

let T, fog, fctx, fogPat = null, greyPat = null, streakPat = null;
let frost = 0, wU = 0, wV = 0, lastT = 0, grainX = 0, grainY = 0, grainClock = 0, bodyCold = 0;
const clamp01 = v => Math.max(0, Math.min(1, v));
const FOG = '236,238,240';

let grainPat = null, grainCtx = null;
const JIT = 8;
// One screen-sized canvas holding the vignette and the grain (CSS px, capped area).
export function init(textures) { T = textures; }

export function update(dt) {
  // Frost creeps in slowly with exposure and storm, retreats more slowly still.
  const expo = Math.max(state.player.exposure || 0, director.localExposure || 0);
  // Sheltered in the lee of rock: frost recedes (faster the deeper the shelter).
  const sh = director.shelter || 0;
  // Exposure in wind grows it, and so does plain cold: a calm, clear night creeps frost
  // in from the corners on its own, receding again by day.
  const coldF = clamp01((state.weather.cold - 0.4) / 0.35);
  // The explorer's own chill (body.js warmth) creeps it in further, and shelter doesn't
  // push that part back: ~0.2 at warmth 0.7, ~0.6 at 0.4, nearly all the way at 0.15.
  // Inside the tent it all melts away.
  const inside = state.player.mode === 'inside' || state.player.mode === 'gone';
  bodyCold = inside ? 0 : clamp01((0.88 - (state.body ? state.body.warmth : 1)) / 0.78);
  const target = inside ? 0 : clamp01(Math.max(clamp01(Math.max(expo * 0.55 + state.weather.whiteout * 0.5 + director.storminess * 0.2 - 0.12, coldF) * (1 - sh * 0.85)), bodyCold));
  if (lastT === 0 && state.params.has('frostnow')) frost = target;
  else if (state.body?.phase === 'black') frost = Math.min(frost, target);   // a new expedition member: fresh eyes
  else if (lastT === 0 && state.params.get('weather') && state.params.get('weather') !== 'cycle') frost = Math.min(target, 0.45);
  const fa = director.frontier || 0;
  const rate = inside ? 0.3 : target > frost ? 0.11 + fa * 0.6 + bodyCold * 0.15 : 0.04 + sh * 0.12;
  frost += (target - frost) * Math.min(1, dt * rate);
  if (target > frost) frost = Math.min(target, frost + dt * 0.012); // keeps creeping, never stalls

  // Camera shake only on strong gusts; a couple of px at most.
  const g = state.wind.gust, W = state.wind.speed;
  // ...plus a 1-2 px jolt when a gust front slams into the explorer.
  const amp = (Math.max(0, g * W - 0.35) * 2.6 + director.hitShake * director.hitShake * 1.8 + (director.frontierEsc || 0) * 1.6) * (1 - (director.shelter || 0));
  const t = state.time;
  state.cam.shakeX = amp * (Math.sin(t * 23.1) * 0.6 + Math.sin(t * 37.7 + 1) * 0.4);
  state.cam.shakeY = amp * 0.6 * (Math.sin(t * 19.3 + 2) * 0.6 + Math.sin(t * 41.9) * 0.4);
}

function ensureFog() {
  const { w, h } = state.view;
  // Big enough (>256x256 area) to stay a GPU canvas; scaled by quality.
  const sc = Math.max(Math.min(0.34, 440 / Math.max(w, h)) * qRes(), Math.sqrt(70000 / (w * h)));
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
  wU += (40 + 160 * Wd) * dt * (1 + (director.frontierEsc || 0)); wV += 6 * dt;
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
  // At the peak the world goes almost pure white (the grey billows thin out too).
  const peak = Math.max(0, Math.min(1, (f - 0.7) / 0.3));
  g.fillStyle = `rgba(${FOG},${Math.pow(f, 1.5) * 0.72 + peak * 0.2})`;
  g.fillRect(0, 0, fw, fh);
  const cam = state.cam;
  const layers = [
    [fogPat, 256, 256, 1.0, 1.0, 3.2, 0.8],
    [greyPat, 256, 256, 1.3, 1.8, 2.2, 0.9 * (1 - 0.55 * peak)],
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

  if (peak > 0) {
    g.globalAlpha = 1;
    g.fillStyle = `rgba(244,245,246,${peak * 0.55})`;
    g.fillRect(0, 0, fw, fh);
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
  const R1 = (diag * 0.75 * (1 - ff) + (34 * z * (1 - peak) + 85 * peak) * ff) * sc * (1 + 1.2 * (director.shelter || 0));
  const R0 = R1 * 0.12;
  g.globalCompositeOperation = 'destination-out';
  const rg = g.createRadialGradient(p.x * sc, p.y * sc, R0, p.x * sc, p.y * sc, R1);
  const clear = 1 - f * 0.45;
  rg.addColorStop(0, `rgba(0,0,0,${clear})`);
  rg.addColorStop(0.5, `rgba(0,0,0,${clear * 0.55})`);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, fw, fh);
  // Hunkered in the lee of rock: a pocket of relief ~120 px around the explorer.
  const sh = director.shelter || 0;
  if (sh > 0.02) {
    const R = 170 * sc;
    const pg = g.createRadialGradient(p.x * sc, p.y * sc, 0, p.x * sc, p.y * sc, R);
    pg.addColorStop(0, `rgba(0,0,0,${0.7 * sh})`);
    pg.addColorStop(0.65, `rgba(0,0,0,${0.5 * sh})`);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pg;
    g.fillRect(0, 0, fw, fh);
  }
  g.globalCompositeOperation = 'source-over';

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fog, 0, 0, w, h);
}

// Cold vignette: to pale grey, not black (drawn into the shared atmosphere buffer).
export function drawVignette(ctx) {
  const { w, h } = state.view;
  // as the explorer chills the pale vignette gives way to ink (body.js darkens the edges):
  // pale grey would vanish in a white-out
  ctx.globalAlpha = clamp01(0.5 + director.storminess * 0.3 + state.weather.whiteout * 0.2) * (1 - 0.75 * bodyCold);
  ctx.drawImage(T.vignette, -w * 0.06, -h * 0.06, w * 1.12, h * 1.12);
  ctx.globalAlpha = 1;
}

// Frost on the lens: drawn after the night grade (main.js drawOverlay), so it stays
// pale at night, with a slight cool-blue tint so it still belongs to the scene.
export function drawFrostOverlay(ctx) {
  if ((state.params.get('wxoff') || '').includes('frost')) return;
  drawFrost(ctx, frost, state.lighting?.night || 0);
}

export function drawFinish(ctx) {
  const { w, h } = state.view;
  const st = director.storminess, wo = state.weather.whiteout;

  // Cold vignette (to pale grey, not black) and paper grain, baked into one layer and
  // jittered a few px at ~12 fps like film. Dropped entirely on slow devices.
  const wxoff = state.params.get('wxoff') || '';
  if (director.quality >= 0.85 && (state.quality?.level ?? 'high') === 'high' && !wxoff.includes('grain')) {
    // A repeating pattern straight from the (GPU) grain bitmap: no screen-sized canvas.
    if (!grainPat || grainCtx !== ctx) { grainCtx = ctx; grainPat = ctx.createPattern(T.grain, 'repeat'); }
    grainClock += state.dt;
    if (grainClock > 0.08) { grainClock = 0; grainX = Math.random() * 128; grainY = Math.random() * 128; }
    ctx.save();
    ctx.globalAlpha = 0.36;
    ctx.translate(-grainX, -grainY);
    ctx.fillStyle = grainPat;
    ctx.fillRect(0, 0, w + 128, h + 128);
    ctx.restore();
  }

  // Frost creeping in along the screen edges from the corners: cross-fade through the
  // growth stages; each corner a little ahead or behind the others.


}
