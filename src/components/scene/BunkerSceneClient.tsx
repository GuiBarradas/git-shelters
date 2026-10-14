"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";

import type { GeneratedBunker } from "@/lib/visuals/types";
import { useQuality } from "./SceneQuality";
import { buildRoom, type BuildState } from "@/app/rooms/actions";
import { AlertBanner } from "@/components/hud/AlertBanner";
import { FirstSteps, type FirstStepsState } from "@/components/hud/FirstSteps";
import { GameDock } from "@/components/hud/GameDock";
import { buildableSlot, type ResourceAlert, type StaffingTarget } from "@/components/hud/resourceAlert";
import { LowerBand } from "@/components/hud/LowerBand";
import { RoomPager } from "@/components/hud/RoomPager";
import { useHudInset, usePhone } from "./hudInset";
import { setPage, useOverviewPage } from "./pager";
import { FORK_TRAITS, type Fork as ForkData } from "@/lib/forks/catalog";
import { type EventEcho, JOB_LINES, pickLine } from "@/lib/forks/mood";
import { GROUND_SLOTS, isLowerSlot, ROOM_CATALOG, type Room, type RoomKind, type Slot } from "@/lib/rooms/catalog";
import { RegisteredBunkerScene as BunkerScene } from "./BunkerViewport";

