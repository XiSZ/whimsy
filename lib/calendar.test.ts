import { describe, expect, it } from "vitest";
import {
  addDays,
  isGoogleIcsUrl,
  isoWeek,
  monthDays,
  startOfWeek,
} from "./calendar";

describe("startOfWeek", () => {
  it("goes back to Monday, across month and year ends", () => {
    expect(startOfWeek({ year: 2026, month: 10, day: 8 })).toEqual({
      year: 2026,
      month: 10,
      day: 2,
    }); // Sunday → Monday before
    expect(startOfWeek({ year: 2027, month: 0, day: 1 })).toEqual({
      year: 2026,
      month: 11,
      day: 28,
    });
    expect(startOfWeek({ year: 2026, month: 10, day: 2 }).day).toBe(2); // a Monday
  });

  it("adds days across month ends", () => {
    expect(addDays({ year: 2026, month: 10, day: 30 }, 1)).toEqual({
      year: 2026,
      month: 11,
      day: 1,
    });
  });
});

describe("isGoogleIcsUrl", () => {
  it("accepts secret and public Google Calendar iCal links", () => {
    expect(
      isGoogleIcsUrl(
        "https://calendar.google.com/calendar/ical/me%40gmail.com/private-abc123/basic.ics",
      ),
    ).toBe(true);
    expect(
      isGoogleIcsUrl(
        "https://calendar.google.com/calendar/ical/de.german%23holiday%40group.v.calendar.google.com/public/basic.ics",
      ),
    ).toBe(true);
  });

  it("rejects anything that could fetch elsewhere", () => {
    for (const url of [
      "http://calendar.google.com/calendar/ical/x/basic.ics",
      "https://calendar.google.com.evil.example/calendar/ical/x/basic.ics",
      "https://calendar.google.com:8443/calendar/ical/x/basic.ics",
      "https://user@calendar.google.com/calendar/ical/x/basic.ics",
      "https://calendar.google.com/calendar/embed?src=x",
      "not a url",
    ]) {
      expect(isGoogleIcsUrl(url), url).toBe(false);
    }
  });
});

describe("isoWeek", () => {
  it("numbers weeks from the one holding the first Thursday", () => {
    expect(isoWeek(2026, 0, 1)).toBe(1); // Thursday
    expect(isoWeek(2026, 10, 3)).toBe(45);
  });

  it("gives the last days of a year to week 53 or the next year's week 1", () => {
    expect(isoWeek(2027, 0, 1)).toBe(53); // Friday, still 2026's KW 53
    expect(isoWeek(2024, 11, 30)).toBe(1); // Monday of 2025's KW 1
  });
});

describe("monthDays", () => {
  it("pads a month starting on Sunday with six blanks", () => {
    const days = monthDays(2026, 10); // November 2026, the 1st is a Sunday
    expect(days.slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    expect(days.at(-1)).toBe(30);
  });

  it("needs no padding when the 1st is a Monday", () => {
    expect(monthDays(2026, 5)[0]).toBe(1); // June 2026
  });

  it("counts leap days", () => {
    const days = monthDays(2024, 1); // February 2024, starts on Thursday
    expect(days.filter((day) => day === null)).toHaveLength(3);
    expect(days.at(-1)).toBe(29);
  });
});
