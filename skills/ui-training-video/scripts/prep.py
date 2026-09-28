"""script.<lang>.json + public/shots/*.json -> narration WAVs, src/timeline.<lang>.json, out/<name>.<lang>.srt

Every line is spoken on its own and its measured length sets the line's frames, so captions,
highlights, camera moves and the cursor follow the voice rather than a reading-speed guess.

    python3 prep.py <project>/script.en.json            validate, voice what changed, build the timeline
    python3 prep.py <project>/script.en.json --check    validate only — nothing is voiced or sent anywhere

Voices: a name ending in "Neural" goes through edge-tts (Microsoft neural voices, the project's
.venv) and the text LEAVES THE MACHINE; anything else is a macOS `say` voice (offline, robotic —
for drafts only).

Before a single line is voiced, the whole script is checked against the captured shots: a scene
whose shot was never captured, a mark or focus naming a box that matched nothing, a line that is
too long to caption. A mistake in the last scene used to surface after everything before it had
been voiced.

Audio is cached per line by (voice, rate, spoken text): editing one line re-voices that line only.
Lines are voiced in parallel (PREP_WORKERS, default 4; the free endpoint drops the odd request and
each one retries).

The timeline carries each scene's absolute `start` frame and each line's absolute `at`, and
out/frames.<lang>.txt lists them with the middle frame of every line — pick stills from it
(render.sh <project> <lang> stills <scene>[:<line>] ... accepts those names directly).
"""
import concurrent.futures as cf, hashlib, json, os, pathlib, subprocess, sys, textwrap, time, wave

FPS, GAP, TAIL, HEAD = 30, 0.35, 0.7, 0.4
MAX_WORDS, MAX_LABEL_WORDS = 30, 3
args = [a for a in sys.argv[1:] if not a.startswith("--")]
CHECK_ONLY = "--check" in sys.argv
src = pathlib.Path(args[0]).resolve()
ROOT = src.parent
script = json.loads(src.read_text())
lang, voice = script["lang"], script["voice"]
name = script.get("name", "training")
audio_dir = script.get("audio_dir", f"audio_{lang}")
AUDIO = ROOT / "public" / audio_dir
EDGE = os.environ.get("EDGE_TTS") or str(ROOT / ".venv" / "bin" / "edge-tts")
WORKERS = int(os.environ.get("PREP_WORKERS", "4"))

# ------------------------------------------------------------------ 1. validate everything first
problems, warnings, shot_boxes = [], [], {}
for sc in script["scenes"]:
    sid = sc.get("id", "?")
    if "shot" in sc:
        meta = ROOT / "public" / "shots" / f"{sc['shot']}.json"
        if not meta.exists():
            problems.append(f"{sid}: shot '{sc['shot']}' was never captured (no {meta.name})"); continue
        shot_boxes[sc["shot"]] = boxes = json.loads(meta.read_text())
    else:
        boxes = {}
        if sc.get("card") not in ("intro", "outro"): problems.append(f"{sid}: neither a shot nor a card")
    for k in sc.get("focus") or []:
        if not boxes.get(k): problems.append(f"{sid}: scene focus '{k}' was not captured")
    for i, ln in enumerate(sc["lines"], 1):
        where = f"{sid} line {i}"
        if not ln.get("text", "").strip(): problems.append(f"{where}: empty text")
        words = len(ln.get("text", "").split())
        if words > MAX_WORDS: warnings.append(f"{where}: {words} words — a caption that long wraps to three lines")
        for m in ln.get("mark", []):
            if not boxes.get(m["box"]): problems.append(f"{where}: mark box '{m['box']}' was not captured")
            if len(str(m.get("label", "")).split()) > MAX_LABEL_WORDS: warnings.append(f"{where}: label '{m['label']}' is over {MAX_LABEL_WORDS} words")
        for k in ln.get("focus") or []:
            if not boxes.get(k): problems.append(f"{where}: focus box '{k}' was not captured")
for w in warnings: print(f"  warning: {w}")
if problems:
    raise SystemExit("script does not match the captured shots — nothing was voiced:\n  " + "\n  ".join(problems))
n_lines = sum(len(sc["lines"]) for sc in script["scenes"])
print(f"checked: {len(script['scenes'])} scenes, {n_lines} lines, every mark and focus box exists")
if CHECK_ONLY:
    raise SystemExit(0)

# ------------------------------------------------------------------ 2. voice (cached, parallel)
AUDIO.mkdir(parents=True, exist_ok=True)
MANIFEST = AUDIO / "manifest.json"
cache = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}


def key(text):
    return hashlib.sha1(json.dumps([voice, script.get("rate"), text]).encode()).hexdigest()[:16]


