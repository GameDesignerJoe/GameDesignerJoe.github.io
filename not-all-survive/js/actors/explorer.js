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
const puffs = [], kicks = [];
let rng = 1234567;
const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };

export function init() {
  P.facing = Math.PI / 2;
  if (state.params.get('demo') === 'dir') P.facing = (parseFloat(state.params.get('a') || '90') * Math.PI) / 180;
}

function walkable(x, y) {
  try { return T.isWalkable(x, y) !== false; } catch { return true; }
}

export function update(dt) {
  if (dt <= 0) return;
  const inp = state.input;
  const ter = (T.terrainAt(P.x, P.y)) || 'snow';
  P.terrain = ter;
  const prof = PROFILES[ter] || PROFILES.snow;
  let sf = stubTerrain ? prof.speed : (T.speedFactor(ter) ?? 1);
  // Ice is walked cautiously (Joe): walking pace stays near the cautious profile, and any extra
  // speed the terrain grants on ice shows up as glide (low friction), not frantic feet.
  if (ter === 'ice' || ter === 'thin') sf = Math.min(sf, prof.speed * 1.15);
  if (!(sf > 0)) sf = prof.speed;

  // --- wind ---------------------------------------------------------------------------
  const wa = state.wind.angle ?? 0, ws = state.wind.speed ?? 0, gust = state.wind.gust ?? 0;
  let shelter = 0;
  try { shelter = T.shelterAt ? clamp(T.shelterAt(P.x, P.y) || 0) : 0; } catch { shelter = 0; }
  const wEff = clamp((ws + gust * 0.7) * (1 - shelter));
  P.exposure = wEff;
  const windPose = smooth(0.42, 0.85, wEff);
  // A gust arriving: a stagger that pushes the body and hood downwind.
  const gRise = Math.max(0, gust - lastGust) / dt;
  lastGust = gust;
  pose.gustKick = Math.max(pose.gustKick - dt * 1.6, clamp(gRise * 0.35) * (1 - shelter));

  // --- intent ----------------------------------------------------------------------------
  const mag = Math.min(1, Math.hypot(inp.x, inp.y));
  const active = mag > 0.05;
  const wantDir = active ? Math.atan2(inp.y / KY, inp.x) : P.facing;
  const into = Math.max(0, -Math.cos(wantDir - wa));

  // Pause at each foot plant on ice: |sin| is 0 at the plants.
  tentMod = 1 - pose.tent * (1 - Math.pow(Math.abs(Math.sin(phase * Math.PI * 2)), 0.6));
  let spd = BASE_SPEED * sf * mag * (1 - 0.45 * wEff * into) * (1 - pose.tent * 0.35);
  if (staggerT > 0) spd *= 0.35;
  if (slipT > 0) spd *= 0.5;
  const tvx = active ? Math.cos(wantDir) * spd : 0;
  const tvy = active ? Math.sin(wantDir) * spd * KY : 0;
  const k = active ? prof.accel : prof.fric;
  P.vx = approach(P.vx, tvx, k, dt);
  P.vy = approach(P.vy, tvy, k, dt);
  const slick = ter === 'ice' || ter === 'thin' ? 2.5 : 1;
  const push = gust * (1 - shelter) * 7 * slick * dt;
  P.vx += Math.cos(wa) * push;
  P.vy += Math.sin(wa) * push * KY;
  if (staggerT > 0) { P.vx += -Math.sin(P.facing) * staggerSide * 6 * dt; P.vy += Math.cos(P.facing) * staggerSide * 6 * dt * KY; }

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
  }

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
  const wl = windPose * (0.18 + 0.2 * g);
  pose.windLeanF = approach(pose.windLeanF, Math.cos(up) * wl * back, 3, dt);
  pose.windLeanS = approach(pose.windLeanS, Math.sin(up) * wl * 0.8, 3, dt);
  const side = Math.sin(up);
  if (Math.abs(side) > 0.45) pose.shieldSide = side > 0 ? 1 : -1;
  else if (pose.shield < 0.1) pose.shieldSide = Math.cos(P.facing) >= 0 ? 1 : -1;
  const shieldT = windPose * smooth(0.15, 0.75, g) * clamp(0.15 + into * 1.1 + Math.abs(side) * 0.35);
  pose.shield = approach(pose.shield, shieldT, 3, dt);
  const gustAmt = smooth(0.12, 0.5, gust);
  pose.hug = approach(pose.hug, idle * clamp(windPose * (0.7 + 0.3 * wEff) + pose.shiver * 0.6), 2.5, dt);
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
  if (shiverT <= 0) { shiverT = 3 + rand() * 4; if (wEff > 0.4 && idle > 0.5) shiverOn = 0.8 + rand() * 0.6; }
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
  pose.windAmt = approach(pose.windAmt, clamp(smooth(0.15, 0.95, wEff) * 0.9 + gust * 0.5), 4, dt);

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
}

