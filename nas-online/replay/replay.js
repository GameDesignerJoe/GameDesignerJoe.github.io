// Not All Will Survive: the replay player. Plays back a run the sim recorded ("watch it play": the gear menu's
// Download / Copy sim log; js/sim/trace.js says what's in it): the explorer's path over the painted map, the camp,
// the lost explorer's site, the bear, the pup tent, the body being brought home, deaths; the events along a
// timeline; the sim's own decisions scrolling past as they were made; the body's values as small graphs.
// Load by dropping the file, picking it, pasting it, or ?log=<url>. Space plays / pauses, the arrows step.
import { SIGNAL } from '../js/palette.js';

const $ = s => document.querySelector(s);
const MAP_URL = '../assets/map-sharp.webp', TILE_URL = (x, y) => `../assets/tiles/4/${x}_${y}.webp`;
const TILE = 128, GUT = 4, TILE_MIN = 1.6;          // as js/world/map.js: 128 world px a tile, 512 px core + gutter
const INK = '#262626', PAPER = '#f2f2f0';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };

// --- the run --------------------------------------------------------------------------------------------
let R = null;                    // { stats, log, trace, summary, dur, decisions, events, ... }
let runs = [];                   // the runs found in the loaded log
const V = { t: 0, playing: false, speed: 16, follow: true, cam: { x: 1232, y: 928, z: 0.5 }, dragging: null, lastCap: -1 };

// index of the last sample at or before t (tenths of a second in [0] of each)
function idx(arr, t) {
  const k = t * 10;
  let lo = 0, hi = arr.length - 1;
  if (!arr.length || arr[0][0] > k) return -1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m][0] <= k) lo = m; else hi = m - 1; }
  return lo;
}
const at = (arr, t) => { const i = idx(arr, t); return i < 0 ? null : arr[i]; };

function load(obj) {
  runs = [];
  const add = (d, label) => { if (d && d.trace && d.trace.pos?.length) runs.push({ d, label }); };
  add(obj.current, `run ${obj.current?.stats?.run ?? ''} (latest)`);
  add(obj.previous, `run ${obj.previous?.stats?.run ?? ''} (the one before)`);
  if (obj.trace) add(obj, `run ${obj.stats?.run ?? ''}`);
  if (!runs.length) throw new Error(obj.runs ? 'This log has run summaries but no recorded trace (recorded before replays existed?). Record a new run.' : 'No recorded run in this file.');
  const pick = $('#runpick');
  pick.innerHTML = runs.map((r, i) => `<option value="${i}">${r.label}</option>`).join('');
  pick.hidden = runs.length < 2;
  pick.onchange = () => open(runs[+pick.value].d);
  open(runs[0].d);
  $('#loader').hidden = true;
}

const CAT = {
  milestone: new Set(['distress', 'wrap', 'goal']),
  danger: new Set(['death', 'bear', 'breakthrough', 'plunge', 'impact', 'peel', 'expedition', 'crack', 'fall', 'injury', 'snag']),
  camp: new Set(['tent', 'pitch', 'strike']),
};
const catOf = type => (CAT.milestone.has(type) ? 'milestone' : CAT.danger.has(type) ? 'danger' : CAT.camp.has(type) ? 'camp' : 'care');

