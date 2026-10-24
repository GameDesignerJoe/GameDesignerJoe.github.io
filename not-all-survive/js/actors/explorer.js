// The explorer: a procedural skeletal rig drawn with canvas paths in the painting's style,
// seen from the oblique camera so it can face any direction.
//
// The look (from ref/explorer.png): broad square shoulders, a long duffel coat hanging nearly
// straight to just above the knee, open at the front over a paler inner panel with toggles;
// a tall pointed cowl hood flowing into the shoulders with a small dark face inside a rim;
// a hard light/dark split (lit left, dark right); broken, hand-inked outlines that vanish on
// lit upper-left edges and thicken on the lower-right; a soft grey shadow to the lower-right.
//
// Locomotion reads the terrain under the feet and the wind, and blends pose parameters toward
// per-terrain targets so nothing pops.
//
// Conventions
//   facing: radians in *ground* space, 0 = east, PI/2 = south (toward the camera).
//   Ground depth (world y) is foreshortened by KY relative to x. Rig ground offsets are (f, r)
//   in the body frame; world = rotate by facing, then y *= KY. Height z goes straight up.
//   state.wind.angle is the direction the wind blows TOWARD (downwind).
import { state } from '../state.js';
import * as T from '../world/terrain.js';
import { SIGNAL } from '../palette.js';
import { tentDoor, campInteract, campBlocked, tentDoorClip, CAMP_SHELTER } from './camp.js';
import { pupDoor, pupDoorClip, pupBlocked, pupInteract, PUP_SHELTER } from './puptent.js';
import { screenToWorld } from '../camera.js';
import * as ICE from '../world/thinice.js';

const KY = 0.8;              // ground-depth foreshortening (rig, travel, footprints)
const BASE_SPEED = 13;       // world units / s on plain snow
const INK = '#262626';

// Per-terrain gait targets.
//   cad   : max steps / s (stride lengthens beyond)  step  : step length (world units)
//   lift  : swing-foot height                        lean  : forward pitch while walking (rad)
//   swing : arm swing                                spread: arms out for balance (0..1)
//   work  : elbows bent, pumping (0..1)              crouch: knee bend (0..1)
//   stance: half-width between feet                  sink  : boots sink into the surface
//   bob   : vertical hip bob                         accel / fric: velocity response (1/s)
//   hunch : head forward and down (1 = looking at the feet)
//   tent  : pause at each foot plant (0..1)          weight: footstep weight for audio/prints
//   creep : thin ice — hands low and forward, feeling the way, eyes on the feet
const PROFILES = {
  snow: { creep: 0, cad: 2.5, speed: 1.0, step: 4.6, lift: 1.0, lean: 0.14, swing: 0.9, spread: 0, work: 0.15, crouch: 0.15, stance: 1.0, sink: 0.35, bob: 0.22, accel: 4.5, fric: 5, hunch: 0.25, tent: 0, weight: 0.7 },
  deep: { creep: 0, cad: 1.9, speed: 0.5, step: 3.0, lift: 2.7, lean: 0.36, swing: 0.25, spread: 0.12, work: 1, crouch: 0.4, stance: 1.05, sink: 1.5, bob: 0.5, accel: 3, fric: 6, hunch: 0.55, tent: 0, weight: 1.0 },
  ice: { creep: 0, cad: 2.6, speed: 0.8, step: 1.8, lift: 0.1, lean: 0.3, swing: 0, spread: 1, work: 0, crouch: 0.65, stance: 1.25, sink: 0, bob: 0.05, accel: 1.4, fric: 0.5, hunch: 0.45, tent: 0.5, weight: 0.4 },
  thin: { creep: 1, cad: 1.7, speed: 0.38, step: 1.35, lift: 0.05, lean: 0.38, swing: 0, spread: 0.2, work: 0, crouch: 0.9, stance: 1.2, sink: 0, bob: 0.03, accel: 1.4, fric: 0.7, hunch: 1.0, tent: 0.78, weight: 0.3 },
  path: { creep: 0, cad: 2.5, speed: 1.2, step: 5.3, lift: 0.75, lean: 0.03, swing: 1.2, spread: 0, work: 0, crouch: 0.05, stance: 0.95, sink: 0.08, bob: 0.28, accel: 6, fric: 7, hunch: 0.05, tent: 0, weight: 0.5 },
  rock: { creep: 0, cad: 2.4, speed: 0.9, step: 4.4, lift: 0.9, lean: 0.08, swing: 0.8, spread: 0.1, work: 0, crouch: 0.2, stance: 1.0, sink: 0, bob: 0.2, accel: 5, fric: 6, hunch: 0.2, tent: 0, weight: 0.6 },
  // wading in open water: slow, high-stepping against the drag, arms out for balance
  water: { creep: 0, cad: 1.5, speed: 0.38, step: 2.6, lift: 2.4, lean: 0.24, swing: 0.2, spread: 0.4, work: 0.55, crouch: 0.28, stance: 1.12, sink: 0, bob: 0.4, accel: 2, fric: 3.2, hunch: 0.55, tent: 0, weight: 0.8 },
};
// Snowshoes (state.player.gear.snowshoes): a wide, flat-footed gliding trudge. Deep snow gets
// much easier; plain snow a little quicker. (Ice / thin ice never: the pack auto-stows them.)
const SHOE = {
  snow: { ...PROFILES.snow, speed: 1.15, cad: 2.3, step: 4.8, lift: 0.55, stance: 1.55, sink: 0.12, bob: 0.17, lean: 0.12, swing: 0.75, crouch: 0.18, weight: 0.55 },
  deep: { ...PROFILES.deep, speed: 0.8, cad: 2.15, step: 4.1, lift: 0.85, lean: 0.2, swing: 0.6, spread: 0.04, work: 0.35, crouch: 0.22, stance: 1.6, sink: 0.3, bob: 0.26, accel: 4, fric: 5.5, hunch: 0.3, weight: 0.6 },
};
const SHOE_SPEED = { snow: 1.15, deep: 0.8 };   // deep: as a fraction of plain-snow speed
let strapT = 0, strapDur = 0, strapOn = true, strapLock = false, strapItem = 'snowshoes';   // kneel-and-strap animation
const shoesOn = () => !!(P.gear && P.gear.snowshoes);
const crampOn = () => !!(P.gear && P.gear.crampons);
const axesOn = () => !!(P.gear && P.gear.axes);
const hasClimbGear = () => axesOn() && crampOn();      // Joe: both are needed to climb
// Crampons: confident on ice (less of the arm-spread shuffle, rare slips); a slight
// crunch-stomp on snow, same speed.
const CRAMP = {
  ice: { ...PROFILES.ice, cad: 2.4, step: 3.4, lift: 0.45, lean: 0.18, swing: 0.55, spread: 0.18, crouch: 0.3, stance: 1.1, accel: 3.2, fric: 3.5, hunch: 0.3, tent: 0.12, weight: 0.6 },
  thin: { ...PROFILES.thin, cad: 2.0, step: 2.2, lift: 0.3, spread: 0.12, crouch: 0.6, tent: 0.4, hunch: 0.75, accel: 2.2, fric: 2.5 },
  snow: { ...PROFILES.snow, lift: 1.15, bob: 0.3, weight: 0.85 },
};
let axeReachT = 0;                                       // quick reach to the pack for the axes
const shoesDrawn = () => shoesOn() || (strapT > 0 && !strapOn && strapItem === 'snowshoes');   // still on the feet while unstrapping

const POSE_KEYS = ['step', 'lift', 'lean', 'swing', 'spread', 'work', 'crouch', 'stance', 'sink', 'bob', 'hunch', 'tent', 'creep'];

// Rig dimensions (world units). Total height ~16.
const HIP_H = 8.0, THIGH = 3.9, SHIN = 3.85, ANKLE_H = 0.55;
const SPINE = 4.3, SHOULDER_W = 1.6, UPPER_ARM = 2.45, FOREARM = 2.35;
const HEAD_UP = 1.85, HOOD_R = 1.6, HOOD_RY = 1.9;
const SH_R = 2.15, SH_F = 1.2;      // coat at the shoulders: half-width, half-depth
const HEM_R = 2.9, HEM_F = 1.4;     // coat at the hem (just above the knee)
const HEM_DROP = 1.9;              // hem height below the hips

// Light: from the screen-left and a little toward the viewer (the painting's convention).
// The terminator on a vertical body is where the ground normal is perpendicular to it.
// The painting splits the figure roughly down the middle: lit left half, dark right half.
const TERM_A = 1.32;                           // world ground angle of the visible terminator

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

// body.js warmth (1 = fine, 0 = dead of cold); 1 when the body system isn't loaded
const warmth = () => (state.body ? state.body.warmth : 1);
// body.js energy (short-term wind) and reserve (the day's fatigue); 1 without the body system
const energy = () => (state.body ? state.body.energy : 1);
const reserve = () => (state.body ? state.body.reserve ?? 1 : 1);
// how worn out it shows: nothing above energy 0.5, all of it at 0
const tiredK = () => Math.pow(smooth(0.5, 0, energy()), 1.15);
// the pace they can keep up, relative to fresh (route give-up clocks run on it)
const paceK = () => (spent ? 0.25 : 1 - 0.45 * tiredK());

// --- injury (body.js injury, slice 5): a hurt leg ------------------------------------------------
// The limp shows from ~0.05 and is full by ~0.85: a short, quick step onto the bad leg (badS: 1 the
// right, -1 the left, picked when a fresh injury comes), the hips dropping and the body lurching
// over it, the bad leg swung stiff and low, its boot dragging; up to 40% slower (half that with a
// splint, body.splint), heavier on energy (body.js); no climbing above HURT_CLIMB (refuse 'hurt':
// a look up the wall, then a hand to the thigh). Standing about badly hurt, a hand presses on the
// thigh. Falls from a wall: under SMALL_H px just the knockdown; SMALL_H..BAD_H hurt 0.2..0.7 (to
// 0.85 at FATAL_H); over FATAL_H they land crumpled and don't get up (body.js: death, cause 'fall').
// A wind knockdown on ice or rock hurts a little (0.03-0.08); a slip on ice, now and then (0.05).
// Fair warning on a wall: the first time a climb passes the fatal height they stop and look down
// (a beat, wind rising and a sharp breath: 'vertigo'); a gust doesn't tear them off at once but
// peels them (PEEL_S: the body swung out, the arms shaking) and a tap in that moment re-plants
// the axes (two strikes' worth of energy) and saves them ('peel' / 'replant').
const injury = () => (state.body ? state.body.injury || 0 : 0);
const limpK = () => smooth(0.04, 0.85, injury());
const SMALL_H = 15, BAD_H = 50, FATAL_H = 55, HURT_CLIMB = 0.5, PEEL_S = 0.8, LOOK_S = 1.0;
let badS = 1, downSlow = 1, thighW = 0, splintW = 0;
state.player.badLeg = badS;                       // (body.js flinches from that side of the screen)
function hurt(amount, cause, quiet = false) {
  if (injury() < 0.02) { badS = rand() < 0.5 ? -1 : 1; P.badLeg = badS; }   // a fresh injury: which leg
  state.events.push({ type: 'injury', x: P.x, y: P.y, amount, cause, quiet });
}

// --- exhaustion (body.js energy) ---------------------------------------------------------------
// Below ~0.5 the stride shortens and drags; below ~0.25 they stop by themselves now and then,
// hands on knees, head down, heaving (restT, input ignored); standing still worn out (< 0.3)
// they bend double on their own after a moment. At 0 they sit down in the snow (spent) until
// energy is back to ~0.2; pushing on from there gets them onto hands and knees, crawling at a
// quarter pace (they can still crawl to the tent). Never in the water: there it only slows them. The panting is one breathing cycle
// (pantPh 0..1: in, then out from 0.5) at a rate set by how blown they are (pant 0..1): it
// times the breath clouds, the heaving chest, the 'pant' sound events, and (player.pant /
// player.breathPh) body.js's screen pulse.
let restT = 0, restW = 0, spent = false, sitW = 0, pant = 0, pantPh = 0, fallSpent = false;
// spent but pushed on anyway: up onto hands and knees, crawling at a quarter pace (crawlW blends it)
let crawlW = 0, crawlPh = 0, sitDone = false;
const STOP_AT = [0.2, 0.12, 0.06];   // energy at which a worn-out stop comes (then a steady beat)
let stopStage = 0, stopGap = 0, tentCrawl = false;

// --- open water (terrain.isWater) ----------------------------------------------------------------
// level 0 land, 1 wading (within WADE_D of land: the paler shelf lakes.js draws), 2 deep
// (swimming). zW is how far the figure stands sunk below the painted surface (legs hidden;
// deep: only head and shoulders). The shelf/deep boundary has +-HYST of hysteresis.
// Open water is a wall until committed: walking into it stops at the edge for a beat (HES_S),
// head down; pressing on after the beat, or pressing again there soon after, commits to that
// level at that spot (commit = { lv, x, y }). Gusts, glides on ice and routes never carry
// anyone in uncommitted.
const WADE_D = T.WADE_DEPTH || 9, HYST = 1.5, HES_S = 0.9;
const water = { level: 0, depth: 0, zW: 0 };
let hesT = 0, hesLevel = 0, hesDir = 0, hesMem = null, commit = null;
let swimT = 0, sinkT = 0, ringT = 0, dripT = 0, dryRoute = null, flotsam = null, bubbleT = 0;
const rings = [], drips = [], bubbles = [];
let lastSinkX = 0, lastSinkY = 0;
// thin ice (thinice.js): the beat at the first real crack (frozen still, looking down at it), and
// self-rescue from a hole: each heave is one tap (or pushing at the edge), heaveProg how far out
// they've got (with axes ~2-3 heaves; without, the edge often breaks off and widens the hole)
// The beat is short and gives way at once to input pointing back the way they came; no load
// builds while it runs. A creak: a quick glance down (glanceT).
const ICE_BEAT = 0.5, GLANCE_S = 0.55;
let iceBeatT = 0, beatDir = 0, glanceT = 0, hollowSeed = 1, heave = null, heaveProg = 0, edgePushT = 0, coT = 0, coFrom = null, coTo = null, coDir = 0;
function waterLevelAt(x, y) {
  try { if (!T.isWater?.(x, y)) return 0; return T.waterDepth(x, y) >= WADE_D ? 2 : 1; } catch { return 0; }
}
// the level under the explorer, with hysteresis across the drop-off
function levelHere(x, y, cur) {
  let d = 0;
  try { if (!T.isWater?.(x, y)) return 0; d = T.waterDepth(x, y); } catch { return 0; }
  if (cur === 2) return d < WADE_D - HYST ? 1 : 2;
  return d >= WADE_D + HYST ? 2 : 1;
}
const committed = lv => !!commit && commit.lv >= lv && (water.level > 0 || Math.hypot(P.x - commit.x, P.y - commit.y) < 14);
// may the explorer move onto (x, y)? Not into deeper water than they're in, uncommitted.
function dryOk(x, y) {
  const lv = waterLevelAt(x, y);
  return lv <= water.level || committed(lv);
}
function crossesWater(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 3);
  for (let k = 1; k <= n; k++) if (waterLevelAt(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)) return true;
  return false;
}
function ring(x, y, r0, r1, life, dark = 0) {
  rings.push({ x, y, r0, r1, life, age: 0, dark });
  if (rings.length > 40) rings.splice(0, rings.length - 40);
}
function splashDrops(x, y, n, z = 0.4, up = 4) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, sp = 1 + rand() * 2.5;
    kicks.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * KY, vz: up * (0.6 + rand() * 0.7), life: 0.45 + rand() * 0.3, age: 0, r: 0.14 + rand() * 0.16 });
  }
  if (kicks.length > 50) kicks.splice(0, kicks.length - 50);
}

const stubTerrain = (() => { try { return T.speedFactor('deep') === T.speedFactor('path'); } catch { return true; } })();

const P = state.player;
const pose = {
  ...PROFILES.snow, stepEff: PROFILES.snow.step, shield: 0, shieldSide: 1, hug: 0, brace: 0,
  windLeanF: 0, windLeanS: 0, torsoYaw: 0, headYaw: 0, windAmt: 0, gait: 0,
  shift: 0, shiver: 0, gustKick: 0, coldShake: 0, stomach: 0, head: 0,
};
let phase = 0, tentMod = 1;
let slipT = 0, slipSide = 1, staggerT = 0, staggerSide = 1;
let breathT = 1, breathStrong = 0;
// idle behaviour timers
let shiftT = 2.5, shiftTarget = 1, lookT = 3, lookTarget = 0, shiverT = 4, shiverOn = 0;
let stampT = 8, stampOn = 0, stampSide = 1;
// hunger (body.js food): a hand to the stomach now and then, standing about hungry
let stomachT = 9, stomachOn = 0, dizzyPrev = 0;
// thirst (body.js water): a headache. Standing about, now and then a mitt goes up to the side of the
// hood, the head bowed and tipped into it (not the stomach: that's hunger)
let headT = 7, headOn = 0, headDur = 1, headBoth = 0;
const bodyWater = () => (state.body ? state.body.water ?? 1 : 1);
// the once: the first time food drops below 0.35, a glance and a pat at the pack (teaching the
// hold-to-open: ui/pack.js flashes the start of the dig bar over them while player.patHint > 0)
const PAT_S = 1.6;
let patT = 0, patDone = false;
const food = () => (state.body ? state.body.food ?? 1 : 1);
let lastGust = 0;
// coat hem spring (body-frame offset of the hem centre, lags hip velocity)
const hemS = { f: 0, r: 0, z: 0, vf: 0, vr: 0, vz: 0 };
// The pack (js/ui/pack.js, state.compass): weights for rummaging in the pack, offering it in
// the slot, holding the compass out; kneeling (at the sled, a body or a pile, or to eat), digging
// in a container in front (dig) and eating (eat, eatT the seconds into the meal); pack 0 = on the
// back, 1 = swung round in front.
// Pitching or striking the pup tent (puptent.js state.pup.job): job (kneeling at it, working;
// stage 0 spreading the canvas, 1 raising the poles, 2 driving the stakes, 3 a strike: pulling them)
// and grab (the wind's got it: arms thrown up after the canvas).
// Thirst (ui/pack.js): drink (a pull from the flask, standing; drinkT the seconds in) and snow
// (kneeling, a mittful of snow scooped up and eaten; snowT the seconds in).
const CP = { rum: 0, slot: 0, out: 0, pack: 0, kneel: 0, dig: 0, eat: 0, eatT: 0, job: 0, grab: 0, stage: 0, drink: 0, drinkT: 0, snow: 0, snowT: 0 };
function updateCompassPose(dt) {
  const st = state.compass, ph = st?.phase || 'idle', tgt = !!st?.target;
  const J = state.pup?.job, caught = !!(J && J.coll && J.coll.t < 1.15);
  CP.job = approach(CP.job, J && !caught ? 1 : 0, J ? 3.5 : 4.5, dt);
  CP.grab = approach(CP.grab, caught ? 1 : 0, caught ? 10 : 3, dt);
  if (J) CP.stage = J.kind === 'strike' ? 3 : Math.min(2, Math.floor(J.prog));
  CP.rum = approach(CP.rum, ph === 'rummage' && !tgt ? 1 : 0, ph === 'rummage' ? 4 : 5, dt);
  CP.slot = approach(CP.slot, ph === 'slot' ? 1 : 0, 5, dt);
  CP.out = approach(CP.out, ph === 'out' ? 1 : 0, 5, dt);
  const kneel = (ph === 'rummage' && tgt) || ph === 'transfer' || ph === 'eat' || ph === 'snow' || !!J;
  CP.kneel = approach(CP.kneel, kneel ? 1 : 0, kneel ? 3.5 : 4.5, dt);
  CP.dig = approach(CP.dig, (ph === 'rummage' && tgt) || ph === 'transfer' ? 1 : 0, 4, dt);
  CP.eat = approach(CP.eat, ph === 'eat' ? 1 : 0, ph === 'eat' ? 4 : 6, dt);
  CP.eatT = ph === 'eat' ? st.t : 0;
  CP.drink = approach(CP.drink, ph === 'drink' ? 1 : 0, ph === 'drink' ? 5 : 6, dt);
  CP.drinkT = ph === 'drink' ? st.t : CP.drinkT + dt;   // (runs on after a drink, so the flask goes down, not off)
  CP.snow = approach(CP.snow, ph === 'snow' ? 1 : 0, ph === 'snow' ? 4 : 6, dt);
  CP.snowT = ph === 'snow' ? st.t : CP.snowT + dt;
  // the pack comes off one shoulder and round to the front over ~0.6 s, and back on after
  // (a ration comes out of it too)
  CP.pack = clamp(CP.pack + ((ph === 'rummage' && !tgt) || ph === 'eat' ? 1 : -1) * dt / 0.6);
}
const puffs = [], kicks = [];
let rng = 1234567;
const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };

export function init() {
  P.mode = 'walk';
  P.sheltered = 0;
  // test hooks: NAS.player.knock('fall'|'shove'), NAS.player.climb(dx, dy)
  P.knock = kind => (kind === 'shove' ? startShove(1) : startFall(1));
  P.climb = (dx = 0, dy = -1) => tryClimb(dx, dy);
  P.gear = P.gear || { snowshoes: false };
  P.climbTap = (dir = 1) => climbRequest(dir);   // one climbing cycle (dir -1: down)
  P.blowOff = () => tearOff();
  P.peel = () => startPeel();                    // test hook: a gust starts to peel them off the wall
  // body.js: back at base camp as the next expedition member (crawling out of the tent), or,
  // with nobody left, gone; and a still of the figure for fallen.js
  P.respawn = gone => respawn(gone);
  P.snapshot = () => snapshot();
  P.tent = (kind = 'camp') => goToTent(kind);    // test hook: walk to the tent (or 'pup': the pup tent) and crawl in
  // ui/pack.js: a quick tap on the pitched pup tent from close by (a held one strikes it)
  P.pupTent = () => { if ((P.mode === 'walk' || P.mode === 'cower') && pupDoor() && (!spent || nearDoor('pup', 15))) goToTent('pup'); };
  P.door = () => door();                         // the door of the tent they're in (ui/pack.js hangs the pack there)
  // fx/thirst.js: the Third Man, the figure as it is this moment drawn again elsewhere, grey and faint
  P.ghost = (ctx, x, y, a, slip, seed) => drawGhost(ctx, x, y, a, slip, seed);
  P.headache = (d = 3) => { headOn = headDur = d; headT = 20; };   // test hook: the thirst headache now (if standing about)
  setShelter('camp');
  // ui/pack.js: walk to a point (the sled, a body, a pile pressed from afar); pushes 'arrive'
  // there. Any input of the player's own cancels it. And leave the tent (a tap on its door).
  P.reach = (x, y) => goReach(x, y);
  P.leaveTent = () => { if (P.mode === 'inside' && state.body?.phase !== 'sleep') { pressT = -1; P.mode = 'tent-out'; tentT = 0; } };
  P.water = water;                               // body.js reads level / depth
  P.lostAtSea = false;
  P.facing = Math.PI / 2;
  // Space / E held (inside the tent a hold sleeps till morning)
  addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'KeyE') keyHeld = true; });
  addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'KeyE') keyHeld = false; });
  addEventListener('blur', () => { keyHeld = false; });
  if (state.params.get('demo') === 'dir') P.facing = (parseFloat(state.params.get('a') || '90') * Math.PI) / 180;
}

// Menu "Return to base camp": drop every in-progress state so he simply stands there.
function resetTo(x, y) {
  climb = null; route = null; ovr = null; ovrW = 0;
  shoveT = 0; shoveV = 0; slipT = 0; staggerT = 0; downT = 0; refT = 0;
  cowerW = 0; hunkerW = 0; idleT = 0; rockHit = null; shadowOff = 0; stampOn = 0;
  kneelW = 0; faltT = 0; colT = 0; tentT = 0; tentFade = 1; pressT = -1; strapT = 0; axeReachT = 0;
  restT = 0; restW = 0; spent = false; sitW = 0; fallSpent = false; crawlW = 0;
  pose.shiver = 0; pose.coldShake = 0; pose.hug = 0; shiverOn = 0;
  water.level = 0; water.depth = 0; water.zW = 0; hesT = 0; commit = null; hesMem = null; sinkT = 0; dryRoute = null;
  drips.length = 0; P.lostAtSea = false; swimSide = 1;
  iceBeatT = 0; glanceT = 0; heave = null; heaveProg = 0; edgePushT = 0; downSlow = 1; thighW = 0; splintW = 0; colKind = 'cold';
  chips.length = 0;
  for (const k in hemS) hemS[k] = 0;
  pose.gait = 0; pose.gustKick = 0; pose.stepEff = pose.step;
  P.x = x ?? P.x; P.y = y ?? P.y; P.vx = P.vy = 0; P.speed = 0; P.moving = false;
  P.mode = 'walk'; P.climbStage = null; P.climbHold = false; P.sheltered = 0; P.deadInside = false;
  const inp = state.input;
  if (inp.tap) lastTapT = inp.tap.t;
  if (inp.action) lastActT = inp.action;
  inp.tap = null;
}

function walkable(x, y) {
  try { return T.isWalkable(x, y) !== false; } catch { return true; }
}
// Walkable ground that isn't blocked by the camp (tent footprint, sled, skis). Used for
// moving and for planning routes; climbing and rock tests keep to the terrain alone.
function passable(x, y) {
  try { return walkable(x, y) && !campBlocked(x, y) && !pupBlocked(x, y); } catch { return walkable(x, y); }
}

