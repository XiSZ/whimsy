"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { FaTwitch } from "react-icons/fa";

interface TwitchChannel {
  login: string;
  name: string;
  viewerCount: number;
  category: string;
}

interface TwitchResponse {
  configured?: boolean;
  connected?: boolean;
  channels?: TwitchChannel[];
}

const TWITCH_REFRESH_SECONDS = Number(
  process.env.NEXT_PUBLIC_TWITCH_REFRESH_SECONDS,
);
const TWITCH_MAX_CHANNELS = Number(process.env.NEXT_PUBLIC_TWITCH_MAX_CHANNELS);

const TWITCH_REFRESH_KEY = "whimsy.twitch.refreshSeconds";
const TWITCH_MAX_CHANNELS_KEY = "whimsy.twitch.maxChannels";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDefaultRefreshSeconds(): number {
  if (!Number.isFinite(TWITCH_REFRESH_SECONDS)) return 90;
  return clamp(Math.round(TWITCH_REFRESH_SECONDS), 30, 600);
}

function getDefaultMaxChannels(): number {
  if (!Number.isFinite(TWITCH_MAX_CHANNELS)) return 5;
  return clamp(Math.round(TWITCH_MAX_CHANNELS), 1, 10);
}

function formatViewerCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.round(value)));
}

export default function TwitchWidget() {
  const [channels, setChannels] = useState<TwitchChannel[]>([]);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshSeconds, setRefreshSeconds] = useState(getDefaultRefreshSeconds);
  const [maxChannels, setMaxChannels] = useState(getDefaultMaxChannels);

  const refreshMs = useMemo(() => {
    return clamp(Math.round(refreshSeconds), 30, 600) * 1000;
  }, [refreshSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRefresh = Number(window.localStorage.getItem(TWITCH_REFRESH_KEY));
    const storedMaxChannels = Number(
      window.localStorage.getItem(TWITCH_MAX_CHANNELS_KEY),
    );

    if (Number.isFinite(storedRefresh)) {
      setRefreshSeconds(clamp(Math.round(storedRefresh), 30, 600));
    }

    if (Number.isFinite(storedMaxChannels)) {
      setMaxChannels(clamp(Math.round(storedMaxChannels), 1, 10));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const update = async () => {
      try {
        const query = new URLSearchParams({
          maxChannels: String(clamp(maxChannels, 1, 10)),
        });
        const response = await fetch(`/api/twitch/live?${query.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as TwitchResponse;

        if (cancelled) return;

        if (!response.ok) {
          throw new Error("Failed to fetch Twitch overview");
        }

        setConfigured(Boolean(payload.configured));
        setConnected(Boolean(payload.connected));
        setChannels(Array.isArray(payload.channels) ? payload.channels : []);
        setHasError(false);
      } catch {
        if (cancelled) return;
        setHasError(true);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    update();
    const interval = setInterval(update, refreshMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshMs, maxChannels]);

  const handleRefreshSecondsChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = clamp(Number(event.target.value), 30, 600);
    setRefreshSeconds(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TWITCH_REFRESH_KEY, String(value));
    }
  };

  const handleMaxChannelsChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = clamp(Number(event.target.value), 1, 10);
    setMaxChannels(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TWITCH_MAX_CHANNELS_KEY, String(value));
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/twitch/oauth/start";
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await fetch("/api/twitch/oauth/disconnect", { method: "POST" });
      setConnected(false);
      setChannels([]);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="fixed top-4 left-4 z-20 w-[260px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#b8a4ff]">
          <FaTwitch className="text-xs" />
          Twitch
        </div>
        <div className="text-[10px] uppercase tracking-wide text-paradise-100/70">
          Following live
        </div>
      </div>

      <div className="mt-1 flex items-center justify-end">
        <button
          onClick={() => setSettingsOpen((open) => !open)}
          className="text-[10px] uppercase tracking-wide text-paradise-200/70 transition-colors hover:text-paradise-200"
        >
          {settingsOpen ? "Hide settings" : "Settings"}
        </button>
      </div>

      {settingsOpen ? (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 rounded-md border border-[#2d2d2d]/70 bg-black/15 px-2 py-1.5">
          <label className="self-center text-[11px] text-paradise-200/80">
            Refresh
          </label>
          <select
            value={refreshSeconds}
            onChange={handleRefreshSecondsChange}
            className="rounded border border-[#2d2d2d]/80 bg-black/25 px-1 py-0.5 text-[11px] text-paradise-100"
          >
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={90}>90s</option>
            <option value={120}>120s</option>
            <option value={180}>180s</option>
            <option value={300}>300s</option>
            <option value={600}>600s</option>
          </select>

          <label className="self-center text-[11px] text-paradise-200/80">
            Channels
          </label>
          <select
            value={maxChannels}
            onChange={handleMaxChannelsChange}
            className="rounded border border-[#2d2d2d]/80 bg-black/25 px-1 py-0.5 text-[11px] text-paradise-100"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
            <option value={6}>6</option>
            <option value={7}>7</option>
            <option value={8}>8</option>
            <option value={9}>9</option>
            <option value={10}>10</option>
          </select>
        </div>
      ) : null}

      {!configured ? (
        <div className="mt-2 text-xs text-paradise-200/75">
          Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` to enable login.
        </div>
      ) : !connected ? (
        <div className="mt-2 grid gap-2">
          <div className="text-xs text-paradise-200/75">
            Connect your account to load followed live channels.
          </div>
          <button
            onClick={handleConnect}
            className="rounded-md border border-[#7d66d8]/70 bg-[#7d66d8]/20 px-2 py-1 text-xs font-medium text-[#d8cfff] transition-colors hover:bg-[#7d66d8]/30"
          >
            Connect Twitch
          </button>
        </div>
      ) : hasError ? (
        <div className="mt-2 grid gap-2">
          <div className="text-xs text-paradise-200/75">
            Could not load Twitch right now.
          </div>
          <button
            onClick={handleConnect}
            className="rounded-md border border-[#7d66d8]/70 bg-[#7d66d8]/20 px-2 py-1 text-xs font-medium text-[#d8cfff] transition-colors hover:bg-[#7d66d8]/30"
          >
            Reconnect
          </button>
        </div>
      ) : !isLoaded ? (
        <div className="mt-2 text-xs text-paradise-200/75">Checking channels...</div>
      ) : channels.length === 0 ? (
        <div className="mt-2 grid gap-2">
          <div className="text-xs text-paradise-200/75">
            Nobody you follow is live right now.
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-1 text-xs text-paradise-200/80 transition-colors hover:bg-black/30 disabled:opacity-60"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      ) : (
        <div className="mt-2 grid gap-2">
          <div className="grid gap-1.5">
            {channels.map((channel) => (
              <a
                key={channel.login}
                href={`https://twitch.tv/${channel.login}`}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[1fr_auto] gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-paradise-100">
                    {channel.name}
                  </div>
                  <div className="truncate text-[11px] text-paradise-200/75">
                    {channel.category}
                  </div>
                </div>
                <div className="self-center text-[11px] tabular-nums text-[#c2b3ff]">
                  {formatViewerCount(channel.viewerCount)}
                </div>
              </a>
            ))}
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="rounded-md border border-[#2d2d2d]/80 bg-black/20 px-2 py-1 text-xs text-paradise-200/80 transition-colors hover:bg-black/30 disabled:opacity-60"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}