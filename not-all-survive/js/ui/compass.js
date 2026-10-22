// The compass. Press and hold the explorer to dig in the pack (a bar fills over the
// head); when it fills, a round slot pops up beside them holding the compass. Tap it
// (or press C again) to take it out: a needle hangs over the explorer, pointing north
// (screen up-left for now), shaken by the wind. Too much wind, climbing, deep snow,
// being knocked down or cowering means you can't hold it — it goes back in the pack.
// Keyboard: hold C to dig, then C or 1 compass, 2 snowshoes, 3 ice axes, 4 crampons.
//
// The pack holds more than the compass: grey slots hold the snowshoes (below the
// compass), and the ice axes and crampons (a second column further left). Tapping
// one puts it on or takes it off. Climbing or stepping onto ice puts snowshoes back
// in the pack; snowshoes and crampons can't both be worn. Climbing needs axes AND
// crampons (explorer.js checks gear before starting a climb). state.player.gear = { snowshoes } is the equipped state;
// state.player.gear = { snowshoes, axes, crampons }; explorer.js reads it.
//
// state.compass = { phase: 'idle'|'rummage'|'slot'|'out', ... }
// Pushes events: rummage, compass (taken out), stow (put away),
//   gear { item: 'snowshoes', on, auto } (strapped on / taken off / auto-stowed).
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
const gear = state.player.gear = Object.assign({ snowshoes: false, axes: false, crampons: false }, state.player.gear);
let holding = false;              // pointer or key held on the explorer
let wasMoving = false;

const zoom = () => state.cam.zoom || 1;
const feet = () => worldToScreen(state.player.x, state.player.y);

// Can the explorer get into the pack at all right now? (Deep snow is fine: that's
// exactly where you want your snowshoes.)
function packBlocked() {
  const p = state.player, w = state.wind;
  return p.mode === 'climb' || p.mode === 'approach' || p.mode === 'down' || p.mode === 'cower'
    || (w.speed + (w.gust || 0)) > 0.85 || (state.frontier?.amount || 0) > 0.4;
}
// Can they hold the compass? Not while wading through deep snow either.
function blocked() { return packBlocked() || state.player.terrain === 'deep'; }
// Snowshoes are useless (and dangerous) on ice and while climbing.
const iceUnder = () => state.player.terrain === 'ice' || state.player.terrain === 'thin';
function shoesBlocked() {
  const m = state.player.mode;
  return m === 'climb' || m === 'approach' || iceUnder();
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
  return Math.hypot(sx - s.x, sy - s.y) < s.r + 8;
}
// Gear slots. Column 1 (beside the explorer): compass, then snowshoes below it.
// Column 2 (further left): ice axes, then crampons. Climbing needs axes AND crampons.
const GEAR = [
  { id: 'snowshoes', col: 0, row: 1, key: 'Digit2', icon: drawSnowshoes, blocked: () => shoesBlocked() },
  { id: 'axes', col: 1, row: 0, key: 'Digit3', icon: drawAxes, blocked: () => climbing() },
  { id: 'crampons', col: 1, row: 1, key: 'Digit4', icon: drawCrampons, blocked: () => climbing() },
];
const climbing = () => state.player.mode === 'climb' || state.player.mode === 'approach';
// Snowshoes and crampons both strap to the boots: wearing one means taking off the other.
const EXCLUSIVE = { snowshoes: 'crampons', crampons: 'snowshoes' };

function gearCenter(g) {
  const s = slotCenter();
  return { x: s.x - g.col * s.r * 2.5, y: s.y + g.row * s.r * 2.5, r: s.r };
}
function gearAt(sx, sy) {
  return GEAR.find(g => { const c = gearCenter(g); return Math.hypot(sx - c.x, sy - c.y) < c.r + 8; });
}
function setGear(id, on, auto = false) {
  if (gear[id] === on) return;
  if (on && EXCLUSIVE[id] && gear[EXCLUSIVE[id]]) setGear(EXCLUSIVE[id], false, true);
  gear[id] = on;
  state.events.push({ type: 'gear', item: id, on, auto, x: state.player.x, y: state.player.y });
}
function toggleGear(g) {
  if (g.blocked()) return;
  setGear(g.id, !gear[g.id]);
  C.phase = 'idle';
}

function startRummage() {
  if (packBlocked()) return;
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
    if (C.phase === 'slot' && onSlot(sx, sy)) { if (!blocked()) takeOut(); return true; }
    if (C.phase === 'slot') {
      const g = gearAt(sx, sy);
      if (g) { toggleGear(g); return true; }
    }
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
    if (e.repeat) return;
    const g = C.phase === 'slot' && GEAR.find(x => x.key === e.code);
    if (g) { toggleGear(g); return; }
    if (C.phase === 'slot' && e.code === 'Digit1') { if (!blocked()) takeOut(); return; }
    if (e.code !== 'KeyC') return;
    if (C.phase === 'slot') { if (!blocked()) takeOut(); }
    else if (C.phase === 'out') stow();
    else { holding = true; if (C.phase === 'idle') startRummage(); }
  });
  addEventListener('keyup', e => { if (e.code === 'KeyC') holding = false; });

  // Test hooks: NAS.compassOpen() skips straight to the needle.
  window.NAS.compassOpen = () => takeOut();
  window.NAS.packOpen = () => { C.phase = 'slot'; C.t = 0; };
  window.NAS.snowshoes = on => setGear('snowshoes', on);
  window.NAS.gear = (id, on) => setGear(id, on);   // e.g. NAS.gear('axes', true)
}

