// The weather director. Owns state.wind and state.weather and evolves them through
// spells: calm -> building -> windy (gust fronts) -> storm rolls in -> whiteout peak ->
// clearing -> ...  ?weather=calm|wind|storm holds one spell (for captures); cycle is default.
//
// Gust fronts are real things in the world: a line perpendicular to the wind that
// travels downwind across the map. Spindrift, haze and the falling snow all read
// gustAt(x, y), so you see the wave of blowing snow crossing the land before it hits.
import { state } from '../state.js';
import * as terrain from '../world/terrain.js';

const P = state.params;
export const mode = ['calm', 'wind', 'storm', 'cycle'].includes(P.get('weather')) ? P.get('weather') : 'cycle';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = v => Math.max(0, Math.min(1, v));

// Targets for each spell. rate = how fast values chase targets (units / s).
const SPELLS = {
  calm:    { wind: [0.08, 0.2],  snow: [0.12, 0.3],  white: 0,    gustEvery: [16, 30], dur: [25, 45], rate: 0.04 },
  build:   { wind: [0.4, 0.55],  snow: [0.3, 0.5],   white: 0,    gustEvery: [9, 14],  dur: [14, 22], rate: 0.035 },
  windy:   { wind: [0.6, 0.78],  snow: [0.35, 0.55], white: 0,    gustEvery: [5, 9],   dur: [30, 50], rate: 0.05 },
  stormIn: { wind: [0.9, 1],     snow: [0.9, 1],     white: 0.9,  gustEvery: [3, 5],   dur: [10, 11], rate: 0.1 },
  storm:   { wind: [0.88, 1],    snow: [0.9, 1],     white: 0.92, gustEvery: [3, 6],   dur: [22, 38], rate: 0.1 },
  clear:   { wind: [0.45, 0.6],  snow: [0.3, 0.45],  white: 0,    gustEvery: [6, 10],  dur: [12, 16], rate: 0.075 },
};
const NEXT = { calm: () => 'build', build: () => 'windy', windy: () => (Math.random() < 0.6 ? 'stormIn' : 'calm'),
  stormIn: () => 'storm', storm: () => 'clear', clear: () => (Math.random() < 0.5 ? 'windy' : 'calm') };
const FIXED = { calm: 'calm', wind: 'windy', storm: 'storm' };

const d = {
  spell: 'windy', left: 30, target: { wind: 0.5, snow: 0.5, white: 0 }, rate: 0.05,
  nextGust: 0.6, baseAngle: state.wind.angle, fronts: [],
  shelter: 0,     // smoothed state.player.sheltered (relief arrives within ~1 s)
  hitShake: 0,    // 1 -> 0 after a gust front hits the explorer
  sweep: 1,       // 0..1 how far a rolling-in storm has swept across the screen
  storminess: 0,  // smoothed 0..1 overall severity
  quality: state.params.has('wxq') ? Math.max(0.3, Math.min(1, parseFloat(state.params.get('wxq')) || 1)) : 1,
};
export const director = d;

function enter(name, instant = false) {
  const s = SPELLS[name];
  d.spell = name;
  d.left = rand(...s.dur);
  d.rate = s.rate;
  d.target = { wind: rand(...s.wind), snow: rand(...s.snow), white: s.white };
  d.gustEvery = s.gustEvery;
  if (name === 'stormIn') d.sweep = 0;
  if (instant) {
    state.wind.speed = d.target.wind;
    state.weather.snowfall = d.target.snow;
    state.weather.whiteout = d.target.white;
    d.sweep = 1;
  }
  state.weather.phase = name;
}

export function init() {
  const has = k => P.has(k);
  if (mode !== 'cycle') {
    enter(FIXED[mode], true);
    // Explicit URL values win over the spell's defaults.
    if (has('wind')) d.target.wind = state.wind.speed = clamp01(parseFloat(P.get('wind')));
    if (has('snow')) d.target.snow = state.weather.snowfall = clamp01(parseFloat(P.get('snow')));
    if (has('whiteout')) d.target.white = state.weather.whiteout = clamp01(parseFloat(P.get('whiteout')));
  } else {
    // Pick the spell that matches the starting values, but keep those values.
    const w = state.wind.speed, wo = state.weather.whiteout;
    const start = wo > 0.5 ? 'storm' : wo > 0.05 ? 'stormIn' : w > 0.58 ? 'windy' : w < 0.25 ? 'calm' : 'build';
    enter(start);
    if (has('wind')) d.target.wind = state.wind.speed;
    if (has('whiteout')) d.target.white = state.weather.whiteout;
    if (has('snow')) d.target.snow = state.weather.snowfall;
    if (start === 'stormIn') d.sweep = clamp01(wo / 0.9);
  }
  d.storminess = severity();
  state.weather.ctl = {
    // For captures: NAS.weather.ctl.gust(60) puts a full-strength front 60px upwind of the explorer.
    gust: (upwind = null) => { spawnFront(true, upwind); d.fronts[d.fronts.length - 1].age = 1; },
    spell: name => enter(name),
  };
}

