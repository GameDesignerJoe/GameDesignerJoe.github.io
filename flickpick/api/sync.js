import { put, list } from '@vercel/blob';

const blobKey = (code) => `flickpick-sync/${code.trim().toLowerCase()}.json`;

function isValidCode(code) {
  return typeof code === 'string' && /^[a-z0-9_\-]{2,40}$/i.test(code.trim());
}

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Server missing BLOB_READ_WRITE_TOKEN env var' });
  }

  if (req.method === 'PUT') {
    const { code, state } = req.body || {};
    if (!isValidCode(code)) return res.status(400).json({ error: 'Invalid sync code' });
    if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Missing state' });

    try {
      const content = JSON.stringify({ state, updatedAt: new Date().toISOString() });
      await put(blobKey(code), content, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        // Disable CDN caching so subsequent GETs always see the latest write.
        // Without this, Vercel's edge cache can serve stale snapshots and the
        // merge logic on other devices loses the most recent items.
        cacheControlMaxAge: 0,
      });
      // Also disable response caching from this serverless function itself.
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Sync PUT error:', err);
      return res.status(500).json({ error: `Cloud write failed: ${err.message || 'unknown'}` });
    }
  }

  if (req.method === 'GET') {
    const code = req.query.code;
    if (!isValidCode(code)) return res.status(400).json({ error: 'Invalid sync code' });

    try {
      const { blobs } = await list({ prefix: blobKey(code) });
      if (!blobs.length) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json({ state: null });
      }
      // Bypass any CDN cache by appending a cache-buster + asking fetch not to cache.
      const freshUrl = `${blobs[0].url}${blobs[0].url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const blobRes = await fetch(freshUrl, { cache: 'no-store' });
      if (!blobRes.ok) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json({ state: null });
      }
      const data = await blobRes.json();
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ state: data.state ?? null, updatedAt: data.updatedAt ?? null });
    } catch (err) {
      console.error('Sync GET error:', err);
      return res.status(500).json({ error: `Cloud read failed: ${err.message || 'unknown'}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
