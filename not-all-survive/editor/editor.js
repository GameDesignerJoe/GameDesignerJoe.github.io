// Terrain paint editor for Not All Will Survive.
//
// Data (see js/world/terrain.js): assets/terrain.png is the automatic class map,
// 1232 x 928, 1 px = 2 x 2 world px, class = round(R / 32). Hand edits are an RGBA PNG
// of the same size: where A >= 128 the class is round(R / 32). The game applies
// assets/terrain-edits.png (committed) and then, with ?edits, the PNG data URL in
// localStorage 'nas.terrainEdits' on top.
//
// Here: auto[] = the automatic classes, fileEdit[] = the committed edits file, edit[] =
// what Joe has now (NONE = no edit, use auto). edit[] starts as fileEdit[] with the
// browser's saved edits on top. Auto-save writes edit[] to localStorage; pixels whose
// committed edit was erased are written as their auto class, so the game (which still
// applies the committed file first) shows the automatic terrain there too. Export
// writes edit[] alone: that file replaces assets/terrain-edits.png.
//
// The page has <base href="../">, so relative URLs (and terrain.js's own loads) resolve
// from the game folder.
import { EDITS_KEY } from '../js/world/terrain.js';

const MAP_W = 2464, MAP_H = 1856, S = 2;          // world size; world px per mask px
const MW = MAP_W / S, MH = MAP_H / S, N = MW * MH;
const NONE = 255, STEP = 32;
const SPAWN = { x: 1360, y: 1560 };
const CAMP = { tent: { x: 1330, y: 1542 }, sled: { x: 1299, y: 1573 }, bounds: { x0: 1222, y0: 1500, x1: 1400, y1: 1602 } };
const VIEW_KEY = 'nas.editorView';

// A palette with every class clearly apart (Rock red / Path yellow / Cliff violet);
// snow is left untinted.
const CLASSES = [
  { name: 'Snow', col: null, sw: '#ffffff', say: 'Normal walking.' },
  { name: 'Deep snow', col: [40, 190, 70], say: 'Wading: much slower (under half speed).' },
  { name: 'Ice', col: [40, 120, 255], say: 'Slick and a little quicker; more exposed to the wind.' },
  { name: 'Thin ice', col: [255, 110, 200], say: 'Slightly slower, and it cracks underfoot.' },
  { name: 'Rock', col: [205, 20, 30], say: 'Impassable. Hides the explorer when he walks behind it.' },
  { name: 'Path', col: [255, 220, 0], say: 'Firm going: the fastest ground.' },
  { name: 'Cliff', col: [140, 60, 240], say: 'Climbable with ice axes (a wall otherwise). Hides the explorer behind it.' },
  { name: 'Shadow', col: [0, 210, 180], say: 'Walkable ground that looks dark; behaves as snow.' },
];
const SHORT = ['normal walking', 'slow wading', 'slick & quick', 'cracks, slower', 'impassable', 'fastest', 'climbable', 'walkable, dark'];
const hex = c => (c ? '#' + c.map(v => v.toString(16).padStart(2, '0')).join('') : '#ffffff');

// --- DOM ---------------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const cv = $('view'), ctx = cv.getContext('2d');
const ui = {
  size: $('size'), sizeOut: $('sizeOut'), sizeRow: $('sizeRow'), opacity: $('opacity'),
  showClasses: $('showClasses'), showEdited: $('showEdited'), showRoutes: $('showRoutes'),
  showMarkers: $('showMarkers'), routesLegend: $('routesLegend'), routesStatus: $('routesStatus'),
  status: $('status'), info: $('info'), toast: $('toast'), help: $('help'),
};

// --- data --------------------------------------------------------------------------------
const auto = new Uint8Array(N);
const fileEdit = new Uint8Array(N).fill(NONE);
const edit = new Uint8Array(N).fill(NONE);
let hasFile = false;
const composed = i => (edit[i] !== NONE ? edit[i] : auto[i]);

function loadImage(src) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}
function pixels(img) {
  const c = document.createElement('canvas');
  c.width = MW; c.height = MH;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, MW, MH);
  return g.getImageData(0, 0, MW, MH).data;
}
/** Reads an edits PNG into a Uint8Array (NONE where not edited). */
function readEdits(img) {
  const d = pixels(img), out = new Uint8Array(N).fill(NONE);
  for (let i = 0, j = 0; i < N; i++, j += 4) if (d[j + 3] >= 128) out[i] = Math.min(7, Math.round(d[j] / STEP));
  return out;
}

// --- overlay canvases (mask resolution) ---------------------------------------------------
const mk = () => { const c = document.createElement('canvas'); c.width = MW; c.height = MH; return c; };
const clsCv = mk(), clsG = clsCv.getContext('2d'), clsImg = clsG.createImageData(MW, MH);
const edCv = mk(), edG = edCv.getContext('2d'), edImg = edG.createImageData(MW, MH);
const faceCv = mk(), platCv = mk(), cutCv = mk();   // climbing overlay masks

function refresh(x0 = 0, y0 = 0, x1 = MW, y1 = MH) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(MW, x1); y1 = Math.min(MH, y1);
  if (x1 <= x0 || y1 <= y0) return;
  const cd = clsImg.data, ed = edImg.data;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * MW + x, j = i * 4, col = CLASSES[composed(i)].col;
      if (col) { cd[j] = col[0]; cd[j + 1] = col[1]; cd[j + 2] = col[2]; cd[j + 3] = 255; } else cd[j + 3] = 0;
      ed[j] = ed[j + 1] = ed[j + 2] = 30; ed[j + 3] = edit[i] !== NONE ? 255 : 0;
    }
  }
  clsG.putImageData(clsImg, 0, 0, x0, y0, x1 - x0, y1 - y0);
  edG.putImageData(edImg, 0, 0, x0, y0, x1 - x0, y1 - y0);
  changed();
}

