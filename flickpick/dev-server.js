// Local dev server — mimics Vercel's behavior for testing
// Usage: node dev-server.js
// Then open http://localhost:3000

import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

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

  // Serve index.html for everything else
  if (req.method === 'GET') {
    try {
      const html = await readFile(join(__dirname, 'index.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Flickpick dev server running at http://localhost:${PORT}`);
});
