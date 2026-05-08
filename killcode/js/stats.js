// ══════════════════════════════════════════════
// kill.code — stats.js
// localStorage-backed run stats. Subscribes to game.won / game.lost.
// ══════════════════════════════════════════════

import { STORAGE_KEYS } from './config.js';
import { bus } from './bus.js';

bus.on('game.won',  ({ rows }) => recWin(rows.length));
bus.on('game.lost', ()         => recLoss());

export function loadSt(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || '{}'); }
  catch(e){ return {}; }
}

export function saveSt(s){
  try{ localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(s)); }
  catch(e){}
}

export function recWin(n){
  const s = loadSt();
  s.runs = (s.runs || 0) + 1;
  s.last = n;
  if(!s.best || n < s.best) s.best = n;
  saveSt(s);
  renderStats(s);
}

export function recLoss(){
  const s = loadSt();
  s.runs = (s.runs || 0) + 1;
  s.last = 0;
  saveSt(s);
  renderStats(s);
}

export function renderStats(s){
  s = s || loadSt();
  const b = document.getElementById('sc-best'),
        r = document.getElementById('sc-runs'),
        l = document.getElementById('sc-last');
  if(b){ b.textContent = s.best || '—';                    b.className = 'sc-val' + (s.best ? '' : ' dim'); }
  if(r){ r.textContent = s.runs || 0;                      r.className = 'sc-val' + (s.runs ? '' : ' dim'); }
  if(l){ l.textContent = s.last > 0 ? s.last : (s.runs ? '✕' : '—'); l.className = 'sc-val' + (s.last > 0 ? '' : ' dim'); }
}
