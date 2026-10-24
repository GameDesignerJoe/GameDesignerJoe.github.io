// Motion graphics for the trailer, drawn over the finished game frame in screen space (CSS px),
// in the game's own idiom: ink on snow, a thin monospace for data, signal yellow only for the signal.
//
//   begin(ctx, w, h, t, T)        once a frame (t: shot time, T: trailer time)
//   title(text, x, y, o)          serif lettering revealed by an ink bleed (o.k 0..1 in, o.out 0..1 away)
//   mono(text, x, y, o)           typed data caption (o.k 0..1 typed), with a block cursor
//   stroke(pts, k, o)             a hand-inked line drawing itself on (k 0..1 of its length)
//   wave(x0, x1, y, o)            a radio trace with blips
//   morse(x, y, o)                · · · — — — · · · lighting up in time
//   bars(h, o)                    the letterbox (h: px each, top and bottom)
//   vignette / dark / ...         helpers
export let ctx = null, W = 0, H = 0, t = 0, T = 0;
export const SERIF = '"Playfair Display SC", "Didot", Georgia, serif';
export const MONO = '"IBM Plex Mono", Consolas, "Courier New", monospace';
export const INK = '#1d1d1f', PAPER = '#f4f4f1', YELLOW = '#e2a53b', GLOW = '#ffc96b';

export function begin(c, w, h, st, gt) { ctx = c; W = w; H = h; t = st; T = gt; }

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
export const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeIn = x => Math.pow(clamp(x), 3);
// ramp in over [a, a+din], hold, out over [b-dout, b]
export const env = (v, a, din, b, dout) => Math.min(smooth(a, a + din, v), 1 - smooth(b - dout, b, v));

// --- noise ------------------------------------------------------------------------------------------
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 1, oct = 4) { let a = 0, f = 1, w = 0.5, n = 0; for (let i = 0; i < oct; i++) { a += w * vnoise(x * f, y * f, s + i * 17); n += w; f *= 2.03; w *= 0.5; } return a / n; }

