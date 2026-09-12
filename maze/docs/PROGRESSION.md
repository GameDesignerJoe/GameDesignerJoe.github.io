# The Maze — Progression, Burdens & Arc

<!-- reviewed: v0.76.0 — §1–§7 are the arc and need no version; §8 re-read against the game -->

*Design note, September 2026. Companion to Joe's notes doc and to Labyrinth 01 ·
Vision & Narrative. Describes what the story is and how the prototype's features
are released across it.*

> **This is the arc, and the arc still stands.** §1–§7 are the design: the
> theme, the eight selves, the seven stones, the pools. They have not changed
> and are not stale.
>
> **§8 is a snapshot of what was built, and it is kept current.** It was written
> against v0.20, drifted badly, and was rewritten at v0.76.0. If it has drifted
> again, **the game is the source of truth** — read `data/phases.js`,
> `data/config.js` and `HANDOFF.md`, and fix this file rather than the game.

## 1. Theme

A man wakes in a maze he put himself in. He has forgotten who he was and why he came. Every traveler whose pages he finds is himself — a stage of the same life — but while inside he does not recognize them. That is the veil.

Each past self is a wound: something that happened, or something he became, that drove him away from the people who loved him. The maze is the between-place where he goes when he is not yet ready to go back. Finding a self's pages is learning that wound. The **pools** between phases are where he tends it — a better-lit place, a person who loves him, a short exchange. The game is the process of becoming ready to leave.

Tone: weight, not horror. Old letters found in a box. The maze is indifferent, which is worse than malevolent. Everything the player reads is in the journal voice: first person, half-remembered, gray italic.

## 2. The Arc

The characters are ordered as one life. The order happens to run from easiest to hardest, which is why it works as a difficulty curve as well as a story.

| Phase | Self | The wound | What the player gains | What the maze gains | Pages |
| --- | --- | --- | --- | --- | --- |
| 0 | The Child | Abandoned. "The man said wait here." | Move, push cells, chalk (X only) | Medium maze, dense rather than large. Start room with shelves, mat, basin, one chalk. No darkness, gate, tunnels or pocket sliders — but crawl gaps, swings, hopscotch, the father, the exit gauntlet and a secret room. | 3–4, short |
| 1 | The Cartographer | Tried to control the uncontrollable. Her map is beautiful and wrong. | Charcoal, the map screen | Medium. Pocket sliders (sealed pockets with loot). Light braiding so the map can be "wrong." | 5 |
| 2 | The Soldier | Hardened. Method against a place that won't be soldiered. | Full chalk sign set (↑→↓← X ?), compass needle | Tunnels. The required path slider — the route is no longer honest. | 5 |
| 3 | The Archivist | Filed everything instead of feeling it. | Map scraps. The Stories reader's "read everything together" view is now understood as his. | Large. More rooms per maze. His notes reveal he built the shelves the player has seen since the first run. | 3–4, clinical until the last |
| 4 | The Priest | Gave himself to something so he wouldn't have to be someone. | Lamp, thread | Darkness arrives (25% only, in 30% of mazes). | 5 |
| 5 | The Criminal | Blamed himself. "Nobody put me here." | Nothing new — the toolbox is complete | Gate and key (50% of mazes). Darkness to 40 / 60%. | 5 |
| 6 | The One Who Stayed | Got comfortable being lost. | Nothing | X-Large. Every feature on. Exit never gated — nothing stops you but the size of the place. His pages name the others; the veil visibly thins. | 2–3 |
| 7 | You | The one relationship the pools haven't touched: with himself. | Nothing added. The veil is removed. | Small. See §5. | Your own |

Page counts follow the narrative arc, not a rule. The code accepts any count per character.

**The Caretaker** is not a phase. He is the host of the pools — the one who brings the person you are reconnecting with. Across the phases he changes from a tall shape at the end of a corridor to someone sitting at the water's edge. If the "these are all you" revelation is ever stated aloud, it is his to state, at the end, or never.

## 3. Rules of progression

- **Advancement is by pages.** A phase ends when every page of its self has been found. Then a pool level, then the next self.
- **Every run advances the story.** Each run lays out the next uncollected pages in story order. The first uncollected page always sits in a room on the solution route, so a completed run yields at least one page; the others reward exploring. Five pages is two to five runs.
- **Features arrive with the self they belong to.** The first-find helper cards already exist; each fires in the phase that introduces its thing, which paces them better than all-at-once.
- **Burdens lift at the end of a phase, at the pool.** The lift is felt from the next phase on.
- **The start room is the only progress display.** Shelves fill in with pages found. The basin empties of stones put down. No counters, no bars.
- **The phase change lands with a beat.** The narrator's line on waking is the new self's first sentence.

## 4. The pool level

Between every phase. Built from existing parts:

1. A small maze, better lit (larger light radius, no darkness, no tunnels, no sliders beyond the start-room door).
2. One stone lies in a dead end. Picking it up is the level's only pickup. The stone is carried the way the key is carried — it shows in the HUD where the key does.
3. The pool sits behind a gate in the exit's place. The stone opens it: the gate mechanic, re-skinned. There is no other way through.
4. Beyond the gate: the water, one of the people who love him, the Caretaker as host. The player drops the stone into the pool; the reflection clears; a short exchange follows (see §6). The level ends.
5. Back in the start room on the next run, the basin holds one stone fewer, and the lifted restriction is in effect.

The stone is not in the basin during the pool level. The basin is a record of what has been put down; the pool is where it happens.

## 5. Burdens — the seven stones

