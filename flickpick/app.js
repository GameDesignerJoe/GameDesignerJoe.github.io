// ─── RESILIENT JSON PARSING ──────────────────────────────────────────────────
// Claude sometimes returns JSON with trailing commas, unescaped quotes in
// values, smart quotes, control chars, or markdown fencing around it.
function parseClaudeJSON(raw) {
  // Step 1: strip markdown fences and trim
  let text = raw.replace(/```json\s*|```/g, '').trim();

  // Step 2: extract just the JSON object/array (ignore surrounding prose)
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error('No JSON object found in response');
  text = objMatch[0];

  // Step 3: basic cleanup — trailing commas, control chars
  function cleanup(s) {
    return s.replace(/,\s*([}\]])/g, '$1').replace(/[\x00-\x1f\x7f]/g, ' ');
  }

  // Attempt 1: try parsing with basic cleanup
  try { return JSON.parse(cleanup(text)); } catch {}

  // Attempt 2: fix unescaped quotes inside string values
  // Strategy: walk the string and rebuild with proper escaping
  try {
    let fixed = '';
    let i = 0;
    while (i < text.length) {
      // Skip whitespace and structural chars outside strings
      if (text[i] !== '"') {
        fixed += text[i++];
        continue;
      }
      // Found opening quote — scan for the value content
      fixed += '"';
      i++; // skip opening quote
      // Find the closing quote: it's the quote followed by a structural char
      // ( , } ] : ) or end of meaningful content
      let value = '';
      while (i < text.length) {
        if (text[i] === '"') {
          // Is this the real closing quote? Check what follows.
          const after = text.slice(i + 1).match(/^\s*([,}\]:])/);
          if (after || i === text.length - 1) {
            break; // real closing quote
          }
          // Unescaped interior quote — escape it
          value += '\\"';
          i++;
          continue;
        }
        if (text[i] === '\\') {
          value += text[i] + (text[i + 1] || '');
          i += 2;
          continue;
        }
        value += text[i++];
      }
      fixed += value + '"';
      if (i < text.length) i++; // skip closing quote
    }
    return JSON.parse(cleanup(fixed));
  } catch {}

  // Attempt 3: regex field extraction for known single-object schema
  try {
    const fields = {};
    const fieldPattern = /"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = fieldPattern.exec(text)) !== null) {
      fields[m[1]] = m[2].replace(/\\"/g, '"');
    }
    // Also handle arrays: "similar": [...]
    const arrayPattern = /"(\w+)"\s*:\s*(\[[\s\S]*?\])\s*[,}]/g;
    while ((m = arrayPattern.exec(text)) !== null) {
      try { fields[m[1]] = JSON.parse(cleanup(m[2])); } catch {}
    }
    if (Object.keys(fields).length > 0) return fields;
  } catch {}

  throw new Error('Could not parse Claude response as JSON');
}

// ─── UI STATE (non-persisted) ────────────────────────────────────────────────
let currentFeatured = null;
let currentMultiSearch = null; // array of titles when in multi-search mode, else null
let shownIds = new Set();
const GRID_SIZE = 4;
const POOL_BUFFER = 8; // keep this many items buffered ahead of current page
const viewHistory = []; // stack of { featured, suggestionPool, suggestionPageIdx, shownIds } or { chooser: snapshot of chooserState }
let suggestionPool = [];     // flat array of suggestion items (grows as user pages)
let suggestionPageIdx = 0;
let poolFetching = false;

// ─── CHOOSER STATE (search disambiguation, bucketed by user state) ──────────
const CHOOSER_PAGE_SIZE = 4;
const CHOOSER_INITIAL_COUNT = 18;     // wider so library matches + new finds both fit
const CHOOSER_LOAD_MORE_COUNT = 12;
const CHOOSER_NEW_TARGET = 8;     // keep filling NEW FINDS until it has this many
const CHOOSER_MAX_FETCHES = 4;    // cap on lazy-load Claude calls per search
// Order matters — buckets render top-to-bottom in this order. NEW first so the
// user sees fresh discovery before their pre-saved watchlist.
const CHOOSER_BUCKETS = ['new', 'want'];
const CHOOSER_BUCKET_LABELS = {
  new: 'New Finds',
  want: 'From Your Watchlist',
};
let chooserState = {
  query: '',
  pool: [],
  pages: { new: 0, want: 0 },
  fetching: false,
  exhausted: false,
  fetchCount: 0,
};

// ─── TMDB CACHE ─────────────────────────────────────────────────────────────
const posterCache = {};
const tmdbIdCache = {};
const ratingCache = {}; // cacheKey -> { rating: 0-100 int, voteCount: int } | null

// Vote-count threshold below which we hide the rating (low confidence).
const RATING_MIN_VOTES = 10;

async function fetchPoster(title, year) {
  const cacheKey = `${title}::${year || ''}`;
  if (posterCache[cacheKey] !== undefined) return posterCache[cacheKey];

  try {
    let tmdbUrl = `/api/tmdb?query=${encodeURIComponent(title)}`;
    if (year) tmdbUrl += `&year=${year}`;
    const res = await fetch(tmdbUrl);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const match = data.results.find(r =>
        (r.title || r.name || '').toLowerCase() === title.toLowerCase()
      ) || data.results[0];

      // Cache TMDB ID + media type for trailer/provider lookups
      if (match.id && match.media_type) {
        tmdbIdCache[cacheKey] = { tmdbId: match.id, mediaType: match.media_type };
      }

      // Cache rating (0–100 int) + vote_count, alongside the poster.
      if (typeof match.vote_average === 'number' && ratingCache[cacheKey] === undefined) {
        const rating = Math.round(match.vote_average * 10);
        const voteCount = match.vote_count || 0;
        ratingCache[cacheKey] = { rating, voteCount };
        persistRatingToState(title, year, rating, voteCount);
      }

      // Capture original language so saved items pick it up the first time
      // they render through fetchPoster — used by the English-only filter.
      if (match.original_language) {
        persistLanguageToState(title, year, match.original_language);
      }

      if (match.poster_path) {
        const url = `https://image.tmdb.org/t/p/w342${match.poster_path}`;
        posterCache[cacheKey] = url;
        return url;
      }
    }
    posterCache[cacheKey] = null;
    return null;
  } catch (err) {
    console.warn('TMDB lookup failed:', err.message);
    // Don't cache failures — allow retries on network errors
    return null;
  }
}

// ─── RATING ──────────────────────────────────────────────────────────────────
// Rating data is read out of TMDB responses we already fetch (search,
// recommendations, similar). Returns { rating, voteCount } or null.
function getCachedRating(title, year) {
  return ratingCache[`${title}::${year || ''}`] || null;
}

// Persist the rating onto any saved state item that matches title+year.
// Lets "By Rating" sort work after a page reload without re-fetching every poster.
function persistRatingToState(title, year, rating, voteCount) {
  const id = normalizeId(title, year);
  let dirty = false;
  for (const list of ['seen', 'want', 'nope']) {
    const item = state[list][id];
    if (item && (item.tmdbRating !== rating || item.tmdbVoteCount !== voteCount)) {
      item.tmdbRating = rating;
      item.tmdbVoteCount = voteCount;
      dirty = true;
    }
  }
  if (dirty) State._persist();
}

// Persist the original_language onto any saved state item that matches title+year.
function persistLanguageToState(title, year, language) {
  const id = normalizeId(title, year);
  let dirty = false;
  for (const list of ['seen', 'want', 'nope']) {
    const item = state[list][id];
    if (item && item.language !== language) {
      item.language = language;
      dirty = true;
    }
  }
  if (dirty) State._persist();
}

// Persist provider list + trailer-availability flag onto saved state items
// so subsequent filter checks are synchronous. Survives reloads and rides on
// cloud sync, eliminating the slow "lazy-then-hide" wave on every page load.
function persistExtrasToState(title, year, providers, trailerKey) {
  const id = normalizeId(title, year);
  const providerNames = (providers || []).map(p => p.name).filter(Boolean);
  const hasTrailer = !!trailerKey;
  let dirty = false;
  for (const list of ['seen', 'want', 'nope']) {
    const item = state[list][id];
    if (!item) continue;
    const existing = item.providers || [];
    const sameLen = existing.length === providerNames.length;
    const sameSet = sameLen && existing.every(p => providerNames.includes(p));
    if (!sameSet || item.hasTrailer !== hasTrailer) {
      item.providers = providerNames;
      item.hasTrailer = hasTrailer;
      dirty = true;
    }
  }
  if (dirty) State._persist();
}

// Filter-time accessors. Return null when we genuinely don't know the answer
// (so callers default to "innocent until proven guilty"). Prefer item-level
// persisted data → in-memory extras cache → null.
function getItemProviders(item) {
  if (Array.isArray(item.providers)) return item.providers;
  const cacheKey = `${item.title}::${item.year || ''}`;
  const extras = tmdbExtrasCache[cacheKey];
  if (!extras) return null;
  return (extras.providers || []).map(p => p.name).filter(Boolean);
}

function getItemHasTrailer(item) {
  if (typeof item.hasTrailer === 'boolean') return item.hasTrailer;
  const cacheKey = `${item.title}::${item.year || ''}`;
  const extras = tmdbExtrasCache[cacheKey];
  if (!extras) return null;
  return !!extras.trailerKey;
}

// Sort key for "By Rating": prefer the persisted state value (instant on
// reload), fall back to the in-memory cache, fall back to -1 (sentinel sorts
// items without ratings to the bottom).
function getItemTmdbRating(item) {
  if (typeof item.tmdbRating === 'number'
      && (item.tmdbVoteCount || 0) >= RATING_MIN_VOTES
      && item.tmdbRating > 0) {
    return item.tmdbRating;
  }
  const entry = getCachedRating(item.title, item.year);
  return shouldShowRating(entry) ? entry.rating : -1;
}

// Rendering helpers — kept here so all surfaces format ratings the same way.
function ratingTier(rating) {
  if (rating >= 80) return 'high';
  if (rating >= 60) return 'mid';
  return 'low';
}

function shouldShowRating(entry) {
  return !!(entry && entry.rating > 0 && entry.voteCount >= RATING_MIN_VOTES);
}

function renderRatingHTML(entry, { withParens = false } = {}) {
  if (!shouldShowRating(entry)) return '';
  const text = withParens ? `(${entry.rating}%)` : `${entry.rating}%`;
  return `<span class="rating rating--${ratingTier(entry.rating)}">${text}</span>`;
}

// Async loader — populates DOM elements with `data-rating-id="${itemId}"`.
// Mirrors loadPosterFor's lifecycle. The card render leaves an empty slot;
// once TMDB resolves, we fill it. If the item never gets a TMDB hit (or its
// vote count is too low), the slot stays empty — no broken UI.
function loadRatingFor(itemId, title, year, { withParens = false } = {}) {
  fetchPoster(title, year).then(() => {
    const entry = getCachedRating(title, year);
    if (!shouldShowRating(entry)) return;
    const el = document.querySelector(`[data-rating-id="${itemId}"]`);
    if (!el) return;
    el.classList.add(`rating--${ratingTier(entry.rating)}`);
    el.textContent = withParens ? `(${entry.rating}%)` : `${entry.rating}%`;
  });
}

function getTmdbInfo(title, year) {
  return tmdbIdCache[`${title}::${year || ''}`] || null;
}

function loadPosterFor(itemId, title, year) {
  fetchPoster(title, year).then(url => {
    // Fill rating slot — fetchPoster has populated ratingCache as a side effect.
    // Featured card uses parens; smaller cards use plain "87%".
    const ratingEl = document.querySelector(`[data-rating-id="${itemId}"]`);
    if (ratingEl) {
      const withParens = ratingEl.classList.contains('rating--featured') || ratingEl.classList.contains('rating--titled');
      loadRatingFor(itemId, title, year, { withParens });
    }
    if (!url) return;
    const el = document.querySelector(`[data-poster-id="${itemId}"]`);
    if (!el) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = title;
    const isFeatured = el.classList.contains('featured-poster-placeholder');
    img.className = isFeatured ? 'featured-poster' : 'similar-poster';
    if (!isFeatured) {
      img.style.cursor = 'pointer';
      // Copy data-action and data-id for delegated event handling
      if (el.dataset.action) img.setAttribute('data-action', el.dataset.action);
      if (el.dataset.id) img.setAttribute('data-id', el.dataset.id);
    }
    retryPosterLoad(img, title, year, 2);
    img.onload = () => {
      // Guard: element may have been removed by re-render during fetch
      if (el.parentNode) el.replaceWith(img);
    };
  });
}

function loadTrailerBtnFor(itemId, title, year) {
  fetchTmdbExtras(title, year).then(({ trailerKey }) => {
    if (!trailerKey) return;
    const el = document.querySelector(`[data-trailer-id="${itemId}"]`);
    if (el) el.style.display = '';
  });
}

// ─── TMDB EXTRAS (TRAILERS + PROVIDERS) ─────────────────────────────────────
const tmdbExtrasCache = {};

// localStorage persistence for tmdbExtrasCache (mirrors streamingCache).
// 7-day TTL is plenty for provider/trailer data, which changes slowly.
const TMDB_EXTRAS_CACHE_KEY = 'flickpick_tmdb_extras_cache';
const TMDB_EXTRAS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

(function loadTmdbExtrasCache() {
  try {
    const stored = JSON.parse(localStorage.getItem(TMDB_EXTRAS_CACHE_KEY) || '{}');
    const now = Date.now();
    for (const key in stored) {
      const entry = stored[key];
      if (entry && entry.data && now - entry.ts < TMDB_EXTRAS_CACHE_TTL) {
        tmdbExtrasCache[key] = entry.data;
      }
    }
  } catch (e) {}
})();

let _saveTmdbExtrasTimer = null;
function saveTmdbExtrasCache() {
  // Coalesce writes — many entries can arrive in quick succession.
  if (_saveTmdbExtrasTimer) return;
  _saveTmdbExtrasTimer = setTimeout(() => {
    _saveTmdbExtrasTimer = null;
    try {
      const wrapped = {};
      const ts = Date.now();
      for (const key in tmdbExtrasCache) {
        wrapped[key] = { data: tmdbExtrasCache[key], ts };
      }
      localStorage.setItem(TMDB_EXTRAS_CACHE_KEY, JSON.stringify(wrapped));
    } catch (e) {}
  }, 500);
}

// Throttle for TMDB extras requests — caps at 4 concurrent so we don't pummel
// the dev server / TMDB rate limits when the watchlist page loads ~65 rows.
function makeThrottle(maxConcurrent) {
  let active = 0;
  const queue = [];
  function tryRun() {
    while (active < maxConcurrent && queue.length > 0) {
      const { fn, resolve, reject } = queue.shift();
      active++;
      Promise.resolve().then(fn).then(resolve, reject).finally(() => {
        active--;
        tryRun();
      });
    }
  }
  return function throttle(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      tryRun();
    });
  };
}
const _tmdbExtrasThrottle = makeThrottle(4);
const _streamingThrottle = makeThrottle(2);

async function fetchTmdbExtras(title, year) {
  const cacheKey = `${title}::${year || ''}`;
  if (tmdbExtrasCache[cacheKey]) return tmdbExtrasCache[cacheKey];

  // Ensure poster search has run (populates tmdbIdCache)
  await fetchPoster(title, year);
  const info = getTmdbInfo(title, year);
  if (!info) return { trailerKey: null, providers: [], watchLink: null };

  return _tmdbExtrasThrottle(async () => {
    // Re-check cache inside throttle — another waiter may have populated it.
    if (tmdbExtrasCache[cacheKey]) return tmdbExtrasCache[cacheKey];
    try {
      const res = await fetch(`/api/tmdb-details?id=${info.tmdbId}&type=${info.mediaType}`);
      const data = await res.json();

      let trailerKey = null;
      if (data.videos && data.videos.results) {
        const trailer = data.videos.results.find(v =>
          v.type === 'Trailer' && v.site === 'YouTube'
        ) || data.videos.results.find(v => v.site === 'YouTube');
        if (trailer) trailerKey = trailer.key;
      }

      let providers = [];
      let watchLink = null;
      if (data['watch/providers'] && data['watch/providers'].results) {
        const us = data['watch/providers'].results.US;
        if (us) {
          watchLink = us.link || null;
          if (us.flatrate) {
            providers = us.flatrate.map(p => ({
              name: p.provider_name,
              logo: `https://image.tmdb.org/t/p/w45${p.logo_path}`
            }));
          }
        }
      }

      const result = { trailerKey, providers, watchLink };
      tmdbExtrasCache[cacheKey] = result;
      saveTmdbExtrasCache();
      persistExtrasToState(title, year, providers, trailerKey);
      return result;
    } catch (err) {
      console.warn('TMDB extras fetch failed:', err.message);
      return { trailerKey: null, providers: [], watchLink: null };
    }
  });
}

