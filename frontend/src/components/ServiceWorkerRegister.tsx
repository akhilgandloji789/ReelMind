"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("ReelMind Service Worker registered with scope:", registration.scope);
            // Proactively check for new service worker version
            registration.update().catch(() => {});
          })
          .catch((error) => {
            console.warn("ReelMind Service Worker registration failed:", error);
          });
      });
    }
  }, []);

  return null;
}
