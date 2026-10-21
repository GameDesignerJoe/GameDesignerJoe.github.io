// Settings dialog (overlay on any scene): sound, vibration, stats, reset.

import { setSoundEnabled } from '../engine/audio.js';
import { el } from './ui.js';
import { openAchievements } from './achievements.js';

export function openSettings(app) {
  const s = app.save.data;
  const panel = el(`
    <div class="scrim"><div class="panel" role="dialog" aria-modal="true" aria-label="Settings">
      <h2>Settings</h2>
      <label class="toggle">Sound <input type="checkbox" data-k="sound" ${s.settings.sound ? 'checked' : ''}></label>
      <label class="toggle">Vibration <input type="checkbox" data-k="haptics" ${s.settings.haptics ? 'checked' : ''}></label>
      <label class="toggle">Colour-friendly tells <input type="checkbox" data-k="colorSafe" ${s.settings.colorSafe ? 'checked' : ''}></label>
      <div class="stats">
        <div class="stat"><b>${s.wolvesCaught}</b><span>Wolves caught</span></div>
        <div class="stat"><b>${s.bestStreak}</b><span>Best streak</span></div>
        <div class="stat"><b>${s.farm.length}</b><span>Farm sheep</span></div>
        <div class="stat"><b>${s.mistakes}</b><span>Sheep mistaken</span></div>
      </div>
      <button class="btn gold small" data-achv style="margin:-4px auto 12px">🏆 Achievements</button>
      <div class="row">
        <button class="btn" data-reset>Reset progress</button>
        <button class="btn green" data-close>Done</button>
      </div>
    </div></div>`);
  app.ui.append(panel);
  panel.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    s.settings[k] = e.target.checked;
    if (k === 'sound') setSoundEnabled(e.target.checked);
    app.save.write();
  });
  panel.querySelector('[data-close]').onclick = () => { app.sfx.tap(); panel.remove(); };
  panel.querySelector('[data-achv]').onclick = () => { app.sfx.tap(); panel.remove(); openAchievements(app); };
  panel.onclick = (e) => { if (e.target === panel) panel.remove(); };
  const reset = panel.querySelector('[data-reset]');
  reset.onclick = () => {
    if (!reset.dataset.armed) {
      reset.dataset.armed = '1';
      reset.textContent = 'Tap again to erase';
      reset.classList.add('red');
      return;
    }
    app.save.reset();
    panel.remove();
    app.go('title');
  };
}
