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
| `ui.js` | Phone screens (`renderPhone`/`wirePhone`), WebAudio sounds, `/api/generate` call, and `BANK`: our own 12 categories with checked answers. |
| `style.css` | Shared look. |
| `index.html` | **The real phone.** Join screen, WebSocket to the room, clock sync, sounds. |
| `sim.html` | One-screen flow tester: same rules and screens, bots play the other phones, 2–12 players. |
| `debug.html` | Watch-only view of a room: server log with ms timestamps, every press (synced ms + arrival ms + rtt), each phone's clock offset. `debug.html?room=ABCD`. |
| `party/server.js` | Worker + Durable Object room: owns state, runs the reducer, sends each phone its redacted view, persists to room storage. Sockets use the **Hibernation API** (`ctx.acceptWebSocket`): an idle room costs nothing even with phones connected. Never go back to `ws.accept()`: that bills every second a tab is open, and a few left-open tabs blew the free plan's daily Durable Objects duration limit (13,000 GB-s, about 28 room-hours) on 2026-11-09. |
| `api/generate.js` | Vercel function → Groq `openai/gpt-oss-120b`, 5 clues for a category. |

GitHub Pages also serves these at gamedesignerjoe.github.io/buzzers/ but has no `/api`, so only our own (`BANK`) categories work there; anything typed is bounced with "The clue writer isn't on this site". **Play at https://buzzers-rho.vercel.app/** (the portfolio tile links there). Checked 2026-11-09: page and `/api/generate` → Groq both working.

## Deploying / running

- **Pages + clue API:** push to `main` → Vercel.
- **Room server:** from the repo root, `npm --prefix buzzers/party run deploy` (Claude may run this without asking: allow rule in `.claude/settings.json`, added 2026-11-09). First time on a new PC: `npm install` and `npx wrangler login` in `buzzers\party`. Only needed when `game.js` or `party/server.js` change. `game.js` is shared, so a rules change needs **both** a push and a wrangler deploy. `party/.npmrc` forces the HTTPS npm registry: the global npmrc (http registry + prefer-offline) serves stale package lists.
- **Local, including real phones on the same Wi-Fi:** in `buzzers\party`: `npm run dev` (wrangler dev on :1999); in `buzzers`: `python -m http.server 8000`. Open `http://<PC LAN IP>:8000/` on phones; on localhost or a LAN IP the pages use that machine's `:1999` automatically. No `/api` locally → typed categories get placeholder clues (labelled "placeholder clues"); add `&placeholders=0` to the page URL to test the real bounce-back instead. Override the room server with `?party=host:port`.

## Design decisions (settled — don't relitigate without asking Joe)

**Game settings (host picks; added 2026-11-09)**
- The **host** is whoever is first into a room (in practice: whoever taps "Start a new room"). If the host drops, the next connected player can change settings. Settings are set on the join screen ("Game settings", saved on that phone) and/or in the lobby; they lock when the game starts and carry over to Play again. Other players see them read-only in the lobby. Changing a setting clears everyone's Ready.
- In the lobby the settings sit in a panel that is **closed by default** and shows the current choices on one line; each phone opens or closes it for itself. (Joe, 2026-11-09.)
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
- **No category without real clues.** If the clue writer fails (Groq error, no `/api` on this site, Vercel off), the category comes off the board, the adder sees why, and is asked to type another or pick one of ours (`BANK`, 12 categories with checked answers, which always work). A failed extra category gives the same player the turn back. Never placeholder questions on the real site. Placeholders only exist in `sim.html` and local testing. (Joe, 2026-11-09.)
- Random player picks first. The judge for that pick is chosen as the turn starts and shown on the board ("Joe picks · Griffin judges"). Everyone sees the board; only the picker's tiles are tappable, others see a dimmed "Sarah is picking" board.
- **3+ players, Winner picks next:** whoever answers correctly picks next; if nobody gets it, same picker. **Round robin:** next in seat order every clue.
- **2 players:** picking alternates every clue, right or wrong. (Joe, 2026-11-09.)
- Clues are written by the engine WITH their answers. Players never author answers.
- **Clues are plain questions** ("Which planet is known as the Red Planet?"), not Jeopardy-style statements. Every generated set is checked in code (`api/generate.js`): ends with "?", answer not in the question, five different answers, no answer that is just the category's name, nothing this group has already had. The prompt also demands **exactly one right answer** per question, pinned down with specific details (year, studio, character, number), and bans opinion words ("bad", "best", "famous") as the main clue, after a vague "bad shooter game" question (Joe, 2026-11-09). Bad ones get one repair round with the reasons spelled out; if there still aren't five clean ones, the category is refused. (Joe, 2026-11-09.)
- **Clues come from a web search, not the model's memory** (Joe, 2026-11-09). `api/generate.js` step 1: Groq `openai/gpt-oss-120b` with its built-in `browser_search` tool (powered by Exa) writes a numbered fact sheet, `F1 | fact | answer | source URL`, up to 15 facts spread across the category (at most 2 per subject, 4+ pages, no budgets/sales/dates as answers, at most 5 searches). Step 2 writes the 5 questions from the sheet only, each citing its fact; code rejects any question whose answer doesn't match its fact, and two questions from one fact. Each clue carries `source` (the page), not yet stored or shown. Too few facts found → refused as UNKNOWN_TOPIC. Takes about 10-20 s per category (fine: it runs while others add theirs). Memory-only mode is still there with `search:false`, but it made up about half the details when pushed for specifics (Quake 1993, Final Fantasy VI materia, The Recruit as a 1994 Tom Hanks film). Same-name people: "Joe Morrissey" finds the Virginia politician on Wikipedia; name hints (step 10) are the fix.
- **No made-up facts.** The model first decides whether it can name five real, checkable facts about the topic. Private people, small companies, local places and inside jokes get refused ("there aren't enough real, checkable facts…") with the pick-another screen, instead of invented questions. Web search, so those topics can work from real sources, is the planned next step (option 4, Joe 2026-11-09).

