/* ============================================================
   DATA — load, validate, and freeze data/*.json, then expose derived
   lookups the rest of the game reads.

   DATA is a stable container that gets POPULATED, never replaced, so any
   module can `import { DATA }` at the top level. The one rule: never read a
   DATA.* field at module scope — only inside a function, after loadData().

   Imports: config, validate.
============================================================ */
import { DATA_VERSION } from './config.js';
import { anchorPrefix, expectedItems, themeTypeCap, clamp } from './util.js';
import { validateData, showBootError, DataError } from './validate.js';

const FILES = ['names','rooms','themes','furniture','sizes','levels','upgrades','strings','audio','quests','clients'];

export const DATA = {
  names:{}, rooms:{}, themes:{}, furniture:{}, sizes:{}, levels:{}, upgrades:{}, strings:{},
  audio:{}, quests:{}, clients:{},
};

/* Derived lookups, built once after load so hot paths don't re-scan arrays. */
export const LOOKUP = {
  names: {},          // emoji -> display name
  roomById: {},       // id -> room def
  containerOf: {},    // "roomId/contId" -> container def
  bandById: {},      // free-play size band id -> band def
  freeJobs: [],      // every free-play house, in board order
  freeJobById: {},   // "fp:mom:roomy:3" -> the same object
  levelByIdx: [],
  levelIdxById: {},   // "3-1" -> 4
  upgradeById: {},
  tokenById: {},
  tokenByEmoji: {},
  clientById: {},
  arcs: [],           // job board order: clients by their first stage
  jobByIdx: [],       // level index -> the job at that level
};

