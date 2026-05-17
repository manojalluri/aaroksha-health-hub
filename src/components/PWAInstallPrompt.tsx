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
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isInStandaloneMode()) return;

    // Don't show if user previously dismissed
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;

    if (isIOS()) {
      // Show iOS-specific guide after 3 seconds
      const timer = setTimeout(() => setShowIOSGuide(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so it doesn't pop up immediately
      setTimeout(() => setShowBanner(true), 2500);
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
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem(DISMISSED_KEY, "true");
  }, []);

  if (installed) return null;

  // iOS Install Guide
  if (showIOSGuide) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 32px)",
          maxWidth: "420px",
          background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 20px 60px rgba(29, 78, 216, 0.4), 0 4px 16px rgba(0,0,0,0.2)",
          zIndex: 9999,
          animation: "slideUpFade 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          color: "#fff",
        }}
      >
        <style>{`
          @keyframes slideUpFade {
            from { opacity: 0; transform: translateX(-50%) translateY(30px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
          }
        `}</style>

        <button
          onClick={handleDismiss}
          style={{
            position: "absolute", top: "12px", right: "12px",
            background: "rgba(255,255,255,0.15)", border: "none",
            borderRadius: "50%", width: "28px", height: "28px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
          aria-label="Dismiss install prompt"
        >
          <X size={14} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: "rgba(255,255,255,0.2)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <img src="/favicon.png" alt="Aaroksha" style={{ width: "32px", height: "32px", borderRadius: "8px" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>Install Aaroksha App</div>
            <div style={{ fontSize: "12px", opacity: 0.75 }}>Add to your Home Screen</div>
          </div>
        </div>

        <div style={{ fontSize: "13px", opacity: 0.9, lineHeight: 1.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{
              background: "rgba(255,255,255,0.2)", borderRadius: "50%",
              width: "22px", height: "22px", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 700, flexShrink: 0,
            }}>1</span>
            <span>Tap the <Share size={13} style={{ display: "inline", verticalAlign: "middle" }} /> <strong>Share</strong> button in Safari</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{
              background: "rgba(255,255,255,0.2)", borderRadius: "50%",
              width: "22px", height: "22px", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 700, flexShrink: 0,
            }}>2</span>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              background: "rgba(255,255,255,0.2)", borderRadius: "50%",
              width: "22px", height: "22px", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 700, flexShrink: 0,
            }}>3</span>
            <span>Tap <strong>"Add"</strong> to install</span>
          </div>
        </div>

        {/* Arrow pointing to share button */}
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

  // Android / Desktop Install Banner
  if (!showBanner) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "420px",
        background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)",
        borderRadius: "20px",
        padding: "20px",
        boxShadow: "0 20px 60px rgba(29, 78, 216, 0.4), 0 4px 16px rgba(0,0,0,0.2)",
        zIndex: 9999,
        animation: "slideUpFade 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(30px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .pwa-install-btn:hover {
          background: rgba(255,255,255,0.95) !important;
          transform: scale(1.03);
        }
        .pwa-dismiss-btn:hover {
          background: rgba(255,255,255,0.2) !important;
        }
      `}</style>

      {/* App Icon */}
      <div style={{
        width: "52px", height: "52px", borderRadius: "14px",
        background: "rgba(255,255,255,0.15)", display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
        border: "1.5px solid rgba(255,255,255,0.25)",
      }}>
        <img src="/favicon.png" alt="Aaroksha" style={{ width: "38px", height: "38px", borderRadius: "10px" }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "2px" }}>
          Install Aaroksha App
        </div>
        <div style={{ fontSize: "12px", opacity: 0.8, lineHeight: 1.4 }}>
          Fast access · Works offline · No App Store needed
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
        <button
          id="pwa-install-btn"
          onClick={handleInstall}
          className="pwa-install-btn"
          style={{
            background: "#fff",
            color: "#1d4ed8",
            border: "none",
            borderRadius: "10px",
            padding: "8px 14px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease",
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
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "10px",
            padding: "7px 14px",
            fontSize: "12px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// Floating install button (shows in header on desktop when PWA is installable)
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
        display: "flex",
        alignItems: "center",
        gap: "6px",
        background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: "8px 14px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(29,78,216,0.3)",
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
