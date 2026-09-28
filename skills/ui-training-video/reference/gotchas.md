# Traps hit while building videos, and what fixed each

**`page.screenshot()` hangs forever.** The capture window was behind others; Chrome stops producing
frames for it. Fix (in capture.js): `bringToFront()`, `Emulation.setFocusEmulationEnabled`,
`Page.setWebLifecycleState: active`. Wrap any ad-hoc CDP script in a watchdog; macOS has no `timeout`.

**Highlight box 30px off the thing it names.** Boxes were measured after the screenshot, and the page
had re-rendered on its poll / was still smooth-scrolling. Fix: scroll with `behavior: "instant"`,
wait until two measurements agree, measure before AND after, warn on movement. Always look at
the box sheets before writing the script.

**Tooltip missing from the shot.** A real hover does not survive in an unfocused window. Fix:
DevTools `CSS.forcePseudoState` (`hover`, `focus-within`) on the wrapper — changes nothing on the page.

**Clicks that must never happen.** The guard refuses anything whose text / aria-label / title /
class matches `neverClick`. It also refuses harmless ticks ("Select for …") — correct; bypass one
step with `"safe": "<reason>"`, never by loosening the regex.

**The login.** A separate Chrome with its own `--user-data-dir`; the user types their own password.
Never read the session cookie, never copy it into another browser. A token cookie without an expiry
dies with that Chrome process — capture everything in one sitting.

**Sidebar in every frame — or hidden.** Set `view.cropLeft` (screenshot px) in the script to hide
it; the camera never pans left of it. To SHOW it, leave cropLeft unset: zoomed lines still crop it,
so open each page with a line that marks its sidebar link.

**Label clipped at the top edge / under the chapter chip.** Training.jsx puts the label below a
box that sits within 130px of the frame top.

**Dimmed old labels garbled the UI text.** Only the current line's marks carry a label; earlier
boxes stay as a dim outline.

**Camera does not zoom enough for tiny targets (a two-letter tag).** Give that line its own `focus`;
per-line focus zooms to ~2.5x (minimum view width 760px vs 940px for the scene).

**Neural TTS reading identifiers.** Keep `text` (the caption) as written and give the voice a
`say`: `snake_case_name` → "snake case name", `sr / my / bq` → "S R / M Y / B Q", `SQL` → "S Q L".

**Numbers drift between shots.** The UI is live; counts change between a capture and a recapture.
Iterate shot by shot, then recapture every shot in ONE run before voicing, or the video
contradicts itself. Keep the narration free of exact counts so a recapture cannot make it wrong.

**A frame sampled at a scene boundary looks black.** Each scene fades over 8–10 frames; sample the
middle of a line — `render.sh stills <scene>:<line>` and `render.sh sample` already do.

**`remotion render` wants to download Chrome.** `render.sh` reuses a Playwright
`chrome-headless-shell` if one is cached; otherwise let Remotion fetch its own (from Google's CDN).

**Login lands on an unreachable host.** An app built its login `redirect_url` from the server's
bind address, so after logging in the capture tab went to `https://0.0.0.0:<port>/…` and the
session never reached the real domain. Open the login page yourself with `redirect_url` set to
the real page; the login is still the user's. Worth reporting to the app's owners.

**`wait_login` said "logged in" on the way to the login page.** A tab opened at the protected URL
shows it for a moment before redirecting. It now needs two polls on a non-login URL; `explore.js`
also says so when a page it opens is a login form.

**The guard reads the title, and that is correct.** A button that only opens a dialog had a tooltip
naming the write behind it ("Queue a run …") and was refused. Pass openers with `safe` and a
reason; never loosen `neverClick`. Mind collisions the other way too: `new item` in `neverClick`
refused "Run new item" — check the survey's BUTTONS list against the regex before capturing.

**Two-step writes are the common case.** Many destructive buttons arm on the first press and fire
on the second. One click shows the confirmation for the video; the armed button reads "Confirm …"
and the guard refuses it. Read the code to be sure it IS two-step before relying on that.

**`^Title` does not match a collapsible heading.** Titles carried "▾ " or "✓ " in front. Anchor on the
words, not the start — the selftest has a case for it.

**A box 1000px tall means the text also starts an ancestor.** A status line's first words were also
the first words of its whole panel, and the first match was the panel. `"pick": "last"` takes the
deepest element.

**Two tags, one element.** Several headlines sharing one parent `div`, each tagged with
`closest: "div"`, all landed on that div; only the last name survived and the other boxes were
empty. capture.js now fails the shot and names both tags.

**Cards taller than the screen.** A card over 1,400px tall ran off the image and the highlight framed
nothing. Box a child (the table, the heading) — capture.js now warns.

**Modals and charts are not always what the selector guesses.** A dialog was react-modal
(`.ReactModal__Content`), not Bootstrap (`.modal-content`); one page drew with Chart.js (`canvas`),
another with Recharts (`.recharts-wrapper`). `explore.js list` after opening it, then box.

**A `<select>` puts each option on its own line.** Match text is whitespace-normalised, so
`^7 days 30 days 90 days` works without `\s+`.

**No `eval` in page context.** Production builds often ship a CSP without `unsafe-eval`; a helper
passed as a string and evaluated in the page would throw on the first click. Inline the logic.

**The dev server on the port may be another checkout.** A local page showed old code because the
dev server on that port was running from a sibling worktree. `lsof -iTCP:<port>` then `ps` for its
path before trusting what a local page shows.

**zsh: never name a loop variable `path`.** It is tied to `PATH`; `IFS=: read -r path …` emptied it
and every following command was "not found".
