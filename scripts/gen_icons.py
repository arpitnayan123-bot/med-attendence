#!/usr/bin/env python3
"""Generate AttendMate Pro PWA icons (192/512) — rounded warm-gradient square
with a bold white "A", maskable-safe (logo inside the 80% safe zone)."""
from PIL import Image, ImageDraw

SIZES = [192, 512]
ORANGE = (234, 88, 12)   # orange-600
ROSE = (244, 63, 94)     # rose-500

def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(ORANGE[0] + (ROSE[0] - ORANGE[0]) * t)
        g = int(ORANGE[1] + (ROSE[1] - ORANGE[1]) * t)
        b = int(ORANGE[2] + (ROSE[2] - ORANGE[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img

def rounded_mask(size: int, radius_ratio: float = 0.22) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask

def make(size: int, maskable: bool = False) -> Image.Image:
    img = gradient(size).convert("RGBA")
    if not maskable:
        img.putalpha(rounded_mask(size))
    d = ImageDraw.Draw(img)
    # DejaVu Sans Bold ships with matplotlib/PIL environments
    from PIL import ImageFont
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    # maskable: keep the glyph inside the inner 80% safe zone
    box = 0.62 if maskable else 0.72
    font = ImageFont.truetype(font_path, int(size * box))
    a = "A"
    bbox = d.textbbox((0, 0), a, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), a, font=font, fill=(255, 255, 255, 255))
    return img

import os
os.makedirs("public/icons", exist_ok=True)
for s in SIZES:
    make(s).save(f"public/icons/icon-{s}.png")
make(512, maskable=True).save("public/icons/icon-maskable-512.png")
print("icons written:", os.listdir("public/icons"))
