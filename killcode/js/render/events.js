// ══════════════════════════════════════════════
// kill.code — render/events.js
// ONE delegated click listener at the document body. Dispatches by data-action.
// Replaces every inline onclick. Adding a new clickable thing only requires
// emitting `data-action="..."` and registering an entry below.
// ══════════════════════════════════════════════

import {
  newGame, selectHandCard, deployCard,
  pickStepChoice, cyclePeg, submitGuess, purgeGuess,
} from '../engine.js';
import {
  showSettings, hideSettings,
  toggleSfx, toggleBgm, wipeScores,
} from '../settings.js';
import { fitToViewport } from './viewport.js';

const ACTIONS = {
  'select-card':    (el) => selectHandCard(+el.dataset.handIndex),
  'deploy':         ()   => deployCard(),
  'step-pick':      (el) => pickStepChoice(JSON.parse(el.dataset.value)),
  'cycle-peg':      (el) => cyclePeg(+el.dataset.slot),
  'submit':         ()   => submitGuess(),
  'purge':          ()   => purgeGuess(),
  'new-game':       ()   => newGame(),
  'open-settings':  ()   => { showSettings();  fitToViewport(); },
  'close-settings': ()   => { hideSettings();  fitToViewport(); },
  'toggle-sfx':     ()   => toggleSfx(),
  'toggle-bgm':     ()   => toggleBgm(),
  'wipe-scores':    ()   => wipeScores(),
};

export function installDelegation(root){
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if(!el) return;
    const fn = ACTIONS[el.dataset.action];
    if(fn) fn(el);
  });
}
