import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

import { finishIntro, markIntroSeen } from "@/app/intro/actions";
import { ONCE, track } from "@/lib/analytics/track";

const getUser = vi.fn();
const update = vi.fn();
const admin = {
  from: () => ({ update: (v: unknown) => (update(v), { eq: () => ({ is: async () => ({ error: null }) }) }) }),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/analytics/track", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics/track")>()),
  track: vi.fn(async () => true),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("intro actions", () => {
  it("markIntroSeen still marks seen at boot and records intro_started once", async () => {
    await markIntroSeen();
    expect(update).toHaveBeenCalledWith({ intro_seen_at: expect.any(String) });
    expect(track).toHaveBeenCalledWith(admin, "u1", "intro_started", {}, ONCE);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["completed", "skipped"] as const)("finishIntro records %s once, without touching intro_seen_at", async (outcome) => {
    await finishIntro(outcome);
    expect(track).toHaveBeenCalledWith(admin, "u1", "intro_finished", { outcome }, ONCE);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([["abandoned"], [""], [null], [1], [{ outcome: "completed" }]])("finishIntro rejects %j", async (outcome) => {
    await finishIntro(outcome as never);
    expect(track).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("finishIntro ignores anonymous callers", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await finishIntro("completed");
    expect(track).not.toHaveBeenCalled();
  });
});
