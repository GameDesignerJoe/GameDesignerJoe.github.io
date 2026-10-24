// The explorer's body, and the expedition it belongs to. No bars, ever: the body and the
// screen carry it.
//
// state.body = { warmth, wet, energy, reserve, injury, food, water }, each 0..1 (wet and injury
// start at 0, the rest at 1). All of them are live.
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
// Injury (slice 5): one number, shown as a hurt leg. explorer.js pushes 'injury' { amount, cause }
// (a fall from a wall 15-55 px high, a knockdown on ice or rock, a slip) and 'impact' { severity,
// fatal } as they land; this module adds it up (body.splint goes: a new injury undoes the splint).
// It caps energy (energyMax), makes walking cost more (x(1 + INJ_DRAIN x injury)) and explorer.js
// limps, slows (up to -40%, half that splinted) and won't climb above 0.5. It never heals outside;
// in the tent slowly (INJ_TENT), and a night's sleep takes INJ_SLEEP off. A fatal fall (> ~55 px)
// kills outright: 'death' { cause: 'fall' }, the body left crumpled at the foot of the wall.
// On impact: a hard jolt of the view (cam.dip and shakeX; not with Reduce motion) and an ink
// "flinch": jagged splinters of ink flashing in from the lower corner on the bad leg's side,
// fading over ~1 s, bigger the harder the landing (drawOverlay; unlike the cold's steady soft
// edge, the hunger's doubling or the breath blur). Hurt badly (> 0.5), a faint echo of it now and
// then in time with a step on the bad leg. ui/pack.js binds the leg with a splint (-0.25, body.splint).
// Heaving out of a hole in the ice ('heave' { stage: 'pull', axes }) costs HEAVE (far less with axes).
// On a wall (explorer.js): a gust peeling them off ('peel') snaps a jagged band of ink in along the
// top edge on the downwind side, throbbing fast for as long as the window lasts (tap now), and tugs
// the view sideways (not with Reduce motion); a re-plant ('replant') or the grip going ('scrape')
// clears it. Looking down past the fatal height ('vertigo'): the screen edges smear downward a
// moment (drawScreen), as if the drop pulled at the eyes. Neither is the cold's steady soft edge.
//
// Shelters (slice 6): 'inside' is whichever tent they crawled into, and player.shelter says how
// good it is (camp.js CAMP_SHELTER, all full rates; puptent.js PUP_SHELTER for the pup tent):
// warm, dry, rest, heal and sleep scale the recovery; leak lets that share of the outside cold
// through the canvas (and the stove's gain falls off in a storm by storm x how stormy); food is the
// food clock's rate in there; hunger is how much an empty stomach undoes it (no heat from a body
// with nothing to burn, energy slower back, a poorer night). So the pup tent warms and dries at a
// third of base camp's rate, barely gains in a full blizzard, and with no food the cold gets in
// even there: a leaky shelter can be died in (warmth 0 inside it kills, as outside). Carrying the
// pup tent costs ~10% more energy walking (PUP_DRAIN).
//
// Thirst (slice 6, after the pup tent): water is its own clock, faster than food so it's met first:
// ~13 min standing about outside, faster working (x(1 + WATER_WORK x push)) and panting (the breath
// carries the moisture off), and in a cold, dry wind (x(1 + WATER_WIND x cold x exposure)), at most
// x WATER_MAX in all. Below 0.1 explorer.js stumbles now and then and climbs slower; at 0 it won't
// start a climb up ('parched'). In a tent it comes back (the stove melting snow): base camp's in ~25 s, the pup
// tent's at shelter.water (0.4) of that, and the flasks in the pack fill a drink at a time
// (FLASK_FILL s each at base camp). A sleep wakes them watered. Drinking from the flask (+0.3) and
// eating snow (+0.12, for warmth) are ui/pack.js. body.thirst is the 0..1 of it below 0.35: energy
// comes back a little slower and the reserve wears faster; below 0.15 (body.parched) more so and
// the energy cap drops (up to -25%); at 0 the cold gets in a little more (+25%) and the rest is
// slower again. It never kills by itself. Hunger hits the body; thirst hits the mind: the mirage
// and the Third Man (fx/thirst.js), the tinnitus and the dry swallow pushed here ('thirst'
// { stage: 'ring' | 'swallow' }), the headache and the cracked-lip breath (explorer.js, audio.js).
// body.waterRate: water / s now (negative: drinking it in, in a tent).
//
// state.party = [{ name, alive, x, y }] x 4, state.member = index of the one playing now.
// The hand-over takes the dead member's pack off them (items.js takePack: it goes with the body
// in the 'handover' event, unless the sea took them) and the next one starts with an empty pack,
// bar a compass if the sled still has one (items.js restock).
// Hooks: NAS.freeze(v?) (warmth to v, or 0.2 colder), NAS.warm(v = 1), NAS.kill(),
//        NAS.soak(v = 1), NAS.dry(), NAS.tire(v?) (energy to v, or 0.25 lower), NAS.rest(),
//        NAS.starve(v?) (food to v, or 0.25 lower), NAS.feed(v = 1),
//        NAS.hurt(v?) (injury to v, or 0.25 worse, with the flinch), NAS.heal(),
//        NAS.parch(v?) (water to v, or 0.25 lower), NAS.quench() (water and the flasks full).
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { takePack, restock, find, take, count, fillFlasks, carryingRecorder } from '../items.js';
import { CAMP_SHELTER } from './camp.js';

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
// injury: walking costs more hurt; heals only in the tent (from 1 to 0 in ~10 min there) and by a
// night's sleep; a heave out of the ice (without axes; with them far less)
const INJ_DRAIN = 0.7, INJ_TENT = 1 / 600, INJ_SLEEP = 0.3, HEAVE = 0.09, HEAVE_AXES = 0.035;
// the pup tent on the back: walking costs this much more (slice 6)
const PUP_DRAIN = 0.1;
const HOPE = 0.9;             // a recorder in the pack: warmth and energy go ~10% slower (recordings.js)
// kneeling at the pup tent pitching or striking it: hard work, about walking on snow (slice 6)
const JOB_DRAIN = 0.9 / 360, JOB_FOOD = 0.8;
// how high energy can come back: reserve, hunger, (slice 5) injury and thirst (only parched)
const energyMax = () => (0.35 + 0.65 * B.reserve) * (1 - 0.5 * clamp(B.injury)) * (1 - 0.35 * hungerK()) * (1 - 0.25 * parchK());

