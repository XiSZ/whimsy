"use client";

import { useEffect } from "react";
import {
  applyAccentColor,
  applyBookmarkLayout,
  useAppSettings,
} from "./settings";

// Re-applies the saved accent (and bookmark layout) once React owns the page. The inline script in
// the root layout sets it before first paint, but if hydration ever fails
// React re-renders <html> from scratch and drops those attributes.
export default function AccentSync() {
  const [settings, , loaded] = useAppSettings();

  useEffect(() => {
    if (loaded) applyAccentColor(settings.accentColor);
  }, [loaded, settings.accentColor]);

  useEffect(() => {
    if (loaded) applyBookmarkLayout(settings.bookmarkLayout);
  }, [loaded, settings.bookmarkLayout]);

  return null;
}
