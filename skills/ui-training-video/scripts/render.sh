#!/usr/bin/env bash
# Render stills for a quick look, the full video, or a sample sheet of the rendered video.
#   render.sh <project> <lang> stills overview:2 detail 12610   -> out/still_<frame>.png + out/stills.png
#   render.sh <project> <lang>                                -> out/<name>.<lang>.mp4
#   render.sh <project> <lang> sample [spec ...]              -> out/samples.png from the mp4
#
# A spec is a scene id, "scene:line" (1-based) or a frame number — resolved to the MIDDLE of that line
# (a frame on a scene boundary is mid-fade and looks black). out/frames.<lang>.txt lists every one.
# `sample` with no specs takes 8 frames spread over the video, alternating a scene's first line (the
# sidebar click that introduces a page) with a line from its middle.
set -euo pipefail
SK="$(cd "$(dirname "$0")" && pwd)"
P="$(cd "${1:?project}" && pwd)"; L="${2:?lang}"; shift 2
NAME=$(python3 -c "import json;print(json.load(open('$P/script.$L.json')).get('name','training'))")
PY=python3; [ -x "$P/.venv/bin/python" ] && "$P/.venv/bin/python" -c "import PIL" 2>/dev/null && PY="$P/.venv/bin/python"
# Reuse a local headless shell when there is one; otherwise Remotion downloads its own.
HS=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-*/chrome-headless-shell 2>/dev/null | tail -1 || true)
BX=(); [ -n "$HS" ] && BX=(--browser-executable="$HS")
cd "$P"
MODE="${1:-render}"; [ $# -gt 0 ] && shift
case "$MODE" in
  stills)
    FRAMES=$($PY "$SK/frames.py" "$P" "$L" resolve "$@")
    OUTS=()
    for f in $FRAMES; do npx remotion still src/index.jsx "Training-$L" "out/still_$f.png" --frame="$f" "${BX[@]}" --log=error; OUTS+=("out/still_$f.png"); done
    $PY "$SK/frames.py" "$P" "$L" sheet out/stills.png "${OUTS[@]}"
    ;;
  sample)
    MP4="out/$NAME.$L.mp4"; [ -f "$MP4" ] || { echo "no $MP4 — render first"; exit 1; }
    if [ $# -gt 0 ]; then FRAMES=$($PY "$SK/frames.py" "$P" "$L" resolve "$@"); else FRAMES=$($PY "$SK/frames.py" "$P" "$L" spread 8); fi
    FPS=$(python3 -c "import json;print(json.load(open('src/timeline.$L.json'))['fps'])")
    OUTS=()
    for f in $FRAMES; do
      T=$(python3 -c "print(f'{$f / $FPS:.3f}')")
      ffmpeg -v error -y -ss "$T" -i "$MP4" -frames:v 1 "out/sample_$f.png"; OUTS+=("out/sample_$f.png")
    done
    $PY "$SK/frames.py" "$P" "$L" sheet out/samples.png "${OUTS[@]}"
    ;;
  render)
    npx remotion render src/index.jsx "Training-$L" "out/$NAME.$L.mp4" "${BX[@]}" --codec=h264 --crf=20 --concurrency=6 --log=error
    ffprobe -v error -show_entries format=duration,size -of csv=p=0 "out/$NAME.$L.mp4"
    ffmpeg -hide_banner -i "out/$NAME.$L.mp4" -af volumedetect -vn -f null - 2>&1 | grep mean_volume || echo "NO AUDIO TRACK"
    ;;
  *) echo "unknown mode $MODE (stills | sample | nothing to render)"; exit 2 ;;
esac