// --- food ----------------------------------------------------------------------------------------
// Food / s at rest in the open: full to empty in ~15 min (three days and nights). Work burns more
// (x(1 + FOOD_WORK x push)), so does shivering (x(1 + FOOD_COLD) at the worst of it); in the tent
// a little less. Sleeping the night through costs FOOD_SLEEP.
const FOOD_REST = 1 / 900, FOOD_WORK = 0.8, FOOD_COLD = 0.6, FOOD_SLEEP = 0.06;   // (in a tent: x shelter.food)
const HUNGRY = 0.3;               // below this it starts to tell
const hungerK = () => clamp((HUNGRY - B.food) / HUNGRY);   // 0 fed .. 1 starving
const starving = () => smooth(0.1, 0, B.food);              // the last of it: the cold gets in

// --- water ---------------------------------------------------------------------------------------
// Water / s at rest in the open: full to empty in ~13 min (2.7 days and nights). Work, panting and
// a cold dry wind take more, all told never more than x WATER_MAX (~6 min at the worst). In a tent: back at WATER_TENT x shelter.water (base camp ~25 s from
// empty), the flasks a drink each FLASK_FILL / shelter.water s.
const WATER_REST = 1 / 800, WATER_WORK = 0.9, WATER_PANT = 0.6, WATER_WIND = 0.5, WATER_MAX = 2.2, WATER_TENT = 1 / 25, FLASK_FILL = 4;
const THIRSTY = 0.35, PARCHED = 0.15;
const thirstK = () => clamp((THIRSTY - B.water) / THIRSTY);   // 0 watered .. 1 dry
const parchK = () => clamp((PARCHED - B.water) / PARCHED);    // the worst of it
const dryOut = () => smooth(0.05, 0, B.water);               // at 0: the cold gets in a little more

const NAMES = ['Halloran', 'Ashby', 'Teague', 'Marsh'];

