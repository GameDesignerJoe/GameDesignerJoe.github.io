# Catch the Wolf — design & systems

A ground-up remake of the GameMaker:Studio game in `../catchTheWolf/` (kept
untouched as the reference). Plain ES modules, no build step; open
`catch-the-wolf/` from any static server.

## The game in one breath

A flock of identical sheep. One is a wolf in disguise, and its costume slips in
exactly one wolfish way: a pointy ear, a bushy tail, yellow eyes. Tap it: the
wool bursts off, the wolf bolts, and you get its pelt. Pelts buy sheep for your
farm, where they graze, nap and have zoomies. Tap a real sheep and your streak
(and with it the difficulty) resets.

## What changed from the original, and why

| Original | Remake | Why |
|---|---|---|
| Wolf differs by a random body part (colour, eye style, ear droop) | Every tell is *wolfish* (`data/tells.json`) | Thematic: you learn to look for wolf bits, and each reveal explains itself ("Yellow wolf eyes!") |
| Wrong tap wipes all pelts | Kept, deliberately: **press your luck**. Pelts you hold are "at risk" (HUD badge) until spent in the shop | Joe's call. The shop is the bank, which gives every round a risk. `mistake.mode: "streak"` switches to a gentler 1-pelt penalty |
| 1 pelt per wolf at every tier | Pelts per wolf rise with the tier (1 → 4) | Gives a reason to climb, and shortens the shop grind |
| Leaving mid-round dealt a new flock | The round in progress is saved and restored | No free rerolls of a hard flock |
| Trash can on the farm, no refund | Drag a sheep to the farm gate to let it go, for half its price back | A full farm is never a dead end for pelts |
| Pelts not saved (bug), farm cap counted per session (bug) | Everything persists in one versioned save | — |
| Fixed 320×480 canvas | Responsive canvas + DOM UI, any phone/desktop, DPR-sharp | — |
| Silent | Synthesised baa/poof/howl/coin (WebAudio, no files) | — |
| Unused "skip" button | **Sniff**: each use sends half the flock away (never the wolf), down to 2. 1 pelt per sniff, 2 at the top tiers | Spend pelts to buy certainty, or keep them and risk it |
| Farm sheep shuffle | Plus **farm goodies** (`data/items.json`). Food from the pantry tray brings sheep running to eat it. Toys get run into by a sheep and roll, bounce off the fence and pond, and can be flicked or thrown | Something to do with pelts beyond buying sheep |
| Wrong tap: a text screen | The wolf is ringed in red, then unmasks, and the panel names its tell | A miss teaches you what to look for |
| Mouse only | Tap, plus keyboard play (arrows + Enter), Escape closes dialogs, colour-friendly tells option, reduced motion | — |
| Farm sheep shuffle in place | Behaviour states: graze, walk, run, lie down, sleep; tap to pet (hearts + name), drag to move | Matches the animation list in the reference sheep pack |
| Static sheep in a grid | The flock wanders the pen: stands, grazes, ambles, faces any direction. `activity` per tier controls how restless it is. It never lies down or sleeps in a level (that would hide paws or eyes) | Moving targets, and the field feels alive |
| Every sheep in a round identical | Up to 4 breeds share the field (`mixedBreeds`). Tells are wolf parts, so variety doesn't muddy the search | More to look at, harder at the top tiers |
| Body-colour difference | **Colour wolves**: the fake fleece is shifted toward a wrong hue, in four strengths (strong → faint), scaled to read equally on every wool. A colour wolf is never allowed to land near any breed's real colour | Colour as a skill that ramps with the tier |

## Systems map

```
index.html ─ css/style.css            DOM UI layer (buttons, HUD, panels)
js/main.js                            boot, loop, scene switch, input routing
js/engine/
  sprites.js    sprite cache + art override manifest (data/sprites.json)
  storage.js    versioned save (localStorage) with migrate()
  audio.js      synthesised sfx; swap any recipe for a sample later
  particles.js  wool puffs, hearts, sparkles, z's
  util.js       easing, random, Timers
js/art/          procedural painters (no state)
  draw.js       ink-outline helpers, cloud() fluff generator, RNG
  palette.js    every colour (wool/face/horn/hoof/wolf/eye)
  sheep.js      sheep layers: legs, tail, body, head, eyes + tell variants
  wolf.js       the unmasked wolf
  ground.js     meadow, dirt with grass fringe, trees, fences, pond, hay…
  icons.js      pelt, heart, data-URL icons for the DOM
  props.js      farm goodies: clover, hay pile, red ball, beach ball
  render.js     composes cached layers into an animated sheep/wolf + hit test
js/game/
  rules.js      pure rules: round generation, tiers, outcomes, shop
  critter.js    Sheep entity: pose animation, fidgets, one brain with
                profiles (farm / field), food seeking, toy chasing,
                two-circle rotated collision
  world.js      paddock bounds the brain moves within
js/scenes/       title, play, shop, farm, settings (+ backdrop.js, ui.js)
data/            game.json, tells.json, breeds.json, items.json, sprites.json
tools/shoot.mjs  headless-Chrome driver: tap/eval/screenshot for testing
```

