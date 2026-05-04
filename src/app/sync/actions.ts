"use server";

import { revalidatePath } from "next/cache";

import {
  commitCountFromPayload,
  fetchUserEvents,
  type GitHubEvent,
} from "@/lib/github/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GITHUB_SYNC_SOURCE = "github_sync";

/**
 * Pulls the authenticated user's recent public GitHub activity and credits
 * bytes via the `credit_bytes_tx` SQL function. Idempotency is handled by
 * the unique constraint on `(user_id, source, source_ref)`: the same
 * `push_id` cannot credit twice, so this action is safe to call repeatedly.
 *
 * No-ops:
 *   - Anonymous caller → returns silently.
 *   - Authenticated but no GitHub login on the OAuth profile → returns.
 *   - Push event without `push_id` (rare) → skipped, not retried.
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

  const events = await fetchUserEvents(githubLogin);
  const admin = createAdminClient();

  for (const event of events) {
    if (event.type !== "PushEvent") continue;

    const sourceRef = pushSourceRef(event);
    if (!sourceRef) continue;

    const delta = commitCountFromPayload(event);
    if (delta <= 0) continue;

    // We do not await every call sequentially because order does not matter
    // (each push is independent and idempotency is enforced by the DB).
    // We DO await the loop as a whole so revalidation only fires after all
    // writes have settled.
    await admin.rpc("credit_bytes_tx", {
      p_user_id: user.id,
      p_delta: delta,
      p_source: GITHUB_SYNC_SOURCE,
      p_source_ref: sourceRef,
    });
  }

  // Force the home page to re-render with the fresh balance.
  revalidatePath("/");
}

function pushSourceRef(event: GitHubEvent): string | null {
  const pushId = event.payload?.push_id;
  if (typeof pushId === "number") return `push:${pushId}`;
  // Fallback: events API sometimes omits push_id, but always includes
  // event.id (the top-level unique event id). Use that as backup ref.
  if (typeof event.id === "string" && event.id.length > 0) {
    return `event:${event.id}`;
  }
  return null;
}
