// The pack: the only UI, and only on demand. Press and hold the explorer to dig in it (a bar
// fills over the head); when it fills, the pack's 10 round slots open beside them: two columns of
// five, the first column nearest the explorer, slot 1 where the compass always sat (beside the
// hood), slots 1-5 down that column and 6-0 down the far one. They open to the left, or to the
// right when there's no room on the left. A faint dashed ink tether joins the block to its owner.
// Empty slots are faint. Slots are 5.5 world units across the radius, never under 13 px (18 px on
// a touch screen).
//   tap a slot               use it: put gear on / take it off (the ring turns signal yellow while
//                            it's worn), take out the compass, eat a ration
//   press and hold a slot    (1 s; a white arc shows from 0.3 s, so taps never see it) drop ONE
//                            of it on the snow beside the explorer: a small pile; hold on the pile
//                            to pick it up again
// Keyboard: hold C to dig, then 1-9 and 0 (hold a digit to drop); C takes out the compass.
//
// The compass: tapped, a needle hangs over the explorer for 12 s, pointing north (screen
// up-left for now), shaken by the wind. Too much wind, climbing, deep snow, being knocked down
// or cowering means you can't hold it; it goes back in the pack. Tap the explorer to put it
// away. It only works while there's a compass in the pack.
//
// Gear: climbing or stepping onto ice puts snowshoes back in the pack (not thin ice: there they
// spread the weight); snowshoes and crampons can't both be worn; climbing needs axes AND crampons
// (explorer.js checks before a climb).
//
// Containers: the sled at base camp, a fallen member's body, a pile on the snow. Within reach a
// small signal-yellow glint catches on it (the sled's lashing, the body's pack, the pile). Press
// and hold one within reach (~20 units of the sled's edge, 16 of a body, 12 of a pile) and the
// explorer kneels low, turns to it and digs; a press on one further off walks there and digs on
// arrival. Its contents fan out in a block of square, crate-like slots beside it, on the side away
// from the explorer (one faint empty slot first, nearest the pack, where things go), tethered to
// it; the pack opens beside the explorer on the other side. Tap an item in either block to move
// one of it across; hold (0.6 s) to move the whole stack. Each move kicks up a puff of snow (and
// jostles the sled's load). A full pack (or sled) refuses with a shake of the slot, no words.
// Walking away, or the bear coming, closes it. Keyboard: hold Space / E close to one; 1-0 move
// from the pack, Shift + 1-0 from the container.
//
// The tent: inside, by day, press and hold the glowing door and the pack opens there (to eat,
// mostly; a quick tap on the door still leaves, as a tap anywhere does). After dark the door is
// the tent's: a hold sleeps (explorer.js / body.js; the bar over the door fills with it, ~1 s)
// and sleeping eats a ration if they're hungry.
//
// Teaching the hold: the first time food drops below 0.35, explorer.js plays a one-off glance and
// pat at the pack (player.patHint 0..1), and the first fifth of the dig bar flashes over them.
//
// Eating: tap a ration. The explorer kneels and eats for 3 s with the pack open (hands to the
// face, a chewing bob); moving cancels it and the ration isn't used. +0.35 food, a little warmth.
//
// Splinting (slice 5): tap a splint while hurt. The explorer sits in the snow with the bad leg out
// and binds it for 4 s (explorer.js); moving cancels it and the splint isn't used. Injury -0.25 at
// once, and the limp costs half the pace until the next injury (body.splint).
//
// state.compass = { phase: 'idle'|'rummage'|'slot'|'out'|'transfer'|'eat'|'splint', target, ... } (the
//   name is history: it's the pack UI's state). target = { kind: 'sled'|'fallen'|'ground', x, y }
//   while rummaging in / transferring with a container; explorer.js kneels and faces it.
// Pushes events: rummage, compass (taken out), stow (put away), gear { item, on, auto },
//   transfer / pickup / drop { id, n, x, y }, eat { stage: 'start'|'chew'|'done'|'stop' },
//   splint { stage: 'start'|'wrap'|'done'|'stop' },
//   full { x, y } (refused: no room, can't drop here, too full to eat).
import { state } from '../state.js';
import { worldToScreenUI as worldToScreen, screenToWorld, visibleRect } from '../camera.js';   // (not the breathing pulse)
import { SIGNAL } from '../palette.js';
import { SLED, campInteract, tentDoor, sledNudge } from '../actors/camp.js';
import * as Terrain from '../world/terrain.js';
import {
  ITEMS, PACK_SLOTS, wearSlot, worn, wear, take, add, room, find, isEmpty, dropAt, sweepGround,
  shoesBlocked, drawNeedle, NORTH,
} from '../items.js';

const RUMMAGE_S = 2;              // time to dig in the pack (or the sled, or a body)
const PILE_S = 1;                 // ...or to crouch to a pile on the snow
const SLOT_TIMEOUT_S = 6;         // an ignored pack closes itself
const XFER_TIMEOUT_S = 14;        // ...and an ignored container
const OUT_S = 12;                 // the compass goes back in the pack after this long
const DROP_S = 1.0;               // press and hold a pack slot this long: drop one on the snow
const MOVE_S = 0.6;               // ...a container slot (or the pack's, at a container): move the stack
const ARC_FROM = 0.3;             // the hold arc only shows after this (a tap never sees it)
const EAT_S = 3, EAT_FOOD = 0.35, EAT_WARM = 0.04;
const SPLINT_S = 4, SPLINT_HEAL = 0.25;
const REACH = { sled: 20, fallen: 16, ground: 12 };   // how close to rummage (world units; the sled from its edge, on its ground plane)
const LEAVE = 6;                  // ...and how much further walking away closes it
const BEAR_NEAR = 60;             // an alerted bear this close: no kneeling over a pack
const BAR_W = 12, BAR_H = 1.3;    // world units: about twice the explorer's width
const HEAD = 24;                  // height above the feet where the compass dial sits
const BAR_Y = 20;                 // the pack bar sits just above the hood
const TAU = Math.PI * 2;
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const P = state.player, pack = state.pack;
const C = state.compass = { phase: 'idle', t: 0, slotA: 0, outA: 0, xferA: 0, angle: NORTH + 1.2, vel: 0, target: null, eatI: -1, splintI: -1 };
let holding = false;              // pointer or key held on the explorer / a container
let holdCode = null;              // which key is doing the holding ('auto': arrived at a container)
let wasMoving = false;
let press = null;                 // a press on a slot: { block: 'pack'|'cont', i, t, key?, done }
let shownT = null, side = -1;     // the container drawn (kept through its fade), the pack's side
let chewT = 0, wrapT = 0, doorPress = false, pending = null;
const shakes = new Map();         // 'pack:3' -> time of the refusal
const puffs = [];                 // snow kicked up by a move: { x, y, t }

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const zoom = () => state.cam.zoom || 1;
const moving = () => P.moving && P.speed > 2;
// in the tent (alive and awake): the pack opens at the door (by day; after dark a hold sleeps)
const inTent = () => P.mode === 'inside' && (!state.body || state.body.phase === 'alive');
const canSleep = () => { const L = state.lighting; return L.mode === 'cycle' && L.night > 0.5 && L.clock >= 180; };   // (as body.js)
// where the UI hangs from: the explorer's feet, or the tent door from inside
function feet() {
  if (inTent()) { try { const d = tentDoor(); return worldToScreen(d.fx, d.fy - 2); } catch { /* no camp */ } }
  return worldToScreen(P.x, P.y);
}

