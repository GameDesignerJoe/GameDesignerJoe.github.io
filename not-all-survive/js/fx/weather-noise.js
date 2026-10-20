// Weather textures. Everything here is generated once at init into small offscreen
// canvases; the per-frame code only scrolls, scales and composites them.
// Total texture memory is well under 2 MB.

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Fills world rect r with a pattern laid out in the wind's frame (angle a), scrolled by u, v.
export function fillWind(g, pat, tw, th, scale, u, v, r, a) {
  const c = Math.cos(a), s = Math.sin(a);
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]]) {
    const uu = x * c + y * s, vv = -x * s + y * c;
    umin = Math.min(umin, uu); umax = Math.max(umax, uu); vmin = Math.min(vmin, vv); vmax = Math.max(vmax, vv);
  }
  g.save();
  g.rotate(a);
  g.scale(scale, scale);
  const ou = (u / scale) % tw, ov = (v / scale) % th;
  g.translate(ou, ov);
  g.fillStyle = pat;
  g.fillRect(umin / scale - ou - tw, vmin / scale - ov - th, (umax - umin) / scale + tw * 2, (vmax - vmin) / scale + th * 2);
  g.restore();
  return { umin, umax, vmin, vmax };
}

const smooth = t => t * t * (3 - 2 * t);
export const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Tileable fractal value noise, w x h samples, 0..1. px/py: lattice cells across the
// tile on each axis for the first octave (different values give stretched features).
export function fbm(w, h, { px = 4, py = 4, octaves = 4, seed = 1, gain = 0.5 } = {}) {
  const out = new Float32Array(w * h);
  const r = rng(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = px << o, cy = py << o;
    const lat = new Float32Array(cx * cy);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * cy, iy = Math.floor(fy), ty = smooth(fy - iy);
      const y0 = (iy % cy) * cx, y1 = ((iy + 1) % cy) * cx;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * cx, ix = Math.floor(fx), tx = smooth(fx - ix);
        const x0 = ix % cx, x1 = (ix + 1) % cx;
        const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * tx;
        const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * tx;
        out[y * w + x] += (a + (b - a) * ty) * amp;
      }
    }
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  // Stretch contrast: value noise clusters around 0.5.
  let lo = 1, hi = 0;
  for (let i = 0; i < out.length; i++) { if (out[i] < lo) lo = out[i]; if (out[i] > hi) hi = out[i]; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
  return out;
}

// Resamples a tile with a vertical offset that varies along x (all periodic, so it still tiles).
function warp(vals, w, h, amp, n1, n2) {
  const out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const off = amp * Math.sin((x / w) * Math.PI * 2 * n1 + (y / h) * Math.PI * 2)
                + amp * 0.5 * Math.sin((x / w) * Math.PI * 2 * n2 + 1.3);
      const yy = ((Math.round(y + off) % h) + h) % h;
      out[y * w + x] = vals[yy * w + x];
    }
  }
  return out;
}