// ─── STREAMING AVAILABILITY (DIRECT LINKS) ──────────────────────────────────
const streamingCache = {};
const STREAMING_CACHE_KEY = 'flickpick_streaming_cache';
const STREAMING_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Load persistent cache from localStorage on startup
(function loadStreamingCache() {
  try {
    const stored = localStorage.getItem(STREAMING_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = Date.now();
      for (const key in parsed) {
        if (now - parsed[key].ts < STREAMING_CACHE_TTL) {
          streamingCache[key] = parsed[key];
        }
      }
    }
  } catch (e) {}
})();

function saveStreamingCache() {
  try { localStorage.setItem(STREAMING_CACHE_KEY, JSON.stringify(streamingCache)); } catch (e) {}
}

function checkStreamingBudget() {
  try {
    const stored = JSON.parse(localStorage.getItem('flickpick_streaming_budget') || '{}');
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (stored.month !== currentMonth) return { month: currentMonth, count: 0 };
    return stored;
  } catch (e) { return { month: new Date().toISOString().slice(0, 7), count: 0 }; }
}

function incrementStreamingBudget() {
  const budget = checkStreamingBudget();
  budget.count++;
  localStorage.setItem('flickpick_streaming_budget', JSON.stringify(budget));
}

async function fetchStreamingLinks(title, year) {
  const cacheKey = `${title}::${year || ''}`;
  if (streamingCache[cacheKey] && streamingCache[cacheKey].data) {
    return streamingCache[cacheKey].data;
  }

  // Check budget
  const budget = checkStreamingBudget();
  if (budget.count >= 900) {
    console.warn('Streaming API monthly budget nearly exhausted, skipping');
    return null;
  }

  await fetchPoster(title, year);
  const info = getTmdbInfo(title, year);
  if (!info) return null;

  return _streamingThrottle(async () => {
    // Re-check cache inside throttle — another waiter may have populated it.
    if (streamingCache[cacheKey] && streamingCache[cacheKey].data !== undefined) {
      return streamingCache[cacheKey].data;
    }
    try {
      const res = await fetch(`/api/streaming?tmdbId=${info.tmdbId}&type=${info.mediaType}`);
      if (!res.ok) return null;
      const data = await res.json();

      const options = data.streamingOptions?.us || [];
      if (options.length === 0) {
        streamingCache[cacheKey] = { data: null, ts: Date.now() };
        saveStreamingCache();
        return null;
      }

      const typePriority = { subscription: 0, free: 1, addon: 2, rent: 3, buy: 4 };
      const byService = {};
      for (const opt of options) {
        const sid = opt.service.id;
        if (!byService[sid] || (typePriority[opt.type] || 99) < (typePriority[byService[sid].type] || 99)) {
          byService[sid] = opt;
        }
      }

      const result = Object.values(byService).map(opt => ({
        serviceId: opt.service.id,
        serviceName: opt.service.name,
        type: opt.type,
        link: opt.link,
        logoUrl: opt.service.imageSet?.darkThemeImage || null
      }));

      streamingCache[cacheKey] = { data: result, ts: Date.now() };
      saveStreamingCache();
      incrementStreamingBudget();
      return result;
    } catch (err) {
      console.warn('Streaming Availability fetch failed:', err.message);
      return null;
    }
  });
}

// ─── PROVIDER RENDERING ─────────────────────────────────────────────────────
const PROVIDER_ALIASES = {
  'amazon prime video': 'prime',
  'disney plus': 'disney',
  'disney+': 'disney',
  'hbo max': 'max',
  'paramount+': 'paramount',
  'paramount plus': 'paramount',
  'apple tv+': 'apple',
  'apple tv plus': 'apple',
  'peacock premium': 'peacock',
};

function renderProviders(providers, watchLink, streamingLinks) {
  // Build lookup: normalized name/alias → direct link
  const directLinks = {};
  if (streamingLinks) {
    for (const s of streamingLinks) {
      directLinks[s.serviceName.toLowerCase()] = s.link;
      directLinks[s.serviceId.toLowerCase()] = s.link;
    }
  }

  function findDirectLink(providerName) {
    const name = providerName.toLowerCase();
    if (directLinks[name]) return directLinks[name];
    const alias = PROVIDER_ALIASES[name];
    if (alias && directLinks[alias]) return directLinks[alias];
    return null;
  }

  let html = '<div class="watch-providers"><span class="providers-label">Watch on</span>';

  providers.forEach(p => {
    const href = findDirectLink(p.name) || watchLink || null;
    if (href) {
      html += `<a href="${href}" target="_blank" rel="noopener" class="provider-link" title="${p.name}">`;
      html += `<img class="provider-logo" src="${p.logo}" alt="${p.name}">`;
      html += `</a>`;
    } else {
      html += `<img class="provider-logo" src="${p.logo}" alt="${p.name}" title="${p.name}">`;
    }
  });

  // Render streaming services not in TMDB's list
  if (streamingLinks) {
    const tmdbNames = new Set(providers.map(p => p.name.toLowerCase()));
    const tmdbAliases = new Set();
    providers.forEach(p => {
      const alias = PROVIDER_ALIASES[p.name.toLowerCase()];
      if (alias) tmdbAliases.add(alias);
    });
    for (const s of streamingLinks) {
      if (!tmdbNames.has(s.serviceName.toLowerCase()) && !tmdbAliases.has(s.serviceId) && s.logoUrl) {
        html += `<a href="${s.link}" target="_blank" rel="noopener" class="provider-link" title="${s.serviceName}">`;
        html += `<img class="provider-logo" src="${s.logoUrl}" alt="${s.serviceName}">`;
        html += `</a>`;
      }
    }
  }

  html += '</div>';
  return html;
}

// ─── TRAILER MODAL ──────────────────────────────────────────────────────────
// Single persistent Escape handler — avoids listener accumulation
function _trailerEscHandler(e) {
  if (e.key === 'Escape') closeTrailerModal();
}

function openTrailerModal(youtubeKey) {
  closeTrailerModal(); // clean up any existing modal first

  const modal = document.createElement('div');
  modal.id = 'trailer-modal';
  modal.className = 'trailer-modal';
  modal.innerHTML = `
    <div class="trailer-modal-backdrop"></div>
    <div class="trailer-modal-content">
      <button class="trailer-modal-close" data-action="close-trailer">&times;</button>
      <iframe src="https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0"
        frameborder="0" allowfullscreen
        allow="autoplay; encrypted-media; picture-in-picture">
      </iframe>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.trailer-modal-backdrop').addEventListener('click', closeTrailerModal);
  document.addEventListener('keydown', _trailerEscHandler);
}

function closeTrailerModal() {
  const modal = document.getElementById('trailer-modal');
  if (modal) modal.remove();
  document.removeEventListener('keydown', _trailerEscHandler);
}

function playTrailer(title, year, btn) {
  if (btn) btn.textContent = '⏳';
  fetchTmdbExtras(title, year).then(({ trailerKey }) => {
    if (trailerKey) {
      openTrailerModal(trailerKey);
    }
    if (btn) btn.textContent = '▶ Trailer';
  });
}

function loadFeaturedExtras(title, year) {
  Promise.all([
    fetchTmdbExtras(title, year),
    fetchStreamingLinks(title, year)
  ]).then(([{ trailerKey, providers, watchLink }, streamingLinks]) => {
    if (!trailerKey && providers.length === 0 && !streamingLinks) return;

    const actionsEl = document.querySelector('#featured-card .featured-actions');
    if (!actionsEl) return;

    let html = '<div class="featured-extras">';
    if (trailerKey) {
      html += `<button class="trailer-btn" data-action="open-trailer" data-key="${trailerKey}">&#9654; Watch Trailer</button>`;
    }
    if (providers.length > 0 || streamingLinks) {
      html += renderProviders(providers, watchLink, streamingLinks);
    }
    html += '</div>';

    actionsEl.insertAdjacentHTML('beforebegin', html);
  });
}

function getExclusionList() {
  const titles = State.getAllExcludedTitles();
  if (titles.size === 0) return '';
  const list = [...titles].map(t => `- ${t}`).join('\n');
  return `\n\nDo NOT include any of these titles (the user has already seen, rejected, or saved them):\n${list}`;
}

function getShownExclusion() {
  const titles = new Set();
  for (const id of shownIds) {
    const item = getStoredItem(id);
    if (item) titles.add(item.title);
  }
  for (const item of suggestionPool) {
    titles.add(item.title);
  }
  if (currentFeatured) titles.add(currentFeatured.title);
  if (titles.size === 0) return '';
  const list = [...titles].map(t => `- ${t}`).join('\n');
  return `\n\nAlso do NOT include these already-shown titles:\n${list}`;
}

function filterResults(items) {
  return State.filterOutKnown(items);
}

// ─── USER FILTER SETTINGS ───────────────────────────────────────────────────
// Curated list of TMDB provider names. The strings here MUST match TMDB's
// `provider_name` exactly so the matching filter compares like-for-like.
const CURATED_PROVIDERS = [
  'Netflix',
  'Hulu',
  'Disney Plus',
  'HBO Max',
  'Max',
  'Amazon Prime Video',
  'Apple TV Plus',
  'Paramount Plus',
  'Peacock',
  'Showtime',
  'Starz',
  'Crunchyroll',
];

function _settings() { return state.settings || {}; }

// Synchronous filter checks (year, language) — data already on the item, no
// network needed.
function passesSyncFilters(item) {
  const s = _settings();

  if (s.ageLimit && item.year) {
    const yr = parseInt(item.year, 10);
    if (!isNaN(yr)) {
      const cutoff = new Date().getFullYear() - s.ageLimit + 1;
      if (yr < cutoff) return false;
    }
  }

  if (s.englishOnly) {
    const lang = (item.language || '').toLowerCase();
    if (lang && lang !== 'en') return false;
    // If language is missing, give the benefit of the doubt — passes the sync
    // gate. The async pass won't recheck (language is sync-only), so unknown-
    // language items stay visible. Acceptable trade-off.
  }

  return true;
}

// Async filter checks (providers, trailer). Reads from item-level persisted
// data first (sync, instant on reload), falls back to in-memory extras cache,
// and finally returns true ("innocent until proven guilty") if we have no
// data yet — kickAsyncFilterCheck removes those items once the data lands.
function passesAsyncFilters(item) {
  const s = _settings();
  if (!s.hideNoProviders && !s.hideNoTrailer && !(s.onlyMyProviders && s.myProviders.length)) {
    return true;
  }

  const providers = getItemProviders(item);
  const hasTrailer = getItemHasTrailer(item);
  if (providers === null || hasTrailer === null) return true; // unknown — innocent

  if (s.hideNoTrailer && !hasTrailer) return false;
  if (s.hideNoProviders && providers.length === 0) return false;
  if (s.onlyMyProviders && s.myProviders && s.myProviders.length > 0) {
    const have = new Set(providers);
    if (!s.myProviders.some(name => have.has(name))) return false;
  }
  return true;
}

function passesFilters(item) {
  return passesSyncFilters(item) && passesAsyncFilters(item);
}

// True if any async filter is enabled; when this is true we should kick the
// extras fetch to enable the second-pass check.
function anyAsyncFilterActive() {
  const s = _settings();
  return s.hideNoProviders || s.hideNoTrailer || (s.onlyMyProviders && s.myProviders && s.myProviders.length > 0);
}

// Watchlist-only filter: only the "can I actually watch this right now?"
// settings — provider availability and provider-match. Age, language, and
// trailer filters are discovery-time only; they shouldn't hide items the user
// has deliberately saved.
function passesWatchlistFilters(item) {
  const s = _settings();
  const wantsProviderCheck = s.hideNoProviders || (s.onlyMyProviders && s.myProviders && s.myProviders.length > 0);
  if (!wantsProviderCheck) return true;
  const providers = getItemProviders(item);
  if (providers === null) return true; // unknown — innocent until proven guilty
  if (s.hideNoProviders && providers.length === 0) return false;
  if (s.onlyMyProviders && s.myProviders && s.myProviders.length > 0) {
    const have = new Set(providers);
    if (!s.myProviders.some(name => have.has(name))) return false;
  }
  return true;
}

function anyWatchlistFilterActive() {
  const s = _settings();
  return s.hideNoProviders || (s.onlyMyProviders && s.myProviders && s.myProviders.length > 0);
}

// Lazy-then-hide kick scoped to watchlist surfaces — only fires when a
// watchlist-relevant filter is active.
function kickWatchlistFilterCheck(item, surfaceCallback) {
  if (!anyWatchlistFilterActive()) return;
  const cacheKey = `${item.title}::${item.year || ''}`;
  if (tmdbExtrasCache[cacheKey]) return;
  fetchTmdbExtras(item.title, item.year).then(() => {
    if (!passesWatchlistFilters(item) && typeof surfaceCallback === 'function') {
      surfaceCallback();
    }
  });
}

// Debounce wrappers — when many extras resolve in quick succession (typical
// on first watchlist load), we'd otherwise re-render the whole list once per
// resolution and the user sees aggressive flicker. Coalesce to one render
// per ~300ms.
function _debounce(fn, ms) {
  let timer = null;
  return function debounced() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(); }, ms);
  };
}
const debouncedFilterWatchlist = _debounce(() => {
  // Only re-render if the watchlist page is actually visible.
  if (document.getElementById('page-watchlist')?.classList.contains('active')) {
    filterWatchlist();
  }
}, 300);
const debouncedRenderWatchlistCarousel = _debounce(() => {
  const section = document.getElementById('watchlist-carousel');
  if (section && section.style.display !== 'none') {
    renderWatchlistCarousel();
  }
}, 300);

// Per-recs-carousel debouncer (each key keeps its own timer).
const _recsDebouncers = {};
function debouncedDisplayRecsCarousel(key) {
  if (!_recsDebouncers[key]) {
    _recsDebouncers[key] = _debounce(() => displayRecsCarousel(key), 300);
  }
  _recsDebouncers[key]();
}
const debouncedDisplaySuggestionPage = _debounce(() => {
  if (currentFeatured && document.getElementById('featured-section')?.style.display !== 'none') {
    displaySuggestionPage(suggestionPageIdx || 0);
  }
}, 300);
const debouncedRenderChooser = _debounce(() => {
  if (document.getElementById('search-chooser-section')?.style.display !== 'none') {
    renderChooser();
  }
}, 300);

// Lazy-then-hide: when an async filter is on, kick the TMDB extras fetch for
// each rendered candidate. Once it resolves, re-evaluate the filter; if the
// item now fails, surfaceCallback re-renders the surface to drop it.
// Already-cached items resolve synchronously (no second render needed).
function kickAsyncFilterCheck(item, surfaceCallback) {
  if (!anyAsyncFilterActive()) return;
  const cacheKey = `${item.title}::${item.year || ''}`;
  // If extras were already cached when we first ran passesAsyncFilters, the
  // item already either passed or got filtered before reaching here. No need
  // to re-fetch.
  if (tmdbExtrasCache[cacheKey]) return;
  fetchTmdbExtras(item.title, item.year).then(() => {
    if (!passesAsyncFilters(item) && typeof surfaceCallback === 'function') {
      surfaceCallback();
    }
  });
}

