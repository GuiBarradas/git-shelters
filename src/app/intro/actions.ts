"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** The player finished or skipped the intro: never show it again. */
export async function markIntroSeen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await createAdminClient()
    .from("users")
    .update({ intro_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("intro_seen_at", null);
  if (error) Sentry.captureException(error, { tags: { user_id: user.id, entrypoint: "intro" } });

  revalidatePath("/");
}
