import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RECRUIT_COST } from "@/lib/forks/catalog";
import { loadCrew, loadForks } from "@/lib/forks/load";
import { createAdminClient } from "@/lib/supabase/admin";

import { createThrowawayUser, type ThrowawayUser } from "./fixture";

/**
 * Integration tests for the survivors (design doc §6): the free starter,
 * recruiting through the ledger, and the rejection when bytes are short.
 */

describe("forks", () => {
  const admin = createAdminClient();
  let user: ThrowawayUser;

  beforeAll(async () => {
    user = await createThrowawayUser(admin, "forks");
  });

  afterAll(() => user.destroy());

  it("gives a new bunker exactly one starter Fork, however many times it is asked", async () => {
    const first = await loadForks(admin, admin, user.id);
    const second = await loadForks(admin, admin, user.id);
    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(first[0]).toMatchObject({ roomSlot: 0, mood: "content" });
    expect(first[0]!.name).toMatch(/^[A-Z][a-z]+[_-]/);

    const { data: user0 } = await admin.from("users").select("bytes").eq("id", user.id).single();
    expect(user0?.bytes).toBe(0); // the starter is free
  });

  it("recruits for RECRUIT_COST through the ledger", async () => {
    await admin.from("users").update({ bytes: RECRUIT_COST + 10 }).eq("id", user.id);

    const { data: forkId, error } = await admin.rpc("recruit_fork", {
      p_user_id: user.id,
      p_name: "Ada_v2",
      p_trait: "senior",
      p_cost: RECRUIT_COST,
    });
    expect(error).toBeNull();
    expect(forkId).toBeTruthy();

    const { data: me } = await admin.from("users").select("bytes").eq("id", user.id).single();
    expect(me?.bytes).toBe(10);

    const { data: tx } = await admin
      .from("byte_transactions")
      .select("delta, source, source_ref")
      .eq("user_id", user.id)
      .eq("source", "recruit")
      .single();
    expect(tx).toEqual({ delta: -RECRUIT_COST, source: "recruit", source_ref: forkId });

    expect(await loadForks(admin, admin, user.id)).toHaveLength(2);
  });

  it("derives the crew mood from the last push the ledger saw", async () => {
    const now = new Date("2026-09-22T12:00:00Z");
    const fresh = await loadCrew(admin, admin, user.id, now);
    expect(fresh.mood).toBe("content");
    expect(fresh.lastPushAt).toBeNull();

    // A push credited 9 days ago: the bunker turns bitter.
    await admin.from("byte_transactions").insert({
      user_id: user.id,
      delta: 1,
      source: "backfill",
      source_ref: "push:mood-test",
      balance_after: 0,
      created_at: new Date(now.getTime() - 9 * 86_400_000).toISOString(),
    });
    const stale = await loadCrew(admin, admin, user.id, now);
    expect(stale.mood).toBe("bitter");
    for (const f of stale.forks) {
      expect(["bitter", "stressed"]).toContain(f.mood); // trait may lift one step
    }

    // A push today: happy again.
    await admin.from("byte_transactions").insert({
      user_id: user.id,
      delta: 1,
      source: "github_sync",
      source_ref: "push:mood-test-2",
      balance_after: 0,
      created_at: now.toISOString(),
    });
    expect((await loadCrew(admin, admin, user.id, now)).mood).toBe("happy");
  });

  it("rejects a recruit the player cannot afford, leaving no Fork behind", async () => {
    const before = await loadForks(admin, admin, user.id);
    const { error } = await admin.rpc("recruit_fork", {
      p_user_id: user.id,
      p_name: "Nope_404",
      p_trait: "junior",
      p_cost: RECRUIT_COST,
    });
    expect(error?.message).toContain("insufficient_bytes");
    expect(await loadForks(admin, admin, user.id)).toEqual(before);
  });
});
