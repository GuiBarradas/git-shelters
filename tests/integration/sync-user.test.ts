import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { syncUser } from "@/lib/github/sync";
import { createAdminClient } from "@/lib/supabase/admin";

import { createThrowawayUser, type ThrowawayUser } from "./fixture";

/**
 * Integration tests for syncUser(): real Supabase, fake GitHub.
 *
 * `fetch` is stubbed so the test controls the event feed; the ledger, the
 * sync-state row and both RPCs are the real ones. Same fixture discipline
 * as the other suites: a throwaway auth user per run, wiped between
 * tests, hard-deleted on teardown.
 */

let TEST_LOGIN = ""; // assigned from the throwaway user in beforeAll
const NOW = new Date("2026-09-22T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

type Ev = { id: string; type: string; created_at: string; actor?: { login: string }; payload?: { push_id?: number; size?: number } };

const push = (id: number, createdAt: string, size = 1): Ev => ({
  id: String(id),
  type: "PushEvent",
  created_at: createdAt,
  actor: { login: TEST_LOGIN },
  payload: { push_id: id, size },
});

const realFetch = globalThis.fetch;

/** Fakes api.github.com only; Supabase traffic goes through the real fetch. */
function stubGitHub(respond: (page: number) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname !== "api.github.com") return realFetch(input, init);
      return respond(Number(url.searchParams.get("page") ?? "1"));
    }),
  );
}

const pages = (feed: Ev[][]) => (page: number) =>
  new Response(JSON.stringify(feed[page - 1] ?? []), { status: 200 });

describe("syncUser", () => {
  const admin = createAdminClient();
  let user: ThrowawayUser;
  let userId: string;

  async function wipe() {
    await admin.from("github_sync_state").delete().eq("user_id", userId);
    await admin
      .from("byte_transactions")
      .delete()
      .eq("user_id", userId)
      .in("source", ["backfill", "github_sync"])
      .like("source_ref", "push:9%");
  }

  beforeAll(async () => {
    user = await createThrowawayUser(admin, "sync");
    userId = user.id;
    TEST_LOGIN = user.login;
  });

  afterAll(() => user.destroy());

  beforeEach(async () => {
    await wipe();
    await admin.from("users").update({ bytes: 0 }).eq("id", userId);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("backfills the last 30 days on first contact, sets the cursor and marks done", async () => {
    stubGitHub(pages([[push(9_000_003, daysAgo(1), 2), push(9_000_002, daysAgo(29)), push(9_000_001, daysAgo(31), 5)]]));

    const result = await syncUser(admin, { id: userId, github_login: TEST_LOGIN }, NOW);
    expect(result).toEqual({ mode: "backfill", credited: 2 });

    const { data: user } = await admin.from("users").select("bytes").eq("id", userId).single();
    expect(user?.bytes).toBe(3); // 2 + 1; the 31-day-old push is outside the window

    const { data: state } = await admin
      .from("github_sync_state")
      .select("backfill_status, last_event_id")
      .eq("user_id", userId)
      .single();
    expect(state).toEqual({ backfill_status: "done", last_event_id: "9000003" });

    const { data: rows } = await admin
      .from("byte_transactions")
      .select("source")
      .eq("user_id", userId)
      .like("source_ref", "push:9%");
    expect(rows?.every((r) => r.source === "backfill")).toBe(true);
  });

  it("then credits only events newer than the cursor as github_sync", async () => {
    stubGitHub(pages([[push(9_000_002, daysAgo(2)), push(9_000_001, daysAgo(3))]]));
    await syncUser(admin, { id: userId, github_login: TEST_LOGIN }, NOW);

    // Same feed plus one new push. The two old ones must not be re-credited.
    stubGitHub(pages([[push(9_000_010, daysAgo(0)), push(9_000_002, daysAgo(2)), push(9_000_001, daysAgo(3))]]));
    const result = await syncUser(admin, { id: userId, github_login: TEST_LOGIN }, NOW);
    expect(result).toEqual({ mode: "incremental", credited: 1 });

    const { data: user } = await admin.from("users").select("bytes").eq("id", userId).single();
    expect(user?.bytes).toBe(3);

    const { data: state } = await admin
      .from("github_sync_state")
      .select("last_event_id")
      .eq("user_id", userId)
      .single();
    expect(state?.last_event_id).toBe("9000010");
  });

  it("marks the backfill failed and rethrows when GitHub is down, then retries next time", async () => {
    stubGitHub(() => new Response("rate limited", { status: 403 }));
    await expect(syncUser(admin, { id: userId, github_login: TEST_LOGIN }, NOW)).rejects.toThrow(/403/);

    const { data: state } = await admin
      .from("github_sync_state")
      .select("backfill_status")
      .eq("user_id", userId)
      .single();
    expect(state?.backfill_status).toBe("failed");

    stubGitHub(pages([[push(9_000_001, daysAgo(1))]]));
    const result = await syncUser(admin, { id: userId, github_login: TEST_LOGIN }, NOW);
    expect(result).toEqual({ mode: "backfill", credited: 1 });
  });

  it("does not re-credit pushes an older github_sync run already paid", async () => {
    await admin.rpc("credit_bytes_tx", {
      p_user_id: userId,
      p_delta: 1,
      p_source: "github_sync",
      p_source_ref: "push:9000001",
    });
    stubGitHub(pages([[push(9_000_002, daysAgo(1)), push(9_000_001, daysAgo(2))]]));

    const result = await syncUser(admin, { id: userId, github_login: TEST_LOGIN }, NOW);
    expect(result).toEqual({ mode: "backfill", credited: 1 });

    const { data: user } = await admin.from("users").select("bytes").eq("id", userId).single();
    expect(user?.bytes).toBe(2); // 1 legacy github_sync + 1 backfill, not 3
  });

  it("skips a user whose backfill is in progress", async () => {
    await admin.from("github_sync_state").upsert({
      user_id: userId,
      backfill_status: "in_progress",
      backfill_at: NOW.toISOString(),
    });
    stubGitHub(pages([[push(9_000_001, daysAgo(1))]]));
    const result = await syncUser(admin, { id: userId, github_login: TEST_LOGIN }, NOW);
    expect(result).toEqual({ mode: "skipped", reason: "in_progress" });
  });

  it("skips a user without a GitHub login", async () => {
    const result = await syncUser(admin, { id: userId, github_login: null }, NOW);
    expect(result).toEqual({ mode: "skipped", reason: "no_login" });
  });
});
