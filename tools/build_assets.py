# -*- coding: utf-8 -*-
"""Asset pipeline: cut character views (front/side/back) and comic card art
from the read-only handover package into assets/gen/. Run: py tools/build_assets.py
"""
import os, json
from collections import deque
from PIL import Image, ImageFilter, ImageDraw

SRC_VIEWS = r'F:\HuaweiMoveData\Users\yxd06\Desktop\单机版AI接手包_2026-11-04\02_完整工程\幽契\campaign\art'
SRC_ART   = r'F:\HuaweiMoveData\Users\yxd06\Desktop\单机版AI接手包_2026-11-04\03_原始素材\原始漫画卡面\cleaned'
DST   = r'F:\HuaweiMoveData\Users\yxd06\Desktop\我也不知道是什么\鬼灵契约3D\assets\gen'
SHOTS = r'F:\HuaweiMoveData\Users\yxd06\Desktop\我也不知道是什么\鬼灵契约3D\shots'

VIEW_IDS = ['tong','xuan','lingluo','jiangwei','qingzhu','isuna','xiaorou',
            'yeshuang','angel','ningdie','mengling','xuenv','yuzao','lucifer']
ART_MAP = {'伊苏娜':'isuna','凝蝶':'ningdie','夜霜':'yeshuang','小柔':'xiaorou','梦灵':'mengling',
           '江薇':'jiangwei','玉藻前':'yuzao','绫罗':'lingluo','萱华':'xuan','路西法':'lucifer',
           '雪女':'xuenv','青竹':'qingzhu','童童——普通形态':'tong',
           '童童——邪灵形态':'tong_evil','童童——女武神形态':'tong_valkyrie'}
# card art window: focus point (cx, cy) in 0..1 source coords; default (0.5, 0.30)
ART_FOCUS = {}
VIEW_H = 720          # output cutout height
ART_W = 640           # output art width
ART_ASPECT = 1.15     # card art window w/h

def bg_mask(im):
    """figure mask (255=figure) via alpha channel if present, else edge flood-fill on near-white"""
    if im.mode == 'RGBA':
        a = im.getchannel('A')
        lo, hi = a.getextrema()
        if lo < 200:  # real cutout alpha
            return a.point(lambda v: 255 if v > 32 else 0)
    rgb = im.convert('RGB'); w, h = rgb.size
    data = rgb.tobytes()
    white = bytearray(w * h)
    for i in range(w * h):
        o = i * 3
        if data[o] >= 236 and data[o+1] >= 236 and data[o+2] >= 236:
            white[i] = 1
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if white[i] and not bg[i]: bg[i] = 1; q.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if white[i] and not bg[i]: bg[i] = 1; q.append(i)
    while q:
        i = q.popleft(); x = i % w; y = i // w
        for j in (i-1, i+1, i-w, i+w):
            if 0 <= j < w*h and not bg[j] and white[j]:
                # avoid wrap-around on horizontal neighbors
                if (j == i-1 and x == 0) or (j == i+1 and x == w-1): continue
                bg[j] = 1; q.append(j)
    mask = bytearray(w * h)
    for i in range(w * h):
        if not bg[i]: mask[i] = 255
    return Image.frombytes('L', (w, h), bytes(mask))