// Re-render visible discovery surfaces in place — used when filters change so
// pools get re-evaluated against the new settings without re-fetching.
function refreshDiscoverFilters() {
  // Recs carousels (discover page)
  for (const key of Object.keys(recsCarousels)) {
    if (document.getElementById(_recs(key).sectionId)?.style.display !== 'none') {
      displayRecsCarousel(key);
    }
  }
  // Watchlist carousel (discover page) — provider filters apply here too.
  const wlSection = document.getElementById('watchlist-carousel');
  if (wlSection && wlSection.style.display !== 'none') {
    renderWatchlistCarousel();
  }
  // Similar grid (a featured card is showing)
  if (currentFeatured && document.getElementById('featured-section')?.style.display !== 'none') {
    displaySuggestionPage(suggestionPageIdx || 0);
  }
  // Chooser (a search is open)
  if (document.getElementById('search-chooser-section')?.style.display !== 'none') {
    renderChooser();
  }
  // Watchlist page (full list view) — only re-render if it's the active page.
  if (document.getElementById('page-watchlist')?.classList.contains('active')) {
    filterWatchlist();
  }
}

// ─── DISCOVER CAROUSELS ─────────────────────────────────────────────────────
const CAROUSEL_PAGE = 4;
const CAROUSEL_PAGE_MOBILE = 3;
const carouselState = {
  watchlist: { page: 0 },
  loved: { page: 0, items: [] },
  'wl-recs': { page: 0, items: [] },
};

// Recommendation-carousel constants — shared across all instances.
const RECS_MAX_CONCURRENT = 3;          // max simultaneous Claude calls
const RECS_TARGET_POOL = 20;            // keep this many available items in the pool
const RECS_MAX_CONSECUTIVE_FAILS = 5;   // give up the Claude pump after this many null returns in a row
const RECS_TMDB_QUERY_COUNT = 12;       // max seed items to query TMDB recs for
const RECS_TMDB_RECS_PER_ITEM = 20;     // TMDB returns up to this many recs per seed item

// Each entry drives one TMDB-seeded / Claude-fallback recommendation row on
// the discover page. Add a new key here + a matching <div class="carousel-section">
// in index.html and you've got a new "Based On Your X" row.
const recsCarousels = {
  loved: {
    label: 'Based On What You Love',
    sectionId: 'loved-carousel',
    trackId: 'loved-car-track',
    prevId: 'loved-car-prev',
    nextId: 'loved-car-next',
    getSeedItems: () => Object.values(state.seen).filter(i => i.rating === 'loved'),
    claudeContextLabel: 'loved',
    emptyHTML: `<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text-muted)">
      <div style="font-size:1.5rem;margin-bottom:8px">❤️</div>
      <div>Rate shows in your <strong>Seen</strong> list with ❤️ to get personalized recommendations here.</div>
    </div>`,
    exhaustedMessage: 'No more fresh recommendations — rate more shows in your Seen list to get new picks here.',
    state: { cache: null, pool: [], tmdbQueue: [], inFlight: 0, allFetchedIds: new Set(), consecutiveFails: 0 },
  },
  'wl-recs': {
    label: 'Based On Your Watchlist',
    sectionId: 'wl-recs-carousel',
    trackId: 'wl-recs-car-track',
    prevId: 'wl-recs-car-prev',
    nextId: 'wl-recs-car-next',
    getSeedItems: () => Object.values(state.want),
    claudeContextLabel: 'wants to watch',
    emptyHTML: `<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text-muted)">
      <div style="font-size:1.5rem;margin-bottom:8px">★</div>
      <div>Add shows to your <strong>Watchlist</strong> to get recommendations here.</div>
    </div>`,
    exhaustedMessage: 'No more fresh recommendations — add more shows to your Watchlist for new picks here.',
    state: { cache: null, pool: [], tmdbQueue: [], inFlight: 0, allFetchedIds: new Set(), consecutiveFails: 0 },
  },
};

function _recs(key) { return recsCarousels[key]; }

function getCarouselPageSize() {
  return window.innerWidth <= 600 ? CAROUSEL_PAGE_MOBILE : CAROUSEL_PAGE;
}

