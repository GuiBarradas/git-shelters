import { cache } from "react";

import { pinFor, REGION_BY_ID, type Point } from "@/lib/regions/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

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
};

type UserRow = { github_login: string; created_at: string; bytes: number; deleted_at: string | null };

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
  };
}

/** One read per request, shared by metadata and page. */
export const getWorldMap = cache(async (): Promise<MapPin[]> => {
  const admin = createAdminClient();
  // ponytail: three full-table reads and a count in JS. Fine for an alpha
  // of dozens; move to a grouped SQL view when the map has thousands.
  const [{ data: users }, { data: rooms }, { data: badges }] = await Promise.all([
    admin.from("users").select("github_login, created_at, bytes, deleted_at").is("deleted_at", null),
    admin.from("rooms").select("user_id"),
    admin.from("user_badges").select("user_id"),
  ]);
  // Counting needs ids, but ids never leave: join here, drop them in the mapper.
  const { data: ids } = await admin.from("users").select("id, github_login").is("deleted_at", null);
  const idByLogin = new Map((ids ?? []).map((u) => [u.github_login, u.id]));
  const count = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const roomCount = count(rooms);
  const badgeCount = count(badges);

  return (users ?? [])
    .flatMap((u) => {
      const id = idByLogin.get(u.github_login);
      const pin = toMapPin(u, id ? (roomCount.get(id) ?? 0) : 0, id ? (badgeCount.get(id) ?? 0) : 0);
      return pin ? [pin] : [];
    })
    .sort((a, b) => a.login.localeCompare(b.login));
});
