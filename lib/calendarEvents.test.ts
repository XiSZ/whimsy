import { describe, expect, it } from "vitest";
import { loadCalendar, mergeLookups } from "./calendarEvents";

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  // Weekly Mondays, minus the 9th (EXDATE), the 16th moved to the 17th, the
  // 23rd cancelled.
  "BEGIN:VEVENT",
  "UID:standup",
  "SUMMARY:Standup",
  "DTSTART:20261102T090000Z",
  "DTEND:20261102T093000Z",
  "RRULE:FREQ=WEEKLY;COUNT=5",
  "EXDATE:20261109T090000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:standup",
  "RECURRENCE-ID:20261116T090000Z",
  "SUMMARY:Standup (moved)",
  "DTSTART:20261117T100000Z",
  "DTEND:20261117T103000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:standup",
  "RECURRENCE-ID:20261123T090000Z",
  "SUMMARY:Standup",
  "STATUS:CANCELLED",
  "DTSTART:20261123T090000Z",
  "DTEND:20261123T093000Z",
  "END:VEVENT",
  // All-day, the 5th to the 7th (DTEND is exclusive).
  "BEGIN:VEVENT",
  "UID:trip",
  "SUMMARY:Trip",
  "DTSTART;VALUE=DATE:20261105",
  "DTEND;VALUE=DATE:20261108",
  "END:VEVENT",
  // 20:00 in New York on the 3rd is 02:00 on the 4th in Berlin.
  "BEGIN:VEVENT",
  "UID:call",
  "SUMMARY:Call",
  "DTSTART;TZID=America/New_York:20261103T200000",
  "DTEND;TZID=America/New_York:20261103T210000",
  "END:VEVENT",
  // Daily since 2015: thousands of instances before November 2026.
  "BEGIN:VEVENT",
  "UID:daily",
  "SUMMARY:Daily",
  "DTSTART:20150101T070000Z",
  "DTEND:20150101T071500Z",
  "RRULE:FREQ=DAILY",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const november = loadCalendar(ICS, "Europe/Berlin")(
  new Date("2026-11-01T00:00:00+01:00"),
  new Date("2026-12-01T00:00:00+01:00"),
);
const titles = (day: string) =>
  (november.get(day) ?? []).map((event) => event.title);

describe("loadCalendar", () => {
  it("expands a weekly series with its excluded, moved and cancelled dates", () => {
    expect(titles("2026-11-02")).toContain("Standup");
    expect(titles("2026-11-09")).not.toContain("Standup");
    expect(titles("2026-11-16")).not.toContain("Standup");
    expect(titles("2026-11-17")).toContain("Standup (moved)");
    expect(titles("2026-11-23")).not.toContain("Standup");
    expect(titles("2026-11-30")).toContain("Standup");
  });

  it("files a multi-day all-day event on each day, end exclusive", () => {
    expect(titles("2026-11-05")).toContain("Trip");
    expect(titles("2026-11-07")).toContain("Trip");
    expect(titles("2026-11-08")).not.toContain("Trip");
  });

  it("uses the feed's time zones and files events by Berlin day", () => {
    expect(titles("2026-11-03")).not.toContain("Call");
    expect(titles("2026-11-04")).toContain("Call");
  });

  it("reaches the asked month for series that began years earlier", () => {
    expect(titles("2026-11-01")).toContain("Daily");
    expect(titles("2026-11-30")).toContain("Daily");
  });

  it("lists all-day events first, then by start time", () => {
    expect(titles("2026-11-05")).toEqual(["Trip", "Daily"]);
  });
});

describe("mergeLookups", () => {
  it("combines several calendars per day, keeping the order", () => {
    const work = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:review",
      "SUMMARY:Review",
      "DTSTART:20261105T060000Z",
      "DTEND:20261105T063000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const merged = mergeLookups([
      loadCalendar(ICS, "Europe/Berlin", 0),
      loadCalendar(work, "Europe/Berlin", 1),
    ])(new Date("2026-11-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"));

    // Trip is all-day, Review (07:00 Berlin) comes before Daily (08:00).
    expect(
      merged.get("2026-11-05")?.map((event) => [event.title, event.source]),
    ).toEqual([
      ["Trip", 0],
      ["Review", 1],
      ["Daily", 0],
    ]);
  });
});
