import { describe, expect, it } from "vitest";

import { countCommitsToday, type GitHubEvent } from "@/lib/github/events";

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
