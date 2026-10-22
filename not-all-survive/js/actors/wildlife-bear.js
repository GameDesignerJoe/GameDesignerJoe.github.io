// The polar bear: a procedural quadruped rig (a smooth chain of body blobs, wide paired
// haunches, jointed legs with world-planted feet and a lateral-sequence walk), its
// behaviour brain, and its drawing.
import { state } from '../state.js';
import { proj, inkUnion, pathOf, clamp, lerp, angDiff, approach, ik, SHX, SHY, CAM_Y, CAM_Z } from './wildlife-rig.js';

const TAU = Math.PI * 2;
const STRIDE = 7.4, DUTY = 0.64;
const INK = '#3a3a3a';
// [stand, sit, lie] x (f, top z, bottom z)
const PROFILE = [
  [[-9.0, 11.0, 7.6], [-7.6, 6.2, 0.8], [-9.0, 6.4, 1.2]],
  [[-7.2, 12.0, 6.0], [-6.0, 7.6, 0.5], [-7.0, 7.4, 0.5]],
  [[-4.8, 11.8, 5.8], [-4.4, 8.8, 1.0], [-4.8, 7.4, 0.4]],
  [[-2.0, 11.3, 5.8], [-2.2, 10.4, 3.0], [-2.0, 7.0, 0.5]],
  [[1.0, 11.4, 5.2], [0.2, 12.1, 4.4], [1.0, 7.2, 0.5]],
  [[3.6, 11.9, 4.7], [1.8, 13.4, 5.4], [3.6, 7.6, 0.6]],
  [[5.0, 11.8, 5.8], [3.0, 13.9, 7.0], [5.0, 8.0, 1.6]],
];
// lateral-sequence walk: LH, LF, RH, RF (the diagonal pairs move close together)
const LEGS = [
  { front: true, f: 3.7, l: -2.1, fl: -2.3, off: 0.25 },
  { front: true, f: 3.7, l: 2.1, fl: 2.3, off: 0.75 },
  { front: false, f: -6.6, l: -2.9, fl: -3.7, off: 0.0 },
  { front: false, f: -6.6, l: 2.9, fl: 3.7, off: 0.5 },
];

export function makeBear(x, y, home, opts = {}) {
  return {
    x, y, heading: Math.random() * TAU, speed: 0, turn: 0, cycle: 0, gait: 0,
    home: { x: home.x, y: home.y, r: home.r },
    st: 'pause', t: 1 + Math.random() * 2, goal: null,
    sit: 0, lie: 0, headUp: 0, yaw: 0, sniff: 0, circle: Math.random() < 0.5 ? 1 : -1,
    awareRange: opts.awareRange ?? 150, cool: 0, growlCool: 3, huffCool: 6,
    force: opts.force || null, since: 0, feet: null,
  };
}

// ---------------------------------------------------------------- behaviour
function pick(b, w) {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * TAU, r = b.home.r * Math.sqrt(Math.random());
    const gx = b.home.x + Math.cos(a) * r, gy = b.home.y + Math.sin(a) * r;
    if (Math.hypot(gx - b.x, gy - b.y) > 40 && w.clearLine(b.x, b.y, gx, gy, true)) return { x: gx, y: gy };
  }
  return { x: b.home.x, y: b.home.y };
}

function setState(b, st, t) { b.st = st; b.t = t; b.since = 0; }

function nextIdle(b, w) {
  const r = Math.random();
  if (r < 0.28) setState(b, 'sniffAir', 3 + Math.random() * 3);
  else if (r < 0.5) setState(b, 'sniffGround', 4 + Math.random() * 4);
  else if (r < 0.62) setState(b, 'sit', 7 + Math.random() * 6);
  else if (r < 0.72) setState(b, 'lie', 10 + Math.random() * 10);
  else if (r < 0.82) setState(b, 'pause', 1.5 + Math.random() * 2);
  else { b.goal = pick(b, w); setState(b, 'walk', 30); }
}

function emit(b, kind) { state.events.push({ type: 'bear', x: b.x, y: b.y, kind }); }

