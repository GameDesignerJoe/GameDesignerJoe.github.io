// The sim's recording of a run (js/sim/sim.js), for the replay player (not-all-survive/replay/): compact, rounded
// and only when something changed, so an hour of play stays a few hundred KB. Times are game seconds since the
// run began, in tenths (integers). Positions are world px (the painted map's pixels), rounded.
//   pos     [t, x, y, facing°]     every 0.25 s while moving (and every 5 s standing)
//   mode    [t, mode]              the explorer's mode (walk, climb, inside, ...) when it changes
//   body    [t, warmth, energy, cap, reserve, food, water, wet, injury]   x100, every 1 s
//   wx      [t, clock, phase, wind x100, temp, whiteout x100]   every 5 s
//   bear    [t, x, y, state]       every 1 s while it moves or changes
//   bundle  [t, hx, hy, fx, fy, mode]   the wrapped body, every 1 s while it moves
//   pup     [t, x, y] | [t, null]  the pup tent pitched / struck
//   ev      [t, type, text, x, y]  the game's events in plain words (ui/eventwords.js)
//   marks   { tent, sled, sos }    where camp and the lost explorer are (the sos only for drawing: the sim never reads it)
import { state, MAP_W, MAP_H } from '../state.js';
import { TENT, SLED } from '../actors/camp.js';
import { describe } from '../ui/eventwords.js';

const r1 = v => Math.round(v);
const r100 = v => Math.round((v ?? 0) * 100);
let T = null, t0 = 0, next = { pos: 0, body: 0, wx: 0, bear: 0, bundle: 0, still: 0 }, last = {};

export function start() {
  const D = state.distress;
  t0 = state.time;
  next = { pos: 0, body: 0, wx: 0, bear: 0, bundle: 0, still: 0 };
  last = {};
  T = {
    v: 1, map: { w: MAP_W, h: MAP_H, image: 'assets/map-sharp.webp' }, started: new Date().toISOString(), params: location.search,
    forecast: state.weather?.forecast?.label || '-', party: (state.party || []).map(m => m.name),
    marks: { tent: { x: TENT.x, y: TENT.y }, sled: { x: SLED.x, y: SLED.y }, sos: D?.ready ? { x: r1(D.x), y: r1(D.y) } : null },
    pos: [], mode: [], body: [], wx: [], bear: [], bundle: [], pup: [], ev: [],
  };
  return T;
}
export const trace = () => T;

export function record() {
  if (!T) return;
  const t = state.time - t0, ti = Math.round(t * 10), P = state.player;
  // the explorer
  if (t >= next.pos) {
    next.pos = t + 0.25;
    const f = Math.round(((P.facing * 180 / Math.PI) % 360 + 360) % 360);
    const moved = !last.pos || Math.abs(P.x - last.pos[1]) >= 1 || Math.abs(P.y - last.pos[2]) >= 1 || Math.abs(f - last.pos[3]) > 20;
    if (moved || t >= next.still) { last.pos = [ti, r1(P.x), r1(P.y), f]; T.pos.push(last.pos); next.still = t + 5; }
  }
  if (P.mode !== last.mode) { last.mode = P.mode; T.mode.push([ti, P.mode]); }
  // the body
  const b = state.body;
  if (b && t >= next.body) { next.body = t + 1; T.body.push([ti, r100(b.warmth), r100(b.energy), r100(b.max), r100(b.reserve), r100(b.food), r100(b.water), r100(b.wet), r100(b.injury)]); }
  // the weather and the clock
  if (t >= next.wx) { next.wx = t + 5; const W = state.weather; T.wx.push([ti, r1(state.lighting?.clock ?? 0), W?.phase ?? '-', r100(state.wind?.speed), W?.temp ?? 0, r100(W?.whiteout)]); }
  // the bear
  const br = state.bear;
  if (br && !br.gone && t >= next.bear) {
    next.bear = t + 1;
    const lb = last.bear;
    if (!lb || Math.abs(br.x - lb[1]) > 2 || Math.abs(br.y - lb[2]) > 2 || br.st !== lb[3]) { last.bear = [ti, r1(br.x), r1(br.y), br.dead ? 'dead' : br.st]; T.bear.push(last.bear); }
  }
  // the wrapped body
  const bu = state.burden?.bundle;
  if (bu && t >= next.bundle) {
    next.bundle = t + 1;
    const m = state.burden.mode || '-', lb = last.bundle;
    if (!lb || Math.abs(bu.hx - lb[1]) > 1 || Math.abs(bu.hy - lb[2]) > 1 || m !== lb[5]) { last.bundle = [ti, r1(bu.hx), r1(bu.hy), r1(bu.fx), r1(bu.fy), m]; T.bundle.push(last.bundle); }
  }
  // the pup tent
  const pp = state.pup?.pitched || null, key = pp ? `${r1(pp.x)},${r1(pp.y)}` : null;
  if (key !== (last.pup ?? null)) { last.pup = key; T.pup.push(pp ? [ti, r1(pp.x), r1(pp.y)] : [ti, null]); }
  // the events, in words
  for (const e of state.events) {
    const w = describe(e);
    if (!w) continue;
    const le = T.ev[T.ev.length - 1];
    if (le && le[2] === w && ti - le[0] < 50) continue;   // (the same again within 5 s)
    T.ev.push([ti, e.type, w, r1(e.x ?? P.x), r1(e.y ?? P.y)]);
  }
}
