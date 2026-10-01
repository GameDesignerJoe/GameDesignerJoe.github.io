// The Maze — trailer score. 96 BPM, 12 bars, 30s; every cut in the edit sits on this grid.
// Act I in the Child's key (C pentatonic, his music-box motif), the Turn in its own (D, 0 1 3 6 7),
// and the heart's tune (B A G A B B B — a song he knew, slowed) to close in G.
const BPM = 96, B = 60 / BPM, BAR = 4 * B, LEN = 30.6, SR = 48000;
async function renderScore() {
  const ac = new OfflineAudioContext(2, Math.ceil(LEN * SR), SR);
  const rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  // ── buses ──
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
  const master = ac.createGain(); master.gain.value = 0.9; comp.connect(master); master.connect(ac.destination);
  const dry = ac.createGain(); dry.connect(comp);
  const verb = ac.createConvolver(); const verbG = ac.createGain(); verbG.gain.value = 0.55; verb.connect(verbG); verbG.connect(comp);
  const ir = (sec, decay) => { const b = ac.createBuffer(2, sec * SR, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / d.length, decay); } return b; };
  verb.buffer = ir(4.5, 3.2);
  const room = ac.createConvolver(); room.buffer = ir(1.2, 4); const roomG = ac.createGain(); roomG.gain.value = 0.35; room.connect(roomG); roomG.connect(comp);
  const noiseB = (() => { const b = ac.createBuffer(2, SR * 4, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; } return b; })();
  const out = (node, { pan = 0, wet = 0.3, rm = 0 } = {}) => { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(dry); if (wet) { const w = ac.createGain(); w.gain.value = wet; p.connect(w); w.connect(verb); } if (rm) { const r = ac.createGain(); r.gain.value = rm; p.connect(r); r.connect(room); } return p; };
  const env = (g, t, a, peak, d, end = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); };
  const osc = (type, f, t, stop, det = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.start(t); o.stop(stop); return o; };
  const noise = (t, dur) => { const s = ac.createBufferSource(); s.buffer = noiseB; s.loop = true; s.start(t, rnd() * 3); s.stop(t + dur); return s; };
  const hz = (root, st) => root * Math.pow(2, st / 12);

  // ── voices ──
  function musicbox(t, f, v = 0.16, pan = 0, wet = 0.7, len = 2.4) {
    const g = ac.createGain(); env(g, t, 0.004, v, len); out(g, { pan, wet });
    [[f, 1, 'sine'], [f * 2, 0.22, 'triangle'], [f * 3, 0.12, 'sine'], [f * 5.43, 0.06, 'sine']].forEach(([ff, k, ty], i) => {
      const o = osc(ty, ff, t, t + len + 0.2), gg = ac.createGain(); env(gg, t, 0.003, k, i ? len * 0.35 : len); o.connect(gg); gg.connect(g); });
  }
  function pad(t, dur, freqs, v = 0.05, { type = 'sawtooth', lp0 = 300, lp1 = 1400, det = 9, pan = 0, wet = 0.6, att = 0.8 } = {}) {
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + dur - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.setValueAtTime(lp0, t); lp.frequency.exponentialRampToValueAtTime(lp1, t + dur * 0.7); lp.connect(g); out(g, { pan, wet });
    for (const f of freqs) for (const d of [-det, det]) { const o = osc(type, f, t, t + dur + 0.5, d); const k = ac.createGain(); k.gain.value = 1 / freqs.length; o.connect(k); k.connect(lp); }
  }
  function kick(t, v = 0.9, f0 = 130, f1 = 42, d = 0.45) {
    const o = osc('sine', f0, t, t + d + 0.05); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
    const g = ac.createGain(); env(g, t, 0.002, v, d); o.connect(g); out(g, { wet: 0.05 });
    const c = noise(t, 0.02), cg = ac.createGain(); env(cg, t, 0.001, v * 0.12, 0.015); const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; c.connect(hp); hp.connect(cg); out(cg, { wet: 0 });
  }
  function heartbeat(t, v = 0.8) { kick(t, v, 90, 38, 0.32); kick(t + 0.22, v * 0.6, 80, 36, 0.3); }
  function tick(t, v = 0.05, pan = 0) { const s = noise(t, 0.05), hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 6500; hp.Q.value = 2; const g = ac.createGain(); env(g, t, 0.001, v, 0.035); s.connect(hp); hp.connect(g); out(g, { pan, wet: 0.15 }); }
  function pluck(t, f, v = 0.06, pan = 0) { const o = osc('triangle', f, t, t + 1); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.4); const g = ac.createGain(); env(g, t, 0.003, v, 0.6); o.connect(lp); lp.connect(g); out(g, { pan, wet: 0.45 }); }
  function bass(t, f, dur, v = 0.22) { const o = osc('triangle', f, t, t + dur + 0.2), o2 = osc('sine', f / 2, t, t + dur + 0.2); const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.03); g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.12); o.connect(g); o2.connect(g); out(g, { wet: 0.05 }); }
  function riser(t0, t1, v = 0.25) { const s = noise(t0, t1 - t0), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(7000, t1); const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1); s.connect(bp); bp.connect(g); out(g, { wet: 0.4 });
    const o = osc('sawtooth', 110, t0, t1); o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(880, t1); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; const og = ac.createGain(); og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(v * 0.18, t1 - 0.02); og.gain.linearRampToValueAtTime(0, t1); o.connect(lp); lp.connect(og); out(og, { wet: 0.5 }); }
  function boom(t, v = 1, f0 = 75, f1 = 26, d = 2.6) {   // a sub drop with a dirty edge
    const o = osc('sine', f0, t, t + d); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.8);
    const ws = ac.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; cv[i] = Math.tanh(x * 3); } ws.curve = cv;
    const g = ac.createGain(); env(g, t, 0.003, v, d); o.connect(ws); ws.connect(g); out(g, { wet: 0.25 });
    const s = noise(t, 1.2), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1); const ng = ac.createGain(); env(ng, t, 0.002, v * 0.5, 1.1); s.connect(lp); lp.connect(ng); out(ng, { wet: 0.8 });
  }
  function slam(t, v = 0.6, pan = 0) {   // a door, somewhere: body thump + metal ring
    kick(t, v * 0.8, 160, 50, 0.3);
    [523, 811, 1307, 1949].forEach((f, i) => { const o = osc('square', f * (1 + rnd() * 0.01), t, t + 1.4); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 12; const g = ac.createGain(); env(g, t, 0.002, v * 0.05 / (i + 1), 1.2); o.connect(bp); bp.connect(g); out(g, { pan, wet: 0.9 }); });
  }
  function braam(t, dur, root, v = 0.14) {
    const freqs = [root / 2, root, root * 1.5, root * 2 * Math.pow(2, 1 / 12)];
    pad(t, dur, freqs, v, { type: 'sawtooth', lp0: 120, lp1: 2400, det: 14, wet: 0.5, att: 0.12 });
    const lfo = osc('sine', 5.5, t, t + dur); void lfo;
  }
  function buzz(t, dur, v = 0.05, pan = 0) {   // a tube on its way out: 120Hz, gated in stutters
    const o = osc('sawtooth', 120, t, t + dur), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2; const g = ac.createGain(); g.gain.value = 0;
    for (let x = t; x < t + dur; x += 0.03 + rnd() * 0.06) g.gain.setValueAtTime(rnd() < 0.55 ? v * (0.4 + rnd()) : 0, x);
    g.gain.setValueAtTime(0, t + dur); o.connect(bp); bp.connect(g); out(g, { pan, wet: 0.2 });
  }
  function screech(t, dur, v = 0.05) { [1760, 1864, 2637].forEach((f, i) => { const o = osc('sine', f, t, t + dur), l = osc('sine', 6 + i, t, t + dur), lg = ac.createGain(); lg.gain.value = 18; l.connect(lg); lg.connect(o.frequency); const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v / 3, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); out(g, { pan: i - 1, wet: 0.7 }); }); }
  function step(t, v = 0.4, pan = 0) { const s = noise(t, 0.15), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = ac.createGain(); env(g, t, 0.004, v, 0.12); s.connect(lp); lp.connect(g); out(g, { pan, wet: 0.3, rm: 0.6 }); kick(t, v * 0.35, 70, 40, 0.15); }
  function glitch(t, v = 0.12) { for (let i = 0; i < 5; i++) { const x = t + i * 0.025; const o = osc('square', 200 + rnd() * 3000, x, x + 0.02); const g = ac.createGain(); env(g, x, 0.001, v * (0.4 + rnd() * 0.6), 0.018); o.connect(g); out(g, { pan: rnd() * 2 - 1, wet: 0.1 }); } }
  function reverseSwell(t1, dur, v = 0.2) { const t0 = t1 - dur; const s = noise(t0, dur), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t1); g.gain.linearRampToValueAtTime(0, t1 + 0.01); s.connect(hp); hp.connect(g); out(g, { wet: 1 }); }
  function hum(t, dur, v = 0.012) { const o = osc('sawtooth', 60, t, t + dur), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 1); g.gain.setValueAtTime(v, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(lp); lp.connect(g); out(g, { wet: 0.1 }); }
  function shimmer(t, dur, freqs, v = 0.05) { freqs.forEach((f, i) => { const o = osc('sine', f, t, t + dur), g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v / freqs.length, t + 0.6 + i * 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); out(g, { pan: (i % 2 ? 0.5 : -0.5), wet: 1 }); }); }

  const C5 = 523.25, at = (bar, beat = 0) => bar * BAR + beat * B;   // bars count from 0
  const PENT = [0, 2, 4, 7, 9], deg = (root, d) => { const n = PENT.length, o = Math.floor(d / n); return hz(root, PENT[((d % n) + n) % n] + 12 * o); };
  const MOTIF = [0, 2, 4, 2, 0, -3];   // the Child's: C D E D C A

  // ── 0:00 · cold open. The motif alone, one note to each word on black: he · said · stay · here.
  hum(0, 15, 0.01);
  MOTIF.forEach((d, i) => musicbox(at(0, i), deg(C5, d), 0.16, (i % 2 ? 0.25 : -0.25), 0.8, 3));
  // 0:02.5 · waking: the floor, the getting up. A pad comes in under him
  boom(at(1), 0.35, 60, 30, 2.2); pad(at(1), BAR * 2, [hz(C5 / 4, 0), hz(C5 / 4, 7), hz(C5 / 2, 4)], 0.045, { type: 'triangle', lp0: 200, lp1: 1200, det: 6 });
  musicbox(at(1, 2.5), deg(C5, 4), 0.1, 0.4); musicbox(at(1, 3), deg(C5, 2), 0.09, -0.4);   // "but I didn't."
  // 0:05 · the maze draws itself: the motif in eighths, a felt kick under it
  const prog = [[0, [0, 4, 7]], [9, [9, 12, 16]], [5, [5, 9, 12]], [7, [7, 11, 14]]];   // C Am F G
  for (let bar = 2; bar < 6; bar++) {
    const [r, ch] = prog[(bar - 2) % 4];
    pad(at(bar), BAR, ch.map((s) => hz(C5 / 2, s)), bar < 4 ? 0.03 : 0.04, { type: 'sawtooth', lp0: 500, lp1: bar < 4 ? 1500 : 2600, det: 8, wet: 0.7, att: 0.3 });
    bass(at(bar), hz(C5 / 8, r), BAR * 0.45); bass(at(bar, 2.5), hz(C5 / 8, r), BAR * 0.3, 0.16);
    for (let s = 0; s < 8; s++) { const d = [0, 2, 4, 7, 9, 7, 4, 2][s] + (bar >= 4 ? 5 : 0); musicbox(at(bar, s / 2), hz(C5, ch[0] + [0, 7, 12, 7][s % 4]) * (d > 9 ? 1 : 1), s % 2 ? 0.05 : 0.075, s % 2 ? 0.5 : -0.5, 0.55, 1.2); }
    kick(at(bar, 0), 0.75); kick(at(bar, 2), 0.6);
    if (bar >= 3) for (let s = 0; s < 8; s++) tick(at(bar, s / 2 + 0.25), s % 2 ? 0.03 : 0.045, (s % 2 ? 0.6 : -0.6));
    if (bar >= 4) { kick(at(bar, 1), 0.5); kick(at(bar, 3), 0.5); pluck(at(bar, 1.5), hz(C5, ch[1]), 0.05, 0.3); pluck(at(bar, 3.5), hz(C5, ch[2]), 0.05, -0.3); }
    if (bar % 2 === 0) MOTIF.forEach((d, i) => musicbox(at(bar, i * 0.5), deg(C5 * 2, d), 0.05, 0, 0.9, 2));
  }
  // cue hits on the act-one cuts
  [at(3), at(3, 2)].forEach((t) => kick(t, 0.5, 200, 60, 0.2));
  buzz(at(4) - 0.05, 0.75, 0.06, 0.2); shimmer(at(4) + 0.6, 2.4, [hz(C5, 0), hz(C5, 4), hz(C5, 7), hz(C5, 12)], 0.08);   // 0:10 · the kid's room: a tube stutters on
  // 0:12.5–14.7 · it builds, then nothing
  riser(at(5), at(5, 3.5), 0.3); reverseSwell(at(5, 3.5), 1.6, 0.25);
  for (let s = 0; s < 8; s++) kick(at(5, 2 + s * 0.25), 0.25 + s * 0.06, 150, 50, 0.15);
  // ── 0:15 · THE TURN. Every tube in the place stutters and something big goes off far away
  boom(at(6), 1.0, 80, 24, 3.2); slam(at(6), 0.9, 0.3); buzz(at(6), 1.3, 0.09, -0.3); buzz(at(6) + 0.1, 1.2, 0.07, 0.4); glitch(at(6), 0.15);
  const D = 293.66, TURN = [0, 1, 3, 6, 7];
  braam(at(6, 0.1), BAR * 1.9, D / 4, 0.16);
  // the Turn's motif, slow and out of tune: D Eb D C
  [0, 1, 0, -2].forEach((d, i) => { const n = TURN.length, o = Math.floor(d / n), st = TURN[((d % n) + n) % n] + 12 * o; musicbox(at(6, 1 + i), hz(D, st) * (1 + (i % 2 ? 0.012 : -0.008)), 0.09, i % 2 ? 0.6 : -0.6, 1, 3); });
  for (let bar = 7; bar < 9; bar++) {
    pad(at(bar), BAR, [hz(D / 2, 0), hz(D / 2, 1), hz(D / 2, 6)], 0.04, { type: 'sawtooth', lp0: 300, lp1: 1600, det: 20, wet: 0.8, att: 0.2 });
    for (let b = 0; b < 4; b++) heartbeat(at(bar, b), 0.7 + (bar - 7) * 0.1);
    for (let s = 0; s < 16; s++) if (rnd() < 0.5) tick(at(bar, s / 4), 0.02 + rnd() * 0.03, rnd() * 2 - 1);
    bass(at(bar), D / 8, BAR * 0.9, 0.2);
  }
  braam(at(7), BAR * 0.95, D / 4 * Math.pow(2, 1 / 12), 0.13);   // 0:17.5 · LEAVE
  slam(at(7), 0.5, -0.5); glitch(at(7), 0.12);
  screech(at(7, 2.6), 1.3, 0.06); kick(at(7, 3), 0.9, 110, 30, 0.8); glitch(at(7, 3), 0.15);   // 0:18.75 · the being
  // 0:20 · the closet: his steps, heavy and uneven, nearer and nearer
  [0, 0.7, 1.05, 1.9, 2.5, 2.8].forEach((x, i) => step(at(8) + x, 0.4 + i * 0.1, 0.3 - i * 0.1));
  braam(at(8), BAR * 0.5, D / 4 * Math.pow(2, 6 / 12), 0.1);
  // 0:21.25 · the strobe: sixteenths, and a hit on every cut
  for (let s = 0; s < 8; s++) { kick(at(8, 2 + s * 0.25), 0.55, 180, 45, 0.12); if (s % 2 === 0) glitch(at(8, 2 + s * 0.25), 0.08); }
  riser(at(8, 2), at(9) - 0.02, 0.3); screech(at(8, 2.5), 1.25, 0.05);
  // ── 0:22.5 · the lies crossed out: everything stops but the music box, back in the Child's key
  boom(at(9), 0.45, 55, 28, 2); reverseSwell(at(9), 0.8, 0.12);
  pad(at(9), BAR * 2, [hz(C5 / 2, 0), hz(C5 / 2, 7), hz(C5 / 2, 16)], 0.035, { type: 'triangle', lp0: 300, lp1: 2200, det: 5, wet: 0.9, att: 1.2 });
  [0, 2, 4, 7, 4, 2, 4, 9].forEach((d, i) => musicbox(at(9, i * 0.5), hz(C5, d), 0.08, i % 2 ? 0.4 : -0.4, 0.9, 2.2));
  // 0:23.75 · find what's true
  shimmer(at(9, 2), 3, [hz(C5, 12), hz(C5, 16), hz(C5, 19)], 0.06);
  // 0:25 · the heart: its heartbeat, and the tune he knew — B A G A B B B
  const G4 = 392.0;
  for (let b = 0; b < 4; b++) heartbeat(at(10, b), 0.55);
  pad(at(10), BAR * 2.2, [hz(G4 / 2, 0), hz(G4 / 2, 4), hz(G4 / 2, 7), hz(G4 / 2, 14)], 0.04, { type: 'triangle', lp0: 400, lp1: 2400, det: 5, wet: 0.9, att: 0.6 });
  [4, 2, 0, 2, 4, 4, 4].forEach((s, i) => musicbox(at(10, i * 0.5), hz(G4, s), 0.11, i % 2 ? 0.3 : -0.3, 0.9, 2.6));
  bass(at(10), G4 / 8, BAR, 0.18);
  // ── 0:27.5 · the title. One last low note under it, and the music box rings out
  boom(at(11), 0.7, 60, 30, 3); slam(at(11), 0.25, 0);
  shimmer(at(11), 3, [hz(G4, 0), hz(G4, 7), hz(G4, 14), hz(G4, 16), hz(G4, 19)], 0.09);
  musicbox(at(11), hz(G4, 0), 0.16, 0, 1, 3.4); musicbox(at(11, 1), hz(G4, 7), 0.07, 0.3, 1, 3); musicbox(at(11, 2), hz(G4, 12), 0.06, -0.3, 1, 2.6);
  return ac.startRendering();
}
function wav(buf) {
  const n = buf.length, ch = 2, data = new DataView(new ArrayBuffer(44 + n * ch * 2)); let o = 0;
  const s = (str) => { for (const c of str) data.setUint8(o++, c.charCodeAt(0)); }, u32 = (v) => { data.setUint32(o, v, true); o += 4; }, u16 = (v) => { data.setUint16(o, v, true); o += 2; };
  s('RIFF'); u32(36 + n * ch * 2); s('WAVE'); s('fmt '); u32(16); u16(1); u16(ch); u32(SR); u32(SR * ch * 2); u16(ch * 2); u16(16); s('data'); u32(n * ch * 2);
  const L = buf.getChannelData(0), R = buf.getChannelData(1); let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = peak > 0.98 ? 0.98 / peak : 1;
  for (let i = 0; i < n; i++) { data.setInt16(o, Math.max(-1, Math.min(1, L[i] * k)) * 32767, true); o += 2; data.setInt16(o, Math.max(-1, Math.min(1, R[i] * k)) * 32767, true); o += 2; }
  return { bytes: new Uint8Array(data.buffer), peak };
}
