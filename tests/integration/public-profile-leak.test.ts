import { describe, expect, it } from "vitest";

import { getPublicProfile } from "@/lib/api/public-profile";

/**
 * ADR 0001: end-to-end leak check against the real dev Supabase. The unit
 * test guards the mapper; this one guards the query + mapper together for
 * the fixture user, plus the not-found and input-validation paths.
 */

const FORBIDDEN = ["email", "github_id", "deleted_at", "last_seen_at", "user_id"];

describe("getPublicProfile", () => {
  it("returns the fixture user's public fields only, case-insensitively", async () => {
    const profile = await getPublicProfile("guibarradas");
    expect(profile?.login).toBe("GuiBarradas");
    expect(typeof profile?.bytes).toBe("number");
    expect(Array.isArray(profile?.rooms)).toBe(true);

    const json = JSON.stringify(profile);
    for (const field of FORBIDDEN) {
      expect(json, `field '${field}' leaked`).not.toContain(`"${field}"`);
    }
    expect(json).not.toContain("@");
  });

  it("returns null for an unknown login", async () => {
    expect(await getPublicProfile("this-login-does-not-exist-0000")).toBeNull();
  });

  it("returns null for input outside the GitHub login grammar", async () => {
    expect(await getPublicProfile("%")).toBeNull();
    expect(await getPublicProfile("../users")).toBeNull();
    expect(await getPublicProfile("a".repeat(40))).toBeNull();
  });
});
