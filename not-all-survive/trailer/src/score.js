// The score for the trailer, composed to the cut (timeline.json) and rendered offline in Web Audio.
// Original music (synthesised here) plus the game's own sound effects (js/audio/synth.js), keyed to the
// game events each shot logged while it was rendered (events/<shot>.json).
//
// D minor, 60 bpm (a beat is a second; the cut lands on beats and half beats).
//   0:00 wind out of black; a bowed drone; single celesta notes as the pen draws
//   0:10 the motif (celesta) over the drone: base camp
//   0:22 the radio: the music thins to a hum; blips; the SOS
//   0:28 strings swell, a timpani roll
//   0:31 the ostinato (16ths), a drum on every cut; 0:42 the plunge
//   0:44 the Third Man: the floor drops away, glass harmonics
//   0:47 the storm: ostinato back, harder, the SOS in the bells
//   0:54 the bear: low cluster, tremolo rising, a heartbeat quickening
//   0:59.5 silence. one breath.  1:00.4 the flare: the hit, light
//   1:03.5 the dead: the SOS slowed into a lament on the piano
//   1:16 the pup tent: D major at last; 1:22 the title, the last low note
import * as S from '../../js/audio/synth.js';

const SR = 48000;
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const N = { D1: 26, A1: 33, Bb1: 34, C2: 36, D2: 38, E2: 40, F2: 41, G2: 43, A2: 45, Bb2: 46, C3: 48, D3: 50, E3: 52, F3: 53, Fs3: 54, G3: 55, A3: 57, Bb3: 58, C4: 60, D4: 62, E4: 64, F4: 65, Fs4: 66, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, E5: 76, F5: 77, Fs5: 78, G5: 79, A5: 81, D6: 86 };
const f = k => midi(N[k]);