// --- view --------------------------------------------------------------------------------
const view = { x: SPAWN.x, y: SPAWN.y, z: 2 };   // world centre; CSS px per world px
let W = 0, H = 0, dpr = 1;
try { Object.assign(view, JSON.parse(localStorage.getItem(VIEW_KEY)) || {}); } catch {}
const toWorld = (sx, sy) => ({ x: (sx - W / 2) / view.z + view.x, y: (sy - H / 2) / view.z + view.y });
const toScreen = (wx, wy) => ({ x: (wx - view.x) * view.z + W / 2, y: (wy - view.y) * view.z + H / 2 });
const ZMIN = 0.15, ZMAX = 24;
function clampView() {
  view.z = Math.min(ZMAX, Math.max(ZMIN, view.z));
  view.x = Math.min(MAP_W, Math.max(0, view.x));
  view.y = Math.min(MAP_H, Math.max(0, view.y));
}
function zoomAt(sx, sy, f) {
  const a = toWorld(sx, sy);
  view.z = Math.min(ZMAX, Math.max(ZMIN, view.z * f));
  const b = toWorld(sx, sy);
  view.x += a.x - b.x; view.y += a.y - b.y;
  clampView(); saveView(); render();
}
function fitMap() {
  view.z = Math.min(W / MAP_W, H / MAP_H) * 0.96;
  view.x = MAP_W / 2; view.y = MAP_H / 2; saveView(); render();
}
let viewTimer = 0;
function saveView() {
  clearTimeout(viewTimer);
  viewTimer = setTimeout(() => { try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {} }, 400);
}
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  hatchCv.width = cv.width; hatchCv.height = cv.height;
  render();
}

// --- the map: base image + crisp 4x tiles when zoomed in ---------------------------------
let baseImg = null;
const TS = 4, TILE = 128, GUT = 4, NTX = Math.ceil(MAP_W / TILE), NTY = Math.ceil(MAP_H / TILE);
const tiles = new Map();          // key -> Image (LRU order) | 'loading' | 'failed'
const TILE_CAP = 90;
function tile(tx, ty) {
  const key = ty * NTX + tx, t = tiles.get(key);
  if (t instanceof Image) { tiles.delete(key); tiles.set(key, t); return t; }
  if (t) return null;
  tiles.set(key, 'loading');
  const img = new Image();
  img.onload = () => {
    tiles.set(key, img);
    let n = 0;
    for (const [k, v] of tiles) if (v instanceof Image) n++;
    for (const [k, v] of tiles) { if (n <= TILE_CAP) break; if (v instanceof Image && k !== key) { tiles.delete(k); n--; } }
    render();
  };
  img.onerror = () => tiles.set(key, 'failed');
  img.src = `assets/tiles/${TS}/${tx}_${ty}.webp`;
  return null;
}

// --- render ------------------------------------------------------------------------------
// --- screen-space mask layers (patterns + outlines at screen resolution) ------------------
const hatchCv = document.createElement('canvas'), hatchG = hatchCv.getContext('2d');
const lineCvs = [document.createElement('canvas'), document.createElement('canvas')];
const pats = {};
function pattern(kind) {
  const key = kind + dpr;
  if (pats[key]) return pats[key];
  const u = dpr, p = document.createElement('canvas'), g = p.getContext('2d');
  if (kind === 'edit') {
    const n = Math.round(7 * u); p.width = p.height = n;
    g.strokeStyle = '#1e1e1e'; g.lineWidth = Math.max(1, u);
    g.beginPath(); for (const o of [-n, 0, n]) { g.moveTo(o, n); g.lineTo(o + n, 0); } g.stroke();
  } else if (kind === 'ladder') {
    // Rungs: a dark line with a pale line under it, transparent between (map shows through).
    const n = Math.round(6 * u), t = Math.max(1, Math.round(1.4 * u)); p.width = 4; p.height = n;
    g.fillStyle = '#111'; g.fillRect(0, 0, 4, t);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(0, t, 4, t);
  } else if (kind === 'dots') {
    const n = Math.round(5 * u); p.width = p.height = n;
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(n / 2, n / 2, Math.max(0.8, 0.95 * u), 0, Math.PI * 2); g.fill();
  }
  return (pats[key] = ctx.createPattern(p, 'repeat'));
}
/** Draws a mask-resolution alpha canvas onto the view with a screen-space pattern / fill
 *  and optional outlines ([[colour, CSS px width], ...], drawn in order, over the fill). */
function maskLayer(src, { pat, fill, alpha = 1, outline = [] }) {
  const g = hatchG, w = hatchCv.width, h = hatchCv.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  worldTransform(g); g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, MAP_W, MAP_H);
  g.setTransform(1, 0, 0, 1, 0, 0);
  outline.forEach(([col, lw], k) => {
    // Outline = the mask minus the mask eroded by the line width.
    const c = lineCvs[k], lg = c.getContext('2d'), d = Math.max(1, Math.round(lw * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, w, h);
    lg.drawImage(hatchCv, 0, 0);
    lg.globalCompositeOperation = 'destination-in';
    for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) lg.drawImage(hatchCv, dx, dy);
    lg.globalCompositeOperation = 'source-out';
    lg.drawImage(hatchCv, 0, 0);
    lg.globalCompositeOperation = 'source-in';
    lg.fillStyle = col; lg.fillRect(0, 0, w, h);
  });
  if (pat || fill) {
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = pat ? pattern(pat) : fill;
    g.fillRect(0, 0, w, h);
    ctx.globalAlpha = alpha; ctx.drawImage(hatchCv, 0, 0); ctx.globalAlpha = 1;
  }
  outline.forEach((_, k) => ctx.drawImage(lineCvs[k], 0, 0));
}

