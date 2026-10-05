import { describe, expect, it, vi } from "vitest";

import { track } from "@/lib/analytics/track";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

describe("track", () => {
  it("swallows a thrown client error so gameplay never breaks", async () => {
    const admin = {
      from: () => {
        throw new Error("network down");
      },
    };
    await expect(track(admin as never, "u1", "intro_started", {})).resolves.toBe(false);
  });
});
