#!/usr/bin/env bash
# Scaffold a training-video project: Remotion template, npm packages, a venv for edge-tts + Pillow,
# an empty shots.json, and a .gitignore — the project may live inside the app's repo.
#   new_project.sh <dir>
#
# Keep the CAPTURE PROFILE OUT of this directory (open_capture_chrome.sh takes its own path): it holds
# a live login cookie. The .gitignore below also excludes chrome-profile*/ as a second lock.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: new_project.sh <dir>}"
mkdir -p "$DIR"/{public/shots,out,src}
cp -n "$SKILL/template/package.json" "$DIR/package.json"
cp -n "$SKILL/template/src/"* "$DIR/src/"
[ -f "$DIR/shots.json" ] || cat > "$DIR/shots.json" <<'JSON'
{
 "base": "http://localhost:3000/",
 "cdp": "http://127.0.0.1:9333",
 "viewport": { "width": 1600, "height": 900, "scale": 1.2 },
 "cssModule": "",
 "neverClick": "ack|delete|remove|submit|save|confirm|publish|send|trigger|run now",
 "shots": []
}
JSON
[ -f "$DIR/.gitignore" ] || cat > "$DIR/.gitignore" <<'IGN'
# Regenerable or heavy — shots.json, script.*.json and src/ are the sources worth keeping.
node_modules/
.venv/
out/
public/audio_*/
public/shots/
# A capture profile holds a live login cookie. Keep it outside the project; this is the second lock.
chrome-profile*/
*.log
IGN
cd "$DIR"
npm install --silent --no-fund --no-audit
# Pillow so check_boxes.py and contact sheets also work from the project's own Python.
python3 -m venv .venv && .venv/bin/pip install -q edge-tts pillow
echo "ready: $DIR  (node $(node -v), remotion $(node -e 'console.log(require("remotion/package.json").version)'))"
