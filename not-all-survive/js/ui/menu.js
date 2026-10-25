// The near-invisible gear in the top-right corner: a home for debug tools and the few
// player conveniences that don't belong on screen (return to base camp, sound, quality).
import { state } from '../state.js';
import { setQuality, showOverlay } from './perf.js';

const BASE_CAMP = { x: 1360, y: 1560 };

const GEAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 4.6.9-1.1-.9-1.1-2-.3a6.8 6.8 0 0 0-.6-1.4l1.2-1.7-.4-1.4-1.4-.4-1.7 1.2a6.8 6.8 0 0 0-1.4-.6l-.3-2-1.1-.9-1.1.9-.3 2a6.8 6.8 0 0 0-1.4.6L7 4.5l-1.4.4-.4 1.4 1.2 1.7c-.3.4-.5.9-.6 1.4l-2 .3-.9 1.1.9 1.1 2 .3c.1.5.3 1 .6 1.4l-1.2 1.7.4 1.4 1.4.4 1.7-1.2c.4.3.9.5 1.4.6l.3 2 1.1.9 1.1-.9.3-2c.5-.1 1-.3 1.4-.6l1.7 1.2 1.4-.4.4-1.4-1.2-1.7c.3-.4.5-.9.6-1.4l2-.3Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

export function initMenu() {
  try { state.reduceMotion = localStorage.getItem('nas_reduceMotion') === '1'; } catch { state.reduceMotion = false; }
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
    <label>Weather
      <select data-act="forecast">
        <option value="">(today's forecast)</option>
        <option value="clear">Clear and calm</option>
        <option value="bright">Bright, blinding midday</option>
        <option value="breezy">Breezy</option>
        <option value="overcast">Overcast, light snow</option>
        <option value="eveningStorm">Storm at dusk</option>
        <option value="blizzard">Blizzard all day</option>
      </select>
    </label>
    <label>Quality
      <select data-act="quality">
        <option value="auto">Auto</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
    <button data-act="perf">Performance overlay</button>
    <button data-act="tview">Terrain view: off</button>
    <button data-act="motion">Reduce motion: off</button>
    <button data-act="sim">Watch it play: off</button>
    <button data-act="debuginfo">Debug info: off</button>
    <div class="body-dbg">
      <div class="row"><button data-act="simlog">Copy sim log</button><button data-act="simdl">Download sim log</button></div>
      <div class="row">
        <button data-act="freeze">Freeze me</button>
        <button data-act="warm">Warm me</button>
        <button data-act="kill">Kill</button>
      </div>
      <div class="row">
        <button data-act="soak">Soak me</button>
        <button data-act="dry">Dry me</button>
      </div>
      <div class="row">
        <button data-act="tire">Tire me</button>
        <button data-act="rest">Rest me</button>
      </div>
      <div class="row">
        <button data-act="hurt">Hurt me</button>
        <button data-act="heal">Heal me</button>
        <button data-act="breakice">Break ice</button>
      </div>
      <div class="row">
        <button data-act="starve">Starve me</button>
        <button data-act="feed">Feed me</button>
        <button data-act="fill">Fill pack</button>
      </div>
      <div class="row">
        <button data-act="parch">Parch me</button>
        <button data-act="quench">Quench me</button>
      </div>
      <div class="row">
        <button data-act="pitch">Pitch tent here</button>
        <button data-act="strike">Strike tent</button>
      </div>
      <div class="row">
        <button data-act="bundle">Wrapped body here</button>
      </div>
      <div class="row">
        <button data-act="bearcharge">Bear charges</button>
        <button data-act="rifle">Give rifle</button>
        <button data-act="flare">Give flare</button>
      </div>
    </div>
    <a href="editor/" target="_blank" rel="noopener">Terrain editor ↗</a>`;

  document.body.append(gear, panel);

  // Keep menu taps from walking the explorer or starting the game behind it.
  for (const el of [gear, panel]) {
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend']) el.addEventListener(ev, e => e.stopPropagation());
  }

  const sel = panel.querySelector('[data-act="quality"]');
  const soundBtn = panel.querySelector('[data-act="sound"]');
  const nightBtn = panel.querySelector('[data-act="night"]');
  const sync = () => {
    nightBtn.textContent = `Time: ${state.lighting.mode}`;
    const bf = state.lighting.brightForced;
    panel.querySelector('[data-act="bright"]').textContent = `Bright day: ${bf === null ? 'auto' : bf ? 'on' : 'off'}`;
    sel.value = state.quality.mode === 'auto' ? 'auto' : state.quality.level;
    soundBtn.textContent = state.audio?.muted ? 'Sound: off (tap to unmute)' : 'Sound: on (tap to mute)';
    panel.querySelector('[data-act="tview"]').textContent = `Terrain view: ${state.terrainView ? 'on' : 'off'}`;
    panel.querySelector('[data-act="motion"]').textContent = `Reduce motion: ${state.reduceMotion ? 'on' : 'off'}`;
    panel.querySelector('[data-act="sim"]').textContent = `Watch it play: ${state.sim?.on ? 'on' : 'off'}`;
    panel.querySelector('[data-act="debuginfo"]').textContent = `Debug info: ${state.debugInfo?.on ? 'on' : 'off'}`;
  };

  gear.addEventListener('click', () => { panel.hidden = !panel.hidden; sync() });
  sel.addEventListener('change', () => setQuality(sel.value));
  // Weather (debug): force today's forecast; '' goes back to the daily draw.
  const fsel = panel.querySelector('[data-act="forecast"]');
  fsel.addEventListener('change', () => { if (fsel.value) state.weather.ctl?.forecast(fsel.value); });
  panel.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'camp') { returnToCamp(); panel.hidden = true; }
    if (act === 'sound') { state.audio?.setMuted?.(!state.audio.muted); sync(); }
    if (act === 'perf') showOverlay(!state.perfVisible);
    // "watch it play" (js/sim): the game plays itself from here, or hands back control (live, no reload)
    if (act === 'sim') { state.sim?.toggle?.(!state.sim.on); sync(); }
    if (act === 'simlog') copySimLog(e.target.closest('[data-act]'));
    if (act === 'simdl') downloadSimLog();
    // the live state and the last events in a panel top left (ui/debug.js), remembered on this device
    if (act === 'debuginfo') { state.debugInfo?.toggle?.(); sync(); }
    if (act === 'tview') { state.terrainView = !state.terrainView; sync(); }
    // Reduce motion: no breathing camera when exhausted (remembered on this device)
    if (act === 'motion') {
      state.reduceMotion = !state.reduceMotion;
      try { localStorage.setItem('nas_reduceMotion', state.reduceMotion ? '1' : '0'); } catch { /* private mode */ }
      sync();
    }
    if (act === 'freeze') { state.freeze?.() }
    if (act === 'warm') { state.warm?.() }
    if (act === 'kill') { state.kill?.(); panel.hidden = true; }
    if (act === 'soak') { state.soak?.() }
    if (act === 'dry') { state.dry?.() }
    if (act === 'tire') { state.tire?.() }
    if (act === 'rest') { state.rest?.() }
    if (act === 'hurt') { state.hurt?.() }
    if (act === 'heal') { state.heal?.() }
    if (act === 'breakice') { state.breakIce?.(); panel.hidden = true; }
    if (act === 'starve') { state.starve?.() }
    if (act === 'feed') { state.feed?.() }
    if (act === 'fill') { state.fillPack?.() }
    if (act === 'parch') { state.parch?.() }
    if (act === 'quench') { state.quench?.() }
    if (act === 'pitch') { state.pitch?.(true); panel.hidden = true; }
    if (act === 'strike') { state.strike?.(true) }
    // the goal (goal/burden.js): the lost explorer, wrapped, set down beside the explorer
    if (act === 'bundle') { state.goal?.wrapped(); panel.hidden = true; }
    // the bear slice: the bear comes (the warning, then the charge); the rifle (and five cartridges), a flare
    if (act === 'bearcharge') { window.NAS.bear?.charge(); panel.hidden = true; }
    if (act === 'rifle') { window.NAS.giveRifle?.() }
    if (act === 'flare') { window.NAS.giveFlare?.() }
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

// the sim's log (js/sim): this run's decisions and every run's summary (kept across ?sim=loop reloads)
function copySimLog(btn) {
  let text = state.sim?.dump?.();
  if (!text) { try { text = JSON.stringify({ runs: JSON.parse(sessionStorage.getItem('nas_sim_runs') || '[]') }, null, 1); } catch { text = '{}'; } }
  const done = ok => { btn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => { btn.textContent = 'Copy sim log'; }, 1500); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
  else done(fallbackCopy(text));
}
// ...or as a file, for the replay player (replay/index.html)
function downloadSimLog() {
  const text = state.sim?.dump?.() || JSON.stringify({ runs: JSON.parse(sessionStorage.getItem('nas_sim_runs') || '[]') });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = `nas-sim-run-${state.sim?.stats?.run ?? 0}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
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
