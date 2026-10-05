import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/analytics/session-end/route";
import { track } from "@/lib/analytics/track";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => "admin" }));
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn(async () => true) }));

const post = (body: unknown) =>
  POST(new Request("http://x/api/analytics/session-end", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.mocked(track).mockClear();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("POST /api/analytics/session-end", () => {
  it("records a visible segment, rounded", async () => {
    const res = await post({ duration_ms: 1234.6, measurement: "visible_segment" });
    expect(res.status).toBe(204);
    expect(track).toHaveBeenCalledWith("admin", "u1", "session_end", {
      duration_ms: 1235,
      measurement: "visible_segment",
    });
  });

  it("keeps legacy payloads without labelling them as segments", async () => {
    await post({ duration_ms: 5000 });
    expect(track).toHaveBeenCalledWith("admin", "u1", "session_end", { duration_ms: 5000 });
  });

  it("accepts the 24h boundary", async () => {
    await post({ duration_ms: 86_400_000, measurement: "visible_segment" });
    expect(track).toHaveBeenCalledOnce();
  });

  it.each([
    ["numeric string", { duration_ms: "1000" }],
    ["null", { duration_ms: null }],
    ["boolean", { duration_ms: true }],
    ["negative", { duration_ms: -1 }],
    ["over 24h", { duration_ms: 86_400_001 }],
    ["missing", {}],
    ["unknown measurement", { duration_ms: 1000, measurement: "whole_session" }],
    ["array body", [1000]],
    ["scalar body", 1000],
  ])("drops %s", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(204);
    expect(track).not.toHaveBeenCalled();
  });

  it("drops invalid JSON", async () => {
    await POST(new Request("http://x", { method: "POST", body: "{not json" }));
    expect(track).not.toHaveBeenCalled();
  });

  it("drops anonymous posts", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await post({ duration_ms: 1000, measurement: "visible_segment" });
    expect(track).not.toHaveBeenCalled();
  });
});
