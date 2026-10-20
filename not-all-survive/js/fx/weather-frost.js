// Window frost, grown procedurally from each screen corner.
// Each corner has its own seed (never mirrored copies). From the corner, a hairline
// runner creeps along each of its two edges, stopping at a random point, so some
// stretches of edge stay bare. Fronds branch off the runner at random spacing, with
// random lengths and angles; fronds sprout barbs and sometimes sub-fronds. On the
// bottom edge the fronds hang/curl sideways instead of standing up like trees.
// Every segment has a "birth" (path distance from the corner, 0..1): growth reveals
// segments in birth order, so the frost spreads out from the corners along the edges
// and recedes back into them. Each corner is drawn into one quarter-screen canvas,
// redrawn only when its growth changes noticeably (cheap; 4 canvases = one screen).
import { state } from '../state.js';
import { canvas, rng } from './weather-noise.js';

const SEEDS = [1931, 7717, 4243, 9001];   // TL, TR, BL, BR
let key = '', corners = [];

function build() {
  const { w, h } = state.view;
  const cw = Math.ceil(w / 2) + 2, ch = Math.ceil(h / 2) + 2;
  const D = Math.min(w, h) * 0.32;          // the longest fronds reach ~32% of the short side
  corners = SEEDS.map((seed, k) => {
    const bottom = k >= 2;
    const r = rng(seed);
    const segs = [];   // x0,y0,x1,y1,width,birth  (local: x along top/bottom edge, y along side, both inward)
    const dots = [];
    // Feather: a stem with alternating barbs; occasionally a sub-frond.
    function feather(x, y, a, len, curl, wd, b0, bLen, depth) {
      const step = 3.2, n = Math.max(2, Math.floor(len / step));
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
        const b = b0 + bLen * (i + 1) / n;
        segs.push([x, y, nx, ny, wd * (1 - t * 0.6), b]);
        if (r() < 0.06) dots.push([nx + (r() - 0.5) * 6, ny + (r() - 0.5) * 6, b]);
        if (depth > 0 && i > 0 && r() < 0.85) {
          const side = i % 2 ? 1 : -1;   // barbs alternate like a feather
          const bl = len * (0.09 + 0.2 * (1 - t)) * (0.45 + r() * 0.8) * (depth === 1 ? 0.8 : 1);
          if (bl > 3) feather(nx, ny, a + side * (0.5 + r() * 0.35), bl, curl * 0.4, wd * 0.6, b, bLen * bl / len * 0.6, depth - 1);
        }
        if (depth === 2 && i > n * 0.25 && r() < 0.07) {
          // A frond branching off the frond.
          const sl = len * (0.3 + r() * 0.3);
          feather(nx, ny, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.4), sl, curl, wd * 0.8, b, bLen * sl / len, 1);
        }
        x = nx; y = ny;
        a += curl;
      }
    }
    // Runner along one edge (axis 0: along x at y~0; axis 1: along y at x~0).
    function runner(axis, edgeLen) {
      const len = edgeLen * (0.45 + r() * 0.55);           // often stops short: bare edge beyond
      const runB = 0.45;                                  // birth budget for the runner itself
      const pts = [];
      let p = 0, off = 1 + r() * 3;
      while (p < len) {
        const q = Math.min(len, p + 5);
        off = Math.max(0.5, Math.min(7, off + (r() - 0.5) * 1.6));
        pts.push([p, q, off]);
        p = q;
      }
      for (const [p0, p1, o] of pts) {
        const b = runB * p1 / edgeLen;
        // (The runner itself is not drawn: a line hugging the screen edge reads as a frame.)
      }
      // 3-4 fronds on this corner's share of the edge, random spacing (heavy jitter).
      const n = 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const at = len * Math.min(0.97, (i + 0.15 + r() * 0.85) / n);
        const lenK = 0.4 + r() * 1.0;                      // 0.4..1.4 of the base length
        const flen = D / 1.4 * lenK;
        let ang = (r() - 0.5) * 0.87;                       // +-25 degrees off the inward normal
        let curl = (r() - 0.5) * 0.012;
        if (bottom && axis === 0) {
          // Bottom edge: lie over sideways and curl, never stand up like a tree.
          const dir = r() < 0.5 ? 1 : -1;
          ang = dir * (0.95 + r() * 0.4);
          curl = -dir * (0.008 + r() * 0.01);
        }
        const bStart = runB * at / edgeLen;
        if (axis === 0) feather(at, 2, Math.PI / 2 + ang, flen, curl, 1.15, bStart, 0.55 * lenK / 1.4, 2);
        else feather(2, at, ang, flen, curl, 1.15, bStart, 0.55 * lenK / 1.4, 2);
      }
    }
    runner(0, cw);
    runner(1, ch);
    // A couple of fronds out of the corner itself.
    for (let i = 0; i < 3; i++) {
      const lenK = 0.5 + r() * 0.7;
      feather(r() * 4, r() * 4, 0.45 + r() * 0.7, D / 1.4 * lenK, (r() - 0.5) * 0.01, 1.15, 0, 0.4 * lenK, 2);
    }
    for (let i = 0; i < 70; i++) {
      const along = Math.pow(r(), 1.4), off = Math.pow(r(), 2.5) * D * 0.25;
      const [x, y] = r() < 0.5 ? [along * cw * 0.7, off] : [off, along * ch * 0.7];
      dots.push([x, y, 0.45 * along * 0.8]);
    }
    const cv = canvas(cw, ch);
    return { segs, dots, cv, g: cv.getContext('2d'), drawn: -1, bottom, right: k % 2 === 1 };
  });
}

