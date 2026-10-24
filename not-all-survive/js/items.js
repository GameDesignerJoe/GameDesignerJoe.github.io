// The things the expedition carries, and where they are. Not a system module: anything that
// imports it gets the same shared containers (set up once, on first import).
//
// A container is { slots: [ { id, n, worn? } | null, ... ] }:
//   state.pack    the explorer's pack: PACK_SLOTS (10) slots, and everything counts (the compass,
//                 snowshoes, axes and crampons too). Worn things stay in their slot (worn: true).
//   state.sled    the party's supply at base camp (SLED_SLOTS): what isn't carried stays here.
//   state.ground  piles dropped on the snow: [{ x, y, slots, t }] (ui/pack.js draws them).
//   fallen.js     each body keeps the pack the member died with (f.pack), to be recovered.
// Food stacks to 3 in a slot, splints to 2; gear is one per slot. The pup tent (slice 6) is one
// of a kind: one on the sled, heavy (body.js: carrying it costs ~10% more energy walking;
// explorer.js: it weighs double on thin ice).
// The flask (thirst): one per slot, and it holds drinks (slot.drinks 0..FLASK_DRINKS), shown as
// pips. The drinks go with it wherever it's moved (take() hands them on, add() takes them: pass
// what take() returned as add()'s `from`). It fills itself in a tent (body.js fillFlasks).
//
// state.player.gear = { snowshoes, axes, crampons } is a derived view of the pack (getters:
// worn in the pack; setting one wears / takes it off), so explorer.js and body.js read it as
// before.
//
// ITEMS is the registry: { id, name, stack, kind: 'tool' | 'gear' | 'food', wear (worn on the
// body), drinks (a vessel: how many it holds; a new one comes full), icon(ctx, r, z) (drawn centred
// on 0,0 in a slot of radius r px at zoom z),
// use(u) and blocked(u) }, where u is what the pack UI offers: { i, slot, handsBlocked, storm (a gale:
// the compass can't be held nor gear strapped on or off; eating, splinting and pitching go on), inTent,
// takeOut(), eat(i), splint(i), pitch(i), drink(i) }. Add a new item here and the pack, the sled and the transfer UI take it.
//
// The canvas sheet and the rope (the goal, goal/burden.js): one of each on the sled; wrapping the lost
// explorer takes both from the pack.
//
// Hooks: NAS.give(id, n = 1) (into the pack; returns how many fitted), NAS.pack, NAS.sled.
// ?kit=all starts the first member with the compass, snowshoes, axes, crampons and food x3.
// (Without it the first member sets out with a compass, two rations and a full flask.)
import { state } from './state.js';
import { SIGNAL } from './palette.js';
import { RECORDINGS } from './recordings.js';

export const PACK_SLOTS = 10, SLED_SLOTS = 20;
const P = state.player;

// --- conditions the items share -----------------------------------------------------------------
export const climbing = () => P.mode === 'climb' || P.mode === 'approach';
// Snowshoes are useless (and dangerous) on ice and while climbing. (Thin ice is the exception: they
// spread the weight, so they stay on there: thinice.js.)
export const iceUnder = () => P.terrain === 'ice' || P.terrain === 'water';
export const shoesBlocked = () => climbing() || iceUnder();
// Snowshoes and crampons both strap to the boots: wearing one means taking off the other.
export const EXCLUSIVE = { snowshoes: 'crampons', crampons: 'snowshoes' };

// --- the registry ---------------------------------------------------------------------------------
export const ITEMS = {};
function item(def) { ITEMS[def.id] = { stack: 1, kind: 'gear', wear: false, blocked: () => false, ...def }; }

