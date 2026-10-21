// Weather thickening toward the edge of the world. No object, no outline: over each
// side's border region a shapeless density of blowing snow and white haze rises toward
// the map edge (eroded by drifting fog noise so it's patchy and moving), with streak
// sheets racing through it. On the south side it stays very low (the sea is playable).
// Rendered in a low-res buffer (soft by design); sheets at full res. The gameplay
// escalation inside a border is the director's job (whiteout ramp, inward wind).
import { state, MAP_W, MAP_H } from '../state.js';
import { worldToScreen } from '../camera.js';
import { canvas, qRes } from './weather-noise.js';
import { director } from './weather-director.js';

import { BORDER } from '../world/frontier.js';
// The wall masses a little inside the border (towering storm), so it reads from
// ~200 px inside the safe area at the usual zoom.
// The wall's front line sits a little inside each side's border (proportional, so the
// thin south border keeps its storm down by the painting's edge, clear of the sea).
const FRONT = {
  left: BORDER.left * 1.35, right: BORDER.right * 1.35,
  // South: only the last ~85 world px thicken (the sea stays clear).
  top: BORDER.top * 1.35, bottom: 85,
};
let T, buf, g, fogPat, greyPat, streakPat, cloudPat;
let t = 0;
const wisps = [];

export function init(textures) { T = textures; }

function ensure() {
  const { w, h } = state.view;
  // Big enough (>256x256 area) to stay a GPU canvas; scaled by quality.
  const sc = Math.max(Math.min(0.34, 440 / Math.max(w, h)) * qRes(), Math.sqrt(70000 / (w * h)));
  const bw = Math.max(2, Math.round(w * sc)), bh = Math.max(2, Math.round(h * sc));
  if (!buf || buf.width !== bw || buf.height !== bh) {
    buf = canvas(bw, bh);
    g = buf.getContext('2d');
    fogPat = g.createPattern(T.fog, 'repeat');
    greyPat = g.createPattern(T.fogGrey, 'repeat');
    streakPat = g.createPattern(T.streak, 'repeat');
    cloudPat = g.createPattern(T.cloud, 'repeat');
  }
}

// Sides in screen space: front = screen coordinate of the border's inner line along the
// side's normal axis; dir = +1 if the storm lies toward increasing coordinate.
function sides() {
  const a = worldToScreen(FRONT.left, FRONT.top), b = worldToScreen(MAP_W - FRONT.right, MAP_H - FRONT.bottom);
  const e0 = worldToScreen(0, 0), e1 = worldToScreen(MAP_W, MAP_H);
  return [
    { axis: 'x', front: a.x, edge: e0.x, dir: -1, id: 0 },   // west: thickens toward smaller x
    { axis: 'x', front: b.x, edge: e1.x, dir: 1, id: 1 },    // east
    { axis: 'y', front: a.y, edge: e0.y, dir: -1, id: 2 },   // north
    { axis: 'y', front: b.y, edge: e1.y, dir: 1, id: 3 },    // south
  ];
}

// Density 0..1 at fraction f (0 = where it starts, 1 = the map edge): eased so the start
// is invisible and there's never a line.
const density = f => { const x = Math.max(0, Math.min(1, f)); return x * x * (3 - 2 * x) * (0.35 + 0.65 * x); };

const hash = n => { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };

// Fill the buffer with a pattern scrolled along the side (and drifting toward the interior).
function layer(pat, tw, th, size, along, inward, side, al, rot = 0) {
  const bw = buf.width, bh = buf.height;
  const k = size;
  const TW = tw * k, TH = th * k;
  let ox = 0, oy = 0;
  if (side.axis === 'x') { ox = -side.dir * inward; oy = along; } else { ox = along; oy = -side.dir * inward; }
  ox = ((ox % TW) + TW) % TW; oy = ((oy % TH) + TH) % TH;
  g.save();
  g.globalAlpha = al;
  if (rot) { g.translate(buf.width / 2, buf.height / 2); g.rotate(rot); g.translate(-buf.width, -buf.height); }
  g.translate(ox - TW, oy - TH);
  // Patterns that are long along x (streaks) get turned to run along the side.
  if (side.axis === 'x' && th !== tw) { g.translate(TW, 0); g.rotate(Math.PI / 2); }
  g.scale(k, k);
  g.fillStyle = pat;
  g.fillRect(0, 0, (bw * (rot ? 2.5 : 1) + TW * 2) / k + tw, (bh * (rot ? 2.5 : 1) + TH * 2) / k + th);
  g.restore();
}

