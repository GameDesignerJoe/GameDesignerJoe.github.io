// The edge storm, as the explorer feels it. It exists ONLY as a function of the
// player's own position (director.frontier = state.frontier.amount): nothing is drawn
// while they're in the safe area, however close the camera is to the map edge. As they
// push into a border it ramps in around them (the director drives the whiteout veil,
// heavy snow, inward wind, frost and haze); this module adds sheets of driven snow
// racing past on the inward wind and wisps blowing across the explorer.
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { canvas } from './weather-noise.js';
import { director } from './weather-director.js';

let T;
let t = 0;
const wisps = [];

export function init(textures) { T = textures; }

const hash = n => { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };

export function draw(ctx) {
  const dt = Math.min(0.1, state.dt);
  t += dt;
  const fa = director.frontier || 0;
  updateWisps(dt, fa);
  if (fa <= 0.01 && !wisps.length) return;
  if (fa > 0.01) drawSheets(ctx, fa);
  drawWisps(ctx);
}

// Wind-driven sheets inside the wall, at full resolution: long thin bright and grey
// streaks racing along the wall (like the whiteout sheets), densest near the torn top.
const SHEETS = 34;
// Sheets are sprites (a tapered sliver bitmap, stretched and placed along the wall),
// kept well inside the torn edge so no clipping path is needed.
let sliver = null;
function sliverSprite() {
  if (sliver) return sliver;
  sliver = canvas(64, 8);
  const g2 = sliver.getContext('2d');
  g2.fillStyle = '#fff';
  g2.beginPath(); g2.moveTo(0, 4); g2.lineTo(56, 1); g2.arc(58, 4, 3, -Math.PI / 2, Math.PI / 2); g2.lineTo(56, 7); g2.closePath(); g2.fill();
  createImageBitmap?.(sliver).then(b => { sliver = b; });
  return sliver;
}
let sliverG = null;
function sliverGrey() {
  if (sliverG) return sliverG;
  sliverG = canvas(64, 8);
  const g2 = sliverG.getContext('2d');
  g2.fillStyle = 'rgb(150,154,158)';
  g2.beginPath(); g2.moveTo(0, 4); g2.lineTo(56, 1); g2.arc(58, 4, 3, -Math.PI / 2, Math.PI / 2); g2.lineTo(56, 7); g2.closePath(); g2.fill();
  createImageBitmap?.(sliverG).then(b => { sliverG = b; });
  return sliverG;
}
// Long thin bright and grey streaks racing across the screen along the wind (which
// the director turns to blow inward from the edge). Count and alpha follow the amount.
function drawSheets(ctx, fa) {
  const { w, h, dpr } = state.view;
  const a = state.wind.angle, c = Math.cos(a), sn = Math.sin(a);
  const W_ = sliverSprite(), G_ = sliverGrey();
  const diag = Math.hypot(w, h);
  const n = Math.round(SHEETS * Math.min(1, fa * 1.6));
  const fast = 1 + (director.frontierEsc || 0);
  for (let i = 0; i < n; i++) {
    const h1 = hash(i * 1.31), h2 = hash(i * 2.17 + 5), h3 = hash(i * 3.71 + 9);
    const L = 80 + h2 * 220, sp = (260 + h3 * 260) * fast;
    const span = diag + L + 200;
    const u = (((t * sp + h2 * 5000) % span) + span) % span - span / 2;   // along the wind
    const v = (h1 - 0.5) * diag;                                         // across it
    const x = w / 2 + c * u - sn * v, y = h / 2 + sn * u + c * v;
    const grey = h3 < 0.38;
    const wd = 1 + h2 * 2.2;
    ctx.globalAlpha = Math.min(1, fa * 1.3) * (grey ? 0.3 : 0.6);
    ctx.setTransform(dpr * c, dpr * sn, -dpr * sn, dpr * c, dpr * x, dpr * y);
    ctx.drawImage(grey ? G_ : W_, -L, -wd / 2, L, wd);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
}

function updateWisps(dt, fa) {
  // A few wisps blow across the explorer when they're at the wall or inside it.
  const p = state.player;
  const near = fa;
  if (near > 0.05 && Math.random() < dt * 5 * near && wisps.length < 110) {
    const ps = worldToScreen(p.x, p.y - 8), a = state.wind.angle;
    const back = 25 + Math.random() * 30;
    wisps.push({ free: true, x: ps.x - Math.cos(a) * back + (Math.random() - 0.5) * 18,
      y: ps.y - Math.sin(a) * back + (Math.random() - 0.5) * 22, a, age: 0, life: 0.7 + Math.random() * 0.4,
      L: 30 + Math.random() * 25, w0: 1.2 + Math.random(), sp: 70 + Math.random() * 50 });
  }
  for (const q of wisps) { q.age += dt; if (q.free) { q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt; continue; } }
  let k = 0;
  for (const q of wisps) if (q.age < q.life) wisps[k++] = q;
  wisps.length = k;
}

function drawWisps(ctx) {
  ctx.lineCap = 'round';
  for (const q of wisps) {
    if (q.free) {
      const u = q.age / q.life, c = Math.cos(q.a), s = Math.sin(q.a);
      ctx.strokeStyle = `rgba(255,255,255,${0.32 * Math.sin(Math.PI * u)})`;
      ctx.lineWidth = q.w0;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.quadraticCurveTo(q.x - c * q.L * 0.5 - s * 4, q.y - s * q.L * 0.5 + c * 4, q.x - c * q.L, q.y - s * q.L);
      ctx.stroke();
      continue;
    }
  }
}
