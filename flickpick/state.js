// ─── FLICKPICK STATE MANAGEMENT ─────────────────────────────────────────────
// Centralized state mutations. All reads go through `state.seen[id]` etc.
// All writes go through the `State` object which handles normalization,
// deduplication, persistence, and change notification.

let state = {
  seen: {},   // id -> item (with rating, addedAt)
  want: {},   // id -> item (with addedAt)
  nope: {},   // id -> item
};

// ─── ITEM STORE ─────────────────────────────────────────────────────────────
// Registry of all items seen during this session, keyed by ID.
// Render functions register items here so toggle handlers can look them up
// by ID instead of parsing JSON from DOM attributes.
const itemStore = {};

function registerItem(item) {
  if (item && item.id) itemStore[item.id] = item;
}

function registerItems(items) {
  items.forEach(registerItem);
}

function getStoredItem(id) {
  return itemStore[id] || state.seen[id] || state.want[id] || state.nope[id];
}

// ─── NORMALIZATION ──────────────────────────────────────────────────────────
function normalizeId(title, year) {
  const base = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return year ? `${base}-${year}` : base;
}

function normalizeItem(item) {
  return { ...item, id: normalizeId(item.title, item.year) };
}

function normalizeItems(items) {
  return items.map(normalizeItem);
}

// Strip transient blurb field — only description gets persisted
function itemForState(item) {
  const { blurb, ...rest } = item;
  return rest;
}

// ─── INTERNAL HELPERS ───────────────────────────────────────────────────────
function _deduplicateCollection(collection) {
  const normalized = {};
  for (const [oldId, item] of Object.entries(collection)) {
    const newId = normalizeId(item.title, item.year);
    if (!normalized[newId] || (item.addedAt || 0) > (normalized[newId].addedAt || 0)) {
      normalized[newId] = { ...item, id: newId };
    }
  }
  return normalized;
}

// ─── STATE OBJECT (all mutations go through here) ───────────────────────────
const State = {
  _persist() {
    localStorage.setItem('flickpick_state', JSON.stringify(state));
    updateWantCount();
    updateSeenCount();
  },

  load() {
    try {
      const s = localStorage.getItem('flickpick_state');
      if (s) {
        const parsed = JSON.parse(s);
        state.seen = _deduplicateCollection(parsed.seen || {});
        state.want = _deduplicateCollection(parsed.want || {});
        state.nope = _deduplicateCollection(parsed.nope || {});
        for (const id in state.seen) {
          if (state.seen[id].rating === undefined) state.seen[id].rating = null;
        }
        localStorage.setItem('flickpick_state', JSON.stringify(state));
      }
    } catch(e) {
      console.error('Failed to load state:', e);
    }
  },

  // ─── SEEN ───────────────────────────────────────────────────────────────
  addSeen(item) {
    const clean = itemForState(item);
    const nid = normalizeId(clean.title, clean.year);
    state.seen[nid] = { ...clean, id: nid, rating: null, addedAt: Date.now() };
    this._persist();
    return nid;
  },

  removeSeen(id) {
    const item = state.seen[id];
    if (!item) return null;
    delete state.seen[id];
    this._persist();
    return item;
  },

  // ─── WANT ───────────────────────────────────────────────────────────────
  addWant(item) {
    const clean = itemForState(item);
    const nid = normalizeId(clean.title, clean.year);
    state.want[nid] = { ...clean, id: nid, addedAt: Date.now() };
    this._persist();
    return nid;
  },

  removeWant(id) {
    const item = state.want[id];
    if (!item) return null;
    delete state.want[id];
    this._persist();
    return item;
  },

  // ─── NOPE ───────────────────────────────────────────────────────────────
  addNope(item) {
    const clean = itemForState(item);
    const nid = normalizeId(clean.title, clean.year);
    state.nope[nid] = { ...clean, id: nid };
    this._persist();
    return nid;
  },

  removeNope(id) {
    const item = state.nope[id];
    if (!item) return null;
    delete state.nope[id];
    this._persist();
    return item;
  },

  // ─── RATING ─────────────────────────────────────────────────────────────
  setRating(id, rating) {
    if (!state.seen[id]) return null;
    state.seen[id].rating = (state.seen[id].rating === rating) ? null : rating;
    this._persist();
    return state.seen[id].rating;
  },

  // ─── IMPORT ─────────────────────────────────────────────────────────────
  importData(imported) {
    if (imported.seen) Object.assign(state.seen, imported.seen);
    if (imported.want) Object.assign(state.want, imported.want);
    if (imported.nope) Object.assign(state.nope, imported.nope);
    // Deduplicate after import
    state.seen = _deduplicateCollection(state.seen);
    state.want = _deduplicateCollection(state.want);
    state.nope = _deduplicateCollection(state.nope);
    for (const id in state.seen) {
      if (state.seen[id].rating === undefined) state.seen[id].rating = null;
    }
    this._persist();
  },

  // ─── READ HELPERS ───────────────────────────────────────────────────────
  isKnown(id) {
    return !!state.seen[id] || !!state.want[id] || !!state.nope[id];
  },

  getAllExcludedTitles() {
    const titles = new Set();
    for (const item of Object.values(state.nope)) titles.add(item.title);
    for (const item of Object.values(state.seen)) titles.add(item.title);
    for (const item of Object.values(state.want)) titles.add(item.title);
    return titles;
  },

  filterOutKnown(items) {
    const existingTitles = new Set();
    for (const item of Object.values(state.seen)) existingTitles.add(item.title.toLowerCase());
    for (const item of Object.values(state.want)) existingTitles.add(item.title.toLowerCase());
    for (const item of Object.values(state.nope)) existingTitles.add(item.title.toLowerCase());
    return items.filter(item =>
      !state.nope[item.id] && !state.seen[item.id] && !state.want[item.id] &&
      !existingTitles.has(item.title.toLowerCase())
    );
  }
};
