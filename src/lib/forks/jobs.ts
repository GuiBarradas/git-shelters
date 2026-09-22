import type { RoomKind } from "@/lib/rooms/catalog";

/**
 * A Fork's job is where it stands (design doc §6.1): the room it is
 * assigned to decides what it does and what the simulation credits.
 * The Main Branch has no output; a Fork there is off-shift.
 */
export const JOB_BY_ROOM: Record<RoomKind, { title: string; does: string }> = {
  cache_storage: { title: "Cook", does: "puts meals on the shelf" },
  power_plant: { title: "Engineer", does: "keeps the charge up" },
  dorm: { title: "Resting", does: "sleeps between shifts" },
  workshop: { title: "Tinkerer", does: "packs Payload at the bench" },
};

export const OFF_SHIFT = { title: "Off shift", does: "hangs around the Main Branch" } as const;

export function jobFor(kind: RoomKind | null): { title: string; does: string } {
  return kind === null ? OFF_SHIFT : JOB_BY_ROOM[kind];
}