export function update(dt) {
  if (dt <= 0) return;
  const inp = state.input;
  for (const e of state.events) if (e.type === 'teleport') resetTo(e.x, e.y);
  updateCompassPose(dt);
  for (const e of state.events) if (e.type === 'gear' && e.item === 'axes' && !e.auto) axeReachT = 0.5;
  if (axeReachT > 0) axeReachT = Math.max(0, axeReachT - dt);
  if (patT > 0) patT = Math.max(0, patT - dt);
  P.patHint = patT > 0 ? 1 - patT / PAT_S : 0;
  for (const e of state.events) if (e.type === 'gear' && (e.item === 'snowshoes' || e.item === 'crampons')) {
    if (e.item === 'crampons' && e.auto && !e.on) continue;   // swapped for snowshoes: their own kneel plays
    // strapping on / taking off by hand: kneel at the feet ~1.2 s, rooted; the game pulling
    // them off (climbing, ice): a quick 0.4 s bend, no lock
    strapOn = !!e.on; strapItem = e.item;
    if (e.auto) { strapDur = strapT = 0.4; strapLock = false; }
    else { strapDur = strapT = 1.2; strapLock = true; }
  }
  if (strapT > 0) strapT = Math.max(0, strapT - dt);
  // open water under the feet (not while hidden in / crawling out of the tent, or gone)
  const hidden = P.mode === 'inside' || P.mode === 'gone' || P.mode === 'tent-in' || P.mode === 'tent-out' || P.lostAtSea;
  const lvl = hidden ? 0 : levelHere(P.x, P.y, water.level);
  if (lvl && !water.level && P.mode !== 'sink' && P.mode !== 'dead') {
    // into the sea from land: the cold shock, once per entry
    state.events.push({ type: 'plunge', x: P.x, y: P.y, deep: lvl === 2 });
    splashDrops(P.x, P.y, lvl === 2 ? 14 : 8, 0.4, lvl === 2 ? 6 : 4);
    ring(P.x, P.y, 2, 9, 1.6);
  } else if (lvl === 2 && water.level === 1) { splashDrops(P.x, P.y, 6, 0.6, 4); ring(P.x, P.y, 2, 8, 1.4); }   // off the shelf
  water.level = lvl; water.depth = lvl ? T.waterDepth(P.x, P.y) : 0;
  const zWant = P.mode === 'sink' ? water.zW : lvl === 1 ? lerp(1.6, 5.2, clamp(water.depth / WADE_D)) : lvl === 2 ? 9.6 - 0.6 * Math.sin(swimT * 2.2) * (1 - smooth(0.3, 0.05, warmth())) + 1.2 * smooth(0.3, 0.02, warmth()) : 0;
  if (P.mode !== 'sink' && !heave && P.mode !== 'crawlout') water.zW = approach(water.zW, zWant, 5, dt);   // (a heave and the crawl out set their own)
  if (commit && !lvl && Math.hypot(P.x - commit.x, P.y - commit.y) > 14) commit = null;   // out and away from that edge
  const ter = lvl ? 'water' : ((T.terrainAt(P.x, P.y)) || 'snow');
  P.terrain = ter;
  const shoes = shoesOn() && (ter === 'snow' || ter === 'deep');
  const cramp = crampOn() && !shoes && CRAMP[ter];
  const prof = shoes ? SHOE[ter] : cramp ? CRAMP[ter] : (PROFILES[ter] || PROFILES.snow);
  let sf = stubTerrain || ter === 'water' ? prof.speed : (T.speedFactor(ter) ?? 1);
  if (shoes && !stubTerrain) sf = ter === 'deep' ? SHOE_SPEED.deep * (T.speedFactor('snow') ?? 1) : sf * SHOE_SPEED.snow;
  // Ice is walked cautiously (Joe): walking pace stays near the cautious profile, and any extra
  // speed the terrain grants on ice shows up as glide (low friction), not frantic feet.
  if (ter === 'ice' || ter === 'thin') sf = Math.min(sf, prof.speed * 1.15);
  // crampons bite: ~85% of snow pace on ice (thin ice still careful)
  if (cramp && ter === 'ice') sf = 0.92 * (stubTerrain ? PROFILES.snow.speed : (T.speedFactor('snow') ?? 1));
  if (cramp && ter === 'thin') sf = Math.max(sf, 0.6 * (stubTerrain ? PROFILES.snow.speed : (T.speedFactor('snow') ?? 1)));
  if (!(sf > 0)) sf = prof.speed;

  // --- wind ---------------------------------------------------------------------------
  const wa = state.wind.angle ?? 0, ws = state.wind.speed ?? 0, gust = state.wind.gust ?? 0;
  let shelter = 0;
  try { shelter = T.shelterAt ? clamp(T.shelterAt(P.x, P.y) || 0) : 0; } catch { shelter = 0; }
  // the world edge: weather.js already turns the wind to blow in from the edge; out here no rock
  // gives shelter, and the storm itself is the obstacle
  const fr = state.frontier, fa = fr ? clamp(fr.amount || 0) : 0;
  const wEff = Math.max(clamp((ws + gust * 0.7) * (1 - shelter)), fa);
  P.exposure = wEff;
  const windPose = smooth(0.42, 0.85, wEff);
  // A gust arriving: a stagger that pushes the body and hood downwind.
  const gRise = Math.max(0, gust - lastGust) / dt;
  lastGust = gust;
  pose.gustKick = Math.max(pose.gustKick - dt * 1.6, clamp(gRise * 0.35) * (1 - shelter));
  pose.windAmt = approach(pose.windAmt, clamp(smooth(0.15, 0.95, wEff) * 0.9 + gust * 0.5), 4, dt);
  envW = { wa, ws, gust, wEff, windPose, shelter };

  P.push = 0; P.headwind = 0;                    // how hard they're working (walking sets it)
  P.resting = restT > 0;                         // a stop to get the breath back (body.js: only a gasp's worth)
  updatePant(dt);
  iceLoad(dt, ter);
  // the body gives out (body.js): down where they stand
  if (state.body?.phase === 'dying' && P.mode !== 'collapse' && P.mode !== 'dead' && P.mode !== 'sink') startCollapse();
  if (P.mode === 'gone') { P.exposure = 0; P.sheltered = 1; P.speed = 0; P.moving = false; return; }
  if (P.mode === 'inside') { updateInside(dt); return; }
  if (P.mode === 'tent-in' || P.mode === 'tent-out') { updateTent(dt); finishFrame(dt, ter, 0, wEff, wa); return; }
  if (P.mode === 'sink') { updateSink(dt); finishFrame(dt, ter, 0, wEff, wa); updateWaterFx(dt); return; }
  if (P.deadInside) { P.exposure = 0; P.sheltered = 1; P.speed = 0; P.moving = false; P.vx = P.vy = 0; return; }   // died in a tent: lying in there, unseen
  if (P.mode === 'collapse' || P.mode === 'dead') { updateCollapse(dt); finishFrame(dt, ter, 0, wEff, wa); return; }
  if (P.mode === 'crawlout') { updateCrawlout(dt); finishFrame(dt, ter, 0, wEff, wa); updateWaterFx(dt); return; }
  // out of your depth: swimming (from walking, cowering, or a route that led in)
  if (lvl === 2 && (P.mode === 'walk' || P.mode === 'cower' || P.mode === 'approach')) { P.mode = 'swim'; route = null; cowerW = 0; }
  if (P.mode === 'swim') { updateSwim(dt, wEff); finishFrame(dt, ter, 0.6, wEff, wa); updateWaterFx(dt); return; }

  handleActions();
  if (P.mode === 'climb') { updateClimb(dt); finishFrame(dt, 'rock', 0, wEff, wa); return; }
  if (P.mode === 'down') { updateDown(dt); finishFrame(dt, ter, 0, wEff, wa); return; }
  if (P.mode === 'refuse') { updateRefuse(dt); finishFrame(dt, ter, 0, wEff, wa); return; }
  // binding the leg with a splint (ui/pack.js): sat in the snow, the bad leg out in front
  splintW = approach(splintW, state.compass?.phase === 'splint' ? 1 : 0, state.compass?.phase === 'splint' ? 3 : 5, dt);
  ovrW = approach(ovrW, crawlW > 0.02 ? crawlW : splintW > 0.02 ? splintW : 0, crawlW > 0.02 || splintW > 0.02 ? 6 : 5, dt);

  // --- intent ----------------------------------------------------------------------------
  let ix = inp.x, iy = inp.y;
  if (P.mode === 'approach' && route) {
    // walk to the foot of the climb by ourselves
    // follow the waypoints round any rock, then the last leg to the route
    while (route.path && route.path.length > 1 && Math.hypot(route.path[0].x - P.x, route.path[0].y - P.y) < 4) route.path.shift();
    // no progress for a while (a gust shoved us into a corner): plan again from here
    // (not while stopped for breath or sat spent: that's not being stuck)
    const halted = restT > 0 || (spent && crawlW < 0.5);
    route.stuckT = !halted && P.speed < 1.5 * paceK() && approachT > 0.5 ? (route.stuckT || 0) + dt : 0;
    if (route.stuckT > 1.2) { route.path = route.avoid ? findPath(P.x, P.y, route.walkTo.x, route.walkTo.y, true, 7, 150) : findPath(P.x, P.y, route.walkTo.x, route.walkTo.y); route.stuckT = 0; }
    const wp = route.path && route.path.length > 1 ? route.path[0] : route.walkTo;
    const dRoute = Math.hypot(route.walkTo.x - P.x, route.walkTo.y - P.y);
    const dx = wp.x - P.x, dy = wp.y - P.y, d = Math.max(0.001, Math.hypot(dx, dy));
    // the give-up clock runs at the pace they can manage, and not at all while stopped
    if (!halted) approachT += dt * paceK();
    // arrived (or about to step past it this frame, or pressed against the rock right by it)
    if (route.kind === 'reach' && (inp.active || (inp.tap && inp.tap.t !== lastTapT))) { P.mode = 'walk'; route = null; }   // their own way instead
    else if (route.kind === 'reach' && (dRoute < 2 || (approachT > 0.6 && dRoute < 6 && P.speed < 1))) {
      P.mode = 'walk'; route = null;
      state.events.push({ type: 'arrive', x: P.x, y: P.y });
    }
    else if (dRoute < Math.max(1.4, P.speed * dt * 1.5) || (approachT > 0.6 && dRoute < 5 && P.speed < 1)) { if (route.kind === 'tent') beginTentIn(); else beginClimb(); finishFrame(dt, ter, 0, wEff, wa); return; }
    if (!route) { /* arrived, or given up for their own way */ }
    else if (approachT > route.limit) { P.mode = 'walk'; route = null; }
    else { const m = Math.min(1, dRoute / 3 + 0.4); ix = dx / d * m; iy = dy / d * m; }
  }
  // Holding on a point across open water: walk round it if there's a way on dry ground
  // (re-planned as the finger moves); if not, straight on to the shore (and the beat there).
  const ptr = inp.pointer;
  if (P.mode === 'walk' && ptr && !water.level && !state.demoInput) {
    // The plan is tied to where the finger is ON SCREEN (the camera follows, so its world point
    // slides every frame): only plan again once the finger has really moved, or if stuck.
    const moved = !dryRoute || Math.hypot(ptr.sx - dryRoute.sx, ptr.sy - dryRoute.sy) > 28;
    if (moved) {
      const tg = screenToWorld(ptr.sx, ptr.sy);
      if (!waterLevelAt(tg.x, tg.y) && crossesWater(P.x, P.y, tg.x, tg.y)) {
        const path = findPath(P.x, P.y, tg.x, tg.y, true, 7, 150);
        const ok = path.length > 1 || !crossesWater(P.x, P.y, path[0].x, path[0].y);
        dryRoute = { sx: ptr.sx, sy: ptr.sy, path: ok ? path : null, best: 1e9, prog: state.time };
      } else dryRoute = { sx: ptr.sx, sy: ptr.sy, path: null };
    }
    const pth = dryRoute.path;
    if (pth) {
      while (pth.length > 1 && Math.hypot(pth[0].x - P.x, pth[0].y - P.y) < 4) pth.shift();
      const wp = pth[0], dx = wp.x - P.x, dy = wp.y - P.y, d = Math.hypot(dx, dy) || 1;
      // no headway for 1.5 s (blocked, shoved off it): give up on it; straight on to the shore
      if (d < dryRoute.best - 0.5) { dryRoute.best = d; dryRoute.prog = state.time; }
      if (state.time - dryRoute.prog > 1.5) dryRoute.path = null;
      else { const m = Math.min(1, Math.hypot(ix, iy)); ix = dx / d * m; iy = dy / d * m; }
    }
  } else dryRoute = null;
  // The edge of open water: stop for a beat and look down at it. Pressing on after the beat,
  // or pressing again soon after, goes in. (Also from the shallows into deep water.)
  const dryWalk = !!(dryRoute && dryRoute.path);   // routed round the water: it's just a wall
  if (P.mode === 'walk' && Math.hypot(ix, iy) > 0.05 && !dryWalk) {
    // look a little ahead and take the FIRST deeper level met along the way (the shelf before
    // the deep beyond it)
    // (the brake during the beat and the water wall stop even a glide on ice short of it)
    const wd = Math.atan2(iy / KY, ix), ahead = 3 + P.speed * 0.3;
    let lvA = 0;
    for (let d = 0.6; d <= ahead; d += 0.8) {
      const l = waterLevelAt(P.x + Math.cos(wd) * d, P.y + Math.sin(wd) * d * KY);
      if (l > water.level) { lvA = l; break; }
    }
    // once the beat has begun, it runs on while they keep pushing that way
    if (!lvA && hesT > 0 && Math.cos(wd - hesDir) > 0.5) lvA = hesLevel;
    if (lvA && !committed(lvA)) {
      const near = hesMem && state.time - hesMem.t < 4 && hesMem.lv >= lvA && Math.hypot(P.x - hesMem.x, P.y - hesMem.y) < 12;
      if (hesT <= 0 && near) commit = { lv: lvA, x: P.x, y: P.y };          // pressed again right here
      else {
        if (hesT <= 0) { hesLevel = lvA; hesDir = wd; state.events.push({ type: 'shore', x: P.x, y: P.y, level: lvA }); }
        hesT += dt;
        if (hesT >= HES_S) { commit = { lv: lvA, x: P.x, y: P.y }; hesT = 0; hesMem = null; }
        else { ix = 0; iy = 0; }
      }
    }
  } else if (hesT > 0) { hesT = 0; hesMem = { t: state.time, x: P.x, y: P.y, lv: hesLevel }; }   // let go during the beat: remembered here
  if (hesT > 0) P.facing = wrapPi(P.facing + clamp(wrapPi(hesDir - P.facing), -5 * dt, 5 * dt));
  // thin ice: the first real crack under them stops them dead a moment, looking down at it
  if (iceBeatT > 0) {
    // pushing back the way they came ends it at once (and they go)
    const m = Math.hypot(ix, iy);
    if (m > 0.3 && Math.cos(Math.atan2(iy / KY, ix) - beatDir) < -0.3) iceBeatT = 0;
    else { iceBeatT -= dt; ix = 0; iy = 0; }
  }
  if (glanceT > 0) glanceT = Math.max(0, glanceT - dt);
  if (shoveT > 0) { ix *= 0.15; iy *= 0.15; }
  if (strapT > 0 && strapLock) { ix = 0; iy = 0; }   // kneeling at the snowshoe bindings
  // Deep cold (body.js warmth): now and then the legs simply stop, and they go down on one
  // knee for a few seconds before they can go on.
  const warm = warmth();
  if (P.mode === 'walk' && faltT <= 0 && Math.hypot(ix, iy) > 0.05 && rand() < dt * 0.22 * smooth(0.17, 0.04, warm)) faltT = 2.2 + rand() * 1.2;
  if (faltT > 0) { faltT -= dt; ix = 0; iy = 0; }
  // Exhaustion (body.js energy): worn out, they stop by themselves now and then to get their
  // breath back, hands on knees; with nothing left at all they sit down in the snow and stay
  // down until some of it comes back (in the shallows there's nowhere to sit: they stand bent).
  const en = energy();
  const pushing = Math.hypot(ix, iy) > 0.05 && (P.mode === 'walk' || P.mode === 'approach');
  // (no stopping for breath in the water, or with the bear close)
  const bear = state.bear, bearNear = !!bear && Math.hypot(bear.x - P.x, bear.y - P.y) < 60;
  // A legible ramp, not a dice roll: one stop as energy passes 0.2, another at 0.12, another
  // at 0.06, then every ~7 s of pushing below that (~5 s near the end). They only catch the
  // breath they cost (body.js), so the slide to empty goes on: standing still on purpose is the
  // real rest, and sitting spent is what comes of not taking it.
  if (en > STOP_AT[0] + 0.05) stopStage = 0;
  else if (stopStage > 0 && en > STOP_AT[stopStage - 1] + 0.05) stopStage--;
  if (pushing && restT <= 0 && !spent && !water.level && !bearNear) {
    if (stopStage < STOP_AT.length && en < STOP_AT[stopStage]) { stopStage++; stopGap = 0; startRest(1.8 + 0.3 * stopStage); }
    else if (stopStage >= STOP_AT.length) {
      stopGap += dt;
      if (stopGap > (en < 0.03 ? 6 : 8)) { stopGap = 0; startRest(2.2); }
    }
  }
  if (!spent && en <= 0.001 && !water.level && (P.mode === 'walk' || P.mode === 'approach' || P.mode === 'cower')) {
    spent = true; restT = 0;
    if (P.mode === 'cower') P.mode = 'walk';
    state.events.push({ type: 'tired', x: P.x, y: P.y });
  }
  if (spent && (en >= 0.2 || water.level)) spent = false;
  if (water.level) restT = 0;
  if (restT > 0) { restT -= dt; ix = 0; iy = 0; }
  // spent and pushing on: up onto hands and knees (the first ~0.6 s is the effort of it)
  // (only once they're down: holding on through the moment it runs out still drops them)
  if (!spent) sitDone = false; else if (sitW > 0.85) sitDone = true;
  const crawling = spent && sitDone && Math.hypot(ix, iy) > 0.05;
  crawlW = approach(crawlW, crawling ? 1 : 0, crawling ? 2.2 : 3, dt);
  if (spent && crawlW < 0.6) { ix = 0; iy = 0; }
  const mag = Math.min(1, Math.hypot(ix, iy));
  const active = mag > 0.05;
  const wantDir = active ? Math.atan2(iy / KY, ix) : P.facing;
  const into = Math.max(0, -Math.cos(wantDir - wa));

  // Pause at each foot plant on ice: |sin| is 0 at the plants.
  tentMod = 1 - pose.tent * (1 - Math.pow(Math.abs(Math.sin(phase * Math.PI * 2)), 0.6));
  let spd = BASE_SPEED * sf * mag * (1 - 0.45 * wEff * into) * (1 - pose.tent * 0.35) * lerp(1, 0.45, fa) * (1 - 0.25 * CP.out);
  if (staggerT > 0) spd *= 0.35;
  if (slipT > 0) spd *= 0.5;
  spd *= lerp(0.42, 1, smooth(0.05, 0.45, warm));   // numb, heavy legs
  spd *= 1 - 0.2 * (state.body?.frozen || 0);        // clothes frozen stiff
  const tk = tiredK();
  spd *= 1 - 0.45 * tk;                              // worn out: shorter, heavier strides
  spd *= 1 - 0.2 * smooth(0.3, 0, food());           // hungry: slower, more so the emptier (stumbles below)
  const dz = state.body?.dizzy || 0;
  spd *= 1 - 0.55 * dz;                              // lightheaded: the legs go for a moment
  spd *= 1 - 0.4 * clamp(injury()) * (state.body?.splint ? 0.5 : 1);   // hurt: up to 40% slower (splinted, half that)
  if (dz > 0.05 && dizzyPrev <= 0.05 && P.mode === 'walk' && staggerT <= 0) { staggerT = 0.75; staggerSide = rand() < 0.5 ? -1 : 1; }
  dizzyPrev = dz;
  if (spent) spd = BASE_SPEED * sf * mag * 0.25 * smooth(0.6, 1, crawlW);   // crawling: a quarter pace
  // a steady push back toward the interior, stronger the deeper in
  // (not while walking a planned route to a climb: the path already threads the rock)
  const drift = fa > 0 && P.mode !== 'approach' ? fa * (2.5 + 7 * fa) : 0;
  const tvx = (active ? Math.cos(wantDir) * spd : 0) + (fa > 0 ? fr.inX * drift : 0);
  const tvy = (active ? Math.sin(wantDir) * spd * KY : 0) + (fa > 0 ? fr.inY * drift : 0);
  const k = active ? prof.accel : prof.fric;
  P.vx = approach(P.vx, tvx, k, dt);
  P.vy = approach(P.vy, tvy, k, dt);
  if (iceBeatT > 0) { const b = 1 - Math.exp(-10 * dt); P.vx -= P.vx * b; P.vy -= P.vy * b; }
  if (hesT > 0) {
    // the beat at the edge: dig in, whatever the ice or the wind would have
    const ux = Math.cos(hesDir), uy = Math.sin(hesDir) * KY, ul = Math.hypot(ux, uy), along = (P.vx * ux + P.vy * uy) / ul;
    if (along > 0) { const b = along * (1 - Math.exp(-12 * dt)) / ul; P.vx -= ux * b; P.vy -= uy * b; }
  }
  const slick = ter === 'ice' || ter === 'thin' ? 2.5 : 1;
  const push = gust * (1 - shelter) * 7 * slick * dt;
  P.vx += Math.cos(wa) * push;
  P.vy += Math.sin(wa) * push * KY;
  if (staggerT > 0) { P.vx += -Math.sin(P.facing) * staggerSide * 6 * dt; P.vy += Math.cos(P.facing) * staggerSide * 6 * dt * KY; }
  if (shoveT > 0) { shoveT -= dt; P.vx += Math.cos(wa) * shoveV * dt; P.vy += Math.sin(wa) * shoveV * dt * KY; shoveV *= Math.exp(-4 * dt); }

  // --- collision: slide along rock ---------------------------------------------------------
  const ox = P.x, oy = P.y;
  let nx = P.x + P.vx * dt, ny = P.y + P.vy * dt;
  const probe = (x, y) => {
    const d = Math.hypot(x - ox, y - oy) || 1;
    if (!dryOk(x, y)) return false;                 // open water is a wall until committed
    return passable(x, y) && passable(x + ((x - ox) / d) * 1.5, y + ((y - oy) / d) * 1.5);
  };
  if (!probe(nx, ny)) {
    if (probe(nx, oy)) { ny = oy; P.vy *= 0.2; }
    else if (probe(ox, ny)) { nx = ox; P.vx *= 0.2; }
    else { nx = ox; ny = oy; P.vx = P.vy = 0; }
  }
  P.x = nx; P.y = ny;
  P.speed = Math.hypot(P.x - ox, P.y - oy) / dt;
  P.moving = P.speed > 0.6;
  // the work of it, for body.js: pushing on and getting somewhere, and how much of it into the wind
  if (P.moving && active && !spent) { P.push = mag; P.headwind = into * wEff; }
  P.crawl = crawlW > 0.5;   // body.js: crawling spent neither costs nor gives back
  P.spent = spent;
  if (crawlW > 0.02) { crawlPh += P.speed * dt * 1.6; ovr = crawlPose(1, crawlPh, clamp(P.speed / 1.2)); }
  else if (splintW > 0.02) ovr = splintPose(state.compass?.phase === 'splint' ? state.compass.t : 4);

  // --- facing -----------------------------------------------------------------------------
  if (active) {
    const turnRate = (ter === 'ice' || ter === 'thin' ? 4 : 6.5) * dt;
    const d = wrapPi(wantDir - P.facing);
    P.facing = wrapPi(P.facing + clamp(d, -turnRate, turnRate));
  } else if (state.pup?.job) {
    // pitching / striking the pup tent: turned to it (a little off straight-away from the camera)
    const J = state.pup.job, w0 = Math.atan2((J.y - P.y) / KY, J.x - P.x);
    const want = Math.sin(w0) < -0.3 ? w0 + (Math.cos(w0) >= 0 ? 0.55 : -0.55) : w0;
    P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -3 * dt, 3 * dt));
  } else if (CP.out > 0.5) {
    // orienting by the compass: turn slowly to face north-west (screen up-left)
    const nw = Math.atan2(-1 / KY, -1);
    P.facing = wrapPi(P.facing + clamp(wrapPi(nw - P.facing), -0.8 * dt, 0.8 * dt));
  } else if (state.compass?.target) {
    // kneeling to the sled, a body or a pile: turn to it
    // (turned a little off straight-away from the camera, so the reaching arms show from behind)
    const tg = state.compass.target, w0 = Math.atan2((tg.y - P.y) / KY, tg.x - P.x);
    const want = Math.sin(w0) < -0.3 ? w0 + (Math.cos(w0) >= 0 ? 0.55 : -0.55) : w0;
    P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -3 * dt, 3 * dt));
  } else if (splintW > 0.3) {
    // binding the leg: side-on to the camera, so the leg out in front shows
    const want = Math.cos(P.facing) >= 0 ? 0.2 : Math.PI - 0.2;
    P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -1.6 * dt, 1.6 * dt));
  } else if (CP.eat > 0.3 || CP.drink > 0.3 || CP.snow > 0.3) {
    // eating (or drinking, or eating snow): half round toward the camera, so it reads (whichever side is nearer)
    const want = Math.cos(P.facing) >= 0 ? Math.PI * 0.3 : Math.PI * 0.7;
    P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -1.6 * dt, 1.6 * dt));
  }
  updateCower(dt, active);

  // --- gait ---------------------------------------------------------------------------------
  const walkSpeed = Math.min(P.speed, Math.hypot(tvx, tvy) + 0.5);
  pose.gait = approach(pose.gait, clamp(walkSpeed / 3), 6, dt);
  const proj = Math.hypot(Math.cos(P.facing), KY * Math.sin(P.facing));
  pose.stepEff = approach(pose.stepEff, Math.max(pose.step, walkSpeed / (prof.cad * proj)), 6, dt);
  const strideProj = pose.stepEff * proj;
  const prev = phase;
  // On ice the feet pause at each plant while the body glides on.
  // limping: the step onto the bad leg is cut short (its half of the cycle goes by faster)
  // (splinted: the rhythm evens out some)
  const lk = limpK() * (state.body?.splint ? 0.55 : 1), onBad = (badS > 0 ? phase >= 0.5 : phase < 0.5);
  const limpMod = lk > 0.01 ? (onBad ? 1 + 0.9 * lk : 1 / (1 + 0.35 * lk)) : 1;
  if (pose.gait > 0.02) phase += (walkSpeed * tentMod * dt * limpMod) / (2 * Math.max(0.6, strideProj));
  if (phase >= 1) phase -= 1;
  const crossed = f => (prev < f && phase >= f) || (f === 0 && phase < prev);
  if (pose.gait > 0.25 && crawlW < 0.5) {
    if (crossed(0)) footDown('L', prof, ter);
    if (crossed(0.5)) footDown('R', prof, ter);
  }

  // --- pose targets ---------------------------------------------------------------------------
  const r = Math.min(1, dt * 3.2);
  for (const key of POSE_KEYS) pose[key] += (tiredTarget(key, prof[key], tk) - pose[key]) * r;
  if (hesT > 0) { pose.hunch = approach(pose.hunch, 1.15, 7, dt); pose.spread = approach(pose.spread, 0.3, 5, dt); }
  if (iceBeatT > 0) { pose.hunch = approach(pose.hunch, 1.3, 9, dt); pose.spread = approach(pose.spread, 0.7, 6, dt); pose.crouch = approach(pose.crouch, 1.0, 6, dt); }

  const g = pose.gait, idle = 1 - smooth(0.1, 0.5, g);
  const up = wrapPi(wa + Math.PI - P.facing);
  const back = Math.cos(up) < 0 ? 0.35 : 1;
  const wl = windPose * (0.18 + 0.2 * g) + fa * 0.16;
  pose.windLeanF = approach(pose.windLeanF, Math.cos(up) * wl * back, 3, dt);
  pose.windLeanS = approach(pose.windLeanS, Math.sin(up) * wl * 0.8, 3, dt);
  const side = Math.sin(up);
  if (Math.abs(side) > 0.45) pose.shieldSide = side > 0 ? 1 : -1;
  else if (pose.shield < 0.1) pose.shieldSide = Math.cos(P.facing) >= 0 ? 1 : -1;
  const shieldT = windPose * smooth(0.15, 0.75, g) * clamp(0.15 + into * 1.1 + Math.abs(side) * 0.35);
  pose.shield = approach(pose.shield, shieldT, 3, dt);
  const gustAmt = smooth(0.12, 0.5, gust);
  // hands tucked into the armpits when idle in hard cold (cold is read just below, for shivers too)
  // ...and, as the body chills (warmth below ~0.7), hugged in even while walking
  pose.hug = approach(pose.hug, Math.max(idle * clamp(windPose * (0.7 + 0.3 * wEff) + pose.shiver * 0.6 + smooth(0.7, 0.85, clamp(state.weather.cold ?? 0))), smooth(0.72, 0.42, warm) * (1 - 0.25 * g)), 2.5, dt);
  pose.brace = approach(pose.brace, idle * windPose * (0.35 + 0.65 * gustAmt), 3, dt);

  // --- idle life: weight shifts, slow looks, shivers, foot stamps ----------------------------
  shiftT -= dt;
  // (a worn reserve: slower, heavier weight shifts)
  if (shiftT <= 0) { shiftT = (2 + rand() * 2) * (1 + 1.2 * smooth(0.55, 0.1, reserve())); shiftTarget = -shiftTarget; }
  pose.shift = approach(pose.shift, shiftTarget * idle, 2.2, dt);
  lookT -= dt;
  if (lookT <= 0) {
    lookT = 2.5 + rand() * 3;
    lookTarget = lookTarget !== 0 && rand() < 0.6 ? 0 : (rand() < 0.5 ? -0.85 : 0.85);
  }
  const look = lookTarget * idle * (1 - windPose * 0.7);
  shiverT -= dt;
  if (shiverOn > 0) shiverOn -= dt;
  const coldNow = clamp(state.weather.cold ?? 0);
  // the body's own cold (warmth): shivers come oftener, then hard and near-constant even on
  // the move; past ~0.1 the shivering stops, which is worse
  const hard = smooth(0.62, 0.32, warm) * (1 - smooth(0.13, 0.05, warm));
  if (shiverT <= 0) {
    shiverT = (3 + rand() * 4) * (1 - 0.5 * coldNow) * (1 - 0.85 * hard);
    if (((wEff > 0.4 || coldNow > 0.55 || warm < 0.8) && idle > 0.5) || hard > 0.35) shiverOn = 0.8 + rand() * 0.6 + hard * 2.5;
  }
  // huddled in a storm with the cold in them: shaking the whole time
  const huddle = cowerW * smooth(0.8, 0.45, warm) * (1 - smooth(0.13, 0.05, warm));
  if (huddle > 0.3) shiverOn = Math.max(shiverOn, 0.3);
  if (warm < 0.08) shiverOn = 0;
  pose.shiver = approach(pose.shiver, shiverOn > 0 ? 1 : 0, 8, dt);
  pose.coldShake = approach(pose.coldShake, Math.max(hard, huddle * 0.9), 2, dt);
  stampT -= dt * (1 + wEff);
  if (stampOn > 0) {
    stampOn -= dt;
    if (stampOn <= 0) {
      const c = Math.cos(P.facing), sn = Math.sin(P.facing), st = pose.stance;
      state.events.push({ type: 'step', x: P.x - stampSide * st * sn, y: P.y + stampSide * st * c * KY, terrain: ter, foot: stampSide < 0 ? 'L' : 'R', weight: prof.weight * 0.8, angle: P.facing });
    }
  }
  if (stampT <= 0) { stampT = 6 + rand() * 7; if (idle > 0.8) { stampOn = 0.45; stampSide = rand() < 0.5 ? -1 : 1; } }

  const yawWind = clamp(up - Math.sign(up || 1) * Math.PI / 2, -0.75, 0.75) * pose.brace;
  pose.torsoYaw = approach(pose.torsoYaw, yawWind + look * 0.3, 2, dt);
  pose.headYaw = approach(pose.headYaw, look * 0.75 - pose.brace * Math.sign(up || 1) * 0.35, 1.4, dt);
  // --- hunger: standing about hungry (food < ~0.35), now and then a hand goes to the stomach,
  // hunched over it for a couple of seconds, oftener the emptier; in a quiet moment (little
  // wind) it growls (audio). Not while busy with the pack, cowering, kneeling or worn out.
  const fd = food();
  stomachT -= dt;
  if (stomachOn > 0) stomachOn -= dt;
  if (stomachT <= 0) {
    stomachT = lerp(15, 6, smooth(0.35, 0.03, fd)) * (0.7 + rand() * 0.6);
    if (fd < 0.35 && idle > 0.7 && CP.kneel < 0.1 && CP.rum < 0.1 && CP.out < 0.1 && CP.slot < 0.1 && cowerW < 0.2 && kneelW < 0.2 && !spent && restT <= 0 && !water.level) {
      stomachOn = 2.2 + rand() * 1.2;
      state.events.push({ type: 'growl', x: P.x, y: P.y, strength: 0.45 + 0.55 * smooth(0.35, 0, fd) });   // (audio ducks the wind under it)
    } else if (fd < 0.3 && (fd < 0.2 || rand() < 0.35)) state.events.push({ type: 'growl', x: P.x, y: P.y, strength: 0.4 + 0.5 * smooth(0.3, 0, fd) });   // walking, cowering...: just the sound (always, below 0.2)
  }
  if (!patDone && (fd < 0.35 || bodyWater() < 0.35) && idle > 0.7 && P.mode === 'walk' && CP.kneel < 0.1 && CP.rum < 0.1 && CP.slot < 0.1 && CP.out < 0.1 && kneelW < 0.2 && !spent && restT <= 0 && !water.level && (state.compass?.phase || 'idle') === 'idle') {
    patDone = true; patT = PAT_S; stomachOn = 0;
  }
  if (!(idle > 0.5) || fd >= 0.4) stomachOn = Math.min(stomachOn, 0);
  pose.stomach = approach(pose.stomach, stomachOn > 0 ? 1 : 0, stomachOn > 0 ? 3 : 4, dt);
  // --- thirst: standing about thirsty (water < 0.3), now and then the headache: a mitt pressed to the
  // side of the hood, the head bowed and tipped into it, for a few seconds; oftener the drier. Never
  // with the hand on the stomach (hunger and thirst take turns, so each reads as itself).
  const wt = bodyWater();
  headT -= dt;
  if (headOn > 0) headOn -= dt;
  if (headT <= 0) {
    headT = lerp(16, 6, smooth(0.3, 0.02, wt)) * (0.7 + rand() * 0.6);
    if (wt < 0.3 && idle > 0.7 && pose.stomach < 0.1 && stomachOn <= 0 && CP.kneel < 0.1 && CP.rum < 0.1 && CP.out < 0.1 && CP.slot < 0.1 && CP.drink < 0.1 && cowerW < 0.2 && kneelW < 0.2 && !spent && restT <= 0 && !water.level && thighW < 0.3) {
      headOn = headDur = 2.4 + rand() * 1.4;
      state.events.push({ type: 'thirst', stage: 'head', x: P.x, y: P.y, strength: 0.4 + 0.6 * smooth(0.3, 0, wt) });
    }
  }
  if (!(idle > 0.5) || wt >= 0.35 || stomachOn > 0) headOn = Math.min(headOn, 0);
  pose.head = approach(pose.head || 0, headOn > 0 ? 1 : 0, headOn > 0 ? 3.2 : 3.5, dt);
  // (the first ~1.1 s both mitts go to the temples, so it reads at any size; then the one rubs on)
  headBoth = approach(headBoth, headOn > 0 && headDur - headOn < 1.1 ? 1 : 0, 5, dt);
  // badly hurt, standing about: a hand pressed on the bad thigh, the weight off that leg
  const thighOn = injury() > 0.45 && idle > 0.7 && pose.stomach < 0.3 && CP.kneel < 0.1 && CP.rum < 0.1 && CP.out < 0.1 && CP.slot < 0.1 && cowerW < 0.2 && kneelW < 0.2 && !spent && restT <= 0 && !water.level && splintW < 0.1;
  thighW = approach(thighW, thighOn ? 1 : 0, thighOn ? 2.5 : 5, dt);
  // --- numb feet: stumbles once the cold is deep (and starving: unsteady on the feet) ----------
  if (P.mode === 'walk' && active && staggerT <= 0 && rand() < dt * (0.45 * smooth(0.36, 0.1, warm) + 0.2 * smooth(0.1, 0, fd) + 0.12 * smooth(0.1, 0, bodyWater()))) { staggerT = 0.75; staggerSide = rand() < 0.5 ? -1 : 1; }
  // --- wind knockdowns: in a real storm, out in the open, now and then ------------------------
  // (kneeling at the pup tent: low, braced; but up off their knees grabbing at it as it goes, a gust can still have them over)
  if (P.mode === 'walk' && shoveT <= 0 && cowerW < 0.3 && !spent && !(state.pup?.job && !state.pup.job.coll)) {
    const storm = Math.max(smooth(0.62, 0.9, ws) * smooth(0.4, 0.85, gust) * (1 - smooth(0.25, 0.6, shelter)), smooth(0.55, 1, fa) * 1.6);
    const slickK = ter === 'ice' || ter === 'thin' ? 2 : 1;
    if (storm > 0 && rand() < storm * slickK * dt / 110) startFall(storm);
    else if (storm > 0 && rand() < storm * slickK * dt / 40) startShove(storm);
  }

  // --- coat hem spring: lags hip velocity by ~0.15 s ----------------------------------------
  const c = Math.cos(P.facing), sn = Math.sin(P.facing);
  const vf = P.vx * c + (P.vy / KY) * sn, vr = -P.vx * sn + (P.vy / KY) * c;
  const w0 = 1 / 0.15, z0 = 0.45;
  const tf = -vf * 0.055, tr = -vr * 0.055;
  const bobNow = -pose.bob * g * Math.cos(phase * Math.PI * 4);
  // semi-implicit, substepped so big frame steps (slow devices, ?speed=) stay stable
  const nSub = Math.ceil(dt / 0.008), h = dt / nSub;
  for (let i = 0; i < nSub; i++) {
    hemS.vf += (w0 * w0 * (tf - hemS.f) - 2 * z0 * w0 * hemS.vf) * h; hemS.f += hemS.vf * h;
    hemS.vr += (w0 * w0 * (tr - hemS.r) - 2 * z0 * w0 * hemS.vr) * h; hemS.r += hemS.vr * h;
    hemS.vz += (w0 * w0 * (bobNow * 0.6 - hemS.z) - 2 * z0 * w0 * hemS.vz) * h; hemS.z += hemS.vz * h;
  }
  hemS.f = clamp(hemS.f, -2, 2); hemS.r = clamp(hemS.r, -2, 2); hemS.z = clamp(hemS.z, -1, 1);

  P.lean = clamp(pose.lean * g + Math.max(0, pose.windLeanF) * 2 + pose.work * g * 0.3);

  if (slipT > 0) slipT -= dt;
  if (staggerT > 0) staggerT -= dt;

  updateBreath(dt, ter, g, wEff, wa);
  updateKicks(dt);
  updateChips(dt);
  updateWaterFx(dt);
}

// Worn out (tk 0..1): the stride shortens and the feet barely clear the snow (they drag),
// bent further over, head down, the arms hardly swing, and each step lands heavier.
function tiredTarget(key, v, tk) {
  if (tk <= 0) return v;
  switch (key) {
    case 'step': return v * (1 - 0.35 * tk);
    case 'lift': return v * (1 - 0.6 * tk);
    case 'lean': return v + 0.22 * tk;
    case 'hunch': return v + 0.5 * tk;
    case 'swing': return v * (1 - 0.7 * tk);
    case 'bob': return v + 0.14 * tk;
    case 'crouch': return v + 0.18 * tk;
    case 'sink': return v + 0.15 * tk;
    default: return v;
  }
}
function startRest(dur) {
  restT = dur;
  state.events.push({ type: 'rest', x: P.x, y: P.y });
}
// The panting clock (see restT above): rate and depth from energy, with a floor from a worn
// reserve (it never quite settles) and a push while stopped bent over or sat in the snow.
function updatePant(dt) {
  const hidden = P.mode === 'inside' || P.mode === 'gone' || P.mode === 'dead' || P.mode === 'collapse' || P.mode === 'sink' || P.lostAtSea;
  const want = hidden ? 0 : Math.max(smooth(0.6, 0.04, energy()), restT > 0 || spent ? 0.85 : 0, 0.2 * smooth(0.55, 0.1, reserve()));
  pant = approach(pant, want, want > pant ? 1.2 : 0.5, dt);
  const prev = pantPh;
  pantPh += dt * lerp(0.26, 1.05, pant);
  if (pantPh >= 1) pantPh -= 1;
  P.pant = pant; P.breathPh = pantPh;
  if (pant < 0.22 || hidden || P.mode === 'tent-in' || P.mode === 'tent-out' || P.mode === 'swim') return;   // (a swimmer gasps: audio.js)
  const len = 0.5 / lerp(0.26, 1.05, pant);
  if (prev < 0.5 && pantPh >= 0.5) {
    state.events.push({ type: 'pant', x: P.x, y: P.y, inhale: false, len, strength: pant });
    exhale(pant);
  } else if (pantPh < prev) state.events.push({ type: 'pant', x: P.x, y: P.y, inhale: true, len, strength: pant });
}

