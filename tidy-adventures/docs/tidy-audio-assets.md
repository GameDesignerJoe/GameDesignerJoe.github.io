# Tidy House — Audio Asset Request
*For sourcing/commissioning. Working tagline: "Everything Everywhere All In Place." Tone: cozy, tactile, gently comedic — think Unpacking / A Little to the Left / Animal Crossing interiors. Nothing epic, nothing tense (until the Gremlin).*

## Technical specs
- **Format:** OGG Vorbis preferred (best browser support + size), MP3 fallback. 44.1kHz.
- **SFX:** mono is fine, -6dB headroom, trimmed tight (no leading silence).
- **Music:** stereo, seamless loop points (or a loop file + separate intro), target ≤1.5MB per track at quality ~q5.
- **Delivery:** individual files, lowercase-kebab names as listed below.

---

## Music (4 tracks)

> **Delivered tracks go in `tidy-adventures/sound/` and are wired in `data/audio.json`
> under `music`** — the names below were the request, not a requirement, and the two
> that have landed use the names they arrived with. A client can bring their own
> track with `"music": "<trackId>"` in `clients.json`; boot validation rejects a
> track name that doesn't exist rather than silently falling back.

| File | Where it plays | Direction | Priority |
|---|---|---|---|
| ~~`mus-title.ogg`~~ **✅ in as `sound/music_tidy_menu.mp3`** | Title screen, job board, Free Play menu | Warm, inviting, short loop (30–45s). A front-porch hello. Music-box, soft piano, or plucked strings. | ★★★ |
| ~~`mus-tidy-a.ogg`~~ **✅ in as `sound/music_tidy_play01.mp3`** | Main gameplay loop | Cozy, unhurried, low-attention. Should survive 20+ minutes of looping without grating — sparse arrangement, no big hooks. Lo-fi beat, kalimba, marimba, soft guitar all work. 60–90s loop. | ★★★ |
| `mus-tidy-b.ogg` | Gameplay alt (rotates or per-room-theme later) | Sibling of A, slightly different palette. | ★ |
| `mus-win.ogg` | Win screen | 8–12s non-looping sting that resolves warmly. The musical equivalent of a deep exhale looking at a clean room. | ★★ |

## Still missing (everything else is in)

`pickup` · `zoom-in` / `zoom-out` · `scatter` · `key-insert` · `locked` ·
`whirlwind` · `cache-open` · `win` — all still synthesized. `pickup` and `win`
are the two worth doing next: one fires on every grab, the other is the last
thing you hear. Every one of them is now actually triggered by something, so
dropping a file in is a one-line data edit with an audible result.

**All three of the unwired triggers now have a moment.** They were configured
from the first pass and never played, which is why nothing sounded missing —
there was no gap to hear, only silence where a sound had been designed.

- `win` → the win screen. It was the last thing you saw and nothing at all
  that you heard. This is the one most worth a real recording: it is the only
  sound in the game that plays once, at the end, with the player's full
  attention on it. See `mus-win.ogg` above.
- `keyInsert` → a key going into a lock that still wants more. In practice
  that means doors: `doorKeys` is 3 or 4, so the first two or three keys used
  to move a pip and make no sound. A chest is a one-key hunt with today's
  data, so its branch is wired for symmetry and does not currently fire.
- `scatter` → a landing that actually shoves other items aside
  (`displaceAround`, which now returns how many it moved). Deliberately silent
  when a flick lands on bare floor, so the sound means "you disturbed the
  pile", not "something landed".

## SFX — core loop (the ones that matter most)

| File | Trigger | Direction | Priority |
|---|---|---|---|
| `sfx-pickup.ogg` | Tap item into hands | Soft pluck/pop. Slight pitch variance handled in code — deliver one neutral take. | ★★★ |
| `sfx-toss.ogg` | Item tossed into furniture (neutral) | Short thup — cloth into a hamper. | ★★★ |
| `sfx-gold.ogg` | Correct home (gold flash) | THE sound of the game. Warm chime/sparkle, ~0.6s, satisfying but not slot-machine. We will hear this 800 times a run — err toward gentle. | ★★★ |
| `sfx-cold.ogg` | Wrong home (cold shake) | Dull thunk or low woodblock. Informational, not punishing — no buzzer. | ★★★ |
| `sfx-row-complete.ogg` | Row fills pure | Bigger than gold: a two-note rising shimmer, ~1s. | ★★★ |
| `sfx-container-complete.ogg` | Whole container done | Chord + soft "whomp" of a drawer sliding shut. ~1.5s. | ★★ |
| `sfx-room-complete.ogg` | Room fully tidy | Small fanfare, still cozy. ~2s. | ★★ |
| `sfx-drop-floor.ogg` | Item dropped/tossed on floor | Light clatter, one bounce. | ★★ |

## SFX — movement & interface

| File | Trigger | Direction | Priority |
|---|---|---|---|
| `sfx-door.ogg` | Walking through a door | Quick door swing + a footstep or two. | ★★ |
| `sfx-bump.ogg` | Swiping into a wall / no door | Muffled bonk. Comedic, small. | ★★ |
| `sfx-zoom-in.ogg` / `sfx-zoom-out.ogg` | Camera zoom | Tiny whoosh pair, inverted. | ★ |
| `sfx-open-container.ogg` | Opening furniture | Drawer/lid slide open. | ★★ |
| `sfx-close-container.ogg` | Closing it | Slide shut. | ★★ |
| `sfx-ui-tap.ogg` | Menu buttons | Neutral soft click. | ★★ |
| `sfx-fling.ogg` | Flick / double-tap launch | Short whoosh with a little spin character. | ★★ |
| `sfx-scatter.ogg` | Landing displacement splash | 3–4 items clattering apart. | ★ |

## SFX — locks, keys, economy

| File | Trigger | Direction | Priority |
|---|---|---|---|
| `sfx-key-pickup.ogg` | Grabbing a key | Bright jingle, distinct from normal pickup. | ★★ |
| `sfx-key-insert.ogg` | Key into a lock (pip fills) | Metallic click-clunk. | ★★ |
| `sfx-unlock.ogg` | Final key — lock opens | Heavy clunk + creak + a touch of the gold shimmer. A real payoff moment. ~1.5s. | ★★★ |
| `sfx-locked.ogg` | Rattling a locked door/chest | Rattle, going nowhere. | ★★ |
| `sfx-star.ogg` | Earning a ⭐ | Tiny twinkle, distinct pitch family from gold. | ★★ |
| `sfx-buy.ogg` | Buying an upgrade | Cheerful purchase — coin + chime. | ★ |
| `sfx-whirlwind.ogg` | Tidy Whirlwind ability | 1.5s swirl of wind + rapid-fire tidying clicks. | ★ |

## Future / hold (don't source yet, listed for planning)
- **Gremlin set:** giggle (appearance), scurry loop, bonk-per-tap, defeated yelp, alarm sting for the notification.
- **Per-theme music** if Tidy Adventure happens (tomb, shipwreck, wizard tower variants of `mus-tidy`).
- **Ambience beds** per room type (kitchen hum, garage echo) — luxury tier.

## Implementation notes (for us, not the audio person)
- Web Audio API with a small pool per SFX; pitch-randomize ±4% on pickup/toss/gold to fight repetition.
- Music needs a user-gesture unlock on mobile (start on first tap — the title screen button works).
- Master volume + separate music/SFX sliders belong in the ⚙️ menu when audio lands.
