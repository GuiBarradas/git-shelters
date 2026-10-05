"use server";

import * as Sentry from "@sentry/nextjs";

import { INTRO_OUTCOMES, ONCE, track, type IntroOutcome } from "@/lib/analytics/track";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** The player booted the intro: never show it again. Also the intro_started funnel step. */
export async function markIntroSeen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ intro_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("intro_seen_at", null);
  if (error) Sentry.captureException(error, { tags: { user_id: user.id, entrypoint: "intro" } });

  await track(admin, user.id, "intro_started", {}, ONCE);

  // Do not refresh the current page: its intro is still playing.
}

/** The intro reached its end or was skipped. Analytics only; intro_seen_at is set at boot. */
export async function finishIntro(outcome: IntroOutcome) {
  // Server Actions are public endpoints: the type is not a guarantee.
  if (!(INTRO_OUTCOMES as readonly unknown[]).includes(outcome)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await track(createAdminClient(), user.id, "intro_finished", { outcome }, ONCE);
}
