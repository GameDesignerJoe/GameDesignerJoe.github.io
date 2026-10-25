// Depth: rock and cliff faces drawn over actors that stand behind them.
//
// The painting already shows everything in place, so an occluder only needs drawing
// where an actor overlaps it. The class map's occluder pixels (rock + cliff) are cut
// into pieces: 2 x 32 world px cells (one mask column), split further by vertical run so that each
// piece has one sort key = the y of its foot (where the face meets the ground below)
// plus that ground's height - the same convention as terrain.sortKey(), which actors
// use for their own y. A piece joins the y-sort only when it overlaps an actor box;
// its sprite is cut from the crisp tile under it when one is showing (pixel-identical
// to the map below), else from the 1x base, and cached (small LRU).
//
// Actor boxes: the explorer always; other modules may set state.occludeBoxes to an
// array of { x0, y0, x1, y1, key } world rects (sprite bounds; key = sortKey(x, y) of
// the feet) each frame. Only pieces whose key is larger than the box key are drawn.
// ?debug=occluders outlines the pieces being drawn.
import { state } from '../state.js';
import { mask, sortKey } from './terrain.js';
import { tileAt, mapImage, TILE_SCALE, TILE_SIZE, TILE_GUTTER } from './map.js';

const PW = 2, PH = 32;                // piece size, world px: one mask column wide, so
                                      // neighbouring columns with different feet never
                                      // cut the actor along a hard 16 px seam
const MPW = PW / 2, MPH = PH / 2;     // in mask px
const KEY_MERGE = 12;
// Face lengths and plateau heights only agree to a few px, so an actor must be this
// far behind a piece's foot before the piece covers it (keeps feet at a lip visible).
const KEY_SLACK = 10;                 // runs whose feet differ less than this share a piece
const MARGIN = 0.5;                   // world px of overlap drawn each side of a piece
const SNOW_LUM = 215;                 // blurred luminance at/above which nothing occludes (pale
                                      // highlights read as "nothing there" when cut)
const BEHIND_REACH = 24;              // world px below the feet searched for a face                 // blurred luminance at/above which nothing occludes
const SPRITE_CAP = 320;               // <= 4 KB each at 4x
const dbg = (state.params.get('debug') || '').split(',').includes('occluders');

let built = -1, NB = 0, grid = null;  // grid: Map cellIndex -> pieces[]
const sprites = new Map();            // piece -> { cv, scale } (LRU order)

function build(m) {
  built = m.version;
  sprites.clear();
  NB = Math.ceil(m.w / MPW);
  grid = new Map();
  const { occ, region, regionH, lum, tex, w, h } = m;
  for (let x = 0; x < w; x++) {
    const band = (x / MPW) | 0;
    let y = 0;
    while (y < h) {
      if (!occ[y * w + x]) { y++; continue; }
      const y0 = y;
      while (y < h && occ[y * w + x]) y++;
      const key = y >= h ? 1e6 : y * 2 + regionH[region[y * w + x]];
      for (let yy = y0; yy < y; yy++) {
        // Only inked / textured rock occludes: flat grey (shaded ground) and bright
        // snow-white pixels never draw over an actor.
        if (!tex[yy * w + x] || lum[yy * w + x] >= SNOW_LUM) continue;
        const cell = (yy / MPH) | 0, gi = cell * NB + band;
        let list = grid.get(gi);
        if (!list) grid.set(gi, list = []);
        let p = list.find(q => Math.abs(q.key - key) < KEY_MERGE);
        if (!p) list.push(p = { key, x0: band * PW, y0: cell * PH, bits: new Uint8Array(MPW * MPH) });
        else if (key < p.key) p.key = key;   // nearest foot: never covers a climber on it
        p.bits[(yy - cell * MPH) * MPW + (x - band * MPW)] = 1;
      }
    }
  }
}

// One reusable 3 x MPH mask canvas: every column is the piece's column, so scaling
// it up (drawing only the middle column) softens top and bottom ends but never the
// left / right edges - adjacent pieces meet without a seam.
let maskCv = null, maskG = null, maskId = null;

