// A calendar date; `month` is 0-based, like Date.
export interface Day {
  year: number;
  month: number;
  day: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

// "YYYY-MM-DD", the en-CA date format, used as the key for a day's events.
export const dayKey = ({ year, month, day }: Day) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

export function parseDayKey(key: string): Day {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month: month - 1, day };
}

// The date `n` days after `date` (n may be negative).
export function addDays({ year, month, day }: Day, n: number): Day {
  const date = new Date(Date.UTC(year, month, day + n));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

// Monday of the week containing `date`.
export function startOfWeek(date: Day): Day {
  const weekday = new Date(Date.UTC(date.year, date.month, date.day)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

// Day numbers for a month view whose weeks start on Monday, padded with nulls
// for the weekdays before the 1st.
export function monthDays(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
}

// ISO 8601 week number ("KW"): weeks start on Monday and week 1 is the one
// containing the year's first Thursday. Out-of-range days roll over like Date.
export function isoWeek(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month, day));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7)); // its Thursday
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

// Google Calendar iCal links ("Secret address in iCal format" or a public
// calendar's address) — the only URLs /api/calendar will fetch.
export function isGoogleIcsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "calendar.google.com" &&
      url.port === "" &&
      !url.username &&
      url.pathname.startsWith("/calendar/ical/") &&
      url.pathname.endsWith(".ics")
    );
  } catch {
    return false;
  }
}
