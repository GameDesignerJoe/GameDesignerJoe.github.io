"""The edit: assembles the rendered shots into the trailer, with the transitions, film grain and a
breath of chromatic frost at the edges, and pipes it to ffmpeg with the score.

  python composite.py --frames DIR [--out file.mp4] [--audio score.wav] [--sheet DIR --step 0.5]
                      [--from S --to S] [--crf 21] [--preview]

The shots come from render.js (DIR/<id>/f_00000.jpg ...); the cut from timeline.json (node timeline.mjs).
Missing frames (a preview rendered --every N) hold the last frame before them.
"""
import sys, os, json, glob, subprocess, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FFMPEG = r'C:\Users\GameD\AppData\Roaming\Python\Python310\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
args = sys.argv[1:]
def opt(k, d=None):
    return args[args.index('--' + k) + 1] if '--' + k in args else d
FR = opt('frames', r'C:\Users\GameD\nas-tools\trailer_frames\final')
OUT = opt('out', None)
AUDIO = opt('audio', None)
SHEET = opt('sheet', None)
STEP = float(opt('step', 0.5))
CRF = opt('crf', '21')
W, H = 1920, 1080

tl = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8'))
FPS = tl['fps']
shots = tl['shots']
TOTAL = shots[-1]['at'] + shots[-1]['dur']
T0 = float(opt('from', 0)); T1 = float(opt('to', TOTAL))

# --- frames ------------------------------------------------------------------------------------
idx = {}
for s in shots:
    fs = sorted(glob.glob(os.path.join(FR, s['id'], 'f_*.jpg')))
    idx[s['id']] = {int(os.path.basename(f)[2:7]): f for f in fs}
cache = {}
def shot_frame(s, t):
    """The shot's frame at shot time t (seconds, may run into the handles), as float32 RGB."""
    n = int(round((t + s['head']) * FPS))
    n = max(0, min(n, int(round((s['head'] + s['dur'] + s['tail']) * FPS)) - 1))
    avail = idx[s['id']]
    if not avail:
        return np.zeros((H, W, 3), np.float32)
    if n not in avail:
        ks = [k for k in avail if k <= n]
        n = max(ks) if ks else min(avail)
    key = (s['id'], n)
    if key not in cache:
        if len(cache) > 24:
            cache.pop(next(iter(cache)))
        im = Image.open(avail[n]).convert('RGB')
        if im.size != (W, H):
            im = im.resize((W, H), Image.LANCZOS)
        cache[key] = np.asarray(im, np.float32)
    return cache[key]

# --- noise fields for the wipes ------------------------------------------------------------------
rng = np.random.default_rng(7)
def fbm_field(w, h, oct=5, seed=1):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(oct):
        gw, gh = 4 * 2 ** o + 1, int(4 * 2 ** o * h / w) + 2
        g = r.random((gh, gw)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += amp * np.asarray(im, np.float32) / 255; tot += amp; amp *= 0.5
    return acc / tot
NW, NH = 480, 270
noiseA = fbm_field(NW, NH, 5, 3)
noiseB = fbm_field(NW, NH, 4, 9)
yy, xx = np.mgrid[0:NH, 0:NW].astype(np.float32)
xx /= NW; yy /= NH
# squircle distance from the centre (ink closes in from the frame's edges)
rad = (np.abs(xx - 0.5) * 2) ** 3 + (np.abs(yy - 0.5) * 2) ** 3
rad = rad ** (1 / 3)
def up(m):
    return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32)[..., None] / 255
