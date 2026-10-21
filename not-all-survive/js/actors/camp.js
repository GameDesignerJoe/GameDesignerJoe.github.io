// The opening camp: a canvas ridge tent, a loaded freight sled, and four huskies on a
// picket line. Everything is drawn procedurally in the map's inked monochrome style.
//
//   tent  - canvas slopes are a small mesh that dents/ripples with state.wind
//   sled  - static; tarp hem flutters, snow slowly caps the load
//   dogs  - each a tiny projected 3D skeleton (capsules) with its own behaviour machine
//
// Projection used for everything here (matches the painted map's oblique camera):
//   screen-world = (x + X, y + Y * SQ - h)   with X,Y on the true ground plane, h = height.
// Light comes from the upper-left (north-west, above); shadows fall lower-right.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import * as terrain from '../world/terrain.js';
import { SIGNAL } from '../palette.js';

const TAU = Math.PI * 2;
const SQ = 0.72;                 // ground-plane depth foreshortening
const INK = '#444446';
const LX = -0.55, LY = -0.45, LZ = 0.70; // light direction (towards the light)

// --- layout (world px = map px). Spawn is (1360,1560). ---------------------------------
// Open snow just west of spawn, tucked in the lee (east side) of a low rubble outcrop at
// ~(1280-1307, 1528-1555); the prevailing wind blows west -> east.
const TENT = { x: 1330, y: 1542, yaw: -0.72 };   // door faces south-east, towards spawn
const SLED = { x: 1299, y: 1573, yaw: 0.42 };     // front points east, at the dogs
const PICKET = { ax: 1315, ay: 1569, bx: 1353, by: 1575 };
const BOUNDS = { x0: 1222, y0: 1500, x1: 1400, y1: 1602 };

// --- small utils ----------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(90210);
const rr = (a, b) => a + rnd() * (b - a);
function wrapA(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function lam(nx, ny, nz) { const l = Math.hypot(nx, ny, nz) || 1; return (nx * LX + ny * LY + nz * LZ) / l; }
function grey(t) { t = clamp(Math.round(t), 0, 255); return `rgb(${t},${t},${t + 1})`; }
function zoom() { return state.cam.zoom || 3; }
function inkW(base) { return Math.max(base, 0.85 / zoom()); }

function mkProj(ox, oy, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, ly, h) => [ox + lx * c - ly * s, oy + (lx * s + ly * c) * SQ - h];
  P.rot = (nx, ny) => [nx * c - ny * s, nx * s + ny * c];
  P.depth = (lx, ly) => lx * s + ly * c;
  return P;
}
const projT = mkProj(TENT.x, TENT.y, TENT.yaw);
const projS = mkProj(SLED.x, SLED.y, SLED.yaw);

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}
function line(ctx, pts, w, col = INK) {
  poly(ctx, pts);
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
}

// --- wind ----------------------------------------------------------------------------------
let wind = 0, gust = 0, windPh = 0;
function windLocal(yaw) {
  const a = state.wind.angle; // direction the wind blows towards
  const wx = Math.cos(a), wy = Math.sin(a), c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: wx * c + wy * s, y: -wx * s + wy * c };
}

// ===================================================================== INK =================
// Grey, slightly wobbly, occasionally broken line, to sit with the map's soft pen work.
const NOGAP = state.params.has('nogap');
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function inkLine(ctx, pts, w, col = INK, seed = 1, gaps = 0.025) {
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  let pen = false, k = seed * 17.3;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-3, n = Math.max(1, Math.ceil(L / 1.3));
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    for (let j = i ? 1 : 0; j <= n; j++) {
      const t = j / n; k += 1;
      const jit = (hash(k) - 0.5) * 0.18;
      const x = a[0] + (b[0] - a[0]) * t + nx * jit, y = a[1] + (b[1] - a[1]) * t + ny * jit;
      const gk = (k * 0.6180339 + seed * 0.371) % 1;
      if (!NOGAP && gk < gaps) { pen = false; continue; }
      if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}
const lwMainW = () => inkW(0.34);
const lwFineW = () => Math.max(0.16, 0.5 / zoom());

// ===================================================================== TENT ================
// Heavy draped canvas: ridge droops between the poles, eaves bow in between the pegs,
// hem scallops; wind presses the windward panel in, bellies the lee panel, flexes the ridge.
const T = { Wr: 11.2, He: 3.3, Ws: 12.9, Hr: 11.8, L2: 12.5 };
const NU = 20, NV = 5;
const GUY_I = [2, 10, 18];                 // mesh columns (u = 0.1, 0.5, 0.9) held by guy lines
const drift = { [-1]: 0, [1]: 0 };
const scal = u => (u <= 0.1 || u >= 0.9) ? 0 : Math.abs(Math.sin(Math.PI * (u - 0.1) / 0.4));

function tent3(u, v, sd, wl) {
  const { Wr, He, Hr, L2 } = T;
  const su = Math.sin(Math.PI * u), g = scal(u);
  const hr = Hr - 1.4 * su;                       // ridge sag
  const wr = Wr - 0.8 * su - 0.6 * g;             // eaves bow inward between pegs
  const he = He + 0.35 * g;
  const face = sd * wl.x;                         // < 0 : faces into the wind
  const pres = wind * wind * Math.abs(face) * (face < 0 ? 2.6 : -1.2) * (1 + 0.8 * gust);
  const ph = windPh, dir = wl.y < 0 ? 1 : -1;
  const rip = (0.12 + 0.7 * wind + 0.6 * gust) * (0.6 * Math.sin(TAU * (1.1 * u + 0.25 * v) - dir * ph * 2.1)
    + 0.3 * Math.sin(TAU * (2.3 * u - 0.5 * v) - dir * ph * 3.6 + sd * 1.7));
  const env = Math.pow(su, 0.7) * (0.85 * Math.sin(Math.PI * v * 0.9) + 0.45 * v * g);
  const d = env * (rip - pres) - 0.6 * Math.sin(Math.PI * v) * Math.sqrt(su);   // + static inward sag
  const nl = Math.hypot(hr - he, wr), nx = sd * (hr - he) / nl, nz = wr / nl;
  const flex = wl.x * (0.35 * wind + 0.3 * gust + 0.15 * wind * Math.sin(ph * 2.7)) * su * (1 - 0.65 * v);
  return [sd * wr * v + d * nx + flex, L2 - 2 * L2 * u, hr - (hr - he) * v + d * nz];
}
const P3 = (P, p) => P(p[0], p[1], p[2]);

function guyDefs(mesh) {
  const { Wr, Hr, L2 } = T, g = [];
  g.push({ a: [0, L2 + 0.1, Hr + 1.0], p: [0, L2 + 9.5, 0], sd: 0, end: 1 });
  g.push({ a: [0, -L2 - 0.1, Hr + 1.0], p: [0, -L2 - 9.5, 0], sd: 0, end: -1 });
  for (const sd of [-1, 1]) {
    for (const i of GUY_I) {
      const ly = T.L2 - 2 * T.L2 * i / NU;
      const a = mesh ? mesh[sd][i][NV] : [sd * Wr, ly, T.He];
      g.push({ a, p: [sd * (Wr + 7.5), ly * 1.18, 0], sd });
    }
  }
  return g;
}

function drawGuy(ctx, P, g, wl, idx) {
  const a = P3(P, g.a), p = P(g.p[0], g.p[1], 0);
  const windward = g.sd ? g.sd * wl.x < 0 : g.end * wl.y < 0;
  const tension = clamp(windward ? 0.55 + 0.5 * wind + gust * 0.5 : 0.25 - 0.1 * wind, 0, 1);
  const len = Math.hypot(p[0] - a[0], p[1] - a[1]);
  const sag = (1 - tension) * len * 0.07;
  let sway = windward ? 0 : Math.sin(windPh * 3.7 + idx * 1.9) * (0.15 + 0.5 * wind) * len * 0.03;
  if (windward && wind > 0.55) sway += Math.sin(state.time * 47 + idx * 2.3) * (wind - 0.55) * 0.5; // thrum
  const mx = (a[0] + p[0]) / 2 + sway, my = (a[1] + p[1]) / 2 + sag;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, p[0], p[1]);
  ctx.lineWidth = lwFineW(); ctx.strokeStyle = 'rgba(66,66,68,0.8)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p[0], p[1] + 0.2); ctx.lineTo(p[0] - 0.1, p[1] - 0.7);
  ctx.lineWidth = inkW(0.32); ctx.strokeStyle = '#4a4a4c'; ctx.stroke();
}

function snowBank(ctx, inner, outer) {
  poly(ctx, [...inner, ...outer.slice().reverse()]); ctx.closePath();
  ctx.fillStyle = '#f8f8f6'; ctx.fill();
  inkLine(ctx, inner, lwFineW(), 'rgba(140,142,146,0.8)', 3, 0.15);
  ctx.fillStyle = 'rgba(72,72,74,0.7)';
  for (let i = 1; i < outer.length - 1; i++) {
    const [x, y] = outer[i];
    ctx.fillRect(x - 0.12, y - 0.12, 0.25, 0.25);
    const [x2, y2] = outer[i + 1];
    if (i % 2) ctx.fillRect((x + x2) / 2 + 0.1, (y + y2) / 2 + 0.05, 0.2, 0.2);
  }
}

// --- the tent is the game's signal yellow; grey tones (~180..246) map onto the palette,
// and at night the canvas glows from inside toward SIGNAL.glow.
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const Y_SH = hexRGB(SIGNAL.shadow), Y_BA = hexRGB(SIGNAL.base), Y_LI = hexRGB(SIGNAL.lit), Y_DP = hexRGB(SIGNAL.deep), Y_GL = hexRGB(SIGNAL.glow);
let tentNight = 0;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
function yel(tone) {
  const f = clamp((tone - 182) / 56, 0, 1);
  let c = f < 0.5 ? mix(Y_SH, Y_BA, f * 2) : mix(Y_BA, Y_LI, (f - 0.5) * 2);
  if (tentNight > 0) c = mix(c, mix(Y_GL, [255, 236, 190], 0.15 + 0.25 * f), tentNight * 0.85);
  return rgb(c);
}
const deepA = a => `rgba(${Y_DP[0]},${Y_DP[1]},${Y_DP[2]},${a * (1 - 0.4 * tentNight)})`;
function doorFill(dA, dLb, dRb) {
  if (tentNight <= 0.02) return '#3d3d3f';
  return rgb(mix([61, 61, 63], [255, 226, 150], tentNight));
}

