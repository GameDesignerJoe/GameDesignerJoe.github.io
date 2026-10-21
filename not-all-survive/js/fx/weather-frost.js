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
  for (const c of corners) {
    if (c.full) { if (c.full.close) c.full.close(); else c.full.width = c.full.height = 0; }   // free GPU memory
    if (c.view) c.view.width = c.view.height = 0;
    if (c.tview) c.tview.width = c.tview.height = 0;
  }
  const { w, h } = state.view;
  const cwC = Math.ceil(w / 2) + 2, chC = Math.ceil(h / 2) + 2;
  // Frost is generated directly in sprite pixels: never more than the canvas's own
  // resolution, at most 1024 px on the long side (upscaled when drawn). That keeps
  // both its memory and its one-off render cost independent of the screen size.
  const K = Math.min(state.view.dpr || 1, 1024 / Math.max(cwC, chC), 1);
  const cw = Math.round(cwC * K), ch = Math.round(chC * K);
  const D = Math.min(w, h) * 0.32 * K;      // the longest fronds reach ~32% of the short side
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
      // Shorter edges (phones) get proportionally more fronds so growth stays dense.
      const n = 3 + Math.floor(r() * 2) + (edgeLen < 260 ? 2 : edgeLen < 420 ? 1 : 0);
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
    for (let i = 0, nc = Math.min(w, h) < 520 ? 5 : 3; i < nc; i++) {
      const lenK = 0.5 + r() * 0.7;
      feather(r() * 4, r() * 4, 0.45 + r() * 0.7, D / 1.4 * lenK, (r() - 0.5) * 0.01, 1.15, 0, 0.4 * lenK, 2);
    }
    for (let i = 0; i < 70; i++) {
      const along = Math.pow(r(), 1.4), off = Math.pow(r(), 2.5) * D * 0.25;
      const [x, y] = r() < 0.5 ? [along * cw * 0.7, off] : [off, along * ch * 0.7];
      dots.push([x, y, 0.45 * along * 0.8]);
    }
    return { segs, dots, cw: cwC, ch: chC, sw: cw, sh: ch, k: K, full: null, bottom, right: k % 2 === 1 };
  });
}

