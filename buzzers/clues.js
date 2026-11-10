// Buzzers clue writer: category -> 5 checked questions, via Groq. Runs inside the room server
// (party/server.js imports it), so the Groq key and the answers never reach a phone.
//
// writeClues(key, category, avoid, { search }) ->
//   { ok: true, clues: [ { clue, answer, alts: [], source? } x5 ], model, mode, rounds, ms, tokens }   easy -> hard
//   { ok: false, error: 'UNKNOWN_TOPIC: <why>' }  not enough real, checkable facts (private people, small companies,
//        local places, or the search found nothing). We refuse rather than let it make things up.
//   { ok: false, error: 'NOT_ALLOWED: <why>' }    hateful / sexual / otherwise not OK for a party game.
//   { ok: false, error: 'Groq 429 ...' }          Groq or parsing failed.
//
// Two modes:
//  search (default): step 1 searches the web (Groq's browser_search tool) and writes a numbered fact sheet
//    with a source URL per fact; step 2 writes the questions from those facts only, each citing its fact.
//    Code then checks every question against its fact.
//  memory: the model writes from what it remembers. Faster and cheaper, but it makes up details (years,
//    studios). Used once the day's search budget is spent.
//
// Prompt injection: the category is player text inside the prompt. The worst it can do is get odd or rude
// questions onto that room's own board: output must be 5 short questions that pass the checks below, the
// key is never in a prompt, and phones show everything as escaped text.
const MODEL = 'openai/gpt-oss-120b';
const N = 5;

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
Read several reliable pages (encyclopedias, official sites, reputable databases, fan wikis for fiction), using at most 5 searches; a good overview or list page covers a lot. Then list up to 15 facts that could each become a fun party trivia question with ONE short answer that players can shout out: a name, a title, a character, a place, a thing. 
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
  if (/[$£€¥]|\b(million|billion|thousand)\b/i.test(answer)) return 'money or big number as the answer (not fun to shout)';
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\d\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(answer)) return 'full date as the answer (too hard to get exactly)';
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
    if (m) { let url = m[4].replace(/【.*$/, ''); while (url.endsWith(')') && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) url = url.slice(0, -1); facts.push({ n: Number(m[1]), text: m[2], answer: m[3], url }); }
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
  const data = await call(key, { temperature: 0.6, reasoning_effort: 'medium', max_completion_tokens: 6000, response_format: { type: 'json_object' }, messages });
  return { parsed: JSON.parse(data.choices[0].message.content), usage: data.usage };
}

async function research(key, cat) {
  const data = await call(key, { temperature: 0.3, reasoning_effort: 'low', max_completion_tokens: 4000, tool_choice: 'required', tools: [{ type: 'browser_search' }],
    messages: [{ role: 'user', content: RESEARCH(cat) }] });
  const msg = data.choices[0].message;
  return { text: msg.content || '', searches: (msg.executed_tools || []).length, usage: data.usage };
}

