import type { SupabaseClient } from "@supabase/supabase-js";

import { generateForkName, isForkTrait, pickTrait, type Fork } from "@/lib/forks/catalog";
import { moodFor, moodFromActivity, type Mood } from "@/lib/forks/mood";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

export type Crew = {
  forks: Fork[];
  /** The bunker's base mood, before per-Fork trait shifts. */
  mood: Mood;
  /** ISO time of the last push the sync credited, or null. */
  lastPushAt: string | null;
};

/**
 * The player's survivors with their current mood. Guarantees the free
 * starter Fork exists first (idempotent RPC, service role), reads the
 * crew through RLS, and derives every Fork's mood from the last push the
 * ledger saw (design doc §6.1: mood is a function of the Maintainer's
 * real activity). The starter's name and trait come from a hash of the
 * user id so a retry produces the same survivor.
 */
export async function loadCrew(supabase: Db, admin: Db, userId: string, now = new Date()): Promise<Crew> {
  const seed = hash32(userId);
  await admin.rpc("ensure_starter_fork", {
    p_user_id: userId,
    p_name: generateForkName(seed),
    p_trait: pickTrait(seed),
  });

  const [{ data: rows }, { data: lastPush }] = await Promise.all([
    supabase
      .from("forks")
      .select("id, name, trait, mood, room_slot, seed")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("byte_transactions")
      .select("created_at")
      .eq("user_id", userId)
      .in("source", ["github_sync", "backfill"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastPushAt = lastPush?.created_at ?? null;
  const mood = moodFromActivity(lastPushAt, now);

  const forks = (rows ?? []).flatMap((row) =>
    isForkTrait(row.trait)
      ? [
          {
            id: row.id,
            name: row.name,
            trait: row.trait,
            mood: moodFor(mood, row.trait),
            roomSlot: row.room_slot,
            seed: row.seed,
          },
        ]
      : [],
  );

  return { forks, mood, lastPushAt };
}

/** Just the survivors; see loadCrew for the mood context. */
export async function loadForks(supabase: Db, admin: Db, userId: string): Promise<Fork[]> {
  return (await loadCrew(supabase, admin, userId)).forks;
}

/** FNV-1a over the uuid text: stable, cheap, good enough to seed a name. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