export function updateBear(b, dt, w) {
  // nobody to watch: calm test mode, or the explorer is in the tent, dead, or gone
  const away = ['inside', 'tent-in', 'collapse', 'dead', 'gone'].includes(state.player.mode);
  const p = state.params.has('wlCalm') || away ? { x: -1e5, y: -1e5 } : state.player;
  const pdx = p.x - b.x, pdy = p.y - b.y, pd = Math.hypot(pdx, pdy);
  const toP = Math.atan2(pdy, pdx);
  b.t -= dt; b.since += dt;
  b.cool -= dt; b.growlCool -= dt; b.huffCool -= dt;

  let wantSpeed = 0, wantHead = 0, wantSit = 0, wantLie = 0, wantYaw = 0, sniff = 0, face = null;
  let track = false; // head turns to keep staring at the explorer
  const homeD = Math.hypot(b.x - b.home.x, b.y - b.home.y);

  if (b.force) {
    // Forced poses for captures: ?wlBear=walk|slow|sit|lie|sniff|ground|stare|stalk|h<deg>
    const f = b.force;
    if (f === 'walk' || f === 'slow') {
      if (!b.goal || Math.hypot(b.goal.x - b.x, b.goal.y - b.y) < 12) b.goal = pick(b, w);
      wantSpeed = f === 'slow' ? 2.2 : 7; face = Math.atan2(b.goal.y - b.y, b.goal.x - b.x); wantHead = -0.25;
    } else if (f === 'sit') { wantSit = 1; wantHead = 0.3; }
    else if (f === 'lie') { wantLie = 1; wantHead = -0.5; }
    else if (f === 'sniff') { wantHead = 1; sniff = 1; wantYaw = Math.sin(state.time * 0.7) * 0.35; }
    else if (f === 'ground') { wantHead = -1; sniff = 1; wantYaw = Math.sin(state.time * 1.4) * 0.4; }
    else if (f === 'stare') { face = toP; wantHead = -0.3; track = true; }
    else if (f === 'spin') { face = b.heading + 1.2; }
    if (f.startsWith('h')) { b.heading = parseFloat(f.slice(1)) * Math.PI / 180; }
  } else {
    // Awareness of the explorer interrupts anything calm.
    const calm = b.st !== 'alert' && b.st !== 'stalk' && b.st !== 'leave';
    if (calm && pd < b.awareRange && b.cool <= 0) { setState(b, 'alert', 2.5 + Math.random() * 1.5); emit(b, 'huff'); }

    switch (b.st) {
      case 'walk': case 'leave': {
        const gd = Math.hypot(b.goal.x - b.x, b.goal.y - b.y);
        face = Math.atan2(b.goal.y - b.y, b.goal.x - b.x);
        wantSpeed = 7; wantHead = -0.25;
        if (gd < 8 || b.t <= 0) nextIdle(b, w);
        break;
      }
      case 'pause': wantHead = -0.1; if (b.t <= 0) { b.goal = pick(b, w); setState(b, 'walk', 30); } break;
      case 'sniffAir':
        wantHead = 1; sniff = 1; wantYaw = Math.sin(b.since * 0.7) * 0.4;
        if (b.huffCool <= 0 && b.since > 1.2) { emit(b, 'huff'); b.huffCool = 9 + Math.random() * 8; }
        if (b.t <= 0) { b.goal = pick(b, w); setState(b, 'walk', 30); }
        break;
      case 'sniffGround':
        wantHead = -1; sniff = 1; wantYaw = Math.sin(b.since * 1.3) * 0.45;
        if (!b.goal || Math.hypot(b.goal.x - b.x, b.goal.y - b.y) < 6) b.goal = pick(b, w);
        face = Math.atan2(b.goal.y - b.y, b.goal.x - b.x);
        wantSpeed = 2.2;
        if (b.t <= 0) nextIdle(b, w);
        break;
      case 'sit': wantSit = 1; wantHead = 0.25 + Math.sin(b.since * 0.3) * 0.2; wantYaw = Math.sin(b.since * 0.4) * 0.5;
        if (b.t <= 0) { b.goal = pick(b, w); setState(b, 'walk', 30); } break;
      case 'lie': wantLie = 1; wantHead = -0.6; wantYaw = Math.sin(b.since * 0.25) * 0.3;
        if (b.t <= 0) { b.goal = pick(b, w); setState(b, 'walk', 30); } break;
      case 'alert':
        // stop dead, head up, nose working, turn to face
        face = toP; wantHead = 0.75; track = true;
        if (b.since < 1.4) sniff = 1;
        if (b.t <= 0) setState(b, 'stalk', 28 + Math.random() * 16);
        break;
      case 'stalk': {
        // close in (pathing round edges), then circle at 50-60 units, head low, eyes locked on
        track = true; wantHead = -0.4;
        b.routeT = (b.routeT || 0) - dt;
        if (b.routeT <= 0) { b.routeT = 0.8; b.route = w.route(b.x, b.y, p.x, p.y, true); }
        const R = b.route;
        const blocked = R && R.reach > 30; // geometry truly in the way
        if (pd > 64 && !blocked) {
          face = R ? Math.atan2(R.y - b.y, R.x - b.x) : toP;
          wantSpeed = pd > 110 ? 6.5 : 4.2;
        } else if (blocked) {
          // pace the edge nearest the explorer, head locked on, growling at long range
          const ex = R.x, ey = R.y, ed = Math.hypot(ex - b.x, ey - b.y);
          if (ed > 10) { face = Math.atan2(ey - b.y, ex - b.x); wantSpeed = 4; }
          else {
            if (!b.paceT || b.paceT <= 0) { b.paceT = 3 + Math.random() * 2; b.circle *= -1; }
            b.paceT -= dt;
            face = toP + b.circle * Math.PI / 2; wantSpeed = 2.4;
          }
          if (pd < 130 && b.growlCool <= 0) { emit(b, 'growl'); b.growlCool = 4 + Math.random() * 3; }
        } else if (pd < 34) { face = toP; wantHead = 0.45; wantSpeed = 0; // stands its ground
          if (b.growlCool <= 0) { emit(b, 'growl'); b.growlCool = 3 + Math.random() * 2; } }
        else {
          const bend = clamp((pd - 56) / 18, -0.6, 0.6);
          face = toP + b.circle * (Math.PI / 2 - bend);
          wantSpeed = 2.6;
          if (!w.walkable(b.x + Math.cos(face) * 12, b.y + Math.sin(face) * 12, true)) b.circle *= -1;
        }
        if (pd < 62 && b.growlCool <= 0) { emit(b, 'growl'); b.growlCool = 5 + Math.random() * 4; }
        if (b.t <= 0 || pd > 320) {
          b.cool = 30; b.goal = { x: b.home.x, y: b.home.y }; setState(b, 'leave', 60); emit(b, 'huff');
        }
        break;
      }
    }
  }

  if (track) {
    // head yaw holds the stare whatever the body is doing
    wantYaw = clamp(angDiff(b.heading, toP), -1.25, 1.25);
  }

  // Heading: heavy turning; the feet step around while turning on the spot.
  const h0 = b.heading, x0 = b.x, y0 = b.y;
  let turn = 0;
  if (face !== null && wantSpeed > 0.5) {
    const st = w.steer(b.x, b.y, face, b.st === 'stalk' ? 7 : 14, true);
    if (st !== null) face = st; else wantSpeed = 0;
  }
  if (face !== null) {
    const d = angDiff(b.heading, face);
    turn = clamp(d * 2.5, -1.2, 1.2);
    b.heading += turn * dt;
    if (Math.abs(d) > 1.2) wantSpeed *= 0.3;
  }
  b.turn = turn;
  if (Math.max(b.sit, b.lie) > 0.25) wantSpeed = 0; // get up first
  b.speed = approach(b.speed, wantSpeed, 2.2, dt);
  if (b.speed > 0.05) {
    const nx = b.x + Math.cos(b.heading) * b.speed * dt, ny = b.y + Math.sin(b.heading) * b.speed * dt;
    if (w.walkable(nx + Math.cos(b.heading) * 4, ny + Math.sin(b.heading) * 4, true)) { b.x = nx; b.y = ny; }
    else { b.speed *= 0.5; if (b.st !== 'stalk') b.goal = pick(b, w); b.circle *= -1; }
  }

  b.sit = approach(b.sit, wantSit, 1.4, dt);
  b.lie = approach(b.lie, wantLie, 1.0, dt);
  b.headUp = approach(b.headUp, wantHead, 2.2, dt);
  b.yaw = approach(b.yaw, wantYaw, 3, dt);
  b.sniff = approach(b.sniff, sniff, 3, dt);

  updateFeet(b, dt, Math.hypot(b.x - x0, b.y - y0), Math.abs(angDiff(h0, b.heading)));
}

