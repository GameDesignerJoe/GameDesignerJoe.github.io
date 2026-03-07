export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, type } = req.query;
  if (!id || !type || !['tv', 'movie'].includes(type)) {
    return res.status(400).json({ error: 'Missing or invalid id/type parameter' });
  }

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=videos,watch/providers`;
    const tmdbRes = await fetch(tmdbUrl);
    const data = await tmdbRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('TMDB details error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
