// The edge of the world. A thick border inside the map where the weather turns
// impossible, so the player is pushed to turn back. Writes state.frontier:
//   amount  0..1  how deep into the border the explorer is (0 = safe interior)
//   inX/inY       unit vector pointing back toward the interior
// weather.js reads amount for heavy snow and whiteout; explorer.js reads it to slow
// the walk and push back against the player.
import { state, MAP_W, MAP_H } from '../state.js';

// Border depth in world px. The painting's own edges (sky band, fogged corners) sit
// inside this, so the storm hides the end of the art before the player reaches it.
const BORDER = 260;

state.frontier = { amount: 0, inX: 0, inY: 0 };

export function frontierAt(x, y) {
  // Per side: 0 at the inner edge of the border, 1 at the map edge.
  const l = 1 - x / BORDER, r = 1 - (MAP_W - x) / BORDER;
  const t = 1 - y / BORDER, b = 1 - (MAP_H - y) / BORDER;
  const k = v => Math.max(0, Math.min(1, v));
  const dx = k(l) - k(r), dy = k(t) - k(b);   // > 0 means push toward +x / +y
  const raw = Math.max(k(l), k(r), k(t), k(b));
  // Ease in so the first stretch is a warning, the last third is a wall.
  const amount = raw * raw * (3 - 2 * raw);
  const d = Math.hypot(dx, dy) || 1;
  return { amount, inX: dx / d, inY: dy / d };
}

export function update() {
  const p = state.player, f = frontierAt(p.x, p.y);
  // Smooth so crossing into the border feels like weather arriving, not a switch.
  const fr = state.frontier;
  const k = Math.min(1, state.dt * 1.5);
  fr.amount += (f.amount - fr.amount) * k;
  fr.inX = f.inX;
  fr.inY = f.inY;
}
