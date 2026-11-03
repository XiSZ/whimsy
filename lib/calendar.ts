// Day numbers for a month view whose weeks start on Monday, padded with nulls
// for the weekdays before the 1st. `month` is 0-based, like Date.
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
