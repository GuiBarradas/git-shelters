import { forecast, FORECAST_HOURS } from "@/lib/economy/forecast";
import type { ResourceState, Workforce } from "@/lib/economy/tick";
import { RECRUIT_COST } from "@/lib/forks/catalog";
import { describeCrew, type EventEcho, type Mood } from "@/lib/forks/mood";
import { ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";

import { FORECAST_WARNINGS } from "./forecastCopy";
import type { ResourceAlert } from "./resourceAlert";

export type CrewTip = { text: string; tone: string };

const ECHO: Record<EventEcho, string | null> = {
  pending: "a packet is waiting on the Main Branch terminal",
  good: "lifted by today's packet",
  bad: "rattled by today's packet",
  flat: null,
};

/**
 * The one thing most worth saying after mood and packet: what the
 * forecast says goes wrong, a staffing gap, then what to build next.
 * While an AlertBanner is up it already names the fix, so the log only
 * adds what else the next {@link FORECAST_HOURS} hours bring, never a
 * different room to staff.
 */
export function crewTip({ resources, work, rooms, bytes, alert }: {
  resources: ResourceState;
  work: Workforce;
  rooms: Room[];
  bytes: number | null;
  alert: ResourceAlert | null;
}): CrewTip | null {
  const future = forecast(resources, work);
  const red = "text-hud-red-text";
  if (alert) {
    return alert.kind === "blackout" && future.starved && resources.cache > 0
      ? { text: `Food runs out within ${FORECAST_HOURS} hours too.`, tone: red }
      : null;
  }
  if (future.blackout) return { text: `Power runs out within ${FORECAST_HOURS} hours. Cooking and packing stop then.`, tone: red };
  if (future.starved) return { text: `Food runs out within ${FORECAST_HOURS} hours.`, tone: red };
  const kitchen = rooms.some((r) => r.kind === "cache_storage");
  const plant = rooms.some((r) => r.kind === "power_plant");
  // One Fork cannot cook and run the plant: moving it only swaps the gap, so the recruit tip wins.
  const shortHanded = kitchen && plant && work.forks < 2;
  if (!shortHanded) {
    for (const w of ["no_engineers", "no_cooks", "no_tinkerers"] as const) {
      if (future.warnings.includes(w)) return FORECAST_WARNINGS[w];
    }
  }
  const plain = "text-hud-bone/70";
  if (!kitchen) {
    return { text: `Cache Storage costs ${ROOM_CATALOG.cache_storage.cost} B. A Cook there makes food while the lights are on.`, tone: plain };
  }
  if (!plant) {
    return { text: `Power Plant costs ${ROOM_CATALOG.power_plant.cost} B. It keeps the kitchen lit after the battery runs out.`, tone: plain };
  }
  if (shortHanded) {
    const short = bytes !== null && bytes < RECRUIT_COST ? ` (${RECRUIT_COST - bytes} B more needed)` : "";
    return { text: `Cooking and power together need two workers. A second Fork costs ${RECRUIT_COST} B at the Main Branch${short}.`, tone: plain };
  }
  const full = future.warnings.find((w) => w === "cache_full" || w === "payload_full");
  return full ? FORECAST_WARNINGS[full] : null;
}

/** Lower-left log: crew size and idle hands, then up to three `>` lines. FirstSteps takes this slot during onboarding. */
export function CrewLog({ mood, lastPushAt, echo, forks, tip }: {
  mood: Mood;
  lastPushAt: string | null;
  echo: EventEcho | null;
  forks: ReadonlyArray<{ roomSlot: number | null }>;
  tip: CrewTip | null;
}) {
  // A Fork with no room wanders the Main Branch: that is idle.
  const idle = forks.filter((f) => !f.roomSlot).length;
  const packet = echo ? ECHO[echo] : null;
  return (
    <section aria-label="Crew log" className="pointer-events-auto h-32 w-full overflow-hidden border border-hud-violet/40 bg-hud-bg/95 p-4 font-mono text-xs lg:w-[380px]">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-hud-violet">Crew.log</h2>
        <p className="text-[10px] text-hud-bone/60">
          {forks.length} {forks.length === 1 ? "Fork" : "Forks"} ·{" "}
          <span className={idle > 0 ? "text-hud-amber" : ""}>{idle} idle</span>
        </p>
      </div>
      <ul className="space-y-1 leading-snug">
        <li className="truncate text-hud-bone">&gt; {describeCrew(mood, lastPushAt)}</li>
        {packet && <li className="truncate text-hud-bone/70">&gt; {packet}</li>}
        {tip && <li className={`line-clamp-2 ${tip.tone}`}>&gt; {tip.text}</li>}
      </ul>
    </section>
  );
}
