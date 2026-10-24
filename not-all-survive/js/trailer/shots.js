// The shots. See director.js for the shape of one: setup(D) stages the world through the game's own
// hooks, tick(D, t) drives it, cam(D, t) frames it, gfx(g, t, D) draws over it, gfxBars(g, t, D, h)
// sets type in the letterbox. t: seconds into the shot.
import { worldToScreen } from '../camera.js';
import { CUES, timeline } from './plan.js';
import { LAKE } from './data.js';

const TENT = { x: 1330, y: 1542 };
const AT = Object.fromEntries(timeline().map(s => [s.id, s.at]));
const BAR = '#e9e7e2';

// type set in the bottom bar: a caption at the left, a reading at the right (the field log)
function barLog(g, h, left, right, k, out) {
  if (h < 20) return;
  const y = g.H - h / 2, size = Math.min(24, h * 0.2);
  if (left) g.mono(left, 96, y, { size, color: BAR, k, out, track: 0.3, alpha: 0.96 });
  if (right) g.mono(right, g.W - 96, y, { size, color: BAR, k, out, track: 0.18, align: 'right', alpha: 0.96, cursor: false });
}
// rolling temperature: from a to b over [t0, t1]
const temp = (t, a, b, t0 = 0, t1 = 1) => {
  const v = Math.round(a + (b - a) * Math.max(0, Math.min(1, (t - t0) / (t1 - t0))));
  return `${v < 0 ? '−' : ''}${Math.abs(v)}°C`;
};
const sc = (x, y) => worldToScreen(x, y);
const tick = (t, dt, every, off = 0) => Math.floor((t - off) / every) !== Math.floor((t - off - dt) / every);

