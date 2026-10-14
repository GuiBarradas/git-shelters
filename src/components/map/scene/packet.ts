import { mulberry32 } from "@/lib/forks/catalog";

import type { MapBunker } from "./bunker";
import type { Vec3 } from "./framing";

/**
 * Packets are ambience, not a game system: violet sparks arcing between
 * Repos that still answer, to make the map feel alive. Nothing is sent,
 * traded or counted, and no stat changes.
 *
 * The schedule is a pure function of time, so it needs no state and
 * replays the same everywhere: {@link PACKET_SLOTS} slots, each firing
 * once per {@link SLOT_PERIOD}, staggered so the map sees one packet
 * about every 1.5 s.
 */
export const PACKET_SLOTS = 6;
export const SLOT_PERIOD = 9;
export const TRAIL = 10;

/** Repos that can send or receive: any credited activity in the last week. */
export const talkers = (bunkers: readonly MapBunker[]) => bunkers.filter((b) => (b.pin.activity ?? 0) > 0);

export type Flight = { from: Vec3; to: Vec3; start: number; duration: number };

/** The flight a slot is on during its cycle at time t, or null when fewer than two Repos can talk. */
export function flightAt(slot: number, t: number, from: readonly MapBunker[]): Flight | null {
  if (from.length < 2) return null;
  const offset = (slot * SLOT_PERIOD) / PACKET_SLOTS;
  const cycle = Math.floor((t + offset) / SLOT_PERIOD);
  const rand = mulberry32(((slot + 1) * 73856093) ^ (cycle * 19349663));
  const a = Math.floor(rand() * from.length);
  // Any other Repo: never a route to itself.
  const b = (a + 1 + Math.floor(rand() * (from.length - 1))) % from.length;
  return { from: from[a]!.at, to: from[b]!.at, start: cycle * SLOT_PERIOD - offset, duration: 2.2 + rand() * 1.4 };
}
