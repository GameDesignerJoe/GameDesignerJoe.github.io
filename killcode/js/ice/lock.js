// LOCK ICE — Corp forces one slot from the player's last guess into the active row.
import { pick } from '../rng.js';

export default {
  id:   'ice-lock',
  name: 'LOCK',
  onResolve(state, fx){
    if(!state.rows.length) return;                           // cycle 1 guard
    const eligible = [0,1,2,3].filter(i => !state.locked[i]);
    if(!eligible.length) return;
    const slot   = pick(eligible);
    const colour = state.rows[state.rows.length - 1].guess[slot];
    fx.applyCorpLock(slot, colour);
    fx.addIceLog('ice-lock', `LOCK — Slot ${slot + 1} carried forward from last entry.`);
  },
};
