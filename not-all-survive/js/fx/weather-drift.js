// Ground spindrift (world space, drawn over the map, under the actors).
//   1. Drift sheets: a streaky texture rotated to the wind and scrolled downwind,
//      masked by wind strength, gust fronts, patchiness and terrain shelter. Rendered
//      into a half-res screen-aligned buffer, then composited.
//   2. Streamers: thin snaking ribbons of snow (a white line with a faint grey
//      under-edge so they read on white snow), batched into a few paths per frame.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import * as terrain from '../world/terrain.js';
import { director, windFast, frontU, frontFade } from './weather-director.js';
import { canvas, fillWind } from './weather-noise.js';

let T, buf, bctx, pats = {};
const clamp01 = v => Math.max(0, Math.min(1, v));

// --- shelter grid: shelterAt() sampled on a coarse world-aligned grid -----------------
const CELL = 20;
const grid = { x0: 0, y0: 0, gw: 0, gh: 0, vals: null, cv: null, t: -1, any: false };

function refreshGrid() {
  const r = visibleRect(CELL * 2);
  const x0 = Math.floor(r.x0 / CELL) * CELL, y0 = Math.floor(r.y0 / CELL) * CELL;
  const gw = Math.ceil((r.x1 - x0) / CELL) + 1, gh = Math.ceil((r.y1 - y0) / CELL) + 1;
  if (!grid.cv || grid.cv.width !== gw || grid.cv.height !== gh) {
    grid.cv = canvas(gw, gh);
    grid.vals = new Float32Array(gw * gh);
  }
  const g = grid.cv.getContext('2d');
  const img = g.createImageData(gw, gh);
  let any = false;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = x0 + i * CELL, y = y0 + j * CELL;
    const s = clamp01(terrain.shelterAt?.(x, y) || 0);
    const e = terrain.exposureAt ? clamp01(terrain.exposureAt(x, y)) : 0.75;
    // Exposed high ground gets more drift; the lee of cliffs and nooks much less.
    // Smooth ice and thin ice hold little loose snow: sparse, faint drift there.
    const cls = terrain.classAt ? terrain.classAt(x, y) : 0;
    const iceK = cls === 2 ? 0.4 : cls === 3 ? 0.3 : 1;
    const f = Math.min(1.15, (1 - s * 0.97) * (0.45 + 0.7 * e) * iceK);
    if (Math.abs(f - 1) > 0.03) any = true;
    const k = j * gw + i;
    grid.vals[k] = f;
    img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = 255;
    img.data[k * 4 + 3] = Math.min(1, f) * 255;
  }
  g.putImageData(img, 0, 0);
  Object.assign(grid, { x0, y0, gw, gh, any, t: state.time });
}

// ~0..1.15 wind multiplier at a world point (1 = ordinary open ground).
export function exposureAt(x, y) {
  if (!grid.any) return 1;
  const i = Math.round((x - grid.x0) / CELL), j = Math.round((y - grid.y0) / CELL);
  if (i < 0 || j < 0 || i >= grid.gw || j >= grid.gh) return 1;
  return grid.vals[j * grid.gw + i];
}

// Bilinear version (smooth fades, e.g. for the gust crest).
function exposureSmooth(x, y) {
  if (!grid.any) return 1;
  let fx = (x - grid.x0) / CELL, fy = (y - grid.y0) / CELL;
  if (fx < 0 || fy < 0 || fx >= grid.gw - 1 || fy >= grid.gh - 1) return 1;
  const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * grid.gw + i, V = grid.vals;
  const a = V[k] + (V[k + 1] - V[k]) * tx, b = V[k + grid.gw] + (V[k + grid.gw + 1] - V[k + grid.gw]) * tx;
  return a + (b - a) * ty;
}

