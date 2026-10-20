// Colour sets. Every procedural sprite pulls from here, so a re-skin is a data
// edit. `base` is the main fill, `mid` the curl shadow, `shade` the rim and
// `light` the highlight.

export const WOOL = {
  cream:    { base: '#fbf3df', mid: '#efe2c3', shade: '#d9c7a2', light: '#ffffff' },
  charcoal: { base: '#4a5372', mid: '#3d4561', shade: '#2f3650', light: '#6c789b' },
  cocoa:    { base: '#ad8058', mid: '#8f6440', shade: '#6b4729', light: '#d4a87c' },
  ash:      { base: '#c9ccd3', mid: '#b5b9c3', shade: '#9a9fac', light: '#eceef2' },
  rose:     { base: '#f6b9cf', mid: '#eca3bd', shade: '#d986a5', light: '#ffe2ec' },
  butter:   { base: '#f7dc8a', mid: '#ecca6b', shade: '#d4ab4c', light: '#fff2c4' },
  sky:      { base: '#a9d4f2', mid: '#92c2e6', shade: '#73a6cf', light: '#e1f2ff' },
  mint:     { base: '#b6e6c6', mid: '#9dd6b1', shade: '#7cbd93', light: '#e3fbe9' },
  lilac:    { base: '#cdb8ec', mid: '#b9a1e0', shade: '#9a80c9', light: '#ece2ff' },
};

export const FACE = {
  cream: { base: '#f3e6cc', shade: '#d8c39f', light: '#fffaf0', muzzle: '#f1cfc0', inner: '#f0a9a4' },
  tan:   { base: '#d9b48c', shade: '#b8906a', light: '#f0d4b4', muzzle: '#e8b9a3', inner: '#e8968f' },
  dark:  { base: '#3f4459', shade: '#2c3042', light: '#5d6481', muzzle: '#575d76', inner: '#c98a92' },
};

export const HORN = { base: '#5c6a8c', shade: '#3f4b69', light: '#8494b8' };
export const HOOF = { base: '#5a4636', shade: '#3e2f24', light: '#7b6350' };

// The wolf under the wool — slate blue-grey like the reference wolf.
export const WOLF = {
  grey:  { base: '#7a8aa6', mid: '#6a7994', shade: '#55627c', light: '#a4b2c9', pale: '#dfe5ee', dark: '#3a4358' },
  black: { base: '#3f4760', mid: '#363d53', shade: '#2a3043', light: '#5d6886', pale: '#8e98b0', dark: '#1d2130' },
  white: { base: '#e9eef6', mid: '#d6deea', shade: '#b7c3d6', light: '#ffffff', pale: '#ffffff', dark: '#7a8aa6' },
};

export const EYE = {
  white: '#ffffff',
  pupil: '#1d2030',
  wolf: '#f2c230',
  wolfRim: '#c58a12',
};

// --- colour-shift tell ---------------------------------------------------------
// A tinted disguise blends every tone of its wool toward a "wrong" version of
// the same colour: hue rotated, a touch darker and more saturated. Done per
// tone so it reads the same on cream, rose or charcoal. `amount` 0..1.

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255);
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function blend(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + [c(16), c(8), c(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function wrongColor(hex) {
  const [h, s, l] = hexToHsl(hex);
  // Dark wool gets lighter, light wool darker, so the shift always has room.
  const nl = l < 0.4 ? l + 0.16 : l - 0.12;
  // Near-greys have no hue to rotate, so give them a violet cast instead.
  if (s < 0.15) return hslToHex(265, 0.45, nl);
  return hslToHex(h + 30, Math.min(1, s * 1.1 + 0.08), nl);
}

// `strength` is a target perceptual difference (ΔE) between the real and the
// fake fleece, so "faint" is equally faint on every breed: ~5 faint, ~16 obvious.
export function tintAmount(base, strength) {
  const far = wrongColor(base);
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (colorDistance(base, blend(base, far, mid)) < strength) lo = mid; else hi = mid;
  }
  return hi;
}

export function tintPalette(pal, strength) {
  const t = tintAmount(pal.base, strength);
  const out = {};
  for (const k of Object.keys(pal)) out[k] = blend(pal[k], wrongColor(pal[k]), t);
  return out;
}

// Perceptual colour difference (CIE76 ΔE in Lab space): ~2 is barely
// noticeable side by side, ~10 is clear, ~25 is a different colour. Used to
// size the tint tell and to keep a tinted wolf off other breeds' colours.
function toLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function colorDistance(a, b) {
  const p = toLab(a), q = toLab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
