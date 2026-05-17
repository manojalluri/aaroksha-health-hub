import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { RefreshCw, X } from "lucide-react";

/**
 * Renders a sticky top banner when a new version of the PWA is available.
 * Uses the `usePWAUpdate` hook which taps into the Workbox lifecycle.
 */
export function PWAUpdateToast() {
  const { needRefresh, acceptUpdate, dismissUpdate } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: "linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "12px 16px",
        fontSize: "14px",
        fontWeight: 500,
        boxShadow: "0 2px 16px rgba(29,78,216,0.35)",
        animation: "slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .pwa-update-btn:hover { background: rgba(255,255,255,0.95) !important; }
        .pwa-close-btn:hover  { background: rgba(255,255,255,0.15) !important; }
      `}</style>

      {/* Icon */}
      <RefreshCw size={16} style={{ flexShrink: 0, animation: "spin 2s linear infinite" }} />

      {/* Message */}
      <span style={{ flex: 1, textAlign: "center" }}>
        🎉 A new version of Aaroksha is ready!
      </span>

      {/* Update button */}
      <button
        id="pwa-update-now-btn"
        onClick={acceptUpdate}
        className="pwa-update-btn"
        style={{
          background: "#fff",
          color: "#1d4ed8",
          border: "none",
          borderRadius: "8px",
          padding: "6px 14px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        Update Now
      </button>

      {/* Dismiss */}
      <button
        id="pwa-update-dismiss-btn"
        onClick={dismissUpdate}
        className="pwa-close-btn"
        aria-label="Dismiss update notification"
        style={{
          background: "transparent",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          borderRadius: "50%",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
