import { describe, expect, it } from "vitest";

import { AWAY_MIN_HOURS, awayReport, formatHours } from "@/lib/economy/away";

const base = {
  before: { cache: 40, uptime: 80, payload: 0 },
  after: { cache: 52, uptime: 100, payload: 0, starved: false, blackout: false },
  bytesIn: 7,
  cooks: 1,
  engineers: 1,
  crewMood: "content" as const,
};

describe("awayReport", () => {
  it("is null for a quick refresh", () => {
    expect(awayReport({ ...base, hours: AWAY_MIN_HOURS - 0.01 })).toBeNull();
  });

  it("tells the story of a good shift", () => {
    const r = awayReport({ ...base, hours: 6.25 })!;
    expect(r.headline).toBe("You were gone 6h 15m.");
    expect(r.lines).toEqual([
      "7 B came in from the feed and the packets.",
      "The cook kept up: pantry +12 meals.",
      "Generator crew held the charge: +20%.",
      "Crew mood on your return: content.",
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("warns on blackout and hunger, and blames the empty shifts", () => {
    const r = awayReport({
      hours: 30,
      before: { cache: 10, uptime: 40, payload: 0 },
      after: { cache: 0, uptime: 0, payload: 0, starved: true, blackout: true },
      bytesIn: 0,
      cooks: 0,
      engineers: 0,
      crewMood: "bitter",
    })!;
    expect(r.lines[0]).toBe("Nothing came in from the feed.");
    expect(r.lines[1]).toBe("No cook on shift. The crew ate 10 meals from the shelf.");
    expect(r.lines[2]).toBe("Nobody on the generator. Charge -40%.");
    expect(r.warnings).toHaveLength(2);
  });

  it("mentions the bench only when someone is at it", () => {
    const lines = (tinkerers: number, payload: number) =>
      awayReport({ ...base, hours: 4, tinkerers, after: { ...base.after, payload } })!.lines;
    expect(lines(0, 0).some((l) => l.includes("bench"))).toBe(false);
    expect(lines(1, 8)).toContain("The bench packed +8 Payload.");
    expect(lines(1, 0)).toContain("The bench packed nothing. Racks full, or lights out.");
  });

  it("formats hours like a human", () => {
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(3)).toBe("3h");
    expect(formatHours(3.5)).toBe("3h 30m");
    expect(formatHours(72)).toBe("3 days");
  });
});