function drawTent(ctx) {
  const P = projT, { Wr, He, Ws, Hr, L2 } = T;
  const wl = windLocal(TENT.yaw);
  const mesh = {};
  for (const sd of [-1, 1]) {
    mesh[sd] = [];
    for (let i = 0; i <= NU; i++) { const col = []; for (let j = 0; j <= NV; j++) col.push(tent3(i / NU, j / NV, sd, wl)); mesh[sd].push(col); }
  }
  const guys = guyDefs(mesh);
  guys.forEach((g, i) => { if (P.depth(g.p[0], g.p[1]) < -2) drawGuy(ctx, P, g, wl, i); });
  const lwM = lwMainW(), lwF = lwFineW();
  const sides = [-1, 1].sort((a, b) => P.depth(a, 0) - P.depth(b, 0));

  // --- side skirts with full, scalloped hems
  const hem = sd => mesh[sd].map((c, i) => {
    const u = i / NU, g = scal(u), ly = L2 - 2 * L2 * u;
    const fl = Math.max(0, Math.sin(windPh * 5.1 + i * 0.9 + sd)) * 0.25 * wind * g;
    return [sd * (Ws + 0.35 * g + fl), ly, 0.6 * g + fl];
  });
  for (const sd of sides) {
    const top = mesh[sd].map(c => c[NV]), bot = hem(sd);
    const nW = P.rot(sd * He, 0);
    const tone = 178 + 40 * lam(nW[0], nW[1], Ws - Wr);
    poly(ctx, [...bot.map(p => P3(P, p)), ...bot.slice().reverse().map(p => P(p[0], p[1], 0))]);
    ctx.fillStyle = SIGNAL.deep; ctx.fill();
    poly(ctx, [...top.map(p => P3(P, p)), ...bot.slice().reverse().map(p => P3(P, p))]); ctx.closePath();
    ctx.fillStyle = yel(tone); ctx.fill();
    for (const i of GUY_I) inkLine(ctx, [P3(P, top[i]), P3(P, bot[i])], lwF, deepA(0.5), i + sd);
    inkLine(ctx, bot.map(p => P3(P, p)), lwM, INK, 11 + sd);
  }

  // --- snow on the valances + windward drift
  for (const sd of sides) {
    const amt = drift[sd], inner = [], outer = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, ly = L2 - 2 * L2 * u;
      const b = Math.pow(Math.sin(Math.PI * u), 0.6) * (0.85 + 0.15 * Math.sin(i * 2.7));
      const n = Math.sin(i * 1.7 + sd) * 0.25;
      inner.push(P(sd * (Ws - 0.2), ly, 0.7 + n + 1.7 * amt * b));
      outer.push(P(sd * (Ws + 1.1 + n + 5.2 * amt * b), ly + sd * 0.2, 0));
    }
    snowBank(ctx, inner, outer);
  }

  // --- roof slopes: many thin strips (no visible facets) + a soft ridge-to-eave gradient
  for (const sd of sides) {
    const m = mesh[sd];
    const nB = P.rot(sd * (Hr - He), 0), lB = lam(nB[0], nB[1], Wr);
    const base = 211 + 34 * lB;
    for (let i = 0; i < NU; i++) {
      const A = m[i][0], B = m[i + 1][0], C = m[i + 1][NV], D = m[i][NV];
      const e1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], e2 = [D[0] - B[0], D[1] - B[1], D[2] - B[2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (n[2] < 0) n = n.map(q => -q);
      const nw = P.rot(n[0], n[1]);
      const tone = Math.min(246, base + 75 * (lam(nw[0], nw[1], n[2]) - lB));
      const pts = [...m[i].map(p => P3(P, p)), ...m[i + 1].slice().reverse().map(p => P3(P, p))];
      poly(ctx, pts); ctx.closePath();
      ctx.fillStyle = yel(tone); ctx.fill();
      ctx.lineWidth = 0.25; ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
    }
    // soft gradient: lighter at the ridge, greyer toward the eave
    const outline = [...m.map(c => P3(P, c[0])), ...m[NU].map(p => P3(P, p)), ...m.slice().reverse().map(c => P3(P, c[NV])), ...m[0].slice().reverse().map(p => P3(P, p))];
    const r0 = P3(P, m[NU >> 1][0]), e0 = P3(P, m[NU >> 1][NV]);
    const gr = ctx.createLinearGradient(r0[0], r0[1], e0[0], e0[1]);
    gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.6, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(90,92,96,0.16)');
    poly(ctx, outline); ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
    // folds radiating from the pole tops, and tension folds up from each guy point
    const fold = (u0, v0, u1, v1, s) => {
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(P3(P, tent3(lerp(u0, u1, t), lerp(v0, v1, t), sd, wl))); }
      inkLine(ctx, pts, lwF, deepA(0.5), s, 0.12);
    };
    for (const ue of [0.09, 0.19, 0.3]) { fold(0.005, 0.02, ue, 0.95, ue * 40 + sd); fold(0.995, 0.02, 1 - ue, 0.95, ue * 50 + sd); }
    for (const i of GUY_I) { const u = i / NU; fold(u, 1, u - 0.05, 0.5, i * 3 + sd); fold(u, 1, u + 0.05, 0.55, i * 5 + sd); }
    inkLine(ctx, m.map(c => P3(P, c[NV])), lwM, INK, 21 + sd);
    inkLine(ctx, m[NU].map(p => P3(P, p)), lwM, INK, 31 + sd);
  }
  inkLine(ctx, mesh[-1].map(c => P3(P, c[0])), inkW(0.42), INK, 41, 0.02);
  inkLine(ctx, [P(0, -L2, Hr), P(0, -L2 - 0.1, Hr + 1.3)], inkW(0.3), INK, 43, 0);

  // --- front gable with the doorway
  const gN = P.rot(0, 1);
  const gTone = 206 + 40 * lam(gN[0], gN[1], 0);
  const apex = P(0, L2, Hr), eL = P3(P, mesh[-1][0][NV]), eR = P3(P, mesh[1][0][NV]);
  const gHem = [];
  for (let k = 0; k <= 12; k++) {
    const x = -Ws + 2 * Ws * k / 12, door = Math.abs(x) < 3.4;
    gHem.push(P(x, L2 + 0.1 * Math.sin(k), door ? 0 : 0.45 * Math.abs(Math.sin(Math.PI * k / 4))));
  }
  poly(ctx, [eL, apex, eR, ...gHem.slice().reverse()]); ctx.closePath();
  const gg = ctx.createLinearGradient(apex[0], apex[1], (gHem[0][0] + gHem[12][0]) / 2, gHem[6][1]);
  gg.addColorStop(0, yel(gTone + 14)); gg.addColorStop(1, yel(gTone - 12));
  ctx.fillStyle = gg; ctx.fill();
  for (const f of [-0.85, -0.5, 0.55, 0.88]) {
    const end = P(f * Ws, L2 + 0.02, 0.4);
    inkLine(ctx, [P(f * 0.6, L2, Hr - 0.6), [lerp(apex[0], end[0], 0.5) + f * 0.4, lerp(apex[1], end[1], 0.5)], end], lwF, deepA(0.45), 50 + f * 10, 0.15);
  }
  if (tentNight > 0.02) {
    inkLine(ctx, [apex, P(0, L2, 0.3)], inkW(0.5), `rgba(${Y_SH[0]},${Y_SH[1]},${Y_SH[2]},${0.45 * tentNight})`, 71, 0);
    for (const sd of [-1, 1]) for (const i of [7, 13]) inkLine(ctx, mesh[sd][i].map(p => P3(P, p)), inkW(0.4), `rgba(${Y_SH[0]},${Y_SH[1]},${Y_SH[2]},${0.3 * tentNight})`, i + sd, 0);
  }
  const dh = Hr * 0.62, dw = 3.0;
  const dA = P(0, L2 + 0.03, dh), dLb = P(-dw, L2 + 0.03, 0), dRb = P(dw, L2 + 0.03, 0);
  poly(ctx, [dA, dRb, dLb]); ctx.closePath(); ctx.fillStyle = doorFill(dA, dLb, dRb); ctx.fill();
  const fl = [P(-0.35, L2 + 0.06, dh - 0.4), P(-dw, L2 + 0.06, 0), P(-dw - 2.0, L2 + 0.4, 0.25), P(-dw - 0.5, L2 + 0.3, 2.6)];
  poly(ctx, fl); ctx.closePath(); ctx.fillStyle = yel(gTone - 18); ctx.fill();
  inkLine(ctx, [...fl, fl[0]], lwF, SIGNAL.deep, 61, 0);
  const xf = dw - 1.7 + Math.sin(windPh * 4.3) * (0.35 + 0.6 * wind) + gust * 0.9 - 0.3 * wind;
  const midf = P(lerp(0, xf, 0.5) + Math.sin(windPh * 6.1) * 0.3 * wind, L2 + 0.25, dh * 0.5);
  const rf = [dA, dRb, P(xf, L2 + 0.35 + 0.4 * wind, 0.15), midf];
  poly(ctx, rf); ctx.closePath(); ctx.fillStyle = yel(gTone + 6); ctx.fill();
  inkLine(ctx, [...rf, dA], lwF, SIGNAL.deep, 63, 0);
  inkLine(ctx, [eL, apex, eR], lwM, INK, 65, 0.03);
  inkLine(ctx, gHem, lwM, INK, 67);
  inkLine(ctx, [apex, P(0, L2 + 0.1, Hr + 1.3)], inkW(0.3), INK, 69, 0);
  {
    const inner = [], outer = [];
    for (let i = 0; i <= 14; i++) {
      const x = -Ws - 0.3 + (2 * Ws + 0.6) * i / 14;
      const door = Math.abs(x) < dw + 0.4 ? 0.25 : 1;
      const n = Math.sin(i * 2.3) * 0.2;
      inner.push(P(x, L2 + 0.05, (0.7 + n) * door));
      outer.push(P(x, L2 + (1.3 + n) * (0.5 + 0.5 * door), 0));
    }
    snowBank(ctx, inner, outer);
  }
  guys.forEach((g, i) => { if (P.depth(g.p[0], g.p[1]) >= -2) drawGuy(ctx, P, g, wl, i); });
}

