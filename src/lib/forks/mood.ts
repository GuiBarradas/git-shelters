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

/**
 * How today's Daily Event lands on the crew (design doc §15.3, "Forks
 * reacting to events"): a packet nobody opened yet, a decision that paid,
 * one that cost, or one that changed nothing.
 */
export type EventEcho = "pending" | "good" | "bad" | "flat";

export function eventEcho(
  event: { resolved: { outcome: { bytes_delta: number } } | null } | null,
): EventEcho | null {
  if (!event) return null;
  if (!event.resolved) return "pending";
  const d = event.resolved.outcome.bytes_delta;
  return d > 0 ? "good" : d < 0 ? "bad" : "flat";
}

/** A decision that paid lifts the crew a step for the day; one that cost weighs on it. */
export function eventShift(mood: Mood, echo: EventEcho | null): Mood {
  const step = echo === "good" ? 1 : echo === "bad" ? -1 : 0;
  return MOODS[Math.min(MOODS.length - 1, Math.max(0, MOODS.indexOf(mood) + step))]!;
}

/** The day's mood in one place: commits and trait first, then the packet, then the pantry. */
export function settleMood(mood: Mood, ctx: { echo: EventEcho | null; starving: boolean }): Mood {
  const shifted = eventShift(mood, ctx.echo);
  return ctx.starving ? hungerShift(shifted) : shifted;
}

export const EVENT_LINES: Record<EventEcho, readonly string[]> = {
  pending: [
    "That packet on the terminal is still blinking. Somebody decide.",
    "Are you going to open it, or do I have to?",
    "The Main Branch is waiting on you. So are we.",
    "Unread packet. Unread packets are how the last Maintainer went.",
    "I'd open it myself, but the terminal only listens to you.",
    "It's been blinking since dawn. The blink is getting personal.",
  ],
  good: [
    "Good call today. The whole Repo felt it.",
    "Told them you'd pick right. Nobody bet against me.",
    "Bytes came out of that one. Keep making those calls.",
    "The packet paid. Drinks are on the ledger.",
    "See? Reading the whole thing works sometimes.",
    "We pinned today's outcome to the pantry door. Morale item.",
  ],
  bad: [
    "We don't talk about the packet.",
    "Next time, maybe ask the crew first?",
    "That cost us. I'm not saying it was you. I'm not not saying it.",
    "The ledger went red. The ledger is never wrong. Unfortunately.",
    "You chose fast. The 404 charges for fast.",
    "I've filed today under 'lessons'. The folder is getting thick.",
  ],
  flat: [
    "So that happened. Nothing changed. Somehow that's worse.",
    "The terminal printed OK. Just OK.",
    "One decision, zero bytes. Story of this shift.",
    "A packet with nothing in it. The 404 has a sense of humour.",
    "No gain, no loss. The Sandbox would call that a win.",
    "We opened it, we read it, we shrugged in unison.",
  ],
};

export const MOOD_LINES: Record<Mood, readonly string[]> = {
  happy: [
    "Saw the push land. Lights are steady tonight.",
    "You committed. We noticed. Thank you.",
    "Best day in the Repo since the Merge Conflict.",
    "The feed said your name today. Twice.",
    "I told the others you'd be back. They owe me bytes.",
    "Green build. Warm bunk. I could get used to this.",
    "Whatever you shipped, the lights liked it.",
    "Somebody hummed in the corridor. I think it was me.",
  ],
  content: [
    "Quiet shift. Nothing's on fire.",
    "The terminal hummed. That's enough for me.",
    "Cache is stocked. Uptime holds.",
    "Ordinary day in the Repo. I'll take ordinary.",
    "The generator coughed once. Then it thought better of it.",
    "No packets, no Crawlers, no drama. Log it.",
    "I reorganised the pantry. Nobody noticed. That's the point.",
    "Steady. Like a good main branch.",
  ],
  stressed: [
    "When was the last push? Asking for the generator.",
    "The terminal keeps printing MERGE PENDING.",
    "We're fine. We're fine. Are we fine?",
    "I counted the meals. Then I counted them again.",
    "Three days of silence from the feed. Cables don't gossip for nothing.",
    "If you're busy out there, just push something. Anything.",
    "The lamp flickered and everyone looked at me.",
    "I keep refreshing a terminal that doesn't refresh.",
  ],
  bitter: [
    "A week. A whole week. The 404 doesn't wait.",
    "I've started talking to the server rack.",
    "Is the Maintainer even out there anymore?",
    "We named the rat. It has a better attendance record than you.",
    "The last packet was addressed to nobody. Fitting.",
    "I'd leave, but the door only opens from the feed side.",
    "Don't say 'soon'. The Merge Conflict started with 'soon'.",
    "The Wikipedia clone has an article on 'abandonment'. I read it twice.",
  ],
};

