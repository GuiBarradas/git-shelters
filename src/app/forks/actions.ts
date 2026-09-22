"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { generateForkName, pickTrait, RECRUIT_COST } from "@/lib/forks/catalog";
import { isSlot } from "@/lib/rooms/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Recruits one more survivor for RECRUIT_COST bytes (design doc §6.2).
 * The RPC checks the balance and debits through the ledger; the name and
 * trait are rolled here from a fresh seed. `insufficient_bytes` is an
 * expected rejection (the button is disabled client-side but a stale
 * page can still submit); anything else is a bug.
 */
export async function recruitFork() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const seed = Math.floor(Math.random() * 2_147_483_647);
  const { error } = await createAdminClient().rpc("recruit_fork", {
    p_user_id: user.id,
    p_name: generateForkName(seed),
    p_trait: pickTrait(seed),
    p_cost: RECRUIT_COST,
  });

  if (error && !error.message.includes("insufficient_bytes")) {
    Sentry.captureException(error, { tags: { user_id: user.id, entrypoint: "recruit_fork" } });
  }

  revalidatePath("/");
  revalidatePath("/room/0");
}

/**
 * Moves a survivor to a room (its job) or back to the Main Branch (off
 * shift). The RPC checks the room is built and the Fork is the player's.
 */
export async function assignFork(formData: FormData) {
  const forkId = formData.get("fork");
  const slot = Number(formData.get("slot"));
  if (typeof forkId !== "string" || !(slot === 0 || isSlot(slot))) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await createAdminClient().rpc("assign_fork", {
    p_user_id: user.id,
    p_fork_id: forkId,
    p_slot: slot,
  });
  if (error && !error.message.includes("room_not_built") && !error.message.includes("fork_not_found")) {
    Sentry.captureException(error, { tags: { user_id: user.id, entrypoint: "assign_fork" } });
  }

  revalidatePath("/");
  revalidatePath(`/room/${slot}`);
}
