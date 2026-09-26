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
  function burst(dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', at = 0, dest = null, slide = 0 } = {}) {
    const t = now() + at, n = ac.createBufferSource(); n.buffer = noiseBuf(dur + 0.05);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(dest || muffle); n.start(t); n.stop(t + dur + 0.05);
  }
  function tone(freq, dur, { vol = 0.1, type = 'sine', slide = 0, at = 0, attack = 0.005, dest = null } = {}) {
    const t = now() + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || muffle); o.start(t); o.stop(t + dur + 0.05);
  }
  // somewhere else in the building: off to one side, through walls. A chain of its own per event —
  // a pan, a lowpass for the distance, a little of it again later for the size of the place
  function elsewhere() {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500 + Math.random() * 700;
    const g = ac.createGain(); g.gain.value = 0.5 + Math.random() * 0.4;
    let head = lp;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6); lp.connect(p); p.connect(g); }
    else lp.connect(g);
    const d = ac.createDelay(1); d.delayTime.value = 0.18 + Math.random() * 0.2; const fb = ac.createGain(); fb.gain.value = 0.28;
    g.connect(muffle); g.connect(d); d.connect(fb); fb.connect(d); fb.connect(muffle);
    return head;
  }
  // the things that happen out there. Joe: "we really need to do a better pass of sound effects heard
  // in the maze that represent other things happening." None of them is ever anywhere you can go
  const DISTANT = {
    slam(o) { burst(0.35, { vol: 0.9, freq: 160, q: 0.9, type: 'lowpass', dest: o }); burst(0.08, { vol: 0.4, freq: 900, q: 1.2, dest: o }); },
    run(o) { for (let i = 0; i < 9; i++) burst(0.07, { vol: 0.45 * (1 - i / 11), freq: 220 + Math.random() * 60, q: 1, type: 'lowpass', at: i * (0.15 + Math.random() * 0.02), dest: o }); },
    knock(o) { for (let i = 0; i < 3; i++) { burst(0.09, { vol: 0.7, freq: 320, q: 2.5, at: i * 0.28, dest: o }); tone(95, 0.12, { vol: 0.15, at: i * 0.28, dest: o }); } },
    ball(o) { let t = 0, gap = 0.55; for (let i = 0; i < 7; i++) { tone(150 - i * 4, 0.1, { vol: 0.3 * (1 - i / 9), at: t, dest: o }); burst(0.04, { vol: 0.2 * (1 - i / 9), freq: 700, q: 1.5, at: t, dest: o }); t += gap; gap *= 0.72; } },
    scrape(o) { burst(0.7, { vol: 0.5, freq: 520, q: 3, slide: 240, dest: o }); },
    clank(o) { tone(610, 0.5, { type: 'triangle', vol: 0.12, dest: o }); tone(947, 0.35, { type: 'triangle', vol: 0.07, dest: o }); burst(0.05, { vol: 0.4, freq: 2600, q: 2, dest: o }); },
  };
  let nextDistant = 0;
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
    // picking things up. Joe: "I'm not hearing anything when I pick up items." They were the top-down's
    // own cues, soft enough to vanish under the music and the room here, so this view has its own, on
    // the room's channel: the thing in your hand first, then a small tone that says you have it
    page() {
      if (!live()) return;
      for (let i = 0; i < 4; i++) burst(0.06 + Math.random() * 0.05, { vol: 0.22 - i * 0.03, freq: 3200 + Math.random() * 2400, q: 0.8, type: 'highpass', at: i * 0.07 });   // the paper
      tone(523, 0.7, { vol: 0.09, attack: 0.04, at: 0.12 }); tone(784, 0.9, { vol: 0.06, attack: 0.05, at: 0.26 });
    },
    chalkUp() {
      if (!live()) return;
      burst(0.03, { vol: 0.4, freq: 2600, q: 3 }); burst(0.05, { vol: 0.2, freq: 1300, q: 2, at: 0.03 });   // a stick of chalk off the floor
      tone(660, 0.2, { type: 'triangle', vol: 0.12, at: 0.05 }); tone(990, 0.3, { type: 'triangle', vol: 0.07, at: 0.11 });
    },
    charcoalUp() {
      if (!live()) return;
      burst(0.05, { vol: 0.35, freq: 700, q: 1.2, type: 'lowpass' }); burst(0.04, { vol: 0.12, freq: 1800, q: 2, at: 0.02 });   // duller, softer
      tone(392, 0.25, { type: 'triangle', vol: 0.11, at: 0.05 }); tone(523, 0.3, { type: 'triangle', vol: 0.06, at: 0.12 });
    },
    // the rest borrowed from the top-down so they sound the same in both
    chalkMark() { if (live() && typeof AUDIO !== 'undefined') AUDIO.chalkDown(); },
    empty() { if (live() && typeof AUDIO !== 'undefined') AUDIO.chalkEmpty(); },
    // a light switch: the snap of the toggle; on, the starter's tick and the tube catching after it
    flip(on) {
      if (!live()) return;
      burst(0.018, { vol: 0.32, freq: 3200, q: 2.5 }); burst(0.05, { vol: 0.18, freq: 700, q: 1.5, at: 0.006 });
      if (on) { burst(0.012, { vol: 0.08, freq: 5200, q: 4, at: 0.08 }); burst(0.012, { vol: 0.06, freq: 5200, q: 4, at: 0.23 }); tone(120, 0.35, { type: 'sawtooth', vol: 0.025, at: 0.25, attack: 0.03 }); }
    },
    // called every frame: now and then something happens somewhere else. `rate` 0 is never, 1 is about
    // once a minute, 2 twice. The first waits a while, so a maze starts quiet
    distant(nowMs, rate) {
      if (!live() || rate <= 0) { nextDistant = 0; return; }
      if (!nextDistant) { nextDistant = nowMs + (25 + Math.random() * 30) * 1000 / rate; return; }
      if (nowMs < nextDistant) return;
      nextDistant = nowMs + (35 + Math.random() * 50) * 1000 / rate;
      const names = Object.keys(DISTANT); DISTANT[names[Math.floor(Math.random() * names.length)]](elsewhere());
    },
    // the stairs: a door, a flight of feet going up (each step a little higher) or down, a door
    stairs(up) {
      if (!live()) return;
      this.door(true);
      for (let i = 0; i < 10; i++) burst(0.08, { vol: 0.28, freq: (up ? 170 + i * 9 : 260 - i * 9) + Math.random() * 20, q: 1, type: 'lowpass', at: 0.35 + i * 0.13 + (i > 4 ? 0.12 : 0) });
      setTimeout(() => this.door(false), 1100);
    },
    // the being. Its feet: heavy, quick, nearer each one; the signs before it: a low swell and the air
    // going tight; and when it has you, static, and something closing
    beingStep(near) { if (live()) { burst(0.09, { vol: 0.5 * near, freq: 120, q: 1, type: 'lowpass' }); burst(0.03, { vol: 0.15 * near, freq: 900, q: 2 }); } },
    beingSigns() { if (live()) { tone(49 * 4, 2.6, { type: 'sawtooth', vol: 0.045, slide: 58 * 4, attack: 0.8 }); burst(2.4, { vol: 0.14, freq: 90, q: 0.6, type: 'lowpass' }); } },
    beingSees() { if (live()) { burst(0.9, { vol: 0.22, freq: 600, q: 0.8, slide: 1800 }); tone(220, 0.8, { type: 'sawtooth', vol: 0.04, slide: 330, attack: 0.3 }); } },
    beingTakes() { if (live()) { burst(0.8, { vol: 0.5, freq: 3000, q: 0.3, type: 'highpass' }); tone(80 * 3, 1.2, { type: 'triangle', vol: 0.15, slide: 40 * 3 }); } },
    // a light going out: the tube's tick and its hum dropping away, quieter the further off it is
    lightOut(near) {
      if (!live()) return;
      burst(0.03, { vol: 0.25 * near, freq: 2600, q: 3 }); tone(120, 0.4, { type: 'sawtooth', vol: 0.03 * near, slide: 60 });
    },
    // the turn: something big in the building, far off, and every tube catching its breath
    turn() {
      if (!live()) return;
      tone(55 * 4, 2.2, { type: 'triangle', vol: 0.12, slide: 41 * 4, attack: 0.05 }); burst(1.6, { vol: 0.35, freq: 140, q: 0.7, type: 'lowpass' });
      for (let i = 0; i < 6; i++) burst(0.04, { vol: 0.12, freq: 3000 + Math.random() * 1500, q: 4, at: 0.1 + Math.random() * 1.1 });
      DISTANT.slam(elsewhere());
    },
    // something crossing the far end of a squeeze, fast: a scuffle of feet and a breath of air
    dart() {
      if (!live()) return;
      burst(0.3, { vol: 0.25, freq: 700, q: 0.7, slide: 2400 });
      for (let i = 0; i < 4; i++) burst(0.04, { vol: 0.3 - i * 0.05, freq: 260, q: 1.2, type: 'lowpass', at: 0.02 + i * 0.07 });
    },
    // the father, somewhere ahead: the top-down's own footsteps going away
    far() { if (live() && typeof AUDIO !== 'undefined') AUDIO.farSteps(); },
    out() { if (live() && typeof AUDIO !== 'undefined') AUDIO.exit(); },
    running: () => !!ac && ac.state === 'running' && started,
  };
})();
