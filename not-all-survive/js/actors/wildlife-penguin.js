// Penguins: a loose flock brain per group, a tiny rig per bird (waddle roll, flippers,
// head turns, preening, calling, belly sliding), and the drawing.
import { state } from '../state.js';
import {
  proj, pathOf, circle, capsule, clamp, lerp, angDiff, approach, smooth,
  SHX, SHY, CAM_Y, CAM_Z,
} from './wildlife-rig.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

// hex packing offsets, nearest first, for huddles
const HEX = (() => {
  const out = [];
  for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) {
    const x = (q + r / 2) * 4.5, y = r * 3.8;
    out.push({ x, y, d: Math.hypot(x, y * 1.15) });
  }
  return out.sort((a, b) => a.d - b.d);
})();

export function makeGroup(cx, cy, n, homeR, w, opts = {}) {
  const g = {
    cx, cy, tx: cx, ty: cy, home: { x: cx, y: cy, r: homeR },
    spread: opts.spread ?? (6 + Math.sqrt(n) * 4), t: rnd(6, 14), members: [], huddle: 0, panic: 0,
    force: opts.force || null,
  };
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * g.spread;
    let x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8;
    if (!w.walkable(x, y)) { x = cx + rnd(-2, 2); y = cy + rnd(-2, 2); }
    g.members.push({
      x, y, g, i, heading: Math.random() * TAU, speed: 0,
      ox: Math.cos(a) * r, oy: Math.sin(a) * r * 0.8,
      st: 'idle', t: rnd(0.5, 4), goal: null, phase: Math.random() * TAU, walkAmp: 0,
      pitch: 0, headYaw: 0, headYawT: 0, headT: rnd(0.3, 2), preen: 0, call: 0, flap: 0,
      fout: 0.3, hop: 0, s: rnd(1.1, 1.2), side: Math.random() < 0.5 ? -1 : 1, flee: false,
    });
  }
  return g;
}

function groupUpdate(g, dt, w) {
  const p = state.params.has('wlCalm') ? { x: -1e5, y: -1e5 } : state.player;
  // centroid
  let mx = 0, my = 0;
  for (const m of g.members) { mx += m.x; my += m.y; }
  mx /= g.members.length; my /= g.members.length;
  const windy = (state.wind.speed + (state.wind.gust || 0) * 0.5) > 0.72 || g.force === 'huddle';
  g.huddle = approach(g.huddle, windy ? 1 : 0, 0.6, dt);

  const pd = Math.hypot(p.x - mx, p.y - my);
  g.t -= dt; g.panic -= dt;
  if (pd < g.spread + 45 && g.panic <= 0) {
    // move the whole group away from the explorer
    const a = Math.atan2(my - p.y, mx - p.x);
    for (let k = 0; k < 8; k++) {
      const aa = a + (k % 2 ? 1 : -1) * k * 0.3;
      const tx = mx + Math.cos(aa) * 115, ty = my + Math.sin(aa) * 115;
      if (w.walkable(tx, ty) && w.clearLine(mx, my, tx, ty)) { g.tx = tx; g.ty = ty; break; }
    }
    g.panic = 4; g.t = rnd(25, 40);
  } else if (g.t <= 0 && g.huddle < 0.3) {
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * TAU, r = Math.random() * g.home.r;
      const tx = g.home.x + Math.cos(a) * r, ty = g.home.y + Math.sin(a) * r;
      if (w.walkable(tx, ty) && w.clearLine(g.cx, g.cy, tx, ty)) { g.tx = tx; g.ty = ty; break; }
    }
    g.t = rnd(14, 30);
  }
  // the centre drifts toward the target at penguin pace
  const dx = g.tx - g.cx, dy = g.ty - g.cy, d = Math.hypot(dx, dy);
  const v = g.panic > 0 ? 9 : 3.2;
  if (d > 0.5) { const k = Math.min(1, v * dt / d); g.cx += dx * k; g.cy += dy * k; }
  if (g.huddle > 0.5) { g.cx = approach(g.cx, mx, 0.5, dt); g.cy = approach(g.cy, my, 0.5, dt); }
  return { mx, my };
}

function emitCall(m) { state.events.push({ type: 'penguin', x: m.x, y: m.y, kind: 'call' }); }

