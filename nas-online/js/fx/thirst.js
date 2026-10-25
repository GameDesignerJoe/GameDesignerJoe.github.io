// The thirsty mind (thirst). Hunger hits the body; thirst hits the mind: dehydration brings a
// headache, confusion and misperception, then delirium and hallucination. body.js keeps the water
// clock (body.water, body.thirst); this module shows what a dry mind makes of the world. No bars.
//
// The Fata Morgana (water < 0.25, building as it falls): the arctic superior mirage. The map just
// beyond the top of the view, to the north (never the frame on screen), is read for its darks (rock
// and ink); where they cluster are the features, the heaviest 3-6. Each becomes a flat grey
// silhouette in a thin band along the top (13-18% of the height, never over 20%): a soft mesa or
// tower standing on a soft bright false horizon, stretched up, its mirror hanging upside down above
// it across a thin pale gap, now and then a third shelf (a split), all under pale haze so they read
// far off; between them only haze, no bars and no straight edges. They breathe slowly (the stretch
// growing and shrinking) and drift a little; Reduce motion holds them still. Episodic: 9-20 s
// episodes with 40-90 s gaps, closer as the water falls; near 0 long episodes and short gaps. It needs
// calm, clear, bright air as the real thing does (on a blinding day bright.js's glare, drawn after,
// washes it as it does everything up there). The tents are feathered out of it. Cost: the source
// (320 x 40, from the map image) is redrawn and its features extracted only as the view moves on;
// the band is composed offscreen at 30 Hz from a few sprite draws and laid on in drawSky (after the
// world and its sky layers, before the falling snow, the haze and the night grade).
//
// The Third Man (water < 0.12, oftener near 0): the companion polar explorers reported (Shackleton's
// party among them). A faint grey figure (the explorer's own, pose for pose: explorer.js P.ghost,
// the colour taken out of it: never signal yellow) walking parallel to them at the edge of the view,
// off to one side of the way they're going, keeping pace, sometimes a little ahead; no footprints,
// no breath, no shadow. Rare at first (about once in 80 s of walking at 0.12), about every 12 s near
// 0. He comes in slowly from the edge. Turn toward him, or let him drift in toward the middle of the
// view, and he comes apart into slices and is gone; stop walking and he fades. Never in a tent, never
// while busy with the pack. Now and then, while he's there, a faint second footstep a beat behind
// the explorer's own (audio.js).
//
// Pushes: mirage { stage: 'start'|'end', strength } (an episode), thirdman { stage: 'in'|'out'|'step',
// x, y, dissolved? , terrain? } (he comes, he goes (dissolved: looked at), his footstep).
// Hooks: NAS.thirst = { mirage (0..1 shown now), man (his state), show(on) (he comes at the next chance
// while walking; off: he goes), episode(on) (a mirage episode now, full strength at once) }.
import { state } from '../state.js';
import { worldToScreenUI } from '../camera.js';
import { mapImage } from '../world/map.js';
import { TENT } from '../actors/camp.js';

let T = null;   // terrain (built in parallel; guarded): he keeps to open ground on the explorer's own level
import('../world/terrain.js').then(m => { T = m; }).catch(() => {});

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const approach = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
const KY = 0.8;                      // ground-depth foreshortening (as explorer.js)

const P = state.player;
const B = () => state.body;
const alive = () => B() && B().phase === 'alive';
const out = () => P.mode !== 'inside' && P.mode !== 'tent-in' && P.mode !== 'tent-out' && P.mode !== 'gone';

