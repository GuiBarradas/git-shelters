import { describe, expect, it } from "vitest";

import { toMapPin } from "@/lib/api/world-map";

/** Same gate as the public profile (ADR 0001): the mapper is the whitelist. */
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

describe("toMapPin", () => {
  it("exposes the public facts and a derived position", () => {
    const pin = toMapPin(user, 2, 3)!;
    expect(pin).toMatchObject({ login: "GuiBarradas", region: "the_outage", bytes: 42, rooms: 2, badges: 3, memberSince: user.created_at });
    expect(pin.at).toHaveLength(2);
  });

  it("leaks nothing sensitive and hides deleted accounts", () => {
    const json = JSON.stringify(toMapPin(user, 0, 0));
    for (const field of FORBIDDEN) expect(json, `field '${field}' leaked`).not.toContain(`"${field}"`);
    expect(json).not.toContain("ghp_");
    expect(toMapPin({ ...user, deleted_at: "2026-09-01T00:00:00Z" }, 0, 0)).toBeNull();
  });
});