export async function loadData() {
  const parts = await Promise.all(FILES.map(async name => {
    const url = `data/${name}.json?v=${DATA_VERSION}`;
    let res;
    try { res = await fetch(url); }
    catch (e) {
      throw new DataError(
        `${url} could not be fetched (${e.message}).\n` +
        `    Are you opening this over file://? ES modules and fetch both need a\n` +
        `    web server: run  python -m http.server 8000  and open\n` +
        `    http://localhost:8000/tidy-adventures/`);
    }
    if (!res.ok) throw new DataError(`data/${name}.json — HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    try { return [name, JSON.parse(text)]; }
    catch (e) {
      throw new DataError(
        `data/${name}.json is not valid JSON.\n    ${e.message}\n` +
        `    Common causes: a trailing comma, a missing quote, or a smart quote\n` +
        `    (" ") pasted from a document instead of a straight one (").`);
    }
  }));

  for (const [name, json] of parts) DATA[name] = json;

  const { errors, warnings } = validateData(DATA);
  for (const w of warnings) console.warn('[Tidy Adventures]', w);
  if (errors.length) {
    for (const e of errors) console.error('[Tidy Adventures]', e);
    showBootError(errors);
    throw new DataError('data validation failed');
  }

  buildLookups();
  deepFreeze(DATA);
  return DATA;
}

function buildLookups() {
  LOOKUP.names = DATA.names.names || {};

  for (const room of DATA.rooms.rooms) {
    LOOKUP.roomById[room.id] = room;
    for (const c of room.containers) LOOKUP.containerOf[`${room.id}/${c.id}`] = c;
  }
  for (const b of DATA.sizes.bands || []) LOOKUP.bandById[b.id] = b;
  LOOKUP.levelByIdx = DATA.levels.levels;
  DATA.levels.levels.forEach((lv, i) => { LOOKUP.levelIdxById[lv.id] = i; });
  for (const u of DATA.upgrades.upgrades) LOOKUP.upgradeById[u.id] = u;
  for (const [id, t] of Object.entries(DATA.furniture.tokens || {})) {
    LOOKUP.tokenById[id] = { id, ...t };
    LOOKUP.tokenByEmoji[t.emoji] = { id, ...t };
  }

  /* ---------- who hired you ----------
     A level is exactly one client's job, so the claim table is built once here
     and a RUN NEVER HAS TO REMEMBER a client: the level index it already saves
     is enough to look the whole job back up. That is what keeps this feature
     out of the save format entirely. */
  for (const c of DATA.clients.clients || []) LOOKUP.clientById[c.id] = c;

  LOOKUP.arcs = (DATA.clients.clients || []).map(client => ({
    client,
    /* A client with no stages yet is a silhouette on the board — see `soon`
       in data/clients.json. It sorts last, after everyone with real work. */
    soon: !client.stages?.length,
    stages: (client.stages || []).map((stage, n) => {
      const levelIdx = LOOKUP.levelIdxById[stage.level];
      return { stage, stageNo: n + 1, levelIdx, level: DATA.levels.levels[levelIdx] };
    }),
  })).sort((a, b) =>
    (a.soon ? 1e6 : a.stages[0].levelIdx) - (b.soon ? 1e6 : b.stages[0].levelIdx));

  for (const arc of LOOKUP.arcs) {
    for (const s of arc.stages) {
      LOOKUP.jobByIdx[s.levelIdx] = {
        ...s,
        client: arc.client,
        stageCount: arc.stages.length,
        last: s.stageNo === arc.stages.length,
      };
    }
  }

  buildFreeBoard();
}

/* ============================================================
   FREE PLAY — the board of houses

   SIZE BAND x CHARACTER x housesPerBand, built once here rather than authored,
   which is the only reason two hundred and thirty-odd houses is a sane amount
   of content: the whole board is nine numbers in sizes.json and five place
   names per person in clients.json.

   Every house is a JOB with a stable id, exactly like a campaign level: `fp`,
   the character, the band, the house number. Ids rather than indices for the
   same reason DONE_KEY holds level ids — inserting a band, a character or a
   sixth house must not re-point what a player has already finished.

   A RUN NEVER REMEMBERS THE HOUSE ITSELF, only this id, and freeJobAt() looks
   the rest back up. Same trick as jobAt(levelIdx) in the campaign, and it is
   what keeps the save format to one extra string.
============================================================ */
function buildFreeBoard() {
  const S = DATA.sizes || {};
  const bands = S.bands || [];
  const per = S.housesPerBand || 5;
  const reach = S.reach ?? 0.85;
  const fill = S.typeFill ?? 1;
  const rowMin = S.rowLen?.min ?? 4, rowMax = S.rowLen?.max ?? 8;
  const V = S.variation || {};
  const themes = DATA.themes?.themes || {};
  const anchors = DATA.furniture?.anchors, dflt = DATA.furniture?.defaultSize;

  /* One capacity lookup per (world, roomCount) pair, because themeTypeCap()
     sorts the whole room pool and the board would otherwise call it ~1,200
     times on boot for eleven distinct answers. */
  const capCache = new Map();
  const capOf = (worldId, rooms) => {
    const k = worldId + "/" + rooms;
    if (!capCache.has(k)) {
      capCache.set(k, themeTypeCap(themes[worldId], DATA.rooms.rooms, anchors, dflt, rooms));
    }
    return capCache.get(k);
  };

  /* items -> the closest (targetTypes, rowLen) this world can actually build.
     Prefers MORE TYPES over more of each: variety is what makes two runs of
     one world different, and rowLen only has to carry the rest. */
  const fit = (worldId, bandRooms, items) => {
    const rooms = Math.min(bandRooms, (themes[worldId]?.rooms || []).length);
    /* `usable`, not `cap`: a run may not spend a world's whole pool. See
       typeFill in sizes.json — it is the difference between five houses in one
       world and one house five times, and it is also the headroom generate()
       needs to actually hit the number the tile prints. */
    const cap = capOf(worldId, rooms);
    const usable = Math.floor(cap * fill);
    if (!usable) return null;
    const first = clamp(Math.round(items / usable), rowMin, rowMax);
    const targetTypes = clamp(Math.round(items / first), 1, usable);
    /* SECOND PASS, and it is what makes the five houses differ in a SMALL
       world. `first` was derived for a type count the world may not be able to
       supply; once targetTypes clamps to `usable`, the item drift that was
       supposed to separate house 1 from house 5 has nowhere to go and every
       house comes out at the ceiling — three of Zorb's five Small houses
       printed the same count. Re-deriving rowLen from the types we can
       actually have puts the drift on rowLen instead. A no-op when nothing
       clamped, which is every house in the house world. */
    const rowLen = clamp(Math.round(items / targetTypes), rowMin, rowMax);
    return { rooms, cap, usable, rowLen, targetTypes, items: targetTypes * rowLen };
  };

  LOOKUP.freeJobs = [];
  LOOKUP.freeJobById = {};

  for (const band of bands) {
    for (const arc of LOOKUP.arcs) {
      const client = arc.client;
      if (!client.world || !themes[client.world]) continue;
      /* Offered at all? Measured at the band's NOMINAL size, so whether a
         character appears under a band cannot depend on which of their five
         houses you happen to look at. */
      const nominal = fit(client.world, band.rooms, band.items);
      if (!nominal || nominal.items < band.items * reach) continue;

      for (let n = 1; n <= per; n++) {
        /* House 3 IS the band; 1 and 2 are its small end, 4 and 5 its big end. */
        const drift = 1 + (V.step ?? 0) * (n - Math.ceil(per / 2));
        const f = fit(client.world, band.rooms, Math.round(band.items * drift));
        const at = i => Array.isArray(i) ? i[Math.min(n - 1, i.length - 1)] : i;
        const place = (client.places || [])[n - 1] || `House ${n}`;
        const job = {
          id: `fp:${client.id}:${band.id}:${n}`,
          client, band, n, place,
          /* The config generate() will be handed. `theme` comes from the
             person and nothing else in it mentions a world. */
          cfg: {
            label: place,
            theme: client.world,
            rooms: f.rooms,
            targetTypes: f.targetTypes,
            rowLen: f.rowLen,
            doorLocks: at(V.doorLocks) || 0,
            doorKeys:  at(V.doorKeys)  || 0,
            contLocks: at(V.contLocks) || 0,
            contKeys:  at(V.contKeys)  || 0,
            caches:    at(V.caches)    || 0,
            junk:      !!at(V.junk),
            scale:     band.scale || S.scale || [0.7, 0.95],
          },
        };
        LOOKUP.freeJobs.push(job);
        LOOKUP.freeJobById[job.id] = job;
      }
    }
  }
}

function deepFreeze(o) {
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(o);
}

/* ============================================================
   Resolvers — the declarative-data equivalents of what used to be
   inline functions in the config literals.
============================================================ */

/* costs[] is indexed by current level; past the end means maxed. */
/* How many times a talent can be taken. This used to be `u.costs.length` — the
   length of a price list whose prices nothing ever read, because ⭐ is score and
   is never spent. `levels` says the one thing that was actually true. */
export const maxLevel = u => u.levels || 1;

export const nameOf   = emoji => LOOKUP.names[emoji] || emoji;
export const tokenFor = emoji => LOOKUP.tokenByEmoji[emoji] || null;
export const isToken  = emoji => !!LOOKUP.tokenByEmoji[emoji];

export const theme = id => DATA.themes.themes[id || DATA.themes.defaultTheme];
export const themeRooms = id => theme(id).rooms.map(rid => LOOKUP.roomById[rid]);

/* The job at this level index: who hired you, which stage of their arc this
   is, and the level itself. Null in free play, or if a save points at a level
   that no longer exists.
   -> { stage, stageNo, stageCount, last, levelIdx, level, client } */
export const jobAt = idx => LOOKUP.jobByIdx[idx] || null;
export const levelIdxOf = id => LOOKUP.levelIdxById[id] ?? -1;

/* The free-play house with this id: who is asking, how big, which of their
   five, and the config to generate. Null for an id that no longer exists,
   which is what a save written before a band was renamed looks like.
   -> { id, client, band, n, place, cfg } */
export const freeJobAt = id => LOOKUP.freeJobById[id] || null;

/* Every house, in board order (band, then character, then 1..housesPerBand).
   The board renders straight off this and does no arithmetic of its own. */
export const freeJobs = () => LOOKUP.freeJobs;

/* The bands that actually have houses in them, in authored order. A band whose
   every world fell below `reach` would otherwise render as an empty heading. */
export const freeBands = () => (DATA.sizes.bands || [])
  .filter(b => LOOKUP.freeJobs.some(j => j.band.id === b.id));

/* The characters offering houses in this band, in story order. */
export const freeClientsIn = bandId => LOOKUP.arcs
  .map(a => a.client)
  .filter(c => LOOKUP.freeJobs.some(j => j.band.id === bandId && j.client.id === c.id));

/* The item count a config actually produces. The old SIZES[].items field and
   the hardcoded "~50 items" menu labels were both copies of this that drifted. */
export const itemCount = cfg => (cfg.targetTypes || 0) * (cfg.rowLen || 0);

/* ---------- how many containers a room of this shape can show ----------
   Measured from the anchor data rather than hardcoded, so widening the soft
   anchor list in furniture.json raises the ceiling everywhere at once. Rooms
   are rect unless they pin a shape or the theme deals them one. */
export const contCap = shape =>
  anchorPrefix(DATA.furniture.anchors[shape === "rect" ? "rect" : "soft"] || [],
               DATA.furniture.defaultSize.w, DATA.furniture.defaultSize.h);

/* ---------- HOW BIG IS THIS JOB ----------
   DERIVED, never authored. A "size" field on a level would be right until the
   first time somebody changed `rooms` and then it would be a label that lies.

   Free play states its own total outright (targetTypes x rowLen, which the
   menu already prints); a campaign level states per-room caps, so what it
   delivers depends on the rooms it draws and expectedItems() averages that
   over the theme's pool. */
export const jobSize = cfg => cfg.targetTypes
  ? itemCount(cfg)
  : expectedItems(cfg, themeRooms(cfg.theme));

/* Smallish, medium, big — the bands and their words live in strings.json so
   they can be renamed without touching this. */
export const sizeBand = cfg => {
  const bands = DATA.strings.jobSize?.bands || [];
  const n = jobSize(cfg);
  return bands.find(b => b.upTo == null || n <= b.upTo) || null;
};

export const upgradeDefaults = () =>
  Object.fromEntries(DATA.upgrades.upgrades.map(u => [u.id, 0]));

/* Read a param off an upgrade without every caller knowing its id. */
export function upgradeParam(id, key, fallback) {
  const u = LOOKUP.upgradeById[id];
  const v = u?.params?.[key];
  return v === undefined ? fallback : v;
}
