import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { createThrowawayUser, type ThrowawayUser } from "./fixture";

/**
 * Integration tests for build_room() against the remote dev Supabase.
 *
 * Same fixture discipline as credit-bytes-tx.test.ts: reuse the
 * throwaway auth user per run, wiped between tests, gone on teardown.
 *
 * Because slots are a (user_id, slot) primary key and the ledger keys the
 * debit on the slot number, this suite owns the fixture user's slots for
 * its duration. It wipes them in beforeEach, so do not run it against a
 * user whose real bunker you care about.
 */


describe("build_room", () => {
  const admin = createAdminClient();
  let user: ThrowawayUser;
  let userId: string;

  async function wipeRooms() {
    await admin.from("rooms").delete().eq("user_id", userId);
    await admin
      .from("byte_transactions")
      .delete()
      .eq("user_id", userId)
      .eq("source", "build");
  }

  beforeAll(async () => {
    user = await createThrowawayUser(admin, "rooms");
    userId = user.id;
  });

  afterAll(() => user.destroy());

  beforeEach(async () => {
    await wipeRooms();
    await admin.from("users").update({ bytes: 100 }).eq("id", userId);
  });

  it("inserts the room, debits the cost through the ledger and returns the new balance", async () => {
    const { data, error } = await admin.rpc("build_room", {
      p_user_id: userId,
      p_slot: 1,
      p_kind: "cache_storage",
    });
    expect(error).toBeNull();
    expect(data).toBe(50);

    const { data: room } = await admin
      .from("rooms")
      .select("kind, level")
      .eq("user_id", userId)
      .eq("slot", 1)
      .single();
    expect(room).toEqual({ kind: "cache_storage", level: 1 });

    const { data: tx } = await admin
      .from("byte_transactions")
      .select("delta, source_ref, balance_after")
      .eq("user_id", userId)
      .eq("source", "build")
      .single();
    expect(tx).toEqual({ delta: -50, source_ref: "1", balance_after: 50 });
  });

  it("rejects a build the player cannot afford and leaves no trace", async () => {
    const first = await admin.rpc("build_room", {
      p_user_id: userId,
      p_slot: 1,
      p_kind: "power_plant",
    });
    expect(first.data).toBe(20);

    const second = await admin.rpc("build_room", {
      p_user_id: userId,
      p_slot: 2,
      p_kind: "cache_storage",
    });
    expect(second.error?.message).toContain("insufficient_bytes");

    const { count } = await admin
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(1);

    const { data: user } = await admin
      .from("users")
      .select("bytes")
      .eq("id", userId)
      .single();
    expect(user?.bytes).toBe(20);
  });

  it("rejects an occupied slot without debiting", async () => {
    await admin.rpc("build_room", {
      p_user_id: userId,
      p_slot: 3,
      p_kind: "cache_storage",
    });

    const again = await admin.rpc("build_room", {
      p_user_id: userId,
      p_slot: 3,
      p_kind: "cache_storage",
    });
    expect(again.error?.message).toContain("slot_occupied");

    const { data: user } = await admin
      .from("users")
      .select("bytes")
      .eq("id", userId)
      .single();
    expect(user?.bytes).toBe(50);
  });

  it("seals the lower floor until an Elevator stands on the ground floor", async () => {
    await admin.from("users").update({ bytes: 300 }).eq("id", userId);
    const build = (slot: number, kind: string) => admin.rpc("build_room", { p_user_id: userId, p_slot: slot, p_kind: kind });

    expect((await build(5, "cache_storage")).error?.message).toContain("no_elevator");
    expect((await build(5, "elevator")).error?.message).toContain("elevator_ground_only");
    expect((await build(4, "elevator")).error).toBeNull();
    expect((await build(5, "cache_storage")).error).toBeNull();
    expect((await build(9, "dorm")).data).toBe(300 - 120 - 50 - 100);
    expect((await build(10, "dorm")).error).toBeTruthy(); // outside the bunker
  });

  it("rejects an unknown kind and an out-of-range slot", async () => {
    const badKind = await admin.rpc("build_room", {
      p_user_id: userId,
      p_slot: 1,
      p_kind: "jacuzzi",
    });
    expect(badKind.error?.message).toContain("unknown kind");

    const badSlot = await admin.rpc("build_room", {
      p_user_id: userId,
      p_slot: 0,
      p_kind: "cache_storage",
    });
    expect(badSlot.error).not.toBeNull();
  });
});
