import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isGithubId, isGithubLogin } from "@/lib/visuals/server";
import { isPreviewPng, MAX_IMAGE_BYTES, PREVIEW_BUCKET, previewPath, readBoundedBody } from "@/lib/visuals/share-card";

export const runtime = "nodejs";

/**
 * Stores the caller's bunker scene (raw image/png, 960x720, <= 3 MB) as
 * their share-card preview. The object path comes only from the session;
 * the upload runs as the user, so Storage RLS is the final owner check.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) return fail(403, "forbidden");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthorized");

  const type = request.headers.get("content-type")?.split(";")[0]!.trim().toLowerCase();
  if (type !== "image/png") return fail(415, "expected image/png");

  const { data: profile, error } = await supabase
    .from("users")
    .select("github_login, github_id, deleted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return fail(503, "unavailable");
  if (!profile || profile.deleted_at || !isGithubLogin(profile.github_login) || !isGithubId(profile.github_id)) {
    return fail(403, "forbidden");
  }

  const bytes = await readBoundedBody(request, MAX_IMAGE_BYTES);
  if (!bytes) return fail(413, "too large");
  if (!isPreviewPng(bytes)) return fail(422, "invalid image");

  const { error: uploadError } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .upload(previewPath(user.id), bytes, { upsert: true, contentType: "image/png", cacheControl: "0" });
  if (uploadError) return fail(503, "unavailable");

  return NextResponse.json({ ok: true, url: `/api/u/${encodeURIComponent(profile.github_login)}/card` });
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}
