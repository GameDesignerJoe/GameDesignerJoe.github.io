# Crops the 3rd-edition card art into square tile art: the whole picture, nothing cut off,
# padded with plain card paper (#F9F1E4) so it sits on the tile background with no seam.
#
#   python crop_art3.py <card-exports folder> [<extra Knave folder>]
#
# Writes ../art/{lands,family,specials}/*.jpg (320 px, the game) and ../print/art/*.jpg (900 px, print and play).
# The card-type logo in the top-left of every card is painted over with paper first.
# Knaves come from <extra Knave folder>/{red,blue}-knave.jpg (any card-shaped image works).
import sys, os, numpy as np
from PIL import Image, ImageDraw

PAPER = (249, 241, 228)
HERE = os.path.dirname(os.path.abspath(__file__))
GAME, PRINT = os.path.join(HERE, '..', 'art'), os.path.join(HERE, '..', 'print', 'art')

LANDS = {2: 'ice-cliffs', 3: 'spire-isle', 4: 'birchwood', 5: 'violet-peaks', 6: 'firelands', 7: 'raven-moor',
         8: 'golden-fields', 9: 'wolf-hollow', 10: 'stag-forest', 11: 'dragon-keep', 12: 'owl-marsh', 13: 'longship',
         14: 'night-thicket', 15: 'high-peaks', 16: 'green-hills', 17: 'whale-sea'}
SPECIALS = {18: 'sinkhole', 19: 'underminers', 24: 'lostcity', 25: 'waystone', 28: 'earthquake', 29: 'sanctuary'}
HOUSES = {31: 'black', 35: 'red', 39: 'blue', 43: 'green', 47: 'orange'}      # first card of each house
MEMBERS = ['advisor', 'king', 'queen', 'heir']                                  # card order within a house
# what the print and play uses (everything else is game-only)
PRINTED = {'dragon-keep', 'longship', 'owl-marsh', 'raven-moor', 'firelands', 'violet-peaks', 'green-hills',
           'red-king', 'blue-king', 'red-knave', 'blue-knave', 'lostcity', 'sinkhole'}

def bbox(im, title=False):
    a = np.asarray(im, dtype=np.int16); h, w, _ = a.shape
    bg = np.median(a[int(h*.3):int(h*.7), int(w*.075):int(w*.1)].reshape(-1, 3), axis=0)
    m = np.abs(a - bg).sum(2) > 60
    m[:, :int(w*.07)] = m[:, int(w*.93):] = False; m[:int(h*.05), :] = m[int(h*.95):, :] = False
    m[:int(h*.17), :int(w*.3)] = False                       # card-type logo
    if title: m[int(h*.80):, :] = False                     # Special names along the bottom
    r = np.where(m.sum(1) > 6)[0]; c = np.where(m.sum(0) > 6)[0]
    return (c[0], r[0], c[-1], r[-1]), tuple(float(x) for x in bg)

def crop(src, title=False):
    im = Image.open(src).convert('RGB')
    box, bg = bbox(im, title)
    # match this card's paper to the standard paper colour
    a = np.asarray(im, dtype=np.float32) * (np.array(PAPER) / np.array(bg))
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    ImageDraw.Draw(im).rectangle((0, 0, int(im.width*.32), int(im.height*.17)), fill=PAPER)   # cover the logo
    x0, y0, x1, y1 = box; p = int(max(x1-x0, y1-y0) * .03)
    art = im.crop((max(0, x0-p), max(0, y0-p), min(im.width, x1+p), min(im.height, y1+p)))
    s = max(art.size); out = Image.new('RGB', (s, s), PAPER); out.paste(art, ((s-art.width)//2, (s-art.height)//2))
    return out

def save(img, sub, name):
    img.resize((320, 320), Image.LANCZOS).save(os.path.join(GAME, sub, name + '.jpg'), quality=88)
    if name.split('/')[-1] in PRINTED:
        img.resize((900, 900), Image.LANCZOS).save(os.path.join(PRINT, name + '.jpg'), quality=90)
    print(sub, name)

if __name__ == '__main__':
    src = sys.argv[1]; knaves = sys.argv[2] if len(sys.argv) > 2 else None
    card = lambda n: os.path.join(src, f'vye-3rd-ed-CardsSetup_{n}.png')
    for n, name in LANDS.items(): save(crop(card(n)), 'lands', name)
    for n, name in SPECIALS.items(): save(crop(card(n), title=True), 'specials', name)
    for first, house in HOUSES.items():
        for i, m in enumerate(MEMBERS): save(crop(card(first + i)), 'family', f'{house}-{m}')
    if knaves:
        for house in ('red', 'blue'): save(crop(os.path.join(knaves, f'{house}-knave.jpg')), 'family', f'{house}-knave')
