# Buzzers — project brief for Claude Code

Phone-based, hostless Jeopardy-style party game. Players submit categories, an LLM writes the clues, humans read them aloud, phones are the buzzers. Working name: **Buzzers** (never "Jeopardy" in product copy; that's Sony's mark).

Owner: Joe Morrissey. Game designer, not a full-time engineer. Works from iPhone a lot; GitHub web editor + Vercel is the deploy loop. Windows PC for Claude Code. Prefer single-file HTML with a `CONFIG` block over build steps. Ask before assuming design intent; iterate on something real before writing more design words.

## Where things are

- Repo: `GameDesignerJoe/GameDesignerJoe.github.io` (monorepo). This project lives in `buzzers/`.
- Vercel project `buzzers`, Root Directory = `buzzers`, preset Other. Env var `GROQ_API_KEY` is set there (Production + Preview). Never commit the key.
- Every push to `main` redeploys every Vercel project tied to this repo. Annoying but harmless.
- `buzzers/index.html` — the whole game (v0.1: one page simulating 4 phones as tabs, bots play the phones you aren't holding).
- `buzzers/api/generate.js` — Vercel serverless function, Groq `openai/gpt-oss-120b`, returns 5 clues for a category.
- GitHub Pages also serves `index.html` at gamedesignerjoe.github.io/buzzers/ but has no `/api`, so it silently falls back to canned clues. Use the Vercel URL.

## Design decisions (settled — don't relitigate without asking Joe)

**Core loop**
- Lobby: join by room code, pick name + color, add a category (anything, the sillier the better) or re-pick a past one. Each category gets 5 clues generated, ordered easy→hard, values 200/400/600/800/1000.
- Random player picks first. Everyone sees the board; only the picker's tiles are tappable, others see a dimmed "Sarah is picking" board.
- Whoever answers correctly picks next. If nobody gets it, same picker.
- Clues are written by the engine WITH their answers. Players never author answers.

**No host, no generated audio**
- There is no host role. The jobs a host does are assigned per clue.
- No TTS. A human reads each clue aloud so the game works in a restaurant and people control volume. Only sounds: a "go" ding when buzzers open, optional music bed, mute toggle on every phone. One phone (set before the room opens) owns music.

**Reader/judge (per clue)**
- On pick, a judge is assigned: anyone but the picker, fewest judge turns so far, tie random. The judge sits out this clue.
- Judge's phone shows only a **Hold to reveal** button: clue text is visible only while held; **releasing** opens the buzzers and dings. (Chosen over tap-when-done and word-count timers.) The answer is **never** on screen before or while reading.
- After release, the judge sees a **Reveal answer** button. Tapping it shows the accepted answer + alternates, with smaller **Correct** / **Incorrect** buttons inside that box (disabled until someone buzzes). The judge can reveal any time after release, and the answer stays revealed through steals. "Revealed" is that phone's own view state, not reducer state.
- Other phones show "X is reading" and a dead buzzer until the ding.
- Three-player games may want the picker to double as judge. Not built yet.

**Buzz fairness**
- Press time is judged by a synced clock, never by server arrival. Each phone measures clock offset on join (ping ~5x, half round-trip).
- Buzz-open timestamp = judge's release, broadcast as a time T.
- Server waits a ~200 ms straggler window after the first press, lowest synced timestamp wins.
- Early buzz (before open) = 250 ms lockout, so nobody mashes.
- Nobody buzzes in 6 s → reveal, same picker.

**Answering and judging**
- Buzz winner has 5 s to say the answer out loud. Judge taps Correct/Incorrect. Timeout = wrong.
- Wrong: −value, buzzers reopen for everyone except the judge and anyone who already guessed (steal). Judge is excluded from the steal so they have no stake in ruling.
- Answer is revealed to all phones once resolved or when nobody gets it.

**Memory**
- Keep used clues (keyed `category|answer`, lowercased) and past categories for the life of the group. Pass "avoid these answers" into generation; regenerate on collision.

**Parked ideas (do not build yet)**
- Hint button that halves points. Daily-Double-style wagers. "Phone a friend" clue where both get points. "Underdog picks the difficulty for the leader; if they miss, underdog gets the points." Final round with secret bets.

## Architecture (as it is in v0.1 and as it should stay)

The game is one reducer, `dispatch(action)`, over a single state object `S`. Phones are views that render `S` for one player id. **Bots** and **tabs** are the stand-ins for real phones. When networking lands, the reducer runs in exactly one place (server), phones send actions and receive state. Keep it so the reducer moves with zero logic changes.

Phases: `lobby → board → reading → buzz → answering → reveal → board … → over`

Actions: `addCategory, generated, start, pickClue, holdStart, holdEnd, open, press, resolveBuzz, rule, nobody, reveal`

State shape (abridged):
```
S = { phase, players:[{id,name,color,score,judged,speaker}], categories:[{id,name,by,status,clues:[{id,clue,answer,alts,value,used}]}],
      picker, current:{catId,idx}, judge, holding, buzz:{openAt,presses:{pid:ms},lockedUntil:{pid:t},guessed:[],winner}, answerDeadline, lastResult, log }
```

All timings live in `CONFIG` at the top of `index.html`. Keep them there.

## Build plan — do these in order, one at a time, each independently testable

Each step is roughly one 30-minute chunk. Finish and verify one before starting the next. Prefer the smallest change that makes the "done when" true.

1. **Real clues** ✅ (v0.1). `/api/generate` → Groq. *Done when* a typed category returns 5 good clues in <5 s. Verify on the Vercel URL via the event log line `ready · openai/gpt-oss-120b`.

2. **Rooms.** Move the reducer to a server that holds state per room code. Recommended: **PartyKit** (one `party/server.ts`, Durable-Object backed, free tier, survives a phone refresh). Alternative if staying Vercel-only: host-authoritative over Supabase Realtime broadcast (speaker phone runs the reducer; loses the game if that phone reloads). Phones: join screen with room code + name + color; actions go up, full state comes down; render from state. Drop the tabs/bots UI from the real client (keep the sim as `sim.html` for flow testing). *Done when* a phone and a laptop tab in the same room both see the board change when one picks.

3. **Fair buzzing.** Clock sync on join. `holdEnd` sends the judge's synced release time; server broadcasts it as open-at-T. `press` carries the synced press time. Straggler window + early lockout on the server. Log every press with ms in a server-side event log viewable from a debug page. *Done when* two people mashing at once, ten times, produce unbiased ordering and the music phone wins no more often than anyone else.

4. **Memory.** *Partly there in v0.1:* used clues and past categories go into `localStorage` on one device and "avoid" is already sent to `/api/generate`. Still missing: shared storage across phones, and regenerating on a collision. Used clues + past categories into PartyKit storage (or Vercel KV) keyed by group name. Feed "avoid" into generation; regenerate on collision. *Done when* back-to-back games on the same category don't repeat.

5. **Sound.** Ding on open (already a WebAudio beep), short stings for buzz/right/wrong/timer, a looping bed on the music phone only. Small local files. Mute toggle on every phone. iOS needs a user gesture to unlock audio: play a silent clip on "Join".

6. **Test-night hardening.** Rejoin by name after a dropped connection. "Re-read" for the judge. Three-player rule (picker doubles as judge). Game-over screen (a bare "X wins + Play again" already exists). Then a Friday with four humans and the debug log open.

## Conventions

- Single HTML file per client; CSS and JS inline; everything tunable in `CONFIG`. No bundler unless step 2 forces one (PartyKit's client is a tiny script tag; prefer that).
- Game-specific visual identity, not generic app chrome. Current look: dark stage, condensed display face, gold values, red buzzer. Keep it.
- Joe tests on iOS Safari/WebKit (DuckDuckGo browser). No Vibration API; audio needs a tap; use `pointer` events; `touch-action: none` on hold/buzz buttons.
- Terminal and path instructions for Windows.
- Be explicit about bugs and what wasn't verified. Don't silently paper over model output problems.
- When unsure about a design call, ask Joe. When unsure about an engineering call, pick the simplest option that keeps the reducer portable and say which you picked.
