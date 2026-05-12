import { loadSettings, saveSettings, isConfigured, renderSettingsForm, readSettingsForm, PROVIDERS } from './settings.js';

const $ = (sel) => document.querySelector(sel);

// ---------- Settings modal ----------

function openSettings() {
  const modal = $('#settings-modal');
  renderSettingsForm($('#settings-form'));
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  $('#cs-save').addEventListener('click', handleSaveSettings);
  $('#cs-test').addEventListener('click', handleTestSettings);
}

function closeSettings() {
  const modal = $('#settings-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function handleSaveSettings() {
  const s = readSettingsForm($('#settings-form'));
  if (!s.provider) return setStatus('Pick a provider first.', 'err');
  if (!s.apiKey) return setStatus('Enter an API key.', 'err');
  if (!s.model) return setStatus('Enter a model name.', 'err');
  if (PROVIDERS[s.provider]?.needsEndpoint && !s.endpoint) return setStatus('Custom provider requires an endpoint URL.', 'err');
  saveSettings(s);
  setStatus('Saved.', 'ok');
  updateConfiguredBadge();
  setTimeout(closeSettings, 500);
}

async function handleTestSettings() {
  const s = readSettingsForm($('#settings-form'));
  if (!s.provider || !s.apiKey || !s.model) { setStatus('Fill all required fields first.', 'err'); return; }
  setStatus('Testing… (using a tiny built-in test image)', '');
  // 1x1 white PNG as a minimal test image
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
  try {
    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...s, image: testImage }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setStatus('Connection works. Provider responded.', 'ok');
    } else {
      setStatus(`Failed: ${json.error || res.statusText}`, 'err');
    }
  } catch (err) {
    setStatus(`Network error: ${err.message}`, 'err');
  }
}

function setStatus(msg, kind) {
  const el = $('#cs-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'cs-status ' + (kind || '');
}

function updateConfiguredBadge() {
  const ok = isConfigured();
  $('#config-badge').textContent = ok ? '✓ configured' : '⚠ not configured';
  $('#config-badge').classList.toggle('ok', ok);
  $('#identify-btn').disabled = !ok || !$('#file-input').files.length;
}

// ---------- Image upload + identify ----------

let currentImage = null;
let currentResult = null;

async function handleFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) { currentImage = null; $('#identify-btn').disabled = true; return; }
  const dataUrl = await fileToDataUrl(file);
  currentImage = dataUrl;
  $('#preview-img').src = dataUrl;
  $('#preview').classList.add('show');
  $('#identify-btn').disabled = !isConfigured();
  $('#result').classList.remove('show');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function handleIdentify() {
  if (!currentImage) return;
  if (!isConfigured()) { openSettings(); return; }

  const settings = loadSettings();
  setBusy(true, 'Asking AI to identify the comic…');
  $('#result').classList.remove('show');
  $('#error-box').textContent = '';

  try {
    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...settings, image: currentImage }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

    const comic = json.comic;
    currentResult = { ai: comic, cv: null };
    renderAiResult(comic);

    // Phase 2: pass the AI's guess to ComicVine for canonical data.
    setBusy(true, 'Looking up canonical details on ComicVine…');
    const cvRes = await fetch(
      `/api/comicvine?title=${encodeURIComponent(comic.title)}&year=${comic.year ?? ''}&issue=${encodeURIComponent(comic.issue || '')}`,
      { method: 'GET' }
    );
    const cvJson = await cvRes.json();
    if (cvRes.ok && cvJson.ok) {
      currentResult.cv = cvJson;
      renderComicVineResult(cvJson, comic);
    } else {
      renderComicVineMiss(cvJson?.error || `HTTP ${cvRes.status}`, comic);
    }
  } catch (err) {
    $('#error-box').textContent = `Failed: ${err.message}`;
  } finally {
    setBusy(false);
  }
}

function renderAiResult(comic) {
  $('#ai-title').textContent = comic.title || '(unknown title)';
  $('#ai-issue').textContent = comic.issue ? `#${comic.issue}` : '';
  $('#ai-year').textContent = comic.year || '';
  $('#ai-publisher').textContent = comic.publisher || '';
  $('#ai-confidence').textContent = comic.confidence;
  $('#ai-confidence').className = 'badge conf-' + comic.confidence;
  $('#result').classList.add('show');
  $('#cv-section').innerHTML = '<div class="cv-loading">looking up…</div>';
}

function renderComicVineResult(cvJson, aiComic) {
  const v = cvJson.volume;
  const i = cvJson.issue;
  const parts = [];
  parts.push(`<div class="cv-row"><span class="cv-lbl">Volume</span><span class="cv-val">${esc(v.name)} (${v.start_year || '?'})${v.publisher ? ' · ' + esc(v.publisher) : ''}</span></div>`);
  if (i) {
    parts.push(`<div class="cv-row"><span class="cv-lbl">Issue</span><span class="cv-val">#${esc(i.issue_number)}${i.name ? ' — ' + esc(i.name) : ''}</span></div>`);
    if (i.cover_date) parts.push(`<div class="cv-row"><span class="cv-lbl">Cover date</span><span class="cv-val">${esc(i.cover_date)}</span></div>`);
    if (i.image_url) parts.push(`<div class="cv-cover-wrap"><img class="cv-cover" src="${esc(i.image_url)}" alt="canonical cover" referrerpolicy="no-referrer"></div>`);
    parts.push(`<a class="cv-link" href="${esc(i.cv_detail_url)}" target="_blank" rel="noopener">View on ComicVine ↗</a>`);
  } else {
    parts.push(`<div class="cv-row"><span class="cv-lbl">Issue</span><span class="cv-val cv-missing">Couldn't find issue #${esc(aiComic.issue)} in this volume — may be wrong volume or issue number.</span></div>`);
  }
  $('#cv-section').innerHTML = parts.join('');
}

function renderComicVineMiss(error, aiComic) {
  $('#cv-section').innerHTML = `<div class="cv-missing">ComicVine lookup failed: ${esc(error)}<br>The AI guessed "${esc(aiComic.title)}${aiComic.issue ? ' #' + aiComic.issue : ''}" — maybe wrong, try a clearer photo or edit the search manually.</div>`;
}

function setBusy(busy, msg) {
  $('#identify-btn').disabled = busy || !isConfigured() || !currentImage;
  $('#busy-msg').textContent = busy ? (msg || '') : '';
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// ---------- Wiring ----------

function init() {
  $('#gear-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#settings-modal').classList.contains('open')) closeSettings();
  });
  $('#file-input').addEventListener('change', handleFileSelected);
  $('#identify-btn').addEventListener('click', handleIdentify);

  updateConfiguredBadge();
  if (!isConfigured()) openSettings();
}

init();
