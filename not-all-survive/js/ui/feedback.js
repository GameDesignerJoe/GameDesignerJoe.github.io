// Feedback (Joe: carried over from the Maze): "Send feedback" in the gear menu opens a box to write in, and
// Send. It goes to a Google Form (FEEDBACK_FORM below), whose answers land in a Google Sheet Claude can read
// and sum up when Joe asks "how is the feedback?". With each note goes where it was written from, so it can
// be read against the game:
//   version   the build (the page's last-modified date)
//   where     time of day, weather, terrain underfoot, body state, the goal so far, phone or keyboard
//   log       the last few dozen game events in plain words (and the sim's decisions if it was running)
//   shot      a small JPEG of the view the moment Feedback was opened (never the box itself), as base64 text
// Sent blind (a form takes a post from any page but won't answer), so the box thanks you on sending. With no
// form set yet, notes are kept on this device and sent the next time the game opens with one filled in.
//
// To set it up: make a Google Form with five Short answer questions (Feedback, Version, Where, Log, Shot),
// open its "Get pre-filled link", and copy the form's /formResponse address and each question's entry.N id
// into FEEDBACK_FORM.
import { state } from '../state.js';

const FEEDBACK_FORM = {
  action: '',   // 'https://docs.google.com/forms/d/e/<form id>/formResponse'
  fields: { text: '', version: '', where: '', log: '', shot: '' },
};

const KEY = 'nas.feedback', SHOT_MAX = 40000, LOG_MAX = 30000;
const events = [];          // a rolling log of what happened, in plain words
let shot = '';

// what the events mean, in a few words (the rest are skipped)
const SAY = {
  eat: e => e.stage === 'done' && 'ate', drink: e => e.stage === 'done' && 'drank', snowEat: e => e.stage === 'done' && 'ate snow',
  plunge: () => 'fell in the water', breakthrough: () => 'broke through the ice', crack: () => 'ice cracked',
  impact: e => `fell (${e.drop ? Math.round(e.drop) + ' px' : 'a fall'})`, tent: e => e.action && `tent: ${e.action}`,
  pitch: e => (e.stage === 'done' || e.stage === 'collapse') && `pup tent ${e.stage}`, gear: e => !e.auto && `${e.on ? 'put on' : 'took off'} ${e.item}`,
  distress: e => e.stage === 'found' && 'found the lost explorer', goal: e => e.stage && `goal: ${e.stage}`,
  radio: e => `radio ${e.on ? 'on' : 'off'}`, death: e => `died (${e.cause || '?'})`, handover: () => 'death hand-over',
  expedition: () => 'expedition over', bear: e => e.stage && `bear: ${e.stage}`, flare: e => e.stage && `flare ${e.stage}`,
  shot: () => 'fired the rifle', transfer: e => e.id && `moved ${e.id}`, refuse: e => `refused (${e.reason || ''})`,
};

export function update() {
  for (const e of state.events) {
    const f = SAY[e.type];
    const t = f && f(e);
    if (t) {
      events.push(`${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')} ${t}`);
      if (events.length > 60) events.shift();
    }
  }
}

