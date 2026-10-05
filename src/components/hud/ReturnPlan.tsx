import Link from "next/link";

import { NextPacket } from "@/components/events/NextPacket";
import { forecast, FORECAST_HOURS, type ForecastWarning } from "@/lib/economy/forecast";
import { RATES, type ResourceState, type Workforce } from "@/lib/economy/tick";
import { nextPacketAt } from "@/lib/events/schedule";
import { RECRUIT_COST } from "@/lib/forks/catalog";
import { ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";

const warnings: Record<ForecastWarning, string> = {
  cache_full: "Cache reaches capacity. Extra meals will not be stored.",
  payload_full: "Payload reaches capacity. Extra rounds will not be stored.",
  no_cooks: "Cache Storage has no Cook. Assign a Fork inside the room.",
  no_engineers: "Power Plant has no Engineer. Assign a Fork inside the room.",
  no_tinkerers: "Workshop has no Tinkerer. Assign a Fork inside the room.",
};

export function ReturnPlan({ resources, work, rooms, bytes, resolved, observedAt }: {
  resources: ResourceState; work: Workforce; rooms: Room[]; bytes: number | null;
  resolved: boolean; observedAt: string;
}) {
  const future = forecast(resources, work);
  const delta = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
  const power = rooms.find(r => r.kind === "power_plant");
  const kitchen = rooms.find(r => r.kind === "cache_storage");
  return <details className="pointer-events-auto max-w-sm border border-[#BD93F9]/40 bg-[#0B0713]/95 p-3 font-mono text-xs text-[#E6DFC8]">
    <summary className="cursor-pointer py-1 text-[#BD93F9]">Before you go · next event & offline progress</summary>
    <div className="mt-3 max-h-[40dvh] space-y-3 overflow-y-auto leading-relaxed">
      {resolved ? <NextPacket observedAt={observedAt} availableAt={nextPacketAt(observedAt)} /> : <Link href="/room/0" className="text-[#BD93F9] underline">Read today&apos;s event at the Main Branch</Link>}
      <h3>If you return in {FORECAST_HOURS} hours</h3>
      <ul className="tabular-nums">
        <li>Cache: {resources.cache} → {future.cache} ({delta(future.delta.cache)})</li>
        <li>Uptime: {resources.uptime}% → {future.uptime}% ({delta(future.delta.uptime)} points)</li>
        {work.workshops > 0 && <li>Payload: {resources.payload} → {future.payload} ({delta(future.delta.payload)})</li>}
      </ul>
      {future.blackout && <p className="text-[#E67E22]">Power will be depleted. Cooking and packing stop without power.</p>}
      {future.starved && <p className="text-[#E67E22]">The crew will run out of food in this window.</p>}
      {future.warnings.map(warning => <p key={warning} className="text-[#E67E22]">{warnings[warning]}</p>)}
      <p className="text-[#E6DFC8]/60">Estimate from this visit, with current jobs and storage limits. Resources settle when you return, up to {RATES.maxHours / 24} days away. Rooms produce resources, not Bytes.</p>
      <h3 className="text-[#BD93F9]">Build toward a working kitchen and generator</h3>
      <p>{kitchen ? <Link href={`/room/${kitchen.slot}`} className="underline">Assign a Cook in Cache Storage</Link> : `Cache Storage costs ${ROOM_CATALOG.cache_storage.cost} B.`}</p>
      <p>{power ? <Link href={`/room/${power.slot}`} className="underline">Assign an Engineer in the Power Plant</Link> : `Power Plant costs ${ROOM_CATALOG.power_plant.cost} B. Save for it to keep cooking after the battery runs out.`}</p>
      {work.forks < 2 && <p>You have {work.forks} Fork. Cooking and generating power together need two workers. A second Fork costs {RECRUIT_COST} B at the <Link href="/room/0" className="underline">Main Branch</Link>{bytes !== null && bytes < RECRUIT_COST ? ` (${RECRUIT_COST - bytes} B more needed).` : "."} The Main Branch already has two beds; a Dorm can wait.</p>}
      <p className="text-[#E6DFC8]/70">Daily events can earn Bytes even without public GitHub activity. Moving workers between rooms is free.</p>
    </div>
  </details>;
}
