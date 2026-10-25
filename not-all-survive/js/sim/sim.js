// "Watch it play" (Joe): ?sim plays the game by itself, so it can be watched and the numbers tuned.
// An explorer that only does what a player can: walks by the input (state.demoInput), presses the
// screen where a player would (the pack, the sled, a body, the rows, the tent menu), and knows only
// what a player knows (the radio's blips, the ground, its own body, the clock, the weather, the bear
// when it's in view). It leaves the tent, hears the beacon, packs at the sled, hunts the signal hot
// and cold, decides as it goes (eat? snowshoes? climb or go round? camp or go on? the bear? carry or
// drag?) and brings the lost explorer home. Every decision is logged with its reason.
//
//   ?sim            on (the gear menu's "Watch it play" turns it on too)
//   ?sim=loop       when a run ends (home, or the whole party dead, or SIM.maxRunMin), start another
//   ?speed=4        how fast (also the + / - keys); H hides the thoughts panel
// The numbers it decides by: js/sim/config.js (SIM). The log: state.sim.log (each decision), and
// state.sim.runs (a summary of each run, kept across ?sim=loop reloads in sessionStorage); the gear
// menu's "Copy sim log" / "Download sim log" give them with the recorded trace (trace.js) for replay/.
//
// Files: sim.js (this: the loop, what to do next, the log and the panel), brain.js (the mission and the
// needs), hands.js (walking, presses, climbing), nav.js (the map grid and the path planner), trace.js
// (the recording), config.js. The panel is drawn by ui/infopanel.js, with the debug info's.
import { state } from '../state.js';
import { TENT } from '../actors/camp.js';
import { worldToScreenUI } from '../camera.js';
import { count } from '../items.js';
import * as TR from './trace.js';
import * as T from '../world/terrain.js';
import * as N from './nav.js';
import { SIM, S } from './config.js';
import { MAP_W, MAP_H } from '../state.js';
import { addPanel, PANELS } from '../ui/infopanel.js';
import * as H from './hands.js';
import * as Br from './brain.js';

const P = state.player;
const RUNS_KEY = 'nas_sim_runs';
const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
state.sim = S;
S.on = state.params.has('sim');   // dormant otherwise: the gear menu's "Watch it play" turns it on and off live (S.toggle)
S.loop = state.params.get('sim') === 'loop';
try { S.runs = JSON.parse(sessionStorage.getItem(RUNS_KEY) || '[]'); } catch { S.runs = []; }
// the log (decisions, the run summaries) and the recorded trace of the run (sim/trace.js): Copy / Download sim log in
// the gear menu; replay/index.html plays it. The run before (kept across ?sim=loop reloads) goes too.
S.dump = () => {
  let previous = null;
  let kept = [];
  try { kept = JSON.parse(sessionStorage.getItem(TRACE_KEY) || '[]'); } catch { kept = []; }
  if (!Array.isArray(kept)) kept = [kept];
  previous = kept.filter(k => k && !(k.stats?.run === S.stats?.run && k.stats?.t0 === S.stats?.t0)).pop() || null;   // (not this one)
  return JSON.stringify({ v: 1, runs: S.runs, current: S.stats ? { stats: S.stats, summary: S.summary || null, log: S.log, trace: TR.trace() } : null, previous });
};
const TRACE_KEY = 'nas_sim_lastTrace';
S.samples = [];
S.cool = {};

let begun = false, cur = null, thinkT = 0, sampleT = 0, last = null, lastClock = 0, finished = false;

const LEARN_KEY = 'nas_sim_learned';
function newMemory() {
  let learned = [];
  if (SIM.rememberLearned) { try { learned = JSON.parse(sessionStorage.getItem(LEARN_KEY) || '[]'); } catch { learned = []; } }
  return { intro: false, packedFor: -1, needKit: false, heading: null, best: null, legs: 0, zone: null, body: null, learned: new Set(learned), modeSaid: null,
    mode: 'hot', readings: [], legEnds: [], est: null };
}
S.saveLearned = () => { if (SIM.rememberLearned) try { sessionStorage.setItem(LEARN_KEY, JSON.stringify([...S.mem.learned])); } catch { /* private mode */ } };
function newStats() {
  return {
    run: S.runs.length + 1, t0: state.time, forecast: state.weather?.forecast?.label || '-', sos: state.params.get('sos') || 'random',
    found: null, wrapped: null, home: null, triangulated: null, deaths: [], rations: 0, drinks: 0, snow: 0, flares: 0, shots: 0, climbs: 0, climbsChosen: 0,
    climbRefused: 0, falls: 0, detours: 0, pitches: 0, sleeps: 0, kitTrips: 0, stuck: 0, noPath: 0, decisions: 0, walked: 0,
    sledFood0: count(state.sled, 'food') + count(state.pack, 'food'),
  };
}

