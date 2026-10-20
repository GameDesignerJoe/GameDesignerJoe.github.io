// Sky layers (world space, above the actors):
//   cloud shadows sweeping slowly with the wind, low fog banks / haze that thicken
//   in storms, and small snow puffs kicked up at the explorer's feet.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';
import { director } from './weather-director.js';
import { fillWind } from './weather-noise.js';
import * as terrain from '../world/terrain.js';

let T, pCloud, pHaze, pFog, patCtx = null;
let cloudU = 0, cloudV = 0, hazeU = 0, fogU = 0, lastT = 0;
const clamp01 = v => Math.max(0, Math.min(1, v));

export function init(textures) {
  T = textures;
  if (state.weather.ctl) state.weather.ctl.avalanche = () => { avalancheClock = 0; };
}

// --- avalanches -----------------------------------------------------------------------
// Now and then a slab lets go at the foot of a rock face within sight of the explorer:
// a churning powder cloud runs down the open slope (toward the camera in this view) for
// ~7 s, a dark shadow at its leading edge, stippled ink outlines on the fresh billows,
// leaving a powder cloud hanging behind that drifts off downwind.
const ROCK = 4;
// Off by default until the look is inked rather than airbrushed; ?avalanche turns it on.
let avalancheClock = state.params.has('avalanche') ? 0.3 : Infinity;
const slides = [];
const RUN_T = 7;

function findSlideSite() {
  if (!terrain.classAt) return null;
  const r = visibleRect(-30);
  const z = state.cam.zoom || 1;
  const run0 = (160 + Math.random() * 80) / z;   // 150-250 screen px of downhill path
  for (let i = 0; i < 500; i++) {
    // Second half of the search relaxes the rules a little (narrow phone views).
    const relaxed = i >= 250, faceH = relaxed ? 35 : 60, run = relaxed ? Math.max(70, run0 * 0.8) : run0;
    const x = r.x0 + Math.random() * (r.x1 - r.x0);
    const y = r.y0 + Math.random() * (r.y1 - r.y0) * 0.85;
    const d = Math.hypot(x - state.player.x, y - state.player.y) * z;
    if (d < 130 || d > 440) continue;
    if (y + run > r.y1 + 10) continue;
    // A genuine slope: the foot of a tall rock face (rock for 60px above it) ...
    if (terrain.classAt(x, y) !== ROCK) continue;
    let face = true;
    for (let k = 10; k <= faceH; k += 10) if (terrain.classAt(x, y - k) !== ROCK) { face = false; break; }
    if (!face) continue;
    // ... with an open snow apron running downhill (+y) below it, flanked by rock or
    // steep ground on at least one side for the first stretch (a gully / apron).
    let open = true;
    for (let k = 6; k <= run; k += 8) {
      const c = terrain.classAt(x, y + k);
      if (c === ROCK || c === 2 || c === 3) { open = false; break; }   // no rock, no ice
    }
    if (!open) continue;
    if (Math.abs(x - state.player.x) < 35 && state.player.y > y - 10 && state.player.y < y + run + 25) continue;
    return { x, y: y + 3, run };
  }
  return null;
}

function updateSlides(dt) {
  avalancheClock -= dt;
  if (avalancheClock <= 0) {
    const site = state.weather.whiteout < 0.5 ? findSlideSite() : null;
    avalancheClock = site ? 45 + Math.random() * 60 : 1;
    if (site) {
      const z = state.cam.zoom || 1;
      slides.push({ ...site, age: 0, puffs: [], debris: [], big: 0, w: (55 + Math.random() * 25) / z,
        hx: site.x, hy: site.y, lastHy: site.y, wob: Math.random() * 10 });
      state.events.push({ type: 'avalanche', x: site.x, y: site.y });
      state.weather.lastAvalanche = { x: site.x, y: site.y, t: state.time };
    }
  }
  const a = state.wind.angle, W = state.wind.speed;
  for (const s of slides) {
    s.age += dt;
    const t = Math.min(1, s.age / RUN_T);
    const prog = 1 - Math.pow(1 - t, 1.8);           // fast down the face, slowing on the flat
    s.hx = s.x + Math.sin(s.age * 0.8 + s.wob) * s.w * 0.12;
    s.hy = s.y + prog * s.run;
    const spread = 0.35 + 0.9 * prog;                 // fans out as it runs onto the flat
    // 8 big billows dropped along the path, each staying where it formed and churning.
    while (s.big < 8 && prog >= s.big / 8) {
      s.puffs.push({ x: s.hx + (Math.random() - 0.5) * s.w * 0.3 * spread, y: s.hy, vy: 3, age: 0,
        life: 6 + Math.random() * 2.5, r0: s.w * (0.3 + 0.1 * spread), seed: Math.random() * 1000, big: true });
      s.big++;
    }
    // Smaller churning billows around the head.
    if (t < 0.9 && Math.random() < dt * 18) {
      s.puffs.push({
        x: s.hx + (Math.random() - 0.5) * s.w * spread, y: s.hy + (Math.random() - 0.5) * s.w * 0.25,
        vy: 4 + Math.random() * 5, age: 0, life: 3 + Math.random() * 2,
        r0: s.w * (0.13 + Math.random() * 0.1), seed: Math.random() * 1000,
      });
    }
    // Debris: grey stipple left on the snow along the track, lingering ~12 s.
    if (s.hy > s.lastHy + 0.5 && s.debris.length < 600) {
      const n = Math.ceil((s.hy - s.lastHy) * 2.4);
      for (let i = 0; i < n; i++) {
        const yy = s.lastHy + Math.random() * (s.hy - s.lastHy);
        s.debris.push({ x: s.hx + (Math.random() - 0.5) * s.w * spread * 0.9, y: yy + (Math.random() - 0.5) * 2,
          t0: s.age, big: Math.random() < 0.25 });
      }
      s.lastHy = s.hy;
    }
    for (const p of s.puffs) {
      p.age += dt;
      p.vy *= 1 - dt * 0.8;
      p.y += p.vy * dt;
      const drift = (1.5 + 10 * W) * dt * Math.min(1, p.age / 2.5);
      p.x += Math.cos(a) * drift; p.y += Math.sin(a) * drift;
    }
    s.puffs = s.puffs.filter(p => p.age < p.life);
  }
  for (let i = slides.length - 1; i >= 0; i--) if (slides[i].age > RUN_T + 13) slides.splice(i, 1);
}

