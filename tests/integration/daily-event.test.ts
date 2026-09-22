import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { parseOption } from "@/lib/events/option";
import { createAdminClient } from "@/lib/supabase/admin";

import { createThrowawayUser, type ThrowawayUser } from "./fixture";

/**
 * Integration tests for pick_daily_event() and resolve_daily_event()
 * against the remote dev Supabase. Same fixture discipline as the other
 * integration suites: throwaway auth user, wiped between tests, gone on teardown.
 */


describe("daily event", () => {
  const admin = createAdminClient();
  let user: ThrowawayUser;
  let userId: string;

  async function wipe() {
    await admin.from("daily_event_outcomes").delete().eq("user_id", userId);
    await admin
      .from("byte_transactions")
      .delete()
      .eq("user_id", userId)
      .eq("source", "daily_event");
  }

  beforeAll(async () => {
    user = await createThrowawayUser(admin, "event");
    userId = user.id;
  });

  afterAll(() => user.destroy());

  beforeEach(async () => {
    await wipe();
    await admin.from("users").update({ bytes: 100 }).eq("id", userId);
  });

  it("picks an active catalog event deterministically", async () => {
    const first = await admin.rpc("pick_daily_event", { p_user_id: userId });
    const second = await admin.rpc("pick_daily_event", { p_user_id: userId });
    expect(first.error).toBeNull();
    expect(first.data).toBeTruthy();
    expect(second.data).toBe(first.data);

    const { data: event } = await admin
      .from("daily_events_catalog")
      .select("active")
      .eq("id", first.data!)
      .single();
    expect(event?.active).toBe(true);
  });

  it("resolves today's event, logs the snapshot and credits bytes_delta through the ledger", async () => {
    const { data: eventId } = await admin.rpc("pick_daily_event", { p_user_id: userId });
    const { data: event } = await admin
      .from("daily_events_catalog")
      .select("option_a")
      .eq("id", eventId!)
      .single();
    const expected = parseOption(event?.option_a);
    expect(expected).not.toBeNull();

    const { data, error } = await admin.rpc("resolve_daily_event", {
      p_user_id: userId,
      p_choice: "a",
    });
    expect(error).toBeNull();
    expect(parseOption(data)).toEqual(expected);

    const { data: outcome } = await admin
      .from("daily_event_outcomes")
      .select("event_id, choice, outcome_json")
      .eq("user_id", userId)
      .single();
    expect(outcome?.event_id).toBe(eventId);
    expect(outcome?.choice).toBe("a");
    expect(parseOption(outcome?.outcome_json)).toEqual(expected);

    const { data: user } = await admin
      .from("users")
      .select("bytes")
      .eq("id", userId)
      .single();
    expect(user?.bytes).toBe(100 + expected!.bytes_delta);

    const { data: tx } = await admin
      .from("byte_transactions")
      .select("delta, source_ref")
      .eq("user_id", userId)
      .eq("source", "daily_event")
      .single();
    expect(tx?.delta).toBe(expected!.bytes_delta);
    expect(tx?.source_ref).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects a second resolution on the same day without crediting again", async () => {
    const first = await admin.rpc("resolve_daily_event", {
      p_user_id: userId,
      p_choice: "b",
    });
    expect(first.error).toBeNull();
    const delta = parseOption(first.data)!.bytes_delta;

    const second = await admin.rpc("resolve_daily_event", {
      p_user_id: userId,
      p_choice: "a",
    });
    expect(second.error?.message).toContain("already_resolved_today");

    const { data: user } = await admin
      .from("users")
      .select("bytes")
      .eq("id", userId)
      .single();
    expect(user?.bytes).toBe(100 + delta);
  });

  it("rejects an invalid choice", async () => {
    const { error } = await admin.rpc("resolve_daily_event", {
      p_user_id: userId,
      p_choice: "c",
    });
    expect(error?.message).toContain("invalid choice");
  });
});
