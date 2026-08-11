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
| which emoji go in which container | `data/rooms.json` |
| how many rooms / items / locks a run has | `data/sizes.json`, `data/levels.json` |
| row length (how many of each item exist) | `rowLen` in either of the above |
| hint text, and when hints appear | `tips` in `data/levels.json` |
| what a talent costs and how many levels it has | `data/upgrades.json` |
| when talent drafts happen | `draftSteps` in `data/upgrades.json` |
| item names in the loupe | `data/names.json` |
| room shapes, which rooms a theme uses | `data/themes.json` |
| furniture size, anchors, keep-out padding, key/coin emoji | `data/furniture.json` |
| the note each room leaves you, and its reply | `data/quests.json` |
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

**Tips are `kind` / `target` / `when` / `until`.** `when` makes a tip appear in
response to an event; `until` dismisses it. A tip is only marked learned if it
was the active one *and* actually rendered.

---

## Saves

| Key | Holds |
|---|---|
| `tidy-adventures-v4` | the current run |
| `tidy-campaign-unlocked` | how far the campaign has been unlocked |
| `tidy-campaign-talents` | talents that carry between campaign levels |
| `tidy-audio` | volume and mute |

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
  hand slots carry into the next campaign level.
- Finish a container → a note drops → picking it up pins an objective →
  completing it pays out and replies.
- Save → reload → Continue restores the run mid-play.
- Console clean throughout.

---

## Original

`ref/tidy-house-v3.html` is the 2,495-line single-file build this came from,
kept verbatim for comparison.
