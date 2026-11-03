"use client";

import { useEffect } from "react";
import {
  applyAccentColor,
  applyBookmarkLayout,
  applyGlassBlur,
  useAppSettings,
} from "./settings";

// Re-applies the saved accent (plus bookmark layout and glass blur) once React
// owns the page. The inline script in the root layout sets them before first
// paint, but if hydration ever fails React re-renders <html> from scratch and
// drops those attributes.
export default function AccentSync() {
  const [settings, , loaded] = useAppSettings();

  useEffect(() => {
    if (loaded) applyAccentColor(settings.accentColor);
  }, [loaded, settings.accentColor]);

  useEffect(() => {
    if (loaded) applyBookmarkLayout(settings.bookmarkLayout);
  }, [loaded, settings.bookmarkLayout]);

  useEffect(() => {
    if (loaded) applyGlassBlur(settings.glassBlur);
  }, [loaded, settings.glassBlur]);

  return null;
}
