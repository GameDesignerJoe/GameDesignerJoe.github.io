// The Maze, first person — what you hear
//
// Joe: "I want us to do the audio pass, including some ambient music carried over. I feel like I'm
// walking with one leg without audio." And from his notes: "padded feet walking on the backrooms …
// so each theme will have its own sounds", "a good palette of ambient noises to build suspense",
// "flickering lights, carpeted footsteps, squeeze through rubbing."
//
// The music is the top-down's own — AUDIO in js/audio.js, the drone bed and the composer playing
// each self's preset from data/music.js — started as it is there, unchanged. This file is the rest:
// everything a body in a room makes, synthesized like the top-down's, no files. Its own context, so
// hiding in a closet can muffle the room without touching the music.
//
// Each look names how its floor sounds and how its room hums (FP_SOUND.looks). Better recordings can
// replace any of these later without the game noticing: each is one function.

const FP_SOUND = (() => {
  let ac = null, out, muffle, room, hum, humGain, rub, rubGain, started = false, on = true, flickQuiet = 0;
  const looks = {
    // the back rooms: soft thumps on damp carpet, a wide low room tone, fluorescent hum
    office:   { step: 'carpet', tone: 0.05, toneHz: 240, hum: 1 },
    // worn stone: a sharp little click and its echo, an airy room, no hum
    bleached: { step: 'stone',  tone: 0.03, toneHz: 500, hum: 0 },
    dusk:     { step: 'stone',  tone: 0.035, toneHz: 320, hum: 0 },
  };
  let look = looks.office;

  function noiseBuf(sec, brown) {
    const b = ac.createBuffer(1, Math.max(1, ac.sampleRate * sec | 0), ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w; }
    return b;
  }
  function ensure() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    out = ac.createGain(); out.gain.value = on ? FP_CONFIG.sfxVol : 0; out.connect(ac.destination);
    muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000; muffle.connect(out);
    // the room: brown noise, low, always there — the sound of a big building with nobody in it
    const rs = ac.createBufferSource(); rs.buffer = noiseBuf(4, true); rs.loop = true;
    const rf = ac.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = look.toneHz;
    room = ac.createGain(); room.gain.value = 0; rs.connect(rf); rf.connect(room); room.connect(muffle); rs.start();
    room.f = rf;
    // the lights: mains hum and its buzz, only as loud as the nearest lamp is near
    hum = ac.createGain(); hum.gain.value = 0; hum.connect(muffle);
    for (const [f, type, g] of [[120, 'sawtooth', 0.35], [240, 'square', 0.12], [360, 'sine', 0.2]]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
      const gg = ac.createGain(); gg.gain.value = g; o.connect(bp); bp.connect(gg); gg.connect(hum); o.start();
    }
    humGain = 0;
    // a squeeze: cloth and shoulder on plaster, a band of noise that swells as you push through
    const ns = ac.createBufferSource(); ns.buffer = noiseBuf(2); ns.loop = true;
    const nb = ac.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 850; nb.Q.value = 1.4;
    const lfo = ac.createOscillator(); lfo.frequency.value = 2.3; const lg = ac.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(nb.frequency); lfo.start();
    rub = ac.createGain(); rub.gain.value = 0; ns.connect(nb); nb.connect(rub); rub.connect(muffle); ns.start();
    rubGain = 0;
    return true;
  }
  const now = () => ac.currentTime;
  function burst(dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', at = 0 } = {}) {
    const t = now() + at, n = ac.createBufferSource(); n.buffer = noiseBuf(dur + 0.05);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(muffle); n.start(t); n.stop(t + dur + 0.05);
  }
  function tone(freq, dur, { vol = 0.1, type = 'sine', slide = 0, at = 0, attack = 0.005 } = {}) {
    const t = now() + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(muffle); o.start(t); o.stop(t + dur + 0.05);
  }
  const live = () => ac && started && on && ac.state === 'running';

  return {
    looks,
    // the first touch or key: browsers only let sound start from one
    start(themeName, who) {
      if (!ensure()) return;
      try { ac.resume(); } catch (e) {}
      if (typeof AUDIO !== 'undefined') { AUDIO.begin(); if (who) AUDIO.setMusic(who); }
      if (!started) { started = true; this.setLook(themeName); }
    },
    setLook(name) {
      look = looks[name] || looks.office;
      if (!ac) return;
      room.f.frequency.setTargetAtTime(look.toneHz, now(), 0.5);
      room.gain.setTargetAtTime(on ? look.tone : 0, now(), 1.5);
    },
    setMusic(who) { if (typeof AUDIO !== 'undefined' && who) AUDIO.setMusic(who); },
    setEnabled(v) {
      on = v;
      if (typeof AUDIO !== 'undefined') AUDIO.setEnabled(v);
      if (ac) out.gain.setTargetAtTime(v ? FP_CONFIG.sfxVol : 0, now(), 0.2);
    },
    setVolume(v) { if (ac && on) out.gain.setTargetAtTime(v, now(), 0.1); },
    // one foot down. Carpet is a padded thump with no top; stone is a click and a short ring after it
    step(speed, dim) {
      if (!live()) return;
      const v = (0.1 + 0.12 * Math.min(1, speed)) * (dim ? 0.7 : 1);
      if (look.step === 'carpet') {
        burst(0.09, { vol: v * 1.6, freq: 180 + Math.random() * 60, q: 0.9, type: 'lowpass' });
        burst(0.05, { vol: v * 0.35, freq: 900 + Math.random() * 300, q: 1.5, at: 0.012 });   // the scuff of it
      } else {
        burst(0.04, { vol: v * 1.1, freq: 2200 + Math.random() * 600, q: 3 });
        burst(0.12, { vol: v * 0.8, freq: 260, q: 1, type: 'lowpass' });
        burst(0.3, { vol: v * 0.12, freq: 1800, q: 6, at: 0.07 });   // the room giving it back
      }
    },
    // every frame: how near the lamps are (0 none … 1 under one), and how hard you are pushing through a squeeze
    frame(humLevel, rubLevel) {
      if (!live()) return;
      const h = look.hum * humLevel * 0.06, r = rubLevel * 0.22;
      if (Math.abs(h - humGain) > 0.002) { hum.gain.setTargetAtTime(h, now(), 0.15); humGain = h; }
      if (Math.abs(r - rubGain) > 0.005) { rub.gain.setTargetAtTime(r, now(), 0.08); rubGain = r; }
    },
    // a lamp on its way out, stuttering: a crackle, and the hum dropping with it
    flicker(level) {
      if (!live() || now() < flickQuiet) return;
      flickQuiet = now() + 0.35 + Math.random() * 0.5;   // a stutter, not a machine gun
      burst(0.05 + Math.random() * 0.05, { vol: 0.06 * level, freq: 3200 + Math.random() * 2000, q: 4 });
      tone(120, 0.08, { type: 'sawtooth', vol: 0.03 * level });
    },
    // a door: the creak of the hinge, and for a shutting one the latch catching at the end
    door(opening) {
      if (!live()) return;
      const f0 = opening ? 160 + Math.random() * 40 : 210, f1 = opening ? 110 : 150;
      tone(f0, 0.42, { type: 'sawtooth', vol: 0.035, slide: f1, attack: 0.05 });
      burst(0.4, { vol: 0.07, freq: f0 * 4, q: 9 });
      if (!opening) { burst(0.05, { vol: 0.35, freq: 1400, q: 2, at: 0.36 }); burst(0.12, { vol: 0.25, freq: 160, q: 1, type: 'lowpass', at: 0.36 }); }
    },
    // in a closet the room goes thick and close; out again, it opens back up
    hide(inside) {
      if (!ac) return;
      muffle.frequency.setTargetAtTime(inside ? 650 : 18000, now(), 0.12);
      if (live()) { burst(0.25, { vol: 0.18, freq: 420, q: 1.2, type: 'lowpass' }); burst(0.06, { vol: 0.2, freq: 1600, q: 2, at: inside ? 0.18 : 0.02 }); }
    },
    // the small things, borrowed from the top-down so they sound the same in both
    page() { if (live() && typeof AUDIO !== 'undefined') AUDIO.journal(); },
    chalkUp() { if (live() && typeof AUDIO !== 'undefined') AUDIO.pickupChalk(); },
    chalkMark() { if (live() && typeof AUDIO !== 'undefined') AUDIO.chalkDown(); },
    empty() { if (live() && typeof AUDIO !== 'undefined') AUDIO.chalkEmpty(); },
    out() { if (live() && typeof AUDIO !== 'undefined') AUDIO.exit(); },
    running: () => !!ac && ac.state === 'running' && started,
  };
})();
