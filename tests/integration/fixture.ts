import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Throwaway auth user for integration suites.
 *
 * Every suite used to borrow the maintainer's real account and try to
 * restore it afterwards, which corrupted the balance whenever the cron or
 * the maintainer touched the row mid-run. A fresh auth user per suite has
 * no such problem: the signup trigger gives it a public.users row, the
 * suite does what it wants, and `destroy()` hard-deletes the auth user,
 * cascading through every game table. Analytics rows are removed first
 * because that table only anonymises on delete.
 */
export type ThrowawayUser = {
  id: string;
  login: string;
  createdAt: string;
  destroy: () => Promise<void>;
};

export async function createThrowawayUser(
  admin: SupabaseClient<Database>,
  tag: string,
): Promise<ThrowawayUser> {
  const run = crypto.randomUUID().slice(0, 8);
  const login = `test-${tag}-${run}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: `${login}@example.invalid`,
    email_confirm: true,
    user_metadata: { user_name: login, provider_id: String(900_000_000 + Math.floor(Math.random() * 1e8)) },
  });
  if (error || !data.user) throw new Error(`createThrowawayUser failed: ${error?.message}`);
  const id = data.user.id;

  return {
    id,
    login,
    createdAt: data.user.created_at,
    destroy: async () => {
      await admin.from("analytics_events").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    },
  };
}