export function init() {
  addEventListener('keydown', e => {
    if (!S.on) return;
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') stepSpeed(1);
    else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') stepSpeed(-1);
  });
  // (the panel and its hide / show tab, and H: ui/infopanel.js)
}
// Live on / off (the gear menu). Off: the task dropped, the input handed back (demoInput cleared), the pace back
// to normal. On: a fresh run from wherever the game is.
let speedBefore = 1;
S.toggle = on => {
  if (on === S.on) return;
  const q = new URLSearchParams(location.search);
  if (on) {
    S.on = true; begun = false; finished = false; cur = null; S.recent = []; S.log = []; S.summary = null;
    speedBefore = state.timeScale;
    if (state.timeScale === 1) state.timeScale = 4;
    q.set('sim', S.loop ? 'loop' : '');
  } else {
    abort();
    if (state.compass && state.compass.phase !== 'idle') { state.uiPress?.(14, state.view.h - 14); state.uiRelease?.(); }
    state.demoInput = null;
    S.on = false; S.path = null; S.est = null;
    state.timeScale = speedBefore === state.timeScale ? 1 : speedBefore;
    q.delete('sim');
  }
  try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString().replace(/=(&|$)/g, '$1') : '') + location.hash); } catch { /* file:// */ }
};
function stepSpeed(d) {
  const L = SIM.speeds, cur = state.timeScale;
  let i = L.findIndex(v => v >= cur - 1e-6);
  if (i < 0) i = L.length - 1;
  if (L[i] !== cur && d < 0) i++;   // (between two: down goes to the lower)
  state.timeScale = L[Math.max(0, Math.min(L.length - 1, i + d))];
}