function footDown(foot, prof, ter) {
  const S = pose.stepEff * pose.gait * 0.5;
  const s = foot === 'L' ? -1 : 1;
  const st = pose.stance + (slipT > 0 && s === slipSide ? 1.2 : 0);
  const c = Math.cos(P.facing), sn = Math.sin(P.facing);
  const x = P.x + S * c - s * st * sn;
  const y = P.y + (S * sn + s * st * c) * KY;
  const weight = prof.weight * (0.6 + 0.4 * pose.gait);
  state.events.push({ type: 'step', x, y, terrain: ter, foot, weight, angle: P.facing });
  if ((ter === 'ice' || ter === 'thin') && slipT <= 0 && rand() < (ter === 'ice' ? 0.09 : 0.05)) { slipT = 0.9; slipSide = s; }
  if (ter === 'deep' && staggerT <= 0 && rand() < 0.1) { staggerT = 0.75; staggerSide = rand() < 0.5 ? -1 : 1; }
  if (ter === 'thin' && rand() < 0.22) state.events.push({ type: 'crack', x, y, strength: 0.3 + rand() * 0.7 });
  // snow kicked up by the swinging boot
  if (ter === 'deep') {
    const n = 6;
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
    const n = 3 + Math.round(exert * 2);
    const fa = P.facing + pose.torsoYaw + pose.headYaw;
    const fc = Math.cos(fa), fs = Math.sin(fa);
    for (let i = 0; i < n; i++) {
      puffs.push({
        x: faceWorld.x + fc * 1.1, y: faceWorld.y + fs * 1.1 * KY, z: faceWorld.z,
        vx: fc * (2.5 + exert * 2) + P.vx * 0.6, vy: fs * (2.5 + exert * 2) * KY + P.vy * 0.6, vz: -0.2,
        age: -i * 0.07, life: 1.2 + rand() * 0.6 - wEff * 0.4, r: 0.18 + rand() * 0.14,
      });
    }
    if (puffs.length > 40) puffs.splice(0, puffs.length - 40);
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
  const hz = HIP_H - crouch * 1.3 - sinkNow * 0.85 + bob + pose.lift * g * 0.06 - Math.abs(shift) * 0.12;

  const leanF = pose.lean * (0.4 + 0.6 * g) + pose.windLeanF + pose.hug * 0.12 + pose.brace * 0.06 + stag * 0.25
    - slip * 0.1 + pose.work * g * 0.05 * Math.cos(ph2 * 2) + wdF * gk * 0.18;
  const leanS = pose.windLeanS + slip * slipSide * 0.22 + stag * staggerSide * 0.2 + g * 0.03 * Math.sin(ph2)
    - shift * 0.05 + wdR * gk * 0.22;
  const twist = pose.torsoYaw + g * pose.swing * 0.07 * Math.cos(ph2);
  const tf = { cy: Math.cos(twist), sy: Math.sin(twist), cp: Math.cos(leanF), sp: Math.sin(leanF), cr: Math.cos(leanS), sr: Math.sin(leanS), hx, hr, hz };
  const upZ = breathe + jitZ;
  const shoulderC = torsoToBody([0, jitR, SPINE + upZ], tf);

  // Legs
  const legs = [];
  for (const s of [-1, 1]) {
    const q = (phase + (s < 0 ? 0 : 0.5)) % 1;
    const foot = legFoot(q, s, S, pose.lift * g, sinkNow, pose.stance);
    if (g < 1) foot[2] = lerp(-sinkNow, foot[2], g);
    if (slip > 0 && s === slipSide) { foot[1] += s * 1.4 * slip; foot[0] += 0.6 * slip; }
    // idle: the unloaded leg (opposite the weight shift) relaxes, heel lifting a touch
    const unload = idle * clamp(-shift * s);
    foot[0] += unload * 0.35; foot[1] -= s * unload * 0.15; foot[2] += unload * 0.2;
    // foot stamp
    if (stampOn > 0 && s === stampSide) foot[2] += Math.sin(clamp(stampOn / 0.45) * Math.PI) * 1.1;
    const hip = [hx, hr + s * 0.78, hz];
    const ankle = [foot[0], foot[1], foot[2] + ANKLE_H];
    const kn = ik(hip, ankle, THIGH, SHIN, [1, s * 0.15, 0.1]);
    legs.push({ s, hip, knee: kn.joint, ankle: kn.end, foot, q });
  }

  // Arms (torso-frame targets, IK in the body frame). At rest they hang inside the coat.
  const arms = [];
  const sh = pose.shieldSide;
  for (const s of [-1, 1]) {
    const shoulderT = [0, s * SHOULDER_W + jitR, SPINE - 0.4 + upZ];
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
    const handB = torsoToBody(hand, tf);
    const pole = torsoDir([-1 + shieldW * 0.6 + pose.work * 1.0 + spreadW * 0.6 + pose.creep * 0.5, s * (0.8 + shieldW * 1.2 + spreadW * 0.5), -0.6 - spreadW * 0.6 - pose.work * 0.6], tf);
    const a = ik(shoulder, handB, UPPER_ARM, FOREARM, pole);
    const active = Math.max(spreadW, pose.hug, Math.max(0, pose.work - 0.3) * 1.4, shieldW, pose.creep);
    arms.push({ s, shoulder, elbow: a.joint, hand: a.end, active, spreadW });
  }

  // Head / hood. Thin ice: looking down at the feet.
  const hunch = pose.hunch;
  const head = torsoToBody([0.4 + hunch * 0.6, jitR, SPINE + HEAD_UP - 0.1 - hunch * 0.45 + upZ * 1.1], tf);
  const peak = torsoToBody([-0.85 + hunch * 0.5 + wdF * gk * 0.8, wdR * gk * 0.8, SPINE + HEAD_UP + 1.15 + upZ], tf);
  const drape = torsoToBody([-1.1, 0, SPINE - 0.5], tf);
  const faceYaw = twist + pose.headYaw;
  const facePitch = 0.15 + hunch; // head always bowed a little; 1 = looking at the feet

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
      if (reach > 0) { pf += uf * reach * w; pr += ur * reach * w; }
      const lift = L.knee[2] - (hemC[2] + 0.4);
      if (lift > 0) pz += lift * w * 0.85;
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
    hem.push([pf, pr, pz]);
  }

  // Small rucksack on the back.
  const pack = [];
  for (const [f, r, z] of [[-1.0, -0.8, 2.4], [-1.0, 0.8, 2.4], [-1.0, 0.8, 0.8], [-1.0, -0.8, 0.8],
    [-1.4, -0.72, 2.3], [-1.4, 0.72, 2.3], [-1.4, 0.72, 0.95], [-1.4, -0.72, 0.95]]) pack.push(torsoToBody([f, r, z], tf));

  return { yaw, legs, arms, head, peak, drape, faceYaw, facePitch, top, hem, pack, shoulderC, hips: [hx, hr, hz], tf, sinkNow, hemC, twist, hemYaw };
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
function darkSide(ctx, clipPts, a, b, alpha = 0.62, soft = 0.4) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const A = [a[0] - ux * 30, a[1] - uy * 30], B = [b[0] + ux * 30, b[1] + uy * 30];
  // right-hand normal (screen): (-uy, ux) or (uy, -ux) — pick the one pointing +x
  let nx = -uy, ny = ux; if (nx < 0) { nx = -nx; ny = -ny; }
  ctx.save();
  ctx.beginPath(); polyPath(ctx, clipPts); ctx.clip();
  const quad = off => { ctx.beginPath(); ctx.moveTo(A[0] + nx * off, A[1] + ny * off); ctx.lineTo(B[0] + nx * off, B[1] + ny * off); ctx.lineTo(B[0] + nx * 40, B[1] + ny * 40); ctx.lineTo(A[0] + nx * 40, A[1] + ny * 40); ctx.closePath(); };
  if (soft > 0) { quad(-soft); ctx.fillStyle = `rgba(26,26,28,${alpha * 0.3})`; ctx.fill(); }
  quad(0); ctx.fillStyle = `rgba(26,26,28,${alpha})`; ctx.fill();
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
  ctx.globalAlpha = 0.34;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shCan, X - SH_OX, Y - SH_OY, SH_W, SH_H);
  ctx.restore();
  // dark contact shadow right under the boots
  ctx.fillStyle = 'rgba(30,31,34,0.28)';
  for (const L of rig.legs) {
    const f = toWorld([L.foot[0], L.foot[1], 0], rig.yaw);
    ctx.beginPath(); ctx.ellipse(X + f.x + 0.4, Y + f.y + 0.2, 1.1, 0.48, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// --- the figure -------------------------------------------------------------------------------------
const C = {
  coat: '#9c9c9c', panel: '#b2b2b0', hood: '#a2a2a2', rim: '#c4c4c2',
  trousersL: '#5a5a5a', trousersD: '#333333', boot: '#2a2a2a', mitt: '#363636',
  sleeveL: '#9c9c9c', sleeveD: '#545454', face: '#3a3a3a', nose: '#8e8e8e',
  pack: '#8a8a8a',
};

function drawFigure(ctx, rig, X, Y) {
  const yaw = rig.yaw;
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
  // The arm on the far side stays hidden under the cape (side-on, an arm reaching away from
  // the camera would otherwise poke up behind the hood like an ear).
  for (const A of arms) if ((A.spreadW > 0.3 || (A.s === pose.shieldSide && pose.shield > 0.3)) && A.d >= -0.45) {
    const pts = [pr(A.shoulder), pr(A.elbow), pr(A.hand)];
    limb(ctx, pts, 1.15, sleeveCol(pts[1]));
    mitt(pts[2]);
  }
  const drawForearm = A => {
    const from = mix(A.elbow, A.hand, A.spreadW > 0.5 ? 0.25 : lerp(0.45, 0.12, pose.hug));
    const pts = [pr(from), pr(A.hand)];
    limb(ctx, pts, 0.85, sleeveCol(pts[1]));
    mitt(pts[1]);
  };

  const packD = depth(rig.pack[4]);
  if (packD < 0) drawPack(ctx, rig, pr);

  drawCoat(ctx, rig, pr, depth);

  if (packD >= 0) drawPack(ctx, rig, pr);
  const out = arms.filter(A => A.active > 0.3 && (A.d >= -0.45 || A.dh > headD - 0.2));
  for (const A of out) if (A.dh <= headD + 0.6) drawForearm(A);
  drawHood(ctx, rig, pr);
  for (const A of out) if (A.dh > headD + 0.6) drawForearm(A);
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
  const poly = dense(sil, sharp, 3);

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
    ctx.lineWidth = 0.15; ctx.strokeStyle = `rgba(38,38,38,${0.35 + 0.35 * v})`; ctx.stroke();
  }
  ctx.restore();

  // Hard light/dark split at the terminator.
  const tPhi = TERM_A - (yaw + rig.hemYaw);
  const ta = pr(ringAt(rig.top, tPhi)), tb = pr(ringAt(rig.hem, tPhi));
  darkSide(ctx, poly, [ta[0] + 0.15, ta[1]], tb, 0.6, 0.35);

  // Internal ink marks: shadow under the shoulder on the dark side, cloth turn at the hem.
  ctx.save();
  ctx.beginPath(); polyPath(ctx, poly); ctx.clip();
  ctx.strokeStyle = 'rgba(20,20,20,0.55)'; ctx.lineCap = 'round';
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
  darkSide(ctx, hull, [cx + 0.1, 0], [cx + 0.25, 1], 0.55, 0);
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
    ctx.strokeStyle = 'rgba(38,38,38,0.45)'; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
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

function drawPuffs(ctx, list) {
  for (const p of list) {
    if (p.age < 0) continue;
    const t = p.age / p.life;
    const a = 0.42 * (1 - t) * Math.min(1, p.age * 6);
    const r = p.r + t * 1.0;
    ctx.beginPath(); ctx.arc(p.x, p.y - p.z, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(246,247,248,${a})`; ctx.fill();
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
    y: P.y,
    draw(ctx) {
      const rig = buildRig();
      const X = P.x, Y = P.y;
      const fw = toWorld(rig.head, rig.yaw);
      faceWorld = { x: X + fw.x, y: Y + fw.y, z: fw.z - 0.5 };
      drawShadow(ctx, rig, X, Y);
      // breath behind the head is drawn before the figure, the rest after it
      const headY = Y + fw.y;
      // (only vapour clearly in front of the face may cross the figure, never smear the hood)
      const front = p => p.y > headY + 0.9;
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

export const _debug = { pose };
