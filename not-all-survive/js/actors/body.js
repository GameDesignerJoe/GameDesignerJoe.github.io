// The explorer's body, and the expedition it belongs to. No bars, ever: the body and the
// screen carry it.
//
// state.body = { warmth, wet, energy, reserve, injury, food, water }, each 0..1 (wet and injury
// start at 0, the rest at 1). Warmth, wet, energy and food are live; injury is a hook a later
// slice fills in (it caps energy).
//   explorer.js        reads warmth for the cold poses (hug, hard shiver, stumble, kneel,
//                      collapse) and dulls the coat toward grey ochre
//   weather-screen.js  grows the frost with 1 - warmth
//   audio.js           plays the 'chatter' and 'heartbeat' events this module pushes, and
//                      muffles the world near the end
//   this module        draws the last of it in drawOverlay (desaturate, dim, the ink iris),
//                      runs the death -> next member hand-over and the sleep in the tent.
//
// body.phase: 'alive' | 'dying' (the collapse plays) | 'iris' (closes on the fallen body,
//   holds a beat, closes) | 'black' (the hand-over happens here) | 'open' (the iris opens on
//   the tent; the next member crawls out) | 'over' (all four dead) | 'sleep' (in the tent).
// body.t: seconds into the phase. body.sleepHold: 0..1 how long a press inside the tent has
//   been held (explorer.js writes it; camp.js turns the lamp down with it).
//
// Wet (slice 2): open water soaks the explorer (explorer.js reports state.player.water
// = { level: 0 land | 1 wading | 2 deep, depth, zW }). Wading drains warmth fast, deep water
// in ~25 s; wet clothes multiply the loss ~4x on land and slowly freeze into rime
// (body.frozen 0..1, never more than wet): stiff, white-crusted, still cold. The tent dries
// and thaws fast; out in the cold drying is slow (a little faster in calm sun).
// body.shock 0..1: the cold-water gasp, fading over ~20 s (ragged breath, the white flash).
//
// Exhaustion (slice 3): energy is the short-term wind, spent in minutes by deep snow, climbing,
// swimming and walking into a gale, and got back by standing still (slowly in the cold, wet or
// a gale; fast in the tent). reserve is the day's fatigue: every bit of work wears it down a
// little, and so does time out of the tent; it caps how far energy can come back
// (energyMax). Sleeping the night in the tent restores it.
//   explorer.js  reads energy for the tired gait, the hands-on-knees rest stops, sitting down
//                spent at 0, refusing a climb (< 0.2) and losing the grip at 0 on the wall, and
//                drives the panting (pushes 'rest', 'tired', 'pant'); it reports how hard
//                they're working as player.push (0..1) and player.headwind (0..1)
//   this module  pulses the edges of sight soft in time with the panting (drawScreen), and once
//                they've stopped the camera breathes with it (state.cam.pulse, camera.js; off
//                with the gear menu's Reduce motion, state.reduceMotion)
// body.drain: energy / s right now (negative = recovering), for the debug readout.
//
// Hunger (slice 4): food runs down over ~15 min at rest (three days and nights), faster working
// (up to ~x1.8 at full push) and shivering cold (up to ~x1.6); slowly in the tent; a night's
// sleep costs a little (FOOD_SLEEP). Eating a ration (ui/pack.js) gives +0.35. Below 0.3 energy
// comes back slower, its cap drops (up to -35%) and the reserve wears faster; below 0.1 the cold
// gets in more and the body makes less heat walking. Starving at 0 kills only through the cold
// and exhaustion, never by itself. explorer.js shows it (a hand to the stomach, the growl, a
// slower gait from 0.3, unsteady near empty); body.hunger is the 0..1 of it below 0.3.
// Lightheaded (body.dizzy 0..1, ~0.7 s episodes): below 0.3, setting off after a stop (and now
// and then walking on) the world dims and swims a moment (drawScreen: a faint doubled image
// drifting and a dimming, distinct from the cold's ink and exhaustion's blur) and the explorer
// sways and staggers; oftener the emptier (cooldown 25 s at 0.3 down to 7 s near 0). Below 0.2
// it comes standing still too (a sway, ~1 in 30 s at the worst). Reduce motion keeps only the dim.
// Going to sleep hungry (food < 0.75) eats a ration from the pack, if there is one.
//
// state.party = [{ name, alive, x, y }] x 4, state.member = index of the one playing now.
// The hand-over takes the dead member's pack off them (items.js takePack: it goes with the body
// in the 'handover' event, unless the sea took them) and the next one starts with an empty pack,
// bar a compass if the sled still has one (items.js restock).
// Hooks: NAS.freeze(v?) (warmth to v, or 0.2 colder), NAS.warm(v = 1), NAS.kill(),
//        NAS.soak(v = 1), NAS.dry(), NAS.tire(v?) (energy to v, or 0.25 lower), NAS.rest(),
//        NAS.starve(v?) (food to v, or 0.25 lower), NAS.feed(v = 1).
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { takePack, restock, find, take } from '../items.js';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const INK = '#262626';
const TAU = Math.PI * 2;

