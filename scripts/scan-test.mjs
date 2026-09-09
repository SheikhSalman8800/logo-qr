/**
 * Headless scan test.
 *
 * Renders QR codes with an embedded logo using the exact option mapping the
 * app uses (src/lib/qrOptions.js), then decodes the resulting PNG with jsQR
 * and checks the payload round-trips. Run with `npm run test:scan`.
 *
 * Output PNGs are written to ./test-output for manual phone scanning.
 */
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import nodeCanvas from "canvas";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import QRCodeStyling from "qr-code-styling";
import { buildQrOptions, DEFAULT_SETTINGS, DOT_TYPES } from "../src/lib/qrOptions.js";
import { assessLogoRisk } from "../src/lib/validation.js";

const OUT_DIR = path.resolve("test-output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_UNDER_TEST = "https://www.instagram.com/tickify.live/";

/** Generate a bold, busy logo (worst-ish case: opaque, high contrast). */
function makeLogoDataUrl() {
  const c = nodeCanvas.createCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e11d48";
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 150px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("T", 128, 138);
  return c.toDataURL("image/png");
}

async function renderPng(settings, size) {
  const options = { ...buildQrOptions(settings, size, "canvas"), jsdom: JSDOM, nodeCanvas };
  const qr = new QRCodeStyling(options);
  const buf = await qr.getRawData("png");
  if (!buf) throw new Error("no data from renderer");
  return Buffer.from(buf);
}

function decode(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  // Composite onto white so transparent backgrounds decode like a real print.
  const data = new Uint8ClampedArray(png.data.length);
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3] / 255;
    data[i] = Math.round(png.data[i] * a + 255 * (1 - a));
    data[i + 1] = Math.round(png.data[i + 1] * a + 255 * (1 - a));
    data[i + 2] = Math.round(png.data[i + 2] * a + 255 * (1 - a));
    data[i + 3] = 255;
  }
  const result = jsQR(data, png.width, png.height, { inversionAttempts: "dontInvert" });
  return result?.data ?? null;
}

const logo = makeLogoDataUrl();
const base = { ...DEFAULT_SETTINGS, url: URL_UNDER_TEST, logo, logoName: "test-logo.png", errorCorrection: "H" };

/** Each case: label, settings override, expectScan (true = must decode). */
const cases = [
  // Every dot style with a 20% logo at H – the app's default path.
  ...DOT_TYPES.map((dotType) => ({ label: `dot=${dotType} 20% H`, s: { dotType, logoSize: 20 }, expectScan: true })),
  { label: "max logo 25% H", s: { logoSize: 25 }, expectScan: true },
  { label: "25% H no padding", s: { logoSize: 25, logoMargin: 0 }, expectScan: true },
  { label: "25% H padding 8%", s: { logoSize: 25, logoMargin: 8 }, expectScan: true },
  { label: "transparent bg 20% H", s: { bgTransparent: true, logoSize: 20 }, expectScan: true },
  { label: "coloured 22% H", s: { fgColor: "#0a66c2", bgColor: "#f0f6ff", logoSize: 22, dotType: "classy-rounded" }, expectScan: true },
  { label: "corner dot/dot 20% H", s: { cornerSquareType: "dot", cornerDotType: "dot", dotType: "dots" }, expectScan: true },
  { label: "no logo M", s: { logo: null, errorCorrection: "M" }, expectScan: true },
  { label: "small 512px 20% H", s: { logoSize: 20 }, size: 512, expectScan: true },
  { label: "large 2048px 25% H", s: { logoSize: 25 }, size: 2048, expectScan: true },
  // Informational: what the warning system flags. Not asserted.
  { label: "25% at L (warned)", s: { logoSize: 25, errorCorrection: "L" }, expectScan: null },
  { label: "25% at M (warned)", s: { logoSize: 25, errorCorrection: "M" }, expectScan: null },
];

let failures = 0;
console.log(`Scan test – payload: ${URL_UNDER_TEST}\n`);
for (const c of cases) {
  const settings = { ...base, ...c.s };
  const size = c.size ?? 1024;
  const risk = assessLogoRisk(settings);
  const png = await renderPng(settings, size);
  const file = path.join(OUT_DIR, c.label.replace(/[^a-z0-9]+/gi, "_") + ".png");
  fs.writeFileSync(file, png);
  const decoded = decode(png);
  const ok = decoded === URL_UNDER_TEST;
  let status;
  if (c.expectScan === null) status = ok ? "info  ✓ scans" : "info  ✗ no scan";
  else if (ok === c.expectScan) status = "PASS";
  else {
    status = "FAIL";
    failures++;
  }
  console.log(
    `${status.padEnd(15)} ${c.label.padEnd(28)} risk=${risk.level.padEnd(7)} decoded=${decoded ? "yes" : "no "} -> ${path.relative(process.cwd(), file)}`
  );
}

console.log(`\n${failures === 0 ? "All asserted cases passed." : failures + " case(s) FAILED."}`);
process.exit(failures === 0 ? 0 : 1);