// --- the mirage -------------------------------------------------------------------------------------
let mir = 0, epi = 0, epiOn = false, epiT = 6;
// How much the mind makes of it, by the water: from 0.25, building as it falls (~0.27 at 0.2, 1 at 0.05).
const wantK = w => Math.pow(clamp((0.25 - w) / 0.2), 0.8);
// The weather a Fata Morgana needs: calm, clear and bright (and daylight).
function airK() {
  const w = state.wind, wx = state.weather, L = state.lighting;
  const calm = 1 - smooth(0.22, 0.75, (w.speed ?? 0.3) + 0.4 * (w.gust || 0));
  const clear = (1 - clamp(wx.whiteout || 0)) * (1 - 0.6 * smooth(0.3, 0.9, wx.snowfall ?? 0.3));
  const sun = lerp(0.6, 1, clamp(L.bright || 0)) * (1 - 0.85 * clamp(L.night || 0)) * clamp(wx.light ?? 1);
  return Math.max(calm * clear * sun, 0.1 * (1 - clamp(wx.whiteout || 0)) * (1 - clamp(L.night || 0)));
}
function updateMirage(dt) {
  const b = B(), w = b ? b.water : 1;
  const want = wantK(w), worst = smooth(0.05, 0.0, w);
  // episodes: on 9-20 s, then a gap of 90 s down to 40 s as the water falls; at the very end long
  // episodes and short gaps (the hallucinations all but constant)
  epiT -= dt;
  if (want <= 0) { epiOn = false; epiT = Math.min(epiT, 8); }
  else if (epiT <= 0) {
    epiOn = !epiOn;
    epiT = epiOn ? lerp(lerp(9, 20, Math.random()), 45, worst) : lerp(lerp(90, 40, smooth(0.25, 0.05, w)), 8, worst) * (0.8 + 0.4 * Math.random());
    state.events.push({ type: 'mirage', stage: epiOn ? 'start' : 'end', strength: want });
  }
  epi = approach(epi, epiOn ? 1 : 0, epiOn ? 0.45 : 0.35, dt);
  const target = alive() && out() ? want * epi * airK() : 0;
  mir = approach(mir, target, target > mir ? 0.6 : 1.2, dt);
}

