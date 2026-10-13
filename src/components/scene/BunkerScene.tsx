"use client";

import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

import { FORK_TRAITS, type Fork as ForkData } from "@/lib/forks/catalog";
import { MOOD_LABEL } from "@/lib/forks/mood";
import { palette } from "@/lib/palette";
import {
  EMPTY_SLOT_BLURB,
  GROUND_SLOTS,
  hasElevator,
  LOCKED_SLOT_BLURB,
  LOWER_SLOTS,
  MAIN_BRANCH_BLURB,
  ROOM_CATALOG,
  type Room,
  type RoomKind,
  type Slot,
} from "@/lib/rooms/catalog";

import { DioramaCamera } from "./DioramaCamera";
import { QualityControl, SceneEffects, useQuality } from "./SceneQuality";
import { SceneInstances } from "./SceneInstances";
import { Fork } from "./Fork";
import { RoomOccupants } from "./rooms/Details";
import { BuiltRoom, CELL, EmptyCell, MainBranchRoom, roomLayout } from "./rooms";

type BunkerSceneProps = {
  rooms: Room[];
  forks?: ForkData[];
  onForkClick?: (fork: ForkData) => void;
  /** The bunker pushed code today. */
  activeToday: boolean;
  /** Today's Daily Event is still waiting on the Main Branch terminal. */
  eventPending?: boolean;
  onSlotClick: (slot: 0 | Slot, built: boolean, locked?: boolean) => void;
  /** In-world blurb of whatever is under the pointer, or null. */
  onHoverBlurb?: (blurb: string | null) => void;
  /** Landing mode: slow auto-orbit and drag to rotate, nothing else. */
  demo?: boolean;
  /** False in a blackout: every lamp dies down. */
  powered?: boolean;
  buildPreview?: { slot: Slot; kind: RoomKind; missingBytes: number } | null;
};

/** Distance between cell centres (pillars sit in the gap). */
const PITCH = CELL.w + 0.55;
/** Cells per floor: the Main Branch plus four upstairs, five below. */
const SLOT_COUNT = GROUND_SLOTS.length + 1;
/** Column of a slot on its floor; slot 0 leftmost, so the Main Branch reads as the entrance. */
const slotX = (slot: number) => ((slot >= 5 ? slot - 5 : slot) - (SLOT_COUNT - 1) / 2) * PITCH;
/** The lower floor hangs one cell plus a slab of earth below the ground floor. */
const LOWER_Y = -(CELL.h + 1.0);
const slotY = (slot: number) => (slot >= 5 ? LOWER_Y : 0);
const ROW_WIDTH = PITCH * SLOT_COUNT;

