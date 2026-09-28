// Screenshots + highlight boxes for every scene, driven over CDP in a Chrome the USER logged into.
//
//   node capture.js <project>/shots.json                 every shot, keeps going past a failing one
//   node capture.js <project>/shots.json o_row d_grid    just these shots
//   node capture.js <project>/shots.json "o_*"           every shot whose name starts with o_
//
// shots.json:
//   { "base": "http://localhost:3000/app/page", "cdp": "http://127.0.0.1:9333",
//     "viewport": { "width": 1600, "height": 900, "scale": 1.2 },     // 1600x900 @1.2 = 1920x1080 px
//     "cssModule": "app_",             // optional: "@name" in a selector means [class*="app_name__"]
//     "neverClick": "ack|delete|remove|submit|save|confirm|publish|send|trigger|run now|clear run",
//     "shots": [ { "name": "overview", "url": "?tab=x", "waitFor": "@alertRow",
//                  "steps": [ {"scroll": "@tabs", "top": 40}, {"click": "@amsg"}, {"hover": "@infoWrap"},
//                             {"click": "@nsql", "text": "sr", "closest": "@node"}, {"sleep": 800},
//                             {"tag": "button", "text": "^Run domain$", "as": "rundom"},
//                             {"click": "@ackTick", "safe": "tick only: local UI state, the Ack button is not pressed"} ],
//                  "boxes": { "tabs": "@tabs", "row": "@alertRow", "rundom": "[data-tv=rundom]" } } ] }
//
// STEPS
//   scroll   {selector, top}            bring an element to `top` px below the viewport edge (instant)
//   click    {selector, text, closest, nth, wait, safe}
//   hover    {selector}                 DevTools' forced :hover / :focus-within
//   waitFor  {selector}
//   sleep    {ms}
//   tag      {selector, text, closest, nth, pick, as}
//            Find an element by its VISIBLE TEXT (or title) and mark it data-tv="<as>", so a box can
//            target a button or heading with no unique class: "boxes": {"x": "[data-tv=x]"}.
//            text is a case-insensitive regex on innerText; nth picks the n-th match; pick:"last"
//            takes the DEEPEST match — use it when the text also starts a big ancestor, which is the
//            usual reason a box comes out 1000px tall. closest widens to an ancestor.
//            Adds one attribute to the open page and sends nothing anywhere.
//
// Text matching (click + tag) is case-insensitive and reads innerText, falling back to title. Both
// normalise whitespace, so "7 days 30 days" matches a <select> whose options sit on separate lines.
// A heading that carries a "▾ " or "✓ " in front will not match "^Title" — anchor on the words.
//
// Read-only by construction: every navigation is a GET, clicks go through a guard that refuses any
// element whose text, aria-label, TITLE or class matches `neverClick`, and hover is DevTools' forced
// :hover, which changes nothing on the page. A shot that needs a write control only VISIBLE is fine;
// clicking it is not. The guard reads the title: a button that only OPENS a dialog but whose tooltip
// names the write behind it ("Queue a run of this job") is refused — pass it with `safe` + a reason.
//
// A failing shot is reported and skipped; the rest still run, and the exit code is 1 if any failed.
const fs = require("fs")
const path = require("path")

const cfgPath = path.resolve(process.argv[2] || "shots.json")
// This script lives in the skill; puppeteer-core is installed in the PROJECT (new_project.sh).
const puppeteer = require(require.resolve("puppeteer-core", { paths: [path.dirname(cfgPath), process.cwd()] }))
const wanted = process.argv.slice(3)
const pickShot = name => !wanted.length || wanted.some(w => w.endsWith("*") ? name.startsWith(w.slice(0, -1)) : name === w)
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"))
const OUT = path.join(path.dirname(cfgPath), "public", "shots")
fs.mkdirSync(OUT, { recursive: true })
const VP = { width: 1600, height: 900, scale: 1.2, ...(cfg.viewport || {}) }
const NEVER = new RegExp(cfg.neverClick || "ack|delete|remove|submit|save|confirm|publish|send|trigger|run now", "i")
const sleep = ms => new Promise(r => setTimeout(r, ms))
// "@name" anywhere in a selector (including "@err @infoWrap") -> the CSS-module class of that name.
const sel = s => cfg.cssModule ? s.replace(/@([A-Za-z][\w-]*)/g, (_, n) => `[class*="${cfg.cssModule}${n}__"]`) : s

