"""Write assets/map-sharp.webp: the painting with a gentle, darken-only unsharp mask,
same size as assets/map.webp (2464 x 1856, ~18 MB decoded), so ink lines hold up when
the camera magnifies the map 2-3.5x. Darken-only means highlights and the paper tone
of the snow are untouched (no white halos). Usage: python tools/gen_map_sharp.py"""
import os
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(ROOT, 'ref', 'map.png')).convert('L')   # strictly monochrome
sharp = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=80, threshold=1))
a, b = np.asarray(im), np.asarray(sharp)
out_a = np.minimum(a, b)
print('pure white: before %.2f%%, after %.2f%%' % ((a >= 255).mean() * 100, (out_a >= 255).mean() * 100))
out = os.path.join(ROOT, 'assets', 'map-sharp.webp')
Image.fromarray(out_a).convert('RGB').save(out, 'WEBP', quality=88, method=6)
print('wrote', out, os.path.getsize(out), 'bytes')
