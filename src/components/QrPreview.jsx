import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { buildQrOptions } from "../lib/qrOptions.js";

const PREVIEW_CSS_SIZE = 320;
// Render at 2x and scale down with CSS: crisp on retina screens and much
// easier for a phone to scan straight off the monitor.
const PREVIEW_SIZE = PREVIEW_CSS_SIZE * 2;

/**
 * Owns a single QRCodeStyling instance. On every settings change it calls
 * `update()` so the canvas re-renders in place – no flicker, no re-mount.
 */
export default function QrPreview({ settings, riskLevel, showScanReminder }) {
  const containerRef = useRef(null);
  const qrRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const qr = new QRCodeStyling(buildQrOptions(settings, PREVIEW_SIZE, "canvas"));
    qr.append(containerRef.current);
    qrRef.current = qr;
    setReady(true);
    return () => {
      qrRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qrRef.current) return;
    qrRef.current.update(buildQrOptions(settings, PREVIEW_SIZE, "canvas"));
  }, [settings]);

  const hasData = settings.url.trim().length > 0;

  return (
    <section className="panel preview-panel">
      <h2>Preview</h2>
      <div className={`preview-frame ${settings.bgTransparent ? "checker" : ""}`}>
        <div
          ref={containerRef}
          className="qr-container"
          style={{ width: PREVIEW_CSS_SIZE, maxWidth: "100%" }}
          aria-live="polite"
        />
        {!ready && <div className="preview-loading">Rendering…</div>}
      </div>
      {!hasData && <p className="note muted">Showing a placeholder – enter a URL above.</p>}
      {riskLevel === "danger" && (
        <p className="note danger">This combination is likely unscannable. Fix the warning in Design.</p>
      )}
      <p className={`note scan-reminder ${showScanReminder ? "pulse" : ""}`}>
        📱 <strong>Test scan:</strong> point your phone's camera at the preview (or the downloaded file) and
        confirm it opens the right link <em>before</em> printing or publishing. Styled dots and logos look
        great, but only a real scan proves it works.
      </p>
    </section>
  );
}