function renderCarouselItem(item, showActions) {
  registerItem(item);
  const emoji = item.emoji || genreEmoji(item.genres || '');
  const safeTitle = item.title.replace(/"/g, '&quot;');

  let actionsHtml = '';
  if (showActions && item.id) {
    const seenActive = state.seen[item.id] ? 'active' : '';
    const wantActive = state.want[item.id] ? 'active' : '';
    const nopeActive = state.nope[item.id] ? 'active' : '';
    actionsHtml = `
      <div class="carousel-item-trailer" data-trailer-id="${item.id}" style="display:none">
        <button class="mini-trailer-btn" data-action="play-trailer" data-id="${item.id}">&#9654; Trailer</button>
      </div>
      <div class="carousel-item-actions">
        <button class="mini-btn mini-seen ${seenActive}" data-action="toggle-seen" data-id="${item.id}">
          Seen
        </button>
        <button class="mini-btn mini-want ${wantActive}" data-action="toggle-want" data-id="${item.id}">
          ${state.want[item.id] ? '★' : 'Want'}
        </button>
        <button class="mini-btn mini-nope ${nopeActive}" data-action="toggle-nope" data-id="${item.id}">
          ${state.nope[item.id] ? '✕' : 'Nope'}
        </button>
      </div>`;
  }

  // Rating sits inline after the title in parens "(87%)". Filled async by
  // loadRatingFor; if no rating ever arrives, the empty span collapses (display:none).
  const cachedRating = getCachedRating(item.title, item.year);
  const initialRatingHtml = shouldShowRating(cachedRating)
    ? `<span class="rating rating--titled rating--${ratingTier(cachedRating.rating)}" data-rating-id="${item.id}">(${cachedRating.rating}%)</span>`
    : `<span class="rating rating--titled" data-rating-id="${item.id}"></span>`;

  return `
    <div class="carousel-item" data-action="load-item-direct" data-id="${item.id}">
      <div class="carousel-item-placeholder" data-car-poster="${item.id || item.title}">
        ${emoji}
      </div>
      <div class="carousel-item-title" title="${safeTitle}">
        <span class="carousel-item-name">${item.title}</span>
        ${initialRatingHtml}
      </div>
      ${actionsHtml}
    </div>`;
}

function retryPosterLoad(img, title, year, retries) {
  if (retries <= 0) return;
  img.onerror = () => {
    // Clear cache so fetchPoster re-fetches from TMDB
    delete posterCache[`${title}::${year || ''}`];
    setTimeout(() => {
      fetchPoster(title, year).then(url => {
        if (url) { img.onerror = null; img.src = url; }
      });
    }, 2000);
  };
}

function loadCarouselPoster(item, selector) {
  fetchPoster(item.title, item.year).then(url => {
    // Fill rating slot now that fetchPoster has populated ratingCache as a side effect.
    // Carousel uses parens "(87%)" inline with title.
    if (item.id) loadRatingFor(item.id, item.title, item.year, { withParens: true });
    if (!url) return;
    const el = document.querySelector(`[data-car-poster="${item.id || item.title}"]`);
    if (!el) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = item.title;
    img.className = 'carousel-item-poster';
    retryPosterLoad(img, item.title, item.year, 2);
    img.onload = () => {
      // Guard: element may have been removed by re-render during fetch
      if (el.parentNode) el.replaceWith(img);
    };
  });
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderWatchlistCarousel() {
  const allItems = Object.values(state.want);
  const section = document.getElementById('watchlist-carousel');
  if (allItems.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';

  // Re-shuffle when the watchlist changes. The shuffle stays stable across
  // re-renders so paging back and forth doesn't reorder cards under the user.
  const wantKey = Object.keys(state.want).sort().join(',');
  if (!carouselState.watchlist.shuffled || carouselState.watchlist.wantKey !== wantKey) {
    carouselState.watchlist.shuffled = shuffleArray(allItems);
    carouselState.watchlist.wantKey = wantKey;
    carouselState.watchlist.page = 0;
  }

  // Apply provider filters at display time so changes to settings update the
  // carousel without invalidating the underlying shuffle order.
  const visible = carouselState.watchlist.shuffled.filter(passesWatchlistFilters);
  if (visible.length === 0) {
    section.style.display = 'none';
    return;
  }

  const pageSize = getCarouselPageSize();
  const s = carouselState.watchlist;
  // Clamp page in case the visible count shrank (filter just turned on).
  const lastPage = Math.max(0, Math.ceil(visible.length / pageSize) - 1);
  if (s.page > lastPage) s.page = lastPage;
  const start = s.page * pageSize;
  const batch = visible.slice(start, start + pageSize);
  const track = document.getElementById('wl-car-track');
  track.style.gridTemplateColumns = `repeat(${pageSize}, 1fr)`;
  track.innerHTML = batch.map(item => renderCarouselItem(item)).join('');
  batch.forEach(item => {
    loadCarouselPoster(item);
    // Lazy-then-hide: when extras resolve, if the item now fails the filter,
    // schedule a debounced carousel re-render so multiple resolutions coalesce.
    kickWatchlistFilterCheck(item, debouncedRenderWatchlistCarousel);
  });

  document.getElementById('wl-car-prev').disabled = s.page === 0;
  document.getElementById('wl-car-next').disabled = start + pageSize >= visible.length;
}

// Fetch a single recommendation — fast (~1s) since Claude only generates one item
// One Claude call asking for ONE recommendation given the carousel's seed
// items. Excludes everything in the user's library + already-fetched items so
// we don't loop forever proposing the same titles.
async function fetchOneRec(key) {
  const cfg = _recs(key);
  const seedItems = cfg.getSeedItems();
  if (seedItems.length === 0) return null;

  const titles = seedItems.map(i => `"${i.title}" (${i.type}, ${i.year})`).join(', ');

  const excludeTitles = new Set();
  for (const item of Object.values(state.seen)) excludeTitles.add(item.title);
  for (const item of Object.values(state.want)) excludeTitles.add(item.title);
  for (const item of Object.values(state.nope)) excludeTitles.add(item.title);
  for (const item of cfg.state.pool) excludeTitles.add(item.title);

  const excludeStr = excludeTitles.size > 0
    ? `\nDo NOT include any of these titles:\n${[...excludeTitles].map(t => `- ${t}`).join('\n')}`
    : '';

  const prompt = `You are a film and TV expert. The user ${cfg.claudeContextLabel}: ${titles}
Recommend ONE show they'd enjoy. Return ONLY valid JSON, no markdown:
{"title":"Title","type":"TV Show or Movie","year":"2022","genres":"Comedy, Drama","emoji":"🎭","description":"Factual one-sentence synopsis.","blurb":"Why they'd enjoy this."}
Real titles only. Description must be factual, not a recommendation.${excludeStr}`;

  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    if (!data.content || !data.content[0]) throw new Error('Bad response');
    const item = normalizeItem(parseClaudeJSON(data.content[0].text));

    // Dedupe — discard if we already have it
    if (cfg.state.allFetchedIds.has(item.id) || State.isKnown(item.id)) {
      return null;
    }
    cfg.state.allFetchedIds.add(item.id);
    return item;
  } catch(e) {
    console.error(`${key} rec fetch error:`, e);
    return null;
  }
}

// Round-robin merge candidates from each seed item's recommendations so the
// carousel doesn't get dominated by recs from a single show.
function _roundRobinMergeRecs(perItemRecs) {
  const seen = new Set();
  const merged = [];
  let added = true;
  for (let idx = 0; added; idx++) {
    added = false;
    for (const recs of perItemRecs) {
      if (!recs || idx >= recs.length) continue;
      const item = recs[idx];
      if (seen.has(item.id) || State.isKnown(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
      added = true;
    }
  }
  return merged;
}

// Seed the carousel pool from BOTH TMDB /recommendations (collaborative-filtered)
// and TMDB /similar (genre/keyword-based). Different signals → broader pool.
// Fast (~1-2s), no Claude tokens.
async function seedRecsFromTmdb(key) {
  const cfg = _recs(key);
  const seedItems = cfg.getSeedItems()
    .slice() // don't mutate caller's array
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, RECS_TMDB_QUERY_COUNT);
  if (seedItems.length === 0) return [];

  const recCalls = seedItems.map(item =>
    fetchTmdbRecommendations(item, RECS_TMDB_RECS_PER_ITEM, 'recommendations').catch(() => null)
  );
  const simCalls = seedItems.map(item =>
    fetchTmdbRecommendations(item, RECS_TMDB_RECS_PER_ITEM, 'similar').catch(() => null)
  );
  const perItemRecs = await Promise.all([...recCalls, ...simCalls]);
  return _roundRobinMergeRecs(perItemRecs);
}

// Drain ALL TMDB queue items into the visible pool, replacing loading
// placeholders in-place. Cheap — no API calls. The pool grows as deep as the
// queue allows so the user can paginate freely; the Claude pump only fires
// when the pool drops below RECS_TARGET_POOL after tagging.
function drainRecsQueueIntoPool(key) {
  const cfg = _recs(key);
  const track = document.getElementById(cfg.trackId);
  while (cfg.state.tmdbQueue.length > 0) {
    const next = cfg.state.tmdbQueue.shift();
    if (!next || !next.id) continue;
    if (State.isKnown(next.id) || cfg.state.allFetchedIds.has(next.id)) continue;
    cfg.state.allFetchedIds.add(next.id);
    cfg.state.pool.push(next);
    const ph = track && track.querySelector('.carousel-item-loading');
    if (ph) {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderCarouselItem(next, true);
      ph.replaceWith(tmp.firstElementChild);
      loadCarouselPoster(next);
      loadTrailerBtnFor(next.id, next.title, next.year);
    }
  }
}

// Pump: drains TMDB queue first (instant), then falls back to Claude calls (slow)
// only if more items are still needed.
function recsPump(key) {
  const cfg = _recs(key);
  drainRecsQueueIntoPool(key);
  updateRecsNav(key);

  const available = getAvailableRecsItems(key);
  const needed = RECS_TARGET_POOL - available.length - cfg.state.inFlight;
  if (needed <= 0) return;
  if (cfg.state.consecutiveFails >= RECS_MAX_CONSECUTIVE_FAILS) {
    // Claude keeps proposing items already in the user's library — stop pumping
    // and clean up any remaining placeholder cards so the carousel doesn't spin forever.
    cleanRecsPlaceholders(key);
    return;
  }

  const toFire = Math.min(needed, RECS_MAX_CONCURRENT - cfg.state.inFlight);
  for (let i = 0; i < toFire; i++) {
    cfg.state.inFlight++;
    fetchOneRec(key).then(item => {
      cfg.state.inFlight--;
      if (item) {
        cfg.state.consecutiveFails = 0;
        cfg.state.pool.push(item);
        const track = document.getElementById(cfg.trackId);
        const ph = track && track.querySelector('.carousel-item-loading');
        if (ph) {
          const tmp = document.createElement('div');
          tmp.innerHTML = renderCarouselItem(item, true);
          ph.replaceWith(tmp.firstElementChild);
          loadCarouselPoster(item);
          loadTrailerBtnFor(item.id, item.title, item.year);
        }
      } else {
        cfg.state.consecutiveFails++;
      }
      updateRecsNav(key);
      recsPump(key);
    });
  }
}

function cleanRecsPlaceholders(key) {
  const cfg = _recs(key);
  const track = document.getElementById(cfg.trackId);
  if (!track) return;
  track.querySelectorAll('.carousel-item-loading').forEach(ph => ph.remove());
  if (track.children.length === 0) {
    track.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--muted);font-size:13px">${cfg.exhaustedMessage}</div>`;
  }
}

function getAvailableRecsItems(key) {
  return _recs(key).state.pool.filter(i => !State.isKnown(i.id) && passesFilters(i));
}

async function renderRecsCarousel(key) {
  const cfg = _recs(key);
  const seedItems = cfg.getSeedItems();
  const section = document.getElementById(cfg.sectionId);
  if (!section) return;

  if (seedItems.length === 0) {
    section.style.display = '';
    document.getElementById(cfg.trackId).innerHTML = cfg.emptyHTML;
    updateRecsNav(key);
    return;
  }
  section.style.display = '';

  // If seed list unchanged and we already have pool items, just re-render
  const seedKey = seedItems.map(i => i.id).sort().join(',');
  if (cfg.state.cache && cfg.state.cache.key === seedKey && cfg.state.pool.length > 0) {
    displayRecsCarousel(key);
    recsPump(key);
    return;
  }

  // Reset for new seed list
  cfg.state.cache = { key: seedKey };
  cfg.state.pool = [];
  cfg.state.tmdbQueue = [];
  cfg.state.allFetchedIds = new Set();
  cfg.state.inFlight = 0;
  cfg.state.consecutiveFails = 0;
  carouselState[key].page = 0;

  // Show loading placeholders while we seed
  const track = document.getElementById(cfg.trackId);
  const cols = getCarouselPageSize();
  track.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const placeholder = `<div class="carousel-item carousel-item-loading"><div class="carousel-item-placeholder"><div class="loading-spinner" style="width:24px;height:24px;margin:0 auto"></div></div><div class="carousel-item-title" style="color:var(--text-muted)">Loading...</div></div>`;
  track.innerHTML = Array(cols).fill(placeholder).join('');
  updateRecsNav(key);

  // Seed from TMDB first (fast, no Claude tokens). Stale-result guard: if the
  // user toggles a seed item while we're seeding, abandon this seed.
  const startKey = seedKey;
  seedRecsFromTmdb(key).then(seeded => {
    if (!cfg.state.cache || cfg.state.cache.key !== startKey) return;
    cfg.state.tmdbQueue = seeded;
    recsPump(key);
  }).catch(err => {
    if (!cfg.state.cache || cfg.state.cache.key !== startKey) return;
    console.warn(`TMDB ${key} seed failed:`, err && err.message);
    recsPump(key);
  });
}

function displayRecsCarousel(key) {
  const cfg = _recs(key);
  const available = getAvailableRecsItems(key);
  const cols = getCarouselPageSize();
  const track = document.getElementById(cfg.trackId);
  if (!track) return;
  track.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const s = carouselState[key];
  const start = s.page * cols;
  const batch = available.slice(start, start + cols);

  const placeholder = `<div class="carousel-item carousel-item-loading"><div class="carousel-item-placeholder"><div class="loading-spinner" style="width:24px;height:24px;margin:0 auto"></div></div><div class="carousel-item-title" style="color:var(--text-muted)">Loading...</div></div>`;

  const hasSeed = cfg.getSeedItems().length > 0;
  let html = '';
  for (let i = 0; i < cols; i++) {
    if (batch[i]) {
      html += renderCarouselItem(batch[i], true);
    } else if (cfg.state.inFlight > 0 || hasSeed) {
      html += placeholder;
    }
  }
  if (!html && available.length === 0 && cfg.state.inFlight === 0 && !hasSeed && cfg.state.pool.length > 0) {
    html = `<div style="grid-column:1/-1;text-align:center;padding:24px 16px;color:var(--text-muted)">No more recommendations available.</div>`;
  }

  track.innerHTML = html;
  batch.forEach(item => {
    loadCarouselPoster(item);
    loadTrailerBtnFor(item.id, item.title, item.year);
    kickAsyncFilterCheck(item, () => debouncedDisplayRecsCarousel(key));
  });
  updateRecsNav(key);
}

function updateRecsNav(key) {
  const cfg = _recs(key);
  const available = getAvailableRecsItems(key);
  const cols = getCarouselPageSize();
  const s = carouselState[key];
  const prevBtn = document.getElementById(cfg.prevId);
  const nextBtn = document.getElementById(cfg.nextId);
  if (prevBtn) prevBtn.disabled = s.page === 0;
  if (nextBtn) nextBtn.disabled = (s.page + 1) * cols >= available.length;
}

// Triggered when the user toggles Seen/Want/Nope on a recs-carousel card.
// The item already moved into state.* so getAvailableRecsItems filters it out.
// Pump tops up; redisplay shows the next item.
function replaceRecsCard(key) {
  recsPump(key);
  displayRecsCarousel(key);
}

// Resolve which recs carousel a card belongs to (looks up by track ID ancestor).
// Returns the key or null if it isn't in any recs carousel.
function findRecsKeyForCard(cardEl) {
  for (const [key, cfg] of Object.entries(recsCarousels)) {
    if (cardEl.closest(`#${cfg.trackId}`)) return key;
  }
  return null;
}

function carouselPrev(type) {
  carouselState[type].page = Math.max(0, carouselState[type].page - 1);
  if (type === 'watchlist') renderWatchlistCarousel();
  else if (recsCarousels[type]) displayRecsCarousel(type);
}

function carouselNext(type) {
  carouselState[type].page++;
  if (type === 'watchlist') renderWatchlistCarousel();
  else if (recsCarousels[type]) {
    displayRecsCarousel(type);
    recsPump(type); // top up pool as user pages forward
  }
}

function initDiscoverCarousels() {
  renderWatchlistCarousel();
  for (const key of Object.keys(recsCarousels)) {
    renderRecsCarousel(key);
  }
}


// ─── SETTINGS / IMPORT / EXPORT ─────────────────────────────────────────────
function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state: state
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flickpick-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported!');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      const imported = data.state || data;
      if (!imported.seen && !imported.want && !imported.nope) {
        showToast('Invalid backup file');
        return;
      }
      State.importData(imported);
      showToast(`Imported ${Object.keys(imported.seen || {}).length} seen, ${Object.keys(imported.want || {}).length} watchlist items`);
      refreshCurrentPage();
    } catch(err) {
      showToast('Failed to read backup file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function refreshCurrentPage() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  if (activePage.id === 'page-seen') renderSeenList();
  else if (activePage.id === 'page-watchlist') renderWatchlist();
  else initDiscoverCarousels();
}

// ─── CLOUD SYNC (Vercel Blob) ───────────────────────────────────────────────
const SYNC_CODE_KEY = 'flickpick_sync_code';

function setSyncStatus(msg, kind) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.remove('success', 'error');
  if (kind) el.classList.add(kind);
}

function readSyncCode() {
  const input = document.getElementById('sync-code-input');
  const raw = (input && input.value || '').trim().toLowerCase();
  if (!raw) {
    setSyncStatus('Enter a sync code first', 'error');
    return null;
  }
  if (!/^[a-z0-9_\-]{2,40}$/.test(raw)) {
    setSyncStatus('Code: 2–40 letters, numbers, _ or -', 'error');
    return null;
  }
  localStorage.setItem(SYNC_CODE_KEY, raw);
  return raw;
}

async function readErrorMessage(res, fallback) {
  try {
    const data = await res.json();
    return data.error || data.details || fallback;
  } catch {
    return fallback;
  }
}

// Two-way sync: pull cloud state, smart-merge into local, push merged result
// back up. Works the same regardless of which device clicks first — the cloud
// always ends up with the union of all devices' data.
async function cloudSync() {
  const code = readSyncCode();
  if (!code) return;
  setSyncStatus('Syncing…');
  try {
    // 1. Pull remote and merge into local
    const getRes = await fetch(`/api/sync?code=${encodeURIComponent(code)}`);
    if (!getRes.ok) {
      const msg = await readErrorMessage(getRes, `Sync failed (${getRes.status})`);
      console.error('Sync read failed:', getRes.status, msg);
      setSyncStatus(msg, 'error');
      return;
    }
    const data = await getRes.json();
    if (data.state) {
      State.importData(data.state);
      refreshCurrentPage();
    }

    // 2. Push merged local state back up
    const putRes = await fetch('/api/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
    if (!putRes.ok) {
      const msg = await readErrorMessage(putRes, `Sync failed (${putRes.status})`);
      console.error('Sync write failed:', putRes.status, msg);
      setSyncStatus(msg, 'error');
      return;
    }

    const total = Object.keys(state.seen).length
                + Object.keys(state.want).length
                + Object.keys(state.nope).length;
    setSyncStatus(`Synced ${total} items ✓`, 'success');
  } catch (err) {
    console.error('Sync network error:', err);
    setSyncStatus('Sync failed (network)', 'error');
  }
}

async function initVersionFooter() {
  const el = document.getElementById('settings-version');
  if (!el) return;
  const baseText = el.textContent;
  try {
    const res = await fetch('/api/version');
    if (!res.ok) return;
    const data = await res.json();
    if (data.sha) {
      el.textContent = `${baseText} · ${data.sha}${data.env && data.env !== 'production' ? ` (${data.env})` : ''}`;
    }
  } catch {
    // Offline / dev server without endpoint — leave the base text alone.
  }
}

function initSyncCodeInput() {
  const input = document.getElementById('sync-code-input');
  if (!input) return;
  const saved = localStorage.getItem(SYNC_CODE_KEY);
  if (saved) {
    input.value = saved;
    // Auto-sync on page load so other devices' changes show up without a click.
    // Slight delay so initial render finishes first; failures are silent (status
    // line just shows the error if the user opens the menu).
    setTimeout(() => cloudSync(), 600);
  }
}

function updateWantCount() {
  const count = Object.keys(state.want).length;
  const el = document.getElementById('want-count');
  el.textContent = `(${count})`;
  el.classList.toggle('visible', count > 0);
}

function updateSeenCount() {
  const count = Object.keys(state.seen).length;
  const el = document.getElementById('seen-count');
  el.textContent = `(${count})`;
  el.classList.toggle('visible', count > 0);
}

State.load();
updateWantCount();
updateSeenCount();
initDiscoverCarousels();
initSyncCodeInput();
initVersionFooter();

// ─── NAV ──────────────────────────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (page === 'watchlist') renderWatchlist();
  if (page === 'seen') renderSeenList();
  if (page === 'settings') renderSettingsPage();
}

// ─── SETTINGS PAGE ─────────────────────────────────────────────────────────
function renderSettingsPage() {
  const s = state.settings || {};

  // Filter controls — sync values from state.
  const ageEl = document.getElementById('setting-age-limit');
  if (ageEl) ageEl.value = s.ageLimit == null ? '' : String(s.ageLimit);

  for (const key of ['englishOnly', 'hideNoProviders', 'hideNoTrailer', 'onlyMyProviders']) {
    const el = document.querySelector(`[data-action="toggle-setting"][data-key="${key}"]`);
    if (el) el.checked = !!s[key];
  }

  // Provider chip grid.
  const grid = document.getElementById('provider-grid');
  if (grid) {
    const selected = new Set(s.myProviders || []);
    grid.innerHTML = CURATED_PROVIDERS.map(name => {
      const cls = selected.has(name) ? 'provider-chip selected' : 'provider-chip';
      const safe = name.replace(/"/g, '&quot;');
      return `<div class="${cls}" data-action="toggle-provider" data-provider="${safe}">${name}</div>`;
    }).join('');
  }
}

function handleToggleSetting(key, checked) {
  State.updateSettings({ [key]: !!checked });
  refreshDiscoverFilters();
}

function handleSetAgeLimit(value) {
  const n = value === '' ? null : parseInt(value, 10);
  State.updateSettings({ ageLimit: isNaN(n) ? null : n });
  refreshDiscoverFilters();
}

function handleToggleProvider(name) {
  const current = new Set(state.settings?.myProviders || []);
  if (current.has(name)) current.delete(name);
  else current.add(name);
  State.updateSettings({ myProviders: [...current] });
  // Re-render the grid in place to flip the .selected class without a full
  // page repaint.
  renderSettingsPage();
  refreshDiscoverFilters();
}

function resetDiscover() {
  showPage('discover');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn').classList.add('active');
  document.getElementById('search-input').value = '';
  document.getElementById('featured-section').style.display = 'none';
  document.getElementById('search-chooser-section').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('discover-carousels').style.display = '';
  viewHistory.length = 0;
  currentFeatured = null;
  currentMultiSearch = null;
  resetChooserState();
  initDiscoverCarousels();
}

// ─── SEARCH FOR SHOW (from Seen/Watchlist) ──────────────────────────────────
function searchForShow(title) {
  showPage('discover');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn').classList.add('active'); // first nav-btn = Discover
  document.getElementById('search-input').value = title;
  doSearch();
}

// ─── CENTRAL EVENT DELEGATION ─────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;
  const id = el.dataset.id;

  switch (action) {
    // ─── NAV ─────────────────────────────────────────────────────────
    case 'reset-discover':
      resetDiscover();
      break;
    case 'show-page':
      showPage(el.dataset.page);
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      break;

    // ─── SETTINGS ────────────────────────────────────────────────────
    case 'export-data':
      exportData();
      break;
    case 'import-click':
      document.getElementById('import-file').click();
      break;
    case 'cloud-sync':
      cloudSync();
      break;
    case 'toggle-provider':
      handleToggleProvider(el.dataset.provider);
      break;

    // ─── SEARCH ──────────────────────────────────────────────────────
    case 'do-search':
      doSearch();
      break;
    case 'chooser-prev':
      chooserPrev(el.dataset.bucket);
      break;
    case 'chooser-next':
      chooserNext(el.dataset.bucket);
      break;

    // ─── CAROUSELS ───────────────────────────────────────────────────
    case 'carousel-prev':
      carouselPrev(el.dataset.type);
      break;
    case 'carousel-next':
      carouselNext(el.dataset.type);
      break;

    // ─── SIMILAR GRID NAV ────────────────────────────────────────────
    case 'similar-prev':
      similarPrev();
      break;
    case 'similar-next':
      similarNext();
      break;
    case 'go-back':
      goBack();
      break;

    // ─── ITEM NAVIGATION ─────────────────────────────────────────────
    case 'load-item':
      loadItem(id);
      break;
    case 'load-item-direct': {
      const item = getStoredItem(id);
      if (item) {
        // If from watchlist carousel, go to watchlist page
        if (el.closest('#wl-car-track')) {
          showPage('watchlist');
          document.getElementById('watchlist-nav-btn').classList.add('active');
          setTimeout(() => {
            const card = document.getElementById('wl-' + item.id);
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        } else {
          loadItemDirect(item);
        }
      }
      break;
    }

    // ─── TOGGLE ACTIONS ──────────────────────────────────────────────
    case 'toggle-seen':
      toggleSeen(id, el);
      break;
    case 'toggle-want':
      toggleWant(id, el);
      break;
    case 'toggle-nope':
      toggleNope(id, el);
      break;

    // ─── RATING ──────────────────────────────────────────────────────
    case 'set-rating':
      setRating(id, el.dataset.rating, el);
      break;

    // ─── REMOVE ──────────────────────────────────────────────────────
    case 'remove-want':
      removeFromWant(id);
      break;
    case 'remove-seen':
      removeFromSeen(id);
      break;

    // ─── TRAILERS ────────────────────────────────────────────────────
    case 'open-trailer':
      openTrailerModal(el.dataset.key);
      break;
    case 'close-trailer':
      closeTrailerModal();
      break;
    case 'play-trailer': {
      const item = getStoredItem(id);
      if (item) {
        el.textContent = '⏳';
        playTrailer(item.title, item.year, el);
      }
      break;
    }

    // ─── LOAD MORE ───────────────────────────────────────────────────
    case 'load-more-watchlist':
      loadMoreWatchlist();
      break;
    case 'load-more-filtered-watchlist':
      loadMoreFilteredWatchlist();
      break;
    case 'load-more-seen':
      loadMoreSeen();
      break;

    // ─── SEARCH TITLE ────────────────────────────────────────────────
    case 'search-title':
      searchForShow(el.dataset.title);
      break;
  }
});

// ─── INPUT / CHANGE EVENT DELEGATION ─────────────────────────────────────────
document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});
document.getElementById('import-file').addEventListener('change', importData);
document.getElementById('seen-search').addEventListener('input', filterSeenList);
document.getElementById('seen-sort').addEventListener('change', filterSeenList);
document.getElementById('watchlist-search').addEventListener('input', filterWatchlist);
document.getElementById('watchlist-sort').addEventListener('change', filterWatchlist);

// Settings page: delegate change events for the filter toggles and age-limit
// select. Buttons + provider chips already handled via the click switch.
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'toggle-setting') {
    handleToggleSetting(el.dataset.key, el.checked);
  } else if (action === 'set-age-limit') {
    handleSetAgeLimit(el.value);
  }
});

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ─── GENRE EMOJI ─────────────────────────────────────────────────────────────
function genreEmoji(genres) {
  const g = (genres || '').toLowerCase();
  if (g.includes('horror')) return '👻';
  if (g.includes('sci-fi') || g.includes('science fiction')) return '🚀';
  if (g.includes('comedy')) return '😂';
  if (g.includes('romance')) return '💕';
  if (g.includes('thriller') || g.includes('mystery')) return '🔍';
  if (g.includes('animation') || g.includes('anime')) return '✨';
  if (g.includes('crime')) return '🔫';
  if (g.includes('action') || g.includes('adventure')) return '⚡';
  if (g.includes('drama')) return '🎭';
  if (g.includes('documentary')) return '🎬';
  if (g.includes('fantasy')) return '🧙';
  return '🎞️';
}