// Can the explorer get into the pack at all right now? (Deep snow is fine: that's exactly
// where you want your snowshoes.) Not crawling through the tent door, collapsing or dead (no
// explorer to press); in the tent, only through the door.
const AWAY = new Set(['tent-in', 'inside', 'tent-out', 'collapse', 'dead', 'gone', 'swim', 'sink', 'crawlout']);
const away = () => (AWAY.has(P.mode) && !inTent()) || (state.body && state.body.phase !== 'alive' && state.body.phase !== 'open');
function bearClose() {
  const b = state.bear;
  return !!b && (b.st === 'alert' || b.st === 'stalk') && Math.hypot(b.x - P.x, b.y - P.y) < BEAR_NEAR;
}
function packBlocked() {
  if (inTent()) return false;     // sheltered
  const w = state.wind;
  return away() || P.terrain === 'water' || P.mode === 'climb' || P.mode === 'approach' || P.mode === 'down' || P.mode === 'cower'
    || (w.speed + (w.gust || 0)) > 0.85 || (state.frontier?.amount || 0) > 0.4;
}
// Can they hold something in their hands (the compass, a ration)? Not wading through deep snow either.
function blocked() { return !inTent() && (packBlocked() || P.terrain === 'deep'); }

function onPlayer(sx, sy) {
  const f = feet(), z = zoom(), pad = 10;
  return Math.abs(sx - f.x) < 4 * z + pad && sy < f.y + 2 * z + pad && sy > f.y - 19 * z - pad;
}

// --- containers ---------------------------------------------------------------------------------
// The point each owner's UI is tied to (world): the sled's load, the body's middle, the pile.
const anchorOf = t => (t.kind === 'sled' ? { x: SLED.x, y: SLED.y - 4 } : t.kind === 'fallen' ? { x: t.x, y: t.y - 2 } : { x: t.x, y: t.y - 1 });
// What a press at screen (sx, sy) lands on: a pile on the snow (only on the pile itself), a fallen
// member with a pack, or the sled. { kind, ref (the container), x, y }.
function containerAt(sx, sy) {
  const w = screenToWorld(sx, sy), z = zoom();
  for (const g of state.ground) if (Math.hypot(w.x - g.x, (w.y - (g.y - 1)) * 1.4) < Math.max(3.2, 12 / z)) return { kind: 'ground', ref: g, x: g.x, y: g.y };
  for (const f of state.fallen || []) {
    if (f.pack && !f.lost && Math.hypot(w.x - f.x, (w.y - (f.y - 2)) * 1.3) < Math.max(7, 14 / z)) return { kind: 'fallen', ref: f.pack, x: f.x, y: f.y };
  }
  try { if (campInteract(w.x, w.y) === 'sled') return { kind: 'sled', ref: state.sled, x: SLED.x, y: SLED.y }; } catch { /* no camp */ }
  return null;
}
// how far the explorer is from it: from a body or a pile, its middle; from the sled, its nearest
// edge (it's ~28 units long; camp.js draws it on a ground plane foreshortened by 0.72)
const SLED_C = Math.cos(SLED.yaw), SLED_S = Math.sin(SLED.yaw);
function sledLocal(x, y) { const dx = x - SLED.x, dy = (y - SLED.y) / 0.72; return [dx * SLED_C + dy * SLED_S, -dx * SLED_S + dy * SLED_C]; }
function dist(t) {
  if (t.kind !== 'sled') return Math.hypot(P.x - t.x, P.y - t.y);
  const [lx, ly] = sledLocal(P.x, P.y);
  return Math.hypot(Math.max(0, Math.abs(lx) - 13), Math.max(0, Math.abs(ly) - 3.5));
}
// where to walk to, to reach it from here: beside the sled on this side, or a few units short of
// a body or a pile, on the line from the explorer
function reachPoint(t) {
  if (t.kind === 'sled') {
    const [lx, ly] = sledLocal(P.x, P.y);
    const ax = clamp(lx, -11, 11), ay = (ly >= 0 ? 1 : -1) * 10;
    return { x: SLED.x + ax * SLED_C - ay * SLED_S, y: SLED.y + (ax * SLED_S + ay * SLED_C) * 0.72 };
  }
  const d = Math.hypot(P.x - t.x, P.y - t.y) || 1, k = 6 / d;
  return { x: t.x + (P.x - t.x) * k, y: t.y + (P.y - t.y) * k };
}
// the nearest container within reach (Space / E); with far = 2, within twice that (the glint)
function nearest(far = 1) {
  let best = null, bd = 1e9;
  const consider = t => { const d = dist(t); if (d < REACH[t.kind] * far && d / REACH[t.kind] < bd) { bd = d / REACH[t.kind]; best = t; } };
  consider({ kind: 'sled', ref: state.sled, x: SLED.x, y: SLED.y });
  for (const f of state.fallen || []) if (f.pack && !f.lost && !isEmpty(f.pack)) consider({ kind: 'fallen', ref: f.pack, x: f.x, y: f.y });
  for (const g of state.ground) consider({ kind: 'ground', ref: g, x: g.x, y: g.y });
  return best;
}
// The slots a container shows: one empty slot first if there's room (where things go: nearest
// the pack), then what's in it, packed together. A pile on the snow shows only what's there.
function shownSlots(t) {
  const list = [];
  if (t.kind !== 'ground') { const e = t.ref.slots.findIndex(s => !s); if (e >= 0) list.push(e); }
  t.ref.slots.forEach((s, i) => { if (s) list.push(i); });
  return list;
}

