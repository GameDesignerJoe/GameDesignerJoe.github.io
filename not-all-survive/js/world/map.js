// The painted map is the world.
//
// Two layers:
//   base  - assets/map-sharp.webp (2464 x 1856, 1 px = 1 world unit), always loaded;
//           used on its own for wide views and as the fallback under everything.
//   tiles - assets/tiles/4/<tx>_<ty>.webp, a 4x Real-ESRGAN upscale (tools/gen_tiles.py)
//           cut into 128-world-unit tiles (512 px core + 4 px gutter each side). Loaded
//           around the camera only when the zoom calls for them, faded in over the
//           base, and kept in a small LRU cache (bitmaps are closed when evicted).
import { state, MAP_W, MAP_H } from '../state.js';
import { visibleRect } from '../camera.js';
// Occluder pieces (rock and cliff faces cut from this imagery) join the actor y-sort.
export { drawables } from './layers.js';

const SCALE = 4, TILE = 128, GUTTER = 4;
const NTX = Math.ceil(MAP_W / TILE), NTY = Math.ceil(MAP_H / TILE);
const TILE_URL = (tx, ty) => `assets/tiles/${SCALE}/${tx}_${ty}.webp`;
// Use tiles once a map px covers more than this many device px.
const TILE_MIN_DEVICE_ZOOM = 1.6;
const PREFETCH = 48;   // world units of margin loaded around the view
const FADE_MS = 280;
const MAX_INFLIGHT = 6;
const phone = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
// ~1.08 MB decoded per tile (520 x 520 x 4): phones ~52 MB, desktop ~104 MB.
const CAP = phone ? 48 : 96;
const noTiles = state.params.has('notiles');

let img = null;
const cache = new Map();     // key -> { bmp, w, h, t } in LRU order (oldest first)
const pending = new Set();
const failed = new Map();   // key -> time it may be retried (backoff)
const tries = new Map();    // key -> failures so far
const controllers = new Map(); // key -> AbortController for in-flight fetches
let inflight = 0;
const VISIBLE_SLOTS = 2;    // of MAX_INFLIGHT, kept free for on-screen tiles

export function init() {
  return new Promise(res => {
    img = new Image();
    img.onload = res;
    img.onerror = res;
    img.src = 'assets/map-sharp.webp';
  });
}

async function decode(url, signal) {
  if (typeof createImageBitmap === 'function') {
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(r.status);
    return createImageBitmap(await r.blob());
  }
  return new Promise((ok, bad) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = bad;
    im.src = url;
  });
}

function request(tx, ty) {
  const key = ty * NTX + tx;
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  pending.add(key);
  if (ac) controllers.set(key, ac);
  inflight++;
  decode(TILE_URL(tx, ty), ac?.signal)
    .then(bmp => {
      if (ac?.signal.aborted) { bmp.close?.(); return; }
      cache.set(key, { bmp, t: performance.now() }); tries.delete(key); evict();
    })
    .catch(err => {
      if (ac?.signal.aborted || err?.name === 'AbortError') return; // not a failure
      const n = (tries.get(key) || 0) + 1;
      tries.set(key, n);
      failed.set(key, performance.now() + Math.min(30000, 1000 * 2 ** n)); // 2s, 4s, 8s ... 30s
    })
    .finally(() => { pending.delete(key); controllers.delete(key); inflight--; });
}

// Abort fetches for tiles that have left the prefetch area (fast pans).
function abortOutside(tx0, ty0, tx1, ty1) {
  for (const [key, ac] of controllers) {
    const tx = key % NTX, ty = (key / NTX) | 0;
    if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) ac.abort();
  }
}

const visibleKeys = new Set();
function evict() {
  for (const [key, e] of cache) {
    if (cache.size <= CAP) break;
    if (visibleKeys.has(key)) continue;
    e.bmp.close?.();
    cache.delete(key);
  }
}

function dropAll() {
  for (const e of cache.values()) e.bmp.close?.();
  cache.clear();
}

export function drawGround(ctx) {
  if (!img?.complete) return;
  const r = visibleRect(4);
  const x0 = Math.max(0, Math.floor(r.x0)), y0 = Math.max(0, Math.floor(r.y0));
  const x1 = Math.min(img.width, Math.ceil(r.x1)), y1 = Math.min(img.height, Math.ceil(r.y1));
  if (x1 <= x0 || y1 <= y0) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Skip the full-screen base draw when opaque crisp tiles cover the whole view.
  if (noTiles || !tilesCover(r)) ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  if (!noTiles) drawTiles(ctx);
}

function tilesCover(r) {
  if (state.cam.zoom * state.view.dpr < TILE_MIN_DEVICE_ZOOM) return false;
  const now = performance.now();
  const tx0 = Math.max(0, Math.floor(r.x0 / TILE)), ty0 = Math.max(0, Math.floor(r.y0 / TILE));
  const tx1 = Math.min(NTX - 1, Math.floor(r.x1 / TILE)), ty1 = Math.min(NTY - 1, Math.floor(r.y1 / TILE));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const e = cache.get(ty * NTX + tx);
    if (!e || now - e.t < FADE_MS) return false;
  }
  return true;
}

