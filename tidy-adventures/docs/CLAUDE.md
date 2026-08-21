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
| how many rooms / items / locks a campaign level has | `data/levels.json` |
| free-play size bands, and how many houses each holds | `bands` / `housesPerBand` in `data/sizes.json` |
| which world a character's free-play houses draw from | `world` on a client in `data/clients.json` |
| what a character's five free-play houses are called | `places` on a client in `data/clients.json` |
| row length (how many of each item exist) | `rowLen` in either of the above |
| hint text, and when hints appear | `tips` in `data/levels.json` |
| how many levels a talent has | `levels` in `data/upgrades.json` |
| what a talent DOES | `TALENT_IDS` in `js/config.js` + the code that reads it |
| **how many talents a house teaches** | `rewards` on a level, or on a free-play band |
| **the permanent upgrades, and their prices** | `home` in `data/upgrades.json` + `HOME_IDS` in `js/config.js` |
| **what it costs to take a client on** | `cost` / `needs` on a client in `data/clients.json` |
| item names in the loupe | `data/names.json` |
| room shapes, which rooms a theme uses | `data/themes.json` |
| furniture size, anchors, keep-out padding, key/coin emoji | `data/furniture.json` |
| how much floor to keep clear in front of doors | `doorZone` in `data/furniture.json` |
| the note each room leaves you, and its reply | `data/quests.json` |
| how many rooms start with a sealed container | `roomShare` in `data/quests.json` |
| what the client SAYS mid-job (a door, a room, a wrong home) | `quips` on a client in `data/clients.json` |
| what they say when you come back to a half-done job | `nudge` on a stage in `data/clients.json` |
| the same six lines when nobody hired you | `houseVoice` in `data/strings.json` |
| what a piece of furniture LOOKS like | `kind` in `data/rooms.json` + a `.k-<kind>` skin in `css/furniture.css` |
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
1  data · toast/feedback · chatter
2  state · geometry · client · home
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

One consequence that costs ten minutes if you don't know it: **a live room's
`id` is its INDEX in the run, not its id in `rooms.json`.** `G.rooms[2].id` is
`2`. So a test that wants "the Bathroom" has to match on `floor`, which is the
one definition field that survives generation — `G.rooms.find(r => r.floor ===
"bathroom")`. Containers keep their real string id, which is why `data-cont`
lookups work.

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

**Feedback has FOUR channels, and only one of them is the narrator.**
`js/feedback.js` has three: `bump()` for rejections (shake the thing that said
no, one sentence the first time a rule is hit), `flyReward()` for rewards, and
`say()` for receipts. `js/chatter.js` is the fourth — the client leaning in.

`say()` used to carry everything, and it was the wrong channel twice over for
most of it. **Physically**: it slides a strip out from under the HUD, and the
player's eyes are on the thing they just tapped, which is never the top of the
screen. **Tonally**: this game's whole personality is the person who hired you,
and the six most eventful moments in a room were the one place nobody spoke.
"The door creaks open ✨" is not in anybody's voice.

So the split is now by KIND OF THING, not by shape of widget:

| | carries | looks like |
|---|---|---|
| `say()` | receipts — the level id, "+3 put away", the gear's debug buttons | grey strip under the HUD |
| `chatter()` | the six narrative moments, in the client's voice | small bubble beside their face, bottom-left, auto-dismissing |
| `showClient()` | arrivals, thank-yous, and the Continue nudge | full figure, input blocked, waits for a tap |

**What deliberately stayed a receipt: the cascade and One Trip payouts.** Those
fire on between a third and three quarters of all correct placements, and a
talent proc is not something a client has an opinion about — making it speech
means the client comments on most of the taps in the game, which is how you
teach a player to stop reading. The flying ⭐ chip is already their receipt.

**The chatter queue is serial and RANKED.** Finishing a container can also
finish the row, the room, the quest and the run in the same millisecond — the
pile-up `celebrate()` exists for. Two rules keep this channel out of it: one
bubble at a time with a gap between, and **a higher-rank line evicts everything
still waiting** (a chest creaking open is not worth sitting through on the way
to hearing the room is clear). What is already ON SCREEN is never yanked — that
is the bug the module is fixing. `CHAT` in `js/chatter.js` is the whole pecking
order, keyed by the same names as `quips` in `clients.json`.

**Precedence is injected, not imported.** `client.js` calls `clearChatter()`
when it takes the screen, so `chatter.js` must not import `client.js` back.
Instead `main.js` calls `setChatterGate(() => isSpeaking() || !!$(".overlay.open"))`
once — which also gets the overlays covered for free without `chatter.js`
learning what an overlay is. A gated line WAITS rather than being dropped; only
`clearChatter()` discards, and `endCeremony()` and `showWin()` are what call it.

**Coming back to a half-done job is `showClient()`, not `chatter()`.** Continue
used to `say("Welcome back")` — the sentence a bank website says. A player who
last played a week ago has forgotten whose house this is and what was riding on
it, and both are authored: the client, and `nudge` on the stage. The Dean still
comes on Friday. The estate agent still comes Tuesday. The baby is still
asleep. It is the loud channel because it happens at most once per resume and
is the one line the player must not miss; the level id lands as they leave,
exactly as on a fresh start. Free play has nobody with a stake in it, so the
house says its line quietly through `chatter()` instead.

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

