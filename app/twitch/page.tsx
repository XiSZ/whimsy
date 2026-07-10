"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaExternalLinkAlt, FaTwitch } from "react-icons/fa";

interface FollowedChannel {
  id: string;
  login: string;
  name: string;
  followedAt: string;
  broadcasterType?: string;
  createdAt?: string;
  lastCategory?: string;
  lastTitle?: string;
  avatarUrl?: string;
  live?: boolean;
  viewerCount?: number;
}

interface ModeratedChannel {
  id: string;
  login: string;
  name: string;
}

interface BlockedUser {
  id: string;
  login: string;
  name: string;
}

interface FollowingResponse {
  configured?: boolean;
  connected?: boolean;
  total?: number;
  channels?: FollowedChannel[];
  moderated?: ModeratedChannel[] | null;
  username?: string | null;
}

interface BlockedResponse {
  blocked?: BlockedUser[] | null;
}

interface ChannelDetail {
  lastStreamedAt: string | null;
  followers: number | null;
}

const SORT_MODES = [
  "recent",
  "oldest",
  "name",
  "channel-new",
  "channel-old",
  "followers",
  "viewers",
] as const;
const FILTER_MODES = ["all", "live", "partner", "affiliate"] as const;
const VIEWS = ["following", "moderating", "blocked"] as const;

type SortMode = (typeof SORT_MODES)[number];
type FilterMode = (typeof FILTER_MODES)[number];
type View = (typeof VIEWS)[number];

const PREFS_KEY = "twitch-dashboard-prefs";
const FOLLOWER_CACHE_KEY = "twitch-follower-counts";
const FOLLOWER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.round(value)));
}

function matchesQuery(
  channel: { name: string; login: string },
  query: string,
): boolean {
  return (
    channel.name.toLowerCase().includes(query) ||
    channel.login.toLowerCase().includes(query)
  );
}

function TypeBadge({ type }: { type?: string }) {
  if (type === "partner") {
    return (
      <span className="ml-1.5 rounded bg-[#7d66d8]/25 px-1 py-0.5 text-[9px] font-normal uppercase tracking-wide text-[#c2b3ff]">
        Partner
      </span>
    );
  }
  if (type === "affiliate") {
    return (
      <span className="ml-1.5 rounded bg-black/25 px-1 py-0.5 text-[9px] font-normal uppercase tracking-wide text-paradise-200/55">
        Affiliate
      </span>
    );
  }
  return null;
}