// Thin ice (thinice.js): bear on it. How heavily: a full pack more, snowshoes far less (they
// spread the weight), flat on it (knocked down, crawling) less; how hard: standing still is the
// base, moving adds to it (k 1 at the creep's walking pace, more at a crampon march).
const ICE_MODES = new Set(['walk', 'approach', 'cower', 'down', 'refuse']);
function iceLoad(dt, ter) {
  // (frozen in the beat at the first crack: nothing builds while they decide)
  if (ter !== 'thin' || water.level || !ICE_MODES.has(P.mode) || iceBeatT > 0) { P.iceStress = ter === 'thin' && !water.level ? ICE.stressAt(P.x, P.y) : 0; return; }
  let n = 0;
  if (state.pack) for (const q of state.pack.slots) if (q) n += q.id === 'puptent' ? 2 : 1;   // (the pup tent weighs double)
  let w = 1 + 0.35 * n / 10;
  if (shoesOn()) w *= 0.35;
  if (P.mode === 'down' || crawlW > 0.5) w *= 0.45;
  else if (sitW > 0.5) w *= 0.7;
  const canBeat = P.mode === 'walk' && !spent && crawlW < 0.5;
  const r = ICE.load(P.x, P.y, dt, w, Math.pow(clamp(P.speed / 4.2, 0, 2), 1.2), canBeat);
  P.iceStress = r.s;
  if (r.first && canBeat && !r.broke) { iceBeatT = ICE_BEAT; beatDir = P.facing; }
  if (r.creak && glanceT <= 0 && P.mode === 'walk') glanceT = GLANCE_S;
}

// Binding the leg (ui/pack.js 'splint', t seconds in): sat in the snow, the good knee drawn up,
// the bad leg straight out in front, bent over it, both mitts passing the roll round the shin.
function splintPose(t) {
  const b = badS, w = t * 6.5, c = Math.cos(w), sn = Math.sin(w);
  const shin = [2.9 - 0.25 * smooth(3.2, 3.9, t), b * 0.8, 0.95];
  const hA = [shin[0] + 0.3 * sn, shin[1] + 0.6 * c, shin[2] + 0.5 * sn + 0.25];
  const hB = [shin[0] + 0.5 - 0.3 * sn, shin[1] - 0.6 * c, shin[2] - 0.4 * sn + 0.45];
  return {
    hz: 1.9, leanF: 0.5 + 0.05 * sn, leanS: 0,
    feet: b > 0 ? [[1.6, -1.15, 0.15], [4.5, 0.8, 0.25]] : [[4.5, -0.8, 0.25], [1.6, 1.15, 0.15]],
    hands: b > 0 ? [hB, hA] : [hA, hB],
    poleA: [[-0.3, -1, -0.5], [-0.3, 1, -0.5]],
    poleL: b > 0 ? [[1, -0.3, 0.8], [0.3, 0.2, 1]] : [[0.3, -0.2, 1], [1, 0.3, 0.8]],
    hemAttach: 0.55, facePitch: 0.95, full: true, axes: 0,
  };
}

// Shared tail for the special modes (climb, down): no walking, but breath, particles and
// the hem spring keep running.
function finishFrame(dt, ter, g, wEff, wa) {
  P.speed = 0; P.moving = false;
  pose.gait = approach(pose.gait, 0, 6, dt);
  restT = 0; restW = approach(restW, 0, 5, dt); sitW = approach(sitW, spent ? 1 : 0, spent ? 1.8 : 5, dt);
  hemS.f = approach(hemS.f, 0, 4, dt); hemS.r = approach(hemS.r, 0, 4, dt); hemS.z = approach(hemS.z, 0, 4, dt);
  updateBreath(dt, ter, Math.max(g, 0.8), wEff, wa);
  updateKicks(dt);
  updateChips(dt);
}

// =================================================================================================
// Modes beyond walking: climbing (ice axes + crampons), wind knockdowns, cowering / hunkering.
// Each special pose is a body-frame override `ovr` that buildRig blends in by `ovrW`; cowering
// has its own weight `cowerW` because it blends with the idle stance rather than replacing it.
// =================================================================================================
let envW = { wa: 0, ws: 0, gust: 0, wEff: 0, windPose: 0, shelter: 0 };
let ovr = null, ovrW = 0;
let route = null, climb = null, approachT = 0, lastTapT = -1, lastActT = -1;
let shoveT = 0, shoveV = 0;
let downT = 0, downV = { x: 0, y: 0 }, downDir = 0;
let cowerW = 0, hunkerW = 0, hunkerSide = 1, idleT = 0, rockScanT = 0, rockHit = null;
const chips = [];

// --- climbing: input -------------------------------------------------------------------------------
// Off the wall: a tap on a face (or Space/E facing one) walks to the route and mounts it.
// On the wall: each fresh tap (or Space/E) is ONE climbing cycle; a tap well below the climber
// climbs down a cycle instead. Holding doesn't repeat; one tap may be queued during a cycle.
function handleActions() {
  const inp = state.input;
  // only fresh presses count (input.action defaults to 0; a press made mid-animation must not fire later)
  const fresh = t => t > 0 && state.time - t < 1.0;
  let tap = null, act = false;
  if (inp.tap && inp.tap.t !== lastTapT) { lastTapT = inp.tap.t; if (fresh(inp.tap.t)) tap = inp.tap; }
  if (inp.action && inp.action !== lastActT) { lastActT = inp.action; if (fresh(inp.action)) act = true; }
  if (P.mode === 'climb') {
    if (tap || act) {
      // The climb keeps the direction it started in (route.up); later taps just continue it.
      // Reversing takes a tap clearly on the other side: well below the boots when going up,
      // well above the head when going down.
      const c = climb;
      let dir = c ? c.lock : 1;
      if (c && tap) {
        if (c.lock > 0 && tap.y > P.y + 25) dir = -1;
        else if (c.lock < 0 && tap.y < P.y - 17 - 25) dir = 1;
      }
      if (c) c.lock = dir;
      climbRequest(dir);
      if (tap) inp.tap = null; else inp.action = null;
    }
    return;
  }
  if (P.mode !== 'walk' && P.mode !== 'cower') return;
  // the tent: a tap on it (or Space/E by its door) walks to the door and crawls in
  // (spent, only from close by: ~15 units, crawling)
  // (the pup tent once it's pitched, the same: puptent.js)
  const reachTent = !spent || nearDoor('camp', 15), reachPup = !spent || nearDoor('pup', 15);
  if (tap && reachTent && campInteract(tap.x, tap.y) === 'tent') { goToTent('camp'); inp.tap = null; return; }
  if (tap && reachPup && pupInteract(tap.x, tap.y)) { goToTent('pup'); inp.tap = null; return; }
  if (act && state.compass?.target) act = false;   // Space / E held at the sled / a body: rummaging (ui/pack.js)
  if (act && state.pup?.press) act = false;         // ...or held on the pitched pup tent: striking it (ui/pack.js)
  // (base camp's door first: the pup tent is never pitched close to it, puptent.js)
  if (act && reachTent && nearDoor('camp')) { goToTent('camp'); inp.action = null; return; }
  if (act && reachPup && nearDoor('pup')) { goToTent('pup'); inp.action = null; return; }
  if (spent) return;   // no climbing from sat in the snow
  if (tap && tapClimb(tap)) inp.tap = null;
  if (act && tryClimb(Math.cos(P.facing), Math.sin(P.facing) * KY)) inp.action = null;
}

// A tap on rock, or on ground at another level (below a lip / up on a plateau), asks terrain for
// the best vertical route toward it: tap above climbs up, tap below climbs down.
function tapClimb(tap) {
  let other = !walkable(tap.x, tap.y);
  try { if (!other && T.regionAt) other = T.regionAt(tap.x, tap.y) !== T.regionAt(P.x, P.y); } catch { /* keep */ }
  if (!other) return false;
  let r = null;
  try { r = T.bestClimb?.(P.x, P.y, tap.x, tap.y) ?? null; } catch { r = null; }
  if (!r) {
    const dx = tap.x - P.x, dy = tap.y - P.y;
    return Math.hypot(dx, dy) < 30 && tryClimb(dx, dy);
  }
  setRoute(r);
  return true;
}
function setRoute(r) {
  const up = r.up !== false;
  route = { ...r, up, bottom: up ? r.start : r.end, top: up ? r.end : r.start, walkTo: r.walkTo || r.start };
  route.avoid = crossesWater(P.x, P.y, route.walkTo.x, route.walkTo.y);   // round the water if it's in the way
  route.path = route.avoid ? findPath(P.x, P.y, route.walkTo.x, route.walkTo.y, true, 7, 150) : findPath(P.x, P.y, route.walkTo.x, route.walkTo.y);
  let len = 0, a = P;
  for (const q of route.path) { len += Math.hypot(q.x - a.x, q.y - a.y); a = q; }
  route.limit = 10 + len / 2.5;          // give up if it takes far longer than the walk should
  P.mode = 'approach'; approachT = 0;
}

// Walking to a route that's round a rock spur: breadth-first search on a coarse grid (4u cells,
// within ~180u), returned as simplified waypoints ending at the target.
function findPath(x0, y0, x1, y1, avoidWater = false, G = 5, pad = 260) {
  const minX = Math.min(x0, x1) - pad, minY = Math.min(y0, y1) - pad;
  const W = Math.ceil((Math.abs(x1 - x0) + 2 * pad) / G) + 1, Hh = Math.ceil((Math.abs(y1 - y0) + 2 * pad) / G) + 1;
  if (W * Hh > 40000) return [{ x: x1, y: y1 }];
  const cell = (x, y) => [Math.round((x - minX) / G), Math.round((y - minY) / G)];
  const [sx, sy] = cell(x0, y0), [tx, ty] = cell(x1, y1);
  const prev = new Int32Array(W * Hh).fill(-1);
  // cells need body clearance, so the path never threads a gap the walk collision won't pass
  const ok = (i, j) => {
    const x = minX + i * G, y = minY + j * G;
    if (!passable(x, y) || (avoidWater && waterLevelAt(x, y))) return false;
    for (let a = 0; a < 8; a++) {
      const qx = x + Math.cos(a * 0.785) * 4, qy = y + Math.sin(a * 0.785) * 4;
      // keep clear of the edge too (except right where we start: we may be standing by it)
      if (!passable(qx, qy) || (avoidWater && waterLevelAt(qx, qy) && Math.abs(i - sx) + Math.abs(j - sy) > 2)) return false;
    }
    return true;
  };
  const q = [sy * W + sx]; prev[sy * W + sx] = sy * W + sx;
  let found = -1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % W, j = (c / W) | 0;
    if (Math.abs(i - tx) <= 1 && Math.abs(j - ty) <= 1) { found = c; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj, n = nj * W + ni;
      if (ni < 0 || nj < 0 || ni >= W || nj >= Hh || prev[n] >= 0) continue;
      if (!ok(ni, nj) && !(Math.abs(ni - tx) <= 1 && Math.abs(nj - ty) <= 1)) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (found < 0) return [{ x: x1, y: y1 }];
  const pts = [];
  for (let c = found; ; c = prev[c]) { pts.push({ x: minX + (c % W) * G, y: minY + ((c / W) | 0) * G }); if (prev[c] === c) break; }
  pts.reverse();
  // keep only the corners: drop points whose neighbours can see each other
  // a leg is clear if a body-wide corridor along it is walkable (the walk collision looks 1.5u ahead)
  const clear = (a, b) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, n = Math.ceil(d / 2), px = -(b.y - a.y) / d * 2.2, py = (b.x - a.x) / d * 2.2;
    for (let k = 1; k < n; k++) {
      const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
      if (!passable(x, y) || !passable(x + px, y + py) || !passable(x - px, y - py) || (avoidWater && waterLevelAt(x, y))) return false;
    }
    return true;
  };
  const out = []; let a = { x: x0, y: y0 };
  for (let k = 1; k < pts.length; k++) if (!clear(a, pts[k])) { out.push(pts[k - 1]); a = pts[k - 1]; }
  out.push({ x: x1, y: y1 });
  return out;
}

function tryClimb(dx, dy) {
  const d = Math.hypot(dx, dy) || 1;
  let r = null;
  try { r = T.climbRoute?.(P.x, P.y, dx / d, dy / d) ?? null; } catch { r = null; }
  if (!r) r = scanRoute(P.x, P.y, dx / d, dy / d);
  if (!r) return false;
  setRoute(r);
  return true;
}

// Fallback until terrain.climbRoute exists: walk the ray, find the rock band and the first
// walkable ground beyond it.
function scanRoute(px, py, dx, dy) {
  let rockAt = -1;
  for (let t = 1; t <= 34; t += 1) if (!walkable(px + dx * t, py + dy * t)) { rockAt = t; break; }
  if (rockAt < 0) return null;
  for (let t = rockAt + 1; t <= rockAt + 170; t += 1) {
    if (walkable(px + dx * t, py + dy * t) && walkable(px + dx * (t + 3), py + dy * (t + 3))) {
      if (t - rockAt < 6) return null;
      const start = { x: px + dx * (rockAt - 1.5), y: py + dy * (rockAt - 1.5) };
      const end = { x: px + dx * (t + 3), y: py + dy * (t + 3) };
      let up = dy < 0;
      try { if (T.elevatedAt) up = !!T.elevatedAt(end.x, end.y) || (!T.elevatedAt(start.x, start.y) && dy < 0); } catch { /* keep */ }
      return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y), kind: 'cliff', up };
    }
  }
  return null;
}

// --- climbing: the cycle ------------------------------------------------------------------------------
// One tap = two half-cycles: right axe, left kick, pull; left axe, right kick, pull. In a half
// led by side s, axe s swings from low by the hip to full stretch overhead and strikes, the
// opposite boot kicks in high, then the climber stands up on the frog-splayed legs. The other
// axe stays planted out by the shoulder, so the hands are never both at the hood.
const CY = 0.85, H = 2.5, HAND_TOP = 17.3, HAND_LOW = 9.5, FOOT_LO = 1.9, SHOULDER_Z = 10.7;
const HAND_SINK = 1.3;      // the high axe sinks this far on the pull: hanging, one arm stays up straight
const HF = 1.8;             // boots step 2*HF and drop HF per pull (less than the hands: keeps the knees bent)
const PH = { swing: [0.0, 0.34], kick: [0.4, 0.58], pull: [0.64, 0.94] };
const ROUTE_K = 1.3;        // route distance per half-cycle, relative to the body rise

const climbWindy = () => envW.ws + envW.gust > 0.8;

function beginClimb() {
  // no axes and crampons (or a gale): reach for the wall, look up, shake the head, back off
  if (climbWindy() || !hasClimbGear()) { startRefuse(!hasClimbGear() ? 'gear' : 'wind'); return; }
  // too badly hurt to climb: a look up the wall, then a hand to the bad thigh
  // (climbing down is allowed, slowly: a hurt explorer mustn't be stranded on a plateau)
  if (injury() > HURT_CLIMB && route.up) { startRefuse('hurt'); return; }
  // parched dry (thirst): the head swims at the thought of it
  if (bodyWater() <= 0.005 && route.up) { startRefuse('parched'); return; }
  // too worn out to start up a wall: look up at it, then hang the head
  // (not enough left for this wall: ~one axe strike per D of route, body.climbHalf each)
  const b = route.bottom, t = route.top;
  const L = Math.max(6, Math.hypot(t.x - b.x, t.y - b.y));
  const D = (H * ROUTE_K) / clamp(-(t.y - b.y) / L, 0.35, 1);
  // plus hanging between moves when tired (body.hang / s, up to 1.5 s a move): with a margin,
  // so a climb they're allowed to start is one they can finish (falls get lethal in slice 5)
  // (one axe strike per D of route, until the lip is in reach ~17 above the boots and the
  // top-out takes over: lipAbove; tiredness taken as it will be about two-thirds of the way up)
  const moves = Math.max(1, (L - 17) / D), strikes = moves * (state.body?.climbHalf ?? 0);
  const tkUp = Math.pow(smooth(0.5, 0, energy() - 0.65 * strikes), 1.15);
  const cost = strikes + (state.body?.hang ?? 0) * moves * 1.5 * Math.pow(tkUp, 1.2);
  climbCostEst = cost;
  // (capped so the very biggest walls stay possible fresh and fully rested)
  if (energy() < 0.2 || energy() < Math.min(cost * 1.15, 0.98)) { startRefuse('tired'); return; }
  const sMax = Math.max(0, L - 3);
  climb = {
    // L0 / H0: the route's length and height as it started (lipAbove trims L): the drop if they
    // come off is the height climbed, (s / L0) x H0
    L0: L, H0: route.height > 0 ? route.height : L * Math.abs((t.y - b.y) / L), fallH: 0,
    L, D, sMax, dir: { x: (t.x - b.x) / L, y: (t.y - b.y) / L },
    face: Math.atan2((t.y - b.y) / KY, t.x - b.x),
    up: route.up, stage: route.up ? 'cycle' : 'lower', t: route.up ? 0 : 1, pc: 0,
    base: route.up ? 0 : sMax, s: route.up ? 0 : L, run: 0, dirn: 1, queued: 0,
    slipT: 0, slipFoot: 1, side: 1, from: null, windT: 0, vs: 0, lock: route.up ? 1 : -1,
    restT: 0, spentT: 0,
  };
  P.mode = 'climb'; P.climbStage = climb.stage; P.climbHold = false;
  P.vx = P.vy = 0;
  climb.from = cyclePose(0, 1);
  ovr = climbPose();
}

function climbRequest(dir) {
  const c = climb;
  if (!c) return;
  if (c.peelT > 0) { replant(); return; }            // peeling off: the tap drives the axes back in
  if (c.stage !== 'cycle' || c.run > 0 || c.restT > 0) { if (c.stage !== 'torn' && c.stage !== 'off') c.queued = dir; return; }
  startRun(dir);
}
function startRun(dir) {
  const c = climb;
  c.queued = 0;
  if (dir > 0) { c.dirn = 1; c.run = 2; c.pc = 0; return; }
  if (c.base < c.D * 0.6) { stepOff(); return; }
  c.dirn = -1; c.run = 2;
  beginDownHalf();
}
function beginDownHalf() {
  const c = climb;
  c.side = -c.side; c.base = Math.max(0, c.base - c.D); c.pc = 0.999;
}
function stepOff() {
  const c = climb;
  c.from = cyclePose(clamp(c.pc), c.side); c.stage = 'off'; c.t = 0; c.run = 0;
}

const segs = (pts, t) => {               // piecewise smooth path through points, t in 0..1
  const n = pts.length - 1, f = clamp(t) * n, i = Math.min(n - 1, Math.floor(f));
  return mix(pts[i], pts[i + 1], smooth(0, 1, f - i));
};

function cyclePose(pc, side) {
  const c = climb;
  const u = smooth(PH.pull[0], PH.pull[1], pc);          // stand-up progress
  const sw = smooth(PH.swing[0], PH.swing[1], pc);
  const hands = [], feet = [];
  for (const s of [-1, 1]) {
    const top = [1.3, s * 1.45, HAND_TOP], low = [0.9, s * 2.7, HAND_LOW];
    let h;
    if (s === side) {
      const [a, b] = PH.swing;
      if (pc < a) h = low;
      else if (pc < b) h = segs([low, [0.2, s * 3.3, HAND_TOP - 2.6], [-0.5, s * 2.2, HAND_TOP + 0.9], top], (pc - a) / (b - a));
      else h = top;
      if (pc >= PH.pull[0]) h = [top[0], top[1], HAND_TOP - HAND_SINK * u];
    } else {
      // planted, settling out by the shoulder as the other arm reaches; low by the hip after the pull
      const p0 = [top[0], top[1], HAND_TOP - HAND_SINK];
      const p1 = [0.95, s * 2.6, SHOULDER_Z];
      h = mix(mix(p0, p1, sw), low, u);
    }
    hands.push(h);
    // feet: only the boot opposite the swinging axe kicks, stepping up 2H; both drop H on the pull
    let f;
    if (s === -side) {
      const [a, b] = PH.kick;
      const lo = [0.75, s * 1.25, FOOT_LO], hi = [0.85, s * 1.2, FOOT_LO + 2 * HF];
      if (pc < a) f = lo;
      else if (pc < b) {
        const k = (pc - a) / (b - a);
        // the knee lifts, the boot comes off the wall to ~0.8u past the hold, then drives in (last ~0.07 s)
        const over = [-0.6, s * 1.5, FOOT_LO + 2 * HF + 0.8];
        f = k < 0.55 ? segs([lo, [-0.5, s * 1.6, FOOT_LO + HF], over], k / 0.55) : mix(over, hi, smooth(0, 1, (k - 0.55) / 0.45));
      } else f = hi;
      if (pc >= PH.pull[0]) f = [hi[0], hi[1], FOOT_LO + 2 * HF - HF * u];
    } else f = [0.8, s * 1.22, FOOT_LO + HF - HF * u];
    if (c && c.slipT > 0 && s === c.slipFoot) { const k = Math.sin(clamp(c.slipT / 0.5) * Math.PI); f = [f[0] - 0.4 * k, f[1] + s * 0.4 * k, f[2] - 1.2 * k]; }
    feet.push(f);
  }
  return { hands, feet, u };
}

const CLIMB_POLE_L = [[0.25, -1.1, 0.15], [0.25, 1.1, 0.15]];    // knees out: frog stance
const CLIMB_POLE_A = [[-0.2, -0.7, -1], [-0.2, 0.7, -1]];
function climbPose() {
  const c = climb, t = state.time, wp = envW.windPose;
  const sway = Math.sin(t * 1.7) * 0.07 * wp + Math.sin(t * 3.9) * 0.03 * wp + envW.gust * 0.12;
  const slip = c.slipT > 0 ? Math.sin(clamp(c.slipT / 0.5) * Math.PI) : 0;
  if (c.stage === 'cycle') {
    const pc = clamp(c.pc), cp = cyclePose(pc, c.side), e = Math.sin(Math.PI * cp.u);
    const reachK = smooth(0.1, PH.swing[1], pc) * (1 - cp.u);
    // hanging between taps: heavy breathing, a slow sway, axes planted
    const hold = c.run === 0 ? 1 : 0;
    const br = hold * lerp(Math.sin(t * Math.PI * 2 / 1.5), -Math.cos(pantPh * Math.PI * 2), smooth(0.15, 0.5, pant)) * (1 + 1.5 * pant);
    // worn out, the arms shake (hard once there's nothing left)
    // peeling in a gust: swung out from the wall, the arms shaking hard, hanging on
    const pk = c.peelT > 0 ? smooth(0, 0.25, 1 - c.peelT / PEEL_S) : 0;
    const look = c.lookT > 0 ? Math.sin(clamp(1 - c.lookT / LOOK_S) * Math.PI) : 0;
    const tr = Math.max((0.35 * tiredK() + 0.65 * smooth(0, 1, c.spentT)) * (0.4 + 0.6 * hold), 1.6 * pk);
    const shake = (v, k) => tr > 0.01 ? [v[0] + Math.sin(t * 41 + k) * 0.12 * tr, v[1] + Math.sin(t * 47 + k * 2) * 0.18 * tr, v[2] + Math.sin(t * 37 + k * 3) * 0.2 * tr] : v;
    return {
      hz: 7.6 - 0.3 * e - slip * 0.5 + br * 0.16 + Math.sin(t * 43) * 0.08 * tr - 0.5 * pk, leanF: 0.12 + 0.12 * e - br * 0.03 - 0.3 * pk + 0.1 * look,
      leanS: sway + slip * c.slipFoot * 0.12 + c.side * 0.06 * reachK + hold * Math.sin(t * 1.05) * 0.05 + Math.sin(t * 39) * 0.03 * tr + 0.25 * pk * Math.sin(t * 7),
      feet: cp.feet, hands: [shake(cp.hands[0], 0), shake(cp.hands[1], 1.7)],
      poleA: CLIMB_POLE_A, poleL: CLIMB_POLE_L,
      hemAttach: 0, facePitch: -0.3 + hold * 0.15 + 1.3 * look, faceYaw: 1.0 * look, full: true, axes: 1,
      shrug: [c.side < 0 ? reachK : 0, c.side > 0 ? reachK : 0],
    };
  }
  if (c.stage === 'torn') {
    // grip lost: axes scrape down the ice, then a backward fall down the face, arms flung up
    const f = c.from, k = smooth(0, 0.35, c.t), fl = Math.sin(t * 17) * 0.6 * k;
    return {
      hz: 7.6 + 0.4 * k, leanF: lerp(0.12, -0.35, k), leanS: Math.sin(t * 7) * 0.1 * k,
      feet: [mix(f.feet[0], [1.4, -1.6, 3.2], k), mix(f.feet[1], [1.0, 1.7, 1.6], k)],
      hands: [mix([f.hands[0][0], f.hands[0][1], f.hands[0][2] - 1.5 * clamp(c.t / 0.35)], [0.4, -3.4 + fl, 15.6], k),
        mix([f.hands[1][0], f.hands[1][1], f.hands[1][2] - 1.5 * clamp(c.t / 0.35)], [0.4, 3.4 - fl, 15.2], k)],
      poleA: [[-0.5, -1, 0], [-0.5, 1, 0]], poleL: CLIMB_POLE_L,
      hemAttach: 0, facePitch: -0.5, full: true, axes: 1,
    };
  }
  if (c.stage === 'off') {
    const m = clamp(c.t), f = c.from || cyclePose(0, 1);
    return {
      hz: lerp(7.6, 7.9, m), leanF: lerp(0.12, 0.05, m), leanS: 0,
      feet: [mix(f.feet[0], [0, -1, 0], m), mix(f.feet[1], [0, 1, 0], m)],
      hands: [mix(f.hands[0], [0.3, -1.9, 8.2], m), mix(f.hands[1], [0.3, 1.9, 8.2], m)],
      poleA: CLIMB_POLE_A, poleL: [mix(CLIMB_POLE_L[0], [1, -0.15, 0.1], m), mix(CLIMB_POLE_L[1], [1, 0.15, 0.1], m)],
      hemAttach: 0, facePitch: 0.1, full: m < 0.7, axes: 1 - m,
    };
  }
  // Top-out over the lip (t: 0 -> 1); 'lower' plays it backwards.
  // hands slap down over the lip, a knee comes up onto it, roll forward onto the top, stand.
  const m = clamp(c.t), f = c.from || cyclePose(0, 1);
  const K = [
    { t: 0, hz: 7.6, lf: 0.15, fL: f.feet[0], fR: f.feet[1], hL: f.hands[0], hR: f.hands[1], pl: 0 },
    { t: 0.22, hz: 7.4, lf: 0.35, fL: [0.75, -1.25, 2.4], fR: [0.75, 1.25, 2.0], hL: [2.4, -2.7, 10.6], hR: [2.4, 2.7, 10.6], pl: 0 },
    { t: 0.45, hz: 8.6, lf: 0.55, fL: [0.6, -1.2, 1.2], fR: [2.2, 1.1, 6.4], hL: [2.8, -2.6, 8.6], hR: [2.8, 2.6, 8.6], pl: 0.3 },
    { t: 0.7, hz: 6.6, lf: 0.62, fL: [-1.6, -1.0, 1.0], fR: [1.6, 1.0, 1.2], hL: [3.4, -1.7, 3.0], hR: [3.3, 1.7, 3.0], pl: 0.8 },
    { t: 0.88, hz: 6.6, lf: 0.35, fL: [-0.8, -1.0, 0.2], fR: [1.2, 1.0, 0], hL: [1.8, -1.6, 4.8], hR: [1.6, 1.9, 5.6], pl: 1 },
    { t: 1, hz: 7.9, lf: 0.05, fL: [0, -1.0, 0], fR: [0, 1.0, 0], hL: [0.3, -1.9, 8.2], hR: [0.3, 1.9, 8.2], pl: 1 },
  ];
  let i = 0; while (i < K.length - 2 && m > K[i + 1].t) i++;
  const A = K[i], B = K[i + 1], k = smooth(0, 1, (m - A.t) / (B.t - A.t)), pl = lerp(A.pl, B.pl, k);
  return {
    hz: lerp(A.hz, B.hz, k), leanF: lerp(A.lf, B.lf, k), leanS: sway * (1 - m),
    feet: [mix(A.fL, B.fL, k), mix(A.fR, B.fR, k)], hands: [mix(A.hL, B.hL, k), mix(A.hR, B.hR, k)],
    poleA: CLIMB_POLE_A, poleL: [mix(CLIMB_POLE_L[0], [1, -0.3, 0.1], pl), mix(CLIMB_POLE_L[1], [1, 0.3, 0.1], pl)],
    hemAttach: 0, facePitch: lerp(-0.2, 0.3, m), full: m < 0.9, axes: clamp(1 - (m - 0.25) * 3),
  };
}

function climbEvent(type, i) {
  const o = ovr || climbPose();
  const v = type === 'kick' ? o.feet[i] : o.hands[i];
  const w = toWorld(v, P.facing);
  const x = P.x + w.x, y = P.y + w.y - w.z; // the strike point as it appears on the painted face
  if (type === 'axe') state.events.push({ type: 'axe', x, y, hand: i ? 'R' : 'L' });
  else if (type === 'kick') state.events.push({ type: 'kick', x, y, foot: i ? 'R' : 'L' });
  const n = type === 'kick' ? 4 : 6;
  const z0 = w.z + (type === 'kick' ? 0 : 1.8);
  for (let k = 0; k < n; k++) {
    chips.push({ x: P.x + w.x + (rand() - 0.5) * 0.8, y: P.y + w.y + 0.3, z: z0, vx: (rand() - 0.5) * 5, vy: (rand() * 0.6 + 0.3) * 3 * KY, vz: 1 + rand() * 3, age: 0, life: 0.7 + rand() * 0.5, r: 0.12 + rand() * 0.16 });
  }
  if (chips.length > 60) chips.splice(0, chips.length - 60);
}

// The visible top lip: is the painted ground just above the climber's hands walkable snow?
// If so, the last cycle flows straight into the top-out there.
function lipAbove() {
  const c = climb;
  if (!walkable(P.x, P.y - 17) || !walkable(P.x, P.y - 19)) return false;
  for (let t = 10; t <= 34; t++) {
    const x = P.x + c.dir.x * t, y = P.y + c.dir.y * t;
    if (walkable(x, y) && walkable(x + c.dir.x * 3, y + c.dir.y * 3)) {
      route.top = { x: x + c.dir.x * 2, y: y + c.dir.y * 2 };
      c.sMax = c.s; c.L = c.s + t + 2;
      return true;
    }
  }
  return false;
}

function tearOff() {
  const c = climb;
  if (!c || c.stage === 'torn' || c.stage === 'off') return false;
  const o = ovr || climbPose();
  c.from = { hands: o.hands.map(h => h.slice()), feet: o.feet.map(f => f.slice()) };
  c.stage = 'torn'; c.t = 0; c.vs = 0; c.run = 0; c.queued = 0;
  c.fallH = clamp(c.s / c.L0) * c.H0;                 // how far they'll drop
  state.events.push({ type: 'scrape', x: P.x, y: P.y - 15 });
  climbEvent('scrape', 0); climbEvent('scrape', 1);
  return true;
}

// A gust starts to tear them off: PEEL_S to tap (and re-plant), or the grip goes.
function startPeel() {
  const c = climb;
  if (!c || c.stage !== 'cycle' || c.peelT > 0) return false;
  c.peelT = PEEL_S;
  state.events.push({ type: 'peel', x: P.x, y: P.y - 12 });
  return true;
}
function replant() {
  const c = climb;
  c.peelT = 0; c.windT *= 0.3;
  climbEvent('axe', 0); climbEvent('axe', 1);           // both axes driven back in (body.js: two strikes' energy)
  state.events.push({ type: 'replant', x: P.x, y: P.y - 12 });
}

