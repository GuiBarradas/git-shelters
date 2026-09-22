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
  /** Unique event id from the GitHub API. */
  id?: string;
  type: string;
  /** ISO 8601 timestamp in UTC. */
  created_at: string;
  /**
   * Account that triggered the event. For PushEvents authored by an
   * automation account (Dependabot, etc.), `actor.login` matches a bot
   * pattern and the anti-cheese layer rejects it.
   */
  actor?: {
    id?: number;
    login?: string;
  };
  payload?: {
    /**
     * On PushEvent: stable id for the push. Used as the dedup key in
     * byte_transactions.source_ref so cron retries do not double-credit.
     */
    push_id?: number;
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
 * Fetches one page of public events for a GitHub login, newest first.
 *
 * GitHub serves at most 300 events / 90 days on this endpoint, in pages
 * of up to 100, so three pages is the whole history it will ever give.
 * With `GITHUB_TOKEN` set the limit is 5000 req/h; without, 60/h per IP.
 *
 * Throws on any failure. Callers must not confuse "GitHub is down" with
 * "no activity": the backfill in particular would otherwise mark itself
 * done with zero events and set no cursor.
 */
export async function fetchUserEvents(login: string, page = 1): Promise<GitHubEvent[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`,
    { headers, next: { revalidate: 60 } },
  );

  if (!response.ok) {
    throw new Error(`GitHub events fetch failed for ${login}: ${response.status}`);
  }

  return (await response.json()) as GitHubEvent[];
}

/** Keeps events whose id is numerically greater than the cursor (null = all). */
export function eventsNewerThan(events: GitHubEvent[], cursor: string | null): GitHubEvent[] {
  if (cursor === null) return events;
  const c = BigInt(cursor);
  return events.filter((event) => isNumericId(event.id) && BigInt(event.id) > c);
}

/** Largest numeric event id in the list, or null. Event ids are monotonic. */
export function maxEventId(events: GitHubEvent[]): string | null {
  let max: bigint | null = null;
  for (const event of events) {
    if (!isNumericId(event.id)) continue;
    const id = BigInt(event.id);
    if (max === null || id > max) max = id;
  }
  return max === null ? null : max.toString();
}

/** Keeps events created within the last `days` days of `now`. */
export function eventsWithinDays(events: GitHubEvent[], now: Date, days: number): GitHubEvent[] {
  const since = now.getTime() - days * 86_400_000;
  return events.filter((event) => Date.parse(event.created_at) >= since);
}

function isNumericId(id: unknown): id is string {
  return typeof id === "string" && /^\d+$/.test(id);
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
 * Pure mapper: a list of GitHub events → credit descriptors ready to feed
 * into `credit_bytes_tx_batch`.
 *
 * Filters out non-PushEvents and entries we cannot dedup (no usable
 * source_ref). `source` is the ADR 0004 taxonomy slot: 'github_sync' for
 * the incremental cron/button path, 'backfill' for the one-time 30-day
 * import. Same push, different source → different ledger key, which is
 * why the cursor (not the unique constraint) keeps the two paths apart.
 */
export function eventsToCredits(
  events: GitHubEvent[],
  source: "github_sync" | "backfill" = "github_sync",
): Array<{ delta: number; source: string; source_ref: string }> {
  const credits: Array<{ delta: number; source: string; source_ref: string }> = [];

  for (const event of events) {
    if (event.type !== "PushEvent") continue;

    const sourceRef = pushSourceRef(event);
    if (!sourceRef) continue;

    const delta = commitCountFromPayload(event);
    if (delta <= 0) continue;

    credits.push({ delta, source, source_ref: sourceRef });
  }

  return credits;
}

function pushSourceRef(event: GitHubEvent): string | null {
  const pushId = event.payload?.push_id;
  if (typeof pushId === "number") return `push:${pushId}`;
  if (typeof event.id === "string" && event.id.length > 0) {
    return `event:${event.id}`;
  }
  return null;
}

/**
 * Resolves how many commits a PushEvent represents, even when GitHub's
 * public events API trims the payload (which it often does for `/users/{u}
 * /events/public` — `commits` and `size` are removed for response size).
 *
 * Order of preference: explicit commits array > size field > 1 (lower bound,
 * since we know the push happened).
 */
export function commitCountFromPayload(event: GitHubEvent): number {
  const commits = event.payload?.commits;
  if (Array.isArray(commits)) return commits.length;

  const size = event.payload?.size;
  if (typeof size === "number") return size;

  return 1;
}
