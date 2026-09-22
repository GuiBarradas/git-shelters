import { describe, expect, it } from "vitest";

import { cacheCap, hoursBetween, payloadCap, RATES, simulate, type Workforce } from "@/lib/economy/tick";

const idle: Workforce = { cooks: 0, engineers: 0, tinkerers: 0, forks: 1, cacheStorages: 0, powerPlants: 0, workshops: 0 };
const crewed: Workforce = { cooks: 1, engineers: 1, tinkerers: 0, forks: 3, cacheStorages: 1, powerPlants: 1, workshops: 0 };

describe("simulate", () => {
  it("does nothing for zero hours", () => {
    expect(simulate({ cache: 40, uptime: 100, payload: 0 }, crewed, 0)).toEqual({
      cache: 40,
      uptime: 100,
      payload: 0,
      starved: false,
      blackout: false,
    });
  });

  it("is linear: one 3-hour tick equals three 1-hour ticks", () => {
    const once = simulate({ cache: 40, uptime: 100, payload: 0 }, crewed, 3);
    let step = { cache: 40, uptime: 100, payload: 0 };
    for (let i = 0; i < 3; i++) step = simulate(step, crewed, 1);
    expect(step.cache).toBe(once.cache);
    expect(step.uptime).toBe(once.uptime);
  });

  it("a lone survivor with no rooms eats the pantry and drains the charge", () => {
    const r = simulate({ cache: 40, uptime: 100, payload: 0 }, idle, 10);
    expect(r.cache).toBe(40 - 10 * RATES.eatPerHour);
    expect(r.uptime).toBe(100 - 10 * RATES.drainPerHour);
    expect(r.starved).toBe(false);
    expect(r.blackout).toBe(false);
  });

  it("a cook and an engineer keep three survivors fed and lit, up to the caps", () => {
    const r = simulate({ cache: 40, uptime: 100, payload: 0 }, crewed, 24);
    // 6 cooked - 3 eaten = +3/h → 40 + 72 = 112, under the 160 cap
    expect(r.cache).toBe(112);
    // 25 charged - 8 drain = +17/h, capped at 100
    expect(r.uptime).toBe(100);
    expect(r.starved).toBe(false);
  });

  it("flags starvation and blackout and clamps at zero", () => {
    const r = simulate({ cache: 5, uptime: 10, payload: 0 }, idle, 48);
    expect(r).toEqual({ cache: 0, uptime: 0, payload: 0, starved: true, blackout: true });
  });

  it("a tinkerer packs Payload while the lights are on, up to the rack", () => {
    const bench: Workforce = { ...crewed, tinkerers: 1, workshops: 1 };
    expect(simulate({ cache: 40, uptime: 100, payload: 0 }, bench, 5).payload).toBe(5 * RATES.tinkerPerHour);
    expect(simulate({ cache: 40, uptime: 100, payload: 0 }, bench, 100).payload).toBe(payloadCap(1));
    // Dark bench, no engineer: nothing packed, nothing lost.
    expect(simulate({ cache: 40, uptime: 0, payload: 7 }, { ...bench, engineers: 0 }, 5).payload).toBe(7);
    // No Workshop: nowhere to rack it.
    expect(simulate({ cache: 40, uptime: 100, payload: 0 }, { ...bench, workshops: 0 }, 5).payload).toBe(0);
  });

  it("kitchens do not cook in a blackout without an engineer", () => {
    const work: Workforce = { ...crewed, engineers: 0 };
    const dark = simulate({ cache: 10, uptime: 0, payload: 0 }, work, 2);
    expect(dark.cache).toBe(10 - 3 * 2); // eaten, nothing cooked
    const lit = simulate({ cache: 10, uptime: 50, payload: 0 }, work, 2);
    expect(lit.cache).toBe(10 + 6 * 2 - 3 * 2);
  });

  it("caps the window at a week away", () => {
    const week = simulate({ cache: 40, uptime: 100, payload: 0 }, crewed, RATES.maxHours);
    const month = simulate({ cache: 40, uptime: 100, payload: 0 }, crewed, RATES.maxHours * 4);
    expect(month).toEqual(week);
  });

  it("shelf space grows with storages", () => {
    expect(cacheCap(0)).toBe(40);
    expect(cacheCap(2)).toBe(280);
  });

  it("hoursBetween never goes negative", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    expect(hoursBetween("2026-09-22T09:00:00Z", now)).toBe(3);
    expect(hoursBetween("2026-09-22T13:00:00Z", now)).toBe(0);
  });
});
