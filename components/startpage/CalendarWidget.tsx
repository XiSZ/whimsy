"use client";

import { Fragment, useEffect, useState } from "react";
import clsx from "clsx";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { APP_TIME_ZONE } from "@/config/time";
import { isoWeek, monthDays } from "@/lib/calendar";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Today in the app time zone, like the greeting and progress bars.
function today() {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year, month: month - 1, day };
}

export default function CalendarWidget() {
  const [now, setNow] = useState(today);
  const [shown, setShown] = useState(() => ({
    year: now.year,
    month: now.month,
  }));

  // Keeps the highlight right in a tab left open past midnight.
  useEffect(() => {
    const interval = setInterval(() => setNow(today()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const step = (delta: number) =>
    setShown(({ year, month }) => {
      const first = new Date(year, month + delta, 1);
      return { year: first.getFullYear(), month: first.getMonth() };
    });

  const isCurrent = shown.year === now.year && shown.month === now.month;
  const days = monthDays(shown.year, shown.month);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) =>
    days.slice(w * 7, w * 7 + 7),
  );
  const label = new Date(shown.year, shown.month, 1).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );
  const arrow =
    "cursor-pointer p-1 text-[10px] text-paradise-100/50 transition-colors hover:text-paradise-200";

  return (
    <div className="w-full rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => step(-1)} aria-label="Previous month" className={arrow}>
          <FaChevronLeft />
        </button>
        <button
          onClick={() => setShown({ year: now.year, month: now.month })}
          disabled={isCurrent}
          title={isCurrent ? undefined : "Back to this month"}
          className="text-[11px] uppercase tracking-wide text-paradise-200/75 transition-colors enabled:cursor-pointer enabled:hover:text-paradise-200"
        >
          {label}
        </button>
        <button onClick={() => step(1)} aria-label="Next month" className={arrow}>
          <FaChevronRight />
        </button>
      </div>

      <div className="mt-1 grid grid-cols-8 gap-y-0.5 text-center text-[11px] tabular-nums">
        <div className="py-0.5 text-paradise-100/30">KW</div>
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-0.5 text-paradise-100/40">
            {weekday}
          </div>
        ))}
        {weeks.map((week, w) => (
          <Fragment key={w}>
            {/* Every day of a Monday–Sunday row shares one ISO week. */}
            <div
              className={clsx(
                "flex h-6 items-center justify-center text-[10px]",
                isCurrent && week.includes(now.day)
                  ? "text-paradise-300"
                  : "text-paradise-100/30",
              )}
            >
              {isoWeek(shown.year, shown.month, week.find((day) => day !== null))}
            </div>
            {week.map((day, i) => {
              const isToday = isCurrent && day === now.day;
              return (
                <div
                  key={i}
                  aria-current={isToday ? "date" : undefined}
                  className={clsx(
                    "mx-auto flex h-6 w-6 items-center justify-center rounded-full",
                    isToday
                      ? "bg-paradise-300 font-semibold text-paradise-bg"
                      : i >= 5
                        ? "text-paradise-100/50"
                        : "text-paradise-100/85",
                  )}
                >
                  {day}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