// --- the loop ---------------------------------------------------------------------------------------
export function update(dt) {
  if (!S.on) return;
  if (finished) { H.stop(); return; }
  if (!begun) {
    if ((!state.begun && !state.params.has('autostart')) || !state.body || !state.distress?.ready || !T.mask()) return;
    if (!N.isReady() && !N.build()) return;
    begun = true;
    S.mem = newMemory();
    { const c = SIM.memory.cell, w = Math.ceil(MAP_W / c), h = Math.ceil(MAP_H / c); S.visit = { c, w, h, a: new Uint8Array(w * h), last: -1 }; }
    S.est = null;
    S.stats = newStats();
    TR.start();
    S.day = 1; lastClock = state.lighting?.clock ?? 0;
    last = { x: P.x, y: P.y };
    state.demoInput = { x: 0, y: 0 };
    // Joe: "Character leaves tent": the first member crawls out of base camp's tent
    const fresh = state.time < 12;
    if (fresh && state.member === 0 && P.mode === 'walk') P.respawn?.(false);
    if (!fresh) S.mem.intro = true;   // (turned on mid-game: no setting-out beat)
    H.note('Start', `run ${S.stats.run}: ${state.party?.[state.member]?.name ?? 'the explorer'} sets out; today: ${S.stats.forecast}${S.mem.learned.size ? `; knows: ${[...S.mem.learned].join(', ')} (from a run before)` : ''}`);
  }
  const L = state.lighting;
  if ((L?.clock ?? 0) < lastClock - 1) S.day++;
  lastClock = L?.clock ?? 0;

  TR.record();   // (before the events are handled: a run's last event, home or a death, ends it there)
  handleEvents();
  if (finished) return;
  // map memory: a visit counted each time they step into a cell
  if (S.visit && P.mode === 'walk') {
    const V = S.visit, i = Math.floor(P.x / V.c), j = Math.floor(P.y / V.c), k = j * V.w + i;
    if (k !== V.last && i >= 0 && j >= 0 && i < V.w && j < V.h) { V.last = k; if (V.a[k] < 250) V.a[k]++; }
  }
  // distance walked
  if (P.mode === 'walk' || P.mode === 'approach') S.stats.walked += hyp(P, last);
  last = { x: P.x, y: P.y };
  // the ear: a listen every SIM.radio.every s, the best spot so far
  sampleT -= dt;
  if (sampleT <= 0) {
    sampleT = SIM.radio.every;
    const n = Br.listen();
    if (n !== null && P.mode === 'walk') {
      S.samples.push({ t: state.time, x: P.x, y: P.y, n });
      if (S.samples.length > 300) S.samples.shift();
      const M = S.mem;
      // a reading kept for triangulating, every SIM.tri.spacing px of fresh ground
      if (!M.readings.some(r => Math.hypot(r.x - P.x, r.y - P.y) < SIM.tri.spacing)) { M.readings.push({ x: P.x, y: P.y, n }); if (M.readings.length > 80) M.readings.shift(); }
      if (!M.best || n > M.best.n) { if (!M.best || n > M.best.n + 0.01) { M.bestT = state.time; M.boldSaid = false; } M.best = { x: P.x, y: P.y, n, h: M.heading ?? 0 }; }
      S.best = M.best;
    }
  }
  // a bear in view: remembered (a wide berth on the paths after)
  const bv = Br.bearVisible();
  if (bv) {
    if (!S.bearSeen || state.time - S.bearSeen.t > 60) H.note('Bear', `seen, ${Math.round(hyp(bv, P))} px off (${bv.st}): give it a wide berth`);
    S.bearSeen = { x: bv.x, y: bv.y, t: state.time };
  }
  if (state.time - S.stats.t0 > SIM.maxRunMin * 60) { finish('timeout'); return; }

  trackUI();
  // the watchdog: no real headway for a long while (not sheltering): drop what it's doing and start afresh
  if (!S.wd || hyp(P, S.wd) > 30 || P.mode === 'inside' || state.body?.phase !== 'alive' || state.burden?.job || state.pup?.job) S.wd = { x: P.x, y: P.y, t: state.time };
  else if (state.time - S.wd.t > SIM.stuck.watchdog) {
    H.note('Stuck', `no headway for ${SIM.stuck.watchdog} s (${cur?.key ?? '-'}): start afresh`);
    S.stats.stuck++;
    abort(); S.mem.leg = null; S.mem.zone = null; S.wd = { x: P.x, y: P.y, t: state.time };
    if (S.mem.heading !== null) S.mem.heading += Math.PI * (0.5 + Math.random());
  }
  thinkT -= dt;
  if (thinkT <= 0) { thinkT = SIM.think; think(); }
  if (cur) {
    try {
      const r = cur.gen.next();
      if (r.done) cur = null;
    } catch (e) {
      console.error('[sim] task failed:', cur.key, e);
      H.note('Error', `${cur.key}: ${e.message}`);
      cur = null; H.stop();
    }
  } else H.stop();
}

function handleEvents() {
  const st = S.stats;
  for (const e of state.events) {
    switch (e.type) {
      case 'death': {
        const b = state.body, m = state.party?.[e.member];
        const d = { member: e.member, name: m?.name, cause: e.cause, t: +(state.time - st.t0).toFixed(1), x: Math.round(e.x), y: Math.round(e.y),
          warmth: +b.warmth.toFixed(2), energy: +b.energy.toFixed(2), food: +b.food.toFixed(2), water: +b.water.toFixed(2), wet: +b.wet.toFixed(2), injury: +b.injury.toFixed(2), doing: cur?.key || '-' };
        st.deaths.push(d);
        H.note('Death', `${m?.name}: ${e.cause} (warmth ${d.warmth}, energy ${d.energy}, food ${d.food}, wet ${d.wet}) while ${d.doing}`);
        abort();
        break;
      }
      case 'handover':
        S.mem.packedFor = -1;
        S.mem.zone = null;
        S.mem.modeSaid = null;
        break;
      case 'expedition': finish((state.party?.length || 1) > 1 ? 'all dead' : 'died'); return;   // (one life by default: a death ends it)
      case 'goal':
        if (e.stage === 'home') { st.home = state.time - st.t0; finish('home'); return; }
        break;
      case 'distress':
        if (e.stage === 'found') { st.found = state.time - st.t0; H.note('Found', `the lost explorer, ${H.fmtTime(st.found)} in`); }
        break;
      case 'refuse': S.lastRefuse = { t: state.time, reason: e.reason }; break;
      case 'gear':
        if (e.item === 'snowshoes' && !e.on) S.shoesOffAt = state.time;
        if (e.auto && !e.on && e.item === 'snowshoes') H.note('Snowshoes', P.mode === 'climb' ? 'off by themselves for the climb' : P.mode === 'approach' ? 'off by themselves (walking a route)' : 'off by themselves on the ice');
        break;
      case 'shore': if (state.demoInput && (state.demoInput.x || state.demoInput.y)) S.shore = 1; break;
      case 'eat': if (e.stage === 'done') st.rations++; break;
      case 'drink': if (e.stage === 'done') st.drinks++; break;
      case 'snowEat': if (e.stage === 'done') st.snow++; break;
      case 'flare': if (e.stage === 'strike') st.flares++; break;
      case 'rifle': if (e.stage === 'shot') { st.shots++; H.note('Rifle', e.hit ? `hit (${e.kind}, ${e.d} px, chance ${e.p})` : `missed (${e.d} px, chance ${e.p})`); } break;
      case 'pitch': if (e.stage === 'done') S.lastPitch = { tries: e.tries }; break;
      case 'impact': H.note('Fall', `off the wall from ${Math.round(e.height)} px${e.fatal ? ': fatal' : ''}`); break;
      case 'breakthrough': H.note('Ice', 'through the ice!'); break;
      default: break;
    }
  }
}
function abort() {
  if (cur) { try { cur.gen.return(); } catch { /* done */ } }
  cur = null;
  H.release();
  H.stop();
}

