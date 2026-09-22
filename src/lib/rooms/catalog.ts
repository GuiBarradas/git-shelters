import { palette, type PaletteColor } from "@/lib/palette";

/**
 * Buildable rooms in the Public Alpha. Slot 0 is the Main Branch (free,
 * always present, never stored). Slots 1..3 hold one of these.
 *
 * Costs are mirrored from build_room() in the database, which is the
 * authority: the UI uses these numbers to label buttons and disable the
 * ones the player cannot afford, but the RPC re-checks on every call.
 */
export const ROOM_CATALOG = {
  cache_storage: {
    name: "Cache Storage",
    cost: 50,
    color: palette.mustardWarning,
    blurb: "Cache Storage — feeds Forks. Built with bytes.",
  },
  power_plant: {
    name: "Power Plant",
    cost: 80,
    color: palette.glowYellow,
    blurb: "Power Plant — generates Uptime. Without it, the lights go out.",
  },
  dorm: {
    name: "Dorm",
    cost: 100,
    color: palette.steelBlue,
    blurb: "Dorm — two more beds. Nobody sleeps on the Main Branch floor forever.",
  },
  workshop: {
    name: "Workshop",
    cost: 150,
    color: palette.fadedRed,
    blurb: "Workshop — packs Payload. Ammo for a fight that has not come yet.",
  },
} as const satisfies Record<string, { name: string; cost: number; color: PaletteColor; blurb: string }>;

export const MAIN_BRANCH_BLURB = "Main Branch — the heart of the Repo. Always present.";
export const EMPTY_SLOT_BLURB = "Empty slot — bytes turn this into a room.";

export type RoomKind = keyof typeof ROOM_CATALOG;

export const BUILDABLE_SLOTS = [1, 2, 3] as const;
export type Slot = (typeof BUILDABLE_SLOTS)[number];

export type Room = { slot: Slot; kind: RoomKind };

export function isRoomKind(value: unknown): value is RoomKind {
  return typeof value === "string" && value in ROOM_CATALOG;
}

export function isSlot(value: unknown): value is Slot {
  return (BUILDABLE_SLOTS as readonly number[]).includes(value as number);
}
