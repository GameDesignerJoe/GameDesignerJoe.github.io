// The launch trailer's director (?trailer only; main.js loads it last). One shot per page load:
// ?shot=<id> picks it from shots.js. The render script (trailer/src/render.js) calls
//   await NAS.trailer.setup()   stage the world through the game's own hooks, warm it up
//   NAS.trailer.frame(i)        frame i of the shot: run its script, step the game 1/30 s, draw
// and grabs the canvas after each frame. Nothing here runs in normal play.
//
// A shot (shots.js) is { setup(D), tick(D, t), cam(D, t) -> { x, y, zoom } | null, gfx(g, t, D) }:
// t is seconds into the shot (negative in the head handle, past dur in the tail handle).
// D is the toolkit below; g is gfx.js bound to the overlay's context.
import { state } from '../state.js';
import * as T from '../world/terrain.js';
import { tileStats } from '../world/map.js';
import { SHOTS } from './shots.js';
import { PLAN, FPS, timeline, barsAt } from './plan.js';
import * as gfx from './gfx.js';

const id = state.params.get('shot') || 'test';
const shot = SHOTS[id] || {};
const plan = timeline().find(p => p.id === id) || { id, dur: 4, head: 0, tail: 0, at: 0 };
const DT = 1 / FPS;
const ZMAX = 6.1;

let t = -plan.head;        // seconds into the shot
let fi = -1;               // frame index (0 = first captured frame)
const fired = new Set();
const log = [];            // game events by shot time: the sound pass keys the game's own sfx to them

const D = {
  state, T, plan,
  get t() { return t; },
  get p() { return state.player; },
  dt: DT,
  // once(key): true the first time it's asked (scripted beats inside tick)
  once(key) { if (fired.has(key)) return false; fired.add(key); return true; },
  // at(time, key): true on the first frame at or after that time
  at(time, key = 'at' + time) { return t >= time && D.once(key); },
  teleport(x, y, facing) {
    state.events.push({ type: 'teleport', x, y });
    state.player.x = x; state.player.y = y;
    if (facing !== undefined) state.player.facing = facing;
  },
  walk(deg, mag = 1) { const a = deg * Math.PI / 180; state.demoInput = { x: Math.cos(a) * mag, y: Math.sin(a) * mag }; },
  stop() { state.demoInput = { x: 0, y: 0 }; },
  // steer toward a world point; returns the distance left (stops within r)
  toward(x, y, mag = 1, r = 2) {
    const dx = x - state.player.x, dy = y - state.player.y, d = Math.hypot(dx, dy);
    state.demoInput = d > r ? { x: dx / d * mag, y: dy / d * mag } : { x: 0, y: 0 };
    return d;
  },
  tap(x, y) { state.input.tap = { x, y, t: state.time }; },
  action() { state.input.action = state.time; },
  // advance the world without capturing (the warm-up before a shot)
  warm(seconds) { const n = Math.round(seconds * FPS); for (let i = 0; i < n; i++) { shot.warmTick?.(D, i * DT); state.trailerStep(1); } },
  // warm until cond() holds (or max seconds); returns the seconds it took
  until(cond, max = 20) { let n = 0; while (!cond() && n < max * FPS) { shot.warmTick?.(D, n * DT); state.trailerStep(1); n++; } return n * DT; },
  radioOff() { if (state.radio) state.radio.on = false; },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  night(v) { const L = state.lighting; L.mode = v ? 'night' : 'day'; L.night = L.nightTarget = v ? 1 : 0; },
  // dusk: a fixed amount of night (0..1), held
  dusk(v) { const L = state.lighting; L.mode = v > 0.5 ? 'night' : 'day'; L.night = v; L.nightTarget = v; L.hold = v; },
  spell(name) { state.weather.ctl?.spell(name); },
  ease: x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x),
  ease3: x => x <= 0 ? 0 : x >= 1 ? 1 : (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  lerp: (a, b, k) => a + (b - a) * k,
  clamp: (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)),
  // camera keyframes: [[t, x, y, zoom], ...] eased between
  keys(list, ease = D.ease) {
    if (t <= list[0][0]) return { x: list[0][1], y: list[0][2], zoom: list[0][3] };
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (t <= b[0]) {
        const k = ease((t - a[0]) / (b[0] - a[0]));
        return { x: D.lerp(a[1], b[1], k), y: D.lerp(a[2], b[2], k), zoom: a[3] * Math.pow(b[3] / a[3], k) };
      }
    }
    const l = list[list.length - 1];
    return { x: l[1], y: l[2], zoom: l[3] };
  },
  // a soft follow of the explorer with an offset, for shots that track them
  follow: { x: 0, y: 0, on: false },
  track(ox = 0, oy = -6, zoom, k = 2.2) {
    const f = D.follow, p = state.player;
    if (!f.on) { f.x = p.x + ox; f.y = p.y + oy; f.on = true; }
    const a = Math.min(1, DT * k);
    f.x += (p.x + ox - f.x) * a; f.y += (p.y + oy - f.y) * a;
    return { x: f.x, y: f.y, zoom };
  },
  // frame the explorer and another (the bear): their midpoint, zoomed to fit both, eased
  pair(o, zMax, zMin = 3, k = 1.6) {
    const p = state.player, f = D.follow;
    const ox = o ? o.x : p.x, oy = o ? o.y : p.y;
    const mx = (p.x + ox) / 2, my = (p.y + oy) / 2 - 8;
    const span = Math.max(Math.abs(p.x - ox) * 1.25 + 60, (Math.abs(p.y - oy) * 1.25 + 50) * 16 / 9);
    const z = Math.max(zMin, Math.min(zMax, state.view.w / span));
    if (!f.on) { f.x = mx; f.y = my; f.z = z; f.on = true; }
    const a = Math.min(1, DT * k);
    f.x += (mx - f.x) * a; f.y += (my - f.y) * a; f.z += (z - f.z) * a * 0.6;
    return { x: f.x, y: f.y, zoom: f.z };
  },
  base: () => Math.min(state.view.w, state.view.h) / 230,
};

