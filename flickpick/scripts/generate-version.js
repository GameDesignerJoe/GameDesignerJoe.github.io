// Build-time version stamper. Writes api/_version.json with:
//   { version: "<major>.<minor>.<commitCount>", sha: "<7-char>" }
// Major.minor come from package.json (manual bumps for real releases). The
// patch is the total commit count on this branch, so every commit auto-ticks
// the displayed version without us tracking semver by hand.
//
// Runs as Vercel's `vercel-build` (see package.json). Locally you can also
// run `npm run vercel-build` to refresh the file for dev.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const [major, minor] = pkg.version.split('.');

let commitCount = 0;
let sha = '';

try {
  // Vercel does shallow clones — unshallow so rev-list --count returns
  // the real history length. Ignore failure (already deep, or not a repo).
  try { execSync('git fetch --unshallow', { stdio: 'pipe' }); } catch {}
  // Count only commits that touched the flickpick directory, so unrelated
  // sibling projects in this monorepo don't bump our version.
  const flickpickDir = path.join(__dirname, '..');
  commitCount = parseInt(execSync(`git rev-list --count HEAD -- "${flickpickDir}"`).toString().trim(), 10) || 0;
  sha = execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
} catch (e) {
  console.warn('[generate-version] git unavailable, using fallbacks:', e.message);
}

const version = `${major}.${minor}.${commitCount}`;
const out = { version, sha };
const apiDir = path.join(__dirname, '..', 'api');
fs.mkdirSync(apiDir, { recursive: true });
const outPath = path.join(apiDir, '_version.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`[generate-version] wrote ${outPath}: ${JSON.stringify(out)}`);