// --- layout (screen px) -------------------------------------------------------------------------
// Built once per frame, when drawn (so presses between frames hit exactly what's on screen).
const slotR = () => Math.max(5.5 * zoom(), TOUCH ? 18 : 13);
let lay = null;
function layouts() {
  if (lay) return lay;
  const f = feet(), z = zoom(), r = slotR(), sp = r * 2.5, { w, h } = state.view, lo = r + 4, hi = w - r - 4;
  const off = Math.max(15 * z, 4 * z + r + 5);
  // the pack: on the chosen side (fixed while a container is open), else the left; flipped if a
  // column would leave the screen, and only then slid back on, so columns never stack
  const fits = s => [0, 1].every(c => { const x = f.x + s * (off + c * sp); return x >= lo && x <= hi; });
  let s = C.phase === 'transfer' || C.xferA > 0.01 ? side : -1;
  if (!fits(s) && !(C.phase === 'transfer' || C.xferA > 0.01) && fits(-s)) s = -s;
  const xs = [f.x + s * off, f.x + s * (off + sp)];
  const over = Math.min(0, ...xs.map(x => x - lo)) || Math.max(0, ...xs.map(x => x - hi));
  const y0 = Math.max(8 + r, Math.min(f.y - 11 * z, h - 8 - r - 4 * sp));
  const packPos = [];
  for (let i = 0; i < PACK_SLOTS; i++) packPos.push({ x: xs[i < 5 ? 0 : 1] - over, y: y0 + (i % 5) * sp });
  const out = { r, sp, side: s, pack: packPos, packOwner: { x: f.x, y: f.y - 8 * z }, cont: null, contOwner: null };
  // the container: beside it on the far side from the explorer, centred on its height; if it
  // runs off the screen the whole block slides back on
  const t = C.phase === 'transfer' ? C.target : C.xferA > 0.01 ? shownT : null;
  if (t) {
    const c = worldToScreen(anchorOf(t).x, anchorOf(t).y);
    const half = (t.kind === 'sled' ? 15 : t.kind === 'fallen' ? 7 : 3) * z;
    const list = shownSlots(t), rows = Math.min(5, Math.max(1, list.length)), cols = Math.ceil(list.length / 5);
    const cy0 = Math.max(8 + r, Math.min(c.y - (rows - 1) * sp / 2, h - 8 - r - (rows - 1) * sp));
    const cs = -side, x0 = c.x + cs * (half + r + 4), xEnd = x0 + cs * (cols - 1) * sp;
    const shift = Math.min(0, Math.min(x0, xEnd) - lo) || Math.max(0, Math.max(x0, xEnd) - hi);
    out.cont = list.map((i, k) => ({ i, x: x0 + cs * Math.floor(k / 5) * sp - shift, y: cy0 + (k % 5) * sp }));
    out.contOwner = c;
  }
  return (lay = out);
}
// Which slot is under screen (sx, sy): the nearest within reach of a fingertip.
function slotAt(sx, sy) {
  let best = null, bd = 1e9;
  const L = layouts(), reach = L.r + 8;
  L.pack.forEach((p, i) => { const d = Math.hypot(sx - p.x, sy - p.y); if (d < reach && d < bd) { bd = d; best = { block: 'pack', i }; } });
  if (C.phase === 'transfer' && L.cont) for (const p of L.cont) { const d = Math.hypot(sx - p.x, sy - p.y); if (d < reach && d < bd) { bd = d; best = { block: 'cont', i: p.i }; } }
  return best;
}