// ---------------------------------------------------------------- feet (world planted)
function neutral(b, leg, out) {
  const ca = Math.cos(b.heading), sa = Math.sin(b.heading);
  const f = leg.f + 0.3, l = leg.fl;
  out.x = b.x + f * ca - l * sa; out.y = b.y + f * sa + l * ca;
  return out;
}
const NT = { x: 0, y: 0 };

function updateFeet(b, dt, moved, turned) {
  if (!b.feet) {
    b.feet = LEGS.map(leg => { neutral(b, leg, NT); return { wx: NT.x, wy: NT.y, cx: NT.x, cy: NT.y, cz: 0, swing: false, s: 0, fx: 0, fy: 0, ph: leg.off, lift: 0 }; });
  }
  // The gait clock advances only with ground actually covered (plus turning), so stance
  // feet never skate.
  const act = moved + turned * 5.5;
  b.cycle += act * DUTY / STRIDE;
  b.gait = approach(b.gait, clamp(act / Math.max(dt, 1e-3) / 4.5, 0, 1), 5, dt);
  const pose = Math.max(b.sit, b.lie);
  const mv = clamp(b.speed / 3, 0, 1);
  const ca = Math.cos(b.heading), sa = Math.sin(b.heading);
  let inAir = 0;
  for (const F of b.feet) if (F.swing) inAir++;
  for (let k = 0; k < 4; k++) {
    const leg = LEGS[k], F = b.feet[k];
    const ph = (b.cycle + leg.off) % 1, prev = F.ph;
    F.ph = ph;
    neutral(b, leg, NT);
    // landing spot: half a stride ahead of the neutral point when walking
    const tx = NT.x + ca * STRIDE * 0.5 * mv, ty = NT.y + sa * STRIDE * 0.5 * mv;
    const crossed = act > 0 && prev < DUTY && (ph >= DUTY || ph < prev);
    const far = Math.hypot(F.wx - NT.x, F.wy - NT.y) > STRIDE * 0.55;
    if (!F.swing && pose < 0.5 && (crossed || (far && inAir < 2))) {
      F.swing = true; F.s = 0; F.fx = F.wx; F.fy = F.wy; inAir++;
      F.len = Math.hypot(tx - F.wx, ty - F.wy);
    }
    if (F.swing) {
      const phS = ph >= DUTY ? (ph - DUTY) / (1 - DUTY) : 0;
      F.s = Math.min(1, Math.max(F.s + dt * 1.6, act > 0 && ph >= DUTY ? phS : 0));
      const e = F.s * F.s * (3 - 2 * F.s);
      F.cx = lerp(F.fx, tx, e); F.cy = lerp(F.fy, ty, e);
      F.cz = Math.sin(Math.PI * F.s) * (leg.front ? 1.7 : 1.3) * clamp(F.len / 3, 0.35, 1);
      F.lift = Math.sin(Math.PI * F.s) * clamp(F.len / 3, 0.35, 1);
      if (F.s >= 1) { F.swing = false; F.wx = tx; F.wy = ty; F.cx = tx; F.cy = ty; F.cz = 0; F.lift = 0; inAir--; }
    } else { F.cx = F.wx; F.cy = F.wy; F.cz = 0; F.lift = 0; }
  }
}

