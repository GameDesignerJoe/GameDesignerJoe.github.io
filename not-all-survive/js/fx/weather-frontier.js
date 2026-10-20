// The storm wall at the edge of the world. Seen from the safe area, the frontier
// border is a wall of storm massing ahead: a dense grey storm body with a churning,
// scalloped top edge where the border begins, white billows boiling and rolling fast
// along it, whitening into blank whiteout deeper in, and white streamers tearing off
// the top toward the explorer. Each side of the map is drawn the same way (the
// painting's own flat edge art is buried under the same moving material).
// Rendered in a quarter-res buffer (soft by design); streamers at full res.
import { state, MAP_W, MAP_H } from '../state.js';
import { worldToScreen } from '../camera.js';
import { canvas } from './weather-noise.js';
import { director } from './weather-director.js';

const BORDER = 260;        // matches world/frontier.js
// The wall masses a little inside the border (towering storm), so it reads from
// ~200 px inside the safe area at the usual zoom.
const FRONT = BORDER + 90;
let T, buf, g, fogPat, greyPat, streakPat, cloudPat;
let t = 0;
const wisps = [];

export function init(textures) { T = textures; }

function ensure() {
  const { w, h } = state.view;
  const sc = Math.min(0.25, 320 / Math.max(w, h));
  const bw = Math.max(2, Math.round(w * sc)), bh = Math.max(2, Math.round(h * sc));
  if (!buf || buf.width !== bw || buf.height !== bh) {
    buf = canvas(bw, bh);
    g = buf.getContext('2d');
    fogPat = g.createPattern(T.fog, 'repeat');
    greyPat = g.createPattern(T.fogGrey, 'repeat');
    streakPat = g.createPattern(T.streak, 'repeat');
    cloudPat = g.createPattern(T.cloud, 'repeat');
  }
}

// Sides in screen space: front = screen coordinate of the border's inner line along the
// side's normal axis; dir = +1 if the storm lies toward increasing coordinate.
function sides() {
  const a = worldToScreen(FRONT, FRONT), b = worldToScreen(MAP_W - FRONT, MAP_H - FRONT);
  return [
    { axis: 'x', front: a.x, dir: -1, id: 0 },   // west: storm at smaller x
    { axis: 'x', front: b.x, dir: 1, id: 1 },    // east
    { axis: 'y', front: a.y, dir: -1, id: 2 },   // north
    { axis: 'y', front: b.y, dir: 1, id: 3 },    // south
  ];
}

const hash = n => { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };

// Torn top edge: domain-warped, fast-moving noise along the wall (about +-28 px),
// riding on big slow lobes so the line is never straight.
const ragged = (side, s) => {
  const k = side.id * 3.1, ds = (side.id % 2 ? 1 : -1) * t;
  const warp = 7 * Math.sin(s * 0.013 + ds * 0.9 + k) + 4 * Math.sin(s * 0.031 - t * 1.3);
  return 16 * Math.sin(s * 0.047 + warp + ds * 2.6) + 8 * Math.sin(s * 0.11 + warp * 1.7 - t * 3.4 + k)
    + 2.5 * Math.sin(s * 0.21 + warp * 2.3 + t * 5.1);
};
const lobeAt = (side, s) => 30 * Math.sin(s * 0.011 + side.id * 2 + t * 0.6) + 14 * Math.sin(s * 0.027 - t * 0.9);

// Path of one side's storm region (beyond its torn top edge).
function sidePath(ctx, side, sc, extra = 0) {
  const { w, h } = state.view;
  ctx.beginPath();
  const len = side.axis === 'x' ? h : w, far = side.dir > 0 ? (side.axis === 'x' ? w : h) + 400 : -400;
  for (let s = -60; s <= len + 60; s += 6) {
    const n = side.front - side.dir * (lobeAt(side, s) + ragged(side, s) + 30 + extra);
    if (side.axis === 'x') ctx.lineTo(n * sc, s * sc); else ctx.lineTo(s * sc, n * sc);
  }
  if (side.axis === 'x') { ctx.lineTo(far * sc, (len + 60) * sc); ctx.lineTo(far * sc, -60 * sc); }
  else { ctx.lineTo((len + 60) * sc, far * sc); ctx.lineTo(-60 * sc, far * sc); }
  ctx.closePath();
}