// --- warmth --------------------------------------------------------------------------------------
// loss / s = LOSS x chill^1.5, chill = cold x (0.35 + 0.65 x wind exposure), then
//   x (1 + 0.3 night)  x (1 - 0.6 sheltered)  x (1 + 3 wet)  x hunger
// gain / s = HEAT x walking pace (the body makes heat while it works).
// Tuned (measured, see the report in docs/BRIEF.md) so a dry explorer standing in a full
// blizzard (cowering in the open) dies in ~3 min, a wet one in ~45 s, and a calm clear
// day is survivable on the move and only slowly dangerous standing about.
const LOSS = 0.0089;
const HEAT = 0.0019;
const INSIDE_GAIN = 1 / 22;       // in the tent: from near death back to full in ~20 s
// water (warmth / s on top of the air): wading with the legs in near-freezing sea, and
// swimming in it (~25 s to death); wet clothes dry or freeze (per s)
const WADE_LOSS = 1 / 120, DEEP_LOSS = 1 / 25;
const SOAK_WADE = 0.12, DRY_COLD = 1 / 600, DRY_SUN = 1 / 200, DRY_TENT = 1 / 12, THAW_TENT = 1 / 8, RIME = 1 / 90;

// --- energy --------------------------------------------------------------------------------------
// Drain / s while walking at full push, by the ground (1 / seconds from full to empty):
// deep snow ~90 s (snowshoes ~4 min), plain snow ~6 min (~7 with the stops), a path never. Walking into the wind
// costs up to x(1 + HEADWIND) more. Each half of a climbing cycle (one axe strike) costs
// CLIMB_HALF (a whole cliff is roughly half the energy). Wading and swimming are heavy work.
const DRAIN = { deep: 1 / 90, snow: 1 / 360, ice: 1 / 600, thin: 1 / 540, rock: 1 / 500, path: 0, water: 1 / 110 };
const DRAIN_SHOE = { deep: 1 / 240, snow: 1 / 520 };
const DRAIN_CRAMP = { ice: 1 / 1300, thin: 1 / 900 };
const HEADWIND = 1.1, SWIM = 1 / 32, HANG = 1 / 420, SHIVER = 1 / 1500;
const CLIMB_HALF = 0.032;
// Recovery / s: standing still from empty to full in ~60 s in calm air; much slower cold, wet
// or in a gale; cowering only a little; slow walking on a path a little; the tent ~15 s.
// Not linear: the first of it comes back fast (0 -> 0.4 in ~15 s), the rest slowly (to full ~60 s).
const REST_LO = 0.4 / 15, REST_HI = 0.6 / 45, TENT_REST = 1 / 15, PATH_REST = 1 / 400;
// Reserve: the work wears it (RES_WORK per unit of energy spent) and so does time out of the
// tent (RES_TIME / s); resting in the tent eases it back, sleeping the night restores it.
// (a day and a night out without sleep, ~5 min, wears off about half of it)
const RES_WORK = 0.1, RES_TIME = 1 / 800, RES_TENT = 1 / 300;
// how high energy can come back: reserve, hunger, and (slice 5) injury
const energyMax = () => (0.35 + 0.65 * B.reserve) * (1 - 0.5 * clamp(B.injury)) * (1 - 0.35 * hungerK());

// --- food ----------------------------------------------------------------------------------------
// Food / s at rest in the open: full to empty in ~15 min (three days and nights). Work burns more
// (x(1 + FOOD_WORK x push)), so does shivering (x(1 + FOOD_COLD) at the worst of it); in the tent
// a little less. Sleeping the night through costs FOOD_SLEEP.
const FOOD_REST = 1 / 900, FOOD_WORK = 0.8, FOOD_COLD = 0.6, FOOD_TENT = 0.6, FOOD_SLEEP = 0.06;
const HUNGRY = 0.3;               // below this it starts to tell
const hungerK = () => clamp((HUNGRY - B.food) / HUNGRY);   // 0 fed .. 1 starving
const starving = () => smooth(0.1, 0, B.food);              // the last of it: the cold gets in

const NAMES = ['Halloran', 'Ashby', 'Teague', 'Marsh'];

const B = state.body = {
  warmth: 1, wet: 0, energy: 1, reserve: 1, injury: 0, food: 1, water: 1,
  frozen: 0, shock: 0,
  phase: 'alive', t: 0, sleepHold: 0, rate: 0, drain: 0, max: 1, hunger: 0, foodRate: 0, dizzy: 0,
  climbHalf: CLIMB_HALF, hang: HANG,   // per axe strike / per s hanging (explorer.js sizes up a wall)
};
state.party = NAMES.map(name => ({ name, alive: true, x: null, y: null }));
state.member = 0;

// death sequence timing (s)
const IRIS_IN = 1.8, BEAT = 2.4, IRIS_OUT = 0.9, BLACK = 0.9, OPEN = 2.2;
const SLEEP_FADE = 0.9, SLEEP_HOLD = 1.1, SLEEP_WAKE = 1.6;

let chatT = 3, beatT = 0, throb = 0, irisFrom = 1, overT = 0, restartArmed = false, killed = false;
let lastTap = -1, lastAct = 0, slept = false, flash = 0, blurK = 0, breathV = 0, pulseK = 0;
let stillT = 0, walkT = 0, restZoomOn = false, restZoomK = 0;
let dizzyT = 0, dizzyCool = 0, stopT = 0;
const DIZZY_S = 0.7;
const PULSE = 0.006;   // the view's breath: at most 0.6% zoom at the top of a breath in
const approach = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