def sm(a, b, v):
    x = np.clip((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x)

# --- grain and the frost at the edges ------------------------------------------------------------
grains = []
for i in range(6):
    g = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
    g = np.asarray(Image.fromarray(np.clip(g * 40 + 128, 0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) - 128
    grains.append(g / 40)
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
er = np.sqrt(((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2) / math.sqrt(2)
edge = (np.clip((er - 0.45) / 0.55, 0, 1) ** 2)[..., None]
def frost_edges(img, amt=1.0):
    """A chromatic split at the edges only, as if seen through cold glass: red pushed out, blue pulled in."""
    if amt <= 0:
        return img
    out = img.copy()
    k = 2.2 * amt
    for c, s in ((0, 1 + k / W), (2, 1 - k / W)):
        ch = Image.fromarray(np.clip(img[..., c], 0, 255).astype(np.uint8))
        nw, nh = int(round(W * s)), int(round(H * s))
        sc_ = np.asarray(ch.resize((nw, nh), Image.BILINEAR), np.float32)
        if s > 1:
            ox, oy = (nw - W) // 2, (nh - H) // 2
            sc_ = sc_[oy:oy + H, ox:ox + W]
        else:
            pad = np.zeros((H, W), np.float32) + img[..., c].mean()
            ox, oy = (W - nw) // 2, (H - nh) // 2
            pad[oy:oy + nh, ox:ox + nw] = sc_
            sc_ = pad
        out[..., c] = img[..., c] * (1 - edge[..., 0]) + sc_ * edge[..., 0]
    return out

# --- transitions ---------------------------------------------------------------------------------
WIN = {'dissolve': 0.45, 'white': 0.35, 'gust': 0.4, 'ink': 0.55}
def compose(T):
    # the shot playing, and the neighbours whose transition windows reach T
    i = next((k for k, s in enumerate(shots) if s['at'] <= T < s['at'] + s['dur']), len(shots) - 1)
    s = shots[i]
    img = shot_frame(s, T - s['at'])
    compose.mixed = False
    # transition into this shot (from i-1) or out of it (to i+1)
    for a, b in ((i - 1, i), (i, i + 1)):
        if a < 0 or b >= len(shots):
            continue
        A, B = shots[a], shots[b]
        kind = A.get('out', 'cut'); Bt = B['at']; w = WIN.get(kind, 0)
        if not w or abs(T - Bt) > w:
            continue
        fa = shot_frame(A, T - A['at']); fb = shot_frame(B, T - B['at'])
        u = (T - (Bt - w)) / (2 * w)          # 0..1 across the window
        compose.mixed = kind in ('gust', 'ink', 'white')
        if kind == 'dissolve':
            k = u * u * (3 - 2 * u)
            img = fa * (1 - k) + fb * k
        elif kind == 'white':
            base = fa if T < Bt else fb
            flash = sm(0, 0.12, T - (Bt - 0.12)) if T < Bt else math.exp(-(T - Bt) * 7)
            img = base + (250 - base) * flash
        elif kind == 'gust':
            # a front of blown snow crossing the frame along the wind: hard leading edge, long white tail
            edgepos = -0.25 + u * 1.5
            f = xx * 0.85 + yy * 0.15 + (noiseA - 0.5) * 0.35
            m = sm(edgepos - 0.03, edgepos + 0.03, f)                     # 1: still the old shot
            white = np.exp(-np.clip(edgepos - f, 0, None) / 0.12) * (f < edgepos) + 0.0
            white = white * (0.55 + 0.45 * noiseB)
            M = up(m); Wt = up(white * 0.92)
            img = fa * M + fb * (1 - M)
            img = img + (245 - img) * Wt
        elif kind == 'ink':
            # ink bleeds in from the edges over the old shot, then draws back off the new one
            k = 1 - abs(u * 2 - 1)                                       # 0 -> 1 -> 0
            th = 1.15 - k * 1.3
            f = rad * 0.75 + noiseA * 0.45
            m = sm(th - 0.04, th + 0.04, f)
            M = up(m)
            base = fa if T < Bt else fb
            img = base * (1 - M) + 6 * M
    return img

def bars_at(T):
    # js/trailer/plan.js barsAt, ported: the letterbox, px of 1080 each
    def s_(a, b, v):
        x = min(1, max(0, (v - a) / (b - a))); return x * x * (3 - 2 * x)
    h = 540 - (540 - 138) * s_(0.75, 1.9, T)
    h += (176 - 138) * (s_(47, 50, T) - s_(63.2, 64.5, T))
    h -= 28 * s_(78, 86, T)
    return h

def finish(img, g):
    img = np.array(img, np.float32, copy=True)
    # the bars stay black through every transition (the director draws them; a wipe mustn't grey them)
    hb = int(round(bars_at(g / FPS)))
    if hb > 0 and getattr(compose, 'mixed', False):
        img[:hb] = 0; img[H - hb:] = 0
    img = frost_edges(img, 1.0)
    img = img.astype(np.float32)
    gr = grains[g % len(grains)]
    gr = np.roll(gr, (g * 37) % 61, axis=1)
    lum = img.mean(axis=2, keepdims=True) / 255
    amp = 4.0 * (0.35 + 0.65 * (1 - np.abs(lum - 0.5) * 2))        # grain sits in the mid-tones
    img = img + gr[..., None] * amp
    return np.clip(img, 0, 255).astype(np.uint8)

def main():
    g0, g1 = int(round(T0 * FPS)), int(round(T1 * FPS))
    if SHEET:
        os.makedirs(SHEET, exist_ok=True)
        for f in glob.glob(os.path.join(SHEET, '*.jpg')):
            os.remove(f)
        T = T0
        while T < T1:
            g = int(round(T * FPS))
            Image.fromarray(finish(compose(g / FPS), g)).save(os.path.join(SHEET, f'c_{g:05d}.jpg'), quality=85)
            T += STEP
        print('sheet frames in', SHEET)
        return
    cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-']
    if AUDIO:
        cmd += ['-ss', str(T0), '-t', str(T1 - T0), '-i', AUDIO]
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-maxrate', opt('maxrate', '6500k'), '-bufsize', '13000k', '-pix_fmt', 'yuv420p', '-tune', 'grain', '-x264-params', 'aq-mode=3', '-movflags', '+faststart']
    if AUDIO:
        cmd += ['-c:a', 'aac', '-b:a', '192k', '-shortest']
    cmd += [OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for g in range(g0, g1):
        p.stdin.write(finish(compose(g / FPS), g).tobytes())
        if g % 150 == 0:
            print(f'  {g / FPS:6.1f} s', flush=True)
    p.stdin.close(); p.wait()
    print('wrote', OUT)

main()
