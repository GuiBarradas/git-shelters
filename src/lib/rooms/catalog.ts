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
  },
  power_plant: {
    name: "Power Plant",
    cost: 80,
    color: palette.glowYellow,
  },
} as const satisfies Record<string, { name: string; cost: number; color: PaletteColor }>;

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
