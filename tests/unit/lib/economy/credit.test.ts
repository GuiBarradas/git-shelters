import { describe, expect, it } from "vitest";

import { creditBytes } from "@/lib/economy/credit";
import type { CreditRates } from "@/lib/economy/credit";

const NO_RATES: CreditRates = {
  passiveBytesPerMinute: 0,
  events: [],
};

describe("creditBytes", () => {
  it("credits 0 bytes when nothing happened (no time elapsed, no events)", () => {
    const t = new Date("2026-05-04T10:00:00Z");

    const result = creditBytes(t, t, NO_RATES);

    expect(result.totalBytes).toBe(0);
    expect(result.passiveBytes).toBe(0);
    expect(result.eventBytes).toBe(0);
    expect(result.events).toEqual([]);
  });

  it("credits passive bytes proportional to elapsed minutes", () => {
    const start = new Date("2026-05-04T10:00:00Z");
    const oneHourLater = new Date("2026-05-04T11:00:00Z");

    const result = creditBytes(start, oneHourLater, {
      passiveBytesPerMinute: 1,
      events: [],
    });

    expect(result.passiveBytes).toBe(60);
    expect(result.eventBytes).toBe(0);
    expect(result.totalBytes).toBe(60);
  });

  it("credits the sum of event bytes and passes events through", () => {
    const start = new Date("2026-05-04T10:00:00Z");
    const end = new Date("2026-05-04T10:30:00Z");

    const events = [
      { occurredAt: new Date("2026-05-04T10:05:00Z"), bytes: 1, sourceRef: "commit:abc" },
      { occurredAt: new Date("2026-05-04T10:20:00Z"), bytes: 4, sourceRef: "pr:42" },
    ];

    const result = creditBytes(start, end, {
      passiveBytesPerMinute: 0,
      events,
    });

    expect(result.eventBytes).toBe(5);
    expect(result.passiveBytes).toBe(0);
    expect(result.totalBytes).toBe(5);
    expect(result.events).toEqual(events);
  });

  it("combines passive and event bytes", () => {
    const start = new Date("2026-05-04T10:00:00Z");
    const end = new Date("2026-05-04T10:10:00Z");

    const result = creditBytes(start, end, {
      passiveBytesPerMinute: 2,
      events: [{ occurredAt: end, bytes: 7, sourceRef: "release:v1" }],
    });

    expect(result.passiveBytes).toBe(20);
    expect(result.eventBytes).toBe(7);
    expect(result.totalBytes).toBe(27);
  });

  it("never credits negative passive bytes when the clock is skewed (lastSeenAt > now)", () => {
    const future = new Date("2026-05-04T11:00:00Z");
    const past = new Date("2026-05-04T10:00:00Z");

    const result = creditBytes(future, past, {
      passiveBytesPerMinute: 1,
      events: [],
    });

    expect(result.passiveBytes).toBe(0);
    expect(result.totalBytes).toBe(0);
  });

  it("still credits events when the clock is skewed (events stand on their own occurredAt)", () => {
    const future = new Date("2026-05-04T11:00:00Z");
    const past = new Date("2026-05-04T10:00:00Z");

    const events = [
      { occurredAt: new Date("2026-05-04T10:30:00Z"), bytes: 3, sourceRef: "commit:xyz" },
    ];

    const result = creditBytes(future, past, {
      passiveBytesPerMinute: 1,
      events,
    });

    expect(result.passiveBytes).toBe(0);
    expect(result.eventBytes).toBe(3);
    expect(result.totalBytes).toBe(3);
    expect(result.events).toEqual(events);
  });
});
