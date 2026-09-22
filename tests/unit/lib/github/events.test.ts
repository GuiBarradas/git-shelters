import { describe, expect, it } from "vitest";

import {
  countCommitsToday,
  eventsNewerThan,
  eventsToCredits,
  eventsWithinDays,
  maxEventId,
  type GitHubEvent,
} from "@/lib/github/events";

const FIXED_NOW = new Date("2026-05-04T15:30:00Z");

describe("countCommitsToday", () => {
  it("returns 0 for an empty event list", () => {
    expect(countCommitsToday([], FIXED_NOW)).toBe(0);
  });

  it("counts commits from a PushEvent that happened today", () => {
    const events: GitHubEvent[] = [
      {
        type: "PushEvent",
        created_at: "2026-05-04T10:00:00Z",
        payload: {
          commits: [
            { sha: "a1", message: "init" },
            { sha: "a2", message: "fix" },
          ],
        },
      },
    ];

    expect(countCommitsToday(events, FIXED_NOW)).toBe(2);
  });

  it("ignores non-PushEvent types", () => {
    const events: GitHubEvent[] = [
      {
        type: "IssuesEvent",
        created_at: "2026-05-04T09:00:00Z",
        payload: {},
      },
      {
        type: "WatchEvent",
        created_at: "2026-05-04T11:00:00Z",
        payload: {},
      },
      {
        type: "PullRequestEvent",
        created_at: "2026-05-04T12:00:00Z",
        payload: {},
      },
    ];

    expect(countCommitsToday(events, FIXED_NOW)).toBe(0);
  });

  it("ignores PushEvents that happened on other UTC days", () => {
    const events: GitHubEvent[] = [
      {
        type: "PushEvent",
        created_at: "2026-05-03T23:00:00Z",
        payload: { commits: [{ sha: "x1", message: "yesterday" }] },
      },
      {
        type: "PushEvent",
        created_at: "2026-05-05T01:00:00Z",
        payload: { commits: [{ sha: "y1", message: "tomorrow" }] },
      },
    ];

    expect(countCommitsToday(events, FIXED_NOW)).toBe(0);
  });

  it("sums commits across multiple PushEvents on the same day", () => {
    const events: GitHubEvent[] = [
      {
        type: "PushEvent",
        created_at: "2026-05-04T08:00:00Z",
        payload: { commits: [{ sha: "a", message: "" }] },
      },
      {
        type: "PushEvent",
        created_at: "2026-05-04T14:00:00Z",
        payload: {
          commits: [
            { sha: "b", message: "" },
            { sha: "c", message: "" },
            { sha: "d", message: "" },
          ],
        },
      },
    ];

    expect(countCommitsToday(events, FIXED_NOW)).toBe(4);
  });

  it("falls back to `size` when payload has no commits array", () => {
    const events: GitHubEvent[] = [
      {
        type: "PushEvent",
        created_at: "2026-05-04T10:00:00Z",
        payload: { size: 3 },
      },
    ];

    expect(countCommitsToday(events, FIXED_NOW)).toBe(3);
  });

  it("falls back to 1 per PushEvent when payload has neither commits nor size", () => {
    // This is the real-world case from `/users/{user}/events/public`:
    // GitHub's response often omits commits and size to keep the payload small.
    // We know a push happened — count it as at least 1 unit of activity.
    const events: GitHubEvent[] = [
      {
        type: "PushEvent",
        created_at: "2026-05-04T10:00:00Z",
        payload: { ref: "refs/heads/main", head: "abc", before: "def" } as never,
      },
      {
        type: "PushEvent",
        created_at: "2026-05-04T11:00:00Z",
      },
    ];

    expect(countCommitsToday(events, FIXED_NOW)).toBe(2);
  });

  it("prefers commits.length over size when both are present", () => {
    const events: GitHubEvent[] = [
      {
        type: "PushEvent",
        created_at: "2026-05-04T10:00:00Z",
        payload: {
          commits: [
            { sha: "a", message: "" },
            { sha: "b", message: "" },
          ],
          size: 99, // intentionally wrong — commits is the source of truth
        },
      },
    ];

    expect(countCommitsToday(events, FIXED_NOW)).toBe(2);
  });
});

describe("cursor helpers", () => {
  const push = (id: string, created_at: string, push_id?: number): GitHubEvent => ({
    id,
    type: "PushEvent",
    created_at,
    payload: push_id === undefined ? { size: 1 } : { push_id, size: 1 },
  });

  it("eventsNewerThan compares ids numerically, not lexically", () => {
    const events = [push("100", "2026-05-04T10:00:00Z"), push("99", "2026-05-04T09:00:00Z")];
    // "99" > "100" as strings; as numbers only 100 is newer.
    expect(eventsNewerThan(events, "99").map((e) => e.id)).toEqual(["100"]);
    expect(eventsNewerThan(events, "100")).toEqual([]);
  });

  it("eventsNewerThan returns everything when there is no cursor", () => {
    const events = [push("2", "2026-05-04T10:00:00Z"), push("1", "2026-05-04T09:00:00Z")];
    expect(eventsNewerThan(events, null)).toEqual(events);
  });

  it("eventsNewerThan drops events without a numeric id", () => {
    const events = [push("5", "2026-05-04T10:00:00Z"), { type: "PushEvent", created_at: "2026-05-04T10:00:00Z" }];
    expect(eventsNewerThan(events, "1").map((e) => e.id)).toEqual(["5"]);
  });

  it("maxEventId handles ids beyond Number.MAX_SAFE_INTEGER", () => {
    const events = [push("9007199254740993", "x"), push("9007199254740992", "x")];
    expect(maxEventId(events)).toBe("9007199254740993");
    expect(maxEventId([])).toBeNull();
  });

  it("eventsWithinDays keeps the boundary and drops older", () => {
    const now = new Date("2026-06-03T12:00:00Z");
    const events = [
      push("3", "2026-06-03T11:00:00Z"),
      push("2", "2026-05-04T12:00:00Z"), // exactly 30 days
      push("1", "2026-05-04T11:59:59Z"), // 30 days + 1s
    ];
    expect(eventsWithinDays(events, now, 30).map((e) => e.id)).toEqual(["3", "2"]);
  });

  it("eventsToCredits tags the requested source", () => {
    const events = [push("1", "2026-05-04T10:00:00Z", 42)];
    expect(eventsToCredits(events, "backfill")).toEqual([
      { delta: 1, source: "backfill", source_ref: "push:42" },
    ]);
    expect(eventsToCredits(events)[0]?.source).toBe("github_sync");
  });
});
