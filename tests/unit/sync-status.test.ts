import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBackfillStatus } from "@/app/sync/actions";

const { getUser, read, eq } = vi.hoisted(() => ({ getUser: vi.fn(), read: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => ({ select: () => ({ eq }) }),
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "self" } } });
  eq.mockReturnValue({ maybeSingle: read });
});

describe("backfill status", () => {
  it("only reads the authenticated player's status", async () => {
    read.mockResolvedValue({ data: { backfill_status: "done" }, error: null });
    expect(await getBackfillStatus()).toBe("done");
    expect(eq).toHaveBeenCalledWith("user_id", "self");
  });
  it("does not read internal rows for anonymous callers", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getBackfillStatus()).toBe("unavailable");
    expect(read).not.toHaveBeenCalled();
  });
  it("makes an abandoned import retryable after the server timeout", async () => {
    read.mockResolvedValue({ data: { backfill_status: "in_progress", backfill_at: new Date(Date.now() - 600_001).toISOString() }, error: null });
    expect(await getBackfillStatus()).toBe("failed");
  });
  it("keeps an active import in progress", async () => {
    read.mockResolvedValue({ data: { backfill_status: "in_progress", backfill_at: new Date().toISOString() }, error: null });
    expect(await getBackfillStatus()).toBe("in_progress");
  });
  it("shows a new player's import as pending", async () => {
    read.mockResolvedValue({ data: null, error: null });
    expect(await getBackfillStatus()).toBe("pending");
  });
  it("does not turn a status read failure into a failed import", async () => {
    read.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect(await getBackfillStatus()).toBe("unavailable");
  });
});
