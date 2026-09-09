import { validateUrl } from "../lib/validation.js";

export default function UrlInput({ value, onChange }) {
  const warning = validateUrl(value);

  return (
    <section className="panel">
      <h2>1. Link</h2>
      <label className="field">
        <span className="field-label">URL to encode</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://yoursite.com or https://instagram.com/handle"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      {warning && <p className="note warn">⚠ {warning}</p>}
      {!warning && value.trim() && (
        <p className="note ok">✓ Looks like a valid link ({value.trim().length} characters)</p>
      )}
    </section>
  );
}
