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
// Then crisp full-res extras: a faint starburst at the sun, and tiny soft glints on ice and
// on the open sea (a glitter path toward the sun), shimmering as the camera moves.
// Eyes: when bright comes on, the eyes lag behind it, so it starts blinding and settles
// over ~4 s. state.quality 'low': no bright-pass bloom, no ghosts, fewer glints.
import { state } from '../state.js';
import { worldToScreen, screenToWorld } from '../camera.js';
import { classAt, lumAt } from '../world/terrain.js';
import { TENT } from '../actors/camp.js';   // keep the tent's yellow clear of glare

// Glare builds and fades as a slow linear ramp shaped by a smoothstep, so it creeps in
// as the sun comes out rather than cutting: ~30 s when the forecast drives it, ~6 s
// when it's switched by hand from the gear menu.
const RAMP_AUTO_S = 30, RAMP_MANUAL_S = 6;
const EYES_S = 4;            // eye adaptation time
let ramp = state.lighting.bright || 0;   // linear 0..1 progress toward brightTarget
const ICE = 2, THIN = 3, WATER_LUM = 176;
const WARM = [255, 250, 236];

let eyes = 0;                // what the eyes are adapted to (lags bright)
let glare = null, gCtx = null;
let optics = null, oCtx = null;   // soft colour optics, composited source-over
let sprites = null;

