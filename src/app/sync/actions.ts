"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { syncUser } from "@/lib/github/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * On-demand byte sync triggered by the user pressing "Sync".
 *
 * Same `syncUser` path as the Vercel Cron (ADR 0005): first call runs the
 * 30-day backfill, later calls credit only events past the cursor. GitHub
 * or ledger failures are reported, never surfaced as a broken page.
 */
export type SyncState = { tone: "idle" | "ok" | "warn"; message: string; at: number };

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
