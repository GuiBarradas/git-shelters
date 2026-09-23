import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RECRUIT_COST } from "@/lib/forks/catalog";
import { loadCrew, loadForks } from "@/lib/forks/load";
import { moodFor } from "@/lib/forks/mood";
import { ensureWelcome, loadUnread, WELCOME } from "@/lib/notices";
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
    // A fresh bunker is "content"; the starter's random trait may shift it one step.
    expect(first[0]).toMatchObject({ roomSlot: 0, mood: moodFor("content", first[0]!.trait) });
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

  it("refuses a third survivor until a Dorm adds beds", async () => {
    await admin.from("users").update({ bytes: RECRUIT_COST * 4 }).eq("id", user.id);
    const recruit = (name: string) =>
      admin.rpc("recruit_fork", { p_user_id: user.id, p_name: name, p_trait: "junior", p_cost: RECRUIT_COST });

    // Starter + Ada_v2 already fill the two Main Branch beds.
    expect((await recruit("Third_tmp")).error?.message).toContain("no_beds");
    expect(await loadForks(admin, admin, user.id)).toHaveLength(2);

    const { error: built } = await admin.rpc("build_room", { p_user_id: user.id, p_slot: 3, p_kind: "dorm" });
    expect(built).toBeNull();
    expect((await recruit("Third_tmp")).error).toBeNull();
    expect((await recruit("Fourth_tmp")).error).toBeNull();
    expect((await recruit("Fifth_tmp")).error?.message).toContain("no_beds");
    expect(await loadForks(admin, admin, user.id)).toHaveLength(4);

    await admin.from("users").update({ bytes: 0 }).eq("id", user.id);
  });

  it("the welcome packet pays 100 B once, however many times it is opened", async () => {
    await admin.from("users").update({ bytes: 0 }).eq("id", user.id);
    await ensureWelcome(admin, user.id);
    await ensureWelcome(admin, user.id); // idempotent
    const unread = await loadUnread(admin, user.id);
    expect(unread).toHaveLength(1);
    expect(unread[0]).toMatchObject({ title: WELCOME.title, bytes: 100 });

    const first = await admin.rpc("open_notice", { p_user_id: user.id, p_notice_id: unread[0]!.id });
    expect(first.error).toBeNull();
    expect(first.data).toBe(100);
    const again = await admin.rpc("open_notice", { p_user_id: user.id, p_notice_id: unread[0]!.id });
    expect(again.error).toBeNull();

    const { data: me } = await admin.from("users").select("bytes").eq("id", user.id).single();
    expect(me?.bytes).toBe(100);
    expect(await loadUnread(admin, user.id)).toHaveLength(0);
    await admin.from("users").update({ bytes: 0 }).eq("id", user.id);
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
