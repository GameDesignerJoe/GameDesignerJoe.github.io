r"""Crop Vye card faces down to just the illustration, square, for Vye Duel tiles.

Usage (Windows, from the vye_duel folder):
    python tools\crop_art.py path\to\card.jpg art\lands\birchwood.jpg
    python tools\crop_art.py path\to\folder_of_cards  out_folder

Needs Python 3 with Pillow and NumPy:  pip install pillow numpy
The tiles just need a square image, so any square .jpg or .png saved with
the right file name also works without this script.
"""
import sys, os
import numpy as np
from PIL import Image

SIZE = 320          # output pixels; tiles show at most ~86px, x2 for sharp phones
MAX_Y = 0.83        # ignore the bottom of the card (title and artist credit)


def crop_card(src, dst, top=0.14):
    """top: fraction of the card height to ignore at the top (use ~0.05 for tall Family art)."""
    im = Image.open(src).convert('RGB')
    a = np.asarray(im, dtype=np.int16)
    h, w, _ = a.shape
    # parchment colour = median of a strip down the card's left inner margin
    strip = a[int(h * .25):int(h * .75), int(w * .09):int(w * .12)].reshape(-1, 3)
    bg = np.median(strip, axis=0)
    diff = np.abs(a - bg).sum(axis=2)
    mask = diff > 70
    # ignore everything outside the card's inner art panel: frame lines, type logo, title
    mask[:int(h * top), :] = False
    mask[int(h * MAX_Y):, :] = False
    mask[:, :int(w * .13)] = False
    mask[:, int(w * .87):] = False
    mask[:int(h * .25), :int(w * .29)] = False
    rows = np.where(mask.sum(axis=1) > 10)[0]
    cols = np.where(mask.sum(axis=0) > 10)[0]
    if len(rows) == 0 or len(cols) == 0:
        out = im
    else:
        y0, y1, x0, x1 = rows[0], rows[-1], cols[0], cols[-1]
        pad = int(max(x1 - x0, y1 - y0) * 0.03)
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(w, x1 + pad), min(h, y1 + pad)
        art = im.crop((x0, y0, x1, y1))
        side = max(art.size)
        # fill the rest of the square with plain parchment, so the card logo and frame never show
        out = Image.new('RGB', (side, side), tuple(int(c) for c in bg))
        out.paste(art, ((side - art.size[0]) // 2, (side - art.size[1]) // 2))
    out = out.resize((SIZE, SIZE), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    out.save(dst, quality=86, optimize=True)


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    if os.path.isdir(src):
        for f in sorted(os.listdir(src)):
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                crop_card(os.path.join(src, f), os.path.join(dst, os.path.splitext(f)[0] + '.jpg'))
    else:
        crop_card(src, dst)
