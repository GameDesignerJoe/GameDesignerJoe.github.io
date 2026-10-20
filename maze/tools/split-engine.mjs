#!/usr/bin/env node
// Phase 2 of the split: cut the engine into files along the author's own
// section dividers.
//
//   node maze/tools/split-engine.mjs           # show the plan and check it
//   node maze/tools/split-engine.mjs --apply   # do it
//
// This is a purely textual split. Classic scripts share one global scope, so
// loading the pieces in the same order they appeared gives byte-identical
// semantics — every statement sees exactly what it saw before. No modules, no
// build step, and the game still opens over file://.
//
// The hazard would be reordering: 52 top-level statements run at parse time and
// cannot reach forward to something not yet defined. Keeping the order removes
// the hazard entirely, so the cut points are the only thing to get right — each
// must sit at brace depth zero, between two top-level constructs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const HTML = new URL('../maze-topdown.html', import.meta.url);
const APPLY = process.argv.includes('--apply');

const src = readFileSync(HTML, 'utf8');
const lines = src.split('\n');
const open = lines.findIndex((l) => l.trim() === '<script>' && l.length < 20);
const close = lines.findIndex((l, i) => i > open && l.trim() === '</script>');
if (open === -1 || close === -1) throw new Error('could not bound the engine script');

// Section dividers the author wrote, in order. Each becomes a file.
const SECTIONS = [
  ['js/core.js',      null,                                   'version, save file, seed'],
  ['js/generate.js',  '// ── maze generation',                'the maze itself: grid, rooms, pockets, doors, darkness, placement'],
  ['js/audio.js',     '// ── audio: synthesized, no files',   'the drone bed and the generative composer'],
  ['js/state.js',     '// ── state',                          'run state, the debug panel, hard refresh'],
  ['js/input.js',     '// ── input',                          'the stick, chalk, charcoal, lamp, gear'],
  ['js/stories.js',   '// ── stories screen',                 'the reader for pages already found'],
  ['js/run-save.js',  '// ── run persistence',                'a run in progress, restored exactly where you left it'],
  ['js/tutorials.js', '// ── first-find tutorials',           'the helper cards, in the player’s own voice'],
  ['js/pool.js',      '// ── pool scene',                     'the water between phases'],
  ['js/map.js',       '// ── map screen',                     'the charcoal map, panning and zooming'],
  ['js/movement.js',  '// ── movement',                       'the Pac-Man glide, turns, sliders, pickups. Do not reintroduce snapping'],
  ['js/render.js',    '// ── render',                         'every frame: floor, walls, fog, lamp cone, marks, HUD'],
  ['js/boot.js',      'function frame(now)',                  'the frame loop, resume-or-reset, and go'],
];

// Resolve each divider to a line number.
const marks = [];
for (const [file, needle, blurb] of SECTIONS) {
  if (needle === null) { marks.push({ file, line: open + 2, blurb }); continue; }
  const idx = lines.findIndex((l, i) => i > open && i < close && l.startsWith(needle));
  if (idx === -1) throw new Error(`could not find section marker: ${needle}`);
  marks.push({ file, line: idx + 1, blurb });
}

// Extents, and the depth at each cut.
function depthAt(lineNo) {
  let depth = 0;
  for (let i = open + 1; i < lineNo - 1; i++) {
    const raw = lines[i];
    let inS = null, esc = false;
    for (let k = 0; k < raw.length; k++) {
      const c = raw[k];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (inS) { if (c === inS) inS = null; continue; }
      if (c === "'" || c === '"' || c === '`') { inS = c; continue; }
      if (c === '/' && raw[k + 1] === '/') break;
      if (c === '{' || c === '[' || c === '(') depth++;
      if (c === '}' || c === ']' || c === ')') depth--;
    }
  }
  return depth;
}

for (let i = 0; i < marks.length; i++) {
  marks[i].endLine = (marks[i + 1]?.line ?? close + 1) - 1;
  marks[i].lines = marks[i].endLine - marks[i].line + 1;
  marks[i].bytes = lines.slice(marks[i].line - 1, marks[i].endLine).join('\n').length;
  marks[i].depth = depthAt(marks[i].line);
}

const badCuts = marks.filter((m) => m.depth !== 0);
console.log(`engine script: lines ${open + 2}–${close} (${close - open - 1} lines, `
  + `${(lines.slice(open + 1, close).join('\n').length / 1024).toFixed(1)} KB)\n`);
for (const m of marks) {
  console.log(`  ${m.file.padEnd(17)} ${String(m.line).padStart(5)}-${String(m.endLine).padEnd(5)}`
    + ` ${String(m.lines).padStart(4)} lines ${(m.bytes / 1024).toFixed(1).padStart(5)} KB`
    + `  depth ${m.depth}${m.depth === 0 ? '' : '  ← CUTS INSIDE A BLOCK'}`);
}
if (badCuts.length) { console.error(`\n${badCuts.length} cut(s) are not at top level — refusing.`); process.exit(1); }
console.log('\nall cuts sit at brace depth 0.');

if (!APPLY) process.exit(0);

mkdirSync(new URL('../js/', import.meta.url), { recursive: true });

const bodies = [];
for (const m of marks) {
  const body = lines.slice(m.line - 1, m.endLine).join('\n');
  bodies.push(body);
  const header = `// The Maze — ${m.blurb}\n`
    + `//\n`
    + `// Part of the engine, loaded as a plain script in the order it used to appear\n`
    + `// in maze-topdown.html. Everything shares one global scope, exactly as before.\n\n`;
  writeFileSync(new URL('../' + m.file, import.meta.url), header + body + '\n');
  console.log(`wrote ${m.file}`);
}

// The concatenated bodies must equal the original script body, byte for byte.
const original = lines.slice(open + 1, close).join('\n');
const rejoined = bodies.join('\n');
if (rejoined !== original) {
  console.error('\nREFUSING: rejoined bodies do not match the original script.');
  console.error(`  original ${original.length} bytes, rejoined ${rejoined.length} bytes`);
  process.exit(1);
}
console.log('\nrejoined bodies match the original script byte for byte.');

// Swap the inline script for the file list.
const out = [
  ...lines.slice(0, open),
  '<!-- Engine, in the order it used to run. Plain scripts, one global scope. -->',
  ...marks.map((m) => `<script src="${m.file}"></script>`),
  ...lines.slice(close + 1),
];
writeFileSync(HTML, out.join('\n'));
console.log(`maze-topdown.html: ${lines.length} → ${out.length} lines`);
