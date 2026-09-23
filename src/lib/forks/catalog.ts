import type { Mood } from "@/lib/forks/mood";
import { palette } from "@/lib/palette";

/**
 * Forks: the survivors (design doc §6). This module is the whole content
 * layer for the first cut: traits with one idle line each, a deterministic
 * name generator in the "Linus_77 / Margie_NULL" register, and a look
 * derived from a seed so the same Fork always wears the same shirt.
 */

/** Traits: a name and what a survivor of that kind says when poked. */
export const FORK_TRAITS = {
  caffeinated: { name: "Caffeinated", lines: ["Coffee? Coffee. Coffee.", "I have not slept since the Merge Conflict. It's fine. I'm fine.", "If the generator dies I can power it. Just plug me in."] },
  imposter: { name: "Imposter Syndrome", lines: ["No idea what I'm doing here, but I'll try.", "Everyone else seems to know where the wrench goes.", "One day they'll notice I don't belong. Not today, apparently."] },
  senior: { name: "Senior", lines: ["Saw this in 2008.", "We had this exact outage before. Twice. Nobody listened.", "Back in my day the apocalypse shipped on a Friday."] },
  junior: { name: "Junior", lines: ["WAIT. WHAT DO YOU MEAN THE INTERNET IS GONE?", "Is Stack Overflow down for everyone or just me?", "I was going to ask a question. I'll just... figure it out."] },
  vibe_coder: { name: "Vibe Coder", lines: ["Trust me, it'll work.", "I don't read the diff, I feel the diff.", "Accept All. What could go wrong. Again."] },
  tenx: { name: "10x Engineer", lines: ["Nobody here gets me.", "I could rewrite this bunker in a weekend. Alone.", "Meetings are why the world ended."] },
  oss_maximalist: { name: "Open Source Maximalist", lines: ["Everything should be AGPL.", "If the Crawlers open-sourced their code we could just read it.", "Forks are people too. Literally, now."] },
  minimalist: { name: "Minimalist", lines: ["...", "Less.", "The bunker has too many rooms."] },
} as const;

export type ForkTrait = keyof typeof FORK_TRAITS;
export const TRAIT_KEYS = Object.keys(FORK_TRAITS) as ForkTrait[];

export function isForkTrait(value: unknown): value is ForkTrait {
  return typeof value === "string" && value in FORK_TRAITS;
}

export type Fork = {
  id: string;
  name: string;
  trait: ForkTrait;
  mood: Mood;
  roomSlot: number | null;
  seed: number;
};

/** Bytes to recruit one more survivor. Mirrored nowhere: the RPC takes the cost as a parameter. */
export const RECRUIT_COST = 300;

/**
 * Beds (design doc §5.2): two on the Main Branch, two more per Dorm.
 * Mirrors recruit_fork() in the database, which is the authority and
 * raises `no_beds` when the crew would outgrow them.
 */
export const BEDS_BASE = 2;
export const BEDS_PER_DORM = 2;

export function bedCount(rooms: ReadonlyArray<{ kind: string }>): number {
  return BEDS_BASE + BEDS_PER_DORM * rooms.filter((r) => r.kind === "dorm").length;
}

const FIRST = [
  "Linus", "Margie", "Hex", "Ada", "Dmitri", "Priya", "Sol", "Yuki", "Grace", "Bjarne",
  "Nadia", "Tomas", "Ines", "Kofi", "Wren", "Ravi", "Lena", "Ozzie", "Mara", "Vik",
];
const SUFFIX = ["_77", "_NULL", "_The_Cleric", "-dev", "_v2", "_404", "_root", "_beta", "_x86", "_tmp", "_deprecated", "_ok"];

/** Small deterministic PRNG so a seed always yields the same Fork. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateForkName(seed: number): string {
  const rand = mulberry32(seed);
  return `${FIRST[Math.floor(rand() * FIRST.length)]}${SUFFIX[Math.floor(rand() * SUFFIX.length)]}`;
}

export function pickTrait(seed: number): ForkTrait {
  return TRAIT_KEYS[Math.floor(mulberry32(seed ^ 0x9e3779b9)() * TRAIT_KEYS.length)]!;
}

export type ForkLook = { skin: string; shirt: string; pants: string; helmet: string | null };

const SKINS = ["#f1c9a5", "#c68642", "#8d5524", "#e0ac69", "#5c3a21"];
const SHIRTS = [palette.fadedRed, palette.steelBlue, palette.mustardWarning, palette.phosphorViolet, palette.boneWhite, palette.concreteTan];

export function forkLook(seed: number): ForkLook {
  const rand = mulberry32(seed ^ 0x5bd1e995);
  return {
    skin: SKINS[Math.floor(rand() * SKINS.length)]!,
    shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)]!,
    pants: rand() > 0.5 ? palette.outageGray : palette.oldWoodBrown,
    helmet: rand() > 0.6 ? palette.glowYellow : null,
  };
}
