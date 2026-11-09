# Buzzers — project brief for Claude Code

Phone-based, hostless Jeopardy-style party game. Players submit categories, an LLM writes the clues, humans read them aloud, phones are the buzzers. Working name: **Buzzers** (never "Jeopardy" in product copy; that's Sony's mark).

Owner: Joe Morrissey. Game designer, not a full-time engineer. Works from iPhone a lot; GitHub web editor + Vercel is the deploy loop. Windows PC for Claude Code. Prefer no build steps and a `CONFIG` block for anything tunable. Ask before assuming design intent; iterate on something real before writing more design words.

## Where things are

- Repo: `GameDesignerJoe/GameDesignerJoe.github.io` (monorepo). This project lives in `buzzers/`.
- Vercel project `buzzers`, Root Directory = `buzzers`, preset Other. Env var `GROQ_API_KEY` is set there (Production + Preview). Never commit the key. Every push to `main` redeploys every Vercel project tied to this repo.
- PartyKit project `buzzers` (in `buzzers/party/`) runs the room server. Deployed separately from Vercel — see "Deploying" below. Expected host: `buzzers.gamedesignerjoe.partykit.dev` (set as `CLIENT.partyHost` in `index.html` and in `debug.html`; confirm after the first deploy).

| File | What it is |
|---|---|
| `game.js` | The rules. `CONFIG` (every timing/rule knob), `createGame()` reducer, `viewFor()` per-phone redaction. Runs on the server and in the sim. No DOM. |
| `ui.js` | Phone screens (`renderPhone`/`wirePhone`), WebAudio sounds, `/api/generate` call + canned fallback bank. |
| `style.css` | Shared look. |
| `index.html` | **The real phone.** Join screen, WebSocket to the room, clock sync, sounds. |
| `sim.html` | One-screen flow tester: same rules and screens, bots play the other phones, 2–6 players. |
| `debug.html` | Watch-only view of a room: server log with ms timestamps, every press (synced ms + arrival ms + rtt), each phone's clock offset. `debug.html?room=ABCD`. |
| `party/server.js` | PartyKit room: owns state, runs the reducer, sends each phone its redacted view, persists to room storage. |
| `api/generate.js` | Vercel function → Groq `openai/gpt-oss-120b`, 5 clues for a category. |

GitHub Pages also serves these at gamedesignerjoe.github.io/buzzers/ but has no `/api`, so categories fall back to canned clues (the lobby row says "canned clues"). Use the Vercel URL.

## Deploying / running

- **Pages + clue API:** push to `main` → Vercel.
- **Room server:** from `buzzers\party` on the PC: `npm install` (first time), `npx partykit login` (first time, GitHub sign-in), `npx partykit deploy`. Only needed when `game.js` or `party/server.js` change. `game.js` is shared, so a rules change needs **both** a push and a PartyKit deploy.
- **Local, including real phones on the same Wi-Fi:** in `buzzers\party`: `npx partykit dev`; in `buzzers`: `python -m http.server 8000`. Open `http://<PC LAN IP>:8000/` on phones; on localhost or a LAN IP the pages use that machine's `:1999` automatically. No `/api` locally → canned clues. Override the room server with `?party=host:port`.

## Design decisions (settled — don't relitigate without asking Joe)

**Core loop**
- Lobby: join by room code, pick name + color, add a category (anything, the sillier the better) or re-pick a past one. Each category gets 5 clues generated, ordered easy→hard, values 200/400/600/800/1000.
- Random player picks first. Everyone sees the board; only the picker's tiles are tappable, others see a dimmed "Sarah is picking" board.
- Whoever answers correctly picks next. If nobody gets it, same picker.
- Clues are written by the engine WITH their answers. Players never author answers.

**No host, no generated audio**
- There is no host role. The jobs a host does are assigned per clue.
- No TTS. A human reads each clue aloud so the game works in a restaurant and people control volume. Sounds: a "go" ding when buzzers open, short stings, optional music bed, mute toggle on every phone. One phone (set before the room opens) owns music.

**Reader/judge (per clue)**
- On pick, a judge is assigned: anyone but the picker, fewest judge turns so far, tie random. The judge sits out this clue.
- **3 or fewer players: the picker reads and judges their own pick** (`CONFIG.pickerJudgesAtOrBelow`).
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
- Wrong: −value, buzzers reopen for everyone except the judge and anyone who already guessed (steal).
- Answer is revealed to all phones once resolved or when nobody gets it.