**A CONTAINER MAY NOT ADVERTISE WHAT IT WON'T TAKE.** This is the failure mode
of the taxonomy rule in `rooms.json` ("confusable things share a container, and
the container's NAME is the rule") that no amount of care catches by eye,
because catching it needs two files open at once: a container whose **name
contains the name of an item that lives in a different container in the same
room**.

Three shipped. *Minerals & Salts* stood next to the salt. *Mirrors & Lenses*
stood next to the mirror. *Supplements & Salts*, the salt again. That is worse
than an unguessable home, because the player is not guessing — they are reading
the label, and the label is lying to them.

Check **5c** in `validate.js` is now the lint for it: word-stem matching with
both sides authored (container names in `rooms.json`, item names in
`names.json`), which is what keeps it precise instead of a heuristic that cries
wolf. It found the three above plus two more nobody had reported — *Paper
Boxes* beside the paper lantern, and *The Warm Rocks* beside the rock.
`"baitOk": true` on a container opts out, for the one place in the game where
the bait IS the joke: the Banana Vault's *Not Bananas*.

The fixes are worth reading as a set, because they are three different fixes:
**rename the container** (*Minerals & Salts* → *Stone & Ore*, *Mirrors &
Lenses* → *Lenses & Eyewear*, *Supplements & Salts* → *Supplements &
Measures*, *The Warm Rocks* → *The Basking Tank*), **rename the emoji** (🏮 was
"Paper lantern" and is now "Red lantern", which is both more accurate and stops
it baiting the Attic's *Paper Boxes*), or **move the item**, when the item
really does belong where the name says. A bathtub filed under *Comfort Objects*
next to a container called *Cleansing Apparatus* is the robot being wrong, so
🛁 moved and ☕ took its place; 🩰 ballet shoes moved out of *Robes & Hats* into
*Boots & Gloves* for the same reason.

**Some homes are a coin flip and no lint fixes that**, so the game tells you.
"Is a salt shaker dry goods or a seasoning" is a genuine ambiguity — the rule in
`rooms.json` already admits that where you can't keep the confusable ones
together, the player is reading the designer's mind. What CAN be fixed is the
PRICE of losing the flip: `misfileHint()` in `main.js` has the client name the
real home, **once per emoji per run, and only when that home is in the room you
are standing in**. Naming a container three doors away is a spoiler and a walk,
not a lesson — that is what Sixth Sense is for, and you spend a ⭐ on it. The
once-per-emoji record lives in `G.taught`, the same set `bump()` uses.

**NO TWO CONTAINERS IN ONE ROOM SHARE A `kind`.** The first eleven kinds were
MATERIALS — steel, wood, wicker, glass — which is a real axis and was the right
first one. It runs out the moment a room holds a fridge AND a sink and both of
them are `steel`, which is what shipped: the bathroom's *Under the Sink* and
the frat kitchen's *The Sink* were both drawn as the fridge skin, and the
bathroom had `plastic` twice. When two pieces of furniture in a room have the
same silhouette, the name plate is the only way to tell them apart — which is
the exact job the drawn furniture exists to take off the player.

So there is a second wave of **twelve SHAPE kinds** (`basin tub shelf hook bin
heap frost tank table cubby stand couch`), drawn from what the container is
CALLED rather than what it is made of: a sink has a tap and a dark bowl, a bin
has a lid that overhangs, a hook rail has hooks hanging below it, a heap has no
straight edge anywhere on it. Every container in `rooms.json` was reassigned
against them and **no room repeats a kind**; check 5b warns if one starts to.

Three things learned drawing them, all of which cost a second pass:

- **The carcass is sometimes the hole.** `.k-shelf` paints its boards on top of
  a dark recess rather than the reverse, because an open shelf is defined by
  being able to see past it. Same for `.k-table`, whose carcass is transparent.
- **`mask()` on a stripe field is not how you draw five of something.** The
  first `.k-hook` carved hooks out of a repeating gradient and rendered as four
  barely-visible slivers. Draw ONE and clone it with `box-shadow` offsets in
  **`cqw`** — `.furn` sets `container-type:size`, so those resolve against the
  piece's own box and the spacing holds at any zoom and any room scale. Same
  idiom for the couch's arms, the stand's handles and the tub's feet.
- **`.flabel` moves off the bottom on kinds whose bottom edge isn't solid.** A
  name plate floating in the gap under a tabletop, or over a row of hooks,
  reads as a bug. `.k-table` and `.k-hook` push it to the top with
  `margin-bottom:auto`.

Judge a skin against its NEIGHBOURS, not on its own: build a grid of all of
them at once as `.furn.k-<id>` divs inside `#roomHost` and look at it. Six of
the twelve were wrong in ways that were invisible one at a time.

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

**Three more sets were read on the way in and dropped on the way out**, which
is the same half-finished shape and hid for the same reason: an empty `Set`
behaves like a fresh run rather than throwing. `loadGame()` has always restored
`d.taught`, `d.events` and `d.roomFxDone`; `saveGame()` never wrote any of
them. So `taught` — the "say this sentence the first time the player hits this
rule" record — was reset by every **Continue**, and the whole game re-taught
itself from scratch; `events` is what tip `when`/`until` conditions watch, so a
dismissed tip could come back; `roomFxDone` is what stops a room playing its
gold ripple twice.

It matters more now that `misfileHint()` puts `misfile:<emoji>` keys in
`taught` to name a home once and not again — without the write, "once" meant
"once per sitting". Additive, so no `SAVE_VERSION` bump: `loadGame()` already
defaulted each to an empty set, and an older build ignores fields it never
reads. **When you add a field to `loadGame()`, add it to `saveGame()` in the
same change** — that is the same rule as "if you add a field to `clients.json`,
render it in the same change", and this file now has three examples of it.

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

## How big a job is

**"All the levels feel the same size" was true, and it was arithmetic.** From
T-1 to the end, twenty-six consecutive levels sat at 3–6 rooms with `cont` 3–4,
`types` 5 and `rowLen` 5. Every room in the back half of the game therefore held
three or four containers of five rows of five, the item counts crept from 170 to
700 in steps of a few per cent, and eleven story arcs all ended in roughly the
same 500-item job. The campaign climbed; nothing about it *swung*.

Size is now **two things multiplied**, and neither of them is "how far through
the campaign are you":

1. **Where you are in this client's arc.** A first job is a look-in — they are
   trying you out, and it is over in a few minutes. A second is the real work.
   A third is everything they have. Every arc climbs across its stages.
2. **How big that client's place is** — a trait of the character, not of the
   schedule. Mom's is a bedroom. The frat house is seven rooms and Delta Tau
   Chi's last job uses all seven. A survey ship is six cramped compartments. The
   dream is four rooms and can never be more, because the pool is four.

The second one is what stops the eleven finales being the same job: Marguerite's
biggest (472) is smaller than Boris's middle one (392), and both are right.

Because **arcs interleave**, the two together produce a sawtooth — a client's
finale is followed by somebody else's look-in. In play order the campaign now
reads `1111111112221221333231212212332333` (marks per tile), and the sharpest
edge in it is T-3 → 7-1: 600 items to 153, a wizard finishing four hundred
years of hoarding and then a robot being shown how to put one shelf away.

**Two boot warnings hold the shape**, both in `js/validate.js`, both warnings
rather than errors because this is design shape and a level that breaks them
still plays:

- **an arc that gets smaller.** The numbers live in `levels.json` and the voice
  in `clients.json`; nothing else keeps the two agreeing.
- **two consecutive jobs within a fifth of each other**, past 5-1. That check is
  the whole point of this section and the first thing to look at if the game
  starts feeling flat again. Everything before 5-1 is exempt: the opening is a
  teaching ramp and is meant to climb steadily.

Both measure `expectedItems()` (`js/util.js`), not `rooms × cont × types × rowLen`.
The two differ by up to a fifth on a house level — `cont` is capped by how many
containers the room it lands in happens to have and `types` by how many that
container holds, so the Closet's two-emoji shoe rack returns two when asked for
five. Non-house themes run five-of-five throughout and hit the bound exactly,
which is why the gap only shows on house levels. Measuring the ask flagged two
pairs that are a clear quarter apart in play.

### rowLen and cont are texture, not difficulty

**A star is one completed ROW**, so `rooms × cont × types` is the star count and
`rowLen` is free — it changes the rhythm of a job without touching the reward
economy at all. It had been 5 for twenty-six levels running. It is now a
per-world signature: 6 in the frat house because there are six of them, 6 in a
dream because a dream has more of everything, 4 on Zorb's ship *and in the first
job he gives you*, which is in a house, 5 at home.

`cont` is the other one. Many rooms holding a few things each plays nothing
like a few rooms crammed, at the same item count — so 6-1 is seven frat rooms of
three and 5-1 is four ship rooms of four.

### The ceiling on cont is 4, not 6

`furniture.json` lists six anchors per set and reads as though six containers
fit anywhere. They do not: the `soft` set used for **round and hex** rooms puts
its 5th and 6th slots in the same middle column as its 1st and 2nd, so a fifth
container lands a quarter on top of the first. Measured, not guessed — the first
draft of this retune gave 5-1 five containers and the only symptom was a
screenshot.

`anchorPrefix()` in `js/util.js` computes the real ceiling from the anchor
data, so widening the list raises it everywhere at once. Two callers:

- `validate.js` **refuses** a level whose `cont` exceeds it, judging a theme on
  every shape it can deal *plus any shape its rooms pin* — the house theme is
  rect-only and still contains a round Observatory and a hex Wine Cellar. A
  rect-only theme (the frat) may use all six.
- `generate.js` **caps free play**, which asks for a whole-run type quota rather
  than a per-room count and took however many containers that needed. A Mega
  house was putting five containers in the round Observatory and two of them
  overlapped. The quota costs nothing to keep: the top-up pass hands leftover
  types to containers the room already has, as extra rows. Verified — every
  preset still delivers `targetTypes × rowLen` exactly.

### scale is not a free choice

Items scatter by floor **area**, so how readable a job is comes out as
items-per-room over room size. Halve the items in a room and the room has to
shrink with them or it reads as swept; double them and it reads as a heap. Every
`scale` in `levels.json` was recomputed from the hand-tuned density curve when
the sizes changed —

> `newScale = oldScale × √( (newItemsPerRoom / old) × (oldFreeFloor / newFreeFloor) )`

— where free floor allows for the fact that furniture eats it too, so a room
with four containers has less of it than one with three. Change `rooms` or
`cont` without touching `scale` and the level will look wrong before it
plays wrong.

### The player is told

An unexpectedly short level reads as a level that **ended early** unless
something said it was going to be short — so the size is on both surfaces that
offer a job:

- the **next-job card** footer: `4-2 · A PROPER JOB` beside the id.
- a **board tile**: one to three marks on the id line. On one screen of
  thirty-four tiles that is the only place the shape of the whole campaign is
  visible. Hidden on a client you have not met, along with their face and name —
  how big somebody's house is is part of meeting them.

Both come from `sizeBand()` → `jobSize.bands` in `strings.json`, and both are
**derived**. A `"size"` field on a level would be correct until the first time
somebody changed `rooms`, and then it would be a label that lies.

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

**One card component, two screens.** `fillJobCard()` is pure presentation —
handed a face, a name and up to two lines, knowing nothing about runs, saves or
progress, the same way `js/client.js` is handed a character and some lines.
That is what lets the win screen and the title screen share it: the win screen
offers a job that has not started, Continue offers the one you are standing in
the middle of, and only the copy differs.

| | win screen | Continue |
|---|---|---|
| tag / chip | Next job · New client \| Asking for you again | Continue · In progress \| Free play |
| face + name | the next client | the client whose house you are in, or the **world's** icon in free play |
| body | their `hook` — how they found you | how much is still on the floor |
| quote | **nothing** | their `teaser` — the ask, still outstanding |
| footer | the level id and how big the job is | the level id and the room you were in |

**The quote is the one thing the two cards do NOT share, and which of them gets
it depends on whether the player has already been in the room.** A `teaser` is
authored from the same beats as the stage's `intro` and on many stages it is
the *same sentence*: 3-2's teaser is "ok that was ONE party. one." and the
first thing its intro says out loud is "ok before you say anything: that was
one party."

On the **Continue** card that costs nothing — the job is underway, the intro
has been heard, and the quote is a reminder of the ask you are still in the
middle of. On the **win screen's** card the next job has not started, so the
same line lands before the scene it belongs to and spends the opening joke
early. A joke told twice is a joke told once, and the card was telling it
first.

So the next-job card carries **only the `hook`** — the client making contact,
which is the right and only thing to put in front of a job you have not
started. `fillJobCard()` omits the quote line entirely when there is nothing to
say, so that is an absence rather than a gap.

Worth noticing that this is the second time `teaser` has needed a reader.
It spent thirty-four stages authored, boot-validated and rendered by nothing at
all; the rule that came out of that was "a field in `clients.json` has a
reader, added in the same change". It still does — the Continue card — it is
just no longer this one. **Deleting the last reader of a field is the same
mistake as adding a field with none.**

**Continue reads the save and never loads it.** `peekSave()` parses the run
without installing it — pressing the button is still what does that — so the
card counts items out of the parsed JSON with `itemsLeft()`, which is the same
filter the HUD uses. It is shared rather than copied because "N left" is the one
number the player watches and two definitions of it will drift.

**The button element is reused, not replaced.** `labelContinue()` empties
`#btnContinue`, swaps its classes and fills it with the card's spans, which is
what keeps the click handler bound at module scope. It uses `classList` rather
than `className =` so it cannot wipe the `is-hidden` that `setHidden()` just put
there. A save whose level no longer exists falls back to the plain gold button:
`loadGame()` will discard it, and a card with a face on it is a promise.

**NO ARTICLE MAY GO NEAR A ROOM NAME — OR A CONTAINER OR ITEM NAME.** Room
names supply their own and they disagree: "Kitchen" and "Attic" want *the*,
"The Familiar's Roost" already has one, "Hydroponics" wants none. "You left off
in the {room}" shipped as *"in the the Familiar's Roost"* and *"in the
Hydroponics"* on the same build. The room is named in the card's **footer** now,
uppercased beside the id, where it is a label and nothing implies an article.

The sentence that says "any future sentence that embeds a room name has the
same problem waiting" was right, and `quips` walked straight into it: "The
{container} gives" rendered as **"The The Locked Case gives."** Containers are
exactly as inconsistent — *Fridge* and *Pantry* want an article, *The Actual
Bin* and *The Locked Case* have one, and *Not Bananas*, *Do Not Open*,
*Growing* and *Things We Don't Discuss* take none. Items are worse: they are
Capitalised, because every other reader of `names.json` is a LABEL (the loupe,
the hand bar, `senseSuffix`), so "The Salt goes" is wrong twice over.

Two halves to the fix, and they are for different populations of copy:

- **New copy is checked.** `articleSlips()` in `validate.js` ERRORS on an
  article immediately before `{container}`, `{room}` or `{item}` in `quips` and
  `houseVoice`. A name token belongs in LABEL POSITION — after a dash, a colon
  or a full stop — which is why every misfile line reads "`{item}` goes here —
  `{container}`" rather than a sentence with the names inside it.
- **Old copy is repaired at the point of substitution.** `tokenise()` in
  `util.js` swallows a **doubled** article: "the {container}" with *The Dish
  Rack* renders "the Dish Rack". There are **fifty-nine** such phrases across
  the note copy alone, every one authored, reviewed and shipped, and warning
  about all of them on every boot would teach a reader to skip warnings —
  which costs more than the bug does. So note copy is deliberately NOT checked;
  read the comment on that decision in `validate.js`.

`tokenise()` cannot fix the opposite mistake — "the Hydroponics", where the
name takes no article at all — because nothing there knows which names those
are. Two note lines that were exposed to it (a frat one that could hit *Laundry
Mountain*, a ship one that could hit *Hydroponics*) were rewritten by hand.

**A theme carries an `icon`** (`themes.json`) for exactly one reason: a free-play
save has no client, and the game's own 🏠 over a half-tidied wizard's tower says
nothing about where you were. Campaign saves use the client's emoji and never
read it.

**The win screen leads with the NEXT JOB, and it is a card, not a button.**
It used to offer *Next job* and *Job board* and swap which of them was gold:
same client made *Next job* primary, a new one sent you to the board instead
"so they get their own arrival". The reasoning was sound and the result was not
— a client's arrival on the board is a small greyed tile in a grid of
thirty-four, and the player had to go looking for it. Half the transitions in
the campaign were a menu. Now the next job is always first, always gold, and
big enough to carry the person offering it: face, name, why they are calling,
and one line in their own voice. A card with their face on it is a better
arrival than the board ever gave anybody.

**Two lines, and they must not do the same job.** This is a rule, not a style
note, because the first draft broke it on thirteen levels:

| field | voice | says |
|---|---|---|
| `hook` | **the client, first person, to you** | **the relationship** — how they got hold of you, or what working for you once has changed |
| `teaser` | the client, quoted | **the ask** — what they want this time |

**The hook is in the client's mouth, not the narrator's.** A draft of these was
third person and it was accurate and inert — because the referral is the funniest
thing most of these people have to offer, and reported rather than told it stops
being a joke at all. Compare:

> ✗ Zorb has been telling something about you. Four hundred years in one tower.
> ✓ Your name reached me through the small green thing that has been measuring my
>   tower. Four hundred years I have lived here. Come up, the stairs will hold.

An alien watched you through a window for a month; a parrot got your number out
of a bin and will not be elaborating; a gorilla lifted it off the parrot's desk
while it was on a call; a robot was handed your details by a frat boy and has
spent six weeks failing to parse "unreal at this". None of that survives being
described. Both lines on the card are the client speaking, which is correct —
they are two beats of one speech, the way `intro[]` already is.

**The level TITLE is not on the card**, only its id. The title is a third
headline competing with two lines of the client's voice, and on eleven of the
thirty-four stages it repeats a word the card has already said — the titles were
written from the same beats. "Terms have been agreed." above TERMS AGREED reads
as a bug even though both lines are correct. The id survives because it is what
the board and the gear call this job, and it is the only thing on the card a bug
report can name.

Writing the job into the hook makes the card print the same sentence twice
("Terms have been agreed. Captain would like the facility to look like it." /
"Terms have been agreed."), because the teasers were authored to be the *only*
line. A first stage's hook is a **referral**, and the referrals chain across the
whole cast on purpose: Mom hands you to Marguerite who hands you to Sam; a pizza
box gets you the frat, who get you Unit 7, who give you as a reference to
Dr. Ashworth; Zorb passes your name to Nettle; Boris takes your number off
Captain's desk. That chain is the only thing that makes eleven clients feel like
one world rather than eleven jobs, and it is data.

**`teaser` had been on every stage from the start and nothing had ever rendered
it.** Thirty-four authored lines, token-validated on every boot, reviewed for
voice — and invisible, because the only reader was `soonTile()` asking for a
client-level `teaser` that no client has. Same failure as the two consumables
that set a field nothing read: it did not look broken, it looked like copy
somebody had decided against. If you add a field to `clients.json`, render it in
the same change.

**New vs returning is measured, not inferred.** `stageNo > 1` is wrong the moment
a level is skipped — with *Unlock all jobs* on you can reach a third stage
having met nobody — so the card asks the finished-set whether you have actually
done an earlier job for this client. That also stays honest for a level inserted
behind an existing player's frontier.

**The card is `#winButtons .nextjob`, not `.nextjob`.** `.overlay button` is
(0,1,1) and carries `border-radius:999px`, so a class selector at (0,1,0) loses
it and a 200px-tall card renders as a gold **ellipse**. This is the same trap
the `mk()` comment warns about for `.menubtn`, where it only shows up as corners
slightly rounder than the 14px asked for. Anything block-shaped inside an
overlay has to out-specify that rule.

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

**A say() PRESSED FROM INSIDE THE GEAR IS INVISIBLE.** `#toast` is z-index 95
and `.overlay` is 120, so the message lands *behind the panel you are reading
it from*. This was true of the old "+1 ⭐ (debug)" line from the day it was
written and nobody noticed, because the button also did something visible.

It stopped being survivable with the meta layer, where every debug button
changes something you cannot see from in here: the wallet is on the title
screen, the cast is on the job board, the permanent upgrades only show up in
the next house you start. Pressing "+100 ⭐" mid-run granted the stars, wrote
them to localStorage, and left every number on screen exactly where it was —
reported, reasonably, as "no stars are granted".

So **the gear is its own readout**. `#gearMeta` prints the wallet, how much of
the cast is hired, which permanent upgrades are bought and how many talents the
current house teaches; it is shown with no run at all, unlike `nowPlaying()`.
`syncGear(note)` repaints it, re-labels every debug button, and takes an
optional line saying what the button you just pressed did. Anything pressed in
the gear reports through that, never through `say()`.

The other half of the same rule: **a debug toggle whose label never changes
leaves you guessing which way you left it.** *Hire everybody* and *Max
permanent upgrades* read "All hired ✓" / "Maxed ✓" and disable themselves, the
same discipline *Unlock all jobs* already followed.

**Two debug buttons were quietly broken by the meta layer**, both in ways with
no caller to notice:

- *Free skill point* (`#debugStar`) still called `checkDraftThreshold()`, which
  was deleted with the threshold model — so it threw a `ReferenceError` on
  click. It was also the wrong button: ⭐ used to be what bought a draft, so
  "+1 ⭐" was how you forced one. Money and talents are separate now, so it is
  *Free talent* and grants a **pick**. It closes the gear first, because the
  draft is an `.overlay` too and `drainDrafts()` refuses to open one while
  another is up — without that it would silently do nothing from in here.
- *Pocket money* gave 100 ⭐ against a shop selling about 1,440 ⭐ of stuff,
  which bought one cheap client and looked like nothing had happened. It is 500
  and repeatable.

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

## Free play — a board, not a menu

Free play was nine buttons: four house sizes and one preset per world. You
pressed one, tidied a house, and **the game forgot**. There was no record
anywhere that you had ever played free play at all, so the mode had no shape —
nothing to be partway through and nothing to finish — in the half of the game
people actually live in. The campaign had a board, a frontier, ticks and a
story; free play had a size picker.

It is a board now, and **the grouping is the feature: size, then character,
then five of their houses.** Size first because that is the question a player
arrives with ("how long have I got"); the person second because it is what
makes a row of five tiles read as somebody's five houses rather than five
slots. **215 houses**, every one with a stable id and a tick.

**Nothing is authored.** The whole board is a dozen numbers in `sizes.json`
plus five place names per person in `clients.json`, crossed in
`buildFreeBoard()` (`js/data.js`). That is the only reason 215 houses is a
maintainable amount of content rather than a folder of level files — and it
means retuning the board is editing `items` on five bands, not editing 215
configs.

**A band carries no theme, and that is the point of the restructure.**
`sizes.json` used to conflate *how big* with *where*: "Frat House" was a size,
so there was no way to ask for a big one. Size lives in the band; the world
comes from the person, via an authored `world` on each client. Authored rather
than inferred from their campaign stages, because inferring it gets Zorb wrong
— his first job is a house he has been assigned to, and he is unmistakably the
ship.

**A band authors ITEMS, and everything else is derived per world.** The worlds
are not the same size: the house pool holds 284 distinct types across fourteen
rooms and the dream pool holds 58 across four. A band saying `targetTypes: 240`
would be a house band with the other worlds clamped out of it. A band saying
`items: 1800` is a promise every world can be *measured against*:

```
rooms       = min(band.rooms, rooms in the world)
cap         = themeTypeCap(world, rooms)      ← js/util.js
usable      = floor(cap × typeFill)
rowLen      = clamp(round(items / usable), rowLen.min, rowLen.max)
targetTypes = clamp(round(items / rowLen), 1, usable)
```

and the tile prints `targetTypes × rowLen` — **what the run will actually
hold, never the band's authored target.** `themeTypeCap()` is in `util.js`
rather than inline because three callers need the same answer and any two of
them disagreeing is a bug you find 400 items into a run: `validate.js` polices
the ceiling with it, `data.js` derives every house from it, and `generate.js`
has to deliver what both promised.

**`typeFill` exists because 5 of the first 235 houses came in short.** Asking
for a world's exact ceiling does two bad things. It kills variety — a run
needing every emoji a world has draws every room and every container, so every
run of that world is the same run, which `sizes.json` already said out loud
about the old world presets and then did anyway. And `targetTypes` is a
**quota, not a promise**: `generate()` takes as many types as each container
actually holds, and the trade-up and top-up passes close most of the gap and
not all of it, so a run asked for the ceiling arrives 1–4% under and the tile's
count becomes a small lie about the one number the player watches. At 0.85
every one of the 215 houses generates the exact count on its tile.

**`reach` is why not every character appears under every band.** If a world
cannot deliver 85% of a band's items, that band is not offered for that world
at all — The Dream is four rooms and 58 types, so it does Small and Medium and
is absent from the big ones. Shrinking the job and keeping the label would be
worse: "Mega" has to mean one thing on every row of the grid. The board prints
**how many characters each band has** ("6 people · 0 of 30"), which is what
turns a short row from a missing tile into a fact about that world.

The ceiling is `rowLen.max: 8`, and it is there for a reason that has nothing
to do with this file: `renderContainer()` sizes cells at
`innerWidth × 0.72 / rowLen`, so 10 is a 28px cell on a phone. Raising it would
widen the top bands to more worlds and make the core interaction worse.

**`variation` is what makes house 4 different from house 1.** Five houses that
differed only in their label would make the number five arbitrary, and the
point of five is that finishing them means something. Each array is indexed by
house number, so the first house of a band has no locks and no junk — the one
to learn a world in — and the fifth is the full version. `step` drifts the item
count either side of the band's nominal, so house 3 *is* the band and 1 and 5
are its ends.

**Nothing is locked, and that is not laziness.** The campaign is a story and
has a frontier. Free play is where you go to pick the thing you feel like
doing, and gating it takes away the one thing it is for. `FREE_KEY` holds a set
of finished ids — a record, not a gate — in its own key, deliberately not
folded into `DONE_KEY`: they are two progressions, and "34 of 34" on the job
board must never move because of a free house.

**Free play has a person in it now, and that came almost free.** Every house
belongs to one of the cast, so `speaker()` resolves a client there, and their
`quips`, their note signature and the reply all work without a line of new
copy. Two fields were added: `freeVoice.greet` (they arrive when you start a
house) and `freeVoice.back` (they arrive when you Continue one). `houseVoice`
in `strings.json` is still the fallback and is now reached only by a **legacy
save** — one written before the board, whose `size` preset no longer exists.
Such a save still plays: it keeps its own rooms and items, `freeId` is left
null, and every reader falls back exactly as free play always behaved.

**No quote on the free-play Continue card.** Pressing it makes the client walk
in and say their `freeVoice.back` line, so printing one of the two on the card
showed the same sentence twice in three seconds. The campaign card *can* carry
a quote because its quote is the `teaser` — a different line from the `nudge`
it then speaks. Same component, two different jobs; see the win-screen table
above.

---

## The meta layer — ⭐ is money now

Nothing used to exist past the room in front of you. A level handed out
talents, the win screen took them away again (deliberately — see *talents do
not survive a level*), and ⭐ was lifetime score that could not be spent on
anything at all. **Finishing a house was the entire reward for finishing a
house.**

Two changes, and they are separable on purpose:

### 1. A LEVEL says how many talents it teaches

Drafts used to be granted by crossing lifetime-⭐ thresholds
(`draftSteps: [4,10,18,28,40,55,72]`). That put the reward rate entirely
outside a level's control — how many talents a house handed out fell out of how
many rows it happened to contain — and the first threshold was crossed **on the
last item of 1-2**, which is why every level up to 5-1 carried
`"talents": false`. That flag was a workaround for having no per-level control,
and both it and `draftSteps` are **deleted**, not left dead.

A level authors `rewards: N` and grants a pick on each of its first N **room
completions**. Room completion because it is already the biggest moment the
game has — its own celebration beat, the gold ripple — and because room count
is a level's main size lever, so "mega house, five talents" is close to one per
room.

**`rewards` is capped at rooms − 1**, and boot validation errors on an
over-promise. The last room completing *is* the level completing, so a pick
granted there would land on top of the client's outro and the win screen, which
is the exact pile-up `celebrate()` exists to prevent. An over-promise is
otherwise silent: the extra pick is simply never handed out.

Free-play bands author `rewards` too. Free play keeps its picks and **mints no
⭐ at all** — see the reasoning in `sizes.json`: it is 215 houses, and paying
currency there would put an unbounded farm next to the campaign's pacing. Free
play gives you a good afternoon; the campaign gives you money.

### 2. ⭐ is a wallet, spent at Home

`js/home.js` owns three keys and a screen. It is a **leaf** on purpose: buying
a client unlocks them, it does not play them, so nothing here imports a render
tier and nothing here can make a cycle. `main.js` reads `homeLevel()` /
`castHas()` and applies them, and hands two callbacks in through `initHome()` —
the same shape as `initTalents()`.

**The Home button is on the title screen at 0 ⭐ and always has to be.** It
shipped hidden until you had a star to spend, borrowing the lesson from the old
in-level talent shop ("⭐ 0 over an all-unaffordable list"). That was the wrong
lesson: THAT button sat in the HUD during play and taught people to ignore
something they looked at forty times a level. This one is the entrance to half
the progression, and hiding it means a new player has no way to learn the meta
layer exists — which is exactly what happened the first time somebody opened
the build. At zero stars the screen still says there is a currency, what it
buys, and that nine of the eleven people in this game have to be hired. That is
a reason to play, not a dead end.

| key | holds |
|---|---|
| `STARS_KEY` | the balance, which **goes down** |
| `HOME_KEY` | `{id: level}` for the permanent upgrades |
| `CAST_KEY` | the client ids you have taken on |

**This reverses a deliberate decision.** `upgrades.json` used to carry a
`costs[]` array that was deleted on the grounds that "⭐ is score and is never
spent", and its readme argued the point. Prices are read now. The readme argues
the other way. Do not delete them again.

`stars` and `starsEarnedEver` are two numbers because **one of them has to be
able to go down and the other must not** — a lifetime total that decreases is
not a lifetime total. Stars bank **as they land**, not at the win screen, so
quitting half way through a house for a phone call keeps what you earned.

**The split between the two catalogues is the design.** `upgrades[]` is in-level
talents, `home[]` is permanent, and the line is: *a talent changes what you
KNOW about the house in front of you; a home upgrade changes how you PLAY.*
Only the second is safe to keep. Sixth Sense permanently would gut the taxonomy
the whole game is about — and 4-2 was already being played with it in hand back
when talents did carry over, which is why they stopped.

`hands` moved to `home[]`, which dropped the in-level pool to four talents and
seven picks — not enough for a five-pick house with `draftCards: 3`. So three
were written to refill it, all of them information or friction inside one run:
**Keyring** (loose tokens in *this* room ring — the same `.reveal` look the
debug button uses, permanent but only where you are, because burial is the
feature), **Label Maker** (furniture shows what it is still waiting for, greyed,
after what is already in it — the furniture's half of what Sixth Sense tells you
about the item), and **Skeleton Key** (every lock still shut wants one key
fewer, floored at one, applied the moment it is learned — the one talent that
acts on the world rather than changing a rule, so it reaches the rules tier
through `initTalents({skeleton})`).

`HOME_IDS` gets the same both-directions boot check as `TALENT_IDS`, and it
matters more: an unimplemented talent draws a card that does nothing, and an
unimplemented home upgrade does nothing **and takes the player's money**. An id
may not be in both lists — `G.up` and `HOME_KEY` are separate records, so the
same id in both is two different levels under one name.

### The cast is bought, and the board had to become dynamic

The campaign is no longer all there at the start. You get Mom and Marguerite
(`cost: 0` — data, not a hardcoded pair) and everybody else is a one-off
purchase priced by narrative distance. Two players twenty levels in can have
completely different casts, so **the board cannot promise "the one after next"
any more.**

`progress()` gained a second gate: `frontier` is how far you have got, `hired`
is whether you have anybody for this job. Everything downstream reads `hired`
rather than working it out — same discipline the debug unlock override already
follows, and *Unlock all jobs* unlocks the cast too, or the button that exists
to let you look at any level would open a board of silhouettes.

**`stageState` has five states now.** `unhired` is the new one, and it is not
`locked`: locked means *not yet*, unhired means *go and buy them*. A tile that
cannot tell you which is unhelpful, so unhired keeps a full-strength silhouette
and shows a **price** where the level id would be.

**Face rationing moved.** The old rule was "one job ahead is greyed, the rest
are silhouettes", which only works when everybody knows what comes next. Now
anyone you have **hired** shows their face wherever their jobs are, and anyone
you have not is a silhouette with a price — because the tease moved to the shop,
where a face *is* the price tag. "??? — 90 ⭐" is not an offer.

**A new hire jumps the queue, once.** Buying somebody should hand you that
person, so `now` points at their first stage. Getting the bookkeeping right took
three attempts and the wrong two are worth knowing:

- *Consume inside `progress()`* — whichever of its four callers ran first ate
  the pointer, so the board (the one screen that needs it) pointed at whatever
  was next by level order.
- *Consume when the board renders* — the promise lasted one glance. Close the
  board, reopen it, and the person you had just paid for was no longer next.
- **Clear it when it is HONOURED** — when their first stage is done. Idempotent,
  so every `progress()` agrees and none of them has to be the one that spends
  it. Their *first* stage, not their next unplayed one: "the very next job" is
  singular, and hijacking `now` for a whole three-stage arc is a much bigger
  promise than was made.

### The referral chain pays instead of blocking

Every first-stage hook is a referral, and the chain is the only thing that makes
eleven clients feel like one world: Mom → Marguerite → Sam; a pizza box → the
frat → Unit 7 → Dr. Ashworth; Zorb → Nettle; Captain → Boris. In a shop where
anything is buyable in any order, nothing stops you starting with the gorilla —
and then Nettle's opening line (*"Your name reached me through the small green
thing that has been measuring my tower"*) names somebody you have never met.

Gating purchases on the chain was the other option and it was rejected: a shop
that hides most of itself is a worse shop. So **following the chain is cheaper**
(`needs` + a 40% referral discount, stacking with Business Cards) and a client
bought cold gets a different opening: **`hookCold`**.

Two rules keep that honest, both boot-checked. A client whose `needs` points at
somebody **buyable** must have a `hookCold` — otherwise their line can arrive
before the person it names. A client whose referrer is part of the free opening
must **not** have one, because it could never be shown and would be dead copy.
And the swap only ever applies to a **first** stage: a later hook is about what
working for you once has changed, which needs no referrer.

### Prices, and where the levers are

First pass, tuned against the campaign only (free play pays nothing). Roughly
1 ⭐ per completed row plus whatever Good Name adds per room, so a first run
through the campaign lands in the low four figures — enough to unlock most of
the cast *or* max two or three upgrades, not both. **Choosing is the point;
replaying campaign levels is the way out of a corner.**

The chicken-and-egg is deliberate and is what makes the opening a ramp: you
cannot earn a client's stars without buying them first, so Mom and Marguerite's
four small jobs fund The Dream (15) or the frat (20), which fund the next one.

Levers, cheapest to reach for first: `cost` on a client; `cost` on a home
upgrade (an array prices each level separately); `params.each` on Good Name;
`REFERRED_OFF` in `home.js`; `rewards` on a level if the problem is talents
rather than money.

---

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
- Finish a campaign level: the **next job card is the first thing** under the
  stats, gold, with the next client's face, a hook that is about *them* and a
  quoted teaser that is about *the job* — never the same sentence twice. Pressing
  it starts that level. The chip reads "New client" only when you have genuinely
  never worked for them. The last level (9-3) has no card and *Job board* goes
  back to being primary. Free play gets no card at all.
- **Read the hook out loud in the client's voice.** Every one is first person and
  addressed to the player; a hook that describes them from outside has drifted
  back to narration and should be rewritten before it ships. Mom is warm and
  brisk, the frat types in lower case, Zorb uses no contractions, Nettle explains
  nothing twice, Captain says "facility", Boris keeps it to short sentences,
  Unit 7 is precise, Sam is tired, Dr. Ashworth deflects, and the Dream never
  jokes on purpose.
- The card on a phone: the whole win screen still fits without scrolling, and the
  card is a rounded rectangle rather than an oval (see the specificity note).
- **Continue names who you left standing there.** Save mid-job, quit to the title:
  the button is the same card, with that client's face, the count still on the
  floor matching the HUD exactly, their line, and the room in the footer. Press it
  and the run comes back with the same count. Do it again from a free-play run —
  the world's own icon, the preset name, no quote. Then corrupt the save's
  `levelId` and confirm it degrades to the plain gold button rather than promising
  a job that isn't there.
- No sentence anywhere prints "the the". Room, container and item names all
  carry their own articles — `tokenise()` eats a doubled one and `validate.js`
  errors on a fresh one in quip copy, so this is a spot-check of the third
  case: a name that takes NO article ("Hydroponics", "Laundry Mountain", "Not
  Bananas") behind a written "the". Play a ship and a frat level to their notes.
- **The client speaks, and nothing steps on anything.** Open a locked door, a
  coin box and a locked container; finish a room; finish a note; misfile
  something whose home is in the room you're in. Six bubbles, six different
  lines, one at a time, bottom-left, and never one of them under the client's
  own figure. Then finish the LAST room of a job and watch the whole tail: the
  room's gold, one bubble, the bubble gone, the client walking in, the win
  screen. `tidy.chatterState()` answers "what is showing and what is queued"
  when two lines look like they collided. `tidy.aside('room',{room:'Kitchen'})`
  fires one on demand, which is the only way to check a client's quips without
  playing to the moment.
- **Misfiling teaches once, and only about this room.** Put something in the
  wrong container when its real home is in the same room: the client names the
  right one. Do it again with the same emoji: silence. Save, Continue, do it a
  third time: still silence (`taught` is written now). Then misfile something
  whose home is in ANOTHER room: silence the first time too — that would be a
  spoiler and a walk.
- **Continue names the stakes.** Start a campaign level, quit to the menu,
  press Continue: the client walks in with their `nudge`, and the level id
  lands as they leave. Do it from free play: no figure, one quiet house line.
- **No room has two pieces of furniture with the same skin.** Boot warns, so a
  clean console covers `rooms.json` — but eyeball the Bathroom, the frat
  kitchen and Hydroponics specifically, because those are the three that
  shipped with a sink drawn as a fridge. Judge new skins in a GRID of all of
  them at once, never one at a time.
- **The size swing.** Every client's arc grows across its stages, and no two
  consecutive jobs past 5-1 are within a fifth of each other — boot warns about
  both, so a clean console is the test. Confirm against what the generator
  actually builds, not against `rooms × cont × types × rowLen`: generate every
  level 20 times and compare the item count to `jobSize()`.
- **Furniture never sits on furniture.** Walk every room of every level, ten
  draws each, and compare the container slot boxes: a round or hex room takes
  four, a rect room six. Then check free play too — its container count comes
  from a type quota, not from `cont` — and that every preset still delivers
  `targetTypes × rowLen` after the cap.
- The size label fits: the card footer stays on ONE line on a 390px phone with
  the level id already on it, and a board tile's id line does not clip. A client
  you have not met shows no size mark.
- A room whose item count changed also had its `scale` recomputed — screenshot
  it. The failure is visual and silent: the same numbers in a room too small
  read as an unsortable heap.
- **The free-play board.** Open it: five band headings, character rows under
  each, five tiles per row, and the scroll lands on the first house you have
  not done rather than at the top. Finish one and confirm the tick, the row's
  "3 / 5", the band's count and the "N of 215" all move. The win screen should
  offer the next unfinished house **by the same person** before it offers
  anybody else — five of somebody's houses is the set the board is about.
- **Every house is buildable.** `tidy.freeJobs()` is the derived list; generate
  each one and compare the item count to the tile's. It should match EXACTLY —
  if any come in short, `typeFill` is too high, not too low. Boot also logs the
  house count, so a retune that quietly halves free play says so.
- **A legacy free-play save still loads.** Write a save with an old preset id
  (`size: "mega"`, no `freeId`) and press Continue: it resumes, the card wears
  the world's icon instead of a face, and the gear's "New house" does not throw.
  That is the one path `houseVoice` in `strings.json` still exists for.
- **A level teaches what it says it does.** `rewards: N` grants a pick on each
  of the first N room completions and never on the last one. `tidy.roomFinished()`
  fires a grant by hand; call it more times than the level allows and the extra
  ones must do nothing. The draft subtitle counts "Talent 2 of 4", so a wrong
  cap is visible without instrumenting anything.
- **⭐ banks as it lands, and only in the campaign.** File one complete row: the
  wallet goes up by one, immediately, before any win screen. Do the same in free
  play and it must not move at all. Then quit mid-house and confirm the money
  is still there — banking at the win screen was the thing this avoids.
- **The three new talents actually do something.** Skeleton Key drops every
  `lock.need > 1` by one and leaves the single-key locks alone; Label Maker adds
  exactly `params.show + level - 1` greyed badges per container; Keyring rings
  the tokens in the room you are standing in and **only** that room. All three
  are checkable in one line each off `tidy.G`.
- **Home upgrades survive a resume without duplicating.** Buy Bigger Hands and
  Spare Set, start a house, save, Continue: the hand count must match what you
  paid for and there must be exactly **one** spare key. Re-granting the one-shot
  on every resume is the same shape as the talent draft that re-owed itself.
- **The board is honest about who you have.** With a partial cast: hired clients
  show faces and level ids, unhired show a silhouette and a price, and no
  unhired tile is clickable. Buy somebody and confirm their first job becomes
  `now` — then close and reopen the board (it must still be `now`), then play it
  (it must stop being `now`).
- **A cold client's opening does not name a stranger.** Buy Nettle without Zorb
  and read the next-job card: it must be the `hookCold`. Buy Zorb too and it
  must switch to the warm one. Check a *second* stage never swaps.
- **`initHome()` and `initTalents()` are actually CALLED.** Both are imported
  into main.js and both hand callbacks to a leaf module, so forgetting the call
  is silent in a way that is hard to see: the module loads, its exports work,
  and only the callbacks are dead. It shipped that way once — the wallet never
  refreshed the title screen's Home button, Back from Home left the screen
  stale, and Skeleton Key drew a card and did nothing, which is the exact
  failure mode `upgrades.json` carries two war stories about. Cheapest check:
  buy something and watch the title button's ⭐ change without reopening the
  screen, and draft Skeleton Key and watch a `lock.need` drop.
- Console clean throughout.

---

## Original

`ref/tidy-house-v3.html` is the 2,495-line single-file build this came from,
kept verbatim for comparison.
