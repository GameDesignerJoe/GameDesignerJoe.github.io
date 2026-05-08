# CLAUDE.md — kill.code Implementation Guide

A concise reference for building features. Reads top-to-bottom: what the system is, how it's wired, how to add things, and the rules that keep it from re-bloating.

## Project Overview

**kill.code** is a Mastermind-with-cards hacker game. The player breaches a 4-key hash inside a five-cycle window, deploying programs (cards) to gain intel. The codebase is vanilla ES modules — no build, no npm, no bundler. A local HTTP server is required (ES modules don't work over `file://`).

**Run locally**: `python -m http.server 8000` from the project root → http://localhost:8000/killcode/

## Tech Stack

- Vanilla JavaScript (ES2020+, native modules)
- HTML + CSS (no canvas; all UI is DOM)
- Web Audio API for SFX, HTMLAudio + playlist for BGM
- localStorage for stats and audio prefs
- No external dependencies

## File Structure

```
killcode/
├── index.html                     ← shell; loads css/style.css and js/main.js as a module
├── css/
│   └── style.css                  ← all styles
├── audio/                         ← BGM mp3s + playlist.json
├── js/
│   ├── main.js                    ← entry point — wires modules and boots
│   ├── config.js                  ← constants only (K, DECK_SRC, PITCH, STORAGE_KEYS, SECRET_LEN, MAX_ROWS_DEFAULT)
│   ├── state.js                   ← single shared mutable `state` + `resetState()`
│   ├── rng.js                     ← shuffle, pick, randInt
│   ├── util.js                    ← toRoman, etc.
│   ├── bus.js                     ← pub/sub event bus (on/off/emit)
│   ├── effects.js                 ← `fx` API — the only surface for state mutation outside engine
│   ├── phases.js                  ← declarative phase machine + enterPhase()
│   ├── engine.js                  ← rules: newGame, startTurn, deployCard, multi-step runner, submitGuess, etc.
│   ├── audio.js                   ← SFX/BGM; subscribes to bus events
│   ├── settings.js                ← settings overlay + audio toggles
│   ├── stats.js                   ← localStorage-backed stats; subscribes to game.won/game.lost
│   ├── cards/
│   │   ├── _registry.js           ← CARDS map; the ONE manifest for cards
│   │   ├── mole.js, ghost.js, ping.js, probe.js, buffer.js, root.js
│   ├── render/
│   │   ├── index.js               ← renderAll() + wireRenderToBus()
│   │   ├── events.js              ← ONE delegated click listener; data-action dispatch
│   │   ├── paint.js               ← paintPeg, fbHtml, catColor (DOM helpers)
│   │   ├── viewport.js            ← fitToViewport + title-glitch
│   │   ├── hand.js, board.js, phase.js, descBar.js, secret.js, intel.js
│   └── narrative/
│       ├── index.js               ← initNarrative() — queue + drain scenes
│       ├── presenter.js           ← dialogue overlay + scene.effects on dismiss
│       ├── portraits.js           ← character lookup
│       └── scenes/
│           ├── _registry.js       ← SCENES array; the ONE manifest for scenes
│           ├── intro.js           ← (disabled by default)
│           └── rival-lock.js      ← (disabled by default)
└── docs/
    └── CLAUDE.md                  ← this file
```

## Dependency Graph (one-way; no cycles)

```
config.js, rng.js, util.js, state.js, bus.js   ← no game-layer imports
phases.js                                       ← state, bus
effects.js                                      ← state, bus, config
cards/*.js                                      ← config, rng (read state, mutate via fx)
cards/_registry.js                              ← cards/*
engine.js                                       ← state, config, rng, bus, effects, phases, cards/_registry
audio.js                                        ← config, bus  (subscribes to bus events)
stats.js                                        ← config, bus  (subscribes to game.won/lost)
settings.js                                     ← audio, stats
render/paint.js                                 ← config
render/viewport.js                              ← (no module imports)
render/intel.js                                 ← bus
render/{hand,board,phase,descBar,secret}.js     ← config, util, render/paint, cards/_registry
render/events.js                                ← engine, settings, render/viewport
render/index.js                                 ← state, bus, render/*
narrative/portraits.js                          ← (no imports)
narrative/scenes/*.js                           ← rng (read state, mutate via fx)
narrative/scenes/_registry.js                   ← scenes/*
narrative/presenter.js                          ← state, effects, phases, narrative/portraits
narrative/index.js                              ← state, bus, narrative/scenes/_registry, narrative/presenter
main.js                                         ← entry point — imports everything
```

**Rule:** the dependency arrow always points the same direction. Engine never imports render, audio, settings, stats, or narrative. Render never imports narrative. Narrative imports only `state` (read), `bus`, `effects`, `phases`, `config`, `rng`.

## How the System Works

### Layered architecture

1. **Data** — `state.js`, `config.js`. Plain objects, no behavior.
2. **Engine** — `engine.js`, `phases.js`, `effects.js`, `cards/`. Pure rules. No DOM. Emits bus events. Mutates state via `fx.*` or directly inside engine/phases.
3. **Bus** — `bus.js`. The seam. Engine emits; render/audio/stats/narrative listen.
4. **View** — `render/`. Reads state, paints DOM. Never mutates state.
5. **Reactors** — `audio.js`, `stats.js`, `narrative/`. Subscribe to events; trigger side effects (sound, persistence, dialogue, mechanical scene effects).

### The data flow of one click

```
user click → body's delegated listener (render/events.js)
           → matches data-action → calls engine action (e.g. deployCard())
              → engine mutates state, optionally calls fx.* (which mutates state + emits)
              → engine calls enterPhase(...) (mutates state.phase, emits phase.changed)
              → engine emits domain event (e.g. card.deployed, guess.submitted)
                 → render listens to relevant events → renderAll() repaints from state
                 → audio listens (e.g. sfx.deploy) → plays sound
                 → stats listens (game.won/lost) → updates localStorage
                 → narrative listens → may queue + present a scene
                    → scene.effects(state, fx) on dismiss → fx.* fires → render reacts
```

Render never knows what triggered it; it always paints from current state. Engine never knows what's listening; it only emits.

### The card module shape

Every card is one default-export object. Two flavours:

**Single-shot** (most cards):
```js
export default {
  id, name, category, catCls, symbol, desc, cost,
  onResolve(state, fx){ /* fx.addIntel(...), fx.eliminateColour(...), ... */ }
};
```

**Multi-step** (PROBE pattern):
```js
export default {
  id, name, category, catCls, symbol, desc, cost,
  steps: [
    {
      id, promptHdr, promptTxt,
      shape:    'pos' | 'colour',                     // controls button rendering
      choices:  (state, ctx) => [{value, label?, colour?, disabled?}, ...],
      pick:     (value, state, fx, ctx) => { /* mutate ctx or call fx */ }
    },
    // ...
  ]
};
```

The engine's `pickStepChoice` consumes steps in order. Each step's `pick` runs synchronously; if it's not the last step, engine advances to the next. On the last step, engine splices the card out of the hand, emits `card.deployed`, and enters the `guess` phase.

`ctx` is a per-deployment scratchpad (`state.cardCtx.scratch`) shared across steps of one card.

### The phase machine

`state.phase` is always one of:

| Phase | Meaning |
|---|---|
| `''`         | Initial / between phases (transient only). |
| `play-card`  | Player picks a card to deploy. |
| `card-step`  | Multi-step card mid-flow. `state.cardCtx` holds `{ cardId, handIndex, stepIndex, scratch }`. |
| `guess`      | Player fills the row and submits. |
| `narrative`  | A dialogue scene is up; engine input blocked. `state.phaseReturn` holds where to return. |
| `done`       | Run over. `state.over` is `'won'` or `'lost'`. |

**Always go through `enterPhase(id, payload)`.** It runs `exit` on the prior phase, sets `state.phase`, runs `enter` on the new phase, and emits `phase.changed`.

The only place `state.phase = ` is allowed is inside `phases.js`. Grep enforces this.

### The effects (fx) API

`effects.js` exports `fx`. Cards and narrative scenes mutate state ONLY through `fx.*`. Each call:

- mutates `state` directly,
- emits a domain event when meaningful (`slot.locked`, `colour.eliminated`, `secret.changed`),
- emits `effects.applied { name, args }` as an umbrella so render can re-render after a batch.

Every `fx.*` takes a `source` tag (`'card:root'`, `'scene:rival-lock'`, etc.) so listeners can filter.

Current surface:
- `fx.addIntel(symbol, html)`
- `fx.lockSlot(slot, ci, source)` / `fx.unlockSlot(slot, source)`
- `fx.eliminateColour(ci, source)` / `fx.revealColour(ci, source)`
- `fx.addCardToHand(cardId, source)` / `fx.removeCardFromHand(handIndex, source)` / `fx.swapHandCard(handIndex, newCardId, source)` / `fx.shuffleIntoDeck(cardId, source)`
- `fx.grantBufferRow(source)`
- `fx.setSecretSlot(slot, ci, source)` *(narrative-only — no card uses this)*
- `fx.setFlag(name, value)`

To add a new effect, see [Recipe: add a new effect](#recipe-add-a-new-effect) below.

### Bus event reference

| Event | Payload | When |
|---|---|---|
| `game.started`     | `{ secret }`                                     | After `newGame()` enters `play-card` |
| `game.won`         | `{ rows }`                                       | 4-exact submission |
| `game.lost`        | `{ rows }`                                       | Final row submitted, no win |
| `turn.started`     | `{ rowIndex }`                                   | Top of every turn |
| `card.selected`    | `{ cardId, handIndex }`                          | User taps a hand card |
| `card.deployed`    | `{ cardId, rowIndex }`                           | After resolve / final step finishes |
| `step.advanced`    | `{ cardId, stepIndex, value }`                   | Each multi-step pick |
| `peg.cycled`       | `{ slot, ci }`                                   | User clicks a peg in `guess` phase |
| `guess.submitted`  | `{ guess, feedback, rowIndex }`                  | After `submitGuess` |
| `guess.purged`     | —                                                | Purge button pressed |
| `phase.changed`    | `{ from, to }`                                   | Every `enterPhase` |
| `intel.added`      | `{ symbol, html }`                               | Any `fx.addIntel` |
| `slot.locked`      | `{ slot, ci, source }`                           | `fx.lockSlot` |
| `colour.eliminated`| `{ ci, source }`                                 | `fx.eliminateColour` |
| `secret.changed`   | `{ slot, from, to, source }`                     | `fx.setSecretSlot` |
| `effects.applied`  | `{ name, args }`                                 | Umbrella — every `fx.*` call |
| `sfx.deploy`       | —                                                | Engine signals a deploy sound |

### State shape

`state.js` defines a single mutable object. Every field is JSON-safe (no Sets, Maps, functions, DOM refs) so `JSON.stringify(state)` round-trips for future save/resume.

```js
{
  // Game core
  secret:     int[4],            // colour indices (target hash)
  deck:       string[],          // remaining card ids
  hand:       string[],          // card ids in hand
  rows:       Array<{guess:int[4], feedback:{exact,miss}}>,
  maxRows:    number,            // 5 default; BUFFER bumps this
  cur:        int[4],            // current row being filled (-1 = empty)
  locked:     bool[4],           // which slots can't be changed this turn
  rooted:     (int|null)[4],     // persistent locks (ROOT) — colour idx or null
  eliminated: int[],             // ghosted colour indices

  // Interaction
  phase:       string,           // see phase machine table
  selCard:     number|null,      // selected hand index
  cardCtx:     null | { cardId, handIndex, stepIndex, scratch:{} },
  phaseReturn: string|null,      // where to go back to after 'narrative'
  probeSlot:   null,             // legacy field; kept for serialization-stability

  // Outcome
  over:        false | 'won' | 'lost',

  // Narrative scratch
  flags:       { [name]: any },  // setFlag/getFlag persistent across the run
}
```

**Mutation rules:**
- Engine code (`engine.js`, `phases.js`) may mutate `state` directly.
- Cards and narrative scenes must mutate state only through `fx.*`.
- Render code must not mutate state at all.

---

## Recipes — Adding Things

### Recipe: add a single-shot card

1. Create `js/cards/<id>.js`. Copy [mole.js](../js/cards/mole.js) as a template.
2. Set `id`, `name`, `category` (`'RECON' | 'EXPLOIT' | 'DEEP ACCESS'`), `catCls` (`'recon' | 'exploit' | 'deepaccess'`), `symbol`, `desc`.
3. Implement `onResolve(state, fx)`. Read state, call `fx.*`. Don't mutate state directly.
4. In [cards/_registry.js](../js/cards/_registry.js), add:
   - `import myCard from './my-card.js';`
   - the id in the `CARDS` object literal.
5. In [config.js](../js/config.js)'s `DECK_SRC`, optionally add the id (controls how often it shows up in the starting deck).

That's it. The hand renderer and desc-bar pick the new card up automatically from the registry.

### Recipe: add a multi-step card

Use [probe.js](../js/cards/probe.js) as the template.

1. Create `js/cards/<id>.js` with `id`, `name`, `category`, `catCls`, `symbol`, `desc`, and `steps: [...]` instead of `onResolve`.
2. Each step has:
   - `id` (string, used as a phase-style label)
   - `promptHdr` / `promptTxt` (string OR `(ctx, state) => string`)
   - `shape: 'pos' | 'colour'` — `pos` renders number-style buttons, `colour` renders colour swatches
   - `choices(state, ctx)` returning `[{ value, label?, colour?, disabled? }, ...]`
   - `pick(value, state, fx, ctx)` — runs when the user picks one
3. The engine handles step transitions automatically. Use `ctx` to carry data from one step to the next (e.g. `ctx.slot = value` in step 1, read it in step 2).
4. Register in `cards/_registry.js` and (optionally) `DECK_SRC`.

### Recipe: add a narrative scene

A scene is one default-export module. See [scenes/rival-lock.js](../js/narrative/scenes/rival-lock.js).

```js
export default {
  id: 'unique-id',
  trigger: {
    event: 'turn.started',                    // any bus event
    once:  true,                              // optional — fires once per run
    when:  (payload, state) => /* bool */,    // optional gate
  },
  dialogue: [
    { speaker: 'rival', lines: ["Line 1", "Line 2"] },
    // …
  ],
  effects(state, fx){
    // Optional. Runs after the player dismisses the last line.
    // Mutate state through fx.*.
  },
};
```

Add to [scenes/_registry.js](../js/narrative/scenes/_registry.js):
- `import myScene from './my-scene.js';`
- push it into the `SCENES` array.

The narrative engine subscribes to every distinct trigger event used by any scene. When a scene's `when` predicate passes, it queues. If multiple scenes match the same event, they queue in registry order and play sequentially.

### Recipe: add a character

Edit [narrative/portraits.js](../js/narrative/portraits.js):

```js
export const PORTRAITS = {
  // ...
  yourId: { name: 'Display Name', glyph: '◆', colour: 'var(--neon)' },
};
```

Then reference `speaker: 'yourId'` in any scene's `dialogue`.

### Recipe: add a new effect

Edit [effects.js](../js/effects.js). Each effect:

```js
yourEffect(arg, source = 'effect'){
  // 1. mutate state directly
  state.someField = newValue;
  // 2. (optional) emit a domain event for listeners that care
  bus.emit('your.event', { /* … */ , source });
  // 3. always emit applied() so render re-renders
  applied('yourEffect', { arg, source });
},
```

Cards and scenes can now call `fx.yourEffect(...)`. If you added a new bus event, document it in the [Bus event reference](#bus-event-reference) table above and update the render subscriptions in [render/index.js](../js/render/index.js) if it should trigger re-render.

### Recipe: add a new bus event

1. Pick a name with `dot.notation` and a documented payload shape.
2. Emit it from wherever the meaningful state change happens (engine, fx, narrative).
3. If render should re-render in response, add it to the events list inside `wireRenderToBus()` in [render/index.js](../js/render/index.js).
4. If audio/stats/narrative want to react, subscribe in their respective files.
5. Add it to the [Bus event reference](#bus-event-reference) above.

### Recipe: add a new phase

Edit [phases.js](../js/phases.js). Add an entry to `PHASES`:

```js
'your-phase': {
  enter(state, payload){ /* setup */ },
  exit(state, payload){ /* teardown */ },
},
```

Then call `enterPhase('your-phase', payload)` from engine code. Render renderers may need a new branch to handle the phase. The phase string is the only contract.

### Recipe: add a new render region

1. Create `js/render/<region>.js` exporting `renderRegion(state, root)`.
2. Read state, paint into `root.getElementById(...)`. Use `data-action="..."` for any clickable elements.
3. Import + call from [render/index.js](../js/render/index.js)'s `renderAll()`.
4. Add the corresponding handler entry to `ACTIONS` in [render/events.js](../js/render/events.js) for any new `data-action` values.

---

## Constraints / Guardrails

These are mechanical — verifiable by grep — and should not be relaxed.

1. **No file > 200 lines.** Hard cap. If approaching, split.
2. **One default export per content module** (cards, scenes).
3. **Engine layer never imports the DOM.** Engine layer = `engine.js`, `phases.js`, `effects.js`, `state.js`, `config.js`, `rng.js`, `util.js`, `bus.js`, and everything in `cards/`. None may use `document.`, `window.`, or `localStorage`.
4. **Render layer never mutates state.** Render reads only. No `state.foo = ...`, no `fx.*`.
5. **Narrative never imports engine internals.** Allowed: `bus`, `effects` (`fx`), `state` (read), `config`, `rng`, `phases` (only for `enterPhase` from `presenter.js`). Forbidden: `engine.js`, `cards/*`.
6. **One manifest per registry kind.** `cards/_registry.js` and `narrative/scenes/_registry.js` are the only content indexes. Don't add new registry files.
7. **No inline event handlers.** Grep `onclick=` should return zero. Use `data-action` only.
8. **Phase transitions only via `enterPhase`.** Grep `state\.phase\s*=[^=]` should return only the assignment in `phases.js`.
9. **State mutations only inside engine/phases/effects.** Cards and scenes go through `fx.*`.
10. **No external dependencies.** Vanilla JS, vanilla DOM. The Google Fonts link in `<head>` stays.
11. **Save/resume readiness.** No Sets, Maps, functions, DOM refs, or class instances on `state`. Card behaviour lives in modules looked up by id; persisted state references cards by id only.
12. **No new top-level folders without justification.** A card belongs in `cards/`, a scene in `narrative/scenes/`, a render concern in `render/`.

### Verification commands

```bash
# Inline handlers (should return nothing)
grep -rn "onclick=" killcode/

# Phase assignment outside phases.js (should return only phases.js:N)
grep -rnE "state\.phase\s*=[^=]" killcode/js/

# DOM in engine layer (should return nothing meaningful)
grep -rnE "document\.|window\.|localStorage" killcode/js/engine.js killcode/js/phases.js killcode/js/effects.js killcode/js/state.js killcode/js/config.js killcode/js/rng.js killcode/js/util.js killcode/js/bus.js killcode/js/cards/

# File size
find killcode/js -name "*.js" -exec wc -l {} + | sort -rn | head -10
```

---

## Where NOT to Put Things

- **Card behaviour** → `cards/<id>.js`, not `engine.js` or `effects.js`.
- **State mutation from a card** → through `fx.*`, not directly on `state`.
- **DOM lookups in engine** → never. Render reads state and paints; engine just mutates state and emits.
- **Audio calls from engine** → never. Engine emits a bus event (e.g. `sfx.deploy`); audio subscribes.
- **Narrative coupling in engine** → never. Engine emits events; narrative listens.
- **New globals on `window`** → never. Use `data-action` and route through `render/events.js`.
- **One-off helpers in `engine.js`** → put pure helpers in `rng.js` or `util.js`.
- **Inline `style="..."` for layout** → CSS classes. Inline `style` is OK only when colour comes from data (the `K` table).

---

## Common Pitfalls

- **Order of bus emits matters when narrative is involved.** Engine emits `game.started` *after* `enterPhase('play-card')` so a scene's `phaseReturn` is `'play-card'`, not `''`. Preserve this order if you reshape `newGame`.
- **`renderAll` runs while a scene overlay is up.** State.phase is `'narrative'` during that time. Renderers should treat the narrative phase as "show non-interactive base view" — see how `renderHand` and `renderDescBar` already handle it.
- **Multi-step `card.steps`** must complete via `pickStepChoice` for the hand splice + phase transition to fire. Don't manually advance `state.cardCtx.stepIndex`.
- **Adding a card to `_registry.js` but not `DECK_SRC`** is fine — the card just won't appear in the starting deck. Useful for cards earned mid-run via `fx.addCardToHand`.
- **Scene `effects` runs BEFORE `enterPhase(phaseReturn)`.** This means render fires during narrative phase. If your effect needs the player back in `play-card` first, that's not the seam to use — emit an event the engine can pick up and handle.

---

## Migration Notes (legacy)

The pre-refactor monolith was a 1322-line single `index.html`. Behaviour was preserved exactly across the refactor. If something feels off compared to the old version, it's a regression — flag it.

The legacy `state.probeSlot` field is preserved on the state object for save/resume stability but is unused by the new step runner — multi-step state lives in `state.cardCtx.scratch`.
