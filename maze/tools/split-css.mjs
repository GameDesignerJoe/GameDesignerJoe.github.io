#!/usr/bin/env node
// Phase 3 of the split: lift the stylesheet out of maze-topdown.html.
//
//   node maze/tools/split-css.mjs           # show the plan
//   node maze/tools/split-css.mjs --apply   # do it
//
// One file, not several. The stylesheet has no section comments and no natural
// seams — it is 170 flat rules, roughly in element order. The engine split
// followed the author's own dividers; here there are none, so inventing
// sections would impose a structure the file does not have.
//
// A <link> keeps working over file:// (unlike @import of a fetched module), so
// the game still opens straight off the filesystem.
//
// The rules are dedented by one level on the way out, since they are no longer
// nested inside a <style> block. That means this is not a byte-identical move,
// so it is verified against the browser's parsed CSSOM instead: every rule's
// cssText, in order, plus the computed style of every element with an id.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const HTML = new URL('../maze-topdown.html', import.meta.url);
const APPLY = process.argv.includes('--apply');

const src = readFileSync(HTML, 'utf8');
const lines = src.split('\n');
const open = lines.findIndex((l) => l.trim() === '<style>');
const close = lines.findIndex((l, i) => i > open && l.trim() === '</style>');
if (open === -1 || close === -1) throw new Error('could not find the <style> block');

const body = lines.slice(open + 1, close);
const indented = body.filter((l) => l.startsWith('  ')).length;
const nonBlank = body.filter((l) => l.trim()).length;

console.log(`<style> spans lines ${open + 1}–${close + 1}`);
console.log(`  ${body.length} lines, ${nonBlank} non-blank, ${(body.join('\n').length / 1024).toFixed(1)} KB`);
console.log(`  ${indented} of ${nonBlank} non-blank lines start with two spaces`);
console.log(`  → css/style.css, dedented one level, linked from <head>`);

if (!APPLY) process.exit(0);

// Dedent exactly one level; leave anything shallower alone.
const dedented = body.map((l) => (l.startsWith('  ') ? l.slice(2) : l));

const header = `/* The Maze — the whole look.
 *
 * Cold greys, not horror: weight, solitude, indifference. Chalk-white for
 * anything the player made or the selves left behind; gold for keys, gates and
 * the compass; bone for the thread. See docs/HANDOFF.md §2.
 *
 * Nothing here is generated and nothing reads it back — the engine never
 * touches the CSSOM. Safe to edit by hand.
 */

`;
mkdirSync(new URL('../css/', import.meta.url), { recursive: true });
writeFileSync(new URL('../css/style.css', import.meta.url), header + dedented.join('\n').trim() + '\n');
console.log('\nwrote css/style.css');

const out = [
  ...lines.slice(0, open),
  '<link rel="stylesheet" href="css/style.css">',
  ...lines.slice(close + 1),
];
writeFileSync(HTML, out.join('\n'));
console.log(`maze-topdown.html: ${lines.length} → ${out.length} lines`);
