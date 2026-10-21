// Life on the frozen lakes and the open sea, drawn by ground.js right after the map.
//
// Water (dark thin ice / open leads at the bottom centre):
//   - every white floe is cut out of the painting (crisp tile when loaded) and drawn
//     bobbing, drifting in a small orbit round its home and rocking slightly, over a
//     water-filled hole, with a dark waterline that thickens on the down-bob and a
//     lapping light line below it;
//   - ink ripples drifting downwind, expanding ring ripples, a shifting wet sheen.
// Ice (class ice): narrow hard-edged sheen bands sliding with the wind; skating snow
//   streaks and puffs; every 3-5 s a bright gust band of loose snow runs across; a slow
//   cloud shadow; every 6-10 s a new hairline crack draws itself in with a glint.
// All scale with state.wind. Pattern tiles, masks and floe sprites are pre-baked; per
// frame each surface is one offscreen fill + mask + composite, plus the floe sprites.
// state.quality.level: high = all; medium = lower-res effects, no cloud; low = sheen and
// ripples only, floes static. ?nolakes turns it all off.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import { mask, classAt, lumAt } from './terrain.js';
import { tileAt, mapImage, TILE_SCALE, TILE_SIZE, TILE_GUTTER } from './map.js';

const ICE = 2, THIN = 3;
const TAU = Math.PI * 2;
const WATER_LUM = 176;      // thin-ice pixels darker than this are open water
const WATER_RGB = 'rgb(126,129,132)';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- pre-baked textures ----------------------------------------------------------------
let tex = null;
function bake() {
  const r = rng(7);
  // Sheen: a few narrow, hard-edged light bands (seamless in x; drawn across the wind).
  const sheen = canvas(256, 4), sg = sheen.getContext('2d');
  for (const [c, w, a] of [[30, 3, 1], [37, 1.2, 0.7], [110, 5, 0.9], [118, 1.5, 0.6], [190, 2, 0.9], [232, 1, 0.6]]) {
    sg.fillStyle = `rgba(255,255,255,${a})`;
    sg.fillRect(c, 0, w, 4);
    // a thin darker line on the lee side: the band reads as a ridge of light, not a glow
    sg.fillStyle = `rgba(120,126,132,${a * 0.6})`;
    sg.fillRect(c + w + 1, 0, 1, 4);
  }

  // Skating snow: fine wavy streaks along x (seamless).
  const streak = canvas(160, 96), kg = streak.getContext('2d');
  kg.strokeStyle = '#fff'; kg.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x0 = r() * 160, y0 = r() * 96, len = 14 + r() * 30, amp = 0.6 + r() * 1.2, ph = r() * TAU;
    const lw = 0.7 + r() * 0.6, al = 0.45 + r() * 0.5;
    for (const ox of [-160, 0, 160]) for (const oy of [-96, 0, 96]) {
      kg.lineWidth = lw; kg.globalAlpha = al;
      kg.beginPath();
      for (let s = 0; s <= len; s += 2) {
        const x = x0 + s + ox, y = y0 + Math.sin(ph + s * 0.25) * amp + oy;
        s ? kg.lineTo(x, y) : kg.moveTo(x, y);
      }
      kg.stroke();
    }
  }
  kg.globalAlpha = 1;

  // Cloud shadow: soft dark blobs (seamless).
  const cloud = canvas(128, 128), cg = cloud.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const x = r() * 128, y = r() * 128, rad = 18 + r() * 26;
    for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) {
      const gr = cg.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, 'rgba(40,44,48,0.5)'); gr.addColorStop(1, 'rgba(40,44,48,0)');
      cg.fillStyle = gr; cg.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }

  // Ripples: curved ink troughs with a light crest above, varied length / tilt (seamless).
  const ripple = canvas(256, 160), rg = ripple.getContext('2d');
  rg.lineCap = 'round';
  // Varied: clustered placement, length and bend +-50%, some arcs broken in two.
  const arcs = [];
  for (let c = 0; c < 9; c++) {
    const cx0 = r() * 256, cy0 = r() * 160, n = 1 + ((r() * 4) | 0);
    for (let k = 0; k < n; k++) arcs.push([cx0 + (r() - 0.5) * 40, cy0 + (r() - 0.5) * 22]);
  }
  for (const [x, y] of arcs) {
    const l = 15 * (0.5 + r()), tilt = (r() - 0.5) * 0.6, bend = 2.5 * (0.5 + r());
    const broken = r() < 0.35, gap = 0.25 + r() * 0.2, crest = r() < 0.7;
    for (const ox of [-256, 0, 256]) for (const oy of [-160, 0, 160]) {
      const cx = x + ox, cy = y + oy, dx = Math.cos(tilt) * l / 2, dy = Math.sin(tilt) * l / 2;
      const P = u => { // point on the arc, u in 0..1
        const ax = cx - dx, ay = cy - dy + bend, bx = cx + dx, by = cy + dy + bend, mx = cx, my = cy - bend;
        const v = 1 - u;
        return [v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by];
      };
      const seg = (u0, u1) => { rg.beginPath(); for (let u = u0; u <= u1 + 1e-6; u += 0.1) { const [px, py] = P(Math.min(u, u1)); u === u0 ? rg.moveTo(px, py) : rg.lineTo(px, py); } rg.stroke(); };
      rg.strokeStyle = 'rgba(48,52,56,0.95)'; rg.lineWidth = 0.9 + r() * 0.6;
      if (broken) { seg(0, 0.5 - gap / 2); seg(0.5 + gap / 2, 1); } else seg(0, 1);
      if (crest) {
        rg.strokeStyle = 'rgba(214,218,222,0.85)'; rg.lineWidth = 1;
        rg.beginPath(); rg.moveTo(cx - dx * 0.4, cy - dy * 0.4 + bend + 4); rg.quadraticCurveTo(cx, cy + 4 - bend * 0.2, cx + dx * 0.4, cy + dy * 0.4 + bend + 4); rg.stroke();
      }
    }
  }

  // Puff: a small soft white dot.
  const puff = canvas(16, 16), pg = puff.getContext('2d');
  const pgr = pg.createRadialGradient(8, 8, 0, 8, 8, 8);
  pgr.addColorStop(0, 'rgba(255,255,255,0.95)'); pgr.addColorStop(1, 'rgba(255,255,255,0)');
  pg.fillStyle = pgr; pg.fillRect(0, 0, 16, 16);

  // Dark copy of the streaks: their tiny ink shadow (the snow sits on the ice).
  const streakDark = canvas(160, 96), dg = streakDark.getContext('2d');
  dg.drawImage(streak, 0, 0);
  dg.globalCompositeOperation = 'source-in';
  dg.fillStyle = 'rgb(40,44,48)'; dg.fillRect(0, 0, 160, 96);

  tex = { sheen, streak, streakDark, cloud, ripple, puff };
}

