"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { preloadPnCatalog } from "@/lib/pn-catalog-client";

const STORAGE_KEY = "captar-suite-splash-seen";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [label, setLabel] = useState("CARREGANDO CAPTAR SUÍTE");

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(STORAGE_KEY) === "1";
    if (alreadySeen) {
      preloadPnCatalog(false).catch(() => undefined);
      const hideTimer = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(hideTimer);
    }

    let mounted = true;
    const minDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1100);
    });

    const preload = preloadPnCatalog(false)
      .then((items) => {
        if (!mounted) return;
        const total = new Intl.NumberFormat("pt-BR").format(items.length);
        setLabel(`CATÁLOGO PN PRONTO (${total})`);
      })
      .catch(() => undefined);

    Promise.all([minDelay, preload]).then(() => {
      if (!mounted) return;
      setFadeOut(true);
      window.setTimeout(() => {
        if (!mounted) return;
        setVisible(false);
        sessionStorage.setItem(STORAGE_KEY, "1");
      }, 320);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`splash-screen ${fadeOut ? "splash-fade" : ""}`}>
      <BrandLogo />
      <p className="mt-3 text-sm tracking-[0.22em] text-[var(--ink-soft)]">{label}</p>
    </div>
  );
}

