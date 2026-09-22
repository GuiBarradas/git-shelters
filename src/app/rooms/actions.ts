"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { ONCE, track } from "@/lib/analytics/track";
import { isRoomKind, isSlot, ROOM_CATALOG } from "@/lib/rooms/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Builds a room in one of the player's empty slots.
 *
 * The RPC is the authority on cost, balance and slot occupancy; this
 * action only authenticates the caller and validates the form shape.
 * `insufficient_bytes` and `slot_occupied` are expected outcomes (the UI
 * disables unaffordable buttons, and a stale page can double-submit), so
 * they are not reported. Anything else is a bug and goes to Sentry.
 */
export async function buildRoom(formData: FormData) {
  const slot = Number(formData.get("slot"));
  const kind = formData.get("kind");
  if (!isSlot(slot) || !isRoomKind(kind)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { error } = await admin.rpc("build_room", {
    p_user_id: user.id,
    p_slot: slot,
    p_kind: kind,
  });

  if (error && !isExpectedRejection(error.message)) {
    Sentry.captureException(error, { extra: { slot, kind } });
  }

  if (!error) {
    await track(
      admin,
      user.id,
      "first_build",
      { room_type: kind, time_since_signup_ms: Date.now() - Date.parse(user.created_at) },
      ONCE,
    );
    await track(admin, user.id, "room_built", {
      room_type: kind,
      level: 1,
      bytes_spent: ROOM_CATALOG[kind].cost,
    });
  }

  revalidatePath("/");
}

function isExpectedRejection(message: string): boolean {
  return (
    message.includes("insufficient_bytes") || message.includes("slot_occupied")
  );
}