// Upscale a binary mask (Uint8Array w*h of 0/1) by `up` with smooth, antialiased edges:
// bilinear upscale, then a steep alpha ramp around 50%. Optional tint.
function smoothMask(bits, w, h, up, rgb = null) {
  const small = canvas(w, h), sgc = small.getContext('2d'), id = sgc.createImageData(w, h);
  for (let i = 0; i < bits.length; i++) if (bits[i]) id.data[i * 4 + 3] = 255;
  sgc.putImageData(id, 0, 0);
  const big = canvas(w * up, h * up), bg = big.getContext('2d', { willReadFrequently: true });
  bg.imageSmoothingEnabled = true;
  bg.drawImage(small, 0, 0, w * up, h * up);
  const d = bg.getImageData(0, 0, w * up, h * up);
  const px = d.data;
  for (let i = 3; i < px.length; i += 4) {
    const a = Math.max(0, Math.min(255, (px[i] - 128) * 4 + 128));
    px[i] = a;
    if (rgb) { px[i - 3] = rgb[0]; px[i - 2] = rgb[1]; px[i - 1] = rgb[2]; }
  }
  bg.putImageData(d, 0, 0);
  small.width = small.height = 0;
  return big;
}

// Water mask at 1 world px, following the painted edges: open-water grey (between ink
// and floe white) near thin-ice cells.
function waterMaskFromPainting(m, wbits, x0, y0, ww, wh) {
  const img = mapImage(), S2 = m.scale;
  const W = ww * S2, H = wh * S2;
  const c = canvas(W, H), g = c.getContext('2d', { willReadFrequently: true });
  if (!img) return smoothMask(wbits, ww, wh, 4);
  g.drawImage(img, x0 * S2, y0 * S2, W, H, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H), px = d.data;
  const L = new Float32Array(W * H);
  for (let i = 0; i < L.length; i++) L[i] = px[i * 4];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // 3x3 mean
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      sum += L[yy * W + xx]; n++;
    }
    const v = sum / n;
    // near a thin-ice cell (within 1 mask px)?
    const mx = (x / S2) | 0, my = (y / S2) | 0;
    let near = 0;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = mx + dx, yy = my + dy;
      if (xx >= 0 && yy >= 0 && xx < ww && yy < wh && wbits[yy * ww + xx]) { near = 1; break; }
    }
    const a = near ? Math.max(0, Math.min(1, (182 - v) / 14, (v - 88) / 14)) : 0;
    const o = (y * W + x) * 4;
    px[o] = px[o + 1] = px[o + 2] = 0; px[o + 3] = a * 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// --- surfaces: masks and floes, built from the class map -------------------------------