const B = state.body = {
  warmth: 1, wet: 0, energy: 1, reserve: 1, injury: 0, food: 1, water: 1,
  frozen: 0, shock: 0, splint: false,
  phase: 'alive', t: 0, sleepHold: 0, rate: 0, drain: 0, max: 1, hunger: 0, foodRate: 0, dizzy: 0,
  thirst: 0, parched: 0, waterRate: 0,
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
let joltT = 9, joltA = 0, flinch = null, echoCool = 0;
let peel = null, vertT = 0;
let flaskAcc = 0, swallowT = 6, ringT = 10;
const PEEL_S = 0.8, VERT_S = 1.1;
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
  state.hurt = v => {
    if (B.phase !== 'alive') return;
    const to = typeof v === 'number' ? clamp(v) : Math.min(1, B.injury + 0.25);
    if (to > B.injury) { B.splint = false; startFlinch(0.25 + 0.6 * (to - B.injury)); }
    B.injury = to;
  };
  state.heal = () => { B.injury = 0; B.splint = false; };
  state.parch = v => { B.water = typeof v === 'number' ? clamp(v) : Math.max(0, B.water - 0.25); };
  state.quench = () => { B.water = 1; if (state.pack) fillFlasks(state.pack, 99); };
  if (state.params.has('water')) B.water = clamp(parseFloat(state.params.get('water')));
  if (state.params.has('injury')) B.injury = clamp(parseFloat(state.params.get('injury')));
  if (state.params.has('food')) B.food = clamp(parseFloat(state.params.get('food')));
  if (state.params.has('energy')) B.energy = clamp(parseFloat(state.params.get('energy')));
  if (state.params.has('reserve')) B.reserve = clamp(parseFloat(state.params.get('reserve')));
  if (state.params.has('warmth')) B.warmth = clamp(parseFloat(state.params.get('warmth')));
  if (state.params.has('wet')) B.wet = clamp(parseFloat(state.params.get('wet')));
  if (state.params.has('frozen')) B.frozen = Math.min(B.wet, clamp(parseFloat(state.params.get('frozen'))));
}

const P = state.player;
const outside = () => P.mode !== 'inside' && P.mode !== 'tent-in' && P.mode !== 'gone';
// the shelter they're in (or last crawled into): how good it is
const Q = () => P.shelter || CAMP_SHELTER;

// In a tent: the stove's warmth (base camp's brings them back from the edge in ~20 s), as good as
// the shelter is, less in a storm if the canvas lets it in, and none from a starving body in a
// poor one; minus the share of the outside cold that gets through (wet clothes and an empty
// stomach let more of it in).
function insideRate() {
  const q = Q();
  const storm = smooth(0.45, 0.95, clamp(state.wind.speed + 0.3 * (state.wind.gust || 0)));
  let gain = INSIDE_GAIN * q.warm * (1 - q.storm * storm) * (1 - 0.8 * q.hunger * starving());
  if (!q.leak) return gain;
  const cold = clamp(state.weather.cold ?? 0.3), wind = clamp(state.wind.speed + 0.5 * (state.wind.gust || 0));
  const chill = cold * (0.35 + 0.65 * wind);
  const leak = q.leak * LOSS * Math.pow(chill, 1.5) * (1 + 0.3 * clamp(state.lighting?.night || 0)) * (1 + 3 * clamp(B.wet)) * (1 + 0.6 * starving());
  return gain - leak;
}