def column_segments(mask):
    """split figure into left-to-right column runs via smoothed vertical projection;
    wide moving average so thin stray strands across real gaps don't count as content"""
    w, h = mask.size; px = mask.load()
    cols = [0] * w
    for x in range(w):
        c = 0
        for y in range(h):
            if px[x, y]: c += 1
        cols[x] = c
    cmax = max(cols) or 1
    half = max(8, w // 100)
    pref = [0] * (w + 1)
    for x in range(w): pref[x + 1] = pref[x] + cols[x]
    lo = cmax * 0.06
    runs, cur = [], None
    for x in range(w):
        a, b = max(0, x - half), min(w, x + half)
        avg = (pref[b] - pref[a]) / (b - a)
        if avg >= lo:
            if cur is None: cur = x
            last = x
        elif cur is not None and x - last > 6:
            runs.append((cur, last)); cur = None
    if cur is not None: runs.append((cur, last))
    # merge runs separated by a hairline (<2% of width)
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < w // 50: merged[-1] = (merged[-1][0], r[1])
        else: merged.append(r)
    return merged

def body_segments(mask):
    """connected-component labeling on a morphologically-opened half-scale mask
    (thin strands removed) so figures nearly touching still separate; each range
    then expands to the midpoint of the gap so strands keep their owner"""
    w, h = mask.size
    m2 = mask.resize((w // 2, h // 2), Image.NEAREST)
    opened = m2.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    ow, oh = opened.size; px = opened.load()
    lab = bytearray(ow * oh); comps = []
    for i in range(ow * oh):
        if px[i % ow, i // ow] and not lab[i]:
            lab[i] = 1; q = deque([i]); x0, x1, n = ow, 0, 0
            while q:
                j = q.popleft(); x = j % ow; y = j // ow; n += 1
                x0 = min(x0, x); x1 = max(x1, x)
                for d in (j - 1, j + 1, j - ow, j + ow):
                    if 0 <= d < ow * oh and not lab[d] and px[d % ow, d // ow]:
                        if (d == j - 1 and x == 0) or (d == j + 1 and x == ow - 1):
                            continue
                        lab[d] = 1; q.append(d)
            comps.append((n, x0 * 2, (x1 + 1) * 2))
    comps = sorted(comps, reverse=True)[:3]
    runs = sorted((c[1], c[2]) for c in comps)
    out = []
    for i, r in enumerate(runs):
        x0 = 0 if i == 0 else (runs[i - 1][1] + r[0]) // 2
        x1 = w - 1 if i == len(runs) - 1 else (r[1] + runs[i + 1][0]) // 2
        out.append((x0, x1))
    return out

def tight_bbox(mask, xr):
    w, h = mask.size; px = mask.load()
    x0, x1, y0, y1 = w, 0, h, 0
    for x in range(xr[0], xr[1] + 1):
        for y in range(h):
            if px[x, y]:
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
    if x1 <= x0 or y1 <= y0: return None
    return (x0, y0, x1 + 1, y1 + 1)

def process_view(sid):
    im = Image.open(os.path.join(SRC_VIEWS, sid + '-views.png'))
    mask = bg_mask(im)
    segs = body_segments(mask)
    if len(segs) < 3:
        print(f'  !! {sid}: only {len(segs)} segments found'); segs += [(0,0)] * (3 - len(segs))
    rgba = im.convert('RGBA')
    out = {}
    for name, xr in zip(('front', 'side', 'back'), segs):
        bb = tight_bbox(mask, xr)
        if not bb: continue
        cm = mask.crop(bb)
        # shrink 1px to kill white halo, then feather ~0.6px
        cm = cm.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
        fig = rgba.crop(bb); fig.putalpha(cm)
        fig = fig.crop(fig.getbbox())
        s = VIEW_H / fig.height
        fig = fig.resize((max(1, round(fig.width * s)), VIEW_H), Image.LANCZOS)
        fn = f'views/{sid}_{name}.webp'
        fig.save(os.path.join(DST, fn), 'WEBP', quality=88, method=6)
        out[name] = {'file': fn, 'w': fig.width, 'h': fig.height}
    return out, mask

def process_art(key, sid):
    p = os.path.join(SRC_ART, key + '-clean.png')
    im = Image.open(p).convert('RGB')
    w, h = im.size
    cx, cy = ART_FOCUS.get(sid, (0.5, 0.30))
    tw = w; th = int(tw / ART_ASPECT)
    if th > h: th = h; tw = int(th * ART_ASPECT)
    x0 = int(max(0, min(w - tw, cx * w - tw / 2)))
    y0 = int(max(0, min(h - th, cy * h - th / 2)))
    crop = im.crop((x0, y0, x0 + tw, y0 + th))
    s = ART_W / crop.width
    crop = crop.resize((ART_W, max(1, round(crop.height * s))), Image.LANCZOS)
    fn = f'art/{sid}.webp'
    crop.save(os.path.join(DST, fn), 'WEBP', quality=85, method=6)
    return {'file': fn, 'w': crop.width, 'h': crop.height, 'focus': [cx, cy]}, crop

def contact_sheets(view_masks, art_crops):
    th = 220
    ids = VIEW_IDS
    cols = 6; cw, ch = 150, 270
    total = len(ids) * 3
    sheet = Image.new('RGB', (cols * cw, ((total + cols - 1) // cols) * ch), (18, 16, 26))
    d = ImageDraw.Draw(sheet)
    cell = 0
    for sid in ids:
        for sub in ('front', 'side', 'back'):
            p = os.path.join(DST, 'views', f'{sid}_{sub}.webp')
            if not os.path.exists(p): continue
            fig = Image.open(p)
            s = th / fig.height
            fig = fig.resize((round(fig.width * s), th), Image.LANCZOS)
            x, y = (cell % cols) * cw, (cell // cols) * ch
            cell += 1
            sheet.paste(fig, (x + (cw - fig.width) // 2, y + 22), fig)
            d.text((x + 8, y + 4), f'{sid}_{sub}', fill=(220, 215, 200))
    sheet.save(os.path.join(SHOTS, 'assets_views.png'))
    cols = 5; cw, ch = 260, 300
    sheet = Image.new('RGB', (cols * cw, ((len(art_crops) + cols - 1) // cols) * ch), (18, 16, 26))
    d = ImageDraw.Draw(sheet)
    for i, (sid, crop) in enumerate(sorted(art_crops.items())):
        fig = crop.copy(); fig.thumbnail((cw - 10, ch - 30), Image.LANCZOS)
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.paste(fig, (x + 5, y + 26)); d.text((x + 8, y + 6), sid, fill=(220, 215, 200))
    sheet.save(os.path.join(SHOTS, 'assets_art.png'))

def main():
    os.makedirs(os.path.join(DST, 'views'), exist_ok=True)
    os.makedirs(os.path.join(DST, 'art'), exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    manifest = {'views': {}, 'art': {}}
    view_masks = {}
    for sid in VIEW_IDS:
        out, mask = process_view(sid)
        manifest['views'][sid] = out; view_masks[sid] = mask
        print(f'  views {sid}: {list(out)}')
    art_crops = {}
    for key, sid in ART_MAP.items():
        info, crop = process_art(key, sid)
        manifest['art'][sid] = info; art_crops[sid] = crop
        print(f'  art   {sid}: {info["w"]}x{info["h"]}')
    with open(os.path.join(DST, 'manifest.json'), 'w', encoding='utf8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    contact_sheets(view_masks, art_crops)
    print('done ->', DST)

if __name__ == '__main__':
    main()
