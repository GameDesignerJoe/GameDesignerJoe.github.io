# LABYRINTH — Prototype Log & Lessons

*What we built, what failed, and why. Keep this so we don't repeat the dead ends.*

## Mockup v1 — 2D canvas, dithered

Three static screens (Corridor, Examine, Map) painted in 2D canvas with an 8×8 Bayer dither. **Verdict:** dithering over hand-painted 2D geometry read as patchwork; impossible to tell what you were looking at. The Examine (zoom + chalk picker) and Map (parchment hex grid) screens were useful as UI references and their layouts stand.

## Mockup v2 / v3 — 2D canvas, undithered

Same screens without dither, then with more contrast, arch, columns. **Verdict:** still read as a floating rectangle with layering problems. Root cause: faking 3D perspective in 2D requires manual z-order and polygon math that compounds. Pieces were all present but not connected.

## 3D v1 — Three.js hex maze (first attempt)

Real Three.js, hex graph, corridor construction between cells. **Verdict:** camera felt jammed against a wall; everything brown. Causes: ACES tone mapping tinting the scene, fog starting too close, hex size too small, over-clever corridor geometry placing panels wrong.

## 3D v2 — bigger hex, no tone mapping

Still only corners visible. Geometry construction was the problem, not the camera.

## 3D v3 — Single hallway with sliders ✅

One straight box hallway, flat white light, clearly colored surfaces, live sliders for FOV / eye height / corridor width / height / step / near clip. **This worked immediately.** Confirmed renderer and camera were fine all along. Values locked: FOV 68, eye 2.0, width 4.1, height 4.0, step 4.5, near 0.08.

## 3D v4 — Hub loop ✅

Entrance corridor → hub room with N/E exits → north dead-end spur → east passage → chamber → south corridor → return passage looping back to a T-junction on the entrance corridor. Explicit box placement per passage and jamb-split walls at openings. Node graph for movement with smooth tweens, mouse/touch look, and an in-app CONFIG JSON viewer. **Playable loop achieved.**

## Lessons

1. **Real 3D beats faked 3D** for anything with a camera inside a space. Don't try to paint perspective again.
2. **Strip to one room when it looks wrong.** The single-hallway-with-sliders step found the problem in one iteration after four failed full builds.
3. **Dumb, explicit geometry wins.** Boxes placed by hand-readable coordinates. Clever generalized corridor builders silently misplace panels.
4. **No tone mapping.** ACES turned a grey stone hall into a brown cave.
5. **Surfaces need distinct values.** Floor lightest, walls mid, ceiling darkest, or the space collapses into one blob.
6. **Fog is exponential and starts far.** Linear fog at 12 units killed all depth.
7. **Sliders are cheap and decisive.** Give Joe knobs before asking him to judge a look.
8. **Render in-chat, don't hand over .jsx.** A .jsx file opened in Chrome is just text; it needs Vite to run.
9. **Dithering goes last.** It's a post-process shader over a correct render, never a paint style.
