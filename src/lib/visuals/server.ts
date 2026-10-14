import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import { isRoomKind, isSlot } from "@/lib/rooms/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { generateBunker } from "@/lib/visuals/generate";
import type { GeneratedBunker, RoomRef } from "@/lib/visuals/types";

/**
 * Server loaders for the deterministic bunker visuals. The seed is the
 * numeric GitHub user id (users.github_id), so a login rename never
 * changes a bunker. Read-only: nothing here writes game state.
 */

/** GitHub login grammar: alphanumerics and hyphens, at most 39 chars. Also rules out ilike wildcards. */
export function isGithubLogin(login: unknown): login is string {
  return typeof login === "string" && /^[a-zA-Z0-9-]{1,39}$/.test(login);
}

export function isGithubId(id: unknown): id is number {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

type VisualUser = { github_id: number; deleted_at: string | null };

/** Recent credited GitHub activity, in UTC days; this is not a repository commit count. */
export function activityFromCreditAt(timestamp: string | null, nowMs: number): number | null {
  if (!timestamp) return null;
  const then = Date.parse(timestamp);
  if (!Number.isFinite(then) || !Number.isFinite(nowMs)) return null;
  const days = Math.max(0, Math.floor(nowMs / 86_400_000) - Math.floor(then / 86_400_000));
  if (days > 7) return 0;
  return Number((days <= 2 ? 1 - days * 0.15 : 0.7 - (days - 2) * 0.1).toFixed(2));
}

async function loadActivity(client: SupabaseClient<Database>, userId: string): Promise<number | null> {
  const { data, error } = await client.from("byte_transactions")
    .select("created_at")
    .eq("user_id", userId)
    .in("source", ["github_sync", "backfill"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return activityFromCreditAt(data?.created_at ?? null, Date.now());
}

function toBunker(
  user: VisualUser | null,
  rooms: readonly { slot: number; kind: string }[],
  recentActivity?: number | null,
): GeneratedBunker | null {
  if (!user || user.deleted_at || !isGithubId(user.github_id)) return null;

  const actual: RoomRef[] = [{ slot: 0, kind: "main" }];
  const taken = new Set<number>([0]);
  for (const { slot, kind } of rooms) {
    if (isSlot(slot) && isRoomKind(kind) && !taken.has(slot)) {
      taken.add(slot);
      actual.push({ slot, kind });
    }
  }
  const known = typeof recentActivity === "number" && recentActivity >= 0 && recentActivity <= 1;
  return generateBunker(user.github_id, known ? { recentActivity } : undefined, actual);
}

/** Visuals for an already-authenticated user. Throws on query failure; null for missing/deleted/invalid accounts. */
export async function loadUserVisuals(
  client: SupabaseClient<Database>,
  userId: string,
  rooms: readonly { slot: number; kind: string }[],
): Promise<GeneratedBunker | null> {
  const { data, error } = await client.from("users").select("github_id, deleted_at").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data || data.deleted_at || !isGithubId(data.github_id)) return null;
  return toBunker(data, rooms, await loadActivity(client, userId));
}

/**
 * Visuals for /u/[login]. Uses the service role (ADR 0001) for narrow
 * reads; the result carries the numeric GitHub id as the visual seed and
 * nothing else about the account.
 */
export const loadPublicVisuals = cache(async (login: string): Promise<GeneratedBunker | null> => {
  if (!isGithubLogin(login)) return null;
  const admin = createAdminClient();

  const { data: user, error } = await admin
    .from("users")
    .select("id, github_id, deleted_at")
    .ilike("github_login", login)
    .maybeSingle();
  if (error) throw error;
  if (!user || user.deleted_at || !isGithubId(user.github_id)) return null;

  const [{ data: rooms, error: roomsError }, activity] = await Promise.all([
    admin.from("rooms").select("slot, kind").eq("user_id", user.id),
    loadActivity(admin, user.id),
  ]);
  if (roomsError) throw roomsError;
  return toBunker(user, rooms ?? [], activity);
});
