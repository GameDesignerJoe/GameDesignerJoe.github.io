// Vercel serverless function: POST /api/generate  { category: "Superheroes", avoid: ["Batman", ...] }
// 200 → { clues: [ { clue, answer, alts: [] } x5 ], model }   ordered easy → hard; each clue is a question.
// 422 → { error: 'UNKNOWN_TOPIC: <why>' }  the model doesn't know enough real facts (private people, small
//        companies, local places). We refuse rather than let it make things up.
// 422 → { error: 'NOT_ALLOWED: <why>' }    hateful / sexual / otherwise not OK for a party game.
// 502 → { error: ... }                      Groq or parsing failed.
// The Groq key lives in Vercel's environment variables, never in the page.

const MODEL = 'openai/gpt-oss-120b';
const N = 5;

const SYSTEM = `You write questions for a trivia party game. Players read each question aloud; one player judges the spoken answer against yours.

STEP 1 — decide whether you can do this honestly. Answer "unknown" if the category is about a private person, a small or local organisation, a local place, a group's inside joke, or anything else where you cannot name ${N} specific, real, checkable facts from memory. Never invent facts. Answer "not_ok" if the category is hateful, sexual, or targets a real private person cruelly. Otherwise "ok".

STEP 2 — only if "ok", write exactly ${N} questions, easiest first, hardest last.
- Each is a real question ending with "?" (e.g. "Which planet is known as the Red Planet?"), 6-25 words, easy to read aloud.
- The answer must NOT appear anywhere in the question, not even partly.
- All ${N} answers must be different from each other, and none may be just the category's own name.
- Short, unambiguous answers a judge can check: a name, a number, a place, a title.
- Only facts you are confident are true. If you can't reach ${N} you are confident about, use "unknown" instead.
- Never reuse an answer from the avoid list.
- "alts" are other spoken forms the judge should accept (nicknames, surname only, abbreviations). Empty array if none.

Respond with JSON only:
{"verdict":"ok"|"unknown"|"not_ok","reason":"one short sentence","clues":[{"clue":"...?","answer":"...","alts":["..."]}]}`;

// ---------- checks (exported for tests) ----------
export const norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Why a single clue is unusable, or '' if it's fine. `others` = answers already accepted.
export function problem(q, category, others = []) {
  const clue = String(q?.clue || '').trim(), answer = String(q?.answer || '').trim();
  if (!clue || !answer) return 'empty';
  if (!clue.endsWith('?')) return 'not phrased as a question';
  const words = clue.split(/\s+/).length; if (words < 4 || words > 32) return 'wrong length';
  const a = norm(answer), c = norm(clue), cat = norm(category);
  if (!a) return 'empty answer';
  const inClue = x => { const n = norm(x); return n.length >= 3 ? ` ${c} `.includes(` ${n} `) || (n.length >= 5 && c.replace(/ /g, '').includes(n.replace(/ /g, ''))) : false; };
  if (inClue(answer) || (q.alts || []).some(inClue)) return 'answer is given away in the question';
  if (a === cat || (a.length >= 3 && ` ${cat} `.includes(` ${a} `))) return 'answer is just the category name';
  if (others.some(o => norm(o) === a)) return 'same answer as another question';
  return '';
}

export function clean(list) {
  return (Array.isArray(list) ? list : []).map(c => ({
    clue: String(c?.clue || '').trim(),
    answer: String(c?.answer || '').trim(),
    alts: Array.isArray(c?.alts) ? c.alts.map(String).map(s => s.trim()).filter(Boolean).slice(0, 4) : [],
  }));
}

// Keep the good ones in order; report the bad ones by index.
export function sift(list, category, avoid = []) {
  const good = [], bad = [];
  const avoidN = new Set(avoid.map(norm));
  list.forEach((q, i) => {
    let why = problem(q, category, good.map(g => g.answer));
    if (!why && avoidN.has(norm(q.answer))) why = 'already used by this group';
    if (why) bad.push({ i, q, why }); else good.push(q);
  });
  return { good, bad };
}

async function groq(key, messages) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.6, reasoning_effort: 'medium', response_format: { type: 'json_object' }, messages }),
  });
  if (!r.ok) { const t = await r.text(); const e = new Error(`Groq ${r.status}`); e.detail = t.slice(0, 500); throw e; }
  const data = await r.json();
  return { parsed: JSON.parse(data.choices[0].message.content), usage: data.usage };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel environment variables' });

  const { category, avoid = [] } = req.body || {};
  if (!category || typeof category !== 'string') return res.status(400).json({ error: 'category required' });
  const cat = category.trim().slice(0, 60);
  const avoidList = (Array.isArray(avoid) ? avoid : []).map(String).slice(0, 40);
  const user = `Category: ${cat}` + (avoidList.length ? `\nAvoid these answers (already used): ${avoidList.join('; ')}` : '');

  try {
    const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
    const first = await groq(key, messages);
    const v = String(first.parsed.verdict || '').toLowerCase(), reason = String(first.parsed.reason || '').slice(0, 160);
    if (v === 'unknown') return res.status(422).json({ error: `UNKNOWN_TOPIC: ${reason}` });
    if (v === 'not_ok') return res.status(422).json({ error: `NOT_ALLOWED: ${reason}` });

    let { good, bad } = sift(clean(first.parsed.clues).slice(0, N + 2), cat, avoidList);
    let rounds = 1;
    // One repair round: say exactly what was wrong and ask for replacements only.
    if (good.length < N) {
      rounds++;
      const need = N - good.length;
      const fix = `Some questions were unusable:\n${bad.map(b => `- "${b.q.clue}" (answer "${b.q.answer}"): ${b.why}`).join('\n')}\n` +
        `Keep these good ones: ${good.map(g => `"${g.answer}"`).join(', ') || 'none'}.\n` +
        `Write ${need} new question(s) for the same category with answers different from all of the above. Same rules. If you can't do it honestly, set verdict "unknown". Same JSON shape, only the new questions in "clues".`;
      const second = await groq(key, [...messages, { role: 'assistant', content: JSON.stringify(first.parsed) }, { role: 'user', content: fix }]);
      if (String(second.parsed.verdict || '').toLowerCase() === 'unknown') return res.status(422).json({ error: `UNKNOWN_TOPIC: ${String(second.parsed.reason || reason).slice(0, 160)}` });
      const more = sift([...good, ...clean(second.parsed.clues)], cat, avoidList);
      good = more.good; bad = more.bad;
    }
    if (good.length < N) return res.status(422).json({ error: `UNKNOWN_TOPIC: could only write ${good.length} clean questions`, detail: bad.map(b => b.why) });
    // Repairs were appended at the end; they're usually mid-difficulty, which is close enough to easy→hard.
    return res.status(200).json({ clues: good.slice(0, N), model: MODEL, rounds });
  } catch (e) {
    return res.status(502).json({ error: e.message?.startsWith('Groq') ? e.message : 'generation failed', detail: e.detail || String(e.message || e) });
  }
}