// ===================================================================== SLED ================
// A curved basket hull on long upswept runners, heaped with lashed bundles and sacks.
const HULL = [[-11.6, 2.3], [8.4, 2.3], [10.8, 2.7], [12.4, 3.8], [13.0, 5.0], [10.2, 4.7], [-11.6, 4.5]];
const RUNNER = [[-13.4, 1.1], [-12.8, 0.2], [-11.6, 0], [9.2, 0], [11.6, 0.45], [13.4, 1.7], [14.5, 3.4], [14.6, 4.9], [13.9, 5.7], [13.0, 5.0]];
const BUNDLES = (() => {
  const R = mulberry(4711), out = [];
  const kind = () => { const r = R(); return r < 0.35 ? 'sack' : r < 0.75 ? 'bundle' : 'box'; };
  const add = (x, y, w, d, h0, h, k) => out.push({ x, y, w, d, h0, h, k });
  let x = -10.4;
  while (x < 5.8) {
    const w = 2.0 + R() * 2.6;
    if (R() < 0.4) add(x + w / 2, (R() - 0.5) * 0.8, w, 5.2 + R() * 1.4, 2.9, 1.4 + R() * 1.6, kind());
    else {
      const s = (R() - 0.5) * 1.6;
      add(x + w / 2 + (R() - 0.5) * 0.6, (-3.3 + s) / 2, w * (0.75 + R() * 0.3), 3.3 + s - 0.3, 2.9, 1.3 + R() * 1.7, kind());
      add(x + w / 2 + (R() - 0.5) * 0.8, (3.3 + s) / 2, w * (0.7 + R() * 0.35), 3.3 - s - 0.3, 2.9, 1.2 + R() * 1.6, kind());
    }
    x += w * (0.8 + R() * 0.2);
  }
  const top = (px, py) => { let t = 2.9; for (const b of out) if (Math.abs(px - b.x) < b.w / 2 && Math.abs(py - b.y) < b.d / 2) t = Math.max(t, b.h0 + b.h); return t; };
  for (let i = 0; i < 6; i++) {
    const px = -9.6 + i * 2.7 + (R() - 0.5) * 1.2, py = (R() - 0.5) * 3.2, w = 1.6 + R() * 1.8, d = 1.8 + R() * 2.2;
    add(px, py, w * 1.2, d, top(px, py) - 0.2, 0.9 + R() * 1.0, R() < 0.55 ? 'sack' : 'bundle');
  }
  out.forEach(b => { b.depth = projS.depth(b.x, b.y) + b.h0 * 0.12; b.seed = R() * 100; });
  return out.sort((a, b) => a.depth - b.depth);
})();
const TARP = { x: 8.0, y: 0, w: 4.2, d: 6.4, h0: 2.9, h: 3.0 };

function roundPath(ctx, pts, r = 0.5) {
  const n = pts.length, m = (a, b) => [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)];
  ctx.beginPath();
  const s = m(pts[n - 1], pts[0]); ctx.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], e = m(a, pts[(i + 1) % n]);
    ctx.quadraticCurveTo(a[0], a[1], e[0], e[1]);
  }
  ctx.closePath();
}
function boxCorners(P, b, inset = 0) {
  const x0 = b.x - b.w / 2 + inset, x1 = b.x + b.w / 2 - inset, y0 = b.y - b.d / 2 + inset, y1 = b.y + b.d / 2 - inset;
  return { x0, x1, y0, y1, h0: b.h0, h1: b.h0 + b.h };
}
// Flattened canvas-wrapped bundles: boxy faces, darker canvas tones, no highlights.
function drawBundle(ctx, P, b, snow) {
  const c = boxCorners(P, b);
  const tone = b.k === 'sack' ? 132 : b.k === 'box' ? 104 : 118;
  const k = b.k === 'box' ? 0 : 0.35;          // small chamfer so canvas corners aren't razor sharp
  const ring = h => [[c.x0 + k, c.y0], [c.x1 - k, c.y0], [c.x1, c.y0 + k], [c.x1, c.y1 - k], [c.x1 - k, c.y1], [c.x0 + k, c.y1], [c.x0, c.y1 - k], [c.x0, c.y0 + k]].map(([x, y]) => [x, y, h]);
  const lo = ring(c.h0), hi = ring(c.h1 - (b.k === 'box' ? 0 : 0.12 * b.h));
  const lw = lwMainW() * 0.8;
  // side faces facing the camera, darker to the lower right
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const ex = hi[j][0] - hi[i][0], ey = hi[j][1] - hi[i][1];
    const nw = P.rot(ey, -ex);
    if (nw[1] <= 0) continue;
    const f = [P3(P, lo[i]), P3(P, lo[j]), P3(P, hi[j]), P3(P, hi[i])];
    poly(ctx, f); ctx.closePath();
    ctx.fillStyle = grey(tone + 30 * lam(nw[0], nw[1], 0)); ctx.fill();
    ctx.lineWidth = 0.2; ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
  }
  // slightly domed (not round) top
  const top = hi.map(p => P3(P, p));
  const mid = P(b.x, b.y, c.h1);
  poly(ctx, top); ctx.closePath();
  ctx.fillStyle = grey(tone + 22); ctx.fill();
  // outline of the whole bundle
  const all = [...lo.map(p => P3(P, p)), ...top];
  poly(ctx, hull(all)); ctx.closePath();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  // canvas creases / plank seam
  const fx = (t, h) => P(lerp(c.x0, c.x1, t), c.y1, h);
  if (b.k === 'box') inkLine(ctx, [fx(0, (c.h0 + c.h1) / 2), fx(1, (c.h0 + c.h1) / 2)], lwFineW(), 'rgba(40,40,42,0.5)', b.seed, 0);
  else inkLine(ctx, [top[1], [lerp(mid[0], top[5][0], 0.4), lerp(mid[1], top[5][1], 0.4)]], lwFineW(), 'rgba(50,50,52,0.4)', b.seed, 0);
}

// snow lying on a top face: a soft drift along its back (north) edge, deeper with time
function snowCap(ctx, s, snow) {
  let bi = 0, by = Infinity;
  for (let i = 0; i < 4; i++) { const y = (s[i][1] + s[(i + 1) % 4][1]) / 2; if (y < by) { by = y; bi = i; } }
  const A = s[bi], B = s[(bi + 1) % 4], C = s[(bi + 2) % 4], D = s[(bi + 3) % 4];
  const k = 0.2 + 0.4 * snow;
  const Ai = [lerp(A[0], D[0], k), lerp(A[1], D[1], k)], Bi = [lerp(B[0], C[0], k), lerp(B[1], C[1], k)];
  const m = [(Ai[0] + Bi[0]) / 2, (Ai[1] + Bi[1]) / 2 + 0.2];
  ctx.beginPath();
  ctx.moveTo(lerp(A[0], B[0], 0.08), lerp(A[1], B[1], 0.08) - 0.1);
  ctx.lineTo(lerp(A[0], B[0], 0.92), lerp(A[1], B[1], 0.92) - 0.1);
  ctx.quadraticCurveTo(Bi[0], Bi[1], m[0], m[1]);
  ctx.quadraticCurveTo(Ai[0], Ai[1], lerp(A[0], B[0], 0.08), lerp(A[1], B[1], 0.08) - 0.1);
  ctx.fillStyle = 'rgba(250,250,249,0.95)'; ctx.fill();
}

function drawTarp(ctx, P, b, snow, near) {
  const c = boxCorners(P, b), lwM = lwMainW() * 0.85, lwF = lwFineW();
  // draped sheet: rounded top + hanging sides whose hem lifts in the wind
  const sides = [
    { n: [1, 0], e: [[c.x1, c.y0], [c.x1, c.y1]] },
    { n: [0, near], e: near > 0 ? [[c.x1, c.y1], [c.x0, c.y1]] : [[c.x0, c.y0], [c.x1, c.y0]] },
  ];
  for (const sd of sides) {
    const nw = P.rot(sd.n[0], sd.n[1]);
    if (nw[1] <= 0.02) continue;
    const [A, B] = sd.e, N = 8, hemPts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, edge = Math.sin(Math.PI * t) * 0.6 + (t > 0.7 ? (t - 0.7) * 2.5 : 0);
      const fl = (0.12 + 0.75 * wind + gust * 0.5) * Math.max(0, Math.sin(windPh * 5.3 + i * 1.15)) * edge;
      hemPts.push(P(lerp(A[0], B[0], t) + sd.n[0] * fl * 0.6, lerp(A[1], B[1], t) + sd.n[1] * fl * 0.6, c.h0 + 0.6 + fl * 1.3 + 0.25 * Math.sin(i * 2.1)));
    }
    const pts = [P(A[0], A[1], c.h1 - 0.3), ...hemPts, P(B[0], B[1], c.h1 - 0.3)];
    roundPath(ctx, pts);
    ctx.fillStyle = grey(110 + 30 * lam(nw[0], nw[1], 0)); ctx.fill();
    ctx.lineWidth = lwM; ctx.strokeStyle = INK; ctx.stroke();
    for (const t of [0.3, 0.65]) {
      const tp = P(lerp(A[0], B[0], t), lerp(A[1], B[1], t), c.h1 - 0.3), hp = hemPts[Math.round(t * N)];
      inkLine(ctx, [tp, [lerp(tp[0], hp[0], 0.85), lerp(tp[1], hp[1], 0.85)]], lwF, 'rgba(55,55,57,0.45)', t * 9, 0);
    }
  }
  const top = [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1]].map(([x, y]) => P(x, y, c.h1));
  poly(ctx, top); ctx.closePath();
  ctx.fillStyle = grey(126 + 20 * lam(0, 0, 1)); ctx.fill();
  ctx.lineWidth = lwM; ctx.strokeStyle = INK; ctx.stroke();
}

