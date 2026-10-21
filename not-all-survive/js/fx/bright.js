// Bright day: a blinding clear day on the ice. Screen space, after weather and night.
// Strength = lighting.bright x day x clear sky (whiteout / heavy snow kill it) x eyes.
//
// The look, in one full-screen 'lighter' pass of a small soft buffer (GLARE, 1/3 res):
//   - a bright-pass of the frame (b^3, b = blurred frame value) in warm white: snow and
//     ice blow out to white and their stipple and texture wash away (the lift comes from
//     the blurred neighbourhood, so fine dark detail is lifted along with the white
//     around it), while rock and shadow, being dark, barely move. Low-res, so it also
//     bleeds softly past bright edges: the bloom.
//   - a soft glow pouring in from the sun, just off the top-left, plus a faint 22 degree
//     halo arc, two sun dogs on it, a sun-pillar hint, lens ghosts along the line from
//     the sun through the screen centre, and soft specular glare on ice.
//   - the explorer and the tent are cut out of the glare so the SIGNAL yellow still pops.
// Then crisp full-res extras: a faint starburst at the sun, and sparkle glints on ice and
// on the open sea (a glitter path toward the sun), shimmering as the camera moves.
// Eyes: when bright comes on, the eyes lag behind it, so it starts blinding and settles
// over ~4 s. state.quality 'low': no bright-pass bloom, no ghosts, fewer glints.
import { state } from '../state.js';
import { worldToScreen, screenToWorld } from '../camera.js';
import { classAt, lumAt } from '../world/terrain.js';

const EASE_S = 1.2;          // bright eases toward brightTarget
const EYES_S = 4;            // eye adaptation time
const ICE = 2, THIN = 3, WATER_LUM = 176;
const TENT = { x: 1330, y: 1542 };   // camp.js TENT (not exported); keep the tent's yellow clear of glare
const WARM = [255, 250, 236];

let eyes = 0;                // what the eyes are adapted to (lags bright)
let glare = null, gCtx = null;
let sprites = null;

export function update(dt) {
  const L = state.lighting;
  const d = (L.brightTarget ?? 0) - (L.bright ?? 0);
  L.bright = (L.bright ?? 0) + (Math.abs(d) < 0.002 ? d : d * Math.min(1, dt * 3 / EASE_S));
  eyes += (strength() - eyes) * Math.min(1, dt * 2.5 / EYES_S);
}

// Clear-sky bright amount: by day only, and an overcast can't be blinding.
function strength() {
  const L = state.lighting, X = state.weather;
  const sky = Math.max(0, 1 - (X.whiteout || 0) * 3 - Math.max(0, (X.snowfall || 0) - 0.45) * 2);
  return (L.bright || 0) * (1 - (L.night || 0)) * sky;
}

// --- sprites -----------------------------------------------------------------------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function radial(size, stops) {
  const c = canvas(size, size), g = c.getContext('2d'), h = size / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}

function makeSprites() {
  const s = {};
  s.soft = radial(64, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  // a lens ghost: soft hexagon with a brighter rim, faintly tinted
  s.ghost = (() => {
    const c = canvas(64, 64), g = c.getContext('2d');
    g.translate(32, 32);
    const hex = r => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    g.filter = 'blur(2px)';
    hex(26); g.fillStyle = 'rgba(255,250,235,0.35)'; g.fill();
    hex(25); g.lineWidth = 3; g.strokeStyle = 'rgba(255,245,225,0.6)'; g.stroke();
    return c;
  })();
  // a 4-point sparkle glint with a hot centre
  s.glint = (() => {
    const c = canvas(32, 32), g = c.getContext('2d');
    g.translate(16, 16);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 6);
    core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core; g.fillRect(-6, -6, 12, 12);
    for (const [w, h] of [[16, 1.2], [1.2, 16]]) {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 16);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(-w, -h, 2 * w, 2 * h);
    }
    return c;
  })();
  // ice glare: a soft streak elongated along the sun direction (drawn rotated)
  s.streak = (() => {
    const c = canvas(64, 16), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 8, 0, 32, 8, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.setTransform(1, 0, 0, 0.25, 0, 6); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  })();
  // starburst: many thin rays of varying length
  s.star = (() => {
    const S = 512, c = canvas(S, S), g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    g.globalCompositeOperation = 'lighter';
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2 + rnd() * 0.05, len = S / 2 * (0.35 + rnd() * 0.65);
      const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      gr.addColorStop(0, `rgba(255,252,240,${0.35 + rnd() * 0.3})`); gr.addColorStop(1, 'rgba(255,252,240,0)');
      g.strokeStyle = gr; g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
    }
    return c;
  })();
  return s;
}

