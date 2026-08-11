# Tidy House — Roadmap
*Organized by priority. Status tags: ✅ DONE · 🔨 IN PROGRESS · ⬜ NOT STARTED. Updated Aug 9, 2026.*

---

# 🎯 NOW / NEXT (in order)

## N1. Title screen / main menu ✅ DONE
The front door of the game; also where "return to main menu" lands.
- **Campaign Mode** — the staged progression (N2), with level select / progress markers.
- **Free Play** — the current sandbox. Sub-option for house size: Short / Medium / Long (rooms × density presets — the knobs already exist in the generator).
- **Instructions** — the existing how-to-play content, relocated from the ? overlay.
- Needs: separate campaign-progress vs. free-play saves; a "quit to menu" affordance in the gear menu.

## N2. Campaign mode — teaching through progression 🔨 IN PROGRESS
*(Shipped: 9 data-driven levels incl. abilities training "Talent Show", level select w/ progress, per-level row lengths (3→4→5), variable room sizes & shapes (rect/round/hex), smart auto-filing. Remaining: more levels per chapter, quests, difficulty tuning.)*
A staged rollout of the whole system, tutorial-by-escalation. Each stage is a small playable house introducing exactly one new element; a few levels of each before the next unlock. Requires a "level definition as data" refactor (room count, item density, which systems are on) — worth doing well, everything later builds on it.

**Teaching order:**
1. **One room, ~5 items, one container** — learn pick up, toss, sort, gold.
2. **Doors & multi-room** — 2–3 rooms; learn travel, hauling, the minimap.
3. **Locked containers** — keys exist, feed the lock, treasure inside.
4. **Locked doors** — keys gate space itself.
5. *(then the full sandbox: bigger houses combining everything)*