// ---------------------------------------------------------------- rig + draw
const C = (p, r) => ({ t: 0, x: p.x, y: p.y, r, gx: p.gx, gy: p.gy, z: p.z });
const Cap = (a, r1, b, r2) => ({ t: 1, x1: a.x, y1: a.y, r1, x2: b.x, y2: b.y, r2, g1x: a.gx, g1y: a.gy, z1: a.z, g2x: b.gx, g2y: b.gy, z2: b.z });
const P = () => ({ x: 0, y: 0, gx: 0, gy: 0, dy: 0, z: 0 });
const tmp = Array.from({ length: 96 }, P);
const IK = {};

function build(b) {
  if (!b.feet) updateFeet(b, 0.016, 0, 0);
  const ca = Math.cos(b.heading), sa = Math.sin(b.heading);
  const ox = b.x, oy = b.y;
  const g = b.gait, sit = b.sit, lie = b.lie, pose = Math.max(sit, lie);
  const ph = b.cycle * TAU;
  const breath = 1 + Math.sin(state.time * 1.7) * 0.012;
  const sway = Math.sin(ph + 0.6) * 0.45 * g;
  const bob = Math.cos(ph * 2) * 0.25 * g;
  const shRoll = Math.sin((b.cycle + 0.25) * TAU) * 0.55 * g;   // front shoulders over the support leg
  const hipRoll = Math.sin(b.cycle * TAU) * 0.45 * g;
  const zr = (base, s, l) => base + (s - base) * sit + (l - base) * lie;

  let i = 0;
  const pt = (f, l, z) => proj(tmp[i++], ox, oy, ca, sa, f, l + sway, z + bob);
  const pt0 = (f, l, z) => proj(tmp[i++], ox, oy, ca, sa, f, l, z); // no body sway (feet)

  // body: smooth chain of blobs; the hindquarters split into a wide pair of haunches
  const prof = PROFILE.map(([S, Si, L]) => [zr(S[0], Si[0], L[0]), zr(S[1], Si[1], L[1]), zr(S[2], Si[2], L[2])]);
  const body = [];
  const N = 14;
  for (let n = 0; n < N; n++) {
    const u = n / (N - 1) * (prof.length - 1);
    const k = Math.min(prof.length - 2, Math.floor(u)), t = u - k;
    const A = prof[k], B = prof[k + 1];
    const f = lerp(A[0], B[0], t);
    let top = lerp(A[1], B[1], t), bot = lerp(A[2], B[2], t);
    const wr = clamp((f + 4) / 8, 0, 1);
    top += lerp(hipRoll * 0.4, shRoll * 0.6, wr);
    const r = (top - bot) / 2 * (n > 2 && n < 11 ? breath : 1), zc = (top + bot) / 2;
    if (f < -3.4) {
      // paired haunches: hips wider than the shoulders, a tapered, cleft rump from behind
      const hw = 2.0 * clamp((-f - 3.4) / 2.5, 0, 1);
      const hz = hipRoll * 0.6;
      body.push(C(pt(f, -hw, zc - hz * 0.5 - 0.2), r * 0.9), C(pt(f, hw, zc + hz * 0.5 - 0.2), r * 0.9));
      body.push(C(pt(f + 0.3, 0, zc + r * 0.18), r * 0.78));
    } else body.push(C(pt(f, 0, zc), r));
  }
  body.unshift(C(pt(prof[0][0] - 0.7, 0, prof[0][1] - 1.5), 0.85)); // tail
  // shoulder blades rolling on the back line
  for (const side of [-1, 1]) {
    const lift = Math.sin((b.cycle + (side < 0 ? 0.25 : 0.75)) * TAU) * 0.8 * g;
    body.push(C(pt(zr(3.5, 2.0, 3.6), side * 1.2, zr(10.0, 11.6, 5.8) + lift), 2.0));
  }

  // neck and head
  const hu = b.headUp;
  const yaw = b.yaw + Math.sin(ph) * 0.26 * g;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const nb = { f: zr(6.6, 4.4, 6.4), z: zr(9.2, 11.4, 4.8) };
  let hf, hz, mf, mz;
  if (hu >= 0) { hf = lerp(4.6, 4.0, hu); hz = lerp(-1.6, 2.6, hu); mf = lerp(2.9, 2.3, hu); mz = lerp(-0.8, 1.1, hu); }
  else { const k = -hu; hf = lerp(4.6, 4.4, k); hz = lerp(-1.6, -nb.z + 2.2, k); mf = lerp(2.9, 1.4, k); mz = lerp(-0.8, -1.9, k); }
  if (lie) { hz = lerp(hz, -nb.z + 2.4 + Math.max(0, hu) * 2, lie); hf = lerp(hf, 5.2, lie); }
  hz += Math.cos(ph * 2 + 0.8) * 0.45 * g;
  const twitch = b.sniff * (Math.sin(state.time * 17) * 0.12);
  const rot = (f, l) => [f * cy - l * sy, f * sy + l * cy];
  const [hfx, hfl] = rot(hf, 0);
  const skull = { f: nb.f + hfx, l: hfl, z: nb.z + hz };
  const [m1, m2] = rot(mf, 0);
  const muzzle = { f: skull.f + m1, l: skull.l + m2, z: skull.z + mz + twitch };
  const neckMid = { f: (nb.f + skull.f) / 2 + 0.3, l: skull.l * 0.5, z: (nb.z + skull.z) / 2 + 0.5 };
  const pN0 = pt(nb.f - 1.2, 0, nb.z + 0.2), pN1 = pt(neckMid.f, neckMid.l, neckMid.z);
  const pS = pt(skull.f, skull.l, skull.z), pM = pt(muzzle.f, muzzle.l, muzzle.z);
  const [e1, e2] = rot(-0.9, 1.15), [e3, e4] = rot(-0.9, -1.15);
  const pEar1 = pt(skull.f + e1, skull.l + e2, skull.z + 1.85), pEar2 = pt(skull.f + e3, skull.l + e4, skull.z + 1.85);
  const head = [
    Cap(pN0, 3.3, pN1, 2.6), Cap(pN1, 2.6, pS, 2.1),
    C(pEar1, 0.85), C(pEar2, 0.85), C(pS, 2.3), Cap(pS, 1.85, pM, 1.1),
  ];
  const [n1, n2] = rot(0.75, 0);
  const pNose = pt(muzzle.f + n1, muzzle.l + n2, muzzle.z + 0.15);
  const eyes = [];
  for (const side of [-1, 1]) {
    const [a1, a2] = rot(0.9, 1.05 * side);
    const p = pt(skull.f + a1, skull.l + a2, skull.z + 0.75);
    const nf = 0.45 * cy - side * sy, nl = 0.45 * sy + side * cy;
    const vis = (nf * sa + nl * ca) * CAM_Y + 0.35 * CAM_Z;
    if (vis > 0.12) eyes.push({ x: p.x, y: p.y, a: clamp((vis - 0.12) * 4, 0, 1) });
  }
  const noseVis = (cy * sa + sy * ca) * CAM_Y + 0.4 * CAM_Z + (hu < 0 ? -hu * 0.3 : 0);

  // legs: front = upper arm / forearm (elbow breaks backward) + a big flat paw that flexes
  // at the wrist; hind = thigh / shin (knee forward) + raised hock + big paw.
  const legs = [];
  for (let k = 0; k < 4; k++) {
    const leg = LEGS[k], F = b.feet[k];
    const side = Math.sign(leg.l);
    const roll = leg.front ? shRoll : hipRoll;
    const rootF = leg.front ? zr(leg.f, leg.f - 1.4, leg.f) : zr(leg.f, prof[1][0] + 1.4, leg.f);
    const rootZ = (leg.front ? zr(8.0, 8.0, 3.3) : zr(8.6, 3.6, 3.1)) - roll * side * 0.5;
    // planted foot, world -> local (feet don't sway with the body)
    const dx = F.cx - b.x, dy = F.cy - b.y;
    let ff = dx * ca + dy * sa, fl = -dx * sa + dy * ca, fz = F.cz;
    if (pose > 0.01) {
      let pf, pl, pz;
      if (leg.front) { pf = lerp(leg.f + 1.6, leg.f + 7.5, lie / Math.max(pose, 1e-3)); pl = leg.fl * 0.9; pz = lie > sit ? 0.2 : 0; }
      else { pf = lerp(leg.f + 6.2, leg.f + 2.0, lie / Math.max(pose, 1e-3)); pl = leg.fl * (lie > sit ? 1.5 : 1.15); pz = 0.3; }
      ff = lerp(ff, pf, pose); fl = lerp(fl, pl, pose); fz = lerp(fz, pz, pose);
    }
    const lift = F.lift;
    let sh, paw, tip, root;
    if (leg.front) {
      // wrist sits above the back of the paw; paw flexes back during the swing
      const wf = ff - 0.5, wz = fz + 1.5;
      const j = ik(rootF, leg.l, rootZ, wf, fl, wz, 4.1, 3.5, -1, IK);
      root = pt(rootF, leg.l, rootZ);
      const el = pt(j.mf, j.ml, j.mz);
      const wr = pt0(j.ff, j.fl, j.fz);
      const a = -0.5 - lift * 1.3;
      const toe = pt0(j.ff + Math.cos(a) * 2.0, j.fl, j.fz + Math.sin(a) * 2.0);
      sh = [Cap(root, 2.1, el, 1.75), Cap(el, 1.7, wr, 1.35), Cap(wr, 1.35, toe, 1.5)];
      paw = wr; tip = toe;
      wr.z = Math.max(0, j.fz - 1.5);
    } else {
      const hkF = ff - 1.3, hkZ = fz + 2.3 + lift * 0.6;
      const j = ik(rootF, leg.l, rootZ, hkF, fl, hkZ, 4.0, 3.4, 1, IK);
      root = pt(rootF, leg.l, rootZ);
      const kn = pt(j.mf, j.ml, j.mz);
      const hk = pt0(j.ff, j.fl, j.fz);
      const a = -0.25 - lift * 0.7;
      const heel = pt0(j.ff + 0.5, j.fl, j.fz - 1.6);
      const toe = pt0(j.ff + 0.5 + Math.cos(a) * 2.0, j.fl, j.fz - 1.6 + Math.sin(a) * 2.0 + 0.1);
      sh = [Cap(root, 2.7, kn, 1.95), Cap(kn, 1.9, hk, 1.35), Cap(hk, 1.35, heel, 1.35), Cap(heel, 1.4, toe, 1.5)];
      paw = heel; tip = toe;
      heel.z = Math.max(0, fz);
    }
    legs.push({ sh, depth: root.dy, paw, tip, front: leg.front, root });
  }
  return { body, head, legs, eyes, pNose, noseVis, pS, pN0, headDepth: pS.dy, ca, sa };
}

