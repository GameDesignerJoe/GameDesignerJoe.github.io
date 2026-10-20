// Falling / blowing snow in screen space, three depth layers with parallax:
//   far  — fine streaks just above the ground, move almost with the land
//   mid  — small flakes
//   near — a few big soft out-of-focus flakes close to the lens
// Driven by the wind (and the gust field at each flake's ground position), with a
// cheap curl-noise swirl so it never reads as uniform rain. Counts scale with screen
// area and are capped for phones.
import { state } from '../state.js';
import { gustFast, director } from './weather-director.js';

let T;
const LAYERS = [
  { name: 'far',  dens: 1 / 2300,  cap: 360, size: [0.8, 1.3], speed: 0.5,  fall: 22, par: 1.0,  streak: 0.04, alpha: 0.85, turb: 0.8 },
  { name: 'mid',  dens: 1 / 7000,  cap: 150, size: [1.5, 2.3], speed: 0.8,  fall: 45, par: 1.35, streak: 0.045, alpha: 0.9, turb: 1.0 },
  { name: 'near', dens: 1 / 22000, cap: 34,  size: [10, 34],   speed: 1.35, fall: 90, par: 2.2,  streak: 0.02, alpha: 0.8, turb: 1.4 },
];
const lastCam = { x: 0, y: 0, set: false };

function reset(p, L, w, h) {
  p.x = Math.random() * w; p.y = Math.random() * h;
  p.s = L.size[0] + Math.random() * (L.size[1] - L.size[0]);
  p.k = 0.75 + Math.random() * 0.5;       // per-flake speed variation
  p.ph = Math.random() * Math.PI * 2;
  p.len = 0.3 + Math.pow(Math.random(), 2.2) * 2.7; // 0.3..3x, mostly short
  p.wb = Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2; // width bucket
  p.vx = 0; p.vy = 0;
}

export function init(textures) {
  T = textures;
  for (const L of LAYERS) {
    L.p = [];
    for (let i = 0; i < L.cap; i++) { const p = {}; reset(p, L, innerWidth, innerHeight); L.p.push(p); }
  }
}

export function update(dt) {
  const { w, h } = state.view, cam = state.cam, z = cam.zoom || 1, t = state.time;
  const dx = lastCam.set ? (cam.x - lastCam.x) * z : 0, dy = lastCam.set ? (cam.y - lastCam.y) * z : 0;
  lastCam.x = cam.x; lastCam.y = cam.y; lastCam.set = true;
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a);
  const area = w * h, snow = state.weather.snowfall, W0 = state.wind.speed;
  const m = 40;

  for (const L of LAYERS) {
    // Active count: area based, capped, scaled by snowfall (a little always blows about in wind).
    // Near flakes are reserved for heavy snow; only a handful otherwise.
    const amount = L.name === 'near' ? Math.max(0.06, Math.min(1, (snow - 0.55) / 0.4)) : Math.min(1, Math.max(snow, W0 * 0.35));
    // Small screens get a denser fill per pixel (they're held closer to the eye).
    const boost = 1 + Math.max(0, Math.min(0.6, (700000 - area) / 700000));
    L.n = Math.min(Math.round(L.cap * director.quality), Math.round(area * L.dens * boost * Math.pow(amount, 0.85)));
    for (let i = 0; i < L.n; i++) {
      const p = L.p[i];
      // Wind at this flake's ground position (far layers feel the gust fronts locally).
      const g = L.name === 'near' ? state.wind.gust : gustFast(cam.x + (p.x - w / 2) / z, cam.y + (p.y - h / 2) / z);
      const W = W0 + g * 0.45;
      const sp = (30 + 560 * W * W + 120 * W) * L.speed * p.k;
      // Curl of psi = A sin(x f1 + t) cos(y f2 - t) + B sin(x f3 - y f4 + t): divergence-free swirl.
      const f1 = 0.009, f2 = 0.011, f3 = 0.021, f4 = 0.017;
      const X = p.x + p.ph * 30, Y = p.y;
      const A = 1, B = 0.6;
      const sa = Math.sin(X * f1 + t * 0.6), ca = Math.cos(X * f1 + t * 0.6);
      const sb = Math.sin(Y * f2 - t * 0.45), cb = Math.cos(Y * f2 - t * 0.45);
      const cc = Math.cos(X * f3 - Y * f4 + t * 1.1);
      const dpsidy = -A * sa * sb * f2 - B * cc * f4;
      const dpsidx = A * ca * cb * f1 + B * cc * f3;
      const turb = (2200 + 5200 * W) * L.turb;
      const tvx = c * sp + dpsidy * turb, tvy = s * sp + L.fall * p.k - dpsidx * turb;
      const k = Math.min(1, dt * 4);
      p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
      p.x += p.vx * dt - dx * L.par;
      p.y += p.vy * dt - dy * L.par;
      if (p.x < -m) p.x += w + 2 * m; else if (p.x > w + m) p.x -= w + 2 * m;
      if (p.y < -m) p.y += h + 2 * m; else if (p.y > h + m) p.y -= h + 2 * m;
    }
  }
}

