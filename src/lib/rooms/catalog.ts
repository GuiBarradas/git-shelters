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
  elevator: {
    name: "Elevator",
    cost: 120,
    color: palette.steelBlue,
    blurb: "Elevator — a shaft down. Opens the lower floor.",
  },
} as const satisfies Record<string, { name: string; cost: number; color: PaletteColor; blurb: string }>;

export const MAIN_BRANCH_BLURB = "Main Branch — the heart of the Repo. Always present.";
export const EMPTY_SLOT_BLURB = "Empty slot — bytes turn this into a room.";
export const LOCKED_SLOT_BLURB = "Lower floor — sealed. Build an Elevator upstairs first.";

export type RoomKind = keyof typeof ROOM_CATALOG;

/**
 * Two floors (design doc §5.1). The ground floor holds the Main Branch
 * (slot 0) and four rooms; the lower floor holds five more and opens
 * once an Elevator stands on the ground floor. build_room() enforces the
 * gate; these lists only shape the scene and the menu.
 */
export const GROUND_SLOTS = [1, 2, 3, 4] as const;
export const LOWER_SLOTS = [5, 6, 7, 8, 9] as const;
export const BUILDABLE_SLOTS = [...GROUND_SLOTS, ...LOWER_SLOTS] as const;
export type Slot = (typeof BUILDABLE_SLOTS)[number];

export function isLowerSlot(slot: number): boolean {
  return slot >= 5;
}

export function hasElevator(rooms: ReadonlyArray<{ kind: string }>): boolean {
  return rooms.some((r) => r.kind === "elevator");
}

export type Room = { slot: Slot; kind: RoomKind };

export function isRoomKind(value: unknown): value is RoomKind {
  return typeof value === "string" && value in ROOM_CATALOG;
}

export function isSlot(value: unknown): value is Slot {
  return (BUILDABLE_SLOTS as readonly number[]).includes(value as number);
}