// Fill the buffer with a pattern scrolled along the side (and drifting toward the interior).
function layer(pat, tw, th, size, along, inward, side, al, rot = 0) {
  const bw = buf.width, bh = buf.height;
  const k = size;
  const TW = tw * k, TH = th * k;
  let ox = 0, oy = 0;
  if (side.axis === 'x') { ox = -side.dir * inward; oy = along; } else { ox = along; oy = -side.dir * inward; }
  ox = ((ox % TW) + TW) % TW; oy = ((oy % TH) + TH) % TH;
  g.save();
  g.globalAlpha = al;
  if (rot) { g.translate(buf.width / 2, buf.height / 2); g.rotate(rot); g.translate(-buf.width, -buf.height); }
  g.translate(ox - TW, oy - TH);
  // Patterns that are long along x (streaks) get turned to run along the side.
  if (side.axis === 'x' && th !== tw) { g.translate(TW, 0); g.rotate(Math.PI / 2); }
  g.scale(k, k);
  g.fillStyle = pat;
  g.fillRect(0, 0, (bw * (rot ? 2.5 : 1) + TW * 2) / k + tw, (bh * (rot ? 2.5 : 1) + TH * 2) / k + th);
  g.restore();
}

export function draw(ctx) {
  const { w, h } = state.view;
  const dt = Math.min(0.1, state.dt);
  t += dt;
  const S = sides().filter(s => {
    const lim = s.axis === 'x' ? w : h;
    // Visible when the front (with its crest) is on screen or the screen is inside it.
    return s.dir < 0 ? s.front + 70 > 0 : s.front - 70 < lim;
  });
  updateWisps(dt, S);
  if (!S.length) { drawWisps(ctx); return; }
  ensure();
  const bw = buf.width, sc = bw / w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, bw, buf.height);
  const fast = 1 + (director.frontierEsc || 0);   // sheets speed up as the explorer enters

  for (const side of S) {
    // Soft, boiling fringe ahead of the wall (feathered in a few offset passes).
    for (const [extra, al] of [[30, 0.16], [18, 0.22], [8, 0.32]]) {
      sidePath(g, side, sc, extra);
      g.fillStyle = `rgba(214,217,220,${al})`;
      g.fill();
    }
    g.save();
    sidePath(g, side, sc, 0);
    g.clip();
    // Storm body: darker grey near the crest, whitening into blank whiteout deeper in.
    const f0 = side.front * sc, deep = 300 * sc * side.dir;
    const x0 = side.axis === 'x' ? f0 : 0, y0 = side.axis === 'y' ? f0 : 0;
    const x1 = side.axis === 'x' ? f0 + deep : 0, y1 = side.axis === 'y' ? f0 + deep : 0;
    const gd = g.createLinearGradient(x0 - side.dir * 60 * sc * (side.axis === 'x' ? 1 : 0), y0 - side.dir * 60 * sc * (side.axis === 'y' ? 1 : 0), x1, y1);
    gd.addColorStop(0, 'rgb(164,168,172)');
    gd.addColorStop(0.4, 'rgb(184,188,192)');
    gd.addColorStop(1, 'rgb(236,238,240)');
    g.fillStyle = gd;
    g.fillRect(0, 0, bw, buf.height);
    // Dark billow cores rolling along the border, then bright billows boiling over them,
    // then fast sheets of blowing snow.
    const roll = t * 110 * fast * sc;              // ~110 screen px/s along the edge
    g.globalCompositeOperation = 'multiply';
    // Two textures at non-integer scales and different rotations: no visible grid.
    layer(greyPat, 256, 256, 0.62, roll * 0.8 + side.id * 50, t * 14 * sc, side, 0.75, 0.37);
    layer(cloudPat, 128, 128, 0.62 * 1.37 * 2, -roll * 0.45 + side.id * 90, t * 22 * sc, side, 0.5, -0.61);
    g.globalCompositeOperation = 'source-over';
    // (bright drifting snow over the dark body)
    layer(fogPat, 256, 256, 0.5, roll + side.id * 30, t * 30 * sc, side, 0.5, 0.21);
    layer(fogPat, 256, 256, 0.5 * 0.731, roll * 1.5, t * 45 * sc, side, 0.3, -0.83);
    // Erode the top with fast-moving fog noise (torn, ragged), then refill the depths
    // so only the front 20-60 px is torn open.
    g.globalCompositeOperation = 'destination-out';
    layer(fogPat, 256, 256, 0.21, roll * 1.8 + side.id * 70, t * 40 * sc, side, 0.55, 0.13);
    g.globalCompositeOperation = 'source-over';
    const gx0 = side.axis === 'x' ? f0 : 0, gy0 = side.axis === 'y' ? f0 : 0;
    const gx1 = side.axis === 'x' ? f0 + 110 * sc * side.dir : 0, gy1 = side.axis === 'y' ? f0 + 110 * sc * side.dir : 0;
    const rf = g.createLinearGradient(gx0, gy0, gx1, gy1);
    rf.addColorStop(0, 'rgba(200,203,206,0)');
    rf.addColorStop(0.45, 'rgba(196,199,202,0.55)');
    rf.addColorStop(1, 'rgba(232,234,236,1)');
    g.fillStyle = rf;
    g.fillRect(0, 0, bw, buf.height);
    g.restore();
  }

  // Keep the explorer readable once they're in it (the global whiteout takes over there).
  const p = worldToScreen(state.player.x, state.player.y - 8);
  const R = 90 * sc;
  const rg = g.createRadialGradient(p.x * sc, p.y * sc, 0, p.x * sc, p.y * sc, R);
  rg.addColorStop(0, 'rgba(0,0,0,0.8)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = rg;
  g.fillRect(0, 0, bw, buf.height);
  g.globalCompositeOperation = 'source-over';

  // Once the explorer is inside, the global whiteout takes over and the wall body fades.
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1 - 0.6 * Math.max(0, Math.min(1, ((director.frontier || 0) - 0.35) / 0.45));
  ctx.drawImage(buf, 0, 0, w, h);
  for (const side of S) drawSheets(ctx, side, ctx.globalAlpha);
  ctx.globalAlpha = 1;
  drawWisps(ctx);
}

