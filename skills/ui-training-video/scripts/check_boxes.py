"""Draw every captured box on its screenshot, named, and tile them into contact sheets.

    python3 check_boxes.py <project>                  -> out/box_check.png (one sheet, or box_check_1..N)
    python3 check_boxes.py <project> o_               -> only shots whose name starts with o_
    python3 check_boxes.py <project> o_ 3 6           -> 3 columns, 6 shots per sheet

Look at it before writing the script: a box that is off by a row is a highlight on the wrong thing,
and nothing downstream will notice. Labels are drawn AFTER scaling down, so they stay readable at
any shot count; a long capture is split into several sheets rather than shrunk into one.
Boxes the capture could not find are listed on stdout.
"""
import json, pathlib, sys
from PIL import Image, ImageDraw, ImageFont

P = pathlib.Path(sys.argv[1]).resolve()
pre = sys.argv[2] if len(sys.argv) > 2 else ""
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 2
per = int(sys.argv[4]) if len(sys.argv) > 4 else 8
shots = sorted(p for p in (P / "public" / "shots").glob(f"{pre}*.png") if not p.name.startswith("_"))
if not shots:
    raise SystemExit(f"no shots matching {pre!r} in {P / 'public' / 'shots'}")

W, H, BAR = 960, 540, 26
def font(size):
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try: return ImageFont.truetype(f, size)
        except Exception: pass
    return ImageFont.load_default()
F, FT = font(15), font(17)

missing, outs = [], []
chunks = [shots[i:i + per] for i in range(0, len(shots), per)]
(P / "out").mkdir(exist_ok=True)
for n, chunk in enumerate(chunks, 1):
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (W * cols, (H + BAR) * rows), "white")
    for i, png in enumerate(chunk):
        im = Image.open(png).convert("RGB")
        sx, sy = W / im.width, H / im.height
        im = im.resize((W, H)); d = ImageDraw.Draw(im)
        meta = png.with_suffix(".json")
        boxes = json.loads(meta.read_text()) if meta.exists() else {}
        for k, b in boxes.items():
            if not b:
                missing.append(f"{png.stem}.{k}"); continue
            x, y, w, h = b["x"] * sx, b["y"] * sy, b["w"] * sx, b["h"] * sy
            d.rectangle([x, y, x + w, y + h], outline=(230, 30, 30), width=3)
            ty = y - 19 if y >= 19 else y + 1          # label above the box, or inside it at the top edge
            tw = d.textlength(k, font=F) + 8
            d.rectangle([x, ty, x + tw, ty + 18], fill=(230, 30, 30))
            d.text((x + 4, ty + 1), k, fill="white", font=F)
        cx, cy = (i % cols) * W, (i // cols) * (H + BAR)
        sheet.paste(im, (cx, cy + BAR))
        ImageDraw.Draw(sheet).text((cx + 6, cy + 4), png.stem, fill="black", font=FT)
    name = f"box_check{('_' + pre.rstrip('_*')) if pre else ''}{('_' + str(n)) if len(chunks) > 1 else ''}.png"
    sheet.save(P / "out" / name); outs.append(P / "out" / name)

for o in outs: print(o)
print(f"{len(shots)} shots on {len(outs)} sheet(s)")
if missing:
    print("boxes that matched nothing (fix the selector or drop the box):\n  " + "\n  ".join(missing))
