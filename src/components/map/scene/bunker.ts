import { hash32 } from "@/lib/forks/load";
import type { MapPin } from "@/lib/api/world-map";
import { mapTones, palette } from "@/lib/palette";
import { regionHeight, toWorld } from "@/lib/regions/look";

import type { Vec3 } from "./framing";
import type { Glow } from "./glow";

/**
 * Where and how brightly each bunker burns on the map (map brief). Pure,
 * so the scene and the tests read the same numbers. `a` is the pin's
 * activity: 0..1 from the last credited sync, null when there is none.
 */

export type MapBunker = { pin: MapPin; at: Vec3; mine: boolean; phase: number };

/** The visitor's own beam: always tall, it marks a place, not an activity. */
export const OWN_BEAM = 8;
export const OWN_POOL = 6;

export function mapBunkers(pins: readonly MapPin[], me: string | null): MapBunker[] {
  const own = me?.toLowerCase();
  return pins.map((pin) => {
    const [x, z] = toWorld(pin.at);
    return {
      pin,
      at: [x, regionHeight(pin.region), z],
      mine: pin.login.toLowerCase() === own,
      // Seeded per login, so the breathing never syncs up and never changes between visits.
      phase: (hash32(pin.login.toLowerCase()) % 1000) / 1000,
    };
  });
}

/** Height of the upload beam; 0 means no beam (idle for a week, or unknown). */
export function beamHeight(a: number | null, mine: boolean): number {
  if (mine) return OWN_BEAM;
  return a ? 1.5 + 5.5 * a : 0;
}

/** Radius of the warm light pool on the ground; 0 means none. */
export function poolRadius(a: number | null, mine: boolean): number {
  if (mine) return OWN_POOL;
  return a ? 2 + 3.2 * a : 0;
}

/** How bright the pool is, 0..1. */
export function poolStrength(a: number | null, mine: boolean): number {
  if (mine) return 0.75;
  return a ? 0.18 + 0.5 * a : 0;
}

/**
 * Days since the last credit, read back from the activity buckets of
 * activityFromCreditAt (1, 0.85, 0.7, then -0.1 a day). null when unknown,
 * Infinity past a week.
 */
export function activityDays(a: number | null): number | null {
  if (a === null) return null;
  if (a <= 0) return Infinity;
  return Math.round(a >= 0.7 ? (1 - a) / 0.15 : 2 + (0.7 - a) / 0.1);
}

/**
 * Tooltip line for the activity. It says "active", not "pushed": a
 * backfill credits Bytes too, so the date is the credit's, not a push's.
 */
export function activityLabel(a: number | null): string | null {
  const days = activityDays(a);
  if (days === null) return null;
  if (days === Infinity) return "quiet for over a week";
  if (days === 0) return "active today";
  if (days === 1) return "active yesterday";
  return `active ${days} days ago`;
}

/** The glowing core over each hatch: amber for the visitor, lamp by activity, an ember when idle, none when unknown. */
export function bunkerGlows(bunkers: readonly MapBunker[]): Glow[] {
  return bunkers.flatMap(({ pin, at: [x, y, z], mine, phase }): Glow[] => {
    if (mine) return [{ at: [x, y + 0.55, z], color: palette.amber, size: 3.2, mode: "own", phase }];
    if (pin.activity === null) return [];
    if (pin.activity > 0) return [{ at: [x, y + 0.5, z], color: palette.lampWarm, size: 1.2 + 1.8 * pin.activity, mode: "breathe", phase }];
    return [{ at: [x, y + 0.35, z], color: mapTones.ember, size: 0.9, mode: "slow", phase }];
  });
}