function render(c, lim) {
  const g = c.g;
  g.clearRect(0, 0, c.cv.width, c.cv.height);
  if (lim <= 0) return;
  const F = 0.06;
  g.lineCap = 'round';
  // Soft rime right in the corner, growing with the frost.
  const rr = 30 + lim * 160;
  const gd = g.createRadialGradient(0, 0, 0, 0, 0, rr);
  gd.addColorStop(0, `rgba(246,247,248,${0.6 * Math.min(1, lim * 2)})`);
  gd.addColorStop(1, 'rgba(246,247,248,0)');
  g.fillStyle = gd; g.fillRect(0, 0, rr, rr);
  // Pass 0: soft white rime glow; 1: white under-stroke; 2: grey hairline.
  for (const pass of [0, 1, 2]) {
    for (const s of c.segs) {
      if (s[5] > lim) continue;
      const f = Math.min(1, (lim - s[5]) / F);
      g.strokeStyle = pass === 2 ? `rgba(172,175,178,${0.9 * f})` : pass === 1 ? `rgba(252,252,253,${0.75 * f})` : `rgba(250,251,252,${0.22 * f})`;
      g.lineWidth = pass === 2 ? s[4] : pass === 1 ? s[4] + 1.4 : s[4] + 5;
      g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke();
    }
  }
  for (const d of c.dots) {
    if (d[2] > lim) continue;
    g.fillStyle = `rgba(130,133,136,${0.6 * Math.min(1, (lim - d[2]) / F)})`;
    g.fillRect(d[0], d[1], 1.2, 1.2);
  }
}

const RATE = [1.04, 0.86, 0.95, 1.12];
// amount 0..1 (overall frost). Draws all four corners.
export function drawFrost(ctx, amount) {
  if (amount <= 0.02) return;
  const { w, h } = state.view;
  const k = `${w}x${h}`;
  if (k !== key) { key = k; build(); }
  for (let i = 0; i < 4; i++) {
    const c = corners[i];
    // Births run 0..1; at full frost everything is grown.
    const lim = Math.min(1, amount * RATE[i] * 1.05);
    if (Math.abs(lim - c.drawn) > 0.012) { render(c, lim); c.drawn = lim; }
    ctx.save();
    ctx.translate(c.right ? w : 0, c.bottom ? h : 0);
    ctx.scale(c.right ? -1 : 1, c.bottom ? -1 : 1);
    // Receding fades the whole thing as well as shrinking it back into the corner.
    ctx.globalAlpha = Math.min(1, amount * 2.5);
    ctx.drawImage(c.cv, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
