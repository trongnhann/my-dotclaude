import { AbsoluteFill, Audio, Img, Series, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"

// Colours: `theme` in the script overrides any of these. `accent` = eyebrows and chapter chip,
// `mark` = highlight boxes, labels and the click ripple.
const DEFAULT_THEME = { ink: "#131A22", accent: "#5FD3BF", mark: "#F5A524", soft: "#B9C4CE", text: "#EEF1EC" }
let C = DEFAULT_THEME
const FONT = "'Helvetica Neue', Arial, sans-serif"
const W = 1920, H = 1080
// The resting view. `view.cropLeft` (screenshot px) hides an app sidebar that is not what the
// video is about; the camera never pans left of it.
let BASE = { x: 0, y: 0, w: W, h: H }
function setup(timeline) {
    C = { ...DEFAULT_THEME, ...(timeline.theme || {}) }
    const x = (timeline.view && timeline.view.cropLeft) || 0
    BASE = { x, y: 0, w: W - x, h: (W - x) * 9 / 16 }
}

// The view that frames the given boxes: padded, 16:9, never closer than ~2x, kept inside the shot,
// and with the subject a little above centre so the caption band never sits on it.
function focusView(boxes, keys, minW = 940) {
    const bs = keys.map(k => boxes[k]).filter(Boolean)
    if (!bs.length) return BASE
    const x0 = Math.min(...bs.map(b => b.x)), y0 = Math.min(...bs.map(b => b.y))
    const x1 = Math.max(...bs.map(b => b.x + b.w)), y1 = Math.max(...bs.map(b => b.y + b.h))
    let w = Math.max(x1 - x0 + 160, minW), h = Math.max(y1 - y0 + 160, 0) * 1.25
    if (w / h < 16 / 9) w = h * 16 / 9; else h = w * 9 / 16
    if (w > BASE.w) { w = BASE.w; h = BASE.h }
    let x = (x0 + x1) / 2 - w / 2, y = (y0 + y1) / 2 - h * 0.44
    x = Math.min(Math.max(x, BASE.x), W - w); y = Math.min(Math.max(y, 0), H - h)
    return { x, y, w, h }
}
const lerp = (a, b, p) => a + (b - a) * p
const lerpView = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) })
const centre = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

function currentLine(lines, frame) {
    let cur = null
    for (const l of lines) if (frame >= l.from - 4) cur = l
    return cur
}

