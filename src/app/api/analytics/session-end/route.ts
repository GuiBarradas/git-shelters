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
 *
 * Current beacons send `measurement: "visible_segment"` (one visible
 * stretch of a page, not a whole session). Older tabs still running the
 * previous bundle send only `duration_ms`; those are kept as before,
 * without a measurement prop, so queries can tell the two apart.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return new NextResponse(null, { status: 204 });

  const { duration_ms: duration, measurement } = body as Record<string, unknown>;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION_MS) {
    return new NextResponse(null, { status: 204 });
  }
  if (measurement !== undefined && measurement !== "visible_segment") {
    return new NextResponse(null, { status: 204 });
  }

  const duration_ms = Math.round(duration);
  await track(
    createAdminClient(),
    user.id,
    "session_end",
    measurement ? { duration_ms, measurement } : { duration_ms },
  );
  return new NextResponse(null, { status: 204 });
}
