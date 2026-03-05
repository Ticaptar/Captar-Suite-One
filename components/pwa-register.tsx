"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onLoad = async () => {
      // Em desenvolvimento, remove SW/caches para evitar layout antigo.
      if (process.env.NODE_ENV !== "production") {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        } catch {
          // no-op
        }
        return;
      }

      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
