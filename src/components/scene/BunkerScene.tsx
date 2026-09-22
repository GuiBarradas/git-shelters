"use client";

import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useState } from "react";

import { palette } from "@/lib/palette";
import {
  BUILDABLE_SLOTS,
  EMPTY_SLOT_BLURB,
  MAIN_BRANCH_BLURB,
  ROOM_CATALOG,
  type Room,
  type Slot,
} from "@/lib/rooms/catalog";

import { BuiltRoom, CELL, EmptyCell, MainBranchRoom } from "./rooms";

type BunkerSceneProps = {
  rooms: Room[];
  /** The bunker pushed code today. */
  activeToday: boolean;
  /** Today's Daily Event is still waiting on the Main Branch terminal. */
  eventPending?: boolean;
  onSlotClick: (slot: 0 | Slot, built: boolean) => void;
  /** In-world blurb of whatever is under the pointer, or null. */
  onHoverBlurb?: (blurb: string | null) => void;
  /** Landing mode: slow auto-orbit and drag to rotate, nothing else. */
  demo?: boolean;
};

/** Distance between cell centres (pillars sit in the gap). */
const PITCH = CELL.w + 0.55;
const SLOT_COUNT = BUILDABLE_SLOTS.length + 1;
/** Slot 0 leftmost, so the Main Branch reads as the entrance. */
const slotX = (slot: number) => (slot - (SLOT_COUNT - 1) / 2) * PITCH;
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
  activeToday,
  eventPending = false,
  onSlotClick,
  onHoverBlurb,
  demo = false,
}: BunkerSceneProps) {
  const bySlot = new Map(rooms.map((room) => [room.slot, room]));
  const [hovered, setHovered] = useState<number | null>(null);
  const hover = (slot: number, blurb: string) => (h: boolean) => {
    setHovered(h ? slot : null);
    onHoverBlurb?.(h ? blurb : null);
  };
  // The landing keeps the hero text above the bunker: look higher, so the
  // row sits in the lower half of the screen.
  const lookY = demo ? CELL.h / 2 + 3.2 : CELL.h / 2;

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
      <ambientLight color={palette.steelBlue} intensity={0.35} />
      <directionalLight position={[8, 12, 10]} color={palette.boneWhite} intensity={0.5} />

      {/* the earth the bunker is dug into */}
      <mesh position={[0, -2.2, -1]}>
        <boxGeometry args={[ROW_WIDTH * 3, 4, CELL.d + 6]} />
        <meshToonMaterial color="#121315" />
      </mesh>
      <mesh position={[0, CELL.h + 2.4, -2]}>
        <boxGeometry args={[ROW_WIDTH * 3, 4, CELL.d + 4]} />
        <meshToonMaterial color="#121315" />
      </mesh>

      <group position={[slotX(0), 0, 0]}>
        <MainBranchRoom active={activeToday} pending={eventPending} />
        <CellHitbox
          onClick={demo ? undefined : () => onSlotClick(0, true)}
          onHover={hover(0, MAIN_BRANCH_BLURB)}
        />
      </group>

      {BUILDABLE_SLOTS.map((slot) => {
        const room = bySlot.get(slot);
        return (
          <group key={slot} position={[slotX(slot), 0, 0]}>
            {room ? <BuiltRoom kind={room.kind} /> : <EmptyCell highlight={hovered === slot && !demo} />}
            <CellHitbox
              onClick={demo ? undefined : () => onSlotClick(slot, Boolean(room))}
              onHover={hover(slot, room ? ROOM_CATALOG[room.kind].blurb : EMPTY_SLOT_BLURB)}
            />
          </group>
        );
      })}
    </Canvas>
  );
}
