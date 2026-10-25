// Debug info (Joe: "a debug toggle that shows me all the key information"): the gear menu's "Debug info: on/off"
// (remembered on the device; ?debuginfo forces it on) puts a panel of the live state top left, drawn with the
// sim's thoughts (ui/infopanel.js lays them out together, one hide / show tab): the body, the time and weather,
// the ground underfoot, the radio, the bear, the burden, the pack, and the last few things that happened in
// plain words (ui/eventwords.js). The events are kept even while it's off, so turning it on shows what just
// happened. state.debugInfo = { on, toggle(on), log }.
import { state } from '../state.js';
import { addPanel } from './infopanel.js';
import { describe } from './eventwords.js';
import { mask } from '../world/terrain.js';
import { WORLD, worldClock } from '../world/settings.js';
import { checksum, hex8 } from '../core/rng.js';
import '../net/identity.js';

const D = state.debugInfo = { on: false, log: [] };
try { D.on = state.params.has('debuginfo') || localStorage.getItem('naso_debugInfo') === '1'; } catch { D.on = state.params.has('debuginfo'); }
D.toggle = (on = !D.on) => { D.on = on; try { localStorage.setItem('naso_debugInfo', on ? '1' : '0'); } catch { /* private mode */ } };

const LOG_N = 8;
let day = 1, lastClock = 0;
const f2 = v => (v ?? 0).toFixed(2);
// the class map's checksum: two machines showing the same value stand on the same ground
let sumVer = -1, sum = '-';
function groundSum() {
  const m = mask();
  if (!m) return '-';
  if (m.version !== sumVer) { sumVer = m.version; sum = hex8(checksum(m.cls)); }
  return sum;
}
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function update() {
  const L = state.lighting;
  if ((L?.clock ?? 0) < lastClock - 1) day++;
  lastClock = L?.clock ?? 0;
  for (const e of state.events) {
    const t = describe(e);
    if (!t) continue;
    const last = D.log[D.log.length - 1];
    // the same again within a few seconds: counted, not repeated
    if (last && last.text === t && state.time - last.t < 8) { last.n++; last.t = state.time; continue; }
    D.log.push({ t: state.time, text: t, n: 1, day, clock: L?.clock ?? 0 });
    if (D.log.length > 40) D.log.shift();
  }
}

