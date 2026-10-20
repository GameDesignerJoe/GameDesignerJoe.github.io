// Pure game rules: no DOM, no canvas. Everything here takes data in and
// returns data out, so it can be unit-tested and rebalanced from JSON.

import { randInt, pick, shuffle } from '../engine/util.js';

export const db = { game: null, tells: [], breeds: [], names: [] };

export async function loadData(base = './data/') {
  const get = async (f) => (await fetch(base + f)).json();
  const [game, tells, breeds] = await Promise.all([get('game.json'), get('tells.json'), get('breeds.json')]);
  db.game = game;
  db.tells = tells.tells;
  db.breeds = breeds.breeds;
  db.names = breeds.names;
  return db;
}

export function tierFor(streak) {
  let idx = 0;
  db.game.tiers.forEach((t, i) => { if (streak >= t.minStreak) idx = i; });
  return { index: idx, ...db.game.tiers[idx] };
}

export const breedById = (id) => db.breeds.find((b) => b.id === id);

// Wolves under dark fleece are dark wolves, so a fur patch reads as "fur", not "hole".
function wolfFurFor(look) {
  return look.wool === 'charcoal' ? 'black' : 'grey';
}

function blocked(tell, look) {
  return (tell.notWith || []).some((rule) => {
    const [k, v] = rule.split(':');
    return v === undefined ? Boolean(look[k]) : look[k] === v;
  });
}

// Tells the generator may use for a flock: within the tier's subtlety band and
// not hidden by any breed in the round.
export function eligibleTells(tier, looks) {
  const [lo, hi] = tier.subtlety;
  return db.tells.filter((t) => t.subtlety >= lo && t.subtlety <= hi && looks.every((l) => !blocked(t, l)));
}

// Build one round. Returns { tier, sheep: [{ look, isWolf }], tell }.
export function makeRound(streak) {
  const tier = tierFor(streak);
  const pool = db.breeds.filter((b) => b.inRounds && (b.minTier ?? 0) <= tier.index);
  const breeds = shuffle([...pool]).slice(0, Math.max(1, tier.mixedBreeds || 1));
  const looks = breeds.map((b) => ({ ...b.look }));

  let tells = eligibleTells(tier, looks);
  if (!tells.length) tells = db.tells.filter((t) => looks.every((l) => !blocked(t, l)));
  const tell = pick(tells);

  const count = randInt(tier.sheep[0], tier.sheep[1]);
  const sheep = [];
  for (let i = 0; i < count; i++) {
    const breed = breeds[i % breeds.length];
    sheep.push({ look: { ...breed.look, breed: breed.id }, isWolf: false });
  }
  // The wolf wears the same costume as one of the breeds, plus one slip.
  const wb = pick(breeds);
  const wolfLook = { ...wb.look, breed: wb.id, wolfFur: wolfFurFor(wb.look), tells: { ...tell.tells } };
  sheep.push({ look: wolfLook, isWolf: true });
  shuffle(sheep);
  return { tier, sheep, tell };
}

// --- outcomes ----------------------------------------------------------------
// Each mutates the save data and returns what the UI needs to show.

export function catchWolf(save) {
  const before = tierFor(save.streak).index;
  save.pelts += db.game.peltsPerWolf;
  save.streak += 1;
  save.wolvesCaught += 1;
  save.bestStreak = Math.max(save.bestStreak, save.streak);
  const after = tierFor(save.streak);
  const promptShop = !save.shopPromptShown && save.pelts >= db.game.shopPromptAt;
  if (promptShop) save.shopPromptShown = true;
  return { tierUp: after.index > before ? after : null, promptShop };
}

export function mistake(save) {
  const lostPelts = db.game.mistake.mode === 'classic' ? save.pelts : 0;
  const lostStreak = save.streak;
  save.pelts -= lostPelts;
  save.streak = 0;
  save.mistakes += 1;
  return { lostPelts, lostStreak };
}

export function canHint(save) { return save.pelts >= db.game.hint.cost; }
export function spendHint(save) {
  if (!canHint(save)) return false;
  save.pelts -= db.game.hint.cost;
  return true;
}

// Shop.
export function buy(save, breedId) {
  const b = breedById(breedId);
  if (!b || b.price == null) return { ok: false, reason: 'unknown' };
  if (save.farm.length >= db.game.farmCap) return { ok: false, reason: 'full' };
  if (save.pelts < b.price) return { ok: false, reason: 'pelts', need: b.price - save.pelts };
  save.pelts -= b.price;
  const used = new Set(save.farm.map((s) => s.name));
  const free = db.names.filter((n) => !used.has(n));
  const name = free.length ? pick(free) : `${pick(db.names)} ${save.farm.length + 1}`;
  const animal = { uid: save.nextUid++, breed: b.id, name, x: 0.3 + Math.random() * 0.4, y: 0.35 + Math.random() * 0.3 };
  save.farm.push(animal);
  return { ok: true, animal };
}

export function release(save, uid) {
  save.farm = save.farm.filter((s) => s.uid !== uid);
}
