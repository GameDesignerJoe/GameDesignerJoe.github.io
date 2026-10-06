// The score and the sounds, all synthesised. The score is an 8-bar loop in D minor, with a B phrase
// every other time round, a new pulse figure each pass and a new key on each floor, that grows with
// the danger: a drone and pad while you're unseen, a plucked pulse when a guard is near, a heartbeat
// and trembling strings while one is suspicious, drums and a driving bass in a chase. AUDIO.tension
// (0..1) is set by the game every frame (in play the score refines it with its own line-of-sight read); the layers fade in and out on their own. The mix is voiced
// for a phone speaker: the sub is trimmed and every layer carries its weight above 300 Hz, so the
// climb from calm to chase is something you hear on the device, not just feel on headphones.
(function () {
  'use strict';
  let ctx = null, master, music, cutG, duckG, duckLP, pulseDuck, sfx, verbIn, noiseBuf, layers = {}, timer = null;
  let muted = false, musicOn = true, tension = 0, smoothT = 0, goalT = 0, chaseLive = false, beatDuck = 1, heat = 0, heatAt = -9, ducked = false, cutUntil = 0;
  const BPM = 84, S16 = 60 / BPM / 4, MUSIC_V = 0.8, MAKEUP = 1.5, COMP_T = -14, OUT_TRIM = 0.79;
  let padVoices = [], padFloor = 1, step = 0, cycle = 0, nextT = 0, stepDur = S16, curCh = [50, 53, 57], key = 0, lastStep = 0, stepSkip = false;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // D minor, two bars a chord. Four phrases, taken in turn (and each floor starts on a different one):
  // Dm Bb Gm A, Dm Gm Eb A, Dm F C A, and Dm Bb C Dm over a D pedal
  const PHRASES = [
    { chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], roots: [38, 34, 31, 33] },
    { chords: [[50, 53, 57], [43, 46, 50], [51, 55, 58], [45, 49, 52]], roots: [38, 31, 39, 33] },
    { chords: [[50, 53, 57], [48, 53, 57], [48, 52, 55], [45, 49, 52]], roots: [38, 41, 36, 33] },
    { chords: [[50, 53, 57], [50, 53, 58], [48, 52, 55], [50, 53, 57]], roots: [38, 38, 38, 38] },
  ];
  // the plucked pulse changes its figure each pass, so a long floor never hears the same loop twice running
  // (THIRD stands for the chord's own third, so the figure never plays minor over a major chord)
  const THIRD = 99, PULSES = [[0, 0, 7, 0, 12, 0, 7, 10], [0, 7, 0, 12, 0, 10, 7, 0], [0, 0, 12, 7, 0, THIRD, 7, 10]];
  // each floor sits in its own key: floor 1 in F minor, then C, G and D minor (KEYS[floor % 4])
  const KEYS = [0, 3, -2, 5];
  const floorNo = () => { const G = window.GAME; let f = 1; try { f = (G && G.floor) || 1; } catch (e) {} return f; };
  const floorKey = () => { const G = window.GAME; let f = 1; try { f = (G && G.floor) || 1; } catch (e) {} return KEYS[f % 4]; };

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    // a gentle compressor with makeup after it: it holds the loud end together but sits above the calm bed,
    // so the climb from calm to chase keeps its size (about 7-8 dB at the output) rather than being squashed flat
    comp.threshold.value = COMP_T; comp.ratio.value = 2; comp.attack.value = 0.004; comp.release.value = 0.2;
    // a phone speaker can't play the sub, so don't spend the headroom on it
    const shelf = ctx.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 90; shelf.gain.value = -6;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 35; hp.Q.value = 0.7;
    // and a brickwall after the compressor so the big hits never clip
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(shelf); shelf.connect(hp); hp.connect(comp);
    // and past that a soft clip, clean up to -2 dB (the chase peaks sit at about -2.5), for the odd transient the limiter is too slow for
    const clip = ctx.createWaveShaper(); clip.curve = softClip(); clip.oversample = '2x';
    // (the limiter adds its own makeup gain, so trim back under it to leave the clip real headroom)
    const trim = ctx.createGain(); trim.gain.value = OUT_TRIM;
    lim.connect(trim); trim.connect(clip); clip.connect(ctx.destination);
    // a long dark room for everything to ring in
    const verb = ctx.createConvolver(); verb.buffer = impulse(3.2, 2.6);
    verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
    const verbLP = ctx.createBiquadFilter(); verbLP.type = 'lowpass'; verbLP.frequency.value = 3800;
    verbIn.connect(verbLP); verbLP.connect(verb); verb.connect(master);
    // music bus: the on/off switch, a cut for caught and clear, a muffled duck for the pause menu
    music = ctx.createGain(); music.gain.value = musicOn ? MUSIC_V : 0;
    cutG = ctx.createGain(); duckG = ctx.createGain();
    duckLP = ctx.createBiquadFilter(); duckLP.type = 'lowpass'; duckLP.frequency.value = 20000; duckLP.Q.value = 0.5;
    music.connect(cutG); cutG.connect(duckG); duckG.connect(duckLP); duckLP.connect(master);
    const mSend = ctx.createGain(); mSend.gain.value = 0.55; duckLP.connect(mSend); mSend.connect(verbIn);
    sfx = ctx.createGain(); sfx.gain.value = muted ? 0 : 0.9; sfx.connect(master);
    const sSend = ctx.createGain(); sSend.gain.value = 0.3; sfx.connect(sSend); sSend.connect(verbIn);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const k of ['drone', 'pad', 'pulse', 'beat', 'chase']) { const g = ctx.createGain(); g.gain.value = 0; g.connect(music); layers[k] = g; }
    // the pulse steps back for a moment under every stinger
    pulseDuck = ctx.createGain(); layers.pulse.disconnect(); layers.pulse.connect(pulseDuck); pulseDuck.connect(music);
    // the chase drums keep their punch but leave the sub out: on a phone it only fed the limiter
    const chaseHP = ctx.createBiquadFilter(); chaseHP.type = 'highpass'; chaseHP.frequency.value = 180; chaseHP.Q.value = 0.6;
    layers.chase.disconnect(); layers.chase.connect(chaseHP); chaseHP.connect(music);
    layers.pad.gain.value = 0.7;
    const makeup = ctx.createGain(); makeup.gain.value = MAKEUP; comp.connect(makeup); makeup.connect(lim);
    drone();
    nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }
  function softClip() {
    const n = 2048, c = new Float32Array(n), k = 0.8;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); c[i] = Math.sign(x) * (a <= k ? a : k + (1 - k) * Math.tanh((a - k) / (1 - k))); }
    return c;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }

  // the drone never stops: a low D with a slow breathing filter
  // (open enough, with a D3 on top, that the calm still reaches a phone speaker)
  let droneLP, droneOsc = [];
  const DRONE_V = 0.2;   // quiet, so there's somewhere for the danger to climb to
  function drone() {
    droneLP = ctx.createBiquadFilter(); droneLP.type = 'lowpass'; droneLP.frequency.value = 650; droneLP.Q.value = 4;
    droneLP.connect(layers.drone);
    for (const [m, mul, type, v] of [[38, 1, 'sawtooth', 0.18], [38, 1.004, 'sawtooth', 0.18], [45, 1, 'triangle', 0.05], [50, 1, 'sawtooth', 0.04]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = mtof(m + key) * mul; g.gain.value = v;
      o.connect(g); g.connect(droneLP); o.start(); droneOsc.push([o, m, mul]);
    }
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 220;
    lfo.connect(lg); lg.connect(droneLP.frequency); lfo.start();
    // and a breath of air over it, high enough for a phone to play, so the calm has texture and isn't silence
    const air = ctx.createBufferSource(), abp = ctx.createBiquadFilter(), ag = ctx.createGain(), alfo = ctx.createOscillator(), alg = ctx.createGain();
    air.buffer = noiseBuf; air.loop = true; abp.type = 'bandpass'; abp.frequency.value = 2500; abp.Q.value = 0.5;
    ag.gain.value = 0.014; alfo.frequency.value = 0.1; alg.gain.value = 0.008;
    alfo.connect(alg); alg.connect(ag.gain); air.connect(abp); abp.connect(ag); ag.connect(layers.drone);
    air.start(); alfo.start();
    layers.drone.gain.setTargetAtTime(DRONE_V, ctx.currentTime, 2);
  }
  // a new floor, a new key: the drone slides there and the score follows from the next bar
  function setKey(k, t) {
    if (k === key) return false;
    key = k;
    for (const [o, m, mul] of droneOsc) o.frequency.setTargetAtTime(mtof(m + key) * mul, t, 0.6);
    return true;
  }
  // let the ringing pad go (about 0.6 s) so a new chord can start under it at once
  function fadePad(t) {
    for (const g of padVoices) { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.2); } catch (e) {} }
    padVoices = [];
  }

  // ── instruments ────────────────────────────────────────────
  function env(g, t, a, peak, dur, rel) {
    g.gain.value = 0;   // a new gain sits at 1 until t: hold it silent so a voice never starts with a one-sample spike
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
    return g;
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
  // the heartbeat: a faint low body, a woody thud (and its octave) that climbs with suspicion, a click and a knock,
  // so the beat lives where a phone speaker plays rather than in a sub it can't
  function heart(dest, t, v, h) {
    const f = 300 + 140 * (h || 0);
    voice(dest, t, 70, { type: 'sine', glide: 45, glideT: 0.12, v: 0.05 * v, dur: 0.04, rel: 0.2 });
    voice(dest, t, f, { type: 'triangle', glide: f * 0.64, glideT: 0.08, v: 0.36 * v, dur: 0.03, rel: 0.18 });
    voice(dest, t, f * 2, { type: 'triangle', glide: f * 1.3, glideT: 0.07, v: 0.12 * v, dur: 0.02, rel: 0.12 });
    voice(dest, t, 520, { type: 'triangle', glide: 360, glideT: 0.05, v: 0.3 * v, dur: 0.015, rel: 0.08 });
    noise(dest, t, { ftype: 'lowpass', f: 450, q: 0.7, v: 0.12 * v, dur: 0.01, rel: 0.1 });
    noise(dest, t, { f: 1800, q: 1.2, v: 0.22 * v, dur: 0.004, rel: 0.05 });
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
    // a locked door knocks again only once the player has stepped away from it
    if (lockedAt) { const P = playerAt(); if (!P || !inPlay() || Math.hypot(P.x - lockedAt.x, P.y - lockedAt.y) > 40) lockedAt = null; }
    // layer levels follow the tension (and sit at calm while paused or just after a cut)
    const goal = goalT = pz || now < cutUntil ? 0.05 : danger(tension);
    smoothT += (goal - smoothT) * (goal > smoothT ? 0.12 : pz ? 0.08 : 0.012);
    const t = smoothT;
    const lv = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    // the drone backs well off as danger nears, so the brighter pulse comes up out of it rather than under it
    // (and the pulse gives way in turn to the chase's bass line)
    layers.drone.gain.setTargetAtTime(DRONE_V * (1 - 0.625 * lv(t, 0.12, 0.4)), now, 0.6);
    // (and steps back about 6 dB once a guard suspects you, so the heartbeat leads)
    layers.pulse.gain.setTargetAtTime(lv(t, 0.12, 0.35) * 1.4 * (1 - 0.45 * lv(t, 0.78, 0.92)) * (1 - 0.5 * lv(t, 0.45, 0.6)), now, 0.4);
    // the heartbeat takes the lead from the first doubt and swells with the meter, then steps back in a
    // chase (about 14 dB) so the drums carry the pulse
    const h = curHeat(now);
    beatDuck = 1 - 0.8 * lv(t, 0.78, 0.92);
    layers.beat.gain.setTargetAtTime(lv(t, 0.42, 0.52) * 0.85 * (0.72 + 0.3 * h) * beatDuck, now, 0.25);
    // once the chase has landed on its downbeat it follows the game's tension, not the smoothed one
    layers.chase.gain.setTargetAtTime(lv(chaseLive ? Math.max(t, goal) : t, 0.78, 0.92) * 2.3, now, 0.15);
    // the pad sits low in the calm and opens as a guard comes near; its low chord gives the chase room
    // (on a phone it only fed the compressor)
    layers.pad.gain.setTargetAtTime((0.7 + 0.2 * lv(t, 0.12, 0.4)) * (1 - 0.5 * lv(t, 0.78, 0.92)), now, 0.3);
    if (droneLP) droneLP.Q.setTargetAtTime(4 + t * 8, now, 0.5);
    // a chase (or a camera's alarm) pushes the tempo from 84 toward 100
    stepDur = S16 * BPM / (BPM + 16 * lv(t, 0.8, 0.95));
    while (nextT < now + 0.12) { play(step, nextT); step = (step + 1) % 128; if (!step) cycle++; nextT += stepDur; }
  }
  // what the score follows. The game sets AUDIO.tension, but in play the score reads the danger itself, so
  // that "near a guard" means one who could see you: a clear line to you, within 1.6 cone lengths if you're
  // in front of him (so an approaching guard swells the pulse before his cone lands), within two thirds of one if not. Through a
  // wall (or from a hiding place) he barely registers, so most of a floor stays calm, and the first rung of
  // the ladder, calm to near, is a real step. A suspicious guard tops out under the chase (0.76), so drums
  // and the faster tempo wait for an actual chase.
  function danger(v) {
    const G = window.GAME;
    try {
      if (!G || G.mode !== 'play') return v;
      const P = G.P, L = G.L, f = L && L.field, D = L && L.D;
      if (!P || !P.alive || !f || !f.ray || !D || !D.coneLen) return v;
      const R = D.coneLen * 1.6, P_R = 8.5, BACK = 0.4;
      let t = 0.05;
      for (const gd of G.guards || []) {
        if (gd.state === 'chase') t = Math.max(t, 1);
        else if (gd.state === 'sus') t = Math.max(t, 0.5 + (gd.aw || 0) * 0.26);
        else if (gd.state === 'search') t = Math.max(t, 0.48);
        const dx = P.x - gd.x, dy = P.y - gd.y, d = Math.hypot(dx, dy);
        if (d >= R) continue;
        const los = d > 1 && !P.hidden && f.ray(gd.x, gd.y, dx / d, dy / d, d) >= d - P_R;
        let da = Math.abs(Math.atan2(dy, dx) - (gd.ang || 0)) % (2 * Math.PI); if (da > Math.PI) da = 2 * Math.PI - da;
        const ahead = da < (D.fov || 0.6) + 0.4;
        // (off to his side or at his back he has to turn first, so the near rung starts only within about two thirds of a cone length)
        if (los && ahead) t = Math.max(t, Math.min(0.4, 0.22 + 0.26 * (1 - d / R)));
        else if (los && d < R * BACK) t = Math.max(t, 0.14 + 0.2 * (1 - d / (R * BACK)));
        else t = Math.max(t, 0.05 + 0.09 * (1 - d / R));
      }
      for (const c of G.cams || []) { if (c.alarm > 0) t = Math.max(t, 0.85); else if (c.aw > 0) t = Math.max(t, 0.5); }
      return t;
    } catch (e) { return v; }
  }
  // how suspicious is the strongest guard? The game can say (AUDIO.heat); otherwise we look
  // a guard who is hunting you keeps the heart going (at least 0.35) even as his meter drains
  function curHeat(now) {
    const G = window.GAME, fresh = now - heatAt < 0.5; let h = fresh ? heat : 0;
    try {
      if (G && G.mode === 'play') {
        for (const gd of G.guards || []) h = Math.max(h, gd.state === 'search' ? Math.max(0.35, fresh ? 0 : gd.aw || 0) : fresh ? 0 : gd.state === 'chase' ? 1 : gd.state === 'patrol' ? 0 : gd.aw || 0);
        if (!fresh) for (const c of G.cams || []) h = Math.max(h, c.alarm > 0 ? 1 : c.aw || 0);
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
  // (the "?" asks for more: it lands in the pulse's own range, so the pulse drops further and for longer)
  function duckPulse(t, to, hold) {
    pulseDuck.gain.cancelScheduledValues(t); pulseDuck.gain.setTargetAtTime(to || 0.5, t, 0.015);
    pulseDuck.gain.setTargetAtTime(1, t + (hold || 0.4), 0.12);
  }
  function play(s, t) {
    const bar = Math.floor(s / 16), pos = s % 16;
    // a key change mid-chord fades the old pad out and starts the new one on this bar, so two keys never ring together
    // (a new floor also starts on a new phrase, even in the same key)
    let newKey = false;
    if (pos === 0) { const f = floorNo(); newKey = setKey(floorKey(), t) || f !== padFloor; padFloor = f; if (newKey) fadePad(t); }
    const ph = PHRASES[(cycle + floorNo()) % PHRASES.length], ci = Math.floor(bar / 2) % 4, ch = ph.chords[ci].map(m => m + key), root = ph.roots[ci] + key;
    curCh = ch;
    const T = smoothT;
    // pad: a new chord every two bars, slow in and out
    if (pos === 0 && (bar % 2 === 0 || newKey)) {
      const n = bar % 2 === 0 ? 32 : 16, a = bar % 2 === 0 ? 1.6 : 0.5;
      padVoices = [];
      for (const m of ch) for (const det of [-7, 7]) padVoices.push(voice(layers.pad, t, mtof(m), { type: 'sawtooth', detune: det, lp: 900 + T * 1400, q: 0.7, a, v: 0.045, dur: S16 * n - a, rel: 1.8 }));
      padVoices.push(voice(layers.pad, t, mtof(ch[0] + 12), { type: 'sine', a, v: 0.05, dur: S16 * (n - 4), rel: 2 }));
    }
    // a lone high note now and then, so the calm never quite settles (the fifth one pass, the third the next)
    if (pos === 8 && bar % 2 === 1) voice(layers.pad, t, mtof((cycle % 2 ? ch[1] : ch[2]) + 24), { type: 'sine', a: 0.02, v: 0.06, dur: 0.05, rel: 2.2 });
    if (layers.pulse.gain.value > 0.01 || T > 0.1) {
      // pulse: plucked eighths on the root and fifth, a clock tick under it
      if (pos % 2 === 0) {
        const pat = PULSES[cycle % 3], st = pat[pos / 2], m = root + 24 + (st === THIRD ? ((ch[1] - root) % 12 + 12) % 12 : st);
        voice(layers.pulse, t, mtof(m), { type: 'square', lp: 2600 + T * 3000, lpTo: 450, lpT: 0.14, q: 1.8, v: pos % 8 === 0 ? 0.13 : 0.1, dur: 0.02, rel: 0.16 });
      }
      noise(layers.pulse, t, { f: 7000, q: 2, v: pos % 4 === 2 ? 0.05 : 0.018, dur: 0.004, rel: 0.03, ftype: 'highpass' });
    }
    if (T > 0.35) {
      // the heartbeat rides the score's grid, so it follows the tempo and never drifts against the drums,
      // and fills in as the meter does: a lub-dub on every beat from the first doubt (84 a minute), on the
      // beat and its 'and' past 0.35, an extra beat on the last sixteenth of every second one past 0.6, a bare
      // thud on every eighth from 0.85. Once the chase drums have taken over (the layer ducked under a third)
      // it isn't built at all
      const h = curHeat(t), live = beatDuck > 0.35;
      if (!live) {}
      else if (h < 0.35) { if (pos % 4 === 0) heart(layers.beat, t, 1, h); else if (pos % 4 === 1) heart(layers.beat, t, 0.6, h); }
      else if (h < 0.85) {
        if (pos % 2 === 0) heart(layers.beat, t, pos % 4 === 0 ? 1 : 0.75, h); else if (pos % 4 === 1) heart(layers.beat, t, 0.6, h);
        else if (h >= 0.6 && pos % 8 === 7) heart(layers.beat, t, 0.85, h);
      }
      else if (pos % 2 === 0) heart(layers.beat, t, pos % 4 === 0 ? 1 : 0.7, h);
      // and a string that trembles on the chord's third
      if (live && pos === 0 && bar % 2 === 0) {
        const o = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), tv = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(ch[1] + 24); lp.type = 'lowpass'; lp.frequency.value = 3200;
        // the tremolo rides on its own gain after the envelope, so it never swings through zero
        tv.gain.value = 0.8; trem.frequency.value = 7.5; tg.gain.value = 0.35; trem.connect(tg); tg.connect(tv.gain);
        o.connect(lp); lp.connect(g); g.connect(tv); tv.connect(layers.beat);
        env(g, t, 0.8, 0.12, S16 * 32 - 0.8, 0.6);
        o.start(t); trem.start(t); o.stop(t + S16 * 32 + 0.8); trem.stop(t + S16 * 32 + 0.8);
      }
    }
    // the chase comes in on a beat, at full level, rather than fading up wherever it happens to be
    const chaseT = Math.max(T, goalT);
    if (chaseT <= 0.77) chaseLive = false;   // (a suspicious guard tops out at 0.76: the drums wait for a real chase)
    else if (!chaseLive && pos % 4 === 0) {
      chaseLive = true;
      const g = layers.chase.gain; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0, Math.min(1, (chaseT - 0.78) / 0.14)) * 2.3, t);
    }
    if (chaseLive) {
      // chase: sixteenth bass (an octave up, where a phone plays it), toms, a snare on the backbeat, a tom roll into the top of each pass
      const fill = bar === 7 && pos >= 12;
      const bp = [0, 0, 12, 0, 0, 7, 0, 10, 0, 0, 12, 0, 13, 12, 7, 5];
      voice(layers.chase, t, mtof(root + 24 + bp[pos]), { type: 'sawtooth', lp: 3200, lpTo: 300, lpT: 0.1, q: 5, v: pos % 4 === 0 ? 0.1 : 0.065, dur: 0.03, rel: 0.08 });
      if (pos % 2 === 0) voice(layers.chase, t, mtof(root + 36 + bp[pos]), { type: 'square', lp: 5200, lpTo: 1400, lpT: 0.08, q: 2, v: 0.24, dur: 0.03, rel: 0.08 });
      if (pos === 0 || pos === 6 || pos === 10) tom(layers.chase, t, pos === 0 ? 150 : 190, 0.13);
      // the kick takes the beat over from the heartbeat
      if (pos % 4 === 0) { const v = pos === 0 ? 1 : 0.8;   // a short, high-tuned kick: punch a phone can play, little sub to push the limiter
        voice(layers.chase, t, 160, { type: 'sine', glide: 60, glideT: 0.07, v: 0.14 * v, dur: 0.02, rel: 0.12 });
        noise(layers.chase, t, { f: 2600, q: 1, v: 0.12 * v, dur: 0.003, rel: 0.025 }); }
      if (fill) tom(layers.chase, t, [260, 230, 200, 170][pos - 12], 0.32 + (pos - 12) * 0.02);
      if (pos === 4 || (pos === 12 && !fill)) {   // the snare: a body, and a crack in the band a phone speaker plays loudest
        noise(layers.chase, t, { f: 1800, q: 0.8, v: 0.3, dur: 0.02, rel: 0.18 }); noise(layers.chase, t, { f: 3000, q: 1, v: 0.18, dur: 0.015, rel: 0.12 });
        voice(layers.chase, t, 220, { type: 'triangle', glide: 150, v: 0.16, dur: 0.02, rel: 0.1 }); }
      if (pos === 14 && bar % 2 === 1 && !fill) tom(layers.chase, t, 240, 0.35);
      // driving hats, open on the off-beat, so the chase cuts through a small speaker
      // and a shaker in the 3-4 kHz a phone speaker plays loudest, pushing the sixteenths
      noise(layers.chase, t, { f: 3500, q: 1.2, v: pos % 2 ? 0.07 : 0.11, dur: 0.006, rel: 0.04 });
      noise(layers.chase, t, { ftype: 'highpass', f: 6500, q: 0.8, v: pos % 4 === 2 ? 0.22 : 0.1, dur: 0.004, rel: pos % 4 === 2 ? 0.09 : 0.03 });
    }
  }

  // ── sound effects ──────────────────────────────────────────
  const T0 = () => ctx.currentTime + 0.005;
  const inPlay = () => { try { const G = window.GAME; return !G || !G.mode || G.mode === 'play'; } catch (e) { return true; } };
  const playerAt = () => { try { const P = window.GAME && window.GAME.P; return P && typeof P.x === 'number' ? { x: P.x, y: P.y } : null; } catch (e) { return null; } };
  let spottedAt = -9, lockedAt = null;
  const SFX = {
    // a step follows the stick: a gentle push is a soft, slow pad, nearly a full push a firm walk. The
    // weight is the second argument when it's a number, or GAME.P.m when the game passes run = false
    step(run) {
      const t = T0();
      if (run === true) {   // a run slaps: a scuff, a click and a thud pitched where a phone can play it
        noise(sfx, t, { f: 700, q: 0.9, v: 0.28, dur: 0.008, rel: 0.08 });
        noise(sfx, t, { ftype: 'highpass', f: 3000, q: 0.7, v: 0.12, dur: 0.003, rel: 0.02 });
        voice(sfx, t, 150, { type: 'sine', glide: 90, glideT: 0.05, v: 0.18, dur: 0.01, rel: 0.07 }); return;
      }
      let m = typeof run === 'number' ? run : 0.6;
      if (typeof run !== 'number') try { const P = window.GAME && window.GAME.P; if (P && typeof P.m === 'number') m = P.m; } catch (e) {}
      m = Math.max(0, Math.min(1, m / 0.85));
      // a sneak takes longer strides of silence: below a third of the push, every other step is skipped
      if (m < 0.35 && t - lastStep < 0.7) { stepSkip = !stepSkip; if (stepSkip) return; }
      lastStep = t;
      // past 0.6 it's the loud walk the guards can hear, so the player hears it too; a sneak stays faint
      // (and it stands 4-6 dB clear of the score: the pulse steps aside for it for a moment)
      noise(sfx, t, { f: 800 + 400 * m, q: 1.2, v: m > 0.6 ? 0.1 + 0.22 * m : 0.05 + 0.07 * m, dur: 0.004 + 0.005 * m, rel: 0.03 + 0.025 * m });
      if (m > 0.6) { voice(sfx, t, 140, { type: 'sine', glide: 95, glideT: 0.04, v: 0.16 * m, dur: 0.008, rel: 0.05 }); duckPulse(t, 0.7, 0.12); }
    },
    locked() {   // a locked door: two dull knocks of the handle, each with a click a phone can play
      // (once per contact: leaning on the door doesn't knock again until you've stepped away from it)
      const P = playerAt(); if (P && lockedAt && Math.hypot(P.x - lockedAt.x, P.y - lockedAt.y) < 40) return;
      lockedAt = P;
      const t = T0();
      for (const d of [0, 0.09]) {
        voice(sfx, t + d, 180, { type: 'square', lp: 900, lpTo: 300, lpT: 0.06, v: 0.2, dur: 0.04, rel: 0.12 }); noise(sfx, t + d, { f: 900, q: 1, v: 0.14, dur: 0.005, rel: 0.05 });
        noise(sfx, t + d, { f: 2500, q: 1.5, v: 0.3, dur: 0.005, rel: 0.04 });
      }
    },
    hmm() {   // a guard notices something: two notes asking a question, in the chord of the moment,
      // each with a bell an octave up so the question rings out above the pulse (about 1.6-2.1 kHz)
      // (never on top of a "!" just played, nor once the floor is lost or won)
      if (!inPlay() || ctx.currentTime - spottedAt < 1) return;
      const t = onGrid(), ch = curCh, top = mtof(ch[2] + 24);
      duckPulse(t, 0.3, 0.5);
      // the first thump of the heart lands with the "?" itself, not up to a beat later: the beat layer is
      // only starting its fade up, so this one goes out on the effects bus
      heart(sfx, t, 1.2, 0.3);
      noise(sfx, t, { f: 2500, q: 1, v: 0.06, a: 0.02, dur: 0.03, rel: 0.2 });
      voice(sfx, t, mtof(ch[1] + 24), { type: 'triangle', v: 0.32, dur: 0.08, rel: 0.1 });
      voice(sfx, t, mtof(ch[1] + 36), { type: 'sine', v: 0.14, dur: 0.02, rel: 0.35 });
      voice(sfx, t + 0.13, top, { type: 'triangle', v: 0.32, dur: 0.1, rel: 0.25, glide: top * 1.03 });
      voice(sfx, t + 0.13, mtof(ch[2] + 36), { type: 'sine', v: 0.14, dur: 0.02, rel: 0.35 });
    },
    spotted() {   // "!": a stab of brass, a snap and a hit, on the beat
      const t = onGrid(); spottedAt = ctx.currentTime;
      duckPulse(t);
      for (const m of [62, 63, 69, 74].map(m => m + key)) voice(sfx, t, mtof(m), { type: 'sawtooth', lp: 5000, lpTo: 700, lpT: 0.5, q: 2, v: 0.15, dur: 0.18, rel: 0.5 });
      kick(sfx, t, 0.45);
      noise(sfx, t, { f: 2500, q: 0.6, v: 0.25, dur: 0.02, rel: 0.25, fTo: 400 });
      noise(sfx, t, { ftype: 'highpass', f: 4000, q: 0.7, v: 0.3, dur: 0.01, rel: 0.12 });
      // a snare and a crash with it, so every "!" lands a downbeat even when the chase is over in a moment
      noise(sfx, t, { f: 1800, q: 0.8, v: 0.3, dur: 0.02, rel: 0.16 });
      voice(sfx, t, 190, { type: 'triangle', glide: 120, v: 0.1, dur: 0.02, rel: 0.08 });
      noise(sfx, t, { ftype: 'highpass', f: 5000, q: 0.5, v: 0.16, dur: 0.02, rel: 1.1 });
    },
    lost() {   // gave up: the question again, falling back into the chord (no relief over a defeat, or under a "!")
      if (!inPlay() || ctx.currentTime - spottedAt < 1) return;
      const t = onGrid(), ch = curCh;
      duckPulse(t, 0.3, 0.5);
      noise(sfx, t, { f: 2500, q: 1, v: 0.06, a: 0.02, dur: 0.03, rel: 0.2, fTo: 1200 });
      voice(sfx, t, mtof(ch[2] + 24), { type: 'triangle', v: 0.32, dur: 0.1, rel: 0.1 });
      voice(sfx, t, mtof(ch[2] + 36), { type: 'sine', v: 0.14, dur: 0.02, rel: 0.35 });
      voice(sfx, t + 0.16, mtof(ch[0] + 24), { type: 'triangle', v: 0.32, dur: 0.15, rel: 0.4 });
      voice(sfx, t + 0.16, mtof(ch[0] + 36), { type: 'sine', v: 0.14, dur: 0.02, rel: 0.45 });
    },
    alarm() {   // a camera's "!": the same stab as a guard's, then the camera's own beeps on top
      SFX.spotted();
      // the beeps fall from the chord's fifth to its third, so they sit in the floor's key
      const t = T0() + 0.25, ch = curCh, hi = mtof(ch[2] + 24), lo = mtof(ch[1] + 24);
      for (let i = 0; i < 3; i++) voice(sfx, t + i * 0.18, hi, { type: 'square', lp: 3200, v: 0.14, dur: 0.08, rel: 0.05, glide: lo });
    },
    // the pickups ring in the chord of the moment, so each floor's key carries through them
    star() { const t = onGrid(), ch = curCh; [ch[0] + 36, ch[1] + 36, ch[2] + 36, ch[0] + 48].forEach((m, i) => voice(sfx, t + i * 0.06, mtof(m), { type: 'sine', v: 0.17, dur: 0.02, rel: 0.9 })); },
    key() { const t = onGrid(), ch = curCh; [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[0] + 36].forEach((m, i) => voice(sfx, t + i * 0.05, mtof(m), { type: 'triangle', v: 0.17, dur: 0.03, rel: 0.5 })); noise(sfx, t, { f: 6000, q: 3, v: 0.085, dur: 0.01, rel: 0.2 }); },
    door() {   // the latch clacks above the drone, the door swings, and a small high note says it's open
      const t = T0();
      voice(sfx, t, 220, { type: 'square', lp: 600, v: 0.25, dur: 0.05, rel: 0.2, glide: 140 });
      noise(sfx, t, { f: 3200, q: 4, v: 0.15, dur: 0.004, rel: 0.04 });
      noise(sfx, t + 0.05, { f: 500, q: 0.8, v: 0.2, dur: 0.25, rel: 0.2, fTo: 1600 });
      voice(sfx, t + 0.3, mtof(74 + key), { type: 'triangle', v: 0.16, dur: 0.05, rel: 0.6 });
    },
    caught() {
      const t = T0();
      cut(1.6);
      kick(sfx, t, 0.45);
      for (const m of [38, 39, 45].map(m => m + key)) {
        voice(sfx, t, mtof(m), { type: 'sawtooth', lp: 1200, lpTo: 100, lpT: 1.4, v: 0.18, dur: 0.6, rel: 0.9, glide: mtof(m - 7), glideT: 1.4 });
        // the same cluster three octaves up, sinking with it, so the fall is heard on a phone and not only felt
        voice(sfx, t, mtof(m + 36), { type: 'triangle', v: 0.12, dur: 0.5, rel: 0.8, glide: mtof(m + 29), glideT: 1.2 });
      }
      noise(sfx, t, { f: 1200, q: 0.5, v: 0.3, dur: 0.1, rel: 0.8, fTo: 120 });
      noise(sfx, t, { f: 2600, q: 0.9, v: 0.22, dur: 0.15, rel: 0.9, fTo: 600 });
    },
    clear() {
      const t = T0();
      cut(2.2);
      // a fanfare: the run up, a downbeat, a held chord on a low root, and a shimmer over it, landing at least
      // as hard as being caught
      [62, 65, 69, 74, 77, 81].forEach((m, i) => voice(sfx, t + i * 0.07, mtof(m + key), { type: 'triangle', v: 0.3, dur: 0.1, rel: 1.4 }));
      kick(sfx, t + 0.42, 0.4);
      noise(sfx, t + 0.42, { ftype: 'highpass', f: 5000, q: 0.5, v: 0.16, dur: 0.02, rel: 1.1 });
      for (const m of [62, 69, 74, 78]) voice(sfx, t + 0.42, mtof(m + key), { type: 'sawtooth', lp: 1800, v: 0.06, a: 0.3, dur: 0.6, rel: 1.6 });
      voice(sfx, t + 0.42, mtof(50 + key), { type: 'triangle', v: 0.28, a: 0.02, dur: 0.4, rel: 1.6 });
      noise(sfx, t + 0.42, { ftype: 'highpass', f: 6000, q: 0.7, v: 0.08, a: 0.3, dur: 0.3, rel: 1.5 });
    },
    floor() { const t = T0(), k = floorKey(); voice(sfx, t, mtof(50 + k), { type: 'sine', v: 0.2, dur: 0.1, rel: 1.6 }); voice(sfx, t + 0.18, mtof(57 + k), { type: 'sine', v: 0.12, dur: 0.1, rel: 1.6 });
      voice(sfx, t, mtof(74 + k), { type: 'sine', v: 0.1, dur: 0.1, rel: 1.4 }); voice(sfx, t + 0.18, mtof(81 + k), { type: 'sine', v: 0.1, dur: 0.1, rel: 1.4 }); noise(sfx, t, { f: 300, q: 0.7, v: 0.12, a: 0.4, dur: 0.3, rel: 1, fTo: 1500 }); },
    tap() { const t = T0(); voice(sfx, t, mtof(79), { type: 'sine', v: 0.08, dur: 0.01, rel: 0.12 }); },
    hide() {   // a cloth rustle and a soft low thump as you settle into the dark
      const t = T0();
      noise(sfx, t, { f: 3000, q: 0.8, v: 0.38, a: 0.03, dur: 0.05, rel: 0.25, fTo: 900 });
      voice(sfx, t + 0.04, 220, { type: 'triangle', glide: 140, glideT: 0.12, v: 0.22, dur: 0.02, rel: 0.18 });
    },
  };

  window.AUDIO = {
    init,
    unlock() { init(); if (ctx && ctx.state !== 'running') ctx.resume(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    // tension reads back what the score is following (in play, its own read of the danger; see danger());
    // level is the score's smoothed follow of it
    set tension(v) { tension = v; },
    get tension() { return danger(tension); },
    get level() { return smoothT; },
    // 0..1, the strongest guard's suspicion; it sets the heartbeat's rate (read from GAME if not set)
    set heat(v) { heat = Math.max(0, Math.min(1, v)); heatAt = ctx ? ctx.currentTime : 0; },
    get heat() { return ctx ? curHeat(ctx.currentTime) : heat; },
    cut(dur) { cut(dur); },
    duck(on) { ducked = !!on; },   // the pause menu is also noticed on its own
    get muted() { return muted; },
    // the Sound switch silences the effects only; the score has its own switch
    setMuted(m) { muted = m; if (sfx) sfx.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); },
    get musicOn() { return musicOn; },
    setMusic(on) { musicOn = on; if (music) music.gain.setTargetAtTime(on ? MUSIC_V : 0, ctx.currentTime, 0.1); },
    // effects still run with Sound off (into a silent bus), so caught and clear still cut the score
    play(name, a) { if (!ctx || ctx.state !== 'running') return; const f = SFX[name]; if (f) f(a); },
  };
})();
