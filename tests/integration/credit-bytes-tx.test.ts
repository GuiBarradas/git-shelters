import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Integration tests for credit_bytes_tx() against the remote dev Supabase.
 *
 * These tests mutate the dev project. They:
 *   - Read the existing GuiBarradas user as the test fixture.
 *   - Snapshot their bytes balance, run assertions, restore on teardown.
 *   - Use a unique TEST_RUN UUID in source_ref so reruns never collide.
 *   - Use a dedicated `source = 'integration_test'` so cleanup is targeted.
 *
 * If the dev project schema is ahead/behind these tests, this file fails
 * loudly — exactly the signal you want for an integration suite.
 *
 * Concurrency note: this suite mutates `users.bytes` for the fixture user.
 * Tests inside a Vitest file are SEQUENTIAL by default, which is what we
 * rely on. Do NOT split the assertions into multiple integration test
 * files that would hit the same fixture user — Vitest runs files in
 * parallel by default and the snapshots would race.
 */

const TEST_RUN = crypto.randomUUID();
const TEST_SOURCE = "integration_test";
const TEST_LOGIN = "GuiBarradas";

describe("credit_bytes_tx", () => {
  const admin = createAdminClient();
  let testUserId: string;
  let initialBytes: number;

  beforeAll(async () => {
    const { data, error } = await admin
      .from("users")
      .select("id, bytes")
      .eq("github_login", TEST_LOGIN)
      .single();

    if (error || !data) {
      throw new Error(
        `Test fixture user '${TEST_LOGIN}' not found in public.users: ${
          error?.message ?? "no row"
        }`,
      );
    }

    testUserId = data.id;
    initialBytes = data.bytes;
  });

  afterAll(async () => {
    // Wipe ledger rows written by this run.
    await admin
      .from("byte_transactions")
      .delete()
      .eq("user_id", testUserId)
      .like("source_ref", `${TEST_RUN}-%`);

    // Restore the user's bytes to whatever they were before the suite ran.
    await admin
      .from("users")
      .update({ bytes: initialBytes })
      .eq("id", testUserId);
  });

  beforeEach(async () => {
    // Deterministic starting balance per test.
    await admin.from("users").update({ bytes: 100 }).eq("id", testUserId);
  });

  it("credits delta and returns the new balance", async () => {
    const { data, error } = await admin.rpc("credit_bytes_tx", {
      p_user_id: testUserId,
      p_delta: 5,
      p_source: TEST_SOURCE,
      p_source_ref: `${TEST_RUN}-credit-1`,
    });

    expect(error).toBeNull();
    expect(data).toBe(105);
  });

  it("is idempotent: a duplicate (user, source, source_ref) returns the historical balance and inserts no new row", async () => {
    const sourceRef = `${TEST_RUN}-idempotency`;

    const first = await admin.rpc("credit_bytes_tx", {
      p_user_id: testUserId,
      p_delta: 7,
      p_source: TEST_SOURCE,
      p_source_ref: sourceRef,
    });
    expect(first.error).toBeNull();
    expect(first.data).toBe(107);

    const second = await admin.rpc("credit_bytes_tx", {
      p_user_id: testUserId,
      p_delta: 7,
      p_source: TEST_SOURCE,
      p_source_ref: sourceRef,
    });
    expect(second.error).toBeNull();
    // Historical, NOT 114. The second call is a no-op.
    expect(second.data).toBe(107);

    const { count } = await admin
      .from("byte_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", testUserId)
      .eq("source_ref", sourceRef);
    expect(count).toBe(1);

    const { data: user } = await admin
      .from("users")
      .select("bytes")
      .eq("id", testUserId)
      .single();
    expect(user?.bytes).toBe(107);
  });

  it("accumulates distinct credits on the same user", async () => {
    const r1 = await admin.rpc("credit_bytes_tx", {
      p_user_id: testUserId,
      p_delta: 3,
      p_source: TEST_SOURCE,
      p_source_ref: `${TEST_RUN}-multi-A`,
    });
    expect(r1.data).toBe(103);

    const r2 = await admin.rpc("credit_bytes_tx", {
      p_user_id: testUserId,
      p_delta: 4,
      p_source: TEST_SOURCE,
      p_source_ref: `${TEST_RUN}-multi-B`,
    });
    expect(r2.data).toBe(107);
  });

  it("writes balance_after that matches the actual post-state", async () => {
    const sourceRef = `${TEST_RUN}-balance-after`;

    await admin.rpc("credit_bytes_tx", {
      p_user_id: testUserId,
      p_delta: 12,
      p_source: TEST_SOURCE,
      p_source_ref: sourceRef,
    });

    const { data: row } = await admin
      .from("byte_transactions")
      .select("balance_after, delta")
      .eq("user_id", testUserId)
      .eq("source_ref", sourceRef)
      .single();

    expect(row?.delta).toBe(12);
    expect(row?.balance_after).toBe(112);
  });

  it("denies execute to anonymous clients (defense against accidental REGRANT)", async () => {
    // Per ADR 0004, only service_role may EXECUTE this function. If a
    // future migration drifts and re-grants to anon (or `public`), this
    // test fails loudly — preventing a "credit_bytes_tx is internet-callable
    // and mints bytes for anyone" disaster.
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await anon.rpc("credit_bytes_tx", {
      p_user_id: testUserId,
      p_delta: 999,
      p_source: TEST_SOURCE,
      p_source_ref: `${TEST_RUN}-anon-denied`,
    });

    expect(error).not.toBeNull();
    // PostgREST surfaces "function ... not found" or "permission denied".
    // Either is acceptable — both mean "anon cannot mint bytes".
    expect(error?.message).toMatch(/permission denied|not found|does not exist/i);
  });
});
