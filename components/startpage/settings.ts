"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

export type BookmarkLayout = "tiles" | "strips";
export type WidgetKey = "twitch" | "weather" | "todo" | "progress";

export interface WeatherPlace {
  lat: number;
  lon: number;
  label: string;
}

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
  // CSS object-position of the custom background: the point kept in view
  // when it is cropped to the screen.
  backgroundPosition: string;
  bookmarkLayout: BookmarkLayout;
  hiddenWidgets: WidgetKey[];
  // Backdrop blur of the glass panels, in px.
  glassBlur: number;
  // Last place found for "Weather at my location"; null uses the configured
  // city (NEXT_PUBLIC_WEATHER_*).
  weatherPlace: WeatherPlace | null;
}

const SETTINGS_KEY = "whimsy-settings";
const SETTINGS_EVENT = "whimsy-settings-changed";
const DEFAULTS: AppSettings = {
  openInNewTab: false,
  twitchNewTab: true,
  accentColor: null,
  backgroundColor: null,
  backgroundMode: "gradient",
  backgroundPosition: "50% 50%",
  bookmarkLayout: "tiles",
  hiddenWidgets: [],
  glassBlur: 16,
  weatherPlace: null,
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

// Every glass panel uses Tailwind's `backdrop-blur-lg`, which reads the
// `--blur-lg` theme variable (mirrored by the same inline script).
export function applyGlassBlur(px: number) {
  document.documentElement.style.setProperty("--blur-lg", `${px}px`);
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

  // Stable (it reads storage, not state), so effects can depend on it.
  const update = useCallback((patch: Partial<AppSettings>) => {
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
    if (patch.glassBlur !== undefined) applyGlassBlur(patch.glassBlur);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);

  return [settings, update, loaded];
}

// Renders a widget unless it is switched off in Settings → Widgets. Renders
// nothing until the settings are read, so a hidden widget never mounts (and
// never polls its API).
export function ShowWidget({
  name,
  children,
}: {
  name: WidgetKey;
  children: ReactNode;
}) {
  const [settings, , loaded] = useAppSettings();
  return loaded && !settings.hiddenWidgets.includes(name) ? children : null;
}

// Spread onto twitch.tv anchors: new tab or same tab per the setting.
export function useTwitchLinkProps(): { target?: string; rel?: string } {
  const [settings] = useAppSettings();
  return settings.twitchNewTab ? { target: "_blank", rel: "noreferrer" } : {};
}