// The source: the map beyond the top of the view, to the north: SW x SH px covering SRC_SPAN view
// widths across (squeezed: further off) and SRC_D world units north of the top edge. Thresholded to
// its darks (rock and ink), then read as a profile across: where the darks cluster are the features
// (up to MAX_F of them, the heaviest), each becoming one mirage element. Only when the view moves on.
const SW = 320, SH = 40, SRC_SPAN = 1.6, SRC_D = 70, SRC_GAP = 4, MAX_F = 6;
let srcC = null, srcG = null, srcAt = -9, srcX = 0, srcY = 0, srcZ = 0, srcOk = false;
const prof = new Float32Array(SW), profS = new Float32Array(SW);
// the features: u (centre, 0..1 across the source), wu (half-width, 0..1), k (how much dark: 0..1),
// ph (its own phase), mesa (wide: a flat tabletop; narrow: a tower)
const feats = Array.from({ length: MAX_F }, () => ({ u: 0, wu: 0, k: 0, ph: 0, mesa: false, sw: 1, sh: 1 }));
let nFeat = 0;
function updateSource() {
  const img = mapImage();
  if (!img || !img.complete || !img.width) return;
  // (a phone held upright looks as far across as a wide screen would: the horizon is wide)
  const c = state.cam, z = c.zoom || 1, hw = Math.max(state.view.w, state.view.h * 0.8) / 2 / z, top = c.y - state.view.h / 2 / z;
  const moved = Math.abs(c.x - srcX) > 3 || Math.abs(top - srcY) > 3 || Math.abs(z - srcZ) > 0.02;
  if (srcOk && (!moved || state.time - srcAt < 0.15)) return;   // (the map is still: only as the view moves on, at most ~7 Hz)
  srcAt = state.time; srcX = c.x; srcY = top; srcZ = z;
  if (!srcC) { srcC = document.createElement('canvas'); srcC.width = SW; srcC.height = SH; srcG = srcC.getContext('2d', { willReadFrequently: true }); }
  // the world rect: wide across, the strip of map just north of what's on screen (off the map: snow)
  const x0 = c.x - hw * SRC_SPAN, x1 = c.x + hw * SRC_SPAN, y1 = top - SRC_GAP, y0 = y1 - SRC_D;
  srcG.fillStyle = '#f2f2f0'; srcG.fillRect(0, 0, SW, SH);
  const ax = Math.max(0, x0), ay = Math.max(0, y0), bx = Math.min(img.width, x1), by = Math.min(img.height, y1);
  if (bx > ax && by > ay) {
    const kx = SW / (x1 - x0), ky = SH / (y1 - y0);
    srcG.imageSmoothingEnabled = true;
    srcG.drawImage(img, ax, ay, bx - ax, by - ay, (ax - x0) * kx, (ay - y0) * ky, (bx - ax) * kx, (by - ay) * ky);
  }
  // the darks, column by column: how much rock and ink stands in each (0..1)
  const d = srcG.getImageData(0, 0, SW, SH).data;
  prof.fill(0);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const i = (y * SW + x) * 4, L = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (L < 150) prof[x] += (L < 128 ? 1 : (150 - L) / 22) / SH;
  }
  // smoothed, so a field of rock reads as one feature, not a comb
  for (let x = 0; x < SW; x++) { let a = 0, n = 0; for (let j = -6; j <= 6; j++) { const q = x + j; if (q >= 0 && q < SW) { a += prof[q]; n++; } } profS[x] = a / n; }
  // the runs where it clusters: each a feature (very wide ones split in two); the heaviest kept
  nFeat = 0;
  const TH = 0.06, minW = SW * 0.012, maxW = SW * 0.11;
  for (let x = 0; x < SW; x++) {
    if (profS[x] < TH) continue;
    let e = x, sum = 0, peak = 0;
    while (e < SW && profS[e] >= TH) { sum += profS[e]; peak = Math.max(peak, profS[e]); e++; }
    const w = e - x;
    if (w >= minW) {
      const parts = Math.max(1, Math.round(w / maxW));
      for (let p = 0; p < parts; p++) {
        const a = x + w * p / parts, b = x + w * (p + 1) / parts, k = clamp(peak * 2.2) * clamp(sum / parts / (SW * 0.05));
        // keep the heaviest MAX_F
        let slot = nFeat < MAX_F ? nFeat++ : -1;
        if (slot < 0) { let lo = 0; for (let j = 1; j < MAX_F; j++) if (feats[j].k < feats[lo].k) lo = j; if (feats[lo].k < k) slot = lo; }
        if (slot >= 0) {
          // each its own: a little off where the darks were, its own width and height (fixed by where
          // it is on the map, so it holds still as the view creeps)
          const f = feats[slot], hsh = q => { const v = Math.sin((Math.round(x0 + (a + b) / 2 / SW * (x1 - x0)) * 0.37 + q) * 12.9898) * 43758.5453; return v - Math.floor(v); };
          f.wu = (b - a) / 2 / SW; f.u = (a + b) / 2 / SW + (hsh(1) - 0.5) * f.wu * 0.8; f.k = Math.max(0.25, k);
          f.ph = hsh(2) * Math.PI * 2; f.mesa = (b - a) > SW * 0.05 ? hsh(3) < 0.75 : hsh(3) < 0.25;
          f.sw = 0.7 + 0.6 * hsh(4); f.sh = 0.65 + 0.7 * hsh(5);
        }
      }
    }
    x = e;
  }
  srcOk = true;
}

