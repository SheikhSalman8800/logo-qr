import { useState } from "react";
import { TEMPLATES, pickPreset, loadPresets, savePresets } from "../lib/presets.js";

export default function Presets({ settings, onApply }) {
  const [presets, setPresets] = useState(loadPresets);
  const [name, setName] = useState("");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...presets.filter((p) => p.name !== trimmed), { name: trimmed, ...pickPreset(settings) }];
    setPresets(next);
    savePresets(next);
    setName("");
  }

  function remove(presetName) {
    const next = presets.filter((p) => p.name !== presetName);
    setPresets(next);
    savePresets(next);
  }

  function apply(preset) {
    const { name: _n, ...rest } = preset;
    onApply(rest);
  }

  return (
    <section className="panel">
      <h2>Presets</h2>

      <span className="field-label">Templates</span>
      <div className="chips">
        {TEMPLATES.map((t) => (
          <button key={t.name} type="button" className="chip" onClick={() => apply(t)} title={`Apply ${t.name}`}>
            <span className="swatch" style={{ background: t.bgColor, borderColor: t.fgColor }}>
              <span style={{ background: t.fgColor }} />
            </span>
            {t.name}
          </button>
        ))}
      </div>

      <span className="field-label" style={{ marginTop: "0.75rem" }}>
        Your saved presets
      </span>
      {presets.length === 0 && <p className="note muted">None yet – save the current design below.</p>}
      <div className="chips">
        {presets.map((p) => (
          <span key={p.name} className="chip saved">
            <button type="button" onClick={() => apply(p)} title={`Apply ${p.name}`}>
              <span className="swatch" style={{ background: p.bgTransparent ? "#fff" : p.bgColor, borderColor: p.fgColor }}>
                <span style={{ background: p.fgColor }} />
              </span>
              {p.name}
            </button>
            <button type="button" className="chip-x" onClick={() => remove(p.name)} aria-label={`Delete ${p.name}`}>
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="row" style={{ marginTop: "0.5rem" }}>
        <input
          type="text"
          placeholder="Preset name"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button type="button" className="btn small" onClick={save} disabled={!name.trim()}>
          Save current design
        </button>
      </div>
    </section>
  );
}
