"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (PWA install + offline fallback).
 *
 * PRODUCTION ONLY, deliberately: in dev, Next's asset URLs aren't the stable
 * hashed ones the worker assumes, and a lingering worker fights HMR. Verify
 * locally with `npm run build && npm start`, never `npm run dev`.
 *
 * Registration waits for `load` so it never competes with the first paint, and
 * every failure is swallowed — a broken worker must not break the page.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