/** Invisible pointer target covering one cell, so hover and click ignore the props. */
function CellHitbox({ onClick, onHover }: { onClick?: () => void; onHover: (h: boolean) => void }) {
  return (
    // Invisible meshes still raycast, and skip the draw call an opacity-0 one costs.
    <mesh
      position={[0, CELL.h / 2, 0]}
      visible={false}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={(e) => {
        e.stopPropagation();
        if (onClick) document.body.style.cursor = "pointer";
        onHover(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        onHover(false);
      }}
    >
      <boxGeometry args={[CELL.w, CELL.h, CELL.d]} />
    </mesh>
  );
}

export default function BunkerScene({
  rooms,
  forks = [],
  onForkClick,
  activeToday,
  eventPending = false,
  onSlotClick,
  onHoverBlurb,
  demo = false,
  powered = true,
  buildPreview,
}: BunkerSceneProps) {
  const quality = useQuality();
  const [focus, setFocus] = useState<[number, number, number] | null>(null);
  const transition = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (transition.current) clearTimeout(transition.current); }, []);
  const enter = (slot: 0 | Slot, built: boolean, locked = false) => {
    if (transition.current) return;
    if (!built) { setFocus(null); onSlotClick(slot, false, locked); return; }
    setFocus([slotX(slot), slotY(slot) + CELL.h / 2, 0]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    transition.current = setTimeout(() => { transition.current = null; onSlotClick(slot, true, locked); }, reduced ? 0 : 550);
  };
  const bySlot = new Map(rooms.map((room) => [room.slot, room]));
  const [hovered, setHovered] = useState<number | null>(null);
  // ponytail: quality only steps down this visit; add recovery if long sessions need it.
  const [dpr, setDpr] = useState(1.25);
  // A Fork with no room wanders the Main Branch.
  const forksIn = (slot: number) => forks.filter((f) => (f.roomSlot ?? 0) === slot);
  const forkHover = (f: ForkData | null) =>
    onHoverBlurb?.(f ? `${f.name} · ${FORK_TRAITS[f.trait].name} · ${MOOD_LABEL[f.mood]}` : null);
  const hover = (slot: number, blurb: string) => (h: boolean) => {
    setHovered(h ? slot : null);
    onHoverBlurb?.(h ? blurb : null);
  };
  // The landing keeps the hero text above the bunker: look higher, so the
  // row sits in the lower half of the screen.
  // Two floors: aim between them, a little high so the ground floor leads.
  const lookY = demo ? CELL.h / 2 + 1.8 : CELL.h / 2 + LOWER_Y / 2 + 0.4;
  const elevator = hasElevator(rooms);

  return (
    <>
    <QualityControl value={quality} />
    <Canvas
      dpr={Math.min(dpr, quality === "low" ? 1 : 1.25)}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      style={{ background: "radial-gradient(ellipse at 50% 45%, #211529, #0c0911 75%)" }}
    >
      <PerformanceMonitor
        ms={500}
        iterations={4}
        threshold={0.5}
        bounds={() => [60, 65]}
        onDecline={() => setDpr(value => Math.max(0.75, value - 0.1))}
      />
      <DioramaCamera width={ROW_WIDTH} height={demo ? 12 : 9.5} center={[0,lookY,0]} focus={focus} controls={demo} />
      {demo && (
        <OrbitControls
          target={[0, lookY, 0]}
          autoRotate
          autoRotateSpeed={0.35}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 2.1}
          minAzimuthAngle={-0.5}
          maxAzimuthAngle={0.5}
        />
      )}

      {/* cold fill from outside; the warm light is each room's own lamp */}
      <hemisphereLight args={["#978dbb", "#30232f", powered ? 0.42 : 0.18]} />
      <directionalLight position={[-3, 8, 10]} color={palette.lampWarm} intensity={powered ? 0.65 : 0.18} />

      <SceneInstances simpleLighting={quality === "low"}>
      {/* the earth the bunker is dug into */}
      <mesh position={[0, LOWER_Y - 2.2, -1]}>
        <boxGeometry args={[ROW_WIDTH * 3, 4, CELL.d + 6]} />
        <meshToonMaterial color="#121315" />
      </mesh>
      <mesh position={[0, CELL.h + 2.4, -2]}>
        <boxGeometry args={[ROW_WIDTH * 3, 4, CELL.d + 4]} />
        <meshToonMaterial color="#121315" />
      </mesh>

      <group position={[slotX(0), 0, 0]}>
        <RoomOccupants.Provider value={forksIn(0).length}><MainBranchRoom active={activeToday} pending={eventPending} powered={powered} /></RoomOccupants.Provider>
        {forksIn(0).map((f, i) => (
          <Fork key={f.id} fork={f} powered={powered} stationIndex={i} layout={roomLayout(null)} onClick={onForkClick} onHover={forkHover} />
        ))}
        <CellHitbox
          onClick={demo ? undefined : () => enter(0, true)}
          onHover={hover(0, MAIN_BRANCH_BLURB)}
        />
      </group>

      {/* the slab between floors */}
      <mesh position={[0, LOWER_Y + CELL.h + 0.5, 0]}>
        <boxGeometry args={[ROW_WIDTH + 0.5, 0.5, CELL.d + 0.4]} />
        <meshToonMaterial color="#1c1a21" />
      </mesh>

      {[...GROUND_SLOTS, ...LOWER_SLOTS].map((slot) => {
        const room = bySlot.get(slot);
        const locked = slot >= 5 && !elevator;
        return (
          <group key={slot} position={[slotX(slot), slotY(slot), 0]}>
            {room ? (
              <RoomOccupants.Provider value={forksIn(slot).length}><BuiltRoom kind={room.kind} powered={powered} /></RoomOccupants.Provider>
            ) : (
              <EmptyCell highlight={(hovered === slot || buildPreview?.slot === slot) && !demo && !locked} locked={locked} preview={buildPreview?.slot === slot ? buildPreview : undefined} />
            )}
            {room &&
              forksIn(slot).map((f, i) => (
                <Fork key={f.id} fork={f} powered={powered} stationIndex={i} layout={roomLayout(room.kind)} onClick={onForkClick} onHover={forkHover} />
              ))}
            <CellHitbox
              onClick={demo || locked ? undefined : () => enter(slot, Boolean(room), locked)}
              onHover={hover(slot, room ? ROOM_CATALOG[room.kind].blurb : locked ? LOCKED_SLOT_BLURB : EMPTY_SLOT_BLURB)}
            />
          </group>
        );
      })}
      </SceneInstances>
      <SceneEffects quality={quality} />
    </Canvas>
    </>
  );
}
