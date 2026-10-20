// Pure game rules: no DOM, no canvas. Everything here takes data in and
// returns data out, so it can be unit-tested and rebalanced from JSON.

import { randInt, pick, shuffle } from '../engine/util.js';
import { WOOL, tintPalette, colorDistance } from '../art/palette.js';

export const db = { game: null, tells: [], breeds: [], names: [], items: [], itemRules: {} };

export async function loadData(base = './data/', version = '') {
  const get = async (f) => {
    const res = await fetch(`${base}${f}?v=${version}`);
    if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
    return res.json();
  };
  const [game, tells, breeds, items] = await Promise.all([get('game.json'), get('tells.json'), get('breeds.json'), get('items.json')]);
  db.items = items.items;
  db.itemRules = { maxToys: items.maxToys ?? 6, maxFoodOut: items.maxFoodOut ?? 4 };
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
export const itemById = (id) => db.items.find((i) => i.id === id);

// Pick the wolf fur that contrasts most with the fleece, so an ear, tail or
// patch always reads: a black wolf under grey wool, a grey wolf otherwise.
function wolfFurFor(look) {
  return look.wool === 'ash' ? 'black' : 'grey';
}

function blocked(tell, look) {
  return (tell.notWith || []).some((rule) => {
    const [k, v] = rule.split(':');
    return v === undefined ? Boolean(look[k]) : look[k] === v;
  });
}

// A colour tell must leave the fake fleece clearly unlike every other breed
// in the flock, or it would just look like one more breed.
// Checked against every breed that can turn up in a round, not just this
// flock: players learn the breeds, so a fake that looks like a Rose Sheep reads
// as "a Rose Sheep", not as a slip.
function tintClash(t, wolfLook) {
  const strength = t.tells.tint;
  if (!strength) return false;
  const fake = tintPalette(WOOL[wolfLook.wool] || WOOL.cream, strength).base;
  const clearance = db.game.tintClearance ?? 50;
  const wools = new Set(db.breeds.filter((b) => b.inRounds).map((b) => b.look.wool));
  return [...wools].some((w) => w !== wolfLook.wool && colorDistance(fake, (WOOL[w] || WOOL.cream).base) < clearance);
}

// Can this tell be used on this wolf's costume in this flock?
const usable = (t, wolfLook, looks, opts) => !blocked(t, wolfLook) && !(opts.colorSafe && t.colorOnly) && !tintClash(t, wolfLook);

// Tells the generator may use: within the tier's subtlety band and readable
// on the wolf's costume.
export function eligibleTells(tier, wolfLook, looks, opts = {}) {
  const [lo, hi] = tier.subtlety;
  return db.tells.filter((t) => t.subtlety >= lo && t.subtlety <= hi && usable(t, wolfLook, looks, opts));
}

// Pick a tell: a group first (so the three patch variants count as one idea),
// then a variant within it.
function pickTell(tells) {
  const groups = new Map();
  for (const t of tells) {
    const g = t.group || t.id;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  return pick(pick([...groups.values()]));
}

// Build one round. Returns { tier, sheep: [{ look, isWolf }], tell }.
// opts.colorSafe skips tells that are only a colour difference.
// opts.maxSheep caps the flock so sheep stay big enough to read on small screens.
export function makeRound(streak, opts = {}) {
  const tier = tierFor(streak);
  const pool = db.breeds.filter((b) => b.inRounds && (b.minTier ?? 0) <= tier.index);
  // Prefer breeds with different wool, so "4 breeds" looks like 4.
  const want = Math.max(1, tier.mixedBreeds || 1);
  const breeds = [];
  for (const b of shuffle([...pool])) if (breeds.length < want && !breeds.some((x) => x.look.wool === b.look.wool)) breeds.push(b);
  for (const b of pool) if (breeds.length < want && !breeds.includes(b)) breeds.push(b);
  const looks = breeds.map((b) => ({ ...b.look }));
  // The wolf wears one breed's costume; tells are judged against that costume.
  const wb = pick(breeds);

  let tells = eligibleTells(tier, wb.look, looks, opts);
  if (!tells.length) tells = db.tells.filter((t) => usable(t, wb.look, looks, opts));
  if (!tells.length) tells = db.tells.filter((t) => !t.notWith && !t.tells.tint); // data blocks everything: safe fallback
  const tell = pickTell(tells);

  const count = Math.max(2, Math.min(randInt(tier.sheep[0], tier.sheep[1]), (opts.maxSheep ?? 99) - 1));
  const sheep = [];
  for (let i = 0; i < count; i++) {
    const breed = breeds[i % breeds.length];
    sheep.push({ look: { ...breed.look, breed: breed.id }, isWolf: false });
  }
  // Same costume as its breed, plus one slip.
  const wolfLook = { ...wb.look, breed: wb.id, wolfFur: wolfFurFor(wb.look), tells: { ...tell.tells } };
  sheep.push({ look: wolfLook, isWolf: true });
  shuffle(sheep);
  return { tier, sheep, tell };
}

// --- outcomes ----------------------------------------------------------------
// Each mutates the save data and returns what the UI needs to show.

export function catchWolf(save) {
  const tier = tierFor(save.streak);
  const gained = tier.pelts ?? 1;
  save.pelts += gained;
  save.streak += 1;
  save.wolvesCaught += 1;
  const newRecord = save.streak > save.bestStreak && save.streak >= 3;
  save.bestStreak = Math.max(save.bestStreak, save.streak);
  const after = tierFor(save.streak);
  const promptShop = !save.shopPromptShown && save.pelts >= db.game.shopPromptAt;
  if (promptShop) save.shopPromptShown = true;
  return { gained, tierUp: after.index > tier.index ? after : null, promptShop, newRecord };
}

export function mistake(save) {
  const m = db.game.mistake;
  const lostPelts = m.mode === 'classic' ? save.pelts : Math.min(save.pelts, m.peltCost ?? 0);
  const lostStreak = save.streak;
  save.pelts -= lostPelts;
  save.streak = 0;
  save.mistakes += 1;
  return { lostPelts, lostStreak };
}

export const hintCost = (save) => tierFor(save.streak).hintCost ?? db.game.hint.cost;
export function canHint(save) { return save.pelts >= hintCost(save); }
export function spendHint(save) {
  if (!canHint(save)) return false;
  save.pelts -= hintCost(save);
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

// Farm goodies. Food goes into the pantry (placed from the farm tray); toys go
// straight onto the farm, rolling in through the gate.
export function buyItem(save, id) {
  const it = itemById(id);
  if (!it) return { ok: false, reason: 'unknown' };
  if (it.kind === 'toy' && save.toys.length >= db.itemRules.maxToys) return { ok: false, reason: 'toys' };
  if (save.pelts < it.price) return { ok: false, reason: 'pelts', need: it.price - save.pelts };
  save.pelts -= it.price;
  if (it.kind === 'food') save.pantry[id] = (save.pantry[id] || 0) + 1;
  else save.toys.push({ uid: save.nextUid++, item: id, x: 0.5, y: 0.97, isNew: true });
  return { ok: true, item: it };
}

// Take one food out of the pantry and put it on the farm at (x, y) in 0..1 farm coords.
export function placeFood(save, id, x, y) {
  const it = itemById(id);
  if (!it || !(save.pantry[id] > 0)) return null;
  if (save.foods.length >= db.itemRules.maxFoodOut) return null;
  save.pantry[id] -= 1;
  const food = { uid: save.nextUid++, item: id, x, y, remaining: it.amount };
  save.foods.push(food);
  return food;
}

// Let a farm sheep go to a neighbour's farm, refunding part of its price.
export function releaseRefund(animal) {
  const b = breedById(animal?.breed);
  return Math.floor((b?.price ?? 0) * (db.game.releaseRefund ?? 0));
}
export function release(save, uid) {
  const animal = save.farm.find((s) => s.uid === uid);
  if (!animal) return 0;
  const refund = releaseRefund(animal);
  save.farm = save.farm.filter((s) => s.uid !== uid);
  save.pelts += refund;
  return refund;
}

// The round in progress is kept in the save so leaving (menu, shop, reload)
// can't reroll a hard flock for free.
export function storeRound(save, round, hinted) {
  save.round = { streak: save.streak, tellId: round.tell.id, tierIndex: round.tier.index, hinted, sheep: round.sheep.map((s) => ({ look: s.look, isWolf: s.isWolf })) };
}
export function restoreRound(save) {
  const r = save.round;
  if (!r || r.streak !== save.streak) return null;
  const tell = db.tells.find((t) => t.id === r.tellId);
  if (!tell || !Array.isArray(r.sheep) || !r.sheep.some((s) => s.isWolf)) return null;
  return { round: { tier: tierFor(save.streak), tell, sheep: r.sheep.map((s) => ({ look: { ...s.look }, isWolf: s.isWolf })) }, hinted: !!r.hinted };
}
export function clearRound(save) { delete save.round; }
