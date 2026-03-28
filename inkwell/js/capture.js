import { transcribePage } from './api.js';
import { addPage } from './transcript.js';
import { updateStatusPill, updatePageCounter, showError } from './ui.js';
import { playBeep, flashCropGuide } from './feedback.js';

let videoEl = null;
let scanning = false;
let lastFailedImage = null;

// Full-res capture canvas
const captureCanvas = document.createElement('canvas');
const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

// --- Public API ---

export function init(video) {
    videoEl = video;
    updateStatusPill('Ready — tap Scan', null);
}

export function teardown() {
    videoEl = null;
    scanning = false;
    lastFailedImage = null;
}

export async function scanPage() {
    if (scanning || !videoEl) return;
    scanning = true;

    updateStatusPill('Scanning…', 'scanning');

    // Get crop guide bounds relative to the video
    const cropGuide = document.getElementById('crop-guide');
    const viewport = document.querySelector('.scan-viewport');
    const viewRect = viewport.getBoundingClientRect();
    const guideRect = cropGuide.getBoundingClientRect();

    // Calculate crop region as fractions of the viewport
    const left = (guideRect.left - viewRect.left) / viewRect.width;
    const top = (guideRect.top - viewRect.top) / viewRect.height;
    const width = guideRect.width / viewRect.width;
    const height = guideRect.height / viewRect.height;

    // Map fractions to actual video resolution
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const sx = Math.round(left * vw);
    const sy = Math.round(top * vh);
    const sw = Math.round(width * vw);
    const sh = Math.round(height * vh);

    // Draw only the cropped region
    captureCanvas.width = sw;
    captureCanvas.height = sh;
    captureCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, sw, sh);

    // Basic contrast enhancement
    enhanceContrast(captureCtx, sw, sh);

    // Convert to JPEG base64
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];

    await doCapture(base64);
}

async function doCapture(base64) {
    lastFailedImage = null;

    const result = await transcribePage(base64);

    scanning = false;

    if (result.error || !result.text) {
        lastFailedImage = base64;
        updateStatusPill('⚠ Scan failed', 'error');
        showError(
            result.error || 'No text returned',
            () => {
                // Retry: re-send the same image
                scanning = true;
                updateStatusPill('Scanning…', 'scanning');
                doCapture(lastFailedImage);
            },
            () => {
                // Skip: discard and go back to ready
                lastFailedImage = null;
                updateStatusPill('Ready — tap Scan', null);
            }
        );
        return;
    }

    // Success
    const count = addPage(result.text);
    updatePageCounter(count);
    playBeep();
    flashCropGuide();
    updateStatusPill('✓ Done', 'done');

    // Return to ready after brief feedback
    setTimeout(() => {
        updateStatusPill('Ready — tap Scan', null);
    }, 1500);
}

// --- Contrast Enhancement ---

function enhanceContrast(ctx, w, h) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < min) min = lum;
        if (lum > max) max = lum;
    }

    const range = max - min;
    if (range < 30) return;

    const adjMin = min + range * 0.05;
    const adjMax = max - range * 0.05;
    const adjRange = adjMax - adjMin;
    if (adjRange <= 0) return;

    const scale = 255 / adjRange;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp((data[i] - adjMin) * scale);
        data[i + 1] = clamp((data[i + 1] - adjMin) * scale);
        data[i + 2] = clamp((data[i + 2] - adjMin) * scale);
    }

    ctx.putImageData(imageData, 0, 0);
}

function clamp(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