export function update(dt) {
  const p = state.player;
  const moving = p.moving && p.speed > 2;
  C.t += dt;

  if (C.phase === 'rummage') {
    // Let go, start walking, or get caught out by the weather: the dig is abandoned.
    if (!holding || moving || packBlocked()) C.phase = 'idle';
    else if (C.t >= RUMMAGE_S) { C.phase = 'slot'; C.t = 0; }
  } else if (C.phase === 'slot') {
    if (C.t > SLOT_TIMEOUT_S || (moving && !wasMoving) || packBlocked()) C.phase = 'idle';
  } else if (C.phase === 'out') {
    if (blocked() || C.t > OUT_S) stow();
  }
  wasMoving = moving;

  // Snowshoes go back in the pack the moment you climb or step onto ice.
  if (gear.snowshoes && shoesBlocked()) setGear('snowshoes', false, true);

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

// A grey gear slot; the ring turns signal yellow while the item is worn.
function drawGearSlot(ctx, g, z, pop) {
  const c = gearCenter(g), r = c.r * pop, on = gear[g.id], dim = g.blocked();
  ctx.globalAlpha = C.slotA * (dim ? 0.45 : 1);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(150,152,158,0.42)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, z * 0.35);
  ctx.strokeStyle = on ? SIGNAL.lit : 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(40,40,44,0.3)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r + Math.max(1.2, z * 0.35), 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(c.x, c.y);
  g.icon(ctx, r, z);
  ctx.restore();
}

const INK = 'rgba(40,36,30,0.9)', PALE = 'rgba(236,235,230,0.92)';

// Two teardrop frames with cross lacing.
function drawSnowshoes(ctx, r, z) {
  for (const side of [-1, 1]) {
    const rw = r * 0.2, rh = r * 0.5;
    ctx.save();
    ctx.translate(side * r * 0.24, 0);
    ctx.rotate(side * 0.18);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALE; ctx.fill();
    ctx.lineWidth = Math.max(1, z * 0.28); ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = Math.max(0.6, z * 0.12); ctx.strokeStyle = 'rgba(40,36,30,0.6)';
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(-rw * 0.8, i * rh * 0.3); ctx.lineTo(rw * 0.8, i * rh * 0.3); }
    ctx.moveTo(0, -rh * 0.85); ctx.lineTo(0, rh * 0.85);
    ctx.stroke();
    ctx.restore();
  }
}

// Two ice axes crossed: shafts, curved picks, adze heads.
function drawAxes(ctx, r, z) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * 0.55);
    const L = r * 0.62;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.6, z * 0.42); ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(0, L); ctx.lineTo(0, -L * 0.8); ctx.stroke();       // shaft
    ctx.lineWidth = Math.max(1, z * 0.22); ctx.strokeStyle = PALE;
    ctx.beginPath(); ctx.moveTo(0, L * 0.9); ctx.lineTo(0, -L * 0.7); ctx.stroke(); // shaft highlight
    ctx.lineWidth = Math.max(1.4, z * 0.34); ctx.strokeStyle = INK;
    ctx.beginPath();                                                                 // head: pick + adze
    ctx.moveTo(-L * 0.55, -L * 0.62);
    ctx.quadraticCurveTo(0, -L * 1.0, L * 0.5, -L * 0.72);
    ctx.stroke();
    ctx.restore();
  }
}

// A crampon seen from below: a frame with two rows of spikes.
function drawCrampons(ctx, r, z) {
  const w = r * 0.42, h = r * 0.62;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, -h); ctx.lineTo(w * 0.55, -h);
  ctx.lineTo(w * 0.7, -h * 0.2); ctx.lineTo(w * 0.5, h); ctx.lineTo(-w * 0.5, h);
  ctx.lineTo(-w * 0.7, -h * 0.2); ctx.closePath();
  ctx.fillStyle = PALE; ctx.fill();
  ctx.lineWidth = Math.max(1, z * 0.28); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const y = -h * 0.85 + i * h * 0.6, x = side * w * (0.72 - (i === 3 ? 0.15 : 0));
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.06); ctx.lineTo(x + side * r * 0.16, y); ctx.lineTo(x, y + r * 0.06);
      ctx.closePath(); ctx.fill();
    }
  }
  // front points
  for (const dx of [-0.2, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(w * dx - r * 0.05, -h); ctx.lineTo(w * dx, -h - r * 0.18); ctx.lineTo(w * dx + r * 0.05, -h);
    ctx.closePath(); ctx.fill();
  }
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
    drawNeedle(ctx, s.x, s.y, r * 0.5, NORTH, C.slotA * (blocked() ? 0.35 : 1));
    if (blocked()) {      // greyed out: you can't hold it here
      ctx.globalAlpha = C.slotA * 0.55;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,200,204,0.6)'; ctx.fill();
    }
    for (const g of GEAR) drawGearSlot(ctx, g, z, pop);
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