item({
  id: 'compass', name: 'Compass', kind: 'tool', icon: drawCompassIcon,
  // can't hold it in too much wind, climbing, deep snow, knocked down... (the pack UI knows)
  blocked: u => u.handsBlocked || u.inTent || !!u.storm,
  use: u => u.takeOut(),
});
item({ id: 'snowshoes', name: 'Snowshoes', wear: true, icon: drawSnowshoes, blocked: u => shoesBlocked() || !!u.storm, use: u => wearSlot(u.i, !u.slot.worn) });
item({ id: 'axes', name: 'Ice axes', wear: true, icon: drawAxes, blocked: u => climbing() || !!u.storm, use: u => wearSlot(u.i, !u.slot.worn) });
item({ id: 'crampons', name: 'Crampons', wear: true, icon: drawCrampons, blocked: u => climbing() || !!u.storm, use: u => wearSlot(u.i, !u.slot.worn) });
// rations: pemmican and ship's biscuit, one item. Eating takes a while (ui/pack.js plays it).
item({ id: 'food', name: 'Rations', kind: 'food', stack: 3, icon: drawFood, blocked: u => u.handsBlocked || (state.body?.food ?? 0) > 0.95, use: u => u.eat(u.i) });
// splint and bandage roll (slice 5): kneel and bind the hurt leg, ~4 s (ui/pack.js plays it); only
// when hurt, never in the tent (it heals there anyway)
item({ id: 'splint', name: 'Splint & bandage', kind: 'tool', stack: 2, icon: drawSplint,
  blocked: u => u.handsBlocked || u.inTent || !((state.body?.injury || 0) > 0.02), use: u => u.splint(u.i) });
// the pup tent (slice 6, actors/puptent.js): pitched on the snow beside the explorer (~8 s, three
// stages; the wind can bring it down); not in a tent, and the ground is checked when it's used
// (ice, water, rock, a slope's lip: refused, the slot shakes). Storms don't stop it: that's when
// it's wanted.
item({ id: 'puptent', name: 'Pup tent', kind: 'tool', icon: drawPupTent, blocked: u => u.inTent, use: u => u.pitch(u.i) });
// the flask (thirst): three drinks of meltwater; a tap unscrews it and takes a pull (~2 s, ui/pack.js).
// Empty, it's dimmed until a tent fills it again (body.js). (Not wading deep snow: hands full.)
export const FLASK_DRINKS = 3;
item({ id: 'flask', name: 'Flask', kind: 'tool', drinks: FLASK_DRINKS, icon: drawFlask,
  blocked: u => u.handsBlocked || !(u.slot.drinks > 0), use: u => u.drink(u.i) });

// audio recorders (recordings.js): one item per recording, so each travels like anything else. Tap:
// play it (tap again: stop). Carrying one is quiet hope (body.js). Not wading deep snow: hands full.
for (const r of RECORDINGS) {
  item({ id: 'rec_' + r.id, name: `Audio recorder: ${r.title}`, kind: 'tool', icon: drawRecorder, rec: r,
    blocked: u => u.handsBlocked, use: u => u.play(r) });
}
// the radio (audio/radio.js): tap to switch it on (listen for the distress beacon), again for off.
// The first member sets out with it on. Not wading deep snow (hands full), not in a tent.
item({ id: 'radio', name: 'Radio', kind: 'tool', icon: drawRadio,
  blocked: u => u.handsBlocked || u.inTent, use: u => u.radio() });
export const carryingRecorder = () => pack.slots.some(q => q && q.id.startsWith('rec_'));
// the canvas sheet and the rope (the goal, goal/burden.js): wrapping the lost explorer takes one of each
// from the pack (both used up). Nothing to do with them on their own: a tap only shows the name.
item({ id: 'sheet', name: 'Canvas sheet', kind: 'tool', icon: drawSheet, use: () => {} });
item({ id: 'rope', name: 'Rope', kind: 'tool', icon: drawRope, use: () => {} });

// --- containers -------------------------------------------------------------------------------------
export const makeSlots = n => Array.from({ length: n }, () => null);
export const stackOf = id => ITEMS[id]?.stack ?? 1;

// How many more of id the container can take.
export function room(c, id) {
  const st = stackOf(id);
  let r = 0;
  for (const s of c.slots) r += !s ? st : s.id === id ? Math.max(0, st - s.n) : 0;
  return r;
}
// Put up to n of id in: topping up part stacks first, then the first empty slots. Returns how
// many went in. A vessel (the flask) keeps the drinks it had (from: what take() returned), or
// comes full.
export function add(c, id, n = 1, from = null) {
  const st = stackOf(id), cap = ITEMS[id]?.drinks;
  let left = n;
  for (const s of c.slots) if (left > 0 && s && s.id === id && s.n < st) { const k = Math.min(left, st - s.n); s.n += k; left -= k; }
  for (let i = 0; i < c.slots.length && left > 0; i++) {
    if (c.slots[i]) continue;
    const k = Math.min(left, st);
    c.slots[i] = { id, n: k };
    if (cap) c.slots[i].drinks = from && typeof from.drinks === 'number' ? from.drinks : cap;
    left -= k;
  }
  return n - left;
}
// Take n (default all) out of slot i. Returns { id, n } taken (and drinks, for a vessel), or null.
// (Worn things should be taken off first: wear(id, false).)
export function take(c, i, n = Infinity) {
  const s = c.slots[i];
  if (!s) return null;
  const k = Math.min(n, s.n);
  s.n -= k;
  if (s.n <= 0) c.slots[i] = null;
  return s.drinks !== undefined ? { id: s.id, n: k, drinks: s.drinks } : { id: s.id, n: k };
}
export const count = (c, id) => c.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
export const find = (c, id) => c.slots.findIndex(s => s && s.id === id);
export const isEmpty = c => c.slots.every(s => !s);
export const used = c => c.slots.reduce((a, s) => a + (s ? 1 : 0), 0);

