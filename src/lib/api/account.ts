import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * LGPD account operations (ADR 0007). Both run with the service-role
 * client, scoped to a user id the caller has already authenticated.
 * Every call leaves an audit_log row.
 */

type Admin = SupabaseClient<Database>;

export type AccountExport = {
  exported_at: string;
  account: {
    github_login: string;
    github_id: number;
    email: string | null;
    created_at: string;
    last_seen_at: string;
    bytes: number;
  };
  badges: Array<{ badge_id: string; earned_at: string }>;
  notices: Array<{ ref: string; title: string; bytes: number; created_at: string; opened_at: string | null }>;
  byte_transactions: Array<{
    delta: number;
    source: string;
    source_ref: string;
    balance_after: number;
    created_at: string;
  }>;
  rooms: Array<{ slot: number; kind: string; level: number; built_at: string }>;
  daily_event_outcomes: Array<{
    event_id: string;
    choice: string;
    outcome_json: unknown;
    resolved_at: string;
  }>;
  github_sync_state: {
    last_synced_at: string | null;
    last_event_id: string | null;
    backfill_status: string;
  } | null;
  analytics_events: Array<{ event_name: string; props_json: unknown; occurred_at: string }>;
};

/**
 * Everything the game holds about one user, as plain JSON (LGPD art. 18,
 * II and V — portability). Internal ids are left out: they identify rows,
 * not the person, and mean nothing outside this database.
 */
export async function exportAccount(admin: Admin, userId: string): Promise<AccountExport | null> {
  const [user, transactions, rooms, outcomes, sync, analytics, badges, notices] = await Promise.all([
    admin
      .from("users")
      .select("github_login, github_id, email, created_at, last_seen_at, bytes")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("byte_transactions")
      .select("delta, source, source_ref, balance_after, created_at")
      .eq("user_id", userId)
      .order("created_at"),
    admin.from("rooms").select("slot, kind, level, built_at").eq("user_id", userId).order("slot"),
    admin
      .from("daily_event_outcomes")
      .select("event_id, choice, outcome_json, resolved_at")
      .eq("user_id", userId)
      .order("resolved_at"),
    admin
      .from("github_sync_state")
      .select("last_synced_at, last_event_id, backfill_status")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("analytics_events")
      .select("event_name, props_json, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at"),
    admin.from("user_badges").select("badge_id, earned_at").eq("user_id", userId).order("earned_at"),
    admin.from("notices").select("ref, title, bytes, created_at, opened_at").eq("user_id", userId).order("created_at"),
  ]);

  const firstError = [user, transactions, rooms, outcomes, sync, analytics, badges, notices].find((r) => r.error)?.error;
  if (firstError) throw firstError;
  if (!user.data) return null;

  await audit(admin, userId, "account.export");

  return {
    exported_at: new Date().toISOString(),
    account: user.data,
    byte_transactions: transactions.data ?? [],
    rooms: rooms.data ?? [],
    daily_event_outcomes: outcomes.data ?? [],
    github_sync_state: sync.data,
    analytics_events: analytics.data ?? [],
    badges: badges.data ?? [],
    notices: notices.data ?? [],
  };
}

/**
 * Hard delete (LGPD art. 18, VI — elimination). Removing the auth.users
 * row cascades through public.users into every game table by foreign
 * key (analytics_events keeps its rows with user_id set to null, so
 * aggregates survive without identifiability), and drops the GitHub
 * identity Supabase stored for OAuth. No
 * GitHub token is held anywhere else. The audit row is written first so
 * a crash mid-way leaves proof of intent, and it survives because
 * audit_log.user_id has no foreign key.
 */
export async function deleteAccount(admin: Admin, userId: string): Promise<void> {
  await audit(admin, userId, "account.delete");
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

async function audit(admin: Admin, userId: string, action: string) {
  const { error } = await admin.from("audit_log").insert({ user_id: userId, action });
  if (error) throw error;
}