def speak(text, wav):
    if voice.endswith("Neural"):
        mp3 = wav.with_suffix(".mp3")
        # The free endpoint drops a request now and then; retry with a growing pause before giving up.
        for attempt in range(5):
            a = [EDGE, "--voice", voice, "--text", text, "--write-media", str(mp3)]
            if script.get("rate"): a[1:1] = [f"--rate={script['rate']}"]
            r = subprocess.run(a, capture_output=True, text=True)
            if r.returncode == 0 and mp3.exists() and mp3.stat().st_size > 0:
                break
            time.sleep(2 * (attempt + 1))
        else:
            raise RuntimeError(f"edge-tts failed for: {text}\n{r.stderr[-400:]}")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ar", "24000", "-ac", "1", str(wav)], check=True)
        mp3.unlink()
    else:
        subprocess.run(["say", "-v", voice, "-r", str(script.get("rate", 175)), "--file-format=WAVE",
                        "--data-format=LEI16@24000", "-o", str(wav), text], check=True)


jobs, n = [], 0
for sc in script["scenes"]:
    for ln in sc["lines"]:
        n += 1
        spoken = ln.get("say", ln["text"])
        wav = AUDIO / f"{n:03d}.wav"
        if not (wav.exists() and cache.get(wav.name) == key(spoken)):
            jobs.append((wav, spoken))
engine = "edge-tts — the text leaves the machine" if voice.endswith("Neural") else "macOS say, offline"
print(f"voicing {len(jobs)} of {n} lines" + (f" with {voice} ({engine})" if jobs else " — every line is cached"))
done = 0
with cf.ThreadPoolExecutor(max_workers=WORKERS) as pool:
    futs = {pool.submit(speak, text, wav): (wav, text) for wav, text in jobs}
    for f in cf.as_completed(futs):
        wav, text = futs[f]
        f.result()                              # re-raises a line that failed all its retries
        cache[wav.name] = key(text); done += 1
        if done % 20 == 0 or done == len(jobs): print(f"  voiced {done}/{len(jobs)}")
        MANIFEST.write_text(json.dumps(cache, indent=0))

# ------------------------------------------------------------------ 3. timeline from measured audio
scenes, n, start = [], 0, 0
for sc in script["scenes"]:
    boxes = shot_boxes.get(sc.get("shot"), {})
    t = int(HEAD * FPS)
    lines = []
    for ln in sc["lines"]:
        n += 1
        wav = AUDIO / f"{n:03d}.wav"
        with wave.open(str(wav)) as w:
            frames = int(round(w.getnframes() / w.getframerate() * FPS))
        lines.append({"text": ln["text"], "audio": f"{audio_dir}/{n:03d}.wav", "from": t, "at": start + t,
                      "frames": frames, "mark": ln.get("mark", []), "focus": ln.get("focus")})
        t += frames + int(GAP * FPS)
    sf = t + int(TAIL * FPS)
    scenes.append({"id": sc["id"], "card": sc.get("card"), "shot": sc.get("shot"), "chapter": sc.get("chapter", ""),
                   "focus": sc.get("focus", []), "boxes": boxes, "lines": lines, "start": start, "frames": sf})
    start += sf
    print(f"{sc['id']:12s} {len(lines)} lines {sf / FPS:5.1f}s")

total = sum(s["frames"] for s in scenes)
(ROOT / "src" / f"timeline.{lang}.json").write_text(json.dumps(
    {"lang": lang, "voice": voice, "fps": FPS, "total": total, "view": script.get("view", {}),
     "theme": script.get("theme", {}), "cards": script["cards"], "scenes": scenes}, ensure_ascii=False, indent=1))

# One composition per language present: src/timelines.js imports every timeline.*.json.
langs = sorted(p.name.split(".")[1] for p in (ROOT / "src").glob("timeline.*.json"))
(ROOT / "src" / "timelines.js").write_text(
    "".join(f'import t_{l} from "./timeline.{l}.json"\n' for l in langs)
    + f"export default [{', '.join(f't_{l}' for l in langs)}]\n")


def ts(f):
    ms = int(round(f / FPS * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


srt, k, idx = [], 0, []
for sc in scenes:
    idx.append(f"{sc['id']:14s} start {sc['start']:6d}  ({ts(sc['start'])[:8]})")
    for i, l in enumerate(sc["lines"], 1):
        k += 1
        srt.append(f"{k}\n{ts(l['at'])} --> {ts(l['at'] + l['frames'])}\n" + "\n".join(textwrap.wrap(l["text"], 48)) + "\n")
        idx.append(f"   {sc['id']}:{i:<3d} mid {l['at'] + l['frames'] // 2:6d}   {l['text'][:70]}")
(ROOT / "out").mkdir(exist_ok=True)
(ROOT / "out" / f"{name}.{lang}.srt").write_text("\n".join(srt))
(ROOT / "out" / f"frames.{lang}.txt").write_text("\n".join(idx) + "\n")
print(f"{lang} {voice}: {total / FPS:.1f}s, {k} cues -> composition Training-{lang}  (frame index: out/frames.{lang}.txt)")
