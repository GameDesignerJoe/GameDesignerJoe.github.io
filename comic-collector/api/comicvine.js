// Vercel serverless function: look up a comic via ComicVine using the jackscomics pattern.
// Accepts query: ?title=...&year=...&issue=...   (year optional, issue optional)
// Uses server-side COMIC_VINE_API_KEY env var.
// Returns top matching volume + the requested issue (cover, name, date, etc.)

const API_BASE = 'https://comicvine.gamespot.com/api';
const UA = 'ComicCollector/1.0 (vercel)';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed — use GET.' });
  }

  const KEY = process.env.COMIC_VINE_API_KEY;
  if (!KEY) {
    return res.status(500).json({ ok: false, error: 'COMIC_VINE_API_KEY env var not set.' });
  }

  const title = (req.query.title || '').toString().trim();
  const year = req.query.year ? Number(req.query.year) : null;
  const issue = (req.query.issue || '').toString().replace(/^#/, '').trim();

  if (!title) return res.status(400).json({ ok: false, error: 'Missing "title" query parameter.' });

  try {
    // 1) Find candidate volumes by name; sort by year proximity if year is given.
    const volRes = await fetch(
      `${API_BASE}/volumes/?api_key=${KEY}&format=json&filter=name:${encodeURIComponent(title)}&field_list=id,name,start_year,publisher,count_of_issues,image&limit=10`,
      { headers: { 'User-Agent': UA } }
    );
    if (!volRes.ok) throw new Error(`Volume search failed: ${volRes.status}`);
    const volJson = await volRes.json();
    if (volJson.status_code !== 1) throw new Error(`ComicVine error ${volJson.status_code}: ${volJson.error}`);

    const candidates = (volJson.results || []).map(v => ({
      id: v.id,
      name: v.name,
      start_year: v.start_year ? Number(v.start_year) : null,
      publisher: v.publisher?.name || null,
      count_of_issues: v.count_of_issues || null,
      image_url: v.image?.original_url || null,
    }));

    if (candidates.length === 0) {
      return res.status(404).json({ ok: false, error: 'No volumes matched that title.', candidates: [] });
    }

    // Pick the best candidate. Year match wins; otherwise lowest absolute year distance.
    let best;
    if (year) {
      const sorted = [...candidates].sort((a, b) =>
        Math.abs((a.start_year ?? 9999) - year) - Math.abs((b.start_year ?? 9999) - year)
      );
      best = sorted[0];
    } else {
      best = candidates[0];
    }

    // 2) If an issue number is provided, fetch that specific issue from the chosen volume.
    let issueData = null;
    if (issue) {
      const issRes = await fetch(
        `${API_BASE}/issues/?api_key=${KEY}&format=json&filter=volume:${best.id},issue_number:${encodeURIComponent(issue)}&field_list=id,name,issue_number,cover_date,store_date,image,description`,
        { headers: { 'User-Agent': UA } }
      );
      if (!issRes.ok) throw new Error(`Issue fetch failed: ${issRes.status}`);
      const issJson = await issRes.json();
      if (issJson.status_code === 1 && issJson.results?.length > 0) {
        const i = issJson.results[0];
        issueData = {
          cv_id: i.id,
          name: i.name || '',
          issue_number: i.issue_number,
          cover_date: i.cover_date || null,
          store_date: i.store_date || null,
          image_url: i.image?.original_url || i.image?.super_url || i.image?.medium_url || null,
          cv_detail_url: `https://comicvine.gamespot.com/issue/4000-${i.id}/`,
        };
      }
    }

    return res.status(200).json({
      ok: true,
      volume: best,
      candidates,
      issue: issueData,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
