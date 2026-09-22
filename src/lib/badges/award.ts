import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { track } from "@/lib/analytics/track";
import { type Badge, type BadgeContext, dueBadges } from "@/lib/badges/catalog";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/**
 * Reads what the player holds, awards whatever the context now earns,
 * and pays byte bonuses through the ledger (source 'badge', ref = badge
 * id, so a payout can never repeat). Returns everything held after the
 * call plus the ones earned just now, for the toast. Never throws: a
 * failed award is a Sentry warning and the badge is simply earned on
 * the next visit.
 */
export async function awardBadges(
  supabase: Db,
  admin: Db,
  userId: string,
  ctx: BadgeContext,
): Promise<{ held: string[]; fresh: Badge[] }> {
  const { data: rows } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
  const held = new Set((rows ?? []).map((r) => r.badge_id));

  const fresh = dueBadges(ctx, held);
  if (fresh.length === 0) return { held: [...held], fresh };

  const { error } = await admin
    .from("user_badges")
    .upsert(
      fresh.map((b) => ({ user_id: userId, badge_id: b.id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true },
    );
  if (error) {
    Sentry.captureMessage("badge award failed", { level: "warning", extra: { error: error.message } });
    return { held: [...held], fresh: [] };
  }

  for (const b of fresh) {
    held.add(b.id);
    if (b.bonusBytes > 0) {
      const { error: payErr } = await admin.rpc("credit_bytes_tx", {
        p_user_id: userId,
        p_delta: b.bonusBytes,
        p_source: "badge",
        p_source_ref: b.id,
      });
      if (payErr) Sentry.captureMessage("badge bonus failed", { level: "warning", extra: { badge: b.id, error: payErr.message } });
    }
    await track(admin, userId, "badge_earned", { badge_id: b.id }, b.id);
  }

  return { held: [...held], fresh };
}
