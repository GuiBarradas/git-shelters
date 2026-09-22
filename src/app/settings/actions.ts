"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";

import { deleteAccount } from "@/lib/api/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletes the signed-in user's account (ADR 0007). The form must echo the
 * user's GitHub login back as confirmation; a mismatch is a silent no-op
 * so a stray submit cannot destroy an account. On success the session is
 * cleared and the user lands on the home page as a visitor.
 */
export async function deleteOwnAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const login = user.user_metadata?.user_name;
  if (typeof login !== "string" || formData.get("confirm") !== login) return;

  try {
    await deleteAccount(createAdminClient(), user.id);
  } catch (err) {
    Sentry.captureException(err, { tags: { user_id: user.id, entrypoint: "account_delete" } });
    redirect("/settings?error=delete_failed");
  }

  // Local scope: the server-side user is already gone, so only the cookies matter.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?deleted=1");
}
