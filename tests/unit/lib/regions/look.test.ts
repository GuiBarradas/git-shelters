import { describe, expect, it } from "vitest";

import { mapTones, palette } from "@/lib/palette";
import { REGIONS } from "@/lib/regions/catalog";
import { REGION_LOOK, regionHeight, toMap, toWorld } from "@/lib/regions/look";
import { reviewPins } from "@/lib/regions/review";

describe("map to world coordinates", () => {
  it("maps the corners and the centre of the 1000×600 map onto a 100×60 table", () => {
    expect(toWorld([0, 0])).toEqual([-50, -30]);
    expect(toWorld([1000, 0])).toEqual([50, -30]);
    expect(toWorld([0, 600])).toEqual([-50, 30]);
    expect(toWorld([1000, 600])).toEqual([50, 30]);
    expect(toWorld([500, 300])).toEqual([0, 0]);
  });

  it("inverts exactly for every polygon vertex and label", () => {
    for (const r of REGIONS) {
      for (const p of [...r.shape, r.label]) {
        const [x, y] = toMap(toWorld(p));
        expect(x).toBeCloseTo(p[0], 9);
        expect(y).toBeCloseTo(p[1], 9);
      }
    }
  });
});

describe("region look", () => {
  it("covers the seven regions with the brief's heights", () => {
    expect(Object.keys(REGION_LOOK).sort()).toEqual(REGIONS.map((r) => r.id).sort());
    expect(Object.fromEntries(REGIONS.map((r) => [r.id, regionHeight(r.id)]))).toEqual({
      the_outage: 1.2, the_static: 1.7, the_heap: 0.9, the_cluster: 1.5, the_mainframe: 1.1, the_sandbox: 1.3, the_edge: 2.2,
    });
    expect(regionHeight("nowhere")).toBe(0);
  });

  it("uses named palette tokens only", () => {
    const tokens = new Set<string>([...Object.values(palette), ...Object.values(mapTones)]);
    for (const [id, look] of Object.entries(REGION_LOOK)) {
      for (const c of [look.top, look.side, ...look.lights.flatMap((l) => l.colors)]) expect(tokens.has(c), `${id}: ${c}`).toBe(true);
      expect(look.props.length, id).toBeGreaterThan(0);
    }
  });
});

describe("review pins", () => {
  it("are thirty synthetic Outage pins in the MapPin shape", () => {
    const pins = reviewPins();
    expect(pins).toHaveLength(30);
    for (const p of pins) {
      expect(p.login).toMatch(/^synthetic-\d{2}$/);
      expect(Object.keys(p).sort()).toEqual(["activity", "at", "badges", "bytes", "login", "memberSince", "region", "rooms"]);
    }
    expect(pins.some((p) => p.activity === null)).toBe(true);
  });
});