// values -> canvas. color(v) returns [r, g, b, a] with a in 0..1.
function paint(w, h, vals, color) {
  const c = canvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    const [r, gg, b, a] = color(vals[i], i);
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = Math.max(0, Math.min(255, a * 255));
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function makeTextures() {
  const T = {};

  // Cloud shadows: big soft grey masses with clear gaps between them.
  T.cloud = paint(128, 128, fbm(128, 128, { px: 3, py: 3, octaves: 4, seed: 11 }),
    v => [118, 122, 126, smoothstep(0.42, 0.78, v)]);

  // Whiteout / fog bank texture: billowing white with structure.
  T.fog = paint(256, 256, fbm(256, 256, { px: 4, py: 4, octaves: 5, seed: 23, gain: 0.55 }),
    v => [240, 242, 243, smoothstep(0.18, 0.9, v)]);

  // Grey billows: the darker undersides of blowing snow clouds in a whiteout.
  T.fogGrey = paint(256, 256, fbm(256, 256, { px: 3, py: 3, octaves: 4, seed: 61, gain: 0.5 }),
    v => [184, 188, 192, smoothstep(0.42, 0.88, v)]);

  // Thin, ragged fog for banks lying low across the ground.
  T.haze = paint(256, 256, fbm(256, 256, { px: 2, py: 5, octaves: 5, seed: 37, gain: 0.6 }),
    v => [244, 245, 246, Math.pow(smoothstep(0.35, 1, v), 1.4)]);

  // Drift streaks: long along x, fine across y. Tiled and rotated to the wind.
  const st = fbm(256, 128, { px: 2, py: 22, octaves: 3, seed: 51, gain: 0.45 });
  T.streak = paint(256, 128, st, v => [250, 250, 250, Math.pow(smoothstep(0.52, 0.95, v), 1.3)]);
  

  // Patchiness mask for the drift sheets (0.2..1 so it thins but never vanishes).
  T.blob = paint(64, 64, fbm(64, 64, { px: 2, py: 2, octaves: 3, seed: 91 }),
    v => [255, 255, 255, 0.15 + 0.85 * smoothstep(0.25, 0.8, v)]);

  // Paper grain: mostly faint dark specks with a few light ones, like the print.
  const gr = rng(7);
  T.grain = paint(128, 128, new Float32Array(128 * 128), () => {
    const v = gr();
    if (v < 0.5) return [30, 30, 30, (0.5 - v) * 0.3];
    return [255, 255, 255, (v - 0.5) * 0.3];
  });

  // Soft flake sprite (out of focus): white core, faint grey halo so it reads on snow.
  T.flake = canvas(64, 64);
  {
    const g = T.flake.getContext('2d');
    let gd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gd.addColorStop(0, 'rgba(255,255,255,0.95)');
    gd.addColorStop(0.45, 'rgba(252,252,252,0.6)');
    gd.addColorStop(0.75, 'rgba(200,204,208,0.18)');
    gd.addColorStop(1, 'rgba(200,204,208,0)');
    g.fillStyle = gd; g.fillRect(0, 0, 64, 64);
  }

  T.flakeGrey = canvas(64, 64);
  {
    const g = T.flakeGrey.getContext('2d');
    const gd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gd.addColorStop(0, 'rgba(160,164,168,0.85)');
    gd.addColorStop(0.55, 'rgba(172,176,180,0.45)');
    gd.addColorStop(1, 'rgba(190,194,198,0)');
    g.fillStyle = gd; g.fillRect(0, 0, 64, 64);
  }

  // Billow sprites for avalanche clouds: cel-shaded discs with a soft rim, not airbrush.
  const disc = (rgb, a) => {
    const c = canvas(64, 64), g = c.getContext('2d');
    const gd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gd.addColorStop(0, `rgba(${rgb},${a})`);
    gd.addColorStop(0.78, `rgba(${rgb},${a})`);
    gd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gd; g.fillRect(0, 0, 64, 64);
    return c;
  };
  T.billow = disc('250,250,251', 1);
  T.billowShade = disc('184,188,192', 0.9);

  // Cold vignette: transparent middle, pale grey frost at the rim.
  T.vignette = canvas(128, 128);
  {
    const g = T.vignette.getContext('2d');
    const gd = g.createRadialGradient(64, 64, 20, 64, 64, 92);
    gd.addColorStop(0, 'rgba(232,234,236,0)');
    gd.addColorStop(0.5, 'rgba(232,234,236,0.25)');
    gd.addColorStop(0.8, 'rgba(236,238,240,0.7)');
    gd.addColorStop(1, 'rgba(242,243,244,1)');
    g.fillStyle = gd; g.fillRect(0, 0, 128, 128);
  }

  // Frost sprites are built at screen scale by weather-screen.js.
  return T;
}

// Feather frost for the top-left corner of the screen: thin grey hairline stems that
// creep along the two screen edges, with barbs on the inward side and ink stipple.
// No radial symmetry. Returned as STAGES canvases, each holding everything grown up
// to that distance from the corner, so the screen can cross-fade between them.
export const FROST_STAGES = 4;
export function makeFrost(S, seed = 1234) {
  const r = rng(seed);
  const segs = [], dots = [];
  // dist: how far from the corner along the edges (0..1), drives the reveal.
  const dist = (x, y) => Math.max(x, y) / S + Math.min(x, y) / S * 0.6;

  function feather(x, y, a, len, curl, w, depth) {
    const step = 3.2, n = Math.floor(len / step);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
      segs.push([x, y, nx, ny, w * (1 - t * 0.6), dist(nx, ny)]);
      if (r() < 0.12) dots.push([nx + (r() - 0.5) * 5, ny + (r() - 0.5) * 5, dist(nx, ny)]);
      if (depth > 0 && i > 1 && i % 2 === 0) {
        // Barbs mostly on the inward side, swept back toward the tip, uneven lengths.
        const inward = curl > 0 ? 1 : -1;
        const side = r() < 0.8 ? inward : -inward;
        const bl = len * (0.08 + 0.16 * (1 - t)) * (0.5 + r() * 0.8) * (side === inward ? 1 : 0.5);
        if (bl > 3) feather(nx, ny, a + side * (0.45 + r() * 0.35), bl, curl * 0.5, w * 0.6, depth - 1);
      }
      x = nx; y = ny;
      a += curl * (0.5 + r()) + (r() - 0.5) * 0.08;
    }
  }
  // Stems creeping down the left edge and along the top edge.
  for (let edge = 0; edge < 2; edge++) {
    const count = 6 + Math.floor(r() * 3);
    for (let i = 0; i < count; i++) {
      const along = Math.pow(r(), 1.6) * S * 0.55, off = r() * S * 0.05;
      const tilt = 0.12 + r() * 0.5;
      const len = S * (0.25 + r() * 0.55) * (1 - along / S * 0.6);
      const curl = (0.004 + r() * 0.01) * (edge ? 1 : -1);
      if (edge === 0) feather(off, along, Math.PI / 2 - tilt, len, curl, 1.1, 2);
      else feather(along, off, tilt, len, -curl, 1.1, 2);
    }
  }
  // A few short stems out of the corner itself.
  for (let i = 0; i < 3; i++) feather(r() * 6, r() * 6, 0.35 + r() * 0.8, S * (0.12 + r() * 0.15), (r() - 0.5) * 0.02, 1, 1);
  // Loose stipple hugging the edges.
  for (let i = 0; i < 120; i++) {
    const d = Math.pow(r(), 1.5) * S * 0.8, o = Math.pow(r(), 2) * S * 0.12;
    const [x, y] = r() < 0.5 ? [o, d] : [d, o];
    dots.push([x, y, dist(x, y)]);
  }

  const stages = [];
  for (let k = 1; k <= FROST_STAGES; k++) {
    const lim = (k / FROST_STAGES) * 0.95;
    const c = canvas(S, S), g = c.getContext('2d');
    // Faint rime hugging both edges.
    let gd = g.createLinearGradient(0, 0, S * 0.1, 0);
    gd.addColorStop(0, `rgba(246,247,248,${0.5 * k / FROST_STAGES})`); gd.addColorStop(1, 'rgba(246,247,248,0)');
    g.fillStyle = gd; g.fillRect(0, 0, S * 0.1, S * lim);
    gd = g.createLinearGradient(0, 0, 0, S * 0.1);
    gd.addColorStop(0, `rgba(246,247,248,${0.5 * k / FROST_STAGES})`); gd.addColorStop(1, 'rgba(246,247,248,0)');
    g.fillStyle = gd; g.fillRect(0, 0, S * lim, S * 0.1);
    g.lineCap = 'round';
    // White under-stroke so the grey hairline reads over grey ground too.
    for (const pass of [0, 1]) {
      for (const s of segs) {
        if (s[5] > lim) continue;
        const fade = Math.min(1, (lim - s[5]) / 0.08);
        g.strokeStyle = pass ? `rgba(172,175,178,${0.9 * fade})` : `rgba(252,252,253,${0.7 * fade})`;
        g.lineWidth = pass ? s[4] : s[4] + 1.4;
        g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke();
      }
    }
    for (const d of dots) {
      if (d[2] > lim) continue;
      g.fillStyle = `rgba(130,133,136,${0.6 * Math.min(1, (lim - d[2]) / 0.08)})`;
      g.fillRect(d[0], d[1], 1.2, 1.2);
    }
    stages.push(c);
  }
  return stages;
}

