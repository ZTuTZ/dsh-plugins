"""Process the user-provided cover cutouts (white background) into transparent
skin hero cutouts.

The user's tool removed the cover background but left a near-white backdrop.
The figure's own whites (eyes, tee, sneakers) share the same color, so we
flood-fill from the frame borders instead of a global color key, then crop and
normalize both figures onto the same 3:4 canvas.

Usage: python3 scripts/build-user-cutouts.py
"""
from PIL import Image, ImageFilter
from collections import deque
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '素材', 'spidey', 'skin-cutouts')
os.makedirs(OUT, exist_ok=True)

DESKTOP = '/Users/aadmin/Desktop'
SRC = {
    'suit': os.path.join(DESKTOP, '调整图片背景为透明.png'),
    'peter': os.path.join(DESKTOP, '调整图片背景为透明 (1).png'),
}

CANVAS_W, CANVAS_H = 1024, 1024
FIG_H = int(CANVAS_H * 0.94)
FIG_TOP = int((CANVAS_H - FIG_H) / 2)


def key_white(im, tolerance=34):
    """Remove the border-connected near-white backdrop via BFS flood fill.

    Pixels close to pure white are candidates; the connected component that
    touches the frame border is the background and is keyed out. Interior
    white regions of the figure (eyes, tee, sneakers) survive because they are
    enclosed by non-white figure pixels.
    """
    w, h = im.size
    raw = im.tobytes()
    n = w * h
    candidate = bytearray(n)
    t2 = tolerance * tolerance
    for i in range(n):
        r = raw[i * 3]
        g = raw[i * 3 + 1]
        b = raw[i * 3 + 2]
        dr = 255 - r
        dg = 255 - g
        db = 255 - b
        if dr * dr + dg * dg + db * db <= t2:
            candidate[i] = 1

    visited = bytearray(n)
    q = deque()
    for y in range(h):
        for x in range(w):
            if x in (0, w - 1) or y in (0, h - 1):
                i = y * w + x
                if candidate[i] and not visited[i]:
                    visited[i] = 1
                    q.append(i)
    while q:
        i = q.popleft()
        x = i % w
        y = i // w
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            ni = ny * w + nx
            if candidate[ni] and not visited[ni]:
                visited[ni] = 1
                q.append(ni)

    rgba = im.convert('RGBA')
    op = rgba.load()
    for y in range(h):
        base = y * w
        for x in range(w):
            if visited[base + x]:
                op[x, y] = (op[x, y][0], op[x, y][1], op[x, y][2], 0)
    return rgba


def keep_largest_component(rgba):
    """Zero out alpha except the largest connected opaque region (the figure)."""
    w, h = rgba.size
    a = rgba.getchannel('A')
    ap = a.load()
    n = w * h
    visited = bytearray(n)
    best = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if visited[i] or ap[x, y] < 100:
                continue
            comp = []
            q = [i]
            visited[i] = 1
            while q:
                j = q.pop()
                cx = j % w
                cy = j // w
                comp.append(j)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    ni = ny * w + nx
                    if not visited[ni] and ap[nx, ny] >= 100:
                        visited[ni] = 1
                        q.append(ni)
            if len(comp) > len(best):
                best = comp
    mask = bytearray(n)
    for j in best:
        mask[j] = 1
    op = rgba.load()
    for y in range(h):
        for x in range(w):
            if not mask[y * w + x]:
                op[x, y] = (op[x, y][0], op[x, y][1], op[x, y][2], 0)
    return rgba


def bbox_of(rgba, threshold=120):
    w, h = rgba.size
    a = rgba.getchannel('A') if 'A' in rgba.getbands() else rgba
    ap = a.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if ap[x, y] > threshold:
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0, 0, w, h)
    return (min(xs), min(ys), max(xs), max(ys))


def save_cutout(rgba, name):
    base = os.path.join(OUT, f'{name}-cutout')
    rgba.save(base + '.png')
    rgba.save(base + '.webp', quality=72, method=6)
    print('ok', name, os.path.getsize(base + '.webp'), 'bytes webp')


cutouts = {}
for name, path in SRC.items():
    im = Image.open(path).convert('RGB')
    w, h = im.size
    # loose crop around the figure (right portion)
    crop = im.crop((int(w * 0.40), 0, w, h))
    rgba = key_white(crop)
    # open: kill speckles, then keep only the main figure component
    opened = rgba.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    rgba.putalpha(opened)
    rgba = keep_largest_component(rgba)
    eroded = rgba.getchannel('A').filter(ImageFilter.MinFilter(3))
    bbox = bbox_of(eroded)
    print(name, 'source', (w, h), 'crop', crop.size, 'figure bbox', bbox)
    cutouts[name] = (rgba, bbox)

# normalize both to the same framing
for name, (rgba, bbox) in cutouts.items():
    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    pad_x = int(bw * 0.02)
    pad_y = int(bh * 0.01)
    x0 = max(0, bbox[0] - pad_x)
    y0 = max(0, bbox[1] - pad_y)
    x1 = min(rgba.size[0], bbox[2] + pad_x)
    y1 = min(rgba.size[1], bbox[3] + pad_y)
    fig = rgba.crop((x0, y0, x1, y1))
    scale = FIG_H / (y1 - y0)
    fw = int((x1 - x0) * scale)
    fig = fig.resize((fw, FIG_H), Image.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    canvas.paste(fig, ((CANVAS_W - fw) // 2, FIG_TOP), fig)
    # soften hard alpha edges a touch
    a = canvas.getchannel('A').filter(ImageFilter.GaussianBlur(0.6))
    canvas.putalpha(a)
    save_cutout(canvas, name)

print('cutouts built')
