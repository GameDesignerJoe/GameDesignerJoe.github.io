// Life on the open sea, drawn by ground.js right after the map. Frozen lakes stay
// still apart from the white crack networks (icecracks.js).
//
// Open water (dark thin-ice / leads at the bottom centre):
//   - an animated caustic cell network: baked Worley F2-F1 frames, cross-faded in place,
//     squashed 0.8 vertically, masked to the painted water;
//   - wind waves above ~0.5 wind: small crescent whitecaps facing downwind that rise,
//     curl, break into spray and fade to foam;
//   - every white floe cut from the painting and laid crisply over the water effects, riding
//     a slight swell in place (no drift: its drawn edge is the walkable edge);
//   - the open water darkened a step so it reads as lethal, and the wading shelf along the
//     shore (terrain.WADE_DEPTH) paler, with a stippled ink line where it drops off.
// state.quality.level: high = all; medium = one caustic layer, fewer waves; low = also
// lower res, static floes. ?nolakes turns it all off.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import { mask, classAt, lumAt, isWater, waterDepth, WATER_LUM, WADE_DEPTH } from './terrain.js';
import { drawIceCracks } from './icecracks.js';
import { tileAt, mapImage, TILE_SCALE, TILE_SIZE, TILE_GUTTER } from './map.js';

const ICE = 2, THIN = 3;
const TAU = Math.PI * 2;
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
  const ice = null; void iceAny;   // frozen lakes are drawn still: no mask needed

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
  S = { ice, water, wb, floes, iceScale: m.scale * 2, dark: null, shelf: null };
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
let fx = null, fxg = null, coverT = 0;
const cover = { ice: false, water: false };

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


// --- caustic cells (open water) -----------------------------------------------------------
// A tiling 128 x 128 texture (1 texel = 1 world px before the 0.8 vertical squash) of
// Worley F2-F1 edge lines: a connected network of rounded, oblong light cells. Seeds orbit
// small circles so the loop closes; CAUSTIC_FRAMES frames are baked once and cross-faded.
const CT = 128, CAUSTIC_FRAMES = 12, CAUSTIC_LOOP = 9;   // seconds per loop
let caustic = null;
function bakeCaustic() {
  const r = rng(4242);
  const N = 10;                                 // seed grid N x N (cells ~13 px)
  const cell = CT / N;
  const seeds = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    seeds.push({
      x: (i + 0.15 + r() * 0.7) * cell, y: (j + 0.15 + r() * 0.7) * cell,
      rx: 1.5 + r() * 2.5, ry: 1.5 + r() * 2.5, ph: r() * TAU, k: r() < 0.5 ? 1 : 2,
    });
  }
  caustic = [];
  for (let f = 0; f < CAUSTIC_FRAMES; f++) {
    const a = (f / CAUSTIC_FRAMES) * TAU;
    const pos = seeds.map(s => [s.x + Math.cos(a * s.k + s.ph) * s.rx, s.y + Math.sin(a * s.k + s.ph) * s.ry]);
    const c = canvas(CT, CT), g = c.getContext('2d'), id = g.createImageData(CT, CT), d = id.data;
    for (let y = 0; y < CT; y++) {
      for (let x0 = 0; x0 < CT; x0++) {
        // Tileable domain warp: bends straight Voronoi edges into rounded, wavy ones.
        const w1 = (TAU / CT) * 4, w2 = (TAU / CT) * 6;
        const x = x0 + 2.4 * Math.sin(y * w1 + a + 1.3) + 1.0 * Math.sin(y * w2 - a * 2);
        const yy = y + 2.4 * Math.sin(x0 * w1 - a + 0.7) + 1.0 * Math.sin(x0 * w2 + a * 2);
        const gi = Math.floor((((x % CT) + CT) % CT) / cell), gj = Math.floor((((yy % CT) + CT) % CT) / cell);
        const xw = ((x % CT) + CT) % CT, yw = ((yy % CT) + CT) % CT;
        let f1 = 1e9, f2 = 1e9;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const ii = (gi + di + N) % N, jj = (gj + dj + N) % N;
          const p = pos[jj * N + ii];
          // wrap the seed into this neighbourhood
          let px = p[0] + (gi + di - ii) * cell, py = p[1] + (gj + dj - jj) * cell;
          const dd = Math.hypot(px - xw - 0.5, py - yw - 0.5);
          if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
        }
        const e = (f2 - f1) * (0.7 + 0.3 * Math.min(1, f1 / 5));   // borders; junctions open into rounded corners
        const line = Math.max(0, 1 - e / 1.7);    // ~1.5 px soft line
        const glow = Math.max(0, 1 - e / 3) * 0.15;
        const v = Math.min(1, line * line * (3 - 2 * line) + glow);
        const o = (y * CT + x0) * 4;
        d[o] = 232; d[o + 1] = 236; d[o + 2] = 240; d[o + 3] = Math.round(v * 255);
      }
    }
    g.putImageData(id, 0, 0);
    caustic.push(c);
  }
}

