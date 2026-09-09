/**
 * Maps the app's `settings` object onto qr-code-styling `Options`.
 *
 * Note on logo sizing: qr-code-styling's `imageOptions.imageSize` is NOT a
 * percentage of the QR side. Internally the library computes
 *
 *   maxHiddenModules = imageSize * EC_CAPACITY[level] * moduleCount^2
 *
 * i.e. `imageSize` is a coefficient applied to the error-correction capacity
 * (L=7%, M=15%, Q=25%, H=30% of modules may be lost). We expose a more
 * intuitive "logo width as % of QR width" slider and convert it here.
 */

export const EC_CAPACITY = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

export const DOT_TYPES = ["square", "rounded", "dots", "classy", "classy-rounded"];
export const CORNER_SQUARE_TYPES = ["square", "dot", "extra-rounded"];
export const CORNER_DOT_TYPES = ["square", "dot"];
export const EC_LEVELS = ["L", "M", "Q", "H"];

export const LOGO_SIZE_MIN = 10; // % of QR width
export const LOGO_SIZE_MAX = 25; // hard cap – see README for the reasoning
export const PLACEHOLDER_URL = "https://example.com";

export const DEFAULT_SETTINGS = {
  url: "",
  logo: null, // data URL
  logoName: "",
  dotType: "rounded",
  cornerSquareType: "extra-rounded",
  cornerDotType: "dot",
  fgColor: "#1a1a2e",
  bgColor: "#ffffff",
  bgTransparent: false,
  logoSize: 20, // % of QR width
  logoMargin: 2, // % of QR width, clear space around the logo
  errorCorrection: "M", // switches to H automatically when a logo is added
};

/**
 * Normalise the payload before it reaches the library.
 *
 * qr-code-styling converts strings to bytes with `charCode & 0xff` (Latin-1),
 * which silently corrupts anything outside Latin-1 (CJK, emoji, …) and leaves
 * the charset ambiguous for scanners. Two fixes:
 *  - http(s) URLs are serialised via `new URL().href`, exactly as a browser
 *    would (percent-encoded path/query, punycode host). Pure ASCII, unambiguous.
 *  - Anything else is UTF-8 encoded into a "binary string" (one char per byte),
 *    so the library's Latin-1 pass emits correct UTF-8 bytes, which is what
 *    every modern scanner assumes for Byte mode.
 */
export function encodeData(raw) {
  const v = raw.trim() || PLACEHOLDER_URL;
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(v)) return v; // already ASCII – keep exactly what the user typed
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* not a URL – fall through */
  }
  return String.fromCharCode(...new TextEncoder().encode(v));
}

/** Fraction of the QR *area* the logo occupies (side% squared). */
export function logoAreaFraction(logoSizePct) {
  const side = logoSizePct / 100;
  return side * side;
}

/** Convert "logo width as % of QR width" -> library imageSize coefficient. */
export function toImageSizeCoefficient(logoSizePct, ecLevel) {
  const area = logoAreaFraction(logoSizePct);
  const capacity = EC_CAPACITY[ecLevel] ?? EC_CAPACITY.H;
  // The library caps at 1 in practice; anything above means "cover the whole
  // capacity", which we never want. Clamp defensively.
  return Math.min(1, area / capacity);
}

/**
 * Build library options for a given render size (px).
 * `type` is "canvas" for preview/PNG and "svg" for vector export.
 */
export function buildQrOptions(settings, size = 320, type = "canvas") {
  const hasLogo = Boolean(settings.logo);
  const fg = settings.fgColor;

  return {
    type,
    width: size,
    height: size,
    margin: Math.round(size * 0.04), // quiet zone
    data: encodeData(settings.url),
    image: hasLogo ? settings.logo : "",
    qrOptions: {
      typeNumber: 0, // auto
      mode: "Byte",
      errorCorrectionLevel: settings.errorCorrection,
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: hasLogo ? toImageSizeCoefficient(settings.logoSize, settings.errorCorrection) : 0,
      margin: hasLogo ? Math.round((size * settings.logoMargin) / 100) : 0,
      crossOrigin: "anonymous",
      saveAsBlob: false,
    },
    dotsOptions: { type: settings.dotType, color: fg },
    cornersSquareOptions: { type: settings.cornerSquareType, color: fg },
    cornersDotOptions: { type: settings.cornerDotType, color: fg },
    backgroundOptions: {
      color: settings.bgTransparent ? "transparent" : settings.bgColor,
    },
  };
}