// ─── TMDB GENRE ID → NAME MAPPING ────────────────────────────────────────────
const TMDB_GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics'
};

function tmdbGenreIdsToString(genreIds) {
  if (!genreIds || !Array.isArray(genreIds)) return '';
  return genreIds.map(id => TMDB_GENRES[id]).filter(Boolean).join(', ');
}

function tmdbResultToItem(tmdbItem) {
  const isMovie = tmdbItem.media_type === 'movie' || (tmdbItem.title && !tmdbItem.name);
  const title = isMovie ? tmdbItem.title : tmdbItem.name;
  const year = (isMovie ? tmdbItem.release_date : tmdbItem.first_air_date || '').slice(0, 4);
  const genres = tmdbGenreIdsToString(tmdbItem.genre_ids);
  // Truncate to first 2 sentences so cards stay compact
  const raw = tmdbItem.overview || '';
  const sentences = raw.match(/[^.!?]+[.!?]+/g);
  const description = sentences ? sentences.slice(0, 2).join('').trim() : raw;
  const mediaType = isMovie ? 'movie' : 'tv';

  // Pre-cache TMDB ID, poster, and rating so subsequent lookups are instant
  const cacheKey = `${title}::${year}`;
  if (tmdbItem.id && !tmdbIdCache[cacheKey]) {
    tmdbIdCache[cacheKey] = { tmdbId: tmdbItem.id, mediaType };
  }
  if (tmdbItem.poster_path && !posterCache[cacheKey]) {
    posterCache[cacheKey] = `https://image.tmdb.org/t/p/w342${tmdbItem.poster_path}`;
  }
  if (typeof tmdbItem.vote_average === 'number' && ratingCache[cacheKey] === undefined) {
    const rating = Math.round(tmdbItem.vote_average * 10);
    const voteCount = tmdbItem.vote_count || 0;
    ratingCache[cacheKey] = { rating, voteCount };
    persistRatingToState(title, year, rating, voteCount);
  }

  return {
    id: normalizeId(title, year),
    title,
    type: isMovie ? 'Movie' : 'TV Show',
    year,
    genres,
    description,
    language: tmdbItem.original_language || null,
  };
}

