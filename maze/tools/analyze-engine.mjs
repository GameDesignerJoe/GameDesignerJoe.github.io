#!/usr/bin/env node
// Survey the engine script top-level construct by top-level construct, in order.
//
// Splitting classic scripts is a textual operation: the pieces share one global
// scope, so as long as load order matches the old top-to-bottom order the
// semantics are identical. The one hazard is *executable* top-level statements
// — anything that runs at parse time. A function can be defined in a later file
// and called from an earlier one (the call happens at runtime), but a statement
// that runs immediately cannot reach forward. So find them all first.

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../maze-topdown.html', import.meta.url), 'utf8');
const lines = src.split('\n');
const start = lines.findIndex((l) => l.trim() === '<script>' && l.length < 20);
const end = lines.findIndex((l, i) => i > start && l.trim() === '</script>');
if (start === -1 || end === -1) throw new Error('could not bound the script');

const DECL = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;
const FUNC = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const COMMENT = /^\s*\/\//;

const items = [];
let depth = 0;
for (let i = start + 1; i < end; i++) {
  const raw = lines[i];
  const t = raw.trim();
  const atTop = depth === 0;
  // crude but sufficient: count brackets outside strings/comments
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
  if (!atTop || !t || COMMENT.test(t)) continue;

  const f = t.match(FUNC);
  const d = t.match(DECL);
  if (f) items.push({ line: i + 1, kind: 'function', name: f[1] });
  else if (d) items.push({ line: i + 1, kind: 'decl', name: d[1], text: t });
  else items.push({ line: i + 1, kind: 'RUNS', name: t.slice(0, 90) });
}

// extents
for (let i = 0; i < items.length; i++) {
  items[i].endLine = (items[i + 1]?.line ?? end + 1) - 1;
  items[i].lines = items[i].endLine - items[i].line + 1;
  items[i].bytes = lines.slice(items[i].line - 1, items[i].endLine).join('\n').length;
}

const runs = items.filter((x) => x.kind === 'RUNS');
console.log(`script spans lines ${start + 1}–${end + 1} (${end - start - 1} lines)\n`);
console.log(`${items.length} top-level constructs: `
  + `${items.filter((x) => x.kind === 'function').length} functions, `
  + `${items.filter((x) => x.kind === 'decl').length} declarations, `
  + `${runs.length} executable statements\n`);

console.log('── executable top-level statements (these fix the load order) ──');
for (const r of runs) console.log(`  ${String(r.line).padStart(5)}  ${r.name}`);

console.log('\n── everything, in order ──');
for (const x of items) {
  const tag = x.kind === 'RUNS' ? 'RUNS' : x.kind === 'function' ? 'fn  ' : 'decl';
  const size = x.bytes > 900 ? `${(x.bytes / 1024).toFixed(1)}KB` : '';
  console.log(`  ${String(x.line).padStart(5)}-${String(x.endLine).padEnd(5)} ${tag} `
    + `${String(x.name).slice(0, 58).padEnd(58)} ${size}`);
}