export function init() {
  // (only while alive and playing: not mid-death, during the hand-over, asleep or after the end)
  state.freeze = v => { if (B.phase === 'alive') B.warmth = typeof v === 'number' ? clamp(v) : Math.max(0.02, B.warmth - 0.2); };
  state.warm = (v = 1) => { if (B.phase === 'alive' || B.phase === 'open') B.warmth = clamp(v); };
  state.kill = () => { if (B.phase === 'alive') { B.warmth = 0; killed = true; } };   // works from inside the tent too
  state.soak = (v = 1) => { B.wet = clamp(v); };
  state.dry = () => { B.wet = 0; B.frozen = 0; };
  state.tire = v => { if (B.phase === 'alive' || B.phase === 'open') B.energy = typeof v === 'number' ? clamp(v) : Math.max(0, B.energy - 0.25); };
  state.rest = () => { B.energy = 1; B.reserve = 1; };
  state.starve = v => { B.food = typeof v === 'number' ? clamp(v) : Math.max(0, B.food - 0.25); };
  state.feed = (v = 1) => { B.food = clamp(v); };
  if (state.params.has('food')) B.food = clamp(parseFloat(state.params.get('food')));
  if (state.params.has('energy')) B.energy = clamp(parseFloat(state.params.get('energy')));
  if (state.params.has('reserve')) B.reserve = clamp(parseFloat(state.params.get('reserve')));
  if (state.params.has('warmth')) B.warmth = clamp(parseFloat(state.params.get('warmth')));
  if (state.params.has('wet')) B.wet = clamp(parseFloat(state.params.get('wet')));
  if (state.params.has('frozen')) B.frozen = Math.min(B.wet, clamp(parseFloat(state.params.get('frozen'))));
}

const P = state.player;
const outside = () => P.mode !== 'inside' && P.mode !== 'tent-in' && P.mode !== 'gone';

function warmthRate() {
  if (P.mode === 'inside') return INSIDE_GAIN;
  if (P.mode === 'tent-in' || P.mode === 'tent-out') return 0;
  const cold = clamp(state.weather.cold ?? 0.3);
  const wind = clamp(P.exposure || 0);
  const night = clamp(state.lighting?.night || 0);
  const chill = cold * (0.35 + 0.65 * wind);
  let loss = LOSS * Math.pow(chill, 1.5) * (1 + 0.3 * night);
  loss *= 1 - 0.6 * clamp(P.sheltered || 0);          // cowering, hunkered in the lee of rock
  loss *= 1 + 3 * clamp(B.wet);                        // wet: ~4x
  loss *= 1 + 0.6 * starving();                        // starving: up to +60% (slice 4)
  // spent: sitting still in the snow with nothing left, the cold gets in (up to +30%)
  if (!P.moving) loss *= 1 + 0.3 * smooth(0.25, 0, B.energy);
  // in the water itself: the sea takes the heat straight out
  const lv = P.water?.level || 0;
  if (lv === 1) loss += WADE_LOSS * (0.6 + 0.4 * clamp((P.water.depth || 0) / 4));
  if (lv === 2) loss += DEEP_LOSS;
  const pace = P.mode === 'walk' && P.moving && !lv ? clamp(P.speed / 9) : P.mode === 'climb' ? 0.8 : 0;
  // wet clothes don't hold the heat of working
  // (nor does a starving body: nothing left to burn)
  const heat = HEAT * pace * (0.4 + 0.6 * clamp(B.energy)) * (1 - 0.65 * clamp(B.wet)) * (1 - 0.4 * starving());
  return heat - loss;
}

function setPhase(p) { B.phase = p; B.t = 0; }

