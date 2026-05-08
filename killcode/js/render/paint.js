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

export function fbHtml(fb){
  const p = [];
  for(let i = 0; i < fb.exact; i++) p.push('exact');
  for(let i = 0; i < fb.miss;  i++) p.push('miss');
  while(p.length < 4) p.push('none');
  return p.map(t => `<div class="fp ${t}"></div>`).join('');
}

export function catColor(cls){
  return cls === 'recon'   ? 'var(--amber)'
       : cls === 'exploit' ? 'var(--blue)'
       :                     'var(--neon)';
}