function updateClimb(dt) {
  const c = climb;
  ovrW = approach(ovrW, 1, 7, dt);
  P.facing = wrapPi(P.facing + clamp(wrapPi(c.face - P.facing), -8 * dt, 8 * dt));
  if (c.slipT > 0) c.slipT -= dt;
  const tk = tiredK();
  const slow = (1 - 0.3 * envW.windPose) * (1 - 0.4 * tk) * (1 - 0.35 * clamp(injury())) * (1 - 0.3 * smooth(0.1, 0, bodyWater()));   // worn out (or hurt, or parched): every move slower
  // nothing left: the arms shake, then the grip goes (~1 s) and they fall
  c.spentT = c.stage === 'cycle' && energy() <= 0.001 ? c.spentT + dt : 0;
  if (c.spentT > 1.0 && tearOff()) fallSpent = true;   // (and they stay down, spent, where they land)
  // strong wind on the wall: the longer they hang in it, the likelier a gust tears them off
  const w = envW.ws + envW.gust;
  c.windT = w > 0.7 ? c.windT + dt : Math.max(0, c.windT - dt * 0.5);
  if (c.stage === 'cycle' && !(c.peelT > 0) && w > 0.7 && rand() < (w - 0.7) * (0.25 + 0.2 * c.windT) * (envW.gust > 0.35 ? 1 : 0.3) * dt) startPeel();
  // peeling: no tap in time and the grip goes
  if (c.peelT > 0) { c.peelT -= dt; if (c.peelT <= 0) { c.peelT = 0; tearOff(); } }
  // the first time this climb takes them past the height that kills: a beat to look down
  if (c.stage === 'cycle' && c.up && !c.lookedDown && clamp(c.s / c.L0) * c.H0 >= FATAL_H) {
    c.lookedDown = true; c.lookT = LOOK_S; c.restT = Math.max(c.restT, LOOK_S);
    state.events.push({ type: 'vertigo', x: P.x, y: P.y });
  }
  if (c.lookT > 0) c.lookT = Math.max(0, c.lookT - dt);
  if (c.stage === 'cycle') {
    if (c.run > 0 && !(c.peelT > 0)) {
      const dirn = c.dirn, prev = c.pc;
      c.pc += dirn * dt * slow / CY;
      const cross = x => (dirn > 0 ? prev < x && c.pc >= x : prev > x && c.pc <= x);
      const lead = c.side > 0 ? 1 : 0, other = 1 - lead;
      if (cross(PH.swing[1])) climbEvent('axe', lead);
      if (cross(PH.kick[1])) {
        climbEvent('kick', other);
        // a crampon skids off the ice: kick again (more likely in wind)
        if (dirn > 0 && rand() < 0.05 + 0.25 * envW.windPose) { c.slipT = 0.5; c.slipFoot = -c.side; c.pc = PH.kick[0] + 0.001; }
      }
      if (dirn > 0 && c.pc >= 1) {
        c.pc = 0; c.base += c.D; c.side = -c.side; c.run--;
        if (c.run === 0) c.restT = 1.5 * Math.pow(tk, 1.2);   // worn out: hang there a while between moves
        c.s = c.base;
        if (c.base >= c.sMax || lipAbove()) { c.from = cyclePose(0, c.side); c.stage = 'mantle'; c.t = 0; c.base = c.sMax; c.run = 0; }
      }
      if (dirn < 0 && c.pc <= 0) {
        c.pc = 0; c.run--;
        if (c.run > 0) { if (c.base < c.D * 0.6) stepOff(); else beginDownHalf(); }
      }
      if (c.stage === 'cycle' && c.run === 0 && c.queued && c.restT <= 0) startRun(c.queued);
    } else if (c.restT > 0) {
      c.restT -= dt;
      if (c.restT <= 0 && c.queued) startRun(c.queued);
    }
    if (c.stage === 'cycle') c.s = clamp(c.base + c.D * smooth(PH.pull[0], PH.pull[1], clamp(c.pc)), 0, c.L);
  } else if (c.stage === 'mantle' || c.stage === 'lower') {
    const dirn = c.stage === 'mantle' ? 1 : -1;
    c.t += dirn * dt / 2.8;
    c.s = lerp(c.sMax, c.L, smooth(0.3, 0.85, clamp(c.t)));
    if (dirn > 0 && c.t >= 1) { endClimb(); return; }
    if (dirn < 0 && c.t <= 0) {
      c.stage = 'cycle'; c.pc = 0; c.t = 0; c.run = 0; c.base = c.sMax;
      if (c.queued) startRun(c.queued);
    }
  } else if (c.stage === 'off') {
    c.t += dt / 0.6; c.s = Math.max(0, c.s - dt * 8);
    if (c.t >= 1) { endClimb(); return; }
  } else if (c.stage === 'torn') {
    c.t += dt;
    if (c.t > 0.35) { c.vs += 75 * dt; c.s -= c.vs * dt; }
    if (c.s <= 0) {
      c.s = 0;
      const away = c.face + Math.PI, h = c.fallH;
      endClimb();
      startFall(1, away, h);
      return;
    }
  }
  P.x = route.bottom.x + c.dir.x * c.s;
  P.y = route.bottom.y + c.dir.y * c.s;
  P.climbStage = c.stage;
  P.climbHold = c.stage === 'cycle' && c.run === 0;
  ovr = climbPose();
}
function endClimb() {
  P.mode = 'walk'; P.climbStage = null; P.climbHold = false;
  const end = climb.stage === 'mantle' ? route.top : route.bottom;
  P.x = end.x; P.y = end.y;
  climb = null; route = null;
}

// --- refusing a climb in a gale: reach for the wall, look up into the wind, back off -----------------
let refT = 0, refFace = 0, refWhy = 'wind', climbCostEst = 0;
function startRefuse(reason = 'wind') {
  P.mode = 'refuse'; refT = 0; refWhy = reason;
  refFace = Math.atan2((route.top.y - route.bottom.y) / KY, route.top.x - route.bottom.x);
  route = null;
  state.events.push({ type: 'refuse', x: P.x, y: P.y, reason });
}
function updateRefuse(dt) {
  refT += dt;
  ovrW = approach(ovrW, refT < 2.4 ? 1 : 0, 8, dt);
  // face the wall and reach; then turn half away from it, shaking the head, and trudge off
  const turn = smooth(0.95, 1.5, refT);
  const want = refFace + (Math.cos(refFace) >= 0 ? 1 : -1) * Math.PI * 0.8 * turn;
  P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -6 * dt, 6 * dt));
  // worn out ('tired'): no reach and no head shake; a long look up the wall, then the head
  // drops and the shoulders sag, and they turn away from it
  // hurt ('hurt'): the same long look up, then a hand goes to the bad thigh and they bend over it
  // parched ('parched'): the long look up, then a mitt to the temple, the head tipped into it
  const hurtR = refWhy === 'hurt', parchR = refWhy === 'parched', tired = refWhy === 'tired' || hurtR || parchR;
  const reach = smooth(0.1, 0.5, refT) * (1 - smooth(0.85, 1.2, refT)) * (tired ? 0.25 : 1);
  const shake = !tired && refT > 1.1 && refT < 1.9 ? Math.sin((refT - 1.1) * 16) * 0.55 * Math.sin(clamp((refT - 1.1) / 0.8) * Math.PI) : 0;
  const sag = tired ? smooth(0.95, 1.35, refT) * (1 - smooth(2.2, 2.6, refT)) : 0;
  const clutch = hurtR ? sag : 0;
  const walkK = smooth(1.5, 1.7, refT) * (1 - smooth(2.4, 2.6, refT));
  if (walkK > 0) {
    const st = 4.5 * walkK * dt, nx = P.x - Math.cos(refFace) * st, ny = P.y - Math.sin(refFace) * st * KY;
    if (passable(nx, ny) && dryOk(nx, ny)) { P.x = nx; P.y = ny; }
  }
  const ph = Math.sin(refT * Math.PI * 2 * 1.6) * walkK;
  ovr = {
    hz: 7.9 - 0.3 * reach - 0.15 * Math.abs(ph) - 0.5 * sag, leanF: 0.05 + 0.12 * reach + 0.12 * walkK + 0.3 * sag, leanS: envW.gust * 0.1,
    feet: [[0.3 * reach + 1.1 * ph, -1, Math.max(0, ph) * 0.6], [0.5 * reach - 1.1 * ph, 1, Math.max(0, -ph) * 0.6]],
    hands: [mix([0.3, -1.9, 8.2], [1.2, -2.2, 10.6], reach * 0.5), mix([0.3, 1.9, 8.2], [2.0, 2.5, 15.2], reach)].map((h, i) => ((i ? 1 : -1) === badS && clutch > 0 ? mix(h, [1.0, badS * 1.0, 5.6], clutch) : i && parchR && sag > 0 ? mix(h, [1.0, 1.75, 14.4], sag) : h)),
    poleA: [[-0.5, -1, -0.5], [-0.5, 1, -0.5]], poleL: [[1, -0.15, 0.1], [1, 0.15, 0.1]],
    hemAttach: 0, facePitch: lerp(0.15, -0.5, smooth(0.2, 0.6, refT) * (1 - smooth(1.0, 1.4, refT))) + 0.2 * smooth(1.6, 2.0, refT) + 0.85 * sag, faceYaw: shake,
    full: reach > 0.2, axes: 0,
  };
  P.vx = P.vy = 0;
  if (refT >= 2.7) P.mode = 'walk';
}

// --- wind: shoves and knockdowns ----------------------------------------------------------------------
function startShove(strength) {
  if (P.mode === 'climb' || P.mode === 'down') return;
  shoveT = 1.0; shoveV = 9 + 6 * strength;
  slipT = 0.9; slipSide = rand() < 0.5 ? -1 : 1;
  staggerT = 0.6; staggerSide = slipSide;
  state.events.push({ type: 'shove', strength });
}
// drop: world px fallen off a wall (0: knocked down where they stood)
function startFall(strength, dir, drop = 0) {
  if (P.mode === 'climb' || P.mode === 'down') return;
  P.mode = 'down'; downT = 0; route = null; downSlow = 1;
  downDir = dir ?? envW.wa;
  const v = 9 + 7 * strength;
  downV = { x: Math.cos(downDir) * v, y: Math.sin(downDir) * v * KY };
  state.events.push({ type: 'fall', strength, drop, fatal: drop >= FATAL_H });
  if (drop > 0) land(drop);
  // thrown down on hard ice or rock: a knock (a little hurt, now and then more)
  else if (P.terrain === 'ice' || P.terrain === 'thin' || P.terrain === 'rock') {
    hurt(0.03 + rand() * 0.05, 'knock');
    if (P.terrain === 'thin') ICE.slam(P.x, P.y, 0.12);   // thrown down on thin ice: a jolt to it
  }
}
// Landing at the foot of a wall after a drop of h world px: a burst of snow, and by the height
// nothing much, a hurt leg (slower to get up), or the end (crumpled where they land).
function land(h) {
  const lv = waterLevelAt(P.x, P.y);
  if (lv) { splashDrops(P.x, P.y, 12, 0.5, 5); ring(P.x, P.y, 2, 10, 1.6); }
  else snowBurst(P.x, P.y, 5 + Math.min(9, h * 0.15));
  // onto thin ice: the impact loads it, and a big drop goes straight through
  if (!lv && T.terrainAt(P.x, P.y) === 'thin') ICE.slam(P.x, P.y, h / 40);
  if (h >= FATAL_H) {
    state.events.push({ type: 'impact', x: P.x, y: P.y, height: h, severity: 1, fatal: true });
    // into deep water: they go under (no body); else crumpled where they land
    if (lv === 2) { climb = null; route = null; P.mode = 'sink'; sinkT = 0; P.vx = P.vy = 0; }
    else startCrumple();
    return;
  }
  if (lv === 2) { P.mode = 'swim'; P.vx = P.vy = 0; }   // into deep water: they come up swimming
  if (h < SMALL_H) return;
  const inj = h <= BAD_H ? lerp(0.2, 0.7, (h - SMALL_H) / (BAD_H - SMALL_H)) : lerp(0.7, 0.85, (h - BAD_H) / (FATAL_H - BAD_H));
  state.events.push({ type: 'impact', x: P.x, y: P.y, height: h, severity: inj, fatal: false });
  hurt(inj, 'fall', true);                            // (the impact already flinches)
  downSlow = 1 + 1.3 * inj;                            // longer down, slower up
}
// snow thrown up all round by a body hitting it
function snowBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    // (kept low and close: about the figure's own width, never a cloud that hides it)
    const a = rand() * Math.PI * 2, sp = 1 + rand() * 3;
    kicks.push({ x: x + Math.cos(a) * 1.5, y: y + Math.sin(a) * 1.2, z: 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * KY, vz: 1.5 + rand() * 3, life: 0.4 + rand() * 0.3, age: 0, r: 0.14 + rand() * 0.14 });
  }
  if (kicks.length > 60) kicks.splice(0, kicks.length - 60);
}
const DOWN_K = [
  { t: 0, hz: 7.9, lf: 0.05, fL: [0, -1, 0], fR: [0, 1, 0], hL: [0.3, -1.9, 8.2], hR: [0.3, 1.9, 8.2], hem: 0 },
  { t: 0.4, hz: 1.25, lf: 1.42, fL: [-6.4, -1.3, 0.35], fR: [-6.2, 1.1, 0.35], hL: [6.0, -2.6, 0.45], hR: [5.6, 2.8, 0.45], hem: 1 },
  { t: 1.4, hz: 1.2, lf: 1.44, fL: [-6.4, -1.3, 0.35], fR: [-6.3, 1.0, 0.35], hL: [5.8, -2.4, 0.45], hR: [5.5, 2.6, 0.45], hem: 1 },
  { t: 2.2, hz: 3.7, lf: 1.18, fL: [-3.5, -1.1, 0.4], fR: [-3.4, 1.1, 0.4], hL: [4.1, -1.5, 0.45], hR: [4.1, 1.5, 0.45], hem: 0.8 },
  { t: 2.8, hz: 4.6, lf: 0.35, fL: [-3.2, -1.0, 0.4], fR: [1.6, 1.0, 0], hL: [1.5, -0.6, 4.8], hR: [1.8, 0.9, 4.6], hem: 0.2 },
  { t: 3.4, hz: 7.9, lf: 0.05, fL: [0, -1, 0], fR: [0, 1, 0], hL: [0.3, -1.9, 8.2], hR: [0.3, 1.9, 8.2], hem: 0 },
];
function updateDown(dt) {
  if (water.level === 2) { P.mode = 'swim'; P.vx = P.vy = 0; return; }   // (thrown into deep water: swimming)
  downT += dt / (downT > 0.4 ? downSlow : 1);         // hurt in the fall: they lie there longer
  ovrW = approach(ovrW, downT < 3.2 ? 1 : 0, 10, dt);
  // thrown: spin to face downwind (face-down, head downwind) and slide
  P.facing = wrapPi(P.facing + clamp(wrapPi(downDir - P.facing), -9 * dt, 9 * dt));
  const f = Math.exp(-(downT < 0.4 ? 1.5 : 5) * dt);
  downV.x *= f; downV.y *= f;
  const nx = P.x + downV.x * dt, ny = P.y + downV.y * dt;
  if (passable(nx, ny) && dryOk(nx, ny)) { P.x = nx; P.y = ny; } else { downV.x = downV.y = 0; }
  const struggle = downT > 1.4 && downT < 2.8 ? Math.sin(state.time * 9) * 0.12 : 0;
  let i = 0; while (i < DOWN_K.length - 2 && downT > DOWN_K[i + 1].t) i++;
  const A = DOWN_K[i], B = DOWN_K[i + 1], k = smooth(0, 1, clamp((downT - A.t) / (B.t - A.t)));
  ovr = {
    hz: lerp(A.hz, B.hz, k) + struggle * 0.5, leanF: lerp(A.lf, B.lf, k), leanS: struggle,
    feet: [mix(A.fL, B.fL, k), mix(A.fR, B.fR, k)], hands: [mix(A.hL, B.hL, k), mix(A.hR, B.hR, k)],
    poleA: [[0.2, -1, -0.8], [0.2, 1, -0.8]], poleL: [[1, -0.2, 0.1], [1, 0.2, 0.1]],
    hemAttach: lerp(A.hem, B.hem, k), facePitch: 0.4, full: true, axes: 0,
  };
  P.vx = downV.x; P.vy = downV.y;
  // fallen off a wall with nothing left: instead of getting up, they end up sat in the snow
  if (fallSpent && downT > 2.2) { fallSpent = false; spent = true; state.events.push({ type: 'tired', x: P.x, y: P.y }); }
  if (downT >= 3.4) { P.mode = 'walk'; P.vx = P.vy = 0; }
}

// --- cowering in a storm, hunkering in the lee of rock -----------------------------------------------
function updateCower(dt, active) {
  idleT = active ? 0 : idleT + dt;
  const wo = state.weather.whiteout ?? 0;
  const storm = wo > 0.45 || envW.wEff > 0.78;
  // the deep cold (warmth < 0.2) puts them on one knee instead, hugging themselves
  const kneel = ((warmth() < 0.2 && !active && idleT > 1.0) || faltT > 0) && !spent;
  kneelW = approach(kneelW, kneel ? 1 : 0, kneel ? 2.2 : 3, dt);
  // worn out: bent double for a few breaths; spent: down into the snow (slowly, heavily)
  // stood still worn out (< 0.3), they bend double of their own accord after a moment
  const volRest = !active && idleT > 1.5 && energy() < 0.3 && !water.level && !spent && cowerW < 0.3 && kneelW < 0.3 && P.mode === 'walk';
  const bend = restT > 0 || volRest;
  restW = approach(restW, bend ? 1 : 0, bend ? 4 : 2.5, dt);
  const sitting = spent && crawlW < 0.5;
  sitW = approach(sitW, sitting ? 1 : 0, sitting ? 1.8 : 3, dt);
  // sitting down they come round toward the camera a little (legs out toward the viewer:
  // it reads as sitting from anywhere)
  if (sitting && sitW < 0.9) {
    const want = Math.PI / 2 + clamp(wrapPi(P.facing - Math.PI / 2), -0.7, 0.7);
    P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -2.5 * dt, 2.5 * dt));
  }
  const want = !active && idleT > 0.8 && storm && P.mode !== 'approach' && shoveT <= 0 && !kneel && !water.level && !spent && restT <= 0 && !state.pup?.job;   // (not while pitching: kneeling at it)
  cowerW = approach(cowerW, want ? 1 : 0, want ? 1.4 : 4.5, dt);
  if (cowerW > 0.5 && P.mode === 'walk') P.mode = 'cower';
  if (cowerW < 0.3 && P.mode === 'cower') P.mode = 'walk';
  // hunker: rock close by and we're in its lee
  let hk = 0;
  if (want && envW.shelter > 0.4) {
    rockScanT -= dt;
    if (rockScanT <= 0) { rockScanT = 0.5; rockHit = findRock(9); }
    if (rockHit) hk = 1;
  }
  hunkerW = approach(hunkerW, hk, 2, dt);
  if (want) {
    let target = envW.wa; // back to the wind: face downwind
    if (rockHit && hk) {
      const ra = Math.atan2((rockHit.y - P.y) / KY, rockHit.x - P.x);
      const a1 = ra + Math.PI / 2, a2 = ra - Math.PI / 2;
      target = Math.cos(a1 - envW.wa) > Math.cos(a2 - envW.wa) ? a1 : a2;
      hunkerSide = Math.sin(ra - target) > 0 ? 1 : -1; // which shoulder is against the rock
      // shuffle in until the shoulder is against the rock
      const d = Math.hypot(rockHit.x - P.x, (rockHit.y - P.y) / KY);
      if (d > 2.8) { const st = Math.min(3 * dt, d - 2.8); P.x += Math.cos(ra) * st; P.y += Math.sin(ra) * st * KY; }
    }
    P.facing = wrapPi(P.facing + clamp(wrapPi(target - P.facing), -2.2 * dt, 2.2 * dt));
  }
  P.sheltered = Math.max(cowerW * clamp(0.2 + 0.8 * envW.shelter * (0.45 + 0.55 * hunkerW)), kneelW * 0.2);
}
function findRock(maxD) {
  let best = null;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a) * KY;
    for (let d = 1.5; d <= maxD; d += 1) {
      if (!walkable(P.x + c * d, P.y + s * d)) { if (!best || d < best.d) best = { x: P.x + c * d, y: P.y + s * d, d }; break; }
    }
  }
  return best;
}

// --- the deep cold: kneeling, faltering ------------------------------------------------------------
let kneelW = 0, faltT = 0;

// --- the tent: walk round to the door, crawl in and vanish; crawl out again ----------------------------
// Inside, the explorer is hidden and the camera rests on the glowing tent (body.js warms them
// fast). A tap leaves; a press held ~1 s sleeps till morning (pushes tent { action: 'sleep' };
// body.js runs the fade and the time skip). While a press is held, body.sleepHold rises 0..1
// and camp.js turns the lamp down with it.
const CRAWL_IN_S = 2.4, CRAWL_OUT_S = 2.3, HOLD_SLEEP_S = 1.0;
let tentT = 0, tentFade = 1, tentFrom = { x: 0, y: 0 }, pressT = -1, pressPtr = false, keyHeld = false;
let doorK = 0;   // 0 = clear of the door .. 1 = all the way in (drawn clipped by the gable)
// Which tent: base camp's, or the pup tent once it's pitched (puptent.js). The one being walked
// to, crawled into and slept in; player.shelter tells body.js and audio.js how good it is.
let shelter = 'camp';
function door(kind = shelter) { return (kind === 'pup' && pupDoor()) || tentDoor(); }
function setShelter(kind) { shelter = kind; P.shelter = kind === 'pup' ? PUP_SHELTER : CAMP_SHELTER; }
function goToTent(kind = 'camp') {
  if (kind === 'pup' && !pupDoor()) return;
  setShelter(kind);
  const d = door();
  const wet = crossesWater(P.x, P.y, d.fx, d.fy);   // water between: plan round it (else the shore stops them)
  const path = wet ? findPath(P.x, P.y, d.fx, d.fy, true, 7, 150) : [...d.around(P.x, P.y), { x: d.fx, y: d.fy }];
  let len = 0, a = P;
  for (const q of path) { len += Math.hypot(q.x - a.x, q.y - a.y); a = q; }
  // an 'approach' like a climb's, but it ends at the door (bottom is unused: no wall to step onto)
  route = { kind: 'tent', up: true, avoid: wet, walkTo: { x: d.fx, y: d.fy }, bottom: { x: -1e6, y: -1e6 }, top: { x: d.x, y: d.y }, path, limit: 10 + len / 2.5 };
  P.mode = 'approach'; approachT = 0;
}
// Walk to a point by ourselves (a press on the sled, a body or a pile from afar: ui/pack.js digs in
// it on arrival). Round water, and round the camp, like the tent route. Not spent, not mid-climb.
function goReach(x, y) {
  if ((P.mode !== 'walk' && P.mode !== 'cower') || spent || water.level) return false;
  const wet = crossesWater(P.x, P.y, x, y);
  const path = findPath(P.x, P.y, x, y, wet, wet ? 7 : 5, 150);
  let len = 0, a = P;
  for (const q of path) { len += Math.hypot(q.x - a.x, q.y - a.y); a = q; }
  route = { kind: 'reach', up: true, avoid: wet, walkTo: { x, y }, bottom: { x: -1e6, y: -1e6 }, top: { x, y }, path, limit: 8 + len / 2.5 };
  P.mode = 'approach'; approachT = 0;
  const inp = state.input;
  if (inp.tap) lastTapT = inp.tap.t;
  return true;
}
// Sleep only skips the rest of a night (the cycle's night, not a pinned clock). Same test as body.js.
function canSleep() { const L = state.lighting; return L.mode === 'cycle' && L.night > 0.5 && L.clock >= 180; }
function nearDoor(kind = 'camp', r = 12) {
  if (kind === 'pup' && !pupDoor()) return false;
  const d = door(kind); return Math.hypot(P.x - d.fx, P.y - d.fy) < r;
}
function beginTentIn() {
  if (shelter === 'pup' && !pupDoor()) { route = null; P.mode = 'walk'; return; }   // (struck meanwhile)
  tentCrawl = crawlW > 0.5;   // crawled here: stay down, straight on in
  route = null; P.mode = 'tent-in'; tentT = 0; tentFrom = { x: P.x, y: P.y };
  P.vx = P.vy = 0;
  if (state.compass && state.compass.phase !== 'idle') state.compass.phase = 'idle';
}
// On hands and knees (body frame, like DOWN_K). k blends from standing; ph drives the crawl.
const STAND_K = { hz: 7.9, lf: 0.05, fL: [0, -1, 0], fR: [0, 1, 0], hL: [0.3, -1.9, 8.2], hR: [0.3, 1.9, 8.2] };
const CRAWL_K = { hz: 3.7, lf: 1.2, fL: [-3.3, -1.0, 0.3], fR: [-3.3, 1.0, 0.3], hL: [4.3, -1.4, 0.55], hR: [4.3, 1.4, 0.55] };
function crawlPose(k, ph, moving) {
  const sw = Math.sin(ph) * moving, cw = Math.cos(ph) * moving;
  const kl = smooth(0, 0.65, k), kh = smooth(0.3, 1, k);       // knees go down first, then the hands
  const C = CRAWL_K;
  const fL = [C.fL[0] + 0.8 * sw, C.fL[1], C.fL[2] + 0.25 * Math.max(0, cw)], fR = [C.fR[0] - 0.8 * sw, C.fR[1], C.fR[2] + 0.25 * Math.max(0, -cw)];
  const hL = [C.hL[0] - 0.8 * sw, C.hL[1], C.hL[2] + 0.5 * Math.max(0, -cw)], hR = [C.hR[0] + 0.8 * sw, C.hR[1], C.hR[2] + 0.5 * Math.max(0, cw)];
  return {
    hz: lerp(STAND_K.hz, C.hz, kl) + 0.12 * Math.abs(sw), leanF: lerp(STAND_K.lf, C.lf, kh * 0.6 + kl * 0.4), leanS: 0.05 * sw * k,
    feet: [mix(STAND_K.fL, fL, kl), mix(STAND_K.fR, fR, kl)], hands: [mix(STAND_K.hL, hL, kh), mix(STAND_K.hR, hR, kh)],
    poleA: [[-0.6, -1, 0], [-0.6, 1, 0]], poleL: [[1, -0.2, 0.1], [1, 0.2, 0.1]],
    hemAttach: 0.75 * k, facePitch: lerp(0.2, 0.55, k), full: true, axes: 0,
  };
}
function updateTent(dt) {
  const d = door();
  tentT += dt;
  ovrW = approach(ovrW, 1, 8, dt);
  cowerW = approach(cowerW, 0, 5, dt); kneelW = approach(kneelW, 0, 5, dt);
  const inward = Math.atan2(-d.out.y / KY, -d.out.x);
  if (P.mode === 'tent-in') {
    P.facing = wrapPi(P.facing + clamp(wrapPi(inward - P.facing), -5 * dt, 5 * dt));
    const k = tentCrawl ? 1 : smooth(0.2, 0.95, tentT);   // down onto hands and knees
    const m = smooth(0.95, 2.25, tentT);          // and in through the door
    P.x = lerp(tentFrom.x, d.x, m); P.y = lerp(tentFrom.y, d.y, m);
    tentFade = 1;
    doorK = smooth(0.0, 1.0, m * 1.15);              // head and shoulders go in first
    ovr = crawlPose(k, tentT * 7, m > 0.02 && m < 0.98 ? 1 : 0);
    if (tentT >= CRAWL_IN_S) {
      P.mode = 'inside'; tentFade = 0; doorK = 0; puffs.length = 0; kicks.length = 0; pressT = -1;
      state.events.push({ type: 'tent', action: 'in', x: d.x, y: d.y, shelter });
    }
  } else {
    P.facing = wrapPi(inward + Math.PI);
    if (tentT < 0) { P.x = d.x; P.y = d.y; tentFade = 0; doorK = 0; P.vx = P.vy = 0; P.sheltered = 1; P.exposure = 0; return; }
    const m = smooth(0.05, 1.35, tentT);          // out through the door on hands and knees
    const k = 1 - smooth(1.35, 2.15, tentT);      // then up onto the feet
    P.x = lerp(d.x, d.fx, m); P.y = lerp(d.y, d.fy, m);
    tentFade = 1;
    doorK = m < 0.999 ? 1 - smooth(0, 1, m * 1.1) : 0;
    ovr = crawlPose(k, tentT * 7, m > 0.02 && m < 0.98 ? 1 : 0);
    if (tentT >= CRAWL_OUT_S) {
      P.mode = 'walk'; tentFade = 1; doorK = 0;
      state.events.push({ type: 'tent', action: 'out', x: P.x, y: P.y, shelter });
    }
  }
  P.vx = P.vy = 0; P.sheltered = 0.6;
}
function updateInside(dt) {
  const d = door(), B = state.body, inp = state.input;
  P.x = d.x; P.y = d.y; P.vx = P.vy = 0; P.speed = 0; P.moving = false;
  P.exposure = 0; P.sheltered = 1; tentFade = 0;
  if (B && B.phase === 'sleep') {
    // asleep: presses are ignored until morning
    pressT = -1; B.sleepHold = 0;
    if (inp.tap) lastTapT = inp.tap.t;
    if (inp.action) lastActT = inp.action;
    return;
  }
  // a fresh press: a quick tap leaves, holding it sleeps
  if (inp.tap && inp.tap.t !== lastTapT) { lastTapT = inp.tap.t; if (state.time - inp.tap.t < 1) { pressT = state.time; pressPtr = true; } inp.tap = null; }
  if (inp.action && inp.action !== lastActT) { lastActT = inp.action; pressT = state.time; pressPtr = false; inp.action = null; }
  let hold = 0;
  if (pressT >= 0) {
    const held = pressPtr ? !!inp.pointer : keyHeld, dur = state.time - pressT;
    const night = canSleep();
    // by day a long hold just turns the lamp down a moment and back (no sleeping till dark)
    hold = night ? smooth(0.2, HOLD_SLEEP_S, dur) : 0.5 * smooth(0.3, 0.8, dur) * (1 - smooth(1.1, 1.7, dur));
    if (!held) { pressT = -1; hold = 0; P.mode = 'tent-out'; tentT = 0; }   // let go before sleep: leave
    else if (night && dur >= HOLD_SLEEP_S) { pressT = -1; hold = 0; state.events.push({ type: 'tent', action: 'sleep', x: P.x, y: P.y, shelter }); }
  }
  if (B) B.sleepHold = hold;
}
// body.js hand-over: the next member starts inside the tent and crawls out; with nobody left
// the explorer is simply gone and the camera rests on the empty camp.
function respawn(gone) {
  setShelter('camp');
  const d = door();
  resetTo(d.x, d.y);
  // (the dead member's kit stays with the body: body.js empties the pack, items.js)
  puffs.length = 0; kicks.length = 0;
  P.facing = Math.atan2(d.out.y / KY, d.out.x);
  ovr = crawlPose(1, 0, 0); ovrW = 1;
  // wait inside (unseen) through the black and the start of the iris opening, then crawl out
  tentFade = 0; tentT = -1.5;
  P.mode = gone ? 'gone' : 'tent-out';
  doorK = 0;
  if (state.compass) state.compass.phase = 'idle';
}

