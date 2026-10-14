// @vitest-environment node
import { describe, expect, it } from "vitest";

import { mapBunkers, ownSonar } from "@/components/map/scene/bunker";
import { flightAt, PACKET_SLOTS, SLOT_PERIOD, talkers } from "@/components/map/scene/packet";
import { dust, mapProps } from "@/components/map/scene/props";
import type { MapPin } from "@/lib/api/world-map";
import { palette } from "@/lib/palette";
import { reviewPins } from "@/lib/regions/review";

const pin = (login: string, activity: number | null): MapPin => ({
  login, region: "the_outage", at: [200 + login.length * 20, 300], bytes: 0, rooms: 0, badges: 0, memberSince: "2026-05-01T00:00:00Z", activity,
});

describe("map packets", () => {
  it("only fly between Repos with credited activity", () => {
    const answering = talkers(mapBunkers([pin("a", 1), pin("bb", 0), pin("ccc", null), pin("dddd", 0.2)], null));
    expect(answering.map((b) => b.pin.login)).toEqual(["a", "dddd"]);
  });

  it("stay grounded with fewer than two talkers", () => {
    for (const pins of [[], [pin("solo", 1)]]) {
      for (let slot = 0; slot < PACKET_SLOTS; slot++) expect(flightAt(slot, 42, talkers(mapBunkers(pins, null)))).toBeNull();
    }
  });

  it("never route a packet back to its sender, and replay the same flights", () => {
    const two = talkers(mapBunkers([pin("a", 1), pin("bb", 1)], null));
    const many = talkers(mapBunkers(reviewPins(), null));
    for (const from of [two, many]) {
      for (let t = 0; t < 600; t += 0.7) {
        for (let slot = 0; slot < PACKET_SLOTS; slot++) {
          const f = flightAt(slot, t, from)!;
          expect(f.from).not.toEqual(f.to);
          expect(flightAt(slot, t, from)).toEqual(f);
          // The flight is the one its slot started this cycle, and it lands before the slot fires again.
          expect(t - f.start).toBeGreaterThan(-1e-9);
          expect(t - f.start).toBeLessThan(SLOT_PERIOD);
          expect(f.duration).toBeLessThan(SLOT_PERIOD);
        }
      }
    }
  });

  it("launch about one packet every 1.5 s across the slots", () => {
    const from = talkers(mapBunkers(reviewPins(), null));
    const starts = new Set<number>();
    for (let t = 0; t < 90; t += 0.25) for (let slot = 0; slot < PACKET_SLOTS; slot++) starts.add(Number(flightAt(slot, t, from)!.start.toFixed(3)));
    const sorted = [...starts].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((s, i) => s - sorted[i]!);
    for (const g of gaps) expect(g).toBeCloseTo(SLOT_PERIOD / PACKET_SLOTS, 6);
  });
});

describe("map rings and dust", () => {
  it("ping an amber sonar only off the visitor's own bunker", () => {
    expect(ownSonar(mapBunkers([pin("a", 1)], null))).toEqual([]);
    expect(ownSonar(mapBunkers([pin("a", null)], "A"))).toMatchObject([{ color: palette.amber, period: 3.4 }]);
  });

  it("sound a siren from one pylon in three and a ghost broadcast from one antenna in three", () => {
    const { rings } = mapProps([]);
    expect(rings.filter((r) => r.color === palette.fadedRed)).toHaveLength(3);
    expect(rings.filter((r) => r.color === palette.boneWhite)).toHaveLength(3);
  });

  it("drift seeded dust over the table and under the fog's ceiling", () => {
    const motes = dust();
    expect(motes).toHaveLength(420);
    expect(dust()).toEqual(motes);
    for (const m of motes) {
      expect(m.mode).toBe("dust");
      expect(Math.abs(m.at[0])).toBeLessThanOrEqual(55);
      expect(Math.abs(m.at[2])).toBeLessThanOrEqual(35);
    }
  });
});
