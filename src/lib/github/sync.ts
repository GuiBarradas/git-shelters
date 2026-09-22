import type { SupabaseClient } from "@supabase/supabase-js";

import { applyDailyCap } from "@/lib/anti-cheese/apply-daily-cap";
import {
  fetchBackfillCapRemaining,
  fetchDailyCapRemaining,
} from "@/lib/anti-cheese/daily-cap-query";
import { rejectBotEvents } from "@/lib/anti-cheese/reject-bot-events";
import {
  eventsNewerThan,
  eventsToCredits,
  eventsWithinDays,
  fetchUserEvents,
  maxEventId,
  type GitHubEvent,
} from "@/lib/github/events";
import type { Database } from "@/lib/supabase/database.types";

/**
 * One GitHub → bytes sync for one user. The single code path behind the
 * cron (ADR 0005), the "Sync" button and the post-login trigger, so they
 * cannot disagree on what is creditable.
 *
 * First run (`backfill_status` pending/failed): the 30-day backfill.
 * Reads up to three pages (all GitHub keeps), credits pushes from the last
 * 30 days as `source = 'backfill'` under the lifetime BACKFILL_CAP, and
 * records the newest event id as the cursor.
 *
 * Later runs: incremental. Reads pages until one dips below the cursor,
 * credits only events newer than it as `source = 'github_sync'` under the
 * daily cap, and advances the cursor.
 *
 * Idempotency is still the ledger's unique constraint within each source;
 * the cursor is what keeps 'backfill' and 'github_sync' from crediting the
 * same push twice. Overlapping runs for the same user are fine.
 */

export const BACKFILL_DAYS = 30;
const MAX_PAGES = 3;
/** An in_progress backfill older than this is assumed dead and retried. */
const STALE_BACKFILL_MS = 10 * 60_000;

export type SyncResult =
  | { mode: "backfill" | "incremental"; credited: number }
  | { mode: "skipped"; reason: "in_progress" | "no_login" };

type SyncUser = { id: string; github_login: string | null };
type Admin = SupabaseClient<Database>;

export async function syncUser(
  admin: Admin,
  user: SyncUser,
  now: Date = new Date(),
): Promise<SyncResult> {
  if (!user.github_login) return { mode: "skipped", reason: "no_login" };
  const login = user.github_login;

  const { data: state } = await admin
    .from("github_sync_state")
    .select("backfill_status, backfill_at, last_event_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const status = state?.backfill_status ?? "pending";
  const startedAt = state?.backfill_at ? Date.parse(state.backfill_at) : 0;
  if (status === "in_progress" && now.getTime() - startedAt < STALE_BACKFILL_MS) {
    return { mode: "skipped", reason: "in_progress" };
  }

  return status === "done"
    ? incremental(admin, user.id, login, state?.last_event_id ?? null, now)
    : backfill(admin, user.id, login, now);
}

async function backfill(admin: Admin, userId: string, login: string, now: Date) {
  await setState(admin, userId, { backfill_status: "in_progress", backfill_at: now.toISOString() });

  try {
    const events = rejectBotEvents(await fetchPages(login, () => false));
    const recent = eventsWithinDays(events, now, BACKFILL_DAYS);

    // Accounts that synced before the cursor existed already hold some of
    // these pushes as github_sync rows. Skip those so the migration to
    // cursor-based sync does not pay them twice under a second source.
    const { data: already, error } = await admin
      .from("byte_transactions")
      .select("source_ref")
      .eq("user_id", userId)
      .eq("source", "github_sync");
    if (error) throw error;
    const seen = new Set(already.map((row) => row.source_ref));

    const credits = applyDailyCap(
      eventsToCredits(recent, "backfill").filter((c) => !seen.has(c.source_ref)),
      await fetchBackfillCapRemaining(admin, userId),
    );
    if (credits.length > 0) await creditBatch(admin, userId, credits);

    await setState(admin, userId, {
      backfill_status: "done",
      backfill_at: now.toISOString(),
      last_event_id: maxEventId(events),
      last_synced_at: now.toISOString(),
    });
    return { mode: "backfill" as const, credited: credits.length };
  } catch (err) {
    await setState(admin, userId, { backfill_status: "failed", backfill_at: now.toISOString() });
    throw err;
  }
}

async function incremental(
  admin: Admin,
  userId: string,
  login: string,
  cursor: string | null,
  now: Date,
) {
  // Stop paging as soon as a page reaches the cursor: everything after it
  // is already credited. With no cursor (legacy rows), one page is enough.
  const pages = await fetchPages(login, (page) =>
    cursor === null ? true : eventsNewerThan(page, cursor).length < page.length,
  );
  const fresh = rejectBotEvents(eventsNewerThan(pages, cursor));
  const credits = applyDailyCap(
    eventsToCredits(fresh, "github_sync"),
    await fetchDailyCapRemaining(admin, userId, now),
  );
  if (credits.length > 0) await creditBatch(admin, userId, credits);

  const newest = maxEventId(pages);
  await setState(admin, userId, {
    last_synced_at: now.toISOString(),
    ...(newest !== null && { last_event_id: newest }),
  });
  return { mode: "incremental" as const, credited: credits.length };
}

/** Reads pages newest-first until `done(page)` says so, the page is short, or MAX_PAGES. */
async function fetchPages(
  login: string,
  done: (page: GitHubEvent[]) => boolean,
): Promise<GitHubEvent[]> {
  const all: GitHubEvent[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const events = await fetchUserEvents(login, page);
    all.push(...events);
    if (events.length < 100 || done(events)) break;
  }
  return all;
}

async function creditBatch(
  admin: Admin,
  userId: string,
  credits: Array<{ delta: number; source: string; source_ref: string }>,
) {
  const { error } = await admin.rpc("credit_bytes_tx_batch", {
    p_user_id: userId,
    p_credits: credits,
  });
  if (error) throw error;
}

async function setState(
  admin: Admin,
  userId: string,
  patch: Partial<Database["public"]["Tables"]["github_sync_state"]["Insert"]>,
) {
  const { error } = await admin
    .from("github_sync_state")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}
