# my-dotclaude

Personal Claude Code skills and configuration, laid out like `~/.claude`.

| Path | What it is |
|---|---|
| [`skills/ui-training-video/`](skills/ui-training-video/SKILL.md) | Narrated training / walkthrough videos of a web app from real screenshots: capture over Chrome DevTools in a window you log into, then Remotion renders zooms, highlight boxes, a cursor, captions and a neural voice-over, plus an `.srt`. |

## Install a skill

```bash
git clone git@github.com:trongnhann/my-dotclaude.git
ln -s "$PWD/my-dotclaude/skills/ui-training-video" ~/.claude/skills/ui-training-video
```

Each skill's own `SKILL.md` says what it needs (for this one: Node, Python 3, ffmpeg, Google Chrome).
Check a capture setup without any app or login: `skills/ui-training-video/scripts/selftest.sh <project-dir>`.