// One category. `avoid` = answers this group has already had for it.
export async function writeClues(key, category, avoid = [], { search = true } = {}) {
  const cat = String(category).trim().slice(0, 60);
  const avoidList = avoid.map(a => String(a).slice(0, 60)).slice(0, 40);
  const avoidLine = avoidList.length ? `\nAvoid these answers (already used): ${avoidList.join('; ')}` : '';
  const t0 = Date.now();
  let tokens = 0;
  const count = u => { tokens += u?.total_tokens || 0; };
  const fail = error => ({ ok: false, error, tokens, ms: Date.now() - t0 });
  try {
    let messages, sheet = null;
    if (search) {
      const r = await research(key, cat); count(r.usage);
      sheet = parseSheet(r.text);
      if (sheet.verdict === 'unknown' || sheet.facts.length < N) return fail(`UNKNOWN_TOPIC: ${sheet.why || `the search only found ${sheet.facts.length} usable facts`}`);
      const list = sheet.facts.map(f => `F${f.n} | ${f.text} | answer: ${f.answer}`).join('\n');
      messages = [{ role: 'system', content: SYSTEM_FACTS }, { role: 'user', content: `Category: ${cat}${avoidLine}\n\nFact sheet:\n${list}` }];
    } else {
      messages = [{ role: 'system', content: SYSTEM_MEMORY }, { role: 'user', content: `Category: ${cat}${avoidLine}` }];
    }
    const facts = sheet?.facts || null;

    const first = await groq(key, messages); count(first.usage);
    const v = String(first.parsed.verdict || '').toLowerCase(), reason = String(first.parsed.reason || '').slice(0, 160);
    if (v === 'unknown') return fail(`UNKNOWN_TOPIC: ${reason}`);
    if (v === 'not_ok') return fail(`NOT_ALLOWED: ${reason}`);

    let { good, bad } = sift(clean(first.parsed.clues).slice(0, N + 2), cat, avoidList, facts);
    let rounds = 1;
    // One repair round: say exactly what was wrong and ask for replacements only.
    if (good.length < N) {
      rounds++;
      const need = N - good.length;
      const fix = `Some questions were unusable:\n${bad.map(b => `- "${b.q.clue}" (answer "${b.q.answer}"): ${b.why}`).join('\n')}\n` +
        `Keep these good ones: ${good.map(g => `"${g.answer}"`).join(', ') || 'none'}.\n` +
        `Write ${need} new question(s) for the same category with answers different from all of the above${facts ? ', each from a fact not used yet' : ''}. Same rules. If you can't do it honestly, set verdict "unknown". Same JSON shape, only the new questions in "clues".`;
      const second = await groq(key, [...messages, { role: 'assistant', content: JSON.stringify(first.parsed) }, { role: 'user', content: fix }]); count(second.usage);
      if (String(second.parsed.verdict || '').toLowerCase() === 'unknown') return fail(`UNKNOWN_TOPIC: ${String(second.parsed.reason || reason).slice(0, 160)}`);
      good = sift([...good, ...clean(second.parsed.clues)], cat, avoidList, facts).good;
    }
    if (good.length < N) return fail(`UNKNOWN_TOPIC: could only write ${good.length} clean questions`);
    // Each searched clue carries the page its fact came from.
    const clues = good.slice(0, N).map(({ fact, ...q }) => facts ? { ...q, source: facts.find(f => f.n === fact)?.url } : q);
    return { ok: true, clues, model: MODEL, mode: search ? 'search' : 'memory', rounds, ms: Date.now() - t0, tokens };
  } catch (e) {
    const m = String(e.message || e);
    return fail(m.startsWith('Groq') ? `${m} ${String(e.detail || '').slice(0, 120)}` : `generation failed: ${m}`);
  }
}

