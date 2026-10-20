// Boot: load data + save, size the canvas, run the loop, route input to the
// active scene. Scenes are plain objects:
//   { enter(app, params), exit(), resize(w, h), update(dt), draw(ctx), pointer(e) }
// and own a DOM layer in #ui for their buttons/HUD.

import { loadData, breedById } from './game/rules.js';
import './engine/compat.js';
import { save } from './engine/storage.js';
import { setPixelRatio, loadOverrides } from './engine/sprites.js';
import { setSoundEnabled, unlockAudio, sfx } from './engine/audio.js';
import { titleScene } from './scenes/title.js';
import { playScene } from './scenes/play.js';
import { shopScene } from './scenes/shop.js';
import { farmScene } from './scenes/farm.js';
import { bonusScene } from './scenes/bonus.js';
import { openSettings } from './scenes/settings.js';

// Bump when shipping data/JSON changes so GitHub Pages' cache can't pair new
// code with old data.
export const VERSION = '1.4.0';

const SCENES = { title: titleScene, play: playScene, shop: shopScene, farm: farmScene, bonus: bonusScene };

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
  // DPR 2 is visually indistinguishable on phones and fills ~55% fewer pixels than 3.
  app.dpr = Math.min(window.devicePixelRatio || 1, 2);
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
  // Any UI tap also unlocks audio; older iOS only counts touchend/click as a gesture.
  for (const ev of ['pointerdown', 'touchend', 'click']) window.addEventListener(ev, () => unlockAudio(), { passive: true });
  // Keyboard: Escape closes the top dialog; scenes may handle the rest.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const scrim = [...ui.querySelectorAll('.scrim')].pop();
      const close = scrim?.querySelector('[data-close], [data-go], [data-ok], [data-again]');
      if (close) { close.click(); return; }
    }
    app.scene?.key?.(e);
  });
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
  try {
    await Promise.all([loadData('./data/', VERSION), loadOverrides(`./data/sprites.json?v=${VERSION}`), document.fonts?.ready]);
  } catch (e) {
    console.error(e);
    const b = document.getElementById('boot');
    b.innerHTML = `The sheep got out! Couldn't load the game data.<br><button class="btn" style="margin-top:14px" onclick="location.reload()">Try again</button>`;
    return;
  }
  // Drop farm animals whose breed no longer exists (renamed/removed in data).
  const before = save.data.farm.length;
  save.data.farm = save.data.farm.filter((a) => breedById(a.breed));
  if (save.data.farm.length !== before) save.write();
  resize();
  // Resize bursts (window drags, the iOS address bar sliding in and out) are
  // settled into one repaint, and pure height wobbles under 15% are ignored:
  // each repaint allocates a full-screen backdrop.
  let timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = window.innerWidth, h = window.innerHeight;
      if (w === app.w && Math.abs(h - app.h) / app.h < 0.15) return;
      resize();
    }, 250);
  });
  bindInput();
  // Deep links (#farm, #shop, #play) — handy for testing and sharing.
  const start = location.hash.slice(1);
  app.go(SCENES[start] && start !== 'bonus' ? start : 'title');
  document.getElementById('boot')?.remove();
  requestAnimationFrame((t) => { last = t; frame(t); });
}

window.ctw = app; // console access for debugging
boot();
