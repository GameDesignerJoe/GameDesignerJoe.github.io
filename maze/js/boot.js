// The Maze — the frame loop, resume-or-reset, and go
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

function frame(now) { update(now); draw(); requestAnimationFrame(frame); }
{ const run = SAVE.run;
  if (run && run.phase === (SAVE.phase || 0) && run.stones === (SAVE.stones || 0) && run.pool === !!SAVE.poolPending && (run.size || 'auto') === (SAVE.ui.size || 'auto') && (run.branch || 'auto') === (SAVE.ui.branch || 'auto') && (run.braid || 'auto') === (SAVE.ui.braid || 'auto')) {
    try { restoreRun(run); } catch (e) { console.warn('resume failed', e); delete SAVE.run; persist(); reset(SEED); }
  } else reset(SEED);
  enterMaze(); }
requestAnimationFrame(frame);