const LIT = '#f4f4f2', SHADE = '#c9cbcd', FAR_LIT = '#dadbdc', FAR_SHADE = '#b9bbbe';
const OW = 0.3;
const DASH = [5.5, 0.3, 2.6, 0.22]; // slightly broken ink, like the map's pen line

function drawLeg(ctx, L, far) {
  ctx.setLineDash(DASH);
  inkUnion(ctx, L.sh, far ? FAR_LIT : LIT, far ? FAR_SHADE : SHADE, OW, -0.6, -0.7, INK);
  ctx.setLineDash([]);
  // claws: three short ink ticks at the toe
  const dx = L.tip.x - L.paw.x, dy = L.tip.y - L.paw.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  if (uy < -0.45 || far) return;
  ctx.strokeStyle = INK; ctx.lineWidth = 0.2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = -1; k <= 1; k++) {
    const bx = L.tip.x + ux * 0.9 - uy * k * 0.6, by = L.tip.y + uy * 0.9 + ux * k * 0.6 + 0.6;
    ctx.moveTo(bx, by); ctx.lineTo(bx + ux * 0.7, by + uy * 0.7 + 0.3);
  }
  ctx.stroke();
}

function furMarks(ctx, shapes, seed) {
  ctx.strokeStyle = 'rgba(58,58,58,0.35)';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  for (let k = 0; k < shapes.length; k++) {
    const s = shapes[k];
    if (s.t !== 0 || s.r < 3) continue;
    for (let m = 0; m < 3; m++) {
      const a = Math.PI * (0.4 + 0.12 * m) + Math.sin(seed + k * 3 + m) * 0.08;
      const x = s.x + Math.cos(a) * s.r * 0.86, y = s.y + Math.sin(a) * s.r * 0.86;
      ctx.moveTo(x, y); ctx.lineTo(x + 0.25, y + 0.75);
    }
  }
  ctx.stroke();
}

