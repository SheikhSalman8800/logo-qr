import { useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { buildQrOptions } from "../lib/qrOptions.js";

const PNG_SIZES = [512, 1024, 2048];

function safeFilename(url) {
  const base = (url || "qr-code")
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "qr-code";
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render off-screen at an arbitrary size and return a Blob. */
async function renderBlob(settings, size, extension) {
  const qr = new QRCodeStyling(buildQrOptions(settings, size, extension === "svg" ? "svg" : "canvas"));
  const blob = await qr.getRawData(extension);
  if (!blob) throw new Error("Renderer returned no data");
  return blob;
}

export default function ExportPanel({ settings, onExported }) {
  const [pngSize, setPngSize] = useState(1024);
  const [busy, setBusy] = useState(null); // "png" | "svg" | "copy"
  const [status, setStatus] = useState(null); // { kind: "ok"|"error", text }

  const name = safeFilename(settings.url.trim());
  const canCopy = typeof navigator !== "undefined" && "clipboard" in navigator && "ClipboardItem" in window;

  async function run(kind, fn) {
    setBusy(kind);
    setStatus(null);
    try {
      await fn();
      onExported?.();
    } catch (err) {
      setStatus({ kind: "error", text: err?.message || "Export failed" });
    } finally {
      setBusy(null);
    }
  }

  const downloadPng = () =>
    run("png", async () => {
      const blob = await renderBlob(settings, pngSize, "png");
      triggerDownload(blob, `${name}-${pngSize}px.png`);
      setStatus({ kind: "ok", text: `Downloaded ${pngSize}×${pngSize} PNG.` });
    });

  const downloadSvg = () =>
    run("svg", async () => {
      const blob = await renderBlob(settings, 1024, "svg");
      triggerDownload(blob, `${name}.svg`);
      setStatus({ kind: "ok", text: "Downloaded SVG (infinitely scalable)." });
    });

  const copyPng = () =>
    run("copy", async () => {
      // Safari requires the ClipboardItem to be created synchronously with a
      // promise, other browsers accept a resolved Blob. Passing the promise
      // works everywhere.
      const blobPromise = renderBlob(settings, pngSize, "png");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      setStatus({ kind: "ok", text: `Copied ${pngSize}px PNG to clipboard.` });
    });

  return (
    <section className="panel">
      <h2>Export</h2>

      <label className="field">
        <span className="field-label">PNG resolution</span>
        <div className="segmented">
          {PNG_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={s === pngSize ? "active" : ""}
              onClick={() => setPngSize(s)}
            >
              {s}px
            </button>
          ))}
        </div>
      </label>

      <div className="export-actions">
        <button type="button" className="btn primary" onClick={downloadPng} disabled={busy !== null}>
          {busy === "png" ? "Rendering…" : `Download PNG (${pngSize}px)`}
        </button>
        <button type="button" className="btn" onClick={downloadSvg} disabled={busy !== null}>
          {busy === "svg" ? "Rendering…" : "Download SVG"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={copyPng}
          disabled={busy !== null || !canCopy}
          title={canCopy ? "Copy PNG image to clipboard" : "Clipboard image API not available in this browser"}
        >
          {busy === "copy" ? "Copying…" : "Copy to clipboard"}
        </button>
      </div>

      {status && <p className={`note ${status.kind === "ok" ? "ok" : "danger"}`}>{status.text}</p>}
      <p className="note muted">
        For print, use 1024px+ or SVG. Keep a light quiet zone around the code and don't shrink it below ~2 cm.
      </p>
    </section>
  );
}
