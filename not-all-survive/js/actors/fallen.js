// The fallen: expedition members who died out here stay where they fell for the rest of the
// run, a grim landmark. Each is the explorer's own drawing at the moment of death (body.js
// hands it over in the 'handover' event: { x, y, facing, sprite: { fig, shadow, x0, y0, w, h } }),
// and the snow slowly drifts over it: white settles on the upper surfaces, a drift builds
// round the body and creeps up its lee side. Faster in a storm, never quite burying it.
//
// Lost at sea ('handover' with lost: true, no sprite): no body; slow dark rings where they went
// under, fading over ~25 s, then nothing.
//
// state.fallen = [{ x, y, facing, name, snow 0..1, ... }] (sea: { lost: true, age })
// Slice 4 will let you hold on a body to recover the pack.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const KY = 0.8;
const SNOW_MAX = 0.78;            // the drift never quite buries them
const fallen = state.fallen = [];

function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

export function update(dt) {
  for (const e of state.events) {
    if (e.type === 'handover' && e.lost) { fallen.push({ x: e.x, y: e.y, name: e.name, lost: true, age: 0 }); continue; }
    if (e.type !== 'handover' || !e.sprite) continue;
    const r = seeded(1 + fallen.length * 7919 + Math.floor(e.x * 13 + e.y * 7));
    // snow patches, in sprite pixels: scattered over the figure, bigger toward the upwind
    // edge, revealed one by one as the snow builds
    const sp = e.sprite, blobs = [];
    for (let i = 0; i < 40; i++) {
      blobs.push({ u: 0.18 + 0.64 * r(), v: 0.25 + 0.6 * r(), r: 0.005 + 0.012 * r(), at: r() * 0.95, sq: 0.35 + 0.25 * r(), du: (r() - 0.5) * 1.6 });
    }
    fallen.push({
      x: e.x, y: e.y, facing: e.facing ?? 0, name: e.name, sprite: sp, blobs,
      snow: 0, cache: null, cacheSnow: -1, seed: r() * 100,
    });
  }
  const snowfall = clamp(state.weather.snowfall ?? 0.3), wind = clamp(state.wind.speed ?? 0.3);
  // ~1.5 min to drift over in a blizzard, many minutes on a calm day
  const rate = 0.0015 + 0.009 * snowfall * (0.4 + wind);
  for (const f of fallen) { if (f.lost) f.age += dt; else f.snow = Math.min(SNOW_MAX, f.snow + rate * dt); }
}

// Snow lying along the top edges of the silhouette: the figure minus itself shifted down by
// d sprite px, filled with `col`. (Into a shared scratch canvas.)
let rimCan = null;
function topRim(fig, d, col) {
  if (!rimCan) rimCan = document.createElement('canvas');
  if (rimCan.width !== fig.width || rimCan.height !== fig.height) { rimCan.width = fig.width; rimCan.height = fig.height; }
  const g = rimCan.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, rimCan.width, rimCan.height);
  g.drawImage(fig, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col; g.fillRect(0, 0, rimCan.width, rimCan.height);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(fig, 0, d);
  g.drawImage(fig, -d * 0.4, d * 0.8);     // a little more on the upwind (left) shoulders
  g.globalCompositeOperation = 'source-over';
  return rimCan;
}