function ensure(low) {
  if (!sprites) sprites = makeSprites();
  const { w, h } = state.view, div = low ? 5 : 3;
  const gw = Math.max(8, Math.ceil(w / div)), gh = Math.max(8, Math.ceil(h / div));
  if (!glare) { glare = canvas(gw, gh); gCtx = glare.getContext('2d'); }
  if (glare.width !== gw || glare.height !== gh) { glare.width = gw; glare.height = gh; }
}

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

export function drawScreen(ctx) {
  const base = strength();
  if (base < 0.005) return;
  const low = state.quality.level === 'low';
  ensure(low);
  // eyes not yet adapted -> extra glare (up to ~+70% when it first comes on)
  const A = base * (1 + 0.7 * Math.max(0, base - eyes) / Math.max(0.2, base));
  const { w, h, dpr } = state.view;
  const t = state.time, cam = state.cam, zoom = cam.zoom || 1;
  const gw = glare.width, gh = glare.height, k = gw / w;

  // The sun: just off the top edge, left of centre, wobbling a touch with camera travel.
  const sun = { x: w * 0.1 + Math.sin(cam.x * 0.004) * w * 0.02, y: -h * 0.03 + Math.cos(cam.y * 0.004) * h * 0.015 };
  const R = 0.3 * (w + h);     // 22 degree halo radius on screen

  const g = gCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.imageSmoothingEnabled = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = ctx.canvas.width, ch = ctx.canvas.height;

  // --- bright-pass: b^3 in warm white ---
  if (!low) {
    g.globalCompositeOperation = 'copy';
    g.drawImage(ctx.canvas, 0, 0, gw, gh);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(ctx.canvas, 0, 0, gw, gh);
    g.drawImage(ctx.canvas, 0, 0, gw, gh);
    // strongest toward the sun: that side of the screen loses its detail first
    const col = f => `rgb(${WARM.map(c => Math.round(c * Math.min(1, f * A))).join(',')})`;
    const sg = g.createRadialGradient(sun.x * k, sun.y * k, 0, sun.x * k, sun.y * k, Math.hypot(gw, gh));
    sg.addColorStop(0, col(0.17));
    sg.addColorStop(0.45, col(0.065));
    sg.addColorStop(1, col(0.025));
    g.fillStyle = sg;
    g.fillRect(0, 0, gw, gh);
  } else {
    g.globalCompositeOperation = 'copy';
    g.fillStyle = '#000';
    g.fillRect(0, 0, gw, gh);
  }
  g.globalCompositeOperation = 'lighter';
  g.setTransform(k, 0, 0, k, 0, 0);       // draw the rest in CSS px

  // a faint overall lift (shadows readable but lifted), warm white
  g.fillStyle = `rgba(255,248,232,${0.02 * A})`;
  g.fillRect(0, 0, w, h);

  // sun glow pouring in from the corner
  const big = Math.max(w, h);
  let gr = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, big * 0.95);
  gr.addColorStop(0, `rgba(255,252,240,${0.7 * A})`);
  gr.addColorStop(0.12, `rgba(255,250,236,${0.3 * A})`);
  gr.addColorStop(0.4, `rgba(255,248,230,${0.06 * A})`);
  gr.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);

  // the 22 degree halo: a faint ring, reddish on its inner edge
  gr = g.createRadialGradient(sun.x, sun.y, R * 0.9, sun.x, sun.y, R * 1.1);
  gr.addColorStop(0, 'rgba(255,240,230,0)');
  gr.addColorStop(0.42, `rgba(255,205,185,${0.1 * A})`);
  gr.addColorStop(0.5, `rgba(255,250,245,${0.2 * A})`);
  gr.addColorStop(0.62, `rgba(235,245,255,${0.05 * A})`);
  gr.addColorStop(1, 'rgba(230,240,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);

  // sun dogs on the ring at the sun's height: a bright spot with a faint prismatic
  // smear (red toward the sun, blue away), and a soft pillar below the sun
  for (const side of [-1, 1]) {
    const dx = sun.x + side * R, dy = Math.max(sun.y + h * 0.05, R * 0.06);
    if (dx < -R * 0.15 || dx > w + R * 0.15) continue;
    const s = R * 0.13;
    g.globalAlpha = 0.7 * A;
    g.drawImage(sprites.soft, dx - s, dy - s, 2 * s, 2 * s);
    g.globalAlpha = 0.18 * A;
    g.fillStyle = 'rgba(255,120,80,1)';
    g.beginPath(); g.ellipse(dx - side * s * 0.35, dy, s * 0.3, s * 0.9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,170,255,1)';
    g.beginPath(); g.ellipse(dx + side * s * 0.45, dy, s * 0.3, s * 0.9, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  gr = g.createLinearGradient(0, 0, 0, h * 0.75);
  gr.addColorStop(0, `rgba(255,250,238,${0.22 * A})`);
  gr.addColorStop(1, 'rgba(255,250,238,0)');
  g.fillStyle = gr;
  const pw = w * 0.035;
  g.fillRect(sun.x - pw, 0, pw * 2, h * 0.75);

  // lens ghosts along the line from the sun through the screen centre
  if (!low) {
    const cx = w / 2, cy = h / 2, md = Math.min(w, h);
    const ghosts = [[0.55, 0.05, 0.10], [1.25, 0.09, 0.06], [1.55, 0.03, 0.14], [1.9, 0.14, 0.04], [2.3, 0.06, 0.07]];
    for (const [f, size, a] of ghosts) {
      const x = sun.x + (cx - sun.x) * f, y = sun.y + (cy - sun.y) * f, s = md * size;
      g.globalAlpha = a * A;
      g.drawImage(sprites.ghost, x - s, y - s, 2 * s, 2 * s);
    }
    g.globalAlpha = 1;
  }

  // ice glare: soft streaks on ice cells, along the sun direction, shimmering with the
  // camera (a specular highlight moves when you do)
  const sunAng = Math.atan2(h / 2 - sun.y, w / 2 - sun.x);
  const STEP = Math.max(26, Math.min(w, h) / 28);   // CSS px between samples
  const glints = [];
  const tl = screenToWorld(0, 0);
  const ws = STEP / zoom;                     // world px per sample
  const x0 = Math.floor(tl.x / ws) * ws, y0 = Math.floor(tl.y / ws) * ws;
  const nx = Math.ceil(w / STEP) + 2, ny = Math.ceil(h / STEP) + 2;
  const px = cam.x * 0.06, py = cam.y * 0.06;
  // glitter path on the sea: toward the sun, through the screen centre
  const ux = Math.cos(sunAng), uy = Math.sin(sunAng);
  g.save();
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const wx = x0 + i * ws, wy = y0 + j * ws;
      const c = classAt(wx, wy);
      const water = c === THIN && lumAt(wx, wy) < WATER_LUM;
      if (c !== ICE && !water) continue;
      const s = worldToScreen(wx, wy);
      const hv = hash(Math.round(wx / ws), Math.round(wy / ws));
      if (water) {
        // perpendicular distance from the glitter path
        const ox = s.x - w / 2, oy = s.y - h / 2;
        const perp = Math.abs(ox * uy - oy * ux) / (Math.min(w, h) * 0.22);
        const path = Math.exp(-perp * perp);
        g.globalAlpha = 0.07 * path * A;
        g.drawImage(sprites.soft, s.x - STEP, s.y - STEP, STEP * 2, STEP * 2);
        if (path < 0.08) continue;
        // several twinkling sparkles per cell, densest on the path
        for (let q = 0; q < 4; q++) {
          const hq = hash(hv * 13.1 + q, q * 7.7);
          const tw = Math.sin(hq * 90 + t * (4 + hq * 5) + px * 0.8 + q);
          const th = 1 - 0.55 * path;
          if (tw > th) glints.push(s.x + (hq - 0.5) * STEP, s.y + (hash(hq, 3) - 0.5) * STEP, (tw - th) / (1 - th) * path, 0.35 + hq * 0.5);
        }
      } else {
        // a sheen that slides across the ice as you move (smooth in world space, offset
        // by the camera), plus an occasional long streak along the sun direction
        const sheen = 0.5 + 0.25 * Math.sin(wx * 0.021 + wy * 0.013 + px * 0.6 + t * 0.15)
          + 0.25 * Math.sin(wx * 0.009 - wy * 0.017 - py * 0.5);
        g.globalAlpha = (0.05 + 0.3 * sheen * sheen * sheen) * A;
        g.drawImage(sprites.soft, s.x - STEP * 1.2, s.y - STEP * 1.2, STEP * 2.4, STEP * 2.4);
        if (hv > 0.9) {
          const len = STEP * (1.5 + hash(hv, 5) * 3);
          g.globalAlpha = (0.15 + 0.5 * sheen) * A;
          g.translate(s.x + (hash(hv, 9) - 0.5) * STEP, s.y + (hash(hv, 4) - 0.5) * STEP);
          g.rotate(sunAng + (hash(hv, 2) - 0.5) * 0.3);
          g.drawImage(sprites.streak, -len, -STEP * 0.25, len * 2, STEP * 0.5);
          g.setTransform(k, 0, 0, k, 0, 0);
        }
        const tw = Math.sin(hv * 200 + px * 1.7 - py * 1.3 + t * 1.5);
        if (tw > 0.82) glints.push(s.x + (hv - 0.5) * STEP, s.y + (hash(hv, 7) - 0.5) * STEP, (tw - 0.82) * 5.5, 0.7 + hv * 0.6);
      }
    }
  }
  g.restore();

  // keep the yellow clear: cut the glare out around the explorer and the tent
  g.globalCompositeOperation = 'destination-out';
  const keep = [];
  if (state.player && state.started) keep.push([state.player.x, state.player.y - 7, 10]);
  keep.push([TENT.x, TENT.y - 4, 16]);
  for (const [x, y, r] of keep) {
    const s = worldToScreen(x, y), rr = r * zoom;
    if (s.x < -rr || s.y < -rr || s.x > w + rr || s.y > h + rr) continue;
    g.globalAlpha = 0.85;
    g.drawImage(sprites.soft, s.x - rr, s.y - rr, rr * 2, rr * 2);
  }
  g.globalAlpha = 1;

  // --- the full-screen pass ---
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glare, 0, 0, cw, ch);

  // --- crisp extras at full res ---
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // starburst at the sun, slowly turning with camera travel
  const ss = Math.min(w, h) * 0.32;
  ctx.globalAlpha = 0.5 * A;
  ctx.translate(sun.x, sun.y); ctx.rotate((cam.x + cam.y) * 0.0015);
  ctx.drawImage(sprites.star, -ss, -ss, ss * 2, ss * 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // glints
  const maxG = low ? 60 : 220, gz = Math.max(6, zoom * 3);
  for (let i = 0, n = 0; i < glints.length && n < maxG; i += 4, n++) {
    const s = gz * glints[i + 3];
    ctx.globalAlpha = Math.min(1, glints[i + 2] * A);
    ctx.drawImage(sprites.glint, glints[i] - s, glints[i + 1] - s, s * 2, s * 2);
  }
}