function severity() {
  return clamp01(Math.max(state.weather.whiteout, (state.wind.speed - 0.3) / 0.7 * 0.75 + state.weather.snowfall * 0.15));
}

// --- gust fronts ---------------------------------------------------------------------
// Along-wind coordinate of a world point.
const along = (x, y, c, s) => x * c + y * s;
const across = (x, y, c, s) => -x * s + y * c;

// upwind: optional distance (world px) upwind of the explorer to place the front at.
function spawnFront(force = false, upwind = null) {
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a);
  const { w, h } = state.view, z = state.cam.zoom || 1;
  const reach = Math.hypot(w, h) / 2 / z;
  const strength = force ? 1 : clamp01(rand(0.45, 1) * (0.5 + state.wind.speed * 0.7));
  d.fronts.push({
    pos: upwind !== null ? along(state.player.x, state.player.y, c, s) - upwind
      : along(state.cam.x, state.cam.y, c, s) - reach - 40,  // just upwind of the screen
    speed: rand(55, 85) * (0.75 + state.wind.speed * 0.5),
    strength,
    tail: rand(70, 140),
    phase: Math.random() * 100,
    bend: rand(10, 30),
    age: 0,
  });
}

// Along-wind position of a front's (bent, ragged) leading edge at across-wind coord v.
export function frontU(f, v) {
  return f.pos + Math.sin(v * 0.012 + f.phase) * f.bend + Math.sin(v * 0.031 + f.phase * 2) * f.bend * 0.4
    + Math.sin(v * 0.11 + f.phase * 5) * 1.6;
}
export const frontFade = f => Math.min(1, f.age / 0.5) * (f.dying ? Math.max(0, 1 - f.dying) : 1);

// 0..~1 gust intensity at a world point from all active fronts.
export function gustAt(x, y) {
  if (!d.fronts.length) return 0;
  const a = state.wind.angle, c = Math.cos(a), s = Math.sin(a);
  const u = along(x, y, c, s), v = across(x, y, c, s);
  let g = 0;
  for (const f of d.fronts) {
    const k = frontU(f, v) - u; // >0: the front has already passed this point
    // Hard leading edge (nothing, then everything), long trailing tail.
    const shape = k < 0 ? Math.exp(-(k * k) / 25) : Math.exp(-k / f.tail);
    const lateral = 0.65 + 0.35 * Math.sin(v * 0.02 + f.phase * 3);
    g += f.strength * shape * lateral * fade(f);
  }
  return Math.min(1.2, g);
}
const fade = frontFade;

// Effective wind 0..~1.4 at a point, before shelter.
export function windAt(x, y) { return state.wind.speed + gustAt(x, y) * (0.35 + state.wind.speed * 0.4); }

// gustAt() sampled once per frame on a 16x9 grid over the screen; particles read this.
const GW = 16, GH = 9;
const gg = new Float32Array(GW * GH);
const ggR = { x0: 0, y0: 0, sx: 1, sy: 1 };
function refreshGustGrid() {
  const z = state.cam.zoom || 1, { w, h } = state.view;
  const hw = w / 2 / z + 20, hh = h / 2 / z + 20;
  ggR.x0 = state.cam.x - hw; ggR.y0 = state.cam.y - hh;
  ggR.sx = (2 * hw) / (GW - 1); ggR.sy = (2 * hh) / (GH - 1);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++)
    gg[j * GW + i] = d.fronts.length ? gustAt(ggR.x0 + i * ggR.sx, ggR.y0 + j * ggR.sy) : 0;
}
// Bilinear lookup of the gust grid at a world point.
export function gustFast(x, y) {
  if (!d.fronts.length) return 0;
  let fx = (x - ggR.x0) / ggR.sx, fy = (y - ggR.y0) / ggR.sy;
  fx = Math.max(0, Math.min(GW - 1.001, fx)); fy = Math.max(0, Math.min(GH - 1.001, fy));
  const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * GW + i;
  const a = gg[k] + (gg[k + 1] - gg[k]) * tx, b = gg[k + GW] + (gg[k + GW + 1] - gg[k + GW]) * tx;
  return a + (b - a) * ty;
}
export function windFast(x, y) { return state.wind.speed + gustFast(x, y) * (0.35 + state.wind.speed * 0.4); }