// The silhouettes: two soft sprites made once, a flat-topped mesa and a tapering tower, each a solid
// grey shape (no texture) feathered at its sides and fading out toward its top (base at the bottom,
// opaque, softening at the very foot). Drawn stretched: tall, a mirror above with a pale gap, now and then a third shelf.
const SPR_W = 96, SPR_H = 128, GREY = 'rgb(104,108,116)';
let sprMesa = null, sprTower = null;
function makeSprite(mesa) {
  const c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H;
  const g = c.getContext('2d'), N = 9;
  g.fillStyle = GREY;
  for (let i = 0; i < N; i++) {
    // nested, each a little smaller, laid at 1/N: the middle solid, the sides soft
    const ins = (N - 1 - i) * 2.6, L = 6 + ins, R = SPR_W - 6 - ins, T = 10 + ins * 0.8, Bm = SPR_H;
    g.globalAlpha = 1 / N * 1.6;
    g.beginPath();
    if (mesa) {
      // a tabletop: sides leaning in a little, the corners rounded, the top flat
      const tl = L + (R - L) * 0.16, tr = R - (R - L) * 0.16, r = Math.min(16, (tr - tl) * 0.3);
      g.moveTo(L, Bm); g.lineTo(tl, T + r); g.quadraticCurveTo(tl, T, tl + r, T); g.lineTo(tr - r, T); g.quadraticCurveTo(tr, T, tr, T + r); g.lineTo(R, Bm);
    } else {
      // a tower: tapering up to a rounded head
      const cx = SPR_W / 2, hw0 = (R - L) / 2, hw1 = hw0 * 0.45;
      g.moveTo(cx - hw0, Bm); g.quadraticCurveTo(cx - hw0 * 0.8, T + SPR_H * 0.3, cx - hw1, T + hw1); g.quadraticCurveTo(cx, T - hw1 * 0.3, cx + hw1, T + hw1);
      g.quadraticCurveTo(cx + hw0 * 0.8, T + SPR_H * 0.3, cx + hw0, Bm);
    }
    g.closePath(); g.fill();
  }
  // fading out toward the top
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, SPR_H);
  fade.addColorStop(0, 'rgba(0,0,0,0.15)'); fade.addColorStop(0.45, 'rgba(0,0,0,0.85)'); fade.addColorStop(0.88, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0.3)');   // (and softly at the base: a mirror's flat edge never cuts)
  g.fillStyle = fade; g.fillRect(0, 0, SPR_W, SPR_H);
  return c;
}

