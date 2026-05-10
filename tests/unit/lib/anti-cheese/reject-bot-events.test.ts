import { describe, expect, it } from "vitest";

import { rejectBotEvents } from "@/lib/anti-cheese/reject-bot-events";
import type { GitHubEvent } from "@/lib/github/events";

const human = (login: string, id = "evt-human"): GitHubEvent => ({
  id,
  type: "PushEvent",
  created_at: "2026-05-04T10:00:00Z",
  actor: { login },
  payload: { commits: [{ sha: "a1", message: "real work" }] },
});

const bot = (login: string, id = "evt-bot"): GitHubEvent => ({
  id,
  type: "PushEvent",
  created_at: "2026-05-04T10:00:00Z",
  actor: { login },
  payload: { commits: [{ sha: "b1", message: "Bump dep" }] },
});

describe("rejectBotEvents", () => {
  it("returns the empty list unchanged", () => {
    expect(rejectBotEvents([])).toEqual([]);
  });

  it("keeps events authored by humans", () => {
    const events = [human("GuiBarradas")];
    expect(rejectBotEvents(events)).toEqual(events);
  });

  it("strips events whose actor.login uses the [bot] suffix", () => {
    const events = [
      human("GuiBarradas"),
      bot("dependabot[bot]"),
      bot("any-other-name[bot]"),
    ];

    const result = rejectBotEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]?.actor?.login).toBe("GuiBarradas");
  });

  it("strips events whose actor.login matches a known automation account (case-insensitive)", () => {
    const events = [
      human("GuiBarradas"),
      bot("dependabot"),
      bot("Renovate"),
      bot("GITHUB-ACTIONS"),
      bot("snyk-bot"),
    ];

    const result = rejectBotEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]?.actor?.login).toBe("GuiBarradas");
  });

  it("keeps events whose login coincidentally contains a known bot substring", () => {
    // 'dependabot-fan-club' is not 'dependabot' — exact match only.
    const events = [human("dependabot-fan-club"), human("renovate-the-house")];
    expect(rejectBotEvents(events)).toEqual(events);
  });

  it("strips events with no actor.login as a precaution", () => {
    // An event arriving without a login is pathological. Better to drop
    // than to credit anonymously.
    const events: GitHubEvent[] = [
      { id: "evt-1", type: "PushEvent", created_at: "2026-05-04T10:00:00Z" },
      { id: "evt-2", type: "PushEvent", created_at: "2026-05-04T10:00:00Z", actor: {} },
    ];
    expect(rejectBotEvents(events)).toEqual([]);
  });
});
