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
    <button data-act="night">Time: cycle</button>
    <button data-act="bright">Bright day: auto</button>
    <label>Quality
      <select data-act="quality">
        <option value="auto">Auto</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
    <button data-act="perf">Performance overlay</button>
    <div class="body-dbg">
      <pre data-act="bodyinfo"></pre>
      <div class="row">
        <button data-act="freeze">Freeze me</button>
        <button data-act="warm">Warm me</button>
        <button data-act="kill">Kill</button>
      </div>
    </div>
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
    nightBtn.textContent = `Time: ${state.lighting.mode}`;
    const bf = state.lighting.brightForced;
    panel.querySelector('[data-act="bright"]').textContent = `Bright day: ${bf === null ? 'auto' : bf ? 'on' : 'off'}`;
    sel.value = state.quality.mode === 'auto' ? 'auto' : state.quality.level;
    soundBtn.textContent = `Sound: ${state.audio?.muted ? 'off' : 'on'}`;
  };

  // Body debug readout (body.js): refreshed while the menu is open.
  const info = panel.querySelector('[data-act="bodyinfo"]');
  const showBody = () => {
    const b = state.body, P = state.player;
    if (!b) { info.textContent = 'body: not loaded'; return; }
    const alive = state.party ? state.party.filter(m => m.alive).length : 0;
    info.textContent = `warmth ${b.warmth.toFixed(2)}  ${(b.rate * 60 >= 0 ? '+' : '')}${(b.rate * 60).toFixed(3)}/min
`
      + `wet ${b.wet.toFixed(2)}  energy ${b.energy.toFixed(2)}  injury ${b.injury.toFixed(2)}
`
      + `food ${b.food.toFixed(2)}  water ${b.water.toFixed(2)}
`
      + `${b.phase} · ${P.mode} · party ${alive}/${state.party?.length ?? 0}
`
      + `${state.weather.temp}°C cold ${state.weather.cold.toFixed(2)} wind ${(P.exposure || 0).toFixed(2)}`;
  };
  setInterval(() => { if (!panel.hidden) showBody(); }, 250);

  gear.addEventListener('click', () => { panel.hidden = !panel.hidden; sync(); showBody(); });
  sel.addEventListener('change', () => setQuality(sel.value));
  panel.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'camp') { returnToCamp(); panel.hidden = true; }
    if (act === 'sound') { state.audio?.setMuted?.(!state.audio.muted); sync(); }
    if (act === 'perf') showOverlay(!state.perfVisible);
    if (act === 'freeze') { state.freeze?.(); showBody(); }
    if (act === 'warm') { state.warm?.(); showBody(); }
    if (act === 'kill') { state.kill?.(); panel.hidden = true; }
    // Bright day: auto (weather decides) -> on -> off -> auto.
    if (act === 'bright') {
      const L = state.lighting;
      L.brightForced = L.brightForced === null ? true : L.brightForced === true ? false : null;
      if (L.brightForced !== null) L.brightTarget = L.brightForced ? 1 : 0;
      sync();
    }
    // Cycle -> always day -> always night -> cycle.
    if (act === 'night') {
      const L = state.lighting;
      L.mode = { cycle: 'day', day: 'night', night: 'cycle' }[L.mode] || 'cycle';
      sync();
    }
  });
  // Clicking anywhere else closes it.
  addEventListener('pointerdown', () => { panel.hidden = true; });

  if (state.params.has('perf')) showOverlay(true);
}

export function returnToCamp() {
  const p = state.player, b = state.body;
  if (b && b.phase !== 'alive' && b.phase !== 'open') return;   // not mid-death, asleep or after the end
  p.x = BASE_CAMP.x; p.y = BASE_CAMP.y;
  p.vx = p.vy = 0;
  p.mode = 'walk';
  state.cam.x = p.x; state.cam.y = p.y;
  // explorer.js clears its own climb/fall state on this event.
  state.events.push({ type: 'teleport', x: p.x, y: p.y });
}