// --- dying of cold: kneel, slump forward, lie still ----------------------------------------------------
let colT = 0, colTo = null, colFrom = null;
const COLLAPSE_K = [
  { t: 0, hz: 4.7, lf: 0.32, fL: [-2.7, -1.0, 0.25], fR: [1.3, 1.1, 0], hL: [1.9, 0.5, 6.3], hR: [1.9, -0.5, 6.6], hem: 0 },
  { t: 0.9, hz: 4.1, lf: 0.55, fL: [-3.0, -1.0, 0.3], fR: [-2.9, 1.0, 0.3], hL: [2.2, 0.4, 5.0], hR: [2.2, -0.4, 5.3], hem: 0.2 },
  { t: 1.7, hz: 2.6, lf: 1.05, fL: [-4.6, -1.1, 0.35], fR: [-4.4, 1.0, 0.35], hL: [4.2, -1.8, 0.6], hR: [4.0, 1.9, 0.6], hem: 0.7 },
  { t: 2.6, hz: 1.25, lf: 1.42, fL: [-6.3, -1.3, 0.35], fR: [-5.9, 0.9, 0.35], hL: [4.6, -1.3, 0.5], hR: [4.1, 1.7, 0.45], hem: 1 },
];
// A fatal fall: they hit the snow at the foot of the wall and lie as they landed, sprawled and
// twisted half onto a side: one leg flung out, the other knee bent up, an arm thrown out past the
// head and the other caught under them. (ls: sideways lean.)
const CRUMPLE_K = [
  { t: 0, hz: 5.2, lf: -0.25, ls: 0.1, fL: [1.0, -1.8, 2.4], fR: [0.4, 1.9, 1.2], hL: [0.4, -3.4, 12.0], hR: [0.4, 3.4, 11.6], hem: 0.2 },
  { t: 0.2, hz: 1.0, lf: 1.5, ls: 0.42, fL: [-5.6, -2.6, 0.3], fR: [-3.2, 2.3, 1.5], hL: [5.0, -3.9, 0.4], hR: [3.0, 3.4, 0.7], hem: 1 },
  { t: 0.42, hz: 1.55, lf: 1.36, ls: 0.3, fL: [-5.7, -2.7, 0.5], fR: [-3.0, 2.1, 1.8], hL: [4.8, -4.2, 0.6], hR: [2.2, 2.6, 0.6], hem: 1 },
  { t: 1.1, hz: 1.05, lf: 1.48, ls: 0.5, fL: [-6.0, -2.9, 0.3], fR: [-2.5, 2.0, 1.9], hL: [4.3, -4.7, 0.35], hR: [1.3, 1.2, 0.3], hem: 0.8 },
];
let colKind = 'cold';
function startCrumple() {
  climb = null; route = null; shoveT = 0; slipT = 0; staggerT = 0; faltT = 0; heave = null;
  // (laid out across the view, east or west: a body lying head-away from the camera foreshortens
  // into a short upright shape that doesn't read as down)
  P.facing = (Math.cos(P.facing) >= 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.5;
  hollowSeed = 1 + ((rand() * 1e6) | 0);
  P.mode = 'collapse'; colKind = 'fall'; colT = 0; colTo = null; P.climbStage = null; P.climbHold = false; P.vx = P.vy = 0;
  if (state.compass) state.compass.phase = 'idle';
}
function startCollapse() {
  // on the wall: the grip goes and they fall (the knockdown plays); collapse where they land
  if (P.mode === 'climb' && climb) { tearOff(); return; }
  // in the water: they slip under (no body is left)
  if (water.level === 2 || P.mode === 'swim') { P.mode = 'sink'; sinkT = 0; route = null; hesT = 0; heave = null; if (state.compass) state.compass.phase = 'idle'; return; }
  // in the shallows: they stagger the last step to the edge and fall face down there
  colTo = null;
  if (water.level === 1) {
    let best = null;
    for (let r = 1; r <= 14 && !best; r += 1) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r * KY;
      if (!waterLevelAt(x, y) && passable(x, y)) { best = { x, y }; break; }
    }
    if (best) { colTo = best; colFrom = { x: P.x, y: P.y }; P.facing = Math.atan2((best.y - P.y) / KY, best.x - P.x); }
  }
  const fromDown = P.mode === 'down';
  colKind = 'cold'; heave = null;
  // in a tent (or in its doorway): they die in there, unseen; the tent goes dark (body.js / fallen.js
  // leave the body inside, the boots showing at the door)
  if (P.mode === 'inside' || P.mode === 'tent-in' || P.mode === 'tent-out') {
    const d = door(); P.x = d.x; P.y = d.y;
    climb = null; route = null; heave = null; tentFade = 0; doorK = 0; P.vx = P.vy = 0;
    P.mode = 'dead'; P.deadInside = true; P.climbStage = null; P.climbHold = false;
    if (state.compass) state.compass.phase = 'idle';
    return;
  }
  climb = null; route = null; shoveT = 0; slipT = 0; staggerT = 0; faltT = 0; tentFade = 1; doorK = 0;
  P.mode = 'collapse'; colT = fromDown ? 1.7 : 0; P.climbStage = null; P.climbHold = false; P.vx = P.vy = 0;   // already on the ground: just stay down
  if (state.compass) state.compass.phase = 'idle';
}
function updateCollapse(dt) {
  colT += dt;
  if (colTo) { const k = smooth(0, 1.4, colT); P.x = lerp(colFrom.x, colTo.x, k); P.y = lerp(colFrom.y, colTo.y, k); if (colT > 1.4) colTo = null; }
  ovrW = approach(ovrW, 1, 5, dt);
  cowerW = approach(cowerW, 0, 4, dt); kneelW = approach(kneelW, 0, 4, dt);
  const K = colKind === 'fall' ? CRUMPLE_K : COLLAPSE_K, fall = colKind === 'fall';
  let i = 0; while (i < K.length - 2 && colT > K[i + 1].t) i++;
  const A = K[i], Bk = K[i + 1], k = fall && i === 0 ? clamp((colT - A.t) / (Bk.t - A.t)) ** 2 : smooth(0, 1, clamp((colT - A.t) / (Bk.t - A.t)));
  ovr = {
    hz: lerp(A.hz, Bk.hz, k), leanF: lerp(A.lf, Bk.lf, k), leanS: fall ? lerp(A.ls, Bk.ls, k) : 0,
    feet: [mix(A.fL, Bk.fL, k), mix(A.fR, Bk.fR, k)], hands: [mix(A.hL, Bk.hL, k), mix(A.hR, Bk.hR, k)],
    poleA: fall ? [[0.6, -1, 0.2], [-0.4, 1, -0.6]] : [[0.2, -1, -0.8], [0.2, 1, -0.8]],
    poleL: fall ? [[1, -0.5, 0.1], [0.4, 0.6, 1]] : [[1, -0.2, 0.1], [1, 0.2, 0.1]],
    hemAttach: lerp(A.hem, Bk.hem, k), facePitch: fall ? 0.25 : lerp(0.6, 0.4, k), faceYaw: fall ? 0.8 : 0, full: true, axes: 0,
  };
  if (fall) ovrW = 1;                                  // (no blending in: they hit the ground)
  if (P.mode === 'collapse' && colT >= K[K.length - 1].t + 0.2) P.mode = 'dead';
  P.vx = P.vy = 0; P.sheltered = 0;
}

// --- deep water: swimming, struggling, slipping under -----------------------------------------------
// Upright in the water, head and shoulders out, arms thrashing; slow headway toward the input.
// The cold takes the strength out of it (body.js drains warmth in ~25 s out here).
function swimPose(t, k, side = 1) {
  // one arm flung up and out to the side, bent at the elbow, the mitt high (it swaps sides
  // every ~0.6 s with a burst of spray: updateSwim), the other beating the water at the surface
  const a = Math.sin(t), up = 11.2;
  const reach = [0.9 + 0.3 * Math.sin(t * 0.9), side * (3.4 + 0.4 * k), 14.4 + 1.0 * k + 0.4 * Math.sin(t * 1.3)];
  const beat = [1.5 + 1.4 * Math.max(0, a) * k, -side * (2.5 + 0.4 * k), up - 0.4 + 1.5 * a * k];
  // the head turned up and toward the camera: a face, gasping
  const toCam = clamp(wrapPi(Math.PI / 2 - P.facing), -1.3, 1.3);
  return {
    hz: 7.9, leanF: 0.12 + 0.1 * k * Math.abs(a), leanS: -0.12 * side * k + 0.05 * a * k,
    feet: [[0.6 * Math.sin(t * 1.7), -1, 0.4], [-0.6 * Math.sin(t * 1.7), 1, 0.4]],
    hands: side > 0 ? [beat, reach] : [reach, beat],
    poleA: side > 0 ? [[-0.2, -1, -0.2], [0.1, 1, -0.9]] : [[0.1, -1, -0.9], [-0.2, 1, -0.2]],   // the reaching elbow out and down
    poleL: [[1, -0.2, 0.1], [1, 0.2, 0.1]],
    hemAttach: 0, facePitch: -0.45 + 0.3 * (1 - k), faceYaw: toCam, full: true, axes: 0,
  };
}
let strokeT = 0, swimSide = 1;
function updateSwim(dt, wEff) {
  const inp = state.input;
  const k = (0.35 + 0.65 * smooth(0.02, 0.3, warmth())) * (1 - 0.5 * tiredK());   // strength left (the cold, exhaustion)
  const mag = Math.min(1, Math.hypot(inp.x, inp.y));
  // in a hole in the ice: kept inside its edge; a tap (or pushing at the edge) heaves at it
  const hole = (heave && heave.h) || ICE.holeAt(P.x, P.y);
  if (hole && holeSwim(dt, hole, k, mag, inp)) return;
  swimT += dt * (3.2 + 2.5 * mag) * (0.5 + 0.5 * k);
  const want = mag > 0.05 ? Math.atan2(inp.y / KY, inp.x) : P.facing;
  if (mag > 0.05) P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -2.5 * dt, 2.5 * dt));
  const sp = 3.4 * mag * k;
  P.vx = approach(P.vx, Math.cos(want) * sp, 2, dt);
  P.vy = approach(P.vy, Math.sin(want) * sp * KY, 2, dt);
  const nx = P.x + P.vx * dt, ny = P.y + P.vy * dt;
  if (passable(nx, ny)) { P.x = nx; P.y = ny; } else { P.vx *= 0.2; P.vy *= 0.2; }
  if (hole) keepInHole(hole);
  ovrW = approach(ovrW, 1, 6, dt);
  // the arms swap every ~0.6 s (slower as the strength goes): the reaching arm comes down
  // and beats the water in a burst of spray, the other flies up
  strokeT -= dt;
  if (strokeT <= 0) {
    strokeT = 0.6 + 0.35 * (1 - k);
    swimSide = -swimSide;
    const c = Math.cos(P.facing), sn = Math.sin(P.facing), sd = -swimSide;
    const hx = P.x + c * 1.4 - sd * sn * 3, hy = P.y + (sn * 1.4 + sd * c * 3) * KY;
    state.events.push({ type: 'splash', x: hx, y: hy, strength: 0.55 + 0.45 * k, swim: true });
    splashDrops(hx, hy, 12, 1.2, 6.5);
    ring(hx, hy, 1.5, 9, 1.3);
  }
  ovr = swimPose(swimT, k, swimSide);
  puffs.length = 0;                    // no breath clouds hanging over a swimmer's head
  P.sheltered = 0;
  // back into the shallows: wading again
  if (water.level < 2) { P.mode = 'walk'; ovr = null; }
}
// --- a hole in the ice: heaving out ------------------------------------------------------------------
// Each heave: to the edge, the arms up onto the ice (with axes: swung up and driven in), then a pull
// up and forward, the chest onto the ice. How it goes is settled as the hands bite: the edge may break
// off (often without axes: the hole widens, they drop back, and lose half the ground they'd made),
// or they get further each time (heaveProg) until one carries them out, onto the ice: then the crawl.
// With axes ~2-3 heaves; without, ~7 on average, each costing far more (body.js HEAVE). A tap queues the next.
// (Monte Carlo of these, with the cold and the energy they cost: axes 2 heaves 27%, 3 55%, 4+ 18%;
// without, mean ~7, and ~84% get out heaving without a pause; ~16% are still in it when the cold wins)
const HEAVE_BREAK = 0.4, HEAVE_BREAK_AXES = 0.08, HEAVE_GAIN = 0.34, HEAVE_GAIN_AXES = 0.48;
function keepInHole(h) {
  const dx = P.x - h.x, dy = (P.y - h.y) / KY, d = Math.hypot(dx, dy), lim = Math.max(0.5, h.ro - 2.2);
  if (d > lim) { P.x = h.x + dx / d * lim; P.y = h.y + dy / d * lim * KY; P.vx *= 0.3; P.vy *= 0.3; }
}
function holeSwim(dt, h, k, mag, inp) {
  const fresh = t => t > 0 && state.time - t < 1.0;
  let trig = null;
  if (inp.tap && inp.tap.t !== lastTapT) {
    lastTapT = inp.tap.t;
    if (fresh(inp.tap.t)) trig = Math.hypot(inp.tap.x - P.x, inp.tap.y - P.y) > 4 ? Math.atan2((inp.tap.y - P.y) / KY, inp.tap.x - P.x) : P.facing;
    inp.tap = null;
  }
  if (inp.action && inp.action !== lastActT) { lastActT = inp.action; if (fresh(inp.action)) trig = P.facing; inp.action = null; }
  // pushing on at the edge heaves too (and keeps heaving while held)
  const dx = P.x - h.x, dy = (P.y - h.y) / KY, d = Math.hypot(dx, dy), lim = Math.max(0.5, h.ro - 2.2);
  const pushA = Math.atan2(inp.y / KY, inp.x);
  const atEdge = mag > 0.4 && d > lim - 0.6 && Math.cos(pushA - Math.atan2(dy, dx)) > 0.4;
  edgePushT = atEdge ? edgePushT + dt : 0;
  if (trig === null && edgePushT > 0.3 && !heave) trig = pushA;
  if (trig !== null) { if (heave) heave.queued = trig; else startHeave(h, trig, k); }
  if (!heave) return false;
  updateHeave(dt, k);
  return true;
}
function startHeave(h, dir, k) {
  heave = { h, dir, t: 0, dur: axesOn() ? 1.15 : 1.3, axes: axesOn(), k, out: null, broke: false, zTop: 7.4, queued: null };
}
function updateHeave(dt, k) {
  const H = heave, h = H.h;
  H.t += dt;
  const u = H.t / H.dur;
  P.facing = wrapPi(P.facing + clamp(wrapPi(H.dir - P.facing), -8 * dt, 8 * dt));
  const lim = Math.max(0.5, h.ro - 2.2), c = Math.cos(H.dir), sn = Math.sin(H.dir);
  const ex = h.x + c * lim, ey = h.y + sn * lim * KY;
  if (u < 0.3) { P.x = approach(P.x, ex, 9, dt); P.y = approach(P.y, ey, 9, dt); }
  // the hands bite (axes driven in / mitts slapped down): how this one goes is settled now
  if (!H.out && u >= 0.28) {
    const brk = rand() < (H.axes ? HEAVE_BREAK_AXES : HEAVE_BREAK);
    const gain = (H.axes ? HEAVE_GAIN_AXES : HEAVE_GAIN) * (0.55 + 0.45 * H.k) * (0.8 + 0.4 * rand());
    H.out = brk ? 'break' : heaveProg + gain >= 0.999 ? 'out' : 'slip';
    if (!brk) heaveProg = Math.min(1, heaveProg + gain);
    H.zTop = brk ? 7.8 : lerp(7.4, 3.6, heaveProg);
    const hx = P.x + c * 2.6, hy = P.y + sn * 2.6 * KY;
    state.events.push({ type: 'heave', stage: 'pull', axes: H.axes, x: hx, y: hy });
    for (let i = 0; i < (H.axes ? 7 : 4); i++) chips.push({ x: hx + (rand() - 0.5) * 2, y: hy, z: 0.2, vx: (rand() - 0.5) * 5, vy: (rand() - 0.2) * 3 * KY, vz: 1 + rand() * 3, age: 0, life: 0.6 + rand() * 0.4, r: 0.12 + rand() * 0.16 });
    splashDrops(P.x, P.y, 5, 0.5, 4);
  }
  // up out of the water and forward onto the ice (back down if it broke, or they slid back)
  let up = 0, back = 0;
  if (H.out) {
    up = smooth(0.3, 0.72, u) * (H.out === 'break' ? 1 - smooth(0.5, 0.64, u) : 1);
    back = H.out === 'slip' ? smooth(0.76, 1, u) : 0;
    const m = up * (1 - back) * 1.2;
    P.x = ex + c * m; P.y = ey + sn * m * KY;
  }
  water.zW = lerp(9.6, H.zTop, up * (1 - back));
  if (H.out === 'break' && !H.broke && u >= 0.5) {
    H.broke = true; heaveProg *= 0.5;
    ICE.widen(h, H.dir);
    state.events.push({ type: 'heave', stage: 'break', axes: H.axes, x: P.x, y: P.y });
    splashDrops(P.x, P.y, 12, 0.8, 6); ring(P.x, P.y, 2, 9, 1.4);
  }
  if (H.out === 'slip' && u >= 0.8 && !H.slid) { H.slid = true; state.events.push({ type: 'heave', stage: 'slip', axes: H.axes, x: P.x, y: P.y }); splashDrops(P.x, P.y, 6, 0.5, 4); }
  ovrW = approach(ovrW, 1, 8, dt);
  ovr = heavePose(u, H, water.zW, up * (1 - back));
  puffs.length = 0; P.sheltered = 0; P.vx = P.vy = 0;
  if (H.out === 'out' && u >= 0.8) { heave = null; startCrawlout(h, H.dir); return; }
  if (u >= 1) {
    const q = H.queued;
    heave = null; strokeT = 0;
    if (q !== null) startHeave(h, q, k);
  }
}
// The heave in the rig (the ice surface is at z = zW in rig units: the figure is drawn sunk by it).
function heavePose(u, H, zW, up) {
  const t = state.time, m = up * 1.2, f0 = (H.axes ? 3.6 : 3.0) - m, fall = H.out === 'break' ? smooth(0.5, 0.62, u) : 0;
  const hand = s => {
    const swim = [1.5, s * 2.6, 10.2], on = [f0, s * 1.45, zW + 0.4];
    let p;
    if (H.axes) {
      // swung up overhead, then driven into the ice beyond the edge
      const over = [0.3, s * 1.7, 16.2];
      p = u < 0.16 ? mix(swim, over, smooth(0, 0.16, u)) : u < 0.28 ? mix(over, [f0 + 0.6, s * 1.45, zW + 1.2], smooth(0.16, 0.28, u)) : on;
    } else p = u < 0.28 ? mix(swim, on, smooth(0.05, 0.28, u)) : on;
    if (fall > 0) p = mix(p, [1.4, s * 2.6, zW - 1.2], fall);
    return p;
  };
  const kick = Math.sin(t * 9);
  return {
    hz: 7.9, leanF: 0.15 + 0.78 * up, leanS: 0.04 * kick,
    feet: [[-1.0 + 0.7 * kick, -1, 1.0 + 0.4 * kick], [-1.0 - 0.7 * kick, 1, 1.0 - 0.4 * kick]],
    hands: [hand(-1), hand(1)],
    poleA: [[-0.2, -1, -0.6], [-0.2, 1, -0.6]], poleL: [[1, -0.2, 0.1], [1, 0.2, 0.1]],
    hemAttach: 0, facePitch: lerp(-0.25, 0.55, up), full: true, axes: H.axes ? 1 : 0,
  };
}
// Out: belly-down onto the ice, a few wriggling pulls flat on it away from the hole (the weight spread
// so it holds), then up. Soaked through: the race to the tent begins.
const CO_S = 2.4;
function startCrawlout(h, dir) {
  P.mode = 'crawlout'; coT = 0; coDir = dir; heaveProg = 0; edgePushT = 0;
  coFrom = { x: P.x, y: P.y };
  let to = { x: h.x + Math.cos(dir) * (h.r + 6.5), y: h.y + Math.sin(dir) * (h.r + 6.5) * KY };
  if (!passable(to.x, to.y)) to = { x: h.x + Math.cos(dir) * (h.r + 2.5), y: h.y + Math.sin(dir) * (h.r + 2.5) * KY };
  coTo = to;
  state.soak?.(1);
  state.events.push({ type: 'heave', stage: 'out', axes: axesOn(), x: P.x, y: P.y });
}
function updateCrawlout(dt) {
  coT += dt;
  const m = smooth(0, 1.6, coT);
  P.x = lerp(coFrom.x, coTo.x, m); P.y = lerp(coFrom.y, coTo.y, m);
  P.facing = wrapPi(P.facing + clamp(wrapPi(coDir - P.facing), -6 * dt, 6 * dt));
  water.zW = approach(water.zW, 0, 6, dt);
  if (!water.level && water.zW < 0.05) water.zW = 0;
  const flat = 1 - smooth(1.6, 2.1, coT), k = 1 - smooth(1.8, CO_S, coT);
  ovrW = approach(ovrW, 1, 8, dt);
  ovr = crawlPose(k, coT * 7, m < 0.98 ? 1 : 0);
  ovr.hz -= 1.3 * flat * k; ovr.leanF += 0.22 * flat * k;
  if (rand() < dt * 6 && water.zW > 0.3) splashDrops(P.x, P.y, 2, 0.4, 3);
  P.vx = P.vy = 0; P.sheltered = 0;
  if (coT >= CO_S) { P.mode = 'walk'; water.zW = 0; }
}

