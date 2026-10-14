import { describe, expect, it } from "vitest";

import { getWorldMap } from "@/lib/api/world-map";

/**
 * ADR 0001 leak check for the world map against real data. Reads existing
 * rows only: no fixture user, no hooks, no writes.
 */

const FORBIDDEN = ["email", "id", "github_id", "deleted_at", "last_seen_at", "user_id", "byte_transactions", "created_at"];

describe("world map read-only", () => {
  it("returns whitelisted pins with activity in 0..1 or null", async () => {
    const pins = await getWorldMap();
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) {
      expect(Object.keys(pin).sort()).toEqual(["activity", "at", "badges", "bytes", "login", "memberSince", "region", "rooms"]);
      if (pin.activity !== null) expect(pin.activity).toBeGreaterThanOrEqual(0);
      if (pin.activity !== null) expect(pin.activity).toBeLessThanOrEqual(1);
    }
    const json = JSON.stringify(pins);
    for (const field of FORBIDDEN) expect(json, `field '${field}' leaked`).not.toContain(`"${field}"`);
    expect(json).not.toContain("@");
  });
});
