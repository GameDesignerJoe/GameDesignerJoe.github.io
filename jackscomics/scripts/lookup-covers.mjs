// ComicVine cover lookup. Reads series.json, writes manifest.json.
// Resumable: re-running picks up where it left off.
//
// Usage:
//   node jackscomics/scripts/lookup-covers.mjs                  # process all unfinished series
//   node jackscomics/scripts/lookup-covers.mjs <series-id>      # process just one series
//   node jackscomics/scripts/lookup-covers.mjs --retry <id>     # discard cached state for one series and redo
//   node jackscomics/scripts/lookup-covers.mjs --list           # print status table and exit
//
// API key: read from jackscomics/.env (line: COMICVINE_KEY=...)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Resolve paths relative to this script so it works from any cwd.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const JC_DIR = resolve(SCRIPT_DIR, '..');
const SERIES_PATH = resolve(JC_DIR, 'series.json');
const MANIFEST_PATH = resolve(JC_DIR, 'manifest.json');
const ENV_PATH = resolve(JC_DIR, '.env');
const UA = 'JacksComics/0.1 (build-time lookup)';
const API = 'https://comicvine.gamespot.com/api';
const THROTTLE_MS = 2000;

const args = process.argv.slice(2);
const flagList = args.includes('--list');
const retryIdx = args.indexOf('--retry');
const retryId = retryIdx >= 0 ? args[retryIdx + 1] : null;
const onlySeriesId = args.find(a => !a.startsWith('--') && a !== retryId) || null;

function loadKey() {
  const env = readFileSync(ENV_PATH, 'utf8');
  const line = env.split(/\r?\n/).find(l => l.startsWith('COMICVINE_KEY='));
  if (!line) throw new Error('COMICVINE_KEY not set in ' + ENV_PATH);
  return line.slice('COMICVINE_KEY='.length).trim();
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 1, generated_at: null, series: {} };
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function saveManifest(m) {
  m.generated_at = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n');
}

let lastCallAt = 0;
async function throttledFetch(url) {
  const wait = THROTTLE_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallAt = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const json = await res.json();
  if (json.status_code !== 1) throw new Error(`API error ${json.status_code}: ${json.error} on ${url}`);
  return json;
}

const KEY = loadKey();

async function searchVolumes(name, year) {
  const url = `${API}/volumes/?api_key=${KEY}&format=json&filter=name:${encodeURIComponent(name)}&field_list=id,name,start_year,publisher,count_of_issues&limit=20`;
  const json = await throttledFetch(url);
  return (json.results || [])
    .map(v => ({
      id: v.id,
      name: v.name,
      start_year: v.start_year,
      publisher: v.publisher?.name || '(unknown)',
      count_of_issues: v.count_of_issues,
    }))
    .sort((a, b) => Math.abs((a.start_year || 0) - year) - Math.abs((b.start_year || 0) - year));
}

async function fetchAllIssuesForVolume(volumeId) {
  const all = {};
  let offset = 0;
  const limit = 100;
  while (true) {
    const url = `${API}/issues/?api_key=${KEY}&format=json&filter=volume:${volumeId}&field_list=id,issue_number,cover_date,image,name&limit=${limit}&offset=${offset}`;
    const json = await throttledFetch(url);
    for (const i of (json.results || [])) {
      all[i.issue_number] = {
        cv_id: i.id,
        name: i.name || '',
        cover_date: i.cover_date || null,
        image_url: i.image?.original_url || null,
      };
    }
    const total = json.number_of_total_results || 0;
    offset += (json.number_of_page_results || 0);
    if (offset >= total || !json.number_of_page_results) break;
  }
  return all;
}

const rl = createInterface({ input: stdin, output: stdout });
async function prompt(q) { return (await rl.question(q)).trim(); }

