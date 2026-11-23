#!/usr/bin/env python3
# P2-3: generate the 1200x630 OG share card (public/og.png).
from PIL import Image, ImageDraw, ImageFilter

W, H = 1200, 630
img = Image.new("RGB", (W, H), "#0c0a09")
d = ImageDraw.Draw(img)

# warm gradient wash: dark slate with orange/rose glow corners
glow = Image.new("RGB", (W, H), "#0c0a09")
gd = ImageDraw.Draw(glow)
gd.ellipse([-300, -350, 700, 300], fill="#c2410c")   # orange top-left
gd.ellipse([W - 620, H - 420, W + 300, H + 300], fill="#9f1239")  # rose bottom-right
glow = glow.filter(ImageFilter.GaussianBlur(180))
img = Image.blend(img, glow, 0.55)
d = ImageDraw.Draw(img)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(path, size):
    return ImageFont.truetype(path, size) if False else ImageFont.ImageFont()  # placeholder

from PIL import ImageFont
f_brand = ImageFont.truetype(FB, 96)
f_sub = ImageFont.truetype(FB, 40)
f_tag = ImageFont.truetype(FR, 30)
f_small = ImageFont.truetype(FB, 26)

def center(text, f, y, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)

center("AttendMate Pro", f_brand, 170, "#fff7ed")
center("NSMCH Bihta · Phase-III (Part-2) · Session 2026–28", f_sub, 300, "#fed7aa")
center("Offline-first attendance tracking with honest arithmetic —", f_tag, 400, "#e7e5e4")
center("safe-skip maths, roster-resolved postings, exam-aware projections.", f_tag, 445, "#e7e5e4")

# bottom chips
chips = ["Device-only data", "Optional account", "Works offline"]
x = W / 2 - 520
for c in chips:
    w = d.textlength(c, font=f_small)
    d.rounded_rectangle([x, 530, x + w + 44, 580], radius=24, outline="#fdba74", width=3)
    d.text((x + 22, 541), c, font=f_small, fill="#fdba74")
    x += w + 74

img.save("/home/z/my-project/public/og.png", optimize=True)
print("og.png saved", img.size)