function drawSled(ctx) {
  const P = projS, snow = sledSnow();
  const near = P.rot(0, 1)[1] > 0 ? 1 : -1, far = -near;
  const lwM = lwMainW(), lwF = lwFineW();
  const runner = sd => RUNNER.map(([x, h]) => P(x, sd * 3.2, h));
  const stanchions = sd => {
    for (const x of [-10, -6, -2, 2, 6]) inkLine(ctx, [P(x, sd * 3.2, 0), P(x, sd * 3.45, 2.3)], lwM, INK, x + sd, 0);
    inkLine(ctx, [P(-10, sd * 3.2, 0.1), P(-6, sd * 3.4, 2.2)], lwF, 'rgba(50,50,52,0.6)', 5 + sd, 0);
  };
  const side = sd => HULL.map(([x, h]) => P(x, sd * (3.6 - Math.max(0, x - 9) * 0.35), h));
  // far runner, far stanchions, far hull wall (seen from inside, dark)
  inkLine(ctx, runner(far), inkW(0.42), INK, 71, 0);
  stanchions(far);
  const fs = side(far);
  roundPath(ctx, fs); ctx.fillStyle = '#58585a'; ctx.fill();
  ctx.lineWidth = lwM; ctx.strokeStyle = INK; ctx.stroke();
  // the heaped load and the tarp-covered front
  for (const b of BUNDLES) drawBundle(ctx, P, b, snow);
  drawTarp(ctx, P, TARP, snow, near);
  // three lashing lines thrown across the load, gunwale to gunwale
  for (const x of [-7.6, -1.8, 4.2]) {
    let t = 2.9; for (const b of BUNDLES) if (Math.abs(x - b.x) < b.w / 2 + 0.3) t = Math.max(t, b.h0 + b.h);
    inkLine(ctx, [P(x - 0.3, far * 2.2, t), P(x, 0, t + 0.15), P(x + 0.3, near * 2.4, t - 0.1), P(x + 0.5, near * 3.65, 4.55)], inkW(0.24), 'rgba(30,30,32,0.9)', x, 0);
  }
  // near hull wall: curved basket side with plank seams and a light gunwale
  const ns = side(near);
  roundPath(ctx, ns);
  const g = ctx.createLinearGradient(ns[6][0], ns[6][1], ns[1][0], ns[1][1]);
  g.addColorStop(0, '#8c8c8e'); g.addColorStop(1, '#5e5e60');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = lwM; ctx.strokeStyle = INK; ctx.stroke();
  for (const f of [0.35, 0.68]) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const x = -11.4 + k * 2.75; pts.push(P(x, near * (3.62 - Math.max(0, x - 9) * 0.35), lerp(2.35, x > 9 ? 4.7 - (x - 9) * 0.2 : 4.5, f))); }
    inkLine(ctx, pts, lwF, 'rgba(38,38,40,0.55)', f * 10, 0.08);
  }
  inkLine(ctx, [ns[6], ns[5], ns[4]], inkW(0.22), 'rgba(185,187,190,0.9)', 91, 0);
  // prow cap joining the two sides
  const prow = [fs[3], fs[4], ns[4], ns[3]];
  poly(ctx, prow); ctx.closePath(); ctx.fillStyle = '#6a6a6c'; ctx.fill();
  ctx.lineWidth = lwM; ctx.strokeStyle = INK; ctx.stroke();
  // near runner (its upswept tip meets the prow) + stanchions
  stanchions(near);
  inkLine(ctx, runner(near), inkW(0.42), INK, 73, 0);
  inkLine(ctx, [P(13.0, far * 3.2, 5.0), P(13.0, near * 3.2, 5.0)], lwM, INK, 75, 0);
}
function sledSnow() {
  return clamp(0.12 + 0.6 * Math.min(1, state.time / 300) * (0.4 + state.weather.snowfall), 0, 1);
}

// ===================================================================== DOGS ================
const POSE = {
  stand: { hipH: 4.4, shH: 4.7, bend: 0, neckP: 0.62, headP: -0.12, tailUp: 0.95, fPaw: 0.15, fPawH: 0, hPaw: -0.5, hPawH: 0 },
  sit: { hipH: 1.4, shH: 5.0, bend: 0, neckP: 0.75, headP: -0.05, tailUp: 0.1, fPaw: 0.45, fPawH: 0, hPaw: 1.2, hPawH: 0 },
  lie: { hipH: 1.15, shH: 1.4, bend: 0.25, neckP: 0.85, headP: -0.2, tailUp: 0.05, fPaw: 2.6, fPawH: 0.25, hPaw: 1.7, hPawH: 0.3 },
  rest: { hipH: 1.1, shH: 1.3, bend: 0.4, neckP: 0.1, headP: -0.4, tailUp: 0.0, fPaw: 2.6, fPawH: 0.25, hPaw: 1.7, hPawH: 0.3 },
  curl: { hipH: 1.05, shH: 1.1, bend: 2.6, neckP: 0.2, headP: -0.15, tailUp: 0, fPaw: 1.0, fPawH: 0.3, hPaw: 1.0, hPawH: 0.3 },
  bow: { hipH: 4.7, shH: 2.0, bend: 0, neckP: 0.3, headP: 0.1, tailUp: 1, fPaw: 2.9, fPawH: 0, hPaw: -0.3, hPawH: 0 },
  hstretch: { hipH: 3.8, shH: 5.0, bend: 0, neckP: 1.0, headP: 0.2, tailUp: 0.5, fPaw: 0.5, fPawH: 0, hPaw: -2.1, hPawH: 0 },
  howl: { hipH: 1.4, shH: 5.0, bend: 0, neckP: 1.35, headP: 1.1, tailUp: 0.1, fPaw: 0.45, fPawH: 0, hPaw: 1.2, hPawH: 0 },
  lhowl: { hipH: 1.15, shH: 1.7, bend: 0.2, neckP: 1.3, headP: 1.05, tailUp: 0.05, fPaw: 2.6, fPawH: 0.25, hPaw: 1.7, hPawH: 0.3 },
};
const DOG_LOOK = [
  { dark: 62, light: 168, size: 0.98 },
  { dark: 84, light: 186, size: 0.93 },
  { dark: 50, light: 150, size: 1.02 },
  { dark: 104, light: 196, size: 0.9 },
];
const dogs = [];
const puffs = [], flecks = [];
let howlTimer = 16, playerNear = false;

function makeDog(i) {
  const t = 0.12 + i * 0.253;
  const ax = lerp(PICKET.ax, PICKET.bx, t), ay = lerp(PICKET.ay, PICKET.by, t) + (i % 2 ? 1.6 : -1.0);
  const start = ['curl', 'sit', 'rest', 'stand'][i];
  const d = {
    i, ax, ay, x: ax + rr(-1.5, 1.5), y: ay + rr(-1, 1),
    heading: [0.25, Math.PI - 0.3, -0.2, Math.PI + 0.35][i],
    look: DOG_LOOK[i], state: start, poseName: start, t: 0, dur: rr(4, 10),
    p: { ...POSE[start] }, neckYaw: 0, idleLook: 0, idleT: rr(1, 3), tailYaw: 0, wag: 0, wagPh: rr(0, 6),
    mouth: 0, mouthT: 0, earsBack: 0, earT: rr(1, 4), earFlick: 0, gait: 0, move: 0, speed: 0,
    goal: null, circDir: 1, snow: start === 'curl' ? 0.28 : 0.05, shake: 0, breathT: rr(0.3, 2),
    barks: [], interest: [0.5, 0.15, 0, 0.7][i], near: false, barkDelay: -1, howlDelay: -1, howled: false, tip: null, lastDist: 999, appr: 0, fromLie: false,
  };
  if (start === 'curl') d.neckYaw = 1.1;
  if (FROZEN) {
    const st = FROZEN.split(',')[i] || 'stand';
    d.state = st; d.poseName = POSE[st] ? st : 'stand'; d.p = { ...POSE[d.poseName] }; d.dur = 1e9;
    const hs = state.params.get('campdogh');
    if (hs) d.heading = parseFloat(hs.split(',')[i] || '0');
  }
  return d;
}

function setState(d, s, dur, poseName) {
  const prev = d.state;
  d.state = s; d.t = 0; d.dur = dur;
  d.poseName = poseName || ({ walk: 'stand', circle: 'stand', shake: 'stand', stretch: 'bow' }[s] || s);
  d.fromLie = (prev === 'lie' || prev === 'rest' || prev === 'curl') && s === 'stand';
  if (s === 'walk') {
    // shuffle mostly sideways so a walking dog stays side-on too
    const a = (rnd() < 0.5 ? 0 : Math.PI) + rr(-0.45, 0.45), r = rr(1.5, 3.2);
    let gx = d.x + Math.cos(a) * r, gy = (d.y - d.ay) / SQ + Math.sin(a) * r;
    gx = clamp(gx, d.ax - 3.2, d.ax + 3.2); gy = clamp(gy, -1.2, 1.2);
    d.goal = { x: gx, y: d.ay + gy * SQ };
  }
  if (s === 'circle') d.circDir = rnd() < 0.5 ? -1 : 1;
  d.shook = false;
}
function pick(opts) {
  let tot = 0; for (const o of opts) tot += Math.max(0, o[1]);
  let r = rnd() * tot;
  for (const o of opts) { r -= Math.max(0, o[1]); if (r <= 0) return o[0]; }
  return opts[0][0];
}
const FROZEN = state.params.get('campdogs'); // test: ?campdogs=stand,sit,lie,curl freezes poses
const LYING = s => s === 'lie' || s === 'rest' || s === 'curl';

function nextState(d) {
  const s = wind, near = d.near;
  switch (d.state) {
    case 'circle': {
      const n = pick([['curl', 0.4 + 4 * s * s], ['rest', 1], ['lie', 1]]);
      return setState(d, n, rr(10, 22));
    }
    case 'walk': return setState(d, pick([['stand', 2], ['sit', 2], ['circle', near ? 0.4 : 1.4 + 2 * s]]), rr(3, 7));
    case 'shake': return setState(d, pick([['stand', 1], ['walk', 1], ['sit', 1]]), rr(3, 6));
    case 'stretch': return (d.snow > 0.12 || rnd() < 0.35) ? setState(d, 'shake', 1.3) : setState(d, 'stand', rr(2, 4));
    case 'bark': return setState(d, d.barkPose === 'stand' ? 'stand' : 'sit', rr(3, 6));
    case 'howl': return setState(d, d.poseName === 'lhowl' ? 'lie' : 'sit', rr(4, 8));
    case 'lie': case 'rest': case 'curl': {
      if (near && rnd() < 0.7) return d.state === 'curl' ? setState(d, 'lie', rr(4, 8)) : setState(d, rnd() < 0.5 ? 'sit' : 'stand', rr(4, 8));
      const n = pick([['curl', 0.3 + 4 * s * s], ['rest', 1.2], ['lie', 1], ['stand', 0.7 - s * 0.4], ['sit', 0.5]]);
      return setState(d, n, LYING(n) ? rr(8, 20) : rr(3, 7));
    }
    case 'stand': {
      if (d.fromLie && rnd() < 0.75) return setState(d, 'stretch', 2.6);
      if (d.snow > 0.2) return setState(d, 'shake', 1.3);
      return setState(d, pick([['walk', 2], ['sit', 1.5], ['circle', 0.8 + 3 * s], ['shake', 0.3], ['stand', 0.5]]), rr(3, 7));
    }
    case 'sit': default:
      return setState(d, pick([['stand', 1], ['lie', 1 + s], ['circle', 0.4], ['sit', near ? 1.5 : 0.6]]), rr(4, 10));
  }
}

