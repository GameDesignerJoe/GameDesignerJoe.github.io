const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const sine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
// a line from A to B over dur, eased, with a small handheld drift
export const dolly = (A, B, dur, e = sine, hand = 0.006) => (t) => { const k = e(Math.min(1, t / dur));
  return { x: lerp(A[0], B[0], k) + Math.sin(t * 1.3) * hand * 3, y: lerp(A[1], B[1], k) + Math.cos(t * 1.1) * hand * 3, a: lerp(A[2], B[2], k) + Math.sin(t * 0.9) * hand }; };
// keyframes [[t, x, y, a], …], Catmull-Rom through them, with a little handheld drift
export const path = (K, hand = 0.004) => (t) => {
  let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
  const u = Math.max(0, Math.min(1, (t - k1[0]) / (k2[0] - k1[0])));
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return { x: cr(k0[1], k1[1], k2[1], k3[1]) + Math.sin(t * 1.3) * hand * 3, y: cr(k0[2], k1[2], k2[2], k3[2]) + Math.cos(t * 1.1) * hand * 3, a: cr(k0[3], k1[3], k2[3], k3[3]) + Math.sin(t * 0.9) * hand };
};
const E = 0, S_ = Math.PI / 2, W_ = Math.PI, N = -Math.PI / 2;
const TURN = () => { while (!FP.turned) FP.addFind(); };
const UNDO = () => { for (const st of FP.story) if (st.lieFaces) for (const fk of [...st.lieFaces]) FP.crossOut(fk); };
const at = (x, y, a) => () => ({ x, y, a });
export const SHOTS = {
  turn: { dur: 6, cam: dolly([13.5, 37.5, E], [14.6, 37.5, E], 6, (t) => t), events: [{ t: 1.0, fn: TURN }, { t: 2.6, fn: () => FP.hallOut(performance.now()) }] },
  roomdark: { dur: 4, pre: async (p) => { await p.evaluate(TURN); await p.evaluate(() => { FP.S.turnRooms = 1; }); await p.clock.runFor(2000); }, cam: dolly([10.5, 39.5, W_], [6.6, 38.4, W_ - 0.25], 4) },
  being: { dur: 8, pre: async (p) => { await p.evaluate(TURN); await p.clock.runFor(1500); }, cam: dolly([28.5, 41.5, W_], [22.0, 41.5, W_], 8, (t) => t), events: [{ t: 0.2, fn: () => FP.forceBeing() }] },
  father: { dur: 6, cam: at(13.5, 37.5, E), events: [{ t: 0.1, fn: () => FP.forceFather() }] },
  hide: { dur: 7, keepDoors: true, pre: async (p) => {
      await p.evaluate(() => { const st = FP.story.find((s) => s.mem === 'hide'); FP.P.x = st.m.rx + 0.5; FP.P.y = st.m.ry + 0.5; FP.P.a = Math.atan2(st.m.dy, st.m.dx); window._hide = st; });
      await p.clock.runFor(600); await p.keyboard.press('Escape'); await p.clock.runFor(400);
      await p.evaluate(() => { const st = window._hide; const c = FP.closets.find((c) => c.k === st.closet.k) || FP.closets.find((c) => st.set.has(c.y * FP.W + c.x)); FP.enterCloset(c); });
      await p.clock.runFor(7000); } },
  lies: { dur: 3.5, cam: dolly([15.6, 27.4, 0.35], [15.7, 27.6, 0.45], 3.5), events: [{ t: 1.2, fn: () => { const st = FP.story.find((s) => s.kind === 'wall'); for (const fk of [...st.lieFaces]) FP.crossOut(fk); } }] },
  heart: { dur: 5, pre: async (p) => { await p.evaluate(UNDO); await p.clock.runFor(500); }, cam: dolly([8.5, 11.2, S_], [8.5, 12.6, S_ + 0.05], 5) },
  exit: { dur: 6, pre: async (p) => { await p.evaluate(UNDO); await p.evaluate(() => { document.getElementById('shelveBook').click(); document.getElementById('leaveWatch').click(); }); await p.clock.runFor(4000); for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.clock.runFor(300); } }, cam: path([[0, 29.5, 8.5, N], [2.5, 29.5, 4.6, N + 0.5], [4.2, 29.55, 3.55, E - 0.05], [6, 30.3, 3.5, E]]) },
  dart: { dur: 3, cam: dolly([19.5, 33.6, N], [19.5, 32.4, N], 3, (t) => t), events: [{ t: 0.1, fn: () => FP.forceDart() }] },
  wake: { wake: true, dur: 6.5, pre: async (p) => { await p.clock.runFor(1500); await p.keyboard.press('Escape'); } },
  wake2: { dur: 3.4, pre: async (p) => { await p.evaluate(() => { window._p0 = { x: FP.P.x, y: FP.P.y, a: FP.P.a }; }); },
    events: Array.from({ length: 102 }, (_, i) => ({ t: i / 30, arg: i / 30, fn: (t) => { const k = Math.max(0, Math.min(1, (t - 0.7) / 2.2)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, amp = Math.sin(Math.PI * k);
      FP.S.eye = 0.1 + 0.4 * e; const p0 = window._p0, sw = Math.sin(t * 4.2) * 0.07 * amp; FP.P.x = p0.x - Math.sin(p0.a) * sw - Math.cos(p0.a) * 0.15 * (1 - e); FP.P.y = p0.y + Math.cos(p0.a) * sw; FP.P.a = p0.a + Math.sin(t * 4.2 + 0.6) * 0.05 * amp + 0.25 * (1 - e) * Math.sin(t * 0.8); } })) },
  hall: { dur: 3, cam: dolly([13.5, 37.5, E], [19.5, 37.5, E + 0.05], 3, (t) => t) },
  hall3: { dur: 3, cam: dolly([12.5, 3.5, E - 0.1], [19.5, 3.5, E + 0.1], 3, (t) => t) },
  kid: { dur: 3.5, cam: dolly([21.0, 31.2, N - 0.5], [21.2, 30.6, N + 0.2], 3.5), events: [{ t: 0.9, fn: () => { const g = FP.lightGroups.find((g) => g.pitch); FP.flipSwitch(g); } }] },
  fire: { dur: 6, cam: dolly([25.7, 23.6, 0.75], [25.85, 23.75, 0.8], 6), events: [{ t: 0.3, fn: () => FP.useMemory(FP.story.find((s) => s.mem === 'fire')) }] },
  cards: { dur: 5, events: [{ t: 0.0, fn: () => { const st = FP.story.find((s) => s.mem === 'cards'); FP.P.x = st.at.x + 0.5 + st.at.ix * 1.0; FP.P.y = st.at.y + 0.5 + st.at.iy * 1.0; FP.P.a = Math.atan2(-st.at.iy, -st.at.ix); FP.useMemory(st); } }, { t: 1.5, fn: () => FP.useMemory(FP.story.find((s) => s.mem === 'cards')) }] },
  book: { dur: 6, pre: async (p) => { await p.evaluate(() => { const g = FP.lightGroups.find((g) => g.pitch); FP.flipSwitch(g); FP.P.x = 21.5; FP.P.y = 28.5; }); await p.clock.runFor(1500); await p.evaluate(() => FP.openBook()); }, events: [{ t: 2.5, node: true, fn: (p) => p.keyboard.press('Space') }, { t: 4.2, node: true, fn: (p) => p.keyboard.press('Space') }] },
  page: { dur: 3, cam: dolly([5.2, 39.5, 0.2], [6.4, 39.5, 0.4], 1.5) },
  waiting: { dur: 3, cam: dolly([17.5, 12.2, S_ + 0.25], [18.2, 14.6, S_ + 0.6], 3) },
  wallroom: { dur: 3, cam: dolly([15.5, 25.4, S_ - 0.2], [16.0, 27.6, S_ + 0.35], 3) },
};
