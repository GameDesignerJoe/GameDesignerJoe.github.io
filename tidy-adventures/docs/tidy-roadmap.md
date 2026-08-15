# Tidy Adventures — Roadmap
*Organized by priority. Status tags: ✅ DONE · 🔨 IN PROGRESS · ⬜ NOT STARTED. Updated Aug 11, 2026.*

---

# 🎯 NOW / NEXT (in order)

## N0. Playtest pass — legibility and control ✅ DONE
Six things that came out of playing it, not planning it.
- **Put things down where you mean to.** Dragging out of a hand slot onto the floor was dead code that threw on every release; the item now lands exactly where you let go.
- **Nothing rests under a door.** Doors paint over items and eat their taps, so anything that landed in a doorway was invisible *and* unpickable. There's a keep-out band in front of every door (`doorZone` in furniture.json), every placement path shares one spot search, and old saves are repaired on load.
- **Fewer sealed containers** — see H3.
- **The taxonomy stopped guessing games.** A Seed Rack holding a cactus next to a Garden Basket holding flowers is a coin flip, and being wrong costs a walk across the house. Confusable things now share a container and the container's name states the rule: Vegetable Crate, Fruit Bowl, Potting Bench, Accessory Hooks. Rule written down at the top of rooms.json.
- **Wrong home reads at a glance.** A faint red wash on any item sitting in a container it doesn't belong to — in the open container and on the badge strip above the furniture.
- **Talents reset each level** — see the talent draft entry below.

## N1. Title screen / main menu ✅ DONE
The front door of the game; also where "return to main menu" lands.
- **Campaign Mode** — the staged progression (N2), with level select / progress markers.
- **Free Play** — the sandbox, built from `data/sizes.json` with computed item counts.
- **Instructions** — how-to-play, now generated from `data/strings.json`.
- Separate campaign-progress, campaign-talent and free-play saves; "quit to menu" in the gear menu.
- *Fixed since: Continue appeared with no save (and with saves too old to load); Instructions opened behind the title screen and was unreadable.*

## N2. Campaign mode — teaching through progression 🔨 IN PROGRESS
*(Shipped: 9 data-driven levels, level select w/ progress, per-level row lengths (3→4→5), variable room sizes, smart auto-filing, and event-triggered tips. Remaining: more levels per chapter, quests woven into levels, difficulty tuning.)*
Each stage is a small playable house introducing exactly one new element. Level definitions are data — `data/levels.json` — so a new level is a JSON entry, not code.

**Teaching order:**
1. **One room, ~3 items, one container** — pick up, toss, sort, gold.
2. **Doors & multi-room** — travel, hauling, the minimap.
3. **Locked containers** — find the one key that opens this chest.
4. **Locked doors** — keys gate space itself.
5. *(then the full sandbox)*

**Tips are now three fields, not one.** `kind` (identity) / `target` (what it points at) / `when` (the event that makes it appear) / `until` (the event that dismisses it). `when` is what lets a tip react to what the player just did — level 1-1's "Now add all items to the **Fridge**" needs it, and text interpolates `{container}`, `{item}`, `{room}`.

## N3. The Gremlin ⬜
A little guy who shows up and **undoes your sorting** — pulls items out of rows and scatters them on the floor. Notification, travel pressure, tap him until he flees.
- The first antagonist in a game that is otherwise entirely self-paced.
- Needs: toast + persistent HUD indicator + minimap marker on his room.
- Escalation levers: visit frequency, unsort rate, taps to drive him off.
- Later: craftable protections — gremlin-proof a container, an alarm, a trap that catches him for bonus ⭐. Ties into the talent draft.
- Design care: a *raid*, not a punishment. Protect completed/gold containers at first; only touch loose rows.

---

# ✅ DONE / SHIPPED