export function bearShadow(b, out) {
  const R = build(b);
  const rot = Math.atan2(SHY, SHX);
  for (const s of R.body.concat(R.head)) {
    if (s.t === 0) out.push({ t: 2, x: s.gx + s.z * SHX, y: s.gy + s.z * SHY, rx: s.r * 1.45, ry: s.r * 0.72, rot });
    else out.push({ t: 1, x1: s.g1x + s.z1 * SHX, y1: s.g1y + s.z1 * SHY, r1: s.r1 * 0.95,
                          x2: s.g2x + s.z2 * SHX, y2: s.g2y + s.z2 * SHY, r2: s.r2 * 0.95 });
  }
  for (const L of R.legs) {
    const rt = L.root, p = L.paw;
    out.push({ t: 1, x1: p.gx + p.z * SHX, y1: p.gy + p.z * SHY, r1: 1.2, x2: rt.gx + rt.z * SHX, y2: rt.gy + rt.z * SHY, r2: 1.8 });
  }
}

export function drawBear(ctx, b) {
  const R = build(b);
  const far = R.legs.filter(L => L.depth < -0.3).sort((a, c) => a.depth - c.depth);
  const near = R.legs.filter(L => L.depth >= -0.3).sort((a, c) => a.depth - c.depth);
  for (const L of far) drawLeg(ctx, L, true);
  const headSeparate = R.headDepth > 3.5;
  // Body + head share one outline. Order: outline, near legs, then the fill over the
  // legs' tops, so legs grow out of the fur with no seam across them.
  const shapes = R.body.concat(R.head);
  const path = pathOf(shapes);
  ctx.lineJoin = 'round'; ctx.lineWidth = OW * 2; ctx.strokeStyle = INK;
  ctx.setLineDash(DASH); ctx.stroke(path); ctx.setLineDash([]);
  for (const L of near) drawLeg(ctx, L, false);
  ctx.fillStyle = SHADE; ctx.fill(path);
  ctx.save(); ctx.clip(path); ctx.fillStyle = LIT; ctx.fill(pathOf(shapes, -1.35, -1.55)); ctx.restore();
  if (headSeparate && near.length) {
    // facing us: the head hangs in front of the forelegs; ink its edge only where it
    // overlaps them
    ctx.save();
    ctx.clip(pathOf(near.flatMap(L => L.sh)));
    ctx.lineWidth = OW * 2; ctx.strokeStyle = INK; ctx.stroke(pathOf(R.head.slice(1)));
    const hp = pathOf(R.head.slice(1)); ctx.fillStyle = SHADE; ctx.fill(hp);
    ctx.clip(hp); ctx.fillStyle = LIT; ctx.fill(pathOf(R.head.slice(1), -1.0, -1.2));
    ctx.restore();
  }
  furMarks(ctx, R.body, Math.floor(b.x) * 0.1);
  ctx.fillStyle = INK;
  if (R.noseVis > -0.1) { ctx.beginPath(); ctx.ellipse(R.pNose.x, R.pNose.y, 0.62, 0.48, 0, 0, TAU); ctx.fill(); }
  for (const e of R.eyes) { ctx.globalAlpha = e.a; ctx.beginPath(); ctx.arc(e.x, e.y, 0.34, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (state.debug) { ctx.fillStyle = 'red'; ctx.font = '4px sans-serif'; ctx.fillText(b.st, b.x - 6, b.y - 16); }
}
