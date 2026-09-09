import { useRef, useState } from "react";

const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function LogoUpload({ logo, logoName, onChange }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Unsupported file type – please use PNG, JPG or SVG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is larger than 2 MB. Please use a smaller logo.");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      onChange({ logo: dataUrl, logoName: file.name });
    } catch {
      setError("Could not read that file.");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <section className="panel">
      <h2>2. Logo</h2>

      {logo ? (
        <div className="logo-current">
          <img src={logo} alt="Uploaded logo" />
          <div className="logo-meta">
            <strong title={logoName}>{logoName}</strong>
            <div className="row">
              <button type="button" className="btn small" onClick={() => inputRef.current?.click()}>
                Replace
              </button>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => onChange({ logo: null, logoName: "" })}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="dropzone-icon">🖼</div>
          <p>
            <strong>Drop a logo here</strong> or click to browse
          </p>
          <p className="muted">PNG, JPG or SVG · up to 2 MB · square logos work best</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && <p className="note warn">⚠ {error}</p>}
      {!logo && (
        <p className="note muted">
          Optional. Adding a logo automatically raises error correction to <strong>H</strong>.
        </p>
      )}
    </section>
  );
}
