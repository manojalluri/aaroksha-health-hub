import { useState, useEffect, useCallback } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = "aaroksha_pwa_install_dismissed";

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const bannerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "24px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "calc(100% - 32px)",
  maxWidth: "440px",
  background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #2563eb 100%)",
  borderRadius: "20px",
  padding: "18px 20px",
  boxShadow:
    "0 24px 64px rgba(29, 78, 216, 0.45), 0 4px 20px rgba(0,0,0,0.25)",
  zIndex: 99999,
  animation: "pwaSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
  color: "#fff",
};

const keyframes = `
  @keyframes pwaSlideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(40px) scale(0.96); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
  }
  .pwa-install-btn:hover  { background: rgba(255,255,255,0.92) !important; transform: scale(1.04) !important; }
  .pwa-dismiss-btn:hover  { background: rgba(255,255,255,0.18) !important; }
  .pwa-close-btn:hover    { background: rgba(255,255,255,0.2)  !important; }
`;

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — hide
    if (isInStandaloneMode()) return;

    // User already dismissed — don't show again
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;

    // ─── iOS: show immediately on mount ───────────────────────────
    if (isIOS()) {
      setShowIOSGuide(true);
      return;
    }

    // ─── Android / Desktop: show the moment browser allows install ─
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true); // ← no delay, show immediately
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setShowBanner(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem(DISMISSED_KEY, "true");
  }, []);

  if (installed) return null;

  // ─── iOS Guide ────────────────────────────────────────────────────
  if (showIOSGuide) {
    return (
      <div style={bannerStyle}>
        <style>{keyframes}</style>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="pwa-close-btn"
          aria-label="Dismiss"
          style={{
            position: "absolute", top: "12px", right: "12px",
            background: "rgba(255,255,255,0.12)", border: "none",
            borderRadius: "50%", width: "30px", height: "30px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff", transition: "background 0.2s",
          }}
        >
          <X size={15} />
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
          <div style={{
            width: "50px", height: "50px", borderRadius: "14px",
            background: "rgba(255,255,255,0.15)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
            border: "1.5px solid rgba(255,255,255,0.25)",
          }}>
            <img src="/favicon.png" alt="Aaroksha" style={{ width: "36px", height: "36px", borderRadius: "10px" }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "-0.3px" }}>
              Install Aaroksha App
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "2px" }}>
              Add to your Home Screen for faster access
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{
          background: "rgba(255,255,255,0.1)", borderRadius: "14px",
          padding: "14px 16px", marginBottom: "4px",
        }}>
          {[
            { step: "1", text: <>Tap the <Share size={13} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} /> <strong>Share</strong> button in Safari's toolbar</> },
            { step: "2", text: <><strong>"Add to Home Screen"</strong> from the menu</> },
            { step: "3", text: <>Tap <strong>"Add"</strong> — done! 🎉</> },
          ].map(({ step, text }) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: step !== "3" ? "10px" : 0 }}>
              <span style={{
                background: "rgba(255,255,255,0.25)", borderRadius: "50%",
                width: "24px", height: "24px", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 700, flexShrink: 0,
              }}>{step}</span>
              <span style={{ fontSize: "13.5px", opacity: 0.9, lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div style={{
          position: "absolute", bottom: "-10px", left: "50%",
          transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "10px solid #2563eb",
        }} />
      </div>
    );
  }

  // ─── Android / Desktop Banner ─────────────────────────────────────
  if (!showBanner) return null;

  return (
    <div style={{ ...bannerStyle, display: "flex", alignItems: "center", gap: "16px" }}>
      <style>{keyframes}</style>

      {/* App Icon */}
      <div style={{
        width: "56px", height: "56px", borderRadius: "16px", flexShrink: 0,
        background: "rgba(255,255,255,0.15)", display: "flex",
        alignItems: "center", justifyContent: "center",
        border: "1.5px solid rgba(255,255,255,0.25)",
      }}>
        <img src="/favicon.png" alt="Aaroksha" style={{ width: "40px", height: "40px", borderRadius: "12px" }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "-0.2px", marginBottom: "3px" }}>
          Install Aaroksha App
        </div>
        <div style={{ fontSize: "12px", opacity: 0.75, lineHeight: 1.5 }}>
          Fast access · Works offline · No App Store needed
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "7px", flexShrink: 0 }}>
        <button
          id="pwa-install-btn"
          onClick={handleInstall}
          className="pwa-install-btn"
          style={{
            background: "#fff", color: "#1d4ed8",
            border: "none", borderRadius: "10px",
            padding: "9px 16px", fontWeight: 700, fontSize: "13px",
            cursor: "pointer", display: "flex", alignItems: "center",
            gap: "6px", transition: "all 0.2s ease",
          }}
        >
          <Download size={14} />
          Install
        </button>
        <button
          id="pwa-dismiss-btn"
          onClick={handleDismiss}
          className="pwa-dismiss-btn"
          style={{
            background: "rgba(255,255,255,0.1)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px",
            padding: "8px 16px", fontSize: "12px", cursor: "pointer",
            transition: "all 0.2s ease", textAlign: "center",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// ─── Optional: Floating install button for desktop header ──────────────────
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (isIOS()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setVisible(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferredPrompt) return null;

  return (
    <button
      id="pwa-header-install-btn"
      onClick={async () => {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setVisible(false);
      }}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
        color: "#fff", border: "none", borderRadius: "8px",
        padding: "8px 14px", fontSize: "13px", fontWeight: 600,
        cursor: "pointer", boxShadow: "0 2px 8px rgba(29,78,216,0.3)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <Smartphone size={14} />
      Install App
    </button>
  );
}
