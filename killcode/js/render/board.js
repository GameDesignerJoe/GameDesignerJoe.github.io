// ══════════════════════════════════════════════
// kill.code — render/board.js
// ══════════════════════════════════════════════

import { toRoman } from '../util.js';
import { paintPeg, fbHtml } from './paint.js';
import { SECRET_LEN } from '../config.js';

export function renderBoard(state, root){
  const board = root.getElementById('board');
  if(!board) return;
  board.innerHTML = '';

  const active = state.rows.length;

  for(let r = 0; r < state.maxRows; r++){
    const isActive = r === active && !state.over;
    const isPast   = r < state.rows.length;
    const row = document.createElement('div');
    row.className = 'row' + (isActive ? ' active' : '');

    const num = document.createElement('div');
    num.className   = 'row-n';
    num.textContent = toRoman(r + 1);
    row.appendChild(num);

    if(isPast){
      const g = state.rows[r];
      for(let i = 0; i < SECRET_LEN; i++){
        const p = document.createElement('div');
        p.className = 'peg';
        paintPeg(p, g.guess[i]);
        row.appendChild(p);
      }
      const fb = document.createElement('div');
      fb.className = 'fb';
      fb.innerHTML = fbHtml(g.feedback);
      row.appendChild(fb);
    } else if(isActive){
      for(let i = 0; i < SECRET_LEN; i++){
        const p = document.createElement('div');
        const tappable = !state.locked[i] && state.phase === 'guess';
        p.className = 'peg' + (tappable ? ' tap' : '');
        paintPeg(p, state.cur[i], state.locked[i]);
        if(tappable){
          p.dataset.action = 'cycle-peg';
          p.dataset.slot   = i;
        }
        row.appendChild(p);
      }
      const fb = document.createElement('div');
      fb.className = 'fb';
      fb.innerHTML = `<div class="fp none"></div>`.repeat(SECRET_LEN);
      row.appendChild(fb);
    } else {
      for(let i = 0; i < SECRET_LEN; i++){
        const p = document.createElement('div');
        p.className     = 'peg';
        p.style.opacity = '.32';
        row.appendChild(p);
      }
      const fb = document.createElement('div');
      fb.className     = 'fb';
      fb.style.opacity = '.18';
      fb.innerHTML     = `<div class="fp none"></div>`.repeat(SECRET_LEN);
      row.appendChild(fb);
    }
    board.appendChild(row);
  }
}
