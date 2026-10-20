// The white border haze: the world dissolving into the white nothingness of snow at
// the edges of the screen. Always present; stronger with wind and snowfall, strongest
// in a whiteout, eased when the explorer is sheltered. Not a ring: an elliptical mask
// (portrait screens get a tall ellipse) eaten into by two layers of drifting fog
// noise moving with the wind, rendered in a small buffer and composited once.
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { canvas } from './weather-noise.js';
import { director } from './weather-director.js';

let T, buf, g, fogPat, ring;
let u1 = 0, u2 = 0, v1 = 0, lastT = 0;
let level = -1;
const clamp01 = v => Math.max(0, Math.min(1, v));
const SNOW = '241,242,243';

export function init(textures) {
  T = textures;
  // Elliptical edge mask: clear in the middle, organic falloff, solid at the rim.
  ring = canvas(128, 128);
  const rg = ring.getContext('2d');
  const gd = rg.createRadialGradient(64, 64, 0, 64, 64, 64);
  gd.addColorStop(0, `rgba(${SNOW},0)`);
  gd.addColorStop(0.46, `rgba(${SNOW},0)`);
  gd.addColorStop(0.62, `rgba(${SNOW},0.28)`);
  gd.addColorStop(0.8, `rgba(${SNOW},0.78)`);
  gd.addColorStop(1, `rgba(${SNOW},1)`);
  rg.fillStyle = gd;
  rg.fillRect(0, 0, 128, 128);
}

function ensure() {
  const { w, h } = state.view;
  const sc = Math.min(0.25, 320 / Math.max(w, h));
  const bw = Math.max(2, Math.round(w * sc)), bh = Math.max(2, Math.round(h * sc));
  if (!buf || buf.width !== bw || buf.height !== bh) {
    buf = canvas(bw, bh);
    g = buf.getContext('2d');
    fogPat = g.createPattern(T.fog, 'repeat');
  }
}

// 0..1 how thick the border haze is right now.
function target() {
  const W = state.wind.speed, X = state.weather;
  const sh = director.shelter || 0;
  return clamp01(0.18 + W * 0.35 + X.snowfall * 0.2 + X.whiteout * 0.6 + state.wind.gust * 0.08 - sh * 0.4);
}

export function draw(ctx) {
  ensure();
  const { w, h } = state.view;
  const dt = Math.max(0, state.time - lastT); lastT = state.time;
  const tl = target();
  level = level < 0 ? tl : level + (tl - level) * Math.min(1, dt * (tl < level ? 2 : 0.6));
  const I = level;
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a), W = state.wind.speed;
  u1 += (10 + 50 * W) * dt; u2 += (18 + 90 * W) * dt; v1 += 3 * dt;

  const bw = buf.width, bh = buf.height, sc = bw / w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, bw, bh);

  // Centre between the screen middle and the explorer, so they stay in the clear.
  const p = worldToScreen(state.player.x, state.player.y - 8);
  let cx = (w / 2 * 0.5 + p.x * 0.5) * sc, cy = (h / 2 * 0.5 + p.y * 0.5) * sc;
  // Bigger mask = clear middle reaches further out. ~1.3 (calm) .. 1.06 (whiteout).
  const S = 1.36 - 0.3 * I;
  const mw = bw * S, mh = bh * S;
  // The mask must always cover the whole buffer (destination-in clears outside it).
  const mx = (mw - bw) / 2, my = (mh - bh) / 2;
  cx = Math.max(bw / 2 - mx, Math.min(bw / 2 + mx, cx));
  cy = Math.max(bh / 2 - my, Math.min(bh / 2 + my, cy));
  // Solid white everywhere, then keep only the ring...
  g.fillStyle = `rgb(${SNOW})`;
  g.fillRect(0, 0, bw, bh);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(ring, cx - mw / 2, cy - mh / 2, mw, mh);
  // ...eat into it with drifting fog noise so the edge is organic and moves with the wind.
  g.globalCompositeOperation = 'destination-out';
  const layers = [[1.6, u1, 0.6], [0.9, u2, 0.45]];
  for (const [size, uu, al] of layers) {
    g.save();
    g.globalAlpha = al;
    g.translate(bw / 2, bh / 2);
    g.rotate(a);
    const tile = 256 * size * sc * 4;
    const k = (size * sc * 4);
    const ou = ((uu * sc * 4) % tile + tile) % tile, ov = ((v1 * sc * 4) % tile + tile) % tile;
    g.translate(ou, ov);
    g.scale(k, k);
    g.fillStyle = fogPat;
    const R = Math.hypot(bw, bh) / k;
    g.fillRect(-R - 256 - ou / k, -R - 256 - ov / k, 2 * R + 512, 2 * R + 512);
    g.restore();
  }
  // Re-solidify the outermost rim so the corners are always white.
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 0.6;
  g.drawImage(ring, cx - mw * 0.62, cy - mh * 0.62, mw * 1.24, mh * 1.24);
  g.globalAlpha = 1;

  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = clamp01(0.8 + I * 0.2);
  ctx.drawImage(buf, 0, 0, w, h);
  ctx.globalAlpha = 1;
}
