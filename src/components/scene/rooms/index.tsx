"use client";

import type { RoomKind } from "@/lib/rooms/catalog";

import type { RoomLayout } from "@/components/scene/Fork";

import { CacheStorageRoom, CLIPBOARD, LAYOUT as CACHE_LAYOUT } from "./CacheStorageRoom";
import { DormRoom, LAYOUT as DORM_LAYOUT, PINBOARD } from "./DormRoom";
import { CALL_PANEL, ElevatorRoom, LAYOUT as ELEVATOR_LAYOUT } from "./ElevatorRoom";
import { GAUGE, LAYOUT as POWER_LAYOUT, PowerPlantRoom } from "./PowerPlantRoom";
import { LAYOUT as MAIN_LAYOUT, SCREEN } from "./MainBranchRoom";
import { CHALKBOARD, LAYOUT as WORKSHOP_LAYOUT, WorkshopRoom } from "./WorkshopRoom";

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
    case "workshop":
      return CHALKBOARD;
    case "elevator":
      return CALL_PANEL;
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
    case "workshop":
      return WORKSHOP_LAYOUT;
    case "elevator":
      return ELEVATOR_LAYOUT;
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
    case "workshop":
      return <WorkshopRoom powered={powered} />;
    case "elevator":
      return <ElevatorRoom powered={powered} />;
  }
}
