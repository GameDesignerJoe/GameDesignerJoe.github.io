/* ============================================================
   DATA — load, validate, and freeze data/*.json, then expose derived
   lookups the rest of the game reads.

   DATA is a stable container that gets POPULATED, never replaced, so any
   module can `import { DATA }` at the top level. The one rule: never read a
   DATA.* field at module scope — only inside a function, after loadData().

   Imports: config, validate.
============================================================ */
import { DATA_VERSION } from './config.js';
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
  sizeById: {},
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
  for (const s of DATA.sizes.sizes) LOOKUP.sizeById[s.id] = s;
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

/* The item count a config actually produces. The old SIZES[].items field and
   the hardcoded "~50 items" menu labels were both copies of this that drifted. */
export const itemCount = cfg => (cfg.targetTypes || 0) * (cfg.rowLen || 0);

export const upgradeDefaults = () =>
  Object.fromEntries(DATA.upgrades.upgrades.map(u => [u.id, 0]));

/* Read a param off an upgrade without every caller knowing its id. */
export function upgradeParam(id, key, fallback) {
  const u = LOOKUP.upgradeById[id];
  const v = u?.params?.[key];
  return v === undefined ? fallback : v;
}
