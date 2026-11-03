import { describe, expect, it } from "vitest";
import { isoWeek, monthDays } from "./calendar";

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
