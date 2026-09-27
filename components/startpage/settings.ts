"use client";

import { useEffect, useState } from "react";

export interface AppSettings {
  openInNewTab: boolean;
  // Hex color overriding the default accent; null keeps the built-in palette.
  accentColor: string | null;
}

const SETTINGS_KEY = "whimsy-settings";
const SETTINGS_EVENT = "whimsy-settings-changed";
const DEFAULTS: AppSettings = { openInNewTab: false, accentColor: null };

function readSettings(): AppSettings {
  try {
    return {
      ...DEFAULTS,
      ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<
        AppSettings
      >),
    };
  } catch {
    return DEFAULTS;
  }
}

// Applies the accent to <html>; mirrored by the inline script in the root
// layout, which does the same before first paint to avoid a color flash.
export function applyAccentColor(color: string | null) {
  const root = document.documentElement;
  if (color) {
    root.style.setProperty("--accent", color);
    root.dataset.accent = "";
  } else {
    root.style.removeProperty("--accent");
    delete root.dataset.accent;
  }
}

// localStorage-backed settings shared across components; a window event
// keeps every subscriber in sync within the same tab. `loaded` turns true once
// the stored values have been read (the first render always sees DEFAULTS).
export function useAppSettings(): [
  AppSettings,
  (patch: Partial<AppSettings>) => void,
  boolean,
] {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setLoaded(true);
    const sync = () => setSettings(readSettings());
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  const update = (patch: Partial<AppSettings>) => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ ...readSettings(), ...patch }),
      );
    } catch {
      // Storage unavailable — the change won't persist.
    }
    if (patch.accentColor !== undefined) applyAccentColor(patch.accentColor);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  };

  return [settings, update, loaded];
}
