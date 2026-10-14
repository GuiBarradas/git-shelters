import Link from "next/link";

import { NextPacket } from "@/components/events/NextPacket";
import { nextPacketAt } from "@/lib/events/schedule";

const PANEL = "pointer-events-auto w-full border bg-hud-bg/95 font-mono text-xs max-xl:px-4 max-xl:py-3 xl:h-32 xl:w-80 xl:p-4";

/**
 * Lower-right card for today's Daily Event: waiting on the terminal
 * (amber, one action) or resolved (countdown to the next one). Below xl
 * one compact row: the label and the countdown, or the label and a 44 px
 * action. With no event loaded there is nothing honest to show.
 */
export function PacketCard({ packet, observedAt }: { packet: "pending" | "resolved" | null; observedAt: string }) {
  if (packet === null) return null;
  if (packet === "resolved") {
    return (
      <section aria-label="Next packet" className={`${PANEL} border-hud-violet/40`}>
        <NextPacket observedAt={observedAt} availableAt={nextPacketAt(observedAt)} compact />
      </section>
    );
  }
  return (
    <section aria-label="Incoming packet" className={`${PANEL} flex gap-3 border-hud-amber max-xl:flex-wrap max-xl:items-center max-xl:justify-between xl:flex-col xl:gap-0`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-hud-amber">Incoming packet</p>
      <p className="mt-2 hidden text-hud-bone xl:block">Today&apos;s decision is on the Main Branch terminal.</p>
      <Link
        href="/room/0"
        prefetch={false}
        // Beside the label on phones; a full row of its own in the narrow sm..xl column, wrapping rather than clipping.
        className="flex min-h-11 min-w-0 items-center justify-center gap-2 bg-hud-amber px-4 py-2 text-center text-[11px] uppercase tracking-[0.22em] text-hud-bg hover:bg-hud-amber/90 sm:max-xl:basis-full sm:max-xl:tracking-[0.12em] xl:mt-auto xl:h-9 xl:min-h-0 xl:py-0"
      >
        Open terminal <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
