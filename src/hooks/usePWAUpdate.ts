import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Handles PWA service worker lifecycle:
 * - Detects when a new version is ready
 * - Exposes `updateServiceWorker` to trigger the update
 * - Returns `needRefresh` so the UI can prompt the user
 */
export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log("[PWA] Service Worker registered:", registration);
    },
    onRegisterError(error) {
      console.error("[PWA] Service Worker registration failed:", error);
    },
  });

  const acceptUpdate = () => {
    updateServiceWorker(true);
    setNeedRefresh(false);
  };

  const dismissUpdate = () => {
    setNeedRefresh(false);
  };

  return { needRefresh, acceptUpdate, dismissUpdate };
}
