import type { SupabaseClient } from "@supabase/supabase-js";

import { generateForkName, isForkTrait, pickTrait, type Fork } from "@/lib/forks/catalog";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/**
 * The player's survivors. Guarantees the free starter Fork exists first
 * (idempotent RPC, service role), then reads through RLS. The starter's
 * name and trait come from a hash of the user id so a retry produces the
 * same survivor.
 */
export async function loadForks(supabase: Db, admin: Db, userId: string): Promise<Fork[]> {
  const seed = hash32(userId);
  await admin.rpc("ensure_starter_fork", {
    p_user_id: userId,
    p_name: generateForkName(seed),
    p_trait: pickTrait(seed),
  });

  const { data } = await supabase
    .from("forks")
    .select("id, name, trait, mood, room_slot, seed")
    .eq("user_id", userId)
    .order("created_at");

  return (data ?? []).flatMap((row) =>
    isForkTrait(row.trait)
      ? [{ id: row.id, name: row.name, trait: row.trait, mood: row.mood, roomSlot: row.room_slot, seed: row.seed }]
      : [],
  );
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
