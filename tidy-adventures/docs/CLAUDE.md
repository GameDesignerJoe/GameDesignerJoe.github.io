# Tidy Adventures — architecture

A tidying game. Everything is on the floor; every item belongs in one
specific piece of furniture. Toss things in, open them up, sort the rows.

**ES modules, JSON data, no build step.** Same shape as `cartographer/`.

---

## Running it

```
python -m http.server 8000
```
→ http://localhost:8000/tidy-adventures/

**A web server is required.** `<script type="module">` and `fetch()` are both
blocked under `file://`. Opening `index.html` directly shows a boot error that
says exactly this.

Console handle: `tidy.G`, `tidy.DATA`, `tidy.start('mega')`, `tidy.level(3)`.

---

## The point of the layout

Every tuning value a designer would want to change lives in `data/*.json` and
can be edited without touching JavaScript:

| I want to change… | Edit |
|---|---|
| who hires you, and everything they say | `data/clients.json` |
| which emoji go in which container | `data/rooms.json` |
| adding a room, or giving one a round/hex silhouette | `data/rooms.json` + a floor rule in `css/room.css` + the id in `data/themes.json` |
| how many rooms / items / locks a run has | `data/sizes.json`, `data/levels.json` |
| row length (how many of each item exist) | `rowLen` in either of the above |
| hint text, and when hints appear | `tips` in `data/levels.json` |
| how many levels a talent has | `levels` in `data/upgrades.json` |
| what a talent DOES | `TALENT_IDS` in `js/config.js` + the code that reads it |
| when talent drafts happen | `draftSteps` in `data/upgrades.json` |
| whether a level has ⭐ at all | `"talents": false` in `data/levels.json` |
| item names in the loupe | `data/names.json` |
| room shapes, which rooms a theme uses | `data/themes.json` |
| furniture size, anchors, keep-out padding, key/coin emoji | `data/furniture.json` |
| how much floor to keep clear in front of doors | `doorZone` in `data/furniture.json` |
| the note each room leaves you, and its reply | `data/quests.json` |
| how many rooms start with a sealed container | `roomShare` in `data/quests.json` |
| every sound, and the music tracks | `data/audio.json` |
| which music a client brings with them | `music` on a client in `data/clients.json` |
| title, tagline, home-screen icon | `data/strings.json` |

Each file opens with a `_readme` explaining its rules. The loader ignores any
key starting with `_`.

**A bad edit stops boot with a named on-screen error**, not a silent bug —
that's `js/validate.js`. It checks that an emoji has exactly one home **within
a theme** (see below), that
kinds and floors exist in both the JSON *and* the stylesheet, that locks have
keys, that a config's type quota is actually reachable, that tip targets are
real, and that no description contains a token nothing fills in. Errors block
boot; warnings log and continue.

If you edit a JSON file, push, and don't see the change: GitHub Pages caches
assets for ten minutes. Bump `DATA_VERSION` in `js/config.js` — it's appended
as `?v=` to every data fetch.

That covers the *data*. The **JS modules carry no cache-buster at all**, so a
stale `config.js` means a stale `DATA_VERSION`, which then re-fetches the stale
JSON — bumping the number does nothing until the module itself is refetched.
Hard-reload when testing; automated tests should set
`Network.setCacheDisabled` before navigating. This bites once per session and
looks exactly like "my edit didn't save".

On a phone there is no hard-reload, which is what **Refresh** in the gear is
for: it refetches every asset the page actually loaded with `cache:"reload"`
(from `performance.getEntriesByType("resource")`, so the list can never drift
out of date the way a hardcoded one would), drops this game's entries from any
service-worker cache, and reloads. `VERSION` in `js/config.js` shows on the
title screen and in the gear, next to the date of the copy you're holding —
bump it when you ship, or there is no way to tell from a home-screen install
whether you're looking at the build you just pushed.

---

## Module graph

Each tier imports only from strictly lower tiers. There are no cycles.

```
0  config · util · dom · validate · audio · hit
1  data · toast/feedback
2  state · geometry
3  save · rules · generate
4  render · hud · inventory · containerView · tips · camera · talents · quests
5  actions · locks · win · menus
6  input
7  main
```

Currently `js/main.js` still holds tiers 3–6 in one file; the leaves,
`state`, `generate`, `geometry`, `camera`, `feedback`, `talents`, `quests`,
`hit` and `audio` are extracted. The remaining split is mechanical.

`hit.js` imports nothing at all — it is given an element and a screen point
and answers questions about pixels. It does not know the game exists, which
is what keeps it at tier 0 despite being about input.

Three cycles exist in the original design and are cut deliberately:

- **`hud → save → render → hud`.** `save.js` never repaints; callers do.
  Nothing in the save path may import the render tier.
- **`render → containerView → render`.** `closeCont()` lives with the actions,
  not with the container view, which only paints.
- **`actions → menus → render → actions`.** `showWin()` is separate from
  `menus`; the direction is strictly `actions → win → menus → render`.

Modules that own a loop (`startTipLoop`) export a start
function rather than running on import.

