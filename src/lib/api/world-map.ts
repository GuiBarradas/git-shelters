import { cache } from "react";

import { pinFor, REGION_BY_ID, type Point } from "@/lib/regions/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { activityFromCreditAt } from "@/lib/visuals/server";

/**
 * World map reads (ADR 0001 applies: the service role reads other users'
 * rows here, and `toMapPin` is the whitelist). A pin carries the same
 * public facts as the profile page, nothing more: the map is a way to
 * find profiles, not a new data surface.
 */

export type MapPin = {
  login: string;
  region: string;
  /** Map-space coordinates, derived from the login; never stored. */
  at: Point;
  bytes: number;
  rooms: number;
  badges: number;
  /** ISO signup time. */
  memberSince: string;
  /** 0..1 from the last credited GitHub sync; null when there is none (unknown, not idle). */
  activity: number | null;
};

/** `byte_transactions` holds at most the newest credit; its timestamp never leaves the mapper. */
type UserRow = {
  id: string;
  github_login: string;
  created_at: string;
  bytes: number;
  deleted_at: string | null;
  byte_transactions: { created_at: string }[] | null;
};

/** Every bunker is in The Outage until regions can be chosen. */
const HOME_REGION = "the_outage";

export function toMapPin(user: UserRow, rooms: number, badges: number): MapPin | null {
  if (user.deleted_at) return null;
  const region = REGION_BY_ID.get(HOME_REGION)!;
  return {
    login: user.github_login,
    region: region.id,
    at: pinFor(user.github_login, region),
    bytes: user.bytes,
    rooms,
    badges,
    memberSince: user.created_at,
    activity: activityFromCreditAt(user.byte_transactions?.[0]?.created_at ?? null, Date.now()),
  };
}

/** One read per request, shared by metadata and page. */
export const getWorldMap = cache(async (): Promise<MapPin[]> => {
  const admin = createAdminClient();
  // ponytail: three full-table reads and a count in JS. Fine for an alpha
  // of dozens; move to a grouped SQL view when the map has thousands.
  const [usersRes, roomsRes, badgesRes] = await Promise.all([
    // Newest credit per user only; users without one still come back (no !inner).
    admin.from("users")
      .select("id, github_login, created_at, bytes, deleted_at, byte_transactions(created_at)")
      .is("deleted_at", null)
      .in("byte_transactions.source", ["github_sync", "backfill"])
      .order("created_at", { referencedTable: "byte_transactions", ascending: false })
      .limit(1, { referencedTable: "byte_transactions" }),
    admin.from("rooms").select("user_id"),
    admin.from("user_badges").select("user_id"),
  ]);
  for (const { error } of [usersRes, roomsRes, badgesRes]) if (error) throw error;
  const count = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const roomCount = count(roomsRes.data);
  const badgeCount = count(badgesRes.data);

  // Ids join the counts here and are dropped by the mapper.
  return (usersRes.data ?? [])
    .flatMap((u) => {
      const pin = toMapPin(u, roomCount.get(u.id) ?? 0, badgeCount.get(u.id) ?? 0);
      return pin ? [pin] : [];
    })
    .sort((a, b) => a.login.localeCompare(b.login));
});
