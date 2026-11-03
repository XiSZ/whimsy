"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { FaCog, FaImage } from "react-icons/fa";
import clsx from "clsx";
import { DEFAULT_BACKGROUND } from "@/components/background/useGrainient";
import {
  saveBackgroundFile,
  useBackgroundFile,
  useObjectUrl,
} from "@/components/background/backgroundFile";
import {
  useAppSettings,
  type AppSettings,
  type BookmarkLayout,
  type WidgetKey,
} from "./settings";
import { locatePlace } from "./WeatherWidget";
import { categories, groupKey } from "./Bookmarks";

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

const WIDGETS: { key: WidgetKey; label: string }[] = [
  { key: "twitch", label: "Twitch" },
  { key: "weather", label: "Weather" },
  { key: "todo", label: "To-do" },
  { key: "progress", label: "Progress bars" },
];

const DEFAULT_FOCUS = "50% 50%";
const FOCUS_STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-5, 0],
  ArrowRight: [5, 0],
  ArrowUp: [0, -5],
  ArrowDown: [0, 5],
};
const clampPercent = (n: number) => Math.round(Math.min(100, Math.max(0, n)));

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

// Thumbnail of the custom background: clicking or dragging on it (or the
// arrow keys) sets the point that stays in view when it is cropped.
function FocusPicker({
  file,
  value,
  onChange,
}: {
  file: File;
  value: string;
  onChange: (position: string) => void;
}) {
  const url = useObjectUrl(file);
  const [x, y] = value.split(" ").map(parseFloat);
  const set = (nextX: number, nextY: number) =>
    onChange(`${clampPercent(nextX)}% ${clampPercent(nextY)}%`);

  const pick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    set(
      ((event.clientX - box.left) / box.width) * 100,
      ((event.clientY - box.top) / box.height) * 100,
    );
  };

  const nudge = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = FOCUS_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    set(x + step[0], y + step[1]);
  };

  if (!url) return null;
  const media = "pointer-events-none block max-h-32 max-w-full select-none";
  return (
    <div
      role="group"
      tabIndex={0}
      title="Click or drag to choose the part that stays visible"
      aria-label={`Background focus point: ${x}% from left, ${y}% from top. Arrow keys move it.`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pick(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons) pick(event);
      }}
      onKeyDown={nudge}
      className="relative mx-auto w-fit max-w-full cursor-crosshair touch-none overflow-hidden rounded-md border border-[#2d2d2d]/80 outline-none focus-visible:ring-2 focus-visible:ring-paradise-300"
    >
      {file.type.startsWith("video/") ? (
        <video src={url} muted playsInline preload="metadata" className={media} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={media} />
      )}
      <span
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-paradise-300 shadow"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
    </div>
  );
}

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [settings, update] = useAppSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const backgroundFile = useBackgroundFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Turning it on asks for the location right away (the browser prompts on
  // this click); the switch only flips once a place was found.
  const toggleWeatherLocation = async (on: boolean) => {
    setLocationError(null);
    if (!on) return update({ weatherPlace: null });
    try {
      update({ weatherPlace: await locatePlace() });
    } catch {
      setLocationError("Couldn't get your location. Check the site permission.");
    }
  };

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
      update({ backgroundMode: "custom", backgroundPosition: DEFAULT_FOCUS });
    } catch {
      setFileError("Couldn't store that file. It may be too large.");
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="fixed bottom-4 left-4 z-20">
      {open && (
        <div className="twitch-scroll mb-2 grid max-h-[calc(100vh-5rem)] w-64 gap-2.5 overflow-y-auto rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3.5 py-3 shadow-2xl backdrop-blur-lg backdrop-saturate-150 animate-stagger-in">
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
              {settings.backgroundMode === "custom" && backgroundFile ? (
                <FocusPicker
                  file={backgroundFile}
                  value={settings.backgroundPosition}
                  onChange={(position) =>
                    update({ backgroundPosition: position })
                  }
                />
              ) : null}
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
            <label className="flex items-center justify-between gap-3 text-sm text-paradise-100/85">
              Glass blur
              <input
                type="range"
                min={0}
                max={32}
                step={2}
                value={settings.glassBlur}
                onChange={(event) =>
                  update({ glassBlur: Number(event.target.value) })
                }
                className="w-28 cursor-pointer accent-paradise-300"
              />
            </label>
          </Section>

          <Section title="Bookmark colors">
            <div className="grid grid-cols-[repeat(3,auto)] justify-between gap-x-2 gap-y-1.5">
              {categories.map(({ title, color }) => {
                const key = groupKey(title);
                const value = settings.groupColors[key] ?? color;
                return (
                  <label
                    key={key}
                    className="flex min-w-0 cursor-pointer items-center gap-1.5 text-xs text-paradise-100/85"
                  >
                    <span
                      style={{ backgroundColor: value }}
                      className="relative h-4 w-4 shrink-0 rounded-full border border-white/15 transition-transform hover:scale-110"
                    >
                      <input
                        type="color"
                        aria-label={`${title} color`}
                        value={value}
                        onChange={(event) =>
                          update({
                            groupColors: {
                              ...settings.groupColors,
                              [key]: event.target.value,
                            },
                          })
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </span>
                    <span className="truncate">{title}</span>
                  </label>
                );
              })}
            </div>
            {Object.keys(settings.groupColors).length > 0 ? (
              <button
                onClick={() => update({ groupColors: {} })}
                className="cursor-pointer justify-self-start text-[11px] text-paradise-200/60 transition-colors hover:text-paradise-200"
              >
                Reset to defaults
              </button>
            ) : null}
          </Section>

          <Section title="Widgets">
            {WIDGETS.map(({ key, label }) => (
              <SwitchRow
                key={key}
                label={label}
                checked={!settings.hiddenWidgets.includes(key)}
                onChange={(checked) =>
                  update({
                    hiddenWidgets: checked
                      ? settings.hiddenWidgets.filter((hidden) => hidden !== key)
                      : [...settings.hiddenWidgets, key],
                  })
                }
              />
            ))}
            <SwitchRow
              label="Weather at my location"
              checked={settings.weatherPlace !== null}
              onChange={toggleWeatherLocation}
            />
            {locationError ? (
              <div className="text-[11px] text-paradise-red">{locationError}</div>
            ) : null}
          </Section>
        </div>
      )}

      <button
        ref={toggleRef}
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
