import type { Metadata } from "next";

import { WorldMapClient } from "@/components/map/WorldMapClient";
import { getWorldMap } from "@/lib/api/world-map";
import { reviewPins } from "@/lib/regions/review";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "The 404 Lands · Git Shelters" };

/** Synthetic map data is a dev and review-build tool; production ignores ?review. */
const reviewAllowed = () => process.env.NODE_ENV === "development" || process.env.SCENE_REVIEW_BUILD === "1";

/**
 * The world map: every bunker in its region, each one a door to its
 * public profile. Public like the profiles are; a signed-in visitor can
 * fly to their own Repo.
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await searchParams).review === "1" && reviewAllowed()) {
    // Fixture branch: no database or auth read at all. The first fake Repo plays "you".
    const pins = reviewPins();
    return <WorldMapClient pins={pins} me={pins[0]!.login} review />;
  }

  const supabase = await createClient();
  const [
    pins,
    {
      data: { user },
    },
  ] = await Promise.all([getWorldMap(), supabase.auth.getUser()]);

  const me = typeof user?.user_metadata?.user_name === "string" ? user.user_metadata.user_name : null;

  return <WorldMapClient pins={pins} me={me} review={false} />;
}