const CALM = state.params.has('wlCalm'); // captures: ignore the explorer
const FAR = { x: -1e5, y: -1e5 };
export function updateGroup(g, dt, w) {
  groupUpdate(g, dt, w);
  const p = CALM ? FAR : state.player;
  const H = g.huddle > 0.5;
  const downwind = state.wind.angle; // back to the wind
  const ms = g.members;

  if (g.force === 'dirs') {
    ms.forEach((m, k) => { m.x = g.home.x + (k % 8) * 7 - 24; m.y = g.home.y + Math.floor(k / 8) * 9; m.heading = (k % 8) * Math.PI / 4; m.st = 'frozen';
      if (k >= 8) { m.st = 'walk'; m.walkAmp = 1; m.phase += dt * 8; m.fout = 0.75; } if (k >= 16) { m.pitch = 1; m.walkAmp = 0; } });
    return;
  }
  for (const m of ms) {
    m.t -= dt; m.headT -= dt;
    const pd = Math.hypot(p.x - m.x, p.y - m.y);
    // desired spot in the flock
    let hx, hy;
    if (H) { const o = HEX[m.i]; hx = g.cx + o.x; hy = g.cy + o.y; }
    else { hx = g.cx + m.ox; hy = g.cy + m.oy; }
    const dHome = Math.hypot(hx - m.x, hy - m.y);

    // startled: waddle away (or toboggan) from the explorer
    // keeps fleeing while pressed; re-aims away from the explorer every half second
    m.fleeT = (m.fleeT || 0) - dt;
    const pressed = pd < 40 || (m.flee && pd < 60);
    if (pressed && m.st !== 'slide' && m.fleeT <= 0) {
      m.fleeT = 0.5;
      const base = Math.atan2(m.y - p.y, m.x - p.x);
      for (let k = 0; k < 11; k++) {
        const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.4 + rnd(-0.15, 0.15);
        const gx = m.x + Math.cos(a) * 110, gy = m.y + Math.sin(a) * 110;
        // must have a clear run for at least the first 30 units
        if (!w.clearLine(m.x, m.y, m.x + Math.cos(a) * 30, m.y + Math.sin(a) * 30)) continue;
        const startled = !m.flee;
        m.goal = { x: gx, y: gy }; m.flee = true; m.flap = 1;
        const slideP = w.icy(m.x, m.y) ? 0.7 : 0.4;
        if (startled && pd > 8 && Math.random() < slideP) { m.heading = a; m.st = 'slide'; m.speed = rnd(26, 32); m.t = 4; }
        else { m.st = 'walk'; m.t = 14; }
        if (startled && Math.random() < 0.3) emitCall(m);
        break;
      }
    }
    if (m.flee && !pressed && m.st === 'walk' && Math.random() < dt * 0.5) { m.st = 'idle'; m.t = rnd(1, 3); m.flee = false; }

    switch (m.st) {
      case 'idle':
        if (m.headT <= 0) { m.headYawT = Math.random() < 0.3 ? 0 : rnd(-1.3, 1.3); m.headT = rnd(0.4, 2.2); }
        if (dHome > (H ? 1.2 : 5)) { m.goal = { x: hx + rnd(-1, 1), y: hy + rnd(-1, 1) }; m.st = 'walk'; m.t = 12; break; }
        if (H) {
          // huddled: face downwind, shuffle a little
          m.heading += angDiff(m.heading, downwind + Math.sin(m.i * 7.1) * 0.25) * Math.min(1, dt * 2);
          m.headYawT = 0;
          break;
        }
        if (m.t <= 0) {
          const r = Math.random();
          if (r < 0.18) { m.st = 'preen'; m.t = rnd(1.8, 3.5); m.side = Math.random() < 0.5 ? -1 : 1; }
          else if (r < 0.27) { m.st = 'call'; m.t = 1.6; emitCall(m); }
          else if (r < 0.37) { m.flap = 1; m.t = rnd(1, 3); }
          else if (r < 0.62) {
            // potter about near its spot
            const a = Math.random() * TAU;
            const gx = hx + Math.cos(a) * rnd(2, 7), gy = hy + Math.sin(a) * rnd(2, 6);
            if (w.walkable(gx, gy)) { m.goal = { x: gx, y: gy }; m.st = 'walk'; m.t = 10; }
            else m.t = rnd(1, 3);
          } else if (r < 0.7 && w.icy(m.x, m.y)) {
            // a spontaneous toboggan run across the ice
            const a = Math.random() * TAU;
            const gx = m.x + Math.cos(a) * 30, gy = m.y + Math.sin(a) * 30;
            if (w.clearLine(m.x, m.y, gx, gy)) { m.heading = a; m.st = 'slide'; m.speed = rnd(20, 27); m.t = 3; }
            else m.t = rnd(1, 3);
          } else m.t = rnd(1.5, 5);
        }
        break;
      case 'walk': {
        const dx = m.goal.x - m.x, dy = m.goal.y - m.y, d = Math.hypot(dx, dy);
        let want = Math.atan2(dy, dx);
        const stw = w.steer(m.x, m.y, want, 5);
        if (stw !== null) want = stw;
        m.heading += angDiff(m.heading, want) * Math.min(1, dt * 6);
        const sp = m.flee ? 12 : (d > 18 ? 6.8 : 5);
        // a long trip across ice? belly-slide it
        if (!m.flee && d > 28 && Math.random() < dt * 0.4 && w.icy(m.x, m.y) && w.clearLine(m.x, m.y, m.goal.x, m.goal.y)) {
          m.st = 'slide'; m.speed = rnd(21, 27); m.t = 3; m.heading = want; break;
        }
        m.speed = approach(m.speed, Math.abs(angDiff(m.heading, want)) > 1 ? 1 : sp, 6, dt);
        m.headYawT = 0;
        if (d < 1.2 || m.t <= 0) { m.st = 'idle'; m.t = rnd(1, 5); m.flee = false; }
        if (m.flee) m.flap = Math.max(m.flap, 0.8);
        break;
      }
      case 'slide':
        m.speed = Math.max(0, m.speed - dt * 7.5);
        if (m.speed < 6 || m.t <= 0) { m.st = 'idle'; m.t = rnd(1.5, 4); m.hop = 1; m.flee = false; }
        break;
      case 'preen':
        if (m.t <= 0) { m.st = 'idle'; m.t = rnd(1, 4); }
        break;
      case 'call':
        if (m.t <= 0) {
          m.st = 'idle'; m.t = rnd(2, 5);
          // a neighbour answers now and then
          if (Math.random() < 0.4) {
            const o = ms[(m.i + 1 + Math.floor(Math.random() * 3)) % ms.length];
            if (o.st === 'idle') { o.st = 'call'; o.t = 1.6; emitCall(o); }
          }
        }
        break;
    }

    // move
    const moving = m.st === 'walk' || m.st === 'slide';
    if (!moving) m.speed = approach(m.speed, 0, 8, dt);
    if (m.speed > 0.02) {
      const nx = m.x + Math.cos(m.heading) * m.speed * dt, ny = m.y + Math.sin(m.heading) * m.speed * dt;
      if (w.walkable(nx + Math.cos(m.heading) * 2, ny + Math.sin(m.heading) * 2)) { m.x = nx; m.y = ny; }
      else { m.speed = 0; if (m.st === 'slide') m.hop = 1; m.st = 'idle'; m.t = rnd(0.5, 2); m.flee = false; }
    }

    // pose
    const walking = m.st === 'walk' ? clamp(m.speed / 4, 0, 1.2) : 0;
    m.walkAmp = approach(m.walkAmp, walking, 8, dt);
    m.phase += dt * (m.st === 'walk' ? 4.2 + m.speed * 0.9 : 2) * (m.walkAmp > 0.05 ? 1 : 0);
    m.pitch = approach(m.pitch, m.st === 'slide' ? 1 : 0, m.st === 'slide' ? 9 : 6, dt);
    m.headYaw = approach(m.headYaw, m.headYawT, 7, dt);
    m.preen = approach(m.preen, m.st === 'preen' ? 1 : 0, 6, dt);
    m.call = approach(m.call, m.st === 'call' ? 1 : 0, 7, dt);
    m.flap = Math.max(0, m.flap - dt * 0.9);
    m.hop = Math.max(0, m.hop - dt * 3.2);
    const fo = m.st === 'walk' ? 0.75 : m.st === 'slide' ? 0.3 : m.st === 'call' ? 0.85 : H ? 0.05 : 0.25;
    m.fout = approach(m.fout, fo, 6, dt);
  }

  // separation: keep personal space (tighter in a huddle)
  const minD = H ? 3.8 : 4.2;
  for (let a = 0; a < ms.length; a++) {
    const A = ms[a];
    for (let b = a + 1; b < ms.length; b++) {
      const B = ms[b];
      const dx = B.x - A.x, dy = (B.y - A.y) * 1.25, d2 = dx * dx + dy * dy;
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (minD - d) * 0.5 * Math.min(1, dt * 10);
        const ux = dx / d, uy = dy / d;
        if (A.st !== 'slide' && w.walkable(A.x - ux * push, A.y - uy * push)) { A.x -= ux * push; A.y -= uy * push * 0.8; }
        if (B.st !== 'slide' && w.walkable(B.x + ux * push, B.y + uy * push)) { B.x += ux * push; B.y += uy * push * 0.8; }
      }
    }
  }
}