**No game-show host, no generated audio**
- There is no game-show host role: the reading/judging jobs are assigned per clue. (The room "host" only owns the settings.)
- No TTS. A human reads each clue aloud so the game works in a restaurant and people control volume. Sounds: a "go" ding when buzzers open, short stings, optional music bed, mute toggle on every phone. One phone (set before the room opens) owns music.

**Reader/judge (per clue)**
- A judge is assigned when the picker's turn starts: **never the picker**, fewest judge turns so far, tie random. The judge sits out this clue; the picker plays (buzzes) like everyone else. In a 2-player game that means the non-picker always judges.
- Judge's phone shows only a **Hold to reveal** button: clue text is visible only while held; **releasing** opens the buzzers and dings. The answer is **never** on screen before or while reading.
- The moment the judge **lets go**, their phone shows the accepted answer + alternates, with smaller **Correct** / **Incorrect** buttons inside that box (disabled until someone buzzes). No extra Reveal tap. Stays up through steals. (Joe, 2026-11-09.)
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
- **Old rooms reset themselves.** If nobody has been connected to a room for 2 hours (`roomIdleResetMs`), the next person to join gets a fresh lobby: no leftover seats, categories or half-finished game. The room's memory (used clues, Played before) is kept. Rooms from before this existed reset on their next join. (Joe, 2026-11-09.)

**Dropped phones**
- Refresh/relock → same seat (per-tab id **and name** in sessionStorage, so several tabs in one browser stay separate players; `bz.name` in localStorage only pre-fills the join screen). A new tab opened on a room link shows the pre-filled join screen rather than auto-joining. Lost tab → same name on the same device takes the seat back; same name from a different device is refused while the seat is live, allowed once it's empty.
- A dropped picker or judge gets 8 s (`awayGraceMs`) to return, then someone else picks / judges. Empty seats can be cleared in the lobby (× on the name).


## Wishlist

Ideas we want but haven't built. Not settled design: ask Joe before picking one up. Roughly grouped, not ordered.

**Gameplay**
- Daily-Double-style wagers on a hidden tile.
- "Phone a friend" When a question is drawn, this can get pulled once per game. The person who drew it picks another player to answer the question. Only they can answer it. If they get it right, both score. Judge can not be picked.
- "Underdog" When a question is drawn, this can get pulled once per game. The person who drew the question, picks another player to answer the question. Only they can answer the question. If they get it right, that person they picked gets the points and it's their turn. If they get it wrong, the points they would have gotten go to the original player. 


