"""Generate assets/terrain.png from ref/map.png (or assets/map.webp).

Run from anywhere:  python tools/gen_terrain.py [--overlay out.png] [--components]

Output: assets/terrain.png, half resolution (1232 x 928), RGB:
  R = class * 40, +20 if elevated (rock face just south: plateau top / ledge)
      classes: 0 snow, 1 deep, 2 ice, 3 thin, 4 rock, 5 path
  G = exposure 0..255      (open plains / plateau tops high, nooks among cliffs low)
  B = map luminance, blurred (lets ground.js place glints on shaded snow etc.)
Only Pillow + numpy are needed (see imgops.py).
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter
from imgops import label, max_filter, box_mean, close, open_, remove_small, fill_holes, polygon_mask, disk_dilate, disk_erode

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'ref', 'map.png')
if not os.path.exists(SRC):
    SRC = os.path.join(ROOT, 'assets', 'map.webp')
OUT = os.path.join(ROOT, 'assets', 'terrain.png')

SNOW, DEEP, ICE, THIN, ROCK, PATH = range(6)
NAMES = ['snow', 'deep', 'ice', 'thin', 'rock', 'path']

# ---- hand-authored data (full-res map pixel coordinates) -------------------------
# The open, broken sea ice at bottom centre ("darker ice means thin ice and can break").
SEA = [[(935, 1612), (1000, 1585), (1200, 1590), (1215, 1695), (1370, 1705), (1375, 1780),
        (1310, 1856), (700, 1856), (700, 1800), (770, 1795), (780, 1742), (860, 1735),
        (885, 1690), (870, 1660)]]
# Sky above the distant skyline (the stippled haze at the top edge): impassable.
SKY = [[(0, 0), (0, 158), (30, 146), (55, 126), (85, 110), (100, 108), (150, 145), (200, 185),
        (240, 186), (290, 170), (330, 175), (350, 160), (390, 125), (410, 75), (430, 70),
        (460, 100), (475, 110), (500, 100), (540, 50), (560, 35), (580, 50), (600, 85),
        (620, 135), (640, 155), (660, 155), (700, 130), (740, 115), (780, 100), (800, 105),
        (840, 90), (870, 65), (895, 0)],
       [(1205, 0), (1220, 25), (1250, 55), (1290, 90), (1330, 85), (1350, 90), (1380, 105),
        (1400, 110), (1430, 105), (1450, 110), (1500, 90), (1550, 65), (1580, 75), (1600, 95),
        (1620, 50), (1640, 45), (1660, 60), (1690, 90), (1720, 110), (1772, 149), (1830, 160),
        (1900, 162), (1988, 172), (2000, 155), (2050, 100), (2100, 55), (2150, 35), (2190, 15),
        (2230, 45), (2260, 75), (2290, 100), (2340, 105), (2350, 90), (2370, 85), (2400, 90),
        (2440, 105), (2464, 115), (2464, 0)]]
SPAWN = (1360, 1560)   # reachability flood starts here
# The dotted trail(s) near the bottom edge ("paths make traversing easier & faster").
PATHS = [
    [(1405, 1845), (1420, 1832), (1450, 1820), (1475, 1813), (1500, 1812), (1525, 1813),
     (1550, 1808), (1575, 1808), (1600, 1805), (1625, 1800), (1650, 1793), (1675, 1800),
     (1700, 1805), (1725, 1800), (1750, 1795), (1775, 1790), (1795, 1785), (1800, 1770),
     (1810, 1755), (1825, 1745), (1850, 1743), (1875, 1744), (1900, 1740), (1925, 1730),
     (1950, 1728), (1975, 1733), (2000, 1740), (2025, 1745), (2050, 1752), (2075, 1755),
     (2100, 1752), (2115, 1760), (2120, 1775), (2140, 1790), (2160, 1800), (2185, 1810),
     (2200, 1817), (2210, 1830), (2220, 1856)],
    [(1310, 1738), (1335, 1735), (1360, 1738), (1380, 1745), (1400, 1755), (1425, 1757),
     (1450, 1760), (1475, 1757), (1500, 1752), (1525, 1745), (1545, 1745)],
]
PATH_WIDTH = 5  # in mask (half-res) px, i.e. ~10 map px wide
# Hand corrections: polygons forced to a class, applied last (full-res coords).
SHADOW_TO_ICE = False
FORCE = [
    # (class, polygon)
    # Cast shadow of the big cliff on the central lake.
    # Shaded flats at cliff feet that read as walkable ground.
    (SNOW, [(860, 770), (880, 745), (930, 760), (955, 790), (950, 805), (900, 805), (870, 795)]),
    (SNOW, [(1045, 1240), (1075, 1232), (1100, 1238), (1100, 1258), (1085, 1268), (1060, 1268), (1048, 1258)]),
    (SNOW, [(1158, 1300), (1200, 1290), (1230, 1305), (1265, 1330), (1265, 1375), (1215, 1378),
            (1170, 1365), (1158, 1330)]),
    (ICE, [(1072, 888), (1082, 864), (1098, 846), (1125, 836), (1150, 830), (1175, 826), (1200, 822), (1222, 816),
           (1236, 828), (1200, 842), (1160, 858), (1125, 878), (1105, 895)]),
]


def half(a):
    a = a.astype(np.float32)
    h, w = a.shape[0] // 2 * 2, a.shape[1] // 2 * 2
    return a[:h, :w].reshape(h // 2, 2, w // 2, 2).mean((1, 3))


def features(im):
    L = np.asarray(im).astype(np.float32)
    Lm = np.asarray(im.filter(ImageFilter.MedianFilter(7))).astype(np.float32)
    # Ink density: cliff hatching and rock line-work.
    inkd = box_mean((L < 140).astype(np.float32), 4)
    # Flatness of the de-lined luminance (frozen lakes are a flat fill).
    m1 = box_mean(Lm, 3)
    sd = np.sqrt(np.maximum(box_mean(Lm * Lm, 3) - m1 * m1, 0))
    # Fine grain on bright snow (stippled drifts), ignoring ink lines.
    mn = np.asarray(im.filter(ImageFilter.MinFilter(5))).astype(np.float32)
    m = box_mean(L, 2)
    lsd = np.sqrt(np.maximum(box_mean(L * L, 2) - m * m, 0))
    valid = (mn > 205) & (m > 232)
    num = box_mean(np.where(valid, lsd, 0), 10)
    den = box_mean(valid.astype(np.float32), 10)
    grain = np.where(den > 0.25, num / np.maximum(den, 1e-3), 0)
    Lb = np.asarray(im.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)
    return half(Lm), half(inkd), half(sd), half(grain), half(Lb)


def path_mask(shape):
    from PIL import ImageDraw
    im = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(im)
    for line in PATHS:
        pts = [(x / 2, y / 2) for x, y in line]
        d.line(pts, fill=255, width=PATH_WIDTH)
        r = PATH_WIDTH / 2
        for x, y in pts:
            d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return np.asarray(im) > 127


def classify():
    im = Image.open(SRC).convert('L')
    Lm, inkd, sd, grain, Lb = features(im)
    H, W = Lm.shape
    sea = polygon_mask((H, W), SEA, 0.5)
    sky = polygon_mask((H, W), SKY, 0.5)

    # Frozen lakes / plains: a flat ~221 grey fill.
    ice0 = (Lm >= 215) & (Lm <= 227) & (sd < 1.5) & (inkd < 0.10)
    ice0 = remove_small(close(ice0, 3), 300)

    # Rock: hatching / line-work density, or dark fills. In the sea only the hatched
    # mountain counts (floe outlines are inked too).
    rock = ((inkd > 0.10) | (Lm < 194)) & ~sea
    rock = close(rock, 2)
    rock = open_(rock, 1)
    rock = remove_small(rock, 25)
    rock = fill_holes(rock, 60)
    rock |= sky

    # Thin ice: the dark water and grey sheet ice of the sea; white floes stay snow.
    thin = sea & (Lb < 200) & ~rock
    floe = sea & (Lb >= 188) & ~rock
    floe = remove_small(close(floe, 1), 3)       # single specks of light stay thin
    floe = disk_dilate(floe, 1) & sea & ~rock    # small floes get a usable footprint
    thin = (sea & ~rock & ~floe)

    ice = ice0 & ~rock & ~thin
    ice = close(ice, 3)
    ice = remove_small(ice, 300)
    ice = fill_holes(ice, 500) & ~rock & ~thin

    # Deep drifts: only big, strongly stippled fields (the painted drift texture).
    deep = (~rock) & (~ice) & (~thin) & (~sea) & (box_mean(grain, 3) > 2.6)
    deep = open_(deep, 3)
    deep = remove_small(deep, 900)
    deep = fill_holes(deep, 400) & ~rock & ~ice & ~thin

    cls = np.full((H, W), SNOW, np.uint8)
    cls[deep] = DEEP
    cls[ice] = ICE
    cls[thin] = THIN
    cls[rock] = ROCK
    # Remove single-pixel class speckle among the walkable classes.
    smooth = np.asarray(Image.fromarray(cls).filter(ImageFilter.ModeFilter(3)))
    cls = np.where(cls == ROCK, cls, np.where(smooth == ROCK, cls, smooth)).astype(np.uint8)

    for c, poly in FORCE:
        cls[polygon_mask((H, W), [poly], 0.5)] = c

    # Rock must be a real mass: an opening of radius 3 mask px (~6 map px) removes
    # every band narrower than ~12 map px - the stippled / dotted snow-to-ice
    # shorelines, lone inked marks - so they don't become invisible walls. What's
    # removed becomes snow or ice by (line-free) luminance, or thin inside the sea.
    rk = cls == ROCK
    thin_bands = rk & ~disk_dilate(disk_erode(rk, 3), 3) & ~sky
    fill = np.where((Lm >= 205) & (Lm < 230), ICE, SNOW).astype(np.uint8)
    fill[sea & (Lb < 188)] = THIN
    cls[thin_bands] = fill[thin_bands]
    print(f'  thin rock bands removed: {np.mean(thin_bands) * 100:.1f}% of map')

    # Smooth the rock outline (morphology leaves square stair-steps).
    r = np.asarray(Image.fromarray(((cls == ROCK) * 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(1.6))) > 127
    under = np.asarray(Image.fromarray(np.where(cls == ROCK, SNOW, cls).astype(np.uint8))
                       .filter(ImageFilter.MaxFilter(5)))  # class to give uncovered pixels
    newly_open = (cls == ROCK) & ~r
    cls[newly_open] = np.where(under[newly_open] == ROCK, SNOW, under[newly_open])
    cls[r & ~sky] = ROCK
    cls[sky] = ROCK

    # The trail: clear rock (marker posts) within ~8 map px either side, then paint it.
    pm = path_mask((H, W))
    near = disk_dilate(pm, 4)
    cls[near & (cls == ROCK)] = SNOW
    cls[pm] = PATH

    # Reachability: walkable pockets not connected (4-way) to the spawn become rock.
    lab, sizes = label(cls != ROCK)
    sx, sy = SPAWN[0] // 2, SPAWN[1] // 2
    keep = lab[sy, sx]
    assert keep, 'spawn is not walkable'
    unreachable = (lab != keep) & (cls != ROCK)
    if '--components' in sys.argv:
        order = np.argsort(sizes)[::-1]
        for l in order[:12]:
            if l == 0: continue
            ys, xs = np.nonzero(lab == l)
            print('   comp', l, sizes[l], 'bbox', xs.min() * 2, ys.min() * 2, xs.max() * 2, ys.max() * 2, '(spawn)' if l == keep else '')
    print(f'  unreachable walkable pockets -> rock: {np.mean(unreachable) * 100:.1f}% of map')
    cls[unreachable] = ROCK
    # Pockets filled in above leave square edges: smooth again, only ever adding rock
    # (so nothing new opens up), then re-check reachability.
    rb = np.asarray(Image.fromarray(((cls == ROCK) * 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(1.6))) > 127
    add = rb & (cls != ROCK) & ~pm & ~near
    cls[add] = ROCK
    lab, sizes = label(cls != ROCK)
    keep = lab[sy, sx]
    cls[(lab != keep) & (cls != ROCK)] = ROCK
    return cls


def exposure(cls):
    """0..1: open ground far from rock is exposed; rock directly south (below) means
    we're on a plateau / ridge top, which is more exposed still."""
    rock = (cls == ROCK).astype(np.float32)
    near = box_mean(rock, 25)             # ~100 full px window
    open_ = np.clip(1 - near * 1.6, 0, 1)
    # Rock just below a walkable point (cliff face under a mesa top) -> elevated.
    below = np.zeros_like(rock)
    for dy in range(2, 14):
        below[:-dy] = np.maximum(below[:-dy], rock[dy:])
    above = np.zeros_like(rock)
    for dy in range(2, 14):
        above[dy:] = np.maximum(above[dy:], rock[:-dy])
    walk = 1 - rock
    elevated = np.clip(box_mean(below * (1 - above) * walk, 8) * 2.5, 0, 1)
    e = 0.15 + 0.7 * open_ + 0.35 * elevated
    e[cls == ICE] += 0.1
    e = np.clip(box_mean(e, 3), 0, 1)
    return e


