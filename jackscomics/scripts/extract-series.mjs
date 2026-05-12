// One-off extraction: pulls the S array out of index.html and writes series.json.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('jackscomics/index.html', 'utf8');
const match = html.match(/const S=(\[[\s\S]*?\]);\s*\n\s*const TOTAL_ISSUES/);
if (!match) {
  console.error('Could not locate the S array in index.html');
  process.exit(1);
}

const S = (0, eval)('(' + match[1] + ')');
writeFileSync('jackscomics/series.json', JSON.stringify(S, null, 2) + '\n');
console.log(`Extracted ${S.length} series, ${S.reduce((a, s) => a + s.issues.length, 0)} total issues.`);
