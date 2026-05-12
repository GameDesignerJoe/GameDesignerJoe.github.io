import { loadSettings, saveSettings, isConfigured, renderSettingsForm, readSettingsForm, PROVIDERS } from './settings.js';
import { listComics, countComics, getComic, addComic, updateComic, removeComic, exportJSON, importJSON } from './collection.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
let currentResult = null;       // { ai, cv, edited (bool) }
let savedComicId = null;        // set after SAVE so user sees "saved" state
let cameraStream = null;
let cameraFacing = 'environment'; // 'environment' = rear, 'user' = front

// ---------- Live camera ----------

function cameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

async function openCamera() {
  if (!cameraSupported()) {
    $('#camera-error').textContent = 'Camera is not available on this browser/device. Use CHOOSE FILE instead.';
    $('#camera-section').classList.add('show');
    return;
  }
  $('#camera-error').textContent = '';
  $('#camera-section').classList.add('show');
  $('#preview').classList.remove('show');
  $('#result').classList.remove('show');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: cameraFacing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    cameraStream = stream;
    const video = $('#camera-video');
    video.srcObject = stream;
    // iOS Safari: play() must be triggered, even though autoplay is set
    try { await video.play(); } catch (_) { /* autoplay restrictions; user gesture already happened */ }
  } catch (err) {
    let msg = err?.message || String(err);
    if (err?.name === 'NotAllowedError') msg = 'Camera permission denied. Allow camera access in your browser settings.';
    else if (err?.name === 'NotFoundError') msg = 'No camera found on this device.';
    else if (err?.name === 'NotReadableError') msg = 'Camera is already in use by another app.';
    $('#camera-error').textContent = msg;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = $('#camera-video');
  if (video) video.srcObject = null;
}

function closeCamera() {
  stopCamera();
  $('#camera-section').classList.remove('show');
}

async function flipCamera() {
  cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
  stopCamera();
  await openCamera();
}

