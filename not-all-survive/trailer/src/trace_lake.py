"""Traces the frozen lake's shore from the terrain mask into js/trailer/data.js (the line the pen draws in
the trailer's open). python trace_lake.py"""
import os, json
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
t = np.array(Image.open(os.path.join(ROOT, 'assets/terrain.png')).convert('RGB'))
cls = np.round(t[..., 0] / 32).astype(int)
e = np.array(Image.open(os.path.join(ROOT, 'assets/terrain-edits.png')).convert('RGBA'))
m = e[..., 3] >= 128
cls[m] = np.round(e[..., 0][m] / 32).astype(int)
H, W = cls.shape

# the lake under world (1100, 1516): flood fill the ice class (mask is half resolution)
ice = cls == 2
seed = (758, 550)
comp = np.zeros_like(ice); comp[seed] = True; q = deque([seed])
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and ice[ny, nx] and not comp[ny, nx]:
            comp[ny, nx] = True; q.append((ny, nx))
def grow(a, n, op):
    for _ in range(n):
        a = op.reduce([a, np.roll(a, 1, 0), np.roll(a, -1, 0), np.roll(a, 1, 1), np.roll(a, -1, 1)])
    return a
mm = grow(grow(comp, 4, np.logical_or), 4, np.logical_and)
mm = grow(grow(mm, 3, np.logical_and), 3, np.logical_or)

# Moore boundary trace
start = next((y, int(np.nonzero(mm[y])[0][0])) for y in range(H) if mm[y].any())
dirs = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
b = [start]; cur = start; back = 6
for _ in range(200000):
    for k in range(8):
        d = (back + 1 + k) % 8
        ny, nx = cur[0] + dirs[d][0], cur[1] + dirs[d][1]
        if 0 <= ny < H and 0 <= nx < W and mm[ny, nx]:
            cur = (ny, nx); back = (d + 4) % 8; break
    else:
        break
    if cur == start and len(b) > 10:
        break
    b.append(cur)
pts = np.array([(x * 2, y * 2) for y, x in b], float)
k = 9
pad = np.concatenate([pts[-k:], pts, pts[:k]])
smooth = np.array([pad[i:i + 2 * k + 1].mean(0) for i in range(len(pts))])[::6]
out = os.path.join(ROOT, 'js/trailer/data.js')
with open(out, 'w', encoding='utf-8') as fh:
    fh.write("// Traced from the terrain mask (trailer/src/trace_lake.py): the frozen lake's shore, world px.\n")
    fh.write('export const LAKE = ' + json.dumps([[round(a, 1), round(c, 1)] for a, c in smooth], separators=(',', ':')) + ';\n')
print(out, len(smooth), 'points')
