// @vitest-environment node
import { describe, expect, it } from "vitest";

import { insideXZ, mapProps, sampleIn } from "@/components/map/scene/props";
import { mapTones, palette } from "@/lib/palette";
import { REGION_BY_ID, REGIONS } from "@/lib/regions/catalog";
import { REGION_LOOK, toWorld } from "@/lib/regions/look";
import { reviewPins } from "@/lib/regions/review";

const bunkers = reviewPins().map((p) => toWorld(p.at));
const props = mapProps(bunkers);
const shapeOf = (id: string) => REGION_BY_ID.get(id)!.shape.map((p) => toWorld(p));
const recipe = (id: string, kind: string) => REGION_LOOK[id]!.props.find((p) => p.kind === kind)!.count;
/** Distance from a point to the nearest edge of a polygon. */
function edgeDistance([x, z]: [number, number], shape: [number, number][]): number {
  return Math.min(...shape.map(([ax, az], i) => {
    const [bx, bz] = shape[(i + 1) % shape.length]!;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    return Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az)));
  }));
}
const count = (color: string, list: { color: string }[]) => list.filter((s) => s.color === color).length;

describe("map region props", () => {
  it("are the same on every build", () => {
    expect(mapProps(bunkers)).toEqual(props);
  });

  it("follow the look.ts recipes", () => {
    expect(props.glows.filter((g) => g.color === mapTones.beaconRed)).toHaveLength(recipe("the_outage", "dead_pylon"));
    expect(count(mapTones.antenna, props.cylinders)).toBe(recipe("the_static", "antenna"));
    expect(count(mapTones.crt, props.boxes)).toBe(recipe("the_static", "buried_crt"));
    expect(count(mapTones.heapTop, props.cylinders)).toBe(recipe("the_mainframe", "tape_reel"));
    expect(count(mapTones.obelisk, props.boxes)).toBe(recipe("the_edge", "obelisk"));
    expect(props.cubes).toHaveLength(recipe("the_sandbox", "floating_cube"));
    const mainframe = shapeOf("the_mainframe");
    const cabinets = props.boxes.filter((b) => (b.color === palette.concreteTan || b.color === mapTones.beige) && insideXZ([b.at[0], b.at[2]], mainframe));
    expect(cabinets).toHaveLength(recipe("the_mainframe", "beige_cabinet"));
    const racks = props.boxes.filter((b) => b.color === mapTones.rack);
    expect(racks.length).toBeGreaterThan(20);
    // About one rack in ten lies on its side.
    const fallen = racks.filter((r) => r.rot[2] !== 0).length / racks.length;
    expect(fallen).toBeGreaterThan(0);
    expect(fallen).toBeLessThan(0.25);
  });

  it("never bury a Repo: pylons and rubble keep clear of every Outage bunker", () => {
    const outage = shapeOf("the_outage");
    const solids = props.boxes.filter((b) => insideXZ([b.at[0], b.at[2]], outage));
    expect(solids.length).toBeGreaterThan(70);
    for (const s of solids) {
      const nearest = Math.min(...bunkers.map(([x, z]) => Math.hypot(x - s.at[0], z - s.at[2])));
      expect(nearest).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("spread the seven pylons over a crowded Outage instead of stacking them", () => {
    const beacons = props.glows.filter((g) => g.color === mapTones.beaconRed);
    for (const [i, a] of beacons.entries()) {
      for (const b of beacons.slice(i + 1)) expect(Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2])).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("stand on the plateaus, and only the Heap's mounds spill a little past their rim", () => {
    const shapes = REGIONS.map((r) => r.shape.map((p) => toWorld(p)));
    const heap = shapeOf("the_heap");
    for (const s of [...props.boxes, ...props.cylinders, ...props.glows, ...props.cubes]) {
      const [x, , z] = s.at;
      if (shapes.some((shape) => insideXZ([x, z], shape))) continue;
      // A heap box off the plateau overhangs the Heap's rim by less than a unit.
      expect(edgeDistance([x, z], heap), `${x},${z}`).toBeLessThan(1);
    }
  });

  it("use palette tokens and their named tones only", () => {
    const tokens = new Set<string>([...Object.values(palette), ...Object.values(mapTones)]);
    for (const c of [...props.boxes, ...props.cylinders, ...props.glows].map((s) => s.color)) expect(tokens.has(c), c).toBe(true);
  });
});

describe("prop sampling", () => {
  it("keeps the padding inside the polygon and the distance from what it avoids", () => {
    const shape = shapeOf("the_static");
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const avoid: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const p = sampleIn(shape, rand, 1.2, avoid, 3);
      for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]] as const) expect(insideXZ([p[0] + dx, p[1] + dz], shape)).toBe(true);
      for (const a of avoid) expect(Math.hypot(a[0] - p[0], a[1] - p[1])).toBeGreaterThanOrEqual(3);
      avoid.push(p);
    }
  });
});
