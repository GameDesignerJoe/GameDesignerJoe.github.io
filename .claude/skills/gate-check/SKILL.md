---
name: gate-check
description: Work out which dev-plan gate one of Joe's games is really in and write the checklist of what it needs to get through that gate, by reading the game's code, its notes and its existing lists, then agreeing the result with Joe (one game) or writing it without stopping (check them all). Use when a prompt starts with "Ship It gate check" or "Trailhead gate check", when Joe asks where a game really stands, what it needs to ship, or to redo or rewrite a game's checklist, and after a notes pass or other work that changes what a game still needs.
---

# Gate check

Each game in `shipit/projects.json` sits on one gate of the dev plan and carries a
`checklist` of what it needs to get through that gate. Joe's problem is a stack of
games that are "nearly there" with no clear list of what's left. This skill produces
that list for one game, from evidence, and gets his agreement on it.

Read `shipit/README.md` first for the gates and the fields. The gates' "through it
when" lines and starting items are in `shipit/config.js`.

## For one game

1. **Gather.** Read the game's Ship It! entry, its code, and every list it has: the
   notes doc or file in `notes`, any to-do, plan, milestone or design doc in its
   folder, and its `backlog`. Open the game and play it in a headless browser far
   enough to see what works.
2. **Find the real gate.** Start at Incubation and walk up. A game is in the first
   gate whose "through it when" line is not yet true. Be strict: open feature requests
   mean the feature list is not locked, so the game is not in Beta however polished it
   looks. Say what you saw that decided it.
   - **Prototype or Preproduction?** This is the call that is easiest to get wrong.
     A game is in **Prototype** when there are bits of gameplay but the full idea of
     the game isn't there, or when it is a simple version of the loop that Joe built
     as the launching-off point for a more ambitious game (The Maze, both the top-down
     and first-person builds, Cartographer and Terrible Parent are his examples).
     Prototype is where he finds the fun. It is through the gate when the fun is found
     and he can say what game this becomes.
   - **No Google Doc, no Preproduction.** If `notes` is empty, the game does not
     leave Prototype: "Has a Google Doc linked for its notes" stays unticked. If it
     is clearly past Prototype anyway, keep its gate and make linking a doc the first
     item on the list.
   - **Preproduction** starts only after that. It is where he works out everything he
     will need to make for this to be a real game, and locks what's in and out.
   - Signs of a prototype: the notes are still asking what the game is or what makes
     it fun; new mechanics are still being tried; one loop with little around it; Joe
     has said he means to build a bigger version. Polish, a portfolio tile or a high
     commit count do not make it more than a prototype.
3. **Write the checklist for that gate.** There is no cap: if it is real work for this
   gate, it goes on the list. Leaving work off doesn't make it go away.
   - Take the gate's items from `config.js`. Tick the ones you verified in the code or
     by playing, and keep their `k`.
   - Reword the rest for this game. "All content is in" becomes "All 50 photos are in"
     or "The other three seasons have their own sheep".
   - Add what only this game needs. Buzzers needs multiplayer tested with real phones;
     a card game needs its print-and-play checked at real size.
   - From the notes, pull in only what blocks the gate (something noted more than
     once, a blocker, a missing piece of the locked list). The running fix-it list
     stays in the doc.
   - **Order it by importance, most important first.** The page shows the first ten
     and folds the rest, so the top ten must be the ten that matter most. A blocker
     outranks a nice-to-have however quick the nice-to-have is.
   - Each item is one plain sentence that is clearly done or not done.
4. **Things you can't know** (has anyone else played it, is this feature in or out):
   don't guess and don't tick. Put each one on the list as its own item ("Decide: is
   the wolf-heavy mode in or out?", "Someone else has played it"). For one game, you
   can also ask Joe when you show him the result. In check-them-all mode, never ask.
5. **Anything that belongs to a later gate** goes in `backlog`, prefixed with the gate
   ("For Beta: remove the debug handle"), so it isn't lost and isn't in the way.
6. **Show Joe** the gate, the one-line reason, and the list, and wait for his yes.
   Change what he disagrees with. This step is for a single game only: the button on
   one game's page, or Joe naming one game.
7. Write it: `stage`, `checklist`, `backlog`, `status`, and `checked` set to today.
   Validate the JSON, commit to `main`, push.

## Things every check looks for

- **Kept as a prototype** (`proto` is true): don't check it and don't move it.
- **Alpha: the feedback button.** A button in the game that opens Joe's Google Form.
  Look for a forms.gle or docs.google.com/forms link in the code and tick it only if
  it's there.
- **Alpha: the money plan is written.** Beta: it is built in. There is no money gate.
  Each release gate carries its own money check for that platform.

## Check them all (several games)

Joe ran this once with a stop after every game and it took an hour of answering
questions. So in this mode: **do not stop, do not ask, do not wait for approval.**

- Games that are for publish (`nfp` is not true), not hidden and not kept as a prototype (`proto`), unless Joe names
  others. Most recently touched first.
- For each one do steps 1 to 5, skip step 6, and write it (step 7). Commit and push
  after each game so nothing is lost if the session ends, then go straight to the next.
- Make the judgement calls yourself from the evidence. Anything only Joe can answer
  becomes a "Decide:" item on that game's checklist, not a question to him.
- Never use a question tool or end a turn to check in. If one game can't be checked
  (won't load, no code), note it and carry on.
- At the very end, give one short summary: each game, its gate, whether it moved, and
  the single most important item on its list. He can redo any one of them with the
  Gate Check button on that game's page, which does ask first.

## Keeping it true

A checklist goes stale the moment the game changes. Whenever you finish work on a
game, in the same push: tick what is now true, add anything the work revealed, and
remove what no longer applies. After a notes pass, check whether the new notes add a
blocker or reopen a decision. If the list has drifted far, say so and offer a fresh
gate check.
