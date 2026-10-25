"""Generate assets/terrain.png (the auto class map) from ref/map.png (or assets/map.webp).

Run from anywhere:  python tools/gen_terrain.py [--overlay out.png]

Output: assets/terrain.png, half resolution (1232 x 928, 1 px = 2x2 world px), RGB:
  R = class * 32      classes: 0 snow, 1 deep, 2 ice, 3 thin, 4 rock, 5 path,
                               6 cliff (climbable face), 7 shadow (walkable shaded ground)
  G = 255 where the painting has ink / hatching texture (only such rock and cliff
      pixels draw over actors; flat grey never occludes), else 0
  B = map luminance, Gaussian-blurred, in steps of 8 (detail placement, snow lips)
Everything else - foot regions, plateau heights, climb links, exposure, occluder
pieces - is derived at runtime by js/world/terrain.js from the final class map
(this file with assets/terrain-edits.png and any ?edits localStorage edits on top),
so hand edits to classes regenerate all of it.
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

SNOW, DEEP, ICE, THIN, ROCK, PATH, CLIFF, SHADOW = range(8)
NAMES = ['snow', 'deep', 'ice', 'thin', 'rock', 'path', 'cliff', 'shadow']
CLASS_STEP = 32   # R = class * CLASS_STEP

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
    # Narrow flat shaded slope beside the cliff north-east of spawn (critic, round 3).
    (SHADOW, [(1696, 1442), (1706, 1440), (1712, 1452), (1714, 1490), (1708, 1492), (1700, 1470)]),
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
    # Structure tensor: vertical hatching (cliff faces) has strong horizontal gradients
    # and weak vertical ones. vert = +1 for vertical lines, E = gradient energy.
    gx = np.zeros_like(L); gy = np.zeros_like(L)
    gx[:, 1:-1] = (L[:, 2:] - L[:, :-2]) / 2
    gy[1:-1] = (L[2:] - L[:-2]) / 2
    jxx, jyy = box_mean(gx * gx, 4), box_mean(gy * gy, 4)
    E = jxx + jyy + 1e-3
    hv, he = half((jxx - jyy) / E), half(E)
    hatched = np.clip((box_mean(hv, 3) - 0.05) / 0.35, 0, 1) * np.clip(box_mean(he, 3) / 150, 0, 1)
    # Fine texture (for shadow / occlusion): any ink or tonal detail within ~3 world px.
    m2 = box_mean(L, 1)
    lsd2 = np.sqrt(np.maximum(box_mean(L * L, 1) - m2 * m2, 0))
    tex = (lsd2 > 7) | (L < 150)
    th, tw = tex.shape[0] // 2 * 2, tex.shape[1] // 2 * 2
    tex = tex[:th, :tw].reshape(th // 2, 2, tw // 2, 2).any(axis=(1, 3))
    return half(Lm), half(inkd), half(sd), half(grain), half(Lb), hatched, tex


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
    Lm, inkd, sd, grain, Lb, hatched, tex = features(im)
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

    occ = lambda: (cls == ROCK) | (cls == CLIFF)

    # Snow caps: the white lip on top of a face (and snowy rims) read as rock after the
    # morphology above. Give back bright, flat, line-free "rock" next to walkable
    # ground, up to 8 world px deep, so climbs end where the snow visibly starts.
    brightflat = (Lm >= 236) & (sd < 2) & (inkd < 0.03) & ~sky
    caps = np.zeros_like(brightflat)
    for _ in range(4):
        grow = disk_dilate(~occ(), 1) & occ() & brightflat
        if not grow.any():
            break
        cls[grow] = SNOW
        caps |= grow
    # Snow lips: at the top of every occluder run (walkable ground directly above), the
    # bright painted snow lip - up to 12 world px - is ground, not face.
    o = occ()
    lip = np.zeros_like(o)
    for x in range(W):
        for y0, y1 in column_runs(o[:, x]):
            if y0 == 0:
                continue
            y = y0
            while y < min(y1 - 2, y0 + 6) and Lb[y, x] >= 236:
                lip[y, x] = True
                y += 1
    lip &= ~sky
    cls[lip] = SNOW
    caps |= lip

    # Larger white snowfields wholly inside rock (mesa tops classed rock): snow too;
    # the reachability pass below seals any that no climb reaches.
    fields = remove_small(open_(occ() & brightflat, 1), 40)
    cls[fields] = SNOW
    caps |= fields
    print(f'  snow caps / tops returned to snow: {np.mean(caps) * 100:.2f}% of map')

    # Shadow: shaded ground - cast shadows at cliff feet, shaded snow slopes at the foot
    # of mountains - is flat, low-contrast grey with no ink, hatching or tonal detail.
    # Grow walkable ground into such flat "rock" up to ~50 world px (geodesically, so it
    # follows the flat patch from the walkable edge); it becomes walkable shadow.
    cand = (cls == ROCK) & ~tex & (Lm >= 135) & (Lm <= 240) & (hatched < 0.5) & ~sky
    shadow = np.zeros_like(cand)
    front = ~occ()
    for _ in range(7):
        # Steps of 4 px hop over the thin ink outline that often rims a shaded patch.
        grow = disk_dilate(front, 4) & cand & ~shadow
        if not grow.any():
            break
        shadow |= grow
        front = grow
    shadow = open_(shadow, 1)
    # The hopped-over outline pixels between ground and shadow become shadow too.
    walk0 = ~occ()
    gap = disk_erode(disk_dilate(shadow | walk0, 3), 3) & (cls == ROCK) & (hatched < 0.5) & ~sky
    shadow |= gap & disk_dilate(shadow, 3)
    cls[shadow] = SHADOW
    print(f'  shaded ground made walkable (shadow): {np.mean(shadow) * 100:.2f}% of map')

    # Cliff vs rock, then reachability (foot regions + climbs up/down cliff faces).
    sx, sy = SPAWN[0] // 2, SPAWN[1] // 2
    assert not occ()[sy, sx], 'spawn is not walkable'
    split_cliffs(cls, hatched, sky)
    sealed, plateau = climb_reach(cls, (sy, sx))
    print(f'  sealed pockets (no foot or climb route) -> rock: {np.mean(sealed) * 100:.1f}% of map')
    cls[sealed] = ROCK
    # Pockets filled in above leave square edges: smooth again, only ever adding rock.
    rb = np.asarray(Image.fromarray((occ() * 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(1.6))) > 127
    add = rb & ~occ() & ~pm & ~near
    cls[add] = ROCK
    split_cliffs(cls, hatched, sky)
    sealed, plateau = climb_reach(cls, (sy, sx))
    cls[sealed] = ROCK
    split_cliffs(cls, hatched, sky)
    print(f'  climb-only plateau tops: {np.mean(plateau) * 100:.1f}% of map')
    lum = half(np.asarray(Image.open(SRC).convert('L').filter(ImageFilter.GaussianBlur(1))))
    return cls, plateau, lum, disk_dilate(tex, 1)   # occlusion flag: texture within ~2 px


# Climb rules, in mask px (1 mask px = 2 world units) - keep in step with terrain.js.
CLIMB_MAX = 55        # at most 110 world units of face
CLIMB_LAND = 2        # landing stays walkable for 4 world units
MIN_PLATEAU = 60      # mask px: smaller climb-only pockets aren't worth keeping


def column_runs(occ_col):
    """(start, end_exclusive) runs of True in a 1D bool array."""
    d = np.diff(np.concatenate([[0], occ_col.astype(np.int8), [0]]))
    return zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0])


def split_cliffs(cls, hatched, sky):
    """Every occluder pixel becomes CLIFF or ROCK. A vertical run of occluder in one
    column is a cliff when it has walkable ground directly above AND below, is at most
    CLIMB_MAX long, and is mostly vertical hatching; everything else is rock."""
    H, W = cls.shape
    occ = (cls == ROCK) | (cls == CLIFF)
    cliff = np.zeros_like(occ)
    for x in range(W):
        for y0, y1 in column_runs(occ[:, x]):
            if y0 == 0 or y1 >= H or y1 - y0 > CLIMB_MAX:
                continue
            if hatched[y0:y1, x].mean() >= 0.35:
                cliff[y0:y1, x] = True
    # Tidy: majority along each band (13 columns wide, 5 rows tall), within occluders,
    # so climbability doesn't flip column by column inside one face.
    c = cliff.astype(np.float32)
    k = 6
    cs = np.cumsum(np.pad(c, ((0, 0), (k + 1, k))), axis=1)
    horiz = (cs[:, 2 * k + 1:] - cs[:, :-2 * k - 1]) / (2 * k + 1)
    o = occ.astype(np.float32)
    os_ = np.cumsum(np.pad(o, ((0, 0), (k + 1, k))), axis=1)
    ohoriz = (os_[:, 2 * k + 1:] - os_[:, :-2 * k - 1]) / (2 * k + 1)
    frac = box_mean(horiz, 0) / np.maximum(ohoriz, 1e-3)
    frac = np.minimum(frac, 1)
    vert = np.zeros_like(frac)
    for d in range(-2, 3):
        vert += np.roll(frac, d, axis=0)
    cliff = (vert / 5 > 0.5) & occ & ~sky
    # Close gaps: in each row, a stretch of non-cliff occluder up to 24 world px wide
    # with cliff on both sides belongs to the same face.
    for y in range(H):
        row, orow = cliff[y], occ[y]
        x = 0
        while x < W:
            if row[x] or not orow[x]:
                x += 1
                continue
            x0 = x
            while x < W and orow[x] and not row[x]:
                x += 1
            if x0 > 0 and x < W and row[x0 - 1] and row[x] and x - x0 <= 12:
                row[x0:x] = True
    cls[occ] = ROCK
    cls[cliff] = CLIFF


def climb_reach(cls, spawn):
    """Foot-connected regions, joined by vertical climbs through CLIFF runs (up or
    down). Returns (sealed, plateau): sealed = walkable cells with no foot+climb route
    from the spawn; plateau = reachable only by climbing."""
    occ = (cls == ROCK) | (cls == CLIFF)
    walk = ~occ
    lab, sizes = label(walk)
    H, W = cls.shape
    edges = set()
    for x in range(W):
        col = cls[:, x]
        for y0, y1 in column_runs(occ[:, x]):
            if y0 == 0 or y1 + CLIMB_LAND >= H or y1 - y0 > CLIMB_MAX:
                continue
            if (col[y0:y1] == CLIFF).mean() < 0.5 or not walk[y1:y1 + CLIMB_LAND + 1, x].all():
                continue
            a_, b_ = lab[y0 - 1, x], lab[y1, x]
            if a_ != b_:
                edges.add((min(a_, b_), max(a_, b_)))
    adj = {}
    for a_, b_ in edges:
        adj.setdefault(a_, []).append(b_)
        adj.setdefault(b_, []).append(a_)
    start = lab[spawn]
    seen = {start}
    q = [start]
    while q:
        r = q.pop()
        for n in adj.get(r, ()):
            if n not in seen and sizes[n] >= MIN_PLATEAU:
                seen.add(n)
                q.append(n)
    keep = np.zeros(len(sizes), bool)
    keep[list(seen)] = True
    keep[0] = False
    sealed = walk & ~keep[lab]
    plateau = walk & keep[lab] & (lab != start)
    return sealed, plateau


CLASS_COLORS = np.array([[0, 0, 0], [0, 230, 0], [0, 150, 255], [255, 0, 255], [255, 40, 0],
                         [255, 220, 0], [255, 140, 0], [0, 200, 170]], np.float32)
CLASS_ALPHA = np.array([0, .4, .4, .55, .45, .8, .55, .5])


def main():
    cls, plateau, lum, textured = classify()
    H, W = cls.shape
    rgb = np.zeros((H, W, 3), np.uint8)
    rgb[..., 0] = cls * CLASS_STEP
    rgb[..., 1] = textured.astype(np.uint8) * 255   # 255 = inked / hatched (may occlude)
    rgb[..., 2] = (np.clip(np.round(lum / 8), 0, 31) * 8).astype(np.uint8)
    Image.fromarray(rgb, 'RGB').save(OUT, optimize=True)
    print('wrote', OUT, (W, H), os.path.getsize(OUT), 'bytes')
    for i, n in enumerate(NAMES):
        print(f'  {n:6s} {np.mean(cls == i) * 100:5.1f}%')
    if '--overlay' in sys.argv:
        out = sys.argv[sys.argv.index('--overlay') + 1]
        base = np.asarray(Image.open(SRC).convert('RGB').resize((W, H))).astype(np.float32)
        a = CLASS_ALPHA[cls][..., None]
        o = base * (1 - a) + CLASS_COLORS[cls] * a
        o[plateau] = o[plateau] * 0.6 + np.array([120, 0, 200]) * 0.4   # plateau tops: purple
        Image.fromarray(o.astype(np.uint8)).save(out)


if __name__ == '__main__':
    main()
