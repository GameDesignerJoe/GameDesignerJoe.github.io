// Achievements: pure rules over the save, like rules.js. data/achievements.json
// lists families of goals; each family becomes one achievement per goal. The
// numbers they measure are worked out here from the save (stats()), so adding
// a family is data plus, at most, one new line in stats().

import { db, breedById } from './rules.js';

const shopBreeds = () => db.breeds.filter((b) => b.price != null);
export const topBreed = () => shopBreeds().reduce((a, b) => (b.price > a.price ? b : a));

export function stats(save) {
  const st = save.stats;
  const shopIds = new Set(shopBreeds().map((b) => b.id));
  const top = topBreed().id;
  return {
    bestStreak: save.bestStreak,
    stampedeBest: st.stampedeBest,
    lightning: st.lightning,
    breedsBought: st.bought.filter((id) => shopIds.has(id)).length,
    topBreedCount: save.farm.filter((a) => a.breed === top).length,
    ...Object.fromEntries(Object.entries(st.tellsFound).map(([k, n]) => [`tell:${k}`, n])),
  };
}

// Every achievement, flattened: { id, family, icon, medal, title, desc, stat, goal }.
let cache = null;
export function allAchievements() {
  if (cache) return cache;
  const A = db.achievements, out = [];
  // Steps go bronze, silver, gold, diamond; a one-off goal is gold.
  const medal = (i, n) => (n === 1 ? A.medals[2] : A.medals[Math.min(i, A.medals.length - 1)]);
  for (const f of A.families) {
    f.goals.forEach((g, i) => {
      const goal = g === 'all' ? shopBreeds().length : g;
      const desc = f.desc.replace('{n}', goal).replace('{breed}', topBreed().name + (goal === 1 ? '' : 's'));
      out.push({ id: `${f.id}-${g}`, family: f.id, familyName: f.name, icon: f.icon, medal: medal(i, f.goals.length), title: f.titles[i] || f.name, desc, stat: f.stat, goal });
    });
  }
  for (const k of A.tellKinds) {
    A.tellGoals.forEach((goal, i) => {
      out.push({ id: `tell-${k.kind}-${goal}`, family: `tell-${k.kind}`, familyName: k.name, icon: k.icon, medal: medal(i, A.tellGoals.length),
        title: `${k.name} ${A.tellTitles[i] || ''}`.trim(), desc: `Catch ${goal} wolves given away by ${k.desc}`, stat: `tell:${k.kind}`, goal });
    });
  }
  cache = out;
  return out;
}

// Progress for one achievement: { have, goal, done }.
export function progress(a, save, st = stats(save)) {
  const have = st[a.stat] || 0;
  return { have: Math.min(have, a.goal), goal: a.goal, done: Boolean(save.achievements[a.id]) };
}

// Unlock everything that's newly reached. Returns the new ones (for toasts).
export function checkAchievements(save) {
  const st = stats(save), fresh = [];
  for (const a of allAchievements()) {
    if (save.achievements[a.id] || (st[a.stat] || 0) < a.goal) continue;
    save.achievements[a.id] = Date.now();
    fresh.push(a);
  }
  return fresh;
}

// Bookkeeping hooks, called from the rules that change the numbers.
export function noteCatch(save, tell, mult) {
  if (tell?.kind) save.stats.tellsFound[tell.kind] = (save.stats.tellsFound[tell.kind] || 0) + 1;
  if (mult === 3) save.stats.lightning += 1;
}
export function noteStampede(save, caught) { save.stats.stampedeBest = Math.max(save.stats.stampedeBest, caught); }
export function noteBought(save, breedId) { if (breedById(breedId) && !save.stats.bought.includes(breedId)) save.stats.bought.push(breedId); }