export function update(dt) {
  const L = state.lighting;
  const target = L.brightTarget ?? 0;
  const rate = dt / (L.brightForced == null ? RAMP_AUTO_S : RAMP_MANUAL_S);
  ramp = target > ramp ? Math.min(target, ramp + rate) : Math.max(target, ramp - rate);
  L.bright = ramp * ramp * (3 - 2 * ramp);
  eyes += (strength() - eyes) * Math.min(1, dt * 1.6 / EYES_S);
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
  s.softW = radial(64, [[0, 'rgba(255,255,250,1)'], [1, 'rgba(255,255,250,0)']]);
  s.cool = radial(64, [[0, 'rgba(150,178,205,1)'], [0.5, 'rgba(150,178,205,0.6)'], [1, 'rgba(150,178,205,0)']]);
  // a sun dog, drawn for the right-hand side (sun to the left): red edge facing the sun,
  // then yellow, a white core, and a blue tail fading away
  s.dogs = (() => {
    const c = canvas(128, 96), g = c.getContext('2d');
    g.filter = 'blur(6px)';
    const bands = [[30, 'rgba(215,95,70,0.9)', 9], [40, 'rgba(250,205,120,0.9)', 10], [52, 'rgba(255,252,240,1)', 12], [70, 'rgba(140,170,240,0.7)', 14], [92, 'rgba(160,185,240,0.35)', 16]];
    for (const [x, col, rw] of bands) { g.fillStyle = col; g.beginPath(); g.ellipse(x, 48, rw, 30, 0, 0, Math.PI * 2); g.fill(); }
    return c;
  })();
  // lens ghosts: soft hexagons with a faint darker rim, one warm, one cool
  const ghost = (fill, rim) => {
    const c = canvas(64, 64), g = c.getContext('2d');
    g.translate(32, 32);
    const hex = r => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    g.filter = 'blur(1.5px)';
    hex(26); g.fillStyle = fill; g.fill();
    hex(25.5); g.lineWidth = 2.5; g.strokeStyle = rim; g.stroke();
    return c;
  };
  s.ghostW = ghost('rgba(255,210,150,0.35)', 'rgba(150,110,70,0.45)');
  s.ghostC = ghost('rgba(160,200,255,0.3)', 'rgba(80,110,150,0.45)');
  // a glint: a tiny soft bright dot (no star points)
  s.glint = radial(16, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  // the brightest few get a very short faint two-ray streak along the sun direction
  s.ray = (() => {
    const c = canvas(32, 4), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 32, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 1, 32, 2);
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
  if (!optics) { optics = canvas(gw, gh); oCtx = optics.getContext('2d'); }
  if (optics.width !== gw || optics.height !== gh) { optics.width = gw; optics.height = gh; }
}

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

export function drawScreen(ctx) {
  const base = strength();
  if (base < 0.005) return;
  const low = state.quality.level === 'low';
  ensure(low);
  // Eyes not yet adapted -> brighter than it really is, settling over a few seconds.
  // Measured in absolute terms, so a slow build-up (eyes keep pace) never flashes;
  // only a fast change, like stepping out of a whiteout into sun, overshoots.
  const lag = Math.max(0, base - eyes);
  const A = Math.min(1.6, base + 1.4 * lag);
  const { w, h, dpr } = state.view;
  const t = state.time, cam = state.cam, zoom = cam.zoom || 1;
  const gw = glare.width, gh = glare.height, k = gw / w;
  const md = Math.min(w, h);

  // The sun: just off the left edge, high, wobbling a touch with camera travel, so the
  // halo arc and the right-hand sun dog land inside the screen over the terrain.
  const sun = { x: -w * 0.04 + Math.sin(cam.x * 0.004) * md * 0.02, y: h * 0.2 + Math.cos(cam.y * 0.004) * md * 0.02 };
  const R = md * 0.6;           // 22 degree halo radius on screen

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
    // strongest toward the sun: that side of the screen loses its detail first (capped,
    // so terrain classes stay legible)
    const col = f => `rgb(${WARM.map(c => Math.round(c * Math.min(0.3, f * A))).join(',')})`;
    const sg = g.createRadialGradient(sun.x * k, sun.y * k, 0, sun.x * k, sun.y * k, Math.hypot(gw, gh));
    sg.addColorStop(0, col(0.11));
    sg.addColorStop(0.45, col(0.05));
    sg.addColorStop(1, col(0.02));
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
  // plus, while the eyes adjust, a white-out veil over everything (rock included)
  g.fillStyle = `rgba(255,248,232,${Math.min(0.06, 0.02 * A) + 0.45 * lag * base})`;
  g.fillRect(0, 0, w, h);

  // sun glow pouring in from the side
  const big = Math.max(w, h);
  let gr = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, big * 0.8);
  gr.addColorStop(0, `rgba(255,252,240,${Math.min(1, 0.6 * A)})`);
  gr.addColorStop(0.1, `rgba(255,250,236,${0.25 * A})`);
  gr.addColorStop(0.35, `rgba(255,248,230,${0.05 * A})`);
  gr.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  // pillar hint: a soft vertical band through the sun
  gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,250,238,0)');
  gr.addColorStop(Math.max(0.01, Math.min(0.99, sun.y / h)), `rgba(255,250,238,${0.22 * A})`);
  gr.addColorStop(1, 'rgba(255,250,238,0)');
  g.fillStyle = gr;
  g.fillRect(sun.x - w * 0.07, 0, w * 0.14, h);

  // --- optics: drawn source-over in soft colour (an additive optic vanishes on white) ---
  const o = oCtx;
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'source-over';
  o.globalAlpha = 1;
  o.clearRect(0, 0, gw, gh);
  o.setTransform(k, 0, 0, k, 0, 0);
  const oa = Math.min(1, base * (1 + 0.6 * lag));
  // the halo: darker sky inside the ring, a red inner edge, a pale ring, a blue outer haze
  gr = o.createRadialGradient(sun.x, sun.y, R * 0.45, sun.x, sun.y, R * 1.14);
  gr.addColorStop(0, 'rgba(120,130,150,0)');
  gr.addColorStop(0.6, `rgba(120,130,150,${0.07 * oa})`);
  gr.addColorStop(0.8, `rgba(115,125,148,${0.15 * oa})`);
  gr.addColorStop(0.84, `rgba(205,120,90,${0.24 * oa})`);
  gr.addColorStop(0.865, `rgba(250,230,180,${0.3 * oa})`);
  gr.addColorStop(0.9, `rgba(255,252,240,${0.2 * oa})`);
  gr.addColorStop(0.95, `rgba(135,165,225,${0.12 * oa})`);
  gr.addColorStop(1, 'rgba(140,170,225,0)');
  o.fillStyle = gr;
  o.fillRect(0, 0, w, h);
  // sun dogs on the ring at the sun's height: red toward the sun, yellow, white, a blue
  // tail away from it, and a faint white parhelic streak
  for (const side of [1, -1]) {
    const dx = sun.x + side * R * 1.05, dy = sun.y;   // on the ring's bright band
    if (dx < -R * 0.2 || dx > w + R * 0.2) continue;
    const sd = R * 0.085;
    o.globalAlpha = 0.85 * oa;
    o.save();
    o.translate(dx, dy); o.scale(side, 1);
    o.drawImage(sprites.dogs, -sd * 1.2, -sd * 1.6, sd * 4.2, sd * 3.2);
    o.globalAlpha = 0.25 * oa;
    o.drawImage(sprites.softW, sd * 0.8, -sd * 0.12, R * 0.7, sd * 0.24);
    o.restore();
  }
  o.globalAlpha = 1;
  // lens ghosts along the line from the sun through the screen centre, warm and cool
  if (!low) {
    const cx = w / 2, cy = h / 2;
    const ghosts = [[0.6, 0.045, 0.4, 0], [1.3, 0.085, 0.26, 1], [1.6, 0.03, 0.5, 0], [1.95, 0.13, 0.2, 1], [2.35, 0.055, 0.35, 0]];
    for (const [f, size, a, cool] of ghosts) {
      const x = sun.x + (cx - sun.x) * f, y = sun.y + (cy - sun.y) * f, sz = md * size;
      o.globalAlpha = Math.min(1, a * oa);
      o.drawImage(cool ? sprites.ghostC : sprites.ghostW, x - sz, y - sz, 2 * sz, 2 * sz);
    }
    o.globalAlpha = 1;
  }

  // ice glare: soft streaks on ice cells, along the sun direction, shimmering with the
  // camera (a specular highlight moves when you do)
  const sunAng = Math.atan2(h / 2 - sun.y, w / 2 - sun.x);
  const STEP = Math.max(26, Math.min(w, h) / 28);   // CSS px between samples
  const glints = [];
  const ex = state.player && state.started ? worldToScreen(state.player.x, state.player.y) : null;
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
        const perp = Math.abs(ox * uy - oy * ux) / (md * 0.09);
        const path = Math.exp(-perp * perp);
        // only on the sun's side of the screen centre (the path runs to the sun)
        if (ox * ux + oy * uy > md * 0.25) continue;
        g.globalAlpha = 0.16 * path * A;
        g.drawImage(sprites.soft, s.x - STEP, s.y - STEP, STEP * 2, STEP * 2);
        if (path < 0.3) continue;
        // many twinkling sparkles per cell along the path
        for (let q = 0; q < 3; q++) {
          const hq = hash(hv * 13.1 + q, q * 7.7);
          const tw = Math.sin(hq * 90 + t * (4 + hq * 5) + px * 0.8 + q);
          const th = 1 - 0.3 * path;
          if (tw > th) glints.push(s.x + (hq - 0.5) * STEP, s.y + (hash(hq, 3) - 0.5) * STEP, (tw - th) / (1 - th) * path, 0.35 + hq * 0.5);
        }
      } else {
        // a sheen that slides across the ice as you move (smooth in world space, offset
        // by the camera), plus an occasional long streak along the sun direction
        const sheen = 0.5 + 0.25 * Math.sin(wx * 0.021 + wy * 0.013 + px * 0.6 + t * 0.15)
          + 0.25 * Math.sin(wx * 0.009 - wy * 0.017 - py * 0.5);
        g.globalAlpha = (0.03 + 0.25 * sheen * sheen * sheen) * A;
        g.drawImage(sprites.soft, s.x - STEP * 1.2, s.y - STEP * 1.2, STEP * 2.4, STEP * 2.4);
        // ice keeps a cool mid-tone so it never reads as just more snow
        o.globalAlpha = 0.13 * oa;
        o.drawImage(sprites.cool, s.x - STEP * 1.6, s.y - STEP * 1.6, STEP * 3.2, STEP * 3.2);
        if (hv > 0.9) {
          const len = STEP * (1.5 + hash(hv, 5) * 3);
          g.globalAlpha = (0.15 + 0.5 * sheen) * A;
          g.translate(s.x + (hash(hv, 9) - 0.5) * STEP, s.y + (hash(hv, 4) - 0.5) * STEP);
          g.rotate(sunAng + (hash(hv, 2) - 0.5) * 0.3);
          g.drawImage(sprites.streak, -len, -STEP * 0.25, len * 2, STEP * 0.5);
          g.setTransform(k, 0, 0, k, 0, 0);
        }
        // ice facing the sun (nearer it on screen) and ice near the explorer sparkle;
        // elsewhere almost nothing, and each glint flickers with camera travel
        const ds = Math.hypot(s.x - sun.x, s.y - sun.y) / big;
        const de = ex ? Math.hypot(s.x - ex.x, s.y - ex.y) / (md * 0.18) : 9;
        const want = Math.max(Math.max(0, 1 - ds * 1.4), Math.exp(-de * de)) * (0.4 + 0.6 * sheen);
        const tw = Math.sin(hv * 200 + px * 2.3 - py * 1.9 + t * 0.8);
        const th = 1 - 0.12 * want;
        if (want > 0.15 && tw > th) glints.push(s.x + (hv - 0.5) * STEP, s.y + (hash(hv, 7) - 0.5) * STEP, (tw - th) / (1 - th) * want, 0.6 + hv * 0.5);
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
    o.globalCompositeOperation = 'destination-out';
    o.globalAlpha = 0.9;
    o.drawImage(sprites.soft, s.x - rr, s.y - rr, rr * 2, rr * 2);
  }
  g.globalAlpha = 1;
  o.globalAlpha = 1;

  // --- the full-screen pass ---
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glare, 0, 0, cw, ch);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(optics, 0, 0, cw, ch);
  ctx.globalCompositeOperation = 'lighter';

  // --- crisp extras at full res ---
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // starburst at the sun, slowly turning with camera travel
  const ss = Math.min(w, h) * 0.32;
  ctx.globalAlpha = Math.min(1, 0.35 * A);
  ctx.translate(sun.x, sun.y); ctx.rotate((cam.x + cam.y) * 0.0015);
  ctx.drawImage(sprites.star, -ss, -ss, ss * 2, ss * 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // glints
  const maxG = low ? 30 : 110, gz = Math.max(1.6, zoom * 0.7);
  for (let i = 0, n = 0; i < glints.length && n < maxG; i += 4, n++) {
    const s = gz * glints[i + 3], a = Math.min(1, glints[i + 2] * A);
    ctx.globalAlpha = a;
    ctx.drawImage(sprites.glint, glints[i] - s, glints[i + 1] - s, s * 2, s * 2);
    if (a > 0.75) {
      ctx.globalAlpha = (a - 0.75) * 1.2;
      ctx.translate(glints[i], glints[i + 1]); ctx.rotate(sunAng);
      ctx.drawImage(sprites.ray, -s * 4, -s * 0.25, s * 8, s * 0.5);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
}
