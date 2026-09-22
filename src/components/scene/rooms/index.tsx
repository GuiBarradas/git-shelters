"use client";

import type { RoomKind } from "@/lib/rooms/catalog";

import type { RoomLayout } from "@/components/scene/Fork";

import { CacheStorageRoom, CLIPBOARD, LAYOUT as CACHE_LAYOUT } from "./CacheStorageRoom";
import { DormRoom, LAYOUT as DORM_LAYOUT, PINBOARD } from "./DormRoom";
import { GAUGE, LAYOUT as POWER_LAYOUT, PowerPlantRoom } from "./PowerPlantRoom";
import { LAYOUT as MAIN_LAYOUT, SCREEN } from "./MainBranchRoom";

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
    case "dorm":
      return PINBOARD;
  }
}

/** Where a Fork may walk and act in a room. null = the Main Branch. */
export function roomLayout(kind: RoomKind | null): RoomLayout {
  switch (kind) {
    case null:
      return MAIN_LAYOUT;
    case "cache_storage":
      return CACHE_LAYOUT;
    case "power_plant":
      return POWER_LAYOUT;
    case "dorm":
      return DORM_LAYOUT;
  }
}

/** One interior per buildable kind. Main Branch is not a kind: it is slot 0. */
export function BuiltRoom({ kind, powered = true }: { kind: RoomKind; powered?: boolean }) {
  switch (kind) {
    case "cache_storage":
      return <CacheStorageRoom powered={powered} />;
    case "power_plant":
      return <PowerPlantRoom powered={powered} />;
    case "dorm":
      return <DormRoom powered={powered} />;
  }
}
