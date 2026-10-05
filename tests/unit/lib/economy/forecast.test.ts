import { describe, expect, it } from "vitest";

import { FORECAST_HOURS, forecast } from "@/lib/economy/forecast";
import { cacheCap, RATES, type Workforce } from "@/lib/economy/tick";

const none = { cooks: 0, engineers: 0, tinkerers: 0, cacheStorages: 0, powerPlants: 0, workshops: 0 };
const fresh = { cache: 40, uptime: 100, payload: 0 };

describe("forecast", () => {
  it("a lone survivor with no rooms only consumes", () => {
    const f = forecast(fresh, { ...none, forks: 1 });
    expect(f.delta).toEqual({
      cache: -FORECAST_HOURS * RATES.eatPerHour,
      uptime: -FORECAST_HOURS * RATES.drainPerHour,
      payload: 0,
    });
    expect(f.warnings).toEqual([]);
    expect(f.starved).toBe(false);
  });

  it("flags rooms nobody works in", () => {
    const work: Workforce = { ...none, forks: 1, cacheStorages: 1, powerPlants: 1, workshops: 1 };
    expect(forecast(fresh, work).warnings).toEqual(["no_cooks", "no_engineers", "no_tinkerers"]);
  });

  it("warns when the crew eats the pantry dry", () => {
    const f = forecast({ ...fresh, cache: 3 }, { ...none, forks: 2 });
    expect(f.cache).toBe(0);
    expect(f.delta.cache).toBe(-3);
    expect(f.starved).toBe(true);
  });

  it("stops at the shelf cap and warns that cooking is wasted", () => {
    const work: Workforce = { ...none, cooks: 2, forks: 2, cacheStorages: 1 };
    const f = forecast({ ...fresh, cache: 150 }, work);
    expect(f.cache).toBe(cacheCap(1));
    expect(f.delta.cache).toBe(cacheCap(1) - 150);
    expect(f.warnings).toContain("cache_full");
  });

  it("from low Uptime, the kitchen and bench work only until the lights die", () => {
    // 16 Uptime at 8/h: two lit hours out of eight.
    const work: Workforce = { ...none, cooks: 1, tinkerers: 1, forks: 2, cacheStorages: 1, workshops: 1 };
    const f = forecast({ ...fresh, uptime: 16 }, work);
    expect(f.delta).toEqual({ cache: 2 * 6 - 8 * 2, uptime: -16, payload: 2 * 2 });
    expect(f.blackout).toBe(true);
    expect(f.warnings).toEqual([]);
  });

  it("a full rack in the dark is not wasted work", () => {
    const work: Workforce = { ...none, tinkerers: 1, forks: 1, workshops: 1 };
    const f = forecast({ ...fresh, uptime: 0, payload: 30 }, work);
    expect(f.delta.payload).toBe(0);
    expect(f.warnings).toEqual([]);
  });

  it("stops at the rack cap and warns", () => {
    const work: Workforce = { ...none, tinkerers: 2, forks: 2, workshops: 1 };
    const f = forecast({ ...fresh, payload: 25 }, work);
    expect(f.payload).toBe(RATES.payloadCapPerWorkshop);
    expect(f.warnings).toEqual(["payload_full"]);
  });
});