// --- actions --------------------------------------------------------------------------------------
// refused: the slot shakes its head (and a muffled knock)
function shake(block, i) {
  shakes.set(block + ':' + i, state.time);
  state.events.push({ type: 'full', x: P.x, y: P.y });
}
function startRummage(target = null) {
  if (packBlocked() || (target && bearClose())) return;
  C.phase = 'rummage'; C.t = 0; C.target = target;
  state.events.push({ type: 'rummage', x: P.x, y: P.y, target: target?.kind });
}
function close() {
  if (C.phase === 'eat') state.events.push({ type: 'eat', stage: 'stop', x: P.x, y: P.y });
  if (C.phase === 'splint') state.events.push({ type: 'splint', stage: 'stop', x: P.x, y: P.y });
  C.phase = 'idle'; C.t = 0; C.target = null; press = null; doorPress = false;
}
function takeOut() {
  if (find(pack, 'compass') < 0) return;
  C.phase = 'out'; C.t = 0; C.target = null;
  C.angle = NORTH + (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random());   // settles in
  C.vel = 0;
  state.events.push({ type: 'compass', x: P.x, y: P.y });
}
function stow() {
  if (C.phase === 'out') state.events.push({ type: 'stow', x: P.x, y: P.y });
  C.phase = 'idle'; C.t = 0;
}
function startEat(i) {
  // (not when already full: no wasting a ration by accident)
  if (state.body && state.body.food > 0.95) { shake('pack', i); return; }
  C.phase = 'eat'; C.eatI = i; C.t = 0; chewT = 0.9;
  state.events.push({ type: 'eat', stage: 'start', x: P.x, y: P.y });
}
// Bind the hurt leg with the splint in slot i (only when hurt: no wasting it).
function startSplint(i) {
  if (!state.body || !(state.body.injury > 0.02)) { shake('pack', i); return; }
  C.phase = 'splint'; C.splintI = i; C.t = 0; wrapT = 0.8;
  state.events.push({ type: 'splint', stage: 'start', x: P.x, y: P.y });
}
// Tap a pack slot (pack open): use what's in it.
function useSlot(i) {
  const s = pack.slots[i];
  if (!s) return;
  const it = ITEMS[s.id];
  const u = { i, slot: s, handsBlocked: blocked(), inTent: inTent(), takeOut, eat: startEat, splint: startSplint };
  if (it.blocked(u)) { shakes.set('pack:' + i, state.time); return; }
  C.t = 0;
  it.use(u);
  if (it.wear && !inTent()) close();   // putting gear on / off: the pack closes and the kneel plays
}
// Take n out of pack slot i; anything worn comes off first (the gear event plays).
function takeFromPack(i, n, auto) {
  const s = pack.slots[i];
  if (s && s.worn && n >= s.n) wearSlot(i, false, auto);
  return take(pack, i, n);
}
const puff = (x, y) => { puffs.push({ x, y, t: state.time }); if (puffs.length > 8) puffs.shift(); };
// Press and hold a pack slot: drop one of it on the snow beside the explorer, on the side the
// pack opens, clear of the feet so a press finds it; the other side, or at the feet, if that's
// rock, the sea or the camp; nowhere: refused.
function dropSlot(i) {
  const s = pack.slots[i];
  if (!s) return;
  if (inTent()) { shake('pack', i); return; }
  const ok = (x, y) => { try { return Terrain.isWalkable(x, y) !== false && !Terrain.isWater?.(x, y) && !campInteract(x, y); } catch { return true; } };
  const sd = layouts().side;
  const spot = [[P.x + sd * 7, P.y + 1.5], [P.x - sd * 7, P.y + 1.5], [P.x, P.y + 3]].find(([x, y]) => ok(x, y));
  if (!spot) { shake('pack', i); return; }
  const got = takeFromPack(i, 1, false);
  dropAt(spot[0], spot[1], got.id, got.n);
  puff(spot[0], spot[1]);
  state.events.push({ type: 'drop', id: got.id, n: got.n, x: spot[0], y: spot[1] });
  C.t = 0;
}
// Transfer: move one (or the whole stack) of slot i of `from` into `to`.
function moveItem(from, i, to, all, block) {
  const s = from.slots[i], t = C.target;
  if (!s || !t) return;
  const fit = room(to, s.id);
  if (fit < 1) { shake(block, i); return; }
  const n = Math.min(all ? s.n : 1, fit);
  const got = from === pack ? takeFromPack(i, n, true) : take(from, i, n);   // (already kneeling: a quick tug)
  add(to, got.id, got.n);
  const ground = t.kind === 'ground';
  const type = to === pack ? (ground ? 'pickup' : 'transfer') : (ground ? 'drop' : 'transfer');
  state.events.push({ type, id: got.id, n: got.n, to: to === pack ? 'pack' : t.kind, x: P.x, y: P.y });
  const a = anchorOf(t);
  puff(a.x + (Math.random() - 0.5) * 4, a.y + 3);
  if (t.kind === 'sled') sledNudge?.();
  C.t = 0;
  if (ground && isEmpty(t.ref)) { sweepGround(); close(); }
}
// A finished press on a slot: a tap (released early) or a hold.
function slotAction(p, held) {
  if (C.phase === 'slot') { if (p.block === 'pack') (held ? dropSlot : useSlot)(p.i); return; }
  if (C.phase === 'transfer' && C.target) {
    if (p.block === 'pack') moveItem(pack, p.i, C.target.ref, held, 'pack');
    else moveItem(C.target.ref, p.i, pack, held, 'cont');
  }
}
const holdNeed = () => (C.phase === 'transfer' ? MOVE_S : DROP_S);
// A press on a container: within reach, dig in it; further off, walk there and dig on arrival.
function pressContainer(t) {
  if (C.phase === 'out') stow();
  if (dist(t) < REACH[t.kind]) { holding = true; holdCode = null; startRummage(t); return true; }
  if (C.phase !== 'idle') close();
  const g = reachPoint(t);
  if (P.reach?.(g.x, g.y)) { pending = t; return true; }
  return false;
}

