// The score and the sounds, all synthesised. The score is one 8-bar loop in D minor that grows with
// the danger: a drone and pad while you're unseen, a plucked pulse when a guard is near, a heartbeat
// and trembling strings while one is suspicious, drums and a driving bass in a chase. AUDIO.tension
// (0..1) is set by the game every frame; the layers fade in and out on their own.
(function () {
  'use strict';
  let ctx = null, master, music, sfx, verbIn, noiseBuf, layers = {}, timer = null;
  let muted = false, musicOn = true, tension = 0, smoothT = 0;
  const BPM = 84, S16 = 60 / BPM / 4;
  let step = 0, nextT = 0;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // D minor: Dm  Bb  Gm  A — two bars each
  const CHORDS = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
  const ROOTS = [38, 34, 31, 33];

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
    master.connect(comp); comp.connect(ctx.destination);
    // a long dark room for everything to ring in
    const verb = ctx.createConvolver(); verb.buffer = impulse(3.2, 2.6);
    verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
    const verbLP = ctx.createBiquadFilter(); verbLP.type = 'lowpass'; verbLP.frequency.value = 3800;
    verbIn.connect(verbLP); verbLP.connect(verb); verb.connect(master);
    music = ctx.createGain(); music.gain.value = musicOn ? 0.62 : 0; music.connect(master);
    const mSend = ctx.createGain(); mSend.gain.value = 0.55; music.connect(mSend); mSend.connect(verbIn);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    const sSend = ctx.createGain(); sSend.gain.value = 0.3; sfx.connect(sSend); sSend.connect(verbIn);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const k of ['drone', 'pad', 'pulse', 'beat', 'chase']) { const g = ctx.createGain(); g.gain.value = 0; g.connect(music); layers[k] = g; }
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
  let droneLP;
  function drone() {
    droneLP = ctx.createBiquadFilter(); droneLP.type = 'lowpass'; droneLP.frequency.value = 220; droneLP.Q.value = 4;
    droneLP.connect(layers.drone);
    for (const [f, type, v] of [[mtof(26), 'sine', 0.5], [mtof(38), 'sawtooth', 0.12], [mtof(38) * 1.004, 'sawtooth', 0.12], [mtof(45), 'triangle', 0.05]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = v;
      o.connect(g); g.connect(droneLP); o.start();
    }
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 90;
    lfo.connect(lg); lg.connect(droneLP.frequency); lfo.start();
    layers.drone.gain.setTargetAtTime(0.55, ctx.currentTime, 2);
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
  function tom(dest, t, f, v) {
    voice(dest, t, f, { type: 'sine', glide: f * 0.55, glideT: 0.3, v, dur: 0.04, rel: 0.4 });
    noise(dest, t, { f: f * 3, q: 1.4, v: v * 0.25, dur: 0.01, rel: 0.12, ftype: 'bandpass' });
  }

  // ── the sequencer ──────────────────────────────────────────
  function schedule() {
    if (!ctx || ctx.state !== 'running') { if (ctx) nextT = ctx.currentTime + 0.1; return; }
    // layer levels follow the tension
    smoothT += (tension - smoothT) * (tension > smoothT ? 0.12 : 0.012);
    const t = smoothT, now = ctx.currentTime;
    const lv = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    layers.pulse.gain.setTargetAtTime(lv(t, 0.12, 0.35) * 0.9, now, 0.4);
    layers.beat.gain.setTargetAtTime(lv(t, 0.4, 0.6) * 0.95, now, 0.25);
    layers.chase.gain.setTargetAtTime(lv(t, 0.78, 0.92), now, 0.15);
    if (droneLP) droneLP.Q.setTargetAtTime(4 + t * 8, now, 0.5);
    while (nextT < now + 0.12) { play(step, nextT); step = (step + 1) % 128; nextT += S16; }
  }
  function play(s, t) {
    const bar = Math.floor(s / 16), pos = s % 16, ci = Math.floor(bar / 2) % 4, ch = CHORDS[ci], root = ROOTS[ci];
    const T = smoothT;
    // pad: a new chord every two bars, slow in and out
    if (pos === 0 && bar % 2 === 0) {
      for (const m of ch) for (const det of [-7, 7]) voice(layers.pad, t, mtof(m), { type: 'sawtooth', detune: det, lp: 500 + T * 900, q: 0.7, a: 1.6, v: 0.022, dur: S16 * 32 - 1.6, rel: 1.8 });
      voice(layers.pad, t, mtof(ch[0] + 12), { type: 'sine', a: 2, v: 0.025, dur: S16 * 28, rel: 2 });
    }
    // a lone high note now and then, so the calm never quite settles
    if (pos === 8 && bar % 4 === 1) voice(layers.pad, t, mtof(ch[2] + 24), { type: 'sine', a: 0.02, v: 0.035, dur: 0.05, rel: 2.2 });
    if (layers.pulse.gain.value > 0.01 || T > 0.1) {
      // pulse: plucked eighths on the root and fifth, a clock tick under it
      if (pos % 2 === 0) {
        const pat = [0, 0, 7, 0, 12, 0, 7, 10], m = root + 12 + pat[pos / 2];
        voice(layers.pulse, t, mtof(m), { type: 'square', lp: 1400 + T * 1600, lpTo: 220, lpT: 0.14, q: 3, v: pos % 8 === 0 ? 0.11 : 0.075, dur: 0.02, rel: 0.16 });
      }
      noise(layers.pulse, t, { f: 7000, q: 2, v: pos % 4 === 2 ? 0.05 : 0.018, dur: 0.004, rel: 0.03, ftype: 'highpass' });
    }
    if (T > 0.35) {
      // heartbeat: lub-dub on each half bar, and a string that trembles on the chord's third
      if (pos === 0 || pos === 8) kick(layers.beat, t, 0.55);
      if (pos === 2 || pos === 10) kick(layers.beat, t, 0.32);
      if (pos === 0 && bar % 2 === 0) {
        const o = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(ch[1] + 12); lp.type = 'lowpass'; lp.frequency.value = 2200;
        trem.frequency.value = 7.5; tg.gain.value = 0.025; trem.connect(tg); tg.connect(g.gain);
        o.connect(lp); lp.connect(g); g.connect(layers.beat);
        env(g, t, 0.8, 0.035, S16 * 32 - 0.8, 0.6);
        o.start(t); trem.start(t); o.stop(t + S16 * 32 + 0.8); trem.stop(t + S16 * 32 + 0.8);
      }
    }
    if (T > 0.7) {
      // chase: sixteenth bass, toms, a snare on the backbeat
      const bp = [0, 0, 12, 0, 0, 7, 0, 10, 0, 0, 12, 0, 13, 12, 7, 5];
      voice(layers.chase, t, mtof(root + bp[pos]), { type: 'sawtooth', lp: 900, lpTo: 180, lpT: 0.1, q: 5, v: pos % 4 === 0 ? 0.16 : 0.1, dur: 0.03, rel: 0.08 });
      if (pos === 0 || pos === 6 || pos === 10) tom(layers.chase, t, pos === 0 ? 90 : 120, 0.45);
      if (pos === 4 || pos === 12) { noise(layers.chase, t, { f: 1800, q: 0.8, v: 0.28, dur: 0.02, rel: 0.14 }); voice(layers.chase, t, 190, { type: 'triangle', glide: 120, v: 0.12, dur: 0.02, rel: 0.08 }); }
      if (pos === 14 && bar % 2 === 1) tom(layers.chase, t, 160, 0.35);
    }
  }

  // ── sound effects ──────────────────────────────────────────
  const T0 = () => ctx.currentTime + 0.005;
  const SFX = {
    step(run) { const t = T0(); noise(sfx, t, { f: run ? 1400 : 900, q: 1.2, v: run ? 0.07 : 0.025, dur: 0.008, rel: 0.05 }); if (run) voice(sfx, t, 70, { type: 'sine', glide: 50, v: 0.1, dur: 0.01, rel: 0.06 }); },
    hmm() {   // a guard notices something: two notes asking a question
      const t = T0();
      voice(sfx, t, mtof(74), { type: 'triangle', v: 0.12, dur: 0.08, rel: 0.1 });
      voice(sfx, t + 0.13, mtof(77), { type: 'triangle', v: 0.12, dur: 0.1, rel: 0.25, glide: mtof(78) });
    },
    spotted() {   // "!": a stab of brass and a hit
      const t = T0();
      for (const m of [62, 63, 69, 74]) voice(sfx, t, mtof(m), { type: 'sawtooth', lp: 3000, lpTo: 600, lpT: 0.5, q: 2, v: 0.08, dur: 0.18, rel: 0.5 });
      kick(sfx, t, 0.8);
      noise(sfx, t, { f: 2500, q: 0.6, v: 0.25, dur: 0.02, rel: 0.25, fTo: 400 });
    },
    lost() {   // gave up: the question again, falling
      const t = T0();
      voice(sfx, t, mtof(72), { type: 'triangle', v: 0.08, dur: 0.1, rel: 0.1 });
      voice(sfx, t + 0.16, mtof(67), { type: 'triangle', v: 0.08, dur: 0.15, rel: 0.4 });
    },
    alarm() { const t = T0(); for (let i = 0; i < 3; i++) voice(sfx, t + i * 0.18, 880, { type: 'square', lp: 2400, v: 0.06, dur: 0.08, rel: 0.05, glide: 660 }); },
    star() { const t = T0(); [81, 86, 88, 93].forEach((m, i) => voice(sfx, t + i * 0.06, mtof(m), { type: 'sine', v: 0.12, dur: 0.02, rel: 0.9 })); },
    key() { const t = T0(); [69, 73, 76, 81].forEach((m, i) => voice(sfx, t + i * 0.05, mtof(m), { type: 'triangle', v: 0.12, dur: 0.03, rel: 0.5 })); noise(sfx, t, { f: 6000, q: 3, v: 0.06, dur: 0.01, rel: 0.2 }); },
    door() { const t = T0(); voice(sfx, t, 140, { type: 'square', lp: 600, v: 0.15, dur: 0.05, rel: 0.2, glide: 90 }); noise(sfx, t + 0.05, { f: 500, q: 0.8, v: 0.2, dur: 0.25, rel: 0.2, fTo: 1600 }); voice(sfx, t + 0.3, mtof(62), { type: 'triangle', v: 0.1, dur: 0.05, rel: 0.6 }); },
    caught() {
      const t = T0();
      kick(sfx, t, 1);
      for (const m of [38, 39, 45]) voice(sfx, t, mtof(m), { type: 'sawtooth', lp: 1200, lpTo: 100, lpT: 1.4, v: 0.18, dur: 0.6, rel: 0.9, glide: mtof(m - 7), glideT: 1.4 });
      noise(sfx, t, { f: 1200, q: 0.5, v: 0.3, dur: 0.1, rel: 0.8, fTo: 120 });
    },
    clear() {
      const t = T0();
      [62, 65, 69, 74, 77, 81].forEach((m, i) => voice(sfx, t + i * 0.07, mtof(m), { type: 'triangle', v: 0.1, dur: 0.1, rel: 1.4 }));
      for (const m of [62, 69, 74, 78]) voice(sfx, t + 0.42, mtof(m), { type: 'sawtooth', lp: 1800, v: 0.03, a: 0.3, dur: 0.6, rel: 1.6 });
    },
    floor() { const t = T0(); voice(sfx, t, mtof(50), { type: 'sine', v: 0.2, dur: 0.1, rel: 1.6 }); voice(sfx, t + 0.18, mtof(57), { type: 'sine', v: 0.12, dur: 0.1, rel: 1.6 }); noise(sfx, t, { f: 300, q: 0.7, v: 0.12, a: 0.4, dur: 0.3, rel: 1, fTo: 1500 }); },
    tap() { const t = T0(); voice(sfx, t, mtof(79), { type: 'sine', v: 0.08, dur: 0.01, rel: 0.12 }); },
    hide() { const t = T0(); noise(sfx, t, { f: 600, q: 0.8, v: 0.08, a: 0.04, dur: 0.05, rel: 0.25, fTo: 200 }); },
  };

  window.AUDIO = {
    init,
    unlock() { init(); if (ctx && ctx.state !== 'running') ctx.resume(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    set tension(v) { tension = v; },
    get tension() { return smoothT; },
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05); },
    get musicOn() { return musicOn; },
    setMusic(on) { musicOn = on; if (music) music.gain.setTargetAtTime(on ? 0.62 : 0, ctx.currentTime, 0.1); },
    play(name, a) { if (!ctx || ctx.state !== 'running' || muted) return; const f = SFX[name]; if (f) f(a); },
  };
})();