// --- what to do now ---------------------------------------------------------------------------------
// The most pressing need wins; the errand (the mission) is what's left. A task in a delicate moment
// (eating, wrapping, pitching, on a wall, crawling into a tent) isn't broken into, bar the water.
const BUSY = new Set(['eat', 'drink', 'splint', 'snow']);
let uiSince = 0;
function trackUI() { const ph = state.compass?.phase; if (!ph || ph === 'idle' || ph === 'out') uiSince = state.time; }
function delicate() {
  const ph = state.compass?.phase;
  // (a menu left open by a task that was broken into doesn't hold everything up for long)
  return (state.time - uiSince > 0 && state.time - uiSince < (ph === 'transfer' ? 40 : 10) && !BUSY.has(ph)) || BUSY.has(ph) || !!state.burden?.job || !!state.pup?.job || P.mode === 'climb' || P.mode === 'approach'
    || P.mode === 'tent-in' || P.mode === 'tent-out' || state.body?.phase === 'sleep';
}
function want() {
  const b = state.body, M = S.mem, now = state.time, cool = k => (S.cool[k] || 0) > now;
  if (b?.phase === 'sleep') return cur ? { key: cur.key, prio: cur.prio } : null;   // asleep in a tent: let it be
  if (!b || b.phase !== 'alive' || ['dead', 'collapse', 'gone', 'sink'].includes(P.mode)) return null;
  if (state.burden?.home) return { key: 'mission', prio: 1, make: () => Br.mission() };
  // in the sea or a hole in the ice: out, now
  if (P.water?.level || P.mode === 'swim' || P.mode === 'crawlout') return { key: 'water', prio: 100, make: escapeWater };
  if ((P.terrain === 'thin' || P.terrain === 'ice') && (P.iceStress || 0) > 0.3) return { key: 'ice', prio: 95, make: offIce };
  if (Br.bearThreat()) return { key: 'bear', prio: 90, make: () => Br.bear() };
  if (P.mode === 'inside') return { key: 'shelter', prio: 70, make: () => Br.shelter('in the tent') };
  // shelter: a storm, the cold, the night
  const shelterWhy = !cool('shelter') && shelterNeed();
  if (shelterWhy) return { key: 'shelter', prio: 70, make: () => Br.shelter(shelterWhy) };
  const busyOut = P.mode !== 'walk' && P.mode !== 'cower';
  if (!busyOut) {
    if (b.injury > SIM.eat.splint && !b.splint && H.inPack('splint') && !cool('splint')) return { key: 'splint', prio: 62, make: () => Br.splint() };
    if (b.food < SIM.eat.food && (H.inPack('food') || H.inPack('meat')) && b.food < 0.95 && !cool('eat') && P.terrain !== 'water') return { key: 'eat', prio: 60, make: () => { S.cool.eat = now + 12; return Br.eat(); } };
    if (b.water < SIM.eat.water && !cool('drink')) return { key: 'drink', prio: 60, make: () => { S.cool.drink = now + 10; return Br.drink(); } };
    // out of food with rations at the sled: back for them
    if (b.food < SIM.eat.resupply && !H.inPack('food') && !H.inPack('meat') && count(state.sled, 'food') > 0 && !M.resupply && !state.burden?.mode && !cool('resupply')) {
      M.resupply = true; S.cool.resupply = now + 120;
      H.note('Food', `food ${b.food.toFixed(2)} and none in the pack: back to the sled (${count(state.sled, 'food')} rations there, ${Math.round(hyp(P, TENT))} px)`);
    }
    const low = state.burden?.mode ? SIM.rest.burdenBelow : SIM.rest.below;
    if (b.energy < low && !cool('rest') && !stormyNow()) return { key: 'rest', prio: 50, make: () => Br.rest(`energy ${b.energy.toFixed(2)} < ${low}`) };
    const sh = !cool('shoes') && shoesNeed();
    if (sh) return { key: 'shoes', prio: 40, make: () => Br.shoes(sh.on, sh.why) };
  }
  return { key: 'mission', prio: 1, make: () => Br.mission() };
}
const stormyNow = () => Br.stormy();
// the night, a storm, the cold: is it time to get under canvas? (a reason, or '')
let nightSaid = -1, nightGoOn = false, nightCheck = 0;
function shelterNeed() {
  const b = state.body, L = state.lighting, clock = L?.clock ?? 0, C = SIM.camp;
  if (state.burden?.home) return '';
  if (Br.stormy()) return `a storm (${state.weather.phase}, wind ${state.wind.speed.toFixed(2)})`;
  // the wind building late in the day: a storm's coming; under canvas before it hits (pitching in one takes many tries)
  if (state.weather.phase === 'build' && clock >= C.buildFrom) return `the wind's building at dusk (${state.wind.speed.toFixed(2)}): a storm's coming`;
  if (b.warmth < C.shelterWarmth) return `cold: warmth ${b.warmth.toFixed(2)} < ${C.shelterWarmth}`;
  if ((b.wet || 0) > C.wetShelter) return `soaked: wet ${b.wet.toFixed(2)} (x4 the cold): get dry under canvas`;
  if (clock >= C.dusk && L.mode === 'cycle') {
    const goOn = b.warmth >= C.goOnWarmth && (b.max ?? 1) >= C.goOnMax;
    if (nightSaid !== S.day || state.time > nightCheck) {
      const first = nightSaid !== S.day;
      nightSaid = S.day; nightCheck = state.time + 30;
      if (first || goOn !== nightGoOn) {
        H.note('Night', goOn ? `keep going: warmth ${b.warmth.toFixed(2)}, energy cap ${(b.max ?? 1).toFixed(2)}, calm`
          : `make camp: warmth ${b.warmth.toFixed(2)}${b.warmth < C.goOnWarmth ? ` < ${C.goOnWarmth}` : ''}, energy cap ${(b.max ?? 1).toFixed(2)}${(b.max ?? 1) < C.goOnMax ? ` < ${C.goOnMax}` : ''}`);
      }
      nightGoOn = goOn;
    }
    if (!nightGoOn) return `night (warmth ${b.warmth.toFixed(2)}, energy cap ${(b.max ?? 1).toFixed(2)})`;
  }
  return '';
}
// snowshoes: on for deep snow ahead, off for ice just ahead (on ice the game takes them off anyway)
function shoesNeed() {
  // (carrying the body the pack only opens to eat and drink: no straps)
  if (!H.inPack('snowshoes') || state.burden?.job || state.burden?.mode === 'carry' || P.mode !== 'walk') return null;
  const worn = !!P.gear?.snowshoes;
  const pts = S.path;
  let ahead = null, ice = null;
  if (pts && pts.length > 1) {
    let i0 = 0, bd = 1e9;
    pts.forEach((p, i) => { const d = hyp(p, P); if (d < bd) { bd = d; i0 = i; } });
    if (bd < 20) { ahead = N.pathShares(pts, i0, SIM.shoes.look, P); ice = N.pathShares(pts, i0, SIM.shoes.iceLook, P); }
  }
  if (!ahead) return null;
  // a real crossing of ice just ahead: off by hand; a patch, the game takes them off at the edge itself
  const iceAhead = (ice.ice + ice.thin) > 0.5, iceSoon = (ahead.ice + ahead.thin) > 0.05 || P.terrain === 'ice';
  const lately = state.time - (S.shoesOffAt || -99) < SIM.shoes.backOn;
  if (!worn && !iceSoon && (ahead.deep >= SIM.shoes.deepAhead || P.terrain === 'deep')) return { on: true, why: P.terrain === 'deep' && ahead.deep < SIM.shoes.deepAhead ? 'wading deep snow' : `deep snow ${Math.round(ahead.deep * 100)}% of the next ${SIM.shoes.look} px` };
  if (!worn && !iceSoon && !lately && ahead.snow + ahead.deep >= SIM.shoes.snowAhead) return { on: true, why: `snow ${Math.round((ahead.snow + ahead.deep) * 100)}% of the next ${SIM.shoes.look} px (quicker, less tiring)` };
  if (worn && iceAhead && P.terrain !== 'ice') return { on: false, why: 'ice just ahead' };
  return null;
}
function think() {
  const w = want();
  if (!w) { if (cur && cur.key !== 'water') abort(); return; }
  if (cur && cur.key === w.key) return;
  if (cur) {
    if (w.prio <= cur.prio) return;
    if (delicate() && w.prio < 100) return;
    abort();
  }
  cur = { key: w.key, prio: w.prio, gen: w.make() };
}
function* escapeWater() {
  H.goal('in the water: out!');
  H.note('Water', P.mode === 'swim' ? 'out of my depth: swim for the edge' : 'in the water: back to dry land');
  let tapT = 0;
  while (P.water?.level || P.mode === 'swim' || P.mode === 'crawlout') {
    const land = N.nearestFree(P.x, P.y, 10);
    if (land && P.mode !== 'crawlout') {
      H.steer(land.x - P.x, land.y - P.y);
      if (state.time > tapT) { H.worldTap(land.x, land.y); tapT = state.time + 0.8; }   // a tap is one heave at a hole's edge
    } else H.stop();
    yield;
  }
  H.stop();
}
function* offIce() {
  H.note('Ice', `it's cracking (stress ${(P.iceStress || 0).toFixed(2)}): off it, the way I came`);
  H.goal('off the ice');
  const firm = N.nearestFree(P.x, P.y, 14);
  let best = null, bd = 1e9;
  for (let r = 6; r <= 90; r += 6) for (let a = 0; a < 16; a++) {
    const x = P.x + Math.cos(a / 16 * 6.283) * r, y = P.y + Math.sin(a / 16 * 6.283) * r, t = T.terrainAt(x, y);
    if (t === 'ice' || t === 'thin' || !N.freeAt(x, y)) continue;
    if (r < bd) { bd = r; best = { x, y }; }
  }
  const tgt = best || firm;
  if (tgt) yield* H.goTo(tgt.x, tgt.y, 3, { climb: false, timeout: 20 });
}

