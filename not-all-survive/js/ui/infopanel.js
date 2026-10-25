// The dev tools' text panels over the game: the sim's thoughts (sim/sim.js) and the debug info (ui/debug.js).
// Each calls addPanel(lines) from its drawOverlay every frame it wants to show; this module comes last in the
// draw order, lays them out together top left (side by side on a wide screen, one under the other on a narrow
// one) and draws them, with one "hide" button under them that folds them all into a small "show" tab (H too),
// remembered on the device. A press on that button is the UI's (state.uiPress is wrapped here), so it never
// walks, taps the world or starts the touch stick.
// lines: [{ t: text, c: colour? }]; long lines wrap.
import { state } from '../state.js';

export const PANELS = { hidden: false, box: null, shown: false };
try { PANELS.hidden = localStorage.getItem('nas_infoHidden') === '1'; } catch { PANELS.hidden = false; }
export function setHidden(h) {
  PANELS.hidden = h;
  try { localStorage.setItem('nas_infoHidden', h ? '1' : '0'); } catch { /* private mode */ }
}
const queue = [];
export function addPanel(lines) { queue.push(lines); }

const FS = 12, LH = 15, PAD = 8, FONT = `${FS}px ui-monospace, Menlo, Consolas, monospace`;

export function init() {
  addEventListener('keydown', e => { if (e.code === 'KeyH' && !e.repeat && PANELS.shown) setHidden(!PANELS.hidden); });
  const press0 = state.uiPress, release0 = state.uiRelease;
  let mine = false;
  state.uiPress = (sx, sy) => {
    const b = PANELS.box;
    if (b && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) { mine = true; setHidden(!PANELS.hidden); return true; }
    return press0 ? press0(sx, sy) : false;
  };
  state.uiRelease = () => { if (mine) { mine = false; return; } release0?.(); };
}

function button(ctx, x, y, label) {
  ctx.font = FONT;
  const w = ctx.measureText(label).width + 18, h = 24;
  ctx.fillStyle = 'rgba(20,22,26,0.62)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#fff'; ctx.fillText(label, x + 9, y + 16);
  PANELS.box = { x: x - 6, y: y - 6, w: w + 12, h: h + 12 };   // (a finger's worth round it)
  return w;
}
function wrap(ctx, lines, w) {
  const out = [];
  for (const l of lines) {
    let s = l.t;
    while (ctx.measureText(s).width > w - PAD * 2 && s.length > 10) {
      let k = s.length;
      while (k > 10 && ctx.measureText(s.slice(0, k)).width > w - PAD * 2) k--;
      const sp = s.lastIndexOf(' ', k);
      const cut = sp > 20 ? sp : k;
      out.push({ t: s.slice(0, cut), c: l.c });
      s = '   ' + s.slice(cut).trimStart();
    }
    out.push({ t: s, c: l.c });
  }
  return out;
}

export function drawOverlay(ctx) {
  const list = queue.splice(0);
  PANELS.shown = list.length > 0;
  if (!list.length) { PANELS.box = null; return; }
  const { dpr, w: W } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (PANELS.hidden) { button(ctx, 8, 8, 'info: show'); return; }
  ctx.font = FONT;
  // wide: the first top left, the second against the right edge under the gear (the middle, where the explorer
  // is, stays clear); narrow: one under the other
  const pw = Math.min(440, W - 16), side = W >= pw * 2 + 220;
  let y = 8, bottom = 8;
  list.forEach((lines, k) => {
    const x = side && k > 0 ? W - pw - 8 : 8, top = side && k > 0 ? 46 : y;
    const out = wrap(ctx, lines, pw), h = out.length * LH + PAD * 2 - 3;
    ctx.fillStyle = 'rgba(20,22,26,0.62)';
    ctx.fillRect(x, top, pw, h);
    out.forEach((l, i) => { ctx.fillStyle = l.c || '#e8e8e8'; ctx.fillText(l.t, x + PAD, top + PAD + 10 + i * LH); });
    if (!(side && k > 0)) { y = top + h + 6; bottom = top + h; }
  });
  const bw = button(ctx, 8, bottom + 4, 'hide');
  ctx.font = `${FS - 1}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillStyle = 'rgba(20,22,26,0.55)';
  ctx.fillText(state.sim?.on ? '+/- speed  H hide' : 'H hide', 8 + bw + 10, bottom + 20);
}
