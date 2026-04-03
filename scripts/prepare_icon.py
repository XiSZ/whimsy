from pathlib import Path

try:
    from PIL import Image
except Exception as exc:
    raise SystemExit(
        "Pillow is required for icon preparation. Install it with: python -m pip install Pillow"
    ) from exc

SRC = Path("public/xisz-icon.png")
DST = Path("public/xisz-icon-square.png")

if not SRC.exists():
    raise SystemExit(f"Source image not found: {SRC}")

img = Image.open(SRC).convert("RGBA")
size = max(img.width, img.height)
canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2))
canvas.save(DST)

print(f"Prepared square icon: {DST} ({size}x{size})")
