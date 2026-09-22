import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ONCE, SESSION_WINDOW_MS, track, trackSessionStart } from "@/lib/analytics/track";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Integration tests for the analytics helpers (ADR 0008) with a throwaway
 * auth user, so nothing touches a real player's rows.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const LOGIN = `analytics-test-${RUN}`;

describe("analytics", () => {
  const admin = createAdminClient();
  let userId: string;
  let createdAt: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${LOGIN}@example.invalid`,
      email_confirm: true,
      user_metadata: { user_name: LOGIN, provider_id: "424243" },
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    userId = data.user.id;
    createdAt = data.user.created_at;
  });

  afterAll(async () => {
    // Deleting the user would only anonymise these rows (ON DELETE SET
    // NULL); sweep them first so test runs do not pile up as ghosts.
    await admin.from("analytics_events").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  });

  it("track() writes the event with typed props", async () => {
    await track(admin, userId, "room_built", { room_type: "cache_storage", level: 1, bytes_spent: 50 });

    const { data } = await admin
      .from("analytics_events")
      .select("event_name, props_json")
      .eq("user_id", userId)
      .eq("event_name", "room_built");
    expect(data).toEqual([
      { event_name: "room_built", props_json: { room_type: "cache_storage", level: 1, bytes_spent: 50 } },
    ]);
  });

  it("a ONCE-keyed event lands a single time even when written concurrently", async () => {
    const props = { room_type: "cache_storage", time_since_signup_ms: 10 };
    const results = await Promise.all([
      track(admin, userId, "first_build", props, ONCE),
      track(admin, userId, "first_build", props, ONCE),
      track(admin, userId, "first_build", props, ONCE),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const { count } = await admin
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_name", "first_build");
    expect(count).toBe(1);
  });

  it("trackSessionStart() counts one start per 30-minute bucket, even concurrently", async () => {
    const t0 = new Date("2026-09-22T12:00:00Z");
    const t1 = new Date(t0.getTime() + SESSION_WINDOW_MS - 1000); // same bucket
    const t2 = new Date(t0.getTime() + SESSION_WINDOW_MS + 1000); // next bucket

    const sameBucket = await Promise.all([
      trackSessionStart(admin, { id: userId, created_at: createdAt }, t0),
      trackSessionStart(admin, { id: userId, created_at: createdAt }, t1),
      trackSessionStart(admin, { id: userId, created_at: createdAt }, t0),
    ]);
    expect(sameBucket.filter(Boolean)).toHaveLength(1);

    const { data: rows } = await admin
      .from("analytics_events")
      .select("props_json")
      .eq("user_id", userId)
      .eq("event_name", "session_start");
    expect(rows).toHaveLength(1);
    expect(rows![0]!.props_json).toMatchObject({ days_since_last_session: null });

    expect(await trackSessionStart(admin, { id: userId, created_at: createdAt }, t2)).toBe(true);

    const { count } = await admin
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_name", "session_start");
    expect(count).toBe(2);
  });
});