function open(d) {
  const T = d.trace, st = d.stats || {}, t0 = st.t0 ?? 0;
  const last = Math.max(T.pos[T.pos.length - 1]?.[0] ?? 0, T.body[T.body.length - 1]?.[0] ?? 0, ...(T.ev.length ? [T.ev[T.ev.length - 1][0]] : [0])) / 10;
  R = {
    d, T, st, summary: d.summary,
    dur: Math.max(last, (d.summary?.minutes?.total ?? 0) * 60),
    decisions: (d.log || []).map(e => ({ ...e, rt: e.t - t0 })),
    events: T.ev.map(e => ({ t: e[0] / 10, type: e[1], text: e[2], x: e[3], y: e[4], cat: catOf(e[1]) })),
  };
  const find = re => R.events.find(e => re.test(e.text));
  R.found = find(/^Found the body/); R.home = find(/^Brought them home/); R.wrapped = find(/^Wrapped the body/);
  R.deaths = R.events.filter(e => e.type === 'death');
  // the header: what this run was
  const s = d.summary, out = s?.outcome ?? 'unfinished';
  const party = (T.party || []).join(', ');
  $('#meta').textContent = `${party || 'the explorer'} · ${T.forecast} · ${out === 'home' ? 'brought them home' : out === 'died' ? 'did not come home' : out}`
    + (s?.minutes ? ` · found ${s.minutes.firstFind ?? '-'} min, home ${s.minutes.home ?? '-'} min` : '') + ` · recorded ${T.started?.slice(0, 16).replace('T', ' ') ?? ''}`;
  buildLog();
  V.t = 0; V.playing = false; V.logI = -2;
  statsLayer = null; tlLayer = null;
  fit();
  V.follow = true; $('#follow').classList.add('on');
  setPlaying(true);
}

// --- the map --------------------------------------------------------------------------------------------
const cv = $('#map'), cx = cv.getContext('2d');
const mapImg = new Image();
mapImg.src = MAP_URL;
const tiles = new Map();
function tile(x, y) {
  const k = x + '_' + y;
  let t = tiles.get(k);
  if (!t) { t = new Image(); t.src = TILE_URL(x, y); tiles.set(k, t); }
  return t.complete && t.naturalWidth ? t : null;
}
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  for (const c of [$('#stats'), $('#timeline')]) { const b = c.getBoundingClientRect(); c.width = Math.round(b.width * DPR); c.height = Math.round(b.height * DPR); }
  statsLayer = null; tlLayer = null;
}
addEventListener('resize', resize);

function fit() {
  if (!R) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const take = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  for (const p of R.T.pos) take(p[1], p[2]);
  const m = R.T.marks;
  if (m.sos) take(m.sos.x, m.sos.y);
  take(m.tent.x, m.tent.y);
  const pad = 60;
  V.cam.x = (x0 + x1) / 2; V.cam.y = (y0 + y1) / 2;
  V.cam.z = Math.min(W / (x1 - x0 + pad * 2), H / (y1 - y0 + pad * 2), 3);
}

function explorerAt(t) {
  const P = R.T.pos, i = idx(P, t);
  if (i < 0) return { x: P[0][1], y: P[0][2], f: P[0][3] };
  const a = P[i], b = P[i + 1];
  if (!b || b[0] - a[0] > 60) return { x: a[1], y: a[2], f: a[3] };
  const k = (t * 10 - a[0]) / (b[0] - a[0]);
  let df = ((b[3] - a[3] + 540) % 360) - 180;
  return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, f: a[3] + df * k };
}

