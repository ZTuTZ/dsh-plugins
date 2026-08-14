"""Chroma-key the generated red-background hero renders into transparent
cutouts, normalizing both figures to the same canvas framing so the suit/peter
reveal doesn't jump.

Usage: python3 scripts/build-skin-cutouts.py
"""
from PIL import Image, ImageFilter
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '素材', 'spidey', 'skin-hero')
OUT = os.path.join(ROOT, '素材', 'spidey', 'skin-cutouts')
os.makedirs(OUT, exist_ok=True)


def bg_model(im):
    w, h = im.size
    px = im.load()
    rows = []
    for y in range(h):
        cols = []
        for x in list(range(0, 90, 3)) + list(range(w - 90, w, 3)):
            cols.append(px[x, y])
        n = len(cols)
        rows.append((
            sorted(c[0] for c in cols)[n // 2],
            sorted(c[1] for c in cols)[n // 2],
            sorted(c[2] for c in cols)[n // 2],
        ))
    return rows


def fg_mask(im, rows):
    w, h = im.size
    px = im.load()
    out = Image.new('L', (w, h))
    p = out.load()
    for y in range(h):
        br, bg_, bb = rows[y]
        for x in range(w):
            r, g, b = px[x, y]
            d = math.sqrt((r - br) ** 2 + (g - bg_) ** 2 + (b - bb) ** 2)
            a = 0.0
            if d > 40:
                a = min(1.0, (d - 40) / 70)
            elif d > 24:
                a = (d - 24) / 16 * 0.55
            p[x, y] = int(a * 255)
    return out


def bbox_of(mask, threshold=90):
    w, h = mask.size
    p = mask.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if p[x, y] > threshold:
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


imgs = {}
for name in ['suit', 'peter']:
    im = Image.open(os.path.join(SRC, f'{name}.png')).convert('RGB')
    rows = bg_model(im)
    imgs[name] = (im, fg_mask(im, rows))

(_, m1), (_, m2) = imgs['suit'], imgs['peter']
mask = Image.new('L', m1.size)
p1, p2, pm = m1.load(), m2.load(), mask.load()
for y in range(m1.size[1]):
    for x in range(m1.size[0]):
        pm[x, y] = max(p1[x, y], p2[x, y])

# close holes, open specks, feather edges
mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
mask = mask.filter(ImageFilter.GaussianBlur(1.6))

bx0, by0, bx1, by1 = bbox_of(mask)
print('union bbox:', bx0, by0, bx1, by1)

# Normalized 3:4 canvas: figure height 88% of canvas height, vertical center at
# 48%, horizontal center at 50%.
CANVAS_W, CANVAS_H = 900, 1200
scale = (CANVAS_H * 0.88) / (by1 - by0)
crop_w = CANVAS_W / scale
crop_h = CANVAS_H / scale
cx = (bx0 + bx1) / 2
cy = (by0 + by1) / 2
crop_x = min(max(0, cx - crop_w / 2), 2048 - crop_w)
crop_y = min(max(0, cy - crop_h * 0.48), 2048 - crop_h)
print('crop:', round(crop_x), round(crop_y), round(crop_w), round(crop_h))

for name, (im, _) in imgs.items():
    px = im.load()
    pm = mask.load()
    out = Image.new('RGBA', (CANVAS_W, CANVAS_H))
    op = out.load()
    for y in range(CANVAS_H):
        sy = min(2047, max(0, int(crop_y + (y / CANVAS_H) * crop_h)))
        for x in range(CANVAS_W):
            sx = min(2047, max(0, int(crop_x + (x / CANVAS_W) * crop_w)))
            r, g, b = px[sx, sy]
            op[x, y] = (r, g, b, pm[sx, sy])
    base = f'{name}-cutout'
    out.save(os.path.join(OUT, base + '.png'))
    out.save(os.path.join(OUT, base + '.webp'), quality=72, method=6)
    print('ok', base, os.path.getsize(os.path.join(OUT, base + '.webp')), 'bytes webp')

print('cutouts built')
