#!/usr/bin/env node
// Phase 1 of the split: lift the data blocks out of maze-topdown.html into
// data/*.js, leaving the engine behind.
//
//   node maze/tools/split-data.mjs           # what it can see, and where
//   node maze/tools/split-data.mjs --apply   # do it
//
// Why .js and not .json: CONFIG carries 65 comments in 105 lines and they are
// the design intent, not decoration ("branchiness: 0 = long winding corridors").
// JSON cannot hold them. Plain classic scripts also keep working over file://
// and need no build step, no fetch and no async boot — the data files just
// declare the same consts a little earlier in the same global scope.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const HTML = new URL('../maze-topdown.html', import.meta.url);
const APPLY = process.argv.includes('--apply');

const src = readFileSync(HTML, 'utf8');
const lines = src.split('\n');

const lineStarts = [0];
for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
const lineOf = (off) => {
  let lo = 0, hi = lineStarts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1; }
  return lo;
};

const scriptLine = lines.findIndex((l) => l.trim() === '<script>' && l.length < 20);
if (scriptLine === -1) throw new Error('could not find the main <script>');

/**
 * Walk from `i` and return the index just past the balanced bracket run that
 * starts there, skipping over strings, template literals and comments. Every
 * extraction is byte-verified against the original afterwards, so this only
 * has to be right, not clever.
 */
function endOfDeclaration(text, i) {
  let depth = 0, seenOpen = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '{' || c === '[' || c === '(') { depth++; seenOpen = true; i++; continue; }
    if (c === '}' || c === ']' || c === ')') {
      depth--; i++;
      if (seenOpen && depth === 0) {
        while (i < text.length && (text[i] === ';' || text[i] === ' ')) i++;
        while (i < text.length && text[i] !== '\n') i++;
        return i;
      }
      continue;
    }
    if (c === ';' && depth === 0 && seenOpen) { i++; while (i < text.length && text[i] !== '\n') i++; return i; }
    if (c === ';' && depth === 0) { i++; while (i < text.length && text[i] !== '\n') i++; return i; }
    i++;
  }
  return i;
}

const decls = [];
const re = /^const ([A-Z][A-Za-z_0-9]*) = /gm;
let m;
while ((m = re.exec(src)) !== null) {
  if (m.index < lineStarts[scriptLine]) continue;
  const end = endOfDeclaration(src, m.index);
  decls.push({ name: m[1], start: m.index, end, line: lineOf(m.index) + 1, endLine: lineOf(end - 1) + 1 });
}

/** Contiguous `//` lines directly above a block belong to it. */
function withLeadingComments(d) {
  let first = d.line - 1;
  while (first - 1 >= 0 && lines[first - 1].trim().startsWith('//')) first--;
  return { ...d, startLine: first + 1, commentLines: d.line - (first + 1) };
}

const PLAN = {
  'data/config.js': {
    title: 'tuning',
    blurb: 'Edit a value, refresh, get a different maze. The comments are design\n'
         + 'intent — read them before changing anything.',
    names: ['SIZES', 'CONFIG'],
  },
  'data/phases.js': {
    title: 'progression',
    blurb: 'Which self you are, what their maze allows, and the seven stones. See\n'
         + 'docs/PROGRESSION.md for why each stone holds down the knob it does.',
    names: ['PHASES', 'STONES'],
  },
  'data/text.js': {
    title: 'everything the player reads',
    blurb: 'All of it in the interior voice: first person, half-remembered. The\n'
         + 'Child never speaks in an adult voice. Rewrite freely — the engine only\n'
         + 'ever displays these, it never reads them for meaning.',
    names: ['ROOM_LINES', 'LIGHTER', 'EMPTY_SHELF', 'SHELF_LINES', 'SELF_LINES',
      'NARRATOR', 'CAST', 'POOLS', 'TUTORIALS', 'FIGURE_LINES'],
  },
  'data/music.js': {
    title: 'music presets',
    blurb: 'One generative preset per self. When a preset lands it becomes the\n'
         + 'brief for a commissioned track.',
    names: ['MUSIC'],
  },
};

const byName = new Map(decls.map((d) => [d.name, withLeadingComments(d)]));
const wanted = Object.values(PLAN).flatMap((p) => p.names);
const missing = wanted.filter((n) => !byName.has(n));
if (missing.length) throw new Error('could not locate: ' + missing.join(', '));

if (!APPLY) {
  console.log(`maze-topdown.html — ${lines.length} lines, ${(src.length / 1024).toFixed(1)} KB\n`);
  console.log('top-level const declarations in the script:');
  for (const d of decls) {
    const w = withLeadingComments(d);
    const kb = ((d.end - d.start) / 1024).toFixed(1);
    console.log(`  ${wanted.includes(d.name) ? '→ MOVE' : '  stay'}  ${d.name.padEnd(14)}`
      + ` lines ${String(w.startLine).padStart(4)}-${String(d.endLine).padEnd(4)}`
      + ` ${kb.padStart(5)} KB${w.commentLines ? `  +${w.commentLines} comment line(s)` : ''}`);
  }
  console.log('');
  let total = 0;
  for (const [file, p] of Object.entries(PLAN)) {
    const bytes = p.names.reduce((a, n) => a + (byName.get(n).end - byName.get(n).start), 0);
    total += bytes;
    console.log(`  ${file.padEnd(18)} ${(bytes / 1024).toFixed(1).padStart(5)} KB  ${p.names.join(', ')}`);
  }
  console.log(`  ${''.padEnd(18)} ${(total / 1024).toFixed(1).padStart(5)} KB moving in total`);
  process.exit(0);
}

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });

// Take spans by line, so the leading comments come along and what is removed
// from the HTML is exactly what is written out.
const spans = [];
for (const [file, p] of Object.entries(PLAN)) {
  const parts = [];
  for (const name of p.names) {
    const d = byName.get(name);
    parts.push(lines.slice(d.startLine - 1, d.endLine).join('\n'));
    spans.push({ from: d.startLine, to: d.endLine });
  }
  const header = `// The Maze — ${p.title}\n//\n`
    + p.blurb.split('\n').map((l) => '// ' + l).join('\n')
    + '\n//\n'
    + '// Loaded by maze-topdown.html before the engine, as a plain script. These\n'
    + '// are the same consts the game has always had, just in their own file.\n\n';
  writeFileSync(new URL('../' + file, import.meta.url), header + parts.join('\n\n') + '\n');
  console.log(`wrote ${file}`);
}

spans.sort((a, b) => b.from - a.from);
let out = lines.slice();
for (const s of spans) out.splice(s.from - 1, s.to - s.from + 1);

// Collapse runs of 3+ blank lines the removals leave behind.
const tidied = [];
for (const l of out) {
  if (l.trim() === '' && tidied.length >= 2
      && tidied[tidied.length - 1].trim() === '' && tidied[tidied.length - 2].trim() === '') continue;
  tidied.push(l);
}
out = tidied;

const si = out.findIndex((l) => l.trim() === '<script>' && l.length < 20);
if (si === -1) throw new Error('lost the <script> tag while rewriting');
out.splice(si, 0,
  '<!-- Data, loaded before the engine: tuning, progression, text, music. -->',
  ...Object.keys(PLAN).map((f) => `<script src="${f}"></script>`));

writeFileSync(HTML, out.join('\n'));
console.log(`\nmaze-topdown.html: ${lines.length} → ${out.length} lines`);