---

## Things worth knowing before you change them

**`G` is a singleton and is never reassigned.** `generate(cfg)` is a pure
function that *returns* a run; callers do `setRun(generate(cfg), meta)`. The
original assigned the global directly, which forced every caller to patch
`mode`/`size`/`levelIdx` back on afterwards.

**`G.active`, not `G === null`.** Menus and the tip loop run before any run
exists.

**A run is self-contained.** Rooms carry their own `floor`, containers their
own `kind`/`name`/`short`, copied at generation time. Nothing downstream looks
a definition back up, so renaming a room in `rooms.json` cannot corrupt a save.

**`#roomHost > .cam > .room`.** The camera owns zoom and pan; the room owns
the slide and bounce animations. They shared one `transform` originally, which
is why `bounce()` had to repair the camera afterwards.

**`G.cam` is `{z,x,y}`, and `setRun()` guarantees it.** It used to be the
string `"room"` in `blankRun()`, `generate()` and `loadGame()` — the v3
two-state model, left behind when continuous zoom landed. Starting a run calls
`resetZoom()` immediately afterwards, which silently repaired it, so the bug
only ever appeared on **Continue**: the first zoom threw `Cannot create
property 'z' on string 'room'`, and walking through a door threw inside
`resetPan()` *after* `slideTo()` had already advanced `G.current` — leaving the
run pointing at a room it had never drawn. Two modules imported `ZOOM_START`
and used it nowhere, which is the fingerprint of a half-finished migration
worth looking for elsewhere.

**Auto-fit framing.** The camera scales the room to fill the stage at
`FIT_STRENGTH` (85%), so the per-level `scale` ramp still reads as the house
growing without leaving early levels adrift in background.

**`setHidden()`, not `.hidden`.** Any rule that sets `display` beats the UA's
`[hidden]{display:none}` — which is how a Continue button stayed on screen
with `hidden = true`.

**In-room text sizes with container queries (`cqh`), not px.** Fixed sub-12px
text triggers iOS text-size-adjust and Chrome Android font boosting.

**Feedback has three channels** (`js/feedback.js`): `bump()` for rejections
(shake the thing that said no, one sentence the first time a rule is hit),
`flyReward()` for rewards, `say()` for real messages (queued, under the HUD).

**A drag keeps the grab point.** `ptr.grabDX/grabDY` is the offset between the
pointer and the item's centre, recorded on pointerdown and added back on every
move. Without it the drag wrote the pointer position straight into the item's
centre, so crossing the drag threshold teleported the item sideways by however
far from its middle you grabbed — half its width at worst, and worse on a
phone, where the camera scales an item to twice its laptop size. The item is
also scaled up slightly while held (`itemTransform(it, true)` plus the `.held`
class); every release path that doesn't repaint the room must call `unlift()`,
or an item keeps the lift after it is put down.

**Input hit-tests pixels, not boxes** (`js/hit.js`). An item is a `<div>` with
one emoji in it, so the browser hit-tests a 22px glyph inside a 50×42 box —
`--item-pad` adds 10px of invisible target on every side, and the glyph is
round-ish inside that. Items are scattered to overlap, so the top box wins,
and you tap the thing you can see and pick up the thing beside it. Measured
over a dense room, **16–18% of taps that hit an item hit the wrong one**, and
every single one of those was the same story: the winner's transparent halo
over the loser's visible pixels.

`itemAt()` walks the hit stack and prefers the topmost item whose *painted*
pixels are under the point, falling back to the old whole-box answer when none
are — so the fat-finger padding still works for an item on its own and only
yields when it is competing with something you are pointing straight at. A tap
that used to pick something up always still picks something up.

