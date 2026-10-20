// Small polyfills for older mobile browsers (iOS 15 lacks roundRect).

function roundRect(x, y, w, h, r = 0) {
  const rr = Math.max(0, Math.min(typeof r === 'number' ? r : r?.[0] ?? 0, w / 2, h / 2));
  this.moveTo(x + rr, y);
  this.arcTo(x + w, y, x + w, y + h, rr);
  this.arcTo(x + w, y + h, x, y + h, rr);
  this.arcTo(x, y + h, x, y, rr);
  this.arcTo(x, y, x + w, y, rr);
  this.closePath();
}

if (typeof Path2D !== 'undefined' && !Path2D.prototype.roundRect) Path2D.prototype.roundRect = roundRect;
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = roundRect;
}