export async function render({ timeline, events, wantStems = false }) {
  const shots = timeline.shots, cues = timeline.cues;
  const AT = Object.fromEntries(shots.map(s => [s.id, s.at]));
  const END = shots[shots.length - 1].at + shots[shots.length - 1].dur + 0.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(END * SR), SR);
  const B = S.makeBuffers(ctx);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  Math.random = rnd;   // the game's synth uses it: keep the mix the same every render

  // --- buses ---------------------------------------------------------------------------------------
  const master = ctx.createGain(); master.gain.value = 1;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -7.5; limiter.knee.value = 2; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.15;
  master.connect(limiter).connect(ctx.destination);
  const mute = ctx.createGain(); mute.connect(master);          // the silence before the flare cuts this
  const music = ctx.createGain(); music.gain.value = 0.9; music.connect(mute);
  const sfx = ctx.createGain(); sfx.gain.value = 0.85;
  const windBus = ctx.createGain(); windBus.gain.value = 0;
  const lowCut = (dest, f0 = 45, shelf = -6) => {
    const hp = ctx.createBiquadFilter(), sh = ctx.createBiquadFilter(), air = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = f0; hp.Q.value = 0.6;
    sh.type = 'lowshelf'; sh.frequency.value = 120; sh.gain.value = shelf;
    air.type = 'highshelf'; air.frequency.value = 3500; air.gain.value = 4;
    hp.connect(sh).connect(air).connect(dest); return hp;
  };
  windBus.connect(lowCut(mute, 50, -6));
  sfx.connect(lowCut(mute, 40, -4));
  const bed = ctx.createGain(); bed.gain.value = 1;
  { const hp = ctx.createBiquadFilter(), hp2 = ctx.createBiquadFilter(), sh = ctx.createBiquadFilter();
    hp.type = hp2.type = 'highpass'; hp.frequency.value = hp2.frequency.value = 35; hp.Q.value = hp2.Q.value = 0.6;
    sh.type = 'lowshelf'; sh.frequency.value = 115; sh.gain.value = -5.5;
    const airS = ctx.createBiquadFilter(); airS.type = 'highshelf'; airS.frequency.value = 3500; airS.gain.value = 4;
    bed.connect(hp).connect(hp2).connect(sh).connect(airS).connect(music); }

  function makeIR(sec, decay, lpK, seedI) {
    const n = Math.floor(sec * SR), buf = ctx.createBuffer(2, n, SR);
    let s2 = seedI;
    const r = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647 * 2 - 1; };
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR, k = lpK + (0.02 - lpK) * Math.min(1, t / sec);   // darker as it decays
        lp += (r() - lp) * k * 4;
        d[i] = lp * Math.exp(-t * decay) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    return buf;
  }
  const hall = ctx.createConvolver(); hall.buffer = makeIR(5.5, 1.15, 0.22, 7);
  const hallIn = ctx.createGain(); hallIn.gain.value = 0.55; hallIn.connect(hall); hall.connect(bed);
  const room = ctx.createConvolver(); room.buffer = makeIR(1.6, 3.2, 0.25, 11);
  const roomIn = ctx.createGain(); roomIn.gain.value = 0.35; roomIn.connect(room); room.connect(mute);

  const panner = p => { const n = ctx.createStereoPanner(); n.pan.value = p; return n; };
  function out(node, { pan = 0, wet = 0.4, bus = bed, gainV = 1 } = {}) {
    const g = ctx.createGain(); g.gain.value = gainV;
    const pn = panner(pan); node.connect(g).connect(pn); pn.connect(bus);
    if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; pn.connect(s).connect(hallIn); }
    return g;
  }

  // --- instruments ---------------------------------------------------------------------------------
  // Celesta / prepared piano: FM, an inharmonic modulator; a bright strike that rings and darkens.
  function bell(t, fr, vel = 0.5, dur = 3.5, pan = 0, ratio = 3.5) {
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), a = ctx.createGain();
    c.frequency.value = fr; m.frequency.value = fr * ratio;
    mg.gain.setValueAtTime(fr * 2.2 * vel, t); mg.gain.exponentialRampToValueAtTime(fr * 0.05, t + dur * 0.5);
    m.connect(mg).connect(c.frequency);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.16 * vel, t + 0.004);
    a.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    c.connect(a);
    const o2 = ctx.createOscillator(), a2 = ctx.createGain(); o2.frequency.value = fr * 2.005;
    a2.gain.setValueAtTime(0.035 * vel, t); a2.gain.exponentialRampToValueAtTime(0.0003, t + dur * 0.4);
    o2.connect(a2);
    const mix = ctx.createGain(); a.connect(mix); a2.connect(mix);
    out(mix, { pan, wet: 0.65 });
    for (const o of [c, m, o2]) { o.start(t); o.stop(t + dur + 0.1); }
  }
  // A soft, felted piano: harmonic FM with a quick decay and a little hammer.
  function piano(t, fr, vel = 0.5, dur = 4, pan = 0) {
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), a = ctx.createGain(), lp = ctx.createBiquadFilter();
    c.frequency.value = fr; m.frequency.value = fr;
    mg.gain.setValueAtTime(fr * 1.6 * vel, t); mg.gain.exponentialRampToValueAtTime(fr * 0.1, t + 0.6);
    m.connect(mg).connect(c.frequency);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, fr * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, fr * 2), t + dur);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.2 * vel, t + 0.006);
    a.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.4); a.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    c.connect(lp).connect(a);
    out(a, { pan, wet: 0.5 });
    for (const o of [c, m]) { o.start(t); o.stop(t + dur + 0.1); }
  }
  // Bowed strings / drone: detuned saws, low-passed, with a slow swell (env: [[t, level], ...])
  function bowed(notes, env, { cutoff = 700, cutEnv = null, pan = 0, wet = 0.5, detune = 7, trem = 0, q = 0.7 } = {}) {
    const t0 = env[0][0], t1 = env[env.length - 1][0];
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = q; lp.frequency.value = cutoff;
    if (cutEnv) { lp.frequency.setValueAtTime(cutEnv[0][1], cutEnv[0][0]); for (const [t, v] of cutEnv.slice(1)) lp.frequency.linearRampToValueAtTime(v, t); }
    g.gain.setValueAtTime(0, t0);
    for (const [t, v] of env) g.gain.linearRampToValueAtTime(v, t);
    const sum = ctx.createGain(); sum.gain.value = 1 / Math.sqrt(notes.length * 2);
    for (const fr of notes) for (const d of [-detune, detune]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = d + (rnd() - 0.5) * 3;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.6 + rnd(); vg.gain.value = fr * 0.0025;
      vib.connect(vg).connect(o.frequency);
      o.connect(sum); o.start(t0); o.stop(t1 + 0.1); vib.start(t0); vib.stop(t1 + 0.1);
    }
    let src = sum;
    if (trem) {
      const tg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      tg.gain.value = 0.55; lfo.frequency.value = trem; lg.gain.value = 0.45; lfo.connect(lg).connect(tg.gain);
      lfo.start(t0); lfo.stop(t1 + 0.1); sum.connect(tg); src = tg;
    }
    src.connect(lp).connect(g);
    out(g, { pan, wet });
    return g;
  }
  // A low hit: the floor dropping out (sub sweep, a bloom of noise, a long tail)
  function hit(t, vel = 1, { tail = 3, bright = 0.3 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(78, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    const subT = tail > 5 ? tail : Math.min(tail, 1.8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.75 * vel, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + subT);
    o.connect(g); out(g, { wet: 0.25, bus: music });
    o.start(t); o.stop(t + tail + 0.1);
    const n = ctx.createBufferSource(); n.buffer = B.brown; const ng = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400 * (0.4 + bright), t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.2);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(1.1 * vel, t + 0.01); ng.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    n.connect(lp).connect(ng); out(ng, { wet: 0.7 });
    n.start(t, rnd() * 4); n.stop(t + 1.7);
  }
  // A drum on the cut (low tom / taiko)
  function drum(t, vel = 0.6, pitch = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120 * pitch, t); o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g); out(g, { wet: 0.35, bus: music });
    o.start(t); o.stop(t + 1);
    const n = ctx.createBufferSource(); n.buffer = B.whiteM; const bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 900 * pitch; bp.Q.value = 0.8;
    ng.gain.setValueAtTime(0.25 * vel, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(bp).connect(ng); out(ng, { wet: 0.3 });
    n.start(t, rnd()); n.stop(t + 0.1);
  }
  // Timpani roll building into t1
  function roll(t0, t1, vel = 0.5) {
    for (let t = t0; t < t1; t += 0.06 + 0.02 * rnd()) {
      const k = (t - t0) / (t1 - t0);
      drum(t, vel * (0.1 + 0.9 * k * k), 0.62);
    }
  }
  // Spiccato low strings: one short bowed note
  function spic(t, fr, vel = 0.5, len = 0.16, cutoff = 1400, pan = 0) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(), lp2 = ctx.createBiquadFilter();
    lp.type = lp2.type = 'lowpass'; lp.frequency.value = cutoff * 0.6; lp2.frequency.value = cutoff * 0.9; lp.Q.value = 0.5; lp2.Q.value = 0.5;
    lp.connect(lp2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.26 * vel, t + 0.012); g.gain.exponentialRampToValueAtTime(0.002, t + len);
    for (const [d, ty, gv] of [[-11, 'sawtooth', 0.5], [9, 'sawtooth', 0.5], [0, 'triangle', 0.9]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty; o.frequency.value = fr; o.detune.value = d; og.gain.value = gv;
      o.connect(og).connect(lp); o.start(t); o.stop(t + len + 0.05);
    }
    lp2.connect(g); out(g, { pan, wet: 0.25 });
  }
  // Air: glassy, bowed-metal partials high up (3-8 kHz), the ice ringing. A slow swell, beating.
  function air(t0, t1, level = 0.01, base = 3200, pan = 0) {
    level *= 2.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + Math.min(2, (t1 - t0) * 0.4));
    g.gain.setValueAtTime(level, Math.max(t0 + 0.01, t1 - 1.2)); g.gain.linearRampToValueAtTime(0, t1);
    const trem = ctx.createGain(); trem.gain.value = 0.7; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.37; lg.gain.value = 0.3;
    lfo.connect(lg).connect(trem.gain); lfo.start(t0); lfo.stop(t1 + 0.1);
    for (const r of [1, 1.414, 1.73, 2.31]) for (const d of [0, 2.3]) {
      const o = ctx.createOscillator(); o.frequency.value = base * r + d; const og = ctx.createGain(); og.gain.value = 1 / r;
      o.connect(og).connect(trem); o.start(t0); o.stop(t1 + 0.1);
    }
    trem.connect(g); out(g, { pan, wet: 0.9 });
  }
  // A riser: noise swept up into a cut
  function riser(t0, t1, level = 0.2) {
    const n = ctx.createBufferSource(); n.buffer = B.pink; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(220, t0); bp.frequency.exponentialRampToValueAtTime(4200, t1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1);
    n.connect(bp).connect(g); out(g, { wet: 0.3 }); n.start(t0); n.stop(t1 + 0.05);
  }
  // Heartbeat: lub-dub, felt more than heard
  function heart(t, vel = 0.7) {
    for (const [dt, v] of [[0, 1], [0.17, 0.65]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(64, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.12);
      g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.9 * vel * v, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.28);
      o.connect(g); out(g, { wet: 0.05, bus: music }); o.start(t + dt); o.stop(t + dt + 0.3);
    }
  }
  // Glass harmonics: sine clusters that beat against each other
  function glass(t0, t1, notes, level = 0.05, pan = 0) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + (t1 - t0) * 0.4); g.gain.linearRampToValueAtTime(0, t1);
    for (const fr of notes) for (const d of [0, 1.7]) { const o = ctx.createOscillator(); o.frequency.value = fr + d; o.connect(g); o.start(t0); o.stop(t1 + 0.1); }
    out(g, { pan, wet: 0.8 });
  }
  // The radio: a sine blip through a small speaker
  const radioBus = ctx.createGain(); radioBus.gain.value = 1;
  { const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1200; hp.Q.value = 0.6; radioBus.connect(hp); out(hp, { wet: 0.25, gainV: 1 }); }
  function blip(t, fr, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = fr;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.setValueAtTime(vol, t + Math.max(0.008, dur - 0.012)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(radioBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function hiss(t0, t1, level) {
    const n = ctx.createBufferSource(); n.buffer = B.white; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.4); g.gain.setValueAtTime(level, t1 - 0.5); g.gain.linearRampToValueAtTime(0, t1);
    n.connect(bp).connect(g).connect(radioBus); n.start(t0); n.stop(t1 + 0.1);
  }
  // A breath (the one in the silence): filtered noise swell
  function inhale(t, dur, level, dest) {
    const n = ctx.createBufferSource(); n.buffer = B.pinkM;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(1700, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + dur * 0.75); g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp).connect(g).connect(dest); n.start(t, 1); n.stop(t + dur + 0.05);
  }

  // =================================================================================================
  // THE SCORE
  const at = AT;
  // ---- 0:00 open: wind from black, the drone, the pen
  bowed([f('D2'), f('A2')], [[0.3, 0], [4, 0.04], [8, 0.06], [10, 0.07], [21.5, 0.08], [23, 0.04], [27.5, 0.05], [28.5, 0.0]], { cutoff: 380, cutEnv: [[0, 250], [8, 600], [20, 800], [24, 300]], wet: 0.6 });
  bowed([f('D2') * 0.5 * 2], [[3.8, 0], [7, 0.05], [12, 0.06], [21.5, 0.06], [23, 0.03], [28, 0.07], [31, 0]], { cutoff: 140, wet: 0.2 });
  blip(0.28, 1320, 0.06, 0.16);                // the cold open: one blip on black
  bell(0.3, f('A5'), 0.22, 4, 0.0);
  bell(0.8, f('D5'), 0.35, 5, -0.2);           // the pen touches the paper
  bell(1.8, f('A4'), 0.25, 5, 0.25);
  bell(2.3, f('F5'), 0.3, 5, -0.1);            // the camp mark
  bell(4.0, f('E5'), 0.34, 6, 0.15);            // the title
  bell(4.02, f('A3'), 0.2, 6, -0.3);
  bell(6.5, f('D5'), 0.25, 6, 0.0);
  air(0.8, 10.5, 0.006, 3400, 0.2);
  // ---- 0:10 base camp: the motif
  hit(10, 0.2, { tail: 3, bright: 0.1 });
  const motif = [[0, 'A4', 0.4], [0.5, 'D5', 0.45], [1.0, 'E5', 0.42], [1.5, 'F5', 0.5], [3.0, 'E5', 0.36], [3.5, 'D5', 0.34], [4.0, 'C5', 0.36], [4.5, 'A4', 0.4]];
  for (const [dt, n, v] of motif) bell(10.5 + dt, f(n), v, 4.5, dt % 1 ? 0.2 : -0.15);
  piano(10.5, f('D3'), 0.35, 6, -0.3); piano(14.5, f('Bb2'), 0.3, 6, -0.3);
  bowed([f('F3'), f('A3'), f('D4')], [[10, 0], [13, 0.06], [18, 0.07], [21, 0.0]], { cutoff: 1100, wet: 0.7, pan: 0.15 });
  const motif2 = [[0, 'A4', 0.36], [0.5, 'D5', 0.4], [1.0, 'E5', 0.38], [1.5, 'G5', 0.44], [2.5, 'F5', 0.4], [3.0, 'E5', 0.3]];
  for (const [dt, n, v] of motif2) bell(16.5 + dt, f(n), v, 4.5, dt % 1 ? 0.2 : -0.15);
  piano(16.5, f('G2'), 0.3, 6, -0.3); piano(19.0, f('A2'), 0.3, 5, -0.3);
  bell(20.5, f('D5'), 0.3, 6, 0); bell(21.0, f('A4'), 0.22, 6, 0.2);
  // ---- 0:22 the radio: the music holds its breath; blips; the SOS
  hiss(at.radio - 0.2, at.radio + 6.2, 0.012);
  for (const b of cues.blips) blip(b, 1320, 0.05, 0.05 + 0.03 * cues.blips.indexOf(b));
  { let tt = cues.sos.start; const u = cues.sos.unit;
    for (const k of [1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1]) { if (k) { blip(tt, 760, u * k, 0.13); tt += u * (k + 1); } else tt += u * 2; } }
  glass(23.5, 28.5, [f('A5'), f('D6')], 0.012, 0.3);
  piano(cues.sos.start + 2.8, f('D4'), 0.3, 5, 0.1);     // an answer, after the SOS
  piano(cues.sos.start + 2.81, f('A3'), 0.25, 5, -0.1);
  air(12, 21.5, 0.004, 4100, -0.3);
  air(23, 28.4, 0.005, 5200, 0.3);
  // ---- 0:28 setting out: the strings swell, the roll
  bowed([f('D3'), f('F3'), f('A3')], [[27.6, 0], [30.8, 0.22], [31.1, 0.0]], { cutoff: 700, cutEnv: [[27.6, 400], [30.8, 2200]], wet: 0.5 });
  bowed([f('D2'), f('A2')], [[27.6, 0], [30.8, 0.2], [31.1, 0.0]], { cutoff: 500, wet: 0.4 });
  roll(29.0, 31.0, 0.55);
  // ---- 0:31 the montage: ostinato, a drum on every cut
  const prog = [['D2', 'A2'], ['Bb1', 'F2'], ['G2', 'D3'], ['A1', 'E2']];
  const accents = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const CUTS = ['deep', 'climb', 'glare', 'lake', 'thin', 'heave', 'third', 'storm', 'pitch'].map(k => at[k]);
  function ostinato(t0, t1, k0, k1, cut0, cut1) {
    for (let t = t0, i = 0; t < t1 - 0.01; t += 0.25, i++) {
      const bar = Math.floor((t - 31) / 4) % 4, [r, fifth] = prog[(bar + 4) % 4];
      const k = k0 + (k1 - k0) * (t - t0) / (t1 - t0);
      const step = i % 16, note = step % 4 === 2 ? f(fifth) : step % 8 === 4 ? f(r) * 2 : f(r);
      const acc = accents[step] || CUTS.some(c => Math.abs(c - t) < 0.01);
      spic(t, note, (acc ? 0.95 : 0.55) * k, acc ? 0.2 : 0.13, cut0 + (cut1 - cut0) * (t - t0) / (t1 - t0), step % 2 ? 0.25 : -0.25);
    }
  }
  ostinato(31, 44, 0.75, 1.0, 900, 2200);
  hit(31, 0.8, { tail: 3 });
  for (const s of ['climb', 'glare', 'lake', 'thin']) drum(at[s], 0.65, 1);
  drum(at.third, 0.5, 0.8);
  air(31, 44, 0.004, 3800, 0.25);
  bowed([f('D3'), f('A3')], [[31, 0], [33, 0.08], [43.5, 0.13], [44, 0]], { cutoff: 900, cutEnv: [[31, 600], [43.5, 2600]], wet: 0.45 });
  // high line in the montage: the motif, quicker
  for (const [dt, n, v] of motif) bell(35 + dt * 0.5, f(n), v * 0.6, 2.5, 0.3);
  for (const [dt, n, v] of motif2) bell(39 + dt * 0.5, f(n), v * 0.6, 2.5, -0.3);
  hit(at.heave, 1.0, { tail: 3.5, bright: 0.8 });     // the plunge (the white flash)
  // ---- 0:44 the Third Man: the floor drops away
  glass(at.third - 0.1, at.third + 3.4, [f('E5') * 1.002, f('F5'), f('A5') * 0.998], 0.03, -0.2);
  air(at.third, at.third + 3.3, 0.012, 3000, -0.2);
  bowed([f('D2') * 1.01], [[44, 0], [45.5, 0.08], [47.1, 0]], { cutoff: 160, wet: 0.5 });
  bell(at.third + 0.5, f('Bb4'), 0.25, 5, 0.4, 2.76); bell(at.third + 1.8, f('E5'), 0.2, 5, -0.4, 2.76);
  // ---- 0:47 the storm: harder; the SOS in the bells
  hit(at.storm, 0.55, { tail: 3, bright: 0.5 });
  ostinato(47, 54, 0.45, 0.6, 1400, 2600);
  bowed([f('D2'), f('A2'), f('D3'), f('F3')], [[47, 0], [48, 0.06], [53.5, 0.08], [54, 0]], { cutoff: 1100, cutEnv: [[47, 800], [53.5, 2400]], wet: 0.5, trem: 7 });
  air(47.5, 53.8, 0.006, 4600, 0.0);
  { let tt = 48; for (const k of [1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1]) { if (k) { bell(tt, f('A5'), 0.35, 1.5, 0.35, 3.0); tt += 0.25 * (k + 1); } else tt += 0.5; } }
  drum(at.pitch, 0.7); drum(52, 0.5); drum(53, 0.6); drum(53.5, 0.7); drum(53.75, 0.8);
  // ---- 0:54 the bear: low cluster, tremolo rising, the heart quickening
  hit(at.bear, 0.7, { tail: 4, bright: 0.1 });
  bowed([f('D2'), f('D2') * 1.06], [[54, 0], [56, 0.18], [59.45, 0.42], [59.5, 0]], { cutoff: 300, wet: 0.3 });
  bowed([f('D3'), midi(51), f('A3')], [[54.5, 0], [57, 0.2], [59.45, 1.15], [59.5, 0]], { cutoff: 800, cutEnv: [[54.5, 400], [59.4, 4200]], wet: 0.35, trem: 9 });
  bowed([f('D4'), midi(63), f('A4')], [[56.5, 0], [59.45, 0.8], [59.5, 0]], { cutoff: 2500, cutEnv: [[56.5, 900], [59.4, 6000]], wet: 0.3, trem: 12 });
  riser(56.6, 59.5, 1.1);
  { let t = 57.0, gap = 0.5; while (t < 59.45) { drum(t, 0.5 + 0.6 * (t - 57) / 2.5, 0.75); t += gap; gap = Math.max(0.125, gap * 0.82); } }
  { let t = 54.3, gap = 1.05; while (t < 59.3) { heart(t, 0.6 + 0.5 * (t - 54) / 5.5); t += gap; gap = Math.max(0.42, gap * 0.9); } }
  // ---- 0:59.5 silence. one breath. 1:00.4 the flare
  const [s0, s1] = cues.silence;
  mute.gain.setValueAtTime(1, s0); mute.gain.linearRampToValueAtTime(0, s0 + 0.015);
  mute.gain.setValueAtTime(0, s1 - 0.015); mute.gain.linearRampToValueAtTime(1, s1);
  inhale(s0 + 0.08, 0.5, 0.06, master);
  hit(cues.flare, 1.1, { tail: 4.5, bright: 1 });
  bowed([f('D4'), f('A4'), f('E5')], [[cues.flare, 0], [cues.flare + 0.4, 0.09], [at.beacon + 0.5, 0.03], [at.beacon + 1.5, 0]], { cutoff: 4000, wet: 0.8 });
  bowed([f('D2'), f('A2')], [[cues.flare, 0], [cues.flare + 0.6, 0.16], [at.beacon + 1.5, 0.05], [at.beacon + 2.5, 0]], { cutoff: 600, wet: 0.5 });
  // ---- 1:03.5 the dead: the SOS slowed to a lament; bringing them home
  { let tt = cues.beaconSos.start; const u = cues.beaconSos.unit;
    for (const k of [1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1]) { if (k) { piano(tt, f('A4'), k === 1 ? 0.28 : 0.38, k === 1 ? 1.4 : 2.5, 0.15); tt += u * (k + 1); } else tt += u * 2; } }
  bowed([f('D3'), f('F3'), f('A3')], [[63.5, 0], [66, 0.08], [69.5, 0.1], [70, 0.0]], { cutoff: 900, wet: 0.6 });
  piano(66.5, f('D3'), 0.3, 5, -0.2); piano(66.5, f('F4'), 0.25, 5, 0.2);
  piano(68, f('E4'), 0.25, 4, 0.2);
  // BRING THEM HOME: the strings open, the motif low on the piano
  bowed([f('Bb2'), f('F3'), f('D4')], [[69.3, 0], [71, 0.14], [73, 0.12], [73.4, 0]], { cutoff: 1300, wet: 0.6 });
  bowed([f('Bb2')], [[69.3, 0], [71, 0.1], [73.4, 0]], { cutoff: 300, wet: 0.3 });
  for (const [dt, n, v] of motif.slice(0, 4)) piano(69.6 + dt, f(n) / 2, v * 0.8, 4, -0.1);
  // TWO REMAIN: thinned to a cello and two notes
  bowed([f('A2')], [[73, 0], [74, 0.14], [76.2, 0]], { cutoff: 700, wet: 0.6 });
  piano(73.8, f('D4'), 0.3, 5, 0.1); piano(75.0, f('A3'), 0.25, 5, -0.1);
  // ---- 1:16 the pup tent: D major at last
  hit(76, 0.3, { tail: 5, bright: 0.05 });
  air(77, 89.5, 0.005, 3600, -0.2);
  bowed([f('D3'), f('A3'), f('D4'), f('Fs4')], [[76, 0], [79, 0.12], [82, 0.16], [86, 0.12], [89.8, 0]], { cutoff: 1500, cutEnv: [[76, 700], [82, 2200], [89, 900]], wet: 0.75 });
  bowed([f('D2'), f('A2')], [[76, 0], [80, 0.12], [86, 0.12], [89.8, 0]], { cutoff: 450, wet: 0.5 });
  master.gain.setValueAtTime(1, END - 2.0); master.gain.linearRampToValueAtTime(0, END - 0.45);
  const major = [[0, 'A4', 0.32], [0.5, 'D5', 0.36], [1.0, 'E5', 0.34], [1.5, 'Fs5', 0.42], [3.0, 'E5', 0.3], [3.5, 'D5', 0.32]];
  for (const [dt, n, v] of major) bell(77 + dt, f(n), v, 5.5, dt % 1 ? 0.25 : -0.2);
  piano(77, f('D3'), 0.3, 6, -0.2);
  // the title: the last low note, and the chord blooming over it
  hit(cues.title, 1.0, { tail: 6, bright: 0.25 });
  piano(cues.title, f('D2'), 0.45, 7, -0.1); piano(cues.title, f('A2'), 0.35, 7, 0.1); piano(cues.title, f('Fs3'), 0.3, 7, 0.2);
  bell(cues.title + 0.02, f('D5'), 0.3, 7, 0.0);
  bell(85, f('A5'), 0.18, 5, 0.3);      // the address
  bell(86.5, f('D6'), 0.12, 5, -0.3);

  // =================================================================================================
  // THE WORLD: the game's wind, by hand per shot (calm, rising, the storm, settling), and its sfx
  const wind = S.createWind(ctx, B, windBus);
  const W = [[0, 0.0], [0.5, 0.2], [3, 0.3], [9.5, 0.3], [10.5, 0.22], [21.5, 0.22], [22.5, 0.08], [27.6, 0.1], [28.5, 0.3], [31, 0.4], [43.5, 0.45], [44.2, 0.15],
    [46.7, 0.2], [47.2, 0.72], [53.5, 0.66], [54.1, 0.12], [59.4, 0.15], [60.3, 0.12], [63.5, 0.2], [69.5, 0.25], [73, 0.2], [76, 0.25], [80, 0.12], [86, 0.05], [89, 0.0]];
  const windAt = t => { for (let i = 1; i < W.length; i++) if (t <= W[i][0]) { const k = (t - W[i - 1][0]) / (W[i][0] - W[i - 1][0]); return W[i - 1][1] + (W[i][1] - W[i - 1][1]) * k; } return 0; };
  for (let t = 0.05; t < END; t += 0.05) {
    const I = windAt(t), storm = t > 47 && t < 54 ? 1 : 0;
    const gust = Math.max(0, S.wander(t * 0.4 + 2) * 0.8 - 0.2) * (0.4 + I);
    wind.set({ time: t, intensity: I, whiteout: storm * 0.9, gust, shelter: 0, cower: 0, pan: S.wander(t * 0.07), speed: I, still: I < 0.15 ? 1 : 0 }, t);
  }
  windBus.gain.setValueAtTime(0, 0); windBus.gain.linearRampToValueAtTime(0.75, 2.5);
  windBus.gain.setValueAtTime(0.75, 46.8); windBus.gain.linearRampToValueAtTime(0.3, 47.4);
  windBus.gain.setValueAtTime(0.3, 53.8); windBus.gain.linearRampToValueAtTime(0.75, 54.4);
  windBus.gain.setValueAtTime(0.75, 86); windBus.gain.linearRampToValueAtTime(0, END - 0.3);

  // the game's sfx from each shot's own events
  const sfxRoot = ctx.createGain(); sfxRoot.gain.value = 1; sfxRoot.connect(sfx);
  const sfxRev = ctx.createGain(); sfxRev.gain.value = 0.25; sfxRoot.connect(sfxRev); sfxRev.connect(roomIn);
  const LEVEL = { step: 0.5, crack: 0.9, creak: 0.8, breakthrough: 1.1, plunge: 1.0, splash: 0.7, axe: 0.9, kick: 0.7, bear: 1.0, flare: 1.0, pitch: 0.9, wrap: 0.7, bark: 0.35, howl: 0.3, tent: 0.6, transfer: 0.5, heave: 0.9, thirdman: 0.3 };
  const quietIn = { radio: ['step'], camp: ['step'] };
  let count = 0;
  for (const s of shots) {
    const evs = events[s.id] || [];
    let lastStep = -1;
    for (const e of evs) {
      if (e.t < 0 || e.t >= s.dur) continue;
      const t = s.at + e.t;
      if (t > cues.silence[0] - 0.02 && t < cues.silence[1]) continue;     // nothing in the silence
      if (quietIn[s.id]?.includes(e.type)) continue;
      if (e.type === 'step' && s.dur - e.t < 0.22) continue;
      const g = ctx.createGain(); g.gain.value = LEVEL[e.type] ?? 0; if (!g.gain.value) continue;
      const pn = panner(Math.max(-0.6, Math.min(0.6, (rnd() - 0.5) * 0.3))); g.connect(pn).connect(sfxRoot);
      try {
        switch (e.type) {
          case 'step': if (t - lastStep < 0.12) break; lastStep = t; S.footstep(ctx, B, g, t, { terrain: e.terrain, weight: e.weight ?? 1, foot: e.foot, cold: 0.6 }); break;
          case 'crack': S.crack(ctx, B, g, t, { strength: e.strength ?? 0.6 }); break;
          case 'creak': S.creak(ctx, g, t, 0.6 + 0.8 * (e.strength ?? 0.5)); break;
          case 'breakthrough': S.breakthrough(ctx, B, g, t); break;
          case 'plunge': S.plunge(ctx, B, g, t, e); break;
          case 'splash': S.splash(ctx, B, g, t, e); break;
          case 'axe': S.axe(ctx, B, g, t, e); break;
          case 'kick': S.kick(ctx, B, g, t, e); break;
          case 'heave': if (e.stage === 'pull') { if (e.axes) S.axe(ctx, B, g, t, {}); else S.splash(ctx, B, g, t, { strength: 0.6 }); } else if (e.stage === 'out') S.scuff(ctx, B, g, t, { strength: 1 }); else S.splash(ctx, B, g, t, { strength: 0.9 }); break;
          case 'bear': (e.kind !== 'huff' && e.kind !== 'growl' ? S.bearAct : S.bear)(ctx, B, g, t, e); break;
          case 'flare': {
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 10000; lp.Q.value = 0.5;
            const dk = ctx.createGain(); dk.gain.value = e.stage === 'burn' ? 0.5 : 1;
            lp.connect(dk).connect(g); S.flare(ctx, B, lp, t, e); break;
          }
          case 'pitch': {
            const st = e.stage;
            if (st === 'collapse') S.canvas(ctx, B, g, t, { strength: 0.75 + 0.4 * (e.strength ?? 0.6), poles: true });
            else if (st === 'poles') S.pole(ctx, B, g, t, { strength: 0.7 });
            else if (st === 'stake') S.stake(ctx, B, g, t, { strength: 0.65 });
            else S.rustle(ctx, B, g, t, { strength: 0.6 });
            break;
          }
          case 'wrap': if (e.stage === 'tie' || e.stage === 'done') S.wrap(ctx, B, g, t, { strength: 0.6 }); else S.rustle(ctx, B, g, t, { strength: 0.5 }); break;
          case 'bark': S.bark(ctx, B, g, t, e); break;
          case 'howl': S.howl(ctx, B, g, t, e); break;
          case 'tent': case 'transfer': S.rustle(ctx, B, g, t, { strength: 0.6 }); break;
          case 'thirdman': if (e.stage === 'step') S.footstep(ctx, B, g, t, { terrain: e.terrain || 'snow', weight: 0.35, cold: 0.6 }); break;
        }
        count++;
      } catch (err) { console.warn('sfx', e.type, err.message); }
    }
  }
  console.log('sfx events', count);

  const buf = await ctx.startRendering();
  return buf;
}

// 16-bit stereo WAV, base64
export function wavBase64(buf) {
  const n = buf.length, ch = buf.numberOfChannels, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); data.setUint32(16, 16, true);
  data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(ch > 1 ? 1 : 0);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = peak > 0.98 ? 0.98 / peak : 1;
  for (let i = 0, o = 44; i < n; i++) { data.setInt16(o, Math.max(-1, Math.min(1, L[i] * k)) * 32767, true); o += 2; data.setInt16(o, Math.max(-1, Math.min(1, R[i] * k)) * 32767, true); o += 2; }
  const bytes = new Uint8Array(data.buffer); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(s), peak };
}
