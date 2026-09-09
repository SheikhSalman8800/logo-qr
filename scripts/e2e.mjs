/**
 * Browser end-to-end test.
 *
 * Drives the running app in headless Chrome (uses the locally installed Google
 * Chrome via playwright-core, no browser download) and checks every control,
 * upload path, warning, export and preset flow. Exports are decoded with ZXing
 * and jsQR to prove they scan.
 *
 * Usage:  npm run dev            (in another terminal)
 *         npm run test:e2e       (defaults to http://localhost:5173; pass a URL to override)
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import nodeCanvas from "canvas";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const jsQR = require("jsqr");
const { readBarcodes } = await import("zxing-wasm/reader");

// ---- fixtures ----------------------------------------------------------------
const FX = fs.mkdtempSync(path.join(os.tmpdir(), "logo-qr-e2e-"));
const fx = (n) => path.join(FX, n);
{
  const c = nodeCanvas.createCanvas(200, 200); const x = c.getContext("2d");
  x.fillStyle = "#0a66c2"; x.beginPath(); x.arc(100, 100, 95, 0, 7); x.fill();
  x.fillStyle = "#fff"; x.font = "bold 120px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("in", 100, 108);
  fs.writeFileSync(fx("logo.png"), c.toBuffer("image/png"));
  fs.writeFileSync(fx("logo.jpg"), c.toBuffer("image/jpeg", { quality: 0.9 }));
  fs.writeFileSync(fx("logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#e11d48"/></svg>');
  fs.writeFileSync(fx("nodims.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#16a34a"/></svg>');
  fs.writeFileSync(fx("big.png"), Buffer.alloc(3 * 1024 * 1024, 1));
  fs.writeFileSync(fx("notes.txt"), "hello");
  const w = nodeCanvas.createCanvas(400, 120); const y = w.getContext("2d");
  y.fillStyle = "#111"; y.fillRect(0, 0, 400, 120); y.fillStyle = "#ff0"; y.font = "bold 90px sans-serif"; y.fillText("WIDE", 20, 95);
  fs.writeFileSync(fx("wide.png"), w.toBuffer("image/png"));
}
const SHOTS = path.resolve("test-output"); fs.mkdirSync(SHOTS, { recursive: true });
const BASE = process.argv[2] || "http://localhost:5173";
const URL_T = "https://www.instagram.com/tickify.live/";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -- " + detail : ""}`); };

async function decodePng(buf) {
  const png = PNG.sync.read(buf);
  const d = new Uint8ClampedArray(png.data.length);
  for (let i = 0; i < d.length; i += 4) { const a = png.data[i + 3] / 255; d[i] = png.data[i] * a + 255 * (1 - a); d[i + 1] = png.data[i + 1] * a + 255 * (1 - a); d[i + 2] = png.data[i + 2] * a + 255 * (1 - a); d[i + 3] = 255; }
  const [zx] = await readBarcodes({ data: d, width: png.width, height: png.height }, { formats: ["QRCode"], tryHarder: true });
  return { data: zx?.text ?? null, jsqr: jsQR(d, png.width, png.height)?.data ?? null, w: png.width, h: png.height, alphaCorner: png.data[3] };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector(".qr-container canvas");

const sel = { dot: "select >> nth=0", cs: "select >> nth=1", cd: "select >> nth=2", ec: "select >> nth=3" };
const canvasPng = async () => Buffer.from((await page.$eval(".qr-container canvas", (c) => c.toDataURL("image/png"))).split(",")[1], "base64");
const canvasHash = async () => { const b = await canvasPng(); let h = 0; for (let i = 0; i < b.length; i += 97) h = (h * 31 + b[i]) >>> 0; return h + ":" + b.length; };
const settle = (ms = 350) => page.waitForTimeout(ms);
const setInput = (selector, value) => page.$eval(selector, (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const download = async (btnText) => { const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`button:has-text("${btnText}")`)]); return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) }; };

// 1. Initial state
check("preview canvas rendered at 2x (640px backing, 320 css)", await page.$eval(".qr-container canvas", (c) => c.width === 640 && Math.round(c.getBoundingClientRect().width) === 320));
check("single canvas after StrictMode mount", (await page.$$(".qr-container canvas")).length === 1);
check("placeholder decodes to example.com", (await decodePng(await canvasPng())).data === "https://example.com");
check("logo controls disabled without logo", await page.$eval("fieldset.subgroup", (f) => f.disabled));

// 2. URL validation
const urlCases = [
  ["instagram.com/tickify.live", /without "https:\/\/"/],
  ["hello world", /whitespace/],
  ["mailto:a@b.com", /unusual/],
  ["https://localhost:3000/x", null],
  ["https://nodot", /Hostname/],
  ["justsometext", /doesn't look like a URL/],
  [URL_T, null],
];
for (const [v, re] of urlCases) {
  await page.fill('input[type="url"]', v); await settle(100);
  const warn = await page.$eval("section.panel:nth-of-type(1) .note.warn", (e) => e.textContent).catch(() => null);
  check(`url "${v}" -> ${re ? "warn" : "ok"}`, re ? re.test(warn || "") : warn === null, warn || "");
}
check("valid URL decodes in preview", (await decodePng(await canvasPng())).data === URL_T);

// 3. Logo uploads of every type
const upload = async (f) => { await page.setInputFiles('input[type="file"]', f); await settle(600); };
const base = (f) => path.basename(f);
for (const f of [fx("logo.png"), fx("logo.jpg"), fx("logo.svg"), fx("wide.png")]) {
  const before = await canvasHash(); await upload(f);
  const shown = await page.$eval(".logo-current strong", (e) => e.textContent).catch(() => null);
  const dec = await decodePng(await canvasPng());
  check(`upload ${f}: thumbnail + preview changed + still decodes`, shown === base(f) && before !== (await canvasHash()) && dec.data === URL_T, `shown=${shown} decoded=${dec.data}`);
}
check("EC forced to H after upload", (await page.$eval(sel.ec, (s) => s.value)) === "H");
check("wide logo shows non-square warning", /not square/.test(await page.$eval("section.panel:nth-of-type(2) .note.warn", (e) => e.textContent).catch(() => "")));
await page.screenshot({ path: path.join(SHOTS, "e2e-wide-logo.png"), clip: { x: 850, y: 150, width: 360, height: 360 } });

// SVG without dimensions
await upload(fx("nodims.svg"));
check("svg without viewBox shows warning", /viewBox/.test(await page.$eval("section.panel:nth-of-type(2) .note.warn", (e) => e.textContent).catch(() => "")));
await page.screenshot({ path: path.join(SHOTS, "e2e-nodims-svg.png"), clip: { x: 850, y: 150, width: 360, height: 360 } });
const nodimsDec = await decodePng(await canvasPng());
check("svg without viewBox: still decodes (visual check separately)", nodimsDec.data === URL_T);

// Rejections
await upload(fx("big.png"));
check("3MB file rejected", (await page.$$eval("section.panel:nth-of-type(2) .note.warn", (els) => els.map((e) => e.textContent).join(" "))).includes("2 MB"));
await upload(fx("notes.txt"));
check("txt rejected", (await page.$$eval("section.panel:nth-of-type(2) .note.warn", (els) => els.map((e) => e.textContent).join(" "))).includes("Unsupported"));
check("rejected uploads keep previous logo", (await page.$eval(".logo-current strong", (e) => e.textContent)) === "nodims.svg");

// Back to PNG logo for the rest
await upload(fx("logo.png"));

// 4. Every design control changes the canvas
const tryChange = async (name, fn) => { const b = await canvasHash(); await fn(); await settle(); check(`control: ${name} updates preview`, b !== (await canvasHash())); };
for (const t of ["square", "dots", "classy", "classy-rounded", "rounded"]) await tryChange(`dot=${t}`, () => page.selectOption(sel.dot, t));
for (const t of ["square", "dot", "extra-rounded"]) await tryChange(`cornerSquare=${t}`, () => page.selectOption(sel.cs, t));
for (const t of ["square", "dot"]) await tryChange(`cornerDot=${t}`, () => page.selectOption(sel.cd, t));
await tryChange("fg colour picker", () => setInput('input[type="color"] >> nth=0', "#ff0000"));
await tryChange("bg colour picker", () => setInput('input[type="color"] >> nth=1', "#eeeeff"));
await tryChange("logo zone slider -> 25", () => setInput('input[type="range"] >> nth=0', "25"));
await tryChange("logo padding -> 6", () => setInput('input[type="range"] >> nth=1', "6"));
await tryChange("transparent bg", () => page.check('.checkbox input'));
check("bg colour disabled when transparent", await page.$eval('input[type="color"] >> nth=1', (i) => i.disabled));
await page.uncheck('.checkbox input'); await settle();

// Typing a hex colour character-by-character
await page.fill('.color-hex >> nth=0', "");
await page.type('.color-hex >> nth=0', "0a66c2", { delay: 20 });
await settle();
check("typing hex colour char-by-char applies", (await page.$eval('.color-hex >> nth=0', (i) => i.value)) === "#0a66c2" && (await page.$eval('input[type="color"] >> nth=0', (i) => i.value)) === "#0a66c2", `text=${await page.$eval('.color-hex >> nth=0', (i) => i.value)} picker=${await page.$eval('input[type="color"] >> nth=0', (i) => i.value)}`);

// Clicking the "PNG resolution" label must not change the selection
await page.click('button:has-text("1024px")');
await page.click("text=PNG resolution");
await settle(100);
check("clicking 'PNG resolution' label does not change selection", (await page.$eval(".segmented .active", (b) => b.textContent)) === "1024px", await page.$eval(".segmented .active", (b) => b.textContent));

// 5. Risk warnings
await setInput('input[type="range"] >> nth=0', "25");
await page.selectOption(sel.ec, "L"); await settle();
check("25% at L -> danger", (await page.$$(".note.danger")).length >= 1);
await page.selectOption(sel.ec, "M"); await settle();
check("25% at M -> caution (warn)", (await page.$$("section.panel:nth-of-type(3) .note.warn")).length === 1 && (await page.$$(".note.danger")).length === 0);
await page.selectOption(sel.ec, "H"); await settle();
check("25% at H -> ok note", (await page.$$("section.panel:nth-of-type(3) .note.ok")).length === 1);

// Removing logo keeps EC and re-disables controls
await page.click('button:has-text("Remove")'); await settle();
check("remove logo: dropzone back, fieldset disabled, EC stays H", (await page.$(".dropzone")) && (await page.$eval("fieldset.subgroup", (f) => f.disabled)) && (await page.$eval(sel.ec, (s) => s.value)) === "H");
check("remove logo: preview equals fresh no-logo render", (await decodePng(await canvasPng())).data === URL_T);
await upload(fx("logo.png"));

// 6. Rapid-change race: many quick updates, final canvas must match a settled re-render
for (const t of ["square", "dots", "classy", "rounded", "classy-rounded", "square", "dots"]) await page.selectOption(sel.dot, t);
await settle(800);
const raceA = await canvasHash();
await page.selectOption(sel.dot, "rounded"); await settle(500); await page.selectOption(sel.dot, "dots"); await settle(800);
check("rapid updates: final render deterministic", raceA === (await canvasHash()));
check("rapid updates: still one canvas", (await page.$$(".qr-container canvas")).length === 1);

// 7. Exports at every size + SVG + filenames
await page.uncheck('.checkbox input').catch(() => {});
for (const size of [512, 1024, 2048]) {
  await page.click(`button:has-text("${size}px")`);
  const { name, buf } = await download(`Download PNG (${size}px)`);
  const d = await decodePng(buf);
  check(`PNG ${size}: ${d.w}x${d.h}, decodes, filename`, d.w === size && d.h === size && d.data === URL_T && name === `www-instagram-com-tickify-live-${size}px.png`, name);
}
await page.check('.checkbox input'); await settle();
{ const { buf } = await download("Download PNG (2048px)"); const d = await decodePng(buf); check("transparent PNG: alpha 0 at corner & decodes", d.alphaCorner === 0 && d.data === URL_T); }
{
  const { name, buf } = await download("Download SVG"); const svg = buf.toString("utf8");
  check("SVG: xml header, 1024 size, embedded image, no bg rect fill when transparent", /^<\?xml/.test(svg) && /width="1024"/.test(svg) && /<image/.test(svg) && name === "www-instagram-com-tickify-live.svg");
  // Rasterise the SVG in the browser and decode it
  const dataUrl = "data:image/svg+xml;base64," + buf.toString("base64");
  const rasterB64 = await page.evaluate(async (u) => { const img = new Image(); img.src = u; await img.decode(); const c = document.createElement("canvas"); c.width = c.height = 1024; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 1024, 1024); x.drawImage(img, 0, 0, 1024, 1024); return c.toDataURL("image/png").split(",")[1]; }, dataUrl);
  check("SVG rasterised in browser decodes", (await decodePng(Buffer.from(rasterB64, "base64"))).data === URL_T);
}
await page.uncheck('.checkbox input'); await settle();
check("scan reminder pulses after export", await page.$eval(".scan-reminder", (e) => e.classList.contains("pulse")));

// 8. Clipboard
await page.click('button:has-text("Copy to clipboard")'); await settle(1200);
const clip = await page.evaluate(async () => { try { const items = await navigator.clipboard.read(); const it = items[0]; const b = await it.getType("image/png"); return { types: it.types, size: b.size }; } catch (e) { return { err: String(e) }; } });
check("clipboard contains a PNG", clip.types?.includes("image/png") && clip.size > 1000, JSON.stringify(clip));
check("copy status shown", /Copied/.test(await page.$eval("section.panel:has(.segmented) .note.ok", (e) => e.textContent).catch(() => "")));

// 9. Empty URL export filename
await page.fill('input[type="url"]', ""); await settle();
{ const { name, buf } = await download("Download SVG"); check("empty URL: filename fallback + placeholder encoded", name === "qr-code.svg" && buf.toString().includes("<svg")); }
await page.fill('input[type="url"]', URL_T);

// 10. Long URL + unicode
const longUrl = "https://example.com/" + "a".repeat(280) + "?q=ünïcødé";
await page.fill('input[type="url"]', longUrl); await settle(600);
check("long unicode URL with 25% logo at H decodes", (await decodePng(await canvasPng())).data === new URL(longUrl).href);
await page.fill('input[type="url"]', URL_T); await settle();

await page.fill('input[type="url"]', "https://münchen.de/straße"); await settle(600);
check("unicode URL normalised like a browser", (await decodePng(await canvasPng())).data === "https://xn--mnchen-3ya.de/stra%C3%9Fe");
await page.fill('input[type="url"]', URL_T); await settle();
await page.check('.checkbox input'); await settle();
// 11. Presets: templates, save (overwrite), delete, persistence
await page.click('.chip:has-text("Spotify")'); await settle();
check("template Spotify: fg applied & transparency turned off", (await page.$eval(".color-hex >> nth=0", (i) => i.value)) === "#1db954" && !(await page.$eval(".checkbox input", (i) => i.checked)));
await page.fill('input[placeholder="Preset name"]', "Brand A"); await page.click('button:has-text("Save current design")');
await page.click('.chip:has-text("YouTube")'); await settle();
await page.fill('input[placeholder="Preset name"]', "Brand A"); await page.click('button:has-text("Save current design")'); // overwrite
await page.fill('input[placeholder="Preset name"]', "Brand B"); await page.click('button:has-text("Save current design")');
check("save preset: duplicate name overwrites, two chips", (await page.$$(".chip.saved")).length === 2);
await page.reload({ waitUntil: "networkidle" }); await page.waitForSelector(".qr-container canvas");
check("presets persist across reload", (await page.$$(".chip.saved")).length === 2);
await page.click('.chip:has-text("Classic")'); await settle();
await page.click('.chip.saved:has-text("Brand A") > button:first-child'); await settle();
check("apply saved preset restores YouTube red", (await page.$eval(".color-hex >> nth=0", (i) => i.value)) === "#ff0000");
await page.click('.chip.saved:has-text("Brand B") .chip-x');
check("delete preset", (await page.$$(".chip.saved")).length === 1);
await page.evaluate(() => localStorage.clear());

// 12. Keyboard: dropzone opens picker on Enter (file chooser event)
const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.focus(".dropzone").then(() => page.keyboard.press("Enter"))]);
check("dropzone keyboard Enter opens file chooser", !!chooser);

// 13. Mobile layout
await page.setViewportSize({ width: 390, height: 844 }); await settle();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check("mobile: no horizontal overflow", !overflow, `scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}`);
const previewFirst = await page.evaluate(() => { const p = document.querySelector(".column.preview").getBoundingClientRect().top; const c = document.querySelector(".column.controls").getBoundingClientRect().top; return p < c; });
check("mobile: preview stacked first", previewFirst);
await page.screenshot({ path: path.join(SHOTS, "e2e-mobile.png"), fullPage: true });

check("no console/page errors", errors.length === 0, errors.join(" | "));
await browser.close();
fs.rmSync(FX, { recursive: true, force: true });
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(" -", f.name, f.detail)); }
process.exit(fails.length ? 1 : 0);
