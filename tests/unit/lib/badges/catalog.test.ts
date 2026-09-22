import { describe, expect, it } from "vitest";

import { type BadgeContext, BADGES, describeBadges, dueBadges } from "@/lib/badges/catalog";

const fresh: BadgeContext = {
  createdAt: "2026-09-22T10:00:00Z",
  commitsCounted: 0,
  rooms: 0,
  forks: 1,
  traits: ["senior"],
  region: "the_outage",
  now: new Date("2026-09-22T12:00:00Z"),
};

describe("badges", () => {
  it("has unique ids and a blurb for each", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    for (const b of BADGES) expect(b.blurb.length).toBeGreaterThan(0);
  });

  it("a fresh alpha bunker earns the alpha and region badges, nothing else", () => {
    expect(dueBadges(fresh, new Set()).map((b) => b.id)).toEqual(["alpha_maintainer", "of_the_outage"]);
  });

  it("achievements follow the state, and held badges are not due again", () => {
    const busy = { ...fresh, commitsCounted: 1000, rooms: 2, forks: 10, traits: ["vibe_coder", "senior"] };
    const due = dueBadges(busy, new Set(["alpha_maintainer", "of_the_outage"])).map((b) => b.id);
    expect(due).toEqual(["first_commit", "hello_world", "the_real_mvp", "big_o_of_one", "the_vibe_coder"]);
  });

  it("describes only known badges, in catalog order, secrets included once earned", () => {
    const shown = describeBadges(["the_vibe_coder", "unknown", "first_commit"]);
    expect(shown.map((b) => b.id)).toEqual(["first_commit", "the_vibe_coder"]);
  });
});