// --- ink-bleed lettering ----------------------------------------------------------------------------
// Each block is drawn once into a sprite (crisp), with a blurred copy (the bleed) and a noise field
// at quarter resolution. A frame thresholds blur + noise into a soft mask that grows with k: the ink
// finds the letters first, feathering out along the paper's fibres, then fills them.
const cache = new Map();
function block(text, o) {
  const key = [text, o.size, o.font, o.track, o.color, o.weight, o.italic].join('|');
  let b = cache.get(key);
  if (b) return b;
  const size = o.size || 64, track = o.track ?? 0.12, font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${o.font || SERIF}`;
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const chars = [...text];
  const widths = chars.map(c => m.measureText(c).width);
  const tw = widths.reduce((a, w) => a + w, 0) + track * size * (chars.length - 1);
  const pad = Math.ceil(size * 0.6);
  const cw = Math.ceil(tw + pad * 2), ch = Math.ceil(size * 1.6 + pad * 2);
  const crisp = document.createElement('canvas'); crisp.width = cw; crisp.height = ch;
  const g = crisp.getContext('2d');
  g.font = font; g.textBaseline = 'middle'; g.fillStyle = o.color || INK;
  let x = pad;
  chars.forEach((c, i) => { g.fillText(c, x, ch / 2); x += widths[i] + track * size; });
  // the bleed: a soft copy
  const soft = document.createElement('canvas'); soft.width = cw; soft.height = ch;
  const sg = soft.getContext('2d'); sg.filter = `blur(${Math.max(2, size * 0.09)}px)`; sg.drawImage(crisp, 0, 0); sg.drawImage(crisp, 0, 0);
  // fields at quarter res
  const q = 4, qw = Math.ceil(cw / q), qh = Math.ceil(ch / q);
  const fc = document.createElement('canvas'); fc.width = qw; fc.height = qh;
  const fg = fc.getContext('2d'); fg.filter = `blur(${Math.max(1.5, size * 0.05)}px)`; fg.drawImage(crisp, 0, 0, qw, qh);
  const id = fg.getImageData(0, 0, qw, qh).data;
  const field = new Float32Array(qw * qh), field2 = new Float32Array(qw * qh);
  const seed = text.length * 7 + size;
  let mx = 0.001;
  for (let i = 0; i < qw * qh; i++) mx = Math.max(mx, id[i * 4 + 3]);
  for (let yy = 0; yy < qh; yy++) for (let xx = 0; xx < qw; xx++) {
    const i = yy * qw + xx, a = id[i * 4 + 3] / mx;
    const n = fbm(xx * 0.09, yy * 0.09, seed, 4), n2 = fbm(xx * 0.05 + 9, yy * 0.11, seed + 5, 3);
    // reveal order: near the letters first, through noise; a slow left-to-right drift
    field[i] = a * 0.62 + n * 0.38 + (1 - xx / qw) * 0.12;
    field2[i] = n2 * 0.7 + (xx / qw) * 0.3;
  }
  const mask = document.createElement('canvas'); mask.width = qw; mask.height = qh;
  const comp = document.createElement('canvas'); comp.width = cw; comp.height = ch;
  b = { crisp, soft, field, field2, mask, mctx: mask.getContext('2d'), mdata: null, comp, cctx: comp.getContext('2d'), cw, ch, qw, qh, tw, pad };
  b.mdata = b.mctx.createImageData(qw, qh);
  cache.set(key, b);
  return b;
}

// o: size, font, track, color, k (0..1 reveal), out (0..1 dissolve), align ('center'|'left'|'right'), alpha,
//    glow (css colour: a soft halo behind, for pale letters at night), drift (px of slow rise over the block's life)
export function title(text, x, y, o = {}) {
  const k = clamp(o.k ?? 1), out = clamp(o.out ?? 0);
  if (k <= 0 || out >= 1) return;
  const b = block(text, o);
  const d = b.mdata.data, n = b.qw * b.qh;
  const th = 1.12 - k * 1.25, th2 = out * 1.15 - 0.08;
  for (let i = 0; i < n; i++) {
    let a = smooth(th - 0.07, th + 0.07, b.field[i]);
    if (out > 0) a *= smooth(th2 - 0.06, th2 + 0.06, b.field2[i]);
    d[i * 4 + 3] = a * 255;
  }
  b.mctx.putImageData(b.mdata, 0, 0);
  const c = b.cctx;
  c.globalCompositeOperation = 'copy'; c.globalAlpha = 1; c.drawImage(b.crisp, 0, 0);
  // the bleed: while it's coming in (and going), a little ink spreads past the letters
  const bleed = (1 - k) * (k > 0 ? 1 : 0) + out * 0.8;
  if (bleed > 0.01) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.min(0.85, bleed * 1.4); c.drawImage(b.soft, 0, 0); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'destination-in';
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(b.mask, 0, 0, b.cw, b.ch);
  c.globalCompositeOperation = 'source-over';
  const align = o.align || 'center';
  const left = align === 'center' ? x - b.tw / 2 - b.pad : align === 'right' ? x - b.tw - b.pad : x - b.pad;
  const yy = y - b.ch / 2 - (o.drift || 0);
  ctx.save();
  // a soft scrim behind the letters (snow behind ink, or night behind pale type), so they never fight the art
  if (o.scrim) {
    const sa = (o.scrimA ?? 0.72) * Math.min(1, k * 1.6) * (1 - out), size = o.size || 64;
    const cx = left + b.pad + b.tw / 2, cy = y - (o.drift || 0), rw = b.tw * 0.62 + size * 2.2, rh = size * 1.25;
    const rgb = o.scrim === 'night' ? '4,7,18' : '244,244,241';
    ctx.save(); ctx.globalAlpha = sa; ctx.translate(cx, cy); ctx.scale(1, rh / rw);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    gr.addColorStop(0, `rgba(${rgb},0.95)`); gr.addColorStop(0.55, `rgba(${rgb},0.62)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gr; ctx.fillRect(-rw, -rw, rw * 2, rw * 2); ctx.restore();
  }
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) { ctx.filter = `blur(${(o.size || 64) * 0.35}px)`; ctx.globalAlpha = (o.alpha ?? 1) * 0.55; ctx.drawImage(b.comp, left, yy); ctx.filter = 'none'; ctx.globalAlpha = o.alpha ?? 1; }
  ctx.drawImage(b.comp, left, yy);
  ctx.restore();
}

// Typed monospace caption. o: size, color, k (0..1 typed), out, track, align, cursor (bool)
export function mono(text, x, y, o = {}) {
  const k = clamp(o.k ?? 1), out = clamp(o.out ?? 0);
  if (k <= 0 || out >= 1) return;
  const size = o.size || 18, track = o.track ?? 0.32;
  ctx.save();
  ctx.font = `${o.weight || 400} ${size}px ${MONO}`;
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const n = Math.round(chars.length * k);
  const cw = ctx.measureText('M').width + track * size;
  const tw = cw * chars.length - track * size;
  const align = o.align || 'left';
  let x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  ctx.globalAlpha = (o.alpha ?? 1) * (1 - out);
  ctx.fillStyle = o.color || INK;
  for (let i = 0; i < n; i++) {
    // a dissolve out scrambles characters away in a random order
    if (out > 0 && hash(i, 3, chars.length) < out) continue;
    ctx.fillText(chars[i], x0 + i * cw, y);
  }
  if ((o.cursor ?? true) && k < 1 && out <= 0) ctx.fillRect(x0 + n * cw, y - size * 0.45, size * 0.55, size * 0.9);
  ctx.restore();
  return tw;
}

