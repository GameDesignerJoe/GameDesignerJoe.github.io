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
  BONUS_DOOR_CHANCE, JUNK_CONTAINER_CHANCE, JUNK_FILL, CACHE_STASH,
} from './config.js';
import { rnd, shuffle, clamp } from './util.js';
import { DATA, LOOKUP, theme, themeRooms, upgradeDefaults } from './data.js';
import { inShape, findFloorSpot, furthestFrom, spin, pad, inSlot } from './geometry.js';

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

  /* ---------- the rooms ---------- */
  const defs = shuffle([...pool]).slice(0, roomCount);
  const rooms = cells.map((c, i) => {
    const def = defs[i];
    const tf = def.sizeFactor || 1;
    const roll = () => scMin + Math.random() * (scMax - scMin);
    return {
      id: i, gx: c[0], gy: c[1],
      defId: def.id, name: def.name, floor: def.floor,
      sw: +clamp(roll() * tf, 0.35, 1).toFixed(3),
      sh: +clamp(roll() * tf, 0.35, 1).toFixed(3),
      shape: shapes[rnd(shapes.length)],
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

  function addContainer(r, def, types) {
    const AN = r.shape === "rect" ? anchors.rect : anchors.soft;
    const i = r.containers.length;
    const a = AN[i % AN.length];
    const k = DATA.furniture.kinds[def.kind] || {};
    r.containers.push({
      id: i, roomId: r.id, defId: def.id,
      name: def.name, short: def.short || def.name, kind: def.kind,
      lock: null,
      slot: { x: a.x, y: a.y, w: k.w ?? fsize.w, h: k.h ?? fsize.h },
      cells: Array.from({ length: types.length }, () => Array(rowLen).fill(null)),
    });
    for (const e of types) typeHome[e] = { room: r.id, cont: i };
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

  /* ---------- scatter the clutter ---------- */
  const items = {};
  let iid = 0;
  const drop = (room, extra, opts) => {
    const { x, y } = findFloorSpot(room, opts);
    items[iid] = { id: iid, judged: false, ...extra,
      loc: { kind: "floor", room: room.id, x, y, rot: spin() } };
    return items[iid++];
  };

  for (const e of Object.keys(typeHome)) {
    for (let k = 0; k < rowLen; k++) drop(rooms[rnd(rooms.length)], { type: e });
  }

  /* ---------- keys: exactly enough, never sealed behind their own lock ---------- */
  const openRooms = rooms.filter(r => !lockedSet.has(r.id));
  let totalKeys = locks.reduce((n, l) => n + l.need, 0);
  for (const r of rooms) for (const c of r.containers) {
    if (c.lock && c.lock.token === "key") totalKeys += c.lock.need;
  }
  for (let k = 0; k < totalKeys; k++) {
    drop(openRooms[k % openRooms.length],
      { type: keyToken.emoji, isKey: true, token: "key", judged: true },
      { margin: 6, span: 88 });
  }

  /* One named key per locked chest, as far from its own chest as the house
     allows — a lock whose key is in the same room isn't a hunt. */
  for (const c of contLocks) {
    const skel = LOOKUP.tokenById.skel;
    const home = rooms[c.roomId];
    const elsewhere = openRooms.filter(r => r.id !== home.id);
    const far = furthestFrom(rooms, home.id, elsewhere.length ? elsewhere : openRooms);
    drop(far[rnd(far.length)] || home,
      { type: skel.emoji, isKey: true, token: "skel", judged: true },
      { margin: 6, span: 88 });
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
        { margin: 6, span: 88 });
      /* Single-room fallback: at least keep it across the room from the box. */
      if (cr.id === room.id) {
        for (let t = 0; t < 60; t++) {
          if (Math.hypot(coin.loc.x - slot.x, coin.loc.y - slot.y) >= 40) break;
          const s = findFloorSpot(cr, { margin: 6, span: 88 });
          coin.loc.x = s.x; coin.loc.y = s.y;
        }
      }
    }
  }

  /* ---------- pre-filled junk ---------- */
  if (cfg.junk) {
    const floorItems = Object.values(items).filter(o => !o.token && o.loc.kind === "floor");
    for (const r of rooms) for (const c of r.containers) {
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

  /* ---------- the run ---------- */
  return {
    rooms, items, typeHome, locks, rowLen, theme: themeId,
    current: rooms[0].id,
    cam: "room", pan: { x: 0, y: 0 },
    inv: Array(INV_SIZE).fill(null), sel: null, openCont: null,
    stats: { tosses: 0, firstGood: 0, start: Date.now() },
    visited: new Set([rooms[0].id]),
    points: 0, starsEarned: 0,
    tips: (cfg.tips || []).map(t => ({ ...t })),
    tipsDone: new Set(), tipShown: new Set(),
    events: new Set(), tipCtx: {},
    awarded: new Set(), taught: new Set(),
    roomFxDone: new Set(), propsShown: new Set(),
    up: upgradeDefaults(),
    whirlReady: 0,
  };
}
