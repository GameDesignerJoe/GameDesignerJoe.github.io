// The pack: the only UI, and only on demand. Press and hold the explorer to dig in it (~0.45 s, a
// bar over the head); when it fills, the pack's 10 round slots open beside them: two columns of
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
// It stays open until tapped off (a tap off only closes it; it doesn't walk), or walked off with
// the keys. Things that can't be used here are greyed.
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
// The pup tent (slice 6, actors/puptent.js): tap it in the pack and it's pitched beside the
// explorer (refused with a shake if the ground won't take it); the pack closes and the work plays
// out on the snow (walking off stops it, and the tent stays in the pack). The pack opens in a gale too:
// then the compass and the gear are dimmed and refused (see stormy()); the rest goes on. Pitched, a quick
// tap on it from close by crawls in, as anywhere on it does; press and hold it from right by it (within 5;
// a white arc fills round its glint over 0.9 s) and the explorer kneels and strikes it (~4 s, the dig bar filling over them; letting go
// stops it and it stays up), back into the pack (a full pack: it jerks, the knock). Within reach a
// glint catches on its ridge. Keyboard: hold Space / E close to it.
//
// Splinting (slice 5): tap a splint while hurt. The explorer sits in the snow with the bad leg out
// and binds it for 4 s (explorer.js); moving cancels it and the splint isn't used. Injury -0.25 at
// once, and the limp costs half the pace until the next injury (body.splint).
//
// Thirst (slice 6): tap the flask: standing, the explorer unscrews it, tips it back and drinks (~2 s,
// the slot's arc filling); +0.3 water, one of its three drinks (the pips) gone. Moving cancels it and
// the drink stays in the flask. Empty, the flask is dimmed until a tent fills it (body.js). Not above
// 0.97 water (the slot shakes). Under the explorer's feet, the pack shows one more round slot that
// isn't a slot of the pack and holds nothing: the snow (a heap of it in a dashed ring). Tap it, on
// snow, deep snow or a path, and they kneel, scoop a mittful and eat it (SNOW_S, the ring's arc filling):
// +0.12 water for -0.05 warmth (up to twice that already cold): it quenches, and it chills. Off snow
// (ice, rock) it's dimmed. Keyboard: Q. Not in a tent (the stove is melting it there).
//
// state.compass = { phase: 'idle'|'rummage'|'slot'|'out'|'transfer'|'eat'|'splint'|'drink'|'snow', target, ... } (the
//   name is history: it's the pack UI's state). target = { kind: 'sled'|'fallen'|'ground', x, y }
//   while rummaging in / transferring with a container; explorer.js kneels and faces it.
// Pushes events: rummage, compass (taken out), stow (put away), gear { item, on, auto },
//   transfer / pickup / drop { id, n, x, y }, eat { stage: 'start'|'chew'|'done'|'stop' },
//   splint { stage: 'start'|'wrap'|'done'|'stop' }, drink { stage: 'start'|'gulp'|'done'|'stop' },
//   snowEat { stage: 'start'|'scoop'|'chew'|'done'|'stop' },
//   full { x, y } (refused: no room, can't drop here, too full to eat).
import { state } from '../state.js';
import { worldToScreenUI as worldToScreen, screenToWorld, visibleRect } from '../camera.js';   // (not the breathing pulse)
import { SIGNAL } from '../palette.js';
import { SLED, campInteract, tentDoor, sledNudge } from '../actors/camp.js';
import { startPitch, startStrike, stopJob, pupInteract, pupDist, pupGlint, PUP_REACH } from '../actors/puptent.js';
import * as Terrain from '../world/terrain.js';
import { toggle as playRecording, playing as recPlaying } from '../audio/recorder.js';
import { toggle as toggleRadio } from '../audio/radio.js';
import {
  ITEMS, PACK_SLOTS, wearSlot, worn, wear, take, add, room, find, isEmpty, dropAt, sweepGround,
  shoesBlocked, drawNeedle, NORTH, FLASK_DRINKS,
} from '../items.js';

