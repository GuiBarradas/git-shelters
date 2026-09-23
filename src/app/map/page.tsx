import type { Metadata } from "next";
import Link from "next/link";

import { WorldMap } from "@/components/map/WorldMap";
import { getWorldMap } from "@/lib/api/world-map";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "The 404 Lands · Git Shelters" };

/**
 * The world map: every bunker as a dot in its region, each one a door to
 * its public profile. Public like the profiles are; a signed-in visitor
 * sees their own dot pulse.
 */
export default async function MapPage() {
  const supabase = await createClient();
  const [
    pins,
    {
      data: { user },
    },
  ] = await Promise.all([getWorldMap(), supabase.auth.getUser()]);

  const me = typeof user?.user_metadata?.user_name === "string" ? user.user_metadata.user_name : null;

  return (
    <main className="min-h-dvh px-4 py-6 font-mono text-sm">
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-[#BD93F9]">The 404 Lands</h1>
          <p className="text-[#E6DFC8]/60">Every Repo that still answers. One region has signal; the rest is static, for now.</p>
        </div>
        <Link href="/" className="text-[#BD93F9] hover:text-[#E6DFC8]">
          &larr; {me ? "your Repo" : "home"}
        </Link>
      </div>
      <WorldMap pins={pins} me={me} />
    </main>
  );
}