/** What a survivor says about where it works, when poked there. Null slot = off shift on the Main Branch. */
export const JOB_LINES: Record<"cache_storage" | "power_plant" | "dorm" | "workshop" | "elevator" | "off_shift", readonly string[]> = {
  cache_storage: [
    "Freeze-dried again. The kettle has opinions.",
    "Six meals an hour if the lights hold. Don't ask what's in them.",
    "I label the crates. Nobody reads the labels.",
    "The pantry is my kingdom. A small, damp kingdom.",
  ],
  power_plant: [
    "Hear that hum? That's me, technically.",
    "The crank turns. The drum spins. Don't touch the red one.",
    "Twenty-five percent an hour. I'm a battery with a face.",
    "If the fan stops, close your eyes. It's easier.",
  ],
  dorm: [
    "Bottom bunk. Earned it.",
    "The blanket smells like someone else's shift.",
    "Sleep is a job too. A quiet, underrated job.",
    "I dream in merge conflicts now.",
  ],
  workshop: [
    "Packing rounds for a fight nobody's scheduled.",
    "No blueprints. Just a vice and confidence.",
    "Thirty per rack. The rack is the rule.",
    "The spark's mine. The fire, if it comes, is on you.",
  ],
  elevator: [
    "Going down. Eventually.",
    "The indicator says -1. There is no -1 yet. It's optimistic.",
    "Someone has to push the button. Someone is me.",
    "The shaft whistles at night. I've decided that's normal.",
  ],
  off_shift: [
    "Off shift. Watching the terminal blink is still watching.",
    "Assign me somewhere. The corridor has no coffee.",
    "I could cook. I could crank. I could nap. Your call, Maintainer.",
    "Standing around is a job if you frown enough.",
  ],
};

export const MOOD_LABEL: Record<Mood, string> = {
  happy: "happy",
  content: "content",
  stressed: "stressed",
  bitter: "bitter",
};

/** What the crew as a whole says about the situation, for the HUD. */
export function describeCrew(
  mood: Mood,
  lastPushAt: string | null,
  now: Date = new Date(),
  echo: EventEcho | null = null,
): string {
  const days = lastPushAt === null ? null : daysSince(lastPushAt, now);
  const since =
    days === null
      ? "no pushes seen yet"
      : days === 0
        ? "pushed today"
        : days === 1
          ? "1 day since last push"
          : `${days} days since last push`;
  const packet = { pending: "a packet is waiting", good: "lifted by today's packet", bad: "rattled by today's packet", flat: "" };
  const tail = echo ? packet[echo] : "";
  return `crew mood: ${MOOD_LABEL[mood]} — ${since}${tail ? ` · ${tail}` : ""}`;
}

/**
 * The line a Fork says when poked. When a Daily Event is in the air, a
 * third of the pokes are about it; otherwise the pool is its mood, its
 * trait and its job in roughly equal parts. Seeded by the Fork plus a
 * salt so repeated clicks vary without React state, and a survivor
 * never says the same line twice in a row for the same salt.
 */
export function pickLine(
  seed: number,
  salt: number,
  mood: Mood,
  traitLines: readonly string[],
  echo: EventEcho | null = null,
  jobLines: readonly string[] = [],
): string {
  const rand = mulberry32((seed ^ (salt * 0x9e3779b1)) >>> 0);
  const pick = (lines: readonly string[]) => lines[Math.floor(rand() * lines.length)]!;
  if (echo && rand() < 1 / 3) return pick(EVENT_LINES[echo]);
  const pools = [MOOD_LINES[mood], traitLines, jobLines].filter((p) => p.length > 0);
  return pick(pools[Math.floor(rand() * pools.length)]!);
}

/** Locomotion and posture tweaks per mood, read by the Fork animation. */
export const MOOD_MOTION: Record<Mood, { speed: number; headPitch: number; bounce: number }> = {
  happy: { speed: 1.15, headPitch: -0.08, bounce: 0.05 },
  content: { speed: 1, headPitch: 0, bounce: 0.02 },
  stressed: { speed: 1.35, headPitch: 0.18, bounce: 0.02 },
  bitter: { speed: 0.7, headPitch: 0.3, bounce: 0 },
};