## Architecture & data-driven config ✅
The 2,495-line single file is now `index.html` (~150 lines of shell) + 9 CSS files + 12 JS modules + 12 JSON data files. **Emoji-per-container, row lengths, room counts, lock and key counts, hint text, free-play presets, talent costs, sound and copy are all hand-editable JSON.** A bad edit produces a named on-screen error at boot rather than a silent gameplay bug. See `docs/CLAUDE.md`. Original preserved at `ref/tidy-house-v3.html`.

- **Save / persistence** ✅ — autosave/resume via localStorage; separate keys for run, campaign progress, campaign talents, and audio prefs.
- **Talent draft** ✅ — replaced the shop. ⭐ is lifetime score, never spent; crossing a threshold grants a forced pick-one-of-three. Deferred to a safe moment, never mid-drag. The ⭐ button shows what you've learned, and is hidden in campaign until it means something. *Talents were briefly carried between campaign levels and that is **reverted**: arriving at the level built to teach locked doors already holding Sixth Sense and Bigger Hands made the campaign get easier the further in you went. Each level starts level and earns its own; they still persist within a level, so quit-and-continue keeps them.*
- **Locks & keys v2** ✅ — doors cost a *collection* (N interchangeable 🔑); chests cost a *hunt* (one specific 🗝️, spawned as far from its chest as the house allows). Every lock displays the key it needs, so requirements are always legible.
- **Coin-slot caches** ✅ — hidden 🪙-operated boxes holding reserved house items; pop-open scatter, +1⭐. The coin is now placed far from its own box (it used to land in the same room constantly).
- **Camera** ✅ — auto-fit framing, continuous cursor-anchored wheel zoom, and real pinch-zoom (which never existed — a second finger's events were discarded). Zoom survives walking through a door.
- **Feedback** ✅ — one overloaded 1400ms toast across 39 call sites became three channels: diegetic rejections, rewards that fly to the ⭐, and a real message queue under the HUD.
- **Room completion** ✅ — gold ripple travelling outward through the furniture, then the room's own walls stay gold. *(A decorative prop was tried first — a cat, a lamp, a coffee — and cut: an object you can't pick up reads as a bug in a game about picking things up.)*
- **Furniture as objects** ✅ — each kind drawn in CSS with real structure (fridge door seam and handle, slatted crate, chest with lid and hasp, pegboard holes) and its own silhouette, replacing flat labelled bars.
- **Sound** ✅ — Web Audio engine, all 26 triggers wired, every sound synthesized in code. Drop a commissioned file in `audio/` and set `src` in `data/audio.json` to swap it. *(Assets themselves still ⬜ — see `tidy-audio-assets.md`.)*
- **Notes** ✅ — see H3 below.
- **Fling** ✅ — double-tap launch from hands with flight animation; velocity flick while dragging (in-room only); cheap displacement "physics" on landing. *Cross-room throwing was built, playtested, and **REMOVED**: it turned the game into a stationary meta-sort that bypassed the inventory. Lesson recorded: the inventory cap is the logistics game — any mechanic that moves items between rooms without using hands undermines the core loop.*
- **2D procedural houses** ✅ — rooms grown on a 3×3 grid, spanning tree + bonus doors, lock always seals a leaf room, verified solvable.
- **Pre-filled junk** ✅ — ~25% of containers start with 1–10% foreign clutter to drag out.
- **Two-phase container model** ✅ — named themed furniture, toss-in, badge strips, interior sorting, gold-on-correct-container.

---

# 🕰 HOLD OFF (valuable, but after the Now list)

## H1. Larger houses 🔨 *(the room count now works; scale beyond 3×3 is ahead)*
- ~~"Partially done"~~ — **correction:** the generator hard-clamped to 5 rooms, so Large/XL/Mega all silently produced the same 5-room house despite asking for 6/8/9. Fixed; Mega now really is 9 rooms and 1,552 items.
- Next: grow the grid past 3×3, multiple floors (stairs as a special door type), a second furniture size tier at high density.
- House size is already a parameter, so this is mostly generator work.