let queued = false;
function render() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(draw);
}
function worldTransform(g) {
  g.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * (W / 2 - view.x * view.z), dpr * (H / 2 - view.y * view.z));
}
function draw() {
  queued = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#d9dadb';
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!baseImg) return;
  worldTransform(ctx);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(baseImg, 0, 0, MAP_W, MAP_H);

  const a = toWorld(0, 0), b = toWorld(W, H);
  if (view.z * dpr >= 1.6) {
    const bleed = 0.5 / (view.z * dpr);
    for (let ty = Math.max(0, Math.floor(a.y / TILE)); ty <= Math.min(NTY - 1, Math.floor(b.y / TILE)); ty++) {
      for (let tx = Math.max(0, Math.floor(a.x / TILE)); tx <= Math.min(NTX - 1, Math.floor(b.x / TILE)); tx++) {
        const t = tile(tx, ty);
        if (!t) continue;
        const cw = (t.width - 2 * GUT) / TS, ch = (t.height - 2 * GUT) / TS, gp = bleed * TS;
        ctx.drawImage(t, GUT - gp, GUT - gp, cw * TS + 2 * gp, ch * TS + 2 * gp,
          tx * TILE - bleed, ty * TILE - bleed, cw + 2 * bleed, ch + 2 * bleed);
      }
    }
  }

  ctx.imageSmoothingEnabled = false;
  if (ui.showClasses.checked) {
    ctx.globalAlpha = +ui.opacity.value / 100;
    ctx.drawImage(clsCv, 0, 0, MAP_W, MAP_H);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Climbing overlay: patterns and outlines, never a flat fill, so it can't be mistaken
  // for a terrain colour. Cut off = grey stipple; plateau = navy outline + faint wash;
  // climbable face = black-and-white ladder rungs.
  if (ui.showRoutes.checked && routesReady) {
    maskLayer(cutCv, { pat: 'dots', alpha: 0.75 });
    maskLayer(platCv, { fill: 'rgba(38,50,110,0.14)', outline: [['rgba(255,255,255,0.95)', 3.5], ['#1b2a80', 1.6]] });
    maskLayer(faceCv, { pat: 'ladder', alpha: 0.9, outline: [['rgba(255,255,255,0.9)', 2.5], ['#111', 1]] });
  }
  // My edits: fine diagonal ink hatching.
  if (ui.showEdited.checked && editCount) maskLayer(edCv, { pat: 'edit', alpha: 0.42 });

  // Screen-space overlays (CSS px).
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (ui.showMarkers.checked) drawMarkers();
  drawToolPreview();
}

function drawMarkers() {
  const s = toScreen(SPAWN.x, SPAWN.y), z = view.z;
  const bx = toScreen(CAMP.bounds.x0, CAMP.bounds.y0), by = toScreen(CAMP.bounds.x1, CAMP.bounds.y1);
  ctx.save();
  ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(38,50,74,0.8)'; ctx.lineWidth = 1.2;
  ctx.strokeRect(bx.x, bx.y, by.x - bx.x, by.y - bx.y);
  ctx.setLineDash([]);
  const label = (txt, x, y) => {
    ctx.font = '12px "Iowan Old Style", Georgia, serif';
    const w = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(250,250,248,0.9)'; ctx.fillRect(x - 3, y - 11, w + 6, 15);
    ctx.fillStyle = '#26324a'; ctx.fillText(txt, x, y);
  };
  // tent: a small ridge-tent triangle
  const t = toScreen(CAMP.tent.x, CAMP.tent.y), k = Math.max(5, Math.min(14, z * 5));
  ctx.fillStyle = '#26324a'; ctx.strokeStyle = '#fafaf8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(t.x, t.y - k); ctx.lineTo(t.x + k, t.y + k * 0.6); ctx.lineTo(t.x - k, t.y + k * 0.6); ctx.closePath();
  ctx.stroke(); ctx.fill();
  label('Camp', bx.x + 3, bx.y - 4);
  // spawn: a ringed dot
  ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.strokeStyle = '#fafaf8'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#26324a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#26324a'; ctx.fill();
  label('Explorer start', s.x + 11, s.y + 4);
  ctx.restore();
}

// --- edits, history ----------------------------------------------------------------------
let editCount = 0;
const undo = [], redo = [];
const HISTORY = 300;

/** An operation in progress: remembers each touched pixel's previous edit value. */
class Op {
  constructor(label) { this.label = label; this.idx = []; this.old = []; this.seen = new Set(); this.b = [MW, MH, 0, 0]; }
  /** Set mask px i to v (a class, or NONE = back to auto). Painting a class equal to the
   *  auto class still counts as an edit: it pins the pixel if the classifier changes. */
  set(i, v) {
    if (edit[i] === v) return;
    if (!this.seen.has(i)) { this.seen.add(i); this.idx.push(i); this.old.push(edit[i]); }
    edit[i] = v;
    const x = i % MW, y = (i / MW) | 0, b = this.b;
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x + 1 > b[2]) b[2] = x + 1; if (y + 1 > b[3]) b[3] = y + 1;
  }
  finish() {
    if (!this.idx.length) return false;
    const n = this.idx.length;
    const rec = { label: this.label, idx: Int32Array.from(this.idx), old: Uint8Array.from(this.old), nw: new Uint8Array(n), b: this.b };
    for (let k = 0; k < n; k++) rec.nw[k] = edit[rec.idx[k]];
    this.seen = null;
    undo.push(rec); if (undo.length > HISTORY) undo.shift();
    redo.length = 0;
    return true;
  }
  revert() {
    for (let k = this.idx.length - 1; k >= 0; k--) edit[this.idx[k]] = this.old[k];
    refresh(...this.b);
  }
}
function applyRec(rec, vals) {
  for (let k = 0; k < rec.idx.length; k++) edit[rec.idx[k]] = vals[k];
  refresh(...rec.b);
}
function doUndo() {
  const r = undo.pop(); if (!r) return toast('Nothing to undo');
  applyRec(r, r.old); redo.push(r); toast('Undid ' + r.label);
}
function doRedo() {
  const r = redo.pop(); if (!r) return toast('Nothing to redo');
  applyRec(r, r.nw); undo.push(r); toast('Redid ' + r.label);
}

