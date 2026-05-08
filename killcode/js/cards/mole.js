// MOLE — leaks one colour confirmed present somewhere in the target hash.
import { K } from '../config.js';
import { pick } from '../rng.js';

export default {
  id:       'mole',
  name:     'MOLE',
  category: 'RECON',
  catCls:   'recon',
  symbol:   '◎',
  desc:     'Leaks one colour confirmed present somewhere in the target hash.',
  cost:     null,

  onResolve(state, fx){
    const ci = pick(state.secret);
    const c  = K[ci];
    fx.addIntel(c.sym, `MOLE — <strong style="color:${c.fg}">${c.name}</strong> is present in the target hash.`);
  },
};
