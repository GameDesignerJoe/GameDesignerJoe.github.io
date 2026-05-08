// ══════════════════════════════════════════════
// kill.code — render/viewport.js
// Viewport scaling + the title-glitch flash effect.
// Display-only; no game state.
// ══════════════════════════════════════════════

export function fitToViewport(){
  const wrap = document.getElementById('scale-wrap');
  if(!wrap) return;
  const w  = wrap.offsetWidth, h  = wrap.offsetHeight;
  if(!w || !h) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / w, vh / h, 2.4);
  wrap.style.transform = `scale(${scale})`;
}

window.addEventListener('resize',            fitToViewport);
window.addEventListener('orientationchange', fitToViewport);

// Title language cycle — kanji is the default; briefly flash 'kill' for ~2s every 24s.
// First swap rides the CSS title-glitch (7.3s); the swap-back rides a programmatic flicker.
export function startTitleGlitch(){
  const titleH1  = document.querySelector('.game-hdr h1');
  const killSpan = document.getElementById('title-kill');
  if(!titleH1 || !killSpan) return;
  const KANJI = 'キル', ENG = 'kill';

  const flicker = () => titleH1.animate([
    { textShadow: '0 0 18px #c9a84c88, 0 0 50px #c9a84c33', letterSpacing: '.28em' },
    { textShadow: '-3px 0 #ff003caa, 3px 0 #00fff9aa',       letterSpacing: '.26em' },
    { textShadow: '3px 0 #ff003caa, -3px 0 #00fff9aa',       letterSpacing: '.30em' },
    { textShadow: '0 0 18px #c9a84c88, 0 0 50px #c9a84c33', letterSpacing: '.28em' },
  ], { duration: 200, easing: 'steps(4, end)', composite: 'replace' });

  const flashKill = () => {
    killSpan.textContent = ENG;            // masked by the current CSS glitch peak
    setTimeout(() => {
      flicker();
      setTimeout(() => { killSpan.textContent = KANJI; }, 50);
    }, 2200);
  };

  setTimeout(function tick(){
    flashKill();
    setTimeout(tick, 24000);                // 24s = 3 glitch beats; keeps swap-in aligned
  }, 7300);
}