export function init() {
  state.uiPress = (sx, sy) => {
    if (!state.begun && !state.params.has('autostart')) return false;
    if (away()) { close(); return false; }   // presses go to the tent / the hand-over
    pending = null;
    const open = C.phase === 'slot' || C.phase === 'transfer' || C.phase === 'eat' || C.phase === 'splint';
    if (open) {
      const hit = slotAt(sx, sy);
      if (hit && (C.phase === 'eat' || C.phase === 'splint')) return true;   // (busy eating / binding: swallow it)
      if (hit) { press = { ...hit, t: state.time, done: false }; return true; }
    }
    if (inTent()) {
      // in the tent: the door opens the pack; anywhere else goes to the tent (leave / sleep)
      const f = feet();
      // (after dark the door is the bed: the press goes on to explorer.js, a hold sleeps)
      if (C.phase === 'idle' && !canSleep() && Math.hypot(sx - f.x, sy - (f.y - 3 * zoom())) < Math.max(28, 10 * zoom())) {
        holding = true; holdCode = null; doorPress = true; startRummage(); return true;
      }
      if (open) close();
      return false;
    }
    if (C.phase === 'eat' || C.phase === 'splint') {
      close();                     // walked off mid-meal (or mid-binding): the ration / splint goes back
      return onPlayer(sx, sy);
    }
    // a pile: only a press on the pile itself, and nearer it than the explorer's middle
    const t = containerAt(sx, sy);
    if (t && t.kind === 'ground') {
      const f = feet(), a = worldToScreen(t.x, t.y - 1);
      if (!onPlayer(sx, sy) || Math.hypot(sx - a.x, sy - a.y) < Math.hypot(sx - f.x, sy - (f.y - 8 * zoom()))) return pressContainer(t);
    }
    if (onPlayer(sx, sy)) {
      if (C.phase === 'out') { stow(); return true; }
      if (open) { close(); return true; }
      holding = true; holdCode = null;
      if (C.phase === 'idle') startRummage();
      return true;                  // never walk into yourself
    }
    if (t && t.kind !== 'ground' && pressContainer(t)) return true;
    if (open) close();             // tapping elsewhere closes it (and walks)
    return false;
  };
  state.uiRelease = () => {
    if (holdCode === null) holding = false;
    // a quick tap on the tent door (the pack not yet open): leave, as any tap inside does
    if (doorPress && C.phase === 'rummage') { close(); P.leaveTent?.(); }
    doorPress = false;
    if (press && !press.key && !press.done) slotAction(press, false);
    if (press && !press.key) press = null;
  };

  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (!state.begun && !state.params.has('autostart')) return;
    const d = /^Digit(\d)$/.exec(e.code);
    if (d && (C.phase === 'slot' || C.phase === 'transfer')) {
      const n = (+d[1] + 9) % 10;   // 1 -> slot 0 ... 0 -> slot 9
      if (e.shiftKey && C.phase === 'transfer') {
        const list = shownSlots(C.target);
        if (n < list.length) press = { block: 'cont', i: list[n], t: state.time, key: e.code, done: false };
      } else press = { block: 'pack', i: n, t: state.time, key: e.code, done: false };
      return;
    }
    if (e.code === 'KeyC') {
      if (C.phase === 'slot') { if (!blocked()) takeOut(); }
      else if (C.phase === 'out') stow();
      else if (C.phase === 'idle' && !away()) { holding = true; holdCode = e.code; startRummage(); }
      return;
    }
    // Space / E close to the sled, a body or a pile: hold to rummage in it
    if ((e.code === 'Space' || e.code === 'KeyE') && C.phase === 'idle' && !inTent()) {
      const t = nearest();
      if (t) { holding = true; holdCode = e.code; startRummage(t); }
    }
  });
  addEventListener('keyup', e => {
    if (e.code === holdCode) { holding = false; holdCode = null; }
    if (press && press.key === e.code) { if (!press.done) slotAction(press, false); press = null; }
  });

  // Test hooks. NAS.compassOpen() skips straight to the needle; NAS.packOpen() opens the pack;
  // NAS.gear(id, on) / NAS.snowshoes(on) wear things (putting them in the pack first if need be);
  // NAS.openSled() opens the sled transfer from wherever they stand; NAS.eat() eats the first
  // ration; NAS.packUI() -> the screen positions of the slots now showing (for scripted taps).
  window.NAS.compassOpen = () => takeOut();
  window.NAS.packOpen = () => { C.phase = 'slot'; C.t = 0; C.target = null; lay = null; };
  window.NAS.gear = (id, on) => { if (on && find(pack, id) < 0) add(pack, id, 1); wear(id, on); };   // e.g. NAS.gear('axes', true)
  window.NAS.snowshoes = on => window.NAS.gear('snowshoes', on);
  window.NAS.openSled = () => { C.target = shownT = { kind: 'sled', ref: state.sled, x: SLED.x, y: SLED.y }; C.phase = 'transfer'; C.t = 0; side = feet().x >= worldToScreen(SLED.x, SLED.y).x ? 1 : -1; lay = null; };
  window.NAS.eat = () => { const i = find(pack, 'food'); if (i >= 0) startEat(i); };
  window.NAS.splint = () => { const i = find(pack, 'splint'); if (i >= 0) startSplint(i); };
  window.NAS.packUI = () => { lay = null; const L = layouts(); return { pack: L.pack, cont: L.cont || [], r: L.r }; };
}

