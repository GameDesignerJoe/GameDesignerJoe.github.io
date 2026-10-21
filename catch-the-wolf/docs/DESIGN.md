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
| Same field every round | **A year of seasons** (`data/world.json`). Each season runs dawn → noon → day → sunset → night → midnight, three times, and each time of day lasts 3 wolves (`roundsPerTime`) with its weather held steady, so a day is 18 wolves and a season 54. Then spring → summer → fall → winter, with the terrain repainted (flowers, dry grass, fallen leaves, snow and a frozen pond). Light follows the time of day, and weather (wind, rain, fog, snow) gets rougher by set and season. Tied to the streak, so a miss sends you back to spring dawn | Environmental difficulty on top of flock size |
| — | **Wolf Stampede** every 12 catches (`bonusEvery`): an empty pen, unmasked wolves dashing about, 15 s to tap as many as you can (+1 pelt each). The one place a timer shows | A fast, silly change-up |
| 1 pelt per catch | Plus a **hidden speed bonus**: ×3 / ×2 / ×1 pelts by how fast you found the wolf (`quick` per tier, more time at harder tiers). Never shown as a timer, only as praise ("Lightning fast!") | Rewards sharp eyes without a stressful clock |
| Wrong tap: a text screen | The miss panel shows a picture: a real sheep beside the wolf in the same costume, with the slip circled | Shows the tell instead of naming it |
| — | **Hungry wolf**: one round in every day (a set of six times) the wolf is hungry. The round is announced ("Hungry wolf!", 🍖 in the HUD). After a 5 s grace period the wolf stalks a sheep, and 5 s of mouth-on-wool eats it for −1 pelt. The nibbling is silent and the victim just fades, so nothing gives the wolf away. Which slot (noon, day, sunset or night, never dawn or midnight) is picked per day from a seed that changes after every mistake, so it can't be learned. Tuning in `game.json → hungryWolf` | Fun as a special mode; always on, it broke the core search. It used to be a Settings toggle |
| — | **Achievements** (`data/achievements.json`, `js/game/achievements.js`): streaks of 10/25/50/100, 10/20/30 wolves in one Stampede, 10 full-speed catches, one of every shop sheep, 12 and 24 of the priciest breed on the farm, and 10/25/50/100 catches of each kind of tell (eyes, ears, tail, snout, paws, fur, fangs, scowl, nose, fake wool). A toast pops when one unlocks; the full list with progress bars is on the title screen and in Settings | Celebrates the things we want players to do, and teaches the tell families |
| — | **Midnight**: the last slot of each day is pitch dark. Your finger or cursor is a torch that lights a circle as you drag it; only a quick, still tap catches, so searching never picks a sheep by accident. On touch screens the beam is bigger (`touchRadius`) and lifted above the fingertip (`touchLift`) so the finger doesn't cover it. The hidden speed window stretches (`quickTime`) | A different way to look |
| Static farm | **Farm day/night**: a 4-minute day keyed to the clock (`js/game/daycycle.js`) with sunset, night and dawn light. At night the sheep mostly sleep and fireflies come out | The farm feels alive between hunts |
| Props near the fence trapped sheep | Every solid farm prop keeps a sheep-wide lane to the fence and to its neighbours, and sheep steer round props instead of pushing into them | No stuck sheep |
| Mouse only | Tap, plus keyboard play (arrows + Enter), Escape closes dialogs, colour-friendly tells option, reduced motion | — |
| Farm sheep shuffle in place | Behaviour states: graze, walk, run, lie down, sleep; tap to pet (hearts + name), drag to move | Matches the animation list in the reference sheep pack |
| — | **Farm fixtures and bedtime**: sheep wander over to drink at the pond and trough (little splashes) and nibble the hay bales. At night grown-ups huddle up by the shade tree and next to each other to sleep; lambs would rather stay up playing ball | The farm uses what's already on it |
| — | **Grudges**: a rolling toy that hits a sleeping sheep wakes it up angry (steam, anger marks, a banner naming who did it). For 10 s it charges and rams the sheep that last kicked the toy while that one flees, and anyone awake nearby scatters. If you threw it, the sheep takes it out on the toy. A pat calms it down | Night-time lambs + balls + sleepers = chaos you can cause |
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
  atmosphere.js time-of-day light and weather over the play field
  util.js       easing, random, Timers
js/art/          procedural painters (no state)
  draw.js       ink-outline helpers, cloud() fluff generator, RNG
  palette.js    every colour (wool/face/horn/hoof/wolf/eye)
  sheep.js      sheep layers: legs, tail, body, head, eyes + tell variants
  wolf.js       the unmasked wolf
  ground.js     meadow, dirt with grass fringe, trees, fences, pond, hay…
  icons.js      pelt, heart, data-URL icons for the DOM
  props.js      farm goodies: clover, hay pile, red ball, beach ball
  tellcard.js   the "here's what you missed" sheep-vs-wolf picture
  render.js     composes cached layers into an animated sheep/wolf + hit test
js/game/
  rules.js      pure rules: round generation, tiers, outcomes, shop
  critter.js    Sheep entity: pose animation, fidgets, one brain with
                profiles (farm / field), food seeking, toy chasing,
                fixtures, bedtime huddles, grudges (angry / flee),
                two-circle rotated collision
  achievements.js  achievement list (from data), stats, unlock checks
  world.js      paddock bounds the brain moves within
js/scenes/       title, play, bonus (Wolf Stampede), shop, farm, settings (+ backdrop.js, ui.js)
data/            game.json, tells.json, breeds.json, items.json, world.json, achievements.json, sprites.json
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

- Give it a `kind` (eyes, ears, tail, …) so it counts toward that family's achievements; a new kind also needs an entry in `data/achievements.json → tellKinds`.

Check the mix with the tell-distribution step in `tools/steps-regress.json`.

**New achievement.** Add a family to `data/achievements.json` with a `stat`, `goals`, `titles` and a `desc`. If the stat is new, add one line for it to `stats()` in `js/game/achievements.js` (and record it in the save if it can't be worked out from what's already there).

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
node catch-the-wolf/tools/shoot.mjs --path catch-the-wolf/ --w 400 --h 760 --dpr 2 --steps catch-the-wolf/tools/steps-notes.json
```

On Linux, point it at a Chromium with `CHROME=/path/to/chrome`.
`steps-notes.json` covers the hungry-wolf day slot, save migration, achievements,
farm fixtures, the bedtime huddle, and grudges.

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

### Home-screen icon

`tools/icon.html` paints the app icon from the game's own art: a close-up of a
friendly sheep's face, turned so the eyes sit above the nose. After an art change,
regenerate the PNGs that `index.html` and `manifest.json` point to:

```bash
for a in "180 apple-touch-icon" "192 icon-192" "512 icon-512" "512&maskable icon-maskable-512"; do
  set -- $a; s=${1%%&*}
  node catch-the-wolf/tools/shoot.mjs --path "catch-the-wolf/tools/icon.html?size=$1" --w $s --h $s --dpr 1 --out catch-the-wolf/assets/$2.png
done
```

iOS only uses `apple-touch-icon` (it ignores SVG), and caches it, so delete
and re-add the home-screen shortcut to see a new one.

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
