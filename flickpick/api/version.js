// Returns the current deploy's version + SHA so the UI footer can display
// a unique build tag without manual bumping. The version comes from
// api/_version.json (written by scripts/generate-version.js during the
// Vercel build). The SHA also comes from VERCEL_GIT_COMMIT_SHA at runtime.
import fs from 'fs';
import path from 'path';

let cached = null;
function loadData() {
  if (cached) return cached;
  try {
    const p = path.join(process.cwd(), 'api', '_version.json');
    if (fs.existsSync(p)) cached = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  cached = cached || {};
  return cached;
}

export default function handler(req, res) {
  const data = loadData();
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || data.sha || '').substring(0, 7) || null;
  const env = process.env.VERCEL_ENV || 'development';
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    version: data.version || null,
    sha,
    env,
  });
}
