#!/usr/bin/env bash
# Render one short, NON-SENSITIVE sentence per candidate voice so the user can pick by ear.
#   voice_samples.sh <project> "<vi sentence>" "<en sentence>"
# Only this sample text leaves the machine (edge-tts calls Microsoft); the real script does not,
# until the user has agreed to it.
set -euo pipefail
P="${1:?project}"; VI="${2:?vi text}"; EN="${3:?en text}"
OUT="$P/out/voice_samples"; mkdir -p "$OUT"
for v in vi-VN-NamMinhNeural vi-VN-HoaiMyNeural; do "$P/.venv/bin/edge-tts" --voice $v --text "$VI" --write-media "$OUT/$v.mp3"; done
for v in en-US-AndrewNeural en-US-AvaNeural en-US-EmmaNeural en-US-BrianNeural; do "$P/.venv/bin/edge-tts" --voice $v --text "$EN" --write-media "$OUT/$v.mp3"; done
say -v Linh -o "$OUT/macos-Linh.aiff" "$VI" && ffmpeg -v error -y -i "$OUT/macos-Linh.aiff" "$OUT/macos-Linh.m4a" && rm "$OUT/macos-Linh.aiff"
ls "$OUT"
