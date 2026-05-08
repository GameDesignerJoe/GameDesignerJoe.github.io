// ══════════════════════════════════════════════
// kill.code — render/intel.js
// Append-only intel log. Subscribes to bus 'intel.added' for cheap incremental
// updates; also resets on game.started.
// ══════════════════════════════════════════════

import { bus } from '../bus.js';

const EMPTY_HTML = '<span class="intel-empty">No data yet.</span>';

export function appendIntel(entry){
  const ct = document.getElementById('intel');
  if(!ct) return;
  const e = ct.querySelector('.intel-empty');
  if(e) e.remove();
  const d = document.createElement('div');
  d.className = 'intel-entry';
  d.innerHTML = `<span class="intel-sym">${entry.symbol}</span><span class="intel-body">${entry.html}</span>`;
  ct.appendChild(d);
}

export function clearIntel(){
  const ct = document.getElementById('intel');
  if(ct) ct.innerHTML = EMPTY_HTML;
}

export function wireIntelToBus(){
  bus.on('intel.added',  appendIntel);
  bus.on('game.started', clearIntel);
}
