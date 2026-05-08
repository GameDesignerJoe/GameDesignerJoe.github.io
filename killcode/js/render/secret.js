// ══════════════════════════════════════════════
// kill.code — render/secret.js
// Reveals the target hash row at end of game.
// ══════════════════════════════════════════════

import { paintPeg } from './paint.js';
import { SECRET_LEN } from '../config.js';

export function renderSecretRow(state, root){
  const sr = root.getElementById('secret-row');
  if(!sr) return;
  if(state.over){
    sr.classList.add('show');
    for(let i = 0; i < SECRET_LEN; i++){
      const peg = root.getElementById('s' + i);
      if(peg) paintPeg(peg, state.secret[i]);
    }
  } else {
    sr.classList.remove('show');
  }
}
