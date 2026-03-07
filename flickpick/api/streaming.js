export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tmdbId, type } = req.query;
  if (!tmdbId || !type || !['tv', 'movie'].includes(type)) {
    return res.status(400).json({ error: 'Missing or invalid tmdbId/type parameter' });
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
    return res.status(apiRes.status).json(data);
  } catch (err) {
    console.error('Streaming Availability error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
