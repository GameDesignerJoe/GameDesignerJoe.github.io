// The painted map is the world. Draws only the visible part of it.
import { state } from '../state.js';
import { visibleRect } from '../camera.js';

let img = null;

export function init() {
  return new Promise(res => {
    img = new Image();
    img.onload = res;
    img.onerror = res;
    img.src = 'assets/map-sharp.webp';
  });
}

export function drawGround(ctx) {
  if (!img?.complete) return;
  const r = visibleRect(4);
  const x0 = Math.max(0, Math.floor(r.x0)), y0 = Math.max(0, Math.floor(r.y0));
  const x1 = Math.min(img.width, Math.ceil(r.x1)), y1 = Math.min(img.height, Math.ceil(r.y1));
  if (x1 <= x0 || y1 <= y0) return;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
}

export function mapImage() { return img; }
