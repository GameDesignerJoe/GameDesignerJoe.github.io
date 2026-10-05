// The score and the sounds, all synthesised. The score is an 8-bar loop in D minor, with a B phrase
// every other time round, a new pulse figure each pass and a new key on each floor, that grows with
// the danger: a drone and pad while you're unseen, a plucked pulse when a guard is near, a heartbeat
// and trembling strings while one is suspicious, drums and a driving bass in a chase. AUDIO.tension
// (0..1) is set by the game every frame; the layers fade in and out on their own. The mix is voiced
// for a phone speaker: the sub is trimmed and every layer carries its weight above 300 Hz, so the
// climb from calm to chase is something you hear on the device, not just feel on headphones.
(function () {
  'use strict';
  let ctx = null, master, music, cutG, duckG, duckLP, pulseDuck, sfx, verbIn, noiseBuf, layers = {}, timer = null;
  let muted = false, musicOn = true, tension = 0, smoothT = 0, heat = 0, heatAt = -9, ducked = false, cutUntil = 0;
  const BPM = 84, S16 = 60 / BPM / 4;
  let step = 0, cycle = 0, nextT = 0, stepDur = S16, curCh = [50, 53, 57], key = 0, lastStep = 0, stepSkip = false;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // D minor, two bars a chord. A: Dm Bb Gm A. B, every second time round: Dm Gm Eb A
  const PHRASES = [
    { chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], roots: [38, 34, 31, 33] },
    { chords: [[50, 53, 57], [43, 46, 50], [51, 55, 58], [45, 49, 52]], roots: [38, 31, 39, 33] },
  ];
  // the plucked pulse changes its figure each pass, so a long floor never hears the same loop twice running
  const PULSES = [[0, 0, 7, 0, 12, 0, 7, 10], [0, 7, 0, 12, 0, 10, 7, 0], [0, 0, 12, 7, 0, 3, 7, 10]];
  // each floor sits in its own key: D, F, C, G minor
  const KEYS = [0, 3, -2, 5];
  const floorKey = () => { const G = window.GAME; let f = 1; try { f = (G && G.floor) || 1; } catch (e) {} return KEYS[f % 4]; };

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    // a phone speaker can't play the sub, so don't spend the headroom on it
    const shelf = ctx.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 90; shelf.gain.value = -6;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 35; hp.Q.value = 0.7;
    // and a brickwall after the compressor so the big hits never clip
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
    master.connect(shelf); shelf.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    // a long dark room for everything to ring in
    const verb = ctx.createConvolver(); verb.buffer = impulse(3.2, 2.6);
    verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
    const verbLP = ctx.createBiquadFilter(); verbLP.type = 'lowpass'; verbLP.frequency.value = 3800;
    verbIn.connect(verbLP); verbLP.connect(verb); verb.connect(master);
    // music bus: the on/off switch, a cut for caught and clear, a muffled duck for the pause menu
    music = ctx.createGain(); music.gain.value = musicOn ? 0.62 : 0;
    cutG = ctx.createGain(); duckG = ctx.createGain();
    duckLP = ctx.createBiquadFilter(); duckLP.type = 'lowpass'; duckLP.frequency.value = 20000; duckLP.Q.value = 0.5;
    music.connect(cutG); cutG.connect(duckG); duckG.connect(duckLP); duckLP.connect(master);
    const mSend = ctx.createGain(); mSend.gain.value = 0.55; duckLP.connect(mSend); mSend.connect(verbIn);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    const sSend = ctx.createGain(); sSend.gain.value = 0.3; sfx.connect(sSend); sSend.connect(verbIn);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const k of ['drone', 'pad', 'pulse', 'beat', 'chase']) { const g = ctx.createGain(); g.gain.value = 0; g.connect(music); layers[k] = g; }
    // the pulse steps back for a moment under every stinger
    pulseDuck = ctx.createGain(); layers.pulse.disconnect(); layers.pulse.connect(pulseDuck); pulseDuck.connect(music);
    layers.pad.gain.value = 0.9;
    drone();
    nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }

  // the drone never stops: a low D with a slow breathing filter
  // (open enough, with a D3 on top, that the calm still reaches a phone speaker)
  let droneLP, droneOsc = [];
  function drone() {
    droneLP = ctx.createBiquadFilter(); droneLP.type = 'lowpass'; droneLP.frequency.value = 650; droneLP.Q.value = 4;
    droneLP.connect(layers.drone);
    for (const [m, mul, type, v] of [[26, 1, 'sine', 0.06], [38, 1, 'sawtooth', 0.18], [38, 1.004, 'sawtooth', 0.18], [45, 1, 'triangle', 0.05], [50, 1, 'sawtooth', 0.07]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = mtof(m + key) * mul; g.gain.value = v;
      o.connect(g); g.connect(droneLP); o.start(); droneOsc.push([o, m, mul]);
    }
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 220;
    lfo.connect(lg); lg.connect(droneLP.frequency); lfo.start();
    layers.drone.gain.setTargetAtTime(0.55, ctx.currentTime, 2);
  }
  // a new floor, a new key: the drone slides there and the score follows from the next bar
  function setKey(k, t) {
    if (k === key) return;
    key = k;
    for (const [o, m, mul] of droneOsc) o.frequency.setTargetAtTime(mtof(m + key) * mul, t, 0.6);
  }

  // ── instruments ────────────────────────────────────────────
  function env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + rel);
  }
  function voice(dest, t, f, o) {
    o = o || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'triangle'; osc.frequency.setValueAtTime(f, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + (o.glideT || o.dur || 0.2));
    if (o.detune) osc.detune.value = o.detune;
    let out = osc;
    if (o.lp) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(o.lp, t); lp.Q.value = o.q || 1;
      if (o.lpTo) lp.frequency.exponentialRampToValueAtTime(o.lpTo, t + (o.lpT || 0.2));
      osc.connect(lp); out = lp;
    }
    out.connect(g); g.connect(dest);
    env(g, t, o.a || 0.005, o.v || 0.2, o.dur || 0.1, o.rel || 0.15);
    osc.start(t); osc.stop(t + (o.a || 0.005) + (o.dur || 0.1) + (o.rel || 0.15) + 0.05);
  }
  function noise(dest, t, o) {
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.f || 3000, t); f.Q.value = o.q || 1;
    if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + (o.dur || 0.1) + (o.rel || 0.1));
    src.connect(f); f.connect(g); g.connect(dest);
    env(g, t, o.a || 0.002, o.v || 0.1, o.dur || 0.02, o.rel || 0.08);
    src.start(t, Math.random() * 1.5); src.stop(t + (o.a || 0.002) + (o.dur || 0.02) + (o.rel || 0.08) + 0.05);
  }
  function kick(dest, t, v) {
    voice(dest, t, 120, { type: 'sine', glide: 38, glideT: 0.14, v: v || 0.6, dur: 0.05, rel: 0.25 });
    noise(dest, t, { f: 900, q: 0.7, v: (v || 0.6) * 0.18, dur: 0.005, rel: 0.03 });
  }
  // the heartbeat: a low body, a woody thud an octave up and a soft knock, so a small speaker still beats
  function heart(dest, t, v) {
    voice(dest, t, 70, { type: 'sine', glide: 45, glideT: 0.12, v: 0.28 * v, dur: 0.04, rel: 0.2 });
    voice(dest, t, 140, { type: 'triangle', glide: 90, glideT: 0.08, v: 0.3 * v, dur: 0.03, rel: 0.18 });
    noise(dest, t, { ftype: 'lowpass', f: 450, q: 0.7, v: 0.12 * v, dur: 0.01, rel: 0.1 });
    noise(dest, t, { f: 1100, q: 1.2, v: 0.08 * v, dur: 0.004, rel: 0.05 });
  }
  function tom(dest, t, f, v) {
    voice(dest, t, f, { type: 'sine', glide: f * 0.55, glideT: 0.3, v, dur: 0.04, rel: 0.4 });
    noise(dest, t, { f: f * 3, q: 1.4, v: v * 0.25, dur: 0.01, rel: 0.12, ftype: 'bandpass' });
  }

  // ── the sequencer ──────────────────────────────────────────
  function schedule() {
    if (!ctx || ctx.state !== 'running') { if (ctx) nextT = ctx.currentTime + 0.1; return; }
    const now = ctx.currentTime;
    // the pause menu: the game stops setting the tension, so hold the score down ourselves
    const pe = document.getElementById('pause');
    const pz = ducked || !!(pe && pe.classList.contains('show'));
    if (pz !== duckOn) setDuck(pz);
    // layer levels follow the tension (and sit at calm while paused or just after a cut)
    const goal = pz || now < cutUntil ? 0.05 : tension;
    smoothT += (goal - smoothT) * (goal > smoothT ? 0.12 : pz ? 0.08 : 0.012);
    const t = smoothT;
    const lv = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    layers.pulse.gain.setTargetAtTime(lv(t, 0.12, 0.35) * 1.4, now, 0.4);
    // the heartbeat and strings step back in a chase (about 14 dB) so the drums carry the pulse
    layers.beat.gain.setTargetAtTime(lv(t, 0.4, 0.6) * 2 * (1 - 0.8 * lv(t, 0.78, 0.92)), now, 0.25);
    layers.chase.gain.setTargetAtTime(lv(t, 0.78, 0.92) * 2, now, 0.15);
    if (droneLP) droneLP.Q.setTargetAtTime(4 + t * 8, now, 0.5);
    // a chase pushes the tempo from 84 toward 100
    stepDur = S16 * BPM / (BPM + 16 * lv(t, 0.88, 0.98));
    while (nextT < now + 0.12) { play(step, nextT); step = (step + 1) % 128; if (!step) cycle++; nextT += stepDur; }
  }
  // how suspicious is the strongest guard? The game can say (AUDIO.heat); otherwise we look
  function curHeat(now) {
    if (now - heatAt < 0.5) return heat;
    const G = window.GAME; let h = 0;
    try {
      if (G && G.mode === 'play') {
        for (const gd of G.guards || []) h = Math.max(h, gd.state === 'chase' ? 1 : gd.state === 'patrol' ? 0 : gd.aw || 0);
        for (const c of G.cams || []) h = Math.max(h, c.alarm > 0 ? 1 : c.aw || 0);
      }
    } catch (e) {}
    return h;
  }
  let duckOn = false;
  function setDuck(on) {
    duckOn = on; const now = ctx.currentTime;
    duckG.gain.setTargetAtTime(on ? 0.18 : 1, now, on ? 0.08 : 0.25);
    duckLP.frequency.setTargetAtTime(on ? 600 : 20000, now, on ? 0.08 : 0.3);
  }
  // stop the score dead for a stinger to ring alone, then let it creep back in
  function cut(dur) {
    if (!ctx) return;
    const now = ctx.currentTime;
    cutG.gain.cancelScheduledValues(now); cutG.gain.setValueAtTime(cutG.gain.value, now);
    cutG.gain.setTargetAtTime(0, now, 0.03);
    cutG.gain.setTargetAtTime(1, now + dur, 0.5);
    smoothT = 0.05; cutUntil = now + dur;
  }
  // snap a stinger to the score's next sixteenth only when it's a hair away; never trail the flash
  function onGrid() {
    const t0 = ctx.currentTime + 0.005;
    if (!musicOn) return t0;
    let q = nextT; while (q - stepDur > t0) q -= stepDur;
    return q >= t0 && q - t0 < 0.05 ? q : t0;
  }
  function duckPulse(t) {
    pulseDuck.gain.cancelScheduledValues(t); pulseDuck.gain.setTargetAtTime(0.5, t, 0.015);
    pulseDuck.gain.setTargetAtTime(1, t + 0.4, 0.12);
  }
  function play(s, t) {
    const bar = Math.floor(s / 16), pos = s % 16;
    if (pos === 0) setKey(floorKey(), t);
    const ph = PHRASES[cycle % 2], ci = Math.floor(bar / 2) % 4, ch = ph.chords[ci].map(m => m + key), root = ph.roots[ci] + key;
    curCh = ch;
    const T = smoothT;
    // pad: a new chord every two bars, slow in and out
    if (pos === 0 && bar % 2 === 0) {
      for (const m of ch) for (const det of [-7, 7]) voice(layers.pad, t, mtof(m), { type: 'sawtooth', detune: det, lp: 900 + T * 1400, q: 0.7, a: 1.6, v: 0.045, dur: S16 * 32 - 1.6, rel: 1.8 });
      voice(layers.pad, t, mtof(ch[0] + 12), { type: 'sine', a: 2, v: 0.05, dur: S16 * 28, rel: 2 });
    }
    // a lone high note now and then, so the calm never quite settles
    if (pos === 8 && bar % 4 === 1) voice(layers.pad, t, mtof(ch[2] + 24), { type: 'sine', a: 0.02, v: 0.035, dur: 0.05, rel: 2.2 });
    if (layers.pulse.gain.value > 0.01 || T > 0.1) {
      // pulse: plucked eighths on the root and fifth, a clock tick under it
      if (pos % 2 === 0) {
        const pat = PULSES[cycle % 3], m = root + 24 + pat[pos / 2];
        voice(layers.pulse, t, mtof(m), { type: 'square', lp: 2000 + T * 2400, lpTo: 450, lpT: 0.14, q: 1.8, v: pos % 8 === 0 ? 0.13 : 0.1, dur: 0.02, rel: 0.16 });
      }
      noise(layers.pulse, t, { f: 7000, q: 2, v: pos % 4 === 2 ? 0.05 : 0.018, dur: 0.004, rel: 0.03, ftype: 'highpass' });
    }
    if (T > 0.35) {
      // the heartbeat rides the score's grid, so it follows the tempo and never drifts against the drums:
      // once a half bar while a guard wonders, on every beat when one is sure, a bare thud in a chase
      const h = curHeat(t);
      if (h < 0.5) { if (pos % 8 === 0) heart(layers.beat, t, 1); else if (pos % 8 === 1) heart(layers.beat, t, 0.6); }
      else if (h < 0.85) { if (pos % 4 === 0) heart(layers.beat, t, 1); else if (pos % 4 === 1) heart(layers.beat, t, 0.6); }
      else if (pos % 2 === 0) heart(layers.beat, t, pos % 4 === 0 ? 1 : 0.7);
      // and a string that trembles on the chord's third
      if (pos === 0 && bar % 2 === 0) {
        const o = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), tv = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(ch[1] + 12); lp.type = 'lowpass'; lp.frequency.value = 2200;
        // the tremolo rides on its own gain after the envelope, so it never swings through zero
        tv.gain.value = 0.5; trem.frequency.value = 7.5; tg.gain.value = 0.35; trem.connect(tg); tg.connect(tv.gain);
        o.connect(lp); lp.connect(g); g.connect(tv); tv.connect(layers.beat);
        env(g, t, 0.8, 0.12, S16 * 32 - 0.8, 0.6);
        o.start(t); trem.start(t); o.stop(t + S16 * 32 + 0.8); trem.stop(t + S16 * 32 + 0.8);
      }
    }
    if (T > 0.7) {
      // chase: sixteenth bass, toms, a snare on the backbeat, a tom roll into the top of each pass
      const fill = bar === 7 && pos >= 12;
      const bp = [0, 0, 12, 0, 0, 7, 0, 10, 0, 0, 12, 0, 13, 12, 7, 5];
      voice(layers.chase, t, mtof(root + bp[pos]), { type: 'sawtooth', lp: 1600, lpTo: 260, lpT: 0.1, q: 5, v: pos % 4 === 0 ? 0.13 : 0.08, dur: 0.03, rel: 0.08 });
      if (pos % 2 === 0) voice(layers.chase, t, mtof(root + 24 + bp[pos]), { type: 'square', lp: 2600, lpTo: 700, lpT: 0.08, q: 2, v: 0.1, dur: 0.02, rel: 0.07 });
      if (pos === 0 || pos === 6 || pos === 10) tom(layers.chase, t, pos === 0 ? 90 : 120, 0.3);
      // the kick takes the beat over from the heartbeat
      if (pos % 4 === 0) { const v = pos === 0 ? 1 : 0.8;   // a short, high-tuned kick: punch a phone can play, little sub to push the limiter
        voice(layers.chase, t, 160, { type: 'sine', glide: 60, glideT: 0.07, v: 0.24 * v, dur: 0.02, rel: 0.12 });
        noise(layers.chase, t, { f: 2600, q: 1, v: 0.12 * v, dur: 0.003, rel: 0.025 }); }
      if (fill) tom(layers.chase, t, [160, 140, 120, 100][pos - 12], 0.32 + (pos - 12) * 0.02);
      if (pos === 4 || (pos === 12 && !fill)) { noise(layers.chase, t, { f: 1800, q: 0.8, v: 0.4, dur: 0.02, rel: 0.16 }); voice(layers.chase, t, 190, { type: 'triangle', glide: 120, v: 0.12, dur: 0.02, rel: 0.08 }); }
      if (pos === 14 && bar % 2 === 1 && !fill) tom(layers.chase, t, 160, 0.35);
      // driving hats, open on the off-beat, so the chase cuts through a small speaker
      noise(layers.chase, t, { ftype: 'highpass', f: 6500, q: 0.8, v: pos % 4 === 2 ? 0.22 : 0.1, dur: 0.004, rel: pos % 4 === 2 ? 0.09 : 0.03 });
    }
  }

  // ── sound effects ──────────────────────────────────────────
  const T0 = () => ctx.currentTime + 0.005;
  const SFX = {
    // a step follows the stick: a gentle push is a soft, slow pad, nearly a full push a firm walk. The
    // weight is the second argument when it's a number, or GAME.P.m when the game passes run = false
    step(run) {
      const t = T0();
      if (run === true) { noise(sfx, t, { f: 1400, q: 1.2, v: 0.1, dur: 0.008, rel: 0.05 }); voice(sfx, t, 70, { type: 'sine', glide: 50, v: 0.1, dur: 0.01, rel: 0.06 }); return; }
      let m = typeof run === 'number' ? run : 0.6;
      if (typeof run !== 'number') try { const P = window.GAME && window.GAME.P; if (P && typeof P.m === 'number') m = P.m; } catch (e) {}
      m = Math.max(0, Math.min(1, m / 0.85));
      // a sneak takes longer strides of silence: below a third of the push, every other step is skipped
      if (m < 0.35 && t - lastStep < 0.7) { stepSkip = !stepSkip; if (stepSkip) return; }
      lastStep = t;
      noise(sfx, t, { f: 800 + 400 * m, q: 1.2, v: 0.03 + 0.05 * m, dur: 0.004 + 0.005 * m, rel: 0.03 + 0.025 * m });
    },
    locked() {   // a locked door: two dull knocks of the handle
      const t = T0();
      for (const d of [0, 0.09]) { voice(sfx, t + d, 90, { type: 'square', lp: 900, lpTo: 300, lpT: 0.06, v: 0.2, dur: 0.04, rel: 0.12 }); noise(sfx, t + d, { f: 900, q: 1, v: 0.14, dur: 0.005, rel: 0.05 }); }
    },
    hmm() {   // a guard notices something: two notes asking a question, in the chord of the moment
      const t = T0(), ch = curCh, top = mtof(ch[2] + 24);
      duckPulse(t);
      noise(sfx, t, { f: 2500, q: 1, v: 0.06, a: 0.02, dur: 0.03, rel: 0.2 });
      voice(sfx, t, mtof(ch[1] + 24), { type: 'triangle', v: 0.18, dur: 0.08, rel: 0.1 });
      voice(sfx, t + 0.13, top, { type: 'triangle', v: 0.18, dur: 0.1, rel: 0.25, glide: top * 1.03 });
    },
    spotted() {   // "!": a stab of brass, a snap and a hit, on the beat
      const t = onGrid();
      duckPulse(t);
      for (const m of [62, 63, 69, 74].map(m => m + key)) voice(sfx, t, mtof(m), { type: 'sawtooth', lp: 5000, lpTo: 700, lpT: 0.5, q: 2, v: 0.15, dur: 0.18, rel: 0.5 });
      kick(sfx, t, 0.45);
      noise(sfx, t, { f: 2500, q: 0.6, v: 0.25, dur: 0.02, rel: 0.25, fTo: 400 });
      noise(sfx, t, { ftype: 'highpass', f: 4000, q: 0.7, v: 0.3, dur: 0.01, rel: 0.12 });
    },
    lost() {   // gave up: the question again, falling back into the chord
      const t = T0(), ch = curCh;
      duckPulse(t);
      noise(sfx, t, { f: 2500, q: 1, v: 0.06, a: 0.02, dur: 0.03, rel: 0.2, fTo: 1200 });
      voice(sfx, t, mtof(ch[2] + 24), { type: 'triangle', v: 0.18, dur: 0.1, rel: 0.1 });
      voice(sfx, t + 0.16, mtof(ch[0] + 24), { type: 'triangle', v: 0.18, dur: 0.15, rel: 0.4 });
    },
    alarm() {   // a camera's "!": the same stab as a guard's, then the camera's own beeps on top
      SFX.spotted();
      const t = T0() + 0.25;
      for (let i = 0; i < 3; i++) voice(sfx, t + i * 0.18, 880, { type: 'square', lp: 3200, v: 0.14, dur: 0.08, rel: 0.05, glide: 660 });
    },
    star() { const t = T0(); [81, 86, 88, 93].forEach((m, i) => voice(sfx, t + i * 0.06, mtof(m), { type: 'sine', v: 0.12, dur: 0.02, rel: 0.9 })); },
    key() { const t = T0(); [69, 73, 76, 81].forEach((m, i) => voice(sfx, t + i * 0.05, mtof(m), { type: 'triangle', v: 0.12, dur: 0.03, rel: 0.5 })); noise(sfx, t, { f: 6000, q: 3, v: 0.06, dur: 0.01, rel: 0.2 }); },
    door() { const t = T0(); voice(sfx, t, 140, { type: 'square', lp: 600, v: 0.15, dur: 0.05, rel: 0.2, glide: 90 }); noise(sfx, t + 0.05, { f: 500, q: 0.8, v: 0.2, dur: 0.25, rel: 0.2, fTo: 1600 }); voice(sfx, t + 0.3, mtof(62), { type: 'triangle', v: 0.1, dur: 0.05, rel: 0.6 }); },
    caught() {
      const t = T0();
      cut(1.6);
      kick(sfx, t, 0.45);
      for (const m of [38, 39, 45].map(m => m + key)) voice(sfx, t, mtof(m), { type: 'sawtooth', lp: 1200, lpTo: 100, lpT: 1.4, v: 0.18, dur: 0.6, rel: 0.9, glide: mtof(m - 7), glideT: 1.4 });
      noise(sfx, t, { f: 1200, q: 0.5, v: 0.3, dur: 0.1, rel: 0.8, fTo: 120 });
    },
    clear() {
      const t = T0();
      cut(2.2);
      [62, 65, 69, 74, 77, 81].forEach((m, i) => voice(sfx, t + i * 0.07, mtof(m + key), { type: 'triangle', v: 0.1, dur: 0.1, rel: 1.4 }));
      for (const m of [62, 69, 74, 78]) voice(sfx, t + 0.42, mtof(m + key), { type: 'sawtooth', lp: 1800, v: 0.03, a: 0.3, dur: 0.6, rel: 1.6 });
    },
    floor() { const t = T0(), k = floorKey(); voice(sfx, t, mtof(50 + k), { type: 'sine', v: 0.2, dur: 0.1, rel: 1.6 }); voice(sfx, t + 0.18, mtof(57 + k), { type: 'sine', v: 0.12, dur: 0.1, rel: 1.6 }); noise(sfx, t, { f: 300, q: 0.7, v: 0.12, a: 0.4, dur: 0.3, rel: 1, fTo: 1500 }); },
    tap() { const t = T0(); voice(sfx, t, mtof(79), { type: 'sine', v: 0.08, dur: 0.01, rel: 0.12 }); },
    hide() {   // a cloth rustle and a soft low thump as you settle into the dark
      const t = T0();
      noise(sfx, t, { f: 900, q: 0.8, v: 0.3, a: 0.03, dur: 0.05, rel: 0.25, fTo: 250 });
      voice(sfx, t + 0.04, 110, { type: 'triangle', glide: 60, glideT: 0.12, v: 0.22, dur: 0.02, rel: 0.18 });
    },
  };

  window.AUDIO = {
    init,
    unlock() { init(); if (ctx && ctx.state !== 'running') ctx.resume(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    set tension(v) { tension = v; },
    get tension() { return smoothT; },
    // 0..1, the strongest guard's suspicion; it sets the heartbeat's rate (read from GAME if not set)
    set heat(v) { heat = Math.max(0, Math.min(1, v)); heatAt = ctx ? ctx.currentTime : 0; },
    get heat() { return ctx ? curHeat(ctx.currentTime) : heat; },
    cut(dur) { cut(dur); },
    duck(on) { ducked = !!on; },   // the pause menu is also noticed on its own
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05); },
    get musicOn() { return musicOn; },
    setMusic(on) { musicOn = on; if (music) music.gain.setTargetAtTime(on ? 0.62 : 0, ctx.currentTime, 0.1); },
    play(name, a) { if (!ctx || ctx.state !== 'running' || muted) return; const f = SFX[name]; if (f) f(a); },
  };
})();