// --- the shared containers ---------------------------------------------------------------------------
const pack = state.pack = { slots: makeSlots(PACK_SLOTS) };
const sled = state.sled = { slots: makeSlots(SLED_SLOTS) };
state.ground = [];
// the party's supply: 12 rations, a set of every bit of gear, a spare compass, two splints, the
// pup tent and a spare flask
for (let i = 0; i < 4; i++) add(sled, 'food', 3);
add(sled, 'splint', 2);
add(sled, 'puptent', 1);
add(sled, 'rec_leader', 1);   // the leader's message (recordings.js)
add(sled, 'radio', 1);        // a spare radio, for whoever goes out next
add(sled, 'sheet', 1);        // a canvas sheet and a rope: to wrap the lost explorer and bring them home
add(sled, 'rope', 1);
for (const id of ['snowshoes', 'axes', 'crampons', 'compass', 'flask']) add(sled, id, 1);
// the first member sets out with a compass, two rations and a full flask
add(pack, 'compass', 1);
add(pack, 'food', 2);
add(pack, 'flask', 1);
add(pack, 'radio', 1);        // listening for the beacon from the start (Joe)
if (state.params.get('kit') === 'all') {
  for (const id of ['snowshoes', 'axes', 'crampons']) moveOut(sled, id) || add(pack, id, 1);
  add(pack, 'food', 1);
}
// take one id out of a container into the pack (if there's room). True if it moved.
function moveOut(c, id) {
  const i = find(c, id);
  if (i < 0 || room(pack, id) < 1) return false;
  const got = take(c, i, 1); add(pack, id, 1, got);
  return true;
}

// Worn: in the pack and on the body.
export const worn = id => pack.slots.some(s => s && s.id === id && s.worn);
// Put on / take off what's in pack slot i (auto: the game did it, e.g. snowshoes off on ice).
// Only one of a kind is worn: putting one on takes off another of the same (a spare pair) and
// whatever it can't be worn with. Pushes gear events. Anything worn that leaves the pack must
// be taken off with this first (ui/pack.js does), so the explorer and the audio hear of it.
export function wearSlot(i, on, auto = false) {
  const s = pack.slots[i];
  if (!s || !ITEMS[s.id].wear || !!s.worn === on) return false;
  if (on) pack.slots.forEach((q, j) => { if (q && j !== i && q.worn && (q.id === s.id || q.id === EXCLUSIVE[s.id])) wearSlot(j, false, true); });
  s.worn = on;
  state.events.push({ type: 'gear', item: s.id, on, auto, x: P.x, y: P.y });
  return true;
}
// The same by id: on wears the first of them (unless one is already worn), off takes off the worn one.
export function wear(id, on, auto = false) {
  if (on && worn(id)) return false;
  const i = pack.slots.findIndex(q => q && q.id === id && (on || q.worn));
  return i >= 0 && wearSlot(i, on, auto);
}
// The derived view explorer.js and body.js read (and the old hooks write).
const gear = {};
for (const id of ['snowshoes', 'axes', 'crampons']) {
  Object.defineProperty(gear, id, { enumerable: true, get: () => worn(id), set: v => { wear(id, !!v); } });
}
P.gear = gear;

// The death hand-over (body.js): the dead member's pack goes with the body (a copy, nothing
// worn), the pack is emptied, and the next one takes a compass and a flask from the sled, if
// there are any left there.
export function takePack() {
  const out = pack.slots.map(s => s && (s.drinks !== undefined ? { id: s.id, n: s.n, drinks: s.drinks } : { id: s.id, n: s.n }));
  for (let i = 0; i < pack.slots.length; i++) pack.slots[i] = null;
  return out;
}
export function restock() { moveOut(sled, 'compass'); moveOut(sled, 'flask'); moveOut(sled, 'radio'); }

