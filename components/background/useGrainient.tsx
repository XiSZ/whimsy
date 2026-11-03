"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAppSettings } from "@/components/startpage/settings";
import { useBackgroundFile, useObjectUrl } from "./backgroundFile";

const GrainientComponent = dynamic(() => import("./Grainient"), {
  ssr: false,
});

export const DEFAULT_BACKGROUND = "#4D5F87";

// Scales a hex color's channels toward black (factor 0–1).
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `#${[16, 8, 0]
    .map((bits) =>
      Math.round(((n >> bits) & 255) * factor)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// The user's own wallpaper: an image, or a muted looping video (paused on its
// first frame under reduced motion), cropped around `position`.
function CustomBackground({ file, position }: { file: File; position: string }) {
  const url = useObjectUrl(file);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (!url) return null;
  const className = "fixed inset-0 -z-20 h-full w-full object-cover";
  const style = { objectPosition: position };
  return file.type.startsWith("video/") ? (
    <video
      key={url}
      src={url}
      className={className}
      style={style}
      autoPlay={!still}
      muted
      loop
      playsInline
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={className} style={style} />
  );
}

export default function GrainientLoader() {
  const [settings] = useAppSettings();
  const file = useBackgroundFile();
  if (settings.backgroundMode === "custom" && file) {
    return (
      <CustomBackground file={file} position={settings.backgroundPosition} />
    );
  }

  const base = settings.backgroundColor;

  // The default palette is roughly base, base×0.5 and base×0.13, so a picked
  // color keeps the same light-to-dark depth.
  const [color1, color2, color3] = base
    ? [base, shade(base, 0.5), shade(base, 0.13)]
    : [DEFAULT_BACKGROUND, "#262B41", "#0A0C16"];

  return (
    <GrainientComponent
      className="fixed inset-0 -z-20"
      color1={color1}
      color2={color2}
      color3={color3}
    />
  );
}
