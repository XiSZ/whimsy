"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import Select from "@/components/ui/Select";
import { APP_TIME_ZONE } from "@/config/time";
import {
  addDays,
  dayKey,
  isoWeek,
  monthDays,
  parseDayKey,
  startOfWeek,
  type Day,
} from "@/lib/calendar";
import type { CalendarEvent, EventLookup } from "@/lib/calendarEvents";
import { useAppSettings, type CalendarView } from "./settings";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE });
const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

// Today in the app time zone, like the greeting and progress bars.
const today = () => parseDayKey(localDay.format(new Date()));
const utc = (day: Day) => new Date(Date.UTC(day.year, day.month, day.day));
const formatDay = (day: Day, options: Intl.DateTimeFormatOptions) =>
  utc(day).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
const eventTime = (event: CalendarEvent) =>
  event.allDay ? "All day" : clock.format(event.start);

// The dates a view covers, padded a day each side: events are filed by the
// app time zone's days, the range only bounds how far series get expanded.
function viewRange(view: CalendarView, cursor: Day): [number, number] {
  const monday = startOfWeek(cursor);
  const [first, next] =
    view === "week"
      ? [monday, addDays(monday, 7)]
      : view === "month"
        ? [{ ...cursor, day: 1 }, { year: cursor.year, month: cursor.month + 1, day: 1 }]
        : [{ year: cursor.year, month: 0, day: 1 }, { year: cursor.year + 1, month: 0, day: 1 }];
  return [utc(addDays(first, -1)).getTime(), utc(addDays(next, 1)).getTime()];
}

