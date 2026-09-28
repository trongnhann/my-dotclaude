# Licences — what each piece costs and what it restricts

Checked 2026-09-28 against the vendors' own pages (links at the bottom). Prices change; re-check
before anyone pays. Written for a company with MORE than 3 employees.

## Remotion (the video renderer) — the one that costs money

**The rule.** Free only for individuals, for-profit companies with **≤ 3 employees**, non-profits,
and anyone **evaluating** "and not yet using it in a commercial way". Everyone else needs a
**Company License**. Licensing is **per company** — the entity that owns the video project — and
it goes by headcount, not by how much you use it.

**What that means here**
- Building a first video to see whether the approach works = evaluation, free.
- Handing that video to the team as the training material = the company using it → a licence is
  needed. "Internal only" is **not** an exemption; the FAQ makes no carve-out for internal use.
- Evaluation has no stated time limit, but it ends the moment the output is used for real.

**Prices** ([remotion.pro/license](https://www.remotion.pro/license))
| Plan | Price | Who it is for |
|---|---|---|
| Creator | **$25 / month per seat**, billed monthly, no minimum | People who write/render videos with code, low volume. One seat per person who works on the Remotion project. |
| Automator | **$0.01 per render, $100 / month minimum** | Apps/systems that generate videos automatically (e.g. one video per customer). |
| Enterprise | from **$500 / month** | Volume, support, custom terms. |

For this skill's use — a person (with Claude) making a few training videos — **Creator, 1 seat**
is the fit: about **$25 for the month you make the video**, ~$300/year if kept on.

**Drawbacks, plainly**
- Paid for any real use at a company our size, even for one internal video.
- Priced per seat per month: every person who edits the video project needs a seat, not just one
  per company.
- Headcount-based: the price does not scale down with light use (one video a quarter still needs
  a seat that month).
- Contractors / group companies are not clearly defined in the FAQ — ask Remotion if an agency
  or a sister company is involved.
- Code may not be copied/modified to sell or sublicense your own derivative of Remotion.
- **What you keep:** videos already rendered stay yours after you cancel ("you remain the right to
  use your produced videos even after you cancel"). You can buy one month, render, cancel.

**If paying is not possible:** fall back to the ffmpeg path (static frame per line, PIL captions,
`ffmpeg -f concat`) — no licence, no camera moves or cursor. ffmpeg itself is LGPL/GPL; using the
CLI to make a video puts no obligation on the video.

## Voices

**edge-tts** (what the first videos used)
- The Python package is **GPL-3.0**: running it as a tool is fine; do not bundle it inside software
  you ship without meeting the GPL.
- The **service behind it is Microsoft Edge's "Read Aloud" endpoint, used without an agreement.**
  No SLA, no stated rate limits, can be blocked or changed at any time, and Microsoft grants no
  explicit right to use that audio commercially. Fine for trials and drafts; **for a video the
  company publishes, re-voice through Azure** (same voices, proper terms).
- The narration text is sent to Microsoft — get a yes before sending an internal script.

**Azure AI Speech** (official, same NamMinh / Andrew voices)
- Free tier **F0: 0.5M characters / month** of neural TTS (one free resource per subscription).
  A 3-minute walkthrough ≈ 3,000 characters — effectively free.
- Paid **S0: ~$16 per 1M characters** (Neural HD ~$22/1M).
- Needs an Azure subscription and a key → someone with Azure access has to create the resource.
- Microsoft's responsible-AI code of conduct for synthetic voice applies; check its disclosure
  expectations (saying the narration is AI-generated) before publishing externally.

**macOS `say` (Linh, Samantha)** — free and offline, but Apple's macOS software licence limits the
system voices to personal, non-commercial content (from memory of the SLA's "System Voices" clause
— not re-read on 2026-09-28; confirm in the SLA before relying on it). Treat them as drafts only.

**Vietnamese vendors (FPT.AI, Viettel AI, Zalo AI, Vbee)** — commercial contracts, pay per
character; read each one's terms on ownership of the generated audio.

**Open-source local models (VieNeu-TTS, F5-TTS-Vietnamese)** — check two licences separately: the
code's and the model weights' / training data's. Some Vietnamese voice datasets are research-only.
Voice cloning a real person needs that person's consent.

## One-line summary to give the user

> Remotion: free to try, **$25/month per editing seat** once the company uses the video (keep the
> videos after cancelling). Voice: edge-tts is free but unofficial — **use Azure (free tier covers
> this) for anything published**; macOS voices are personal-use only.

## Sources
- Remotion licence: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
- Remotion prices: https://www.remotion.pro/license
- Remotion licence FAQ: https://www.remotion.dev/docs/license/faq
- edge-tts: https://github.com/rany2/edge-tts (GPL-3.0)
- Azure TTS pricing: https://texttolab.com/blog/azure-text-to-speech-pricing