export function drawOverlay() {
  if (!D.on) return;
  const b = state.body, P = state.player, L = state.lighting || {}, W = state.weather || {}, R = state.radio;
  const lines = [];
  const clock = L.clock ?? 0, night = clock >= 180;
  lines.push({ t: `DEBUG  day ${day} · ${night ? "night" : "daytime"} ${mmss(night ? clock - 180 : clock)} · ${W.forecast?.label ?? "-"}`, c: "#fff" });
  const N = state.net, ago = N?.lastSync ? `${Math.round((Date.now() - N.lastSync) / 1000)} s ago` : 'never';
  lines.push({ t: `online: player ${N?.player.short ?? '-'}  world ${WORLD.name} 1:${WORLD.scale}  ${worldClock().label}  hex 0,0 ground ${groundSum()}  ${N?.connected ? 'connected' : 'not connected'}, synced ${ago}`, c: '#cfe3ff' });
  lines.push({ t: `weather: ${W.phase ?? '-'}  ${W.temp ?? '?'}°C  cold ${f2(W.cold)}  wind ${f2(state.wind?.speed)}+${f2(state.wind?.gust)}  white-out ${f2(W.whiteout)}`, c: '#ddd' });
  if (b) {
    lines.push({ t: `warmth ${f2(b.warmth)} (${b.rate * 60 >= 0 ? '+' : ''}${((b.rate || 0) * 60).toFixed(2)}/min)  energy ${f2(b.energy)}/${f2(b.max)} (${(b.drain > 0 ? '-' : '+')}${Math.abs((b.drain || 0) * 60).toFixed(2)}/min)  reserve ${f2(b.reserve)}`, c: b.warmth < 0.35 || b.energy < 0.15 ? '#ffb4a8' : '#ddd' });
    lines.push({ t: `food ${f2(b.food)} (-${((b.foodRate || 0) * 60).toFixed(3)}/min)  water ${f2(b.water)} (${(b.waterRate || 0) > 0 ? '-' : '+'}${Math.abs((b.waterRate || 0) * 60).toFixed(3)}/min)  wet ${f2(b.wet)}  rime ${f2(b.frozen)}${b.shock > 0.02 ? `  shock ${f2(b.shock)}` : ''}  injury ${f2(b.injury)}${b.splint ? ' (splinted)' : ''}  ${b.phase !== 'alive' ? b.phase : ''}`, c: b.food < 0.2 || b.water < 0.2 || b.wet > 0.3 ? '#ffb4a8' : '#ddd' });
  }
  const ice = P.iceStress || 0;
  const holes = (state.holes || []).filter(h => h.ro > 0).length, Th = state.thirst;
  lines.push({ t: `ground: ${P.terrain}${P.water?.level ? (P.water.level === 2 ? ' (deep water)' : ' (wading)') : ''}  ice stress ${f2(ice)}${holes ? `  holes ${holes}` : ''}  exposure ${f2(P.exposure)}  ${P.mode}${P.spent ? ' spent' : ''}${P.mode === 'inside' ? ` (${P.shelter?.kind ?? 'camp'})` : ''}${Th?.mirage > 0.02 ? `  mirage ${f2(Th.mirage)}` : ''}${Th?.man ? '  third man' : ''}`, c: ice > 0.4 ? '#ffb4a8' : '#ddd' });
  const gap = R?.on && R.near > 0 ? (0.25 + 2.95 * Math.pow(1 - R.near, 1.4)).toFixed(2) + ' s' : '-';
  lines.push({ t: `radio: ${R?.on ? 'on' : 'off'}  near ${f2(R?.near)}  blip every ${gap}${state.distress?.found ? '  (found)' : ''}`, c: '#ddd' });
  const md = state.bear?.mood?.();
  const cart = (state.pack?.slots || []).reduce((a, q) => a + (q && q.id === 'cartridges' ? q.n : 0), 0), carc = (state.hunt?.carcasses || []).filter(c => !c.done).map(c => c.kind).join(' ');
  lines.push({ t: (md ? `bear: ${md.st}  aggro ${f2(md.aggro)} (${md.rate >= 0 ? '+' : ''}${(md.rate * 60).toFixed(2)}/min)  ${Math.round(md.pd)} px  hp ${md.hp}` : 'bear: -') + `  rifle ${state.hunt?.aim ? 'up' : 'down'}, ${cart} cartridges${carc ? `  carcasses: ${carc}` : ''}`, c: md && md.pd < 110 && md.aggro > 0.3 ? '#ffb4a8' : '#ddd' });
  const Bu = state.burden;
  lines.push({ t: `body: ${state.distress?.wrapped ? 'wrapped' : state.distress?.found ? 'found' : 'lost'}  burden ${Bu?.mode || '-'}${Bu?.job ? ` (${Bu.job.kind})` : ''}${Bu?.home ? '  HOME' : ''}  party ${(state.party || []).filter(m => m.alive).length}/${state.party?.length ?? 1}`, c: '#ddd' });
  const pk = (state.pack?.slots || []).filter(Boolean).map(q => q.id + (q.n > 1 ? q.n : '') + (q.drinks !== undefined ? `(${q.drinks})` : '') + (q.worn ? '*' : ''));
  lines.push({ t: `pack: ${pk.join(' ') || 'empty'} (${(state.pack?.slots.length || 10) - pk.length} free)`, c: '#ddd' });
  const u = state.pup, pupT = !u ? '-' : u.job ? `${u.job.kind} ${(u.job.prog ?? 0).toFixed(1)}/3${u.job.coll ? ' COLLAPSE' : ''}${u.job.kind === 'pitch' ? ` try ${u.job.tries}` : ''}` : u.pitched ? `pitched at ${Math.round(u.pitched.x)},${Math.round(u.pitched.y)}` : state.pack?.slots.some(q => q && q.id === 'puptent') ? 'in the pack' : state.sled?.slots.some(q => q && q.id === 'puptent') ? 'on the sled' : 'elsewhere';
  const sl = (state.sled?.slots || []).filter(Boolean).map(q => q.id + (q.n > 1 ? q.n : ''));
  lines.push({ t: `pup tent: ${pupT}   sled: ${sl.join(' ') || 'empty'}`, c: '#bbb' });
  const recent = D.log.slice(-LOG_N);
  if (recent.length) lines.push({ t: 'lately:', c: '#fff' });
  for (const e of recent) lines.push({ t: ` ${mmss(state.time - e.t)} ago  ${e.text}${e.n > 1 ? ` ×${e.n}` : ''}`, c: '#e8e8e8' });
  addPanel(lines);
}