let S = null, builtVersion = -1;
function build(m) {
  builtVersion = m.version;
  const { cls, lum, w, h } = m;
  // Ice mask: quarter-res bits (4 world px), smoothed x2 => 2 world px per pixel.
  const iw = w >> 1, ih = h >> 1, ib = new Uint8Array(iw * ih);
  let iceAny = false;
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const i0 = y * 2 * w + x * 2;
    if ((cls[i0] === ICE) + (cls[i0 + 1] === ICE) + (cls[i0 + w] === ICE) + (cls[i0 + w + 1] === ICE) >= 2) { ib[y * iw + x] = 1; iceAny = true; }
  }
  const ice = iceAny ? smoothMask(ib, iw, ih, 2) : null;

  // Water: bounding box of thin ice.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cls[y * w + x] === THIN) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  let water = null, wb = null;
  const floes = [];
  if (x1 >= 0) {
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
    const ww = x1 - x0 + 1, wh = y1 - y0 + 1;
    const wbits = new Uint8Array(ww * wh);
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
      const i = (y + y0) * w + x + x0;
      wbits[y * ww + x] = cls[i] === THIN && lum[i] < WATER_LUM ? 1 : 0;
    }
    water = waterMaskFromPainting(m, wbits, x0, y0, ww, wh);
    wb = { x: x0 * m.scale, y: y0 * m.scale, w: ww * m.scale, h: wh * m.scale };
    // Floes: 4-connected non-water components fully ringed by water, 2..600 mask px.
    const lab = new Int32Array(ww * wh), stack = [];
    let id = 0;
    for (let s0 = 0; s0 < lab.length; s0++) {
      if (wbits[s0] || lab[s0]) continue;
      id++;
      const pix = [];
      let edge = false;
      stack.push(s0); lab[s0] = id;
      while (stack.length) {
        const p = stack.pop(); pix.push(p);
        const x = p % ww, y = (p / ww) | 0;
        if (x === 0 || y === 0 || x === ww - 1 || y === wh - 1) edge = true;
        for (const q of [x > 0 ? p - 1 : -1, x < ww - 1 ? p + 1 : -1, y > 0 ? p - ww : -1, y < wh - 1 ? p + ww : -1]) {
          if (q >= 0 && !wbits[q] && !lab[q]) { lab[q] = id; stack.push(q); }
        }
        if (pix.length > 600) edge = true;
      }
      if (edge || pix.length < 2 || pix.length > 600) continue;
      // Real floes are white; grey sheet ice between leads stays put.
      let lmax = 0;
      for (const p of pix) lmax = Math.max(lmax, lum[(((p / ww) | 0) + y0) * w + (p % ww) + x0]);
      if (lmax < 216) continue;
      let fx0 = ww, fy0 = wh, fx1 = 0, fy1 = 0;
      for (const p of pix) { const x = p % ww, y = (p / ww) | 0; fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
      // 1 mask px of margin so the ink outline comes with the floe.
      const bx0 = fx0 - 1, by0 = fy0 - 1, bw = fx1 - fx0 + 3, bh = fy1 - fy0 + 3;
      const bits = new Uint8Array(bw * bh);
      for (const p of pix) {
        const x = (p % ww) - bx0, y = ((p / ww) | 0) - by0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) bits[(y + dy) * bw + x + dx] = 1;
      }
      const R = rng(id * 7919);
      floes.push({
        x: (bx0 + x0) * m.scale, y: (by0 + y0) * m.scale, w: bw * m.scale, h: bh * m.scale, bits, bw, bh,
        size: pix.length, ph: R() * TAU, per: 2 + R() * 2, orb: R() * TAU, orbR: 1.5 + R() * 2.5,
        orbSp: (0.12 + R() * 0.12) * (R() < 0.5 ? 1 : -1), rot: (0.6 + R() * 1.2) * Math.PI / 180, sprite: null, sil: null,
      });
    }
  }
  if (holes) holes.width = 0;
  holes = null;
  S = { ice, water, wb, floes, iceScale: m.scale * 2 };
}

