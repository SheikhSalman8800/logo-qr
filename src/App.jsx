import { useCallback, useEffect, useMemo, useState } from "react";
import UrlInput from "./components/UrlInput.jsx";
import LogoUpload from "./components/LogoUpload.jsx";
import DesignControls from "./components/DesignControls.jsx";
import QrPreview from "./components/QrPreview.jsx";
import ExportPanel from "./components/ExportPanel.jsx";
import Presets from "./components/Presets.jsx";
import { DEFAULT_SETTINGS } from "./lib/qrOptions.js";
import { assessLogoRisk } from "./lib/validation.js";

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [scanReminder, setScanReminder] = useState(false);

  const update = useCallback((patch) => setSettings((prev) => ({ ...prev, ...patch })), []);

  /** Logo added/replaced -> force error correction to H (user can still lower it afterwards). */
  const updateLogo = useCallback(
    ({ logo, logoName }) =>
      setSettings((prev) => ({
        ...prev,
        logo,
        logoName,
        errorCorrection: logo ? "H" : prev.errorCorrection,
      })),
    []
  );

  const risk = useMemo(() => assessLogoRisk(settings), [settings]);

  // Highlight the "test scan" reminder briefly after each export.
  useEffect(() => {
    if (!scanReminder) return;
    const t = setTimeout(() => setScanReminder(false), 4000);
    return () => clearTimeout(t);
  }, [scanReminder]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Logo<span>QR</span>
        </h1>
        <p>Custom QR codes with an embedded logo. Everything runs in your browser – nothing is uploaded.</p>
      </header>

      <main className="layout">
        <div className="column controls">
          <UrlInput value={settings.url} onChange={(url) => update({ url })} />
          <LogoUpload logo={settings.logo} logoName={settings.logoName} onChange={updateLogo} />
          <DesignControls settings={settings} onChange={update} />
          <Presets settings={settings} onApply={update} />
        </div>

        <div className="column preview">
          <div className="sticky">
            <QrPreview settings={settings} riskLevel={risk.level} showScanReminder={scanReminder} />
            <ExportPanel settings={settings} onExported={() => setScanReminder(true)} />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Built with <a href="https://github.com/kozakdenys/qr-code-styling">qr-code-styling</a>. Always test-scan
        before you print.
      </footer>
    </div>
  );
}
