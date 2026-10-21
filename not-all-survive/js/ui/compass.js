// The compass. Press and hold the explorer to dig in the pack (a bar fills over the
// head); when it fills, a round slot pops up beside them holding the compass. Tap it
// (or press C again) to take it out: a needle hangs over the explorer, pointing north
// (screen up-left for now), shaken by the wind. Too much wind, climbing, deep snow,
// being knocked down or cowering means you can't hold it — it goes back in the pack.
// Keyboard: hold C to dig, C again to take it out or put it away.
//
// state.compass = { phase: 'idle'|'rummage'|'slot'|'out', ... }
// Pushes events: rummage, compass (taken out), stow (put away).
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { SIGNAL } from '../palette.js';

const RUMMAGE_S = 2;              // time to dig the compass out of the pack
const SLOT_TIMEOUT_S = 6;         // an ignored slot closes itself
const OUT_S = 12;                 // the compass goes back in the pack after this long
const NORTH = -Math.PI * 0.75;    // screen angle of "north": up-left for now
const BAR_W = 12, BAR_H = 1.3;    // world units: about twice the explorer's width
const HEAD = 24;                  // height above the feet where the compass dial sits
const BAR_Y = 20;                 // the pack bar sits just above the hood

const C = state.compass = { phase: 'idle', t: 0, slotA: 0, outA: 0, angle: NORTH + 1.2, vel: 0 };
let holding = false;              // pointer or key held on the explorer
let wasMoving = false;

const zoom = () => state.cam.zoom || 1;
const feet = () => worldToScreen(state.player.x, state.player.y);

// Can the explorer get the compass out, or keep holding it, right now?
function blocked() {
  const p = state.player, w = state.wind;
  return p.mode === 'climb' || p.mode === 'approach' || p.mode === 'down' || p.mode === 'cower'
    || p.terrain === 'deep' || (w.speed + (w.gust || 0)) > 0.85 || (state.frontier?.amount || 0) > 0.4;
}

function onPlayer(sx, sy) {
  const f = feet(), z = zoom(), pad = 10;
  return Math.abs(sx - f.x) < 4 * z + pad && sy < f.y + 2 * z + pad && sy > f.y - 19 * z - pad;
}
function slotCenter() {
  const f = feet(), z = zoom();
  return { x: f.x - 15 * z, y: f.y - 11 * z, r: 5.5 * z };
}
function onSlot(sx, sy) {
  const s = slotCenter();
  return Math.hypot(sx - s.x, sy - s.y) < s.r + 10;
}

function startRummage() {
  if (blocked()) return;
  C.phase = 'rummage'; C.t = 0;
  state.events.push({ type: 'rummage', x: state.player.x, y: state.player.y });
}
function takeOut() {
  C.phase = 'out'; C.t = 0;
  C.angle = NORTH + (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random());   // settles in
  C.vel = 0;
  state.events.push({ type: 'compass', x: state.player.x, y: state.player.y });
}
function stow() {
  if (C.phase === 'out') state.events.push({ type: 'stow', x: state.player.x, y: state.player.y });
  C.phase = 'idle'; C.t = 0;
}

export function init() {
  state.uiPress = (sx, sy) => {
    if (!state.begun && !state.params.has('autostart')) return false;
    if (C.phase === 'slot' && onSlot(sx, sy)) { takeOut(); return true; }
    if (onPlayer(sx, sy)) {
      if (C.phase === 'out') { stow(); return true; }
      holding = true;
      if (C.phase === 'idle') startRummage();
      return true;                  // never walk into yourself
    }
    if (C.phase === 'slot') C.phase = 'idle';   // tapping elsewhere closes the slot
    return false;
  };
  state.uiRelease = () => { holding = false; };

  addEventListener('keydown', e => {
    if (e.code !== 'KeyC' || e.repeat) return;
    if (C.phase === 'slot') takeOut();
    else if (C.phase === 'out') stow();
    else { holding = true; if (C.phase === 'idle') startRummage(); }
  });
  addEventListener('keyup', e => { if (e.code === 'KeyC') holding = false; });

  // Test hooks: NAS.compassOpen() skips straight to the needle.
  window.NAS.compassOpen = () => takeOut();
}

