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

/* THE HOLDALL IS FURNITURE. It is a box standing on the floor, so it gets a
   slot and a keep-out exactly like a cupboard or a coin box — and then every
   placement path in the game avoids it for free: generation, tossing, flinging,
   the flick, the pet putting something down, and both spot searches below.

   It was drawn OVER the floor instead of IN it at first, at a fixed pixel size
   with nothing reserving the space. Measured across 25 generated rooms, 71% of
   the box's surface was covered by an item you had to move before you could tap
   it, and its centre was blocked 56% of the time. Shoving the clutter aside
   once when it lands is not enough, because everything that lands afterwards
   lands on it again.

   `room.bagSlot` rather than a lookup keyed by room id, for the same reason
   `c.slot` lives on the container: this module is a leaf that cannot see G, the
   room is the argument every one of these functions already takes, and it rides
   in the saved `rooms` with no save plumbing at all. */
export const onHoldall = (room, x, y, p = pad("tight")) =>
  !!room.bagSlot && inSlot(room.bagSlot, x, y, p);

/* ============================================================
   DOORWAYS — the one piece of room furniture items must never land under.

   A door paints at z-index 7 (above items) and carries an invisible ::after
   that widens its tap target, so an item that comes to rest in a doorway is
   both hidden AND untappable: the tap walks you into the next room instead of
   picking the thing up. Nothing else on the floor behaves that way, which is
   why doorways get their own keep-out rather than sharing the furniture pads.

   The zone is a band along the wall the door is in, expressed in room %, so
   it doesn't need to know the room's pixel size. Doors are sized in px and
   divided by --fit precisely so they stay a constant size on screen, and the
   camera fits every room to the same stage — so a fixed % band tracks them
   closely enough at any room size. Tune it in furniture.json.
============================================================ */
const doorZone = () => DATA.furniture.doorZone || { depth: 10, spread: 34 };

/* Keep-out rects, in room %, for the walls this room actually has doors in. */
export function doorZones(room) {
  const { depth, spread } = doorZone();
  const lo = 50 - spread / 2, hi = 50 + spread / 2;
  const out = [];
  for (const [dir, to] of Object.entries(room.doors || {})) {
    if (to === null || to === undefined) continue;
    if (dir === "N") out.push({ x0: lo, x1: hi, y0: 0, y1: depth });
    if (dir === "S") out.push({ x0: lo, x1: hi, y0: 100 - depth, y1: 100 });
    if (dir === "W") out.push({ x0: 0, x1: depth, y0: lo, y1: hi });
    if (dir === "E") out.push({ x0: 100 - depth, x1: 100, y0: lo, y1: hi });
  }
  return out;
}

export const inDoorway = (room, x, y) =>
  doorZones(room).some(z => x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1);

/* Is this point clear of everything that would swallow an item? */
export function isClearFloor(room, x, y, {
  padName = "tight", avoidCaches = true, avoidDoors = true,
} = {}) {
  if (!inShape(room, x, y)) return false;
  if (onFurniture(room, x, y, pad(padName))) return false;
  if (onHoldall(room, x, y, pad(padName))) return false;
  if (avoidCaches && onCache(room, x, y)) return false;
  if (avoidDoors && inDoorway(room, x, y)) return false;
  return true;
}

/* Find a clear floor point. Returns a point even if it never found a clean
   one — a slightly-overlapping item is far better than a missing item. */
export function findFloorSpot(room, {
  padName = "tight", margin = 4, span = 92, avoidCaches = false, avoidDoors = true,
  tries = PLACE_TRIES,
} = {}) {
  let x = 0, y = 0;
  for (let i = 0; i < tries; i++) {
    x = margin + Math.random() * span;
    y = margin + Math.random() * span;
    if (isClearFloor(room, x, y, { padName, avoidCaches, avoidDoors })) return { x, y, clean: true };
  }
  return { x, y, clean: false };
}

/* Where the player LET GO, if that spot is usable — otherwise the nearest
   usable spot to it. Dropping is a placement the player aimed, so this walks
   outward from their point in widening rings instead of re-rolling at random
   the way findFloorSpot does: the item ends up as close to the drop as the
   room allows, and never in a doorway or inside a cupboard. */
export function nearestFloorSpot(room, x, y, opts = {}) {
  const margin = opts.margin ?? 4;
  const cx = Math.max(margin, Math.min(100 - margin, x));
  const cy = Math.max(margin, Math.min(100 - margin, y));
  if (isClearFloor(room, cx, cy, opts)) return { x: cx, y: cy, clean: true };
  for (let r = 3; r <= 42; r += 3) {
    for (let a = 0; a < 12; a++) {
      /* Offset each ring so successive rings don't all probe the same spokes. */
      const th = (a / 12) * Math.PI * 2 + r * 0.4;
      const px = cx + Math.cos(th) * r, py = cy + Math.sin(th) * r;
      if (px < margin || px > 100 - margin || py < margin || py > 100 - margin) continue;
      if (isClearFloor(room, px, py, opts)) return { x: px, y: py, clean: true };
    }
  }
  const fall = findFloorSpot(room, { avoidCaches: true, ...opts });
  return fall.clean ? fall : { x: cx, y: cy, clean: false };
}

/* Move any floor item that has come to rest in a doorway out into the open.
   Runs over a whole run on generation and on load, so a save made before
   doorways were kept clear is repaired rather than left with unreachable
   items. Deliberately ONLY doorways: an item resting against a cupboard is
   still visible and still tappable, and shuffling those on load would move
   things the player put down on purpose. */
export function unstickFloorItems(rooms, items) {
  let moved = 0;
  for (const it of Object.values(items)) {
    if (it.loc?.kind !== "floor") continue;
    const room = rooms[it.loc.room];
    if (!room || !inDoorway(room, it.loc.x, it.loc.y)) continue;
    const s = nearestFloorSpot(room, it.loc.x, it.loc.y);
    it.loc.x = s.x; it.loc.y = s.y;
    moved++;
  }
  return moved;
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
