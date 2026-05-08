// GHOST — traces a dead signal. Reveals one colour absent from the hash entirely.
import { K } from '../config.js';
import { pick } from '../rng.js';

export default {
  id:       'ghost',
  name:     'GHOST',
  category: 'RECON',
  catCls:   'recon',
  symbol:   '◌',
  desc:     'Traces a dead signal. Reveals one colour absent from the hash entirely.',
  cost:     null,

  onResolve(state, fx){
    const absent = K
      .map((_, i) => i)
      .filter(i => !state.secret.includes(i) && !state.eliminated.includes(i));

    if(!absent.length){
      fx.addIntel('◌', `GHOST — No further dead signals. All absent keys already removed from pool.`);
      return;
    }

    const ci = pick(absent);
    const c  = K[ci];
    fx.eliminateColour(ci, 'card:ghost');
    fx.addIntel('◌', `GHOST — <strong style="color:${c.fg}">${c.name}</strong> <span style="color:${c.fg}">${c.sym}</span> is <strong>NOT</strong> in the hash. Key removed from pool.`);
  },
};
