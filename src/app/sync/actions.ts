"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { STALE_BACKFILL_MS, syncUser } from "@/lib/github/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * On-demand byte sync triggered by the user pressing "Sync".
 *
 * Same `syncUser` path as the scheduled sync (ADR 0005): first call runs the
 * 30-day backfill, later calls credit only events past the cursor. GitHub
 * or ledger failures are reported, never surfaced as a broken page.
 */
export type SyncState = { tone: "idle" | "ok" | "warn"; message: string; at: number };

export type BackfillStatus = "pending" | "in_progress" | "failed" | "done" | "unavailable";

/** Only expose the signed-in player's status, never the internal sync row. */
export async function getBackfillStatus(): Promise<BackfillStatus> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "unavailable";
    const { data, error } = await createAdminClient().from("github_sync_state")
      .select("backfill_status, backfill_at").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return "pending";
    if (data.backfill_status === "in_progress" &&
      (!data.backfill_at || !(Date.now() - Date.parse(data.backfill_at) < STALE_BACKFILL_MS))) {
      return "failed";
    }
    const status = data.backfill_status;
    return status === "pending" || status === "in_progress" || status === "failed" || status === "done"
      ? status : "unavailable";
  } catch (error) {
    Sentry.captureException(error, { tags: { entrypoint: "sync_status" } });
    return "unavailable";
  }
}

export async function syncBytes(): Promise<SyncState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tone: "warn", message: "not signed in", at: Date.now() };

  const githubLogin =
    typeof user.user_metadata?.user_name === "string" ? user.user_metadata.user_name : null;

  let state: SyncState;
  try {
    const result = await syncUser(createAdminClient(), { id: user.id, github_login: githubLogin });
    state =
      result.mode === "skipped"
        ? { tone: "warn", message: result.reason === "in_progress" ? "already syncing" : "no GitHub login", at: Date.now() }
        : result.mode === "backfill"
          ? { tone: "ok", message: "Initial sync complete. Public pushes from the last 30 days checked.", at: Date.now() }
        : result.credited > 0
          ? { tone: "ok", message: `+${result.credited} B credited`, at: Date.now() }
          : { tone: "ok", message: "up to date", at: Date.now() };
  } catch (err) {
    Sentry.captureException(err, { tags: { user_id: user.id, entrypoint: "sync_button" } });
    state = { tone: "warn", message: "sync failed, try again", at: Date.now() };
  }

  revalidatePath("/");
  return state;
}
