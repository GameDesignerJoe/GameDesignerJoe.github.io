// Boot prints left by the explorer, drawn on the ground under the actors.
// Listens for { type: 'step', x, y, terrain, foot, weight, angle } events.
//   deep snow : deep fresh holes with a dragged furrow between steps
//   snow      : lighter pressed prints        path : faint prints
//   ice / thin: faint scuffs                  rock : nothing
// Prints fill in and fade over time, faster in falling snow and wind. Bounded list, culled.
// Wet boots (step.wet, body.js, after open water) leave darker, soaked prints.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';

const KY = 0.8;     // ground-depth foreshortening (matches explorer.js)
const MAX = 320;
// fill-in rate per second at calm weather (1 / lifetime)
const RATE = { deep: 1 / 160, snow: 1 / 120, path: 1 / 60, ice: 1 / 16, thin: 1 / 14 };

const prints = [];
let last = null; // previous print, for the deep-snow drag furrow

export function update(dt) {
  for (const e of state.events) {
    if (e.type === 'teleport') { last = null; continue; }   // a new trail, no furrow from the old spot
    if (e.type !== 'step') continue;
    const t = e.terrain;
    if (!RATE[t]) { last = null; continue; }
    const a = e.angle ?? state.player.facing;
    const p = { x: e.x, y: e.y, a, t, foot: e.foot, w: e.weight ?? 0.7, fill: 0, seed: Math.random(), prev: null, shoe: !!e.shoe, cramp: !!e.cramp, wet: Math.min(1, e.wet || 0) };
    if (t === 'deep' && last && last.t === 'deep' && Math.hypot(last.x - p.x, last.y - p.y) < 9) p.prev = { x: last.x, y: last.y };
    prints.push(p);
    last = p;
  }
  if (prints.length > MAX) prints.splice(0, prints.length - MAX);
  const weather = 1 + 2.5 * (state.weather.snowfall ?? 0) + 1.5 * (state.wind.speed ?? 0) + (state.weather.whiteout ?? 0) * 2;
  for (let i = prints.length - 1; i >= 0; i--) {
    const p = prints[i];
    p.fill += dt * RATE[p.t] * weather;
    if (p.fill >= 1) prints.splice(i, 1);
  }
}

// Boot sole in local print space: x along travel (toe +), y across.
function sole(ctx, len, wid, ox = 0, oy = 0) {
  ctx.moveTo(len * 0.5 + ox, oy);
  ctx.ellipse(len * 0.18 + ox, oy, len * 0.34, wid * 0.5, 0, 0, Math.PI * 2);
  ctx.moveTo(-len * 0.28 + ox + len * 0.2, oy);
  ctx.ellipse(-len * 0.3 + ox, oy, len * 0.2, wid * 0.42, 0, 0, Math.PI * 2);
}

