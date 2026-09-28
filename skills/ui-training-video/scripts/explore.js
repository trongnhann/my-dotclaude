// Read-only exploration of the app before writing shots.json — GETs and screenshots, never a click.
// Reads base / cdp / viewport / cssModule from the project's shots.json (an empty "shots": [] is fine).
//
//   node explore.js <shots.json> survey <path> [<path> ...]
//        Per page: headings, EVERY button / link-button label, and the CSS-module classes present.
//        Run this first on every page the video covers and read the BUTTONS line for write controls —
//        that list is what `neverClick` must cover, and what the code must be read for (does a button
//        fire, or only open a dialog / arm a second press?).
//   node explore.js <shots.json> list <path> "<selector>" [limit]
//        Page y, height, tag.class and text of every match — to find a selector and to see how tall
//        a card is before boxing it. "@name" expands to the CSS module class like in capture.js.
//   node explore.js <shots.json> peek <path> [scrollY] [out.png]
//        A viewport screenshot at a scroll offset, to plan scenes. Written to out/peek_*.png.
const fs = require("fs")
const path = require("path")
const [, , cfgArg, mode, ...rest] = process.argv
if (!cfgArg || !mode) { console.error("usage: explore.js <shots.json> survey|list|peek ..."); process.exit(2) }
const cfgPath = path.resolve(cfgArg)
const puppeteer = require(require.resolve("puppeteer-core", { paths: [path.dirname(cfgPath), process.cwd()] }))
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"))
const VP = { width: 1600, height: 900, scale: 1.2, ...(cfg.viewport || {}) }
const sel = s => cfg.cssModule ? s.replace(/@([A-Za-z][\w-]*)/g, (_, n) => `[class*="${cfg.cssModule}${n}__"]`) : s
const sleep = ms => new Promise(r => setTimeout(r, ms))
// macOS has no `timeout`; a covered window can make the page hang, so give up rather than wait forever.
const wd = setTimeout(() => { console.error("explore: gave up after 5 min"); process.exit(3) }, 300000)

;(async () => {
    const browser = await puppeteer.connect({ browserURL: cfg.cdp || "http://127.0.0.1:9333", defaultViewport: null })
    const pages = await browser.pages()
    const page = pages.find(p => /^https?:|^file:/.test(p.url())) || await browser.newPage()
    await page.setViewport({ width: VP.width, height: VP.height, deviceScaleFactor: 1 })
    await page.bringToFront()
    const cdp = await page.createCDPSession()
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true })
    await cdp.send("Page.setWebLifecycleState", { state: "active" })
    const open = async p => {
        await page.goto(cfg.base + (p || ""), { waitUntil: "networkidle2", timeout: 45000 }).catch(e => console.error(`  goto: ${e.message.slice(0, 80)}`))
        await sleep(3000)
        // Landing on a login page means the session is gone — say so instead of surveying the login form.
        if (await page.$('input[type="password"]')) console.error(`  ${p}: this is a LOGIN page (${page.url().slice(0, 90)}) — log in again in the capture window`)
    }

    if (mode === "survey") {
        for (const p of rest) {
            await open(p)
            const d = await page.evaluate(() => {
                const t = e => (e.innerText || e.value || "").replace(/\s+/g, " ").trim()
                const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,strong,[class*=Title]")].map(t).filter(x => x && x.length < 90)
                const btns = [...document.querySelectorAll("button,a.btn,[role=button],input[type=button],input[type=submit]")]
                    .map(e => t(e) || e.getAttribute("title") || e.getAttribute("aria-label")).filter(Boolean)
                const mods = {}
                for (const e of document.querySelectorAll("[class]")) for (const c of String(e.className).split(/\s+/)) {
                    const m = c.match(/^([A-Za-z0-9-]+)_([A-Za-z0-9]+)__/); if (m) mods[`${m[1]}_${m[2]}`] = (mods[`${m[1]}_${m[2]}`] || 0) + 1
                }
                return { url: location.href, height: document.documentElement.scrollHeight, heads: [...new Set(heads)].slice(0, 40),
                         btns: [...new Set(btns)].slice(0, 60), mods, inputs: document.querySelectorAll("select,input:not([type=hidden])").length }
            })
            console.log(`\n######## ${p}   (height ${d.height}px, ${d.inputs} inputs)`)
            console.log(`HEADINGS: ${d.heads.join(" | ").slice(0, 1400)}`)
            console.log(`BUTTONS:  ${d.btns.join(" | ").slice(0, 1600)}`)
            console.log(`MODULES:  ${Object.entries(d.mods).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" ").slice(0, 900)}`)
        }
    } else if (mode === "list") {
        const [p, selector, limit] = rest
        await open(p)
        const rows = await page.evaluate((q, n) => [...document.querySelectorAll(q)].slice(0, Number(n) || 40).map(e => {
            const r = e.getBoundingClientRect()
            return `${String(Math.round(r.y + scrollY)).padStart(6)}  h=${String(Math.round(r.height)).padStart(5)}  ${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0].slice(0, 30)}  "${(e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 90)}"`
        }), sel(selector), limit)
        console.log(rows.length ? rows.join("\n") : `no match for ${selector}`)
    } else if (mode === "peek") {
        const [p, y, out] = rest
        await open(p)
        await page.evaluate(v => window.scrollTo({ top: Number(v) || 0, behavior: "instant" }), y || 0)
        await sleep(700)
        const file = out || path.join(path.dirname(cfgPath), "out", `peek_${String(p || "root").replace(/[^\w-]+/g, "_").slice(0, 40)}_${y || 0}.png`)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        await page.screenshot({ path: file })
        console.log(file)
    } else {
        console.error(`unknown mode ${mode}`); process.exit(2)
    }
    clearTimeout(wd); browser.disconnect()
})().catch(e => { console.error("FAILED:", e.message); process.exit(1) })
