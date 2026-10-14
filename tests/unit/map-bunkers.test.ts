// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  activityDays, activityLabel, beamHeight, bunkerGlows, mapBunkers, OWN_BEAM, OWN_POOL, poolRadius,
} from "@/components/map/scene/bunker";
import type { MapPin } from "@/lib/api/world-map";
import { mapTones, palette } from "@/lib/palette";
import { regionHeight, toWorld } from "@/lib/regions/look";
import { activityFromCreditAt } from "@/lib/visuals/server";

const pin = (login: string, activity: number | null): MapPin => ({
  login, region: "the_outage", at: [300, 300], bytes: 10, rooms: 1, badges: 0, memberSince: "2026-05-01T00:00:00Z", activity,
});

describe("map bunker light", () => {
  it("grows the beam and pool with activity, and leaves idle or unknown bunkers unlit", () => {
    expect(beamHeight(1, false)).toBeCloseTo(7, 9);
    expect(beamHeight(0.2, false)).toBeCloseTo(2.6, 9);
    expect(poolRadius(1, false)).toBeCloseTo(5.2, 9);
    for (const a of [0, null]) {
      expect(beamHeight(a, false)).toBe(0);
      expect(poolRadius(a, false)).toBe(0);
    }
  });

  it("gives the visitor's own bunker its tall amber mark whatever the activity", () => {
    for (const a of [1, 0, null]) {
      expect(beamHeight(a, true)).toBe(OWN_BEAM);
      expect(poolRadius(a, true)).toBe(OWN_POOL);
    }
  });

  it("burns a lamp for activity, an ember after a week, and nothing when unknown", () => {
    const [lit, idle, unknown, own] = mapBunkers([pin("lit", 0.7), pin("idle", 0), pin("unknown", null), pin("Me", null)], "me");
    expect(bunkerGlows([lit!])).toMatchObject([{ color: palette.lampWarm, mode: "breathe" }]);
    expect(bunkerGlows([idle!])).toMatchObject([{ color: mapTones.ember, mode: "slow" }]);
    expect(bunkerGlows([unknown!])).toEqual([]);
    expect(own!.mine).toBe(true);
    expect(bunkerGlows([own!])).toMatchObject([{ color: palette.amber, mode: "own" }]);
  });

  it("stands each bunker on its plateau at the pin's world position, with a stable phase", () => {
    const [b] = mapBunkers([pin("octocat", 1)], null);
    const [x, z] = toWorld([300, 300]);
    expect(b!.at).toEqual([x, regionHeight("the_outage"), z]);
    expect(b!.mine).toBe(false);
    expect(mapBunkers([pin("octocat", 1)], null)[0]!.phase).toBe(b!.phase);
  });
});

describe("map bunker activity label", () => {
  it("reads back the day count of every activity bucket", () => {
    const now = Date.UTC(2026, 9, 14, 12);
    for (let days = 0; days <= 10; days++) {
      const a = activityFromCreditAt(new Date(now - days * 86_400_000).toISOString(), now);
      expect(activityDays(a), `${days} days`).toBe(days > 7 ? Infinity : days);
    }
    expect(activityDays(null)).toBeNull();
  });

  it("speaks of credited activity, never of a push, and says nothing when unknown", () => {
    expect(activityLabel(1)).toBe("active today");
    expect(activityLabel(0.85)).toBe("active yesterday");
    expect(activityLabel(0.6)).toBe("active 3 days ago");
    expect(activityLabel(0)).toBe("quiet for over a week");
    expect(activityLabel(null)).toBeNull();
    for (const a of [1, 0.85, 0.5, 0]) expect(activityLabel(a)).not.toMatch(/push/i);
  });
});
