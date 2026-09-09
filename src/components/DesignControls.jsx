import { useEffect, useState } from "react";
import {
  DOT_TYPES,
  CORNER_SQUARE_TYPES,
  CORNER_DOT_TYPES,
  EC_LEVELS,
  EC_CAPACITY,
  LOGO_SIZE_MIN,
  LOGO_SIZE_MAX,
} from "../lib/qrOptions.js";
import { assessLogoRisk } from "../lib/validation.js";

const EC_TOOLTIP =
  "Error correction adds redundant data so the code still scans when part of it is missing or damaged. " +
  "L recovers ~7%, M ~15%, Q ~25%, H ~30%. An embedded logo deliberately hides modules in the centre, " +
  "so it 'spends' part of that budget – level H leaves the most headroom for real-world damage, glare and small prints.";

function Select({ label, value, options, onChange }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorField({ label, value, onChange, disabled }) {
  // Local draft so the user can type a hex code character by character;
  // only complete, valid values are pushed up.
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className={`field color-field ${disabled ? "disabled" : ""}`}>
      <span className="field-label">{label}</span>
      <span className="color-row">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <input
          type="text"
          className="color-hex"
          aria-label={`${label} hex value`}
          value={draft}
          maxLength={7}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = "#" + v;
            setDraft(v);
            if (HEX_RE.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => {
            if (!HEX_RE.test(draft)) setDraft(value);
          }}
        />
      </span>
    </div>
  );
}

export default function DesignControls({ settings, onChange }) {
  const set = (key) => (value) => onChange({ [key]: value });
  const hasLogo = Boolean(settings.logo);
  const risk = assessLogoRisk(settings);

  return (
    <section className="panel">
      <h2>3. Design</h2>

      <div className="grid-2">
        <Select label="Dot style" value={settings.dotType} options={DOT_TYPES} onChange={set("dotType")} />
        <Select
          label="Corner square style"
          value={settings.cornerSquareType}
          options={CORNER_SQUARE_TYPES}
          onChange={set("cornerSquareType")}
        />
        <Select
          label="Corner dot style"
          value={settings.cornerDotType}
          options={CORNER_DOT_TYPES}
          onChange={set("cornerDotType")}
        />
        <label className="field">
          <span className="field-label">
            Error correction{" "}
            <span className="info" title={EC_TOOLTIP} aria-label="What is error correction?">
              ⓘ
            </span>
          </span>
          <select value={settings.errorCorrection} onChange={(e) => set("errorCorrection")(e.target.value)}>
            {EC_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l} – recovers ~{Math.round(EC_CAPACITY[l] * 100)}%
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <ColorField label="Foreground" value={settings.fgColor} onChange={set("fgColor")} />
        <ColorField
          label="Background"
          value={settings.bgColor}
          onChange={set("bgColor")}
          disabled={settings.bgTransparent}
        />
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={settings.bgTransparent}
          onChange={(e) => set("bgTransparent")(e.target.checked)}
        />
        Transparent background (PNG / SVG only – place it on a light surface)
      </label>

      <fieldset className={`subgroup ${hasLogo ? "" : "disabled"}`} disabled={!hasLogo}>
        <legend>Logo</legend>
        <label className="field">
          <span className="field-label">
            Logo zone <em>{settings.logoSize}% of QR width</em>
          </span>
          <input
            type="range"
            min={LOGO_SIZE_MIN}
            max={LOGO_SIZE_MAX}
            step={1}
            value={settings.logoSize}
            onChange={(e) => set("logoSize")(Number(e.target.value))}
          />
          <span className="range-hint">
            Width of the area cleared for the logo, capped at {LOGO_SIZE_MAX}% so it stays well inside the error-correction budget. The zone snaps to whole modules, and padding is taken from inside it, so the visible logo is a little smaller.
          </span>
        </label>
        <label className="field">
          <span className="field-label">
            Logo padding <em>{settings.logoMargin}%</em>
          </span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={settings.logoMargin}
            onChange={(e) => set("logoMargin")(Number(e.target.value))}
          />
          <span className="range-hint">Clear space between the logo and surrounding dots.</span>
        </label>
      </fieldset>

      {hasLogo && settings.errorCorrection === "H" && risk.level === "ok" && (
        <p className="note ok">
          ✓ Error correction is <strong>H</strong>: the logo hides ~
          {Math.round((settings.logoSize / 100) ** 2 * 100)}% of the code, well within the 30% the code can
          recover.
        </p>
      )}
      {risk.message && <p className={`note ${risk.level === "danger" ? "danger" : "warn"}`}>⚠ {risk.message}</p>}
    </section>
  );
}
