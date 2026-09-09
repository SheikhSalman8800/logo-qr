import { useRef, useState } from "react";

const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml"];
const ACCEPTED_EXT = /\.(png|jpe?g|svg)$/i;

/** Some OS/browser combos report an empty MIME type for dropped files – fall back to the extension. */
function isAccepted(file) {
  return ACCEPTED.includes(file.type) || (!file.type && ACCEPTED_EXT.test(file.name));
}
const MAX_BYTES = 2 * 1024 * 1024;

/** Non-blocking advice about a logo that will render poorly. Returns a string or null. */
async function inspectLogo(file, dataUrl) {
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    const text = await file.text();
    const hasViewBox = /<svg[^>]*\sviewBox=/i.test(text);
    const hasSize = /<svg[^>]*\swidth=/i.test(text) && /<svg[^>]*\sheight=/i.test(text);
    if (!hasViewBox && !hasSize) {
      return "This SVG has no viewBox or width/height, so browsers can't size it and it may render cropped. Add a viewBox to the <svg> tag.";
    }
  }
  const dims = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
  if (dims && dims.w && dims.h) {
    const ratio = dims.w / dims.h;
    if (ratio > 1.5 || ratio < 1 / 1.5) {
      return `Logo is ${dims.w}×${dims.h} (not square). It is fitted inside a square zone, so it will look small. Pad it to a square canvas for a bigger logo.`;
    }
  }
  return null;
}

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
  const [hint, setHint] = useState(null);

  async function handleFile(file) {
    setError(null);
    setHint(null);
    if (!file) return;
    if (!isAccepted(file)) {
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
      setHint(await inspectLogo(file, dataUrl));
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
                onClick={() => {
                  setHint(null);
                  onChange({ logo: null, logoName: "" });
                }}
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
      {hint && logo && <p className="note warn">⚠ {hint}</p>}
      {!logo && (
        <p className="note muted">
          Optional. Adding a logo automatically raises error correction to <strong>H</strong>.
        </p>
      )}
    </section>
  );
}