def elevated_mask(cls):
    """Walkable points with a rock face just below them (south, within ~30 map px):
    plateau / mesa tops and ledges, seen from the oblique camera."""
    rock = cls == ROCK
    below = np.zeros_like(rock)
    for dy in range(2, 16):
        below[:-dy] |= rock[dy:]
    return below & ~rock


def main():
    cls = classify()
    elev = elevated_mask(cls)
    lum = half(np.asarray(Image.open(SRC).convert('L').filter(ImageFilter.GaussianBlur(1))))
    exp = exposure(cls)
    H, W = cls.shape
    rgb = np.zeros((H, W, 3), np.uint8)
    rgb[..., 0] = cls * 40 + elev * 20   # +20 = on a plateau top / ledge
    rgb[..., 1] = (np.round(exp * 15) * 17).astype(np.uint8)  # 16 levels: compresses well
    rgb[..., 2] = np.clip(np.round(lum / 8) * 8, 0, 255).astype(np.uint8)  # map luminance (32 levels)
    Image.fromarray(rgb, 'RGB').save(OUT, optimize=True)
    print('wrote', OUT, (W, H), os.path.getsize(OUT), 'bytes')
    for i, n in enumerate(NAMES):
        print(f'  {n:5s} {np.mean(cls == i) * 100:5.1f}%')
    if '--overlay' in sys.argv:
        out = sys.argv[sys.argv.index('--overlay') + 1]
        base = np.asarray(Image.open(SRC).convert('RGB').resize((W, H))).astype(np.float32)
        col = np.array([[0, 0, 0], [0, 230, 0], [0, 150, 255], [255, 0, 255], [255, 40, 0], [255, 220, 0]], np.float32)
        a = np.array([0, .4, .4, .55, .45, .8])[cls][..., None]
        o = base * (1 - a) + col[cls] * a
        Image.fromarray(o.astype(np.uint8)).save(out)
        Image.fromarray((exp * 255).astype(np.uint8)).save(out.replace('.png', '_exp.png'))


if __name__ == '__main__':
    main()