// Floe sprites: cut from the crisp tile (or the 1x base), masked to the floe; plus dark
// and light silhouettes for the waterline and lapping. Small LRU.
const FLOE_CAP = 160;
const live = new Set();
function floeSource(f) {
  // All tiles under the floe loaded (and opaque)? Then cut at tile resolution.
  const tx0 = Math.floor(f.x / TILE_SIZE), tx1 = Math.floor((f.x + f.w) / TILE_SIZE);
  const ty0 = Math.floor(f.y / TILE_SIZE), ty1 = Math.floor((f.y + f.h) / TILE_SIZE);
  const ts = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = tileAt(tx * TILE_SIZE + 1, ty * TILE_SIZE + 1);
    if (!t) return null;
    ts.push(t);
  }
  return ts;
}

function floeSprite(f) {
  const ts = floeSource(f);
  const scale = ts ? TILE_SCALE : 2;
  if (f.sprite && f.sprite.scale >= scale) return f.sprite;
  const base = mapImage();
  if (!ts && !base) return null;
  const W = Math.ceil(f.w * scale), H = Math.ceil(f.h * scale);
  const cv = canvas(W, H), g = cv.getContext('2d', { willReadFrequently: true });
  if (ts) {
    for (const t of ts) {
      // world rect of this tile's core, intersected with the floe box
      const wx0 = Math.max(f.x, t.tx * TILE_SIZE), wy0 = Math.max(f.y, t.ty * TILE_SIZE);
      const wx1 = Math.min(f.x + f.w, (t.tx + 1) * TILE_SIZE), wy1 = Math.min(f.y + f.h, (t.ty + 1) * TILE_SIZE);
      if (wx1 <= wx0 || wy1 <= wy0) continue;
      g.drawImage(t.bmp, TILE_GUTTER + (wx0 - t.tx * TILE_SIZE) * scale, TILE_GUTTER + (wy0 - t.ty * TILE_SIZE) * scale,
        (wx1 - wx0) * scale, (wy1 - wy0) * scale, (wx0 - f.x) * scale, (wy0 - f.y) * scale, (wx1 - wx0) * scale, (wy1 - wy0) * scale);
    }
  } else {
    g.drawImage(base, f.x, f.y, f.w, f.h, 0, 0, W, H);
  }
  // Alpha: the bright floe plus its ink outline = within ~1.5 world px of bright paint.
  const d = g.getImageData(0, 0, W, H), px = d.data;
  const br = new Uint8Array(W * H);
  for (let i = 0; i < br.length; i++) br[i] = px[i * 4] > 205 ? 1 : 0;
  const R = Math.max(1, Math.round(scale * 1.4));
  const near = new Float32Array(W * H);
  // separable max-distance approx: horizontal then vertical dilation counts
  const hd = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    let last = -1e9;
    for (let x = 0; x < W; x++) { if (br[y * W + x]) last = x; hd[y * W + x] = Math.min(255, x - last); }
    last = 1e9;
    for (let x = W - 1; x >= 0; x--) { if (br[y * W + x]) last = x; hd[y * W + x] = Math.min(hd[y * W + x], Math.min(255, last - x)); }
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let best = 255;
    for (let dy = -R - 1; dy <= R + 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      const h = hd[yy * W + x];
      if (h < 255) best = Math.min(best, Math.hypot(h, dy));
    }
    near[y * W + x] = best;
  }
  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(255 * Math.max(0, Math.min(1, R + 0.8 - near[i])));
  for (let i = 0; i < alpha.length; i++) px[i * 4 + 3] = alpha[i];
  g.putImageData(d, 0, 0);
  const tint = (rgb, grow) => {
    const c = canvas(W, H), cg = c.getContext('2d'), id = cg.createImageData(W, H);
    for (let i = 0; i < alpha.length; i++) {
      const a = grow ? Math.min(255, Math.round(255 * Math.max(0, Math.min(1, R + 0.8 + grow - near[i])))) : alpha[i];
      id.data[i * 4] = rgb[0]; id.data[i * 4 + 1] = rgb[1]; id.data[i * 4 + 2] = rgb[2]; id.data[i * 4 + 3] = a;
    }
    cg.putImageData(id, 0, 0);
    return c;
  };
  for (const k of ['sil', 'silDark', 'silLight']) if (f[k]) f[k].width = 0;
  f.sil = tint([126, 129, 132], scale * 0.6);        // hole fill, a touch larger
  f.silDark = tint([38, 41, 44], 0);
  f.silLight = tint([222, 226, 230], 0);
  if (f.sprite) f.sprite.cv.width = 0;
  f.sprite = { cv, scale };
  live.add(f);
  if (live.size > FLOE_CAP) {
    for (const o of live) {
      if (o === f) continue;
      o.sprite.cv.width = 0; o.sprite = null;
      for (const k of ['sil', 'silDark', 'silLight']) { o[k].width = 0; o[k] = null; }
      live.delete(o);
      break;
    }
  }
  return f.sprite;
}