// --- the end of a run -------------------------------------------------------------------------------
function finish(outcome) {
  if (finished) return;
  finished = true;
  abort();
  const st = S.stats, D = state.distress;
  const min = v => (v === null || v === undefined ? null : +(v / 60).toFixed(2));
  const sum = {
    run: st.run, outcome, at: new Date().toISOString(), forecast: st.forecast, sos: `${Math.round(D.x)},${Math.round(D.y)} (${st.sos})`,
    sosFromCamp: Math.round(Math.hypot(D.x - TENT.x, D.y - TENT.y)),
    minutes: { triangulated: min(st.triangulated), firstFind: min(st.found), wrapped: min(st.wrapped), home: min(st.home), total: min(state.time - st.t0) },
    days: S.day, deaths: st.deaths, membersLost: st.deaths.length,
    used: { rationsEaten: st.rations, rationsLeft: count(state.sled, 'food') + count(state.pack, 'food'), drinks: st.drinks, snow: st.snow, flares: st.flares, shots: st.shots },
    climbs: { chosen: st.climbsChosen, done: st.climbs, refused: st.climbRefused, falls: st.falls, detours: st.detours },
    camp: { pitches: st.pitches, sleeps: st.sleeps }, kitTrips: st.kitTrips, searchLegs: S.mem.legs,
    walked: Math.round(st.walked), decisions: st.decisions, stuck: st.stuck, noPath: st.noPath,
  };
  S.summary = sum;
  S.runs.push(sum);
  // the last two finished runs' traces kept across ?sim=loop reloads (Copy / Download sim log sends the one before too)
  try {
    let kept = JSON.parse(sessionStorage.getItem(TRACE_KEY) || '[]');
    if (!Array.isArray(kept)) kept = [kept];
    kept.push({ stats: S.stats, summary: sum, log: S.log, trace: TR.trace() });
    sessionStorage.setItem(TRACE_KEY, JSON.stringify(kept.slice(-2)));
  } catch { /* too big, or private mode */ }
  try { sessionStorage.setItem(RUNS_KEY, JSON.stringify(S.runs.slice(-40))); } catch { /* private mode */ }
  H.goal(outcome === 'home' ? 'home: they brought them home' : outcome === 'all dead' ? 'none came home' : outcome === 'died' ? 'they did not come home' : 'run called off (too long)');
  H.note('End', `${outcome}: found ${sum.minutes.firstFind ?? '-'} min, home ${sum.minutes.home ?? '-'} min, ${sum.membersLost} lost, ${sum.used.rationsEaten} rations eaten, ${sum.decisions} decisions`);
  console.log('[sim] RUN SUMMARY ' + JSON.stringify(sum));
  if (S.loop) setTimeout(() => location.reload(), SIM.loopDelay * 1000);
  else if (outcome === 'home') setTimeout(() => { if (state.burden?.card) { state.uiPress?.(20, 20); state.uiRelease?.(); } }, 6000);
}

