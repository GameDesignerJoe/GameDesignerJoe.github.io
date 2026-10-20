// Boot: load data + save, size the canvas, run the loop, route input to the
// active scene. Scenes are plain objects:
//   { enter(app, params), exit(), resize(w, h), update(dt), draw(ctx), pointer(e) }
// and own a DOM layer in #ui for their buttons/HUD.

import { loadData } from './game/rules.js';
import { save } from './engine/storage.js';
import { setPixelRatio, loadOverrides } from './engine/sprites.js';
import { setSoundEnabled, unlockAudio, sfx } from './engine/audio.js';
import { titleScene } from './scenes/title.js';
import { playScene } from './scenes/play.js';
import { shopScene } from './scenes/shop.js';
import { farmScene } from './scenes/farm.js';
import { openSettings } from './scenes/settings.js';

const SCENES = { title: titleScene, play: playScene, shop: shopScene, farm: farmScene };

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');

export const app = {
  w: 0, h: 0, dpr: 1,
  ui, save, sfx,
  scene: null,
  go(name, params = {}) {
    app.scene?.exit?.();
    ui.innerHTML = '';
    app.scene = SCENES[name];
    app.sceneName = name;
    app.scene.enter(app, params);
    app.scene.resize?.(app.w, app.h);
    if (location.hash !== '#' + name && !params.silent) history.replaceState(null, '', '#' + name);
  },
  openSettings: () => openSettings(app),
  haptic(ms = 12) { if (save.data.settings.haptics && navigator.vibrate) navigator.vibrate(ms); },
};

function resize() {
  app.dpr = Math.min(window.devicePixelRatio || 1, 3);
  app.w = window.innerWidth;
  app.h = window.innerHeight;
  canvas.width = Math.round(app.w * app.dpr);
  canvas.height = Math.round(app.h * app.dpr);
  canvas.style.width = app.w + 'px';
  canvas.style.height = app.h + 'px';
  setPixelRatio(app.dpr);
  app.scene?.resize?.(app.w, app.h);
}

// Pointer → scene, in CSS px.
function bindInput() {
  const send = (type) => (ev) => {
    if (type === 'down') unlockAudio();
    const r = canvas.getBoundingClientRect();
    app.scene?.pointer?.({ type, x: ev.clientX - r.left, y: ev.clientY - r.top, id: ev.pointerId });
  };
  canvas.addEventListener('pointerdown', send('down'));
  window.addEventListener('pointermove', send('move'));
  window.addEventListener('pointerup', send('up'));
  window.addEventListener('pointercancel', send('up'));
  // Any UI tap also unlocks audio.
  ui.addEventListener('pointerdown', () => unlockAudio());
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (app.scene) {
    app.scene.update?.(dt);
    ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
    app.scene.draw?.(ctx);
  }
  requestAnimationFrame(frame);
}

async function boot() {
  save.load();
  setSoundEnabled(save.data.settings.sound);
  await Promise.all([loadData('./data/'), loadOverrides('./data/sprites.json'), document.fonts?.ready]);
  resize();
  window.addEventListener('resize', resize);
  bindInput();
  // Deep links (#farm, #shop, #play) — handy for testing and sharing.
  const start = location.hash.slice(1);
  app.go(SCENES[start] ? start : 'title');
  document.getElementById('boot')?.remove();
  requestAnimationFrame((t) => { last = t; frame(t); });
}

window.ctw = app; // console access for debugging
boot();