async function fetchTmdbRecommendations(item, count = 4, kind = 'recommendations') {
  await fetchPoster(item.title, item.year);
  const info = getTmdbInfo(item.title, item.year);
  if (!info) return null;

  try {
    const res = await fetch(`/api/tmdb-recommendations?id=${info.tmdbId}&type=${info.mediaType}&kind=${kind}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const items = data.results
      .filter(r => r.overview && (r.title || r.name))
      .map(tmdbResultToItem);

    const filtered = filterResults(items).filter(i => !shownIds.has(i.id));
    return filtered.length > 0 ? filtered.slice(0, count) : null;
  } catch (err) {
    console.warn(`TMDB ${kind} failed:`, err.message);
    return null;
  }
}

async function fetchClaudeSimilar(title, type, year, count = 4) {
  const prompt = `You are a film and TV expert for Flickpick.

The user just selected: "${title}" (${type}, ${year})

Return ONLY a JSON object with exactly this structure, no markdown:
{
  "similar": [
    {
      "id": "unique-slug",
      "title": "Title",
      "type": "TV Show" or "Movie",
      "year": "2022",
      "genres": "Comedy, Drama",
      "description": "1-2 sentence factual description of what this show/movie is about.",
      "blurb": "1 sentence about why a fan of the selected title would enjoy this.",
      "emoji": "single relevant emoji"
    }
  ]
}

Return exactly ${count} similar titles. Real, well-known titles only. Lowercase hyphenated ids.
IMPORTANT: "description" must be a factual synopsis — NOT a recommendation.
Put the recommendation reason in "blurb".` + getExclusionList();

  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: count <= 4 ? 1000 : 2500,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  const result = parseClaudeJSON(data.content[0].text);
  return filterResults(normalizeItems(result.similar));
}

// ─── MULTI-TITLE SEARCH ──────────────────────────────────────────────────────
async function fetchClaudeMultiSimilar(titles, count = 4) {
  const exclusion = getExclusionList() + getShownExclusion();
  const titleList = titles.map(t => `"${t}"`).join(', ');
  const prompt = `You are a film and TV expert for Flickpick.

The user listed these titles as reference points: ${titleList}.

Recommend ${count} shows or movies that share the COMMON themes, tone, pacing, and sensibilities of ALL of those titles together — not similar to just one. Find the through-line between them and surface titles that scratch that same itch.${exclusion}

Return ONLY a JSON object with exactly this structure, no markdown:
{
  "similar": [
    {
      "id": "unique-slug",
      "title": "Title",
      "type": "TV Show" or "Movie",
      "year": "2022",
      "genres": "Comedy, Drama",
      "description": "1-2 sentence factual synopsis of what this show/movie is about.",
      "blurb": "1 sentence about why a fan of those reference titles would enjoy this.",
      "emoji": "single relevant emoji"
    }
  ]
}

Return exactly ${count} titles. Real, well-known titles only. Lowercase hyphenated ids. Dig deep — surface lesser-known gems alongside the obvious picks. IMPORTANT: "description" must be a factual synopsis — NOT a recommendation. Put the recommendation reason in "blurb".`;

  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: count <= 4 ? 1500 : 2800,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  const result = parseClaudeJSON(data.content[0].text);
  return filterResults(normalizeItems(result.similar || []));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderMultiSearchHeader(titles) {
  const list = titles.map(t => `<span class="multi-search-title">${escapeHtml(t)}</span>`).join('<span class="multi-search-sep">,</span> ');
  document.getElementById('featured-card').innerHTML = `
    <div class="multi-search-header">
      <div class="multi-search-label">Searched for shows like</div>
      <div class="multi-search-titles">${list}</div>
    </div>
  `;
}

async function doMultiSearch(titles) {
  currentFeatured = null;
  currentMultiSearch = titles;

  document.getElementById('featured-section').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('discover-carousels').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  document.getElementById('search-btn').disabled = true;
  viewHistory.length = 0;
  updateBackButton();

  try {
    shownIds = new Set();
    suggestionPool = [];
    suggestionPageIdx = 0;
    poolFetching = false;

    renderMultiSearchHeader(titles);

    document.getElementById('loading').style.display = 'none';
    document.getElementById('featured-section').style.display = 'block';

    const grid = document.getElementById('similar-grid');
    grid.innerHTML = Array(GRID_SIZE).fill(renderPlaceholderCard()).join('');

    const similar = await fetchClaudeMultiSimilar(titles, GRID_SIZE);
    renderSimilar(similar || []);
  } catch (e) {
    console.error('Multi-search error:', e);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
  }

  document.getElementById('search-btn').disabled = false;
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────
async function doSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;

  // Multi-title search: comma-separated input → recommendations that thread
  // the common DNA of all listed titles.
  const titles = query.split(',').map(s => s.trim()).filter(Boolean);
  if (titles.length >= 2) {
    return doMultiSearch(titles);
  }

  currentMultiSearch = null;

  document.getElementById('featured-section').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('discover-carousels').style.display = 'none';
  document.getElementById('search-chooser-section').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  document.getElementById('search-btn').disabled = true;
  viewHistory.length = 0;
  currentFeatured = null;
  resetChooserState();
  updateBackButton();

  try {
    const libraryContext = buildLibraryContextForSearch();
    const librarySection = libraryContext
      ? `\nThe user already has these titles in their lists. **Identify any that genuinely match the search and include them in your candidates list FIRST**, before adding fresh suggestions. Use the exact title and year as written here so it can be matched back to the user's records.\n\n${libraryContext}\n`
      : '';

    const prompt = `You are a film and TV expert assistant for a streaming recommendation app called Flickpick.

The user searched for: "${query}"
${librarySection}
Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "candidates": [
    {
      "id": "unique-slug-no-spaces",
      "title": "Exact title",
      "type": "TV Show" or "Movie",
      "year": "2015",
      "genres": "Action, Drama",
      "description": "2-3 sentence description of what this show/movie is about.",
      "blurb": "One short phrase distinguishing THIS version from siblings (e.g. 'Charlie Cox Netflix series', 'Ben Affleck 2003 movie').",
      "emoji": "single relevant emoji"
    }
  ]
}

Return up to ${CHOOSER_INITIAL_COUNT} candidates. Order matters: list any matching items from the user's lists FIRST (sorted by relevance to the query), then fresh recommendations to fill the rest of the slots.

Each candidate must be a DISTINCT WORK (different productions — not different seasons of the same show).

- If the query unambiguously refers to one work (e.g. "Severance"), return 1 candidate.
- If multiple distinct works share the title (e.g. "Daredevil" → 2003 movie, 2015 Netflix series, 2025 Born Again, 1989 TV movie), return all major versions.
- If the query is fuzzy/descriptive or thematic (e.g. "Spy Movies", "that show with the bear chef", "shows like the Diplomat"), surface every relevant item from the user's lists you can find AND fresh suggestions, up to ${CHOOSER_INITIAL_COUNT} total.

Use real, well-known titles. The "id" must be lowercase with hyphens only. The "blurb" should be ≤6 words and help the user pick the right version.`;

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Haiku: 3-5x faster than Sonnet for the chooser flow with minimal
        // quality drop given the bucketing UX (user picks the right one).
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    const parsed = parseClaudeJSON(data.content[0].text);
    const rawCandidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    const candidates = rawCandidates.slice(0, CHOOSER_INITIAL_COUNT).map(normalizeItem);

    document.getElementById('loading').style.display = 'none';

    if (candidates.length === 0) {
      document.getElementById('error-state').style.display = 'block';
    } else if (candidates.length === 1) {
      // Unambiguous match — render featured directly (today's UX).
      shownIds = new Set();
      suggestionPool = [];
      suggestionPageIdx = 0;
      poolFetching = false;
      renderFeatured(candidates[0]);
      document.getElementById('featured-section').style.display = 'block';

      const grid = document.getElementById('similar-grid');
      grid.innerHTML = Array(GRID_SIZE).fill(renderPlaceholderCard()).join('');

      let similar = await fetchTmdbRecommendations(candidates[0], GRID_SIZE);
      if (!similar) {
        similar = await fetchClaudeSimilar(candidates[0].title, candidates[0].type, candidates[0].year, GRID_SIZE);
      }
      renderSimilar(similar || []);
    } else {
      // Ambiguous / fuzzy — show the bucketed chooser.
      candidates.forEach(registerItem);
      chooserState.query = query;
      chooserState.pool = candidates;
      chooserState.pages = { new: 0, want: 0 };
      chooserState.fetching = false;
      chooserState.exhausted = false;
      chooserState.fetchCount = 0;
      // Push a chooser entry so the back button returns here from any picked item.
      viewHistory.push(snapshotChooserState());
      updateBackButton();
      renderChooser();
      maybeLoadMoreChooserCandidates();
    }

  } catch(e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
  }

  document.getElementById('search-btn').disabled = false;
}

// ─── SEARCH CHOOSER (disambiguation, bucketed by user state) ────────────────
// Robust state lookup: exact id first, then title+year fallback so items saved
// long ago (with slightly different id normalization) still match. Returns the
// list name ('want' / 'seen' / 'nope') the item is in, or null.
function findItemInState(item) {
  const id = item.id;
  if (state.want[id]) return 'want';
  if (state.seen[id]) return 'seen';
  if (state.nope[id]) return 'nope';

  const t = (item.title || '').toLowerCase().trim();
  const y = String(item.year || '');
  if (!t || !y) return null;

  for (const list of ['want', 'seen', 'nope']) {
    for (const sid in state[list]) {
      const s = state[list][sid];
      if ((s.title || '').toLowerCase().trim() === t && String(s.year || '') === y) {
        return list;
      }
    }
  }
  return null;
}

function bucketizeChooserPool(pool) {
  // Restored chooser: use the bucket layout captured when the user last saw
  // this view. Items that have since moved into the user's lists get re-routed,
  // but NEW items aren't re-filtered against current async-filter cache state.
  if (chooserState.bucketSnapshot) {
    const idToItem = {};
    for (const item of pool) idToItem[item.id] = item;
    const buckets = { new: [], want: [] };
    for (const bucketName of CHOOSER_BUCKETS) {
      const ids = chooserState.bucketSnapshot[bucketName] || [];
      for (const id of ids) {
        const item = idToItem[id];
        if (!item) continue;
        const list = findItemInState(item);
        if (list === 'seen' || list === 'nope') continue; // drop — already classified
        if (list === 'want') buckets.want.push(item);
        else buckets[bucketName].push(item);
      }
    }
    return buckets;
  }

  const buckets = { new: [], want: [] };
  for (const item of pool) {
    const list = findItemInState(item);
    if (list === 'seen' || list === 'nope') continue; // already-classified items don't surface in chooser
    if (list === 'want') buckets.want.push(item);
    else if (passesFilters(item)) buckets.new.push(item);
  }
  return buckets;
}

function clampChooserPages(buckets) {
  for (const name of CHOOSER_BUCKETS) {
    const total = buckets[name].length;
    const maxPage = Math.max(0, Math.ceil(total / CHOOSER_PAGE_SIZE) - 1);
    if (chooserState.pages[name] > maxPage) chooserState.pages[name] = maxPage;
    if (chooserState.pages[name] < 0) chooserState.pages[name] = 0;
  }
}

// Carousel-style loading placeholder so chooser cards match the discover-page
// look (smaller cards with poster + Title (rating) + mini action row).
const CHOOSER_LOADING_CARD = `<div class="carousel-item carousel-item-loading"><div class="carousel-item-placeholder"><div class="loading-spinner" style="width:24px;height:24px;margin:0 auto"></div></div><div class="carousel-item-title" style="color:var(--text-muted)">Loading...</div></div>`;

function renderChooserBucket(name, items) {
  const section = document.getElementById(`chooser-bucket-${name}`);
  const grid = document.getElementById(`chooser-grid-${name}`);
  if (!section || !grid) return;

  const empty = document.getElementById(`chooser-empty-${name}`);
  const isNew = name === 'new';

  if (items.length === 0) {
    if (isNew && chooserState.pool.length > 0) {
      section.style.display = '';
      if (chooserState.fetching) {
        // Mid-lazy-load: show placeholders so user sees "more coming"
        grid.style.display = '';
        grid.innerHTML = Array(CHOOSER_PAGE_SIZE).fill(CHOOSER_LOADING_CARD).join('');
        if (empty) empty.style.display = 'none';
      } else {
        // No more incoming: show the empty hint
        grid.innerHTML = '';
        grid.style.display = 'none';
        if (empty) empty.style.display = '';
      }
    } else {
      section.style.display = 'none';
    }
    updateChooserArrows(name, 0);
    return;
  }

  section.style.display = '';
  grid.style.display = '';
  if (empty) empty.style.display = 'none';

  const page = chooserState.pages[name] || 0;
  const start = page * CHOOSER_PAGE_SIZE;
  const slice = items.slice(start, start + CHOOSER_PAGE_SIZE);
  // Carousel-item style cards matching the discover-page "Based On What You
  // Love" row: poster + Title (rating) + mini Trailer/Seen/Want/Nope row.
  let html = slice.map(item => renderCarouselItem(item, true)).join('');
  if (isNew && chooserState.fetching && slice.length < CHOOSER_PAGE_SIZE) {
    const pad = CHOOSER_PAGE_SIZE - slice.length;
    html += Array(pad).fill(CHOOSER_LOADING_CARD).join('');
  }
  grid.innerHTML = html;
  slice.forEach(item => {
    loadCarouselPoster(item);
    loadTrailerBtnFor(item.id, item.title, item.year);
    // Only the NEW bucket gets the lazy-then-hide async filter check; user-list
    // buckets always show their matches regardless of filter settings.
    if (isNew) kickAsyncFilterCheck(item, debouncedRenderChooser);
  });

  updateChooserArrows(name, items.length);
}

function updateChooserArrows(name, totalItems) {
  const section = document.getElementById(`chooser-bucket-${name}`);
  if (!section) return;
  const prev = section.querySelector(`[data-action="chooser-prev"][data-bucket="${name}"]`);
  const next = section.querySelector(`[data-action="chooser-next"][data-bucket="${name}"]`);
  const page = chooserState.pages[name] || 0;
  const lastPage = Math.max(0, Math.ceil(totalItems / CHOOSER_PAGE_SIZE) - 1);
  if (prev) prev.disabled = page <= 0;
  if (next) {
    // Allow Next on the last page of NEW if we can still lazy-load more.
    const canFetchMore = name === 'new' && !chooserState.exhausted && !chooserState.fetching;
    next.disabled = page >= lastPage && !canFetchMore;
  }
}

function renderChooser() {
  document.getElementById('search-chooser-query').textContent = chooserState.query;
  const buckets = bucketizeChooserPool(chooserState.pool);
  clampChooserPages(buckets);
  for (const name of CHOOSER_BUCKETS) {
    renderChooserBucket(name, buckets[name]);
  }
  document.getElementById('search-chooser-section').style.display = 'block';
  document.getElementById('featured-section').style.display = 'none';
}

// Re-render chooser after a Seen/Want/Nope toggle changes which bucket an item belongs in.
function rebucketChooser() {
  renderChooser();
  maybeLoadMoreChooserCandidates();
}

function chooserPrev(name) {
  if (chooserState.pages[name] > 0) chooserState.pages[name]--;
  const buckets = bucketizeChooserPool(chooserState.pool);
  renderChooserBucket(name, buckets[name]);
}

function chooserNext(name) {
  const buckets = bucketizeChooserPool(chooserState.pool);
  const total = buckets[name].length;
  const lastPage = Math.max(0, Math.ceil(total / CHOOSER_PAGE_SIZE) - 1);

  if (chooserState.pages[name] < lastPage) {
    chooserState.pages[name]++;
    renderChooserBucket(name, buckets[name]);
  } else if (name === 'new' && !chooserState.exhausted && !chooserState.fetching) {
    // Show placeholders, then fetch and re-render when ready.
    const grid = document.getElementById('chooser-grid-new');
    if (grid) grid.innerHTML = Array(CHOOSER_PAGE_SIZE).fill(CHOOSER_LOADING_CARD).join('');
    loadMoreChooserCandidates().then(() => {
      const fresh = bucketizeChooserPool(chooserState.pool);
      const newLast = Math.max(0, Math.ceil(fresh.new.length / CHOOSER_PAGE_SIZE) - 1);
      if (chooserState.pages.new < newLast) chooserState.pages.new++;
      renderChooserBucket('new', fresh.new);
    });
  }
}

// Fire-and-forget: kicks off lazy-load if the NEW bucket is below target.
function maybeLoadMoreChooserCandidates() {
  if (chooserState.exhausted || chooserState.fetching) return;
  const buckets = bucketizeChooserPool(chooserState.pool);
  if (buckets.new.length < CHOOSER_NEW_TARGET) {
    loadMoreChooserCandidates();
  }
}

// Build a list of items to exclude from Claude's next response: everything
// already in the chooser pool, plus everything the user has already classified
// (seen/want/nope). This makes lazy-load results land in NEW FINDS rather than
// re-surfacing items the user has already processed.
function buildChooserExclusion() {
  const items = [
    ...chooserState.pool,
    ...Object.values(state.seen),
    ...Object.values(state.want),
    ...Object.values(state.nope),
  ];
  const seen = new Set();
  const out = [];
  for (const i of items) {
    if (i && i.id && i.title && !seen.has(i.id)) {
      seen.add(i.id);
      out.push(i);
    }
  }
  return out;
}

// Build a compact library context for the FIRST search prompt so Claude can
// identify items already on the user's lists that match the query (e.g.
// "Spy Movies" → surface their saved Pine Gap, Mission Impossible, etc.).
// Sorted by addedAt desc and capped to keep prompt size bounded — 100 most
// recent is plenty for relevance-driven matching, and keeps prompt small
// enough that Haiku can chew through it quickly.
const LIBRARY_CONTEXT_MAX = 100;
function buildLibraryContextForSearch() {
  const labelled = [];
  for (const i of Object.values(state.want)) labelled.push({ item: i, list: 'WATCHLIST' });
  for (const i of Object.values(state.seen)) labelled.push({ item: i, list: 'SEEN' });
  for (const i of Object.values(state.nope)) labelled.push({ item: i, list: 'NOPED' });

  // Most recent first — when capped, recently-added items survive (more relevant).
  labelled.sort((a, b) => (b.item.addedAt || 0) - (a.item.addedAt || 0));
  const capped = labelled.slice(0, LIBRARY_CONTEXT_MAX);

  const buckets = { WATCHLIST: [], SEEN: [], NOPED: [] };
  for (const { item, list } of capped) {
    if (item && item.title) {
      buckets[list].push(`- ${item.title}${item.year ? ` (${item.year})` : ''}`);
    }
  }

  const sections = [];
  if (buckets.WATCHLIST.length) sections.push(`WATCHLIST (saved for later):\n${buckets.WATCHLIST.join('\n')}`);
  if (buckets.SEEN.length) sections.push(`SEEN:\n${buckets.SEEN.join('\n')}`);
  if (buckets.NOPED.length) sections.push(`NOPED (rejected):\n${buckets.NOPED.join('\n')}`);
  return sections.join('\n\n');
}

async function loadMoreChooserCandidates() {
  if (chooserState.exhausted || chooserState.fetching || !chooserState.query) return;
  if (chooserState.fetchCount >= CHOOSER_MAX_FETCHES) {
    chooserState.exhausted = true;
    renderChooser();
    return;
  }

  chooserState.fetching = true;
  chooserState.fetchCount++;
  // Re-render so arrows / loading affordances update.
  renderChooser();

  try {
    const exclude = buildChooserExclusion();
    const excludeText = exclude.map(i => `- ${i.title}${i.year ? ` (${i.year})` : ''}`).join('\n');

    const prompt = `You are a film and TV expert assistant for a streaming recommendation app called Flickpick.

The user searched for: "${chooserState.query}"

Already-shown OR already-classified by the user (do NOT return any of these — they're already in the result set or the user has already marked them seen / watchlisted / noped):
${excludeText}

Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "candidates": [
    {
      "id": "unique-slug-no-spaces",
      "title": "Exact title",
      "type": "TV Show" or "Movie",
      "year": "2015",
      "genres": "Action, Drama",
      "description": "2-3 sentence description.",
      "blurb": "One short distinguishing phrase (≤6 words).",
      "emoji": "single relevant emoji"
    }
  ]
}

Return up to ${CHOOSER_LOAD_MORE_COUNT} ADDITIONAL candidates that match the search but are NOT in the excluded list above. Real, well-known titles only. Ordered by relevance/popularity. Dig deeper — include lesser-known but still legitimate matches. The "id" must be lowercase with hyphens only. If you genuinely cannot think of further matches, return an empty candidates array.`;

    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Haiku for chooser lazy-load — same trade-off as the initial call.
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const parsed = parseClaudeJSON(data.content[0].text);
    const fresh = (Array.isArray(parsed?.candidates) ? parsed.candidates : []).map(normalizeItem);
    const existingIds = new Set(chooserState.pool.map(i => i.id));
    const additions = fresh.filter(i => !existingIds.has(i.id));
    additions.forEach(registerItem);
    chooserState.pool = chooserState.pool.concat(additions);
    // If we're on a restored chooser (bucketSnapshot active), append new items
    // to the NEW snapshot so they actually surface — otherwise bucketize would
    // route by snapshot only and skip them.
    if (chooserState.bucketSnapshot) {
      for (const item of additions) chooserState.bucketSnapshot.new.push(item.id);
    }
    if (additions.length === 0) chooserState.exhausted = true;
  } catch (err) {
    console.warn('Chooser load-more failed:', err.message);
    chooserState.exhausted = true;
  } finally {
    chooserState.fetching = false;
  }

  renderChooser();

  // Recurse: keep fetching until NEW FINDS reaches target or we're capped/exhausted.
  if (!chooserState.exhausted && chooserState.fetchCount < CHOOSER_MAX_FETCHES) {
    const buckets = bucketizeChooserPool(chooserState.pool);
    if (buckets.new.length < CHOOSER_NEW_TARGET) {
      loadMoreChooserCandidates();
    }
  }
}

function resetChooserState() {
  chooserState.query = '';
  chooserState.pool = [];
  chooserState.pages = { new: 0, want: 0 };
  chooserState.fetching = false;
  chooserState.exhausted = false;
  chooserState.fetchCount = 0;
  chooserState.bucketSnapshot = null;
}

// Capture the current bucket layout (which item IDs are in which bucket) so
// back-navigation restores exactly what the user was seeing. Without this,
// async filter checks that resolve while the user is on the featured page can
// retroactively wipe items from the chooser pool, leaving an empty NEW bucket
// when they hit Back.
function snapshotChooserState() {
  const buckets = bucketizeChooserPool(chooserState.pool);
  return {
    chooser: true,
    query: chooserState.query,
    pool: [...chooserState.pool],
    pages: { ...chooserState.pages },
    exhausted: chooserState.exhausted,
    fetchCount: chooserState.fetchCount,
    bucketSnapshot: {
      new: buckets.new.map(i => i.id),
      want: buckets.want.map(i => i.id),
    },
  };
}

function restoreChooserState(snap) {
  chooserState.query = snap.query;
  chooserState.pool = [...snap.pool];
  chooserState.pages = { ...snap.pages };
  chooserState.fetching = false;
  chooserState.exhausted = !!snap.exhausted;
  chooserState.fetchCount = snap.fetchCount || 0;
  chooserState.bucketSnapshot = snap.bucketSnapshot || null;
  chooserState.pool.forEach(registerItem);
}

// ─── RENDER FEATURED ─────────────────────────────────────────────────────────
function renderFeatured(item) {
  registerItem(item);
  currentFeatured = item;
  currentMultiSearch = null;
  // Hide the chooser whenever we land on a featured card (e.g., user picked a candidate).
  const chooserSection = document.getElementById('search-chooser-section');
  if (chooserSection) chooserSection.style.display = 'none';
  const seenActive = state.seen[item.id] ? 'active' : '';
  const wantActive = state.want[item.id] ? 'active' : '';
  const nopeActive = state.nope[item.id] ? 'active' : '';
  const emoji = item.emoji || genreEmoji(item.genres);

  // Featured rating slot — included in the meta row, async-filled by loadPosterFor
  // (the rating--featured class signals parens "(87%)" formatting).
  const cachedRating = getCachedRating(item.title, item.year);
  const initialRatingHtml = shouldShowRating(cachedRating)
    ? `<span class="rating rating--featured rating--${ratingTier(cachedRating.rating)}" data-rating-id="${item.id}">(${cachedRating.rating}%)</span>`
    : `<span class="rating rating--featured" data-rating-id="${item.id}"></span>`;

  document.getElementById('featured-card').innerHTML = `
    <div class="featured-poster-placeholder" data-poster-id="${item.id}">
      <span class="poster-emoji">${emoji}</span>
    </div>
    <div class="featured-info">
      <div class="featured-type">${item.type}</div>
      <div class="featured-title">${item.title}</div>
      <div class="featured-meta">
        <span>${item.year}</span>
        <span>${item.genres}</span>
        ${initialRatingHtml}
      </div>
      <div class="featured-desc">${item.description}</div>
      <div class="featured-actions">
        <button class="btn-seen ${seenActive}" data-action="toggle-seen" data-id="${item.id}">
          ${state.seen[item.id] ? '✓ Seen' : 'Mark Seen'}
        </button>
        <button class="btn-want ${wantActive}" data-action="toggle-want" data-id="${item.id}">
          ${state.want[item.id] ? '★ Saved' : '+ Watchlist'}
        </button>
        <button class="btn-nope ${nopeActive}" data-action="toggle-nope" data-id="${item.id}">
          ${state.nope[item.id] ? '✕ Noped' : 'Nope'}
        </button>
      </div>
    </div>
  `;
  loadPosterFor(item.id, item.title, item.year);
  loadFeaturedExtras(item.title, item.year);
}

// ─── RENDER SIMILAR ──────────────────────────────────────────────────────────
function renderSingleCard(item) {
  registerItem(item);
  const seenActive = state.seen[item.id] ? 'active' : '';
  const wantActive = state.want[item.id] ? 'active' : '';
  const nopeActive = state.nope[item.id] ? 'active' : '';
  const emoji = item.emoji || genreEmoji(item.genres);
  const subtitle = item.blurb || item.description;

  // Rating slot — flex-aligned right next to the title. The "rating--titled"
  // class signals to loadPosterFor that this surface uses parens "(87%)".
  const cachedRating = getCachedRating(item.title, item.year);
  const initialRatingHtml = shouldShowRating(cachedRating)
    ? `<span class="rating rating--titled rating--${ratingTier(cachedRating.rating)}" data-rating-id="${item.id}">(${cachedRating.rating}%)</span>`
    : `<span class="rating rating--titled" data-rating-id="${item.id}"></span>`;

  return `
    <div class="similar-card swapping-in" data-card-id="${item.id}">
      <div class="similar-poster-placeholder" data-poster-id="${item.id}" data-action="load-item" data-id="${item.id}">
        ${emoji}
      </div>
      <div class="similar-body" data-action="load-item" data-id="${item.id}">
        <div class="similar-title-row">
          <span class="similar-title">${item.title}</span>
          ${initialRatingHtml}
        </div>
        <div class="similar-subtitle">${subtitle}</div>
      </div>
      <div class="similar-trailer" data-trailer-id="${item.id}" style="display:none">
        <button class="mini-trailer-btn" data-action="play-trailer" data-id="${item.id}">&#9654; Trailer</button>
      </div>
      <div class="similar-actions">
        <button class="mini-btn mini-seen ${seenActive}" data-action="toggle-seen" data-id="${item.id}">
          Seen
        </button>
        <button class="mini-btn mini-want ${wantActive}" data-action="toggle-want" data-id="${item.id}">
          ${state.want[item.id] ? '★' : 'Want'}
        </button>
        <button class="mini-btn mini-nope ${nopeActive}" data-action="toggle-nope" data-id="${item.id}">
          ${state.nope[item.id] ? '✕' : 'Nope'}
        </button>
      </div>
    </div>
  `;
}

function renderPlaceholderCard() {
  return `<div class="similar-card loading-placeholder"><div class="loading-spinner"></div></div>`;
}

function renderSimilar(items) {
  items.forEach(item => shownIds.add(item.id));
  suggestionPool = [...items];
  suggestionPageIdx = 0;
  displaySuggestionPage(0);
  fillSuggestionPool();
}

// ─── SUGGESTION POOL & PAGINATION ───────────────────────────────────────────
function displaySuggestionPage(idx) {
  // Apply user filters before paginating so each page is up to GRID_SIZE
  // PASSING items, not gaps.
  const filtered = suggestionPool.filter(passesFilters);
  const start = idx * GRID_SIZE;
  const items = filtered.slice(start, start + GRID_SIZE);
  const grid = document.getElementById('similar-grid');
  const placeholders = items.length < GRID_SIZE
    ? Array(GRID_SIZE - items.length).fill(renderPlaceholderCard()).join('')
    : '';
  grid.innerHTML = items.map(item => renderSingleCard(item)).join('') + placeholders;
  items.forEach(item => {
    loadPosterFor(item.id, item.title, item.year);
    loadTrailerBtnFor(item.id, item.title, item.year);
    kickAsyncFilterCheck(item, debouncedDisplaySuggestionPage);
  });
  updateSimilarArrows();
}

function updateSimilarArrows() {
  const prevBtn = document.getElementById('similar-prev');
  const nextBtn = document.getElementById('similar-next');
  if (!prevBtn || !nextBtn) return;
  prevBtn.disabled = suggestionPageIdx <= 0;
  // Next is always available when we have a featured item OR a multi-search active
  nextBtn.disabled = !currentFeatured && !currentMultiSearch;
}

function similarNext() {
  const nextStart = (suggestionPageIdx + 1) * GRID_SIZE;
  if (nextStart < suggestionPool.length) {
    suggestionPageIdx++;
    displaySuggestionPage(suggestionPageIdx);
    fillSuggestionPool(); // pre-fetch next batch as user pages forward
  } else {
    // No items ready — show placeholders, trigger fetch if needed, and wait
    suggestionPageIdx++;
    const grid = document.getElementById('similar-grid');
    grid.innerHTML = Array(GRID_SIZE).fill(renderPlaceholderCard()).join('');
    updateSimilarArrows();
    fillSuggestionPool();
    waitForPoolPage(suggestionPageIdx);
  }
  window.scrollTo({ top: document.getElementById('similar-grid').offsetTop - 80, behavior: 'smooth' });
}

function waitForPoolPage(targetIdx) {
  const check = setInterval(() => {
    const start = targetIdx * GRID_SIZE;
    if (start < suggestionPool.length) {
      clearInterval(check);
      if (suggestionPageIdx === targetIdx) {
        displaySuggestionPage(targetIdx);
      }
    }
  }, 200);
  setTimeout(() => clearInterval(check), 30000);
}

function similarPrev() {
  if (suggestionPageIdx > 0) {
    suggestionPageIdx--;
    displaySuggestionPage(suggestionPageIdx);
    window.scrollTo({ top: document.getElementById('similar-grid').offsetTop - 80, behavior: 'smooth' });
  }
}

async function fillSuggestionPool() {
  const buffer = suggestionPool.length - (suggestionPageIdx * GRID_SIZE);
  if (buffer >= POOL_BUFFER || poolFetching) return;
  if (!currentFeatured && !currentMultiSearch) return;
  poolFetching = true;
  updateSimilarArrows();

  try {
    const needed = POOL_BUFFER - buffer;
    let newItems = null;

    if (currentMultiSearch) {
      // Multi-title pagination: refill via Claude with shared-DNA prompt + exclusions
      newItems = await fetchClaudeMultiSimilar(currentMultiSearch, Math.min(needed, 8));
    } else {
      // Single-title: try TMDB first — returns up to 20 items in one call
      newItems = await fetchTmdbRecommendations(currentFeatured, needed);
    }

    if (currentFeatured && (!newItems || newItems.length === 0)) {
      // Fallback: Claude batch (single-title path only)
      const batchSize = Math.min(needed, 8);
      const exclusion = getExclusionList() + getShownExclusion();
      const prompt = `You are a film and TV expert for Flickpick.

The user is exploring titles similar to: "${currentFeatured.title}" (${currentFeatured.type}, ${currentFeatured.year})

They want MORE recommendations beyond what's already been shown.${exclusion}

Return ONLY a JSON object with exactly this structure, no markdown:
{
  "similar": [
    {
      "id": "unique-slug",
      "title": "Title",
      "type": "TV Show" or "Movie",
      "year": "2022",
      "genres": "Comedy, Drama",
      "description": "1-2 sentence factual description of what this show/movie is about.",
      "blurb": "1 sentence about why a fan of the explored title would enjoy this.",
      "emoji": "single relevant emoji"
    }
  ]
}

Return exactly ${batchSize} similar titles. Real, well-known titles only. Lowercase hyphenated ids. Dig deep — suggest lesser-known gems, not just the obvious picks. IMPORTANT: "description" must be a factual synopsis — NOT a recommendation. Put the recommendation reason in "blurb".`;

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: batchSize <= 4 ? 1200 : 2500,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const result = parseClaudeJSON(data.content[0].text);
      newItems = filterResults(normalizeItems(result.similar));
    }

    if (newItems) {
      const poolIds = new Set(suggestionPool.map(i => i.id));
      const deduped = newItems.filter(i => !poolIds.has(i.id) && !shownIds.has(i.id));
      deduped.forEach(item => shownIds.add(item.id));
      const prevLen = suggestionPool.length;
      suggestionPool.push(...deduped);

      // Re-render current page if it had placeholder gaps that can now be filled
      if (deduped.length > 0) {
        const pageStart = suggestionPageIdx * GRID_SIZE;
        const pageEnd = pageStart + GRID_SIZE;
        if (prevLen < pageEnd && suggestionPool.length > prevLen) {
          displaySuggestionPage(suggestionPageIdx);
        }
      }
    }
  } catch(e) {
    console.error('Pool fill error:', e);
  }

  poolFetching = false;
  updateSimilarArrows();

  // Keep filling if still below buffer target — use setTimeout to avoid
  // synchronous recursion which can cause double-fetches
  const remainingBuffer = suggestionPool.length - (suggestionPageIdx * GRID_SIZE);
  if (remainingBuffer < POOL_BUFFER && (currentFeatured || currentMultiSearch)) {
    setTimeout(() => fillSuggestionPool(), 0);
  }
}

function replaceCard(card) {
  const cardId = card.getAttribute('data-card-id');
  const idx = suggestionPool.findIndex(i => i.id === cardId);
  if (idx !== -1) {
    suggestionPool.splice(idx, 1);
  }
  // Re-render current page — items shift down automatically
  card.classList.add('removing');
  setTimeout(() => {
    displaySuggestionPage(suggestionPageIdx);
    fillSuggestionPool();
  }, 300);
}

// ─── NAVIGATION HISTORY ─────────────────────────────────────────────────────
function updateBackButton() {
  const btn = document.getElementById('back-btn');
  if (btn) btn.style.display = viewHistory.length > 0 ? '' : 'none';
}

function goBack() {
  if (viewHistory.length === 0) return;
  const prev = viewHistory.pop();

  if (prev.chooser) {
    currentFeatured = null;
    suggestionPool = [];
    suggestionPageIdx = 0;
    shownIds = new Set();
    poolFetching = false;
    restoreChooserState(prev);
    document.getElementById('featured-section').style.display = 'none';
    renderChooser();
    updateBackButton();
    window.scrollTo({ top: 60, behavior: 'smooth' });
    return;
  }

  currentFeatured = prev.featured;
  suggestionPool = prev.suggestionPool || [];
  suggestionPageIdx = prev.suggestionPageIdx || 0;
  shownIds = prev.shownIds;

  renderFeatured(prev.featured);
  displaySuggestionPage(suggestionPageIdx);

  // Also refresh the featured card buttons
  const featuredActions = document.querySelector('.featured-actions');
  if (featuredActions && prev.featured) {
    const id = prev.featured.id;
    const seenBtn = featuredActions.querySelector('.btn-seen');
    const wantBtn = featuredActions.querySelector('.btn-want');
    const nopeBtn = featuredActions.querySelector('.btn-nope');
    if (seenBtn) {
      seenBtn.classList.toggle('active', !!state.seen[id]);
      seenBtn.textContent = state.seen[id] ? '\u2713 Seen' : 'Mark Seen';
    }
    if (wantBtn) {
      wantBtn.classList.toggle('active', !!state.want[id]);
      wantBtn.textContent = state.want[id] ? '\u2605 Saved' : '+ Watchlist';
    }
    if (nopeBtn) {
      nopeBtn.classList.toggle('active', !!state.nope[id]);
      nopeBtn.textContent = state.nope[id] ? '\u2715 Noped' : 'Nope';
    }
  }

  updateBackButton();
  window.scrollTo({ top: 60, behavior: 'smooth' });
}

// ─── LOAD ITEM DIRECTLY (from carousel / external) ──────────────────────────
async function loadItemDirect(item) {
  item = normalizeItem(item);
  // Switch to discover page and show featured section
  showPage('discover');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn').classList.add('active');
  document.getElementById('discover-carousels').style.display = 'none';

  // Save history if we have a current item
  if (currentFeatured) {
    viewHistory.push({
      featured: currentFeatured,
      suggestionPool: [...suggestionPool],
      suggestionPageIdx: suggestionPageIdx,
      shownIds: new Set(shownIds)
    });
  }

  window.scrollTo({ top: 60, behavior: 'smooth' });

  renderFeatured(item);
  updateBackButton();
  document.getElementById('featured-section').style.display = 'block';
  document.getElementById('loading').style.display = 'none';

  const grid = document.getElementById('similar-grid');
  grid.innerHTML = Array(GRID_SIZE).fill(renderPlaceholderCard()).join('');

  // Fetch similar items — try TMDB first, fall back to Claude
  try {
    let similar = await fetchTmdbRecommendations(item, GRID_SIZE);
    if (!similar) {
      similar = await fetchClaudeSimilar(item.title, item.type, item.year, GRID_SIZE);
    }

    shownIds = new Set();
    suggestionPool = [];
    suggestionPageIdx = 0;
    poolFetching = false;
    renderSimilar(similar);
  } catch(e) {
    console.error('Load item error:', e);
    grid.innerHTML = '';
  }
}

// ─── LOAD ITEM AS FEATURED ───────────────────────────────────────────────────
async function loadItem(itemId) {
  const foundItem = getStoredItem(itemId);
  if (!foundItem) return;

  // Save current state to history before navigating
  if (currentFeatured) {
    viewHistory.push({
      featured: currentFeatured,
      suggestionPool: [...suggestionPool],
      suggestionPageIdx: suggestionPageIdx,
      shownIds: new Set(shownIds)
    });
  }

  // Scroll to top
  window.scrollTo({ top: 60, behavior: 'smooth' });

  // Show featured card immediately
  renderFeatured(foundItem);
  updateBackButton();
  document.getElementById('featured-section').style.display = 'block';
  document.getElementById('loading').style.display = 'none';

  // Show placeholder cards while suggestions load
  const grid = document.getElementById('similar-grid');
  grid.innerHTML = Array(GRID_SIZE).fill(renderPlaceholderCard()).join('');

  // Fetch new similar items — try TMDB first, fall back to Claude
  try {
    let similar = await fetchTmdbRecommendations(foundItem, GRID_SIZE);
    if (!similar) {
      similar = await fetchClaudeSimilar(foundItem.title, foundItem.type, foundItem.year, GRID_SIZE);
    }

    shownIds = new Set();
    suggestionPool = [];
    suggestionPageIdx = 0;
    poolFetching = false;
    renderSimilar(similar);
  } catch(e) {
    console.error('Load similar error:', e);
    grid.innerHTML = '';
  }
}

// ─── TOGGLE SEEN ─────────────────────────────────────────────────────────────
function toggleSeen(id, btn) {
  const item = getStoredItem(id);
  if (!item) return;
  const isMini = btn.classList.contains('mini-btn');
  const nid = normalizeId(item.title, item.year);
  const wasSet = !!state.seen[nid];

  if (wasSet) {
    State.removeSeen(nid);
    btn.classList.remove('active');
    btn.textContent = isMini ? 'Seen' : 'Mark Seen';
    showToast(`Removed "${item.title}" from seen`);
  } else {
    State.addSeen(item);
    btn.classList.add('active');
    btn.textContent = isMini ? 'Seen' : '✓ Seen';
    showToast(`Marked "${item.title}" as seen`);
  }

  if (!isMini) return;
  if (btn.closest('.chooser-bucket')) { rebucketChooser(); return; }
  if (!wasSet) {
    const card = btn.closest('.similar-card');
    if (card) { replaceCard(card); return; }
    const carCard = btn.closest('.carousel-item');
    if (carCard) {
      const recsKey = findRecsKeyForCard(carCard);
      if (recsKey) replaceRecsCard(recsKey);
      return;
    }
  }
}

// ─── TOGGLE NOPE ─────────────────────────────────────────────────────────────
function toggleNope(id, btn) {
  const item = getStoredItem(id);
  if (!item) return;
  const isMini = btn.classList.contains('mini-btn');
  const nid = normalizeId(item.title, item.year);
  const wasSet = !!state.nope[nid];

  if (wasSet) {
    State.removeNope(nid);
    btn.classList.remove('active');
    btn.textContent = isMini ? 'Nope' : 'Nope';
    showToast(`Removed "${item.title}" from nope list`);
  } else {
    State.addNope(item);
    btn.classList.add('active');
    btn.textContent = isMini ? '✕' : '✕ Noped';
    showToast(`"${item.title}" noped`);
  }

  if (!isMini) return;
  if (btn.closest('.chooser-bucket')) { rebucketChooser(); return; }
  if (!wasSet) {
    const card = btn.closest('.similar-card');
    if (card) { replaceCard(card); return; }
    const carCard = btn.closest('.carousel-item');
    if (carCard) {
      const recsKey = findRecsKeyForCard(carCard);
      if (recsKey) replaceRecsCard(recsKey);
      return;
    }
  }
}

// ─── TOGGLE WANT ─────────────────────────────────────────────────────────────
function toggleWant(id, btn) {
  const item = getStoredItem(id);
  if (!item) return;
  const isMini = btn.classList.contains('mini-btn');
  const nid = normalizeId(item.title, item.year);
  const wasSet = !!state.want[nid];

  if (wasSet) {
    State.removeWant(nid);
    btn.classList.remove('active');
    btn.textContent = isMini ? 'Want' : '+ Watchlist';
    showToast(`Removed "${item.title}" from watchlist`);
  } else {
    State.addWant(item);
    btn.classList.add('active');
    btn.textContent = isMini ? '★' : '★ Saved';
    showToast(`Added "${item.title}" to watchlist`);
  }

  if (!isMini) return;
  if (btn.closest('.chooser-bucket')) { rebucketChooser(); return; }
  if (!wasSet) {
    const card = btn.closest('.similar-card');
    if (card) { replaceCard(card); return; }
    const carCard = btn.closest('.carousel-item');
    if (carCard) {
      const recsKey = findRecsKeyForCard(carCard);
      if (recsKey) replaceRecsCard(recsKey);
      return;
    }
  }
}

// ─── WATCHLIST PAGE ───────────────────────────────────────────────────────────
const WATCHLIST_PAGE_SIZE = 10;
let watchlistShown = 0;

function renderWatchlistCard(item) {
  const emoji = item.emoji || genreEmoji(item.genres);
  const cardId = `wl-${item.id}`;
  registerItem(item);

  const cachedRating = getCachedRating(item.title, item.year);
  const initialRatingHtml = shouldShowRating(cachedRating)
    ? `<span class="rating rating--titled rating--${ratingTier(cachedRating.rating)}" data-rating-id="wlrate-${item.id}">(${cachedRating.rating}%)</span>`
    : `<span class="rating rating--titled" data-rating-id="wlrate-${item.id}"></span>`;

  return `
    <div class="watchlist-card" id="${cardId}">
      <div class="watchlist-poster-placeholder clickable-title" data-wl-poster="${item.id}" data-action="load-item-direct" data-id="${item.id}">
        ${emoji}
      </div>
      <div class="watchlist-info">
        <div class="watchlist-header">
          <div class="watchlist-title-row">
            <span class="watchlist-title clickable-title" data-action="load-item-direct" data-id="${item.id}">${item.title}</span>
            ${initialRatingHtml}
          </div>
          <div class="watchlist-type">${item.type}</div>
        </div>
        <div class="watchlist-meta">${item.year} · ${item.genres}</div>
        <div class="watchlist-desc">${item.description || ''}</div>
        <div class="watchlist-extras" data-wl-extras="${item.id}"></div>
        <div class="watchlist-actions">
          <button class="btn-remove" data-action="remove-want" data-id="${item.id}">Remove</button>
        </div>
      </div>
    </div>`;
}

function loadWatchlistExtras(item) {
  // Load poster + rating (rating slot uses unique wlrate- prefix to avoid colliding
  // with the same item rendered elsewhere on the page).
  fetchPoster(item.title, item.year).then(url => {
    loadRatingFor(`wlrate-${item.id}`, item.title, item.year, { withParens: true });
    if (!url) return;
    const el = document.querySelector(`[data-wl-poster="${item.id}"]`);
    if (!el) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = item.title;
    img.className = 'watchlist-poster clickable-title';
    img.setAttribute('data-action', 'load-item-direct');
    img.setAttribute('data-id', item.id);
    img.style.cursor = 'pointer';
    retryPosterLoad(img, item.title, item.year, 2);
    img.onload = () => { if (el.parentNode) el.replaceWith(img); };
  });

  // Load trailer + providers + streaming links in parallel
  Promise.all([
    fetchTmdbExtras(item.title, item.year),
    fetchStreamingLinks(item.title, item.year)
  ]).then(([{ trailerKey, providers, watchLink }, streamingLinks]) => {
    // After provider data lands, re-check the watchlist filter; if this item
    // now fails (no providers / not on user's services), schedule a debounced
    // re-render so we coalesce many simultaneous resolutions into one paint.
    if (anyWatchlistFilterActive() && !passesWatchlistFilters(item)) {
      debouncedFilterWatchlist();
      return;
    }
    const extrasEl = document.querySelector(`[data-wl-extras="${item.id}"]`);
    if (!extrasEl) return;
    if (!trailerKey && providers.length === 0 && !streamingLinks) return;

    let html = '';
    if (trailerKey) {
      html += `<button class="mini-trailer-btn" data-action="open-trailer" data-key="${trailerKey}">&#9654; Trailer</button>`;
    }
    if (providers.length > 0 || streamingLinks) {
      html += renderProviders(providers, watchLink, streamingLinks);
    }
    extrasEl.innerHTML = html;
  });
}

function renderWatchlist() {
  const items = Object.values(state.want).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const sub = document.getElementById('watchlist-subheading');
  const container = document.getElementById('want-list-container');

  const controls = document.getElementById('watchlist-controls');

  sub.textContent = items.length === 0
    ? 'Nothing saved yet'
    : `${items.length} title${items.length === 1 ? '' : 's'} saved`;

  if (items.length === 0) {
    controls.style.display = 'none';
    container.innerHTML = `
      <div class="want-empty">
        <div class="want-empty-icon">🎬</div>
        <div class="want-empty-text">Search for a show on the Discover page and tap <strong>Watchlist</strong> to save it here for later.</div>
      </div>`;
    watchlistShown = 0;
    return;
  }

  controls.style.display = 'flex';
  // Reset search/sort on fresh render
  document.getElementById('watchlist-search').value = '';
  document.getElementById('watchlist-sort').value = 'newest';

  // Show first batch
  watchlistShown = 0;
  const batch = items.slice(0, WATCHLIST_PAGE_SIZE);
  watchlistShown = batch.length;

  let html = `<div class="watchlist-grid" id="watchlist-grid">`;
  html += batch.map(item => renderWatchlistCard(item)).join('');
  html += `</div>`;

  if (items.length > watchlistShown) {
    html += `<button class="btn-load-more" id="wl-load-more" data-action="load-more-watchlist">Load More (${items.length - watchlistShown} remaining)</button>`;
  }

  container.innerHTML = html;

  // Async load posters + extras for visible cards
  batch.forEach(item => loadWatchlistExtras(item));
}

function loadMoreWatchlist() {
  const items = Object.values(state.want).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const grid = document.getElementById('watchlist-grid');
  if (!grid) return;

  const batch = items.slice(watchlistShown, watchlistShown + WATCHLIST_PAGE_SIZE);
  watchlistShown += batch.length;

  batch.forEach(item => {
    grid.insertAdjacentHTML('beforeend', renderWatchlistCard(item));
    loadWatchlistExtras(item);
  });

  const loadMoreBtn = document.getElementById('wl-load-more');
  if (watchlistShown >= items.length) {
    if (loadMoreBtn) loadMoreBtn.remove();
  } else if (loadMoreBtn) {
    loadMoreBtn.textContent = `Load More (${items.length - watchlistShown} remaining)`;
  }
}

function removeFromWant(id) {
  const item = State.removeWant(id);
  if (!item) return;
  const el = document.getElementById('wl-' + id);
  if (el) { el.style.transition = 'all 0.3s'; el.style.opacity = '0'; el.style.transform = 'scale(0.95)'; setTimeout(() => el.remove(), 300); }
  showToast(`Removed "${item.title}"`);
  const remaining = Object.keys(state.want).length;
  document.getElementById('watchlist-subheading').textContent =
    remaining === 0 ? 'Nothing saved yet' : `${remaining} title${remaining === 1 ? '' : 's'} saved`;
  if (remaining === 0) setTimeout(() => renderWatchlist(), 350);
}

function getFilteredWatchlist() {
  const query = (document.getElementById('watchlist-search').value || '').trim().toLowerCase();
  const sortBy = document.getElementById('watchlist-sort').value;
  let items = Object.values(state.want);

  // Apply provider filters — "what can I actually watch right now?".
  // Honors Hide-no-providers and Only-my-providers from the settings page.
  items = items.filter(passesWatchlistFilters);

  // Filter by search query — search title, genres, type, year (not description to avoid matching recommendation blurbs)
  if (query) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(query) ||
      (item.genres || '').toLowerCase().includes(query) ||
      (item.type || '').toLowerCase().includes(query) ||
      (item.year || '').toLowerCase().includes(query)
    );
  }

  // Sort
  switch (sortBy) {
    case 'newest': items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); break;
    case 'oldest': items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)); break;
    case 'title-az': items.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'title-za': items.sort((a, b) => b.title.localeCompare(a.title)); break;
    case 'type': items.sort((a, b) => (a.type || '').localeCompare(b.type || '') || a.title.localeCompare(b.title)); break;
    case 'rating': items.sort((a, b) => getItemTmdbRating(b) - getItemTmdbRating(a) || a.title.localeCompare(b.title)); break;
  }
  return items;
}

