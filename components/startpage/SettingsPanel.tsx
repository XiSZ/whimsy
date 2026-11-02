"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { FaCog, FaImage } from "react-icons/fa";
import clsx from "clsx";
import { DEFAULT_BACKGROUND } from "@/components/background/useGrainient";
import {
  saveBackgroundFile,
  useBackgroundFile,
} from "@/components/background/backgroundFile";
import {
  useAppSettings,
  type AppSettings,
  type BookmarkLayout,
} from "./settings";

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

type BackgroundMode = AppSettings["backgroundMode"];
const BACKGROUND_MODES: { value: BackgroundMode; label: string }[] = [
  { value: "gradient", label: "Gradient" },
  { value: "custom", label: "Custom" },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-md border border-[#2d2d2d]/70 p-0.5 text-[11px]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "cursor-pointer rounded px-2 py-0.5 transition-colors",
            value === option.value
              ? "bg-paradise-300/20 text-paradise-200"
              : "text-paradise-200/60 hover:text-paradise-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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
  showLabel = true,
}: {
  id: string;
  label: string;
  value: string | null;
  presets: string[];
  onChange: (color: string | null) => void;
  showLabel?: boolean;
}) {
  const current = (value ?? presets[0]).toLowerCase();
  const isCustom = !presets.some((color) => color.toLowerCase() === current);
  const ring = "ring-2 ring-paradise-100/80 ring-offset-2 ring-offset-[#161616]";

  return (
    <div className="grid gap-1.5">
      {showLabel ? (
        <span className="text-sm text-paradise-100/85">{label}</span>
      ) : null}
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
  const backgroundFile = useBackgroundFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // "Custom" without a stored file opens the picker; the mode only switches
  // once a file has been saved, so cancelling keeps the gradient.
  const chooseBackgroundMode = (mode: BackgroundMode) => {
    if (mode === "custom" && !backgroundFile) fileInputRef.current?.click();
    else update({ backgroundMode: mode });
  };

  const onFilePicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same file again still fires
    if (!file) return;
    setFileError(null);
    try {
      await saveBackgroundFile(file);
      update({ backgroundMode: "custom" });
    } catch {
      setFileError("Couldn't store that file. It may be too large.");
    }
  };

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
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm text-paradise-100/85">
                Background
                <Segmented
                  label="Background type"
                  value={settings.backgroundMode}
                  options={BACKGROUND_MODES}
                  onChange={chooseBackgroundMode}
                />
              </div>
              {settings.backgroundMode === "gradient" ? (
                <ColorRow
                  id="background-color"
                  label="Background"
                  showLabel={false}
                  value={settings.backgroundColor}
                  presets={BACKGROUND_PRESETS}
                  onChange={(color) => update({ backgroundColor: color })}
                />
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Choose another image or video"
                  className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-1 text-left text-xs text-paradise-100/85 transition-colors hover:bg-black/30"
                >
                  <FaImage className="shrink-0 text-paradise-300" />
                  <span className="truncate">
                    {backgroundFile?.name ?? "Choose image or video…"}
                  </span>
                </button>
              )}
              {fileError ? (
                <div className="text-[11px] text-paradise-red">{fileError}</div>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                aria-label="Background image or video"
                className="hidden"
                onChange={onFilePicked}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm text-paradise-100/85">
              Bookmarks
              <Segmented
                label="Bookmark layout"
                value={settings.bookmarkLayout}
                options={LAYOUT_OPTIONS}
                onChange={(layout) => update({ bookmarkLayout: layout })}
              />
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
