import { describe, expect, it } from "vitest";
import { migrateSettings, onAccentColor } from "./settings";

describe("migrateSettings", () => {
  it("moves a single saved calendar link into the list", () => {
    expect(migrateSettings({ calendarUrl: "a", glassBlur: 4 })).toEqual({
      calendars: [{ name: "Calendar", url: "a" }],
      glassBlur: 4,
    });
  });

  it("drops an empty old link and keeps an existing list", () => {
    const calendars = [{ name: "Work", url: "b" }];
    expect(migrateSettings({ calendarUrl: "" })).toEqual({});
    expect(migrateSettings({ calendarUrl: "a", calendars })).toEqual({
      calendars,
    });
  });
});

describe("onAccentColor", () => {
  it("puts dark text on light accents and white text on dark ones", () => {
    expect(onAccentColor("#ffcf94")).toBe("#0a0c16"); // default peach
    expect(onAccentColor("#7dd3fc")).toBe("#0a0c16");
    expect(onAccentColor("#3a3a3a")).toBe("#fff"); // dark grey
    expect(onAccentColor("#6b4d87")).toBe("#fff");
  });
});