// Soaking, drying, freezing into rime. Frozen never exceeds wet; rime only forms in the cold.
function updateWet(dt) {
  const lv = P.water?.level || 0;
  if (lv === 2) { B.wet = Math.min(1, B.wet + 1.5 * dt); B.frozen = Math.max(0, B.frozen - dt * 0.5); }
  else if (lv === 1) {
    // wading soaks the legs and the coat hem: up to about half, deeper water more, slowly
    const cap = 0.35 + 0.25 * clamp((P.water.depth || 0) / 9);
    if (B.wet < cap) B.wet = Math.min(cap, B.wet + SOAK_WADE * dt);
    B.frozen = Math.max(0, B.frozen - dt * 0.3);
  }
  else if (P.mode === 'inside' || B.phase === 'sleep') {
    B.wet = Math.max(0, B.wet - DRY_TENT * dt); B.frozen = Math.max(0, B.frozen - THAW_TENT * dt);
  } else {
    const L = state.lighting, cold = clamp(state.weather.cold ?? 0.3);
    // calm sun on a bright day dries a little faster; otherwise it mostly freezes
    const sun = (1 - clamp(L.night || 0)) * clamp(L.bright || 0) * clamp(1 - (state.wind.speed || 0) * 1.5);
    B.wet = Math.max(0, B.wet - (DRY_COLD + DRY_SUN * sun) * dt * (1 - 0.6 * B.frozen));
    B.frozen = Math.min(B.wet, B.frozen + RIME * smooth(0.15, 0.6, cold) * B.wet * dt);
  }
  B.frozen = Math.min(B.frozen, B.wet);
  B.shock = Math.max(0, B.shock - dt / 20);
}
// Energy and reserve. Work drains energy: walking (player.push, from explorer.js) by the ground
// underfoot, the gear and the headwind; each axe strike on a climb; wading and swimming; a
// little for shivering. Not working gets it back, up to energyMax, slower the colder, wetter
// and windier it is. The reserve wears down with the work and the hours outside.
let climbCost = 0;
function updateEnergy(dt) {
  for (const e of state.events) if (e.type === 'axe') climbCost += CLIMB_HALF;
  const m = P.mode, lv = P.water?.level || 0, g = P.gear || {};
  const hunger = 1 + 0.6 * hungerK();                         // slice 4: hungry, the reserve goes faster
  let drain = 0;
  if (m === 'inside' || B.phase === 'sleep') {
    drain = -TENT_REST;
    B.reserve = Math.min(1, B.reserve + RES_TENT * dt);
  } else if (m === 'tent-in' || m === 'tent-out' || m === 'gone' || m === 'dead' || m === 'collapse' || m === 'sink' || B.phase !== 'alive') {
    drain = 0;
  } else {
    const push = clamp(P.push || 0), hw = clamp(P.headwind || 0);
    if (m === 'swim') drain = SWIM;
    else if (m === 'climb') drain = P.climbHold ? HANG : 0;
    else if (P.crawl) drain = 0;                        // crawling on spent: no worse, no better
    else if (push > 0.05) {
      const ter = lv ? 'water' : P.terrain;
      const base = g.snowshoes && ter in DRAIN_SHOE ? DRAIN_SHOE[ter] : g.crampons && ter in DRAIN_CRAMP ? DRAIN_CRAMP[ter] : DRAIN[ter] ?? DRAIN.snow;
      // into a gale even a path costs something
      drain = base * push * (1 + HEADWIND * hw) + push * hw / 500;
      if (ter === 'path') drain -= PATH_REST * (1 - 0.5 * push) * (1 - smooth(0.2, 0.6, hw));
    }
    if (push <= 0.05 && m !== 'climb' && m !== 'swim' && !P.crawl) {
      // getting the wind back: the body's own cold, the air's, wet clothes and a gale all slow it
      const chilled = smooth(0.8, 0.3, B.warmth), air = 0.3 * clamp(state.weather.cold ?? 0.3);
      const gale = smooth(0.35, 0.9, clamp(P.exposure || 0) * (1 - 0.7 * clamp(P.sheltered || 0)));
      let k = clamp((1 - 0.65 * chilled - air) * (1 - 0.45 * clamp(B.wet)) * (1 - 0.6 * gale), 0.08, 1);
      if (m === 'cower') k *= 0.6;                      // balled up against the storm: only a little
      if (lv) k *= 0.35;                                // standing in the sea
      k *= 1 - 0.5 * hungerK();                         // hungry: slower to come back
      if (P.resting) k *= 0.05;                         // a stop on the way: only the breath it cost
      drain = -(B.energy < 0.4 ? REST_LO : REST_HI) * k;
    }
    // shivering is work too
    drain += SHIVER * smooth(0.7, 0.35, B.warmth) * (1 - smooth(0.13, 0.05, B.warmth));
  }
  const max = energyMax();
  B.max = max;
  if (climbCost > 0) { B.energy = Math.max(0, B.energy - climbCost); B.reserve = Math.max(0, B.reserve - climbCost * RES_WORK * hunger); climbCost = 0; }
  if (drain > 0) {
    B.energy = Math.max(0, B.energy - drain * dt);
    B.reserve = Math.max(0, B.reserve - drain * dt * RES_WORK * hunger);
  } else if (B.energy < max) B.energy = Math.min(max, B.energy - drain * dt);
  else B.energy = Math.max(max, B.energy - dt / 90);  // the cap came down (reserve): it sinks to it
  if (m !== 'inside' && B.phase !== 'sleep' && m !== 'gone') B.reserve = Math.max(0, B.reserve - RES_TIME * hunger * dt);
  B.drain = drain;
}

// Food: a slow clock, faster working and shivering, slower in the tent. (Eating is ui/pack.js.)
function updateFood(dt) {
  const m = P.mode;
  let rate = 0;
  if (m === 'inside' || B.phase === 'sleep') rate = FOOD_REST * FOOD_TENT;
  else if (B.phase === 'alive' || B.phase === 'open') {
    if (m !== 'tent-in' && m !== 'tent-out' && m !== 'gone' && m !== 'dead' && m !== 'collapse' && m !== 'sink') {
      const work = m === 'swim' ? 1 : m === 'climb' ? 0.9 : P.water?.level ? 0.6 : clamp(P.push || 0);
      rate = FOOD_REST * (1 + FOOD_WORK * work) * (1 + FOOD_COLD * smooth(0.8, 0.3, B.warmth));
    } else rate = FOOD_REST;
  }
  B.food = Math.max(0, B.food - rate * dt);
  B.foodRate = rate;
  B.hunger = hungerK();
}

// Sleeping is only for the night, and only in the day/night cycle (a pinned clock has no morning).
export function canSleep() { const L = state.lighting; return L.mode === 'cycle' && L.night > 0.5 && L.clock >= 180; }

function handover() {
  const m = state.party[state.member];
  m.alive = false; m.x = P.x; m.y = P.y;
  // fallen.js keeps the body where it fell; the picture is taken now, before the swap
  // (lost at sea: no body, only fading rings where they went under)
  const lost = !!P.lostAtSea;
  // their pack stays with them (fallen.js), unless the sea took it; the next one starts empty
  // (the picture first, while they still wear what they wore)
  const sprite = lost ? null : P.snapshot?.(), kit = takePack();
  state.events.push({ type: 'handover', x: P.x, y: P.y, facing: P.facing, member: state.member, name: m.name, lost, sprite, pack: lost ? null : kit });
  const next = state.party.findIndex(q => q.alive);
  Object.assign(B, { warmth: 1, wet: 0, frozen: 0, shock: 0, energy: 1, reserve: 1, injury: 0, food: 0.8, sleepHold: 0, dizzy: 0 });   // (a little hungry already)
  if (next < 0) {
    P.respawn?.(true);                                  // nobody left: the camera rests on the empty camp
    state.events.push({ type: 'expedition', over: true });
    setPhase('over'); overT = 0; restartArmed = false;
  } else {
    state.member = next;
    restock();                                          // a compass from the sled, if there's one left
    P.respawn?.(false);                                 // the next one crawls out of the tent
    setPhase('black');
  }
  state.cam.x = P.x; state.cam.y = P.y - 6;
}