// Wind-driven sheets inside the wall, at full resolution: long thin bright and grey
// streaks racing along the wall (like the whiteout sheets), densest near the torn top.
const SHEETS = 34;
function drawSheets(ctx, side, alpha) {
  const { w, h } = state.view;
  const len = side.axis === 'x' ? h : w;
  const fast = 1 + (director.frontierEsc || 0);
  const dirS = side.id % 2 ? -1 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  sidePath(ctx, side, 1, -4);
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < SHEETS; i++) {
    const h1 = hash(i * 1.31 + side.id * 17), h2 = hash(i * 2.17 + 5), h3 = hash(i * 3.71 + 9);
    const depth = Math.pow(h1, 1.8) * 160 + 6;               // px inside the front, most near the top
    const L = 70 + h2 * 200, sp = (220 + h3 * 200) * fast;
    const span = len + L + 200;
    const s = (((t * sp * dirS + h2 * 5000) % span) + span) % span - L - 100;
    const s0 = dirS > 0 ? s : len - s;
    const n = side.front - side.dir * (lobeAt(side, s0) + ragged(side, s0) + 30) + side.dir * depth;
    const grey = h3 < 0.38;
    ctx.fillStyle = grey ? `rgba(150,154,158,${0.22 + 0.18 * h1})` : `rgba(252,252,253,${0.3 + 0.3 * (1 - h1)})`;
    // A tapered sliver (fat head, needle tail) on a gentle curve, tilted a little.
    const wd = 0.5 + h2 * 1.1, bow = (6 + 8 * h3) * Math.sin(t * 1.6 + i), tilt = (h1 - 0.5) * 0.12 * L;
    const P = (u, off) => {
      const ss = s0 - dirS * L * u, nn = n + bow * Math.sin(Math.PI * u) + tilt * u + off;
      return side.axis === 'x' ? [nn, ss] : [ss, nn];
    };
    ctx.beginPath();
    let q = P(0, 0); ctx.moveTo(q[0], q[1]);
    for (let k = 1; k <= 6; k++) { const u = k / 6; q = P(u, -wd * (1 - u)); ctx.lineTo(q[0], q[1]); }
    for (let k = 5; k >= 0; k--) { const u = k / 6; q = P(u, wd * (1 - u)); ctx.lineTo(q[0], q[1]); }
    ctx.fill();
  }
  ctx.restore();
}