export function drawGround(ctx) {
  if (!prints.length) return;
  const r = visibleRect(6);
  // drag furrows first, under the prints
  for (const p of prints) {
    if (!p.prev || p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
    const al = (1 - p.fill * p.fill) * 0.5;
    ctx.lineCap = 'round';
    // a soft trough ploughed between the holes: no outline, just a shallow grey drag
    ctx.beginPath(); ctx.moveTo(p.prev.x, p.prev.y); ctx.lineTo(p.x, p.y);
    const sh = p.shoe ? 0.35 : 1;   // snowshoes ride high: a much shallower trench
    ctx.strokeStyle = `rgba(160,163,168,${al * 0.32 * sh})`; ctx.lineWidth = p.shoe ? 2.8 : 2.2; ctx.stroke();
    ctx.strokeStyle = `rgba(140,143,148,${al * 0.2 * sh})`; ctx.lineWidth = 1.1; ctx.stroke();
  }
  for (const p of prints) {
    if (p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    const life = 1 - p.fill * p.fill; // stays crisp, then fills in
    ctx.save();
    // oriented with travel, foreshortened on the ground plane
    ctx.transform(ca, sa * KY, -sa, ca * KY, p.x, p.y);
    // left and right boots stagger either side of the line of travel, toes turned out a touch
    const side = p.foot === 'L' ? -1 : 1;
    ctx.translate(0, side * 0.15);
    ctx.rotate(side * 0.12);
    if (p.shoe && (p.t === 'deep' || p.t === 'snow')) {
      // snowshoe: a big shallow oval outline with the webbing lattice pressed faintly inside
      // (a touch deeper in deep snow); sized like the frame, ~4 x 1.7u
      const al = life * (p.t === 'deep' ? 0.55 : 0.45);
      const tear = () => {
        ctx.beginPath();
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * Math.PI * 2, c = Math.cos(a);
          const w = c > 0 ? 1.0 : 1.0 * (1 + c * 0.72), x = c > 0 ? c * 1.9 : c * 2.4;
          k ? ctx.lineTo(x, Math.sin(a) * w) : ctx.moveTo(x, Math.sin(a) * w);
        }
        ctx.closePath();
      };
      ctx.translate(-0.3, 0);
      tear(); ctx.fillStyle = `rgba(200,203,208,${al * 0.35})`; ctx.fill();
      ctx.save(); tear(); ctx.clip();
      ctx.strokeStyle = `rgba(150,154,160,${al * 0.75})`; ctx.lineWidth = 0.07; ctx.beginPath();
      for (let k = -6; k <= 5; k++) { ctx.moveTo(k * 0.42 - 0.9, -1); ctx.lineTo(k * 0.42 + 0.9, 1); ctx.moveTo(k * 0.42 + 0.9, -1); ctx.lineTo(k * 0.42 - 0.9, 1); }
      ctx.stroke(); ctx.restore();
      tear(); ctx.strokeStyle = `rgba(118,122,128,${al})`; ctx.lineWidth = 0.18; ctx.stroke();
    } else if (p.t === 'deep') {
      const al = life * (0.55 + 0.25 * p.w);
      // an irregular punched hole: dark wall on the upper-left, paler trodden floor
      const hole = (sx, sy, ox, oy) => {
        ctx.beginPath();
        for (let k = 0; k < 11; k++) {
          const a = (k / 11) * Math.PI * 2;
          const j = 0.78 + 0.32 * Math.abs(Math.sin(p.seed * 91 + k * 2.3)) + 0.12 * Math.sin(p.seed * 37 + k * 5.1);
          const x = ox + Math.cos(a) * sx * j, y = oy + Math.sin(a) * sy * j;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
      };
      hole(1.55, 0.95, 0, 0);
      ctx.fillStyle = `rgba(98,101,106,${al})`; ctx.fill();
      hole(1.2, 0.68, 0.2, 0.14);
      ctx.fillStyle = `rgba(178,181,185,${al})`; ctx.fill();
      // kicked-up rim toward the lower right
      ctx.beginPath(); ctx.ellipse(0.2, 0.95, 1.3, 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(252,252,252,${life * 0.7})`; ctx.fill();
    } else if (p.t === 'snow' || p.t === 'path') {
      const al = life * (p.t === 'snow' ? 0.62 : 0.38) * (0.75 + 0.35 * p.w) * (1 + 0.5 * p.wet);
      // soaked: a dark damp halo round the sole and a darker floor
      if (p.wet > 0.05) { ctx.beginPath(); sole(ctx, 2.5, 1.25, -0.05, 0); ctx.fillStyle = `rgba(110,116,124,${life * 0.3 * p.wet})`; ctx.fill(); }
      ctx.beginPath(); sole(ctx, 2.1, 0.95);
      ctx.fillStyle = `rgba(${120 - 40 * p.wet},${123 - 38 * p.wet},${128 - 34 * p.wet},${Math.min(1, al)})`; ctx.fill();
      ctx.beginPath(); sole(ctx, 1.8, 0.72, 0.14, 0.12);
      ctx.fillStyle = `rgba(${178 - 70 * p.wet},${181 - 68 * p.wet},${185 - 64 * p.wet},${Math.min(1, al * 0.85)})`; ctx.fill();
      // crampon points pricked round the sole
      if (p.cramp && life > 0.3) {
        ctx.fillStyle = `rgba(95,98,104,${al * 0.9})`;
        for (const [x, y] of [[0.9, 0], [0.62, -0.38], [0.62, 0.38], [0.2, -0.42], [0.2, 0.42], [-0.35, -0.36], [-0.35, 0.36], [-0.7, 0]]) {
          ctx.beginPath(); ctx.arc(x, y, 0.09, 0, Math.PI * 2); ctx.fill();
        }
      }
      // tread lines
      if (life > 0.5 && !p.cramp) {
        ctx.strokeStyle = `rgba(110,112,116,${al * 0.6})`; ctx.lineWidth = 0.12;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { const x = 0.55 - k * 0.32; ctx.moveTo(x, -0.28); ctx.lineTo(x, 0.28); }
        ctx.stroke();
      }
    } else {
      // ice: faint scuff marks, a little skid along the travel direction
      const al = life * 0.3;
      if (p.cramp) {
        // crampons on ice: a neat cluster of pricks instead of a skid
        ctx.fillStyle = `rgba(95,98,104,${life * 0.55})`;
        for (const [x, y] of [[0.9, 0], [0.62, -0.38], [0.62, 0.38], [0.2, -0.42], [0.2, 0.42], [-0.35, -0.36], [-0.35, 0.36], [-0.7, 0]]) {
          ctx.beginPath(); ctx.arc(x, y, 0.08, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        continue;
      }
      ctx.strokeStyle = `rgba(95,98,104,${al})`; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
      ctx.beginPath();
      const k = 0.6 + p.seed * 0.8;
      ctx.moveTo(-0.9 * k, -0.15); ctx.lineTo(0.8 * k, -0.25 + p.seed * 0.2);
      ctx.moveTo(-0.6 * k, 0.18); ctx.lineTo(0.6 * k, 0.12);
      ctx.stroke();
      ctx.strokeStyle = `rgba(250,250,250,${al})`;
      ctx.beginPath(); ctx.moveTo(-0.7 * k, 0.32); ctx.lineTo(0.5 * k, 0.3); ctx.stroke();
    }
    ctx.restore();
  }
}
export const _debug = { prints };