export function update(dt) {
  B.t += dt;
  throb = Math.max(0, throb - dt * 5);
  // sleep only skips what's left of the night (explorer.js only offers it after dark)
  for (const e of state.events) if (e.type === 'tent' && e.action === 'sleep' && B.phase === 'alive' && canSleep()) {
    setPhase('sleep');
    // supper before sleeping, if they're hungry and there's a ration in the pack
    const i = B.food < 0.75 ? find(state.pack, 'food') : -1;
    if (i >= 0) { take(state.pack, i, 1); B.food = Math.min(1, B.food + 0.35); state.events.push({ type: 'eat', stage: 'done', x: P.x, y: P.y }); }
  }
  // into the water: the cold shock (explorer.js pushes plunge; audio gasps)
  for (const e of state.events) if (e.type === 'plunge') { B.shock = 1; flash = Math.max(flash, e.deep ? 1 : 0.7); }
  flash = Math.max(0, flash - dt * 1.8);
  if (B.phase !== 'over') { updateWet(dt); updateEnergy(dt); updateFood(dt); }

  switch (B.phase) {
    case 'alive': case 'open': {
      B.rate = killed ? 0 : warmthRate();
      B.warmth = clamp(B.warmth + B.rate * dt);
      if (B.phase === 'open' && B.t >= OPEN) setPhase('alive');
      if (B.phase === 'alive' && ((B.warmth <= 0 && outside()) || killed)) {
        killed = false; B.warmth = 0;
        irisFrom = irisAlive(0);
        setPhase('dying');
        state.events.push({ type: 'death', x: P.x, y: P.y, cause: P.water?.level ? 'water' : 'cold', member: state.member });
      }
      break;
    }
    case 'dying':
      // explorer.js plays the collapse and settles into 'dead'
      // (a climber torn off the wall falls first, so allow the time)
      if ((P.mode === 'dead' && B.t > 1.2) || B.t > 9) { irisFrom = irisAlive(0); setPhase('iris'); }
      break;
    case 'iris':
      if (B.t >= IRIS_IN + BEAT + IRIS_OUT) { handover(); }
      break;
    case 'black':
      if (B.t >= BLACK) { setPhase('open'); state.events.push({ type: 'gust', x: P.x, y: P.y, strength: 0.8 }); }
      break;
    case 'over':
      overT += dt;
      if (overT > 4) {
        // a fresh press after the text is up begins again
        const inp = state.input;
        if (!restartArmed) { restartArmed = true; lastTap = inp.tap?.t ?? -1; lastAct = inp.action || 0; }
        else if ((inp.tap && inp.tap.t !== lastTap) || (inp.action && inp.action !== lastAct)) location.reload();
      }
      break;
    case 'sleep':
      B.warmth = clamp(B.warmth + INSIDE_GAIN * dt);
      if (B.t >= SLEEP_FADE && !slept) {
        // the rest of the night passes: the clock jumps to the first light of the next day
        // (the same dawn the night would have reached; the director picks its forecast then)
        slept = true;
        const L = state.lighting;
        L.clock = 0; L.night = 0; L.nightTarget = 0;
        B.warmth = 1; B.reserve = 1; B.energy = 1;   // a night's sleep: rested
        B.food = Math.max(0, B.food - FOOD_SLEEP);   // and a little hungrier for it
        state.events.push({ type: 'tent', action: 'wake', x: P.x, y: P.y });
      }
      if (B.t >= SLEEP_FADE + SLEEP_HOLD + SLEEP_WAKE) { slept = false; setPhase('alive'); }
      break;
  }

  // The view breathes with the panting (explorer.js runs the clock): it swells in a touch on
  // each breath in. Only while alive and outside, only once they've stopped (bent double, sat
  // spent, or stood still worn out), and never with Reduce motion on (gear menu).
  const pk = (B.phase === 'alive' || B.phase === 'open') && outside() ? clamp(P.pant || 0) : 0;
  const v = 0.5 - 0.5 * Math.cos((P.breathPh || 0) * TAU);      // 0 at the start of a breath in, 1 at its top
  const stopped = !P.moving && (P.resting || (P.spent && !P.crawl) || B.energy < 0.3);
  pulseK = approach(pulseK, stopped && !state.reduceMotion ? 1 : 0, 2, dt);
  // and the camera eases in on them, once, ~18%, and holds while they stay stopped (worn out:
  // sat spent, or stood still under 0.3 and bent double of their own accord); back out once they've walked on ~1.5 s.
  // A multiplier on the follow zoom (camera.js cam.rest), so the player's own pinch zoom stands.
  // Not with Reduce motion.
  const live = (B.phase === 'alive' || B.phase === 'open') && outside();
  // (the brief stops on the way don't count, or it would breathe in and out with each one;
  // crawling on spent keeps it close)
  stillT = stopped && !P.resting ? stillT + dt : 0;
  walkT = P.moving && !P.crawl ? walkT + dt : 0;
  if (!live || state.reduceMotion || walkT > 1.5) restZoomOn = false;
  else if (stillT > 1.0) restZoomOn = true;
  restZoomK = approach(restZoomK, restZoomOn ? 1 : 0, restZoomOn ? 0.7 : 0.9, dt);
  state.cam.rest = 1 + 0.18 * restZoomK;
  state.cam.pulse = PULSE * pk * v * pulseK;
  state.cam.dip = 0;
  blurK = 0.8 * Math.pow(smooth(0.35, 1, pk), 1.3);
  breathV = v;

  // Lightheaded with hunger: a short episode setting off after a stop, or now and then walking on.
  const hk = smooth(0.3, 0.02, B.food);
  let setOff = false;
  if (!P.moving) stopT += dt; else { setOff = stopT > 1.2; stopT = 0; }
  dizzyCool -= dt;
  if (dizzyT > 0) dizzyT -= dt;
  else if (hk > 0 && dizzyCool <= 0 && B.phase === 'alive' && outside() && (P.mode === 'walk' || P.mode === 'cower')
    && ((P.moving && ((setOff && Math.random() < 0.35 + 0.6 * hk) || Math.random() < dt * 0.05 * hk))
      || (!P.moving && B.food < 0.2 && Math.random() < dt * 0.03 * hk))) {   // (below 0.2, standing too: a sway)
    dizzyT = DIZZY_S; dizzyCool = lerp(25, 7, hk);
    state.events.push({ type: 'dizzy', x: P.x, y: P.y, strength: hk });
  }
  B.dizzy = dizzyT > 0 && B.phase === 'alive' ? Math.sin(Math.PI * (1 - dizzyT / DIZZY_S)) : 0;

  // Sounds of the body: teeth chattering while it still fights the cold (it stops near the
  // end, as shivering does), and a slow heartbeat in the last of it.
  const w = B.warmth;
  if ((B.phase === 'alive' || B.phase === 'open') && outside()) {
    const ch = smooth(0.68, 0.4, w) * (1 - smooth(0.12, 0.05, w));
    chatT -= dt;
    if (ch > 0.03 && chatT <= 0) {
      chatT = lerp(8, 2.2, ch) * (0.7 + Math.random() * 0.6);
      state.events.push({ type: 'chatter', x: P.x, y: P.y, strength: 0.35 + 0.65 * ch, dur: 0.45 + Math.random() * 0.7 * ch + 0.2 * ch });
    }
  }
  const hb = B.phase === 'dying' ? (1 - smooth(1.5, 4.5, B.t)) : (B.phase === 'alive' || B.phase === 'open') && outside() ? smooth(0.3, 0.06, w) : 0;
  if (hb > 0.03) {
    beatT -= dt;
    if (beatT <= 0) {
      const bpm = B.phase === 'dying' ? 28 : lerp(36, 58, smooth(0.02, 0.3, w));
      beatT = 60 / bpm;
      throb = 1;
      state.events.push({ type: 'heartbeat', x: P.x, y: P.y, strength: hb });
    }
  } else beatT = 0;
}

