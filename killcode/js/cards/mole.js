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
    // Prefer a colour that's new (not previously revealed by MOLE) AND not on
    // the active row — that gives the player the most novel info. Fall back
    // gracefully when those pools are empty.
    const uniqueSecret  = [...new Set(state.secret)];
    const revealed      = state.flags.moleRevealed ?? [];
    const onBoard       = new Set(state.cur.filter(v => v !== -1));
    const fresh         = uniqueSecret.filter(ci => !revealed.includes(ci));
    const freshOffBoard = fresh.filter(ci => !onBoard.has(ci));

    const pool = freshOffBoard.length ? freshOffBoard
               : fresh.length         ? fresh
               :                        uniqueSecret;

    const ci = pick(pool);
    fx.setFlag('moleRevealed', [...revealed, ci]);
    const c  = K[ci];
    fx.addIntel(c.sym, `MOLE — <strong style="color:${c.fg}">${c.name}</strong> is present in the target hash.`);
  },
};
