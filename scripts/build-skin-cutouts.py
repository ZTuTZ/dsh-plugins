"""Build the transparent skin cutouts.

- Suit: taken as-is from the site's transparent classic suit render (suit-06),
  normalized onto a 900x1200 canvas (figure height 92%, top margin 4%).
- Peter: chroma-key the generated red-background render and normalize the
  figure onto the exact same canvas framing so the reveal doesn't jump.

Usage: python3 scripts/build-skin-cutouts.py
"""
from PIL import Image, ImageFilter
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(ROOT, '素材', 'spidey', 'skin-hero')
OUT = os.path.join(ROOT, '素材', 'spidey', 'skin-cutouts')
SITE_SUIT = '/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public/suits-normalized/suit-06.png'
os.makedirs(OUT, exist_ok=True)

CANVAS_W, CANVAS_H = 900, 1200
FIG_H = int(CANVAS_H * 0.92)
FIG_TOP = int(CANVAS_H * 0.04)


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


def save_cutout(rgba, name):
    base = os.path.join(OUT, f'{name}-cutout')
    rgba.save(base + '.png')
    rgba.save(base + '.webp', quality=72, method=6)
    print('ok', name, os.path.getsize(base + '.webp'), 'bytes webp')


# --- suit: normalize the site's transparent render ---
suit_src = Image.open(SITE_SUIT).convert('RGBA')
bbox = suit_src.getchannel('A').getbbox()
fig = suit_src.crop(bbox)
scale = FIG_H / (bbox[3] - bbox[1])
fw = int((bbox[2] - bbox[0]) * scale)
fig = fig.resize((fw, FIG_H), Image.LANCZOS)
suit_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
suit_canvas.paste(fig, ((CANVAS_W - fw) // 2, FIG_TOP), fig)
save_cutout(suit_canvas, 'suit')

# --- peter: key the red background and align to the suit framing ---
peter_src = Image.open(os.path.join(HERO, 'peter.png')).convert('RGB')
rows = bg_model(peter_src)
mask = fg_mask(peter_src, rows)
mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
mask = mask.filter(ImageFilter.GaussianBlur(1.6))

bx0, by0, bx1, by1 = bbox_of(mask)
print('peter bbox:', bx0, by0, bx1, by1)
px_src = peter_src.load()
pm = mask.load()
peter_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
op = peter_canvas.load()

fig_h = by1 - by0
scale_p = FIG_H / fig_h
fig_w = int((bx1 - bx0) * scale_p)
ox = (CANVAS_W - fig_w) // 2
for y in range(FIG_H):
    sy = min(2047, max(0, int(by0 + y / scale_p)))
    for x in range(fig_w):
        sx = min(2047, max(0, int(bx0 + x / scale_p)))
        r, g, b = px_src[sx, sy]
        op[ox + x, FIG_TOP + y] = (r, g, b, pm[sx, sy])

save_cutout(peter_canvas, 'peter')
print('cutouts built')