export function update(dt) {
  const p = state.player;
  const moving = p.moving && p.speed > 2;
  C.t += dt;

  if (C.phase === 'rummage') {
    // Let go, start walking, or get caught out by the weather: the dig is abandoned.
    if (!holding || moving || blocked()) C.phase = 'idle';
    else if (C.t >= RUMMAGE_S) { C.phase = 'slot'; C.t = 0; }
  } else if (C.phase === 'slot') {
    if (C.t > SLOT_TIMEOUT_S || (moving && !wasMoving) || blocked()) C.phase = 'idle';
  } else if (C.phase === 'out') {
    if (blocked() || C.t > OUT_S) stow();
  }
  wasMoving = moving;

  // Fades.
  const k = Math.min(1, dt * 8);
  C.slotA += ((C.phase === 'slot' ? 1 : 0) - C.slotA) * k;
  C.outA += ((C.phase === 'out' ? 1 : 0) - C.outA) * Math.min(1, dt * 6);

  // Needle: an underdamped spring toward north, kicked by the wind and by walking.
  if (C.outA > 0.01) {
    const w = state.wind, gust = w.gust || 0;
    const storm = Math.min(1, w.speed + gust);
    let d = NORTH - C.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const shake = 1.5 + 55 * storm * storm + (moving ? 6 : 0) + (p.mode === 'walk' ? 0 : 0);
    C.vel += (d * 26 - C.vel * 3.2 + (Math.random() - 0.5) * shake * 6) * dt;
    C.angle += C.vel * dt;
  }
}

// --- drawing (screen space, after the night grade so the UI stays legible) --------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawNeedle(ctx, cx, cy, len, angle, alpha) {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const nx = -uy, ny = ux, wd = len * 0.22;
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, len * 0.06);
  ctx.strokeStyle = 'rgba(30,30,32,0.85)';
  // south half: pale
  ctx.beginPath();
  ctx.moveTo(cx - ux * len, cy - uy * len);
  ctx.lineTo(cx + nx * wd, cy + ny * wd);
  ctx.lineTo(cx - nx * wd, cy - ny * wd);
  ctx.closePath();
  ctx.fillStyle = '#ecebe6';
  ctx.fill(); ctx.stroke();
  // north half: signal yellow
  ctx.beginPath();
  ctx.moveTo(cx + ux * len, cy + uy * len);
  ctx.lineTo(cx + nx * wd, cy + ny * wd);
  ctx.lineTo(cx - nx * wd, cy - ny * wd);
  ctx.closePath();
  ctx.fillStyle = SIGNAL.lit;
  ctx.fill(); ctx.stroke();
  // pivot
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.2, len * 0.09), 0, Math.PI * 2);
  ctx.fillStyle = '#2a2a2c';
  ctx.fill();
}

export function drawScreen(ctx) {
  if (C.phase === 'idle' && C.slotA < 0.01 && C.outA < 0.01) return;
  const { dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const f = feet(), z = zoom();
  const top = f.y - HEAD * z;

  // Pack bar: transparent white with a white fill, over the explorer's head.
  if (C.phase === 'rummage') {
    const w = BAR_W * z, h = Math.max(4, BAR_H * z), x = f.x - w / 2, y = f.y - BAR_Y * z - h / 2;
    const frac = Math.min(1, C.t / RUMMAGE_S);
    ctx.globalAlpha = Math.min(1, C.t * 6);
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

  // Slot beside the explorer, holding the compass.
  if (C.slotA > 0.01) {
    const s = slotCenter();
    const pop = 0.7 + 0.3 * C.slotA;
    const r = s.r * pop;
    ctx.globalAlpha = C.slotA;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, z * 0.35);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(40,40,44,0.3)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, r + Math.max(1.2, z * 0.35), 0, Math.PI * 2);
    ctx.stroke();
    // the compass inside: a small case and a needle at rest
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(236,235,230,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,32,0.8)';
    ctx.lineWidth = Math.max(1, z * 0.25);
    ctx.stroke();
    drawNeedle(ctx, s.x, s.y, r * 0.5, NORTH, C.slotA);
  }

  // The needle itself, over the explorer.
  if (C.outA > 0.01) {
    const len = 5 * z;
    const y = top - 1 * z;
    // a faint dial so the needle has somewhere to live
    ctx.globalAlpha = C.outA * 0.55;
    ctx.beginPath();
    ctx.arc(f.x, y, len * 1.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    drawNeedle(ctx, f.x, y, len, C.angle, C.outA);
  }
  ctx.globalAlpha = 1;
}