export function update(dt) {
  lay = null;
  const mv = moving();
  C.t += dt;

  // arrived at a container a press sent them to: dig in it (as if held: walking off cancels)
  // (once they've come to a stop: within 1.5 s of arriving, or not at all)
  if (pending) {
    if (state.events.some(e => e.type === 'arrive')) pending.arrived = state.time;
    if (pending.arrived) {
      if (!mv && C.phase === 'idle' && dist(pending) < REACH[pending.kind] + 2) { const t = pending; pending = null; holding = true; holdCode = 'auto'; startRummage(t); if (C.phase !== 'rummage') holdCode = null; }
      else if (state.time - pending.arrived > 1.5) pending = null;
    } else if (P.mode !== 'approach') pending = null;
  }

  // a press held on a slot: once it's been held long enough, drop one / move the whole stack
  if (press && !press.done && state.time - press.t >= holdNeed() && (C.phase === 'slot' || C.phase === 'transfer')) { press.done = true; slotAction(press, true); }

  // an alerted bear close by: no kneeling over a pack
  if (C.phase !== 'idle' && C.phase !== 'out' && bearClose()) close();

  if (C.phase === 'rummage') {
    const t = C.target;
    // Let go, start walking, or get caught out by the weather: the dig is abandoned.
    if (!holding || mv || packBlocked() || (t && dist(t) > REACH[t.kind] + LEAVE)) { close(); holdCode = holdCode === 'auto' ? null : holdCode; }
    else if (C.t >= (t?.kind === 'ground' ? PILE_S : RUMMAGE_S)) {
      C.phase = t ? 'transfer' : 'slot'; C.t = 0; doorPress = false;
      if (holdCode === 'auto') { holding = false; holdCode = null; }
      if (t) { side = feet().x >= worldToScreen(t.x, t.y).x ? 1 : -1; shownT = t; }
    }
  } else if (C.phase === 'slot') {
    if ((C.t > SLOT_TIMEOUT_S && !press) || (mv && !wasMoving) || packBlocked()) close();
  } else if (C.phase === 'transfer') {
    const t = C.target;
    if (!t || (C.t > XFER_TIMEOUT_S && !press) || (mv && !wasMoving) || packBlocked() || dist(t) > REACH[t.kind] + LEAVE) close();
  } else if (C.phase === 'eat') {
    const s = pack.slots[C.eatI];
    if (mv || packBlocked() || !s || s.id !== 'food') {
      // walked off (or the weather got in): the ration goes back uneaten
      state.events.push({ type: 'eat', stage: 'stop', x: P.x, y: P.y });
      if (mv) { C.phase = 'idle'; C.t = 0; } else { C.phase = 'slot'; C.t = 0; }
    } else {
      chewT -= dt;
      if (chewT <= 0 && C.t < EAT_S - 0.2) { chewT = 0.38 + Math.random() * 0.14; state.events.push({ type: 'eat', stage: 'chew', x: P.x, y: P.y }); }
      if (C.t >= EAT_S) {
        take(pack, C.eatI, 1);
        const B = state.body;
        if (B) { B.food = Math.min(1, B.food + EAT_FOOD); B.warmth = Math.min(1, B.warmth + EAT_WARM); }
        state.events.push({ type: 'eat', stage: 'done', x: P.x, y: P.y });
        C.phase = 'slot'; C.t = 0;
      }
    }
  } else if (C.phase === 'splint') {
    const s = pack.slots[C.splintI];
    if (mv || packBlocked() || !s || s.id !== 'splint') {
      // stood up and walked off (or the weather got in): the splint goes back unused
      state.events.push({ type: 'splint', stage: 'stop', x: P.x, y: P.y });
      if (mv) { C.phase = 'idle'; C.t = 0; } else { C.phase = 'slot'; C.t = 0; }
    } else {
      wrapT -= dt;
      if (wrapT <= 0 && C.t < SPLINT_S - 0.3) { wrapT = 0.55 + Math.random() * 0.3; state.events.push({ type: 'splint', stage: 'wrap', x: P.x, y: P.y }); }
      if (C.t >= SPLINT_S) {
        take(pack, C.splintI, 1);
        const B = state.body;
        if (B) { B.injury = Math.max(0, B.injury - SPLINT_HEAL); B.splint = true; }
        state.events.push({ type: 'splint', stage: 'done', x: P.x, y: P.y });
        C.phase = 'slot'; C.t = 0;
      }
    }
  } else if (C.phase === 'out') {
    if (blocked() || inTent() || C.t > OUT_S || find(pack, 'compass') < 0) stow();
  }
  if (C.phase !== 'rummage' && C.phase !== 'transfer') C.target = null;
  if (press && C.phase !== 'slot' && C.phase !== 'transfer') press = null;
  wasMoving = mv;

  // Snowshoes go back in the pack the moment you climb or step onto ice (not thin ice).
  if (worn('snowshoes') && shoesBlocked()) wear('snowshoes', false, true);

  // Fades.
  const k = Math.min(1, dt * 8);
  const open = C.phase === 'slot' || C.phase === 'transfer' || C.phase === 'eat' || C.phase === 'splint';
  C.slotA += ((open ? 1 : 0) - C.slotA) * k;
  C.xferA += ((C.phase === 'transfer' ? 1 : 0) - C.xferA) * k;
  if (C.phase === 'transfer') shownT = C.target;
  C.outA += ((C.phase === 'out' ? 1 : 0) - C.outA) * Math.min(1, dt * 6);

  // Needle: an underdamped spring toward north, kicked by the wind and by walking.
  if (C.outA > 0.01) {
    const w = state.wind, gust = w.gust || 0;
    const storm = Math.min(1, w.speed + gust);
    let d = NORTH - C.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const shk = 1.5 + 55 * storm * storm + (mv ? 6 : 0);
    C.vel += (d * 26 - C.vel * 3.2 + (Math.random() - 0.5) * shk * 6) * dt;
    C.angle += C.vel * dt;
  }
  while (puffs.length && state.time - puffs[0].t > 0.8) puffs.shift();
}

