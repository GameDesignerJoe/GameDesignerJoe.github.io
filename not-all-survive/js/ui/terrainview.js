// Terrain view (Joe): the editor's class colours painted over the live game, so you can see what
// each patch of ground is without switching to the editor. A debug view: gear menu ->
// "Terrain view", the T key, or ?terrainview. Drawn after everything (the night grade too), in
// world space, from terrain.mask(): rebuilt whenever the terrain is (edits, ?edits).
//   snow: untinted. deep: green. ice: blue. thin ice: pink (open water: pink with dark dots).
//   rock: red. path: yellow. cliff: purple. shadow: teal. (The same colours as the editor.)
// Also outlines the climb-only plateaus and labels the class under the explorer's feet.
import { state } from '../state.js';
import * as T from '../world/terrain.js';
import { applyCamera } from '../camera.js';

const COLS = [null, [40, 190, 70], [40, 120, 255], [255, 110, 200], [205, 20, 30], [255, 220, 0], [140, 60, 240], [0, 210, 180]];
const NAMES = ['snow', 'deep snow', 'ice', 'thin ice', 'rock', 'path', 'cliff', 'shadow'];
let cv = null, builtFor = -1;
state.terrainView = state.params.has('terrainview');

function build(m) {
  cv = cv || document.createElement('canvas');
  cv.width = m.w; cv.height = m.h;
  const g = cv.getContext('2d'), img = g.createImageData(m.w, m.h), d = img.data;
  for (let i = 0; i < m.w * m.h; i++) {
    let c = COLS[m.cls[i]];
    if (!c) continue;
    let a = 120;
    // open water: thin-ice class that's dark in the painting; dotted darker so it reads apart
    if (m.cls[i] === 3 && m.lum[i] < T.WATER_LUM) { const x = i % m.w, y = (i / m.w) | 0; if ((x + y) % 4 === 0) { c = [70, 20, 60]; a = 200; } }
    const o = i * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = a;
  }
  g.putImageData(img, 0, 0);
  builtFor = m.version;
}

export function init() {
  addEventListener('keydown', e => {
    if (e.code === 'KeyT' && !e.repeat && !e.ctrlKey && !e.metaKey) state.terrainView = !state.terrainView;
  });
}

export function drawOverlay(ctx) {
  if (!state.terrainView) return;
  const m = T.mask();
  if (!m) return;
  if (m.version !== builtFor) build(m);
  const { dpr } = state.view;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  applyCamera(ctx);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(cv, 0, 0, m.w * m.scale, m.h * m.scale);
  ctx.restore();
  // what's underfoot, top left
  const P = state.player, c = T.classAt(P.x, P.y);
  const water = T.isWater?.(P.x, P.y);
  const txt = `terrain view (T): ${water ? 'open water' : NAMES[c] ?? '?'} underfoot`;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '13px Georgia, serif';
  const w = ctx.measureText(txt).width + 16;
  ctx.fillStyle = 'rgba(250,250,247,0.9)'; ctx.fillRect(10, 10, w, 24);
  ctx.fillStyle = '#26241e'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 18, 22.5);
  ctx.restore();
}
