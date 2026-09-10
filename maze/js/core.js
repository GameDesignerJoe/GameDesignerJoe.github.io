// The Maze — version, save file, seed
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

const VERSION = '0.36.0';


// ── persistence (local storage; silently off where unavailable) ──
const SAVE_KEY = 'maze.save.v1';
let SAVE = { collected: {}, charCycle: [], narrPlayed: [], shelfPlayed: [], tutorials: [], ui: {}, phase: 0, stones: 0, poolPending: false, finished: false };
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) SAVE = Object.assign(SAVE, JSON.parse(raw)); } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
function collectedCount(name) { return (SAVE.collected[name] || []).filter(Boolean).length; }


function phase() { return PHASES[Math.min(SAVE.phase || 0, PHASES.length - 1)]; }
function has(stoneIdx) { return (SAVE.stones || 0) > stoneIdx; }
const B = {   // burden-adjusted values
  viewRadius: () => CONFIG.viewRadius * (has(0) ? 1 : 0.6) * (poolMode ? 2.2 : 1),
  speed:      () => CONFIG.speed * (has(1) ? 1.08 : 1),
  charcoal:   () => Math.round(CONFIG.charcoalTiles * (has(2) ? 1.25 : 1)),
  darkChance: () => CONFIG.darknessChance * (has(3) ? 0.6 : 1),
  fringe:     () => has(3) ? 0.7 : 1,
  pointerSec: () => CONFIG.pointerSeconds * (has(4) ? 1.5 : 1),
  pathSec:    () => CONFIG.pathSeconds * (has(4) ? 1.5 : 1),
  keyChance:  () => CONFIG.keyChance * (has(5) ? 0.5 : 1),
};


// ── seed ────────────────────────────────────────────────────────
let SEED = 0;
try {
  const qs = new URLSearchParams(location.search);
  SEED = parseInt(qs.get('seed')) || 0;
  if (qs.has('u')) history.replaceState(null, '', location.pathname);   // clean up after an update
} catch (e) {}
if (!SEED) SEED = (Math.random() * 1e9 | 0);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

