// Save data. One versioned JSON blob in localStorage. Add a field: give it a
// default in DEFAULTS. Change a field's shape: bump VERSION and add a step to
// migrate() so existing players keep their farms.

const KEY = 'catchTheWolf.save';
const VERSION = 1;

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
  nextUid: 1,
  settings: { sound: true, haptics: true },
};

function migrate(data) {
  // if (data.version === 1) { ...; data.version = 2; }
  return data;
}

function fresh() { return structuredClone(DEFAULTS); }

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
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode etc. */ }
  },
  reset() {
    const settings = this.data.settings;
    this.data = fresh();
    this.data.settings = settings;
    this.write();
  },
};