function drawMap() {
  const z = V.cam.z, T = R?.T;
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.fillStyle = '#dcdcd9'; cx.fillRect(0, 0, W, H);
  if (!R) { if (mapImg.complete) { const s = Math.max(W / 2464, H / 1856); cx.globalAlpha = 0.5; cx.drawImage(mapImg, (W - 2464 * s) / 2, (H - 1856 * s) / 2, 2464 * s, 1856 * s); cx.globalAlpha = 1; } return; }
  const t = V.t, me = explorerAt(t);
  if (V.follow && !V.dragging) { V.cam.x += (me.x - V.cam.x) * 0.12; V.cam.y += (me.y - V.cam.y) * 0.12; }
  cx.save();
  cx.translate(W / 2, H / 2); cx.scale(z, z); cx.translate(-V.cam.x, -V.cam.y);
  // the painting, crisp tiles once zoomed in
  if (mapImg.complete) cx.drawImage(mapImg, 0, 0);
  if (z * DPR >= TILE_MIN) {
    const x0 = Math.max(0, Math.floor((V.cam.x - W / 2 / z) / TILE)), x1 = Math.min(19, Math.floor((V.cam.x + W / 2 / z) / TILE));
    const y0 = Math.max(0, Math.floor((V.cam.y - H / 2 / z) / TILE)), y1 = Math.min(14, Math.floor((V.cam.y + H / 2 / z) / TILE));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const im = tile(tx, ty); if (im) cx.drawImage(im, GUT, GUT, 512, 512, tx * TILE, ty * TILE, TILE, TILE); }
  }
  // a paper wash, so the ink of the route reads over the painting; darker by night
  const wx = at(T.wx, t), night = wx && wx[1] >= 180;
  cx.fillStyle = night ? 'rgba(30,38,58,0.24)' : 'rgba(242,242,240,0.36)';
  cx.fillRect(0, 0, 2464, 1856);
  const px = v => v / z;   // screen px -> world

  // the whole route, faint and dashed; walked so far in ink; the last half minute heavier
  const P = T.pos, iNow = idx(P, t);
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  cx.setLineDash([px(3), px(4)]); cx.lineWidth = px(1); cx.strokeStyle = 'rgba(38,38,38,0.25)';
  path(P, 0, P.length - 1); cx.stroke(); cx.setLineDash([]);
  if (iNow >= 0) {
    cx.lineWidth = px(1.6); cx.strokeStyle = 'rgba(38,38,38,0.7)';
    path(P, 0, iNow, me); cx.stroke();
    const iRecent = Math.max(0, idx(P, t - 30));
    cx.lineWidth = px(2.6); cx.strokeStyle = INK;
    path(P, iRecent, iNow, me); cx.stroke();
  }
  // where things happened, so far: small marks along the way
  for (const e of R.events) {
    if (e.t > t) break;
    if (e.cat === 'care') continue;
    cx.beginPath(); cx.arc(e.x, e.y, px(e.cat === 'milestone' ? 4 : 2.6), 0, 7);
    cx.fillStyle = e.cat === 'milestone' ? SIGNAL.lit : e.cat === 'danger' ? INK : '#777'; cx.fill();
    cx.lineWidth = px(1); cx.strokeStyle = PAPER; cx.stroke();
  }

  const m = T.marks;
  // camp: the tent and the sled
  glyphTent(m.tent.x, m.tent.y - 4, px(9), SIGNAL.lit);
  cx.fillStyle = '#555'; cx.fillRect(m.sled.x - px(6), m.sled.y - px(2), px(12), px(4));
  label('camp', m.tent.x + px(12), m.tent.y - px(2));
  // the lost explorer: the beacon blinking until they're found, then the empty hollow
  if (m.sos) {
    const found = R.found && t >= R.found.t, wrapped = R.wrapped && t >= R.wrapped.t;
    cx.beginPath(); cx.arc(m.sos.x, m.sos.y, px(7), 0, 7); cx.lineWidth = px(2); cx.strokeStyle = INK; cx.stroke();
    if (!found && (t * 1.6) % 1.6 < 0.5) { cx.beginPath(); cx.arc(m.sos.x, m.sos.y, px(3.5), 0, 7); cx.fillStyle = SIGNAL.glow; cx.fill(); }
    if (!wrapped) { cx.beginPath(); cx.arc(m.sos.x, m.sos.y, px(2), 0, 7); cx.fillStyle = INK; cx.fill(); }
    label(found ? (wrapped ? 'where they lay' : 'the lost explorer (found)') : 'the lost explorer', m.sos.x + px(11), m.sos.y + px(4));
  }
  // the pup tent, while it stands
  const pu = at(T.pup, t);
  if (pu && pu[1] !== null) glyphTent(pu[1], pu[2] - 3, px(7), '#9a9a9a');
  // the wrapped body
  const bu = at(T.bundle, t);
  if (bu && t >= (R.wrapped?.t ?? 0)) {
    cx.lineWidth = px(5); cx.strokeStyle = INK; cx.beginPath(); cx.moveTo(bu[1], bu[2]); cx.lineTo(bu[3], bu[4]); cx.stroke();
    cx.lineWidth = px(3.2); cx.strokeStyle = '#ece9df'; cx.stroke();
  }
  // the bear: where it's been lately, and where it is
  const B = T.bear, ib = idx(B, t);
  if (ib >= 0) {
    const j0 = Math.max(0, idx(B, t - 25));
    cx.lineWidth = px(1.2); cx.strokeStyle = 'rgba(38,38,38,0.35)'; cx.setLineDash([px(2), px(3)]);
    path(B, j0, ib); cx.stroke(); cx.setLineDash([]);
    const b = B[ib];
    cx.beginPath(); cx.arc(b[1], b[2], px(5), 0, 7); cx.fillStyle = b[3] === 'dead' ? '#999' : INK; cx.fill();
    cx.lineWidth = px(1.2); cx.strokeStyle = PAPER; cx.stroke();
    const hunting = ['stalk', 'warn', 'charge', 'maul', 'rip'].includes(b[3]);
    label(`bear${b[3] !== 'pause' && b[3] !== 'walk' ? ': ' + b[3] : ''}`, b[1] + px(8), b[2] - px(6), hunting ? '#000' : '#555', hunting);
  }
  // deaths
  for (const e of R.deaths) if (t >= e.t) { cross(e.x, e.y, px(7)); label(e.text, e.x + px(9), e.y + px(4), '#000', true); }
  if (R.home && t >= R.home.t) label('home', m.tent.x - px(36), m.tent.y + px(14), SIGNAL.deep, true);
  // the explorer
  const mode = at(T.mode, t)?.[1] ?? 'walk', hidden = mode === 'inside' || mode === 'gone' || mode === 'dead';
  // gone (the last of the party dead): the explorer stays where they fell (the cross); nothing walks on
  if (mode === 'gone' || (R.deaths.length && t >= R.deaths[R.deaths.length - 1].t && (T.party?.length ?? 1) <= R.deaths.length)) { cx.restore(); return; }
  const a = me.f * Math.PI / 180;
  cx.beginPath(); cx.moveTo(me.x, me.y); cx.lineTo(me.x + Math.cos(a) * px(11), me.y + Math.sin(a) * px(11)); cx.lineWidth = px(1.8); cx.strokeStyle = INK; cx.stroke();
  cx.beginPath(); cx.arc(me.x, me.y, px(6), 0, 7);
  cx.fillStyle = hidden ? 'rgba(242,242,240,0.6)' : SIGNAL.lit; cx.fill();
  cx.lineWidth = px(2); cx.strokeStyle = INK; cx.stroke();
  if (mode !== 'walk') label(mode, me.x + px(9), me.y + px(16), '#333');
  cx.restore();
}
function path(arr, i0, i1, endAt = null) {
  cx.beginPath();
  if (i0 > i1 || !arr.length) return;
  cx.moveTo(arr[i0][1], arr[i0][2]);
  for (let i = i0 + 1; i <= i1; i++) {
    // (a jump: a new member at camp, or the gone explorer's view moved to the empty camp)
    if (arr[i][0] - arr[i - 1][0] > 600 || Math.abs(arr[i][1] - arr[i - 1][1]) + Math.abs(arr[i][2] - arr[i - 1][2]) > 80) cx.moveTo(arr[i][1], arr[i][2]);
    else cx.lineTo(arr[i][1], arr[i][2]);
  }
  if (endAt && Math.abs(endAt.x - arr[i1][1]) + Math.abs(endAt.y - arr[i1][2]) < 80) cx.lineTo(endAt.x, endAt.y);
}
function glyphTent(x, y, s, fill) {
  cx.beginPath(); cx.moveTo(x, y - s); cx.lineTo(x + s, y + s * 0.6); cx.lineTo(x - s, y + s * 0.6); cx.closePath();
  cx.fillStyle = fill; cx.fill(); cx.lineWidth = s * 0.18; cx.strokeStyle = INK; cx.stroke();
}
function cross(x, y, s) {
  cx.lineWidth = s * 0.32; cx.strokeStyle = INK; cx.lineCap = 'butt';
  cx.beginPath(); cx.moveTo(x, y - s); cx.lineTo(x, y + s); cx.moveTo(x - s * 0.6, y - s * 0.35); cx.lineTo(x + s * 0.6, y - s * 0.35); cx.stroke();
  cx.lineCap = 'round';
}
function label(text, x, y, colour = '#333', bold = false) {
  const z = V.cam.z;
  cx.save();
  cx.translate(x, y); cx.scale(1 / z, 1 / z);
  cx.font = `${bold ? 'bold ' : ''}italic 12px Georgia, serif`;
  cx.lineWidth = 3.5; cx.strokeStyle = 'rgba(242,242,240,0.9)'; cx.strokeText(text, 0, 0);
  cx.fillStyle = colour; cx.fillText(text, 0, 0);
  cx.restore();
}

