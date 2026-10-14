import Link from "next/link";

import { ROOM_CATALOG } from "@/lib/rooms/catalog";

import { buildableSlot, type ResourceAlert } from "./resourceAlert";

// Full banner height on phones: a 44 px target.
const CTA =
  "flex shrink-0 self-stretch sm:h-8 sm:self-center items-center gap-2 bg-hud-amber px-4 text-[11px] uppercase tracking-[0.22em] text-hud-bg hover:bg-hud-amber/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-hud-amber";
/** One banner per page, so a fixed id is safe (and keeps this a server-renderable component). */
const MISSING_ID = "alert-build-missing";

/** Why the empty resource is still empty when someone is on shift. */
function staffedAdvice(alert: ResourceAlert): string {
  if (alert.kind === "blackout") {
    return alert.ratePerHour > 0 ? "An Engineer is on shift; the battery is recharging."
      : alert.ratePerHour === 0 ? "The Power Plant only covers the drain."
      : "The Power Plant is not keeping up with the drain.";
  }
  return alert.ratePerHour > 0 ? "A Cook is on shift; the shelves are refilling."
    : alert.ratePerHour === 0 ? "The Cooks only make what the crew eats."
    : "The crew eats faster than the Cooks cook.";
}

/**
 * The 44 px strip under the TopBar (both rows of it below lg) while something is broken. One line on
 * what stopped, one amber action that fixes it. In the overview `onBuild`
 * opens the build menu on the free slot; elsewhere the action links there.
 * Inside the room that fixes it (`currentSlot`) there is nowhere to go.
 */
export function AlertBanner({ alert, onBuild, currentSlot }: { alert: ResourceAlert; onBuild?: () => void; currentSlot?: number }) {
  const { name: room, cost } = ROOM_CATALOG[alert.roomKind];
  const blackout = alert.kind === "blackout";
  const effect = blackout ? "Cooking and packing stopped." : "The pantry is empty.";
  const slot = buildableSlot(alert);
  const build = alert.build;
  // A free slot and a known balance that falls short: the action shows its price, disabled.
  const short = build !== null && build.slot !== null && build.missing !== null && build.missing > 0 ? build.missing : null;

  const advice =
    !alert.room ? `There is no ${room}.`
    : !alert.room.staffed ? `Put ${blackout ? "an Engineer" : "a Cook"} in the ${room}.`
    : staffedAdvice(alert);

  return (
    <div
      role="alert"
      data-hud
      className="pointer-events-auto absolute inset-x-0 top-[108px] z-20 flex h-11 items-center gap-3 border-b sm:gap-4 lg:top-14 border-hud-red bg-hud-alert-bg px-4 font-mono text-xs"
    >
      <span className="shrink-0 text-[11px] uppercase tracking-[0.22em] text-hud-red-text">
        {blackout ? "Blackout" : "Empty pantry"}
      </span>
      <p className="min-w-0 flex-1 truncate text-hud-bone">
        {effect} {advice}
        {build && slot === null && (
          <span id={short !== null ? MISSING_ID : undefined} className="text-hud-bone/60">
            {build.slot === null ? " No free slot to build one."
              : short !== null ? ` ${short} B more needed.`
              : ` ${room} costs ${cost} B.`}
          </span>
        )}
      </p>
      {alert.room ? (
        alert.room.slot !== currentSlot && <Link href={`/room/${alert.room.slot}`} className={CTA}>
          {alert.room.staffed ? "Check" : "Go to"} {room} <span aria-hidden>→</span>
        </Link>
      ) : slot !== null && onBuild ? (
        <button type="button" onClick={onBuild} className={CTA}>
          Build {room} · {cost} B
        </button>
      ) : slot !== null ? (
        <Link href={`/?build=${alert.roomKind}`} className={CTA}>
          Build {room} · {cost} B <span aria-hidden>→</span>
        </Link>
      ) : short !== null ? (
        <button type="button" disabled aria-describedby={MISSING_ID} className={CTA}>
          Build {room} · {cost} B
        </button>
      ) : null}
    </div>
  );
}