**Settings to consider**
- Remove countdown, x2 the countdown length.
- Hard Mode: All questions are really hard to incredibly difficult.
- **18+ mode** (Joe's idea, 2026-11-09). Proposed: the host turns on "18+ room" in settings; every player then gets a popup ("This room allows adult content. Are you 18 or older and OK with that?" Yes / No), and so does anyone who joins later. The game can't start until everyone has said Yes. If anyone says No, 18+ turns off for the room and the host is told who's not in, so one person can always veto it without being put on the spot in front of the group. 18+ only loosens what Groq may write (crude humour, adult topics); it never allows hate, sexual content about real people, or anything involving minors. 18+ categories live in their own part of the library and are never suggested to non-18+ rooms. Open questions: is the self-declared age enough (general info, not legal advice: fine for mild content in most places, worth checking before launch), and in the apps an 18+ mode may push the whole app's age rating up, which cuts its reach, so it might stay web-only (see step 17).

**Sound and feel**
- Music bed on one "music phone" (needs a music file and a lobby choice of which phone).
- Haptics where the platform allows (not iOS Safari).

**Groups and memory**
- We store all categories across all players that we've generated in a db. A subset of these get pulled as possibble categories to pick from. 
- Connected to the one above, but a bigger goal is I want to find a way to make money off of this. Right now, I'm spending money every time someone types in a new catergory. My thought is to create a fairly large list of topics that players can pick from, likely sorted into categories. Think Heads Up and what they do. These are free. However, you can type in your own categories as well, but this cost money. I would give the player a certain amount of catergories for like a $1. Something that would still return me x10-x100 on the dollar. "Five categories for $1. So it covers my Groq cost and still makes me some cash. I could also offer packs that I've already created for some amount of money as well. "$1 for 50 a scifi and fantasy" questions or something like that. So, I'd like us to think about how we could figure that side of things out here too. 
- → The two ideas above are planned out as **Build plan steps 7–18** (library, free catalogue, credits, packs, app stores).
- A group name that keeps memory across different room codes.
- Game history / stats per group.

## Architecture

The game is one reducer over a single state object `S` (`game.js`). It runs in exactly one place per room — the Cloudflare Durable Object — and phones send actions up and get state back. `sim.html` runs the same reducer locally with bots. Keep the reducer free of DOM/network/sound so it stays portable.

- Phones never see what they shouldn't: `viewFor(S, pid)` blanks unused clues, hides the current clue from non-judges until buzzers open and its answer until reveal. (The phone that *added* a category does fetch its clues from `/api/generate` and forwards them, so its devtools could see them. Accepted for now; moving generation server-side would need the Groq key as a wrangler secret.)
- Server actions: `join` (first joiner becomes host; their `settings` apply), `presence` (server-only). Phone actions: `addCategory, generated, genFailed{catId, reason}, removeCategory, ready{ready}, settings{settings} (host, lobby), color{color} (lobby, must be free), kick, pickClue, holdStart, holdEnd{at}, reread, press{at}, rule{right}, end, again, clock`. Internal: lobbyCheck/begin, open, resolveBuzz, nobody, reveal, advance, away.
- Phases: `lobby → board → reading → buzz → answering → reveal → board … → over`
- `S.sfx = {n, kind}` bumps when a sting should play (buzz/right/wrong/nobody); phones play when `n` changes. The ding is scheduled locally at `buzz.openAt`.
- All timings and rule knobs live in `CONFIG` at the top of `game.js`. Client-only knobs (`partyHost`, clock pings) in `CLIENT` in `index.html`; bot knobs in `SIM` in `sim.html`.

## Build plan — in order, each independently testable

1. **Real clues** ✅ `/api/generate` → Groq.
2. **Rooms** ✅ built and tested locally (2026-11-08): room server, join screen, redacted state per phone, refresh/rejoin, sim kept as `sim.html`. Deployed 2026-11-09 to https://buzzers.gamedesignerjoe.workers.dev (scripted 4-phone test passes against it). 2026-11-09: Joe's phone and PC played in the same room through the hosted server. *Done.*
3. **Fair buzzing** ✅ built, tested with scripted clients (a press that's earlier on the synced clock wins even when it arrives later). Debug page built. *Still to do on test night:* two people mashing ten times with `debug.html` open; check offsets look sane on real networks.
4. **Memory** ✅ room-storage version (room code = group). Not built: a separate "group name" independent of room code, if that turns out to matter.
5. **Sound** — partly: ding at synced open, stings for buzz/right/wrong/nobody/out-of-time (synthesised, no files), mute on every phone, iOS unlock on Join and on first tap. **Not built:** music bed on one phone (needs a music file and a "music phone" choice in the lobby).
6. **Test-night hardening** — built: rejoin, re-read, standings game-over screen with Play again, End game button, away picker/judge handover. 2026-11-09 solo playtest (PC windows + phone) went well; changes from it: picker never judges, 2-player pick alternation, one-category-each + Ready lobby with top-up to 6, host settings, big-group row trimming up to 12 players, lobby color picker, landscape board. **Next:** a session with a few other people and the debug log open.

### The big picture: from party game to product (written 2026-11-09)

Joe's goal (see Wishlist → Groups and memory): a big free catalogue of ready-made topics, Heads Up style, so most games cost nothing to run; typing your own category costs a little money; curated packs for sale; and eventually iOS and Google Play apps. Steps 7–18 get there in an order where each step is useful on its own and nothing involving money is built before the free game is solid.

Two facts that shape the plan:
- **Groq is cheap; payment fees are not.** One category is roughly a tenth of a cent of Groq at current prices (to be measured in step 7). So "5 categories for $1" isn't limited by Groq cost. It's limited by fees: a card payment through Stripe costs about 30¢ + 3%, a third of a $1 sale, and the app stores take 15% (small-business rate). Sell bundles of about $3–5, not $1 items.
- **Today `/api/generate` is open to anyone.** Anyone who finds it can spend Joe's Groq credit, and the phone that adds a category sees its answers. Both get fixed before anything else in this plan.

**Phase A — the shared library (free, no accounts)**

7. **Clues come from the server, and the server keeps them.** Move generation into the room server: Groq key as a Cloudflare secret (`wrangler secret put GROQ_API_KEY`), the Durable Object calls Groq, phones never receive answers they shouldn't. Retire `/api/generate` (or limit it to the room server). Save every category and every question (answer, alternates, difficulty tier, model, date) in a shared library, Cloudflare D1 (SQLite) to start. Before calling Groq, look in the library: same or near-same name ("Spy Movies" / "spy movie") reuses stored questions, skipping any this group has seen; when a group has seen them all, generate 5 more and add them, so busy categories deepen. Log Groq token counts to get the real cost per category. Rate-limit generation per room.
   **What gets saved where (Joe, 2026-11-09: lots of test categories were personal, e.g. his own name, his employer, his high school).** Saving everything into one public pile is wrong for those. Instead, two levels:
   - *Private to the room:* every category a room makes is kept for that room (its memory already does this), so the group can replay it. Rooms nobody has used for 90 days have their private categories deleted.
   - *Shared library:* a category is only promoted when (a) the label check below says it's a general topic, and (b) at least 3 unrelated rooms have made it. Inside jokes and personal details never meet both, so they never leave the room they were typed in.
   - *Label check at generation time:* the same Groq call that writes the clues also labels the category: **general** (Spy Movies), **personal** (about a private person, small group, or local place), or **not OK** (hateful, sexual, etc.), plus **adult** yes/no. Personal categories still play, with a lobby note that clues about private people may be made up (the model doesn't know your high school); not-OK ones are refused like a failed generation; adult ones only work in an 18+ room (see Wishlist).
   *Done when* two different rooms adding "Spy Movies" make one Groq call between them, and no phone's devtools show an answer before the judge reveals it.
8. **The free catalogue.** About 30 launch topics in groups (Movies, Music, TV, Sports, Food, Science, History, Geography, Games, Kids…), each with 25+ checked questions, so a group can play several times without repeats. Generate in bulk with Groq, then check by hand or with a second model pass; anything in the catalogue must be right. The lobby gets a "Pick a topic" browser by group; typing your own stays as it is. Replaces `BANK`. *Done when* a full game can be played without typing anything and without a single Groq call.
9. **Quality loop.** A small "flag this question" on the reveal screen (wrong answer, bad clue, offensive). Track right / wrong / nobody for each question and re-rank difficulty from real play instead of trusting the model's guess. Flagged questions stop being served until reviewed. A simple review page (just for Joe) lists flags and new promotions to the shared library, to approve or delete. Needed before money, since paid content has to be right. *Done when* a flagged question doesn't come back in the next game.
10. **Find what's already there.** Typing "spy" suggests Spy Movies, Spy Novels…, the cheapest kind of "similar" match. Later, matching by meaning (Cloudflare Workers AI embeddings + Vectorize) so "espionage films" finds Spy Movies; close matches reuse automatically, looser ones ask "Use Spy Movies?". Every reuse is a Groq call (and later a paid credit) saved. **Privacy rule:** typed categories are only ever suggested to other groups once several different rooms have used them, so inside jokes about real people ("Dave's Divorce") never surface for strangers. *Done when* the autocomplete only ever shows catalogue topics and ones used by 3+ rooms.

**Phase B — money (web first)**

11. **Accounts, for the host only.** Players never need one; the person paying does. Sign-in by email link to start, then Sign in with Apple / Google. Store accounts and a credits ledger in D1 (every purchase and every spend is a row; the balance is the sum, never a number edited in place). Account deletion built in from the start, since the app stores require it. *Done when* a host can sign in on two devices and see the same balance.
12. **Credits for custom categories.** Free: anything from the catalogue, anything already in the library (step 10), and a small free allowance of brand-new categories (Joe to set; e.g. a few per day) so new players can try it. Beyond that, a brand-new category costs 1 credit, spent from the **host's** balance. The whole room benefits from one purchase, so only one person per group ever pays. A failed generation refunds the credit automatically. *Done when* the lobby shows "2 credits left" to the host, typing a new category spends one, and a failed one gives it back.
13. **Taking payment on the web.** Bundles such as 15 credits for $3 or 40 for $5 (Joe to price). Use a hosted checkout so card details never touch our code: Stripe Checkout, or a "merchant of record" (Paddle, Lemon Squeezy) that also handles sales tax and VAT for us (higher fee, much less tax admin; probably the right choice for a one-person business). Credits are only added by the payment provider's server-to-server webhook, never by the page saying "paid". Receipts, refunds and a support email from day one. *Done when* a test-mode purchase adds credits, and a refund removes them.
14. **Paid packs.** Curated, checked sets built the same way as the catalogue ("Sci-Fi & Fantasy, 50 questions"), bought once and kept on the account. Same checkout and ledger as credits. *Done when* a bought pack shows up in "Pick a topic" for that host on any device.

**Before any real money changes hands** (general information, not legal or tax advice; confirm with an accountant and a lawyer first):
- Decide whether to sell as yourself or through a business (an LLC is common), and register for whatever tax the sales need. A merchant-of-record service, or the app stores (which are the seller in their stores), collects and pays sales tax / VAT for those sales.
- A privacy policy and terms of service, linked in the app. Both stores require a privacy policy.
- Refund policy, a support contact, and a plan for chargebacks.
- Content: a moderation check on typed categories before anything generated is shown publicly or sold, and a stance on categories about real private people.
- Name check: "Buzzers" may be taken or trademarked as an app name; never "Jeopardy".

**Phase C — iOS and Google Play**

15. **Wrap the web game as an app.** Capacitor puts the existing pages inside a native iOS / Android shell; the room server, library and accounts don't change. Add things a web page can't do, which also helps pass review (Apple rejects apps that are just a website in a box, guideline 4.2): real haptics on buzz (Joe's wishlist; works natively even on iPhone), a native share sheet for the room code, keeping the screen awake during a game. Building for iOS needs a Mac: use a cloud Mac build service (e.g. Codemagic) or GitHub Actions macOS runners from this Windows PC. Developer accounts: Apple $99/year, Google $25 once. *Done when* the app runs from TestFlight on Joe's iPhone and from Play internal testing on an Android phone, in the same room as a web player.
16. **Buying inside the apps.** Inside the iOS and Android apps, digital things like credits and packs have to be sold through Apple's and Google's own purchase systems, which take 15% under their small-business programs (rules are changing, especially in the US after the Epic cases; check current terms when we get here). A service like RevenueCat ties App Store, Google Play and the web Stripe purchases to one account, so credits bought anywhere work everywhere; or verify receipts ourselves on the server. Both feed the same ledger as step 11. Web prices can be lower than in-app prices. *Done when* a sandbox purchase on iOS and a test purchase on Android each add credits that then show up on the web.
17. **Store submission.** Age rating questionnaires; Apple's App Privacy and Google's Data Safety forms (what we collect: account email, purchases, typed categories); screenshots; a reviewer test account with credits; account deletion inside the app; Sign in with Apple offered if any other social sign-in is (Apple guideline 4.8); a report-and-block path for user-generated content (guideline 1.2: typed categories count). If an 18+ mode exists, decide whether it ships in the apps at all: it can raise the app's age rating for everyone. Expect one or two rejections the first time. *Done when* both stores approve version 1.
18. **After launch.** Watch the numbers: Groq spend vs. revenue, free-to-paid rate, which topics get played, flagged-question rate. Use them to price, to choose the next paid packs, and to decide what to seed next.

**Decisions Joe needs to make along the way**
- Before step 12: how many brand-new categories are free, and does it reset daily or per game?
- Before step 13: prices and bundle sizes; Stripe vs. a merchant of record; selling as yourself or as a business.
- Before step 14: which packs first, and whether packs ever include questions from players' typed categories (privacy and ownership questions if so).
- Before step 15: app name and icon; whether the web version stays free to play forever (recommended: yes, it's the best advert).

## Known gaps / not verified

- Only a solo phone + PC test so far (2026-11-09). Not yet checked with a group: audio unlock on every phone, socket recovery after screen lock, hold-button feel, buzz fairness on real networks.
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
