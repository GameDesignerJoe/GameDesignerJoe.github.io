const BM = {
  1: { label: 'Box 1',       bg: '#2a1e06', accent: '#b8860b', text: '#f0d070' },
  2: { label: 'Box 2',       bg: '#081626', accent: '#1a5f90', text: '#80c0f0' },
  3: { label: 'Box 3',       bg: '#061a10', accent: '#1a7a45', text: '#70d090' },
  4: { label: 'Box 4 · Thor', bg: '#160830', accent: '#7040b0', text: '#c090f0' },
  5: { label: 'Box 5',       bg: '#200805', accent: '#a02010', text: '#f08070' },
};

let S = [];
let M = { series: {} }; // manifest
let bxF = 'all', srt = 'alpha-asc', keysOnly = false, srchTxt = '';
const expanded = new Set();

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
  const isOpen = expanded.has(s.id);
  const keyNums = new Set(s.keys.flatMap(k => [k.issue.replace(/^#/, ''), k.issue]));
  const dupeSet = new Set(s.dupes);
  const gaps = hasMissing(s.issues);
  const ev = estVal(s);

  const pillsHtml = s.issues.map(iss => {
    const bare = iss.replace(/^#/, '');
    let c = 'pill';
    if (keyNums.has(bare) || keyNums.has(iss)) c += ' ik';
    if (dupeSet.has(bare) || dupeSet.has(iss)) c += ' id';
    return `<span class="${c}" data-series="${esc(s.id)}" data-issue="${esc(iss)}">${esc(iss)}</span>`;
  }).join('');

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
    <span class="cnt">${s.issues.length} issue${s.issues.length !== 1 ? 's' : ''}</span>
    <span>${esc(issueRange(s.issues))}</span>
    ${gaps ? '<span style="color:var(--text-d)">has gaps</span>' : ''}
    ${s.dupes.length ? `<span style="color:var(--gold-d)">${s.dupes.length} dupl.</span>` : ''}
  </div>
  <div class="prow">
    <span class="pval">${esc(s.priceRange)}</span>
    <span class="plbl">/ issue · VG–FN</span>
  </div>
  <div class="pest">Est. run value: ~$${Math.round(ev).toLocaleString()} at midpoint × ${s.issues.length} issues</div>
  ${keysHtml}
  <div class="cnote">${esc(s.note)}</div>
  <button class="itoggle" data-toggle="${esc(s.id)}">${isOpen ? '▼ HIDE ISSUE LIST' : `▶ SHOW ALL ${s.issues.length} ISSUES`}</button>
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

function getVis() {
  let list = S.filter(s => {
    if (bxF !== 'all' && s.box !== +bxF) return false;
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
  grid.innerHTML = vis.length ? vis.map(buildCard).join('') : '<div class="empty">NO SERIES MATCH YOUR FILTERS</div>';
  const vi = vis.reduce((s, c) => s + c.issues.length, 0);
  const vv = vis.reduce((s, c) => s + estVal(c), 0);
  document.getElementById('rl').textContent = `Showing ${vis.length} of ${S.length} series · ${vi} issues`;
  document.getElementById('vt').textContent = vis.length ? `Est. visible value: ~$${Math.round(vv).toLocaleString()} (VG–FN midpoints)` : '';
}

function renderTabs() {
  document.getElementById('btabs').innerHTML =
    ['all', '1', '2', '3', '4', '5'].map(b => {
      const lbl = b === 'all' ? 'ALL' : BM[+b].label.toUpperCase();
      return `<button class="${bxF === b ? 'act' : ''}" data-box-filter="${b}">${lbl}</button>`;
    }).join('');
}

function renderStats() {
  const totalIssues = S.reduce((a, c) => a + c.issues.length, 0);
  const totalKeys = S.reduce((a, c) => a + c.keys.length, 0);
  const totalVal = S.reduce((s, c) => s + estVal(c), 0);
  document.getElementById('hstats').innerHTML =
    `<b>${S.length}</b> SERIES &nbsp;·&nbsp; <b>${totalIssues}</b> ISSUES<br>` +
    `<b>${totalKeys}</b> KEY ISSUES &nbsp;·&nbsp; EST. TOTAL <b>~$${Math.round(totalVal).toLocaleString()}</b>`;
}

function openDrawer(seriesId, issue) {
  const s = S.find(x => x.id === seriesId);
  if (!s) return;
  const data = getIssueData(seriesId, issue);
  const key = keyForIssue(s, issue);
  const isDup = s.dupes.includes(issue) || s.dupes.includes(issue.replace(/^#/, ''));

  document.getElementById('dr-title').textContent = s.title;
  const issueLabel = /^\d+$/.test(issue) ? `#${issue}` : issue;
  const coverDate = data?.cover_date ? new Date(data.cover_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const subParts = [`${s.year} series`, issueLabel];
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
      <span class="dr-val-lbl">/ issue · VG–FN</span>
    </div>
    ${isDup ? `<div class="dr-dup">Jack has a duplicate copy of this issue.</div>` : ''}
  </div>`);

  if (data?.name && data.name.trim()) {
    parts.push(`<div class="dr-section">
      <div class="dr-lbl">Issue title</div>
      <div style="font-family:var(--serif);font-size:13px;color:var(--text)">${esc(data.name)}</div>
    </div>`);
  }

  parts.push(`<div class="dr-section">
    <div class="dr-lbl">About the series</div>
    <div style="font-family:var(--serif);font-size:12px;color:var(--text-m);line-height:1.5;font-style:italic">${esc(s.note)}</div>
  </div>`);

  if (data?.cv_id) {
    parts.push(`<a class="dr-cv-link" href="https://comicvine.gamespot.com/issue/4000-${data.cv_id}/" target="_blank" rel="noopener">View on ComicVine ↗</a>`);
  }

  body.innerHTML = parts.join('');
  body.scrollTop = 0;

  const drawer = document.getElementById('drawer');
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
      openDrawer(pill.dataset.series, pill.dataset.issue);
    }
  });

  document.getElementById('dr-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });
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
  renderStats();
  renderTabs();
  wireControls();
  render();
}

init().catch(err => {
  console.error(err);
  document.getElementById('grid').innerHTML = `<div class="empty">FAILED TO LOAD COLLECTION: ${esc(err.message)}</div>`;
});