// Edge frost: a strip of feather frost rooted along one screen edge (y = 0) and growing
// inward (+y), L long and D deep. Stages reveal it by inward depth, so the screen can
// grow it from a rime along the edge to fronds reaching D into the view.
export function makeFrostStrip(L, D, seed = 4321) {
  const r = rng(seed);
  const segs = [], dots = [];
  function frond(x, y, a, len, curl, w, depth) {
    const step = 3.2, n = Math.floor(len / step);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
      segs.push([x, y, nx, ny, w * (1 - t * 0.6), ny / D]);
      if (r() < 0.1) dots.push([nx + (r() - 0.5) * 5, ny + (r() - 0.5) * 5, ny / D]);
      if (depth > 0 && i > 0) {
        const side = i % 2 ? 1 : -1;     // barbs alternate sides like a feather
        const bl = len * (0.07 + 0.14 * (1 - t)) * (0.5 + r() * 0.7);
        if (bl > 3) frond(nx, ny, a + side * (0.45 + r() * 0.35), bl, curl * 0.5, w * 0.6, depth - 1);
      }
      x = nx; y = ny;
      a += curl * (0.5 + r()) + (r() - 0.5) * 0.08;
    }
  }
  // Roots kept away from the strip's ends (tiles overlap), fronds reaching inward with
  // a gentle lean and curl; a few long ones, many short ones.
  const count = Math.round(L / 26);
  for (let i = 0; i < count; i++) {
    const x = L * (0.16 + 0.68 * (i + r()) / count);
    const lean = (r() - 0.5) * 0.9;
    const len = D * (0.18 + Math.pow(r(), 1.6) * 0.8);
    frond(x, r() * 3, Math.PI / 2 - lean, len, (r() - 0.5) * 0.05, 1.05, 2);
  }
  for (let i = 0; i < L / 4; i++) { const y = Math.pow(r(), 2.2) * D * 0.6; dots.push([L * (0.1 + 0.8 * r()), y, y / D]); }

  const stages = [];
  for (let k = 1; k <= FROST_STAGES; k++) {
    const lim = k / FROST_STAGES;
    const c = canvas(L, D), g = c.getContext('2d');
    const gd = g.createLinearGradient(0, 0, 0, D * 0.25 * lim + 4);
    gd.addColorStop(0, `rgba(246,247,248,${0.55 * lim})`); gd.addColorStop(1, 'rgba(246,247,248,0)');
    g.fillStyle = gd; g.fillRect(0, 0, L, D * 0.25 * lim + 4);
    g.lineCap = 'round';
    for (const pass of [0, 1]) for (const s of segs) {
      if (s[5] > lim) continue;
      const fade = Math.min(1, (lim - s[5]) / 0.08);
      g.strokeStyle = pass ? `rgba(172,175,178,${0.9 * fade})` : `rgba(252,252,253,${0.7 * fade})`;
      g.lineWidth = pass ? s[4] : s[4] + 1.4;
      g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke();
    }
    for (const d of dots) {
      if (d[2] > lim) continue;
      g.fillStyle = `rgba(130,133,136,${0.6 * Math.min(1, (lim - d[2]) / 0.08)})`;
      g.fillRect(d[0], d[1], 1.2, 1.2);
    }
    stages.push(c);
  }
  return stages;
}
