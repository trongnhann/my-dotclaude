"""Resolve scene names to frames, and tile frames into a contact sheet. Used by render.sh.

    python3 frames.py <project> <lang> resolve <spec> ...     -> one absolute frame per spec
    python3 frames.py <project> <lang> spread <n>             -> n mid-line frames spread over the video
    python3 frames.py <project> <lang> sheet <out.png> <png> ...

A spec is a scene id ("overview" = the middle of its first line), "scene:line" (1-based, "overview:3" =
the middle of that line) or a plain frame number. Mid-line, because a frame on a scene boundary is
mid-fade and looks black. spread picks the first line of evenly spaced scenes — where the cursor
clicks the sidebar and the page is introduced — plus the middle of the rest, so a sample shows both.
"""
import json, pathlib, sys

P, lang, mode, *rest = pathlib.Path(sys.argv[1]).resolve(), sys.argv[2], sys.argv[3], *sys.argv[4:]


def timeline():
    t = json.loads((P / "src" / f"timeline.{lang}.json").read_text())
    start = 0
    for sc in t["scenes"]:              # timelines written before prep.py stored `start` still work
        sc.setdefault("start", start); start += sc["frames"]
        for l in sc["lines"]: l.setdefault("at", sc["start"] + l["from"])
    return t


def mid(line): return line["at"] + line["frames"] // 2


if mode == "resolve":
    t = timeline(); by = {sc["id"]: sc for sc in t["scenes"]}
    out = []
    for spec in rest:
        if spec.isdigit(): out.append(spec); continue
        sid, _, ln = spec.partition(":")
        if sid not in by: raise SystemExit(f"no scene '{sid}' (see out/frames.{lang}.txt)")
        lines = by[sid]["lines"]; i = int(ln or 1) - 1
        if not 0 <= i < len(lines): raise SystemExit(f"{sid} has {len(lines)} lines, not {i + 1}")
        out.append(str(mid(lines[i])))
    print(" ".join(out))
elif mode == "spread":
    t = timeline(); n = int(rest[0]) if rest else 8
    shots = [sc for sc in t["scenes"] if sc.get("shot")]
    step = max(1, len(shots) // n)
    picks = [sc for sc in shots[::step]][:n]
    print(" ".join(str(mid(sc["lines"][0] if k % 2 == 0 else sc["lines"][len(sc["lines"]) // 2])) for k, sc in enumerate(picks)))
elif mode == "sheet":
    from PIL import Image, ImageDraw
    out, pngs = rest[0], rest[1:]
    W, H, cols = 960, 540, 2
    ims = [Image.open(p).convert("RGB").resize((W, H)) for p in pngs]
    sheet = Image.new("RGB", (W * cols, H * ((len(ims) + cols - 1) // cols)), "white")
    for i, (im, p) in enumerate(zip(ims, pngs)):
        sheet.paste(im, ((i % cols) * W, (i // cols) * H))
        ImageDraw.Draw(sheet).text(((i % cols) * W + 8, (i // cols) * H + H - 18), pathlib.Path(p).stem, fill=(255, 220, 0))
    sheet.save(out); print(out)
else:
    raise SystemExit(f"unknown mode {mode}")
