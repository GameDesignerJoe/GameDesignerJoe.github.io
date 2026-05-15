// One-shot: remove individual physical books Mom flagged as no longer in the collection.
// For an issue that has a duplicate, removing it once means "lose one copy" — keep the
// issue in `issues` and just remove it from `dupes`. Only fully-singleton issues drop out.
import fs from 'node:fs';

const path = new URL('../series.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const removals = {
  'avengers': ['53'],
  'marvel-collectors-item': ['20'],
  'marvels-greatest-comics': ['29'],
  'marvel-tales': ['3','6','8','9','10','15','19'],
  'strange-tales': ['161'],
  'thor': ['180'],
  'journey-into-mystery': ['109'],
  'x-men': ['23','37'],
};

function keyOverlapsRemaining(keyIssue, remainingIssues) {
  const remaining = new Set(remainingIssues);
  const raw = String(keyIssue).replace(/^#/, '').trim();
  if (remaining.has(raw)) return true;
  if (raw.includes('–')) {
    const [lo, hi] = raw.split('–').map(x => x.trim());
    const nlo = Number(lo), nhi = Number(hi);
    if (!Number.isNaN(nlo) && !Number.isNaN(nhi)) {
      for (const r of remaining) {
        const n = Number(r);
        if (!Number.isNaN(n) && n >= nlo && n <= nhi) return true;
      }
    }
  }
  if (raw.includes('/')) {
    const parts = raw.split('/').map(x => x.trim());
    const prefix = parts[0].match(/^[A-Za-z-]+/)?.[0] || '';
    const expanded = parts.map(p => /^\d+$/.test(p) ? prefix + p : p);
    if (expanded.some(p => remaining.has(p))) return true;
  }
  return false;
}

const updated = [];
const dropped = [];
const changeSummary = [];

for (const s of data) {
  const remove = removals[s.id];
  if (!remove) { updated.push(s); continue; }

  const dupeSet = new Set(s.dupes || []);
  const issuesToActuallyRemove = [];
  const dupesToRemove = [];

  for (const iss of remove) {
    const bare = iss.replace(/^#/, '');
    if (dupeSet.has(iss) || dupeSet.has(bare)) {
      dupesToRemove.push(iss);
    } else {
      issuesToActuallyRemove.push(iss);
    }
  }

  const removeIssueSet = new Set(issuesToActuallyRemove);
  const removeDupeSet = new Set(dupesToRemove);
  const newIssues = s.issues.filter(i => !removeIssueSet.has(i));
  const newDupes = (s.dupes || []).filter(d => !removeDupeSet.has(d) && !removeDupeSet.has(d.replace(/^#/, '')));

  if (newIssues.length === 0) { dropped.push(s.id); continue; }

  const newKeys = (s.keys || []).filter(k => keyOverlapsRemaining(k.issue, newIssues));

  updated.push({ ...s, issues: newIssues, dupes: newDupes, keys: newKeys });
  changeSummary.push(`${s.id}: -${issuesToActuallyRemove.length} issue(s), -${dupesToRemove.length} dupe(s) -> ${newIssues.length} issues, ${newDupes.length} dupes, ${newKeys.length} keys`);
}

fs.writeFileSync(path, JSON.stringify(updated, null, 2) + '\n');

console.log('Dropped (no copies left):', dropped.join(', ') || '(none)');
console.log('Series changes:');
for (const line of changeSummary) console.log('  ' + line);
