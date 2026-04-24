"""Run this once to generate the extension icons. Requires Pillow: pip install pillow"""
from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size):
    # Dark navy background
    img = Image.new("RGBA", (size, size), (18, 24, 48, 255))
    draw = ImageDraw.Draw(img)

    # Rounded border in purple
    draw.rounded_rectangle(
        [2, 2, size - 3, size - 3],
        radius=size // 5,
        outline=(149, 117, 205, 255),
        width=max(1, size // 20),
    )

    # Globe circle in the center
    cx, cy = size // 2, size // 2
    r = int(size * 0.28)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(79, 195, 247, 255), width=max(1, size // 32))

    # Horizontal lines across globe (latitude)
    for offset in [-r // 2, 0, r // 2]:
        chord_half = int((r**2 - offset**2) ** 0.5)
        draw.line([cx - chord_half, cy + offset, cx + chord_half, cy + offset],
                  fill=(79, 195, 247, 100), width=max(1, size // 48))

    # Vertical center line (longitude)
    draw.line([cx, cy - r, cx, cy + r], fill=(79, 195, 247, 100), width=max(1, size // 48))

    # Small arrow below globe: A -> B to hint at translation
    font_size = max(8, size // 7)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
        font_small = ImageFont.truetype("arial.ttf", max(6, size // 9))
    except Exception:
        font = ImageFont.load_default()
        font_small = font

    label = "A → B"
    bbox = draw.textbbox((0, 0), label, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text(((size - tw) / 2, size * 0.74), label, font=font_small, fill=(149, 117, 205, 255))

    return img

os.makedirs("icons", exist_ok=True)
for sz in [48, 128]:
    make_icon(sz).save(f"icons/icon{sz}.png")
    print(f"Created icons/icon{sz}.png")
