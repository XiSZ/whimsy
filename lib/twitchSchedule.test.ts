import { describe, expect, it } from "vitest";
import { upcomingStreams, type ChannelSchedule } from "./twitchSchedule";

const now = Date.parse("2026-10-11T12:00:00Z");

const segment = (start: string, end: string | null = null, title = start) => ({
  start,
  end,
  title,
  category: "",
});

describe("upcomingStreams", () => {
  it("keeps running and upcoming streams within the window, soonest first", () => {
    const schedules: Record<string, ChannelSchedule | null> = {
      a: {
        segments: [
          segment("2026-10-15T18:00:00Z", "2026-10-15T22:00:00Z"),
          // Started earlier, still running.
          segment("2026-10-11T10:00:00Z", "2026-10-11T14:00:00Z"),
          // Already over.
          segment("2026-10-10T18:00:00Z", "2026-10-10T22:00:00Z"),
          // Beyond seven days.
          segment("2026-10-19T18:00:00Z", "2026-10-19T22:00:00Z"),
        ],
        vacation: null,
      },
      b: { segments: [segment("2026-10-12T18:00:00Z")], vacation: null },
      failed: null,
    };

    const streams = upcomingStreams(schedules, now);

    expect(streams.map((s) => [s.channelId, s.start])).toEqual([
      ["a", "2026-10-11T10:00:00Z"],
      ["b", "2026-10-12T18:00:00Z"],
      ["a", "2026-10-15T18:00:00Z"],
    ]);
  });

  it("skips segments during a vacation", () => {
    const streams = upcomingStreams(
      {
        a: {
          segments: [
            segment("2026-10-12T18:00:00Z"),
            segment("2026-10-14T18:00:00Z"),
          ],
          vacation: {
            start: "2026-10-13T00:00:00Z",
            end: "2026-10-16T00:00:00Z",
          },
        },
      },
      now,
    );

    expect(streams.map((s) => s.start)).toEqual(["2026-10-12T18:00:00Z"]);
  });
});
