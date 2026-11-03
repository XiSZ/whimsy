export interface WeatherCache<T> {
  at: number;
  endpoint: string;
  data: T;
}

// The cached weather for `endpoint` and whether it is recent enough to skip
// a fetch; null when missing, unreadable or saved for other coordinates.
export function readWeatherCache<T>(
  raw: string | null,
  endpoint: string,
  maxAgeMs: number,
  now = Date.now(),
): { data: T; fresh: boolean } | null {
  try {
    const cache = JSON.parse(raw ?? "null") as WeatherCache<T> | null;
    if (cache?.endpoint !== endpoint || !cache.data) return null;
    return { data: cache.data, fresh: now - cache.at < maxAgeMs };
  } catch {
    return null;
  }
}