// zoom at the cursor, drag to pan (follow lets go), double-click to follow again
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left - W / 2, my = e.clientY - r.top - H / 2;
  const z0 = V.cam.z, z1 = clamp(z0 * Math.exp(-e.deltaY * 0.0015), 0.25, 8);
  V.cam.x += mx / z0 - mx / z1; V.cam.y += my / z0 - my / z1; V.cam.z = z1;
}, { passive: false });
cv.addEventListener('pointerdown', e => { V.dragging = { x: e.clientX, y: e.clientY, cx: V.cam.x, cy: V.cam.y }; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
cv.addEventListener('pointermove', e => {
  const d = V.dragging;
  if (!d) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) setFollow(false);
  V.cam.x = d.cx - (e.clientX - d.x) / V.cam.z; V.cam.y = d.cy - (e.clientY - d.y) / V.cam.z;
});
cv.addEventListener('pointerup', () => { V.dragging = null; cv.classList.remove('drag'); });
cv.addEventListener('dblclick', () => setFollow(true));
function setFollow(on) { V.follow = on; $('#follow').classList.toggle('on', on); if (on && V.cam.z < 1.5) V.cam.z = 2; }
$('#follow').onclick = () => setFollow(!V.follow);
$('#fit').onclick = () => { setFollow(false); fit(); };

// --- the decisions --------------------------------------------------------------------------------------
function buildLog() {
  const ol = $('#log');
  ol.innerHTML = '';
  for (const e of R.decisions) {
    const li = document.createElement('li');
    li.className = 'k-' + e.kind.toLowerCase();
    li.innerHTML = `<span class="t">${fmt(e.rt)}</span><span class="k">${e.kind}</span>${escape(e.text)}`;
    li.onclick = () => { V.t = clamp(e.rt, 0, R.dur); };
    ol.append(li);
    e.li = li;
  }
}
const escape = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function updateLog() {
  const D = R.decisions;
  let lo = -1, hi = D.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (D[m].rt <= V.t) lo = m; else hi = m - 1; }
  if (lo === V.logI) return;
  const prev = V.logI;
  V.logI = lo;
  const a = Math.min(prev, lo), b = Math.max(prev, lo);
  for (let i = Math.max(0, a - 1); i <= Math.min(D.length - 1, b + 1); i++) { D[i].li.classList.toggle('past', i <= lo); D[i].li.classList.toggle('cur', i === lo); }
  if (prev === -2) D.forEach((e, i) => { e.li.classList.toggle('past', i <= lo); e.li.classList.toggle('cur', i === lo); });
  if (lo >= 0) D[lo].li.scrollIntoView({ block: 'nearest', behavior: Math.abs(lo - prev) > 3 ? 'auto' : 'smooth' });
}