// Drop a stack on the snow at x, y: into a pile already lying within ~6 units, or a new one.
// (from: what take() returned, so a flask keeps its drinks)
export function dropAt(x, y, id, n, from = null) {
  let g = state.ground.find(q => Math.hypot(q.x - x, q.y - y) < 6 && room(q, id) >= n);
  if (!g) { g = { x, y, slots: makeSlots(PACK_SLOTS), t: state.time }; state.ground.push(g); }
  add(g, id, n, from);
  return g;
}
// Flasks in a container: the drinks in all of them (the readout), and topping them up by k each
// (a tent's stove, body.js). Returns how many weren't full.
export const drinksIn = c => c.slots.reduce((a, s) => a + (s && s.id === 'flask' ? s.drinks || 0 : 0), 0);
export function fillFlasks(c, k = 1) {
  let n = 0;
  for (const s of c.slots) if (s && s.id === 'flask' && s.drinks < FLASK_DRINKS) { s.drinks = Math.min(FLASK_DRINKS, s.drinks + k); n++; }
  return n;
}
// Empty piles go.
export function sweepGround() {
  for (let i = state.ground.length - 1; i >= 0; i--) if (isEmpty(state.ground[i])) state.ground.splice(i, 1);
}

// Hooks for tests and the console.
state.give = (id, n = 1) => (ITEMS[id] ? add(pack, id, n) : 0);
// Gear menu "Fill pack": the full kit, then rations into every slot left.
state.fillPack = () => {
  for (const id of ['compass', 'snowshoes', 'axes', 'crampons', 'flask']) if (find(pack, id) < 0) add(pack, id, 1);
  add(pack, 'food', room(pack, 'food'));
};

// --- icons (screen px; r = slot radius, z = zoom, for line weights) -----------------------------------
const INK = 'rgba(40,36,30,0.9)', PALE = 'rgba(236,235,230,0.92)';
export const NORTH = -Math.PI * 0.75;    // screen angle of "north": up-left for now

export function drawNeedle(ctx, cx, cy, len, angle, alpha) {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const nx = -uy, ny = ux, wd = len * 0.22;
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, len * 0.06);
  ctx.strokeStyle = 'rgba(30,30,32,0.85)';
  // south half: pale
  ctx.beginPath();
  ctx.moveTo(cx - ux * len, cy - uy * len);
  ctx.lineTo(cx + nx * wd, cy + ny * wd);
  ctx.lineTo(cx - nx * wd, cy - ny * wd);
  ctx.closePath();
  ctx.fillStyle = '#ecebe6';
  ctx.fill(); ctx.stroke();
  // north half: signal yellow
  ctx.beginPath();
  ctx.moveTo(cx + ux * len, cy + uy * len);
  ctx.lineTo(cx + nx * wd, cy + ny * wd);
  ctx.lineTo(cx - nx * wd, cy - ny * wd);
  ctx.closePath();
  ctx.fillStyle = SIGNAL.lit;
  ctx.fill(); ctx.stroke();
  // pivot
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.2, len * 0.09), 0, Math.PI * 2);
  ctx.fillStyle = '#2a2a2c';
  ctx.fill();
}

// The compass at rest: a small round case and the needle pointing north.
function drawCompassIcon(ctx, r, z) {
  const a = ctx.globalAlpha;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(236,235,230,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,30,32,0.8)';
  ctx.lineWidth = Math.max(1, z * 0.25);
  ctx.stroke();
  drawNeedle(ctx, 0, 0, r * 0.5, NORTH, a);
  ctx.globalAlpha = a;
}

// Two teardrop frames with cross lacing.
function drawSnowshoes(ctx, r, z) {
  for (const side of [-1, 1]) {
    const rw = r * 0.2, rh = r * 0.5;
    ctx.save();
    ctx.translate(side * r * 0.24, 0);
    ctx.rotate(side * 0.18);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALE; ctx.fill();
    ctx.lineWidth = Math.max(1, z * 0.28); ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = Math.max(0.6, z * 0.12); ctx.strokeStyle = 'rgba(40,36,30,0.6)';
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(-rw * 0.8, i * rh * 0.3); ctx.lineTo(rw * 0.8, i * rh * 0.3); }
    ctx.moveTo(0, -rh * 0.85); ctx.lineTo(0, rh * 0.85);
    ctx.stroke();
    ctx.restore();
  }
}