function warmthRate() {
  if (P.mode === 'inside') return insideRate();
  if (P.mode === 'tent-in' || P.mode === 'tent-out') return 0;
  const cold = clamp(state.weather.cold ?? 0.3);
  const wind = clamp(P.exposure || 0);
  const night = clamp(state.lighting?.night || 0);
  const chill = cold * (0.35 + 0.65 * wind);
  let loss = LOSS * Math.pow(chill, 1.5) * (1 + 0.3 * night);
  loss *= 1 - 0.6 * clamp(P.sheltered || 0);          // cowering, hunkered in the lee of rock
  loss *= 1 + 3 * clamp(B.wet);                        // wet: ~4x
  loss *= 1 + 0.6 * starving();                        // starving: up to +60% (slice 4)
  loss *= 1 + 0.25 * dryOut();                         // no water left at all: +25% (thirst)
  if (carryingRecorder()) loss *= HOPE;                // a recorder in the pack: hope (recordings.js)
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
    const k = Q().dry;
    B.wet = Math.max(0, B.wet - DRY_TENT * k * dt); B.frozen = Math.max(0, B.frozen - THAW_TENT * k * dt);
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
  // slice 4: hungry, the reserve goes faster (and thirsty: more so parched)
  const hunger = (1 + 0.6 * hungerK()) * (1 + 0.4 * thirstK() + 0.6 * parchK());
  let drain = 0;
  if (m === 'inside' || B.phase === 'sleep') {
    const q = Q();
    drain = -TENT_REST * q.rest * (1 - 0.5 * q.hunger * hungerK());
    B.reserve = Math.min(1, B.reserve + RES_TENT * q.rest * dt);
  } else if (m === 'tent-in' || m === 'tent-out' || m === 'gone' || m === 'dead' || m === 'collapse' || m === 'sink' || B.phase !== 'alive') {
    drain = 0;
  } else {
    const push = clamp(P.push || 0), hw = clamp(P.headwind || 0);
    if (m === 'swim') drain = SWIM;
    else if (m === 'crawlout') drain = SWIM * 0.6;     // dragging themselves out flat: hard work, no rest
    else if (m === 'climb') drain = P.climbHold ? HANG : 0;
    else if (P.crawl) drain = 0;                        // crawling on spent: no worse, no better
    else if (push > 0.05) {
      const ter = lv ? 'water' : P.terrain;
      const base = g.snowshoes && ter in DRAIN_SHOE ? DRAIN_SHOE[ter] : g.crampons && ter in DRAIN_CRAMP ? DRAIN_CRAMP[ter] : DRAIN[ter] ?? DRAIN.snow;
      // into a gale even a path costs something; hurt, every step costs more
      drain = (base * push * (1 + HEADWIND * hw) + push * hw / 500) * (1 + INJ_DRAIN * clamp(B.injury));
      if (carryingPup()) drain *= 1 + PUP_DRAIN;            // the pup tent on the back (slice 6)
      if (carryingRecorder()) drain *= HOPE;                 // ...and hope lightens the going
      if (ter === 'path') drain -= PATH_REST * (1 - 0.5 * push) * (1 - smooth(0.2, 0.6, hw));
    }
    // pitching or striking the pup tent: work, not rest (not while it's down and flapping: a gasp)
    const job = !!state.pup?.job && !state.pup.job.coll;
    if (job) drain = JOB_DRAIN * (1 + INJ_DRAIN * clamp(B.injury));
    else if (push <= 0.05 && m !== 'climb' && m !== 'swim' && m !== 'crawlout' && !P.crawl) {
      // getting the wind back: the body's own cold, the air's, wet clothes and a gale all slow it
      const chilled = smooth(0.8, 0.3, B.warmth), air = 0.3 * clamp(state.weather.cold ?? 0.3);
      const gale = smooth(0.35, 0.9, clamp(P.exposure || 0) * (1 - 0.7 * clamp(P.sheltered || 0)));
      let k = clamp((1 - 0.65 * chilled - air) * (1 - 0.45 * clamp(B.wet)) * (1 - 0.6 * gale), 0.08, 1);
      if (m === 'cower') k *= 0.6;                      // balled up against the storm: only a little
      if (lv) k *= 0.35;                                // standing in the sea
      k *= 1 - 0.5 * hungerK();                         // hungry: slower to come back
      k *= (1 - 0.25 * thirstK()) * (1 - 0.25 * dryOut());   // thirsty a little slower, dry slower again
      if (P.resting) k *= 0.05;                         // a stop on the way: only the breath it cost
      drain = -(B.energy < 0.4 ? REST_LO : REST_HI) * k;
    }
    // shivering is work too
    drain += SHIVER * smooth(0.7, 0.35, B.warmth) * (1 - smooth(0.13, 0.05, B.warmth));
  }
  // heaving out of a hole in the ice: each pull costs (far less with axes to pull on)
  for (const e of state.events) if (e.type === 'heave' && e.stage === 'pull') climbCost += e.axes ? HEAVE_AXES : HEAVE;
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

const carryingPup = () => !!state.pack && count(state.pack, 'puptent') > 0;

// Food: a slow clock, faster working and shivering, slower in base camp's tent. (Eating is ui/pack.js.)
function updateFood(dt) {
  const m = P.mode;
  let rate = 0;
  if (m === 'inside' || B.phase === 'sleep') rate = FOOD_REST * Q().food;
  else if (B.phase === 'alive' || B.phase === 'open') {
    if (m !== 'tent-in' && m !== 'tent-out' && m !== 'gone' && m !== 'dead' && m !== 'collapse' && m !== 'sink') {
      const work = m === 'swim' ? 1 : m === 'climb' ? 0.9 : P.water?.level ? 0.6 : state.pup?.job ? JOB_FOOD : clamp(P.push || 0);
      rate = FOOD_REST * (1 + FOOD_WORK * work) * (1 + FOOD_COLD * smooth(0.8, 0.3, B.warmth));
    } else rate = FOOD_REST;
  }
  B.food = Math.max(0, B.food - rate * dt);
  B.foodRate = rate;
  B.hunger = hungerK();
}

// Water: faster than food, faster working and panting and in a cold dry wind; back in a tent (the
// stove melting snow), where the flasks in the pack fill too. (Drinking is ui/pack.js.)
function updateWater(dt) {
  const m = P.mode;
  let rate = 0;
  if (m === 'inside' || B.phase === 'sleep') {
    const q = Q().water ?? 1;
    rate = -WATER_TENT * q;
    flaskAcc += dt * q / FLASK_FILL;
    if (flaskAcc >= 1) { flaskAcc -= 1; if (state.pack) fillFlasks(state.pack, 1); }
  } else if (B.phase === 'alive' || B.phase === 'open') {
    flaskAcc = 0;
    if (m !== 'tent-in' && m !== 'tent-out' && m !== 'gone' && m !== 'dead' && m !== 'collapse' && m !== 'sink') {
      const work = m === 'swim' ? 1 : m === 'climb' ? 0.9 : P.water?.level ? 0.6 : state.pup?.job ? JOB_FOOD : clamp(P.push || 0);
      const wind = clamp(state.weather.cold ?? 0.3) * clamp(P.exposure || 0) * (1 - 0.6 * clamp(P.sheltered || 0));
      rate = WATER_REST * Math.min(WATER_MAX, (1 + WATER_WORK * work + WATER_PANT * clamp(P.pant || 0)) * (1 + WATER_WIND * wind));
    } else rate = WATER_REST;
  }
  B.water = clamp(B.water - rate * dt);
  B.waterRate = rate;
  B.thirst = thirstK(); B.parched = parchK();
}

// Injury: what explorer.js reports (falls, knockdowns, slips), the impact cues, healing in the tent.
function updateInjury(dt) {
  for (const e of state.events) {
    if (e.type === 'injury' && B.phase === 'alive') {
      B.injury = Math.min(1, B.injury + e.amount);
      if (e.amount > 0.01) B.splint = false;         // a new injury undoes the splint
      if (!e.quiet) startFlinch(0.25 + 1.2 * e.amount);
    }
    if (e.type === 'impact') {
      // the view jolts (px), and the flinch takes the screen (fatal: the hardest of all)
      joltA = Math.max(joltA * Math.exp(-joltT * 7), 3 + 12 * clamp(e.severity ?? 0.5)); joltT = 0;
      startFlinch(e.fatal ? 1.2 : 0.35 + 0.7 * clamp(e.severity ?? 0.5));
    }
    // badly hurt: now and then a faint echo of the flinch, in time with a step on the bad leg
    if (e.type === 'step' && e.bad && B.injury > 0.5 && echoCool <= 0 && Math.random() < 0.15 + 0.2 * smooth(0.5, 1, B.injury)) {
      echoCool = 4.5 + Math.random() * 3;
      startFlinch(0.1 + 0.12 * smooth(0.5, 1, B.injury), true);
    }
  }
  echoCool -= dt;
  // on a wall: the peel window, and the look down
  for (const e of state.events) {
    if (e.type === 'peel') startPeelCue();
    if ((e.type === 'replant' || e.type === 'scrape') && peel && !peel.end) peel.end = peel.t;
    if (e.type === 'vertigo') vertT = VERT_S;
  }
  if (peel) { peel.t += dt; if (peel.t > PEEL_S + 0.4 || (peel.end !== null && peel.t > peel.end + 0.25)) peel = null; }
  vertT = Math.max(0, vertT - dt);
  if (peel && !state.reduceMotion) {
    // the view tugged sideways, downwind, with the gust, shuddering while it lasts
    const k = peel.end !== null ? Math.max(0, 1 - (peel.t - peel.end) / 0.25) : 1;
    state.cam.shakeX += peel.side * k * (7 * Math.exp(-peel.t * 6) + 1.8 * Math.sin(peel.t * 31));
  }
  if (P.mode === 'inside' || B.phase === 'sleep') B.injury = Math.max(0, B.injury - INJ_TENT * Q().heal * dt);
  if (flinch) { flinch.t += dt; if (flinch.t > flinch.life) flinch = null; }
}

// The flinch: an ink "bite" taken out of the bottom edge of the screen on the bad leg's side, as
// if the lens cracked there: a low jagged band of ink hugging the edge out from the corner
// (irregular, never evenly toothed), a few long fracture lines running up and inward off it with a
// sharp kink or a split, and a few flecks. Built once per flinch in units of the screen diagonal
// (x inward from the corner, y up from the bottom edge); drawn growing out in ~0.07 s and fading
// over its life (~0.7-1.15 s; an echo ~0.45 s, small). sev 0..1.2.
function startFlinch(sev, echo = false) {
  if (flinch && !echo && flinch.sev > sev && flinch.t < 0.3) return;
  if (flinch && echo && !flinch.echo) return;          // never step on a real one
  const side = (P.badLeg || 1) > 0 ? 1 : -1, sv = Math.min(1, sev), polys = [];
  let seed = 1 + ((Math.random() * 2e9) | 0);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // the bite: up the side edge a little, then a jagged top edge running in along the bottom
  const Lb = (0.14 + 0.24 * sv) * (0.85 + 0.3 * rnd()), H0 = 0.02 + 0.045 * sv, bite = [0, 0.004];
  const hs = H0 * (1.1 + 0.6 * rnd());
  bite.push(0, -hs * 0.6, 0.004, -hs);
  const tops = [];
  for (let u = 0.01; u < Lb; u += 0.004 + 0.045 * rnd() * rnd()) {
    // a solid foot of ink along the edge, then ragged, uneven points above it
    const f = 1 - u / Lb, spike = rnd() < 0.12 ? 1.6 + 1.2 * rnd() : 0.3 + 0.6 * rnd() * rnd();
    const y = -H0 * (0.3 * Math.pow(f, 0.6) + 0.7 * Math.pow(f, 1.3) * spike);
    bite.push(u, y); tops.push([u, y]);
  }
  bite.push(Lb, 0.004);
  polys.push(bite);
  // a few long fracture lines off it, up and inward, straight with a sharp kink now and then
  const n = 2 + Math.round(2.5 * sv);
  for (let i = 0; i < n; i++) {
    const q = tops[Math.floor(rnd() * Math.min(tops.length, 4 + tops.length * 0.6))] || [0, -H0];
    let dir = -(0.25 + 0.9 * rnd()), x = q[0], y = q[1];
    const L = (0.08 + 0.15 * rnd()) * (0.6 + 0.4 * sv), m = 7, w0 = 0.0014 + 0.0016 * sv;
    const left = [], right = [];
    for (let k = 0; k <= m; k++) {
      const wd = w0 * (1 - k / m), nx = -Math.sin(dir), ny = Math.cos(dir);
      left.push(x + nx * wd, y + ny * wd); right.push(x - nx * wd, y - ny * wd);
      x += Math.cos(dir) * L / m; y += Math.sin(dir) * L / m;
      dir += rnd() < 0.25 ? (rnd() - 0.5) * 0.7 : (rnd() - 0.5) * 0.08;
    }
    const pl = left.slice();
    for (let k = right.length - 2; k >= 0; k -= 2) pl.push(right[k], right[k + 1]);
    polys.push(pl);
    if (rnd() < 0.4) {
      const j = 2 * (2 + ((rnd() * 4) | 0)), bx = left[j], by = left[j + 1], b = dir + (rnd() < 0.5 ? 0.6 : -0.6), l2 = L * 0.3;
      polys.push([bx, by - w0 * 0.5, bx + Math.cos(b) * l2, by + Math.sin(b) * l2, bx, by + w0 * 0.5]);
    }
  }
  const dots = [];
  for (let i = 0; i < 4 + 8 * sv; i++) dots.push(rnd() * Lb * 0.9, -H0 * (1.2 + 2.5 * rnd()), 0.0012 + 0.0025 * rnd());
  flinch = { t: 0, life: echo ? 0.45 : 0.7 + 0.45 * sv, sev, side, polys, dots, echo };
}
function drawFlinch(ctx, w, h) {
  const f = flinch, D = Math.hypot(w, h), grow = smooth(0, 0.07, f.t);
  const a = (f.echo ? 0.45 : 0.75 + 0.2 * Math.min(1, f.sev)) * Math.pow(1 - f.t / f.life, 1.6);
  if (a < 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = INK;
  ctx.translate(f.side > 0 ? w : 0, h);
  ctx.scale(-f.side * D, D);                            // x runs in from the corner
  ctx.beginPath();
  for (let p = 0; p < f.polys.length; p++) {
    const pts = f.polys[p];
    ctx.moveTo(pts[0] * grow, pts[1] * grow);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * grow, pts[i + 1] * grow);
    ctx.closePath();
  }
  const d = f.dots;
  for (let i = 0; i < d.length; i += 3) { ctx.moveTo(d[i] * grow + d[i + 2], d[i + 1] * grow); ctx.arc(d[i] * grow, d[i + 1] * grow, d[i + 2], 0, TAU); }
  ctx.fill();
  ctx.restore();
}

// The peel cue: a band of ink with a torn lower edge along the top of the screen from the downwind
// corner, built once (x in from the corner, y down from the top, units of the screen diagonal).
function startPeelCue() {
  const side = Math.cos(state.wind.angle || 0) >= 0 ? 1 : -1, pts = [0, -0.004];
  let seed = 1 + ((Math.random() * 2e9) | 0);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const L = 0.42 + 0.12 * rnd(), H = 0.042;
  pts.push(0, H * 1.6);
  for (let u = 0.008; u < L; u += 0.006 + 0.04 * rnd() * rnd()) {
    const f = 1 - u / L;
    pts.push(u, H * (0.25 + 0.75 * f) * (rnd() < 0.2 ? 1.7 + rnd() : 0.5 + 0.7 * rnd()));
  }
  pts.push(L, -0.004);
  peel = { t: 0, end: null, side, pts };
}
function drawPeel(ctx, w, h) {
  const p = peel, D = Math.hypot(w, h);
  const snap = smooth(0, 0.08, p.t), out = p.end !== null ? Math.max(0, 1 - (p.t - p.end) / 0.25) : 1;
  // throbbing faster as the window runs out: tap now
  const urg = clamp(p.t / PEEL_S), throbK = 0.75 + 0.25 * Math.sin(p.t * (18 + 22 * urg));
  const a = 0.85 * snap * out * throbK;
  if (a < 0.01) return;
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = INK;
  ctx.translate(p.side > 0 ? w : 0, 0);
  const grow = 0.6 + 0.4 * snap + 0.25 * urg;
  ctx.scale(-p.side * Math.min(w, D * 0.75), D * grow);   // (along the edge: a share of the width, so a phone keeps the far corner clear)
  ctx.beginPath(); ctx.moveTo(p.pts[0], p.pts[1]);
  for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i] * (0.7 + 0.3 * snap), p.pts[i + 1]);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
