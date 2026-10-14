// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateBunker } from "@/lib/visuals/generate";
import { activityFromCreditAt, loadPublicVisuals, loadUserVisuals } from "@/lib/visuals/server";

/** Fake PostgREST client: every builder call is logged, awaiting resolves the table's result. */
type Result = { data: unknown; error: unknown };
const calls: string[][] = [];
let results: Record<string, Result> = {};
function fakeClient() {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get: (_, key) =>
            key === "then"
              ? (ok: (r: Result) => unknown) => ok(results[table]!)
              : (...args: unknown[]) => (calls.push([table, String(key), ...args.map(String)]), builder),
        },
      );
      return builder;
    },
  };
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient() }));

const UID = "10f13b40-0000-4000-8000-000000000000";
const MAIN = { slot: 0, kind: "main" } as const;
const WRITES = ["insert", "update", "upsert", "delete", "rpc"];

beforeEach(() => {
  calls.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T18:00:00Z"));
  results = {
    users: { data: { github_id: 87228787, deleted_at: null }, error: null },
    byte_transactions: { data: null, error: null },
  };
});
afterEach(() => vi.useRealTimers());

describe("activityFromCreditAt", () => {
  it.each([["2026-10-13", 1], ["2026-10-12", 0.85], ["2026-10-11", 0.7], ["2026-10-06", 0.2], ["2026-10-05", 0]])(
    "maps credited activity on %s to %s", (day, activity) => {
      expect(activityFromCreditAt(`${day}T23:59:59Z`, Date.now())).toBe(activity);
    },
  );
  it("leaves missing and invalid data unknown", () => {
    expect(activityFromCreditAt(null, Date.now())).toBeNull();
    expect(activityFromCreditAt("invalid", Date.now())).toBeNull();
  });
});

describe("loadUserVisuals", () => {
  it("seeds from github_id with a narrow owner read and no writes", async () => {
    const bunker = await loadUserVisuals(fakeClient() as never, UID, [{ slot: 1, kind: "dorm" }]);
    expect(bunker).toEqual(generateBunker(87228787, undefined, [MAIN, { slot: 1, kind: "dorm" }]));
    expect(calls).toContainEqual(["users", "select", "github_id, deleted_at"]);
    expect(calls).toContainEqual(["users", "eq", "id", UID]);
    expect(calls.some(([, m]) => WRITES.includes(m!))).toBe(false);
  });

  it("keeps only real catalog rooms next to the built-in main", async () => {
    const bunker = await loadUserVisuals(fakeClient() as never, UID, [
      { slot: 2, kind: "workshop" },
      { slot: 0, kind: "dorm" },
      { slot: 12, kind: "dorm" },
      { slot: 3, kind: "jacuzzi" },
      { slot: 2, kind: "dorm" },
    ]);
    expect(bunker?.rooms.map((r) => [r.slot, r.kind])).toEqual([
      [0, "main"],
      [2, "workshop"],
    ]);
  });

  it("reads the latest credited GitHub activity for this account only", async () => {
    results.byte_transactions = { data: { created_at: "2026-10-11T01:00:00Z" }, error: null };
    const lit = await loadUserVisuals(fakeClient() as never, UID, []);
    expect(lit).toEqual(generateBunker(87228787, { recentActivity: 0.7 }, [MAIN]));
    expect(calls).toContainEqual(["byte_transactions", "eq", "user_id", UID]);
    expect(calls).toContainEqual(["byte_transactions", "in", "source", "github_sync,backfill"]);
    expect(calls).toContainEqual(["byte_transactions", "limit", "1"]);
  });

  it.each([
    ["missing", null],
    ["deleted", { github_id: 87228787, deleted_at: "2026-09-01T00:00:00Z" }],
    ["placeholder id 0", { github_id: 0, deleted_at: null }],
    ["unsafe id", { github_id: 2 ** 60, deleted_at: null }],
  ])("returns null for a %s account, never a fake seed", async (_, row) => {
    results.users = { data: row, error: null };
    expect(await loadUserVisuals(fakeClient() as never, UID, [])).toBeNull();
  });

  it("throws on a query failure", async () => {
    results.users = { data: null, error: new Error("db down") };
    await expect(loadUserVisuals(fakeClient() as never, UID, [])).rejects.toThrow("db down");
  });
});

describe("loadPublicVisuals", () => {
  beforeEach(() => {
    results.users = { data: { id: UID, github_id: 87228787, deleted_at: null }, error: null };
    results.rooms = { data: [{ slot: 1, kind: "cache_storage" }], error: null };
  });

  it("is stable across a login rename: the seed is the GitHub user id", async () => {
    const before = await loadPublicVisuals("OldName");
    const after = await loadPublicVisuals("new-name");
    expect(after).toEqual(before);
    expect(before?.identity.githubId).toBe("87228787");
  });

  it("matches the owner's visual state for the same activity data", async () => {
    results.byte_transactions = { data: { created_at: "2026-10-06T01:00:00Z" }, error: null };
    expect(await loadPublicVisuals("GuiBarradas")).toEqual(
      await loadUserVisuals(fakeClient() as never, UID, [{ slot: 1, kind: "cache_storage" }]),
    );
  });

  it("carries no internal id or private field", async () => {
    const json = JSON.stringify(await loadPublicVisuals("GuiBarradas"));
    expect(json).not.toContain(UID);
    for (const field of ["email", "deleted_at", "bytes", "github_login", "user_id"]) expect(json).not.toContain(`"${field}"`);
    expect(calls.some(([, m]) => WRITES.includes(m!))).toBe(false);
    expect(calls).toContainEqual(["users", "select", "id, github_id, deleted_at"]);
  });

  it("rejects bad logins before touching the database", async () => {
    expect(await loadPublicVisuals("a%b")).toBeNull();
    expect(await loadPublicVisuals("x".repeat(40))).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null for unknown or deleted users", async () => {
    results.users = { data: null, error: null };
    expect(await loadPublicVisuals("ghost")).toBeNull();
    results.users = { data: { id: UID, github_id: 1, deleted_at: "2026-09-01T00:00:00Z" }, error: null };
    expect(await loadPublicVisuals("gone")).toBeNull();
  });

  it("throws when rooms cannot be read", async () => {
    results.rooms = { data: null, error: new Error("rooms down") };
    await expect(loadPublicVisuals("GuiBarradas")).rejects.toThrow("rooms down");
  });
});
