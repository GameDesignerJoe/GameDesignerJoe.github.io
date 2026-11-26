---
name: gate-check
description: Work out which dev-plan gate one of Joe's games is really in and write the checklist of what it needs to get through that gate, by reading the game's code, its notes and its existing lists, then agreeing the result with Joe. Use when a prompt starts with "Trailhead gate check", when Joe asks where a game really stands, what it needs to ship, or to redo or rewrite a game's checklist, and after a notes pass or other work that changes what a game still needs.
---

# Gate check

Each game in `trailhead/projects.json` sits on one gate of the dev plan and carries a
`checklist` of what it needs to get through that gate. Joe's problem is a stack of
games that are "nearly there" with no clear list of what's left. This skill produces
that list for one game, from evidence, and gets his agreement on it.

Read `trailhead/README.md` first for the gates and the fields. The gates' "through it
when" lines and starting items are in `trailhead/config.js`.

## For one game

1. **Gather.** Read the game's Trailhead entry, its code, and every list it has: the
   notes doc or file in `notes`, any to-do, plan, milestone or design doc in its
   folder, and its `backlog`. Open the game and play it in a headless browser far
   enough to see what works.
2. **Find the real gate.** Start at Incubation and walk up. A game is in the first
   gate whose "through it when" line is not yet true. Be strict: open feature requests
   mean the feature list is not locked, so the game is not in Beta however polished it
   looks. Say what you saw that decided it.
3. **Write the checklist for that gate**, 20 items at most:
   - Take the gate's items from `config.js`. Tick the ones you verified in the code or
     by playing, and keep their `k`.
   - Reword the rest for this game. "All content is in" becomes "All 50 photos are in"
     or "The other three seasons have their own sheep".
   - Add what only this game needs. Buzzers needs multiplayer tested with real phones;
     a card game needs its print-and-play checked at real size.
   - From the notes, pull in only what blocks the gate (something noted more than
     once, a blocker, a missing piece of the locked list). The running fix-it list
     stays in the doc.
   - Order it so the first unticked item is the easiest way back in: something small
     Joe can do in fifteen minutes, ideally by playing.
   - Each item is one plain sentence that is clearly done or not done.
4. **Things you can't know, ask.** Has anyone else played it? Is this feature in or
   out? Don't guess and don't tick. Put each open decision on the list as its own item
   ("Decide: is the wolf-heavy mode in or out?").
5. **Anything that belongs to a later gate** goes in `backlog`, prefixed with the gate
   ("For Beta: remove the debug handle"), so it isn't lost and isn't in the way.
6. **Show Joe** the gate, the one-line reason, and the list. Change what he disagrees
   with. This list is meant to be one you both agree on.
7. Write it: `stage`, `checklist`, `backlog`, `status`, and `checked` set to today.
   Validate the JSON, commit to `main`, push.

## For several games

Do them one at a time, most recently touched first. Only games that are for publish
(`nfp` is not true) and not hidden, unless Joe names others. Stop after each one and
show him the result before starting the next. Never batch-write lists he hasn't seen.

## Keeping it true

A checklist goes stale the moment the game changes. Whenever you finish work on a
game, in the same push: tick what is now true, add anything the work revealed, and
remove what no longer applies. After a notes pass, check whether the new notes add a
blocker or reopen a decision. If the list has drifted far, say so and offer a fresh
gate check.