// ---------- built-in categories ----------
// Our own categories with checked answers. Offered as chips, and used when live generation fails.
// Keep at least CONFIG.targetCategories of them so a board can always be filled without Groq.
export const BANK = {
  'Superheroes': [
    { clue: 'Which hero is secretly the billionaire Bruce Wayne?', answer: 'Batman', alts: ['the Dark Knight'] },
    { clue: 'Peter Parker swings around New York as which hero?', answer: 'Spider-Man', alts: ['Spidey', 'Spiderman'] },
    { clue: 'Which Asgardian god of thunder carries the hammer Mjölnir?', answer: 'Thor', alts: [] },
    { clue: 'Diana Prince of Themyscira is better known as which hero?', answer: 'Wonder Woman', alts: [] },
    { clue: 'T\'Challa is king of which hidden African nation?', answer: 'Wakanda', alts: [] },
  ],
  '90s Movies': [
    { clue: 'In which 1997 blockbuster does Rose let go of Jack in the icy Atlantic?', answer: 'Titanic', alts: [] },
    { clue: 'Which title character says life is like a box of chocolates?', answer: 'Forrest Gump', alts: ['Forrest'] },
    { clue: 'In which Tarantino film do Vincent and Jules talk about a Royale with Cheese?', answer: 'Pulp Fiction', alts: [] },
    { clue: 'In which 1999 film does Neo take the red pill?', answer: 'The Matrix', alts: ['Matrix'] },
    { clue: 'Which 1999 Best Picture winner starred Kevin Spacey as Lester Burnham?', answer: 'American Beauty', alts: [] },
  ],
  'Dogs': [
    { clue: 'Which long, short-legged breed is nicknamed the "wiener dog"?', answer: 'Dachshund', alts: [] },
    { clue: 'What breed was the TV hero Lassie?', answer: 'Rough Collie', alts: ['Collie'] },
    { clue: 'Which blue-eyed sled dog breed was made famous by the 1925 serum run to Nome?', answer: 'Siberian Husky', alts: ['Husky'] },
    { clue: 'Which breed is usually the tallest in the world, nicknamed the gentle giant?', answer: 'Great Dane', alts: [] },
    { clue: 'Which Hungarian guard dog has a white coat that hangs in long cords like a mop?', answer: 'Komondor', alts: [] },
  ],
  'Space': [
    { clue: 'Which planet is known as the Red Planet?', answer: 'Mars', alts: [] },
    { clue: 'Which planet has the biggest, brightest rings in our solar system?', answer: 'Saturn', alts: [] },
    { clue: 'What is the name of the galaxy our solar system is in?', answer: 'The Milky Way', alts: ['Milky Way'] },
    { clue: 'Who became the first human in space in 1961?', answer: 'Yuri Gagarin', alts: ['Gagarin'] },
    { clue: 'Which infrared space telescope, launched in 2021, is named after a former NASA administrator?', answer: 'James Webb Space Telescope', alts: ['JWST', 'Webb'] },
  ],
  'Fast Food': [
    { clue: 'Which chain sells the Whopper?', answer: 'Burger King', alts: ['BK'] },
    { clue: 'Which chain founded by Colonel Sanders sells a secret recipe of 11 herbs and spices?', answer: 'KFC', alts: ['Kentucky Fried Chicken'] },
    { clue: 'Which burger chain\'s logo is a red-haired girl with pigtails?', answer: 'Wendy\'s', alts: ['Wendys'] },
    { clue: 'Which chicken chain is famously closed on Sundays?', answer: 'Chick-fil-A', alts: [] },
    { clue: 'Which West Coast burger chain has a secret menu with "Animal Style" fries?', answer: 'In-N-Out', alts: ['In-N-Out Burger', 'In and Out'] },
  ],
  'World Capitals': [
    { clue: 'Which capital city is home to the Eiffel Tower?', answer: 'Paris', alts: [] },
    { clue: 'What is the capital of Japan?', answer: 'Tokyo', alts: [] },
    { clue: 'Not Toronto, but which Ontario city is the capital of Canada?', answer: 'Ottawa', alts: [] },
    { clue: 'Not Sydney, but which purpose-built city is the capital of Australia?', answer: 'Canberra', alts: [] },
    { clue: 'Which Central Asian capital was called Nur-Sultan from 2019 to 2022?', answer: 'Astana', alts: [] },
  ],
  'Board Games': [
    { clue: 'In which game can you buy Boardwalk and Park Place?', answer: 'Monopoly', alts: [] },
    { clue: 'Which murder-mystery game features Colonel Mustard, Miss Scarlett and a candlestick?', answer: 'Clue', alts: ['Cluedo'] },
    { clue: 'In which 1995 German game do players trade sheep and brick to build settlements?', answer: 'Catan', alts: ['Settlers of Catan'] },
    { clue: 'In Scrabble, how many points is the Q tile worth?', answer: '10', alts: ['ten'] },
    { clue: 'Which ancient strategy game is played with black and white stones on a 19-by-19 grid?', answer: 'Go', alts: ['Weiqi', 'Baduk'] },
  ],
  'Disney Movies': [
    { clue: 'What is the name of the snowman in Frozen who loves warm hugs?', answer: 'Olaf', alts: [] },
    { clue: 'Who is Simba\'s father in The Lion King?', answer: 'Mufasa', alts: [] },
    { clue: 'Which crab sings "Under the Sea" in The Little Mermaid?', answer: 'Sebastian', alts: [] },
    { clue: 'What was Disney\'s first full-length animated feature, released in 1937?', answer: 'Snow White and the Seven Dwarfs', alts: ['Snow White'] },
    { clue: 'Which 1940 film set animation to classical music, with Mickey as the Sorcerer\'s Apprentice?', answer: 'Fantasia', alts: [] },
  ],
  'The Human Body': [
    { clue: 'Which organ pumps blood around the body?', answer: 'The heart', alts: ['Heart'] },
    { clue: 'What is the largest organ of the human body?', answer: 'Skin', alts: ['The skin'] },
    { clue: 'How many bones does an adult human skeleton usually have?', answer: '206', alts: [] },
    { clue: 'What is the longest bone in the body, found in the thigh?', answer: 'Femur', alts: [] },
    { clue: 'What is the smallest bone in the body, found in the middle ear?', answer: 'Stapes', alts: ['Stirrup'] },
  ],
  'Video Games': [
    { clue: 'Which plumber keeps rescuing Princess Peach?', answer: 'Mario', alts: ['Super Mario'] },
    { clue: 'Link is the hero of which Nintendo series, named after a princess?', answer: 'The Legend of Zelda', alts: ['Zelda'] },
    { clue: 'Which block-building game is the best-selling video game of all time?', answer: 'Minecraft', alts: [] },
    { clue: 'Which franchise began in Japan in 1996 with Red and Green versions on the Game Boy?', answer: 'Pokémon', alts: ['Pokemon'] },
    { clue: 'Which Hideo Kojima stealth series stars Solid Snake?', answer: 'Metal Gear', alts: ['Metal Gear Solid'] },
  ],
  'The Beatles': [
    { clue: 'Which English port city did the Beatles come from?', answer: 'Liverpool', alts: [] },
    { clue: 'Which drummer replaced Pete Best in 1962?', answer: 'Ringo Starr', alts: ['Ringo'] },
    { clue: 'What colour is the submarine "we all live in", in the 1966 song?', answer: 'Yellow', alts: [] },
    { clue: 'On which 1969 album cover does the band walk across a zebra crossing?', answer: 'Abbey Road', alts: [] },
    { clue: 'What was John Lennon\'s skiffle group called before it became the Beatles?', answer: 'The Quarrymen', alts: ['Quarrymen', 'Quarry Men'] },
  ],
  'Breakfast': [
    { clue: 'Which griddled breakfast has a grid of little square pockets?', answer: 'Waffle', alts: ['Waffles'] },
    { clue: 'Which cereal does Tony the Tiger say is "Gr-r-reat!"?', answer: 'Frosted Flakes', alts: ['Frosties'] },
    { clue: 'Which dish puts poached eggs and hollandaise sauce on an English muffin?', answer: 'Eggs Benedict', alts: [] },
    { clue: 'Which Mexican dish of fried eggs on tortillas with salsa means "ranch-style eggs"?', answer: 'Huevos rancheros', alts: [] },
    { clue: 'What does a croque madame have on top that a croque monsieur doesn\'t?', answer: 'A fried egg', alts: ['Egg', 'An egg'] },
  ],
};

