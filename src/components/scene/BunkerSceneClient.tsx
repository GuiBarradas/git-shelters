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
  /** Landing mode: auto-orbit, drag to rotate, tooltips, no building. */
  demo?: boolean;
};

/**
 * Owns the two pieces of client state the bunker needs: which empty slot
 * the player clicked, and what is under the pointer. The build menu and
 * the tooltip are plain HTML over the canvas; each build option is a form
 * posting to the buildRoom Server Action.
 */
export function BunkerSceneClient({
  rooms,
  bytes,
  activeToday,
  demo = false,
}: BunkerSceneClientProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [blurb, setBlurb] = useState<string | null>(null);
  const canBuild = bytes !== null && !demo;

  return (
    <>
      <BunkerScene
        rooms={rooms}
        activeToday={activeToday}
        onEmptySlotClick={canBuild ? setSelectedSlot : () => {}}
        onHoverBlurb={setBlurb}
        demo={demo}
      />
      {blurb && selectedSlot === null && (
        <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-[#7FFF6A]/40 bg-[#0F0F0F]/90 px-3 py-1 font-mono text-xs text-[#E6DFC8]">
          {blurb}
        </p>
      )}
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