**Memory**
- A room code is the group's memory: used clues (`category|answer`, lowercased) and past categories live in the room's storage, survive "Play again", and come back if the group reuses the code. "Avoid these answers" goes into generation; if Groq still repeats one, the phone asks again (up to 3 tries) and logs it.

**Dropped phones**
- Refresh/relock → same seat (per-tab id in sessionStorage). Lost tab → same name on the same device takes the seat back; same name from a different device is refused while the seat is live, allowed once it's empty.
- A dropped picker or judge gets 8 s (`awayGraceMs`) to return, then someone else picks / judges. Empty seats can be cleared in the lobby (× on the name).

**Parked ideas (do not build yet)**
- Hint button that halves points. Daily-Double-style wagers. "Phone a friend" clue where both get points. "Underdog picks the difficulty for the leader; if they miss, underdog gets the points." Final round with secret bets.

## Architecture

The game is one reducer over a single state object `S` (`game.js`). It runs in exactly one place per room — the PartyKit server — and phones send actions up and get state back. `sim.html` runs the same reducer locally with bots. Keep the reducer free of DOM/network/sound so it stays portable.

- Phones never see what they shouldn't: `viewFor(S, pid)` blanks unused clues, hides the current clue from non-judges until buzzers open and its answer until reveal. (The phone that *added* a category does fetch its clues from `/api/generate` and forwards them, so its devtools could see them. Accepted for now; moving generation server-side would need the Groq key in PartyKit env.)
- Server actions: `join`, `presence` (server-only). Phone actions: `addCategory, generated, removeCategory, kick, start, pickClue, holdStart, holdEnd{at}, reread, press{at}, rule{right}, end, again, clock`. Internal: open, resolveBuzz, nobody, reveal, advance, away.
- Phases: `lobby → board → reading → buzz → answering → reveal → board … → over`
- `S.sfx = {n, kind}` bumps when a sting should play (buzz/right/wrong/nobody); phones play when `n` changes. The ding is scheduled locally at `buzz.openAt`.
- All timings and rule knobs live in `CONFIG` at the top of `game.js`. Client-only knobs (`partyHost`, clock pings) in `CLIENT` in `index.html`; bot knobs in `SIM` in `sim.html`.

## Build plan — in order, each independently testable

1. **Real clues** ✅ `/api/generate` → Groq.
2. **Rooms** ✅ built and tested locally (2026-11-08): PartyKit server, join screen, redacted state per phone, refresh/rejoin, sim kept as `sim.html`. **Not yet deployed to PartyKit or tried on real phones.** *Done when* a phone and a laptop tab in the same room both see the board change when one picks.
3. **Fair buzzing** ✅ built, tested with scripted clients (a press that's earlier on the synced clock wins even when it arrives later). Debug page built. *Still to do on test night:* two people mashing ten times with `debug.html` open; check offsets look sane on real networks.
4. **Memory** ✅ room-storage version (room code = group). Not built: a separate "group name" independent of room code, if that turns out to matter.
5. **Sound** — partly: ding at synced open, stings for buzz/right/wrong/nobody/out-of-time (synthesised, no files), mute on every phone, iOS unlock on Join and on first tap. **Not built:** music bed on one phone (needs a music file and a "music phone" choice in the lobby).
6. **Test-night hardening** — built: rejoin, re-read, three-player rule, standings game-over screen with Play again, End game button, away picker/judge handover. **Next:** a Friday with four humans and the debug log open.

## Known gaps / not verified

- Nothing has run on an iPhone yet: audio unlock, socket recovery after screen lock, hold-button feel.
- Room server restart mid-clue: state restores from storage and timers re-arm (tested locally by killing `partykit dev` mid-answer). Not tested on the hosted service.
- If **everyone** drops at once (all screens locked), nothing is handed over until someone is back; then the missing picker/judge gets a fresh 8 s.
- Judge disconnects mid-hold: holding resets; the 8 s handover only kicks in if they don't return.

## Conventions

- No bundler for the pages: plain ES modules (`game.js`, `ui.js`) + `style.css`, loaded by the HTML pages. PartyKit bundles `party/server.js` itself on deploy.
- Game-specific visual identity, not generic app chrome. Dark stage, condensed display face, gold values, red buzzer. Keep it.
- Joe tests on iOS Safari/WebKit (DuckDuckGo browser). No Vibration API; audio needs a tap; use `pointer` events; `touch-action: none` on hold/buzz buttons.
- Terminal and path instructions for Windows.
- Be explicit about bugs and what wasn't verified. Don't silently paper over model output problems.
- When unsure about a design call, ask Joe. When unsure about an engineering call, pick the simplest option that keeps the reducer portable and say which you picked.