// A hand-inked line drawing itself on. pts: [[x, y], ...] screen px. o: width, color, k, jitter, taper
export function stroke(pts, k, o = {}) {
  if (k <= 0 || pts.length < 2) return;
  const segs = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
  const want = L * clamp(k);
  const w = o.width || 2.4, seed = o.seed || 3, jit = o.jitter ?? 0.6;
  ctx.save();
  ctx.strokeStyle = o.color || INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = o.alpha ?? 1;
  let acc = 0;
  // pressure: swells from the pen's touch-down, thins to a hairline at the tip
  for (let i = 1; i < pts.length && acc < want; i++) {
    const d = segs[i - 1], take = Math.min(1, (want - acc) / d);
    const [x0, y0] = pts[i - 1], x1 = x0 + (pts[i][0] - x0) * take, y1 = y0 + (pts[i][1] - y0) * take;
    const u = acc / L, press = 0.55 + 0.45 * Math.sin(Math.PI * clamp(u * 1.4)) * (0.8 + 0.4 * fbm(u * 9, 1, seed, 2));
    const tip = smooth(0, Math.min(40, want), want - acc);   // the last bit before the tip runs thin
    ctx.lineWidth = Math.max(0.6, w * press * (o.taper === false ? 1 : 0.35 + 0.65 * tip));
    const jx = (fbm(acc * 0.05, 0, seed, 2) - 0.5) * jit, jy = (fbm(0, acc * 0.05, seed, 2) - 0.5) * jit;
    ctx.beginPath(); ctx.moveTo(x0 + jx, y0 + jy); ctx.lineTo(x1 + jx, y1 + jy); ctx.stroke();
    acc += d * take;
  }
  ctx.restore();
}

// A radio trace across [x0, x1] at y: low noise, with blips at the times in o.blips (trailer seconds),
// each a short burst that decays. o.now: the time; o.amp; o.color; o.k (draw-on 0..1)
export function wave(x0, x1, y, o = {}) {
  const now = o.now ?? t, amp = o.amp ?? 26, k = clamp(o.k ?? 1);
  const span = o.span ?? 2.4;          // seconds shown across the trace (time scrolls right to left)
  const n = Math.max(2, Math.floor((x1 - x0) / 2));
  ctx.save();
  ctx.strokeStyle = o.color || INK; ctx.lineWidth = o.width || 1.6; ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const xe = x0 + (x1 - x0) * k;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    if (x > xe) break;
    const tt = now - span * (1 - i / n);
    let v = (fbm(tt * 40, 0.5, 9, 2) - 0.5) * 0.18;    // hiss
    for (const b of o.blips || []) {
      const dt = tt - b.t;
      if (dt >= 0 && dt < (b.d || 0.06) + 0.25) {
        const on = dt < (b.d || 0.06) ? 1 : Math.exp(-(dt - (b.d || 0.06)) * 30);
        v += Math.sin(dt * 2 * Math.PI * 38) * on * (b.a || 1);
      }
    }
    const fade = smooth(0, 0.08, i / n) * smooth(1, 0.92, i / n);
    const yy = y - v * amp * fade;
    i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
  }
  ctx.stroke();
  ctx.restore();
}

// The SOS, keyed: · · · — — — · · ·  Each element lights as its time comes (o.start, o.unit seconds per
// dot). o.color (lit), o.dim (unlit), o.size (dot diameter)
export const SOS = [1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1];
export function morseTimes(start, unit = 0.12) {
  const out = []; let at = start;
  for (const k of SOS) { if (k) { out.push({ t: at, d: unit * k }); at += unit * (k + 1); } else at += unit * 2; }
  return out;
}
export function morse(x, y, o = {}) {
  const size = o.size || 10, gap = size * 0.9, now = o.now ?? T, unit = o.unit || 0.12;
  const times = morseTimes(o.start ?? 0, unit);
  let w = 0;
  for (const k of SOS) w += k ? (k === 1 ? size : size * 3.2) + gap : gap * 1.6;
  w -= gap;
  let xx = (o.align || 'center') === 'center' ? x - w / 2 : x;
  let j = 0;
  ctx.save();
  for (const k of SOS) {
    if (!k) { xx += gap * 1.6; continue; }
    const el = times[j++], age = now - el.t;
    const lit = age >= 0 ? (age < el.d ? 1 : Math.exp(-(age - el.d) * (o.decay ?? 1.2))) : 0;
    const len = k === 1 ? size : size * 3.2;
    ctx.globalAlpha = (o.alpha ?? 1) * Math.max(o.base ?? 0, lit);
    ctx.fillStyle = o.color || YELLOW;
    if (o.glow && lit > 0.05) { ctx.shadowColor = o.color || YELLOW; ctx.shadowBlur = size * 1.6 * lit; } else ctx.shadowBlur = 0;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(xx, y - size / 2, len, size, size / 2); else ctx.rect(xx, y - size / 2, len, size);
    ctx.fill();
    xx += len + gap;
  }
  ctx.restore();
  return w;
}