function version() {
  const d = new Date(document.lastModified);
  return isNaN(d) ? '' : d.toISOString().slice(0, 16).replace('T', ' ');
}
function where() {
  const P = state.player, B = state.body || {}, W = state.weather || {}, L = state.lighting || {};
  const n = v => (v ?? 0).toFixed(2);
  const parts = [
    `day ${Math.floor((state.time || 0) / 300) + 1} clock ${Math.round(L.clock ?? 0)}s${L.night > 0.5 ? ' night' : ''}`,
    `weather ${W.forecast?.id ?? '-'} / ${W.phase ?? '-'} ${W.temp ?? ''}°C`,
    `at ${Math.round(P.x)},${Math.round(P.y)} on ${P.terrain ?? '?'} mode ${P.mode}`,
    `warmth ${n(B.warmth)} energy ${n(B.energy)} food ${n(B.food)} water ${n(B.water)} wet ${n(B.wet)} injury ${n(B.injury)}`,
    `goal ${state.distress?.found ? 'found' : 'searching'}${state.burden?.mode ? ' ' + state.burden.mode : ''}${state.burden?.home ? ' home' : ''}`,
    `${innerWidth > innerHeight ? 'landscape' : 'portrait'} ${matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard'}${state.sim?.on ? ' sim' : ''}`,
  ];
  return parts.join(' | ');
}
function logText() {
  let t = events.join('\n');
  const sl = state.sim?.log;
  if (sl && sl.length) t += '\n-- sim --\n' + sl.slice(-25).map(x => `${x.kind}: ${x.text}`).join('\n');
  return t.slice(-LOG_MAX);
}
function snap() {
  const cv = document.querySelector('canvas');
  if (!cv) return '';
  try {
    for (const [w, q] of [[320, 0.7], [280, 0.6], [240, 0.5], [200, 0.45], [160, 0.4]]) {
      const k = Math.min(1, w / Math.max(cv.width, cv.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.width * k)); c.height = Math.max(1, Math.round(cv.height * k));
      c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
      const b = c.toDataURL('image/jpeg', q).split(',')[1] || '';
      if (b.length <= SHOT_MAX) return b;
    }
  } catch { /* tainted or gone */ }
  return '';
}

const formSet = () => !!(FEEDBACK_FORM.action && FEEDBACK_FORM.fields.text);
function post(item) {
  if (!formSet()) return false;
  const f = FEEDBACK_FORM.fields, body = new URLSearchParams();
  body.set(f.text, item.text);
  for (const k of ['version', 'where', 'log', 'shot']) if (f[k] && item[k]) body.set(f[k], item[k]);
  fetch(FEEDBACK_FORM.action, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
  return true;
}
const kept = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const keep = list => { try { if (list.length) localStorage.setItem(KEY, JSON.stringify(list.slice(-20))); else localStorage.removeItem(KEY); } catch { /* full */ } };

let box = null;
function build() {
  box = document.createElement('div');
  box.id = 'feedback';
  box.hidden = true;
  box.innerHTML = `
    <div class="fb-card">
      <div class="fb-title">Feedback</div>
      <textarea placeholder="What happened? What felt wrong, or right?" rows="6"></textarea>
      <div class="fb-row"><span class="fb-note"></span><button data-fb="cancel">Cancel</button><button data-fb="send" class="fb-send">Send</button></div>
    </div>`;
  document.body.append(box);
  // never a press in the game behind it
  for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown']) box.addEventListener(ev, e => e.stopPropagation());
  box.addEventListener('pointerdown', e => { if (e.target === box) close(); });
  box.querySelector('[data-fb="cancel"]').onclick = close;
  box.querySelector('[data-fb="send"]').onclick = send;
}
export function open() {
  shot = snap();   // before the box is up: the view, not the box
  document.getElementById('menu')?.setAttribute('hidden', '');
  box.hidden = false;
  box.querySelector('.fb-note').textContent = '';
  setTimeout(() => box.querySelector('textarea').focus(), 50);
}
function close() { box.hidden = true; box.querySelector('textarea').blur(); }
function send() {
  const ta = box.querySelector('textarea'), text = ta.value.trim();
  if (!text) { ta.focus(); return; }
  const item = { text, version: version(), where: where(), log: logText(), shot, at: new Date().toISOString() };
  const sent = post(item);
  if (!sent) keep(kept().concat([item]));
  ta.value = '';
  box.querySelector('.fb-note').textContent = sent ? 'Thank you. Sent.' : 'Thank you. Kept on this device until the form is set up.';
  setTimeout(close, 1600);
}

export function init() {
  build();
  if (formSet()) { const k = kept(); if (k.length) { k.forEach(post); keep([]); } }
  // the gear menu gets a "Send feedback" button (added here so menu.js needn't know)
  const add = () => {
    const panel = document.getElementById('menu');
    if (!panel) return setTimeout(add, 200);
    if (panel.querySelector('[data-act="feedback"]')) return;
    const b = document.createElement('button');
    b.dataset.act = 'feedback';
    b.textContent = 'Send feedback';
    b.addEventListener('click', e => { e.stopPropagation(); open(); });
    panel.prepend(b);
  };
  add();
  window.NAS.feedback = { open, kept, where, log: logText };
}
