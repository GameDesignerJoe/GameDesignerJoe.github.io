// The Maze — are the docs still being looked at?
//
// Not a content check. It cannot tell whether a doc is true — only whether
// anyone has claimed to check it lately. That is the signal we actually missed:
// HANDOFF.md and PROGRESSION.md sat at v0.31.2 and v0.20 while the game went to
// v0.76.0, and nothing ever said so out loud.
//
// Every doc carries a stamp meaning "last read against the game at this
// version":
//
//     <!-- reviewed: v0.76.0 -->
//     <!-- reviewed: v0.76.0 — and a note on what was and wasn't checked -->
//
// Bump it when you have actually re-read the doc against the code. Bumping it
// because you edited one line is how this becomes theatre.
//
//   node maze/tools/docs-check.mjs            warn past the default gap
//   node maze/tools/docs-check.mjs --max 4    tighter
//   node maze/tools/docs-check.mjs --quiet    print only if something is stale
//   node maze/tools/docs-check.mjs --brief    one line, for the pre-commit hook
//
// Advisory by design: exit 0 unless a stamp is missing or malformed, which is a
// real error rather than a judgement about how much drift is too much.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = join(HERE, '..', 'docs');
const CORE = join(HERE, '..', 'js', 'core.js');

const argv = process.argv.slice(2);
const quiet = argv.includes('--quiet');
const brief = argv.includes('--brief');   // one line: the hook has to fit it in a JSON string
const maxGap = (() => {
  const i = argv.indexOf('--max');
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : 10;
})();

const parse = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
};

const vm = /const VERSION = '([^']+)'/.exec(readFileSync(CORE, 'utf8'));
if (!vm) { console.error('docs-check: no VERSION in js/core.js'); process.exit(2); }
const now = parse(vm[1]);
if (!now) { console.error(`docs-check: VERSION '${vm[1]}' is not x.y.z`); process.exit(2); }

// how far behind a stamp is, counted in minor versions. A major bump swamps the
// gap on purpose: every doc wants re-reading after one.
const behind = (s) => (now.major - s.major) * 1000 + (now.minor - s.minor);

const rows = [];
let bad = 0;

for (const name of readdirSync(DOCS).filter((f) => f.endsWith('.md')).sort()) {
  const text = readFileSync(join(DOCS, name), 'utf8');
  // anything after the version is a note for a human, and is ignored here
  const m = /<!--\s*reviewed:\s*v(\d+\.\d+\.\d+)/.exec(text);
  if (!m) {
    rows.push({ name, state: 'MISSING', note: 'no `<!-- reviewed: vX.Y.Z -->` stamp' });
    bad++;
    continue;
  }
  const stamp = parse(m[1]);
  if (!stamp) {
    rows.push({ name, state: 'BAD', note: `stamp 'v${m[1]}' is not x.y.z` });
    bad++;
    continue;
  }
  const gap = behind(stamp);
  if (gap < 0) {
    rows.push({ name, state: 'AHEAD', note: `stamped v${m[1]}, but the game is v${vm[1]}` });
    bad++;
  } else {
    rows.push({ name, state: gap > maxGap ? 'STALE' : 'ok', gap, note: `v${m[1]}` });
  }
}

const stale = rows.filter((r) => r.state === 'STALE');

if (brief) {
  const broken = rows.filter((r) => r.state !== 'ok' && r.state !== 'STALE');
  const parts = [
    ...broken.map((r) => `${r.name} (${r.note})`),
    ...stale.map((r) => `${r.name} last read at ${r.note}, ${r.gap} versions ago`),
  ];
  if (parts.length) {
    console.log(
      `docs-check: ${parts.join('; ')}. The game is at v${vm[1]}. ` +
      'Re-read against the code, fix what drifted, then bump the `reviewed:` stamp.'
    );
  }
  process.exit(broken.length ? 2 : 0);
}


if (!quiet || stale.length || bad) {
  console.log(`docs-check — the game is at v${vm[1]}; warn past ${maxGap} minor versions\n`);
  for (const r of rows) {
    const tag = r.state === 'ok' ? '  ok  ' : `  ${r.state.padEnd(4)}`;
    const gap = r.gap === undefined ? '' : r.gap === 0 ? '  (this version)' : `  (${r.gap} behind)`;
    console.log(`${tag}  ${r.name.padEnd(16)} ${r.note}${gap}`);
  }
  console.log();
}

if (bad) {
  console.log(`${bad} doc(s) have no usable stamp. Add one near the top:  <!-- reviewed: v${vm[1]} -->`);
  process.exit(2);
}
if (stale.length) {
  console.log(
    `${stale.length} doc(s) not read against the game in over ${maxGap} versions: ` +
    stale.map((r) => r.name).join(', ') + '.\n' +
    'Re-read them against the code, fix what has drifted, then bump the stamp.\n' +
    'This is advice, not a gate — but it is the warning nobody got for 45 versions.'
  );
} else if (!quiet) {
  console.log('Every doc has been read against the game recently enough.');
}
