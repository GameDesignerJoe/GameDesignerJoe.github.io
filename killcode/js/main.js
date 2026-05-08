// ══════════════════════════════════════════════
// kill.code — main.js
// Entry point. Wires modules and boots a new game.
// ══════════════════════════════════════════════

import './audio.js';                                 // self-installs bus subs + autoplay listeners
import { newGame }                       from './engine.js';
import { renderAll, wireRenderToBus }    from './render/index.js';
import { installDelegation }             from './render/events.js';
import { fitToViewport, startTitleGlitch } from './render/viewport.js';
import { renderAudioControls, setSfxVol, setBgmVol } from './settings.js';
import { renderStats }                   from './stats.js';
import { initNarrative }                 from './narrative/index.js';

// Slider inputs aren't click events — keep them on the element directly.
document.getElementById('sfx-slider').addEventListener('input', e => setSfxVol(e.target.value / 100));
document.getElementById('bgm-slider').addEventListener('input', e => setBgmVol(e.target.value / 100));

installDelegation(document.body);
wireRenderToBus();
initNarrative();

renderAudioControls();
renderStats();

newGame();              // emits game.started → render kicks in via bus
renderAll();            // initial paint (covers anything subscribed-after)
fitToViewport();
startTitleGlitch();
