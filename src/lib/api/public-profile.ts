import { cache } from "react";

import { isRoomKind, isSlot, type Room } from "@/lib/rooms/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public profile reads (ADR 0001, Option B).
 *
 * This is the ONE place the service-role client is used to read another
 * user's data. RLS stays `auth.uid() = id` everywhere; what a visitor can
 * see is exactly the fields `toPublicProfile` copies out, nothing else.
 * `select()` below is deliberately narrow too, but the mapper is the
 * whitelist: a column selected for a check (deleted_at) never leaves.
 */

export type PublicProfile = {
  login: string;
  /** ISO timestamp of signup. */
  memberSince: string;
  bytes: number;
  rooms: (Room & { level: number })[];
};

type UserRow = {
  github_login: string;
  created_at: string;
  bytes: number;
  deleted_at: string | null;
};

type RoomRow = { slot: number; kind: string; level: number };

/** GitHub login grammar: alphanumerics and hyphens, at most 39 chars. */
const LOGIN_PATTERN = /^[a-zA-Z0-9-]{1,39}$/;

export function toPublicProfile(user: UserRow, rooms: RoomRow[]): PublicProfile | null {
  // LGPD: a deleted account is gone from the outside, not "deleted: true".
  if (user.deleted_at) return null;

  return {
    login: user.github_login,
    memberSince: user.created_at,
    bytes: user.bytes,
    rooms: rooms.flatMap(({ slot, kind, level }) =>
      isSlot(slot) && isRoomKind(kind) ? [{ slot, kind, level }] : [],
    ),
  };
}

/**
 * Wrapped in React cache() so generateMetadata and the page body share one
 * lookup per request instead of hitting Supabase twice.
 */
export const getPublicProfile = cache(async (login: string): Promise<PublicProfile | null> => {
  // Trust boundary: the pattern also rules out ilike wildcards (% and _).
  if (!LOGIN_PATTERN.test(login)) return null;

  const admin = createAdminClient();

  // GitHub logins are case-insensitive; the stored value is the canonical
  // casing from OAuth, so /u/guibarradas must still resolve.
  const { data: user } = await admin
    .from("users")
    .select("id, github_login, created_at, bytes, deleted_at")
    .ilike("github_login", login)
    .maybeSingle();
  if (!user) return null;

  const { data: rooms } = await admin
    .from("rooms")
    .select("slot, kind, level")
    .eq("user_id", user.id);

  return toPublicProfile(user, rooms ?? []);
});
