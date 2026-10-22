import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/sync/route";
import { syncUser } from "@/lib/github/sync";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ is: query }) }) }) }));
vi.mock("@/lib/github/sync", () => ({ syncUser: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ addBreadcrumb: vi.fn(), captureMessage: vi.fn(), captureException: vi.fn(), withScope: (fn: (s: unknown) => void) => fn({ setTag: vi.fn() }) }));
const request = (token = "test-secret") => new NextRequest("http://localhost/api/cron/sync", { headers: { authorization: `Bearer ${token}` } });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "test-secret"); });
afterEach(() => vi.unstubAllEnvs());

it("rejects unauthorized requests before accessing accounts", async () => {
  expect((await GET(request("wrong"))).status).toBe(401);
  expect(query).not.toHaveBeenCalled();
});

it("runs at most three accounts concurrently and continues past one failure", async () => {
  const users = Array.from({ length: 8 }, (_, id) => ({ id: String(id), github_login: `user${id}` }));
  query.mockResolvedValue({ data: users, error: null });
  let active = 0, peak = 0;
  const releases: (() => void)[] = [];
  vi.mocked(syncUser).mockImplementation(async (_, user) => {
    active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => releases.push(resolve));
    active--;
    if (user.id === "1") throw new Error("GitHub timed out");
    return { mode: "skipped", reason: "no_login" };
  });
  const response = GET(request());
  await vi.waitFor(() => expect(releases).toHaveLength(3));
  expect(syncUser).toHaveBeenCalledTimes(3);
  for (let i = 0; i < users.length; i++) {
    await vi.waitFor(() => expect(releases[i]).toBeTypeOf("function"));
    releases[i]!();
  }
  expect(await (await response).json()).toMatchObject({ total: 8, skipped: 7, failed: 1, synced: 0 });
  expect(peak).toBe(3);
  expect(new Set(vi.mocked(syncUser).mock.calls.map(([, user]) => user.id)).size).toBe(8);
});

it("handles an empty population and a failed account query", async () => {
  query.mockResolvedValueOnce({ data: [], error: null });
  expect(await (await GET(request())).json()).toMatchObject({ total: 0, synced: 0 });
  expect(syncUser).not.toHaveBeenCalled();
  query.mockResolvedValueOnce({ data: null, error: new Error("database unavailable") });
  expect((await GET(request())).status).toBe(500);
});
