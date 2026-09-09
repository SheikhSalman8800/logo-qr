const STORAGE_KEY = "logo-qr:presets:v1";

/** Brand-ish colour templates. Only colours & shapes – never the URL/logo. */
export const TEMPLATES = [
  // Every template carries a background colour, so applying one turns transparency off.
  { name: "Classic", fgColor: "#000000", bgColor: "#ffffff", dotType: "square", cornerSquareType: "square", cornerDotType: "square", bgTransparent: false },
  { name: "Midnight", fgColor: "#1a1a2e", bgColor: "#ffffff", dotType: "rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot", bgTransparent: false },
  { name: "Instagram", fgColor: "#c13584", bgColor: "#fff5fa", dotType: "dots", cornerSquareType: "extra-rounded", cornerDotType: "dot", bgTransparent: false },
  { name: "LinkedIn", fgColor: "#0a66c2", bgColor: "#ffffff", dotType: "classy-rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot", bgTransparent: false },
  { name: "YouTube", fgColor: "#ff0000", bgColor: "#ffffff", dotType: "rounded", cornerSquareType: "extra-rounded", cornerDotType: "square", bgTransparent: false },
  { name: "Spotify", fgColor: "#1db954", bgColor: "#191414", dotType: "dots", cornerSquareType: "dot", cornerDotType: "dot", bgTransparent: false },
  { name: "WhatsApp", fgColor: "#075e54", bgColor: "#e7fbe9", dotType: "classy", cornerSquareType: "extra-rounded", cornerDotType: "dot", bgTransparent: false },
  { name: "Slate", fgColor: "#334155", bgColor: "#f1f5f9", dotType: "classy-rounded", cornerSquareType: "square", cornerDotType: "square", bgTransparent: false },
];

/** Keys that a saved preset captures (design only; not URL or logo). */
export const PRESET_KEYS = [
  "dotType",
  "cornerSquareType",
  "cornerDotType",
  "fgColor",
  "bgColor",
  "bgTransparent",
  "logoSize",
  "logoMargin",
  "errorCorrection",
];

export function pickPreset(settings) {
  return Object.fromEntries(PRESET_KEYS.map((k) => [k, settings[k]]));
}

export function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* quota / private mode – ignore */
  }
}
