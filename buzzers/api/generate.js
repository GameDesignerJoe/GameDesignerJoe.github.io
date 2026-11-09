// Vercel serverless function: POST /api/generate  { category: "Superheroes", avoid: ["Batman", ...], search?: bool, debug?: bool }
// 200 → { clues: [ { clue, answer, alts: [], source? } x5 ], model, mode, rounds }   easy → hard; each clue is a question.
// 422 → { error: 'UNKNOWN_TOPIC: <why>' }  not enough real, checkable facts (private people, small companies,
//        local places, or the search found nothing). We refuse rather than let it make things up.
// 422 → { error: 'NOT_ALLOWED: <why>' }    hateful / sexual / otherwise not OK for a party game.
// 502 → { error: ... }                      Groq or parsing failed.
// The Groq key lives in Vercel's environment variables, never in the page.
//
// Two modes:
//  search (default when SEARCH is true or the request says search:true): step 1 searches the web (Groq's
//    browser_search tool) and writes a numbered fact sheet with a source URL per fact; step 2 writes the
//    questions from those facts only, each citing its fact. Code then checks every question against its fact.
//  memory: the model writes from what it remembers. Faster, but it makes up details (years, studios).

export const maxDuration = 60; // seconds; a search + write takes ~10-25 s

const MODEL = 'openai/gpt-oss-120b';
const N = 5;
const SEARCH_DEFAULT = false; // flip once search mode is verified live

const RULES = `- Each is a real question ending with "?" (e.g. "Which planet is known as the Red Planet?"), 6-25 words, easy to read aloud.
- The answer must NOT appear anywhere in the question, not even partly.
- All ${N} answers must be different from each other, and none may be just the category's own name.
- Short, unambiguous answers a judge can check: a name, a number, a place, a title.
- Every question must have exactly ONE right answer. Pin it down with specific details: a year, a developer/studio/author, a character, a place, a number, a quote, a record. Ask yourself "could someone who knows this topic name a different answer that also fits?" If yes, add details until they couldn't.
- No opinion words as the main clue ("bad", "best", "worst", "famous", "popular", "iconic", "classic"). "Which bad shooter game came out in 2011?" is useless; "Which 2011 shooter, stuck in development for 14 years, was finished by Gearbox?" is good.
- Never reuse an answer from the avoid list.
- "alts" are other spoken forms the judge should accept (nicknames, surname only, abbreviations). Empty array if none.`;

const SYSTEM_MEMORY = `You write questions for a trivia party game. Players read each question aloud; one player judges the spoken answer against yours.

STEP 1 — decide whether you can do this honestly. Answer "unknown" if the category is about a private person, a small or local organisation, a local place, a group's inside joke, or anything else where you cannot name ${N} specific, real, checkable facts from memory. Never invent facts. Answer "not_ok" if the category is hateful, sexual, or targets a real private person cruelly. Otherwise "ok".

STEP 2 — only if "ok", write exactly ${N} questions, easiest first, hardest last.
${RULES}
- Only facts you are confident are true. If you can't reach ${N} you are confident about, use "unknown" instead.

Respond with JSON only:
{"verdict":"ok"|"unknown"|"not_ok","reason":"one short sentence","clues":[{"clue":"...?","answer":"...","alts":["..."]}]}`;

const RESEARCH = cat => `Search the web for trivia material about this category: "${cat}".
Read several reliable pages (encyclopedias, official sites, reputable databases, fan wikis for fiction). Then list up to 15 facts that could each become a fun party trivia question with ONE short answer that players can shout out: a name, a title, a character, a place, a thing. 
- Spread across the WHOLE category: many different subjects (different games, films, people, places), never more than 2 facts about the same one, and from at least 4 different pages.
- Mix well known (most people at a party could get it) with a few for real fans.
- Answers should NOT be budgets, sales figures, exact dates or long numbers. At most 2 facts whose answer is a year or number.
- Write every specific detail (years, names, studios, places) exactly as the page states it.
Only facts you actually read on a page during this search. Nothing from memory. If the search finds nothing reliable about this exact subject (for example a private person, a small local thing, or an inside joke), list nothing.
Format, one fact per line, exactly:
F1 | <the fact, one sentence> | <short answer> | <source URL>
Last line, exactly one of:
VERDICT: ok
VERDICT: unknown | <why, one short sentence>`;