// --- update ---------------------------------------------------------------------------
const approach = (v, t, r) => (v < t ? Math.min(t, v + r) : Math.max(t, v - r));
let tAccum = 0;

export function update(dt) {
  tAccum += dt;
  const W = state.wind, Wx = state.weather;

  if (mode === 'cycle') {
    d.left -= dt;
    if (d.left <= 0) enter(NEXT[d.spell]());
  }

  // Ease toward the spell's targets, with slow breathing so nothing is ever static.
  const breathe = Math.sin(tAccum * 0.23) * 0.5 + Math.sin(tAccum * 0.071 + 1.7) * 0.5;
  const tw = clamp01(d.target.wind + breathe * 0.06);
  W.speed = approach(W.speed, tw, d.rate * dt);
  Wx.snowfall = approach(Wx.snowfall, clamp01(d.target.snow + breathe * 0.05), d.rate * dt);
  const tWhite = d.target.white > 0 ? clamp01(d.target.white + breathe * 0.05) : 0;
  Wx.whiteout = approach(Wx.whiteout, tWhite, (d.spell === 'stormIn' ? 0.25 : d.spell === 'clear' ? 0.08 : 0.05) * dt);
  d.sweep = d.spell === 'stormIn' ? Math.min(1, d.sweep + dt / 4) : 1;

  // Direction wanders slowly around its base, a little more in storms.
  W.angle = d.baseAngle + Math.sin(tAccum * 0.031) * 0.22 + Math.sin(tAccum * 0.013 + 2) * 0.15;

  // Gust fronts.
  d.nextGust -= dt;
  if (d.nextGust <= 0) {
    if (W.speed > 0.12 || Math.random() < 0.3) spawnFront();
    d.nextGust = rand(...d.gustEvery);
  }
  const a = W.angle, c = Math.cos(a), s = Math.sin(a);
  const { w, h } = state.view, z = state.cam.zoom || 1;
  const reach = Math.hypot(w, h) / 2 / z;
  const camU = along(state.cam.x, state.cam.y, c, s);
  for (const f of d.fronts) {
    f.age += dt;
    f.pos += f.speed * dt;
    if (f.pos - f.tail * 3 > camU + reach) f.dying = (f.dying || 0) + dt;
  }
  d.fronts = d.fronts.filter(f => !(f.dying > 1) && f.age < 40);

  // A front hitting the explorer: a jolt of shake, and a burst of streamers (drift reads d.burst).
  const pu = along(state.player.x, state.player.y, c, s), pv = across(state.player.x, state.player.y, c, s);
  for (const f of d.fronts) {
    if (!f.hit && frontU(f, pv) >= pu) { f.hit = true; d.hitShake = Math.max(d.hitShake, f.strength); }
  }
  d.hitShake = Math.max(0, d.hitShake - dt * 1.4);
  // ?shelter=1 forces it (captures; the explorer normally writes player.sheltered).
  const shT = Math.max(0, Math.min(1, P.has('shelter') ? parseFloat(P.get('shelter')) : state.player.sheltered || 0));
  d.shelter += (shT - d.shelter) * Math.min(1, dt * (shT > d.shelter ? 4 : 1.5));
  state.weather.shelter = d.shelter;
  refreshGustGrid();

  W.gust = clamp01(gustAt(state.player.x, state.player.y));

  // Exposure at the explorer (the explorer may also write player.exposure).
  const px = state.player.x, py = state.player.y;
  const shelter = terrain.shelterAt?.(px, py) || 0;
  const open = terrain.exposureAt ? terrain.exposureAt(px, py) : 0.75;
  d.localExposure = clamp01(windAt(px, py) * (1 - shelter * 0.85) * (0.5 + 0.65 * open));

  d.storminess = approach(d.storminess, severity(), dt * 0.3);
  Wx.light = 1 - Math.max(0, d.storminess - 0.4) * 0.38 - Wx.whiteout * 0.08 - W.gust * 0.03;
}
