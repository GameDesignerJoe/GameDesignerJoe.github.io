# Buzzers — project brief for Claude Code

Phone-based, hostless Jeopardy-style party game. Players submit categories, an LLM writes the clues, humans read them aloud, phones are the buzzers. Working name: **Buzzers** (never "Jeopardy" in product copy; that's Sony's mark).

Owner: Joe Morrissey. Game designer, not a full-time engineer. Works from iPhone a lot; GitHub web editor + Vercel is the deploy loop. Windows PC for Claude Code. Prefer no build steps and a `CONFIG` block for anything tunable. Ask before assuming design intent; iterate on something real before writing more design words.

## Where things are

- Repo: `GameDesignerJoe/GameDesignerJoe.github.io` (monorepo). This project lives in `buzzers/`.
- Vercel project `buzzers`, Root Directory = `buzzers`, preset Other. Env var `GROQ_API_KEY` is set there (Production + Preview). Never commit the key. Every push to `main` redeploys every Vercel project tied to this repo.
- Cloudflare Worker `buzzers` (in `buzzers/party/`) runs the room server: one Durable Object per room code, no runtime dependencies. (Hosted PartyKit shut down 23 Oct 2026. Its successor PartyServer would also work, but a plain Durable Object is ~60 lines and needs no library.) Deployed separately from Vercel — see "Deploying". Host: `buzzers.gamedesignerjoe.workers.dev` (Joe's personal Cloudflare account, workers.dev subdomain `gamedesignerjoe`; set as `CLIENT.partyHost` in `index.html` and in `debug.html`).

| File | What it is |
|---|---|
| `game.js` | The rules. `CONFIG` (every timing/rule knob), `createGame()` reducer, `viewFor()` per-phone redaction. Runs on the server and in the sim. No DOM. |
| `ui.js` | Phone screens (`renderPhone`/`wirePhone`), WebAudio sounds, `/api/generate` call + canned fallback bank. |
| `style.css` | Shared look. |
| `index.html` | **The real phone.** Join screen, WebSocket to the room, clock sync, sounds. |
| `sim.html` | One-screen flow tester: same rules and screens, bots play the other phones, 2–6 players. |
| `debug.html` | Watch-only view of a room: server log with ms timestamps, every press (synced ms + arrival ms + rtt), each phone's clock offset. `debug.html?room=ABCD`. |
| `party/server.js` | Worker + Durable Object room: owns state, runs the reducer, sends each phone its redacted view, persists to room storage. |
| `api/generate.js` | Vercel function → Groq `openai/gpt-oss-120b`, 5 clues for a category. |

GitHub Pages also serves these at gamedesignerjoe.github.io/buzzers/ but has no `/api`, so categories fall back to canned clues (the lobby row says "canned clues"). Use the Vercel URL.

## Deploying / running

- **Pages + clue API:** push to `main` → Vercel.
- **Room server:** from `buzzersparty` on the PC: `npm install` (first time), `npx wrangler login` (first time, Cloudflare sign-in), `npx wrangler deploy`. Only needed when `game.js` or `party/server.js` change. `game.js` is shared, so a rules change needs **both** a push and a wrangler deploy. `party/.npmrc` forces the HTTPS npm registry: the global npmrc (http registry + prefer-offline) serves stale package lists.
- **Local, including real phones on the same Wi-Fi:** in `buzzers\party`: `npm run dev` (wrangler dev on :1999); in `buzzers`: `python -m http.server 8000`. Open `http://<PC LAN IP>:8000/` on phones; on localhost or a LAN IP the pages use that machine's `:1999` automatically. No `/api` locally → canned clues. Override the room server with `?party=host:port`.

## Design decisions (settled — don't relitigate without asking Joe)

**Game settings (host picks; added 2026-11-09)**
- The **host** is whoever is first into a room (in practice: whoever taps "Start a new room"). If the host drops, the next connected player can change settings. Settings are set on the join screen ("Game settings", saved on that phone) and/or in the lobby; they lock when the game starts and carry over to Play again. Other players see them read-only in the lobby. Changing a setting clears everyone's Ready.
- Three two-way toggles (defaults first):
  - **Scoring:** Misses cost points / No penalty.
  - **Who picks:** Winner picks next / Round robin (seat order, every clue).
  - **Big groups:** Max 6 categories / 1 per player. Only matters with 7+ players (see Core loop). Up to 6 players, both modes play the same.
- **2-player games always alternate the pick**, even on Winner picks next (otherwise one person would judge the whole game).
- Settings live in `SETTINGS` / `DEFAULT_SETTINGS` in `game.js`; add a toggle there and both the join screen and lobby pick it up.

**Core loop** (as on the default settings)
- Join screen: name + room code only. **Color is picked in the lobby**, where colors other players hold are greyed out with their initial; tap any free one to switch, and your old one frees up. You arrive with your last-used color if it's free, otherwise the first free one. Returning to your seat keeps your color. Colors lock when the game starts. (Joe, 2026-11-09.)
- Lobby: **Everyone adds exactly one category** (anything, the sillier the better, or a past one), then taps **Ready**. The game can't start until everyone in the room is ready (a locked phone still counts; clear an empty seat with ×).
- If the board has fewer than **6** categories once everyone is ready, random players take turns (cycling, nobody gets a second before everyone has had one) adding one more until there are 6. Nobody can add a second category before that, so one person can't fill the board before others join. **The game starts by itself** once all clues are in. (Joe, 2026-11-09.)
- **7+ players, Max 6 categories:** the board stops at 6; players after the 6th category don't add one, they just tap Ready. 6 × 5 rows = 30 questions.
- **7+ players, 1 per player:** every player adds one, and the easiest rows are dropped so the board stays near 30 questions: rows = round(30 ÷ categories), kept between 3 and 5 (`rowsFor` in `game.js`). 7–8 players → 4 rows (400–1000), 9–12 → 3 rows (600–1000). 10 players = 30 questions, 12 = 36. **Rooms cap at 12 players.** Boards over 6 columns use sideways headers to fit a phone in portrait and show "Turn your phone sideways for a bigger board"; in landscape the board uses the full screen width with normal headers (12 columns ≈ 60 px each on an iPhone). Pinch-zoom is deliberately not relied on.
- Each category gets 5 clues generated, ordered easy→hard, values 200/400/600/800/1000.
- Random player picks first. The judge for that pick is chosen as the turn starts and shown on the board ("Joe picks · Griffin judges"). Everyone sees the board; only the picker's tiles are tappable, others see a dimmed "Sarah is picking" board.
- **3+ players, Winner picks next:** whoever answers correctly picks next; if nobody gets it, same picker. **Round robin:** next in seat order every clue.
- **2 players:** picking alternates every clue, right or wrong. (Joe, 2026-11-09.)
- Clues are written by the engine WITH their answers. Players never author answers.

**No game-show host, no generated audio**
- There is no game-show host role: the reading/judging jobs are assigned per clue. (The room "host" only owns the settings.)
- No TTS. A human reads each clue aloud so the game works in a restaurant and people control volume. Sounds: a "go" ding when buzzers open, short stings, optional music bed, mute toggle on every phone. One phone (set before the room opens) owns music.

**Reader/judge (per clue)**
- A judge is assigned when the picker's turn starts: **never the picker**, fewest judge turns so far, tie random. The judge sits out this clue; the picker plays (buzzes) like everyone else. In a 2-player game that means the non-picker always judges.
- Judge's phone shows only a **Hold to reveal** button: clue text is visible only while held; **releasing** opens the buzzers and dings. The answer is **never** on screen before or while reading.
- After release, the judge sees a **Reveal answer** button. Tapping it shows the accepted answer + alternates, with smaller **Correct** / **Incorrect** buttons inside that box (disabled until someone buzzes). Stays revealed through steals. "Revealed" is that phone's own view state, not reducer state.
- Judge can **Re-read** (closes buzzers, back to Hold to reveal) until the first press.
- Other phones show "X is reading" and a dead buzzer until the ding.

**Buzz fairness**
- Press time is judged by a synced clock, never by server arrival. Each phone pings 6× on connect (and 3× every 15 s), keeps the offset from the lowest round trip.
- Buzz-open time T = judge's synced release + `openDelayMs` (300 ms), so every phone gets T before it happens and dings at the same moment.
- Server waits a 200 ms straggler window after the first press arrives, lowest synced timestamp wins.
- Early buzz (before T) = 250 ms lockout.
- Nobody buzzes in 6 s → reveal, same picker.

**Answering and judging**
- Buzz winner has a 5 s countdown to say the answer out loud. **At zero every phone shows "Out of time", but the game does not rule: the judge still taps Correct or Incorrect.**
- Wrong: −value (unless Scoring is No penalty), buzzers reopen for everyone except the judge and anyone who already guessed (steal).
- Answer is revealed to all phones once resolved or when nobody gets it.

**Memory**
- A room code is the group's memory: used clues (`category|answer`, lowercased) and past categories live in the room's storage, survive "Play again", and come back if the group reuses the code. "Avoid these answers" goes into generation; if Groq still repeats one, the phone asks again (up to 3 tries) and logs it.

**Dropped phones**
- Refresh/relock → same seat (per-tab id in sessionStorage). Lost tab → same name on the same device takes the seat back; same name from a different device is refused while the seat is live, allowed once it's empty.
- A dropped picker or judge gets 8 s (`awayGraceMs`) to return, then someone else picks / judges. Empty seats can be cleared in the lobby (× on the name).


## Wishlist

Ideas we want but haven't built. Not settled design: ask Joe before picking one up. Roughly grouped, not ordered.

**Gameplay**
- Hint button that halves the clue's points.
- Daily-Double-style wagers on a hidden tile.
- "Phone a friend" clue: buzzer names a helper, both score.
- Underdog picks the difficulty for the leader; if the leader misses, the underdog gets the points.
- Final round with secret bets.

**Settings to consider**
- Answer countdown length (5 s now), buzz timeout (6 s), number of categories to top up to (6).
- A "picker can judge" option for very small games.

**Sound and feel**
- Music bed on one "music phone" (needs a music file and a lobby choice of which phone).
- Haptics where the platform allows (not iOS Safari).

**Category library (Joe's big idea, 2026-11-09)**
Every category any group creates is saved to one shared library on our server. When someone adds a category, we look in the library first and only call Groq on a miss, so popular categories start instantly and cost nothing, and the library grows with play. Pieces, roughly in build order:
1. **Generate on the server and save everything.** The room server (not a phone) checks the library, calls Groq on a miss (key as a Cloudflare secret), and stores the category plus every question individually (difficulty tier, answer, alts, model, date). Reuse on exact or near-exact names ("Spy Movies" / "spy movie"). Groups still never repeat a question they've seen; once they've seen everything stored for a category, generate 5 more and add them, so busy categories deepen over time.
2. **Suggest as you type.** The category box autocompletes from the library ("spy" → Spy Movies, Spy Novels…). Players steer themselves onto stored categories, which is the cheapest kind of "similar" match. The Ideas chips become "Popular" from the library.
3. **Meaning-level matching.** Embeddings (e.g. Cloudflare Workers AI + Vectorize) so "espionage films" finds Spy Movies. Close matches reuse automatically; looser ones ask: "Use Spy Movies?"
4. **Let play tune the library.** Track how often each question is answered right, wrong, or not at all, and re-rank difficulty from real results. A small "flag this question" on the reveal screen retires bad ones.
5. **Seed it.** Pre-generate and check about 100 questions for each launch category so day one isn't empty.
Things to decide before building: privacy (inside-joke categories about real people shouldn't surface for strangers; one idea is only suggesting categories used by several different rooms), content moderation for anything shown to other groups, wrong facts being reused instead of one-off (hence flagging), and time-sensitive categories going stale (store dates, refresh).

**Groups and memory**
- A group name that keeps memory across different room codes.
- Game history / stats per group.

**Tech**
- Generate clues on the room server (Groq key as a Cloudflare secret) so no phone ever holds answers it shouldn't. (Step 1 of the category library.)
- Let the deploy run without a human (permission rule for `npx wrangler deploy`).

## Architecture

The game is one reducer over a single state object `S` (`game.js`). It runs in exactly one place per room — the Cloudflare Durable Object — and phones send actions up and get state back. `sim.html` runs the same reducer locally with bots. Keep the reducer free of DOM/network/sound so it stays portable.

- Phones never see what they shouldn't: `viewFor(S, pid)` blanks unused clues, hides the current clue from non-judges until buzzers open and its answer until reveal. (The phone that *added* a category does fetch its clues from `/api/generate` and forwards them, so its devtools could see them. Accepted for now; moving generation server-side would need the Groq key as a wrangler secret.)
- Server actions: `join` (first joiner becomes host; their `settings` apply), `presence` (server-only). Phone actions: `addCategory, generated, removeCategory, ready{ready}, settings{settings} (host, lobby), kick, pickClue, holdStart, holdEnd{at}, reread, press{at}, rule{right}, end, again, clock`. Internal: lobbyCheck/begin, open, resolveBuzz, nobody, reveal, advance, away.
- Phases: `lobby → board → reading → buzz → answering → reveal → board … → over`
- `S.sfx = {n, kind}` bumps when a sting should play (buzz/right/wrong/nobody); phones play when `n` changes. The ding is scheduled locally at `buzz.openAt`.
- All timings and rule knobs live in `CONFIG` at the top of `game.js`. Client-only knobs (`partyHost`, clock pings) in `CLIENT` in `index.html`; bot knobs in `SIM` in `sim.html`.

## Build plan — in order, each independently testable

1. **Real clues** ✅ `/api/generate` → Groq.
2. **Rooms** ✅ built and tested locally (2026-11-08): room server, join screen, redacted state per phone, refresh/rejoin, sim kept as `sim.html`. Deployed 2026-11-09 to https://buzzers.gamedesignerjoe.workers.dev (scripted 4-phone test passes against it). **Not yet tried on real phones.** *Done when* a phone and a laptop tab in the same room both see the board change when one picks.
3. **Fair buzzing** ✅ built, tested with scripted clients (a press that's earlier on the synced clock wins even when it arrives later). Debug page built. *Still to do on test night:* two people mashing ten times with `debug.html` open; check offsets look sane on real networks.
4. **Memory** ✅ room-storage version (room code = group). Not built: a separate "group name" independent of room code, if that turns out to matter.
5. **Sound** — partly: ding at synced open, stings for buzz/right/wrong/nobody/out-of-time (synthesised, no files), mute on every phone, iOS unlock on Join and on first tap. **Not built:** music bed on one phone (needs a music file and a "music phone" choice in the lobby).
6. **Test-night hardening** — built: rejoin, re-read, standings game-over screen with Play again, End game button, away picker/judge handover. 2026-11-09 solo playtest (PC windows + phone) went well; changes from it: picker never judges, 2-player pick alternation, one-category-each + Ready lobby with top-up to 6, host settings, big-group row trimming up to 12 players. **Next:** a session with a few other people and the debug log open.

## Known gaps / not verified

- Nothing has run on an iPhone yet: audio unlock, socket recovery after screen lock, hold-button feel.
- Room server restart mid-clue: state restores from storage and timers re-arm (tested locally by killing `wrangler dev` mid-answer). Not tested on the hosted service.
- If **everyone** drops at once (all screens locked), nothing is handed over until someone is back; then the missing picker/judge gets a fresh 8 s.
- Judge disconnects mid-hold: holding resets; the 8 s handover only kicks in if they don't return.

## Conventions

- No bundler for the pages: plain ES modules (`game.js`, `ui.js`) + `style.css`, loaded by the HTML pages. Wrangler bundles `party/server.js` (with `../game.js`) on deploy.
- Game-specific visual identity, not generic app chrome. Dark stage, condensed display face, gold values, red buzzer. Keep it.
- Joe tests on iOS Safari/WebKit (DuckDuckGo browser). No Vibration API; audio needs a tap; use `pointer` events; `touch-action: none` on hold/buzz buttons.
- Terminal and path instructions for Windows.
- Be explicit about bugs and what wasn't verified. Don't silently paper over model output problems.
- When unsure about a design call, ask Joe. When unsure about an engineering call, pick the simplest option that keeps the reducer portable and say which you picked.
