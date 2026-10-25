// Runs the climbing / plateau analysis off the main thread so painting stays smooth.
// terrain.js expects a window and a document (for loading its PNGs), so give it just
// enough of both: Image loads through fetch + createImageBitmap, canvases are
// OffscreenCanvas. Relative asset URLs resolve from the game folder (?base=...).
const base = new URL(self.location.href).searchParams.get('base');
self.window = self;
class WorkerImage {
  set src(u) {
    fetch(new URL(u, base))
      .then(r => (r.ok ? r.blob() : null))
      .then(b => (b ? createImageBitmap(b) : null))
      .then(bmp => {
        if (!bmp) return this.onerror && this.onerror();
        this.bmp = bmp; this.width = bmp.width; this.height = bmp.height;
        this.onload && this.onload();
      })
      .catch(() => this.onerror && this.onerror());
  }
}
self.Image = WorkerImage;
self.document = { createElement: () => new OffscreenCanvas(1, 1) };
const draw = OffscreenCanvasRenderingContext2D.prototype.drawImage;
OffscreenCanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
  return draw.call(this, img instanceof WorkerImage ? img.bmp : img, ...a);
};

let ready = null;
self.onmessage = async e => {
  try {
    ready = ready || (async () => {
      const terrain = await import('../js/world/terrain.js');
      const { computeRoutes } = await import('./routes.js');
      await terrain.init();
      return { terrain, computeRoutes };
    })();
    const { terrain, computeRoutes } = await ready;
    const t0 = performance.now();
    const r = computeRoutes(terrain, e.data.cls);
    self.postMessage({ id: e.data.id, codes: r.codes, spawnInRock: r.spawnInRock, ms: performance.now() - t0 }, [r.codes.buffer]);
  } catch (err) {
    self.postMessage({ id: e.data.id, error: String(err && err.message || err) });
  }
};
