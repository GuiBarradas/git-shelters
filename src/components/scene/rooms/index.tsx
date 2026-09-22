"use client";

import type { RoomKind } from "@/lib/rooms/catalog";

import { CacheStorageRoom, CLIPBOARD } from "./CacheStorageRoom";
import { GAUGE, PowerPlantRoom } from "./PowerPlantRoom";
import { SCREEN } from "./MainBranchRoom";

export { CELL } from "./RoomShell";
export { EmptyCell } from "./EmptyCell";
export { MainBranchRoom, SCREEN } from "./MainBranchRoom";

export type PanelAnchor = { position: [number, number, number]; width: number; height: number };

/** Where a room's in-world read-out lives. null = the Main Branch terminal. */
export function panelAnchor(kind: RoomKind | null): PanelAnchor {
  switch (kind) {
    case null:
      return SCREEN;
    case "cache_storage":
      return CLIPBOARD;
    case "power_plant":
      return GAUGE;
  }
}

/** One interior per buildable kind. Main Branch is not a kind: it is slot 0. */
export function BuiltRoom({ kind }: { kind: RoomKind }) {
  switch (kind) {
    case "cache_storage":
      return <CacheStorageRoom />;
    case "power_plant":
      return <PowerPlantRoom />;
  }
}
