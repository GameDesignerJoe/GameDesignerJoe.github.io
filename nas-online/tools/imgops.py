"""Tiny image-op helpers on numpy arrays (Pillow + numpy only, no scipy)."""
from collections import deque
import numpy as np
from PIL import Image, ImageFilter


def box_mean(a, r):
    """Mean over a (2r+1)^2 window, edge-clamped. a: 2D float array."""
    a = np.pad(a.astype(np.float64), r + 1, mode='edge')
    c = a.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return (s / (k * k))[:a.shape[0] - 2 * r - 2, :a.shape[1] - 2 * r - 2]


def _pil(m):
    return Image.fromarray((m.astype(np.uint8) * 255))


def dilate(m, r):
    if r <= 0:
        return m.copy()
    return box_mean(m.astype(float), r) > 1e-6


def erode(m, r):
    if r <= 0:
        return m.copy()
    return box_mean(m.astype(float), r) > 1 - 1e-6


def disk_dilate(m, r):
    """Dilate with a round-ish structuring element (via Pillow MaxFilter passes)."""
    im = _pil(m)
    while r > 0:
        s = min(r, 2)
        im = im.filter(ImageFilter.MaxFilter(2 * s + 1))
        r -= s
    return np.asarray(im) > 127


def disk_erode(m, r):
    return ~disk_dilate(~m, r)


def close(m, r):
    return disk_erode(disk_dilate(m, r), r)


def open_(m, r):
    return disk_dilate(disk_erode(m, r), r)


def label(m):
    """4-connected component labels. Returns (labels int32, sizes list indexed by label)."""
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    sizes = [0]
    flat = m.ravel()
    lf = lab.ravel()
    n = 0
    for start in np.flatnonzero(flat):
        if lf[start]:
            continue
        n += 1
        lf[start] = n
        q = deque([start])
        cnt = 0
        while q:
            p = q.popleft()
            cnt += 1
            y, x = divmod(p, w)
            if x > 0 and flat[p - 1] and not lf[p - 1]:
                lf[p - 1] = n; q.append(p - 1)
            if x < w - 1 and flat[p + 1] and not lf[p + 1]:
                lf[p + 1] = n; q.append(p + 1)
            if y > 0 and flat[p - w] and not lf[p - w]:
                lf[p - w] = n; q.append(p - w)
            if y < h - 1 and flat[p + w] and not lf[p + w]:
                lf[p + w] = n; q.append(p + w)
        sizes.append(cnt)
    return lab, np.array(sizes)


def remove_small(m, min_size):
    lab, sizes = label(m)
    keep = sizes >= min_size
    keep[0] = False
    return keep[lab]


def fill_holes(m, max_size):
    """Fill holes (background components not touching border) smaller than max_size."""
    inv = ~m
    lab, sizes = label(inv)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    fill = (sizes < max_size)
    for b in border:
        fill[b] = False
    fill[0] = False
    return m | fill[lab]


def polygon_mask(shape, polys, scale=1.0):
    from PIL import ImageDraw
    im = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        d.polygon([(x * scale, y * scale) for x, y in p], fill=255)
    return np.asarray(im) > 127


def max_filter(a, r):
    """Square max filter of radius r for any numeric array (edge-padded)."""
    p = np.pad(a, r, mode='edge')
    h, w = a.shape
    out = a.copy()
    for dy in range(2 * r + 1):
        for dx in range(2 * r + 1):
            np.maximum(out, p[dy:dy + h, dx:dx + w], out=out)
    return out
