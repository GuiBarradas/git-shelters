import { NextResponse } from "next/server";

import { track } from "@/lib/analytics/track";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Bounds a client-reported duration: negative or > 24h is a clock bug, not a session. */
const MAX_DURATION_MS = 24 * 60 * 60_000;

/**
 * session_end sink for the SessionBeacon (ADR 0008). Authenticated by the
 * session cookie the beacon carries; anonymous or malformed posts are
 * dropped with 204 so the browser never retries them.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const body: unknown = await request.json().catch(() => null);
  const duration =
    body && typeof body === "object" && "duration_ms" in body ? Number(body.duration_ms) : NaN;
  if (!Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION_MS) {
    return new NextResponse(null, { status: 204 });
  }

  await track(createAdminClient(), user.id, "session_end", { duration_ms: Math.round(duration) });
  return new NextResponse(null, { status: 204 });
}
