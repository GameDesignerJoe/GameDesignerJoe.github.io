// Comic collection storage. localStorage-backed; cloud sync added in Phase 4.
//
// Schema for a saved comic:
//   {
//     id: "<uuid>",
//     added_at: "<ISO timestamp>",
//     title: "X-Men",
//     issue: "1",
//     year: 1963,
//     publisher: "Marvel",
//     cover_url: "https://comicvine.gamespot.com/...",   // null if no ComicVine match
//     cv_volume_id: 2133,                                  // null if no match
//     cv_issue_id: 6694,                                   // null if no match
//     cv_cover_date: "1963-09-01",                         // null if unknown
//     cv_detail_url: "https://comicvine.gamespot.com/issue/4000-6694/",  // null if no match
//     issue_name: "First Issue!",                          // ComicVine issue title, optional
//     notes: "",                                           // user notes
//     ai_original: { title, issue, year, publisher, confidence },
//     user_corrected: false
//   }

const LS_KEY = 'comic_collector_collection';
const SCHEMA_VERSION = 1;

function uuid() {
  // crypto.randomUUID is available in all modern browsers + iOS 15.4+.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback to a simple random hex if not.
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { version: SCHEMA_VERSION, comics: [] };
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.comics)) {
      return { version: SCHEMA_VERSION, comics: [] };
    }
    return obj;
  } catch {
    return { version: SCHEMA_VERSION, comics: [] };
  }
}

function saveRaw(state) {
  state.version = SCHEMA_VERSION;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function listComics() {
  return loadRaw().comics.slice().sort((a, b) =>
    String(b.added_at).localeCompare(String(a.added_at))
  );
}

export function countComics() {
  return loadRaw().comics.length;
}

export function getComic(id) {
  return loadRaw().comics.find(c => c.id === id) || null;
}

export function addComic(comic) {
  const state = loadRaw();
  const entry = {
    id: uuid(),
    added_at: new Date().toISOString(),
    title: String(comic.title || '').trim(),
    issue: String(comic.issue || '').replace(/^#/, '').trim(),
    year: comic.year ? Number(comic.year) : null,
    publisher: String(comic.publisher || '').trim(),
    cover_url: comic.cover_url || null,
    cv_volume_id: comic.cv_volume_id || null,
    cv_issue_id: comic.cv_issue_id || null,
    cv_cover_date: comic.cv_cover_date || null,
    cv_detail_url: comic.cv_detail_url || null,
    issue_name: comic.issue_name || '',
    notes: comic.notes || '',
    ai_original: comic.ai_original || null,
    user_corrected: !!comic.user_corrected,
  };
  state.comics.push(entry);
  saveRaw(state);
  return entry;
}

export function updateComic(id, patch) {
  const state = loadRaw();
  const idx = state.comics.findIndex(c => c.id === id);
  if (idx < 0) return null;
  state.comics[idx] = { ...state.comics[idx], ...patch };
  saveRaw(state);
  return state.comics[idx];
}

export function removeComic(id) {
  const state = loadRaw();
  const before = state.comics.length;
  state.comics = state.comics.filter(c => c.id !== id);
  if (state.comics.length === before) return false;
  saveRaw(state);
  return true;
}

export function exportJSON() {
  const state = loadRaw();
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    version: SCHEMA_VERSION,
    comics: state.comics,
  }, null, 2);
}

// Returns { added, skipped } counts. Skips duplicates by cv_issue_id (when present)
// or by (title + issue + year) fingerprint.
export function importJSON(jsonString) {
  let parsed;
  try { parsed = JSON.parse(jsonString); }
  catch { throw new Error('Imported file is not valid JSON.'); }

  const incoming = Array.isArray(parsed?.comics) ? parsed.comics : null;
  if (!incoming) throw new Error('Imported file does not contain a "comics" array.');

  const state = loadRaw();
  const cvKeys = new Set(state.comics.filter(c => c.cv_issue_id).map(c => c.cv_issue_id));
  const fpKeys = new Set(state.comics.map(c => fingerprint(c)));

  let added = 0, skipped = 0;
  for (const c of incoming) {
    if (!c || typeof c !== 'object') { skipped++; continue; }
    if (c.cv_issue_id && cvKeys.has(c.cv_issue_id)) { skipped++; continue; }
    const fp = fingerprint(c);
    if (fpKeys.has(fp)) { skipped++; continue; }

    const entry = {
      id: c.id || uuid(),
      added_at: c.added_at || new Date().toISOString(),
      title: String(c.title || '').trim(),
      issue: String(c.issue || '').replace(/^#/, '').trim(),
      year: c.year ? Number(c.year) : null,
      publisher: String(c.publisher || '').trim(),
      cover_url: c.cover_url || null,
      cv_volume_id: c.cv_volume_id || null,
      cv_issue_id: c.cv_issue_id || null,
      cv_cover_date: c.cv_cover_date || null,
      cv_detail_url: c.cv_detail_url || null,
      issue_name: c.issue_name || '',
      notes: c.notes || '',
      ai_original: c.ai_original || null,
      user_corrected: !!c.user_corrected,
    };
    state.comics.push(entry);
    if (entry.cv_issue_id) cvKeys.add(entry.cv_issue_id);
    fpKeys.add(fingerprint(entry));
    added++;
  }
  saveRaw(state);
  return { added, skipped };
}

function fingerprint(c) {
  return `${String(c.title || '').toLowerCase().trim()}|${String(c.issue || '').toLowerCase().replace(/^#/, '').trim()}|${c.year || ''}`;
}