const RUMMAGE_S = 0.45;           // a hold just long enough to be sure they mean it (pack, sled, body)
const PILE_S = 1;                 // ...or to crouch to a pile on the snow
const OUT_S = 12;                 // the compass goes back in the pack after this long
const DROP_S = 1.0;               // press and hold a pack slot this long: drop one on the snow
const MOVE_S = 0.6;               // ...a container slot (or the pack's, at a container): move the stack
const ARC_FROM = 0.3;             // the hold arc only shows after this (a tap never sees it)
const EAT_S = 3, EAT_FOOD = 0.35, EAT_WARM = 0.04;
const SPLINT_S = 4, SPLINT_HEAL = 0.25;
const DRINK_S = 2, DRINK_WATER = 0.3;                 // a pull from the flask (thirst)
const SNOW_S = 2.6, SNOW_WATER = 0.12, SNOW_CHILL = 0.05;   // a mittful of snow: quenches, and chills
const SNOWY = new Set(['snow', 'deep', 'path']);      // where there's snow to scoop
const REACH = { sled: 20, fallen: 16, ground: 12, pup: PUP_REACH };   // how close to rummage (world units; the sled and the pup tent from the edge, on its ground plane)
const STRIKE_ARM = 0.9;           // a press on the pitched pup tent held this long strikes it (shorter: a tap, crawl in)
const LEAVE = 6;                  // ...and how much further walking away closes it
const BEAR_NEAR = 60;             // an alerted bear this close: no kneeling over a pack
const BAR_W = 12, BAR_H = 1.3;    // world units: about twice the explorer's width
const HEAD = 24;                  // height above the feet where the compass dial sits
const BAR_Y = 20;                 // the pack bar sits just above the hood
const TAU = Math.PI * 2;
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const P = state.player, pack = state.pack;
const C = state.compass = { phase: 'idle', t: 0, slotA: 0, outA: 0, xferA: 0, tentA: 0, angle: NORTH + 1.2, vel: 0, target: null, eatI: -1, splintI: -1, drinkI: -1 };
let holding = false;              // pointer or key held on the explorer / a container
let holdCode = null;              // which key is doing the holding ('auto': arrived at a container)
let wasMoving = false;
let press = null;                 // a press on a slot: { block: 'pack'|'cont', i, t, key?, done }
let shownT = null, side = -1;     // the container drawn (kept through its fade), the pack's side
let chewT = 0, wrapT = 0, doorPress = false, pending = null, gulpT = 0, scoopT = 0;
const shakes = new Map();         // 'pack:3' -> time of the refusal
const puffs = [];                 // snow kicked up by a move: { x, y, t }

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth01 = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const zoom = () => state.cam.zoom || 1;
const moving = () => P.moving && P.speed > 2;
// the phases with the pack open beside them (busy eating, binding, drinking or eating snow included)
const OPEN = new Set(['slot', 'transfer', 'eat', 'splint', 'drink', 'snow']);
const BUSY = new Set(['eat', 'splint', 'drink', 'snow']);
// in the tent (alive and awake): the pack opens at the door (by day; after dark a hold sleeps)
const inTent = () => P.mode === 'inside' && (!state.body || state.body.phase === 'alive');
const canSleep = () => { const L = state.lighting; return L.mode === 'cycle' && L.night > 0.5 && L.clock >= 180; };   // (as body.js)
// where the UI hangs from: the explorer's feet, or the tent door from inside
function feet() {
  if (inTent()) { try { const d = P.door?.() || tentDoor(); return worldToScreen(d.fx, d.fy - 2); } catch { /* no camp */ } }
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
// No pack at all: busy elsewhere, in the water, on a wall, walking to one, knocked down.
function packAway() {
  return away() || P.terrain === 'water' || P.mode === 'climb' || P.mode === 'approach' || P.mode === 'down';
}
// Too much weather for fine work with the hands: cowering, a gale, the world's edge. (In a tent,
// never.) The pack still opens in it, and eating, splinting, pitching the pup tent and moving things
// to and from a container all go on; the compass (it can't be held) and putting gear on or taking it
// off (the straps can't be worked) are dimmed and refused.
function stormy() {
  if (inTent()) return false;
  const w = state.wind;
  return P.mode === 'cower' || (w.speed + (w.gust || 0)) > 0.85 || (state.frontier?.amount || 0) > 0.4;
}
function packBlocked() {
  if (inTent()) return false;     // sheltered
  return packAway();
}
const openBlocked = () => packBlocked();
const pupJob = () => state.pup?.job || null;
// Can they hold something in their hands (the compass, a ration)? Not wading through deep snow either.
// (The gale only stops the compass and the gear: stormy().)
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
  if (t.kind === 'pup') return pupDist();
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
// the nearest container within reach (Space / E); with far = 2, within twice that (the glint); the
// pitched pup tent counts (its glint, and Space / E: tap to crawl in, hold to strike)
function nearest(far = 1) {
  let best = null, bd = 1e9;
  const consider = t => { const d = dist(t); if (d < REACH[t.kind] * far && d / REACH[t.kind] < bd) { bd = d / REACH[t.kind]; best = t; } };
  consider({ kind: 'sled', ref: state.sled, x: SLED.x, y: SLED.y });
  for (const f of state.fallen || []) if (f.pack && !f.lost && !isEmpty(f.pack)) consider({ kind: 'fallen', ref: f.pack, x: f.x, y: f.y });
  for (const g of state.ground) consider({ kind: 'ground', ref: g, x: g.x, y: g.y });
  // the pitched pup tent only when nothing else is in reach (the sled, a body, a pile come first)
  const pp = state.pup?.pitched;
  if (!best && pp) consider({ kind: 'pup', ref: null, x: pp.x, y: pp.y });
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
  // the snow at their feet (thirst): one more round slot under the feet, a little to the far side
  // of the columns, never off the bottom of the screen; not in a tent, nor with a container open
  const snow = inTent() || C.phase === 'transfer' || C.xferA > 0.01 ? null : { x: f.x - s * r * 0.35, y: Math.min(f.y + r * 0.95 + 4 + 2 * z, h - r - 6) };
  const out = { r, sp, side: s, pack: packPos, packOwner: { x: f.x, y: f.y - 8 * z }, cont: null, contOwner: null, snow };
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
  if (L.snow && C.phase !== 'transfer') { const d = Math.hypot(sx - L.snow.x, sy - L.snow.y); if (d < reach * 0.9 && d < bd) { bd = d; best = { block: 'snow', i: 0 }; } }
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
  if ((target ? packBlocked() : openBlocked()) || (target && bearClose()) || pupJob()) return;
  C.phase = 'rummage'; C.t = 0; C.target = target;
  state.events.push({ type: 'rummage', x: P.x, y: P.y, target: target?.kind });
}
// The tent menu (Joe): inside a tent, a tap brings up what you can do there, as a row of round
// slots above the tent: leave, eat, drink, sleep (after dark), open the pack. A tap off it closes it.
const TENT_ACTS = ['leave', 'eat', 'drink', 'sleep', 'pack'];
const TENT_NAMES = { leave: 'Leave the tent', eat: 'Eat a ration', drink: 'Drink (snow melted on the stove)', sleep: 'Sleep till dawn', pack: 'Open the pack' };
const TENT_DRINK = 0.35;
function tentLayout() {
  const f = feet(), z = zoom(), r = slotR(), sp = r * 2.5, { w } = state.view;
  const tall = (P.shelter?.kind === 'pup' ? 22 : 38) * z;
  const y = Math.max(r + 8, f.y - tall - r - 6), n = TENT_ACTS.length;
  let x0 = f.x - (n - 1) * sp / 2;
  x0 = Math.max(r + 6, Math.min(w - r - 6 - (n - 1) * sp, x0));
  return { r, pos: TENT_ACTS.map((id, i) => ({ id, i, x: x0 + i * sp, y })) };
}
function tentActAt(sx, sy) {
  const L = tentLayout();
  return L.pos.find(p => Math.hypot(sx - p.x, sy - p.y) < L.r + 8) || null;
}
const tentFlask = () => pack.slots.findIndex(q => q && q.id === 'flask' && q.drinks > 0);
function tentBlocked(id) {
  const B = state.body;
  if (id === 'eat') return find(pack, 'food') < 0 || (B && B.food > 0.95);
  if (id === 'drink') return !!B && B.water > 0.95;
  if (id === 'sleep') return !canSleep();
  return false;
}
function tentAct(p) {
  if (tentBlocked(p.id)) { shake('tent', p.i); return; }
  const B = state.body;
  if (p.id === 'leave') { close(); P.leaveTent?.(); }
  else if (p.id === 'eat') startEat(find(pack, 'food'));
  else if (p.id === 'drink') {
    // from the flask if there's a drink in it (the stove tops it up); else a mug off the stove
    const i = tentFlask();
    if (i >= 0) startDrink(i);
    else if (B) { B.water = Math.min(1, B.water + TENT_DRINK); state.events.push({ type: 'drink', stage: 'done', x: P.x, y: P.y }); close(); }
  }
  else if (p.id === 'sleep') { close(); state.events.push({ type: 'tent', action: 'sleep', x: P.x, y: P.y, shelter: P.shelter }); }
  else if (p.id === 'pack') { C.phase = 'slot'; C.t = 0; C.target = null; lay = null; }
}
const INK_T = 'rgba(40,36,30,0.9)';
const TENT_ICON = {
  // a boot stepping out through the door flap
  leave: (ctx, r) => {
    ctx.strokeStyle = INK_T; ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.45); ctx.lineTo(-r * 0.05, -r * 0.5); ctx.lineTo(r * 0.4, r * 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.0, r * 0.08); ctx.lineTo(r * 0.58, r * 0.08); ctx.moveTo(r * 0.42, -r * 0.1); ctx.lineTo(r * 0.58, r * 0.08); ctx.lineTo(r * 0.42, r * 0.26); ctx.stroke();
    ctx.lineCap = 'butt';
  },
  eat: (ctx, r, z) => ITEMS.food.icon(ctx, r, z),
  drink: (ctx, r, z) => ITEMS.flask.icon(ctx, r, z),
  // a crescent moon
  sleep: (ctx, r) => {
    ctx.fillStyle = INK_T;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.arc(r * 0.2, -r * 0.12, r * 0.38, 0, TAU, true); ctx.fill('evenodd');
  },
  // the rucksack: a body, a flap and two straps
  pack: (ctx, r) => {
    ctx.strokeStyle = INK_T; ctx.lineWidth = Math.max(1, r * 0.07);
    roundRect(ctx, -r * 0.38, -r * 0.32, r * 0.76, r * 0.78, r * 0.14); ctx.fillStyle = 'rgba(96,84,70,0.95)'; ctx.fill(); ctx.stroke();
    roundRect(ctx, -r * 0.4, -r * 0.42, r * 0.8, r * 0.34, r * 0.12); ctx.fillStyle = 'rgba(122,108,90,1)'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.16, -r * 0.1); ctx.lineTo(-r * 0.16, r * 0.3); ctx.moveTo(r * 0.16, -r * 0.1); ctx.lineTo(r * 0.16, r * 0.3); ctx.stroke();
  },
};
function drawTentMenu(ctx) {
  const L = tentLayout(), pop = 0.7 + 0.3 * C.tentA, z = zoom();
  for (const p of L.pos) {
    const dim = tentBlocked(p.id);
    let x = p.x;
    const sh = shakes.get('tent:' + p.i);
    if (sh !== undefined) { const age = state.time - sh; if (age > 0.5) shakes.delete('tent:' + p.i); else x += Math.sin(age * 46) * Math.min(7, L.r * 0.42) * (1 - age / 0.5); }
    const r = L.r * pop, lw = Math.max(1.2, z * 0.35);
    ctx.globalAlpha = C.tentA * (dim ? 0.4 : 1);
    ctx.beginPath(); ctx.arc(x, p.y, r, 0, TAU);
    ctx.fillStyle = 'rgba(150,152,158,0.42)'; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = dim ? 'rgba(170,170,174,0.7)' : 'rgba(255,255,255,0.85)'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(40,40,44,0.3)';
    ctx.beginPath(); ctx.arc(x, p.y, r + lw, 0, TAU); ctx.stroke();
    ctx.save(); ctx.translate(x, p.y); TENT_ICON[p.id](ctx, r, z); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function close() {
  if (C.phase === 'eat') state.events.push({ type: 'eat', stage: 'stop', x: P.x, y: P.y });
  if (C.phase === 'splint') state.events.push({ type: 'splint', stage: 'stop', x: P.x, y: P.y });
  if (C.phase === 'drink') state.events.push({ type: 'drink', stage: 'stop', x: P.x, y: P.y });
  if (C.phase === 'snow') state.events.push({ type: 'snowEat', stage: 'stop', x: P.x, y: P.y });
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
  // (not when already full: no wasting a ration by accident; not with the bear coming)
  if ((state.body && state.body.food > 0.95) || bearClose()) { shake('pack', i); return; }
  C.phase = 'eat'; C.eatI = i; C.t = 0; chewT = 0.9;
  state.events.push({ type: 'eat', stage: 'start', x: P.x, y: P.y });
}
// Bind the hurt leg with the splint in slot i (only when hurt: no wasting it).
function startSplint(i) {
  if (!state.body || !(state.body.injury > 0.02)) { shake('pack', i); return; }
  C.phase = 'splint'; C.splintI = i; C.t = 0; wrapT = 0.8;
  state.events.push({ type: 'splint', stage: 'start', x: P.x, y: P.y });
}
// Drink from the flask in slot i (not when already watered: no wasting it; not empty).
function startDrink(i) {
  const s = pack.slots[i];
  if (!s || !(s.drinks > 0) || (state.body && state.body.water > 0.97)) { shake('pack', i); return; }
  C.phase = 'drink'; C.drinkI = i; C.t = 0; gulpT = 0.75;
  state.events.push({ type: 'drink', stage: 'start', x: P.x, y: P.y });
}
// Eat a mittful of snow: kneel, scoop, eat. Only on snow (deep snow too: there's plenty), never in a tent.
const snowHere = () => !inTent() && SNOWY.has(P.terrain) && !(P.water?.level);
function startSnow() {
  if (!snowHere() || packBlocked() || bearClose() || (state.body && state.body.water > 0.97)) { shakes.set('snow:0', state.time); state.events.push({ type: 'full', x: P.x, y: P.y }); return; }
  C.phase = 'snow'; C.t = 0; scoopT = 0.55;
  state.events.push({ type: 'snowEat', stage: 'start', x: P.x, y: P.y });
}
// Pitch the pup tent in slot i: refused (the slot shakes) if the ground beside them won't take it;
// otherwise the pack closes and the work plays out on the snow (puptent.js).
function pitchSlot(i) {
  if (!startPitch()) { shake('pack', i); return; }
  close();
}
// Tap a pack slot (pack open): use what's in it.
function useSlot(i) {
  const s = pack.slots[i];
  if (!s) return;
  const it = ITEMS[s.id];
  const u = { i, slot: s, handsBlocked: blocked(), storm: stormy(), inTent: inTent(), takeOut, eat: startEat, splint: startSplint, pitch: pitchSlot, drink: startDrink, play: playRecording, radio: () => toggleRadio() };
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
  dropAt(spot[0], spot[1], got.id, got.n, got);
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
  add(to, got.id, got.n, got);
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
  if (p.block === 'snow') { if (C.phase === 'slot') startSnow(); return; }   // (held or tapped: the same)
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

// --- the pitched pup tent: a press on it ------------------------------------------------------------
// Held STRIKE_ARM it strikes the tent (startStrike) for as long as it's held; let go sooner, it was a
// tap: crawl in (explorer.js). state.pup.press is up while a press is on it (explorer.js leaves
// Space / E alone then).
let pupPress = null;              // { t, key, struck }
function pressPup(key = null) {
  pupPress = { t: state.time, key, struck: false };
  if (state.pup) state.pup.press = true;
}
function releasePup() {
  const pp = pupPress;
  pupPress = null;
  if (state.pup) state.pup.press = false;
  if (!pp) return;
  if (!pp.struck) P.pupTent?.();
  else if (pupJob()?.kind === 'strike') stopJob();
}
const nearPup = () => !!state.pup?.pitched && pupDist() < REACH.pup;
// (Space / E at base camp's door is always base camp's)
const nearCampDoor = () => { try { const d = tentDoor(); return Math.hypot(P.x - d.fx, P.y - d.fy) < 15; } catch { return false; } };

// Names on the slots (Joe: tool tips): a mouse hovering a slot, or a finger pressing one (and for a
// moment after the tap), shows the item's name in a small label just above it.
let hoverPt = null, tipSlot = null, tipT = -9;
function tipText(t) {
  if (t.block === 'tent') { const id = TENT_ACTS[t.i]; return TENT_NAMES[id] + (id === 'sleep' && !canSleep() ? ' (after dark)' : ''); }
  if (t.block === 'snow') return snowHere() ? 'Eat snow' : 'Eat snow (no snow here)';
  const c = t.block === 'cont' ? shownT?.ref : pack;
  const s = c?.slots[t.i];
  if (!s) return t.block === 'cont' ? null : 'Empty';
  const it = ITEMS[s.id];
  let txt = it.name;
  if (s.drinks !== undefined) txt += ` (${s.drinks}/${FLASK_DRINKS})`;
  else if (s.n > 1) txt += ` ×${s.n}`;
  if (s.worn) txt += ' · worn';
  return txt;
}
function drawTip(ctx, L) {
  const fresh = state.time - tipT < 1.1;
  const ht = hoverPt && C.phase === 'tentmenu' ? tentActAt(hoverPt.x, hoverPt.y) : null;
  const t = press ? { block: press.block, i: press.i } : ht ? { block: 'tent', i: ht.i } : hoverPt && C.phase !== 'tentmenu' ? slotAt(hoverPt.x, hoverPt.y) : fresh ? tipSlot : null;
  if (!t || t.block === undefined) return;
  const p = t.block === 'tent' ? (C.phase === 'tentmenu' ? tentLayout().pos[t.i] : null) : t.block === 'snow' ? L.snow : t.block === 'cont' ? L.cont?.find(q => q.i === t.i) : L.pack[t.i];
  const txt = p && tipText(t);
  if (!txt) return;
  const a = t.block === 'cont' ? C.xferA : t.block === 'tent' ? C.tentA : C.slotA;
  const fs = Math.max(12, Math.min(15, L.r * 0.62));
  ctx.font = `${fs}px Georgia, serif`;
  const w = ctx.measureText(txt).width + fs * 1.1, h = fs * 1.6;
  const x = Math.max(4, Math.min(state.view.w - w - 4, p.x - w / 2)), y = p.y - L.r * 1.25 - h - 4;
  ctx.globalAlpha = a;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(250,250,247,0.92)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(40,40,44,0.35)'; ctx.stroke();
  ctx.fillStyle = 'rgba(36,33,28,0.95)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, x + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

export function init() {
  addEventListener('pointermove', e => { hoverPt = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null; });
  state.uiPress = (sx, sy) => {
    if (!state.begun && !state.params.has('autostart')) return false;
    if (away()) { close(); return false; }   // presses go to the tent / the hand-over
    pending = null;
    // busy at the pup tent: a press on the explorer is swallowed; anywhere else walks (and stops it)
    if (pupJob()) return onPlayer(sx, sy);
    // a press on the pitched pup tent from close by: tap to crawl in, hold to strike it
    if (C.phase === 'idle' && !inTent() && nearPup()) {
      const w = screenToWorld(sx, sy);
      if (pupInteract(w.x, w.y) && !onPlayer(sx, sy)) { pressPup(); return true; }
    }
    const open = OPEN.has(C.phase);
    if (open) {
      const hit = slotAt(sx, sy);
      if (hit && BUSY.has(C.phase)) return true;   // (busy eating / binding / drinking: swallow it)
      if (hit) { press = { ...hit, t: state.time, done: false }; tipSlot = hit; tipT = state.time; return true; }
    }
    if (inTent()) {
      // in the tent: a tap brings up the tent menu (leave, eat, drink, sleep, pack); a tap on one
      // does it, a tap off the menu (or the open pack) closes it
      if (C.phase === 'tentmenu') {
        const a = tentActAt(sx, sy);
        if (a) { tipSlot = { block: 'tent', i: a.i }; tipT = state.time; tentAct(a); }
        else close();
        return true;
      }
      if (BUSY.has(C.phase)) return true;
      if (open) { close(); return true; }
      if (C.phase === 'idle') { C.phase = 'tentmenu'; C.t = 0; }
      return true;
    }
    if (BUSY.has(C.phase)) {
      close();                     // walked off mid-meal (or mid-binding, mid-drink): the ration / splint / drink goes back
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
    if (open) { close(); return true; }   // tapping off it closes it (and only that: no walk)
    return false;
  };
  state.uiRelease = () => {
    if (pupPress && !pupPress.key) releasePup();
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
    // Q: a mittful of snow (the pack open)
    if (e.code === 'KeyQ' && C.phase === 'slot') { startSnow(); return; }
    if (e.code === 'KeyC') {
      if (C.phase === 'slot') { if (!blocked() && !stormy()) takeOut(); }
      else if (C.phase === 'out') stow();
      else if (C.phase === 'idle' && !away()) { holding = true; holdCode = e.code; startRummage(); }
      return;
    }
    // Space / E close to the sled, a body or a pile: hold to rummage in it (the pup tent: tap to
    // crawl in, hold to strike it)
    if ((e.code === 'Space' || e.code === 'KeyE') && C.phase === 'idle' && !inTent() && !pupJob()) {
      const t = nearest();
      if (t && t.kind === 'pup') { if (!away() && !nearCampDoor()) pressPup(e.code); }
      else if (t) { holding = true; holdCode = e.code; startRummage(t); }
    }
  });
  addEventListener('keyup', e => {
    if (pupPress && pupPress.key === e.code) releasePup();
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
  // thirst: NAS.drink() drinks from the first flask with a drink in it; NAS.snowEat() eats a mittful of snow
  window.NAS.drink = () => { const i = pack.slots.findIndex(q => q && q.id === 'flask' && q.drinks > 0); if (i >= 0) { if (C.phase === 'idle') { C.phase = 'slot'; C.t = 0; } startDrink(i); } };
  window.NAS.snowEat = () => { if (C.phase === 'idle') { C.phase = 'slot'; C.t = 0; } startSnow(); };
  window.NAS.tentUI = () => tentLayout();   // the tent menu's slot positions (inside a tent)
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

  // a press held on the pitched pup tent: long enough, and it's a strike (needs a slot free)
  if (pupPress && !pupPress.struck && state.time - pupPress.t >= STRIKE_ARM) {
    pupPress.struck = true;
    if (!startStrike()) { pupPress = null; if (state.pup) state.pup.press = false; }
  }
  if (pupPress && pupPress.struck && !pupJob()) { pupPress = null; if (state.pup) state.pup.press = false; }   // done (or stopped)
  if (pupJob() && C.phase !== 'idle') close();

  // a press held on a slot: once it's been held long enough, drop one / move the whole stack
  if (press && !press.done && state.time - press.t >= holdNeed() && (C.phase === 'slot' || C.phase === 'transfer')) { press.done = true; slotAction(press, true); }

  // an alerted bear close by: no kneeling over a pack
  if (C.phase !== 'idle' && C.phase !== 'out' && bearClose()) close();

  if (C.phase === 'tentmenu' && !inTent()) close();
  if (C.phase === 'rummage') {
    const t = C.target;
    // Let go, start walking, or get caught out by the weather: the dig is abandoned.
    if (!holding || mv || (t ? packBlocked() : openBlocked()) || (t && dist(t) > REACH[t.kind] + LEAVE)) { close(); holdCode = holdCode === 'auto' ? null : holdCode; }
    else if (C.t >= (t?.kind === 'ground' ? PILE_S : RUMMAGE_S)) {
      C.phase = t ? 'transfer' : 'slot'; C.t = 0; doorPress = false;
      if (holdCode === 'auto') { holding = false; holdCode = null; }
      if (t) { side = feet().x >= worldToScreen(t.x, t.y).x ? 1 : -1; shownT = t; }
    }
  } else if (C.phase === 'slot') {
    if ((mv && !wasMoving && !state.input.pointer) || openBlocked()) close();   // stays open till tapped off
  } else if (C.phase === 'transfer') {
    const t = C.target;
    if (!t || (mv && !wasMoving && !state.input.pointer) || packBlocked() || dist(t) > REACH[t.kind] + LEAVE) close();
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
  } else if (C.phase === 'drink') {
    const s = pack.slots[C.drinkI];
    if (mv || (!inTent() && blocked()) || !s || s.id !== 'flask' || !(s.drinks > 0)) {
      // walked off (or the weather got in): screwed back up, the drink still in it
      state.events.push({ type: 'drink', stage: 'stop', x: P.x, y: P.y });
      if (mv) { C.phase = 'idle'; C.t = 0; } else { C.phase = 'slot'; C.t = 0; }
    } else {
      gulpT -= dt;
      if (gulpT <= 0 && C.t > 0.7 && C.t < DRINK_S - 0.35) { gulpT = 0.36 + Math.random() * 0.1; state.events.push({ type: 'drink', stage: 'gulp', x: P.x, y: P.y }); }
      if (C.t >= DRINK_S) {
        s.drinks = Math.max(0, s.drinks - 1);
        const B = state.body;
        if (B) B.water = Math.min(1, B.water + DRINK_WATER);
        state.events.push({ type: 'drink', stage: 'done', x: P.x, y: P.y, left: s.drinks });
        C.phase = 'slot'; C.t = 0;
      }
    }
  } else if (C.phase === 'snow') {
    if (mv || !snowHere() || packBlocked() || bearClose()) {
      state.events.push({ type: 'snowEat', stage: 'stop', x: P.x, y: P.y });
      if (mv) { C.phase = 'idle'; C.t = 0; } else { C.phase = 'slot'; C.t = 0; }
    } else {
      // the scoop (the mitt down in the snow ~0.5 s in), then the crunch of it at the mouth
      scoopT -= dt;
      if (scoopT <= 0 && C.t < SNOW_S - 0.3) { scoopT = C.t < 1.0 ? 0.42 + Math.random() * 0.1 : 0.34 + Math.random() * 0.12; state.events.push({ type: 'snowEat', stage: C.t < 1.0 ? 'scoop' : 'chew', x: P.x, y: P.y }); }
      if (C.t >= SNOW_S) {
        const B = state.body;
        if (B) {
          // snow takes the heat to melt it: more of it the colder they are already
          const chill = SNOW_CHILL * (1 + smooth01(0.6, 0.2, B.warmth));
          B.water = Math.min(1, B.water + SNOW_WATER);
          B.warmth = Math.max(0.01, B.warmth - chill);
        }
        state.events.push({ type: 'snowEat', stage: 'done', x: P.x, y: P.y });
        C.phase = 'slot'; C.t = 0;
      }
    }
  } else if (C.phase === 'out') {
    if (blocked() || stormy() || inTent() || C.t > OUT_S || find(pack, 'compass') < 0) stow();
  }
  if (C.phase !== 'rummage' && C.phase !== 'transfer') C.target = null;
  if (press && C.phase !== 'slot' && C.phase !== 'transfer') press = null;
  wasMoving = mv;

  // Snowshoes go back in the pack the moment you climb or step onto ice (not thin ice).
  if (worn('snowshoes') && shoesBlocked()) wear('snowshoes', false, true);

  // Fades.
  const k = Math.min(1, dt * 8);
  const open = OPEN.has(C.phase);
  C.slotA += ((open ? 1 : 0) - C.slotA) * k;
  C.xferA += ((C.phase === 'transfer' ? 1 : 0) - C.xferA) * k;
  C.tentA += ((C.phase === 'tentmenu' ? 1 : 0) - C.tentA) * k;
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
  if (t.kind === 'pup') return pupGlint() || { x: t.x, y: t.y - 6 };
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
  if (C.phase === 'idle' && !away() && !inTent() && !bearClose() && !pupJob()) {
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
  ctx.globalAlpha = o.a * (s ? (o.dim ? 0.38 : 1) : 0.42);
  slotPath(ctx, x, y, r, o.sq);
  ctx.fillStyle = !s ? 'rgba(150,152,158,0.16)' : s.id === 'compass' && !o.sq ? 'rgba(255,255,255,0.28)' : o.sq ? 'rgba(140,138,134,0.5)' : 'rgba(150,152,158,0.42)';
  ctx.fill();
  ctx.lineWidth = s ? lw : Math.max(1, z * 0.2);
  // (the ring darkens to ink for a moment while it shakes its head)
  ctx.strokeStyle = no > 0 ? `rgba(40,40,44,${0.4 + 0.5 * no})` : s && s.worn ? SIGNAL.lit : o.dim ? 'rgba(170,170,174,0.7)' : 'rgba(255,255,255,0.85)';
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
    const pips = s.n > 1 || s.drinks !== undefined;
    ctx.translate(x, y - (pips ? r * 0.1 : 0));   // (up a touch to make room for the pips)
    ITEMS[s.id].icon(ctx, pips ? r * 0.92 : r, z);
    ctx.restore();
    if (s.n > 1 || s.drinks !== undefined) {
      // the stack: an ink pip for each, along the bottom of the slot (a flask: a pip a drink, the
      // drunk ones hollow)
      const pr = Math.max(1.5, r * 0.09), gap = pr * 2.7, n = s.drinks !== undefined ? FLASK_DRINKS : s.n;
      for (let k = 0; k < n; k++) {
        const full = s.drinks === undefined || k < s.drinks;
        ctx.beginPath(); ctx.arc(x + (k - (n - 1) / 2) * gap, y + r * 0.72, pr, 0, TAU);
        ctx.fillStyle = full ? 'rgba(40,36,30,0.9)' : 'rgba(236,235,230,0.55)'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = full ? 'rgba(236,235,230,0.9)' : 'rgba(40,36,30,0.6)'; ctx.stroke();
      }
    }
    if (o.dim) {      // greyed out: can't use it here
      ctx.globalAlpha = o.a * 0.8;
      slotPath(ctx, x, y, r, o.sq);
      ctx.fillStyle = 'rgba(206,206,210,0.72)'; ctx.fill();
    }
  }
  if (s && ((ITEMS[s.id].rec && recPlaying() === ITEMS[s.id].rec.id) || (s.id === 'radio' && state.radio?.on))) {
    const a0 = state.time * 2.2;
    ctx.globalAlpha = o.a; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r + lw * 2.2, a0, a0 + 1.6);
    ctx.lineWidth = Math.max(2, z * 0.6); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
    ctx.lineCap = 'butt';
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
// The snow at their feet (thirst): not a slot of the pack, so not drawn like one: no grey fill, a
// dashed white ring, and inside it a little heap of snow (white, inked, stippled, a scoop taken out
// of its top). Dimmed off snow. hold: the arc (filling while they eat it).
function drawSnowSlot(ctx, x, y, r, o) {
  const z = zoom(), sh = shakes.get('snow:0');
  if (sh !== undefined) {
    const age = state.time - sh;
    if (age > 0.5) shakes.delete('snow:0');
    else x += Math.sin(age * 46) * Math.min(7, r * 0.42) * (1 - age / 0.5);
  }
  const a = o.a * (o.dim ? 0.45 : 1), lw = Math.max(1.2, z * 0.35);
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = 'rgba(244,245,246,0.22)'; ctx.fill();
  ctx.setLineDash([Math.max(2.5, r * 0.22), Math.max(2, r * 0.16)]);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,40,44,0.28)'; ctx.stroke();
  ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  ctx.setLineDash([]);
  // the heap: a low mound, its shaded underside, the scoop out of its top, stipple along its foot
  const mw = r * 0.62, mh = r * 0.42, by = y + r * 0.3;
  ctx.beginPath();
  ctx.moveTo(x - mw, by);
  ctx.bezierCurveTo(x - mw * 0.75, by - mh * 0.9, x - mw * 0.3, by - mh * 1.05, x - mw * 0.12, by - mh * 0.92);
  ctx.quadraticCurveTo(x + mw * 0.08, by - mh * 0.55, x + mw * 0.3, by - mh * 0.9);   // the scoop
  ctx.bezierCurveTo(x + mw * 0.6, by - mh * 0.95, x + mw * 0.85, by - mh * 0.5, x + mw, by);
  ctx.closePath();
  ctx.fillStyle = 'rgba(252,252,251,0.98)'; ctx.fill();
  ctx.lineWidth = Math.max(1, z * 0.26); ctx.strokeStyle = 'rgba(40,40,44,0.85)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + mw * 0.1, by - mh * 0.12, mw * 0.72, mh * 0.18, 0, 0, Math.PI);
  ctx.fillStyle = 'rgba(176,182,190,0.6)'; ctx.fill();
  ctx.fillStyle = 'rgba(40,40,44,0.75)';
  for (const [u, v] of [[-0.8, -0.06], [-0.55, -0.3], [0.5, -0.2], [0.78, -0.08], [0.15, -0.5], [-0.2, -0.12]]) {
    ctx.beginPath(); ctx.arc(x + u * mw, by + v * mh, Math.max(0.7, r * 0.035), 0, TAU); ctx.fill();
  }
  // three flakes falling onto it (so it's snow, not a loaf or a cloud): little inked six-armed stars
  ctx.lineWidth = Math.max(0.8, z * 0.16); ctx.strokeStyle = 'rgba(40,40,44,0.8)'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [u, v, k] of [[-0.42, -0.62, 1], [0.18, -0.86, 0.8], [0.55, -0.5, 0.9]]) {
    const cx = x + u * r, cy = y + v * r * 0.75, fr = r * 0.11 * k;
    for (let a = 0; a < 3; a++) { const ang = a * Math.PI / 3 + 0.3; ctx.moveTo(cx - Math.cos(ang) * fr, cy - Math.sin(ang) * fr); ctx.lineTo(cx + Math.cos(ang) * fr, cy + Math.sin(ang) * fr); }
  }
  ctx.stroke(); ctx.lineCap = 'butt';
  if (o.hold > 0.01) {
    ctx.globalAlpha = o.a;
    ctx.beginPath(); ctx.arc(x, y, r + lw * 2.2, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, o.hold));
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3.5, z * 1.0); ctx.strokeStyle = 'rgba(40,40,44,0.35)'; ctx.stroke();
    ctx.lineWidth = Math.max(2, z * 0.6); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = 1;
}
// The press held on the pitched pup tent, before the strike starts: a white, ink-edged arc round the
// glint on its ridge (the slots' hold arc), filling to the arm time.
function drawPupArm(ctx, k) {
  const g = pupGlint();
  if (!g) return;
  const { dpr } = state.view, p = worldToScreen(g.x, g.y), r = Math.max(14, 3.5 * zoom());
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = Math.min(1, k * 3);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, k));
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3.5, zoom()); ctx.strokeStyle = 'rgba(40,40,44,0.35)'; ctx.stroke();
  ctx.lineWidth = Math.max(2, zoom() * 0.6); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
  ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
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
  // striking the pup tent: the bar fills over the explorer as it comes down; before that, the
  // press's arc (only from the arm time on, as the slots': a tap never sees it)
  const J = pupJob(), strikeK = J && J.kind === 'strike' ? 1 - J.prog / 3 : -1;
  const armK = pupPress && !pupPress.struck ? Math.max(0, (state.time - pupPress.t - 0.12) / (STRIKE_ARM - 0.12)) : 0;
  if (armK > 0.01) drawPupArm(ctx, armK);
  if (C.phase === 'idle' && C.slotA < 0.01 && C.outA < 0.01 && C.xferA < 0.01 && C.tentA < 0.01 && sleepK < 0.01 && hint <= 0 && strikeK < 0) return;
  const { dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lay = null;
  const L = layouts();
  const f = feet(), z = zoom();
  const top = f.y - HEAD * z;

  // The dig bar: transparent white with a white fill, over the explorer's head (the tent door).
  // The same bar fills over the door as a hold there sleeps (after dark), and its first fifth
  // flashes over the explorer as they pat the pack, the once (the hold, taught without words).
  if (C.phase === 'rummage' || sleepK > 0.01 || hint > 0 || strikeK >= 0) {
    const w = BAR_W * z, h = Math.max(4, BAR_H * z), x = f.x - w / 2, y = f.y - BAR_Y * z - h / 2;
    const frac = strikeK >= 0 ? strikeK : C.phase === 'rummage' ? Math.min(1, C.t / (C.target?.kind === 'ground' ? PILE_S : RUMMAGE_S)) : sleepK > 0.01 ? sleepK : 0.2;
    ctx.globalAlpha = strikeK >= 0 ? Math.min(1, J.t * 6) : C.phase === 'rummage' ? Math.min(1, C.t * 6) : sleepK > 0.01 ? Math.min(1, sleepK * 5) : Math.min(1, 1.6 * Math.sin(Math.PI * hint)) * (0.75 + 0.25 * Math.sin(state.time * 9));
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
    const hb = blocked(), it = inTent(), sw = stormy();
    if (C.xferA > 0.01) tether(ctx, L.pack.slice(0, 5), L.r, L.packOwner, C.xferA);
    L.pack.forEach((p, i) => {
      const s = pack.slots[i];
      const dim = !!s && C.phase !== 'transfer' && ITEMS[s.id].blocked({ i, slot: s, handsBlocked: hb, storm: sw, inTent: it });
      let hold = holdK('pack', i);
      if (C.phase === 'eat' && i === C.eatI) hold = C.t / EAT_S;   // eating: the arc fills over the meal
      if (C.phase === 'splint' && i === C.splintI) hold = C.t / SPLINT_S;   // ...and over the binding
      if (C.phase === 'drink' && i === C.drinkI) hold = C.t / DRINK_S;      // ...and over the drink
      drawSlot(ctx, p.x, p.y, L.r * pop, s, { a: C.slotA, key: 'pack:' + i, dim, hold });
    });
    if (L.snow) drawSnowSlot(ctx, L.snow.x, L.snow.y, L.r * pop * 0.82, { a: C.slotA, dim: !snowHere() || (C.phase !== 'slot' && C.phase !== 'snow'), hold: C.phase === 'snow' ? C.t / SNOW_S : holdK('snow', 0) });
  }

  if (C.tentA > 0.01) drawTentMenu(ctx);
  if (C.slotA > 0.3 || C.xferA > 0.3 || C.tentA > 0.3) drawTip(ctx, L);

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