// --- streamers --------------------------------------------------------------------
const MAX = 240;
const S = [];
function spawn(s, r, anywhere) {
  const a = state.wind.angle;
  // New streamers appear anywhere on screen, or along the upwind edge once running.
  const burst = burstFront();
  const fr = burst && !anywhere && Math.random() < 0.85 ? burst
    : director.fronts.length && !anywhere && Math.random() < 0.5
      ? director.fronts[Math.floor(Math.random() * director.fronts.length)] : null;
  if (fr) {
    // Crowd the gust front: spawn just behind its leading edge.
    const c = Math.cos(a), sn = Math.sin(a);
    const cv = -state.cam.x * sn + state.cam.y * c;
    const u = fr.pos - Math.random() * fr.tail * 1.2;
    const v = cv + (Math.random() - 0.5) * Math.max(r.x1 - r.x0, r.y1 - r.y0) * 1.2;
    s.x = u * c - v * sn; s.y = u * sn + v * c;
  } else if (anywhere || Math.random() < 0.65) {
    s.x = r.x0 + Math.random() * (r.x1 - r.x0);
    s.y = r.y0 + Math.random() * (r.y1 - r.y0);
  } else {
    const t = Math.random();
    if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) { s.x = Math.cos(a) > 0 ? r.x0 : r.x1; s.y = r.y0 + t * (r.y1 - r.y0); }
    else { s.y = Math.sin(a) > 0 ? r.y0 : r.y1; s.x = r.x0 + t * (r.x1 - r.x0); }
  }
  s.age = 0;
  s.life = fr ? 0.9 + Math.random() * 1.4 : 1.2 + Math.random() * 2.6;
  s.lenK = 0.55 + Math.random() * 0.7;
  s.amp = 0.8 + Math.random() * 2.6;
  s.k = 0.05 + Math.random() * 0.09;
  s.ph = Math.random() * 100;
  s.ph2 = Math.random() * 100;
  s.v = 0;
  s.I = 0;
}

// A front that hit the explorer less than 1.5 s ago (streamer spawns triple there).
function burstFront() {
  for (const f of director.fronts) if (f.hitTime !== undefined && state.time - f.hitTime < 1.5) return f;
  return null;
}

export function init(textures) {
  T = textures;
  for (let i = 0; i < MAX; i++) S.push({ dead: true, age: 0, life: 0, I: 0 });
}
let seeded = false;

export function update(dt) {
  if (!state.cam.zoom) return; // camera not placed yet (first frame)
  if (!seeded) {
    seeded = true;
    const r0 = visibleRect(30);
    for (const s of S) { spawn(s, r0, true); s.dead = false; s.age = Math.random() * s.life; }
  }
  if (state.time - grid.t > 0.3 || grid.t < 0) refreshGrid();
  const r = visibleRect(30);
  const a = state.wind.angle, c = Math.cos(a), sn = Math.sin(a);
  const area = (r.x1 - r.x0) * (r.y1 - r.y0);
  const burst = burstFront();
  for (const f of director.fronts) if (f.hit && f.hitTime === undefined) f.hitTime = state.time;
  let n = Math.round(area / 420 * clamp01(0.2 + state.wind.speed * 1.1));
  if (burst) n *= 3;
  n = Math.min(Math.round(MAX * director.quality), n);
  for (let i = 0; i < MAX; i++) {
    const s = S[i];
    // During a burst, ordinary streamers age out three times as fast and respawn at the front.
    s.age += burst ? dt * 3 : dt;
    const out = s.x < r.x0 - 20 || s.x > r.x1 + 20 || s.y < r.y0 - 20 || s.y > r.y1 + 20;
    if (s.age > s.life || out) {
      if (i < n) {
        spawn(s, r, out && s.age < 0.01);
        // Sparser on ice / in shelter: most spawns there are rejected (one retry).
        if (Math.random() > exposureAt(s.x, s.y) + 0.15) { spawn(s, r, false); if (exposureAt(s.x, s.y) < 0.5) s.life = 0.01; }
      } else { s.I = 0; s.age = 0; s.life = 0.5; s.dead = true; continue; }
      s.dead = false;
    }
    if (s.dead) continue;
    const ex = exposureAt(s.x, s.y);
    const W = windFast(s.x, s.y) * ex * Math.min(1, ex + 0.2);
    const v = 14 + 125 * W;
    s.v += (v - s.v) * Math.min(1, dt * 3);
    s.x += c * s.v * dt;
    s.y += sn * s.v * dt;
    s.I = clamp01((W - 0.1) * 1.25);
  }
}

// --- drawing ----------------------------------------------------------------------
let sheetU = 0, blobU = 0, lastT = 0;

