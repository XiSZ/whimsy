import ICAL from "ical.js";
import { addDays, dayKey, parseDayKey } from "./calendar";

export interface CalendarEvent {
  title: string;
  start: Date;
  allDay: boolean;
  // Which of the configured calendars it came from (its index).
  source: number;
}

// Events by "YYYY-MM-DD" day for the range [from, to).
export type EventLookup = (from: Date, to: Date) => Map<string, CalendarEvent[]>;

// All-day events first, then by start time.
const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime();

// One lookup over several calendars: their events merged per day, in order.
export function mergeLookups(lookups: EventLookup[]): EventLookup {
  return (from, to) => {
    const days = new Map<string, CalendarEvent[]>();
    for (const lookup of lookups) {
      for (const [key, list] of lookup(from, to)) {
        days.set(key, [...(days.get(key) ?? []), ...list]);
      }
    }
    for (const list of days.values()) list.sort(byStart);
    return days;
  };
}

// shortcut: a series stops expanding after this many instances, far more than
// a daily series reaching back decades needs; raise it if one ever stops short.
const MAX_STEPS = 100_000;
const DAY_MS = 86_400_000;

// Parses an iCal feed and returns a lookup that expands recurring events for
// the asked range, filing them under their days in `timeZone`. Runs in the
// browser: a large calendar is too heavy for the edge function's CPU limit.
export function loadCalendar(
  ics: string,
  timeZone: string,
  source = 0,
): EventLookup {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  // Without its VTIMEZONEs, TZID times would be read as floating local times.
  for (const zone of calendar.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(new ICAL.Timezone(zone));
  }

  // Overrides of single instances (RECURRENCE-ID) attach to their series.
  const series = new Map<string, InstanceType<typeof ICAL.Event>>();
  const overrides: InstanceType<typeof ICAL.Event>[] = [];
  for (const component of calendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (event.isRecurrenceException()) overrides.push(event);
    else series.set(event.uid, event);
  }
  for (const override of overrides) {
    const master = series.get(override.uid);
    if (master?.isRecurring()) master.relateException(override);
    else series.set(`${override.uid}@${override.recurrenceId}`, override);
  }

  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone });
  const dateOnly = (time: InstanceType<typeof ICAL.Time>) =>
    dayKey({ year: time.year, month: time.month - 1, day: time.day });

  return (from, to) => {
    const days = new Map<string, CalendarEvent[]>();

    const add = (
      item: InstanceType<typeof ICAL.Event>,
      start: InstanceType<typeof ICAL.Time>,
      end: InstanceType<typeof ICAL.Time>,
    ) => {
      if (item.component.getFirstPropertyValue("status") === "CANCELLED") return;
      const startMs = start.toJSDate().getTime();
      const endMs = Math.max(end.toJSDate().getTime(), startMs + 1);
      if (endMs <= from.getTime() || startMs >= to.getTime()) return;

      const entry = {
        title: item.summary || "(No title)",
        start: new Date(startMs),
        allDay: start.isDate,
        source,
      };
      // All-day ends are exclusive (ending on the 8th covers the 7th); a timed
      // event ending at midnight doesn't spill into the next day either.
      const first = start.isDate ? dateOnly(start) : localDay.format(startMs);
      const last = start.isDate
        ? dayKey(addDays(parseDayKey(dateOnly(end)), -1))
        : localDay.format(endMs - 1);
      for (let day = parseDayKey(first); ; day = addDays(day, 1)) {
        const key = dayKey(day);
        days.set(key, [...(days.get(key) ?? []), entry]);
        if (key >= last) break;
      }
    };

    for (const event of series.values()) {
      if (!event.isRecurring()) {
        add(event, event.startDate, event.endDate);
        continue;
      }
      const instances = event.iterator();
      for (
        let next = instances.next(), steps = 0;
        next && steps < MAX_STEPS;
        next = instances.next(), steps++
      ) {
        // Overridden instances can be moved a little past their slot.
        if (next.toJSDate().getTime() >= to.getTime() + 31 * DAY_MS) break;
        const details = event.getOccurrenceDetails(next);
        add(details.item, details.startDate, details.endDate);
      }
    }

    for (const list of days.values()) list.sort(byStart);
    return days;
  };
}