function filterWatchlist() {
  const items = getFilteredWatchlist();
  const container = document.getElementById('want-list-container');
  const totalAll = Object.keys(state.want).length;

  if (items.length === 0) {
    const query = document.getElementById('watchlist-search').value.trim();
    container.innerHTML = `
      <div class="want-empty">
        <div class="want-empty-icon">🔍</div>
        <div class="want-empty-text">No matches for "${query}"</div>
      </div>`;
    return;
  }

  watchlistShown = 0;
  const batch = items.slice(0, WATCHLIST_PAGE_SIZE);
  watchlistShown = batch.length;

  let html = `<div class="watchlist-grid" id="watchlist-grid">`;
  html += batch.map(item => renderWatchlistCard(item)).join('');
  html += `</div>`;

  if (items.length > watchlistShown) {
    html += `<button class="btn-load-more" id="wl-load-more" data-action="load-more-filtered-watchlist">Load More (${items.length - watchlistShown} remaining)</button>`;
  }

  container.innerHTML = html;
  batch.forEach(item => loadWatchlistExtras(item));
}

function loadMoreFilteredWatchlist() {
  const items = getFilteredWatchlist();
  const grid = document.getElementById('watchlist-grid');
  if (!grid) return;

  const batch = items.slice(watchlistShown, watchlistShown + WATCHLIST_PAGE_SIZE);
  watchlistShown += batch.length;

  batch.forEach(item => {
    grid.insertAdjacentHTML('beforeend', renderWatchlistCard(item));
    loadWatchlistExtras(item);
  });

  const loadMoreBtn = document.getElementById('wl-load-more');
  if (watchlistShown >= items.length) {
    if (loadMoreBtn) loadMoreBtn.remove();
  } else if (loadMoreBtn) {
    loadMoreBtn.textContent = `Load More (${items.length - watchlistShown} remaining)`;
  }
}

