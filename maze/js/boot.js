// The Maze — the frame loop, resume-or-reset, and go
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

function frame(now) { update(now); draw(); requestAnimationFrame(frame); }
// A run is rebuilt from its seed, so it can only be resumed by the build that made it.
// Generation changes between versions; restoring marks, sliders and doors by index onto a
// maze carved differently is nonsense, so a new build starts a fresh maze. Phase, stones
// and pages are kept — they live outside the run.
{ const run = SAVE.run;
  if (run && run.v === VERSION && run.phase === (SAVE.phase || 0) && run.stones === (SAVE.stones || 0) && run.pool === !!SAVE.poolPending && (run.size || 'auto') === (SAVE.ui.size || 'auto') && (run.branch || 'auto') === (SAVE.ui.branch || 'auto') && (run.braid || 'auto') === (SAVE.ui.braid || 'auto') && (run.turns || 'auto') === (SAVE.ui.turns || 'auto') && (run.clusters || 'auto') === (SAVE.ui.clusters || 'auto')) {
    try { restoreRun(run); } catch (e) { console.warn('resume failed', e); delete SAVE.run; persist(); reset(SEED); }
  } else reset(SEED);
  enterMaze(); }
requestAnimationFrame(frame);