// --- the body: small graphs ---------------------------------------------------------------------------------
const SERIES = [
  { k: 1, name: 'warmth', colour: INK },
  { k: 2, name: 'energy', colour: INK, cap: 3 },
  { k: 5, name: 'food', colour: '#555' },
  { k: 6, name: 'water', colour: '#555' },
  { k: 7, name: 'wet', colour: '#4a6b8a' },
  { k: 8, name: 'injury', colour: '#8a2a1f' },
];
let statsLayer = null;
function drawStats() {
  const c = $('#stats'), g = c.getContext('2d'), w = c.width / DPR, h = c.height / DPR;
  if (!R) return;
  const rows = SERIES.length, rh = h / rows, lw = 52, gw = w - lw - 34;
  if (!statsLayer) {
    statsLayer = document.createElement('canvas'); statsLayer.width = c.width; statsLayer.height = c.height;
    const s = statsLayer.getContext('2d'); s.setTransform(DPR, 0, 0, DPR, 0, 0);
    const B = R.T.body;
    SERIES.forEach((S, r) => {
      const y0 = r * rh + 3, y1 = (r + 1) * rh - 3;
      s.fillStyle = 'rgba(38,38,38,0.05)'; s.fillRect(lw, y0, gw, y1 - y0);
      s.font = 'italic 12px Georgia, serif'; s.fillStyle = '#555'; s.fillText(S.name, 0, (y0 + y1) / 2 + 4);
      const Y = v => y1 - (v / 100) * (y1 - y0), X = t => lw + (t / 10 / R.dur) * gw;
      if (S.cap) { s.setLineDash([2, 3]); s.strokeStyle = 'rgba(38,38,38,0.4)'; s.lineWidth = 1; s.beginPath(); B.forEach((b, i) => (i ? s.lineTo(X(b[0]), Y(b[S.cap])) : s.moveTo(X(b[0]), Y(b[S.cap])))); s.stroke(); s.setLineDash([]); }
      s.strokeStyle = S.colour; s.lineWidth = 1.3; s.beginPath();
      B.forEach((b, i) => (i ? s.lineTo(X(b[0]), Y(b[S.k])) : s.moveTo(X(b[0]), Y(b[S.k]))));
      s.stroke();
    });
    // deaths across all the rows
    for (const e of R.deaths) { const x = lw + e.t / R.dur * gw; s.strokeStyle = '#000'; s.lineWidth = 1.5; s.beginPath(); s.moveTo(x, 0); s.lineTo(x, h); s.stroke(); }
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.drawImage(statsLayer, 0, 0);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const x = lw + V.t / R.dur * gw;
  g.strokeStyle = SIGNAL.base; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  const b = at(R.T.body, V.t);
  if (b) SERIES.forEach((S, r) => { g.font = '11px ui-monospace, Menlo, Consolas, monospace'; g.fillStyle = INK; g.fillText((b[S.k] / 100).toFixed(2), lw + gw + 4, r * rh + rh / 2 + 4); });
}

// --- the timeline -----------------------------------------------------------------------------------------
let tlLayer = null;
const TL = { pad: 8 };
function drawTimeline() {
  const c = $('#timeline'), g = c.getContext('2d'), w = c.width / DPR, h = c.height / DPR;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  if (!R) return;
  const X = t => TL.pad + (t / R.dur) * (w - TL.pad * 2), base = h - 14;
  if (!tlLayer) {
    tlLayer = document.createElement('canvas'); tlLayer.width = c.width; tlLayer.height = c.height;
    const s = tlLayer.getContext('2d'); s.setTransform(DPR, 0, 0, DPR, 0, 0);
    // day and night along it (the clock from the weather samples)
    const WX = R.T.wx;
    for (let i = 0; i < WX.length; i++) {
      const a = WX[i], b = WX[i + 1], night = a[1] >= 180;
      s.fillStyle = night ? 'rgba(40,48,70,0.16)' : 'rgba(255,255,255,0.5)';
      s.fillRect(X(a[0] / 10), 6, X((b ? b[0] : R.dur * 10) / 10) - X(a[0] / 10) + 0.5, base - 6);
    }
    s.strokeStyle = 'rgba(38,38,38,0.3)'; s.lineWidth = 1; s.strokeRect(TL.pad, 6, w - TL.pad * 2, base - 6);
    // the events: tall for what matters, short for the everyday
    for (const e of R.events) {
      const x = X(e.t), hh = e.cat === 'milestone' ? 26 : e.cat === 'danger' ? 20 : e.cat === 'camp' ? 13 : 7;
      s.strokeStyle = e.cat === 'milestone' ? SIGNAL.base : e.cat === 'danger' ? INK : e.cat === 'camp' ? '#666' : 'rgba(38,38,38,0.35)';
      s.lineWidth = e.cat === 'milestone' || e.type === 'death' ? 2.5 : 1;
      s.beginPath(); s.moveTo(x, base); s.lineTo(x, base - hh); s.stroke();
    }
    // the sim's strategy switches and estimates, as small yellow pips along the top
    for (const e of R.decisions) if (/Strategy|Estimate|Found|Spotted|Death|End/.test(e.kind)) { s.fillStyle = /Death|End/.test(e.kind) ? INK : SIGNAL.base; s.beginPath(); s.arc(X(e.rt), 10, 2.5, 0, 7); s.fill(); }
    // minute ticks
    s.fillStyle = '#777'; s.font = '10px ui-monospace, Menlo, Consolas, monospace';
    const step = R.dur > 3600 ? 600 : R.dur > 1200 ? 300 : R.dur > 300 ? 60 : 30;
    for (let t = 0; t <= R.dur; t += step) s.fillText(fmt(t), clamp(X(t) - 10, 2, w - 30), h - 2);
  }
  g.drawImage(tlLayer, 0, 0);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const x = X(V.t);
  g.fillStyle = 'rgba(38,38,38,0.08)'; g.fillRect(TL.pad, 6, x - TL.pad, base - 6);
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 2); g.lineTo(x, base + 2); g.stroke();
  g.fillStyle = SIGNAL.lit; g.beginPath(); g.arc(x, base + 2, 4, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
}
{
  const c = $('#timeline');
  const seek = e => { if (!R) return; const r = c.getBoundingClientRect(); V.t = clamp((e.clientX - r.left - TL.pad) / (r.width - TL.pad * 2), 0, 1) * R.dur; };
  c.addEventListener('pointerdown', e => { seek(e); c.setPointerCapture(e.pointerId); c.onpointermove = seek; });
  c.addEventListener('pointerup', () => { c.onpointermove = null; });
}

// --- now: the readout and the caption -----------------------------------------------------------------------
function updateNow() {
  const T = R.T, t = V.t, wx = at(T.wx, t), b = at(T.body, t), mode = at(T.mode, t)?.[1] ?? '-';
  const day = 1 + T.wx.slice(0, Math.max(0, idx(T.wx, t)) + 1).reduce((n, w, i, a) => n + (i && w[1] < a[i - 1][1] - 1 ? 1 : 0), 0);
  const clock = wx ? wx[1] : 0, night = clock >= 180;
  const bu = at(T.bundle, t), br = at(T.bear, t), me = explorerAt(t);
  const v = k => (b ? (b[k] / 100).toFixed(2) : '-');
  $('#now').textContent =
    `day ${day}, ${night ? 'night' : 'day'} ${fmt(night ? clock - 180 : clock)}   ${wx ? `${wx[2]}  ${wx[4]}°C  wind ${(wx[3] / 100).toFixed(2)}` : ''}\n`
    + `${mode}${bu && t >= (R.wrapped?.t ?? 1e9) ? `   body: ${bu[5] === '-' ? 'set down' : bu[5]}` : ''}${br ? `   bear ${br[3]} ${Math.round(Math.hypot(br[1] - me.x, br[2] - me.y))} px` : ''}\n`
    + `warmth ${v(1)}  energy ${v(2)}/${v(3)}  reserve ${v(4)}\nfood ${v(5)}  water ${v(6)}  wet ${v(7)}  injury ${v(8)}`;
  $('#clock').textContent = `${fmt(t)} / ${fmt(R.dur)}`;
  // the latest event, for a moment
  let k = -1;
  for (let i = R.events.length - 1; i >= 0; i--) if (R.events[i].t <= t) { k = i; break; }
  const cap = $('#caption'), e = R.events[k];
  if (k !== V.lastCap) { V.lastCap = k; if (e && t - e.t < 20) { cap.textContent = e.text; cap.classList.add('show'); V.capT = performance.now(); } }
  if (V.capT && performance.now() - V.capT > 2600) { cap.classList.remove('show'); V.capT = 0; }
}

// --- transport ------------------------------------------------------------------------------------------
function setPlaying(on) { V.playing = on; $('#play').textContent = on ? '❚❚' : '▶'; }
$('#play').onclick = () => { if (!R) return; if (V.t >= R.dur) V.t = 0; setPlaying(!V.playing); };
for (const b of document.querySelectorAll('#speeds button')) b.onclick = () => { V.speed = +b.dataset.speed; document.querySelectorAll('#speeds button').forEach(q => q.classList.toggle('on', q === b)); };
addEventListener('keydown', e => {
  if (!R || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); $('#play').click(); }
  if (e.code === 'ArrowRight') V.t = clamp(V.t + 5 * Math.max(1, V.speed / 4), 0, R.dur);
  if (e.code === 'ArrowLeft') V.t = clamp(V.t - 5 * Math.max(1, V.speed / 4), 0, R.dur);
  if (e.code === 'Home') V.t = 0;
});