async function boxes(page, map) {
    const out = {}
    for (const [k, s] of Object.entries(map || {})) {
        out[k] = await page.evaluate((q, sc) => {
            const el = document.querySelector(q)
            if (!el) return null
            const r = el.getBoundingClientRect()
            return { x: r.x * sc, y: r.y * sc, w: r.width * sc, h: r.height * sc }
        }, sel(s), VP.scale)
    }
    return out
}

// Element lookup, identical in click and tag so a selector that tags an element clicks it too.
// Written out in each page.evaluate rather than passed through a string and evaluated: a page whose
// CSP forbids unsafe-eval (common on production builds) would throw on the first click.
async function step(page, cdp, st) {
    if (st.sleep) return sleep(st.sleep)
    if (st.scroll) {
        await page.evaluate((q, t) => {
            const el = document.querySelector(q)
            if (!el) throw new Error(`scroll target not found: ${q}`)
            window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().y - t, behavior: "instant" })
        }, sel(st.scroll), st.top ?? 90)
        return sleep(400)
    }
    if (st.tag) {
        const err = await page.evaluate((q, text, closest, nth, pick, as) => {
            const norm = e => (e.innerText || e.getAttribute("title") || "").replace(/\s+/g, " ").trim()
            const all = [...document.querySelectorAll(q)]
            const hits = text ? all.filter(e => new RegExp(text, "i").test(norm(e))) : all
            let el = pick === "last" ? hits[hits.length - 1] : hits[nth || 0]
            if (el && closest) el = el.closest(closest) || el
            const count = hits.length
            if (!el) return `tag target not found: ${q} ~ ${text || ""} [${pick || nth || 0}] (${count} matches)`
            // Two tags resolving to the SAME element (usually via `closest`) would silently leave the
            // first box pointing at nothing. Say so instead.
            const prev = el.getAttribute("data-tv")
            if (prev && prev !== as) return `tag "${as}" landed on the element already tagged "${prev}" — narrow the selector or drop closest`
            el.setAttribute("data-tv", as)
            return null
        }, sel(st.tag), st.text || null, st.closest ? sel(st.closest) : null, st.nth || 0, st.pick || null, st.as)
        if (err) throw new Error(err)
        return
    }
    if (st.click) {
        // dispatchEvent rather than page.click: works in an unfocused window, and lets the guard see the element.
        // `safe` is the one way past the guard, and it must say why (e.g. "tick only — local UI state").
        if (st.safe) console.log(`  guard bypassed for ${st.click}: ${st.safe}`)
        const refused = await page.evaluate((q, text, closest, nth, never) => {
            const norm = e => (e.innerText || e.getAttribute("title") || "").replace(/\s+/g, " ").trim()
            const all = [...document.querySelectorAll(q)]
            const hits = text ? all.filter(e => new RegExp(text, "i").test(norm(e))) : all
            let el = hits[nth || 0]
            if (el && closest) el = el.closest(closest) || el
            if (!el) return `click target not found: ${q}${text ? " ~ " + text : ""}`
            const label = `${el.innerText || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.className || ""}`
            if (never && new RegExp(never, "i").test(label)) return `REFUSED to click a write control: "${label.replace(/\s+/g, " ").trim().slice(0, 90)}"`
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
            return null
        }, sel(st.click), st.text || null, st.closest ? sel(st.closest) : null, st.nth || 0, st.safe ? null : NEVER.source)
        if (refused) throw new Error(refused)
        return sleep(st.wait ?? 900)
    }
    if (st.hover) {
        // A real hover does not survive in an unfocused window; DevTools' forced :hover does.
        const { root } = await cdp.send("DOM.getDocument", { depth: -1 })
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel(st.hover) })
        if (!nodeId) throw new Error(`hover target not found: ${st.hover}`)
        await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover", "focus-within"] })
        return sleep(600)
    }
    if (st.waitFor) return page.waitForSelector(sel(st.waitFor), { timeout: 15000 })
    throw new Error(`unknown step ${JSON.stringify(st)}`)
}