function updateSink(dt) {
  sinkT += dt;
  lastSinkX = P.x; lastSinkY = P.y;
  // a last reach, then under: the figure sinks below the surface and the rings close over it
  water.zW = 9.6 + 13 * smooth(0.5, 3.2, sinkT);
  ovrW = approach(ovrW, 1, 6, dt);
  const k = 1 - smooth(0.2, 1.6, sinkT);
  ovr = swimPose(swimT += dt * 2 * k, 0.4 * k, 1);
  // one arm up, open-handed, the last of them to go under; the other drops
  // the body tips away from the raised arm, so the hood goes under first and the hand, high
  // and out to the side, is the last thing seen
  const tip = smooth(0.2, 1.2, sinkT);
  ovr.leanS = lerp(ovr.leanS, -0.5, tip); ovr.hz = lerp(ovr.hz, 8.4, tip);
  ovr.hands = [mix(ovr.hands[0], [0.6, -1.0, 6.5], tip), mix(ovr.hands[1], [0.4, 3.0, 18.4], tip)];
  ovr.poleA = [[0.2, -1, -0.8], [-0.3, 1, -0.4]];
  if (sinkT > 1.0 && !flotsam) flotsam = { x: P.x + 1.2, y: P.y + 0.6, age: 0 };   // a mitt comes loose and floats
  if (sinkT < 2.2 && rand() < dt * 4) ring(P.x + (rand() - 0.5) * 2, P.y + (rand() - 0.5) * 1.2, 1.5, 8, 2.2, 1);
  if (sinkT >= 3.4 && P.mode === 'sink') { P.mode = 'dead'; P.lostAtSea = true; ring(P.x, P.y, 2, 10, 3, 1); bubbleT = 4; }
  P.vx = P.vy = 0; P.sheltered = 0;
}
// Rings on the water (idle, wake, strokes) and drips off wet clothes back on land.
function updateWaterFx(dt) {
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.age += dt; if (r.age >= r.life) rings.splice(i, 1); }
  // what's left where someone went under: a mitt riding the swell off downwind, bubbles
  if (flotsam) {
    flotsam.age += dt;
    const wa = state.wind.angle || 0, ws = 0.4 + 0.6 * (state.wind.speed || 0);
    if (!ICE.holeAt(flotsam.x, flotsam.y)) { flotsam.x += Math.cos(wa) * ws * dt; flotsam.y += Math.sin(wa) * ws * dt * KY; }   // (in a hole it stays)
    if (rand() < dt * 0.35) ring(flotsam.x, flotsam.y, 1, 3.5, 1.4);
    if (flotsam.age > 16) flotsam = null;
  }
  if (bubbleT > 0) {
    bubbleT -= dt;
    if (rand() < dt * 5) bubbles.push({ x: lastSinkX + (rand() - 0.5) * 2.2, y: lastSinkY + (rand() - 0.5) * 1, age: 0, life: 0.5 + rand() * 0.4, r: 0.18 + rand() * 0.2 });
  }
  for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.age += dt; if (b.age >= b.life) bubbles.splice(i, 1); }
  if (water.level && !P.lostAtSea && P.mode !== 'sink') {
    ringT -= dt;
    if (ringT <= 0) {
      // standing: slow rings from the legs; moving: a wake of them behind
      const mv = Math.hypot(P.vx, P.vy);
      ringT = mv > 1 ? 0.22 : 0.7;
      ring(P.x - P.vx * 0.15, P.y - P.vy * 0.15, water.level === 2 ? 2.5 : 1.8, water.level === 2 ? 9 : 6, mv > 1 ? 1.3 : 1.8);
    }
  }
  // drips from the hem while the clothes are wet (not once frozen stiff)
  const B = state.body, wet = B ? B.wet : 0, fz = B ? B.frozen : 0;
  if (!water.level && wet > 0.15 && P.mode !== 'inside' && P.mode !== 'gone' && P.mode !== 'tent-in' && P.mode !== 'tent-out') {
    dripT -= dt * wet * (1 - 0.85 * fz) * 9;
    if (dripT <= 0) {
      dripT = 0.4 + rand() * 0.6;
      const a = rand() * Math.PI * 2, c = Math.cos(P.facing + a), sn = Math.sin(P.facing + a);
      drips.push({ x: P.x + c * 2.4, y: P.y + sn * 1.2 * KY, z: 5.6 + rand() * 0.6, vz: 0 });
      if (rand() < 0.3) state.events.push({ type: 'drip', x: P.x, y: P.y });
    }
  }
  for (let i = drips.length - 1; i >= 0; i--) {
    const d = drips[i]; d.vz -= 30 * dt; d.z += d.vz * dt;
    if (d.z <= 0) drips.splice(i, 1);
  }
  if (drips.length > 30) drips.splice(0, drips.length - 30);
}
function drawFlotsam(ctx) {
  for (const b of bubbles) {
    const t = b.age / b.life;
    ctx.beginPath(); ctx.arc(b.x, b.y - t * 0.3, b.r * (0.7 + 0.5 * t), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(246,248,250,${0.9 * (1 - t)})`; ctx.fill();
    ctx.lineWidth = 0.08; ctx.strokeStyle = `rgba(80,86,94,${0.8 * (1 - t)})`; ctx.stroke();
  }
  const f = flotsam;
  if (!f) return;
  // a black mitt with its thumb, half awash, bobbing; fading in its last few seconds
  const a = clamp((16 - f.age) / 4), bob = Math.sin(f.age * 2.3) * 0.2, x = f.x, y = f.y + bob;
  ctx.globalAlpha = a;
  ctx.save(); ctx.translate(x, y); ctx.scale(1.6, 1.6);   // big enough to read as a mitt at play zoom
  ctx.beginPath(); ctx.ellipse(0.2, 0.35, 1.1, 0.42, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(30,34,40,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 0.85, 0.55, 0.25, 0, Math.PI * 2); ctx.fillStyle = '#1e1e20'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.78, -0.3, 0.34, 0.22, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-0.85, 0.05); ctx.lineTo(-1.25, 0.15); ctx.lineWidth = 0.32; ctx.strokeStyle = '#1e1e20'; ctx.stroke();   // the cuff
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawRings(ctx) {
  drawFlotsam(ctx);
  ctx.lineCap = 'round';
  for (const r of rings) {
    const t = r.age / r.life, rr = lerp(r.r0, r.r1, Math.sqrt(t)), a = (1 - t) * (1 - t);
    if (r.dark) {
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rr, rr * 0.42, 0, 0, Math.PI * 2);
      ctx.lineWidth = 0.4; ctx.strokeStyle = `rgba(40,44,50,${0.55 * a})`; ctx.stroke();
      continue;
    }
    ctx.beginPath(); ctx.ellipse(r.x + 0.15, r.y + 0.22, rr, rr * 0.42, 0, 0, Math.PI * 2);
    ctx.lineWidth = 0.22; ctx.strokeStyle = `rgba(78,82,88,${0.4 * a})`; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rr, rr * 0.42, 0, 0, Math.PI * 2);
    ctx.lineWidth = 0.18; ctx.strokeStyle = `rgba(238,241,244,${0.75 * a})`; ctx.stroke();
  }
}
function drawDrips(ctx) {
  ctx.fillStyle = 'rgba(96,106,120,0.75)';
  for (const d of drips) { ctx.beginPath(); ctx.ellipse(d.x, d.y - d.z, 0.1, 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
}
// In the water: the figure sunk by zW below the painted surface and cut off at it, a dark
// ring of water round it and a light line where it meets the body.
function drawInWater(ctx) {
  const X = P.x, Y = P.y, zW = water.zW;
  drawRings(ctx);
  if (P.lostAtSea) return;
  const rig = buildRig();
  const fw = toWorld(rig.head, rig.yaw);
  faceWorld = { x: X + fw.x, y: Y + fw.y, z: fw.z - 0.5 - zW };   // drawn at y - z: sunk by zW
  const rx = zW > 6 ? 2.7 : 2.2, deep = zW > 6, under = smooth(12.5, 17, zW);   // going under
  // the water round the body: a dark collar when swimming (reads even when small), melting
  // into the rings as they go under
  ctx.beginPath(); ctx.ellipse(X, Y + 0.1, rx + (deep ? 1.6 : 0.9), (rx + (deep ? 1.6 : 0.9)) * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = deep ? `rgba(34,38,46,${0.6 * (1 - under)})` : 'rgba(70,76,84,0.22)'; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(X - 30, Y - 45, 60, 45.15); ctx.clip();
  ctx.translate(0, zW);
  drawFigure(ctx, rig, X, Y);
  ctx.restore();
  // the waterline: lit froth across the front of the body (gone once the body is under; a
  // raised arm alone makes no waterline arc)
  if (under < 0.99) {
    ctx.globalAlpha = 1 - under;
    ctx.beginPath(); ctx.ellipse(X, Y, rx, rx * 0.4, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.lineWidth = 0.28; ctx.strokeStyle = 'rgba(242,245,248,0.9)'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(X, Y, rx, rx * 0.4, 0, 1.05 * Math.PI, 1.95 * Math.PI);
    ctx.lineWidth = 0.16; ctx.strokeStyle = 'rgba(60,64,70,0.5)'; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (!deep) drawPuffs(ctx, puffs);
  drawKicks(ctx);
}

// Ground shadow fades out (linearly, ~0.2 s) as the climber steps onto the wall, starting in the
// last stride of the approach so no blob is left on the snow.
let shadowOff = 0;
function updateShadowOff(dt) {
  const c = climb;
  const onWall = (P.mode === 'climb' && c && (c.stage === 'cycle' || c.stage === 'lower' || c.stage === 'torn' || (c.stage === 'mantle' && c.t < 0.9) || (c.stage === 'off' && c.t < 0.7)))
    || (P.mode === 'approach' && route && Math.hypot(P.x - route.bottom.x, P.y - route.bottom.y) < 2.5);
  shadowOff = clamp(shadowOff + (onWall ? 1 : -1) * dt / 0.2);
}
function updateChips(dt) {
  updateShadowOff(dt);
  for (let i = chips.length - 1; i >= 0; i--) {
    const p = chips[i];
    p.age += dt;
    if (p.age >= p.life) { chips.splice(i, 1); continue; }
    p.vz -= 26 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
}


function footDown(foot, prof, ter) {
  const S = pose.stepEff * pose.gait * 0.5;
  const s = foot === 'L' ? -1 : 1;
  const st = pose.stance + (slipT > 0 && s === slipSide ? 1.2 : 0);
  const c = Math.cos(P.facing), sn = Math.sin(P.facing);
  const jf = (rand() - 0.5) * 0.7, jr = (rand() - 0.5) * 0.3;   // no two strides quite alike
  const x = P.x + (S + jf) * c - s * (st + jr) * sn;
  const y = P.y + ((S + jf) * sn + s * (st + jr) * c) * KY;
  // limping: a light, quick step onto the bad leg and a heavy one onto the good; the bad boot drags
  const lk = limpK(), bad = lk > 0.05 && s === badS;
  const weight = prof.weight * (0.6 + 0.4 * pose.gait) * (1 + 0.3 * tiredK()) * (lk > 0.05 ? (bad ? 1 - 0.4 * lk : 1 + 0.25 * lk) : 1);
  // worn out, the boots no longer clear the snow: footprints.js scores drag marks between prints
  // (the bad boot's own mark is a scuff behind each of its prints: footprints.js, step.bad)
  const drag = smooth(0.32, 0.05, energy());
  if (ter === 'water') {
    // wading: a splash, drops thrown up, a ring spreading from the leg
    state.events.push({ type: 'splash', x, y, strength: 0.4 + 0.4 * clamp(water.depth / WADE_D) });
    splashDrops(x, y, 4, 0.5, 3.5);
    ring(x, y, 1, 5, 1.1);
    return;
  }
  state.events.push({ type: 'step', x, y, terrain: ter, foot, weight, angle: P.facing, shoe: shoesOn(), cramp: crampOn(), wet: state.body?.wet || 0, drag, limp: lk, bad });
  if ((ter === 'ice' || ter === 'thin') && slipT <= 0 && rand() < (ter === 'ice' ? 0.09 : 0.05) * (crampOn() ? 0.15 : 1)) {
    slipT = 0.9; slipSide = s;
    if (rand() < 0.05) hurt(0.05, 'slip');            // now and then the slip wrenches something
  }
  const shoe = shoesOn();
  if (ter === 'deep' && !shoe && staggerT <= 0 && rand() < 0.1) { staggerT = 0.75; staggerSide = rand() < 0.5 ? -1 : 1; }
  // snow kicked up by the swinging boot
  if (ter === 'deep') {
    const n = shoe ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const sp = (ter === 'deep' ? 5 : 3) * (0.5 + rand());
      const a = P.facing + (rand() - 0.5) * 1.4;
      kicks.push({ x, y, z: 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * KY, vz: 3 + rand() * 4, life: 0.5 + rand() * 0.3, age: 0, r: 0.18 + rand() * 0.2 });
    }
    if (kicks.length > 40) kicks.splice(0, kicks.length - 40);
  }
}

function updateKicks(dt) {
  for (let i = kicks.length - 1; i >= 0; i--) {
    const p = kicks[i];
    p.age += dt;
    if (p.age >= p.life || p.z < 0) { kicks.splice(i, 1); continue; }
    p.vz -= 22 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
}

// --- breath vapour -----------------------------------------------------------------------------
let faceWorld = { x: 0, y: 0, z: 13 };
let breathX = 0, breathW = 0;
// One exhale. Breath shows with the cold (weather.cold 0..1, colder at night and in wind):
// barely an occasional wisp when mild, a clear puff every exhale from ~0.6, dense clouds past
// 0.85. pk: panting (0..1): blown, every breath is a big cloud driven hard out of the hood,
// whatever the air.
function exhale(pk) {
  const cold = clamp(state.weather.cold ?? 0.4), exert = breathX * (1 - pk), wEff = breathW;
  const faint = smooth(0.3, 0.03, warmth());
  // thirsty: a dry mouth, a thinner breath (smaller, fainter, quicker gone)
  const dry = clamp(state.body?.thirst || 0);
  if (!(cold >= 0.3 || pk > 0.3 || rand() < 0.3)) return;
  // one plume per exhale (plus a second, thinner one when it's bitter), leaving the face
  // opening, stretching downwind and tearing into curls. Exerting: small and quick; standing
  // in hard cold: big, slow and long-lived; panting: big and fast, one after another.
  const n = 1 + (cold > 0.75 || pk > 0.6 ? 1 : 0) + (cold > 0.88 ? 1 : 0);
  const fa = P.facing + pose.torsoYaw + pose.headYaw;
  const fc = Math.cos(fa), fs = Math.sin(fa);
  const size = (0.55 + 0.9 * cold + smooth(0.85, 1, cold) * 0.5) * (1 - 0.4 * exert) * lerp(1, 0.6, faint) * (1 + 0.9 * pk) * (1 - 0.32 * dry);
  for (let i = 0; i < n; i++) {
    const v = (2.0 + exert * 3.5) * (1 + 0.8 * pk);
    puffs.push({
      x: faceWorld.x + fc * 0.9, y: faceWorld.y + fs * 0.9 * KY, z: faceWorld.z - 0.1 * i,
      vx: fc * v + P.vx * 0.6, vy: fs * v * KY + P.vy * 0.6, vz: 0.12 * cold,
      age: -i * 0.12, life: (2.0 + rand() * 1.0) * (0.6 + 0.4 * smooth(0.3, 0.6, cold)) * (1 - 0.3 * exert) * (1 - wEff * 0.25) * (1 - 0.25 * pk) * (1 - 0.3 * dry),
      r: (1.1 + rand() * 0.3) * size, a: Math.max(cold < 0.3 ? 0.12 : lerp(0.3, 0.7, smooth(0.3, 0.6, cold)), 0.55 * pk) * (i ? 0.6 : 1) * (1 - 0.45 * dry),
      curls: 2 + Math.floor(rand() * 3), seed: rand() * 6.28,
    });
  }
  if (puffs.length > 80) puffs.splice(0, puffs.length - 80);
}
function updateBreath(dt, ter, g, wEff, wa) {
  const exert = clamp(g * (ter === 'deep' ? 1 : ter === 'snow' ? 0.6 : ter === 'thin' ? 0.5 : 0.4) + wEff * 0.3);
  breathStrong = Math.max(exert, pant);
  breathX = exert; breathW = wEff;
  breathT -= dt;
  const faint = smooth(0.3, 0.03, warmth());       // hypothermia: slow, shallow breaths
  if (P.mode === 'dead' || pant >= 0.22) breathT = 1;   // panting: updatePant times each breath
  if (breathT <= 0) {
    breathT = lerp(2.6, 0.9, exert) * (0.85 + rand() * 0.3) * lerp(1, 1.8, faint);
    exhale(0);
  }
  const wx = Math.cos(wa) * (2 + 10 * wEff), wy = Math.sin(wa) * (2 + 10 * wEff) * KY;
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.age += dt;
    if (p.age >= p.life) { puffs.splice(i, 1); continue; }
    if (p.age < 0) continue;
    const drag = 1 - Math.exp(-2.5 * dt);
    p.vx += (wx - p.vx) * drag; p.vy += (wy - p.vy) * drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
}

// --- rig -----------------------------------------------------------------------------------------
function toWorld(v, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: v[0] * c - v[1] * s, y: (v[0] * s + v[1] * c) * KY, z: v[2], g: v[0] * s + v[1] * c };
}
function torsoToBody(v, tf) {
  let [f, r, z] = v;
  let a = f * tf.cy - r * tf.sy; r = f * tf.sy + r * tf.cy; f = a;
  a = f * tf.cp + z * tf.sp; z = -f * tf.sp + z * tf.cp; f = a;
  a = r * tf.cr + z * tf.sr; z = -r * tf.sr + z * tf.cr; r = a;
  return [f + tf.hx, r + tf.hr, z + tf.hz];
}
function torsoDir(v, tf) {
  const o = torsoToBody([0, 0, 0], tf), p = torsoToBody(v, tf);
  return [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
}
function ik(root, target, a, b, pole) {
  let dx = target[0] - root[0], dy = target[1] - root[1], dz = target[2] - root[2];
  let d = Math.hypot(dx, dy, dz) || 0.001;
  const maxD = (a + b) * 0.999;
  if (d > maxD) { const k = maxD / d; dx *= k; dy *= k; dz *= k; d = maxD; target = [root[0] + dx, root[1] + dy, root[2] + dz]; }
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const pd = pole[0] * ux + pole[1] * uy + pole[2] * uz;
  let px = pole[0] - pd * ux, py = pole[1] - pd * uy, pz = pole[2] - pd * uz;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl; py /= pl; pz /= pl;
  return { joint: [root[0] + ux * along + px * h, root[1] + uy * along + py * h, root[2] + uz * along + pz * h], end: target };
}
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function legFoot(q, s, S, lift, sink, stance) {
  let f, z;
  if (q < 0.5) { const t = q / 0.5; f = S * (1 - 2 * t); z = -sink; }
  else {
    const t = (q - 0.5) / 0.5;
    const e = t * t * (3 - 2 * t);
    f = -S + 2 * S * e;
    z = -sink + lift * Math.sin(Math.PI * t) + sink * Math.sin(Math.PI * t) * 0.9;
  }
  return [f, s * stance, z];
}

const N = 32; // coat ring resolution

function buildRig() {
  const t = state.time, g = pose.gait, idle = 1 - smooth(0.1, 0.5, g);
  const shoeW = shoesDrawn() ? 1 : 0;
  const S = pose.stepEff * 0.5 * g;
  const yaw = P.facing;
  const ph2 = phase * Math.PI * 2;
  const slip = slipT > 0 ? Math.sin(clamp(slipT / 0.9) * Math.PI) : 0;
  const stag = staggerT > 0 ? Math.sin(clamp(staggerT / 0.75) * Math.PI) : 0;
  const wa = state.wind.angle ?? 0;
  const wdF = Math.cos(wa - yaw), wdR = Math.sin(wa - yaw);   // downwind, body frame
  const gk = pose.gustKick;

  // breathing (bigger at rest), shiver jitter
  // panting: the chest and shoulders heave on the panting clock, up on the breath in, down on
  // the breath out, deeper the more blown they are
  const heave = -Math.cos(pantPh * Math.PI * 2), pk = smooth(0.15, 0.5, pant);
  const breathe = lerp(Math.sin(t * Math.PI * 2 / lerp(3.4, 1.3, breathStrong)) * lerp(0.25, 0.12, g), heave * (0.22 + 0.4 * pant), pk);
  const droop = smooth(0.55, 0.1, reserve()) * idle;   // a worn reserve: slow, sagging, head low
  const shv = pose.shiver * (0.12 + 0.28 * pose.coldShake);   // hard shivering in the deep cold
  const jitR = shv * Math.sin(t * 71), jitZ = shv * 0.6 * Math.sin(t * 53 + 1);

  // Hips: bob, crouch, weight shift, stagger
  const bob = -pose.bob * g * Math.cos(ph2 * 2);
  const sinkNow = pose.sink;
  const crouch = pose.crouch + idle * 0.1 + pose.brace * 0.3 + pose.hug * 0.15 + slip * 0.4 + stag * 0.3 + pose.shiver * 0.1 + droop * 0.28;
  const shift = pose.shift;
  const sway = shift * 0.42 + g * 0.18 * Math.sin(ph2) - slip * slipSide * 0.5 + wdR * gk * 0.6;
  const hx = wdF * gk * 0.4, hr = sway;
  let hz = HIP_H - crouch * 1.3 - sinkNow * 0.85 + bob + pose.lift * g * 0.06 - Math.abs(shift) * 0.12;

  let leanF = pose.lean * (0.4 + 0.6 * g) + pose.windLeanF + pose.hug * 0.12 + pose.brace * 0.06 + stag * 0.25
    - slip * 0.1 + pose.work * g * 0.05 * Math.cos(ph2 * 2) + wdF * gk * 0.18;
  let leanS = pose.windLeanS + slip * slipSide * 0.22 + stag * staggerSide * 0.2 + g * 0.03 * Math.sin(ph2)
    - shift * 0.05 + wdR * gk * 0.22;
  let twist = pose.torsoYaw + g * pose.swing * 0.07 * Math.cos(ph2);
  // shove: one big stagger step downwind, leaning, an arm thrown out (first ~0.5 s)
  // snaps in over ~0.12 s, holds ~0.45 s, eases back by ~0.8 s
  const shE = 1 - shoveT, shK = shoveT > 0 ? smooth(0, 0.12, shE) * (1 - smooth(0.57, 0.8, shE)) : 0;
  const shSide = wdR >= 0 ? 1 : -1;
  if (shK > 0.001) { leanS += wdR * 0.3 * shK + shSide * 0.08 * shK; leanF += wdF * 0.3 * shK; hz -= 0.6 * shK; }
  // cower: squat low, bowed over, leaning a shoulder into the rock when hunkering
  const cw = cowerW;
  if (cw > 0.001) {
    const ck = smooth(0.8, 0.4, warmth());          // colder: balled up tighter and lower
    hz = lerp(hz, 3.4 - 0.6 * ck, cw); leanF = lerp(leanF, 0.78 + 0.14 * ck, cw);
    leanS = lerp(leanS, hunkerSide * 0.28 * hunkerW, cw); twist = lerp(twist, 0, cw);
  }
  // kneeling in the deep cold: down on one knee, bowed, hugging themselves
  const kw = kneelW;
  if (kw > 0.001) { hz = lerp(hz, 4.3, kw); leanF = lerp(leanF, 0.45, kw); leanS = lerp(leanS, 0, kw); twist = lerp(twist, 0, kw); }
  // worn out: stopped bent double, hands braced on the knees, the back rising and falling with
  // each breath; spent: sat huddled in the snow, knees drawn up together, arms wrapped round
  // them inside the coat, the hood down on the knees, only the boot soles showing in front
  const resW = restW * (1 - sitW), sitK = sitW;
  if (resW > 0.001) { hz = lerp(hz, 6.0, resW); leanF = lerp(leanF, 0.74 + 0.05 * heave, resW); leanS = lerp(leanS, 0, resW); twist = lerp(twist, 0, resW); }
  if (sitK > 0.001) { hz = lerp(hz, 0.5, sitK); leanF = lerp(leanF, 0.5 + 0.04 * heave, sitK); leanS = lerp(leanS, 0, sitK); twist = lerp(twist, 0, sitK); }
  // strapping snowshoes on / off: kneel with the hands at the bindings (a quick bend when the
  // game pulls them off)
  const strK = strapT > 0 ? Math.sin(clamp(1 - strapT / strapDur) * Math.PI) : 0;
  const strDeep = strapLock ? 1 : 0.5;
  if (strK > 0.001) { hz -= 3.0 * strK * strDeep; leanF += 0.75 * strK * strDeep; twist = lerp(twist, 0, strK); }
  // kneeling at the sled, a body or a pile (leaning in to dig), or to eat: down on one knee
  const pkw = CP.kneel;
  // (digging: right down, bent well over what's in front; eating: kneeling up)
  // (seen from behind, leaning over only lifts the head up the screen: lower, less bent)
  const toCam = clamp(0.5 + 0.5 * Math.sin(yaw));
  // eating snow: bent right down over it for the scoop, kneeling up again to eat it
  const sT = CP.snowT, scoopK = CP.snow * smooth(0.12, 0.45, sT) * (1 - smooth(0.9, 1.25, sT));
  const snowUp = CP.snow * smooth(1.0, 1.4, sT) * (1 - smooth(2.3, 2.6, sT));
  const digK = Math.max(CP.dig, 0.75 * CP.job, 0.85 * scoopK);   // (at the pup tent: down and leaning in to it too)
  if (pkw > 0.001) { hz = lerp(hz, lerp(4.2, lerp(2.3, 3.0, toCam), digK), pkw); leanF = lerp(leanF, 0.2 + digK * lerp(0.15, 0.6, toCam), pkw); leanS = lerp(leanS, 0, pkw); twist = lerp(twist, 0, pkw); }
  // the wind's taken the pup tent: up off the knees, reaching after it
  if (CP.grab > 0.001) { hz += 2.2 * CP.grab; leanF -= 0.3 * CP.grab; }
  // lightheaded with hunger (body.dizzy): a slow sway from side to side, the head rolling with it
  const dzy = state.body?.dizzy || 0;
  if (dzy > 0.001) { leanS += 0.2 * dzy * Math.sin(t * 5.2); leanF += 0.08 * dzy; }
  // hungry: hunched a little over a hand on the stomach
  const stw = pose.stomach;
  if (stw > 0.001) { leanF += 0.3 * stw; hz -= 0.35 * stw; }
  // thirsty, the headache: the head bowed and tipped into the mitt at the side of the hood, a slow
  // rock with it (upright: it's in the head, not the gut)
  const hdw = pose.head || 0;
  if (hdw > 0.001) { leanF += 0.12 * hdw; leanS += (0.13 * hdw + 0.04 * hdw * Math.sin(t * 1.6)) * (1 - 0.7 * headBoth); }
  // drinking: the flask unscrewed at the chest, then tipped up to the mouth, head and shoulders back
  const dT = CP.drinkT, tipK = CP.drink * smooth(0.55, 0.85, dT) * (1 - smooth(1.7, 1.95, dT));
  if (tipK > 0.001) leanF -= 0.16 * tipK;
  // eating: a slight bob with each chew once the food is at the mouth (or the snow)
  const eatK = Math.max(CP.eat * smooth(0.35, 0.85, CP.eatT), snowUp);
  const chew = CP.eat > snowUp ? eatK * Math.sin(CP.eatT * 15) * (1 - smooth(2.6, 3.0, CP.eatT)) : snowUp * Math.sin(sT * 13) * smooth(1.4, 1.6, sT);
  // compass: bent over the pack while rummaging; braced and head bowed holding it out
  const rw = CP.rum, cow = CP.out;
  if (rw > 0.001 || cow > 0.001) {
    hz -= 0.5 * rw + 0.25 * cow * (1 - g);
    leanF += 0.38 * rw + 0.1 * cow;
    twist = lerp(twist, 0, Math.max(rw, cow));
  }
  // limping: on the bad leg the hips drop and the body lurches over it, quickly; the hand on the
  // thigh (standing badly hurt) bends them a little over that side
  const lk = limpK() * smooth(0.1, 0.5, g);
  const badQ = (phase + (badS < 0 ? 0 : 0.5)) % 1;      // the bad leg's own cycle: stance in 0..0.5
  const dip = badQ < 0.5 ? Math.sin(badQ / 0.5 * Math.PI) : 0;
  if (lk > 0.001) { hz -= 0.9 * lk * dip; leanS += badS * 0.16 * lk * dip; leanF += 0.08 * lk * dip; }
  if (thighW > 0.001) { leanF += 0.2 * thighW; leanS += badS * 0.07 * thighW; hz -= 0.25 * thighW; }
  // climb / knockdown override
  const O = ovr && ovrW > 0.001 ? ovr : null, ow = O ? ovrW : 0;
  const climbW = O && O.full && P.mode === 'climb' ? ow : 0;
  if (O) { hz = lerp(hz, O.hz, ow); leanF = lerp(leanF, O.leanF, ow); leanS = lerp(leanS, O.leanS, ow); twist = lerp(twist, 0, ow); }
  const tf = { cy: Math.cos(twist), sy: Math.sin(twist), cp: Math.cos(leanF), sp: Math.sin(leanF), cr: Math.cos(leanS), sr: Math.sin(leanS), hx, hr, hz };
  const upZ = breathe + jitZ - 0.4 * droop;
  const shoulderC = torsoToBody([0, jitR, SPINE + upZ], tf);

  // Legs
  const legs = [];
  for (const s of [-1, 1]) {
    const q = (phase + (s < 0 ? 0 : 0.5)) % 1;
    // the bad leg swings through stiff and low (its boot all but dragging), a shorter stride
    const bl = s === badS ? lk : 0;
    const foot = legFoot(q, s, S * (1 - 0.25 * bl), pose.lift * g * (1 - 0.8 * bl), sinkNow, pose.stance);
    if (g < 1) foot[2] = lerp(-sinkNow, foot[2], g);
    if (shoeW > 0) foot[1] += s * 0.45 * shoeW * clamp(foot[2] / 0.8);   // frames swung wide of each other
    if (slip > 0 && s === slipSide) { foot[1] += s * 1.4 * slip; foot[0] += 0.6 * slip; }
    // idle: the unloaded leg (opposite the weight shift) relaxes, heel lifting a touch
    const unload = Math.max(idle * clamp(-shift * s), s === badS ? 0.8 * thighW : 0);
    foot[0] += unload * 0.35; foot[1] -= s * unload * 0.15; foot[2] += unload * 0.2;
    // foot stamp
    if (stampOn > 0 && s === stampSide) foot[2] += Math.sin(clamp(stampOn / 0.45) * Math.PI) * 1.1;
    let ft = foot, poleL = [1, s * 0.15, 0.1];
    if (cw > 0.001) { ft = mix(ft, [0.9, s * 1.15, 0], cw); poleL = mix(poleL, [1, s * 0.6, 0.2], cw); }
    if (kw > 0.001) { ft = mix(ft, s < 0 ? [-2.9, -0.9, 0.2] : [1.6, 1.25, 0], kw); poleL = mix(poleL, s < 0 ? [1, -0.1, -0.2] : [1, 0.35, 0.3], kw); }
    if (pkw > 0.001) { ft = mix(ft, s < 0 ? [-2.9, -0.9, 0.2] : [1.6, 1.25, 0], pkw); poleL = mix(poleL, s < 0 ? [1, -0.1, -0.2] : [1, 0.35, 0.3], pkw); }
    if (resW > 0.001) { ft = mix(ft, [-0.3 + (s < 0 ? 0.4 : -0.2), s * 1.5, 0], resW); poleL = mix(poleL, [1, s * 0.3, 0.1], resW); }
    if (sitK > 0.001) { ft = mix(ft, [3.4, s * 0.5, 0.15], sitK); poleL = mix(poleL, [0.8, s * 0.1, 1], sitK); }
    if (O) { ft = mix(ft, O.feet[s < 0 ? 0 : 1], ow); poleL = mix(poleL, O.poleL[s < 0 ? 0 : 1], ow); }
    if (shK > 0.001 && s === shSide) ft = [ft[0] + wdF * 2.0 * shK, ft[1] + wdR * 2.0 * shK + s * 0.4 * shK, ft[2] + 0.7 * Math.max(0, Math.sin(clamp((1 - shoveT) / 0.3) * Math.PI))];
    foot[0] = ft[0]; foot[1] = ft[1]; foot[2] = ft[2];
    const hip = [hx, hr + s * 0.78, hz];
    const ankle = [foot[0], foot[1], foot[2] + ANKLE_H];
    const kn = ik(hip, ankle, THIGH, SHIN, poleL);
    legs.push({ s, hip, knee: kn.joint, ankle: kn.end, foot, q });
  }

  // Arms (torso-frame targets, IK in the body frame). At rest they hang inside the coat.
  const arms = [];
  const sh = pose.shieldSide;
  for (const s of [-1, 1]) {
    const shoulderT = [0, s * SHOULDER_W + jitR, SPINE - 0.4 + upZ + (O && O.shrug ? O.shrug[s < 0 ? 0 : 1] * ow : 0)];
    const legF = s < 0 ? Math.cos(ph2) : -Math.cos(ph2);
    const armF = -legF * pose.swing * g * 1.1 * (1 - 0.6 * (state.body?.frozen || 0));
    let hand = [0.3 + armF * 0.6, s * 1.9, SPINE - 4.1 + Math.abs(armF) * 0.15];
    const workT = [0.9 - legF * 0.9 * g, s * 2.1, SPINE - 2.9 + Math.max(0, -legF) * 0.6];
    hand = mix(hand, workT, pose.work);
    // balance: arms out and forward, wobbling fore/aft so it reads from the side too
    const wob = Math.sin(t * 2.1 + s * 1.7) * 0.6 + Math.sin(t * 4.7 + s * 2.3) * 0.3;
    const spreadT = [1.6 + wob * 1.1, s * 3.1, SPINE - 3.0 + wob * 0.45 * s + slip * Math.sin(t * 15 + s) * 1.6];
    const spreadW = clamp(pose.spread * (0.55 + 0.45 * g) + slip);
    hand = mix(hand, spreadT, spreadW);
    const creepT = [1.7 + Math.sin(t * 1.3 + s) * 0.3, s * 1.5, SPINE - 3.3 + Math.sin(t * 1.9 + s * 2) * 0.2];
    hand = mix(hand, creepT, pose.creep);
    hand = mix(hand, [1.3, -s * 0.5, SPINE - 1.8 + (s > 0 ? 0.3 : 0)], pose.hug * (1 - slip));
    const shieldW = s === sh ? pose.shield : 0;
    if (s === sh) hand = mix(hand, [2.0, s * 0.3, SPINE + HEAD_UP - 0.4], pose.shield * (1 - slip));
    else hand = mix(hand, [0.9, s * 2.1, SPINE - 3.6], pose.shield * 0.5 * (1 - pose.spread));
    // carrying the ice axes: hands out by the thighs, a short swing; the reach to the pack
    // (taking them in or out) is a quick hand to the back of the shoulder
    const carryW = axesOn() && !O ? clamp(1 - Math.max(pose.hug, pose.shield * (s === sh ? 1 : 0), pose.spread * 0.6, cw, CP.rum, CP.out, CP.slot)) : 0;
    if (carryW > 0) hand = mix(hand, [0.5 + armF * 0.55, s * 3.0, SPINE - 4.0 + Math.abs(armF) * 0.1], carryW);
    // (and the once, patting the pack: the same reach, tapping twice)
    const patK = patT > 0 && s > 0 ? Math.sin(clamp(1 - patT / PAT_S) * Math.PI) * (0.75 + 0.25 * Math.sin((1 - patT / PAT_S) * Math.PI * 6)) : 0;
    const reachK = Math.max(axeReachT > 0 && s > 0 ? Math.sin(clamp(1 - axeReachT / 0.5) * Math.PI) : 0, patK);
    if (reachK > 0) hand = mix(hand, [-0.9, s * 1.5, SPINE + 0.2], reachK);
    const shoulder = torsoToBody(shoulderT, tf);
    let handB = torsoToBody(hand, tf);
    let pole = torsoDir([-1 + shieldW * 0.6 + pose.work * 1.0 + spreadW * 0.6 + pose.creep * 0.5, s * (0.8 + shieldW * 1.2 + spreadW * 0.5), -0.6 - spreadW * 0.6 - pose.work * 0.6], tf);
    let overHead = false;
    if (cw > 0.001) {
      // arms wrapped over the head and hood; hunkering, the rock-side hand braces on the rock
      const onRock = s === hunkerSide ? hunkerW : 0;
      const cT = mix([1.05, -s * 0.4, SPINE + HEAD_UP + 0.85], [0.4, s * 2.8, SPINE - 0.6], onRock);
      handB = mix(handB, torsoToBody(cT, tf), cw);
      pole = mix(pole, torsoDir([0.9, s * 1.1, -0.1], tf), cw);
      overHead = cw > 0.5 && onRock < 0.5;
    }
    let flung = false;
    if (shK > 0.3 && !O) {
      const fs = s === -shSide ? 1 : 0.5;   // the upwind arm flies out wide, the other half out
      handB = mix(handB, torsoToBody([0.6 + (fs < 1 ? 1.2 : 0), s * 3.6 * fs + s * 0.8, SPINE - 0.6 + fs * 0.8], tf), clamp((shK - 0.3) * 2) * fs);
      pole = mix(pole, torsoDir([-0.5, s, -0.4], tf), shK);
      flung = fs === 1;
    }
    // compass poses (walking ones: the climb/fall overrides below still win)
    let cpFull = 0;
    if (strK > 0.001 && !O) {
      const work = Math.sin(t * 10 + s) * 0.25;
      handB = mix(handB, [1.4 + work, s * 1.1, 1.6 + 0.3 * Math.abs(work)], strK);
      pole = mix(pole, torsoDir([-0.2, s, -0.4], tf), strK);
      cpFull = Math.max(cpFull, strK);
    }
    if (CP.rum > 0.001) {
      const dig = Math.sin(t * 9 + (s > 0 ? 0 : 1.9)), dig2 = Math.sin(t * 5.3 + s);
      const hT = torsoToBody([1.75 + 0.15 * dig2, s * 0.75, SPINE - 2.7 + 0.35 * dig], tf);
      handB = mix(handB, hT, CP.rum * CP.pack); pole = mix(pole, torsoDir([-0.3, s, -0.6], tf), CP.rum);
      cpFull = Math.max(cpFull, CP.rum * CP.pack);
    }
    if (CP.slot > 0.001) {
      // one hand out to the side, toward the slot (screen left of the explorer), holding it up
      const side = Math.sin(yaw) >= 0 ? 1 : -1;
      if (s === side) {
        const hT = [-Math.cos(yaw) * 2.6, Math.sin(yaw) * 3.0, HIP_H + SPINE - 1.4];
        handB = mix(handB, hT, CP.slot); pole = mix(pole, torsoDir([-0.4, s, -0.5], tf), CP.slot);
        cpFull = Math.max(cpFull, CP.slot);
      }
    }
    if (CP.dig > 0.001 && !O) {
      // reaching down into the sled / the dead one's pack / the pile in front, a hand at a time
      const dig = Math.sin(t * 5.5 + (s > 0 ? 0 : 2.4)), dig2 = Math.sin(t * 3.1 + s * 1.3);
      handB = mix(handB, [3.4 + 0.5 * dig2, s * 1.1, 0.9 + 0.7 * Math.max(0, dig)], CP.dig);
      pole = mix(pole, torsoDir([-0.2, s, -0.5], tf), CP.dig);
      cpFull = Math.max(cpFull, CP.dig);
    }
    if (CP.job > 0.001 && !O) {
      // at the pup tent: sweeping the canvas flat, a hand at a time (stage 0); one hand up on a pole,
      // the other steadying it (1); a fist hammering a stake in by the other hand holding it (2);
      // tugging the stakes out for a strike (3)
      const st = CP.stage;
      let hT;
      if (st === 3) { const pull = Math.max(0, Math.sin(t * 4.5 + (s > 0 ? 0 : 1.3))); hT = [3.1 - 0.9 * pull, s * 1.0, 0.7 + 1.1 * pull]; }
      else if (st === 0) { const sw = Math.sin(t * 3.4 + (s > 0 ? 0 : Math.PI)); hT = [3.5 + 0.5 * Math.cos(t * 3.4), s * (1.5 + 1.3 * sw), 0.6 + 0.35 * Math.max(0, sw)]; }
      else if (st === 1) hT = s > 0 ? [2.9, 0.8, 6.2 + 0.3 * Math.sin(t * 2)] : [2.7, -1.1, 3.0 + 0.3 * Math.sin(t * 2 + 1)];
      else hT = s > 0 ? [3.1, 0.9, 0.9 + 1.7 * Math.max(0, Math.sin(t * 8))] : [3.4, -0.4, 0.55];
      handB = mix(handB, hT, CP.job);
      pole = mix(pole, torsoDir([-0.2, s, -0.5], tf), CP.job);
      cpFull = Math.max(cpFull, CP.job);
    }
    if (CP.grab > 0.001 && !O) {
      // the wind's got it: both arms flung up and out after the canvas, clutching at it
      const cl = Math.sin(t * 13 + s * 2) * 0.35;
      handB = mix(handB, torsoToBody([2.1 + cl, s * 2.6, SPINE + HEAD_UP + 1.6 + cl], tf), CP.grab);
      pole = mix(pole, torsoDir([-0.3, s * 1.2, -0.2], tf), CP.grab);
      cpFull = Math.max(cpFull, CP.grab);
    }
    if (CP.eat > 0.001 && !O) {
      // eating: the ration out of the pack in both mitts (low, unwrapping it), then up to the
      // face, the mitts dipping a little with each bite
      const et = CP.eatT, up = smooth(0.35, 0.85, et) * (1 - smooth(2.7, 3.05, et));
      const unwrap = Math.sin(t * 9 + s) * 0.18 * (1 - up);
      const low = torsoToBody([1.7 + unwrap, s * 0.55, SPINE - 2.9], tf);
      const bite = Math.max(0, Math.sin(et * 7.5)) * 0.22;
      const mouth = torsoToBody([1.3 + bite, s * 0.32, SPINE + HEAD_UP - 0.95 - bite * 0.5 + 0.05 * chew], tf);
      handB = mix(handB, mix(low, mouth, up), CP.eat);
      pole = mix(pole, torsoDir([-0.3, s * 1.2, -0.7], tf), CP.eat);
      cpFull = Math.max(cpFull, CP.eat);
    }
    if (CP.drink > 0.001 && !O) {
      // drinking: both mitts at the chest unscrewing the cap (the near one turning it), then the
      // flask hand up to the mouth, tipped, the other low holding the cap
      const unscrew = 1 - smooth(0.5, 0.7, dT), turn = Math.sin(dT * 22) * 0.18 * unscrew;
      const chest = torsoToBody([1.55, s * 0.3 + (s < 0 ? turn : 0), SPINE - 1.7 + (s < 0 ? 0.35 + Math.abs(turn) : 0)], tf);
      const mouth = s > 0 ? torsoToBody([1.15, 0.28, SPINE + HEAD_UP - 0.75 + 0.15 * tipK], tf) : torsoToBody([1.4, -0.6, SPINE - 2.2], tf);
      handB = mix(handB, mix(chest, mouth, tipK), CP.drink);
      pole = mix(pole, torsoDir([-0.3, s * 1.2, -0.7], tf), CP.drink);
      cpFull = Math.max(cpFull, CP.drink);
    }
    if (CP.snow > 0.001 && !O) {
      // eating snow: the near mitt down into the snow in front for a scoop (a little dig), then up
      // to the mouth; the other on the thigh
      if (s > 0) {
        const dig = Math.sin(t * 8) * 0.3 * scoopK;
        const low = [3.3 + dig, 0.8, 0.85 + 0.4 * Math.max(0, dig)];
        const mouth = torsoToBody([1.3, 0.3, SPINE + HEAD_UP - 0.95 + 0.05 * chew], tf);
        handB = mix(handB, snowUp > 0.01 ? mix(low, mouth, snowUp / Math.max(0.01, CP.snow)) : low, CP.snow);
      } else handB = mix(handB, torsoToBody([1.6, -1.0, SPINE - 3.6], tf), CP.snow);
      pole = mix(pole, torsoDir([-0.3, s * 1.2, -0.6], tf), CP.snow);
      cpFull = Math.max(cpFull, CP.snow);
    }
    const hw = s > 0 ? hdw : hdw * headBoth;
    if (hw > 0.001 && !O) {
      // the headache: a mitt pressed to the temple, out at the side of the hood (a little forward,
      // so it shows over it), the elbow out and down, a slow rub; at first both mitts at once
      const rub = Math.sin(t * 1.6 + (s > 0 ? 0 : 1.2)) * 0.12;
      handB = mix(handB, torsoToBody([0.95 + rub, s * 1.75, SPINE + HEAD_UP + 0.35 + rub * 0.5], tf), hw);
      pole = mix(pole, torsoDir([-0.2, s * 1.4, -0.7], tf), hw);
      cpFull = Math.max(cpFull, hw);
    }
    if (thighW > 0.001 && s === badS && !O) {
      // badly hurt: the mitt pressed on the front of the bad thigh
      handB = mix(handB, [hx + 1.0, hr + s * 0.95, hz - 1.6], thighW);
      pole = mix(pole, torsoDir([-0.5, s * 1.2, -0.2], tf), thighW);
      cpFull = Math.max(cpFull, thighW);
    }
    if (stw > 0.001 && s < 0 && !O) {
      // hungry: the mitt pressed flat to the stomach
      handB = mix(handB, torsoToBody([1.25, -0.15, SPINE - 3.0], tf), stw);
      pole = mix(pole, torsoDir([-0.4, s * 1.1, -0.4], tf), stw);
      cpFull = Math.max(cpFull, stw);
    }
    if (CP.out > 0.001) {
      const shake = envW.wEff * 0.14;
      const hT = torsoToBody([1.55 + Math.sin(t * 27) * shake, s * 0.38 + Math.sin(t * 31 + 1) * shake, SPINE - 1.25 + Math.sin(t * 23 + 2) * shake], tf);
      handB = mix(handB, hT, CP.out); pole = mix(pole, torsoDir([-0.2, s * 1.1, -0.7], tf), CP.out);
      cpFull = Math.max(cpFull, CP.out);
    }
    // bent double: the hands braced just above the knees, arms locked straight; sat in the snow:
    // forearms laid over the drawn-up knees, the mitts hanging past them
    const kn = legs[s < 0 ? 0 : 1].knee;
    if (resW > 0.001 && !O) { handB = mix(handB, [kn[0] + 0.35, kn[1] * 1.05, kn[2] + 0.4], resW); pole = mix(pole, torsoDir([-1, s * 0.9, -0.2], tf), resW); }
    if (sitK > 0.001 && !O) { handB = mix(handB, [kn[0] + 0.45, kn[1] * 0.2, kn[2] - 0.9], sitK); pole = mix(pole, torsoDir([0.2, s * 1, -0.4], tf), sitK); }
    if (O) { handB = mix(handB, O.hands[s < 0 ? 0 : 1], ow); pole = mix(pole, O.poleA[s < 0 ? 0 : 1], ow); }
    const a = ik(shoulder, handB, UPPER_ARM, FOREARM, pole);
    const full = (O && ow > 0.5 && O.full) || cw > 0.4 || flung || (!O && cpFull > 0.4) || carryW > 0.5 || reachK > 0.3 || (!O && resW > 0.4);   // (sat: the arms stay inside the coat, wrapped round the knees)
    const active = full ? 1 : Math.max(spreadW, pose.hug, Math.max(0, pose.work - 0.3) * 1.4, shieldW, pose.creep);
    arms.push({ s, shoulder, elbow: a.joint, hand: a.end, active, spreadW, full, overHead, axe: O && O.axes ? O.axes * ow : 0, cp: !O && cpFull > 0.4, carry: carryW > 0.5 && reachK < 0.3, food: !O && s > 0 && CP.eat > 0.4 && CP.eatT > 0.2,
      flask: !O && s > 0 && CP.drink > 0.35 ? tipK : -1, snowball: !O && s > 0 && CP.snow > 0.4 && sT > 0.75 && sT < 2.3 ? 1 - smooth(1.5, 2.3, sT) : 0 });
  }

  // Head / hood. Thin ice: looking down at the feet.
  const hunch = pose.hunch + 0.45 * smooth(0.6, 0.15, warmth()) + 0.55 * droop;   // head sinks into the hood as they chill
  const head = torsoToBody([0.4 + hunch * 0.6 - 0.3 * tipK, jitR + 0.35 * hdw * (1 - 0.7 * headBoth), SPINE + HEAD_UP - 0.1 - hunch * 0.45 + upZ * 1.1 + 0.07 * chew], tf);
  const peak = torsoToBody([-0.85 + hunch * 0.5 + wdF * gk * 0.8, wdR * gk * 0.8, SPINE + HEAD_UP + 1.15 + upZ], tf);
  const drape = torsoToBody([-1.1, 0, SPINE - 0.5], tf);
  // (patting the pack: a glance back over that shoulder)
  const faceYaw = twist + pose.headYaw + (O && O.faceYaw ? O.faceYaw * ow : 0) + 0.9 * (patT > 0 ? Math.sin(clamp(1 - patT / PAT_S) * Math.PI) : 0);
  let facePitch = 0.15 + hunch; // head always bowed a little; 1 = looking at the feet
  if (cw > 0.001) facePitch = lerp(facePitch, 0.9, cw);
  if (kw > 0.001) facePitch = lerp(facePitch, 1.0, kw);   // kneeling: head hung
  facePitch = lerp(facePitch, 1.15, resW);                 // bent double: head down
  facePitch = lerp(facePitch, 1.3, sitK);                  // sat spent: the hood down on the knees
  facePitch = lerp(facePitch, 0.95, Math.max(CP.rum, CP.out * 0.85, strK, CP.dig * 0.9));
  facePitch = lerp(facePitch, 0.4 + 0.06 * chew, eatK);    // eating: head up a little to the food
  facePitch = lerp(facePitch, CP.stage === 1 ? 0.55 : 0.9, CP.job);   // at the pup tent: on the work (up at the pole)
  facePitch = lerp(facePitch, 0.05, CP.grab);              // ...and up after it as it goes
  facePitch = lerp(facePitch, 1.0, stw * 0.6);             // hungry: looking down at it
  facePitch = lerp(facePitch, 1.05, hdw * 0.7);            // the headache: bowed into the mitt
  facePitch = lerp(facePitch, 0.0, tipK);                  // drinking: the head tipped back
  facePitch = lerp(facePitch, 1.1, scoopK);                // the scoop: looking down at the snow
  // thin ice creaking: a quick glance down at the feet
  if (glanceT > 0) facePitch = lerp(facePitch, 1.35, Math.sin(Math.PI * (1 - glanceT / GLANCE_S)));
  if (O) facePitch = lerp(facePitch, O.facePitch, ow);

  // Coat rings
  const top = [], hem = [];
  const wAmt = pose.windAmt;
  const hemC = [lerp(hx, shoulderC[0], 0.4) + hemS.f, lerp(hr, shoulderC[1], 0.5) + hemS.r + g * 0.18 * Math.sin(ph2 - 0.9), hz - HEM_DROP + hemS.z];
  const hemYaw = twist * 0.5;
  for (let i = 0; i < N; i++) {
    const phi = (i / N) * Math.PI * 2;
    const cf = Math.cos(phi), cr = Math.sin(phi);
    // squarish shoulders: superellipse
    const se = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
    const tp = torsoToBody([se(cf, 0.7) * SH_F - 0.1, se(cr, 0.55) * SH_R + jitR, SPINE - 0.05 + upZ - Math.pow(Math.abs(cr), 6) * 0.35], tf);
    // leaning forward would tip the back of the shoulders up behind the hood: keep the back down
    tp[2] -= Math.max(0, -cf) * SH_F * Math.max(0, Math.sin(leanF)) * 1.6;
    top.push(tp);

    const uf = Math.cos(phi + hemYaw), ur = Math.sin(phi + hemYaw);
    const wx = Math.cos(phi + hemYaw + yaw);  // world east component of this hem direction
    const rf = HEM_F + g * pose.stepEff * 0.05 + (uf < 0 ? 0.2 : 0), rr = HEM_R + Math.max(0, -wx) * 0.3;
    let pf = hemC[0] + uf * rf, pr = hemC[1] + ur * rr, pz = hemC[2];
    // the hem swings in a travelling wave
    const wave = Math.sin(t * 5.5 - phi * 2) * (0.07 + 0.12 * g) + Math.sin(t * 9.1 + phi * 3) * 0.04;
    pf += uf * wave; pr += ur * wave;
    pz += Math.sin(t * 4.3 - phi * 2 + 1) * 0.06 * (0.3 + g);
    for (const L of legs) {
      const kf = L.knee[0] - hemC[0], kr = L.knee[1] - hemC[1];
      const kd = Math.hypot(kf, kr) || 1;
      const w = Math.pow(Math.max(0, (kf * uf + kr * ur) / kd), 3);
      const reach = kf * uf + kr * ur + 0.45 - Math.hypot(uf * rf, ur * rr);
      // on the wall the coat hangs straight and the frog-splayed knees poke out past it
      if (reach > 0) { const k = 1 - 0.8 * climbW; pf += uf * reach * w * k; pr += ur * reach * w * k; }
      const lift = L.knee[2] - (hemC[2] + 0.4);
      if (lift > 0) pz += lift * w * (0.85 - 0.5 * climbW);
    }
    for (const A of arms) {
      const an = Math.hypot(A.hand[0] - hemC[0], A.hand[1] - hemC[1]) > Math.hypot(A.elbow[0] - hemC[0], A.elbow[1] - hemC[1]) ? A.hand : A.elbow;
      const af = an[0] - hemC[0], ar = an[1] - hemC[1];
      const ad = Math.hypot(af, ar) || 1;
      const lat = Math.abs(ar) / ad;
      const w = Math.pow(Math.max(0, (af * uf + ar * ur) / ad), 4) * (0.35 + 0.65 * lat) * A.spreadW;
      const reach = (af * uf + ar * ur) + 0.4 - Math.hypot(uf * rf, ur * rr);
      if (reach > 0) { pf += uf * reach * w * 0.55; pr += ur * reach * w * 0.55; }
      const rise = an[2] - 2.6 - pz;
      if (rise > 0) pz += rise * w * lat * 0.6;
    }
    // wind: the downwind side trails out in ragged flapping tongues; the upwind side presses in
    const dw = uf * wdF + ur * wdR;
    if (dw > 0) {
      const tongue = (i % 2 ? 1 : 0.55) * (0.75 + 0.45 * Math.sin(i * 2.7));
      const flap = 0.75 + 0.35 * Math.sin(t * 13 + i * 2.1) + 0.2 * Math.sin(t * 23 - i * 1.3);
      const amt = wAmt * Math.pow(dw, 1.4) * tongue * flap;
      pf += wdF * amt * 2.0; pr += wdR * amt * 2.0;
      pz += amt * 0.9;
    } else {
      pf += uf * dw * wAmt * 0.35; pr += ur * dw * wAmt * 0.35;
    }
    // coat pulled tight when cowering; when lying down it follows the body, not gravity
    if (cw > 0.001) { pf = lerp(pf, hemC[0] + (pf - hemC[0]) * 0.85, cw); pr = lerp(pr, hemC[1] + (pr - hemC[1]) * 0.85, cw); }
    // sat in the snow: the coat skirt pooled flat on the snow round the hips
    if (sitK > 0.001) {
      // (a rounded mound over the drawn-up knees: only the boot soles show at its front edge)
      const k = 0.9 * sitK;
      pf = lerp(pf, hx + 0.9 + uf * rf * (uf > 0 ? 1.55 : 1.15), k); pr = lerp(pr, hr + ur * rr * 1.1, k); pz = lerp(pz, 0.15, k);
    }
    if (O && O.hemAttach > 0) {
      const att = torsoToBody([uf * rf * 0.85, ur * rr * 0.8, -2.3], tf);
      const k = O.hemAttach * ow;
      pf = lerp(pf, att[0], k); pr = lerp(pr, att[1], k); pz = lerp(pz, att[2], k);
    }
    hem.push([pf, pr, Math.max(0.12, pz)]);
  }

  // Small rucksack on the back.
  const pack = [];
  for (const [f, r, z] of [[-1.0, -0.8, 2.4], [-1.0, 0.8, 2.4], [-1.0, 0.8, 0.8], [-1.0, -0.8, 0.8],
    [-1.4, -0.72, 2.3], [-1.4, 0.72, 2.3], [-1.4, 0.72, 0.95], [-1.4, -0.72, 0.95]]) {
    // rummaging: off one shoulder and round the side to the front, held low by the hands
    const k = smooth(0, 1, CP.pack), th = Math.PI * k;
    const c = Math.cos(th), sn = Math.sin(th);
    const pf = (f * c - r * sn + 0.55 * k) * (1 - 0.35 * resW), prr = f * sn + r * c, pz = z - 1.5 * k + 0.5 * Math.sin(th) + 0.7 * resW;
    pack.push(torsoToBody([pf, prr, pz], tf));
  }

  return { yaw, legs, arms, head, peak, drape, faceYaw, facePitch, top, hem, pack, shoulderC, hips: [hx, hr, hz], tf, sinkNow, hemC, twist, hemYaw, lying: O ? O.hemAttach * ow : 0, climbing: O && O.full && P.mode === 'climb' ? ow : 0, shadowOff };
}

// --- drawing helpers -----------------------------------------------------------------------------
// Dense closed polyline through pts, smoothed with midpoint quadratics, sharp at `sharp` indices.
function dense(pts, sharp, steps = 4) {
  const n = pts.length, out = [];
  const q = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (let i = 0; i < n; i++) {
    const p = pts[i], prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    if (sharp && sharp.has(i)) { out.push(p); continue; }
    const a = sharp && sharp.has((i - 1 + n) % n) ? prev : mid(prev, p);
    const b = sharp && sharp.has((i + 1) % n) ? next : mid(p, next);
    for (let k = 0; k < steps; k++) out.push(q(a, p, b, k / steps));
  }
  return out;
}
function polyPath(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
// Hand-inked outline: width follows the edge direction — none on lit upper-left edges,
// heaviest on the shadowed lower-right. Consecutive segments of equal width share a path.
function inkOutline(ctx, pts, wMin = 0.12, wMax = 0.36, closed = true) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  const n = pts.length, m = closed ? n : n - 1;
  let cur = -1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    const lr = nx * 0.55 + ny * 0.83;               // facing lower-right
    let w = lr < -0.35 ? 0 : wMin + (wMax - wMin) * clamp((lr + 0.35) / 1.2);
    w = Math.round(w * 25) / 25;
    if (w !== cur) {
      if (cur > 0) ctx.stroke();
      cur = w;
      if (w > 0) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineWidth = w; }
    }
    if (w > 0) ctx.lineTo(b[0], b[1]);
  }
  if (cur > 0) ctx.stroke();
}
// Hard light/dark split: everything to the right of the line a->b (extended) goes dark.
function darkSide(ctx, clipPts, a, b, alpha = 0.62, soft = 0.4, rgb = DEEP) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const A = [a[0] - ux * 30, a[1] - uy * 30], B = [b[0] + ux * 30, b[1] + uy * 30];
  // right-hand normal (screen): (-uy, ux) or (uy, -ux) — pick the one pointing +x
  let nx = -uy, ny = ux; if (nx < 0) { nx = -nx; ny = -ny; }
  ctx.save();
  ctx.beginPath(); polyPath(ctx, clipPts); ctx.clip();
  const quad = off => { ctx.beginPath(); ctx.moveTo(A[0] + nx * off, A[1] + ny * off); ctx.lineTo(B[0] + nx * off, B[1] + ny * off); ctx.lineTo(B[0] + nx * 40, B[1] + ny * 40); ctx.lineTo(A[0] + nx * 40, A[1] + ny * 40); ctx.closePath(); };
  if (soft > 0) { quad(-soft); ctx.fillStyle = `rgba(${rgb},${alpha * 0.3})`; ctx.fill(); }
  quad(0); ctx.fillStyle = `rgba(${rgb},${alpha})`; ctx.fill();
  ctx.restore();
}
function ringArcIdx(pts, upper) {
  const n = pts.length;
  let lo = 0, hi = 0;
  for (let i = 1; i < n; i++) { if (pts[i][0] < pts[lo][0]) lo = i; if (pts[i][0] > pts[hi][0]) hi = i; }
  const arcA = [], arcB = [];
  for (let i = lo; ; i = (i + 1) % n) { arcA.push(i); if (i === hi) break; }
  for (let i = hi; ; i = (i + 1) % n) { arcB.push(i); if (i === lo) break; }
  const avg = a => a.reduce((s, i) => s + pts[i][1], 0) / a.length;
  const B = arcB.slice().reverse();
  return (avg(arcA) < avg(B)) === upper ? arcA : B;   // left -> right
}
function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
function limb(ctx, pts, w, col, inkW = 0.2) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  line(); ctx.strokeStyle = INK; ctx.lineWidth = w + inkW * 2; ctx.stroke();
  line(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
// Interpolated ring point at body angle phi (ring sampled at N even angles).
function ringAt(ring, phi) {
  let u = ((phi / (Math.PI * 2)) % 1 + 1) % 1 * N;
  const i = Math.floor(u) % N, j = (i + 1) % N, f = u - Math.floor(u);
  return mix(ring[i], ring[j], f);
}

// --- cast shadow ------------------------------------------------------------------------------------
const SH_RES = 1.5, SH_W = 40, SH_H = 28, SH_OX = 12, SH_OY = 10;
const SHX = 0.4, SHY = 0.22;
let shCan = null, shCtx = null;
function drawShadow(ctx, rig, X, Y) {
  if (!shCan) {
    shCan = document.createElement('canvas');
    shCan.width = Math.ceil(SH_W * SH_RES); shCan.height = Math.ceil(SH_H * SH_RES);
    shCtx = shCan.getContext('2d');
  }
  const c = shCtx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, shCan.width, shCan.height);
  c.setTransform(SH_RES, 0, 0, SH_RES, SH_OX * SH_RES, SH_OY * SH_RES);
  const sp = v => { const w = toWorld(v, rig.yaw); const z = Math.max(0, w.z); return [w.x + z * SHX, w.y + z * SHY]; };
  c.fillStyle = '#000'; c.strokeStyle = '#000'; c.lineCap = 'round';
  const hull = convexHull([...rig.top.map(sp), ...rig.hem.map(sp), sp(rig.head), sp(rig.peak)]);
  c.beginPath(); hull.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill();
  const h = sp(rig.head);
  c.beginPath(); c.ellipse(h[0], h[1], HOOD_R * 1.1, HOOD_R * 0.8, 0.5, 0, Math.PI * 2); c.fill();
  c.lineWidth = 1.1;
  for (const L of rig.legs) {
    const a = sp(L.hip), b = sp(L.knee), d = sp(L.ankle);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.stroke();
  }
  c.lineWidth = 0.9;
  for (const A of rig.arms) {
    if (A.active < 0.3) continue;
    const a = sp(A.shoulder), b = sp(A.elbow), d = sp(A.hand);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.stroke();
  }
  ctx.save();
  ctx.globalAlpha = 0.34 * (1 - rig.shadowOff);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shCan, X - SH_OX, Y - SH_OY, SH_W, SH_H);
  ctx.restore();
  // dark contact shadow right under the boots
  ctx.fillStyle = `rgba(30,31,34,${0.28 * (1 - rig.shadowOff)})`;
  if (rig.shadowOff < 0.99) for (const L of rig.legs) {
    const f = toWorld([L.foot[0], L.foot[1], 0], rig.yaw);
    ctx.beginPath(); ctx.ellipse(X + f.x + 0.4, Y + f.y + 0.2, 1.1, 0.48, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// --- the figure -------------------------------------------------------------------------------------
// hex '#rrggbb' -> [r, g, b]; rgba string; mix toward another colour
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixHex = (h1, h2, t) => '#' + hexRGB(h1).map((v, i) => Math.round(v + (hexRGB(h2)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const C = {
  // the signal yellow (js/palette.js): the explorer is what to watch
  coat: SIGNAL.lit, panel: mixHex(SIGNAL.lit, '#f4efe4', 0.6), hood: SIGNAL.lit, rim: mixHex(SIGNAL.lit, '#f4efe4', 0.45),
  trousersL: '#2c2c2e', trousersD: '#1b1b1d', boot: '#151515', mitt: '#1e1e20',
  sleeveL: SIGNAL.lit, sleeveD: SIGNAL.shadow, face: '#121418', nose: '#7c7c7c',
  pack: '#3e3e3c',
};
const DEEP = hexRGB(SIGNAL.deep).join(',');      // shading and creases on the yellow cloth

const C0 = { ...C };
const NOCLIP = state.params.get('noclip') === '1';   // debug: disable the arm clip
// Coat colours drained toward a cool grey ochre (lightness kept, most of the hue gone), by
// d = 0..1 in steps of 0.05, cached.
const dullCache = new Map();
function dullCoat(d) {
  let o = dullCache.get(d);
  if (o) return o;
  o = {};
  for (const k of Object.keys(C0)) {
    const [r, g, b] = hexRGB(C0[k]), L = 0.3 * r + 0.59 * g + 0.11 * b;
    const grey = [L * 1.02 + 4, L * 0.98 + 1, L * 0.86 - 2].map(v => Math.round(Math.max(0, Math.min(255, v * 0.93))));
    const t = d * 0.62;            // never all the way: a trace of ochre always stays findable
    o[k] = '#' + [r, g, b].map((v, i) => Math.round(v + (grey[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  dullCache.set(d, o);
  return o;
}
const wetCache = new Map();
function wetCoat(dl, wq) {
  const key = dl * 100 + wq;
  let o = wetCache.get(key);
  if (o) return o;
  const src = dl ? dullCoat(dl) : C0;
  o = {};
  for (const k of Object.keys(src)) {
    const [r, g, b] = hexRGB(src[k]), t = wq * 0.7;
    const tg = [r * 0.6, g * 0.5, b * 0.36];            // darker and richer: wet canvas
    o[k] = '#' + [r, g, b].map((v, i) => Math.round(v + (tg[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  wetCache.set(key, o);
  return o;
}
// Rime on the coat: frozen wet cloth. A pale frosting, white specks, a crust along the hem.
// Patches of rime fixed on the cloth (body angle phi round the coat, v from shoulder 0 to
// hem 1), so they move with the coat instead of crawling: crusted on the shoulders and the
// hem, where the wet froze first; a few on the body.
const RIME_PTS = Array.from({ length: 34 }, (_, i) => {
  const h = k => { const a = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return a - Math.floor(a); };
  const band = h(3), v = band < 0.4 ? 0.04 + h(2) * 0.16 : band < 0.8 ? 0.82 + h(2) * 0.16 : 0.25 + h(2) * 0.5;
  return [(h(1) - 0.5) * Math.PI * 2, v, 0.16 + 0.16 * h(4), h(5)];
});
function drawRime(ctx, poly, lower, upper, fz, rig, pr, facingCam) {
  ctx.save();
  ctx.beginPath(); polyPath(ctx, poly); ctx.clip();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  ctx.fillStyle = `rgba(232,238,244,${0.28 * fz})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // the crust: a pale frozen band along the shoulders and a thicker one along the hem
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const band = (pts, w, a, dy) => {
    if (!pts || pts.length < 2) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] + dy);
    for (const [x, y] of pts) ctx.lineTo(x, y + dy);
    ctx.lineWidth = w; ctx.strokeStyle = `rgba(246,248,250,${a})`; ctx.stroke();
  };
  band(upper, 0.4 + 0.7 * fz, 0.75 * fz, 0.35);
  band(lower, 0.5 + 0.9 * fz, 0.85 * fz, -0.2);
  // patches on the cloth we can see: one path, one fill (grey underside first)
  const n = Math.round(RIME_PTS.length * fz), spots = [];
  for (let i = 0; i < n; i++) {
    const [phi, v, r, j] = RIME_PTS[i];
    if (facingCam(phi) < 0.1) continue;
    spots.push([pr(mix(ringAt(rig.top, phi), ringAt(rig.hem, phi), v)), r * (0.7 + 0.5 * fz), j]);
  }
  const blot = (dx, dy, k) => {
    ctx.beginPath();
    for (const [[x, y], r, j] of spots) { ctx.moveTo(x + dx + r * k, y + dy); ctx.ellipse(x + dx, y + dy, r * k, r * k * (0.6 + 0.3 * j), 0, 0, Math.PI * 2); }
  };
  blot(0.08, 0.1, 1); ctx.fillStyle = 'rgba(150,156,164,0.55)'; ctx.fill();
  blot(0, 0, 1); ctx.fillStyle = 'rgba(250,251,252,0.95)'; ctx.fill();
  ctx.restore();
}
const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - k).toString(16).padStart(2, '0')).join('');
function drawFigure(ctx, rig, X, Y) {
  const yaw = rig.yaw;
  const dk = Math.round(6 * cowerW);       // cowering hump separates from the whiteout
  // the cold takes the colour out of the coat: signal yellow dulls toward a grey ochre
  const dl = Math.round(smooth(0.66, 0.0, warmth()) * 20) / 20;
  // soaked, the cloth goes a deeper, darker ochre (still warm in hue: not the cold grey)
  const wq = Math.round(clamp(state.body?.wet || 0) * 10) / 10;
  const base = wq ? wetCoat(dl, wq) : dl ? dullCoat(dl) : C0;
  for (const k of ['coat', 'panel', 'hood', 'rim', 'sleeveL', 'sleeveD', 'pack']) C[k] = dk ? shade(base[k], dk) : base[k];
  const pr = v => { const w = toWorld(v, yaw); return [X + w.x, Y + w.y - w.z]; };
  const depth = v => toWorld(v, yaw).g;
  const cxBody = pr(rig.hips)[0];
  if (sitW > 0.05) {
    // sat in the snow: a dark contact shadow pressed in under the seat
    const q = pr([rig.hips[0] + 0.8, rig.hips[1], 0]);
    ctx.beginPath(); ctx.ellipse(q[0] + 0.3, q[1] + 0.35, 3.6, 1.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(62,64,70,${0.32 * sitW})`; ctx.fill();
  }

  // --- legs ---------------------------------------------------------------------------------
  const legs = rig.legs.slice().sort((a, b) => depth(a.ankle) - depth(b.ankle));
  const lips = [];
  if (rig.sinkNow >= 0.8) for (const L of legs) {
    if (L.ankle[2] >= 0.25) continue;
    const p = pr([L.knee[0] * 0.3 + L.ankle[0] * 0.7, L.ankle[1], 0]);
    ctx.beginPath(); ctx.ellipse(p[0], p[1], 1.0, 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(105,108,112,0.5)'; ctx.fill();
  }
  if (shoesDrawn()) for (const L of legs) drawShoe(ctx, L, pr);
  for (const L of legs) {
    const ank = L.ankle, knee = L.knee;
    const buried = L.foot[2] < -0.2 && rig.sinkNow >= 0.8;
    let endPt = ank;
    if (ank[2] < 0.25 && rig.sinkNow >= 0.8) {
      const t = clamp((knee[2] - 0.25) / Math.max(0.01, knee[2] - ank[2]));
      endPt = [lerp(knee[0], ank[0], t), lerp(knee[1], ank[1], t), 0.25];
    }
    const pts = [pr(L.hip), pr(knee), pr(endPt)];
    const lit = pts[1][0] < cxBody;
    limb(ctx, pts, 0.95, lit ? C.trousersL : C.trousersD, 0.17);
    // splinted (body.splint): a pale bandage bound round the bad shin, a couple of turns showing
    if (state.body?.splint && L.s === badS && !buried) {
      const a = pr(mix(knee, endPt, 0.25)), b = pr(mix(knee, endPt, 0.8));
      limb(ctx, [a, b], 1.2, '#e9e5da', 0.14);
      ctx.strokeStyle = 'rgba(120,114,100,0.7)'; ctx.lineWidth = 0.09; ctx.beginPath();
      for (const t of [0.35, 0.55, 0.72]) { const c = pr(mix(knee, endPt, t)); ctx.moveTo(c[0] - 0.5, c[1] - 0.12); ctx.lineTo(c[0] + 0.5, c[1] + 0.12); }
      ctx.stroke();
    }
    if (!buried) {
      const fc = [ank[0] - 0.1, ank[1], ank[2] - 0.2];
      let toe = [ank[0] + 0.7, ank[1], Math.max(L.foot[2] + 0.2, ank[2] - 0.35)];
      if (sitW > 0.01) toe = mix(toe, [ank[0] + 0.3, ank[1], ank[2] + 0.9], sitW);   // sat: toes up
      limb(ctx, [pr(fc), pr(toe)], 0.95, C.boot, 0.17);
      if (sitW > 0.5) {
        // the worn grey soles, turned to the camera
        const q = pr([ank[0] + 0.55, ank[1], ank[2] + 0.45]);
        ctx.globalAlpha = smooth(0.5, 0.9, sitW);
        ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.42, 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#7a7b7e'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.13; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (crampOn() && !shoesDrawn()) {
        // crampons: a steel frame under the sole with points at the toe and along the sides
        const sole = k => [lerp(fc[0] - 0.15, toe[0] + 0.2, k), ank[1], lerp(fc[2], toe[2], k) - 0.5];
        const a = pr(sole(0)), b = pr(sole(1));
        ctx.lineCap = 'round'; ctx.strokeStyle = '#3c4046'; ctx.lineWidth = 0.16;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.strokeStyle = '#1c1e22'; ctx.lineWidth = 0.1; ctx.beginPath();
        for (const k of [0, 0.33, 0.66, 1]) {
          const q = pr(sole(k));
          for (const sd of [-0.42, 0.42]) { const r = pr([sole(k)[0], ank[1] + sd, sole(k)[2]]); ctx.moveTo(r[0], r[1]); ctx.lineTo(r[0], r[1] + 0.32); }
          ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] + 0.3);
        }
        const t2 = pr(sole(1.12)); ctx.moveTo(b[0], b[1]); ctx.lineTo(t2[0] + 0.1, t2[1] + 0.2);   // front points
        ctx.stroke();
      }
    } else lips.push(endPt);
  }


  // --- arms: under the coat; forearms that come out are drawn again on top ---------------------
  const arms = rig.arms.map(A => ({ ...A, d: depth(A.shoulder), dh: depth(A.hand) }));
  const headD = depth(rig.head);
  const inSea = P.mode === 'swim' || P.mode === 'sink';
  const mitt = (h, from) => {
    if (inSea && from && from[1] - h[1] > 0.6) {
      // raised in the water: a bigger open mitt, the thumb sticking out to one side
      const dx = h[0] - from[0], dy = h[1] - from[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const ang = Math.atan2(uy, ux);
      ctx.beginPath(); ctx.ellipse(h[0] + ux * 0.2, h[1] + uy * 0.2, 0.8, 0.58, ang, 0, Math.PI * 2);
      ctx.moveTo(h[0] - uy * 0.75 + 0.3, h[1] + ux * 0.75); ctx.ellipse(h[0] - uy * 0.7 - ux * 0.05, h[1] + ux * 0.7 - uy * 0.05, 0.36, 0.22, ang + 0.9, 0, Math.PI * 2);
      ctx.fillStyle = C.mitt; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.15; ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.ellipse(h[0], h[1], 0.5, 0.46, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.mitt; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.15; ctx.stroke();
  };
  const sleeveCol = p => (p[0] < cxBody ? C.sleeveL : C.sleeveD);
  // Occlusion: an arm whose hand is further from the camera than the body (walking away, or
  // reaching up a wall) is drawn BEFORE the coat, so the coat hides whatever is behind it and only
  // the parts beyond the silhouette show. Hands on our side of the body go over the coat.
  const bodyD = depth(rig.shoulderC);
  for (const A of arms) A.behind = A.dh < bodyD - 0.25;
  const drawArm = A => {
    const pts = [pr(A.shoulder), pr(A.elbow), pr(A.hand)];
    if (A.carry) drawAxeCarry(ctx, A, pr);
    limb(ctx, pts, 1.15, sleeveCol(pts[1]));
    if (A.axe > 0.3) drawAxe(ctx, A, pr);
    mitt(pts[2], pts[1]);
    if (A.food) drawRation(ctx, pts[2]);
    if (A.flask >= 0) drawFlaskHeld(ctx, pts[2], pts[1], A.flask);
    if (A.snowball > 0.02) drawSnowball(ctx, pts[2], A.snowball);
  };
  const drawForearm = A => {
    const from = mix(A.elbow, A.hand, A.spreadW > 0.5 ? 0.25 : lerp(0.45, 0.12, pose.hug));
    const pts = [pr(from), pr(A.hand)];
    limb(ctx, pts, 0.85, sleeveCol(pts[1]));
    if (A.axe > 0.3) drawAxe(ctx, A, pr);
    mitt(pts[1], pts[0]);
  };
  // Walking poses drawn under the coat are clipped below the shoulder line, so a raised far arm
  // (shielding the face, balancing) can never poke up past the shoulders or behind the hood.
  const shTop = Math.min(...rig.top.map(v => pr(v)[1])) + 0.6;
  // Walking poses: only the near arm may break the coat outline; the far one stays under it.
  const nearS = arms[0].d >= arms[1].d ? arms[0].s : arms[1].s;
  // Seen from behind, a working forearm/mitt at the coat edge reads as a stub sticking out of the
  // jacket: keep walking arms inside the coat (only a slip's flailing arms break out).
  const fromBehind = Math.sin(P.facing) < -0.3;
  for (const A of arms) A.hidden = !A.full && (A.s !== nearS || A.d < -0.45 || (fromBehind && slipT <= 0));
  // carried axes: the far-side one is drawn under the coat only (never over the back)
  for (const A of arms) A.under = A.carry && A.s !== nearS;
  for (const A of arms) {
    if (A.behind) { if (A.full && !(A.cp && fromBehind)) drawArm(A); continue; }   // never drawn on the back
    if (A.cp && fromBehind) continue;   // compass hands in front: hidden by the body from behind
    if (A.hidden) continue;
    if (A.full) drawArm(A);
    else if (A.spreadW > 0.3 || (A.s === pose.shieldSide && pose.shield > 0.3)) {
      if (NOCLIP) drawArm(A);
      else { ctx.save(); ctx.beginPath(); ctx.rect(X - 40, shTop, 80, 80); ctx.clip(); drawArm(A); ctx.restore(); }
    }
  }

  const packD = depth(rig.pack[4]);
  const packOn = sitW < 0.5;   // (sat huddled: the rucksack is lost in the coat)
  if (packD < 0 && packOn) drawPack(ctx, rig, pr);

  drawCoat(ctx, rig, pr, depth);

  if (packD >= 0 && packOn) drawPack(ctx, rig, pr);
  const out = arms.filter(A => !A.behind && !A.hidden && !A.under && !(A.cp && fromBehind) && A.active > 0.3);
  for (const A of out) if (!A.overHead && A.dh <= headD + 0.6) (A.full ? drawArm(A) : drawForearm(A));
  drawHood(ctx, rig, pr);
  for (const A of out) if (A.overHead || A.dh > headD + 0.6) (A.full ? drawArm(A) : drawForearm(A));
}

// A snowshoe under each boot: a long teardrop frame lying flat, its round toe ~1.2u ahead of
// the boot tip and its tail ~2u behind the heel (~4 x 1.7u). Pale bent-wood frame, paler
// rawhide webbing cross-hatched, dark ink outline: it reads against the black boot and, by its
// outline, on white snow. It rides up with the foot when the foot is lifted.
const SHOE_FRAME = '#c9b48a', SHOE_WEB = '#e2d6b8';
function shoeOutline(fn) {           // teardrop in shoe-local coords: x forward (toe +), y across
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const w = c > 0 ? 1.0 : 1.0 * (1 + c * 0.72);   // wider than the boot so it shows beside it front-on
    fn(c > 0 ? c * 1.9 : c * 2.4, sn * w);
  }
}
function drawShoe(ctx, L, pr) {
  const z = Math.max(L.foot[2], -0.25) + 0.05, cx = L.ankle[0] + 0.3, cy = L.foot[1];
  const out = [], inn = [];
  shoeOutline((x, y) => { out.push(pr([cx + x, cy + y, z])); inn.push(pr([cx + x * 0.8 + 0.08, cy + y * 0.66, z])); });
  ctx.beginPath(); polyPath(ctx, out); ctx.fillStyle = SHOE_FRAME; ctx.fill();
  ctx.lineWidth = 0.2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); polyPath(ctx, inn); ctx.fillStyle = SHOE_WEB; ctx.fill();
  ctx.lineWidth = 0.08; ctx.strokeStyle = 'rgba(70,52,30,0.7)'; ctx.stroke();
  // cross-hatched webbing
  ctx.save(); ctx.beginPath(); polyPath(ctx, inn); ctx.clip();
  ctx.strokeStyle = 'rgba(110,86,52,0.85)'; ctx.lineWidth = 0.075; ctx.beginPath();
  for (let k = -6; k <= 5; k++) {
    const a = pr([cx + k * 0.42 - 0.9, cy - 1, z]), b = pr([cx + k * 0.42 + 0.9, cy + 1, z]);
    const c2 = pr([cx + k * 0.42 + 0.9, cy - 1, z]), d = pr([cx + k * 0.42 - 0.9, cy + 1, z]);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]);
  }
  ctx.stroke(); ctx.restore();
  // cross bars fore and aft of the binding
  ctx.strokeStyle = '#8a7350'; ctx.lineWidth = 0.14; ctx.beginPath();
  for (const bx of [0.75, -0.75]) {
    const t0 = pr([cx + bx, cy - 0.72, z]), t1 = pr([cx + bx, cy + 0.72, z]);
    ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]);
  }
  ctx.stroke();
}

// Ice axe in the ink style: a short shaft continuing the forearm, the pick biting into the wall.
function drawAxe(ctx, A, pr) {
  const d = [A.hand[0] - A.elbow[0], A.hand[1] - A.elbow[1], A.hand[2] - A.elbow[2]];
  const l = Math.hypot(...d) || 1, n = [d[0] / l, d[1] / l, d[2] / l];
  const at = k => [A.hand[0] + n[0] * k, A.hand[1] + n[1] * k, A.hand[2] + n[2] * k];
  const top = at(1.8), bot = at(-0.4);                       // 2.2u shaft
  const pick = [top[0] + 0.7, top[1], top[2] - 0.4];          // 0.8u pick, drooping into the ice
  const adze = [top[0] - 0.45, top[1], top[2] + 0.05];
  const P0 = pr(bot), P1 = pr(top), Pk = pr(pick), Pa = pr(adze);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1a1a';
  ctx.beginPath(); ctx.moveTo(P0[0], P0[1]); ctx.lineTo(P1[0], P1[1]); ctx.lineWidth = 0.32; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Pa[0], Pa[1]); ctx.lineTo(P1[0], P1[1]); ctx.lineTo(Pk[0], Pk[1]); ctx.lineWidth = 0.34; ctx.stroke();
}

// An ice axe carried in the hand: head in the fist (pick forward, adze back), the shaft hanging
// down by the thigh. Same ink style as the climbing axes.
function drawAxeCarry(ctx, A, pr) {
  const h = A.hand;
  const top = [h[0] + 0.05, h[1], h[2] + 0.35], bot = [h[0] + 0.4, h[1] + Math.sign(h[1]) * 0.1, h[2] - 2.6];
  const pick = [top[0] + 1.0, top[1], top[2] - 0.45], adze = [top[0] - 0.55, top[1], top[2] + 0.05];
  const P0 = pr(bot), P1 = pr(top), Pk = pr(pick), Pa = pr(adze);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1a1a';
  ctx.beginPath(); ctx.moveTo(P1[0], P1[1]); ctx.lineTo(P0[0], P0[1]); ctx.lineWidth = 0.38; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Pa[0], Pa[1]); ctx.lineTo(P1[0], P1[1]); ctx.lineTo(Pk[0], Pk[1]); ctx.lineWidth = 0.42; ctx.stroke();
}

// Drinking: the flask in the mitt (screen px of the hand and elbow; tip 0..1): upright at the chest,
// tipped over toward the face at the mouth. A small grey steel bottle, inked, the felt band dark.
function drawFlaskHeld(ctx, h, el, tip) {
  const ux = h[0] - el[0], uy = h[1] - el[1], l = Math.hypot(ux, uy) || 1;
  // upright (screen up), turning to lie along the forearm past the mitt as it's tipped up
  const ang = lerp(-Math.PI / 2, Math.atan2(uy / l, ux / l) + Math.PI * 0.15 * Math.sign(ux || 1), tip);
  ctx.save();
  ctx.translate(h[0], h[1] - 0.2 * (1 - tip));
  ctx.rotate(ang + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-0.38, 0.45); ctx.lineTo(-0.38, -0.55); ctx.quadraticCurveTo(-0.38, -0.85, -0.12, -0.9);
  ctx.lineTo(-0.12, -1.1); ctx.lineTo(0.12, -1.1); ctx.lineTo(0.12, -0.9); ctx.quadraticCurveTo(0.38, -0.85, 0.38, -0.55);
  ctx.lineTo(0.38, 0.45); ctx.closePath();
  ctx.fillStyle = '#9fa1a5'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.12; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#56534e'; ctx.fillRect(-0.38, -0.25, 0.76, 0.3);
  ctx.restore();
}
// Eating snow: a pale clump of it in the mitt, getting smaller as it's eaten (k 1..0).
function drawSnowball(ctx, h, k) {
  const r = 0.28 + 0.32 * k;
  ctx.beginPath(); ctx.ellipse(h[0] + 0.1, h[1] - 0.38, r * 1.15, r, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#fbfbfa'; ctx.fill();
  ctx.strokeStyle = 'rgba(38,38,38,0.8)'; ctx.lineWidth = 0.1; ctx.stroke();
  ctx.fillStyle = 'rgba(150,156,164,0.6)';
  ctx.beginPath(); ctx.ellipse(h[0] + 0.18, h[1] - 0.3, r * 0.8, r * 0.38, 0.2, 0, Math.PI); ctx.fill();
}
// Eating: a ship's biscuit held up in the mitt (pale, inked, a few docking holes).
function drawRation(ctx, h) {
  ctx.beginPath(); ctx.ellipse(h[0] + 0.15, h[1] - 0.35, 0.62, 0.5, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#e8e4da'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.13; ctx.stroke();
  ctx.fillStyle = 'rgba(40,36,30,0.75)';
  for (const [u, v] of [[-0.22, -0.12], [0.22, -0.12], [0, 0.14]]) { ctx.beginPath(); ctx.arc(h[0] + 0.15 + u, h[1] - 0.35 + v, 0.06, 0, Math.PI * 2); ctx.fill(); }
}

function drawCoat(ctx, rig, pr, depth) {
  const topS = rig.top.map(pr), hemSc = rig.hem.map(pr);
  const ui = ringArcIdx(topS, true), li = ringArcIdx(hemSc, false);
  const upper = ui.map(i => topS[i]), lower = li.map(i => hemSc[i]);
  // straight sides with a few points so smoothing only rounds the shoulder corners
  const side = (a, b) => [0.12, 0.4, 0.7].map(t => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  const R0 = upper[upper.length - 1], R1 = lower[lower.length - 1], L0 = upper[0], L1 = lower[0];
  const sil = [...upper, ...side(R0, R1), ...lower.slice().reverse(), ...side(L1, L0)];
  const sharp = new Set([upper.length + 3, upper.length + 3 + lower.length - 1]);
  // sharp at the two hem corners; drop the very first/last of the side runs from smoothing ambiguity
  let poly = dense(sil, sharp, 3);
  if (rig.lying > 0.5) poly = dense(convexHull(topS.concat(hemSc)), null, 3);

  ctx.beginPath(); polyPath(ctx, poly); ctx.fillStyle = C.coat; ctx.fill();

  // world-facing helpers
  const yaw = rig.yaw;
  const facingCam = phi => Math.sin(yaw + rig.hemYaw + phi); // world y of body dir phi (+ toward camera)

  ctx.save();
  ctx.beginPath(); polyPath(ctx, poly); ctx.clip();

  // Open front: paler inner panel between the coat edges, toggles across the gap.
  const e = 0.22;
  const vis = facingCam(0);
  if (vis > -0.15) {
    const tL = pr(ringAt(rig.top, -e * 0.6)), tR = pr(ringAt(rig.top, e * 0.6));
    const hL = pr(ringAt(rig.hem, -e)), hR = pr(ringAt(rig.hem, e));
    ctx.beginPath(); ctx.moveTo(tL[0], tL[1]); ctx.lineTo(tR[0], tR[1]); ctx.lineTo(hR[0], hR[1]); ctx.lineTo(hL[0], hL[1]); ctx.closePath();
    ctx.fillStyle = C.panel; ctx.fill();
    // coat edges
    const edge = (a, b, w) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); };
    const lw = clamp(vis + 0.3) * 0.2;
    edge(tL, hL, lw * 0.8); edge(tR, hR, lw * 1.2);
    // toggles
    for (const tt of [0.14, 0.3, 0.46]) {
      const a = [lerp(tL[0], hL[0], tt), lerp(tL[1], hL[1], tt)], b = [lerp(tR[0], hR[0], tt), lerp(tR[1], hR[1], tt)];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, half = 0.2 + 0.12 * clamp(vis);
      ctx.beginPath(); ctx.moveTo(mx - half, my - 0.05); ctx.lineTo(mx + half, my + 0.05);
      ctx.lineWidth = 0.26; ctx.strokeStyle = INK; ctx.stroke();
    }
  }

  // A few long vertical folds on the faces we can see, inked on the hem half.
  ctx.lineCap = 'round';
  for (const phi of [-1.05, 1.0, -2.1, 2.2, Math.PI]) {
    const v = facingCam(phi);
    if (v < 0.2) continue;
    const a = pr(ringAt(rig.top, phi)), b = pr(ringAt(rig.hem, phi));
    const s = phi > 0 ? 0.38 : 0.5;
    const a2 = [lerp(a[0], b[0], s), lerp(a[1], b[1], s)];
    ctx.beginPath(); ctx.moveTo(a2[0], a2[1]);
    ctx.quadraticCurveTo((a2[0] + b[0]) / 2 + 0.15, (a2[1] + b[1]) / 2, b[0], b[1] - 0.15);
    ctx.lineWidth = 0.15; ctx.strokeStyle = `rgba(${DEEP},${0.5 + 0.4 * v})`; ctx.stroke();
  }
  ctx.restore();

  // Hard light/dark split at the terminator.
  const tPhi = TERM_A - (yaw + rig.hemYaw);
  const ta = pr(ringAt(rig.top, tPhi)), tb = pr(ringAt(rig.hem, tPhi));
  darkSide(ctx, poly, [ta[0] + 0.15, ta[1]], tb, 0.6, 0.35);

  // Internal ink marks: shadow under the shoulder on the dark side, cloth turn at the hem.
  ctx.save();
  ctx.beginPath(); polyPath(ctx, poly); ctx.clip();
  ctx.strokeStyle = `rgba(${DEEP},0.8)`; ctx.lineCap = 'round';
  const rx = Math.max(...poly.map(p => p[0]));
  const hemY = Math.max(...poly.map(p => p[1]));
  ctx.lineWidth = 0.14;
  for (let k = 0; k < 3; k++) {
    const x = rx - 0.35 - k * 0.38;
    ctx.beginPath(); ctx.moveTo(x, hemY - 2.4 + k * 0.5); ctx.lineTo(x - 0.1, hemY - 0.5); ctx.stroke();
  }
  ctx.restore();

  const fz = state.body?.frozen || 0;
  if (fz > 0.03) drawRime(ctx, poly, lower, upper, fz, rig, pr, facingCam);
  inkOutline(ctx, poly, 0.13, 0.36);
}

function drawPack(ctx, rig, pr) {
  const c = rig.pack.map(pr);
  const hull = dense(convexHull(c), null, 3);
  ctx.beginPath(); polyPath(ctx, hull); ctx.fillStyle = C.pack; ctx.fill();
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  darkSide(ctx, hull, [cx + 0.1, 0], [cx + 0.25, 1], 0.55, 0, '26,26,28');   // the pack stays neutral grey
  const f0 = pr(mix(rig.pack[4], rig.pack[7], 0.35)), f1 = pr(mix(rig.pack[5], rig.pack[6], 0.35));
  ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]);
  ctx.strokeStyle = 'rgba(30,30,30,0.7)'; ctx.lineWidth = 0.15; ctx.stroke();
  inkOutline(ctx, hull, 0.1, 0.28);
  // ice axes carried but not in hand: strapped on the back of the pack, one diagonal, the head
  // up past its top
  if (CP.pack < 0.3 && state.pack?.slots.some(q => q && q.id === 'axes' && !q.worn)) {
    const lo = rig.pack[6], hi = rig.pack[4];
    const a = pr(mix(hi, lo, 1.05)), b = pr(mix(lo, hi, 1.3)), hd = pr(mix(lo, hi, 1.3).map((v, i) => v + [0, 0.7, -0.15][i]));
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.3; ctx.stroke();
    const hb = pr(mix(lo, hi, 1.3).map((v, i) => v + [0, -0.6, 0.1][i]));
    ctx.beginPath(); ctx.moveTo(hb[0], hb[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(hd[0], hd[1]); ctx.lineWidth = 0.32; ctx.stroke();
  }
}

function drawHood(ctx, rig, pr) {
  const h = pr(rig.head);
  const pk = pr(rig.peak);
  const wa = state.wind.angle ?? 0;
  const fl = pose.windAmt * (0.4 + 0.25 * Math.sin(state.time * 13)) + pose.gustKick * 0.6;
  pk[0] += Math.cos(wa) * fl; pk[1] += Math.sin(wa) * fl * KY * 0.5;
  const vx = pk[0] - h[0], vy = pk[1] - h[1];
  const vl = Math.hypot(vx, vy) || 1, va = Math.atan2(vy, vx);
  const dp = pr(rig.drape);
  const dx = dp[0] - h[0], dy = dp[1] - h[1];
  const dl = Math.hypot(dx, dy) || 1, da = Math.atan2(dy, dx);
  const rx = HOOD_R, ry = HOOD_RY;
  const awayW = clamp(-Math.sin(P.facing + rig.twist) * 1.6);
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const base = (rx * ry) / Math.hypot(ry * Math.cos(a), rx * Math.sin(a));
    const k = Math.pow(Math.max(0, Math.cos(a - va)), 7);
    const kd = Math.pow(Math.max(0, Math.cos(a - da)), 2.2) * awayW;
    let r = Math.max(base + k * Math.max(0, vl - base), base + kd * Math.max(0, dl - base));
    // the cowl flares out over the shoulders at the bottom: no neck
    // rounded crown with real head volume, tapering to a neck narrower than the shoulders
    const lowS = smooth(0.2, 1, Math.sin(a));
    const x = Math.cos(a) * r * (1 - lowS * 0.24), y = Math.sin(a) * r * (1 - lowS * 0.06);
    pts.push([h[0] + x, h[1] + y]);
  }
  const poly = dense(pts, null, 2);
  ctx.beginPath(); polyPath(ctx, poly); ctx.fillStyle = C.hood; ctx.fill();
  // rime on the hood: frost along the crown (the face, drawn later, stays clear of it)
  const fzH = state.body?.frozen || 0;
  if (fzH > 0.05) {
    ctx.save(); ctx.beginPath(); polyPath(ctx, poly); ctx.clip();
    ctx.beginPath(); ctx.ellipse(h[0], h[1] - 0.2, rx * 1.05, ry * 0.95, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.lineWidth = 0.35 + 0.5 * fzH; ctx.strokeStyle = `rgba(246,248,250,${0.8 * fzH})`; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }

  // Face: a dark oval filling the upper hood front, pale cheek and nose inside (no rim).
  const fy = P.facing + rig.faceYaw;
  const fdx = Math.cos(fy), fdy = Math.sin(fy);
  const toward = fdy;
  let face = null;
  ctx.save();
  ctx.beginPath(); polyPath(ctx, poly); ctx.clip();
  if (toward > -0.2) {
    const side = Math.abs(fdx);
    const down = rig.facePitch * 0.4;
    const fcx = h[0] + fdx * HOOD_R * (0.4 + 0.42 * side);
    // high in the hood front: top of the mask ~0.5u under the crown
    const fcy = h[1] - HOOD_RY + 0.5 + 0.82 + fdy * 0.25 + down * 0.6;
    const wfac = Math.max(0.45, Math.abs(fdy));
    face = { fcx, fcy, wfac, toward };
  } else {
    // back of the hood: a fold falling from the point
    ctx.strokeStyle = `rgba(${DEEP},0.7)`; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pk[0], pk[1] + 0.5); ctx.quadraticCurveTo(h[0] + 0.45, h[1], h[0] + 0.3, h[1] + HOOD_RY); ctx.stroke();
  }
  ctx.restore();

  // light/dark split on the hood
  const tx = h[0] + rx * 0.5;
  darkSide(ctx, poly, [tx - 0.15, h[1] - 3], [tx + 0.25, h[1] + 3], 0.5, 0.7);

  if (face) {
    ctx.save();
    ctx.beginPath(); polyPath(ctx, poly); ctx.clip();
    const { fcx, fcy, wfac } = face;
    ctx.beginPath(); ctx.ellipse(fcx, fcy, 0.7 * wfac, 0.88, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.face; ctx.fill();
    if (face.toward > 0.3) {
      // a small pale mark left of centre: cheek and nose catching the light (solid mask around it)
      ctx.beginPath(); ctx.ellipse(fcx - 0.4 * wfac, fcy + 0.2, 0.13, 0.3, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#8c8c8c'; ctx.fill();
    }
    ctx.restore();
  }
  // ink only the upper part: the bottom of the cowl melts into the shoulders
  const n = poly.length, open = [];
  const startI = Math.round(n * 0.36), endI = Math.round(n * 0.14) + n;
  for (let i = startI; i <= endI; i++) open.push(poly[i % n]);
  inkOutline(ctx, open, 0.12, 0.34, false);
}

// One soft ellipse: white, fading to nothing at the edge (no rim), stretched along `ang`.
function wisp(ctx, x, y, rx, ry, ang, col, a) {
  if (a <= 0.004 || rx <= 0.01) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang); ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(0.55, `rgba(${col},${a * 0.55})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
// Breath: a plume stretched downwind (to ~3:1), its trailing edge tearing into curls that drift
// off and thin out. Mostly white at low alpha; a whisper of grey on the shadow side (light from
// the upper left) gives it an edge on white snow.
function drawPuffs(ctx, list) {
  for (const p of list) {
    if (p.age < 0) continue;
    const t = p.age / p.life;
    const a = (p.a ?? 0.35) * (1 - t) * (1 - t * 0.3) * Math.min(1, p.age * 8);
    const sp = Math.hypot(p.vx, p.vy);
    const ang = sp > 0.01 ? Math.atan2(p.vy, p.vx) : 0;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const rx = p.r * (1 + 2.2 * Math.min(1, t * 1.6)) * (1 + 0.6 * t);
    const ry = p.r * (0.7 + 0.6 * t);
    const x = p.x, y = p.y - p.z;
    const core = 1 - smooth(0.35, 0.9, t);              // the body of the plume thins as it tears
    wisp(ctx, x + 0.3, y + 0.38, rx, ry, ang, '120,128,140', a * 0.55 * core);
    wisp(ctx, x, y, rx, ry, ang, '251,252,253', a * core);
    // curls breaking off the trailing edge
    const n = p.curls || 0, tear = smooth(0.15, 0.6, t);
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / (n + 1);
      const back = rx * (0.5 + 0.9 * f) * tear;
      const side = Math.sin(p.seed + k * 2.1 + p.age * 3.2) * ry * (0.8 + 1.4 * tear);
      const cx = x - ux * back - uy * side, cy = y - uy * back + ux * side - tear * 0.6 * f;
      const cr = p.r * (0.35 + 0.35 * (1 - f)) * (0.6 + 1.2 * tear);
      const ca = a * tear * (1 - t * 0.6) * (0.7 - 0.3 * f);
      wisp(ctx, cx + 0.2, cy + 0.26, cr * 1.4, cr, ang + Math.sin(p.seed + k) * 0.8, '120,128,140', ca * 0.5);
      wisp(ctx, cx, cy, cr * 1.4, cr, ang + Math.sin(p.seed + k) * 0.8, '251,252,253', ca);
    }
  }
}
function drawKicks(ctx) {
  for (const p of kicks) {
    const a = 1 - p.age / p.life;
    ctx.fillStyle = `rgba(250,250,250,${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(120,122,126,${a * 0.5})`;
    ctx.beginPath(); ctx.arc(p.x + p.r * 0.4, p.y - p.z + p.r * 0.4, p.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawables() {
  // rings left on the water once the explorer is gone from it (under, or back on land)
  const lingering = rings.length || flotsam || bubbles.length;
  const ex0 = flotsam || rings[rings.length - 1] || bubbles[0];
  const extra = lingering && (!water.level || P.lostAtSea) ? [{ x: ex0.x, y: ex0.y, draw: drawRings }] : [];
  if (P.lostAtSea || P.deadInside || P.mode === 'inside' || P.mode === 'gone' || (tentFade <= 0.01 && doorK <= 0)) return extra;
  if ((water.zW > 0.05 || water.level) && (P.mode === 'walk' || P.mode === 'swim' || P.mode === 'sink' || P.mode === 'crawlout')) return [{ x: P.x, y: P.y, draw: drawInWater }];
  return [...extra, {
    x: P.x, y: P.y,   // feet: main.js sorts by terrain.sortKey(x, y) (face foot on a cliff, + height on a plateau)
    draw(ctx) {
      if (doorK > 0) { drawThroughDoor(ctx); return; }
      if (tentFade < 0.99) { drawFaded(ctx, tentFade); return; }
      const rig = buildRig();
      const X = P.x, Y = P.y;
      const fw = toWorld(rig.head, rig.yaw);
      faceWorld = { x: X + fw.x, y: Y + fw.y, z: fw.z - 0.5 };
      if (colKind === 'fall' && (P.mode === 'collapse' || P.mode === 'dead')) drawHollow(ctx, X, Y);
      drawShadow(ctx, rig, X, Y);
      // breath behind the head is drawn before the figure, the rest after it
      const headY = Y + fw.y;
      // (only vapour clearly in front of the face may cross the figure, never smear the hood)
      const away = Math.sin(P.facing) < -0.2;
      const front = p => !away && p.y > headY + 0.9;
      drawPuffs(ctx, puffs.filter(p => !front(p)));
      drawFigure(ctx, rig, X, Y);
      drawPuffs(ctx, puffs.filter(front));
      drawKicks(ctx);
      drawDrips(ctx);
    },
  }];
}

// Where a fatal fall landed: snow pressed down in a long hollow under the body, its lip thrown up
// round it and dark broken lumps scattered about: down, and wrong. (Drawn under the figure, and
// baked into the still fallen.js keeps.)
function drawHollow(ctx, X, Y) {
  let sd = hollowSeed;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const a = P.facing, c = Math.cos(a), sn = Math.sin(a);
  const cx = X + c * 1.2, cy = Y + sn * 1.2 * KY;
  const blob = (rx, ry, jag, dx, dy) => {
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const t = i / 18 * Math.PI * 2, k = 1 + jag * (Math.sin(t * 3 + hollowSeed) * 0.5 + Math.sin(t * 7 + hollowSeed * 2) * 0.3);
      const u = Math.cos(t) * rx * k, v = Math.sin(t) * ry * k;
      const x = cx + dx + u * c - v * sn, y = cy + dy + (u * sn + v * c) * KY;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  blob(8.2, 4.4, 0.12, 0.3, 0.3); ctx.fillStyle = 'rgba(252,252,252,0.95)'; ctx.fill();         // the thrown-up lip
  ctx.lineWidth = 0.16; ctx.strokeStyle = 'rgba(128,132,140,0.6)'; ctx.stroke();               // its shadowed outer edge
  blob(7.0, 3.5, 0.1, 0, 0); ctx.fillStyle = 'rgba(118,124,132,0.6)'; ctx.fill();              // the hollow
  blob(6.0, 2.8, 0.1, 0.5, 0.45); ctx.fillStyle = 'rgba(182,186,192,0.55)'; ctx.fill();        // its lit floor (the shade on the upper left wall)
  ctx.fillStyle = 'rgba(84,88,96,0.75)';
  for (let i = 0; i < 14; i++) {
    const t = rnd() * Math.PI * 2, d = 6 + rnd() * 5, u = Math.cos(t) * d * 1.3, v = Math.sin(t) * d * 0.7, r = 0.2 + rnd() * 0.35;
    const x = cx + u * c - v * sn, y = cy + (u * sn + v * c) * KY;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r * 0.8, rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
}

// Crawling through the tent door: the whole figure fades as one (drawn into a small offscreen
// at the current scale, then laid down with alpha), so overlapping parts don't show through.
const FADE_BOX = { x0: -14, y0: -21, x1: 14, y1: 10 };
let fadeCan = null, fadeCtx = null;
function drawFaded(ctx, a, dark = 0, clip = null) {
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b) || 1;
  const bw = FADE_BOX.x1 - FADE_BOX.x0, bh = FADE_BOX.y1 - FADE_BOX.y0;
  const fw = Math.ceil(bw * sc), fh = Math.ceil(bh * sc);
  if (!fadeCan) { fadeCan = document.createElement('canvas'); fadeCtx = fadeCan.getContext('2d'); }
  if (fadeCan.width < fw || fadeCan.height < fh) { fadeCan.width = Math.max(fadeCan.width, fw); fadeCan.height = Math.max(fadeCan.height, fh); }
  const g = fadeCtx, X = P.x, Y = P.y;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, fadeCan.width, fadeCan.height);
  g.setTransform(sc, 0, 0, sc, -(X + FADE_BOX.x0) * sc, -(Y + FADE_BOX.y0) * sc);
  const rig = buildRig();
  if (!clip) drawShadow(g, rig, X, Y);
  drawFigure(g, rig, X, Y);
  if (dark > 0) {
    // into the shadow of the tent: the figure sinks toward the colour of the doorway
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(52,52,54,${dark})`; g.fillRect(0, 0, fw, fh);
    g.globalCompositeOperation = 'source-over';
  }
  if (clip) {
    // everything over the front gable is behind the canvas; the door opening shows through
    ctx.beginPath(); ctx.rect(X - 40, Y - 40, 80, 80);
    const poly = q => { ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); };
    poly(clip.gable); poly(clip.door);
    ctx.clip('evenodd');
  }
  ctx.globalAlpha *= a;
  ctx.drawImage(fadeCan, 0, 0, fw, fh, X + FADE_BOX.x0, Y + FADE_BOX.y0, fw / sc, fh / sc);
}
// The Third Man (fx/thirst.js): the explorer's own figure, pose for pose this moment, drawn again at
// (x, y): the colour taken out of it (never signal yellow: yellow must not lie), paled, faint, no
// shadow, no breath and no footprints (nothing is pushed). Drawn into a small offscreen at the
// current scale, greyed there (a saturation fill, masked back to the figure's own outline by a
// second canvas), then laid down at alpha a. slip 0..1 breaks it into horizontal slices sliding
// apart, fainter as they go (he dissolves when looked at); seed varies the slices. The two canvases
// are kept at least 256 px a side (so they stay on the GPU) and the figure is redrawn into them
// every other frame (at 30 Hz a faint figure's pose can't be told from 60).
let ghostA = null, ghostB = null, ghostTick = 0, ghostSc = 0;
function drawGhost(ctx, x, y, a, slip = 0, seed = 0) {
  if (a < 0.01) return;
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b) || 1;
  const bw = FADE_BOX.x1 - FADE_BOX.x0, bh = FADE_BOX.y1 - FADE_BOX.y0;
  const fw = Math.ceil(bw * sc), fh = Math.ceil(bh * sc);
  if (!ghostA) { ghostA = document.createElement('canvas'); ghostB = document.createElement('canvas'); }
  let fresh = (ghostTick++ & 1) === 0 || Math.abs(sc - ghostSc) > 1e-3;
  for (const c of [ghostA, ghostB]) if (c.width < fw || c.height < fh) { c.width = Math.max(256, c.width, fw); c.height = Math.max(256, c.height, fh); fresh = true; }
  const g = ghostA.getContext('2d'), q = ghostB.getContext('2d');
  if (fresh) {
  ghostSc = sc;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, fw + 2, fh + 2);
  g.setTransform(sc, 0, 0, sc, -(x + FADE_BOX.x0) * sc, -(y + FADE_BOX.y0) * sc);
  drawFigure(g, buildRig(), x, y);
  // greyed: the colour out, then cut back to the figure, then paled toward the snow
  q.setTransform(1, 0, 0, 1, 0, 0);
  q.globalCompositeOperation = 'copy'; q.drawImage(ghostA, 0, 0);
  q.globalCompositeOperation = 'saturation'; q.fillStyle = '#808080'; q.fillRect(0, 0, fw, fh);
  q.globalCompositeOperation = 'destination-in'; q.drawImage(ghostA, 0, 0);
  q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(214,218,224,0.12)'; q.fillRect(0, 0, fw, fh);
  q.globalCompositeOperation = 'source-over';
  }
  const X0 = x + FADE_BOX.x0, Y0 = y + FADE_BOX.y0;
  ctx.save();
  if (slip < 0.01) { ctx.globalAlpha *= a; ctx.drawImage(ghostB, 0, 0, fw, fh, X0, Y0, bw, bh); }
  else {
    // in slices: each slides sideways its own way, the furthest gone first
    const n = 7, sh = fh / n, base = ctx.globalAlpha;
    for (let k = 0; k < n; k++) {
      const r = Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453, u = r - Math.floor(r);
      const sl = Math.pow(slip, 0.7), dx = ((u - 0.5) * 2 * 9 + (k % 2 ? 1 : -1) * 2.5) * sl;
      ctx.globalAlpha = base * a * clamp(1 - Math.pow(slip, 1.6) * (0.7 + 0.6 * u));
      if (ctx.globalAlpha < 0.005) continue;
      ctx.drawImage(ghostB, 0, k * sh, fw, sh, X0 + dx, Y0 + k * sh / sc, bw, sh / sc);
    }
  }
  ctx.restore();
}
function drawThroughDoor(ctx) {
  // the shadow stays outside, unclipped, fading as they go in
  if (doorK < 0.6) { ctx.save(); ctx.globalAlpha = 1 - doorK / 0.6; drawShadow(ctx, buildRig(), P.x, P.y); ctx.restore(); }
  drawFaded(ctx, 1, 0.55 * smooth(0.25, 1, doorK), (shelter === 'pup' && pupDoorClip()) || tentDoorClip());   // shadowed, not a cut-out
}

// A still of the figure as it is now, for fallen.js: the figure and its cast shadow, each in
// a canvas at SNAP_S px per world unit covering x0..x0+w, y0..y0+h around the feet.
const SNAP = { x0: -14, y0: -14, x1: 14, y1: 10 }, SNAP_S = 8;
function snapshot() {
  const w = SNAP.x1 - SNAP.x0, h = SNAP.y1 - SNAP.y0;
  const mk = () => { const c = document.createElement('canvas'); c.width = w * SNAP_S; c.height = h * SNAP_S; const g = c.getContext('2d'); g.setTransform(SNAP_S, 0, 0, SNAP_S, -(P.x + SNAP.x0) * SNAP_S, -(P.y + SNAP.y0) * SNAP_S); return [c, g]; };
  const rig = buildRig();
  const [fig, fg] = mk(), [shadow, sg] = mk();
  if (colKind === 'fall') drawHollow(sg, P.x, P.y);
  drawShadow(sg, rig, P.x, P.y);
  drawFigure(fg, rig, P.x, P.y);
  return { fig, shadow, x0: SNAP.x0, y0: SNAP.y0, w, h };
}

export function drawScreen(ctx) {
  if (!state.debug) return;
  ctx.fillStyle = '#000'; ctx.font = '12px monospace';
  const s = `${P.terrain} spd ${P.speed.toFixed(1)} gait ${pose.gait.toFixed(2)} lean ${P.lean.toFixed(2)} shield ${pose.shield.toFixed(2)} hug ${pose.hug.toFixed(2)} brace ${pose.brace.toFixed(2)} exp ${P.exposure.toFixed(2)}`;
  ctx.fillText(s, 10, state.view.h - 12);
}

export const _debug = { restStop: (d = 3) => startRest(d), tired: () => ({ restT, spent, restW, sitW, crawlW, sitDone, pant, pantPh, stopStage, climbCostEst }), hes: () => [hesT, commit], dryRoute: () => dryRoute, water, pose, climb: () => climb, route: () => route, ovr: () => ovr, ovrW: () => ovrW, findPath: (...a) => findPath(...a), shoes: () => [shoesOn(), shoesDrawn(), strapT], stomach: (d = 3) => { stomachOn = d; stomachT = 20; }, pat: () => { patT = PAT_S; patDone = true; }, cp: CP, rig: () => buildRig() };
