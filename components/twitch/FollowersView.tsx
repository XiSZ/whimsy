"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";
import Select, { type SelectOption } from "@/components/ui/Select";
import {
  diffFollowers,
  makeSnapshot,
  type Follower,
  type FollowerSnapshot,
} from "@/lib/followerChanges";
import { formatDate, matchesQuery } from "./format";

const SNAPSHOT_KEY_PREFIX = "twitch-follower-snapshot:";

type FollowerFilter = "all" | "not-followed-back";

const FILTER_OPTIONS: SelectOption<FollowerFilter>[] = [
  { value: "all", label: "All followers" },
  { value: "not-followed-back", label: "You don't follow back" },
];

// Diffs the follower list against the snapshot saved by the last "Mark as
// seen", so changes survive reloads until acknowledged. The first visit just
// stores a baseline; snapshots are per account and never written from a
// failed or missing list.
export function useFollowerChanges(
  userId: string | null,
  followers: Follower[] | null,
  truncated: boolean,
) {
  const [snapshot, setSnapshot] = useState<FollowerSnapshot | null>(null);

  useEffect(() => {
    if (!userId || !followers) return;
    const key = SNAPSHOT_KEY_PREFIX + userId;
    try {
      const stored = JSON.parse(
        localStorage.getItem(key) ?? "null",
      ) as FollowerSnapshot | null;
      if (stored?.followers) {
        setSnapshot(stored);
        return;
      }
    } catch {
      // Corrupt snapshot — start a fresh baseline.
    }
    const baseline = makeSnapshot(followers, truncated);
    try {
      localStorage.setItem(key, JSON.stringify(baseline));
    } catch {
      // Storage unavailable — changes just won't be tracked.
    }
    setSnapshot(baseline);
  }, [userId, followers, truncated]);

  const changes = useMemo(
    () =>
      snapshot && followers
        ? diffFollowers(snapshot, followers, truncated)
        : null,
    [snapshot, followers, truncated],
  );

  const markSeen = () => {
    if (!userId || !followers) return;
    const next = makeSnapshot(followers, truncated);
    try {
      localStorage.setItem(SNAPSHOT_KEY_PREFIX + userId, JSON.stringify(next));
    } catch {
      // Storage unavailable — the diff resets on the next visit anyway.
    }
    setSnapshot(next);
  };

  return { snapshotAt: snapshot?.at ?? null, changes, markSeen };
}

interface FollowersViewProps {
  followers: Follower[] | null;
  loaded: boolean;
  truncated: boolean;
  followingIds: Set<string>;
  query: string;
  changes: ReturnType<typeof useFollowerChanges>["changes"];
  snapshotAt: number | null;
  onMarkSeen: () => void;
  missingPermission: ReactNode;
}

function UserChip({
  user,
  tone,
}: {
  user: Pick<Follower, "login" | "name">;
  tone: "gained" | "lost";
}) {
  return (
    <a
      href={`https://twitch.tv/${user.login}`}
      target="_blank"
      rel="noreferrer"
      className={
        tone === "gained"
          ? "rounded bg-paradise-green/20 px-1.5 py-0.5 text-paradise-green transition-colors hover:bg-paradise-green/30"
          : "rounded bg-paradise-red/20 px-1.5 py-0.5 text-paradise-red transition-colors hover:bg-paradise-red/30"
      }
    >
      {user.name}
    </a>
  );
}

export default function FollowersView({
  followers,
  loaded,
  truncated,
  followingIds,
  query,
  changes,
  snapshotAt,
  onMarkSeen,
  missingPermission,
}: FollowersViewProps) {
  const [filter, setFilter] = useState<FollowerFilter>("all");

  const gainedIds = useMemo(
    () => new Set(changes?.gained.map((follower) => follower.id)),
    [changes],
  );

  const visible = useMemo(() => {
    let list = followers ?? [];
    if (filter === "not-followed-back") {
      list = list.filter((follower) => !followingIds.has(follower.id));
    }
    if (query) list = list.filter((follower) => matchesQuery(follower, query));
    return list;
  }, [followers, filter, followingIds, query]);

  if (!loaded) {
    return (
      <div className="text-xs text-paradise-200/75">Loading followers...</div>
    );
  }
  if (!followers) return missingPermission;

  const hasChanges =
    changes !== null && (changes.gained.length > 0 || changes.lost.length > 0);
  const since = snapshotAt ? formatDate(snapshotAt) : "";

  return (
    <>
      {hasChanges ? (
        <div className="grid gap-1.5 rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-paradise-200/75">
              Since {since}:{" "}
              <span className="text-paradise-green">
                +{changes.gained.length} new
              </span>
              {changes.lostKnown ? (
                <>
                  {" · "}
                  <span className="text-paradise-red">
                    −{changes.lost.length} unfollowed
                  </span>
                </>
              ) : null}
            </span>
            <button
              onClick={onMarkSeen}
              className="whitespace-nowrap rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-0.5 text-paradise-200/70 transition-colors hover:bg-black/30 hover:text-paradise-200"
            >
              Mark as seen
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {changes.gained.map((user) => (
              <UserChip key={`+${user.id}`} user={user} tone="gained" />
            ))}
            {changes.lost.map((user) => (
              <UserChip key={`-${user.id}`} user={user} tone="lost" />
            ))}
          </div>
        </div>
      ) : changes ? (
        <div className="text-[11px] text-paradise-200/55">
          No new followers or unfollows since {since}.
        </div>
      ) : null}

      <Select
        aria-label="Filter followers"
        value={filter}
        options={FILTER_OPTIONS}
        onChange={setFilter}
        className="sm:w-52"
      />

      <div className="twitch-scroll grid max-h-[60vh] gap-1 overflow-y-auto">
        {followers.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-paradise-200/60">
            Nobody follows you yet.
          </div>
        ) : visible.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-paradise-200/60">
            No followers match the current filters.
          </div>
        ) : (
          visible.map((follower) => (
            <a
              key={follower.id}
              href={`https://twitch.tv/${follower.login}`}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[#b8a4ff]/[0.08]"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-paradise-100">
                  {follower.name}
                  {gainedIds.has(follower.id) ? (
                    <span className="ml-1.5 rounded bg-paradise-green/20 px-1 py-0.5 text-[9px] font-normal uppercase tracking-wide text-paradise-green">
                      New
                    </span>
                  ) : null}
                  {followingIds.has(follower.id) ? (
                    <span className="ml-1.5 rounded bg-[#7d66d8]/25 px-1 py-0.5 text-[9px] font-normal uppercase tracking-wide text-[#c2b3ff]">
                      You follow
                    </span>
                  ) : null}
                  <span className="ml-1.5 font-normal text-paradise-200/45">
                    @{follower.login}
                  </span>
                </div>
                {follower.followedAt ? (
                  <div className="truncate text-[11px] text-paradise-200/55">
                    followed you {formatDate(follower.followedAt)}
                  </div>
                ) : null}
              </div>
              <FaExternalLinkAlt className="text-[10px] text-paradise-200/0 transition-colors group-hover:text-paradise-200/60" />
            </a>
          ))
        )}
      </div>

      <div className="text-[10px] text-paradise-200/45">
        {truncated
          ? "Showing your newest 4,000 followers; unfollows can't be tracked beyond that."
          : "New followers and unfollows are tracked from your last “Mark as seen”."}
      </div>
    </>
  );
}