function sprite(p) {
  const t = tileAt(p.x0 + 1, p.y0 + 1);
  let s = sprites.get(p);
  const scale = t ? TILE_SCALE : 2;
  if (s && s.scale === scale) { sprites.delete(p); sprites.set(p, s); return s; }
  const img = t ? t.bmp : mapImage();
  if (!img) return null;
  // Sprite covers the piece plus MARGIN world px each side (real neighbouring imagery),
  // so its resampled edges fall in the overlap with the next piece, not inside it.
  const cv = s?.cv || document.createElement('canvas');
  cv.width = (PW + 2 * MARGIN) * scale; cv.height = PH * scale;
  const g = cv.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, cv.width, cv.height);
  g.imageSmoothingEnabled = true;
  if (t) {
    const sx = TILE_GUTTER + (p.x0 - MARGIN - t.tx * TILE_SIZE) * scale, sy = TILE_GUTTER + (p.y0 - t.ty * TILE_SIZE) * scale;
    g.drawImage(img, sx, sy, cv.width, cv.height, 0, 0, cv.width, cv.height);
  } else {
    g.drawImage(img, p.x0 - MARGIN, p.y0, PW + 2 * MARGIN, PH, 0, 0, cv.width, cv.height);
  }
  if (!maskCv) {
    maskCv = document.createElement('canvas');
    maskCv.width = 3; maskCv.height = MPH;
    maskG = maskCv.getContext('2d');
    maskId = maskG.createImageData(3, MPH);
  }
  const md = maskId.data;
  for (let y = 0; y < MPH; y++) {
    const a = p.bits[y] ? 255 : 0;
    for (let k = 0; k < 3; k++) md[(y * 3 + k) * 4 + 3] = a;
  }
  maskG.putImageData(maskId, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(maskCv, 1, 0, 1, MPH, 0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'source-over';
  s = { cv, scale };
  sprites.delete(p); sprites.set(p, s);
  while (sprites.size > SPRITE_CAP) {
    const [k, v] = sprites.entries().next().value;
    v.cv.width = v.cv.height = 0;
    sprites.delete(k);
  }
  return s;
}

function drawPiece(ctx, p) {
  const s = sprite(p);
  if (!s) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s.cv, p.x0 - MARGIN, p.y0, PW + 2 * MARGIN, PH);
  if (dbg) {
    ctx.strokeStyle = 'rgba(255,0,120,0.8)';
    ctx.lineWidth = 0.4;
    ctx.strokeRect(p.x0 + 0.2, p.y0 + 0.2, PW - 0.4, PH - 0.4);
  }
}

function behindFace(m, x, y) {
  // Shadow ground is shaded slope ON a mountain or at a cliff foot, never behind it:
  // an actor standing on shadow is not covered by the mass below its feet.
  const fi = Math.floor(y / m.scale) * m.w + Math.floor(x / m.scale);
  if (m.cls[fi] === 7) return false;
  // A real face (>= 8 world px of textured occluder in one column) just below the
  // feet; an ink outline or a thin rim doesn't count.
  const s = m.scale, mx0 = Math.floor((x - 1) / s), mx1 = Math.floor((x + 1) / s);
  const my0 = Math.floor((y + 2) / s), my1 = Math.floor((y + BEHIND_REACH) / s);
  for (let mx = Math.max(0, mx0); mx <= Math.min(m.w - 1, mx1); mx++) {
    let n = 0;
    for (let my = Math.max(0, my0); my <= Math.min(m.h - 1, my1); my++) {
      const i = my * m.w + mx;
      if (m.occ[i] && m.tex[i]) { if (++n >= 4) return true; } else if (n) n = 0;
    }
  }
  return false;
}

const seen = new Set();
export function drawables() {
  const m = mask();
  if (!m) return [];
  if (built !== m.version) build(m);
  const P = state.player;
  const boxes = [{ x0: P.x - 11, y0: P.y - 30, x1: P.x + 11, y1: P.y + 4, key: sortKey(P.x, P.y) }];
  if (Array.isArray(state.occludeBoxes)) boxes.push(...state.occludeBoxes);
  const out = [];
  seen.clear();
  for (const b of boxes) {
    // Only an actor that is really behind a face gets covered: textured occluder must
    // lie just in front of (below) its feet, at its own x. An actor merely standing
    // beside a face is never sliced along a column edge.
    if (!behindFace(m, (b.x0 + b.x1) / 2, b.y1 - 4)) continue;
    const bx0 = Math.max(0, Math.floor(b.x0 / PW)), bx1 = Math.min(NB - 1, Math.floor(b.x1 / PW));
    const cy0 = Math.max(0, Math.floor(b.y0 / PH)), cy1 = Math.floor(b.y1 / PH);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const list = grid.get(cy * NB + bx);
        if (!list) continue;
        for (const p of list) {
          // Only pieces in front of the actor matter (key larger); they then sort after
          // the actor whatever y convention its drawable uses.
          if (seen.has(p) || p.key <= (b.key ?? -1e9) + KEY_SLACK) continue;
          seen.add(p);
          out.push({ y: p.key, draw: ctx => drawPiece(ctx, p) });
        }
      }
    }
  }
  return out;
}