// --- drawing: in the world ---------------------------------------------------------------------------
// A pile is what's in it, drawn small and laid on the snow (the slot icons at about a quarter of
// the explorer's height), over a soft contact shadow to the lower right. Snow settles over it
// with time (faster in a storm), never quite hiding it.
function drawPile(ctx, g) {
  const z = zoom(), items = g.slots.filter(Boolean).slice(0, 3);
  ctx.beginPath(); ctx.ellipse(g.x + 0.6, g.y + 0.35, 2.4 + items.length * 0.9, 1.0, 0, 0, TAU);
  ctx.fillStyle = 'rgba(112,116,122,0.22)'; ctx.fill();
  ctx.save();
  ctx.translate(g.x, g.y - 1.1);
  ctx.scale(1 / z, 1 / z * 0.62);   // icons are drawn in screen px; laid flat on the ground
  items.forEach((s, k) => {
    ctx.save();
    ctx.translate((k - (items.length - 1) / 2) * 2.6 * z, (k % 2 ? 0.5 : -0.3) * z);
    ctx.rotate((k - 1) * 0.35 + 0.2);
    ITEMS[s.id].icon(ctx, 3.0 * z, z * 0.55);
    ctx.restore();
  });
  ctx.restore();
  // the snow on it: soft white lumps over the top edges, building up
  const snow = g.snow || 0;
  if (snow > 0.02) {
    const n = 2 + items.length * 2;
    ctx.fillStyle = `rgba(248,248,246,${0.25 + 0.6 * snow})`;
    for (let k = 0; k < n; k++) {
      const u = (k / (n - 1) - 0.5) * (2.2 + items.length * 2.2), v = Math.sin(k * 2.7 + g.x) * 0.5;
      ctx.beginPath(); ctx.ellipse(g.x + u, g.y - 1.4 + v, 0.6 + 1.2 * snow, 0.35 + 0.6 * snow, 0, 0, TAU); ctx.fill();
    }
  }
}
// Snow kicked up by a move: a few pale puffs opening and fading.
function drawPuffs(ctx) {
  for (const p of puffs) {
    const a = (state.time - p.t) / 0.8;
    if (a < 0 || a > 1) continue;
    for (let k = 0; k < 4; k++) {
      const ang = k * 1.7 + p.x, rr = 0.8 + 3.2 * Math.sqrt(a);
      ctx.beginPath(); ctx.ellipse(p.x + Math.cos(ang) * rr, p.y - 1 - a * 2.2 + Math.sin(ang) * rr * 0.4, 0.9 + 1.4 * a, 0.6 + 0.9 * a, 0, 0, TAU);
      ctx.fillStyle = `rgba(250,250,249,${0.85 * (1 - a)})`; ctx.fill();
      ctx.lineWidth = 0.12; ctx.strokeStyle = `rgba(120,124,130,${0.4 * (1 - a)})`; ctx.stroke();
    }
  }
}
// The glint: a small signal-yellow catch of light on what can be opened, while nothing is open:
// from twice its reach (faint) to within it (full), slow, twinkling now and then. Never under
// ~12 screen px across, so it reads on a phone.
let glintAt = null, glintK = 0;
function drawGlint(ctx) {
  const g = glintAt;
  if (!g) return;
  const ph = (state.time * 0.7 + g.x * 0.01) % 1;
  const tw = Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 3);
  const min = 6 / (1.6 * zoom());                  // a 1.6 s arm >= 6 px: >= 12 px across
  const a = (0.45 + 0.55 * tw) * glintK, s = Math.max(min * (0.8 + 0.5 * tw), 0.7 + 0.9 * tw);
  ctx.globalAlpha = a * 0.3;
  ctx.beginPath(); ctx.arc(g.x, g.y, 1.5 * s, 0, TAU);
  ctx.fillStyle = SIGNAL.glow; ctx.fill();
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y - 1.6 * s); ctx.lineTo(g.x + 0.28 * s, g.y - 0.28 * s); ctx.lineTo(g.x + 1.2 * s, g.y);
  ctx.lineTo(g.x + 0.28 * s, g.y + 0.28 * s); ctx.lineTo(g.x, g.y + 1.6 * s); ctx.lineTo(g.x - 0.28 * s, g.y + 0.28 * s);
  ctx.lineTo(g.x - 1.2 * s, g.y); ctx.lineTo(g.x - 0.28 * s, g.y - 0.28 * s); ctx.closePath();
  ctx.fillStyle = SIGNAL.glow; ctx.fill();
  ctx.lineWidth = Math.max(0.1, 0.8 / zoom()); ctx.strokeStyle = SIGNAL.base; ctx.stroke();
  ctx.globalAlpha = 1;
}
// where the glint sits on each: the sled's middle lashing (near side, over the load), the body's
// pack, the top of the pile
function glintPoint(t) {
  if (t.kind === 'sled') { const lx = -1.8, ly = 2.4, h = 5.6; return { x: SLED.x + lx * SLED_C - ly * SLED_S, y: SLED.y + (lx * SLED_S + ly * SLED_C) * 0.72 - h }; }
  if (t.kind === 'fallen') return { x: t.x - 0.5, y: t.y - 2.6 };
  return { x: t.x + 0.8, y: t.y - 2.2 };
}
const pileDraw = new WeakMap();
const puffItem = { x: 0, y: 0, draw: drawPuffs }, glintItem = { x: 0, y: 0, draw: drawGlint };
const items = [];
export function drawables() {
  items.length = 0;
  const r = visibleRect(10);
  const snowRate = 1 / 240 * (0.3 + (state.weather.snowfall ?? 0.3) + 0.5 * (state.wind.speed ?? 0.3));
  for (const g of state.ground) {
    g.snow = Math.min(0.75, (g.snow || 0) + snowRate * (state.dt || 0));
    if (g.x < r.x0 || g.x > r.x1 || g.y < r.y0 || g.y > r.y1) continue;
    let d = pileDraw.get(g);
    if (!d) { d = { x: g.x, y: g.y, draw: ctx => drawPile(ctx, g) }; pileDraw.set(g, d); }
    items.push(d);
  }
  if (puffs.length) { const p = puffs[puffs.length - 1]; puffItem.x = p.x; puffItem.y = p.y + 4; items.push(puffItem); }
  glintAt = null;
  if (C.phase === 'idle' && !away() && !inTent() && !bearClose()) {
    const t = nearest(2);
    if (t) { const d = dist(t) / REACH[t.kind]; glintK = d <= 1 ? 1 : 0.35 + 0.65 * (1 - (d - 1)); glintAt = glintPoint(t); glintItem.x = t.x; glintItem.y = (t.kind === 'sled' ? SLED.y + 6 : t.y + 2); items.push(glintItem); }
  }
  return items;
}

// --- drawing: the UI (screen space, after the night grade so it stays legible) ------------------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const slotPath = (ctx, x, y, r, sq) => { if (sq) roundRect(ctx, x - r, y - r, 2 * r, 2 * r, r * 0.26); else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); } };

