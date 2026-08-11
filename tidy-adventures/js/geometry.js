/* ============================================================
   GEOMETRY — room shapes, keep-out zones, floor-spot search, room distance.

   The keep-out padding used to be five verbatim copies of
   `x>s.x-1.5 && x<s.x+s.w+1.5 && y>s.y-3.5 && y<s.y+s.h+1.5` scattered
   through generation, tossing and respawning. Three of them had drifted to
   different values. They're one function now, with the pads in
   data/furniture.json.

   Imports: config, data.
============================================================ */
import { PLACE_TRIES, DIRS } from './config.js';
import { DATA } from './data.js';

/* Is this % point inside the room's silhouette? */
export function inShape(room, x, y) {
  if (room.shape === "round") {
    const dx = (x - 50) / 46, dy = (y - 50) / 46;
    return dx * dx + dy * dy <= 1;
  }
  if (room.shape === "hex") {
    const px = (x - 50) / 50, py = (y - 50) / 50;
    return Math.abs(py) <= 0.9 && Math.abs(px) + 0.5 * Math.abs(py) <= 0.92;
  }
  return true;
}

export const pad = name => DATA.furniture.pads[name] || DATA.furniture.pads.tight;

/* Does this point fall inside a slot's keep-out box? */
export function inSlot(slot, x, y, p) {
  return x > slot.x - p.x && x < slot.x + slot.w + p.x
      && y > slot.y - p.yTop && y < slot.y + slot.h + p.yBot;
}

export const onFurniture = (room, x, y, p = pad("tight")) =>
  room.containers.some(c => inSlot(c.slot, x, y, p));

export const onCache = (room, x, y, p = pad("cache")) =>
  (room.caches || []).some(k => inSlot(k.slot, x, y, p));

/* Find a clear floor point. Returns a point even if it never found a clean
   one — a slightly-overlapping item is far better than a missing item. */
export function findFloorSpot(room, {
  padName = "tight", margin = 4, span = 92, avoidCaches = false, tries = PLACE_TRIES,
} = {}) {
  const p = pad(padName);
  let x = 0, y = 0;
  for (let i = 0; i < tries; i++) {
    x = margin + Math.random() * span;
    y = margin + Math.random() * span;
    if (!inShape(room, x, y)) continue;
    if (onFurniture(room, x, y, p)) continue;
    if (avoidCaches && onCache(room, x, y)) continue;
    return { x, y, clean: true };
  }
  return { x, y, clean: false };
}

export const spin = (deg = 20) => Math.random() * deg * 2 - deg;

/* ============================================================
   Door graph — how many rooms you must walk through to get from a to b.
   Used to keep a cache's token out of the cache's own room.
============================================================ */
export function roomDist(rooms, fromId, toId) {
  if (fromId === toId) return 0;
  const seen = new Set([fromId]);
  let frontier = [fromId], d = 0;
  while (frontier.length) {
    d++;
    const next = [];
    for (const id of frontier) {
      for (const dir of Object.keys(DIRS)) {
        const to = rooms[id].doors[dir];
        if (to === null || to === undefined || seen.has(to)) continue;
        if (to === toId) return d;
        seen.add(to);
        next.push(to);
      }
    }
    frontier = next;
  }
  return Infinity;   // sealed behind a lock; still "as far as possible"
}

/* The rooms in `candidates` that are furthest from `fromId` by door count. */
export function furthestFrom(rooms, fromId, candidates) {
  if (!candidates.length) return [];
  const scored = candidates.map(r => ({ r, d: roomDist(rooms, fromId, r.id) }));
  const best = Math.max(...scored.map(s => (s.d === Infinity ? -1 : s.d)));
  const winners = scored.filter(s => (s.d === Infinity ? -1 : s.d) === best).map(s => s.r);
  return winners.length ? winners : candidates;
}
