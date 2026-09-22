import { describe, expect, it } from "vitest";

import { toPublicProfile } from "@/lib/api/public-profile";

/**
 * ADR 0001 CI gate: the public profile mapper is the whitelist. Feed it a
 * user row carrying every sensitive field we can think of and assert none
 * of them survive. This runs in the plain unit suite so CI blocks a leak
 * without needing Supabase secrets.
 */

const FORBIDDEN = ["email", "id", "github_id", "deleted_at", "last_seen_at", "github_token", "ip_hash"];

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
};

describe("toPublicProfile", () => {
  it("exposes exactly the documented whitelist", () => {
    const profile = toPublicProfile(user, [{ slot: 1, kind: "cache_storage", level: 1 }]);
    expect(profile).toEqual({
      login: "GuiBarradas",
      memberSince: user.created_at,
      bytes: 42,
      rooms: [{ slot: 1, kind: "cache_storage", level: 1 }],
    });
  });

  it("leaks no sensitive field, even when the row carries them", () => {
    const json = JSON.stringify(toPublicProfile(user, []));
    for (const field of FORBIDDEN) {
      expect(json, `field '${field}' leaked`).not.toContain(`"${field}"`);
    }
    expect(json).not.toContain("ghp_");
    expect(json).not.toContain("@example.com");
  });

  it("returns null for a deleted account (LGPD)", () => {
    expect(toPublicProfile({ ...user, deleted_at: "2026-09-01T00:00:00Z" }, [])).toBeNull();
  });

  it("drops rooms the catalog does not know", () => {
    const profile = toPublicProfile(user, [
      { slot: 1, kind: "cache_storage", level: 2 },
      { slot: 9, kind: "cache_storage", level: 1 },
      { slot: 2, kind: "jacuzzi", level: 1 },
    ]);
    expect(profile?.rooms).toEqual([{ slot: 1, kind: "cache_storage", level: 2 }]);
  });
});
