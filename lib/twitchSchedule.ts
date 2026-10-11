export interface ChannelSchedule {
  segments: Array<{
    start: string;
    end: string | null;
    title: string;
    category: string;
  }>;
  vacation: { start: string; end: string } | null;
}

export interface UpcomingStream {
  channelId: string;
  start: string;
  end: string | null;
  title: string;
  category: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Segments without an end time are assumed to run this long.
const DEFAULT_LENGTH_MS = 4 * 60 * 60 * 1000;

// Flattens schedules into streams that are running or start within `days`,
// soonest first. Segments that fall into a channel's vacation are skipped.
export function upcomingStreams(
  schedules: Record<string, ChannelSchedule | null>,
  now: number,
  days = 7,
): UpcomingStream[] {
  const until = now + days * DAY_MS;
  const streams: UpcomingStream[] = [];

  for (const [channelId, schedule] of Object.entries(schedules)) {
    if (!schedule) continue;
    const vacationStart = schedule.vacation
      ? Date.parse(schedule.vacation.start)
      : NaN;
    const vacationEnd = schedule.vacation
      ? Date.parse(schedule.vacation.end)
      : NaN;

    for (const segment of schedule.segments) {
      const start = Date.parse(segment.start);
      const end = segment.end
        ? Date.parse(segment.end)
        : start + DEFAULT_LENGTH_MS;
      if (end <= now || start >= until) continue;
      if (start >= vacationStart && start < vacationEnd) continue;
      streams.push({ channelId, ...segment });
    }
  }

  return streams.sort((a, b) => a.start.localeCompare(b.start));
}
