// The radio (Joe's "hot and cold" goal): tap it in the pack to switch it on, tap again to switch
// it off. It listens for the lost explorer's distress beacon (goal/distress.js) and tells you
// nothing but how near you are:
//   far        a lone BLIP now and then, quiet, under the static; the farther, the longer the gaps
//   nearer     the blips come quicker and louder
//   close      the blips run together into the beacon itself: the SOS in morse ( ... --- ... )
//   in the area (within ~120 px) the SOS clear and loud
// No arrow, no map: walk, listen, and judge whether it's getting quicker or slower.
// The first member starts with it on (Joe: "start with telling the players what they need to
// do"). It goes quiet when the explorer dies, sleeps, or it leaves the pack; storms bury it in hiss.
// Once the lost explorer is found their beacon stops and the radio goes quiet: only the hiss.
// Over the explorer while it's on: a small radio with its aerial and a little signal arc that
// pulses with each blip.
// state.radio = { on, near 0..1 }. Events: radio { on }.
import { state } from '../state.js';
import { worldToScreenUI } from '../camera.js';

const R = state.radio = { on: false, near: 0, blipT: 0 };
const FAR = 1800, AREA = 120;
let ctxA = null, noise = null, nextAt = 0, autoOn = false, pulse = 0;
const MORSE = [1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1];   // dot = 1 unit, dash = 3, gap = 0 (letter gap)
let morseAt = 0, morseI = -1;

const haveRadio = () => !!state.pack?.slots.some(q => q && q.id === 'radio');
const alive = () => !state.body || state.body.phase === 'alive';

export function toggle(on = !R.on) {
  R.on = on && haveRadio();
  state.events.push({ type: 'radio', on: R.on, x: state.player.x, y: state.player.y });
  if (!R.on) stopNoise();
  return R.on;
}

function ac() {
  const c = state.audio?.ctx;
  if (!c || state.audio.muted || c.state !== 'running') return null;
  return c;
}
function startNoise(c) {
  if (noise && noise.c === c) return;
  const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.8;
  const g = c.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(state.audio?.out || c.destination); src.start();
  noise = { c, src, g };
}
function stopNoise() { try { noise?.src.stop(); } catch { /* done */ } noise = null; }

function tone(c, freq, dur, vol) {
  const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.setValueAtTime(vol, t + Math.max(0.008, dur - 0.012)); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(state.audio?.out || c.destination); o.start(t); o.stop(t + dur + 0.02);
}

export function update(dt) {
  const D = state.distress, P = state.player;
  // the first member sets out with it on, once the game has begun
  if (!autoOn && state.begun !== false && D?.ready && haveRadio() && state.member === 0 && P.mode === 'walk') { autoOn = true; toggle(true); }
  if (R.on && (!haveRadio() || !alive())) toggle(false);
  // found (Joe): the beacon has done its work; a moment of hiss, then the radio is switched off and put
  // away (its little radio over the explorer goes with it)
  if (R.on && D?.found) { R.foundT = (R.foundT || 0) + dt; if (R.foundT > 2.5) toggle(false); } else R.foundT = 0;
  pulse = Math.max(0, pulse - dt * 3);
  // (silent in a tent: Joe; the canvas and the stove's roar, nothing else)
  const inTent = P.mode === 'inside' || P.mode === 'tent-in' || P.mode === 'tent-out';
  if (!R.on || !D?.ready || inTent) { R.near = 0; if (noise) noise.g.gain.value = 0; return; }
  const d = Math.hypot(P.x - D.x, P.y - D.y);
  R.near = Math.max(0, Math.min(1, 1 - (d - AREA) / (FAR - AREA)));
  const storm = Math.max(state.weather?.whiteout || 0, (state.wind?.speed || 0) - 0.4);
  const c = ac();
  if (!c) { if (noise) noise.g.gain.value = 0; return; }   // muted (or audio not started): no static either
  startNoise(c);
  // static: always there, louder in a storm, quieter as the signal takes over
  noise.g.gain.value = (0.012 + 0.02 * Math.min(1, storm)) * (1 - 0.6 * R.near * R.near);
  // found (goal/distress.js D.found): the beacon has done its work and the radio goes quiet (only the hiss)
  if (D.found) { R.near = 0; return; }
  const now = state.time, morse = Math.max(0, (R.near - 0.78) / 0.18);   // 0 -> 1 over the last stretch
  if (morse < 1) {
    // blips: gaps from ~3.2 s far off down to ~0.25 s close
    if (now >= nextAt) {
      const vol = (0.02 + 0.09 * R.near) * (1 - 0.5 * Math.min(1, storm)) * (1 - morse);
      tone(c, 1320, 0.05, vol);
      pulse = 1;
      nextAt = now + 0.25 + 2.95 * Math.pow(1 - R.near, 1.4);
    }
  }
  if (morse > 0) {
    // the beacon's own SOS, keyed at ~12 wpm; a pause between repeats
    const unit = 0.1;
    if (now >= morseAt) {
      morseI++;
      if (morseI >= MORSE.length) { morseI = -1; morseAt = now + unit * 7; }
      else {
        const k = MORSE[morseI];
        if (k) { tone(c, 760, unit * k, 0.12 * morse * (1 - 0.4 * Math.min(1, storm))); pulse = 1; morseAt = now + unit * (k + 1); }
        else morseAt = now + unit * 3;
      }
    }
  }
}

// A small radio over the explorer while it's on, its aerial up, a signal arc pulsing with the blips.
export function drawScreen(ctx) {
  const m = state.player.mode;
  if (!R.on || !alive() || m === 'inside' || m === 'tent-in' || m === 'tent-out') return;
  const P = state.player, z = state.cam.zoom || 1, { dpr } = state.view;
  const s = worldToScreenUI(P.x, P.y), x = s.x + 5.5 * z, y = s.y - 19 * z, u = Math.max(1.2, z * 0.45);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(70,64,56,0.95)'; ctx.strokeStyle = 'rgba(30,27,22,0.95)'; ctx.lineWidth = Math.max(1, u * 0.5);
  ctx.beginPath(); ctx.rect(x - 2 * u, y - 1.4 * u, 4 * u, 3.2 * u); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 1.2 * u, y - 1.4 * u); ctx.lineTo(x + 2.2 * u, y - 4.6 * u); ctx.stroke();
  const a = 0.25 + 0.65 * pulse;
  ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = Math.max(1, u * 0.45);
  for (let k = 1; k <= 2; k++) { ctx.beginPath(); ctx.arc(x + 2.2 * u, y - 4.6 * u, k * 1.8 * u, -1.2, 0.1); ctx.stroke(); }
  ctx.restore();
}