## H2. Completed containers do things (unlock progression) 🔨 *(foundation done — locks ARE this pattern, consuming items to open; the emit direction is unbuilt)*
- Fuse box lights dark rooms; candle circle opens mirror-world rooms; bookshelf swings open.
- **The computer** — "hack" it with floppies 💾; opens into a one-cell container holding a special file 📄 needed elsewhere. Locks whose keys are ordinary sortable types create cross-room dependencies for free.

## H3. Quests 🔨 *(the note loop shipped; chained payoffs ahead)*
- Finishing the first container in a room drops a 📝 → picking it up opens a handwritten card asking for three specific things → pinned objective strip → payoff, ⭐, and a reply. Data in `data/quests.json`, with a generated fallback so every room gets one.
- **The seal is no longer in every room** (`roomShare`, default 0.6). Sealing one container in every single room made "locked" the resting state of the house rather than an event. Rooms without a seal still leave a note — the fallback asks about an open container.
- **Deliberately not a talking character.** A dialogue tree with a portrait costs ~10× more, interrupts the quiet loop the game is good at, and a badly-written NPC damages the tone. The note is the cheapest possible NPC and it establishes a voice. If the writing lands, *then* consider giving that voice a face.
- Next: quests that chain, quests that gate a room, quest items that come from *another* room.

## H4. Sets & recipes ⬜
- Rows that want a *sequence*: sandwich (🍞🧀🥓🥬🍅🍞), place setting, outfit, planet order, poker straight.
- Assembly puzzle instead of identification puzzle. Open question: strict position vs. any-order (strict is probably the fun).
- Pairs with H2: finishing the sandwich feeds someone / unlocks something.

## H5. Strange rooms / wider emoji palette ⬜
- Mythical creatures, flags (real learnable knowledge), collectibles, sports, aliens, aquarium, apothecary, zodiac...
- Harder identification as a free difficulty lever. Now a pure content pass: add a room to `rooms.json` and list it in a theme.

## H6. Movable furniture ⬜
- Press-and-hold a bed/couch and it slides aside, revealing clutter underneath.
- Needs: decorative (non-container) furniture in generation, a slide animation, a hidden-items layer.
- Pairs with caches: the room becomes a thing you search, not just a floor you read.

## H7. Hallways ⬜
- Narrow connective spaces, few/no containers; traversal pacing, route memory, real minimap topology.

## H8. Name & theme direction ✅ DECIDED — **Tidy Adventures**
- Settled: the game is *Tidy Adventures*, matching the URL it ships at. Implies a journey of themed zones rather than one house.
- Themes are already data (`data/themes.json`: which rooms, which room shapes), so a tomb / shipwreck / wizard's tower is a content pass plus a CSS floor and furniture skin — no engine work.
- Round and hex room shapes are implemented but unused; a new theme can switch them on.

---

# 🅿 Parking lot (unsorted, add as they come)
- ~~**Key varieties**~~ ✅ — two token types shipped (🔑 collection for doors, 🗝️ hunt for chests) and locks display the key they need. More flavours are a `data/furniture.json` edit, but five near-identical boxes with different stickers would be content churn — add one only when it gates something *different*.
- **Real fling physics** — pool-ball chain collisions. The cheap displacement version is shipped; this is the full contact simulation if we ever want it.
- **Commissioned audio** ⬜ — the engine and all 26 triggers are live on synthesized placeholders. See `tidy-audio-assets.md`; swapping in a real file is one field per sound.
- **Music** ⬜ — 4 tracks in the brief, none implemented (the engine handles SFX only so far).
- Letterpress / font-identification theme (the original combined pitch).
- Daily house / seeded runs for sharing. *(Needs a seeded RNG — generation currently calls `Math.random()` directly.)*
- Stats & streaks (accuracy % and timer already on the win screen).
- **Round/hex rooms are unreachable dead code** until a theme opts in. `inShape()` handles them and the CSS exists; `themes.json` just doesn't use them yet.
- Entry animation when walking into a room where a fling landed.
- Finish the module split: `js/main.js` still holds the render, action and input tiers. Mechanical, and the target graph is documented in `docs/CLAUDE.md`.
