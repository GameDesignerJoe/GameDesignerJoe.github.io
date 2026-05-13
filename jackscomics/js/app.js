const BM = {
  1: { label: 'Box 1',       bg: '#2a1e06', accent: '#b8860b', text: '#f0d070' },
  2: { label: 'Box 2',       bg: '#081626', accent: '#1a5f90', text: '#80c0f0' },
  3: { label: 'Box 3',       bg: '#061a10', accent: '#1a7a45', text: '#70d090' },
  4: { label: 'Box 4 · Thor', bg: '#160830', accent: '#7040b0', text: '#c090f0' },
  5: { label: 'Box 5',       bg: '#200805', accent: '#a02010', text: '#f08070' },
};

let S = [];
let M = { series: {} }; // manifest
let bxF = 'all', srt = 'alpha-asc', keysOnly = false, srchTxt = '', compact = false;
const expanded = new Set();
const LS_COMPACT_KEY = 'jackscomics_compact';

// Wanted + claimed state. Tokens are "seriesId:issue".
const wants = new Set();
const claimed = new Set();
const LS_KEY = 'jackscomics_state';
const MOM_EMAIL = 'gollum@bak.rr.com';

// Token format: "seriesId:issue" (copy 0) or "seriesId:issue:c<N>" (copy 1+).
// Copy 0 is the original; copy 1+ are duplicates Jack owns of the same issue.
function tok(seriesId, issue, copy = 0) {
  return seriesId + ':' + issue + (copy > 0 ? ':c' + copy : '');
}

function parseTok(t) {
  const i = t.indexOf(':');
  const seriesId = t.slice(0, i);
  let issue = t.slice(i + 1);
  let copy = 0;
  const m = issue.match(/:c(\d+)$/);
  if (m) {
    copy = +m[1];
    issue = issue.slice(0, -m[0].length);
  }
  return { seriesId, issue, copy };
}

function serializeSet(set) {
  return [...set].map(t => {
    const i = t.indexOf(':');
    return t.slice(0, i) + ':' + encodeURIComponent(t.slice(i + 1));
  }).join(',');
}

function parseList(raw) {
  if (!raw) return [];
  return raw.split(',').map(t => {
    const i = t.indexOf(':');
    if (i < 0) return null;
    return t.slice(0, i) + ':' + decodeURIComponent(t.slice(i + 1));
  }).filter(Boolean);
}

function copyCountFor(s, issue) {
  const bare = issue.replace(/^#/, '');
  const dupes = s.dupes || [];
  const isDupe = dupes.includes(issue) || dupes.includes(bare);
  return isDupe ? 2 : 1;
}

function physicalCount(s) { return s.issues.length + (s.dupes ? s.dupes.length : 0); }

function claimedInSeries(seriesId) {
  let n = 0;
  const prefix = seriesId + ':';
  for (const t of claimed) if (t.startsWith(prefix)) n++;
  return n;
}

function wantedInSeries(seriesId) {
  let n = 0;
  const prefix = seriesId + ':';
  for (const t of wants) if (t.startsWith(prefix)) n++;
  return n;
}

function loadStateFromUrl() {
  const p = new URLSearchParams(location.search);
  const w = parseList(p.get('want'));
  const c = parseList(p.get('claimed'));
  if (w.length || c.length) {
    wants.clear(); claimed.clear();
    w.forEach(t => wants.add(t));
    c.forEach(t => claimed.add(t));
    return true;
  }
  return false;
}

function loadStateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    (o.want || []).forEach(t => wants.add(t));
    (o.claimed || []).forEach(t => claimed.add(t));
  } catch (e) { /* ignore */ }
}

function pushState() {
  const p = new URLSearchParams();
  if (wants.size) p.set('want', serializeSet(wants));
  if (claimed.size) p.set('claimed', serializeSet(claimed));
  const qs = p.toString();
  const url = location.pathname + (qs ? '?' + qs : '') + location.hash;
  history.replaceState(null, '', url);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      want: [...wants],
      claimed: [...claimed],
    }));
  } catch (e) { /* ignore quota */ }
}

