import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { track } from "@/lib/analytics/track";
import { deleteAccount, exportAccount } from "@/lib/api/account";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Integration tests for the LGPD operations (ADR 0007) against the real
 * dev Supabase, with a throwaway auth user created for this run. The
 * signup trigger gives it a public.users row; we then build a room and
 * resolve an event so every table has something to export and delete.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const LOGIN = `lgpd-test-${RUN}`;

describe("account export and deletion", () => {
  const admin = createAdminClient();
  let userId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${LOGIN}@example.invalid`,
      email_confirm: true,
      user_metadata: { user_name: LOGIN, provider_id: "424242" },
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    userId = data.user.id;

    await admin.from("users").update({ bytes: 200 }).eq("id", userId);
    await admin.rpc("build_room", { p_user_id: userId, p_slot: 1, p_kind: "cache_storage" });
    await admin.rpc("resolve_daily_event", { p_user_id: userId, p_choice: "a" });
    await track(admin, userId, "room_built", { room_type: "cache_storage", level: 1, bytes_spent: 50 });
  });

  afterAll(async () => {
    // Belt and braces: if a test failed before deletion, do not leave junk.
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("audit_log").delete().eq("user_id", userId);
  });

  it("exports every table for the user, without internal ids or other users' rows", async () => {
    const data = await exportAccount(admin, userId);
    expect(data).not.toBeNull();

    expect(data!.account).toMatchObject({ github_login: LOGIN, github_id: 424242 });
    expect(data!.rooms).toEqual([
      expect.objectContaining({ slot: 1, kind: "cache_storage", level: 1 }),
    ]);
    expect(data!.daily_event_outcomes).toHaveLength(1);
    expect(data!.byte_transactions.map((t) => t.source).sort()).toEqual(["build", "daily_event"]);
    expect(data!.analytics_events.map((e) => e.event_name)).toEqual(["room_built"]);

    const json = JSON.stringify(data);
    expect(json).not.toContain(userId);
    expect(json).not.toContain('"id"');
    expect(json).not.toContain("GuiBarradas");

    const { data: audit } = await admin
      .from("audit_log")
      .select("action")
      .eq("user_id", userId)
      .eq("action", "account.export");
    expect(audit).toHaveLength(1);
  });

  it("returns null for an unknown user", async () => {
    expect(await exportAccount(admin, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("hard-deletes the user and everything that hangs off them, keeping the audit row", async () => {
    await deleteAccount(admin, userId);

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    expect(authUser.user).toBeNull();

    const counts = await Promise.all([
      admin.from("users").select("*", { count: "exact", head: true }).eq("id", userId),
      admin.from("byte_transactions").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("rooms").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("daily_event_outcomes").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("github_sync_state").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    expect(counts.map((r) => r.count)).toEqual([0, 0, 0, 0, 0]);

    // Analytics rows survive anonymised: the aggregate stays, the person is gone.
    const { count: named } = await admin
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(named).toBe(0);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action")
      .eq("user_id", userId)
      .order("occurred_at");
    expect(audit?.map((a) => a.action)).toEqual(["account.export", "account.delete"]);
  });
});
