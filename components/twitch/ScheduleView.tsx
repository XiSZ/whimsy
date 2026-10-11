"use client";

import { useEffect, useMemo, useState } from "react";
import {
  upcomingStreams,
  type ChannelSchedule,
} from "@/lib/twitchSchedule";
import { formatDate } from "./format";

interface ScheduleChannel {
  id: string;
  login: string;
  name: string;
  live?: boolean;
}

interface ScheduleViewProps {
  favoriteIds: string[];
  channels: ScheduleChannel[];
}

const CHUNK = 35;

function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const dayDiff = Math.round(
    (new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Upcoming streams of the starred channels for the next seven days, fetched
// from their Twitch schedules when the tab opens.
export default function ScheduleView({
  favoriteIds,
  channels,
}: ScheduleViewProps) {
  const [schedules, setSchedules] = useState<Record<
    string,
    ChannelSchedule | null
  > | null>(null);
  const idsKey = favoriteIds.join(",");

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    const ids = idsKey.split(",");

    (async () => {
      const merged: Record<string, ChannelSchedule | null> = {};
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        try {
          const response = await fetch(
            `/api/twitch/schedule?ids=${chunk.join(",")}`,
            { cache: "no-store" },
          );
          const payload = response.ok
            ? ((await response.json()) as {
                schedules?: Record<string, ChannelSchedule | null>;
              })
            : null;
          for (const id of chunk) merged[id] = payload?.schedules?.[id] ?? null;
        } catch {
          for (const id of chunk) merged[id] = null;
        }
      }
      if (!cancelled) setSchedules(merged);
    })();

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const byId = useMemo(
    () => new Map(channels.map((channel) => [channel.id, channel])),
    [channels],
  );

  if (favoriteIds.length === 0) {
    return (
      <div className="px-2 py-1.5 text-xs text-paradise-200/60">
        Star channels in the Following tab to see their upcoming streams here.
      </div>
    );
  }
  if (!schedules) {
    return (
      <div className="text-xs text-paradise-200/75">Loading schedules...</div>
    );
  }

  const now = new Date();
  const streams = upcomingStreams(schedules, now.getTime());
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  const scheduledIds = new Set(streams.map((stream) => stream.channelId));
  const onVacation = favoriteIds.filter((id) => {
    const vacation = schedules[id]?.vacation;
    return vacation && Date.parse(vacation.end) > now.getTime();
  });
  const failed = favoriteIds.filter((id) => schedules[id] === null);
  const unscheduled = favoriteIds.filter(
    (id) =>
      schedules[id] &&
      !scheduledIds.has(id) &&
      !onVacation.includes(id),
  );

  const groups: Array<{ label: string; items: typeof streams }> = [];
  for (const stream of streams) {
    const label = dayLabel(stream.start, now);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(stream);
    else groups.push({ label, items: [stream] });
  }

  return (
    <>
      <div className="twitch-scroll grid max-h-[60vh] gap-2 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-paradise-200/60">
            None of your favorites have streams scheduled in the next 7 days.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="grid gap-1">
              <div className="px-2 text-[11px] uppercase tracking-wide text-[#b8a4ff]/80">
                {group.label}
              </div>
              {group.items.map((stream) => {
                const channel = byId.get(stream.channelId);
                const isNow =
                  Date.parse(stream.start) <= now.getTime() && channel?.live;
                return (
                  <a
                    key={`${stream.channelId}-${stream.start}`}
                    href={`https://twitch.tv/${channel?.login ?? ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="grid grid-cols-[7.5rem_1fr] items-baseline gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[#b8a4ff]/[0.08]"
                  >
                    <span className="whitespace-nowrap text-[11px] tabular-nums text-paradise-200/70">
                      {timeOf(stream.start)}
                      {stream.end ? `–${timeOf(stream.end)}` : ""}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-paradise-100">
                        {nameOf(stream.channelId)}
                        {isNow ? (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-normal text-[#c2b3ff]/90">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            live
                          </span>
                        ) : null}
                      </span>
                      {stream.title || stream.category ? (
                        <span className="block truncate text-[11px] text-paradise-200/55">
                          {[stream.category, stream.title]
                            .filter(Boolean)
                            .join(" — ")}
                        </span>
                      ) : null}
                    </span>
                  </a>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="grid gap-0.5 text-[10px] text-paradise-200/45">
        {onVacation.length > 0 ? (
          <div>
            On break:{" "}
            {onVacation
              .map((id) => {
                const end = schedules[id]?.vacation?.end ?? "";
                return `${nameOf(id)} (until ${formatDate(end)})`;
              })
              .join(", ")}
          </div>
        ) : null}
        {unscheduled.length > 0 ? (
          <div>No upcoming schedule: {unscheduled.map(nameOf).join(", ")}</div>
        ) : null}
        {failed.length > 0 ? (
          <div>Couldn’t load: {failed.map(nameOf).join(", ")}</div>
        ) : null}
        <div>Times are shown in your local timezone.</div>
      </div>
    </>
  );
}
