// The Maze — version, save file, seed
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

const VERSION = '0.125.0';


// ── persistence (local storage; silently off where unavailable) ──
const SAVE_KEY = 'maze.save.v1';
let SAVE = { collected: {}, charCycle: [], narrPlayed: [], shelfPlayed: [], tutorials: [], ui: {}, phase: 0, stones: 0, poolPending: false, finished: false };
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) SAVE = Object.assign(SAVE, JSON.parse(raw)); } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
function collectedCount(name) { return (SAVE.collected[name] || []).filter(Boolean).length; }


function phase() { return PHASES[Math.min(SAVE.phase || 0, PHASES.length - 1)]; }
function has(stoneIdx) { return (SAVE.stones || 0) > stoneIdx; }
let protoMode = false;   // a prototype level is running instead of a maze
// the debug Zoom slider: 1 is the game's own scale, above it is closer, below it is further out
const zoomMul = () => Math.max(0.2, Math.min(1.5, +SAVE.ui.zoom || 1));
// Joe: "please give me a slider that lets me set the speed of the character", and "this fog of war
// is too tight. Can you give me another slider that lets me adjust that?" Plain multipliers on what
// the game would otherwise do, so neither can be turned into a different game by accident.
const speedMul = () => Math.max(0.4, Math.min(1.8, +SAVE.ui.speed || 1));
const fogMul = () => Math.max(0.4, Math.min(2.2, +SAVE.ui.fog || 1));
// how far he can actually see, in tiles: the lit core plus the fade past it. The fog is drawn in
// screen terms, so anything asking "is that in view" asks this instead of measuring the gradient
// Where a sliding tile is, this far into its travel, and how far through it is. Straight along its
// own line, centre to centre: it never takes the player's position and never takes his angle.
// Joe, on the start-room block: "since you can approach it from any angle it carries that angle to
// the tile, snaps it to the player and then moves to where it needs to go. Instead the tile should
// stay fixed in the line that it has and the player should get gently pulled into alignment as the
// tile moves." The drawing and the ride both read this, so they cannot disagree about where it is.
function slidePos(s, nowMs) {
  const k = Math.min(1, (nowMs - s.t0) / s.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  return [s.from[0] + 0.5 + (s.to[0] - s.from[0]) * e,
          s.from[1] + 0.5 + (s.to[1] - s.from[1]) * e, k];
}

// The line for this beat, in the voice of whoever is walking. Falls back to `_`, the line every
// self shares, so a moment only needs a per-self entry once somebody writes one. {braces} are
// filled from vars.
function moment(slug, vars) {
  const m = MOMENTS[slug] || {};
  let s = m[(typeof character !== 'undefined' && character) ? character.name : ''] || m._ || '';
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

// How far a gate's leaves have actually swung, given how far through its slide it is. Cubic, so it
// goes fast and settles slowly — which is why the collision has to read this and not the raw
// fraction. Joe: "there's collision when the pool level gate opens that stops me from walking
// through it until it's all the way open." At a third of the way through, the leaves are already
// two thirds open; the old check held the tile shut for the whole slide regardless.
const gateEase = (open) => 1 - Math.pow(1 - open, 3);
const litTiles = () => B.viewRadius() * 2 + CONFIG.fogFadeTiles;
let protoCellGrid = false;   // a prototype built on the cell lattice (js/districts.js is): loops mean something there
let protoWide = true;    // and its light is opened right up, so the one idea in it is all visible.
                         // The labyrinth turns this off: being unable to see is half of what it is
let liftGlow = 1;   // 1 normally. On the walk-in after a burden is put down the light blooms from dim to this
const B = {   // burden-adjusted values
  viewRadius: () => CONFIG.viewRadius * (has(0) ? 1 : 0.6) * (poolMode ? 2.2 : 1) * (protoMode && protoWide ? 4 : 1) * liftGlow,
  // a stone in your arms slows you down. Only in a pool level: everywhere else hasKey is the
  // exit key, which is small enough to put in a pocket
  speed:      () => CONFIG.speed * speedMul() * (has(1) ? 1.08 : 1) * (poolMode && hasKey ? CONFIG.stoneSlow : 1),
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


// ── line IDs on screen (the "Line IDs" debug toggle) ─────────────────────────
// Joe: "a debug element that would show the ID of every string when I played". The id shown is the
// same path tools/text-index.mjs prints and the writer's page is keyed by — SELF_LINES["The
// Child"][3], MOMENTS.exitLocked._ — so a screenshot off the phone maps straight onto the line to
// rewrite, with no hunting.
//
// The lookup runs backwards, words → path, rather than threading an id through narrate() and the
// five other surfaces: every one of them is handed a finished string, and a second parameter on
// each call site is a lot of places to forget. Built once, on first use.
const idsOn = () => !!SAVE.ui.ids;
let TEXT_IDS = null;        // the words → every path that holds them
let TEXT_ID_TPL = null;     // lines with {braces}, matched after the vars are filled in
function buildTextIds() {
  TEXT_IDS = new Map(); TEXT_ID_TPL = [];
  const walk = (node, path) => {
    if (typeof node === 'string') {
      const at = TEXT_IDS.get(node); if (at) at.push(path); else TEXT_IDS.set(node, [path]);
      if (node.includes('{')) TEXT_ID_TPL.push([new RegExp('^' + node.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '[\\s\\S]+?') + '$'), path]);
      return;
    }
    if (Array.isArray(node)) node.forEach((v, i) => walk(v, path + '[' + i + ']'));
    else if (node && typeof node === 'object')
      for (const k of Object.keys(node))
        walk(node[k], path + (/^[A-Za-z_$][\w$]*$/.test(k) ? '.' + k : '[' + JSON.stringify(k) + ']'));
  };
  for (const name of Object.keys(TEXT_BLOCKS)) walk(TEXT_BLOCKS[name], name);
}
// The path for a line the game just showed, or null. Where the same words sit in more than one
// slot — 'You' says "I wrote these." three times over — it names the first and says how many,
// because rewriting one of three and leaving the others is the mistake worth warning about.
function lineId(text) {
  if (typeof text !== 'string' || !text) return null;
  if (!TEXT_IDS) buildTextIds();
  const hit = TEXT_IDS.get(text);
  if (hit) return hit[0] + (hit.length > 1 ? ' ×' + hit.length : '');
  for (const [re, path] of TEXT_ID_TPL) if (re.test(text)) return path;
  return null;
}
// Hang the id under whatever showed the line. Silent unless the toggle is on; a line that isn't in
// data/text.js says so rather than going quiet, because text the game shows from somewhere else is
// exactly what this view is for finding.
function tagId(el, text) {
  if (!el || !idsOn()) return;
  const tag = document.createElement('i'); tag.className = 'lid';
  tag.textContent = lineId(text) || 'not in text.js';
  el.appendChild(tag);
}
// The same, for the two surfaces built as HTML strings rather than nodes.
function idHtml(text) {
  if (!idsOn()) return '';
  return '<i class="lid">' + (lineId(text) || 'not in text.js')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</i>';
}
