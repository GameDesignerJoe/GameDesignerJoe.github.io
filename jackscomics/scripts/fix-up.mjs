// Surgically patch the manifest for series the main lookup couldn't resolve.
// Uses verified volume IDs found via direct ComicVine searches.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const JC_DIR = resolve(SCRIPT_DIR, '..');
const SERIES_PATH = resolve(JC_DIR, 'series.json');
const MANIFEST_PATH = resolve(JC_DIR, 'manifest.json');
const ENV_PATH = resolve(JC_DIR, '.env');
const UA = 'JacksComics/0.1 (fix-up)';
const API = 'https://comicvine.gamespot.com/api';
const THROTTLE_MS = 2000;

const KEY = readFileSync(ENV_PATH, 'utf8')
  .split(/\r?\n/).find(l => l.startsWith('COMICVINE_KEY='))
  .slice('COMICVINE_KEY='.length).trim();

let lastCallAt = 0;
async function throttledFetch(url) {
  const wait = THROTTLE_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallAt = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.status_code !== 1) throw new Error(`API error ${j.status_code}: ${j.error}`);
  return j;
}

async function fetchAllIssuesForVolume(volumeId) {
  const out = {};
  let offset = 0;
  while (true) {
    const url = `${API}/issues/?api_key=${KEY}&format=json&filter=volume:${volumeId}&field_list=id,issue_number,cover_date,image,name&limit=100&offset=${offset}`;
    const j = await throttledFetch(url);
    for (const i of (j.results || [])) {
      out[i.issue_number] = {
        cv_id: i.id,
        name: i.name || '',
        cover_date: i.cover_date || null,
        image_url: i.image?.original_url || null,
      };
    }
    offset += j.number_of_page_results || 0;
    if (offset >= (j.number_of_total_results || 0) || !j.number_of_page_results) break;
  }
  return out;
}

function parseSpecial(iss) {
  const m = iss.match(/^(KS|Annual|Special)[\s-]?(\d+)$/i);
  if (!m) return null;
  const norm = m[1].toLowerCase();
  return { prefix: norm === 'ks' ? 'KS' : (norm.charAt(0).toUpperCase() + norm.slice(1)), num: m[2] };
}

function rebuildIssues(series, state) {
  state.issues = {};
  let hits = 0, misses = 0;
  for (const iss of series.issues) {
    const sp = parseSpecial(iss);
    let found = null;
    if (sp) {
      const pool = state.special_maps?.[sp.prefix]?.issues || {};
      found = pool[sp.num] || pool[String(Number(sp.num))];
    } else {
      const bare = iss.replace(/^#/, '');
      found = state.issue_map?.[bare] || state.issue_map?.[String(Number(bare))];
    }
    if (found) { state.issues[iss] = found; hits++; }
    else { state.issues[iss] = null; misses++; }
  }
  state.status = misses === 0 ? 'complete' : 'partial';
  state.hits = hits; state.misses = misses;
  delete state.last_error;
}

// Plan:
//   { seriesId: { mainVolume?: {id,name,year}, specials?: { Prefix: {id,name} } } }
const FIXES = {
  'captain-savage': {
    mainVolume: { id: 2402, name: 'Captain Savage', year: 1968 },
  },
  'sgt-fury': {
    mainVolume: { id: 6724, name: 'Sgt. Fury', year: 1963 },
  },
  'sgt-fury-specials': {
    mainVolume: { id: 2237, name: 'Sgt. Fury Annual', year: 1965 },
    specials: { Special: { id: 2237, name: 'Sgt. Fury Annual' } },
  },
  'marvel-comics-group-ff': {
    mainVolume: { id: 2045, name: 'Fantastic Four', year: 1961 },
  },
  'marvel-comics-group-bp': {
    mainVolume: { id: 2574, name: 'Jungle Action', year: 1972 },
  },
  'avengers': {
    specials: { KS: { id: 2350, name: 'The Avengers Annual' } },
  },
  'thor': {
    specials: { Annual: { id: 2295, name: 'Thor Annual' } },
  },
  'x-men': {
    specials: { Annual: { id: 22988, name: 'X-Men Annual' } },
  },
};

const series = JSON.parse(readFileSync(SERIES_PATH, 'utf8'));
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

for (const [sid, fix] of Object.entries(FIXES)) {
  const s = series.find(x => x.id === sid);
  if (!s) { console.log(`[skip] ${sid}: not in series.json`); continue; }
  const state = manifest.series[sid] || (manifest.series[sid] = {});
  state.special_maps = state.special_maps || {};

  if (fix.mainVolume) {
    if (state.volume_id !== fix.mainVolume.id) {
      console.log(`[${sid}] main volume → ${fix.mainVolume.id} (${fix.mainVolume.name})`);
      state.volume_id = fix.mainVolume.id;
      state.volume_name = fix.mainVolume.name;
      state.volume_year = fix.mainVolume.year;
      console.log(`  fetching issues...`);
      state.issue_map = await fetchAllIssuesForVolume(fix.mainVolume.id);
      console.log(`  got ${Object.keys(state.issue_map).length} issues`);
    }
  }

  if (fix.specials) {
    for (const [prefix, sp] of Object.entries(fix.specials)) {
      const cur = state.special_maps[prefix];
      if (!cur || cur.volume_id !== sp.id) {
        console.log(`[${sid}] special "${prefix}" → vol ${sp.id} (${sp.name})`);
        console.log(`  fetching issues...`);
        const issues = await fetchAllIssuesForVolume(sp.id);
        state.special_maps[prefix] = { volume_id: sp.id, volume_name: sp.name, issues };
        console.log(`  got ${Object.keys(issues).length} issues`);
      }
    }
  }

  rebuildIssues(s, state);
  console.log(`[${sid}] → ${state.status} (${state.hits}/${s.issues.length})`);

  manifest.generated_at = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

console.log('\nDone.');
