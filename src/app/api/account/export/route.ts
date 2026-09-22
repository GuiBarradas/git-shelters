import { NextResponse } from "next/server";

import { exportAccount } from "@/lib/api/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * LGPD data export (ADR 0007). The caller must be signed in; the export
 * is always their own account. Served as a JSON download, never cached.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await exportAccount(createAdminClient(), user.id);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const stamp = data.exported_at.slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="git-shelters-${data.account.github_login}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
