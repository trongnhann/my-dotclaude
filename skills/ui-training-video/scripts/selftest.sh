#!/usr/bin/env bash
# Self-test for capture.js against a local fixture page, in a throwaway headless Chrome.
# No app, no login, nothing leaves the machine. Run it after touching capture.js:
#   selftest.sh <project-dir>      (any project made by new_project.sh — it supplies puppeteer-core)
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="$(cd "${1:?usage: selftest.sh <project-dir>}" && pwd)"
T="$(mktemp -d)"
# Wait for Chrome to exit before removing its profile, or rm races the files it is still writing.
cleanup() { kill "$CPID" 2>/dev/null || true; wait "$CPID" 2>/dev/null || true; rm -rf "$T"; }
trap cleanup EXIT
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --remote-debugging-port=9444 --user-data-dir="$T/profile" --no-first-run about:blank > "$T/chrome.log" 2>&1 &
CPID=$!
for i in $(seq 1 40); do curl -s http://127.0.0.1:9444/json/version > /dev/null && break; sleep 0.25; done
mkdir -p "$T/p"; ln -s "$PROJ/node_modules" "$T/p/node_modules"
sed "s#FIXTURE_URL#file://$SKILL/scripts/selftest/fixture.html#" "$SKILL/scripts/selftest/shots.json" > "$T/p/shots.json"
set +e; node "$SKILL/scripts/capture.js" "$T/p/shots.json" > "$T/out.txt" 2>&1; CODE=$?; set -e
node "$SKILL/scripts/explore.js" "$T/p/shots.json" survey "" > "$T/survey.txt" 2>&1 || true
node "$SKILL/scripts/explore.js" "$T/p/shots.json" list "" "@cardTitle" > "$T/list.txt" 2>&1 || true
node "$SKILL/scripts/explore.js" "$T/p/shots.json" peek "" 0 "$T/peek.png" > "$T/peek.txt" 2>&1 || true
node - "$T/out.txt" "$T/p/public/shots" "$CODE" "$T" <<'JS'
const fs = require("fs"), [, , outFile, dir, code, tmp] = process.argv
const rd = f => { try { return fs.readFileSync(`${tmp}/${f}`, "utf8") } catch (_) { return "" } }
const out = fs.readFileSync(outFile, "utf8"), box = n => JSON.parse(fs.readFileSync(`${dir}/${n}.json`, "utf8"))
const checks = [
  ["text: a glyph-prefixed heading matches without ^", () => box("t_text").card],
  ["text: pick:last takes the leaf, not the ancestor", () => box("t_text").leaf && box("t_text").leaf.h < 40],
  ["text: whitespace inside a <select> is normalised", () => box("t_text").win],
  ["text: matching is case-insensitive", () => box("t_text").nav],
  ["anchor: ^ before a glyph-prefixed heading fails loudly", () => /t_anchor: FAILED — tag target not found/.test(out)],
  ["guard: safe lets an opener through, dialog opens", () => box("t_safe").dlg && box("t_safe").dlg.h > 0 && box("t_safe").queue],
  ["guard: an opener whose title names the write is refused", () => /t_refuse_title: FAILED — REFUSED/.test(out)],
  ["guard: Save is refused", () => /t_refuse_save: FAILED — REFUSED/.test(out)],
  ["two-step: first press arms, armed button is boxed", () => box("t_twostep").armed],
  ["two-step: the second (confirm) press is refused", () => /t_twostep_second: FAILED — REFUSED/.test(out)],
  ["tag: two tags on one element are reported", () => /t_collide: FAILED — tag "b" landed on the element already tagged "a"/.test(out)],
  ["warn: a box taller than the screen is flagged", () => /t_offscreen\.tall: runs off screen/.test(out)],
  ["warn: a box below the fold is flagged", () => /t_offscreen\.below: entirely off screen/.test(out)],
  ["run: keeps going past failures and exits 1", () => code === "1" && /shots captured.* — FAILED: /.test(out)],
  ["csp: nothing tripped the page's no-eval policy", () => !/EvalError|unsafe-eval/i.test(out)],
  ["explore survey: lists every button, write controls included", () => /BUTTONS:.*Save config/.test(rd("survey.txt")) && /Retry failed \(13\)/.test(rd("survey.txt"))],
  ["explore survey: reports the CSS-module classes", () => /MODULES:.*fx_card/.test(rd("survey.txt"))],
  ["explore list: expands @name and prints position + text", () => /span\.fx_cardTitle.*Getting started/.test(rd("list.txt"))],
  ["explore peek: writes a screenshot", () => fs.existsSync(`${tmp}/peek.png`) && fs.statSync(`${tmp}/peek.png`).size > 1000],
]
let bad = 0
for (const [name, fn] of checks) { let ok = false; try { ok = !!fn() } catch (_) {} ; if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`) }
if (bad) { console.log("\n--- capture output ---\n" + out); process.exit(1) }
console.log(`\nall ${checks.length} checks passed`)
JS