let lastNow = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  if (R && V.playing) { V.t += dt * V.speed; if (V.t >= R.dur) { V.t = R.dur; setPlaying(false); } }
  drawMap();
  if (R) { drawStats(); drawTimeline(); updateLog(); updateNow(); }
  requestAnimationFrame(frame);
}

// --- loading ----------------------------------------------------------------------------------------------
function tryLoad(text) {
  const err = $('#loaderr');
  err.textContent = '';
  try { load(JSON.parse(text)); } catch (e) { err.textContent = e.message || String(e); $('#loader').hidden = false; }
}
$('#openbtn').onclick = () => { $('#loader').hidden = false; };
$('#closeload').onclick = () => { if (R) $('#loader').hidden = true; };
$('#file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(tryLoad); };
$('#pastebtn').onclick = () => tryLoad($('#paste').value);
for (const t of [document.body]) {
  t.addEventListener('dragover', e => { e.preventDefault(); $('#drop').classList.add('over'); $('#loader').hidden = false; });
  t.addEventListener('dragleave', e => { if (e.target === $('#drop')) $('#drop').classList.remove('over'); });
  t.addEventListener('drop', e => { e.preventDefault(); $('#drop').classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) f.text().then(tryLoad); else { const s = e.dataTransfer.getData('text'); if (s) tryLoad(s); } });
}
window.REPLAY = { load: obj => load(obj), view: V, run: () => R };   // (for tests and the console)

resize();
const q = new URLSearchParams(location.search);
if (q.get('log')) fetch(q.get('log')).then(r => r.text()).then(tryLoad).catch(e => { $('#loaderr').textContent = `couldn't fetch ${q.get('log')}: ${e.message}`; });
requestAnimationFrame(t => { lastNow = t; frame(t); });