// --- wind waves (whitecaps) ---------------------------------------------------------------
// A short crescent ridge facing downwind: rises (dark band + light crest), curls, breaks
// into white spray, flattens into a foam patch that fades. ~1.5-3 s each, over open water.
const waves = [];
let waveTimer = 0;

function updateWaves(dt, r, wind) {
  const ws = wind.speed + wind.gust * 0.6;
  const q = state.quality.level;
  const strength = Math.max(0, Math.min(1, (ws - 0.45) / 0.6));
  const wx = Math.cos(wind.angle), wy = Math.sin(wind.angle);
  const cap = q === 'low' ? 8 : q === 'medium' ? 18 : 30;
  waveTimer -= dt;
  if (strength > 0 && cover.water && waveTimer <= 0 && waves.length < cap) {
    waveTimer = 0.22 / (0.3 + strength * 3);
    for (let k = 0; k < 6; k++) {
      const x = r.x0 + Math.random() * (r.x1 - r.x0), y = r.y0 + Math.random() * (r.y1 - r.y0);
      const w = 12 + Math.random() * 10;
      // whole crest must sit on open water
      const px = -wy, py = wx;
      if (!isWater(x, y) || !isWater(x + px * w / 2, y + py * w / 2 * 0.8) || !isWater(x - px * w / 2, y - py * w / 2 * 0.8) || !isWater(x + wx * 6, y + wy * 5)) continue;
      waves.push({ x, y, w, age: 0, life: 1.5 + Math.random() * 1.5, sp: 3 + strength * 6, seed: Math.random() * 1000 });
      break;
    }
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const v = waves[i];
    v.age += dt;
    v.x += wx * v.sp * dt; v.y += wy * v.sp * dt * 0.8;
    if (v.age > v.life || !isWater(v.x, v.y)) waves.splice(i, 1);
  }
}

