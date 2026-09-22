import { NextResponse } from "next/server";

import { getPublicProfile } from "@/lib/api/public-profile";

/**
 * Public profile JSON (ADR 0001). Cacheable at the edge because the payload
 * is public by construction: every field comes from the whitelist in
 * lib/api/public-profile.ts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const { login } = await params;
  const profile = await getPublicProfile(login);

  if (!profile) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(profile, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