// The look down: the left and right edges of the frame laid back over themselves stretched
// downward (a smear, not darkness), strongest at the very edge.
function drawVertigo(ctx, k) {
  const cv = ctx.canvas, W = cv.width, H = cv.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 6; i++) {
    // (narrow bands laid widest first, each a little more stretched toward the edge: no seams)
    const f = 1 - i / 6, bw = W * 0.22 * f, st = 1 + 0.2 * (1 - 0.8 * f) * k, al = 0.32 * k;
    ctx.globalAlpha = al;
    ctx.drawImage(cv, 0, 0, bw, H, 0, -H * 0.01 * k, bw, H * st);
    ctx.drawImage(cv, W - bw, 0, bw, H, W - bw, -H * 0.01 * k, bw, H * st);
  }
  ctx.restore();
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
  // (died in a tent: no picture; fallen.js leaves the body in there, the boots showing at the door)
  const inside = P.deadInside ? (P.shelter?.kind || 'camp') : null;
  const sprite = lost || inside ? null : P.snapshot?.(), kit = takePack();
  state.events.push({ type: 'handover', x: P.x, y: P.y, facing: P.facing, member: state.member, name: m.name, lost, inside, door: inside ? P.door?.() : null, sprite, pack: lost ? null : kit });
  const next = state.party.findIndex(q => q.alive);
  Object.assign(B, { warmth: 1, wet: 0, frozen: 0, shock: 0, energy: 1, reserve: 1, injury: 0, splint: false, food: 0.8, water: 0.8, sleepHold: 0, dizzy: 0 });
  flinch = null; joltA = 0; peel = null; vertT = 0;   // (a little hungry already)
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
  updateInjury(dt);
  if (B.phase !== 'over') { updateWet(dt); updateEnergy(dt); updateFood(dt); updateWater(dt); }

  switch (B.phase) {
    case 'alive': case 'open': {
      B.rate = killed ? 0 : warmthRate();
      B.warmth = clamp(B.warmth + B.rate * dt);
      if (B.phase === 'open' && B.t >= OPEN) setPhase('alive');
      // (in a leaky shelter, the pup tent, the cold can finish them too)
      const exposed = outside() || (P.mode === 'inside' && Q().leak > 0);
      if (B.phase === 'alive' && ((B.warmth <= 0 && exposed) || killed)) {
        killed = false; B.warmth = 0;
        irisFrom = irisAlive(0);
        setPhase('dying'); B.cause = P.water?.level ? 'water' : 'cold';
        state.events.push({ type: 'death', x: P.x, y: P.y, cause: B.cause, member: state.member });
      }
      // a fall from high on a wall: dead where they land (explorer.js lays them out crumpled)
      if (B.phase === 'alive' && state.events.some(e => e.type === 'impact' && e.fatal)) {
        irisFrom = irisAlive(B.warmth);
        setPhase('dying'); B.cause = 'fall';
        state.events.push({ type: 'death', x: P.x, y: P.y, cause: 'fall', member: state.member });
      }
      break;
    }
    case 'dying':
      // explorer.js plays the collapse and settles into 'dead'
      // (a climber torn off the wall falls first, so allow the time)
      // (a fall: a longer look at the body as it lies before the iris closes)
      if ((P.mode === 'dead' && B.t > (B.cause === 'fall' ? 2.0 : 1.2)) || B.t > 9) { irisFrom = irisAlive(B.warmth); setPhase('iris'); }
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
      B.warmth = clamp(B.warmth + insideRate() * dt);
      if (B.t >= SLEEP_FADE && !slept) {
        // the rest of the night passes: the clock jumps to the first light of the next day
        // (the same dawn the night would have reached; the director picks its forecast then)
        slept = true;
        const L = state.lighting;
        // the night that's skipped is lived through: in a leaky shelter the cold that gets in over the
        // hours left is counted (drying out as it goes); a freezing body isn't saved by sleeping, it
        // dies in the night (and is found in the morning)
        const left = Math.max(0, 300 - (L.clock || 0)), wet0 = B.wet;
        let wN = B.warmth;
        for (let s2 = 0; s2 < left && wN > 0; s2 += 10) { wN = clamp(wN + insideRate() * Math.min(10, left - s2)); B.wet = Math.max(0, B.wet - DRY_TENT * Q().dry * 10); }
        B.wet = wet0;
        L.clock = 0; L.night = 0; L.nightTarget = 0;
        // a night's sleep: rested (in base camp's tent fully; in the pup tent only most of the
        // way, less again on an empty stomach)
        const q = Q(), k = q.sleep * (1 - 0.6 * q.hunger * hungerK());
        if (wN <= 0) { B.warmth = 0; killed = true; }
        else B.warmth = Math.min(lerp(B.warmth, 1, k), wN);
        B.reserve = lerp(B.reserve, 1, k);
        B.energy = k >= 1 ? 1 : lerp(B.energy, Math.max(B.energy, energyMax()), k);
        B.food = Math.max(0, B.food - FOOD_SLEEP);   // and a little hungrier for it
        // the stove melts snow all night: they wake watered (the pup tent's too, by morning), the flasks full
        B.water = clamp(B.water + left * WATER_TENT * (q.water ?? 1));
        if (state.pack) fillFlasks(state.pack, 99);
        B.injury = Math.max(0, B.injury - INJ_SLEEP * q.heal);   // and the leg a good deal better
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
  // the jolt of a hard landing: a sharp drop of the view and a shudder, gone in ~0.5 s
  // (weather-screen.js has already written this frame's shake; this adds to it)
  joltT += dt;
  const jk = joltA > 0 && !state.reduceMotion ? joltA * Math.exp(-joltT * 7) : 0;
  state.cam.dip = jk > 0.05 ? jk * Math.cos(joltT * 34) : 0;
  if (jk > 0.05) state.cam.shakeX += 0.45 * jk * Math.sin(joltT * 41 + 1);
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
  // Thirst, in the head: a dry swallow now and then (below 0.3, oftener the drier), and a faint high
  // ring in the ears that comes and goes (below 0.25; near constant at 0). Not in a tent.
  if (B.phase === 'alive' && outside()) {
    const sk = smooth(0.3, 0.02, B.water), rk = smooth(0.25, 0.0, B.water);
    swallowT -= dt; ringT -= dt;
    if (sk > 0 && swallowT <= 0) {
      swallowT = lerp(20, 7, sk) * (0.7 + Math.random() * 0.6);
      state.events.push({ type: 'thirst', stage: 'swallow', x: P.x, y: P.y, strength: 0.4 + 0.6 * sk });
    }
    if (rk > 0 && ringT <= 0) {
      const dur = lerp(3.5, 9, rk) * (0.8 + Math.random() * 0.4);
      ringT = dur + lerp(38, 2, rk) * (0.6 + Math.random() * 0.8);
      state.events.push({ type: 'thirst', stage: 'ring', x: P.x, y: P.y, strength: 0.35 + 0.65 * rk, dur });
    }
    if (sk <= 0) swallowT = Math.max(swallowT, 4);
    if (rk <= 0) ringT = Math.max(ringT, 6);
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

  // Peeling off a wall: ink snapping in along the top edge (tap now).
  if (peel && live) drawPeel(ctx, w, h);
  // A hard landing: ink splinters from the corner (and their faint echo on bad-leg steps).
  if (flinch && (live || ph === 'dying')) drawFlinch(ctx, w, h);

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
  if (vertT > 0) drawVertigo(ctx, Math.sin(Math.PI * (1 - vertT / VERT_S)));
  if (!state.debug) return;
  ctx.fillStyle = '#000'; ctx.font = '12px monospace';
  ctx.fillText(`warmth ${B.warmth.toFixed(3)} rate ${(B.rate * 60).toFixed(3)}/min wet ${B.wet.toFixed(2)} rime ${B.frozen.toFixed(2)} food ${B.food.toFixed(3)} water ${B.water.toFixed(3)} injury ${B.injury.toFixed(2)}${B.splint ? ' (splint)' : ''} ice ${(P.iceStress || 0).toFixed(2)} ${B.phase} member ${state.member}`, 10, 34);
}