async function shoot(page, cdp, sh) {
    await page.goto(cfg.base + (sh.url || ""), { waitUntil: "networkidle2" })
    if (sh.waitFor) await page.waitForSelector(sel(sh.waitFor), { timeout: 20000 })
    await sleep(1200)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    for (const st of sh.steps || []) await step(page, cdp, st)
    // Wait for the layout to stop moving (smooth scroll, a poll re-render), then measure on
    // BOTH sides of the screenshot: a box measured after a re-render can sit 30px off the image.
    let last = null
    for (let i = 0; i < 25; i++) {
        await sleep(200)
        const now = JSON.stringify(await boxes(page, sh.boxes))
        if (now === last) break
        last = now
    }
    const b = await boxes(page, sh.boxes)
    await page.screenshot({ path: path.join(OUT, `${sh.name}.png`), optimizeForSpeed: true, captureBeyondViewport: false })
    const after = await boxes(page, sh.boxes)
    const W = VP.width * VP.scale, H = VP.height * VP.scale
    const warns = []
    for (const k of Object.keys(b)) {
        const v = b[k]
        if (!v) warns.push(`${k}: selector matched nothing`)
        else {
            if (after[k] && (Math.abs(v.y - after[k].y) > 2 || Math.abs(v.x - after[k].x) > 2)) warns.push(`${k}: moved during capture — recapture`)
            // A box that leaves the screenshot draws a highlight around nothing. Usually a card taller
            // than the screen (box a child inside it) or a target the scroll could not reach.
            if (v.y + v.h <= 0 || v.y >= H || v.x + v.w <= 0 || v.x >= W) warns.push(`${k}: entirely off screen (y=${Math.round(v.y)}) — scroll to it or drop it`)
            else if (v.y < -4 || v.y + v.h > H + 4) warns.push(`${k}: runs off screen (${Math.round(v.y)}..${Math.round(v.y + v.h)} of ${H}) — box a smaller child`)
        }
    }
    fs.writeFileSync(path.join(OUT, `${sh.name}.json`), JSON.stringify(b, null, 2))
    console.log(`${sh.name}: ${Object.entries(b).map(([k, v]) => `${k}=${v ? `${Math.round(v.x)},${Math.round(v.y)} ${Math.round(v.w)}x${Math.round(v.h)}` : "MISSING"}`).join("  ")}`)
    for (const w of warns) console.warn(`  ${sh.name}.${w}`)
    return warns.length
}

;(async () => {
    const browser = await puppeteer.connect({ browserURL: cfg.cdp || "http://127.0.0.1:9333", defaultViewport: null })
    const pages = await browser.pages()
    const origin = new URL(cfg.base).origin
    // The user may have closed the tab they logged in with; a new tab in the same profile keeps the login.
    const page = pages.find(p => p.url().startsWith(origin)) || pages.find(p => /^https?:/.test(p.url())) || await browser.newPage()
    await page.setViewport({ width: VP.width, height: VP.height, deviceScaleFactor: VP.scale })
    // A covered or background window stops producing frames and screenshot() then waits forever.
    await page.bringToFront()
    const cdp = await page.createCDPSession()
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true })
    await cdp.send("Page.setWebLifecycleState", { state: "active" })
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable")

    const todo = cfg.shots.filter(sh => pickShot(sh.name))
    if (!todo.length) throw new Error(`no shot matches ${wanted.join(" ")}`)
    const failed = []; let warned = 0
    for (const sh of todo) {
        try { warned += await shoot(page, cdp, sh) }
        catch (e) { failed.push(sh.name); console.error(`${sh.name}: FAILED — ${e.message.split("\n")[0]}`) }
        // leave no forced state behind for the next shot
        await page.goto("about:blank").catch(() => {})
    }
    browser.disconnect()
    console.log(`\n${todo.length - failed.length}/${todo.length} shots captured` +
        (warned ? `, ${warned} box warning(s) above` : "") + (failed.length ? ` — FAILED: ${failed.join(", ")}` : ""))
    if (failed.length) process.exit(1)
})().catch(e => { console.error("FAILED:", e.message); process.exit(1) })