// One ice axe, on the diagonal: the shaft with a spike at the foot, a long curved pick and a
// flat adze at the head. (One, not crossed: crossed axes read as an umbrella at slot size.)
function drawAxes(ctx, r, z) {
  ctx.save();
  ctx.rotate(0.62);
  const L = r * 0.66;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.2, z * 0.6); ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(0, L * 0.95); ctx.lineTo(0, -L * 0.72); ctx.stroke();          // shaft
  ctx.lineWidth = Math.max(1, z * 0.24); ctx.strokeStyle = PALE;
  ctx.beginPath(); ctx.moveTo(-0.3, L * 0.8); ctx.lineTo(-0.3, -L * 0.6); ctx.stroke();      // its lit edge
  ctx.fillStyle = INK;                                                                        // the spike
  ctx.beginPath(); ctx.moveTo(-r * 0.07, L * 0.92); ctx.lineTo(0, L * 1.12); ctx.lineTo(r * 0.07, L * 0.92); ctx.closePath(); ctx.fill();
  // the head: a long pick curving down on one side, a flat adze on the other
  ctx.beginPath();
  ctx.moveTo(-r * 0.06, -L * 0.82);
  ctx.quadraticCurveTo(L * 0.45, -L * 0.88, L * 0.78, -L * 0.42);
  ctx.lineTo(L * 0.62, -L * 0.55);
  ctx.quadraticCurveTo(L * 0.4, -L * 0.7, r * 0.06, -L * 0.64);
  ctx.lineTo(-L * 0.42, -L * 0.66); ctx.lineTo(-L * 0.46, -L * 0.86); ctx.closePath();
  ctx.fillStyle = 'rgba(70,66,60,0.95)'; ctx.fill();
  ctx.lineWidth = Math.max(1, z * 0.22); ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

// A crampon side-on, strapped under a boot: the boot in profile (ankle, heel, toe), the steel
// frame along the sole, a row of spikes pointing down and two front points jutting forward.
function drawCrampons(ctx, r, z) {
  ctx.lineJoin = 'round';
  const lw = Math.max(1, z * 0.26), x0 = -r * 0.5, x1 = r * 0.5, sole = r * 0.12;
  // the boot
  ctx.beginPath();
  ctx.moveTo(x0, sole); ctx.lineTo(x0, -r * 0.5); ctx.lineTo(x0 + r * 0.38, -r * 0.5);
  ctx.lineTo(x0 + r * 0.42, -r * 0.14);
  ctx.quadraticCurveTo(x1 * 0.6, -r * 0.16, x1, -r * 0.02);
  ctx.quadraticCurveTo(x1 + r * 0.05, sole * 0.7, x1 - r * 0.05, sole);
  ctx.closePath();
  ctx.fillStyle = 'rgba(78,74,68,0.95)'; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // the frame under the sole (pale steel)
  ctx.beginPath(); ctx.rect(x0 - r * 0.02, sole, x1 - x0 + r * 0.02, r * 0.09);
  ctx.fillStyle = PALE; ctx.fill(); ctx.lineWidth = Math.max(0.8, z * 0.18); ctx.stroke();
  // spikes down, and the front points forward
  ctx.fillStyle = INK;
  const base = sole + r * 0.09;
  for (let k = 0; k < 5; k++) {
    const x = x0 + r * 0.05 + k * (x1 - x0 - r * 0.15) / 4;
    ctx.beginPath(); ctx.moveTo(x - r * 0.06, base); ctx.lineTo(x, base + r * 0.24); ctx.lineTo(x + r * 0.06, base); ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(x1 - r * 0.02, sole); ctx.lineTo(x1 + r * 0.26, sole + r * 0.12); ctx.lineTo(x1 - r * 0.02, base); ctx.closePath(); ctx.fill();
}

// Splint and bandage: a short wooden slat on the diagonal with a fat roll of bandage lying across
// it, the loose end trailing; the roll's face shows its spiral.
function drawSplint(ctx, r, z) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = Math.max(1, z * 0.26);
  // the slat
  ctx.rotate(-0.7);
  ctx.beginPath(); ctx.rect(-r * 0.62, -r * 0.1, r * 1.24, r * 0.2);
  ctx.fillStyle = 'rgba(176,160,128,0.98)'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = Math.max(0.6, z * 0.1); ctx.strokeStyle = 'rgba(40,36,30,0.45)';
  ctx.beginPath(); ctx.moveTo(-r * 0.5, 0.02 * r); ctx.lineTo(r * 0.5, -0.02 * r); ctx.stroke();   // the grain
  ctx.rotate(0.7);
  // the loose end of the bandage, trailing down off the roll
  ctx.beginPath(); ctx.moveTo(r * 0.12, r * 0.2); ctx.quadraticCurveTo(r * 0.3, r * 0.45, r * 0.52, r * 0.42);
  ctx.lineWidth = Math.max(2, z * 0.5); ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = Math.max(1.2, z * 0.32); ctx.strokeStyle = 'rgba(240,238,232,1)'; ctx.stroke();
  // the roll: its side, then its face with the spiral
  const rx = r * 0.28, ry = r * 0.32, x0 = -r * 0.16, x1 = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(x0, -ry); ctx.lineTo(x1, -ry); ctx.ellipse(x1, 0, rx * 0.45, ry, 0, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x0, ry);
  ctx.closePath();
  ctx.fillStyle = 'rgba(214,210,200,0.99)'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x0, 0, rx * 0.45, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(242,240,234,1)'; ctx.fill(); ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 4, f = 0.15 + 0.75 * k / 24; const x = x0 + Math.cos(a) * rx * 0.45 * f, y = Math.sin(a) * ry * f; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.lineWidth = Math.max(0.6, z * 0.1); ctx.strokeStyle = 'rgba(40,36,30,0.55)'; ctx.stroke();
  ctx.restore();
}

