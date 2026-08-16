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
| what a talent costs and how many levels it has | `data/upgrades.json` |
| when talent drafts happen | `draftSteps` in `data/upgrades.json` |
| item names in the loupe | `data/names.json` |
| room shapes, which rooms a theme uses | `data/themes.json` |
| furniture size, anchors, keep-out padding, key/coin emoji | `data/furniture.json` |
| how much floor to keep clear in front of doors | `doorZone` in `data/furniture.json` |
| the note each room leaves you, and its reply | `data/quests.json` |
| how many rooms start with a sealed container | `roomShare` in `data/quests.json` |
| every sound | `data/audio.json` |
| title, tagline, help screen | `data/strings.json` |

Each file opens with a `_readme` explaining its rules. The loader ignores any
key starting with `_`.

**A bad edit stops boot with a named on-screen error**, not a silent bug —
that's `js/validate.js`. It checks that an emoji has exactly one home, that
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
0  config · util · dom · validate · audio
1  data · toast/feedback
2  state · geometry
3  save · rules · generate
4  render · hud · inventory · containerView · tips · camera · talents · quests
5  actions · locks · win · menus
6  input
7  main
```

Currently `js/main.js` still holds tiers 3–6 in one file; the leaves,
`state`, `generate`, `geometry`, `camera`, `feedback`, `talents`, `quests`
and `audio` are extracted. The remaining split is mechanical.

Three cycles exist in the original design and are cut deliberately:

- **`hud → save → render → hud`.** `save.js` never repaints; callers do.
  Nothing in the save path may import the render tier.
- **`render → containerView → render`.** `closeCont()` lives with the actions,
  not with the container view, which only paints.
- **`actions → menus → render → actions`.** `showWin()` is separate from
  `menus`; the direction is strictly `actions → win → menus → render`.

Modules that own a loop (`startTipLoop`, the whirl ticker) export a start
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

**Tokens are drawn first so the clutter buries them.** Every `.item` shares one
z-index, so DOM order is the whole burial, and `bury()` in `generate.js` drops
keys and coins onto a spot something is already lying on. A key you can see
from the doorway is not a hunt.

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

**Talents do not survive a level.** Campaign levels used to reload the previous
level's talents from `tidy-campaign-talents`, which meant the levels authored to
teach locks were played with Sixth Sense already in hand. `up` still rides in
the run save, so continuing mid-level keeps what you drafted.

**Tips are `kind` / `target` / `when` / `until`.** `when` makes a tip appear in
response to an event; `until` dismisses it. A tip is only marked learned if it
was the active one *and* actually rendered.

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

**A run never remembers its client.** `jobAt(levelIdx)` in `data.js` looks the
whole job back up from the level index the save already stores — which is why
this feature added nothing to the save format. `LOOKUP.arcs` is the job board's
order; `LOOKUP.jobByIdx` is the claim table. Both are built in `buildLookups()`,
which runs *after* validation, so `validate.js` builds its own claim map.

**`levels.json` is append-only.** Progress is a single integer index into it
(`PROGRESS_KEY`), so inserting or reordering a level silently re-points every
player's saved progress at a different job. Saves now also record `levelId` and
prefer it on load, which turns that from corruption into a clean discard.

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

**Two debug buttons in the gear, and one of them matters.** *Finish this job*
files everything and then hands the LAST item to `afterMutation`, so the whole
ending runs for real — row, container, the panel bowing out, the room's gold,
the client, the win screen. It would have been easier to call `showWin()`
directly and that would have tested nothing; the thing worth testing here is
the sequence. It closes the gear first, because the gear is an overlay at
z-index 120 and the client is at 100. *Relock all jobs* puts progress back to
zero and reopens the board.

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
| `tidy-campaign-unlocked` | how far the campaign has been unlocked |
| `tidy-audio` | volume and mute |

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
- Whirlwind on Mega (`rowLen` 8) leaves the remaining count correct.
- A talent draft never interrupts a drag or an open container; talents and
  hand slots are gone again at the start of the next campaign level, and
  survive quitting to the menu and continuing the same level.
- Drag out of a hand slot onto open floor: the item lands where you let go.
  Aim at a doorway and it lands just clear of it, never under the door.
- Double-tap bare floor zooms toward that point; again returns to the framed
  view. A single tap, two slow taps, and a double-tap on furniture all leave
  the camera alone (the last one opens the container and keeps it open).
- Keys sit UNDER the clutter: tapping a pile picks up what's on top, and the
  key appears once the pile is cleared.
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
- An existing `tidy-campaign-unlocked` integer unlocks exactly the levels it did
  before, now grouped under faces.
- Campaign notes are signed by the client; free-play notes are still "— M".
- The version on the title screen matches `VERSION` in `js/config.js`; the gear
  shows it again with the age of the copy, and Refresh brings back a newer
  build without reinstalling (test it by editing a file and pressing it — an
  ordinary reload will still show the old one, which is the point).
- Settings scrolls on a short screen and its Close button stays reachable.
- Finish a container → a note drops → picking it up pins an objective →
  completing it pays out and replies.
- Save → reload → Continue restores the run mid-play.
- Console clean throughout.

---

## Original

`ref/tidy-house-v3.html` is the 2,495-line single-file build this came from,
kept verbatim for comparison.
