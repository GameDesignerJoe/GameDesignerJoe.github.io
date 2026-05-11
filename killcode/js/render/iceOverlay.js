// ══════════════════════════════════════════════
// kill.code — render/iceOverlay.js
// Shows the "SYSTEM DEFENSES INITIATED" intro banner at the start of each
// ICE sequence, then hides itself so the per-card pulses on the board + in
// the Corp Activity panel are unobscured. No per-card text in the overlay.
// ══════════════════════════════════════════════

import { bus } from '../bus.js';

function showIntro(count){
  const el    = document.getElementById('ice-overlay');
  const titEl = document.getElementById('ice-overlay-title');
  const subEl = document.getElementById('ice-overlay-sub');
  if(!el || !titEl || !subEl) return;
  const plural = count === 1 ? '' : 'S';
  titEl.textContent = 'SYSTEM DEFENSES INITIATED';
  subEl.textContent = `${count} COUNTERMEASURE${plural} INCOMING`;
  el.className = 'ice-overlay active intro';
}

function hideOverlay(){
  const el = document.getElementById('ice-overlay');
  if(el) el.className = 'ice-overlay';
}

export function wireIceOverlayToBus(){
  bus.on('ice.sequence.start',     ({ count }) => showIntro(count));
  bus.on('ice.sequence.intro-end', hideOverlay);
  bus.on('ice.sequence.end',       hideOverlay);   // belt-and-suspenders
}
