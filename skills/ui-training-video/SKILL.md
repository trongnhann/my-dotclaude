---
name: ui-training-video
description: Make a narrated training / feature-walkthrough video of a web app from REAL screenshots — the way a PO demos a new feature to users. Captures the live UI over Chrome DevTools in a window the user logs into, then Remotion renders camera zooms, highlight boxes with labels, an animated cursor, burned-in captions and a neural voice-over (Vietnamese and/or English), plus an .srt. Use when asked for a training video, demo video, walkthrough clip, feature tour, "video hướng dẫn", "clip training", or to turn a tool's features into a video for users.
metadata:
  version: "1.1"
  first_used: 2026-09 (an internal admin dashboard)
  changelog: 1.1 adds text targeting, explore.js, a self-test, cached/parallel voicing, stills by scene name
---

# UI training video

Screenshots of the real app → `shots.json` says what to capture and which regions to highlight →
`script.<lang>.json` says what the narrator says in each scene and what to point at while saying
it → `prep.py` voices every line and builds a timeline from the measured audio → Remotion renders.

Everything lives in one project folder — the scratchpad by default, or inside the app's repo when
the user wants it kept (`new_project.sh` writes a `.gitignore` for that). The capture Chrome's
profile holds a live login cookie: keep it OUTSIDE the project, always. Scripts are in this
skill's `scripts/`; a small worked example is `examples/sample-app/`. Read
`reference/gotchas.md` before capturing — every item in it cost a re-render once.

## Rules that do not bend

- **The user logs in, never you.** Open a separate Chrome (`open_capture_chrome.sh`) and wait
  (`wait_login.sh`). Never read, print or copy the session cookie; never type a password.
- **Capture is read-only.** GETs, tabs, filters, expanding a row, forced hover. `capture.js`
  refuses to click anything matching `neverClick`; a harmless tick gets `"safe": "<why>"`. If a
  scene needs a write to *happen* (a real ack, a real submit), stop and ask — show the control
  instead of pressing it.
- **Know every write control before the first click.** Survey each page's buttons
  (`explore.js survey`) and read the code of every one that could write: does it fire, open a
  dialog, or arm a second press? Put what fires in `neverClick`. A two-step button (first press
  arms, second confirms) may be pressed ONCE to show its confirmation — the guard refuses the
  armed "Confirm". A button that only opens a dialog but whose title names the write behind it
  ("Queue a run…") is refused too; pass it with `safe` and say why.
- **Ask before the script leaves the machine.** edge-tts / Azure / any SaaS voice receives the
  narration text. Voice samples use one neutral sentence; the full script goes only after a yes.
- **Say the licence — `reference/licensing.md`.** Remotion is free only while evaluating; once a
  company over 3 people uses the video (internal counts) it needs a Creator seat, $25/month per
  person editing the project; rendered videos stay usable after cancelling. edge-tts is free but
  unofficial — re-voice anything published through Azure (free tier covers a video); macOS voices
  are personal-use only. Say this when handing over a final video, before anyone publishes it.
- **Never claim you listened.** You can check duration, audio level and frames — not how it
  sounds. Say which of those you checked.

## Procedure

1. **Scope with the user**: which page(s), audience, language(s), ~length (3 min ≈ 12–14 scenes,
   ~35 lines). Read the app's code for the features and their exact UI labels — narration must
   name what the screen shows.
2. **Scaffold**: `scripts/new_project.sh <dir>` (Remotion 4 + puppeteer-core + `.venv` with
   edge-tts and Pillow, an empty `shots.json`, a `.gitignore`).
3. **Open the capture window**: `scripts/open_capture_chrome.sh <url> <profile-dir-outside-the-project>`,
   tell the user to log in *in that window*, then `scripts/wait_login.sh <url-prefix>`. Running
   the opener again reuses that Chrome (new tab, same login) — use it if the tab was closed.
4. **Explore** with `node scripts/explore.js <dir>/shots.json survey <path> ...` (headings, every
   button, CSS-module classes), `list <path> "<selector>"` (position, height, text) and
   `peek <path> <scrollY>` (a screenshot to plan scenes). CSS-module apps: set
   `"cssModule": "app_"` and write `@card`. Read the code behind each write-looking button (rule above).