function startBark(d) {
  if (d.state === 'howl') return;
  d.barkPose = d.state === 'stand' || d.state === 'walk' ? 'stand' : 'sit';
  const n = 2 + Math.floor(rnd() * 3);
  setState(d, 'bark', 0.45 * n + 0.4, d.barkPose);
  d.barks = []; for (let k = 0; k < n; k++) d.barks.push(0.15 + k * rr(0.36, 0.46));
}
function startHowl(d) {
  const lying = LYING(d.state) && rnd() < 0.55;
  setState(d, 'howl', rr(4.5, 6.5), lying ? 'lhowl' : 'howl');
  d.howled = false;
}

function updateDog(d, dt) {
  const pl = state.player;
  const dxp = pl.x - d.x, dyp = (pl.y - d.y) / SQ;
  d.pd = Math.hypot(dxp, dyp);
  d.appr = lerp(d.appr, d.pd < d.lastDist - 0.02 * dt ? 1 : 0, 1 - Math.exp(-dt * 3));
  d.lastDist = d.pd;
  d.t += dt;
  // interest: rises while the explorer moves nearby or walks up, fades when they stand around
  const pMoving = pl.moving || Math.hypot(pl.vx || 0, pl.vy || 0) > 2;
  if (d.pd < 45 && (pMoving || d.appr > 0.5)) d.interest = Math.min(1.5, d.interest + dt * 0.9);
  else d.interest = Math.max(0, d.interest - dt * 0.06);
  const near = d.near = d.interest > 0.3 && d.pd < 55;

  // --- state-specific motion
  let speed = 0;
  if (d.state === 'walk' && d.goal) {
    const gx = d.goal.x - d.x, gy = (d.goal.y - d.y) / SQ, gd = Math.hypot(gx, gy);
    const want = Math.atan2(gy, gx), diff = wrapA(want - d.heading);
    d.heading += clamp(diff, -3.5 * dt, 3.5 * dt);
    { const h = wrapA(d.heading), base = Math.abs(h) < Math.PI / 2 ? 0 : Math.PI, off = wrapA(h - base);
      if (Math.abs(off) > 0.75) d.heading = base + Math.sign(off) * 0.75; }
    speed = gd > 0.35 ? 3.0 * Math.max(0, Math.cos(diff)) : 0;
    if (gd <= 0.35 || d.t > 6) d.dur = 0;
  } else if (d.state === 'circle') {
    d.heading += 3.3 * dt * d.circDir;
    speed = 1.3;
  } else if (d.state === 'bark') {
    while (d.barks.length && d.t >= d.barks[0]) {
      d.barks.shift(); d.mouthT = 0.16;
      state.events.push({ type: 'bark', x: d.x, y: d.y });
      d.breathT = 0;
    }
  } else if (d.state === 'howl') {
    if (!d.howled && d.t > 0.7) { d.howled = true; state.events.push({ type: 'howl', x: d.x, y: d.y }); }
  } else if (d.state === 'stretch') {
    d.poseName = d.t < d.dur * 0.5 ? 'bow' : 'hstretch';
  } else if (d.state === 'shake') {
    if (!d.shook && d.t > 0.15) { spawnFlecks(d, 5 + Math.round(d.snow * 16)); d.snow = 0; d.shook = true; }
  }
  if (speed > 0) {
    d.x += Math.cos(d.heading) * speed * dt;
    d.y += Math.sin(d.heading) * speed * dt * SQ;
  }
  // tether
  const tx = d.x - d.ax, ty = (d.y - d.ay) / SQ, tl = Math.hypot(tx, ty);
  if (tl > 3.4) { d.x = d.ax + tx / tl * 3.4; d.y = d.ay + ty / tl * 3.4 * SQ; }
  d.speed = speed;
  d.move = lerp(d.move, speed > 0.1 ? 1 : 0, 1 - Math.exp(-dt * 8));
  d.gait += dt * Math.max(speed, d.state === 'circle' ? 1.6 : 0) * 2.8;

  if (d.t > d.dur && !FROZEN) nextState(d);

  // --- reactions
  if (d.barkDelay > 0) { d.barkDelay -= dt; if (d.barkDelay <= 0) startBark(d); }
  if (d.howlDelay > 0) { d.howlDelay -= dt; if (d.howlDelay <= 0) startHowl(d); }
  if (!FROZEN && !LYING(d.state) && d.state !== 'bark' && d.state !== 'howl' && rnd() < dt / 110) startBark(d);
  if (near && d.appr > 0.6 && rnd() < dt / 40) state.events.push({ type: 'whine', x: d.x, y: d.y });

  // snow settles on resting dogs
  if (LYING(d.state)) d.snow = Math.min(1, d.snow + dt * 0.006 * (0.3 + state.weather.snowfall + wind));

  // --- head: track the explorer, otherwise glance about
  d.idleT -= dt;
  if (d.idleT < 0) { d.idleT = rr(1.5, 4.5); d.idleLook = rnd() < 0.3 ? 0 : rr(-1, 1); }
  let lookTarget = d.idleLook;
  const aE = d.p.bend / 2;
  if (d.state === 'curl') lookTarget = 1.35;
  else if (d.state === 'howl' || d.state === 'stretch' || d.state === 'shake') lookTarget = 0;
  else if (d.pd < 55 && d.interest > 0.08 && d.state !== 'rest' && !FROZEN) {
    const rel = wrapA(Math.atan2(dyp, dxp) - d.heading - aE);
    lookTarget = clamp(rel, -1.45, 1.45);
    if (Math.abs(rel) > 1.25) {
    }
  }
  if (d.state === 'shake') lookTarget = Math.sin(d.t * 30) * 0.5;
  // keep the body side-on: upright dogs never face within ~60 deg of the camera axis
  // (head tracking turns the head, not the body); lying dogs ease toward the same limit.
  if (d.state !== 'walk' && d.state !== 'circle') {
    const h = wrapA(d.heading), base = Math.abs(h) < Math.PI / 2 ? 0 : Math.PI;
    const off = wrapA(h - base), lim = 0.5;
    if (Math.abs(off) > lim) {
      if (LYING(d.state)) d.heading -= Math.sign(off) * Math.min(Math.abs(off) - lim, dt * 1.5);
      else d.heading = base + Math.sign(off) * lim;
    }
  }
  d.neckYaw = lerp(d.neckYaw, lookTarget, 1 - Math.exp(-dt * (d.state === 'shake' ? 30 : 5)));

  // --- tail, ears, mouth
  const wagT = d.state === 'howl' || d.state === 'curl' ? 0 : near ? (d.appr > 0.5 ? 0.75 : 0.3) : d.state === 'walk' ? 0.2 : 0.06;
  d.wag = lerp(d.wag, wagT, 1 - Math.exp(-dt * 3));
  d.wagPh += dt * (8 + 7 * d.wag);
  d.tailYaw = Math.sin(d.wagPh) * d.wag;
  d.earT -= dt;
  if (d.earT < 0) { d.earT = rr(1.2, 5); d.earFlick = 0.16; }
  d.earFlick -= dt;
  const earBase = d.state === 'curl' || d.state === 'rest' ? 0.35 : d.state === 'howl' ? 0.5 : near ? 0 : clamp(wind * 0.6, 0, 0.5);
  d.earsBack = lerp(d.earsBack, earBase + (d.earFlick > 0 ? 0.7 : 0), 1 - Math.exp(-dt * 18));
  d.mouthT -= dt;
  let mouthTarget = 0;
  if (d.mouthT > 0) mouthTarget = 1;
  else if (d.state === 'howl' && d.t > 0.6 && d.t < d.dur - 0.4) mouthTarget = 0.7 + 0.15 * Math.sin(d.t * 3);
  else if (d.state === 'stand' && near) mouthTarget = 0.25 + 0.1 * Math.sin(d.t * 14); // panting
  d.mouth = lerp(d.mouth, mouthTarget, 1 - Math.exp(-dt * 22));
  d.shake = d.state === 'shake' ? Math.sin(Math.PI * clamp(d.t / d.dur, 0, 1)) : 0;

  // --- pose blend
  const tgt = POSE[d.poseName] || POSE.stand;
  const k = 1 - Math.exp(-dt * (d.state === 'bark' ? 7 : 3.6));
  for (const key in tgt) d.p[key] = lerp(d.p[key], tgt[key], key === 'bend' ? k * 0.7 : k);
  if (d.state === 'howl') d.p.neckP += Math.sin(d.t * 2.1) * 0.004;
  if (d.state === 'bark' && d.mouthT > 0) d.p.neckP = lerp(d.p.neckP, tgt.neckP - 0.25, 0.3);

  // --- breath vapour
  d.breathT -= dt;
  if (d.breathT <= 0 && d.tip && state.quality?.level !== 'low') {
    const busy = d.state === 'bark' || d.state === 'howl' || d.mouth > 0.2;
    d.breathT = busy ? rr(0.35, 0.6) : rr(1.4, 2.6);
    const a = state.wind.angle, ws = 2 + 9 * wind;
    puffs.push({ x: d.tip[0], y: d.tip[1], vx: Math.cos(a) * ws + rr(-0.5, 0.5), vy: Math.sin(a) * ws * SQ - 1.2,
      age: 0, life: rr(1.1, 1.8), r: LYING(d.state) ? 0.35 : 0.5 });
  }
}

function spawnFlecks(d, n) {
  for (let i = 0; i < n; i++) {
    const a = rr(0, TAU), v = rr(2, 6);
    flecks.push({ x: d.x + rr(-2, 2), y: d.y, h: rr(2.5, 5.5), vx: Math.cos(a) * v, vy: Math.sin(a) * v * SQ, vh: rr(1, 5), age: 0 });
  }
}