const SYSTEM_FACTS = `You write questions for a trivia party game from a researched fact sheet. Players read each question aloud; one player judges the spoken answer against yours.

STEP 1 — answer "not_ok" if the category is hateful, sexual, or targets a real private person cruelly. Answer "unknown" if the fact sheet doesn't have ${N} usable facts about this category. Otherwise "ok".

STEP 2 — only if "ok", write exactly ${N} questions, easiest first, hardest last, using ONLY the fact sheet.
- Each question is built from one fact and gives its number in "fact". Every detail in the question (years, names, numbers) must be stated in that fact. Never add details from memory, even ones you think are true.
- The answer must be that fact's answer (or the same thing said differently).
- Pick the ${N} most fun facts, about ${N} different subjects (never two questions about the same film, game, person, etc.).
- At most one question whose answer is a year or number. Never a full date or an amount of money.
${RULES}

Respond with JSON only:
{"verdict":"ok"|"unknown"|"not_ok","reason":"one short sentence","clues":[{"clue":"...?","answer":"...","alts":["..."],"fact":1}]}`;

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
  if (/[$£€¥]|(million|billion|thousand)/i.test(answer)) return 'money or big number as the answer (not fun to shout)';
  if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\d\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(answer)) return 'full date as the answer (too hard to get exactly)';
  if (/^[\d.,\s]+$/.test(answer) && others.some(o => /^[\d.,\s]+$/.test(String(o)))) return 'already have a number/year question';
  return '';
}

// The question must cite a fact from the sheet, and its answer must match that fact's answer.
export function factProblem(q, facts) {
  const f = facts.find(x => x.n === Number(q?.fact));
  if (!f) return 'not built from a fact on the sheet';
  const a = norm(q.answer), fa = norm(f.answer), ft = norm(f.text);
  const same = a === fa || (a.length >= 3 && (` ${fa} `.includes(` ${a} `) || ` ${a} `.includes(` ${fa} `))) ||
    [q.answer, ...(q.alts || [])].some(x => norm(x) === fa) || (a.length >= 4 && ` ${ft} `.includes(` ${a} `));
  return same ? '' : `answer doesn't match fact F${f.n} ("${f.answer}")`;
}

export function clean(list) {
  return (Array.isArray(list) ? list : []).map(c => ({
    clue: String(c?.clue || '').trim(),
    answer: String(c?.answer || '').trim(),
    alts: Array.isArray(c?.alts) ? [...new Set(c.alts.map(String).map(s => s.trim()).filter(x => x && norm(x) !== norm(c?.answer)))].slice(0, 4) : [],
    ...(c?.fact != null ? { fact: Number(c.fact) } : {}),
  }));
}

// Keep the good ones in order; report the bad ones by index. With `facts`, each must also match its fact.
export function sift(list, category, avoid = [], facts = null) {
  const good = [], bad = [];
  const avoidN = new Set(avoid.map(norm));
  list.forEach((q, i) => {
    let why = problem(q, category, good.map(g => g.answer));
    if (!why && avoidN.has(norm(q.answer))) why = 'already used by this group';
    if (!why && facts) why = factProblem(q, facts);
    if (!why && facts && good.some(g => g.fact === q.fact)) why = 'same fact as another question';
    if (why) bad.push({ i, q, why }); else good.push(q);
  });
  return { good, bad };
}

// "F3 | fact | answer | https://..." lines → [{ n, text, answer, url }], plus the verdict line.
export function parseSheet(text) {
  const facts = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.replace(/\*\*/g, '').match(/^\s*[-*]?\s*F(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*<?(https?:\/\/[^\s|>\]]+)/i);
    if (m) { let url = m[4]; while (url.endsWith(')') && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) url = url.slice(0, -1); facts.push({ n: Number(m[1]), text: m[2], answer: m[3], url }); }
  }
  const v = String(text || '').match(/VERDICT:\s*(ok|unknown)\s*\|?\s*(.*)/i);
  return { facts, verdict: v ? v[1].toLowerCase() : (facts.length ? 'ok' : 'unknown'), why: v?.[2]?.trim() || '' };
}

async function call(key, body) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!r.ok) { const t = await r.text(); const e = new Error(`Groq ${r.status}`); e.detail = t.slice(0, 500); throw e; }
  return r.json();
}

async function groq(key, messages) {
  const data = await call(key, { temperature: 0.6, reasoning_effort: 'medium', response_format: { type: 'json_object' }, messages });
  return { parsed: JSON.parse(data.choices[0].message.content), usage: data.usage };
}