async function pickVolume(series, candidates, opts = {}) {
  const { autoMatchKey = 'year' } = opts; // 'year' for main volumes, 'marvel' for specials
  const top = candidates.slice(0, 10);

  // Auto-pick when unambiguous.
  let autoIndex = -1;
  if (autoMatchKey === 'year') {
    const yearMatches = top.filter(c => c.start_year === series.year);
    if (yearMatches.length === 1 && top[0].start_year === series.year) autoIndex = 0;
  } else if (autoMatchKey === 'marvel') {
    const marvelMatches = top.filter(c => c.publisher === 'Marvel');
    if (marvelMatches.length === 1 && top[0].publisher === 'Marvel') autoIndex = 0;
  }

  if (autoIndex >= 0) {
    const c = top[autoIndex];
    console.log(`\n--- ${series.title} (${series.year}) — id=${series.id} ---`);
    console.log(`  [auto] ${c.name} (${c.start_year})  ${c.publisher}  ${c.count_of_issues} issues  id=${c.id}`);
    return c;
  }

  // Otherwise prompt.
  console.log(`\n--- ${series.title} (${series.year}) — id=${series.id} ---`);
  console.log(`Found ${candidates.length} candidate volumes (sorted by year proximity):`);
  top.forEach((c, i) => {
    const yearMatch = c.start_year === series.year ? ' ✓' : '';
    console.log(`  [${i + 1}] ${c.name} (${c.start_year})${yearMatch}  ${c.publisher}  ${c.count_of_issues} issues  id=${c.id}`);
  });
  console.log('  [s] skip this series for now');
  console.log('  [m] enter volume id manually');

  const hasDefault = top[0]?.start_year === series.year;
  const promptText = hasDefault ? 'Choose [Enter=1]: ' : 'Choose: ';

  while (true) {
    const ans = await prompt(promptText);
    if (ans === '' && hasDefault) return top[0];
    if (ans === 's') return null;
    if (ans === 'm') {
      const id = await prompt('Volume id: ');
      return { id: Number(id), name: '(manual)', start_year: null, publisher: '(manual)', count_of_issues: null };
    }
    const n = Number(ans);
    if (n >= 1 && n <= top.length) return top[n - 1];
    console.log('  invalid choice, try again.');
  }
}

// Parse "KS-2", "Annual 1", "Special 4" into { prefix, num }; returns null for plain numbers.
function parseSpecial(iss) {
  const m = iss.match(/^(KS|Annual|Special)[\s-]?(\d+)$/i);
  if (!m) return null;
  const norm = m[1].toLowerCase();
  return { prefix: norm === 'ks' ? 'KS' : (norm.charAt(0).toUpperCase() + norm.slice(1)), num: m[2] };
}

async function resolveSpecialVolume(series, prefix, manifest) {
  series._specials = series._specials || {};
  if (series._specials[prefix]) return series._specials[prefix];
  console.log(`\n>> ${series.title} has special-format issues prefixed "${prefix}" — these likely live in a separate volume.`);
  const suggested = `${series.title} ${prefix === 'KS' ? 'Annual' : prefix}`.replace(/^The /, '');
  const name = (await prompt(`Search volumes by name [${suggested}]: `)) || suggested;
  const candidates = await searchVolumes(name, series.year);
  if (!candidates.length) {
    console.log('  (no candidates) — skipping prefix');
    series._specials[prefix] = null;
    return null;
  }
  const chosen = await pickVolume({ title: `${series.title} — ${prefix}`, year: series.year, id: series.id + ':' + prefix }, candidates, { autoMatchKey: 'marvel' });
  series._specials[prefix] = chosen;
  return chosen;
}

