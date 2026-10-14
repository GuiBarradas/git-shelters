// @vitest-environment node
import { describe, expect, it } from "vitest";

import { clampTarget, frameView, MAX_DISTANCE, MIN_DISTANCE, orbitOffset } from "@/components/map/scene/framing";
import { plateauGeometry } from "@/components/map/scene/plateau";
import { inside, REGION_BY_ID, REGIONS } from "@/lib/regions/catalog";
import { regionHeight, toMap, toWorld } from "@/lib/regions/look";

describe("map framing", () => {
  it("frames the whole map from its centre in landscape", () => {
    for (const aspect of [1440 / 900, 1, 21 / 9]) {
      const view = frameView(aspect);
      expect(view.target).toEqual([0, 0, 0]);
      expect(view.distance).toBeGreaterThanOrEqual(MIN_DISTANCE);
      expect(view.distance).toBeLessThanOrEqual(MAX_DISTANCE);
    }
    // A narrower landscape screen needs to stand further back.
    expect(frameView(1).distance).toBeGreaterThan(frameView(16 / 9).distance);
  });

  it("centres The Outage in portrait", () => {
    const view = frameView(390 / 844);
    const [x, , z] = view.target;
    expect(inside(toMap([x, z]), REGION_BY_ID.get("the_outage")!.shape)).toBe(true);
    expect(view.distance).toBeLessThanOrEqual(MAX_DISTANCE);
  });

  it("keeps the target over the table", () => {
    expect(clampTarget(0, 0)).toEqual([0, 0]);
    expect(clampTarget(80, -45)).toEqual([50, -30]);
    expect(clampTarget(-51, 31)).toEqual([-50, 30]);
  });

  it("orbits at the asked distance", () => {
    const [x, y, z] = orbitOffset(100, 0.85, 0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(100, 9);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
  });
});

describe("plateau geometry", () => {
  it("stands each plateau on the floor at its height, over its own map footprint", () => {
    for (const region of REGIONS) {
      const g = plateauGeometry(region);
      g.computeBoundingBox();
      const box = g.boundingBox!;
      expect(box.min.y, region.id).toBeCloseTo(0, 6);
      expect(box.max.y, region.id).toBeCloseTo(regionHeight(region.id), 6);
      // Same world z as the map polygon: north stays -z, not mirrored.
      const zs = region.shape.map((p) => toWorld(p)[1]);
      expect(box.min.z, region.id).toBeCloseTo(Math.min(...zs), 6);
      expect(box.max.z, region.id).toBeCloseTo(Math.max(...zs), 6);
      g.dispose();
    }
  });

  it("splits caps and walls into two material groups", () => {
    const g = plateauGeometry(REGIONS[0]!);
    expect(new Set(g.groups.map((group) => group.materialIndex))).toEqual(new Set([0, 1]));
    g.dispose();
  });

  it("keeps the vertex order of a corner: a polygon vertex sits on the top at its world x, z", () => {
    const outage = REGION_BY_ID.get("the_outage")!;
    const [x, z] = toWorld(outage.shape[0]!);
    const g = plateauGeometry(outage);
    const pos = g.getAttribute("position");
    let found = false;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i) - x) < 1e-6 && Math.abs(pos.getZ(i) - z) < 1e-6 && Math.abs(pos.getY(i) - regionHeight(outage.id)) < 1e-6) found = true;
    }
    expect(found).toBe(true);
    g.dispose();
  });
});
