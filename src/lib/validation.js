import { EC_CAPACITY, logoAreaFraction } from "./qrOptions.js";

/**
 * Soft URL validation. Returns `null` when the value looks fine, otherwise a
 * human-readable warning. Never blocks generation – QR codes can legitimately
 * hold plain text, phone numbers, etc.
 */
export function validateUrl(value) {
  const v = value.trim();
  if (!v) return null;

  if (/\s/.test(v)) {
    return "Contains whitespace – this won't open as a link on most phones.";
  }

  let parsed = null;
  try {
    parsed = new URL(v);
  } catch {
    // Missing scheme? e.g. "instagram.com/handle"
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(v)) {
      return 'Looks like a URL without "https://". Most scanners won\'t open it as a link – add the scheme.';
    }
    return "This doesn't look like a URL. It will still encode as plain text.";
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return `Scheme "${parsed.protocol}" is unusual for a link. Only http/https open reliably in phone browsers.`;
  }
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
    return "Hostname has no dot (e.g. \".com\") – double-check it.";
  }
  return null;
}

/**
 * Estimate whether the logo size + error-correction combination risks scan
 * failure. Returns { level: "ok" | "caution" | "danger", message }.
 *
 * Heuristic: the logo obscures `area` of the symbol. Error correction can
 * recover up to `capacity` of the codewords, but real-world scanning also has
 * to absorb print noise, glare, camera blur and the fact that a centred logo
 * hits the densest data region. We treat <35% of capacity as comfortably
 * safe, 35-60% as caution, >60% as likely to fail.
 */
export function assessLogoRisk(settings) {
  if (!settings.logo) return { level: "ok", message: null };

  const area = logoAreaFraction(settings.logoSize);
  const capacity = EC_CAPACITY[settings.errorCorrection];
  const ratio = area / capacity;

  if (ratio > 0.6) {
    return {
      level: "danger",
      message: `Logo uses ~${Math.round(ratio * 100)}% of the error-correction budget at level ${settings.errorCorrection}. This will likely fail to scan – raise error correction to H or shrink the logo.`,
    };
  }
  if (ratio > 0.35) {
    return {
      level: "caution",
      message: `Logo uses ~${Math.round(ratio * 100)}% of the error-correction budget at level ${settings.errorCorrection}. Scans may be unreliable on printed material – prefer level H.`,
    };
  }
  if (settings.errorCorrection !== "H") {
    return {
      level: "caution",
      message: `A logo is embedded but error correction is ${settings.errorCorrection}. Level H gives the most headroom for damage, glare and small prints.`,
    };
  }
  return { level: "ok", message: null };
}
