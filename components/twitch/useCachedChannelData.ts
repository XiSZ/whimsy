"use client";

import { useEffect, useRef, useState } from "react";

const CHUNK = 35;

interface Options {
  enabled: boolean;
  ids: string[];
  // Batch route taking `?ids=`; `field` names the id → value map it returns.
  endpoint: string;
  field: string;
  cacheKey: string;
  ttlMs: number;
}

// Per-channel data that costs one Twitch call per channel: fetched once per
// page visit, the first time `enabled` turns true, in server-friendly chunks.
// Values are cached in localStorage for `ttlMs`; only ids missing from the
// cache are fetched, and `data` grows as chunks land.
export function useCachedChannelData<T>({
  enabled,
  ids,
  endpoint,
  field,
  cacheKey,
  ttlMs,
}: Options): { data: Record<string, T> | null; done: boolean } {
  const [data, setData] = useState<Record<string, T> | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || ids.length === 0 || started.current) return;
    started.current = true;

    let cachedAt = 0;
    let cached: Record<string, T> = {};
    try {
      const stored = JSON.parse(localStorage.getItem(cacheKey) ?? "") as {
        at?: number;
        values?: Record<string, T>;
      };
      if (Date.now() - Number(stored?.at ?? 0) < ttlMs) {
        cachedAt = Number(stored.at);
        cached = stored.values ?? {};
      }
    } catch {
      // No usable cache.
    }
    if (Object.keys(cached).length > 0) setData(cached);

    const missing = ids.filter((id) => !(id in cached));

    (async () => {
      const merged = { ...cached };
      for (let i = 0; i < missing.length; i += CHUNK) {
        try {
          const response = await fetch(
            `${endpoint}?ids=${missing.slice(i, i + CHUNK).join(",")}`,
          );
          if (!response.ok) continue;
          const payload = (await response.json()) as Record<
            string,
            Record<string, T> | undefined
          >;
          Object.assign(merged, payload?.[field] ?? {});
          setData({ ...merged });
        } catch {
          // Skip failed chunks — those channels stay unknown.
        }
      }
      if (missing.length > 0) {
        try {
          // Keep the original stamp when topping up a fresh cache, so the
          // whole thing still expires `ttlMs` after the last full fetch.
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ at: cachedAt || Date.now(), values: merged }),
          );
        } catch {
          // Storage full/unavailable — values just aren't cached.
        }
      }
      setDone(true);
    })();
  }, [enabled, ids, endpoint, field, cacheKey, ttlMs]);

  return { data, done };
}