function ensureBuf() {
  const { w, h } = state.view;
  const scale = Math.min(0.5, 720 / Math.max(w, h));
  const bw = Math.max(2, Math.round(w * scale)), bh = Math.max(2, Math.round(h * scale));
  if (!buf || buf.width !== bw || buf.height !== bh) {
    buf = canvas(bw, bh);
    bctx = buf.getContext('2d');
    pats = {};
  }
  if (!pats.streak) {
    pats.streak = bctx.createPattern(T.streak, 'repeat');
    pats.blob = bctx.createPattern(T.blob, 'repeat');
  }
}

// Gust fronts as bands in the wind frame, in strips so the front can bend.
// peak: alpha at the leading edge, body: alpha through the trailing tail.
function drawBands(g, r, a, peak, body) {
  const c = Math.cos(a), s = Math.sin(a);
  g.save();
  g.rotate(a);
  let vmin = Infinity, vmax = -Infinity;
  for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]]) {
    const vv = -x * s + y * c; vmin = Math.min(vmin, vv); vmax = Math.max(vmax, vv);
  }
  const strips = 10, sh = (vmax - vmin) / strips;
  for (const f of director.fronts) {
    const fa = Math.min(1, f.age / 0.5) * (f.dying ? Math.max(0, 1 - f.dying) : 1);
    for (let k = 0; k < strips; k++) {
      const v = vmin + (k + 0.5) * sh;
      const front = f.pos + Math.sin(v * 0.012 + f.phase) * f.bend + Math.sin(v * 0.031 + f.phase * 2) * f.bend * 0.4;
      const str = f.strength * fa * (0.65 + 0.35 * Math.sin(v * 0.02 + f.phase * 3));
      const u0 = front - f.tail * 2.2, u1 = front + 14;
      const gd = g.createLinearGradient(u0, 0, u1, 0);
      gd.addColorStop(0, 'rgba(255,255,255,0)');
      gd.addColorStop(0.5, `rgba(255,255,255,${str * body})`);
      gd.addColorStop(0.82, `rgba(255,255,255,${Math.min(1, str * peak)})`);
      gd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gd;
      g.fillRect(u0, v - sh / 2 - 1, u1 - u0, sh + 2);
    }
  }
  g.restore();
}

function drawSheets(ctx) {
  ensureBuf();
  const { w, h, dpr } = state.view, cam = state.cam, z = cam.zoom;
  const dt = Math.max(0, state.time - lastT); lastT = state.time;
  const W = state.wind.speed;
  sheetU += (20 + 120 * W) * dt;
  blobU += (10 + 50 * W) * dt;

  const base = clamp01((W - 0.12) / 0.88) * 0.85;
  const gusty = director.fronts.length > 0;
  if (base < 0.02 && !gusty) return;

  const bs = buf.width / w;
  const g = bctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, buf.width, buf.height);
  g.setTransform(bs * z, 0, 0, bs * z, bs * (w / 2 + cam.shakeX - cam.x * z), bs * (h / 2 + cam.shakeY - cam.y * z));
  const r = visibleRect(8);
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a);

  // Mask: base wind strength...
  g.fillStyle = `rgba(255,255,255,${base})`;
  g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);

  // ...plus every gust front as a travelling band.
  if (gusty) { g.globalCompositeOperation = 'lighter'; drawBands(g, r, a, 0.35, 0.3); }

  // Streak texture through the mask.
  g.globalCompositeOperation = 'source-in';
  fillWind(g, pats.streak, 256, 128, 0.42, sheetU, 0, r, a);
  // A soft unstreaked wall of blowing snow riding each front.
  if (gusty) { g.globalCompositeOperation = 'source-over'; drawBands(g, r, a, 0.25, 0.12); }
  // Patchiness drifting more slowly than the streaks.
  g.globalCompositeOperation = 'destination-in';
  fillWind(g, pats.blob, 64, 64, 3.2, blobU, 0, r, a);
  // Thin out in the lee of cliffs.
  if (grid.any) {
    g.imageSmoothingEnabled = true;
    g.drawImage(grid.cv, grid.x0 - CELL / 2, grid.y0 - CELL / 2, grid.gw * CELL, grid.gh * CELL);
  }
  g.globalCompositeOperation = 'source-over';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(buf, 0, 0, w, h);
  ctx.globalAlpha = 1;
}

const LEVEL_A = [0.3, 0.62, 1];
const PART_A = [1, 0.4];
const SEG = 8;