// --- tools -------------------------------------------------------------------------------
let tool = 'brush', cur = 4, size = 8;
let op = null, last = null, strokeErase = false;   // Alt held at the start of a stroke erases
// Eraser modes: 'snow' paints an explicit Snow edit over anything (auto or edited);
// 'auto' removes Joe's edits so the automatic map shows again. Alt-erase follows it.
const ERASE_KEY = 'nas.editorEraseMode';
let eraseMode = 'snow';
try { if (localStorage.getItem(ERASE_KEY) === 'auto') eraseMode = 'auto'; } catch {}
const eraseVal = () => (eraseMode === 'snow' ? 0 : NONE);
const paintVal = () => (tool === 'eraser' || strokeErase ? eraseVal() : cur);

function stamp(o, mx, my, v) {
  // Pixels whose centres lie within the brush circle (always at least the one under it).
  const r = size / 2, r2 = r * r;
  const x0 = Math.floor(mx - r), x1 = Math.ceil(mx + r), y0 = Math.floor(my - r), y1 = Math.ceil(my + r);
  for (let y = Math.max(0, y0); y < Math.min(MH, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(MW, x1); x++) {
      const dx = x + 0.5 - mx, dy = y + 0.5 - my;
      if (dx * dx + dy * dy <= r2) o.set(y * MW + x, v);
    }
  }
  const cx = Math.floor(mx), cy = Math.floor(my);
  if (cx >= 0 && cy >= 0 && cx < MW && cy < MH) o.set(cy * MW + cx, v);
  refresh(x0, y0, x1, y1);
}
function strokeTo(w) {
  const mx = w.x / S, my = w.y / S;
  if (!last) { stamp(op, mx, my, paintVal()); last = { mx, my }; return; }
  const d = Math.hypot(mx - last.mx, my - last.my), step = Math.max(0.5, size / 4);
  const n = Math.max(1, Math.ceil(d / step));
  for (let k = 1; k <= n; k++) stamp(op, last.mx + ((mx - last.mx) * k) / n, last.my + ((my - last.my) * k) / n, paintVal());
  last = { mx, my };
}

function fillAt(w, erase) {
  const mx = Math.floor(w.x / S), my = Math.floor(w.y / S);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return;
  const s0 = my * MW + mx, target = composed(s0), v = erase ? eraseVal() : cur;
  if (v !== NONE && target === v) return toast(`That area is already ${CLASSES[v].name}`);
  const o = new Op(erase ? `erase ${CLASSES[target].name} area` : `fill with ${CLASSES[v].name}`);
  const seen = new Uint8Array(N), stack = new Int32Array(N);
  let sp = 0; stack[sp++] = s0; seen[s0] = 1;
  while (sp) {
    const p = stack[--sp], x = p % MW;
    o.set(p, v);
    if (x > 0 && !seen[p - 1] && composed(p - 1) === target) { seen[p - 1] = 1; stack[sp++] = p - 1; }
    if (x < MW - 1 && !seen[p + 1] && composed(p + 1) === target) { seen[p + 1] = 1; stack[sp++] = p + 1; }
    if (p >= MW && !seen[p - MW] && composed(p - MW) === target) { seen[p - MW] = 1; stack[sp++] = p - MW; }
    if (p < N - MW && !seen[p + MW] && composed(p + MW) === target) { seen[p + MW] = 1; stack[sp++] = p + MW; }
  }
  if (o.finish()) {
    refresh(...o.b);
    toast(erase && v === NONE ? `Restored ${o.idx.length.toLocaleString()} px to auto` : erase ? `Cleared ${o.idx.length.toLocaleString()} px to snow` : `Filled ${o.idx.length.toLocaleString()} px of ${CLASSES[target].name} with ${CLASSES[v].name}`);
  } else if (erase) toast('No edits there to restore');
}

/** Fill a polygon (world points) or rect with the current class, or erase it. */
function fillShape(pts, erase) {
  const m = pts.map(p => ({ x: p.x / S, y: p.y / S }));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of m) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(MW, Math.ceil(x1)); y1 = Math.min(MH, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;
  const w = x1 - x0, h = y1 - y0;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.beginPath();
  m.forEach((p, k) => (k ? g.lineTo(p.x - x0, p.y - y0) : g.moveTo(p.x - x0, p.y - y0)));
  g.closePath(); g.fill();
  const d = g.getImageData(0, 0, w, h).data;
  const v = erase ? eraseVal() : cur;
  const o = new Op(erase ? 'erase area' : `${tool === 'rect' ? 'rectangle' : 'lasso'} of ${CLASSES[v].name}`);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 128) o.set((y + y0) * MW + x + x0, v);
  if (o.finish()) refresh(x0, y0, x1, y1);
}

function pick(w) {
  const mx = Math.floor(w.x / S), my = Math.floor(w.y / S);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return;
  setClass(composed(my * MW + mx));
  if (tool === 'eraser') setTool('brush');
  toast('Picked ' + CLASSES[cur].name);
}

