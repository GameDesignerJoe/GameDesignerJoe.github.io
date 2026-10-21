// The near-invisible gear in the top-right corner: a home for debug tools and the few
// player conveniences that don't belong on screen (return to base camp, sound, quality).
import { state } from '../state.js';
import { setQuality, showOverlay } from './perf.js';

const BASE_CAMP = { x: 1360, y: 1560 };

const GEAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 4.6.9-1.1-.9-1.1-2-.3a6.8 6.8 0 0 0-.6-1.4l1.2-1.7-.4-1.4-1.4-.4-1.7 1.2a6.8 6.8 0 0 0-1.4-.6l-.3-2-1.1-.9-1.1.9-.3 2a6.8 6.8 0 0 0-1.4.6L7 4.5l-1.4.4-.4 1.4 1.2 1.7c-.3.4-.5.9-.6 1.4l-2 .3-.9 1.1.9 1.1 2 .3c.1.5.3 1 .6 1.4l-1.2 1.7.4 1.4 1.4.4 1.7-1.2c.4.3.9.5 1.4.6l.3 2 1.1.9 1.1-.9.3-2c.5-.1 1-.3 1.4-.6l1.7 1.2 1.4-.4.4-1.4-1.2-1.7c.3-.4.5-.9.6-1.4l2-.3Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

export function initMenu() {
  const gear = document.createElement('button');
  gear.id = 'gear';
  gear.setAttribute('aria-label', 'Menu');
  gear.innerHTML = GEAR;

  const panel = document.createElement('div');
  panel.id = 'menu';
  panel.hidden = true;
  panel.innerHTML = `
    <button data-act="camp">Return to base camp</button>
    <button data-act="sound">Sound: on</button>
    <button data-act="night">Night: off</button>
    <label>Quality
      <select data-act="quality">
        <option value="auto">Auto</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
    <button data-act="perf">Performance overlay</button>
    <a href="editor/" target="_blank" rel="noopener">Terrain editor ↗</a>`;

  document.body.append(gear, panel);

  // Keep menu taps from walking the explorer or starting the game behind it.
  for (const el of [gear, panel]) {
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend']) el.addEventListener(ev, e => e.stopPropagation());
  }

  const sel = panel.querySelector('select');
  const soundBtn = panel.querySelector('[data-act="sound"]');
  const nightBtn = panel.querySelector('[data-act="night"]');
  const sync = () => {
    nightBtn.textContent = `Night: ${state.lighting.nightTarget > 0.5 ? 'on' : 'off'}`;
    sel.value = state.quality.mode === 'auto' ? 'auto' : state.quality.level;
    soundBtn.textContent = `Sound: ${state.audio?.muted ? 'off' : 'on'}`;
  };

  gear.addEventListener('click', () => { panel.hidden = !panel.hidden; sync(); });
  sel.addEventListener('change', () => setQuality(sel.value));
  panel.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'camp') { returnToCamp(); panel.hidden = true; }
    if (act === 'sound') { state.audio?.setMuted?.(!state.audio.muted); sync(); }
    if (act === 'perf') showOverlay(!state.perfVisible);
    if (act === 'night') { state.lighting.nightTarget = state.lighting.nightTarget > 0.5 ? 0 : 1; sync(); }
  });
  // Clicking anywhere else closes it.
  addEventListener('pointerdown', () => { panel.hidden = true; });

  if (state.params.has('perf')) showOverlay(true);
}

export function returnToCamp() {
  const p = state.player;
  p.x = BASE_CAMP.x; p.y = BASE_CAMP.y;
  p.vx = p.vy = 0;
  p.mode = 'walk';
  state.cam.x = p.x; state.cam.y = p.y;
  // explorer.js clears its own climb/fall state on this event.
  state.events.push({ type: 'teleport', x: p.x, y: p.y });
}
