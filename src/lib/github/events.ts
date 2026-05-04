/**
 * GitHub events parsing.
 *
 * Pure functions over GitHub event payloads, plus an I/O wrapper that fetches
 * them from the public API. The pure half is tested; the I/O half is a thin
 * wrapper validated at integration time.
 */

/**
 * Minimal subset of GitHub's event shape that we read from.
 * Full reference: https://docs.github.com/rest/activity/events
 */
export type GitHubEvent = {
  type: string;
  /** ISO 8601 timestamp in UTC. */
  created_at: string;
  payload?: {
    /**
     * On PushEvent: the new commits introduced by the push. The public
     * events API often omits this for size reasons — fall back to `size`.
     */
    commits?: Array<{ sha: string; message: string }>;
    /** On PushEvent: number of new commits. Sometimes the only count we get. */
    size?: number;
  };
};

/**
 * Counts commits authored today (UTC) from a list of GitHub events.
 *
 * Pure: no I/O, no clock read. The caller passes `now` so tests can pin
 * it. Today is defined as the UTC calendar date of `now` — a player in
 * São Paulo on 2026-05-04T22:00 BRT is still on 2026-05-05 UTC, which
 * is acceptable for v1 (treat the GitHub clock as the truth).
 */
/**
 * Fetches public events for a GitHub login.
 *
 * Uses the unauthenticated REST API (rate limit: 60/h per IP). Good enough
 * for the spike — when sync becomes a real cron job, this should switch to
 * a per-user authenticated call (5000/h per user).
 *
 * Cached at the Next.js fetch layer for 60s, so repeated SSR renders within
 * a minute don't hammer the rate limit.
 *
 * Returns an empty array on any error — the caller treats "no events" and
 * "fetch failed" the same: nothing to credit, no fail-state UX.
 */
export async function fetchUserEvents(login: string): Promise<GitHubEvent[]> {
  try {
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(login)}/events/public`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as GitHubEvent[];
  } catch {
    return [];
  }
}

export function countCommitsToday(events: GitHubEvent[], now: Date): number {
  // ISO 8601 dates start with `YYYY-MM-DD`. Both `created_at` (from GitHub)
  // and `now.toISOString()` are UTC, so a prefix match yields the UTC day.
  const todayPrefix = now.toISOString().slice(0, 10);

  return events
    .filter(
      (event) =>
        event.type === "PushEvent" &&
        event.created_at.startsWith(todayPrefix),
    )
    .reduce((sum, event) => sum + commitCountFromPayload(event), 0);
}

/**
 * Resolves how many commits a PushEvent represents, even when GitHub's
 * public events API trims the payload (which it often does for `/users/{u}
 * /events/public` — `commits` and `size` are removed for response size).
 *
 * Order of preference: explicit commits array > size field > 1 (lower bound,
 * since we know the push happened).
 */
function commitCountFromPayload(event: GitHubEvent): number {
  const commits = event.payload?.commits;
  if (Array.isArray(commits)) return commits.length;

  const size = event.payload?.size;
  if (typeof size === "number") return size;

  return 1;
}
