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
let shownIds = new Set();
const GRID_SIZE = 4;
const POOL_BUFFER = 8; // keep this many items buffered ahead of current page
const viewHistory = []; // stack of { featured, suggestionPool, suggestionPageIdx, shownIds }
let suggestionPool = [];     // flat array of suggestion items (grows as user pages)
let suggestionPageIdx = 0;
let poolFetching = false;

// ─── TMDB CACHE ─────────────────────────────────────────────────────────────
const posterCache = {};
const tmdbIdCache = {};

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

function getTmdbInfo(title, year) {
  return tmdbIdCache[`${title}::${year || ''}`] || null;
}

function loadPosterFor(itemId, title, year) {
  fetchPoster(title, year).then(url => {
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

async function fetchTmdbExtras(title, year) {
  const cacheKey = `${title}::${year || ''}`;
  if (tmdbExtrasCache[cacheKey]) return tmdbExtrasCache[cacheKey];

  // Ensure poster search has run (populates tmdbIdCache)
  await fetchPoster(title, year);
  const info = getTmdbInfo(title, year);
  if (!info) return { trailerKey: null, providers: [], watchLink: null };

  try {
    const res = await fetch(`/api/tmdb-details?id=${info.tmdbId}&type=${info.mediaType}`);
    const data = await res.json();

    // Find best trailer — prefer official trailers
    let trailerKey = null;
    if (data.videos && data.videos.results) {
      const trailer = data.videos.results.find(v =>
        v.type === 'Trailer' && v.site === 'YouTube'
      ) || data.videos.results.find(v => v.site === 'YouTube');
      if (trailer) trailerKey = trailer.key;
    }

    // Get US streaming providers (flatrate = subscription services)
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
    return result;
  } catch (err) {
    console.warn('TMDB extras fetch failed:', err.message);
    return { trailerKey: null, providers: [], watchLink: null };
  }
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

    // Deduplicate by service, preferring subscription > free > addon > rent > buy
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

// ─── DISCOVER CAROUSELS ─────────────────────────────────────────────────────
const CAROUSEL_PAGE = 4;
const CAROUSEL_PAGE_MOBILE = 3;
const carouselState = { watchlist: { page: 0 }, loved: { page: 0, items: [] } };
let lovedRecsCache = null;
let lovedPool = [];               // all fetched recommendations (paginated display)
let lovedInFlight = 0;            // number of API calls currently in progress
let lovedAllFetchedIds = new Set(); // tracks all fetched IDs to avoid dupes
const LOVED_MAX_CONCURRENT = 3;   // max simultaneous API calls
const LOVED_TARGET_POOL = 12;     // keep this many available items in the pool

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

  return `
    <div class="carousel-item" data-action="load-item-direct" data-id="${item.id}">
      <div class="carousel-item-placeholder" data-car-poster="${item.id || item.title}">
        ${emoji}
      </div>
      <div class="carousel-item-title" title="${safeTitle}">${item.title}</div>
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
  const items = Object.values(state.want);
  const section = document.getElementById('watchlist-carousel');
  if (items.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';

  // Shuffle once on first render, or re-shuffle only when watchlist changes
  const wantKey = Object.keys(state.want).sort().join(',');
  if (!carouselState.watchlist.shuffled || carouselState.watchlist.wantKey !== wantKey) {
    carouselState.watchlist.shuffled = shuffleArray(items);
    carouselState.watchlist.wantKey = wantKey;
    carouselState.watchlist.page = 0; // reset page when list changes
  }
  const shuffled = carouselState.watchlist.shuffled;

  const pageSize = getCarouselPageSize();
  const s = carouselState.watchlist;
  const start = s.page * pageSize;
  const batch = shuffled.slice(start, start + pageSize);
  const track = document.getElementById('wl-car-track');
  track.style.gridTemplateColumns = `repeat(${pageSize}, 1fr)`;
  track.innerHTML = batch.map(item => renderCarouselItem(item)).join('');
  batch.forEach(item => loadCarouselPoster(item));

  document.getElementById('wl-car-prev').disabled = s.page === 0;
  document.getElementById('wl-car-next').disabled = start + pageSize >= shuffled.length;
}

// Fetch a single recommendation — fast (~1s) since Claude only generates one item
async function fetchOneLovedRec() {
  const lovedItems = Object.values(state.seen).filter(i => i.rating === 'loved');
  if (lovedItems.length === 0) return null;

  const titles = lovedItems.map(i => `"${i.title}" (${i.type}, ${i.year})`).join(', ');

  const excludeTitles = new Set();
  for (const item of Object.values(state.seen)) excludeTitles.add(item.title);
  for (const item of Object.values(state.want)) excludeTitles.add(item.title);
  for (const item of Object.values(state.nope)) excludeTitles.add(item.title);
  for (const item of lovedPool) excludeTitles.add(item.title);

  const excludeStr = excludeTitles.size > 0
    ? `\nDo NOT include any of these titles:\n${[...excludeTitles].map(t => `- ${t}`).join('\n')}`
    : '';

  const prompt = `You are a film and TV expert. The user loved: ${titles}
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
    if (lovedAllFetchedIds.has(item.id) || State.isKnown(item.id)) {
      return null;
    }
    lovedAllFetchedIds.add(item.id);
    return item;
  } catch(e) {
    console.error('Loved rec fetch error:', e);
    return null;
  }
}

// Pump: keeps up to LOVED_MAX_CONCURRENT requests in flight to maintain pool size
function lovedPump() {
  const available = getAvailableLovedItems();
  const needed = LOVED_TARGET_POOL - available.length - lovedInFlight;
  if (needed <= 0) return;

  const toFire = Math.min(needed, LOVED_MAX_CONCURRENT - lovedInFlight);
  for (let i = 0; i < toFire; i++) {
    lovedInFlight++;
    fetchOneLovedRec().then(item => {
      lovedInFlight--;
      if (item) {
        lovedPool.push(item);
        // If current page has a placeholder, replace the first one with this item
        const track = document.getElementById('loved-car-track');
        const ph = track && track.querySelector('.carousel-item-loading');
        if (ph) {
          const tmp = document.createElement('div');
          tmp.innerHTML = renderCarouselItem(item, true);
          ph.replaceWith(tmp.firstElementChild);
          loadCarouselPoster(item);
          loadTrailerBtnFor(item.id, item.title, item.year);
        }
      }
      updateLovedNav();
      // Keep pumping if we still need more
      lovedPump();
    });
  }
}

function getAvailableLovedItems() {
  return lovedPool.filter(i => !State.isKnown(i.id));
}

async function renderLovedCarousel() {
  const lovedItems = Object.values(state.seen).filter(i => i.rating === 'loved');
  const section = document.getElementById('loved-carousel');
  if (lovedItems.length === 0) {
    section.style.display = '';
    document.getElementById('loved-car-track').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text-muted)">
      <div style="font-size:1.5rem;margin-bottom:8px">❤️</div>
      <div>Rate shows in your <strong>Seen</strong> list with ❤️ to get personalized recommendations here.</div>
    </div>`;
    updateLovedNav();
    return;
  }
  section.style.display = '';

  // If loved list unchanged and we have pool items, just re-render
  const lovedKey = lovedItems.map(i => i.id).sort().join(',');
  if (lovedRecsCache && lovedRecsCache.key === lovedKey && lovedPool.length > 0) {
    displayLovedCarousel();
    lovedPump(); // top up pool in background
    return;
  }

  // Reset for new loved list
  lovedRecsCache = { key: lovedKey };
  lovedPool = [];
  lovedAllFetchedIds = new Set();
  lovedInFlight = 0;
  carouselState.loved.page = 0;

  // Show loading placeholders then start the pump
  const track = document.getElementById('loved-car-track');
  const cols = getCarouselPageSize();
  track.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const placeholder = `<div class="carousel-item carousel-item-loading"><div class="carousel-item-placeholder"><div class="loading-spinner" style="width:24px;height:24px;margin:0 auto"></div></div><div class="carousel-item-title" style="color:var(--text-muted)">Loading...</div></div>`;
  track.innerHTML = Array(cols).fill(placeholder).join('');
  updateLovedNav();
  lovedPump();
}

function displayLovedCarousel() {
  const available = getAvailableLovedItems();
  const cols = getCarouselPageSize();
  const track = document.getElementById('loved-car-track');
  track.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const s = carouselState.loved;
  const start = s.page * cols;
  const batch = available.slice(start, start + cols);

  const placeholder = `<div class="carousel-item carousel-item-loading"><div class="carousel-item-placeholder"><div class="loading-spinner" style="width:24px;height:24px;margin:0 auto"></div></div><div class="carousel-item-title" style="color:var(--text-muted)">Loading...</div></div>`;

  const hasLoved = Object.values(state.seen).some(i => i.rating === 'loved');
  let html = '';
  for (let i = 0; i < cols; i++) {
    if (batch[i]) {
      html += renderCarouselItem(batch[i], true);
    } else if (lovedInFlight > 0 || hasLoved) {
      html += placeholder;
    }
  }
  // Edge case: nothing loaded yet and nothing in flight and pump exhausted
  if (!html && available.length === 0 && lovedInFlight === 0 && !hasLoved && lovedPool.length > 0) {
    html = `<div style="grid-column:1/-1;text-align:center;padding:24px 16px;color:var(--text-muted)">No more recommendations available.</div>`;
  }

  track.innerHTML = html;
  batch.forEach(item => {
    loadCarouselPoster(item);
    loadTrailerBtnFor(item.id, item.title, item.year);
  });
  updateLovedNav();
}

function updateLovedNav() {
  const available = getAvailableLovedItems();
  const cols = getCarouselPageSize();
  const s = carouselState.loved;
  const prevBtn = document.getElementById('loved-car-prev');
  const nextBtn = document.getElementById('loved-car-next');
  if (prevBtn) prevBtn.disabled = s.page === 0;
  if (nextBtn) nextBtn.disabled = (s.page + 1) * cols >= available.length;
}

function replaceLovedCard(cardEl) {
  // Item was already added to seen/want/nope by the toggle function.
  // It's filtered out of getAvailableLovedItems() automatically.
  // Pump first so lovedInFlight is incremented before rendering placeholders.
  lovedPump();
  displayLovedCarousel();
}

function carouselPrev(type) {
  carouselState[type].page = Math.max(0, carouselState[type].page - 1);
  if (type === 'watchlist') renderWatchlistCarousel();
  else displayLovedCarousel();
}

function carouselNext(type) {
  carouselState[type].page++;
  if (type === 'watchlist') renderWatchlistCarousel();
  else {
    displayLovedCarousel();
    lovedPump(); // fetch more as user pages forward
  }
}

function initDiscoverCarousels() {
  renderWatchlistCarousel();
  renderLovedCarousel();
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
  document.getElementById('settings-menu').classList.remove('open');
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
      // Refresh current page
      const activePage = document.querySelector('.page.active');
      if (activePage) {
        if (activePage.id === 'page-seen') renderSeenList();
        else if (activePage.id === 'page-watchlist') renderWatchlist();
        else initDiscoverCarousels();
      }
    } catch(err) {
      showToast('Failed to read backup file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
  document.getElementById('settings-menu').classList.remove('open');
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

// ─── NAV ──────────────────────────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (page === 'watchlist') renderWatchlist();
  if (page === 'seen') renderSeenList();
}

function resetDiscover() {
  showPage('discover');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn').classList.add('active');
  document.getElementById('search-input').value = '';
  document.getElementById('featured-section').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('discover-carousels').style.display = '';
  viewHistory.length = 0;
  currentFeatured = null;
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
  if (!el) {
    // Close settings menu on outside click
    document.getElementById('settings-menu').classList.remove('open');
    return;
  }

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
    case 'toggle-settings':
      e.stopPropagation();
      document.getElementById('settings-menu').classList.toggle('open');
      break;

    // ─── SETTINGS ────────────────────────────────────────────────────
    case 'export-data':
      exportData();
      break;
    case 'import-click':
      document.getElementById('import-file').click();
      break;

    // ─── SEARCH ──────────────────────────────────────────────────────
    case 'do-search':
      doSearch();
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

  // Pre-cache TMDB ID and poster so subsequent lookups are instant
  const cacheKey = `${title}::${year}`;
  if (tmdbItem.id && !tmdbIdCache[cacheKey]) {
    tmdbIdCache[cacheKey] = { tmdbId: tmdbItem.id, mediaType };
  }
  if (tmdbItem.poster_path && !posterCache[cacheKey]) {
    posterCache[cacheKey] = `https://image.tmdb.org/t/p/w342${tmdbItem.poster_path}`;
  }

  return {
    id: normalizeId(title, year),
    title,
    type: isMovie ? 'Movie' : 'TV Show',
    year,
    genres,
    description
  };
}

async function fetchTmdbRecommendations(item, count = 4) {
  await fetchPoster(item.title, item.year);
  const info = getTmdbInfo(item.title, item.year);
  if (!info) return null;

  try {
    const res = await fetch(`/api/tmdb-recommendations?id=${info.tmdbId}&type=${info.mediaType}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const items = data.results
      .filter(r => r.overview && (r.title || r.name))
      .map(tmdbResultToItem);

    const filtered = filterResults(items).filter(i => !shownIds.has(i.id));
    return filtered.length > 0 ? filtered.slice(0, count) : null;
  } catch (err) {
    console.warn('TMDB recommendations failed:', err.message);
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

// ─── SEARCH ──────────────────────────────────────────────────────────────────
async function doSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;

  document.getElementById('featured-section').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('discover-carousels').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  document.getElementById('search-btn').disabled = true;
  viewHistory.length = 0;
  updateBackButton();

  try {
    const prompt = `You are a film and TV expert assistant for a streaming recommendation app called Flickpick.

The user searched for: "${query}"

Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "id": "unique-slug-no-spaces",
  "title": "Exact title",
  "type": "TV Show" or "Movie",
  "year": "2023",
  "genres": "Drama, Thriller",
  "description": "2-3 sentence description of what this show/movie is about.",
  "emoji": "single relevant emoji"
}

Return the single best match for the user's search. Use the real, well-known title. The "id" field must be lowercase with hyphens only.`;

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    const mainItem = normalizeItem(parseClaudeJSON(data.content[0].text));

    shownIds = new Set();
    suggestionPool = [];
    suggestionPageIdx = 0;
    poolFetching = false;
    renderFeatured(mainItem);

    document.getElementById('loading').style.display = 'none';
    document.getElementById('featured-section').style.display = 'block';

    // Show placeholder cards while TMDB similar items load
    const grid = document.getElementById('similar-grid');
    grid.innerHTML = Array(GRID_SIZE).fill(renderPlaceholderCard()).join('');

    // Fetch similar items from TMDB, fall back to Claude
    let similar = await fetchTmdbRecommendations(mainItem, GRID_SIZE);
    if (!similar) {
      similar = await fetchClaudeSimilar(mainItem.title, mainItem.type, mainItem.year, GRID_SIZE);
    }
    renderSimilar(similar || []);

  } catch(e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('search-btn').disabled = false;
  }

  document.getElementById('search-btn').disabled = false;
}

// ─── RENDER FEATURED ─────────────────────────────────────────────────────────
function renderFeatured(item) {
  registerItem(item);
  currentFeatured = item;
  const seenActive = state.seen[item.id] ? 'active' : '';
  const wantActive = state.want[item.id] ? 'active' : '';
  const nopeActive = state.nope[item.id] ? 'active' : '';
  const emoji = item.emoji || genreEmoji(item.genres);

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

  return `
    <div class="similar-card swapping-in" data-card-id="${item.id}">
      <div class="similar-poster-placeholder" data-poster-id="${item.id}" data-action="load-item" data-id="${item.id}">
        ${emoji}
      </div>
      <div class="similar-body" data-action="load-item" data-id="${item.id}">
        <div class="similar-title">${item.title}</div>
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
  const start = idx * GRID_SIZE;
  const items = suggestionPool.slice(start, start + GRID_SIZE);
  const grid = document.getElementById('similar-grid');
  // Pad with loading placeholders if we have fewer than GRID_SIZE items
  const placeholders = items.length < GRID_SIZE
    ? Array(GRID_SIZE - items.length).fill(renderPlaceholderCard()).join('')
    : '';
  grid.innerHTML = items.map(item => renderSingleCard(item)).join('') + placeholders;
  items.forEach(item => {
    loadPosterFor(item.id, item.title, item.year);
    loadTrailerBtnFor(item.id, item.title, item.year);
  });
  updateSimilarArrows();
}

function updateSimilarArrows() {
  const prevBtn = document.getElementById('similar-prev');
  const nextBtn = document.getElementById('similar-next');
  if (!prevBtn || !nextBtn) return;
  prevBtn.disabled = suggestionPageIdx <= 0;
  // Next is always available when we have a featured item (infinite scrolling)
  nextBtn.disabled = !currentFeatured;
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
  if (buffer >= POOL_BUFFER || poolFetching || !currentFeatured) return;
  poolFetching = true;
  updateSimilarArrows();

  try {
    const needed = POOL_BUFFER - buffer;

    // Try TMDB first — returns up to 20 items in one call
    let newItems = await fetchTmdbRecommendations(currentFeatured, needed);

    if (!newItems || newItems.length === 0) {
      // Fallback: Claude batch
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
  if (remainingBuffer < POOL_BUFFER && currentFeatured) {
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

  if (state.seen[nid]) {
    State.removeSeen(nid);
    btn.classList.remove('active');
    btn.textContent = isMini ? 'Seen' : 'Mark Seen';
    showToast(`Removed "${item.title}" from seen`);
  } else {
    State.addSeen(item);
    btn.classList.add('active');
    btn.textContent = isMini ? 'Seen' : '✓ Seen';
    showToast(`Marked "${item.title}" as seen`);
    if (isMini) {
      const card = btn.closest('.similar-card');
      if (card) { replaceCard(card); return; }
      const carCard = btn.closest('.carousel-item');
      if (carCard) { replaceLovedCard(carCard); return; }
    }
  }
}

// ─── TOGGLE NOPE ─────────────────────────────────────────────────────────────
function toggleNope(id, btn) {
  const item = getStoredItem(id);
  if (!item) return;
  const isMini = btn.classList.contains('mini-btn');
  const nid = normalizeId(item.title, item.year);

  if (state.nope[nid]) {
    State.removeNope(nid);
    btn.classList.remove('active');
    btn.textContent = isMini ? 'Nope' : 'Nope';
    showToast(`Removed "${item.title}" from nope list`);
  } else {
    State.addNope(item);
    btn.classList.add('active');
    btn.textContent = isMini ? '✕' : '✕ Noped';
    showToast(`"${item.title}" noped`);
    if (isMini) {
      const card = btn.closest('.similar-card');
      if (card) { replaceCard(card); return; }
      const carCard = btn.closest('.carousel-item');
      if (carCard) { replaceLovedCard(carCard); return; }
    }
  }
}

// ─── TOGGLE WANT ─────────────────────────────────────────────────────────────
function toggleWant(id, btn) {
  const item = getStoredItem(id);
  if (!item) return;
  const isMini = btn.classList.contains('mini-btn');
  const nid = normalizeId(item.title, item.year);

  if (state.want[nid]) {
    State.removeWant(nid);
    btn.classList.remove('active');
    btn.textContent = isMini ? 'Want' : '+ Watchlist';
    showToast(`Removed "${item.title}" from watchlist`);
  } else {
    State.addWant(item);
    btn.classList.add('active');
    btn.textContent = isMini ? '★' : '★ Saved';
    showToast(`Added "${item.title}" to watchlist`);
    if (isMini) {
      const card = btn.closest('.similar-card');
      if (card) { replaceCard(card); return; }
      const carCard = btn.closest('.carousel-item');
      if (carCard) { replaceLovedCard(carCard); return; }
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
  return `
    <div class="watchlist-card" id="${cardId}">
      <div class="watchlist-poster-placeholder clickable-title" data-wl-poster="${item.id}" data-action="load-item-direct" data-id="${item.id}">
        ${emoji}
      </div>
      <div class="watchlist-info">
        <div class="watchlist-header">
          <div class="watchlist-title clickable-title" data-action="load-item-direct" data-id="${item.id}">${item.title}</div>
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
  // Load poster
  fetchPoster(item.title, item.year).then(url => {
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
  return `
    <div class="watchlist-card" id="${cardId}">
      <div class="watchlist-poster-placeholder clickable-title" data-seen-poster="${item.id}" data-action="load-item-direct" data-id="${item.id}">
        ${emoji}
      </div>
      <div class="watchlist-info">
        <div class="watchlist-header">
          <div class="watchlist-title clickable-title" data-action="load-item-direct" data-id="${item.id}">${item.title}</div>
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
    case 'rating': items.sort((a, b) => (RATING_ORDER[a.rating] ?? 99) - (RATING_ORDER[b.rating] ?? 99) || a.title.localeCompare(b.title)); break;
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
