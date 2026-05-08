// ══════════════════════════════════════════════
// kill.code — narrative/presenter.js
// Owns the dialogue overlay DOM and the advance-on-click flow.
// While a scene is up, engine input is blocked via the 'narrative' phase;
// on dismiss, presenter applies scene.effects(state, fx) and pops the phase.
// ══════════════════════════════════════════════

import { state }       from '../state.js';
import { fx }          from '../effects.js';
import { enterPhase }  from '../phases.js';
import { getPortrait } from './portraits.js';

let _overlay = null;

function ensureOverlay(){
  if(_overlay) return _overlay;
  _overlay = document.createElement('div');
  _overlay.id = 'narrative-fx';
  _overlay.style.cssText = `
    position:fixed; inset:0; z-index:1100;
    display:none; align-items:center; justify-content:center;
    background:rgba(6,9,8,.78);
    backdrop-filter: blur(4px);
    pointer-events:auto;
    cursor:pointer;
  `;
  _overlay.innerHTML = `
    <div id="narrative-card" style="
      max-width:520px; padding:18px 22px;
      background:var(--bg1);
      clip-path:var(--clip-lg);
      filter:drop-shadow(0 0 1px var(--border2)) drop-shadow(0 4px 12px rgba(0,0,0,.6));
      font-family:'Share Tech Mono', monospace;
      color:var(--text2);
    ">
      <div id="narrative-speaker" style="
        font-size:11px; letter-spacing:.28em; text-transform:uppercase;
        margin-bottom:8px;
      "></div>
      <div id="narrative-text" style="font-size:14px; line-height:1.55;"></div>
      <div style="
        margin-top:12px; font-size:10px; letter-spacing:.18em;
        color:var(--text3); text-align:right; text-transform:uppercase;
      ">▸ click to continue</div>
    </div>`;
  document.body.appendChild(_overlay);
  return _overlay;
}

export function runScene(scene, onComplete){
  const overlay  = ensureOverlay();
  const speakerEl = overlay.querySelector('#narrative-speaker');
  const textEl    = overlay.querySelector('#narrative-text');
  const dialogue  = scene.dialogue ?? [];

  enterPhase('narrative', { returnTo: state.phase });
  overlay.style.display = 'flex';

  let i = 0;
  const showLine = () => {
    if(i >= dialogue.length){
      // Scene over: apply effects, hide overlay, pop phase.
      overlay.style.display = 'none';
      try { scene.effects?.(state, fx); } catch(e){ console.error('[scene.effects]', scene.id, e); }
      enterPhase(state.phaseReturn ?? 'play-card');
      onComplete?.();
      return;
    }
    const line = dialogue[i++];
    const portrait = getPortrait(line.speaker);
    speakerEl.innerHTML = `<span style="color:${portrait.colour}">${portrait.glyph} ${portrait.name}</span>`;
    const lines = Array.isArray(line.lines) ? line.lines.join('<br>') : (line.lines ?? '');
    textEl.innerHTML = lines;
  };

  const advance = (e) => {
    e?.stopPropagation?.();
    showLine();
  };

  // Replace any prior listener.
  overlay.onclick = advance;

  // Show first line immediately.
  showLine();
}
