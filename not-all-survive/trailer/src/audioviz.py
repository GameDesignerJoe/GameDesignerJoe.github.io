"""Pictures of the score for review: loudness per band over time with the cut marked. python audioviz.py in.wav out.png"""
import sys, json, wave, numpy as np
from PIL import Image, ImageDraw
w = wave.open(sys.argv[1]); sr = w.getframerate(); n = w.getnframes()
x = np.frombuffer(w.readframes(n), np.int16).reshape(-1, 2).astype(np.float32) / 32768
tl = json.load(open('timeline.json'))
hop = int(sr * 0.05); win = 4096
frames = (len(x) - win) // hop
bands = [(20, 150), (150, 600), (600, 2500), (2500, 8000), (8000, 20000)]
fr = np.fft.rfftfreq(win, 1 / sr); hann = np.hanning(win)
E = np.zeros((len(bands), frames)); R = np.zeros(frames); side = np.zeros(frames)
for i in range(frames):
    seg = x[i * hop:i * hop + win]; m = seg.mean(1)
    S = np.abs(np.fft.rfft(m * hann)) ** 2
    for b, (lo, hi) in enumerate(bands): E[b, i] = 10 * np.log10(S[(fr >= lo) & (fr < hi)].sum() + 1e-9)
    R[i] = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)
    side[i] = 20 * np.log10(np.sqrt(((seg[:, 0] - seg[:, 1]) ** 2).mean()) + 1e-9)
Wd, Hh = 1800, 900; im = Image.new('RGB', (Wd, Hh), (16, 16, 18)); d = ImageDraw.Draw(im)
dur = len(x) / sr; X = lambda t: int(t / dur * Wd)
for s in tl['shots']:
    d.line([(X(s['at']), 0), (X(s['at']), Hh)], fill=(60, 60, 70)); d.text((X(s['at']) + 2, 2), s['id'], fill=(150, 150, 160))
cols = [(230, 90, 60), (230, 170, 60), (120, 200, 90), (80, 160, 230), (180, 120, 230)]
def plot(arr, y0, h, lo, hi, col):
    pts = [(X(i * hop / sr), y0 + h - (min(hi, max(lo, v)) - lo) / (hi - lo) * h) for i, v in enumerate(arr)]
    d.line(pts, fill=col, width=1)
for b in range(len(bands)): plot(E[b], 30, 500, E.max() - 70, E.max(), cols[b])
plot(R, 560, 300, -60, 0, (240, 240, 240)); plot(side, 560, 300, -60, 0, (120, 120, 200))
for db in (-6, -12, -24, -48):
    y = 560 + 300 - (db + 60) / 60 * 300; d.line([(0, y), (Wd, y)], fill=(50, 50, 50)); d.text((2, y - 10), f'{db} dB', fill=(110, 110, 110))
im.save(sys.argv[2]); print('ok', dur)

# spectral balance over the whole piece (what a phone speaker will lose)
Sall = np.zeros(len(fr))
for i in range(0, frames, 4):
    m = x[i * hop:i * hop + win].mean(1); Sall += np.abs(np.fft.rfft(m * hann)) ** 2
tot = Sall.sum()
cent = (Sall * fr).sum() / tot
band = lambda lo, hi: Sall[(fr >= lo) & (fr < hi)].sum()
print(f'energy <60 Hz {100 * band(0, 60) / tot:.1f}%  <120 Hz {100 * band(0, 120) / tot:.1f}%  centroid {cent:.0f} Hz  2-6 kHz {10 * np.log10(band(2000, 6000) / tot):.1f} dB rel')
for a, b, nm in ((47, 50, 'storm'), (50, 54, 'pitch'), (54, 57, 'bear early'), (58.3, 59.45, 'bear late'), (60.4, 62, 'flare')):
    seg = x[int(a * sr):int(b * sr)]; print(f'  {nm:10s} RMS {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB')
tail = x[-int(0.3 * sr):]; print('  last 0.3 s peak', np.abs(tail).max())
