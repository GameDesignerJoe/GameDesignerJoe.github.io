# The Maze — Progression, Burdens & Arc

*Design note, September 2026, rev. 2. Companion to the Maze notes doc and to Labyrinth 01 · Vision & Narrative. Describes how the existing prototype's features are released across the story, and what the story is. Uses only systems that exist in the prototype as of v0.20.*

> **Staleness warning.** This doc is written against **v0.20**; the game is at
> **v0.31.2**. It is still the best account of the arc and of why each stone maps
> to the knob it does, and its phase table matches the shipped `PHASES` array.
> But §6 and §8 are out of date — see the note at the bottom of this file.
> The game is the source of truth.

## 1. Theme

A man wakes in a maze he put himself in. He has forgotten who he was and why he came. Every traveler whose pages he finds is himself — a stage of the same life — but while inside he does not recognize them. That is the veil.

Each past self is a wound: something that happened, or something he became, that drove him away from the people who loved him. The maze is the between-place where he goes when he is not yet ready to go back. Finding a self's pages is learning that wound. The **pools** between phases are where he tends it — a better-lit place, a person who loves him, a short exchange. The game is the process of becoming ready to leave.

Tone: weight, not horror. Old letters found in a box. The maze is indifferent, which is worse than malevolent. Everything the player reads is in the journal voice: first person, half-remembered, gray italic.

## 2. The Arc

The characters are ordered as one life. The order happens to run from easiest to hardest, which is why it works as a difficulty curve as well as a story.

| Phase | Self | The wound | What the player gains | What the maze gains | Pages |
| --- | --- | --- | --- | --- | --- |
| 0 | The Child | Abandoned. "The man said wait here." | Move, push cells, chalk (X only) | Small maze. Start room with shelves, mat, basin, one chalk. Rooms for pages. No darkness, no gate, no tunnels, no pocket sliders. | 3–4, short |
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

## 6. The pool exchange (parked)

Not to be built until the rest lands. A short scene: still water, a person who loves him, the Caretaker at the edge. Tap a text button to ask a question or answer one — three exchanges at most. The climax of reconnecting is meant to be brief. Technically it slots between the gate opening and the fade-out, using the narrator element for speech and the chalk-glyph picker pattern for answers.

## 7. The last phase — "You"

Each pool mends a relationship damaged by a wound. The one relationship they cannot reach is with himself. The last phase is for that, and it adds nothing. It removes the veil.

- The shelves in the start room bear his name. The pages he finds are his own — assembled from what he actually did: marks he left, what he said at the pools, what he put down. The narrator drops to present tense.
- The basin is empty. The final maze is Small. At its center is water and the Caretaker, seen clearly for the first time. There is nothing to carry and nothing to drop; there is only whether he walks to the edge.
- The exit is open. He walks out into the color. No stats screen — or one line, which the player writes.

Alternative if a separate phase proves unwanted: the seventh pool is a mirror; the person seen is himself; the same exchange as the others. Cheaper, and arguably truer to "the veil lifts."

## 8. What exists today (v0.20)

**Player:** move (glide, buffered turns), push cells, chalk with six signs, charcoal (50 tiles, pause/resume), map screen, map scraps (20%), compass (30s), thread (15s fade), key, lamp (occluded cone), read pages, Stories screen, shelves.

**Maze:** start room (5×5, mat, shelves, chalk, slider door), corridors with branchiness, dead ends as loot slots, rooms, tunnels, pocket sliders, path slider, exit alley and ring, gate (50%), darkness (30%; 25/40/60%; two-ring fringe), narrator, pages, four sizes with area-scaled feature counts, braiding (off).

Everything in §2–§7 is gating and drawing on top of these. No new mechanics are assumed. The pool level reuses the gate/key pair; the stone in the HUD reuses the key slot.

---

## Where this doc is behind the game (v0.31.2)

Read the game, not this list, when they conflict. Recorded here so nobody
rebuilds something that already ships.

- **§6 says the pool exchange is "parked."** It is built. `POOLS` in the game
  holds seven fully written exchanges — Father (Sight), Wife (Pace), Brother
  (Memory), Daughter (Fear), Father again (Direction), Oldest friend (Shame),
  Wife again (Scale) — each with approach lines, an opening, two exchanges with
  branching choices and replies, and a close.
- **§8's feature list predates three systems.** The game now has the **locked-door
  chain with hidden keys** (v0.31, described in the Handoff §4 — a real system,
  not the single 50% gate this doc describes), and the Child-phase additions:
  **crawl gaps, swings, hopscotch, the father figure**. `PHASES` also carries a
  per-phase `doors` count (1–3) that this doc has no equivalent for.
- **§8 says "four sizes."** There are five: xs, sm, md, lg, xl.
- **§2 row 0 describes the Child's maze as bare.** The shipped Child phase has
  `crawl: 5`, `swing: 3`, `hopscotch: true`, `figure: true`, `rooms: 1.4` and
  `bodyScale: 0.85` — the density Joe's notes asked for.
- **The stones' knobs all landed as written.** `B` in the game maps them exactly
  as §5 does: viewRadius, speed, charcoal, darkChance/fringe, pointerSec/pathSec,
  keyChance. Only "Scale" has no multiplier — it is the phase's size instead.
