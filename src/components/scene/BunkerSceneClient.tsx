"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { buildRoom } from "@/app/rooms/actions";
import { ROOM_CATALOG, type Room, type RoomKind, type Slot } from "@/lib/rooms/catalog";

const BunkerScene = dynamic(() => import("./BunkerScene"), { ssr: false });

type BunkerSceneClientProps = {
  rooms: Room[];
  /** Current balance; null when anonymous. Anonymous players cannot build. */
  bytes: number | null;
  activeToday: boolean;
};

/**
 * Owns the one piece of client state the bunker needs: which empty slot
 * the player clicked. The build menu is plain HTML over the canvas, and
 * each option is a form posting to the buildRoom Server Action.
 */
export function BunkerSceneClient({ rooms, bytes, activeToday }: BunkerSceneClientProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const canBuild = bytes !== null;

  return (
    <>
      <BunkerScene
        rooms={rooms}
        activeToday={activeToday}
        onEmptySlotClick={canBuild ? setSelectedSlot : () => {}}
      />
      {selectedSlot !== null && bytes !== null && (
        <BuildMenu
          slot={selectedSlot}
          bytes={bytes}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </>
  );
}

function BuildMenu({
  slot,
  bytes,
  onClose,
}: {
  slot: Slot;
  bytes: number;
  onClose: () => void;
}) {
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
