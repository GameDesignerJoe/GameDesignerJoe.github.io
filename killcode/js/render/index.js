// ══════════════════════════════════════════════
// kill.code — render/index.js
// Renders every region from current state. Subscribes to bus for re-renders.
// At this scale, full re-render is cheaper than dirty-flag bookkeeping.
// ══════════════════════════════════════════════

import { state } from '../state.js';
import { bus }   from '../bus.js';

import { renderHand }      from './hand.js';
import { renderBoard }     from './board.js';
import { renderPhase }     from './phase.js';
import { renderDescBar }   from './descBar.js';
import { renderSecretRow } from './secret.js';
import { fitToViewport }   from './viewport.js';
import { wireIntelToBus }      from './intel.js';
import { wireIceLogToBus }     from './iceLog.js';
import { wireIceOverlayToBus } from './iceOverlay.js';
import { wireIceFlashToBus }   from './iceFlash.js';

export function renderAll(){
  renderHand(state, document);
  renderBoard(state, document);
  renderPhase(state, document);
  renderDescBar(state, document);
  renderSecretRow(state, document);
  fitToViewport();
}

export function wireRenderToBus(){
  // Anything that mutates the rendered shape → full re-render.
  [
    'phase.changed',
    'turn.started',
    'card.selected',
    'card.deployed',
    'step.advanced',
    'guess.submitted',
    'guess.purged',
    'peg.cycled',
    'game.started',
    'game.won',
    'game.lost',
    'effects.applied',
  ].forEach(ev => bus.on(ev, renderAll));

  // Intel + Corp logs handle their own incremental updates.
  wireIntelToBus();
  wireIceLogToBus();
  wireIceOverlayToBus();
  wireIceFlashToBus();

  // Lockdown body class — toggled here so engine never touches the DOM.
  bus.on('game.started', () => document.body.classList.remove('lockdown'));
}
