// ══════════════════════════════════════════════
// kill.code — render/hand.js
// ══════════════════════════════════════════════

import { getCard } from '../cards/_registry.js';

export function renderHand(state, root){
  const el = root.getElementById('hand');
  if(!el) return;
  el.innerHTML = '';

  state.hand.forEach((cid, hi) => {
    const card = getCard(cid);
    if(!card) return;
    const sel  = state.selCard === hi;
    const d    = document.createElement('div');
    d.className = 'card ' + card.catCls + (sel ? ' sel' : '');

    // Cards are clickable while picking a card or mid-step (matches legacy).
    const interactive = state.phase === 'play-card' || state.phase === 'card-step';
    if(interactive){
      d.dataset.action    = 'select-card';
      d.dataset.handIndex = hi;
    }

    d.innerHTML = `
      <div class="card-name ${card.catCls}">${card.name}</div>
      <div class="card-sym ${card.catCls}">${card.symbol}</div>
      <div class="card-cat ${card.catCls}">${card.category}</div>
      ${card.cost ? `<div class="card-cost">${card.cost}</div>` : ''}`;

    el.appendChild(d);
  });

  const ql = root.getElementById('queue-lbl');
  if(ql) ql.textContent = state.deck.length + ' in queue';
}