### Look → layers → sprites

A sheep is a plain `look` object:

```js
{ wool: 'cream', face: 'dark', horns: 'curl', ears: 'droop', eyes: 'sleepy',
  tuft: false, size: 1, wolfFur: 'grey', tells: { earL: 'wolf' } }
```

`render.js` splits it into five layers (legs, tail, body, head, eyes). Each
layer is painted once per pixel scale by `sheep.js` and cached by
`sprites.js`. Animation (trot, head turn, blink, tail wag, lie down) is just
transforms on those cached layers, so twenty animated sheep cost about a
hundred `drawImage` calls a frame.

## How to extend

**New wolf tell.** Add an entry to `data/tells.json` with an `id`, a
`subtlety` (1–5), the `label` shown on reveal, and the `tells` keys it
sets. If it needs new art, draw it in the relevant `sheep.js` painter behind
`look.tells.<key>`. That's all: tell keys are folded into the sprite cache ids
automatically.
- Use `notWith` when a breed would hide the tell (for example, horns cover the ears).
- Give variants of one idea a shared `group` so they're picked as one; the three fur-patch spots work this way.
- Mark `colorOnly` if the tell is only a colour shift.

Check the mix with the tell-distribution step in `tools/steps-regress.json`.

**New breed.** Add an entry to `data/breeds.json`. Set `price` to sell it in
the shop and `inRounds` to make it a possible flock. New colours go in
`palette.js → WOOL`.

**Rebalance.** Everything lives in `data/game.json`: tiers (streak
threshold, flock size, tell subtlety band, fidgets, mixed breeds), hint cost,
mistake rule, farm cap, and when the shop prompt fires.

**Replace procedural art with hand-drawn art.** Overrides work per layer today.
That suits props, the wolf and the pelt. A sheep head layer, though, bakes in
its ears, horns and muzzle, so an artist would have to supply one image per
combination. If hand-drawn sheep become the plan, split the head painter into
part layers first (ear, horn, muzzle). The current approach is: Run `listSpriteIds()` in the
browser console to see the ids in use (for example `sheep/body/cream/7` or
`wolf/grey/up/0`). Map an id to an image in `data/sprites.json`. The image
is scaled into that sprite's bounds: the `BOX`/`HEAD_BOX`/`TAIL_BOX`/`WOLF_BOX`
constants in `sheep.js` and `render.js`, in units where the sheep's body is
about 62 wide. Export at about 4× units for crisp phones.

**New food or toy.** Add an entry to `data/items.json` and a painter to
`props.js → ITEM_PAINTERS`. Food sets `seats` (how many eat at once), `amount`
(sheep-seconds of eating) and `attract` (reach; 0 means the whole farm). Toys
set `r`, `bounce` and `friction`.

**New sound.** Add a recipe to `audio.js → sfx`. To use a recorded file
instead, decode it into a buffer once and play it from the same function.

**New scene.** Create `js/scenes/x.js` exporting
`{ enter, exit, resize, update, draw, pointer }` and register it in
`main.js → SCENES`. `#x` in the URL deep-links to it.

**Save shape change.** Bump `VERSION` in `storage.js` and add a step to
`migrate()`.

## Testing

```bash
# from the repo root
node catch-the-wolf/tools/shoot.mjs --path catch-the-wolf/gallery.html --w 1000 --h 1300 --out catch-the-wolf/tools/shots/gallery.png
node catch-the-wolf/tools/shoot.mjs --path "catch-the-wolf/gallery.html?wolf" --w 1000 --h 950 --out catch-the-wolf/tools/shots/wolf.png
node catch-the-wolf/tools/shoot.mjs --path catch-the-wolf/ --w 360 --h 640 --dpr 2 --steps catch-the-wolf/tools/steps-regress.json
```

`steps-regress.json` is the regression suite. Each check prints `"ok": true`
or false. It covers:
- catch reward and miss penalty
- round persistence
- wolf-tail hit area
- tell mix per tier
- full-shop banner
- gate release, with a second finger ignored
- sheep scale on a small phone

`gallery.html` renders every sheep variant, tell, wolf and prop on one page.
It's the art review sheet. `window.ctw` exposes the app in the console:
`ctw.save.data.streak = 18; ctw.go('play')` jumps to the hardest tier.

## Ideas parked for later

- **Rule rounds** at high tiers: the flock is deliberately varied and the
  wolf is "the only one with X". The data model already supports mixed flocks.
- **Daily flock**: a seeded round that's the same for everyone, with
  shareable results.
- **Per-part art overrides** (see above) if a hand-drawn sheep set is commissioned.
- **Self-hosted fonts.** The Google Fonts link is the only network dependency.
- **Farm upgrades** bought with pelts: a bigger paddock, a barn, hats for
  sheep (a hat is just another head-layer key).
- **Wolf collection**: a bestiary of every tell you've caught.
