// Returns the current deploy's commit SHA and environment, so the UI
// can show a unique build tag without manual version bumping.
// Vercel injects VERCEL_GIT_COMMIT_SHA and VERCEL_ENV at runtime.
export default function handler(req, res) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
  const env = process.env.VERCEL_ENV || 'development';
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    sha: sha.substring(0, 7) || null,
    env,
  });
}