// 3D helpers for the dog skeleton (local: x forward, z to the dog's right, h up)
const v3 = (x, z, h) => ({ x, z, h });
const add = (a, b, k = 1) => v3(a.x + b.x * k, a.z + b.z * k, a.h + b.h * k);
const dir3 = (yaw, pitch) => v3(Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch));
function ik(R, T, a, b, bend) {
  let vx = T.x - R.x, vz = T.z - R.z, vh = T.h - R.h;
  let dd = Math.hypot(vx, vz, vh) || 1e-3;
  const maxd = (a + b) * 0.999;
  if (dd > maxd) { const k = maxd / dd; vx *= k; vz *= k; vh *= k; dd = maxd; }
  const ux = vx / dd, uz = vz / dd, uh = vh / dd;
  const dot = bend.x * ux + bend.z * uz + bend.h * uh;
  let px = bend.x - dot * ux, pz = bend.z - dot * uz, ph = bend.h - dot * uh;
  const pl = Math.hypot(px, pz, ph) || 1; px /= pl; pz /= pl; ph /= pl;
  const along = (a * a - b * b + dd * dd) / (2 * dd), hh = Math.sqrt(Math.max(0, a * a - along * along));
  return { knee: v3(R.x + ux * along + px * hh, R.z + uz * along + pz * hh, R.h + uh * along + ph * hh), foot: v3(R.x + vx, R.z + vz, R.h + vh) };
}

