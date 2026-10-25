# Not All Will Survive Online

The multiplayer version of Not All Will Survive. It started as a copy of `not-all-survive/`
(25 October 2026, at "Debug info panel and a sim replay player"); that folder stays as the
single-player proof of concept, and this one grows into the shared-world game.

The plans live in Joe's Google Docs: Multiplayer Design v2, Milestone Plan, Map Creation Plan,
Multiplayer Test Prototype, and Movement and Scale Reference. `BRIEF.md` still describes the game
systems, which are unchanged so far.

## Differences from not-all-survive

- Device storage keys start `naso_` / `naso.` instead of `nas_` / `nas.`, so the two games
  (same site, same browser storage) never read each other's settings, sim runs or terrain edits.
- The launch trailer's video and sources (`not-all-survive/trailer/`) were not copied.

## Milestone 0: foundations

- `js/core/rng.js`: seeded random numbers, hashing, hex and edge seeds, and a checksum, in integer
  arithmetic so every browser and Node agree. Anything that must match between players comes from
  here, never `Math.random` or `Math.sin`.
- `js/world/settings.js`: the world's scale (1:25), hex size (1.5 km, about 13,700 units) and the
  shared world clock (25 times real time, the same for every player at the same moment).
- `js/net/identity.js`: a player ID kept on the device until the database's sign-in replaces it.
- The debug info panel (gear menu, or `?debuginfo`) has an `online:` line: the player, the world
  and scale, the world clock, the checksum of the ground's class map, and the connection.

URL parameters added: `?player=<id>` (be a given player, e.g. two tabs as two players),
`?world=<name>`, `?scale=25`, `?hexkm=1.5`.

## Checks

- `node nas-online/tests/rng.test.mjs`: the generator's pinned values. If a change alters them,
  every generated world changes, so update them only on purpose.
- Two browsers (or `?player=alice` and `?player=bob`) with `?debuginfo` must show the same ground
  checksum and the same world clock. Checked in headless Chromium on 25 October 2026: ground
  `3e55f747`, seed of hex 0,0 in world `test` `cbb1216d`, the same in the browser and Node.
  Still to check on iOS Safari and a phone.

## Next: milestone 1, the multiplayer test

See the Multiplayer Test Prototype doc and `docs/SUPABASE.md` for the database setup.
