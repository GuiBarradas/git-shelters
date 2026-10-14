import Link from "next/link";

import type { Workforce } from "@/lib/economy/tick";
import { RECRUIT_COST } from "@/lib/forks/catalog";
import { ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";

/**
 * What to build and staff next. The 8-hour forecast lives in the TopBar's
 * ForecastDrawer; this guidance moves into the CrewLog / FirstSteps slot
 * when those land, and this panel goes away.
 */
export function ReturnPlan({ work, rooms, bytes }: { work: Workforce; rooms: Room[]; bytes: number | null }) {
  const power = rooms.find(r => r.kind === "power_plant");
  const kitchen = rooms.find(r => r.kind === "cache_storage");
  return <details className="pointer-events-auto max-w-sm border border-hud-violet/40 bg-hud-bg/95 p-3 font-mono text-xs text-hud-bone">
    <summary className="cursor-pointer py-1 text-hud-violet">Build toward a working kitchen and generator</summary>
    <div className="mt-3 max-h-[40dvh] space-y-3 overflow-y-auto leading-relaxed">
      <p>{kitchen ? <Link href={`/room/${kitchen.slot}`} className="underline">Assign a Cook in Cache Storage</Link> : `Cache Storage costs ${ROOM_CATALOG.cache_storage.cost} B.`}</p>
      <p>{power ? <Link href={`/room/${power.slot}`} className="underline">Assign an Engineer in the Power Plant</Link> : `Power Plant costs ${ROOM_CATALOG.power_plant.cost} B. Save for it to keep cooking after the battery runs out.`}</p>
      {work.forks < 2 && <p>You have {work.forks} Fork. Cooking and generating power together need two workers. A second Fork costs {RECRUIT_COST} B at the <Link href="/room/0" className="underline">Main Branch</Link>{bytes !== null && bytes < RECRUIT_COST ? ` (${RECRUIT_COST - bytes} B more needed).` : "."} The Main Branch already has two beds; a Dorm can wait.</p>}
      <p className="text-hud-bone/70">Daily events can earn Bytes even without public GitHub activity. Moving workers between rooms is free.</p>
    </div>
  </details>;
}
