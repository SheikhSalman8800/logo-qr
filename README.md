# Logo QR

A fully client-side web app for generating custom QR codes with an embedded logo.
Built with React + Vite and [`qr-code-styling`](https://github.com/kozakdenys/qr-code-styling).
Nothing is uploaded anywhere: the URL, logo and rendered images never leave the browser.

## Features

- URL input with soft validation (warns, never blocks)
- Logo upload via drag-and-drop or file picker (PNG / JPG / SVG, up to 2 MB)
- Live preview that re-renders on every change
- Dot style: square / rounded / dots / classy / classy-rounded
- Corner square style: square / dot / extra-rounded
- Corner dot style: square / dot
- Foreground and background colour pickers, with a transparent-background option
- Logo zone slider (10–25 % of the code width) and logo padding slider
- Error correction level L / M / Q / H, defaulting to **H** whenever a logo is present
- Warnings when the logo size + error-correction combination risks scan failure
- Export as PNG (512 / 1024 / 2048 px), SVG, or copy the PNG to the clipboard
- "Test scan" reminder after every export
- Brand colour templates and save/load of your own design presets (localStorage)

## Setup

Requires Node 18 or newer (tested on Node 21).

```bash
npm install
npm run dev        # start the dev server, usually http://localhost:5173
npm run build      # production build into ./dist
npm run preview    # serve the production build locally
npm run test:scan  # headless render + decode test (see below)
npm run test:e2e   # browser end-to-end test; needs `npm run dev` running and Google Chrome installed
```

`dist/` is static and can be dropped onto any static host (GitHub Pages, Netlify, S3, …).

## Project structure

```
index.html
src/
  main.jsx                 React entry point
  App.jsx                  Owns all settings state, wires the components together
  styles.css
  lib/
    qrOptions.js           Maps app settings -> qr-code-styling options (incl. logo-size maths)
    validation.js          URL check and logo/error-correction risk assessment
    presets.js             Brand templates + localStorage save/load
  components/
    UrlInput.jsx
    LogoUpload.jsx
    DesignControls.jsx
    QrPreview.jsx          Single QRCodeStyling instance, updated in place
    ExportPanel.jsx        Off-screen render at export size, PNG/SVG/clipboard
    Presets.jsx
scripts/
  scan-test.mjs            Renders codes in Node and decodes them with ZXing + jsQR
  e2e.mjs                  Drives the app in headless Chrome: every control, upload, export, preset
```

## How the error-correction / logo trade-off works

A QR code stores its payload with Reed–Solomon error correction. The level decides how much of
the symbol can be missing or wrong and still decode:

| Level | Recoverable damage | Cost |
| ----- | ------------------ | ---- |
| L     | ~7 %               | smallest code |
| M     | ~15 %              | |
| Q     | ~25 %              | |
| H     | ~30 %              | densest code (more, smaller modules) |

An embedded logo works by **deliberately hiding modules in the centre** of the code and relying
on error correction to fill in the gaps. The logo therefore spends part of the recovery budget
before the code is ever printed. Whatever is left has to absorb real-world damage: print
noise, glare, camera blur, folds, a sticker on a curved bottle.

That is why the app:

1. Switches to level **H** automatically whenever a logo is added. You can lower it again, but
   you'll get a warning.
2. Caps the logo zone at **25 % of the code width**. Area scales with the square of width, so
   a 25 %-wide logo hides about 6 % of the modules, roughly a fifth of what level H can
   recover. That leaves plenty of headroom. A 50 %-wide logo would hide 25 % of the modules
   and fail almost every scan.
3. Rates the combination as *ok*, *caution* or *danger* based on how much of the
   error-correction budget the logo consumes (under 35 % is ok, 35–60 % is caution, above
   60 % is danger). The headless test confirms this: a 25 % logo at level L fails to decode,
   at level M it still scans but with little margin, at level H it is comfortably safe.

### Note on how `qr-code-styling` sizes the logo

The library's `imageOptions.imageSize` is **not** a percentage of the code width. Internally it
computes `maxHiddenModules = imageSize × capacity(level) × moduleCount²`, so the same
`imageSize` value produces a different logo at each error-correction level. `src/lib/qrOptions.js`
converts the app's intuitive "% of width" slider into that coefficient and keeps the risk
calculation in the same units. The cleared zone also snaps to an odd number of modules, and
the padding slider is taken from *inside* that zone, so the visible logo is slightly smaller
than the slider value.

### Text encoding

`qr-code-styling` converts the payload to bytes with a Latin-1 mask, which silently corrupts
characters outside Latin-1 (CJK, emoji, …). `encodeData()` in `src/lib/qrOptions.js` therefore
normalises the payload first: http(s) URLs containing non-ASCII are serialised exactly as a
browser would (`new URL(v).href`, i.e. percent-encoded path and punycode host), and any other
non-ASCII text is UTF-8 encoded. Pure-ASCII input is passed through untouched.

### Other tips for reliable scanning

- Keep strong contrast: a dark foreground on a light background. Avoid light-on-dark for print.
- Don't remove the quiet zone (the light border) when placing the code in a layout.
- Print at 2 cm / 0.8 in or larger. Prefer SVG or the 1024 px+ PNG for print.
- Fancy dot styles ("dots", "classy") reduce the ink in each module. They scanned fine with
  ZXing in every test, but the simpler jsQR decoder gives up on "dots" at 2048 px. If a code
  must work with every scanner app, "square" or "rounded" is the safest choice.
- **Always test-scan** the final asset with a phone before you print or publish it.

## Scan test

`npm run test:scan` renders a matrix of codes (every dot style, 20 % and 25 % logos, with and
without padding, transparent background, 512 px and 2048 px, unicode URLs and text, a
310-character URL) using the exact option mapping the app uses, then decodes each PNG with two
independent decoders and checks the payload round-trips:

- [ZXing](https://github.com/zxing-cpp/zxing-cpp) via `zxing-wasm`, the engine most phone
  scanner apps derive from. This is the authoritative result.
- [`jsQR`](https://github.com/cozmo/jsQR), a stricter pure-JS decoder, reported for information.

The rendered PNGs are written to `test-output/` so you can also scan them with a real phone.
The test uses `jsdom` and `node-canvas` (dev dependencies only) to run the library in Node.

## Browser end-to-end test

`npm run test:e2e` (with `npm run dev` running in another terminal) drives the real app in
headless Chrome through `playwright-core`, using the Google Chrome already installed on the
machine. It covers URL validation cases, PNG/JPG/SVG uploads and rejections, every design
control, the risk warnings, rapid-update races, PNG exports at all three sizes, SVG export,
clipboard copy, presets across a reload, keyboard access and the mobile layout. Exported files
are decoded with ZXing and jsQR to prove they scan. Pass a URL to test another server, e.g.
`node scripts/e2e.mjs http://localhost:4173` after `npm run preview`.

## Stretch goals

- [x] Save/load design presets (localStorage)
- [x] Preset templates for common brand colour schemes
- [ ] **TODO:** batch-generate multiple QR codes from a CSV of links. Kept out to stay
      dependency-light (a ZIP download would need e.g. `jszip`). Sketch: parse CSV client-side,
      loop over rows re-using `renderBlob()` in `ExportPanel.jsx`, collect blobs into a ZIP.

## Browser notes

- "Copy to clipboard" needs a secure context (`https://` or `localhost`) and a browser with
  `ClipboardItem` support (Chrome, Edge, Safari 13.1+, Firefox 127+). The button is disabled
  otherwise.
- SVG logos must have a `viewBox` or `width`/`height`; otherwise browsers fall back to 300×150
  and the logo renders cropped. The app warns when it detects this.
- Non-square logos are fitted inside a square zone and look small. The app warns when the
  aspect ratio is beyond 3:2; pad the logo to a square canvas for best results.
