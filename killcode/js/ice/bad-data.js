// BAD DATA ICE — Corp corrupts one input slot. No key accepted there this cycle.
import { pick } from '../rng.js';

export default {
  id:   'ice-bad-data',
  name: 'BAD DATA',
  onResolve(state, fx){
    const open = [0,1,2,3].filter(i => !state.locked[i] && !state.corpLocked[i]);
    if(!open.length) return;
    const slot = pick(open);
    fx.applyBadData(slot);
    fx.addIceLog('ice-bad-data', `BAD DATA — Slot ${slot + 1} is corrupted. Input blocked.`);
  },
};
