"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { ONCE, track } from "@/lib/analytics/track";
import { parseOption } from "@/lib/events/option";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves today's Daily Event with choice "a" or "b".
 *
 * The RPC picks the event itself (same `pick_daily_event` the page used
 * to render it), logs the outcome and credits bytes through the ledger.
 * `already_resolved_today` is an expected race (two tabs, a stale page)
 * and is not reported. `daily_event_pool_empty` is a P1 per the design:
 * it means the catalog has no active rows and must page someone.
 */
export async function resolveDailyEvent(formData: FormData) {
  const choice = formData.get("choice");
  if (choice !== "a" && choice !== "b") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_daily_event", {
    p_user_id: user.id,
    p_choice: choice,
  });

  if (error && !error.message.includes("already_resolved_today")) {
    Sentry.captureException(error, { extra: { choice } });
  }

  if (!error) {
    const outcome = parseOption(data);
    const { data: eventId } = await admin.rpc("pick_daily_event", { p_user_id: user.id });
    if (outcome && eventId) {
      await track(
        admin,
        user.id,
        "first_event_resolved",
        { event_id: eventId, choice, time_since_signup_ms: Date.now() - Date.parse(user.created_at) },
        ONCE,
      );
      await track(admin, user.id, "daily_event_resolved", {
        event_id: eventId,
        choice,
        outcome_delta_bytes: outcome.bytes_delta,
      });
    }
  }

  revalidatePath("/");
}
