"""Build the crisp hi-res tile pyramid level used by js/world/map.js when zoomed in.

    python tools/gen_tiles.py            # all tiles
    python tools/gen_tiles.py 10 12 3 2  # only tiles tx0 ty0 w h (for tests)

Technique (one level, 4x):
  1. The painting (ref/map.png, else assets/map.webp) is cut into 128 map-px chunks with
     a 12 px apron, and each chunk is upscaled 4x with Real-ESRGAN
     realesr-animevideov3 (ncnn/Vulkan): crisp ink lines, greys preserved.
  2. Only its high frequencies are kept: low frequencies (the flat greys and soft
     cel shading) come from a Lanczos 4x of the original, so tones match the 1x base
     exactly and nothing turns flat white.
  3. Near long ink strokes (detected at 1x: solid dark ink >= 12 px long; dot chains don't count) use 60% that
     + 40% sharpened Lanczos. Everywhere else - stipple, clustered dots - uses
     sharpened Lanczos only, since ESRGAN joins dots into cursive "worms".
  4. Clamped to the local Lanczos max (no white halos) and the darkest ink lifted
     ~14 levels so the ground's line weight sits with the hand-drawn actors.
  5. Saved as 520x520 greyscale WebP tiles: 512 px core (= 128 map px) plus a 4 px
     gutter of real neighbouring pixels on every side, so map.js can overlap tiles by a
     pixel and never show seams. Edge tiles are smaller.
Output: assets/tiles/4/<tx>_<ty>.webp
"""
import os
import shutil
import subprocess
import sys
import tempfile
import numpy as np
from PIL import Image, ImageFilter
from imgops import label, box_mean

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'ref', 'map.png')
if not os.path.exists(SRC):
    SRC = os.path.join(ROOT, 'assets', 'map.webp')
EXE = os.environ.get('ESRGAN', r'C:\Users\GameD\nas-tools\esrgan\realesrgan-ncnn-vulkan.exe')
MODEL = 'realesr-animevideov3'
SCALE = 4
TILE = 128          # map px per tile
APRON = 12          # map px of context around each chunk for the upscaler / blurs
GUTTER = 4          # output px of overlap kept on each side of a tile
QUALITY = 84
INK_LIFT = 14       # levels added at pure black, fading to 0 at white
OUT = os.path.join(ROOT, 'assets', 'tiles', str(SCALE))


def blur(a, r):
    return np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(r))).astype(np.float32)


def _filt(a, f):
    return np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(f)).astype(np.float32)


def line_weight(chunk):
    """Per-pixel 0..1 (at 1x): 1 near long ink strokes (outlines, shorelines, cliff
    hatching), where ESRGAN shines; 0 over stipple and small clustered dots, which it
    joins into cursive "worms"."""
    L = chunk.astype(np.float32)
    bg = _filt(L, ImageFilter.MaxFilter(5))
    # Strict ink threshold: dotted / dashed chains are joined by faint grey bridges at
    # looser thresholds and would pass as strokes; at -70 they break into dots.
    ink = L < bg - 70
    lab, sizes = label(ink)
    ys, xs = np.nonzero(lab)
    ll = lab[ys, xs]
    n = len(sizes)
    minx = np.full(n, 1e9); maxx = np.zeros(n); miny = np.full(n, 1e9); maxy = np.zeros(n)
    np.minimum.at(minx, ll, xs); np.maximum.at(maxx, ll, xs)
    np.minimum.at(miny, ll, ys); np.maximum.at(maxy, ll, ys)
    ext = np.maximum(maxx - minx, maxy - miny) + 1
    long_ = (ext >= 12) & (sizes >= 16)
    long_[0] = False
    m = long_[lab].astype(np.float32) * 255
    return _filt(m, ImageFilter.MaxFilter(5)) / 255


