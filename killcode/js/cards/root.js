// ROOT — root access. Decrypts one confirmed key+position pair.
import { K } from '../config.js';
import { pick } from '../rng.js';

export default {
  id:       'root',
  name:     'ROOT',
  category: 'DEEP ACCESS',
  catCls:   'deepaccess',
  symbol:   '☉',
  desc:     'Root access achieved. Decrypts one confirmed key+position pair. No cost.',
  cost:     null,

  onResolve(state, fx){
    const avail = [0,1,2,3].filter(p => !state.locked[p]);
    if(!avail.length){
      fx.addIntel('☉', 'ROOT — All positions already confirmed.');
      return;
    }

    // Prefer slots whose secret colour wasn't in the player's most recent guess —
    // those reveal more new information.
    const last  = state.rows.length ? state.rows[state.rows.length - 1].guess : null;
    const fresh = last ? avail.filter(p => !last.includes(state.secret[p])) : [];
    const pool  = fresh.length ? fresh : avail;
    const p     = pick(pool);

    fx.lockSlot(p, state.secret[p], 'card:root');
    const c = K[state.secret[p]];
    fx.addIntel('☉', `ROOT — Decrypted: <span style="color:${c.fg}">Slot ${p + 1}: ${c.sym} ${c.name}</span>`);
  },
};