// Streaks as tapered slivers (round-ish head, needle tail), filled in three width
// buckets: no per-frame allocation, no stroking.
const WIDTH_K = [0.6, 1, 1.6];
function sliverPath(ctx, L, bucket, ox, oy) {
  const lw = (L.size[0] + L.size[1]) / 2 * WIDTH_K[bucket] * 0.5;
  ctx.beginPath();
  for (let i = 0; i < L.n; i++) {
    const p = L.p[i];
    if (p.wb !== bucket) continue;
    const vx = p.vx, vy = p.vy, sp = Math.hypot(vx, vy) || 1;
    const ux = vx / sp, uy = vy / sp;
    const len = Math.max(lw * 2.2, sp * L.streak * p.len);
    const hx = p.x + ox, hy = p.y + oy;
    const nx = -uy * lw, ny = ux * lw;
    ctx.moveTo(hx + ux * lw, hy + uy * lw);
    ctx.lineTo(hx + nx, hy + ny);
    ctx.lineTo(hx - ux * len, hy - uy * len);
    ctx.lineTo(hx - nx, hy - ny);
    ctx.closePath();
  }
}

function drawStreaks(ctx, L, shadow) {
  if (!L.n) return;
  for (let b = 0; b < 3; b++) {
    // Faint grey shadow side so flakes read over white snow (skipped in fog).
    if (shadow > 0.02) {
      sliverPath(ctx, L, b, 0.7, 0.9);
      ctx.fillStyle = `rgba(90,95,100,${0.22 * L.alpha * shadow})`;
      ctx.fill();
    }
    sliverPath(ctx, L, b, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${L.alpha * [0.7, 0.9, 1][b]})`;
    ctx.fill();
  }
}

export function drawFar(ctx) { drawStreaks(ctx, LAYERS[0], 1 - state.weather.whiteout); }
// Always white: in a whiteout they read against the darker grey billows of the fog.
export function drawMid(ctx) { drawStreaks(ctx, LAYERS[1], 1 - Math.min(1, state.weather.whiteout * 2)); }

// Big soft out-of-focus flakes right in front of the lens.
export function drawNear(ctx) {
  const L = LAYERS[2];
  for (let i = 0; i < L.n; i++) {
    const p = L.p[i];
    const v = Math.hypot(p.vx, p.vy);
    const stretch = 1 + Math.min(2.5, v * 0.0035);
    const r = p.s;
    const ang = Math.atan2(p.vy, p.vx), c = Math.cos(ang), sn = Math.sin(ang);
    ctx.setTransform(c * state.view.dpr, sn * state.view.dpr, -sn * state.view.dpr, c * state.view.dpr, p.x * state.view.dpr, p.y * state.view.dpr);
    ctx.globalAlpha = L.alpha * (0.65 + 0.35 * Math.sin(p.ph + state.time * 0.7));
    ctx.drawImage(T.flake, -r * stretch, -r, r * 2 * stretch, r * 2);
  }
  const d = state.view.dpr;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.globalAlpha = 1;
}