The player enters carrying seven stones without knowing it. They are drawn heaped in a basin in the start room from the first run, hiding the water. The gameplay of a burden is not an item; it is a **restriction the player has felt all along**, held at its heaviest. Each pool lifts one, permanently.

| # | Stone | What it holds down | Existing knob | Put down at the pool after |
| --- | --- | --- | --- | --- |
| 1 | Sight | How far the light reaches | viewRadius | The Child |
| 2 | Pace | How fast you move | speed | The Cartographer |
| 3 | Memory | How much a piece of charcoal covers | charcoalTiles | The Soldier |
| 4 | Fear | How often darkness comes, how hard its fringe | darknessChance / fringe alpha | The Archivist — so it lands as the Priest's darkness arrives |
| 5 | Direction | How long the compass and thread last | pointerSeconds / pathSeconds | The Priest |
| 6 | Shame | How often the way out is locked against you | keyChance (50% → 25%) | The Criminal — the doors stop being locked once he has said "I did it" |
| 7 | Scale | How big he has let the place become | size (the final maze is Small) | The One Who Stayed — the "You" maze is small because he put this down |

Deltas start small, 5–8% each, and stack. The Child phase is heavy but not miserable. The whole game gets lighter, and the reason is visible in the room without a word.

The shelves show what has been gathered; the basin shows what has been put down. Same room, two ledgers.

## 6. The pool exchange (built — this section is the brief it was built from)

*Written as a plan; shipped since. `POOLS` in `data/text.js` holds all seven.
Kept because it is still the statement of what the scene is for.*

A short scene: still water, a person who loves him, the Caretaker at the edge. Tap a text button to ask a question or answer one — three exchanges at most. The climax of reconnecting is meant to be brief. Technically it slots between the gate opening and the fade-out, using the narrator element for speech and the chalk-glyph picker pattern for answers.

## 7. The last phase — "You"

Each pool mends a relationship damaged by a wound. The one relationship they cannot reach is with himself. The last phase is for that, and it adds nothing. It removes the veil.

- The shelves in the start room bear his name. The pages he finds are his own — assembled from what he actually did: marks he left, what he said at the pools, what he put down. The narrator drops to present tense.
- The basin is empty. The final maze is Small. At its center is water and the Caretaker, seen clearly for the first time. There is nothing to carry and nothing to drop; there is only whether he walks to the edge.
- The exit is open. He walks out into the color. No stats screen — or one line, which the player writes.

Alternative if a separate phase proves unwanted: the seventh pool is a mirror; the person seen is himself; the same exchange as the others. Cheaper, and arguably truer to "the veil lifts."

## 8. What exists today (v0.76.0)

Everything in §2–§7 is gating and drawing on top of these. **No new mechanics
are assumed by the arc** — the pool level reuses the gate/key pair, and the
stone in the HUD reuses the key slot.

**The player:** move (three models — rails in corridors, free in rooms, or
either everywhere; facing follows the ground he covers), push cells, chalk with
six signs, charcoal, the map screen, map scraps, compass, thread, one-use keys,
lamp (occluded cone), squeeze through crawl gaps, read pages, the Stories
screen, shelves.

**The maze:** a sealed start room you push your way out of; corridors with
branchiness, straightness and fill dials; **districts** (six hearts: rings,
thicket, comb, lattice, squeeze, shifting); **five rooms, and they are places**
— seven landmark kinds (pool, statues, spiral, columns, dais, well, balls), two
of them interactive; **a key vault** in every level; dead ends as loot slots;
tunnels; pockets and sliders; swings; the exit alley and its shimmering oval;
**a chain of locked doors with hidden keys**, placed under distance rules;
darkness with a two-ring fringe; the narrator; pages; five sizes with
area-scaled feature counts; braiding.

**The Child's maze additionally:** crawl gaps on and off the route, swings,
hopscotch, the father, the **exit gauntlet** (a tree of squeezes before the way
out, two of its cells swinging on a clock), and a **secret room** sealed behind
a squeeze and dark until you find its floor switch.

**Presentation:** a close camera (`tilePx` 150) with the title screen closer
still; fog as a screen-space vignette; the chapter heading set into the floor;
the body darkening under its burdens, band by band, with a two-beat lift at each
pool; a floor that wears where people walk, gathers grime at its edges and is lit
by fixtures, some of them faulty.

**Beyond the arc:** three prototype levels (island, labyrinth, gallery) from the
debug menu, for trying a shape without disturbing the game.

### Where §2 and §5 are ahead of or behind the build

- **§2 row 0 describes the Child's maze as bare.** It is not, and the Child is
  **`md`**, not small — `crawl: 5`, `swing: 3`, `hopscotch`, `figure`,
  `rooms: 1.4`, `bodyScale: 0.68`, plus the gauntlet and the secret room. Joe's
  rule is that size is fine if there's enough going on.
- **`PHASES` carries a per-phase `doors` count (1–3)** that §2 has no column for.
- **§6's pool exchange is built**, not parked. `POOLS` in `data/text.js` holds
  seven written exchanges — Father (Sight), Wife (Pace), Brother (Memory),
  Daughter (Fear), Father again (Direction), Oldest friend (Shame), Wife again
  (Scale) — each with approach lines, an opening, two branching exchanges and a
  close. The pool level was made *trivially short* on purpose after Joe found an
  early version hard.
- **The stones' knobs all landed as §5 writes them.** `B` maps them exactly:
  viewRadius, speed, charcoal, darkChance/fringe, pointerSec/pathSec, keyChance.
  Only **Scale** has no multiplier — it is the phase's size instead.
- **Sizes: five, not four** — xs, sm, md, lg, xl.
