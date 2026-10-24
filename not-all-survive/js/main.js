// Boot, the frame loop, and the draw order. Each system lives in its own module and
// exposes some of: init(), update(dt), drawGround(ctx), drawables(), drawSky(ctx), drawScreen(ctx),
// drawOverlay(ctx) (screen space, after every drawScreen, i.e. after the night grade).
//
// Draw order each frame:
//   world space  : map -> ground layers (footprints, drifting snow) -> y-sorted actors -> sky layers
//   screen space : screen layers (falling snow, whiteout, vignette, grain)
import { state } from './state.js';
import { initInput, updateInput } from './input.js';
import { updateCamera, applyCamera } from './camera.js';
import { beginFrame, endFrame, track, updateOverlay, onQuality, maxPixels } from './ui/perf.js';
import { initMenu } from './ui/menu.js';

// Order matters for update; draw order is decided by which hook a module implements.
// ?only=explorer,weather limits which systems load (map, terrain and ground always load).
const MODULES = {
  terrain: './world/terrain.js',
  map: './world/map.js',
  ground: './world/ground.js',
  frontier: './world/frontier.js',   // before explorer and weather, which both read it
  explorer: './actors/explorer.js',
  thinice: './world/thinice.js',     // after explorer (it loads the ice); draws cracks and holes under the prints
  footprints: './fx/footprints.js',
  weather: './fx/weather.js',        // after explorer: sees step events, draws drift over prints
  body: './actors/body.js',          // after weather (reads temp/cold): warmth, death, hand-over, sleep
  camp: './actors/camp.js',
  puptent: './actors/puptent.js',    // after explorer (a pitch stops if they walk off) and camp: the pup tent
  fallen: './actors/fallen.js',      // after body: picks up 'handover' the same frame
  thirst: './fx/thirst.js',          // after body (reads water) and camp: the mirage (drawSky, over every sky layer) and the Third Man
  wildlife: './actors/wildlife.js',
  audio: './audio/audio.js',
  recorder: './audio/recorder.js',  // the audio recorders: plays one, ducks it under weather, stops it at death
  night: './fx/night.js',            // grades the finished frame and adds warm lights
  bright: './fx/bright.js',          // blinding clear days: glare, halo, lost detail
  pack: './ui/pack.js',              // after night, so the UI isn't tinted (the pack, the compass, containers)
  terrainview: './ui/terrainview.js', // debug: the editor's terrain classes over the game (T, gear menu)
  stickhint: './ui/stickhint.js',   // touch: pulses the hidden thumbstick if a new player stands still
};
const only = state.params.get('only')?.split(',');
const ALWAYS = ['terrain', 'map', 'ground', 'frontier', 'night', 'bright', 'pack'];
const names = Object.keys(MODULES).filter(n => !only || ALWAYS.includes(n) || only.includes(n));

// Each module loads and runs in isolation: one broken module logs an error and is
// switched off rather than taking the whole scene down.
const systems = [];
const broken = new Set();
function safe(s, fn) {
  if (broken.has(s)) return undefined;
  try { return track(s.name, fn); } catch (e) { broken.add(s); console.error(`[${s.name}] disabled:`, e); }
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Render resolution follows the quality level (perf.js lowers dprCap on slow devices).
function resize() {
  let dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), state.quality.dprCap);
  dpr = Math.min(dpr, Math.sqrt(maxPixels() / (innerWidth * innerHeight)));
  state.view = { w: innerWidth, h: innerHeight, dpr };
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize);
onQuality(resize);
resize();

let ready = false;
function begin() {
  if (state.begun || !ready) return;
  state.begun = true;
  // With ?autostart the world is already showing, so there's no reveal to play.
  state.begunAt = state.params.has('autostart') ? -1e9 : state.time;
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
  beginFrame();
  const dt = raw * state.timeScale;
  state.dt = dt;
  state.time += dt;

  updateDemo();
  updateInput();
  for (const s of systems) safe(s, () => s.mod.update?.(dt));
  state.events.length = 0; // events live for exactly one update pass
  track('camera', () => updateCamera(dt));

  const { w, h, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#e9e9e7';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  applyCamera(ctx);
  for (const s of systems) drawLayer(s, 'drawGround');
  // Depth sort. Anything standing on the ground reports its feet as { x, y } and is
  // keyed by terrain.sortKey (y plus the height of the ground it stands on), so it
  // sorts correctly against the cliff/rock occluder pieces from layers.js, which
  // arrive pre-keyed (no x). Drawables without x keep their plain y.
  const sortKey = terrainMod?.sortKey;
  const actors = [];
  for (const s of systems) {
    const d = safe(s, () => s.mod.drawables?.());
    if (!d) continue;
    for (const a of d) {
      const key = a.x !== undefined && sortKey ? sortKey(a.x, a.y) : a.y;
      actors.push({ draw: a.draw, key, sys: s });
    }
  }
  track('sort', () => actors.sort((a, b) => a.key - b.key));
  for (const a of actors) { ctx.save(); safe(a.sys, () => a.draw(ctx)); ctx.restore(); }
  for (const s of systems) drawLayer(s, 'drawSky');
  ctx.restore();

  for (const s of systems) drawLayer(s, 'drawScreen');
  // Overlays sit on the lens, after the night grade: frost on the screen stays pale.
  for (const s of systems) drawLayer(s, 'drawOverlay');

  endFrame(now);
  updateOverlay(now);
  requestAnimationFrame(frame);
}

function drawLayer(s, hook) {
  if (!s.mod[hook]) return;
  ctx.save();
  safe(s, () => s.mod[hook](ctx));
  ctx.restore();
}

let terrainMod = null;
async function boot() {
  // Fetch every module in parallel, but keep the declared update order.
  const loaded = await Promise.all(names.map(name =>
    import(MODULES[name]).then(mod => ({ name, mod }), e => console.error(`[${name}] failed to load:`, e))));
  for (const s of loaded) if (s) systems.push(s);
  terrainMod = systems.find(s => s.name === 'terrain')?.mod ?? null;
  await Promise.all(systems.map(s => safe(s, () => s.mod.init?.())));
}

initInput(canvas);
initMenu();
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
