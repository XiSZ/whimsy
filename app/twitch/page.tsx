"use client";

import { useEffect, useMemo, useState } from "react";
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

type SortMode = "recent" | "oldest" | "name" | "channel-new" | "channel-old";
type FilterMode = "all" | "live" | "partner" | "affiliate";
type View = "following" | "moderating" | "blocked";

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
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [view, setView] = useState<View>("following");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<
    Record<string, ChannelDetail | "loading">
  >({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
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
    return () => {
      cancelled = true;
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

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "twitch-follows.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const query = search.trim().toLowerCase();

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
    } else {
      sorted.sort((a, b) => b.followedAt.localeCompare(a.followedAt));
    }
    return sorted;
  }, [channels, query, sortMode, filterMode]);

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
            <a
              href="/"
              title="Back to startpage"
              className="text-paradise-200/55 transition-colors hover:text-paradise-200"
            >
              <FaArrowLeft />
            </a>
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
                  </select>
                  <button
                    onClick={handleExportCsv}
                    title="Download the full list as CSV"
                    className="whitespace-nowrap rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-1 text-xs text-paradise-200/70 transition-colors hover:bg-black/30 hover:text-paradise-200"
                  >
                    Export CSV
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
