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
};
// Snowshoes (state.player.gear.snowshoes): a wide, flat-footed gliding trudge. Deep snow gets
// much easier; plain snow a little quicker. (Ice / thin ice never: the pack auto-stows them.)
const SHOE = {
  snow: { ...PROFILES.snow, speed: 1.15, cad: 2.3, step: 4.8, lift: 0.55, stance: 1.55, sink: 0.12, bob: 0.17, lean: 0.12, swing: 0.75, crouch: 0.18, weight: 0.55 },
  deep: { ...PROFILES.deep, speed: 0.8, cad: 2.15, step: 4.1, lift: 0.85, lean: 0.2, swing: 0.6, spread: 0.04, work: 0.35, crouch: 0.22, stance: 1.6, sink: 0.3, bob: 0.26, accel: 4, fric: 5.5, hunch: 0.3, weight: 0.6 },
};
const SHOE_SPEED = { snow: 1.15, deep: 0.8 };   // deep: as a fraction of plain-snow speed
let strapT = 0, strapDur = 0, strapOn = true, strapLock = false;   // kneel-and-strap animation
const shoesOn = () => !!(P.gear && P.gear.snowshoes);
const shoesDrawn = () => shoesOn() || (strapT > 0 && !strapOn);   // still on the feet while unstrapping

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

const stubTerrain = (() => { try { return T.speedFactor('deep') === T.speedFactor('path'); } catch { return true; } })();

const P = state.player;
const pose = {
  ...PROFILES.snow, stepEff: PROFILES.snow.step, shield: 0, shieldSide: 1, hug: 0, brace: 0,
  windLeanF: 0, windLeanS: 0, torsoYaw: 0, headYaw: 0, windAmt: 0, gait: 0,
  shift: 0, shiver: 0, gustKick: 0,
};
let phase = 0, tentMod = 1;
let slipT = 0, slipSide = 1, staggerT = 0, staggerSide = 1;
let breathT = 1, breathStrong = 0;
// idle behaviour timers
let shiftT = 2.5, shiftTarget = 1, lookT = 3, lookTarget = 0, shiverT = 4, shiverOn = 0;
let stampT = 8, stampOn = 0, stampSide = 1;
let lastGust = 0;
// coat hem spring (body-frame offset of the hem centre, lags hip velocity)
const hemS = { f: 0, r: 0, z: 0, vf: 0, vr: 0, vz: 0 };
// Compass (js/ui/compass.js): weights for rummaging in the pack, offering it in the slot, and
// holding it out; packSwing 0 = on the back, 1 = swung round in front.
const CP = { rum: 0, slot: 0, out: 0, pack: 0 };
function updateCompassPose(dt) {
  const ph = state.compass?.phase || 'idle';
  CP.rum = approach(CP.rum, ph === 'rummage' ? 1 : 0, ph === 'rummage' ? 4 : 5, dt);
  CP.slot = approach(CP.slot, ph === 'slot' ? 1 : 0, 5, dt);
  CP.out = approach(CP.out, ph === 'out' ? 1 : 0, 5, dt);
  // the pack comes off one shoulder and round to the front over ~0.6 s, and back on after
  CP.pack = clamp(CP.pack + (ph === 'rummage' ? 1 : -1) * dt / 0.6);
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
  P.facing = Math.PI / 2;
  if (state.params.get('demo') === 'dir') P.facing = (parseFloat(state.params.get('a') || '90') * Math.PI) / 180;
}

// Menu "Return to base camp": drop every in-progress state so he simply stands there.
function resetTo(x, y) {
  climb = null; route = null; ovr = null; ovrW = 0;
  shoveT = 0; shoveV = 0; slipT = 0; staggerT = 0; downT = 0; refT = 0;
  cowerW = 0; hunkerW = 0; idleT = 0; rockHit = null; shadowOff = 0; stampOn = 0;
  chips.length = 0;
  for (const k in hemS) hemS[k] = 0;
  pose.gait = 0; pose.gustKick = 0; pose.stepEff = pose.step;
  P.x = x ?? P.x; P.y = y ?? P.y; P.vx = P.vy = 0; P.speed = 0; P.moving = false;
  P.mode = 'walk'; P.climbStage = null; P.climbHold = false; P.sheltered = 0;
  const inp = state.input;
  if (inp.tap) lastTapT = inp.tap.t;
  if (inp.action) lastActT = inp.action;
  inp.tap = null;
}

function walkable(x, y) {
  try { return T.isWalkable(x, y) !== false; } catch { return true; }
}

