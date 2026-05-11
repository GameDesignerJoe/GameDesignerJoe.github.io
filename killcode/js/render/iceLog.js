// ══════════════════════════════════════════════
// kill.code — render/iceLog.js
// Append-only Corp activity log. Mirrors intel.js: subscribes to 'ice.logged'
// for cheap incremental updates, resets on game.started.
// ══════════════════════════════════════════════

import { bus } from '../bus.js';

const EMPTY_HTML = '<span class="ice-log-empty">No Corp activity yet.</span>';

export function appendIceLog(entry){
  const ct = document.getElementById('ice-log');
  if(!ct) return;
  const e = ct.querySelector('.ice-log-empty');
  if(e) e.remove();
  const d = document.createElement('div');
  d.className = 'ice-log-entry';
  d.innerHTML = `<span class="ice-log-sym">⚠</span><span class="ice-log-body">${entry.message}</span>`;
  ct.appendChild(d);
}

export function clearIceLog(){
  const ct = document.getElementById('ice-log');
  if(ct) ct.innerHTML = EMPTY_HTML;
}

export function wireIceLogToBus(){
  bus.on('ice.logged',   appendIceLog);
  bus.on('game.started', clearIceLog);
}