async function processSeries(series, manifest) {
  const id = series.id;
  const state = manifest.series[id] || (manifest.series[id] = {});

  // Phase A: resolve main volume
  if (!state.volume_id) {
    console.log(`\n=== Searching volumes for: ${series.title} (${series.year}) ===`);
    const cands = await searchVolumes(series.title.replace(/^The /, ''), series.year);
    if (!cands.length) {
      console.log('  No candidates found. Try a manual search.');
      const manual = await prompt('Alt name (blank to skip): ');
      if (!manual) { state.status = 'skipped'; saveManifest(manifest); return; }
      const cands2 = await searchVolumes(manual, series.year);
      if (!cands2.length) { state.status = 'no-match'; saveManifest(manifest); return; }
      const chosen = await pickVolume(series, cands2);
      if (!chosen) { state.status = 'skipped'; saveManifest(manifest); return; }
      state.volume_id = chosen.id; state.volume_name = chosen.name; state.volume_year = chosen.start_year;
    } else {
      const chosen = await pickVolume(series, cands);
      if (!chosen) { state.status = 'skipped'; saveManifest(manifest); return; }
      state.volume_id = chosen.id; state.volume_name = chosen.name; state.volume_year = chosen.start_year;
    }
    saveManifest(manifest);
  }

  // Phase B: enumerate all issues for that volume
  if (!state.issue_map) {
    console.log(`  Fetching all issues from volume ${state.volume_id} (${state.volume_name})...`);
    state.issue_map = await fetchAllIssuesForVolume(state.volume_id);
    console.log(`  Got ${Object.keys(state.issue_map).length} issues from the volume.`);
    saveManifest(manifest);
  }

  // Phase C: resolve special-format issues against separate volumes
  state.special_maps = state.special_maps || {};
  const specials = new Set();
  for (const iss of series.issues) {
    const sp = parseSpecial(iss);
    if (sp) specials.add(sp.prefix);
  }
  for (const prefix of specials) {
    if (state.special_maps[prefix]) continue;
    const specVol = await resolveSpecialVolume(series, prefix, manifest);
    if (!specVol) { state.special_maps[prefix] = { volume_id: null, issues: {} }; continue; }
    console.log(`  Fetching ${prefix} issues from volume ${specVol.id} (${specVol.name})...`);
    const map = await fetchAllIssuesForVolume(specVol.id);
    state.special_maps[prefix] = { volume_id: specVol.id, volume_name: specVol.name, issues: map };
    saveManifest(manifest);
  }

  // Phase D: build the final per-issue manifest for owned issues
  state.issues = {};
  let hits = 0, misses = 0;
  for (const iss of series.issues) {
    const sp = parseSpecial(iss);
    if (sp) {
      const pool = state.special_maps[sp.prefix]?.issues || {};
      const found = pool[sp.num] || pool[String(Number(sp.num))];
      if (found) { state.issues[iss] = found; hits++; }
      else { state.issues[iss] = null; misses++; }
    } else {
      const bare = iss.replace(/^#/, '');
      const found = state.issue_map[bare] || state.issue_map[String(Number(bare))];
      if (found) { state.issues[iss] = found; hits++; }
      else { state.issues[iss] = null; misses++; }
    }
  }
  state.status = misses === 0 ? 'complete' : 'partial';
  state.hits = hits; state.misses = misses;
  console.log(`  ${series.title}: ${hits} hits, ${misses} misses → ${state.status}`);
  saveManifest(manifest);
}

function statusOf(manifest, series) {
  const s = manifest.series[series.id];
  if (!s) return 'pending';
  if (s.status) return `${s.status} (${s.hits || 0}/${series.issues.length})`;
  if (s.issue_map) return 'issues-fetched';
  if (s.volume_id) return 'volume-resolved';
  return 'pending';
}

async function main() {
  const series = JSON.parse(readFileSync(SERIES_PATH, 'utf8'));
  const manifest = loadManifest();

  if (flagList) {
    console.log('Status:');
    for (const s of series) console.log(`  ${s.id.padEnd(30)} ${statusOf(manifest, s)}`);
    rl.close();
    return;
  }

  let targets = series;
  if (retryId) {
    delete manifest.series[retryId];
    saveManifest(manifest);
    targets = series.filter(s => s.id === retryId);
    if (!targets.length) { console.error(`No series with id "${retryId}"`); rl.close(); return; }
  } else if (onlySeriesId) {
    targets = series.filter(s => s.id === onlySeriesId);
    if (!targets.length) { console.error(`No series with id "${onlySeriesId}"`); rl.close(); return; }
  }

  for (const s of targets) {
    const cur = manifest.series[s.id];
    if (cur?.status === 'complete' && !retryId) {
      console.log(`[skip] ${s.id}: already complete`);
      continue;
    }
    try {
      await processSeries(s, manifest);
    } catch (err) {
      console.error(`[error] ${s.id}: ${err.message}`);
      manifest.series[s.id] = manifest.series[s.id] || {};
      manifest.series[s.id].last_error = err.message;
      saveManifest(manifest);
    }
  }

  rl.close();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); rl.close(); process.exit(1); });