// --- drawing: the end of the line ------------------------------------------------------------------
// The vision narrows only at the very end: the iris sits off the corners until warmth ~0.18,
// then closes to under half the screen by 0.02.
function irisAlive(w) { return lerp(0.42, 1.08, smooth(0.02, 0.2, w)); }   // x half-diagonal

// Before the iris: the edges of sight darken in ink, from warmth ~0.75, so the narrowing is
// gradual and still reads in a white-out. Not an airbrushed vignette: ink bleeding into damp
// paper — a wobbling inner edge, blotchy low-frequency density, and a scatter of stipple dots
// thickening outward. Built once (512 px, per pixel) and only its alpha changes per frame.
let vigCan = null;
function vignetteSprite() {
  if (vigCan) return vigCan;
  const S = 512, H = S / 2;
  vigCan = document.createElement('canvas');
  vigCan.width = vigCan.height = S;
  const g = vigCan.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  // value noise: hashed lattice, smooth-interpolated, three octaves
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };
  const fbm = (x, y) => 0.55 * vn(x, y) + 0.3 * vn(x * 2.1 + 5.2, y * 2.1 + 1.3) + 0.15 * vn(x * 4.3 + 9.1, y * 4.3 + 7.7);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - H) / H, dy = (y - H) / H, r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    // the inner edge wobbles like the hand-drawn death iris, and frays with the noise
    const wob = 1 + 0.05 * Math.sin(ang * 3 + 1.3) + 0.03 * Math.sin(ang * 7 + 0.4) + 0.015 * Math.sin(ang * 13 - 2);
    const n = fbm(x / 46, y / 46);
    const t = clamp((r * wob - 0.5 + (n - 0.5) * 0.22) / 0.42);
    let al = t * t * (3 - 2 * t) * (0.55 + 0.6 * n);           // blotchy density
    // stipple: dots, denser further out, as on the map's drift edges
    if (t > 0.02 && t < 0.9 && hash(x * 1.7, y * 2.3) < 0.035 * t) al = Math.max(al, 0.75 + 0.25 * t);
    al = Math.max(al, smooth(0.9, 0.99, r));                   // solid at the rim: no seam with the fill beyond
    const i = (y * S + x) * 4;
    d[i] = 38; d[i + 1] = 38; d[i + 2] = 38; d[i + 3] = Math.round(255 * clamp(al));
  }
  g.putImageData(img, 0, 0);
  return vigCan;
}

