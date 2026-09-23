"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { buildRoom, type BuildState } from "@/app/rooms/actions";
import { FORK_TRAITS, type Fork as ForkData } from "@/lib/forks/catalog";
import { type EventEcho, pickLine } from "@/lib/forks/mood";
import { isLowerSlot, ROOM_CATALOG, type Room, type RoomKind, type Slot } from "@/lib/rooms/catalog";

const BunkerScene = dynamic(() => import("./BunkerScene"), {
  ssr: false,
  loading: () => <SceneBooting />,
});

/** Shown while the renderer chunk downloads; the page is never a black hole. */
export function SceneBooting() {
  return (
    <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm text-[#BD93F9]/70">
      &gt; booting renderer<span className="blink">_</span>
    </p>
  );
}

type BunkerSceneClientProps = {
  rooms: Room[];
  forks?: ForkData[];
  /** Current balance; null when anonymous. Anonymous players cannot build. */
  bytes: number | null;
  activeToday: boolean;
  /** Today's Daily Event still unresolved: the Main Branch terminal glows. */
  eventPending?: boolean;
  /** How today's Daily Event sits with the crew; colours their poke lines. */
  echo?: EventEcho | null;
  /** Landing mode: auto-orbit, drag to rotate, tooltips, no interaction. */
  demo?: boolean;
  powered?: boolean;
};

/**
 * Owns the client state the bunker needs: which empty slot the player
 * clicked (opens the build menu) and what is under the pointer (tooltip).
 * Clicking a built room, or the Main Branch, walks into it: /room/<slot>.
 */
export function BunkerSceneClient({
  rooms,
  forks = [],
  bytes,
  activeToday,
  eventPending = false,
  demo = false,
  powered = true,
  echo = null,
}: BunkerSceneClientProps) {
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [blurb, setBlurb] = useState<string | null>(null);
  const [speech, setSpeech] = useState<{ name: string; line: string } | null>(null);
  const [pokes, setPokes] = useState(0);
  const canBuild = bytes !== null && !demo;

  // One build at a time: the menu stays open while it runs, closes on
  // success, and the outcome shows as a fading notice either way.
  const [build, buildAction, building] = useActionState(buildRoom, IDLE_BUILD);
  // A success that landed after the menu opened closes it; no effect needed.
  const [openedAt, setOpenedAt] = useState(0);
  const menuSlot = build.tone === "ok" && build.at > openedAt ? null : selectedSlot;

  const poke = (f: ForkData) => {
    setPokes((n) => n + 1);
    setSpeech({ name: f.name, line: pickLine(f.seed, pokes, f.mood, FORK_TRAITS[f.trait].line, echo) });
  };

  useEffect(() => {
    if (!speech) return;
    const id = setTimeout(() => setSpeech(null), 3500);
    return () => clearTimeout(id);
  }, [speech]);

  const onSlotClick = (slot: 0 | Slot, built: boolean, locked = false) => {
    if (built) {
      router.push(`/room/${slot}`);
    } else if (canBuild && slot !== 0 && !locked) {
      setSelectedSlot(slot);
      setOpenedAt(Date.now());
    }
  };

  return (
    <>
      <BunkerScene
        rooms={rooms}
        forks={forks}
        onForkClick={poke}
        activeToday={activeToday}
        eventPending={eventPending}
        onSlotClick={onSlotClick}
        onHoverBlurb={setBlurb}
        demo={demo}
        powered={powered}
      />
      {/* Vignette in CSS: free, and it replaced a postprocessing pass that cost 40 fps on integrated GPUs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
      />
      {speech && <SpeechBubble name={speech.name} line={speech.line} />}
      {blurb && menuSlot === null && !speech && (
        <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-[#BD93F9]/40 bg-[#0B0713]/90 px-3 py-1 font-mono text-xs text-[#E6DFC8]">
          {blurb}
          {!demo && <span className="text-[#E6DFC8]/50"> · click to enter</span>}
        </p>
      )}
      {menuSlot !== null && bytes !== null && (
        <BuildMenu
          slot={menuSlot}
          bytes={bytes}
          onClose={() => setSelectedSlot(null)}
          action={buildAction}
          building={building}
          error={build.tone === "warn" ? build.message : null}
        />
      )}
      {build.tone !== "idle" && !building && (
        <output
          key={build.at}
          aria-live="polite"
          className={`hud-fade pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border bg-[#0B0713]/95 px-3 py-1 font-mono text-xs ${
            build.tone === "ok" ? "border-[#BD93F9]/60 text-[#BD93F9]" : "border-[#A14545]/60 text-[#A14545]"
          }`}
        >
          &gt; {build.message}
        </output>
      )}
    </>
  );
}

/** What a survivor says when poked; fades on its own. */
export function SpeechBubble({ name, line }: { name: string; line: string }) {
  return (
    <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 max-w-md border border-[#E6DFC8]/40 bg-[#0B0713]/95 px-4 py-2 text-center font-mono text-sm text-[#E6DFC8]">
      <span className="text-[#BD93F9]">{name}:</span> &ldquo;{line}&rdquo;
    </p>
  );
}

const IDLE_BUILD: BuildState = { tone: "idle", message: "", at: 0 };

function BuildMenu({
  slot,
  bytes,
  onClose,
  action,
  building,
  error,
}: {
  slot: Slot;
  bytes: number;
  onClose: () => void;
  action: (formData: FormData) => void;
  building: boolean;
  error: string | null;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 border border-[#BD93F9] bg-[#0B0713]/90 p-4 font-mono text-sm text-[#BD93F9]">
      <div className="mb-3 flex items-center justify-between gap-6">
        <span>
          SLOT {slot} — BUILD{isLowerSlot(slot) ? " · LOWER FLOOR" : ""}
        </span>
        <button type="button" onClick={onClose} className="hover:text-[#E6DFC8]">
          [x]
        </button>
      </div>
      <div className="flex gap-2">
        {(Object.keys(ROOM_CATALOG) as RoomKind[]).map((kind) => {
          // An Elevator only goes on the ground floor.
          if (kind === "elevator" && isLowerSlot(slot)) return null;
          const { name, cost } = ROOM_CATALOG[kind];
          const affordable = bytes >= cost;
          return (
            <form key={kind} action={action}>
              <input type="hidden" name="slot" value={slot} />
              <input type="hidden" name="kind" value={kind} />
              <button
                type="submit"
                disabled={!affordable || building}
                aria-busy={building}
                className="border border-[#BD93F9] px-3 py-1 transition hover:bg-[#BD93F9]/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {name} · {cost} B
              </button>
            </form>
          );
        })}
      </div>
      {building ? (
        <p className="mt-3 text-xs text-[#E6DFC8]/70">
          &gt; pouring concrete<span className="blink">_</span>
        </p>
      ) : error ? (
        <p className="mt-3 text-xs text-[#A14545]">&gt; {error}</p>
      ) : null}
    </div>
  );
}
