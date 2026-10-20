// Close-up ground detail, drawn right after the painted map (world space).
//
// Deliberately restrained: only marks the illustrator might have drawn, at the
// painting's own line weight, masked by terrain.
//   ice   - occasional hairline cracks, only on genuinely flat open ice
//   snow  - very rare tiny glints on shaded snow/ice that catch as the camera moves
// Features are generated once per 64px world tile from a seeded RNG, cached, culled
// to the visible rect, and drawn as a handful of batched paths.
//
// ?debug=terrain draws a translucent class overlay on top. ?nodetail turns detail off.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import { mask, classAt, lumAt } from './terrain.js';

const SNOW = 0, DEEP = 1, ICE = 2, PATH = 5;
const TILE = 64;
const cache = new Map();
const visible = [];   // reused every frame

const dbg = state.params.get('debug');
const showTerrain = dbg !== null && (dbg === 'terrain' || dbg.split(',').includes('terrain'));
const noDetail = state.params.has('nodetail');

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

// Flat open lake ice: ICE class, mid-grey, and no floe/shore outline within ~7px
// (outlines and floes show up as darker or brighter blurred luminance).
function flatIce(x, y) {
  for (let k = 0; k < 9; k++) {
    const px = x + (k % 3 - 1) * 7, py = y + ((k / 3) | 0) * 7 - 7;
    if (classAt(px, py) !== ICE) return false;
    const L = lumAt(px, py);
    if (L < 210 || L > 230) return false;
  }
  return true;
}

// --- per-tile feature generation ------------------------------------------------
function makeTile(tx, ty) {
  const r = rng((tx * 73856093) ^ (ty * 19349663) ^ 0x5bd1e995);
  const ox = tx * TILE, oy = ty * TILE;
  const t = { glints: [], cracks: [] };

  // Glints: rare, on shaded snow and ice only.
  for (let i = 0; i < 3; i++) {
    const x = ox + r() * TILE, y = oy + r() * TILE;
    const c = classAt(x, y), L = lumAt(x, y);
    let p = 0;
    if (c === ICE) p = 0.25;
    else if ((c === SNOW || c === DEEP || c === PATH) && L < 238 && L > 200) p = 0.3;
    if (r() < p) t.glints.push(x, y, r() * 6.283);
  }

  // Ice cracks: a few straight-ish segments with a slight zig, maybe one short branch.
  if (r() < 0.22) {
    let x = ox + 8 + r() * (TILE - 16), y = oy + 8 + r() * (TILE - 16);
    if (flatIce(x, y)) {
      let a = r() * 6.283;
      const pts = [x, y];
      const segs = 2 + ((r() * 3) | 0);
      for (let s = 0; s < segs; s++) {
        a += (r() < 0.5 ? 1 : -1) * (0.25 + r() * 0.35);
        const len = 4 + r() * 5;
        const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len * 0.7; // foreshortened
        if (!flatIce(nx, ny)) break;
        pts.push(nx, ny);
        x = nx; y = ny;
      }
      if (pts.length >= 6) {
        t.cracks.push(pts);
        if (pts.length >= 8 && r() < 0.5) {
          const i = 2 * (1 + ((r() * (pts.length / 2 - 2)) | 0)); // interior vertex only
          const ba = a + 1.2 * (r() < 0.5 ? 1 : -1), bl = 2.5 + r() * 2.5;
          const bx = pts[i] + Math.cos(ba) * bl, by = pts[i + 1] + Math.sin(ba) * bl * 0.7;
          if (flatIce(bx, by)) t.cracks.push([pts[i], pts[i + 1], bx, by]);
        }
      }
    }
  }

  return t;
}

function tile(tx, ty) {
  const k = ty * 4096 + tx;
  let t = cache.get(k);
  if (!t) { t = makeTile(tx, ty); cache.set(k, t); }
  return t;
}

// --- drawing ---------------------------------------------------------------------
export function drawGround(ctx) {
  if (!mask()) return;
  if (!noDetail) drawDetail(ctx);
  if (showTerrain) drawDebug(ctx);
}

function drawDetail(ctx) {
  const z = state.cam.zoom;
  if (z < 1.1) return; // too far out to matter
  const px = 1 / z;   // one screen px in world units
  const r = visibleRect(8);
  const tx0 = Math.max(0, Math.floor(r.x0 / TILE)), ty0 = Math.max(0, Math.floor(r.y0 / TILE));
  const tx1 = Math.floor(r.x1 / TILE), ty1 = Math.floor(r.y1 / TILE);
  visible.length = 0;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) visible.push(tile(tx, ty));
  const time = state.time;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Ice cracks, at the painting's ink weight (~1.1 map px), softened to sit in the grey.
  ctx.beginPath();
  for (const t of visible) for (const c of t.cracks) {
    ctx.moveTo(c[0], c[1]);
    for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i], c[i + 1]);
  }
  ctx.strokeStyle = 'rgba(92,96,100,0.55)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Glints: tiny, brief four-point catches keyed to camera position, so they flash as
  // you move rather than blinking on their own.
  const cx = state.cam.x, cy = state.cam.y;
  ctx.beginPath();
  for (const t of visible) {
    const g = t.glints;
    for (let i = 0; i < g.length; i += 3) {
      const x = g[i], y = g[i + 1], ph = g[i + 2];
      const s = Math.sin(ph + (x - cx) * 0.045 + (y - cy) * 0.03 + cx * 0.11 + cy * 0.07 + time * 0.3);
      if (s < 0.94) continue;
      const k = Math.max(0.5, ((s - 0.94) / 0.06) * 2.2 * px);
      ctx.moveTo(x - k, y); ctx.lineTo(x + k, y);
      ctx.moveTo(x, y - k); ctx.lineTo(x, y + k);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(0.4, 0.9 * px);
  ctx.stroke();
}

// --- debug overlay ---------------------------------------------------------------
const DEBUG_COLORS = [null, [40, 200, 60], [30, 140, 255], [230, 0, 230], [255, 50, 0], [255, 210, 0]];
let debugCanvas = null;

function buildDebug() {
  const m = mask();
  const c = document.createElement('canvas');
  c.width = m.w; c.height = m.h;
  const g = c.getContext('2d');
  const id = g.createImageData(m.w, m.h);
  for (let i = 0; i < m.cls.length; i++) {
    const col = DEBUG_COLORS[m.cls[i]];
    if (!col) continue;
    id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2];
    id.data[i * 4 + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return c;
}

function drawDebug(ctx) {
  if (!debugCanvas) debugCanvas = buildDebug();
  const m = mask(), s = m.scale;
  const r = visibleRect(4);
  const x0 = Math.max(0, Math.floor(r.x0 / s)), y0 = Math.max(0, Math.floor(r.y0 / s));
  const x1 = Math.min(m.w, Math.ceil(r.x1 / s)), y1 = Math.min(m.h, Math.ceil(r.y1 / s));
  if (x1 <= x0 || y1 <= y0) return;
  ctx.globalAlpha = 0.38;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(debugCanvas, x0, y0, x1 - x0, y1 - y0, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s);
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1;
}
