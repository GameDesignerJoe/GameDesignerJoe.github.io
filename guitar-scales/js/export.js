import * as state from './state.js';
import { getLabelMode } from './fretboard.js';

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

// Render the fretboard to an offscreen canvas and return it
function renderToCanvas() {
  const padding = 30;
  const fretWidth = 70;
  const openWidth = 40;
  const stringSpacing = 36;
  const hasCaption = state.caption.length > 0;
  const captionHeight = hasCaption ? 36 : 0;
  const totalWidth = openWidth + fretWidth * 12 + padding * 2;
  const totalHeight = stringSpacing * 5 + padding * 2 + 30 + captionHeight;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Caption
  if (hasCaption) {
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(state.caption, totalWidth / 2, 10);
  }

  const startX = padding + openWidth;
  const startY = padding + captionHeight;

  // Draw fret wires
  ctx.strokeStyle = '#555';
  for (let f = 0; f <= 12; f++) {
    const x = startX + f * fretWidth;
    ctx.lineWidth = f === 0 ? 4 : 2;
    ctx.strokeStyle = f === 0 ? '#ddd' : '#555';
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, startY + stringSpacing * 5);
    ctx.stroke();
  }

  // Draw inlay dots
  const inlayFrets = [3, 5, 7, 9];
  ctx.fillStyle = '#333';
  for (const f of inlayFrets) {
    const x = startX + (f - 0.5) * fretWidth;
    const y = startY + 2.5 * stringSpacing;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Double dot at 12
  const x12 = startX + 11.5 * fretWidth;
  ctx.beginPath(); ctx.arc(x12, startY + 1.5 * stringSpacing, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x12, startY + 3.5 * stringSpacing, 4, 0, Math.PI * 2); ctx.fill();

  // Draw strings
  const stringLabels = ['E', 'B', 'G', 'D', 'A', 'E'];
  for (let s = 0; s < 6; s++) {
    const y = startY + s * stringSpacing;
    const thickness = 1.5 + (s * 0.4);
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(startX + 12 * fretWidth, y);
    ctx.stroke();

    // String label
    ctx.fillStyle = '#8888aa';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stringLabels[s], padding - 12, y);
  }

  // Draw note dots
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < state.FRET_COUNT; f++) {
      if (!state.grid[s][f]) continue;

      let x;
      if (f === 0) {
        x = padding + openWidth / 2;
      } else {
        x = startX + (f - 0.5) * fretWidth;
      }
      const y = startY + s * stringSpacing;
      const isRoot = state.isRoot(s, f);

      ctx.fillStyle = isRoot ? '#e94560' : '#0f9b8e';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();

      // Label
      const mode = getLabelMode();
      if (mode !== 'none') {
        const label = mode === 'intervals' ? state.intervalName(s, f) : state.noteName(s, f);
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
  const keyName = state.NOTE_NAMES[state.currentKey];
  const scaleName = state.currentScale || 'Custom';
  link.download = `${keyName}_${scaleName.replace(/\s+/g, '_')}_scale.png`;
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
