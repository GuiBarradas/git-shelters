"use server";

import { revalidatePath } from "next/cache";

import { applyDailyCap } from "@/lib/anti-cheese/apply-daily-cap";
import { fetchDailyCapRemaining } from "@/lib/anti-cheese/daily-cap-query";
import { rejectBotEvents } from "@/lib/anti-cheese/reject-bot-events";
import { eventsToCredits, fetchUserEvents } from "@/lib/github/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * On-demand byte sync triggered by the user pressing "Sync".
 *
 * Shares the credit-mapping path with the Vercel Cron handler — both go
 * through `eventsToCredits` and a single `credit_bytes_tx_batch` RPC per
 * user (per ADR 0005). This guarantees the on-demand button and the
 * background cron cannot diverge in what they consider a creditable event.
 *
 * Anti-cheese (ADR 0006):
 *   - rejectBotEvents strips automation accounts before mapping.
 *   - applyDailyCap caps cumulative github_sync bytes at 100/day per user.
 *
 * No-ops:
 *   - Anonymous caller → returns silently.
 *   - Authenticated but no GitHub login on the OAuth profile → returns.
 *   - User has no creditable events → returns without an RPC call.
 */
export async function syncBytes() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const githubLogin =
    typeof user.user_metadata?.user_name === "string"
      ? user.user_metadata.user_name
      : null;
  if (!githubLogin) return;

  const events = rejectBotEvents(await fetchUserEvents(githubLogin));
  const proposed = eventsToCredits(events);
  if (proposed.length === 0) {
    revalidatePath("/");
    return;
  }

  const admin = createAdminClient();
  const capRemaining = await fetchDailyCapRemaining(admin, user.id);
  const credits = applyDailyCap(proposed, capRemaining);

  if (credits.length === 0) {
    revalidatePath("/");
    return;
  }

  await admin.rpc("credit_bytes_tx_batch", {
    p_user_id: user.id,
    p_credits: credits,
  });

  revalidatePath("/");
}