export function update(dt) {
  if (dt <= 0) return;
  const inp = state.input;
  for (const e of state.events) if (e.type === 'teleport') resetTo(e.x, e.y);
  updateCompassPose(dt);
  for (const e of state.events) if (e.type === 'gear' && e.item === 'snowshoes') {
    // strapping on / taking off by hand: kneel at the feet ~1.2 s, rooted; the game pulling
    // them off (climbing, ice): a quick 0.4 s bend, no lock
    strapOn = !!e.on;
    if (e.auto) { strapDur = strapT = 0.4; strapLock = false; }
    else { strapDur = strapT = 1.2; strapLock = true; }
  }
  if (strapT > 0) strapT = Math.max(0, strapT - dt);
  const ter = (T.terrainAt(P.x, P.y)) || 'snow';
  P.terrain = ter;
  const shoes = shoesOn() && (ter === 'snow' || ter === 'deep');
  const prof = shoes ? SHOE[ter] : (PROFILES[ter] || PROFILES.snow);
  let sf = stubTerrain ? prof.speed : (T.speedFactor(ter) ?? 1);
  if (shoes && !stubTerrain) sf = ter === 'deep' ? SHOE_SPEED.deep * (T.speedFactor('snow') ?? 1) : sf * SHOE_SPEED.snow;
  // Ice is walked cautiously (Joe): walking pace stays near the cautious profile, and any extra
  // speed the terrain grants on ice shows up as glide (low friction), not frantic feet.
  if (ter === 'ice' || ter === 'thin') sf = Math.min(sf, prof.speed * 1.15);
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

  handleActions();
  if (P.mode === 'climb') { updateClimb(dt); finishFrame(dt, 'rock', 0, wEff, wa); return; }
  if (P.mode === 'down') { updateDown(dt); finishFrame(dt, ter, 0, wEff, wa); return; }
  if (P.mode === 'refuse') { updateRefuse(dt); finishFrame(dt, ter, 0, wEff, wa); return; }
  ovrW = approach(ovrW, 0, 5, dt);

  // --- intent ----------------------------------------------------------------------------
  let ix = inp.x, iy = inp.y;
  if (P.mode === 'approach' && route) {
    // walk to the foot of the climb by ourselves
    // follow the waypoints round any rock, then the last leg to the route
    while (route.path && route.path.length > 1 && Math.hypot(route.path[0].x - P.x, route.path[0].y - P.y) < 4) route.path.shift();
    // no progress for a while (a gust shoved us into a corner): plan again from here
    route.stuckT = P.speed < 1.5 && approachT > 0.5 ? (route.stuckT || 0) + dt : 0;
    if (route.stuckT > 1.2) { route.path = findPath(P.x, P.y, route.walkTo.x, route.walkTo.y); route.stuckT = 0; }
    const wp = route.path && route.path.length > 1 ? route.path[0] : route.walkTo;
    const dRoute = Math.hypot(route.walkTo.x - P.x, route.walkTo.y - P.y);
    const dx = wp.x - P.x, dy = wp.y - P.y, d = Math.max(0.001, Math.hypot(dx, dy));
    approachT += dt;
    // arrived (or about to step past it this frame, or pressed against the rock right by it)
    if (dRoute < Math.max(1.4, P.speed * dt * 1.5) || (approachT > 0.6 && dRoute < 5 && P.speed < 1)) { beginClimb(); finishFrame(dt, ter, 0, wEff, wa); return; }
    if (approachT > route.limit) { P.mode = 'walk'; route = null; }
    else { const m = Math.min(1, dRoute / 3 + 0.4); ix = dx / d * m; iy = dy / d * m; }
  }
  if (shoveT > 0) { ix *= 0.15; iy *= 0.15; }
  if (strapT > 0 && strapLock) { ix = 0; iy = 0; }   // kneeling at the snowshoe bindings
  const mag = Math.min(1, Math.hypot(ix, iy));
  const active = mag > 0.05;
  const wantDir = active ? Math.atan2(iy / KY, ix) : P.facing;
  const into = Math.max(0, -Math.cos(wantDir - wa));

  // Pause at each foot plant on ice: |sin| is 0 at the plants.
  tentMod = 1 - pose.tent * (1 - Math.pow(Math.abs(Math.sin(phase * Math.PI * 2)), 0.6));
  let spd = BASE_SPEED * sf * mag * (1 - 0.45 * wEff * into) * (1 - pose.tent * 0.35) * lerp(1, 0.45, fa) * (1 - 0.25 * CP.out);
  if (staggerT > 0) spd *= 0.35;
  if (slipT > 0) spd *= 0.5;
  // a steady push back toward the interior, stronger the deeper in
  // (not while walking a planned route to a climb: the path already threads the rock)
  const drift = fa > 0 && P.mode !== 'approach' ? fa * (2.5 + 7 * fa) : 0;
  const tvx = (active ? Math.cos(wantDir) * spd : 0) + (fa > 0 ? fr.inX * drift : 0);
  const tvy = (active ? Math.sin(wantDir) * spd * KY : 0) + (fa > 0 ? fr.inY * drift : 0);
  const k = active ? prof.accel : prof.fric;
  P.vx = approach(P.vx, tvx, k, dt);
  P.vy = approach(P.vy, tvy, k, dt);
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
    return walkable(x, y) && walkable(x + ((x - ox) / d) * 1.5, y + ((y - oy) / d) * 1.5);
  };
  if (!probe(nx, ny)) {
    if (probe(nx, oy)) { ny = oy; P.vy *= 0.2; }
    else if (probe(ox, ny)) { nx = ox; P.vx *= 0.2; }
    else { nx = ox; ny = oy; P.vx = P.vy = 0; }
  }
  P.x = nx; P.y = ny;
  P.speed = Math.hypot(P.x - ox, P.y - oy) / dt;
  P.moving = P.speed > 0.6;

  // --- facing -----------------------------------------------------------------------------
  if (active) {
    const turnRate = (ter === 'ice' || ter === 'thin' ? 4 : 6.5) * dt;
    const d = wrapPi(wantDir - P.facing);
    P.facing = wrapPi(P.facing + clamp(d, -turnRate, turnRate));
  } else if (CP.out > 0.5) {
    // orienting by the compass: turn slowly to face north-west (screen up-left)
    const nw = Math.atan2(-1 / KY, -1);
    P.facing = wrapPi(P.facing + clamp(wrapPi(nw - P.facing), -0.8 * dt, 0.8 * dt));
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
  if (pose.gait > 0.02) phase += (walkSpeed * tentMod * dt) / (2 * Math.max(0.6, strideProj));
  if (phase >= 1) phase -= 1;
  const crossed = f => (prev < f && phase >= f) || (f === 0 && phase < prev);
  if (pose.gait > 0.25) {
    if (crossed(0)) footDown('L', prof, ter);
    if (crossed(0.5)) footDown('R', prof, ter);
  }

  // --- pose targets ---------------------------------------------------------------------------
  const r = Math.min(1, dt * 3.2);
  for (const key of POSE_KEYS) pose[key] += (prof[key] - pose[key]) * r;

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
  pose.hug = approach(pose.hug, idle * clamp(windPose * (0.7 + 0.3 * wEff) + pose.shiver * 0.6 + smooth(0.7, 0.85, clamp(state.weather.cold ?? 0))), 2.5, dt);
  pose.brace = approach(pose.brace, idle * windPose * (0.35 + 0.65 * gustAmt), 3, dt);

  // --- idle life: weight shifts, slow looks, shivers, foot stamps ----------------------------
  shiftT -= dt;
  if (shiftT <= 0) { shiftT = 2 + rand() * 2; shiftTarget = -shiftTarget; }
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
  if (shiverT <= 0) { shiverT = (3 + rand() * 4) * (1 - 0.5 * coldNow); if ((wEff > 0.4 || coldNow > 0.55) && idle > 0.5) shiverOn = 0.8 + rand() * 0.6; }
  pose.shiver = approach(pose.shiver, shiverOn > 0 ? 1 : 0, 8, dt);
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
  // --- wind knockdowns: in a real storm, out in the open, now and then ------------------------
  if (P.mode === 'walk' && shoveT <= 0 && cowerW < 0.3) {
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
}

// Shared tail for the special modes (climb, down): no walking, but breath, particles and
// the hem spring keep running.
function finishFrame(dt, ter, g, wEff, wa) {
  P.speed = 0; P.moving = false;
  pose.gait = approach(pose.gait, 0, 6, dt);
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
  route.path = findPath(P.x, P.y, route.walkTo.x, route.walkTo.y);
  let len = 0, a = P;
  for (const q of route.path) { len += Math.hypot(q.x - a.x, q.y - a.y); a = q; }
  route.limit = 10 + len / 2.5;          // give up if it takes far longer than the walk should
  P.mode = 'approach'; approachT = 0;
}

// Walking to a route that's round a rock spur: breadth-first search on a coarse grid (4u cells,
// within ~180u), returned as simplified waypoints ending at the target.
function findPath(x0, y0, x1, y1) {
  const G = 5, pad = 260;
  const minX = Math.min(x0, x1) - pad, minY = Math.min(y0, y1) - pad;
  const W = Math.ceil((Math.abs(x1 - x0) + 2 * pad) / G) + 1, Hh = Math.ceil((Math.abs(y1 - y0) + 2 * pad) / G) + 1;
  if (W * Hh > 40000) return [{ x: x1, y: y1 }];
  const cell = (x, y) => [Math.round((x - minX) / G), Math.round((y - minY) / G)];
  const [sx, sy] = cell(x0, y0), [tx, ty] = cell(x1, y1);
  const prev = new Int32Array(W * Hh).fill(-1);
  // cells need body clearance, so the path never threads a gap the walk collision won't pass
  const ok = (i, j) => {
    const x = minX + i * G, y = minY + j * G;
    if (!walkable(x, y)) return false;
    for (let a = 0; a < 8; a++) if (!walkable(x + Math.cos(a * 0.785) * 4, y + Math.sin(a * 0.785) * 4)) return false;
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
      if (!walkable(x, y) || !walkable(x + px, y + py) || !walkable(x - px, y - py)) return false;
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
  if (climbWindy()) { startRefuse(); return; }
  const b = route.bottom, t = route.top;
  const L = Math.max(6, Math.hypot(t.x - b.x, t.y - b.y));
  const D = (H * ROUTE_K) / clamp(-(t.y - b.y) / L, 0.35, 1);
  const sMax = Math.max(0, L - 3);
  climb = {
    L, D, sMax, dir: { x: (t.x - b.x) / L, y: (t.y - b.y) / L },
    face: Math.atan2((t.y - b.y) / KY, t.x - b.x),
    up: route.up, stage: route.up ? 'cycle' : 'lower', t: route.up ? 0 : 1, pc: 0,
    base: route.up ? 0 : sMax, s: route.up ? 0 : L, run: 0, dirn: 1, queued: 0,
    slipT: 0, slipFoot: 1, side: 1, from: null, windT: 0, vs: 0, lock: route.up ? 1 : -1,
  };
  P.mode = 'climb'; P.climbStage = climb.stage; P.climbHold = false;
  P.vx = P.vy = 0;
  climb.from = cyclePose(0, 1);
  ovr = climbPose();
}

function climbRequest(dir) {
  const c = climb;
  if (!c) return;
  if (c.stage !== 'cycle' || c.run > 0) { if (c.stage !== 'torn' && c.stage !== 'off') c.queued = dir; return; }
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
    const br = hold * Math.sin(t * Math.PI * 2 / 1.5);
    return {
      hz: 7.6 - 0.3 * e - slip * 0.5 + br * 0.16, leanF: 0.12 + 0.12 * e - br * 0.03,
      leanS: sway + slip * c.slipFoot * 0.12 + c.side * 0.06 * reachK + hold * Math.sin(t * 1.05) * 0.05,
      feet: cp.feet, hands: cp.hands,
      poleA: CLIMB_POLE_A, poleL: CLIMB_POLE_L,
      hemAttach: 0, facePitch: -0.3 + hold * 0.15, full: true, axes: 1,
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
  state.events.push({ type: 'scrape', x: P.x, y: P.y - 15 });
  climbEvent('scrape', 0); climbEvent('scrape', 1);
  return true;
}

function updateClimb(dt) {
  const c = climb;
  ovrW = approach(ovrW, 1, 7, dt);
  P.facing = wrapPi(P.facing + clamp(wrapPi(c.face - P.facing), -8 * dt, 8 * dt));
  if (c.slipT > 0) c.slipT -= dt;
  const slow = 1 - 0.3 * envW.windPose;
  // strong wind on the wall: the longer they hang in it, the likelier a gust tears them off
  const w = envW.ws + envW.gust;
  c.windT = w > 0.7 ? c.windT + dt : Math.max(0, c.windT - dt * 0.5);
  if (c.stage === 'cycle' && w > 0.7 && rand() < (w - 0.7) * (0.25 + 0.2 * c.windT) * (envW.gust > 0.35 ? 1 : 0.3) * dt) tearOff();
  if (c.stage === 'cycle') {
    if (c.run > 0) {
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
        c.s = c.base;
        if (c.base >= c.sMax || lipAbove()) { c.from = cyclePose(0, c.side); c.stage = 'mantle'; c.t = 0; c.base = c.sMax; c.run = 0; }
      }
      if (dirn < 0 && c.pc <= 0) {
        c.pc = 0; c.run--;
        if (c.run > 0) { if (c.base < c.D * 0.6) stepOff(); else beginDownHalf(); }
      }
      if (c.stage === 'cycle' && c.run === 0 && c.queued) startRun(c.queued);
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
      const away = c.face + Math.PI;
      endClimb();
      startFall(1, away);
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
let refT = 0, refFace = 0;
function startRefuse() {
  P.mode = 'refuse'; refT = 0;
  refFace = Math.atan2((route.top.y - route.bottom.y) / KY, route.top.x - route.bottom.x);
  route = null;
  state.events.push({ type: 'refuse', x: P.x, y: P.y });
}
function updateRefuse(dt) {
  refT += dt;
  ovrW = approach(ovrW, refT < 2.4 ? 1 : 0, 8, dt);
  // face the wall and reach; then turn half away from it, shaking the head, and trudge off
  const turn = smooth(0.95, 1.5, refT);
  const want = refFace + (Math.cos(refFace) >= 0 ? 1 : -1) * Math.PI * 0.8 * turn;
  P.facing = wrapPi(P.facing + clamp(wrapPi(want - P.facing), -6 * dt, 6 * dt));
  const reach = smooth(0.1, 0.5, refT) * (1 - smooth(0.85, 1.2, refT));
  const shake = refT > 1.1 && refT < 1.9 ? Math.sin((refT - 1.1) * 16) * 0.55 * Math.sin(clamp((refT - 1.1) / 0.8) * Math.PI) : 0;
  const walkK = smooth(1.5, 1.7, refT) * (1 - smooth(2.4, 2.6, refT));
  if (walkK > 0) {
    const st = 4.5 * walkK * dt, nx = P.x - Math.cos(refFace) * st, ny = P.y - Math.sin(refFace) * st * KY;
    if (walkable(nx, ny)) { P.x = nx; P.y = ny; }
  }
  const ph = Math.sin(refT * Math.PI * 2 * 1.6) * walkK;
  ovr = {
    hz: 7.9 - 0.3 * reach - 0.15 * Math.abs(ph), leanF: 0.05 + 0.12 * reach + 0.12 * walkK, leanS: envW.gust * 0.1,
    feet: [[0.3 * reach + 1.1 * ph, -1, Math.max(0, ph) * 0.6], [0.5 * reach - 1.1 * ph, 1, Math.max(0, -ph) * 0.6]],
    hands: [mix([0.3, -1.9, 8.2], [1.2, -2.2, 10.6], reach * 0.5), mix([0.3, 1.9, 8.2], [2.0, 2.5, 15.2], reach)],
    poleA: [[-0.5, -1, -0.5], [-0.5, 1, -0.5]], poleL: [[1, -0.15, 0.1], [1, 0.15, 0.1]],
    hemAttach: 0, facePitch: lerp(0.15, -0.5, smooth(0.2, 0.6, refT) * (1 - smooth(1.0, 1.4, refT))) + 0.2 * smooth(1.6, 2.0, refT), faceYaw: shake,
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
function startFall(strength, dir) {
  if (P.mode === 'climb' || P.mode === 'down') return;
  P.mode = 'down'; downT = 0; route = null;
  downDir = dir ?? envW.wa;
  const v = 9 + 7 * strength;
  downV = { x: Math.cos(downDir) * v, y: Math.sin(downDir) * v * KY };
  state.events.push({ type: 'fall', strength });
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
  downT += dt;
  ovrW = approach(ovrW, downT < 3.2 ? 1 : 0, 10, dt);
  // thrown: spin to face downwind (face-down, head downwind) and slide
  P.facing = wrapPi(P.facing + clamp(wrapPi(downDir - P.facing), -9 * dt, 9 * dt));
  const f = Math.exp(-(downT < 0.4 ? 1.5 : 5) * dt);
  downV.x *= f; downV.y *= f;
  const nx = P.x + downV.x * dt, ny = P.y + downV.y * dt;
  if (walkable(nx, ny)) { P.x = nx; P.y = ny; } else { downV.x = downV.y = 0; }
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
  if (downT >= 3.4) { P.mode = 'walk'; P.vx = P.vy = 0; }
}

// --- cowering in a storm, hunkering in the lee of rock -----------------------------------------------
function updateCower(dt, active) {
  idleT = active ? 0 : idleT + dt;
  const wo = state.weather.whiteout ?? 0;
  const storm = wo > 0.45 || envW.wEff > 0.78;
  const want = !active && idleT > 0.8 && storm && P.mode !== 'approach' && shoveT <= 0;
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
  P.sheltered = cowerW * clamp(0.2 + 0.8 * envW.shelter * (0.45 + 0.55 * hunkerW));
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
  const x = P.x + S * c - s * st * sn;
  const y = P.y + (S * sn + s * st * c) * KY;
  const weight = prof.weight * (0.6 + 0.4 * pose.gait);
  state.events.push({ type: 'step', x, y, terrain: ter, foot, weight, angle: P.facing, shoe: shoesOn() });
  if ((ter === 'ice' || ter === 'thin') && slipT <= 0 && rand() < (ter === 'ice' ? 0.09 : 0.05)) { slipT = 0.9; slipSide = s; }
  const shoe = shoesOn();
  if (ter === 'deep' && !shoe && staggerT <= 0 && rand() < 0.1) { staggerT = 0.75; staggerSide = rand() < 0.5 ? -1 : 1; }
  if (ter === 'thin' && rand() < 0.22) state.events.push({ type: 'crack', x, y, strength: 0.3 + rand() * 0.7 });
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
function updateBreath(dt, ter, g, wEff, wa) {
  const exert = clamp(g * (ter === 'deep' ? 1 : ter === 'snow' ? 0.6 : ter === 'thin' ? 0.5 : 0.4) + wEff * 0.3);
  breathStrong = exert;
  breathT -= dt;
  if (breathT <= 0) {
    breathT = lerp(2.6, 0.9, exert) * (0.85 + rand() * 0.3);
    // Breath shows with the cold (weather.cold 0..1, colder at night and in wind): barely an
    // occasional wisp when mild, a clear puff every exhale from ~0.6, dense clouds past 0.85.
    const cold = clamp(state.weather.cold ?? 0.4);
    const vis = smooth(0.15, 0.7, cold);
    if (cold >= 0.3 || rand() < 0.3) {
      // one plume per exhale (plus a second, thinner one when it's bitter), leaving the face
      // opening, stretching downwind and tearing into curls. Exerting: small and quick; standing
      // in hard cold: big, slow and long-lived.
      const n = 1 + (cold > 0.75 ? 1 : 0) + (cold > 0.88 ? 1 : 0);
      const fa = P.facing + pose.torsoYaw + pose.headYaw;
      const fc = Math.cos(fa), fs = Math.sin(fa);
      const size = (0.55 + 0.9 * cold + smooth(0.85, 1, cold) * 0.5) * (1 - 0.4 * exert);
      for (let i = 0; i < n; i++) {
        const v = 2.0 + exert * 3.5;
        puffs.push({
          x: faceWorld.x + fc * 0.9, y: faceWorld.y + fs * 0.9 * KY, z: faceWorld.z - 0.1 * i,
          vx: fc * v + P.vx * 0.6, vy: fs * v * KY + P.vy * 0.6, vz: 0.12 * cold,
          age: -i * 0.12, life: (2.0 + rand() * 1.0) * (0.6 + 0.4 * smooth(0.3, 0.6, cold)) * (1 - 0.3 * exert) * (1 - wEff * 0.25),
          r: (1.1 + rand() * 0.3) * size, a: (cold < 0.3 ? 0.12 : lerp(0.3, 0.7, smooth(0.3, 0.6, cold))) * (i ? 0.6 : 1),
          curls: 2 + Math.floor(rand() * 3), seed: rand() * 6.28,
        });
      }
      if (puffs.length > 80) puffs.splice(0, puffs.length - 80);
    }
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
  const breathe = Math.sin(t * Math.PI * 2 / lerp(3.4, 1.3, breathStrong)) * lerp(0.25, 0.12, g);
  const shv = pose.shiver * 0.12;
  const jitR = shv * Math.sin(t * 71), jitZ = shv * 0.6 * Math.sin(t * 53 + 1);

  // Hips: bob, crouch, weight shift, stagger
  const bob = -pose.bob * g * Math.cos(ph2 * 2);
  const sinkNow = pose.sink;
  const crouch = pose.crouch + idle * 0.1 + pose.brace * 0.3 + pose.hug * 0.15 + slip * 0.4 + stag * 0.3 + pose.shiver * 0.1;
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
    hz = lerp(hz, 3.4, cw); leanF = lerp(leanF, 0.78, cw);
    leanS = lerp(leanS, hunkerSide * 0.28 * hunkerW, cw); twist = lerp(twist, 0, cw);
  }
  // strapping snowshoes on / off: kneel with the hands at the bindings (a quick bend when the
  // game pulls them off)
  const strK = strapT > 0 ? Math.sin(clamp(1 - strapT / strapDur) * Math.PI) : 0;
  const strDeep = strapLock ? 1 : 0.5;
  if (strK > 0.001) { hz -= 3.0 * strK * strDeep; leanF += 0.75 * strK * strDeep; twist = lerp(twist, 0, strK); }
  // compass: bent over the pack while rummaging; braced and head bowed holding it out
  const rw = CP.rum, cow = CP.out;
  if (rw > 0.001 || cow > 0.001) {
    hz -= 0.5 * rw + 0.25 * cow * (1 - g);
    leanF += 0.38 * rw + 0.1 * cow;
    twist = lerp(twist, 0, Math.max(rw, cow));
  }
  // climb / knockdown override
  const O = ovr && ovrW > 0.001 ? ovr : null, ow = O ? ovrW : 0;
  const climbW = O && O.full && P.mode === 'climb' ? ow : 0;
  if (O) { hz = lerp(hz, O.hz, ow); leanF = lerp(leanF, O.leanF, ow); leanS = lerp(leanS, O.leanS, ow); twist = lerp(twist, 0, ow); }
  const tf = { cy: Math.cos(twist), sy: Math.sin(twist), cp: Math.cos(leanF), sp: Math.sin(leanF), cr: Math.cos(leanS), sr: Math.sin(leanS), hx, hr, hz };
  const upZ = breathe + jitZ;
  const shoulderC = torsoToBody([0, jitR, SPINE + upZ], tf);

  // Legs
  const legs = [];
  for (const s of [-1, 1]) {
    const q = (phase + (s < 0 ? 0 : 0.5)) % 1;
    const foot = legFoot(q, s, S, pose.lift * g, sinkNow, pose.stance);
    if (g < 1) foot[2] = lerp(-sinkNow, foot[2], g);
    if (shoeW > 0) foot[1] += s * 0.45 * shoeW * clamp(foot[2] / 0.8);   // frames swung wide of each other
    if (slip > 0 && s === slipSide) { foot[1] += s * 1.4 * slip; foot[0] += 0.6 * slip; }
    // idle: the unloaded leg (opposite the weight shift) relaxes, heel lifting a touch
    const unload = idle * clamp(-shift * s);
    foot[0] += unload * 0.35; foot[1] -= s * unload * 0.15; foot[2] += unload * 0.2;
    // foot stamp
    if (stampOn > 0 && s === stampSide) foot[2] += Math.sin(clamp(stampOn / 0.45) * Math.PI) * 1.1;
    let ft = foot, poleL = [1, s * 0.15, 0.1];
    if (cw > 0.001) { ft = mix(ft, [0.9, s * 1.15, 0], cw); poleL = mix(poleL, [1, s * 0.6, 0.2], cw); }
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
    const armF = -legF * pose.swing * g * 1.1;
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
    if (CP.out > 0.001) {
      const shake = envW.wEff * 0.14;
      const hT = torsoToBody([1.55 + Math.sin(t * 27) * shake, s * 0.38 + Math.sin(t * 31 + 1) * shake, SPINE - 1.25 + Math.sin(t * 23 + 2) * shake], tf);
      handB = mix(handB, hT, CP.out); pole = mix(pole, torsoDir([-0.2, s * 1.1, -0.7], tf), CP.out);
      cpFull = Math.max(cpFull, CP.out);
    }
    if (O) { handB = mix(handB, O.hands[s < 0 ? 0 : 1], ow); pole = mix(pole, O.poleA[s < 0 ? 0 : 1], ow); }
    const a = ik(shoulder, handB, UPPER_ARM, FOREARM, pole);
    const full = (O && ow > 0.5 && O.full) || cw > 0.4 || flung || (!O && cpFull > 0.4);
    const active = full ? 1 : Math.max(spreadW, pose.hug, Math.max(0, pose.work - 0.3) * 1.4, shieldW, pose.creep);
    arms.push({ s, shoulder, elbow: a.joint, hand: a.end, active, spreadW, full, overHead, axe: O && O.axes ? O.axes * ow : 0, cp: !O && cpFull > 0.4 });
  }

  // Head / hood. Thin ice: looking down at the feet.
  const hunch = pose.hunch;
  const head = torsoToBody([0.4 + hunch * 0.6, jitR, SPINE + HEAD_UP - 0.1 - hunch * 0.45 + upZ * 1.1], tf);
  const peak = torsoToBody([-0.85 + hunch * 0.5 + wdF * gk * 0.8, wdR * gk * 0.8, SPINE + HEAD_UP + 1.15 + upZ], tf);
  const drape = torsoToBody([-1.1, 0, SPINE - 0.5], tf);
  const faceYaw = twist + pose.headYaw + (O && O.faceYaw ? O.faceYaw * ow : 0);
  let facePitch = 0.15 + hunch; // head always bowed a little; 1 = looking at the feet
  if (cw > 0.001) facePitch = lerp(facePitch, 0.9, cw);
  facePitch = lerp(facePitch, 0.95, Math.max(CP.rum, CP.out * 0.85, strK));
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
    const pf = f * c - r * sn + 0.55 * k, prr = f * sn + r * c, pz = z - 1.5 * k + 0.5 * Math.sin(th);
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
const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - k).toString(16).padStart(2, '0')).join('');
function drawFigure(ctx, rig, X, Y) {
  const yaw = rig.yaw;
  const dk = Math.round(6 * cowerW);       // cowering hump separates from the whiteout
  for (const k of ['coat', 'panel', 'hood', 'rim', 'sleeveL', 'sleeveD', 'pack']) C[k] = dk ? shade(C0[k], dk) : C0[k];
  const pr = v => { const w = toWorld(v, yaw); return [X + w.x, Y + w.y - w.z]; };
  const depth = v => toWorld(v, yaw).g;
  const cxBody = pr(rig.hips)[0];

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
    if (!buried) {
      const fc = [ank[0] - 0.1, ank[1], ank[2] - 0.2];
      const toe = [ank[0] + 0.7, ank[1], Math.max(L.foot[2] + 0.2, ank[2] - 0.35)];
      limb(ctx, [pr(fc), pr(toe)], 0.95, C.boot, 0.17);
      if (rig.climbing > 0.3 || P.terrain === 'ice' || P.terrain === 'thin') {
        ctx.strokeStyle = INK; ctx.lineWidth = 0.12; ctx.lineCap = 'round'; ctx.beginPath();
        for (const t of [0.05, 0.45, 0.85]) {
          const q = pr([lerp(fc[0], toe[0], t), ank[1], lerp(fc[2], toe[2], t) - 0.45]);
          ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + 0.05, q[1] + 0.32);
        }
        ctx.stroke();
      }
    } else lips.push(endPt);
  }


  // --- arms: under the coat; forearms that come out are drawn again on top ---------------------
  const arms = rig.arms.map(A => ({ ...A, d: depth(A.shoulder), dh: depth(A.hand) }));
  const headD = depth(rig.head);
  const mitt = h => {
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
    limb(ctx, pts, 1.15, sleeveCol(pts[1]));
    if (A.axe > 0.3) drawAxe(ctx, A, pr);
    mitt(pts[2]);
  };
  const drawForearm = A => {
    const from = mix(A.elbow, A.hand, A.spreadW > 0.5 ? 0.25 : lerp(0.45, 0.12, pose.hug));
    const pts = [pr(from), pr(A.hand)];
    limb(ctx, pts, 0.85, sleeveCol(pts[1]));
    if (A.axe > 0.3) drawAxe(ctx, A, pr);
    mitt(pts[1]);
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
  if (packD < 0) drawPack(ctx, rig, pr);

  drawCoat(ctx, rig, pr, depth);

  if (packD >= 0) drawPack(ctx, rig, pr);
  const out = arms.filter(A => !A.behind && !A.hidden && !(A.cp && fromBehind) && A.active > 0.3);
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
  return [{
    x: P.x, y: P.y,   // feet: main.js sorts by terrain.sortKey(x, y) (face foot on a cliff, + height on a plateau)
    draw(ctx) {
      const rig = buildRig();
      const X = P.x, Y = P.y;
      const fw = toWorld(rig.head, rig.yaw);
      faceWorld = { x: X + fw.x, y: Y + fw.y, z: fw.z - 0.5 };
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
    },
  }];
}

export function drawScreen(ctx) {
  if (!state.debug) return;
  ctx.fillStyle = '#000'; ctx.font = '12px monospace';
  const s = `${P.terrain} spd ${P.speed.toFixed(1)} gait ${pose.gait.toFixed(2)} lean ${P.lean.toFixed(2)} shield ${pose.shield.toFixed(2)} hug ${pose.hug.toFixed(2)} brace ${pose.brace.toFixed(2)} exp ${P.exposure.toFixed(2)}`;
  ctx.fillText(s, 10, state.view.h - 12);
}

export const _debug = { pose, climb: () => climb, route: () => route, ovr: () => ovr, ovrW: () => ovrW, findPath: (...a) => findPath(...a), shoes: () => [shoesOn(), shoesDrawn(), strapT] };
