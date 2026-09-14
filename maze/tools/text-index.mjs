#!/usr/bin/env node
// The Maze — every line the player reads, with the context a writer needs.
//
// Joe, planning the rewrite: "it'll be good to have a single file that contains all the lines to
// everything visible to the players well annotated so u know what I'm editing. Just hit the first
// chalk pickup for example. Because it's the child speaking, I'm gonna want that to sound like the
// child. So knowing when things can trigger would also be helpful in the annotation."
//
// So: id, the words, who speaks them, where they appear, when they fire, how often, and whether
// anything fires them at all. Walked out of data/text.js rather than kept by hand — a second copy
// of the text would be wrong within a week, and the annotation with it.
//
//   node maze/tools/text-index.mjs             a readable report
//   node maze/tools/text-index.mjs --json      the index, for the writer's page
//   node maze/tools/text-index.mjs --dead      only the lines nothing can reach

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAZE = join(HERE, '..');
const argv = process.argv.slice(2);

const src = readFileSync(join(MAZE, 'data/text.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(src, ctx);
const blockNames = [...src.matchAll(/^const ([A-Z_]+)\s*=/gm)].map((m) => m[1]);

const phasesSrc = readFileSync(join(MAZE, 'data/phases.js'), 'utf8');
const pctx = vm.createContext({});
vm.runInContext(phasesSrc, pctx);
const PHASES = vm.runInContext('PHASES', pctx);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

// Where a tutorial can first fire: the earliest phase whose features include the thing it explains.
// Derived, because a hand-written chapter number is wrong the moment a feature moves phase.
const TUT_FLAG = { chalk: null, page: null, charcoal: 'charcoal', door: 'doors', pointer: 'compass',
                   path: 'thread', scrap: 'scraps', lamp: 'lamp', key: 'gate', offering: null };
function tutorialChapter(kind) {
  const flag = TUT_FLAG[kind];
  if (flag === undefined) return null;
  let at = 0;
  if (flag) at = PHASES.findIndex((p) => p.f[flag] === true || (typeof p.f[flag] === 'number' && p.f[flag] > 0));
  return at < 0 ? null : { n: at, label: `Chapter ${ROMAN[at]} — ${PHASES[at].who}` };
}

// What each block is, for a writer. Anything not named here still appears — it just says so, which
// is the point: a new block must not be able to slip into the game unannotated.
const ABOUT = {
  SELF_LINES:   { surface: 'narrator', fires: 'rotation', voiced: true,
                  when: 'While wandering, every couple of minutes, in this self’s chapter' },
  ROOM_LINES:   { surface: 'narrator', fires: 'once a run', voiced: true,
                  when: 'Standing at the shelves or the basin in the start room' },
  CAST:         { surface: 'page', fires: 'once ever', voiced: true,
                  when: 'The journal pages, and the lines on waking and leaving a chapter' },
  POOLS:        { surface: 'pool', fires: 'once ever', voiced: true,
                  when: 'The exchange at the water, between chapters' },
  EXCHANGES:    { surface: 'shrine', fires: 'once ever', voiced: true,
                  when: 'At a statue, after the offering goes in' },
  TUTORIALS:    { surface: 'card', fires: 'once ever', voiced: false,
                  when: 'The first time you find one, in whichever chapter that is' },
  MOMENTS:      { surface: 'narrator', fires: 'on the beat', voiced: true,
                  when: 'One line at one moment — a locked door, a squeeze, the stone' },
  SHRINE_LINES: { surface: 'narrator', fires: 'on the beat', voiced: false,
                  when: 'Carrying an offering, and giving it' },
  SHELF_LINES:  { surface: 'narrator', fires: 'once a run', voiced: false, when: 'At the shelves' },
  EMPTY_SHELF:  { surface: 'narrator', fires: 'once a run', voiced: false, when: 'At a shelf with nothing on it' },
  LIGHTER:      { surface: 'narrator', fires: 'once a run', voiced: false, when: 'At the basin, a stone lighter' },
  FIGURE_LINES: { surface: 'narrator', fires: 'once a run', voiced: false, when: 'Seeing the father, Child chapter only' },
  SECRET_LINES: { surface: 'narrator', fires: 'once a run', voiced: false, when: 'Inside the secret room' },
  NARRATOR:     { surface: 'narrator', fires: 'rotation', voiced: false, when: 'Unreferenced — see the dead column' },
  MAP_EMPTY:    { surface: 'map', fires: 'on the beat', voiced: false, when: 'The map, before anything is charted' },
  POOL_UI:      { surface: 'pool', fires: 'on the beat', voiced: false, when: 'The pool room’s own furniture' },
  PEOPLE:       { surface: 'shrine', fires: 'on the beat', voiced: false, when: 'Who each statue is' },
};

// Which lists you can add a line to, and what happens if you do. This depends on *how the engine
// picks*, not on the shape of the data, so it is read off the pick sites in js/ and kept here
// deliberately: an unknown list defaults to "no", because offering an add that can never fire is
// worse than not offering one. If you add a pool, add it here.
const POOL_RULES = [
  { re: /^SELF_LINES[\[.]/,                  add: true,
    note: 'shuffled and played through, so a new line joins the rotation' },
  { re: /^ROOM_LINES[\[.].*\.(shelf|basin)$/, add: true,
    note: 'spread across the chapter as you gather pages \u2014 one more line makes the steps finer' },
  { re: /^CAST\[\d+\]\.pages$/,             add: true,
    note: 'one more page to find before this chapter ends' },
  { re: /^(EMPTY_SHELF|FIGURE_LINES|SECRET_LINES)$/, add: true, note: 'picked at random' },
  { re: /^SHELF_LINES$/,                   add: true,
    note: 'played once each, then the set starts over' },
  { re: /^POOLS\[\d+\]\.approach$/,         add: true,
    note: 'one more line on the walk down to the water' },
  { re: /^EXCHANGES\..*\.steps$/,           add: true,
    note: 'one more thing you can ask this person' },
  { re: /^LIGHTER$/,                       add: false,
    note: 'one line per stone, and there are seven stones \u2014 an eighth could never fire' },
  { re: /^POOLS\[\d+\]\.ex\[\d+\]\.(choices|reply)$/, add: false,
    note: 'a choice and its reply are a pair \u2014 adding one needs the other, so this is a code change' },
  { re: /^EXCHANGES\..*\.steps\[\d+\]\.(q|a)$/, add: false,
    note: 'a question and its answer are paired by position \u2014 adding one needs the other, so this is a code change' },
  { re: /^NARRATOR$/,                      add: false,
    note: 'nothing in the game fires this block at all' },
];
function poolRule(pool) {
  if (!pool) return null;
  const r = POOL_RULES.find((x) => x.re.test(pool));
  return r || { add: false, note: 'this list is not in POOL_RULES \u2014 I have not checked how the game picks from it' };
}

// Does anything in the engine actually reach this block?
const engine = readdirSync(join(MAZE, 'js')).filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(MAZE, 'js', f), 'utf8')).join('\n');
const reached = Object.fromEntries(blockNames.map((n) => [n, new RegExp('\\b' + n + '\\b').test(engine)]));

// Every string leaf, with the path that reaches it. Generic on purpose: a block added tomorrow is
// indexed without anyone remembering to teach this tool about it.
function walk(node, path, out) {
  if (typeof node === 'string') { out.push({ path, text: node }); return; }
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  else if (node && typeof node === 'object')
    for (const k of Object.keys(node))
      walk(node[k], path + (/^[A-Za-z_$][\w$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`), out);
}

// Which chapter a line belongs to, so the page can run in play order rather than in the order the
// file happens to be written in. Derived from the path: a self's name keys straight to their
// chapter, CAST is one entry per self, and a pool sits between the chapter it closes and the next.
const chapterIndex = (who) => PHASES.findIndex((p) => p.who === who);
const label = (n) => (n < 0 || n >= PHASES.length ? null : `Chapter ${ROMAN[n]} \u2014 ${PHASES[n].who}`);
function chapterOf(block, path, selfKey, tutKey) {
  if (tutKey) return (tutorialChapter(tutKey[1]) || {}).label || null;
  if (selfKey) return label(chapterIndex(selfKey[1]));
  const idx = path.match(/^(CAST|POOLS)\[(\d+)\]/);
  if (idx && idx[1] === 'CAST') return label(+idx[2]);
  if (idx && idx[1] === 'POOLS') return `After ${label(+idx[2]) || 'chapter ' + idx[2]}`;
  return null;
}

const lines = [];
for (const name of blockNames) {
  const leaves = [];
  walk(vm.runInContext(name, ctx), name, leaves);
  const about = ABOUT[name];
  for (const leaf of leaves) {
    // a bare lowercase token is a key, not something anyone reads
    const isId = /^[a-z][a-z0-9_]*$/.test(leaf.text) && !leaf.text.includes(' ');
    const selfKey = leaf.path.match(/^[A-Z_]+\["(The [^"]+|You)"\]/);
    const tutKey = name === 'TUTORIALS' && leaf.path.match(/^TUTORIALS\.([a-z]+)/);
    lines.push({
      id: leaf.path,
      text: leaf.text,
      block: name,
      kind: isId ? 'id' : 'prose',
      voice: selfKey ? selfKey[1] : (about && about.voiced ? 'per self' : 'everyone'),
      surface: about ? about.surface : 'unknown',
      fires: about ? about.fires : 'unknown',
      when: about ? about.when : 'NOT ANNOTATED — this block is new; add it to ABOUT in text-index.mjs',
      chapter: chapterOf(name, leaf.path, selfKey, tutKey),
      dead: !reached[name],
      chars: leaf.text.length,
      // the list this line sits in, if it sits in one at all — a single slot can be rewritten
      // but not added to
      pool: /\[\d+\]$/.test(leaf.path) ? leaf.path.replace(/\[\d+\]$/, '') : null,
      canAdd: !!(poolRule(/\[\d+\]$/.test(leaf.path) ? leaf.path.replace(/\[\d+\]$/, '') : null) || {}).add,
      poolNote: (poolRule(/\[\d+\]$/.test(leaf.path) ? leaf.path.replace(/\[\d+\]$/, '') : null) || {}).note || null,
    });
  }
}

export { lines };

// Everything below is the command line. Guarded, because tools/writer-page.mjs imports this rather
// than shelling out to it — piping 150KB of JSON between two node processes truncated it, which
// showed up as a syntax error a long way from the cause.
import { pathToFileURL } from 'node:url';
if (import.meta.url !== pathToFileURL(process.argv[1] || '').href) { /* imported, not run */ }
else {

const prose = lines.filter((l) => l.kind === 'prose');
if (argv.includes('--json')) { console.log(JSON.stringify({ lines, generated: new Date().toISOString() }, null, 1)); process.exit(0); }

const dead = prose.filter((l) => l.dead);
if (argv.includes('--dead')) {
  console.log(`${dead.length} line(s) nothing in the engine can reach:\n`);
  for (const l of dead) console.log(`  ${l.id.padEnd(24)} ${JSON.stringify(l.text.slice(0, 64))}`);
  process.exit(0);
}

console.log(`The Maze — ${prose.length} lines the player can read, across ${blockNames.length} blocks\n`);
for (const name of blockNames) {
  const mine = prose.filter((l) => l.block === name);
  if (!mine.length) continue;
  const a = ABOUT[name];
  const longest = mine.reduce((x, y) => (x.chars > y.chars ? x : y));
  console.log(`${name}  —  ${mine.length} lines, ${a ? a.surface : 'UNANNOTATED'}, ${a ? a.fires : '?'}`
    + `${reached[name] ? '' : '   ** NOTHING FIRES THIS **'}`);
  console.log(`    ${a ? a.when : 'no entry in ABOUT — add one'}`);
  console.log(`    longest ${longest.chars} chars: ${JSON.stringify(longest.text.slice(0, 70))}\n`);
}
const unannotated = blockNames.filter((n) => !ABOUT[n]);
console.log(`${dead.length} line(s) nothing can reach (--dead to list them).`);
if (unannotated.length) console.log(`${unannotated.length} block(s) with no annotation: ${unannotated.join(', ')}`);

}
