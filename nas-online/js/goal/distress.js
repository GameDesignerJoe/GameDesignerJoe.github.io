// The goal (Joe, first stab): somewhere out on the ice lies an explorer from an earlier party who
// set off a distress beacon just before they died. The radio (audio/radio.js) picks up its signal:
// faint blips far off, quicker and louder nearer, turning into the SOS itself when you're in the
// area. Find them, and their pack can be recovered like any of the fallen (ui/pack.js).
//
// The site: a random spot each run, on foot-reachable ground (not ice, water, rock or cliff), well
// out from base camp and inside the safe area (clear of the frontier storm). ?sos=x,y forces it.
// The body: half-buried in a drift, one arm up, the beacon in the snow by the hand with its short
// aerial and a signal-yellow light that blinks while it still has charge.
//
// state.distress = { x, y, found, wrapped, wrapK, light } (found: their pack has been opened; the beacon
// stops blinking and the radio goes quiet). Their pack goes in state.fallen (flag distress: true; fallen.js
// leaves the drawing to this module). Wrapped (goal/burden.js: wrapping them, carrying or dragging them home):
// only the hollow they lay in and the dead beacon are left here; while being wrapped (wrapK) the raised arm
// is laid down under the sheet.
// Pushes events: distress { stage: 'found' }.
// (Later, per Joe: dig them out with a shovel first. The hook for it: a 'dig' act before 'wrap' in
// burden.js ACTS.body, with the drift drawn here shrinking as it goes.)
import { state } from '../state.js';
import * as T from '../world/terrain.js';
import { visibleRect } from '../camera.js';
import { BORDER } from '../world/frontier.js';
import { TENT } from '../actors/camp.js';
import { SIGNAL } from '../palette.js';
import * as NAV from '../sim/nav.js';

const MIN_D = 650, MAX_D = 1150;          // world px from base camp
const MAX_WALK = 2600;                    // ...and no further than this to walk there (round water and cliffs)
const D = state.distress = { x: 0, y: 0, found: false, light: 0, ready: false };
let entry = null;

function pickSite() {
  const m = T.mask();
  if (!m) return false;
  const W = m.w * m.scale, H = m.h * m.scale;
  const forced = state.params.get('sos')?.split(',').map(Number);
  if (forced && forced.length === 2 && forced.every(Number.isFinite)) { D.x = forced[0]; D.y = forced[1]; return true; }
  // walkable from camp, by the same grid the sim walks on (js/sim/nav.js): body-wide gaps, no open water, not
  // through the frontier storm; a site it can't walk to is picked again
  const walkD = NAV.walkDistances(TENT.x + 20, TENT.y + 18);
  const ok = (x, y) => {
    const t = T.terrainAt(x, y);
    if (t !== 'snow' && t !== 'deep' && t !== 'path') return false;
    if (T.isWater(x, y) || !T.reachableOnFoot(x, y)) return false;
    if (walkD && !(NAV.distAt(walkD, x, y) < MAX_WALK)) return false;
    // a little room round them (not wedged against rock)
    for (const [dx, dy] of [[6, 0], [-6, 0], [0, 5], [0, -5]]) if (!T.isWalkable(x + dx, y + dy)) return false;
    return true;
  };
  for (let i = 0; i < 4000; i++) {
    const x = BORDER.left + 40 + Math.random() * (W - BORDER.left - BORDER.right - 80);
    const y = BORDER.top + 40 + Math.random() * (H - BORDER.top - BORDER.bottom - 80);
    const d = Math.hypot(x - TENT.x, y - TENT.y);
    if (d < MIN_D || d > MAX_D || !ok(x, y)) continue;
    D.x = x; D.y = y; return true;
  }
  // nowhere that far: settle for the farthest good spot found on a coarse sweep
  let best = null, bd = 0;
  for (let y = BORDER.top + 40; y < H - BORDER.bottom - 40; y += 24) for (let x = BORDER.left + 40; x < W - BORDER.right - 40; x += 24) {
    const d = Math.hypot(x - TENT.x, y - TENT.y);
    if (d > bd && ok(x, y)) { bd = d; best = { x, y }; }
  }
  if (!best) return false;
  D.x = best.x; D.y = best.y; return true;
}

export function update(dt) {
  if (!D.ready) {
    if (!pickSite()) return;
    D.ready = true;
    // what they carried: a little food, a splint, and the recorder with their last words
    entry = { x: D.x, y: D.y, facing: 0, name: 'the lost explorer', distress: true, snow: 0.6,
      pack: { slots: [{ id: 'food', n: 2 }, { id: 'splint', n: 1 }, { id: 'rec_sos', n: 1 }] } };
    (state.fallen || (state.fallen = [])).push(entry);
    console.log(`[distress] the beacon is at ${D.x.toFixed(0)}, ${D.y.toFixed(0)}`);
  }
  // opened their pack: found
  if (!D.found && state.events.some(e => e.type === 'rummage' && e.target === 'fallen') && Math.hypot(state.player.x - D.x, state.player.y - D.y) < 30) {
    D.found = true;
    state.events.push({ type: 'distress', stage: 'found', x: D.x, y: D.y });
  }
  // the beacon's blink, until they're found (the signal has done its work: the radio goes quiet too)
  D.light = !D.found && (state.time % 1.6) < 0.18 ? 1 : 0;
}

export function drawables() {
  if (!D.ready) return [];
  const r = visibleRect(40);
  if (D.x < r.x0 || D.x > r.x1 || D.y < r.y0 || D.y > r.y1) return [];
  return [{ x: D.x, y: D.y, draw: drawSite }];
}