// Preallocated polyline storage per bucket (3 intensity levels x head/tail): no
// per-frame allocation. pts: x,y pairs; lens: points per polyline.
const NB = 6;
const pts = Array.from({ length: NB }, () => new Float32Array(MAX * (SEG + 2) * 2));
const lens = Array.from({ length: NB }, () => new Uint8Array(MAX * 2));
const np = new Int32Array(NB), nl = new Int32Array(NB);

function strokeBucket(ctx, b) {
  const P = pts[b], Ls = lens[b];
  ctx.beginPath();
  let k = 0;
  for (let l = 0; l < nl[b]; l++) {
    const n = Ls[l];
    ctx.moveTo(P[k], P[k + 1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[k + i * 2], P[k + i * 2 + 1]);
    k += n * 2;
  }
  ctx.stroke();
}

function drawStreamers(ctx) {
  const a = state.wind.angle, c = Math.cos(a), sn = Math.sin(a);
  const t = state.time;
  np.fill(0); nl.fill(0);
  let drew = false;
  for (const s of S) {
    if (s.dead || s.I < 0.03) continue;
    const env = Math.sin(Math.PI * Math.min(1, s.age / s.life));
    const I = s.I * env;
    if (I < 0.04) continue;
    const lvl = Math.min(2, Math.floor(I * 3));
    const L = Math.min(70, Math.max(6, s.v * 0.42)) * s.lenK;
    const uh = s.x * c + s.y * sn;
    // Two continuous polylines: bright head, faint tail (sharing the joint point).
    let part = -1, b = 0, cnt = 0;
    for (let i = 0; i <= SEG; i++) {
      const back = (L * i) / SEG;
      const uu = uh - back;
      const off = s.amp * Math.sin(uu * s.k + s.ph + t * 0.5) + s.amp * 0.35 * Math.sin(uu * s.k * 2.7 + s.ph2 - t * 0.9);
      const x = s.x - c * back - sn * off, y = s.y - sn * back + c * off;
      const p2 = i < SEG * 0.45 ? 0 : 1;
      if (p2 !== part) {
        if (part >= 0) { pts[b][np[b]++] = x; pts[b][np[b]++] = y; lens[b][nl[b]++] = cnt + 1; }
        part = p2; b = lvl * 2 + part; cnt = 0;
      }
      pts[b][np[b]++] = x; pts[b][np[b]++] = y; cnt++;
    }
    lens[b][nl[b]++] = cnt;
    drew = true;
  }
  if (!drew) return;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  // Keep lines at least ~1.2 CSS px wide on low-zoom (phone) views.
  const z = state.cam.zoom || 1, lw = Math.max(0.75, 1.25 / z);
  // Grey under-edge (light comes from the upper left, so it sits lower right).
  ctx.save();
  ctx.translate(0.4, 0.6);
  ctx.lineWidth = lw * 0.95;
  for (let l = 0; l < 3; l++) for (let p = 0; p < 2; p++) {
    ctx.strokeStyle = `rgba(105,110,115,${LEVEL_A[l] * PART_A[p] * 0.55})`;
    strokeBucket(ctx, l * 2 + p);
  }
  ctx.restore();
  ctx.lineWidth = lw;
  for (let l = 0; l < 3; l++) for (let p = 0; p < 2; p++) {
    ctx.strokeStyle = `rgba(255,255,255,${LEVEL_A[l] * PART_A[p]})`;
    strokeBucket(ctx, l * 2 + p);
  }
}

// The leading edge of every gust front: a broken, scalloped surge of blowing snow.
// The crest comes in 3-5 offset segments with gaps between them; each is a soft bright
// band 10-25 px deep with a faint grey under-edge, white wisps lifting off it, and it
// fades to ~40% over rock and in shelter so it never slices through cliff faces.
// Drawn in the wind frame (u downwind, v across) in short pieces, each with its own
// gradient and strength.
const PIECE = 3;          // world px per piece along the front
const hash = n => { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };
// 1-D crest profile, left = upwind tail, right = soft leading lead-in.
let crest = null;
function crestSprite() {
  if (crest) return crest;
  crest = canvas(96, 1);
  const g = crest.getContext('2d'), gd = g.createLinearGradient(0, 0, 96, 0);
  gd.addColorStop(0, 'rgba(255,255,255,0)');
  gd.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  gd.addColorStop(0.86, 'rgba(255,255,255,0.55)');
  gd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gd; g.fillRect(0, 0, 96, 1);
  return crest;
}
function drawFrontEdges(ctx) {
  if (!director.fronts.length) return;
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a);
  const z = state.cam.zoom || 1, px = 1 / z;
  const r = visibleRect(20);
  let vmin = Infinity, vmax = -Infinity, umin = Infinity, umax = -Infinity;
  for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]]) {
    const vv = -x * s + y * c, uu = x * c + y * s;
    vmin = Math.min(vmin, vv); vmax = Math.max(vmax, vv); umin = Math.min(umin, uu); umax = Math.max(umax, uu);
  }
  // Segment length so 3-5 segments span the screen's across-wind extent.
  const segLen = Math.max(40, (vmax - vmin) / 4);
  const t = state.time;
  ctx.save();
  ctx.rotate(a);
  ctx.lineCap = 'round';
  for (const f of director.fronts) {
    const fa = frontFade(f) * f.strength;
    if (fa < 0.05 || f.pos < umin - 80 || f.pos > umax + 80) continue;
    const v0 = Math.floor(vmin / PIECE) * PIECE;
    for (let v = v0; v < vmax; v += PIECE) {
      const vm = v + PIECE / 2;
      // Which segment, and where in it (gaps fill the last ~22% of each segment).
      const sv = (vm + f.phase * 37) / segLen, si = Math.floor(sv), sf = sv - si;
      if (sf > 0.78) continue;
      const ef = Math.max(0, Math.min(1, sf / 0.14, (0.78 - sf) / 0.14));
      const edgeFade = ef * ef * (3 - 2 * ef);
      // Segments stagger and vary in depth, smoothly (no seams between pieces).
      const segOff = (hash(si + f.phase) - 0.5) * 22 * px + Math.sin(sf * Math.PI) * 6 * px;
      const depth = (10 + 15 * hash(si * 3.1 + f.phase)) * px * (0.6 + 0.4 * Math.sin(sf / 0.78 * Math.PI));
      const scal = 2.2 * Math.abs(Math.sin(vm * 0.23 + f.phase)) * px * z * 0.5; // scallops
      const u = frontU(f, vm) + segOff + scal;
      // Terrain: fade over rock and in shelter.
      const wx = u * c - vm * s, wy = u * s + vm * c;
      const rock = terrain.classAt ? terrain.classAt(wx, wy) === 4 : false;
      const k = fa * edgeFade * (rock ? 0.4 : Math.max(0.2, Math.min(1, exposureSmooth(wx, wy))));
      if (k < 0.03) continue;
      // Soft crest + body: 6px soft lead-in, bright crest, fading through the depth
      // and a long faint tail of blowing snow behind.
      // The crest profile is a prebaked 1-D sprite (soft lead-in, crest, body, tail),
      // mirrored so u decreases left to right in the sprite; stretched per piece.
      const span = depth + 36 * px;
      ctx.globalAlpha = k;
      ctx.drawImage(crestSprite(), u + 6 * px - span, v - 0.2, span, PIECE + 0.4);
      // Faint grey under-edge.
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(150,154,158,${0.18 * k})`;
      ctx.fillRect(u + 1 * px, v, 2.5 * px, PIECE);
      // White wisps lifting off the crest (curling back upwind and up the screen).
      const hw = hash(Math.floor(vm / 9) + f.phase * 9);
      if (hw < 0.55 && Math.floor(vm / PIECE) % 3 === 0) {
        const ph = (t * 1.3 + hw * 10) % 1;
        const len = (8 + hw * 14) * px * (0.4 + ph);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * k * (1 - ph)})`;
        ctx.lineWidth = 1.3 * px;
        ctx.beginPath();
        ctx.moveTo(u - 2 * px, vm);
        ctx.quadraticCurveTo(u - len * 0.6, vm - len * 0.15, u - len, vm - len * (0.35 + hw * 0.4));
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawGround(ctx) {
  if (!seeded) return;
  // Streamers in world space first (ctx already has the camera transform).
  const off = state.params.get('wxoff') || '';
  ctx.save();
  if (!off.includes('streamers')) drawStreamers(ctx);
  ctx.restore();
  if (!off.includes('sheets')) { ctx.save(); drawSheets(ctx); ctx.restore(); }
  drawFrontEdges(ctx);
}