// --- live state ----------------------------------------------------------------------------
const puffs = [], cracks = [], rings = [];
let crackTimer = 3, gustTimer = 2, gust = null, ringTimer = 0.5;
let fx = null, fxg = null, coverT = 0;
const cover = { ice: false, water: false };

function flatIce(x, y) {
  for (let k = 0; k < 9; k++) {
    const px = x + (k % 3 - 1) * 7, py = y + ((k / 3) | 0) * 7 - 7;
    if (classAt(px, py) !== ICE) return false;
    const L = lumAt(px, py);
    if (L < 205 || L > 232) return false;
  }
  return true;
}

function updateCover(r) {
  cover.ice = cover.water = false;
  const step = Math.max(12, (r.x1 - r.x0) / 14);
  for (let y = r.y0; y <= r.y1 && !(cover.ice && cover.water); y += step) {
    for (let x = r.x0; x <= r.x1; x += step) {
      const c = classAt(x, y);
      if (c === ICE) cover.ice = true;
      else if (c === THIN && lumAt(x, y) < WATER_LUM) cover.water = true;
    }
  }
}

const rnd = Math.random;
function randIn(r) { return [r.x0 + rnd() * (r.x1 - r.x0), r.y0 + rnd() * (r.y1 - r.y0)]; }

function update(dt, r, wind) {
  const q = state.quality.level;
  const ws = wind.speed + wind.gust * 0.6;
  const wx = Math.cos(wind.angle), wy = Math.sin(wind.angle);
  // Puffs of loose snow skittering over the ice.
  const maxP = q === 'high' ? 22 : 10;
  if (cover.ice && q !== 'low' && puffs.length < maxP && rnd() < dt * (1 + ws * 8)) {
    const [x, y] = randIn(r);
    if (classAt(x, y) === ICE) {
      const sp = 16 + ws * 50;
      puffs.push({ x, y, vx: wx * sp, vy: wy * sp * 0.7, age: 0, life: 1.6 + rnd() * 2.4, ph: rnd() * TAU, s: 0.7 + rnd() * 0.8 });
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.age += dt;
    const k = Math.sin(p.age * 3 + p.ph) * 0.35;
    p.x += (p.vx - p.vy * k) * dt; p.y += (p.vy + p.vx * k) * dt;
    if (p.age > p.life) puffs.splice(i, 1);
  }
  // Gust band of loose snow running across the ice.
  gustTimer -= dt;
  if (!gust && gustTimer <= 0 && cover.ice) {
    gustTimer = 2 + rnd();
    gust = { s: -60, speed: 80 + rnd() * 40 + ws * 30, width: 30 + rnd() * 30 };
  }
  if (gust) { gust.s += gust.speed * dt; if (gust.s > Math.hypot(r.x1 - r.x0, r.y1 - r.y0) + 60) gust = null; }
  // Expanding ring ripples on open water.
  ringTimer -= dt;
  if (cover.water && ringTimer <= 0) {
    ringTimer = 0.9 + rnd() * 1.2;
    for (let k = 0; k < 8; k++) {
      const [x, y] = randIn(r);
      if (classAt(x, y) === THIN && lumAt(x, y) < WATER_LUM) { rings.push({ x, y, age: 0, life: 2.2 + rnd() }); break; }
    }
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].age += dt; if (rings[i].age > rings[i].life) rings.splice(i, 1); }
  // A new crack drawing itself in.
  crackTimer -= dt;
  if (crackTimer <= 0 && cover.ice) {
    crackTimer = 4 + rnd() * 2;
    for (let tries = 0; tries < 16; tries++) {
      let [x, y] = randIn(r);
      if (!flatIce(x, y)) continue;
      let a = rnd() * TAU;
      const pts = [x, y];
      const segs = 3 + ((rnd() * 4) | 0);
      for (let s = 0; s < segs; s++) {
        a += (rnd() < 0.5 ? 1 : -1) * (0.2 + rnd() * 0.4);
        const len = 4 + rnd() * 6;
        const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len * 0.7;
        if (!flatIce(nx, ny)) break;
        pts.push(nx, ny); x = nx; y = ny;
      }
      if (pts.length >= 6) { cracks.push({ pts, age: 0 }); if (cracks.length > 8) cracks.shift(); break; }
    }
  }
  for (const c of cracks) c.age += dt;
  while (cracks.length && cracks[0].age > 70) cracks.shift();
}

