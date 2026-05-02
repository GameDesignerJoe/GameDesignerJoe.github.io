// Local dev server — mimics Vercel's behavior for testing
// Usage: node dev-server.js
// Then open http://localhost:3000

import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { put, list } from '@vercel/blob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const server = createServer(async (req, res) => {
  // Handle API proxy
  if (req.method === 'POST' && req.url === '/api/recommend') {
    let body = '';
    for await (const chunk of req) body += chunk;

    try {
      const { messages, model, max_tokens } = JSON.parse(body);

      if (!messages || !Array.isArray(messages)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
        return;
      }

      const response = await client.messages.create({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 1024,
        messages,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      console.error('API error:', err.message);
      res.writeHead(err.status || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle TMDB search proxy
  if (req.method === 'GET' && req.url.startsWith('/api/tmdb?')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const query = params.get('query');
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter' }));
      return;
    }

    try {
      const year = params.get('year');
      let tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
      if (year) tmdbUrl += `&year=${year}`;
      const tmdbRes = await fetch(tmdbUrl);
      const data = await tmdbRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('TMDB error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle TMDB details proxy (trailers + watch providers)
  if (req.method === 'GET' && req.url.startsWith('/api/tmdb-details?')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const id = params.get('id');
    const type = params.get('type');
    if (!id || !type || !['tv', 'movie'].includes(type)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid id/type' }));
      return;
    }

    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=videos,watch/providers`;
      const tmdbRes = await fetch(tmdbUrl);
      const data = await tmdbRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('TMDB details error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle TMDB recommendations proxy
  if (req.method === 'GET' && req.url.startsWith('/api/tmdb-recommendations?')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const id = params.get('id');
    const type = params.get('type');
    if (!id || !type || !['tv', 'movie'].includes(type)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid id/type' }));
      return;
    }

    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=1`;
      const tmdbRes = await fetch(tmdbUrl);
      const data = await tmdbRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('TMDB recommendations error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle Streaming Availability proxy (direct service links)
  if (req.method === 'GET' && req.url.startsWith('/api/streaming?')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const tmdbId = params.get('tmdbId');
    const type = params.get('type');
    if (!tmdbId || !type || !['tv', 'movie'].includes(type)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid tmdbId/type' }));
      return;
    }

    try {
      const showId = `${type}/${tmdbId}`;
      const url = `https://streaming-availability.p.rapidapi.com/shows/${showId}?country=us&series_granularity=show`;
      const apiRes = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': process.env.STREAM_AVAIL_API_KEY,
          'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com'
        }
      });
      const data = await apiRes.json();
      res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('Streaming Availability error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Version info — mirrors /api/version.js. Reads api/_version.json if it
  // exists (generated by `npm run vercel-build`). Otherwise falls back to
  // computing live from git so local dev still shows a sensible build tag.
  if (req.method === 'GET' && req.url.startsWith('/api/version')) {
    let version = null;
    let sha = null;
    try {
      const versionFile = join(__dirname, 'api', '_version.json');
      try {
        const raw = await readFile(versionFile, 'utf-8');
        const data = JSON.parse(raw);
        version = data.version || null;
        sha = data.sha || null;
      } catch {
        // No generated file — compute live from git for dev convenience.
        const { execSync } = await import('node:child_process');
        const pkgRaw = await readFile(join(__dirname, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        const [major, minor] = pkg.version.split('.');
        try {
          // Scope to flickpick-only commits so sibling projects don't bump us.
          const count = parseInt(execSync(`git rev-list --count HEAD -- .`, { cwd: __dirname }).toString().trim(), 10);
          version = `${major}.${minor}.${count}`;
          sha = execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim().substring(0, 7);
        } catch {
          version = pkg.version;
        }
      }
    } catch (e) {
      console.warn('Version lookup failed:', e.message);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ version, sha, env: 'development' }));
    return;
  }

  // Cloud sync (Vercel Blob)
  if (req.url === '/api/sync' || req.url.startsWith('/api/sync?')) {
    const blobKey = (code) => `flickpick-sync/${code.trim().toLowerCase()}.json`;
    const isValidCode = (code) => typeof code === 'string' && /^[a-z0-9_\-]{2,40}$/i.test(code.trim());

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server missing BLOB_READ_WRITE_TOKEN env var' }));
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const { code, state } = JSON.parse(body);
        if (!isValidCode(code)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid sync code' }));
          return;
        }
        if (!state || typeof state !== 'object') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing state' }));
          return;
        }
        const content = JSON.stringify({ state, updatedAt: new Date().toISOString() });
        await put(blobKey(code), content, {
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 0,
        });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error('Sync PUT error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Cloud write failed: ${err.message || 'unknown'}` }));
      }
      return;
    }

    if (req.method === 'GET') {
      const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
      const code = params.get('code');
      if (!isValidCode(code)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid sync code' }));
        return;
      }
      try {
        const { blobs } = await list({ prefix: blobKey(code) });
        const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' };
        if (!blobs.length) {
          res.writeHead(200, headers);
          res.end(JSON.stringify({ state: null }));
          return;
        }
        const freshUrl = `${blobs[0].url}${blobs[0].url.includes('?') ? '&' : '?'}t=${Date.now()}`;
        const blobRes = await fetch(freshUrl, { cache: 'no-store' });
        if (!blobRes.ok) {
          res.writeHead(200, headers);
          res.end(JSON.stringify({ state: null }));
          return;
        }
        const data = await blobRes.json();
        res.writeHead(200, headers);
        res.end(JSON.stringify({ state: data.state ?? null, updatedAt: data.updatedAt ?? null }));
      } catch (err) {
        console.error('Sync GET error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Cloud read failed: ${err.message || 'unknown'}` }));
      }
      return;
    }
  }

  // Serve static files
  if (req.method === 'GET') {
    const MIME_TYPES = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };

    // Map URL path to file — default to index.html for bare /
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const contentType = MIME_TYPES[ext] || 'text/html';

    try {
      const data = await readFile(join(__dirname, filePath));
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch {
      // Fall back to index.html for SPA routes
      try {
        const html = await readFile(join(__dirname, 'index.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    }
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Flickpick dev server running at http://localhost:${PORT}`);
});
