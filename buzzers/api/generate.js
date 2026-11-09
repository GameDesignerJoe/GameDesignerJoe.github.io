// Vercel serverless function: POST /api/generate  { category: "Superheroes", avoid: ["Batman", ...] }
// Returns { clues: [ { clue, answer, alts: [] } x5 ] } ordered easy → hard.
// The Groq key lives in Vercel's environment variables, never in the page.

const MODEL = 'openai/gpt-oss-120b'; // fast, cheap, good at trivia. Fallback: 'llama-3.3-70b-versatile'

const SYSTEM = `You write clues for a Jeopardy-style party game. The players read clues aloud to each other; one of them will judge the spoken answer against the answer you give, so answers must be short, unambiguous, and sayable.

Rules:
- Write exactly 5 clues for the category, ordered from easiest to hardest. Clue 1 should be gettable by almost anyone; clue 5 should be a genuine stumper.
- Clues are statements, not questions, 8-25 words, no "this" trickery that hides the subject so hard it can't be read aloud naturally.
- Prefer real, checkable facts. If the category is silly or a joke, play along in the spirit but keep answers concrete.
- Never reuse an answer from the avoid list, and never use the same answer twice.
- "alts" are other phrasings the judge should accept (nicknames, first/last name only, abbreviations). Empty array if none.
Respond with JSON only: {"clues":[{"clue":"...","answer":"...","alts":["..."]}]}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel environment variables' });

  const { category, avoid = [] } = req.body || {};
  if (!category || typeof category !== 'string') return res.status(400).json({ error: 'category required' });

  const user = `Category: ${category.trim().slice(0, 60)}` + (avoid.length ? `\nAvoid these answers (already used): ${avoid.slice(0, 40).join('; ')}` : '');

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: `Groq ${r.status}`, detail: text.slice(0, 500) });
    }
    const data = await r.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const clues = (parsed.clues || []).slice(0, 5).map(c => ({
      clue: String(c.clue || '').trim(),
      answer: String(c.answer || '').trim(),
      alts: Array.isArray(c.alts) ? c.alts.map(String).slice(0, 4) : [],
    })).filter(c => c.clue && c.answer);
    if (clues.length !== 5) return res.status(502).json({ error: 'model returned ' + clues.length + ' clues', detail: parsed });
    return res.status(200).json({ clues, model: MODEL });
  } catch (e) {
    return res.status(502).json({ error: 'generation failed', detail: String(e.message || e) });
  }
}