// The pup tent: a small ridge tent a little from above and to one side: the front gable in signal
// yellow with the dark door slit, the roof running back to the right, the ridge and eaves inked, a
// pole tip at the peak and a guy line off each end to a stake.
function drawPupTent(ctx, r, z) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1.1, z * 0.28);
  const A = [-r * 0.2, -r * 0.42], L = [-r * 0.62, r * 0.32], R = [r * 0.22, r * 0.32];   // the front gable
  const k = [r * 0.42, -r * 0.14];                                                         // back along the ridge
  const A2 = [A[0] + k[0], A[1] + k[1]], R2 = [R[0] + k[0], R[1] + k[1]];
  // the roof's lit side, then the front
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A2[0], A2[1]); ctx.lineTo(R2[0], R2[1]); ctx.lineTo(R[0], R[1]); ctx.closePath();
  ctx.fillStyle = SIGNAL.base; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(R[0], R[1]); ctx.lineTo(L[0], L[1]); ctx.closePath();
  ctx.fillStyle = SIGNAL.lit; ctx.fill(); ctx.stroke();
  // the door
  ctx.beginPath(); ctx.moveTo(A[0], A[1] + r * 0.2); ctx.lineTo(A[0] + r * 0.14, R[1]); ctx.lineTo(A[0] - r * 0.14, R[1]); ctx.closePath();
  ctx.fillStyle = 'rgba(52,44,32,0.95)'; ctx.fill();
  // pole tips, guy lines and stakes
  ctx.lineWidth = Math.max(0.8, z * 0.16); ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] - r * 0.02, A[1] - r * 0.14);
  ctx.moveTo(A2[0], A2[1]); ctx.lineTo(A2[0] + r * 0.02, A2[1] - r * 0.12);
  ctx.moveTo(A[0], A[1] - r * 0.05); ctx.lineTo(-r * 0.78, r * 0.12);
  ctx.moveTo(A2[0], A2[1] - r * 0.04); ctx.lineTo(r * 0.8, r * 0.02);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, z * 0.22);
  ctx.beginPath(); ctx.moveTo(-r * 0.78, r * 0.12); ctx.lineTo(-r * 0.79, r * 0.2); ctx.moveTo(r * 0.8, r * 0.02); ctx.lineTo(r * 0.81, r * 0.1); ctx.stroke();
  // the snow it stands on
  ctx.beginPath(); ctx.moveTo(-r * 0.72, r * 0.34); ctx.lineTo(r * 0.68, r * 0.34);
  ctx.lineWidth = Math.max(0.8, z * 0.14); ctx.strokeStyle = 'rgba(40,36,30,0.5)'; ctx.stroke();
  ctx.restore();
}