// --- on screen: the thoughts panel and the stats strip (a dev tool: plain text) ------------------------
export function drawOverlay() {
  if (!S.on || !begun) return;
  const b = state.body, L = state.lighting || {}, st = S.stats;
  const clock = L.clock ?? 0, night = clock >= 180;
  const m = state.party?.[state.member], n = state.party?.length ?? 1;
  const lines = [];
  lines.push({ t: `SIM x${state.timeScale}${S.loop ? ' loop' : ''}  run ${st.run}  ${H.fmtTime(state.time - st.t0)}  day ${S.day} ${night ? 'night' : 'day'} ${H.fmtTime(night ? clock - 180 : clock)}`, c: '#fff' });
  lines.push({ t: `${m?.name ?? '-'}${n > 1 ? ` (${(state.member ?? 0) + 1}/${n})  deaths ${st.deaths.length}` : ''}  walked ${Math.round(st.walked)} px  weather: ${state.weather?.phase ?? '-'}`, c: '#ddd' });
  // (the debug panel shows the body in full when it's on)
  if (b && !state.debugInfo?.on) lines.push({ t: `warm ${b.warmth.toFixed(2)} energy ${b.energy.toFixed(2)}/${(b.max ?? 1).toFixed(2)} food ${b.food.toFixed(2)} water ${b.water.toFixed(2)}${b.wet > 0.05 ? ` wet ${b.wet.toFixed(2)}` : ''}${b.injury > 0.02 ? ` hurt ${b.injury.toFixed(2)}` : ''}`, c: '#ddd' });
  lines.push({ t: `GOAL: ${S.goal || '-'}`, c: '#ffffff' });
  for (const e of S.recent.slice(-6)) lines.push({ t: `${H.fmtTime(e.t - st.t0)} ${e.kind}: ${e.text}`, c: '#e8e8e8' });
  addPanel(lines);
}
// the planned path and the best spot so far, faint, in the world
export function drawSky(ctx) {
  if (!S.on || !SIM.showPath || PANELS.hidden || !begun) return;
  const z = state.cam.zoom || 1;
  if (S.path && S.path.length > 1 && P.mode !== 'inside') {
    ctx.setLineDash([3 / z, 4 / z]);
    ctx.lineWidth = 1.2 / z;
    ctx.strokeStyle = 'rgba(30,34,40,0.45)';
    ctx.beginPath();
    ctx.moveTo(S.path[0].x, S.path[0].y);
    for (const p of S.path) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (S.est && !state.distress?.found) {
    ctx.lineWidth = 1.2 / z; ctx.strokeStyle = 'rgba(30,34,40,0.55)';
    const e = S.est, r = 5;
    ctx.beginPath(); ctx.moveTo(e.x - r, e.y - r); ctx.lineTo(e.x + r, e.y + r); ctx.moveTo(e.x + r, e.y - r); ctx.lineTo(e.x - r, e.y + r); ctx.stroke();
  }
  if (S.best && !state.distress?.found) {
    ctx.lineWidth = 1.2 / z; ctx.strokeStyle = 'rgba(30,34,40,0.5)';
    ctx.beginPath(); ctx.arc(S.best.x, S.best.y, 4, 0, Math.PI * 2); ctx.stroke();
  }
}
