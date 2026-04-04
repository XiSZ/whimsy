"use client";

import { useEffect, useMemo, useState } from "react";

interface WeatherData {
  temperature: number;
  weatherCode: number;
  tempMin: number;
  tempMax: number;
}

function weatherCodeToLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Storm";
  return "Weather";
}

function weatherCodeToIcon(code: number): string {
  if (code === 0) return "sun";
  if (code <= 3) return "cloud";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 99) return "storm";
  return "cloud";
}

const WEATHER_COORDS = {
  lat: Number(process.env.NEXT_PUBLIC_WEATHER_LAT),
  lon: Number(process.env.NEXT_PUBLIC_WEATHER_LON),
};

const WEATHER_LABEL = process.env.NEXT_PUBLIC_WEATHER_LABEL;

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [hasError, setHasError] = useState(false);

  const hasValidConfig =
    Number.isFinite(WEATHER_COORDS.lat) &&
    Number.isFinite(WEATHER_COORDS.lon) &&
    Boolean(WEATHER_LABEL);

  const endpoint = useMemo(
    () =>
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_COORDS.lat}&longitude=${WEATHER_COORDS.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
    [],
  );

  useEffect(() => {
    if (!hasValidConfig) return;

    let cancelled = false;

    const update = async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load weather");

        const data = await response.json();
        if (cancelled) return;

        setWeather({
          temperature: Number(data?.current?.temperature_2m ?? 0),
          weatherCode: Number(data?.current?.weather_code ?? 0),
          tempMin: Number(data?.daily?.temperature_2m_min?.[0] ?? 0),
          tempMax: Number(data?.daily?.temperature_2m_max?.[0] ?? 0),
        });
        setHasError(false);
      } catch {
        if (!cancelled) setHasError(true);
      }
    };

    update();
    const interval = setInterval(update, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [endpoint, hasValidConfig]);

  if (!hasValidConfig || hasError || !weather) return null;

  const weatherLabel = weatherCodeToLabel(weather.weatherCode);
  const weatherIcon = weatherCodeToIcon(weather.weatherCode);

  return (
    <div className="fixed top-4 right-4 z-20 w-[220px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#424242]/50 bg-[#1E1E1E]/45 px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]">
      <div className="text-[11px] uppercase tracking-wide text-paradise-200/75">
        {WEATHER_LABEL}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <div className="text-sm text-paradise-100">{weatherLabel}</div>
        <div className="text-xs text-paradise-200/90">{weatherIcon}</div>
      </div>
      <div className="mt-1 flex items-end justify-between">
        <div className="text-xl font-semibold text-paradise-100">
          {Math.round(weather.temperature)}C
        </div>
        <div className="text-[11px] tabular-nums text-paradise-200/80">
          {Math.round(weather.tempMin)}C / {Math.round(weather.tempMax)}C
        </div>
      </div>
    </div>
  );
}