export const SHOTS = {
  test: {
    async setup(D) { D.night(false); D.teleport(1360, 1575); D.warm(1); },
    tick(D) { D.walk(0, 1); },
    cam(D) { return D.track(0, -6, D.base()); },
  },

  scout: {
    async setup(D) {
      const q = D.state.params, x = +q.get('sx'), y = +q.get('sy');
      D.teleport(+(q.get('px') || x), +(q.get('py') || y + 30)); D.warm(1); D.radioOff();
      if (q.has('pup')) { D.teleport(x, y); D.warm(0.2); D.state.pitch(true); D.warm(0.2); D.p.tent('pup'); D.until(() => D.p.mode === 'inside', 12); }
      D.warm(2);
    },
    cam(D) { const q = D.state.params; return { x: +q.get('sx'), y: +q.get('sy'), zoom: +(q.get('sz') || 4) }; },
  },

  // 0:00 Black. The bars part on a white void; a pen finds the lake's shore; the painting bleeds in.
  open: {
    async setup(D) { D.teleport(1352, 1556); D.warm(0.5); D.p.tent(); D.until(() => D.p.mode === 'inside', 12); D.radioOff(); D.warm(1); },
    cam(D) { return D.keys([[0, 1185, 1478, 1.32], [10.5, 1268, 1522, 1.58]], x => x); },
    gfx(g, t) {
      // the paper: everything white until the ink lets the painting through
      const pts = LAKE.map(([x, y]) => { const s = sc(x, y); return [s.x, s.y]; });
      paperOver(g, pts, g.ease((t - 2.2) / 2.6));
      // the pen
      g.stroke(pts, easeInOut((t - 0.8) / 1.7), { width: 2.4, color: g.INK, alpha: 1 - g.smooth(4.2, 6.2, t), seed: 11, jitter: 0.8 });
      // base camp: one mark of signal yellow where the line set out from
      const c = sc(TENT.x, TENT.y), mk = g.env(t, 2.3, 0.4, 7.2, 1.2);
      if (mk > 0) {
        g.ctx.save(); g.ctx.globalAlpha = mk; g.ctx.fillStyle = g.YELLOW;
        g.ctx.beginPath(); g.ctx.moveTo(c.x, c.y - 7); g.ctx.lineTo(c.x + 7, c.y + 5); g.ctx.lineTo(c.x - 7, c.y + 5); g.ctx.closePath(); g.ctx.fill();
        g.ctx.restore();
        g.rings(c.x, c.y, { period: 1.6, max: 46, n: 2, alpha: mk * 0.8, width: 1.2, now: t });
      }
      // the title, lifted off the busy ink by a breath of snow behind it
      const ti = g.ease((t - 4.0) / 1.5), to = g.ease((t - 8.7) / 1.1);
      wash(g, g.W / 2, g.H * 0.5, 980, 200, 0.75 * Math.min(ti, 1 - to));
      g.title('THE BOTTOM OF THE WORLD', g.W / 2, g.H * 0.5, { size: 62, track: 0.16, k: ti, out: to, scrim: 'snow', scrimA: 0.45 });
    },
    gfxBars(g, t, D, h) {
      barLog(g, h, '77°51′ S   166°40′ E', null, g.clamp((t - 5.4) / 0.9), g.clamp((t - 9.2) / 0.5));
      barLog(g, h, null, temp(t, -18, -41, 6.0, 7.6), g.clamp((t - 6.0) / 0.3), g.clamp((t - 9.2) / 0.5));
      // the cold open: one blip of the signal on black, before the bars part
      const bk = g.env(t, 0.28, 0.03, 0.95, 0.5);
      if (bk > 0) {
        g.ctx.save(); g.ctx.globalAlpha = bk; g.ctx.fillStyle = g.YELLOW; g.ctx.shadowColor = g.GLOW; g.ctx.shadowBlur = 18;
        g.ctx.beginPath(); g.ctx.arc(g.W / 2, g.H / 2, 4.5, 0, Math.PI * 2); g.ctx.fill(); g.ctx.restore();
        g.rings(g.W / 2, g.H / 2, { period: 0.9, max: 60, n: 1, alpha: bk * 0.8, width: 1.2, now: t - 0.26, squash: 1 });
      }
    },
  },

  // 0:10 Base camp: the tent, the dogs, four pairs of skis, the sled.
  camp: {
    async setup(D) {
      D.teleport(1352, 1556); D.warm(0.5);
      D.p.tent(); D.until(() => D.p.mode === 'inside', 12);
      D.radioOff(); D.warm(2);
    },
    cam(D) { return D.keys([[-0.5, 1306, 1562, 5.0], [5.5, 1318, 1560, 5.9]]); },
    gfx(g, t) {
      const k = g.ease((t - 1.0) / 1.4), o = g.ease((t - 4.0) / 0.9);
      g.title('FOUR SET OUT.', g.W / 2, g.H * 0.72, { size: 50, track: 0.2, k, out: o, scrim: 'snow' });
    },
    gfxBars(g, t, D, h) { barLog(g, h, 'BASE CAMP', temp(t, -22, -22), g.clamp((t - 0.4) / 0.6), g.clamp((t - 4.4) / 0.5)); },
  },

  // 0:15 One of them crawls out into the cold.
  crawl: {
    async setup(D) {
      D.teleport(1352, 1556); D.warm(0.5);
      D.p.tent(); D.until(() => D.p.mode === 'inside', 12);
      D.radioOff(); D.warm(2);
    },
    tick(D) { if (D.at(0.1)) D.p.leaveTent(); },
    cam(D) { return D.keys([[-0.5, 1334, 1548, 5.6], [4.5, 1338, 1550, 6.0]]); },
  },

  // 0:19 Packing at the sled: the pack and the sled's slots, side by side.
  packing: {
    async setup(D) { D.teleport(1318, 1588); D.warm(0.5); D.radioOff(); D.state.openSled(); D.warm(0.6); },
    cam(D) { return D.keys([[0, 1298, 1566, 5.7], [3.5, 1300, 1567, 6.0]]); },
    gfxBars(g, t, D, h) { barLog(g, h, 'THE SLED', 'TEN SLOTS', g.clamp((t - 0.3) / 0.5), g.clamp((t - 2.5) / 0.4)); },
  },

  // 0:22 The radio. Blips, faint and far; then the beacon's own SOS.
  radio: {
    async setup(D) { D.teleport(1300, 1500, -Math.PI / 2); D.warm(2); },
    tick(D) { D.stop(); },
    cam(D) { return D.keys([[-0.5, 1300, 1484, 5.3], [6.5, 1300, 1488, 6.0]]); },
    gfx(g, t, D) {
      const T = AT.radio + t, p = D.p, s = sc(p.x + 5.5, p.y - 23.5);
      const blips = CUES.blips.map(b => ({ t: b, d: 0.06, a: 0.55 }));
      const sos = g.morseTimes(CUES.sos.start, CUES.sos.unit).map(b => ({ ...b, a: 1 }));
      // the set's own signal arcs, pulsing with each blip
      for (const b of [...blips, ...sos]) {
        const age = T - b.t;
        if (age >= 0 && age < 0.9) {
          g.ctx.save(); g.ctx.globalAlpha = (1 - age / 0.9) * 0.9; g.ctx.strokeStyle = '#ffffff'; g.ctx.lineWidth = 2;
          for (let i = 1; i <= 3; i++) { g.ctx.beginPath(); g.ctx.arc(s.x, s.y, (14 + 26 * i) * (0.6 + age), -1.25, 0.15); g.ctx.stroke(); }
          g.ctx.restore();
        }
      }
      // the trace across the frame
      const wy = g.H * 0.7;
      g.wave(160, g.W - 160, wy, { now: T, blips: [...blips, ...sos], amp: 34, color: g.INK, alpha: 0.75 * g.env(t, 0.1, 0.6, 6.4, 0.5), k: g.easeOut((t + 0.2) / 0.9), span: 2.6 });
      // the SOS, set as type
      const mk = g.env(t, CUES.sos.start - AT.radio - 0.3, 0.3, 6.4, 0.6);
      g.morse(g.W / 2, g.H * 0.29 + 62, { start: CUES.sos.start, unit: CUES.sos.unit, now: T, size: 12, base: 0.18 * mk, alpha: mk, glow: true, decay: 0.6 });
      const k = g.ease((t - 3.0) / 1.5), o = g.ease((t - 5.6) / 0.6);
      g.title('SOMEONE IS STILL OUT THERE.', g.W / 2, g.H * 0.29, { size: 52, track: 0.16, k, out: o, scrim: 'snow' });
    },
    gfxBars(g, t, D, h) { barLog(g, h, 'THE RADIO', null, g.clamp((t - 0.2) / 0.5), g.clamp((t - 5.6) / 0.4)); },
  },

  // 0:28 Setting out: small against all of it.
  setout: {
    async setup(D) { D.teleport(1250, 1490); D.warm(1); D.radioOff(); D.walk(-100, 1); D.warm(1); },
    tick(D) { D.walk(-100, 1); },
    cam(D) { return D.keys([[0, 1232, 1442, 2.75], [3.5, 1226, 1426, 2.5]]); },
  },

  // 0:31 The montage: the world, one beat each.
  deep: {
    async setup(D) {
      D.teleport(1478, 1546); D.warm(0.3); D.radioOff();
      D.state.gear('snowshoes', true); D.warm(1.5); D.walk(-12, 1); D.warm(1.5);
    },
    tick(D) { D.walk(-12, 1); },
    cam(D) { return D.track(-2, -8, 6, 1.6); },
    gfxBars(g, t, D, h) { barLog(g, h, 'DEEP SNOW', temp(t, -31, -31), 1, g.clamp((t - 1.85) / 0.15)); },
  },

  climb: {
    async setup(D) {
      D.teleport(1460, 1515); D.warm(0.3); D.radioOff();
      D.state.gear('axes', true); D.state.gear('crampons', true);
      D.p.climb(0, -1);
      D.until(() => D.p.mode === 'climb', 8);
      D.state.timeScale = 2.2;   // the climb, quickened: it gains real height in its beat
      for (let i = 0; i < 2; i++) { D.p.climbTap(1); D.warm(0.4); }
    },
    tick(D, t) { if (tick(t, D.dt, 0.2)) D.p.climbTap(1); },
    cam(D) { return D.track(0, -26, 6, 2.4); },
    gfxBars(g, t, D, h) { barLog(g, h, 'THE ICE WALL', temp(t, -34, -34), 1, g.clamp((t - 2.35) / 0.15)); },
  },

  glare: {
    async setup(D) { D.teleport(1560, 1440); D.warm(4); D.radioOff(); D.walk(-60, 1); D.warm(1); },
    tick(D) { D.walk(-60, 1); },
    cam(D) { return D.track(-4, -12, 5.8, 1.6); },
    gfxBars(g, t, D, h) { barLog(g, h, 'GLARE', temp(t, -19, -19), 1, g.clamp((t - 1.85) / 0.15)); },
  },

  lake: {
    async setup(D) {
      D.teleport(1100, 1516); D.warm(0.3); D.radioOff();
      for (let i = 0; i < 6; i++) { D.walk(0, 0.8); D.warm(1.2); D.walk(180, 0.8); D.warm(1.2); }
    },
    tick(D, t) { D.walk(Math.floor(t / 1.2) % 2 ? 180 : 0, 0.8); },
    cam(D) { return D.track(0, -6, 6, 1); },
    gfxBars(g, t, D, h) { barLog(g, h, 'LAKE ICE', temp(t, -27, -27), 1, g.clamp((t - 1.85) / 0.15)); },
  },

  thin: {
    async setup(D) {
      D.teleport(825, 1758); D.warm(0.3); D.radioOff();
      D.state.gear('axes', true);
      for (let i = 0; i < 2; i++) { D.walk(0, 0.8); D.warm(1.1); D.walk(180, 0.8); D.warm(1.1); }
    },
    tick(D, t) {
      D.walk(Math.floor(t / 1.1) % 2 ? 0 : 180, 0.8);
      if (D.at(2.38)) D.state.breakIce();
    },
    cam(D) { return D.track(0, -6, 6, 1.2); },
    gfx(g, t) {
      const k = g.ease((t - 0.15) / 1.1);
      g.title('THE ICE LISTENS.', g.W / 2, g.H * 0.3, { size: 50, track: 0.2, k, out: t > 2.38 ? 1 : 0, scrim: 'snow' });
    },
    gfxBars(g, t, D, h) { barLog(g, h, t < 2.38 ? 'THIN ICE' : 'THIN ICE — THROUGH', temp(t, -29, -29), 1, 0); },
  },

  heave: {
    async setup(D) {
      D.teleport(835, 1758); D.warm(0.3); D.radioOff();
      D.state.gear('axes', true);
      D.state.breakIce();
      const q = D.state.params;
      if (q.has('probeheave')) { const n = D.until(() => D.p.mode === 'crawlout' || D.p.mode === 'walk' && D.p.water?.level === 0 && D.t > 99, 25); console.warn('heave out after', n, D.p.mode); }
      D.warm(+(q.get('hw') || 3.2));
    },
    warmTick(D, wt) { if (tick(wt, D.dt, 0.55, 0.05)) D.tap(D.p.x + 30, D.p.y - 30); },
    tick(D, t) { if (tick(t, D.dt, 0.55, 0.05)) D.tap(D.p.x + 30, D.p.y - 30); },
    cam(D) { return D.track(0, -6, 6, 1.2); },
    gfxBars(g, t, D, h) { barLog(g, h, 'OUT. SOAKED THROUGH.', temp(t, -29, -29), g.clamp((t - 0.3) / 0.5), g.clamp((t - 1.85) / 0.15)); },
  },

  // 0:44 Thirst: the Third Man walks beside them; a Fata Morgana stands on the horizon.
  third: {
    async setup(D) {
      const q = D.state.params;
      D.teleport(+(q.get('tx') || 1240), +(q.get('ty') || 1450)); D.warm(0.5); D.radioOff();
      D.walk(+(q.get('ta') || 180), 1); D.warm(1);
      D.state.thirst?.show(true); D.state.thirst?.episode(true);
      D.until(() => (D.state.thirst?.man?.vis || 0) > 0.6, 15);
      // keep him on the side the frame can show (above the explorer, clear of the letterbox)
      const m = D.state.thirst?.man;
      if (m && m.y > D.p.y) { m.side = -m.side; m.y = D.p.y - 45; m.vis = 0.5; D.warm(1.5); }
    },
    tick(D) { D.walk(+(D.state.params.get('ta') || 180), 1); },
    cam(D) { return D.track(-26, -10, 6.1, 1.4); },
    gfx(g, t) {
      const k = g.ease((t - 0.5) / 1.4), o = g.ease((t - 2.6) / 0.5);
      g.title('WHO WALKS BESIDE YOU?', g.W / 2, g.H * 0.74, { size: 46, track: 0.2, k, out: o, scrim: 'snow', scrimA: 0.85 });
    },
  },

  // 0:47 The storm.
  storm: {
    async setup(D) { D.teleport(1450, 1580); D.state.freeze(0.3); D.warm(6); D.radioOff(); },
    tick(D) { D.walk(-20, 0.8); },
    cam(D) { return D.track(0, -8, 6, 1.5); },
    gfxBars(g, t, D, h) { barLog(g, h, 'WHITEOUT', temp(t, -38, -57, 0.2, 3.0), 1, 0); },
  },

  pitch: {
    async setup(D) {
      const q = D.state.params;
      D.teleport(1440, 1590); D.spell('windy'); D.warm(5); D.radioOff();
      D.spell('calm'); D.state.pitch();
      D.warm(+(q.get('pw') || 3.4));
    },
    tick(D) { if (D.at(0)) { D.spell('windy'); D.state.pup.force = true; } },
    cam(D) { return D.track(0, -6, 6, 1); },
    gfxBars(g, t, D, h) { barLog(g, h, 'SHELTER', temp(t, -49, -49), 1, g.clamp((t - 3.6) / 0.4)); },
  },

  // 0:54 Night. The bear.
  bear: {
    async setup(D) { D.teleport(1480, 1548); D.warm(1); D.radioOff(); D.state.giveFlare(); D.state.bear.near(); D.state.bear.setAggro(0.7); D.warm(3.2);
      { const b = D.state.bear, dx = b.x - D.p.x, dy = b.y - D.p.y, d = Math.hypot(dx, dy) || 1; b.x = D.p.x + dx / d * 62; b.y = D.p.y + dy / d * 62; b.feet = null; }
    },
    tick(D) {
      D.stop(); D.state.warm(1); if (D.at(2.9)) D.state.bear?.charge();
      const b = D.state.bear; if (b && D.p.mode === 'walk') D.p.facing = Math.atan2(b.y - D.p.y, b.x - D.p.x);
    },
    cam(D, t) { const c = D.pair(D.state.bear, 5.4, 4.2); c.zoom = Math.min(6, c.zoom * (1 + 0.11 * D.ease(t / 5.5))); return c; },
    gfx(g, t, D) {
      // the dark leans in, beating with the score's heart
      const beat = Math.pow(Math.max(0, Math.sin((AT.bear + t) * Math.PI * (1.1 + t * 0.12))), 8);
      g.inkEdge(0.16 + 0.05 * beat + 0.12 * g.smooth(2, 5.5, t), { alpha: 0.85 });
      moon(g, D);
    },
  },

  flare: {
    async setup(D) {
      D.teleport(1480, 1548); D.warm(1); D.radioOff(); D.state.giveFlare(); D.state.bear.near(); D.state.bear.setAggro(0.7); D.warm(3.2);
      { const b = D.state.bear, dx = b.x - D.p.x, dy = b.y - D.p.y, d = Math.hypot(dx, dy) || 1; b.x = D.p.x + dx / d * 52; b.y = D.p.y + dy / d * 52; b.feet = null; }
      D.state.bear?.charge(); D.until(() => D.state.bear?.st === 'warn', 30); D.warm(1.0);
    },
    tick(D) { D.stop(); D.state.warm(1); if (D.at(0)) D.state.gun.flare(); },
    cam(D) { return D.pair(D.state.bear, 6, 4.4); },
    gfx(g, t, D) {
      const at = D.p.flareAt || { x: D.p.x + 6, y: D.p.y - 16 }, s = sc(at.x, at.y);
      const lit = g.smooth(CUES.flare - AT.flare - 0.08, CUES.flare - AT.flare + 0.5, t);
      const flick = 1 + 0.04 * Math.sin(t * 37) + 0.03 * Math.sin(t * 23.3);
      // until it catches, the night has them; then the light pushes it back
      g.darkHole(s.x, s.y, (60 + 1500 * g.easeOut(lit)) * flick, 0.97 - 0.42 * lit);
      g.bloom(s.x, s.y, 260 * flick, 0.5 * lit);
      g.fill('#000', 1 - g.smooth(CUES.silence[1] - AT.flare - 0.1, CUES.silence[1] - AT.flare + 0.05, t));
    },
  },

  // 1:03 The dead: the beacon still blinking, the half-buried explorer.
  beacon: {
    async setup(D) { D.dusk(0.72); D.teleport(1430, 1600); D.warm(2); D.radioOff(); },
    cam(D) { return D.keys([[-0.5, 1192, 1590, 5.2], [3.5, 1197, 1594, 6.0]]); },
    gfx(g, t, D) {
      const d = D.state.distress, s = sc(d.x, d.y - 2), T = AT.beacon + t;
      g.rings(s.x, s.y, { period: 1.8, max: 300, n: 3, alpha: 0.9, width: 2, now: T });
      g.bloom(s.x, s.y, 60, 0.35 * Math.pow(Math.max(0, Math.sin(T * Math.PI / 0.9)), 6));
      const mk = g.env(t, 0.4, 0.6, 3.3, 0.5);
      g.morse(g.W / 2, g.H * 0.74, { start: CUES.beaconSos.start, unit: CUES.beaconSos.unit, now: T, size: 9, base: 0.15 * mk, alpha: mk * 0.9, glow: true, decay: 0.5 });
    },
  },

  wrap: {
    async setup(D) { D.dusk(0.58); D.teleport(1212, 1606); D.warm(2); D.radioOff(); D.state.give('sheet', 1); D.state.give('rope', 1); D.state.goal.wrap(); D.warm(0.6); },
    tick(D) { D.stop(); },
    cam(D) { return D.keys([[0, 1204, 1594, 5.4], [3.5, 1206, 1595, 6.0]]); },
  },

  // 1:09 Bringing them home, at dusk, the trench behind.
  drag: {
    async setup(D) { D.dusk(0.45); D.teleport(1200, 1600); D.warm(1); D.radioOff(); D.state.goal.drag(); D.walk(10, 1); D.warm(3); },
    tick(D) { D.walk(10, 1); D.state.warm(1); },
    cam(D) { return D.track(-14, -4, 6, 1.2); },
    gfx(g, t) {
      const k = g.ease((t - 0.6) / 1.4), o = g.ease((t - 3.2) / 0.6);
      g.title('BRING THEM HOME.', g.W / 2, g.H * 0.29, { size: 52, track: 0.2, k, out: o, scrim: 'snow', scrimA: 0.8 });
    },
  },

  // 1:13 Base camp again: two pairs of skis where there were four. A different coat.
  skis: {
    async setup(D) {
      D.state.party[0].alive = false; D.state.party[1].alive = false; D.state.member = 2;
      D.teleport(1360, 1562, Math.PI * 0.9); D.warm(2); D.radioOff();
    },
    cam(D) { return D.keys([[-0.5, 1342, 1556, 5.4], [3.5, 1345, 1556, 6.0]]); },
    gfx(g, t) {
      const k = g.ease((t - 0.7) / 1.3), o = g.ease((t - 2.9) / 0.6);
      g.title('TWO REMAIN.', g.W / 2, g.H * 0.29, { size: 50, track: 0.2, k, out: o, scrim: 'snow' });
    },
  },

  // 1:16 Night. The pup tent, glowing alone. Title.
  pup: {
    async setup(D) {
      D.teleport(1100, 1440); D.warm(1); D.radioOff();
      D.state.pitch(true); D.warm(0.5);
      D.p.tent('pup'); D.until(() => D.p.mode === 'inside', 12); D.warm(4);
    },
    update(D) {
      // a touch more of the lamp than the game gives it at this distance (its own light, via the game's lights)
      const p = D.state.pup?.pitched;
      if (p && D.state.lights) D.state.lights.push({ x: p.x, y: p.y - 3, r: 30, intensity: 0.35 });
    },
    cam(D) {
      const p = D.state.pup.pitched || { x: 1100, y: 1440 };
      return D.keys([[-0.5, p.x - 110, p.y - 45, 3.1], [13, p.x, p.y - 14, 6.0]], D.ease3);
    },
    gfx(g, t, D) {
      const p = D.state.pup.pitched;
      if (p) { const s = sc(p.x, p.y - 4); g.bloom(s.x, s.y, 120 + 40 * g.smooth(0, 12, t), 0.16 + 0.02 * Math.sin(t * 1.3)); }
      const k = g.ease((t - 6.0) / 2.2), y = g.H * 0.355;
      shade(g, g.W / 2, y + 30, 1300, 300, 0.42 * g.smooth(5.6, 7.5, t));
      g.title('NOT ALL WILL SURVIVE', g.W / 2, y, { size: 92, track: 0.12, k, color: '#f3efe6', glow: true });
      g.rule(g.W / 2, y + 66, 420, g.clamp((t - 7.4) / 1.2), { color: '#f3efe6', alpha: 0.6 });
      g.mono('PLAY NOW AT GAMEDESIGNERJOE.GITHUB.IO/NOT-ALL-SURVIVE', g.W / 2, y + 104, { size: 17, color: '#f3efe6', k: g.clamp((t - 7.9) / 1.2), align: 'center', alpha: 0.85, track: 0.3 });
      g.fill('#000', g.smooth(11.6, 13, t));
    },
  },
};