function resetState() {
  wants.clear();
  claimed.clear();
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  pushState();
}

// Pick the first concrete issue number from a key's "issue" string.
// "#57" → "57", "#2–5" → "2", "KS-2/3/4" → "KS-2", "Annual 1" → "Annual 1"
function firstFromKeyIssue(keyIssueStr) {
  let s = keyIssueStr.replace(/^#/, '').trim();
  if (s.includes('–')) s = s.split('–')[0].trim();
  if (s.includes('/')) s = s.split('/')[0].trim();
  return s;
}

function getIssueData(seriesId, issue) {
  return M.series?.[seriesId]?.issues?.[issue] || null;
}

function pickCoverIssue(s) {
  if (s.keys.length > 0) {
    const candidate = firstFromKeyIssue(s.keys[0].issue);
    if (s.issues.includes(candidate)) {
      const data = getIssueData(s.id, candidate);
      if (data?.image_url) return { issue: candidate, ...data };
    }
  }
  for (const iss of s.issues) {
    const data = getIssueData(s.id, iss);
    if (data?.image_url) return { issue: iss, ...data };
  }
  return null;
}

// Find the matching key entry for an issue (handles ranges and slash-lists).
function keyForIssue(series, issue) {
  for (const k of series.keys) {
    const raw = k.issue.replace(/^#/, '').trim();
    if (raw === issue || raw === '#' + issue) return k;
    if (raw.includes('–')) {
      const [lo, hi] = raw.split('–').map(x => x.trim());
      const n = Number(issue), nlo = Number(lo), nhi = Number(hi);
      if (!Number.isNaN(n) && n >= nlo && n <= nhi) return k;
    }
    if (raw.includes('/')) {
      const parts = raw.split('/').map(x => x.trim());
      const [first] = parts;
      const prefix = first.match(/^[A-Za-z-]+/)?.[0] || '';
      const matches = parts.map(p => /^\d+$/.test(p) ? prefix + p : p);
      if (matches.includes(issue)) return k;
    }
  }
  return null;
}

function issueRange(issues) {
  const n = issues.filter(i => /^\d+$/.test(i));
  if (!n.length) return issues[0] + (issues.length > 1 ? '–' + issues[issues.length - 1] : '');
  if (n.length === 1) return '#' + n[0];
  return '#' + n[0] + ' – #' + n[n.length - 1];
}
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function estVal(s) { return s.midPrice * s.issues.length; }
function hasMissing(issues) {
  const n = issues.filter(i => /^\d+$/.test(i)).map(Number).sort((a, b) => a - b);
  for (let i = 1; i < n.length; i++) if (n[i] - n[i - 1] > 1) return true;
  return false;
}

function buildCard(s) {
  const d = BM[s.box];
  const inWant = bxF === 'want';
  const isOpen = compact || inWant || expanded.has(s.id);
  const keyNums = new Set(s.keys.flatMap(k => [k.issue.replace(/^#/, ''), k.issue]));
  const gaps = hasMissing(s.issues);
  const ev = estVal(s);
  const wantedCount = wantedInSeries(s.id);
  const claimedCount = claimedInSeries(s.id);
  const totalBooks = physicalCount(s);
  const remainingBooks = totalBooks - claimedCount;

  // Each (issue, copy) pair is one physical book — duplicates render as their own pill.
  const pillEntries = [];
  for (const iss of s.issues) {
    const copies = copyCountFor(s, iss);
    for (let c = 0; c < copies; c++) pillEntries.push({ iss, copy: c });
  }
  const entriesToShow = inWant
    ? pillEntries.filter(e => {
        const t = tok(s.id, e.iss, e.copy);
        return wants.has(t) || claimed.has(t);
      })
    : pillEntries;

  const pillsHtml = entriesToShow.map(e => {
    const t = tok(s.id, e.iss, e.copy);
    const bare = e.iss.replace(/^#/, '');
    let c = 'pill';
    if (keyNums.has(bare) || keyNums.has(e.iss)) c += ' ik';
    if (wants.has(t)) c += ' wanted';
    if (claimed.has(t)) c += ' claimed';
    return `<span class="${c}" data-series="${esc(s.id)}" data-issue="${esc(e.iss)}" data-copy="${e.copy}">${esc(e.iss)}</span>`;
  }).join('');

  if (compact) {
    return `<div class="card compact" id="card-${s.id}" data-box="${s.box}" data-id="${s.id}">
<div class="cbody">
  <div class="ctitle">${esc(s.title)} <span class="cyear">${s.year}</span></div>
  <div class="ilist open">${pillsHtml || '<span class="empty-pills">(nothing matched)</span>'}</div>
</div>
</div>`;
  }

  const issueCountLabel = remainingBooks + ' issue' + (remainingBooks !== 1 ? 's' : '');

  const keysHtml = s.keys.length ? `<div class="keys">${s.keys.map(k => `
<div class="kr"><span class="knum">${esc(k.issue)}</span><div class="ki"><div class="knote">${esc(k.note)}</div><div class="kprice">${esc(k.price)}</div></div></div>`).join('')}</div>` : '';

  const cover = pickCoverIssue(s);
  const coverImg = cover ? `<img class="cv-img" src="${esc(cover.image_url)}" alt="${esc(s.title)} cover" loading="lazy" referrerpolicy="no-referrer">` : '';
  const coverClass = cover ? 'cover has-img' : 'cover';

  return `<div class="card" id="card-${s.id}" data-box="${s.box}" data-id="${s.id}">
<div class="${coverClass}" style="background:${d.bg}">
  <div class="cv-bg" style="background:linear-gradient(150deg,${d.bg},${d.accent}20)"></div>
  <div class="cv-accent" style="background:${d.accent}"></div>
  ${coverImg}
  <div class="cv-content">
    <div class="cv-abbr" style="color:${d.text}">${esc(s.abbr)}</div>
    <div class="cv-yr" style="color:${d.text}">${s.year}</div>
  </div>
  <span class="cv-chip" style="color:${d.text}">${esc(d.label.toUpperCase())}</span>
  <a class="cv-link" style="color:${d.text}" href="${esc(s.url)}" target="_blank" rel="noopener">view on fandom ↗</a>
</div>
<div class="body">
  <div class="stitle">${esc(s.title)}</div>
  <div class="meta">
    <span class="yr">${s.year}</span>
    <span class="cnt">${esc(issueCountLabel)}</span>
    <span>${esc(issueRange(s.issues))}</span>
    ${gaps ? '<span style="color:var(--text-d)">has gaps</span>' : ''}
    ${s.dupes.length ? `<span style="color:var(--gold-d)">${s.dupes.length} dupl.</span>` : ''}
  </div>
  <div class="prow">
    <span class="pval">${esc(s.priceRange)}</span>
    <span class="plbl">/ issue · Fair/Good</span>
  </div>
  <div class="pest">Est. run value: ~$${Math.round(ev).toLocaleString()} at midpoint × ${s.issues.length} issues</div>
  ${keysHtml}
  <div class="cnote">${esc(s.note)}</div>
  ${inWant
    ? `<div class="wantsum">${wantedCount} wanted${claimedCount ? ` · ${claimedCount} claimed` : ''}</div>`
    : `<button class="itoggle" data-toggle="${esc(s.id)}">${isOpen ? '▼ HIDE ISSUE LIST' : `▶ SHOW ALL ${remainingBooks} ISSUES`}</button>`}
  <div class="ilist ${isOpen ? 'open' : ''}" id="il-${s.id}">${pillsHtml}</div>
</div>
</div>`;
}

function toggleSeries(id) {
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  const el = document.getElementById('card-' + id);
  if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildCard(S.find(s => s.id === id));
  el.replaceWith(tmp.firstChild);
}

function seriesHasWantOrClaim(s) {
  const prefix = s.id + ':';
  for (const t of wants) if (t.startsWith(prefix)) return true;
  for (const t of claimed) if (t.startsWith(prefix)) return true;
  return false;
}

function getVis() {
  let list = S.filter(s => {
    if (bxF === 'want') {
      if (!seriesHasWantOrClaim(s)) return false;
    } else if (bxF !== 'all') {
      if (s.box !== +bxF) return false;
    }
    if (keysOnly && !s.keys.length) return false;
    if (srchTxt && !s.title.toLowerCase().includes(srchTxt.toLowerCase())) return false;
    return true;
  });
  list.sort((a, b) => {
    switch (srt) {
      case 'alpha-asc':  return a.title.localeCompare(b.title);
      case 'alpha-desc': return b.title.localeCompare(a.title);
      case 'year-asc':   return a.year - b.year;
      case 'year-desc':  return b.year - a.year;
      case 'count-desc': return b.issues.length - a.issues.length;
      case 'count-asc':  return a.issues.length - b.issues.length;
      case 'value-desc': return estVal(b) - estVal(a);
      default:           return 0;
    }
  });
  return list;
}

function render() {
  const vis = getVis();
  const grid = document.getElementById('grid');
  grid.classList.toggle('compact', compact);
  grid.innerHTML = vis.length ? vis.map(buildCard).join('') : '<div class="empty">NO SERIES MATCH YOUR FILTERS</div>';
  const vi = vis.reduce((acc, c) => acc + physicalCount(c) - claimedInSeries(c.id), 0);
  const vv = vis.reduce((s, c) => s + estVal(c), 0);
  document.getElementById('rl').textContent = `Showing ${vis.length} of ${S.length} series · ${vi} issues`;
  document.getElementById('vt').textContent = vis.length ? `Est. visible value: ~$${Math.round(vv).toLocaleString()} (Fair/Good midpoints)` : '';
}

function renderTabs() {
  const tabs = ['all', '1', '2', '3', '4', '5', 'want'];
  document.getElementById('btabs').innerHTML = tabs.map(b => {
    let lbl;
    if (b === 'all') lbl = 'ALL';
    else if (b === 'want') {
      const n = wants.size;
      lbl = '★ WANT' + (n ? ` (${n})` : '');
    } else lbl = BM[+b].label.toUpperCase();
    const extra = b === 'want' ? ' wantbtn' : '';
    return `<button class="${bxF === b ? 'act' : ''}${extra}" data-box-filter="${b}">${lbl}</button>`;
  }).join('');
}

function renderStats() {
  const totalBooks = S.reduce((a, c) => a + physicalCount(c), 0);
  const remainingBooks = totalBooks - claimed.size;
  const totalKeys = S.reduce((a, c) => a + c.keys.length, 0);
  const totalVal = S.reduce((s, c) => s + estVal(c), 0);
  const claimedSuffix = claimed.size ? ` <span style="color:var(--text-d)">(${claimed.size} claimed)</span>` : '';
  document.getElementById('hstats').innerHTML =
    `<b>${S.length}</b> SERIES &nbsp;·&nbsp; <b>${remainingBooks}</b> ISSUES${claimedSuffix}<br>` +
    `<b>${totalKeys}</b> KEY ISSUES &nbsp;·&nbsp; EST. TOTAL <b>~$${Math.round(totalVal).toLocaleString()}</b>`;
}

function toggleWant(seriesId, issue, copy) {
  const t = tok(seriesId, issue, copy);
  // A claimed item is locked — must un-claim before removing from wants.
  if (claimed.has(t)) return;
  if (wants.has(t)) wants.delete(t);
  else wants.add(t);
  pushState();
  rerenderCard(seriesId);
  renderTabs();
  renderStats();
  updateControls();
  if (bxF === 'want') render(); // refilter if series newly has/loses wants
  refreshDrawerIfOpen(seriesId, issue, copy);
}

function toggleClaim(seriesId, issue, copy) {
  const t = tok(seriesId, issue, copy);
  if (claimed.has(t)) {
    claimed.delete(t);
  } else {
    claimed.add(t);
    wants.add(t); // claiming implies wanting — keeps the two states coherent
  }
  pushState();
  render(); // claimed count affects header/row totals, so do a full re-render
  renderTabs();
  renderStats();
  updateControls();
  refreshDrawerIfOpen(seriesId, issue, copy);
}

function refreshDrawerIfOpen(seriesId, issue, copy) {
  const drawer = document.getElementById('drawer');
  if (drawer.classList.contains('open')
      && drawer.dataset.series === seriesId
      && drawer.dataset.issue === issue
      && +drawer.dataset.copy === +copy) {
    openDrawer(seriesId, issue, copy);
  }
}

function rerenderCard(seriesId) {
  const el = document.getElementById('card-' + seriesId);
  if (!el) return;
  const s = S.find(x => x.id === seriesId);
  if (!s) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildCard(s);
  el.replaceWith(tmp.firstChild);
}

function openDrawer(seriesId, issue, copy = 0) {
  copy = +copy || 0;
  const s = S.find(x => x.id === seriesId);
  if (!s) return;
  const data = getIssueData(seriesId, issue);
  const key = keyForIssue(s, issue);
  const totalCopies = copyCountFor(s, issue);

  document.getElementById('dr-title').textContent = s.title;
  const issueLabel = /^\d+$/.test(issue) ? `#${issue}` : issue;
  const coverDate = data?.cover_date ? new Date(data.cover_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const subParts = [`${s.year} series`, issueLabel];
  if (totalCopies > 1) subParts.push(`copy ${copy + 1} of ${totalCopies}`);
  if (coverDate) subParts.push(coverDate);
  document.getElementById('dr-sub').textContent = subParts.join(' · ');

  const body = document.getElementById('dr-body');
  const parts = [];

  if (data?.image_url) {
    parts.push(`<div class="dr-imgbox"><img src="${esc(data.image_url)}" alt="${esc(s.title)} ${esc(issueLabel)} cover" referrerpolicy="no-referrer"></div>`);
  } else {
    parts.push(`<div class="dr-imgbox"><div class="dr-missing">NO COVER IMAGE AVAILABLE<br><span style="opacity:.6">ComicVine has no record of this issue</span></div></div>`);
  }

  if (key) {
    parts.push(`<div class="dr-key">
      <div class="dr-key-tag">KEY ISSUE — ${esc(key.issue)}</div>
      <div class="dr-key-note">${esc(key.note)}</div>
      <div class="dr-key-price">${esc(key.price)}</div>
    </div>`);
  }

  parts.push(`<div class="dr-section">
    <div class="dr-lbl">Estimated value</div>
    <div class="dr-val-row">
      <span class="dr-val">${esc(s.priceRange)}</span>
      <span class="dr-val-lbl">/ issue · Fair/Good</span>
    </div>
    ${totalCopies > 1 ? `<div class="dr-dup">Jack has ${totalCopies} copies of this issue — you're viewing copy ${copy + 1}.</div>` : ''}
  </div>`);

  if (data?.name && data.name.trim()) {
    parts.push(`<div class="dr-section">
      <div class="dr-lbl">Issue title</div>
      <div style="font-family:var(--serif);font-size:15px;color:var(--text)">${esc(data.name)}</div>
    </div>`);
  }

  parts.push(`<div class="dr-section">
    <div class="dr-lbl">About the series</div>
    <div style="font-family:var(--serif);font-size:14px;color:var(--text);line-height:1.55;font-style:italic">${esc(s.note)}</div>
  </div>`);

  if (data?.cv_id) {
    parts.push(`<a class="dr-cv-link" href="https://comicvine.gamespot.com/issue/4000-${data.cv_id}/" target="_blank" rel="noopener">View on ComicVine ↗</a>`);
  }

  const t = tok(seriesId, issue, copy);
  const isWant = wants.has(t);
  const isClaimed = claimed.has(t);
  const wantDisabled = isClaimed ? ' disabled title="Already claimed — un-claim first"' : '';
  parts.unshift(`<div class="dr-actions">
    <button class="dr-act dr-want${isWant ? ' on' : ''}" data-drawer-want${wantDisabled}>${isWant ? '★ WANTED' : '☆ ADD TO WANTS'}</button>
    <button class="dr-act dr-claim${isClaimed ? ' on' : ''}" data-drawer-claim>${isClaimed ? '✓ CLAIMED — UNDO' : 'MARK AS CLAIMED'}</button>
  </div>`);

  body.innerHTML = parts.join('');
  body.scrollTop = 0;

  const drawer = document.getElementById('drawer');
  drawer.dataset.series = seriesId;
  drawer.dataset.issue = issue;
  drawer.dataset.copy = String(copy);
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  const drawer = document.getElementById('drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

function wireControls() {
  document.getElementById('srt').addEventListener('change', e => { srt = e.target.value; render(); });
  document.getElementById('kbtn').addEventListener('click', function () {
    keysOnly = !keysOnly;
    this.classList.toggle('act', keysOnly);
    render();
  });
  document.getElementById('srch').addEventListener('input', e => { srchTxt = e.target.value; render(); });

  document.getElementById('btabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-box-filter]');
    if (!btn) return;
    bxF = btn.dataset.boxFilter;
    renderTabs();
    render();
  });

  document.getElementById('grid').addEventListener('click', e => {
    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      e.stopPropagation();
      toggleSeries(tog.dataset.toggle);
      return;
    }
    if (e.target.closest('.cv-link')) {
      e.stopPropagation();
      return;
    }
    const pill = e.target.closest('.pill[data-series][data-issue]');
    if (pill) {
      e.stopPropagation();
      openDrawer(pill.dataset.series, pill.dataset.issue, +pill.dataset.copy || 0);
    }
  });

  document.getElementById('dr-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const emailOpen = document.getElementById('email-modal').classList.contains('open');
    if (emailOpen) closeEmailForm();
    else closeDrawer();
  });

  document.getElementById('drawer').addEventListener('click', e => {
    const drawer = e.currentTarget;
    const seriesId = drawer.dataset.series;
    const issue = drawer.dataset.issue;
    const copy = +drawer.dataset.copy || 0;
    if (!seriesId) return;
    if (e.target.closest('[data-drawer-want]')) toggleWant(seriesId, issue, copy);
    else if (e.target.closest('[data-drawer-claim]')) toggleClaim(seriesId, issue, copy);
  });

  document.getElementById('compactbtn').addEventListener('click', function () {
    compact = !compact;
    this.classList.toggle('act', compact);
    this.textContent = compact ? '▤ DETAILED' : '▦ COMPACT';
    try { localStorage.setItem(LS_COMPACT_KEY, compact ? '1' : '0'); } catch (e) {}
    render();
  });
  document.getElementById('emailbtn').addEventListener('click', openEmailForm);
  document.getElementById('email-close').addEventListener('click', closeEmailForm);
  document.getElementById('email-modal').addEventListener('click', e => {
    // Click on the dim backdrop (but not inside the .modal box) closes the form
    if (e.target === e.currentTarget) closeEmailForm();
  });
  document.getElementById('email-budget').addEventListener('input', regenerateEmailBody);
  document.getElementById('send-gmail').addEventListener('click', sendViaGmail);
  document.getElementById('send-outlook').addEventListener('click', sendViaOutlook);
  document.getElementById('send-copy').addEventListener('click', sendViaCopy);
  document.getElementById('copywants').addEventListener('click', copyWantList);
  document.getElementById('copylink').addEventListener('click', copyShareUrl);
  document.getElementById('resetbtn').addEventListener('click', () => {
    if (wants.size === 0 && claimed.size === 0) return;
    if (!confirm('Clear all wants and claims? This cannot be undone.')) return;
    resetState();
    renderTabs();
    updateControls();
    render();
  });

  const mToggle = document.getElementById('m-toggle');
  if (mToggle) {
    mToggle.addEventListener('click', () => {
      const header = document.querySelector('header');
      const open = header.classList.toggle('expanded');
      mToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      mToggle.textContent = open ? '▴ FEWER OPTIONS' : '▾ MORE OPTIONS';
    });
  }
}

function buildWantListBody(budget) {
  const groups = new Map();
  for (const t of wants) {
    const p = parseTok(t);
    if (!groups.has(p.seriesId)) groups.set(p.seriesId, []);
    groups.get(p.seriesId).push(p.issue);
  }
  const lines = ['Hi Mom — here\'s the list of comics I\'d like:', ''];
  if (budget && budget.trim()) {
    lines.push(`Budget: ${budget.trim()}`);
    lines.push('');
  }
  for (const s of S) {
    const issues = groups.get(s.id);
    if (!issues || !issues.length) continue;
    lines.push(`${s.title.toUpperCase()} (${s.year})`);
    const orderIdx = new Map(s.issues.map((iss, i) => [iss, i]));
    issues.sort((a, b) => (orderIdx.get(a) ?? 999) - (orderIdx.get(b) ?? 999));
    for (const iss of issues) {
      const key = keyForIssue(s, iss);
      const label = /^\d+$/.test(iss) ? '#' + iss : iss;
      if (key) lines.push(`  ${label} — ${key.note} (${key.price})`);
      else lines.push(`  ${label}`);
    }
    lines.push('');
  }
  lines.push('Open this link to see covers and details. When you grab one for me,');
  lines.push('click it and hit "MARK AS CLAIMED" — then forward the new link to');
  lines.push('anyone else who\'s helping look:');
  lines.push('');
  lines.push(location.href);
  lines.push('');
  lines.push('Thanks!');
  lines.push('— Jack');
  return lines.join('\n');
}

function openEmailForm() {
  if (wants.size === 0) return;
  document.getElementById('email-subject').value = `Jack's comic want list (${wants.size} issue${wants.size === 1 ? '' : 's'})`;
  document.getElementById('email-budget').value = '';
  document.getElementById('email-body').value = buildWantListBody('');
  const modal = document.getElementById('email-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  // Focus subject after a tick so the slide-in completes first
  setTimeout(() => document.getElementById('email-subject').focus(), 50);
}

function closeEmailForm() {
  const modal = document.getElementById('email-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function regenerateEmailBody() {
  const budget = document.getElementById('email-budget').value;
  document.getElementById('email-body').value = buildWantListBody(budget);
}

function sendViaGmail() {
  const subject = document.getElementById('email-subject').value;
  const body = document.getElementById('email-body').value;
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(MOM_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank', 'noopener');
}

function sendViaOutlook() {
  const subject = document.getElementById('email-subject').value;
  const body = document.getElementById('email-body').value;
  const url = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(MOM_EMAIL)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank', 'noopener');
}

async function sendViaCopy() {
  const subject = document.getElementById('email-subject').value;
  const body = document.getElementById('email-body').value;
  const fullText = `To: ${MOM_EMAIL}\nSubject: ${subject}\n\n${body}`;
  try {
    await navigator.clipboard.writeText(fullText);
    const btn = document.getElementById('send-copy');
    const original = btn.textContent;
    btn.textContent = '✓ COPIED — paste into any email';
    btn.classList.add('act');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('act'); }, 2200);
  } catch (e) {
    alert('Copy failed. Select the message text below and copy manually.');
  }
}

async function copyWantList() {
  if (wants.size === 0) return;
  const btn = document.getElementById('copywants');
  // Group by series, preserve original issue order
  const groups = new Map();
  for (const t of wants) {
    const p = parseTok(t);
    if (!groups.has(p.seriesId)) groups.set(p.seriesId, []);
    groups.get(p.seriesId).push(p.issue);
  }
  const lines = [];
  for (const s of S) {
    const issues = groups.get(s.id);
    if (!issues || !issues.length) continue;
    const orderIdx = new Map(s.issues.map((iss, i) => [iss, i]));
    issues.sort((a, b) => (orderIdx.get(a) ?? 999) - (orderIdx.get(b) ?? 999));
    for (const iss of issues) {
      const label = /^\d+$/.test(iss) ? '#' + iss : iss;
      lines.push(`${s.title} ${label}`);
    }
  }
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    const original = btn.textContent;
    btn.textContent = '✓ COPIED';
    btn.classList.add('act');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('act'); }, 1500);
  } catch (e) {
    alert('Copy failed.');
  }
}

async function copyShareUrl() {
  const btn = document.getElementById('copylink');
  try {
    await navigator.clipboard.writeText(location.href);
    const original = btn.textContent;
    btn.textContent = '✓ COPIED';
    btn.classList.add('act');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('act'); }, 1500);
  } catch (e) {
    alert('Copy failed — URL: ' + location.href);
  }
}

function updateControls() {
  const hasWants = wants.size > 0;
  const hasAny = hasWants || claimed.size > 0;
  document.getElementById('emailbtn').disabled = !hasWants;
  document.getElementById('copywants').disabled = !hasWants;
  document.getElementById('copylink').disabled = !hasAny;
  document.getElementById('resetbtn').disabled = !hasAny;
  const banner = document.getElementById('modebanner');
  if (banner) {
    if (bxF === 'want' && hasWants) {
      const remaining = [...wants].filter(t => !claimed.has(t)).length;
      const claimedCount = claimed.size;
      banner.style.display = 'block';
      banner.innerHTML = `<strong>Jack's want list</strong> · ${remaining} still needed${claimedCount ? ` · ${claimedCount} already claimed` : ''}. ` +
        `Click any issue to view; use <em>MARK AS CLAIMED</em> when you have one. Then use <em>COPY LINK</em> to share the updated list.`;
    } else {
      banner.style.display = 'none';
    }
  }
}

async function init() {
  const [seriesRes, manifestRes] = await Promise.all([
    fetch('./series.json'),
    fetch('./manifest.json').catch(() => null),
  ]);
  if (!seriesRes.ok) throw new Error(`Failed to load series.json: ${seriesRes.status}`);
  S = await seriesRes.json();
  if (manifestRes?.ok) {
    M = await manifestRes.json();
  } else {
    console.warn('manifest.json not available; covers will fall back to abbreviation blocks');
  }

  // State: URL is authoritative if present; otherwise hydrate from localStorage.
  const fromUrl = loadStateFromUrl();
  if (!fromUrl) loadStateFromLocalStorage();
  // If URL had wants, default to the WANT tab so recipients land on the filtered view.
  if (fromUrl && wants.size > 0) bxF = 'want';
  // Make sure the URL reflects state (especially when hydrated only from localStorage).
  pushState();

  // Compact mode is a view preference; persist across sessions but not in URL.
  try { compact = localStorage.getItem(LS_COMPACT_KEY) === '1'; } catch (e) {}
  const cbtn = document.getElementById('compactbtn');
  if (cbtn) {
    cbtn.classList.toggle('act', compact);
    cbtn.textContent = compact ? '▤ DETAILED' : '▦ COMPACT';
  }

  renderStats();
  renderTabs();
  wireControls();
  render();
  updateControls();
}

init().catch(err => {
  console.error(err);
  document.getElementById('grid').innerHTML = `<div class="empty">FAILED TO LOAD COLLECTION: ${esc(err.message)}</div>`;
});