function drawWaves(ctx, wind) {
  if (!waves.length) return;
  const wa = wind.angle;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const v of waves) {
    const k = v.age / v.life;                     // 0..1
    // phases: rise 0-.35, curl .35-.55, break .55-.7, foam .7-1
    const rise = Math.min(1, k / 0.35), fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const h = (k < 0.55 ? rise : Math.max(0, 1 - (k - 0.55) / 0.25)) * 3.2;   // ridge height (px)
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.scale(1, 0.8);
    // Crest faces downwind but leans toward horizontal in this oblique view (side-on
    // ridges read as slashes): local +y = the wave's travel direction, tilted <= 35 deg.
    const toward = Math.sin(wa) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    let d = wa - toward; d = Math.atan2(Math.sin(d), Math.cos(d));
    ctx.rotate(toward + Math.max(-0.6, Math.min(0.6, d * 0.4)) - Math.PI / 2 + Math.PI);
    const hw = v.w / 2;
    // soft grey under-shadow (downwind side)
    if (h > 0.2) {
      ctx.globalAlpha = 0.35 * fade;
      ctx.fillStyle = 'rgb(70,74,78)';
      ctx.beginPath();
      ctx.moveTo(-hw, 0.5); ctx.quadraticCurveTo(0, 0.5 + h * 1.4, hw, 0.5);
      ctx.quadraticCurveTo(0, 0.5 + h * 0.4, -hw, 0.5); ctx.fill();
    }
    // the ridge: a filled body (darker back, lighter face) with a light crest line
    if (k < 0.7) {
      const curl = k > 0.35 ? Math.min(1, (k - 0.35) / 0.2) : 0;
      ctx.globalAlpha = 0.6 * fade;
      ctx.fillStyle = 'rgb(96,100,104)';
      ctx.beginPath();
      ctx.moveTo(-hw, 0.8); ctx.quadraticCurveTo(0, 0.8 - h * 1.1, hw, 0.8);
      ctx.quadraticCurveTo(0, 0.8 + h * 0.5, -hw, 0.8); ctx.fill();
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = 'rgb(200,205,210)';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.9, 0); ctx.quadraticCurveTo(0, -h - 0.3, hw * 0.9, 0);
      ctx.quadraticCurveTo(0, -h * 0.35, -hw * 0.9, 0); ctx.fill();
      ctx.globalAlpha = 0.95 * fade;
      ctx.strokeStyle = 'rgb(240,243,246)'; ctx.lineWidth = 0.7 + h * 0.15;
      ctx.beginPath(); ctx.moveTo(-hw * 0.85, -0.1); ctx.quadraticCurveTo(0, -h - 0.5, hw * (0.85 - curl * 0.1), -0.1 + curl * 1.4);
      ctx.stroke();
    }
    // spray and foam
    if (k > 0.5) {
      const R = rng(v.seed | 0);
      const fk = Math.min(1, (k - 0.5) / 0.2);
      ctx.fillStyle = 'rgb(246,248,250)';
      const n = 8 + ((v.w * 0.8) | 0);
      for (let i = 0; i < n; i++) {
        const u = R() * 2 - 1, spread = R();
        const x = u * hw * (0.9 + fk * 0.2), y = -0.4 + spread * (0.6 + fk * 2.2) + (k > 0.7 ? (k - 0.7) * 3 : 0);
        const s = (0.5 + R() * 0.7) * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.45);
        if (s <= 0.05) continue;
        ctx.globalAlpha = 0.9 * fade;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawLakes(ctx) {
  const m = mask();
  if (!m || state.params.has('nolakes')) return;
  if (builtVersion !== m.version) build(m);
  const q = state.quality.level;
  const r = visibleRect(6);
  const dt = Math.min(0.05, state.dt || 0);
  coverT -= dt;
  if (coverT <= 0) { coverT = 0.25; updateCover(r); }
  const wind = state.wind;
  updateWaves(dt, r, wind);

  // Frozen lakes are still: only the white crack networks.
  drawIceCracks(ctx, r, dt, cover.ice);
  if (!cover.water || !S.water) return;
  if (!caustic) bakeCaustic();

  const t = state.time;
  const res = Math.min(state.cam.zoom, 2.5) * (q === 'high' ? 1 : q === 'medium' ? 0.7 : 0.5);
  const W = Math.min(1100, Math.ceil((r.x1 - r.x0) * res)), H = Math.min(1100, Math.ceil((r.y1 - r.y0) * res));
  const sx = W / (r.x1 - r.x0), sy = H / (r.y1 - r.y0);
  ensureFx(W, H);
  const g = fxg;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, W, H);
  g.setTransform(sx, 0, 0, sy, -r.x0 * sx, -r.y0 * sy);
  g.imageSmoothingEnabled = true;
  // Caustic cells: cross-fade two baked frames, in place. (The sheet used to drift with
  // offset = time x wind, which lurched the whole sheet sideways whenever the wind changed.)
  const ph = ((t / CAUSTIC_LOOP) % 1) * CAUSTIC_FRAMES;
  const f0 = Math.floor(ph) % CAUSTIC_FRAMES, f1 = (f0 + 1) % CAUSTIC_FRAMES, fr = ph - Math.floor(ph);
  const dx = 0, dy = 0;
  const base = 0.5;
  patternFill(g, caustic[f0], r, 0, dx, dy, 1, base * (1 - fr), 0.8);
  patternFill(g, caustic[f1], r, 0, dx, dy, 1, base * fr, 0.8);
  if (q === 'high') {
    // a second, larger and slower layer, faint: breaks up the repeat
    const ph2 = ((t / (CAUSTIC_LOOP * 1.7) + 0.37) % 1) * CAUSTIC_FRAMES;
    const g0 = Math.floor(ph2) % CAUSTIC_FRAMES, g1 = (g0 + 1) % CAUSTIC_FRAMES, gr = ph2 - Math.floor(ph2);
    patternFill(g, caustic[g0], r, 0.6, dx * 0.6 + 41, dy * 0.6 + 23, 1.6, 0.3 * (1 - gr), 0.8);
    patternFill(g, caustic[g1], r, 0.6, dx * 0.6 + 41, dy * 0.6 + 23, 1.6, 0.3 * gr, 0.8);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  const b = S.wb;
  g.drawImage(S.water, b.x, b.y, b.w, b.h);
  g.globalCompositeOperation = 'source-over';
  drawDeepAndShelf(ctx);
  ctx.drawImage(fx, 0, 0, W, H, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  drawWaves(ctx, wind);
  drawFloes(ctx, r, t, q);
}

// The water's value and the wading shelf, both baked once over the water box (mask res):
//   dark  - the open water tinted down toward a cold slate (drawn at partial alpha);
//   shelf - water within WADE_DEPTH of land lifted paler, and stipple dots of ink along the
//           line where it drops off into deep water (the explorer wades there, swims beyond).
function buildDeepAndShelf() {
  const b = S.wb, m = mask(), sc = m.scale;
  const w = Math.max(1, Math.round(b.w / sc)), h = Math.max(1, Math.round(b.h / sc));
  const dark = canvas(w, h), dg = dark.getContext('2d');
  dg.drawImage(S.water, 0, 0, w, h);
  dg.globalCompositeOperation = 'source-in';
  dg.fillStyle = 'rgb(58,64,72)'; dg.fillRect(0, 0, w, h);
  // The depth field sampled at the mask's resolution once, then read bilinearly at 1 world px
  // per pixel with a soft threshold, so the shelf has a smooth edge at any zoom (no squares).
  const D = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) D[y * w + x] = waterDepth(b.x + (x + 0.5) * sc, b.y + (y + 0.5) * sc);
  const at = (x, y) => D[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  const bil = (fx, fy) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a0 = at(x0, y0), a1 = at(x0 + 1, y0), a2 = at(x0, y0 + 1), a3 = at(x0 + 1, y0 + 1);
    // water / land coverage blends too (0 depth is land), so the shelf's outer edge is soft
    return [(a0 + (a1 - a0) * tx) * (1 - ty) + (a2 + (a3 - a2) * tx) * ty,
      ((a0 > 0) + ((a1 > 0) - (a0 > 0)) * tx) * (1 - ty) + ((a2 > 0) + ((a3 > 0) - (a2 > 0)) * tx) * ty];
  };
  const W1 = Math.ceil(b.w), H1 = Math.ceil(b.h);
  const shelf = canvas(W1, H1), sg = shelf.getContext('2d'), img = sg.createImageData(W1, H1), d = img.data, dots = [];
  // a seeded scatter for the stipple
  let seed = 4242; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < H1; y++) for (let x = 0; x < W1; x++) {
    const [dp, cov] = bil(x / sc - 0.5, y / sc - 0.5);
    if (cov < 0.02) continue;
    const i = (y * W1 + x) * 4;
    const sh = Math.max(0, Math.min(1, (WADE_DEPTH + 1.2 - dp) / 2.4));   // soft step across the drop-off
    const a = sh * cov;
    if (a > 0.01) { d[i] = 214; d[i + 1] = 218; d[i + 2] = 222; d[i + 3] = Math.round(150 * a); }
    // stipple: scattered along the drop-off contour, thinning out into the deep side
    const off = dp - WADE_DEPTH;
    if (cov > 0.9 && off > -1 && off < 4) {
      const p = off < 0.8 ? 0.16 : 0.16 * Math.max(0, 1 - (off - 0.8) / 3.2) * 0.45;
      if (rnd() < p) dots.push(b.x + x + (rnd() - 0.5) * 1.2, b.y + y + (rnd() - 0.5) * 1.2, 0.18 + rnd() * 0.2);
    }
  }
  sg.putImageData(img, 0, 0);
  S.dark = dark; S.shelf = shelf; S.dots = dots;
}
function drawDeepAndShelf(ctx) {
  if (!S || !S.wb) return;
  if (!S.dark) buildDeepAndShelf();
  const b = S.wb;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.5;
  ctx.drawImage(S.dark, b.x, b.y, b.w, b.h);
  ctx.globalAlpha = 1;
  ctx.drawImage(S.shelf, b.x, b.y, b.w, b.h);
  // stipple along the drop-off (culled to the view)
  // (one path, culled: a few hundred tiny arcs at most on screen)
  const r = visibleRect(4), dd = S.dots;
  ctx.fillStyle = 'rgba(52,56,62,0.6)';
  ctx.beginPath();
  for (let i = 0; i < dd.length; i += 3) {
    const x = dd[i], y = dd[i + 1], rr = dd[i + 2];
    if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
    ctx.moveTo(x + rr, y); ctx.ellipse(x, y, rr, rr * 0.8, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
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
    vis.push(f);
  }
  // (no water-filled holes under them: they don't drift any more, and the holes showed as
  // pale boxes over the darkened water)
  if (false && holes) {
    const b = S.wb;
    const x0 = Math.max(r.x0, b.x), y0 = Math.max(r.y0, b.y), x1 = Math.min(r.x1, b.x + b.w), y1 = Math.min(r.y1, b.y + b.h);
    if (x1 > x0 && y1 > y0) ctx.drawImage(holes, x0 - b.x, y0 - b.y, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }
  for (const f of vis) {
    const sp = f.sprite;
    // ride the swell in place: the explorer walks on the painted floe, so it may not drift
    const k = f.size > 200 ? 0.35 : f.size > 60 ? 0.7 : 1;
    const bob = still ? 0 : Math.sin(t * TAU / f.per + f.ph) * 0.3 * k;
    const ox = 0, oy = 0, rot = 0;
    const cx = f.x + f.w / 2 + ox, cy = f.y + f.h / 2 + oy;
    const c = Math.cos(rot), sn = Math.sin(rot);
    // base * translate(cx, cy) * rotate(rot)
    ctx.setTransform(base.a * c + base.c * sn, base.b * c + base.d * sn, -base.a * sn + base.c * c, -base.b * sn + base.d * c,
      base.a * cx + base.c * cy + base.e, base.b * cx + base.d * cy + base.f);
    // (no extra waterline bands: the floe's own painted ink is its edge)
    ctx.drawImage(sp.cv, -f.w / 2, -f.h / 2 + bob, f.w, f.h);
  }
  ctx.restore();
}