// ---------------------------------------------------------------- drawing
const T = Array.from({ length: 24 }, () => ({ x: 0, y: 0, gx: 0, gy: 0, dy: 0, z: 0 }));

// local point -> rolled, pitched, projected
function mk(m) {
  const ca = Math.cos(m.heading), sa = Math.sin(m.heading);
  const roll = Math.sin(m.phase) * 0.2 * m.walkAmp;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const q = m.pitch * 1.45, cq = Math.cos(q), sq = Math.sin(q);
  const lift = m.pitch * 1.35 + Math.sin(m.hop * Math.PI) * 0.8;
  const back = m.pitch * 2.2;
  const s = m.s;
  let i = 0;
  const pt = (f, l, z) => {
    f *= s; l *= s; z *= s;
    // roll about the forward axis (pivot at the feet)
    const l1 = l * cr - z * sr, z1 = l * sr + z * cr;
    // pitch forward onto the belly
    const f2 = f * cq + z1 * sq - back, z2 = -f * sq + z1 * cq + lift;
    return proj(T[i++], m.x, m.y, ca, sa, f2, l1, z2);
  };
  return { pt, ca, sa, cq, sq };
}

const BODY_LIT = '#4a4a4a', BODY_SHADE = '#323232', PINK = '#8a8c8e', MID = '#5e5f60';