type BunkerSceneClientProps = {
  rooms: Room[];
  visuals?: GeneratedBunker | null;
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
  onboarding?: FirstStepsState;
  /** What is blocking the economy; shows the AlertBanner under the TopBar. */
  alert?: ResourceAlert | null;
  /** Arrived from a banner elsewhere (`/?build=`): open the build menu on the alert's free slot. */
  openBuild?: boolean;
  /**
   * The bunker overview's lower band (server-rendered pieces): the CrewLog,
   * which FirstSteps replaces during onboarding, and the PacketCard. The
   * dock between them is built here, next to the share data.
   */
  band?: { crewLog: ReactNode; packet: ReactNode };
  /** The room that should get a worker next (shared with onboarding); drawn as the scene's chip. */
  staffing?: StaffingTarget | null;
  /** A notice under the AlertBanner (the AwaySummary), placed after it so Tab follows the screen. */
  notice?: ReactNode;
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
  onboarding,
  visuals,
  alert = null,
  openBuild = false,
  band,
  staffing = null,
  notice,
}: BunkerSceneClientProps) {
  const router = useRouter();
  const quality = useQuality();
  const [inset, bandRef] = useHudInset(!!alert);
  const phone = usePhone();
  const page = useOverviewPage();
  const pager = band && !demo && phone ? { page, onPage: setPage } : null;
  // Notices sit just above the lower band (or the screen edge without one).
  const above = (gap: number, bare: number) => (band ? inset.bottom + gap : bare);
  const fixSlot = bytes !== null && !demo ? buildableSlot(alert) : null;
  const [previewKind, setPreviewKind] = useState<RoomKind | null>(openBuild && fixSlot !== null && alert ? alert.roomKind : null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(openBuild ? fixSlot : null);
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
    const kind = rooms.find((r) => r.slot === f.roomSlot)?.kind;
    setSpeech({
      name: f.name,
      line: pickLine(f.seed, pokes, f.mood, FORK_TRAITS[f.trait].lines, echo, JOB_LINES[kind ?? "off_shift"]),
    });
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
      setPreviewKind(null);
      setSelectedSlot(slot);
      setOpenedAt(Date.now());
    }
  };

  return (
    <>
      <BunkerScene
        visuals={visuals}
        buildPreview={menuSlot !== null && previewKind && bytes !== null ? {slot: menuSlot, kind: previewKind, missingBytes: Math.max(0, ROOM_CATALOG[previewKind].cost - bytes)} : null}
        rooms={rooms}
        forks={forks}
        onForkClick={poke}
        activeToday={activeToday}
        eventPending={eventPending}
        onSlotClick={onSlotClick}
        onHoverBlurb={setBlurb}
        demo={demo}
        powered={powered}
        // Only the signed-in overview reserves HUD space and gets the card and chip; landing and public stay as they were.
        hudInset={band ? inset : undefined}
        gameplay={!!band}
        blocker={band && staffing ? { slot: staffing.slot, role: staffing.role } : null}
        pager={pager}
      />
      {/* Low quality uses a CSS vignette; the other presets already have a post pass. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: quality === "low" ? "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.25) 100%)" : undefined }}
      />
      {alert && !demo && (
        <AlertBanner
          alert={alert}
          onBuild={fixSlot === null ? undefined : () => {
            onSlotClick(fixSlot, false);
            setPreviewKind(alert.roomKind);
          }}
        />
      )}
      {notice}
      {speech && <SpeechBubble name={speech.name} line={speech.line} bottom={above(16, 24)} />}
      {blurb && menuSlot === null && !speech && (
        <p style={{ bottom: above(16, 24) }} className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-[#BD93F9]/40 bg-[#0B0713]/90 px-3 py-1 font-mono text-xs text-[#E6DFC8]">
          {blurb}
          {!demo && <span className="text-[#E6DFC8]/50"> · click to enter</span>}
        </p>
      )}
      {menuSlot !== null && bytes !== null && (
        <BuildMenu
          onPreview={setPreviewKind}
          slot={menuSlot}
          bytes={bytes}
          onClose={() => setSelectedSlot(null)}
          action={buildAction}
          building={building}
          firstRoom={rooms.length === 0}
          error={build.tone === "warn" ? build.message : null}
          bottom={above(16, 56)}
          top={inset.top}
        />
      )}
      {band && !demo && (
        <LowerBand
          bandRef={bandRef}
          pager={pager && <RoomPager page={pager.page} onPage={pager.onPage} />}
          logHidden={menuSlot !== null}
          log={onboarding ? (
            <FirstSteps {...onboarding} built={rooms.length > 0} bytes={bytes} fallback={band.crewLog} onBuild={() => {
              const slot = GROUND_SLOTS.find((s) => !rooms.some((r) => r.slot === s));
              if (slot !== undefined) onSlotClick(slot, false);
            }} />
          ) : band.crewLog}
          packet={band.packet}
          dock={<GameDock share={visuals && bytes !== null ? { bunker: visuals, forks } : null} />}
        />
      )}
      {build.tone !== "idle" && !building && (
        <output
          key={build.at}
          aria-live="polite"
          style={{ bottom: above(56, 80) }}
          className={`hud-fade pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border bg-[#0B0713]/95 px-3 py-1 font-mono text-xs ${
            build.tone === "ok" ? "border-[#BD93F9]/60 text-[#BD93F9]" : "border-[#A14545]/60 text-[#A14545]"
          }`}
        >
          &gt; {build.message}
        </output>
      )}
    </>
  );
}

/** What a survivor says when poked; fades on its own. `bottom` in px clears the lower band. */
export function SpeechBubble({ name, line, bottom = 24 }: { name: string; line: string; bottom?: number }) {
  return (
    <p style={{ bottom }} className="pointer-events-none absolute left-1/2 z-10 w-max max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 border border-[#E6DFC8]/40 bg-[#0B0713]/95 px-4 py-2 text-center font-mono text-sm text-[#E6DFC8]">
      <span className="text-[#BD93F9]">{name}:</span> &ldquo;{line}&rdquo;
    </p>
  );
}

const IDLE_BUILD: BuildState = { tone: "idle", message: "", at: 0 };

function BuildMenu({
  onPreview,
  slot,
  bytes,
  onClose,
  action,
  building,
  error,
  firstRoom,
  bottom,
  top,
}: {
  onPreview: (kind: RoomKind) => void;
  slot: Slot;
  bytes: number;
  onClose: () => void;
  action: (formData: FormData) => void;
  building: boolean;
  error: string | null;
  firstRoom: boolean;
  /** px from the bottom edge: above the lower band on the overview. */
  bottom: number;
  /** px the TopBar (and banner) take; the menu never grows under them. */
  top: number;
}) {
  return (
    <div style={{ bottom, maxHeight: `min(60dvh, calc(100dvh - ${top + bottom + 16}px))` }} className={`pointer-events-auto absolute left-1/2 z-20 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 overflow-y-auto border border-[#BD93F9] bg-[#0B0713]/95 p-4 font-mono text-sm text-[#BD93F9]`}>
      <div className="mb-3 flex items-center justify-between gap-6">
        <span>
          SLOT {slot} — BUILD{isLowerSlot(slot) ? " · LOWER FLOOR" : ""}
        </span>
        <button type="button" onClick={onClose} className="hover:text-[#E6DFC8]">
          [x]
        </button>
      </div>
      {firstRoom && <p className="mb-3 text-xs text-[#E6DFC8]/80">Cache Storage + a Cook makes food while powered. Power Plant + an Engineer keeps the lights on. You start with one free Fork and two beds; save the Dorm for later.</p>}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ROOM_CATALOG) as RoomKind[]).map((kind) => {
          // An Elevator only goes on the ground floor.
          if (kind === "elevator" && isLowerSlot(slot)) return null;
          const { name, cost } = ROOM_CATALOG[kind];
          const affordable = bytes >= cost;
          return (
            <form key={kind} action={action} onMouseEnter={() => onPreview(kind)} onFocusCapture={() => onPreview(kind)}>
              <input type="hidden" name="slot" value={slot} />
              <input type="hidden" name="kind" value={kind} />
              <button
                type="submit"
                disabled={!affordable || building}
                aria-busy={building}
                className="border border-[#BD93F9] px-3 py-1 transition hover:bg-[#BD93F9]/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {name} · {cost} B
                {firstRoom && <span className="mt-1 block max-w-48 text-[10px] text-[#E6DFC8]/70">{ROOM_CATALOG[kind].blurb}</span>}
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