function drawSlides(ctx) {
  const z = state.cam.zoom || 1, dot = 1.2 / z;
  for (const s of slides) {
    // Debris trail first (on the snow, under the cloud).
    for (const d of s.debris) {
      const al = Math.max(0, 1 - (s.age - d.t0) / 12);
      if (al <= 0) continue;
      ctx.fillStyle = `rgba(80,83,87,${0.75 * al})`;
      const sz = d.big ? dot * 2.2 : dot * 1.3;
      ctx.fillRect(d.x, d.y, sz, sz);
    }
    const live = s.age < RUN_T * 0.95;
    if (live) {
      // Dark leading edge: the shadow tone of the snow front, just ahead of the head.
      const cy = s.hy + s.w * 0.18;
      const g = ctx.createRadialGradient(s.hx, cy, 0, s.hx, cy, s.w * 0.65);
      g.addColorStop(0, 'rgba(150,154,158,0.45)');
      g.addColorStop(1, 'rgba(150,154,158,0)');
      ctx.save();
      ctx.translate(s.hx, cy); ctx.scale(1, 0.4); ctx.translate(-s.hx, -cy);
      ctx.fillStyle = g;
      ctx.fillRect(s.hx - s.w, cy - s.w, s.w * 2, s.w * 2);
      ctx.restore();
    }
    const geo = p => { const t = p.age / p.life; return [t, p.r0 * (1 + (p.big ? 0.8 : 1.3) * Math.sqrt(t)), Math.min(1, p.age * 3) * (1 - t * t)]; };
    // Shade (lower right, light from upper left), then the lit billows.
    for (const p of s.puffs) {
      const [, r, al] = geo(p);
      ctx.globalAlpha = al * 0.8;
      ctx.drawImage(T.billowShade, p.x - r + r * 0.22, p.y - r + r * 0.3, r * 2, r * 2);
    }
    for (const p of s.puffs) {
      const [, r, al] = geo(p);
      ctx.globalAlpha = al;
      ctx.drawImage(T.billow, p.x - r, p.y - r, r * 2, r * 2);
    }
    // Stippled ink outlines on the lower-right rims of the big billows.
    ctx.globalAlpha = 1;
    for (const p of s.puffs) {
      if (!p.big) continue;
      const [t, r, al] = geo(p);
      if (t > 0.6) continue;
      ctx.fillStyle = `rgba(58,58,58,${0.55 * al * (1 - t / 0.6)})`;
      for (let k = 0; k < 13; k++) {
        const h = Math.sin(p.seed + k * 12.9898) * 43758.5453, rr = h - Math.floor(h);
        const ang = -0.5 + (k / 12) * 2.5 + rr * 0.25;
        const rad = r * (0.86 + rr * 0.08);
        ctx.fillRect(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, dot, dot);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// --- feet puffs ---------------------------------------------------------------------
const puffs = [];
let sawStepEvent = false, stepClock = 0, lastPX = null, lastPY = null;

function kick(x, y, weight = 1) {
  const a = state.wind.angle, W = state.wind.speed;
  const n = 3 + Math.round(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    if (puffs.length > 70) puffs.shift();
    puffs.push({
      x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 1.5,
      vx: Math.cos(a) * (6 + 22 * W) + (Math.random() - 0.5) * 8,
      vy: Math.sin(a) * (6 + 22 * W) - 2 - Math.random() * 4,
      age: 0, life: 0.6 + Math.random() * 0.7, r: (1.4 + Math.random() * 1.6) * (0.5 + weight * 0.5),
    });
  }
}

export function update(dt) {
  updateSlides(dt);
  for (const e of state.events) if (e.type === 'fall') {
    // Knocked flat: a burst of snow at the explorer.
    const x = e.x ?? state.player.x, y = e.y ?? state.player.y, st = Math.min(1.5, e.strength ?? 1);
    const a = state.wind.angle;
    for (let i = 0; i < 12; i++) {
      if (puffs.length > 70) puffs.shift();
      const ang = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 18;
      puffs.push({
        x: x + Math.cos(ang) * 3, y: y - 2 + Math.sin(ang) * 1.5,
        vx: Math.cos(ang) * sp + Math.cos(a) * 10, vy: Math.sin(ang) * sp * 0.5 - 6 + Math.sin(a) * 10,
        age: 0, life: 0.6 + Math.random() * 0.2, r: (4.5 + Math.random() * 4) * (0.8 + st * 0.3), white: true,
      });
    }
  }
  for (const e of state.events) if (e.type === 'step') {
    sawStepEvent = true;
    if (e.terrain !== 'rock' && e.terrain !== 'ice') kick(e.x, e.y, (e.weight ?? 1) * (e.terrain === 'deep' ? 1.9 : 1));
  }
  // Fallback until the explorer emits step events (or if weather updates before it).
  const p = state.player;
  if (!sawStepEvent && lastPX !== null) {
    const moved = Math.hypot(p.x - lastPX, p.y - lastPY);
    stepClock += moved;
    if (stepClock > 5) { stepClock = 0; kick(p.x, p.y); }
  }
  lastPX = p.x; lastPY = p.y;
  for (const q of puffs) {
    q.age += dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 1 - dt * 1.5; q.vy = q.vy * (1 - dt * 2) + 6 * dt;
  }
  while (puffs.length && puffs[0].age > puffs[0].life) puffs.shift();
}

function pats(ctx) {
  if (patCtx === ctx) return;
  patCtx = ctx;
  pCloud = ctx.createPattern(T.cloud, 'repeat');
  pHaze = ctx.createPattern(T.haze, 'repeat');
  pFog = ctx.createPattern(T.fog, 'repeat');
}

export function drawSky(ctx) {
  pats(ctx);
  const dt = Math.max(0, state.time - lastT); lastT = state.time;
  const W = state.wind.speed, a = state.wind.angle, st = director.storminess;
  const wo = state.weather.whiteout;
  cloudU += (5 + 22 * W) * dt;
  cloudV += 1.5 * dt;
  hazeU += (8 + 45 * W) * dt;
  fogU += (14 + 70 * W) * dt;
  const r = visibleRect(10);

  drawSlides(ctx);

  // Feet puffs (soft sprites, drifting downwind).
  for (let pass = 0; pass < 2; pass++) for (const q of puffs) {
    const t = q.age / q.life;
    const al = 0.7 * (1 - t) * Math.min(1, t * 6);
    const s = q.r * (1 + t * 1.8);
    if (pass === 0) {
      // Fall bursts are white: only a whisper of shade under them.
      ctx.globalAlpha = al * (q.white ? 0.2 : 0.8);
      ctx.drawImage(T.flakeGrey, q.x - s * 0.55, q.y - s * 0.4, s * 1.6, s * 1.6);
    } else {
      ctx.globalAlpha = q.white ? Math.min(1, al * 1.35) : al;
      ctx.drawImage(T.flake, q.x - s, q.y - s, s * 2, s * 2);
    }
  }
  ctx.globalAlpha = 1;

  // Cloud shadows: soft grey masses. Washed out by the flat light of a whiteout.
  const cloudA = (0.24 + st * 0.14) * (1 - wo * 0.85);
  if (cloudA > 0.01) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = cloudA;
    fillWind(ctx, pCloud, 128, 128, 4.2, cloudU, cloudV, r, a);
  }

  // Low haze: long ragged banks lying along the wind.
  ctx.globalCompositeOperation = 'source-over';
  // (Both fog layers step aside once the screen-space whiteout covers the view.)
  const hazeA = (0.08 + st * 0.45) * (1 - clamp01((wo - 0.5) / 0.3)) * (1 - 0.4 * (director.shelter || 0));
  if (hazeA > 0.01) {
    ctx.globalAlpha = hazeA;
    fillWind(ctx, pHaze, 256, 256, 2.2, hazeU, 0, r, a);
  }

  // Thicker billowing fog in heavy weather (scrolls faster, coarser).
  const fogA = (clamp01((st - 0.55) / 0.45) * 0.4 + wo * 0.25) * (1 - clamp01((wo - 0.3) / 0.3)) * (1 - 0.45 * (director.shelter || 0));
  if (fogA > 0.01) {
    ctx.globalAlpha = fogA;
    fillWind(ctx, pFog, 256, 256, 1.6, fogU, 40, r, a);
  }
  ctx.globalAlpha = 1;
}