// --- streamers tearing off the top of the wall toward the explorer -------------------
function updateWisps(dt, S) {
  const { w, h } = state.view;
  for (const side of S) {
    const len = side.axis === 'x' ? h : w;
    if (Math.random() < dt * len / 40 && wisps.length < 90) {
      const s = Math.random() * len;
      wisps.push({ side, s, age: 0, life: 0.8 + Math.random() * 0.7, L: 30 + Math.random() * 45,
        curl: (Math.random() - 0.5) * 0.8, w0: 1.2 + Math.random() * 1.6 });
    }
  }
  // A few wisps blow across the explorer when they're at the wall or inside it.
  const p = state.player;
  const dEdge = Math.min(p.x, p.y, MAP_W - p.x, MAP_H - p.y);
  const near = Math.max(director.frontier || 0, Math.min(1, Math.max(0, (FRONT + 60 - dEdge) / 90)));
  if (near > 0.05 && Math.random() < dt * 5 * near && wisps.length < 110) {
    const ps = worldToScreen(p.x, p.y - 8), a = state.wind.angle;
    const back = 25 + Math.random() * 30;
    wisps.push({ free: true, x: ps.x - Math.cos(a) * back + (Math.random() - 0.5) * 18,
      y: ps.y - Math.sin(a) * back + (Math.random() - 0.5) * 22, a, age: 0, life: 0.7 + Math.random() * 0.4,
      L: 30 + Math.random() * 25, w0: 1.2 + Math.random(), sp: 70 + Math.random() * 50 });
  }
  for (const q of wisps) { q.age += dt; if (q.free) { q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt; continue; } q.s += dt * 90 * (q.side.id % 2 ? -1 : 1); }
  let k = 0;
  for (const q of wisps) if (q.age < q.life && (q.free || S.includes(q.side))) wisps[k++] = q;
  wisps.length = k;
}

function drawWisps(ctx) {
  ctx.lineCap = 'round';
  for (const q of wisps) {
    if (q.free) {
      const u = q.age / q.life, c = Math.cos(q.a), s = Math.sin(q.a);
      ctx.strokeStyle = `rgba(255,255,255,${0.32 * Math.sin(Math.PI * u)})`;
      ctx.lineWidth = q.w0;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.quadraticCurveTo(q.x - c * q.L * 0.5 - s * 4, q.y - s * q.L * 0.5 + c * 4, q.x - c * q.L, q.y - s * q.L);
      ctx.stroke();
      continue;
    }
    const side = q.side, u = q.age / q.life;
    const base = side.front - side.dir * (lobeAt(side, q.s) + ragged(side, q.s) + 28);
    const reach = q.L * (0.3 + u);                 // tears off and runs inward
    const n0 = base - side.dir * reach * 0.25, n1 = base - side.dir * reach;
    const s1 = q.s + q.curl * reach;
    const p = (n, s) => side.axis === 'x' ? [n, s] : [s, n];
    const [ax, ay] = p(n0, q.s), [bx, by] = p((n0 + n1) / 2, (q.s + s1) / 2 + q.curl * 8), [cx, cy] = p(n1, s1);
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * Math.sin(Math.PI * u)})`;
    ctx.lineWidth = q.w0 * (1 - u * 0.5);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(bx, by, cx, cy);
    ctx.stroke();
  }
}