export default function TwitchFollowingPage() {
  const [channels, setChannels] = useState<FollowedChannel[]>([]);
  const [moderated, setModerated] = useState<ModeratedChannel[] | null>(null);
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [blockName, setBlockName] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [total, setTotal] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [followerCounts, setFollowerCounts] = useState<Record<
    string,
    number | null
  > | null>(null);
  const followersFetchStarted = useRef(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [view, setView] = useState<View>("following");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<
    Record<string, ChannelDetail | "loading">
  >({});

  // Restore sort/filter/tab prefs. Runs before the save effect below, so the
  // stored values are read before that effect first writes.
  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(PREFS_KEY) ?? "{}",
      ) as Record<string, unknown>;
      const sort = pick(stored.sortMode, SORT_MODES);
      const filter = pick(stored.filterMode, FILTER_MODES);
      const storedView = pick(stored.view, VIEWS);
      if (sort) setSortMode(sort);
      if (filter) setFilterMode(filter);
      if (storedView) setView(storedView);
    } catch {
      // Corrupt prefs — defaults win.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ sortMode, filterMode, view }),
      );
    } catch {
      // Storage unavailable — prefs just won't stick.
    }
  }, [sortMode, filterMode, view]);

  useEffect(() => {
    let cancelled = false;
    let lastLoadAt = 0;

    const load = async () => {
      lastLoadAt = Date.now();
      try {
        const response = await fetch("/api/twitch/following", {
          cache: "no-store",
        });
        const payload = (await response.json()) as FollowingResponse;
        if (cancelled) return;

        if (!response.ok) throw new Error("Failed to fetch following list");

        setConfigured(Boolean(payload.configured));
        setConnected(Boolean(payload.connected));
        setChannels(Array.isArray(payload.channels) ? payload.channels : []);
        setModerated(
          Array.isArray(payload.moderated) ? payload.moderated : null,
        );
        setTotal(Number(payload.total ?? 0));
        setUsername(payload.username ?? null);
        setHasError(false);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    load();

    // Live badges go stale on a long-lived tab — refetch when it regains
    // focus, at most once a minute.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadAt < 60_000) return;
      load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (view !== "blocked" || blockedLoaded) return;
    let cancelled = false;

    fetch("/api/twitch/blocked", { cache: "no-store" })
      .then((response) => response.json() as Promise<BlockedResponse>)
      .then((payload) => {
        if (cancelled) return;
        setBlocked(Array.isArray(payload.blocked) ? payload.blocked : null);
        setBlockedLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBlocked(null);
        setBlockedLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [view, blockedLoaded]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    if (details[id]) return;

    setDetails((prev) => ({ ...prev, [id]: "loading" }));
    fetch(`/api/twitch/channel?id=${id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ChannelDetail | null) => {
        setDetails((prev) => ({
          ...prev,
          [id]: {
            lastStreamedAt: payload?.lastStreamedAt ?? null,
            followers: payload?.followers ?? null,
          },
        }));
      })
      .catch(() => {
        setDetails((prev) => ({
          ...prev,
          [id]: { lastStreamedAt: null, followers: null },
        }));
      });
  };

  const handleUnblock = async (id: string) => {
    setUnblockingId(id);
    setBlockedError(null);
    try {
      const response = await fetch(`/api/twitch/blocked?target=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("unblock_failed");
      setBlocked((prev) => prev?.filter((user) => user.id !== id) ?? prev);
    } catch {
      setBlockedError("Unblock failed. Try again.");
    } finally {
      setUnblockingId(null);
    }
  };

  const handleBlock = async () => {
    const login = blockName.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,25}$/.test(login)) {
      setBlockedError("Enter a valid Twitch username.");
      return;
    }

    setIsBlocking(true);
    setBlockedError(null);
    try {
      const response = await fetch(`/api/twitch/blocked?login=${login}`, {
        method: "PUT",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        user?: BlockedUser;
      };
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error("block_failed");
      }
      const user = payload.user;
      setBlocked((prev) =>
        prev
          ? [user, ...prev.filter((existing) => existing.id !== user.id)]
          : [user],
      );
      setBlockName("");
    } catch {
      setBlockedError("Block failed — check the username.");
    } finally {
      setIsBlocking(false);
    }
  };

  const downloadFile = (content: string, type: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    downloadFile(
      JSON.stringify(channels, null, 2),
      "application/json",
      "twitch-follows.json",
    );
  };

  const handleExportCsv = () => {
    const header = [
      "name",
      "login",
      "followed_at",
      "channel_created_at",
      "type",
      "last_category",
      "last_title",
      "live",
    ];
    const rows = channels.map((channel) => [
      channel.name,
      channel.login,
      channel.followedAt,
      channel.createdAt ?? "",
      channel.broadcasterType ?? "",
      channel.lastCategory ?? "",
      channel.lastTitle ?? "",
      channel.live ? "yes" : "no",
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value).replaceAll('"', '""');
            // Leading ' neutralizes Excel formula injection — titles and
            // names are streamer-controlled input.
            return `"${/^[=+\-@\t\r]/.test(text) ? `'${text}` : text}"`;
          })
          .join(","),
      )
      .join("\n");

    downloadFile(csv, "text/csv", "twitch-follows.csv");
  };

  const query = search.trim().toLowerCase();

  // Follower totals are one Twitch call per channel, so only fetch them the
  // first time the "Most followed" sort is picked, in server-friendly chunks.
  // Counts are cached in localStorage for 24h (they move slowly); only ids
  // missing from the cache are fetched. The list reorders as chunks land.
  useEffect(() => {
    if (sortMode !== "followers" || channels.length === 0) return;
    if (followersFetchStarted.current) return;
    followersFetchStarted.current = true;

    let cachedAt = 0;
    let cached: Record<string, number | null> = {};
    try {
      const stored = JSON.parse(
        localStorage.getItem(FOLLOWER_CACHE_KEY) ?? "",
      ) as { at?: number; counts?: Record<string, number | null> };
      if (Date.now() - Number(stored?.at ?? 0) < FOLLOWER_CACHE_TTL_MS) {
        cachedAt = Number(stored.at);
        cached = stored.counts ?? {};
      }
    } catch {
      // No usable cache.
    }
    if (Object.keys(cached).length > 0) setFollowerCounts(cached);

    const missing = channels
      .map((channel) => channel.id)
      .filter((id) => !(id in cached));

    (async () => {
      const merged = { ...cached };
      for (let i = 0; i < missing.length; i += 35) {
        try {
          const response = await fetch(
            `/api/twitch/followers?ids=${missing.slice(i, i + 35).join(",")}`,
          );
          if (!response.ok) continue;
          const payload = (await response.json()) as {
            counts?: Record<string, number | null>;
          };
          Object.assign(merged, payload?.counts ?? {});
          setFollowerCounts({ ...merged });
        } catch {
          // Skip failed chunks — those channels just sort to the bottom.
        }
      }
      if (missing.length > 0) {
        try {
          // Keep the original stamp when topping up a fresh cache, so the
          // whole thing still expires 24h after the last full fetch.
          localStorage.setItem(
            FOLLOWER_CACHE_KEY,
            JSON.stringify({ at: cachedAt || Date.now(), counts: merged }),
          );
        } catch {
          // Storage full/unavailable — counts just aren't cached.
        }
      }
    })();
  }, [sortMode, channels]);

  const visibleChannels = useMemo(() => {
    let filtered = channels;
    if (filterMode === "live") {
      filtered = filtered.filter((channel) => channel.live);
    } else if (filterMode === "partner") {
      filtered = filtered.filter(
        (channel) => channel.broadcasterType === "partner",
      );
    } else if (filterMode === "affiliate") {
      filtered = filtered.filter(
        (channel) => channel.broadcasterType === "affiliate",
      );
    }
    if (query) {
      filtered = filtered.filter((channel) => matchesQuery(channel, query));
    }

    const sorted = [...filtered];
    if (sortMode === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "oldest") {
      sorted.sort((a, b) => a.followedAt.localeCompare(b.followedAt));
    } else if (sortMode === "channel-old") {
      sorted.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    } else if (sortMode === "channel-new") {
      sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } else if (sortMode === "followers") {
      sorted.sort(
        (a, b) =>
          (followerCounts?.[b.id] ?? -1) - (followerCounts?.[a.id] ?? -1),
      );
    } else if (sortMode === "viewers") {
      sorted.sort(
        (a, b) => (b.viewerCount ?? -1) - (a.viewerCount ?? -1),
      );
    } else {
      sorted.sort((a, b) => b.followedAt.localeCompare(a.followedAt));
    }
    return sorted;
  }, [channels, query, sortMode, filterMode, followerCounts]);

  const visibleModerated = useMemo(() => {
    const list = moderated ?? [];
    const filtered = query
      ? list.filter((channel) => matchesQuery(channel, query))
      : list;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [moderated, query]);

  const visibleBlocked = useMemo(() => {
    const list = blocked ?? [];
    const filtered = query
      ? list.filter((user) => matchesQuery(user, query))
      : list;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [blocked, query]);

  const tabClass = (active: boolean) =>
    `rounded-md border px-2 py-1 text-[11px] transition-colors ${
      active
        ? "border-[#7d66d8]/70 bg-[#7d66d8]/20 text-[#d8cfff]"
        : "border-[#2d2d2d]/80 bg-black/20 text-paradise-200/70 hover:bg-black/30 hover:text-paradise-200"
    }`;

  const controlClass =
    "rounded-md border border-[#2d2d2d]/80 bg-black/25 px-2 py-1 text-xs text-paradise-100";

  const reconnectHint = (permission: string) => (
    <div className="grid gap-2">
      <div className="text-xs text-paradise-200/75">
        Your session predates the {permission} permission. Reconnect once to
        grant it.
      </div>
      <a
        href="/api/twitch/oauth/start"
        className="w-fit rounded-md border border-[#7d66d8]/70 bg-[#7d66d8]/20 px-2 py-1 text-xs font-medium text-[#d8cfff] transition-colors hover:bg-[#7d66d8]/30"
      >
        Reconnect Twitch
      </a>
    </div>
  );

  const emptyRow = (text: string) => (
    <div className="px-2 py-1.5 text-xs text-paradise-200/60">{text}</div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl py-10 animate-page-in">
      <div className="rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-4 py-3 backdrop-blur-lg backdrop-saturate-150">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-wide text-[#b8a4ff]">
            <Link
              href="/"
              title="Back to startpage"
              className="text-paradise-200/55 transition-colors hover:text-paradise-200"
            >
              <FaArrowLeft />
            </Link>
            <FaTwitch />
            Channels
          </div>
          {username ? (
            <span className="text-[11px] text-paradise-200/55">
              @{username}
            </span>
          ) : null}
        </div>

        {!isLoaded ? (
          <div className="mt-3 text-xs text-paradise-200/75">
            Loading your channels...
          </div>
        ) : !configured ? (
          <div className="mt-3 text-xs text-paradise-200/75">
            Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` to enable login.
          </div>
        ) : !connected || hasError ? (
          <div className="mt-3 grid gap-2">
            <div className="text-xs text-paradise-200/75">
              {hasError
                ? "Could not load your channels right now."
                : "Connect your Twitch account to see who you follow."}
            </div>
            <a
              href="/api/twitch/oauth/start"
              className="w-fit rounded-md border border-[#7d66d8]/70 bg-[#7d66d8]/20 px-2 py-1 text-xs font-medium text-[#d8cfff] transition-colors hover:bg-[#7d66d8]/30"
            >
              Connect Twitch
            </a>
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setView("following")}
                className={tabClass(view === "following")}
              >
                Following · {total || channels.length}
              </button>
              <button
                onClick={() => setView("moderating")}
                className={tabClass(view === "moderating")}
              >
                Moderating{moderated ? ` · ${moderated.length}` : ""}
              </button>
              <button
                onClick={() => setView("blocked")}
                className={tabClass(view === "blocked")}
              >
                Blocked{blocked ? ` · ${blocked.length}` : ""}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search channels..."
                className="w-full rounded-md border border-[#2d2d2d]/80 bg-black/25 px-2 py-1 text-xs text-paradise-100 placeholder:text-paradise-200/40 focus:outline-none focus:border-[#7d66d8]/70"
              />
              {view === "following" ? (
                <>
                  <select
                    value={filterMode}
                    onChange={(event) =>
                      setFilterMode(event.target.value as FilterMode)
                    }
                    className={controlClass}
                  >
                    <option value="all">All</option>
                    <option value="live">Live now</option>
                    <option value="partner">Partners</option>
                    <option value="affiliate">Affiliates</option>
                  </select>
                  <select
                    value={sortMode}
                    onChange={(event) =>
                      setSortMode(event.target.value as SortMode)
                    }
                    className={controlClass}
                  >
                    <option value="recent">Newest follows</option>
                    <option value="oldest">Oldest follows</option>
                    <option value="name">Name A–Z</option>
                    <option value="channel-new">Newest channels</option>
                    <option value="channel-old">Oldest channels</option>
                    <option value="followers">Most followed</option>
                    <option value="viewers">Most viewers (live)</option>
                  </select>
                  <button
                    onClick={handleExportCsv}
                    title="Download the full list as CSV"
                    className="whitespace-nowrap rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-1 text-xs text-paradise-200/70 transition-colors hover:bg-black/30 hover:text-paradise-200"
                  >
                    CSV
                  </button>
                  <button
                    onClick={handleExportJson}
                    title="Download the full list as JSON"
                    className="whitespace-nowrap rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-1 text-xs text-paradise-200/70 transition-colors hover:bg-black/30 hover:text-paradise-200"
                  >
                    JSON
                  </button>
                </>
              ) : null}
            </div>

            {view === "following" ? (
              <>
                <div className="twitch-scroll grid max-h-[60vh] gap-1 overflow-y-auto">
                  {channels.length === 0
                    ? emptyRow("You are not following anyone yet.")
                    : visibleChannels.length === 0
                      ? emptyRow("No channels match the current filters.")
                      : visibleChannels.map((channel) => {
                          const detail = details[channel.id];
                          const isExpanded = expandedId === channel.id;
                          return (
                            <div
                              key={channel.id}
                              className="rounded-md transition-colors hover:bg-[#b8a4ff]/[0.08]"
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleExpand(channel.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    toggleExpand(channel.id);
                                  }
                                }}
                                className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1.5"
                              >
                                {channel.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={channel.avatarUrl}
                                    alt=""
                                    loading="lazy"
                                    className="h-8 w-8 rounded-full"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-black/25" />
                                )}
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-medium text-paradise-100">
                                    {channel.name}
                                    <TypeBadge type={channel.broadcasterType} />
                                    <span className="ml-1.5 font-normal text-paradise-200/45">
                                      @{channel.login}
                                    </span>
                                  </div>
                                  {channel.lastCategory || channel.lastTitle ? (
                                    <div className="truncate text-[11px] text-paradise-200/55">
                                      {[channel.lastCategory, channel.lastTitle]
                                        .filter(Boolean)
                                        .join(" — ")}
                                    </div>
                                  ) : null}
                                  <div className="truncate text-[11px] text-paradise-200/55">
                                    {[
                                      channel.followedAt
                                        ? `followed ${formatDate(channel.followedAt)}`
                                        : "",
                                      channel.createdAt
                                        ? `created ${formatDate(channel.createdAt)}`
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {channel.live ? (
                                    <span className="flex items-center gap-1 text-[11px] tabular-nums text-[#c2b3ff]/90">
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                      {formatCount(channel.viewerCount ?? 0)}
                                    </span>
                                  ) : null}
                                  <a
                                    href={`https://twitch.tv/${channel.login}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open on Twitch"
                                    onClick={(event) => event.stopPropagation()}
                                    className="text-paradise-200/40 transition-colors hover:text-paradise-200"
                                  >
                                    <FaExternalLinkAlt className="text-[10px]" />
                                  </a>
                                </div>
                              </div>
                              {isExpanded ? (
                                <div className="px-2 pb-1.5 pl-12 text-[11px] text-paradise-200/70">
                                  {!detail || detail === "loading"
                                    ? "Loading details..."
                                    : [
                                        detail.lastStreamedAt
                                          ? `last streamed ${formatDate(detail.lastStreamedAt)}`
                                          : "no saved VODs (may stream without saving them)",
                                        detail.followers !== null
                                          ? `${formatCount(detail.followers)} followers`
                                          : "",
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                </div>
                <div className="text-[10px] text-paradise-200/45">
                  Click a channel for last-streamed date and follower count.
                  Twitch removed follow management from its API — to unfollow,
                  open the channel and unfollow there.
                </div>
              </>
            ) : view === "moderating" ? (
              moderated === null ? (
                reconnectHint("moderation")
              ) : (
                <div className="twitch-scroll grid max-h-[60vh] gap-1 overflow-y-auto">
                  {moderated.length === 0
                    ? emptyRow("You are not moderating any channels.")
                    : visibleModerated.length === 0
                      ? emptyRow(`No channels match “${search}”.`)
                      : visibleModerated.map((channel) => (
                          <a
                            key={channel.id}
                            href={`https://twitch.tv/${channel.login}`}
                            target="_blank"
                            rel="noreferrer"
                            className="group grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[#b8a4ff]/[0.08]"
                          >
                            <div className="truncate text-xs font-medium text-paradise-100">
                              {channel.name}
                              <span className="ml-1.5 font-normal text-paradise-200/45">
                                @{channel.login}
                              </span>
                            </div>
                            <FaExternalLinkAlt className="text-[10px] text-paradise-200/0 transition-colors group-hover:text-paradise-200/60" />
                          </a>
                        ))}
                </div>
              )
            ) : !blockedLoaded ? (
              <div className="text-xs text-paradise-200/75">
                Loading blocked users...
              </div>
            ) : blocked === null ? (
              reconnectHint("blocked-users")
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={blockName}
                    onChange={(event) => setBlockName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleBlock();
                    }}
                    placeholder="Block by username..."
                    className="w-full rounded-md border border-[#2d2d2d]/80 bg-black/25 px-2 py-1 text-xs text-paradise-100 placeholder:text-paradise-200/40 focus:outline-none focus:border-[#7d66d8]/70"
                  />
                  <button
                    onClick={handleBlock}
                    disabled={isBlocking || !blockName.trim()}
                    className="whitespace-nowrap rounded-md border border-[#7d66d8]/70 bg-[#7d66d8]/20 px-2 py-1 text-xs font-medium text-[#d8cfff] transition-colors hover:bg-[#7d66d8]/30 disabled:opacity-50"
                  >
                    {isBlocking ? "Blocking..." : "Block"}
                  </button>
                </div>
                {blockedError ? (
                  <div className="text-[11px] text-[#ffb1b1]">
                    {blockedError}
                  </div>
                ) : null}
                <div className="twitch-scroll grid max-h-[60vh] gap-1 overflow-y-auto">
                  {blocked.length === 0
                    ? emptyRow("You have not blocked anyone.")
                    : visibleBlocked.length === 0
                      ? emptyRow(`No users match “${search}”.`)
                      : visibleBlocked.map((user) => (
                          <div
                            key={user.id}
                            className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[#b8a4ff]/[0.08]"
                          >
                            <a
                              href={`https://twitch.tv/${user.login}`}
                              target="_blank"
                              rel="noreferrer"
                              className="min-w-0 truncate text-xs font-medium text-paradise-100 hover:text-[#d8cfff]"
                            >
                              {user.name}
                              <span className="ml-1.5 font-normal text-paradise-200/45">
                                @{user.login}
                              </span>
                            </a>
                            <button
                              onClick={() => handleUnblock(user.id)}
                              disabled={unblockingId === user.id}
                              className="rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-0.5 text-[11px] text-paradise-200/70 transition-colors hover:bg-black/30 hover:text-paradise-200 disabled:opacity-50"
                            >
                              {unblockingId === user.id
                                ? "Unblocking..."
                                : "Unblock"}
                            </button>
                          </div>
                        ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