// --- pointer input -----------------------------------------------------------------------
const pointers = new Map();       // id -> { x, y } (CSS px in the canvas)
let mode = null;                  // 'paint' | 'pan' | 'gesture' | 'shape'
let panFrom = null, gesture = null, shape = null, hover = null, spaceDown = false, altDown = false;

const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch {}
  const p = local(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2 && e.pointerType === 'touch') {
    // Second finger: cancel the stroke the first finger began, pan / pinch instead.
    if (op) { op.revert(); op = null; }
    shape = null;
    const [a, b] = [...pointers.values()];
    gesture = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    mode = 'gesture'; render(); return;
  }
  if (pointers.size > 1) return;
  if (e.button === 1 || e.button === 2 || spaceDown) {
    mode = 'pan'; panFrom = p; cv.classList.add('panning'); return;
  }
  if (e.button !== 0) return;
  const w = toWorld(p.x, p.y);
  if (tool === 'brush' || tool === 'eraser') {
    mode = 'paint'; last = null; strokeErase = e.altKey;
    op = new Op(tool === 'eraser' || strokeErase ? 'erase' : `paint ${CLASSES[cur].name}`);
    strokeTo(w);
  } else if (tool === 'fill') {
    fillAt(w, e.altKey);
  } else {
    mode = 'shape'; shape = { pts: [w], start: w, end: w };
  }
});
cv.addEventListener('pointermove', e => {
  const p = local(e);
  hover = p;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  if (mode === 'gesture' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    view.x -= (cx - gesture.cx) / view.z; view.y -= (cy - gesture.cy) / view.z;
    zoomAt(cx, cy, d / gesture.d);
    gesture = { cx, cy, d };
  } else if (mode === 'pan') {
    view.x -= (p.x - panFrom.x) / view.z; view.y -= (p.y - panFrom.y) / view.z;
    panFrom = p; clampView(); saveView();
  } else if (mode === 'paint') {
    let list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!list || !list.length) list = [e];
    for (const ce of list) { const q = local(ce); strokeTo(toWorld(q.x, q.y)); }
  } else if (mode === 'shape') {
    const w = toWorld(p.x, p.y);
    if (tool === 'lasso') {
      const lp = shape.pts[shape.pts.length - 1];
      if (Math.hypot(w.x - lp.x, w.y - lp.y) * view.z > 3) shape.pts.push(w);
    }
    shape.end = w;
  }
  updateInfo();
  render();
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (mode === 'gesture') { if (pointers.size === 0) mode = null; return; }
  if (mode === 'paint' && op) { if (op.finish()) scheduleSave(); op = null; }
  if (mode === 'shape' && shape && e.type === 'pointerup') {
    const erase = e.altKey || altDown;
    if (tool === 'rect') {
      const a = shape.start, b = shape.end;
      if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) fillShape([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], erase);
    } else if (shape.pts.length > 2) fillShape(shape.pts, erase);
  }
  shape = null; mode = null; cv.classList.remove('panning');
  render();
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', () => { hover = null; ui.info.textContent = ''; render(); });

cv.addEventListener('wheel', e => {
  e.preventDefault();
  const p = local(e);
  let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (e.ctrlKey) dy *= 4;          // trackpad pinch arrives as ctrl+wheel with small deltas
  zoomAt(p.x, p.y, Math.exp(-dy * 0.0016));
}, { passive: false });
// Safari trackpad pinch.
let gScale = 1;
cv.addEventListener('gesturestart', e => { e.preventDefault(); gScale = 1; });
cv.addEventListener('gesturechange', e => {
  e.preventDefault();
  const p = local(e);
  zoomAt(p.x, p.y, e.scale / gScale); gScale = e.scale;
});