export default function CalendarWidget() {
  const [settings, update] = useAppSettings();
  const view = settings.calendarView;
  const [now, setNow] = useState(today);
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [lookup, setLookup] = useState<EventLookup | null>(null);
  const [feedError, setFeedError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keeps the highlight right in a tab left open past midnight.
  useEffect(() => {
    const interval = setInterval(() => setNow(today()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // The feed and the iCal parser load only once a Google Calendar link is set.
  useEffect(() => {
    setLookup(null);
    setFeedError(false);
    if (!settings.calendarUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: settings.calendarUrl }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const [ics, { loadCalendar }] = await Promise.all([
          response.text(),
          import("@/lib/calendarEvents"),
        ]);
        const next = loadCalendar(ics, APP_TIME_ZONE);
        if (!cancelled) setLookup(() => next);
      } catch {
        if (!cancelled) setFeedError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.calendarUrl]);

  const [fromMs, toMs] = viewRange(view, cursor);
  const events = useMemo(
    () => lookup?.(new Date(fromMs), new Date(toMs)) ?? null,
    [lookup, fromMs, toMs],
  );

  useEffect(() => {
    if (!selected) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setSelected(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  const show = (nextView: CalendarView, day: Day) => {
    setSelected(null);
    setCursor(day);
    if (nextView !== view) update({ calendarView: nextView });
  };

  const step = (delta: number) =>
    show(
      view,
      view === "week"
        ? addDays(cursor, 7 * delta)
        : view === "month"
          ? addDays({ year: cursor.year, month: cursor.month + delta, day: 1 }, 0)
          : { year: cursor.year + delta, month: cursor.month, day: 1 },
    );

  const toggle = (key: string) =>
    setSelected((current) => (current === key ? null : key));

  const todayKey = dayKey(now);
  const monday = startOfWeek(cursor);
  const sunday = addDays(monday, 6);
  const thisWeek = dayKey(startOfWeek(now)) === dayKey(monday);
  const isCurrent =
    view === "week"
      ? thisWeek
      : view === "month"
        ? cursor.year === now.year && cursor.month === now.month
        : cursor.year === now.year;
  const label =
    view === "year"
      ? String(cursor.year)
      : view === "month"
        ? formatDay(cursor, { month: "long", year: "numeric" })
        : `KW ${isoWeek(monday.year, monday.month, monday.day)} · ${
            monday.month === sunday.month
              ? monday.day
              : formatDay(monday, { day: "numeric", month: "short" })
          }–${formatDay(sunday, { day: "numeric", month: "short" })}`;

  const eventsLabel = (date: Day, count: number) =>
    `${formatDay(date, { weekday: "long", day: "numeric", month: "long" })}, ${count} event${count === 1 ? "" : "s"}`;

  // A day in the month grid: a button with a dot when it has events.
  const dayCell = (date: Day, column: number) => {
    const key = dayKey(date);
    const list = events?.get(key);
    const isToday = key === todayKey;
    const className = clsx(
      "relative mx-auto flex h-6 w-6 items-center justify-center rounded-full",
      isToday
        ? "bg-paradise-300 font-semibold text-paradise-bg"
        : column >= 5
          ? "text-paradise-100/50"
          : "text-paradise-100/85",
      list && !isToday && "cursor-pointer transition-colors hover:bg-white/10",
      list && isToday && "cursor-pointer",
      selected === key && !isToday && "bg-white/15",
    );
    if (!list) {
      return (
        <div key={key} aria-current={isToday ? "date" : undefined} className={className}>
          {date.day}
        </div>
      );
    }
    return (
      <button
        key={key}
        onClick={() => toggle(key)}
        aria-expanded={selected === key}
        aria-current={isToday ? "date" : undefined}
        aria-label={eventsLabel(date, list.length)}
        className={className}
      >
        {date.day}
        <span
          className={clsx(
            "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
            isToday ? "bg-paradise-bg" : "bg-paradise-300",
          )}
        />
      </button>
    );
  };

  const days = monthDays(cursor.year, cursor.month);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) =>
    days.slice(w * 7, w * 7 + 7),
  );
  const selectedEvents = selected ? events?.get(selected) : undefined;
  const arrow =
    "shrink-0 cursor-pointer p-1 text-[10px] text-paradise-100/50 transition-colors hover:text-paradise-200";

  return (
    <div
      ref={rootRef}
      className="relative w-full rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]"
    >
      {selected && selectedEvents ? (
        <div
          role="dialog"
          aria-label={eventsLabel(parseDayKey(selected), selectedEvents.length)}
          className="absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border border-[#2d2d2d]/80 bg-[#161616]/95 px-3 py-2 shadow-2xl animate-stagger-in"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-paradise-200/75">
              {formatDay(parseDayKey(selected), {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="cursor-pointer p-1 text-[10px] text-paradise-100/40 transition-colors hover:text-paradise-200"
            >
              <FaTimes />
            </button>
          </div>
          <ul className="twitch-scroll mt-1 grid max-h-48 gap-1 overflow-y-auto">
            {selectedEvents.map((event, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="w-12 shrink-0 tabular-nums text-paradise-300">
                  {eventTime(event)}
                </span>
                <span className="min-w-0 break-words text-paradise-100/85">
                  {event.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <button onClick={() => step(-1)} aria-label={`Previous ${view}`} className={arrow}>
          <FaChevronLeft />
        </button>
        <button
          onClick={() => show(view, now)}
          disabled={isCurrent}
          title={isCurrent ? undefined : "Back to today"}
          className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-wide text-paradise-200/75 transition-colors enabled:cursor-pointer enabled:hover:text-paradise-200"
        >
          {label}
        </button>
        <button onClick={() => step(1)} aria-label={`Next ${view}`} className={arrow}>
          <FaChevronRight />
        </button>
        <Select
          size="sm"
          aria-label="Calendar view"
          value={view}
          options={VIEWS}
          onChange={(nextView) => show(nextView, nextView === "month" ? { ...cursor, day: 1 } : cursor)}
        />
      </div>

      {view === "month" ? (
        <div className="mt-1 grid grid-cols-8 gap-y-0.5 text-center text-[11px] tabular-nums">
          <div className="py-0.5 text-paradise-100/30">KW</div>
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="py-0.5 text-paradise-100/40">
              {weekday}
            </div>
          ))}
          {weeks.map((week, w) => {
            // Every day of a Monday–Sunday row shares one ISO week.
            const first = { ...cursor, day: week.find((day) => day !== null) };
            const weekMonday = startOfWeek(first);
            return (
              <Fragment key={w}>
                <button
                  onClick={() => show("week", weekMonday)}
                  title="Show this week"
                  className={clsx(
                    "flex h-6 cursor-pointer items-center justify-center rounded text-[10px] transition-colors hover:text-paradise-200",
                    dayKey(weekMonday) === dayKey(startOfWeek(now))
                      ? "text-paradise-300"
                      : "text-paradise-100/30",
                  )}
                >
                  {isoWeek(first.year, first.month, first.day)}
                </button>
                {week.map((day, i) =>
                  day === null ? (
                    <div key={`blank-${i}`} />
                  ) : (
                    dayCell({ ...cursor, day }, i)
                  ),
                )}
              </Fragment>
            );
          })}
        </div>
      ) : null}

      {view === "week" ? (
        <ul className="mt-1 grid gap-0.5">
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((date, i) => {
            const key = dayKey(date);
            const list = events?.get(key);
            const isToday = key === todayKey;
            const content = (
              <>
                <span
                  className={clsx(
                    "w-5 shrink-0 text-[10px]",
                    i >= 5 ? "text-paradise-100/40" : "text-paradise-100/55",
                  )}
                >
                  {WEEKDAYS[i]}
                </span>
                <span
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full tabular-nums",
                    isToday
                      ? "bg-paradise-300 font-semibold text-paradise-bg"
                      : "text-paradise-100/85",
                  )}
                >
                  {date.day}
                </span>
                {list ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-paradise-100/85">
                      <span className="text-paradise-300">{eventTime(list[0])}</span>{" "}
                      {list[0].title}
                    </span>
                    {list.length > 1 ? (
                      <span className="shrink-0 text-paradise-100/40">
                        +{list.length - 1}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </>
            );
            const row = "flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-[11px]";
            return (
              <li key={key} aria-current={isToday ? "date" : undefined}>
                {list ? (
                  <button
                    onClick={() => toggle(key)}
                    aria-expanded={selected === key}
                    aria-label={eventsLabel(date, list.length)}
                    className={clsx(
                      row,
                      "cursor-pointer transition-colors hover:bg-white/5",
                      selected === key && "bg-white/10",
                    )}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={row}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {view === "year" ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px]">
          {Array.from({ length: 12 }, (_, month) => {
            const first = { year: cursor.year, month, day: 1 };
            const prefix = dayKey(first).slice(0, 8);
            const isNow = cursor.year === now.year && month === now.month;
            const hasEvents =
              events !== null && [...events.keys()].some((key) => key.startsWith(prefix));
            return (
              <button
                key={month}
                onClick={() => show("month", first)}
                className={clsx(
                  "relative cursor-pointer rounded-md py-1.5 transition-colors",
                  isNow
                    ? "bg-paradise-300 font-semibold text-paradise-bg"
                    : "text-paradise-100/85 hover:bg-white/10",
                )}
              >
                {formatDay(first, { month: "short" })}
                {hasEvents ? (
                  <span
                    className={clsx(
                      "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                      isNow ? "bg-paradise-bg" : "bg-paradise-300",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {feedError ? (
        <div className="mt-1 text-[10px] text-paradise-red">
          Couldn&apos;t load your Google Calendar.
        </div>
      ) : null}
    </div>
  );
}
