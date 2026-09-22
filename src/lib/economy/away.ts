import type { ResourceState, TickResult } from "@/lib/economy/tick";
import type { Mood } from "@/lib/forks/mood";

/** Everything the "while you were away" panel needs, already in words. */
export type AwayReport = {
  /** Hours away, already rounded for display. */
  hours: number;
  headline: string;
  lines: string[];
  /** Something went wrong while away: shown in red. */
  warnings: string[];
};

/** Below this the player just refreshed; nothing to report. */
export const AWAY_MIN_HOURS = 0.5;

export type AwayInput = {
  hours: number;
  before: ResourceState;
  after: TickResult;
  /** Bytes credited while away (pushes, backfill, packets). */
  bytesIn: number;
  cooks: number;
  engineers: number;
  /** Forks on the Workshop bench; 0 also when there is no Workshop. */
  tinkerers?: number;
  crewMood: Mood;
};

/**
 * Pure: turns the tick's before/after into the lines a returning
 * Maintainer reads on the terminal. Returns null when the absence is too
 * short to matter, so the caller can skip the panel entirely.
 */
export function awayReport(input: AwayInput): AwayReport | null {
  const { hours, before, after, bytesIn, cooks, engineers, tinkerers = 0, crewMood } = input;
  if (hours < AWAY_MIN_HOURS) return null;

  const lines: string[] = [];
  const warnings: string[] = [];

  if (bytesIn > 0) lines.push(`${bytesIn} B came in from the feed and the packets.`);
  else lines.push("Nothing came in from the feed.");

  const cacheDelta = after.cache - before.cache;
  if (cooks === 0) lines.push(`No cook on shift. The crew ate ${Math.max(0, -cacheDelta)} meals from the shelf.`);
  else if (cacheDelta >= 0) lines.push(`${cooks === 1 ? "The cook" : `${cooks} cooks`} kept up: pantry +${cacheDelta} meals.`);
  else lines.push(`The kitchen fell behind: pantry ${cacheDelta} meals.`);

  const upDelta = after.uptime - before.uptime;
  if (engineers === 0) lines.push(`Nobody on the generator. Charge ${upDelta}%.`);
  else lines.push(`Generator crew held the charge${upDelta >= 0 ? "" : " badly"}: ${upDelta >= 0 ? "+" : ""}${upDelta}%.`);

  const packed = after.payload - before.payload;
  if (tinkerers > 0) lines.push(packed > 0 ? `The bench packed +${packed} Payload.` : "The bench packed nothing. Racks full, or lights out.");

  if (after.blackout) warnings.push("The lights went out. Put an engineer on the Power Plant.");
  if (after.starved) warnings.push("The pantry ran dry. Somebody has to cook.");

  lines.push(`Crew mood on your return: ${crewMood}.`);

  return {
    hours: Math.round(hours * 10) / 10,
    headline: `You were gone ${formatHours(hours)}.`,
    lines,
    warnings,
  };
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(hours / 24)} days`;
}