function captureFromCamera() {
  const video = $('#camera-video');
  if (!video.videoWidth || !video.videoHeight) {
    $('#camera-error').textContent = 'Camera is still warming up — wait a second and try again.';
    return;
  }
  const canvas = $('#camera-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  currentImage = dataUrl;
  $('#preview-img').src = dataUrl;
  $('#preview').classList.add('show');
  closeCamera();
  $('#identify-btn').disabled = !isConfigured();
}

// ---------- File upload ----------

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
  // Pre-fill the edit fields so user can tweak immediately if AI is wrong.
  $('#edit-title').value = comic.title || '';
  $('#edit-issue').value = comic.issue || '';
  $('#edit-year').value = comic.year || '';
  $('#edit-publisher').value = comic.publisher || '';
  // Reset save state
  savedComicId = null;
  const sb = $('#save-btn');
  sb.disabled = false;
  sb.textContent = '+ SAVE TO COLLECTION';
  sb.classList.remove('saved');
  $('#save-status').textContent = '';
  $('#edit-section').classList.remove('open');
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

// ---------- Save / edit / re-lookup ----------

function buildSaveRecord() {
  if (!currentResult) return null;
  const ai = currentResult.ai || {};
  const cv = currentResult.cv || null;
  const i = cv?.issue || null;
  const v = cv?.volume || null;
  // If user edited, those values override the AI's
  const edited = currentResult.edited || {};
  return {
    title: edited.title ?? (v?.name || ai.title || ''),
    issue: edited.issue ?? (i?.issue_number ?? ai.issue ?? ''),
    year: edited.year ?? (v?.start_year ?? ai.year ?? null),
    publisher: edited.publisher ?? (v?.publisher || ai.publisher || ''),
    cover_url: i?.image_url || null,
    cv_volume_id: v?.id || null,
    cv_issue_id: i?.cv_id || null,
    cv_cover_date: i?.cover_date || null,
    cv_detail_url: i?.cv_detail_url || null,
    issue_name: i?.name || '',
    ai_original: { ...ai },
    user_corrected: !!currentResult.edited,
  };
}

function handleSave() {
  if (!currentResult || savedComicId) return;
  const record = buildSaveRecord();
  const saved = addComic(record);
  savedComicId = saved.id;
  const sb = $('#save-btn');
  sb.textContent = '✓ SAVED TO COLLECTION';
  sb.classList.add('saved');
  sb.disabled = true;
  $('#save-status').textContent = `Added to collection. ${countComics()} comic${countComics() === 1 ? '' : 's'} saved.`;
  updateCollectionCount();
}

function toggleEditSection() {
  $('#edit-section').classList.toggle('open');
}

async function handleRelookup() {
  const editedTitle = $('#edit-title').value.trim();
  const editedIssue = $('#edit-issue').value.trim();
  const editedYearRaw = $('#edit-year').value.trim();
  const editedYear = editedYearRaw ? Number(editedYearRaw) : null;
  const editedPublisher = $('#edit-publisher').value.trim();

  if (!editedTitle) { $('#save-status').textContent = 'Title is required for re-lookup.'; return; }

  // Mark as edited so SAVE uses these values
  currentResult.edited = {
    title: editedTitle,
    issue: editedIssue,
    year: editedYear,
    publisher: editedPublisher,
  };

  // Update the visible AI section to reflect the corrected values
  $('#ai-title').textContent = editedTitle;
  $('#ai-issue').textContent = editedIssue ? `#${editedIssue}` : '';
  $('#ai-year').textContent = editedYear || '';
  $('#ai-publisher').textContent = editedPublisher || '';

  // Reset save UI in case the user already saved before realizing it was wrong
  savedComicId = null;
  const sb = $('#save-btn');
  sb.disabled = false;
  sb.textContent = '+ SAVE TO COLLECTION';
  sb.classList.remove('saved');

  $('#cv-section').innerHTML = '<div class="cv-loading">re-looking up on ComicVine…</div>';
  try {
    const cvRes = await fetch(
      `/api/comicvine?title=${encodeURIComponent(editedTitle)}&year=${editedYear ?? ''}&issue=${encodeURIComponent(editedIssue)}`,
      { method: 'GET' }
    );
    const cvJson = await cvRes.json();
    if (cvRes.ok && cvJson.ok) {
      currentResult.cv = cvJson;
      renderComicVineResult(cvJson, { title: editedTitle, issue: editedIssue, year: editedYear, publisher: editedPublisher });
    } else {
      currentResult.cv = null;
      renderComicVineMiss(cvJson?.error || `HTTP ${cvRes.status}`, { title: editedTitle, issue: editedIssue });
    }
  } catch (err) {
    currentResult.cv = null;
    renderComicVineMiss(err.message, { title: editedTitle, issue: editedIssue });
  }
}

// ---------- Tabs ----------

function setActiveView(viewName) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === viewName));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${viewName}`));
  if (viewName === 'collection') {
    closeCamera(); // stop the camera if user switches tabs while it's open
    renderCollection();
  }
}

function updateCollectionCount() {
  const n = countComics();
  $('#col-count').textContent = n ? `(${n})` : '';
}

// ---------- Collection view ----------

function renderCollection() {
  const list = listComics();
  const stats = $('#col-stats');
  const listEl = $('#col-list');
  stats.innerHTML = `<strong>${list.length}</strong> comic${list.length === 1 ? '' : 's'} in your collection`;

  if (list.length === 0) {
    listEl.innerHTML = `<div class="collection-empty">No comics saved yet.<br>Switch to the <strong>Identify</strong> tab, scan a cover, and click <strong>SAVE TO COLLECTION</strong>.</div>`;
    return;
  }

  listEl.innerHTML = `<div class="collection-grid">${list.map(renderCollectionCard).join('')}</div>`;
}

function renderCollectionCard(c) {
  const cover = c.cover_url
    ? `<img class="col-cover" src="${esc(c.cover_url)}" alt="${esc(c.title)} cover" loading="lazy" referrerpolicy="no-referrer">`
    : `<div class="col-cover-missing">📕</div>`;
  const issueLabel = c.issue ? ` #${esc(c.issue)}` : '';
  const meta = [c.year, c.publisher].filter(Boolean).map(esc).join(' · ');
  return `<div class="col-card" data-id="${esc(c.id)}">
    <div class="col-cover-wrap">${cover}</div>
    <div class="col-body">
      <div class="col-title">${esc(c.title || '(untitled)')}${issueLabel}</div>
      <div class="col-meta">${meta || '—'}</div>
    </div>
  </div>`;
}

