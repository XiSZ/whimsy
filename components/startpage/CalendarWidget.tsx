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

// Colors all derive from the accent: `accent-text` is a tint of it that stays
// readable when the accent is dark, `on-accent` is the text on top of it.
export default function CalendarWidget() {
  const [settings, update] = useAppSettings();
  const view = settings.calendarView;
  const [now, setNow] = useState(today);
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [lookup, setLookup] = useState<EventLookup | null>(null);
  const [failedFeeds, setFailedFeeds] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keeps the highlight right in a tab left open past midnight.
  useEffect(() => {
    const interval = setInterval(() => setNow(today()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // The feeds and the iCal parser load only once a calendar is set; a feed
  // that fails doesn't hide the others. Keyed by the links (names only label).
  const feedUrls = settings.calendars.map((calendar) => calendar.url).join("\n");
  useEffect(() => {
    setLookup(null);
    setFailedFeeds(0);
    if (!feedUrls) return;
    const urls = feedUrls.split("\n");
    let cancelled = false;
    (async () => {
      try {
        const { loadCalendar, mergeLookups } = await import("@/lib/calendarEvents");
        const results = await Promise.allSettled(
          urls.map(async (url, source) => {
            const response = await fetch("/api/calendar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return loadCalendar(await response.text(), APP_TIME_ZONE, source);
          }),
        );
        if (cancelled) return;
        const loaded = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        setFailedFeeds(urls.length - loaded.length);
        const next = mergeLookups(loaded);
        setLookup(() => next);
      } catch {
        if (!cancelled) setFailedFeeds(urls.length);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feedUrls]);

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
  const currentMonday = dayKey(startOfWeek(now));
  const monday = startOfWeek(cursor);
  const sunday = addDays(monday, 6);
  const isCurrent =
    view === "week"
      ? dayKey(monday) === currentMonday
      : view === "month"
        ? cursor.year === now.year && cursor.month === now.month
        : cursor.year === now.year;
  // "16–22.11" or, across months, "30.11–6.12".
  const shortDay = (day: Day) => `${day.day}.${day.month + 1}`;
  const label =
    view === "year"
      ? String(cursor.year)
      : view === "month"
        ? formatDay(cursor, { month: "long", year: "numeric" })
        : `KW ${isoWeek(monday.year, monday.month, monday.day)} · ${
            monday.month === sunday.month ? monday.day : shortDay(monday)
          }–${shortDay(sunday)}`;

  const eventsLabel = (date: Day, count: number) =>
    `${formatDay(date, { weekday: "long", day: "numeric", month: "long" })}, ${count} event${count === 1 ? "" : "s"}`;

  // A day in the grid: a button with a dot when it has events.
  const dayCell = (date: Day, column: number) => {
    const key = dayKey(date);
    const list = events?.get(key);
    const isToday = key === todayKey;
    const className = clsx(
      "relative mx-auto flex h-6 w-6 items-center justify-center rounded-full",
      isToday
        ? "bg-paradise-300 font-semibold text-on-accent"
        : column >= 5
          ? "text-accent-text/55"
          : "text-accent-text/90",
      list && "cursor-pointer",
      list && !isToday && "transition-colors hover:bg-white/10",
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
            isToday ? "bg-on-accent" : "bg-accent-text",
          )}
        />
      </button>
    );
  };

  // KW column, a separator line, then Monday–Sunday; `rows` are weeks, with
  // null for the padding days of a month.
  const grid = (rows: (Day | null)[][]) => (
    <div className="relative mt-1 grid grid-cols-8 gap-y-0.5 text-center text-[11px] tabular-nums">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[12.5%] w-px bg-accent-text/15"
      />
      <div className="py-0.5 text-accent-text/35">KW</div>
      {WEEKDAYS.map((weekday) => (
        <div key={weekday} className="py-0.5 text-accent-text/50">
          {weekday}
        </div>
      ))}
      {rows.map((row) => {
        // Every day of a Monday–Sunday row shares one ISO week.
        const first = row.find((day) => day !== null);
        const weekMonday = startOfWeek(first);
        return (
          <Fragment key={dayKey(weekMonday)}>
            <button
              onClick={() => show("week", weekMonday)}
              title="Show this week"
              className={clsx(
                "flex h-6 cursor-pointer items-center justify-center rounded text-[10px] transition-colors hover:text-accent-text",
                dayKey(weekMonday) === currentMonday
                  ? "font-semibold text-accent-text"
                  : "text-accent-text/35",
              )}
            >
              {isoWeek(first.year, first.month, first.day)}
            </button>
            {row.map((day, i) =>
              day === null ? <div key={`blank-${i}`} /> : dayCell(day, i),
            )}
          </Fragment>
        );
      })}
    </div>
  );

  const days = monthDays(cursor.year, cursor.month);
  const monthRows = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) =>
    days
      .slice(w * 7, w * 7 + 7)
      .map((day) => (day === null ? null : { ...cursor, day })),
  );
  const selectedEvents = selected ? events?.get(selected) : undefined;
  const arrow =
    "shrink-0 cursor-pointer p-1 text-[10px] text-accent-text/50 transition-colors hover:text-accent-text";

  return (
    <div
      ref={rootRef}
      className="relative w-full rounded-xl border border-[#2d2d2d]/70 bg-glass px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]"
    >
      {selected && selectedEvents ? (
        <div
          role="dialog"
          aria-label={eventsLabel(parseDayKey(selected), selectedEvents.length)}
          className="absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border border-[#2d2d2d]/80 bg-[#161616]/95 px-3 py-2 shadow-2xl animate-stagger-in"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-accent-text/80">
              {formatDay(parseDayKey(selected), {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="cursor-pointer p-1 text-[10px] text-accent-text/40 transition-colors hover:text-accent-text"
            >
              <FaTimes />
            </button>
          </div>
          <ul className="twitch-scroll mt-1 grid max-h-48 gap-1 overflow-y-auto">
            {selectedEvents.map((event, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="w-12 shrink-0 tabular-nums text-accent-text">
                  {eventTime(event)}
                </span>
                <span className="min-w-0 break-words text-accent-text/90">
                  {event.title}
                  {/* With several calendars, say which one it's from. */}
                  {settings.calendars.length > 1 ? (
                    <span className="block text-[10px] text-accent-text/45">
                      {settings.calendars[event.source]?.name}
                    </span>
                  ) : null}
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
          className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-wide text-accent-text/80 transition-colors enabled:cursor-pointer enabled:hover:text-accent-text"
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

      {view === "month" ? grid(monthRows) : null}
      {view === "week"
        ? grid([Array.from({ length: 7 }, (_, i) => addDays(monday, i))])
        : null}

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
                    ? "bg-paradise-300 font-semibold text-on-accent"
                    : "text-accent-text/90 hover:bg-white/10",
                )}
              >
                {formatDay(first, { month: "short" })}
                {hasEvents ? (
                  <span
                    className={clsx(
                      "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                      isNow ? "bg-on-accent" : "bg-accent-text",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {failedFeeds > 0 ? (
        <div className="mt-1 text-[10px] text-paradise-red">
          {settings.calendars.length === 1
            ? "Couldn't load your Google Calendar."
            : `Couldn't load ${failedFeeds} of ${settings.calendars.length} calendars.`}
        </div>
      ) : null}
    </div>
  );
}
