"use client";

import { useEffect, useState } from "react";
import { APP_TIME_ZONE } from "@/config/time";

interface ProgressItem {
  label: string;
  value: number;
}

function getDateInTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 1);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const second = Number(
    parts.find((part) => part.type === "second")?.value ?? 0,
  );

  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function calculatePercentByMinutes(
  start: Date,
  end: Date,
  current: Date,
): number {
  const totalMinutes = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / 60_000),
  );
  const elapsedMinutes = Math.floor(
    (current.getTime() - start.getTime()) / 60_000,
  );
  return (elapsedMinutes / totalMinutes) * 100;
}

function calculateProgress(date: Date): ProgressItem[] {
  const year = date.getFullYear();
  const month = date.getMonth();

  const yearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);
  const yearProgress = calculatePercentByMinutes(
    yearStart,
    nextYearStart,
    date,
  );

  const quarterStartMonth = Math.floor(month / 3) * 3;
  const quarterStart = new Date(year, quarterStartMonth, 1);
  const nextQuarterStart =
    quarterStartMonth === 9
      ? new Date(year + 1, 0, 1)
      : new Date(year, quarterStartMonth + 3, 1);
  const quarterProgress = calculatePercentByMinutes(
    quarterStart,
    nextQuarterStart,
    date,
  );

  const monthStart = new Date(year, month, 1);
  const nextMonthStart =
    month === 11 ? new Date(year + 1, 0, 1) : new Date(year, month + 1, 1);
  const monthProgress = calculatePercentByMinutes(
    monthStart,
    nextMonthStart,
    date,
  );

  const workdayStartHour = 9;
  const workdayEndHour = 18;
  const workdayStart = new Date(date);
  workdayStart.setHours(workdayStartHour, 0, 0, 0);
  const workdayEnd = new Date(date);
  workdayEnd.setHours(workdayEndHour, 0, 0, 0);
  const workdayProgress = calculatePercentByMinutes(
    workdayStart,
    workdayEnd,
    date,
  );

  return [
    { label: "Year", value: clampProgress(yearProgress) },
    { label: "Quarter", value: clampProgress(quarterProgress) },
    { label: "Month", value: clampProgress(monthProgress) },
    { label: "Workday", value: clampProgress(workdayProgress) },
  ];
}

export default function ProgressBars() {
  const [items, setItems] = useState<ProgressItem[]>(() =>
    calculateProgress(getDateInTimeZone(APP_TIME_ZONE)),
  );

  useEffect(() => {
    const update = () => {
      setItems(calculateProgress(getDateInTimeZone(APP_TIME_ZONE)));
    };

    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-xl rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]">
      <div className="grid gap-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[62px_1fr_42px] items-center gap-2"
          >
            <span className="text-xs text-paradise-200">{item.label}</span>
            <div className="h-1.5 rounded-full bg-black/25 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ffd38d] via-[#ff9b3f] to-[#ff7a18] transition-[width] duration-500"
                style={{ width: `${item.value.toFixed(1)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-paradise-200/90 text-right">
              {Math.round(item.value)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
