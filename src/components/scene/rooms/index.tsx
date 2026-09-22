"use client";

import type { RoomKind } from "@/lib/rooms/catalog";

import { CacheStorageRoom } from "./CacheStorageRoom";
import { PowerPlantRoom } from "./PowerPlantRoom";

export { CELL } from "./RoomShell";
export { EmptyCell } from "./EmptyCell";
export { MainBranchRoom, SCREEN } from "./MainBranchRoom";

/** One interior per buildable kind. Main Branch is not a kind: it is slot 0. */
export function BuiltRoom({ kind }: { kind: RoomKind }) {
  switch (kind) {
    case "cache_storage":
      return <CacheStorageRoom />;
    case "power_plant":
      return <PowerPlantRoom />;
  }
}
