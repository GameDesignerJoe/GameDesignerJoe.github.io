import * as state from './state.js';
import * as chords from './chords.js';

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
function renderBoardToCanvas(board, canvasWidth) {
  const padding = 30;
  const fretWidth = (canvasWidth - padding * 2 - 40) / 12; // 40 = openWidth
  const openWidth = 40;
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
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(board.caption, canvasWidth / 2, 10);
  }

  const startX = padding + openWidth;
  const startY = padding + captionHeight;

  // Fret wires
  for (let f = 0; f <= 12; f++) {
    const x = startX + f * fretWidth;
    ctx.lineWidth = f === 0 ? 4 : 2;
    ctx.strokeStyle = f === 0 ? '#ddd' : '#555';
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, startY + stringSpacing * 5);
    ctx.stroke();
  }

  // Inlay dots
  const inlayFrets = [3, 5, 7, 9];
  ctx.fillStyle = '#ffffff';
  for (const f of inlayFrets) {
    const x = startX + (f - 0.5) * fretWidth;
    ctx.beginPath();
    ctx.arc(x, startY + 2.5 * stringSpacing, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const x12 = startX + 11.5 * fretWidth;
  ctx.beginPath(); ctx.arc(x12, startY + 1.5 * stringSpacing, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x12, startY + 3.5 * stringSpacing, 4, 0, Math.PI * 2); ctx.fill();

  // Strings
  const stringLabels = ['e', 'B', 'G', 'D', 'A', 'E'];
  for (let s = 0; s < 6; s++) {
    const y = startY + s * stringSpacing;
    const isMuted = board.muted[s];

    ctx.globalAlpha = isMuted ? 0.2 : 1;
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 1.5 + (s * 0.4);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(startX + 12 * fretWidth, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // String label + mute X
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isMuted) {
      ctx.fillStyle = 'rgba(136,136,170,0.35)';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(stringLabels[s], padding - 18, y);
      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('X', padding - 6, y);
    } else {
      ctx.fillStyle = '#8888aa';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(stringLabels[s], padding - 12, y);
    }
  }

  // Compute overlay grid
  const overlayGrid = board.overlay ? chords.computeOverlayGrid(board.overlay) : null;

  // Note dots + overlay dots
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < state.FRET_COUNT; f++) {
      const isActive = board.grid[s][f];
      const isOverlay = overlayGrid && overlayGrid[s][f];
      if (!isActive && !isOverlay) continue;

      const x = f === 0 ? padding + openWidth / 2 : startX + (f - 0.5) * fretWidth;
      const y = startY + s * stringSpacing;

      ctx.globalAlpha = board.muted[s] ? 0.25 : 1;

      if (isActive) {
        const isRoot = state.isRoot(s, f, board.key);
        ctx.fillStyle = isRoot ? '#e94560' : '#0f9b8e';
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
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(finger.toString(), x, y);
        } else if (board.labelMode !== 'none') {
          const label = board.labelMode === 'intervals'
            ? state.intervalName(s, f, board.key)
            : state.noteName(s, f);
          ctx.fillStyle = '#fff';
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

  // Fret numbers
  ctx.fillStyle = '#8888aa';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (let f = 1; f <= 12; f++) {
    const x = startX + (f - 0.5) * fretWidth;
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

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Page title
  let y = 0;
  if (hasPageTitle) {
    ctx.fillStyle = '#e0e0e0';
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
