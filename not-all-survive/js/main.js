// Boot, the frame loop, and the draw order. Each system lives in its own module and
// exposes some of: init(), update(dt), drawGround(ctx), drawables(), drawSky(ctx), drawScreen(ctx).
//
// Draw order each frame:
//   world space  : map -> ground layers (footprints, drifting snow) -> y-sorted actors -> sky layers
//   screen space : screen layers (falling snow, whiteout, vignette, grain)
import { state } from './state.js';
import { initInput, updateInput } from './input.js';
import { updateCamera, applyCamera } from './camera.js';

// Order matters for update; draw order is decided by which hook a module implements.
// ?only=explorer,weather limits which systems load (map, terrain and ground always load).
const MODULES = {
  terrain: './world/terrain.js',
  map: './world/map.js',
  ground: './world/ground.js',
  explorer: './actors/explorer.js',
  footprints: './fx/footprints.js',
  weather: './fx/weather.js',        // after explorer: sees step events, draws drift over prints
  camp: './actors/camp.js',
  wildlife: './actors/wildlife.js',
  audio: './audio/audio.js',
};
const only = state.params.get('only')?.split(',');
const ALWAYS = ['terrain', 'map', 'ground'];
const names = Object.keys(MODULES).filter(n => !only || ALWAYS.includes(n) || only.includes(n));

// Each module loads and runs in isolation: one broken module logs an error and is
// switched off rather than taking the whole scene down.
const systems = [];
const broken = new Set();
function safe(s, fn) {
  if (broken.has(s)) return undefined;
  try { return fn(); } catch (e) { broken.add(s); console.error(`[${s.name}] disabled:`, e); }
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.view = { w: innerWidth, h: innerHeight, dpr };
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize);
resize();

let ready = false;
function begin() {
  if (state.begun || !ready) return;
  state.begun = true;
  state.begunAt = state.time;
  state.started = true;
  document.getElementById('title').classList.add('gone');
  systems.find(s => s.name === 'audio')?.mod.unlock?.();
}
addEventListener('pointerdown', begin);
addEventListener('keydown', begin);
// iOS only counts touchend/click as a user activation for audio, so retry the unlock there.
for (const ev of ['touchend', 'click', 'keydown']) {
  addEventListener(ev, () => systems.find(s => s.name === 'audio')?.mod.unlock?.());
}

// Scripted input for automated captures: ?demo=circle | ?demo=dir&a=<degrees> | ?demo=still
function updateDemo() {
  const demo = state.params.get('demo');
  if (!demo) return;
  if (demo === 'still') state.demoInput = { x: 0, y: 0 };
  else if (demo === 'dir') {
    const a = (parseFloat(state.params.get('a') || '90') * Math.PI) / 180;
    state.demoInput = { x: Math.cos(a), y: Math.sin(a) };
  } else if (demo === 'circle') {
    const a = state.time * 0.35;
    state.demoInput = { x: Math.cos(a), y: Math.sin(a) };
  }
}

let last = performance.now();
function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  const dt = raw * state.timeScale;
  state.dt = dt;
  state.time += dt;

  updateDemo();
  updateInput();
  for (const s of systems) safe(s, () => s.mod.update?.(dt));
  state.events.length = 0; // events live for exactly one update pass
  updateCamera(dt);

  const { w, h, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#e9e9e7';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  applyCamera(ctx);
  for (const s of systems) drawLayer(s, 'drawGround');
  const actors = [];
  for (const s of systems) {
    const d = safe(s, () => s.mod.drawables?.());
    if (d) for (const a of d) actors.push({ ...a, sys: s });
  }
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) { ctx.save(); safe(a.sys, () => a.draw(ctx)); ctx.restore(); }
  for (const s of systems) drawLayer(s, 'drawSky');
  ctx.restore();

  for (const s of systems) drawLayer(s, 'drawScreen');

  requestAnimationFrame(frame);
}

function drawLayer(s, hook) {
  if (!s.mod[hook]) return;
  ctx.save();
  safe(s, () => s.mod[hook](ctx));
  ctx.restore();
}

async function boot() {
  // Fetch every module in parallel, but keep the declared update order.
  const loaded = await Promise.all(names.map(name =>
    import(MODULES[name]).then(mod => ({ name, mod }), e => console.error(`[${name}] failed to load:`, e))));
  for (const s of loaded) if (s) systems.push(s);
  await Promise.all(systems.map(s => safe(s, () => s.mod.init?.())));
}

initInput(canvas);
if (state.started) {
  const title = document.getElementById('title');
  title.style.transition = 'none';
  title.classList.add('gone');
}
boot().then(() => {
  ready = true;
  document.getElementById('title').classList.add('ready');
  requestAnimationFrame(t => { last = t; frame(t); });
});
