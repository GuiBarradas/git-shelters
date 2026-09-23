import { describe, expect, it } from "vitest";

import { inside, pinFor, REGIONS } from "@/lib/regions/catalog";

describe("regions", () => {
  it("has seven regions, one open, all with a label inside their shape", () => {
    expect(REGIONS).toHaveLength(7);
    expect(REGIONS.filter((r) => r.open).map((r) => r.id)).toEqual(["the_outage"]);
    for (const r of REGIONS) expect(inside(r.label, r.shape), r.id).toBe(true);
  });

  it("regions do not overlap at their labels", () => {
    for (const a of REGIONS) {
      for (const b of REGIONS) {
        if (a !== b) expect(inside(a.label, b.shape), `${a.id} label inside ${b.id}`).toBe(false);
      }
    }
  });

  it("pins are deterministic, case-insensitive, and land inside the region", () => {
    const outage = REGIONS[0]!;
    const logins = Array.from({ length: 200 }, (_, i) => `maintainer-${i}`);
    for (const login of logins) {
      const p = pinFor(login, outage);
      expect(pinFor(login, outage)).toEqual(p);
      expect(pinFor(login.toUpperCase(), outage)).toEqual(p);
      expect(inside(p, outage.shape), login).toBe(true);
    }
    // Different logins spread out: no more than a few collisions in 200.
    const spots = new Set(logins.map((l) => pinFor(l, outage).join(",")));
    expect(spots.size).toBeGreaterThan(190);
  });
});
