import type { MapPin } from "@/lib/api/world-map";

import { pinFor, REGION_BY_ID } from "./catalog";

/**
 * SYNTHETIC ONLY. Thirty made-up Repos for reviewing and measuring the map
 * scene (`/map?review=1`, dev or SCENE_REVIEW_BUILD=1). No database row is
 * read; the logins are not real accounts and the UI labels them as fake.
 * Activity covers every bucket, including unknown (null).
 */
export const REVIEW_PIN_COUNT = 30;
const ACTIVITY = [1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0, null] as const;

export function reviewPins(): MapPin[] {
  const region = REGION_BY_ID.get("the_outage")!;
  return Array.from({ length: REVIEW_PIN_COUNT }, (_, i) => {
    const login = `synthetic-${String(i).padStart(2, "0")}`;
    return {
      login,
      region: region.id,
      at: pinFor(login, region),
      bytes: (i * 7919) % 50_000,
      rooms: i % 10,
      badges: i % 4,
      memberSince: new Date(Date.UTC(2026, 4, 1 + i)).toISOString(),
      activity: ACTIVITY[i % ACTIVITY.length]!,
    };
  });
}
