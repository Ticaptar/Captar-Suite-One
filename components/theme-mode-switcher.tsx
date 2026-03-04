"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "clean" | "dark";

const STORAGE_KEY = "captar-suite:theme-mode";
const COOKIE_KEY = "captar-suite:theme-mode";

function applyTheme(mode: ThemeMode) {
  document.body.classList.remove("theme-clean", "theme-dark", "theme-escuro");
  document.body.classList.add(mode === "dark" ? "theme-dark" : "theme-clean");
}

function persistTheme(mode: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, mode);
  document.cookie = `${COOKIE_KEY}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeModeSwitcher({ initialMode }: { initialMode: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    applyTheme(mode);
    persistTheme(mode);
  }, [mode]);

  return (
    <div className="theme-switcher" role="group" aria-label="Modo de aparencia">
      <button
        type="button"
        className={`theme-switch-btn ${mode === "clean" ? "active" : ""}`}
        onClick={() => setMode("clean")}
      >
        Clean
      </button>
      <button
        type="button"
        className={`theme-switch-btn ${mode === "dark" ? "active" : ""}`}
        onClick={() => setMode("dark")}
      >
        Dark
      </button>
    </div>
  );
}