// ─── SEEN PAGE ───────────────────────────────────────────────────────────────
const SEEN_PAGE_SIZE = 10;
let seenShown = 0;

function renderSeenCard(item) {
  const emoji = item.emoji || genreEmoji(item.genres);
  const cardId = `seen-${item.id}`;
  const r = item.rating;
  registerItem(item);

  const cachedRating = getCachedRating(item.title, item.year);
  const initialRatingHtml = shouldShowRating(cachedRating)
    ? `<span class="rating rating--titled rating--${ratingTier(cachedRating.rating)}" data-rating-id="seenrate-${item.id}">(${cachedRating.rating}%)</span>`
    : `<span class="rating rating--titled" data-rating-id="seenrate-${item.id}"></span>`;

  return `
    <div class="watchlist-card" id="${cardId}">
      <div class="watchlist-poster-placeholder clickable-title" data-seen-poster="${item.id}" data-action="load-item-direct" data-id="${item.id}">
        ${emoji}
      </div>
      <div class="watchlist-info">
        <div class="watchlist-header">
          <div class="watchlist-title-row">
            <span class="watchlist-title clickable-title" data-action="load-item-direct" data-id="${item.id}">${item.title}</span>
            ${initialRatingHtml}
          </div>
          <div class="watchlist-type">${item.type}</div>
        </div>
        <div class="watchlist-meta">${item.year} · ${item.genres}</div>
        <div class="watchlist-desc">${item.description || ''}</div>
        <div class="watchlist-extras" data-seen-extras="${item.id}"></div>
        <div class="seen-rating-row">
          <button class="rating-btn ${r === 'loved' ? 'active-loved' : ''}" data-action="set-rating" data-id="${item.id}" data-rating="loved" title="Loved">❤️</button>
          <button class="rating-btn ${r === 'liked' ? 'active-liked' : ''}" data-action="set-rating" data-id="${item.id}" data-rating="liked" title="Liked">👍</button>
          <button class="rating-btn ${r === 'meh' ? 'active-meh' : ''}" data-action="set-rating" data-id="${item.id}" data-rating="meh" title="Meh">😐</button>
          <button class="rating-btn ${r === 'disliked' ? 'active-disliked' : ''}" data-action="set-rating" data-id="${item.id}" data-rating="disliked" title="Disliked">👎</button>
        </div>
        <div class="watchlist-actions">
          <button class="btn-remove" data-action="remove-seen" data-id="${item.id}">Remove</button>
        </div>
      </div>
    </div>`;
}

function loadSeenExtras(item) {
  fetchPoster(item.title, item.year).then(url => {
    loadRatingFor(`seenrate-${item.id}`, item.title, item.year, { withParens: true });
    if (!url) return;
    const el = document.querySelector(`[data-seen-poster="${item.id}"]`);
    if (!el) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = item.title;
    img.className = 'watchlist-poster clickable-title';
    img.setAttribute('data-action', 'load-item-direct');
    img.setAttribute('data-id', item.id);
    img.style.cursor = 'pointer';
    retryPosterLoad(img, item.title, item.year, 2);
    img.onload = () => { if (el.parentNode) el.replaceWith(img); };
  });

  Promise.all([
    fetchTmdbExtras(item.title, item.year),
    fetchStreamingLinks(item.title, item.year)
  ]).then(([{ trailerKey, providers, watchLink }, streamingLinks]) => {
    const extrasEl = document.querySelector(`[data-seen-extras="${item.id}"]`);
    if (!extrasEl) return;
    if (!trailerKey && providers.length === 0 && !streamingLinks) return;

    let html = '';
    if (trailerKey) {
      html += `<button class="mini-trailer-btn" data-action="open-trailer" data-key="${trailerKey}">&#9654; Trailer</button>`;
    }
    if (providers.length > 0 || streamingLinks) {
      html += renderProviders(providers, watchLink, streamingLinks);
    }
    extrasEl.innerHTML = html;
  });
}

const RATING_ORDER = { loved: 0, liked: 1, meh: 2, disliked: 3 };

function getFilteredSeenList() {
  const query = (document.getElementById('seen-search').value || '').trim().toLowerCase();
  const sortBy = document.getElementById('seen-sort').value;
  let items = Object.values(state.seen);

  if (query) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(query) ||
      (item.genres || '').toLowerCase().includes(query) ||
      (item.type || '').toLowerCase().includes(query) ||
      (item.year || '').toLowerCase().includes(query) ||
      (item.rating || '').toLowerCase().includes(query)
    );
  }

  switch (sortBy) {
    case 'newest': items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); break;
    case 'oldest': items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)); break;
    case 'title-az': items.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'title-za': items.sort((a, b) => b.title.localeCompare(a.title)); break;
    case 'type': items.sort((a, b) => (a.type || '').localeCompare(b.type || '') || a.title.localeCompare(b.title)); break;
    case 'rating': items.sort((a, b) => getItemTmdbRating(b) - getItemTmdbRating(a) || a.title.localeCompare(b.title)); break;
    case 'my-rating': items.sort((a, b) => (RATING_ORDER[a.rating] ?? 99) - (RATING_ORDER[b.rating] ?? 99) || a.title.localeCompare(b.title)); break;
  }
  return items;
}

function renderSeenList() {
  const allItems = Object.values(state.seen);
  const sub = document.getElementById('seen-subheading');
  const container = document.getElementById('seen-list-container');
  const controls = document.getElementById('seen-controls');

  sub.textContent = allItems.length === 0
    ? 'Nothing marked as seen yet'
    : `${allItems.length} title${allItems.length === 1 ? '' : 's'} seen`;

  if (allItems.length === 0) {
    controls.style.display = 'none';
    container.innerHTML = `
      <div class="want-empty">
        <div class="want-empty-icon">👀</div>
        <div class="want-empty-text">Search for a show on the Discover page and tap <strong>Seen</strong> to start tracking what you've watched. Rate them with ❤️ to unlock personalized recommendations!</div>
      </div>`;
    seenShown = 0;
    return;
  }

  controls.style.display = 'flex';
  document.getElementById('seen-search').value = '';
  document.getElementById('seen-sort').value = 'newest';

  const items = getFilteredSeenList();
  seenShown = 0;
  const batch = items.slice(0, SEEN_PAGE_SIZE);
  seenShown = batch.length;

  let html = `<div class="watchlist-grid" id="seen-grid">`;
  html += batch.map(item => renderSeenCard(item)).join('');
  html += `</div>`;

  if (items.length > seenShown) {
    html += `<button class="btn-load-more" id="seen-load-more" data-action="load-more-seen">Load More (${items.length - seenShown} remaining)</button>`;
  }

  container.innerHTML = html;
  batch.forEach(item => loadSeenExtras(item));
}

function filterSeenList() {
  const items = getFilteredSeenList();
  const container = document.getElementById('seen-list-container');

  if (items.length === 0) {
    const query = document.getElementById('seen-search').value.trim();
    container.innerHTML = `
      <div class="want-empty">
        <div class="want-empty-icon">🔍</div>
        <div class="want-empty-text">No matches for "${query}"</div>
      </div>`;
    return;
  }

  seenShown = 0;
  const batch = items.slice(0, SEEN_PAGE_SIZE);
  seenShown = batch.length;

  let html = `<div class="watchlist-grid" id="seen-grid">`;
  html += batch.map(item => renderSeenCard(item)).join('');
  html += `</div>`;

  if (items.length > seenShown) {
    html += `<button class="btn-load-more" id="seen-load-more" data-action="load-more-seen">Load More (${items.length - seenShown} remaining)</button>`;
  }

  container.innerHTML = html;
  batch.forEach(item => loadSeenExtras(item));
}

function loadMoreSeen() {
  const items = getFilteredSeenList();
  const grid = document.getElementById('seen-grid');
  if (!grid) return;

  const batch = items.slice(seenShown, seenShown + SEEN_PAGE_SIZE);
  seenShown += batch.length;

  batch.forEach(item => {
    grid.insertAdjacentHTML('beforeend', renderSeenCard(item));
    loadSeenExtras(item);
  });

  const loadMoreBtn = document.getElementById('seen-load-more');
  if (seenShown >= items.length) {
    if (loadMoreBtn) loadMoreBtn.remove();
  } else if (loadMoreBtn) {
    loadMoreBtn.textContent = `Load More (${items.length - seenShown} remaining)`;
  }
}

function setRating(id, rating, btn) {
  const newRating = State.setRating(id, rating);
  if (newRating === null && !state.seen[id]) return;
  const row = btn.closest('.seen-rating-row');
  row.querySelectorAll('.rating-btn').forEach(b => {
    b.classList.remove('active-loved', 'active-liked', 'active-meh', 'active-disliked');
  });
  if (newRating) {
    btn.classList.add('active-' + newRating);
  }
}

function removeFromSeen(id) {
  const item = State.removeSeen(id);
  if (!item) return;
  const el = document.getElementById('seen-' + id);
  if (el) { el.style.transition = 'all 0.3s'; el.style.opacity = '0'; el.style.transform = 'scale(0.95)'; setTimeout(() => el.remove(), 300); }
  showToast(`Removed "${item.title}" from seen`);
  const remaining = Object.keys(state.seen).length;
  document.getElementById('seen-subheading').textContent =
    remaining === 0 ? 'Nothing marked as seen yet' : `${remaining} title${remaining === 1 ? '' : 's'} seen`;
  if (remaining === 0) setTimeout(() => renderSeenList(), 350);
}
