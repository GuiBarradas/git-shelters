"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buildRoom } from "@/app/rooms/actions";
import { ROOM_CATALOG, type Room, type RoomKind, type Slot } from "@/lib/rooms/catalog";

const BunkerScene = dynamic(() => import("./BunkerScene"), { ssr: false });

type BunkerSceneClientProps = {
  rooms: Room[];
  /** Current balance; null when anonymous. Anonymous players cannot build. */
  bytes: number | null;
  activeToday: boolean;
  /** Today's Daily Event still unresolved: the Main Branch terminal glows. */
  eventPending?: boolean;
  /** Landing mode: auto-orbit, drag to rotate, tooltips, no interaction. */
  demo?: boolean;
};

/**
 * Owns the client state the bunker needs: which empty slot the player
 * clicked (opens the build menu) and what is under the pointer (tooltip).
 * Clicking a built room, or the Main Branch, walks into it: /room/<slot>.
 */
export function BunkerSceneClient({
  rooms,
  bytes,
  activeToday,
  eventPending = false,
  demo = false,
}: BunkerSceneClientProps) {
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [blurb, setBlurb] = useState<string | null>(null);
  const canBuild = bytes !== null && !demo;

  const onSlotClick = (slot: 0 | Slot, built: boolean) => {
    if (built) {
      router.push(`/room/${slot}`);
    } else if (canBuild && slot !== 0) {
      setSelectedSlot(slot);
    }
  };

  return (
    <>
      <BunkerScene
        rooms={rooms}
        activeToday={activeToday}
        eventPending={eventPending}
        onSlotClick={onSlotClick}
        onHoverBlurb={setBlurb}
        demo={demo}
      />
      {/* Vignette in CSS: free, and it replaced a postprocessing pass that cost 40 fps on integrated GPUs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
      />
      {blurb && selectedSlot === null && (
        <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-[#7FFF6A]/40 bg-[#0F0F0F]/90 px-3 py-1 font-mono text-xs text-[#E6DFC8]">
          {blurb}
          {!demo && <span className="text-[#E6DFC8]/50"> · click to enter</span>}
        </p>
      )}
      {selectedSlot !== null && bytes !== null && (
        <BuildMenu slot={selectedSlot} bytes={bytes} onClose={() => setSelectedSlot(null)} />
      )}
    </>
  );
}

function BuildMenu({ slot, bytes, onClose }: { slot: Slot; bytes: number; onClose: () => void }) {
  return (
    <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 border border-[#7FFF6A] bg-[#0F0F0F]/90 p-4 font-mono text-sm text-[#7FFF6A]">
      <div className="mb-3 flex items-center justify-between gap-6">
        <span>SLOT {slot} — BUILD</span>
        <button type="button" onClick={onClose} className="hover:text-[#E6DFC8]">
          [x]
        </button>
      </div>
      <div className="flex gap-2">
        {(Object.keys(ROOM_CATALOG) as RoomKind[]).map((kind) => {
          const { name, cost } = ROOM_CATALOG[kind];
          const affordable = bytes >= cost;
          return (
            <form key={kind} action={buildRoom} onSubmit={onClose}>
              <input type="hidden" name="slot" value={slot} />
              <input type="hidden" name="kind" value={kind} />
              <button
                type="submit"
                disabled={!affordable}
                className="border border-[#7FFF6A] px-3 py-1 transition hover:bg-[#7FFF6A]/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {name} · {cost} B
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
