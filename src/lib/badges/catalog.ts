/**
 * Badges (design doc §4.4): what a Maintainer has done, pinned to the
 * public Repo. Each one is a predicate over state the bunker already
 * tracks, so earning is derived, never a separate write path. Earned
 * rows are remembered (user_badges) so a rule can change without taking
 * a badge back.
 *
 * Only byte bonuses exist for now: they go through the ledger, once per
 * badge. The doc's other rewards (a cache rate, damage, unlocks) wait for
 * the systems they touch.
 */

/** Everything a badge may look at. Cheap to build from what the home already loads. */
export type BadgeContext = {
  /** ISO signup time. */
  createdAt: string;
  /** Pushes the sync credited, all time (github_sync + backfill deltas). */
  commitsCounted: number;
  rooms: number;
  forks: number;
  /** Trait keys of the crew. */
  traits: string[];
  /** Region id; only The Outage exists in the alpha. */
  region: string;
  now: Date;
};

export type BadgeKind = "alpha" | "region" | "achievement";

export type Badge = {
  id: string;
  name: string;
  blurb: string;
  kind: BadgeKind;
  /** Bytes paid once, through the ledger, when earned. */
  bonusBytes: number;
  /** Secret badges are listed only once earned. */
  secret?: boolean;
  earned: (ctx: BadgeContext) => boolean;
};

/**
 * Sign-ups before this date are alpha Maintainers. Null while the alpha
 * is open; set it the day v1 ships.
 */
export const ALPHA_ENDS_AT: string | null = null;

export const BADGES: readonly Badge[] = [
  {
    id: "alpha_maintainer",
    name: "Alpha Maintainer",
    blurb: "Was here when the Repo had four rooms and no roof.",
    kind: "alpha",
    bonusBytes: 0,
    earned: ({ createdAt }) => ALPHA_ENDS_AT === null || Date.parse(createdAt) < Date.parse(ALPHA_ENDS_AT),
  },
  {
    id: "of_the_outage",
    name: "Of The Outage",
    blurb: "Home region: the blackout. Where the lights went first.",
    kind: "region",
    bonusBytes: 0,
    earned: ({ region }) => region === "the_outage",
  },
  {
    id: "first_commit",
    name: "First Commit",
    blurb: "The feed spoke. The sync credited a push.",
    kind: "achievement",
    bonusBytes: 10,
    earned: ({ commitsCounted }) => commitsCounted > 0,
  },
  {
    id: "hello_world",
    name: "Hello World",
    blurb: "Built the first room. The Repo is more than a terminal now.",
    kind: "achievement",
    bonusBytes: 0,
    earned: ({ rooms }) => rooms > 0,
  },
  {
    id: "the_real_mvp",
    name: "The Real MVP",
    blurb: "Ten survivors under one roof.",
    kind: "achievement",
    bonusBytes: 0,
    earned: ({ forks }) => forks >= 10,
  },
  {
    id: "big_o_of_one",
    name: "Big O of One",
    blurb: "A thousand pushes counted. Constant time, every day.",
    kind: "achievement",
    bonusBytes: 50,
    earned: ({ commitsCounted }) => commitsCounted >= 1000,
  },
  {
    id: "the_vibe_coder",
    name: "The Vibe Coder",
    blurb: "Trust me, it'll work.",
    kind: "achievement",
    bonusBytes: 0,
    secret: true,
    earned: ({ traits }) => traits.includes("vibe_coder"),
  },
];

export const BADGE_BY_ID: ReadonlyMap<string, Badge> = new Map(BADGES.map((b) => [b.id, b]));

/** Badges the context earns that are not already held, in catalog order. */
export function dueBadges(ctx: BadgeContext, held: ReadonlySet<string>): Badge[] {
  return BADGES.filter((b) => !held.has(b.id) && b.earned(ctx));
}

/** What a profile shows: earned badges in catalog order, secrets included once earned. */
export function describeBadges(ids: readonly string[]): Array<{ id: string; name: string; blurb: string; kind: BadgeKind }> {
  const held = new Set(ids);
  return BADGES.filter((b) => held.has(b.id)).map(({ id, name, blurb, kind }) => ({ id, name, blurb, kind }));
}