function fonts() {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400&display=swap';
  document.head.appendChild(l);
}

function hideChrome() {
  const css = document.createElement('style');
  css.textContent = '#gear, #menu, #perf, #title, .sim-panel, #sim, [id^="sim"] { display: none !important; }';
  document.head.appendChild(css);
}

export async function init() {
  hideChrome();
  fonts();
  state.begun = true; state.begunAt = -1e9; state.started = true;
  state.reduceMotion = false;
  state.trailerNoBar = true;   // no dig / job bars over the action (ui/pack.js)
  state.trailer = { ready: true, id, plan, frames: Math.round((plan.head + plan.dur + plan.tail) * FPS), setup, frame, log, D,
    tiles: () => tileStats().pending };
  state.camHook = () => {
    const c = shot.cam?.(D, t);
    if (!c) return;
    const C = state.cam;
    C.x = c.x; C.y = c.y;
    // never magnify the painted tiles past ~1.5x their native resolution (4 texels per world px)
    if (c.zoom) C.zoom = Math.min(c.zoom, ZMAX);
  };
}

async function setup() {
  // fonts for the overlay
  try {
    await D.sleep(300);
    await Promise.all(['400 80px "Playfair Display SC"', 'italic 20px Georgia', '20px Georgia', '300 20px "IBM Plex Mono"', '400 20px "IBM Plex Mono"']
      .map(f => document.fonts.load(f)));
  } catch { /* fall back */ }
  await shot.setup?.(D);
  // let the map tiles round the opening frame arrive
  for (let i = 0; i < 40 && tileStats().pending; i++) await D.sleep(100);
  await D.sleep(350);
  return { frames: state.trailer.frames };
}

function frame(i) {
  fi = i;
  t = -plan.head + i * DT;
  shot.tick?.(D, t);
  state.trailerStep(1);
  return tileStats().pending;
}

export function update() {
  shot.update?.(D, t);
  if (fi < 0) return;
  for (const e of state.events) {
    if (e.type === 'teleport') continue;
    const o = { t: +t.toFixed(3) };
    for (const k in e) { const v = e[k]; if (typeof v !== 'object' && typeof v !== 'function') o[k] = v; }
    log.push(o);
  }
  // the light held for a dusk shot
  const L = state.lighting;
  if (L.hold !== undefined) { L.night = L.hold; L.nightTarget = L.hold; }
}

export function drawOverlay(ctx) {
  const T = plan.at + t;
  gfx.begin(ctx, state.view.w, state.view.h, t, T);
  ctx.save();
  shot.gfx?.(gfx, t, D);
  ctx.restore();
  // the letterbox breathes with the cut (plan.js barsAt), then anything set in the bars
  if (!state.params.has('nobars')) gfx.bars(barsAt(T) * state.view.h / 1080);
  shot.gfxBars?.(gfx, t, D, barsAt(T) * state.view.h / 1080);
}