function ensureFx(w, h) {
  if (!fx) { fx = canvas(w, h); fxg = fx.getContext('2d'); }
  if (fx.width !== w || fx.height !== h) { fx.width = w; fx.height = h; }
}

// Fill with a pattern tile rotated to `angle`, scrolled `off` world px along it (offY
// across), `s` world px per texel, anchored to world space.
function patternFill(g, img, r, angle, off, offY, s, alpha, sy = 1) {
  const pat = g.createPattern(img, 'repeat');
  g.save();
  g.globalAlpha = alpha;
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  g.translate(cx, cy);
  g.scale(1, sy);
  g.rotate(angle);
  g.scale(s, s);
  const diag = Math.hypot(r.x1 - r.x0, (r.y1 - r.y0) / sy) / s;
  const ax = ((cx * Math.cos(angle) + cy / sy * Math.sin(angle)) / s) - off / s;
  const ay = ((-cx * Math.sin(angle) + cy / sy * Math.cos(angle)) / s) - offY / s;
  const pw = img.width, ph = img.height;
  g.translate(-(((ax % pw) + pw) % pw), -(((ay % ph) + ph) % ph));
  g.fillStyle = pat;
  g.fillRect(-diag / 2 - pw, -diag / 2 - ph, diag + 2 * pw, diag + 2 * ph);
  g.restore();
}

