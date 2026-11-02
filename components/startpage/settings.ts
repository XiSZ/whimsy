"use client";

import { useEffect, useState } from "react";

export type BookmarkLayout = "tiles" | "strips";

export interface AppSettings {
  openInNewTab: boolean;
  // Twitch channel links (widget + /twitch page) open in a new tab.
  twitchNewTab: boolean;
  // Hex color overriding the default accent; null keeps the built-in palette.
  accentColor: string | null;
  // Hex base for the animated background; null keeps the default navy.
  backgroundColor: string | null;
  // "custom" shows the user's own image/video (kept in IndexedDB, see
  // components/background/backgroundFile.ts) instead of the gradient.
  backgroundMode: "gradient" | "custom";
  bookmarkLayout: BookmarkLayout;
}

const SETTINGS_KEY = "whimsy-settings";
const SETTINGS_EVENT = "whimsy-settings-changed";
const DEFAULTS: AppSettings = {
  openInNewTab: false,
  twitchNewTab: true,
  accentColor: null,
  backgroundColor: null,
  backgroundMode: "gradient",
  bookmarkLayout: "tiles",
};

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

// Sets `data-bookmarks` on <html>; the bookmarks switch layouts purely via CSS
// so the stored choice applies before hydration (mirrored by the same inline
// script as the accent).
export function applyBookmarkLayout(layout: BookmarkLayout) {
  document.documentElement.dataset.bookmarks = layout;
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
    if (patch.bookmarkLayout) applyBookmarkLayout(patch.bookmarkLayout);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  };

  return [settings, update, loaded];
}

// Spread onto twitch.tv anchors: new tab or same tab per the setting.
export function useTwitchLinkProps(): { target?: string; rel?: string } {
  const [settings] = useAppSettings();
  return settings.twitchNewTab ? { target: "_blank", rel: "noreferrer" } : {};
}
