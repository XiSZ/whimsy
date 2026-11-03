import { describe, expect, it } from "vitest";
import { readWeatherCache } from "./weatherCache";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2";
const MAX_AGE = 30 * 60_000;
const saved = (at: number, endpoint = ENDPOINT) =>
  JSON.stringify({ at, endpoint, data: { temperature: 12 } });

describe("readWeatherCache", () => {
  it("returns recent data as fresh", () => {
    expect(readWeatherCache(saved(1_000), ENDPOINT, MAX_AGE, 2_000)).toEqual({
      data: { temperature: 12 },
      fresh: true,
    });
  });

  it("still returns old data, but not as fresh", () => {
    const result = readWeatherCache(saved(0), ENDPOINT, MAX_AGE, MAX_AGE);
    expect(result?.fresh).toBe(false);
    expect(result?.data).toEqual({ temperature: 12 });
  });

  it("ignores data saved for other coordinates", () => {
    expect(readWeatherCache(saved(0, "other"), ENDPOINT, MAX_AGE, 0)).toBeNull();
  });

  it("ignores missing or corrupt entries", () => {
    expect(readWeatherCache(null, ENDPOINT, MAX_AGE)).toBeNull();
    expect(readWeatherCache("{not json", ENDPOINT, MAX_AGE)).toBeNull();
  });
});
