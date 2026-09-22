import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { settleResources } from "@/lib/economy/resources";
import { loadForks } from "@/lib/forks/load";
import { createAdminClient } from "@/lib/supabase/admin";

import { createThrowawayUser, type ThrowawayUser } from "./fixture";

/**
 * Integration tests for the resource tick and job assignment against the
 * real dev Supabase: apply_tick writes once per stored tick, assign_fork
 * respects ownership and built rooms, and settleResources ties them to
 * the pure simulation.
 */

describe("resources and jobs", () => {
  const admin = createAdminClient();
  let user: ThrowawayUser;

  beforeAll(async () => {
    user = await createThrowawayUser(admin, "resources");
    await admin.from("users").update({ bytes: 200 }).eq("id", user.id);
    await admin.rpc("build_room", { p_user_id: user.id, p_slot: 1, p_kind: "cache_storage" });
    await admin.rpc("build_room", { p_user_id: user.id, p_slot: 2, p_kind: "power_plant" });
  });

  afterAll(() => user.destroy());

  it("apply_tick writes once: a stale expected tick is rejected", async () => {
    const { data: row } = await admin.from("users").select("last_tick_at").eq("id", user.id).single();
    const t1 = new Date(Date.parse(row!.last_tick_at) + 60_000).toISOString();

    const first = await admin.rpc("apply_tick", {
      p_user_id: user.id,
      p_expected_tick: row!.last_tick_at,
      p_new_tick: t1,
      p_cache: 33,
      p_uptime: 140, // clamps to 100
      p_payload: 5,
    });
    expect(first.error).toBeNull();
    expect(first.data).toBe(true);

    const second = await admin.rpc("apply_tick", {
      p_user_id: user.id,
      p_expected_tick: row!.last_tick_at, // stale
      p_new_tick: new Date(Date.parse(t1) + 60_000).toISOString(),
      p_cache: 1,
      p_uptime: 1,
      p_payload: 1,
    });
    expect(second.data).toBe(false);

    const { data: after } = await admin.from("users").select("cache, uptime, payload, last_tick_at").eq("id", user.id).single();
    expect(after).toEqual({ cache: 33, uptime: 100, payload: 5, last_tick_at: expect.stringContaining(t1.slice(0, 19)) });
  });

  it("assign_fork moves a survivor into a built room and refuses an unbuilt one", async () => {
    const [starter] = await loadForks(admin, admin, user.id);
    expect(starter).toBeDefined();

    const ok = await admin.rpc("assign_fork", { p_user_id: user.id, p_fork_id: starter!.id, p_slot: 1 });
    expect(ok.error).toBeNull();
    expect((await loadForks(admin, admin, user.id))[0]?.roomSlot).toBe(1);

    const unbuilt = await admin.rpc("assign_fork", { p_user_id: user.id, p_fork_id: starter!.id, p_slot: 3 });
    expect(unbuilt.error?.message).toContain("room_not_built");

    const notMine = await admin.rpc("assign_fork", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_fork_id: starter!.id,
      p_slot: 0,
    });
    expect(notMine.error?.message).toContain("fork_not_found");
  });

  it("settleResources runs the simulation for the elapsed time and stores it", async () => {
    // Cook assigned (from the previous test), 1 survivor, both rooms built.
    const tenHoursAgo = new Date(Date.now() - 10 * 3_600_000).toISOString();
    await admin.from("users").update({ cache: 20, uptime: 60, last_tick_at: tenHoursAgo }).eq("id", user.id);

    const forks = await loadForks(admin, admin, user.id);
    const rooms = [
      { slot: 1 as const, kind: "cache_storage" as const },
      { slot: 2 as const, kind: "power_plant" as const },
    ];
    const result = await settleResources(admin, admin, user.id, forks, rooms);

    // cache: 20 + (6 cooked - 1 eaten) * 10h = 70 ; uptime: 60 - 8 * 10h = 0 → blackout
    expect(result.cache).toBe(70);
    expect(result.uptime).toBe(0);
    expect(result.blackout).toBe(true);
    expect(result.starved).toBe(false);

    expect(result.payload).toBe(0); // no Workshop yet

    const { data: stored } = await admin.from("users").select("cache, uptime, payload").eq("id", user.id).single();
    expect(stored).toEqual({ cache: 70, uptime: 0, payload: 0 });

    // Immediately again: nothing new to write, same numbers.
    const again = await settleResources(admin, admin, user.id, forks, rooms);
    expect(again.cache).toBe(70);
  });
});
