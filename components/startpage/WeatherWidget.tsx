"use client";

import { useEffect, useMemo, useState } from "react";
import type { IconType } from "react-icons/lib";
import {
  WiCloud,
  WiDaySunny,
  WiFog,
  WiRain,
  WiSnow,
  WiThunderstorm,
} from "react-icons/wi";

interface ForecastDay {
  date: string;
  weatherCode: number;
  tempMin: number;
  tempMax: number;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  tempMin: number;
  tempMax: number;
  forecast: ForecastDay[];
}

interface WeatherPresentation {
  label: string;
  description: string;
  Icon: IconType;
  accentClassName: string;
}

function weatherCodeToPresentation(code: number): WeatherPresentation {
  if (code === 0) {
    return {
      label: "Clear",
      description: "Bright, open skies with strong visibility",
      Icon: WiDaySunny,
      accentClassName: "text-amber-200",
    };
  }

  if (code === 1) {
    return {
      label: "Mostly clear",
      description: "Mostly sunny with a few passing clouds",
      Icon: WiDaySunny,
      accentClassName: "text-amber-200",
    };
  }

  if (code <= 3) {
    return {
      label: "Cloudy",
      description: "Grey, overcast conditions",
      Icon: WiCloud,
      accentClassName: "text-slate-200",
    };
  }

  if (code <= 48) {
    return {
      label: "Fog",
      description: "Hazy air and reduced visibility",
      Icon: WiFog,
      accentClassName: "text-slate-300",
    };
  }

  if (code <= 67) {
    return {
      label: "Rain",
      description: "Steady rain is likely through the day",
      Icon: WiRain,
      accentClassName: "text-sky-200",
    };
  }

  if (code <= 77) {
    return {
      label: "Snow",
      description: "Cold, wintry conditions with snowfall",
      Icon: WiSnow,
      accentClassName: "text-cyan-100",
    };
  }

  if (code <= 82) {
    return {
      label: "Showers",
      description: "Short, scattered bursts of rain",
      Icon: WiRain,
      accentClassName: "text-sky-200",
    };
  }

  if (code <= 99) {
    return {
      label: "Storm",
      description: "Thunderstorms and heavier weather activity",
      Icon: WiThunderstorm,
      accentClassName: "text-violet-200",
    };
  }

  return {
    label: "Weather",
    description: "Current conditions at a glance",
    Icon: WiCloud,
    accentClassName: "text-paradise-200",
  };
}

function formatWeekday(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
  });
}

const WEATHER_COORDS = {
  lat: Number(process.env.NEXT_PUBLIC_WEATHER_LAT),
  lon: Number(process.env.NEXT_PUBLIC_WEATHER_LON),
};

const WEATHER_LABEL = process.env.NEXT_PUBLIC_WEATHER_LABEL;
const WEATHER_REFRESH_MINUTES = Number(
  process.env.NEXT_PUBLIC_WEATHER_REFRESH_MINUTES,
);

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [hasError, setHasError] = useState(false);
  const [view, setView] = useState<"daily" | "three-day">("daily");

  const hasValidConfig =
    Number.isFinite(WEATHER_COORDS.lat) &&
    Number.isFinite(WEATHER_COORDS.lon) &&
    Boolean(WEATHER_LABEL);

  const refreshIntervalMs =
    Number.isFinite(WEATHER_REFRESH_MINUTES) && WEATHER_REFRESH_MINUTES >= 10
      ? WEATHER_REFRESH_MINUTES * 60 * 1000
      : 30 * 60 * 1000;

  const endpoint = useMemo(
    () =>
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_COORDS.lat}&longitude=${WEATHER_COORDS.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,
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

        const dates = Array.isArray(data?.daily?.time) ? data.daily.time : [];
        const codes = Array.isArray(data?.daily?.weather_code)
          ? data.daily.weather_code
          : [];
        const mins = Array.isArray(data?.daily?.temperature_2m_min)
          ? data.daily.temperature_2m_min
          : [];
        const maxs = Array.isArray(data?.daily?.temperature_2m_max)
          ? data.daily.temperature_2m_max
          : [];

        const forecast: ForecastDay[] = dates
          .slice(0, 3)
          .map((date: string, index: number) => ({
            date,
            weatherCode: Number(codes[index] ?? 0),
            tempMin: Number(mins[index] ?? 0),
            tempMax: Number(maxs[index] ?? 0),
          }));

        setWeather({
          temperature: Number(data?.current?.temperature_2m ?? 0),
          weatherCode: Number(data?.current?.weather_code ?? 0),
          tempMin: Number(forecast[0]?.tempMin ?? 0),
          tempMax: Number(forecast[0]?.tempMax ?? 0),
          forecast,
        });
        setHasError(false);
      } catch {
        if (!cancelled) setHasError(true);
      }
    };

    update();
    const interval = setInterval(update, refreshIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [endpoint, hasValidConfig, refreshIntervalMs]);

  useEffect(() => {
    if (!weather) return;

    const rotation = setInterval(() => {
      setView((current) => (current === "daily" ? "three-day" : "daily"));
    }, 30_000);

    return () => clearInterval(rotation);
  }, [weather]);

  if (!hasValidConfig || hasError || !weather) return null;

  const currentWeather = weatherCodeToPresentation(weather.weatherCode);

  return (
    <div className="fixed top-4 right-4 z-20 w-[240px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-paradise-200/75">
          {WEATHER_LABEL}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-paradise-100/70">
          {view === "daily" ? "Daily forecast" : "3-day forecast"}
        </div>
      </div>

      {view === "daily" ? (
        <>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-paradise-100">
                {currentWeather.label}
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-paradise-200/70">
                {currentWeather.description}
              </div>
            </div>
            <currentWeather.Icon
              className={`mt-0.5 shrink-0 text-2xl ${currentWeather.accentClassName}`}
            />
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div className="text-xl font-semibold text-paradise-100">
              {Math.round(weather.temperature)}°C
            </div>
            <div className="text-[11px] tabular-nums text-paradise-200/80">
              {Math.round(weather.tempMin)}°C | {Math.round(weather.tempMax)}°C
            </div>
          </div>
        </>
      ) : (
        <div className="mt-2 grid gap-1">
          {weather.forecast.map((day) => (
            <ForecastRow key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}

function ForecastRow({ day }: { day: ForecastDay }) {
  const forecastWeather = weatherCodeToPresentation(day.weatherCode);

  return (
    <div className="grid grid-cols-[44px_1fr_70px] items-center text-xs">
      <div className="text-paradise-200/90">{formatWeekday(day.date)}</div>
      <div className="flex items-center gap-2 text-paradise-100/90">
        <forecastWeather.Icon
          className={`shrink-0 text-sm ${forecastWeather.accentClassName}`}
        />
        <span>{forecastWeather.label}</span>
      </div>
      <div className="text-right tabular-nums text-paradise-200/80">
        {Math.round(day.tempMin)}°C/{Math.round(day.tempMax)}°C
      </div>
    </div>
  );
}
