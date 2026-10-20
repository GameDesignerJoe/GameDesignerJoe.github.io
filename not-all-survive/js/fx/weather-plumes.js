// Snow blowing off rock: banners of spindrift peeling off snow-topped rock edges
// downwind in strong wind (the classic banner off a summit or cliff top).
// Emitters: the top edge of a rock face with snow lying on it (rock below snow in this
// oblique view), chosen on screen and spread apart, re-scanned about once a second and
// kept stable between scans. 3-6 banners when the wind is above ~0.6.
// Each banner is drawn as a stream of soft puffs flowing along a curved path 40-80
// screen px long: dense and bright at the lip (alpha ~0.6), swelling, lifting and
// thinning into a soft trailing tail. Deterministic (no particles), so it's cheap.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import * as terrain from '../world/terrain.js';
import { director, gustFast } from './weather-director.js';

const ROCK = 4, ICE = 2, THIN = 3;
const STEP = 8;
const MAX_EMIT = 6;
const PUFFS = 22;          // puffs along one banner
let T;
let emitters = [];
let scanClock = 0;

export function init(textures) {
  T = textures;
  state.weather.plumeStats = () => emitters.map(e => [Math.round(e.x), Math.round(e.y), +e.str.toFixed(2)]);
}

const hash = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };

function scan() {
  if (!terrain.classAt) return;
  const r = visibleRect(-25);
  const i0 = Math.ceil(r.x0 / STEP), i1 = Math.floor(r.x1 / STEP);
  const j0 = Math.ceil(r.y0 / STEP), j1 = Math.floor(r.y1 / STEP);
  const cand = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = i * STEP, y = j * STEP;
    if (terrain.classAt(x, y) !== ROCK) continue;
    const above = terrain.classAt(x, y - 6);
    if (above === ROCK || above === ICE || above === THIN) continue;     // snow lying on top
    if (terrain.classAt(x, y + 8) !== ROCK || terrain.classAt(x, y + 16) !== ROCK) continue; // a real face
    if (Math.hypot(x - state.player.x, y - state.player.y) < 25) continue;
    cand.push({ x, y: y - 4, score: hash(i, j) + (terrain.exposureAt ? terrain.exposureAt(x, y - 6) * 0.6 : 0) });
  }
  cand.sort((a, b) => b.score - a.score);
  const z = state.cam.zoom || 1, minD = 70 / z;
  const out = [];
  for (const c of cand) {
    if (out.length >= MAX_EMIT) break;
    if (out.some(o => Math.hypot(o.x - c.x, o.y - c.y) < minD)) continue;
    const prev = emitters.find(e => e.x === c.x && e.y === c.y);
    out.push(prev || { x: c.x, y: c.y, ph: Math.random() * 10, lenK: Math.random(), str: -1, scroll: Math.random() });
  }
  emitters = out;
}

export function update(dt) {
  if (!state.cam.zoom) return;
  scanClock -= dt;
  if (scanClock <= 0) { scan(); scanClock = 1; }
  const W = state.wind.speed;
  for (const e of emitters) {
    const g = gustFast(e.x, e.y);
    const tgt = Math.max(0, Math.min(1, (W + g * 0.4 - 0.55) / 0.3)) * (0.8 + 0.2 * Math.sin(state.time * 0.8 + e.ph));
    e.str = e.str < 0 ? tgt : e.str + (tgt - e.str) * Math.min(1, dt * 1.5);
    e.scroll = (e.scroll + dt * (0.55 + 0.6 * W + 0.4 * g)) % 1;
  }
}

export function drawSky(ctx) {
  const z = state.cam.zoom || 1;
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a);
  const t = state.time;
  for (let pass = 0; pass < 2; pass++) {
    for (const e of emitters) {
      if (e.str < 0.05) continue;
      const L = (55 + 45 * e.lenK) / z * (0.6 + 0.4 * e.str);   // ~40-100 screen px
      for (let i = 0; i < PUFFS; i++) {
        // Position along the banner: puffs stream outward and recycle at the lip.
        const u = (i / PUFFS + e.scroll) % 1;
        // Path: downwind, lifting slightly off the lip, with a lazy wave.
        const lift = -u * u * L * 0.18;
        // Each puff wanders off the centre line a little (fixed per puff slot), so the
        // banner is ragged and billowing rather than a smooth stroke.
        const jit = (Math.sin(i * 91.7 + e.ph * 13) * 0.5) * u * L * 0.22;
        const wave = Math.sin(u * 5 + t * 1.7 + e.ph) * u * L * 0.08 + jit;
        const px = e.x + c * u * L - s * wave, py = e.y + s * u * L + c * wave + lift;
        const r = (2 + u * 11) / z * 2.2 * (0.7 + 0.3 * e.str) * (0.75 + 0.5 * Math.abs(Math.sin(i * 37.3 + e.ph)));
        const len = r * (1.8 + u * 1.5);
        const al = e.str * Math.min(1, u * 12) * Math.pow(1 - u, 1.2) * 0.9;
        if (al < 0.01) continue;
        ctx.save();
        ctx.translate(px, py);
        ctx.transform(c, s, -s, c, 0, 0);
        if (pass === 0) {
          // Cel-shaded underside (light from the upper left) so it reads over snow.
          ctx.globalAlpha = al * 0.75;
          ctx.drawImage(T.billowShade, -len * 0.9 + r * 0.35, -r * 0.9 + r * 0.5, len * 1.8, r * 1.8);
        } else {
          ctx.globalAlpha = al;
          ctx.drawImage(T.flake, -len, -r, len * 2, r * 2);
        }
        ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1;
}