// The band, composed offscreen; the false horizon at HZ of its height.
const HZ = 0.82;
let bandC = null, bandG = null, bandTick = 0, hazeHb = -1, hazeW = -1, hazeA = null, hazeB = null, gleam = null;
const holes = [0, 0, 0, 0, 0, 0];   // up to two tents: x, y, r (device px)
let nHoles = 0;
function composeBand(W, hb, S, dpr) {
  if (!bandC) { bandC = document.createElement('canvas'); bandG = bandC.getContext('2d'); sprMesa = makeSprite(true); sprTower = makeSprite(false); }
  if (bandC.width !== W || bandC.height !== hb) { bandC.width = W; bandC.height = hb; hazeHb = -1; }
  const g = bandG, still = !!state.reduceMotion, t = still ? 0 : state.time, hz = hb * HZ;
  if (hazeHb !== hb || hazeW !== W) {
    // the pale air (under the shapes) and the haze that pushes them back (over them), both thinning
    // to nothing below the horizon; the horizon itself a soft bright line
    hazeHb = hb; hazeW = W;
    hazeA = g.createLinearGradient(0, 0, 0, hb);
    hazeA.addColorStop(0, 'rgba(244,245,247,0.95)'); hazeA.addColorStop(HZ, 'rgba(246,247,248,0.9)'); hazeA.addColorStop(1, 'rgba(244,245,247,0)');
    hazeB = g.createLinearGradient(0, 0, 0, hb);
    hazeB.addColorStop(0, 'rgba(244,245,247,0.35)'); hazeB.addColorStop(HZ, 'rgba(244,245,247,0.08)'); hazeB.addColorStop(1, 'rgba(244,245,247,0)');
    gleam = g.createLinearGradient(0, hz - 4 * dpr, 0, hz + 4 * dpr);
    gleam.addColorStop(0, 'rgba(252,252,252,0)'); gleam.addColorStop(0.5, 'rgba(252,252,252,0.75)'); gleam.addColorStop(1, 'rgba(252,252,252,0)');
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.clearRect(0, 0, W, hb);
  // (a blinding day: bright.js's glare washes everything after this, so the haze thins and the shapes
  // are laid on twice, or they'd be lost in it)
  const glare = clamp(state.lighting.bright || 0) * (1 - clamp(state.lighting.night || 0));
  g.globalAlpha = 1 - 0.45 * glare;
  g.fillStyle = hazeA; g.fillRect(0, 0, W, hb);
  g.imageSmoothingEnabled = true;
  const pad = W * 0.04, span = W + 2 * pad;
  for (let pass = 0; pass < (glare > 0.3 ? 2 : 1); pass++)
  for (let i = 0; i < nFeat; i++) {
    const f = feats[i], ph = f.ph;
    // breathing: the stretch grows and shrinks over several seconds; a slow sideways drift
    const br = still ? 0.85 : 0.85 + 0.25 * Math.sin(t * 0.33 + ph) + 0.1 * Math.sin(t * 0.13 + ph * 2);
    const cx = -pad + f.u * span + (still ? 0 : Math.sin(t * 0.07 + ph) * W * 0.008);
    const w = Math.max(14 * dpr, f.wu * span * 2 * (f.mesa ? 1.0 : 1.2) * f.sw);
    const spr = f.mesa ? sprMesa : sprTower;
    const a = lerp(0.5, 0.78, f.k);   // (under the band's own fade-in and the haze: ~0.35-0.6 as seen)
    // the shape standing on the horizon, stretched up (taller as the mirage takes hold)
    const h1 = Math.min(hb * 0.55, hb * lerp(0.26, 0.42, S) * (0.6 + 0.4 * f.k) * br * f.sh);
    g.globalAlpha = a;
    g.drawImage(spr, cx - w / 2, hz - h1, w, h1 + 1);
    // its mirror, hanging above it upside down across a thin pale gap (the classic stacked shape)
    const gap = hb * 0.035 * (1.2 - 0.4 * br), h2 = h1 * (0.6 + 0.15 * Math.sin(t * 0.21 + ph * 1.7));
    const y2 = hz - h1 - gap;
    if (y2 > hb * 0.05) {
      g.globalAlpha = a * 0.85;
      g.save(); g.translate(0, y2); g.scale(1, -1);
      g.drawImage(spr, cx - w * 0.48, 0, w * 0.96, Math.min(h2, y2));
      g.restore();
    }
    // now and then it splits: a third shelf, upright again, above the mirror (fading in and out)
    const split = still ? 0 : smooth(0.55, 0.9, Math.sin(t * 0.17 + ph * 3.1));
    const y3 = y2 - h2 - gap * 0.8, h3 = h1 * 0.35;
    if (split > 0.01 && y3 - h3 > 0) { g.globalAlpha = a * 0.7 * split; g.drawImage(spr, cx - w * 0.4, y3 - h3, w * 0.8, h3); }
    // and a faint short reflection under the horizon
    g.globalAlpha = a * 0.25;
    g.save(); g.translate(0, hz); g.scale(1, -1); g.drawImage(spr, cx - w / 2, -Math.min(hb - hz, h1 * 0.25), w, Math.min(hb - hz, h1 * 0.25)); g.restore();
  }
  g.globalAlpha = 1;
  g.fillStyle = hazeB; g.fillRect(0, 0, W, hb);
  g.fillStyle = gleam; g.fillRect(0, hz - 4 * dpr, W, 8 * dpr);
  // the tents: feathered out of it (it passes behind them), never a hard hole
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < nHoles; i++) {
    const x = holes[i * 3], y = holes[i * 3 + 1], r = holes[i * 3 + 2];
    const rg = g.createRadialGradient(x, y, r * 0.45, x, y, r);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalCompositeOperation = 'source-over';
}
export function drawSky(ctx) {
  if (mir < 0.015 || !srcOk) return;
  const cv = ctx.canvas, W = cv.width, H = cv.height, dpr = state.view.dpr || 1;
  const S = clamp(mir);
  // a thin band: ~13-18% of the height, never over 20% (a phone held upright)
  const hb = Math.round(Math.min(H * lerp(0.13, 0.18, S), H * 0.2));
  // where the tents are in it (UI space: the same zoom the radius uses)
  nHoles = 0;
  const z = (state.cam.zoom || 1) * dpr, pp = state.pup?.pitched;
  for (let k = 0; k < 2; k++) {
    const q = k ? pp : TENT;
    if (!q) continue;
    const p = worldToScreenUI(q.x, q.y - 6), r = (k ? 18 : 28) * z, x = p.x * dpr, y = p.y * dpr;
    if (y - r < hb && x > -r && x < W + r) { holes[nHoles * 3] = x; holes[nHoles * 3 + 1] = y; holes[nHoles * 3 + 2] = r; nHoles++; }
  }
  if ((bandTick++ & 1) === 0 || !bandC || bandC.width !== W || bandC.height !== hb) composeBand(W, hb, S, dpr);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = Math.min(1, 1.6 * S);
  ctx.drawImage(bandC, 0, 0);
  ctx.restore();
}

// --- the Third Man ------------------------------------------------------------------------------------
// man = { x, y, vis 0..1, slip 0..1 (dissolving), side (+1 / -1 of the way they walk), life, t, seed,
//   going: false | 'fade' | 'slip' } | null
let man = null, manCool = 12, stillT = 0, forced = false;
const steps = [];                    // his footsteps, waiting their beat: { t, x, y, terrain }
// Where on the screen he walks: off to one side of the way they're going, near the edge of the view
// (screen px), a little ahead; only as far out as open ground on their own level runs that way (no
// walking through rock or over the sea), so on a narrow ledge he's closer in (and soon looked at).
// k: how much of the way to the edge there was room for.
const tgA = { sx: 0, sy: 0, k: 0 }, tgC = { sx: 0, sy: 0, k: 0 };
function manTarget(side, o = tgA) {
  const f = P.facing, ux = Math.cos(f), uy = Math.sin(f) * KY, ul = Math.hypot(ux, uy) || 1;
  const tx = ux / ul, ty = uy / ul, nx = -ty * side, ny = tx * side;
  const { w, h } = state.view, p = worldToScreenUI(P.x, P.y - 8);
  // how far to the edge of the view along n (with a margin for the figure)
  const mx = 30, my = 40;
  const ex = nx > 0.01 ? (w - mx - p.x) / nx : nx < -0.01 ? (mx - p.x) / nx : 1e9;
  const ey = ny > 0.01 ? (h - my - p.y) / ny : ny < -0.01 ? (Math.max(my + 60, h * 0.25) - p.y) / ny : 1e9;   // (never up in the mirage's band)
  const want = Math.max(60, Math.min(ex, ey) * 0.92), lead = Math.min(w, h) * 0.06;
  let d = want;
  if (T) {
    const z = zoom(), reg = T.regionAt(P.x, P.y), N = 16;
    for (let i = 1; i <= N; i++) {
      const u = want * i / N, x = P.x + (nx * u + tx * lead * i / N) / z, y = P.y + (ny * u + ty * lead * i / N) / z;
      if (!T.isWalkable(x, y) || T.isWater(x, y) || T.regionAt(x, y) !== reg) { d = want * (i - 1) / N; break; }
    }
  }
  const lk = d / want;
  o.sx = p.x + nx * d + tx * lead * lk; o.sy = p.y + ny * d + ty * lead * lk; o.k = lk;
  return o;
}
const zoom = () => state.cam.zoom || 1;
function canWalk() {
  const ph = state.compass?.phase || 'idle';
  return alive() && P.mode === 'walk' && !(P.water?.level) && (ph === 'idle' || ph === 'out') && !P.spent && !P.resting;
}
function updateMan(dt) {
  const b = B(), w = b ? b.water : 1, k = smooth(0.12, 0.0, w);
  stillT = P.moving ? 0 : stillT + dt;
  manCool -= dt;
  if (!man) {
    // he only comes while they walk, and rarely at first
    const rate = forced ? 100 : k > 0 ? lerp(1 / 80, 1 / 12, k) : 0;
    if (canWalk() && P.moving && P.speed > 3 && (forced || manCool <= 0) && Math.random() < rate * dt) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const a = manTarget(side, tgA), c = manTarget(-side, tgC);
      // the side with more open ground toward the edge, mostly; none worth it: not now
      const sd = a.k >= c.k * 0.8 ? side : -side, tg = sd === side ? a : c;
      if (tg.k < 0.55) { manCool = forced ? 0.5 : 3; return; }
      forced = false;
      const z = zoom(), p = worldToScreenUI(P.x, P.y);
      man = { x: P.x + (tg.sx - p.x) / z, y: P.y + (tg.sy - p.y + 8 * z) / z, vis: 0, slip: 0, side: sd, life: lerp(9, 18, Math.random()), t: 0, seed: Math.random() * 100, going: false };
      state.events.push({ type: 'thirdman', stage: 'in', x: man.x, y: man.y });
    }
    return;
  }
  const m = man;
  m.t += dt;
  // keeps pace: carried along with the explorer, easing back to his place beside them
  m.x += (P.vx || 0) * dt; m.y += (P.vy || 0) * dt;
  const tg = manTarget(m.side), z = zoom(), p = worldToScreenUI(P.x, P.y);
  const wx = P.x + (tg.sx - p.x) / z, wy = P.y + (tg.sy - p.y + 8 * z) / z;
  m.x = approach(m.x, wx, 0.35, dt); m.y = approach(m.y, wy, 0.35, dt);
  // looked at: the explorer turned toward him, or he's drifted in toward the middle of the view
  const s = worldToScreenUI(m.x, m.y - 8), { w: vw, h: vh } = state.view;
  const fx = Math.cos(P.facing), fy = Math.sin(P.facing) * KY;
  const dx = s.x - p.x, dy = s.y - (p.y - 8 * z), dl = Math.hypot(dx, dy) || 1;
  const toward = P.moving && (fx * dx + fy * dy) / (dl * Math.hypot(fx, fy)) > 0.72;
  const central = Math.hypot(s.x - vw / 2, s.y - vh / 2) < Math.min(vw, vh) * 0.24;
  const offView = s.x < -40 || s.x > vw + 40 || s.y < -60 || s.y > vh + 60;
  if (!m.going) {
    if (toward || central) m.going = 'slip';
    else if (!canWalk() || stillT > 1.6 || m.t > m.life || offView || k <= 0) m.going = 'fade';
    if (m.going) state.events.push({ type: 'thirdman', stage: 'out', x: m.x, y: m.y, dissolved: m.going === 'slip' });
  }
  if (m.going === 'slip') { m.slip = Math.min(1, m.slip + dt / 1.1); m.vis = approach(m.vis, 0, 0.5, dt); }
  else if (m.going === 'fade') m.vis = approach(m.vis, 0, 1.6, dt);
  else m.vis = approach(m.vis, 1, 0.55, dt);
  if (m.going && (m.vis < 0.02 || m.slip >= 1)) { man = null; manCool = lerp(40, 8, k) * (0.7 + 0.6 * Math.random()); steps.length = 0; return; }
  // his footsteps: now and then a faint one a beat behind theirs, from where he walks
  if (m.vis > 0.35 && !m.going) {
    for (const e of state.events) if (e.type === 'step' && Math.random() < 0.45) steps.push({ t: state.time + 0.14 + Math.random() * 0.2, terrain: e.terrain });
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    if (state.time >= steps[i].t) { state.events.push({ type: 'thirdman', stage: 'step', x: m.x, y: m.y, terrain: steps[i].terrain, strength: 0.25 + 0.25 * m.vis }); steps.splice(i, 1); }
  }
}

export function init() {
  state.thirst = {
    get mirage() { return mir; }, get man() { return man; },
    // force him to come at the next chance while walking (tests), or send him off
    show: (on = true) => { if (on) { forced = true; manCool = 0; } else if (man) man.going = 'fade'; },
    // start (or end) a mirage episode now, at full strength at once (tests and captures)
    episode: (on = true) => { epiOn = on; epiT = on ? 30 : 60; epi = on ? 1 : 0; mir = on ? wantK(B()?.water ?? 1) * airK() : 0; if (on) updateSource(); },
  };
}

export function update(dt) {
  updateMirage(dt);
  if (mir > 0.01 || epi > 0.01) updateSource();
  updateMan(dt);
}

const manItem = { x: 0, y: 0, draw: ctx => drawMan(ctx) };
function drawMan(ctx) {
  const m = man;
  if (!m || !P.ghost) return;
  const k = smooth(0.12, 0, B()?.water ?? 1);
  P.ghost(ctx, m.x, m.y, m.vis * lerp(0.55, 0.7, k), m.slip, m.seed);
}
const NONE = [], ONE = [manItem];
export function drawables() {
  if (!man || man.vis < 0.01) return NONE;
  manItem.x = man.x; manItem.y = man.y;
  return ONE;
}
