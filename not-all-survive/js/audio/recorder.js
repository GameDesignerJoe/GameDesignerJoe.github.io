// Plays the audio recorders (recordings.js). One at a time; tap the recorder again to stop it.
// The recording ducks under bad weather (Joe), stops if the explorer dies or the recorder leaves
// the pack, and is a little louder in a tent. A real file (rec.src) plays if it's there; otherwise
// the placeholder text is spoken by the browser's voice, slow and low, under a soft tape hiss.
// Pushes events: recorder { stage: 'play'|'stop', id }.
import { state } from '../state.js';

let cur = null;        // { rec, el (HTMLAudioElement) | utter (SpeechSynthesisUtterance), t }
let hiss = null;       // { ctx, src, gain } a little tape noise under the placeholder voice
const missing = new Set();   // srcs that failed to load: straight to the placeholder voice next time

export const playing = () => (cur ? cur.rec.id : null);

function duck() {
  // bad weather drowns it out; in a tent it's close by the ear
  const w = state.weather || {}, storm = Math.max(w.whiteout || 0, (state.wind?.speed || 0) - 0.3);
  const inside = state.player?.mode === 'inside';
  return Math.max(0.15, (inside ? 1 : 0.9) * (1 - 0.65 * Math.min(1, storm)));
}

function startHiss() {
  try {
    const ctx = state.audio?.ctx || (hiss?.ctx) || new (window.AudioContext || window.webkitAudioContext)();
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
    const gain = ctx.createGain(); gain.gain.value = 0.015 * duck();
    src.connect(f).connect(gain).connect(state.audio?.out || ctx.destination); src.start();
    hiss = { ctx, src, gain };
  } catch { hiss = null; }
}
function stopHiss() { try { hiss?.src.stop(); } catch { /* already */ } if (hiss) hiss.src = null; }

function speak(rec) {
  if (!('speechSynthesis' in window)) return null;
  const u = new SpeechSynthesisUtterance(rec.text);
  u.rate = 0.82; u.pitch = 0.8; u.volume = 0.8 * duck();
  u.onend = () => { if (cur && cur.utter === u) stop(true); };
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  startHiss();
  return u;
}

// Play rec (a RECORDINGS entry); playing it again stops it.
export function toggle(rec) {
  if (cur && cur.rec.id === rec.id) { stop(); return false; }
  stop();
  cur = { rec, t: state.time };
  if (rec.src && !missing.has(rec.src) && !state.audio?.muted) {
    const el = new Audio(rec.src);
    el.volume = duck();
    el.onended = () => { if (cur && cur.el === el) stop(true); };
    el.onerror = () => { missing.add(rec.src); if (cur && cur.el === el) { cur.el = null; cur.utter = speak(rec); } };
    el.play().catch(() => { if (cur && cur.el === el) { cur.el = null; cur.utter = speak(rec); } });
    cur.el = el;
  } else if (!state.audio?.muted) cur.utter = speak(rec);
  state.events.push({ type: 'recorder', stage: 'play', id: rec.id });
  return true;
}

export function stop(ended = false) {
  if (!cur) return;
  try { cur.el?.pause(); } catch { /* gone */ }
  if (cur.utter) { try { speechSynthesis.cancel(); } catch { /* none */ } stopHiss(); }
  state.events.push({ type: 'recorder', stage: 'stop', id: cur.rec.id, ended });
  cur = null;
}

export function update() {
  if (!cur) return;
  // the explorer died, or the recorder left the pack (dropped, moved to the sled): it stops
  const alive = !state.body || state.body.phase === 'alive' || state.body.phase === 'sleep';
  const held = state.pack?.slots.some(q => q && q.id === 'rec_' + cur.rec.id);
  if (!alive || !held || state.audio?.muted) { stop(); return; }
  const v = duck();
  if (cur.el) cur.el.volume = v;
  if (hiss?.gain && hiss.src) hiss.gain.gain.value = 0.015 * v;
}
