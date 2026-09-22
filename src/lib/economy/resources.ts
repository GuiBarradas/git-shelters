import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hoursBetween, type ResourceState, simulate, type TickResult, type Workforce } from "@/lib/economy/tick";
import type { Fork } from "@/lib/forks/catalog";
import type { Room } from "@/lib/rooms/catalog";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

export type Settled = TickResult & {
  /** Stored state before this settle; the "while you were away" delta base. */
  before: ResourceState;
  /** ISO time of the previous tick, i.e. when the player was last seen. */
  since: string;
  /** Hours the simulation covered. */
  hours: number;
};

/**
 * Brings the bunker's resources up to now (catch-up offline, §10.3.1):
 * reads the stored state, runs the pure simulation for the elapsed time,
 * and writes the result once through apply_tick(). If another render won
 * the write, the stored row is re-read so both show the same numbers.
 * Never throws: a failed write leaves the player with the last stored
 * state and a Sentry warning.
 */
export async function settleResources(
  supabase: Db,
  admin: Db,
  userId: string,
  forks: Fork[],
  rooms: Room[],
  now: Date = new Date(),
): Promise<Settled> {
  const { data: row } = await supabase
    .from("users")
    .select("cache, uptime, payload, last_tick_at")
    .eq("id", userId)
    .maybeSingle();
  if (!row) {
    const empty = { cache: 0, uptime: 0, payload: 0 };
    return { ...empty, starved: false, blackout: true, before: empty, since: now.toISOString(), hours: 0 };
  }

  const hours = hoursBetween(row.last_tick_at, now);
  const meta = { before: { cache: row.cache, uptime: row.uptime, payload: row.payload }, since: row.last_tick_at, hours };
  const result = { ...simulate(row, workforce(forks, rooms), hours), ...meta };

  // Under a minute since the last write: nothing meaningful to store.
  if (now.getTime() - Date.parse(row.last_tick_at) < 60_000) {
    return { ...result, ...meta.before, hours: 0 };
  }

  const { data: applied, error } = await admin.rpc("apply_tick", {
    p_user_id: userId,
    p_expected_tick: row.last_tick_at,
    p_new_tick: now.toISOString(),
    p_cache: result.cache,
    p_uptime: result.uptime,
    p_payload: result.payload,
  });
  if (error) {
    Sentry.captureMessage("apply_tick failed", { level: "warning", extra: { error: error.message } });
    return { ...result, ...meta.before };
  }
  if (!applied) {
    const { data: fresh } = await supabase
      .from("users")
      .select("cache, uptime, payload")
      .eq("id", userId)
      .maybeSingle();
    return { ...result, ...(fresh ?? {}) };
  }
  return result;
}

export function workforce(forks: Fork[], rooms: Room[]): Workforce {
  const kindOf = new Map(rooms.map((r) => [r.slot, r.kind]));
  let cooks = 0;
  let engineers = 0;
  let tinkerers = 0;
  for (const f of forks) {
    const kind = f.roomSlot === null ? undefined : kindOf.get(f.roomSlot as 1 | 2 | 3);
    if (kind === "cache_storage") cooks++;
    if (kind === "power_plant") engineers++;
    if (kind === "workshop") tinkerers++;
  }
  const count = (kind: Room["kind"]) => rooms.filter((r) => r.kind === kind).length;
  return {
    cooks,
    engineers,
    tinkerers,
    forks: forks.length,
    cacheStorages: count("cache_storage"),
    powerPlants: count("power_plant"),
    workshops: count("workshop"),
  };
}
