import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Integration tests for credit_bytes_tx_batch() against the remote dev
 * Supabase. Mirrors the per-row test harness from credit-bytes-tx.test.ts.
 *
 * Concurrency note: tests inside a Vitest file run SEQUENTIALLY by
 * default. Do NOT split assertions into multiple integration test files
 * touching the same fixture user — Vitest parallelises files and the
 * users.bytes snapshots would race.
 */

const TEST_RUN = crypto.randomUUID();
const TEST_SOURCE = "integration_test";
const TEST_LOGIN = "GuiBarradas";

describe("credit_bytes_tx_batch", () => {
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
    await admin
      .from("byte_transactions")
      .delete()
      .eq("user_id", testUserId)
      .like("source_ref", `${TEST_RUN}-%`);

    await admin
      .from("users")
      .update({ bytes: initialBytes })
      .eq("id", testUserId);
  });

  beforeEach(async () => {
    await admin.from("users").update({ bytes: 100 }).eq("id", testUserId);
  });

  it("credits every entry in a batch and returns the final balance", async () => {
    const credits = [
      { delta: 1, source: TEST_SOURCE, source_ref: `${TEST_RUN}-batch-A` },
      { delta: 2, source: TEST_SOURCE, source_ref: `${TEST_RUN}-batch-B` },
      { delta: 3, source: TEST_SOURCE, source_ref: `${TEST_RUN}-batch-C` },
    ];

    const { data, error } = await admin.rpc("credit_bytes_tx_batch", {
      p_user_id: testUserId,
      p_credits: credits,
    });

    expect(error).toBeNull();
    expect(data).toBe(106);

    const { data: user } = await admin
      .from("users")
      .select("bytes")
      .eq("id", testUserId)
      .single();
    expect(user?.bytes).toBe(106);
  });

  it("returns the user's current balance for an empty batch", async () => {
    const { data, error } = await admin.rpc("credit_bytes_tx_batch", {
      p_user_id: testUserId,
      p_credits: [],
    });

    expect(error).toBeNull();
    expect(data).toBe(100);
  });

  it("dedups duplicate source_refs within a single batch", async () => {
    const sourceRef = `${TEST_RUN}-dup-within`;
    const credits = [
      { delta: 5, source: TEST_SOURCE, source_ref: sourceRef },
      { delta: 5, source: TEST_SOURCE, source_ref: sourceRef },
      { delta: 5, source: TEST_SOURCE, source_ref: sourceRef },
    ];

    const { data, error } = await admin.rpc("credit_bytes_tx_batch", {
      p_user_id: testUserId,
      p_credits: credits,
    });

    expect(error).toBeNull();
    // Only the first INSERT wins; the next two hit the unique constraint
    // and become no-ops. Final balance = 100 + 5, not 100 + 15.
    expect(data).toBe(105);

    const { count } = await admin
      .from("byte_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", testUserId)
      .eq("source_ref", sourceRef);
    expect(count).toBe(1);
  });

  it("dedups source_refs against a previous batch (cron-overlap scenario)", async () => {
    const sharedRef = `${TEST_RUN}-cross-batch`;

    const first = await admin.rpc("credit_bytes_tx_batch", {
      p_user_id: testUserId,
      p_credits: [{ delta: 4, source: TEST_SOURCE, source_ref: sharedRef }],
    });
    expect(first.data).toBe(104);

    // Second batch arrives with the same source_ref (a cron retry, an
    // overlapping cron run, or the on-demand "Sync" button racing the
    // cron). The unique constraint absorbs it.
    const second = await admin.rpc("credit_bytes_tx_batch", {
      p_user_id: testUserId,
      p_credits: [
        { delta: 4, source: TEST_SOURCE, source_ref: sharedRef }, // dup
        { delta: 7, source: TEST_SOURCE, source_ref: `${TEST_RUN}-cross-new` }, // new
      ],
    });
    expect(second.error).toBeNull();
    // 104 + 0 (dup) + 7 (new) = 111.
    expect(second.data).toBe(111);
  });

  it("rolls back the entire batch when any single credit raises", async () => {
    // 'bogus-uuid' is not a UUID, so casting to bigint inside
    // credit_bytes_tx will fail. The batch should abort cleanly.
    const credits = [
      { delta: 10, source: TEST_SOURCE, source_ref: `${TEST_RUN}-rollback-A` },
      { delta: "not-a-number", source: TEST_SOURCE, source_ref: `${TEST_RUN}-rollback-B` },
    ];

    const { error } = await admin.rpc("credit_bytes_tx_batch", {
      p_user_id: testUserId,
      // Intentionally malformed: 'not-a-number' fails the bigint cast
      // inside credit_bytes_tx, which aborts the batch's transaction.
      p_credits: credits,
    });

    expect(error).not.toBeNull();

    // Neither row should exist; the batch's transaction rolled back.
    const { count } = await admin
      .from("byte_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", testUserId)
      .like("source_ref", `${TEST_RUN}-rollback-%`);
    expect(count).toBe(0);

    const { data: user } = await admin
      .from("users")
      .select("bytes")
      .eq("id", testUserId)
      .single();
    expect(user?.bytes).toBe(100);
  });

  it("denies execute to anonymous clients", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await anon.rpc("credit_bytes_tx_batch", {
      p_user_id: testUserId,
      p_credits: [
        { delta: 999, source: TEST_SOURCE, source_ref: `${TEST_RUN}-anon-denied` },
      ],
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied|not found|does not exist/i);
  });
});