function capPath(ctx, a, b, ra, rb) {
  ctx.moveTo(a[0] + ra, a[1]); ctx.arc(a[0], a[1], ra, 0, TAU);
  ctx.moveTo(b[0] + rb, b[1]); ctx.arc(b[0], b[1], rb, 0, TAU);
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 1e-3 || L < Math.abs(ra - rb)) return;
  const nx = -dy / L, ny = dx / L;
  ctx.moveTo(a[0] - nx * ra, a[1] - ny * ra); ctx.lineTo(b[0] - nx * rb, b[1] - ny * rb);
  ctx.lineTo(b[0] + nx * rb, b[1] + ny * rb); ctx.lineTo(a[0] + nx * ra, a[1] + ny * ra); ctx.closePath();
}
function primPath(ctx, pr, grow) {
  if (pr.t === 'cap') capPath(ctx, pr.a, pr.b, pr.ra + grow, pr.rb + grow);
  else if (pr.t === 'circ') { ctx.moveTo(pr.a[0] + pr.ra + grow, pr.a[1]); ctx.arc(pr.a[0], pr.a[1], pr.ra + grow, 0, TAU); }
  else if (pr.t === 'tri') {
    const [p, q, r] = pr.pts;
    if (grow) { // fat outline for triangles: stroke instead
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(r[0], r[1]); ctx.closePath();
    } else { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(r[0], r[1]); ctx.closePath(); }
  }
}
function fillPrim(ctx, pr, ow, outline) {
  if (outline) {
    ctx.beginPath(); primPath(ctx, pr, ow * 0.8); ctx.fillStyle = INK; ctx.fill();
    if (pr.t === 'tri') { ctx.lineWidth = ow * 1.6; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  ctx.beginPath(); primPath(ctx, pr, 0); ctx.fillStyle = pr.fill; ctx.fill();
}

function drawDog(ctx, d) {
  const p = d.p, sz = d.look.size, L = d.look;
  const ch = Math.cos(d.heading), sh = Math.sin(d.heading);
  // local (x fwd, z right, h up) -> screen-world, scaled by this dog's size
  // mirror the skeleton so a curled dog always wraps with its head on the camera side
  const mz = ch > 0 ? -1 : 1;
  const W = q => [d.x + (q.x * ch - q.z * mz * sh) * sz, d.y + ((q.x * sh + q.z * mz * ch) * SQ - q.h) * sz];
  const depth = q => q.x * sh + q.z * mz * ch;
  const R = r => r * sz;
  const frontK = Math.abs(sh) * (1 - clamp(p.bend / 1.6, 0, 1));
  const owW = inkW(0.3);
  const dark = grey(L.dark), light = grey(L.light), mid = grey((L.dark + L.light) / 2);

  // spine as an arc (bend curls it into a ring when sleeping)
  const len = 5.3, dh = (p.shH - p.hipH), Lh = Math.sqrt(Math.max(1, len * len - dh * dh));
  const sp = []; let x = 0, z = 0;
  for (let k = 0; k <= 4; k++) {
    const s = k / 4;
    sp.push(v3(x, z, p.hipH + dh * s));
    const am = -p.bend / 2 + p.bend * (s + 0.125);
    x += Math.cos(am) * Lh / 4; z += Math.sin(am) * Lh / 4;
  }
  let cx = 0, cz = 0; for (const q of sp) { cx += q.x / 5; cz += q.z / 5; }
  const wob = Math.sin(state.time * 31) * 0.45 * d.shake;
  sp.forEach((q, k) => { q.x -= cx; q.z -= cz - wob * (k < 2 ? -1 : 1); });
  const a0 = -p.bend / 2, aE = p.bend / 2;
  const hip = sp[0], sho = sp[4];
  const fwd = a => v3(Math.cos(a), Math.sin(a), 0), side = a => v3(-Math.sin(a), Math.cos(a), 0);
  const up = v3(0, 0, 1);

  // neck, head, muzzle
  const nyaw = aE + d.neckYaw;
  const neckBase = add(sho, up, 0.25);
  const head = add(neckBase, dir3(nyaw, p.neckP - 0.3 * frontK * (d.state === 'howl' ? 0 : 1)), 2.1);
  const hd = dir3(nyaw, p.headP);
  const mBase = add(head, hd, 0.3), tip = add(head, hd, 1.5);
  const jawTip = add(head, dir3(nyaw, p.headP - d.mouth * 0.7), 1.3);
  const hs = side(nyaw), hf = fwd(nyaw);
  const ears = [-1, 1].map(e => {
    const base = add(add(head, up, 0.55), hs, e * 0.4);
    const t = add(add(base, up, 0.9 - 0.45 * d.earsBack), hf, -(0.1 + 0.75 * d.earsBack));
    return [W(add(base, hf, -0.34)), W(add(base, hf, 0.26)), W(t)];
  });

  // tail (husky: curled over the back when up)
  const tail = [add(add(hip, fwd(a0), -0.55), up, 0.55)];
  for (let k = 0; k < 3; k++) {
    const yaw = a0 + Math.PI + d.tailYaw * (1 + 0.5 * k) - p.bend * 0.36 * (k + 1) - clamp((3.2 - p.shH) / 2, 0, 1) * (p.bend < 1.2 ? 0.45 * (k + 1) : 0);
    const pitch = lerp(-0.9 - 0.25 * k, 1.0 + 0.95 * k, p.tailUp);
    const n = add(tail[k], dir3(yaw, pitch), 1.05);
    n.h = Math.max(n.h, 0.3);
    tail.push(n);
  }

  // legs (2-bone IK; front elbows bend back, hind stifles forward)
  const legs = [];
  const g = d.gait, mv = d.move;
  for (const [front, e, ph] of [[1, 1, 0], [1, -1, Math.PI], [0, 1, Math.PI], [0, -1, 0]]) {
    const a = front ? aE : a0, f = fwd(a), sdv = side(a);
    const root = front ? add(add(add(sho, sdv, e * (0.5 + 0.3 * frontK)), up, -Math.min(0.9, sho.h - 0.3)), f, 0.25)
      : add(add(add(hip, sdv, e * (0.55 + 0.3 * frontK)), up, -Math.min(0.5, hip.h - 0.3)), f, -0.3);
    const off = Math.sin(g + ph) * 0.9 * mv, lift = Math.max(0, Math.cos(g + ph)) * 0.8 * mv;
    const reach = front ? p.fPaw : p.hPaw;
    const T = v3(root.x + f.x * (reach + off), root.z + f.z * (reach + off) + e * 0.08, (front ? p.fPawH : p.hPawH) + lift + 0.27);
    const la = front ? 1.95 : 2.05, lb = front ? 1.9 : 2.0;
    const s = ik(root, T, la, lb, front ? v3(-f.x, -f.z, 0.1) : v3(f.x, f.z, 0.25));
    legs.push({ front, root, ...s, f, dep: depth(root) });
  }
  const bodyDep = 0;

  // primitives
  const bodyR = [0.95, 1.0, 1.1, 1.22, 1.3].map(r => R(r * (1 + 0.14 * d.shake)));
  const body = [];
  for (let k = 0; k < 4; k++) body.push({ t: 'cap', a: W(sp[k]), b: W(sp[k + 1]), ra: bodyR[k], rb: bodyR[k + 1], fill: light });
  body.push({ t: 'circ', a: W(add(add(sho, up, -0.45), fwd(aE), 0.2)), ra: R(1.38 * (1 + 0.22 * frontK)), fill: light });
  const sitK = clamp((p.shH - p.hipH - 1.2) / 2.2, 0, 1);
  const saddle = [];
  const lowK = clamp((3.2 - p.shH) / 2, 0, 1);
  for (let k = 0; k < 4; k++) {
    const A = W(sp[k]), B = W(sp[k + 1]);
    const sw = lerp(0.64, 0.5, lowK), sy = lerp(0.34, 0.5, lowK);
    saddle.push({ t: 'cap', a: [A[0], A[1] - bodyR[k] * sy], b: [B[0], B[1] - bodyR[k + 1] * sy], ra: bodyR[k] * sw, rb: bodyR[k + 1] * sw, fill: dark });
  }
  const legPrims = l => {
    const Rt = W(l.root), K = W(l.knee), F = W(l.foot), far = l.dep < bodyDep;
    const col = far ? grey(L.light * 0.78) : light;
    const th = l.front ? [0.42, 0.3, 0.27] : [0.62 + 0.45 * sitK, 0.36, 0.27];
    return [
      { t: 'cap', a: Rt, b: K, ra: R(th[0]), rb: R(th[1]), fill: l.front ? col : (far ? grey(L.dark * 1.05) : mid) },
      { t: 'cap', a: K, b: F, ra: R(th[1]), rb: R(th[2]), fill: col },
      { t: 'cap', a: F, b: W(add(l.foot, l.f, 0.35)), ra: R(0.3), rb: R(0.28), fill: col },
    ];
  };
  const curled = p.bend > 1.6;
  const showLeg = l => !curled || (l.front && l.dep >= bodyDep);
  const farLegs = legs.filter(l => l.dep < bodyDep && showLeg(l)).flatMap(legPrims);
  const nearLegs = legs.filter(l => l.dep >= bodyDep && showLeg(l)).flatMap(legPrims);
  const neck = { t: 'cap', a: W(neckBase), b: W(head), ra: R(0.92), rb: R(0.76), fill: mid };
  const H = W(head);
  const skull = { t: 'circ', a: H, ra: R(0.88), fill: light };
  const muzzle = { t: 'cap', a: W(mBase), b: W(tip), ra: R(0.5), rb: R(0.3), fill: light };
  const headPr = [skull, muzzle];
  if (d.mouth > 0.12) {
    headPr.unshift({ t: 'tri', pts: [W(mBase), W(add(tip, hd, -0.15)), W(jawTip)], fill: '#3a3a3a' });
    headPr.splice(1, 0, { t: 'cap', a: W(mBase), b: W(jawTip), ra: R(0.34), rb: R(0.22), fill: grey(L.light - 18) });
  }
  const Tp = W(tip);
  const cap = { t: 'circ', a: [H[0] - (Tp[0] - H[0]) * 0.14, H[1] - R(0.36)], ra: R(0.64), fill: dark };
  const earPr = ears.map(pts => ({ t: 'tri', pts, fill: dark }));
  const tailPr = [];
  const tr = [0.55, 0.66, 0.55, 0.35];
  const curlK = clamp((p.bend - 1.2) / 1.5, 0, 1);
  for (let k = 0; k < 3; k++) tailPr.push({ t: 'cap', a: W(tail[k]), b: W(tail[k + 1]), ra: R(tr[k] * (1 + 0.4 * curlK)), rb: R(tr[k + 1] * (1 + 0.5 * curlK)), fill: k === 2 ? light : dark });

  // 1) one ink silhouette under everything
  const all = [...farLegs, ...body, neck, ...headPr, ...tailPr, ...nearLegs];
  ctx.beginPath();
  for (const pr of all) if (pr.t !== 'tri') primPath(ctx, pr, owW);
  ctx.fillStyle = INK; ctx.fill('nonzero');
  ctx.beginPath(); for (const pr of earPr) primPath(ctx, pr, 0);
  ctx.lineWidth = owW * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();

  // 2) fills, back to front
  for (const pr of farLegs) fillPrim(ctx, pr, owW, false);
  const groups = [
    { dep: bodyDep, draw: () => {
      for (const pr of body) fillPrim(ctx, pr, owW, false);
      for (const pr of saddle) fillPrim(ctx, pr, owW, false);
      for (const pr of nearLegs) fillPrim(ctx, pr, owW * 0.7, true);
    } },
    { dep: curlK > 0.5 ? 50 : depth(head) + 0.01, draw: () => {
      fillPrim(ctx, neck, owW, false);
      for (const pr of earPr) fillPrim(ctx, pr, owW * 0.7, true);
      for (const pr of headPr) fillPrim(ctx, pr, owW * 0.8, true);
      fillPrim(ctx, skull, owW, false);
      fillPrim(ctx, muzzle, owW, false);
      fillPrim(ctx, cap, owW, false);
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath(); ctx.arc(Tp[0], Tp[1], R(0.24), 0, TAU); ctx.fill();
      if (depth(hd) > -0.6) {
        const e = W(add(add(add(head, hf, 0.45), up, 0.18), hs, (depth(hs) > 0 ? 1 : -1) * 0.4));
        ctx.beginPath(); ctx.arc(e[0], e[1], R(0.15), 0, TAU); ctx.fill();
      }
    } },
    { dep: curlK > 0.5 ? 60 : depth(tail[2]), draw: () => { for (const pr of tailPr) fillPrim(ctx, pr, owW * 0.8, true); } },
  ].sort((a, b) => a.dep - b.dep);
  for (const gr of groups) gr.draw();

  d.tip = Tp;
  d.collar = W(add(neckBase, hf, 0.3));
}

function drawChain(ctx, d) {
  if (!d.collar) return;
  const ax = d.ax, ay = d.ay, c = d.collar;
  const mx = (ax + c[0]) / 2, my = Math.max(ay, c[1]) + 0.8;
  ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.quadraticCurveTo(mx, my, ax, ay);
  ctx.lineWidth = inkW(0.18); ctx.strokeStyle = 'rgba(55,55,57,0.85)'; ctx.stroke();
}

// ===================================================================== GROUND ==============
let groundCv = null;
const GS = 4; // cache px per world px
let shadowSprite = null;

function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const SHX = 0.6, SHY = 0.36;
function shadowPt(P, lx, ly, h) { const g = P(lx, ly, 0); return [g[0] + h * SHX, g[1] + h * SHY]; }

function buildGround() {
  const w = (BOUNDS.x1 - BOUNDS.x0), h = (BOUNDS.y1 - BOUNDS.y0);
  groundCv = document.createElement('canvas');
  groundCv.width = w * GS; groundCv.height = h * GS;
  const g = groundCv.getContext('2d');
  g.scale(GS, GS); g.translate(-BOUNDS.x0, -BOUNDS.y0);
  const R = mulberry(4242);

  // soft cast shadows, rendered small and blurred by multi-tap, then scaled up
  const sc = document.createElement('canvas');
  sc.width = w; sc.height = h;
  const s = sc.getContext('2d');
  s.translate(-BOUNDS.x0, -BOUNDS.y0);
  const { Wr, He, Ws, Hr, L2 } = T;
  const tentPts = [];
  for (const sd of [-1, 1]) for (const ly of [-L2, L2]) {
    tentPts.push(shadowPt(projT, sd * Ws, ly, 0), shadowPt(projT, sd * Wr, ly, He));
  }
  tentPts.push(shadowPt(projT, 0, L2, Hr + 1), shadowPt(projT, 0, -L2, Hr + 1));
  const sledPts = [];
  for (const [x, y, hh] of [[-12.6, -3.6, 0], [13, -3.6, 0], [13, 3.6, 0], [-12.6, 3.6, 0], [-11, -3.4, 9.5], [-11, 3.4, 9.5], [9.4, -3.4, 6.7], [9.4, 3.4, 6.7], [-13.1, 0, 8.4], [-5, 0, 8.4]]) sledPts.push(shadowPt(projS, x, y, hh));
  s.fillStyle = 'rgba(0,0,0,0.1)';
  for (let ox = -1.5; ox <= 1.5; ox += 0.75) for (let oy = -1.5; oy <= 1.5; oy += 0.75) {
    for (const H of [hull(tentPts), hull(sledPts)]) {
      s.beginPath(); H.forEach((p, i) => (i ? s.lineTo(p[0] + ox, p[1] + oy) : s.moveTo(p[0] + ox, p[1] + oy))); s.closePath(); s.fill();
    }
  }
  // tint the shadow mask grey and lay it down
  s.globalCompositeOperation = 'source-in';
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.fillStyle = 'rgb(116,120,126)'; s.fillRect(0, 0, w, h);
  g.save(); g.globalAlpha = 0.42; g.imageSmoothingEnabled = true;
  g.drawImage(sc, BOUNDS.x0, BOUNDS.y0, w, h); g.restore();

  // trampled snow around the camp: faint grey patches edged with stipple
  const blob = (cx, cy, rx, ry, n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, k = 0.75 + 0.35 * R();
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  };
  const patches = [blob(1349, 1559, 9, 4.5, 14), blob(1330, 1568, 20, 6, 18), blob(1312, 1563, 8, 4, 12)];
  for (const pts of patches) {
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    g.fillStyle = 'rgba(160,163,167,0.06)'; g.fill();
    g.fillStyle = 'rgba(70,70,72,0.45)';
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      for (let t = 0; t < 1; t += 0.5) if (R() < 0.45) g.fillRect(lerp(a[0], b[0], t) - 0.1, lerp(a[1], b[1], t) - 0.1, 0.22, 0.22);
    }
  }
  // old boot prints between tent door, sled and the spawn
  const path = [[1340, 1556], [1346, 1561], [1354, 1563], [1362, 1566]];
  const path2 = [[1336, 1557], [1326, 1563], [1316, 1567], [1309, 1571]];
  for (const pp of [path, path2]) {
    for (let i = 0; i < pp.length - 1; i++) {
      const [ax, ay] = pp[i], [bx, by] = pp[i + 1];
      const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
      for (let t = 0; t < L; t += 2.2) {
        const side = (Math.round(t / 2.2) % 2 ? 1 : -1) * 0.7;
        const x = lerp(ax, bx, t / L) + nx * side, y = lerp(ay, by, t / L) + ny * side * SQ;
        g.fillStyle = 'rgba(120,123,128,0.32)';
        g.beginPath(); g.ellipse(x, y, 0.55, 0.32, Math.atan2(by - ay, bx - ax), 0, TAU); g.fill();
      }
    }
  }
  // sled runner tracks coming in from the west across the snow
  for (const sd of [-1, 1]) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const lx = -12 - i * 2.4, bendY = (i * 2.4) * (i * 2.4) * 0.0016;
      const [x, y] = projS(lx, sd * 3.3 + bendY, 0);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    const grad = g.createLinearGradient(SLED.x - 12, 0, SLED.x - 105, 0);
    grad.addColorStop(0, 'rgba(118,121,126,0.4)'); grad.addColorStop(1, 'rgba(118,121,126,0)');
    g.strokeStyle = grad; g.lineWidth = 0.45; g.stroke();
  }
  // paw-churned snow along the old dog track between the runners and around the picket
  for (let i = 0; i < 70; i++) {
    const lx = -14 - R() * 80, ly = (R() - 0.5) * 4;
    const [x, y] = projS(lx, ly + lx * lx * 0.0016, 0);
    g.fillStyle = `rgba(110,113,118,${0.35 * (1 + lx / 100)})`;
    g.fillRect(x, y, 0.35, 0.25);
  }
  for (const d of dogs) {
    // paw-print trails circling the stake
    g.fillStyle = 'rgba(100,103,108,0.45)';
    for (let loop = 0; loop < 3; loop++) {
      const r0 = 1.6 + R() * 2.6, a0 = R() * TAU, span = 2 + R() * 3;
      for (let t = 0; t < span; t += 0.42) {
        const a = a0 + t, r = r0 + Math.sin(t * 1.3 + loop) * 0.5;
        const x = d.ax + Math.cos(a) * r, y = d.ay + Math.sin(a) * r * SQ, side = (Math.round(t / 0.42) % 2 ? 0.35 : -0.35);
        g.beginPath(); g.ellipse(x - Math.sin(a) * side, y + Math.cos(a) * side * SQ, 0.22, 0.16, 0, 0, TAU); g.fill();
      }
    }
    g.beginPath(); g.ellipse(d.ax + 0.5, d.ay + 0.5, 4.4, 2.6, 0, 0, TAU);
    g.fillStyle = 'rgba(160,163,167,0.06)'; g.fill();
  }
  // picket line and its two stakes
  g.beginPath(); g.moveTo(PICKET.ax, PICKET.ay); g.quadraticCurveTo((PICKET.ax + PICKET.bx) / 2, (PICKET.ay + PICKET.by) / 2 + 0.6, PICKET.bx, PICKET.by);
  g.strokeStyle = 'rgba(48,48,50,0.9)'; g.lineWidth = 0.28; g.stroke();
  for (const [x, y] of [[PICKET.ax, PICKET.ay], [PICKET.bx, PICKET.by]]) {
    g.beginPath(); g.moveTo(x, y + 0.2); g.lineTo(x - 0.2, y - 1.8); g.strokeStyle = INK; g.lineWidth = 0.55; g.stroke();
  }
  // stipple at the tent pegs
  for (const gd of guyDefs(null)) {
    const [x, y] = projT(gd.p[0], gd.p[1], 0);
    g.fillStyle = 'rgba(70,70,72,0.6)';
    for (let i = 0; i < 5; i++) g.fillRect(x + (R() - 0.5) * 2.4, y + (R() - 0.3) * 1.2, 0.22, 0.22);
  }

  // a soft round shadow sprite for the dogs
  shadowSprite = document.createElement('canvas');
  shadowSprite.width = 32; shadowSprite.height = 32;
  const ss = shadowSprite.getContext('2d');
  const rg = ss.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(110,114,120,0.5)'); rg.addColorStop(0.6, 'rgba(110,114,120,0.3)'); rg.addColorStop(1, 'rgba(110,114,120,0)');
  ss.fillStyle = rg; ss.fillRect(0, 0, 32, 32);
}

