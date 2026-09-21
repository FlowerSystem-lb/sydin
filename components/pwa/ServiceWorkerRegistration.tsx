"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js once the page is idle. Production only: in dev a
 * worker would sit between Turbopack and the browser for no reason.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Not installable here (private mode, old browser). The site works
           exactly as before; only the offline page is missing. */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