// Rations: one fat ship's biscuit, a little from above: a pale round with its thickness showing
// as a darker rim along the bottom, docked with a pattern of holes.
function drawFood(ctx, r, z) {
  const rx = r * 0.58, ry = r * 0.5, th = r * 0.16, lw = Math.max(1.2, z * 0.3);
  // the edge (its thickness)
  ctx.beginPath();
  ctx.ellipse(0, th / 2, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(-rx, -th / 2);
  ctx.ellipse(0, -th / 2, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = 'rgba(176,168,150,0.98)'; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // the face
  ctx.beginPath(); ctx.ellipse(0, -th / 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(234,228,212,0.99)'; ctx.fill();
  ctx.lineWidth = lw; ctx.stroke();
  // docking holes
  ctx.fillStyle = 'rgba(40,36,30,0.85)';
  const d = Math.max(0.9, r * 0.055);
  for (const [u, v] of [[0, 0], [-0.45, 0], [0.45, 0], [-0.22, -0.42], [0.22, -0.42], [-0.22, 0.42], [0.22, 0.42]]) {
    ctx.beginPath(); ctx.arc(u * rx, -th / 2 + v * ry, d, 0, Math.PI * 2); ctx.fill();
  }
}

// The flask: a flat-sided steel canteen, upright and a little tipped, its shoulders narrowing to a
// screw cap on a short chain; a pale lit edge down one side and a felt band round its middle (the
// cover that keeps the cold off the metal).
// A field radio: a box, a dial, a speaker grille, the aerial up.
function drawRadio(ctx, r) {
  const w = r * 0.62, h = r * 0.78;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(30,27,22,0.95)'; ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.beginPath(); ctx.moveTo(w * 0.25, -h * 0.45); ctx.lineTo(w * 0.55, -h * 0.95); ctx.stroke();
  ctx.beginPath(); ctx.rect(-w / 2, -h * 0.45, w, h * 0.95);
  ctx.fillStyle = 'rgba(78,72,62,0.96)'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -h * 0.12, w * 0.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(236,235,230,0.92)'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(236,235,230,0.6)'; ctx.lineWidth = Math.max(0.6, r * 0.04);
  ctx.beginPath();
  for (let k = 0; k < 3; k++) { ctx.moveTo(-w * 0.32, h * 0.18 + k * h * 0.08); ctx.lineTo(w * 0.32, h * 0.18 + k * h * 0.08); }
  ctx.stroke();
}
// A little tape recorder: a box, two reels, a grille.
function drawRecorder(ctx, r) {
  const w = r * 0.9, h = r * 0.62;
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(70,64,56,0.95)'; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = 'rgba(30,27,22,0.95)'; ctx.stroke();
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.arc(sx * w * 0.24, -h * 0.06, h * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(236,235,230,0.92)'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx * w * 0.24, -h * 0.06, h * 0.06, 0, Math.PI * 2); ctx.fillStyle = 'rgba(30,27,22,0.95)'; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(236,235,230,0.6)'; ctx.lineWidth = Math.max(0.6, r * 0.04);
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) { ctx.moveTo(k * w * 0.08, h * 0.26); ctx.lineTo(k * w * 0.08, h * 0.4); }
  ctx.stroke();
}
// The canvas sheet: folded into a square bundle, a little tipped, seen from above: the pale top
// fold, the stacked folds showing as a darker edge down one side and along the bottom, a crease
// across the middle and a corner turned back.
function drawSheet(ctx, r, z) {
  ctx.save();
  ctx.rotate(-0.18);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1.1, z * 0.28), w = r * 0.58, h = r * 0.48, th = r * 0.16;
  // the folds' thickness (right side and bottom)
  ctx.beginPath();
  ctx.moveTo(w, -h); ctx.lineTo(w + th * 0.6, -h + th * 0.6); ctx.lineTo(w + th * 0.6, h + th); ctx.lineTo(-w + th * 0.6, h + th); ctx.lineTo(-w, h); ctx.lineTo(w, h); ctx.closePath();
  ctx.fillStyle = 'rgba(170,164,148,0.98)'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = Math.max(0.6, z * 0.1); ctx.strokeStyle = 'rgba(40,36,30,0.5)';
  ctx.beginPath(); ctx.moveTo(-w + th * 0.3, h + th * 0.5); ctx.lineTo(w + th * 0.3, h + th * 0.5); ctx.stroke();
  // the top fold
  ctx.beginPath(); ctx.rect(-w, -h, 2 * w, 2 * h);
  ctx.fillStyle = 'rgba(232,228,214,0.99)'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // a crease across it, and the corner turned back (its underside a shade darker)
  ctx.lineWidth = Math.max(0.6, z * 0.12); ctx.strokeStyle = 'rgba(40,36,30,0.45)';
  ctx.beginPath(); ctx.moveTo(-w * 0.85, h * 0.05); ctx.lineTo(w * 0.85, -h * 0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - r * 0.3, -h); ctx.lineTo(w - r * 0.36, -h + r * 0.34); ctx.lineTo(w, -h + r * 0.28); ctx.closePath();
  ctx.fillStyle = 'rgba(196,190,174,1)'; ctx.fill(); ctx.lineWidth = Math.max(0.8, z * 0.16); ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}
// A coil of rope: three loops lying stacked a little askew, the turns drawn in ink over a tan
// cord, a loose end trailing off with its whipped tip.
function drawRope(ctx, r, z) {
  ctx.save();
  ctx.lineCap = 'round';
  const cw = Math.max(2.2, r * 0.17), lw = Math.max(1, z * 0.24);
  const loops = [[-r * 0.06, -r * 0.08, r * 0.5, r * 0.34], [r * 0.04, 0, r * 0.46, r * 0.32], [-r * 0.02, r * 0.08, r * 0.48, r * 0.33]];
  // the loose end first, under the coil
  ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.3); ctx.quadraticCurveTo(r * 0.55, r * 0.55, r * 0.7, r * 0.38);
  ctx.lineWidth = cw + lw * 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = cw; ctx.strokeStyle = 'rgba(176,156,118,1)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(r * 0.7, r * 0.38, cw * 0.55, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  for (const [x, y, rx, ry] of loops) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.12, 0, Math.PI * 2);
    ctx.lineWidth = cw + lw * 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = cw; ctx.strokeStyle = 'rgba(190,170,130,1)'; ctx.stroke();
  }
  // the lay of the strands: short ink ticks round the top loop
  ctx.lineWidth = Math.max(0.6, z * 0.1); ctx.strokeStyle = 'rgba(40,36,30,0.6)';
  ctx.beginPath();
  const [x, y, rx, ry] = loops[2];
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * Math.PI * 2, px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
    ctx.moveTo(px - cw * 0.35, py - cw * 0.35); ctx.lineTo(px + cw * 0.35, py + cw * 0.35);
  }
  ctx.stroke();
  ctx.restore();
}
function drawFlask(ctx, r, z) {
  ctx.save();
  ctx.rotate(-0.22);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1.1, z * 0.28), w = r * 0.34, h = r * 0.5, top = -h, sh = -h * 0.5;
  // the body: rounded shoulders up to a short neck
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, top);
  ctx.lineTo(-r * 0.1, sh - r * 0.08);
  ctx.quadraticCurveTo(-w, sh - r * 0.04, -w, sh + r * 0.14);
  ctx.lineTo(-w, h - r * 0.12);
  ctx.quadraticCurveTo(-w, h, -w + r * 0.12, h);
  ctx.lineTo(w - r * 0.12, h);
  ctx.quadraticCurveTo(w, h, w, h - r * 0.12);
  ctx.lineTo(w, sh + r * 0.14);
  ctx.quadraticCurveTo(w, sh - r * 0.04, r * 0.1, sh - r * 0.08);
  ctx.lineTo(r * 0.1, top);
  ctx.closePath();
  ctx.fillStyle = 'rgba(160,162,166,0.98)'; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // the lit edge
  ctx.beginPath(); ctx.moveTo(-w + r * 0.09, sh + r * 0.18); ctx.lineTo(-w + r * 0.09, h - r * 0.14);
  ctx.lineWidth = Math.max(1, z * 0.22); ctx.strokeStyle = PALE; ctx.stroke();
  // the felt band
  ctx.beginPath(); ctx.rect(-w, r * 0.02, 2 * w, r * 0.26);
  ctx.fillStyle = 'rgba(88,84,78,0.97)'; ctx.fill(); ctx.lineWidth = Math.max(0.8, z * 0.16); ctx.strokeStyle = INK; ctx.stroke();
  // the cap, and its chain looping down to the shoulder
  ctx.beginPath(); ctx.rect(-r * 0.15, top - r * 0.14, r * 0.3, r * 0.15);
  ctx.fillStyle = 'rgba(58,56,54,1)'; ctx.fill(); ctx.lineWidth = Math.max(0.8, z * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.15, top - r * 0.06); ctx.quadraticCurveTo(r * 0.36, top + r * 0.06, w * 0.8, sh + r * 0.06);
  ctx.lineWidth = Math.max(0.6, z * 0.1); ctx.strokeStyle = 'rgba(40,36,30,0.7)'; ctx.stroke();
  ctx.restore();
}