function drawToolPreview() {
  if (shape) {
    ctx.save();
    ctx.lineWidth = 1.5;
    const pts = tool === 'rect'
      ? [shape.start, { x: shape.end.x, y: shape.start.y }, shape.end, { x: shape.start.x, y: shape.end.y }]
      : shape.pts.concat([shape.end]);
    ctx.beginPath();
    pts.forEach((w, k) => { const s = toScreen(w.x, w.y); k ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.closePath();
    const erase = altDown;
    const col = erase ? null : CLASSES[cur].col;
    ctx.fillStyle = col ? `rgba(${col},0.25)` : 'rgba(255,255,255,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#222'; ctx.stroke();
    ctx.restore();
    return;
  }
  if (!hover || mode === 'pan' || mode === 'gesture' || spaceDown) return;
  if (tool === 'brush' || tool === 'eraser') {
    const r = Math.max(1.5, (size / 2) * S * view.z);
    ctx.beginPath(); ctx.arc(hover.x, hover.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
    const er = tool === 'eraser' || altDown;
    ctx.strokeStyle = er ? '#555' : '#1e1e1e'; ctx.lineWidth = 1.2;
    if (er) ctx.setLineDash([3, 3]);
    ctx.stroke(); ctx.setLineDash([]);
  }
}

function updateInfo() {
  if (!hover) return;
  const w = toWorld(hover.x, hover.y), mx = Math.floor(w.x / S), my = Math.floor(w.y / S);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) { ui.info.textContent = ''; return; }
  const i = my * MW + mx, c = composed(i);
  const how = edit[i] !== NONE ? (edit[i] === auto[i] ? 'painted' : `painted · auto was ${CLASSES[auto[i]].name}`) : 'auto';
  ui.info.textContent = `${Math.round(w.x)}, ${Math.round(w.y)}  ·  ${CLASSES[c].name} (${how})  ·  ${Math.round(view.z * 100)}%`;
}

// --- keyboard ----------------------------------------------------------------------------
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  const k = e.key, mod = e.ctrlKey || e.metaKey;
  if (k === 'Alt') { e.preventDefault(); altDown = true; render(); return; }
  if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); (e.shiftKey ? doRedo : doUndo)(); scheduleSave(); return; }
  if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); doRedo(); scheduleSave(); return; }
  if (mod && (k === 's' || k === 'S')) { e.preventDefault(); exportPng(); return; }
  if (mod) return;
  if (k === 'Escape') { if (!ui.help.hidden) ui.help.hidden = true; shape = null; mode = null; render(); return; }
  if (k === '?' || (k === '/' && e.shiftKey)) { ui.help.hidden = !ui.help.hidden; return; }
  if (!ui.help.hidden) return;
  if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; cv.classList.add('pan'); render(); } return; }
  if (/^[0-7]$/.test(k)) { setClass(+k); return; }
  const tools = { b: 'brush', e: 'eraser', g: 'fill', r: 'rect', l: 'lasso' };
  const lk = k.toLowerCase();
  if (tools[lk]) { setTool(tools[lk]); return; }
  if (k === '[') setSize(Math.max(1, Math.round(size / 1.25) - (size <= 4 ? 1 : 0)));
  else if (k === ']') setSize(Math.min(80, Math.max(size + 1, Math.round(size * 1.25))));
  else if (lk === 'o') { ui.showClasses.checked = !ui.showClasses.checked; render(); }
  else if (lk === 'c') { ui.showRoutes.checked = !ui.showRoutes.checked; onRoutesToggle(); }
  else if (lk === 'f') fitMap();
  else if (lk === 'i' && hover) pick(toWorld(hover.x, hover.y));
  else if (lk === 'p') playtest();
  else if (k === '+' || k === '=') zoomAt(W / 2, H / 2, 1.4);
  else if (k === '-') zoomAt(W / 2, H / 2, 1 / 1.4);
});
addEventListener('keyup', e => {
  if (e.key === ' ') { e.preventDefault(); spaceDown = false; cv.classList.remove('pan'); render(); }
  if (e.key === 'Alt') { e.preventDefault(); altDown = false; render(); }
});
addEventListener('blur', () => { spaceDown = altDown = false; cv.classList.remove('pan'); });