// Expanding rings from a screen point (radio waves off the beacon). o.period, o.max, o.color, o.width
export function rings(x, y, o = {}) {
  const now = o.now ?? T, per = o.period || 1.2, max = o.max || 180, n = o.n || 3;
  ctx.save();
  ctx.strokeStyle = o.color || YELLOW;
  for (let i = 0; i < n; i++) {
    const ph = ((now / per + i / n) % 1 + 1) % 1;
    ctx.globalAlpha = (o.alpha ?? 1) * (1 - ph) * smooth(0, 0.08, ph);
    ctx.lineWidth = (o.width || 1.5) * (1 - ph * 0.6);
    ctx.beginPath(); ctx.ellipse(x, y, max * ph, max * ph * (o.squash ?? 0.72), 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// The letterbox: bars of h px top and bottom (o.color)
export function bars(h, o = {}) {
  if (h <= 0) return;
  ctx.save(); ctx.fillStyle = o.color || '#050505';
  ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
  ctx.restore();
}

// Fill the frame (fades, holds). a: 0..1
export function fill(color, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(a); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// An ink wash closing in from the edges, ragged (noise), k 0..1 (1 = black). Drawn from a small mask.
let inkC = null, inkG = null, inkD = null, inkField = null;
const IW = 240, IH = 135;
export function inkEdge(k, o = {}) {
  if (k <= 0.001) return;
  if (!inkC) {
    inkC = document.createElement('canvas'); inkC.width = IW; inkC.height = IH; inkG = inkC.getContext('2d'); inkD = inkG.createImageData(IW, IH);
    inkField = new Float32Array(IW * IH);
    for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
      const dx = (x / IW - 0.5) * 2, dy = (y / IH - 0.5) * 2;
      const r = Math.pow(Math.pow(Math.abs(dx), 3) + Math.pow(Math.abs(dy), 3), 1 / 3);   // squircle: hugs the frame
      inkField[y * IW + x] = r * 0.72 + fbm(x * 0.06, y * 0.06, 77, 5) * 0.4;
    }
  }
  const cx = o.cx ?? 0.5, cy = o.cy ?? 0.5;
  const th = 1.15 - k * 1.25, d = inkD.data, col = o.rgb || [8, 8, 10];
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    const i = y * IW + x;
    let f = inkField[i];
    if (cx !== 0.5 || cy !== 0.5) { const dx = x / IW - cx, dy = (y / IH - cy) * 0.56; f = Math.hypot(dx, dy) * 1.25 + fbm(x * 0.06, y * 0.06, 77, 5) * 0.4; }
    const a = smooth(th - 0.05, th + 0.05, f);
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = a * 255;
  }
  inkG.putImageData(inkD, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.drawImage(inkC, 0, 0, W, H);
  ctx.restore();
}

// Darkness with a hole of light (the flare lighting the night): r px, soft. a: darkness 0..1
export function darkHole(x, y, r, a, o = {}) {
  if (a <= 0) return;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, Math.max(r, 1));
  const c = o.rgb || '4,6,14';
  g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.55, `rgba(${c},${a * 0.35})`); g.addColorStop(1, `rgba(${c},${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// A soft warm bloom (light leak from the tent glow only)
export function bloom(x, y, r, a, color = '255,190,100') {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${a})`); g.addColorStop(0.4, `rgba(${color},${a * 0.35})`); g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// A thin ink rule (hairline) drawn on from the centre outward
export function rule(x, y, w, k, o = {}) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = o.color || INK; ctx.globalAlpha = o.alpha ?? 1; ctx.lineWidth = o.width || 1;
  const h = w / 2 * easeOut(k);
  ctx.beginPath(); ctx.moveTo(x - h, y); ctx.lineTo(x + h, y); ctx.stroke();
  ctx.restore();
}
