import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

export type Notice = { id: string; title: string; body: string; bytes: number };

/**
 * The welcome packet. Versioned in the ref: bump it to send everyone a
 * new one, keep it to make sure nobody gets it twice. The migration that
 * created the table seeded v1 for everyone who was already in.
 */
export const WELCOME = {
  ref: "welcome:v1",
  title: "Welcome to the Repo",
  body:
    'The previous Maintainer left 100 B in the desk drawer and a note: "Build something before the lights go out." The Cache Storage is 50 B. So is a good start.',
  bytes: 100,
} as const;

/** Idempotent: the unique (user, ref) key makes a repeat a no-op. */
export async function ensureWelcome(admin: Db, userId: string): Promise<void> {
  await admin
    .from("notices")
    .upsert({ user_id: userId, ...WELCOME }, { onConflict: "user_id,ref", ignoreDuplicates: true });
}

/** Packets still waiting for this Maintainer, oldest first (RLS select-own). */
export async function loadUnread(supabase: Db, userId: string): Promise<Notice[]> {
  const { data } = await supabase
    .from("notices")
    .select("id, title, body, bytes")
    .eq("user_id", userId)
    .is("opened_at", null)
    .order("created_at");
  return data ?? [];
}