// Turn a failure into something a player can act on.
export function failReason(msg) {
  const m = String(msg || '');
  if (/^UNKNOWN_TOPIC/.test(m)) return "There aren't enough real, checkable facts about it to write fair questions (we won't make them up)";
  if (/^DAILY_LIMIT/.test(m)) return 'Buzzers has written all the new categories it can for today. Pick a built-in category or try again tomorrow';
  if (/^ROOM_LIMIT/.test(m)) return 'This room has made all the new categories it can for today. Pick a built-in category or try again tomorrow';
  if (/^NOT_ALLOWED/.test(m)) return "That one isn't allowed in Buzzers";
  if (/HTTP (40[45]|501)/.test(m)) return "The clue writer isn't on this site";
  if (/HTTP 402/.test(m)) return 'The clue service is switched off (Vercel)';
  if (/GROQ_API_KEY|no Groq key/.test(m)) return 'The clue service has no Groq key';
  if (/Groq 429/.test(m)) return 'The clue writer is busy (rate limit)';
  if (/Groq/.test(m)) return `The clue writer failed (${m})`;
  if (/model returned/.test(m)) return 'The clue writer came back with too few clues';
  if (/fetch|network|Failed/i.test(m)) return "Couldn't reach the clue writer";
  return m || 'Unknown error';
}
export const bankName = name => Object.keys(BANK).find(k => k.toLowerCase() === String(name).trim().toLowerCase());
