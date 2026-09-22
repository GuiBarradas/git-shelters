import { type ForkTrait, mulberry32 } from "@/lib/forks/catalog";

/**
 * Mood (design doc §6.1) is derived from the Maintainer's real activity,
 * never stored: the crew feels the way the commit log looks. Every Fork
 * shares the bunker's base mood, shifted one step by its trait.
 */
export const MOODS = ["bitter", "stressed", "content", "happy"] as const;
export type Mood = (typeof MOODS)[number];

/** Base mood from the days since the last push seen by the sync. */
export function moodFromActivity(lastPushAt: string | null, now: Date = new Date()): Mood {
  if (lastPushAt === null) return "content"; // a fresh bunker has no history to resent
  const days = daysSince(lastPushAt, now);
  if (days === 0) return "happy";
  if (days <= 2) return "content";
  if (days <= 6) return "stressed";
  return "bitter";
}

export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000));
}

/** Trait shifts: the vibe coder is always a step sunnier, the 10x engineer a step darker. */
const SHIFT: Partial<Record<ForkTrait, -1 | 1>> = {
  vibe_coder: 1,
  caffeinated: 1,
  tenx: -1,
  imposter: -1,
};

export function moodFor(base: Mood, trait: ForkTrait): Mood {
  const i = MOODS.indexOf(base) + (SHIFT[trait] ?? 0);
  return MOODS[Math.min(MOODS.length - 1, Math.max(0, i))]!;
}

/** An empty pantry pulls every Fork one step down, whatever the commits say. */
export function hungerShift(mood: Mood): Mood {
  return MOODS[Math.max(0, MOODS.indexOf(mood) - 1)]!;
}

export const MOOD_LINES: Record<Mood, readonly string[]> = {
  happy: [
    "Saw the push land. Lights are steady tonight.",
    "You committed. We noticed. Thank you.",
    "Best day in the Repo since the Merge Conflict.",
  ],
  content: [
    "Quiet shift. Nothing's on fire.",
    "The terminal hummed. That's enough for me.",
    "Cache is stocked. Uptime holds.",
  ],
  stressed: [
    "When was the last push? Asking for the generator.",
    "The green terminal keeps printing MERGE PENDING.",
    "We're fine. We're fine. Are we fine?",
  ],
  bitter: [
    "A week. A whole week. The 404 doesn't wait.",
    "I've started talking to the server rack.",
    "Is the Maintainer even out there anymore?",
  ],
};

export const MOOD_LABEL: Record<Mood, string> = {
  happy: "happy",
  content: "content",
  stressed: "stressed",
  bitter: "bitter",
};

/** What the crew as a whole says about the situation, for the HUD. */
export function describeCrew(base: Mood, lastPushAt: string | null, now: Date = new Date()): string {
  if (lastPushAt === null) return "crew mood: content — no pushes seen yet";
  const days = daysSince(lastPushAt, now);
  const since = days === 0 ? "pushed today" : days === 1 ? "1 day since last push" : `${days} days since last push`;
  return `crew mood: ${MOOD_LABEL[base]} — ${since}`;
}

/**
 * The line a Fork says when poked: half the time its mood, half its trait
 * (the caller supplies the trait line). Seeded by the Fork plus a salt so
 * repeated clicks vary without React state.
 */
export function pickLine(seed: number, salt: number, mood: Mood, traitLine: string): string {
  const rand = mulberry32((seed ^ (salt * 0x9e3779b1)) >>> 0);
  if (rand() < 0.5) return traitLine;
  const lines = MOOD_LINES[mood];
  return lines[Math.floor(rand() * lines.length)]!;
}

/** Locomotion and posture tweaks per mood, read by the Fork animation. */
export const MOOD_MOTION: Record<Mood, { speed: number; headPitch: number; bounce: number }> = {
  happy: { speed: 1.15, headPitch: -0.08, bounce: 0.05 },
  content: { speed: 1, headPitch: 0, bounce: 0.02 },
  stressed: { speed: 1.35, headPitch: 0.18, bounce: 0.02 },
  bitter: { speed: 0.7, headPitch: 0.3, bounce: 0 },
};