const Caption = ({ lines }) => {
    const frame = useCurrentFrame()
    const l = currentLine(lines, frame)
    if (!l) return null
    const o = interpolate(frame - l.from, [-4, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    return (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center", opacity: o }}>
            <div style={{ maxWidth: 1560, background: "rgba(19,26,34,0.94)", color: "#F5F7F3", fontFamily: FONT, fontSize: 40,
                          lineHeight: 1.35, padding: "22px 40px", borderRadius: 16, textAlign: "center" }}>{l.text}</div>
        </div>
    )
}

const Chapter = ({ text }) => text ? (
    <div style={{ position: "absolute", top: 28, left: 32, background: C.ink, color: C.accent, fontFamily: FONT, fontSize: 26,
                  fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", padding: "10px 20px", borderRadius: 10 }}>{text}</div>
) : null

const Cursor = ({ x, y, s, pressed }) => (
    <div style={{ position: "absolute", left: x, top: y, width: 40 / s, height: 40 / s, transform: `scale(${pressed ? 0.88 : 1})`, transformOrigin: "0 0" }}>
        <svg viewBox="0 0 24 24" width="100%" height="100%">
            <path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.3 L17.5 13.3 Z" fill="#fff" stroke="#131A22" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
    </div>
)

const Shot = ({ scene }) => {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    // Camera keyframes: the scene's framing first, then any line that names its own focus.
    const keys = [{ at: 10, view: focusView(scene.boxes, scene.focus) }]
    scene.lines.forEach(l => { if (l.focus) keys.push({ at: l.from, view: focusView(scene.boxes, l.focus, 760) }) })
    let v0 = BASE
    for (const k of keys) v0 = lerpView(v0, k.view, spring({ frame: frame - k.at, fps, config: { damping: 200 }, durationInFrames: 40 }))
    const drift = interpolate(frame, [0, scene.frames], [1, 0.985])
    const v = { ...v0, x: v0.x + v0.w * (1 - drift) / 2, y: v0.y + v0.h * (1 - drift) / 2, w: v0.w * drift, h: v0.h * drift }
    const s = W / v.w

    // Highlights: the current line's marks are bright; earlier ones stay, dimmed, so the eye keeps the thread.
    const marks = []
    scene.lines.forEach((l, i) => l.mark.forEach(m => marks.push({ ...m, from: l.from, line: i })))
    const cur = currentLine(scene.lines, frame)
    const curIdx = cur ? scene.lines.indexOf(cur) : -1

    // Cursor: glides to each clickable mark as its line starts, then presses.
    const clicks = marks.filter(m => m.click)
    let pos = { x: v.x + v.w * 0.62, y: v.y + v.h * 0.55 }, pressed = false, ripple = null
    let prev = pos
    for (const m of clicks) {
        const b = scene.boxes[m.box], c = { x: b.x + b.w * 0.7, y: b.y + b.h * 0.7 }
        const t = interpolate(frame, [m.from, m.from + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        const e = t * t * (3 - 2 * t)
        if (frame >= m.from) pos = { x: lerp(prev.x, c.x, e), y: lerp(prev.y, c.y, e) }
        if (frame >= m.from + 22 && frame < m.from + 28) pressed = true
        if (frame >= m.from + 22 && frame < m.from + 44) ripple = { ...c, k: (frame - m.from - 22) / 22 }
        prev = c
    }

    return (
        <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
            <div style={{ position: "absolute", width: W, height: H, transformOrigin: "0 0", transform: `scale(${s}) translate(${-v.x}px, ${-v.y}px)` }}>
                <Img src={staticFile(`shots/${scene.shot}.png`)} style={{ width: W, height: H }} />
                {marks.map((m, i) => {
                    const b = scene.boxes[m.box]
                    const a = interpolate(frame, [m.from + 4, m.from + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
                    const dim = m.line < curIdx ? 0.35 : 1
                    const pad = 8 / s
                    return (
                        <div key={i} style={{ position: "absolute", left: b.x - pad, top: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2,
                                              border: `${4 / s}px solid ${C.mark}`, borderRadius: 10 / s, opacity: a * dim,
                                              boxShadow: `0 0 0 ${9999}px rgba(19,26,34,${m.line === curIdx ? 0.28 * a : 0})` }}>
                            {m.line === curIdx && <div style={{ position: "absolute", left: Math.max(-4 / s, v.x - b.x + 24 / s), ...((b.y - v.y) * s < 130 ? { bottom: -(48 / s) } : { top: -(48 / s) }), background: C.mark, color: C.ink, fontFamily: FONT,
                                          fontWeight: 700, fontSize: 26 / s, padding: `${6 / s}px ${14 / s}px`, borderRadius: 8 / s, whiteSpace: "nowrap" }}>{m.label}</div>}
                        </div>
                    )
                })}
                {ripple && <div style={{ position: "absolute", left: ripple.x - (20 + 50 * ripple.k) / s, top: ripple.y - (20 + 50 * ripple.k) / s,
                                         width: (40 + 100 * ripple.k) / s, height: (40 + 100 * ripple.k) / s, borderRadius: "50%",
                                         border: `${3 / s}px solid ${C.mark}`, opacity: 1 - ripple.k }} />}
                {clicks.length > 0 && <Cursor x={pos.x} y={pos.y} s={s} pressed={pressed} />}
            </div>
            <Chapter text={scene.chapter} />
            <Caption lines={scene.lines} />
        </AbsoluteFill>
    )
}

const Card = ({ scene, cards }) => {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const inn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 })
    const intro = scene.card === "intro"
    const c = intro ? cards.intro : cards.outro
    return (
        <AbsoluteFill style={{ background: C.ink, fontFamily: FONT, padding: 140, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
            <div style={{ color: C.accent, fontSize: 28, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", opacity: inn }}>
                {c.eyebrow}
            </div>
            {intro ? (
                <>
                    <div style={{ color: C.text, fontSize: 132, fontWeight: 700, lineHeight: 1.02, transform: `translateY(${(1 - inn) * 40}px)`, opacity: inn }}>
                        {c.title[0]}<br />{c.title[1]}
                    </div>
                    <div style={{ color: C.soft, fontSize: 44, lineHeight: 1.35, maxWidth: 1300, opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }) }}>
                        {c.sub}
                    </div>
                </>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                    {scene.lines.map((l, i) => {
                        const a = interpolate(frame, [l.from, l.from + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
                        return (
                            <div key={i} style={{ display: "flex", gap: 28, alignItems: "center", opacity: a, transform: `translateX(${(1 - a) * 30}px)` }}>
                                <div style={{ width: 14, height: 14, borderRadius: 7, background: C.accent, flex: "none" }} />
                                <div style={{ color: C.text, fontSize: 60, fontWeight: 600, lineHeight: 1.2 }}>{c.items[i]}</div>
                            </div>
                        )
                    })}
                </div>
            )}
            <Caption lines={scene.lines} />
        </AbsoluteFill>
    )
}

const Scene = ({ scene, cards }) => {
    const frame = useCurrentFrame()
    const fade = interpolate(frame, [0, 10, scene.frames - 8, scene.frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    return (
        <AbsoluteFill style={{ opacity: fade }}>
            {scene.card ? <Card scene={scene} cards={cards} /> : <Shot scene={scene} />}
            {scene.lines.map((l, i) => (
                <Sequence key={i} from={l.from} durationInFrames={l.frames + 6}>
                    <Audio src={staticFile(l.audio)} />
                </Sequence>
            ))}
        </AbsoluteFill>
    )
}

export const Training = ({ timeline }) => { setup(timeline); return (
    <AbsoluteFill style={{ background: C.ink }}>
        <Series>
            {timeline.scenes.map(sc => (
                <Series.Sequence key={sc.id} durationInFrames={sc.frames}>
                    <Scene scene={sc} cards={timeline.cards} />
                </Series.Sequence>
            ))}
        </Series>
    </AbsoluteFill>
) }
