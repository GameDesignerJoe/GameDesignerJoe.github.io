/* ============================================================
   GENERATE — build a house from a config.

   Pure: takes a cfg (a levels.json or sizes.json entry) and RETURNS a run
   object. It does not touch G. Callers do `setRun(generate(cfg), meta)`.

   Rooms produced here are self-contained: they carry their own `floor` and
   each container carries its own `kind`/`name`/`short`, copied from the data
   registry. Nothing downstream needs to look a room def back up, so renaming
   a room in rooms.json can't corrupt a save.

   Imports: config, util, data, geometry.
============================================================ */
import {
  GRID, MAX_ROOMS, DIRS, OPP, INV_SIZE, ZOOM_START,
  BONUS_DOOR_CHANCE, JUNK_CONTAINER_CHANCE, JUNK_FILL, CACHE_STASH, ITEM_SPAN,
} from './config.js';
import { rnd, shuffle, clamp } from './util.js';
import { DATA, LOOKUP, theme, themeRooms, upgradeDefaults } from './data.js';
import {
  inShape, findFloorSpot, nearestFloorSpot, furthestFrom, spin, pad, inSlot,
  unstickFloorItems,
} from './geometry.js';

export function generate(cfg) {
  const themeId = cfg.theme || DATA.themes.defaultTheme;
  const pool    = themeRooms(themeId);
  /* v3 hard-clamped this to 5, so Large/XL/Mega all silently produced the
     same 5-room house despite asking for 6/8/9. The grid holds GRID^2. */
  const nRooms  = clamp(cfg.rooms || 5, 1, Math.min(MAX_ROOMS, pool.length));
  const rowLen  = cfg.rowLen || 5;
  const scMin   = cfg.scale?.[0] ?? 0.9;
  const scMax   = cfg.scale?.[1] ?? 1;
  const shapes  = cfg.shapes?.length ? cfg.shapes : theme(themeId).shapes;

  /* ---------- grow connected cells on the grid ---------- */
  const cells = [[1, 1]];
  const treeEdges = [];
  let guard = 0;
  while (cells.length < nRooms && guard++ < 4000) {
    const bi = rnd(cells.length), base = cells[bi];
    const d = Object.values(DIRS)[rnd(4)];
    const nx = base[0] + d[0], ny = base[1] + d[1];
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
    if (cells.some(c => c[0] === nx && c[1] === ny)) continue;
    cells.push([nx, ny]);
    treeEdges.push([bi, cells.length - 1]);
  }
  const roomCount = cells.length;

  /* ---------- door locks seal leaf rooms (never the start room) ---------- */
  const lockedSet = new Set();
  const locks = [];
  const keyToken = LOOKUP.tokenById.key;
  const nDoorLocks = cfg.doorLocks != null ? cfg.doorLocks : (cfg.doorKeys > 0 ? 1 : 0);
  if (nDoorLocks > 0 && cfg.doorKeys > 0 && roomCount >= 2) {
    const deg = Array(roomCount).fill(0);
    for (const [a, b] of treeEdges) { deg[a]++; deg[b]++; }
    const leaves = shuffle([...Array(roomCount).keys()].filter(i => i > 0 && deg[i] === 1));
    for (const leaf of leaves.slice(0, nDoorLocks)) {
      const parent = treeEdges.find(e => e[1] === leaf)[0];
      locks.push({ a: parent, b: leaf, need: cfg.doorKeys, have: 0, open: false, token: "key", keyType: keyToken.emoji });
      lockedSet.add(leaf);
    }
  }

  /* ---------- the rooms ----------
     When a config sets a type quota, the room draw has to be able to MEET it.
     Drawing purely at random meant an unlucky hand (XL taking 8 of 9 rooms
     and skipping the Kitchen's 46 types) left the run quietly short with no
     symptom.

     The first fix took the biggest rooms FIRST, which solved the quota and
     created a worse problem: the Kitchen alone covers Medium's whole target,
     so it was in literally every free-play house, every time, and the houses
     all felt like the same house. That's the "I'm tired of the same rooms"
     complaint, and it was arithmetic, not bad luck.

     Deal a random hand, then trade up only as far as the quota actually
     requires: swap the smallest room in hand for the biggest one still on the
     shelf until the types are coverable. Loose targets (Tiny through Large)
     never trade at all and stay fully random; Mega, which asks for nearly
     every type in the game, trades until it has what it needs. */
  const typeCount = d => d.containers.reduce((n, c) => n + c.types.length, 0);
  let defs = shuffle([...pool]).slice(0, roomCount);
  if (cfg.targetTypes) {
    const shelf = pool.filter(d => !defs.includes(d)).sort((a, b) => typeCount(b) - typeCount(a));
    let covered = defs.reduce((n, d) => n + typeCount(d), 0);
    while (covered < cfg.targetTypes && shelf.length) {
      defs.sort((a, b) => typeCount(a) - typeCount(b));
      const out = defs[0], into = shelf[0];
      if (typeCount(into) <= typeCount(out)) break;   // nothing left to gain
      defs[0] = into; shelf.shift();
      covered += typeCount(into) - typeCount(out);
    }
    defs = shuffle(defs);
  }
  const rooms = cells.map((c, i) => {
    const def = defs[i];
    const tf = def.sizeFactor || 1;
    const roll = () => scMin + Math.random() * (scMax - scMin);
    return {
      id: i, gx: c[0], gy: c[1],
      defId: def.id, name: def.name, floor: def.floor,
      sw: +clamp(roll() * tf, 0.35, 1).toFixed(3),
      sh: +clamp(roll() * tf, 0.35, 1).toFixed(3),
      /* A room def can pin its own silhouette — the Observatory is always
         round, the Cellar always hex — so walking into one is visibly a
         different place, not the same box with different labels. Rooms that
         don't care take the theme's list. */
      shape: def.shape || shapes[rnd(shapes.length)],
      doors: { N: null, S: null, E: null, W: null },
      containers: [], caches: [],
    };
  });

  const connect = (i, j) => {
    const a = rooms[i], b = rooms[j];
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      if (a.gx + dx === b.gx && a.gy + dy === b.gy) { a.doors[dir] = j; b.doors[OPP[dir]] = i; }
    }
  };
  for (const [a, b] of treeEdges) connect(a, b);
  for (let i = 0; i < roomCount; i++) for (let j = i + 1; j < roomCount; j++) {
    if (lockedSet.has(i) || lockedSet.has(j)) continue;
    const a = rooms[i], b = rooms[j];
    if (Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) !== 1) continue;
    if (Object.values(a.doors).includes(j)) continue;
    if (Math.random() < BONUS_DOOR_CHANCE) connect(i, j);
  }

  /* ---------- containers ---------- */
  const typeHome = {};                       // emoji -> {room, cont}
  const anchors = DATA.furniture.anchors;
  const fsize = DATA.furniture.defaultSize;

  /* Which types each container actually took, so the top-up pass below can
     tell a partially-filled container from a full one. */
  const taken = new Map();   // container object -> Set of emoji

  function addContainer(r, def, types) {
    const AN = r.shape === "rect" ? anchors.rect : anchors.soft;
    const i = r.containers.length;
    const a = AN[i % AN.length];
    const k = DATA.furniture.kinds[def.kind] || {};
    const c = {
      id: i, roomId: r.id, defId: def.id,
      name: def.name, short: def.short || def.name, kind: def.kind,
      lock: null,
      slot: { x: a.x, y: a.y, w: k.w ?? fsize.w, h: k.h ?? fsize.h },
      cells: Array.from({ length: types.length }, () => Array(rowLen).fill(null)),
    };
    r.containers.push(c);
    taken.set(c, new Set(types));
    for (const e of types) typeHome[e] = { room: r.id, cont: i };
    return c;
  }

  /* Give an existing container more of its own types — one extra row each. */
  function growContainer(r, c, types) {
    for (const e of types) {
      c.cells.push(Array(rowLen).fill(null));
      typeHome[e] = { room: r.id, cont: c.id };
      taken.get(c).add(e);
    }
  }

  const defOf = r => LOOKUP.roomById[r.defId].containers;

  if (cfg.targetTypes) {
    /* free play: fill toward a whole-run type quota */
    let remaining = cfg.targetTypes;
    rooms.forEach((r, idx) => {
      const cdefs = shuffle([...defOf(r)]);
      let quota = Math.max(1, Math.round(remaining / (rooms.length - idx)));
      for (const def of cdefs) {
        if (quota <= 0) break;
        const take = Math.min(def.types.length, quota);
        addContainer(r, def, shuffle([...def.types]).slice(0, take));
        quota -= take; remaining -= take;
      }
    });

    /* Soak leftovers into containers this room hasn't used yet. */
    if (remaining > 0) {
      for (const r of rooms) {
        if (remaining <= 0) break;
        const used = new Set(r.containers.map(c => c.defId));
        for (const def of defOf(r)) {
          if (remaining <= 0) break;
          if (used.has(def.id)) continue;
          const take = Math.min(def.types.length, remaining);
          addContainer(r, def, shuffle([...def.types]).slice(0, take));
          remaining -= take;
        }
      }
    }

    /* Top up containers that took only a SLICE of their types. Without this
       the quota silently under-delivers: `take` can be less than the def's
       full type list, and the soak pass above skips any container already
       used, so those leftover types were unreachable. Mega asked for 194
       types and got 192; XL asked for 160 and got 156. */
    if (remaining > 0) {
      for (const r of rooms) {
        if (remaining <= 0) break;
        for (const c of r.containers) {
          if (remaining <= 0) break;
          const def = defOf(r).find(d => d.id === c.defId);
          if (!def) continue;
          const have = taken.get(c);
          const spare = def.types.filter(e => !have.has(e));
          if (!spare.length) continue;
          const add = spare.slice(0, remaining);
          growContainer(r, c, add);
          remaining -= add.length;
        }
      }
    }
  } else {
    /* campaign: per-room caps */
    for (const r of rooms) {
      const cdefs = shuffle([...defOf(r)]).slice(0, Math.max(1, cfg.cont || 99));
      for (const def of cdefs) {
        addContainer(r, def, shuffle([...def.types]).slice(0, Math.max(1, cfg.types || 99)));
      }
    }
  }

  /* ---------- locked containers ----------
     Doors and containers now gate differently, so the two flavours aren't
     reskins of each other:
       a door  costs a COLLECTION — N interchangeable 🔑
       a chest costs a HUNT       — one specific 🗝️, spawned far away
     Feeding a chest three identical keys was a chore; hunting one named key
     across the house is a small errand with a destination. */
  const contLocks = [];
  if (cfg.contLocks > 0) {
    const skel = LOOKUP.tokenById.skel;
    const all = shuffle(rooms.flatMap(r => r.containers));
    for (let i = 0; i < Math.min(cfg.contLocks, all.length); i++) {
      if (skel) {
        all[i].lock = { need: 1, have: 0, open: false, token: "skel", keyType: skel.emoji };
        contLocks.push(all[i]);
      } else {
        all[i].lock = { need: cfg.contKeys || 3, have: 0, open: false, token: "key", keyType: keyToken.emoji };
      }
    }
  }

  /* ---------- the quest container ----------
     In some rooms, one small container starts sealed and holds nothing.
     Finishing any OTHER container in that room drops a note and unlocks it;
     the note asks you to fill it.

     Sealing it is what makes the loop work. A locked container can't be
     tossed into and is skipped by auto-filing and junk pre-fill, so its
     items are guaranteed to still be on the floor when the note arrives.
     The first version generated a note from a container's types without
     checking, so it could ask for things already filed and you'd have to
     take them out and put them back. Now that can't happen by construction.

     The smallest container in the room gets the job — the microwave next to
     the fridge, rather than a second fridge.

     NOT EVERY ROOM. Sealing one in every room made "locked" the resting state
     of the house rather than an event: you walked in already knowing one piece
     of furniture would refuse you, in every room, forever. It's a share of the
     rooms now — `roomShare` in quests.json, or a per-config `quests` number —
     so walking into a room with a sealed cupboard is a thing that sometimes
     happens. Rooms with no seal still get a note; quests.js falls back to
     asking about an open container. */
  if (cfg.quests !== false) {
    const share = typeof cfg.quests === "number" ? cfg.quests : (DATA.quests.roomShare ?? 0.6);
    const eligible = rooms.filter(r => r.containers.filter(c => !c.lock).length >= 2);
    /* Fewest existing locks first, so the rooms that get a seal are the ones
       that aren't already gated by a key — the dial-back spreads the locks
       out instead of stacking two onto one room. shuffle() first keeps the
       choice random within each tier; sort is stable. */
    const ordered = shuffle([...eligible])
      .sort((a, b) => a.containers.filter(c => c.lock).length - b.containers.filter(c => c.lock).length);
    const want = share <= 1 ? Math.round(eligible.length * share) : Math.round(share);
    /* At least one, so a house always has somewhere for the authored note to
       land — but only if the designer asked for seals at all. */
    const n = share > 0 ? Math.min(ordered.length, Math.max(1, want)) : 0;
    for (const r of ordered.slice(0, n)) {
      const free = r.containers.filter(c => !c.lock);
      const target = free.reduce((a, b) => (b.cells.length < a.cells.length ? b : a));
      target.lock = { need: 0, have: 0, open: false, quest: true };
      r.questCont = target.id;
    }
  }

  /* ---------- scatter the clutter ---------- */
  const items = {};
  let iid = 0;
  const drop = (room, extra, opts = {}) => {
    const { x, y } = opts.spot || findFloorSpot(room, opts);
    items[iid] = { id: iid, judged: false, ...extra,
      loc: { kind: "floor", room: room.id, x, y, rot: spin() } };
    return items[iid++];
  };

  /* Scatter by FLOOR AREA, not one uniform roll per item. Rooms vary by more
     than 4x in area (the Observatory is half the Kitchen on each axis, so a
     quarter of the floor), and a uniform roll gave them all the same share:
     the small rooms came out buried under an unreadable heap while the big
     ones looked swept. */
  const areaOf = r => (r.sw || 1) * (r.sh || 1);
  const totalArea = rooms.reduce((n, r) => n + areaOf(r), 0);
  const roomByArea = () => {
    let t = Math.random() * totalArea;
    for (const r of rooms) { t -= areaOf(r); if (t <= 0) return r; }
    return rooms[rooms.length - 1];
  };

  for (const e of Object.keys(typeHome)) {
    for (let k = 0; k < rowLen; k++) drop(roomByArea(), { type: e });
  }

  /* ---------- burying a token ----------
     Keys used to be scattered like everything else and then painted on top of
     everything else (they're dropped last, and items share a z-index), so the
     hunt was over the moment you walked in: the 🔑 was the one thing on the
     floor guaranteed not to be covered. A key is dropped INTO the mess now —
     it lands on top of something already lying there, and buildRoomEl draws
     tokens first so the clutter covers it. Finding one means clearing a pile.

     If a room has nothing on its floor to hide under, it falls back to an
     ordinary open-floor spot rather than refusing to place the key. */
  const bury = (room) => {
    const cover = Object.values(items).filter(o =>
      o.loc.kind === "floor" && o.loc.room === room.id && !o.token);
    if (!cover.length) return findFloorSpot(room, { margin: 6, span: 88 });
    const under = cover[rnd(cover.length)];
    /* UNDER something, not beside it. The key lands within a couple of percent
       of a real item's middle, and buildRoomEl draws tokens first, so the
       clutter covers it and finding it means clearing the pile. That IS the
       hunt, and it can never make a level unwinnable: the things hiding the
       key are things you have to pick up and file anyway, so a tidy room is
       an exposed key by definition.

       (Briefly this offset the key onto a ring instead, far enough that a
       corner always showed. It solved a problem nobody had — the keys were
       always findable — and cost the hunt, which was the point of burying
       them. Reverted deliberately.) */
    const span = ITEM_SPAN / Math.max(0.35, Math.min(1, ((room.sw || 1) + (room.sh || 1)) / 2));
    /* The one thing worth keeping clear of is ANOTHER token: a key under a key
       reads as one key, and hiding a key under the thing you are hunting for
       is a joke at the player's expense rather than a hunt. */
    const tokens = Object.values(items).filter(o =>
      o.loc.kind === "floor" && o.loc.room === room.id && o.token);
    const clearOfTokens = (x, y) =>
      !tokens.some(o => Math.hypot(o.loc.x - x, o.loc.y - y) < span * 0.8);
    const jitter = () => Math.random() * 4 - 2;
    let fallback = null;
    for (let t = 0; t < 30; t++) {
      const under = cover[rnd(cover.length)];
      const s = nearestFloorSpot(room, under.loc.x + jitter(), under.loc.y + jitter(), { margin: 5 });
      fallback = fallback || s;
      if (clearOfTokens(s.x, s.y)) return s;
    }
    return fallback;
  };

  /* ---------- keys: exactly enough, never sealed behind their own lock ---------- */
  const openRooms = rooms.filter(r => !lockedSet.has(r.id));
  let totalKeys = locks.reduce((n, l) => n + l.need, 0);
  for (const r of rooms) for (const c of r.containers) {
    if (c.lock && c.lock.token === "key") totalKeys += c.lock.need;
  }
  for (let k = 0; k < totalKeys; k++) {
    const room = openRooms[k % openRooms.length];
    drop(room, { type: keyToken.emoji, isKey: true, token: "key", judged: true },
      { spot: bury(room) });
  }

  /* One named key per locked chest, as far from its own chest as the house
     allows — a lock whose key is in the same room isn't a hunt. */
  for (const c of contLocks) {
    const skel = LOOKUP.tokenById.skel;
    const home = rooms[c.roomId];
    const elsewhere = openRooms.filter(r => r.id !== home.id);
    const far = furthestFrom(rooms, home.id, elsewhere.length ? elsewhere : openRooms);
    const room = far[rnd(far.length)] || home;
    drop(room, { type: skel.emoji, isKey: true, token: "skel", judged: true },
      { spot: bury(room) });
  }

  /* ---------- coin-slot caches ---------- */
  const nCaches = cfg.caches || 0;
  const coinToken = LOOKUP.tokenById.coin;
  if (nCaches > 0 && coinToken) {
    const cachePad = pad("cache");
    for (let ci = 0; ci < nCaches; ci++) {
      const room = rooms[rnd(rooms.length)];
      const spot = findFloorSpot(room, { padName: "cache", margin: 8, span: 76, avoidCaches: true, tries: 80 });
      if (!spot.clean) continue;

      const pool2 = Object.values(items).filter(o => !o.token && o.loc.kind === "floor");
      const nHeld = Math.min(pool2.length, CACHE_STASH[0] + rnd(CACHE_STASH[1] - CACHE_STASH[0] + 1));
      const stash = [];
      for (let k = 0; k < nHeld; k++) {
        const p = pool2.splice(rnd(pool2.length), 1)[0];
        if (!p) break;
        p.loc = { kind: "cache" };
        stash.push(p.id);
      }
      if (!stash.length) continue;

      const slot = { x: spot.x, y: spot.y, ...DATA.furniture.cacheSlot };
      room.caches.push({ id: room.caches.length, slot, items: stash, opened: false, token: "coin" });

      /* The coin goes as far from its own box as the house allows. In v3 the
         cache room and the coin room were rolled independently with no
         exclusion, so the pair landed in the same room constantly and the
         "hunt" was over before it started. */
      const elsewhere = openRooms.filter(r => r.id !== room.id);
      const cr = elsewhere.length
        ? furthestFrom(rooms, room.id, elsewhere)[rnd(furthestFrom(rooms, room.id, elsewhere).length)]
        : room;
      let coin = drop(cr, { type: coinToken.emoji, isCoin: true, token: "coin", judged: true },
        { spot: bury(cr) });
      /* Single-room fallback: at least keep it across the room from the box. */
      if (cr.id === room.id) {
        for (let t = 0; t < 60; t++) {
          if (Math.hypot(coin.loc.x - slot.x, coin.loc.y - slot.y) >= 40) break;
          const s = bury(cr);
          coin.loc.x = s.x; coin.loc.y = s.y;
        }
      }
    }
  }

  /* ---------- pre-filled junk ---------- */
  if (cfg.junk) {
    const floorItems = Object.values(items).filter(o => !o.token && o.loc.kind === "floor");
    for (const r of rooms) for (const c of r.containers) {
      /* Never pre-fill a locked container. It was doing so for key-locked
         chests too — you'd crack a sealed chest open and find someone had
         already put junk in it — and it broke the quest seal's guarantee
         that its contents are still loose when the note arrives. */
      if (c.lock && !c.lock.open) continue;
      if (Math.random() >= JUNK_CONTAINER_CHANCE) continue;
      const cap = c.cells.length * rowLen;
      const [lo, hi] = JUNK_FILL;
      let n = Math.max(1, Math.round(cap * (lo + Math.random() * (hi - lo))));
      while (n-- > 0) {
        let pick = null;
        for (let t = 0; t < 30; t++) {
          const cand = floorItems[rnd(floorItems.length)];
          if (!cand || cand.loc.kind !== "floor") continue;
          const h = typeHome[cand.type];
          if (h.room === r.id && h.cont === c.id) continue;   // its real home
          pick = cand; break;
        }
        if (!pick) break;
        let placed = false;
        for (let row = 0; row < c.cells.length && !placed; row++)
          for (let col = 0; col < c.cells[row].length && !placed; col++)
            if (c.cells[row][col] === null) {
              c.cells[row][col] = pick.id;
              pick.loc = { kind: "cell", room: r.id, cont: c.id, row, col };
              pick.judged = true;
              placed = true;
            }
        if (!placed) break;
      }
    }
  }

  /* Nothing may come to rest in a doorway: a door paints over items and eats
     their taps, so a key that lands there is invisible and unpickable. The
     scatter already avoids them; this catches the fallback placements that
     findFloorSpot returns when it runs out of tries. */
  unstickFloorItems(rooms, items);

  /* ---------- the run ---------- */
  return {
    rooms, items, typeHome, locks, rowLen, theme: themeId,
    current: rooms[0].id,
    cam: { z: ZOOM_START, x: 0, y: 0 },
    inv: Array(INV_SIZE).fill(null), sel: null, openCont: null,
    stats: { tosses: 0, firstGood: 0, start: Date.now() },
    visited: new Set([rooms[0].id]),
    points: 0, starsEarned: 0,
    tips: (cfg.tips || []).map(t => ({ ...t })),
    tipsDone: new Set(), tipShown: new Set(),
    events: new Set(), tipCtx: {},
    awarded: new Set(), taught: new Set(),
    roomFxDone: new Set(),
    up: upgradeDefaults(),
    whirlReady: 0,
  };
}
