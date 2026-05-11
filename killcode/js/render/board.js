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
      const g         = state.rows[r];
      const hiddenRow = !!g.hidden;
      const obscured  = g.obscuredSlots ?? [];
      for(let i = 0; i < SECRET_LEN; i++){
        const p = document.createElement('div');
        if(hiddenRow){
          p.className = 'peg redacted';
        } else if(obscured.includes(i)){
          p.className = 'peg obscured';
        } else {
          p.className = 'peg';
          paintPeg(p, g.guess[i]);
        }
        row.appendChild(p);
      }
      const fb = document.createElement('div');
      fb.className = 'fb';
      fb.innerHTML = hiddenRow
        ? `<div class="fp hidden"></div>`.repeat(SECRET_LEN)
        : fbHtml(g.feedback, g.hiddenFeedback ?? 0);
      row.appendChild(fb);
    } else if(isActive){
      for(let i = 0; i < SECRET_LEN; i++){
        const p          = document.createElement('div');
        const corpLocked = !!state.corpLocked[i];
        const badData    = state.badDataSlots.includes(i);
        const tappable   = !state.locked[i] && !corpLocked && !badData && state.phase === 'guess';
        let cls = 'peg';
        if(tappable)   cls += ' tap';
        if(corpLocked) cls += ' corp-locked';
        if(badData)    cls += ' bad-data';
        p.className = cls;
        if(!badData) paintPeg(p, state.cur[i], state.locked[i] && !corpLocked);
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