function build(m) {
  const { pt, ca, sa, cq, sq } = mk(m);
  const pr = m.preen, cl = m.call;
  // body
  const b0 = pt(0.05, 0, 1.75), b1 = pt(0.12, 0, 2.95), b2 = pt(0.2, 0, 3.85);
  const tail = pt(-1.25, 0, 0.75);
  // head: normal, preening (tucked to one side of the chest), calling (stretched up)
  let hf = 0.38, hl = 0, hz = 5.3;
  hf = lerp(hf, 0.95, pr); hl = lerp(hl, m.side * 0.75, pr); hz = lerp(hz, 3.95 + Math.sin(state.time * 9 + m.i) * 0.15 * pr, pr);
  hf = lerp(hf, 0.0, cl); hz = lerp(hz, 5.75, cl);
  const hd = pt(hf, hl, hz);
  // beak direction
  const yaw = m.headYaw + (pr ? m.side * 1.9 * pr : 0);
  let bf = Math.cos(yaw), bl = Math.sin(yaw), bz = -0.15;
  bz = lerp(bz, -0.9, pr); bf *= 1 - cl * 0.8; bl *= 1 - cl * 0.8; bz = lerp(bz, 1.25, cl);
  const bk = pt(hf + bf * 1.65, hl + bl * 1.65, hz + bz * 1.1);
  // flippers
  const flapA = m.flap * Math.sin(state.time * 22) * 0.5;
  const th = 0.12 + 0.95 * m.fout + flapA + Math.sin(m.phase * 2) * 0.12 * m.walkAmp;
  const fl = [];
  for (const side of [-1, 1]) {
    const r = pt(0.0, side * 1.15, 3.9);
    const back = m.pitch * 1.4;
    const t = pt(-0.25 - back, side * (1.15 + Math.sin(th) * 2.2), 3.9 - Math.cos(th) * 2.2 + m.pitch * 0.2);
    fl.push(capsule(r, 0.5, t, 0.24));
  }
  // feet (alternate lifting while waddling, paddle when sliding)
  const feet = [];
  for (const side of [-1, 1]) {
    const lift = Math.max(0, Math.sin(m.phase + (side > 0 ? 0 : Math.PI))) * 0.5 * m.walkAmp;
    const kick = m.pitch * Math.sin(state.time * 14 + side) * 0.6;
    const a = pt(0.15 - m.pitch * 0.9, side * 0.6, 0.15 + lift);
    const c = pt(0.9 - m.pitch * 1.9 + kick, side * 0.68, 0.12 + lift);
    feet.push(capsule(a, 0.32, c, 0.3));
  }
  const body = [circle(b0.x, b0.y, 1.7 * m.s), circle(b1.x, b1.y, 1.52 * m.s), circle(b2.x, b2.y, 1.02 * m.s)];
  const head = [circle(hd.x, hd.y, 0.92 * m.s), capsule(hd, 0.42 * m.s, bk, 0.12 * m.s)];

  // belly: white ellipse on the front of the body, visible when the front faces us
  const nx = cq * ca, ny = cq * sa, nz = -sq;
  const facing = ny * CAM_Y + nz * CAM_Z;
  const vis = smooth(-0.42, 0.1, facing);
  const bc = pt(1.05, 0, 2.55);
  const ax = b2.x - b0.x, ay = b2.y - b0.y;
  const rot = Math.atan2(ay, ax) + Math.PI / 2;
  const belly = vis > 0.02 ? { x: bc.x, y: bc.y, rx: 1.3 * m.s * vis, ry: 2.1 * m.s * Math.sqrt(vis), rot } : null;
  void nx;
  // the far flipper goes behind the body
  return { body, head, fl, feet, belly, tail, b0, hd, flipDepth: fl.map(f => f) };
}

