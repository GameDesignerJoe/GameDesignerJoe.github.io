// The Maze — the drone bed and the generative composer
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── audio: synthesized, no files ────────────────────────────────
const AUDIO = (() => {
  let ac, master, musicBus, sfxBus, drone = null, enabled = CONFIG.sound, currentMusic = 'The Child';
  function ensure() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ac.createGain(); master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = CONFIG.musicVolume; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = CONFIG.sfxVolume; sfxBus.connect(master);
    master.gain.value = enabled ? 1 : 0;
    return true;
  }
  function noiseBuffer(sec) { const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; return b; }
  function startDrone() {
    if (drone || !ensure()) return;
    drone = { nodes: [] };
    const out = ac.createGain(); out.gain.value = 0; out.connect(musicBus);
    out.gain.linearRampToValueAtTime(1, ac.currentTime + 6);
    // three slow detuned pads a fifth and an octave apart, filtered
    const padG = ac.createGain(); padG.gain.value = 0.35; padG.connect(out);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7; lp.connect(padG);
    [[55, 0], [82.4, 0.6], [110, -0.4], [164.8, 0.3]].forEach(([f, det], i) => {
      const o = ac.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = det * 8;
      const g = ac.createGain(); g.gain.value = i === 0 ? 0.35 : 0.18;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + i * 0.023; const lg = ac.createGain(); lg.gain.value = g.gain.value * 0.6;
      lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(lp); o.start(); lfo.start();
      drone.nodes.push(o, lfo);
    });
    // slow filter sweep so it breathes
    const flfo = ac.createOscillator(); flfo.frequency.value = 0.017; const fg = ac.createGain(); fg.gain.value = 180; flfo.connect(fg); fg.connect(lp.frequency); flfo.start(); drone.nodes.push(flfo);
    // the composer: reads the current preset each bar, so a change of self changes the music without a cut
    const echo = ac.createDelay(2.0); echo.delayTime.value = 0.62; const fb = ac.createGain(); fb.gain.value = 0.45; const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 900;
    echo.connect(fb); fb.connect(ef); ef.connect(echo); const eg = ac.createGain(); eg.gain.value = 0.7; echo.connect(eg); eg.connect(out);
    drone.padGain = padG; drone.echoGain = eg;
    let bar = 0;
    const play = (freq, dur, preset, vol) => {
      const t = ac.currentTime, g = ac.createGain(); g.connect(out); g.connect(echo);
      const mk = (type, f, det, gain, a, d, lpf) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det || 0; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpf; const gg = ac.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(gain, t + a); gg.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(lp); lp.connect(gg); gg.connect(g); o.start(t); o.stop(t + d + 0.1); };
      switch (preset.inst) {
        case 'musicbox': mk('sine', freq, 0, vol, 0.005, dur * 0.9, 6000); mk('sine', freq * 3, 0, vol * 0.18, 0.005, dur * 0.35, 8000); mk('triangle', freq * 2, 0, vol * 0.12, 0.005, dur * 0.5, 6000); break;
        case 'pluck':    mk('triangle', freq, 0, vol, 0.004, dur * 0.7, 2600); mk('sine', freq * 2, 0, vol * 0.25, 0.004, dur * 0.3, 4000); break;
        case 'organ':    mk('sine', freq, 0, vol * 0.7, dur * 0.35, dur * 1.6, 1800); mk('sine', freq * 1.5, 0, vol * 0.45, dur * 0.4, dur * 1.5, 1800); mk('sine', freq * 2, 0, vol * 0.3, dur * 0.45, dur * 1.4, 1800); break;
        case 'pad':      mk('sine', freq, -4, vol * 0.7, dur * 0.5, dur * 2.2, preset.bright ? 3000 : 1200); mk('triangle', freq, 5, vol * 0.35, dur * 0.6, dur * 2, 1000); break;
        case 'bass':     mk(preset.grit ? 'sawtooth' : 'triangle', freq, preset.detune || 0, vol * 0.9, 0.02, dur * 1.1, preset.grit ? 380 : 500); if (preset.grit) mk('sawtooth', freq, -(preset.detune || 0), vol * 0.5, 0.02, dur, 300); break;
        case 'tick':     mk('square', freq, 0, vol * 0.5, 0.002, 0.09, 2200); mk('sine', freq, 0, vol * 0.35, 0.002, dur * 0.45, 3000); break;
      }
    };
    const beat = () => {
      if (!drone) return;
      const preset = MUSIC[currentMusic] || MUSIC['You'];
      const spb = 60 / preset.bpm, bars = 4;
      drone.padGain.gain.setTargetAtTime(preset.drone, ac.currentTime, 2); drone.echoGain.gain.setTargetAtTime(preset.echo, ac.currentTime, 2);
      const inMotif = preset.motif && preset.motifEvery && bar % preset.motifEvery === 0, restBar = !inMotif && Math.random() < preset.rests;
      for (let i = 0; i < bars; i++) setTimeout(() => {
        if (!drone) return;
        let deg = null;
        if (inMotif && i < preset.motif.length) deg = preset.motif[i];
        else if (!restBar && !inMotif && Math.random() < preset.density) deg = preset.exact ? [0, 2, 1, 0][i] : Math.floor(Math.random() * preset.scale.length) - 1;   // 'exact' selves never vary
        if (deg === null) { if (preset.pulse && i % 2 === 0) noise(0.05, { vol: 0.08, freq: 160, q: 1.5, type: 'lowpass' }); return; }
        const n = preset.scale.length, oct = Math.floor(deg / n), st = preset.scale[((deg % n) + n) % n] + 12 * oct;
        let f = preset.root * Math.pow(2, st / 12);
        if (preset.slip && Math.random() < preset.slip) { f *= Math.pow(2, 1 / 12); setTimeout(() => play(f / Math.pow(2, 1 / 12), spb * 1.2, preset, 0.045), spb * 400); }   // a wrong note, then the correction
        play(f, spb * (preset.inst === 'organ' || preset.inst === 'pad' ? 2.2 : 1.4), preset, preset.inst === 'bass' ? 0.07 : 0.05);
        if (preset.pulse && i % 2 === 0) noise(0.05, { vol: 0.08, freq: 160, q: 1.5, type: 'lowpass' });
      }, i * spb * 1000);
      bar++;
      drone.noteTimer = setTimeout(beat, bars * spb * 1000);
    };
    drone.noteTimer = setTimeout(beat, 2500);
    // wind: filtered noise, very quiet
    const n = ac.createBufferSource(); n.buffer = noiseBuffer(4); n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.5;
    const ng = ac.createGain(); ng.gain.value = 0.05; const wl = ac.createOscillator(); wl.frequency.value = 0.09; const wg = ac.createGain(); wg.gain.value = 0.03;
    wl.connect(wg); wg.connect(ng.gain); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(); wl.start(); drone.nodes.push(n, wl);
  }
  function tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = null, bus = null } = {}) {
    if (!ensure()) return; const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, { vol = 0.3, freq = 1500, q = 1, type = 'bandpass' } = {}) {
    if (!ensure()) return; const t = ac.currentTime;
    const n = ac.createBufferSource(); n.buffer = noiseBuffer(dur + 0.1);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.1);
  }
  // How loud something standing at tile (x,y) should be from where the player is.
  // Walking distance, not line of sight: a swing three tiles away through a wall
  // is as far off as the walk around to it. Bounded by sfxRangeTiles, so the
  // search is small and costs nothing at the rate these fire.
  function earshot(x, y) {
    const near = CONFIG.sfxNearTiles, far = CONFIG.sfxRangeTiles;
    const px = Math.floor(player.x), py = Math.floor(player.y);
    if (px === x && py === y) return 1;
    const fall = (d) => (d <= near ? 1 : Math.max(0, 1 - (d - near) / (far - near)));
    const seen = new Set([px + ',' + py]);
    let edge = [[px, py]];
    for (let d = 1; d <= far && edge.length; d++) {
      const next = [];
      for (const [cx, cy] of edge) {
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
          // the target itself may be shut mid-slide, so reach it before the wall test
          if (nx === x && ny === y) return fall(d);
          if (seen.has(k) || !isOpen(nx, ny)) continue;
          seen.add(k); next.push([nx, ny]);
        }
      }
      edge = next;
    }
    return 0;   // out of earshot, or nothing open leads to it
  }

  return {
    unlock() { if (ensure() && ac.state === 'suspended') ac.resume(); },
    begin() { this.unlock(); startDrone(); },
    setMusic(name) { currentMusic = name; },
    setEnabled(on) { enabled = on; if (ensure()) master.gain.linearRampToValueAtTime(on ? 1 : 0, ac.currentTime + 0.3); },
    step(inTunnel) { noise(0.06, { vol: inTunnel ? 0.05 : 0.09, freq: inTunnel ? 400 : 900 + Math.random()*300, q: 2 }); },
    bump() { tone(70, 0.12, { type: 'triangle', vol: 0.25, slide: 40 }); },
    chalkDown() { noise(0.18, { vol: 0.22, freq: 3200, q: 0.8, type: 'highpass' }); },
    chalkUp() { noise(0.1, { vol: 0.15, freq: 2400, q: 1 }); tone(660, 0.12, { vol: 0.08 }); },
    chalkEmpty() { tone(140, 0.1, { type: 'square', vol: 0.06 }); },
    pickup() { tone(523, 0.18, { vol: 0.14 }); setTimeout(() => tone(784, 0.3, { vol: 0.14 }), 90); },
    pickupChalk() { tone(440, 0.12, { vol: 0.1 }); noise(0.08, { vol: 0.1, freq: 2600 }); },
    key() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.35, { vol: 0.12 }), i * 110)); },
    gate() { noise(0.3, { vol: 0.25, freq: 600, q: 2 }); tone(90, 0.5, { type: 'triangle', vol: 0.2, slide: 60 }); },
    slideStart() { noise(CONFIG.sliderSeconds, { vol: 0.35, freq: 220, q: 1.2, type: 'lowpass' }); tone(48, CONFIG.sliderSeconds, { type: 'triangle', vol: 0.25, attack: 0.1, slide: 42 }); },
    slideEnd() { tone(60, 0.25, { type: 'triangle', vol: 0.3, slide: 30 }); noise(0.1, { vol: 0.2, freq: 500, q: 2 }); },
    charcoalStart() { noise(0.3, { vol: 0.2, freq: 1200, q: 0.7, type: 'highpass' }); tone(330, 0.25, { vol: 0.06 }); },
    charcoalEnd() { noise(0.12, { vol: 0.12, freq: 700, q: 1 }); tone(220, 0.3, { vol: 0.06, slide: 160 }); },
    paper() { noise(0.12, { vol: 0.1, freq: 2600, q: 0.7, type: 'highpass' }); },
    unfold() { noise(0.45, { vol: 0.14, freq: 1400, q: 0.5, type: 'bandpass' }); },
    lampOn() { noise(0.08, { vol: 0.15, freq: 3000, q: 1, type: 'highpass' }); tone(523, 0.5, { vol: 0.07, attack: 0.02 }); tone(784, 0.7, { vol: 0.04, attack: 0.1 }); },
    // a switch under your foot, then a tube arguing with itself before it holds
    secretLights() {
      noise(0.05, { vol: 0.22, freq: 2200, q: 3, type: 'highpass' });
      tone(180, 0.08, { type: 'square', vol: 0.06 });
      const secs = CONFIG.secretLightSec;
      for (let i = 0; i < 5; i++) setTimeout(() => { noise(0.05, { vol: 0.1, freq: 900 + Math.random() * 1400, q: 2 }); tone(120, 0.05, { type: 'square', vol: 0.04 }); }, 140 + i * (secs * 700) / 5 + Math.random() * 60);
      setTimeout(() => { tone(100, 2.4, { vol: 0.035, attack: 0.3 }); tone(150.5, 2.4, { vol: 0.022, attack: 0.4 }); }, secs * 900);
    },
    lampOff() { tone(392, 0.25, { vol: 0.06, slide: 300 }); },
    wake() { tone(196, 1.6, { vol: 0.08, attack: 0.4 }); setTimeout(() => tone(294, 1.8, { vol: 0.06, attack: 0.5 }), 700); },
    // waking up one burden lighter: the same low swell, with a major figure opening over it
    lifted() { tone(196, 2.2, { vol: 0.07, attack: 0.5 }); tone(294, 2.6, { vol: 0.05, attack: 0.8 });
      [392, 493.9, 587.3, 784].forEach((f, i) => setTimeout(() => tone(f, 2.6 - i * 0.3, { vol: 0.075 - i * 0.008, attack: 0.25 }), 500 + i * 420)); },
    stone() { tone(110, 0.3, { type: 'triangle', vol: 0.15, slide: 80 }); noise(0.08, { vol: 0.12, freq: 600, q: 2 }); },
    stoneDrop() { noise(0.5, { vol: 0.25, freq: 900, q: 0.8, type: 'lowpass' }); tone(146, 1.2, { vol: 0.1, attack: 0.02, slide: 98 }); setTimeout(() => tone(392, 2.4, { vol: 0.05, attack: 0.6 }), 400); },
    poolEnter() { [261.6, 329.6, 392].forEach((f, i) => setTimeout(() => tone(f, 3.5, { vol: 0.05, attack: 0.8 }), i * 500)); },
    // Swings move on their own, anywhere in the maze, so this is the one sound
    // that is usually not at your feet. Carry: 1 right next to you, 0 out of
    // earshot. Distance takes the top off it as well as the volume.
    swing(x, y) {
      const carry = (x === undefined) ? 1 : earshot(x, y);
      if (carry <= 0) return;
      noise(CONFIG.sliderSeconds * 0.5, { vol: 0.12 * carry, freq: 200 + 60 * carry, q: 1.5, type: 'lowpass' });
      tone(70, CONFIG.sliderSeconds, { type: 'triangle', vol: 0.08 * carry, attack: 0.2, slide: 90 });
    },
    hop(n) { tone(440 * Math.pow(2, (n % 8) / 12), 0.15, { vol: 0.08 }); },
    // Cloth and shoulder against concrete, not a knock. Three soft scrapes staggered a little
    // apart rather than one hit, and never quite the same twice, so it reads as movement.
    squeeze(entering) {
      const base = entering ? 520 : 900;
      for (let i = 0; i < 3; i++) setTimeout(() => noise(0.16 + Math.random() * 0.14, {
        vol: (0.075 - i * 0.017) * (0.8 + Math.random() * 0.4),
        freq: base * (0.85 + Math.random() * 0.5) + i * 120, q: 0.7, type: 'bandpass',
      }), i * (55 + Math.random() * 70));
      tone(entering ? 72 : 96, 0.32, { type: 'triangle', vol: 0.045, attack: 0.05, slide: entering ? 58 : 126 });
    },
    farSteps() { for (let i = 0; i < 6; i++) setTimeout(() => noise(0.05, { vol: 0.07 * (1 - i / 7), freq: 700 - i * 40, q: 2 }), i * 380 + Math.random() * 60); },
    // stone on stone, and heavy: a long grinding drag with the grit audible in it
    doorSlide() {
      const secs = CONFIG.poolDoorSeconds;
      noise(secs, { vol: 0.2, freq: 300, q: 0.9, type: 'lowpass' });
      noise(secs * 0.9, { vol: 0.1, freq: 1400, q: 0.6, type: 'bandpass' });
      tone(52, secs, { type: 'triangle', vol: 0.13, attack: 0.25, slide: 44 });
      for (let i = 0; i < 7; i++) setTimeout(() => noise(0.07, { vol: 0.05 + Math.random() * 0.05, freq: 700 + Math.random() * 900, q: 2 }), 180 + i * (secs * 1000 - 400) / 7 + Math.random() * 120);
      setTimeout(() => { tone(60, 0.4, { type: 'triangle', vol: 0.12, slide: 34 }); noise(0.2, { vol: 0.14, freq: 420, q: 1.4 }); }, secs * 1000);
    },
    locked() { tone(180, 0.15, { type: 'square', vol: 0.08 }); setTimeout(() => noise(0.12, { vol: 0.15, freq: 900, q: 3 }), 40); },
    narrator() { tone(880, 0.6, { vol: 0.05, attack: 0.15 }); },
    journal() { noise(0.25, { vol: 0.12, freq: 1800, q: 0.6, type: 'highpass' }); setTimeout(() => tone(392, 0.8, { vol: 0.05, attack: 0.2 }), 120); },
    exit() { [261, 329, 392, 523, 659].forEach((f, i) => setTimeout(() => tone(f, 1.4, { vol: 0.12, attack: 0.05 }), i * 160)); },
  };
})();

