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

const FILES = ['names','rooms','themes','furniture','sizes','levels','upgrades','strings','audio','quests'];

export const DATA = {
  names:{}, rooms:{}, themes:{}, furniture:{}, sizes:{}, levels:{}, upgrades:{}, strings:{},
  audio:{}, quests:{},
};

/* Derived lookups, built once after load so hot paths don't re-scan arrays. */
export const LOOKUP = {
  names: {},          // emoji -> display name
  roomById: {},       // id -> room def
  containerOf: {},    // "roomId/contId" -> container def
  sizeById: {},
  levelByIdx: [],
  upgradeById: {},
  tokenById: {},
  tokenByEmoji: {},
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
  for (const u of DATA.upgrades.upgrades) LOOKUP.upgradeById[u.id] = u;
  for (const [id, t] of Object.entries(DATA.furniture.tokens || {})) {
    LOOKUP.tokenById[id] = { id, ...t };
    LOOKUP.tokenByEmoji[t.emoji] = { id, ...t };
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
export const costFor  = (u, lvl) => (lvl >= u.costs.length ? null : u.costs[lvl]);
export const maxLevel = u => u.costs.length;

export const nameOf   = emoji => LOOKUP.names[emoji] || emoji;
export const tokenFor = emoji => LOOKUP.tokenByEmoji[emoji] || null;
export const isToken  = emoji => !!LOOKUP.tokenByEmoji[emoji];

export const theme = id => DATA.themes.themes[id || DATA.themes.defaultTheme];
export const themeRooms = id => theme(id).rooms.map(rid => LOOKUP.roomById[rid]);

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