// One slot: grey and translucent with a white ring (signal yellow while worn), the item's ink
// icon inside, a pip for each in the stack; faint when empty. Round in the pack, square (crate-
// like) in a container. hold 0..1 draws the press-and-hold arc round it (white, ink-edged); dim
// greys it (can't use it here).
function drawSlot(ctx, x, y, r, s, o) {
  const z = zoom();
  const sh = shakes.get(o.key);
  let no = 0;
  if (sh !== undefined) {
    const age = state.time - sh;
    if (age > 0.5) shakes.delete(o.key);
    else { no = 1 - age / 0.5; x += Math.sin(age * 46) * Math.min(7, r * 0.42) * no; }   // refused: a quick side-to-side shake
  }
  const lw = Math.max(1.2, z * 0.35);
  ctx.globalAlpha = o.a * (s ? (o.dim ? 0.45 : 1) : 0.42);
  slotPath(ctx, x, y, r, o.sq);
  ctx.fillStyle = !s ? 'rgba(150,152,158,0.16)' : s.id === 'compass' && !o.sq ? 'rgba(255,255,255,0.28)' : o.sq ? 'rgba(140,138,134,0.5)' : 'rgba(150,152,158,0.42)';
  ctx.fill();
  ctx.lineWidth = s ? lw : Math.max(1, z * 0.2);
  // (the ring darkens to ink for a moment while it shakes its head)
  ctx.strokeStyle = no > 0 ? `rgba(40,40,44,${0.4 + 0.5 * no})` : s && s.worn ? SIGNAL.lit : 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(40,40,44,0.3)';
  slotPath(ctx, x, y, r + lw, o.sq);
  ctx.stroke();
  if (o.sq && s) {
    // a crate's plank seam across the top and bottom
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 0.72); ctx.lineTo(x + r * 0.8, y - r * 0.72); ctx.stroke();
  }
  if (s) {
    ctx.save();
    ctx.translate(x, y - (s.n > 1 ? r * 0.1 : 0));   // (up a touch to make room for the pips)
    ITEMS[s.id].icon(ctx, s.n > 1 ? r * 0.92 : r, z);
    ctx.restore();
    if (s.n > 1) {
      // the stack: an ink pip for each, along the bottom of the slot
      const pr = Math.max(1.5, r * 0.09), gap = pr * 2.7;
      for (let k = 0; k < s.n; k++) {
        ctx.beginPath(); ctx.arc(x + (k - (s.n - 1) / 2) * gap, y + r * 0.72, pr, 0, TAU);
        ctx.fillStyle = 'rgba(40,36,30,0.9)'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(236,235,230,0.9)'; ctx.stroke();
      }
    }
    if (o.dim) {      // greyed out: can't use it here
      ctx.globalAlpha = o.a * 0.55;
      slotPath(ctx, x, y, r, o.sq);
      ctx.fillStyle = 'rgba(200,200,204,0.6)'; ctx.fill();
    }
  }
  if (o.hold > 0.01) {
    ctx.globalAlpha = o.a;
    ctx.beginPath(); ctx.arc(x, y, r * (o.sq ? 1.42 : 1) + lw * 2.2, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, o.hold));
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3.5, z * 1.0); ctx.strokeStyle = 'rgba(40,40,44,0.35)'; ctx.stroke();   // (an ink edge, so it reads on snow)
    ctx.lineWidth = Math.max(2, z * 0.6); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
    ctx.lineCap = 'butt';
  }
}
// A faint dashed ink tether from a block to its owner (from the block's nearest slot edge to just
// short of the owner), with a pale halo so it reads on dark rock.
function tether(ctx, pos, r, owner, a) {
  if (!pos.length || !owner) return;
  let p = pos[0], bd = 1e9;
  for (const q of pos) { const d = Math.hypot(q.x - owner.x, q.y - owner.y); if (d < bd) { bd = d; p = q; } }
  if (bd < r * 1.6) return;
  const ux = (owner.x - p.x) / bd, uy = (owner.y - p.y) / bd;
  const x0 = p.x + ux * (r + 4), y0 = p.y + uy * (r + 4), x1 = owner.x - ux * 6, y1 = owner.y - uy * 6;
  ctx.globalAlpha = a;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(40,40,44,0.55)'; ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x1, y1, 1.8, 0, TAU); ctx.fillStyle = 'rgba(40,40,44,0.6)'; ctx.fill();
}

export function drawScreen(ctx) {
  const sleepK = inTent() && C.phase === 'idle' && canSleep() ? state.body?.sleepHold || 0 : 0;
  const hint = C.phase === 'idle' ? P.patHint || 0 : 0;
  if (C.phase === 'idle' && C.slotA < 0.01 && C.outA < 0.01 && C.xferA < 0.01 && sleepK < 0.01 && hint <= 0) return;
  const { dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lay = null;
  const L = layouts();
  const f = feet(), z = zoom();
  const top = f.y - HEAD * z;

  // The dig bar: transparent white with a white fill, over the explorer's head (the tent door).
  // The same bar fills over the door as a hold there sleeps (after dark), and its first fifth
  // flashes over the explorer as they pat the pack, the once (the hold, taught without words).
  if (C.phase === 'rummage' || sleepK > 0.01 || hint > 0) {
    const w = BAR_W * z, h = Math.max(4, BAR_H * z), x = f.x - w / 2, y = f.y - BAR_Y * z - h / 2;
    const frac = C.phase === 'rummage' ? Math.min(1, C.t / (C.target?.kind === 'ground' ? PILE_S : RUMMAGE_S)) : sleepK > 0.01 ? sleepK : 0.2;
    ctx.globalAlpha = C.phase === 'rummage' ? Math.min(1, C.t * 6) : sleepK > 0.01 ? Math.min(1, sleepK * 5) : Math.min(1, 1.6 * Math.sin(Math.PI * hint)) * (0.75 + 0.25 * Math.sin(state.time * 9));
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(40,40,44,0.35)';   // faint edge so it reads on white snow
    ctx.stroke();
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x, y, w * frac, h);
      ctx.restore();
    }
  }

  const pop = 0.7 + 0.3 * C.slotA, need = holdNeed();
  const holdK = (block, i) => (press && !press.done && press.block === block && press.i === i ? Math.max(0, (state.time - press.t - ARC_FROM) / (need - ARC_FROM)) : 0);
  // The container's block, beside it, tethered to it.
  if (C.xferA > 0.01 && shownT && L.cont) {
    const pc = 0.7 + 0.3 * C.xferA;
    tether(ctx, L.cont, L.r, L.contOwner, C.xferA);
    for (const p of L.cont) drawSlot(ctx, p.x, p.y, L.r * pc * 0.9, shownT.ref.slots[p.i], { a: C.xferA, key: 'cont:' + p.i, sq: true, hold: holdK('cont', p.i) });
  }
  // The pack, beside the explorer (tethered to them while a container is open too).
  if (C.slotA > 0.01) {
    const hb = blocked(), it = inTent();
    if (C.xferA > 0.01) tether(ctx, L.pack.slice(0, 5), L.r, L.packOwner, C.xferA);
    L.pack.forEach((p, i) => {
      const s = pack.slots[i];
      const dim = !!s && C.phase !== 'transfer' && ITEMS[s.id].blocked({ i, slot: s, handsBlocked: hb, inTent: it });
      let hold = holdK('pack', i);
      if (C.phase === 'eat' && i === C.eatI) hold = C.t / EAT_S;   // eating: the arc fills over the meal
      if (C.phase === 'splint' && i === C.splintI) hold = C.t / SPLINT_S;   // ...and over the binding
      drawSlot(ctx, p.x, p.y, L.r * pop, s, { a: C.slotA, key: 'pack:' + i, dim, hold });
    });
  }

  // The needle itself, over the explorer.
  if (C.outA > 0.01) {
    const len = 5 * z;
    const y = top - 1 * z;
    // a faint dial so the needle has somewhere to live
    ctx.globalAlpha = C.outA * 0.55;
    ctx.beginPath();
    ctx.arc(f.x, y, len * 1.25, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    drawNeedle(ctx, f.x, y, len, C.angle, C.outA);
  }
  ctx.globalAlpha = 1;
}
