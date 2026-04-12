import * as state from './state.js';

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
  ctx.fillStyle = '#333';
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
  const stringLabels = ['E', 'B', 'G', 'D', 'A', 'E'];
  for (let s = 0; s < 6; s++) {
    const y = startY + s * stringSpacing;
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 1.5 + (s * 0.4);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(startX + 12 * fretWidth, y);
    ctx.stroke();

    ctx.fillStyle = '#8888aa';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stringLabels[s], padding - 12, y);
  }

  // Note dots
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < state.FRET_COUNT; f++) {
      if (!board.grid[s][f]) continue;

      const x = f === 0 ? padding + openWidth / 2 : startX + (f - 0.5) * fretWidth;
      const y = startY + s * stringSpacing;
      const isRoot = state.isRoot(s, f, board.key);

      ctx.fillStyle = isRoot ? '#e94560' : '#0f9b8e';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();

      if (board.labelMode !== 'none') {
        const label = board.labelMode === 'intervals'
          ? state.intervalName(s, f, board.key)
          : state.noteName(s, f);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);
      }
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

  // Render each board
  const rendered = boards.map(b => renderBoardToCanvas(b, canvasWidth));
  const totalHeight = rendered.reduce((sum, r) => sum + r.height, 0) + gap * (rendered.length - 1);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Stack boards
  let y = 0;
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
