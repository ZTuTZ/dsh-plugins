"""Normalize the BgSub cover cutouts (already transparent, correct
orientation) onto the shared square skin canvas.

Only crops/aligns; never flips. Usage: python3 scripts/build-bgsub-cutouts.py
"""
from PIL import Image, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '素材', 'spidey', 'skin-cutouts')
os.makedirs(OUT, exist_ok=True)

SRC_DIR = '/Users/aadmin/Desktop/用所选项目新建的文件夹'
SRC = {
    'suit': os.path.join(SRC_DIR, 'BgSub_home-cover-suit.png'),
    'peter': os.path.join(SRC_DIR, 'BgSub_home-cover-peter.png'),
}

CANVAS_W, CANVAS_H = 1024, 1024
FIG_H = int(CANVAS_H * 0.94)
FIG_TOP = int((CANVAS_H - FIG_H) / 2)


def bbox_of(mask, threshold=120):
    w, h = mask.size
    p = mask.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if p[x, y] > threshold:
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0, 0, w, h)
    return (min(xs), min(ys), max(xs), max(ys))


for name, path in SRC.items():
    rgba = Image.open(path).convert('RGBA')
    # erode to drop stray specks, then find the figure bounds
    eroded = rgba.getchannel('A').filter(ImageFilter.MinFilter(5))
    bx0, by0, bx1, by1 = bbox_of(eroded)
    print(name, 'figure bbox', (bx0, by0, bx1, by1), 'of', rgba.size)
    pad_x = int((bx1 - bx0) * 0.02)
    pad_y = int((by1 - by0) * 0.015)
    x0 = max(0, bx0 - pad_x)
    y0 = max(0, by0 - pad_y)
    x1 = min(rgba.size[0], bx1 + pad_x)
    y1 = min(rgba.size[1], by1 + pad_y)
    fig = rgba.crop((x0, y0, x1, y1))
    scale = FIG_H / (y1 - y0)
    fw = int((x1 - x0) * scale)
    fig = fig.resize((fw, FIG_H), Image.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    canvas.paste(fig, ((CANVAS_W - fw) // 2, FIG_TOP), fig)
    base = os.path.join(OUT, f'{name}-cutout')
    canvas.save(base + '.png')
    canvas.save(base + '.webp', quality=72, method=6)
    print('ok', name, os.path.getsize(base + '.webp'), 'bytes webp')

print('cutouts built')
