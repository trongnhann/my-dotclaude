# Voices and licences — what was compared, and what was chosen

Researched and tested 2026-09 for the first training video made with this skill.

## Picked

| Language | Voice | Engine | Why |
|---|---|---|---|
| Vietnamese | `vi-VN-NamMinhNeural` (male) · `vi-VN-HoaiMyNeural` (female) | edge-tts | The macOS `Linh` voice was judged "chán quá" — robotic. Microsoft neural is the same family Azure sells, which reviews rate strongest for Vietnamese. |
| English | `en-US-AndrewNeural` (male) · Ava / Emma / Brian also good | edge-tts | Warm, conversational; reads UI terms naturally. |

A user picks by ear: run `scripts/voice_samples.sh` with one harmless sentence and send the files.

## Engines

- **edge-tts** (`pip install edge-tts`, no key): calls the Read Aloud service behind Microsoft Edge.
  Free, but **unofficial** — no SLA, may be rate-limited or blocked; one request in ~70 failed once
  and `prep.py` retries. Text leaves the machine: **ask before sending an internal script.**
- **Azure Speech** (official, same voices): free tier F0 = 0.5M characters / month for neural voices.
  A 3-minute walkthrough is ~3,000 characters. Needs a key; swap `speak()` in `prep.py`.
- **macOS `say`** (offline): `Linh` (vi_VN), `Samantha` (en_US). Only for drafts or when nothing
  may leave the machine.

## Market, for when someone asks

- Vietnamese vendors — FPT.AI (9 voices, North/Central/South), Viettel AI, Zalo AI, Vbee: most
  natural regional Vietnamese; accounts + API keys, pay per character.
- International — Azure Neural (best for Vietnamese), Google Cloud TTS, ElevenLabs (excellent
  English, weaker Vietnamese), OpenAI TTS.
- Open source, local — VieNeu-TTS (github.com/pnnbao97/VieNeu-TTS, CPU-capable, voice cloning
  from a few seconds; v3 open, v4 API-only), F5-TTS-Vietnamese (Hugging Face `hynt/...`). Heavy
  installs (PyTorch + model weights from individual authors' repos) — ask before installing.
- All-in-one SaaS — Fliki, SlideSpeak, Vidocu: upload slides, get narrated video. Content goes to
  a third party.

## Licences

Costs and restrictions for Remotion and every voice option: `licensing.md`.
