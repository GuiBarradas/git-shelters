// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getWorldMap, toMapPin } from "@/lib/api/world-map";

/** Fake PostgREST client: every builder call is logged, awaiting resolves the table's result. */
type Result = { data: unknown; error: unknown };
const calls: string[][] = [];
let results: Record<string, Result> = {};
function fakeClient() {
  return {
    from(table: string) {
      calls.push([table, "from"]);
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get: (_, key) =>
            key === "then"
              ? (ok: (r: Result) => unknown) => ok(results[table]!)
              : (...args: unknown[]) => (calls.push([table, String(key), ...args.map((a) => JSON.stringify(a))]), builder),
        },
      );
      return builder;
    },
  };
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient() }));

/** Same gate as the public profile (ADR 0001): the mapper is the whitelist. */
const FORBIDDEN = ["email", "id", "github_id", "deleted_at", "last_seen_at", "github_token", "ip_hash", "byte_transactions", "created_at"];
const CREDIT_AT = "2026-10-13T09:30:00Z";

const user = {
  id: "10f13b40-0000-0000-0000-000000000000",
  github_id: 87228787,
  github_login: "GuiBarradas",
  email: "someone@example.com",
  created_at: "2026-05-04T06:15:44.210982+00:00",
  last_seen_at: "2026-09-22T10:42:45.691451+00:00",
  bytes: 42,
  deleted_at: null,
  github_token: "ghp_should_never_leak",
  ip_hash: "abc",
  byte_transactions: [{ created_at: CREDIT_AT, source: "github_sync", amount: 7 }],
};

beforeEach(() => {
  calls.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T18:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("toMapPin", () => {
  it("exposes the public facts and a derived position", () => {
    const pin = toMapPin(user, 2, 3)!;
    expect(pin).toMatchObject({ login: "GuiBarradas", region: "the_outage", bytes: 42, rooms: 2, badges: 3, memberSince: user.created_at, activity: 1 });
    expect(pin.at).toHaveLength(2);
  });

  it("leaks nothing sensitive, not even the raw credit time, and hides deleted accounts", () => {
    const json = JSON.stringify(toMapPin(user, 0, 0));
    for (const field of FORBIDDEN) expect(json, `field '${field}' leaked`).not.toContain(`"${field}"`);
    expect(json).not.toContain("ghp_");
    expect(json).not.toContain(CREDIT_AT);
    expect(Object.keys(toMapPin(user, 0, 0)!).sort()).toEqual(["activity", "at", "badges", "bytes", "login", "memberSince", "region", "rooms"]);
    expect(toMapPin({ ...user, deleted_at: "2026-09-01T00:00:00Z" }, 0, 0)).toBeNull();
  });

  it.each([
    ["no credit row", null, null],
    ["an empty credit list", [], null],
    ["an invalid timestamp", [{ created_at: "invalid" }], null],
    ["a credit older than a week", [{ created_at: "2026-10-01T12:00:00Z" }], 0],
    ["a credit today", [{ created_at: "2026-10-13T00:00:01Z" }], 1],
  ])("activity for %s is %s", (_, byte_transactions, activity) => {
    expect(toMapPin({ ...user, byte_transactions }, 0, 0)!.activity).toBe(activity);
  });
});

describe("getWorldMap", () => {
  beforeEach(() => {
    results = {
      users: {
        data: [
          { ...user, github_login: "zed", id: "u-z", byte_transactions: [] },
          { ...user, id: "u-g" },
        ],
        error: null,
      },
      rooms: { data: [{ user_id: "u-g" }, { user_id: "u-g" }, { user_id: "u-z" }], error: null },
      user_badges: { data: [{ user_id: "u-g" }], error: null },
    };
  });

  it("reads the newest credit per user in one embedded query, without N+1 or writes", async () => {
    const pins = await getWorldMap();
    expect(pins.map((p) => [p.login, p.rooms, p.badges, p.activity])).toEqual([
      ["GuiBarradas", 2, 1, 1],
      ["zed", 1, 0, null],
    ]);

    const users = calls.filter(([t]) => t === "users");
    expect(users.filter(([, k]) => k === "from")).toHaveLength(1);
    expect(users).toContainEqual(["users", "select", JSON.stringify("id, github_login, created_at, bytes, deleted_at, byte_transactions(created_at)")]);
    expect(users).toContainEqual(["users", "is", JSON.stringify("deleted_at"), "null"]);
    expect(users).toContainEqual(["users", "in", JSON.stringify("byte_transactions.source"), JSON.stringify(["github_sync", "backfill"])]);
    expect(users).toContainEqual(["users", "order", JSON.stringify("created_at"), JSON.stringify({ referencedTable: "byte_transactions", ascending: false })]);
    expect(users).toContainEqual(["users", "limit", "1", JSON.stringify({ referencedTable: "byte_transactions" })]);
    expect(calls.filter(([t]) => t === "byte_transactions")).toHaveLength(0);
    expect(calls.map(([t, k]) => `${t}.${k}`).filter((c) => /\.(insert|update|upsert|delete|rpc)$/.test(c))).toEqual([]);
    expect(calls.filter(([, k]) => k === "from")).toHaveLength(3);
  });

  it.each(["users", "rooms", "user_badges"])("throws instead of drawing a partial map when %s fails", async (table) => {
    results[table] = { data: null, error: new Error(`${table} down`) };
    await expect(getWorldMap()).rejects.toThrow(`${table} down`);
  });
});