let tilesOn = false;
function drawTiles(ctx) {
  const dz = state.cam.zoom * state.view.dpr;
  visibleKeys.clear();
  tilesOn = dz >= TILE_MIN_DEVICE_ZOOM;
  if (dz < TILE_MIN_DEVICE_ZOOM) {
    if (controllers.size) abortOutside(1, 1, 0, 0); // nothing wanted: abort all
    if (dz < 1.2 && cache.size) dropAll();
    return;
  }
  const now = performance.now();
  const bleed = Math.min(GUTTER / SCALE, 0.5 / state.cam.zoom);
  const r = visibleRect(0);
  const tx0 = Math.max(0, Math.floor(r.x0 / TILE)), ty0 = Math.max(0, Math.floor(r.y0 / TILE));
  const tx1 = Math.min(NTX - 1, Math.floor(r.x1 / TILE)), ty1 = Math.min(NTY - 1, Math.floor(r.y1 / TILE));

  // Draw what we have (and touch it in the LRU). Each tile is clipped to its exact
  // cell, drawn from its gutter so edge pixels are real neighbour pixels: no
  // double-painted overlap, so no faint lines at borders while tiles fade in.
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const key = ty * NTX + tx;
      visibleKeys.add(key);
      const e = cache.get(key);
      if (!e) continue;
      cache.delete(key); cache.set(key, e);
      const a = Math.min(1, (now - e.t) / FADE_MS);
      const cw = (e.bmp.width - 2 * GUTTER) / SCALE, ch = (e.bmp.height - 2 * GUTTER) / SCALE;
      if (a >= 1) {
        // Opaque: draw exactly the cell (plus half a screen px of real gutter pixels to
        // hide antialiased edges); no clip needed.
        const gp = bleed * SCALE;
        ctx.drawImage(e.bmp, GUTTER - gp, GUTTER - gp, cw * SCALE + 2 * gp, ch * SCALE + 2 * gp,
          tx * TILE - bleed, ty * TILE - bleed, cw + 2 * bleed, ch + 2 * bleed);
        continue;
      }
      // Fading in: clip to the cell so the overlap isn't painted twice.
      ctx.save();
      ctx.beginPath();
      ctx.rect(tx * TILE - bleed, ty * TILE - bleed, cw + 2 * bleed, ch + 2 * bleed);
      ctx.clip();
      ctx.globalAlpha = a * a * (3 - 2 * a);
      ctx.drawImage(e.bmp, 0, 0, e.bmp.width, e.bmp.height,
        tx * TILE - GUTTER / SCALE, ty * TILE - GUTTER / SCALE, e.bmp.width / SCALE, e.bmp.height / SCALE);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  // Request missing tiles in and around the view, nearest the camera first.
  const m = visibleRect(PREFETCH);
  const px0 = Math.floor(m.x0 / TILE), py0 = Math.floor(m.y0 / TILE);
  const px1 = Math.floor(m.x1 / TILE), py1 = Math.floor(m.y1 / TILE);
  if (controllers.size) abortOutside(px0, py0, px1, py1);
  if (inflight >= MAX_INFLIGHT) return;
  const cx = state.cam.x / TILE - 0.5, cy = state.cam.y / TILE - 0.5;
  const want = [];
  for (let ty = Math.max(0, Math.floor(m.y0 / TILE)); ty <= Math.min(NTY - 1, Math.floor(m.y1 / TILE)); ty++) {
    for (let tx = Math.max(0, Math.floor(m.x0 / TILE)); tx <= Math.min(NTX - 1, Math.floor(m.x1 / TILE)); tx++) {
      const key = ty * NTX + tx;
      if (cache.has(key) || pending.has(key)) continue;
      const retryAt = failed.get(key);
      if (retryAt !== undefined) { if (now < retryAt) continue; failed.delete(key); }
      want.push([(tx - cx) ** 2 + (ty - cy) ** 2, tx, ty]);
    }
  }
  if (!want.length) return;
  // Don't prefetch past the cap: visible tiles always win.
  want.sort((a, b) => a[0] - b[0]);
  for (const [, tx, ty] of want) {
    if (inflight >= MAX_INFLIGHT) break;
    const vis = visibleKeys.has(ty * NTX + tx);
    // Off-screen prefetch never takes the last VISIBLE_SLOTS slots, or pushes past the cap.
    if (!vis && (inflight >= MAX_INFLIGHT - VISIBLE_SLOTS || cache.size + pending.size >= CAP)) continue;
    request(tx, ty);
  }
}

export function mapImage() { return img; }
export { SCALE as TILE_SCALE, TILE as TILE_SIZE, GUTTER as TILE_GUTTER };
/** The crisp tile bitmap under world (x, y) if tiles are on screen and that tile is
 *  loaded and fully faded in, else null. Bitmap px (bx, by) = world
 *  (tx * TILE + (bx - GUTTER) / SCALE, ...). */
export function tileAt(x, y) {
  if (!tilesOn || noTiles) return null;
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const e = cache.get(ty * NTX + tx);
  if (!e || performance.now() - e.t < FADE_MS) return null;
  return { bmp: e.bmp, tx, ty };
}
/** Debug / capture helper: tile cache stats. */
export function tileStats() {
  return { cached: cache.size, pending: pending.size, failed: failed.size, cap: CAP };
}
