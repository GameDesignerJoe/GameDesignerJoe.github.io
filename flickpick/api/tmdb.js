export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const year = req.query.year;
    let tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
    if (year) tmdbUrl += `&year=${year}`;
    const tmdbRes = await fetch(tmdbUrl);
    const data = await tmdbRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('TMDB API error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
