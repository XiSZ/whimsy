"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FaCog } from "react-icons/fa";
import clsx from "clsx";
import { DEFAULT_BACKGROUND } from "@/components/background/useGrainient";
import { useAppSettings, type BookmarkLayout } from "./settings";

// Shown while no custom accent is set (the progress-bar orange).
const DEFAULT_ACCENT = "#ff9b3f";

// The first preset is the default: picking it clears the override.
const ACCENT_PRESETS = [DEFAULT_ACCENT, "#7dd3fc", "#86efac", "#f9a8d4", "#c4b5fd"];
const BACKGROUND_PRESETS = [
  DEFAULT_BACKGROUND,
  "#5b6472",
  "#6b4d87",
  "#4d7a5f",
  "#874d5a",
];

const LAYOUT_OPTIONS: { value: BookmarkLayout; label: string }[] = [
  { value: "tiles", label: "Tiles" },
  { value: "strips", label: "Strips" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-[#2d2d2d]/70 pt-2.5 first:border-t-0 first:pt-0">
      <div className="text-[10px] uppercase tracking-wider text-paradise-200/50">
        {title}
      </div>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm text-paradise-100/85">
      {label}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors",
          checked
            ? "border-paradise-300/60 bg-paradise-300/70"
            : "border-[#2d2d2d]/80 bg-black/30",
        )}
      >
        <span
          className={clsx(
            "absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-paradise-100 shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </button>
    </label>
  );
}

// Preset dots plus a rainbow dot that opens the native picker. `value` null
// means the default (first preset).
function ColorRow({
  id,
  label,
  value,
  presets,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  presets: string[];
  onChange: (color: string | null) => void;
}) {
  const current = (value ?? presets[0]).toLowerCase();
  const isCustom = !presets.some((color) => color.toLowerCase() === current);
  const ring = "ring-2 ring-paradise-100/80 ring-offset-2 ring-offset-[#161616]";

  return (
    <div className="grid gap-1.5">
      <span className="text-sm text-paradise-100/85">{label}</span>
      <div className="flex items-center gap-2">
        {presets.map((color, i) => (
          <button
            key={color}
            title={i === 0 ? "Default" : color}
            aria-label={`${label}: ${i === 0 ? "default" : color}`}
            aria-pressed={current === color.toLowerCase()}
            onClick={() => onChange(i === 0 ? null : color)}
            style={{ backgroundColor: color }}
            className={clsx(
              "h-5 w-5 cursor-pointer rounded-full border border-white/15 transition-transform hover:scale-110",
              current === color.toLowerCase() && ring,
            )}
          />
        ))}
        <label
          htmlFor={id}
          title="Custom color"
          style={{
            background: isCustom
              ? current
              : "conic-gradient(#f87171, #facc15, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)",
          }}
          className={clsx(
            "relative ml-auto h-5 w-5 cursor-pointer rounded-full border border-white/15 transition-transform hover:scale-110",
            isCustom && ring,
          )}
        >
          <input
            id={id}
            type="color"
            aria-label={`${label}: custom`}
            value={current}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

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
        <div className="mb-2 grid w-64 gap-2.5 rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3.5 py-3 shadow-2xl backdrop-blur-lg backdrop-saturate-150 animate-stagger-in">
          <Section title="Open in new tab">
            <SwitchRow
              label="Search results"
              checked={settings.openInNewTab}
              onChange={(checked) => update({ openInNewTab: checked })}
            />
            <SwitchRow
              label="Twitch links"
              checked={settings.twitchNewTab}
              onChange={(checked) => update({ twitchNewTab: checked })}
            />
          </Section>

          <Section title="Appearance">
            <ColorRow
              id="accent-color"
              label="Accent"
              value={settings.accentColor}
              presets={ACCENT_PRESETS}
              onChange={(color) => update({ accentColor: color })}
            />
            <ColorRow
              id="background-color"
              label="Background"
              value={settings.backgroundColor}
              presets={BACKGROUND_PRESETS}
              onChange={(color) => update({ backgroundColor: color })}
            />
            <div className="flex items-center justify-between gap-2 text-sm text-paradise-100/85">
              Bookmarks
              <div
                role="radiogroup"
                aria-label="Bookmark layout"
                className="flex rounded-md border border-[#2d2d2d]/70 p-0.5 text-[11px]"
              >
                {LAYOUT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    role="radio"
                    aria-checked={settings.bookmarkLayout === option.value}
                    onClick={() => update({ bookmarkLayout: option.value })}
                    className={clsx(
                      "cursor-pointer rounded px-2 py-0.5 transition-colors",
                      settings.bookmarkLayout === option.value
                        ? "bg-paradise-300/20 text-paradise-200"
                        : "text-paradise-200/60 hover:text-paradise-200",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
        className="rounded-lg border border-[#2d2d2d]/70 bg-[#161616]/62 p-2 text-paradise-200/70 backdrop-blur-lg backdrop-saturate-150 transition-colors hover:text-paradise-200 cursor-pointer"
      >
        <FaCog className={clsx("transition-transform duration-300", open && "rotate-90")} />
      </button>
    </div>
  );
}