// --- panel -------------------------------------------------------------------------------
function setEraseMode(m) {
  eraseMode = m;
  try { localStorage.setItem(ERASE_KEY, m); } catch {}
  document.querySelectorAll('#eraseMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  render();
}
function setTool(t) {
  tool = t;
  $('eraseMode').hidden = t !== 'eraser';
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  ui.sizeRow.classList.toggle('off', !(t === 'brush' || t === 'eraser'));
  render();
}
function setClass(c) {
  cur = c;
  document.querySelectorAll('#legend li').forEach((li, k) => li.classList.toggle('on', k === c));
  if (tool === 'eraser') setTool('brush');
}
function setSize(s) { size = s; ui.size.value = s; ui.sizeOut.textContent = s; render(); }

function buildPanel() {
  const lg = $('legend'), hc = $('helpClasses');
  CLASSES.forEach((c, k) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="sw" style="background:${c.sw || hex(c.col)}"></span><span class="nm">${c.name}<small>${SHORT[k]}</small></span><kbd>${k}</kbd>`;
    li.title = c.say;
    li.onclick = () => setClass(k);
    lg.appendChild(li);
    const h = document.createElement('li');
    h.innerHTML = `<span class="sw" style="background:${c.sw || hex(c.col)}"></span><span><b>${c.name}</b> — ${c.say}</span>`;
    hc.appendChild(h);
  });
  document.querySelectorAll('#tools button').forEach(b => (b.onclick = () => setTool(b.dataset.tool)));
  ui.size.oninput = () => setSize(+ui.size.value);
  for (const el of [ui.opacity, ui.showClasses, ui.showEdited, ui.showMarkers]) el.oninput = render;
  ui.showRoutes.onchange = onRoutesToggle;
  $('helpBtn').onclick = () => (ui.help.hidden = false);
  ui.help.onclick = e => { if (e.target === ui.help || e.target.classList.contains('close')) ui.help.hidden = true; };
  $('export').onclick = exportPng;
  $('import').onclick = () => $('importFile').click();
  $('importFile').onchange = importPng;
  $('reset').onclick = revertAll;
  $('playtest').onclick = playtest;
  // Don't leave buttons focused: Space (pan) would press them again.
  document.querySelectorAll('#panel button, #panel input').forEach(b => b.addEventListener('click', () => b.blur()));
  document.querySelectorAll('#eraseMode button').forEach(b => (b.onclick = () => setEraseMode(b.dataset.mode)));
  setEraseMode(eraseMode);
  setTool('brush'); setClass(4); setSize(8);
}

let toastTimer = 0;
function toast(msg, ms = 1600) {
  ui.toast.textContent = msg; ui.toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

// --- saving ------------------------------------------------------------------------------
/** Encodes an edits PNG. forGame: also write erased committed edits as their auto class. */
function encode(forGame) {
  const c = mk(), g = c.getContext('2d'), id = g.createImageData(MW, MH), d = id.data;
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    let v = edit[i];
    if (v === NONE && forGame && fileEdit[i] !== NONE) v = auto[i];
    if (v === NONE) continue;
    d[j] = v * STEP; d[j + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return c;
}
let saveTimer = 0, unexported = 0, pendingSave = false, savedState = 'none', quotaWarned = false;
let exportedThisSession = false;
const exported = new Uint8Array(N).fill(NONE);   // what the last export / committed file holds
function changed() { scheduleSave(); }
function scheduleSave() {
  clearTimeout(saveTimer);
  pendingSave = true;
  saveTimer = setTimeout(save, 700);
  routesDirty = true;
  if (ui.showRoutes.checked) scheduleRoutes();
}
function count() {
  editCount = 0; unexported = 0;
  for (let i = 0; i < N; i++) { if (edit[i] !== NONE) editCount++; if (edit[i] !== exported[i]) unexported++; }
}
function save() {
  clearTimeout(saveTimer);
  pendingSave = false;
  count();
  try {
    if (editCount === 0 && !fileEditsAny) { localStorage.removeItem(EDITS_KEY); savedState = 'none'; }
    else { localStorage.setItem(EDITS_KEY, encode(true).toDataURL('image/png')); savedState = 'ok'; }
  } catch (e) {
    savedState = 'failed';
    console.warn('[editor] could not save', e);
    const msg = 'Your browser refused to save the edits (storage full or blocked). Click "Export terrain-edits.png" now so you don\'t lose your work.';
    toast(msg, 8000);
    if (!quotaWarned) { quotaWarned = true; setTimeout(() => alert(msg), 50); }
  }
  showStatus();
  render();
}
// Never lose the last stroke: flush the pending save when the page goes away.
const flush = () => { if (pendingSave) save(); };
addEventListener('pagehide', flush);
addEventListener('beforeunload', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

let fileEditsAny = false;
function showStatus() {
  const n = v => v.toLocaleString();
  let s;
  if (savedState === 'failed') s = '<b class="bad">Could not save in this browser. Export now!</b>';
  else if (editCount && savedState === 'ok') s = `<b>${n(editCount)}</b> px painted, saved in this browser.`;
  else if (editCount) s = `<b>${n(editCount)}</b> px painted (from the committed file).`;
  else s = 'Nothing painted yet.';
  if (unexported) s += `<br><b>${n(unexported)}</b> px changed since ${exportedThisSession ? 'your last export' : 'the committed terrain-edits.png'}.`;
  else if (exportedThisSession) s += '<br>Exported. Put terrain-edits.png in not-all-survive/assets/ and commit it.';
  else if (editCount) s += '<br>Same as the committed terrain-edits.png.';
  ui.status.innerHTML = s;
}

function exportPng() {
  save();
  encode(false).toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'terrain-edits.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    exported.set(edit); exportedThisSession = true;
    count(); showStatus();
    toast('Downloaded terrain-edits.png: put it in not-all-survive/assets/ and commit', 4500);
  }, 'image/png');
}

async function importPng(e) {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const url = URL.createObjectURL(f), img = await loadImage(url);
  URL.revokeObjectURL(url);
  if (!img) return toast('That file is not a PNG I can read', 3000);
  if (img.width !== MW || img.height !== MH) {
    return toast(`${f.name} is ${img.width} × ${img.height}; an edits file must be exactly ${MW} × ${MH}. Nothing was imported.`, 5000);
  }
  const inc = readEdits(img);
  const o = new Op('import');
  for (let i = 0; i < N; i++) o.set(i, inc[i]);
  if (o.finish()) refresh();
  save();
  toast(`Imported ${f.name} (undo with Ctrl+Z)`, 2500);
}

function revertAll() {
  if (!confirm('Throw away everything painted in this browser and go back to the committed terrain-edits.png? (You can still undo.)')) return;
  const o = new Op('revert');
  for (let i = 0; i < N; i++) o.set(i, fileEdit[i]);
  if (o.finish()) refresh();
  save();
  toast('Back to the committed edits');
}

// --- play-test ---------------------------------------------------------------------------
function playtest() {
  save();
  let { x, y } = view;
  // Nudge the start off rock / cliff onto the nearest walkable ground.
  const walk = i => { const c = composed(i); return c !== 4 && c !== 6; };
  const mx = Math.floor(x / S), my = Math.floor(y / S);
  if (!walk(Math.min(MH - 1, Math.max(0, my)) * MW + Math.min(MW - 1, Math.max(0, mx)))) {
    search: for (let r = 1; r < 200; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const px = mx + dx, py = my + dy;
        if (px < 0 || py < 0 || px >= MW || py >= MH) continue;
        if (walk(py * MW + px)) { x = (px + 0.5) * S; y = (py + 0.5) * S; break search; }
      }
    }
  }
  const url = new URL(`index.html?edits&autostart&x=${Math.round(x)}&y=${Math.round(y)}`, document.baseURI);
  window.open(url.href, '_blank');
}

// --- derived overlay: climbable faces, plateaus, cut-off ground ---------------------------
// terrain.js's own derivation (see routes.js), run in a Web Worker so painting never
// stalls; on browsers without module workers / OffscreenCanvas it runs here instead.
// Recomputed 1.5 s after the last change, never mid-stroke.
let routesReady = false, routesDirty = true, routesTimer = 0, routesBusy = false;
let lastCodes = null;
let worker = null, workerFailed = false, reqId = 0, mainTerrain = null;
const busy = $('busy');
function onRoutesToggle() {
  ui.routesLegend.hidden = !ui.showRoutes.checked;
  if (ui.showRoutes.checked && (routesDirty || !routesReady)) scheduleRoutes(0);
  else showBusy(false);
  render();
}
function showBusy(on) {
  busy.hidden = !on;
  ui.routesStatus.textContent = on ? 'recomputing…' : ui.routesStatus.textContent;
}
function scheduleRoutes(ms = 1500) {
  clearTimeout(routesTimer);
  showBusy(true);
  routesTimer = setTimeout(buildRoutes, ms);
}
function composedClasses() {
  const c = new Uint8Array(N);
  for (let i = 0; i < N; i++) c[i] = composed(i);
  return c;
}
function runInWorker(cls) {
  if (!worker) {
    worker = new Worker(new URL('./routes-worker.js?base=' + encodeURIComponent(document.baseURI), import.meta.url), { type: 'module' });
  }
  return new Promise((res, rej) => {
    const id = ++reqId;
    const done = e => {
      if (e.data && e.data.id !== id) return;
      worker.removeEventListener('message', done); worker.removeEventListener('error', fail);
      e.data.error ? rej(new Error(e.data.error)) : res(e.data);
    };
    const fail = e => { worker.removeEventListener('message', done); worker.removeEventListener('error', fail); rej(new Error(e.message || 'worker failed')); };
    worker.addEventListener('message', done); worker.addEventListener('error', fail);
    worker.postMessage({ id, cls }, [cls.buffer]);
  });
}
async function runHere(cls) {
  if (!mainTerrain) { mainTerrain = await import('../js/world/terrain.js'); await mainTerrain.init(); }
  const { computeRoutes } = await import('./routes.js');
  const t0 = performance.now(), r = computeRoutes(mainTerrain, cls);
  return { ...r, ms: performance.now() - t0 };
}
async function buildRoutes() {
  if (mode === 'paint' || mode === 'shape' || routesBusy) return scheduleRoutes(600);
  routesBusy = true; routesDirty = false;
  const cls = composedClasses();
  let r = null;
  try {
    if (!workerFailed) {
      try { r = await runInWorker(cls.slice()); }
      catch (e) { console.warn('[editor] routes worker unavailable, computing on the page:', e.message); workerFailed = true; worker && worker.terminate(); }
    }
    if (!r) r = await runHere(cls);
    lastCodes = r.codes;
    const cvs = [null, faceCv, platCv, cutCv], ids = cvs.map(c => c && c.getContext('2d').createImageData(MW, MH));
    const ds = ids.map(id => id && id.data), codes = r.codes;
    for (let i = 0; i < N; i++) { const k = codes[i]; if (k) ds[k][i * 4 + 3] = 255; }
    for (let k = 1; k <= 3; k++) cvs[k].getContext('2d').putImageData(ids[k], 0, 0);
    routesReady = true;
    ui.routesStatus.textContent = r.spawnInRock ? 'the explorer start is inside rock!' : `up to date (${Math.round(r.ms)} ms${workerFailed ? '' : ', background'})`;
  } catch (e) {
    console.warn('[editor] routes overlay unavailable', e);
    ui.routesStatus.textContent = 'not available: ' + e.message;
  }
  routesBusy = false;
  if (routesDirty && ui.showRoutes.checked) scheduleRoutes(); else busy.hidden = true;
  render();
}

// --- boot --------------------------------------------------------------------------------
async function boot() {
  buildPanel();
  addEventListener('resize', resize);
  resize();
  const [base, autoImg, fileImg] = await Promise.all([
    loadImage('assets/map-sharp.webp'), loadImage('assets/terrain.png'), loadImage('assets/terrain-edits.png'),
  ]);
  if (!base || !autoImg) { ui.status.textContent = 'Could not load the map or assets/terrain.png.'; return; }
  baseImg = base;
  const d = pixels(autoImg);
  for (let i = 0, j = 0; i < N; i++, j += 4) auto[i] = Math.min(7, Math.round(d[j] / STEP));
  if (fileImg) { hasFile = true; fileEdit.set(readEdits(fileImg)); }
  for (let i = 0; i < N; i++) if (fileEdit[i] !== NONE) { fileEditsAny = true; break; }
  edit.set(fileEdit); exported.set(fileEdit);
  let fromBrowser = 0;
  try {
    const url = localStorage.getItem(EDITS_KEY);
    const img = url && (await loadImage(url));
    if (img) {
      const ls = readEdits(img);
      for (let i = 0; i < N; i++) {
        if (ls[i] === NONE) continue;
        // An erased committed edit is stored as its auto class (see encode()).
        edit[i] = fileEdit[i] !== NONE && ls[i] === auto[i] ? NONE : ls[i];
        fromBrowser++;
      }
    }
  } catch (e) { console.warn('[editor] could not read saved edits', e); }
  refresh();
  savedState = fromBrowser ? 'ok' : 'none';
  count(); showStatus();
  clearTimeout(saveTimer); pendingSave = false;
  if (!localStorage.getItem(VIEW_KEY)) fitMap();
  render();
  const parts = [];
  if (hasFile) parts.push('committed terrain-edits.png');
  if (fromBrowser) parts.push('your saved browser edits');
  toast(parts.length ? 'Loaded ' + parts.join(' + ') : 'Press ? for help', 2500);
}

// Hooks for automated tests / the console.
window.terrainEditor = {
  get edits() { return edit; }, get auto() { return auto; },
  composed, save, setClass, setTool, setSize, view, render,
  /** Paint a disc of class c (or null to erase) at world (x, y), radius in world px. */
  paintDisc(x, y, r, c) {
    const o = new Op('paint'), v = c == null ? NONE : c, s0 = size;
    size = (r * 2) / S; stamp(o, x / S, y / S, v); size = s0;
    o.finish(); refresh(...o.b); save();
    return o.idx.length;
  },
  undo: doUndo, redo: doRedo,
  routes: () => buildRoutes(),
  get codes() { return lastCodes; },
  get routesReady() { return routesReady; }, get routesBusy() { return routesBusy; },
  fill: (x, y, c) => { const c0 = cur; cur = c; fillAt({ x, y }); cur = c0; },
  exportPng, setEraseMode, get eraseMode() { return eraseMode; },
  erase: (x, y, r) => { const t = tool; tool = 'eraser'; const o = new Op('erase'), s0 = size; size = (r * 2) / S; stamp(o, x / S, y / S, eraseVal()); size = s0; tool = t; o.finish(); refresh(...o.b); save(); return o.idx.length; },
};

boot();
