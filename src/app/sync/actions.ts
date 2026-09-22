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
export async function syncBytes() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const githubLogin =
    typeof user.user_metadata?.user_name === "string" ? user.user_metadata.user_name : null;

  try {
    await syncUser(createAdminClient(), { id: user.id, github_login: githubLogin });
  } catch (err) {
    Sentry.captureException(err, { tags: { user_id: user.id, entrypoint: "sync_button" } });
  }

  revalidatePath("/");
}
