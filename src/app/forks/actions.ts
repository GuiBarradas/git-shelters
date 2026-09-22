"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { generateForkName, pickTrait, RECRUIT_COST } from "@/lib/forks/catalog";
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
