"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

const STORAGE_KEY = "captar-suite-splash-seen";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(STORAGE_KEY) === "1";
    if (alreadySeen) {
      const hideTimer = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(hideTimer);
    }

    const outTimer = window.setTimeout(() => setFadeOut(true), 1300);
    const closeTimer = window.setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, 1750);

    return () => {
      window.clearTimeout(outTimer);
      window.clearTimeout(closeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`splash-screen ${fadeOut ? "splash-fade" : ""}`}>
      <BrandLogo />
      <p className="mt-3 text-sm tracking-[0.22em] text-[var(--ink-soft)]">CARREGANDO CAPTAR SUÍTE</p>
    </div>
  );
}

