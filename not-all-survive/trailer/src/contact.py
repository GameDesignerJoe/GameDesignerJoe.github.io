"""Contact sheet of JPEG frames: python contact.py <dir or glob> <out.jpg> [--cols 6] [--w 320] [--every 1]"""
import sys, glob, os
from PIL import Image, ImageDraw

args = sys.argv[1:]
src, out = args[0], args[1]
def opt(k, d):
    return type(d)(args[args.index('--' + k) + 1]) if '--' + k in args else d
cols, w, every = opt('cols', 6), opt('w', 320), opt('every', 1)
files = sorted(glob.glob(os.path.join(src, '*.jpg')) if os.path.isdir(src) else glob.glob(src))[::every]
if not files:
    sys.exit('no frames')
im0 = Image.open(files[0]); h = round(w * im0.height / im0.width)
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 16)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    x, y = (i % cols) * w, (i // cols) * (h + 16)
    sheet.paste(Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS), (x, y))
    d.text((x + 4, y + h + 2), os.path.basename(os.path.dirname(f)) + '/' + os.path.basename(f)[:-4], fill=(200, 200, 200))
sheet.save(out, quality=88)
print(out, len(files), 'frames')
