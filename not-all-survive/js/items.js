// The things the expedition carries, and where they are. Not a system module: anything that
// imports it gets the same shared containers (set up once, on first import).
//
// A container is { slots: [ { id, n, worn? } | null, ... ] }:
//   state.pack    the explorer's pack: PACK_SLOTS (10) slots, and everything counts (the compass,
//                 snowshoes, axes and crampons too). Worn things stay in their slot (worn: true).
//   state.sled    the party's supply at base camp (SLED_SLOTS): what isn't carried stays here.
//   state.ground  piles dropped on the snow: [{ x, y, slots, t }] (ui/pack.js draws them).
//   fallen.js     each body keeps the pack the member died with (f.pack), to be recovered.
// Food stacks to 3 in a slot; gear is one per slot.
//
// state.player.gear = { snowshoes, axes, crampons } is a derived view of the pack (getters:
// worn in the pack; setting one wears / takes it off), so explorer.js and body.js read it as
// before.
//
// ITEMS is the registry: { id, name, stack, kind: 'tool' | 'gear' | 'food', wear (worn on the
// body), icon(ctx, r, z) (drawn centred on 0,0 in a slot of radius r px at zoom z),
// use(u) and blocked(u) }, where u is what the pack UI offers: { i, slot, handsBlocked, inTent,
// takeOut(), eat(i) }. Add a new item here and the pack, the sled and the transfer UI take it.
//
// Hooks: NAS.give(id, n = 1) (into the pack; returns how many fitted), NAS.pack, NAS.sled.
// ?kit=all starts the first member with the compass, snowshoes, axes, crampons and food x3.
import { state } from './state.js';
import { SIGNAL } from './palette.js';

export const PACK_SLOTS = 10, SLED_SLOTS = 20;
const P = state.player;

// --- conditions the items share -----------------------------------------------------------------
export const climbing = () => P.mode === 'climb' || P.mode === 'approach';
// Snowshoes are useless (and dangerous) on ice and while climbing.
export const iceUnder = () => P.terrain === 'ice' || P.terrain === 'thin' || P.terrain === 'water';
export const shoesBlocked = () => climbing() || iceUnder();
// Snowshoes and crampons both strap to the boots: wearing one means taking off the other.
export const EXCLUSIVE = { snowshoes: 'crampons', crampons: 'snowshoes' };

// --- the registry ---------------------------------------------------------------------------------
export const ITEMS = {};
function item(def) { ITEMS[def.id] = { stack: 1, kind: 'gear', wear: false, blocked: () => false, ...def }; }

item({
  id: 'compass', name: 'Compass', kind: 'tool', icon: drawCompassIcon,
  // can't hold it in too much wind, climbing, deep snow, knocked down... (the pack UI knows)
  blocked: u => u.handsBlocked || u.inTent,
  use: u => u.takeOut(),
});
item({ id: 'snowshoes', name: 'Snowshoes', wear: true, icon: drawSnowshoes, blocked: () => shoesBlocked(), use: u => wearSlot(u.i, !u.slot.worn) });
item({ id: 'axes', name: 'Ice axes', wear: true, icon: drawAxes, blocked: () => climbing(), use: u => wearSlot(u.i, !u.slot.worn) });
item({ id: 'crampons', name: 'Crampons', wear: true, icon: drawCrampons, blocked: () => climbing(), use: u => wearSlot(u.i, !u.slot.worn) });
// rations: pemmican and ship's biscuit, one item. Eating takes a while (ui/pack.js plays it).
item({ id: 'food', name: 'Rations', kind: 'food', stack: 3, icon: drawFood, blocked: u => u.handsBlocked, use: u => u.eat(u.i) });

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
// many went in.
export function add(c, id, n = 1) {
  const st = stackOf(id);
  let left = n;
  for (const s of c.slots) if (left > 0 && s && s.id === id && s.n < st) { const k = Math.min(left, st - s.n); s.n += k; left -= k; }
  for (let i = 0; i < c.slots.length && left > 0; i++) {
    if (c.slots[i]) continue;
    const k = Math.min(left, st);
    c.slots[i] = { id, n: k };
    left -= k;
  }
  return n - left;
}
// Take n (default all) out of slot i. Returns { id, n } taken, or null. (Worn things should be
// taken off first: wear(id, false).)
export function take(c, i, n = Infinity) {
  const s = c.slots[i];
  if (!s) return null;
  const k = Math.min(n, s.n);
  s.n -= k;
  if (s.n <= 0) c.slots[i] = null;
  return { id: s.id, n: k };
}
export const count = (c, id) => c.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
export const find = (c, id) => c.slots.findIndex(s => s && s.id === id);
export const isEmpty = c => c.slots.every(s => !s);
export const used = c => c.slots.reduce((a, s) => a + (s ? 1 : 0), 0);

// --- the shared containers ---------------------------------------------------------------------------
const pack = state.pack = { slots: makeSlots(PACK_SLOTS) };
const sled = state.sled = { slots: makeSlots(SLED_SLOTS) };
state.ground = [];
// the party's supply: 12 rations, a set of every bit of gear, and a spare compass
for (let i = 0; i < 4; i++) add(sled, 'food', 3);
for (const id of ['snowshoes', 'axes', 'crampons', 'compass']) add(sled, id, 1);
// the first member sets out with a compass and two rations
add(pack, 'compass', 1);
add(pack, 'food', 2);
if (state.params.get('kit') === 'all') {
  for (const id of ['snowshoes', 'axes', 'crampons']) moveOut(sled, id) || add(pack, id, 1);
  add(pack, 'food', 1);
}
// take one id out of a container into the pack (if there's room). True if it moved.
function moveOut(c, id) {
  const i = find(c, id);
  if (i < 0 || room(pack, id) < 1) return false;
  take(c, i, 1); add(pack, id, 1);
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
// worn), the pack is emptied, and the next one takes a compass from the sled if one is left.
export function takePack() {
  const out = pack.slots.map(s => s && { id: s.id, n: s.n });
  for (let i = 0; i < pack.slots.length; i++) pack.slots[i] = null;
  return out;
}
export function restock() { moveOut(sled, 'compass'); }

// Drop a stack on the snow at x, y: into a pile already lying within ~6 units, or a new one.
export function dropAt(x, y, id, n) {
  let g = state.ground.find(q => Math.hypot(q.x - x, q.y - y) < 6 && room(q, id) >= n);
  if (!g) { g = { x, y, slots: makeSlots(PACK_SLOTS), t: state.time }; state.ground.push(g); }
  add(g, id, n);
  return g;
}
// Empty piles go.
export function sweepGround() {
  for (let i = state.ground.length - 1; i >= 0; i--) if (isEmpty(state.ground[i])) state.ground.splice(i, 1);
}

// Hooks for tests and the console.
state.give = (id, n = 1) => (ITEMS[id] ? add(pack, id, n) : 0);
// Gear menu "Fill pack": the full kit, then rations into every slot left.
state.fillPack = () => {
  for (const id of ['compass', 'snowshoes', 'axes', 'crampons']) if (find(pack, id) < 0) add(pack, id, 1);
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
