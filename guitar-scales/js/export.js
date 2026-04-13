import * as state from './state.js';
import * as chords from './chords.js';
import * as themes from './themes.js';

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2000);
}

// Render a single board to canvas, return { canvas, height }
// Convert a hex color to rgba with given alpha
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const v = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getPalette() {
  const t = themes.getTheme(state.settings.theme);
  return t.colors;
}

function renderBoardToCanvas(board, canvasWidth) {
  const padding = 30;
  const lefty = state.isLefty();
  const upside = state.isUpsideDown();
  const hasOpen = board.fretLo === 0;
  const pal = getPalette();
  const openWidth = hasOpen ? 40 : 0;
  const numberedFrets = hasOpen ? (board.fretHi - board.fretLo) : (board.fretHi - board.fretLo + 1);
  const fretWidth = (canvasWidth - padding * 2 - openWidth) / numberedFrets;
  const stringSpacing = 36;
  const hasCaption = board.caption.length > 0;
  const captionHeight = hasCaption ? 36 : 0;
  const boardHeight = stringSpacing * 5 + padding * 2 + 30 + captionHeight;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = boardHeight;
  const ctx = canvas.getContext('2d');

  // Transparent background (composited later)
  ctx.clearRect(0, 0, canvasWidth, boardHeight);

  // Caption
  if (hasCaption) {
    ctx.fillStyle = pal.text;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(board.caption, canvasWidth / 2, 10);
  }

  // For righty: numbered frets start at padding+openWidth (left)
  // For lefty: numbered frets start at padding (left), open fret sits on the right
  const startX = lefty ? padding : padding + openWidth;
  const openX = lefty ? padding + numberedFrets * fretWidth + openWidth / 2 : padding + openWidth / 2;
  const startY = padding + captionHeight;

  // Fret wires
  for (let i = 0; i <= numberedFrets; i++) {
    const x = startX + i * fretWidth;
    // Nut is the fret wire adjacent to the open area
    const isNut = hasOpen && ((!lefty && i === 0) || (lefty && i === numberedFrets));
    ctx.lineWidth = isNut ? 4 : 2;
    ctx.strokeStyle = isNut ? pal['nut-color'] : pal['fret-wire'];
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, startY + stringSpacing * 5);
    ctx.stroke();
  }

  // Inlay dots
  const singleInlays = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubleInlays = [12, 24];
  ctx.fillStyle = pal.inlay;

  // Helper to convert absolute fret to canvas X
  function fretX(fret) {
    if (hasOpen && fret === 0) return openX;
    const numberedIdx = hasOpen ? (fret - 1) : (fret - board.fretLo);
    if (lefty) {
      return startX + (numberedFrets - 1 - numberedIdx + 0.5) * fretWidth;
    }
    return startX + (numberedIdx + 0.5) * fretWidth;
  }

  // Helper to convert string index (0=high e, 5=low E) to canvas Y.
  // Upside-down mode flips the visual row vertically.
  function stringY(s) {
    const row = upside ? (5 - s) : s;
    return startY + row * stringSpacing;
  }

  for (const f of singleInlays) {
    if (f < board.fretLo || f > board.fretHi) continue;
    const x = fretX(f);
    ctx.beginPath();
    ctx.arc(x, startY + 2.5 * stringSpacing, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of doubleInlays) {
    if (f < board.fretLo || f > board.fretHi) continue;
    const x = fretX(f);
    ctx.beginPath(); ctx.arc(x, startY + 1.5 * stringSpacing, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, startY + 3.5 * stringSpacing, 8, 0, Math.PI * 2); ctx.fill();
  }

  // Strings
  const stringLabels = ['e', 'B', 'G', 'D', 'A', 'E'];
  // String extends across the full playable area (includes open column)
  const stringLeft = lefty ? startX : (hasOpen ? padding : startX);
  const stringRight = lefty
    ? startX + numberedFrets * fretWidth + openWidth
    : startX + numberedFrets * fretWidth;
  // String labels sit on the left side for righty, right side for lefty.
  // Keep labels inside the canvas: righty uses left margin, lefty uses right margin.
  const labelCenterX = lefty ? (canvasWidth - padding + 12) : (padding - 12);
  const labelXOffset = lefty ? 6 : -6; // offset for mute X relative to letter
  const letterXOffset = lefty ? -6 : 6;

  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    const isMuted = board.muted[s];

    ctx.globalAlpha = isMuted ? 0.2 : 1;
    ctx.strokeStyle = pal['string-color'];
    ctx.lineWidth = 2.5 + (s * 0.5);
    ctx.beginPath();
    ctx.moveTo(stringLeft, y);
    ctx.lineTo(stringRight, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // String label + mute X
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isMuted) {
      ctx.fillStyle = hexToRgba(pal.muted, 0.35);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(stringLabels[s], labelCenterX + letterXOffset, y);
      ctx.fillStyle = pal.accent;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('X', labelCenterX + labelXOffset, y);
    } else {
      ctx.fillStyle = pal.muted;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(stringLabels[s], labelCenterX, y);
    }
  }

  // Compute overlay grid
  const overlayGrid = board.overlay ? chords.computeOverlayGrid(board.overlay) : null;

  // Note dots + overlay dots
  for (let s = 0; s < 6; s++) {
    for (let f = board.fretLo; f <= board.fretHi; f++) {
      const isActive = board.grid[s][f];
      const isOverlay = overlayGrid && overlayGrid[s][f];
      if (!isActive && !isOverlay) continue;

      const x = fretX(f);
      const y = stringY(s);

      ctx.globalAlpha = board.muted[s] ? 0.25 : 1;

      if (isActive) {
        const isRoot = state.isRoot(s, f, board.key);
        ctx.fillStyle = isRoot ? pal['root-color'] : pal['note-color'];
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Overlay ring on scale dots that match the chord
        if (isOverlay) {
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        const finger = board.fingers[s][f];
        if (finger > 0) {
          ctx.fillStyle = pal['dot-text'];
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(finger.toString(), x, y);
        } else if (board.labelMode !== 'none') {
          const label = board.labelMode === 'intervals'
            ? state.intervalName(s, f, board.key)
            : state.noteName(s, f);
          ctx.fillStyle = pal['dot-text'];
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y);
        }
      } else if (isOverlay) {
        // Overlay-only: hollow dot
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();

        if (board.labelMode !== 'none') {
          const label = board.labelMode === 'intervals'
            ? state.intervalName(s, f, board.key)
            : state.noteName(s, f);
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // Sequence lines — drawn bold and on top
  if (board.labelMode === 'sequence' && board.sequence.length >= 2) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1;
    for (let i = 0; i < board.sequence.length - 1; i++) {
      const from = board.sequence[i];
      const to = board.sequence[i + 1];
      const x1 = fretX(from.f);
      const y1 = stringY(from.s);
      const x2 = fretX(to.f);
      const y2 = stringY(to.s);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Fret numbers
  ctx.fillStyle = pal.muted;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  const firstNum = hasOpen ? 1 : board.fretLo;
  for (let f = firstNum; f <= board.fretHi; f++) {
    const x = fretX(f);
    ctx.fillText(f.toString(), x, startY + 5 * stringSpacing + 20);
  }

  return { canvas, height: boardHeight };
}

// Composite all export boards into one canvas
function renderToCanvas() {
  const boards = state.getExportBoards();
  const canvasWidth = 960;
  const gap = 16;
  const hasPageTitle = state.pageTitle.length > 0;
  const pageTitleHeight = hasPageTitle ? 44 : 0;

  // Render each board
  const rendered = boards.map(b => renderBoardToCanvas(b, canvasWidth));
  const totalHeight = pageTitleHeight + rendered.reduce((sum, r) => sum + r.height, 0) + gap * (rendered.length - 1);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  const pal = getPalette();

  // Background
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Page title
  let y = 0;
  if (hasPageTitle) {
    ctx.fillStyle = pal.text;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(state.pageTitle, canvasWidth / 2, 12);
    y = pageTitleHeight;
  }

  // Stack boards
  for (const { canvas: boardCanvas, height } of rendered) {
    ctx.drawImage(boardCanvas, 0, y);
    y += height + gap;
  }

  return canvas;
}

export async function copyToClipboard() {
  const canvas = renderToCanvas();
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    showToast('Image copied to clipboard!');
  } catch (e) {
    showToast('Copy failed — try Download PNG instead');
    console.error(e);
  }
}

export function downloadPng() {
  const canvas = renderToCanvas();
  const link = document.createElement('a');
  link.download = 'guitar_scales.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('PNG downloaded!');
}

export function printPdf() {
  window.print();
}

export function shareUrl() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('URL copied to clipboard!');
  }).catch(() => {
    showToast('Could not copy URL');
  });
}
