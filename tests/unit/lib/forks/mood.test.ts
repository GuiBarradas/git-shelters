import { describe, expect, it } from "vitest";

import { describeCrew, EVENT_LINES, eventEcho, eventShift, MOOD_LINES, moodFor, moodFromActivity, MOODS, pickLine, settleMood } from "@/lib/forks/mood";

const NOW = new Date("2026-09-22T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("fork mood", () => {
  it("follows the days since the last push", () => {
    expect(moodFromActivity(null, NOW)).toBe("content");
    expect(moodFromActivity(daysAgo(0), NOW)).toBe("happy");
    expect(moodFromActivity(daysAgo(2), NOW)).toBe("content");
    expect(moodFromActivity(daysAgo(3), NOW)).toBe("stressed");
    expect(moodFromActivity(daysAgo(6), NOW)).toBe("stressed");
    expect(moodFromActivity(daysAgo(7), NOW)).toBe("bitter");
    expect(moodFromActivity(daysAgo(40), NOW)).toBe("bitter");
  });

  it("shifts one step by trait and clamps at the ends", () => {
    expect(moodFor("content", "vibe_coder")).toBe("happy");
    expect(moodFor("content", "tenx")).toBe("stressed");
    expect(moodFor("content", "senior")).toBe("content");
    expect(moodFor("happy", "caffeinated")).toBe("happy");
    expect(moodFor("bitter", "imposter")).toBe("bitter");
  });

  it("every mood has lines and a crew description", () => {
    for (const mood of MOODS) {
      expect(MOOD_LINES[mood].length).toBeGreaterThan(0);
    }
    expect(describeCrew("happy", daysAgo(0), NOW)).toContain("pushed today");
    expect(describeCrew("bitter", daysAgo(9), NOW)).toContain("9 days since last push");
    expect(describeCrew("content", null, NOW)).toContain("no pushes");
  });

  it("today's packet lands on the mood, then the pantry", () => {
    const resolved = (bytes_delta: number) => ({ resolved: { outcome: { label: "", outcome_text: "", bytes_delta } } });
    expect(eventEcho(null)).toBeNull();
    expect(eventEcho({ resolved: null })).toBe("pending");
    expect(eventEcho(resolved(10))).toBe("good");
    expect(eventEcho(resolved(-5))).toBe("bad");
    expect(eventEcho(resolved(0))).toBe("flat");
    expect(eventShift("content", "good")).toBe("happy");
    expect(eventShift("content", "bad")).toBe("stressed");
    expect(eventShift("happy", "good")).toBe("happy");
    expect(eventShift("content", "pending")).toBe("content");
    expect(settleMood("content", { echo: "good", starving: true })).toBe("content");
    expect(settleMood("content", { echo: "bad", starving: true })).toBe("bitter");
    expect(describeCrew("happy", daysAgo(0), NOW, "good")).toContain("lifted by today's packet");
    expect(describeCrew("happy", daysAgo(0), NOW, "flat")).not.toContain("·");
  });

  it("pickLine talks about the packet when there is one", () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickLine(42, i, "content", "TRAIT", "pending")));
    expect([...seen].some((l) => EVENT_LINES.pending.includes(l))).toBe(true);
    expect(seen.has("TRAIT")).toBe(true);
  });

  it("pickLine is deterministic per seed and salt, and mixes trait and mood lines", () => {
    const a = pickLine(42, 1, "stressed", "TRAIT");
    expect(pickLine(42, 1, "stressed", "TRAIT")).toBe(a);
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickLine(42, i, "stressed", "TRAIT")));
    expect(seen.has("TRAIT")).toBe(true);
    expect([...seen].some((l) => MOOD_LINES.stressed.includes(l))).toBe(true);
  });
});
