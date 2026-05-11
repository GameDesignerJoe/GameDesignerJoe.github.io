// ══════════════════════════════════════════════
// kill.code — render/paint.js
// Pure DOM helpers shared by board/secret/hand renderers.
// ══════════════════════════════════════════════

import { K } from '../config.js';

export function paintPeg(el, ci, locked = false){
  if(ci === -1){
    el.style.background  = '#0c1009';
    el.style.borderColor = '#2c3a2c';
    el.innerHTML = '<span class="plus">+</span>';
  } else {
    const c = K[ci];
    el.style.background  = c.bg;
    el.style.borderColor = c.fg + '99';
    el.innerHTML = `<span style="color:${c.fg};font-size:1.9rem;line-height:1">${c.sym}</span>${locked ? '<span class="lk">⚿</span>' : ''}`;
  }
}

export function fbHtml(fb, hidden = 0){
  const total        = fb.exact + fb.miss;
  const hide         = Math.min(hidden, total);
  const visible      = total - hide;
  const visibleExact = Math.min(fb.exact, visible);
  const visibleMiss  = visible - visibleExact;
  const p = [];
  for(let i = 0; i < visibleExact; i++) p.push('exact');
  for(let i = 0; i < visibleMiss;  i++) p.push('miss');
  for(let i = 0; i < hide;         i++) p.push('hidden');
  while(p.length < 4) p.push('none');
  return p.map(t => `<div class="fp ${t}"></div>`).join('');
}

export function catColor(cls){
  return cls === 'recon'   ? 'var(--amber)'
       : cls === 'exploit' ? 'var(--blue)'
       :                     'var(--neon)';
}
