// ══════════════════════════════════════════════
// kill.code — render/descBar.js
// Card description / multi-step interaction panel.
// ══════════════════════════════════════════════

import { catColor } from './paint.js';
import { getCard } from '../cards/_registry.js';

const PLACEHOLDER_HTML = '<div class="cdb-text cdb-placeholder" style="color:var(--text3);font-style:italic">Select a program to view and deploy.</div>';

function renderPlaceholder(b){
  b.style.filter = 'drop-shadow(0 0 1px var(--border))';
  b.innerHTML    = PLACEHOLDER_HTML;
}

export function renderDescBar(state, root){
  const b = root.getElementById('desc-bar');
  if(!b) return;

  // Multi-step interaction takes priority.
  if(state.phase === 'card-step' && state.cardCtx){
    renderStep(b, state);
    return;
  }

  // Nothing selected, or game over → placeholder.
  if(state.selCard === null || state.phase === 'guess' || state.phase === 'done' || state.phase === 'narrative'){
    renderPlaceholder(b);
    return;
  }

  // Play-card preview: name, desc, deploy button.
  const card = getCard(state.hand[state.selCard]);
  if(!card){ renderPlaceholder(b); return; }
  const cc  = catColor(card.catCls);
  const lbl = card.id === 'probe' ? 'ACTIVATE PROBE' : 'DEPLOY';
  const disabled = state.phase !== 'play-card' ? 'disabled' : '';

  b.style.filter = `drop-shadow(0 0 3px ${cc}44)`;
  b.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <div class="cdb-name ${card.catCls}">${card.name}</div>
      <div class="cdb-cat ${card.catCls}">${card.category}</div>
    </div>
    <div class="cdb-text">${card.desc}</div>
    <button class="cdb-deploy ${card.catCls}" style="border:1px solid ${cc};color:${cc}" data-action="deploy" ${disabled}>${lbl}</button>`;
}

function renderStep(b, state){
  const card = getCard(state.cardCtx.cardId);
  const step = card?.steps?.[state.cardCtx.stepIndex];
  if(!card || !step){ renderPlaceholder(b); return; }
  const ctx = state.cardCtx.scratch;

  const hdr = typeof step.promptHdr === 'function' ? step.promptHdr(ctx, state) : step.promptHdr;
  const txt = typeof step.promptTxt === 'function' ? step.promptTxt(ctx, state) : step.promptTxt;
  const choices = step.choices(state, ctx);

  b.style.filter = 'drop-shadow(0 0 4px #3af09055)';
  const buttons = choices.map(ch => {
    const value = JSON.stringify(ch.value);
    if(step.shape === 'colour' && ch.colour){
      const c = ch.colour;
      const elim = ch.disabled
        ? 'opacity:.2;cursor:not-allowed;'
        : '';
      return `<button class="col-btn" style="background:${c.bg};border:2px solid ${c.fg};${elim}" ${ch.disabled ? 'disabled' : ''} data-action="step-pick" data-value='${value}'><span style="color:${c.fg}">${c.sym}</span></button>`;
    }
    return `<button class="pos-btn" data-action="step-pick" data-value='${value}'>${ch.label ?? ch.value}</button>`;
  }).join('');

  b.innerHTML = `
    <div class="cdb-name ${card.catCls}">${hdr}</div>
    <div class="cdb-text">${txt}</div>
    <div class="pick-row">${buttons}</div>`;
}