5. **Write `shots.json`** (format and every step in `capture.js`'s header). One shot per scene;
   `boxes` = every region a line will highlight or zoom to. Buttons and headings with no unique
   class: `{"tag": "button", "text": "^Run domain$", "as": "rundom"}` then box `[data-tv=rundom]`.
6. **Capture**: `node scripts/capture.js <dir>/shots.json [name | "prefix*"] ...` — it keeps going
   past a failing shot and warns about boxes that miss or run off the screen. Then
   `python3 scripts/check_boxes.py <dir> [prefix]` and LOOK at the sheets. Iterate shot by shot;
   when every shot passes, recapture the whole set in ONE run so live numbers agree across scenes.
7. **Write `script.<lang>.json`**: per scene `shot`, `chapter`, `focus`; per line `text`
   (caption), optional `say` (pronunciation), `mark` [`{box, label, click?}`], optional `focus`
   (zoom for that line). `card: "intro" | "outro"` scenes use `cards`. `view.cropLeft` hides a
   sidebar. One idea per line, ≤ ~25 words; labels 1–3 words in the video's language.
   `python3 scripts/prep.py <dir>/script.<lang>.json --check` validates it against the captured
   boxes without voicing anything. Sizing: ~150 spoken words a minute; a thorough tour of 10 pages
   came to 60 scenes / 169 lines / 18 min — offer a short cut alongside anything that long.
   **Sidebar wanted in frame?** Leave `cropLeft` unset, and open every page with a line that marks
   its sidebar link (`click: true`): zoomed lines crop the sidebar, so this is where it is seen.
8. **Voices**: `scripts/voice_samples.sh <dir> "<vi>" "<en>"` → send the files, let the user pick,
   set `voice`. Get the yes for sending the script (rule above).
9. **Build**: `python3 scripts/prep.py <dir>/script.<lang>.json` per language → audio, timeline,
   `out/<name>.<lang>.srt`, `out/frames.<lang>.txt`, composition `Training-<lang>`. It validates the
   whole script first, voices 4 lines at a time, and caches each line — an edit re-voices only
   the lines that changed.
10. **Check stills first**: `scripts/render.sh <dir> <lang> stills overview:2 detail ...` (scene ids or
    scene:line, resolved to mid-line frames) → `out/stills.png`; look for clipped labels, boxes off
    target, a cursor hiding the thing it points at.
11. **Render**: `scripts/render.sh <dir> <lang>` (~2 min for 3 min of video; 18 min took ~20).
    Then `scripts/render.sh <dir> <lang> sample` → `out/samples.png`, 8 frames out of the mp4
    itself, and look. Send the mp4 + srt; state what you verified and what you could not.
12. **Hand over**: the project folder path, how to edit → `prep.py` → render, the licence summary
    from `reference/licensing.md`, whether the folder is committed (it is not unless asked), and
    remind the user to close the capture Chrome.

After changing `capture.js` or `explore.js`, run `scripts/selftest.sh <any-project-dir>`: a local
fixture page in a throwaway headless Chrome, 19 checks, no app and no login.

## Script format, in one example line

```json
{"text": "Mỗi dòng có nhãn SQL là bước chạy truy vấn; bấm vào để xem câu SQL.",
 "say":  "Mỗi dòng có nhãn S Q L là bước chạy truy vấn; bấm vào để xem câu S Q L.",
 "mark": [{"box": "sqltag", "label": "Có SQL", "click": true}],
 "focus": ["sqltag"]}
```

`click: true` moves the cursor there and plays a press + ripple. Marks of the current line are
bright and labelled; earlier ones stay as dim outlines. The camera eases to the scene's `focus`,
then to each line's `focus` as that line starts.

## Alternatives when Remotion is not wanted

- **No licence / no Node**: the same `timeline` idea with ffmpeg — one frame per line (slide or
  screenshot + PIL-drawn caption), durations from the audio, `ffmpeg -f concat`. Worked, looks
  static.
- **Slides only**: a Slides-type Artifact deck with the narration in speaker notes; the audience
  pages through it.
