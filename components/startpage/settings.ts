"use client";

import { useEffect, useState } from "react";

export interface AppSettings {
  openInNewTab: boolean;
}

const SETTINGS_KEY = "whimsy-settings";
const SETTINGS_EVENT = "whimsy-settings-changed";
const DEFAULTS: AppSettings = { openInNewTab: false };

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

// localStorage-backed settings shared across components; a window event
// keeps every subscriber in sync within the same tab.
export function useAppSettings(): [
  AppSettings,
  (patch: Partial<AppSettings>) => void,
] {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    setSettings(readSettings());
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
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  };

  return [settings, update];
}