export function penguinShadow(m, out) {
  const h = 5.6 * m.s * (1 - m.pitch * 0.7);
  const rot = Math.atan2(SHY, SHX);
  const L = h * 0.55;
  out.push({ t: 2, x: m.x + L * SHX + 0.2, y: m.y + L * SHY, rx: L + 1.0, ry: 1.25 * m.s, rot });
}

export function drawPenguin(ctx, m) {
  const R = build(m);
  ctx.lineJoin = 'round';
  // feet first, they're under everything
  ctx.fillStyle = PINK; ctx.strokeStyle = '#262626'; ctx.lineWidth = 0.25;
  const fp = pathOf(R.feet);
  ctx.stroke(fp); ctx.fill(fp);
  // whole silhouette as one union: body + head + beak + flippers + tail stub
  const all = R.body.concat(R.head, R.fl, [circle(R.tail.x, R.tail.y, 0.55 * m.s)]);
  const p = pathOf(all);
  // a pale halo first so birds packed together stay separate shapes
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(232,233,232,0.9)'; ctx.stroke(p);
  ctx.lineWidth = 0.5; ctx.strokeStyle = '#2b2b2b'; ctx.stroke(p);
  ctx.fillStyle = BODY_SHADE; ctx.fill(p);
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = BODY_LIT; ctx.fill(pathOf(all, -0.55, -0.6));
  ctx.fillStyle = BODY_SHADE; ctx.fill(pathOf(all, 0.15, 0.1)); // keep the lit rim thin
  ctx.restore();
  // a grey mid-tone on the upper-left of the flippers and the crown
  ctx.save(); ctx.clip(pathOf(R.fl.concat([R.head[0]])));
  ctx.fillStyle = MID; ctx.fill(pathOf(R.fl.concat([R.head[0]]), -0.45, -0.5));
  ctx.fillStyle = BODY_LIT; ctx.fill(pathOf(R.fl.concat([R.head[0]]), 0.25, 0.3));
  ctx.restore();
  if (R.belly) {
    const bp = pathOf(R.body);
    ctx.save(); ctx.clip(bp);
    const b = R.belly;
    ctx.fillStyle = '#cfd1d3';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.rx, b.ry, b.rot, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f5f5f3';
    ctx.beginPath(); ctx.ellipse(b.x - 0.3, b.y - 0.35, b.rx * 0.92, b.ry * 0.9, b.rot, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