// An ink iris: everything outside a hand-drawn circle goes to ink, with a soft inner edge.
function drawIris(ctx, cx, cy, r, w, h) {
  const n = 72, t = state.time;
  ctx.beginPath();
  ctx.rect(-20, -20, w + 40, h + 40);
  if (r > 0.5) {
    for (let i = 0; i <= n; i++) {
      const a = -i / n * TAU;
      const rr = r * (1 + 0.012 * Math.sin(a * 3 + 1.3) + 0.007 * Math.sin(a * 7 + t * 0.4) + 0.004 * Math.sin(a * 13 - 2));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = INK;
  ctx.fill('evenodd');
  if (r > 0.5) {
    // the soft inner edge, as ink bleeding into damp paper
    // (out past the wobble of the edge, so no pale sliver is left between them)
    const g = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.03);
    g.addColorStop(0, 'rgba(38,38,38,0)');
    g.addColorStop(0.6, 'rgba(38,38,38,0.16)');
    g.addColorStop(0.88, 'rgba(38,38,38,0.6)');
    g.addColorStop(1, 'rgba(38,38,38,1)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.03, 0, TAU); ctx.fill();
  }
}

// Exhaustion on the screen: not darkness (the cold owns the ink). The edges of sight go soft
// and a little washed, swelling with each breath out and easing on the breath in, as if the
// eyes won't hold focus while the lungs heave. A cheap blur: the frame so far shrunk twice (to
// 1/3, then 1/6, never under 128 px a side so it stays a GPU canvas) and laid back at full
// size outside a clear middle round the explorer. Drawn in drawScreen: after the weather's
// screen layers, before the night grade and the pack / compass UI (which stay crisp).
// The shrunk copy refreshes every other frame (a blur a frame late can't show), and the masked
// one only when that copy, the strength or the middle has moved on.
let blurA = null, blurB = null, blurTick = 0, blurKq = -1, blurCx = 0, blurCy = 0;
function drawBreathBlur(ctx, k) {
  const src = ctx.canvas, W = src.width, H = src.height;
  const up = Math.max(1, 128 / Math.min(W / 6, H / 6));
  const aw = Math.round(Math.max(W / 3, W / 6 * up)), ah = Math.round(Math.max(H / 3, H / 6 * up));
  const bw = Math.round(W / 6 * up), bh = Math.round(H / 6 * up);
  if (!blurA) { blurA = document.createElement('canvas'); blurB = document.createElement('canvas'); }
  let fresh = (blurTick++ & 1) === 0;
  if (blurA.width !== aw || blurA.height !== ah) { blurA.width = aw; blurA.height = ah; fresh = true; }
  if (blurB.width !== bw || blurB.height !== bh) { blurB.width = bw; blurB.height = bh; fresh = true; }
  const a = blurA.getContext('2d'), b = blurB.getContext('2d');
  const p = worldToScreen(P.x, P.y - 6), sx = bw / state.view.w, r = Math.hypot(bw, bh) / 2;
  const kq = Math.round(k * 40) / 40, cx = Math.round(p.x * sx), cy = Math.round(p.y * sx);
  if (fresh || kq !== blurKq || cx !== blurCx || cy !== blurCy) {
    blurKq = kq; blurCx = cx; blurCy = cy;
    a.imageSmoothingEnabled = b.imageSmoothingEnabled = true;
    if (fresh) a.drawImage(src, 0, 0, aw, ah);
    b.globalCompositeOperation = 'copy';
    b.drawImage(blurA, 0, 0, bw, bh);
    // a faint wash of light in it (soft, never ink)
    b.globalCompositeOperation = 'source-atop';
    b.fillStyle = `rgba(246,247,248,${0.16 * kq})`; b.fillRect(0, 0, bw, bh);
    // clear in the middle round the explorer, soft toward the edges
    const g = b.createRadialGradient(cx, cy, r * lerp(0.72, 0.4, kq), cx, cy, r * lerp(1.1, 0.88, kq));
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    b.globalCompositeOperation = 'destination-in';
    b.fillStyle = g; b.fillRect(0, 0, bw, bh);
    b.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = clamp(k);
  ctx.drawImage(blurB, 0, 0, W, H);
  ctx.restore();
}

// Lightheaded: the frame laid over itself a touch larger and drifting sideways (a faint doubled,
// swimming image), and the whole of it dimmed a moment. Only during an episode (~0.7 s).
function drawDizzy(ctx, k) {
  const cv = ctx.canvas, W = cv.width, H = cv.height, dpr = state.view.dpr || 1;
  const sc = 1 + 0.02 * k, dx = Math.sin(state.time * 8) * 12 * k * dpr, dy = Math.cos(state.time * 5.5) * 4 * k * dpr;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // (Reduce motion: only the dimming, no doubled, drifting image)
  if (!state.reduceMotion) { ctx.globalAlpha = 0.38 * k; ctx.drawImage(cv, (W - W * sc) / 2 + dx, (H - H * sc) / 2 + dy, W * sc, H * sc); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(30,32,36,${0.2 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawOverlay(ctx) {
  const { w, h } = state.view;
  const half = Math.hypot(w, h) / 2;
  const ph = B.phase;
  const live = ph === 'alive' || ph === 'open' || ph === 'sleep';
  // Dim a little as the cold takes hold (from warmth ~0.55; full through the death). No
  // desaturation: the world is already grey, and the signal yellow (tent, coat) must stay
  // findable; the coat's own dulling is the body cue.
  const k = live ? smooth(0.55, 0.04, B.warmth) * (outside() ? 1 : 0) : ph === 'over' ? 1 : ph === 'black' ? 0 : 1;
  if (k > 0.01) {
    ctx.globalAlpha = 0.12 * k;
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Cold shock: a brief white flash as the sea closes over the legs (or the head).
  if (flash > 0.01) {
    ctx.globalAlpha = 0.55 * flash * flash;
    ctx.fillStyle = '#f6f8fa'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // The iris: centred on the explorer (on the tent door as the next one comes out).
  const p = worldToScreen(P.x, P.y - 6);
  const z = state.cam.zoom || 1;
  // from ~0.75 down to 0.3 the edges of sight close in steadily (readable in a white-out,
  // where frost is already full and the figure is tiny)
  const vk = live && outside() ? Math.pow(clamp((0.77 - B.warmth) / 0.47), 0.85) : 0;
  if (vk > 0.01) {
    const R = half * lerp(1.3, 1.0, vk) * (1 - 0.012 * throb);
    ctx.globalAlpha = 0.85 * Math.pow(vk, 0.75);
    ctx.drawImage(vignetteSprite(), p.x - R, p.y - R, 2 * R, 2 * R);
    // past the sprite's edge it's solid ink
    ctx.fillStyle = INK;
    if (p.y - R > 0) ctx.fillRect(0, 0, w, p.y - R);
    if (p.y + R < h) ctx.fillRect(0, p.y + R, w, h - p.y - R);
    if (p.x - R > 0) ctx.fillRect(0, Math.max(0, p.y - R), p.x - R, 2 * R);
    if (p.x + R < w) ctx.fillRect(p.x + R, Math.max(0, p.y - R), w - p.x - R, 2 * R);
    ctx.globalAlpha = 1;
  }
  let r = -1;
  if (live && outside() && B.warmth < 0.2) {
    // the living iris is soft: ink feathered in from half its radius, no edge (the hard,
    // hand-drawn edge is kept for death)
    const ri = irisAlive(B.warmth) * half * (1 - 0.018 * throb * smooth(0.3, 0.05, B.warmth));
    const a = smooth(0.2, 0.12, B.warmth);
    const g = ctx.createRadialGradient(p.x, p.y, ri * 0.5, p.x, p.y, ri);
    g.addColorStop(0, 'rgba(38,38,38,0)');
    g.addColorStop(0.45, `rgba(38,38,38,${0.3 * a})`);
    g.addColorStop(0.8, `rgba(38,38,38,${0.75 * a})`);
    g.addColorStop(1, `rgba(38,38,38,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (ph === 'dying') r = irisFrom * half * (1 - 0.02 * throb);
  else if (ph === 'iris') {
    const beatR = Math.min(34 * z, Math.min(w, h) * 0.3);
    const tt = B.t;
    r = tt < IRIS_IN ? lerp(irisFrom * half, beatR, smooth(0, IRIS_IN, tt))
      : tt < IRIS_IN + BEAT ? beatR * (1 - 0.04 * smooth(IRIS_IN, IRIS_IN + BEAT, tt))
      : lerp(beatR * 0.96, 0, smooth(IRIS_IN + BEAT, IRIS_IN + BEAT + IRIS_OUT, tt));
  } else if (ph === 'black') r = 0;
  else if (ph === 'open') r = lerp(0, half * 1.1, smooth(0, OPEN, B.t));
  else if (ph === 'over') r = lerp(0, Math.min(w, h) * 0.3, smooth(0.5, 3.5, overT));
  if (r >= 0 && r < half * 1.06) drawIris(ctx, p.x, p.y, r, w, h);

  // Sleep: a quick fade to ink, the night passes, then morning.
  if (ph === 'sleep') {
    const tt = B.t, a = tt < SLEEP_FADE ? smooth(0, SLEEP_FADE, tt) : tt < SLEEP_FADE + SLEEP_HOLD ? 1 : 1 - smooth(SLEEP_FADE + SLEEP_HOLD, SLEEP_FADE + SLEEP_HOLD + SLEEP_WAKE, tt);
    if (a > 0.003) { ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }

  // The end of the expedition: the camp, empty, in a small circle of light. A few words.
  if (ph === 'over') {
    const a = smooth(2, 4, overT), rr = Math.min(w, h) * 0.3, s = Math.min(w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(233,233,231,${0.92 * a})`;
    ctx.font = `${Math.round(Math.max(22, s * 0.055))}px 'Playfair Display SC', Didot, Georgia, serif`;
    ctx.fillText('NONE CAME HOME', w / 2, Math.max(s * 0.09, p.y - rr - s * 0.07));
    ctx.font = `italic ${Math.round(Math.max(12, s * 0.022))}px Georgia, serif`;
    ctx.fillStyle = `rgba(233,233,231,${0.6 * a})`;
    ctx.fillText(state.party.map(q => q.name).join('  ·  '), w / 2, Math.max(s * 0.09, p.y - rr - s * 0.07) + s * 0.045);
    const b = smooth(4, 5.5, overT);
    ctx.fillStyle = `rgba(233,233,231,${0.5 * b})`;
    ctx.fillText('tap to begin again', w / 2, Math.min(h - s * 0.06, p.y + rr + s * 0.08));
  }
}

export function drawScreen(ctx) {
  // the breath blur (strongest at the end of each breath out); the cold's ink, the iris and the
  // frost all lie crisp on top of it (drawOverlay)
  const bk = blurK * (0.45 + 0.55 * (1 - breathV));
  if (bk > 0.02) drawBreathBlur(ctx, bk);
  if (B.dizzy > 0.01) drawDizzy(ctx, B.dizzy);
  if (!state.debug) return;
  ctx.fillStyle = '#000'; ctx.font = '12px monospace';
  ctx.fillText(`warmth ${B.warmth.toFixed(3)} rate ${(B.rate * 60).toFixed(3)}/min wet ${B.wet.toFixed(2)} rime ${B.frozen.toFixed(2)} food ${B.food.toFixed(3)} ${B.phase} member ${state.member}`, 10, 34);
}
