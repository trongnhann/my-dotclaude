#!/usr/bin/env bash
# Block until the capture Chrome is really logged in: a page tab sits at a URL starting with
# <url-prefix> that is not a login URL, and it is still there on the next poll.
#   wait_login.sh <url-prefix> [port] [timeout-seconds]
#
# Why the second poll: a tab opened at the protected URL shows that URL for a moment before the app
# redirects it to /login — a single look read that as "logged in" and would have captured the login
# page. capture.js / explore.js also warn if a page they open is a login form.
PREFIX="${1:?usage: wait_login.sh <url-prefix> [port] [timeout]}"
PORT="${2:-9333}"; LIMIT="${3:-300}"
look() {
  curl -s "http://127.0.0.1:$PORT/json/list" | python3 -c "
import json, sys
tabs = [t for t in json.load(sys.stdin) if t['type'] == 'page']
hit = next((t for t in tabs if t['url'].startswith(sys.argv[1]) and 'login' not in t['url'].lower()), None)
print((hit['url'] if hit else '') + ' |' + ' ; '.join(t['url'][:80] for t in tabs))" "$PREFIX"
}
ok=""; tabs=""
for i in $(seq 1 $((LIMIT / 3))); do
  R=$(look); U="${R%% |*}"; tabs="${R#*|}"
  if [ -n "$U" ]; then
    [ -n "$ok" ] && { echo "logged in: $U"; exit 0; }
    ok=1
  else
    ok=""
  fi
  sleep 3
done
echo "still not logged in — tabs:${tabs:0:240}"
echo "if login lands somewhere unreachable (a redirect_url of 0.0.0.0 or localhost), open the login URL"
echo "with redirect_url set to the real page — see reference/gotchas.md"
exit 1
