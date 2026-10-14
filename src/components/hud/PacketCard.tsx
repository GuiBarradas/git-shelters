import Link from "next/link";

import { NextPacket } from "@/components/events/NextPacket";
import { nextPacketAt } from "@/lib/events/schedule";

const PANEL = "pointer-events-auto h-32 w-full border bg-hud-bg/95 p-4 font-mono text-xs lg:w-80";

/**
 * Lower-right card for today's Daily Event: waiting on the terminal
 * (amber, one action) or resolved (countdown to the next one). With no
 * event loaded there is nothing honest to show, so nothing renders.
 */
export function PacketCard({ packet, observedAt }: { packet: "pending" | "resolved" | null; observedAt: string }) {
  if (packet === null) return null;
  if (packet === "resolved") {
    return (
      <section aria-label="Next packet" className={`${PANEL} border-hud-violet/40`}>
        <NextPacket observedAt={observedAt} availableAt={nextPacketAt(observedAt)} />
      </section>
    );
  }
  return (
    <section aria-label="Incoming packet" className={`${PANEL} flex flex-col border-hud-amber`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-hud-amber">Incoming packet</p>
      <p className="mt-2 text-hud-bone">Today&apos;s decision is on the Main Branch terminal.</p>
      <Link
        href="/room/0"
        className="mt-auto flex h-9 items-center justify-center gap-2 bg-hud-amber text-[11px] uppercase tracking-[0.22em] text-hud-bg hover:bg-hud-amber/90"
      >
        Open terminal <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
