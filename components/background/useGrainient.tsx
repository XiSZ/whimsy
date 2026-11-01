"use client";
import dynamic from "next/dynamic";
import { useAppSettings } from "@/components/startpage/settings";

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

export default function GrainientLoader() {
  const [settings] = useAppSettings();
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
