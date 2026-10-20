// Sprite cache. Procedural painters are expensive (clips, dozens of arcs), so
// each one is rendered once per (id, pixel scale) into an offscreen canvas and
// blitted from then on.
//
// Art overrides: data/sprites.json maps a sprite id to an image file. If an id
// is listed, the image is drawn into the sprite's bounds instead of running
// the painter — so a hand-drawn PNG/SVG can replace any procedural part
// without touching code. Ids are printed by `listSpriteIds()` in the console.

const cache = new Map();
const overrides = new Map();
const seen = new Set();
const MAX = 900;

let dpr = 1;
export function setPixelRatio(r) {
  if (r !== dpr) { dpr = r; cache.clear(); }
}

export async function loadOverrides(url) {
  let map = {};
  try { map = await (await fetch(url)).json(); } catch { return; }
  const base = new URL(url, location.href);
  await Promise.all(Object.entries(map).filter(([k]) => !k.startsWith('_')).map(([id, file]) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => { overrides.set(id, img); ok(); };
    img.onerror = () => { console.warn('sprite override failed to load:', id, file); ok(); };
    img.src = new URL(file, base).href;
  })));
}

// Scales snap to quarter-octave buckets so a sheep that breathes or bounces
// doesn't mint a new cache entry every frame.
function bucket(scale) {
  const s = Math.max(0.05, scale * dpr);
  return Math.pow(2, Math.ceil(Math.log2(s) * 4) / 4);
}

// bounds: { x, y, w, h } in painter units. paint(ctx) draws in those units.
export function sprite(id, bounds, scale, paint) {
  seen.add(id);
  const q = bucket(scale);
  const key = id + '@' + q;
  let s = cache.get(key);
  if (s) {
    // refresh LRU position
    cache.delete(key); cache.set(key, s);
    return s;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(bounds.w * q));
  canvas.height = Math.max(1, Math.ceil(bounds.h * q));
  const ctx = canvas.getContext('2d');
  ctx.scale(q, q);
  ctx.translate(-bounds.x, -bounds.y);
  const img = overrides.get(id);
  if (img) ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h);
  else paint(ctx);
  s = { canvas, bounds };
  cache.set(key, s);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return s;
}

// Draw a cached sprite in the current transform (painter units).
export function blit(ctx, s) {
  const b = s.bounds;
  ctx.drawImage(s.canvas, b.x, b.y, b.w, b.h);
}

export function listSpriteIds() { return [...seen].sort(); }
if (typeof window !== 'undefined') window.listSpriteIds = listSpriteIds;