// The figure with the settled snow on it, re-rendered only when the snow has visibly grown.
function figureWithSnow(f) {
  const sp = f.sprite;
  if (f.cache && Math.abs(f.snow - f.cacheSnow) < 0.025) return f.cache;
  const c = f.cache || document.createElement('canvas');
  c.width = sp.fig.width; c.height = sp.fig.height;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(sp.fig, 0, 0);
  // rimed: the whole figure pales a little as the frost takes the colour out of it
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(238,240,242,${0.14 + 0.4 * f.snow})`;
  g.fillRect(0, 0, c.width, c.height);
  // snow capping every upward edge, deepening as it builds; its grey underside first
  const d = 2 + 16 * f.snow;
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.55; g.drawImage(topRim(sp.fig, d, '#8c9096'), 0, 2);
  g.globalAlpha = 1; g.drawImage(topRim(sp.fig, d, '#f8f8f6'), 0, 0);
  // and a few flecks caught on the cloth, each with a grey lower-right edge (light from the upper left)
  const W = c.width, H = c.height;
  for (const b of f.blobs) {
    const k = clamp((f.snow - b.at * SNOW_MAX * 0.85) / 0.18);
    if (k <= 0) continue;
    // each patch is two overlapping flat ellipses, so the edges are lumpy rather than round
    const x = b.u * W, y = b.v * H, rx = b.r * W * (0.5 + 0.5 * k), ry = rx * b.sq;
    const x2 = x + b.du * rx, y2 = y + ry * 0.3;
    g.fillStyle = `rgba(140,144,150,${0.5 * k})`;
    g.beginPath(); g.ellipse(x + rx * 0.15, y + ry * 0.45, rx, ry, 0, 0, Math.PI * 2); g.ellipse(x2 + rx * 0.15, y2 + ry * 0.45, rx * 0.7, ry * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(249,249,247,${0.96 * k})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.ellipse(x2, y2, rx * 0.7, ry * 0.8, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  f.cache = c; f.cacheSnow = f.snow;
  return c;
}

// A low drift round the body, wider along it, centred up under the hips; `front` draws only
// its near (lower) lip, which climbs over the legs and the lower coat as the snow builds. Its
// shape is cached per body and rebuilt only when the snow has grown.
const N = 32;
const wob = (f, a) => 1 + 0.06 * Math.sin(a * 3 + f.seed) + 0.04 * Math.sin(a * 7 + f.seed * 2);
function driftShape(f) {
  const q = Math.round(f.snow * 100);
  if (f.dq === q && f.dshape) return f.dshape;
  const s = f.snow, ang = Math.atan2(Math.sin(f.facing) * KY, Math.cos(f.facing));
  const ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
  const cx = f.x - Math.cos(ang) * 1.2, cy = f.y - 0.6 - Math.sin(ang) * 0.8;   // a little toward the legs
  const rx = 4.5 + 4 * s + 6 * ca, ry = 2 + 1.6 * s + 4 * sa;
  const ring = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2, k = wob(f, t);
    ring.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
  }
  // the crest is lumpy, and the body is buried unevenly: one end (an arm or the legs, by the
  // body's seed) lies deeper than the other
  const lift = 0.4 + 5 * s, low = [], top = [], tilt = f.seed % 2 < 1 ? 1 : -1;
  for (let i = 0; i <= N / 2; i++) {
    const t = (i / (N / 2)) * Math.PI, k = wob(f, t), u = i / (N / 2);
    const x = cx + Math.cos(t) * rx * k, y = cy + Math.sin(t) * ry * k;
    low.push([x, y]);
    const lump = 0.7 + 0.18 * Math.sin(t * 5 + f.seed) + 0.14 * Math.sin(t * 11 + f.seed * 3) + 0.1 * Math.sin(t * 19 + f.seed * 5);
    const deep = 0.75 + 0.5 * (tilt > 0 ? u : 1 - u);
    top.push([x, y - lift * Math.pow(Math.sin(t), 0.55) * lump * deep]);
  }
  f.dq = q;
  return (f.dshape = { ring, low, top, s });
}
const path = (ctx, pts, close) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath(); };
function drift(ctx, f, front) {
  const d = driftShape(f);
  if (!front) {
    // the whole mound, under the figure, with its soft shadow to the lower right
    path(ctx, d.ring, true);
    ctx.save(); ctx.translate(0.9, 0.6); ctx.fillStyle = 'rgba(120,124,130,0.14)'; ctx.fill(); ctx.restore();
    ctx.fillStyle = '#f6f6f4'; ctx.fill();
    return;
  }
  const { low, top } = d;
  ctx.beginPath();
  low.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], top[i][1]);
  ctx.closePath();
  ctx.fillStyle = '#f7f7f5'; ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // the crest: a faint grey line where it curls over
  path(ctx, top.slice(2, -2));
  ctx.lineWidth = 0.1; ctx.strokeStyle = `rgba(150,154,160,${0.5 * smooth01(d.s / 0.35)})`; ctx.stroke();
  // inked lower edge and stipple only once it's a real drift (a thin dusting has no edge)
  const ink = smooth01((d.s - 0.3) / 0.3);
  if (ink > 0.01) {
    path(ctx, low.slice(1, -3));
    ctx.lineWidth = 0.15; ctx.strokeStyle = `rgba(96,98,102,${0.7 * ink})`; ctx.stroke();
    ctx.fillStyle = `rgba(72,72,74,${0.6 * ink})`;
    for (let i = 1; i < low.length - 3; i += 2) ctx.fillRect(low[i][0] + 0.15, low[i][1] + 0.3, 0.2, 0.2);
  }
}
const smooth01 = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// Where the sea took one: three dark rings opening slowly, staggered, fading out (the floating
// mitt and the bubbles are explorer.js's, seen while the camera is still on the spot).
const SEA_LIFE = 25;
function drawSea(ctx, f) {
  for (let k = 0; k < 3; k++) {
    const t = ((f.age + k * 2.2) % 6.6) / 6.6, fade = clamp(1 - f.age / SEA_LIFE);
    const r = 3 + 11 * Math.sqrt(t), a = (1 - t) * fade;
    if (a <= 0.01) continue;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.lineWidth = 0.35; ctx.strokeStyle = `rgba(40,44,50,${0.4 * a})`; ctx.stroke();
  }
}

// One drawable per body, made once.
function drawableFor(f) {
  if (f.drawable) return f.drawable;
  if (f.lost) return (f.drawable = { x: f.x, y: f.y, draw: ctx => drawSea(ctx, f) });
  return (f.drawable = {
    x: f.x, y: f.y,
    draw(ctx) {
      const sp = f.sprite;
      drift(ctx, f, false);
      ctx.globalAlpha = 1 - f.snow * 0.8;               // the cast shadow sinks into the drift
      ctx.drawImage(sp.shadow, f.x + sp.x0, f.y + sp.y0, sp.w, sp.h);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(figureWithSnow(f), f.x + sp.x0, f.y + sp.y0, sp.w, sp.h);
      drift(ctx, f, true);
    },
  });
}

const out = [];
export function drawables() {
  out.length = 0;
  if (!fallen.length) return out;
  const r = visibleRect(30);
  for (const f of fallen) {
    if (f.x < r.x0 || f.x > r.x1 || f.y < r.y0 || f.y > r.y1 || (f.lost && f.age > SEA_LIFE)) continue;
    out.push(drawableFor(f));
  }
  return out;
}