function render(c, lim, g) {
  if (lim <= 0) return;
  const F = 0.06;
  g.lineCap = 'round';

  // Pass 0: soft white rime glow; 1: white under-stroke; 2: grey hairline.
  // Fully grown segments are batched into one path per pass and width step.
  for (const pass of [1, 2]) {
    const groups = new Map();
    for (const s of c.segs) {
      if (s[5] > lim - F) continue;
      const wq = Math.round(s[4] * 4) / 4;
      let p = groups.get(wq); if (!p) { p = new Path2D(); groups.set(wq, p); }
      p.moveTo(s[0], s[1]); p.lineTo(s[2], s[3]);
    }
    g.strokeStyle = pass === 2 ? 'rgba(172,175,178,0.9)' : 'rgba(252,252,253,0.45)';
    for (const [wq, p] of groups) { g.lineWidth = pass === 2 ? wq : wq + 1; g.stroke(p); }
    for (const s of c.segs) {
      if (s[5] > lim || s[5] <= lim - F) continue;
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
// Each corner's frost is rendered ONCE, fully grown, into a quarter-screen canvas
// (lazily, one corner per frame). Growth is then just a reveal: the canvas is drawn
// through rectangular clips that extend along the two edges and inward as the frost
// grows, so the hairlines appear to creep out from the corner. No per-frame or
// per-stage re-rendering (that caused stalls and GPU memory pressure).
// The reveal: an L-shaped region along the two edges, drawn into a tiny mask and
// upscaled with smoothing so its edges are soft (no visible rectangle), applied to the
// full-grown sprite with destination-in into a cached 'view' canvas.
const MW = 40;
function compose(c, a, D) {
  const sw = c.sw, sh = c.sh;
  if (!c.view) {
    c.view = canvas(sw, sh); c.vg = c.view.getContext('2d');
    const mh = Math.max(8, Math.round(MW * sh / sw));
    c.mask = canvas(MW, mh); c.mg = c.mask.getContext('2d');
  }
  const mw = c.mask.width, mh = c.mask.height, mg = c.mg;
  mg.clearRect(0, 0, mw, mh);
  mg.fillStyle = '#fff';
  const ax = mw * Math.min(1, a * 1.15), ay = mh * Math.min(1, a * 1.15);
  const dep = Math.min(1, (12 + D * 1.25 * a) / Math.max(c.cw, c.ch)) * Math.max(mw, mh);
  mg.fillRect(0, 0, ax, Math.min(mh, dep));
  mg.fillRect(0, 0, Math.min(mw, dep), ay);
  const g = c.vg;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, sw, sh);
  g.drawImage(c.full, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(c.mask, -sw / mw, -sh / mh, sw + 2 * sw / mw, sh + 2 * sh / mh);
  g.globalCompositeOperation = 'source-over';
  // Cool-blue night variant (same pixels, tinted), used when lighting.night > 0.
  if (!c.tview) { c.tview = canvas(sw, sh); c.tg = c.tview.getContext('2d'); }
  const tg = c.tg;
  tg.globalCompositeOperation = 'source-over';
  tg.clearRect(0, 0, sw, sh);
  tg.drawImage(c.view, 0, 0);
  tg.globalCompositeOperation = 'source-atop';
  tg.fillStyle = 'rgba(196,212,240,0.55)';
  tg.fillRect(0, 0, sw, sh);
  tg.globalCompositeOperation = 'source-over';
}

export function drawFrost(ctx, amount, tint = 0) {
  if (amount <= 0.02) return;
  const { w, h } = state.view;
  const key2 = `${w}x${h}`;
  if (key2 !== key) { key = key2; build(); }
  let budget = 1;
  const D = Math.min(w, h) * 0.32;
  for (let i = 0; i < 4; i++) {
    const c = corners[i];
    if (!c.full) {
      if (!budget) continue;
      budget--;
      // Sprite resolution: never more than the canvas's own pixels, and at most 1024 px
      // on its long side (upscaled when drawn).
      c.full = canvas(c.sw, c.sh);
      render(c, 1, c.full.getContext('2d'));
      // Freeze it into an ImageBitmap: a canvas full of recorded strokes can be
      // re-rasterised when sampled (hundreds of ms per frame at 4K).
      const src = c.full;
      createImageBitmap?.(src).then(b => { if (c.full === src) { c.full = b; src.width = src.height = 0; } });
    }
    const a = Math.min(1, amount * RATE[i] * 1.05);
    if (!c.full.width && !c.full.close) continue;
    // Recompose the revealed view only when the growth has visibly changed.
    if (!c.view || Math.abs(a - c.va) > 0.008) {
      compose(c, a, D); c.va = a;
      // Freeze into a bitmap (sampling a canvas of recorded ops can re-rasterise it).
      const stamp = (c.stamp = (c.stamp || 0) + 1);
      createImageBitmap?.(c.view).then(b => { if (c.stamp === stamp) { c.vbm?.close?.(); c.vbm = b; } else b.close?.(); });
    }
    ctx.save();
    ctx.translate(c.right ? w : 0, c.bottom ? h : 0);
    ctx.scale(c.right ? -1 : 1, c.bottom ? -1 : 1);
    // Receding fades the whole thing as well as shrinking it back into the corner.
    ctx.globalAlpha = Math.min(1, amount * 2.5);
    if (tint < 0.98) ctx.drawImage(c.vbm && c.vbmStamp !== -1 ? c.vbm : c.view, 0, 0, c.cw, c.ch);
    if (tint > 0.02 && c.tview) { ctx.globalAlpha *= tint; ctx.drawImage(c.tview, 0, 0, c.cw, c.ch); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