// Half-buried in a drift: a long snow mound, a dark sleeve and mitt reaching up out of it, a
// hood edge, the beacon by the hand. Ink outlines, pale snow, the earlier party's dark coat.
function drawSite(ctx) {
  const x = D.x, y = D.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ink = 'rgba(28,30,34,0.9)';
  if (D.wrapped) { drawEmpty(ctx, ink); ctx.restore(); return; }
  // shadow and the hollow the drift has scooped round them
  ctx.fillStyle = 'rgba(60,64,72,0.2)';
  ctx.beginPath(); ctx.ellipse(1, 1.4, 11, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  // the body lying on its side, head to the left: the dark coat of the earlier party
  ctx.beginPath();
  ctx.moveTo(-7.5, -0.6);
  ctx.bezierCurveTo(-7.8, -3.4, -3, -4.6, 1.5, -3.6);
  ctx.bezierCurveTo(4.5, -3, 6.5, -1.6, 6.8, 0.4);
  ctx.bezierCurveTo(2, 1.4, -4, 1.3, -7.5, -0.6);
  ctx.fillStyle = '#3a3e46'; ctx.fill();
  ctx.lineWidth = 0.4; ctx.strokeStyle = ink; ctx.stroke();
  // the hood, and the dark face opening turned into the snow
  ctx.beginPath(); ctx.ellipse(-7.4, -2.2, 2.2, 2.0, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#434852'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-8.2, -1.7, 0.9, 1.0, -0.3, 0, Math.PI * 2); ctx.fillStyle = '#121418'; ctx.fill();
  // the arm flung up and out, bent at the elbow, the mitt open (being wrapped: laid down under the sheet)
  if (!(D.wrapK > 0.35)) {
    ctx.strokeStyle = '#2f333a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-2.5, -3.6); ctx.lineTo(-1.2, -7.2); ctx.lineTo(1.8, -8.6); ctx.stroke();
    ctx.fillStyle = '#1b1d21';
    ctx.beginPath(); ctx.ellipse(2.6, -8.8, 1.1, 0.85, 0.3, 0, Math.PI * 2); ctx.fill();
  }
  // snow settled along the top of the coat
  ctx.strokeStyle = 'rgba(246,247,245,0.95)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-6, -3.5); ctx.bezierCurveTo(-3, -4.4, 1, -3.9, 3.5, -3); ctx.stroke();
  ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-8.6, -3.8); ctx.lineTo(-6.6, -4.1); ctx.stroke();
  // the drift burying the legs and the lower half
  ctx.beginPath();
  ctx.moveTo(-1.5, 1.2);
  ctx.bezierCurveTo(-0.5, -1.6, 3, -2.9, 6.5, -2.3);
  ctx.bezierCurveTo(9, -1.8, 10.5, -0.6, 11, 1.2);
  ctx.closePath();
  ctx.fillStyle = '#f4f5f3'; ctx.fill();
  ctx.lineWidth = 0.35; ctx.strokeStyle = 'rgba(40,40,44,0.7)'; ctx.stroke();
  ctx.fillStyle = 'rgba(150,156,166,0.35)';
  ctx.beginPath(); ctx.moveTo(4, 1.2); ctx.bezierCurveTo(6.5, -0.3, 9, -0.4, 11, 1.2); ctx.closePath(); ctx.fill();
  // the beacon in the snow by the hand: a small box, a stubby aerial, the light
  ctx.fillStyle = '#4a4740'; ctx.strokeStyle = 'rgba(20,20,22,0.9)'; ctx.lineWidth = 0.3;
  ctx.beginPath(); ctx.rect(3.4, -6.4, 2.4, 1.6); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(5.3, -6.4); ctx.lineTo(6.1, -9.4); ctx.stroke();
  if (D.light) {
    ctx.fillStyle = SIGNAL.glow;
    ctx.beginPath(); ctx.arc(6.1, -9.6, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(6.1, -9.6, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// Wrapped and taken (goal/burden.js draws the bundle): the hollow they lay in, scooped out of the drift,
// and the dead beacon left lying in the snow.
function drawEmpty(ctx, ink) {
  ctx.fillStyle = 'rgba(150,156,166,0.3)';
  ctx.beginPath(); ctx.ellipse(-0.5, -0.4, 8.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(120,126,136,0.22)';
  ctx.beginPath(); ctx.ellipse(-1, -0.9, 6.5, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  // the drift, broken open where the legs were
  ctx.beginPath();
  ctx.moveTo(2.5, 1.2);
  ctx.bezierCurveTo(3.5, -0.8, 6, -2.2, 8, -1.8);
  ctx.bezierCurveTo(9.8, -1.4, 10.8, -0.4, 11, 1.2);
  ctx.closePath();
  ctx.fillStyle = '#f4f5f3'; ctx.fill();
  ctx.lineWidth = 0.35; ctx.strokeStyle = 'rgba(40,40,44,0.7)'; ctx.stroke();
  ctx.fillStyle = '#4a4740'; ctx.strokeStyle = ink; ctx.lineWidth = 0.3;
  ctx.save(); ctx.translate(4.2, -4.6); ctx.rotate(0.5);
  ctx.beginPath(); ctx.rect(-1.2, -0.8, 2.4, 1.6); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0.9, -0.8); ctx.lineTo(2.6, -2.2); ctx.stroke();
  ctx.restore();
}
