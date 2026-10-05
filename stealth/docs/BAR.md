# UNSEEN — the bar

The reference is **Stealth** (Elusor Games, Steam 2168090), from Joe's screenshots.
A pass needs **every line at 8/10 or higher** from a critic who has the reference
screenshots and this game's screenshots side by side. 8 means "a player who knows the
reference would accept this as the same calibre of game"; 10 means better.

The game is a mobile remake with three changes Joe asked for: square characters in new
colours, hiding places, and readable sight lines. It does not copy the reference's
name, logo or levels.

## Visual (V)

| # | Criterion | What 8/10 looks like |
|---|---|---|
| V1 | Palette | Teal floor on a pale blue-grey vignette, pale walls, light-cyan vision cones. Coherent and calm, nothing muddy or garish. |
| V2 | Light and shadow | Every wall, pillar and character casts one consistent long diagonal shadow. The floor's rim is shadowed by the void. This is the depth cue that makes the reference look 3D. |
| V3 | Architecture | Floors read as designed buildings: circles, crescents, rings, spokes, halls and columns, not random boxes. Every floor has a recognisable shape when zoomed out. |
| V4 | Vision cones | Cones are clipped by walls, overlap brighter, and change colour clearly as a guard grows suspicious and then gives chase. |
| V5 | Characters and props | Player and guards are crisp squares that stand out against the floor. Keys, doors, stars, exit and hiding spots are each readable at a glance at phone scale. |
| V6 | Feedback and juice | "?" and "!" bubbles, a detection meter, noise rings, a caught sequence, a floor-clear sequence and floor intros. Motion is smooth and eased, never jumpy. |
| V7 | UI | HUD, title, pause and stick fit a phone in portrait and landscape, respect safe areas, and never cover the play space awkwardly. |

## Gameplay (G)

| # | Criterion | What 8/10 looks like |
|---|---|---|
| G1 | Controls | Thumbstick as in the maze: analogue, sneak by pushing gently, run at the rim. Owner's tuning, keep it: the stick is 212px (188px in landscape) and the run starts past 88% of the knob's travel, so walking has plenty of room. Responsive, no sticking on corners. WASD and gamepad on desktop. |
| G2 | Guard AI | Patrol, sentry and camera behaviours. Detection fills over time rather than snapping. Seen means chase, lost means "?" search at the last known spot, then the "?" fades and the guard returns to its route. Guards path around walls. |
| G3 | Fairness | Every floor is completable. The player is never spotted at spawn. Detection is predictable from the cone you can see. Getting caught feels like your fault. |
| G4 | Stealth toolkit | Hiding spots, running noise vs. silent sneaking, cover behind pillars, and timing patrols all matter. |
| G5 | Progression | Procedural floors that climb a building: more rooms, guards, cameras, keys and locked doors as you go up. Three optional stars per floor. Progress is saved. |
| G6 | Variety | Ten floors in a row don't feel samey: different room shapes, interior layouts and guard mixes. |
| G7 | Audio | An adaptive, tension-building score: calm while unseen, a pulse near danger, a heartbeat when suspected, drums in a chase. Stingers for "?", "!", pickups, doors, caught and clear. |
| G8 | Stability and performance | No console errors. Steady 60fps on a phone-sized viewport with several guards. Generation never hangs. |

## Loop

1. Build or fix.
2. The critic captures screenshots (portrait phone, landscape, desktop, zoomed-out map) and
   runs the automated checks in `tools/`.
3. The critic scores every line against the reference and lists the specific gaps.
4. Fix the lowest scores first. Repeat until every line is 8 or higher.

The scores for each round are logged in `docs/GAUNTLET.md`.
