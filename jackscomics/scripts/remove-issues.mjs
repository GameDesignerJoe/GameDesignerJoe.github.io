// One-shot: remove individual physical books Mom flagged as no longer in the collection.
// For an issue that has a duplicate, removing it once means "lose one copy" — keep the
// issue in `issues` and just remove it from `dupes`. Only fully-singleton issues drop out.
// Also flips Special Marvel Edition (1971) into the Thor box.
import fs from 'node:fs';

const path = new URL('../series.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const removals = {
  'avengers': ['2','3','4','5','6','7','8','9','10','19','21','28','34','47','48','52','54','55','57','70','80'],
  'captain-marvel': ['17'],
  'conan': ['2','3'],
  'doctor-strange': ['169','170','171','172','173','174','175','176','177','178','179','180','181','183'],
  'nick-fury': ['1','3','4','5','6'],
  'tales-to-astonish': ['47','93','100'],
  'marvel-tales': ['1'],
  'strange-tales': ['135'],
  'thor': ['126','165','166'],
  'journey-into-mystery': ['91','112','114','125'],
  'x-men': ['Annual 1','7','13','14','15','16','17','18','20','21','22','23','24','27','29','30','32','34','36','37','38','39','40','41','42','43','44','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67'],
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
  // Apply the SME → Thor box move regardless of removals.
  const series = (s.id === 'special-marvel-edition') ? { ...s, box: 4 } : { ...s };

  const remove = removals[series.id];
  if (!remove) { updated.push(series); continue; }

  const dupeSet = new Set(series.dupes || []);
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
  const newIssues = series.issues.filter(i => !removeIssueSet.has(i));
  const newDupes = (series.dupes || []).filter(d => !removeDupeSet.has(d) && !removeDupeSet.has(d.replace(/^#/, '')));

  if (newIssues.length === 0) { dropped.push(series.id); continue; }

  const newKeys = (series.keys || []).filter(k => keyOverlapsRemaining(k.issue, newIssues));

  updated.push({ ...series, issues: newIssues, dupes: newDupes, keys: newKeys });
  changeSummary.push(`${series.id}: -${issuesToActuallyRemove.length} issue(s), -${dupesToRemove.length} dupe(s) → ${newIssues.length} issues, ${newDupes.length} dupes, ${newKeys.length} keys`);
}

fs.writeFileSync(path, JSON.stringify(updated, null, 2) + '\n');

console.log('Dropped (no copies left):', dropped.join(', ') || '(none)');
console.log('Series changes:');
for (const line of changeSummary) console.log('  ' + line);
const sme = updated.find(s => s.id === 'special-marvel-edition');
if (sme) console.log(`Special Marvel Edition is in box ${sme.box}`);