async function research(key, cat) {
  const data = await call(key, { temperature: 0.3, reasoning_effort: 'low', max_completion_tokens: 4000, tool_choice: 'required', tools: [{ type: 'browser_search' }],
    messages: [{ role: 'user', content: RESEARCH(cat) }] });
  const msg = data.choices[0].message;
  return { text: msg.content || '', searches: (msg.executed_tools || []).length, usage: data.usage };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel environment variables' });

  const { category, avoid = [], search = SEARCH_DEFAULT, debug = false } = req.body || {};
  if (!category || typeof category !== 'string') return res.status(400).json({ error: 'category required' });
  const cat = category.trim().slice(0, 60);
  const avoidList = (Array.isArray(avoid) ? avoid : []).map(String).slice(0, 40);
  const avoidLine = avoidList.length ? `\nAvoid these answers (already used): ${avoidList.join('; ')}` : '';
  const t0 = Date.now();
  let sheet = null;

  try {
    let messages;
    if (search) {
      const r = await research(key, cat);
      sheet = { ...parseSheet(r.text), searches: r.searches, ms: Date.now() - t0 };
      if (debug) sheet.raw = r.text;
      if (sheet.verdict === 'unknown' || sheet.facts.length < N) {
        return res.status(422).json({ error: `UNKNOWN_TOPIC: ${sheet.why || `the search only found ${sheet.facts.length} usable facts`}`, ...(debug ? { sheet } : {}) });
      }
      const list = sheet.facts.map(f => `F${f.n} | ${f.text} | answer: ${f.answer}`).join('\n');
      messages = [{ role: 'system', content: SYSTEM_FACTS }, { role: 'user', content: `Category: ${cat}${avoidLine}\n\nFact sheet:\n${list}` }];
    } else {
      messages = [{ role: 'system', content: SYSTEM_MEMORY }, { role: 'user', content: `Category: ${cat}${avoidLine}` }];
    }
    const facts = sheet?.facts || null;
    const extra = debug && sheet ? { sheet } : {};

    const first = await groq(key, messages);
    const v = String(first.parsed.verdict || '').toLowerCase(), reason = String(first.parsed.reason || '').slice(0, 160);
    if (v === 'unknown') return res.status(422).json({ error: `UNKNOWN_TOPIC: ${reason}`, ...extra });
    if (v === 'not_ok') return res.status(422).json({ error: `NOT_ALLOWED: ${reason}`, ...extra });

    let { good, bad } = sift(clean(first.parsed.clues).slice(0, N + 2), cat, avoidList, facts);
    let rounds = 1;
    // One repair round: say exactly what was wrong and ask for replacements only.
    if (good.length < N) {
      rounds++;
      const need = N - good.length;
      const fix = `Some questions were unusable:\n${bad.map(b => `- "${b.q.clue}" (answer "${b.q.answer}"): ${b.why}`).join('\n')}\n` +
        `Keep these good ones: ${good.map(g => `"${g.answer}"`).join(', ') || 'none'}.\n` +
        `Write ${need} new question(s) for the same category with answers different from all of the above${facts ? ', each from a fact not used yet' : ''}. Same rules. If you can't do it honestly, set verdict "unknown". Same JSON shape, only the new questions in "clues".`;
      const second = await groq(key, [...messages, { role: 'assistant', content: JSON.stringify(first.parsed) }, { role: 'user', content: fix }]);
      if (String(second.parsed.verdict || '').toLowerCase() === 'unknown') return res.status(422).json({ error: `UNKNOWN_TOPIC: ${String(second.parsed.reason || reason).slice(0, 160)}`, ...extra });
      const more = sift([...good, ...clean(second.parsed.clues)], cat, avoidList, facts);
      good = more.good; bad = more.bad;
    }
    if (good.length < N) return res.status(422).json({ error: `UNKNOWN_TOPIC: could only write ${good.length} clean questions`, detail: bad.map(b => b.why), ...extra });
    // Each searched clue carries the page its fact came from.
    const clues = good.slice(0, N).map(({ fact, ...q }) => facts ? { ...q, source: facts.find(f => f.n === fact)?.url } : q);
    return res.status(200).json({ clues, model: MODEL, mode: search ? 'search' : 'memory', rounds, ms: Date.now() - t0, ...extra });
  } catch (e) {
    return res.status(502).json({ error: e.message?.startsWith('Groq') ? e.message : 'generation failed', detail: e.detail || String(e.message || e), ...(debug && sheet ? { sheet } : {}) });
  }
}