## N3. The Gremlin ⬜
A little guy who shows up and **undoes your sorting** — pulls items out of rows and scatters them on the floor. You get a notification (which room he's in), drop what you're doing, travel there, and click/tap him repeatedly until he flees.
- Creates urgency and travel pressure in a game that's otherwise fully self-paced — the first *antagonist*.
- Notification needs: toast + persistent HUD indicator + minimap marker on his room.
- Escalation levers: how often he visits, how much he unsorts per second, how many taps to drive him off.
- Later: **craftable protections / skills** — gremlin-proof a container, an alarm that slows him, a trap that catches him for bonus ⭐. Ties into the upgrades shop.
- Design care: he must feel like a *raid*, not a punishment — protect completed/gold containers at first? Only touch loose rows? Tune so his damage is annoying-recoverable, not despair.

---

# ✅ DONE / SHIPPED IN POC

- **Save / persistence** ✅ — full autosave/resume via localStorage (works on real hosting).
- **Upgrades system v1** ✅ — ⭐ per completed row, shop screen, Bigger Hands / Magnet Fingers / Sixth Sense / Tidy Whirlwind (active w/ cooldown), debug +1⭐ in gear menu. *Remaining from original wish list: hint pulse, container X-ray, auto-sort-one-row, movement speed — add when the economy gets a real balance pass.*
- **Locks & keys v1** ✅ — locked doors (5 keys) and locked containers (Hidden Stash, 3 keys), fungible keys, correct-side spawning, plaques with pips. *Multi-lock dependency ordering for complex layouts still ahead.*
- **Fling** ✅ — double-tap launch from hands with flight animation; velocity flick while dragging (in-room only); cheap displacement "physics" on landing (radial shove). *Cross-room throwing (door-drops, flick-through-doorways) was built, playtested, and **REMOVED**: it turned the game into a stationary meta-sort that bypassed the inventory entirely. Lesson recorded: the inventory cap is the logistics game — any mechanic that moves items between rooms without using hands undermines the core loop.*
- **2D procedural houses** ✅ — 5 rooms grown on a 3×3 grid, spanning tree + bonus doors, lock always seals a leaf room, verified solvable.
- **Coin-slot caches** ✅ — hidden 🪙-operated boxes holding reserved house items; one coin each, pop-open scatter, +1⭐. 🪙 is currency now (💰 replaced it as a sortable type). First "things that fit in slots" lock variant.
- **Pre-filled junk** ✅ — ~25% of containers start with 1–10% foreign clutter to drag out (free play + campaign 2-2 onward).
- **Two-phase container model** ✅ — named themed furniture, toss-in, badge strips, interior sorting, gold-on-correct-container. (This was the big v3 redesign.)

---

# 🕰 HOLD OFF (valuable, but after the Now list)

## H1. Larger houses 🔨 *(partially done — 2D layouts shipped; scale still ahead)*
- Grow the grid to 4×4, 5×5+; multiple floors (stairs as a special door type).
- Density knob toward 1,000+ items; possible second furniture size tier at high density.
- *Naturally falls out of the N2 level-data refactor — house size becomes a parameter.*

## H2. Completed containers do things (unlock progression) 🔨 *(foundation done — locks ARE this pattern, consuming items to open; the emit direction is unbuilt)*
- Fuse box lights dark rooms; candle circle opens the mirror-world versions of rooms; bookshelf swings open.
- **The computer** — "hack" it with floppies 💾; opens into a one-cell container holding a special file 📄 needed elsewhere — first chained unlock. Locks whose "keys" are ordinary sortable types create cross-room dependencies for free.

## H3. Quests ⬜
- Completing a container/room spawns a **note** 📝 → note gives an objective ("put 🥔🥕🧅 in the stove for dinner") → quest container → payoff (story beat, unlock, ⭐ bonus).
- Reframes tidying from chore to *investigation*. Quests are data, not code, once N2's level system exists.

## H4. Sets & recipes ⬜
- Rows that want a *sequence*: sandwich (🍞🧀🥓🥬🍅🍞), place setting, outfit, planet order, poker straight.
- Assembly puzzle instead of identification puzzle. Open question: strict position vs. any-order (strict is probably the fun).
- Pairs with H2: finishing the sandwich feeds someone / unlocks something.

## H5. Strange rooms / wider emoji palette ⬜
- Mythical creatures, flags (real learnable knowledge), collectibles, sports, aliens, aquarium, apothecary, zodiac...
- Harder identification as a free difficulty lever. Mostly a content pass — cheap to add once level data exists.

## H6. Movable furniture ⬜
- Press-and-hold a bed/couch and it slides aside, revealing clutter hidden underneath.
- Needs: decorative (non-container) furniture pieces in room generation, a slide animation, a hidden-items layer that spawns some floor items "under" furniture at gen time.
- Pairs with caches: more reasons to poke at the room itself. The room becomes a thing you search, not just a floor you read.

## H7. Hallways ⬜
- Narrow connective spaces, few/no containers; traversal pacing, route memory, real minimap topology.

## H8. "Tidy Adventure" — name & theme direction ⬜
- Egyptian tomb (canopic jars, sealed chambers), shipwreck, wizard's tower, dragon's hoard.
- Absorbs H2/H5/H6 and upgrades-as-relics. Suggests a journey of themed zones instead of one house.
- *Decision point, not a build: settle this after campaign structure proves out, since it decides what the campaign's levels are skinned as.*

---

# 🅿 Parking lot (unsorted, add as they come)
- **Key varieties** — emoji audit done: 🔑 🗝️ 💳 🪪 🎫 🪙 are the strong candidates (distinct silhouettes). Design direction chosen: locks display the key emoji they need (not a generic 🔒), so requirements are always legible — no guess-the-key. Implement when a run wants 2+ lock flavors.
- **Real fling physics** — pool-ball chain collisions (cheap displacement version ✅ shipped; this is the full contact simulation if we ever want it).
- Letterpress / font-identification theme (the original combined pitch).
- Sound design 🔨 — **asset request list written: see tidy-audio-assets.md**. Next: Web Audio hookup once files exist.
- Daily house / seeded runs for sharing.
- Stats & streaks (accuracy % and timer already on the win screen).
- Loupe/name treatment for items dragged from hand slots.
- Entry animation when walking into a room where a fling landed (see the splash aftermath settle).