def combine(orig_chunk, esr):
    """orig_chunk: L uint8 (h, w); esr: L float (4h, 4w) from the upscaler."""
    h, w = orig_chunk.shape
    size = (w * SCALE, h * SCALE)
    lan = np.asarray(Image.fromarray(orig_chunk).resize(size, Image.LANCZOS)).astype(np.float32)
    # Ink from ESRGAN, tone from Lanczos.
    mix = esr - blur(esr, 6) + blur(lan, 6)
    # A sharpened Lanczos keeps every stipple dot (ESRGAN joins them into "worms").
    lan_s = _filt(lan, ImageFilter.UnsharpMask(3, 120, 2))
    lines = 0.6 * mix + 0.4 * lan_s                     # long ink: mostly ESRGAN
    dots = _filt(lan, ImageFilter.UnsharpMask(2, 160, 1))  # stipple fields: Lanczos only
    wgt = line_weight(orig_chunk)
    wgt = np.asarray(Image.fromarray((wgt * 255).astype(np.uint8)).resize(size, Image.BILINEAR)
                     .filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
    out = lines * wgt + dots * (1 - wgt)
    # No white halos: never brighter than the brightest nearby Lanczos pixel.
    out = np.minimum(out, _filt(lan, ImageFilter.MaxFilter(5)))
    # Lift the darkest ink a little so the ground sits with the actors' line weight.
    out = out + INK_LIFT * (1 - out / 255)
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    src = np.asarray(Image.open(SRC).convert('L'))
    H, W = src.shape
    padded = np.pad(src, APRON, mode='edge')
    ntx, nty = (W + TILE - 1) // TILE, (H + TILE - 1) // TILE
    sel = [int(v) for v in sys.argv[1:5]] if len(sys.argv) >= 5 else [0, 0, ntx, nty]
    tiles = [(tx, ty) for ty in range(sel[1], min(nty, sel[1] + sel[3]))
             for tx in range(sel[0], min(ntx, sel[0] + sel[2]))]
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='nas-tiles-')
    din, dout = os.path.join(tmp, 'in'), os.path.join(tmp, 'out')
    os.makedirs(din); os.makedirs(dout)
    try:
        chunks = {}
        for tx, ty in tiles:
            x0, y0 = tx * TILE, ty * TILE
            c = padded[y0:y0 + TILE + 2 * APRON, x0:x0 + TILE + 2 * APRON]
            if c.shape != (TILE + 2 * APRON, TILE + 2 * APRON):  # right / bottom edge
                c = np.pad(c, ((0, TILE + 2 * APRON - c.shape[0]), (0, TILE + 2 * APRON - c.shape[1])), mode='edge')
            chunks[(tx, ty)] = c
            Image.fromarray(c).convert('RGB').save(os.path.join(din, f'{tx}_{ty}.png'))
        print(f'upscaling {len(tiles)} chunks with {MODEL} x{SCALE} ...', flush=True)
        subprocess.run([EXE, '-i', din, '-o', dout, '-n', MODEL, '-s', str(SCALE), '-f', 'png'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        total = 0
        for tx, ty in tiles:
            esr = np.asarray(Image.open(os.path.join(dout, f'{tx}_{ty}.png')).convert('L')).astype(np.float32)
            out = combine(chunks[(tx, ty)], esr)
            # Core size in map px (edge tiles are smaller), then crop core + gutter.
            cw, ch = min(TILE, W - tx * TILE), min(TILE, H - ty * TILE)
            a = APRON * SCALE - GUTTER
            tile = out[a:a + ch * SCALE + 2 * GUTTER, a:a + cw * SCALE + 2 * GUTTER]
            p = os.path.join(OUT, f'{tx}_{ty}.webp')
            Image.fromarray(tile).convert('RGB').save(p, 'WEBP', quality=QUALITY, method=6)
            total += os.path.getsize(p)
        print(f'wrote {len(tiles)} tiles to {OUT}, {total / 1e6:.1f} MB')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