export function draw(ctx) {
  const { w, h } = state.view;
  const dt = Math.min(0.1, state.dt);
  t += dt;
  const S = sides().filter(s => {
    const lim = s.axis === 'x' ? w : h;
    // Visible when the start line is on screen or the screen is inside the band.
    return s.dir < 0 ? s.front > 0 : s.front < lim;
  });
  updateWisps(dt, S);
  if (!S.length) { drawWisps(ctx); return; }
  ensure();
  const bw = buf.width, sc = bw / w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, bw, buf.height);
  const fast = 1 + (director.frontierEsc || 0);   // sheets speed up as the explorer enters

  const roll = t * 110 * fast * sc;              // haze drifts fast along the edge
  for (const side of S) {
    // Shapeless density: a gradient from nothing to dense white haze at the map edge.
    const f0 = side.front * sc, f1 = side.edge * sc;
    const x0 = side.axis === 'x' ? f0 : 0, y0 = side.axis === 'y' ? f0 : 0;
    const x1 = side.axis === 'x' ? f1 : 0, y1 = side.axis === 'y' ? f1 : 0;
    const gd = g.createLinearGradient(x0, y0, x1, y1);
    for (let k = 0; k <= 6; k++) gd.addColorStop(k / 6, `rgba(242,243,244,${(0.94 * density(k / 6)).toFixed(3)})`);
    g.fillStyle = gd;
    g.fillRect(0, 0, bw, buf.height);
    // A whisper of grey in the thick part so the blowing snow has some body.
    layer(greyPat, 256, 256, 0.62, roll * 0.8 + side.id * 50, t * 14 * sc, side, 0.12, 0.37);
  }
  // Erode the density with drifting fog noise (patchy, moving, never an edge).
  g.globalCompositeOperation = 'destination-out';
  layer(fogPat, 256, 256, 0.5, roll + 30, t * 30 * sc, S[0], 0.45, 0.21);
  layer(fogPat, 256, 256, 0.5 * 0.731, roll * 1.5, t * 45 * sc, S[0], 0.3, -0.83);
  g.globalCompositeOperation = 'source-over';

  // Keep the explorer readable once they're in it (the global whiteout takes over there).
  const p = worldToScreen(state.player.x, state.player.y - 8);
  const R = 90 * sc;
  const rg = g.createRadialGradient(p.x * sc, p.y * sc, 0, p.x * sc, p.y * sc, R);
  rg.addColorStop(0, 'rgba(0,0,0,0.8)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = rg;
  g.fillRect(0, 0, bw, buf.height);
  g.globalCompositeOperation = 'source-over';

  // Once the explorer is inside, the global whiteout takes over and the wall body fades.
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1 - 0.6 * Math.max(0, Math.min(1, ((director.frontier || 0) - 0.35) / 0.45));
  ctx.drawImage(buf, 0, 0, w, h);
  for (const side of S) drawSheets(ctx, side, ctx.globalAlpha);
  ctx.globalAlpha = 1;
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
function drawSheets(ctx, side, alpha) {
  const { w, h, dpr } = state.view;
  const len = side.axis === 'x' ? h : w;
  const fast = 1 + (director.frontierEsc || 0);
  const dirS = side.id % 2 ? -1 : 1;
  const W_ = sliverSprite(), G_ = sliverGrey();
  for (let i = 0; i < SHEETS; i++) {
    const h1 = hash(i * 1.31 + side.id * 17), h2 = hash(i * 2.17 + 5), h3 = hash(i * 3.71 + 9);
    const fr = 0.3 + 0.7 * Math.pow(h1, 0.6);                 // where in the density band
    const dens = density(fr);
    const L = 70 + h2 * 200, sp = (220 + h3 * 200) * fast;
    const span = len + L + 200;
    const s = (((t * sp * dirS + h2 * 5000) % span) + span) % span - L - 100;
    const s0 = dirS > 0 ? s : len - s;
    const n = side.front + (side.edge - side.front) * fr;
    const grey = h3 < 0.38;
    const wd = 1 + h2 * 2.2;
    ctx.globalAlpha = alpha * dens * (grey ? 0.35 : 0.75);
    // Sprite runs along +x with its head at the right; point it along the travel direction.
    const ux = side.axis === 'x' ? 0 : -dirS, uy = side.axis === 'x' ? -dirS : 0;
    const x = side.axis === 'x' ? n : s0, y = side.axis === 'x' ? s0 : n;
    ctx.setTransform(-dpr * ux, -dpr * uy, dpr * uy, -dpr * ux, dpr * x, dpr * y);
    ctx.drawImage(grey ? G_ : W_, -L, -wd / 2, L, wd);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
}

// --- streamers tearing off the top of the wall toward the explorer -------------------
function updateWisps(dt, S) {
  const { w, h } = state.view;
  // A few wisps blow across the explorer when they're at the wall or inside it.
  const p = state.player;
  // How far past each side's wall front the explorer is (positive = inside the storm side).
  const past = Math.max(FRONT.left - p.x, FRONT.top - p.y, p.x - (MAP_W - FRONT.right), p.y - (MAP_H - FRONT.bottom));
  const near = Math.max(director.frontier || 0, Math.min(1, Math.max(0, (past + 60) / 90)));
  if (near > 0.05 && Math.random() < dt * 5 * near && wisps.length < 110) {
    const ps = worldToScreen(p.x, p.y - 8), a = state.wind.angle;
    const back = 25 + Math.random() * 30;
    wisps.push({ free: true, x: ps.x - Math.cos(a) * back + (Math.random() - 0.5) * 18,
      y: ps.y - Math.sin(a) * back + (Math.random() - 0.5) * 22, a, age: 0, life: 0.7 + Math.random() * 0.4,
      L: 30 + Math.random() * 25, w0: 1.2 + Math.random(), sp: 70 + Math.random() * 50 });
  }
  for (const q of wisps) { q.age += dt; if (q.free) { q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt; continue; } q.s += dt * 90 * (q.side.id % 2 ? -1 : 1); }
  let k = 0;
  for (const q of wisps) if (q.age < q.life && (q.free || S.includes(q.side))) wisps[k++] = q;
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