// --- helpers for the open --------------------------------------------------------------------------
function easeInOut(x) { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

// A cool lift of moonlight on the explorer at night, so the coat reads against the snow
function moon(g, D) {
  const s = sc(D.p.x, D.p.y - 8), z = D.state.cam.zoom;
  g.bloom(s.x, s.y, 16 * z, 0.2, '175,195,240');
}

// A soft dark breath behind pale type at night
function shade(g, x, y, w, h, a) {
  if (a <= 0) return;
  const c = g.ctx; c.save(); c.globalAlpha = a;
  const gr = c.createRadialGradient(x, y, 0, x, y, w / 2);
  gr.addColorStop(0, 'rgba(4,7,18,0.9)'); gr.addColorStop(0.55, 'rgba(4,7,18,0.45)'); gr.addColorStop(1, 'rgba(4,7,18,0)');
  c.translate(x, y); c.scale(1, h / w); c.translate(-x, -y);
  c.fillStyle = gr; c.fillRect(x - w / 2, y - w / 2, w, w);
  c.restore();
}

// A pale ellipse of snow behind type
function wash(g, x, y, w, h, a) {
  if (a <= 0) return;
  const c = g.ctx; c.save(); c.globalAlpha = a;
  const gr = c.createRadialGradient(x, y, 0, x, y, w / 2);
  gr.addColorStop(0, 'rgba(244,244,241,0.95)'); gr.addColorStop(0.5, 'rgba(244,244,241,0.6)'); gr.addColorStop(1, 'rgba(244,244,241,0)');
  c.translate(x, y); c.scale(1, h / w); c.translate(-x, -y);
  c.fillStyle = gr; c.fillRect(x - w / 2, y - w / 2, w, w);
  c.restore();
}

// White paper over the painting, let through by ink: near the drawn line first, feathered by noise.
let pc = null, pg = null, pd = null, noiseF = null;
const PW = 320, PH = 180;
function paperOver(g, pts, k) {
  if (k >= 1) return;
  if (!pc) {
    pc = document.createElement('canvas'); pc.width = PW; pc.height = PH; pg = pc.getContext('2d'); pd = pg.createImageData(PW, PH);
    noiseF = new Float32Array(PW * PH);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) noiseF[y * PW + x] = g.fbm(x * 0.045, y * 0.045, 31, 5);
  }
  const sx = PW / g.W, sy = PH / g.H;
  const P = pts.map(([x, y]) => [x * sx, y * sy]);
  const d = pd.data, th = k * 1.35 - 0.12;
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    let m = 1e9;
    for (let i = 1; i < P.length; i++) {
      const [ax, ay] = P[i - 1], [bx, by] = P[i];
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
      const ex = ax + dx * u - x, ey = ay + dy * u - y, e = ex * ex + ey * ey;
      if (e < m) m = e;
    }
    const dist = Math.sqrt(m) / PW;
    const f = 1 - (dist * 1.6 + noiseF[y * PW + x] * 0.55);
    const a = 1 - g.smooth(1 - th - 0.06, 1 - th + 0.06, f);
    const i = (y * PW + x) * 4;
    d[i] = 244; d[i + 1] = 244; d[i + 2] = 241; d[i + 3] = a * 255;
  }
  pg.putImageData(pd, 0, 0);
  const c = g.ctx; c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(pc, 0, 0, g.W, g.H); c.restore();
}