function openCollectionDetail(id) {
  const c = getComic(id);
  if (!c) return;
  $('#detail-title').textContent = c.title || '(untitled)';
  const subParts = [];
  if (c.issue) subParts.push(`#${c.issue}`);
  if (c.year) subParts.push(String(c.year));
  if (c.publisher) subParts.push(c.publisher);
  $('#detail-sub').textContent = subParts.join(' · ');

  const parts = [];
  if (c.cover_url) parts.push(`<img src="${esc(c.cover_url)}" alt="cover" referrerpolicy="no-referrer">`);
  parts.push('<div class="detail-info">');
  if (c.cv_cover_date) parts.push(`<div class="detail-row"><span class="detail-lbl">Cover date</span><span class="detail-val">${esc(c.cv_cover_date)}</span></div>`);
  if (c.issue_name) parts.push(`<div class="detail-row"><span class="detail-lbl">Issue title</span><span class="detail-val">${esc(c.issue_name)}</span></div>`);
  if (c.added_at) parts.push(`<div class="detail-row"><span class="detail-lbl">Added</span><span class="detail-val">${esc(new Date(c.added_at).toLocaleString())}</span></div>`);
  if (c.user_corrected) parts.push(`<div class="detail-row"><span class="detail-lbl">AI guess</span><span class="detail-val" style="color:#9a9aa0;font-size:13px">${esc(c.ai_original?.title || '?')} #${esc(c.ai_original?.issue || '?')} (${esc(c.ai_original?.confidence || '?')}) — you corrected this</span></div>`);
  parts.push('</div>');
  parts.push(`<div class="detail-notes-section">
    <div class="detail-lbl" style="margin-bottom:5px">Notes</div>
    <textarea class="detail-notes" id="detail-notes" placeholder="add any notes (condition, where you got it, etc.)">${esc(c.notes || '')}</textarea>
  </div>`);
  parts.push(`<div class="detail-actions">
    ${c.cv_detail_url ? `<a class="btn-secondary" href="${esc(c.cv_detail_url)}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center;">View on ComicVine ↗</a>` : ''}
    <button class="btn-secondary" id="detail-save-notes">SAVE NOTES</button>
    <button class="btn-danger" id="detail-remove" style="margin-left:auto">REMOVE</button>
  </div>`);

  $('#detail-body').innerHTML = parts.join('');
  const modal = $('#detail-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  modal.dataset.id = id;

  $('#detail-save-notes').addEventListener('click', () => {
    const notes = $('#detail-notes').value;
    updateComic(id, { notes });
    $('#detail-save-notes').textContent = '✓ NOTES SAVED';
    setTimeout(() => { $('#detail-save-notes').textContent = 'SAVE NOTES'; }, 1200);
  });
  $('#detail-remove').addEventListener('click', () => {
    if (!confirm('Remove this comic from your collection?')) return;
    removeComic(id);
    closeDetailModal();
    renderCollection();
    updateCollectionCount();
  });
}

function closeDetailModal() {
  const modal = $('#detail-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.dataset.id = '';
}

function handleExport() {
  const json = exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comic-collection-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImportClick() {
  $('#col-import-input').click();
}

async function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const { added, skipped } = importJSON(text);
    alert(`Imported ${added} comic${added === 1 ? '' : 's'}.${skipped > 0 ? ` Skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}.` : ''}`);
    renderCollection();
    updateCollectionCount();
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  } finally {
    e.target.value = '';
  }
}

// ---------- Wiring ----------

function init() {
  $('#gear-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  $('#detail-close').addEventListener('click', closeDetailModal);
  $('#detail-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDetailModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#detail-modal').classList.contains('open')) return closeDetailModal();
    if ($('#settings-modal').classList.contains('open')) return closeSettings();
  });

  $('#file-input').addEventListener('change', handleFileSelected);
  $('#identify-btn').addEventListener('click', handleIdentify);

  // Camera viewfinder
  if (cameraSupported()) {
    $('#camera-open-btn').addEventListener('click', openCamera);
    $('#camera-cancel').addEventListener('click', closeCamera);
    $('#camera-capture').addEventListener('click', captureFromCamera);
    $('#camera-flip').addEventListener('click', flipCamera);
  } else {
    $('#camera-open-btn').hidden = true;
  }
  // Also stop the stream if the page is hidden (e.g., user backgrounds the tab)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
  });

  // Save / edit / re-lookup
  $('#save-btn').addEventListener('click', handleSave);
  $('#edit-toggle-btn').addEventListener('click', toggleEditSection);
  $('#relookup-btn').addEventListener('click', handleRelookup);

  // Tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => setActiveView(t.dataset.view)));

  // Collection toolbar + clicks
  $('#col-export').addEventListener('click', handleExport);
  $('#col-import').addEventListener('click', handleImportClick);
  $('#col-import-input').addEventListener('change', handleImportFile);
  $('#col-list').addEventListener('click', (e) => {
    const card = e.target.closest('.col-card');
    if (card) openCollectionDetail(card.dataset.id);
  });

  updateConfiguredBadge();
  updateCollectionCount();
  if (!isConfigured()) openSettings();
}

init();