`underAt()` is the same idea from the other end: floor items paint *above*
furniture, so clutter lying on a chest made that part of the chest refuse a
drop (20% of the average container's face, and one chest was 94% dead). The
clutter you are trying to clear must not be what stops you clearing it.

Both stop at the first element that is painted over the items rather than
holding them, so neither can reach through a door or the inventory bar.

Masks are built once per emoji by drawing it into a canvas laid out the way
the DOM lays it out — same font, baseline placed for `line-height: 1` — then
dilated by ~1.5px for antialiasing. If a glyph does not render, the mask is
`null` and that item silently keeps whole-box behaviour, so an emoji the
platform cannot draw is never untappable. `tidy.maskStats()` lists them.

**Every floor placement goes through `geometry.js`.** `findFloorSpot()` when
the game picks the spot, `nearestFloorSpot()` when the player did. There were
three hand-rolled copies of the search — scatter, fling, container-eject — and
none of them knew about doors, which paint over items (z-index 7) and swallow
their taps. Anything that puts an item on the floor uses one of those two, and
`unstickFloorItems()` sweeps a whole run on generate and on load.

**Gold means done; red means wrong home.** A cell or badge gets `.wrong` when
`belongsIn()` says that emoji lives somewhere else. Those are the only two
colours with a meaning, so don't add a third without retiring one.

**Endings are a queue, not four things at once.** `celebrate()` in `main.js`
plays one beat at a time; a beat marked `inRoom` waits for the container panel
to close, and a finished container closes its own panel so the room's gold
ripple is actually watched. Nothing may interrupt a celebration — `busy()`
includes `celebrating()`, which is what keeps a talent draft off the top of a
win. Repaint BEFORE decorating: `roomCompleteFX()` hangs elements on the room
element, so a `renderRoom()` after it silently erases the effect.

**Tokens are drawn first so the clutter buries them — and yes, most of them are
completely hidden.** Every `.item` shares one z-index, so DOM order is the whole
burial, and `bury()` in `generate.js` drops a key within a couple of percent of
a real item's middle. **That is the feature.** A key you can see from the
doorway is not a hunt, and burial can never make a level unwinnable: the things
covering a key are things you have to pick up and file anyway, so a tidy room is
an exposed key by definition.

This was once "fixed" — offset onto a ring so a corner always showed, plus a
render pass that lifted any token under 20% visible out of the pile — after a
report of a key that couldn't be found. The key count was never the problem
(60 draws of every config, none short), the hunt was working as designed, and
the fix quietly deleted it. Both halves were reverted. If it looks like keys
are hiding too well, that is the intent; reach for **Debug: where are the
keys** in the gear before changing placement.

The one rule `bury()` still enforces is that a token never lands within
`ITEM_SPAN * 0.8` of another token — a key under a key reads as one key, and
hiding the thing you are hunting under another copy of itself is a joke at the
player's expense rather than a hunt.

**Rooms are dealt at random, then traded up only as far as the quota needs.**
Taking the biggest rooms first — the obvious way to guarantee `targetTypes` —
put the Kitchen in literally every free-play house, because it alone covers
Medium's whole target. See the room draw in `generate.js`.

**Clutter is scattered by floor AREA.** A uniform roll per item gave the
Observatory (a quarter of the Kitchen's floor) the same share and buried it.

**A double-tap zooms, but only on bare floor.** Every other target returns
earlier in the pointerup chain, so by the time the double-tap check runs the
tap hit nothing — which is why it can act on the second tap with no deferred-
tap latency. A tap on the panel backdrop within `PANEL_GRACE` of it opening is
the tail of the gesture that opened it, not a dismissal.

**A talent is half data and half code, and only the data half shows.** Add an
id to `upgrades.json` and nothing else and you get a card that animates, says
its name, raises a level and does nothing at all — which on screen is
indistinguishable from a talent you misunderstood. Two consumables shipped in
exactly that state (`freeWhirl`, `xray`): both set a field on the run that
nothing ever read. So `TALENT_IDS` and `CONSUMABLE_EFFECTS` live in
`js/config.js`, a tier-0 leaf both `validate.js` and `talents.js` can see, and
boot validation compares them against the data **in both directions**. Adding
either half without the other is a named error, not a quiet nothing.

**The talents, and why these ones.** Measured over 180 generated rooms and
10,272 floor items:

| talent | levels | what it does | how often it can fire |
|---|---|---|---|
| Bigger Hands | 5 | +1 hand slot | always |
| Sixth Sense | 1 | held item names its home; the home glows | always |
| Magnet Fingers | 3 | a correct put-away tugs N more of that kind off this floor | 71.7% |
| One Trip | 2 | …and takes the armful with it: L1 same kind, L2 anything that lives there | ~31% blind, more if you load up on purpose |
| Homesick | 1 | everything on this floor with an open home in this room glows | lights ~24% of a floor |

The two cascade talents fire at the same moment — a **correct** placement, in
`cascade()` next to `tossInto()`. Deliberately not on a wrong one: the grey
shake is how the game teaches where things live, and cascading five more items
into the wrong home turns one mistake into six the player then has to undo.
They ride *before* `afterMutation`, so rows they finish land in the same batch
as the row you finished by hand — one gold flash, one chip, one celebration.

Two talents were cut and should not be reinvented. **Magnet Fingers used to
fire on pick-up**, needing a match within 14% of the room: true 8.1% of the
time, so it did nothing in 92 pick-ups out of 100. The fantasy was right and
the moment was wrong — duplicates exist, they are just never *near* each other.
**Tidy Whirlwind** re-sorted the items already inside containers, so it never
moved the only number the player watches, and it cost a HUD button, a cooldown
ticker, a once-a-second interval and a consumable to refresh it.

**`levels`, not `costs`.** ⭐ is score and is never spent, so the price list
nothing read is gone. Only its length ever meant anything.

**A reward gate must travel with the score that earns it.** `checkDraftThreshold()`
computes `owed = draftsEarnedFor(starsEarned) - draftsTaken - pendingDrafts`,
and for a while the save wrote `points` but not `draftsTaken`. So every
**Continue** restored "you have 30 lifetime stars" beside "you have never
drafted", the run was owed every draft the player had already taken, and they
arrived one per safe moment — which in practice is **one every time you close a
container**, until the backlog drained. Four free talents, silently, on every
resume. All three counters are saved now, and a save written before they were is
settled with `draftsTaken = draftsEarnedFor(starsEarned)` on load: the honest
reading of an old save is "they took what their stars earned", and they are
holding the talents to prove it.

The reason this survived so long is that **the save round-trip was not reachable
from `window.tidy`**. `saveGame`, `loadGame`, `clearSave` and
`checkDraftThreshold` are on the console handle now. Continue is the one entry
point that restores state rather than generating it, so it is where state that
was never written shows up at all.

**Talents do not survive a level.** Campaign levels used to reload the previous
level's talents from `tidy-campaign-talents`, which meant the levels authored to
teach locks were played with Sixth Sense already in hand. `up` still rides in
the run save, so continuing mid-level keeps what you drafted.

**⭐ does not exist until 5-1 teaches it.** `"talents": false` in `levels.json`
turns the whole reward layer off for a level: no chips fly, and no draft opens
however many rows you finish. It is set on every level before 5-1 "Talent
Show", which is the one that explains stars — before this, the first threshold
(4 ⭐) was crossed on the *last item of 1-2*, and a modal asked the player to
choose between three talents they had never heard of, five levels early.

The gate is a single `if (!G.talents) return` at the top of
`checkDraftThreshold()`, and payouts go through `flyStar()` rather than
`flyReward()` — one condition in one place each, rather than a flag remembered
at four call sites. Stars are still *counted* while suppressed, so switching a
level's talents on needs no migration. `G.talents` is read from `levels.json`
on load rather than saved, for the same reason tips are.

**Tips are `kind` / `target` / `when` / `until`.** `when` makes a tip appear in
response to an event; `until` dismisses it. A tip is only marked learned if it
was the active one *and* actually rendered.

---

## Themes — more than one world

A theme is a **room pool** (`data/themes.json`) plus a **palette**
(`css/themes.css`). There are six: `house`, `dream`, `frat`, `ship`, `tower`
and `zoo`.

**A world arrives because somebody hired you into it.** `dream` proved a world
could be swapped in at all — the tidier works so hard they dream about tidying,
a wrapper that holds any setting without explaining how the player got there —
but nobody hires you for a dream, so it could only ever be an interlude. The
other four belong to **clients**: the frat house is Delta Tau Chi's, the survey
ship is Zorb's, the tower is Nettle's, the zoo is the parrot's. Retheming a
client's existing jobs costs one word per level, and it is the whole reason the
midgame stopped being beige.

**The house was 21 of the first 25 campaign levels.** That is the shape the
"I'm sick of the same attic with the same two chests" note was describing, and
it was arithmetic rather than taste: three dream levels were the only relief in
a run of twenty-one houses. It is now 15 of 34, the tutorial (1-1 to 2-2) and
the ending — the late clients are a robot learning chores, a new father and a
researcher who hasn't looked up in three years, all specifically domestic. The
first job that is not a house is **3-1, the frat's first**, which is the moment
a player has seen the house enough to be bored of it.

**A world is not a variety fix on its own.** Every new room shipped with three
containers and the levels that draw them ask for `cont: 3` or `4`, so a Pong
Basement showed the same three every single time — the Attic's problem at a new
address. `generate()` picks `cont` containers at random from a room's list, so
a room only varies if its list is LONGER than the ask. **Five is the floor**,
everywhere: C(5,3) is ten line-ups and C(5,4) is five. Measured over 40 draws,
every room in every theme now produces between four and twelve distinct
container line-ups; before this pass, seven house rooms and all twenty-five new
ones produced exactly one.

If you add a room, give it five containers. Three is a room the player will
have memorised by their second visit.

**An emoji's home is unique PER THEME, not globally.** This is the rule that
makes themed content possible at all, and it is worth understanding before you
touch `rooms.json`. A run only ever draws rooms from one theme
(`generate.js` takes its pool from `themeRooms`), so two homes for one emoji
only make a run unwinnable when both rooms can turn up *together*. The check
used to be global, which was stricter than the real requirement and blocked the
obvious content: a space theme could not use 🪐 🔭 🌙 🛰️ because the house's
Observatory had already claimed them — precisely the emoji it most wants. Now
`house` and `dream` may each give those a home. **Within** one theme, two homes
is still a boot error, for the original reason.

A room listed in **no** theme can never be drawn, so that is a warning.

**The theme reaches the screen through exactly one hook**: `applyTheme()` in
`main.js` sets `document.body.dataset.theme`, and `css/themes.css` repoints
`--bg`, `--wall` and `--wall-dark` — six declaration sites that between them
own the walls of all three room shapes, the door surround, the door glow and
the page background. Chrome tokens (`--panel`, `--ink`, `--gold`) are
deliberately **not** themed: the HUD, gear and job board are what stay put
while the world changes, and gold has to keep meaning "correct".

Floors stay per-room (`.floor-*`), not per-theme — a theme is a set of rooms
and each still wants its own ground.

`theme` is saved with the run. It used to be generated and then dropped, with
`loadGame` defaulting it back to `house`, which was invisible until something
read it — and then a resumed dream came back beige.

**Furniture is NOT themed, which is why `hull`, `arcane` and `mesh` exist.**
A theme repaints the walls and nothing else, and that is correct — the HUD, the
gold and the furniture are the constants a player navigates by. The cost is that
a wizard's rune cabinet drawn as `.k-wood` is a chest of drawers standing in a
purple room, which reads as the same house with the lights off. Three new kinds
(a bulkhead locker, a rune cabinet, a wire cage) give the ship, the tower and
the zoo a silhouette of their own. **The frat deliberately gets none**: it is a
house somebody wrecked, and reusing the domestic furniture is the joke.

**To add a world:** a `themes.json` entry · rooms in `rooms.json`, five
containers each (their emoji need only be unique within the new theme) · a
`floors` id and a `.floor-*` rule each · names in `names.json` · a
`body[data-theme="…"]` block · levels with that `theme`, each claimed by a
client stage · room notes in `quests.json` · a free-play preset in
`sizes.json`.

**Free play has one preset per world**, grouped under a heading the menu builds
from a `group` field. It used to be four house sizes, which meant the campaign
could take you to a ship and free play could not. `presetName()` in `main.js`
is why "Frat House" is not called "Frat House house" — the word "house" used to
be baked into three strings, because every preset was a size OF one.

---

## Clients

You are a professional tidier and people hire you. Every campaign level is one
client's job; they walk in at the start, say a line or two, and come back at the
end. A client's stages are a story arc, and arcs interleave — someone else gets
hired between two of yours.

**`levels.json` is config, `clients.json` is voice.** A stage claims a level by
id and can never change how it plays. The two rules that keep it honest are
checked at boot: **every level is claimed by exactly one stage** (the same shape
of rule as "every emoji has exactly one home"), and **a client's stages run
forward through `levels.json`**.

**Two clients can tell one story.** `parrot` and `boris` run the zoo together
and disagree about it; their stages alternate through `levels.json`, so the job
board shows the two faces trading places down the grid and the turf war is
legible before either of them says a word. Nothing in the arc system needed
changing for this — it falls out of "arcs interleave" plus deliberate ordering.

**A run never remembers its client.** `jobAt(levelIdx)` in `data.js` looks the
whole job back up from the level index the save already stores — which is why
this feature added nothing to the save format. `LOOKUP.jobByIdx` is the claim
table; `LOOKUP.arcs` is who-hired-you grouped by client, which the board now
uses only to work out which clients you have already met. Both are built in
`buildLookups()`, which runs *after* validation, so `validate.js` builds its
own claim map.

**The board is one tile per level, in `levels.json` order.** It used to group
levels under the client who hired you — a stack of cards, each with a face, a
quote and its own list of level rows — which read as a tall column of text with
small faces in it, and the faces are the point. So: a grid, play order, one big
face per tile, captioned with **who hired you above the head and the job's own
title below it** — the name labels the face, the title is what the tile is
offering. Everything on it is derived from the finished-ids set: a tile is
`done` if its id is in there, `now` if it is the earliest unfinished job,
`open` if it is behind the frontier, and `locked` past it.

**Faces are rationed to three states.** Everything you have worked and the job
you can start show their client outright; exactly **one** job ahead is greyed
(`.next`) so you can see who is coming and equally see you can't have them yet;
everything past that is a **silhouette** — a generic 🧑 blacked out, never
their own emoji dimmed, which would give the shape away. The first cut showed a
client's whole arc the moment you met them, which spent the arrival of every
one of their jobs at once. One tease at a time is the tease. The
level ids on the tiles run out of sequence near the end (7-1, 8-1, 7-2 …) and
that is correct: `levels.json` is append-only, so the phase-2 arcs were
appended in their own order and then interleave when played.

**`levels.json` is no longer append-only** — and that was the whole point of
the progress change. Progress used to be one integer index into it
(`PROGRESS_KEY`), so inserting a level silently re-pointed every saved player
at a different job. It is now the **set of finished level ids** (`DONE_KEY`),
plus a **frontier**: the furthest index you have ever reached. A tile is locked
only *past* the frontier, so a job inserted behind an existing player shows up
as playable-but-unplayed in a row of finished ones and **nothing downstream
re-locks**. Ids are what make insertion safe; the frontier is what makes it
humane.

An old integer is migrated once, read against `LEGACY_ORDER` in `config.js` —
a frozen copy of the campaign as it stood when indices still meant something.
**Never reorder or edit that list**: it is the only way to know what index 7
used to mean. New levels go in `levels.json` and never in there. The old key is
deliberately left in place so rolling back to an older build loses nothing.

Saves also record `levelId` alongside `levelIdx` and prefer it on load, which
is what stops a resumed run opening the wrong job after an insertion.

**The client is not an `.overlay`.** Overlays are dimmed full-screen modals and
the whole point of the character is that the house stays visible behind them.
`js/client.js` is pure presentation — it is handed a character and some lines
and knows nothing about runs — and `#clientLayer.speaking` is a full-viewport
`pointer-events:auto` catcher, which is the entire input block: not one line of
the pointer handlers knows this feature exists. Because it carries no
`.overlay` class, the two global gates that look for `.overlay.open`
(`drainDrafts`, `positionTips`) have to ask for it by name — `isSpeaking()`.

**The outro is a `hold` beat.** Beats normally end on a timer; a person talking
ends when the player taps. `hold:true` keeps `beatBusy` true for the whole
speech, which is what stops the win screen landing on someone mid-sentence.
The outro must NOT be `inRoom`: `playBeats()` has head-of-line blocking with no
retry, so an `inRoom` beat reaching the head with the container panel open would
park the queue *including the win beat that would have closed the panel*. It
closes the panel itself instead.

**The gear outranks the overlays.** `#gearBtn` carries `position:relative;
z-index:130` — `#hud` is a plain flex band and creates no stacking context, so
that competes directly with `.overlay` (120) and wins without taking the button
out of the HUD's layout. Settings is therefore reachable from the title screen,
the job board and the win screen, where the whole HUD used to be buried and you
had to start a level to change the volume. Two consequences to keep in mind:
the button has to close its own panel (it floats above it), and anything in
that panel which acts on a run is disabled when there isn't one — "New house"
re-rolled a config that doesn't exist and "+1 ⭐" repainted a HUD with no rooms,
and both threw. The single exception is `body.drafting`, which hides the gear
for the talent draft: that modal has no close button by design and a gear over
it is a back door out of the one choice the game insists on.

**Settings names the job you're in.** `nowPlaying()` fills the line under the
Settings heading each time the gear opens — level id, level name, client and
stage. Mid-level there was previously no way to tell 5-1 from 5-3, which makes
a bug report ("the second alien level") much harder to act on than it should
be.

**Five debug buttons in the gear, and three of them matter.**
*Where are the keys* rings every loose token, lifts it above the clutter, and
names the rooms holding one. It is the only way to tell a level that is
*solvable* from one that is *findable* — generation buries keys deliberately,
so "I searched and there is no key" is a claim you need a way to check. It is a
**flash, not a mode**: `REVEAL_MS` (5s), and anything meaning "yes, I've seen
it" ends it early — picking up the token it points at, or pressing the button
again. `stopReveal()` is also called from `endCeremony()`, so a pending timer
can never fire into a run that has already ended. *Finish this job*
files everything and then hands the LAST item to `afterMutation`, so the whole
ending runs for real — row, container, the panel bowing out, the room's gold,
the client, the win screen. It would have been easier to call `showWin()`
directly and that would have tested nothing; the thing worth testing here is
the sequence. It closes the gear first, because the gear is an overlay at
z-index 120 and the client is at 100. *Relock all jobs* puts progress back to
zero and reopens the board.

*Unlock all jobs* is the other half of that pair and the one to reach for when
you want to look at a level rather than earn it. **It moves the gate; it does
not mark anything done**, and that is the entire design rather than an
implementation detail. Writing all 34 ids into `DONE_KEY` is the obvious
version and it is wrong twice over: it overwrites the real record of what you
have played with no way back, and it lies to everything downstream — every tile
renders `done` with a ✅, the board reads "34 of 34", the *now* job falls off
the end, and every client shows their **farewell** instead of their arc. The
story is the thing you turned it on to see, so that version hides it.

The frontier is the only thing that locks a tile (`stageState`), so the override
is one assignment inside `progress()` — `if (unlocked) frontier = LEVELS.length`
— placed before anything derives from it. The board, the four tile states, the
face rationing and the replay line all then agree without one of them knowing
the feature exists. `done` stays untouched, so **turning it off restores exactly
the progress you had**; the toggle lives in its own key (`UNLOCK_KEY`), never
inside the progress record.

Two things it must keep doing. It is a **toggle that reports its own state**
("Unlock" / "On ✓", re-synced every time the gear opens): its effect is
invisible until you open another screen, so a button that always reads the same
leaves you guessing which way you left it. And the board **says out loud** that
it is unlocked (🔓 in the subtitle) — without that there is no way to tell a
real 34-of-34 from a debug one, not from a screenshot and not from a bug report
a week later. Same reasoning as `nowPlaying()`.

From the console: `tidy.unlockAll()`, `tidy.unlockAll(false)`, `tidy.progress()`,
`tidy.relockAll()`.

**The note is in the client's hand too.** `voice()` in `quests.js` resolves the
signature and any stage-authored note copy; the signature is baked into the note
when it drops, not read live. Free play has no client, which is what "— M" now
means: the hand a house writes in when nobody hired you.

## Add to Home Screen

`manifest.json` plus four PNGs in the game folder. Saved to a phone before
these existed, the game showed a grey tile with a **T** on it — the browser's
last resort when a page gives it no icon it can use.

The SVG favicon in `index.html` is not one of those: **iOS ignores SVG for
home-screen icons** and Android wants a manifest, so both fell back to the
first letter of the title. Home-screen icons have to be real raster files.

| File | Who reads it |
|---|---|
| `apple-touch-icon.png` (180) | iOS. Nothing else will do. |
| `icon-192.png`, `icon-512.png` | the manifest, i.e. Android/desktop |
| `icon-512-maskable.png` | Android adaptive icons — glyph at 50% so a circle crop can't clip it |

They're the 🏠 emoji rendered on the game's wall-brown. To change the glyph,
re-render: an HTML page with the emoji centred on that background, screenshot
at 180/192/512 with the glyph at 66% of the canvas (50% for the maskable one).
Do it through CDP `Emulation.setDeviceMetricsOverride` rather than
`--window-size`; Windows enforces a minimum window width, which silently crops
anything smaller than about 500px.

There is deliberately **no service worker**. The game is a network of small
JSON files that change often — `DATA_VERSION` exists precisely because
*ten-minute* CDN caching was already confusing — and a cache-first worker
would turn that into permanent staleness for a first-open-offline case nobody
has asked for. `display: standalone` is what makes it feel like an app.

## Saves

| Key | Holds |
|---|---|
| `tidy-adventures-v4` | the current run, talents included |
| `tidy-campaign-done` | the ids of the jobs you have finished |
| `tidy-campaign-unlocked` | the retired integer, read once to migrate, then left alone |
| `tidy-audio` | master / effects / music volume, and mute |

**Music uses an `<audio>` element for the source but is routed THROUGH the Web
Audio graph, and every volume change is made on a `GainNode`.** The element is
there because one long looping file wants to stream — decoding three megabytes
into an `AudioBuffer` costs memory and delays the first note. The routing is
there because **`HTMLMediaElement.volume` is read-only on iOS**: the setter is
silently ignored, so the first build's music could not be turned down or muted
on an iPhone while behaving perfectly on a desktop. Never set `el.volume` as
the volume path again — the chain is element → `MediaElementSource` → per-track
gain (trim + cross-fade) → `musicGain` (the Music slider) → `masterGain`
(Master and mute, shared with the effects, which is what makes one mute button
cover both). Music is same-origin on purpose; moving it to another origin needs
`crossOrigin` **and** CORS headers or the graph outputs silence.

**Audio stops when the game is put down.** `visibilitychange` (plus `pagehide`
for iOS's back/forward cache) pauses the track and suspends the context;
returning resumes from where it left off rather than restarting the loop.
Without it a looping element plays on into a locked phone and takes over the
iOS lock-screen controls — survivable in a tab, broken-feeling in something
installed to a home screen.

Browsers
refuse audio before a gesture, so a track asked for too early is remembered in
`blockedTrack` and started by the same first-tap listener that unlocks the
effects — which is why the title music begins the instant you touch the screen
rather than never. `playMusic` ignores a request for what is already playing,
so calling it from every screen transition can't restart a track underfoot.

`tidy-campaign-talents` is retired — starting a campaign level deletes it, so a
save written by the carry-over build can't come back.

Bump `SAVE_VERSION` in `js/config.js` to invalidate old runs; the version
check discards them cleanly. Campaign unlocks are deliberately *not* cleared
by starting a new run.

---

## Testing checklist

Run through this after any change; it's what the browser tests cover.

- Title → Free Play → each size generates, and the item count matches
  `targetTypes × rowLen` exactly (test across several draws — room selection
  is random).
- Campaign 1-1 → 5-1, each generates; tips appear in order and each is
  dismissed by the gesture it teaches.
- Continue is hidden with no save, and with a save too old to load.
- Instructions from the title screen closes the title and returns to it.
- Single tap opens a container; locked furniture shakes and names the key it
  wants.
- Pinch zoom on a real touch device, and no accidental container-open when the
  trailing finger lifts.
- Labels stay inside their furniture at maximum zoom, on a phone.
- Every draft offers three cards, every time — including after you have taken
  every talent, where it back-fills with consumables.
- Magnet Fingers at level N files N extra of that kind; One Trip at level 2
  empties the whole armful into one container. Drop something in the WRONG
  container with both maxed and exactly one item moves.
- Homesick lights roughly a quarter of a floor, and an item whose home is
  locked or full stops glowing.
- A talent draft never interrupts a drag or an open container; talents and
  hand slots are gone again at the start of the next campaign level, and
  survive quitting to the menu and continuing the same level.
- Drag out of a hand slot onto open floor: the item lands where you let go.
  Aim at a doorway and it lands just clear of it, never under the door.
- Grab a floor item near its edge and drag: it must not jump when the drag
  starts, and your finger must stay over the part of it you grabbed. Check it
  zoomed in too — the error scales with the camera.
- Aim at an emoji whose neighbour overlaps it and tap: you get the one you
  aimed at, not the one whose invisible padding was on top. Then tap a bare
  gap between two items — one of them still picks up, because the padding is
  still there when nothing is competing for the point.
- Drag an item onto a container that has clutter lying across its face. It
  goes in. The old build flung it back onto the floor from about a fifth of
  every container's surface.
- Dragging over a door or the inventory bar must not highlight the furniture
  behind them.
- Play 1-1 through 4-2: no ⭐ chips, no ⭐ button, and no talent draft. The
  first draft is in 5-1, whose tip then points at the button. Free play has
  stars from the first row.
- The win screen makes a sound. A key into a lock that still wants more makes
  a sound. A flick that lands in a pile makes a sound; one that lands on bare
  floor does not. All three were silent until v1.3.0.
- Double-tap bare floor zooms toward that point; again returns to the framed
  view. A single tap, two slow taps, and a double-tap on furniture all leave
  the camera alone (the last one opens the container and keeps it open).
- Keys sit UNDER the clutter and are usually invisible until you move something:
  tapping a pile picks up what's on top, and the key appears as the room empties.
  That is correct. What must NOT happen is a key under another key.
- Every lock has enough reachable keys: 60 draws of every level and size, keys
  counted only in rooms you can walk to before opening anything. Re-run this
  before believing any "I can't find the key" report — it has been the tool
  twice now, and the answer was the same both times.
- Finish a room with a container open: the panel closes itself, then the gold
  ripple travels outward, then the message — one at a time, never together.
  Finish the whole house that way and the win screen comes last.
- Several houses in a row draw noticeably different rooms; no room is in every
  house except at Mega, which asks for nearly every type in the game.
- The Observatory is round and the Wine Cellar is hex, with items inside the
  walls and furniture clear of the doorways.
- Foreign items in an open container carry a faint red wash; the container's
  own items don't. Same red on the badge strip above the furniture.
- Not every room has a sealed container (`roomShare`, quests.json), but every
  room still leaves a note.
- Every campaign level opens with a client over a rendered room and ends with
  their thank-you, *after* the gold ripple and *before* the win screen. Taps
  during a speech never reach the room.
- Win with the container panel open: the panel closes, the room celebrates, the
  client speaks, the win screen waits for them. It must never stall there.
- A client you haven't met is a silhouette with no name and no stage rows; a
  paused arc shows its waiting line, not the next stage's teaser.
- **Progress migration**, re-run after *any* change to `levels.json` order:
  set `tidy-campaign-unlocked` to 0 / 4 / 13 / 22 by hand with
  `tidy-campaign-done` cleared, and confirm every job that integer had finished
  is still finished, that nothing already unlocked re-locks, and that an
  inserted level shows as playable rather than dragging the frontier back.
  Then reload again: the migration must be idempotent.
- A dream level draws only dream rooms, is winnable to "0 left", and keeps
  `data-theme="dream"` across quit-to-menu and Continue. The palette changes
  between a house and a dream level; the HUD and gear do not.
- Two themes sharing an emoji boots clean; the same emoji twice *inside* one
  theme is a named boot error.
- Campaign notes are signed by the client; free-play notes are still "— M".
- The version on the title screen matches `VERSION` in `js/config.js`; the gear
  shows it again with the age of the copy, and Refresh brings back a newer
  build without reinstalling (test it by editing a file and pressing it — an
  ordinary reload will still show the old one, which is the point).
- Settings scrolls on a short screen and its Close button stays reachable.
- The gear opens from the title screen, the job board, Instructions, the size
  menu, mid-level, over a talking client and over the win screen — and is
  hidden only during a talent draft. With no run in progress, the run-only
  buttons are greyed rather than throwing.
- Finish a container → a note drops → picking it up pins an objective →
  completing it pays out and replies.
- Save → reload → Continue restores the run mid-play — **and then zoom, walk
  through a door and swipe.** Continue is the one entry point that doesn't call
  `resetZoom()`, so it is the one that finds broken camera state.
- **The talent draft after a Continue.** Earn past a threshold or two, take the
  drafts, quit to the menu, Continue, then finish rows and close containers. You
  must be offered NOTHING you have already taken. This is the bug above and the
  symptom is unmistakable once you know it: a draft every time a container
  closes, several in a row, then nothing.
- Every theme draws only its own rooms, keeps its `data-theme` across
  quit-to-menu and Continue, and its walls change while the HUD and gold do not.
  Six worlds now, and the two purple ones (dream, tower) must not be mistakable
  for each other — the dream is cold and the tower has a fire in it.
- Free Play lists nine presets under two headings, the card scrolls on a short
  screen with Back still reachable, and no preset is described as a "house"
  unless it is one.
- Play the same level five times and watch one room. Its containers must not be
  the same five twice running — that is what the five-container floor buys, and
  it is the single thing most worth protecting when adding rooms.
- **Unlock all jobs**, with a few levels genuinely finished: every tile becomes
  playable, every silhouette becomes a face, the ✅ marks stay on only the jobs
  you really did, the subtitle says 🔓, and `tidy-campaign-done` is byte-for-byte
  what it was. Press it again and the locked count, the silhouette count and the
  frontier all come back to exactly what they were. It survives a reload. The
  last tile on the board is reachable by scrolling on a phone — there are 34 of
  them now, and with this on the last ones are the point.
- Console clean throughout.

---

## Original

`ref/tidy-house-v3.html` is the 2,495-line single-file build this came from,
kept verbatim for comparison.
