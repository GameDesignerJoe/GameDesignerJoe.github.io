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
// Budget by pixels, not entries: iOS WebKit caps total canvas memory per page
// and silently gives new canvases no backing store once it's exceeded (they
// draw as blank). 6M px ≈ 24 MB of RGBA keeps us well clear.
const MAX_PIXELS = 6_000_000;
let pixels = 0;
// If a sprite canvas comes back blank anyway, flush and retry; after repeated
// failures, stop caching and paint every layer live (slower, never invisible).
let failures = 0;
let liveMode = false;

function evict(key) {
  const s = cache.get(key);
  if (!s) return;
  pixels -= s.canvas.width * s.canvas.height;
  s.canvas.width = 0; s.canvas.height = 0; // lets Safari free it now
  cache.delete(key);
}

export function clearSprites() { for (const k of [...cache.keys()]) evict(k); }

let dpr = 1;
export function setPixelRatio(r) {
  if (r !== dpr) { dpr = r; clearSprites(); }
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

// Release a canvas's backing store now (WebKit otherwise waits for GC).
export function freeCanvas(c) {
  if (c) { c.width = 0; c.height = 0; }
}

// Paint a 1px marker in the corner and read it back: no backing store, no pixel.
function backed(ctx) {
  try {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    const ok = ctx.getImageData(0, 0, 1, 1).data[3] > 0;
    ctx.clearRect(0, 0, 1, 1);
    ctx.restore();
    return ok;
  } catch {
    return false;
  }
}

// bounds: { x, y, w, h } in painter units. paint(ctx) draws in those units.
export function sprite(id, bounds, scale, paint) {
  seen.add(id);
  if (liveMode) return { live: paint, bounds, id };
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
  if (!ctx || !backed(ctx)) {
    // Out of canvas memory: free everything we hold and draw this one live.
    freeCanvas(canvas);
    clearSprites();
    if (++failures >= 3) { liveMode = true; console.warn('sprite cache disabled: canvas memory exhausted, painting live'); }
    return { live: paint, bounds, id };
  }
  ctx.scale(q, q);
  ctx.translate(-bounds.x, -bounds.y);
  const img = overrides.get(id);
  if (img) ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h);
  else paint(ctx);
  s = { canvas, bounds };
  cache.set(key, s);
  pixels += canvas.width * canvas.height;
  while (pixels > MAX_PIXELS && cache.size > 1) evict(cache.keys().next().value);
  return s;
}

// Draw a cached sprite in the current transform (painter units).
export function blit(ctx, s) {
  const b = s.bounds;
  if (s.live) {
    // Uncached: run the painter (or draw the override) in place.
    ctx.save();
    const img = overrides.get(s.id);
    if (img) ctx.drawImage(img, b.x, b.y, b.w, b.h); else s.live(ctx);
    ctx.restore();
    return;
  }
  ctx.drawImage(s.canvas, b.x, b.y, b.w, b.h);
}

export const spriteStats = () => ({ entries: cache.size, pixels, failures, liveMode });
// Test hook: simulate exhausted canvas memory.
export function forceLiveSprites(on = true) { liveMode = on; if (on) clearSprites(); }
if (typeof window !== 'undefined') { window.spriteStats = spriteStats; window.forceLiveSprites = forceLiveSprites; }

export function listSpriteIds() { return [...seen].sort(); }
if (typeof window !== 'undefined') window.listSpriteIds = listSpriteIds;
