// Save data. One versioned JSON blob in localStorage. Add a field: give it a
// default in DEFAULTS. Change a field's shape: bump VERSION and add a step to
// migrate() so existing players keep their farms.

const KEY = 'catchTheWolf.save';
const VERSION = 2;

const DEFAULTS = {
  version: VERSION,
  pelts: 0,
  streak: 0,
  bestStreak: 0,
  wolvesCaught: 0,
  mistakes: 0,
  shopPromptShown: false,
  seenHowTo: false,
  farm: [],            // [{ uid, breed, name, x, y }] — x/y are 0..1 farm coords
  pantry: {},          // { itemId: count } food waiting to be put out
  foods: [],           // [{ uid, item, x, y, remaining }] food on the farm
  toys: [],            // [{ uid, item, x, y }] toys on the farm
  nextUid: 1,
  runSeed: 0,          // reshuffled on each mistake: which round of each day has the hungry wolf
  stats: { stampedeBest: 0, lightning: 0, tellsFound: {}, bought: [] }, // for achievements
  achievements: {},    // { id: unlockedAt }
  settings: { sound: true, haptics: true, colorSafe: false },
};

// One step per version bump: STEPS[n] upgrades a v(n) save to v(n+1).
const STEPS = {
  // v2: achievements. Sheep already on the farm count as bought. The hungry
  // wolf moved from a settings toggle to one round a day.
  1: (d) => {
    d.stats = { stampedeBest: 0, lightning: 0, tellsFound: {}, bought: [...new Set((d.farm || []).map((a) => a?.breed).filter(Boolean))] };
    if (d.settings) delete d.settings.hungryWolf;
  },
};

function migrate(data) {
  let v = Number(data.version) || 1;
  while (v < VERSION) { STEPS[v]?.(data); v++; }
  data.version = VERSION;
  // Basic validation so a hand-edited or half-written save can't poison play.
  for (const k of ['pelts', 'streak', 'bestStreak', 'wolvesCaught', 'mistakes', 'nextUid']) {
    if (!Number.isFinite(data[k]) || data[k] < 0) delete data[k];
  }
  if (!Array.isArray(data.farm)) data.farm = [];
  for (const k of ['foods', 'toys']) if (!Array.isArray(data[k])) data[k] = [];
  if (!data.pantry || typeof data.pantry !== 'object') data.pantry = {};
  if (!data.achievements || typeof data.achievements !== 'object') data.achievements = {};
  const st = data.stats && typeof data.stats === 'object' ? data.stats : {};
  data.stats = {
    stampedeBest: Number.isFinite(st.stampedeBest) ? st.stampedeBest : 0,
    lightning: Number.isFinite(st.lightning) ? st.lightning : 0,
    tellsFound: st.tellsFound && typeof st.tellsFound === 'object' ? st.tellsFound : {},
    bought: Array.isArray(st.bought) ? st.bought : [],
  };
  data.farm = data.farm.filter((a) => a && typeof a.breed === 'string')
    .map((a) => ({ ...a, x: Number.isFinite(a.x) ? a.x : 0.5, y: Number.isFinite(a.y) ? a.y : 0.5 }));
  return data;
}

function fresh() { return JSON.parse(JSON.stringify(DEFAULTS)); } // structuredClone needs iOS 15.4+

export const save = {
  data: fresh(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = migrate(JSON.parse(raw));
        this.data = { ...fresh(), ...parsed, settings: { ...DEFAULTS.settings, ...parsed.settings } };
      }
    } catch (e) {
      console.warn('save unreadable, starting fresh', e);
      this.data = fresh();
    }
    if (!this.data.runSeed) this.data.runSeed = 1 + Math.floor(Math.random() * 1e9);
    return this.data;
  },
  write() {
    // Skip '_' keys: render caches hang off look objects (look._ids).
    try { localStorage.setItem(KEY, JSON.stringify(this.data, (k, v) => (k.startsWith('_') ? undefined : v))); } catch { /* private mode etc. */ }
  },
  reset() {
    const settings = this.data.settings;
    this.data = fresh();
    this.data.settings = settings;
    this.write();
  },
};
