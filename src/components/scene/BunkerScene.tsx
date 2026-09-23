"use client";

import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useState } from "react";

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
  type Slot,
} from "@/lib/rooms/catalog";

import { Fork } from "./Fork";
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

/**
 * Cross-section camera (design doc §5.1): almost frontal, a little above
 * and to the right so the cells have depth. Zoom follows viewport width
 * so the whole floor fits a phone and stops growing past a laptop.
 */
function Camera({ lookY }: { lookY: number }) {
  const width = useThree((state) => state.size.width);
  const camera = useThree((state) => state.camera);
  const zoom = Math.min(58, Math.max(18, (width * 0.92) / ROW_WIDTH));
  useLayoutEffect(() => {
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
  }, [camera, zoom, lookY]);
  return (
    <OrthographicCamera makeDefault position={[6, 6.5, 24]} zoom={zoom} near={0.1} far={200} />
  );
}

/** Invisible pointer target covering one cell, so hover and click ignore the props. */
function CellHitbox({ onClick, onHover }: { onClick?: () => void; onHover: (h: boolean) => void }) {
  return (
    <mesh
      position={[0, CELL.h / 2, 0]}
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
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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
}: BunkerSceneProps) {
  const bySlot = new Map(rooms.map((room) => [room.slot, room]));
  const [hovered, setHovered] = useState<number | null>(null);
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
  const lookY = demo ? CELL.h / 2 + 3.2 : CELL.h / 2 + LOWER_Y / 2 + 0.4;
  const elevator = hasElevator(rooms);

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: palette.coalBlack }}
    >
      <Camera lookY={lookY} />
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
      <ambientLight color={palette.boneWhite} intensity={0.75} />
      <directionalLight position={[8, 12, 10]} color={palette.boneWhite} intensity={0.7} />

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
        <MainBranchRoom active={activeToday} pending={eventPending} powered={powered} />
        {forksIn(0).map((f) => (
          <Fork key={f.id} fork={f} layout={roomLayout(null)} onClick={onForkClick} onHover={forkHover} />
        ))}
        <CellHitbox
          onClick={demo ? undefined : () => onSlotClick(0, true)}
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
              <BuiltRoom kind={room.kind} powered={powered} />
            ) : (
              <EmptyCell highlight={hovered === slot && !demo && !locked} locked={locked} />
            )}
            {room &&
              forksIn(slot).map((f) => (
                <Fork key={f.id} fork={f} layout={roomLayout(room.kind)} onClick={onForkClick} onHover={forkHover} />
              ))}
            <CellHitbox
              onClick={demo || locked ? undefined : () => onSlotClick(slot, Boolean(room), locked)}
              onHover={hover(slot, room ? ROOM_CATALOG[room.kind].blurb : locked ? LOCKED_SLOT_BLURB : EMPTY_SLOT_BLURB)}
            />
          </group>
        );
      })}
    </Canvas>
  );
}
