"use client";

import { useEffect, useRef, useState } from "react";
import { FaCog } from "react-icons/fa";
import { useAppSettings } from "./settings";

// Shown in the picker while no custom accent is set (the progress-bar orange).
const DEFAULT_ACCENT = "#ff9b3f";

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [settings, update] = useAppSettings();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="fixed bottom-4 left-4 z-20">
      {open && (
        <div className="mb-2 w-60 rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3 py-2 backdrop-blur-lg backdrop-saturate-150">
          <div className="text-[11px] uppercase tracking-wide text-paradise-200/75">
            Settings
          </div>
          <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 text-sm text-paradise-100/85">
            Open search in new tab
            <input
              type="checkbox"
              checked={settings.openInNewTab}
              onChange={(event) =>
                update({ openInNewTab: event.target.checked })
              }
              className="accent-paradise-300"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-2 text-sm text-paradise-100/85">
            <label htmlFor="accent-color" className="cursor-pointer">
              Accent color
            </label>
            <div className="flex items-center gap-2">
              {settings.accentColor && (
                <button
                  onClick={() => update({ accentColor: null })}
                  className="text-[11px] text-paradise-200/60 transition-colors hover:text-paradise-200 cursor-pointer"
                >
                  Reset
                </button>
              )}
              <input
                id="accent-color"
                type="color"
                value={settings.accentColor ?? DEFAULT_ACCENT}
                onChange={(event) =>
                  update({ accentColor: event.target.value })
                }
                className="h-6 w-8 cursor-pointer rounded border border-[#2d2d2d]/70 bg-transparent"
              />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
        className="rounded-lg border border-[#2d2d2d]/70 bg-[#161616]/62 p-2 text-paradise-200/70 backdrop-blur-lg backdrop-saturate-150 transition-colors hover:text-paradise-200 cursor-pointer"
      >
        <FaCog />
      </button>
    </div>
  );
}