// ===================================================================== HOOKS ===============
export function init() {
  for (let i = 0; i < 4; i++) dogs.push(makeDog(i));
  const wl = windLocal(TENT.yaw);
  drift[-1] = clamp(0.35 + wl.x * 0.9, 0.15, 1);
  drift[1] = clamp(0.35 - wl.x * 0.9, 0.15, 1);
  buildGround();
}

function onScreen(m = 30) {
  const r = visibleRect(m);
  return !(r.x1 < BOUNDS.x0 || r.x0 > BOUNDS.x1 || r.y1 < BOUNDS.y0 || r.y0 > BOUNDS.y1);
}

export function update(dt) {
  const night = state.lighting?.night || 0;
  tentNight = night;
  if (night > 0 && state.lights) state.lights.push({ x: TENT.x, y: TENT.y - 2, r: 38, intensity: 0.9 * night });
  const w = state.wind;
  const shelter = terrain.shelterAt ? terrain.shelterAt(TENT.x, TENT.y) || 0 : 0;
  gust = clamp(w.gust || 0, 0, 1);
  wind = clamp(w.speed * (1 - 0.5 * shelter) + gust * 0.3, 0, 1.3);
  windPh += dt * (0.5 + 3.4 * wind + 2 * gust);
  // drifts slowly build on whichever side faces the wind
  const wl = windLocal(TENT.yaw);
  for (const sd of [-1, 1]) {
    const target = clamp(0.2 + -sd * wl.x * (0.4 + wind), 0.1, 1);
    drift[sd] += (target - drift[sd]) * Math.min(1, dt * 0.01);
  }

  // group howl: one starts, the others join
  howlTimer -= dt;
  if (howlTimer < 0 && !FROZEN) {
    howlTimer = rr(45, 95);
    const order = dogs.slice().sort(() => rnd() - 0.5);
    startHowl(order[0]);
    order.slice(1).forEach((d, k) => { d.howlDelay = 0.8 + k * rr(0.4, 0.9) + rr(0, 0.6); });
  }
  // the explorer walking up sets them off
  const pl = state.player, pd = Math.hypot(pl.x - (PICKET.ax + PICKET.bx) / 2, (pl.y - PICKET.ay) / SQ);
  if (!playerNear && pd < 34 && !FROZEN) {
    playerNear = true;
    for (const d of dogs) if (rnd() < 0.6) d.barkDelay = rr(0.2, 1.2);
  } else if (playerNear && pd > 62) playerNear = false;

  for (const d of dogs) updateDog(d, dt);
  // dogs keep a little personal space
  for (let i = 0; i < dogs.length; i++) for (let j = i + 1; j < dogs.length; j++) {
    const A = dogs[i], B = dogs[j], dx = B.x - A.x, dy = (B.y - A.y) / SQ, dd = Math.hypot(dx, dy);
    if (dd < 5 && dd > 1e-3) {
      const push = (5 - dd) * 0.5 * Math.min(1, dt * 4), ux = dx / dd, uy = dy / dd;
      A.x -= ux * push; A.y -= uy * push * SQ; B.x += ux * push; B.y += uy * push * SQ;
    }
  }

  for (let i = puffs.length - 1; i >= 0; i--) {
    const q = puffs[i]; q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98;
    if (q.age > q.life) puffs.splice(i, 1);
  }
  for (let i = flecks.length - 1; i >= 0; i--) {
    const f = flecks[i]; f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.h += f.vh * dt; f.vh -= 22 * dt;
    if (f.h < 0 || f.age > 2) flecks.splice(i, 1);
  }
}

export function drawGround(ctx) {
  if (!groundCv || !onScreen()) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(groundCv, BOUNDS.x0, BOUNDS.y0, BOUNDS.x1 - BOUNDS.x0, BOUNDS.y1 - BOUNDS.y0);
  for (const d of dogs) {
    const lying = d.p.hipH < 2.5, wdt = (lying ? 10 : 8.5) * d.look.size, hgt = (lying ? 4.2 : 3.2) * d.look.size;
    ctx.drawImage(shadowSprite, d.x - wdt / 2 + 1.3, d.y - hgt / 2 + 0.8, wdt, hgt);
  }
}

// --- sprite caches: each actor is rendered into a small canvas at screen resolution and
// refreshed at a modest rate (wind motion is slow), then blitted every frame.
const HZ = { high: [15, 8, 20], medium: [12, 6, 15], low: [8, 4, 10] };
function boxOf(P, pts, m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [lx, ly, h] of pts) { const [x, y] = P(lx, ly, h); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
}
const corners = (xs, ys, hs) => { const o = []; for (const x of xs) for (const y of ys) for (const h of hs) o.push([x, y, h]); return o; };
const TENT_BOX = boxOf(projT, corners([-21, 21], [-23.5, 23.5], [0, 14]), 2.5);
const SLED_BOX = boxOf(projS, corners([-14.5, 16], [-4.5, 4.5], [0, 10]), 2);
const sprites = new Map();
function drawCached(ctx, key, box, hz, render, dx = 0, dy = 0, stamp = 0) {
  const s = zoom() * (state.view.dpr || 1);
  let sp = sprites.get(key);
  if (!sp) { sp = { cv: document.createElement('canvas'), t: -1e9, s: 0 }; sprites.set(key, sp); }
  const now = performance.now() / 1000;
  if (Math.abs(s - sp.s) / s > 0.02 || now - sp.t >= 1 / hz || Math.abs(stamp - (sp.stamp || 0)) > 0.03) {
    const w = Math.ceil((box.x1 - box.x0) * s) + 2, h = Math.ceil((box.y1 - box.y0) * s) + 2;
    if (sp.cv.width !== w || sp.cv.height !== h) { sp.cv.width = w; sp.cv.height = h; }
    const c = sp.cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.setTransform(s, 0, 0, s, -box.x0 * s, -box.y0 * s);
    render(c);
    Object.assign(sp, { s, t: now, x0: box.x0, y0: box.y0, w: w / s, h: h / s, dx, dy, stamp });
  }
  ctx.drawImage(sp.cv, sp.x0 + dx - sp.dx, sp.y0 + dy - sp.dy, sp.w, sp.h);
}
function dogBox(d) {
  const r = 9.5 * d.look.size;
  return { x0: d.x - r, y0: d.y - 12 * d.look.size, x1: d.x + r, y1: d.y + 4.5 * d.look.size };
}

export function drawables() {
  if (!onScreen()) return [];
  const hz = HZ[state.quality?.level] || HZ.high;
  const out = [
    { x: TENT.x, y: TENT.y + 3, draw: ctx => drawCached(ctx, 'tent', TENT_BOX, hz[0], drawTent, 0, 0, tentNight) },
    { x: SLED.x, y: SLED.y + 1, draw: ctx => drawCached(ctx, 'sled', SLED_BOX, hz[1], drawSled) },
  ];
  for (const d of dogs) out.push({ x: d.x, y: d.y, draw: ctx => {
    drawChain(ctx, d);
    drawCached(ctx, 'dog' + d.i, dogBox(d), hz[2], c => drawDog(c, d), d.x, d.y);
  } });
  return out;
}

export function drawSky(ctx) {
  if (!onScreen()) return;
  for (const q of puffs) {
    const t = q.age / q.life, r = q.r + t * 1.6, a = (1 - t) * 0.55;
    ctx.beginPath(); ctx.arc(q.x + 0.15, q.y + 0.15, r * 1.25, 0, TAU);
    ctx.fillStyle = `rgba(140,145,150,${a * 0.16})`; ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU);
    ctx.fillStyle = `rgba(253,253,253,${a})`; ctx.fill();
  }
  for (const f of flecks) {
    ctx.beginPath(); ctx.arc(f.x, f.y - f.h, 0.28, 0, TAU);
    ctx.fillStyle = '#fbfbfb'; ctx.fill();
    ctx.lineWidth = inkW(0.08); ctx.strokeStyle = 'rgba(110,110,112,0.6)'; ctx.stroke();
  }
  if (state.debug) {
    ctx.strokeStyle = 'rgba(255,0,0,0.7)'; ctx.lineWidth = 0.3;
    for (const o of campObstacles()) { ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.stroke(); }
  }
}

// Simple circles the explorer can steer around (lead wires collision later).
export function campObstacles() {
  const out = [];
  const [tx, ty] = projT(0, 0, 0);
  out.push({ x: tx, y: ty - 2, r: 11 }, { x: projT(0, 7, 0)[0], y: projT(0, 7, 0)[1], r: 9 }, { x: projT(0, -7, 0)[0], y: projT(0, -7, 0)[1], r: 9 });
  for (const lx of [-9, -2, 5, 11]) { const [x, y] = projS(lx, 0, 0); out.push({ x, y, r: 4.2 }); }
  for (const d of dogs) out.push({ x: d.x, y: d.y, r: 2.4 });
  return out;
}
export { dogs as campDogs };