export function drawLakes(ctx) {
  const m = mask();
  if (!m || state.params.has('nolakes')) return;
  if (!tex) bake();
  if (builtVersion !== m.version) build(m);
  const q = state.quality.level;
  const r = visibleRect(6);
  const dt = Math.min(0.05, state.dt || 0);
  coverT -= dt;
  if (coverT <= 0) { coverT = 0.25; updateCover(r); }
  const wind = state.wind;
  update(dt, r, wind);
  if (!cover.ice && !cover.water && !cracks.length) return;

  const t = state.time, ws = Math.min(1.2, wind.speed + wind.gust * 0.6);
  const wa = wind.angle;
  // ~2.5 px per world unit at most: the marks are soft-edged ink, and fill cost scales
  // with this canvas, not the screen.
  const res = Math.min(state.cam.zoom, 2.5) * (q === 'high' ? 1 : q === 'medium' ? 0.7 : 0.5);
  const W = Math.min(1100, Math.ceil((r.x1 - r.x0) * res)), H = Math.min(1100, Math.ceil((r.y1 - r.y0) * res));
  const sx = W / (r.x1 - r.x0), sy = H / (r.y1 - r.y0);
  ensureFx(W, H);
  const g = fxg;
  const begin = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    g.setTransform(sx, 0, 0, sy, -r.x0 * sx, -r.y0 * sy);
  };

  // ---- ice ----
  if (cover.ice && S.ice) {
    begin();
    patternFill(g, tex.sheen, r, wa, t * (8 + ws * 16), 0, 1.2, Math.min(1, 0.75 + ws * 0.25), 0.7);
    if (q !== 'low') {
      const a = 0.25 + ws * 0.6;
      patternFill(g, tex.streakDark, r, wa, t * (20 + ws * 70), Math.sin(t * 0.7) * 3 + 1.2, 0.6, Math.min(1, a * 0.6), 0.7);
      patternFill(g, tex.streak, r, wa, t * (20 + ws * 70), Math.sin(t * 0.7) * 3, 0.6, a * 0.8, 0.7);
      patternFill(g, tex.streak, r, wa + 0.12, t * (32 + ws * 95) + 53, Math.cos(t * 0.5) * 4 + 37, 0.85, a * 0.55, 0.7);
      // Gust band: a bright running band of skating snow, perpendicular to the wind.
      if (gust) {
        g.save();
        const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, D = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
        g.translate(cx, cy); g.rotate(wa);
        const bx = -D / 2 - 30 + gust.s;
        g.beginPath(); g.rect(bx - gust.width / 2, -D, gust.width, 2 * D); g.clip();
        // A hard-edged strip: faint white veil, then dense racing streaks with ink shadow.
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(bx - gust.width / 2, -D, gust.width, 2 * D);
        g.rotate(-wa); g.translate(-cx, -cy);
        patternFill(g, tex.streakDark, r, wa, t * 110, 11 + 1.6, 0.55, 0.8, 0.7);
        patternFill(g, tex.streak, r, wa, t * 110, 11, 0.55, 1, 0.7);
        patternFill(g, tex.streakDark, r, wa + 0.08, t * 140 + 70, 29 + 1.6, 0.75, 0.6, 0.7);
        patternFill(g, tex.streak, r, wa + 0.08, t * 140 + 70, 29, 0.75, 0.9, 0.7);
        g.restore();
      }
      for (const p of puffs) {
        const f = Math.sin((p.age / p.life) * Math.PI);
        const s = 5 * p.s;
        g.globalAlpha = 0.75 * f;
        g.drawImage(tex.puff, p.x - s / 2, p.y - s / 2, s, s);
        g.globalAlpha = 0.4 * f;
        g.drawImage(tex.puff, p.x - Math.cos(wa) * 4 - s * 0.35, p.y - Math.sin(wa) * 3 - s * 0.35, s * 0.7, s * 0.7);
      }
      g.globalAlpha = 1;
    }
    if (q === 'high') patternFill(g, tex.cloud, r, 0, t * (2 + ws * 5), t * 1.2, 7, 0.22);
    g.globalCompositeOperation = 'destination-in';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = true;
    g.drawImage(S.ice, 0, 0, S.ice.width * S.iceScale / 2, S.ice.height * S.iceScale / 2);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(fx, 0, 0, W, H, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  }

  // ---- water ----
  if (cover.water && S.water) {
    const b = S.wb;
    begin();
    // Ink ripples drifting downwind at two speeds, plus the shifting wet sheen.
    const drift = 15 + ws * 10;
    patternFill(g, tex.ripple, r, 0, t * drift * Math.cos(wa), t * drift * 0.5 * Math.sin(wa), 0.5, 1);
    patternFill(g, tex.ripple, r, 0, t * drift * 0.6 * Math.cos(wa) + 31, t * 6 + 17, 0.7, 0.75);
    patternFill(g, tex.sheen, r, wa + 0.4, t * (4 + ws * 6), 0, 1.6, 0.14 + ws * 0.08, 0.5);
    // Expanding rings.
    g.lineWidth = 0.9;
    for (const ring of rings) {
      const k = ring.age / ring.life, rad = 2 + k * 14;
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = 'rgb(44,48,52)';
      g.beginPath(); g.ellipse(ring.x, ring.y, rad, rad * 0.45, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgb(214,218,222)';
      g.beginPath(); g.ellipse(ring.x, ring.y - 1, rad * 0.7, rad * 0.32, 0, Math.PI, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.drawImage(S.water, b.x, b.y, b.w, b.h);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(fx, 0, 0, W, H, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    drawFloes(ctx, r, t, q);
  }

  // ---- cracks drawing themselves in ----
  if (cracks.length) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const c of cracks) {
      const n = c.pts.length / 2 - 1;
      const grow = Math.min(n, (c.age / 1.6) * n);
      const fade = c.age > 55 ? Math.max(0, 1 - (c.age - 55) / 15) : 1;
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = 'rgb(60,63,66)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(c.pts[0], c.pts[1]);
      let tx = c.pts[0], ty = c.pts[1];
      for (let i = 1; i <= Math.ceil(grow); i++) {
        const f = Math.min(1, grow - (i - 1));
        tx = c.pts[i * 2 - 2] + (c.pts[i * 2] - c.pts[i * 2 - 2]) * f;
        ty = c.pts[i * 2 - 1] + (c.pts[i * 2 + 1] - c.pts[i * 2 - 1]) * f;
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      if (c.age < 2.4) {
        const k = c.age < 1.6 ? 1 : 1 - (c.age - 1.6) / 0.8;
        ctx.globalAlpha = 0.95 * k;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.7;
        const s = 1.8 + 1.4 * k;
        ctx.beginPath();
        ctx.moveTo(tx - s, ty); ctx.lineTo(tx + s, ty); ctx.moveTo(tx, ty - s); ctx.lineTo(tx, ty + s);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// Floe homes filled with water, all in one canvas (1 world px) over the water box: one
// draw per frame instead of one per floe. A floe's hole is added once its sprite exists.
let holes = null, holesG = null;
function addHole(f) {
  const b = S.wb;
  if (!holes) { holes = canvas(Math.ceil(b.w), Math.ceil(b.h)); holesG = holes.getContext('2d'); }
  if (f.holed) return;
  f.holed = true;
  holesG.drawImage(f.sil, f.x - b.x, f.y - b.y, f.w, f.h);
}

function drawFloes(ctx, r, t, q) {
  const still = q === 'low';
  const base = ctx.getTransform();
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  const vis = [];
  for (const f of S.floes) {
    if (f.x > r.x1 || f.y > r.y1 || f.x + f.w < r.x0 || f.y + f.h < r.y0) continue;
    if (!floeSprite(f)) continue;
    if (!f.holed) addHole(f);
    vis.push(f);
  }
  if (holes) {
    const b = S.wb;
    const x0 = Math.max(r.x0, b.x), y0 = Math.max(r.y0, b.y), x1 = Math.min(r.x1, b.x + b.w), y1 = Math.min(r.y1, b.y + b.h);
    if (x1 > x0 && y1 > y0) ctx.drawImage(holes, x0 - b.x, y0 - b.y, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }
  for (const f of vis) {
    const sp = f.sprite;
    const k = f.size > 200 ? 0.35 : f.size > 60 ? 0.7 : 1;
    const bob = still ? 0 : Math.sin(t * TAU / f.per + f.ph) * 1.7 * k;
    const ox = still ? 0 : Math.cos(t * f.orbSp + f.orb) * f.orbR * k;
    const oy = still ? 0 : Math.sin(t * f.orbSp + f.orb) * f.orbR * 0.5 * k;
    const rot = still ? 0 : Math.sin(t * TAU / (f.per * 1.7) + f.ph * 1.3) * f.rot * k;
    const cx = f.x + f.w / 2 + ox, cy = f.y + f.h / 2 + oy;
    const c = Math.cos(rot), sn = Math.sin(rot);
    // base * translate(cx, cy) * rotate(rot)
    ctx.setTransform(base.a * c + base.c * sn, base.b * c + base.d * sn, -base.a * sn + base.c * c, -base.b * sn + base.d * c,
      base.a * cx + base.c * cy + base.e, base.b * cx + base.d * cy + base.f);
    const lap = still ? 0 : Math.sin(t * 2.1 + f.ph) * 0.6;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(f.silLight, -f.w / 2, -f.h / 2 + bob + 2.6 + lap, f.w, f.h);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(f.silDark, -f.w / 2, -f.h / 2 + bob + 0.9 + Math.max(0, bob) * 0.6, f.w, f.h);
    ctx.globalAlpha = 1;
    ctx.drawImage(sp.cv, -f.w / 2, -f.h / 2 + bob, f.w, f.h);
  }
  ctx.restore();
}
