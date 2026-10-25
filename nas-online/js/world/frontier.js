// The edge of the world. A thick border inside the map where the weather turns
// impossible, so the player is pushed to turn back. Writes state.frontier:
//   amount  0..1  how deep into the border the explorer is (0 = safe interior)
//   inX/inY       unit vector pointing back toward the interior
// weather.js reads amount for heavy snow and whiteout; explorer.js reads it to slow
// the walk and push back against the player.
import { state, MAP_W, MAP_H } from '../state.js';

// Border depth in world px, per side. The painting's own edges (sky band, fogged
// corners) sit inside this, so the storm hides the end of the art before the player
// reaches it. The south edge is thin: the sea, the trail and the cliffs below camp
// run right down to the bottom of the painting and must stay playable.
export const BORDER = { left: 230, right: 230, top: 280, bottom: 90 };

state.frontier = { amount: 0, inX: 0, inY: 0 };

export function frontierAt(x, y) {
  // Per side: 0 at the inner edge of the border, 1 at the map edge.
  const l = 1 - x / BORDER.left, r = 1 - (MAP_W - x) / BORDER.right;
  const t = 1 - y / BORDER.top, b = 1 - (MAP_H - y) / BORDER.bottom;
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
