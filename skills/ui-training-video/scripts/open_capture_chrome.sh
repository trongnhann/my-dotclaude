#!/usr/bin/env bash
# Open a SEPARATE Chrome window (throwaway profile, remote debugging on :9333) at the app's URL.
# The user logs in there themselves; capture.js then drives that window. Their everyday Chrome
# and its profile are never touched.
#   open_capture_chrome.sh <url> <profile-dir> [port]
#
# Idempotent: if a capture Chrome already answers on <port> (the user closed the tab, or you are
# coming back to it), it opens <url> in a new tab of that same Chrome — the login in its profile
# survives — instead of starting a second browser that cannot bind the port.
#
# The login is a session cookie in <profile-dir>: keep <profile-dir> OUTSIDE the project and any repo,
# and tell the user to close the window when capture is done.
set -euo pipefail
URL="${1:?usage: open_capture_chrome.sh <url> <profile-dir> [port]}"
PROFILE="${2:?profile dir}"
PORT="${3:-9333}"
if curl -s -m 2 "http://127.0.0.1:$PORT/json/version" > /dev/null; then
  curl -s -m 5 -X PUT "http://127.0.0.1:$PORT/json/new?$URL" > /dev/null
  echo "capture Chrome already on :$PORT — opened $URL in a new tab"
  exit 0
fi
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$PROFILE"
nohup "$CHROME" --user-data-dir="$PROFILE" --remote-debugging-port="$PORT" --no-first-run \
      --no-default-browser-check --window-size=1600,1000 "$URL" > "$PROFILE.log" 2>&1 &
for i in $(seq 1 20); do curl -s "http://127.0.0.1:$PORT/json/version" > /dev/null && break; sleep 0.5; done
echo "capture Chrome on :$PORT — waiting for the user to log in at $URL"
