// Achievements dialog (overlay on any scene): every goal, grouped by family,
// with a medal for the ones you have and a progress bar for the rest.

import { allAchievements, progress, stats } from '../game/achievements.js';
import { el } from './ui.js';

export function openAchievements(app) {
  const s = app.save.data;
  const st = stats(s);
  const all = allAchievements();
  const got = all.filter((a) => s.achievements[a.id]).length;
  const families = [];
  for (const a of all) {
    let f = families.find((x) => x.id === a.family);
    if (!f) families.push(f = { id: a.family, name: a.familyName, icon: a.icon, list: [] });
    f.list.push(a);
  }
  const row = (a) => {
    const p = progress(a, s, st);
    return `<li class="${p.done ? 'done' : ''}">
      <span class="medal" aria-hidden="true">${p.done ? a.medal : '🔒'}</span>
      <span class="what"><b>${a.title}</b><small>${a.desc}</small>
        ${p.done ? '' : `<span class="bar" aria-label="${p.have} of ${p.goal}"><i style="width:${(p.have / p.goal) * 100}%"></i></span>`}</span>
      <span class="count">${p.done ? '✓' : `${p.have}/${p.goal}`}</span>
    </li>`;
  };
  const panel = el(`
    <div class="scrim"><div class="panel achv" role="dialog" aria-modal="true" aria-label="Achievements">
      <h2>Achievements</h2>
      <p class="achv-sum"><b>${got}</b> of ${all.length} earned</p>
      <div class="achv-list">
        ${families.map((f) => `<h3>${f.icon} ${f.name}</h3><ul>${f.list.map(row).join('')}</ul>`).join('')}
      </div>
      <div class="row"><button class="btn green" data-close>Done</button></div>
    </div></div>`);
  app.ui.append(panel);
  panel.querySelector('[data-close]').onclick = () => { app.sfx.tap(); panel.remove(); };
  panel.onclick = (e) => { if (e.target === panel) panel.remove(); };
}
